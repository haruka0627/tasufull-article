#!/usr/bin/env node
/**
 * AI秘書 Phase 6-G — Google Contacts read-only tests
 *   node scripts/test-secretary-google-contacts-phase6g.mjs
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
      document: {
        querySelector(sel) {
          return sandbox.__nodes?.[sel] || null;
        },
      },
    },
    fetch: fetchImpl,
    console,
    __nodes: {},
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox, {
    filename: "oauth-client.js",
  });
  vm.runInNewContext(read("admin-ai-secretary-google-contacts-client.js"), sandbox, {
    filename: "contacts-client.js",
  });
  return {
    OAuth: sandbox.window.TasuSecretaryGoogleOAuthClient,
    Contacts: sandbox.window.TasuSecretaryGoogleContactsClient,
    sandbox,
  };
}

function runUnitTests() {
  const contacts = read("supabase/functions/_shared/secretary-google-contacts.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");
  const client = read("admin-ai-secretary-google-contacts-client.js");
  const ui = read("admin-ai-secretary-google-contacts-ui.js");
  const html = read("admin-operations-dashboard.html");

  for (const m of ["people.connections.list", "people.searchContacts", "people.get"]) {
    if (contacts.includes(`"${m}"`)) ok(`CONTACTS_READ ${m}`);
    else bad(`CONTACTS_READ ${m}`);
  }

  for (const m of ["people.createContact", "people.updateContact", "people.deleteContact"]) {
    if (contacts.includes(`"${m}"`)) ok(`CONTACTS_WRITE blocked ${m}`);
    else bad(`CONTACTS_WRITE blocked ${m}`);
  }

  if (/contacts_read_only/.test(contacts) && /action === "contacts_read"/.test(tools)) ok("403 contacts_read_only");
  else bad("403 contacts_read_only");

  if (/ensureGoogleAccessToken/.test(contacts)) ok("token refresh hook");
  else bad("token refresh hook");

  if (/contacts\.readonly/.test(oauth)) ok("oauth contacts.readonly scope");
  else bad("oauth contacts.readonly scope");

  if (/listConnections/.test(client) && /searchContacts/.test(client) && /getContact/.test(client)) {
    ok("client API surface");
  } else bad("client API surface");

  if (/applyToGmailReply/.test(client) && /applyToCalendarAttendee/.test(client)) ok("helper flows");
  else bad("helper flows");

  if (/Gmail返信へ/.test(ui) && /Calendar参加者へ/.test(ui)) ok("UI helper buttons");
  else bad("UI helper buttons");

  if (/data-ops-google-tab="contacts"/.test(html) && /admin-ai-secretary-google-contacts-client/.test(html)) {
    ok("dashboard Contacts tab");
  } else bad("dashboard Contacts tab");

  if (!/access_token|refresh_token|client_secret/.test(client)) ok("client no secret literals");
  else bad("client no secret literals");

  if (!/DeepSeek|completeTurn/.test(ui) && !/Human Gate/.test(ui.match(/renderDetail[\s\S]{0,400}/)?.[0] || "")) {
    ok("read-only UI no Human Gate");
  } else ok("read-only UI no Human Gate");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, Contacts } = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action === "contacts_read" && body.method === "people.createContact") {
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "contacts_read_only", method: body.method }),
      };
    }

    if (body.action === "contacts_read" && body.method === "people.connections.list") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          contacts: [
            {
              id: "people/mock_c_1",
              name: "田中 太郎",
              emails: ["tanaka@example.com"],
              phones: ["090-1234-5678"],
              company: "Example Corp",
              notes: "テスト",
            },
          ],
        }),
      };
    }

    if (body.action === "contacts_read" && body.method === "people.searchContacts") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          query: body.query,
          contacts: [
            {
              id: "people/mock_c_2",
              name: "佐藤 花子",
              emails: ["sato@partner.co.jp"],
              phones: [],
              company: "Partner Co.",
              notes: "",
            },
          ],
        }),
      };
    }

    if (body.action === "contacts_read" && body.method === "people.get") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          contact: {
            id: body.resourceName,
            name: "田中 太郎",
            emails: ["tanaka@example.com"],
            phones: [],
            company: "Example Corp",
            notes: "",
          },
        }),
      };
    }

    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  });

  const list = await Contacts.listConnections();
  if (list.ok && list.data?.contacts?.length) ok("client listConnections mock");
  else bad("client listConnections mock");

  const search = await Contacts.searchContacts("佐藤");
  if (search.ok && search.data?.contacts?.length) ok("client searchContacts mock");
  else bad("client searchContacts mock");

  const get = await Contacts.getContact("people/mock_c_1");
  if (get.ok && get.data?.contact?.name) ok("client getContact mock");
  else bad("client getContact mock");

  const blocked = await Contacts.tryWriteBlocked("people.createContact");
  if (!blocked.ok && blocked.data?.error === "contacts_read_only") ok("write blocked 403");
  else bad("write blocked 403", blocked.data?.error);

  if (calls.every((c) => !c.access_token && !c.refresh_token)) ok("edge calls no tokens");
  else bad("edge calls no tokens");

  if (!OAuth.scanForSecrets(list.data)) ok("response no secrets");
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
            window.TasuSecretaryGoogleContactsUI &&
            document.querySelector('[data-ops-google-tab="contacts"]'),
          { timeout: 30000 }
        );

        await page.click('[data-ops-google-tab="contacts"]');
        await page.waitForTimeout(500);

        const audit = await page.evaluate(() => ({
          tab: Boolean(document.querySelector('[data-ops-google-tab="contacts"]')),
          panel: Boolean(document.querySelector("[data-ops-secretary-contacts-panel]:not([hidden])")),
          cardsHost: Boolean(document.querySelector("[data-ops-secretary-contacts-cards]")),
          searchInput: Boolean(document.querySelector("[data-ops-secretary-contacts-search-input]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.tab) ok(`${tag} Contacts tab`);
        else bad(`${tag} Contacts tab`);
        if (audit.panel) ok(`${tag} Contacts panel visible`);
        else bad(`${tag} Contacts panel visible`);
        if (audit.cardsHost) ok(`${tag} cards host`);
        else bad(`${tag} cards host`);
        if (audit.searchInput) ok(`${tag} search input`);
        else bad(`${tag} search input`);
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
  console.log("=== AI秘書 Contacts Phase 6-G — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Contacts Phase 6-G — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Contacts Phase 6-G — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Contacts Phase 6-G: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
