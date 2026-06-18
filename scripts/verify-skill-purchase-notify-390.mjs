#!/usr/bin/env node
/**
 * 最優先確認: スキル購入通知 → CTA 390px + タップ遷移 + 購入直後チャット
 */
import { chromium, devices } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-skill-purchase-notify-390");
const NOTIFY_ID = "platform-chat-demo-skill-purchase-001";
const NOTIFY_URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_sachi`;

const EXPECT_TITLE = "スキルが購入されました";
const EXPECT_CTA = "チャットを開く";
const EXPECT_CHAT_SNIPPETS = [
  "ご購入ありがとうございます",
  "LP改修の構成案を共有します",
];
const FORBIDDEN_CHAT = "納品物の確認をお願いします";

fs.mkdirSync(OUT, { recursive: true });

const iphone = devices["iPhone 13"];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...iphone,
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const page = await context.newPage();

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(900);

const card = page.locator(`article[data-talk-notify-id="${NOTIFY_ID}"]`);
const cta = card.locator("[data-talk-notify-action]").first();

const audit = await page.evaluate((id) => {
  const vw = document.documentElement.clientWidth;
  const cardEl = document.querySelector(`[data-talk-notify-id="${id}"]`);
  const ctaEl = cardEl?.querySelector("[data-talk-notify-action]");
  const cardRect = cardEl?.getBoundingClientRect();
  const ctaRect = ctaEl?.getBoundingClientRect();
  const ctaCS = ctaEl ? getComputedStyle(ctaEl) : null;
  const list = document.querySelector(".talk-notify-list");
  return {
    vw,
    listScrollW: list?.scrollWidth ?? 0,
    eventTitle: cardEl?.querySelector(".talk-notify-card__title--job-event")?.textContent?.trim() || "",
    ctaLabel: ctaEl?.textContent?.trim() || "",
    ctaHref: ctaEl?.getAttribute("href") || "",
    card: cardRect
      ? {
          w: Math.round(cardRect.width),
          left: Math.round(cardRect.left),
          right: Math.round(cardRect.right),
        }
      : null,
    cta: ctaRect
      ? {
          w: Math.round(ctaRect.width),
          h: Math.round(ctaRect.height),
          left: Math.round(ctaRect.left),
          right: Math.round(ctaRect.right),
          top: Math.round(ctaRect.top),
        }
      : null,
    ctaVisible:
      ctaCS &&
      ctaCS.display !== "none" &&
      ctaCS.visibility !== "hidden" &&
      Number(ctaCS.opacity) > 0.5 &&
      ctaCS.pointerEvents !== "none",
    ctaWhiteSpace: ctaCS?.whiteSpace || "",
  };
}, NOTIFY_ID);

console.log("Audit:", JSON.stringify(audit, null, 2));

await page.waitForTimeout(400);
await page.locator(`article[data-talk-notify-id="${NOTIFY_ID}"]`).screenshot({
  path: path.join(OUT, "01-skill-purchase-notify-card-390.png"),
});
await page.screenshot({ path: path.join(OUT, "02-notify-list-390.png"), fullPage: false });

if (audit.eventTitle !== EXPECT_TITLE) fail(`title: ${audit.eventTitle}`);
else ok(`title: ${EXPECT_TITLE}`);

if (audit.ctaLabel !== EXPECT_CTA) fail(`CTA label: ${audit.ctaLabel}`);
else ok(`CTA label: ${EXPECT_CTA}`);

if (!audit.ctaHref.includes("chat-detail.html")) fail(`href: ${audit.ctaHref}`);
else ok(`href has chat-detail.html`);

if (!audit.ctaVisible) fail("CTA not visible (display/opacity/pointer-events)");
else ok("CTA visible");

if (audit.ctaWhiteSpace === "nowrap") fail("CTA white-space: nowrap");
else ok(`CTA wraps (${audit.ctaWhiteSpace})`);

if (audit.listScrollW > audit.vw + 1) fail(`list overflow ${audit.listScrollW} > ${audit.vw}`);
else ok(`no list horizontal overflow (${audit.listScrollW}px)`);

if (!audit.card || audit.card.right > audit.vw + 1) {
  fail(`card overflows viewport right=${audit.card?.right}`);
} else ok(`card inside viewport (w=${audit.card.w}, right=${audit.card.right})`);

if (!audit.cta || audit.cta.right > audit.vw + 1) {
  fail(`CTA overflows viewport right=${audit.cta?.right}`);
} else ok(`CTA inside viewport (w=${audit.cta.w}, h=${audit.cta.h}, right=${audit.cta.right})`);

if (!audit.cta || audit.cta.h < 36) fail(`CTA too short h=${audit.cta?.h}`);
else ok(`CTA tap height ${audit.cta.h}px`);

await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(`[data-talk-notify-id="${NOTIFY_ID}"]`);
await page.waitForTimeout(500);

await cta.tap();
await page.waitForURL((url) => url.href.includes("chat-detail.html"), { timeout: 15000 });
const dest = page.url();
ok(`tap navigated -> ${dest.split("?")[0]}`);

if (!dest.includes("demoNotify=platform-chat-demo-skill-purchase-001")) {
  fail(`missing demoNotify param: ${dest}`);
} else ok("demoNotify param present");

if (!dest.includes("demoState=active")) fail(`missing demoState=active: ${dest}`);
else ok("demoState=active");

await page.waitForTimeout(1500);
const chatAudit = await page.evaluate(
  ({ snippets, forbidden }) => {
    const texts = [...document.querySelectorAll(".chat-bubble__text, .chat-msg__text, [data-chat-message-text]")]
      .map((el) => el.textContent?.trim() || "")
      .filter(Boolean);
    const bodyText = document.body.innerText || "";
    return {
      texts,
      hasSnippets: snippets.every((s) => bodyText.includes(s)),
      hasForbidden: bodyText.includes(forbidden),
      missing: snippets.filter((s) => !bodyText.includes(s)),
    };
  },
  { snippets: EXPECT_CHAT_SNIPPETS, forbidden: FORBIDDEN_CHAT }
);

console.log("Chat texts:", chatAudit.texts);

if (!chatAudit.hasSnippets) fail(`chat missing: ${chatAudit.missing.join(", ")}`);
else ok("purchase chat snippets present");

if (chatAudit.hasForbidden) fail(`wrong scene text: ${FORBIDDEN_CHAT}`);
else ok(`no wrong scene text (${FORBIDDEN_CHAT})`);

await page.screenshot({ path: path.join(OUT, "03-skill-purchase-chat-390.png"), fullPage: false });

await browser.close();
if (failed) process.exit(1);
console.log("\nSkill purchase notify flow: ALL PASSED");
console.log(`Screenshots: ${OUT}`);
