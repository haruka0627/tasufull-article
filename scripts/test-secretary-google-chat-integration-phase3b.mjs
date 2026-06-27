#!/usr/bin/env node
/**
 * AI秘書 — Google Chat Integration Phase 3b
 *   node scripts/test-secretary-google-chat-integration-phase3b.mjs
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

const INTERNAL_MSG_ID = "chat_internal_msg_ref_002";

function htmlToPlainText(html) {
  let t = String(html || "").trim();
  if (!t) return "";
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function capBody(text, maxLen) {
  text = String(text || "");
  const truncated = text.length > maxLen;
  if (truncated) text = text.slice(0, maxLen - 1) + "…";
  return { text, truncated };
}

function loadStack() {
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
  vm.runInContext(read("admin-ai-secretary-google-chat-gmail-context.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-router.js"), sandbox);
  return {
    Ctx: win.TasuSecretaryGoogleChatGmailContext,
    Router: win.TasuSecretaryGoogleChatRouter,
    storage,
  };
}

function runUnitTests() {
  const gmailTs = read("supabase/functions/_shared/secretary-google-gmail.ts");
  const client = read("admin-ai-secretary-google-gmail-client.js");
  const routerSrc = read("admin-ai-secretary-google-chat-router.js");
  const ctxSrc = read("admin-ai-secretary-google-chat-gmail-context.js");
  const html = read("admin-operations-dashboard.html");
  const { Ctx, Router, storage } = loadStack();

  if (/includeBody/.test(gmailTs) && /bodyText/.test(gmailTs) && /extractPlainTextBody/.test(gmailTs)) {
    ok("edge includeBody + bodyText");
  } else bad("edge includeBody + bodyText");

  if (/htmlToPlainText/.test(gmailTs) && /text\/plain/.test(gmailTs)) {
    ok("edge htmlToPlainText + plain priority");
  } else bad("edge htmlToPlainText + plain priority");

  if (/BODY_TEXT_MAX\s*=\s*8000/.test(gmailTs)) ok("edge body cap 8000");
  else bad("edge body cap 8000");

  if (/includeBody:\s*false/.test(gmailTs)) ok("edge list path no body");
  else bad("edge list path no body");

  if (/getMessage\(messageId,\s*options\)/.test(client) && /includeBody/.test(client)) {
    ok("client getMessage includeBody");
  } else bad("client getMessage includeBody");

  if (/admin-ai-secretary-google-chat-gmail-context\.js/.test(html)) ok("dashboard context script");
  else bad("dashboard context script");

  if (!/postGmailWrite|enqueueDraft|proposeReply/.test(routerSrc)) ok("router no write refs");
  else bad("router no write refs");

  const intentCases = [
    ["2件目を見せて", "gmail_pick"],
    ["1件目詳しく", "gmail_pick"],
    ["このメール詳しく", "gmail_detail"],
    ["全文", "gmail_detail"],
    ["昨日のメールを詳しく要約", "gmail_detail_summarize"],
    ["田中さんからのメールの内容教えて", "gmail_search_and_detail"],
    ["未読メールある？", "gmail_unread"],
    ["予定を追加して", "write_blocked"],
  ];

  for (const [text, expected] of intentCases) {
    const { intent } = Router.matchIntent(text);
    if (intent === expected) ok(`matchIntent ${expected}`);
    else bad(`matchIntent ${expected}`, `got ${intent}`);
  }

  Ctx.saveList(
    [
      { id: "a1", threadId: "t1", subject: "One", from: "a@ex.com", snippet: "s1" },
      { id: INTERNAL_MSG_ID, threadId: "t2", subject: "Two", from: "b@ex.com", snippet: "s2" },
    ],
    { label: "test" }
  );
  const hit = Ctx.getByIndex(2);
  if (hit?.subject === "Two" && hit.id === INTERNAL_MSG_ID) ok("context getByIndex");
  else bad("context getByIndex");

  const raw = storage.getItem("tasu_secretary_chat_gmail_ctx_v1");
  if (raw && !/refresh_token|access_token/.test(raw)) ok("context storage no secrets");
  else bad("context storage no secrets");

  const plain = htmlToPlainText('<p>Hello <b>World</b></p><script>alert(1)</script>');
  if (plain.includes("Hello") && plain.includes("World") && !plain.includes("alert")) {
    ok("html plain text strip");
  } else bad("html plain text strip", plain);

  const capped = capBody("x".repeat(9000), 8000);
  if (capped.text.length <= 8000 && capped.truncated) ok("body cap logic");
  else bad("body cap logic");

  if (/TTL_MS\s*=\s*15/.test(ctxSrc)) ok("context TTL 15min");
  else bad("context TTL 15min");
}

const MOCK_LIST = [
  {
    id: "chat_internal_msg_ref_001",
    threadId: "chat_thread_001",
    subject: "未読テスト",
    from: "sender@example.com",
    snippet: "hello unread",
    date: new Date().toISOString(),
    unread: true,
  },
  {
    id: INTERNAL_MSG_ID,
    threadId: "chat_thread_002",
    subject: "2件目テスト",
    from: "tanaka@example.com",
    snippet: "詳細本文へ",
    date: new Date().toISOString(),
    unread: false,
  },
];

const MOCK_BODY =
  "これは2件目の本文です。Connect 審査の期限は来週金曜日。添付 PDF をご確認ください。";

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
        body: JSON.stringify({
          ok: true,
          connected: false,
          mock: false,
          configured: true,
        }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail" && body.method === "messages.list") {
      const q = String(body.q || "");
      const fromTanaka = /from:田中|tanaka/i.test(q);
      const list = fromTanaka
        ? [
            {
              id: "chat_internal_msg_ref_003",
              subject: "田中さんから",
              from: "tanaka@example.com",
              snippet: "見積の件",
              threadId: "chat_thread_003",
              date: new Date().toISOString(),
            },
          ]
        : MOCK_LIST;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mock: true, messages: list }),
      });
    }

    if (fn === "secretary-google-tools" && action === "gmail" && body.method === "messages.get") {
      const includeBody = Boolean(body.includeBody);
      const id = String(body.messageId || "");
      const base =
        id === INTERNAL_MSG_ID || id === "chat_internal_msg_ref_003"
          ? {
              id,
              subject: id.includes("003") ? "田中さんから" : "2件目テスト",
              from: "tanaka@example.com",
              snippet: "詳細本文へ",
              threadId: "chat_thread_002",
            }
          : MOCK_LIST[0];
      const message = includeBody
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
        body: JSON.stringify({ ok: true, mock: true, events: [] }),
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
  const VIEWPORTS = [
    [1280, 900],
    [768, 1024],
    [390, 844],
  ];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h] of VIEWPORTS) {
      const tag = `${w}x${h}`;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsErrors = [];
      const fetchCalls = [];
      page.on("pageerror", (err) => jsErrors.push(String(err.message || err)));
      page.on("console", (msg) => {
        const t = msg.text();
        if (SECRET_RE.test(t)) jsErrors.push(`secret in console: ${t.slice(0, 80)}`);
        if (/chat_internal_msg_ref/.test(t)) jsErrors.push(`messageId in console: ${t.slice(0, 80)}`);
      });

      await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`, String(resp?.status()));

        await page.waitForFunction(
          () =>
            window.TasuSecretaryGoogleChatRouter &&
            window.TasuSecretaryGoogleChatGmailContext &&
            document.querySelector("[data-ops-secretary-input]"),
          { timeout: 30000 }
        );

        fetchCalls.length = 0;
        await sendChat(page, "未読メールある？");
        let assistant = await lastAssistantText(page);
        if (/未接続|OAuth/.test(assistant)) ok(`${tag} disconnected guidance`);
        else bad(`${tag} disconnected guidance`, assistant.slice(0, 80));
        const toolsDisconnected = fetchCalls.filter((c) => c.action === "gmail" || c.action === "calendar_read");
        if (toolsDisconnected.length === 0) ok(`${tag} disconnected API 0`);
        else bad(`${tag} disconnected API 0`, String(toolsDisconnected.length));

        await page.evaluate(() => {
          window.TasuSecretaryGoogleReadonlyCoordinator?.applyConnectionState?.({
            connected: true,
            mock: true,
            configured: true,
          });
        });

        await page.unroute("**/functions/v1/**");
        await page.route("**/functions/v1/**", async (route) => {
          const req = route.request();
          let body = {};
          try {
            body = req.postDataJSON() || {};
          } catch {
            /* ignore */
          }
          fetchCalls.push(body);
          const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";
          const action = String(body.action || "");
          if (fn === "secretary-google-oauth" && action === "status") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ ok: true, connected: true, mock: true, configured: true }),
            });
          }
          return mockToolsRoute(fetchCalls)(route);
        });

        fetchCalls.length = 0;
        await sendChat(page, "未読メールある？");
        assistant = await lastAssistantText(page);
        if (/未読|件/.test(assistant)) ok(`${tag} list unread`);
        else bad(`${tag} list unread`, assistant.slice(0, 100));
        const listGets = fetchCalls.filter((c) => c.method === "messages.get");
        if (listGets.length === 0) ok(`${tag} list no getMessage`);
        else bad(`${tag} list no getMessage`, String(listGets.length));

        fetchCalls.length = 0;
        await sendChat(page, "2件目を見せて");
        assistant = await lastAssistantText(page);
        if (/2件目|2件目テスト|Connect|本文|tanaka/i.test(assistant)) ok(`${tag} pick detail`);
        else bad(`${tag} pick detail`, assistant.slice(0, 120));
        const detailGets = fetchCalls.filter((c) => c.method === "messages.get" && c.includeBody);
        if (detailGets.length >= 1) ok(`${tag} getMessage includeBody`);
        else bad(`${tag} getMessage includeBody`, JSON.stringify(fetchCalls));

        fetchCalls.length = 0;
        await page.evaluate(() => window.TasuSecretaryGoogleChatGmailContext?.clear?.());
        await sendChat(page, "このメール詳しく");
        assistant = await lastAssistantText(page);
        if (/一覧がありません|先に/.test(assistant)) ok(`${tag} no context guidance`);
        else bad(`${tag} no context guidance`, assistant.slice(0, 100));
        const noCtxGets = fetchCalls.filter((c) => c.method === "messages.get");
        if (noCtxGets.length === 0) ok(`${tag} no context no get`);
        else bad(`${tag} no context no get`, String(noCtxGets.length));

        fetchCalls.length = 0;
        await sendChat(page, "田中さんからのメールの内容教えて");
        assistant = await lastAssistantText(page);
        if (/田中|見積|Connect|件/.test(assistant)) ok(`${tag} search and detail`);
        else bad(`${tag} search and detail`, assistant.slice(0, 120));
        const searchDetailGets = fetchCalls.filter((c) => c.method === "messages.get" && c.includeBody);
        if (searchDetailGets.length >= 1) ok(`${tag} search detail includeBody`);
        else bad(`${tag} search detail includeBody`);

        fetchCalls.length = 0;
        await sendChat(page, "メールに返信して");
        assistant = await lastAssistantText(page);
        if (/read-only|未対応/.test(assistant)) ok(`${tag} write blocked`);
        else bad(`${tag} write blocked`, assistant.slice(0, 80));
        const writeCalls = fetchCalls.filter((c) => c.action === "gmail_write");
        if (writeCalls.length === 0) ok(`${tag} write blocked no API`);
        else bad(`${tag} write blocked no API`);

        const domAudit = await page.evaluate(() => ({
          bodyText: document.body.innerText.slice(0, 12000),
          chatText: (
            document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent || ""
          ).slice(0, 8000),
        }));
        if (!SECRET_RE.test(domAudit.bodyText)) ok(`${tag} DOM no secrets`);
        else bad(`${tag} DOM no secrets`);
        if (!/chat_internal_msg_ref/.test(domAudit.chatText)) ok(`${tag} chat no messageId leak`);
        else bad(`${tag} chat no messageId leak`);

        if (jsErrors.length === 0) ok(`${tag} JS fatal 0`);
        else bad(`${tag} JS fatal 0`, jsErrors.join(" | "));
      } finally {
        await page.close();
      }
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Chat Phase 3b — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Chat Phase 3b — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Chat Phase 3b: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
