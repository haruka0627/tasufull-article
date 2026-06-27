#!/usr/bin/env node
/**
 * AI秘書 — Google Chat Integration Phase 3c-3
 *   node scripts/test-secretary-google-chat-integration-phase3c-3.mjs
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
  const { Unified, Router } = loadRouterStack();

  if (/context_triage|context_cross_calendar/.test(routerSrc)) ok("router triage cross intents");
  else bad("router triage cross intents");

  if (/context_refine_bullets|context_refine_subject|context_refine_casual/.test(routerSrc)) {
    ok("router refine variants");
  } else bad("router refine variants");

  if (/resolveGmailFocusForContext|hasResolvableGmailContext/.test(routerSrc)) ok("context priority helpers");
  else bad("context priority helpers");

  Unified.saveGmailFocus(
    {
      id: INTERNAL_MSG_ID,
      threadId: "ctx_thread_002",
      subject: "Focus",
      from: "a@ex.com",
      snippet: "sn",
      bodyText: "Body for focus · 期限は来週金曜",
    },
    { index: 2 }
  );
  Unified.saveLastTurn({
    sourceIntent: "context_reply_draft",
    userText: "返信案作って",
    assistantText: "【返信案 · 未送信】\n確認いたします。\n\n※ read-only · 送信・下書き保存は未対応",
    kind: "gmail",
  });
  Unified.saveCalendarList(
    [{ id: "ev1", title: "Standup", start: new Date().toISOString() }],
    { label: "今日の予定", preset: "today", sourceIntent: "calendar_today" }
  );

  const triage = Router.matchIntent("このメール重要？");
  if (triage.intent === "context_triage") ok("matchIntent triage importance");
  else bad("matchIntent triage importance", triage.intent);

  const urgent = Router.matchIntent("急ぎ？");
  if (urgent.intent === "context_triage") ok("matchIntent triage urgent");
  else bad("matchIntent triage urgent", urgent.intent);

  const cross = Router.matchIntent("今日の予定と照らして");
  if (cross.intent === "context_cross_calendar") ok("matchIntent cross calendar");
  else bad("matchIntent cross calendar", cross.intent);

  const whenReply = Router.matchIntent("返信するならいつがいい？");
  if (whenReply.intent === "context_cross_calendar") ok("matchIntent cross when reply");
  else bad("matchIntent cross when reply", whenReply.intent);

  const pronoun = Router.matchIntent("それ詳しく");
  if (pronoun.intent === "context_more_detail") ok("matchIntent pronoun detail");
  else bad("matchIntent pronoun detail", pronoun.intent);

  const bullets = Router.matchIntent("箇条書きにして");
  if (bullets.intent === "context_refine_bullets") ok("matchIntent refine bullets");
  else bad("matchIntent refine bullets", bullets.intent);

  const subject = Router.matchIntent("件名案も");
  if (subject.intent === "context_refine_subject") ok("matchIntent refine subject");
  else bad("matchIntent refine subject", subject.intent);

  const casual = Router.matchIntent("もっとカジュアル");
  if (casual.intent === "context_refine_casual") ok("matchIntent refine casual");
  else bad("matchIntent refine casual", casual.intent);

  const blocked = Router.matchIntent("メールに返信して");
  if (blocked.intent === "write_blocked") ok("matchIntent write blocked");
  else bad("matchIntent write blocked", blocked.intent);

  const draftAfter = Router.matchIntent("返信案作って");
  if (draftAfter.intent === "context_reply_draft") ok("matchIntent existing reply draft");
  else bad("matchIntent existing reply draft", draftAfter.intent);

  const shortAfter = Router.matchIntent("もっと短く");
  if (shortAfter.intent === "context_refine_short") ok("matchIntent existing refine short");
  else bad("matchIntent existing refine short", shortAfter.intent);
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

async function runBrowserFlow(page, viewportLabel) {
  const fetchCalls = [];
  const jsErrors = [];
  page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
  page.on("console", (msg) => {
    const t = msg.text();
    if (SECRET_RE.test(t)) jsErrors.push(`secret: ${t.slice(0, 60)}`);
    if (/ctx_internal_msg/.test(t)) jsErrors.push(`id leak: ${t.slice(0, 60)}`);
  });

  await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

  const PAGE = `${(await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" })).replace(/\/$/, "")}/admin-operations-dashboard.html#ops-ai-command-center`;
  const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
  if ((resp?.status() ?? 0) === 200) ok(`${viewportLabel} HTTP 200`);
  else bad(`${viewportLabel} HTTP 200`, String(resp?.status()));

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
  if (/未読|件/.test(assistant)) ok(`${viewportLabel} flow list unread`);
  else bad(`${viewportLabel} flow list unread`, assistant.slice(0, 80));

  fetchCalls.length = 0;
  await sendChat(page, "2件目を見せて");
  assistant = await lastAssistantText(page);
  if (/2件目|Connect|2件目テスト/i.test(assistant)) ok(`${viewportLabel} flow pick detail`);
  else bad(`${viewportLabel} flow pick detail`, assistant.slice(0, 100));

  fetchCalls.length = 0;
  await sendChat(page, "このメール重要？");
  assistant = await lastAssistantText(page);
  if (/重要|★|理由|推奨|mock/i.test(assistant)) ok(`${viewportLabel} flow triage`);
  else bad(`${viewportLabel} flow triage`, assistant.slice(0, 100));
  const getsAfterTriage = fetchCalls.filter((c) => c.method === "messages.get");
  if (getsAfterTriage.length === 0) ok(`${viewportLabel} triage no extra get`);
  else bad(`${viewportLabel} triage no extra get`, String(getsAfterTriage.length));

  fetchCalls.length = 0;
  await sendChat(page, "返信案作って");
  assistant = await lastAssistantText(page);
  if (/返信案|未送信|read-only|mock/i.test(assistant)) ok(`${viewportLabel} flow reply draft`);
  else bad(`${viewportLabel} flow reply draft`, assistant.slice(0, 100));

  fetchCalls.length = 0;
  await sendChat(page, "箇条書きにして");
  assistant = await lastAssistantText(page);
  if (/・|返信案|mock|確認/i.test(assistant)) ok(`${viewportLabel} flow refine bullets`);
  else bad(`${viewportLabel} flow refine bullets`, assistant.slice(0, 100));

  fetchCalls.length = 0;
  await sendChat(page, "今日の予定は？");
  assistant = await lastAssistantText(page);
  if (/今日|Standup|予定|件/.test(assistant)) ok(`${viewportLabel} flow calendar today`);
  else bad(`${viewportLabel} flow calendar today`, assistant.slice(0, 80));

  fetchCalls.length = 0;
  await sendChat(page, "今日の予定と照らして");
  assistant = await lastAssistantText(page);
  if (/予定|Standup|照合|mock|Gmail|メール/i.test(assistant)) ok(`${viewportLabel} flow cross calendar`);
  else bad(`${viewportLabel} flow cross calendar`, assistant.slice(0, 100));

  fetchCalls.length = 0;
  await sendChat(page, "それ詳しく");
  assistant = await lastAssistantText(page);
  if (/2件目|Connect|詳細|2件目テスト/i.test(assistant)) ok(`${viewportLabel} flow pronoun detail`);
  else bad(`${viewportLabel} flow pronoun detail`, assistant.slice(0, 100));
  const getsAfterPronoun = fetchCalls.filter((c) => c.method === "messages.get");
  if (getsAfterPronoun.length === 0) ok(`${viewportLabel} pronoun no extra get`);
  else bad(`${viewportLabel} pronoun no extra get`, String(getsAfterPronoun.length));

  fetchCalls.length = 0;
  await sendChat(page, "返信して");
  assistant = await lastAssistantText(page);
  if (/read-only|未対応/.test(assistant)) ok(`${viewportLabel} flow write blocked`);
  else bad(`${viewportLabel} flow write blocked`, assistant.slice(0, 80));

  const audit = await page.evaluate(() => ({
    chat: (
      document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent || ""
    ).slice(0, 12000),
  }));
  if (!/ctx_internal_msg/.test(audit.chat)) ok(`${viewportLabel} chat no messageId leak`);
  else bad(`${viewportLabel} chat no messageId leak`);
  if (jsErrors.length === 0) ok(`${viewportLabel} JS fatal 0`);
  else bad(`${viewportLabel} JS fatal 0`, jsErrors.join(" | "));
}

async function runBrowserIntegration() {
  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      { label: "1280", width: 1280, height: 900 },
      { label: "768", width: 768, height: 1024 },
      { label: "390", width: 390, height: 844 },
    ];
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      console.log(`\n--- browser viewport ${vp.label} ---`);
      await runBrowserFlow(page, vp.label);
      await page.close();
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Chat Phase 3c-3 — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Chat Phase 3c-3 — browser @ ${base} ===`);
    await runBrowserIntegration();
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Chat Phase 3c-3: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
