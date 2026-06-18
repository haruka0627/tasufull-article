#!/usr/bin/env node
/**
 * AI運営司令塔 UI最終確認
 *   node scripts/test-admin-ops-dashboard-ui-final.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "admin-ops-dashboard-ui-final");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "430", width: 430, height: 932 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 800 },
  { id: "1440", width: 1440, height: 900 },
];

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_cases_v1",
  "tasu_stripe_event_ingest_logs_v1",
  "tasu_ai_action_executed_v1",
  "tasu_ai_action_audit_log_v1",
];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(root, rel)).href;
}

const failures = [];

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return (
    /CORS|ERR_FAILED|serper-search|gemini-chat|supabase\.co|Failed to load resource/i.test(t)
  );
}

function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

async function seed(page) {
  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

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

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminAiActionExecutor?.clearForTests?.();
    window.TasuAdminOperationsDashboard?.refresh?.({ skipConclusion: true });
  });
  await page.waitForSelector("[data-ops-action-card]", { timeout: 10000 });
}

async function checkViewport(page, vp) {
  const metrics = await page.evaluate(() => {
    const board = document.querySelector("[data-ops-action-board]");
    const details = document.getElementById("ops-ai-details");
    const zones = [...document.querySelectorAll("[data-ops-action-zone]")].map((z) => z.dataset.opsActionZone);
    const historyFold = document.getElementById("ops-ai-action-history-fold");
    const normalFold = document.querySelector("[data-ops-action-normal-fold]");
    const firstCard = document.querySelector("[data-ops-action-card]");
    const cardText = firstCard?.innerText || "";
    const boardTop = board?.getBoundingClientRect().top ?? 9999;
    const kpiVisible = [...document.querySelectorAll(".ops-ai-kpi-metric__value")].some((el) => {
      const r = el.getBoundingClientRect();
      return r.top < boardTop + 80 && r.height > 0 && getComputedStyle(el).display !== "none";
    });
    const execBtn = document.querySelector("[data-ops-action-execute]");
    const l4 = [...document.querySelectorAll("[data-ops-action-card]")].find(
      (c) => Number(c.dataset.opsActionLevel) === 4
    );
    const l5 = [...document.querySelectorAll("[data-ops-action-card]")].find(
      (c) => Number(c.dataset.opsActionLevel) === 5
    );
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      zones,
      hasFlow:
        /何が起きたか/.test(cardText) &&
        /影響/.test(cardText) &&
        /AI判断/.test(cardText) &&
        /推奨行動/.test(cardText),
      kpiDominant: kpiVisible,
      detailsClosed: details ? !details.open : true,
      hasExec: Boolean(execBtn),
      l4Blocked: l4 ? /本番連携前のため確認のみ/.test(l4.textContent || "") && !l4.querySelector("[data-ops-action-execute]") : false,
      l5Blocked: l5 ? /本番連携前のため確認のみ/.test(l5.textContent || "") && !l5.querySelector("[data-ops-action-execute]") : false,
      hasLead: /優先順:/.test(document.querySelector(".ops-ai-action-board__lead")?.textContent || ""),
      historyClosed: historyFold ? !historyFold.open : true,
      normalSummary: document.querySelector("[data-ops-action-normal-summary]")?.textContent || "",
      hasPrimaryRow: Boolean(document.querySelector(".ops-ai-action-board__row--primary")),
      hasSecondaryRow: Boolean(document.querySelector(".ops-ai-action-board__row--secondary")),
    };
  });

  if (metrics.overflow) fail(`${vp.id} horizontal overflow`);
  else pass(`${vp.id} no horizontal overflow`);

  const zoneOrder = ["urgent", "today", "ai", "latest", "normal"];
  if (JSON.stringify(metrics.zones) !== JSON.stringify(zoneOrder)) {
    fail(`${vp.id} zone order: ${metrics.zones.join(",")}`);
  } else pass(`${vp.id} zone priority order OK`);

  if (!metrics.hasFlow) fail(`${vp.id} action card flow labels missing`);
  else pass(`${vp.id} card flow readable`);

  if (metrics.kpiDominant) fail(`${vp.id} KPI visible above action board`);
  else pass(`${vp.id} top focus is action board (not KPI)`);

  if (!metrics.detailsClosed) fail(`${vp.id} details fold open by default`);
  else pass(`${vp.id} details fold closed initially`);

  if (!metrics.hasExec) fail(`${vp.id} no executable Lv.1-3 card`);
  else pass(`${vp.id} Lv.1-3 exec button present`);

  if (!metrics.l4Blocked) fail(`${vp.id} Lv.4 blocked unclear`);
  else pass(`${vp.id} Lv.4 execution blocked clear`);

  if (!metrics.l5Blocked) fail(`${vp.id} Lv.5 blocked unclear`);
  else pass(`${vp.id} Lv.5 execution blocked clear`);

  if (!metrics.hasLead) fail(`${vp.id} priority lead missing`);
  else pass(`${vp.id} priority lead visible`);

  if (!metrics.hasPrimaryRow || !metrics.hasSecondaryRow) fail(`${vp.id} 2-row action layout missing`);
  else pass(`${vp.id} 2-row layout (urgent|today / ai|latest)`);

  if (!metrics.historyClosed) fail(`${vp.id} history fold open by default`);
  else pass(`${vp.id} history fold closed initially`);

  if (!/Connect|決済|安否/.test(metrics.normalSummary)) fail(`${vp.id} normal one-line summary missing`);
  else pass(`${vp.id} normal status one-line summary`);

  await page.screenshot({ path: path.join(OUT, `${vp.id}-top.png`), fullPage: false });

  if (vp.id === "390") {
    await page.evaluate(() => {
      document.querySelector('[data-ops-action-card][data-ops-action-level="4"] [data-ops-action-preflight-detail]')?.click();
    });
    await page.waitForSelector("[data-ops-action-modal]:not([hidden])", { timeout: 5000 });
    const modalText = await page.locator("[data-ops-action-modal-body]").innerText();
    if (!/本番連携前チェックリスト/.test(modalText)) fail(`${vp.id} preflight checklist missing`);
    else pass(`${vp.id} preflight checklist readable`);
    if (await page.locator("[data-ops-action-modal-run]").isVisible()) fail(`${vp.id} preflight shows run button`);
    else pass(`${vp.id} preflight modal no exec button`);
    await page.screenshot({ path: path.join(OUT, `${vp.id}-preflight-lv4.png`), fullPage: false });
    await page.locator("[data-ops-action-modal-cancel]").click();
    await page.waitForFunction(() => document.querySelector("[data-ops-action-modal]")?.hidden === true);

    await page.evaluate(() => {
      document.querySelector("[data-ops-action-execute]")?.click();
    });
    await page.waitForSelector("[data-ops-action-modal]:not([hidden])", { timeout: 5000 });
    await page.screenshot({ path: path.join(OUT, `${vp.id}-exec-modal.png`), fullPage: false });
    await page.locator("[data-ops-action-modal-cancel]").click();
    await page.waitForFunction(() => document.querySelector("[data-ops-action-modal]")?.hidden === true);

    await page.evaluate(() => {
      const h = document.getElementById("ops-ai-action-history-fold");
      if (h) h.open = true;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, `${vp.id}-history-fold.png`), fullPage: false });
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let consoleErrors = [];
await withPlaywrightBrowser(async (browser) => {
  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.id} ===`);
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (isIgnorableConsoleError(text)) return;
      consoleErrors.push(`[${vp.id}] ${text}`);
    });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seed(page);
    await checkViewport(page, vp);
    await page.close();
  }

  if (consoleErrors.filter((e) => !isIgnorableConsoleError(e)).length) {
    consoleErrors.filter((e) => !isIgnorableConsoleError(e)).forEach((e) => fail(`console: ${e}`));
  } else {
    pass("console errors: 0 (UI relevant)");
  }

  console.log(`\nScreenshots: ${OUT}`);
  if (failures.length) {
    console.error(`\nFAIL (${failures.length})`);
    process.exit(1);
  }
  console.log("\nPASS admin ops dashboard UI final QA");
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
