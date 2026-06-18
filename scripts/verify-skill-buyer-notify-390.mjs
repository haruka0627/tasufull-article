#!/usr/bin/env node
/**
 * スキル購入者（u_hiro）通知タブ — CTA遷移 + 390pxレイアウト
 */
import { devices, withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-skill-buyer-notify-390");
const URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_hiro`;
const NOTIFY_ID = "platform-chat-demo-skill-review-b-001";

fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(900);

const audit = await page.evaluate((id) => {
  const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
  const cta = card?.querySelector("[data-talk-notify-action]");
  const dupIds = [...document.querySelectorAll(`[data-talk-notify-id="${id}"]`)].length;
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  document
    .querySelectorAll(
      ".talk-notify-card, .talk-filter-bar, .talk-notify-category-bar, .talk-notify-list"
    )
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) offenders.push({ cls: el.className.slice(0, 40), right: Math.round(r.right) });
    });
  const filterRow = document.querySelector(".talk-filter-bar__row");
  const filterCS = filterRow ? getComputedStyle(filterRow) : null;
  const cardAnchors = card ? [...card.querySelectorAll("a[href]")].length : 0;
  return {
    dupIds,
    role: card?.getAttribute("role"),
    tabindex: card?.getAttribute("tabindex"),
    ctaTag: cta?.tagName?.toLowerCase() || "",
    ctaHref: cta?.getAttribute("data-talk-notify-href") || cta?.getAttribute("href") || "",
    ctaAction: cta?.getAttribute("data-talk-notify-action") || "",
    ctaDupId: cta?.getAttribute("data-talk-notify-id") || "",
    cardAnchors,
    ctaOnlyV: window.__TASU_TALK_NOTIFY_CTA_ONLY_V || "",
    title:
      card?.querySelector(".talk-notify-card__title--job-event")?.textContent?.trim() || "",
    ctaLabel: cta?.textContent?.trim() || "",
    docScrollW: document.documentElement.scrollWidth,
    vw,
    offenders,
    filterDirection: filterCS?.flexDirection || "",
    listPadBottom: getComputedStyle(document.querySelector(".talk-notify-list") || document.body)
      .paddingBottom,
  };
}, NOTIFY_ID);

if (audit.dupIds !== 1) fail(`duplicate notify ids: ${audit.dupIds}`);
else ok("single data-talk-notify-id per card");

if (audit.role === "button" || audit.tabindex === "0") fail("card still role=button/tabindex");
else ok("card without role=button/tabindex");

if (audit.ctaDupId) fail("CTA still has duplicate data-talk-notify-id");
else ok("CTA has no duplicate id");

if (audit.cardAnchors > 0) fail(`card contains ${audit.cardAnchors} anchor(s)`);
else ok("no <a href> inside card");

if (audit.ctaTag !== "button") fail(`CTA tag is ${audit.ctaTag || "missing"}, expected button`);
else ok("CTA is button (no native link)");

if (audit.ctaOnlyV !== "3") fail(`stale JS version: ${audit.ctaOnlyV || "missing"}`);
else ok("notify CTA-only v3 loaded");

if (!audit.ctaHref.includes("chat-detail.html")) fail(`CTA href: ${audit.ctaHref}`);
else ok("CTA href present");

if (audit.ctaAction !== "navigate") fail(`CTA action: ${audit.ctaAction}`);
else ok("CTA data-talk-notify-action=navigate");

if (audit.title !== "評価をお願いします") fail(`title: ${audit.title}`);
else ok("review notify visible for buyer");

if (audit.docScrollW > audit.vw + 1) {
  fail(`horizontal overflow doc=${audit.docScrollW} vw=${audit.vw}`);
} else ok(`no page horizontal overflow (${audit.docScrollW}px)`);

if (audit.offenders.length) fail(`offenders: ${JSON.stringify(audit.offenders)}`);
else ok("notify UI within viewport");

if (audit.filterDirection !== "column") fail(`filter row direction: ${audit.filterDirection}`);
else ok("filter bar stacks on mobile");

await page.screenshot({ path: path.join(OUT, "01-notify-list-390.png"), fullPage: false });

const card = page.locator(`article[data-talk-notify-id="${NOTIFY_ID}"]`).first();
const title = card.locator(".talk-notify-card__title, .talk-notify-card__title--job-event").first();

let navigated = false;
const onNav = (f) => {
  if (f.url().includes("chat-detail.html")) navigated = true;
};
page.on("framenavigated", onNav);

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(400);

navigated = false;
await title.tap({ force: true });
await page.waitForTimeout(800);
if (navigated) fail("title tap navigated (card body must not navigate)");
else ok("title tap does not navigate");

navigated = false;
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`article[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
const list = page.locator(".talk-notify-list");
await list.evaluate((el) => {
  el.scrollTop = 0;
});
await title.tap({ force: true });
await page.waitForTimeout(300);
await list.evaluate((el) => {
  el.scrollTop = Math.min(el.scrollHeight, 120);
});
await page.waitForTimeout(300);
if (navigated) fail("navigation during scroll/title tap");
else ok("scroll + title tap does not navigate");

const ctaBox = await card.locator("[data-talk-notify-action]").first().boundingBox();
if (!ctaBox || ctaBox.height < 44) fail(`CTA height < 44px: ${ctaBox?.height ?? 0}`);
else ok(`CTA tap target height ${Math.round(ctaBox.height)}px`);

navigated = false;
const cta = card.locator("[data-talk-notify-action]").first();
await cta.tap();
await page.waitForTimeout(2000);

if (!navigated) fail("CTA tap did not navigate");
else ok(`CTA tap -> ${page.url().split("?")[0]}`);

if (!page.url().includes("userId=u_hiro")) fail(`missing buyer userId: ${page.url()}`);
else ok("buyer userId preserved");

await page.screenshot({ path: path.join(OUT, "02-review-chat-390.png"), fullPage: false });

});
if (failed) {
  console.log("\nVERIFY FAILED");
  await closeAllBrowsers();
  process.exit(1);
}
console.log("\nVERIFY PASSED");
