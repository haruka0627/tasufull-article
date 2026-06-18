#!/usr/bin/env node
/**
 * 求人カテゴリ UI 手動レビュー — 390px 撮影 + job-ui-review.md 生成
 *
 * 出力:
 *   screenshots/platform-manual-review/job/01–09 + notify/talk 補助スクショ
 *   job-ui-review.json
 *   job-ui-review.md
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";
import {
  REVIEW_ROOT,
  JOB_FLOW,
  relShot,
  pathnameOnly,
} from "./lib/platform-manual-review-flows.mjs";

const BASE = await requireDevServer();
const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR = path.join(REVIEW_ROOT, JOB_FLOW.key);

/** @type {object[]} */
const steps = [];
/** @type {object[]} */
const notifyChannels = [];
/** @type {string[]} */
const errors = [];

function recordStep(meta) {
  const step = { order: steps.length + 1, ...meta };
  steps.push(step);
  return step;
}

function buildMarkdown(index) {
  const uiChecklist = [
    "タイトルは分かりやすいか",
    "何の求人か分かるか",
    "ボタン文言は自然か",
    "不要なセクションが残っていないか",
    "余白は適切か",
    "CTAは見つけやすいか",
    "情報の優先順位は正しいか",
    "スマホ390pxで見やすいか",
    "「—」表示が残っていないか",
    "開発文言が残っていないか",
  ];

  const lines = [
    "# 求人カテゴリ UI 手動レビュー",
    "",
    `生成日時: ${index.generatedAt}`,
    "",
    "ローカル dev: `npm run dev` → **http://localhost:5173**",
    "",
    "目的: **人間の目視確認**（AI PASS 判定は不要）。各画面のスクショ・URL・確認観点を照合してください。",
    "",
    "## フロー全体",
    "",
    "```",
    "求人一覧 → 求人詳細 → 応募 → 応募通知 → 応募者確認 → やりとりに進む",
    "→ 550円支払い → チャット → 採用通知 → 採用結果",
    "```",
    "",
    "## 通知（求人）",
    "",
    "求人で存在する通知は **2件** です。いずれも **タイトル + 「確認する」** のみ。",
    "",
    "| # | 通知ID | タイトル | 受信者 | 遷移先 |",
    "|---|--------|----------|--------|--------|",
    `| ① | \`${JOB_FLOW.applyNotifyId}\` | この求人に応募がありました | 掲載者 (\`${JOB_FLOW.posterUserId}\`) | 応募者確認 (\`view=applications\`) |`,
    `| ② | \`${JOB_FLOW.hiredNotifyId}\` | 採用されました | 応募者 (\`${JOB_FLOW.applicantUserId}\`) | 採用結果 (\`view=hire-result\`) |`,
    "",
    "### 通知導線 ① この求人に応募がありました",
    "",
    "通知 → 確認する → 応募者確認",
    "",
    "確認項目:",
    "- 正しいページへ飛ぶか",
    "- 応募者カードが表示されるか",
    "- 応募先タイトルが表示されるか",
    "- 不要なセクションが出ないか",
    "- 応募者確認として成立しているか",
    "",
    "### 通知導線 ② 採用されました",
    "",
    "通知 → 確認する → 採用結果カード",
    "",
    "確認項目:",
    "- 正しいページへ飛ぶか",
    "- 採用結果カードが表示されるか",
    "- 求人タイトルが表示されるか",
    "- 採用状況が分かるか",
    "- 不要なセクションが出ないか",
    "",
    "### 通知チャネル（通知タブ + TASFUL TALK）",
    "",
    "| 通知 | 通知タブ | TASFUL TALK |",
    "|------|----------|-------------|",
  ];

  for (const ch of index.notifyChannels) {
    lines.push(
      `| ${ch.label} | [\`${path.basename(ch.notifyTab.file)}\`](${ch.notifyTab.file}) | [\`${path.basename(ch.talk.file)}\`](${ch.talk.file}) |`
    );
  }

  lines.push(
    "",
    "TASFUL TALK は `talk-home.html?tab=chat&thread=official_tasful` の公式ルーム。求人通知2件の一覧: ",
    `[notify-talk-job-both-390.png](${relShot(JOB_FLOW.key, "notify-talk-job-both-390.png")})`,
    "",
    "## 全画面共通 UI 確認項目",
    ""
  );
  uiChecklist.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push("", "---", "", "## 画面別レビュー（提出順）", "");

  for (const step of index.steps) {
    const fileBase = path.basename(step.fileName);
    const orderLabel = step.filePrefix || String(step.order).padStart(2, "0");
    lines.push(`### ${orderLabel}. ${step.screenName}`);
    lines.push("");
    lines.push(`![${step.screenName}](${step.fileName})`);
    lines.push("");
    if (step.talkScreenshot) {
      lines.push(`**TASFUL TALK:** ![${step.screenName} TALK](${step.talkScreenshot})`);
      lines.push("");
    }
    lines.push(`- **スクショ:** \`${step.fileName}\``);
    lines.push(`- **URL:** [\`${step.url}\`](${step.fullUrl})`);
    lines.push(`- **何を確認する画面か:** ${step.purpose}`);
    if (step.operation) lines.push(`- **操作:** ${step.operation}`);
    if (step.checkPoints?.length) {
      lines.push("- **確認ポイント:**");
      for (const cp of step.checkPoints) lines.push(`  - ${cp}`);
    }
    lines.push(`- **気になった点:** ${step.concerns || "（目視で記入）"}`);
    lines.push(`- **改善案:** ${step.improvements || "（目視で記入）"}`);
    lines.push("");
  }

  lines.push("---", "", "## URL 一覧（求人）", "");
  for (const step of index.steps) {
    const prefix = step.filePrefix || String(step.order).padStart(2, "0");
    lines.push(`${prefix}. ${step.screenName}: ${step.fullUrl}`);
  }
  lines.push(
    "",
    "## 再現メモ",
    "",
    "- `06-pay-550` / `07-chat` の `thread=` は実行時の動的IDです。`05-applications` から「やりとりに進む」→ 支払い → チャットで再現してください。",
    "- 通知タブは `userId` で掲載者/応募者を切替: 応募通知=`u_job_demo_full`、採用通知=`u_hiro`。",
    "- 撮影: `node scripts/capture-platform-job-ui-review-390.mjs`",
    ""
  );

  return lines.join("\n");
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

async function capture(page, fileName, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shotPath = path.join(OUT_DIR, fileName);
  await page.waitForTimeout(meta.waitMs ?? 650);
  if (meta.element) {
    await meta.element.screenshot({ path: shotPath });
  } else {
    await page.screenshot({ path: shotPath });
  }
  const pathOnly = pathnameOnly(page.url());
  return recordStep({
    filePrefix: meta.filePrefix || fileName.match(/^(\d+)/)?.[1]?.padStart(2, "0"),
    screenName: meta.screenName,
    fileName: relShot(JOB_FLOW.key, fileName),
    url: pathOnly,
    fullUrl: devUrl(pathOnly.startsWith("/") ? pathOnly.slice(1) : pathOnly),
    purpose: meta.purpose,
    operation: meta.operation,
    checkPoints: meta.checkPoints || [],
    concerns: meta.concerns || "",
    improvements: meta.improvements || "",
  });
}

async function openOfficialTasfulRoom(page) {
  await page.goto(devUrl("talk-home.html?tab=chat&thread=official_tasful"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const threadBtn = page.locator('[data-talk-select-thread][data-talk-thread-id="official_tasful"]');
  if ((await threadBtn.count()) > 0 && (await page.locator("[data-talk-line-room-active]:not([hidden])").count()) === 0) {
    await threadBtn.click();
  }
  await page.waitForSelector("[data-talk-line-room-active]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function filterNotifyJobChip(page) {
  await page.evaluate(() => {
    const chip = document.querySelector('[data-talk-notify-mobile-chip="job"]');
    if (!chip || chip.classList.contains("is-active")) return;
    chip.click();
  });
  await page.waitForTimeout(450);
}

async function captureNotifyChannel(page, cfg) {
  const notifyUrl = `talk-home.html?tab=notify&userId=${cfg.userId}&talkDev=1`;
  await page.goto(devUrl(notifyUrl), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitNotifyTab(page);
  await filterNotifyJobChip(page);
  const card = await scrollNotifyCard(page, cfg.notifyId);
  if ((await card.count()) === 0) errors.push(`${cfg.key}: notify tab card missing`);
  const notifyTabFile = cfg.notifyTabFile;
  await page.screenshot({ path: path.join(OUT_DIR, notifyTabFile) });

  recordStep({
    filePrefix: cfg.filePrefix,
    screenName: cfg.screenName,
    fileName: relShot(JOB_FLOW.key, notifyTabFile),
    url: notifyUrl,
    fullUrl: devUrl(notifyUrl),
    purpose: cfg.purpose,
    operation: cfg.operation,
    checkPoints: cfg.checkPoints || [],
    concerns: cfg.concerns || "",
    improvements: cfg.improvements || "",
    talkScreenshot: relShot(JOB_FLOW.key, cfg.talkFile),
  });
  await openOfficialTasfulRoom(page);
  const talkTitle = page.locator(".chat-notify-card__title", { hasText: cfg.title });
  if ((await talkTitle.count()) > 0) {
    await talkTitle.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const bubble = talkTitle.first().locator("xpath=ancestor::div[contains(@class,'chat-bubble')]");
    if ((await bubble.count()) > 0) {
      await bubble.first().screenshot({ path: path.join(OUT_DIR, cfg.talkFile) });
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, cfg.talkFile) });
    }
  } else {
    errors.push(`${cfg.key}: TASFUL TALK card missing`);
    await page.screenshot({ path: path.join(OUT_DIR, cfg.talkFile) });
  }

  notifyChannels.push({
    key: cfg.key,
    label: cfg.label,
    notifyId: cfg.notifyId,
    notifyTab: { file: relShot(JOB_FLOW.key, notifyTabFile), url: notifyUrl },
    talk: { file: relShot(JOB_FLOW.key, cfg.talkFile), url: "talk-home.html?tab=chat&thread=official_tasful" },
  });
}

async function captureTalkJobBoth(page) {
  await openOfficialTasfulRoom(page);

  const titles = ["この求人に応募がありました", "採用されました"];
  for (const t of titles) {
    const el = page.locator(".chat-notify-card__title", { hasText: t }).first();
    if ((await el.count()) > 0) await el.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "notify-talk-job-both-390.png") });
}

async function runJobFlow(page) {
  const cfg = JOB_FLOW;

  await page.goto(devUrl("job-top.html"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await capture(page, "01-job-list.png", {
    filePrefix: "01",
    screenName: "求人一覧",
    purpose: "求人カテゴリの入口。一覧から対象求人へ進めるか確認。",
    operation: "求人一覧を開く",
    checkPoints: ["求人カードが一覧表示される", "TasuFull求人トップが表示される", "390pxでカードが読める"],
    concerns: "初回表示は検索フォーム中心で、求人カードはスクロール後。PR/注目求人の見え方は別途確認。",
    improvements: "一覧到達までのスクロール量が多い場合、ヒーロー求人1件をフォーム上に出す検討。",
  });

  const detailApplicant = `detail-job.html?id=${cfg.listingId}&userId=${cfg.applicantUserId}&talkDev=1`;
  await page.goto(devUrl(detailApplicant), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitListing(page);
  await capture(page, "02-job-detail.png", {
    filePrefix: "02",
    screenName: "求人詳細",
    purpose: "応募前の求人詳細。何の求人か・報酬・応募CTAが分かるか。",
    operation: "求人詳細を開く（応募者 u_hiro）",
    checkPoints: ["ヒーロー・報酬・応募ボタン", "職場イメージ等の詳細セクション", "タイトルが分かりやすい"],
    concerns: "出品者に @u_job_demo_full が見える（デモID）。",
    improvements: "デモ時以外は表示名のみにする。",
  });

  const applyBtn = page.locator("[data-listing-primary-cta], [data-job-dock-apply]").first();
  if ((await applyBtn.count()) > 0) {
    const label = (await applyBtn.textContent())?.trim() || "";
    if (label === "応募する") {
      await applyBtn.click();
      await page.waitForTimeout(800);
    }
  }
  await capture(page, "03-apply.png", {
    filePrefix: "03",
    screenName: "応募",
    purpose: "応募操作後の状態（応募済み表示または完了フィードバック）。",
    operation: "応募ボタン押下（または応募済み表示）",
    checkPoints: ["「応募済み」または応募完了表示", "CTA文言が自然", "開発文言・「—」がない"],
    concerns: "CTAが「応募済み」に変わるほか、緑の完了メッセージを表示。",
    improvements: "—",
  });

  await captureNotifyChannel(page, {
    key: "apply",
    filePrefix: "04",
    screenName: "応募通知",
    label: "① この求人に応募がありました",
    notifyId: cfg.applyNotifyId,
    title: "この求人に応募がありました",
    userId: cfg.posterUserId,
    notifyTabFile: "04-notify.png",
    talkFile: "04-notify-talk-390.png",
    purpose: "掲載者向け応募通知。通知タブとTASFUL TALKの両方で確認。",
    operation: "通知タブ（u_job_demo_full）→ 求人フィルター → 該当カード",
    checkPoints: [
      "タイトル「この求人に応募がありました」",
      "TALK側はタイトル＋「確認する」",
      "本文・余計なラベルなし",
    ],
    concerns: "通知タブも TALK 同様、タイトル＋「確認する」の最小カードに統一済み。",
    improvements: "—",
  });

  await openNotifyDestination(page, cfg.applyNotifyId);
  await page.waitForFunction(
    () =>
      document.querySelector("[data-job-applications-section]") &&
      !document.querySelector("[data-job-applications-section]").hidden,
    { timeout: 45000 }
  );
  await page.waitForTimeout(900);
  await capture(page, "05-applications.png", {
    filePrefix: "05",
    screenName: "応募者確認",
    purpose: "通知①の着地。掲載者が応募者を確認する画面。",
    operation: "「確認する」→ view=applications",
    checkPoints: [
      "応募者カード・検索/フィルター/並び替え",
      "応募先求人タイトルが見える",
      "職場イメージ・通常求人詳細は非表示",
      "「やりとりに進む」CTA",
    ],
    concerns: "CTAは「やりとりに進む」に統一。見出しはモバイルヘッダーのみ表示。",
    improvements: "—",
  });

  await page.evaluate(() => {
    localStorage.removeItem("tasful_chat_threads");
    localStorage.removeItem("tasful_chat_messages");
    localStorage.removeItem("tasful_platform_chat_fees_v1");
  });

  const proceed = page.locator("[data-job-app-proceed]").first();
  if ((await proceed.count()) < 1) errors.push("job: proceed button missing");
  else {
    await Promise.all([
      page.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 20000 }),
      page.evaluate(() => document.querySelector("[data-job-app-proceed]")?.click()),
    ]);
  }
  await page.waitForTimeout(700);
  await capture(page, "06-pay-550.png", {
    filePrefix: "06",
    screenName: "550円支払い",
    purpose: "やりとり開始前の利用料550円。求人専用の説明・CTA。",
    operation: "「やりとりに進む」→ 支払い画面",
    checkPoints: [
      "タイトル「やりとり開始利用料のお支払い」",
      "550円・求人向け説明",
      "CTA「550円を支払ってチャットを始める」",
      "Connect/5%/Stripe表記なし",
    ],
    concerns: "特になし（求人向け説明・CTAは整理済み）。",
    improvements: "支払い対象の応募者名があると、複数応募時の安心感が増す。",
  });

  const chatHref = await payPreChatFee(page);
  await page.goto(devUrl(chatHref.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await capture(page, "07-chat.png", {
    filePrefix: "07",
    screenName: "チャット",
    purpose: "支払い後の求人マッチングチャット。求人カードと初回メッセージ。",
    operation: "550円支払い完了 → チャット",
    checkPoints: [
      "求人応募カード（求人/タイトル/応募者/マッチング成立）",
      "deal-detail・開発文言なし",
      "アバター・初回メッセージが自然",
    ],
    concerns: "【ご注意】バナーが上部に常時表示され、カードとの距離は許容範囲。",
    improvements: "初回のみ注意表示にする等、慣れ後の縦スペース削減を検討。",
  });

  await captureNotifyChannel(page, {
    key: "hired",
    filePrefix: "08",
    screenName: "採用通知",
    label: "② 採用されました",
    notifyId: cfg.hiredNotifyId,
    title: "採用されました",
    userId: cfg.applicantUserId,
    notifyTabFile: "08-hired-notify.png",
    talkFile: "08-notify-talk-390.png",
    purpose: "応募者向け採用通知。通知タブとTASFUL TALKの両方で確認。",
    operation: "通知タブ（u_hiro）→ 求人フィルター → 該当カード",
    checkPoints: [
      "タイトル「採用されました」",
      "TALK側はタイトル＋「確認する」",
      "hire-result へ遷移する href",
    ],
    concerns: "求人フィルターは platform_fee 系を除外。レビュー対象は応募・採用の2件のみ。",
    improvements: "—",
  });

  await openNotifyDestination(page, cfg.hiredNotifyId);
  await page.waitForFunction(
    () =>
      document.querySelector("[data-job-applications-section]") &&
      !document.querySelector("[data-job-applications-section]").hidden,
    { timeout: 30000 }
  );
  await page.waitForTimeout(800);
  await capture(page, "09-hired-card.png", {
    filePrefix: "09",
    screenName: "採用結果",
    purpose: "通知②の着地。応募者向け採用結果カード。",
    operation: "「確認する」→ view=hire-result",
    checkPoints: [
      "採用結果カード1件",
      "求人タイトル・採用状況が分かる",
      "通常求人詳細は非表示",
      "次アクション（やりとり等）が明確",
    ],
    concerns: "採用結果画面のバッジは「やりとり開始待ち」または「採用されました」を表示。",
    improvements: "—",
  });

  await captureTalkJobBoth(page);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on("dialog", async (d) => d.accept());

  await runJobFlow(page);
  await browser.close();

  const index = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    viewport: VIEWPORT,
    category: JOB_FLOW,
    steps,
    notifyChannels,
    errors,
  };

  fs.writeFileSync("job-ui-review.json", JSON.stringify(index, null, 2));
  fs.writeFileSync("job-ui-review.md", buildMarkdown(index));

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE,
        steps: steps.length,
        notifyChannels: notifyChannels.length,
        errors,
        out: OUT_DIR,
      },
      null,
      2
    )
  );

  if (errors.length) {
    errors.forEach((e) => console.error(`WARN: ${e}`));
  }
  console.log("Generated job-ui-review.md and job-ui-review.json");
}

await run();
