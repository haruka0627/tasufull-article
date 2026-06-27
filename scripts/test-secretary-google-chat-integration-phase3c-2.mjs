#!/usr/bin/env node
/**
 * AI秘書 — Google Chat Integration Phase 3c-2
 *   node scripts/test-secretary-google-chat-integration-phase3c-2.mjs
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

const INTERNAL_MSG_ID = "ctx_internal_msg_002";

function loadRouterStack() {
  const storage = {
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
    sessionStorage: storage,
    setTimeout(fn) {
      fn();
      return 0;
    },
    clearTimeout() {},
  };
  win.window = win;
  const sandbox = { window: win, global: win };
  vm.createContext(sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-context.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-gmail-context.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-router.js"), sandbox);
  return {
    Unified: win.TasuSecretaryGoogleChatContext,
    Router: win.TasuSecretaryGoogleChatRouter,
    storage,
  };
}

function runUnitTests() {
  const routerSrc = read("admin-ai-secretary-google-chat-router.js");
  const ctxSrc = read("admin-ai-secretary-google-chat-context.js");
  const { Unified, Router } = loadRouterStack();

  if (/context_more_detail|context_reply_draft|context_refine_short/.test(routerSrc)) {
    ok("router context intents");
  } else bad("router context intents");

  if (/saveCalendarList|getCalendarListMeta/.test(ctxSrc)) ok("context calendar save");
  else bad("context calendar save");

  if (/返信案|下書き案/.test(routerSrc) && /返信して|下書きを/.test(routerSrc)) {
    ok("write vs draft split");
  } else bad("write vs draft split");

  const blocked = Router.matchIntent("メールに返信して");
  if (blocked.intent === "write_blocked") ok("matchIntent write_blocked reply");
  else bad("matchIntent write_blocked reply", blocked.intent);

  const sendBlocked = Router.matchIntent("このメール送信して");
  if (sendBlocked.intent === "write_blocked") ok("matchIntent write_blocked send");
  else bad("matchIntent write_blocked send", sendBlocked.intent);

  Unified.saveGmailFocus(
    {
      id: INTERNAL_MSG_ID,
      threadId: "ctx_thread_002",
      subject: "Focus",
      from: "a@ex.com",
      snippet: "sn",
      bodyText: "Body for focus",
    },
    { index: 2 }
  );
  Unified.saveLastTurn({
    sourceIntent: "gmail_detail",
    userText: "2件目詳しく",
    assistantText: "2件目: Focus 要約",
    kind: "gmail",
  });

  const draftIntent = Router.matchIntent("返信案作って");
  if (draftIntent.intent === "context_reply_draft") ok("matchIntent reply draft");
  else bad("matchIntent reply draft", draftIntent.intent);

  const shortIntent = Router.matchIntent("もっと短く");
  if (shortIntent.intent === "context_refine_short") ok("matchIntent refine short");
  else bad("matchIntent refine short", shortIntent.intent);

  const keigoIntent = Router.matchIntent("敬語にして");
  if (keigoIntent.intent === "context_refine_keigo") ok("matchIntent refine keigo");
  else bad("matchIntent refine keigo", keigoIntent.intent);

  const moreIntent = Router.matchIntent("このメール詳しく");
  if (moreIntent.intent === "context_more_detail") ok("matchIntent context more detail");
  else bad("matchIntent context more detail", moreIntent.intent);

  Unified.saveCalendarList(
    [{ id: "ev1", title: "Standup", start: new Date().toISOString() }],
    { label: "今日の予定", preset: "today", sourceIntent: "calendar_today" }
  );
  if (Unified.hasCalendarList()) ok("calendar list saved");
  else bad("calendar list saved");

  const calMeta = Unified.getCalendarListMeta();
  if (calMeta?.items?.length === 1 && !("id" in calMeta.items[0])) ok("calendar meta no id expose");
  else bad("calendar meta no id expose");
}

const MOCK_LIST = [
  {
    id: "ctx_internal_msg_001",
    threadId: "ctx_thread_001",
    subject: "未読テスト",
    from: "sender@example.com",
    snippet: "hello unread",
    date: new Date().toISOString(),
    unread: true,
  },
  {
    id: INTERNAL_MSG_ID,
    threadId: "ctx_thread_002",
    subject: "2件目テスト",
    from: "tanaka@example.com",
    snippet: "詳細本文へ",
    date: new Date().toISOString(),
    unread: false,
  },
];

const MOCK_BODY = "これは2件目の本文です。Connect 審査の期限は来週金曜日。";

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
      const id = String(body.messageId || "");
      const base =
        id === INTERNAL_MSG_ID
          ? {
              id,
              subject: "2件目テスト",
              from: "tanaka@example.com",
              snippet: "詳細本文へ",
              threadId: "ctx_thread_002",
            }
          : MOCK_LIST[0];
      const message = body.includeBody
        ? { ...base, bodyText: MOCK_BODY, bodyTruncated: false, hasAttachment: false, attachments: [] }
        : base;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mock: true, message }),
      });
    }

    if (fn === "secretary-google-tools" && action === "calendar_read") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mock: true,
          events: [
            {
              id: "ev_today",
              title: "Standup",
              start: new Date().toISOString(),
              end: new Date(Date.now() + 3600000).toISOString(),
              allDay: false,
            },
          ],
        }),
      });
    }

    if (fn === "secretary-google-tools" && (action === "gmail_write" || action === "calendar_write")) {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "write_forbidden_in_test" }),
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
      if (/ctx_internal_msg/.test(t)) jsErrors.push(`id leak: ${t.slice(0, 60)}`);
    });

    await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

    const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
    if ((resp?.status() ?? 0) === 200) ok("browser HTTP 200");
    else bad("browser HTTP 200", String(resp?.status()));

    await page.waitForFunction(
      () =>
        window.TasuSecretaryGoogleChatContext &&
        window.TasuSecretaryGoogleChatRouter &&
        document.querySelector("[data-ops-secretary-input]"),
      { timeout: 30000 }
    );

    await page.evaluate(() => {
      window.TasuSecretaryGoogleReadonlyCoordinator?.applyConnectionState?.({
        connected: true,
        mock: true,
        configured: true,
      });
    });

    fetchCalls.length = 0;
    await sendChat(page, "未読メールある？");
    let assistant = await lastAssistantText(page);
    if (/未読|件/.test(assistant)) ok("flow list unread");
    else bad("flow list unread", assistant.slice(0, 80));

    fetchCalls.length = 0;
    await sendChat(page, "2件目を見せて");
    assistant = await lastAssistantText(page);
    if (/2件目|Connect|本文|2件目テスト/i.test(assistant)) ok("flow pick detail");
    else bad("flow pick detail", assistant.slice(0, 100));

    const hasFocus = await page.evaluate(() => window.TasuSecretaryGoogleChatContext?.hasGmailFocus?.());
    if (hasFocus) ok("focus saved after detail");
    else bad("focus saved after detail");

    fetchCalls.length = 0;
    await sendChat(page, "このメール詳しく");
    assistant = await lastAssistantText(page);
    if (/2件目|Focus|Connect|詳細|2件目テスト/i.test(assistant)) ok("flow context more detail");
    else bad("flow context more detail", assistant.slice(0, 100));
    const getsAfterMore = fetchCalls.filter((c) => c.method === "messages.get");
    if (getsAfterMore.length === 0) ok("more detail no extra get when focus body");
    else bad("more detail no extra get when focus body", String(getsAfterMore.length));

    fetchCalls.length = 0;
    await sendChat(page, "返信案作って");
    assistant = await lastAssistantText(page);
    if (/返信案|未送信|read-only|mock返信案|確認/i.test(assistant)) ok("flow reply draft");
    else bad("flow reply draft", assistant.slice(0, 100));
    const writeAfterDraft = fetchCalls.filter((c) => c.action === "gmail_write");
    if (writeAfterDraft.length === 0) ok("reply draft no write API");
    else bad("reply draft no write API");

    fetchCalls.length = 0;
    await sendChat(page, "もっと短く");
    assistant = await lastAssistantText(page);
    if (assistant.length > 0) ok("flow refine short");
    else bad("flow refine short");

    fetchCalls.length = 0;
    await sendChat(page, "敬語にして");
    assistant = await lastAssistantText(page);
    if (assistant.length > 0) ok("flow refine keigo");
    else bad("flow refine keigo");

    fetchCalls.length = 0;
    await sendChat(page, "今日の予定は？");
    assistant = await lastAssistantText(page);
    if (/今日|Standup|予定|件/.test(assistant)) ok("flow calendar today");
    else bad("flow calendar today", assistant.slice(0, 80));

    const hasCal = await page.evaluate(() => window.TasuSecretaryGoogleChatContext?.hasCalendarList?.());
    const hasTurn = await page.evaluate(() => window.TasuSecretaryGoogleChatContext?.hasLastTurn?.());
    if (hasCal && hasTurn) ok("calendar + lastTurn saved");
    else bad("calendar + lastTurn saved");

    fetchCalls.length = 0;
    await sendChat(page, "返信して");
    assistant = await lastAssistantText(page);
    if (/read-only|未対応/.test(assistant)) ok("flow write blocked reply");
    else bad("flow write blocked reply", assistant.slice(0, 80));

    fetchCalls.length = 0;
    await sendChat(page, "送信して");
    assistant = await lastAssistantText(page);
    if (/read-only|未対応/.test(assistant)) ok("flow write blocked send");
    else bad("flow write blocked send");

    fetchCalls.length = 0;
    await sendChat(page, "下書き作って");
    assistant = await lastAssistantText(page);
    if (/read-only|未対応/.test(assistant)) ok("flow write blocked draft");
    else bad("flow write blocked draft");

    const audit = await page.evaluate(() => ({
      chat: (
        document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent || ""
      ).slice(0, 10000),
    }));
    if (!/ctx_internal_msg/.test(audit.chat)) ok("chat no messageId leak");
    else bad("chat no messageId leak");
    if (jsErrors.length === 0) ok("browser JS fatal 0");
    else bad("browser JS fatal 0", jsErrors.join(" | "));

    await page.close();
  });
}

async function main() {
  console.log("=== AI秘書 Google Chat Phase 3c-2 — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Chat Phase 3c-2 — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Chat Phase 3c-2: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
