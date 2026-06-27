#!/usr/bin/env node
/**
 * AI秘書 Phase 6-H — Google Drive read-only tests
 *   node scripts/test-secretary-google-drive-phase6h.mjs
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
      document: { querySelector: () => null },
    },
    fetch: fetchImpl,
    console,
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(read("admin-ai-secretary-google-oauth-client.js"), sandbox, {
    filename: "oauth-client.js",
  });
  vm.runInNewContext(read("admin-ai-secretary-google-drive-client.js"), sandbox, {
    filename: "drive-client.js",
  });
  return {
    OAuth: sandbox.window.TasuSecretaryGoogleOAuthClient,
    Drive: sandbox.window.TasuSecretaryGoogleDriveClient,
  };
}

function runUnitTests() {
  const drive = read("supabase/functions/_shared/secretary-google-drive.ts");
  const tools = read("supabase/functions/secretary-google-tools/index.ts");
  const oauth = read("supabase/functions/_shared/secretary-google-oauth.ts");
  const client = read("admin-ai-secretary-google-drive-client.js");
  const ui = read("admin-ai-secretary-google-drive-ui.js");
  const html = read("admin-operations-dashboard.html");

  for (const m of ["files.list", "files.get", "files.export"]) {
    if (drive.includes(`"${m}"`)) ok(`DRIVE_READ ${m}`);
    else bad(`DRIVE_READ ${m}`);
  }

  for (const m of ["files.create", "files.update", "files.delete", "permissions.create", "files.upload"]) {
    if (drive.includes(`"${m}"`)) ok(`DRIVE_WRITE blocked ${m}`);
    else bad(`DRIVE_WRITE blocked ${m}`);
  }

  if (/drive_read_only/.test(drive) && /action === "drive_read"/.test(tools)) ok("403 drive_read_only");
  else bad("403 drive_read_only");

  if (/buildDriveListQuery/.test(drive) && /recent/.test(drive)) ok("recent preset");
  else bad("recent preset");

  if (/mimeType/.test(drive) && /fullText contains/.test(drive)) ok("keyword + mimeType filter");
  else bad("keyword + mimeType filter");

  if (/ensureGoogleAccessToken/.test(drive)) ok("token refresh hook");
  else bad("token refresh hook");

  if (/drive\.readonly/.test(oauth)) ok("oauth drive.readonly scope");
  else bad("oauth drive.readonly scope");

  if (/listFiles/.test(client) && /getFile/.test(client) && /exportFileText/.test(client)) {
    ok("client API surface");
  } else bad("client API surface");

  if (/最近のファイル/.test(ui) && /テキスト抽出/.test(ui) && /data-ops-secretary-drive-breadcrumb/.test(html)) {
    ok("UI presets + folder + export");
  } else bad("UI presets + folder + export");

  if (/data-ops-google-tab="drive"/.test(html) && /admin-ai-secretary-google-drive-client/.test(html)) {
    ok("dashboard Drive tab");
  } else bad("dashboard Drive tab");

  if (!/access_token|refresh_token|client_secret/.test(client)) ok("client no secret literals");
  else bad("client no secret literals");
}

async function mockFetchTests() {
  const calls = [];
  const { OAuth, Drive } = loadStack(async (_url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(body);

    if (body.action === "drive_read" && body.method === "files.create") {
      return {
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "drive_read_only", method: body.method }),
      };
    }

    if (body.action === "drive_read" && body.method === "files.list") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          files: [
            {
              id: "mock_folder_ops",
              name: "TASFUL 運営",
              mimeType: "application/vnd.google-apps.folder",
              isFolder: true,
              modifiedTime: new Date().toISOString(),
              size: 0,
              kind: "folder",
              parents: ["root"],
            },
            {
              id: "mock_doc_1",
              name: "Platform ロードマップ",
              mimeType: "application/vnd.google-apps.document",
              isFolder: false,
              modifiedTime: new Date().toISOString(),
              size: 0,
              kind: "doc",
              parents: ["mock_folder_ops"],
            },
          ],
        }),
      };
    }

    if (body.action === "drive_read" && body.method === "files.get") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          file: { id: body.fileId, name: "Platform ロードマップ", kind: "doc", mimeType: "application/vnd.google-apps.document" },
        }),
      };
    }

    if (body.action === "drive_read" && body.method === "files.export") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          mock: true,
          fileId: body.fileId,
          text: "Platform roadmap export text",
        }),
      };
    }

    return { ok: true, status: 200, json: async () => ({ ok: true, mock: true }) };
  });

  const recent = await Drive.listFiles({ preset: "recent" });
  if (recent.ok && recent.data?.files?.length) ok("client listFiles recent mock");
  else bad("client listFiles recent mock");

  const folder = await Drive.listFiles({ folderId: "mock_folder_ops" });
  if (folder.ok) ok("client listFiles folder mock");
  else bad("client listFiles folder mock");

  const filtered = await Drive.listFiles({ mimeType: "application/pdf" });
  if (filtered.ok) ok("client listFiles mimeType mock");
  else bad("client listFiles mimeType mock");

  const search = await Drive.listFiles({ q: "ロードマップ" });
  if (search.ok) ok("client listFiles keyword mock");
  else bad("client listFiles keyword mock");

  const get = await Drive.getFile("mock_doc_1");
  if (get.ok && get.data?.file?.name) ok("client getFile mock");
  else bad("client getFile mock");

  const exported = await Drive.exportFileText("mock_doc_1");
  if (exported.ok && exported.data?.text) ok("client exportFileText mock");
  else bad("client exportFileText mock");

  const blocked = await Drive.tryWriteBlocked("files.create");
  if (!blocked.ok && blocked.data?.error === "drive_read_only") ok("write blocked 403");
  else bad("write blocked 403", blocked.data?.error);

  if (calls.every((c) => !c.access_token && !c.refresh_token)) ok("edge calls no tokens");
  else bad("edge calls no tokens");

  if (!OAuth.scanForSecrets(recent.data)) ok("response no secrets");
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
          () => window.TasuSecretaryGoogleDriveUI && document.querySelector('[data-ops-google-tab="drive"]'),
          { timeout: 30000 }
        );

        await page.click('[data-ops-google-tab="drive"]');
        await page.waitForTimeout(500);

        const audit = await page.evaluate(() => ({
          panel: Boolean(document.querySelector("[data-ops-secretary-drive-panel]:not([hidden])")),
          recentChip: Boolean(document.querySelector('[data-ops-secretary-drive-preset="recent"]')),
          searchInput: Boolean(document.querySelector("[data-ops-secretary-drive-search-input]")),
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));

        if (audit.panel) ok(`${tag} Drive panel visible`);
        else bad(`${tag} Drive panel visible`);
        if (audit.recentChip) ok(`${tag} recent preset`);
        else bad(`${tag} recent preset`);
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
  console.log("=== AI秘書 Drive Phase 6-H — unit ===");
  runUnitTests();
  console.log("\n=== AI秘書 Drive Phase 6-H — mock fetch ===");
  await mockFetchTests();

  try {
    const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
    console.log(`\n=== AI秘書 Drive Phase 6-H — browser @ ${base} ===`);
    await runBrowserSmoke(base);
  } catch (err) {
    console.warn(`SKIP browser 8788: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`\n=== AI秘書 Drive Phase 6-H: ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
