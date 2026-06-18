#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 会員登録フロー — ブラウザ自動確認 (Playwright)
 *
 * 事前: DEV_SKIP_AUTH = false、npm run dev
 *   node scripts/test-signup-browser.mjs
 *   BASE_URL=http://127.0.0.1:5175 node scripts/test-signup-browser.mjs
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5175").replace(/\/$/, "");
const VIEWPORTS = [
  { label: "PC", width: 1280, height: 800 },
  { label: "スマホ", width: 390, height: 844 },
];

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

async function clearAuthStorage(page) {
  await page.evaluate(() => {
    [
      "tasu_member_session",
      "tasu_member_signups",
      "tasful_last_profile",
      "tasful_session",
      "tasful_auth",
      "tasful_user",
    ].forEach((key) => localStorage.removeItem(key));
  });
}

async function isErrorVisible(page, field) {
  return page.locator(`[data-signup-error="${field}"]:not([hidden])`).isVisible();
}

async function getErrorText(page, field) {
  return page.locator(`[data-signup-error="${field}"]`).textContent();
}

async function setAgreeChecked(page, checked) {
  await page.evaluate((value) => {
    const el = document.querySelector("[data-signup-agree]");
    if (!el) return;
    el.checked = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, checked);
}

async function fillSignupForm(page, { email, password, nickname, agree = true }) {
  await page.fill("[data-signup-email]", email);
  await page.fill("[data-signup-password]", password);
  await page.fill("[data-signup-password-confirm]", password);
  await page.fill("[data-signup-nickname]", nickname);
  await setAgreeChecked(page, agree);
}

async function testFormLayout(page, label) {
  const fields = [
    "[data-signup-email]",
    "[data-signup-password]",
    "[data-signup-password-confirm]",
    "[data-signup-nickname]",
    "[data-signup-agree]",
    "[data-signup-submit]",
  ];
  for (const sel of fields) {
    const visible = await page.locator(sel).isVisible();
    if (!visible) {
      fail(`${label}: フォーム表示`, `${sel} が非表示`);
      return;
    }
  }
  const submitEnabled = await page.locator("[data-signup-submit]").isEnabled();
  if (!submitEnabled) {
    fail(`${label}: 登録ボタン`, "押下不可");
    return;
  }
  const box = await page.locator(".signup-card").boundingBox();
  if (!box || box.width < 200) {
    fail(`${label}: レイアウト`, "signup-card の幅が異常");
    return;
  }
  pass(`${label}: フォーム表示`, `card幅 ${Math.round(box.width)}px`);
}

async function testValidation(page) {
  await page.goto(`${BASE}/signup.html`, { waitUntil: "domcontentloaded" });
  await clearAuthStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.fill("[data-signup-nickname]", "テスト太郎");
  await page.fill("[data-signup-password-confirm]", "password123");
  await setAgreeChecked(page, true);
  await page.click("[data-signup-submit]");
  if (await isErrorVisible(page, "email")) {
    pass("入力チェック: メール未入力", (await getErrorText(page, "email"))?.trim());
  } else {
    fail("入力チェック: メール未入力", "エラー未表示");
  }

  await page.fill("[data-signup-email]", "test@example.com");
  await page.fill("[data-signup-password]", "");
  await page.click("[data-signup-submit]");
  if (await isErrorVisible(page, "password")) {
    pass("入力チェック: パスワード未入力", (await getErrorText(page, "password"))?.trim());
  } else {
    fail("入力チェック: パスワード未入力", "エラー未表示");
  }

  await page.fill("[data-signup-password]", "password123");
  await page.fill("[data-signup-password-confirm]", "different456");
  await page.click("[data-signup-submit]");
  if (await isErrorVisible(page, "passwordConfirm")) {
    pass("入力チェック: パスワード確認不一致", (await getErrorText(page, "passwordConfirm"))?.trim());
  } else {
    fail("入力チェック: パスワード確認不一致", "エラー未表示");
  }

  await page.fill("[data-signup-password-confirm]", "password123");
  await setAgreeChecked(page, false);
  await page.click("[data-signup-submit]");
  if (await isErrorVisible(page, "agree")) {
    pass("入力チェック: 利用規約未同意", (await getErrorText(page, "agree"))?.trim());
  } else {
    fail("入力チェック: 利用規約未同意", "エラー未表示");
  }
}

async function testRegistrationFlow(page) {
  const email = `signup-test-${Date.now()}@example.com`;
  const nickname = "登録テストユーザー";
  const password = "TestPass99";

  await page.goto(`${BASE}/signup.html`, { waitUntil: "domcontentloaded" });
  await clearAuthStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });

  await fillSignupForm(page, { email, password, nickname });
  await page.click("[data-signup-submit]");

  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
  pass("登録処理: dashboard.html へ遷移");

  const storage = await page.evaluate(() => ({
    session: localStorage.getItem("tasu_member_session"),
    lastProfile: localStorage.getItem("tasful_last_profile"),
  }));

  if (!storage.session) {
    fail("登録処理: tasu_member_session", "未作成");
  } else {
    const session = JSON.parse(storage.session);
    if (session.email === email && session.nickname === nickname) {
      pass("登録処理: tasu_member_session", session.id);
    } else {
      fail("登録処理: tasu_member_session", JSON.stringify(session));
    }
  }

  if (!storage.lastProfile) {
    fail("登録後: tasful_last_profile", "未保存");
  } else {
    const last = JSON.parse(storage.lastProfile);
    if (last.name === nickname && last.email === email) {
      pass("登録後: tasful_last_profile", last.name);
    } else {
      fail("登録後: tasful_last_profile", JSON.stringify(last));
    }
  }

  await page.waitForFunction(
    (expected) => {
      const welcome = document.querySelector("[data-dash-welcome]");
      const userName = document.querySelector("[data-dash-user-name]");
      const welcomeText = welcome?.textContent || "";
      const userText = userName?.textContent || "";
      const hit =
        welcomeText.includes(expected) ||
        userText.includes(expected);
      return hit && !welcomeText.includes("読み込み中");
    },
    nickname,
    { timeout: 20000 }
  );
  const welcome = await page.locator("[data-dash-welcome]").textContent();
  const userName = await page.locator("[data-dash-user-name]").textContent();
  if (welcome?.includes(nickname) || userName?.includes(nickname)) {
    pass("登録後表示: ダッシュボード名前", nickname);
  } else {
    fail("登録後表示: ダッシュボード名前", welcome || "(空)");
  }

  const avatar = page.locator("[data-dash-avatar]");
  const avatarSrc = await avatar.getAttribute("src");
  if (avatarSrc) {
    pass("登録後表示: アバター", avatarSrc.slice(0, 60));
  } else {
    fail("登録後表示: アバター", "src なし");
  }

  await page.click("[data-dash-logout]");
  await page.waitForURL(/index-top\.html/, { timeout: 10000 });
  pass("ログアウト: index-top.html へ");

  await page.goto(`${BASE}/login.html`, { waitUntil: "domcontentloaded" });
  const lastBox = page.locator("#last-user-box");
  await page.waitForFunction(
    () => {
      const box = document.querySelector("#last-user-box");
      return box && getComputedStyle(box).display !== "none";
    },
    { timeout: 5000 }
  ).catch(() => null);

  const boxVisible = await lastBox.isVisible();
  const lastName = await page.locator(".user-name").textContent();
  if (boxVisible && lastName?.includes(nickname)) {
    pass("ログアウト後: login.html 前回ユーザー", lastName.trim());
  } else {
    fail("ログアウト後: login.html 前回ユーザー", `visible=${boxVisible} name=${lastName}`);
  }

  await page.goto(`${BASE}/signup.html`, { waitUntil: "domcontentloaded" });
  await fillSignupForm(page, { email, password, nickname: "別名" });
  await page.click("[data-signup-submit]");

  const dupError = await isErrorVisible(page, "email");
  const dupText = (await getErrorText(page, "email"))?.trim() || "";
  if (dupError && dupText.includes("既に登録")) {
    pass("重複登録: エラー表示", dupText);
  } else {
    fail("重複登録: エラー表示", dupText || "エラーなし");
  }

  return email;
}

async function main() {
  console.log(`\n会員登録 E2E — ${BASE}\n`);

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const devSkip = await page.goto(`${BASE}/member-auth.js`).then(async (res) => {
      const text = await res?.text();
      return /DEV_SKIP_AUTH\s*=\s*true/.test(text || "");
    });
    if (devSkip) {
      fail("前提条件", "DEV_SKIP_AUTH が true のままです。false にして再実行してください。");
    } else {
      pass("前提条件", "DEV_SKIP_AUTH = false");
    }

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/signup.html`, { waitUntil: "domcontentloaded" });
      await testFormLayout(page, vp.label);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await testValidation(page);
    await testRegistrationFlow(page);
  } catch (err) {
    fail("例外", err instanceof Error ? err.message : String(err));
  }  });
  

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) {
    process.exitCode = 1;
  }
}

main();
