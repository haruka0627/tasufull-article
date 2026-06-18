#!/usr/bin/env node
/**
 * 通知設定 — Playwright E2E
 *
 *   node scripts/test-notification-settings-browser.mjs
 *   BASE_URL=http://127.0.0.1:5179 node scripts/test-notification-settings-browser.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_PATH = "/notification-settings.html";
const STORAGE_KEY = "tasful_notification_settings";

const TOGGLE_KEYS = [
  "email",
  "site",
  "line",
  "sms",
  "newMessage",
  "estimateRequest",
  "consultChat",
  "dealStarted",
  "dealCompleted",
  "feePayment",
  "favoriteAdded",
  "listingStatus",
];

const USER_FACING_TOGGLES = [
  { key: "newMessage", label: "メッセージ通知（新しいメッセージ）" },
  { key: "dealStarted", label: "取引通知（取引開始）" },
  { key: "listingStatus", label: "掲載通知（掲載審査・公開）" },
  { key: "site", label: "お知らせ通知（サイト内通知）" },
  { key: "email", label: "メール通知" },
  { key: "site", label: "ブラウザ通知相当（サイト内通知）" },
];

const DEFAULTS = {
  email: true,
  site: true,
  line: false,
  sms: false,
  newMessage: true,
  estimateRequest: true,
  consultChat: true,
  dealStarted: true,
  dealCompleted: true,
  feePayment: true,
  favoriteAdded: false,
  listingStatus: true,
  frequency: "instant",
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

async function gotoNotifyPage(page) {
  await page.goto(`${BASE}${PAGE_PATH}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-notify-form]", { timeout: 15000 });
  await page
    .waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 20000 })
    .catch(() => null);
}

async function resetNotifyStorage(page) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}

async function readStoredSettings(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

async function readFormState(page) {
  return page.evaluate((keys) => {
    const out = {
      frequency: document.querySelector("[data-notify-frequency]")?.value || "",
    };
    keys.forEach((key) => {
      out[key] = Boolean(document.querySelector(`[data-notify-toggle="${key}"]`)?.checked);
    });
    return out;
  }, TOGGLE_KEYS);
}

async function setToggle(page, key, checked) {
  await page.evaluate(
    ({ key, checked }) => {
      const el = document.querySelector(`[data-notify-toggle="${key}"]`);
      if (!el) throw new Error(`toggle not found: ${key}`);
      el.checked = checked;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { key, checked }
  );
}

async function clickToggleLabel(page, key) {
  const label = page.locator(`label.dash-toggle:has([data-notify-toggle="${key}"])`);
  await label.click();
}

async function submitForm(page) {
  await page.locator('[data-notify-form] button[type="submit"]').click();
}

function verifyMemberAuthGuardSource() {
  const src = readFileSync(join(ROOT, "member-auth.js"), "utf8");
  const hasPage = /MEMBER_GUARD_PAGES[\s\S]*notification-settings/.test(src);
  const hasGuard = /async function guardMemberPage\s*\(/.test(src);
  const hasBoot = /bootAuthGuards|guardMemberPage\(\)/.test(src);
  return hasPage && hasGuard && hasBoot;
}

async function testPageLayout(page, label, consoleErrors) {
  const checks = [
    ["#dashSidebar", "サイドバー"],
    ["#dashSidebarNav a.dash-nav-link", "サイドバーナビ"],
    [".dash-header__title", "ヘッダータイトル"],
    ["[data-notify-form]", "通知設定フォーム"],
    ['label.dash-toggle:has([data-notify-toggle="email"])', "メール通知トグル"],
    ["[data-notify-frequency]", "通知頻度"],
  ];
  for (const [sel, name] of checks) {
    const loc = page.locator(sel).first();
    const visible = await loc.isVisible();
    const attached = (await loc.count()) > 0;
    if (!visible && !attached) {
      fail(`${label}: ページ表示 — ${name}`, sel);
      return;
    }
    if (!visible && attached && sel.includes("dash-toggle")) {
      /* カスタムトグル input は visually hidden のため label の存在で判定 */
    } else if (!visible) {
      fail(`${label}: ページ表示 — ${name}`, sel);
      return;
    }
  }
  const cardBox = await page.locator(".dash-notify-form").boundingBox();
  if (!cardBox || cardBox.width < 200) {
    fail(`${label}: レイアウト`, "フォーム幅が異常");
    return;
  }
  const severe = consoleErrors.filter(
    (e) => e.type === "error" && !/favicon|404|Failed to load resource/i.test(e.text)
  );
  if (severe.length) {
    fail(`${label}: コンソールエラー`, severe.map((e) => e.text).join(" | "));
  } else {
    pass(`${label}: ページ表示`, `フォーム幅 ${Math.round(cardBox.width)}px`);
  }
}

async function testInitialDefaults(page) {
  await resetNotifyStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-notify-form]", { timeout: 15000 });

  const form = await readFormState(page);
  let ok = true;
  for (const key of TOGGLE_KEYS) {
    if (form[key] !== DEFAULTS[key]) {
      fail("初期状態: デフォルト値", `${key} expected=${DEFAULTS[key]} got=${form[key]}`);
      ok = false;
    }
  }
  if (form.frequency !== DEFAULTS.frequency) {
    fail("初期状態: 通知頻度", form.frequency);
    ok = false;
  }
  if (ok) pass("初期状態: デフォルト値", "未設定でもエラーなし");

  const stored = await readStoredSettings(page);
  if (stored !== null) {
    fail("初期状態: localStorage", "未保存時にキーが存在");
  } else {
    pass("初期状態: localStorage", "未設定キーなし");
  }
}

async function testToggleAndSave(page) {
  await resetNotifyStorage(page);
  await gotoNotifyPage(page);

  const target = {
    email: false,
    site: false,
    newMessage: false,
    dealStarted: false,
    dealCompleted: true,
    listingStatus: false,
    favoriteAdded: true,
    frequency: "daily",
  };

  for (const [key, value] of Object.entries(target)) {
    if (key === "frequency") {
      await page.selectOption("[data-notify-frequency]", value);
    } else {
      await setToggle(page, key, value);
    }
  }

  for (const item of USER_FACING_TOGGLES) {
    const el = page.locator(`[data-notify-toggle="${item.key}"]`);
    if (!(await el.count())) {
      fail(`ON/OFF切替: ${item.label}`, "要素なし");
      continue;
    }
    const before = await el.isChecked();
    await clickToggleLabel(page, item.key);
    const after = await el.isChecked();
    if (before === after) {
      fail(`ON/OFF切替: ${item.label}`, "ラベルクリックで切替不可");
    } else {
      pass(`ON/OFF切替: ${item.label}`, `${before} → ${after}`);
    }
    await setToggle(page, item.key, before);
  }

  for (const [key, value] of Object.entries(target)) {
    if (key === "frequency") {
      await page.selectOption("[data-notify-frequency]", value);
    } else {
      await setToggle(page, key, value);
    }
  }

  await submitForm(page);
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-notify-toast]");
      return t && !t.hidden && /保存/.test(t.textContent || "");
    },
    { timeout: 5000 }
  );
  const toast = await page.locator("[data-notify-toast]").textContent();
  if (toast?.includes("保存")) {
    pass("保存処理: 完了メッセージ", toast.trim());
  } else {
    fail("保存処理: 完了メッセージ", toast || "(なし)");
  }

  const stored = await readStoredSettings(page);
  if (!stored) {
    fail("保存処理: localStorage", "未保存");
    return target;
  }

  let storageOk = true;
  for (const [key, value] of Object.entries(target)) {
    if (stored[key] !== value) {
      fail("保存処理: localStorage", `${key} expected=${value} got=${stored[key]}`);
      storageOk = false;
    }
  }
  if (storageOk) pass("保存処理: localStorage", STORAGE_KEY);

  return target;
}

async function testRestore(page, expected) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-notify-form]", { timeout: 15000 });
  const form = await readFormState(page);
  let ok = true;
  for (const [key, value] of Object.entries(expected)) {
    if (key === "frequency") {
      if (form.frequency !== value) ok = false;
    } else if (form[key] !== value) {
      ok = false;
    }
  }
  if (ok) {
    pass("復元: 再読み込み", "保存状態を維持");
  } else {
    fail("復元: 再読み込み", JSON.stringify(form));
  }

  await page.goto(`${BASE}/dashboard.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dashSidebarNav", { timeout: 15000 });
  await page.goto(`${BASE}${PAGE_PATH}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-notify-form]", { timeout: 15000 });
  const form2 = await readFormState(page);
  let ok2 = true;
  for (const [key, value] of Object.entries(expected)) {
    if (key === "frequency") {
      if (form2.frequency !== value) ok2 = false;
    } else if (form2[key] !== value) {
      ok2 = false;
    }
  }
  if (ok2) {
    pass("復元: ダッシュボード経由", "保存状態を維持");
  } else {
    fail("復元: ダッシュボード経由", JSON.stringify(form2));
  }
}

async function testLoginGuard(page) {
  const devSkip = await page.evaluate(() => window.TasuMemberAuth?.DEV_SKIP_AUTH === true);
  if (!devSkip) {
    fail("ログインガード: DEV_SKIP_AUTH", "true ではない");
    return;
  }
  await gotoNotifyPage(page);
  const url = page.url();
  if (/login\.html/i.test(url)) {
    fail("ログインガード: DEV_SKIP_AUTH=true", "login.html へリダイレクト");
  } else {
    pass("ログインガード: DEV_SKIP_AUTH=true", "リダイレクトなし");
  }

  if (verifyMemberAuthGuardSource()) {
    pass("ログインガード: guardMemberPage", "notification-settings が MEMBER_GUARD_PAGES に登録");
  } else {
    fail("ログインガード: guardMemberPage", "member-auth.js の設定不足");
  }
}

async function main() {
  console.log(`\n通知設定 E2E — ${BASE}${PAGE_PATH}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ type: "error", text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ type: "error", text: err.message });
  });

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoNotifyPage(page);
    await testPageLayout(page, "PC 1280px", consoleErrors);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoNotifyPage(page);
    await testPageLayout(page, "スマホ 390px", consoleErrors);

    await page.setViewportSize({ width: 1280, height: 800 });
    await testInitialDefaults(page);
    const saved = await testToggleAndSave(page);
    await testRestore(page, saved);
    await testLoginGuard(page);
  } catch (err) {
    fail("例外", err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();
