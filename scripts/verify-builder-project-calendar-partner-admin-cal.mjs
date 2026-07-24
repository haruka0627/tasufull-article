#!/usr/bin/env node
/**
 * project-calendar — パートナー案件: 受ける/受けないボタン表示
 *
 *   node scripts/verify-builder-project-calendar-partner-admin-cal.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });
const url = buildLocalPageUrl(base, "builder/project-calendar.html?role=partner");

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

  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  if ((res?.status() ?? 0) === 200) pass("HTTP 200");
  else fail(`HTTP ${res?.status() ?? 0}`);

  await page.locator('[data-builder-pc-source="partner"]').click();
  await page.waitForTimeout(400);

  const partnerSection = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
  if (await partnerSection.isVisible()) pass("partner embed section visible");
  else fail("partner embed section hidden");

  const search = partnerSection.locator("[data-admin-cal-filter-keyword]");
  if (await search.isVisible()) pass("案件検索 input visible");
  else fail("案件検索 input missing");

  await partnerSection.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 8000 });

  const badges = partnerSection.locator(".admin-cal-badge");
  const badgeCount = await badges.count();
  if (badgeCount >= 1) pass(`partner events on calendar: ${badgeCount}`);
  else fail("no partner events on calendar");

  let clickedPending = false;
  for (let i = 0; i < badgeCount; i += 1) {
    await badges.nth(i).click();
    await page.waitForTimeout(250);
    const acceptBtn = partnerSection.locator("[data-partner-cal-accept]");
    const declineBtn = partnerSection.locator("[data-partner-cal-decline]");
    if ((await acceptBtn.count()) >= 1 && (await declineBtn.count()) >= 1) {
      clickedPending = true;
      const acceptText = (await acceptBtn.textContent())?.trim();
      const declineText = (await declineBtn.textContent())?.trim();
      if (acceptText === "受ける" && declineText === "受けない") {
        pass("受ける / 受けない buttons visible in detail panel");
      } else {
        fail(`button labels unexpected: ${acceptText} / ${declineText}`);
      }
      const card = partnerSection.locator(".admin-cal-card");
      const cardText = (await card.textContent()) || "";
      for (const label of ["作業日", "指示書PDF", "現場住所", "備考", "依頼者"]) {
        if (cardText.includes(label)) pass(`detail field present: ${label}`);
        else fail(`detail field missing: ${label}`);
      }
      break;
    }
  }
  if (!clickedPending) fail("no pending assignment with 受ける/受けない found — click each badge");

  if (consoleErrors.length === 0) pass("no console errors");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
