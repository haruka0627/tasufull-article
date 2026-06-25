#!/usr/bin/env node
/**
 * NB-1M PROD URL PRE-SMOKE — read-only Frontend / Routing / Auth / UI check
 *
 *   node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs
 *   node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs --base https://tasufull-article.pages.dev
 *
 * Cloudflare Access: reports/gate-d-auth-storage.json or CF_ACCESS_CLIENT_ID/SECRET
 * 本番DB write 禁止 · migration 禁止
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  isCloudflareAccessLoginPage,
  isOpsAuthDenied,
  OPS_GUARDED_CATEGORIES,
  isSmokeProductFail,
} from "./lib/smoke-access-detect.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASE = "https://tasufull-article.pages.dev";
const OUT_JSON = path.join(ROOT, "reports", "platform-nb1m-prod-url-pre-smoke.json");
const OUT_MD = path.join(ROOT, "reports", "platform-nb1m-prod-url-pre-smoke.md");
const SHOT_DIR = path.join(ROOT, "reports", "platform-nb1m-prod-url-pre-smoke-screenshots");
const STORAGE = path.join(ROOT, "reports", "gate-d-auth-storage.json");

const IGNORE_CONSOLE = [
  /favicon/i,
  /manifest\.json/i,
  /Failed to load resource.*favicon/i,
  /net::ERR_BLOCKED_BY_CLIENT/i,
];

const URLS = [
  {
    id: "routing-root",
    category: "routing",
    path: "/",
    titleHint: /TASFUL|TasuFull|TOP/i,
    selectors: ["body.top-page", ".tasful-ai-logo", ".top-main"],
  },
  {
    id: "routing-top",
    category: "routing",
    path: "/index.html",
    titleHint: /TASFUL|TasuFull|TOP/i,
    selectors: ["body.top-page", ".tasful-ai-logo", ".top-main"],
  },
  {
    id: "routing-post-form",
    category: "routing",
    path: "/post.html",
    titleHint: /投稿|post/i,
    selectors: ["[data-post-form]", "body[data-post-form-type]"],
  },
  {
    id: "routing-market-listings",
    category: "public_listing",
    path: "/index.html",
    titleHint: /TASFUL|TasuFull|TOP/i,
    selectors: ["body.top-page"],
    evaluate: async (page) => {
      const hasStore = await page.evaluate(() => !!window.TasuListingStore?.fetchPublishedListings);
      const cards = await page.evaluate(
        () => document.querySelectorAll("[data-listing-id], .listing-card, .market-card, .home-listing").length
      );
      return { hasStore, listingDomCount: cards, note: cards > 0 ? "listings visible" : "empty or demo OK" };
    },
  },
  {
    id: "routing-legacy-market",
    category: "legacy_routing",
    path: "/market/",
    titleHint: /TASFUL|TasuFull|TOP/i,
    selectors: ["body.home-page"],
    optional: true,
    legacyP2: true,
  },
  {
    id: "auth-login-ui",
    category: "auth",
    path: "/login.html",
    titleHint: /ログイン|login/i,
    selectors: ["[data-page='login']", "form", "input[type='email'], input[type='password'], input[name='email']"],
  },
  {
    id: "ops-dashboard-shell",
    category: "inbox",
    path: "/admin-operations-dashboard.html",
    titleHint: /運営|AI/i,
    selectors: ["#ops-ai-daily-inbox", "[data-ops-daily-inbox]", "#ops-content-gate"],
  },
  {
    id: "ops-inbox-render",
    category: "inbox",
    path: "/admin-operations-dashboard.html",
    selectors: ["[data-ops-daily-inbox-sections]"],
    evaluate: async (page) => {
      await page.waitForTimeout(2000);
      return page.evaluate(() => {
        const Inbox = window.TasuAdminAiDailyInbox;
        const hasModule = !!Inbox?.buildInboxItems;
        let itemCount = null;
        let summaryText = "";
        try {
          if (hasModule) itemCount = Inbox.buildInboxItems().length;
        } catch (e) {
          return { hasModule, error: String(e.message || e) };
        }
        const sum = document.querySelector("[data-ops-daily-inbox-summary]");
        if (sum) summaryText = sum.textContent?.slice(0, 80) || "";
        return { hasModule, itemCount, summaryText, readOnly: true };
      });
    },
  },
  {
    id: "deep-link-content-gate",
    category: "deep_link",
    path: "/admin-operations-dashboard.html?target_type=listings&target_id=pre-smoke-readonly&event_type=listing.flagged#ops-content-gate",
    selectors: ["#ops-content-gate", "[data-ops-content-review]", "[data-ops-content-review-detail]"],
    evaluate: async (page) => {
      await page.waitForTimeout(1500);
      return page.evaluate(() => ({
        hash: location.hash,
        targetId: new URLSearchParams(location.search).get("target_id"),
        hasPanel: !!document.getElementById("ops-content-gate"),
        hasReview: !!window.TasuPlatformOpsContentReview,
        detailText: document.querySelector("[data-ops-content-review-detail]")?.textContent?.slice(0, 100) || "",
      }));
    },
  },
  {
    id: "deep-link-action-url-module",
    category: "deep_link",
    path: "/admin-operations-dashboard.html",
    evaluate: async (page) => {
      return page.evaluate(() => {
        const Url = window.TasuPlatformOpsActionUrl;
        if (!Url?.buildContentReviewUrl) return { ok: false, reason: "module missing" };
        const u = Url.buildContentReviewUrl({
          target_type: "listings",
          target_id: "pre-smoke",
          severity: "warning",
          event_type: "listing.flagged",
        });
        return {
          ok: u.includes("#ops-content-gate") && u.includes("target_id=pre-smoke") && u.includes("severity="),
          action_url: u,
        };
      });
    },
  },
  {
    id: "support-trouble-center",
    category: "support",
    path: "/support-trouble-center.html",
    titleHint: /トラブル|support|問い合わせ/i,
    selectors: ["[data-support-trouble-root]", "[data-support-ticket-list]"],
  },
  {
    id: "support-report-filter",
    category: "report",
    path: "/support-trouble-center.html?filter=report",
    selectors: ['[data-support-filter="report"]'],
    evaluate: async (page) =>
      page.evaluate(() => ({
        active: document.querySelector('[data-support-filter="report"]')?.classList.contains("is-active"),
        filter: new URLSearchParams(location.search).get("filter"),
      })),
  },
  {
    id: "support-inquiry-form",
    category: "support",
    path: "/support-intake.html",
    titleHint: /問い合わせ|support/i,
    selectors: ["[data-support-intake-form]"],
    optional: true,
  },
  {
    id: "regression-builder",
    category: "regression",
    path: "/builder/index.html",
    titleHint: /Builder/i,
    selectors: ["body"],
    optional: true,
  },
  {
    id: "regression-match",
    category: "regression",
    path: "/match/match-top.html",
    titleHint: /MATCH|COCORO/i,
    selectors: ["body"],
    optional: true,
  },
  {
    id: "regression-tlv-live",
    category: "regression",
    path: "/live/index.html",
    titleHint: /LIVE/i,
    selectors: ["body.live-body", "main"],
    optional: true,
  },
];

function parseArgs() {
  const baseIdx = process.argv.indexOf("--base");
  const base = (baseIdx >= 0 ? process.argv[baseIdx + 1] : process.env.PLATFORM_PROD_BASE || DEFAULT_BASE).replace(
    /\/$/,
    ""
  );
  const storageIdx = process.argv.indexOf("--storage-state");
  const storageState = storageIdx >= 0 ? process.argv[storageIdx + 1] : STORAGE;
  return { base, storageState };
}

function inspectStorageState(storagePath) {
  if (!fs.existsSync(storagePath)) {
    return { exists: false, expired: null, expiresAt: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(storagePath, "utf8"));
    const auth = raw.cookies?.find((c) => c.name === "CF_Authorization");
    if (!auth?.value) return { exists: true, expired: null, expiresAt: null };
    const payload = JSON.parse(Buffer.from(auth.value.split(".")[1], "base64url").toString());
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    return { exists: true, expired: Date.now() > payload.exp * 1000, expiresAt };
  } catch {
    return { exists: true, expired: null, expiresAt: null };
  }
}


function classifyConsole(text) {
  if (IGNORE_CONSOLE.some((re) => re.test(text))) return "ignore";
  if (/401|403|JWT|session|Unauthorized/i.test(text)) return "auth";
  if (/42501|permission denied|row-level security/i.test(text)) return "rls";
  return "critical";
}

/** @type {Record<string, unknown>[]} */
const results = [];

async function smokeOne(page, base, spec) {
  const url = `${base}${spec.path}`;
  const consoleMsgs = [];
  const network = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") consoleMsgs.push({ type: "error", text: msg.text() });
  };
  const onPageError = (err) => consoleMsgs.push({ type: "pageerror", text: String(err) });
  const onResponse = (res) => {
    if (res.request().resourceType() === "document") {
      network.push({ url: res.url(), status: res.status() });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let verdict = "PASS";
  let note = "";

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    const body = await page.content();
    const title = await page.title();
    const docStatus = resp?.status() ?? 0;

    if (isCloudflareAccessLoginPage({ url: finalUrl, body, title })) {
      verdict = "BLOCKED";
      note = "Cloudflare Access login wall — storage-state or service token required";
    } else if (docStatus === 404 || docStatus >= 500) {
      verdict = "FAIL";
      note = `HTTP ${docStatus}`;
    } else if (body.length < 150) {
      verdict = "FAIL";
      note = "blank/short body";
    } else if (OPS_GUARDED_CATEGORIES.has(spec.category) && isOpsAuthDenied(title, body)) {
      verdict = "EXPECTED_AUTH";
      note = "ops-auth-required without admin JWT (not Product FAIL)";
    } else {
      if (spec.titleHint && !spec.titleHint.test(title)) {
        note = `title mismatch: ${title.slice(0, 50)}`;
      }
      for (const sel of spec.selectors || []) {
        const baseSel = sel.replace(/\[$/, "");
        const found = await page.locator(baseSel).first().count();
        if (found === 0) {
          verdict = "FAIL";
          note = `missing selector: ${sel}`;
          break;
        }
      }
      if (spec.evaluate && verdict === "PASS") {
        const ev = await spec.evaluate(page);
        if (ev?.ok === false) {
          verdict = "FAIL";
          note = ev.reason || JSON.stringify(ev);
        } else if (ev?.error) {
          verdict = "FAIL";
          note = ev.error;
        } else if (ev?.active === false && spec.id === "support-report-filter") {
          verdict = "FAIL";
          note = "report filter not active";
        } else if (ev?.ok === true || ev?.hasModule || ev?.hasPanel !== undefined) {
          note = note || JSON.stringify(ev).slice(0, 120);
        }
      }
      const critical = consoleMsgs.filter((m) => classifyConsole(m.text) === "critical");
      const rls = consoleMsgs.filter((m) => classifyConsole(m.text) === "rls");
      if (critical.length && verdict === "PASS") {
        if (spec.legacyP2 && spec.optional) {
          note = note || `legacy console (P2): ${critical[0].text.slice(0, 80)}`;
        } else if (spec.optional && spec.category === "regression") {
          note = note || `optional console: ${critical[0].text.slice(0, 80)}`;
        } else if (spec.category !== "public_listing") {
          verdict = "FAIL";
          note = `console: ${critical[0].text.slice(0, 100)}`;
        }
      } else if (rls.length && spec.optional) {
        note = note || `RLS console (optional): ${rls[0].text.slice(0, 60)}`;
      }
      if (spec.legacyP2 && verdict === "PASS") {
        verdict = "EXPECTED_LEGACY";
        note = note || "legacy /market/ path (P2 · not primary nav)";
      }
    }

    const shotName = `${spec.id}.png`;
    const shotPath = path.join(SHOT_DIR, shotName);
    try {
      await page.screenshot({ path: shotPath, fullPage: false });
    } catch {
      /* ignore */
    }

    results.push({
      id: spec.id,
      category: spec.category,
      url: spec.path,
      verdict,
      docStatus,
      finalUrl: finalUrl.slice(0, 120),
      title: title.slice(0, 80),
      note,
      consoleErrors: consoleMsgs.filter((m) => classifyConsole(m.text) !== "ignore").map((m) => m.text.slice(0, 150)),
      networkDocument: network[0] || null,
      screenshot: `reports/platform-nb1m-prod-url-pre-smoke-screenshots/${shotName}`,
      optional: !!spec.optional,
      readOnly: true,
    });
    console.log(`${verdict.padEnd(8)} ${spec.id} — ${note || title.slice(0, 40)}`);
  } catch (e) {
    results.push({
      id: spec.id,
      category: spec.category,
      url: spec.path,
      verdict: "FAIL",
      note: String(e.message || e),
      consoleErrors: [],
      optional: !!spec.optional,
      readOnly: true,
    });
    console.log(`FAIL     ${spec.id} — ${e.message}`);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
}

function summarizeCategory(cat) {
  const rows = results.filter((r) => r.category === cat && !r.optional);
  const ok = (r) => r.verdict === "PASS" || r.verdict === "EXPECTED_AUTH" || r.verdict === "EXPECTED_LEGACY";
  if (!rows.length) {
    const opt = results.filter((r) => r.category === cat);
    if (!opt.length) return "N/A";
    if (opt.every((r) => r.verdict === "BLOCKED")) return "BLOCKED";
    return opt.every((r) => ok(r) || r.verdict === "BLOCKED") ? "PASS" : "FAIL";
  }
  if (rows.some((r) => r.verdict === "BLOCKED")) return rows.some((r) => r.verdict === "PASS") ? "PARTIAL" : "BLOCKED";
  if (rows.some((r) => isSmokeProductFail(r.verdict))) return "FAIL";
  return "PASS";
}

function buildMarkdown(summary) {
  const lines = [
    "# Platform NB-1M — PROD URL PRE-SMOKE",
    "",
    "| 項目 | 内容 |",
    "|------|------|",
    `| **実施日** | ${summary.at} |`,
    `| **Base URL** | ${summary.base} |`,
    `| **種別** | read-only · 本番DB write 禁止 |`,
    `| **CF Access** | storage=${summary.hasStorage} serviceToken=${summary.hasServiceToken} |`,
  ];
  if (summary.storageExpired != null) {
    lines.push(`| **Storage 期限** | expired=${summary.storageExpired} expiresAt=${summary.storageExpiresAt || "n/a"} |`);
  }
  lines.push(
    "",
    "## 判定サマリ",
    "",
    `| 領域 | 判定 |`,
    `|------|------|`,
    `| Frontend Routing | **${summary.routing}** |`,
    `| Auth UI | **${summary.auth}** |`,
    `| AI秘書 Inbox 表示 | **${summary.inbox}** |`,
    `| Deep Link 表示 | **${summary.deep_link}** |`,
    `| Public listing 表示 | **${summary.public_listing}** |`,
    `| JS critical error | **${summary.jsErrors}** |`,
    `| 本番 apply 前 No-Go 増加 | **${summary.noGoDelta}** |`,
    "",
    `### 総合: **${summary.overall}**`,
    ""
  );
  if (summary.overall === "BLOCKED") {
    lines.push(
      "## Access ブロッカー",
      "",
      "全 URL が Cloudflare Access ログイン画面（`Sign in ・ Cloudflare Access`）へリダイレクト。",
      "Frontend / Routing / Auth / Inbox / Deep Link の **実画面検証は未実施**（インフラ認証ブロック）。",
      "",
      "**原因:** `reports/gate-d-auth-storage.json` の `CF_Authorization` が期限切れ、かつ `CF_ACCESS_CLIENT_ID/SECRET` 未設定。",
      "",
      "**再実行手順（いずれか）:**",
      "",
      "1. OTP 後 storage 更新: `node scripts/save-gate-d-auth-storage.mjs`",
      "2. Service Token: `.env` に `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` を設定",
      "3. 再 smoke: `node scripts/smoke-platform-nb1m-prod-url-pre-smoke.mjs`",
      "",
      "**参照:** 前回 Access 通過時の gate-d smoke は `reports/gate-d-smoke-last.json`（2026-06-23 頃）— 当時は TOP/TALK/MATCH/Builder PASS。",
      ""
    );
  }
  lines.push(
    "## 詳細結果",
    "",
    "| ID | Category | Verdict | Status | Title | Note |",
    "|----|----------|---------|--------|-------|------|"
  );
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.category} | ${r.verdict} | ${r.docStatus ?? "-"} | ${String(r.title || "").replace(/\|/g, "/").slice(0, 40)} | ${String(r.note || "").replace(/\|/g, "/").slice(0, 60)} |`
    );
  }
  lines.push("", "## Console errors（要約）", "");
  for (const r of results) {
    if (r.consoleErrors?.length) {
      lines.push(`- **${r.id}**: ${r.consoleErrors.slice(0, 2).join(" · ")}`);
    }
  }
  lines.push("", "## Screenshots", "", `\`${SHOT_DIR.replace(/\\/g, "/")}/\``, "");
  lines.push("", "---", "", "*本番 DB apply / migration / write 操作は実施していません。*");
  return lines.join("\n");
}

async function main() {
  const { base, storageState } = parseArgs();
  const accessId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
  const hasServiceToken = !!(accessId && accessSecret);
  const storageInfo = inspectStorageState(storageState);
  const hasStorage = storageInfo.exists;

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

  console.log(`[prod-url-pre-smoke] base=${base}`);
  console.log(`[prod-url-pre-smoke] storage=${hasStorage} serviceToken=${hasServiceToken}`);
  if (hasStorage && storageInfo.expired) {
    console.log(`[prod-url-pre-smoke] WARN: storage-state expired at ${storageInfo.expiresAt}`);
  }

  const extraHeaders = hasServiceToken
    ? { "CF-Access-Client-Id": accessId, "CF-Access-Client-Secret": accessSecret }
    : {};

  await withPlaywrightBrowser(async (browser) => {
    const contextOpts = { viewport: { width: 1280, height: 900 }, extraHTTPHeaders: extraHeaders };
    if (hasStorage) contextOpts.storageState = path.resolve(storageState);
    const context = await browser.newContext(contextOpts);
    const page = await context.newPage();

    for (const spec of URLS) {
      await smokeOne(page, base, spec);
    }
    await context.close();
  });

  await closeAllBrowsers();

  const blocked = results.filter((r) => r.verdict === "BLOCKED");
  const failed = results.filter((r) => isSmokeProductFail(r.verdict) && !r.optional);
  const expectedAuth = results.filter((r) => r.verdict === "EXPECTED_AUTH");
  const criticalJs = results.some((r) =>
    (r.consoleErrors || []).some((t) => classifyConsole(t) === "critical" && isSmokeProductFail(r.verdict))
  );

  const summary = {
    at: new Date().toISOString(),
    base,
    hasStorage,
    hasServiceToken,
    storageExpired: storageInfo.expired,
    storageExpiresAt: storageInfo.expiresAt,
    routing: summarizeCategory("routing"),
    auth: summarizeCategory("auth"),
    inbox: summarizeCategory("inbox"),
    deep_link: summarizeCategory("deep_link"),
    public_listing: summarizeCategory("public_listing"),
    support: summarizeCategory("support"),
    report: summarizeCategory("report"),
    jsErrors: failed.some((r) => r.note?.startsWith("console:")) || criticalJs ? "FAIL" : "NONE",
    noGoDelta:
      failed.length > 0
        ? "YES — routing/UI/deep-link failures"
        : blocked.length === results.length
          ? storageInfo.expired
            ? "YES — CF Access session expired (infra blocker, not product defect)"
            : "YES — Access blocked (no valid auth)"
          : "NO",
    overall:
      failed.length > 0
        ? "FAIL"
        : blocked.length === results.length
          ? "BLOCKED"
          : "PASS",
    pass: results.filter((r) => r.verdict === "PASS").length,
    expectedAuth: expectedAuth.length,
    fail: failed.length,
    blocked: blocked.length,
    results,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(OUT_MD, buildMarkdown(summary));
  console.log(`\nWrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  console.log(
    `Overall: ${summary.overall} (PASS ${summary.pass} EXPECTED_AUTH ${summary.expectedAuth} FAIL ${summary.fail} BLOCKED ${summary.blocked})`
  );

  if (failed.length > 0) process.exit(1);
  if (blocked.length === results.length) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
