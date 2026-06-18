#!/usr/bin/env node
/**
 * AI運営司令塔 — PC fullwide + 可読性
 *   node scripts/test-admin-ops-dashboard-fullwide.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "admin-ops-dashboard-fullwide");

const VIEWPORTS = [
  { id: "390", width: 390, height: 844, pc: false },
  { id: "430", width: 430, height: 932, pc: false },
  { id: "768", width: 768, height: 1024, pc: false },
  { id: "1280", width: 1280, height: 800, pc: true },
  { id: "1440", width: 1440, height: 900, pc: true },
  { id: "1600", width: 1600, height: 900, pc: true },
  { id: "1920", width: 1920, height: 1080, pc: true },
];

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_cases_v1",
  "tasu_stripe_event_ingest_logs_v1",
  "tasu_ai_action_executed_v1",
  "tasu_ai_action_audit_log_v1",
];

const failures = [];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(root, rel)).href;
}

function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /CORS|ERR_FAILED|supabase\.co|Failed to load resource/i.test(t);
}

function px(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
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
  await page.waitForSelector("[data-ops-action-card]", { timeout: 15000 });
}

async function checkViewport(page, vp) {
  const metrics = await page.evaluate(() => {
    const main = document.querySelector(".ops-ai-main");
    const mainRect = main?.getBoundingClientRect();
    const sidebar = document.querySelector(".ops-ai-sidebar");
    const sidebarRect = sidebar?.getBoundingClientRect();
    const mainStyle = main ? getComputedStyle(main) : null;
    const card = document.querySelector("[data-ops-action-card]");
    const cardStyle = card ? getComputedStyle(card) : null;
    const step = document.querySelector(".ops-ai-action-card__step");
    const stepStyle = step ? getComputedStyle(step) : null;
    const zoneTitle = document.querySelector(".ops-ai-action-zone__title:not(.ops-ai-action-zone__title--sr)");
    const zoneTitleStyle = zoneTitle ? getComputedStyle(zoneTitle) : null;
    const btn = document.querySelector("[data-ops-action-execute], .ops-ai-action-card__btn");
    const btnStyle = btn ? getComputedStyle(btn) : null;
    const level = document.querySelector(".ops-ai-action-card__level");
    const levelStyle = level ? getComputedStyle(level) : null;
    const summary = document.querySelector("[data-ops-action-summary]");
    const summaryStyle = summary ? getComputedStyle(summary) : null;
    const urgentZone = document.querySelector('[data-ops-action-zone="urgent"]');
    const todayZone = document.querySelector('[data-ops-action-zone="today"]');
    const urgentRect = urgentZone?.getBoundingClientRect();
    const todayRect = todayZone?.getBoundingClientRect();
    const chips = [...document.querySelectorAll("[data-ops-action-summary-jump]")].map((el) => ({
      zone: el.getAttribute("data-ops-action-summary-jump"),
      text: el.textContent?.trim() || "",
    }));
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      vw: window.innerWidth,
      mainMaxWidth: mainStyle?.maxWidth || "",
      mainWidth: mainRect?.width ?? 0,
      sidebarWidth: sidebarRect?.width ?? 0,
      mainRightGap: mainRect ? window.innerWidth - mainRect.right : 999,
      cardPaddingTop: cardStyle?.paddingTop || "",
      cardPaddingLeft: cardStyle?.paddingLeft || "",
      stepFont: stepStyle?.fontSize || "",
      zoneTitleFont: zoneTitleStyle?.fontSize || "",
      btnFont: btnStyle?.fontSize || "",
      levelFont: levelStyle?.fontSize || "",
      summaryDisplay: summaryStyle?.display || "",
      chipCount: chips.length,
      chips,
      columnMinWidth: urgentRect && todayRect ? Math.min(urgentRect.width, todayRect.width) : 0,
      hasExec: Boolean(document.querySelector("[data-ops-action-execute]")),
      detailsClosed: !document.getElementById("ops-ai-details")?.open,
    };
  });

  if (metrics.overflow) fail(`${vp.id} horizontal overflow`);
  else pass(`${vp.id} no horizontal overflow`);

  const stepPx = px(metrics.stepFont);
  const zoneTitlePx = px(metrics.zoneTitleFont);
  const cardPadPx = px(metrics.cardPaddingTop);
  const btnPx = px(metrics.btnFont);
  const levelPx = px(metrics.levelFont);

  if (vp.pc) {
    const expectedMain = metrics.vw - metrics.sidebarWidth;
    const widthRatio = metrics.mainWidth / expectedMain;
    if (metrics.mainMaxWidth !== "none" && px(metrics.mainMaxWidth) > 0) {
      fail(`${vp.id} main max-width should be none, got ${metrics.mainMaxWidth}`);
    } else pass(`${vp.id} main max-width none (fullwide)`);

    if (metrics.mainRightGap > 24) {
      fail(`${vp.id} right gap too large (${Math.round(metrics.mainRightGap)}px)`);
    } else pass(`${vp.id} right gap minimal (${Math.round(metrics.mainRightGap)}px)`);

    if (widthRatio < 0.92) {
      fail(`${vp.id} main width ratio ${widthRatio.toFixed(2)} (expected ≥0.92)`);
    } else pass(`${vp.id} main uses viewport (${Math.round(metrics.mainWidth)}px / ${Math.round(expectedMain)}px)`);

    if (stepPx < 14.5) fail(`${vp.id} card body font ${metrics.stepFont} (expected ≥15px)`);
    else pass(`${vp.id} card body readable (${metrics.stepFont})`);

    if (zoneTitlePx < 17) fail(`${vp.id} zone title font ${metrics.zoneTitleFont} (expected ≥17px)`);
    else pass(`${vp.id} zone title readable (${metrics.zoneTitleFont})`);

    if (cardPadPx < 16) fail(`${vp.id} card padding ${metrics.cardPaddingTop} (expected ≥18px)`);
    else pass(`${vp.id} card padding generous (${metrics.cardPaddingTop})`);

    if (btnPx < 14) fail(`${vp.id} button font ${metrics.btnFont} (expected ≥14px)`);
    else pass(`${vp.id} button readable (${metrics.btnFont})`);

    if (levelPx > 0 && levelPx < 11.5) fail(`${vp.id} actionLevel badge ${metrics.levelFont}`);
    else if (levelPx > 0) pass(`${vp.id} actionLevel badge (${metrics.levelFont})`);

    if (metrics.columnMinWidth < 280) {
      fail(`${vp.id} grid column too narrow (${Math.round(metrics.columnMinWidth)}px)`);
    } else pass(`${vp.id} 2-col grid width OK (${Math.round(metrics.columnMinWidth)}px min col)`);

    if (metrics.summaryDisplay === "none") fail(`${vp.id} summary strip hidden on PC`);
    else pass(`${vp.id} summary strip visible`);

    if (metrics.chipCount !== 4) fail(`${vp.id} summary chips ${metrics.chipCount}`);
    else pass(`${vp.id} summary 4 chips`);

    if (vp.id === "1280") {
      await page.click('[data-ops-action-summary-jump="urgent"]');
      await page.waitForTimeout(400);
      const jumped = await page.evaluate(() => {
        const h = document.getElementById("ops-action-urgent-heading");
        const r = h?.getBoundingClientRect();
        return r ? r.top >= -8 && r.top < window.innerHeight * 0.45 : false;
      });
      if (!jumped) fail(`${vp.id} summary jump to 今すぐ failed`);
      else pass(`${vp.id} summary chip scrolls to zone`);
    }
  } else {
    if (stepPx > 13.5) fail(`${vp.id} mobile card body changed (${metrics.stepFont})`);
    else pass(`${vp.id} mobile card body unchanged (${metrics.stepFont})`);

    if (cardPadPx > 14) fail(`${vp.id} mobile card padding changed (${metrics.cardPaddingTop})`);
    else pass(`${vp.id} mobile card padding unchanged (${metrics.cardPaddingTop})`);

    if (metrics.summaryDisplay !== "none") fail(`${vp.id} summary should stay hidden on SP/tablet`);
    else pass(`${vp.id} summary hidden (SP layout unchanged)`);
  }

  if (!metrics.hasExec) fail(`${vp.id} executable card missing`);
  else pass(`${vp.id} one-button exec intact`);

  if (!metrics.detailsClosed) fail(`${vp.id} KPI details open by default`);
  else pass(`${vp.id} KPI fold closed`);

  await page.screenshot({ path: path.join(OUT, `${vp.id}-top.png`), fullPage: false });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let consoleErrors = [];
await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.id} ===`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seed(page);
    await checkViewport(page, vp);
  }

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail(`console: ${e}`));
  } else {
    pass("console errors: 0 (UI relevant)");
  }

    });
  console.log(`\nScreenshots: ${OUT}`);
  if (failures.length) {
    console.error(`\nFAIL (${failures.length})`);
    process.exit(1);
  }
  console.log("\nPASS admin ops dashboard fullwide");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

await closeAllBrowsers();
