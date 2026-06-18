#!/usr/bin/env node
import fs from "fs";
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
page.on("dialog", async (d) => await d.accept());

const findFrame = (p, re) => p.frames().find((f) => re.test(f.url()));

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);
  const bDetail = findFrame(page, /detail-job/i);
  if (bDetail) {
    await bDetail.evaluate(() => document.querySelector("[data-listing-primary-cta], [data-job-apply]")?.click());
    await page.waitForTimeout(4000);
  }
  let mgmt = findFrame(page, /detail-job.*applications|benchManagement=1/i);
  if (!mgmt) {
    const aNotify = page.frame({ url: /talk-home.*tab=notify/ });
    if (aNotify) {
      await aNotify.evaluate(() => document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click());
      await page.waitForTimeout(4000);
    }
    mgmt = findFrame(page, /detail-job.*applications|benchManagement=1/i);
  }
  if (mgmt) {
    await mgmt.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click());
    await page.waitForTimeout(3500);
  }
  const aFee = findFrame(page, /platform-chat-fee-pay/i);
  if (aFee) {
    await aFee.evaluate(() => document.querySelector("[data-platform-fee-pay]")?.click());
    await page.waitForTimeout(5000);
  }

  const bNotifyFrame = page.frames().find((f) => /talk-home/i.test(f.url()) && /userId=u_hiro/i.test(f.url()) && /tab=notify/i.test(f.url()));
  if (!bNotifyFrame) throw new Error("b_notify_frame_missing");
  const report = await bNotifyFrame.evaluate(() => {
    const host = document.querySelector("[data-talk-notify-list]");
    const card = document.querySelector(".talk-notify-card");
    const empty = document.querySelector(".talk-notify-empty-state__title");
    const panel = document.querySelector('[data-talk-panel="notify"]');
    const cs = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        height: s.height,
        maxHeight: s.maxHeight,
        overflow: s.overflow,
        overflowY: s.overflowY,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        heightPx: r.height,
      };
    };
    const diag = window.__tasuBenchNotifyRenderDiag || null;
    return {
      diag,
      hostClasses: host?.className || "",
      hostRenderSig: host?.dataset?.notifyRenderSig || "",
      cardCount: document.querySelectorAll(".talk-notify-card").length,
      emptyText: empty?.textContent?.trim() || null,
      panelHidden: panel?.hidden ?? null,
      bodyClasses: document.body.className,
      hostStyle: cs(host),
      cardStyle: cs(card),
      panelStyle: cs(panel),
      listScrollTop: host?.scrollTop ?? null,
      panelScrollTop: panel?.scrollTop ?? null,
      windowScrollY: window.scrollY,
      titleText: card?.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event")?.textContent?.trim() || null,
    };
  });

  const outDir = "screenshots/job-0-b-notify-dom";
  fs.mkdirSync(outDir, { recursive: true });
  await page.locator("#frame-b-notify").screenshot({ path: `${outDir}/b-notify-iframe.png` });
  report.screenshot = `${outDir}/b-notify-iframe.png`;
  report.titleVisibleInViewport = await bNotifyFrame.evaluate(() => {
    const title = document.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event");
    if (!title) return false;
    const r = title.getBoundingClientRect();
    const list = document.querySelector("[data-talk-notify-list]");
    const lr = list?.getBoundingClientRect();
    if (!lr) return r.height > 0 && r.bottom > 0;
    return r.top >= lr.top - 2 && r.top < lr.bottom && r.height > 0;
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
