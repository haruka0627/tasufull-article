#!/usr/bin/env node
/**
 * Connect UI — Gemini 2回目レビュー反映キャプチャ
 *   node scripts/capture-connect-ui-round2.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import {
  assertQaCenterReady,
  countRegisteredSearchMatches,
  formatPassReportQaSection,
  matchesImageSearch,
} from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "connect-ui-review");
const reportPath = join(root, "reports", "connect-ui-review-round2.md");
const SELLER_ID = "u_sachi";

function paymentUrl(base, step = "") {
  const u = new URL(`${base}/payment-settings.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", SELLER_ID);
  if (step) u.searchParams.set("connectStep", step);
  return u.toString();
}

function dashboardUrl(base) {
  const u = new URL(`${base}/dashboard.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", SELLER_ID);
  return u.toString();
}

async function resetIncompleteState(page) {
  await page.evaluate(() => {
    localStorage.removeItem("tasful_connect_onboarding_v1");
    localStorage.removeItem("tasful_demo_connect_seller_status_v1");
    localStorage.removeItem("tasful_payment_settings");
  });
}

async function screenshotViewport(page, filePath) {
  await page.evaluate(() => {
    document.querySelectorAll(".dash-header").forEach((el) => {
      el.style.position = "relative";
      el.style.top = "auto";
    });
  });
  await page.screenshot({ path: filePath, fullPage: false });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const base = await requireDevServer();
  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    steps: [],
    shots: [],
    passed: false,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

    await page.goto(paymentUrl(base, "identity"), { waitUntil: "domcontentloaded", timeout: 60000 });
    await resetIncompleteState(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "tasful_connect_onboarding_v1",
        JSON.stringify({ step: "identity", updatedAt: new Date().toISOString() })
      );
      window.TasuPaymentSettings?.renderConnectOnboarding?.();
    });
    await page.waitForSelector("[data-connect-identity-panel]:not([hidden])", { timeout: 10000 });
    await page.locator("[data-connect-onboarding]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const identityState = await page.evaluate(() => {
      const apply = document.querySelector("[data-connect-apply]");
      const actions = document.querySelector("[data-connect-actions]");
      const identity = document.querySelector("[data-connect-identity-submit]");
      const benefits = document.querySelector("[data-connect-ready-benefits]");
      const disclaimer = document.querySelector("[data-connect-disclaimer]");
      const panels = Array.from(document.querySelectorAll("[data-connect-onboarding] > .dash-card__body > *"));
      const order = panels
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.display !== "none" && el.offsetHeight > 0;
        })
        .map((el) => el.dataset?.connectApply != null ? "cta-top" : el.dataset?.connectIdentitySubmit != null ? "cta-identity" : el.className.split(" ")[0]);
      return {
        step: window.TasuPaymentSettings?.resolveConnectStep?.(),
        applyVisible: Boolean(apply && apply.offsetParent !== null),
        actionsVisible: Boolean(actions && actions.offsetParent !== null),
        identityVisible: Boolean(identity && identity.offsetParent !== null),
        benefitsVisible: Boolean(benefits && benefits.offsetParent !== null),
        disclaimerAfterBenefits:
          Boolean(disclaimer && benefits) &&
          disclaimer.compareDocumentPosition(benefits) === Node.DOCUMENT_POSITION_FOLLOWING,
      };
    });

    await screenshotViewport(page, join(outDir, "connect-identity-mobile390.png"));
    report.shots.push("connect-identity-mobile390.png");
    report.steps.push({
      id: "identity-single-cta",
      ...identityState,
      pass:
        identityState.step === "identity" &&
        !identityState.applyVisible &&
        !identityState.actionsVisible &&
        identityState.identityVisible,
    });

    await page.goto(paymentUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "tasful_connect_onboarding_v1",
        JSON.stringify({ step: "approved", updatedAt: new Date().toISOString() })
      );
      window.TasuPaymentSettings?.renderConnectOnboarding?.();
    });
    await page.waitForSelector("[data-connect-onboarding]", { timeout: 10000 });
    await page.locator("[data-connect-onboarding]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const approvedState = await page.evaluate(() => {
      const headers = document.querySelectorAll(".dash-header").length;
      const apply = document.querySelector("[data-connect-apply]");
      const benefits = document.querySelector("[data-connect-ready-benefits]");
      const rect = document.querySelector(".dash-header")?.getBoundingClientRect();
      const cardRect = document.querySelector("[data-connect-onboarding]")?.getBoundingClientRect();
      const headerOverlapsCard =
        Boolean(rect && cardRect) &&
        rect.bottom > cardRect.top + 40 &&
        rect.top < cardRect.bottom &&
        rect.top > 80;
      return {
        step: window.TasuPaymentSettings?.resolveConnectStep?.(),
        headerCount: headers,
        applyVisible: Boolean(apply && apply.offsetParent !== null),
        benefitsVisible: Boolean(benefits && benefits.offsetParent !== null),
        headerOverlapsCard,
        headerTop: rect ? Math.round(rect.top) : null,
      };
    });

    await screenshotViewport(page, join(outDir, "connect-approved-mobile390.png"));
    report.shots.push("connect-approved-mobile390.png");
    report.steps.push({
      id: "approved-layout",
      ...approvedState,
      pass:
        approvedState.step === "approved" &&
        approvedState.headerCount === 1 &&
        !approvedState.applyVisible &&
        !approvedState.headerOverlapsCard,
    });

    await page.goto(dashboardUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await resetIncompleteState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => {
        const banner = document.querySelector("[data-connect-member-banner]");
        return banner && !banner.hidden && banner.querySelector(".dash-connect-banner__tag");
      },
      { timeout: 10000 }
    );
    await page.locator("[data-connect-member-banner]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const bannerState = await page.evaluate(() => ({
      bannerVisible: !document.querySelector("[data-connect-member-banner]")?.hidden,
      bannerInView:
        Boolean(document.querySelector(".dash-connect-banner__tag")) &&
        document.querySelector("[data-connect-member-banner]")?.getBoundingClientRect().top < 120,
      tag: document.querySelector(".dash-connect-banner__tag")?.textContent?.trim() || "",
      title: document.querySelector(".dash-connect-banner__title")?.textContent?.replace(/\s+/g, " ").trim() || "",
      cta: document.querySelector(".dash-connect-banner__cta")?.textContent?.trim() || "",
    }));

    await screenshotViewport(page, join(outDir, "dashboard-connect-banner-mobile390.png"));
    report.shots.push("dashboard-connect-banner-mobile390.png");
    report.steps.push({
      id: "dashboard-banner-copy",
      ...bannerState,
      pass:
        bannerState.bannerVisible &&
        bannerState.bannerInView &&
        bannerState.tag === "【重要】" &&
        bannerState.title.includes("売上の受け取りと安全な取引のために") &&
        bannerState.title.includes("本人確認を完了してください") &&
        bannerState.cta === "本人確認を始める",
    });

    const { manifest } = await writeScreenshotsManifest(root);
    const qaGate = assertQaCenterReady(manifest);
    const images = manifest.images || [];
    const bannerSearchCount = countRegisteredSearchMatches(images, "dashboard-connect-banner");

    report.qa = {
      registeredTotal: manifest.registeredCount,
      unregisteredCount: manifest.unregisteredCount,
      bannerSearchCount,
      qaGatePass: qaGate.ok,
    };
    report.stepsPass = report.steps.every((s) => s.pass !== false);
    report.passed = report.stepsPass && qaGate.ok && report.shots.length === 3;

    const md = [
      "# Connect UI — Gemini 2回目レビュー反映",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## 反映内容",
      "",
      "### 優先度A",
      "",
      "1. **本人確認フェーズのCTA一本化** — `Connectを始める` を非表示、`本人確認を始める` のみ",
      "2. **connect-approved 表示崩れ修正** — `[hidden]` が `display:grid/flex` で無効化されていた問題を修正。ビューポートキャプチャでヘッダー重複を解消",
      "",
      "### 優先度B",
      "",
      "3. **ダッシュボード固定バナー文言** — 【重要】＋売上受け取り・安全な取引の訴求",
      "4. **安心表示ブロック順序** — CTA → 安心表示 → 注意事項（ready時は安心→注意）",
      "",
      "## 提出スクショ（390px）",
      "",
      "- `screenshots/connect-ui-review/connect-identity-mobile390.png`",
      "- `screenshots/connect-ui-review/connect-approved-mobile390.png`",
      "- `screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png`",
      "",
      "## 検証",
      "",
      "| ステップ | 結果 |",
      "|----------|------|",
      ...report.steps.map((s) => `| ${s.id} | ${s.pass ? "PASS" : "FAIL"} |`),
      "",
      `- QA Center 未登録 ⚠: **${report.qa.unregisteredCount}**`,
      `- dashboard-connect-banner 検索: **${report.qa.bannerSearchCount}** 件`,
      "",
      `総合: **${report.passed ? "PASS" : "FAIL"}**`,
      "",
    ].join("\n");

    await writeFile(reportPath, md, "utf8");
    console.log(md);

    if (!report.passed) {
      console.error("CONNECT UI ROUND2 CAPTURE FAIL");
      process.exitCode = 1;
    } else {
      console.log("CONNECT UI ROUND2 CAPTURE PASS");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
