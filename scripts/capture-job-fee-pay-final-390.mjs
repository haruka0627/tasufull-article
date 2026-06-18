#!/usr/bin/env node
/**
 * 求人550円支払い — from=notify / from=talk 390px スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";

const OUT = path.join("screenshots", "platform-job-fee-pay-final");
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";

async function resolveDevBase() {
  for (const port of [5174, 5173]) {
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/`, { method: "HEAD" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  throw new Error("Dev server not reachable on 5173/5174");
}

const BASE = await resolveDevBase();
fs.mkdirSync(OUT, { recursive: true });

async function openJobFeePay(page, from) {
  await page.goto(`${BASE}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    localStorage.removeItem("tasful_chat_threads");
    localStorage.removeItem("tasful_chat_messages");
    localStorage.removeItem("tasful_platform_chat_fees_v1");
  });

  await page.goto(
    `${BASE}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1&view=applications&from=${from}#applications`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForFunction(() => document.querySelector("[data-job-app-proceed]"), { timeout: 45000 });
  await Promise.all([
    page.waitForURL(new RegExp(`platform-chat-fee-pay.*from=${from}`), { timeout: 20000 }),
    page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
  ]);
  await page.waitForFunction(
    () =>
      document.body.classList.contains("platform-fee-pay--job") &&
      document.querySelector("[data-platform-fee-back-link]")?.textContent?.includes("戻る"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(700);
}

function measureLayout() {
  const tabbar = document.querySelector("[data-tasu-app-tabbar]");
  const cta = document.querySelector("[data-platform-fee-pay]");
  const security = document.querySelector("[data-platform-fee-pay-security]");
  const tabbarRect = tabbar?.getBoundingClientRect();
  const ctaRect = cta?.getBoundingClientRect();
  const securityRect = security?.getBoundingClientRect();
  return {
    url: location.href,
    from: new URLSearchParams(location.search).get("from"),
    backText: document.querySelector("[data-platform-fee-back-link]")?.textContent?.trim(),
    backHref: document.querySelector("[data-platform-fee-back-link]")?.getAttribute("href"),
    title: document.querySelector("[data-platform-fee-pay-title]")?.textContent?.trim(),
    cta: cta?.textContent?.trim(),
    security: security?.textContent?.trim(),
    tabbarVisible: Boolean(tabbar && tabbarRect && tabbarRect.height > 40),
    ctaAboveTabbar: Boolean(tabbarRect && ctaRect && ctaRect.bottom <= tabbarRect.top + 2),
    securityAboveTabbar: Boolean(
      tabbarRect && securityRect && securityRect.bottom <= tabbarRect.top + 2
    ),
  };
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("dialog", async (d) => d.accept());

const report = {};

for (const from of ["notify", "talk"]) {
  await openJobFeePay(page, from);
  const audit = await page.evaluate(measureLayout);
  const file = `0${from === "notify" ? "1" : "2"}-from-${from}-390.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  report[from] = { ...audit, screenshot: path.join(OUT, file) };
  console.log(`[screenshot] from=${from}: ${audit.url}`);
  console.log(`  back: ${audit.backText} → ${audit.backHref}`);
  console.log(`  CTA/tabbar: ctaAboveTabbar=${audit.ctaAboveTabbar}, securityAboveTabbar=${audit.securityAboveTabbar}`);
}

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify({ baseUrl: BASE, report }, null, 2));
});

const ok =
  report.notify?.backText === "← 通知へ戻る" &&
  report.talk?.backText === "← TALKへ戻る" &&
  report.notify?.ctaAboveTabbar &&
  report.talk?.ctaAboveTabbar;

console.log(JSON.stringify({ ok, report }, null, 2));
await closeAllBrowsers();
process.exit(ok ? 0 : 1);
