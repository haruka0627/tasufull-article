#!/usr/bin/env node
/**
 * /builder/ と /builder/project-calendar のサイドバー一致検証
 *
 *   node scripts/verify-builder-sidebar-parity.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "builder/index.html" });
const builderUrl = buildLocalPageUrl(base, "builder/");
const calendarUrl = buildLocalPageUrl(base, "builder/project-calendar.html");

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  errors.push(m);
  console.log(`  ✗ ${m}`);
};

function sidebarSnapshot(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector(".builder-partner-sidebar");
    if (!sidebar) return null;
    const cs = getComputedStyle(sidebar);
    const links = Array.from(sidebar.querySelectorAll(".builder-partner-sidebar__nav .builder-partner-sidebar__link")).map(
      (el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        href: el.getAttribute("href") || "",
        view: el.getAttribute("data-builder-partner-view") || "",
        active: el.classList.contains("is-active"),
      })
    );
    return {
      width: cs.width,
      backgroundColor: cs.backgroundColor,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      fontSize: cs.fontSize,
      links,
    };
  });
}

console.log("Builder:", builderUrl);
console.log("Calendar:", calendarUrl);

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(builderUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  const builderSnap = await sidebarSnapshot(page);
  if (builderSnap) pass("builder sidebar found");
  else fail("builder sidebar missing");

  await page.goto(calendarUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  const calendarSnap = await sidebarSnapshot(page);
  if (calendarSnap) pass("calendar sidebar found");
  else fail("calendar sidebar missing");

  if (builderSnap && calendarSnap) {
    for (const key of ["width", "backgroundColor", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
      if (builderSnap[key] === calendarSnap[key]) pass(`${key} match (${builderSnap[key]})`);
      else fail(`${key} mismatch builder=${builderSnap[key]} calendar=${calendarSnap[key]}`);
    }

    if (builderSnap.links.length === calendarSnap.links.length) {
      pass(`nav item count ${builderSnap.links.length}`);
    } else {
      fail(`nav count builder=${builderSnap.links.length} calendar=${calendarSnap.links.length}`);
    }

    builderSnap.links.forEach((link, i) => {
      const other = calendarSnap.links[i];
      if (!other) return;
      const label = link.text.slice(0, 20);
      if (link.tag === other.tag && link.text === other.text && link.href === other.href && link.view === other.view) {
        pass(`nav[${i}] markup match: ${label}`);
      } else {
        fail(`nav[${i}] mismatch builder=${JSON.stringify(link)} calendar=${JSON.stringify(other)}`);
      }
    });
  }

  const calActive = calendarSnap?.links.find((l) => l.text.startsWith("案件カレンダー"));
  if (calActive?.active) pass("案件カレンダー is-active on calendar page");
  else fail("案件カレンダー not active on calendar page");

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  if (consoleErrors.length === 0) pass("no console errors on calendar page");
  else fail(`console errors: ${consoleErrors.join(" | ")}`);
});

await closeAllBrowsers();

console.log(`\n${errors.length === 0 ? "PASS" : "FAIL"} (${errors.length} errors)`);
if (errors.length) process.exitCode = 1;
