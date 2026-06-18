#!/usr/bin/env node
/**
 * Gemini 通知レビュー round2 — 重要/通常分離・Connect文言・安否CTA 検証
 *   node scripts/capture-notify-ui-round2.mjs
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
  FLOW_SEARCH,
} from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "screenshots", "notify-ui-review");
const reportPath = join(root, "reports", "notify-ui-review-round2.md");
const QA_SEARCH_KEYWORD = FLOW_SEARCH.find((f) => f.id === "notify")?.viewerSearch || "notify";
const USER_ID = "u_sachi";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

function notifyUrl(base, params = {}) {
  const u = new URL(`${base}/talk-home.html`);
  u.searchParams.set("tab", "notify");
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", USER_ID);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") u.searchParams.set(k, v);
  });
  return u.toString();
}

function paymentSettingsIdentityUrl(base) {
  const u = new URL(`${base}/payment-settings.html`);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("userId", USER_ID);
  u.searchParams.set("connectStep", "identity");
  return `${u.pathname}${u.search}`;
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => globalThis.localStorage.removeItem(k));
    globalThis.localStorage.removeItem("tasful_talk_notifications");
  }, { markers: MASTER_MARKERS });
}

async function seedConnectNotification(page, base) {
  const href = paymentSettingsIdentityUrl(base);
  await page.evaluate(
    ({ sellerId, identityHref }) => {
      const store = window.TasuTalkNotifications;
      if (!store?.getAll || !store?.saveAll) return;
      const id = "platform-chat-demo-connect-identity-001";
      const row = {
        id,
        type: "skill",
        category: "Connect",
        title: "【重要】売上の受け取りには本人確認が必要です",
        body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
        actionLabel: "本人確認を進める",
        href: identityHref,
        targetUrl: identityHref,
        priority: "high",
        recipientUserId: sellerId,
        source: "platform_chat_demo_connect_requirements_v1",
        minimalNotifyCard: true,
        notifyDeadlineLabel: "期限: 7日以内",
        createdAt: new Date().toISOString(),
      };
      const next = (store.getAll() || []).filter((n) => String(n.id) !== id);
      next.unshift(row);
      store.saveAll(next, { localOnly: true, silent: true });
      window.dispatchEvent(
        new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } })
      );
    },
    { sellerId: USER_ID, identityHref: href }
  );
}

async function openNotifyTab(page, base) {
  await page.goto(notifyUrl(base), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
  await page.locator('[data-talk-tab="notify"], [data-talk-nav-notify]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector("[data-talk-notify-list]", { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function waitForNotifyCard(page, notifyId) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`).first();
  await card.waitFor({ state: "attached", timeout: 20000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  return card;
}

async function screenshotCard(page, notifyId, fileName) {
  const card = await waitForNotifyCard(page, notifyId);
  await card.screenshot({ path: join(outDir, fileName) });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const base = await requireDevServer();
  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    geminiRound: 2,
    checks: [],
    shots: [],
    passed: false,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

    await openNotifyTab(page, base);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-talk-notify-list]", { timeout: 30000 });
    await page.waitForTimeout(2000);
    await seedConnectNotification(page, base);
    await page.waitForTimeout(1200);

    const listAudit = await page.evaluate(() => {
      const importantSection = document.querySelector(".talk-notify-section--important");
      const normalSection = document.querySelector(".talk-notify-section--normal");
      const connectCard = document.querySelector(
        'article[data-talk-notify-id="platform-chat-demo-connect-identity-001"]'
      );
      const anpiCard = document.querySelector('article[data-talk-notify-id="platform-verify-anpi-001"]');
      const chatCard = document.querySelector(
        'article[data-talk-notify-id="platform-verify-job-full-poster-start-001"]'
      );
      return {
        hasImportantSection: Boolean(importantSection),
        hasNormalSection: Boolean(normalSection),
        connectTitle: connectCard?.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
        connectDeadline: connectCard?.querySelector(".talk-notify-card__deadline")?.textContent?.trim() || "",
        connectTier: connectCard?.getAttribute("data-talk-notify-tier") || "",
        connectHasCta: Boolean(connectCard?.querySelector("[data-talk-notify-action]")),
        anpiTier: anpiCard?.getAttribute("data-talk-notify-tier") || "",
        anpiPrimaryLabel:
          anpiCard?.querySelector("[data-anpi-notify-inline-safe]")?.textContent?.trim() || "",
        anpiHasSafeBtn: Boolean(anpiCard?.querySelector("[data-anpi-notify-inline-safe]")),
        chatTier: chatCard?.getAttribute("data-talk-notify-tier") || "",
        chatHasCta: Boolean(chatCard?.querySelector("[data-talk-notify-action]")),
        importantAccent: Boolean(document.querySelector(".talk-notify-card--tier-important")),
      };
    });

    report.checks.push({
      id: "A1-split-sections",
      label: "重要通知と通常通知を分離",
      pass: listAudit.hasImportantSection && listAudit.hasNormalSection,
      detail: listAudit,
    });
    report.checks.push({
      id: "A2-connect-copy",
      label: "Connect通知文言改善",
      pass: /【重要】.*本人確認/.test(listAudit.connectTitle),
      detail: { title: listAudit.connectTitle, deadline: listAudit.connectDeadline },
    });
    report.checks.push({
      id: "A3-visual-tier",
      label: "重要通知の視覚差（オレンジ/赤アクセント）",
      pass: listAudit.importantAccent && listAudit.connectTier === "important",
      detail: { connectTier: listAudit.connectTier },
    });
    report.checks.push({
      id: "A1-important-cta",
      label: "重要通知はボタン付きカード",
      pass: listAudit.connectHasCta && listAudit.anpiHasSafeBtn,
      detail: {
        connectCta: listAudit.connectHasCta,
        anpiPrimary: listAudit.anpiPrimaryLabel,
      },
    });
    report.checks.push({
      id: "A1-normal-tap",
      label: "通常通知はカード全体タップ・CTA廃止",
      pass: listAudit.chatTier === "normal" && !listAudit.chatHasCta,
      detail: { chatTier: listAudit.chatTier, chatHasCta: listAudit.chatHasCta },
    });
    report.checks.push({
      id: "B5-anpi-safe-priority",
      label: "安否「無事です」を最優先表示",
      pass: listAudit.anpiPrimaryLabel === "無事です",
      detail: { anpiPrimaryLabel: listAudit.anpiPrimaryLabel },
    });

    await page.screenshot({ path: join(outDir, "notify-list-mobile390.png"), fullPage: false });
    report.shots.push("notify-list-mobile390.png");

    await screenshotCard(page, "platform-chat-demo-connect-identity-001", "notify-connect-mobile390.png");
    report.shots.push("notify-connect-mobile390.png");

    await screenshotCard(page, "platform-verify-anpi-001", "notify-anpi-mobile390.png");
    report.shots.push("notify-anpi-mobile390.png");

    const { manifest } = await writeScreenshotsManifest(root);
    const qaSection = formatPassReportQaSection({
      searchKeyword: QA_SEARCH_KEYWORD,
      baseUrl: base,
      manifest,
    });
    const qaGate = assertQaCenterReady(manifest);
    const registered = countRegisteredSearchMatches(manifest.images || [], QA_SEARCH_KEYWORD);

    report.passed = report.checks.every((c) => c.pass) && qaGate.ok;

    const md = [
      "# 通知 UI レビュー round2（Gemini 反映）",
      "",
      `Captured: ${report.capturedAt}`,
      "",
      "## 優先度A",
      "",
      "1. 通知一覧を重要通知と通常通知に分離",
      "2. Connect通知文言改善",
      "3. 重要通知の視覚差（オレンジ/赤アクセント）",
      "",
      "## 優先度B",
      "",
      "4. Connect状態ラベル整理（未対応/提出済み/審査中/完了）— `connect-member-ui.js` / `payment-settings.js`",
      "5. 安否通知の「無事です」最優先表示",
      "",
      "## 検証結果",
      "",
      report.passed ? "**PASS**" : "**FAIL**",
      "",
      "| チェック | 結果 |",
      "| --- | --- |",
      ...report.checks.map((c) => `| ${c.label} | ${c.pass ? "PASS" : "FAIL"} |`),
      "",
      "## スクリーンショット",
      "",
      "- `screenshots/notify-ui-review/notify-list-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-connect-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-anpi-mobile390.png`",
      "",
      `## QA Center`,
      "",
      `- 検索: \`${QA_SEARCH_KEYWORD}\` (${registered} 件)`,
      `- Viewer: ${qaSection.viewerUrl}`,
      `- 未登録: ${qaSection.unregisteredCount}`,
      `- QA Gate: ${qaGate.ok ? "PASS" : "FAIL"}`,
      "",
    ].join("\n");

    await writeFile(reportPath, md, "utf8");
    console.log(`Report: ${reportPath}`);
    console.log(report.passed ? "PASS" : "FAIL");
    if (!report.passed) {
      console.error(JSON.stringify(report.checks.filter((c) => !c.pass), null, 2));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
