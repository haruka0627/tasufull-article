#!/usr/bin/env node
/**
 * AI秘書 Phase 7-A — Google Workspace Orchestrator tests
 *   node scripts/test-secretary-google-orchestrator-phase7a.mjs
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

function loadStack(fetchImpl, oauthStatus) {
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
    sessionStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.get(k) ?? null;
      },
      setItem(k, v) {
        this._m.set(k, v);
      },
    },
    localStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.get(k) ?? null;
      },
      setItem(k, v) {
        this._m.set(k, v);
      },
    },
    location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
    document: { querySelector: () => null, readyState: "complete", addEventListener: () => {} },
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
    "admin-ai-secretary-google-orchestrator.js",
  ]) {
    vm.runInNewContext(read(s), sandbox, { filename: s });
  }

  const OAuth = sandbox.TasuSecretaryGoogleOAuthClient;
  OAuth.fetchStatus = async () =>
    oauthStatus || { ok: true, connected: true, mock: true, googleAccountEmail: "ops@example.com" };

  return {
    OAuth,
    Orch: sandbox.TasuSecretaryGoogleOrchestrator,
    HSG: sandbox.TasuAdminAiHumanSendGate,
  };
}

function mockToolsFetch() {
  return async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};

    if (body.action === "contacts_read") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          contacts: [{ id: "people/c1", name: "田中 太郎", emails: ["tanaka@example.com"], phones: [], company: "Ex", notes: "" }],
        }),
      };
    }
    if (body.action === "gmail") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          messages: [{ id: "msg1", threadId: "th1", subject: "見積書送付", from: "tanaka@example.com", snippet: "見積書を添付しました" }],
        }),
      };
    }
    if (body.action === "calendar_read") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mock: true, events: [{ id: "evt1", title: "既存MTG" }] }),
      };
    }
    if (body.action === "drive_read") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          files: [{ id: "f1", name: "見積書.pdf", mimeType: "application/pdf", isFolder: false, kind: "pdf", modifiedTime: new Date().toISOString(), size: 1000, parents: ["root"] }],
        }),
      };
    }
    if (body.action === "gmail_write" && !body.humanGateApproved) {
      return { ok: false, status: 403, json: async () => ({ ok: false, error: "human_gate_required" }) };
    }
    if (body.action === "calendar_write" && !body.humanGateApproved) {
      return { ok: false, status: 403, json: async () => ({ ok: false, error: "human_gate_required" }) };
    }
    if (body.action === "gmail_write" || body.action === "calendar_write") {
      return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, pendingId: body.pendingId }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  };
}

function runUnitTests() {
  const orch = read("admin-ai-secretary-google-orchestrator.js");
  const ui = read("admin-ai-secretary-google-orchestrator-ui.js");
  const html = read("admin-operations-dashboard.html");

  if (/parseIntent/.test(orch) && /buildPlan/.test(orch) && /runWorkspaceRequest/.test(orch)) ok("orchestrator core API");
  else bad("orchestrator core API");

  if (/approveHumanGate/.test(orch) && /sanitizeRun/.test(orch)) ok("human gate + sanitize");
  else bad("human gate + sanitize");

  if (/gmail_reply/.test(orch) && /calendar_create/.test(orch) && /gmail_drive_search/.test(orch)) ok("intent coverage");
  else bad("intent coverage");

  if (/Workspace Assistant/.test(html) && /data-ops-google-workspace-assistant-plan/.test(html)) ok("dashboard Workspace Assistant");
  else bad("dashboard Workspace Assistant");

  if (/renderPlan/.test(ui) && /Human Gate 承認/.test(ui)) ok("UI plan + gate");
  else bad("UI plan + gate");

  if (!/access_token\s*[:=]|refresh_token\s*[:=]|client_secret\s*[:=]/.test(orch)) ok("orchestrator no secret literals");
  else bad("orchestrator no secret literals");
}

async function mockFlowTests() {
  const { Orch, HSG, OAuth } = loadStack(mockToolsFetch());
  HSG.clearForTests?.();

  const replyIntent = await Orch.parseIntent("田中さんに返信して");
  if (replyIntent.intent === "gmail_reply") ok("intent gmail_reply");
  else bad("intent gmail_reply", replyIntent.intent);

  const replyRun = await Orch.runWorkspaceRequest("田中さんに返信して");
  if (replyRun.ok && replyRun.awaitingHumanGate && replyRun.plan?.humanGatePendingId) ok("Gmail→返信 Human Gate");
  else bad("Gmail→返信 Human Gate");

  const approved = await Orch.approveHumanGate(replyRun.plan);
  if (approved.ok && approved.plan?.status === "done") ok("Gmail approve after gate");
  else bad("Gmail approve after gate", approved.plan?.status);

  HSG.clearForTests?.();
  const calRun = await Orch.runWorkspaceRequest("明日15時に山田さんと打ち合わせ");
  if (calRun.ok && calRun.awaitingHumanGate) ok("Contacts→Calendar Human Gate");
  else bad("Contacts→Calendar Human Gate");

  const calApproved = await Orch.approveHumanGate(calRun.plan);
  if (calApproved.ok) ok("Calendar approve after gate");
  else bad("Calendar approve after gate");

  const searchRun = await Orch.runWorkspaceRequest("昨日届いた見積書を探して");
  if (searchRun.ok && searchRun.plan?.status === "done") ok("Gmail→Drive search flow");
  else bad("Gmail→Drive search flow", searchRun.plan?.status);

  const stored = Orch.loadLastRun();
  if (stored?.logs?.length && !OAuth.scanForSecrets(stored)) ok("log stored no secrets");
  else bad("log stored no secrets");

  const { Orch: OrchOff } = loadStack(mockToolsFetch(), { ok: true, connected: false, mock: false });
  const disconnected = await OrchOff.runWorkspaceRequest("田中さんに返信して");
  if (!disconnected.ok && disconnected.error === "not_connected") ok("OAuth disconnected blocked");
  else bad("OAuth disconnected blocked", disconnected.error);
}

async function runBrowserSmoke(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html`;
  const VIEWPORTS = [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      const tag = `${w}x${h}`;
      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`, String(resp?.status()));

        await page.waitForFunction(
          () => window.TasuSecretaryGoogleOrchestratorUI && document.querySelector("[data-ops-google-workspace-assistant-input]"),
          { timeout: 30000 }
        );

        const audit = await page.evaluate(() => ({
          assistant: Boolean(document.querySelector("[data-ops-google-workspace-assistant]")),
          planHost: Boolean(document.querySelector("[data-ops-google-workspace-assistant-plan]")),
          approveHidden: document.querySelector("[data-ops-google-workspace-assistant-approve]")?.hidden !== false,
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.assistant) ok(`${tag} Workspace Assistant`);
        else bad(`${tag} Workspace Assistant`);
        if (audit.planHost) ok(`${tag} Plan host`);
        else bad(`${tag} Plan host`);
        if (audit.approveHidden) ok(`${tag} Human Gate approve hidden initially`);
        else bad(`${tag} Human Gate approve hidden initially`);
        if (audit.scrollW <= audit.clientW + 1) ok(`${tag} no horizontal scroll`);
        else bad(`${tag} no horizontal scroll`, `${audit.scrollW}>${audit.clientW}`);
        if (jsErrors.length === 0) ok(`${tag} console JS errors 0`);
        else bad(`${tag} console JS errors 0`, jsErrors.join(" | "));
      } finally {
        await page.close();
      }
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Orchestrator Phase 7-A — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Google Orchestrator Phase 7-A — mock flows ===");
  await mockFlowTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Orchestrator Phase 7-A — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Google Orchestrator Phase 7-A: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
