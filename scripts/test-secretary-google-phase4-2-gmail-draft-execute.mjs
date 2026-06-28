#!/usr/bin/env node
/**
 * AI秘書 — Google Integration Phase 4-2 (Gmail draft approve → drafts.create)
 *   node scripts/test-secretary-google-phase4-2-gmail-draft-execute.mjs
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

const SECRET_RE =
  /refresh_token|access_token|client_secret|code_verifier|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const INTERNAL_MSG_ID = "phase42_internal_msg_001";

function loadStack(fetchImpl) {
  const sessionStorage = {
    _m: new Map(),
    getItem(k) {
      return this._m.get(k) ?? null;
    },
    setItem(k, v) {
      this._m.set(k, v);
    },
    removeItem(k) {
      this._m.delete(k);
    },
  };
  const localStorage = {
    _m: new Map(),
    getItem(k) {
      return this._m.get(k) ?? null;
    },
    setItem(k, v) {
      this._m.set(k, v);
    },
    removeItem(k) {
      this._m.delete(k);
    },
  };

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
    sessionStorage,
    localStorage,
    location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
    dispatchEvent: () => {},
    addEventListener: () => {},
    document: { readyState: "complete", addEventListener: () => {}, querySelector: () => null },
    console,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.fetch = fetchImpl;

  vm.runInNewContext(read("admin-ai-secretary-human-gate.js"), sandbox);
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox);
  vm.runInNewContext(read("admin-ai-human-send-gate.js"), sandbox);
  vm.runInNewContext(read("admin-ai-secretary-google-gmail-client.js"), sandbox);
  vm.runInNewContext(read("admin-ai-secretary-google-chat-context.js"), sandbox);
  vm.runInNewContext(read("admin-ai-secretary-google-chat-write-bridge.js"), sandbox);

  return {
    Ctx: sandbox.TasuSecretaryGoogleChatContext,
    Bridge: sandbox.TasuSecretaryGoogleChatWriteBridge,
    HSG: sandbox.TasuAdminAiHumanSendGate,
    Gmail: sandbox.TasuSecretaryGoogleGmailClient,
  };
}

function mockGmailWriteFetch(calls) {
  return async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action === "gmail_write") {
      if (!body.humanGateApproved) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: "human_gate_required" }),
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
      if (body.method === "drafts.send" || body.method === "messages.send") {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: "send_blocked_phase42" }),
        };
      }
    }

    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  };
}

function runUnitTests() {
  const hsgSrc = read("admin-ai-human-send-gate.js");
  const bridgeSrc = read("admin-ai-secretary-google-chat-write-bridge.js");
  const ctxSrc = read("admin-ai-secretary-google-chat-context.js");
  const gmailSrc = read("admin-ai-secretary-google-gmail-client.js");

  if (/notifyChatGateHook|handleGateExecutionResult/.test(hsgSrc) && /chatOrigin/.test(hsgSrc)) {
    ok("HSG chat gate hook");
  } else bad("HSG chat gate hook");

  if (/handleGateExecutionResult|handleGateRejected/.test(bridgeSrc)) ok("bridge execute result handlers");
  else bad("bridge execute result handlers");

  if (!/\bexecuteWriteApproved\b/.test(bridgeSrc)) ok("bridge no executeWriteApproved");
  else bad("bridge no executeWriteApproved");

  if (/saveDraftExecuteResult|getDraftResultPreview/.test(ctxSrc)) ok("context draft execute result");
  else bad("context draft execute result");

  if (/executeWriteApproved/.test(gmailSrc) && /chatOrigin/.test(gmailSrc)) ok("gmail client execute + chatOrigin");
  else bad("gmail client execute + chatOrigin");

  if (/Chat 由来の送信は Phase 4-2/.test(hsgSrc)) ok("chat send blocked in HSG");
  else bad("chat send blocked in HSG");
}

async function runFlowTests() {
  const calls = [];
  const { Ctx, Bridge, HSG, Gmail } = loadStack(mockGmailWriteFetch(calls));
  HSG.clearForTests?.();

  Ctx.saveGmailFocus(
    {
      id: INTERNAL_MSG_ID,
      threadId: "phase42_thread_001",
      subject: "Phase42 Test",
      from: "sender@example.com",
      snippet: "hello",
      bodyText: "Body for phase42",
    },
    { index: 1 }
  );
  Ctx.saveLastTurn({
    sourceIntent: "context_reply_draft",
    userText: "返信案作って",
    assistantText: "【返信案 · 未送信】\n確認いたします。\n\n※ read-only",
    kind: "gmail",
  });

  const enq = Bridge.enqueueGmailDraftFromChat("下書き保存して");
  if (enq.ok && enq.enqueued) ok("enqueue chat draft");
  else bad("enqueue chat draft", enq.error || enq.reply?.slice(0, 60));

  const pendingBefore = HSG.readPendingQueue?.() || [];
  if (pendingBefore.length === 1 && pendingBefore[0]?.payload?.chatOrigin) ok("pending chatOrigin tagged");
  else bad("pending chatOrigin tagged");

  if (Ctx.hasPendingGate?.()) ok("context pending before approve");
  else bad("context pending before approve");

  calls.length = 0;
  const approved = await HSG.approveAndExecute(pendingBefore[0].id);
  if (approved?.ok && approved?.executed?.ok) ok("approve executes drafts.create");
  else bad("approve executes drafts.create", JSON.stringify(approved?.executed));

  const draftCalls = calls.filter((c) => c.action === "gmail_write" && c.method === "drafts.create");
  const sendCalls = calls.filter(
    (c) =>
      c.action === "gmail_write" &&
      (c.method === "drafts.send" || c.method === "messages.send")
  );
  if (draftCalls.length === 1 && draftCalls[0].humanGateApproved) ok("drafts.create 1 call");
  else bad("drafts.create 1 call", String(draftCalls.length));

  if (sendCalls.length === 0) ok("send API 0");
  else bad("send API 0", String(sendCalls.length));

  const pendingAfter = HSG.readPendingQueue?.() || [];
  if (pendingAfter.length === 0) ok("HSG pending cleared");
  else bad("HSG pending cleared", String(pendingAfter.length));

  if (!Ctx.hasPendingGate?.()) ok("context pending cleared");
  else bad("context pending cleared");

  const draftPreview = Ctx.getDraftResultPreview?.();
  if (draftPreview?.success && draftPreview.subjectPreview) ok("context draft result preview");
  else bad("context draft result preview", JSON.stringify(draftPreview));

  if (!("draftId" in (draftPreview || {}))) ok("preview no draftId export");
  else bad("preview no draftId export");

  const log = HSG.readExecutionLog?.(5) || [];
  if (log.some((e) => e.source === "gmail" && e.result === "success")) ok("audit log updated");
  else bad("audit log updated");

  // failure + retry path
  HSG.clearForTests?.();
  calls.length = 0;
  const failStack = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);
    if (body.action === "gmail_write") {
      return {
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: "mock_draft_failed" }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  });
  failStack.HSG.clearForTests?.();
  failStack.Ctx.saveGmailFocus(
    { id: INTERNAL_MSG_ID, threadId: "t1", subject: "Fail", from: "a@b.com", snippet: "x" },
    { index: 1 }
  );
  failStack.Ctx.saveLastTurn({
    sourceIntent: "context_reply_draft",
    assistantText: "【返信案】\n失敗テスト",
    kind: "gmail",
  });
  const failEnq = failStack.Bridge.enqueueGmailDraftFromChat("下書き保存して");
  const failPending = failStack.HSG.readPendingQueue?.() || [];
  const failApprove = await failStack.HSG.approveAndExecute(failPending[0]?.id);
  if (failApprove?.executed?.ok === false) ok("approve failure recorded");
  else bad("approve failure recorded");

  const retryPending = failStack.HSG.readPendingQueue?.() || [];
  if (retryPending.length === 1 && retryPending[0].status === "pending") ok("failure keeps pending for retry");
  else bad("failure keeps pending for retry", String(retryPending.length));

  if (failStack.Ctx.hasPendingGate?.()) ok("context pending kept on failure");
  else bad("context pending kept on failure");

  // chat send blocked
  HSG.clearForTests?.();
  const sendItem = HSG.enqueueFromGmailDraft({
    gmailAction: "send",
    messageId: "m1",
    to: "a@b.com",
    subject: "Re: Test",
    body: "send body",
    chatOrigin: true,
  });
  const sendExec = await HSG.approveAndExecute(sendItem.id);
  if (sendExec?.executed?.ok === false && /未対応/.test(sendExec?.executed?.message || "")) {
    ok("chat send blocked on approve");
  } else bad("chat send blocked on approve");

  const sendWriteCalls = calls.filter(
    (c) =>
      c.action === "gmail_write" &&
      (c.method === "drafts.send" || c.method === "messages.send")
  );
  if (sendWriteCalls.length === 0) ok("chat send write 0");
  else bad("chat send write 0");
}

const MOCK_LIST = [
  {
    id: INTERNAL_MSG_ID,
    threadId: "phase42_thread_001",
    subject: "Phase42 Test",
    from: "sender@example.com",
    snippet: "hello",
    date: new Date().toISOString(),
    unread: true,
  },
];

const MOCK_BODY = "Phase42 本文。返信テスト。";

function mockToolsRoute(fetchCalls) {
  return async (route) => {
    const req = route.request();
    let body = {};
    try {
      body = req.postDataJSON() || {};
    } catch {
      /* ignore */
    }
    fetchCalls.push(body);
    const action = String(body.action || "");
    const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";

    if (fn === "secretary-google-oauth" && action === "status") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, connected: true, mock: true, configured: true }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail" && body.method === "messages.list") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mock: true, messages: MOCK_LIST }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail" && body.method === "messages.get") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mock: true,
          message: {
            id: INTERNAL_MSG_ID,
            subject: "Phase42 Test",
            from: "sender@example.com",
            snippet: "hello",
            threadId: "phase42_thread_001",
            bodyText: MOCK_BODY,
            bodyTruncated: false,
            hasAttachment: false,
            attachments: [],
          },
        }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail_write") {
      if (!body.humanGateApproved) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "human_gate_required" }),
        });
      }
      if (body.method === "drafts.create") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            mock: true,
            method: "drafts.create",
            draftId: `mock_draft_${body.pendingId}`,
            pendingId: body.pendingId,
          }),
        });
      }
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "send_blocked_phase42" }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, mock: true }),
    });
  };
}

async function sendChat(page, text) {
  const input = page.locator("#ops-ai-command-center [data-ops-secretary-input]").first();
  await page.waitForFunction(
    () => {
      const el = document.querySelector("#ops-ai-command-center [data-ops-secretary-input]");
      return el && !el.disabled;
    },
    { timeout: 30000 }
  );
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(1200);
}

async function lastAssistantText(page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll(
      "#ops-ai-command-center [data-ops-phase2-chat-log] [data-ops-chat-role='assistant']"
    );
    const last = nodes[nodes.length - 1];
    return (last?.textContent || "").trim();
  });
}

async function runBrowserIntegration(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html#ops-ai-command-center`;
  const VIEWPORTS = [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      const fetchCalls = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      page.on("console", (msg) => {
        const t = msg.text();
        if (SECRET_RE.test(t)) jsErrors.push(`secret: ${t.slice(0, 60)}`);
        if (/phase42_internal_msg|mock_draft_/.test(t)) jsErrors.push(`id leak: ${t.slice(0, 60)}`);
      });

      await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

      const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
      const tag = `${w}x${h}`;
      if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
      else bad(`${tag} HTTP 200`, String(resp?.status()));

      await page.waitForFunction(
        () =>
          window.TasuSecretaryGoogleChatWriteBridge &&
          window.TasuAdminAiHumanSendGate &&
          window.TasuSecretaryGoogleGmailClient,
        { timeout: 30000 }
      );

      await page.evaluate(() => {
        window.TasuAdminAiHumanSendGate?.clearForTests?.();
        window.TasuSecretaryGoogleReadonlyCoordinator?.applyConnectionState?.({
          connected: true,
          mock: true,
          configured: true,
        });
      });

      fetchCalls.length = 0;
      await sendChat(page, "未読メールある？");
      await sendChat(page, "1件目を見せて");
      fetchCalls.length = 0;
      await sendChat(page, "返信案作って");
      fetchCalls.length = 0;
      await sendChat(page, "下書き保存して");

      const beforeApprove = await page.evaluate(() => ({
        pending: (window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || []).length,
        hasGate: window.TasuSecretaryGoogleChatContext?.hasPendingGate?.(),
      }));
      if (beforeApprove.pending >= 1) ok(`${tag} pending before approve`);
      else bad(`${tag} pending before approve`, String(beforeApprove.pending));

      fetchCalls.length = 0;
      const approveResult = await page.evaluate(async () => {
        const pending = window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || [];
        const id = pending[0]?.id;
        if (!id) return { ok: false, error: "no_pending" };
        const res = await window.TasuAdminAiHumanSendGate.approveAndExecute(id);
        return {
          ok: Boolean(res?.ok && res?.executed?.ok),
          pendingAfter: (window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || []).length,
          draftPreview: window.TasuSecretaryGoogleChatContext?.getDraftResultPreview?.(),
          hasGate: window.TasuSecretaryGoogleChatContext?.hasPendingGate?.(),
          logCount: (window.TasuAdminAiHumanSendGate?.readExecutionLog?.(5) || []).length,
        };
      });

      if (approveResult.ok) ok(`${tag} approve → drafts.create`);
      else bad(`${tag} approve → drafts.create`, approveResult.error || "failed");

      const writeCalls = fetchCalls.filter((c) => c.action === "gmail_write");
      const draftCalls = writeCalls.filter((c) => c.method === "drafts.create");
      const sendCalls = writeCalls.filter(
        (c) => c.method === "drafts.send" || c.method === "messages.send"
      );
      if (draftCalls.length === 1) ok(`${tag} browser drafts.create 1`);
      else bad(`${tag} browser drafts.create 1`, String(draftCalls.length));

      if (sendCalls.length === 0) ok(`${tag} browser send 0`);
      else bad(`${tag} browser send 0`, String(sendCalls.length));

      if (approveResult.pendingAfter === 0) ok(`${tag} HSG pending cleared`);
      else bad(`${tag} HSG pending cleared`, String(approveResult.pendingAfter));

      if (!approveResult.hasGate) ok(`${tag} context pending cleared`);
      else bad(`${tag} context pending cleared`);

      if (approveResult.draftPreview?.success) ok(`${tag} draft result preview`);
      else bad(`${tag} draft result preview`);

      if (!("draftId" in (approveResult.draftPreview || {}))) ok(`${tag} preview no draftId`);
      else bad(`${tag} preview no draftId`);

      if (approveResult.logCount >= 1) ok(`${tag} audit log`);
      else bad(`${tag} audit log`);

      const domText = await page.evaluate(() => {
        window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("#ops-ai-hsg");
        return (
          document.querySelector("#ops-ai-hsg")?.textContent || "" +
          document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent ||
          ""
        ).slice(0, 8000);
      });
      if (!/phase42_internal_msg|mock_draft_/.test(domText)) ok(`${tag} DOM no id leak`);
      else bad(`${tag} DOM no id leak`);

      if (jsErrors.length === 0) ok(`${tag} JS fatal 0`);
      else bad(`${tag} JS fatal 0`, jsErrors.join(" | "));

      await page.close();
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Phase 4-2 — unit ===");
  runUnitTests();

  console.log("\n=== AI秘書 Google Phase 4-2 — flow ===");
  await runFlowTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Phase 4-2 — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Phase 4-2: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
