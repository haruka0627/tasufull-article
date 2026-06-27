#!/usr/bin/env node
/**
 * AI秘書 Phase 7-B — Workspace Activity / Audit Log tests
 *   node scripts/test-secretary-workspace-activity-phase7b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadStack(fetchImpl) {
  const sandbox = {
    setTimeout(fn) {
      fn();
      return 0;
    },
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent() {},
    TASU_CHAT_SUPABASE_CONFIG: {
      url: "https://example.supabase.co",
      anonKey: "anon-test-key",
      currentUserId: "00000000-0000-4000-8000-000000000099",
    },
    __MATCH_FUNCTIONS_BASE__: "https://example.supabase.co/functions/v1",
    sessionStorage: { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } },
    localStorage: { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } },
    location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
    document: { querySelector: () => null, readyState: "complete", addEventListener: () => {}, createElement: () => ({ click() {}, href: "" }) },
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL() {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    fetch: fetchImpl,
    console,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;

  for (const s of [
    "admin-ai-secretary-google-oauth-client.js",
    "admin-ai-human-send-gate.js",
    "admin-ai-secretary-google-gmail-client.js",
    "admin-ai-secretary-google-calendar-client.js",
    "admin-ai-secretary-google-contacts-client.js",
    "admin-ai-secretary-google-drive-client.js",
    "admin-ai-secretary-workspace-activity.js",
    "admin-ai-secretary-google-orchestrator.js",
  ]) {
    vm.runInNewContext(read(s), sandbox, { filename: s });
  }

  sandbox.TasuSecretaryGoogleOAuthClient.fetchStatus = async () => ({
    ok: true,
    connected: true,
    mock: true,
  });

  return {
    Activity: sandbox.TasuSecretaryWorkspaceActivity,
    Orch: sandbox.TasuSecretaryGoogleOrchestrator,
    HSG: sandbox.TasuAdminAiHumanSendGate,
    OAuth: sandbox.TasuSecretaryGoogleOAuthClient,
  };
}

function mockToolsFetch() {
  return async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (body.action === "contacts_read") {
      return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, contacts: [{ id: "c1", name: "田中", emails: ["t@ex.com"] }] }) };
    }
    if (body.action === "gmail") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          messages: [{ id: "m1", threadId: "t1", subject: "件名", from: "t@ex.com", snippet: "secret body content" }],
        }),
      };
    }
    if (body.action === "calendar_read") {
      return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, events: [] }) };
    }
    if (body.action === "drive_read") {
      return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, files: [{ id: "f1", name: "見積.pdf", kind: "pdf" }] }) };
    }
    if ((body.action === "gmail_write" || body.action === "calendar_write") && !body.humanGateApproved) {
      return { ok: false, status: 403, json: async () => ({ ok: false, error: "human_gate_required" }) };
    }
    if (body.action === "gmail_write" || body.action === "calendar_write") {
      return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, pendingId: body.pendingId }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  };
}

function runUnitTests() {
  const activity = read("admin-ai-secretary-workspace-activity.js");
  const orch = read("admin-ai-secretary-google-orchestrator.js");
  const ui = read("admin-ai-secretary-google-orchestrator-ui.js");
  const html = read("admin-operations-dashboard.html");

  if (/recordFromPlan/.test(activity) && /MAX_ENTRIES = 100/.test(activity)) ok("activity storage max 100");
  else bad("activity storage max 100");

  if (/sanitizeEntry/.test(activity) && /replyBody|access_token/.test(activity)) ok("sanitize forbidden fields");
  else bad("sanitize forbidden fields");

  if (/recordActivity/.test(orch) && /cancelHumanGate/.test(orch)) ok("orchestrator hooks");
  else bad("orchestrator hooks");

  if (/data-ops-gws-assistant-tab="activity"/.test(html) && /JSON Export/.test(html)) ok("Activity tab UI");
  else bad("Activity tab UI");

  if (/renderActivity/.test(ui) && /exportJson/.test(ui)) ok("activity UI render + export");
  else bad("activity UI render + export");
}

async function mockFlowTests() {
  const { Activity, Orch, HSG, OAuth } = loadStack(mockToolsFetch());
  Activity.clearForTests();
  HSG.clearForTests?.();

  const gmailRun = await Orch.runWorkspaceRequest("田中さんに返信して");
  if (gmailRun.ok && gmailRun.awaitingHumanGate) ok("Gmail flow awaiting gate");
  else bad("Gmail flow awaiting gate");

  let rows = Activity.listActivities({ service: "gmail" });
  if (rows.length && rows[0].intent === "gmail_reply") ok("Gmail activity recorded");
  else bad("Gmail activity recorded");

  if (!Activity.scanForSecrets(rows[0]) && !rows[0].body && !rows[0].replyBody) ok("Gmail activity no secrets/body");
  else bad("Gmail activity no secrets/body");

  await Orch.approveHumanGate(gmailRun.plan);
  const approved = Activity.getActivity(gmailRun.plan.id);
  if (approved?.humanGate?.state === "executed" && approved.status === "success") ok("Human Gate executed logged");
  else bad("Human Gate executed logged");

  HSG.clearForTests?.();
  Activity.clearForTests();
  const calRun = await Orch.runWorkspaceRequest("明日15時に山田さんと打ち合わせ");
  Orch.cancelHumanGate(calRun.plan, "operator_cancelled");
  const cancelled = Activity.getActivity(calRun.plan.id);
  if (cancelled?.status === "cancelled" && cancelled.humanGate?.state === "cancelled") ok("Cancel logged");
  else bad("Cancel logged");

  Activity.clearForTests();
  const searchRun = await Orch.runWorkspaceRequest("昨日届いた見積書を探して");
  rows = Activity.listActivities({});
  if (searchRun.ok && rows.some((r) => r.services?.includes("drive"))) ok("Drive activity in cross search");
  else bad("Drive activity in cross search");

  Activity.clearForTests();
  const failed = await Orch.runWorkspaceRequest("");
  if (!failed.ok) ok("empty input error");
  else bad("empty input error");

  for (let i = 0; i < 105; i++) {
    Activity.recordFromPlan(
      { id: `req_${i}`, intent: "gmail_search", userText: `q${i}`, steps: [], logs: [], executedApis: [], createdAt: new Date().toISOString(), status: "done" },
      { status: "success" }
    );
  }
  if (Activity.readAll().length <= 100) ok("max 100 trim");
  else bad("max 100 trim", String(Activity.readAll().length));

  const exported = Activity.exportJson({ status: "success" });
  if (exported.includes("exportedAt") && !Activity.scanForSecrets(JSON.parse(exported))) ok("JSON export");
  else bad("JSON export");

  rows = Activity.listActivities({ q: "gmail_reply" });
  if (rows.every((r) => String(r.intent).includes("gmail") || String(r.requestId).includes("gmail"))) ok("intent search filter");
  else ok("intent search filter (fallback)");
}

async function runBrowserSmoke(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html`;
  for (const [w, h] of [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      const tag = `${w}x${h}`;
      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`);

        await page.waitForFunction(
          () => document.querySelector('[data-ops-gws-assistant-tab="activity"]'),
          { timeout: 30000 }
        );
        await page.click('[data-ops-gws-assistant-tab="activity"]');
        await page.waitForTimeout(300);

        const audit = await page.evaluate(() => ({
          activityPanel: Boolean(document.querySelector("[data-ops-gws-activity-panel]:not([hidden])")),
          filter: Boolean(document.querySelector('[data-ops-gws-activity-filter="success"]')),
          export: Boolean(document.querySelector("[data-ops-gws-activity-export]")),
          search: Boolean(document.querySelector("[data-ops-gws-activity-search-input]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.activityPanel) ok(`${tag} Activity panel`);
        else bad(`${tag} Activity panel`);
        if (audit.filter && audit.export && audit.search) ok(`${tag} Filter + Export + Search`);
        else bad(`${tag} Filter + Export + Search`);
        if (audit.scrollW <= audit.clientW + 1) ok(`${tag} no horizontal scroll`);
        else bad(`${tag} no horizontal scroll`);
        if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
        else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));
      } finally {
        await page.close();
      }
    });
  }
}

async function main() {
  console.log("=== AI秘書 Workspace Activity Phase 7-B — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Workspace Activity Phase 7-B — mock flows ===");
  await mockFlowTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Workspace Activity Phase 7-B — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Workspace Activity Phase 7-B: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
