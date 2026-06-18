#!/usr/bin/env node
/**
 * Supabase Phase 6 — primary source PoC E2E
 *   node scripts/load-dotenv-run.mjs scripts/test-supabase-phase6-primary-source.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = Date.now().toString(36).slice(-8);

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function pageUrl(rel, qs) {
  const base = process.env.BUILDER_BASE_URL;
  const q = qs ? (qs.startsWith("?") ? qs : `?${qs}`) : "";
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}${q}`;
  return pathToFileURL(path.join(ROOT, rel)).href + q;
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = /^\s*([^#=]+)=(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1].trim()]) process.env[m[1].trim()] = v;
    }
  }
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || "";
  const adminJwt = process.env.ANPI_RLS_ADMIN_JWT || "";
  if (!url || !anon) return null;
  return { url, anon, adminJwt };
}

async function injectAdminToken(page, jwt) {
  if (!jwt) return;
  await page.addInitScript((token) => {
    try {
      sessionStorage.setItem("tasu_ops_admin_access_token", token);
    } catch {
      /* ignore */
    }
  }, jwt);
}

async function testPrimaryOffRegression(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupabaseOpsRead, { timeout: 15000 });
  const st = await page.evaluate(() => ({
    primary: window.TasuSupabaseOpsPrimaryConfig?.isPrimarySource?.(),
    read: window.TasuSupabaseOpsRead?.isEnabled?.(),
    remote: window.TasuSupabaseOpsRead?.isRemoteReadActive?.(),
  }));
  if (st.primary) fail("supabasePrimary should be off by default");
  if (st.read || st.remote) fail("read-through should be off by default");
  pass("supabasePrimary OFF — 既存動作（フラグデフォルト）");
}

async function testReadPocLocalWins(page) {
  await page.goto(pageUrl("support-trouble-center.html", "supabaseRead=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsRead?.mergeList, { timeout: 15000 });
  const winner = await page.evaluate(() => {
    window.TasuSupabaseOpsRead.clearCache();
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: "p6_read_local",
          title: "remote",
          updated_at: "2026-01-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          status: "open",
        },
      ],
    });
    const local = [
      {
        id: "p6_read_local",
        title: "local-newer",
        updated_at: "2026-06-04T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        status: "open",
      },
    ];
    const merged = window.TasuSupabaseOpsRead.mergeList(local, "support_tickets");
    return merged[0]?.title;
  });
  if (winner !== "local-newer") fail(`read-through merge expected local newer, got ${winner}`);
  pass("supabaseRead ON（primary OFF）— local 新しい方が優先");
}

async function testPrimaryOnRemoteWins(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabasePrimary=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsPrimaryConfig, { timeout: 15000 });

  const result = await page.evaluate(() => {
    window.TasuSupabaseOpsPrimaryCache?.clearForTests?.();
    window.TasuSupabaseOpsRead.clearCache();
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: "p6_primary_ticket",
          user_id: "u",
          title: "from-supabase",
          body: "b",
          category: "connect_issue",
          severity: "high",
          status: "open",
          created_at: "2026-06-04T10:00:00Z",
          updated_at: "2026-06-04T12:00:00Z",
        },
      ],
      ai_ops_cases: [],
      builder_partner_evaluations: [],
    });
    return window.TasuSupabaseOpsRead.prefetch(["support_tickets", "ai_ops_cases"]).then(() => {
      const local = [
        {
          id: "p6_primary_ticket",
          title: "stale-local",
          updated_at: "2026-06-04T13:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          status: "open",
        },
      ];
      const merged = window.TasuSupabaseOpsRead.mergeList(local, "support_tickets");
      const meta = window.TasuSupabaseOpsPrimaryCache.getStatus().meta;
      const cached = window.TasuSupabaseOpsPrimaryCache.readTableCache("support_tickets");
      return {
        title: merged[0]?.title,
        dataSource: window.TasuSupabaseOpsPrimaryCache.getDataSource(),
        synced: meta?.tables?.support_tickets?.lastSyncedAt,
        cacheLen: cached.length,
        primary: window.TasuSupabaseOpsPrimaryConfig.isPrimarySource(),
      };
    });
  });

  if (!result.primary) fail("primary flag should be on");
  if (result.title !== "from-supabase") fail(`primary merge expected remote, got ${result.title}`);
  if (result.dataSource !== "supabase") fail(`dataSource expected supabase, got ${result.dataSource}`);
  if (!result.synced) fail("cache meta lastSyncedAt missing");
  if (result.cacheLen < 1) fail("localStorage cache not synced from remote");
  pass("supabasePrimary ON — Supabase 優先 + localStorage キャッシュ同期");
}

async function testFetchFailureFallback(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabasePrimary=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsPrimaryCache, { timeout: 15000 });

  const fb = await page.evaluate(() => {
    window.TasuSupabaseOpsPrimaryCache.clearForTests();
    window.TasuSupabaseOpsRead.clearCache();
    localStorage.setItem(
      "tasu_support_tickets_v1",
      JSON.stringify([
        {
          id: "p6_fallback_ticket",
          title: "cached-only",
          status: "open",
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        },
      ])
    );
    window.TasuSupabaseOpsRead.simulateFetchFailureForTests(true);
    const merged = window.TasuSupabaseOpsRead.mergeList([], "support_tickets");
    return {
      title: merged[0]?.title,
      dataSource: window.TasuSupabaseOpsPrimaryCache.getDataSource(),
    };
  });

  if (fb.title !== "cached-only") fail(`fallback expected cached-only, got ${fb.title}`);
  if (fb.dataSource !== "cache") fail(`fallback dataSource expected cache, got ${fb.dataSource}`);
  pass("Supabase 失敗想定 — localStorage cache fallback");
}

async function testDualWriteCacheRefresh(page) {
  await page.goto(
    pageUrl("admin-operations-dashboard.html", "supabasePrimary=1&supabaseDualWrite=1"),
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => window.TasuSupabaseOpsWrite, { timeout: 15000 });

  const ticketId = `p6_dw_${RUN}`;
  const ok = await page.evaluate(async ({ ticketId }) => {
    window.TasuSupabaseOpsWrite.setMockCaptureForTests(true);
    window.TasuSupabaseOpsRead.clearCache();
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: ticketId,
          user_id: "p6",
          title: "after-write",
          body: "x",
          category: "admin_review",
          severity: "medium",
          status: "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    await window.TasuSupabaseOpsRead.prefetch(["support_tickets"]);
    const cached = window.TasuSupabaseOpsPrimaryCache.readTableCache("support_tickets");
    return cached.some((t) => t.id === ticketId && t.title === "after-write");
  }, { ticketId });

  if (!ok) fail("dual-write prefetch did not refresh primary cache");
  pass("dual-write ON + primary — 更新後 cache 同期（mock prefetch）");
}

async function testDashboardAndTalk(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabasePrimary=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuAdminOperationsDashboard, { timeout: 15000 });

  await page.evaluate(() => {
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: "p6_dash_t1",
          title: "Dash",
          severity: "critical",
          status: "open",
          category: "connect_issue",
          created_at: "2026-06-04T12:00:00Z",
          updated_at: "2026-06-04T12:00:00Z",
        },
      ],
      ai_ops_cases: [
        {
          id: "p6_dash_c1",
          title: "Case",
          ops_category: "chargeback",
          ai_risk: "critical",
          status: "needs_review",
          created_at: "2026-06-04T12:00:00Z",
          updated_at: "2026-06-04T12:00:00Z",
        },
      ],
      builder_partner_evaluations: [],
    });
    return window.TasuSupabaseOpsRead.prefetch([
      "support_tickets",
      "ai_ops_cases",
      "builder_partner_evaluations",
    ]);
  });

  const metrics = await page.evaluate(() => window.TasuAdminOperationsDashboard.buildMetrics());
  const remoteTickets = await page.evaluate(() =>
    window.TasuSupabaseOpsRead.getCached("support_tickets").length
  );
  const storeTickets = await page.evaluate(() => window.TasuSupportTicketStore.listTickets().length);
  if (remoteTickets !== storeTickets) {
    fail(`dashboard ticket count mismatch remote=${remoteTickets} store=${storeTickets}`);
  }
  if (metrics.openCount < 1) fail(`dashboard metrics ${JSON.stringify(metrics)}`);
  pass("dashboard — remote / store 件数一致");

  await page.addScriptTag({ path: path.join(ROOT, "talk-ops-assistant.js") });
  await page.waitForFunction(() => window.TasuTalkOpsAssistant?.getRoomMessages, { timeout: 15000 });

  const talkOk = await page.evaluate(() => {
    const msgId = "p6_talk_msg";
    window.TasuSupabaseOpsRead.clearCache();
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      talk_ops_messages: [
        {
          id: msgId,
          room_id: "talk-ops-operations-room",
          sender_id: "ops",
          sender_name: "運営",
          text: "phase6-talk",
          kind: "text",
          created_at: "2026-06-04T12:00:00Z",
        },
      ],
    });
    return window.TasuSupabaseOpsRead.prefetch(["talk_ops_messages"]).then(() => {
      const msgs = window.TasuTalkOpsAssistant?.getRoomMessages?.() || [];
      return msgs.some((m) => m.id === msgId && m.text === "phase6-talk");
    });
  });
  if (!talkOk) fail("talk ops messages mismatch with primary remote");
  pass("talk ops — メッセージ一致（primary mock）");
}

async function testDataSourceBadge(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabasePrimary=1"), {
    waitUntil: "domcontentloaded",
  });
  const badgeOk = await page.evaluate(async () => {
    window.TasuSupabaseOpsRead.setMockRemoteForTests({
      support_tickets: [
        {
          id: "b1",
          title: "t",
          status: "open",
          updated_at: "2026-06-04T12:00:00Z",
          created_at: "2026-06-04T12:00:00Z",
        },
      ],
    });
    await window.TasuSupabaseOpsRead.prefetch(["support_tickets"]);
    window.TasuSupabaseOpsPrimaryCache.setDataSource("supabase");
    const host = document.querySelector("[data-ops-dash-load-status]");
    window.TasuSupabaseOpsDataSourceUi.renderBadge(host);
    const el = host?.querySelector("[data-tasu-ops-data-source]");
    return el?.getAttribute("data-tasu-ops-data-source") === "supabase";
  });
  if (!badgeOk) fail("Data Source badge not rendered");
  pass("Data Source 開発表示（Supabase）");
}

async function testLivePrimaryOptional(cfg, page) {
  if (process.env.SKIP_OPS_LIVE_READ === "1" || !cfg?.adminJwt) {
    console.log("SKIP: live primary read (SKIP_OPS_LIVE_READ or no admin JWT)");
    return;
  }
  await injectAdminToken(page, cfg.adminJwt);
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabasePrimary=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsRead?.canQuery?.(), { timeout: 15000 });
  const pr = await page.evaluate(() =>
    window.TasuSupabaseOpsRead.prefetch(window.TasuSupabaseOpsRead.OPS_TABLE_KEYS)
  );
  if (!pr?.ok) fail(`live primary prefetch: ${JSON.stringify(pr)}`);
  pass("live staging — primary prefetch with admin JWT");
}

async function runPhase5Regression() {
  if (process.env.SKIP_PHASE5_REGRESSION === "1") {
    console.log("SKIP: Phase 5 regression (SKIP_PHASE5_REGRESSION=1)");
    return;
  }
  const r = spawnSync(
    "node",
    ["scripts/load-dotenv-run.mjs", "scripts/test-supabase-phase5-update-dual-write.mjs"],
    {
      cwd: ROOT,
      stdio: "pipe",
      shell: true,
      timeout: 300000,
      env: {
        ...process.env,
        BUILDER_BASE_URL: "",
        SKIP_OPS_LIVE_READ: "1",
        SKIP_OPS_LIVE_DUAL_WRITE: "1",
      },
    }
  );
  if (r.status !== 0) {
    fail(`Phase 5 regression:\n${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  pass("Phase 5 回帰");
}

async function main() {
  loadEnv();
  const cfg = loadEnv();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await testPrimaryOffRegression(page);
    await testReadPocLocalWins(page);
    await testPrimaryOnRemoteWins(page);
    await testFetchFailureFallback(page);
    await testDualWriteCacheRefresh(page);
    await testDashboardAndTalk(page);
    await testDataSourceBadge(page);
    if (cfg) await testLivePrimaryOptional(cfg, page);
  } finally {
    await browser.close();
  }
  await runPhase5Regression();
  console.log("\nAll Supabase Phase 6 primary source tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
