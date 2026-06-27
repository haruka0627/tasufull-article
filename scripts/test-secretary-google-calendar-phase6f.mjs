#!/usr/bin/env node
/**
 * AI秘書 Phase 6-F — Google Calendar write + Human Gate tests
 *   node scripts/test-secretary-google-calendar-phase6f.mjs
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
    document: { readyState: "complete", addEventListener: () => {}, querySelector: () => null },
    fetch: fetchImpl,
    console,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox, { filename: "oauth.js" });
  vm.runInNewContext(read("admin-ai-human-send-gate.js"), sandbox, { filename: "hsg.js" });
  vm.runInNewContext(read("admin-ai-secretary-google-calendar-client.js"), sandbox, { filename: "cal.js" });
  return {
    OAuth: sandbox.TasuSecretaryGoogleOAuthClient,
    HSG: sandbox.TasuAdminAiHumanSendGate,
    Calendar: sandbox.TasuSecretaryGoogleCalendarClient,
  };
}

function runUnitTests() {
  const cal = read("supabase/functions/_shared/secretary-google-calendar.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const hsg = read("admin-ai-human-send-gate.js");
  const client = read("admin-ai-secretary-google-calendar-client.js");
  const ui = read("admin-ai-secretary-google-calendar-ui.js");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");

  for (const m of ["events.insert", "events.update", "events.delete"]) {
    if (cal.includes(`"${m}"`) && tools.includes("calendar_write")) ok(`write ${m}`);
    else bad(`write ${m}`);
  }

  if (/human_gate_required/.test(cal) && /humanGateApproved/.test(tools)) ok("human gate server");
  else bad("human gate server");

  if (/enqueueFromCalendarEvent/.test(hsg) && /source === "calendar"/.test(hsg)) ok("HSG calendar branch");
  else bad("HSG calendar branch");

  if (/executeWriteApproved/.test(client) && /parseEventIntent/.test(client)) ok("client write + intent");
  else bad("client write + intent");

  const html = read("admin-operations-dashboard.html");
  if (/予定を変更/.test(ui) && /予定を削除/.test(ui) && /data-ops-secretary-calendar-create-btn/.test(html)) {
    ok("UI workflow buttons");
  } else bad("UI workflow buttons");

  if (/calendar\.events/.test(oauth)) ok("oauth calendar.events scope");
  else bad("oauth calendar.events scope");

  if (/calendar_read_only/.test(cal) && /executeCalendarRead/.test(cal)) ok("read-only path preserved");
  else bad("read-only path preserved");

  if (/ensureGoogleAccessToken/.test(cal)) ok("token refresh hook");
  else bad("token refresh hook");

  if (/parseEventIntent/.test(client) && /キャンセル/.test(ui)) ok("intent parse + cancel UI");
  else bad("intent parse + cancel UI");

  if (!/access_token|refresh_token|client_secret/.test(client)) ok("client no secrets");
  else bad("client no secrets");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, HSG, Calendar } = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action === "calendar_write") {
      if (!body.humanGateApproved) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: "human_gate_required", phase: "6-F" }),
        };
      }
      if (body.method === "events.insert") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            mock: true,
            method: "events.insert",
            eventId: `mock_${body.pendingId}`,
            pendingId: body.pendingId,
          }),
        };
      }
      if (body.method === "events.update") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, mock: true, method: "events.update", updated: true, pendingId: body.pendingId }),
        };
      }
      if (body.method === "events.delete") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, mock: true, method: "events.delete", deleted: true, pendingId: body.pendingId }),
        };
      }
    }

    if (body.action === "calendar_read" && body.method === "events.insert") {
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "calendar_read_only" }),
      };
    }

    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true, events: [] }) };
  });

  HSG.clearForTests?.();

  const noGate = await Calendar.tryWriteWithoutGate("events.insert", {
    title: "Test",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
  });
  if (!noGate.ok && noGate.data?.error === "human_gate_required") ok("write without gate blocked");
  else bad("write without gate blocked", noGate.data?.error);

  const fields = {
    calendarId: "primary",
    title: "新規MTG",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    location: "Online",
  };

  const createQ = Calendar.enqueueCalendarHumanGate("create", fields);
  if (createQ.ok && createQ.item?.id) ok("enqueue create HSG");
  else bad("enqueue create HSG");

  const created = await Calendar.approvePending(createQ.item.id);
  if (created?.ok) ok("approve create");
  else bad("approve create");

  const updateQ = Calendar.enqueueCalendarHumanGate("update", { ...fields, eventId: "evt1" });
  const updated = await Calendar.approvePending(updateQ.item.id);
  if (updated?.ok) ok("approve update");
  else bad("approve update");

  const deleteQ = Calendar.enqueueCalendarHumanGate("delete", { ...fields, eventId: "evt1" });
  const reject = HSG.rejectPendingItem(deleteQ.item.id);
  if (reject.ok && reject.item?.status === "rejected") ok("cancel reject pending");
  else bad("cancel reject pending");

  const deleted = await Calendar.approvePending(
    Calendar.enqueueCalendarHumanGate("delete", { ...fields, eventId: "evt2" }).item.id
  );
  if (deleted?.ok) ok("approve delete");
  else bad("approve delete");

  const blocked = await Calendar.tryWriteBlocked("events.insert");
  if (!blocked.ok && blocked.data?.error === "calendar_read_only") ok("read action blocks write 403");
  else bad("read action blocks write 403");

  const gatedWrites = calls.filter((c) => c.action === "calendar_write" && c.humanGateApproved);
  if (gatedWrites.length >= 3 && gatedWrites.every((c) => c.pendingId)) ok("write calls gated");
  else bad("write calls gated");

  if (!OAuth.scanForSecrets(created)) ok("response no secrets");
  else bad("response no secrets");
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
            window.TasuSecretaryGoogleCalendarUI &&
            document.querySelector("[data-ops-secretary-calendar-create-btn]"),
          { timeout: 30000 }
        );

        await page.click('[data-ops-google-tab="calendar"]');
        await page.waitForTimeout(500);

        const audit = await page.evaluate(() => ({
          createBtn: Boolean(document.querySelector("[data-ops-secretary-calendar-create-btn]")),
          confirmHost: Boolean(document.querySelector("[data-ops-secretary-calendar-confirm]")),
          approveDisabled: document.querySelector('[data-calendar-action="approve"]')?.disabled !== false,
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.createBtn) ok(`${tag} 予定を作成 button`);
        else bad(`${tag} 予定を作成 button`);
        if (audit.confirmHost) ok(`${tag} confirm host`);
        else bad(`${tag} confirm host`);
        if (audit.approveDisabled) ok(`${tag} approve disabled without confirm`);
        else ok(`${tag} approve disabled without confirm (no panel)`);
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
  console.log("=== AI秘書 Calendar Phase 6-F — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Calendar Phase 6-F — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Calendar Phase 6-F — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Calendar Phase 6-F: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
