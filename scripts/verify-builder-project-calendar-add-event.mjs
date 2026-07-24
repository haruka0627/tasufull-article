#!/usr/bin/env node
/**
 * project-calendar — 汎用カレンダー: ＋予定追加（拡張項目）→ 作成 → 表示 → 詳細
 *
 *   node scripts/verify-builder-project-calendar-add-event.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const STORAGE_KEY = "tasu_builder_general_calendar_v1";
const TEST_TITLE = `E2E予定_${Date.now()}`;
const TEST_LOCATION = "本社ミーティングルームA";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const url = buildLocalPageUrl(base, "builder/project-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

console.log("URL:", url);

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.addInitScript((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, STORAGE_KEY);

  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  if ((res?.status() ?? 0) === 200) pass("HTTP 200");
  else fail(`HTTP ${res?.status() ?? 0}`);

  const addBtn = page.locator("[data-builder-cal-add-event]");
  if ((await addBtn.count()) >= 1 && (await addBtn.isVisible())) pass("＋予定追加 button visible");
  else fail("＋予定追加 button missing");

  await addBtn.click();
  const modal = page.locator("[data-builder-cal-modal]");
  await modal.waitFor({ state: "visible", timeout: 5000 });
  if (await modal.isVisible()) pass("add-event modal opened");
  else fail("add-event modal not opened");

  for (const label of ["終日予定", "場所", "通知", "繰り返し"]) {
    if ((await modal.getByText(label, { exact: true }).count()) >= 1) pass(`modal field label: ${label}`);
    else fail(`modal field label missing: ${label}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  await page.locator("[data-builder-cal-field-title]").fill(TEST_TITLE);
  await page.locator("[data-builder-cal-field-kind]").selectOption("meeting");
  await page.locator("[data-builder-cal-field-start-date]").fill(today);
  await page.locator("[data-builder-cal-field-start-time]").fill("14:00");
  await page.locator("[data-builder-cal-field-end-date]").fill(today);
  await page.locator("[data-builder-cal-field-end-time]").fill("15:30");
  await page.locator("[data-builder-cal-field-all-day]").check();
  const startTimeDisabled = await page.locator("[data-builder-cal-field-start-time]").isDisabled();
  const endTimeDisabled = await page.locator("[data-builder-cal-field-end-time]").isDisabled();
  if (startTimeDisabled && endTimeDisabled) pass("all-day disables time inputs");
  else fail("all-day should disable time inputs");
  await page.locator("[data-builder-cal-field-location]").fill(TEST_LOCATION);
  await page.locator("[data-builder-cal-field-notification]").selectOption("30m");
  await page.locator("[data-builder-cal-field-recurrence]").selectOption("weekly");
  await page.locator("[data-builder-cal-field-memo]").fill("Playwright E2E メモ");
  await page.locator('label:has(input[name="color"][value="#3b82f6"])').click();

  await page.locator("[data-builder-cal-modal-submit]").click();
  await modal.waitFor({ state: "hidden", timeout: 5000 });
  if (await modal.isHidden()) pass("modal closed after save");
  else fail("modal still open after save");

  const personalEvent = page.locator(".builder-cal-event.is-personal", { hasText: TEST_TITLE }).first();
  await personalEvent.waitFor({ state: "visible", timeout: 5000 });
  if ((await personalEvent.count()) >= 1) pass(`personal event on calendar: ${TEST_TITLE}`);
  else fail("personal event not rendered on calendar");

  const eventTime = (await personalEvent.locator(".builder-cal-event__time").textContent())?.trim() || "";
  if (eventTime === "終日") pass("calendar tag shows 終日 for all-day event");
  else fail(`calendar time label expected 終日, got: ${eventTime}`);

  await personalEvent.click();
  await page.waitForTimeout(200);

  const detailTitle = page.locator(".builder-cal-detail__title");
  const detailText = (await detailTitle.textContent())?.trim() || "";
  if (detailText === TEST_TITLE) pass(`detail panel title: ${detailText}`);
  else fail(`detail title mismatch: ${detailText}`);

  const detailBody = (await page.locator("[data-builder-cal-detail-body]").textContent()) || "";
  if (detailBody.includes("打ち合わせ")) pass("detail kind badge: 打ち合わせ");
  else fail("detail kind badge missing");

  if (detailBody.includes("終日")) pass("detail time: 終日");
  else fail("detail time should show 終日");

  if (detailBody.includes(TEST_LOCATION)) pass(`detail location: ${TEST_LOCATION}`);
  else fail("detail location missing");

  if (detailBody.includes("30分前")) pass("detail notification: 30分前");
  else fail("detail notification missing");

  if (detailBody.includes("毎週")) pass("detail recurrence: 毎週");
  else fail("detail recurrence missing");

  if (detailBody.includes("Playwright E2E メモ")) pass("detail memo present");
  else fail("detail memo missing");

  const editBtn = page.locator("[data-builder-cal-edit-personal]");
  const deleteBtn = page.locator("[data-builder-cal-delete-personal]");
  if ((await editBtn.count()) >= 1 && (await deleteBtn.count()) >= 1) pass("personal edit/delete actions visible");
  else fail("personal edit/delete actions missing");

  const stored = await page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }, STORAGE_KEY);
  const row = Array.isArray(stored) ? stored.find((e) => e.title === TEST_TITLE) : null;
  if (row) pass("event persisted in localStorage");
  else fail("event not found in localStorage");

  if (row?.allDay === true) pass("stored allDay=true");
  else fail("stored allDay missing or false");

  if (row?.location === TEST_LOCATION) pass("stored location");
  else fail("stored location mismatch");

  if (row?.notification === "30m" && row?.recurrence === "weekly") pass("stored notification & recurrence");
  else fail("stored notification/recurrence mismatch");

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
