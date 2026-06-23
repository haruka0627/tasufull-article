#!/usr/bin/env node
/**
 * MATCH block/report live verification (linked ref · T1/T2/T3)
 *
 *   node scripts/verify-match-safety-live.mjs
 *   node scripts/verify-match-safety-live.mjs --skip-deploy
 *   node scripts/verify-match-safety-live.mjs --skip-ui
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const T3 = slotByName("T3");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipUi = process.argv.includes("--skip-ui");

const SAFETY_FUNCTIONS = Object.freeze([
  "match-block-user",
  "match-submit-report",
  "match-list-pairs",
  "match-record-swipe",
  "match-ensure-talk-room",
  "match-search-profiles",
]);

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, step, detail = "") {
  results.push({ section, step, ok: true, detail });
  console.log(`  OK  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(section, step, detail = "") {
  results.push({ section, step, ok: false, detail });
  console.error(`  NG  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

async function authFetch(cfg, { method, pathSuffix, body, bearer }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearer || cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function restFetch(cfg, { table, method = "GET", query = "", body }) {
  const key = cfg.serviceRoleKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function edgePost(cfg, functionName, body, token) {
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, text };
}

function deploySafetyFunctions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...SAFETY_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

async function ensureActiveProfile(cfg, userId, nickname) {
  const existing = await restFetch(cfg, {
    table: "match_profiles",
    query: `user_id=eq.${userId}&archived_at=is.null&select=id,profile_status`,
  });
  if (Array.isArray(existing.json) && existing.json.length > 0) {
    const row = existing.json[0];
    if (row.profile_status !== "active") {
      await restFetch(cfg, {
        table: "match_profiles",
        method: "PATCH",
        query: `id=eq.${row.id}`,
        body: { profile_status: "active" },
      });
    }
    return row.id;
  }
  const ins = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: userId,
      nickname,
      gender: "private",
      birth_date: "1995-01-01",
      prefecture: "東京都",
      profile_status: "active",
    },
  });
  return ins.json?.[0]?.id;
}

async function cleanupBetweenUsers(cfg, a, b) {
  const low = a < b ? a : b;
  const high = a < b ? b : a;
  const pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: `user_low_id=eq.${low}&user_high_id=eq.${high}&select=id,talk_room_id`,
  });
  for (const pair of pairs.json ?? []) {
    if (pair.talk_room_id) {
      await restFetch(cfg, {
        table: "transaction_rooms",
        method: "DELETE",
        query: `id=eq.${pair.talk_room_id}`,
      });
    }
    await restFetch(cfg, {
      table: "transaction_rooms",
      method: "DELETE",
      query: `match_pair_id=eq.${pair.id}`,
    });
    await restFetch(cfg, {
      table: "match_pairs",
      method: "DELETE",
      query: `id=eq.${pair.id}`,
    });
  }
  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: `or=(and(swiper_user_id.eq.${a},target_user_id.eq.${b}),and(swiper_user_id.eq.${b},target_user_id.eq.${a}))`,
  });
  await restFetch(cfg, {
    table: "match_blocks",
    method: "DELETE",
    query: `or=(and(blocker_user_id.eq.${a},blocked_user_id.eq.${b}),and(blocker_user_id.eq.${b},blocked_user_id.eq.${a}))`,
  });
}

function feedIds(result) {
  return Array.isArray(result?.json?.items)
    ? result.json.items.map((item) => String(item.user_id))
    : [];
}

function pairPartnerIds(result, viewerId) {
  if (!Array.isArray(result?.json?.pairs)) return [];
  return result.json.pairs.map((p) => String(p.partner_user_id));
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath.replace(/^\//, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ct = filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : filePath.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function isBenignConsoleMessage(text) {
  const msg = String(text || "");
  if (/favicon\.ico/i.test(msg)) return true;
  return false;
}

function writeReport(summary) {
  const out = path.join(ROOT, "reports", "match-safety-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Safety Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Policies\n\n`;
  md += `### 通報のみでは自動ブロックしない\n`;
  md += `Phase 1: \`match-submit-report\` は \`match_reports\` へ保存のみ。ブロックは UI の別導線（スワイプモーダル / \`match-block.html\`）から \`match-block-user\` を呼ぶ。\n\n`;
  md += `### 既存 TALK ルーム（ブロック時）\n`;
  md += `- \`match_pairs.status = blocked\` + \`blocked_by_user_id\` を設定\n`;
  md += `- 紐づく \`transaction_rooms\` は \`status = cancelled\`（ルーム行は削除しない・履歴保持）\n`;
  md += `- 新規 \`match-ensure-talk-room\` は 409（blocked）\n`;
  md += `- 既存ルーム URL 直アクセスの挙動は TALK 側管轄（本フェーズでは変更なし）\n\n`;
  md += `### Admin / moderation TODO\n`;
  md += `- 管理画面での通報キュー審査（\`match_reports.status\` → reviewing/resolved）\n`;
  md += `- \`match-admin-review\` との連携\n`;
  md += `- ブロック解除 API（\`match-unblock-user\`）\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-safety-live.mjs\n`;
  md += `npx supabase functions deploy ${SAFETY_FUNCTIONS.join(" ")} --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  fs.writeFileSync(out, md, "utf8");
  console.log(`\nReport: ${out}`);
}

async function runUiSmoke(baseUrl, t1Token) {
  const edgeBoot = ({ functionsBase, token }) => {
    const boot = () => {
      if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
      window.TasfulMatchAuth.configure({
        isAuthenticated: true,
        talkUserId: "t1",
        matchUserId: "t1",
      });
      window.TasfulMatchAPI.configure({
        mode: "edge_stub",
        functionsBaseUrl: functionsBase,
        getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      });
    };
    document.addEventListener("DOMContentLoaded", boot);
    boot();
  };

  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      ...MATCH_UI_VIEWPORTS,
      { label: "768×1024", width: 768, height: 1024 },
      { label: "1280×900", width: 1280, height: 900 },
    ];
    for (const vp of viewports) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err.message || err)));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenignConsoleMessage(msg.text())) errors.push(msg.text());
      });
      await page.setViewportSize(matchViewportSize(vp));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });
      await page.goto(`${baseUrl}/match/match-swipe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await assertMatchNoHorizontalOverflow(page);
      const label = vp.label || `${vp.width}px`;
      if (errors.length) fail("UI", `${label} swipe console`, errors.slice(0, 2).join("; "));
      else pass("UI", `${label} swipe console`, "0 errors");
      await page.close();
    }

    const stubPage = await browser.newPage();
    const stubErrors = [];
    stubPage.on("pageerror", (err) => stubErrors.push(String(err.message || err)));
    await stubPage.goto(`${baseUrl}/match/match-swipe.html`, { waitUntil: "domcontentloaded" });
    const stubMode = await stubPage.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (stubMode === "client_stub") pass("Smoke", "client_stub default", stubMode);
    else fail("Smoke", "client_stub default", stubMode);
    if (stubErrors.length) fail("Smoke", "client_stub console", stubErrors.join("; "));
    else pass("Smoke", "client_stub console", "0 errors");
    await stubPage.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH safety live · ref=${PROJECT_REF}\n`);

  if (!skipDeploy) {
    try {
      deploySafetyFunctions();
      pass("Deploy", "safety functions", SAFETY_FUNCTIONS.join(", "));
    } catch (err) {
      fail("Deploy", "functions", String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  let t1Token = "";
  let t2Token = "";
  let t3Token = "";
  let pairId = "";

  try {
    const [t1Login, t2Login, t3Login] = await Promise.all([
      login(cfg, T1.email),
      login(cfg, T2.email),
      login(cfg, T3.email),
    ]);
    t1Token = t1Login.data?.access_token || "";
    t2Token = t2Login.data?.access_token || "";
    t3Token = t3Login.data?.access_token || "";
    if (!t1Token || !t2Token || !t3Token) throw new Error("login failed");
    pass("Auth", "T1/T2/T3 login", "ok");
  } catch (err) {
    fail("Auth", "login", String(err.message || err));
  }

  if (t1Token) {
    try {
      await ensureActiveProfile(cfg, "t1", "Safety T1");
      await ensureActiveProfile(cfg, "t2", "Safety T2");
      await ensureActiveProfile(cfg, "t3", "Safety T3");
      await cleanupBetweenUsers(cfg, "t1", "t2");
      pass("Prep", "profiles + cleanup", "ok");
    } catch (err) {
      fail("Prep", "profiles", String(err.message || err));
    }
  }

  if (t1Token) {
    const anonBlock = await edgePost(cfg, "match-block-user", { blocked_user_id: "t2" }, undefined);
    if (anonBlock.status === 401) pass("Security", "anon block 401", String(anonBlock.status));
    else fail("Security", "anon block 401", `status=${anonBlock.status}`);

    const anonReport = await edgePost(
      cfg,
      "match-submit-report",
      { reported_user_id: "t2", reason: "other" },
      undefined,
    );
    if (anonReport.status === 401) pass("Security", "anon report 401", String(anonReport.status));
    else fail("Security", "anon report 401", `status=${anonReport.status}`);
  }

  if (t1Token && t2Token) {
    try {
      await cleanupBetweenUsers(cfg, "t1", "t2");

      const selfBlock = await edgePost(cfg, "match-block-user", { blocked_user_id: "t1" }, t1Token);
      if (selfBlock.status === 422) pass("Block", "self block 422", selfBlock.json?.code || "");
      else fail("Block", "self block", `status=${selfBlock.status}`);

      const selfReport = await edgePost(
        cfg,
        "match-submit-report",
        { reported_user_id: "t1", reason: "other" },
        t1Token,
      );
      if (selfReport.status === 422) pass("Report", "self report 422", selfReport.json?.code || "");
      else fail("Report", "self report", `status=${selfReport.status}`);

      const badReason = await edgePost(
        cfg,
        "match-submit-report",
        { reported_user_id: "t2", reason: "invalid_reason" },
        t1Token,
      );
      if (badReason.status === 422) pass("Report", "reason validation", "422");
      else fail("Report", "reason validation", `status=${badReason.status}`);

      const block1 = await edgePost(
        cfg,
        "match-block-user",
        { blocked_user_id: "t2", reason: "swipe_modal" },
        t1Token,
      );
      if (block1.status !== 200 || !block1.json?.blocked) {
        throw new Error(`block1: ${block1.status} ${block1.text?.slice(0, 200)}`);
      }
      pass("Block", "T1 blocks T2", `block_id=${String(block1.json.block_id || "").slice(0, 8)}`);

      const blockRows = await restFetch(cfg, {
        table: "match_blocks",
        query: "blocker_user_id=eq.t1&blocked_user_id=eq.t2&block_status=eq.active&select=id",
      });
      const blockCount = Array.isArray(blockRows.json) ? blockRows.json.length : 0;
      if (blockCount >= 1) pass("Block", "match_blocks row", String(blockCount));
      else fail("Block", "match_blocks row", "0");

      const dupBlock = await edgePost(
        cfg,
        "match-block-user",
        { blocked_user_id: "t2", reason: "swipe_modal" },
        t1Token,
      );
      if (dupBlock.status === 200 && dupBlock.json?.blocked) pass("Block", "duplicate idempotent", "200");
      else fail("Block", "duplicate idempotent", `status=${dupBlock.status}`);

      const t1Feed = await edgePost(cfg, "match-search-profiles", {}, t1Token);
      const t2Feed = await edgePost(cfg, "match-search-profiles", {}, t2Token);
      if (!feedIds(t1Feed).includes("t2")) pass("Block", "T1 feed excludes T2", "absent");
      else fail("Block", "T1 feed excludes T2", feedIds(t1Feed).join(","));
      if (!feedIds(t2Feed).includes("t1")) pass("Block", "T2 feed excludes T1", "absent");
      else fail("Block", "T2 feed excludes T1", feedIds(t2Feed).join(","));

      await cleanupBetweenUsers(cfg, "t1", "t2");
      await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
      const mutual = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t2Token);
      pairId = mutual.json?.pair_id || "";
      if (!pairId) throw new Error("pair setup failed");
      pass("Prep", "mutual pair", pairId.slice(0, 8));

      await edgePost(cfg, "match-block-user", { blocked_user_id: "t2", reason: "profile" }, t1Token);

      const t1List = await edgePost(cfg, "match-list-pairs", {}, t1Token);
      const t2List = await edgePost(cfg, "match-list-pairs", {}, t2Token);
      if (!pairPartnerIds(t1List, "t1").includes("t2")) pass("Block", "T1 list excludes T2", "ok");
      else fail("Block", "T1 list excludes T2", pairPartnerIds(t1List, "t1").join(","));
      if (!pairPartnerIds(t2List, "t2").includes("t1")) pass("Block", "T2 list excludes T1", "ok");
      else fail("Block", "T2 list excludes T1", pairPartnerIds(t2List, "t2").join(","));

      const talk = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t1Token);
      if (talk.status === 409 || talk.json?.code === "blocked") {
        pass("Block", "ensure-talk-room 409", String(talk.status));
      } else {
        fail("Block", "ensure-talk-room", `status=${talk.status} code=${talk.json?.code}`);
      }

      await cleanupBetweenUsers(cfg, "t1", "t2");
      await edgePost(cfg, "match-block-user", { blocked_user_id: "t2", reason: "swipe" }, t1Token);
      const swipeBlocked = await edgePost(
        cfg,
        "match-record-swipe",
        { target_user_id: "t2", action: "like" },
        t1Token,
      );
      if (swipeBlocked.status === 409 || swipeBlocked.json?.code === "blocked") {
        pass("Block", "swipe blocked 409", String(swipeBlocked.status));
      } else {
        fail("Block", "swipe blocked", `status=${swipeBlocked.status}`);
      }

      await cleanupBetweenUsers(cfg, "t1", "t2");
      const report = await edgePost(
        cfg,
        "match-submit-report",
        {
          reported_user_id: "t2",
          reason: "harassment",
          detail: "safety live test",
          context_type: "profile",
        },
        t1Token,
      );
      if (report.status !== 200 || !report.json?.report_id) {
        throw new Error(`report: ${report.status} ${report.text?.slice(0, 200)}`);
      }
      pass("Report", "T1 reports T2", report.json.report_id.slice(0, 8));

      const reportRows = await restFetch(cfg, {
        table: "match_reports",
        query:
          "reporter_user_id=eq.t1&reported_user_id=eq.t2&order=created_at.desc&limit=1&select=id,status,reason",
      });
      const latest = Array.isArray(reportRows.json) ? reportRows.json[0] : null;
      if (latest?.reason === "harassment" && latest?.status === "open") {
        pass("Report", "match_reports row", latest.status);
      } else {
        fail("Report", "match_reports row", JSON.stringify(latest));
      }

      const feedAfterReport = await edgePost(cfg, "match-search-profiles", {}, t1Token);
      if (feedIds(feedAfterReport).includes("t2")) {
        pass("Report", "report alone does not block", "T2 still in feed");
      } else {
        fail("Report", "report alone does not block", "T2 absent");
      }
    } catch (err) {
      fail("Flow", "block/report", String(err.message || err));
    }
  }

  if (t1Token && t2Token && t3Token) {
    try {
      await cleanupBetweenUsers(cfg, "t1", "t2");
      await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
      const mutual = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t2Token);
      const foreignPairId = mutual.json?.pair_id || "";
      if (!foreignPairId) throw new Error("foreign pair missing");

      const foreign = await edgePost(
        cfg,
        "match-ensure-talk-room",
        { pair_id: foreignPairId },
        t3Token,
      );
      if (foreign.status === 403 || foreign.json?.code === "forbidden") {
        pass("Security", "third-party talk 403", String(foreign.status));
      } else {
        fail("Security", "third-party talk", `status=${foreign.status} code=${foreign.json?.code}`);
      }

      const foreignBlock = await edgePost(
        cfg,
        "match-block-user",
        { blocked_user_id: "t2", match_pair_id: foreignPairId },
        t3Token,
      );
      if (foreignBlock.status === 403 || foreignBlock.json?.code === "forbidden") {
        pass("Security", "third-party block pair 403", String(foreignBlock.status));
      } else {
        fail("Security", "third-party block pair", `status=${foreignBlock.status}`);
      }
      await cleanupBetweenUsers(cfg, "t1", "t2");
    } catch (err) {
      fail("Security", "third-party", String(err.message || err));
    }
  }

  if (!skipUi && t1Token) {
    const port = 18789;
    const server = await startStaticServer(ROOT, port);
    try {
      await runUiSmoke(`http://127.0.0.1:${port}`, t1Token);
    } catch (err) {
      fail("UI", "playwright", String(err.message || err));
    } finally {
      server.close();
    }
  } else if (skipUi) {
    pass("UI", "skipped", "--skip-ui");
  }

  await closeAllBrowsers();
  const failed = results.filter((r) => !r.ok);
  writeReport(
    failed.length === 0
      ? "Block/report live Edge + exclusion paths passed on linked ref."
      : `${failed.length} check(s) failed.`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
