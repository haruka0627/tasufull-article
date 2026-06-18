#!/usr/bin/env node
/**
 * TASFUL 全体回帰 — TALK / 司令塔 / サポート / 通知 / レイアウト
 *   node scripts/test-tasful-regression-final.mjs
 *   node scripts/test-tasful-regression-final.mjs --skip-suites   # smoke only
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "tasful-regression-final");
const REPORT = path.join(root, "reports", "tasful-regression-final-result.md");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844, isMobile: true },
  { id: "430", width: 430, height: 932, isMobile: true },
  { id: "768", width: 768, height: 1024, isMobile: false },
  { id: "1280", width: 1280, height: 800, isMobile: false },
  { id: "1440", width: 1440, height: 900, isMobile: false },
];

const SUPPORT_ID = "talk-hub-support";
const FRIEND_THREAD = "talk-mock-friend-001";
const OPS_SEED_KEYS = [
  "tasu_support_tickets_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_cases_v1",
  "tasu_stripe_event_ingest_logs_v1",
  "tasu_ai_action_executed_v1",
  "tasu_ai_action_audit_log_v1",
  "tasful:builder:partner_visibility:v1",
];

let opsDashboardSeeded = false;

const SUITE_SCRIPTS = [
  "test-talk-support-room.mjs",
  "test-talk-chat-hub-browser.mjs",
  "test-talk-composer-line-ui.mjs",
  "test-talk-ops-split-browser.mjs",
  "test-admin-operations-dashboard-browser.mjs",
  "test-admin-ops-dashboard-ui-final.mjs",
  "test-morning-summary-jump.mjs",
  "test-support-trouble-center-browser.mjs",
];

const failures = [];
const passes = [];
const consoleErrors = [];
const suiteResults = [];

function fail(area, msg) {
  failures.push(`[${area}] ${msg}`);
  console.error(`  ✗ [${area}] ${msg}`);
}

function pass(area, msg) {
  passes.push(`[${area}] ${msg}`);
  console.log(`  ✓ [${area}] ${msg}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /CORS|ERR_FAILED|serper-search|gemini-chat|supabase\.co|Failed to load resource/i.test(t);
}

async function runSuite(scriptName) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BUILDER_BASE_URL: base, BASE_URL: base },
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      suiteResults.push({ script: scriptName, code: 124, output: out.slice(-800) + "\n(timeout)" });
      resolve(false);
    }, 8 * 60 * 1000);
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      suiteResults.push({ script: scriptName, code: code ?? 1, output: out.slice(-800) });
      resolve(code === 0);
    });
  });
}

let base = "";

async function seedUserTalk(page) {
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(
    () =>
      window.TasuTalkData?.getStaticChatHubCards?.()?.some((c) => c.id === "talk-hub-support") &&
      window.TasuTalkData?.getTalkAudience?.(),
    { timeout: 20000 }
  );
  await page.waitForSelector(`[data-talk-thread-id="${SUPPORT_ID}"]`, { timeout: 20000 });
}

async function checkUserTalk(page, vp) {
  const area = `user-talk/${vp.id}`;
  await seedUserTalk(page);
  const state = await page.evaluate((supportId) => {
    const names = [...document.querySelectorAll(".talk-line-list__name")].map((el) =>
      el.textContent?.trim()
    );
    const cards = window.TasuTalkData?.getStaticChatHubCards?.() || [];
    const support = cards.find((c) => c.id === supportId);
    return {
      names,
      hasAi: names.includes("TASFUL AI") || cards.some((c) => c.id === "talk-hub-ai"),
      hasSupport:
        names.some((n) => n.includes("TASFULサポート")) ||
        Boolean(document.querySelector(`[data-talk-thread-id="${supportId}"]`)),
      supportHref: window.TasuTalkData?.resolveChatTalkHref?.(support || {}),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      tabBar: Boolean(document.querySelector("[data-talk-mobile-tabbar]")),
      audience: window.TasuTalkData?.getTalkAudience?.() || "user",
    };
  }, SUPPORT_ID);

  if (state.overflow) fail(area, "horizontal overflow");
  else pass(area, "no horizontal overflow");

  if (state.hasAi) fail(area, "TASFUL AI visible");
  else pass(area, "TASFUL AI hidden");

  if (!state.hasSupport) fail(area, "TASFULサポート missing");
  else pass(area, "TASFULサポート visible");

  if (!state.supportHref?.includes("#thread=talk-hub-support")) {
    fail(area, `support inline href: ${state.supportHref}`);
  } else pass(area, "support opens inline room");

  if (state.audience !== "user") fail(area, `audience=${state.audience}`);
  else pass(area, "audience=user");

  await page.screenshot({ path: path.join(OUT, `${vp.id}-user-talk-list.png`), fullPage: false });

  await page.waitForSelector(`[data-talk-select-thread][data-talk-thread-id="${SUPPORT_ID}"]`, {
    timeout: 15000,
  });
  await page.click(`[data-talk-select-thread][data-talk-thread-id="${SUPPORT_ID}"]`);
  await page.waitForFunction(
    () => {
      const active = document.querySelector("[data-talk-line-room-active]");
      const btn = document.querySelector("[data-talk-support-new-inquiry]");
      return active && !active.hidden && Boolean(btn);
    },
    { timeout: 10000 }
  );
  pass(area, "support room opens");

  const bottomNavHidden = await page.evaluate(() => {
    const tab = document.querySelector("[data-talk-mobile-tabbar]");
    if (!tab) return true;
    const style = window.getComputedStyle(tab);
    return style.display === "none" || style.visibility === "hidden" || tab.hidden;
  });
  if (!bottomNavHidden) fail(area, "bottom nav should hide in chat room");
  else pass(area, "bottom nav hidden in chat");

  await page.screenshot({ path: path.join(OUT, `${vp.id}-user-support-room.png`), fullPage: false });

  if (vp.id === "390") {
    await page.click("[data-talk-support-new-inquiry]");
    await page.waitForURL(/support-intake\.html/, { timeout: 15000 });
    if (!page.url().includes("support-intake.html")) fail(area, "intake not opened");
    else pass(area, "新しい問い合わせ → support-intake.html");
    await page.screenshot({ path: path.join(OUT, `${vp.id}-support-intake.png`), fullPage: false });
    await page.goto(buildLocalPageUrl(base, "support-intake.html"), { waitUntil: "domcontentloaded" });
    const intakeOk = await page.evaluate(() => Boolean(document.querySelector("[data-support-intake-form]")));
    if (!intakeOk) fail(area, "support-intake standalone broken");
    else pass(area, "support-intake standalone OK");
  }

  await page.goto(
    buildLocalPageUrl(base, "talk-home.html", `?tab=chat&thread=${FRIEND_THREAD}&talkDev=1`),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(
    () => {
      const active = document.querySelector("[data-talk-line-room-active]");
      const composer = document.querySelector("[data-talk-line-composer]");
      return active && !active.hidden && composer && !composer.hidden;
    },
    { timeout: 10000 }
  );
  pass(area, "normal chat opens");

  const composerUi = await page.evaluate(() => {
    const composer = document.querySelector("[data-talk-line-composer]");
    const smile = composer?.querySelector('[data-talk-line-action="emoji"]');
    const send = composer?.querySelector("[data-talk-line-composer-send]");
    const style = composer ? window.getComputedStyle(composer) : null;
    const safePad = style ? parseFloat(style.paddingBottom || "0") >= 0 : false;
    return {
      hasComposer: Boolean(composer),
      hasSmile: Boolean(smile),
      hasSend: Boolean(send),
      safePad,
    };
  });
  if (!composerUi.hasComposer || !composerUi.hasSmile || !composerUi.hasSend) {
    fail(area, `composer UI incomplete: ${JSON.stringify(composerUi)}`);
  } else pass(area, "composer UI intact");

  await page.screenshot({ path: path.join(OUT, `${vp.id}-user-normal-chat.png`), fullPage: false });
}

async function checkAdminOpsTalk(page, vp) {
  const area = `admin-talk/${vp.id}`;
  await page.goto(
    buildLocalPageUrl(base, "talk-home.html", "?audience=admin_ops&tab=chat&talkAdmin=1"),
    { waitUntil: "domcontentloaded", timeout: 25000 }
  );
  await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });

  const state = await page.evaluate(() => {
    const names = [...document.querySelectorAll(".talk-line-list__name")].map((el) =>
      el.textContent?.trim()
    );
    const ids = [...document.querySelectorAll("[data-talk-thread-id]")].map((el) =>
      el.getAttribute("data-talk-thread-id")
    );
    const userAiInList = names.includes("TASFUL AI");
    return {
      names,
      ids,
      audience: window.TasuTalkData?.getTalkAudience?.(),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      hasSecretary: names.includes("AI秘書") || ids.includes("talk-ops-operations-room"),
      hasOpsWatch: names.includes("OPS WATCH") || ids.includes("talk-hub-ops-watch"),
      hasInquiry: /問い合わせ/.test(names.join(" ")) || ids.includes("talk-hub-ops-inquiry"),
      hasConnect: /Connect/.test(names.join(" ")) || ids.includes("talk-hub-ops-connect"),
      hasPayment: /決済/.test(names.join(" ")) || ids.includes("talk-hub-ops-payment"),
      hasAnpi: /安否/.test(names.join(" ")) || ids.includes("talk-hub-ops-anpi"),
      hasMarketplace: /Marketplace/.test(names.join(" ")) || ids.includes("talk-hub-ops-marketplace"),
      hasUserSupportOnly: names.includes("TASFULサポート") && !names.includes("AI秘書"),
      userAiInList,
    };
  });

  if (state.overflow) fail(area, "horizontal overflow");
  else pass(area, "no horizontal overflow");

  if (state.audience !== "admin_ops") fail(area, `audience=${state.audience}`);
  else pass(area, "audience=admin_ops");

  const required = [
    ["AI秘書", state.hasSecretary],
    ["OPS WATCH", state.hasOpsWatch],
    ["問い合わせ", state.hasInquiry],
    ["Connect", state.hasConnect],
    ["決済", state.hasPayment],
    ["安否", state.hasAnpi],
    ["Marketplace", state.hasMarketplace],
  ];
  for (const [label, ok] of required) {
    if (!ok) fail(area, `${label} room missing`);
    else pass(area, `${label} room visible`);
  }

  if (state.userAiInList) fail(area, "user TASFUL AI leaked into admin list");
  else pass(area, "no user TASFUL AI in admin list");

  await page.screenshot({ path: path.join(OUT, `${vp.id}-admin-talk-list.png`), fullPage: false });
}

async function checkNotifyAudience(page, vp) {
  const area = `notify/${vp.id}`;
  await page.goto(buildLocalPageUrl(base, "talk-home.html", "?tab=chat&talkDev=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuTalkNotifications, { timeout: 10000 });

  const userNotify = await page.evaluate(() => {
    const all = window.TasuTalkNotifications?.getAllForUser?.() || [];
    const opsOnly = all.filter(
      (n) =>
        /ops_watch|admin_ops|AI秘書|Connect監視|決済監視|Marketplace監視/i.test(
          `${n.source || ""} ${n.title || ""} ${n.category || ""}`
        )
    );
    return { count: all.length, opsOnly: opsOnly.length };
  });
  if (userNotify.opsOnly > 0) fail(area, `user TALK has ${userNotify.opsOnly} ops-only notifications`);
  else pass(area, "user TALK excludes ops-only notifications");

  await page.goto(
    buildLocalPageUrl(base, "talk-home.html", "?audience=admin_ops&tab=chat&talkAdmin=1"),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => window.TasuTalkNotifications, { timeout: 10000 });

  const opsNotify = await page.evaluate(() => {
    const ops = window.TasuTalkNotifications?.getAllForOps?.() || [];
    const hasSecretary = ops.some((n) => /秘書|secretary|ops_assistant/i.test(`${n.source} ${n.title}`));
    return { count: ops.length, hasSecretary };
  });
  if (opsNotify.count < 1) fail(area, "admin_ops notifications empty");
  else pass(area, "admin_ops notifications present");
}

async function seedOpsDashboard(page) {
  if (opsDashboardSeeded) return;
  await page.goto(buildLocalPageUrl(base, "support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), OPS_SEED_KEYS);
  await page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuSupportTicketStore.saveTicket({
      id: "dash_open_manual",
      title: "未対応の問い合わせ",
      body: "管理者未対応",
      user_id: "dash_test",
      source: "test",
      category: "admin_review",
      severity: "medium",
      status: "open",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const ticketId = "dash_connect_ticket_001";
    const now = new Date().toISOString();
    window.TasuSupportTicketStore.saveTicket({
      id: ticketId,
      title: "[Connect] 本人確認の追加情報",
      body: "Stripe Connect additional information required.",
      user_id: "dash_test",
      source: "support_intake",
      category: "connect_issue",
      severity: "high",
      status: "needs_review",
      created_at: now,
      updated_at: now,
    });
    window.TasuSupportTicketStore.saveConnectIssue({
      id: "dash_conn_issue_001",
      user_id: "dash_test",
      stripe_account_id: "acct_dash_test",
      stripe_event_type: "account.updated",
      issue_type: "requirements_past_due",
      severity: "high",
      status: "open",
      detected_reason: "Connect verification required.",
      recommended_action: "Review in Stripe Dashboard",
      admin_required: true,
      ticket_id: ticketId,
      created_at: now,
      resolved_at: null,
    });
    localStorage.setItem(
      "tasu_stripe_event_ingest_logs_v1",
      JSON.stringify([{ id: "dash_ingest_001", event_type: "account.updated", at: now }])
    );
  });
  opsDashboardSeeded = true;
}

async function checkOpsDashboard(page, vp) {
  const area = `ops-dash/${vp.id}`;
  await seedOpsDashboard(page);
  await page.goto(buildLocalPageUrl(base, "admin-operations-dashboard.html"), {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminAiActionExecutor?.clearForTests?.();
    window.TasuAdminOperationsDashboard?.refresh?.({ skipConclusion: true });
  });
  await page.waitForSelector("[data-ops-action-card]", { timeout: 15000 });

  const dash = await page.evaluate(() => {
    const zones = [...document.querySelectorAll("[data-ops-action-zone]")].map((z) => z.dataset.opsActionZone);
    const details = document.getElementById("ops-ai-details");
    const historyFold = document.getElementById("ops-ai-action-history-fold");
    const boardText = document.querySelector(".ops-ai-action-board")?.textContent || "";
    const kpiVisible = [...document.querySelectorAll(".ops-ai-kpi-metric__value")].some((el) => {
      const r = el.getBoundingClientRect();
      return r.top < 200 && r.height > 0;
    });
    const l4 = [...document.querySelectorAll("[data-ops-action-card]")].find(
      (c) => Number(c.dataset.opsActionLevel) === 4
    );
    const l5 = [...document.querySelectorAll("[data-ops-action-card]")].find(
      (c) => Number(c.dataset.opsActionLevel) === 5
    );
    return {
      zones,
      detailsClosed: details ? !details.open : true,
      historyPresent: Boolean(historyFold),
      historyClosed: historyFold ? !historyFold.open : true,
      hasUrgent: /今すぐ対応/.test(boardText),
      hasToday: /本日対応/.test(boardText),
      hasAi: /AI提案/.test(boardText),
      hasLatest: /最新情報/.test(boardText),
      hasNormal: /正常状態|Connect正常/.test(boardText),
      kpiTop: kpiVisible,
      l4Present: Boolean(l4),
      l4Blocked: l4 ? !l4.querySelector("[data-ops-action-execute]") : true,
      l5Present: Boolean(l5),
      l5Blocked: l5 ? !l5.querySelector("[data-ops-action-execute]") : true,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  if (dash.overflow) fail(area, "horizontal overflow");
  else pass(area, "no horizontal overflow");

  for (const [label, ok] of [
    ["今すぐ対応", dash.hasUrgent],
    ["本日対応", dash.hasToday],
    ["AI提案", dash.hasAi],
    ["最新情報", dash.hasLatest],
    ["正常状態", dash.hasNormal],
  ]) {
    if (!ok) fail(area, `${label} zone missing`);
    else pass(area, `${label} visible`);
  }

  if (!dash.detailsClosed) fail(area, "KPI details open by default");
  else pass(area, "KPI in collapsed details");

  if (!dash.historyPresent) fail(area, "AI実行履歴 fold missing");
  else pass(area, "AI実行履歴 present");

  if (dash.kpiTop) fail(area, "KPI visible at top");
  else pass(area, "KPI not at top");

  if (!dash.l4Blocked) {
    if (!dash.l4Present) pass(area, "Lv.4 checked in full suite");
    else fail(area, "Lv.4 not blocked");
  } else pass(area, "Lv.4 execution blocked");

  if (!dash.l5Blocked) fail(area, "Lv.5 not blocked");
  else pass(area, "Lv.5 execution blocked");

  await page.screenshot({ path: path.join(OUT, `${vp.id}-ops-dashboard-top.png`), fullPage: false });
}

async function runSmokeChecks() {
  fs.mkdirSync(OUT, { recursive: true });
  base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
  console.log(`Base URL: ${base}\n`);

  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isIgnorableConsoleError(text)) return;
    consoleErrors.push(text);
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== viewport ${vp.id} ===`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    if (vp.isMobile) {
      await page.emulateMedia({ media: "screen" });
    }
    await checkUserTalk(page, vp);
    await checkAdminOpsTalk(page, vp);
    await checkNotifyAudience(page, vp);
    await checkOpsDashboard(page, vp);
  }

    });

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail("console", e));
  } else {
    pass("console", "errors: 0 (UI relevant)");
  }
}

function writeReport() {
  const suiteLines = suiteResults
    .map((s) => `- \`${s.script}\`: ${s.code === 0 ? "PASS" : "FAIL (exit " + s.code + ")"}`)
    .join("\n");
  const failLines = failures.length ? failures.map((f) => `- ${f}`).join("\n") : "- (none)";
  const body = `# TASFUL Regression Final

Date: ${new Date().toISOString()}

## Summary
- Smoke checks: ${passes.filter((p) => !p.startsWith("[suite]")).length} pass / ${failures.filter((f) => !f.startsWith("[suite]")).length} fail
- Suite scripts: ${suiteResults.filter((s) => s.code === 0).length}/${suiteResults.length} PASS

## Suite scripts
${suiteLines || "- (skipped)"}

## Failures
${failLines}

## Screenshots
\`reports/screenshots/tasful-regression-final/\`

## Run
\`\`\`bash
node scripts/test-tasful-regression-final.mjs
\`\`\`
`;
  fs.writeFileSync(REPORT, body, "utf8");
}

async function main() {
  const skipSuites = process.argv.includes("--skip-suites");
  console.log("=== TASFUL Regression Final — smoke ===");
  await runSmokeChecks();

  if (!skipSuites) {
    console.log("\n=== TASFUL Regression Final — suite scripts ===");
    base = base || (await findDevServerBaseUrl({ probePath: "talk-home.html" }));
    for (const script of SUITE_SCRIPTS) {
      console.log(`\n--- ${script} ---`);
      const ok = await runSuite(script);
      if (!ok) fail("suite", `${script} failed`);
      else pass("suite", `${script} PASS`);
    }
  }

  writeReport();
  console.log(`\nReport: ${REPORT}`);
  console.log(`Screenshots: ${OUT}`);
  console.log(`\nSmoke+Suite: ${passes.length} pass / ${failures.length} fail`);

  if (failures.length) {
    console.error("\nFAIL tasful regression final");
    process.exit(1);
  }
  console.log("\nPASS tasful regression final");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
