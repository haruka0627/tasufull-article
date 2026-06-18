#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * Supabase Phase 5 — update dual-write + TALK ops sync（Staging + admin JWT）
 *   node scripts/load-dotenv-run.mjs scripts/test-supabase-phase5-update-dual-write.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = Date.now().toString(36).slice(-8);

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
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
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const adminJwt = process.env.ANPI_RLS_ADMIN_JWT || "";
  const userJwt = process.env.ANPI_RLS_USER_A_JWT || "";
  if (!url || !anon) return null;
  return { url, anon, service, adminJwt, userJwt };
}

async function rest(cfg, table, opts = {}) {
  const { method = "GET", jwt, query = "", body, prefer } = opts;
  const headers = {
    apikey: cfg.anon,
    Authorization: `Bearer ${jwt || cfg.anon}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

function pageUrl(rel, qs) {
  const base = process.env.BUILDER_BASE_URL;
  const q = qs ? (qs.startsWith("?") ? qs : `?${qs}`) : "";
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}${q}`;
  return pathToFileURL(path.join(ROOT, rel)).href + q;
}

async function testMockUpdateDualWrite(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html", "supabaseDualWrite=1"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.TasuSupabaseOpsWrite, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuSupabaseOpsWrite.setMockCaptureForTests(true);
    window.TasuSupabaseOpsWrite.clearFailuresForTests();
    window.TasuSupportTicketStore.clearAllForTests();
    window.TasuAiOpsCaseStore.clearAllForTests();
  });

  const ticketId = `p5mock_tkt_${RUN}`;
  await page.evaluate(
    ({ ticketId }) => {
      const t = window.TasuSupportTicketStore.saveTicket({
        id: ticketId,
        user_id: "p5",
        source: "test",
        title: "Phase5 mock",
        body: "body",
        category: "admin_review",
        severity: "medium",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      window.TasuSupportTicketStore.saveTicket({
        ...t,
        status: "needs_review",
        admin_note: "mock note",
        resolved_at: new Date().toISOString(),
      });
      const c = window.TasuAiOpsCaseStore.createCaseFromInput({
        title: "P5 case",
        body: "x",
        source: "test",
        user_id: "p5",
      });
      window.TasuAiOpsCaseStore.applyAdminAction(c.id, "resolved", "done");
      window.TasuSupportAdminNotify.notifyAdminImportantTicket({
        id: ticketId,
        category: "admin_review",
        severity: "high",
        title: "notify",
      });
      const n = window.TasuSupportAdminNotify.readNotifications()[0];
      window.TasuSupportAdminNotify.markNotificationsReadForTicket(ticketId);
      return { ticketId, caseId: c.id, notifyId: n?.id };
    },
    { ticketId }
  );

  const capture = await page.evaluate(() => window.TasuSupabaseOpsWrite.getMockCaptureForTests());
  const ops = capture.map((c) => `${c.op || "upsert"}:${c.table}`);
  const need = [
    "support_tickets",
    "ai_ops_cases",
    "support_admin_notifications",
  ];
  for (const t of need) {
    if (!ops.some((o) => o.includes(t))) fail(`mock missing writes for ${t}`);
  }
  const updates = capture.filter((c) => c.op === "update");
  if (updates.length < 2) fail(`mock update count ${updates.length}`);
  pass(`mock update dual-write (${updates.length} updates, ${capture.length} total ops)`);
}

async function testLiveUpdateDualWrite(cfg) {
  if (!cfg.adminJwt || !cfg.userJwt) {
    console.log("SKIP: live Phase 5 (ANPI_RLS_ADMIN_JWT + USER_A)");
    return;
  }

  const now = new Date().toISOString();
  const ticketId = `p5live_tkt_${RUN}`;
  const caseId = `p5live_case_${RUN}`;
  const notifyId = `p5live_notify_${RUN}`;
  const talkId = `p5live_talk_${RUN}`;
  const partnerId = `p5live_partner_${RUN}`;
  const visStatus = "hidden";

  const insTicket = await rest(cfg, "support_tickets", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: ticketId,
      user_id: "p5live",
      title: "P5 live ticket",
      body: "live body",
      category: "admin_review",
      severity: "high",
      status: "open",
      source: "phase5_test",
      created_at: now,
      updated_at: now,
    },
    prefer: "return=representation",
  });
  if (!insTicket.ok) fail(`admin insert ticket ${insTicket.status}`);

  await rest(cfg, "support_tickets", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(ticketId)}`,
    body: { status: "needs_review", admin_note: "phase5 note" },
  });
  await rest(cfg, "support_tickets", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(ticketId)}`,
    body: { resolved_at: now, status: "resolved" },
  });
  const tRow = await rest(cfg, "support_tickets", {
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(ticketId)}&select=status,admin_note,resolved_at`,
  });
  const t = Array.isArray(tRow.data) ? tRow.data[0] : null;
  if (!t || t.status !== "resolved" || !t.admin_note) fail(`ticket update not reflected: ${JSON.stringify(t)}`);
  pass("Support ticket status / admin_note / resolved_at → Supabase");

  await rest(cfg, "support_tickets", {
    method: "PATCH",
    jwt: cfg.userJwt,
    query: `?id=eq.${encodeURIComponent(ticketId)}`,
    body: { status: "open" },
  });
  const afterUser = await rest(cfg, "support_tickets", {
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(ticketId)}&select=status`,
  });
  const afterStatus = Array.isArray(afterUser.data) ? afterUser.data[0]?.status : null;
  if (afterStatus !== "resolved") {
    fail(`general user PATCH changed ticket status to ${afterStatus}`);
  }
  pass("authenticated 一般会員 UPDATE → deny（status 不変）");

  await rest(cfg, "ai_ops_cases", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: caseId,
      title: "P5 case",
      body: "c",
      status: "needs_review",
      source: "phase5_test",
      created_at: now,
      updated_at: now,
    },
    prefer: "return=representation",
  });
  await rest(cfg, "ai_ops_cases", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(caseId)}`,
    body: { status: "resolved", admin_note: "ops done", resolved_at: now },
  });
  const cRow = await rest(cfg, "ai_ops_cases", {
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(caseId)}&select=status,admin_note,resolved_at`,
  });
  const c = Array.isArray(cRow.data) ? cRow.data[0] : null;
  if (!c || c.status !== "resolved") fail(`case update: ${JSON.stringify(c)}`);
  pass("AI運営 case status / admin_note / resolved_at → Supabase");

  await rest(cfg, "support_admin_notifications", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: notifyId,
      ticket_id: ticketId,
      category: "admin_review",
      severity: "high",
      title: "n",
      read: false,
      created_at: now,
    },
    prefer: "return=representation",
  });
  await rest(cfg, "support_admin_notifications", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(notifyId)}`,
    body: { read: true },
  });
  const nRow = await rest(cfg, "support_admin_notifications", {
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(notifyId)}&select=read`,
  });
  if (!Array.isArray(nRow.data) || !nRow.data[0]?.read) fail("support notification read not set");
  pass("Support admin notification read → Supabase");

  await rest(cfg, "builder_partner_visibility", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: { partner_id: partnerId, partner_status: visStatus, updated_at: now },
    prefer: "resolution=merge-duplicates",
  });
  const vRow = await rest(cfg, "builder_partner_visibility", {
    jwt: cfg.adminJwt,
    query: `?partner_id=eq.${encodeURIComponent(partnerId)}&select=partner_status`,
  });
  if (!Array.isArray(vRow.data) || vRow.data[0]?.partner_status !== visStatus) {
    fail(`visibility: ${JSON.stringify(vRow.data)}`);
  }
  pass("Builder partner visibility hidden → Supabase");

  const statId = `p5live_stat_${RUN}`;
  await rest(cfg, "builder_partner_status_events", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: statId,
      partner_id: partnerId,
      partner_name: "P5 Partner",
      partner_status: visStatus,
      action: "hidden",
      reason: "test",
      created_by: "phase5",
      created_at: now,
    },
    prefer: "return=representation",
  });
  pass("Builder status event insert → Supabase");

  await rest(cfg, "talk_ops_messages", {
    method: "POST",
    jwt: cfg.adminJwt,
    body: {
      id: talkId,
      room_id: "talk-ops-operations-room",
      sender_id: "__ops_assistant__",
      sender_name: "AI運営秘書",
      kind: "ops_summary",
      text: "summary",
      ops_summary: "P5 summary text",
      notification_synced: false,
      summary_generated: false,
      created_at: now,
    },
    prefer: "return=representation",
  });
  await rest(cfg, "talk_ops_messages", {
    method: "PATCH",
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(talkId)}`,
    body: {
      read_at: now,
      notification_synced: true,
      summary_generated: true,
    },
  });
  const talkRow = await rest(cfg, "talk_ops_messages", {
    jwt: cfg.adminJwt,
    query: `?id=eq.${encodeURIComponent(talkId)}&select=read_at,notification_synced,summary_generated`,
  });
  const talk = Array.isArray(talkRow.data) ? talkRow.data[0] : null;
  if (!talk?.read_at || !talk.notification_synced || !talk.summary_generated) {
    fail(`talk_ops_messages flags: ${JSON.stringify(talk)}`);
  }
  pass("TALK ops message + read_at / synced / summary_generated → Supabase");

  if (cfg.service) {
    await rest(
      { ...cfg, anon: cfg.service },
      "support_tickets",
      { method: "DELETE", jwt: cfg.service, query: `?id=eq.${ticketId}` }
    );
    await rest(
      { ...cfg, anon: cfg.service },
      "ai_ops_cases",
      { method: "DELETE", jwt: cfg.service, query: `?id=eq.${caseId}` }
    );
    await rest(
      { ...cfg, anon: cfg.service },
      "support_admin_notifications",
      { method: "DELETE", jwt: cfg.service, query: `?id=eq.${notifyId}` }
    );
    await rest(
      { ...cfg, anon: cfg.service },
      "builder_partner_visibility",
      { method: "DELETE", jwt: cfg.service, query: `?partner_id=eq.${partnerId}` }
    );
    await rest(
      { ...cfg, anon: cfg.service },
      "builder_partner_status_events",
      { method: "DELETE", jwt: cfg.service, query: `?id=eq.${statId}` }
    );
    await rest(
      { ...cfg, anon: cfg.service },
      "talk_ops_messages",
      { method: "DELETE", jwt: cfg.service, query: `?id=eq.${talkId}` }
    );
  }
}

async function testDualWriteOff(page) {
  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  const enabled = await page.evaluate(() => window.TasuSupabaseOpsWrite?.isEnabled?.());
  if (enabled) fail("dual-write off expected");
  await page.evaluate(() => window.TasuSupportTicketStore.clearAllForTests());
  const res = await page.evaluate(() =>
    window.TasuSupportTicketService.submitInquiry({
      title: "P5 off",
      body: "local only",
      user_id: "p5off",
    })
  );
  if (!res?.ticket?.id) fail("submit without dual-write");
  const cap = await page.evaluate(() => window.TasuSupabaseOpsWrite?.getMockCaptureForTests?.() || []);
  if (cap.length) fail("mock capture when off");
  pass("dual-write OFF → localStorage のみ");
}

async function testLiveUiFlow(cfg) {
  if (!cfg?.adminJwt || !process.env.BUILDER_BASE_URL) {
    console.log("SKIP: Phase 5 UI flow (BUILDER_BASE_URL + admin JWT)");
    return;
  }
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const qs = "supabaseRead=1&supabaseDualWrite=1";
  
    await page.goto(pageUrl("support-trouble-center.html", qs), {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate((token) => {
      sessionStorage.setItem("tasu_ops_admin_access_token", token);
      window.TasuSupportTicketStore.clearAllForTests();
      window.TasuSupabaseOpsWrite.clearFailuresForTests();
    }, cfg.adminJwt);

    const ticket = await page.evaluate(() =>
      window.TasuSupportTicketService.submitInquiry({
        title: "P5 UI flow ticket",
        body: "Connect verification staging",
        user_id: "p5ui",
      })
    );
    const ticketId = ticket?.ticket?.id;
    if (!ticketId) fail("UI submit ticket");

    await page.waitForTimeout(2000);

    await page.evaluate(
      ({ ticketId }) => {
        window.TasuSupportTicketService.applyAdminAction(ticketId, "resolved", "ui resolved");
      },
      { ticketId }
    );
    await page.waitForTimeout(2500);

    const remote = await rest(cfg, "support_tickets", {
      jwt: cfg.adminJwt,
      query: `?id=eq.${encodeURIComponent(ticketId)}&select=status,admin_note`,
    });
    const row = Array.isArray(remote.data) ? remote.data[0] : null;
    if (!row || row.status !== "resolved") fail(`UI flow remote ticket ${JSON.stringify(row)}`);
    pass("UI: support-trouble-center update → Supabase");

    await page.goto(pageUrl("talk-ops-room.html", qs), { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => {
      sessionStorage.setItem("tasu_ops_admin_access_token", token);
    }, cfg.adminJwt);
    await page.waitForSelector("[data-talk-ops-root]", { timeout: 15000 });
    await page.waitForTimeout(2000);
    const talkCount = await rest(cfg, "talk_ops_messages", {
      jwt: cfg.adminJwt,
      query: "?select=id&room_id=eq.talk-ops-operations-room&limit=5&order=created_at.desc",
    });
    if (!Array.isArray(talkCount.data) || talkCount.data.length < 1) {
      fail("UI talk-ops-room — no talk_ops_messages in Supabase");
    }
    pass("UI: talk-ops-room → talk_ops_messages synced");

    if (cfg.service && ticketId) {
      await rest(
        { ...cfg, anon: cfg.service },
        "support_tickets",
        { method: "DELETE", jwt: cfg.service, query: `?id=eq.${ticketId}` }
      );
    }
});
  
}

async function runPhase4Regression() {
  const r = spawnSync("node", ["scripts/test-supabase-phase4-rls-admin.mjs"], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    env: {
      ...process.env,
      BUILDER_BASE_URL: "",
      SKIP_OPS_LIVE_READ: "1",
      SKIP_OPS_LIVE_DUAL_WRITE: "1",
    },
  });
  if (r.status !== 0) {
    fail(`Phase 4 regression:\n${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  pass("Phase 4 RLS テスト回帰");
}

async function main() {
  const cfg = loadEnv();
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  
    await testDualWriteOff(page);
    await testMockUpdateDualWrite(page);
    });
  

  if (cfg) await testLiveUpdateDualWrite(cfg);
  await testLiveUiFlow(cfg);
  await runPhase4Regression();

  console.log("\nAll Supabase Phase 5 update dual-write tests passed.");
}

main().catch(() => {
  console.error();
  closeAllBrowsers().finally(() => process.exit(1));
});
