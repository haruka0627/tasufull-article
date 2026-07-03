#!/usr/bin/env node

/**

 * Builder → Talk 一連フロー — 画面表示あり（headed）確認

 * 実運用に近い会話・入退場・完了写真・承認・情報開示料を検証

 *

 *   node scripts/check-builder-talk-flow-headed.mjs

 *   node scripts/check-builder-talk-flow-headed.mjs --visual-slow

 *   node scripts/check-builder-talk-flow-headed.mjs --visual-slow --viewport=1280
 *   node scripts/check-builder-talk-flow-headed.mjs --manual-review --viewport=1280
 *   node scripts/check-builder-talk-flow-headed.mjs --manual-review --flow=admin --viewport=1280
 *   node scripts/check-builder-talk-flow-headed.mjs --interactive-review --flow=admin --viewport=1280
 *   node scripts/check-builder-talk-flow-headed.mjs --manual-review-flow --flow=admin --viewport=1280
 */

import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";

import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

import { BUILDER_QA_VIEWPORTS } from "./lib/playwright-viewport.mjs";



const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPLETION_PHOTO = join(__dirname, "fixtures/completion-photo-1x1.png");



const BUILDER_DEMO_PROJECT_ID = "builder_demo_001";

const BUILDER_DEMO_PROJECT_LABEL = "店舗内装リニューアル（Builder）";

const MVP_KEY = "tasful:builder:mvp:v1";

const CHAT_THREADS_KEY = "tasful_chat_threads";

const CHAT_MESSAGES_KEY = "tasful_chat_messages";

const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";

const COMPLETION_KEY = "tasful:talk:builder-completion-reports:v1";

const CONTACT_REVEAL_KEY = "tasful:builder:contact-reveals:v1";

/** @type {ReturnType<typeof parseCliArgs>} */
const CLI = parseCliArgs(process.argv.slice(2));

const MANUAL_REVIEW_DIR = join(
  process.cwd(),
  "reports/manual-review",
  CLI.flowFilter === "general"
    ? "builder-general"
    : CLI.flowFilter === "worker"
      ? "builder-worker-search"
      : CLI.flowFilter === "vendor"
        ? "builder-vendor-search"
        : "builder-talk"
);

const GENERAL_THREAD_ID = "verify-general-project";
const COMPLETION_PHOTO_B = join(__dirname, "fixtures/completion-photo-b-1x1.png");
const COMPLETION_DROP_SELECTOR = "[data-talk-builder-completion-photo-drop]";

/** @type {number} */
let manualStepCounter = 0;

/**
 * Owner may show「承認する」in workflow header and completion card — target first match.
 * @param {import('playwright').Page} page
 */
function ownerApproveButtonLocator(page) {
  return page.locator('[data-talk-builder-next][data-next-status="completed"]').first();
}

/**
 * @param {import('playwright').Page} page
 */
function completionReportCardLocator(page) {
  return page.locator("[data-talk-builder-completion-report]");
}



/** @type {Readonly<{ slowMo: number, pause: number, pauseNav: number, pauseState: number, pauseModal: number, pauseComplete: number, pauseCheckpoint: number, pauseChat: number }>} */

const TIMING = CLI.visualSlow

  ? Object.freeze({

      slowMo: 2200,

      pause: 3200,

      pauseNav: 5000,

      pauseState: 4500,

      pauseModal: 5000,

      pauseComplete: 5500,

      pauseCheckpoint: 4500,

      pauseChat: 4000,

    })

  : Object.freeze({

      slowMo: 450,

      pause: 600,

      pauseNav: 900,

      pauseState: 900,

      pauseModal: 1000,

      pauseComplete: 900,

      pauseCheckpoint: 600,

      pauseChat: 700,

    });



function parseCliArgs(argv) {
  const visualSlow = argv.includes("--visual-slow");
  const manualReview = argv.includes("--manual-review");
  const interactiveReview = argv.includes("--interactive-review");
  const manualReviewFlow = argv.includes("--manual-review-flow");
  const help = argv.includes("--help") || argv.includes("-h");
  let viewportFilter = "";
  let flowFilter = "";
  for (const arg of argv) {
    if (arg.startsWith("--viewport=")) {
      viewportFilter = arg.slice("--viewport=".length).trim();
    }
    if (arg.startsWith("--flow=")) {
      flowFilter = arg.slice("--flow=".length).trim().toLowerCase();
    }
  }
  return { visualSlow, manualReview, interactiveReview, manualReviewFlow, help, viewportFilter, flowFilter };
}



function printHelp() {
  console.log(`Usage:
  node scripts/check-builder-talk-flow-headed.mjs [options]

Options:
  --visual-slow      目視確認用（slowMo ${TIMING.slowMo}ms · 各ステップ pause 長め）
  --manual-review        手動確認（スクショ中心 · Enterで次へ）
  --interactive-review   操作確認（自動操作あり · Enterで次へ · 運営承認は別タブで確認）
  --manual-review-flow   手動操作フロー（自動クリック最小 · Enter後に状態 probe · 先に進めても PASS）
  --viewport=N           指定 viewport のみ（1280 | 768 | 390）
  --flow=NAME            フロー限定（admin | general | worker | vendor | normal）
  --help, -h             このヘルプ

Examples:
  node scripts/check-builder-talk-flow-headed.mjs
  node scripts/check-builder-talk-flow-headed.mjs --visual-slow --viewport=1280
  node scripts/check-builder-talk-flow-headed.mjs --manual-review --viewport=1280
  node scripts/check-builder-talk-flow-headed.mjs --manual-review --flow=admin --viewport=1280
  node scripts/check-builder-talk-flow-headed.mjs --interactive-review --flow=admin --viewport=1280
  node scripts/check-builder-talk-flow-headed.mjs --manual-review-flow --flow=admin --viewport=1280
  node scripts/check-builder-talk-flow-headed.mjs --manual-review --flow=general --viewport=1280
`);
}

if (CLI.manualReviewFlow && CLI.interactiveReview) {
  console.error("--manual-review-flow と --interactive-review は同時に指定できません");
  process.exit(1);
}

const INTERACTIVE_STOP_SLUGS = new Set([
  "calendar",
  "before-accept",
  "talk-open",
  "before-enter",
  "after-enter",
  "before-exit",
  "after-exit",
  "before-re-enter",
  "after-re-enter",
  "after-re-exit",
  "before-completion-modal",
  "completion-photo-attached",
  "partner-completion-reported",
  "owner-talk-open",
  "owner-before-approve",
  "owner-after-approve",
  "partner-completed",
  "owner-completed",
  "completion-reported",
  "before-ops-approve",
  "completed",
  "normal-chat",
]);

/** @type {import('node:readline').Interface | null} */
let reviewReadline = null;

function reviewModeActive() {
  return CLI.manualReview || CLI.interactiveReview || CLI.manualReviewFlow;
}

/** @type {{ steps: object[], capturedAt?: string, viewport?: string }[]} */
const manualFlowReports = [];

/** @type {Record<string, number>} */
const MANUAL_FLOW_PHASE_RANK = {
  unknown: 0,
  calendar: 1,
  accept_ready: 2,
  accepted: 3,
  talk: 4,
  workflow_ready: 5,
  entered: 6,
  exited: 7,
  completion_ready: 8,
  completion_modal: 9,
  completion_reported: 10,
  ops_awaiting: 11,
  owner_approve: 12,
  completed: 13,
};

const MANUAL_REVIEW_FLOW_ADMIN_STEPS = [
  {
    slug: "calendar",
    minPhase: "calendar",
    screen: "Builder カレンダー（パートナー）",
    checks: [
      "デモ案件「店舗内装リニューアル（Builder）」が表示されている",
      "日付・案件バッジが読みやすい",
      "必要なら案件を開いて「受ける」まで進めてよい",
    ],
  },
  {
    slug: "before-accept",
    minPhase: "accept_ready",
    screen: "案件詳細 · 「受ける」",
    checks: ["案件詳細が表示されている", "「受ける」ボタンが見える", "受諾後は Talk へ進める"],
  },
  {
    slug: "talk-open",
    minPhase: "talk",
    screen: "Talk 遷移直後（パートナー）",
    checks: [
      "Talk 画面に遷移している",
      "ワークフローパネルが表示されている",
      "「運営案件」ヘッダーが見える",
    ],
  },
  {
    slug: "before-enter",
    minPhase: "workflow_ready",
    screen: "入場前",
    checks: ["「入場」ボタンが表示されている", "入退場が必須フローであることが分かる"],
  },
  {
    slug: "after-enter",
    minPhase: "entered",
    screen: "入場後",
    checks: ["ステータスが「入場済み」", "次は「退場」アクション"],
  },
  {
    slug: "before-exit",
    minPhase: "entered",
    screen: "退場前",
    checks: ["「入場済み」状態", "「退場」ボタンが表示されている"],
  },
  {
    slug: "after-exit",
    minPhase: "exited",
    screen: "退場後",
    checks: ["ステータスが「退場済み」", "「入場」「完了報告」ボタンが表示されている"],
  },
  {
    slug: "before-re-enter",
    minPhase: "exited",
    screen: "再入場前",
    checks: ["「退場済み」状態", "「入場」ボタンが表示されている"],
  },
  {
    slug: "after-re-enter",
    minPhase: "entered",
    screen: "再入場後",
    checks: ["ステータスが「入場済み」", "再度「退場」が可能"],
  },
  {
    slug: "after-re-exit",
    minPhase: "exited",
    screen: "再退場後",
    checks: ["ステータスが「退場済み」", "「完了報告」ボタンが表示されている"],
  },
  {
    slug: "before-completion-modal",
    minPhase: "completion_ready",
    screen: "完了報告モーダル前",
    checks: [
      "「完了報告」ボタンが表示されている",
      "入退場履歴が記録されている",
      "モーダルを開いて報告できる状態",
    ],
  },
  {
    slug: "completion-photo-attached",
    minPhase: "completion_modal",
    screen: "完了写真添付後",
    checks: [
      "作業内容が入力されている",
      "完了写真が添付されている",
      "送信ボタンが押せる状態",
    ],
  },
  {
    slug: "partner-completion-reported",
    minPhase: "ops_awaiting",
    screen: "完了報告送信後（パートナー）",
    checks: [
      "モーダルが閉じている",
      "ステータスが「運営確認待ち」または「運営承認待ち」",
      "パートナー側に承認ボタンがない",
    ],
  },
  {
    slug: "owner-talk-open",
    minPhase: "ops_awaiting",
    screen: "運営側 Talk オープン",
    roleLabel: "運営",
    autoOpenOwnerTab: true,
    checks: [
      "運営（owner）視点の Talk が別タブで自動表示されている",
      "ワークフローパネルが表示されている",
      "ステータスが「運営確認待ち」または「運営承認待ち」",
      "完了報告カードが表示されている",
    ],
  },
  {
    slug: "owner-before-approve",
    minPhase: "owner_approve",
    screen: "運営承認前（運営視点）",
    roleLabel: "運営",
    checks: [
      "「運営承認待ち」状態",
      "完了報告カードに作業内容・完了写真が表示されている",
      "「承認する」ボタンが表示されている（上部またはカード内）",
      "パートナー側はまだ「完了」になっていない",
    ],
  },
  {
    slug: "owner-after-approve",
    minPhase: "completed",
    screen: "運営承認後（運営視点）",
    roleLabel: "運営",
    checks: ["ステータスが「完了」", "運営側で承認完了が確認できる"],
  },
  {
    slug: "partner-completed",
    minPhase: "completed",
    screen: "completed 表示（パートナー）",
    roleLabel: "パートナー",
    checks: ["パートナー側でもステータスが「完了」", "運営承認後に同期されている"],
  },
  {
    slug: "owner-completed",
    minPhase: "completed",
    screen: "completed 表示（運営）",
    roleLabel: "運営",
    checks: [
      "運営側でもステータスが「完了」",
      "入場・退場・承認の system メッセージが混在",
    ],
  },
];

const MANUAL_FLOW_PHASE_RANK_GENERAL = {
  unknown: 0,
  board: 1,
  reveal_ready: 2,
  talk: 3,
  workflow_ready: 4,
  started: 5,
  working: 6,
  completion_ready: 7,
  completion_modal: 8,
  client_awaiting: 9,
  user_approve: 10,
  completed: 11,
  fee_confirmed: 12,
};

const MANUAL_FLOW_PHASE_RANK_WORKER = {
  unknown: 0,
  find_workers: 1,
  worker_profile: 2,
  reveal_ready: 3,
  talk: 4,
  chat_sent: 5,
  partner_sync: 6,
  no_project_actions: 7,
};

const MANUAL_REVIEW_FLOW_WORKER_STEPS = [
  {
    slug: "find-workers-results",
    minPhase: "find_workers",
    screen: "ワーカー検索結果",
    checks: [
      "find-workers ページが表示されている",
      "検索結果カードが1件以上ある",
      "「詳細を見る」「相談する」導線がある",
    ],
  },
  {
    slug: "worker-profile",
    minPhase: "worker_profile",
    screen: "ワーカープロフィール",
    checks: [
      "プロフィール詳細が表示されている",
      "「相談する / 依頼する」ボタンがある",
    ],
  },
  {
    slug: "talk-before-reveal",
    minPhase: "reveal_ready",
    screen: "550円 連絡先開示前",
    roleLabel: "依頼者",
    checks: [
      "Talk に遷移している（thread / roomId 生成）",
      "550円 連絡先開示ゲートが表示されている",
      "composer がロックされている",
      "入場・退場・完了報告・承認ボタンがない",
    ],
  },
  {
    slug: "talk-after-reveal",
    minPhase: "talk",
    screen: "550円 開示後 · Talk 有効",
    roleLabel: "依頼者",
    checks: [
      "連絡先開示が完了している",
      "composer が有効化されている",
      "「ワーカー相談」ヘッダーが表示されている",
    ],
  },
  {
    slug: "normal-chat",
    minPhase: "chat_sent",
    screen: "通常チャット送信",
    roleLabel: "依頼者",
    checks: [
      "通常チャットメッセージが送信できる",
      "送信したメッセージが表示される",
    ],
  },
  {
    slug: "thread-sync",
    minPhase: "partner_sync",
    screen: "thread / roomId · partnerUserId 同期",
    checks: [
      "localStorage に worker_contact スレッドが保存されている",
      "threadId と roomId が一致している",
      "partnerUserId（ワーカー ID）が設定されている",
      "workflow state / completion report がない",
    ],
  },
  {
    slug: "no-project-workflow",
    minPhase: "no_project_actions",
    screen: "案件フロー非表示 · 手数料なし",
    checks: [
      "入場ボタンがない",
      "退場ボタンがない",
      "完了報告ボタンがない",
      "承認ボタンがない",
      "5〜10% 手数料表示がない",
      "workerSearch.contactRevealFeeYen = 550",
    ],
  },
];

const MANUAL_FLOW_PHASE_RANK_VENDOR = { ...MANUAL_FLOW_PHASE_RANK_WORKER };

const MANUAL_REVIEW_FLOW_VENDOR_STEPS = [
  {
    slug: "find-partners-results",
    minPhase: "find_workers",
    screen: "業者検索結果",
    checks: [
      "partners.html（協力会社検索）が表示されている",
      "検索結果が1件以上ある",
      "「詳細」「Talkで相談」導線がある",
    ],
  },
  {
    slug: "vendor-profile",
    minPhase: "worker_profile",
    screen: "業者プロフィール",
    checks: [
      "業者詳細ページが表示されている",
      "「Talkで相談する / 見積相談」ボタンがある",
    ],
  },
  {
    slug: "talk-before-reveal",
    minPhase: "reveal_ready",
    screen: "550円 連絡先開示前",
    roleLabel: "依頼者",
    checks: [
      "Talk に遷移している（thread / roomId 生成）",
      "550円 連絡先開示ゲートが表示されている",
      "composer がロックされている",
      "入場・退場・完了報告・承認ボタンがない",
    ],
  },
  {
    slug: "talk-after-reveal",
    minPhase: "talk",
    screen: "550円 開示後 · Talk 有効",
    roleLabel: "依頼者",
    checks: [
      "連絡先開示が完了している",
      "composer が有効化されている",
      "「業者相談」ヘッダーが表示されている",
      "ステータスバッジが「相談中」",
    ],
  },
  {
    slug: "normal-chat",
    minPhase: "chat_sent",
    screen: "通常チャット送信",
    roleLabel: "依頼者",
    checks: [
      "通常チャットメッセージが送信できる",
      "送信したメッセージが表示される",
    ],
  },
  {
    slug: "thread-sync",
    minPhase: "partner_sync",
    screen: "thread / roomId · vendorId 同期",
    checks: [
      "localStorage に vendor_contact スレッドが保存されている",
      "threadId と roomId が一致している",
      "partnerUserId / vendorId が設定されている",
      "workflow state / completion report がない",
    ],
  },
  {
    slug: "no-project-workflow",
    minPhase: "no_project_actions",
    screen: "案件フロー非表示 · 手数料なし",
    checks: [
      "入場ボタンがない",
      "退場ボタンがない",
      "完了報告ボタンがない",
      "承認ボタンがない",
      "5〜10% 手数料表示がない",
      "vendorSearch.contactRevealFeeYen = 550",
    ],
  },
];

const MANUAL_REVIEW_FLOW_GENERAL_STEPS = [
  {
    slug: "board-projects",
    minPhase: "board",
    screen: "案件一覧（掲示板）",
    checks: [
      "Builder 掲示板 / 案件一覧が表示されている",
      "一般案件の投稿・応募導線が確認できる",
    ],
  },
  {
    slug: "user-before-reveal",
    minPhase: "reveal_ready",
    screen: "550円 連絡先開示前（依頼者）",
    checks: [
      "550円 連絡先開示ゲートが表示されている",
      "「チャット料金ではありません」の注記がある",
      "composer がロックされている",
    ],
  },
  {
    slug: "user-after-reveal",
    minPhase: "talk",
    screen: "550円 開示後 · Talk 開始",
    checks: [
      "連絡先開示が完了している",
      "composer が有効化されている",
      "通常チャットが送信できる",
    ],
  },
  {
    slug: "partner-talk",
    minPhase: "workflow_ready",
    screen: "Talk（作業者）",
    roleLabel: "作業者",
    checks: [
      "作業者視点の Talk が開いている",
      "ワークフローパネルが表示されている",
      "「案件スレッド」ヘッダーが見える",
    ],
  },
  {
    slug: "partner-started",
    minPhase: "started",
    screen: "作業開始",
    roleLabel: "作業者",
    checks: ["ステータスが「作業開始」または「施工中」", "次のアクションが表示されている"],
  },
  {
    slug: "partner-working",
    minPhase: "working",
    screen: "施工中",
    roleLabel: "作業者",
    checks: ["ステータスが「施工中」", "「完了報告」ボタンが表示されている"],
  },
  {
    slug: "before-completion-modal",
    minPhase: "completion_ready",
    screen: "完了報告モーダル前",
    roleLabel: "作業者",
    checks: ["「完了報告」ボタンが表示されている", "モーダルを開ける状態"],
  },
  {
    slug: "completion-photo-attached",
    minPhase: "completion_modal",
    screen: "完了写真添付（複数・D&D）",
    roleLabel: "作業者",
    checks: [
      "作業内容が入力されている",
      "完了写真が2枚以上添付されている",
      "ドラッグ&ドロップゾーンがある",
    ],
  },
  {
    slug: "partner-completion-reported",
    minPhase: "client_awaiting",
    screen: "完了報告送信後（作業者）",
    roleLabel: "作業者",
    checks: [
      "ステータスが「依頼者確認待ち」",
      "作業者側に承認ボタンがない",
    ],
  },
  {
    slug: "user-talk-open",
    minPhase: "client_awaiting",
    screen: "依頼者 Talk オープン",
    roleLabel: "依頼者",
    autoOpenUserTab: true,
    checks: [
      "依頼者視点の Talk が別タブで表示されている",
      "完了報告カードが表示されている",
    ],
  },
  {
    slug: "user-before-approve",
    minPhase: "user_approve",
    screen: "依頼者承認前",
    roleLabel: "依頼者",
    checks: [
      "完了報告カードに作業内容・完了写真サムネイルがある",
      "写真サムネイルをタップするとライトボックスが開く",
      "「承認する」ボタンが表示されている",
    ],
  },
  {
    slug: "user-after-approve",
    minPhase: "completed",
    screen: "依頼者承認後",
    roleLabel: "依頼者",
    checks: ["ステータスが「完了」", "依頼者側で承認完了が確認できる"],
  },
  {
    slug: "partner-completed",
    minPhase: "completed",
    screen: "completed（作業者）",
    roleLabel: "作業者",
    checks: ["作業者側でもステータスが「完了」", "依頼者承認後に同期されている"],
  },
  {
    slug: "fee-policy",
    minPhase: "completed",
    screen: "手数料ポリシー確認（5〜10%）",
    checks: [
      "一般案件の案件手数料 5〜10% が TasuBuilderBillingPolicy に定義されている",
      "完了報告データが localStorage に保存されている",
    ],
  },
];

/**
 * @param {import('playwright').Page} page
 */
async function probeWorkflowButtons(page) {
  const buttons = page.locator("[data-talk-builder-next]");
  const count = await buttons.count();
  /** @type {{ label: string, nextStatus: string, visible: boolean }[]} */
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    items.push({
      label: ((await btn.textContent()) || "").trim(),
      nextStatus: (await btn.getAttribute("data-next-status")) || "",
      visible: await btn.isVisible().catch(() => false),
    });
  }
  return items.filter((b) => b.visible);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [threadId]
 */
async function probeTalkPageState(page, threadId = "") {
  const url = page.url();
  const onTalk = /chat-detail/i.test(url);
  const snap = onTalk ? await readThreadWorkflowSnapshot(page, threadId) : null;
  const badge = snap?.badge || (onTalk ? await readWorkflowBadge(page) : "");
  const status = snap?.status || "";
  const workflowVisible = onTalk
    ? await page.locator("#talkBuilderWorkflowPanel").isVisible().catch(() => false)
    : false;
  const completionModalVisible = onTalk
    ? await page.locator("#talkBuilderCompletionModal").isVisible().catch(() => false)
    : false;
  const buttons = workflowVisible ? await probeWorkflowButtons(page) : [];
  const hasCompletionButton = buttons.some((b) => b.nextStatus === "completion_reported");
  const approveVisible = buttons.some((b) => b.nextStatus === "completed" && /承認/.test(b.label));
  let builderRole = "";
  try {
    builderRole = new URL(url).searchParams.get("builderRole") || "";
  } catch {
    /* ignore */
  }
  return {
    url,
    onTalk,
    builderRole,
    threadId: snap?.threadId || threadId,
    badge,
    status,
    workflowVisible,
    completionModalVisible,
    buttons,
    hasCompletionButton,
    approveVisible,
    completed: status === "completed" || /完了/.test(badge),
    isAwaitingOps:
      status === "completion_reported" ||
      status === "ops_confirming" ||
      OPS_AWAITING_BADGE.test(badge),
    isAwaitingClient:
      status === "completion_reported" ||
      status === "client_confirming" ||
      CLIENT_AWAITING_BADGE.test(badge),
  };
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {{ threadId?: string, meta?: { threadId?: string | null } }} ctx
 */
async function resolveManualFlowThreadId(partnerPage, ctx) {
  const fromCtx = String(ctx?.threadId || "").trim();
  if (fromCtx) return fromCtx;

  const meta =
    ctx?.meta ||
    (await readOpsMeta(partnerPage).catch(() => ({
      assignment_status: "",
      threadId: null,
      inTalk: false,
    })));
  const fromMeta = String(meta?.threadId || "").trim();
  if (fromMeta) return fromMeta;

  const snap = await readThreadWorkflowSnapshot(partnerPage, "");
  const fromUrl = String(snap?.threadId || "").trim();
  if (fromUrl) return fromUrl;

  return "builder_thread_demo_001";
}

/**
 * manual-review-flow: STEP14 などで owner タブを自動オープン
 * @param {import('playwright').Page} partnerPage
 * @param {{ threadId?: string, meta?: object, ownerPage?: import('playwright').Page | null }} ctx
 */
async function ensureManualFlowOwnerTab(partnerPage, ctx) {
  const threadId = await resolveManualFlowThreadId(partnerPage, ctx);
  ctx.threadId = threadId;
  const ownerPage = await openOwnerReviewPage(partnerPage, threadId);
  if (ownerPage) {
    ctx.ownerPage = ownerPage;
    await ownerPage.bringToFront();
  }
  return ownerPage;
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {{ threadId?: string, meta?: { assignment_status?: string, threadId?: string | null }, ownerPage?: import('playwright').Page | null }} ctx
 */
async function buildManualFlowProbe(partnerPage, ctx) {
  if (ctx.flowKind === "general") {
    return buildGeneralManualFlowProbe(partnerPage, ctx);
  }
  if (ctx.flowKind === "worker") {
    return buildWorkerManualFlowProbe(partnerPage, ctx);
  }
  if (ctx.flowKind === "vendor") {
    return buildVendorManualFlowProbe(partnerPage, ctx);
  }
  const calendar = await probeAdminProjectScreen(partnerPage);
  const meta =
    ctx.meta ||
    (await readOpsMeta(partnerPage).catch(() => ({
      assignment_status: "",
      threadId: null,
      inTalk: false,
    })));
  const threadId = String(ctx.threadId || meta.threadId || "");
  const partner = await probeTalkPageState(partnerPage, threadId);

  /** @type {Awaited<ReturnType<typeof probeTalkPageState>> | null} */
  let owner = null;
  const context = partnerPage.context();
  const ownerPage =
    ctx.ownerPage ||
    context.pages().find(
      (p) => p !== partnerPage && /builderRole=owner/i.test(p.url()) && (!threadId || p.url().includes(threadId))
    );
  if (ownerPage) {
    owner = await probeTalkPageState(ownerPage, threadId);
  }

  const phase = detectManualFlowPhase({ calendar, meta, partner, owner });
  return {
    capturedAt: new Date().toISOString(),
    phase,
    calendar,
    meta,
    partner,
    owner,
    threadId: partner.threadId || threadId || null,
  };
}

/**
 * @param {{ calendar: Awaited<ReturnType<typeof probeAdminProjectScreen>>, meta: { assignment_status?: string, threadId?: string | null }, partner: Awaited<ReturnType<typeof probeTalkPageState>>, owner: Awaited<ReturnType<typeof probeTalkPageState>> | null }} input
 */
function detectManualFlowPhase(input) {
  const { calendar, meta, partner, owner } = input;
  if (owner?.completed || partner.completed) return "completed";
  if (owner?.approveVisible) return "owner_approve";
  if (partner.isAwaitingOps) return "ops_awaiting";
  if (partner.completionModalVisible) return "completion_modal";
  if (partner.status === "exited" || /退場済み/.test(partner.badge || "")) {
    if (partner.hasCompletionButton) return "completion_ready";
    return "exited";
  }
  if (partner.status === "entered" || /入場済み/.test(partner.badge || "")) return "entered";
  if (partner.onTalk && partner.workflowVisible) return "workflow_ready";
  if (meta.assignment_status === "accepted" && meta.threadId) return "accepted";
  if (calendar.acceptVisible || calendar.partnerCalAccept) return "accept_ready";
  if (calendar.adminCalBadgeCount > 0 || calendar.projectTitleVisible || calendar.onChatDetail) {
    if (calendar.onChatDetail) return "talk";
    return "calendar";
  }
  if (calendar.onChatDetail) return "talk";
  return "unknown";
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {{ threadId?: string, userPage?: import('playwright').Page | null, flowKind?: string }} ctx
 */
async function buildGeneralManualFlowProbe(partnerPage, ctx) {
  const threadId = String(ctx.threadId || GENERAL_THREAD_ID);
  const partner = await probeTalkPageState(partnerPage, threadId);
  const boardUrl = partnerPage.url();
  const onBoard = /board-projects/i.test(boardUrl);

  /** @type {Awaited<ReturnType<typeof probeTalkPageState>> | null} */
  let user = null;
  const context = partnerPage.context();
  const userPage =
    ctx.userPage ||
    context.pages().find(
      (p) => p !== partnerPage && /builderRole=user/i.test(p.url()) && p.url().includes(threadId)
    );
  if (userPage) {
    user = await probeTalkPageState(userPage, threadId);
  }

  const billing = await partnerPage
    .evaluate(
      ({ tid, workflowKey, completionKey }) => {
        const gp = window.TasuBuilderBillingPolicy?.POLICY?.generalProject;
        const wf = JSON.parse(localStorage.getItem(workflowKey) || "{}")[tid];
        const report = JSON.parse(localStorage.getItem(completionKey) || "{}")[tid];
        return {
          contactRevealFeeYen: gp?.contactRevealFeeYen ?? null,
          commissionPctRange: gp?.commissionPctRange ?? null,
          completionCommission: gp?.completionCommission ?? null,
          workflowStatus: wf?.status || "",
          reportWorkContent: report?.workContent || "",
          reportPhotoCount: report?.photoCount ?? 0,
        };
      },
      { tid: threadId, workflowKey: WORKFLOW_KEY, completionKey: COMPLETION_KEY }
    )
    .catch(() => ({}));

  const phase = detectGeneralManualFlowPhase({ partner, user, onBoard, billing });
  return {
    capturedAt: new Date().toISOString(),
    phase,
    board: { url: boardUrl, onBoard },
    billing,
    partner,
    user,
    threadId: partner.threadId || threadId,
  };
}

/**
 * @param {{ partner: Awaited<ReturnType<typeof probeTalkPageState>>, user: Awaited<ReturnType<typeof probeTalkPageState>> | null, onBoard: boolean, billing: object }} input
 */
function detectGeneralManualFlowPhase(input) {
  const { partner, user, onBoard, billing } = input;
  if (user?.completed || partner.completed) {
    if (
      Array.isArray(billing?.commissionPctRange) &&
      billing.commissionPctRange[0] === 5 &&
      billing.commissionPctRange[1] === 10 &&
      billing.reportWorkContent
    ) {
      return "fee_confirmed";
    }
    return "completed";
  }
  if (user?.approveVisible) return "user_approve";
  if (partner.isAwaitingClient || user?.isAwaitingClient) return "client_awaiting";
  if (partner.completionModalVisible) return "completion_modal";
  if (partner.hasCompletionButton && /施工中/.test(partner.badge || "")) return "completion_ready";
  if (partner.status === "working" || /施工中/.test(partner.badge || "")) return "working";
  if (partner.status === "started" || /作業開始/.test(partner.badge || "")) return "started";
  if (partner.onTalk && partner.workflowVisible) return "workflow_ready";
  if (user?.onTalk && user.workflowVisible) return "talk";
  if (onBoard) return "board";
  if (/chat-detail/i.test(partner.url || "") && partner.builderRole === "user") return "reveal_ready";
  return "unknown";
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {string} threadId
 */
function buildUserTalkUrlFromPartner(partnerPage, threadId) {
  const partnerUrl = partnerPage.url();
  try {
    const url = new URL(partnerUrl);
    if (/chat-detail/i.test(url.pathname)) {
      url.searchParams.set("builderRole", "user");
      url.searchParams.set("builderFlow", "partner_user");
      if (!url.searchParams.get("thread") && threadId) url.searchParams.set("thread", threadId);
      if (!url.searchParams.get("from")) url.searchParams.set("from", "builder");
      return url.toString();
    }
  } catch {
    /* fall through */
  }
  return talkUrl(threadId, { builderFlow: "partner_user", builderRole: "user" });
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {string} threadId
 * @returns {Promise<import('playwright').Page | null>}
 */
async function openUserReviewPage(partnerPage, threadId) {
  const partnerSnap = await readThreadWorkflowSnapshot(partnerPage, threadId);
  const resolvedThreadId = partnerSnap.threadId || threadId;
  const userTargetUrl = buildUserTalkUrlFromPartner(partnerPage, resolvedThreadId);
  const logTag = CLI.manualReviewFlow ? "[manual-review-flow]" : "[interactive]";
  console.log(`\n${logTag} user タブを開きます`);
  console.log(`  partner current URL: ${partnerSnap.url}`);
  console.log(`  user target URL: ${userTargetUrl}`);

  const context = partnerPage.context();
  const needle = String(resolvedThreadId);
  let userPage = context.pages().find(
    (p) => /builderRole=user/i.test(p.url()) && p.url().includes(needle)
  );

  try {
    if (!userPage) {
      userPage = await context.newPage();
      await userPage.goto(userTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    } else {
      await userPage.goto(userTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    }
    await userPage.bringToFront();
    await waitForTalkDetailReady(userPage, 20000);
    await userPage.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });
  } catch (err) {
    console.error(`  ✗ user tab open failed: ${String(err?.message || err)}`);
    return null;
  }
  return userPage;
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {{ threadId?: string, userPage?: import('playwright').Page | null }} ctx
 */
async function ensureManualFlowUserTab(partnerPage, ctx) {
  const threadId = String(ctx.threadId || GENERAL_THREAD_ID);
  ctx.threadId = threadId;
  const userPage = await openUserReviewPage(partnerPage, threadId);
  if (userPage) {
    ctx.userPage = userPage;
    await userPage.bringToFront();
  }
  return userPage;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ name: string, mime: string, path: string }[]} files
 */
async function dropFilesOnCompletionZone(page, files) {
  const payloads = files.map((f) => ({
    name: f.name,
    mime: f.mime,
    data: Array.from(readFileSync(f.path)),
  }));
  await page.evaluate(
    ({ selector, filePayloads }) => {
      const zone = document.querySelector(selector);
      if (!zone) throw new Error("drop zone missing");
      const dt = new DataTransfer();
      filePayloads.forEach(({ name, mime, data }) => {
        dt.items.add(new File([new Uint8Array(data)], name, { type: mime }));
      });
      zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { selector: COMPLETION_DROP_SELECTOR, filePayloads: payloads }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [threadId]
 */
async function readWorkerContactDiagnostics(page, threadId = "") {
  return page.evaluate(
    ({ threadsKey, revealKey, workflowKey, completionKey, tid }) => {
      const ws = window.TasuBuilderBillingPolicy?.POLICY?.workerSearch;
      const gp = window.TasuBuilderBillingPolicy?.POLICY?.generalProject;
      const threads = JSON.parse(localStorage.getItem(threadsKey) || "[]");
      const list = Array.isArray(threads) ? threads : [];
      const row = tid
        ? list.find((t) => String(t.id) === tid)
        : list.find((t) => String(t.threadKind || "") === "worker_contact");
      const id = tid || row?.id || "";
      const wf = JSON.parse(localStorage.getItem(workflowKey) || "{}");
      const reports = JSON.parse(localStorage.getItem(completionKey) || "{}");
      return {
        workerSearch: {
          contactRevealFeeYen: ws?.contactRevealFeeYen ?? null,
          completionCommission: ws?.completionCommission ?? null,
        },
        generalProjectCommissionRange: gp?.commissionPctRange ?? null,
        threadId: id || null,
        roomId: row?.roomId || id || null,
        threadKind: row?.threadKind || null,
        partnerUserId: row?.partnerUserId || null,
        buyerId: row?.buyerId || null,
        hasWorkflowState: id ? Boolean(wf[id]) : false,
        hasCompletionReport: id ? Boolean(reports[id]) : false,
      };
    },
    {
      threadsKey: CHAT_THREADS_KEY,
      revealKey: CONTACT_REVEAL_KEY,
      workflowKey: WORKFLOW_KEY,
      completionKey: COMPLETION_KEY,
      tid: threadId,
    }
  );
}

/**
 * @param {import('playwright').Page} page
 */
async function probeWorkerForbiddenActions(page) {
  const panelText = (await page.locator("#talkBuilderWorkflowPanel").textContent().catch(() => "")) || "";
  const buttons = await probeWorkflowButtons(page);
  const forbidden = ["entered", "exited", "completion_reported", "completed", "started", "working"];
  const forbiddenButtons = buttons.filter((b) => forbidden.includes(b.nextStatus));
  return {
    visibleWorkflowButtons: buttons.length,
    forbiddenButtons,
    hasCommissionPctText: /5\s*[〜~\-]\s*10\s*%/.test(panelText) || /案件手数料/.test(panelText),
    panelTextSample: panelText.slice(0, 160),
  };
}

/**
 * @param {import('playwright').Page} page
 */
async function probeFindWorkersScreen(page) {
  const url = page.url();
  const onFindWorkers = /find-workers/i.test(url);
  const resultsVisible = onFindWorkers
    ? await page.locator("[data-builder-fw-results]:not([hidden])").isVisible().catch(() => false)
    : false;
  const profileVisible = onFindWorkers
    ? await page.locator("[data-builder-fw-profile]:not([hidden])").isVisible().catch(() => false)
    : false;
  const cardCount = onFindWorkers ? await page.locator("[data-builder-fw-card]").count() : 0;
  return { url, onFindWorkers, resultsVisible, profileVisible, cardCount };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string, workerPartnerPage?: import('playwright').Page | null }} ctx
 */
async function buildWorkerManualFlowProbe(page, ctx) {
  const threadId = String(ctx.threadId || "");
  const findWorkers = await probeFindWorkersScreen(page);
  const user = /chat-detail/i.test(page.url()) ? await probeTalkPageState(page, threadId) : null;
  const diagnostics = await readWorkerContactDiagnostics(page, threadId).catch(() => ({}));

  /** @type {Awaited<ReturnType<typeof probeTalkPageState>> | null} */
  let partner = null;
  const context = page.context();
  const partnerPage =
    ctx.workerPartnerPage ||
    context.pages().find(
      (p) => p !== page && /builderRole=partner/i.test(p.url()) && /chat-detail/i.test(p.url())
    );
  if (partnerPage) {
    partner = await probeTalkPageState(partnerPage, threadId);
  }

  const forbidden = user ? await probeWorkerForbiddenActions(page) : { visibleWorkflowButtons: 0, forbiddenButtons: [], hasCommissionPctText: false, panelTextSample: "" };
  let chatSent = false;
  let composerDisabled = null;
  let workflowKind = "";
  if (user?.onTalk) {
    composerDisabled = await page.locator("#chatInput").isDisabled().catch(() => null);
    workflowKind = ((await page.locator("#talkBuilderWorkflowKind").textContent().catch(() => "")) || "").trim();
    const msgs = (await page.locator("#chatMessages").textContent().catch(() => "")) || "";
    chatSent = /ワーカー検索/.test(msgs) || /manual review/i.test(msgs) || /相談します/.test(msgs);
  }

  let partnerKind = "";
  if (partner) {
    partnerKind = ((await partnerPage.locator("#talkBuilderWorkflowKind").textContent().catch(() => "")) || "").trim();
  }

  const phase = detectWorkerManualFlowPhase({
    findWorkers,
    user,
    partner,
    diagnostics,
    forbidden,
    chatSent,
    composerDisabled,
    workflowKind,
    partnerKind,
  });

  return {
    capturedAt: new Date().toISOString(),
    phase,
    findWorkers,
    diagnostics,
    forbidden,
    chatSent,
    user,
    partner,
    threadId: user?.threadId || diagnostics?.threadId || threadId || null,
    workflowKind,
    partnerKind,
  };
}

/**
 * @param {{ findWorkers: Awaited<ReturnType<typeof probeFindWorkersScreen>>, user: Awaited<ReturnType<typeof probeTalkPageState>> | null, partner: Awaited<ReturnType<typeof probeTalkPageState>> | null, diagnostics: object, forbidden: object, chatSent: boolean, composerDisabled: boolean | null, workflowKind: string, partnerKind: string }} input
 */
function detectWorkerManualFlowPhase(input) {
  const { findWorkers, user, diagnostics, forbidden, chatSent, composerDisabled, workflowKind } = input;
  if (findWorkers.profileVisible) return "worker_profile";
  if (findWorkers.onFindWorkers && findWorkers.resultsVisible) return "find_workers";
  if (user?.onTalk && composerDisabled === true) return "reveal_ready";
  if (user?.onTalk && composerDisabled === false && /ワーカー相談/.test(workflowKind) && !chatSent) return "talk";
  const syncReady =
    user?.onTalk &&
    forbidden.visibleWorkflowButtons === 0 &&
    !forbidden.hasCommissionPctText &&
    diagnostics?.workerSearch?.contactRevealFeeYen === 550 &&
    !diagnostics?.hasCompletionReport &&
    !diagnostics?.hasWorkflowState &&
    diagnostics?.threadId &&
    diagnostics?.roomId &&
    diagnostics?.partnerUserId;
  if (syncReady && chatSent) return "no_project_actions";
  if (syncReady) return "partner_sync";
  if (chatSent && user?.onTalk) return "chat_sent";
  return "unknown";
}

/**
 * @param {string} minPhase
 * @param {string} currentPhase
 */
function manualFlowPhaseAtLeastWorker(minPhase, currentPhase) {
  return (
    (MANUAL_FLOW_PHASE_RANK_WORKER[currentPhase] || 0) >=
    (MANUAL_FLOW_PHASE_RANK_WORKER[minPhase] || 0)
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [threadId]
 */
async function readVendorContactDiagnostics(page, threadId = "") {
  return page.evaluate(
    ({ threadsKey, workflowKey, completionKey, tid }) => {
      const vs = window.TasuBuilderBillingPolicy?.POLICY?.vendorSearch;
      const threads = JSON.parse(localStorage.getItem(threadsKey) || "[]");
      const list = Array.isArray(threads) ? threads : [];
      const row = tid
        ? list.find((t) => String(t.id) === tid)
        : list.find((t) => String(t.threadKind || "") === "vendor_contact");
      const id = tid || row?.id || "";
      const wf = JSON.parse(localStorage.getItem(workflowKey) || "{}");
      const reports = JSON.parse(localStorage.getItem(completionKey) || "{}");
      const vendorId = row?.contactTargetId || row?.partnerUserId || row?.sellerId || null;
      return {
        vendorSearch: {
          contactRevealFeeYen: vs?.contactRevealFeeYen ?? null,
          completionCommission: vs?.completionCommission ?? null,
        },
        threadId: id || null,
        roomId: row?.roomId || id || null,
        threadKind: row?.threadKind || null,
        partnerUserId: row?.partnerUserId || row?.sellerId || vendorId || null,
        vendorId,
        hasWorkflowState: id ? Boolean(wf[id]) : false,
        hasCompletionReport: id ? Boolean(reports[id]) : false,
      };
    },
    {
      threadsKey: CHAT_THREADS_KEY,
      workflowKey: WORKFLOW_KEY,
      completionKey: COMPLETION_KEY,
      tid: threadId,
    }
  );
}

/**
 * @param {import('playwright').Page} page
 */
async function probeFindPartnersScreen(page) {
  const url = page.url();
  const onPartners = /\/builder\/partners(\.html)?(\?|$)/i.test(url);
  const onPartnerDetail = BUILDER_PARTNER_DETAIL_URL_RE.test(url);
  const resultsVisible = onPartners
    ? (await page.locator("[data-builder-partner-results] .builder-list-item").count()) > 0
    : false;
  const profileVisible = onPartnerDetail;
  const cardCount = onPartners
    ? await page.locator("[data-builder-partner-results] .builder-list-item").count()
    : 0;
  return { url, onPartners, onPartnerDetail, resultsVisible, profileVisible, cardCount };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string }} ctx
 */
async function buildVendorManualFlowProbe(page, ctx) {
  const threadId = String(ctx.threadId || "");
  const findPartners = await probeFindPartnersScreen(page);
  const user = /chat-detail/i.test(page.url()) ? await probeTalkPageState(page, threadId) : null;
  const diagnostics = await readVendorContactDiagnostics(page, threadId).catch(() => ({}));
  const forbidden = user
    ? await probeWorkerForbiddenActions(page)
    : { visibleWorkflowButtons: 0, forbiddenButtons: [], hasCommissionPctText: false, panelTextSample: "" };
  let chatSent = false;
  let composerDisabled = null;
  let workflowKind = "";
  let statusBadge = "";
  if (user?.onTalk) {
    composerDisabled = await page.locator("#chatInput").isDisabled().catch(() => null);
    workflowKind = ((await page.locator("#talkBuilderWorkflowKind").textContent().catch(() => "")) || "").trim();
    statusBadge = ((await page.locator("#talkBuilderWorkflowStatusBadge").textContent().catch(() => "")) || "").trim();
    const msgs = (await page.locator("#chatMessages").textContent().catch(() => "")) || "";
    chatSent = /業者検索/.test(msgs) || /manual review/i.test(msgs) || /相談/.test(msgs);
  }

  const phase = detectVendorManualFlowPhase({
    findPartners,
    user,
    diagnostics,
    forbidden,
    chatSent,
    composerDisabled,
    workflowKind,
    statusBadge,
  });

  return {
    capturedAt: new Date().toISOString(),
    phase,
    findPartners,
    diagnostics,
    forbidden,
    chatSent,
    user,
    threadId: user?.threadId || diagnostics?.threadId || threadId || null,
    workflowKind,
    statusBadge,
  };
}

/**
 * @param {{ findPartners: Awaited<ReturnType<typeof probeFindPartnersScreen>>, user: Awaited<ReturnType<typeof probeTalkPageState>> | null, diagnostics: object, forbidden: object, chatSent: boolean, composerDisabled: boolean | null, workflowKind: string, statusBadge: string }} input
 */
function detectVendorManualFlowPhase(input) {
  const { findPartners, user, diagnostics, forbidden, chatSent, composerDisabled, workflowKind } = input;
  if (findPartners.profileVisible) return "worker_profile";
  if (findPartners.onPartners && findPartners.resultsVisible) return "find_workers";
  if (user?.onTalk && composerDisabled === true) return "reveal_ready";
  if (user?.onTalk && composerDisabled === false && /業者相談/.test(workflowKind) && !chatSent) return "talk";
  const syncReady =
    user?.onTalk &&
    forbidden.visibleWorkflowButtons === 0 &&
    !forbidden.hasCommissionPctText &&
    diagnostics?.vendorSearch?.contactRevealFeeYen === 550 &&
    !diagnostics?.hasCompletionReport &&
    !diagnostics?.hasWorkflowState &&
    diagnostics?.threadId &&
    diagnostics?.roomId &&
    diagnostics?.threadKind === "vendor_contact" &&
    (diagnostics?.vendorId || diagnostics?.partnerUserId);
  if (syncReady && chatSent) return "no_project_actions";
  if (syncReady) return "partner_sync";
  if (chatSent && user?.onTalk) return "chat_sent";
  return "unknown";
}

function manualFlowPhaseAtLeastVendor(minPhase, currentPhase) {
  return (
    (MANUAL_FLOW_PHASE_RANK_VENDOR[currentPhase] || 0) >=
    (MANUAL_FLOW_PHASE_RANK_VENDOR[minPhase] || 0)
  );
}

/** @param {import('playwright').Page} page @returns {Promise<string>} */
async function navigateVendorSearchToTalk(page) {
  await resetContactThreads(page);
  await page.goto(partnersUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  await pause(page, 400);
  await page.locator("[data-builder-partner-search-form]").dispatchEvent("submit");
  await page.locator("[data-builder-partner-results] .builder-list-item").first().waitFor({ state: "visible", timeout: 12000 });
  await page.locator("[data-builder-partner-open]").first().click();
  await page.waitForURL(BUILDER_PARTNER_DETAIL_URL_RE, { timeout: 15000 });
  await page.locator("[data-builder-partner-name]").waitFor({ state: "visible", timeout: 12000 });
  await page.locator('[data-builder-talk-contact][data-contact-kind="vendor_contact"]').first().click();
  await page.waitForURL(/chat-detail/i, { timeout: 20000 });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
  return new URL(page.url()).searchParams.get("thread") || "";
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string }} ctx
 * @param {typeof MANUAL_REVIEW_FLOW_VENDOR_STEPS[number]} step
 */
async function driveVendorManualFlowStep(page, ctx, step) {
  switch (step.slug) {
    case "find-partners-results":
      await resetContactThreads(page);
      await page.goto(partnersUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      await pause(page, 400);
      await page.locator("[data-builder-partner-search-form]").dispatchEvent("submit");
      await page.locator("[data-builder-partner-results] .builder-list-item").first().waitFor({ state: "visible", timeout: 12000 });
      break;
    case "vendor-profile":
      if (!BUILDER_PARTNER_DETAIL_URL_RE.test(page.url())) {
        await page.locator("[data-builder-partner-open]").first().click();
        await page.waitForURL(BUILDER_PARTNER_DETAIL_URL_RE, { timeout: 15000 });
      }
      await page.locator("[data-builder-partner-name]").waitFor({ state: "visible", timeout: 12000 });
      break;
    case "talk-before-reveal":
      if (!/chat-detail/i.test(page.url())) {
        const tid = await navigateVendorSearchToTalk(page);
        if (tid) ctx.threadId = tid;
      } else {
        ctx.threadId = ctx.threadId || new URL(page.url()).searchParams.get("thread") || "";
      }
      break;
    case "talk-after-reveal":
      if (!(await page.locator("#talkBuilderContactRevealHost").isVisible().catch(() => false))) {
        const tid = ctx.threadId || (await navigateVendorSearchToTalk(page));
        if (tid) ctx.threadId = tid;
      }
      if (await page.locator("#chatInput").isDisabled()) {
        page.once("dialog", (d) => d.accept());
        await page.locator("[data-builder-contact-reveal]").first().click();
        await pause(page, TIMING.pauseState);
      }
      break;
    case "normal-chat":
      if (await page.locator("#chatInput").isDisabled()) {
        page.once("dialog", (d) => d.accept());
        await page.locator("[data-builder-contact-reveal]").first().click();
        await pause(page, TIMING.pauseState);
      }
      await sendTalkMessage(page, "業者検索から相談します（manual review）");
      break;
    case "thread-sync":
    case "no-project-workflow":
      await page.bringToFront();
      break;
    default:
      break;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} threadId
 */
async function openWorkerPartnerReviewPage(page, threadId) {
  const target = talkUrl(threadId, { builderFlow: "partner_user", builderRole: "partner" });
  const context = page.context();
  let partnerPage = context.pages().find(
    (p) => /builderRole=partner/i.test(p.url()) && p.url().includes(threadId)
  );
  if (!partnerPage) {
    partnerPage = await context.newPage();
    await partnerPage.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
  } else {
    await partnerPage.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
  }
  await partnerPage.bringToFront();
  await waitForTalkDetailReady(partnerPage, 20000);
  await partnerPage.locator("#chatPeerHeader").waitFor({ state: "visible", timeout: 15000 });
  const panelVisible = await partnerPage
    .locator("#talkBuilderWorkflowPanel:not([hidden])")
    .isVisible()
    .catch(() => false);
  if (panelVisible) {
    await partnerPage.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 5000 });
  }
  return partnerPage;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string, workerPartnerPage?: import('playwright').Page | null }} ctx
 */
async function ensureManualFlowWorkerPartnerTab(page, ctx) {
  const threadId = String(ctx.threadId || new URL(page.url()).searchParams.get("thread") || "");
  if (!threadId) return null;
  ctx.threadId = threadId;
  const partnerPage = await openWorkerPartnerReviewPage(page, threadId);
  if (partnerPage) {
    ctx.workerPartnerPage = partnerPage;
    await partnerPage.bringToFront();
  }
  return partnerPage;
}

/** @param {import('playwright').Page} page @returns {Promise<string>} */
async function navigateWorkerSearchToTalk(page) {
  await resetContactThreads(page);
  await page.goto(workersUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  await pause(page, 400);
  await page.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
  await page.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 12000 });
  if (!(await page.locator("[data-builder-fw-profile]:not([hidden])").isVisible().catch(() => false))) {
    await page.locator("[data-builder-fw-detail]").first().click();
    await page.locator("[data-builder-fw-profile]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
  }
  await page
    .locator("[data-builder-fw-profile]:not([hidden]) [data-builder-talk-contact]")
    .first()
    .click();
  await page.waitForURL(/chat-detail/i, { timeout: 20000 });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
  const threadId = new URL(page.url()).searchParams.get("thread") || "";
  return threadId;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string, userPage?: import('playwright').Page | null, workerPartnerPage?: import('playwright').Page | null }} ctx
 * @param {typeof MANUAL_REVIEW_FLOW_WORKER_STEPS[number]} step
 */
async function driveWorkerManualFlowStep(page, ctx, step) {
  switch (step.slug) {
    case "find-workers-results":
      await resetContactThreads(page);
      await page.goto(workersUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      await pause(page, 400);
      await page.locator("[data-builder-fw-search-form]").dispatchEvent("submit");
      await page.locator("[data-builder-fw-results]").waitFor({ state: "visible", timeout: 12000 });
      break;
    case "worker-profile":
      if (!(await page.locator("[data-builder-fw-profile]:not([hidden])").isVisible().catch(() => false))) {
        await page.locator("[data-builder-fw-detail]").first().click();
        await page.locator("[data-builder-fw-profile]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
      }
      break;
    case "talk-before-reveal": {
      if (!/chat-detail/i.test(page.url())) {
        const tid = await navigateWorkerSearchToTalk(page);
        if (tid) ctx.threadId = tid;
      } else {
        ctx.threadId = ctx.threadId || new URL(page.url()).searchParams.get("thread") || "";
      }
      break;
    }
    case "talk-after-reveal": {
      if (!(await page.locator("#talkBuilderContactRevealHost").isVisible().catch(() => false))) {
        const tid = ctx.threadId || (await navigateWorkerSearchToTalk(page));
        if (tid) ctx.threadId = tid;
      }
      if (await page.locator("#chatInput").isDisabled()) {
        page.once("dialog", (d) => d.accept());
        await page.locator("[data-builder-contact-reveal]").first().click();
        await pause(page, TIMING.pauseState);
      }
      break;
    }
    case "normal-chat":
      if (await page.locator("#chatInput").isDisabled()) {
        page.once("dialog", (d) => d.accept());
        await page.locator("[data-builder-contact-reveal]").first().click();
        await pause(page, TIMING.pauseState);
      }
      await sendTalkMessage(page, "ワーカー検索から相談します（manual review）");
      break;
    case "thread-sync":
      break;
    case "no-project-workflow":
      await page.bringToFront();
      break;
    default:
      break;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 */
async function logWorkerContactNegativeChecks(page, vpLabel, flow) {
  const forbidden = await probeWorkerForbiddenActions(page);
  if (forbidden.visibleWorkflowButtons === 0) {
    logStep(vpLabel, flow, "workflow アクションなし", "pass");
  } else {
    logStep(
      vpLabel,
      flow,
      "workflow アクションなし",
      "fail",
      forbidden.forbiddenButtons.map((b) => b.label).join(", ") || String(forbidden.visibleWorkflowButtons)
    );
  }
  if (forbidden.forbiddenButtons.length === 0) {
    logStep(vpLabel, flow, "入退場/完了/承認ボタンなし", "pass");
  } else {
    logStep(
      vpLabel,
      flow,
      "入退場/完了/承認ボタンなし",
      "fail",
      forbidden.forbiddenButtons.map((b) => b.label).join(", ")
    );
  }
  if (!forbidden.hasCommissionPctText) {
    logStep(vpLabel, flow, "5〜10%手数料表示なし", "pass");
  } else {
    logStep(vpLabel, flow, "5〜10%手数料表示なし", "fail", forbidden.panelTextSample);
  }
}

/**
 * @param {string} minPhase
 * @param {string} currentPhase
 */
function manualFlowPhaseAtLeastGeneral(minPhase, currentPhase) {
  return (
    (MANUAL_FLOW_PHASE_RANK_GENERAL[currentPhase] || 0) >=
    (MANUAL_FLOW_PHASE_RANK_GENERAL[minPhase] || 0)
  );
}

/**
 * @param {string} minPhase
 * @param {string} currentPhase
 */
function manualFlowPhaseAtLeast(minPhase, currentPhase) {
  return (MANUAL_FLOW_PHASE_RANK[currentPhase] || 0) >= (MANUAL_FLOW_PHASE_RANK[minPhase] || 0);
}

/**
 * @param {import('playwright').Page} page
 * @param {typeof MANUAL_REVIEW_FLOW_ADMIN_STEPS[number]} step
 * @param {string} vpLabel
 * @param {string} flow
 * @param {{ threadId?: string, meta?: object, ownerPage?: import('playwright').Page | null }} ctx
 */
async function manualReviewFlowCheckpoint(page, step, vpLabel, flow, ctx) {
  manualStepCounter += 1;
  const stepNum = manualStepCounter;
  const pad = String(stepNum).padStart(3, "0");
  const line = "=".repeat(60);
  const roleHint = step.roleLabel ? ` [${step.roleLabel}]` : "";
  console.log(`\n${line}`);
  console.log(`STEP ${stepNum}${roleHint}: ${step.screen}`);
  console.log("確認してほしい項目:");
  for (const item of step.checks) {
    console.log(`  - ${item}`);
  }

  if (step.autoOpenOwnerTab) {
    console.log("\n[manual-review-flow] 運営（owner）側 Talk を別タブで自動オープンします…");
    const ownerPage = await ensureManualFlowOwnerTab(page, ctx);
    if (!ownerPage) {
      logStep(vpLabel, flow, step.screen, "fail", "owner タブ open 失敗");
      return { ok: false, probe: null, pngPath: "", jsonPath: "" };
    }
    const ownerSnap = await readThreadWorkflowSnapshot(ownerPage, String(ctx.threadId || ""));
    console.log(`  owner URL: ${ownerPage.url()}`);
    console.log(`  owner badge: ${ownerSnap.badge || "(empty)"}`);
    console.log("  → 運営タブを前面に表示しました。内容を確認して Enter を押してください");
  } else if (step.autoOpenUserTab) {
    console.log("\n[manual-review-flow] 依頼者（user）側 Talk を別タブで自動オープンします…");
    const userPage = await ensureManualFlowUserTab(page, ctx);
    if (!userPage) {
      logStep(vpLabel, flow, step.screen, "fail", "user タブ open 失敗");
      return { ok: false, probe: null, pngPath: "", jsonPath: "" };
    }
    const userSnap = await readThreadWorkflowSnapshot(userPage, String(ctx.threadId || GENERAL_THREAD_ID));
    console.log(`  user URL: ${userPage.url()}`);
    console.log(`  user badge: ${userSnap.badge || "(empty)"}`);
    console.log("  → 依頼者タブを前面に表示しました。内容を確認して Enter を押してください");
  } else if (step.autoOpenPartnerTab) {
    console.log("\n[manual-review-flow] ワーカー（partner）側 Talk を別タブで自動オープンします…");
    const partnerTab = await ensureManualFlowWorkerPartnerTab(page, ctx);
    if (!partnerTab) {
      logStep(vpLabel, flow, step.screen, "fail", "partner タブ open 失敗");
      return { ok: false, probe: null, pngPath: "", jsonPath: "" };
    }
    const partnerSnap = await readThreadWorkflowSnapshot(partnerTab, String(ctx.threadId || ""));
    console.log(`  partner URL: ${partnerTab.url()}`);
    console.log(`  partner badge: ${partnerSnap.badge || "(empty)"}`);
    console.log("  → ワーカータブを前面に表示しました。内容を確認して Enter を押してください");
  } else if (step.roleLabel === "運営" && ctx.ownerPage) {
    await ctx.ownerPage.bringToFront();
    console.log(`\n[manual-review-flow] 運営タブを前面に表示: ${ctx.ownerPage.url()}`);
    console.log("ブラウザ上で自由に操作できます");
  } else if (step.roleLabel === "依頼者" && ctx.userPage) {
    await ctx.userPage.bringToFront();
    console.log(`\n[manual-review-flow] 依頼者タブを前面に表示: ${ctx.userPage.url()}`);
    console.log("ブラウザ上で自由に操作できます");
  } else if (step.roleLabel === "ワーカー" && ctx.workerPartnerPage) {
    await ctx.workerPartnerPage.bringToFront();
    console.log(`\n[manual-review-flow] ワーカータブを前面に表示: ${ctx.workerPartnerPage.url()}`);
    console.log("ブラウザ上で自由に操作できます");
  } else {
    console.log("ブラウザ上で自由に操作してください");
  }

  console.log("Enterで現在状態を確認");
  console.log(`${line}\n`);
  await waitForReviewEnter();

  let shotPage = page;
  if (step.roleLabel === "運営") {
    const ownerPage =
      ctx.ownerPage ||
      page
        .context()
        .pages()
        .find((p) => p !== page && /builderRole=owner/i.test(p.url()));
    if (ownerPage) {
      shotPage = ownerPage;
      ctx.ownerPage = ownerPage;
      await ownerPage.bringToFront();
    }
  } else if (step.roleLabel === "依頼者") {
    const userPage =
      ctx.userPage ||
      page
        .context()
        .pages()
        .find((p) => p !== page && /builderRole=user/i.test(p.url()));
    if (userPage) {
      shotPage = userPage;
      ctx.userPage = userPage;
      await userPage.bringToFront();
    }
  } else if (step.roleLabel === "ワーカー") {
    const partnerTab =
      ctx.workerPartnerPage ||
      page
        .context()
        .pages()
        .find((p) => p !== page && /builderRole=partner/i.test(p.url()) && /chat-detail/i.test(p.url()));
    if (partnerTab) {
      shotPage = partnerTab;
      ctx.workerPartnerPage = partnerTab;
      await partnerTab.bringToFront();
    }
  } else {
    await page.bringToFront();
  }

  const probe = await buildManualFlowProbe(page, ctx);
  if (probe.threadId) ctx.threadId = probe.threadId;
  if (probe.meta) ctx.meta = probe.meta;

  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  const pngPath = join(MANUAL_REVIEW_DIR, `${pad}-${step.slug}.png`);
  const jsonPath = join(MANUAL_REVIEW_DIR, `${pad}-${step.slug}.json`);
  await shotPage.screenshot({ path: pngPath, fullPage: true });
  writeFileSync(jsonPath, JSON.stringify(probe, null, 2), "utf8");

  const phaseAtLeast =
    ctx.flowKind === "general"
      ? manualFlowPhaseAtLeastGeneral
      : ctx.flowKind === "worker"
        ? manualFlowPhaseAtLeastWorker
        : ctx.flowKind === "vendor"
          ? manualFlowPhaseAtLeastVendor
          : manualFlowPhaseAtLeast;
  const atLeast = phaseAtLeast(step.minPhase, probe.phase);
  const detail = `phase=${probe.phase} (min=${step.minPhase})`;
  console.log(`\n[manual-review-flow] probe ${step.slug}`);
  if (probe.owner?.url) console.log(`  owner URL: ${probe.owner.url}`);
  if (probe.user?.url) console.log(`  user URL: ${probe.user.url}`);
  if (probe.billing) {
    console.log(
      `  billing: reveal=${probe.billing.contactRevealFeeYen} commission=${JSON.stringify(probe.billing.commissionPctRange)} report=${probe.billing.reportWorkContent ? "saved" : "missing"}`
    );
  }
  console.log(`  partner URL: ${probe.partner?.url || probe.calendar?.url || page.url()}`);
  console.log(`  phase: ${probe.phase} · min: ${step.minPhase}`);
  if (probe.partner?.badge) console.log(`  partner badge: ${probe.partner.badge}`);
  if (probe.partner?.status) console.log(`  partner status: ${probe.partner.status}`);
  if (probe.partner?.buttons?.length) {
    console.log(
      `  buttons: ${probe.partner.buttons.map((b) => `${b.label}(${b.nextStatus})`).join(", ")}`
    );
  }
  if (probe.owner) {
    console.log(`  owner badge: ${probe.owner.badge || "(empty)"}`);
    if (probe.owner.buttons?.length) {
      console.log(
        `  owner buttons: ${probe.owner.buttons.map((b) => `${b.label}(${b.nextStatus})`).join(", ")}`
      );
    }
  }
  console.log(`  screenshot: ${pngPath}`);
  console.log(`  state JSON: ${jsonPath}`);

  if (step.slug === "owner-before-approve" && probe.partner?.completed) {
    await saveInteractiveReviewFailure({
      partnerPage: page,
      ownerPage: page.context().pages().find((p) => /builderRole=owner/i.test(p.url())) || null,
      slug: "manual-flow-partner-completed-before-approve",
      detail: "partner completed before owner approval",
      threadId: String(probe.threadId || ""),
    });
    logStep(vpLabel, flow, step.screen, "fail", "パートナーが先に完了");
    return { ok: false, probe, pngPath, jsonPath };
  }

  if (step.slug === "partner-completion-reported" && probe.partner?.approveVisible) {
    logStep(vpLabel, flow, "パートナーは承認不可", "fail", "承認ボタン表示");
    return { ok: false, probe, pngPath, jsonPath };
  }
  if (step.slug === "partner-completion-reported" && !probe.partner?.approveVisible) {
    const awaiting =
      ctx.flowKind === "general" ? probe.partner?.isAwaitingClient : probe.partner?.isAwaitingOps;
    if (awaiting) {
      logStep(
        vpLabel,
        flow,
        ctx.flowKind === "general" ? "作業者は承認不可" : "パートナーは承認不可",
        "pass"
      );
    }
  }

  if (atLeast) {
    const rankMap =
      ctx.flowKind === "general"
        ? MANUAL_FLOW_PHASE_RANK_GENERAL
        : ctx.flowKind === "worker"
          ? MANUAL_FLOW_PHASE_RANK_WORKER
          : ctx.flowKind === "vendor"
            ? MANUAL_FLOW_PHASE_RANK_VENDOR
            : MANUAL_FLOW_PHASE_RANK;
    const ahead =
      probe.phase !== step.minPhase &&
      (rankMap[probe.phase] || 0) > (rankMap[step.minPhase] || 0);
    logStep(vpLabel, flow, step.screen, "pass", ahead ? `ahead (${detail})` : detail);
    return { ok: true, probe, pngPath, jsonPath };
  }

  await savePageReviewDiagnostics(page, {
    slug: `manual-flow-${step.slug}`,
    detail: `phase ${probe.phase} < min ${step.minPhase}`,
    extra: { probePhase: probe.phase, minPhase: step.minPhase, probe },
  });
  logStep(vpLabel, flow, step.screen, "fail", detail);
  return { ok: false, probe, pngPath, jsonPath };
}



if (CLI.help) {

  printHelp();

  process.exit(0);

}



try {
  writeFileSync(
    COMPLETION_PHOTO,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+B/g8ADggBAJj4+VkAAAAASUVORK5CYII=",
      "base64"
    )
  );
} catch {
  /* fixture may already exist */
}

try {
  writeFileSync(
    COMPLETION_PHOTO_B,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    )
  );
} catch {
  /* fixture may already exist */
}



const base = await findDevServerBaseUrl({ probePath: "builder/project-calendar.html" });

const partnerUrl = buildLocalPageUrl(base, "builder/project-calendar.html?role=partner");

const adminUrl = buildLocalPageUrl(base, "builder/admin-calendar.html");

const workersUrl = buildLocalPageUrl(base, "builder/find-workers.html");

const partnersUrl = buildLocalPageUrl(base, "builder/partners.html");

/** Wrangler Pages dev may strip `.html` (partner.html → /builder/partner). */
const BUILDER_PARTNER_DETAIL_URL_RE = /\/builder\/partner(\.html)?(\?|$)/i;

const partnerDetailUrl = buildLocalPageUrl(

  base,

  "builder/partner.html?partner_id=demo-partner-001"

);

const normalChatUrl = buildLocalPageUrl(

  base,

  "chat-detail.html?thread=verify-normal-chat&from=chat"

);



const viewports = CLI.viewportFilter

  ? BUILDER_QA_VIEWPORTS.filter((vp) => String(vp.width) === CLI.viewportFilter)

  : BUILDER_QA_VIEWPORTS;



if (CLI.viewportFilter && viewports.length === 0) {
  console.error(`Unknown --viewport=${CLI.viewportFilter} (use 1280, 768, or 390)`);
  process.exit(1);
}

const VALID_FLOWS = new Set(["admin", "general", "worker", "vendor", "normal"]);
if (CLI.flowFilter && !VALID_FLOWS.has(CLI.flowFilter)) {
  console.error(`Unknown --flow=${CLI.flowFilter} (use admin, general, worker, vendor, or normal)`);
  process.exit(1);
}

/** @type {Record<string, boolean>} */
const FLOW_ENABLED = {
  admin: !CLI.flowFilter || CLI.flowFilter === "admin",
  general: !CLI.flowFilter || CLI.flowFilter === "general",
  worker: !CLI.flowFilter || CLI.flowFilter === "worker",
  vendor: !CLI.flowFilter || CLI.flowFilter === "vendor",
  normal: !CLI.flowFilter || CLI.flowFilter === "normal",
};



/** @type {{ viewport: string, flow: string, step: string, status: 'pass'|'fail'|'skip', detail?: string }[]} */

const report = [];

/** @type {string[]} */

const consoleErrorsAll = [];



function currentMonthDay10() {

  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-10`;

}



function logStep(viewport, flow, step, status, detail = "") {

  report.push({ viewport, flow, step, status, detail });

  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : "○";

  console.log(`  [${viewport}] [${flow}] ${mark} ${step}${detail ? ` — ${detail}` : ""}`);

}



/** @param {import('playwright').Page} page @param {number} [ms] */

async function pause(page, ms = TIMING.pause) {

  await page.waitForTimeout(ms);

}



/**

 * @param {import('playwright').Page} page

 * @param {string} label

 * @param {'checkpoint'|'nav'|'state'|'modal'|'complete'|'chat'} [kind]

 */

async function visualHold(page, label, kind = "checkpoint") {
  const ms =
    kind === "nav"
      ? TIMING.pauseNav
      : kind === "state"
        ? TIMING.pauseState
        : kind === "modal"
          ? TIMING.pauseModal
          : kind === "complete"
            ? TIMING.pauseComplete
            : kind === "chat"
              ? TIMING.pauseChat
              : TIMING.pauseCheckpoint;
  if (CLI.visualSlow) {
    console.log(`  ⏸ [目視] ${label} (${ms}ms)`);
  }
  await page.waitForTimeout(CLI.visualSlow ? ms : Math.min(ms, TIMING.pause));
}

function resetManualStepCounter() {
  manualStepCounter = 0;
}

async function waitForReviewEnter() {
  if (process.env.REVIEW_AUTO_ENTER === "1") {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return;
  }
  if (!reviewReadline) {
    reviewReadline = createInterface({ input: process.stdin, output: process.stdout });
  }
  await new Promise((resolve) => {
    reviewReadline.question("", () => resolve(undefined));
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} slug
 */
async function saveReviewScreenshot(page, slug) {
  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  const filepath = join(MANUAL_REVIEW_DIR, slug);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} slug
 * @param {string} detail
 */
async function saveReviewError(page, slug, detail) {
  const filepath = await saveReviewScreenshot(page, `error-${slug}-${Date.now()}.png`);
  console.error(`  ✗ 想定外の画面/状態 (${detail}) → ${filepath}`);
  return filepath;
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
async function readWorkflowBadge(page) {
  const el = page.locator("#talkBuilderWorkflowStatusBadge");
  if ((await el.count()) < 1) return "";
  return ((await el.textContent()) || "").trim();
}

/**
 * @param {import('playwright').Page} page
 */
async function readOpsMeta(page) {
  return page.evaluate(
    ({ mvpKey, projectId, chatKey }) => {
      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const project = (mvp.projects || []).find((p) => p.project_id === projectId);
      const threadId = project?.main_thread_id || null;
      const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
      const inTalk = (chat || []).some((t) => String(t.id) === String(threadId));
      return { assignment_status: project?.assignment_status, threadId, inTalk };
    },
    { mvpKey: MVP_KEY, projectId: BUILDER_DEMO_PROJECT_ID, chatKey: CHAT_THREADS_KEY }
  );
}

const OPS_AWAITING_BADGE = /運営確認待ち|運営承認待ち/;
const OPS_AWAITING_STATUS = new Set(["completion_reported", "ops_confirming"]);
const CLIENT_AWAITING_BADGE = /依頼者確認待ち|完了報告済み/;
const CLIENT_AWAITING_STATUS = new Set(["completion_reported", "client_confirming"]);

/**
 * @param {import('playwright').Page} page
 * @param {string} threadId
 */
async function readThreadWorkflowSnapshot(page, threadId) {
  const url = page.url();
  let builderRole = "";
  let urlThreadId = threadId;
  try {
    const u = new URL(url);
    builderRole = u.searchParams.get("builderRole") || "";
    urlThreadId = u.searchParams.get("thread") || threadId;
  } catch {
    /* ignore */
  }
  const badge = await readWorkflowBadge(page);
  const status = await page.evaluate(
    ({ workflowKey, tid }) => {
      const map = JSON.parse(localStorage.getItem(workflowKey) || "{}");
      const row = map[tid] || map[String(tid)] || null;
      return row?.status || "";
    },
    { workflowKey: WORKFLOW_KEY, tid: urlThreadId }
  );
  return { url, builderRole, threadId: urlThreadId, badge, status };
}

/**
 * @param {string} prefix
 * @param {{ url: string, builderRole: string, threadId: string, badge: string, status: string }} snap
 */
function logWorkflowSnapshot(prefix, snap) {
  console.log(`  [interactive] ${prefix}`);
  console.log(`    URL: ${snap.url}`);
  console.log(`    builderRole: ${snap.builderRole || "(none)"}`);
  console.log(`    badge: ${snap.badge || "(empty)"}`);
  console.log(`    localStorage status: ${snap.status || "(empty)"}`);
}

/**
 * @param {{ badge: string, status: string }} snap
 */
function isAwaitingOpsApproval(snap) {
  if (snap.status === "completed" || /完了/.test(snap.badge)) return false;
  if (OPS_AWAITING_STATUS.has(snap.status)) return true;
  return OPS_AWAITING_BADGE.test(snap.badge);
}

/**
 * @param {{ badge: string, status: string }} snap
 */
function isWorkflowCompleted(snap) {
  return snap.status === "completed" || /完了/.test(snap.badge);
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {string} threadId
 */
function buildOwnerTalkUrlFromPartner(partnerPage, threadId) {
  const partnerUrl = partnerPage.url();
  try {
    const url = new URL(partnerUrl);
    if (/chat-detail/i.test(url.pathname)) {
      url.searchParams.set("builderRole", "owner");
      if (!url.searchParams.get("thread") && threadId) url.searchParams.set("thread", threadId);
      if (!url.searchParams.get("from")) url.searchParams.set("from", "builder");
      if (!url.searchParams.get("builderFlow")) url.searchParams.set("builderFlow", "ops_partner");
      return url.toString();
    }
  } catch {
    /* fall through */
  }
  return talkUrl(threadId, { builderFlow: "ops_partner", builderRole: "owner" });
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [timeoutMs]
 */
async function waitForTalkDetailReady(page, timeoutMs = 20000) {
  await page
    .waitForFunction(() => document.body?.dataset?.chatDetailReady === "true", { timeout: timeoutMs })
    .catch(() => null);
}

/**
 * @param {{
 *   partnerPage?: import('playwright').Page | null,
 *   ownerPage?: import('playwright').Page | null,
 *   slug: string,
 *   detail: string,
 *   threadId: string,
 * }} opts
 */
async function saveInteractiveReviewFailure(opts) {
  const { partnerPage, ownerPage, slug, detail, threadId } = opts;
  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  const ts = Date.now();
  /** @type {Record<string, unknown>} */
  const payload = { detail, threadId };
  if (partnerPage) {
    payload.partner = await readThreadWorkflowSnapshot(partnerPage, threadId).catch(() => ({}));
    payload.partnerBodyText = ((await partnerPage.locator("body").textContent()) || "").slice(0, 4000);
    await saveReviewScreenshot(partnerPage, `error-${slug}-partner-${ts}.png`);
  }
  if (ownerPage) {
    payload.owner = await readThreadWorkflowSnapshot(ownerPage, threadId).catch(() => ({}));
    payload.ownerBodyText = ((await ownerPage.locator("body").textContent()) || "").slice(0, 4000);
    await saveReviewScreenshot(ownerPage, `error-${slug}-owner-${ts}.png`);
  }
  const jsonPath = join(MANUAL_REVIEW_DIR, `error-${slug}-${ts}.json`);
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  console.error(`  ✗ ${detail}`);
  console.error(`    diagnostics: ${jsonPath}`);
}

/**
 * @param {import('playwright').Page} page
 */
async function probeAdminProjectScreen(page) {
  const url = page.url();
  const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
  const embedVisible =
    (await embed.count()) > 0 && (await embed.first().isVisible().catch(() => false));
  return {
    url,
    onChatDetail: /chat-detail/i.test(url),
    acceptVisible: await page
      .getByText("受ける", { exact: true })
      .first()
      .isVisible()
      .catch(() => false),
    builderConfirmVisible: await page
      .getByText("Builderで確認")
      .first()
      .isVisible()
      .catch(() => false),
    projectTitleVisible: await page
      .getByText(BUILDER_DEMO_PROJECT_LABEL)
      .first()
      .isVisible()
      .catch(() => false),
    partnerCalAccept: await page
      .locator("[data-partner-cal-accept]")
      .first()
      .isVisible()
      .catch(() => false),
    adminCalEmbedVisible: embedVisible,
    adminCalBadgeCount: await page
      .locator(".admin-cal-badge")
      .filter({ hasText: BUILDER_DEMO_PROJECT_LABEL })
      .count()
      .catch(() => 0),
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ slug: string, detail: string, extra?: Record<string, unknown> }} opts
 */
async function savePageReviewDiagnostics(page, opts) {
  const { slug, detail, extra = {} } = opts;
  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  const ts = Date.now();
  const probe = await probeAdminProjectScreen(page);
  const payload = {
    detail,
    ...probe,
    bodyText: ((await page.locator("body").textContent()) || "").slice(0, 4000),
    ...extra,
  };
  await saveReviewScreenshot(page, `error-${slug}-${ts}.png`);
  const jsonPath = join(MANUAL_REVIEW_DIR, `error-${slug}-${ts}.json`);
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  console.error(`  ✗ ${detail}`);
  console.error(`    URL: ${probe.url}`);
  console.error(
    `    locators: chat-detail=${probe.onChatDetail} accept=${probe.acceptVisible} builderConfirm=${probe.builderConfirmVisible} projectTitle=${probe.projectTitleVisible} badgeCount=${probe.adminCalBadgeCount} embed=${probe.adminCalEmbedVisible}`
  );
  console.error(`    diagnostics: ${jsonPath}`);
}

/**
 * @param {import('playwright').Page} page
 */
async function ensurePartnerCalendarDayView(page) {
  const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
  if ((await embed.count()) < 1) return false;
  if (!(await embed.locator(".admin-cal-monthHead").isVisible().catch(() => false))) return false;
  const day10 = currentMonthDay10();
  await embed.locator(`[data-admin-cal-date="${day10}"]`).click({ timeout: 5000 }).catch(() => null);
  await embed.locator('[data-admin-cal-view="day"]').click({ timeout: 5000 }).catch(() => null);
  await pause(page, 400);
  return true;
}

/**
 * @param {import('playwright').Page} page
 */
async function tryClickAdminProjectBadge(page) {
  const candidates = [
    page
      .locator("[data-builder-cal-partner][data-admin-cal-embed]")
      .locator(".admin-cal-badge")
      .filter({ hasText: BUILDER_DEMO_PROJECT_LABEL }),
    page.locator(".admin-cal-badge").filter({ hasText: BUILDER_DEMO_PROJECT_LABEL }),
    page.getByRole("button", { name: BUILDER_DEMO_PROJECT_LABEL }),
    page.getByText(BUILDER_DEMO_PROJECT_LABEL),
    page
      .locator("[data-admin-cal-project], [data-partner-cal-project], [data-cal-project]")
      .filter({ hasText: BUILDER_DEMO_PROJECT_LABEL }),
  ];
  for (const loc of candidates) {
    const target = loc.first();
    if ((await target.count()) < 1) continue;
    if (!(await target.isVisible().catch(() => false))) continue;
    await target.click({ timeout: 5000 });
    return true;
  }
  return false;
}

/**
 * interactive-review: STEP 1 後 — 現在画面に応じて案件オープンをスキップ/実行
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 * @param {string} flow
 */
async function smartOpenAdminProjectFromCalendar(page, vpLabel, flow) {
  let probe = await probeAdminProjectScreen(page);
  console.log("\n[interactive] smartOpenAdminProjectFromCalendar");
  console.log(`  partner current URL: ${probe.url}`);
  console.log(
    `  detected: chat-detail=${probe.onChatDetail} accept=${probe.acceptVisible} builderConfirm=${probe.builderConfirmVisible} projectTitle=${probe.projectTitleVisible} badgeCount=${probe.adminCalBadgeCount}`
  );

  if (probe.onChatDetail) {
    logStep(vpLabel, flow, "案件オープン", "pass", "skip (chat-detail)");
    return { ok: true, state: "chat-detail", skipped: true };
  }

  if (probe.acceptVisible || probe.partnerCalAccept) {
    logStep(vpLabel, flow, "案件オープン", "pass", "skip (accept-ready)");
    return { ok: true, state: "accept-ready", skipped: true };
  }

  if (probe.builderConfirmVisible) {
    logStep(vpLabel, flow, "案件オープン", "pass", "skip (project-detail)");
    return { ok: true, state: "project-detail", skipped: true };
  }

  if (probe.adminCalEmbedVisible || /project-calendar/i.test(probe.url)) {
    if (probe.adminCalBadgeCount === 0 && probe.adminCalEmbedVisible) {
      await ensurePartnerCalendarDayView(page);
      probe = await probeAdminProjectScreen(page);
    }
    if (probe.projectTitleVisible || probe.adminCalBadgeCount > 0) {
      const clicked = await tryClickAdminProjectBadge(page);
      if (clicked) {
        await pause(page);
        logStep(vpLabel, flow, "案件オープン", "pass", "calendar click");
        return { ok: true, state: "clicked", skipped: false };
      }
    }
  }

  if (probe.projectTitleVisible) {
    const clicked = await tryClickAdminProjectBadge(page);
    if (clicked) {
      await pause(page);
      logStep(vpLabel, flow, "案件オープン", "pass", "title click");
      return { ok: true, state: "clicked", skipped: false };
    }
  }

  await savePageReviewDiagnostics(page, {
    slug: "smart-open-admin-project",
    detail: "could not open admin demo project from current screen after STEP 1",
  });
  logStep(vpLabel, flow, "案件オープン", "fail", "状態不一致 — diagnostics 保存");
  return { ok: false, state: "unknown", skipped: false };
}

/**
 * @param {import('playwright').Page} ownerPage
 * @param {string} threadId
 * @param {number} [timeoutMs]
 */
async function waitForOwnerApprovalReady(ownerPage, threadId, timeoutMs = 25000) {
  await waitForTalkDetailReady(ownerPage, timeoutMs);
  await ownerPage.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });

  const deadline = Date.now() + timeoutMs;
  /** @type {{ url: string, builderRole: string, threadId: string, badge: string, status: string }} */
  let lastSnap = { url: "", builderRole: "", threadId, badge: "", status: "" };
  while (Date.now() < deadline) {
    lastSnap = await readThreadWorkflowSnapshot(ownerPage, threadId);
    const approveBtn = ownerApproveButtonLocator(ownerPage);
    if (isWorkflowCompleted(lastSnap)) return { kind: "completed", snap: lastSnap };
    if (lastSnap.status === "ops_confirming" || /運営承認待ち/.test(lastSnap.badge)) {
      if (await approveBtn.isVisible().catch(() => false)) return { kind: "ready", snap: lastSnap };
    }
    if (await approveBtn.isVisible().catch(() => false)) {
      const label = ((await approveBtn.textContent()) || "").trim();
      if (/承認/.test(label)) return { kind: "ready", snap: lastSnap };
    }
    await ownerPage.waitForTimeout(400);
  }
  return { kind: "timeout", snap: lastSnap };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} threadId
 * @param {string} role
 */
async function gotoTalkIfNeeded(page, threadId, role) {
  const url = page.url();
  if (/chat-detail/i.test(url) && url.includes(String(threadId))) {
    await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 8000 }).catch(() => null);
    if (await page.locator("#talkBuilderWorkflowPanel").isVisible()) return;
  }
  await page.goto(talkUrl(threadId, { builderFlow: "ops_partner", builderRole: role }), {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 * @param {string} flow
 * @param {string} stepName
 * @param {string} nextStatus
 * @param {RegExp} expectAfter
 */
async function smartWorkflowClick(page, vpLabel, flow, stepName, nextStatus, expectAfter) {
  let badge = await readWorkflowBadge(page);
  if (expectAfter.test(badge)) {
    logStep(vpLabel, flow, stepName, "pass", `skip (${badge})`);
    return true;
  }
  const btn = page.locator(`[data-talk-builder-next][data-next-status="${nextStatus}"]`).first();
  if (await btn.isVisible()) {
    await btn.click();
    await pause(page, TIMING.pauseState);
    badge = await readWorkflowBadge(page);
    if (expectAfter.test(badge)) {
      logStep(vpLabel, flow, stepName, "pass", badge);
      return true;
    }
  }
  badge = await readWorkflowBadge(page);
  if (expectAfter.test(badge)) {
    logStep(vpLabel, flow, stepName, "pass", `user操作済 (${badge})`);
    return true;
  }
  await saveReviewError(page, stepName.replace(/\s+/g, "-"), badge || "no badge");
  logStep(vpLabel, flow, stepName, "fail", badge || "状態不明");
  return false;
}

/**
 * @param {import('playwright').Page} page
 */
async function smartOpenCompletionModal(page) {
  const modal = page.locator("#talkBuilderCompletionModal");
  if (await modal.isVisible()) return true;
  const btn = page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.locator("#talkBuilderCompletionWork").waitFor({ state: "visible", timeout: 8000 });
    return true;
  }
  return modal.isVisible();
}

/**
 * @param {import('playwright').Page} page
 */
async function smartFillCompletionIfNeeded(page) {
  const work = page.locator("#talkBuilderCompletionWork");
  if (!(await work.inputValue())) {
    await work.fill("内装完了（headed確認）");
  }
  await page.locator("#talkBuilderCompletionPhotos").setInputFiles(COMPLETION_PHOTO);
}

/**
 * @param {import('playwright').Page} page
 */
async function smartSubmitCompletionIfNeeded(page) {
  if (await page.locator("#talkBuilderCompletionModal").isVisible()) {
    await page.locator("#talkBuilderCompletionSubmit").click();
    await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 12000 }).catch(() => null);
    await page.locator("#talkBuilderWorkflowStatusBadge").waitFor({ state: "visible", timeout: 12000 }).catch(() => null);
    await pause(page, TIMING.pauseState);
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} embed
 * @param {string} vpLabel
 * @param {string} flow
 */
async function smartClickAccept(page, embed, vpLabel, flow) {
  let meta = await readOpsMeta(page);
  if (meta.assignment_status === "accepted" && meta.threadId) {
    logStep(vpLabel, flow, "受ける + threadId 保存", "pass", `skip (${meta.threadId})`);
    if (meta.inTalk) logStep(vpLabel, flow, "Talk 同期", "pass");
    else logStep(vpLabel, flow, "Talk 同期", "fail");
    return meta;
  }
  const acceptBtn = embed.locator("[data-partner-cal-accept]");
  if ((await acceptBtn.count()) >= 1 && (await acceptBtn.isVisible())) {
    await acceptBtn.click();
    await visualHold(page, "受ける 押下後", "state");
  }
  meta = await readOpsMeta(page);
  if (meta.assignment_status === "accepted" && meta.threadId) {
    logStep(vpLabel, flow, "受ける + threadId 保存", "pass", meta.threadId);
  } else {
    logStep(vpLabel, flow, "受ける + threadId 保存", "fail", JSON.stringify(meta));
  }
  if (meta.inTalk) logStep(vpLabel, flow, "Talk 同期", "pass");
  else logStep(vpLabel, flow, "Talk 同期", "fail");
  return meta;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} threadId
 * @param {string} slug
 */
async function assertOnTalkWorkflow(page, threadId, slug) {
  const url = page.url();
  if (!/chat-detail/i.test(url) || !url.includes(String(threadId))) {
    await saveReviewError(page, slug, `unexpected url: ${url}`);
    return false;
  }
  if (!(await page.locator("#talkBuilderWorkflowPanel").isVisible())) {
    await saveReviewError(page, slug, "workflow panel hidden");
    return false;
  }
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 * @param {string} flow
 */
async function smartOpsApprove(page, vpLabel, flow) {
  let badge = await readWorkflowBadge(page);
  if (/完了/.test(badge)) {
    logStep(vpLabel, flow, "completed（運営承認）", "pass", `skip (${badge})`);
    return true;
  }
  const approveBtn = ownerApproveButtonLocator(page);
  if (await approveBtn.isVisible()) {
    if (!/承認/.test((await approveBtn.textContent()) || "")) {
      logStep(vpLabel, flow, "運営承認ボタン", "fail", await approveBtn.textContent());
      return false;
    }
    await approveBtn.click();
    await pause(page, TIMING.pauseState);
  }
  badge = await readWorkflowBadge(page);
  if (/完了/.test(badge)) {
    logStep(vpLabel, flow, "completed（運営承認）", "pass", badge);
    return true;
  }
  await saveReviewError(page, "ops-approve", badge || "no badge");
  logStep(vpLabel, flow, "completed（運営承認）", "fail", badge || "状態不明");
  return false;
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {string} threadId
 * @returns {Promise<import('playwright').Page | null>}
 */
async function openOwnerReviewPage(partnerPage, threadId) {
  const partnerSnap = await readThreadWorkflowSnapshot(partnerPage, threadId);
  const resolvedThreadId = partnerSnap.threadId || threadId;
  const ownerTargetUrl = buildOwnerTalkUrlFromPartner(partnerPage, resolvedThreadId);

  const logTag = CLI.manualReviewFlow ? "[manual-review-flow]" : "[interactive]";
  console.log(`\n${logTag} owner タブを開きます`);
  console.log(`  partner current URL: ${partnerSnap.url}`);
  console.log(`  owner target URL: ${ownerTargetUrl}`);
  logWorkflowSnapshot("partner state", partnerSnap);

  const context = partnerPage.context();
  const needle = String(resolvedThreadId);
  let ownerPage = context.pages().find(
    (p) => /builderRole=owner/i.test(p.url()) && p.url().includes(needle)
  );

  try {
    if (!ownerPage) {
      ownerPage = await context.newPage();
      await ownerPage.goto(ownerTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    } else {
      const current = ownerPage.url();
      if (!/builderRole=owner/i.test(current) || !current.includes(needle)) {
        await ownerPage.goto(ownerTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      } else {
        try {
          const u = new URL(current);
          if (u.searchParams.get("builderRole") !== "owner") {
            await ownerPage.goto(ownerTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
          } else {
            await gotoTalkIfNeeded(ownerPage, resolvedThreadId, "owner");
          }
        } catch {
          await ownerPage.goto(ownerTargetUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
        }
      }
    }
    await ownerPage.bringToFront();
    await waitForTalkDetailReady(ownerPage, 20000);
    await ownerPage.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });
  } catch (err) {
    await saveInteractiveReviewFailure({
      partnerPage,
      ownerPage: ownerPage || null,
      slug: "open-owner-tab",
      detail: String(err?.message || err),
      threadId: resolvedThreadId,
    });
    return null;
  }

  const ownerSnap = await readThreadWorkflowSnapshot(ownerPage, resolvedThreadId);
  const approveVisible = await ownerApproveButtonLocator(ownerPage)
    .isVisible()
    .catch(() => false);
  console.log(`  owner approval button visible: ${approveVisible}`);
  logWorkflowSnapshot("owner state after open", ownerSnap);

  return ownerPage;
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {import('playwright').Page} ownerPage
 * @param {string} threadId
 * @param {string} vpLabel
 * @param {string} flow
 */
async function runInteractiveCompletedVerification(partnerPage, ownerPage, threadId, vpLabel, flow) {
  if (!(await assertCompletedBadge(ownerPage, vpLabel, flow, "owner completed"))) return false;

  await partnerPage.bringToFront();
  await gotoTalkIfNeeded(partnerPage, threadId, "partner");
  await pause(partnerPage);

  await hold(
    partnerPage,
    {
      screen: "completed 表示（パートナー）",
      roleLabel: "パートナー",
      checks: [
        "パートナー側でもステータスが「完了」",
        "運営承認後に同期されている",
        "Builder 内チャット UI がない",
      ],
      slug: "partner-completed",
    },
    "パートナー completed",
    "complete"
  );

  if (!(await assertCompletedBadge(partnerPage, vpLabel, flow, "partner completed"))) return false;

  await ownerPage.bringToFront();
  await gotoTalkIfNeeded(ownerPage, threadId, "owner");
  await pause(ownerPage);

  await hold(
    ownerPage,
    {
      screen: "completed 表示（運営）",
      roleLabel: "運営",
      checks: [
        "運営側でもステータスが「完了」",
        "入場・退場・承認の system メッセージが混在",
      ],
      slug: "owner-completed",
    },
    "運営 completed",
    "complete"
  );

  if (!(await assertCompletedBadge(ownerPage, vpLabel, flow, "owner completed 再確認"))) return false;

  await partnerPage.bringToFront();
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 * @param {string} flow
 * @param {string} stepName
 */
async function assertNotCompletedYet(page, vpLabel, flow, stepName) {
  const badge = await readWorkflowBadge(page);
  if (/完了/.test(badge)) {
    await saveReviewError(page, stepName.replace(/\s+/g, "-"), `premature completed: ${badge}`);
    logStep(vpLabel, flow, stepName, "fail", `承認前に完了: ${badge}`);
    return false;
  }
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} vpLabel
 * @param {string} flow
 * @param {string} stepName
 */
async function assertCompletedBadge(page, vpLabel, flow, stepName) {
  const badge = await readWorkflowBadge(page);
  if (/完了/.test(badge)) {
    logStep(vpLabel, flow, stepName, "pass", badge);
    return true;
  }
  await saveReviewError(page, stepName.replace(/\s+/g, "-"), badge || "no badge");
  logStep(vpLabel, flow, stepName, "fail", badge || "状態不明");
  return false;
}

/**
 * @param {import('playwright').Page} partnerPage
 * @param {string} threadId
 * @param {string} vpLabel
 * @param {string} flow
 */
async function runInteractiveOpsApprovalReview(partnerPage, threadId, vpLabel, flow) {
  await hold(
    partnerPage,
    {
      screen: "完了報告送信後（パートナー）",
      roleLabel: "パートナー",
      checks: [
        "モーダルが閉じている",
        "ステータスが「運営確認待ち」または「運営承認待ち」",
        "パートナー側に承認ボタンがない",
      ],
      slug: "partner-completion-reported",
    },
    "パートナー: 完了報告送信後",
    "complete"
  );

  const partnerSnap = await readThreadWorkflowSnapshot(partnerPage, threadId);
  const resolvedThreadId = partnerSnap.threadId || threadId;
  logWorkflowSnapshot("partner after Enter", partnerSnap);

  if (isWorkflowCompleted(partnerSnap)) {
    logStep(vpLabel, flow, "すでに承認済み（パートナー）", "pass", partnerSnap.badge);
    const ownerPage = await openOwnerReviewPage(partnerPage, resolvedThreadId);
    if (!ownerPage) {
      logStep(vpLabel, flow, "owner タブ open", "fail");
      return false;
    }
    return runInteractiveCompletedVerification(partnerPage, ownerPage, resolvedThreadId, vpLabel, flow);
  }

  if (!isAwaitingOpsApproval(partnerSnap)) {
    await saveInteractiveReviewFailure({
      partnerPage,
      slug: "partner-post-completion-state",
      detail: `unexpected partner state: badge=${partnerSnap.badge} status=${partnerSnap.status}`,
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "post-completion partner state", "fail", `${partnerSnap.badge} / ${partnerSnap.status}`);
    return false;
  }

  if (partnerSnap.status === "ops_confirming" || /運営承認待ち/.test(partnerSnap.badge)) {
    logStep(vpLabel, flow, "ops_confirming", "pass", partnerSnap.badge);
  } else {
    logStep(vpLabel, flow, "completion_reported", "pass", partnerSnap.badge);
  }

  const partnerApproveBtn = partnerPage.locator('[data-talk-builder-next][data-next-status="completed"]');
  if (await partnerApproveBtn.isVisible().catch(() => false)) {
    await saveInteractiveReviewFailure({
      partnerPage,
      slug: "partner-has-approve",
      detail: "partner sees completed approve button before owner approval",
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "パートナーは承認不可", "fail", "承認ボタン表示");
    return false;
  }
  logStep(vpLabel, flow, "パートナーは承認不可", "pass");

  if (!(await assertNotCompletedYet(partnerPage, vpLabel, flow, "承認前 completed 防止（パートナー）"))) return false;

  const ownerPage = await openOwnerReviewPage(partnerPage, resolvedThreadId);
  if (!ownerPage) {
    logStep(vpLabel, flow, "owner タブ open", "fail");
    return false;
  }
  console.log(`\n運営側 Talk を別タブで開きました: ${ownerPage.url()}`);
  console.log("パートナータブと運営タブを切り替えて確認できます");

  await hold(
    ownerPage,
    {
      screen: "運営側 Talk オープン",
      roleLabel: "運営",
      checks: [
        "運営（owner）視点の Talk が開いている",
        "ワークフローパネルが表示されている",
        "ステータスが「運営確認待ち」または「運営承認待ち」",
      ],
      slug: "owner-talk-open",
    },
    "運営 Talk オープン",
    "nav"
  );

  if (!(await assertOnTalkWorkflow(ownerPage, resolvedThreadId, "owner-talk-open"))) return false;

  const ownerCardVisible = await completionReportCardLocator(ownerPage).isVisible().catch(() => false);
  if (ownerCardVisible) {
    logStep(vpLabel, flow, "owner completion report card", "pass");
  } else {
    await saveInteractiveReviewFailure({
      partnerPage,
      ownerPage,
      slug: "owner-completion-card",
      detail: "completion report card not visible on owner talk",
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "owner completion report card", "fail", "非表示");
    return false;
  }

  const approvalWait = await waitForOwnerApprovalReady(ownerPage, resolvedThreadId);
  logWorkflowSnapshot("owner approval wait", approvalWait.snap);

  if (approvalWait.kind === "timeout") {
    await saveInteractiveReviewFailure({
      partnerPage,
      ownerPage,
      slug: "owner-approval-wait",
      detail: "timeout waiting for owner approval UI",
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "運営承認 UI 待機", "fail", approvalWait.snap.badge || "timeout");
    return false;
  }

  if (approvalWait.kind === "completed") {
    logStep(vpLabel, flow, "すでに承認済み（運営）", "pass", approvalWait.snap.badge);
    return runInteractiveCompletedVerification(partnerPage, ownerPage, resolvedThreadId, vpLabel, flow);
  }

  await hold(
    ownerPage,
    {
      screen: "運営承認前（運営視点）",
      roleLabel: "運営",
      checks: [
        "「運営承認待ち」状態",
        "完了報告カードに作業内容・完了写真が表示されている",
        "「承認する」ボタンが表示されている（上部またはカード内）",
        "ここで運営が承認操作できる",
      ],
      slug: "owner-before-approve",
    },
    "運営承認前",
    "checkpoint"
  );

  if (!(await assertOnTalkWorkflow(ownerPage, resolvedThreadId, "owner-before-approve"))) return false;

  const partnerRecheck = await readThreadWorkflowSnapshot(partnerPage, resolvedThreadId);
  if (isWorkflowCompleted(partnerRecheck)) {
    await saveInteractiveReviewFailure({
      partnerPage,
      ownerPage,
      slug: "partner-completed-before-approve",
      detail: "partner became completed before owner approval",
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "承認前 completed 防止", "fail", `パートナー側が先に完了: ${partnerRecheck.badge}`);
    return false;
  }
  if (!(await assertNotCompletedYet(partnerPage, vpLabel, flow, "承認前 completed 防止"))) return false;

  const approveBtn = ownerApproveButtonLocator(ownerPage);
  const approveVisible = await approveBtn.isVisible().catch(() => false);
  console.log(`  owner approval button visible: ${approveVisible}`);
  if (!approveVisible) {
    await saveInteractiveReviewFailure({
      partnerPage,
      ownerPage,
      slug: "owner-approve-button",
      detail: "owner approve button not visible at owner-before-approve",
      threadId: resolvedThreadId,
    });
    logStep(vpLabel, flow, "運営承認ボタン", "fail", "非表示");
    return false;
  }
  if (!/承認/.test((await approveBtn.textContent()) || "")) {
    logStep(vpLabel, flow, "運営承認ボタン", "fail", await approveBtn.textContent());
    return false;
  }
  logStep(vpLabel, flow, "運営承認ボタン", "pass");

  if (!(await smartOpsApprove(ownerPage, vpLabel, flow))) return false;

  await hold(
    ownerPage,
    {
      screen: "運営承認後（運営視点）",
      roleLabel: "運営",
      checks: [
        "ステータスが「完了」",
        "運営側で承認完了が確認できる",
        "Builder 内チャット UI がない",
      ],
      slug: "owner-after-approve",
    },
    "運営承認後",
    "complete"
  );

  return runInteractiveCompletedVerification(partnerPage, ownerPage, resolvedThreadId, vpLabel, flow);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ screen: string, checks: string[], slug: string }} opts
 * @returns {Promise<string>}
 */
async function manualReviewCheckpoint(page, opts) {
  if (!CLI.manualReview || CLI.interactiveReview) return "";
  manualStepCounter += 1;
  const stepNum = manualStepCounter;
  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  const filename = `${String(stepNum).padStart(3, "0")}-${opts.slug}.png`;
  const filepath = join(MANUAL_REVIEW_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  const line = "=".repeat(60);
  console.log(`\n${line}`);
  console.log(`STEP ${stepNum}: ${opts.screen}`);
  console.log("確認してほしい項目:");
  for (const item of opts.checks) {
    console.log(`  - ${item}`);
  }
  console.log(`スクリーンショット: ${filepath}`);
  console.log("Enterで次へ");
  console.log(`${line}\n`);
  await waitForReviewEnter();
  return filepath;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ screen: string, checks: string[], slug: string }} opts
 * @returns {Promise<{ before: string, after: string }>}
 */
async function interactiveReviewCheckpoint(page, opts) {
  manualStepCounter += 1;
  const stepNum = manualStepCounter;
  const pad = String(stepNum).padStart(3, "0");
  const beforePath = join(MANUAL_REVIEW_DIR, `${pad}-${opts.slug}-before.png`);
  const afterPath = join(MANUAL_REVIEW_DIR, `${pad}-${opts.slug}-after.png`);
  mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  await page.bringToFront();
  await page.screenshot({ path: beforePath, fullPage: true });
  const line = "=".repeat(60);
  const roleHint = opts.roleLabel ? ` [${opts.roleLabel}]` : "";
  console.log(`\n${line}`);
  console.log(`STEP ${stepNum}${roleHint}: ${opts.screen}`);
  console.log("確認してほしい項目:");
  for (const item of opts.checks) {
    console.log(`  - ${item}`);
  }
  console.log(`操作前スクショ: ${beforePath}`);
  console.log("ブラウザ上で自由に操作して確認できます");
  console.log("Enterで次の自動ステップへ");
  console.log(`${line}\n`);
  await waitForReviewEnter();
  await page.bringToFront();
  await page.screenshot({ path: afterPath, fullPage: true });
  console.log(`操作後スクショ: ${afterPath}`);
  return { before: beforePath, after: afterPath };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ screen: string, checks: string[], slug: string } | null} reviewOpts
 * @param {string} visualLabel
 * @param {'checkpoint'|'nav'|'state'|'modal'|'complete'|'chat'} [visualKind]
 */
async function hold(page, reviewOpts, visualLabel, visualKind = "checkpoint") {
  if (CLI.interactiveReview && reviewOpts && INTERACTIVE_STOP_SLUGS.has(reviewOpts.slug)) {
    await interactiveReviewCheckpoint(page, reviewOpts);
    return;
  }
  if (CLI.manualReview && reviewOpts && !CLI.interactiveReview) {
    await manualReviewCheckpoint(page, reviewOpts);
    return;
  }
  await visualHold(page, visualLabel, visualKind);
}



/**

 * @param {import('playwright').Page} page

 * @param {string} text

 */

async function sendTalkMessage(page, text) {

  const input = page.locator("#chatInput");

  await input.waitFor({ state: "visible", timeout: 12000 });

  if (await input.isDisabled()) {

    throw new Error("composer disabled");

  }

  await input.fill(text);

  await page.locator("#chatSend").click();

  await pause(page, CLI.visualSlow ? TIMING.pauseChat : 500);

}



/** @param {string} threadId @param {{ builderFlow?: string, builderRole?: string }} [opts] */

function talkUrl(threadId, opts = {}) {

  const q = new URLSearchParams({

    thread: threadId,

    from: "builder",

    builderFlow: opts.builderFlow || "ops_partner",

    builderRole: opts.builderRole || "partner",

  });

  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);

}



async function resetOpsPending(page) {

  await page.evaluate(

    ({ mvpKey, projectId, workflowKey, completionKey }) => {

      localStorage.removeItem(workflowKey);

      localStorage.removeItem(completionKey);

      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");

      const idx = (mvp.projects || []).findIndex((p) => p.project_id === projectId);

      if (idx >= 0) {

        mvp.projects[idx] = {

          ...mvp.projects[idx],

          assignment_status: "pending",

          main_thread_id: null,

        };

        localStorage.setItem(mvpKey, JSON.stringify(mvp));

      }

    },

    {

      mvpKey: MVP_KEY,

      projectId: BUILDER_DEMO_PROJECT_ID,

      workflowKey: WORKFLOW_KEY,

      completionKey: COMPLETION_KEY,

    }

  );

}



async function seedNormalChat(page) {

  await page.evaluate(() => {

    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");

    const list = Array.isArray(threads) ? threads.filter((t) => t.id !== "verify-normal-chat") : [];

    list.push({

      id: "verify-normal-chat",

      chatDomain: "work",

      threadKind: "listing_inquiry",

      listingTitle: "通常出品テスト",

      partner: { displayName: "出品者A" },

      status: "active",

      roomStatus: "active",

      lastMessage: "通常メッセージ",

      updatedAt: new Date().toISOString(),

    });

    localStorage.setItem("tasful_chat_threads", JSON.stringify(list));

    const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");

    msgs["verify-normal-chat"] = [

      {

        id: "m-normal-1",

        senderId: "u1",

        senderName: "出品者A",

        text: "こんにちは（通常チャット）",

        createdAt: new Date().toISOString(),

        kind: "text",

      },

    ];

    localStorage.setItem("tasful_chat_messages", JSON.stringify(msgs));

  });

}



async function resetContactThreads(page) {

  await page.evaluate(

    ({ mvpKey, chatKey, revealKey, workflowKey }) => {

      localStorage.removeItem(revealKey);

      localStorage.removeItem(workflowKey);

      const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");

      const threads = { ...(mvp.threads || {}) };

      Object.keys(threads).forEach((id) => {

        const t = threads[id];

        const kind = String(t?.thread_kind || t?.thread_type || "");

        if (kind === "worker_contact" || kind === "vendor_contact") delete threads[id];

      });

      mvp.threads = threads;

      localStorage.setItem(mvpKey, JSON.stringify(mvp));

      const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");

      const filtered = (Array.isArray(chat) ? chat : []).filter((row) => {

        const k = String(row?.threadKind || row?.builderThreadType || "");

        return k !== "worker_contact" && k !== "vendor_contact";

      });

      localStorage.setItem(chatKey, JSON.stringify(filtered));

    },

    {

      mvpKey: MVP_KEY,

      chatKey: CHAT_THREADS_KEY,

      revealKey: CONTACT_REVEAL_KEY,

      workflowKey: WORKFLOW_KEY,

    }

  );

}



async function seedGeneralProjectThread(page) {

  await page.evaluate(

    ({ workflowKey, completionKey, revealKey }) => {

      localStorage.removeItem(workflowKey);

      localStorage.removeItem(completionKey);

      localStorage.removeItem(revealKey);

      const threads = [

        {

          id: "verify-general-project",

          chatDomain: "builder",

          threadKind: "project_thread",

          builderFlow: "partner_user",

          projectId: "builder_demo_001",

          listingId: "builder_demo_001",

          listingTitle: "一般案件テスト — 内装",

          partner: { displayName: "株式会社オレンジ建装", partnerId: "demo-partner-001" },

          contactTargetId: "demo-partner-001",

          source: "builder-mvp",

          status: "active",

          roomStatus: "active",

          lastMessage: "案件スレッド",

          updatedAt: new Date().toISOString(),

        },

      ];

      localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));

      localStorage.setItem(

        "tasful_chat_messages",

        JSON.stringify({ "verify-general-project": [] })

      );

    },

    { workflowKey: WORKFLOW_KEY, completionKey: COMPLETION_KEY, revealKey: CONTACT_REVEAL_KEY }

  );

}



/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowOpsCaseManualReviewFlow(page, vpLabel) {
  const flow = "運営案件";
  /** @type {{ threadId?: string, meta?: object, steps: object[], ownerPage?: import('playwright').Page | null }} */
  const ctx = { steps: [], ownerPage: null };

  try {
    await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await pause(page, 400);
    await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 12000 });
    logStep(vpLabel, flow, "admin-calendar 表示", "pass");

    await resetOpsPending(page);
    await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await pause(page, 400);
    await page.locator('[data-builder-pc-source="partner"]').click();
    await pause(page, 400);
    const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");
    await embed.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 12000 });
    const day10 = currentMonthDay10();
    await embed.locator(`[data-admin-cal-date="${day10}"]`).click();
    await embed.locator('[data-admin-cal-view="day"]').click();
    await pause(page, 400);

    const badge = embed.locator(".admin-cal-badge").filter({ hasText: BUILDER_DEMO_PROJECT_LABEL }).first();
    if ((await badge.count()) < 1) {
      logStep(vpLabel, flow, "パートナー案件表示", "fail", "Builderデモ案件バッジなし");
      return;
    }
    logStep(vpLabel, flow, "パートナー案件表示", "pass");
    console.log("\n[manual-review-flow] セットアップ完了 — 以降は手動操作 + Enter で状態確認");

    for (const step of MANUAL_REVIEW_FLOW_ADMIN_STEPS) {
      const result = await manualReviewFlowCheckpoint(page, step, vpLabel, flow, ctx);
      ctx.steps.push({
        slug: step.slug,
        ok: result.ok,
        phase: result.probe.phase,
        minPhase: step.minPhase,
        png: result.pngPath,
        json: result.jsonPath,
      });
      if (!result.ok) return;
    }

    const threadId = String(ctx.threadId || "");
    if (threadId) {
      await gotoTalkIfNeeded(page, threadId, "partner");
      const msgText = await page.locator("#chatMessages").textContent();
      if (/入場しました/.test(msgText || "") && /退場しました/.test(msgText || "") && /運営が完了を承認/.test(msgText || "")) {
        logStep(vpLabel, flow, "system + 通常メッセージ混在", "pass");
      } else {
        logStep(vpLabel, flow, "system + 通常メッセージ混在", "fail");
      }
    }

    if ((await page.locator("[data-builder-mvp-thread-form]").count()) > 0) {
      logStep(vpLabel, flow, "Builder内チャットUIなし", "fail");
    } else {
      logStep(vpLabel, flow, "Builder内チャットUIなし", "pass");
    }

    manualFlowReports.push({
      viewport: vpLabel,
      capturedAt: new Date().toISOString(),
      steps: ctx.steps,
    });
  } catch (err) {
    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));
  }
}

/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowOpsCase(page, vpLabel) {

  const flow = "運営案件";

  if (CLI.manualReviewFlow) {
    return flowOpsCaseManualReviewFlow(page, vpLabel);
  }

  try {

    await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    await pause(page);

    await page.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 12000 });

    logStep(vpLabel, flow, "admin-calendar 表示", "pass");



    await resetOpsPending(page);

    await page.goto(partnerUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    await pause(page);

    await page.locator('[data-builder-pc-source="partner"]').click();

    await pause(page, CLI.visualSlow ? TIMING.pause : 400);

    const embed = page.locator("[data-builder-cal-partner][data-admin-cal-embed]");

    await embed.locator(".admin-cal-monthHead").waitFor({ state: "visible", timeout: 12000 });



    const day10 = currentMonthDay10();

    await embed.locator(`[data-admin-cal-date="${day10}"]`).click();

    await embed.locator('[data-admin-cal-view="day"]').click();

    await pause(page);



    const badge = embed.locator(".admin-cal-badge").filter({ hasText: BUILDER_DEMO_PROJECT_LABEL }).first();

    if ((await badge.count()) < 1) {

      logStep(vpLabel, flow, "パートナー案件表示", "fail", "Builderデモ案件バッジなし");

      return;

    }

    logStep(vpLabel, flow, "パートナー案件表示", "pass");

    await hold(
      page,
      {
        screen: "Builder カレンダー（パートナー）",
        checks: [
          "デモ案件「店舗内装リニューアル（Builder）」が表示されている",
          "日付・案件バッジが読みやすい",
          "Builder 内チャット UI が表示されていない",
        ],
        slug: "calendar",
      },
      "Builder カレンダー表示",
      "checkpoint"
    );

    if (CLI.interactiveReview) {
      const opened = await smartOpenAdminProjectFromCalendar(page, vpLabel, flow);
      if (!opened.ok) return;
    } else {
      await badge.click();
      await pause(page);
    }



    const acceptBtn = embed.locator("[data-partner-cal-accept]");

    if ((await acceptBtn.count()) < 1 && !(CLI.interactiveReview)) {

      logStep(vpLabel, flow, "受ける", "fail", "ボタンなし");

      return;

    }

    await hold(
      page,
      {
        screen: "案件詳細 · 「受ける」直前",
        checks: [
          "案件詳細が表示されている",
          "「受ける」ボタンが見える",
          "誤タップしそうな UI がない",
        ],
        slug: "before-accept",
      },
      "「受ける」を押す直前",
      "checkpoint"
    );

    let meta;
    if (CLI.interactiveReview) {
      meta = await smartClickAccept(page, embed, vpLabel, flow);
    } else {
      await acceptBtn.click();
      await visualHold(page, "受ける 押下後", "state");
      meta = await page.evaluate(
        ({ mvpKey, projectId, chatKey }) => {
          const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
          const project = (mvp.projects || []).find((p) => p.project_id === projectId);
          const threadId = project?.main_thread_id || null;
          const chat = JSON.parse(localStorage.getItem(chatKey) || "[]");
          const inTalk = (chat || []).some((t) => String(t.id) === String(threadId));
          return { assignment_status: project?.assignment_status, threadId, inTalk };
        },
        { mvpKey: MVP_KEY, projectId: BUILDER_DEMO_PROJECT_ID, chatKey: CHAT_THREADS_KEY }
      );
      if (meta.assignment_status === "accepted" && meta.threadId) {
        logStep(vpLabel, flow, "受ける + threadId 保存", "pass", meta.threadId);
      } else {
        logStep(vpLabel, flow, "受ける + threadId 保存", "fail", JSON.stringify(meta));
        return;
      }
      if (meta.inTalk) logStep(vpLabel, flow, "Talk 同期", "pass");
      else logStep(vpLabel, flow, "Talk 同期", "fail");
    }

    if (!meta?.threadId || meta.assignment_status !== "accepted") return;

    const threadId = meta.threadId;

    if (CLI.interactiveReview) {
      await gotoTalkIfNeeded(page, threadId, "partner");
    } else {
      await page.goto(talkUrl(threadId, { builderFlow: "ops_partner", builderRole: "partner" }), {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
    }

    await hold(
      page,
      {
        screen: "Talk 遷移直後（パートナー）",
        checks: [
          "Talk 画面に遷移している",
          "ワークフローパネルが表示されている",
          "URL に thread パラメータがある",
        ],
        slug: "talk-open",
      },
      "Talk へ遷移（パートナー）",
      "nav"
    );

    if (CLI.interactiveReview && !(await assertOnTalkWorkflow(page, threadId, "talk-open"))) return;

    logStep(vpLabel, flow, "Talk を開く", "pass", page.url());

    const kindText = (await page.locator("#talkBuilderWorkflowKind").textContent())?.trim() || "";

    if (/運営案件/.test(kindText)) logStep(vpLabel, flow, "運営案件ヘッダー", "pass", kindText);
    else logStep(vpLabel, flow, "運営案件ヘッダー", "fail", kindText);

    await hold(
      page,
      {
        screen: "運営案件ヘッダー",
        checks: [
          "「運営案件」と表示されている",
          "550円 連絡先開示ゲートが表示されていない",
          "ステータスバッジが「受諾済み」相当",
        ],
        slug: "workflow-header",
      },
      "運営案件ヘッダー",
      "checkpoint"
    );



    if (await page.locator("#talkBuilderContactRevealHost").isVisible()) {

      logStep(vpLabel, flow, "550円ゲートなし（運営案件）", "fail", "開示ゲート表示");

    } else {

      logStep(vpLabel, flow, "550円ゲートなし（運営案件）", "pass");

    }



    await visualHold(page, "パートナー: 会話送信前", "chat");

    await sendTalkMessage(page, "本日予定通り向かいます。");

    logStep(vpLabel, flow, "パートナー会話", "pass");



    await page.goto(talkUrl(threadId, { builderFlow: "ops_partner", builderRole: "owner" }), {

      waitUntil: "domcontentloaded",

    });

    await pause(page);

    await visualHold(page, "運営: 会話送信前", "chat");

    await sendTalkMessage(page, "到着したら入場をお願いします。");

    logStep(vpLabel, flow, "運営会話", "pass");



    await page.goto(talkUrl(threadId, { builderFlow: "ops_partner", builderRole: "partner" }), {

      waitUntil: "domcontentloaded",

    });

    await pause(page);



    const adminTransitions = [
      {
        expect: /受諾済み|入場/,
        expectAfter: /入場済み/,
        nextLabel: "入場",
        nextStatus: "entered",
        after: "entered",
        stepName: "入場",
        manualBefore: {
          screen: "入場前",
          checks: ["「入場」ボタンが表示されている", "入退場が必須フローであることが分かる"],
          slug: "before-enter",
        },
        manualAfter: {
          screen: "入場後",
          checks: ["ステータスが「入場済み」", "次は「退場」アクション"],
          slug: "after-enter",
        },
      },
      {
        expect: /入場済み/,
        expectAfter: /退場済み/,
        nextLabel: "退場",
        nextStatus: "exited",
        after: "exited",
        stepName: "退場",
        manualBefore: {
          screen: "退場前",
          checks: ["「入場済み」状態", "「退場」ボタンが表示されている"],
          slug: "before-exit",
        },
        manualAfter: {
          screen: "退場後",
          checks: ["ステータスが「退場済み」", "「入場」「完了報告」ボタンが表示されている"],
          slug: "after-exit",
        },
      },
    ];

    for (const t of adminTransitions) {
      const badgeText = await readWorkflowBadge(page);
      if (t.expect.test(badgeText)) logStep(vpLabel, flow, `状態: ${t.after}`, "pass", badgeText);
      else logStep(vpLabel, flow, `状態: ${t.after}`, "fail", badgeText);

      if (CLI.interactiveReview) {
        if (t.manualBefore) {
          await hold(page, t.manualBefore, `「${t.nextLabel}」押下前`, "checkpoint");
        }
        const ok = await smartWorkflowClick(page, vpLabel, flow, t.stepName, t.nextStatus, t.expectAfter);
        if (!ok) return;
        if (t.manualAfter) {
          await hold(page, t.manualAfter, t.after, "state");
        }
        continue;
      }

      const nextBtn = page.locator(`[data-talk-builder-next][data-next-status="${t.nextStatus}"]`).first();
      if (!(await nextBtn.isVisible())) {
        logStep(vpLabel, flow, `次アクション (${t.after})`, "fail", "ボタン非表示");
        return;
      }

      if (t.manualBefore) {
        await hold(page, t.manualBefore, `「${t.nextLabel}」押下前`, "checkpoint");
      } else {
        await visualHold(page, `「${t.nextLabel}」押下前`, "checkpoint");
      }

      await nextBtn.click();
      await visualHold(page, `${t.after} 後`, "state");

      if (t.manualAfter) {
        await hold(page, t.manualAfter, t.after, "state");
      }
    }

    if (reviewModeActive()) {
      await hold(
        page,
        {
          screen: "再入場前",
          checks: ["「退場済み」状態", "「入場」ボタンが表示されている"],
          slug: "before-re-enter",
        },
        "再入場前",
        "checkpoint"
      );

      if (CLI.interactiveReview) {
        if (!(await smartWorkflowClick(page, vpLabel, flow, "再入場", "entered", /入場済み/))) return;
      } else {
        await page.locator('[data-talk-builder-next][data-next-status="entered"]').click();
        await visualHold(page, "再入場後", "state");
        logStep(vpLabel, flow, "再入場", "pass");
      }

      await hold(
        page,
        {
          screen: "再入場後",
          checks: ["ステータスが「入場済み」", "再度「退場」が可能"],
          slug: "after-re-enter",
        },
        "再入場後",
        "state"
      );

      if (CLI.interactiveReview) {
        if (!(await smartWorkflowClick(page, vpLabel, flow, "再退場", "exited", /退場済み/))) return;
      } else {
        await page.locator('[data-talk-builder-next][data-next-status="exited"]').click();
        await visualHold(page, "再退場後", "state");
        logStep(vpLabel, flow, "再退場", "pass");
      }

      await hold(
        page,
        {
          screen: "再退場後",
          checks: ["ステータスが「退場済み」", "「完了報告」ボタンが表示されている"],
          slug: "after-re-exit",
        },
        "再退場後",
        "state"
      );
    } else {
      await page.locator('[data-talk-builder-next][data-next-status="entered"]').click();
      await visualHold(page, "再入場後", "state");
      logStep(vpLabel, flow, "再入場", "pass");
      await page.locator('[data-talk-builder-next][data-next-status="exited"]').click();
      await visualHold(page, "再退場後", "state");
      logStep(vpLabel, flow, "再退場", "pass");
    }



    await visualHold(page, "作業完了メッセージ前", "chat");

    await sendTalkMessage(page, "作業完了しました。写真を添付して報告します。");

    logStep(vpLabel, flow, "完了前会話", "pass");



    if (reviewModeActive()) {
      await hold(
        page,
        {
          screen: "完了報告モーダル前",
          checks: [
            "「完了報告」ボタンが表示されている",
            "入退場履歴が記録されている",
            "モーダルを開いて報告できる状態",
          ],
          slug: "before-completion-modal",
        },
        "完了報告モーダル前",
        "checkpoint"
      );
    }

    if (CLI.interactiveReview) {
      if (!(await smartOpenCompletionModal(page))) {
        await saveReviewError(page, "before-completion-modal", "modal not open");
        logStep(vpLabel, flow, "完了報告モーダル", "fail", "モーダル非表示");
        return;
      }
      await smartFillCompletionIfNeeded(page);
    } else {
      await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();
      await page.locator("#talkBuilderCompletionWork").waitFor({ state: "visible", timeout: 8000 });
      if (CLI.manualReview) {
        await hold(
          page,
          {
            screen: "完了報告モーダル",
            checks: [
              "完了報告モーダルが開いている",
              "作業内容入力欄がある",
              "写真添付欄がある",
            ],
            slug: "completion-modal",
          },
          "完了報告モーダル",
          "modal"
        );
      }
      await page.locator("#talkBuilderCompletionWork").fill("内装完了（headed確認）");
      await page.locator("#talkBuilderCompletionPhotos").setInputFiles(COMPLETION_PHOTO);
    }

    await hold(
      page,
      {
        screen: "完了写真添付後",
        checks: [
          "作業内容が入力されている",
          "完了写真が添付されている",
          "送信ボタンが押せる状態",
        ],
        slug: "completion-photo-attached",
      },
      "完了写真添付後",
      "modal"
    );

    if (CLI.interactiveReview) {
      await smartSubmitCompletionIfNeeded(page);
      const ok = await runInteractiveOpsApprovalReview(page, threadId, vpLabel, flow);
      if (!ok) return;
    } else {
      await page.locator("#talkBuilderCompletionSubmit").click();
      await pause(page, TIMING.pauseState);

      await hold(
        page,
        {
          screen: "完了報告送信後",
          checks: [
            "モーダルが閉じている",
            "ステータスが「運営承認待ち」に変わっている",
            "パートナー側に承認ボタンがない",
          ],
          slug: "completion-reported",
        },
        "完了報告送信後",
        "complete"
      );

      const afterReport = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";

      if (/運営承認待ち/.test(afterReport)) logStep(vpLabel, flow, "ops_confirming", "pass");

      else logStep(vpLabel, flow, "ops_confirming", "fail", afterReport);

      if (await page.locator("[data-talk-builder-next]").first().isVisible()) {
        logStep(vpLabel, flow, "パートナーは承認不可", "fail", "承認ボタン表示");
      } else {
        logStep(vpLabel, flow, "パートナーは承認不可", "pass");
      }

      await hold(
        page,
        {
          screen: "運営承認待ち（パートナー視点）",
          checks: [
            "「運営承認待ち」ステータス",
            "パートナーは承認できない",
            "会話履歴に完了報告が反映されている",
          ],
          slug: "ops-confirming",
        },
        "運営承認待ち",
        "checkpoint"
      );

      await page.goto(talkUrl(threadId, { builderFlow: "ops_partner", builderRole: "owner" }), {
        waitUntil: "domcontentloaded",
      });

      await pause(page);

      await hold(
        page,
        {
          screen: "運営承認前（オーナー視点）",
          checks: [
            "「運営承認待ち」状態",
            "完了報告カードに作業内容・完了写真が表示されている",
            "「承認」ボタンが表示されている（上部またはカード内）",
            "運営のみが承認できる",
          ],
          slug: "before-ops-approve",
        },
        "運営承認前",
        "checkpoint"
      );

      const completionCard = completionReportCardLocator(page);
      if (await completionCard.isVisible().catch(() => false)) {
        logStep(vpLabel, flow, "owner completion report card", "pass");
      } else {
        logStep(vpLabel, flow, "owner completion report card", "fail", "非表示");
        return;
      }

      const approveBtn = ownerApproveButtonLocator(page);

      if (!(await approveBtn.isVisible())) {
        logStep(vpLabel, flow, "運営承認ボタン", "fail", "非表示");
        return;
      }

      if (!/承認/.test((await approveBtn.textContent()) || "")) {
        logStep(vpLabel, flow, "運営承認ボタン", "fail", await approveBtn.textContent());
        return;
      }

      await approveBtn.click();

      await hold(
        page,
        {
          screen: "completed 表示",
          checks: [
            "ステータスが「完了」",
            "入場・退場・承認の system メッセージが混在",
            "Builder 内チャット UI がない",
          ],
          slug: "completed",
        },
        "completed 表示",
        "complete"
      );

      const completed = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";

      if (/完了/.test(completed)) logStep(vpLabel, flow, "completed（運営承認）", "pass");

      else logStep(vpLabel, flow, "completed（運営承認）", "fail", completed);
    }

    const msgText = await page.locator("#chatMessages").textContent();

    if (/入場しました/.test(msgText || "") && /退場しました/.test(msgText || "") && /運営が完了を承認/.test(msgText || "")) {

      logStep(vpLabel, flow, "system + 通常メッセージ混在", "pass");

    } else {

      logStep(vpLabel, flow, "system + 通常メッセージ混在", "fail");

    }



    if ((await page.locator("[data-builder-mvp-thread-form]").count()) > 0) {

      logStep(vpLabel, flow, "Builder内チャットUIなし", "fail");

    } else {

      logStep(vpLabel, flow, "Builder内チャットUIなし", "pass");

    }

  } catch (err) {

    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));

  }

}



/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string, userPage?: import('playwright').Page | null }} ctx
 * @param {typeof MANUAL_REVIEW_FLOW_GENERAL_STEPS[number]} step
 */
async function driveGeneralManualFlowStep(page, ctx, step) {
  const tid = String(ctx.threadId || GENERAL_THREAD_ID);
  const userTalk = talkUrl(tid, { builderFlow: "partner_user", builderRole: "user" });
  const partnerTalk = talkUrl(tid, { builderFlow: "partner_user", builderRole: "partner" });
  const boardProjects = buildLocalPageUrl(base, "builder/board-projects.html");

  switch (step.slug) {
    case "board-projects":
      await page.goto(boardProjects, { waitUntil: "domcontentloaded", timeout: 25000 });
      await pause(page, 400);
      break;
    case "user-before-reveal":
      await page.goto(userTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
      break;
    case "user-after-reveal": {
      await page.goto(userTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
      if (await page.locator("#chatInput").isDisabled()) {
        page.once("dialog", (d) => d.accept());
        await page.locator("[data-builder-contact-reveal]").first().click();
        await pause(page, TIMING.pauseState);
      }
      await sendTalkMessage(page, "日程はこの日で大丈夫ですか？").catch(() => null);
      break;
    }
    case "partner-talk":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
      await sendTalkMessage(page, "大丈夫です。到着前に連絡します。").catch(() => null);
      break;
    case "partner-started":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator('[data-talk-builder-next][data-next-status="started"]').first().click();
      await pause(page, TIMING.pauseState);
      break;
    case "partner-working":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator('[data-talk-builder-next][data-next-status="working"]').first().click();
      await pause(page, TIMING.pauseState);
      break;
    case "before-completion-modal":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("#talkBuilderWorkflowStatusBadge").waitFor({ state: "visible", timeout: 12000 });
      break;
    case "completion-photo-attached":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').first().click();
      await page.locator("#talkBuilderCompletionWork").waitFor({ state: "visible", timeout: 8000 });
      await page.locator("#talkBuilderCompletionWork").fill("壁紙張替え完了（一般案件 manual review）");
      await page.locator("#talkBuilderCompletionPhotos").setInputFiles([COMPLETION_PHOTO, COMPLETION_PHOTO_B]);
      await dropFilesOnCompletionZone(page, [
        { name: "drop-general-manual.png", mime: "image/png", path: COMPLETION_PHOTO },
      ]);
      await pause(page, 300);
      break;
    case "partner-completion-reported":
      if (await page.locator("#talkBuilderCompletionModal").isVisible().catch(() => false)) {
        await page.locator("#talkBuilderCompletionSubmit").click();
        await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 15000 });
      }
      await pause(page, TIMING.pauseState);
      break;
    case "user-talk-open":
    case "user-before-approve": {
      const userPage = await ensureManualFlowUserTab(page, ctx);
      if (userPage) await userPage.bringToFront();
      break;
    }
    case "user-after-approve": {
      const userPage = ctx.userPage || (await ensureManualFlowUserTab(page, ctx));
      if (userPage) {
        await userPage.bringToFront();
        const approve = userPage.locator('[data-talk-builder-next][data-next-status="completed"]').first();
        if (await approve.isVisible().catch(() => false)) {
          await approve.click();
          await pause(userPage, TIMING.pauseState);
        }
      }
      break;
    }
    case "partner-completed":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });
      break;
    case "fee-policy":
      await page.goto(partnerTalk, { waitUntil: "domcontentloaded", timeout: 25000 });
      break;
    default:
      break;
  }
}

/** @param {import('playwright').Page} page @param {string} vpLabel */
async function flowGeneralProjectManualReviewFlow(page, vpLabel) {
  const flow = "一般案件";
  /** @type {{ threadId?: string, flowKind: string, steps: object[], userPage?: import('playwright').Page | null }} */
  const ctx = { flowKind: "general", steps: [], threadId: GENERAL_THREAD_ID, userPage: null };

  try {
    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await seedGeneralProjectThread(page);
    await page.goto(buildLocalPageUrl(base, "builder/board-projects.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await pause(page, 400);
    logStep(vpLabel, flow, "board-projects 表示", "pass");
    console.log("\n[manual-review-flow] セットアップ完了 — 以降は手動操作 + Enter で状態確認");
    console.log(`threadId: ${GENERAL_THREAD_ID} · builderFlow: partner_user`);

    for (const step of MANUAL_REVIEW_FLOW_GENERAL_STEPS) {
      if (process.env.REVIEW_AUTO_DRIVE === "1") {
        await driveGeneralManualFlowStep(page, ctx, step);
      }
      const result = await manualReviewFlowCheckpoint(page, step, vpLabel, flow, ctx);
      ctx.steps.push({
        slug: step.slug,
        ok: result.ok,
        phase: result.probe?.phase,
        minPhase: step.minPhase,
        png: result.pngPath,
        json: result.jsonPath,
      });
      if (!result.ok) return;
    }

    manualFlowReports.push({
      viewport: vpLabel,
      capturedAt: new Date().toISOString(),
      flow: "general",
      steps: ctx.steps,
    });
  } catch (err) {
    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));
  }
}



/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowGeneralProject(page, vpLabel) {

  const flow = "一般案件";

  if (CLI.manualReviewFlow) {
    return flowGeneralProjectManualReviewFlow(page, vpLabel);
  }

  try {

    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    await seedGeneralProjectThread(page);

    await page.goto(

      buildLocalPageUrl(

        base,

        "chat-detail.html?thread=verify-general-project&from=builder&builderFlow=partner_user&builderRole=user"

      ),

      { waitUntil: "domcontentloaded", timeout: 25000 }

    );

    await pause(page);

    await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 12000 });



    const revealHost = page.locator("#talkBuilderContactRevealHost");

    if (await revealHost.isVisible()) {

      const revealText = (await revealHost.textContent()) || "";

      if (/550|連絡先開示/.test(revealText) && /チャット料金ではありません/.test(revealText)) {

        logStep(vpLabel, flow, "550円 連絡先開示ゲート", "pass");

      } else {

        logStep(vpLabel, flow, "550円 連絡先開示ゲート", "fail", revealText.slice(0, 80));

      }

    } else {

      logStep(vpLabel, flow, "550円 連絡先開示ゲート", "fail", "非表示");

    }



    if (await page.locator("#chatInput").isDisabled()) {
      logStep(vpLabel, flow, "開示前 composer ロック", "pass");
    } else {
      logStep(vpLabel, flow, "開示前 composer ロック", "fail");
    }

    await hold(
      page,
      {
        screen: "一般案件 · 550円 連絡先開示前",
        checks: [
          "550円 連絡先開示ゲートが表示されている",
          "「チャット料金ではありません」の注記がある",
          "開示前は composer がロックされている",
        ],
        slug: "general-before-reveal",
      },
      "550円 開示前",
      "modal"
    );

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-builder-contact-reveal]").first().click();
    await pause(page, TIMING.pauseState);

    if (!(await page.locator("#chatInput").isDisabled())) {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "pass");
    } else {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "fail");
    }

    await hold(
      page,
      {
        screen: "一般案件 · 550円 連絡先開示後",
        checks: [
          "連絡先開示ゲートが解消されている",
          "composer が有効化されている",
          "Talk でメッセージ送信できる",
        ],
        slug: "general-after-reveal",
      },
      "550円 開示後",
      "state"
    );



    await visualHold(page, "依頼者: 日程確認", "chat");

    await sendTalkMessage(page, "日程はこの日で大丈夫ですか？");

    logStep(vpLabel, flow, "依頼者会話", "pass");



    await page.goto(

      buildLocalPageUrl(

        base,

        "chat-detail.html?thread=verify-general-project&from=builder&builderFlow=partner_user&builderRole=partner"

      ),

      { waitUntil: "domcontentloaded" }

    );

    await pause(page);

    await visualHold(page, "作業者: 返信", "chat");

    await sendTalkMessage(page, "大丈夫です。到着前に連絡します。");

    logStep(vpLabel, flow, "作業者会話", "pass");



    const projectTransitions = [

      { expect: /受諾済み|作業開始/, label: "started", nextStatus: "started" },

      { expect: /作業開始|施工中/, label: "working", nextStatus: "working" },

    ];

    for (const t of projectTransitions) {

      const badgeText = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";

      if (t.expect.test(badgeText)) logStep(vpLabel, flow, `状態: ${t.label}`, "pass", badgeText);

      else logStep(vpLabel, flow, `状態: ${t.label}`, "fail", badgeText);

      await page.locator(`[data-talk-builder-next][data-next-status="${t.nextStatus}"]`).click();

      await pause(page, TIMING.pauseState);

    }



    await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();

    await page.locator("#talkBuilderCompletionWork").waitFor({ state: "visible", timeout: 8000 });

    await page.locator("#talkBuilderCompletionWork").fill("壁紙張替え完了（一般案件）");

    await page.locator("#talkBuilderCompletionPhotos").setInputFiles([COMPLETION_PHOTO, COMPLETION_PHOTO_B]);

    await dropFilesOnCompletionZone(page, [
      { name: "drop-general.png", mime: "image/png", path: COMPLETION_PHOTO },
    ]);

    await pause(page, 300);

    await page.locator("#talkBuilderCompletionSubmit").click();

    await visualHold(page, "完了報告後", "complete");



    const confirming = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";

    if (/依頼者確認待ち/.test(confirming)) logStep(vpLabel, flow, "client_confirming", "pass");

    else logStep(vpLabel, flow, "client_confirming", "fail", confirming);



    if (await page.locator("[data-talk-builder-next]").first().isVisible()) {

      logStep(vpLabel, flow, "作業者は承認不可", "fail");

    } else {

      logStep(vpLabel, flow, "作業者は承認不可", "pass");

    }



    await page.goto(

      buildLocalPageUrl(

        base,

        "chat-detail.html?thread=verify-general-project&from=builder&builderFlow=partner_user&builderRole=user"

      ),

      { waitUntil: "domcontentloaded" }

    );

    await pause(page);

    const completionCard = completionReportCardLocator(page);
    if (await completionCard.isVisible().catch(() => false)) {
      logStep(vpLabel, flow, "user completion report card", "pass");
    } else {
      logStep(vpLabel, flow, "user completion report card", "fail", "非表示");
      return;
    }

    const cardText = (await completionCard.textContent()) || "";
    if (/壁紙張替え完了/.test(cardText)) logStep(vpLabel, flow, "user sees work content", "pass");
    else logStep(vpLabel, flow, "user sees work content", "fail");

    const userThumb = page.locator("[data-talk-builder-completion-photo-thumb] img");
    if ((await userThumb.count()) >= 1) logStep(vpLabel, flow, "user sees photo thumbnail", "pass");
    else logStep(vpLabel, flow, "user sees photo thumbnail", "fail");

    if ((await userThumb.count()) >= 1) {
      await userThumb.first().click();
      await pause(page, 300);
      if (await page.locator("#talkBuilderCompletionPhotoLightbox").isVisible()) {
        logStep(vpLabel, flow, "user photo lightbox", "pass");
      } else {
        logStep(vpLabel, flow, "user photo lightbox", "fail");
      }
      await page.locator(".talk-builder-completion-photo-lightbox__close").click().catch(() => null);
    }

    await ownerApproveButtonLocator(page).click();



    const done = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";

    if (/完了/.test(done)) logStep(vpLabel, flow, "completed（依頼者承認）", "pass");

    else logStep(vpLabel, flow, "completed（依頼者承認）", "fail", done);

    const billing = await page.evaluate(
      ({ tid, workflowKey, completionKey }) => {
        const gp = window.TasuBuilderBillingPolicy?.POLICY?.generalProject;
        const wf = JSON.parse(localStorage.getItem(workflowKey) || "{}")[tid];
        const report = JSON.parse(localStorage.getItem(completionKey) || "{}")[tid];
        return {
          contactRevealFeeYen: gp?.contactRevealFeeYen,
          commissionPctRange: gp?.commissionPctRange,
          workflowStatus: wf?.status,
          reportPhotoCount: report?.photoCount,
        };
      },
      { tid: GENERAL_THREAD_ID, workflowKey: WORKFLOW_KEY, completionKey: COMPLETION_KEY }
    );
    if (billing.contactRevealFeeYen === 550) logStep(vpLabel, flow, "550円 開示料", "pass");
    else logStep(vpLabel, flow, "550円 開示料", "fail", JSON.stringify(billing));
    if (
      Array.isArray(billing.commissionPctRange) &&
      billing.commissionPctRange[0] === 5 &&
      billing.commissionPctRange[1] === 10
    ) {
      logStep(vpLabel, flow, "手数料 5〜10%", "pass");
    } else {
      logStep(vpLabel, flow, "手数料 5〜10%", "fail", JSON.stringify(billing.commissionPctRange));
    }
    if (Number(billing.reportPhotoCount) >= 2) logStep(vpLabel, flow, "複数写真保存", "pass");
    else logStep(vpLabel, flow, "複数写真保存", "fail", String(billing.reportPhotoCount));

  } catch (err) {

    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));

  }

}



/** @param {import('playwright').Page} page @param {string} vpLabel */
async function flowWorkerSearchManualReviewFlow(page, vpLabel) {
  const flow = "ワーカー検索";
  /** @type {{ threadId?: string, flowKind: string, steps: object[], workerPartnerPage?: import('playwright').Page | null }} */
  const ctx = { flowKind: "worker", steps: [], workerPartnerPage: null };

  try {
    resetManualStepCounter();
    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    logStep(vpLabel, flow, "builder-top 表示", "pass");
    console.log("\n[manual-review-flow] セットアップ完了 — 以降は手動操作 + Enter で状態確認");
    console.log("flow: worker_contact · 案件 workflow なし");

    for (const step of MANUAL_REVIEW_FLOW_WORKER_STEPS) {
      if (process.env.REVIEW_AUTO_DRIVE === "1") {
        await driveWorkerManualFlowStep(page, ctx, step);
      }
      const result = await manualReviewFlowCheckpoint(page, step, vpLabel, flow, ctx);
      ctx.steps.push({
        slug: step.slug,
        ok: result.ok,
        phase: result.probe?.phase,
        minPhase: step.minPhase,
        png: result.pngPath,
        json: result.jsonPath,
      });
      if (!result.ok) return;
      if (result.probe?.threadId) ctx.threadId = result.probe.threadId;
    }

    await logWorkerContactNegativeChecks(page, vpLabel, flow);
    const diag = await readWorkerContactDiagnostics(page, String(ctx.threadId || ""));
    if (diag.workerSearch?.contactRevealFeeYen === 550) logStep(vpLabel, flow, "550円 開示料", "pass");
    else logStep(vpLabel, flow, "550円 開示料", "fail", JSON.stringify(diag.workerSearch));
    if (diag.threadId && diag.roomId) logStep(vpLabel, flow, "thread / roomId 生成", "pass", diag.threadId);
    else logStep(vpLabel, flow, "thread / roomId 生成", "fail", JSON.stringify(diag));
    if (diag.workerSearch?.completionCommission === false) logStep(vpLabel, flow, "completionCommission false", "pass");
    else logStep(vpLabel, flow, "completionCommission false", "fail");

    manualFlowReports.push({
      viewport: vpLabel,
      capturedAt: new Date().toISOString(),
      flow: "worker",
      steps: ctx.steps,
      diagnostics: diag,
    });
  } catch (err) {
    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));
  }
}

/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowWorkerSearch(page, vpLabel) {

  const flow = "ワーカー検索";

  if (CLI.manualReviewFlow) {
    return flowWorkerSearchManualReviewFlow(page, vpLabel);
  }

  try {

    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    const threadId = await navigateWorkerSearchToTalk(page);

    logStep(vpLabel, flow, "Talk遷移", "pass", threadId || "(no thread)");

    const kindText = (await page.locator("#talkBuilderWorkflowKind").textContent())?.trim() || "";

    if (/ワーカー相談/.test(kindText)) logStep(vpLabel, flow, "ワーカー相談ヘッダー", "pass");

    else logStep(vpLabel, flow, "ワーカー相談ヘッダー", "fail", kindText);



    await logWorkerContactNegativeChecks(page, vpLabel, flow);



    const url = new URL(page.url());

    if (!url.searchParams.get("builderRole")) {

      url.searchParams.set("builderRole", "user");

      await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

    }



    if (await page.locator("#talkBuilderContactRevealHost").isVisible()) {

      const revealText = (await page.locator("#talkBuilderContactRevealHost").textContent()) || "";

      if (/550|連絡先開示/.test(revealText) && /チャット料金ではありません/.test(revealText)) {

        logStep(vpLabel, flow, "550円ゲート表示", "pass");

      } else {

        logStep(vpLabel, flow, "550円ゲート表示", "fail", revealText.slice(0, 80));

      }

    } else {

      logStep(vpLabel, flow, "550円ゲート表示", "fail", "非表示");

    }

    if (await page.locator("#chatInput").isDisabled()) {
      logStep(vpLabel, flow, "開示前 composer ロック", "pass");
    } else {
      logStep(vpLabel, flow, "開示前 composer ロック", "fail");
    }

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-builder-contact-reveal]").first().click();
    await pause(page, TIMING.pauseState);

    if (!(await page.locator("#chatInput").isDisabled())) {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "pass");
    } else {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "fail");
    }

    await sendTalkMessage(page, "ワーカー検索から相談します（headed check）");
    logStep(vpLabel, flow, "通常チャット送信", "pass");

    const diag = await readWorkerContactDiagnostics(page, threadId);
    if (diag.threadId && diag.roomId && diag.partnerUserId) {
      logStep(vpLabel, flow, "thread 同期", "pass", `${diag.threadId} · worker=${diag.partnerUserId}`);
    } else {
      logStep(vpLabel, flow, "thread 同期", "fail", JSON.stringify(diag));
    }

    const partnerForbidden = await probeWorkerForbiddenActions(page);
    if (partnerForbidden.forbiddenButtons.length === 0) {
      logStep(vpLabel, flow, "案件 workflow なし", "pass");
    } else {
      logStep(vpLabel, flow, "案件 workflow なし", "fail");
    }

    if (diag.workerSearch?.contactRevealFeeYen === 550) logStep(vpLabel, flow, "550円 開示料", "pass");
    else logStep(vpLabel, flow, "550円 開示料", "fail", JSON.stringify(diag.workerSearch));
    if (diag.threadId && diag.roomId) logStep(vpLabel, flow, "thread / roomId", "pass", `${diag.threadId}`);
    else logStep(vpLabel, flow, "thread / roomId", "fail");
    if (diag.workerSearch?.completionCommission === false) logStep(vpLabel, flow, "手数料対象外", "pass");
    else logStep(vpLabel, flow, "手数料対象外", "fail");
    if (!diag.hasWorkflowState && !diag.hasCompletionReport) {
      logStep(vpLabel, flow, "workflow/report なし", "pass");
    } else {
      logStep(vpLabel, flow, "workflow/report なし", "fail", JSON.stringify(diag));
    }

  } catch (err) {

    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));

  }

}



/** @param {import('playwright').Page} page @param {string} vpLabel */
async function flowVendorSearchManualReviewFlow(page, vpLabel) {
  const flow = "業者検索";
  /** @type {{ threadId?: string, flowKind: string, steps: object[] }} */
  const ctx = { flowKind: "vendor", steps: [] };

  try {
    resetManualStepCounter();
    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    logStep(vpLabel, flow, "builder-top 表示", "pass");
    console.log("\n[manual-review-flow] セットアップ完了 — 以降は手動操作 + Enter で状態確認");
    console.log("flow: vendor_contact · 案件 workflow なし");

    for (const step of MANUAL_REVIEW_FLOW_VENDOR_STEPS) {
      if (process.env.REVIEW_AUTO_DRIVE === "1") {
        await driveVendorManualFlowStep(page, ctx, step);
      }
      const result = await manualReviewFlowCheckpoint(page, step, vpLabel, flow, ctx);
      ctx.steps.push({
        slug: step.slug,
        ok: result.ok,
        phase: result.probe?.phase,
        minPhase: step.minPhase,
        png: result.pngPath,
        json: result.jsonPath,
      });
      if (!result.ok) return;
      if (result.probe?.threadId) ctx.threadId = result.probe.threadId;
    }

    await logWorkerContactNegativeChecks(page, vpLabel, flow);
    const diag = await readVendorContactDiagnostics(page, String(ctx.threadId || ""));
    if (diag.vendorSearch?.contactRevealFeeYen === 550) logStep(vpLabel, flow, "550円 開示料", "pass");
    else logStep(vpLabel, flow, "550円 開示料", "fail", JSON.stringify(diag.vendorSearch));
    if (diag.threadId && diag.roomId) logStep(vpLabel, flow, "thread / roomId 生成", "pass", diag.threadId);
    else logStep(vpLabel, flow, "thread / roomId 生成", "fail", JSON.stringify(diag));
    if (diag.threadKind === "vendor_contact") logStep(vpLabel, flow, "vendor_contact", "pass");
    else logStep(vpLabel, flow, "vendor_contact", "fail", String(diag.threadKind));
    if (diag.vendorId || diag.partnerUserId) {
      logStep(vpLabel, flow, "vendorId 同期", "pass", String(diag.vendorId || diag.partnerUserId));
    } else {
      logStep(vpLabel, flow, "vendorId 同期", "fail");
    }
    if (diag.vendorSearch?.completionCommission === false) logStep(vpLabel, flow, "completionCommission false", "pass");
    else logStep(vpLabel, flow, "completionCommission false", "fail");

    const badge = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent().catch(() => ""))?.trim() || "";
    if (badge === "相談中") logStep(vpLabel, flow, "badge 相談中", "pass");
    else logStep(vpLabel, flow, "badge 相談中", "fail", badge || "(empty)");

    manualFlowReports.push({
      viewport: vpLabel,
      capturedAt: new Date().toISOString(),
      flow: "vendor",
      steps: ctx.steps,
      diagnostics: diag,
    });
  } catch (err) {
    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));
  }
}

/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowVendorSearch(page, vpLabel) {

  const flow = "業者検索";

  if (CLI.manualReviewFlow) {
    return flowVendorSearchManualReviewFlow(page, vpLabel);
  }

  try {

    const threadId = await navigateVendorSearchToTalk(page);

    logStep(vpLabel, flow, "Talk遷移", "pass", threadId || "(no thread)");

    const kindText = (await page.locator("#talkBuilderWorkflowKind").textContent())?.trim() || "";

    if (/業者相談/.test(kindText)) logStep(vpLabel, flow, "業者相談ヘッダー", "pass");

    else logStep(vpLabel, flow, "業者相談ヘッダー", "fail", kindText);

    await logWorkerContactNegativeChecks(page, vpLabel, flow);

    const url = new URL(page.url());

    if (!url.searchParams.get("builderRole")) {

      url.searchParams.set("builderRole", "user");

      await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

    }

    if (await page.locator("#talkBuilderContactRevealHost").isVisible()) {

      const revealText = (await page.locator("#talkBuilderContactRevealHost").textContent()) || "";

      if (/550|連絡先開示/.test(revealText) && /チャット料金ではありません/.test(revealText)) {

        logStep(vpLabel, flow, "550円ゲート表示", "pass");

      } else {

        logStep(vpLabel, flow, "550円ゲート表示", "fail", revealText.slice(0, 80));

      }

    } else {

      logStep(vpLabel, flow, "550円ゲート表示", "fail", "非表示");

    }

    if (await page.locator("#chatInput").isDisabled()) {
      logStep(vpLabel, flow, "開示前 composer ロック", "pass");
    } else {
      logStep(vpLabel, flow, "開示前 composer ロック", "fail");
    }

    page.once("dialog", (d) => d.accept());
    await page.locator("[data-builder-contact-reveal]").first().click();
    await pause(page, TIMING.pauseState);

    if (!(await page.locator("#chatInput").isDisabled())) {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "pass");
    } else {
      logStep(vpLabel, flow, "開示後 Talk 有効化", "fail");
    }

    const badge = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent())?.trim() || "";
    if (badge === "相談中") logStep(vpLabel, flow, "badge 相談中", "pass");
    else logStep(vpLabel, flow, "badge 相談中", "fail", badge || "(empty)");

    await sendTalkMessage(page, "業者検索から相談します（headed check）");
    logStep(vpLabel, flow, "通常チャット送信", "pass");

    const diag = await readVendorContactDiagnostics(page, threadId);
    if (diag.threadId && diag.roomId && (diag.vendorId || diag.partnerUserId)) {
      logStep(vpLabel, flow, "thread 同期", "pass", `${diag.threadId} · vendor=${diag.vendorId || diag.partnerUserId}`);
    } else {
      logStep(vpLabel, flow, "thread 同期", "fail", JSON.stringify(diag));
    }

    if (diag.vendorSearch?.contactRevealFeeYen === 550) logStep(vpLabel, flow, "550円 開示料", "pass");
    else logStep(vpLabel, flow, "550円 開示料", "fail", JSON.stringify(diag.vendorSearch));
    if (diag.threadKind === "vendor_contact") logStep(vpLabel, flow, "vendor_contact kind", "pass");
    else logStep(vpLabel, flow, "vendor_contact kind", "fail", String(diag.threadKind));
    if (diag.vendorSearch?.completionCommission === false) logStep(vpLabel, flow, "手数料対象外", "pass");
    else logStep(vpLabel, flow, "手数料対象外", "fail");
    if (!diag.hasWorkflowState && !diag.hasCompletionReport) {
      logStep(vpLabel, flow, "workflow/report なし", "pass");
    } else {
      logStep(vpLabel, flow, "workflow/report なし", "fail", JSON.stringify(diag));
    }

  } catch (err) {

    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));

  }

}



/** @param {import('playwright').Page} page @param {string} vpLabel */

async function flowNormalChat(page, vpLabel) {

  const flow = "通常チャット回帰";

  try {

    await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    await seedNormalChat(page);

    await page.goto(normalChatUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    await hold(
      page,
      {
        screen: "通常チャット回帰",
        checks: [
          "Builder ワークフローヘッダーが表示されていない",
          "通常チャット UI（composer / メッセージ）が表示されている",
          "Talk 一本化（Builder 内チャット UI なし）",
        ],
        slug: "normal-chat",
      },
      "通常チャット回帰",
      "nav"
    );



    if (await page.locator("#talkBuilderWorkflowPanel").isHidden()) {

      logStep(vpLabel, flow, "Builderヘッダー非表示", "pass");

    } else {

      logStep(vpLabel, flow, "Builderヘッダー非表示", "fail");

    }



    const composer = page.locator("#chatInput");

    const messages = page.locator("#chatMessages");

    if ((await composer.count()) >= 1 && (await messages.count()) >= 1) {

      logStep(vpLabel, flow, "通常チャットUI", "pass");

    } else {

      logStep(vpLabel, flow, "通常チャットUI", "fail");

    }

  } catch (err) {

    logStep(vpLabel, flow, "例外", "fail", String(err?.message || err));

  }

}



console.log("=== Builder → Talk headed check ===");
console.log(`Base URL: ${base}`);
const modeLabel = CLI.manualReviewFlow
  ? "manual-review-flow（手動操作 + 状態 probe）"
  : CLI.interactiveReview
  ? "interactive-review（操作確認）"
  : CLI.manualReview
    ? "manual-review（手動確認）"
    : CLI.visualSlow
      ? "visual-slow（目視）"
      : "default（高速）";
console.log(`mode: ${modeLabel}`);
console.log(`headed: true · slowMo: ${TIMING.slowMo}ms · step pause: ${TIMING.pause}ms`);
if (CLI.viewportFilter) console.log(`viewport filter: ${CLI.viewportFilter}`);
if (CLI.flowFilter) console.log(`flow filter: ${CLI.flowFilter}`);
if (reviewModeActive()) {
  console.log(`review dir: ${MANUAL_REVIEW_DIR}`);
  if (CLI.manualReviewFlow) {
    console.log("各停止点でブラウザを自由操作 · Enterで現在状態を probe（自動クリックなし）");
  } else if (CLI.interactiveReview) {
    console.log("各停止点でブラウザを操作できます · Enterで次の自動ステップへ");
  } else {
    console.log("各停止点で Enter を押すと次へ進みます");
  }
}
console.log("");



for (const vp of viewports) {
  const vpLabel = `${vp.width}`;
  console.log(`\n######## viewport ${vp.width}x${vp.height} ########`);

  await withPlaywrightBrowser(
    async (browser) => {
      resetManualStepCounter();

      /** @type {import('playwright').BrowserContext | null} */
      let context = null;
      /** @type {import('playwright').Page} */
      let page;

      if (reviewModeActive()) {
        mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
        context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          recordVideo: {
            dir: MANUAL_REVIEW_DIR,
            size: { width: vp.width, height: vp.height },
          },
        });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        page = await context.newPage();
      } else {
        page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      }

      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(`[${vpLabel}] ${msg.text()}`);
          consoleErrorsAll.push(`[${vpLabel}] ${msg.text()}`);
        }
      });

      try {
        if (FLOW_ENABLED.admin) await flowOpsCase(page, vpLabel);
        if (FLOW_ENABLED.general) await flowGeneralProject(page, vpLabel);
        if (FLOW_ENABLED.worker) await flowWorkerSearch(page, vpLabel);
        if (FLOW_ENABLED.vendor) await flowVendorSearch(page, vpLabel);
        if (FLOW_ENABLED.normal) await flowNormalChat(page, vpLabel);

        if (consoleErrors.length === 0) {
          logStep(vpLabel, "全体", "Console Error", "pass", "0件");
        } else {
          logStep(vpLabel, "全体", "Console Error", "fail", `${consoleErrors.length}件`);
        }
      } finally {
        if (context) {
          const tracePath = join(MANUAL_REVIEW_DIR, `trace-${vpLabel}.zip`);
          try {
            await context.tracing.stop({ path: tracePath });
            console.log(`\nTrace saved: ${tracePath}`);
          } catch (traceErr) {
            console.warn(`Trace save skipped: ${String(traceErr?.message || traceErr)}`);
          }
          const video = page.video();
          await context.close();
          if (video) {
            const videoPath = await video.path();
            console.log(`Video saved: ${videoPath}`);
          }
        }
      }
    },
    { headless: false, slowMo: TIMING.slowMo }
  );
}



await closeAllBrowsers();



const fails = report.filter((r) => r.status === "fail");

console.log("\n========== SUMMARY ==========");

console.log(`Total steps: ${report.length} · FAIL: ${fails.length}`);
console.log(
  `Mode: ${
    CLI.manualReviewFlow
      ? "--manual-review-flow"
      : CLI.interactiveReview
      ? "--interactive-review"
      : CLI.manualReview
        ? "--manual-review"
        : CLI.visualSlow
          ? "--visual-slow"
          : "default"
  }`
);
if (reviewModeActive()) {
  console.log(`Screenshots: ${MANUAL_REVIEW_DIR}`);
}
if (CLI.manualReviewFlow && manualFlowReports.length) {
  const reportPath = join(MANUAL_REVIEW_DIR, "report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        feature:
          CLI.flowFilter === "general"
            ? "builder-general-manual-review-flow"
            : CLI.flowFilter === "worker"
              ? "builder-worker-search-manual-review-flow"
              : CLI.flowFilter === "vendor"
                ? "builder-vendor-search-manual-review-flow"
                : "builder-talk-manual-review-flow",
        capturedAt: new Date().toISOString(),
        baseUrl: base,
        viewports: manualFlowReports,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`State report: ${reportPath}`);
}

if (fails.length) {

  console.log("\n--- 止まった / 失敗箇所 ---");

  fails.forEach((f) => {

    console.log(`  [${f.viewport}] ${f.flow} / ${f.step}${f.detail ? `: ${f.detail}` : ""}`);

  });

}

if (consoleErrorsAll.length) {

  console.log("\n--- Console Errors ---");

  [...new Set(consoleErrorsAll)].forEach((e) => console.log(`  ${e}`));

}



const cmdParts = ["node scripts/check-builder-talk-flow-headed.mjs"];
if (CLI.manualReviewFlow) cmdParts.push("--manual-review-flow");
else if (CLI.interactiveReview) cmdParts.push("--interactive-review");
else if (CLI.manualReview) cmdParts.push("--manual-review");
else if (CLI.visualSlow) cmdParts.push("--visual-slow");
if (CLI.viewportFilter) cmdParts.push(`--viewport=${CLI.viewportFilter}`);
if (CLI.flowFilter) cmdParts.push(`--flow=${CLI.flowFilter}`);
console.log(`\nCommand: ${cmdParts.join(" ")}`);

if (reviewReadline) reviewReadline.close();

process.exitCode = fails.length ? 1 : 0;


