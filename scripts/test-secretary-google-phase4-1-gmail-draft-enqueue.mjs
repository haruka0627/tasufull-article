#!/usr/bin/env node
/**
 * AI秘書 — Google Integration Phase 4-1 (Gmail draft Human Gate enqueue)
 *   node scripts/test-secretary-google-phase4-1-gmail-draft-enqueue.mjs
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

const INTERNAL_MSG_ID = "phase4_internal_msg_001";

function loadFullStack() {
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

  const win = {
    sessionStorage,
    localStorage,
    setTimeout(fn) {
      fn();
      return 0;
    },
    clearTimeout() {},
    setInterval() {
      return 0;
    },
    clearInterval() {},
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector: () => null,
      getElementById: () => null,
    },
  };
  win.window = win;

  const sandbox = {
    window: win,
    global: win,
    document: win.document,
    setTimeout: win.setTimeout.bind(win),
    clearTimeout: win.clearTimeout.bind(win),
    setInterval: win.setInterval.bind(win),
    clearInterval: win.clearInterval.bind(win),
  };
  vm.createContext(sandbox);

  vm.runInContext(read("admin-ai-secretary-human-gate.js"), sandbox);
  vm.runInContext(read("admin-ai-human-send-gate.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-gmail-client.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-context.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-gmail-context.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-write-bridge.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-router.js"), sandbox);

  return {
    Unified: win.TasuSecretaryGoogleChatContext,
    Bridge: win.TasuSecretaryGoogleChatWriteBridge,
    Router: win.TasuSecretaryGoogleChatRouter,
    HSG: win.TasuAdminAiHumanSendGate,
    localStorage,
  };
}

function runUnitTests() {
  const routerSrc = read("admin-ai-secretary-google-chat-router.js");
  const bridgeSrc = read("admin-ai-secretary-google-chat-write-bridge.js");
  const ctxSrc = read("admin-ai-secretary-google-chat-context.js");

  if (/write_enqueue_gmail_draft|isDraftEnqueueIntent/.test(routerSrc)) ok("router draft enqueue intent");
  else bad("router draft enqueue intent");

  if (/enqueueGmailDraftFromChat|buildReplyPlanFromFocus/.test(bridgeSrc)) ok("write bridge surface");
  else bad("write bridge surface");

  if (!/\bexecuteWriteApproved\b/.test(bridgeSrc)) ok("bridge no executeWriteApproved");
  else bad("bridge no executeWriteApproved");

  if (!/\bexecuteWriteApproved\b/.test(routerSrc)) ok("router no executeWriteApproved");
  else bad("router no executeWriteApproved");

  if (/saveReplyPlan|hasReplyPlan/.test(ctxSrc)) ok("context reply plan");

  const { Unified, Bridge, Router, HSG } = loadFullStack();
  HSG.clearForTests?.();

  Unified.saveGmailFocus(
    {
      id: INTERNAL_MSG_ID,
      threadId: "phase4_thread_001",
      subject: "Phase4 Test",
      from: "sender@example.com",
      snippet: "hello",
      bodyText: "Body for phase4",
    },
    { index: 1 }
  );
  Unified.saveLastTurn({
    sourceIntent: "context_reply_draft",
    userText: "返信案作って",
    assistantText: "【返信案 · 未送信】\n確認いたします。\n\n※ read-only · 送信・下書き保存は未対応",
    kind: "gmail",
  });

  const blockedDraft = Router.matchIntent("メールに返信して");
  if (blockedDraft.intent === "write_blocked") ok("matchIntent block send execute");
  else bad("matchIntent block send execute", blockedDraft.intent);

  const enqueueIntent = Router.matchIntent("下書き保存して");
  if (enqueueIntent.intent === "write_enqueue_gmail_draft") ok("matchIntent draft enqueue");
  else bad("matchIntent draft enqueue", enqueueIntent.intent);

  const plan = Bridge.buildReplyPlanFromFocus(
    Unified.getGmailFocusRef(),
    "返信本文テスト",
    "unit test"
  );
  if (plan.subject && plan.recipient && plan.body) ok("reply plan shape");
  else bad("reply plan shape");

  const preview = Unified.getReplyPlanPreview?.();
  if (!preview || !("id" in (preview || {}))) ok("reply plan preview no internal id");
  else bad("reply plan preview no internal id");

  const enq = Bridge.enqueueGmailDraftFromChat("下書き保存して");
  if (enq.ok && enq.enqueued) ok("enqueue to HSG");
  else bad("enqueue to HSG", enq.error || enq.reply?.slice(0, 60));

  const pending = HSG.readPendingQueue?.() || [];
  if (pending.length === 1 && pending[0].source === "gmail") ok("HSG pending queue 1");
  else bad("HSG pending queue 1", String(pending.length));

  if (pending[0]?.payload?.gmailAction === "draft_create") ok("HSG payload draft_create");
  else bad("HSG payload draft_create");

  if (Unified.hasPendingGate?.()) ok("context pending gate saved");
  else bad("context pending gate saved");

  const gateMeta = Unified.getPendingGateMeta?.();
  if (gateMeta?.kind === "gmail_draft" && !gateMeta.pendingId) ok("pending gate meta no id export");
  else bad("pending gate meta no id export", JSON.stringify(gateMeta));
}

const MOCK_LIST = [
  {
    id: INTERNAL_MSG_ID,
    threadId: "phase4_thread_001",
    subject: "Phase4 Test",
    from: "sender@example.com",
    snippet: "hello",
    date: new Date().toISOString(),
    unread: true,
  },
];

const MOCK_BODY = "Phase4 本文。返信テスト。";

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
            subject: "Phase4 Test",
            from: "sender@example.com",
            snippet: "hello",
            threadId: "phase4_thread_001",
            bodyText: MOCK_BODY,
            bodyTruncated: false,
            hasAttachment: false,
            attachments: [],
          },
        }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail_write") {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "write_should_not_run_in_4_1" }),
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
  await page.locator("#ops-ai-command-center [data-ops-secretary-send]").first().click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector("#ops-ai-command-center [data-ops-secretary-input]");
      return el && !el.disabled;
    },
    { timeout: 30000 }
  );
}

async function lastAssistantText(page) {
  return page.evaluate(() => {
    const msgs = [...document.querySelectorAll("#ops-ai-command-center [data-ops-phase2-chat-log] .ops-p2-chat__msg--assistant")];
    return msgs.length ? msgs[msgs.length - 1].textContent || "" : "";
  });
}

async function runBrowserIntegration(base) {
  const PAGE = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html#ops-ai-command-center`;

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    const fetchCalls = [];
    page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
    page.on("console", (msg) => {
      const t = msg.text();
      if (SECRET_RE.test(t)) jsErrors.push(`secret: ${t.slice(0, 60)}`);
      if (/phase4_internal_msg/.test(t)) jsErrors.push(`id leak: ${t.slice(0, 60)}`);
    });

    await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(
      () =>
        window.TasuSecretaryGoogleChatWriteBridge &&
        window.TasuSecretaryGoogleChatRouter &&
        window.TasuAdminAiHumanSendGate,
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
    let assistant = await lastAssistantText(page);
    if (/返信案|未送信|mock/i.test(assistant)) ok("browser flow reply draft");
    else bad("browser flow reply draft", assistant.slice(0, 80));

    const hasPlan = await page.evaluate(() => window.TasuSecretaryGoogleChatContext?.hasReplyPlan?.());
    if (hasPlan) ok("browser reply plan saved");
    else bad("browser reply plan saved");

    fetchCalls.length = 0;
    await sendChat(page, "下書き保存して");
    assistant = await lastAssistantText(page);
    if (/Human Gate|承認待ち|未実行|Dashboard/i.test(assistant)) ok("browser flow draft enqueue");
    else bad("browser flow draft enqueue", assistant.slice(0, 100));

    const writeCalls = fetchCalls.filter((c) => c.action === "gmail_write");
    if (writeCalls.length === 0) ok("browser write API 0");
    else bad("browser write API 0", String(writeCalls.length));

    const audit = await page.evaluate(() => {
      window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("#ops-ai-hsg");
      const pending = window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || [];
      const hsgPanel = document.querySelector("#ops-ai-hsg")?.textContent || "";
      const chat = (
        document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent || ""
      ).slice(0, 8000);
      return {
        pendingCount: pending.length,
        pendingGmail: pending.filter((p) => p.source === "gmail").length,
        hsgHasGmail: /Gmail|下書き|Human Gate/i.test(hsgPanel),
        chat,
        gateMeta: window.TasuSecretaryGoogleChatContext?.getPendingGateMeta?.(),
      };
    });

    if (audit.pendingCount >= 1) ok("browser HSG pending queue");
    else bad("browser HSG pending queue", String(audit.pendingCount));

    if (audit.pendingGmail >= 1) ok("browser HSG gmail pending");
    else bad("browser HSG gmail pending");

    if (audit.hsgHasGmail) ok("browser dashboard HSG panel visible");
    else bad("browser dashboard HSG panel visible");

    if (!/phase4_internal_msg/.test(audit.chat)) ok("browser chat no messageId leak");
    else bad("browser chat no messageId leak");

    if (audit.gateMeta?.kind === "gmail_draft") ok("browser context pending gate meta");
    else bad("browser context pending gate meta");

    if (jsErrors.length === 0) ok("browser JS fatal 0");
    else bad("browser JS fatal 0", jsErrors.join(" | "));

    await page.close();
  });
}

async function main() {
  console.log("=== AI秘書 Google Phase 4-1 — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Phase 4-1 — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Phase 4-1: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
