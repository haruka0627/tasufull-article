#!/usr/bin/env node
/**
 * 安否ユーザーコンテキスト Supabase 同期 E2E（P9-1）
 *
 *   node scripts/test-anpi-context-supabase-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { runAnpiRlsBrowserTests } from "./lib/anpi-rls-browser-tests.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const ADMIN_PAGE = "/anpi-line-admin.html?anpi_admin=1";
const STORAGE_KEY = "tasu_anpi_user_context_v1";
const MOCK_KEY = "tasu_anpi_context_supabase_mock_v1";
const ADMIN_KEY = "tasu_anpi_line_admin_v1";

const USER_ID = "anpi_user_ctx_e2e";

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    t.includes("CORS policy") ||
    t.includes("anpi-line-send") ||
    t.includes("anpi-line-token-exchange")
  );
}

async function enableMock(page) {
  await page.addInitScript(() => {
    window.__ANPI_CONTEXT_SUPABASE_MOCK__ = true;
    window.__anpiContextSupabaseStore = new Map();
    try {
      localStorage.setItem("tasu_anpi_context_supabase_mock_v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function gotoRegister(page) {
  await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiUserContext?.saveFromRegisterForm &&
          window.TasuAnpiUserContextSupabase?.upsertAnpiUserContext
      ),
    { timeout: 15000 }
  );
}

function buildFormPayload(overrides = {}) {
  return {
    user_name: "山田太郎",
    user_phone: "09012345678",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    contract_holder_email: "hanako@example.com",
    contract_holder_phone: "0312345678",
    contract_holder_contact_method: "tasful_chat",
    notification_level: "important_only",
    notify_tasful_chat: true,
    notify_line: true,
    notify_email: false,
    line_notification_enabled: true,
    consent_no_auto_execution: true,
    consent_self_confirm_required: true,
    consent_tasful_no_guarantee: true,
    consent_emergency_contact_required: true,
    ...overrides,
  };
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} (${vp.width}) ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push(msg.text());
    }
  });

  try {
    await enableMock(page);
    await gotoRegister(page);

    const saveResult = await page.evaluate(
      ({ userId, payload }) => {
        const prev = JSON.parse(localStorage.getItem("tasu_anpi_user_context_v1") || "null");
        const base = {
          user_id: userId,
          is_anpi_user: true,
          contract_holder_id: "holder_ctx_e2e",
          line_user_id: "line_ctx_e2e_user",
          line_linked_at: new Date().toISOString(),
          line_user_id_enc: "enc_user_stub",
          line_oauth_access_token_enc: "enc_token_stub",
          line_oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notify_channels: ["tasful_chat", "line"],
          line_notification_enabled: true,
          user_phone_masked: "09-***-5678",
          contract_holder_phone_masked: "03-***-5678",
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
        };
        localStorage.setItem("tasu_anpi_user_context_v1", JSON.stringify(base));

        const fd = payload;
        const channels = [];
        if (fd.notify_tasful_chat) channels.push("tasful_chat");
        if (fd.notify_line) channels.push("line");
        if (fd.notify_email) channels.push("email");

        const draft = {
          ...base,
          user_name: fd.user_name,
          contract_holder_name: fd.contract_holder_name,
          contract_holder_relation: fd.contract_holder_relation,
          contract_holder_email: fd.contract_holder_email,
          notification_level: fd.notification_level,
          notify_channels: channels,
          line_notification_enabled: fd.line_notification_enabled,
          updated_at: new Date().toISOString(),
        };

        localStorage.setItem("tasu_anpi_user_context_v1", JSON.stringify(draft));
        return window.TasuAnpiUserContext.saveFromRegisterForm({
          user_name: fd.user_name,
          user_phone: fd.user_phone,
          contract_holder_name: fd.contract_holder_name,
          contract_holder_relation: fd.contract_holder_relation,
          contract_holder_email: fd.contract_holder_email,
          contract_holder_phone: fd.contract_holder_phone,
          contract_holder_contact_method: fd.contract_holder_contact_method,
          notification_level: fd.notification_level,
          notify_tasful_chat: true,
          notify_line: true,
          notify_email: false,
          line_notification_enabled: "1",
          consent_no_auto_execution: true,
          consent_self_confirm_required: true,
          consent_tasful_no_guarantee: true,
          consent_emergency_contact_required: true,
        });
      },
      { userId: USER_ID, payload: buildFormPayload() }
    );

    if (saveResult?.ok) pass(`${vp.name}: 登録保存`);
    else fail(`${vp.name}: 登録保存`, JSON.stringify(saveResult?.errors));

    const mockHas = await page.evaluate((userId) => {
      const store = window.__anpiContextSupabaseStore;
      return store?.has?.(userId) === true;
    }, USER_ID);
    if (mockHas) pass(`${vp.name}: Supabase(mock)保存`);
    else fail(`${vp.name}: Supabase(mock)保存`);

    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);

    const restored = await page.evaluate(async (userId) => {
      return window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase({ userId });
    }, USER_ID);

    if (restored?.source === "restored" && restored?.context?.user_name) {
      pass(`${vp.name}: localStorage削除後に復元`, restored.context.user_name);
    } else fail(`${vp.name}: localStorage削除後に復元`, restored?.source);

    const lineOk = await page.evaluate(() => {
      const ctx = window.TasuAnpiUserContext.getAnpiUserContext();
      return {
        line_user_id: ctx?.line_user_id || "",
        line_user_id_enc: ctx?.line_user_id_enc || "",
        line_oauth_access_token_enc: ctx?.line_oauth_access_token_enc || "",
      };
    });
    if (lineOk.line_user_id === "line_ctx_e2e_user" && lineOk.line_user_id_enc) {
      pass(`${vp.name}: LINE情報復元`);
    } else fail(`${vp.name}: LINE情報復元`, JSON.stringify(lineOk));

    const storageAfterRestore = await page.evaluate(() =>
      window.TasuAnpiUserContext.getStorageInfo()
    );
    if (storageAfterRestore.restored) pass(`${vp.name}: restored フラグ`);
    else fail(`${vp.name}: restored フラグ`);

    // --- updated_at 競合: Supabase が新しい ---
    await page.evaluate(
      ({ userId, key }) => {
        const oldLocal = {
          user_id: userId,
          is_anpi_user: true,
          user_name: "ローカル古い",
          contract_holder_id: "holder_ctx_e2e",
          contract_holder_name: "山田花子",
          contract_holder_relation: "娘",
          contract_holder_email: "a@example.com",
          contract_holder_phone_masked: "03-***-5678",
          user_phone_masked: "09-***-5678",
          notify_channels: ["tasful_chat"],
          notification_level: "call_only",
          line_notification_enabled: false,
          line_user_id: "",
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
          created_at: "2020-01-01T00:00:00.000Z",
          updated_at: "2020-01-01T00:00:00.000Z",
        };
        localStorage.setItem(key, JSON.stringify(oldLocal));

        const row = window.TasuAnpiUserContextSupabase.contextToRow({
          ...oldLocal,
          user_name: "リモート新しい",
          updated_at: new Date().toISOString(),
        });
        window.__anpiContextSupabaseStore.set(userId, row);
      },
      { userId: USER_ID, key: STORAGE_KEY }
    );

    const remoteWin = await page.evaluate(() =>
      window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase()
    );
    if (remoteWin?.context?.user_name === "リモート新しい") {
      pass(`${vp.name}: updated_at競合 Supabase優先`);
    } else fail(`${vp.name}: updated_at競合 Supabase優先`, remoteWin?.context?.user_name);

    // --- updated_at 競合: localStorage が新しい ---
    await page.evaluate(
      ({ userId, key }) => {
        const remoteOld = window.TasuAnpiUserContextSupabase.contextToRow({
          user_id: userId,
          is_anpi_user: true,
          user_name: "リモート古い",
          contract_holder_id: "holder_ctx_e2e",
          contract_holder_name: "山田花子",
          contract_holder_relation: "娘",
          contract_holder_email: "a@example.com",
          contract_holder_phone_masked: "03-***-5678",
          user_phone_masked: "09-***-5678",
          notify_channels: ["tasful_chat"],
          notification_level: "call_only",
          contract_holder_contact_method: "tasful_chat",
          line_notification_enabled: false,
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: "2020-01-01T00:00:00.000Z",
          },
          created_at: "2020-01-01T00:00:00.000Z",
          updated_at: "2020-01-01T00:00:00.000Z",
        });
        window.__anpiContextSupabaseStore.set(userId, remoteOld);

        const localNew = {
          ...JSON.parse(localStorage.getItem(key) || "{}"),
          user_name: "ローカル新しい",
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(localNew));
      },
      { userId: USER_ID, key: STORAGE_KEY }
    );

    const localWin = await page.evaluate(() =>
      window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase()
    );
    const mockName = await page.evaluate((userId) => {
      return window.__anpiContextSupabaseStore.get(userId)?.user_name || "";
    }, USER_ID);
    if (localWin?.context?.user_name === "ローカル新しい" && mockName === "ローカル新しい") {
      pass(`${vp.name}: updated_at競合 localStorage優先`);
    } else fail(`${vp.name}: updated_at競合 localStorage優先`, `${localWin?.context?.user_name}/${mockName}`);

    // --- フォールバック ---
    const fallback = await page.evaluate(({ key }) => {
      const orig = window.TasuAnpiUserContextSupabase.upsertAnpiUserContext;
      window.TasuAnpiUserContextSupabase.upsertAnpiUserContext = async () => ({
        ok: false,
        error: "mock_fail",
      });
      const r = window.TasuAnpiUserContext.saveFromRegisterForm({
        user_name: "フォールバック太郎",
        user_phone: "09011112222",
        contract_holder_name: "フォールバック花子",
        contract_holder_relation: "妻",
        contract_holder_email: "fb@example.com",
        contract_holder_phone: "0311112222",
        contract_holder_contact_method: "tasful_chat",
        notification_level: "call_only",
        notify_tasful_chat: true,
        notify_line: false,
        notify_email: false,
        line_notification_enabled: "0",
        consent_no_auto_execution: true,
        consent_self_confirm_required: true,
        consent_tasful_no_guarantee: true,
        consent_emergency_contact_required: true,
      });
      window.TasuAnpiUserContextSupabase.upsertAnpiUserContext = orig;
      const local = JSON.parse(localStorage.getItem(key) || "null");
      return { ok: r?.ok, user_name: local?.user_name };
    }, { key: STORAGE_KEY });

    if (fallback.ok && fallback.user_name === "フォールバック太郎") {
      pass(`${vp.name}: Supabase失敗時 localStorage継続`);
    } else fail(`${vp.name}: Supabase失敗時 localStorage継続`, fallback.user_name);

    // --- 管理画面表示 ---
    await page.evaluate(() => {
      localStorage.setItem("tasu_anpi_line_admin_v1", "1");
    });
    await enableMock(page);
    await page.goto(`${BASE}${ADMIN_PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-line-admin-page]", { timeout: 10000 });
    const adminText = await page.locator(".anpi-line-admin-page__stats").textContent();
    if (adminText?.includes("Storage Source") && adminText?.includes("Restored")) {
      pass(`${vp.name}: 管理画面 Context表示`);
    } else fail(`${vp.name}: 管理画面 Context表示`);

    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await runAnpiRlsBrowserTests(page, vp, pass, fail);
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\n安否Context Supabase E2E — ${BASE}\n`);
  await withPlaywrightBrowser(async (browser) => {await runViewport(browser, { name: "PC", width: 1280, height: 800 });
  await runViewport(browser, { name: "SP", width: 390, height: 844 });
    });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

await closeAllBrowsers();
