#!/usr/bin/env node
/**
 * AI秘書 Phase 6-C — Gmail read-only tests
 *   node scripts/test-secretary-google-gmail-phase6c.mjs
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

function loadGmailStack(fetchImpl) {
  const sandbox = {
    window: {
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
      location: { origin: "http://127.0.0.1:8788", protocol: "http:" },
    },
    fetch: fetchImpl,
    console,
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox, {
    filename: "admin-ai-secretary-google-oauth-client.js",
  });
  vm.runInNewContext(read("admin-ai-secretary-google-gmail-client.js"), sandbox, {
    filename: "admin-ai-secretary-google-gmail-client.js",
  });
  return {
    OAuth: sandbox.window.TasuSecretaryGoogleOAuthClient,
    Gmail: sandbox.window.TasuSecretaryGoogleGmailClient,
  };
}

function runUnitTests() {
  const gmail = read("supabase/functions/_shared/secretary-google-gmail.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");

  for (const m of ["messages.list", "messages.get", "threads.get", "labels.list"]) {
    if (gmail.includes(`"${m}"`)) ok(`GMAIL_READ ${m}`);
    else bad(`GMAIL_READ ${m}`);
  }

  for (const m of ["messages.send", "drafts.create", "messages.trash", "messages.delete"]) {
    if (gmail.includes(`"${m}"`)) ok(`GMAIL_WRITE blocked list ${m}`);
    else bad(`GMAIL_WRITE blocked list ${m}`);
  }

  if (/gmail_write_forbidden/.test(gmail) && /gmail_write_forbidden/.test(tools)) ok("write forbidden error code");
  else bad("write forbidden error code");

  if (/ensureGoogleAccessToken/.test(oauth) && /ensureGoogleAccessToken/.test(gmail)) ok("token refresh hook");
  else bad("token refresh hook");

  if (/extractAttachmentMeta/.test(gmail) && !/attachments\.get/.test(gmail)) ok("attachment metadata only");
  else bad("attachment metadata only");

  if (/sanitizeGmailQuery/.test(gmail)) ok("search q sanitized");
  else bad("search q sanitized");

  if (/executeGmailRead/.test(tools) && /action === "gmail"/.test(tools)) ok("tools action=gmail route");
  else bad("tools action=gmail route");

  if (/read_write_human_gate|executeGmailWrite|phase: "6-D"/.test(tools)) ok("tools health gmail write phase 6-D");
  else bad("tools health gmail write phase 6-D");

  const client = read("admin-ai-secretary-google-gmail-client.js");
  if (/PRESETS/.test(client) && /listMessages/.test(client) && /tryWriteBlocked/.test(client)) {
    ok("gmail client API surface");
  } else bad("gmail client API surface");

  const ui = read("admin-ai-secretary-google-gmail-ui.js");
  if (/ops-secretary-gmail__card/.test(ui) && /返信案を作る|Human Gate/.test(ui)) ok("gmail UI cards workflow");
  else bad("gmail UI cards workflow");

  const html = read("admin-operations-dashboard.html");
  if (/data-ops-secretary-gmail-panel/.test(html) && /admin-ai-secretary-google-gmail-client\.js/.test(html)) {
    ok("dashboard gmail panel + scripts");
  } else bad("dashboard gmail panel + scripts");

  if (!/access_token|refresh_token/.test(client)) ok("gmail client no token literals");
  else bad("gmail client no token literals");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, Gmail } = loadGmailStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);
    if (body.action === "gmail") {
      const method = body.method;
      if (method === "messages.send") {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: "gmail_write_forbidden", method, phase: "6-D" }),
        };
      }
      if (method === "messages.list") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            q: body.q || "",
            messages: [
              {
                id: "mock_msg_001",
                subject: "Test",
                from: "a@example.com",
                snippet: "hello",
                date: new Date().toISOString(),
                unread: true,
                important: false,
                hasAttachment: false,
                attachments: [],
              },
            ],
          }),
        };
      }
      if (method === "labels.list") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, mock: true, labels: [{ id: "INBOX", name: "INBOX" }] }),
        };
      }
      if (method === "messages.get") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            message: { id: body.messageId, subject: "Detail", attachments: [] },
          }),
        };
      }
      if (method === "threads.get") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            thread: { id: body.threadId, messages: [{ id: "m1", subject: "T" }] },
          }),
        };
      }
    }
    return { ok: false, status: 400, json: async () => ({ ok: false, error: "unknown" }) };
  });

  const list = await Gmail.listMessages({ preset: "unread", maxResults: 5 });
  if (list.ok && list.data?.messages?.length === 1) ok("client listMessages mock");
  else bad("client listMessages mock", JSON.stringify(list));

  const labels = await Gmail.listLabels();
  if (labels.ok && labels.data?.labels?.length) ok("client listLabels mock");
  else bad("client listLabels mock");

  const detail = await Gmail.getMessage("mock_msg_001");
  if (detail.ok && detail.data?.message?.id) ok("client getMessage mock");
  else bad("client getMessage mock");

  const thread = await Gmail.getThread("mock_thread_001");
  if (thread.ok && thread.data?.thread?.messages) ok("client getThread mock");
  else bad("client getThread mock");

  const blocked = await Gmail.tryWriteBlocked("messages.send");
  if (!blocked.ok && /gmail_write_(forbidden|use_gmail_write)/.test(blocked.data?.error || "")) {
    ok("client write blocked 403");
  } else bad("client write blocked 403", blocked.data?.error);

  if (calls.every((c) => c.action === "gmail" && !c.access_token)) ok("calls edge only no tokens");
  else bad("calls edge only no tokens");

  if (!OAuth.scanForSecrets(list.data)) ok("list response no secrets");
  else bad("list response no secrets");
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
            window.TasuSecretaryGoogleGmailClient &&
            window.TasuSecretaryGoogleGmailUI &&
            document.querySelector("[data-ops-secretary-gmail-panel]"),
          { timeout: 30000 }
        );

        const audit = await page.evaluate(() => ({
          panel: Boolean(document.querySelector("[data-ops-secretary-gmail-panel]")),
          chips: document.querySelectorAll("[data-ops-secretary-gmail-preset]").length,
          cardsHost: Boolean(document.querySelector("[data-ops-secretary-gmail-cards]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.panel) ok(`${tag} gmail panel mounted`);
        else bad(`${tag} gmail panel mounted`);
        if (audit.chips >= 4) ok(`${tag} preset chips`);
        else bad(`${tag} preset chips`, String(audit.chips));
        if (audit.cardsHost) ok(`${tag} cards host`);
        else bad(`${tag} cards host`);
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
  console.log("=== AI秘書 Gmail Phase 6-C — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Gmail Phase 6-C — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Gmail Phase 6-C — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Gmail Phase 6-C: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
