#!/usr/bin/env node
/**
 * AI秘書 Phase 6-E — Google Calendar read-only tests
 *   node scripts/test-secretary-google-calendar-phase6e.mjs
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
    filename: "oauth-client.js",
  });
  vm.runInNewContext(read("admin-ai-secretary-google-calendar-client.js"), sandbox, {
    filename: "calendar-client.js",
  });
  return {
    OAuth: sandbox.window.TasuSecretaryGoogleOAuthClient,
    Calendar: sandbox.window.TasuSecretaryGoogleCalendarClient,
  };
}

function runUnitTests() {
  const cal = read("supabase/functions/_shared/secretary-google-calendar.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");
  const client = read("admin-ai-secretary-google-calendar-client.js");
  const ui = read("admin-ai-secretary-google-calendar-ui.js");
  const html = read("admin-operations-dashboard.html");

  for (const m of ["calendarList.list", "events.list", "events.get"]) {
    if (cal.includes(`"${m}"`)) ok(`CALENDAR_READ ${m}`);
    else bad(`CALENDAR_READ ${m}`);
  }

  for (const p of ["today", "tomorrow", "this_week", "next_7_days"]) {
    if (cal.includes(`"${p}"`) || cal.includes(p)) ok(`preset ${p}`);
    else bad(`preset ${p}`);
  }

  for (const m of ["events.insert", "events.update", "events.delete", "calendars.clear"]) {
    if (cal.includes(`"${m}"`)) ok(`CALENDAR_WRITE blocked ${m}`);
    else bad(`CALENDAR_WRITE blocked ${m}`);
  }

  if (/calendar_read_only/.test(cal) && /calendar_read_only/.test(tools)) ok("403 calendar_read_only");
  else bad("403 calendar_read_only");

  if (/ensureGoogleAccessToken/.test(cal)) ok("token refresh hook");
  else bad("token refresh hook");

  if (/pageToken|nextPageToken/.test(cal)) ok("pagination support");
  else bad("pagination support");

  if (/calendar\.readonly/.test(oauth)) ok("oauth calendar.readonly scope");
  else bad("oauth calendar.readonly scope");

  if (/action === "calendar_read"/.test(tools)) ok("tools calendar_read route");
  else bad("tools calendar_read route");

  if (/listCalendars/.test(client) && /listEvents/.test(client) && /getEvent/.test(client)) {
    ok("client API surface");
  } else bad("client API surface");

  if (/今日の予定/.test(ui) && /renderDetail/.test(ui)) ok("UI presets + detail");
  else bad("UI presets + detail");

  if (/data-ops-google-tab="calendar"/.test(html) && /admin-ai-secretary-google-calendar-client/.test(html)) {
    ok("dashboard Mail/Calendar tabs");
  } else bad("dashboard Mail/Calendar tabs");

  if (!/access_token|refresh_token|client_secret/.test(client)) ok("client no secret literals");
  else bad("client no secret literals");

  if (!/DeepSeek|completeTurn/.test(client) && !/DeepSeek|completeTurn/.test(ui)) ok("no DeepSeek in calendar");
  else bad("no DeepSeek in calendar");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, Calendar } = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action !== "calendar_read") {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }

    const method = body.method;
    if (method === "events.insert" || method === "events.delete") {
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "calendar_read_only", method }),
      };
    }
    if (method === "calendarList.list") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          calendars: [{ id: "primary", summary: "Main" }],
          nextPageToken: "page2",
        }),
      };
    }
    if (method === "events.list") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          preset: body.preset,
          events: [
            {
              id: "evt1",
              calendarId: "primary",
              calendarName: "Main",
              title: "Standup",
              start: new Date().toISOString(),
              end: new Date(Date.now() + 3600000).toISOString(),
              allDay: false,
              location: "Online",
              attendeeCount: 2,
              status: "confirmed",
            },
          ],
          nextPageToken: null,
        }),
      };
    }
    if (method === "events.get") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          event: { id: body.eventId, title: "Detail", calendarName: "Main", status: "confirmed" },
        }),
      };
    }
    return { ok: false, status: 400, json: async () => ({ ok: false, error: "unknown" }) };
  });

  const cals = await Calendar.listCalendars();
  if (cals.ok && cals.data?.calendars?.length) ok("client listCalendars mock");
  else bad("client listCalendars mock");

  for (const preset of ["today", "tomorrow", "this_week", "next_7_days"]) {
    const res = await Calendar.listEvents({ preset });
    if (res.ok && res.data?.events?.length) ok(`client listEvents ${preset}`);
    else bad(`client listEvents ${preset}`);
  }

  const kw = await Calendar.listEvents({ preset: "next_7_days", q: "Standup" });
  if (kw.ok) ok("client keyword search");
  else bad("client keyword search");

  const detail = await Calendar.getEvent("primary", "evt1");
  if (detail.ok && detail.data?.event?.id) ok("client getEvent mock");
  else bad("client getEvent mock");

  const blocked = await Calendar.tryWriteBlocked("events.insert");
  if (!blocked.ok && blocked.data?.error === "calendar_read_only") ok("write blocked 403");
  else bad("write blocked 403", blocked.data?.error);

  const page2 = await Calendar.listCalendars({ pageToken: "page2" });
  if (page2.ok) ok("pagination pageToken forwarded");
  else bad("pagination pageToken forwarded");

  if (calls.every((c) => c.action === "calendar_read" && !c.access_token)) ok("edge proxy only");
  else bad("edge proxy only");

  if (!OAuth.scanForSecrets(cals.data)) ok("response no secrets");
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
            document.querySelector("[data-ops-secretary-calendar-panel]") &&
            document.querySelector('[data-ops-google-tab="calendar"]'),
          { timeout: 30000 }
        );

        await page.click('[data-ops-google-tab="calendar"]');
        await page.waitForTimeout(800);

        const audit = await page.evaluate(() => ({
          tab: document.querySelector('[data-ops-google-tab="calendar"]')?.getAttribute("aria-selected"),
          panel: !document.querySelector("[data-ops-secretary-calendar-panel]")?.hidden,
          chips: document.querySelectorAll("[data-ops-secretary-calendar-preset]").length,
          cardsHost: Boolean(document.querySelector("[data-ops-secretary-calendar-cards]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.tab === "true") ok(`${tag} Calendar tab`);
        else bad(`${tag} Calendar tab`, audit.tab);
        if (audit.panel) ok(`${tag} Calendar panel visible`);
        else bad(`${tag} Calendar panel visible`);
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
  console.log("=== AI秘書 Calendar Phase 6-E — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Calendar Phase 6-E — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Calendar Phase 6-E — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Calendar Phase 6-E: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
