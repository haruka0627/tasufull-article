#!/usr/bin/env node
/**
 * AI秘書 — Google Integration Phase 4-T1 (Gmail reply templates)
 *   node scripts/test-secretary-google-phase4-t1-reply-templates.mjs
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

const INTERNAL_MSG_ID = "phase4t1_internal_msg_001";

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
    location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
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
  win.TasuSecretaryGoogleReadonlyCoordinator = {
    getState: () => ({ connected: true, mock: true, configured: true }),
  };

  const sandbox = {
    window: win,
    global: win,
    document: win.document,
    location: win.location,
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
  vm.runInContext(read("admin-ai-secretary-google-reply-templates.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-write-bridge.js"), sandbox);
  vm.runInContext(read("admin-ai-secretary-google-chat-router.js"), sandbox);

  return {
    Unified: win.TasuSecretaryGoogleChatContext,
    Templates: win.TasuSecretaryGoogleReplyTemplates,
    Bridge: win.TasuSecretaryGoogleChatWriteBridge,
    Router: win.TasuSecretaryGoogleChatRouter,
    HSG: win.TasuAdminAiHumanSendGate,
  };
}

function seedFocus(Unified) {
  Unified.saveGmailFocus(
    {
      id: INTERNAL_MSG_ID,
      threadId: "phase4t1_thread_001",
      subject: "サービス相談の問い合わせ",
      from: "customer@example.com",
      snippet: "条件に合う業者を探したい",
      bodyText: "地域と予算の詳細を相談したい",
    },
    { index: 1 }
  );
}

function runUnitTests() {
  const routerSrc = read("admin-ai-secretary-google-chat-router.js");
  const tplSrc = read("admin-ai-secretary-google-reply-templates.js");

  if (/context_reply_template|runContextReplyTemplate/.test(routerSrc)) ok("router template intent");
  else bad("router template intent");

  if (/TasfulAiGuidance|tasful_ai_guidance|assignee_followup|receipt_ack|detail_request/.test(tplSrc)) {
    ok("templates four kinds");
  } else bad("templates four kinds");

  if (!/\bexecuteWriteApproved\b/.test(routerSrc) && !/\bexecuteWriteApproved\b/.test(tplSrc)) {
    ok("no executeWriteApproved in router/templates");
  } else bad("no executeWriteApproved in router/templates");

  const { Unified, Templates, Router, HSG } = loadFullStack();
  HSG.clearForTests?.();
  seedFocus(Unified);

  const cases = [
    ["TASFUL AIに誘導して", "tasful_ai_guidance"],
    ["担当確認で返して", "assignee_followup"],
    ["受付テンプレで返して", "receipt_ack"],
    ["詳細聞いて", "detail_request"],
  ];

  for (const [text, expectedId] of cases) {
    const intent = Router.matchIntent(text, { history: [] });
    if (intent.intent === "context_reply_template") ok(`matchIntent ${expectedId}`);
    else bad(`matchIntent ${expectedId}`, intent.intent);

    const built = Templates.buildReplyBody(expectedId);
    if (built.body && built.label) ok(`body ${expectedId}`);
    else bad(`body ${expectedId}`);
  }

  Unified.clear?.();
  const noCtxIntent = Router.matchIntent("テンプレで返信して", { history: [] });
  if (noCtxIntent.intent !== "context_reply_template") ok("matchIntent no focus not template");
  else bad("matchIntent no focus not template");
}

async function runFlowTests() {
  const { Unified, Router, Bridge, HSG } = loadFullStack();
  HSG.clearForTests?.();
  seedFocus(Unified);

  const tasful = await Router.tryHandle("TASFUL AIに誘導して", { history: [] });
  if (tasful.handled && /TASFUL AI|ai-workspace\.html/.test(tasful.reply || "")) ok("flow tasful template reply");
  else bad("flow tasful template reply", (tasful.reply || "").slice(0, 80));

  if (Unified.hasReplyPlan?.()) ok("flow tasful replyPlan saved");
  else bad("flow tasful replyPlan saved");

  const plan = Unified.getReplyPlanRef?.();
  if (plan?.body && plan?.recipient && !("id" in (Unified.getReplyPlanPreview?.() || {}))) {
    ok("replyPlan preview no internal id");
  } else bad("replyPlan preview no internal id");

  Unified.clear?.();
  seedFocus(Unified);

  const assignee = await Router.tryHandle("担当確認で返して", { history: [] });
  if (/担当より改めて/.test(assignee.reply || "")) ok("flow assignee template");
  else bad("flow assignee template");

  Unified.clear?.();
  seedFocus(Unified);

  const receipt = await Router.tryHandle("受付テンプレで返して", { history: [] });
  if (/受付いたしました/.test(receipt.reply || "")) ok("flow receipt template");
  else bad("flow receipt template");

  Unified.clear?.();
  seedFocus(Unified);

  const detail = await Router.tryHandle("詳細聞いて", { history: [] });
  if (/希望条件|予算|希望時期/.test(detail.reply || "")) ok("flow detail template");
  else bad("flow detail template");

  Unified.clear?.();
  const noFocus = await Router.tryHandle("テンプレで返信して", { history: [] });
  if (!noFocus.handled || /直近|先に|ありません/.test(noFocus.reply || "")) ok("flow no focus safe reply");
  else bad("flow no focus safe reply", noFocus.intent || (noFocus.reply || "").slice(0, 60));

  Unified.clear?.();
  seedFocus(Unified);
  await Router.tryHandle("TASFUL AIに誘導して", { history: [] });

  const enq = Bridge.enqueueGmailDraftFromChat("下書き保存して");
  if (enq.ok && enq.enqueued) ok("draft enqueue from template replyPlan");
  else bad("draft enqueue from template replyPlan", enq.error || enq.reply?.slice(0, 60));

  const pending = HSG.readPendingQueue?.() || [];
  if (pending.length === 1 && pending[0]?.payload?.gmailAction === "draft_create") ok("HSG draft pending from template");
  else bad("HSG draft pending from template", String(pending.length));

  const blocked = Router.matchIntent("メールを送信して", { history: [] });
  if (blocked.intent === "write_blocked") ok("send intent still blocked");
  else bad("send intent still blocked", blocked.intent);
}

const MOCK_LIST = [
  {
    id: INTERNAL_MSG_ID,
    threadId: "phase4t1_thread_001",
    subject: "サービス相談",
    from: "customer@example.com",
    snippet: "業者を探したい",
    date: new Date().toISOString(),
    unread: true,
  },
];

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
    const fn = req.url().split("/functions/v1/")[1]?.split("?")[0] || "";

    if (fn === "secretary-google-oauth" && body.action === "status") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, connected: true, mock: true, configured: true }),
      });
    }

    if (fn === "secretary-google-tools" && body.action === "gmail" && body.method === "messages.list") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mock: true, messages: MOCK_LIST }),
      });
    }

    if (fn === "secretary-google-tools" && body.action === "gmail" && body.method === "messages.get") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mock: true,
          message: {
            id: INTERNAL_MSG_ID,
            subject: "サービス相談",
            from: "customer@example.com",
            snippet: "業者を探したい",
            threadId: "phase4t1_thread_001",
            bodyText: "条件を教えてください",
            bodyTruncated: false,
            hasAttachment: false,
            attachments: [],
          },
        }),
      });
    }

    if (fn === "secretary-google-tools" && body.action === "gmail_write") {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "write_should_not_run_in_t1" }),
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
        if (/phase4t1_internal_msg/.test(t)) jsErrors.push(`id leak: ${t.slice(0, 60)}`);
      });

      await page.route("**/functions/v1/**", mockToolsRoute(fetchCalls));

      const resp = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
      const tag = `${w}x${h}`;
      if ((resp?.status() ?? 0) === 200) ok(`${tag} HTTP 200`);
      else bad(`${tag} HTTP 200`, String(resp?.status()));

      await page.waitForFunction(
        () =>
          window.TasuSecretaryGoogleReplyTemplates &&
          window.TasuSecretaryGoogleChatRouter &&
          window.TasuSecretaryGoogleChatWriteBridge,
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
      await sendChat(page, "TASFUL AIに誘導して");

      const state = await page.evaluate(() => {
        const nodes = document.querySelectorAll(
          "#ops-ai-command-center [data-ops-phase2-chat-log] [data-ops-chat-role='assistant']"
        );
        const assistant = (nodes[nodes.length - 1]?.textContent || "").trim();
        return {
          assistant: assistant.slice(0, 500),
          lastIntent: window.TasuSecretaryGoogleChatContext?.getLastTurn?.()?.sourceIntent || "",
          planPreview: window.TasuSecretaryGoogleChatContext?.getReplyPlanPreview?.()?.bodyPreview || "",
        };
      });

      if (
        state.lastIntent === "context_reply_template" ||
        /テンプレ|TASFUL AI|ai-workspace|お問い合わせありがとう/.test(state.assistant) ||
        /お問い合わせありがとう|TASFUL AI/.test(state.planPreview)
      ) {
        ok(`${tag} browser template reply`);
      } else bad(`${tag} browser template reply`, state.assistant.slice(0, 80));

      const hasPlan = await page.evaluate(() => window.TasuSecretaryGoogleChatContext?.hasReplyPlan?.());
      if (hasPlan) ok(`${tag} browser replyPlan saved`);
      else bad(`${tag} browser replyPlan saved`);

      fetchCalls.length = 0;
      await sendChat(page, "下書き保存して");

      const writeCalls = fetchCalls.filter((c) => c.action === "gmail_write");
      if (writeCalls.length === 0) ok(`${tag} gmail_write 0`);
      else bad(`${tag} gmail_write 0`, String(writeCalls.length));

      const audit = await page.evaluate(() => ({
        pending: (window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || []).length,
        chat: (
          document.querySelector("#ops-ai-command-center [data-ops-phase2-chat-log]")?.textContent || ""
        ).slice(0, 8000),
      }));

      if (audit.pending >= 1) ok(`${tag} draft HSG pending from template`);
      else bad(`${tag} draft HSG pending from template`);

      if (!/phase4t1_internal_msg/.test(audit.chat)) ok(`${tag} chat no id leak`);
      else bad(`${tag} chat no id leak`);

      if (jsErrors.length === 0) ok(`${tag} JS fatal 0`);
      else bad(`${tag} JS fatal 0`, jsErrors.join(" | "));

      await page.close();
    }
  });
}

async function main() {
  console.log("=== AI秘書 Google Phase 4-T1 — unit ===");
  runUnitTests();

  console.log("\n=== AI秘書 Google Phase 4-T1 — flow ===");
  await runFlowTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Google Phase 4-T1 — browser @ ${base} ===`);
    await runBrowserIntegration(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
    bad("browser 8788 available", err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== AI秘書 Google Phase 4-T1: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
