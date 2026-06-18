/**
 * 求人応募通知 — 通知タブ → 応募者一覧 → 550円支払い（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-job-apply-notify";
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";
const NOTIFY_ID = "platform-verify-job-full-apply-001";

async function collectApplicationsState(page) {
  return page.evaluate(() => {
    const shellHead = document.querySelector("[data-tasu-mobile-shell-head]");
    const offset = shellHead ? shellHead.getBoundingClientRect().height + 10 : 64;
    const section = document.querySelector("[data-job-applications-section]");
    const firstCard = section?.querySelector(".job-app-card:not(.job-app-card--empty)");
    const proceedBtn = firstCard?.querySelector("[data-job-app-proceed]");
    const inViewport = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= offset - 4 && r.top <= window.innerHeight * 0.6 && r.bottom > offset;
    };
    return {
      url: window.location.href,
      hash: window.location.hash,
      view: new URL(window.location.href).searchParams.get("view"),
      userId: new URL(window.location.href).searchParams.get("userId"),
      jobPdView: document.body.dataset.jobPdView || "",
      sectionVisible: Boolean(section && !section.hidden),
      sectionFocused: section?.classList.contains("is-view-focus") || false,
      cardCount: document.querySelectorAll("[data-job-app-card]").length,
      applicantName: firstCard?.querySelector(".job-app-card__name")?.textContent?.trim() || "",
      appliedAt: firstCard?.querySelector(".job-app-card__meta")?.textContent?.trim() || "",
      memo: firstCard?.querySelector(".job-app-card__memo")?.textContent?.trim() || "",
      proceedLabel: proceedBtn?.textContent?.trim() || "",
      cardInViewport: inViewport(firstCard),
      sectionInViewport: inViewport(section),
      scrollY: window.scrollY,
      heroHidden:
        !document.querySelector(".job-hero-section") ||
        getComputedStyle(document.querySelector(".job-hero-section")).display === "none",
      workplaceHidden: (() => {
        const el = document.querySelector("#section-workplace");
        return !el || getComputedStyle(el).display === "none";
      })(),
      relatedHidden: (() => {
        const el = document.querySelector("#otherServices");
        return !el || getComputedStyle(el).display === "none";
      })(),
      sellerHidden: (() => {
        const el = document.querySelector("[data-listing-seller]");
        return !el || getComputedStyle(el).display === "none";
      })(),
    };
  });
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&userId=${POSTER_ID}&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  const notifyAudit = await page.evaluate((notifyId) => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const row = list.find((n) => String(n.id) === notifyId);
    const action = row
      ? window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row)
      : null;
    return row
      ? {
          title: row.title,
          actionLabel: row.actionLabel,
          href: action?.href || row.href || row.targetUrl,
          body: row.body,
        }
      : null;
  }, NOTIFY_ID);

  if (!notifyAudit) errors.push("platform-verify-job-full-apply-001 missing");
  else {
    if (notifyAudit.title !== "この求人に応募がありました") {
      errors.push(`notify title: ${notifyAudit.title}`);
    }
    if (notifyAudit.actionLabel !== "確認する") {
      errors.push(`notify actionLabel: ${notifyAudit.actionLabel}`);
    }
    if (!notifyAudit.href?.includes("#applications")) {
      errors.push(`notify href missing #applications: ${notifyAudit.href}`);
    }
    if (!notifyAudit.href?.includes("userId=u_job_demo_full")) {
      errors.push(`notify href missing poster userId: ${notifyAudit.href}`);
    }
    if (!notifyAudit.href?.includes("view=applications")) {
      errors.push(`notify href missing view=applications: ${notifyAudit.href}`);
    }
  }

  await page.screenshot({ path: path.join(OUT_DIR, "01-notify-390.png") });

  const openHref = notifyAudit?.href;
  if (!openHref) {
    errors.push("notify open href missing");
  } else {
    const dest = new URL(openHref, `${BASE_URL}/`).href;
    await page.goto(dest, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForFunction(
    () => {
      const section = document.querySelector("[data-job-applications-section]");
      return Boolean(section && !section.hidden && document.querySelector("[data-job-app-proceed]"));
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(1800);

  const appsState = await collectApplicationsState(page);
  if (appsState.view !== "applications") errors.push(`view param: ${appsState.view}`);
  if (appsState.userId !== POSTER_ID) errors.push(`poster userId: ${appsState.userId}`);
  if (appsState.jobPdView !== "applications") errors.push(`jobPdView: ${appsState.jobPdView}`);
  if (!appsState.sectionVisible) errors.push("applications section hidden");
  if (appsState.cardCount < 1) errors.push("no applicant cards");
  if (!appsState.applicantName) errors.push("applicant name missing");
  if (!appsState.appliedAt) errors.push("applied date missing");
  if (appsState.proceedLabel !== "やりとりに進む") {
    errors.push(`proceed label: ${appsState.proceedLabel}`);
  }
  if (!appsState.cardInViewport && !appsState.sectionInViewport && appsState.scrollY < 1) {
    errors.push(
      `applications not scrolled into view (scrollY=${appsState.scrollY}, card=${appsState.cardInViewport})`
    );
  }
  if (!appsState.heroHidden) errors.push("job hero still visible in applications view");
  if (!appsState.workplaceHidden) errors.push("workplace gallery still visible in applications view");
  if (!appsState.relatedHidden) errors.push("related jobs still visible in applications view");
  if (!appsState.sellerHidden) errors.push("seller panel still visible in applications view");

  const feeRules = await page.evaluate(() => {
    const Fee = window.TasuPlatformChatFee;
    const listing = { listing_type: "job", id: "job_demo_full_001" };
    return {
      connect: Fee?.hasStripeConnect?.(listing, "job"),
      completion: Fee?.shouldNotifyOnCompletion?.(listing),
      flatFee: Fee?.calcJobChatFee?.(),
    };
  });
  if (feeRules.connect) errors.push("job should not use Connect");
  if (feeRules.completion) errors.push("job should not have completion billing");
  if (feeRules.flatFee !== 550) errors.push(`job flat fee: ${feeRules.flatFee}`);

  await page.screenshot({ path: path.join(OUT_DIR, "02-applications-390.png") });

  await page.evaluate(() => {
    const btn = document.querySelector("[data-job-app-proceed]");
    btn?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "03-proceed-390.png") });

  await Promise.all([
    page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 15000 }),
    page.evaluate(() => {
      document.querySelector("[data-job-app-proceed]")?.click();
    }),
  ]);
  await page.waitForTimeout(800);

  const payUi = await page.evaluate(() => ({
    title: document.querySelector("[data-platform-fee-pay-title]")?.textContent?.trim(),
    amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim(),
    rate: document.querySelector("[data-platform-fee-rate]")?.textContent?.trim(),
    category: document.querySelector("[data-platform-fee-category]")?.textContent?.trim(),
    url: window.location.href,
  }));

  if (!payUi.title?.includes("求人")) errors.push(`pay title: ${payUi.title}`);
  if (payUi.amount !== "¥550") errors.push(`pay amount: ${payUi.amount}`);
  if (payUi.rate?.includes("5%")) errors.push(`pay rate shows 5%: ${payUi.rate}`);
  if (payUi.rate?.includes("Connect")) errors.push(`pay rate shows Connect: ${payUi.rate}`);
  if (payUi.category !== "求人") errors.push(`pay category: ${payUi.category}`);

  await page.screenshot({ path: path.join(OUT_DIR, "04-fee-pay-550-390.png") });

  await browser.close();

  const report = { notifyAudit, appsState, payUi, feeRules, errors };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    process.exit(1);
  }
  console.log("ALL OK — platform job apply notify routing verified");
}

await run();
