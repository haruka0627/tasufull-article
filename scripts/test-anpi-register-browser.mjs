#!/usr/bin/env node
/**
 * 安否サービス登録 E2E
 *
 *   node scripts/test-anpi-register-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PAGE = "/anpi-register.html";
const DASH = "/dashboard.html";
const STORAGE_KEY = "tasu_anpi_user_context_v1";

const USER_PHONE = "09012345678";
const HOLDER_PHONE = "0312345678";
const USER_PHONE_MASKED = "09-***-5678";
const HOLDER_PHONE_MASKED = "03-***-5678";

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

async function clearContext(page) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem("tasu_anpi_user_id_hint_v1");
  }, STORAGE_KEY);
}

async function gotoRegister(page) {
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-anpi-register-form]", { timeout: 15000 });
}

async function fillValidForm(page, overrides = {}) {
  const data = {
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    contract_holder_phone: HOLDER_PHONE,
    contract_holder_email: "hanako@example.com",
    contract_holder_contact_method: "tasful_chat",
    user_name: "山田太郎",
    user_phone: USER_PHONE,
    user_age_optional: "78",
    user_relation_note: "一人暮らし",
    emergency_note: "かかりつけ病院あり",
    notification_level: "important_only",
    ...overrides,
  };

  await page.fill('[name="contract_holder_name"]', data.contract_holder_name);
  await page.fill('[name="contract_holder_relation"]', data.contract_holder_relation);
  await page.fill('[name="contract_holder_phone"]', data.contract_holder_phone);
  await page.fill('[name="contract_holder_email"]', data.contract_holder_email);
  await page.selectOption('[name="contract_holder_contact_method"]', data.contract_holder_contact_method);
  await page.fill('[name="user_name"]', data.user_name);
  await page.fill('[name="user_phone"]', data.user_phone);
  await page.fill('[name="user_age_optional"]', data.user_age_optional || "");
  await page.fill('[name="user_relation_note"]', data.user_relation_note || "");
  await page.fill('[name="emergency_note"]', data.emergency_note || "");
  await page.check('[name="notify_tasful_chat"]');
  await page.check(`[name="notification_level"][value="${data.notification_level}"]`);
  await page.check('[name="consent_no_auto_execution"]');
  await page.check('[name="consent_self_confirm_required"]');
  await page.check('[name="consent_tasful_no_guarantee"]');
  await page.check('[name="consent_emergency_contact_required"]');
}

function assertNoFullPhoneInStorage(storedJson, fullPhones) {
  for (const phone of fullPhones) {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length >= 8 && storedJson.includes(digits)) {
      return { ok: false, detail: `full digits found: ${digits}` };
    }
  }
  return { ok: true };
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} ========`);
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
    await clearContext(page);
    await gotoRegister(page);

    const title = await page.title();
    if (title.includes("安否サービス登録")) pass(`${vp.name}: ページタイトル`);
    else fail(`${vp.name}: ページタイトル`, title);

    const h1 = await page.locator(".dash-header__title").textContent();
    if (h1?.includes("安否サービス登録")) pass(`${vp.name}: 見出し`);
    else fail(`${vp.name}: 見出し`, h1 || "");

    const lead = await page.locator(".anpi-register-lead").textContent();
    if (lead?.includes("AI相談")) pass(`${vp.name}: 説明文`);
    else fail(`${vp.name}: 説明文`);

    await page.click("[data-anpi-submit]");
    await page.waitForTimeout(300);
    const errVisible = await page.locator("[data-anpi-form-errors]:not([hidden])").isVisible();
    if (errVisible) pass(`${vp.name}: 必須未入力でエラー`);
    else fail(`${vp.name}: 必須未入力でエラー`, "errors hidden");

    await clearContext(page);
    await gotoRegister(page);
    await fillValidForm(page);
    await page.uncheck('[name="consent_no_auto_execution"]');
    await page.click("[data-anpi-submit]");
    await page.waitForTimeout(300);
    const consentBlock = await page.locator("[data-anpi-form-errors]:not([hidden])").textContent();
    if (consentBlock?.includes("同意")) pass(`${vp.name}: 同意未チェックで保存不可`);
    else fail(`${vp.name}: 同意未チェック`, consentBlock || "");

    await clearContext(page);
    await gotoRegister(page);
    await fillValidForm(page);
    await page.click("[data-anpi-submit]");
    await page.waitForSelector("[data-anpi-register-success]:not([hidden])", { timeout: 8000 });

    const successLinks = await page.locator(".anpi-register-success__link").count();
    if (successLinks >= 3) pass(`${vp.name}: 登録後リンク`, `${successLinks}件`);
    else fail(`${vp.name}: 登録後リンク`, String(successLinks));

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    if (!stored) {
      fail(`${vp.name}: localStorage保存`);
    } else {
      pass(`${vp.name}: localStorage保存`);
      const parsed = JSON.parse(stored);
      if (parsed.is_anpi_user === true) pass(`${vp.name}: is_anpi_user`);
      else fail(`${vp.name}: is_anpi_user`);
      if (parsed.user_phone_masked === USER_PHONE_MASKED) {
        pass(`${vp.name}: 利用者電話マスク`);
      } else {
        fail(`${vp.name}: 利用者電話マスク`, parsed.user_phone_masked);
      }
      if (parsed.contract_holder_phone_masked === HOLDER_PHONE_MASKED) {
        pass(`${vp.name}: 契約者電話マスク`);
      } else {
        fail(`${vp.name}: 契約者電話マスク`, parsed.contract_holder_phone_masked);
      }
      const leak = assertNoFullPhoneInStorage(stored, [USER_PHONE, HOLDER_PHONE]);
      if (leak.ok) pass(`${vp.name}: 完全電話番号なし`);
      else fail(`${vp.name}: 完全電話番号なし`, leak.detail);

      if (parsed.consent?.no_auto_execution === true) pass(`${vp.name}: 同意保存`);
      else fail(`${vp.name}: 同意保存`);
    }

    const updatedBefore = JSON.parse(stored).updated_at;
    await page.waitForTimeout(1100);
    await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-edit-note]:not([hidden])", { timeout: 8000 });
    pass(`${vp.name}: 既存データ復元`);

    const restoredName = await page.inputValue('[name="user_name"]');
    if (restoredName === "山田太郎") pass(`${vp.name}: フォーム復元`);
    else fail(`${vp.name}: フォーム復元`, restoredName);

    await page.fill('[name="user_relation_note"]', "要介護2");
    await page.click("[data-anpi-submit]");
    await page.waitForSelector("[data-anpi-register-success]:not([hidden])", { timeout: 8000 });

    const stored2 = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    const parsed2 = JSON.parse(stored2);
    if (parsed2.user_relation_note === "要介護2") pass(`${vp.name}: 編集保存`);
    else fail(`${vp.name}: 編集保存`, parsed2.user_relation_note);
    if (parsed2.updated_at && parsed2.updated_at !== updatedBefore) {
      pass(`${vp.name}: updated_at更新`);
    } else {
      fail(`${vp.name}: updated_at更新`, `${updatedBefore} -> ${parsed2.updated_at}`);
    }
    const leak2 = assertNoFullPhoneInStorage(stored2, [USER_PHONE, HOLDER_PHONE]);
    if (leak2.ok) pass(`${vp.name}: 編集後もマスクのみ`);
    else fail(`${vp.name}: 編集後もマスクのみ`, leak2.detail);

    if (vp.name === "PC") {
      await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
      await page
        .waitForSelector('#dashSidebarNav a[href="anpi-register.html"]', { timeout: 25000 })
        .catch(() => null);
      const regLink = page.locator('#dashSidebarNav a[href="anpi-register.html"]');
      const centerLink = page.locator('#dashSidebarNav a[href="anpi-notifications.html"]');
      if ((await regLink.count()) > 0 && (await centerLink.count()) > 0) {
        pass(`${vp.name}: dashboard導線`);
      } else {
        const navHtml = await page.locator("#dashSidebarNav").innerHTML().catch(() => "");
        fail(`${vp.name}: dashboard導線`, navHtml.slice(0, 120));
      }
      await page.waitForSelector("[data-dash-quick] a", { timeout: 15000 }).catch(() => null);
      const quickReg = page.locator('[data-dash-quick] a[href="anpi-register.html"]');
      if ((await quickReg.count()) > 0) pass(`${vp.name}: クイックアクション`);
      else fail(`${vp.name}: クイックアクション`);
    }
  } finally {
    if (errors.length) {
      fail(`${vp.name}: console error`, errors.slice(0, 3).join(" | "));
    } else {
      pass(`${vp.name}: console error なし`);
    }
    await context.close();
  }
}

async function main() {
  console.log(`\n安否サービス登録 E2E — ${BASE}${PAGE}\n`);
  const browser = await chromium.launch({ headless: true });

  await runViewport(browser, { name: "PC", width: 1280, height: 800 });
  await runViewport(browser, { name: "SP", width: 390, height: 844 });

  await browser.close();

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
