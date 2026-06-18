#!/usr/bin/env node
/**
 * 求人 応募状況 — スマホスクロール 390px 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-job-applications-scroll");
const POSTER = "u_job_demo_full";
const LISTING = "job_demo_full_001";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const issues = [];

try {
  await page.goto(
    `${BASE}/detail-job.html?id=${LISTING}&userId=${POSTER}&talkDev=1&review=job-full&view=applications&from=talk#applications`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForFunction(() => document.body.classList.contains("tasu-app-mobile-page"), {
    timeout: 8000,
  });
  await page.waitForTimeout(900);

  const before = await page.evaluate(() => {
    const list = document.querySelector("[data-job-applications-list]");
    const section = document.querySelector("[data-job-applications-section]");
    const cards = document.querySelectorAll("[data-job-app-card]");
    return {
      scrollLock: document.body.classList.contains("job-applications-scroll-lock"),
      sectionDisplay: section ? getComputedStyle(section).display : "",
      cardCount: cards.length,
      listCanScroll: Boolean(list && list.scrollHeight > list.clientHeight + 2),
      bodyOverflow: getComputedStyle(document.body).overflow,
      docScrollY: window.scrollY,
    };
  });

  if (!before.scrollLock) issues.push("job-applications-scroll-lock が有効ではありません");
  if (before.sectionDisplay !== "flex") {
    issues.push(`applications section display=${before.sectionDisplay} (flex 期待)`);
  }
  if (before.cardCount < 3) issues.push(`応募者カード=${before.cardCount} (3件以上期待)`);
  if (!before.listCanScroll) issues.push("応募者リストがスクロール可能になっていません");
  if (before.bodyOverflow !== "hidden") {
    issues.push(`body overflow=${before.bodyOverflow} (hidden 期待)`);
  }
  if (before.docScrollY > 2) issues.push("ページ全体がスクロールしています");

  await page.screenshot({ path: path.join(OUT, "01-applications-top-390.png") });

  await page.evaluate(() => {
    const list = document.querySelector("[data-job-applications-list]");
    if (list) list.scrollTop = list.scrollHeight;
  });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const list = document.querySelector("[data-job-applications-list]");
    const cards = document.querySelectorAll("[data-job-app-card]");
    const last = cards[cards.length - 1];
    const btn = last?.querySelector(".job-app-card__btn, [data-job-app-proceed], [data-job-app-chat]");
    const tabbar = document.querySelector("[data-tasu-app-tabbar]");
    const tabbarTop = tabbar?.getBoundingClientRect().top ?? window.innerHeight;
    const listRect = list?.getBoundingClientRect();
    const lastRect = last?.getBoundingClientRect();
    const btnRect = btn?.getBoundingClientRect();
    return {
      scrollTop: list?.scrollTop ?? 0,
      lastCardInList:
        Boolean(
          lastRect &&
            listRect &&
            lastRect.bottom <= listRect.bottom + 4 &&
            lastRect.top >= listRect.top - 4
        ),
      btnAboveTabbar: Boolean(btnRect && btnRect.bottom <= tabbarTop - 4),
      btnVisible: Boolean(btnRect && btnRect.height > 0),
    };
  });

  await page.screenshot({ path: path.join(OUT, "02-applications-scrolled-390.png") });

  if (after.scrollTop < 1) issues.push("リストを末尾までスクロールできません");
  if (!after.lastCardInList) issues.push("最後の応募者カードがリスト内に表示されていません");
  if (!after.btnAboveTabbar) issues.push("最後のカードのボタンが下部ナビに被っています");
  if (!after.btnVisible) issues.push("最後のカードのボタンが見えません");

  const summary = { before, after, issues, ok: issues.length === 0 };
  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) {
    console.error("verify-job-applications-scroll-390 FAILED:\n" + issues.join("\n"));
    process.exit(1);
  }
  console.log("verify-job-applications-scroll-390 OK");
} finally {
  await browser.close();
}
