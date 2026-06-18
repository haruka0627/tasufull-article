#!/usr/bin/env node
/**
 * LINEトークン交換・userId保存 E2E（P8-2）
 *
 *   node scripts/test-anpi-line-token-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const AUTH_CODE_KEY = "tasu_anpi_line_auth_code_v1";
const NONCE_KEY = "tasu_anpi_line_login_nonce_v1";
const TOKEN_MOCK_KEY = "tasu_anpi_line_token_mock_v1";
const PREVIEW_KEY = "tasu_anpi_line_link_preview_v1";

const SEED_CONTEXT = {
  user_id: "anpi_user_token",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: "holder_token",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat"],
  notification_level: "important_only",
  line_notification_enabled: false,
  line_user_id: "",
  line_linked_at: "",
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
    t.includes("supabase")
  );
}

async function seedSession(page, { code, nonce }) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(
    ({ ctxKey, ctx, codeKey, nonceKey, mockKey, code, nonce }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(mockKey, "1");
      sessionStorage.setItem(codeKey, code);
      sessionStorage.setItem(nonceKey, nonce);
    },
    {
      ctxKey: STORAGE_CONTEXT,
      ctx: SEED_CONTEXT,
      codeKey: AUTH_CODE_KEY,
      nonceKey: NONCE_KEY,
      mockKey: TOKEN_MOCK_KEY,
      code,
      nonce,
    }
  );
}

async function waitApis(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiLineTokenClient?.exchangeAuthCode &&
          window.TasuAnpiUserContext?.applyLineOAuthLink
      ),
    { timeout: 20000 }
  );
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  const consoleLogs = [];

  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !isIgnorableConsoleError(text)) {
      errors.push(text);
    }
    if (/access_token|auth_code|mock_at_/i.test(text)) {
      consoleLogs.push(text);
    }
  });

  try {
    const validCode = `valid_e2e_${vp.name}`;
    const validNonce = `nonce_${vp.name}_${Date.now()}`;

    await seedSession(page, { code: validCode, nonce: validNonce });
    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await waitApis(page);

    await page.waitForFunction(
      () => {
        const ctx = JSON.parse(localStorage.getItem("tasu_anpi_user_context_v1") || "{}");
        return Boolean(ctx.line_user_id);
      },
      { timeout: 15000 }
    );

    const stored = await page.evaluate((ctxKey) => {
      const ctx = JSON.parse(localStorage.getItem(ctxKey) || "{}");
      return {
        line_user_id: ctx.line_user_id || "",
        line_linked_at: ctx.line_linked_at || "",
        line_notification_enabled: ctx.line_notification_enabled,
        line_user_id_enc: ctx.line_user_id_enc || "",
        line_oauth_access_token_enc: ctx.line_oauth_access_token_enc || "",
        authCode: sessionStorage.getItem("tasu_anpi_line_auth_code_v1"),
      };
    }, STORAGE_CONTEXT);

    if (stored.line_user_id) pass(`${vp.name}: line_user_id 保存`, stored.line_user_id.slice(0, 20));
    else fail(`${vp.name}: line_user_id 保存`);

    if (stored.line_linked_at) pass(`${vp.name}: line_linked_at 保存`);
    else fail(`${vp.name}: line_linked_at 保存`);

    if (stored.line_user_id_enc && stored.line_oauth_access_token_enc) {
      pass(`${vp.name}: トークン暗号化フィールド`);
    } else fail(`${vp.name}: トークン暗号化フィールド`);

    if (!stored.authCode) pass(`${vp.name}: 成功後 auth code クリア`);
    else fail(`${vp.name}: 成功後 auth code クリア`);

    if (stored.line_notification_enabled !== true) {
      pass(`${vp.name}: line_notification_enabled 自動ONなし`);
    } else fail(`${vp.name}: line_notification_enabled 自動ON`);

    const statusText = await page.locator("[data-anpi-line-status-text]").textContent();
    if (statusText?.includes("LINE連携済み")) pass(`${vp.name}: UI 連携済み`);
    else fail(`${vp.name}: UI 連携済み`, statusText || "");

    const idMask = await page.locator("[data-anpi-line-user-id-mask]").textContent();
    if (idMask && idMask.includes("***")) pass(`${vp.name}: IDマスク表示`);
    else fail(`${vp.name}: IDマスク表示`, idMask || "");

    const loginDisabled = await page.locator("[data-anpi-line-login-link]").isDisabled();
    if (loginDisabled) pass(`${vp.name}: 連携済みで本番ボタンdisabled`);
    else fail(`${vp.name}: 連携済みで本番ボタンdisabled`);

    await page.evaluate(
      ({ codeKey, nonceKey, code, nonce }) => {
        sessionStorage.setItem(codeKey, code);
        sessionStorage.setItem(nonceKey, nonce);
      },
      { codeKey: AUTH_CODE_KEY, nonceKey: NONCE_KEY, code: "invalid_code_e2e", nonce: validNonce }
    );

    const invalidResult = await page.evaluate(async () => {
      return window.TasuAnpiLineTokenClient.exchangeAuthCode({
        code: "invalid_code_e2e",
        redirectUri: window.TasuAnpiLineLoginConfig.getRedirectUri(),
        nonce: sessionStorage.getItem("tasu_anpi_line_login_nonce_v1"),
      });
    });

    if (!invalidResult?.success) pass(`${vp.name}: 無効コードで失敗`);
    else fail(`${vp.name}: 無効コードで失敗`);

    const ctxAfterInvalid = await page.evaluate((ctxKey) => {
      return JSON.parse(localStorage.getItem(ctxKey) || "{}").line_user_id || "";
    }, STORAGE_CONTEXT);
    if (ctxAfterInvalid === stored.line_user_id) {
      pass(`${vp.name}: 無効コード後 userId 不変`);
    } else {
      fail(`${vp.name}: 無効コード後 userId`, ctxAfterInvalid);
    }

    const authKept = await page.evaluate(
      (key) => sessionStorage.getItem(key),
      AUTH_CODE_KEY
    );
    if (authKept === "invalid_code_e2e") pass(`${vp.name}: 失敗時 auth code 保持`);
    else fail(`${vp.name}: 失敗時 auth code 保持`, authKept || "");

    const badNonceResult = await page.evaluate(async () => {
      return window.TasuAnpiLineTokenClient.exchangeAuthCode({
        code: "another_valid_code",
        redirectUri: window.TasuAnpiLineLoginConfig.getRedirectUri(),
        nonce: "wrong_nonce_value",
      });
    });
    if (!badNonceResult?.success) pass(`${vp.name}: nonce不一致で失敗`);
    else fail(`${vp.name}: nonce不一致`, JSON.stringify(badNonceResult));

    if (consoleLogs.length === 0) pass(`${vp.name}: consoleにtoken/code出力なし`);
    else fail(`${vp.name}: console漏洩`, consoleLogs.slice(0, 2).join(" | "));
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINEトークン交換 E2E — ${BASE}\n`);
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
