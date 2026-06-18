#!/usr/bin/env node
/**
 * プラットUI手動レビュー — 6カテゴリフルフロー撮影 + manual-review-index 生成
 *
 * 出力:
 *   screenshots/platform-manual-review/{category}/*.png
 *   manual-review-index.json
 *   manual-review-index.md
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";
import {
  REVIEW_ROOT,
  JOB_FLOW,
  NON_JOB_CATEGORIES,
  relShot,
  pathnameOnly,
} from "./lib/platform-manual-review-flows.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };

/** @type {Array<{ categoryKey: string, categoryLabel: string, steps: object[] }>} */
const allFlows = [];

class FlowRecorder {
  /** @param {string} categoryKey @param {string} categoryLabel @param {string} outDir */
  constructor(categoryKey, categoryLabel, outDir) {
    this.categoryKey = categoryKey;
    this.categoryLabel = categoryLabel;
    this.outDir = outDir;
    /** @type {object[]} */
    this.steps = [];
    this.lastPath = null;
  }

  /**
   * @param {import('playwright').Page} page
   * @param {string} fileName
   * @param {object} meta
   */
  async capture(page, fileName, meta) {
    fs.mkdirSync(this.outDir, { recursive: true });
    const shotPath = path.join(this.outDir, fileName);
    await page.waitForTimeout(meta.waitMs ?? 650);
    if (meta.element) {
      await meta.element.screenshot({ path: shotPath });
    } else if (meta.scrollTop) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), meta.scrollTop);
      await page.waitForTimeout(200);
      await page.screenshot({ path: shotPath });
    } else {
      await page.screenshot({ path: shotPath });
    }

    const fullUrl = page.url();
    const pathOnly = pathnameOnly(fullUrl);
    const step = {
      order: this.steps.length + 1,
      category: this.categoryLabel,
      categoryKey: this.categoryKey,
      screenName: meta.screenName,
      fileName: relShot(this.categoryKey, fileName),
      url: pathOnly,
      fullUrl: devUrl(pathOnly.startsWith("/") ? pathOnly.slice(1) : pathOnly),
      from: meta.from ?? this.lastPath,
      to: meta.to ?? pathOnly,
      operation: meta.operation,
      checkPoints: meta.checkPoints || [],
    };
    this.steps.push(step);
    this.lastPath = pathOnly;
    return step;
  }

  finish() {
    allFlows.push({
      categoryKey: this.categoryKey,
      categoryLabel: this.categoryLabel,
      steps: this.steps,
    });
  }
}

async function waitListing(page) {
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true" || document.body.dataset.page,
    { timeout: 45000 }
  );
  await page.waitForTimeout(400);
}

async function waitNotifyTab(page) {
  await page.waitForFunction(
    () => (window.TasuTalkNotifications?.getAll?.() || []).length >= 18,
    { timeout: 45000 }
  );
  await page.waitForTimeout(700);
}

async function scrollNotifyCard(page, notifyId) {
  const card = page.locator(`article[data-talk-notify-id="${notifyId}"]`);
  if ((await card.count()) > 0) {
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  return card;
}

async function openNotifyDestination(page, notifyId) {
  const dest = await page.evaluate((id) => {
    const row = (window.TasuTalkNotifications?.getAll?.() || []).find((n) => String(n.id) === id);
    if (!row) return null;
    const action = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return action?.href || row.href || row.targetUrl || "";
  }, notifyId);
  if (!dest) throw new Error(`notify destination missing: ${notifyId}`);
  await page.goto(devUrl(dest.replace(/^\//, "")), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(700);
  return dest;
}

async function resetPrepayThread(page, notifyId) {
  await page.evaluate((id) => window.TasuPlatformChatDemoSeed?.resetVerifyFeeThread?.(id), notifyId);
}

async function resetConnectComplete(page, notifyId) {
  await page.evaluate(
    (id) => window.TasuPlatformChatConnectDemoSeed?.resetConnectCompleteDemo?.(id),
    notifyId
  );
}

async function payPreChatFee(page) {
  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 15000 }
  );
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const link = document.querySelector("[data-platform-fee-chat-link]");
    return link?.getAttribute("href") || "";
  });
}

async function runJobFlow(page) {
  const cfg = JOB_FLOW;
  const rec = new FlowRecorder(cfg.key, cfg.label, path.join(REVIEW_ROOT, cfg.key));
  const errors = [];

  await page.goto(devUrl("job-top.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await rec.capture(page, "01-job-list.png", {
    screenName: "求人一覧",
    operation: "求人一覧を開く",
    checkPoints: ["求人カードが一覧表示される", "TasuFull求人トップが表示される"],
    from: null,
    to: "job-top.html",
  });

  const detailApplicant = `detail-job.html?id=${cfg.listingId}&userId=${cfg.applicantUserId}&talkDev=1`;
  await page.goto(devUrl(detailApplicant), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitListing(page);
  await rec.capture(page, "02-job-detail.png", {
    screenName: "求人詳細（応募者）",
    operation: "求人詳細を開く",
    checkPoints: ["ヒーロー・報酬・応募ボタンが表示される", "職場イメージ等の詳細セクションがある"],
    from: "job-top.html",
    to: detailApplicant,
  });

  const applyBtn = page.locator("[data-listing-primary-cta], [data-job-dock-apply]").first();
  if ((await applyBtn.count()) > 0) {
    const label = (await applyBtn.textContent())?.trim() || "";
    if (label === "応募する") {
      await applyBtn.click();
      await page.waitForTimeout(800);
    }
  }
  await rec.capture(page, "03-apply.png", {
    screenName: "応募送信",
    operation: "応募ボタン押下（または応募済み表示）",
    checkPoints: ["「応募済み」または応募完了トースト", "掲載者への応募通知が発火する導線"],
    from: detailApplicant,
    to: detailApplicant,
  });

  const notifyPoster = `talk-home.html?tab=notify&userId=${cfg.posterUserId}&talkDev=1`;
  await page.goto(devUrl(notifyPoster), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitNotifyTab(page);
  await scrollNotifyCard(page, cfg.applyNotifyId);
  await rec.capture(page, "04-notify.png", {
    screenName: "応募通知",
    operation: "掲載者が通知タブで応募通知を確認",
    checkPoints: ["「この求人に応募がありました」", "「確認する」のみ（本文なし）"],
    from: detailApplicant,
    to: notifyPoster,
  });

  const applyCard = page.locator(`article[data-talk-notify-id="${cfg.applyNotifyId}"]`);
  if ((await applyCard.count()) === 0) errors.push("job: apply notify card missing");
  await openNotifyDestination(page, cfg.applyNotifyId);
  await page.waitForFunction(
    () => document.querySelector("[data-job-applications-section]") && !document.querySelector("[data-job-applications-section]").hidden,
    { timeout: 45000 }
  );
  await page.waitForTimeout(900);
  const appsPath = pathnameOnly(page.url());
  await rec.capture(page, "05-applications.png", {
    screenName: "応募者確認",
    operation: "「確認する」→ 応募者確認（view=applications）",
    checkPoints: [
      "応募者カードと検索/フィルター/並び替え",
      "職場イメージ・求人詳細セクションは非表示",
      "件数バッジが維持される",
    ],
    from: notifyPoster,
    to: appsPath,
  });

  const proceed = page.locator("[data-job-app-proceed]").first();
  if ((await proceed.count()) < 1) errors.push("job: proceed button missing");
  else {
    await proceed.click();
    await page.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 15000 });
  }
  await page.waitForTimeout(700);
  const payPath = pathnameOnly(page.url());
  await rec.capture(page, "06-pay-550.png", {
    screenName: "550円支払い",
    operation: "「やりとりに進む」→ 利用料550円の支払い画面",
    checkPoints: ["¥550 定額", "Connect/5%表記なし", "求人カテゴリ"],
    from: appsPath,
    to: payPath,
  });

  const chatHref = await payPreChatFee(page);
  await page.goto(devUrl(chatHref.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const chatPath = pathnameOnly(page.url());
  await rec.capture(page, "07-chat.png", {
    screenName: "求人チャット",
    operation: "550円支払い完了 → チャットを開く",
    checkPoints: ["求人応募カードが表示される", "deal-detail / チャットで確認 なし"],
    from: payPath,
    to: chatPath,
  });

  const hiredNotify = `talk-home.html?tab=notify&userId=${cfg.applicantUserId}&talkDev=1`;
  await page.goto(devUrl(hiredNotify), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitNotifyTab(page);
  await scrollNotifyCard(page, cfg.hiredNotifyId);
  await rec.capture(page, "08-hired-notify.png", {
    screenName: "採用通知",
    operation: "応募者が「採用されました」通知を確認",
    checkPoints: ["タイトルのみ＋「確認する」", "hire-result へ遷移する href"],
    from: chatPath,
    to: hiredNotify,
  });

  await openNotifyDestination(page, cfg.hiredNotifyId);
  await page.waitForFunction(
    () => document.querySelector("[data-job-applications-section]") && !document.querySelector("[data-job-applications-section]").hidden,
    { timeout: 30000 }
  );
  await page.waitForTimeout(800);
  const hiredPath = pathnameOnly(page.url());
  await rec.capture(page, "09-hired-card.png", {
    screenName: "採用結果",
    operation: "「確認する」→ 採用結果カード（view=hire-result）",
    checkPoints: ["採用結果カード1件", "やりとり開始または待機メッセージ", "通常求人詳細は非表示"],
    from: hiredNotify,
    to: hiredPath,
  });

  rec.finish();
  return errors;
}

/**
 * @param {import('playwright').Page} page
 * @param {typeof NON_JOB_CATEGORIES[0]} cfg
 */
async function runNonJobFlow(page, cfg) {
  const rec = new FlowRecorder(cfg.key, cfg.label, path.join(REVIEW_ROOT, cfg.key));
  const errors = [];

  await page.goto(devUrl(cfg.detailPath), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitListing(page);
  await rec.capture(page, `01-${cfg.filePrefix}-detail.png`, {
    screenName: cfg.detailScreen,
    operation: cfg.detailOperation,
    checkPoints: cfg.detailChecks,
    from: null,
    to: cfg.detailPath,
  });

  const notifySeller = `talk-home.html?tab=notify&userId=${cfg.sellerUserId}&talkDev=1`;
  await page.goto(devUrl(notifySeller), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitNotifyTab(page);
  await resetPrepayThread(page, cfg.prepayNotifyId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitNotifyTab(page);
  await scrollNotifyCard(page, cfg.prepayNotifyId);
  await rec.capture(page, `${cfg.prepayNotifyFile}.png`, {
    screenName: cfg.prepayNotifyScreen,
    operation: cfg.prepayNotifyOperation,
    checkPoints: cfg.prepayNotifyChecks,
    from: cfg.detailPath,
    to: notifySeller,
  });

  await openNotifyDestination(page, cfg.prepayNotifyId);
  await page.waitForTimeout(700);
  const prepayPayPath = pathnameOnly(page.url());
  await rec.capture(page, "03-fee-pay.png", {
    screenName: "前払い支払い",
    operation: "「確認する」→ 5%・最低550円の支払い画面",
    checkPoints: ["5%・最低550円", "deal-detail リンクなし", `${cfg.feeCategory} カテゴリ`],
    from: notifySeller,
    to: prepayPayPath,
  });

  const chatHref = await payPreChatFee(page);
  await page.goto(devUrl(chatHref.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  const prepayChatPath = pathnameOnly(page.url());
  await rec.capture(page, "04-chat.png", {
    screenName: "チャット（前払い後）",
    operation: "支払い完了 → チャットを開く",
    checkPoints: ["コンテンツカードが表示される", "deal-detail なし"],
    from: prepayPayPath,
    to: prepayChatPath,
  });

  const contentCard = page.locator("[data-platform-content-card]").first();
  if ((await contentCard.count()) > 0) {
    await contentCard.scrollIntoViewIfNeeded();
    await rec.capture(page, "05-content-card.png", {
      screenName: "コンテンツカード",
      operation: "チャット内カード（セクションラベル確認）",
      checkPoints: [`「${cfg.sectionLabel}」セクション`, "一覧/detail への不要リンクなし"],
      from: prepayChatPath,
      to: prepayChatPath,
      element: contentCard,
    });
  } else {
    errors.push(`${cfg.key}: content card missing`);
  }

  const dealChatPath = `chat-detail.html?thread=${cfg.dealThreadId}&deal=${cfg.dealId}&userId=${cfg.sellerUserId}&talkDev=1`;
  await resetConnectComplete(page, cfg.completeNotifyId);
  await page.goto(devUrl(dealChatPath), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1100);
  await rec.capture(page, "06-complete.png", {
    screenName: "完了報告（チャット）",
    operation: "取引スレッドで完了報告カードを確認",
    checkPoints: ["「完了報告」カード", "承認/差し戻しボタン", "deal-detail へ行かない"],
    from: prepayChatPath,
    to: dealChatPath,
  });

  await page.goto(devUrl(notifySeller), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitNotifyTab(page);
  await resetConnectComplete(page, cfg.completeNotifyId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitNotifyTab(page);
  await scrollNotifyCard(page, cfg.completeNotifyId);
  await rec.capture(page, "07-complete-notify.png", {
    screenName: "取引完了通知",
    operation: "通知タブで「取引が完了しました」を確認",
    checkPoints: ["タイトルのみ＋「確認する」", "chat-detail へ遷移"],
    from: dealChatPath,
    to: notifySeller,
  });

  await openNotifyDestination(page, cfg.completeNotifyId);
  await page.waitForTimeout(1000);
  const completeChatPath = pathnameOnly(page.url());
  await rec.capture(page, "08-complete-card.png", {
    screenName: "完了報告（通知経由）",
    operation: "「確認する」→ 完了報告カード付きチャット",
    checkPoints: ["完了報告カードが表示", "チャットで確認 ボタンなし"],
    from: notifySeller,
    to: completeChatPath,
  });

  const approve = page.locator("[data-platform-completion-approve]");
  if ((await approve.count()) > 0) {
    await approve.click();
    await page.waitForTimeout(700);
  } else {
    errors.push(`${cfg.key}: completion approve missing`);
  }

  const feePayHref = await page.evaluate(() => {
    return document.querySelector("[data-platform-completion-fee-pay]")?.getAttribute("href") || "";
  });
  if (!feePayHref.includes("platform-chat-fee-pay.html")) {
    errors.push(`${cfg.key}: completion fee href missing`);
  } else {
    await page.goto(devUrl(feePayHref.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const completePayPath = pathnameOnly(page.url());
    await rec.capture(page, "09-fee-after-complete.png", {
      screenName: "完了後5%請求",
      operation: "完了承認 → 完了時5%・最低550円の支払い画面",
      checkPoints: ["phase=complete", "5%・最低550円", "取引完了後の請求であること"],
      from: completeChatPath,
      to: completePayPath,
    });
  }

  rec.finish();
  return errors;
}

function buildMarkdown(index) {
  const lines = [
    "# プラットUI 手動レビュー索引",
    "",
    "ローカル dev サーバー: `npm run dev` → **http://localhost:5173**",
    "",
    "使い方: 下表の URL を開く → 実画面確認 → スクショ照合 → 修正指示",
    "",
    "## 注意（URL再現）",
    "",
    "- **求人**の `06-pay-550` / `07-chat` の `thread=` は撮影実行時の動的IDです。レビュー時は `05-applications` から「やりとりに進む」→ 支払い → チャットで再現してください。",
    "- **その他5カテゴリ**の前払いは `chat-demo-{category}-fee-001`、完了フローは `chat-demo-{category}-deal-001` + `*_deal_demo_001` 固定です。",
    "- 通知タブは `talk-home.html?tab=notify&userId={ユーザーID}&talkDev=1` でユーザー切替してください。",
    "",
    "---",
    "",
  ];

  for (const flow of index.categories) {
    lines.push(`## ${flow.categoryLabel}（${flow.categoryKey}）`);
    lines.push("");
    lines.push("| # | 画面 | スクショ | URL | 確認ポイント |");
    lines.push("|---|------|----------|-----|--------------|");
    for (const step of flow.steps) {
      const checks = (step.checkPoints || []).join(" / ");
      lines.push(
        `| ${step.order} | ${step.screenName} | [\`${step.fileName.split("/").pop()}\`](${step.fileName}) | [\`${step.url}\`](${step.fullUrl}) | ${checks} |`
      );
    }
    lines.push("");
    lines.push("### 遷移フロー");
    lines.push("");
    for (const step of flow.steps) {
      lines.push(`#### ${String(step.order).padStart(2, "0")}. ${step.fileName.split("/").pop()}`);
      lines.push("");
      lines.push(`- **画面名:** ${step.screenName}`);
      lines.push(`- **URL:** \`${step.url}\``);
      lines.push(`- **フルURL:** ${step.fullUrl}`);
      if (step.from) lines.push(`- **遷移元:** \`${step.from}\``);
      lines.push(`- **遷移先:** \`${step.to}\``);
      lines.push(`- **操作:** ${step.operation}`);
      if (step.checkPoints?.length) {
        lines.push("- **確認ポイント:**");
        for (const cp of step.checkPoints) lines.push(`  - ${cp}`);
      }
      lines.push("");
      if (step.order < flow.steps.length) {
        lines.push("↓");
        lines.push("");
      }
    }
    lines.push("---");
    lines.push("");
  }

  lines.push("## URL一覧（カテゴリ別）");
  lines.push("");
  for (const flow of index.categories) {
    lines.push(`### ${flow.categoryLabel}`);
    lines.push("");
    for (const step of flow.steps) {
      lines.push(`${step.order}. ${step.screenName}: ${step.fullUrl}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function run() {
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const allErrors = [];

  for (const cfg of [{ type: "job" }, ...NON_JOB_CATEGORIES.map((c) => ({ type: "nonjob", cfg: c }))]) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    page.on("dialog", async (d) => d.accept());

    if (cfg.type === "job") {
      const errs = await runJobFlow(page);
      allErrors.push(...errs);
    } else {
      const errs = await runNonJobFlow(page, cfg.cfg);
      allErrors.push(...errs);
    }
    await context.close();
  }

  await browser.close();

  const index = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    viewport: VIEWPORT,
    screenshotRoot: REVIEW_ROOT,
    categories: allFlows,
  };

  fs.writeFileSync("manual-review-index.json", JSON.stringify(index, null, 2));
  fs.writeFileSync("manual-review-index.md", buildMarkdown(index));

  console.log(JSON.stringify({ baseUrl: BASE, categories: allFlows.map((f) => ({ key: f.categoryKey, steps: f.steps.length })), errors: allErrors }, null, 2));

  if (allErrors.length) {
    allErrors.forEach((e) => console.error(`WARN: ${e}`));
  }
  console.log("Generated manual-review-index.json and manual-review-index.md");
}

await run();
