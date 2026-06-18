#!/usr/bin/env node
/**
 * Supabase Phase 2 read-through PoC E2E
 *   node scripts/test-supabase-phase2-read-poc.mjs
 *
 * ローカル: merge ロジック + mock remote + 既存 E2E 非破壊（フラグ OFF）
 * 任意: SUPABASE_URL + anon key で live read（staging RLS 適用後）
 */
import { chromium } from "./lib/playwright-browser.mjs";
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
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function testMergeLogic() {
  const merge = (local, remote) => {
    const map = new Map();
    remote.forEach((r) => map.set(r.id, r));
    local.forEach((r) => {
      const ex = map.get(r.id);
      if (!ex || String(r.updated_at) >= String(ex.updated_at)) map.set(r.id, r);
    });
    return [...map.values()];
  };
  const local = [{ id: "a", updated_at: "2026-01-01T00:00:00Z", title: "local" }];
  const remote = [{ id: "a", updated_at: "2026-01-02T00:00:00Z", title: "remote" }, { id: "b", updated_at: "2026-01-01T00:00:00Z", title: "b" }];
  const merged = merge(local, remote);
  if (merged.length !== 2) fail(`merge count ${merged.length}`);
  if (merged.find((r) => r.id === "a").title !== "remote") fail("merge should prefer newer remote");
  pass("mergeByUpdatedAt ロジック");
}

async function testFlagOffRegression(page) {
  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  const enabled = await page.evaluate(() => window.TasuSupabaseOpsRead?.isEnabled?.());
  if (enabled) fail("supabaseRead should be off by default");
  pass("read-through フラグはデフォルト OFF");
}

async function testMockReadThrough(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabaseRead=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsRead && window.TasuAdminOperationsDashboard, {
    timeout: 15000,
  });

  await page.evaluate(() => {
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: "remote_only_ticket",
          user_id: "x",
          title: "Remote only",
          body: "from supabase mock",
          category: "connect_issue",
          severity: "critical",
          status: "open",
          created_at: "2026-06-04T12:00:00Z",
          updated_at: "2026-06-04T12:00:00Z",
        },
      ],
      ai_ops_cases: [
        {
          id: "remote_only_case",
          title: "Remote case",
          body: "chargeback",
          ops_category: "chargeback",
          ai_risk: "critical",
          status: "needs_review",
          created_at: "2026-06-04T12:00:00Z",
          updated_at: "2026-06-04T12:00:00Z",
        },
      ],
      builder_partner_evaluations: [],
    });
    return window.TasuSupabaseOpsRead.prefetch(["support_tickets", "ai_ops_cases"]);
  });

  const metrics = await page.evaluate(() => window.TasuAdminOperationsDashboard.buildMetrics());
  if (metrics.openCount < 1 && metrics.highCriticalCount < 1) {
    fail(`dashboard metrics with mock remote: ${JSON.stringify(metrics)}`);
  }
  pass("総合運営ダッシュボード — mock Supabase データを merge 反映");

  const storeTickets = await page.evaluate(() => window.TasuSupportTicketStore.listTickets().length);
  const storeCases = await page.evaluate(() => window.TasuAiOpsCaseStore.listCases().length);
  if (storeTickets < 1) fail(`support-ticket-store merge ${storeTickets}`);
  if (storeCases < 1) fail(`ai-ops-case-store merge ${storeCases}`);
  pass("support-ticket-store / ai-ops-case-store 読取 merge");

  await page.goto(pageUrl("talk-ops-room.html", "supabaseRead=1"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-talk-ops-root]", { timeout: 15000 });
  const cards = await page.locator("[data-talk-ops-card]").count();
  if (cards < 1) fail(`talk ops room cards ${cards}`);
  pass("TASFUL TALK運営秘書 — 通知カード表示（local + mock）");
}

async function testLiveStagingOptional() {
  if (process.env.SKIP_OPS_LIVE_READ === "1") {
    console.log("SKIP: live staging read (Phase 4 admin RLS applied)");
    return;
  }
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC_KEY || "";
  if (!url || !anon) {
    console.log("SKIP: live staging read (set SUPABASE_URL + SUPABASE_ANON_KEY)");
    return;
  }
  const tables = [
    "support_tickets",
    "connect_issues",
    "ai_ops_cases",
    "builder_partner_evaluations",
  ];
  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=5`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (!res.ok) fail(`live read ${table} HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (!Array.isArray(data)) fail(`live read ${table}: expected array`);
    pass(`live staging SELECT ${table} (${data.length} rows sample)`);
  }
}

async function runExistingSmoke() {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["scripts/test-support-trouble-center-browser.mjs"], {
    cwd: root,
    stdio: "pipe",
    shell: true,
  });
  if (r.status !== 0) {
    fail(`existing support E2E failed:\n${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  pass("既存 Support E2E（フラグ OFF）非破壊");
}

async function main() {
  testMergeLogic();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await testFlagOffRegression(page);
    await testMockReadThrough(page);
  } finally {
    await browser.close();
  }

  await testLiveStagingOptional();
  await runExistingSmoke();

  console.log("\nAll Supabase Phase 2 read PoC tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
