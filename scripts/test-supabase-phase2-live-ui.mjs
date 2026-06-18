#!/usr/bin/env node
/**
 * Phase 2 live staging UI（HTTP 必須: file:// では canQuerySupabase=false）
 *   BUILDER_BASE_URL=http://127.0.0.1:8765 node scripts/test-supabase-phase2-live-ui.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const base = (process.env.BUILDER_BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function waitHydrated(page, timeout = 20000) {
  await page.waitForFunction(
    () =>
      window.TasuSupabaseOpsRead?.isEnabled?.() &&
      (window.TasuSupportTicketStore?.listTickets?.() || []).some(
        (t) => t.id === "poc_staging_ticket_001"
      ),
    { timeout }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${base}/admin-operations-dashboard.html?supabaseRead=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitHydrated(page);
    const metrics = await page.evaluate(() => window.TasuAdminOperationsDashboard.buildMetrics());
    const hasStagingTicket = metrics?.tickets?.some((t) => t.id === "poc_staging_ticket_001");
    const hasStagingCase = metrics?.cases?.some(
      (c) =>
        c.id === "poc_staging_case_001" || c.support_ticket_id === "poc_staging_ticket_001"
    );
    if (!hasStagingTicket || !hasStagingCase) {
      fail(`dashboard live merge missing seed rows: ${JSON.stringify(metrics)}`);
    }
    if ((metrics?.highCriticalCount || 0) < 1 && (metrics?.needsReviewCount || 0) < 1) {
      fail(`dashboard counts after live merge: ${JSON.stringify(metrics)}`);
    }
    pass(
      `admin-operations-dashboard live merge (needsReview=${metrics.needsReviewCount}, highCritical=${metrics.highCriticalCount})`
    );

    await page.goto(`${base}/talk-ops-room.html?supabaseRead=1`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-talk-ops-root]", { timeout: 15000 });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-ops-card]").length >= 1,
      { timeout: 20000 }
    );
    const cards = await page.locator("[data-talk-ops-card]").count();
    const hasStaging = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      return /Staging|Connect|poc_staging|チャージバック/i.test(text);
    });
    if (cards < 1) fail(`talk-ops-room cards ${cards}`);
    if (!hasStaging) fail("talk-ops-room missing staging/ops content in UI");
    pass(`talk-ops-room live UI (${cards} cards)`);
  } finally {
    await browser.close();
  }

  console.log("\nLive staging UI checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
