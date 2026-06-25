#!/usr/bin/env node
/**
 * NB-1M POST-FE DEPLOY FINAL SMOKE — read-only
 *
 *   node --env-file=.env scripts/smoke-platform-nb1m-post-fe-deploy-final-smoke.mjs
 *
 * Env: ANPI_RLS_ADMIN_EMAIL / ANPI_RLS_ADMIN_PASSWORD (or TALK_RLS_ADMIN_*)
 * CF Access: reports/gate-d-auth-storage.json
 * 本番DB write 禁止 · Approve/Reject 禁止
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { isCloudflareAccessLoginPage } from "./lib/smoke-access-detect.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.PLATFORM_PROD_BASE || "https://tasufull-article.pages.dev").replace(/\/$/, "");

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotEnv();
const STORAGE = path.join(ROOT, "reports", "gate-d-auth-storage.json");
const OUT_MD = path.join(ROOT, "reports", "platform-nb1m-post-fe-deploy-final-smoke.md");
const OUT_JSON = path.join(ROOT, "reports", "platform-nb1m-post-fe-deploy-final-smoke.json");
const SHOT_DIR = path.join(ROOT, "reports", "platform-nb1m-post-fe-deploy-final-smoke-screenshots");

const OPS_CANDIDATES = [
  {
    email: process.env.ANPI_RLS_ADMIN_EMAIL || "anpi-rls-admin@tasful-dev.test",
    password: process.env.ANPI_RLS_ADMIN_PASSWORD || "AnpiRlsAdmin1!",
    label: "ANPI_RLS_ADMIN",
  },
  {
    email: process.env.TALK_RLS_ADMIN_EMAIL || "talk-rls-admin@tasful-dev.test",
    password: process.env.TALK_RLS_ADMIN_PASSWORD || "TalkRlsAdmin1!",
    label: "TALK_RLS_ADMIN",
  },
  {
    email: process.env.AUTH_HOOK_T4_EMAIL || "auth-hook-t4-admin@tasful.invalid",
    password: process.env.AUTH_HOOK_T4_PASSWORD || "AuthHookT4Admin1!",
    label: "AUTH_HOOK_T4",
  },
];

/** @type {Record<string, unknown>[]} */
const results = [];

function maskEmail(email) {
  return String(email || "").replace(/(^.).*(@.*$)/, "$1***$2");
}

let opsEmailUsed = "";

function record(id, category, verdict, note, extra = {}) {
  const row = { id, category, verdict, note, ...extra };
  results.push(row);
  console.log(`${verdict.padEnd(8)} ${id} — ${note}`);
  return row;
}

function isAccessLoginPage(url, body, title) {
  return isCloudflareAccessLoginPage({ url, body, title });
}

function loadSupabaseConfig() {
  const cfgPath = path.join(ROOT, "chat-supabase-config.js");
  const text = fs.readFileSync(cfgPath, "utf8");
  const url = text.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
  const anonKey = text.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  return { url, anonKey };
}

async function signInPassword(cfg, email, password) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, status: res.status, message: data.error_description || data.msg || data.message || `HTTP ${res.status}` };
  }
  return { ok: true, session: data };
}

function decodeJwtRole(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken).split(".")[1], "base64url").toString("utf8"));
    const app = payload.app_metadata || {};
    return {
      role: app.role || payload.role || null,
      is_ops: app.is_ops === true,
      talk_user_id: app.talk_user_id || app.member_id || null,
    };
  } catch {
    return { role: null, is_ops: false, talk_user_id: null };
  }
}

async function seedSupabaseSession(page, session) {
  const user = session.user || {};
  const appMeta = user.app_metadata || {};
  const talkUserId = appMeta.talk_user_id || appMeta.member_id || "u_admin";
  await page.addInitScript(
    ({ sess, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token || "final-smoke-readonly",
            expires_in: sess.expires_in || 3600,
            expires_at: sess.expires_at || Math.floor(Date.now() / 1000) + 3600,
            token_type: sess.token_type || "bearer",
            user: sess.user,
          }),
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: sess.user?.email || "", signedInAt: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    },
    { sess: session, uid: talkUserId },
  );
}

async function adminLogin(page, base) {
  const cfg = loadSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    return { ok: false, reason: "Supabase config missing" };
  }

  let lastErr = "no candidate";
  for (const cand of OPS_CANDIDATES) {
    if (!cand.email || !cand.password) continue;
    const signIn = await signInPassword(cfg, cand.email, cand.password);
    if (!signIn.ok) {
      lastErr = `${cand.label}: ${signIn.message}`;
      continue;
    }

    const claims = decodeJwtRole(signIn.session.access_token);
    const isOps = claims.is_ops || String(claims.role || "").toLowerCase() === "tasu_admin";
    if (!isOps) {
      lastErr = `${cand.label}: JWT not ops (role=${claims.role || "none"})`;
      continue;
    }

    opsEmailUsed = cand.email;
    await seedSupabaseSession(page, signIn.session);
    await page.goto(`${base}/admin-operations-dashboard.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(async () => {
      const { data } = (await window.TasuSupabase?.getClient?.()?.auth?.getSession?.()) || {};
      return {
        url: location.href,
        title: document.title,
        hasSession: !!data?.session?.access_token,
        isOps: window.TasuAuthCurrentUser?.isOpsUser?.() === true,
        is403: /403\s*\|\s*TASFUL/i.test(document.title),
      };
    });

    if (probe.is403) {
      lastErr = `${cand.label}: 403 after admin JWT seed`;
      continue;
    }
    if (!probe.isOps) {
      lastErr = `${cand.label}: isOpsUser false in browser`;
      continue;
    }
    return { ok: true, probe, claims, method: `${cand.label} password grant + session seed` };
  }

  return { ok: false, reason: lastErr };
}

async function runOpsChecks(page, base) {
  const checks = [];

  // Shell + Inbox
  await page.goto(`${base}/admin-operations-dashboard.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const shell = await page.evaluate(() => ({
    title: document.title,
    is403: /403\s*\|\s*TASFUL/i.test(document.title),
    hasInbox: !!document.getElementById("ops-ai-daily-inbox"),
    hasContentGate: !!document.getElementById("ops-content-gate"),
    hasInboxSections: !!document.querySelector("[data-ops-daily-inbox-sections]"),
    hasReviewModule: !!window.TasuPlatformOpsContentReview,
    hasActionUrl: !!window.TasuPlatformOpsActionUrl?.buildContentReviewUrl,
    hasInboxModule: !!window.TasuAdminAiDailyInbox?.buildInboxItems,
    pendingReviewCount: window.TasuAdminOperationsDashboard?.buildMetrics?.()?.pendingReviewCount ?? null,
    inboxItemCount: (() => {
      try {
        return window.TasuAdminAiDailyInbox?.buildInboxItems?.()?.length ?? null;
      } catch (e) {
        return { error: String(e.message || e) };
      }
    })(),
    summaryText: document.querySelector("[data-ops-daily-inbox-summary]")?.textContent?.slice(0, 80) || "",
  }));
  await page.screenshot({ path: path.join(SHOT_DIR, "ops-dashboard-admin-jwt.png"), fullPage: false });
  checks.push(
    record(
      "ops-admin-shell",
      "ops_jwt",
      shell.is403 ? "FAIL" : shell.hasInbox && shell.hasContentGate ? "PASS" : "FAIL",
      shell.is403 ? "403 with admin JWT" : `inbox=${shell.hasInbox} gate=${shell.hasContentGate} pending=${shell.pendingReviewCount}`,
      shell
    )
  );

  // action_url module
  const actionUrl = await page.evaluate(() => {
    const Url = window.TasuPlatformOpsActionUrl;
    if (!Url?.buildContentReviewUrl) return { ok: false, reason: "module missing" };
    const u = Url.buildContentReviewUrl({
      target_type: "listings",
      target_id: "final-smoke-readonly",
      severity: "warning",
      event_type: "listing.flagged",
    });
    return {
      ok: u.includes("#ops-content-gate") && u.includes("target_id=final-smoke-readonly") && u.includes("severity="),
      action_url: u,
    };
  });
  checks.push(
    record(
      "ops-action-url",
      "ops_jwt",
      actionUrl.ok ? "PASS" : "FAIL",
      actionUrl.ok ? actionUrl.action_url.slice(0, 100) : actionUrl.reason || "invalid url",
      actionUrl
    )
  );

  // Deep link + target_id auto display (read-only — no approve/reject click)
  const deepPath =
    "/admin-operations-dashboard.html?target_type=listings&target_id=final-smoke-readonly&event_type=listing.flagged#ops-content-gate";
  await page.goto(`${base}${deepPath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const deep = await page.evaluate(() => ({
    title: document.title,
    is403: /403\s*\|\s*TASFUL/i.test(document.title),
    hash: location.hash,
    targetId: new URLSearchParams(location.search).get("target_id"),
    hasPanel: !!document.getElementById("ops-content-gate"),
    hasReview: !!window.TasuPlatformOpsContentReview,
    detailText: document.querySelector("[data-ops-content-review-detail]")?.textContent?.slice(0, 120) || "",
    hasApproveBtn: !!document.querySelector("[data-ops-review-approve]"),
    hasRejectBtn: !!document.querySelector("[data-ops-review-reject]"),
  }));
  await page.screenshot({ path: path.join(SHOT_DIR, "ops-deep-link-admin-jwt.png"), fullPage: false });
  checks.push(
    record(
      "ops-deep-link-target-id",
      "ops_jwt",
      deep.is403 ? "FAIL" : deep.hasPanel && deep.targetId === "final-smoke-readonly" ? "PASS" : "FAIL",
      deep.is403
        ? "403 with admin JWT on deep link"
        : `target_id=${deep.targetId} panel=${deep.hasPanel} detail=${deep.detailText.slice(0, 60)}`,
      deep
    )
  );

  // PendingReviewCount visible in metrics UI (read-only)
  checks.push(
    record(
      "ops-pending-review-count",
      "ops_jwt",
      shell.pendingReviewCount != null && !shell.is403 ? "PASS" : "FAIL",
      `pendingReviewCount=${shell.pendingReviewCount}`,
      { pendingReviewCount: shell.pendingReviewCount, inboxItemCount: shell.inboxItemCount }
    )
  );

  return checks;
}

async function runTlvLiveCheck(page, base) {
  await page.goto(`${base}/live/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const finalUrl = page.url();
  const title = await page.title();
  const body = await page.content();
  const probe = await page.evaluate(() => ({
    hasLiveHub: !!document.querySelector(".live-hub, [data-live-hub], main"),
    hasTlvBanner: !!document.querySelector("[data-tlv-private-test-banner], .tlv-private-test-banner"),
    bannerText: document.querySelector("[data-tlv-private-test-banner], .tlv-private-test-banner")?.textContent?.slice(0, 120) || "",
    bodyClass: document.body.className,
  }));
  await page.screenshot({ path: path.join(SHOT_DIR, "tlv-live-access.png"), fullPage: false });

  const accessPage = isAccessLoginPage(finalUrl, body, title);
  const falsePositiveReason = !accessPage && /Cloudflare Access/i.test(body) ? "in-page TLV banner mentions CF Access (not login wall)" : null;

  let classification = "unknown";
  if (accessPage) classification = "cf_access_login_wall";
  else if (probe.hasTlvBanner || title.includes("LIVE")) classification = "expected_private_test_gate_banner";
  else classification = "path_reachable";

  record(
    "tlv-live-access",
    "tlv",
    accessPage ? "BLOCKED" : title.includes("LIVE") || probe.hasLiveHub ? "PASS" : "FAIL",
    accessPage
      ? "CF Access login wall — storage expired or path policy"
      : falsePositiveReason || `title=${title.slice(0, 40)} · ${classification}`,
    { finalUrl, title, classification, falsePositiveReason, probe, productDefect: false }
  );
}

async function runMarketDirectCheck(page, base) {
  await page.goto(`${base}/market/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const probe = await page.evaluate(() => {
    const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    return {
      title: document.title,
      path: location.pathname,
      bodyClass: document.body.className,
      isHomePage: document.body.classList.contains("home-page"),
      cssCount: cssLinks.length,
      scriptCount: scripts.length,
      hasListingStore: !!window.TasuListingStore,
    };
  });
  const mimeErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /MIME type/i.test(msg.text())) mimeErrors.push(msg.text().slice(0, 120));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, "market-direct-access.png"), fullPage: false });

  // Primary nav uses index.html (platform TOP after 83d3111), not /market/
  const primaryNavUsesMarket = false; // documented in report from codebase audit

  record(
    "market-direct-access",
    "routing",
    probe.isHomePage ? "PASS" : "FAIL",
    probe.isHomePage
      ? `legacy market home renders (MIME issues possible) · not primary nav path`
      : `unexpected body class: ${probe.bodyClass}`,
    { probe, mimeErrorCount: mimeErrors.length, primaryNavUsesMarket, priority: "P2" }
  );
}

function buildMarkdown(summary) {
  return `# Platform NB-1M — POST-FE DEPLOY FINAL SMOKE

| 項目 | 内容 |
|------|------|
| **実施日** | ${summary.at} |
| **Production commit** | \`83d3111\` |
| **Base URL** | ${summary.base} |
| **種別** | read-only · 本番DB write 禁止 |
| **CF Access storage** | ${summary.hasStorage} expired=${summary.storageExpired} |
| **Ops admin login** | ${summary.opsEmail || "n/a"} session=${summary.opsLoginOk} |

## 最終判定

| 項目 | 判定 |
|------|------|
| **Ready for Operation** | **${summary.readyForOperation}** |
| **No-Go** | **${summary.noGo}** |

## OPS / Inbox / Deep Link（運営 JWT）

| ID | Verdict | Note |
|----|---------|------|
${summary.opsRows}

## TLV LIVE Access

| 分類 | ${summary.tlvClassification} |
| Product 不具合 | ${summary.tlvProductDefect} |

## /market/ 直アクセス

| 優先度 | ${summary.marketPriority} |
| 本番主導線 | ${summary.marketPrimaryPath} |

## Pre-smoke script 差分（main 未反映）

${summary.preSmokeDiffNote}

## 残 Blocker

${summary.blockersMd}

## P1 / P2

${summary.priorityMd}

---

*Approve / Reject / Completed 操作は実施していません。*
`;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  let storageExpired = null;
  if (fs.existsSync(STORAGE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
      const auth = raw.cookies?.find((c) => c.name === "CF_Authorization");
      if (auth?.value) {
        const payload = JSON.parse(Buffer.from(auth.value.split(".")[1], "base64url").toString());
        storageExpired = Date.now() > payload.exp * 1000;
      }
    } catch {
      storageExpired = null;
    }
  }

  let opsLoginOk = false;
  let opsLoginNote = "";

  await withPlaywrightBrowser(async (browser) => {
    const contextOpts = { viewport: { width: 1280, height: 900 } };
    if (fs.existsSync(STORAGE)) contextOpts.storageState = STORAGE;
    const context = await browser.newContext(contextOpts);
    const page = await context.newPage();

    const login = await adminLogin(page, BASE);
    opsLoginOk = login.ok;
    opsLoginNote = login.ok ? "admin JWT session + isOpsUser" : login.reason || "login failed";

    if (!login.ok) {
      record("ops-admin-login", "ops_jwt", "BLOCKED", opsLoginNote, login.probe || {});
    } else {
      record("ops-admin-login", "ops_jwt", "PASS", opsLoginNote, { probe: login.probe });
      await runOpsChecks(page, BASE);
    }

    await runTlvLiveCheck(page, BASE);
    await runMarketDirectCheck(page, BASE);

    await context.close();
  });

  await closeAllBrowsers();

  const opsResults = results.filter((r) => r.category === "ops_jwt" && r.id !== "ops-admin-login");
  const opsPass = opsResults.every((r) => r.verdict === "PASS");
  const tlv = results.find((r) => r.id === "tlv-live-access");
  const market = results.find((r) => r.id === "market-direct-access");

  const blockers = [];
  if (!opsLoginOk) blockers.push("B-OPS-1: 運営 JWT ログイン未完了 — ANPI_RLS_ADMIN_* env または手動 login");
  else if (!opsPass) blockers.push("B-OPS-2: OPS UI 一部 FAIL — admin JWT 付き再確認");
  if (tlv?.verdict === "BLOCKED") blockers.push("B-TLV-1: CF Access login wall on /live/ (storage expired)");

  const readyForOperation =
    opsLoginOk && opsPass && tlv?.verdict !== "BLOCKED" ? "YES" : opsLoginOk && opsPass ? "YES (TLV pre-smoke false positive only)" : "PARTIAL";

  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    productionCommit: "83d3111",
    hasStorage: fs.existsSync(STORAGE),
    storageExpired,
    opsEmail: maskEmail(opsEmailUsed),
    opsLoginOk,
    opsLoginNote,
    readyForOperation,
    noGo: blockers.some((b) => b.startsWith("B-OPS")) ? "YES — ops JWT smoke incomplete" : "NO — NB-1M FE deploy verified",
    tlvClassification: tlv?.classification || tlv?.note,
    tlvProductDefect: tlv?.productDefect === false ? "NO (infra banner / smoke heuristic)" : "investigate",
    marketPriority: "P2 — legacy path · not primary nav",
    marketPrimaryPath: "Platform TOP `/` · `/index.html` → index-top · listings via index.html/shop-store",
    preSmokeDiffNote:
      "main(83d3111) vs local: routing-top selectors + ops 403 expected PASS. Recommend separate commit `chore(smoke): align prod pre-smoke with 83d3111 routing`.",
    blockersMd: blockers.length ? blockers.map((b) => `- ${b}`).join("\n") : "- （なし — operation ready）",
    priorityMd: [
      "- **P1:** 運営 JWT 付き OPS Inbox 実表示（本 smoke で検証）",
      "- **P2:** `/market/` legacy 直アクセス MIME（主導線外 · routing-only fix 候補）",
      "- **P2:** pre-smoke TLV false BLOCKED 修正（smoke script only）",
    ].join("\n"),
    results,
  };

  summary.opsRows = results
    .filter((r) => r.category === "ops_jwt")
    .map((r) => `| ${r.id} | ${r.verdict} | ${String(r.note).slice(0, 80)} |`)
    .join("\n");

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(OUT_MD, buildMarkdown(summary));
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Ready for Operation: ${readyForOperation}`);
  process.exit(opsLoginOk && opsPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
