#!/usr/bin/env node
/**
 * 安否 ID 正式紐付け E2E（P9-3）
 *
 *   node scripts/test-anpi-identity-linking-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { runAnpiRlsBrowserTests } from "./lib/anpi-rls-browser-tests.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const ADMIN_PAGE = "/anpi-line-admin.html?anpi_admin=1";
const STORAGE_KEY = "tasu_anpi_user_context_v1";
const IDENTITY_HINT_KEY = "tasu_anpi_identity_hint_v1";
const CONTEXT_MOCK_KEY = "tasu_anpi_context_supabase_mock_v1";
const LOGS_MOCK_KEY = "tasu_anpi_notification_logs_supabase_mock_v1";

const MEMBER_ID = "u_me";
const ANPI_USER_ID = "anpi_identity_e2e_user";
const HOLDER_ID = "u_me";

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

async function enableMocks(page) {
  await page.addInitScript(() => {
    window.__ANPI_CONTEXT_SUPABASE_MOCK__ = true;
    window.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__ = true;
    window.__anpiContextSupabaseStore = new Map();
    window.__anpiNotificationLogsSupabaseStore = new Map();
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "u_me";
    try {
      localStorage.setItem("tasu_anpi_context_supabase_mock_v1", "1");
      localStorage.setItem("tasu_anpi_notification_logs_supabase_mock_v1", "1");
      localStorage.setItem("tasu_anpi_line_send_mock_v1", "1");
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
        window.TasuAnpiIdentity?.normalizeAnpiIdentity &&
          window.TasuAnpiUserContext?.saveFromRegisterForm &&
          window.TasuAnpiUserContextSupabase?.upsertAnpiUserContext
      ),
    { timeout: 15000 }
  );
}

function buildFormPayload() {
  return {
    user_name: "ID紐付け太郎",
    user_phone: "09011112222",
    contract_holder_name: "ID紐付け花子",
    contract_holder_relation: "娘",
    contract_holder_email: "id-link@example.com",
    contract_holder_phone: "0311112222",
    contract_holder_contact_method: "tasful_chat",
    notification_level: "all_ai_actions",
    notify_tasful_chat: true,
    notify_line: false,
    notify_email: false,
    line_notification_enabled: false,
    consent_no_auto_execution: true,
    consent_self_confirm_required: true,
    consent_tasful_no_guarantee: true,
    consent_emergency_contact_required: true,
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
    await enableMocks(page);
    await gotoRegister(page);

    const saveResult = await page.evaluate(
      ({ anpiUserId, memberId, holderId, payload }) => {
        localStorage.removeItem("tasu_anpi_user_context_v1");
        localStorage.removeItem("tasu_anpi_identity_hint_v1");
        localStorage.removeItem("tasu_anpi_user_id_hint_v1");

        const prev = {
          user_id: anpiUserId,
          is_anpi_user: true,
          contract_holder_id: holderId,
          member_id: memberId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notify_channels: ["tasful_chat"],
          notification_level: "call_only",
          line_notification_enabled: false,
          user_phone_masked: "09-***-2222",
          contract_holder_phone_masked: "03-***-2222",
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
        };
        localStorage.setItem("tasu_anpi_user_context_v1", JSON.stringify(prev));

        return window.TasuAnpiUserContext.saveFromRegisterForm({
          user_name: payload.user_name,
          user_phone: payload.user_phone,
          contract_holder_name: payload.contract_holder_name,
          contract_holder_relation: payload.contract_holder_relation,
          contract_holder_email: payload.contract_holder_email,
          contract_holder_phone: payload.contract_holder_phone,
          contract_holder_contact_method: payload.contract_holder_contact_method,
          notification_level: payload.notification_level,
          notify_tasful_chat: true,
          notify_line: false,
          notify_email: false,
          line_notification_enabled: "0",
          consent_no_auto_execution: true,
          consent_self_confirm_required: true,
          consent_tasful_no_guarantee: true,
          consent_emergency_contact_required: true,
        });
      },
      { anpiUserId: ANPI_USER_ID, memberId: MEMBER_ID, holderId: HOLDER_ID, payload: buildFormPayload() }
    );

    if (saveResult?.ok) pass(`${vp.name}: 登録保存`);
    else fail(`${vp.name}: 登録保存`, JSON.stringify(saveResult?.errors));

    const idsAfterSave = await page.evaluate(() => {
      const ctx = window.TasuAnpiUserContext.getAnpiUserContext();
      return {
        member_id: ctx?.member_id,
        contract_holder_id: ctx?.contract_holder_id,
        anpi_user_id: ctx?.anpi_user_id,
        user_id: ctx?.user_id,
        relationship: ctx?.relationship,
        account_scope: ctx?.account_scope,
      };
    });

    if (
      idsAfterSave.member_id === MEMBER_ID &&
      idsAfterSave.contract_holder_id === HOLDER_ID &&
      idsAfterSave.anpi_user_id === ANPI_USER_ID &&
      idsAfterSave.user_id === ANPI_USER_ID
    ) {
      pass(`${vp.name}: 保存時 ID 付与`);
    } else fail(`${vp.name}: 保存時 ID 付与`, JSON.stringify(idsAfterSave));

    if (idsAfterSave.relationship && idsAfterSave.account_scope) {
      pass(`${vp.name}: relationship / account_scope`, `${idsAfterSave.relationship}/${idsAfterSave.account_scope}`);
    } else fail(`${vp.name}: relationship / account_scope`);

    const mockRow = await page.evaluate((userId) => {
      const row = window.__anpiContextSupabaseStore?.get?.(userId);
      return row
        ? {
            member_id: row.member_id,
            contract_holder_id: row.contract_holder_id,
            anpi_user_id: row.anpi_user_id,
            user_id: row.user_id,
          }
        : null;
    }, ANPI_USER_ID);

    if (
      mockRow?.member_id === MEMBER_ID &&
      mockRow?.anpi_user_id === ANPI_USER_ID &&
      mockRow?.user_id === ANPI_USER_ID
    ) {
      pass(`${vp.name}: Supabase(mock) ID列`);
    } else fail(`${vp.name}: Supabase(mock) ID列`, JSON.stringify(mockRow));

    await page.evaluate(async () => {
      await window.TasuAnpiNotifications?.initAnpiNotificationLogs?.();
      window.TasuAnpiNotifications?.recordAiSearch?.({ query: "identity e2e", source: "test" });
      await new Promise((r) => setTimeout(r, 300));
    });

    const logId = await page.evaluate(() => {
      return window.TasuAnpiNotifications?.getRawLogsFromStorage?.()?.[0]?.id || "";
    });
    const mockLog = await page.evaluate((id) => {
      const row = window.__anpiNotificationLogsSupabaseStore?.get?.(id);
      return row
        ? {
            member_id: row.member_id,
            anpi_user_id: row.anpi_user_id,
            user_id: row.user_id,
            contract_holder_id: row.contract_holder_id,
          }
        : null;
    }, logId);

    if (
      mockLog?.member_id === MEMBER_ID &&
      mockLog?.anpi_user_id === ANPI_USER_ID &&
      mockLog?.user_id === ANPI_USER_ID
    ) {
      pass(`${vp.name}: 通知ログ ID列`);
    } else fail(`${vp.name}: 通知ログ ID列`, JSON.stringify(mockLog));

    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem("tasu_anpi_user_id_hint_v1");
    }, STORAGE_KEY);

    const restored = await page.evaluate(async (userId) => {
      return window.TasuAnpiUserContext.syncAnpiUserContextWithSupabase({ userId });
    }, ANPI_USER_ID);

    if (restored?.source === "restored" && restored?.context?.member_id === MEMBER_ID) {
      pass(`${vp.name}: identity hint から復元`);
    } else fail(`${vp.name}: identity hint から復元`, restored?.source);

    const logsByHolder = await page.evaluate(async (holderId) => {
      const rows = await window.TasuAnpiNotificationLogsSupabase.loadAnpiNotificationLogs({
        contractHolderId: holderId,
        limit: 50,
      });
      return rows.length;
    }, HOLDER_ID);

    if (logsByHolder > 0) pass(`${vp.name}: contract_holder_id でログ取得`, String(logsByHolder));
    else fail(`${vp.name}: contract_holder_id でログ取得`);

    await page.evaluate(
      ({ memberId, anpiUserId, holderId }) => {
        const familyUser = "anpi_identity_family_e2e";
        const familyRow = window.TasuAnpiUserContextSupabase.contextToRow({
          user_id: familyUser,
          is_anpi_user: true,
          user_name: "家族利用者",
          contract_holder_id: holderId,
          member_id: memberId,
          contract_holder_name: "契約者",
          contract_holder_relation: "父",
          contract_holder_email: "f@example.com",
          contract_holder_phone_masked: "03-***-1111",
          user_phone_masked: "09-***-3333",
          notify_channels: ["tasful_chat"],
          notification_level: "call_only",
          contract_holder_contact_method: "tasful_chat",
          line_notification_enabled: false,
          relationship: "parent",
          account_scope: "family",
          metadata: { primary: false },
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        window.__anpiContextSupabaseStore.set(familyUser, familyRow);

        const selfRow = window.TasuAnpiUserContextSupabase.contextToRow({
          user_id: anpiUserId,
          is_anpi_user: true,
          user_name: "本人利用者",
          contract_holder_id: holderId,
          member_id: memberId,
          contract_holder_name: "本人",
          contract_holder_relation: "本人",
          contract_holder_email: "s@example.com",
          contract_holder_phone_masked: "03-***-2222",
          user_phone_masked: "09-***-2222",
          notify_channels: ["tasful_chat"],
          notification_level: "call_only",
          contract_holder_contact_method: "tasful_chat",
          line_notification_enabled: false,
          relationship: "self",
          account_scope: "self",
          metadata: { primary: true },
          consent: {
            no_auto_execution: true,
            self_confirm_required: true,
            tasful_no_guarantee: true,
            emergency_contact_required: true,
            agreed_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        window.__anpiContextSupabaseStore.set(anpiUserId, selfRow);
      },
      { memberId: MEMBER_ID, anpiUserId: ANPI_USER_ID, holderId: HOLDER_ID }
    );

    const multi = await page.evaluate(async (memberId) => {
      const list = await window.TasuAnpiUserContext.loadAnpiUserContextsByMemberId(memberId);
      const primary = await window.TasuAnpiUserContext.getPrimaryAnpiUserContext(memberId);
      return { count: list.length, primaryUserId: primary?.anpi_user_id || primary?.user_id };
    }, MEMBER_ID);

    if (multi.count >= 2) pass(`${vp.name}: member_id で複数 context`, String(multi.count));
    else fail(`${vp.name}: member_id で複数 context`, String(multi.count));

    if (multi.primaryUserId === ANPI_USER_ID) pass(`${vp.name}: primary context 選択`);
    else fail(`${vp.name}: primary context 選択`, multi.primaryUserId);

    const legacyNorm = await page.evaluate(() => {
      const legacy = {
        user_id: "anpi_legacy_norm_e2e",
        is_anpi_user: true,
        user_name: "レガシー",
        contract_holder_id: "holder_legacy",
        contract_holder_name: "花子",
        contract_holder_relation: "配偶者",
        contract_holder_email: "l@example.com",
        contract_holder_phone_masked: "03-***-9999",
        user_phone_masked: "09-***-9999",
        notify_channels: ["tasful_chat"],
        notification_level: "call_only",
        contract_holder_contact_method: "tasful_chat",
        line_notification_enabled: false,
        consent: {
          no_auto_execution: true,
          self_confirm_required: true,
          tasful_no_guarantee: true,
          emergency_contact_required: true,
          agreed_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const normalized = window.TasuAnpiUserContext.normalizeContext(legacy, { forSave: true });
      return {
        member_id: normalized?.member_id,
        anpi_user_id: normalized?.anpi_user_id,
        relationship: normalized?.relationship,
      };
    });

    if (legacyNorm.member_id && legacyNorm.anpi_user_id && legacyNorm.relationship) {
      pass(`${vp.name}: 古い context 正規化`);
    } else fail(`${vp.name}: 古い context 正規化`, JSON.stringify(legacyNorm));

    await page.goto(`${BASE}${ADMIN_PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.TasuAnpiLineAdmin?.renderInto), {
      timeout: 15000,
    });
    await page.evaluate(async () => {
      localStorage.setItem("tasu_anpi_line_admin_v1", "1");
      await window.TasuAnpiLineAdmin?.renderAdminPage?.("[data-anpi-line-admin-root]");
    });
    const adminHtml = await page.content();
    if (adminHtml.includes("Identity Linking") && adminHtml.includes("member_id")) {
      pass(`${vp.name}: 管理画面 Identity 表示`);
    } else fail(`${vp.name}: 管理画面 Identity 表示`);

    if (errors.length) fail(`${vp.name}: console/page エラー`, errors.slice(0, 3).join(" | "));
    else pass(`${vp.name}: console/page エラーなし`);

    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await runAnpiRlsBrowserTests(page, vp, pass, fail);
  } finally {
    await context.close();
  }
}

async function main() {
  const viewports = [
    { name: "PC", width: 1280, height: 900 },
    { name: "SP", width: 390, height: 844 },
  ];

  await withPlaywrightBrowser(async (browser) => {for (const vp of viewports) {
    await runViewport(browser, vp);
  }
    });

  const ok = results.filter((r) => r.ok).length;
  const ng = results.filter((r) => !r.ok);
  console.log(`\n=== ${ok}/${results.length} OK ===`);
  if (ng.length) {
    ng.forEach((r) => console.error(`  - ${r.step}: ${r.detail}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

await closeAllBrowsers();
