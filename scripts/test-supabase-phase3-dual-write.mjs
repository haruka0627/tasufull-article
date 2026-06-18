#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * Supabase Phase 3 dual-write PoC E2E
 *   node scripts/test-supabase-phase3-dual-write.mjs
 *   BUILDER_BASE_URL=http://127.0.0.1:8765 node scripts/load-dotenv-run.mjs scripts/test-supabase-phase3-dual-write.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel, qs) {
  const base = process.env.BUILDER_BASE_URL;
  const q = qs ? (qs.startsWith("?") ? qs : `?${qs}`) : "";
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}${q}`;
  return pathToFileURL(path.join(root, rel)).href + q;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function testDualWriteOff(page) {
  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  const enabled = await page.evaluate(() => window.TasuSupabaseOpsWrite?.isEnabled?.());
  if (enabled) fail("dual-write should be off by default");
  const res = await page.evaluate(() =>
    window.TasuSupportTicketService.submitInquiry({
      title: "Phase3 OFF test",
      body: "dual-write disabled regression",
      user_id: "p3_off",
    })
  );
  if (!res?.ticket?.id) fail("submitInquiry without dual-write");
  const mockLen = await page.evaluate(() => window.TasuSupabaseOpsWrite?.getMockCaptureForTests?.()?.length ?? 0);
  if (mockLen > 0) fail("mock capture without enable");
  pass("dual-write OFF — localStorage のみ（既存動作）");
}

async function testMockDualWrite(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabaseDualWrite=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      window.TasuSupabaseOpsWrite &&
      window.TasuSupportTicketStore &&
      window.TasuAiOpsCaseStore &&
      window.TasuBuilderPartnerEval,
    { timeout: 15000 }
  );

  await page.evaluate(() => {
    window.TasuSupabaseOpsWrite.setMockCaptureForTests(true);
    window.TasuSupabaseOpsWrite.clearFailuresForTests();
    window.TasuSupportTicketStore.clearAllForTests();
    window.TasuAiOpsCaseStore?.clearAllForTests?.();
    window.TasuBuilderPartnerEval?.clearAllForTests?.();
  });

  const ticketId = `p3mock_tkt_${Date.now()}`;
  await page.evaluate(
    ({ ticketId }) => {
      const store = window.TasuSupportTicketStore;
      const t = {
        id: ticketId,
        user_id: "p3mock",
        source: "test",
        title: "Mock dual-write ticket",
        body: "connect test body",
        category: "connect_issue",
        severity: "high",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.saveTicket(t);
      store.appendEvent(ticketId, "ticket_created", "mock", {});
      store.saveConnectIssue({
        id: `p3mock_conn_${Date.now()}`,
        user_id: "p3mock",
        issue_type: "test",
        severity: "high",
        status: "open",
        ticket_id: ticketId,
        created_at: new Date().toISOString(),
      });
    },
    { ticketId }
  );

  const aiCase = await page.evaluate(() =>
    window.TasuAiOpsCaseStore.createCaseFromInput({
      title: "Mock AI case",
      body: "chargeback mock",
      source: "test",
      ops_category: "chargeback",
      user_id: "p3mock",
    })
  );

  await page.evaluate(() => {
    const Eval = window.TasuBuilderPartnerEval;
    const names = window.__BUILDER_DEMO_PARTNER_NAMES__ || [];
    const name = names[0]?.display_name || "デモ工務店";
    Eval.addBuilderPartnerEvaluation({
      partner_name: name,
      project_id: `p3mock_proj_${Date.now()}`,
      deadline_delta: 1,
      complaint_delta: 0,
      created_by: "test",
    });
  });

  const capture = await page.evaluate(() => window.TasuSupabaseOpsWrite.getMockCaptureForTests());
  const tables = new Set(capture.map((c) => c.table));
  for (const t of [
    "support_tickets",
    "support_events",
    "connect_issues",
    "ai_ops_cases",
    "ai_ops_events",
    "builder_partner_evaluations",
  ]) {
    if (!tables.has(t)) fail(`mock dual-write missing table ${t}`);
  }
  if (!aiCase?.id) fail("mock ai case");
  pass(`mock dual-write — ${capture.length} upsert(s) across 6 tables`);

  const failures = await page.evaluate(() => window.TasuSupabaseOpsWrite.readFailures().length);
  if (failures > 0) fail(`ops_write_failures ${failures}`);
  pass("mock dual-write — ops_write_failures なし");
}

async function testLiveStagingOptional(page) {
  if (process.env.SKIP_OPS_LIVE_DUAL_WRITE === "1") {
    console.log("SKIP: live staging dual-write (Phase 4 admin RLS applied)");
    return;
  }
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC_KEY || "";
  if (!url || !anon) {
    console.log("SKIP: live staging dual-write (SUPABASE_URL + SUPABASE_ANON_KEY)");
    return;
  }
  if (!process.env.BUILDER_BASE_URL) {
    console.log("SKIP: live staging dual-write (BUILDER_BASE_URL for HTTP)");
    return;
  }

  const qs = "supabaseDualWrite=1&supabaseRead=1";
  await page.goto(pageUrl("support-trouble-center.html", qs), { waitUntil: "domcontentloaded" });
  await page.evaluate((token) => {
    if (token) sessionStorage.setItem("tasu_ops_admin_access_token", token);
  }, process.env.ANPI_RLS_ADMIN_JWT || "");
  await page.waitForFunction(() => window.TasuSupabaseOpsWrite?.canWrite?.(), { timeout: 15000 });

  const ticketId = `p3live_tkt_${Date.now()}`;
  await page.evaluate(
    ({ ticketId }) => {
      window.TasuSupportTicketStore.clearAllForTests();
      window.TasuSupabaseOpsWrite.clearFailuresForTests();
      return window.TasuSupportTicketService.submitInquiry({
        title: "Phase3 live dual-write",
        body: "Stripe Connect verification failed staging test",
        user_id: "p3live",
      });
    },
    { ticketId }
  );

  await page.waitForTimeout(2500);

  const liveId = await page.evaluate(() => {
    const t = window.TasuSupportTicketStore.listTickets()[0];
    return t?.id || null;
  });
  if (!liveId) fail("live ticket not in local store");

  const res = await fetch(`${url}/rest/v1/support_tickets?id=eq.${encodeURIComponent(liveId)}&select=id,title`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  if (!res.ok) fail(`live read ticket HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 1) {
    fail(
      `live dual-write ticket not in Supabase (apply staging-phase3 INSERT RLS?). failures=${JSON.stringify(
        await page.evaluate(() => window.TasuSupabaseOpsWrite.readFailures())
      )}`
    );
  }
  pass(`live staging dual-write → support_tickets (${liveId})`);

  await page.goto(pageUrl("admin-operations-dashboard.html", qs), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => window.TasuAdminOperationsDashboard && window.TasuSupportTicketStore.listTickets().length >= 1,
    { timeout: 20000 }
  );
  pass("live read-through + dual-write — admin-operations-dashboard 表示");
}

async function runPhase2Regression() {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["scripts/test-supabase-phase2-read-poc.mjs"], {
    cwd: root,
    stdio: "pipe",
    shell: true,
    env: { ...process.env, BUILDER_BASE_URL: "" },
  });
  if (r.status !== 0) {
    fail(`Phase 2 regression:\n${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  pass("Phase 2 read PoC 回帰（dual-write 未影響）");
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  
    await testDualWriteOff(page);
    await testMockDualWrite(page);
    await testLiveStagingOptional(page);
    });
  
  await runPhase2Regression();
  console.log("\nAll Supabase Phase 3 dual-write PoC tests passed.");
}

main().catch(() => {
  console.error();
  closeAllBrowsers().finally(() => process.exit(1));
});
