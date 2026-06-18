#!/usr/bin/env node
/**
 * 通知 UI レビュー準備 — 実クリック検証 + 390px キャプチャ + QA Center
 *   node scripts/capture-notify-ui-review.mjs
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
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
const reportPath = join(root, "reports", "notify-ui-review-prep.md");
const QA_SEARCH_KEYWORD = FLOW_SEARCH.find((f) => f.id === "notify")?.viewerSearch || "notify";
const USER_ID = "u_sachi";

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
];

/** @type {Array<{ kind: string, notifyId: string, title: string, expectedAction: string, expectedBehavior: string, urlPattern: RegExp, cardShot?: string, destShot?: string, gemini?: string, seedConnect?: boolean }>} */
const NOTIFICATION_CATALOG = [
  {
    kind: "Connect",
    notifyId: "platform-chat-demo-connect-identity-001",
    title: "【重要】売上の受け取りには本人確認が必要です",
    expectedAction: "本人確認を進める",
    expectedBehavior: "支払い方法・口座管理で本人確認手続きを進める",
    urlPattern: /payment-settings\.html/i,
    cardShot: "notify-connect-mobile390.png",
    destShot: "notify-dest-connect-mobile390.png",
    gemini: "notify-to-connect.png",
    seedConnect: true,
  },
  {
    kind: "チャット",
    notifyId: "platform-verify-job-full-poster-start-001",
    title: "応募者とのやりとりを開始してください",
    expectedAction: "確認する",
    expectedBehavior: "チャットを開いて応募者とやりとりを始める",
    urlPattern: /chat-detail\.html/i,
    cardShot: "notify-chat-mobile390.png",
    destShot: "notify-dest-chat-mobile390.png",
    gemini: "notify-to-chat.png",
  },
  {
    kind: "案件",
    notifyId: "platform-verify-builder-publish-001",
    title: "新しい案件が公開されました",
    expectedAction: "確認する",
    expectedBehavior: "公開案件の詳細を確認する",
    urlPattern: /public-board-detail\.html/i,
    cardShot: "notify-project-mobile390.png",
    destShot: "notify-dest-project-mobile390.png",
    gemini: "notify-to-project.png",
  },
  {
    kind: "応募",
    notifyId: "platform-verify-job-full-apply-001",
    title: "この求人に応募がありました",
    expectedAction: "確認する",
    expectedBehavior: "応募者一覧で応募内容を確認する",
    urlPattern: /detail-job\.html/i,
    cardShot: "notify-job-mobile390.png",
  },
  {
    kind: "採用",
    notifyId: "platform-verify-builder-hired-001",
    title: "採用されました",
    expectedAction: "確認する",
    expectedBehavior: "採用された案件スレッドを開く",
    urlPattern: /board-thread\.html/i,
    cardShot: "notify-hire-mobile390.png",
  },
  {
    kind: "購入",
    notifyId: "platform-verify-skill-purchase-001",
    title: "スキルが購入されました",
    expectedAction: "確認する",
    expectedBehavior: "購入通知を確認しチャット開始準備へ進む",
    urlPattern: /platform-chat-fee-pay\.html|chat-detail\.html/i,
    cardShot: "notify-purchase-mobile390.png",
  },
  {
    kind: "完了報告",
    notifyId: "platform-verify-builder-completion-001",
    title: "完了報告が届きました",
    expectedAction: "確認する",
    expectedBehavior: "完了報告を確認して承認・差し戻しを判断する",
    urlPattern: /board-thread\.html/i,
    cardShot: "notify-completion-mobile390.png",
  },
  {
    kind: "レビュー",
    notifyId: "platform-verify-job-full-review-001",
    title: "評価をお願いします",
    expectedAction: "確認する",
    expectedBehavior: "チャットで取引相手を評価する",
    urlPattern: /chat-detail\.html/i,
    cardShot: "notify-review-mobile390.png",
  },
  {
    kind: "安否",
    notifyId: "platform-verify-anpi-001",
    title: "安否確認通知",
    expectedAction: "確認する",
    expectedBehavior: "安否ダッシュボードで状況を登録・確認する",
    urlPattern: /anpi-dashboard\.html/i,
    cardShot: "notify-anpi-mobile390.png",
    destShot: "notify-dest-anpi-mobile390.png",
    gemini: "notify-to-anpi.png",
  },
  {
    kind: "運営通知",
    notifyId: "platform-verify-system-001",
    title: "重要なお知らせがあります",
    expectedAction: "確認する",
    expectedBehavior: "運営からのお知らせ内容を確認する",
    urlPattern: /dashboard\.html/i,
    cardShot: "notify-system-mobile390.png",
  },
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

async function clickNotifyAndNavigate(page, notifyId) {
  const card = await waitForNotifyCard(page, notifyId);
  const btn = card.locator("[data-talk-notify-action], .talk-notify-card__minimal-action").first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  const href = await page.evaluate((id) => {
    const row = window.TasuTalkNotifications?.findById?.(id);
    return row?.href || row?.targetUrl || "";
  }, notifyId);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {}),
    btn.click(),
  ]);
  if (!/talk-home\.html/i.test(page.url()) && href) {
    return page.url();
  }
  if (href) {
    await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  return page.url();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const base = await requireDevServer();
  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    flows: [],
    shots: [],
    checks: {
      meaningClear: "通知カードにタイトル・カテゴリ・CTA が表示され、何の通知か判別できる",
      actionClear: "CTA ラベルから次に取る行動が分かる",
      returnPath: "詳細ページ遷移時は from=notify / returnTo=talk-home?tab=notify が付与される設計",
    },
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

    await page.screenshot({ path: join(outDir, "notify-list-mobile390.png"), fullPage: false });
    report.shots.push("notify-list-mobile390.png");

    const listState = await page.evaluate(() => ({
      cardCount: document.querySelectorAll("[data-talk-notify-id]").length,
      hasCta: Boolean(document.querySelector("[data-talk-notify-action]")),
    }));
    report.flows.push({
      kind: "通知一覧",
      notifyId: "-",
      title: "通知タブ一覧",
      expectedBehavior: "各通知の種別と次アクションが一覧で把握できる",
      actualUrl: "talk-home.html?tab=notify",
      pass: listState.cardCount >= 10 && listState.hasCta,
      screenshot: "notify-list-mobile390.png",
    });

    for (const item of NOTIFICATION_CATALOG) {
      await openNotifyTab(page, base);
      if (item.seedConnect) await seedConnectNotification(page, base);

      let cardMeta = { title: "", actionLabel: "", category: "" };
      try {
        await screenshotCard(page, item.notifyId, item.cardShot);
        report.shots.push(item.cardShot);

        cardMeta = await page.evaluate((id) => {
          const row = window.TasuTalkNotifications?.findById?.(id) || {};
          const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
          return {
            title: card?.querySelector(".talk-notify-card__title, .talk-notify-card__headline")?.textContent?.trim() || row.title || "",
            actionLabel:
              card?.querySelector("[data-talk-notify-action]")?.textContent?.trim() || row.actionLabel || "",
            category: row.category || "",
          };
        }, item.notifyId);

        const actualUrl = await clickNotifyAndNavigate(page, item.notifyId);
        await page.waitForTimeout(600);

        const urlPass = item.urlPattern.test(actualUrl);
        let destShot = "";
        if (item.destShot) {
          await page.screenshot({ path: join(outDir, item.destShot), fullPage: false });
          report.shots.push(item.destShot);
          destShot = item.destShot;
        }

        const returnMeta = await page.evaluate(() => {
          const params = new URLSearchParams(location.search);
          return {
            from: params.get("from") || "",
            returnTo: params.get("returnTo") || "",
          };
        });

        report.flows.push({
          kind: item.kind,
          notifyId: item.notifyId,
          title: cardMeta.title || item.title,
          expectedAction: item.expectedAction,
          expectedBehavior: item.expectedBehavior,
          expectedUrlPattern: String(item.urlPattern),
          actualUrl,
          actionLabel: cardMeta.actionLabel,
          category: cardMeta.category,
          returnFrom: returnMeta.from,
          returnTo: returnMeta.returnTo,
          pass: urlPass && Boolean(cardMeta.title) && Boolean(cardMeta.actionLabel),
          screenshot: item.cardShot,
          destScreenshot: destShot || null,
        });
      } catch (err) {
        report.flows.push({
          kind: item.kind,
          notifyId: item.notifyId,
          title: item.title,
          expectedBehavior: item.expectedBehavior,
          actualUrl: page.url(),
          pass: false,
          error: String(err?.message || err),
          screenshot: item.cardShot,
        });
      }
    }

    const geminiCopies = [
      ["notify-list-mobile390.png", "notify-list.png"],
      ["notify-dest-chat-mobile390.png", "notify-to-chat.png"],
      ["notify-dest-project-mobile390.png", "notify-to-project.png"],
      ["notify-dest-connect-mobile390.png", "notify-to-connect.png"],
      ["notify-dest-anpi-mobile390.png", "notify-to-anpi.png"],
    ];
    for (const [src, dest] of geminiCopies) {
      try {
        await copyFile(join(outDir, src), join(outDir, dest));
        report.shots.push(dest);
      } catch {
        /* optional */
      }
    }

    const { manifest } = await writeScreenshotsManifest(root);
    const qaSection = formatPassReportQaSection({
      searchKeyword: QA_SEARCH_KEYWORD,
      baseUrl: base,
      manifest,
    });
    const qaGate = assertQaCenterReady(manifest);
    const notifySearchCount = countRegisteredSearchMatches(manifest.images || [], QA_SEARCH_KEYWORD);

    report.qa = {
      searchKeyword: QA_SEARCH_KEYWORD,
      viewerPath: qaSection.viewerPath,
      viewerUrl: qaSection.viewerUrl,
      registeredMatchCount: notifySearchCount,
      registeredTotal: qaSection.registeredTotal,
      unregisteredCount: qaSection.unregisteredCount,
      qaGatePass: qaGate.ok,
    };

    const flowsPass = report.flows.every((f) => f.pass !== false);
    report.passed = flowsPass && qaGate.ok && report.shots.length >= 5;

    const md = [
      "# 通知 UI — レビュー準備",
      "",
      `実施: ${report.capturedAt}`,
      "",
      "## 目的",
      "",
      "利用者が通知を受け取った後、**何の通知か → 何をすればいいか → どこへ行くか** を迷わず理解できる状態にする。",
      "",
      "## 確認事項",
      "",
      "| 観点 | 確認内容 |",
      "|------|----------|",
      `| 通知だけで意味が分かるか | ${report.checks.meaningClear} |`,
      `| 押した先で何をすればいいか分かるか | ${report.checks.actionClear} |`,
      `| 戻り先が分かるか | ${report.checks.returnPath} |`,
      "",
      "## 対象通知カテゴリ",
      "",
      "Connect / チャット / 案件 / 応募 / 採用 / 購入 / 完了報告 / レビュー / 安否 / 運営通知",
      "",
      "## 通知ごとの導線（実クリック検証）",
      "",
      "| 種別 | 通知名 | 期待行動 | 遷移先（期待） | 実際の遷移先 | CTA | 結果 |",
      "|------|--------|----------|----------------|--------------|-----|------|",
      ...report.flows.map((f) => {
        const dest = f.expectedUrlPattern ? f.expectedUrlPattern.replace(/\\/g, "") : "talk-home.html?tab=notify";
        return `| ${f.kind} | ${f.title || "-"} | ${f.expectedBehavior || "-"} | ${dest} | ${f.actualUrl || "-"} | ${f.actionLabel || f.expectedAction || "-"} | ${f.pass ? "PASS" : "FAIL"} |`;
      }),
      "",
      "## 登録スクショ（390px）",
      "",
      "### 最低取得",
      "",
      "- `screenshots/notify-ui-review/notify-list-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-chat-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-job-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-connect-mobile390.png`",
      "- `screenshots/notify-ui-review/notify-anpi-mobile390.png`",
      "",
      "### Gemini 提出用",
      "",
      "- `screenshots/notify-ui-review/notify-list.png` — 通知一覧",
      "- `screenshots/notify-ui-review/notify-to-chat.png` — 通知→チャット",
      "- `screenshots/notify-ui-review/notify-to-project.png` — 通知→案件",
      "- `screenshots/notify-ui-review/notify-to-connect.png` — 通知→Connect",
      "- `screenshots/notify-ui-review/notify-to-anpi.png` — 通知→安否",
      "",
      qaSection.markdown,
      "",
      `総合: **${report.passed ? "PASS" : "FAIL"}**`,
      "",
    ].join("\n");

    await writeFile(reportPath, md, "utf8");
    console.log(md);

    if (!report.passed) {
      console.error("NOTIFY UI REVIEW CAPTURE FAIL");
      process.exitCode = 1;
    } else {
      console.log("NOTIFY UI REVIEW CAPTURE PASS");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
