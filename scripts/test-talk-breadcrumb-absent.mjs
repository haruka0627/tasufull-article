#!/usr/bin/env node
/**
 * TALK チャット画面 — 「TALK > TALK」パンくず非表示（390〜960px）
 *   node scripts/test-talk-breadcrumb-absent.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });
const THREAD_ID = "talk-mock-friend-001";
const CHAT_DETAIL_THREAD = "chat-demo-skill-deal-001";

const VIEWPORTS = [
  { label: "390px", width: 390, height: 844, isMobile: true },
  { label: "960px", width: 960, height: 900, isMobile: false },
];

function talkUrl(params = {}) {
  const sp = new URLSearchParams({ talkDev: "1", tab: "chat", ...params });
  return buildLocalPageUrl(base, "talk-home.html", `?${sp}`);
}

function chatDetailUrl() {
  return buildLocalPageUrl(
    base,
    "chat-detail.html",
    `?thread=${CHAT_DETAIL_THREAD}&userId=u_me&talkDev=1&review=chat-demo`
  );
}

async function assertNoTalkBreadcrumb(page, contextLabel) {
  const result = await page.evaluate(() => {
    const navs = [...document.querySelectorAll("[data-breadcrumb]")];
    const visibleNav = navs.find((nav) => {
      if (nav.hidden) return false;
      const text = (nav.textContent || "").replace(/\s+/g, " ").trim();
      return text.length > 0;
    });
    const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ");
    const hasTalkTalk = /\bTALK\s*[＞>]\s*TALK\b/.test(bodyText);
    const leftRail = document.querySelector(".talk-line-list-col, .talk-line-split");
    const leftText = (leftRail?.innerText || "").replace(/\s+/g, " ");
    const leftHasTalkTalk = /\bTALK\s*[＞>]\s*TALK\b/.test(leftText);
    return {
      navCount: navs.length,
      visibleNavText: visibleNav ? (visibleNav.textContent || "").trim() : "",
      hasTalkTalk,
      leftHasTalkTalk,
    };
  });

  const errors = [];
  if (result.navCount > 0 && result.visibleNavText) {
    errors.push(`visible breadcrumb nav: "${result.visibleNavText}"`);
  }
  if (result.hasTalkTalk) errors.push('body contains "TALK > TALK"');
  if (result.leftHasTalkTalk) errors.push('left column contains "TALK > TALK"');
  return { ok: errors.length === 0, errors, result };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const failures = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    failures.push(m);
    console.log(`  ✗ ${m}`);
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n--- viewport ${vp.label} ---`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
    });
    page.on("pageerror", (e) => consoleErrors.push(`${vp.label} pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`${vp.label} console: ${msg.text()}`);
    });

    await page.goto(talkUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".talk-line-list__item", { timeout: 15000 });
    let check = await assertNoTalkBreadcrumb(page, `${vp.label} list`);
    if (check.ok) pass(`${vp.label} talk-home list: no TALK > TALK`);
    else fail(`${vp.label} talk-home list: ${check.errors.join("; ")}`);

    await page.goto(talkUrl({ thread: THREAD_ID }), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".talk-line-split--room-open, .talk-line-room", { timeout: 15000 }).catch(() => {});
    check = await assertNoTalkBreadcrumb(page, `${vp.label} thread`);
    if (check.ok) pass(`${vp.label} talk-home thread: no TALK > TALK`);
    else fail(`${vp.label} talk-home thread: ${check.errors.join("; ")}`);

    await page.goto(chatDetailUrl(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(".chat-shell, .chat-detail", { timeout: 15000 });
    check = await assertNoTalkBreadcrumb(page, `${vp.label} chat-detail`);
    if (check.ok) pass(`${vp.label} chat-detail: no TALK > TALK`);
    else fail(`${vp.label} chat-detail: ${check.errors.join("; ")}`);

    await page.close();
  }

  await browser.close();

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail(`console: ${e}`));
  } else {
    pass("console errors: 0");
  }

  if (failures.length) {
    console.error(`\nFAIL (${failures.length})`);
    process.exit(1);
  }
  console.log("\nPASS talk breadcrumb absent (390/960)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
