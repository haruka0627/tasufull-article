#!/usr/bin/env node
/**
 * review=chat-demo — 通知 CTA 390px レイアウト + タップ遷移
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-chat-demo-notify-cta");
const VIEWPORT = { width: 390, height: 844 };

const NOTIFY_URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=u_sachi`;

const TAP_CASES = [
  {
    id: "platform-chat-demo-skill-purchase-001",
    label: "チャットを開く",
    hrefIncludes: ["chat-detail.html"],
  },
  {
    id: "platform-chat-demo-skill-review-a-001",
    label: "評価する",
    hrefIncludes: ["chat-detail.html"],
  },
  {
    id: "platform-chat-demo-skill-cancel-a-001",
    label: "詳細を見る",
    hrefIncludes: ["detail-skill.html", "chat-detail.html"],
  },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-talk-notify-id="platform-chat-demo-skill-purchase-001"]', {
  timeout: 25000,
});
await page.waitForTimeout(800);

const layout = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const list = document.querySelector(".talk-notify-list");
  const cards = [...document.querySelectorAll("article[data-talk-notify-platform]")];
  const issues = [];

  if (list && list.scrollWidth > vw + 1) {
    issues.push(`list scrollWidth ${list.scrollWidth} > viewport ${vw}`);
  }

  const rows = cards.map((card) => {
    const id = card.getAttribute("data-talk-notify-id");
    const rect = card.getBoundingClientRect();
    const cta = card.querySelector("[data-talk-notify-action]");
    const ctaRect = cta?.getBoundingClientRect();
    const title = card.querySelector(".talk-notify-card__title--job-event, .talk-notify-card__title");
    const titleStyle = title ? getComputedStyle(title) : null;
    const ctaStyle = cta ? getComputedStyle(cta) : null;

    if (rect.right > vw + 1) issues.push(`${id}: card right ${rect.right} > ${vw}`);
    if (ctaRect && ctaRect.right > vw + 1) {
      issues.push(`${id}: CTA right ${ctaRect.right} > ${vw}`);
    }
    if (ctaRect && ctaRect.width > rect.width + 1) {
      issues.push(`${id}: CTA wider than card`);
    }
    if (ctaStyle?.whiteSpace === "nowrap") issues.push(`${id}: CTA white-space nowrap`);

    return {
      id,
      cardWidth: Math.round(rect.width),
      cardRight: Math.round(rect.right),
      ctaLabel: cta?.textContent?.trim() || "",
      ctaHref: cta?.getAttribute("href") || "",
      ctaWidth: ctaRect ? Math.round(ctaRect.width) : 0,
      ctaRight: ctaRect ? Math.round(ctaRect.right) : 0,
      titleWrap: titleStyle?.whiteSpace || "",
      ctaWrap: ctaStyle?.whiteSpace || "",
    };
  });

  return { vw, issues, rows };
});

console.log("Layout viewport:", layout.vw);
console.log("Cards:", layout.rows.length);
for (const row of layout.rows.slice(0, 5)) {
  console.log(
    `  ${row.id}: cardW=${row.cardWidth} cta="${row.ctaLabel}" ctaW=${row.ctaWidth} ctaRight=${row.ctaRight} wrap=${row.ctaWrap}`
  );
}

await page.screenshot({ path: path.join(OUT, "01-notify-list-390.png"), fullPage: true });

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

if (layout.issues.length) {
  layout.issues.forEach((msg) => fail(msg));
} else {
  ok("390px: no horizontal overflow on cards/CTA");
}

for (const spec of TAP_CASES) {
  const row = layout.rows.find((r) => r.id === spec.id);
  if (!row) {
    fail(`${spec.id}: card not found`);
    continue;
  }
  if (!row.ctaHref || row.ctaHref === "#") {
    fail(`${spec.id}: missing href`);
    continue;
  }
  if (!spec.hrefIncludes.some((part) => row.ctaHref.includes(part))) {
    fail(`${spec.id}: href ${row.ctaHref}`);
    continue;
  }
  ok(`${spec.id}: href ${row.ctaHref.split("?")[0]}`);

  await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(`[data-talk-notify-id="${spec.id}"]`, { timeout: 20000 });
  await page.waitForTimeout(400);

  const cta = page.locator(`[data-talk-notify-id="${spec.id}"] [data-talk-notify-action]`).first();
  const box = await cta.boundingBox();
  if (!box) {
    fail(`${spec.id}: CTA not visible`);
    continue;
  }

  await page.locator(`[data-talk-notify-id="${spec.id}"] [data-talk-notify-action]`).click();
  await page.waitForURL((url) => !url.href.includes("tab=notify"), { timeout: 15000 });
  const dest = page.url();
  if (!spec.hrefIncludes.some((part) => dest.includes(part))) {
    fail(`${spec.id}: navigated to ${dest}`);
    continue;
  }
  ok(`${spec.id}: tap -> ${dest.split("?")[0]}`);
}

await browser.close();
if (failed) process.exit(1);
console.log("All checks passed");
