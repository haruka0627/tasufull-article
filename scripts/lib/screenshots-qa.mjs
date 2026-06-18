import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * 検証ルール（docs/screenshots-qa-rules.md と同期）
 * @type {Array<{ id: string, rule: string }>}
 */
export const QA_VERIFICATION_RULES = [
  { id: "register-important", rule: "新しい重要スクショは必ず IMAGE_META に登録" },
  { id: "ignore-temp", rule: "一時スクショ・古い検証画像は IGNORE_PATTERNS に入れる" },
  {
    id: "pass-report-footer",
    rule: "PASS報告時は viewer URL / 検索キーワード / 登録枚数を必ず添える",
  },
  {
    id: "gemini-search-url",
    rule: "Geminiレビューに出す画像は QA Center の search URL で特定する",
  },
  { id: "no-complete-with-warn", rule: "未登録 ⚠ が 1以上なら完了扱いにしない" },
];

export const DEFAULT_VIEWER_PATH = "screenshots-viewer.html";

/** @type {Record<string, string>} */
export const FOLDER_LABELS = {
  "ai-workspace-generate-ui": "AI Workspace",
  "ai-workspace-glow-layers": "AI Workspace",
  "ai-workspace-chat-spacing": "AI Workspace",
  "ai-workspace-multi-ai": "AI Workspace",
  "ai-workspace-search": "AI Workspace",
  "ai-workspace-action": "AI Workspace",
  "tasful-ai-workspace-final": "AI Workspace",
  "tasful-ai-workspace-verify": "AI Workspace",
  "ai-top-redesign": "AI TOP",
  "connect-ui-review": "Connect",
  "talk-notify-flow": "Talk",
};

/**
 * @typedef {{
 *   title: string,
 *   description?: string,
 *   category?: string,
 *   qaStatus?: "pass" | "fail" | "unknown",
 *   report?: string,
 *   sourceUrl?: string,
 * }} QaImageMeta
 */

/** 重要スクショの canonical 登録（ルール1 — docs/screenshots-qa-rules.md） @type {Record<string, QaImageMeta>} */
export const IMAGE_META = {
  "screenshots/ai-workspace-multi-ai/chatgpt-real-api.png": {
    title: "ChatGPT 実API接続",
    description: "AI Workspace 回答カード — コピー・次にできることCTA・後処理済み文案（ChatGPT）。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-answer-cta.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-multi-ai/claude-real-api.png": {
    title: "Claude 実API接続",
    description: "AI Workspace 回答カード — コピー・次にできることCTA・後処理済み文案（Claude）。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-answer-cta.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-multi-ai/gemini-real-api.png": {
    title: "Gemini 実API接続",
    description: "AI Workspace で Gemini 実API応答（課金・キー状態の確認用）。",
    category: "AI Workspace",
    qaStatus: "unknown",
    report: "reports/ai-real-api-verification.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-search/vendor-search.png": {
    title: "TASFUL内検索 — 業者",
    description: "「埼玉で屋根修理業者を探して」の検索結果カード・比較・問い合わせ導線。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-search-integration.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-search/worker-search.png": {
    title: "TASFUL内検索 — ワーカー",
    description: "「Connect対応のワーカーを探して」の検索結果カード表示。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-search-integration.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-search/product-search.png": {
    title: "TASFUL内検索 — 商品",
    description: "「近くの商品を探して」の検索結果カード表示。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-search-integration.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-action/inquiry-generated.png": {
    title: "問い合わせ文生成",
    description: "検索カードから問い合わせ文を生成（件名・本文・コピー・TALK導線）。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-inquiry-to-talk.md",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-action/talk-draft-card.png": {
    title: "TALK 問い合わせ下書き",
    description: "AI Workspace 由来の問い合わせ下書きカード。「チャットへ反映」で入力欄へ渡す（自動送信なし）。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-inquiry-to-talk.md",
    sourceUrl: "talk-inquiry-draft.html",
  },
  "screenshots/ai-workspace-action/chat-input-prefilled.png": {
    title: "TALK入力欄への下書き反映",
    description:
      "問い合わせ文を chat-detail の入力欄へ反映した状態。まだ送信はされておらず、右下の送信ボタンで手動送信する。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/ai-workspace-inquiry-to-talk.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/screenshots-viewer/ai-workspace-gallery.png": {
    title: "Screenshots Viewer — AI Workspace",
    description: "QA Viewer の AI Workspace カテゴリ表示。",
    category: "AI Workspace",
    qaStatus: "pass",
    report: "reports/screenshots-viewer-ai-workspace.json",
    sourceUrl: "screenshots-viewer.html",
  },
  "screenshots/screenshots-viewer/search-connect-verification.png": {
    title: "Viewer検索 — connect-verification.png",
    description: "QA Center 検索 ?search=connect-verification.png で1件のみ表示。",
    category: "Other",
    qaStatus: "pass",
    sourceUrl: "screenshots-viewer.html?search=connect-verification.png",
  },
  "screenshots/screenshots-viewer/search-chatgpt-real-api.png": {
    title: "Viewer検索 — chatgpt-real-api.png",
    description: "QA Center 検索 ?search=chatgpt-real-api.png で1件のみ表示。",
    category: "Other",
    qaStatus: "pass",
    sourceUrl: "screenshots-viewer.html?search=chatgpt-real-api.png",
  },
  "screenshots/screenshots-viewer/search-connect-category.png": {
    title: "Viewer検索 — connect カテゴリ",
    description: "QA Center 検索 ?search=connect で Connect 関連のみ表示（サムネイル一覧）。",
    category: "Other",
    qaStatus: "pass",
    sourceUrl: "screenshots-viewer.html?search=connect",
  },
  "screenshots/ai-workspace-chat-spacing/chat-spacing-mobile390.png": {
    title: "AI Workspace チャット余白（SP）",
    description: "AI Workspace チャット画面の余白・レイアウト（390px）。",
    category: "AI Workspace",
    qaStatus: "pass",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-workspace-chat-spacing/chat-spacing-pc1280.png": {
    title: "AI Workspace チャット余白（PC）",
    description: "AI Workspace チャット画面の余白・レイアウト（1280px）。",
    category: "AI Workspace",
    qaStatus: "pass",
    sourceUrl: "ai-workspace.html",
  },
  "screenshots/ai-top-redesign/ai-top-compact-mobile390.png": {
    title: "AI TOP コンパクト（SP）",
    description: "AI TOP リデザイン — コンパクトレイアウト（390px）。",
    category: "AI TOP",
    qaStatus: "unknown",
    sourceUrl: "index-top.html",
  },
  "screenshots/ai-top-redesign/ai-top-compact-pc1280.png": {
    title: "AI TOP コンパクト（PC）",
    description: "AI TOP リデザイン — コンパクトレイアウト（1280px）。",
    category: "AI TOP",
    qaStatus: "unknown",
    sourceUrl: "index-top.html",
  },
  "screenshots/builder-mvp-thread-final/board-thread-mobile390.png": {
    title: "Builder スレッド詳細（SP）",
    description: "Builder MVP スレッド画面（board-thread）。",
    category: "Builder",
    qaStatus: "pass",
    report: "reports/builder-final-flow-ng.md",
    sourceUrl: "builder/board-thread.html",
  },
  "screenshots/builder-mvp-thread-final/board-thread-pc1280.png": {
    title: "Builder スレッド詳細（PC）",
    description: "Builder MVP スレッド画面（board-thread）。",
    category: "Builder",
    qaStatus: "pass",
    report: "reports/builder-final-flow-ng.md",
    sourceUrl: "builder/board-thread.html",
  },
  "screenshots/builder-mvp-thread-final/mvp-notifications-mobile390.png": {
    title: "Builder 通知（SP）",
    description: "Builder MVP 通知一覧。",
    category: "Builder",
    qaStatus: "pass",
    report: "reports/builder-final-flow-ng.md",
    sourceUrl: "builder/mvp-notifications.html",
  },
  "screenshots/builder-mvp-thread-final/mvp-notifications-pc1280.png": {
    title: "Builder 通知（PC）",
    description: "Builder MVP 通知一覧。",
    category: "Builder",
    qaStatus: "pass",
    report: "reports/builder-final-flow-ng.md",
    sourceUrl: "builder/mvp-notifications.html",
  },
  "screenshots/connect-ui-review/connect-top-mobile390.png": {
    title: "Connectトップ",
    description: "支払い方法・口座管理 — Connect 未申請のトップ画面（390px）。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-top.png": {
    title: "Connectトップ（Gemini提出）",
    description: "Gemini レビュー提出用 — Connect トップ。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png": {
    title: "ダッシュボード Connect 本人確認バナー",
    description:
      "【重要】売上の受け取りと安全な取引のために本人確認を完了してください — ダッシュボード上部の固定バナー。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "dashboard.html",
  },
  "screenshots/connect-ui-review/connect-apply-mobile390.png": {
    title: "Connect申請",
    description: "Connect 申請後の TALK 通知カード（本人確認が必要です）。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/connect-ui-review/connect-apply.png": {
    title: "Connect申請（Gemini提出）",
    description: "Gemini レビュー提出用 — Connect 申請通知。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/connect-ui-review/connect-identity-mobile390.png": {
    title: "本人確認",
    description: "通知から遷移した Connect 本人確認パネル。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-verification.png": {
    title: "本人確認（Gemini提出）",
    description: "Gemini レビュー提出用 — Connect 本人確認。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-qualification-mobile390.png": {
    title: "資格確認",
    description: "本人確認提出後 — 振込先・資格確認ステップ。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-reviewing-mobile390.png": {
    title: "Connect審査中",
    description: "振込先登録後 — Stripe 審査中ステータス。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-approved-mobile390.png": {
    title: "Connect承認",
    description: "Connect 審査完了・承認済みステータス。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-approved.png": {
    title: "Connect承認（Gemini提出）",
    description: "Gemini レビュー提出用 — Connect 承認済み。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-ready-mobile390.png": {
    title: "Connect利用開始",
    description: "Connect 利用可能 — 取引開始準備完了。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/connect-ui-review/connect-trade-with-mobile390.png": {
    title: "Connectあり取引導線",
    description: "Connect 有効時のスキル詳細 — 購入・相談 CTA。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "detail-skill.html",
  },
  "screenshots/connect-ui-review/connect-trade-flow.png": {
    title: "Connect取引導線（Gemini提出）",
    description: "Gemini レビュー提出用 — Connect あり取引導線。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "detail-skill.html",
  },
  "screenshots/connect-ui-review/connect-trade-without-mobile390.png": {
    title: "Connectなし取引導線",
    description: "Connect 未設定時のスキル詳細 — 決済設定案内。",
    category: "Connect",
    qaStatus: "pass",
    report: "reports/connect-ui-review-prep.md",
    sourceUrl: "detail-skill.html",
  },
  "screenshots/notify-ui-review/notify-list-mobile390.png": {
    title: "通知一覧（390px）",
    description: "TALK 通知タブ — 重要な通知（上部ピン）と通常の通知に分離された一覧。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-round2.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-list.png": {
    title: "通知一覧（Gemini提出）",
    description: "Gemini レビュー提出用 — 通知タブ一覧。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-connect-mobile390.png": {
    title: "Connect 通知",
    description: "【重要】売上の受け取りには本人確認が必要です — オレンジアクセントの重要通知カード。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-round2.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-dest-connect-mobile390.png": {
    title: "通知→Connect 遷移先",
    description: "Connect 通知 CTA クリック後 — 支払い方法・口座管理（本人確認）。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/notify-ui-review/notify-to-connect.png": {
    title: "通知→Connect（Gemini提出）",
    description: "Gemini レビュー提出用 — 通知から Connect 本人確認へ。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/notify-ui-review/notify-chat-mobile390.png": {
    title: "チャット通知",
    description: "やりとり開始案内 — チャット通知カード。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-dest-chat-mobile390.png": {
    title: "通知→チャット 遷移先",
    description: "チャット通知 CTA クリック後 — chat-detail 画面。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/notify-ui-review/notify-to-chat.png": {
    title: "通知→チャット（Gemini提出）",
    description: "Gemini レビュー提出用 — 通知からチャットへ。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/notify-ui-review/notify-job-mobile390.png": {
    title: "応募通知",
    description: "求人への応募通知 — 応募者一覧への導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-project-mobile390.png": {
    title: "案件通知",
    description: "新しい案件が公開されました — 案件詳細への導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-dest-project-mobile390.png": {
    title: "通知→案件 遷移先",
    description: "案件通知 CTA クリック後 — 公開案件詳細。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "public-board-detail.html",
  },
  "screenshots/notify-ui-review/notify-to-project.png": {
    title: "通知→案件（Gemini提出）",
    description: "Gemini レビュー提出用 — 通知から案件詳細へ。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "public-board-detail.html",
  },
  "screenshots/notify-ui-review/notify-hire-mobile390.png": {
    title: "採用通知",
    description: "採用されました — 案件スレッドへの導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-purchase-mobile390.png": {
    title: "購入通知",
    description: "スキルが購入されました — 取引開始への導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-completion-mobile390.png": {
    title: "完了報告通知",
    description: "完了報告が届きました — 承認・確認への導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-review-mobile390.png": {
    title: "レビュー通知",
    description: "評価をお願いします — チャット評価への導線。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-anpi-mobile390.png": {
    title: "安否通知",
    description: "安否確認通知 — 「無事です」プライマリCTA付き重要通知カード。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-round2.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/notify-ui-review/notify-dest-anpi-mobile390.png": {
    title: "通知→安否 遷移先",
    description: "安否通知 CTA クリック後 — 安否ダッシュボード。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "anpi-dashboard.html",
  },
  "screenshots/notify-ui-review/notify-to-anpi.png": {
    title: "通知→安否（Gemini提出）",
    description: "Gemini レビュー提出用 — 通知から安否ダッシュボードへ。",
    category: "Notify",
    sourceUrl: "anpi-dashboard.html",
    report: "reports/notify-ui-review-prep.md",
    qaStatus: "pass",
  },
  "screenshots/notify-ui-review/notify-system-mobile390.png": {
    title: "運営通知",
    description: "重要なお知らせがあります — 運営からの案内。",
    category: "Notify",
    qaStatus: "pass",
    report: "reports/notify-ui-review-prep.md",
    sourceUrl: "talk-home.html",
  },
  "screenshots/platform-notify-unified/01-notify-tab-390.png": {
    title: "統合通知タブ",
    description: "プラットフォーム統合通知 — 通知タブ先頭。",
    category: "Notify",
    qaStatus: "unknown",
    sourceUrl: "chat-list.html",
  },
  "screenshots/platform-notify-unified/09-connect-complete-notify-390.png": {
    title: "Connect完了通知",
    description: "プラットフォーム統合通知 — Connect完了通知カード。",
    category: "Notify",
    qaStatus: "unknown",
    sourceUrl: "chat-list.html",
  },
  "screenshots/talk-notify-unified-390/01-notify-tab-top.png": {
    title: "TALK 通知タブ",
    description: "TALK統合通知 — 通知タブ上部。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "talk-home.html",
  },
  "screenshots/talk-notify-unified-390/02-notify-job-apply.png": {
    title: "TALK 求人応募通知",
    description: "TALK統合通知 — 求人応募通知カード。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "talk-home.html",
  },
  "screenshots/talk-notify-unified-390/03-official-builder-room.png": {
    title: "TALK Builder公式ルーム",
    description: "TALK統合通知 — Builder公式ルーム。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "talk-home.html",
  },
  "screenshots/talk-platform-notify-v1/01-notify-list-top.png": {
    title: "TALK 通知リスト",
    description: "TALKプラットフォーム通知 v1 — リスト上部。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "talk-home.html",
  },
  "screenshots/public-board-detail-talk/public-board-detail-talk-390.png": {
    title: "公開掲示板 → TALK（SP）",
    description: "公開掲示板詳細から TALK 導線（390px）。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "public-board-detail.html",
  },
  "screenshots/public-board-detail-talk/public-board-detail-talk-1280.png": {
    title: "公開掲示板 → TALK（PC）",
    description: "公開掲示板詳細から TALK 導線（1280px）。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "public-board-detail.html",
  },
  "screenshots/line-chat-3tab-verify/tab1-owner-pc1280.png": {
    title: "LINE風3タブ — オーナー",
    description: "LINE風3タブチャット検証 — オーナー視点。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/line-chat-3tab-verify/tab2-partner-pc1280.png": {
    title: "LINE風3タブ — パートナー",
    description: "LINE風3タブチャット検証 — パートナー視点。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/line-chat-3tab-verify/tab3-user-pc1280.png": {
    title: "LINE風3タブ — ユーザー",
    description: "LINE風3タブチャット検証 — ユーザー視点。",
    category: "Talk",
    qaStatus: "unknown",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/talk-notify-flow/talk-notify-chat-detail-mobile390.png": {
    title: "TALK通知→チャット（返信）",
    description: "チャット通知クリック後 — 相手・案件コンテキストとメッセージ入力が表示された状態。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/talk-notify-flow/talk-notify-chat-detail.png": {
    title: "TALK通知→チャット（Gemini）",
    description: "チャット通知導線 — 遷移先で返信できる状態。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/talk-notify-flow/talk-notify-purchase-mobile390.png": {
    title: "TALK通知→購入・支払い確認",
    description: "購入通知クリック後 — 手数料支払い画面で取引開始準備が分かる状態。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "platform-chat-fee-pay.html",
  },
  "screenshots/talk-notify-flow/talk-notify-purchase.png": {
    title: "TALK通知→購入（Gemini）",
    description: "購入通知導線 — 支払い確認と取引開始への導線。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "platform-chat-fee-pay.html",
  },
  "screenshots/talk-notify-flow/talk-notify-completion-mobile390.png": {
    title: "TALK通知→完了報告（承認）",
    description: "完了報告通知クリック後 — 承認・差し戻しが選べる完了報告パネル。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "builder/board-thread.html",
  },
  "screenshots/talk-notify-flow/talk-notify-completion.png": {
    title: "TALK通知→完了報告（Gemini）",
    description: "完了報告通知導線 — 承認 / 差し戻しの判断画面。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "builder/board-thread.html",
  },
  "screenshots/talk-notify-flow/talk-notify-review-mobile390.png": {
    title: "TALK通知→レビュー",
    description: "レビュー通知クリック後 — 評価入力またはレビュー導線が表示された状態。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/talk-notify-flow/talk-notify-review.png": {
    title: "TALK通知→レビュー（Gemini）",
    description: "レビュー通知導線 — 取引相手の評価入力画面。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "chat-detail.html",
  },
  "screenshots/talk-notify-flow/talk-notify-connect-mobile390.png": {
    title: "TALK通知→Connect本人確認",
    description: "Connect通知クリック後 — 本人確認を始められる payment-settings 画面。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/talk-notify-flow/talk-notify-connect.png": {
    title: "TALK通知→Connect（Gemini）",
    description: "Connect通知導線 — 本人確認手続きの開始画面。",
    category: "Talk",
    qaStatus: "pass",
    report: "reports/talk-notify-flow-review-prep.md",
    sourceUrl: "payment-settings.html",
  },
  "screenshots/user-dashboard-final/user-dashboard-mobile390.png": {
    title: "ユーザーダッシュボード（SP）",
    description: "ユーザーダッシュボード最終確認（390px）。",
    category: "Other",
    qaStatus: "unknown",
    sourceUrl: "dashboard.html",
  },
  "screenshots/user-dashboard-final/user-dashboard-pc1280.png": {
    title: "ユーザーダッシュボード（PC）",
    description: "ユーザーダッシュボード最終確認（1280px）。",
    category: "Other",
    qaStatus: "unknown",
    sourceUrl: "dashboard.html",
  },
};

export const REGISTERED_PATHS = new Set(Object.keys(IMAGE_META));

/** QA確認対象の canonical 一覧（IMAGE_META と同期） */
export const CANONICAL_CHECKLIST = new Set(Object.keys(IMAGE_META));

/**
 * 一時・古い検証画像のアーカイブ（ルール2 — docs/screenshots-qa-rules.md）
 * @type {Array<{ pattern: RegExp, reason?: string }>}
 */
export const IGNORE_PATTERNS = [
  { pattern: /\/_qa-prev\//, reason: "baseline" },
  { pattern: /\.json$/i, reason: "report-json" },
  { pattern: /^screenshots\/bench-/, reason: "bench" },
  { pattern: /^screenshots\/manual-/, reason: "manual" },
  { pattern: /^screenshots\/fixed-url-/, reason: "fixed-url" },
  { pattern: /^screenshots\/job-0-/, reason: "job-bench" },
  { pattern: /^screenshots\/worker-0-/, reason: "worker-bench" },
  { pattern: /^screenshots\/skill-vs-/, reason: "audit" },
  { pattern: /^screenshots\/common-path-/, reason: "audit" },
  { pattern: /^screenshots\/live-flow-/, reason: "audit" },
  { pattern: /^screenshots\/gen-ai-/, reason: "audit" },
  { pattern: /^screenshots\/general-flow-/, reason: "diag" },
  { pattern: /^screenshots\/list-scroll-/, reason: "misc" },
  { pattern: /^screenshots\/responsive-final/, reason: "misc" },
  { pattern: /^screenshots\/anpi-dashboard/, reason: "anpi-wip" },
  { pattern: /^screenshots\/anpi-register/, reason: "anpi-wip" },
  { pattern: /^screenshots\/anpi-notifications-mobile/, reason: "anpi-wip" },
  { pattern: /^screenshots\/chat-dual-window-demo/, reason: "bench-archive" },
  { pattern: /^screenshots\/builder-mvp-thread-final\//, reason: "non-canonical" },
  { pattern: /^screenshots\/connect-free-full-flow\//, reason: "non-canonical" },
  { pattern: /^screenshots\/platform-verify-connect-complete\//, reason: "non-canonical" },
  { pattern: /^screenshots\/platform-notify-unified\//, reason: "non-canonical" },
  { pattern: /^screenshots\/ai-top-redesign\//, reason: "non-canonical" },
  { pattern: /^screenshots\/screenshots-viewer\//, reason: "non-canonical" },
  { pattern: /^screenshots\/tasful-ai-workspace-final/, reason: "superseded" },
  { pattern: /^screenshots\/tasful-ai-workspace-verify/, reason: "verify-archive" },
  { pattern: /^screenshots\/ai-workspace-generate-ui/, reason: "wip" },
  { pattern: /^screenshots\/ai-workspace-glow-layers/, reason: "wip" },
  { pattern: /^screenshots\/ai-workspace-welcome/, reason: "wip" },
  { pattern: /^screenshots\/ai-workspace-category-flow/, reason: "audit" },
  { pattern: /^screenshots\/builder-final-flow-/, reason: "bench" },
  { pattern: /^screenshots\/builder-general-flow-/, reason: "bench" },
  { pattern: /^screenshots\/builder-mvp-thread-review/, reason: "review" },
  { pattern: /^screenshots\/builder-ops-/, reason: "ops-bench" },
  { pattern: /^screenshots\/builder-notify-/, reason: "notify-bench" },
  { pattern: /^screenshots\/builder-apply-/, reason: "bench" },
  { pattern: /^screenshots\/builder-attendance/, reason: "bench" },
  { pattern: /^screenshots\/builder-dashboard/, reason: "bench" },
  { pattern: /^screenshots\/builder-route/, reason: "bench" },
  { pattern: /^screenshots\/builder-scope/, reason: "bench" },
  { pattern: /^screenshots\/builder-top/, reason: "bench" },
  { pattern: /^screenshots\/builder-completion/, reason: "bench" },
  { pattern: /^screenshots\/platform-job-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-chat-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-fee-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-completion-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-review-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-skill-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-worker-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-shell-/, reason: "platform-bench" },
  { pattern: /^screenshots\/platform-verify-fee/, reason: "verify-archive" },
  { pattern: /^screenshots\/platform-verify-job/, reason: "verify-archive" },
  { pattern: /^screenshots\/platform-verify-notify/, reason: "verify-archive" },
  { pattern: /^screenshots\/platform-manual-/, reason: "manual" },
  { pattern: /^screenshots\/platform-talk-list/, reason: "superseded" },
  { pattern: /^screenshots\/detail-/, reason: "detail-bench" },
  { pattern: /^screenshots\/product-detail/, reason: "detail-bench" },
  { pattern: /^screenshots\/product-seller/, reason: "detail-bench" },
  { pattern: /^screenshots\/product-shop-payment/, reason: "payment-bench" },
  { pattern: /^screenshots\/deal-detail/, reason: "detail-bench" },
  { pattern: /^screenshots\/worker-detail/, reason: "detail-bench" },
  { pattern: /^screenshots\/worker-notify/, reason: "notify-bench" },
  { pattern: /^screenshots\/job-top/, reason: "bench" },
  { pattern: /^screenshots\/job-end/, reason: "bench" },
  { pattern: /^screenshots\/notify-category/, reason: "notify-bench" },
  { pattern: /^screenshots\/notify-scroll/, reason: "notify-bench" },
  { pattern: /^screenshots\/notify-system/, reason: "notify-bench" },
  { pattern: /^screenshots\/talk-anpi/, reason: "notify-archive" },
  { pattern: /^screenshots\/talk-builder/, reason: "notify-archive" },
  { pattern: /^screenshots\/talk-category/, reason: "wip" },
  { pattern: /^screenshots\/talk-official/, reason: "notify-archive" },
  { pattern: /^screenshots\/real-screen/, reason: "bench" },
  { pattern: /^screenshots\/chat-header/, reason: "misc" },
  { pattern: /^screenshots\/partner-/, reason: "bench" },
  { pattern: /^screenshots\/anpi-notify/, reason: "anpi-wip" },
  { pattern: /^screenshots\/anpi-talk/, reason: "anpi-wip" },
  { pattern: /-inspect\//, reason: "inspect" },
  { pattern: /-audit\//, reason: "audit" },
  { pattern: /-review\//, reason: "review" },
  { pattern: /-verify\//, reason: "verify-archive" },
  { pattern: /-ng\//, reason: "ng-archive" },
  { pattern: /-diag\//, reason: "diag" },
];

/**
 * @param {string} path
 */
export function isIgnoredPath(path) {
  const p = normalizePath(path);
  if (REGISTERED_PATHS.has(p)) return false;
  if (CANONICAL_CHECKLIST.has(p)) return false;
  return IGNORE_PATTERNS.some((rule) => rule.pattern.test(p));
}

/**
 * @param {string} path
 */
export function ignoreReason(path) {
  const p = normalizePath(path);
  const hit = IGNORE_PATTERNS.find((rule) => rule.pattern.test(p));
  return hit?.reason || "archived";
}

/** 問い合わせ → TALK下書き → 入力欄反映（連続表示用） */
export const INQUIRY_TO_TALK_FLOW = [
  "screenshots/ai-workspace-action/inquiry-generated.png",
  "screenshots/ai-workspace-action/talk-draft-card.png",
  "screenshots/ai-workspace-action/chat-input-prefilled.png",
];

/** 通知 UI レビュー（連続表示用） */
export const NOTIFY_UI_REVIEW_FLOW = [
  "screenshots/notify-ui-review/notify-list-mobile390.png",
  "screenshots/notify-ui-review/notify-connect-mobile390.png",
  "screenshots/notify-ui-review/notify-chat-mobile390.png",
  "screenshots/notify-ui-review/notify-job-mobile390.png",
  "screenshots/notify-ui-review/notify-project-mobile390.png",
  "screenshots/notify-ui-review/notify-hire-mobile390.png",
  "screenshots/notify-ui-review/notify-purchase-mobile390.png",
  "screenshots/notify-ui-review/notify-completion-mobile390.png",
  "screenshots/notify-ui-review/notify-review-mobile390.png",
  "screenshots/notify-ui-review/notify-anpi-mobile390.png",
  "screenshots/notify-ui-review/notify-system-mobile390.png",
  "screenshots/notify-ui-review/notify-dest-connect-mobile390.png",
  "screenshots/notify-ui-review/notify-dest-chat-mobile390.png",
  "screenshots/notify-ui-review/notify-dest-project-mobile390.png",
  "screenshots/notify-ui-review/notify-dest-anpi-mobile390.png",
];

/** TALK 通知導線レビュー（連続表示用） */
export const TALK_NOTIFY_FLOW_REVIEW = [
  "screenshots/talk-notify-flow/talk-notify-chat-detail-mobile390.png",
  "screenshots/talk-notify-flow/talk-notify-purchase-mobile390.png",
  "screenshots/talk-notify-flow/talk-notify-completion-mobile390.png",
  "screenshots/talk-notify-flow/talk-notify-review-mobile390.png",
  "screenshots/talk-notify-flow/talk-notify-connect-mobile390.png",
  "screenshots/talk-notify-flow/talk-notify-chat-detail.png",
  "screenshots/talk-notify-flow/talk-notify-purchase.png",
  "screenshots/talk-notify-flow/talk-notify-completion.png",
  "screenshots/talk-notify-flow/talk-notify-review.png",
  "screenshots/talk-notify-flow/talk-notify-connect.png",
];

/** Connect オンボーディング → 取引導線（連続表示用） */
export const CONNECT_UI_REVIEW_FLOW = [
  "screenshots/connect-ui-review/connect-top-mobile390.png",
  "screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png",
  "screenshots/connect-ui-review/connect-apply-mobile390.png",
  "screenshots/connect-ui-review/connect-identity-mobile390.png",
  "screenshots/connect-ui-review/connect-qualification-mobile390.png",
  "screenshots/connect-ui-review/connect-reviewing-mobile390.png",
  "screenshots/connect-ui-review/connect-approved-mobile390.png",
  "screenshots/connect-ui-review/connect-ready-mobile390.png",
  "screenshots/connect-ui-review/connect-trade-with-mobile390.png",
  "screenshots/connect-ui-review/connect-trade-without-mobile390.png",
];

/**
 * QA Center フロー検索（screenshots-viewer.js の FLOW_SEARCH と同期）
 * @type {Array<{ id: string, aliases: string[], paths: string[], stems: string[], viewerSearch: string }>}
 */
export const FLOW_SEARCH = [
  {
    id: "inquiry-to-talk",
    aliases: ["問い合わせ", "inquiry", "お問い合わせ", "問い合わせ文", "talk-draft"],
    paths: INQUIRY_TO_TALK_FLOW,
    stems: ["inquiry-generated", "talk-draft-card", "chat-input-prefilled"],
    viewerSearch: "問い合わせ",
  },
  {
    id: "connect",
    aliases: ["connect", "コネクト", "stripe connect", "connect-ui", "dashboard-connect-banner"],
    paths: CONNECT_UI_REVIEW_FLOW,
    stems: [
      "connect-top",
      "dashboard-connect-banner",
      "connect-apply",
      "connect-identity",
      "connect-verification",
      "connect-qualification",
      "connect-reviewing",
      "connect-approved",
      "connect-ready",
      "connect-trade",
    ],
    viewerSearch: "connect",
  },
  {
    id: "notify",
    aliases: ["notify", "通知", "notify-ui", "notify-ui-review"],
    paths: NOTIFY_UI_REVIEW_FLOW,
    stems: [
      "notify-list",
      "notify-connect",
      "notify-chat",
      "notify-job",
      "notify-project",
      "notify-anpi",
      "notify-to-",
      "notify-dest-",
      "notify-hire",
      "notify-purchase",
      "notify-completion",
      "notify-review",
      "notify-system",
    ],
    viewerSearch: "notify",
  },
  {
    id: "talk-notify-flow",
    aliases: ["talk-notify", "talk notify", "talk通知導線", "通知導線"],
    paths: TALK_NOTIFY_FLOW_REVIEW,
    stems: [
      "talk-notify-chat-detail",
      "talk-notify-purchase",
      "talk-notify-completion",
      "talk-notify-review",
      "talk-notify-connect",
    ],
    viewerSearch: "talk-notify",
  },
];

/** AI Workspace カテゴリの表示順（小さいほど先） */
export const AI_WORKSPACE_DISPLAY_ORDER = {
  "screenshots/ai-workspace-multi-ai/chatgpt-real-api.png": 10,
  "screenshots/ai-workspace-multi-ai/claude-real-api.png": 20,
  "screenshots/ai-workspace-multi-ai/gemini-real-api.png": 25,
  "screenshots/ai-workspace-search/vendor-search.png": 30,
  "screenshots/ai-workspace-search/worker-search.png": 40,
  "screenshots/ai-workspace-search/product-search.png": 50,
  "screenshots/ai-workspace-action/inquiry-generated.png": 60,
  "screenshots/ai-workspace-action/talk-draft-card.png": 61,
  "screenshots/ai-workspace-action/chat-input-prefilled.png": 62,
  "screenshots/screenshots-viewer/ai-workspace-gallery.png": 90,
};

/** Notify UI レビューの表示順 */
export const NOTIFY_DISPLAY_ORDER = {
  "screenshots/notify-ui-review/notify-list-mobile390.png": 10,
  "screenshots/notify-ui-review/notify-list.png": 11,
  "screenshots/notify-ui-review/notify-connect-mobile390.png": 20,
  "screenshots/notify-ui-review/notify-dest-connect-mobile390.png": 21,
  "screenshots/notify-ui-review/notify-to-connect.png": 22,
  "screenshots/notify-ui-review/notify-chat-mobile390.png": 30,
  "screenshots/notify-ui-review/notify-dest-chat-mobile390.png": 31,
  "screenshots/notify-ui-review/notify-to-chat.png": 32,
  "screenshots/notify-ui-review/notify-job-mobile390.png": 40,
  "screenshots/notify-ui-review/notify-project-mobile390.png": 50,
  "screenshots/notify-ui-review/notify-dest-project-mobile390.png": 51,
  "screenshots/notify-ui-review/notify-to-project.png": 52,
  "screenshots/notify-ui-review/notify-hire-mobile390.png": 60,
  "screenshots/notify-ui-review/notify-purchase-mobile390.png": 70,
  "screenshots/notify-ui-review/notify-completion-mobile390.png": 80,
  "screenshots/notify-ui-review/notify-review-mobile390.png": 90,
  "screenshots/notify-ui-review/notify-anpi-mobile390.png": 100,
  "screenshots/notify-ui-review/notify-dest-anpi-mobile390.png": 101,
  "screenshots/notify-ui-review/notify-to-anpi.png": 102,
  "screenshots/notify-ui-review/notify-system-mobile390.png": 110,
};

/** TALK 通知導線レビューの表示順 */
export const TALK_NOTIFY_FLOW_DISPLAY_ORDER = {
  "screenshots/talk-notify-flow/talk-notify-chat-detail-mobile390.png": 10,
  "screenshots/talk-notify-flow/talk-notify-chat-detail.png": 11,
  "screenshots/talk-notify-flow/talk-notify-purchase-mobile390.png": 20,
  "screenshots/talk-notify-flow/talk-notify-purchase.png": 21,
  "screenshots/talk-notify-flow/talk-notify-completion-mobile390.png": 30,
  "screenshots/talk-notify-flow/talk-notify-completion.png": 31,
  "screenshots/talk-notify-flow/talk-notify-review-mobile390.png": 40,
  "screenshots/talk-notify-flow/talk-notify-review.png": 41,
  "screenshots/talk-notify-flow/talk-notify-connect-mobile390.png": 50,
  "screenshots/talk-notify-flow/talk-notify-connect.png": 51,
};

/** Connect カテゴリの表示順 */
export const CONNECT_DISPLAY_ORDER = {
  "screenshots/connect-ui-review/connect-top-mobile390.png": 10,
  "screenshots/connect-ui-review/connect-top.png": 11,
  "screenshots/connect-ui-review/dashboard-connect-banner-mobile390.png": 15,
  "screenshots/connect-ui-review/connect-apply-mobile390.png": 20,
  "screenshots/connect-ui-review/connect-apply.png": 21,
  "screenshots/connect-ui-review/connect-identity-mobile390.png": 30,
  "screenshots/connect-ui-review/connect-verification.png": 31,
  "screenshots/connect-ui-review/connect-qualification-mobile390.png": 40,
  "screenshots/connect-ui-review/connect-reviewing-mobile390.png": 50,
  "screenshots/connect-ui-review/connect-approved-mobile390.png": 60,
  "screenshots/connect-ui-review/connect-approved.png": 61,
  "screenshots/connect-ui-review/connect-ready-mobile390.png": 70,
  "screenshots/connect-ui-review/connect-trade-with-mobile390.png": 80,
  "screenshots/connect-ui-review/connect-trade-flow.png": 81,
  "screenshots/connect-ui-review/connect-trade-without-mobile390.png": 90,
};

/** @type {Array<{ id: string, label: string, match: (folder: string) => boolean }>} */
export const CATEGORY_RULES = [
  {
    id: "ai-workspace",
    label: "AI Workspace",
    match: (f) =>
      f.startsWith("ai-workspace") ||
      f === "tasful-ai-workspace-final" ||
      f === "tasful-ai-workspace-verify",
  },
  { id: "ai-top", label: "AI TOP", match: (f) => f === "ai-top-redesign" },
  { id: "builder", label: "Builder", match: (f) => f.startsWith("builder") },
  {
    id: "connect",
    label: "Connect",
    match: (f) =>
      f.startsWith("connect-") ||
      f === "platform-verify-connect-complete" ||
      f.startsWith("platform-verify-connect"),
  },
  {
    id: "talk",
    label: "Talk",
    match: (f) =>
      f.startsWith("talk-") ||
      f.includes("-talk-") ||
      f.startsWith("platform-talk") ||
      f.startsWith("chat-") ||
      f.startsWith("line-chat") ||
      f === "platform-chat-composer-input" ||
      f === "public-board-detail-talk",
  },
  {
    id: "platform",
    label: "Platform",
    match: (f) => f.startsWith("platform-") || f.startsWith("bench-"),
  },
  {
    id: "detail",
    label: "Detail",
    match: (f) => f.startsWith("detail-") || f === "product-detail" || f === "worker-detail",
  },
  { id: "notify", label: "Notify", match: (f) => f.includes("notify") },
  { id: "other", label: "Other", match: () => true },
];

/**
 * @param {string} folder
 */
export function resolveCategoryId(folder) {
  const f = String(folder || "");
  const hit = CATEGORY_RULES.find((rule) => rule.id !== "other" && rule.match(f));
  return hit?.id || "other";
}

/**
 * @param {string} folder
 */
export function resolveCategoryLabel(folder) {
  const f = String(folder || "");
  const hit = CATEGORY_RULES.find((rule) => rule.id !== "other" && rule.match(f));
  return hit?.label || FOLDER_LABELS[f] || folderLabelFromSlug(f);
}

/**
 * @param {string} slug
 */
function folderLabelFromSlug(slug) {
  return String(slug || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * @param {string} root
 * @returns {Promise<Map<string, { qaStatus: "pass"|"fail"|"unknown", report: string }>>}
 */
export async function loadReportQaIndex(root) {
  /** @type {Map<string, { qaStatus: "pass"|"fail"|"unknown", report: string }>} */
  const index = new Map();
  const reportsDir = join(root, "reports");
  let files = [];
  try {
    files = (await readdir(reportsDir)).filter((f) => f.endsWith(".json"));
  } catch {
    return index;
  }

  for (const file of files) {
    const reportJson = `reports/${file}`;
    const reportMd = reportJson.replace(/\.json$/, ".md");
    let data;
    try {
      data = JSON.parse(await readFile(join(reportsDir, file), "utf8"));
    } catch {
      continue;
    }

    const rootPass = data.passed === true ? "pass" : data.passed === false ? "fail" : null;

    if (typeof data.screenshot === "string" && data.screenshot) {
      index.set(normalizePath(data.screenshot), {
        qaStatus: rootPass || "unknown",
        report: reportMd,
      });
    }

    if (Array.isArray(data.uiCaptures)) {
      for (const row of data.uiCaptures) {
        const name = row?.file;
        if (!name) continue;
        const folder = guessFolderFromReport(file, name);
        const path = `screenshots/${folder}/${name}`;
        index.set(normalizePath(path), {
          qaStatus: row.isApiError ? "fail" : rootPass || "unknown",
          report: reportMd,
        });
      }
    }

    if (Array.isArray(data.results)) {
      for (const row of data.results) {
        const name = row?.file;
        if (!name) continue;
        const folder = guessFolderFromReport(file, name);
        const path = `screenshots/${folder}/${name}`;
        const pass = row.passed === true ? "pass" : row.passed === false ? "fail" : rootPass;
        index.set(normalizePath(path), {
          qaStatus: pass || "unknown",
          report: reportMd,
        });
      }
    }

    if (Array.isArray(data.steps)) {
      for (const row of data.steps) {
        const name = row?.id ? `${row.id}.png` : "";
        if (!name) continue;
        const folder = guessFolderFromReport(file, name);
        const path = `screenshots/${folder}/${name}`;
        const pass = row.pass === true ? "pass" : row.pass === false ? "fail" : rootPass;
        index.set(normalizePath(path), {
          qaStatus: pass || "unknown",
          report: reportMd,
        });
      }
    }
  }

  return index;
}

/**
 * @param {string} reportFile
 * @param {string} imageName
 */
function guessFolderFromReport(reportFile, imageName) {
  const r = reportFile.toLowerCase();
  if (r.includes("inquiry-to-talk") || r.includes("workspace-action")) return "ai-workspace-action";
  if (r.includes("workspace-search")) return "ai-workspace-search";
  if (r.includes("real-api") || r.includes("chatgpt") || r.includes("claude")) {
    return "ai-workspace-multi-ai";
  }
  if (r.includes("screenshots-viewer")) return "screenshots-viewer";
  if (imageName.includes("builder")) return "builder-general-flow-bench";
  return "misc";
}

/**
 * @param {string} p
 */
function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/");
}

/**
 * @param {{ path: string, folder: string } & Record<string, unknown>} img
 * @param {Map<string, { qaStatus: string, report: string }>} [reportIndex]
 */
export function enrichImageQa(img, reportIndex) {
  const meta = IMAGE_META[img.path];
  const fromReport = reportIndex?.get(img.path);
  const registered = REGISTERED_PATHS.has(img.path);
  const category = meta?.category || resolveCategoryLabel(img.folder);
  const categoryId = resolveCategoryId(img.folder);

  let qaStatus = meta?.qaStatus || fromReport?.qaStatus || "unknown";
  if (typeof qaStatus === "string") qaStatus = qaStatus.toLowerCase();
  if (!["pass", "fail", "unknown"].includes(qaStatus)) qaStatus = "unknown";

  const displayOrder =
    AI_WORKSPACE_DISPLAY_ORDER[img.path] ??
    NOTIFY_DISPLAY_ORDER[img.path] ??
    TALK_NOTIFY_FLOW_DISPLAY_ORDER[img.path] ??
    CONNECT_DISPLAY_ORDER[img.path];
  const flowGroup = INQUIRY_TO_TALK_FLOW.includes(img.path)
    ? "inquiry-to-talk"
    : NOTIFY_UI_REVIEW_FLOW.includes(img.path)
      ? "notify"
      : TALK_NOTIFY_FLOW_REVIEW.includes(img.path)
        ? "talk-notify-flow"
        : CONNECT_UI_REVIEW_FLOW.includes(img.path)
          ? "connect"
          : "";
  const canonical = CANONICAL_CHECKLIST.has(img.path);
  const ignored = isIgnoredPath(img.path);

  return {
    ...img,
    title: meta?.title,
    description: meta?.description,
    category,
    categoryId,
    qaStatus,
    report: meta?.report || fromReport?.report || "",
    sourceUrl: meta?.sourceUrl || "",
    registered,
    canonical,
    ignored,
    ignoreReason: ignored ? ignoreReason(img.path) : "",
    displayOrder: typeof displayOrder === "number" ? displayOrder : null,
    flowGroup,
  };
}

/**
 * @param {Array<{ categoryId?: string, registered?: boolean }>} images
 */
export function buildCategorySummary(images) {
  /** @type {Map<string, { id: string, label: string, total: number, registered: number }>} */
  const map = new Map();

  for (const rule of CATEGORY_RULES) {
    map.set(rule.id, { id: rule.id, label: rule.label, total: 0, registered: 0 });
  }

  for (const img of images) {
    if (img.ignored) continue;
    const id = img.categoryId || "other";
    if (!map.has(id)) {
      map.set(id, { id, label: id, total: 0, registered: 0 });
    }
    const row = map.get(id);
    row.total += 1;
    if (img.registered) row.registered += 1;
  }

  return [...map.values()].filter((row) => row.total > 0);
}

/**
 * @param {Array<{ path: string, registered?: boolean }>} images
 */
export function findUnregistered(images) {
  return images
    .filter((img) => img.canonical && !img.registered && !img.ignored)
    .sort((a, b) => String(b.mtime || 0) - String(a.mtime || 0));
}

/**
 * canonical だが未登録で、まだファイルも無いパス
 */
export function findMissingCanonical(images) {
  const onDisk = new Set(images.map((img) => img.path));
  return [...CANONICAL_CHECKLIST].filter((path) => !onDisk.has(path)).sort();
}

/**
 * @param {string} path
 */
export function qaPrevPath(path) {
  const rel = normalizePath(path).replace(/^screenshots\//, "");
  return `screenshots/_qa-prev/${rel}`;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function imageSearchHaystack(img) {
  return [
    img.title,
    img.description,
    img.category,
    img.categoryId,
    img.sourceUrl,
    img.report,
    img.name,
    img.path,
    img.stem,
    img.folder,
  ]
    .filter(Boolean)
    .join(" ");
}

function looksLikeFilenameQuery(query) {
  const raw = String(query || "").trim();
  if (/\.(png|jpe?g|webp|gif)$/i.test(raw)) return true;
  const base = raw.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  return /^[\w.-]+$/.test(base) && !base.includes(".") && /[-_]/.test(base);
}

function matchesFilenameQuery(img, query) {
  const q = normalizeSearchText(query);
  const name = normalizeSearchText(img.name);
  const stem = normalizeSearchText(img.stem);
  const path = normalizeSearchText(img.path);
  const qStem = q.replace(/\.(png|jpe?g|webp|gif)$/, "");
  if (name === q || stem === q || stem === qStem) return true;
  if (path.endsWith(`/${q}`) || path.endsWith(q)) return true;
  return false;
}

/**
 * @param {string} query
 */
function resolveFlowSearch(query) {
  const q = normalizeSearchText(query);
  if (!q) return null;
  for (const flow of FLOW_SEARCH) {
    if (flow.aliases.some((alias) => q === normalizeSearchText(alias))) {
      return flow;
    }
  }
  return null;
}

const SEARCH_SYNONYMS = {
  通知: ["notify", "通知", "notif"],
  求人: ["求人", "job", "応募", "job-apply"],
  一般案件: ["builder", "mvp", "案件", "thread", "board-thread"],
};

/**
 * @param {string} query
 */
function expandSearchTerms(query) {
  const q = normalizeSearchText(query);
  const terms = q.split(/\s+/).filter(Boolean);
  const extra = [];
  for (const [key, syns] of Object.entries(SEARCH_SYNONYMS)) {
    const nk = normalizeSearchText(key);
    if (q === nk || q.includes(nk) || terms.includes(nk)) {
      extra.push(...syns.map(normalizeSearchText));
    }
  }
  return [...new Set([...terms, ...extra])];
}

/**
 * @param {string} query
 */
function resolveCategoryOnlySearch(query) {
  const q = normalizeSearchText(query);
  if (q === "ai workspace" || q === "ai-workspace") return "ai-workspace";
  if (q === "builder" || q === "一般案件") return "builder";
  if (q === "talk") return "talk";
  if (q === "connect") return "connect";
  if (q === "notify" || q === "通知") return "notify";
  if (q === "ai top" || q === "ai-top") return "ai-top";
  return "";
}

/**
 * QA Center 検索と同じロジック（Node 側の件数集計用）
 * @param {{ path?: string, name?: string, stem?: string, categoryId?: string } & Record<string, unknown>} img
 * @param {string} query
 */
export function matchesImageSearch(img, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const flow = resolveFlowSearch(query);
  if (flow) {
    return (
      flow.paths.includes(String(img.path || "")) ||
      flow.stems.some(
        (stem) =>
          String(img.name || "").includes(stem) ||
          String(img.stem || "").includes(stem) ||
          String(img.path || "").includes(stem)
      )
    );
  }

  if (looksLikeFilenameQuery(query)) {
    return matchesFilenameQuery(img, query);
  }

  const categoryOnly = resolveCategoryOnlySearch(query);
  if (categoryOnly) return img.categoryId === categoryOnly;

  const hay = normalizeSearchText(imageSearchHaystack(img));
  const terms = expandSearchTerms(query);
  return terms.every((term) => hay.includes(term));
}

/**
 * @param {string} searchKeyword
 * @param {string} [baseUrl]
 */
export function buildViewerSearchUrl(searchKeyword, baseUrl = "") {
  const base = String(baseUrl || "").replace(/\/$/, "");
  const rel = `${DEFAULT_VIEWER_PATH}?search=${encodeURIComponent(String(searchKeyword || "").trim())}`;
  return base ? `${base}/${rel}` : rel;
}

/**
 * @param {Array<{ registered?: boolean } & Record<string, unknown>>} images
 * @param {string} searchKeyword
 */
export function countRegisteredSearchMatches(images, searchKeyword) {
  return images.filter((img) => img.registered && matchesImageSearch(img, searchKeyword)).length;
}

/**
 * @param {{ searchKeyword: string, baseUrl?: string, manifest?: Record<string, unknown> }} opts
 */
export function formatPassReportQaSection(opts) {
  const searchKeyword = String(opts.searchKeyword || "").trim();
  const baseUrl = opts.baseUrl || "";
  const manifest = opts.manifest || {};
  const images = /** @type {Array<Record<string, unknown>>} */ (manifest.images || []);
  const registeredMatchCount = countRegisteredSearchMatches(images, searchKeyword);
  const registeredTotal = Number(manifest.registeredCount) || REGISTERED_PATHS.size;
  const unregisteredCount = Number(manifest.unregisteredCount) || 0;
  const viewerUrl = buildViewerSearchUrl(searchKeyword, baseUrl);
  const viewerPath = buildViewerSearchUrl(searchKeyword);
  const qaComplete = unregisteredCount < 1;

  return {
    viewerUrl,
    viewerPath,
    searchKeyword,
    registeredMatchCount,
    registeredTotal,
    unregisteredCount,
    qaComplete,
    markdown: [
      "## QA Center",
      "",
      `- Viewer: \`${viewerPath}\`${baseUrl ? `（${viewerUrl}）` : ""}`,
      `- 検索キーワード: **${searchKeyword}**（登録済み ${registeredMatchCount} 枚）`,
      `- IMAGE_META 登録数: ${registeredTotal}`,
      `- 未登録 ⚠: ${unregisteredCount}${unregisteredCount >= 1 ? " — **完了不可**" : ""}`,
      "",
    ].join("\n"),
    consoleLines: [
      `QA Center: ${viewerPath}`,
      `search: ${searchKeyword} (${registeredMatchCount} registered)`,
      `IMAGE_META: ${registeredTotal} registered, unregistered ⚠ ${unregisteredCount}`,
    ],
  };
}

/**
 * 未登録 ⚠ が 1 以上なら完了扱いにしない
 * @param {Record<string, unknown>} [manifest]
 */
export function assertQaCenterReady(manifest = {}) {
  const unregisteredCount = Number(manifest.unregisteredCount) || 0;
  if (unregisteredCount >= 1) {
    return {
      ok: false,
      unregisteredCount,
      message:
        `未登録 ⚠ が ${unregisteredCount} 件あるため完了扱いにできません。` +
        " IMAGE_META へ登録するか IGNORE_PATTERNS へ移してください。",
    };
  }
  return { ok: true, unregisteredCount: 0, message: "" };
}
