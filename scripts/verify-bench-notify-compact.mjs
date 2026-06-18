#!/usr/bin/env node
/**
 * Bench iframe — 通知タブ compact（CTA がスクロールなしで見える）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const issues = [];

function benchNotifyUrl(userId) {
  const u = new URL(`${BASE}/talk-home.html`);
  u.searchParams.set("tab", "notify");
  u.searchParams.set("userId", userId);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", "skill");
  u.searchParams.set("benchEmbed", "1");
  u.searchParams.set("benchViewport", "1280");
  return u.href;
}

async function measure(label, url, setup, viewport = { width: 1280, height: 420 }) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  if (setup) await setup(page);
  await page.waitForTimeout(900);

  const m = await page.evaluate(() => {
    const body = document.body;
    const cta = document.querySelector(
      ".talk-notify-card__minimal-action, .talk-notify-card__card-cta, [data-talk-notify-action]"
    );
    const list = document.querySelector("[data-talk-notify-list]");
    const ctaRect = cta?.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    return {
      compact: body.classList.contains("talk-bench-notify-compact"),
      benchEmbed: body.dataset.benchEmbed,
      cards: document.querySelectorAll(".talk-notify-card").length,
      ctaText: cta?.textContent?.trim() || null,
      ctaBottom: ctaRect ? Math.round(ctaRect.bottom) : null,
      ctaTop: ctaRect ? Math.round(ctaRect.top) : null,
      vh,
      vw,
      ctaInView: ctaRect ? ctaRect.bottom <= vh + 1 && ctaRect.top >= -1 : false,
      docOverflowY: document.documentElement.scrollHeight > vh + 2,
      docOverflowX: document.documentElement.scrollWidth > vw + 2,
      listScrollable: list ? list.scrollHeight > list.clientHeight + 2 : false,
      listOverflowY: list ? getComputedStyle(list).overflowY : null,
    };
  });
  await page.close();
  console.log(`[${label}]`, m);
  return m;
}

try {
  const empty = await measure("empty", benchNotifyUrl("u_sachi"));
  if (!empty.compact) issues.push("empty: missing talk-bench-notify-compact class");
  if (empty.benchEmbed !== "1") issues.push("empty: benchEmbed dataset missing");

  const purchased = await measure("purchased", benchNotifyUrl("u_sachi"), async (page) => {
    await page.waitForFunction(() => window.TasuTalkPlatformNotify?.notifySkillPurchased);
    await page.evaluate(() => {
      window.TasuTalkPlatformNotify.notifySkillPurchased({
        listing: { id: "demo-skill-001", title: "LP改修スキル", user_id: "u_sachi" },
        contact: {
          contact_id: "contact-demo-skill-dual-001",
          requester_name: "ひろ",
          requester_id: "u_hiro",
        },
        thread: {
          sellerId: "u_sachi",
          listingId: "demo-skill-001",
          listingTitle: "LP改修スキル",
        },
      });
    });
    await page.waitForSelector(".talk-notify-card", { timeout: 10000 });
  });

  if (purchased.cards < 1) issues.push(`purchased: no notify cards (${purchased.cards})`);
  if (!purchased.ctaInView) {
    issues.push(
      `purchased: CTA not in view (top=${purchased.ctaTop}, bottom=${purchased.ctaBottom}, vh=${purchased.vh})`
    );
  }
  if (purchased.listScrollable) issues.push("purchased: notify list requires scroll");
  if (purchased.docOverflowY) issues.push("purchased: document vertical overflow");
  if (purchased.docOverflowX) issues.push("purchased: document horizontal overflow");
  if (purchased.ctaText && !/購入者|確認/.test(purchased.ctaText)) {
    issues.push(`purchased: unexpected CTA text "${purchased.ctaText}"`);
  }

  if (issues.length) {
    console.error("\nFAILED:\n" + issues.map((i) => `  - ${i}`).join("\n"));
    process.exit(1);
  }
  console.log("\nOK: bench notify compact — CTA visible without scroll");
} finally {
  await browser.close();
}
