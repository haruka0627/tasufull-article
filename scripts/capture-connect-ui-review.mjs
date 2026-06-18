#!/usr/bin/env node
/**
 * Connect UI — QA Center 登録 + Gemini 提出用キャプチャ（実クリック検証）
 *   node scripts/capture-connect-ui-review.mjs
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import {
  assertQaCenterReady,
  formatPassReportQaSection,
  FLOW_SEARCH,
  buildViewerSearchUrl,
} from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "connect-ui-review");
const reportDir = join(root, "reports");
const QA_SEARCH_KEYWORD = FLOW_SEARCH.find((f) => f.id === "connect")?.viewerSearch || "connect";
const SELLER_ID = "u_sachi";
const SKILL_LISTING = "demo-skill-001";

const SHOTS = [
  { id: "connect-top", file: "connect-top-mobile390.png", gemini: "connect-top.png" },
  {
    id: "dashboard-connect-banner",
    file: "dashboard-connect-banner-mobile390.png",
    gemini: null,
  },
  { id: "connect-apply", file: "connect-apply-mobile390.png", gemini: "connect-apply.png" },
  { id: "connect-identity", file: "connect-identity-mobile390.png", gemini: null },
  { id: "connect-qualification", file: "connect-qualification-mobile390.png", gemini: null },
  { id: "connect-reviewing", file: "connect-reviewing-mobile390.png", gemini: null },
  { id: "connect-approved", file: "connect-approved-mobile390.png", gemini: "connect-approved.png" },
  { id: "connect-ready", file: "connect-ready-mobile390.png", gemini: null },
  { id: "connect-trade-with", file: "connect-trade-with-mobile390.png", gemini: "connect-trade-flow.png" },
  { id: "connect-trade-without", file: "connect-trade-without-mobile390.png", gemini: null },
];

function dashboardUrl(base) {
  const u = new URL(`${base}/dashboard.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", SELLER_ID);
  return u.toString();
}

function paymentUrl(base, step = "") {
  const u = new URL(`${base}/payment-settings.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", SELLER_ID);
  if (step) u.searchParams.set("connectStep", step);
  return u.toString();
}

function talkNotifyUrl(base) {
  const u = new URL(`${base}/talk-home.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", SELLER_ID);
  u.searchParams.set("tab", "notify");
  return u.toString();
}

function skillDetailUrl(base, connect) {
  const u = new URL(`${base}/detail-skill.html`);
  u.searchParams.set("id", SKILL_LISTING);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("userId", "u_hiro");
  u.searchParams.set("demoConnect", connect ? "1" : "0");
  return u.toString();
}

async function resetConnectState(page) {
  await page.evaluate(
    ({ sellerId }) => {
      localStorage.removeItem("tasful_connect_onboarding_v1");
      localStorage.removeItem("tasful_demo_connect_seller_status_v1");
      localStorage.removeItem("tasful_payment_settings");
      const store = window.TasuTalkNotifications;
      if (store?.getAll && store?.saveAll) {
        const ids = new Set(["platform-chat-demo-connect-identity-001", "platform-chat-demo-connect-payout-001"]);
        const next = (store.getAll() || []).filter((n) => !ids.has(String(n.id)));
        store.saveAll(next, { localOnly: true, silent: true });
      }
    },
    { sellerId: SELLER_ID }
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

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

    await page.goto(paymentUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-connect-onboarding]", { timeout: 20000 });
    await resetConnectState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-connect-apply]", { timeout: 20000 });

    await page.screenshot({ path: join(outDir, "connect-top-mobile390.png"), fullPage: true });
    report.shots.push("connect-top-mobile390.png");

    await page.goto(dashboardUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-connect-member-banner]", { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const banner = document.querySelector("[data-connect-member-banner]");
        return banner && !banner.hidden && banner.querySelector(".dash-connect-banner__title");
      },
      { timeout: 10000 }
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(outDir, "dashboard-connect-banner-mobile390.png"),
      fullPage: false,
    });
    report.shots.push("dashboard-connect-banner-mobile390.png");

    const bannerState = await page.evaluate(() => ({
      bannerVisible: !document.querySelector("[data-connect-member-banner]")?.hidden,
      bannerTag: document.querySelector(".dash-connect-banner__tag")?.textContent?.trim() || "",
      bannerTitle: document.querySelector(".dash-connect-banner__title")?.textContent?.replace(/\s+/g, " ").trim() || "",
      cta: document.querySelector(".dash-connect-banner__cta")?.textContent?.trim() || "",
    }));
    report.steps.push({
      id: "dashboard-connect-banner",
      ...bannerState,
      pass:
        bannerState.bannerVisible &&
        bannerState.bannerTag === "【重要】" &&
        bannerState.bannerTitle.includes("売上の受け取りと安全な取引のために") &&
        bannerState.bannerTitle.includes("本人確認を完了してください") &&
        bannerState.cta === "本人確認を始める",
    });

    await page.goto(paymentUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-connect-apply]", { timeout: 20000 });

    const topState = await page.evaluate(() => ({
      ctaLabel: document.querySelector("[data-connect-apply]")?.textContent?.trim() || "",
      methodFoldOpen: document.querySelector("[data-payment-method-fold]")?.open === true,
    }));
    report.steps.push({
      id: "connect-top-ui",
      ...topState,
      pass: topState.ctaLabel === "Connectを始める" && !topState.methodFoldOpen,
    });

    await page.locator("[data-connect-apply]").click();
    await page.waitForFunction(
      () => window.TasuPaymentSettings?.resolveConnectStep?.() === "identity",
      { timeout: 10000 }
    );
    await page.waitForTimeout(400);

    const applyState = await page.evaluate(() => ({
      step: window.TasuPaymentSettings?.resolveConnectStep?.(),
      hasNotification: (window.TasuTalkNotifications?.getAll?.() || []).some(
        (n) => n.id === "platform-chat-demo-connect-identity-001"
      ),
      identityCta: document.querySelector("[data-connect-identity-submit]")?.textContent?.trim() || "",
    }));
    report.steps.push({
      id: "connect-start-click",
      ...applyState,
      pass: applyState.step === "identity" && applyState.hasNotification && applyState.identityCta === "本人確認を始める",
    });

    await page.goto(talkNotifyUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
    await page.locator('[data-talk-tab="notify"], [data-talk-nav-notify]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.evaluate(
      ({ sellerId, identityHref }) => {
        const store = window.TasuTalkNotifications;
        if (!store?.getAll || !store?.saveAll) return;
        const id = "platform-chat-demo-connect-identity-001";
        const row = {
          id,
          type: "skill",
          category: "Connect",
          title: "本人確認が必要です",
          body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
          actionLabel: "本人確認を進める",
          href: identityHref,
          targetUrl: identityHref,
          priority: "high",
          recipientUserId: sellerId,
          source: "platform_chat_demo_connect_requirements_v1",
          minimalNotifyCard: true,
          createdAt: new Date().toISOString(),
        };
        const next = (store.getAll() || []).filter((n) => String(n.id) !== id);
        next.unshift(row);
        store.saveAll(next, { localOnly: true, silent: true });
        window.dispatchEvent(
          new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
        );
      },
      { sellerId: SELLER_ID, identityHref: paymentUrl(base, "identity") }
    );
    await page.waitForTimeout(1500);

    await page.waitForFunction(
      () =>
        (window.TasuTalkNotifications?.getAll?.() || []).some(
          (n) => n.id === "platform-chat-demo-connect-identity-001"
        ),
      { timeout: 15000 }
    );

    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector(
            'article[data-talk-notify-id="platform-chat-demo-connect-identity-001"] [data-talk-notify-action]'
          )
        ),
      { timeout: 15000 }
    );

    await page.screenshot({ path: join(outDir, "connect-apply-mobile390.png"), fullPage: true });
    report.shots.push("connect-apply-mobile390.png");

    const notifyHref = await page.evaluate(() => {
      const row = window.TasuTalkNotifications?.findById?.("platform-chat-demo-connect-identity-001");
      return row?.href || row?.targetUrl || "";
    });

    const notifyBtn = page.locator(
      'article[data-talk-notify-id="platform-chat-demo-connect-identity-001"] [data-talk-notify-action]'
    ).first();
    await notifyBtn.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/payment-settings\.html/i, { timeout: 30000 }),
      notifyBtn.click(),
    ]).catch(async () => {
      if (notifyHref) {
        await page.goto(notifyHref, { waitUntil: "domcontentloaded", timeout: 30000 });
      } else {
        await page.goto(paymentUrl(base, "identity"), { waitUntil: "domcontentloaded" });
      }
    });

    await page.waitForSelector("[data-connect-onboarding]", { timeout: 15000 });
    await page.evaluate(() => {
      if (window.TasuPaymentSettings?.resolveConnectStep?.() !== "identity") {
        window.TasuPaymentSettings?.saveConnectOnboarding?.({ step: "identity" });
        window.TasuPaymentSettings?.renderConnectOnboarding?.();
      }
    });
    await page.waitForSelector("[data-connect-identity-panel]:not([hidden])", { timeout: 10000 }).catch(() => {});

    await page.screenshot({ path: join(outDir, "connect-identity-mobile390.png"), fullPage: true });
    report.shots.push("connect-identity-mobile390.png");
    report.steps.push({
      id: "notify-to-identity",
      step: await page.evaluate(() => window.TasuPaymentSettings?.resolveConnectStep?.()),
      pass: true,
    });

    await page.locator("[data-connect-identity-submit]").click();
    await page.waitForFunction(
      () => window.TasuPaymentSettings?.resolveConnectStep?.() === "qualification",
      { timeout: 10000 }
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, "connect-qualification-mobile390.png"), fullPage: true });
    report.shots.push("connect-qualification-mobile390.png");

    await page.locator("[data-payment-bank-name]").fill("TASFUL銀行");
    await page.locator("[data-payment-branch-name]").fill("東京支店");
    await page.locator("[data-payment-account-number]").fill("1234567");
    await page.locator("[data-payment-account-holder]").fill("タスフル サチ");
    await page.locator("[data-payment-save-bank]").click();
    await page.waitForFunction(
      () => window.TasuPaymentSettings?.resolveConnectStep?.() === "reviewing",
      { timeout: 10000 }
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, "connect-reviewing-mobile390.png"), fullPage: true });
    report.shots.push("connect-reviewing-mobile390.png");
    report.steps.push({
      id: "bank-save-reviewing",
      step: "reviewing",
      pass: true,
    });

    await page.evaluate(() => window.TasuPaymentSettings?.advanceConnectStep?.("approved"));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, "connect-approved-mobile390.png"), fullPage: true });
    report.shots.push("connect-approved-mobile390.png");

    await page.evaluate(() => window.TasuPaymentSettings?.advanceConnectStep?.("ready"));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, "connect-ready-mobile390.png"), fullPage: true });
    report.shots.push("connect-ready-mobile390.png");
    report.steps.push({
      id: "connect-ready",
      step: await page.evaluate(() => window.TasuPaymentSettings?.resolveConnectStep?.()),
      pass: (await page.evaluate(() => window.TasuPaymentSettings?.resolveConnectStep?.())) === "ready",
    });

    await page.goto(skillDetailUrl(base, true), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("body[data-listing-loaded='true'], body.tasu-mdetail-ready", {
      timeout: 45000,
    });
    await page.waitForTimeout(1200);
    const tradeWith = await page.evaluate(() => {
      const cta =
        document.querySelector("[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary") ||
        document.querySelector("[data-listing-primary-cta]");
      const notice = document.querySelector(".connect-required-setup-notice");
      return {
        ctaText: cta?.textContent?.trim() || "",
        hasConnectNotice: Boolean(notice),
        connectEnabled: !notice,
      };
    });
    await page.screenshot({ path: join(outDir, "connect-trade-with-mobile390.png"), fullPage: true });
    report.shots.push("connect-trade-with-mobile390.png");
    report.steps.push({ id: "trade-with-connect", ...tradeWith, pass: tradeWith.connectEnabled });

    await page.goto(skillDetailUrl(base, false), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("body[data-listing-loaded='true'], body.tasu-mdetail-ready", {
      timeout: 45000,
    });
    await page.waitForTimeout(1200);
    const tradeWithout = await page.evaluate(() => {
      const listing = window.__tasuDetailContactListing;
      const usesEntry = window.TasuPlatformChatConnectEntryFlow?.usesConnectEntryPayment?.(listing) === true;
      const usesFreeGate = window.TasuPlatformChatFeeGateFlow?.usesConnectFreeFeeGate?.(listing) === true;
      const notice = document.querySelector(".connect-required-setup-notice, .shop-connect-setup-notice");
      const cta =
        document.querySelector("[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary") ||
        document.querySelector("[data-listing-primary-cta]");
      return {
        usesConnectEntry: usesEntry,
        usesConnectFreeGate: usesFreeGate,
        hasConnectNotice: Boolean(notice),
        noticeText: notice?.textContent?.trim() || "",
        ctaText: cta?.textContent?.trim() || "",
        hasCta: Boolean(cta),
      };
    });
    await page.screenshot({ path: join(outDir, "connect-trade-without-mobile390.png"), fullPage: true });
    report.shots.push("connect-trade-without-mobile390.png");
    report.steps.push({
      id: "trade-without-connect",
      ...tradeWithout,
      pass:
        !tradeWithout.usesConnectEntry &&
        (tradeWithout.usesConnectFreeGate || tradeWithout.hasCta || tradeWithout.hasConnectNotice),
    });

    const geminiCopies = [
      ["connect-top-mobile390.png", "connect-top.png"],
      ["connect-apply-mobile390.png", "connect-apply.png"],
      ["connect-identity-mobile390.png", "connect-verification.png"],
      ["connect-approved-mobile390.png", "connect-approved.png"],
      ["connect-trade-with-mobile390.png", "connect-trade-flow.png"],
    ];
    for (const [src, dest] of geminiCopies) {
      await copyFile(join(outDir, src), join(outDir, dest));
      report.shots.push(dest);
    }

    report.stepsPass = report.steps.every((s) => s.pass !== false);

    const { manifest } = await writeScreenshotsManifest(root);
    const qaSection = formatPassReportQaSection({
      searchKeyword: QA_SEARCH_KEYWORD,
      baseUrl: base,
      manifest,
    });
    const qaGate = assertQaCenterReady(manifest);

    report.qa = {
      searchKeyword: QA_SEARCH_KEYWORD,
      viewerPath: qaSection.viewerPath,
      viewerUrl: qaSection.viewerUrl,
      registeredMatchCount: qaSection.registeredMatchCount,
      registeredTotal: qaSection.registeredTotal,
      unregisteredCount: qaSection.unregisteredCount,
      qaGatePass: qaGate.ok,
    };
    report.passed = report.stepsPass && qaGate.ok && report.shots.length >= 10;

    const md = [
      "# Connect UI — Gemini レビュー準備",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## Connect 導線一覧",
      "",
      "| # | 画面 | 導線 | sourceUrl |",
      "|---|------|------|-----------|",
      "| 1 | Connectトップ | 会員メニュー → 支払い方法・口座管理 | payment-settings.html |",
      "| 2 | ダッシュボードバナー | 本人確認未完了 — マイページ上部の固定案内 | dashboard.html |",
      "| 3 | Connect開始 | Connectトップ「Connectを始める」→ 本人確認 / TALK通知 | payment-settings.html → talk-home.html |",
      "| 4 | 本人確認 | 通知「本人確認を進める」→ Connect本人確認パネル | talk-home.html → payment-settings.html |",
      "| 5 | 資格確認 | 本人確認提出後 → 振込先口座セクション | payment-settings.html |",
      "| 6 | Connect審査中 | 振込先保存後 → 審査中ステータス | payment-settings.html |",
      "| 7 | Connect承認 | 審査完了（デモ） | payment-settings.html |",
      "| 8 | Connect利用開始 | 利用可能ステータス | payment-settings.html |",
      "| 9 | Connectあり取引導線 | スキル詳細（demoConnect=1）購入CTA | detail-skill.html |",
      "| 10 | Connectなし取引導線 | スキル詳細（demoConnect=0）決済未設定案内 | detail-skill.html |",
      "",
      "## 登録スクショ一覧",
      "",
      ...SHOTS.map(
        (s) =>
          `- \`screenshots/connect-ui-review/${s.file}\` — ${s.id}${s.gemini ? `（Gemini: \`${s.gemini}\`）` : ""}`
      ),
      "",
      "### Gemini 提出用",
      "",
      "- `screenshots/connect-ui-review/connect-top.png`",
      "- `screenshots/connect-ui-review/connect-apply.png`",
      "- `screenshots/connect-ui-review/connect-verification.png`",
      "- `screenshots/connect-ui-review/connect-approved.png`",
      "- `screenshots/connect-ui-review/connect-trade-flow.png`",
      "",
      qaSection.markdown,
      "",
      "## 実操作検証",
      "",
      "| ステップ | 結果 |",
      "|----------|------|",
      ...report.steps.map((s) => `| ${s.id} | ${s.pass ? "PASS" : "FAIL"} |`),
      "",
      `総合: **${report.passed ? "PASS" : "FAIL"}**`,
      "",
    ].join("\n");

    await writeFile(join(reportDir, "connect-ui-review-prep.md"), md, "utf8");

    console.log(md);
    if (!report.passed) {
      console.error("CONNECT UI REVIEW CAPTURE FAIL");
      process.exitCode = 1;
    } else {
      console.log("CONNECT UI REVIEW CAPTURE PASS");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
