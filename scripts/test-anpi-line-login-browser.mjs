#!/usr/bin/env node
/**
 * LINE Login 連携開始・callback E2E（P8-1）
 *
 *   node scripts/test-anpi-line-login-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html";
const CALLBACK = "/anpi-line-callback.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STATE_KEY = "tasu_anpi_line_login_state_v1";
const NONCE_KEY = "tasu_anpi_line_login_nonce_v1";
const AUTH_CODE_KEY = "tasu_anpi_line_auth_code_v1";

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
    t.includes("404")
  );
}

async function clearStores(page) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(
    ({ ctxKey }) => {
      localStorage.removeItem(ctxKey);
      localStorage.removeItem("tasu_anpi_user_id_hint_v1");
      sessionStorage.removeItem("tasu_anpi_line_login_state_v1");
      sessionStorage.removeItem("tasu_anpi_line_login_nonce_v1");
      sessionStorage.removeItem("tasu_anpi_line_auth_code_v1");
    },
    { ctxKey: STORAGE_CONTEXT }
  );
}

async function waitLoginApis(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiLineLoginConfig?.createAuthUrl &&
          window.TasuAnpiLineLoginConfig?.verifyState
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
    if (text.includes("auth_code") || /\bcode=/.test(text)) {
      consoleLogs.push(text);
    }
  });

  try {
    await clearStores(page);
    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await waitLoginApis(page);
    await page.waitForFunction(
      () => {
        const cfg = window.TasuAnpiLineLoginConfig?.getConfig?.();
        const warn = document.querySelector("[data-anpi-line-config-warn]");
        return Boolean(cfg && warn && cfg.isConfigured === warn.hidden);
      },
      { timeout: 10000 }
    );

    const loginDisabled = await page.locator("[data-anpi-line-login-link]").isDisabled();
    if (loginDisabled) pass(`${vp.name}: Channel ID未設定でボタンdisabled`);
    else fail(`${vp.name}: Channel ID未設定でボタンdisabled`);

    const warnVisible = await page.locator("[data-anpi-line-config-warn]").isVisible();
    if (warnVisible) pass(`${vp.name}: Channel ID未設定警告`);
    else fail(`${vp.name}: Channel ID未設定警告`);

    const tokens = await page.evaluate(() => {
      const saved = window.TasuAnpiLineLoginConfig.saveStateNonce();
      return {
        state: sessionStorage.getItem("tasu_anpi_line_login_state_v1"),
        nonce: sessionStorage.getItem("tasu_anpi_line_login_nonce_v1"),
        saved,
      };
    });

    if (tokens.state && tokens.nonce && tokens.saved.state === tokens.state) {
      pass(`${vp.name}: state/nonce 生成`);
    } else fail(`${vp.name}: state/nonce 生成`);

    const goodState = tokens.state;
    const testCode = "e2e_auth_code_secret_do_not_log";

    await page.evaluate(
      ({ stateKey, state }) => {
        sessionStorage.setItem(stateKey, state);
      },
      { stateKey: STATE_KEY, state: goodState }
    );

    await page.goto(
      `${BASE}${CALLBACK}?code=${encodeURIComponent(testCode)}&state=${encodeURIComponent(goodState)}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForFunction(
      () => {
        const el = document.querySelector("[data-anpi-callback-back]");
        return el && !el.hidden;
      },
      { timeout: 10000 }
    );

    const callbackOk = await page.locator("[data-anpi-callback-status]").textContent();
    if (callbackOk?.includes("認可に成功")) pass(`${vp.name}: callback state一致成功`);
    else fail(`${vp.name}: callback state一致`, callbackOk || "");

    const stored = await page.evaluate((key) => {
      return {
        code: sessionStorage.getItem(key),
        localCode: localStorage.getItem(key),
        href: location.href,
        search: location.search,
      };
    }, AUTH_CODE_KEY);

    if (stored.code === testCode) pass(`${vp.name}: code sessionStorage保存`);
    else fail(`${vp.name}: code sessionStorage`, stored.code || "empty");

    if (!stored.localCode) pass(`${vp.name}: code localStorage非保存`);
    else fail(`${vp.name}: code localStorage非保存`);

    if (!stored.search.includes("code=")) pass(`${vp.name}: queryからcode除去`);
    else fail(`${vp.name}: queryからcode除去`, stored.search);

    await page.goto(`${BASE}${REGISTER}?anpi_skip_line_token_exchange=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitLoginApis(page);
    await page.waitForFunction(
      () => {
        const cfg = window.TasuAnpiLineLoginConfig?.getConfig?.();
        const warn = document.querySelector("[data-anpi-line-config-warn]");
        if (!cfg || !warn) return false;
        return cfg.isConfigured === warn.hidden;
      },
      { timeout: 10000 }
    );

    const pendingVisible = await page.locator("[data-anpi-line-auth-pending]").isVisible();
    if (pendingVisible) pass(`${vp.name}: 認可コード取得済みメッセージ`);
    else fail(`${vp.name}: 認可コード取得済みメッセージ`);

    const statusText = await page.locator("[data-anpi-line-status-text]").textContent();
    if (statusText?.includes("未連携")) pass(`${vp.name}: 未連携表示維持`);
    else fail(`${vp.name}: 未連携表示`, statusText || "");

    const ctx = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const preview = localStorage.getItem("tasu_anpi_line_link_preview_v1");
      return {
        ctx: raw ? JSON.parse(raw) : null,
        preview: preview ? JSON.parse(preview) : null,
      };
    }, STORAGE_CONTEXT);

    const lineUserId = ctx.ctx?.line_user_id || ctx.preview?.line_user_id || "";
    if (!lineUserId) pass(`${vp.name}: line_user_id未保存`);
    else fail(`${vp.name}: line_user_id未保存`, lineUserId);

    if (ctx?.line_notification_enabled !== true) {
      pass(`${vp.name}: line_notification_enabled自動ONなし`);
    } else {
      fail(`${vp.name}: line_notification_enabled自動ON`);
    }

    await clearStores(page);
    const badState = "bad_state_value";
    await page.evaluate(() => window.TasuAnpiLineLoginConfig.saveStateNonce());
    await page.goto(
      `${BASE}${CALLBACK}?code=should_not_save&state=${encodeURIComponent(badState)}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(400);

    const failText = await page.locator("[data-anpi-callback-status]").textContent();
    if (failText?.includes("検証に失敗")) pass(`${vp.name}: state不一致拒否`);
    else fail(`${vp.name}: state不一致`, failText || "");

    const noCode = await page.evaluate((key) => sessionStorage.getItem(key), AUTH_CODE_KEY);
    if (!noCode || noCode !== "should_not_save") pass(`${vp.name}: state不一致でcode非保存`);
    else fail(`${vp.name}: state不一致でcode非保存`, noCode);

    await page.goto(
      `${BASE}${CALLBACK}?error=access_denied&error_description=${encodeURIComponent("User denied")}`,
      { waitUntil: "domcontentloaded" }
    );
    const cancelText = await page.locator("[data-anpi-callback-status]").textContent();
    const cancelDetail = await page.locator("[data-anpi-callback-detail]").textContent();
    if (cancelText?.includes("キャンセル")) pass(`${vp.name}: error callback表示`);
    else fail(`${vp.name}: error callback`, cancelText || "");
    if (cancelDetail?.includes("denied") || cancelDetail?.includes("User")) {
      pass(`${vp.name}: error_description表示`);
    } else fail(`${vp.name}: error_description`, cancelDetail || "");

    if (consoleLogs.length === 0) pass(`${vp.name}: consoleにcode出力なし`);
    else fail(`${vp.name}: consoleにcode出力`, consoleLogs.join(" | "));
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE Login E2E — ${BASE}\n`);
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
