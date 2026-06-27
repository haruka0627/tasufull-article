#!/usr/bin/env node
/**
 * AI秘書 — Google Chat Integration Phase 3a
 *   node scripts/test-secretary-google-chat-integration-phase3a.mjs
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

function loadRouterForUnit() {
  const sandbox = {
    setTimeout(fn) {
      fn();
      return 0;
    },
    clearTimeout() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-router.js"), sandbox);
  return sandbox.TasuSecretaryGoogleChatRouter;
}

function runUnitTests() {
  const routerSrc = read("admin-ai-secretary-google-chat-router.js");
  const phase2 = read("admin-ai-secretary-phase2.js");
  const html = read("admin-operations-dashboard.html");
  const Router = loadRouterForUnit();

  if (/TasuSecretaryGoogleChatRouter/.test(routerSrc) && /tryHandle/.test(routerSrc)) {
    ok("router module surface");
  } else bad("router module surface");

  if (!/postGmailWrite|enqueueDraft|enqueueCalendar|calendar_write|gmail_write/.test(routerSrc)) {
    ok("router no write client references");
  } else bad("router no write client references");

  if (/GoogleChatRouter\.tryHandle/.test(phase2) && /googleHandled/.test(phase2)) {
    ok("phase2 google hook");
  } else bad("phase2 google hook");

  if (/admin-ai-secretary-google-chat-router\.js/.test(html)) {
    ok("dashboard router script tag");
  } else bad("dashboard router script tag");

  const cases = [
    ["未読メールある？", "gmail_unread"],
    ["今日の予定は？", "calendar_today"],
    ["明日の予定教えて", "calendar_tomorrow"],
    ["今週の予定", "calendar_week"],
    ["田中さんからメール来てる？", "gmail_search"],
    ["昨日のメール要約して", "gmail_summarize"],
    ["予定を追加して", "write_blocked"],
    ["Builder の CI 状況", "none"],
  ];

  for (const [text, expected] of cases) {
    const { intent } = Router.matchIntent(text);
    if (intent === expected) ok(`matchIntent: ${expected}`);
    else bad(`matchIntent: ${expected}`, `got ${intent}`);
  }
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
      const unread = /is:unread|unread/i.test(q) || !q;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mock: true,
          messages: unread
            ? [
                {
                  id: "m1",
                  subject: "未読テスト",
                  from: "sender@example.com",
                  snippet: "hello unread",
                  date: new Date().toISOString(),
                  unread: true,
                  threadId: "t1",
                },
              ]
            : [
                {
                  id: "m2",
                  subject: "田中さんから",
                  from: "tanaka@example.com",
                  snippet: "見積の件",
                  date: new Date().toISOString(),
                  unread: false,
                  threadId: "t2",
                },
              ],
        }),
      });
    }

    if (fn === "secretary-google-tools" && action === "calendar_read" && body.method === "events.list") {
      const preset = String(body.preset || "today");
      const title =
        preset === "tomorrow" ? "明日MTG" : preset === "this_week" ? "週次定例" : preset === "next_7_days" ? "検索ヒット" : "今日のStandup";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mock: true,
          events: [
            {
              id: `e_${preset}`,
              calendarId: "primary",
              title,
              start: new Date().toISOString(),
              end: new Date(Date.now() + 3600000).toISOString(),
              allDay: false,
              location: "Online",
              status: "confirmed",
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
      });

      await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

      try {
        const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
        if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
        else bad(`${tag} HTTP 200`, String(resp?.status()));

        await page.waitForFunction(
          () =>
            window.TasuSecretaryGoogleChatRouter &&
            window.TasuAdminAiSecretaryPhase2 &&
            document.querySelector("[data-ops-secretary-input]"),
          { timeout: 30000 }
        );

        fetchCalls.length = 0;
        await sendChat(page, "未読メールある？");
        let assistant = await lastAssistantText(page);
        const disconnectedUnread = /未接続|OAuth/.test(assistant);
        const toolsWhileDisconnected = fetchCalls.filter((c) => c.action === "gmail" || c.action === "calendar_read");
        if (disconnectedUnread) ok(`${tag} unread disconnected guidance`);
        else bad(`${tag} unread disconnected guidance`, assistant.slice(0, 80));
        if (toolsWhileDisconnected.length === 0) ok(`${tag} disconnected no google tools API`);
        else bad(`${tag} disconnected no google tools API`, String(toolsWhileDisconnected.length));

        fetchCalls.length = 0;
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
          const action = String(body.action || "");
          const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";
          if (fn === "secretary-google-oauth" && action === "status") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ ok: true, connected: true, mock: true, configured: true }),
            });
          }
          return mockToolsRoute(fetchCalls)(route);
        });

        const connectedCases = [
          ["未読メールある？", /未読|見つかりません/, "unread"],
          ["今日の予定は？", /今日の予定|Standup|件/, "today"],
          ["明日の予定教えて", /明日|MTG|件/, "tomorrow"],
          ["今週の予定", /今週|週次|件/, "week"],
          ["田中さんからメール来てる？", /田中|メール|件/, "from"],
          ["昨日のメール要約して", /メール|要約|件|見つかり/, "summarize"],
        ];

        for (const [q, pattern] of connectedCases) {
          fetchCalls.length = 0;
          await sendChat(page, q);
          assistant = await lastAssistantText(page);
          if (pattern.test(assistant)) ok(`${tag} connected: ${q.slice(0, 12)}`);
          else bad(`${tag} connected: ${q.slice(0, 12)}`, assistant.slice(0, 100));
          const writeCalls = fetchCalls.filter((c) => c.action === "gmail_write" || c.action === "calendar_write");
          if (writeCalls.length === 0) ok(`${tag} no write API: ${q.slice(0, 10)}`);
          else bad(`${tag} no write API: ${q.slice(0, 10)}`, String(writeCalls.length));
        }

        fetchCalls.length = 0;
        await sendChat(page, "予定を追加して");
        assistant = await lastAssistantText(page);
        if (/read-only|未対応|実行は未対応/.test(assistant)) ok(`${tag} write intent blocked`);
        else bad(`${tag} write intent blocked`, assistant.slice(0, 100));
        const writeBlockedCalls = fetchCalls.filter((c) => c.action === "gmail_write" || c.action === "calendar_write");
        if (writeBlockedCalls.length === 0) ok(`${tag} write blocked no write API`);
        else bad(`${tag} write blocked no write API`);

        fetchCalls.length = 0;
        await sendChat(page, "Builder の CI 失敗状況を教えて");
        assistant = await lastAssistantText(page);
        const googleToolsOnFallback = fetchCalls.filter((c) => c.action === "gmail" || c.action === "calendar_read");
        if (googleToolsOnFallback.length === 0) ok(`${tag} non-google no tools API`);
        else bad(`${tag} non-google no tools API`, String(googleToolsOnFallback.length));
        if (/Builder|CI|秘書|運営/.test(assistant)) ok(`${tag} non-google generic chat path`);
        else bad(`${tag} non-google generic chat path`, assistant.slice(0, 100));

        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 8000));
        if (!SECRET_RE.test(bodyText)) ok(`${tag} DOM no secrets`);
        else bad(`${tag} DOM no secrets`);
        if (jsErrors.length === 0) ok(`${tag} JS fatal 0`);
        else bad(`${tag} JS fatal 0`, jsErrors.join(" | "));
      } finally {
        await page.close();
      }
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Chat Phase 3a — unit ===");
  runUnitTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Chat Phase 3a — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Chat Phase 3a: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
