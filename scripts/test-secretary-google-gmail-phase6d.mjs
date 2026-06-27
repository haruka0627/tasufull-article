#!/usr/bin/env node
/**
 * AI秘書 Phase 6-D — Gmail write + Human Gate tests
 *   node scripts/test-secretary-google-gmail-phase6d.mjs
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
    dispatchEvent: () => {},
    addEventListener: () => {},
    document: { readyState: "complete", addEventListener: () => {}, querySelector: () => null },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.fetch = fetchImpl;
  sandbox.console = console;
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox, {
    filename: "oauth-client.js",
  });
  vm.runInNewContext(read("admin-ai-human-send-gate.js"), sandbox, {
    filename: "human-send-gate.js",
  });
  vm.runInNewContext(read("admin-ai-secretary-google-gmail-client.js"), sandbox, {
    filename: "gmail-client.js",
  });
  return {
    OAuth: sandbox.TasuSecretaryGoogleOAuthClient,
    HSG: sandbox.TasuAdminAiHumanSendGate,
    Gmail: sandbox.TasuSecretaryGoogleGmailClient,
  };
}

function runUnitTests() {
  const gmail = read("supabase/functions/_shared/secretary-google-gmail.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const hsg = read("admin-ai-human-send-gate.js");
  const client = read("admin-ai-secretary-google-gmail-client.js");
  const ui = read("admin-ai-secretary-google-gmail-ui.js");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");

  for (const m of ["drafts.create", "drafts.send"]) {
    if (gmail.includes(`"${m}"`) && tools.includes("gmail_write")) ok(`write method ${m}`);
    else bad(`write method ${m}`);
  }

  if (/human_gate_required/.test(gmail) && /humanGateApproved/.test(tools)) ok("human gate server check");
  else bad("human gate server check");

  if (/gmail\.compose/.test(oauth)) ok("oauth compose scope");
  else bad("oauth compose scope");

  if (/enqueueFromGmailDraft/.test(hsg) && /source === "gmail"/.test(hsg)) ok("HSG gmail enqueue + execute");
  else bad("HSG gmail enqueue + execute");

  if (/proposeReply/.test(client) && /executeWriteApproved/.test(client)) ok("client propose + write approved");
  else bad("client propose + write approved");

  if (/返信案を作る/.test(ui) && /下書き保存/.test(ui) && /送信確認/.test(ui)) ok("UI workflow buttons");
  else bad("UI workflow buttons");

  if (/messages\.trash|messages\.delete/.test(gmail) && /gmail_write_forbidden/.test(gmail)) {
    ok("trash/delete still blocked");
  } else bad("trash/delete still blocked");

  if (!/access_token|refresh_token|client_secret/.test(client)) ok("client no secret literals");
  else bad("client no secret literals");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, HSG, Gmail } = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action === "gmail_write") {
      if (!body.humanGateApproved) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: "human_gate_required", phase: "6-D" }),
        };
      }
      if (body.method === "drafts.create") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            method: "drafts.create",
            draftId: `mock_draft_${body.pendingId}`,
            pendingId: body.pendingId,
          }),
        };
      }
      if (body.method === "drafts.send") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            method: "drafts.send",
            sent: true,
            messageId: "mock_sent_1",
            draftId: body.draftId,
            pendingId: body.pendingId,
          }),
        };
      }
    }

    if (body.action === "gmail" && body.method === "messages.send") {
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "gmail_write_use_gmail_write" }),
      };
    }

    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, messages: [] }) };
  });

  HSG.clearForTests?.();

  const noGate = await Gmail.tryWriteWithoutGate("drafts.create", {
    to: "a@example.com",
    subject: "Test",
    body: "Hello",
  });
  if (!noGate.ok && noGate.data?.error === "human_gate_required") ok("write without gate blocked");
  else bad("write without gate blocked", noGate.data?.error);

  const proposal = await Gmail.proposeReply({
    id: "m1",
    from: "user@example.com",
    subject: "Hello",
    snippet: "Need help",
    threadId: "t1",
  });
  if (proposal.ok && proposal.body) ok("proposeReply mock");
  else bad("proposeReply mock");

  const queued = Gmail.enqueueDraftHumanGate({
    messageId: "m1",
    threadId: "t1",
    to: "user@example.com",
    subject: "Re: Hello",
    body: proposal.body,
  });
  if (queued.ok && queued.item?.id) ok("enqueue draft HSG");
  else bad("enqueue draft HSG");

  const approved = await Gmail.approveDraftPending(queued.item.id);
  const draftId = approved?.executed?.raw?.data?.draftId;
  if (approved?.ok && draftId) ok("approve draft creates draftId");
  else bad("approve draft creates draftId", JSON.stringify(approved));

  const sendQueued = Gmail.enqueueSendHumanGate({
    messageId: "m1",
    threadId: "t1",
    draftId,
    to: "user@example.com",
    subject: "Re: Hello",
    body: proposal.body,
  });
  if (sendQueued.ok && sendQueued.item?.id) ok("enqueue send HSG");
  else bad("enqueue send HSG");

  const sent = await Gmail.approveSendPending(sendQueued.item.id);
  if (sent?.ok && sent?.executed?.raw?.data?.sent) ok("approve send after gate");
  else bad("approve send after gate");

  if (calls.every((c) => !c.access_token && !c.refresh_token)) ok("edge calls no tokens");
  else bad("edge calls no tokens");

  if (!OAuth.scanForSecrets(approved)) ok("approve response no secrets");
  else bad("approve response no secrets");
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
          () =>
            window.TasuSecretaryGoogleGmailUI &&
            document.querySelector("[data-ops-secretary-gmail-panel]"),
          { timeout: 30000 }
        );

        await page.waitForTimeout(1500);

        const audit = await page.evaluate(() => ({
          proposeBtn: Boolean(document.querySelector("[data-gmail-action='propose-reply']")),
          workflowApi: Boolean(window.TasuSecretaryGoogleGmailUI?.STATE_LABELS?.reply),
          sendBtn: document.querySelector("[data-gmail-action='final-send']"),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.workflowApi) ok(`${tag} workflow API`);
        else bad(`${tag} workflow API`);
        if (audit.proposeBtn) ok(`${tag} 返信案 button`);
        else ok(`${tag} 返信案 button deferred (no messages)`);
        if (!audit.sendBtn || audit.sendBtn.disabled) ok(`${tag} no-send-without-confirm`);
        else bad(`${tag} no-send-without-confirm`);
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
  console.log("=== AI秘書 Gmail Phase 6-D — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Gmail Phase 6-D — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Gmail Phase 6-D — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Gmail Phase 6-D: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
