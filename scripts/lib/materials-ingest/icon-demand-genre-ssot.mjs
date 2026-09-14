/**
 * Icon Demand Category SSOT V1 — Web / App / SaaS / docs / SNS / EC / ops.
 * Category ≠ function ≠ style. Does not copy Image / Illustration / Background genres.
 * Existing inventory is never auto-FILL'd.
 */
export const ICON_DEMAND_GENRE_SSOT_VERSION = "materials-icon-demand-coverage-diversity-v1";

export const ICON_FAMILIES = Object.freeze({
  outline_regular_rounded: {
    id: "outline_regular_rounded",
    slug: "fmoutreg",
    label_ja: "アウトライン",
    style: "outline",
    line_weight: "regular",
    fill_type: "none",
    shape_style: "rounded",
    color_mode: "monochrome",
    complexity: "simple",
    prompt:
      "outline vector icon, even regular stroke, rounded corners, empty fill, 24px optical size, consistent padding, even visual weight",
  },
  filled_soft: {
    id: "filled_soft",
    slug: "fmfillsoft",
    label_ja: "ソフト塗り",
    style: "filled",
    line_weight: "regular",
    fill_type: "solid",
    shape_style: "soft",
    color_mode: "monochrome",
    complexity: "simple",
    prompt:
      "filled vector icon, soft corners, solid fill, no outline, 24px optical size, consistent padding, even visual weight",
  },
  duotone_modern: {
    id: "duotone_modern",
    slug: "fmduomod",
    label_ja: "デュオトーン",
    style: "duotone",
    line_weight: "medium",
    fill_type: "duotone",
    shape_style: "rounded",
    color_mode: "two_color",
    complexity: "normal",
    prompt:
      "duotone vector icon, two-tone fill, rounded modern corners, medium stroke where needed, 24px optical size, consistent padding",
  },
  glyph_compact: {
    id: "glyph_compact",
    slug: "fmglyphcp",
    label_ja: "グリフ",
    style: "glyph",
    line_weight: "bold",
    fill_type: "solid",
    shape_style: "sharp",
    color_mode: "monochrome",
    complexity: "simple",
    prompt:
      "compact glyph icon, bold filled, sharp corners, tight padding, high visual weight, 24px optical size",
  },
  flat_simple: {
    id: "flat_simple",
    slug: "fmflatsp",
    label_ja: "フラット",
    style: "flat",
    line_weight: "regular",
    fill_type: "solid",
    shape_style: "rounded",
    color_mode: "monochrome",
    complexity: "simple",
    prompt:
      "flat vector icon, simple geometry, rounded corners, solid fill, even visual weight, 24px optical size, consistent padding",
  },
});

export const ICON_STYLES = Object.freeze({
  outline: { id: "outline", label_ja: "アウトライン" },
  filled: { id: "filled", label_ja: "塗り" },
  duotone: { id: "duotone", label_ja: "デュオトーン" },
  flat: { id: "flat", label_ja: "フラット" },
  glyph: { id: "glyph", label_ja: "グリフ" },
});

export const ICON_LINE_WEIGHTS = Object.freeze({
  thin: { id: "thin", label_ja: "細" },
  regular: { id: "regular", label_ja: "標準" },
  medium: { id: "medium", label_ja: "中" },
  bold: { id: "bold", label_ja: "太" },
});

export const ICON_FILL_TYPES = Object.freeze({
  none: { id: "none", label_ja: "なし" },
  solid: { id: "solid", label_ja: "ソリッド" },
  duotone: { id: "duotone", label_ja: "デュオトーン" },
});

export const ICON_SHAPE_STYLES = Object.freeze({
  sharp: { id: "sharp", label_ja: "シャープ" },
  rounded: { id: "rounded", label_ja: "ラウンド" },
  soft: { id: "soft", label_ja: "ソフト" },
});

export const ICON_COLOR_MODES = Object.freeze({
  monochrome: { id: "monochrome", label_ja: "モノクロ" },
  two_color: { id: "two_color", label_ja: "2色" },
  multicolor: { id: "multicolor", label_ja: "マルチ" },
});

export const ICON_COMPLEXITY = Object.freeze({
  simple: { id: "simple", label_ja: "シンプル" },
  normal: { id: "normal", label_ja: "標準" },
  detailed: { id: "detailed", label_ja: "詳細" },
});

export const ICON_USE_CASES = Object.freeze({
  app: { id: "app", label_ja: "アプリ" },
  web: { id: "web", label_ja: "Web" },
  saas: { id: "saas", label_ja: "SaaS" },
  document: { id: "document", label_ja: "資料" },
  sns: { id: "sns", label_ja: "SNS" },
  ecommerce: { id: "ecommerce", label_ja: "EC" },
  admin: { id: "admin", label_ja: "管理画面" },
});

/** Audit-only. Unique tag/subcategory hits. Never auto-FILL inventory. Title is excluded (カレンダーUI false hit). */
export const ICON_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "ビジネス", genre_ids: ["business"] },
  { legacy: "UI", genre_ids: ["ui"] },
  { legacy: "SNS", genre_ids: ["social"] },
  { legacy: "教育", genre_ids: ["education"] },
  { legacy: "医療", genre_ids: ["medical"] },
  { legacy: "スポーツ", genre_ids: ["sports"] },
  { legacy: "季節", genre_ids: ["seasonal"] },
  { legacy: "建設", genre_ids: ["housing"] },
]);

export const ICON_P0_GENRES = Object.freeze(["device", "home", "transport"]);

const FAM_UI = ["outline_regular_rounded", "filled_soft", "glyph_compact"];
const FAM_BIZ = ["outline_regular_rounded", "filled_soft", "duotone_modern"];
const FAM_TECH = ["outline_regular_rounded", "duotone_modern", "flat_simple"];
const FAM_LIFE = ["filled_soft", "flat_simple", "outline_regular_rounded"];
const FAM_MEDIA = ["filled_soft", "duotone_modern", "outline_regular_rounded"];
const FAM_SYM = ["outline_regular_rounded", "filled_soft", "glyph_compact"];

const UC_APP = ["app", "web", "saas", "admin"];
const UC_SNS = ["sns", "app", "web"];
const UC_DOC = ["document", "saas", "web"];
const UC_EC = ["ecommerce", "web", "app"];
const UC_GEN = ["app", "web", "document"];

function fn(id, ja, promptEn, useCases) {
  const sceneId = `${id}_sym`;
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(useCases || UC_APP),
    scenes: Object.freeze([
      Object.freeze({
        id: sceneId,
        path_id: sceneId.replace(/_/g, "-"),
        label_ja: ja,
        prompt_en: promptEn,
      }),
    ]),
  });
}

function genre(id, tier, weight, ja, en, families, subs, extra = {}) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    allowed_families: Object.freeze(families),
    p0_shortage: extra.p0_shortage === true,
    subgenres: Object.freeze(subs),
  });
}

export const ICON_DEMAND_GENRES = Object.freeze([
  genre("ui", "core", 12, "UI・ナビゲーション", "UI / NAVIGATION", FAM_UI, [
    fn("ui_home", "ホーム", "a house home glyph"),
    fn("ui_menu", "メニュー", "a hamburger menu glyph"),
    fn("ui_close", "閉じる", "an X close glyph"),
    fn("ui_back", "戻る", "a back chevron glyph"),
    fn("ui_forward", "進む", "a forward chevron glyph"),
    fn("ui_up", "上へ", "an up chevron glyph"),
    fn("ui_down", "下へ", "a down chevron glyph"),
    fn("ui_left", "左へ", "a left chevron glyph"),
    fn("ui_right", "右へ", "a right chevron glyph"),
    fn("ui_more", "その他", "a three-dots more glyph"),
    fn("ui_expand", "展開", "an expand arrows glyph"),
    fn("ui_collapse", "折りたたみ", "a collapse arrows glyph"),
    fn("ui_fullscreen", "全画面", "a fullscreen corners glyph"),
    fn("ui_minimize", "最小化", "a minimize dash glyph"),
    fn("ui_grid", "グリッド", "a grid of squares glyph"),
    fn("ui_list", "リスト", "a list lines glyph"),
    fn("ui_dashboard", "ダッシュボード", "a dashboard tiles glyph"),
  ]),
  genre("action", "core", 12, "操作・アクション", "ACTION / CONTROL", FAM_UI, [
    fn("act_add", "追加", "a plus add glyph"),
    fn("act_remove", "削除マイナス", "a minus remove glyph"),
    fn("act_edit", "編集", "a pencil edit glyph"),
    fn("act_delete", "削除", "a trash delete glyph"),
    fn("act_save", "保存", "a floppy save glyph"),
    fn("act_copy", "コピー", "overlapping copy rectangles glyph"),
    fn("act_paste", "貼り付け", "a clipboard paste glyph"),
    fn("act_share", "共有", "a share nodes glyph"),
    fn("act_upload", "アップロード", "an upload arrow glyph"),
    fn("act_download", "ダウンロード", "a download arrow glyph"),
    fn("act_refresh", "更新", "a refresh circular arrows glyph"),
    fn("act_sync", "同期", "a sync arrows glyph"),
    fn("act_play", "再生", "a play triangle glyph"),
    fn("act_pause", "一時停止", "a pause bars glyph"),
    fn("act_stop", "停止", "a stop square glyph"),
    fn("act_record", "録画", "a record circle glyph"),
    fn("act_search", "検索", "a magnifier search glyph"),
    fn("act_filter", "絞り込み", "a filter funnel glyph"),
    fn("act_sort", "並べ替え", "a sort arrows glyph"),
  ]),
  genre("status", "core", 11, "状態・フィードバック", "STATUS / FEEDBACK", FAM_UI, [
    fn("st_success", "成功", "a success check glyph"),
    fn("st_error", "エラー", "an error cross glyph"),
    fn("st_warning", "警告", "a warning triangle glyph"),
    fn("st_info", "情報", "an info i glyph"),
    fn("st_help", "ヘルプ", "a help question glyph"),
    fn("st_loading", "読み込み", "a loading spinner glyph"),
    fn("st_pending", "保留", "a pending clock glyph"),
    fn("st_approved", "承認", "an approved badge glyph"),
    fn("st_rejected", "却下", "a rejected stamp glyph"),
    fn("st_verified", "確認済み", "a verified badge glyph"),
    fn("st_disabled", "無効", "a disabled slash glyph"),
    fn("st_online", "オンライン", "an online status dot glyph"),
    fn("st_offline", "オフライン", "an offline status dot glyph"),
    fn("st_active", "有効", "an active toggle glyph"),
    fn("st_inactive", "停止中", "an inactive toggle glyph"),
  ]),
  genre("account", "core", 11, "アカウント・ユーザー", "ACCOUNT / USER", FAM_UI, [
    fn("acc_user", "ユーザー", "a user silhouette glyph"),
    fn("acc_profile", "プロフィール", "a profile card glyph"),
    fn("acc_account", "アカウント", "an account circle glyph"),
    fn("acc_login", "ログイン", "a login arrow glyph"),
    fn("acc_logout", "ログアウト", "a logout arrow glyph"),
    fn("acc_register", "登録", "a register form glyph"),
    fn("acc_useradd", "ユーザー追加", "a user plus glyph"),
    fn("acc_userremove", "ユーザー削除", "a user minus glyph"),
    fn("acc_group", "グループ", "a group of users glyph"),
    fn("acc_team", "チーム", "a team users glyph"),
    fn("acc_admin", "管理者", "an admin shield user glyph"),
    fn("acc_guest", "ゲスト", "a guest user glyph"),
    fn("acc_identity", "本人確認", "an identity badge glyph"),
    fn("acc_avatar", "アバター", "an avatar circle glyph"),
  ]),
  genre("security", "core", 11, "セキュリティ・プライバシー", "SECURITY / PRIVACY", FAM_BIZ, [
    fn("sec_lock", "ロック", "a padlock locked glyph"),
    fn("sec_unlock", "解除", "an unlocked padlock glyph"),
    fn("sec_shield", "シールド", "a security shield glyph"),
    fn("sec_key", "鍵", "a key glyph"),
    fn("sec_password", "パスワード", "a password dots glyph"),
    fn("sec_fingerprint", "指紋", "a fingerprint glyph"),
    fn("sec_faceauth", "顔認証", "a face-id frame glyph, no realistic face"),
    fn("sec_twofactor", "二要素認証", "a two-factor shield glyph"),
    fn("sec_privacy", "プライバシー", "a privacy mask glyph"),
    fn("sec_visibility", "表示", "an eye visibility glyph"),
    fn("sec_hidden", "非表示", "a hidden slashed-eye glyph"),
    fn("sec_alert", "セキュリティ警告", "a security alert glyph"),
    fn("sec_pay", "安全な決済", "a secure payment lock glyph"),
    fn("sec_encryption", "暗号化", "an encryption keyhole glyph"),
  ]),
  genre("communication", "core", 11, "コミュニケーション", "COMMUNICATION", FAM_UI, [
    fn("com_chat", "チャット", "a chat bubble glyph"),
    fn("com_message", "メッセージ", "a message bubble glyph"),
    fn("com_mail", "メール", "an envelope mail glyph"),
    fn("com_inbox", "受信箱", "an inbox tray glyph"),
    fn("com_send", "送信", "a send paper-plane glyph"),
    fn("com_reply", "返信", "a reply arrow glyph"),
    fn("com_phone", "電話", "a phone handset glyph"),
    fn("com_videocall", "ビデオ通話", "a video camera call glyph"),
    fn("com_mic", "マイク", "a microphone glyph"),
    fn("com_notification", "通知", "a notification badge glyph"),
    fn("com_bell", "ベル", "a bell glyph"),
    fn("com_announcement", "お知らせ", "a megaphone announcement glyph"),
    fn("com_support", "サポート", "a support headset glyph"),
    fn("com_contact", "連絡先", "a contact card glyph"),
  ]),
  genre("social", "core", 8, "SNS・ソーシャル", "SOCIAL / SNS", FAM_MEDIA, [
    fn("soc_like", "いいね", "a like thumb glyph"),
    fn("soc_favorite", "お気に入り", "a favorite star glyph"),
    fn("soc_heart", "ハート", "a heart glyph"),
    fn("soc_follow", "フォロー", "a follow user-plus glyph"),
    fn("soc_follower", "フォロワー", "a followers group glyph"),
    fn("soc_comment", "コメント", "a comment bubble glyph"),
    fn("soc_repost", "リポスト", "a repost cycle glyph"),
    fn("soc_share", "シェア", "a social share glyph"),
    fn("soc_bookmark", "ブックマーク", "a bookmark ribbon glyph"),
    fn("soc_hashtag", "ハッシュタグ", "a hashtag glyph"),
    fn("soc_mention", "メンション", "an at-mention glyph"),
    fn("soc_community", "コミュニティ", "a community nodes glyph"),
    fn("soc_creator", "クリエイター", "a creator badge glyph"),
    fn("soc_live", "ライブ配信", "a live broadcast glyph"),
  ]),
  genre("file", "core", 10, "ファイル・書類", "FILE / DOCUMENT", FAM_BIZ, [
    fn("fil_file", "ファイル", "a file page glyph", UC_DOC),
    fn("fil_folder", "フォルダ", "a folder glyph", UC_DOC),
    fn("fil_document", "書類", "a document page glyph", UC_DOC),
    fn("fil_pdf", "PDF", "a PDF document glyph", UC_DOC),
    fn("fil_image", "画像ファイル", "an image file glyph", UC_DOC),
    fn("fil_video", "動画ファイル", "a video file glyph", UC_DOC),
    fn("fil_audio", "音声ファイル", "an audio file glyph", UC_DOC),
    fn("fil_archive", "圧縮ファイル", "an archive zip glyph", UC_DOC),
    fn("fil_attachment", "添付", "a paperclip attachment glyph", UC_DOC),
    fn("fil_cloudfile", "クラウドファイル", "a cloud file glyph", UC_DOC),
    fn("fil_spreadsheet", "表計算", "a spreadsheet glyph", UC_DOC),
    fn("fil_presentation", "プレゼン資料", "a presentation slide glyph", UC_DOC),
    fn("fil_textdoc", "テキスト", "a text document glyph", UC_DOC),
  ]),
  genre("calendar", "core", 10, "日時・予定", "CALENDAR / TIME", FAM_BIZ, [
    fn("cal_calendar", "カレンダー", "a calendar page glyph", UC_DOC),
    fn("cal_clock", "時計", "a clock face glyph", UC_APP),
    fn("cal_timer", "タイマー", "a timer glyph", UC_APP),
    fn("cal_alarm", "アラーム", "an alarm clock glyph", UC_APP),
    fn("cal_schedule", "スケジュール", "a schedule calendar glyph", UC_DOC),
    fn("cal_deadline", "期限", "a deadline flag glyph", UC_DOC),
    fn("cal_history", "履歴", "a history clock arrow glyph", UC_APP),
    fn("cal_recurring", "繰り返し", "a recurring cycle glyph", UC_APP),
    fn("cal_event", "イベント", "an event calendar glyph", UC_DOC),
    fn("cal_date", "日付", "a date number calendar glyph", UC_DOC),
    fn("cal_appointment", "予約", "an appointment calendar glyph", UC_DOC),
    fn("cal_reminder", "リマインダー", "a reminder bell calendar glyph", UC_APP),
  ]),
  genre("settings", "core", 10, "設定・システム", "SETTINGS / SYSTEM", FAM_TECH, [
    fn("set_settings", "設定", "a settings sliders glyph"),
    fn("set_gear", "ギア", "a gear cog glyph"),
    fn("set_sliders", "スライダー", "adjustment sliders glyph"),
    fn("set_tools", "ツール", "a tools wrench glyph"),
    fn("set_maintenance", "メンテナンス", "a maintenance wrench glyph"),
    fn("set_database", "データベース", "a database cylinder glyph"),
    fn("set_server", "サーバー", "a server rack glyph"),
    fn("set_cloud", "クラウド", "a cloud glyph"),
    fn("set_api", "API", "an API nodes glyph"),
    fn("set_webhook", "Webhook", "a webhook lightning glyph"),
    fn("set_terminal", "ターミナル", "a terminal window glyph"),
    fn("set_automation", "自動化", "an automation gears glyph"),
    fn("set_integration", "連携", "an integration puzzle glyph"),
  ]),
  genre("business", "core", 10, "ビジネス・仕事", "BUSINESS / WORK", FAM_BIZ, [
    fn("biz_briefcase", "ブリーフケース", "a briefcase glyph", UC_DOC),
    fn("biz_office", "オフィス", "an office building glyph", UC_DOC),
    fn("biz_meeting", "会議", "a meeting table glyph, no people", UC_DOC),
    fn("biz_presentation", "プレゼン", "a presentation board glyph", UC_DOC),
    fn("biz_chart", "チャート", "a bar chart glyph", UC_DOC),
    fn("biz_target", "ターゲット", "a target bullseye glyph", UC_DOC),
    fn("biz_goal", "目標", "a goal flag glyph", UC_DOC),
    fn("biz_kpi", "KPI", "a KPI gauge glyph", UC_DOC),
    fn("biz_task", "タスク", "a task checklist glyph", UC_DOC),
    fn("biz_workflow", "ワークフロー", "a workflow nodes glyph", UC_DOC),
    fn("biz_contract", "契約", "a contract document glyph", UC_DOC),
    fn("biz_handshake", "握手", "a handshake glyph", UC_DOC),
    fn("biz_company", "会社", "a company building glyph", UC_DOC),
    fn("biz_organization", "組織", "an org chart glyph", UC_DOC),
    fn("biz_management", "マネジメント", "a management board glyph", UC_DOC),
  ]),
  genre("finance", "core", 10, "金融・決済", "FINANCE / PAYMENT", FAM_BIZ, [
    fn("fin_money", "お金", "a money bill glyph", UC_EC),
    fn("fin_yen", "円", "a yen currency glyph", UC_EC),
    fn("fin_dollar", "ドル", "a dollar currency glyph", UC_EC),
    fn("fin_wallet", "財布", "a wallet glyph", UC_EC),
    fn("fin_card", "カード", "a payment card glyph", UC_EC),
    fn("fin_payment", "決済", "a payment checkout glyph", UC_EC),
    fn("fin_invoice", "請求書", "an invoice document glyph", UC_DOC),
    fn("fin_receipt", "領収書", "a receipt glyph", UC_DOC),
    fn("fin_bank", "銀行", "a bank building glyph", UC_DOC),
    fn("fin_transfer", "振込", "a money transfer arrows glyph", UC_EC),
    fn("fin_payout", "支払", "a payout arrow glyph", UC_EC),
    fn("fin_refund", "返金", "a refund arrow glyph", UC_EC),
    fn("fin_savings", "貯蓄", "a savings piggy glyph", UC_DOC),
    fn("fin_investment", "投資", "an investment growth glyph", UC_DOC),
    fn("fin_accounting", "会計", "an accounting ledger glyph", UC_DOC),
  ]),
  genre("shopping", "core", 9, "EC・ショッピング", "EC / SHOPPING", FAM_BIZ, [
    fn("shop_cart", "カート", "a shopping cart glyph", UC_EC),
    fn("shop_basket", "カゴ", "a shopping basket glyph", UC_EC),
    fn("shop_bag", "バッグ", "a shopping bag glyph", UC_EC),
    fn("shop_product", "商品", "a product box glyph", UC_EC),
    fn("shop_package", "荷物", "a package box glyph", UC_EC),
    fn("shop_store", "店舗", "a store front glyph", UC_EC),
    fn("shop_shop", "ショップ", "a shop sign glyph", UC_EC),
    fn("shop_coupon", "クーポン", "a coupon ticket glyph", UC_EC),
    fn("shop_sale", "セール", "a sale tag glyph", UC_EC),
    fn("shop_tag", "タグ", "a price tag glyph", UC_EC),
    fn("shop_barcode", "バーコード", "a barcode glyph", UC_EC),
    fn("shop_delivery", "配送", "a delivery truck glyph", UC_EC),
    fn("shop_order", "注文", "an order clipboard glyph", UC_EC),
    fn("shop_return", "返品", "a return package glyph", UC_EC),
    fn("shop_review", "レビュー", "a review stars glyph", UC_EC),
  ]),
  genre("marketing", "supporting", 6, "マーケティング・分析", "MARKETING / ANALYTICS", FAM_BIZ, [
    fn("mkt_graph", "グラフ", "a line graph glyph", UC_DOC),
    fn("mkt_analytics", "分析", "an analytics dashboard glyph", UC_DOC),
    fn("mkt_trend", "トレンド", "a trend up arrow glyph", UC_DOC),
    fn("mkt_growth", "成長", "a growth chart glyph", UC_DOC),
    fn("mkt_conversion", "コンバージョン", "a conversion funnel glyph", UC_DOC),
    fn("mkt_funnel", "ファネル", "a marketing funnel glyph", UC_DOC),
    fn("mkt_campaign", "キャンペーン", "a campaign flag glyph", UC_DOC),
    fn("mkt_ads", "広告", "an ads megaphone glyph", UC_DOC),
    fn("mkt_megaphone", "メガホン", "a megaphone glyph", UC_DOC),
    fn("mkt_seo", "SEO", "an SEO search glyph", UC_DOC),
    fn("mkt_audience", "オーディエンス", "an audience users glyph", UC_DOC),
    fn("mkt_insight", "インサイト", "an insight bulb glyph", UC_DOC),
    fn("mkt_report", "レポート", "a report document glyph", UC_DOC),
    fn("mkt_metrics", "指標", "a metrics bars glyph", UC_DOC),
  ]),
  genre("recruitment", "supporting", 5, "求人・人事", "RECRUITMENT / HR", FAM_BIZ, [
    fn("hr_recruitment", "採用", "a recruitment briefcase glyph", UC_DOC),
    fn("hr_job", "求人", "a job listing glyph", UC_DOC),
    fn("hr_resume", "履歴書", "a resume document glyph", UC_DOC),
    fn("hr_interview", "面接", "an interview chairs glyph, no people", UC_DOC),
    fn("hr_employee", "社員", "an employee badge glyph", UC_DOC),
    fn("hr_candidate", "候補者", "a candidate profile glyph", UC_DOC),
    fn("hr_hiring", "雇用", "a hiring check glyph", UC_DOC),
    fn("hr_onboarding", "入社", "an onboarding checklist glyph", UC_DOC),
    fn("hr_training", "研修", "a training book glyph", UC_DOC),
    fn("hr_evaluation", "評価", "an evaluation stars glyph", UC_DOC),
    fn("hr_attendance", "勤怠", "an attendance clock glyph", UC_DOC),
    fn("hr_payroll", "給与", "a payroll yen glyph", UC_DOC),
    fn("hr_organization", "人事組織", "an HR org chart glyph", UC_DOC),
  ]),
  genre("legal", "supporting", 4, "法務・士業", "LEGAL / PROFESSIONAL", FAM_BIZ, [
    fn("leg_law", "法律", "a law book glyph", UC_DOC),
    fn("leg_scale", "天秤", "a justice scale glyph", UC_DOC),
    fn("leg_gavel", "木槌", "a gavel glyph", UC_DOC),
    fn("leg_contract", "契約書", "a legal contract glyph", UC_DOC),
    fn("leg_stamp", "印鑑", "a stamp seal glyph", UC_DOC),
    fn("leg_certificate", "証明書", "a certificate glyph", UC_DOC),
    fn("leg_signature", "署名", "a signature glyph", UC_DOC),
    fn("leg_compliance", "コンプライアンス", "a compliance shield glyph", UC_DOC),
    fn("leg_legaldoc", "法務書類", "a legal document glyph", UC_DOC),
    fn("leg_consultation", "相談", "a consultation desk glyph, no people", UC_DOC),
    fn("leg_tax", "税務", "a tax document glyph", UC_DOC),
    fn("leg_audit", "監査", "an audit checklist glyph", UC_DOC),
  ]),
  genre("device", "core", 11, "デバイス・テクノロジー", "DEVICE / TECHNOLOGY", FAM_TECH, [
    fn("dvc_desktop", "デスクトップ", "a desktop computer glyph"),
    fn("dvc_laptop", "ノートPC", "a laptop computer glyph"),
    fn("dvc_smartphone", "スマートフォン", "a smartphone glyph"),
    fn("dvc_tablet", "タブレット", "a tablet device glyph"),
    fn("dvc_smartwatch", "スマートウォッチ", "a smartwatch glyph"),
    fn("dvc_camera", "カメラ", "a camera glyph"),
    fn("dvc_headphones", "ヘッドホン", "headphones glyph"),
    fn("dvc_speaker", "スピーカー", "a speaker glyph"),
    fn("dvc_keyboard", "キーボード", "a keyboard glyph"),
    fn("dvc_mouse", "マウス", "a computer mouse glyph"),
    fn("dvc_printer", "プリンタ", "a printer glyph"),
    fn("dvc_monitor", "モニタ", "a monitor screen glyph"),
    fn("dvc_router", "ルータ", "a wifi router glyph"),
    fn("dvc_chip", "チップ", "a microchip glyph"),
    fn("dvc_usb", "USB", "a USB stick glyph"),
    fn("dvc_battery", "電池", "a battery glyph"),
  ], { p0_shortage: true }),
  genre("aidata", "core", 9, "AI・データ・クラウド", "AI / DATA / CLOUD", FAM_TECH, [
    fn("ai_ai", "AI", "an AI spark glyph"),
    fn("ai_robot", "ロボット", "a simple robot head glyph, no person"),
    fn("ai_neural", "ニューラルネットワーク", "a neural network nodes glyph"),
    fn("ai_data", "データ", "a data cylinders glyph"),
    fn("ai_database", "AIデータベース", "a database stack glyph"),
    fn("ai_cloud", "AIクラウド", "an AI cloud glyph"),
    fn("ai_ml", "機械学習", "a machine learning graph glyph"),
    fn("ai_automation", "AI自動化", "an AI automation gear glyph"),
    fn("ai_bot", "ボット", "a chat bot glyph"),
    fn("ai_api", "AI API", "an AI API nodes glyph"),
    fn("ai_model", "モデル", "an AI model cube glyph"),
    fn("ai_analytics", "AI分析", "an AI analytics glyph"),
    fn("ai_compute", "コンピュート", "a compute chip glyph"),
    fn("ai_dataflow", "データフロー", "a data flow arrows glyph"),
  ]),
  genre("development", "core", 7, "開発・コード", "DEVELOPMENT / CODE", FAM_TECH, [
    fn("code_code", "コード", "code brackets glyph"),
    fn("code_terminal", "開発ターミナル", "a developer terminal glyph"),
    fn("code_bug", "バグ", "a bug glyph"),
    fn("code_git", "Git", "a git branching glyph"),
    fn("code_branch", "ブランチ", "a git branch glyph"),
    fn("code_merge", "マージ", "a merge arrows glyph"),
    fn("code_deploy", "デプロイ", "a deploy rocket glyph"),
    fn("code_build", "ビルド", "a build hammer glyph"),
    fn("code_test", "テスト", "a test flask glyph"),
    fn("code_package", "パッケージ", "a code package glyph"),
    fn("code_repository", "リポジトリ", "a repository glyph"),
    fn("code_developer", "開発者", "a developer workstation glyph, no person"),
    fn("code_ide", "IDE", "an IDE window glyph"),
    fn("code_command", "コマンド", "a command prompt glyph"),
  ]),
  genre("network", "core", 6, "ネットワーク・接続", "NETWORK / CONNECTIVITY", FAM_TECH, [
    fn("net_wifi", "Wi-Fi", "a wifi signal glyph"),
    fn("net_bluetooth", "Bluetooth", "a bluetooth rune glyph"),
    fn("net_network", "ネットワーク", "a network nodes glyph"),
    fn("net_signal", "電波", "a signal bars glyph"),
    fn("net_ethernet", "有線LAN", "an ethernet port glyph"),
    fn("net_satellite", "衛星", "a satellite glyph"),
    fn("net_hotspot", "ホットスポット", "a hotspot glyph"),
    fn("net_connected", "接続中", "a connected link glyph"),
    fn("net_disconnected", "未接続", "a disconnected slash glyph"),
    fn("net_link", "リンク", "a chain link glyph"),
    fn("net_internet", "インターネット", "an internet globe glyph"),
    fn("net_globe", "地球", "a globe glyph"),
  ]),
  genre("home", "core", 10, "生活・日用品", "HOME / DAILY LIFE", FAM_LIFE, [
    fn("home_house", "家", "a house glyph", UC_GEN),
    fn("home_room", "部屋", "a room interior glyph, no people", UC_GEN),
    fn("home_furniture", "家具", "a furniture chair glyph", UC_GEN),
    fn("home_bed", "ベッド", "a bed glyph", UC_GEN),
    fn("home_sofa", "ソファ", "a sofa glyph", UC_GEN),
    fn("home_lamp", "ランプ", "a lamp glyph", UC_GEN),
    fn("home_kitchen", "キッチン", "a kitchen stove glyph", UC_GEN),
    fn("home_bath", "風呂", "a bathtub glyph", UC_GEN),
    fn("home_toilet", "トイレ", "a toilet glyph", UC_GEN),
    fn("home_cleaning", "掃除", "a broom cleaning glyph", UC_GEN),
    fn("home_laundry", "洗濯", "a washing machine glyph", UC_GEN),
    fn("home_trash", "ゴミ", "a trash bin glyph", UC_GEN),
    fn("home_shoppingbag", "買い物袋", "a daily shopping bag glyph", UC_GEN),
    fn("home_umbrella", "傘", "an umbrella glyph", UC_GEN),
    fn("home_key", "家の鍵", "a house key glyph", UC_GEN),
    fn("home_daily", "日用品", "a daily goods bottle glyph", UC_GEN),
  ], { p0_shortage: true }),
  genre("food", "supporting", 5, "食べ物・飲み物", "FOOD / DRINK", FAM_LIFE, [
    fn("food_food", "食事", "a meal plate glyph", UC_GEN),
    fn("food_restaurant", "レストラン", "a restaurant fork-knife glyph", UC_GEN),
    fn("food_fork", "フォーク", "a fork glyph", UC_GEN),
    fn("food_knife", "ナイフ", "a table knife glyph", UC_GEN),
    fn("food_spoon", "スプーン", "a spoon glyph", UC_GEN),
    fn("food_coffee", "コーヒー", "a coffee cup glyph", UC_GEN),
    fn("food_tea", "お茶", "a tea cup glyph", UC_GEN),
    fn("food_drink", "ドリンク", "a drink glass glyph", UC_GEN),
    fn("food_bottle", "ボトル", "a bottle glyph", UC_GEN),
    fn("food_bread", "パン", "a bread loaf glyph", UC_GEN),
    fn("food_cake", "ケーキ", "a cake slice glyph", UC_GEN),
    fn("food_fruit", "果物", "an apple fruit glyph", UC_GEN),
    fn("food_vegetable", "野菜", "a carrot vegetable glyph", UC_GEN),
    fn("food_cooking", "料理", "a cooking pot glyph", UC_GEN),
    fn("food_menu", "メニュー表", "a restaurant menu glyph", UC_GEN),
  ]),
  genre("housing", "supporting", 5, "住宅・建築", "HOUSING / CONSTRUCTION", FAM_LIFE, [
    fn("hous_house", "住宅", "a residential house glyph", UC_GEN),
    fn("hous_building", "ビル", "an office building glyph", UC_GEN),
    fn("hous_apartment", "マンション", "an apartment building glyph", UC_GEN),
    fn("hous_construction", "工事", "a construction site glyph", UC_GEN),
    fn("hous_hammer", "ハンマー", "a hammer glyph", UC_GEN),
    fn("hous_screwdriver", "ドライバー", "a screwdriver glyph", UC_GEN),
    fn("hous_drill", "ドリル", "a power drill glyph", UC_GEN),
    fn("hous_helmet", "ヘルメット", "a hard hat glyph", UC_GEN),
    fn("hous_blueprint", "設計図", "a blueprint glyph", UC_GEN),
    fn("hous_renovation", "リフォーム", "a renovation roller glyph", UC_GEN),
    fn("hous_paint", "塗装", "a paint roller glyph", UC_GEN),
    fn("hous_ruler", "定規", "a ruler glyph", UC_GEN),
    fn("hous_crane", "クレーン", "a crane glyph", UC_GEN),
    fn("hous_tools", "工具", "construction tools glyph", UC_GEN),
  ]),
  genre("transport", "core", 10, "乗り物・交通", "TRANSPORT / MOBILITY", FAM_LIFE, [
    fn("tr_car", "車", "a car glyph", UC_GEN),
    fn("tr_taxi", "タクシー", "a taxi car glyph", UC_GEN),
    fn("tr_bus", "バス", "a bus glyph", UC_GEN),
    fn("tr_train", "電車", "a train glyph", UC_GEN),
    fn("tr_subway", "地下鉄", "a subway glyph", UC_GEN),
    fn("tr_airplane", "飛行機", "an airplane glyph", UC_GEN),
    fn("tr_bicycle", "自転車", "a bicycle glyph", UC_GEN),
    fn("tr_motorcycle", "バイク", "a motorcycle glyph", UC_GEN),
    fn("tr_truck", "トラック", "a truck glyph", UC_GEN),
    fn("tr_ship", "船", "a ship glyph", UC_GEN),
    fn("tr_parking", "駐車場", "a parking P glyph", UC_GEN),
    fn("tr_traffic", "信号", "a traffic light glyph", UC_GEN),
    fn("tr_road", "道路", "a road glyph", UC_GEN),
    fn("tr_station", "駅", "a train station glyph", UC_GEN),
    fn("tr_charging", "充電スタンド", "an EV charging station glyph", UC_GEN),
  ], { p0_shortage: true }),
  genre("travel", "supporting", 5, "旅行・場所", "TRAVEL / LOCATION", FAM_LIFE, [
    fn("tvl_map", "地図", "a map glyph", UC_GEN),
    fn("tvl_pin", "ピン", "a map pin glyph", UC_GEN),
    fn("tvl_compass", "コンパス", "a compass glyph", UC_GEN),
    fn("tvl_suitcase", "スーツケース", "a suitcase glyph", UC_GEN),
    fn("tvl_hotel", "ホテル", "a hotel building glyph", UC_GEN),
    fn("tvl_passport", "パスポート", "a passport glyph", UC_GEN),
    fn("tvl_ticket", "チケット", "a travel ticket glyph", UC_GEN),
    fn("tvl_airport", "空港", "an airport glyph", UC_GEN),
    fn("tvl_landmark", "ランドマーク", "a landmark tower glyph", UC_GEN),
    fn("tvl_beach", "ビーチ", "a beach umbrella glyph", UC_GEN),
    fn("tvl_mountain", "山", "a mountain glyph", UC_GEN),
    fn("tvl_tourism", "観光", "a tourism camera glyph", UC_GEN),
    fn("tvl_route", "ルート", "a route path glyph", UC_GEN),
  ]),
  genre("medical", "core", 7, "医療・健康", "MEDICAL / HEALTH", FAM_BIZ, [
    fn("med_hospital", "病院", "a hospital building glyph", UC_GEN),
    fn("med_doctor", "医師", "a doctor stethoscope glyph, no person", UC_GEN),
    fn("med_nurse", "看護師", "a nurse cross glyph, no person", UC_GEN),
    fn("med_medicine", "薬", "a medicine bottle glyph", UC_GEN),
    fn("med_pill", "錠剤", "a pill capsule glyph", UC_GEN),
    fn("med_syringe", "注射器", "a syringe glyph", UC_GEN),
    fn("med_stethoscope", "聴診器", "a stethoscope glyph", UC_GEN),
    fn("med_heart", "心臓", "a medical heart glyph", UC_GEN),
    fn("med_health", "健康", "a health cross glyph", UC_GEN),
    fn("med_firstaid", "救急", "a first-aid kit glyph", UC_GEN),
    fn("med_dental", "歯科", "a dental tooth glyph", UC_GEN),
    fn("med_wheelchair", "車椅子", "a wheelchair glyph", UC_GEN),
    fn("med_wellness", "ウェルネス", "a wellness leaf glyph", UC_GEN),
    fn("med_record", "カルテ", "a medical record glyph", UC_DOC),
  ]),
  genre("education", "core", 6, "教育・学習", "EDUCATION / LEARNING", FAM_BIZ, [
    fn("edu_school", "学校", "a school building glyph", UC_GEN),
    fn("edu_book", "本", "a book glyph", UC_GEN),
    fn("edu_notebook", "ノート", "a notebook glyph", UC_GEN),
    fn("edu_pencil", "鉛筆", "a pencil glyph", UC_GEN),
    fn("edu_graduation", "卒業", "a graduation cap glyph", UC_GEN),
    fn("edu_teacher", "教師", "a teacher desk glyph, no person", UC_GEN),
    fn("edu_student", "生徒", "a student backpack glyph, no person", UC_GEN),
    fn("edu_learning", "学習", "a learning book glyph", UC_GEN),
    fn("edu_quiz", "クイズ", "a quiz question glyph", UC_GEN),
    fn("edu_certificate", "修了証", "a diploma certificate glyph", UC_GEN),
    fn("edu_online", "オンライン学習", "an online learning screen glyph", UC_GEN),
    fn("edu_library", "図書館", "a library books glyph", UC_GEN),
    fn("edu_science", "理科", "a science flask glyph", UC_GEN),
    fn("edu_calculator", "電卓", "a calculator glyph", UC_GEN),
  ]),
  genre("family", "supporting", 3, "家族・子育て", "FAMILY / CHILDCARE", FAM_LIFE, [
    fn("fam_family", "家族", "a family house glyph, no faces", UC_GEN),
    fn("fam_parent", "親", "a parent and child silhouette glyph, no faces", UC_GEN),
    fn("fam_child", "子ども", "a child figure glyph, no face", UC_GEN),
    fn("fam_baby", "赤ちゃん", "a baby bottle glyph", UC_GEN),
    fn("fam_stroller", "ベビーカー", "a stroller glyph", UC_GEN),
    fn("fam_childcare", "保育", "a childcare blocks glyph", UC_GEN),
    fn("fam_toy", "おもちゃ", "a toy block glyph", UC_GEN),
    fn("fam_schoolchild", "児童", "a school bag glyph", UC_GEN),
    fn("fam_maternity", "マタニティ", "a maternity heart glyph", UC_GEN),
    fn("fam_bottle", "哺乳瓶", "a baby bottle glyph", UC_GEN),
    fn("fam_home", "家族の家", "a family home glyph", UC_GEN),
  ]),
  genre("senior", "supporting", 3, "シニア・介護", "SENIOR / CARE", FAM_LIFE, [
    fn("snr_senior", "シニア", "a senior care glyph, no face", UC_GEN),
    fn("snr_elderly", "高齢者", "an elderly support glyph, no face", UC_GEN),
    fn("snr_care", "介護", "a care hands glyph, no face", UC_GEN),
    fn("snr_stick", "杖", "a walking stick glyph", UC_GEN),
    fn("snr_wheelchair", "介護車椅子", "a care wheelchair glyph", UC_GEN),
    fn("snr_caregiver", "介護者", "a caregiver badge glyph, no person", UC_GEN),
    fn("snr_rehab", "リハビリ", "a rehabilitation glyph", UC_GEN),
    fn("snr_home", "介護施設", "a senior home building glyph", UC_GEN),
    fn("snr_assistance", "介助", "an assistance hand glyph", UC_GEN),
  ]),
  genre("media", "core", 9, "メディア・クリエイター", "MEDIA / CREATOR", FAM_MEDIA, [
    fn("crea_video", "動画", "a video clapper glyph", UC_SNS),
    fn("crea_camera", "撮影", "a creator camera glyph", UC_SNS),
    fn("crea_microphone", "収録マイク", "a studio microphone glyph", UC_SNS),
    fn("crea_music", "音楽制作", "a music note glyph", UC_SNS),
    fn("crea_image", "画像制作", "an image frame glyph", UC_SNS),
    fn("crea_editing", "編集", "a video editing scissors glyph", UC_SNS),
    fn("crea_timeline", "タイムライン", "an editing timeline glyph", UC_SNS),
    fn("crea_live", "配信", "a live streaming glyph", UC_SNS),
    fn("crea_streaming", "ストリーミング", "a streaming play glyph", UC_SNS),
    fn("crea_podcast", "ポッドキャスト", "a podcast mic glyph", UC_SNS),
    fn("crea_creator", "クリエイター印", "a creator star glyph", UC_SNS),
    fn("crea_studio", "スタジオ", "a studio mixer glyph", UC_SNS),
    fn("crea_recording", "録音", "a recording wave glyph", UC_SNS),
    fn("crea_broadcast", "放送", "a broadcast tower glyph", UC_SNS),
  ]),
  genre("photovideo", "supporting", 6, "写真・動画操作", "PHOTO / VIDEO CONTROL", FAM_MEDIA, [
    fn("pv_shutter", "シャッター", "a camera shutter glyph"),
    fn("pv_aperture", "絞り", "an aperture iris glyph"),
    fn("pv_crop", "切り抜き", "a crop frame glyph"),
    fn("pv_rotate", "回転", "a rotate arrows glyph"),
    fn("pv_flip", "反転", "a flip arrows glyph"),
    fn("pv_brightness", "明るさ", "a brightness sun glyph"),
    fn("pv_contrast", "コントラスト", "a contrast circle glyph"),
    fn("pv_volume", "音量操作", "a volume speaker glyph"),
    fn("pv_subtitle", "字幕", "a subtitle CC glyph"),
    fn("pv_timeline", "映像タイムライン", "a video timeline glyph"),
    fn("pv_frame", "フレーム", "a film frame glyph"),
    fn("pv_resolution", "解像度", "a resolution grid glyph"),
    fn("pv_aspect", "アスペクト比", "an aspect-ratio rectangle glyph"),
  ]),
  genre("audio", "supporting", 5, "音楽・音声", "MUSIC / AUDIO", FAM_MEDIA, [
    fn("aud_note", "音符", "a music note glyph", UC_SNS),
    fn("aud_waveform", "波形", "an audio waveform glyph", UC_SNS),
    fn("aud_volume", "音量", "a volume glyph", UC_SNS),
    fn("aud_mute", "ミュート", "a mute speaker glyph", UC_SNS),
    fn("aud_headphones", "ヘッドフォン", "audio headphones glyph", UC_SNS),
    fn("aud_speaker", "スピーカー機器", "an audio speaker glyph", UC_SNS),
    fn("aud_microphone", "音声マイク", "an audio microphone glyph", UC_SNS),
    fn("aud_playlist", "プレイリスト", "a playlist glyph", UC_SNS),
    fn("aud_equalizer", "イコライザ", "an equalizer bars glyph", UC_SNS),
    fn("aud_file", "音声ファイル記号", "an audio file glyph", UC_SNS),
    fn("aud_radio", "ラジオ", "a radio glyph", UC_SNS),
    fn("aud_podcast", "音声配信", "a podcast badge glyph", UC_SNS),
  ]),
  genre("sports", "supporting", 4, "スポーツ・フィットネス", "SPORTS / FITNESS", FAM_LIFE, [
    fn("spt_running", "ランニング", "a running shoe glyph", UC_GEN),
    fn("spt_gym", "ジム", "a gym weight glyph", UC_GEN),
    fn("spt_dumbbell", "ダンベル", "a dumbbell glyph", UC_GEN),
    fn("spt_football", "サッカー", "a football glyph", UC_GEN),
    fn("spt_baseball", "野球", "a baseball glyph", UC_GEN),
    fn("spt_basketball", "バスケ", "a basketball glyph", UC_GEN),
    fn("spt_tennis", "テニス", "a tennis racquet glyph", UC_GEN),
    fn("spt_swimming", "水泳", "a swimming glyph", UC_GEN),
    fn("spt_cycling", "サイクリング", "a cycling glyph", UC_GEN),
    fn("spt_yoga", "ヨガ", "a yoga mat glyph", UC_GEN),
    fn("spt_trophy", "トロフィー", "a trophy glyph", UC_GEN),
    fn("spt_medal", "メダル", "a medal glyph", UC_GEN),
  ]),
  genre("weather", "supporting", 4, "天気・自然", "WEATHER / NATURE", FAM_LIFE, [
    fn("wx_sun", "晴れ", "a sun glyph", UC_GEN),
    fn("wx_moon", "月", "a moon glyph", UC_GEN),
    fn("wx_cloud", "曇り", "a weather cloud glyph", UC_GEN),
    fn("wx_rain", "雨", "a rain cloud glyph", UC_GEN),
    fn("wx_snow", "雪", "a snowflake glyph", UC_GEN),
    fn("wx_thunder", "雷", "a thunder bolt glyph", UC_GEN),
    fn("wx_wind", "風", "a wind glyph", UC_GEN),
    fn("wx_temperature", "気温", "a thermometer glyph", UC_GEN),
    fn("wx_leaf", "葉", "a leaf glyph", UC_GEN),
    fn("wx_tree", "木", "a tree glyph", UC_GEN),
    fn("wx_flower", "花", "a flower glyph", UC_GEN),
    fn("wx_mountain", "自然の山", "a nature mountain glyph", UC_GEN),
    fn("wx_water", "水", "a water drop glyph", UC_GEN),
    fn("wx_eco", "エコ", "an eco leaf glyph", UC_GEN),
  ]),
  genre("safety", "supporting", 5, "安全・緊急", "SAFETY / EMERGENCY", FAM_BIZ, [
    fn("saf_emergency", "緊急", "an emergency siren glyph", UC_GEN),
    fn("saf_sos", "SOS", "an SOS badge glyph", UC_GEN),
    fn("saf_fire", "火災", "a fire flame glyph", UC_GEN),
    fn("saf_ambulance", "救急車", "an ambulance glyph", UC_GEN),
    fn("saf_evacuation", "避難", "an evacuation exit glyph", UC_GEN),
    fn("saf_disaster", "災害", "a disaster alert glyph", UC_GEN),
    fn("saf_caution", "注意", "a caution triangle glyph", UC_GEN),
    fn("saf_danger", "危険", "a danger skull-free warning glyph", UC_GEN),
    fn("saf_helmet", "安全帽", "a safety helmet glyph", UC_GEN),
    fn("saf_firstaid", "応急手当", "an emergency first-aid glyph", UC_GEN),
    fn("saf_call", "緊急通報", "an emergency call glyph", UC_GEN),
    fn("saf_shelter", "避難所", "a shelter building glyph", UC_GEN),
  ]),
  genre("seasonal", "supporting", 4, "イベント・季節", "EVENT / SEASON", FAM_LIFE, [
    fn("evt_gift", "ギフト", "a gift box glyph", UC_GEN),
    fn("evt_birthday", "誕生日", "a birthday balloon glyph", UC_GEN),
    fn("evt_party", "パーティー", "a party popper glyph", UC_GEN),
    fn("evt_cake", "お祝いケーキ", "a celebration cake glyph", UC_GEN),
    fn("evt_christmas", "クリスマス", "a christmas tree glyph", UC_GEN),
    fn("evt_halloween", "ハロウィン", "a halloween pumpkin glyph", UC_GEN),
    fn("evt_newyear", "正月", "a new year kadomatsu glyph", UC_GEN),
    fn("evt_sakura", "桜", "a sakura flower glyph", UC_GEN),
    fn("evt_fireworks", "花火", "a fireworks glyph", UC_GEN),
    fn("evt_festival", "祭り", "a festival lantern glyph", UC_GEN),
    fn("evt_event", "イベント", "an event banner glyph", UC_GEN),
    fn("evt_celebration", "お祝い", "a celebration sparkle glyph", UC_GEN),
  ]),
  genre("beauty", "supporting", 3, "美容・ファッション", "BEAUTY / FASHION", FAM_LIFE, [
    fn("bty_cosmetic", "化粧品", "a cosmetic bottle glyph", UC_GEN),
    fn("bty_lipstick", "口紅", "a lipstick glyph", UC_GEN),
    fn("bty_mirror", "鏡", "a hand mirror glyph", UC_GEN),
    fn("bty_perfume", "香水", "a perfume bottle glyph", UC_GEN),
    fn("bty_hair", "ヘア", "a hairbrush glyph", UC_GEN),
    fn("bty_salon", "サロン", "a salon scissors glyph", UC_GEN),
    fn("bty_nail", "ネイル", "a nail polish glyph", UC_GEN),
    fn("bty_clothing", "衣服", "a clothing hanger glyph", UC_GEN),
    fn("bty_shoes", "靴", "a shoe glyph", UC_GEN),
    fn("bty_bag", "ファッションバッグ", "a fashion bag glyph", UC_GEN),
    fn("bty_jewelry", "ジュエリー", "a jewelry gem glyph", UC_GEN),
    fn("bty_beauty", "美容", "a beauty sparkle glyph", UC_GEN),
  ]),
  genre("a11y", "supporting", 5, "アクセシビリティ", "ACCESSIBILITY", FAM_UI, [
    fn("a11y_wheelchair", "車椅子マーク", "an accessibility wheelchair glyph"),
    fn("a11y_hearing", "聴覚", "a hearing ear glyph"),
    fn("a11y_vision", "視覚", "a vision eye glyph"),
    fn("a11y_access", "アクセシビリティ", "an accessibility person glyph"),
    fn("a11y_sign", "手話", "a sign-language hands glyph, no face"),
    fn("a11y_device", "支援機器", "an assistive device glyph"),
    fn("a11y_captions", "キャプション", "captions CC glyph"),
    fn("a11y_voice", "音声読み上げ", "a voice waveform glyph"),
    fn("a11y_readable", "読みやすさ", "a readable text glyph"),
    fn("a11y_universal", "ユニバーサル", "a universal access glyph"),
  ]),
  genre("place", "supporting", 4, "場所・施設", "MAP / PLACE / FACILITY", FAM_LIFE, [
    fn("plc_hospital", "病院施設", "a hospital map-pin glyph", UC_GEN),
    fn("plc_school", "学校施設", "a school map-pin glyph", UC_GEN),
    fn("plc_bank", "銀行施設", "a bank map-pin glyph", UC_GEN),
    fn("plc_restaurant", "飲食店", "a restaurant map-pin glyph", UC_GEN),
    fn("plc_hotel", "宿泊施設", "a hotel map-pin glyph", UC_GEN),
    fn("plc_convenience", "コンビニ", "a convenience store glyph", UC_GEN),
    fn("plc_station", "駅施設", "a station map-pin glyph", UC_GEN),
    fn("plc_airport", "空港施設", "an airport map-pin glyph", UC_GEN),
    fn("plc_toilet", "トイレ施設", "a restroom glyph", UC_GEN),
    fn("plc_parking", "駐車場施設", "a parking facility glyph", UC_GEN),
    fn("plc_office", "オフィス施設", "an office map-pin glyph", UC_GEN),
    fn("plc_public", "公共施設", "a public facility glyph", UC_GEN),
  ]),
  genre("symbol", "supporting", 5, "記号・汎用シンボル", "SHAPE / SYMBOL", FAM_SYM, [
    fn("sym_check", "チェック", "a check mark glyph"),
    fn("sym_cross", "バツ", "a cross mark glyph"),
    fn("sym_plus", "プラス", "a plus mark glyph"),
    fn("sym_minus", "マイナス", "a minus mark glyph"),
    fn("sym_circle", "円", "a circle shape glyph"),
    fn("sym_square", "四角", "a square shape glyph"),
    fn("sym_triangle", "三角", "a triangle shape glyph"),
    fn("sym_star", "星", "a star glyph"),
    fn("sym_arrow", "矢印", "an arrow glyph"),
    fn("sym_question", "疑問符", "a question mark glyph"),
    fn("sym_exclamation", "感嘆符", "an exclamation mark glyph"),
    fn("sym_info", "インフォ", "an info mark glyph"),
    fn("sym_prohibition", "禁止", "a prohibition slash glyph"),
    fn("sym_badge", "バッジ", "a badge glyph"),
  ]),
]);

export const ICON_CORE_GENRE_COUNT = ICON_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const ICON_SUPPORTING_GENRE_COUNT = ICON_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;
export const ICON_QA_CORE_GENRES = Object.freeze([
  "ui",
  "status",
  "finance",
  "device",
  "home",
  "transport",
  "medical",
  "media",
]);

const GENRE_BY_ID = new Map(ICON_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const g of ICON_DEMAND_GENRES) {
  for (const sg of g.subgenres) {
    SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
    for (const scene of sg.scenes) SCENE_BY_ID.set(scene.id, { genre: g, subgenre: sg, scene });
  }
}

const FAMILY_BY_SLUG = new Map(Object.values(ICON_FAMILIES).map((f) => [f.slug, f.id]));

export function listIconSubgenres() {
  return ICON_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getIconGenre(id) {
  return GENRE_BY_ID.get(String(id || "")) || null;
}
export function getIconSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getIconScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getIconFamily(id) {
  return ICON_FAMILIES[String(id || "")] || null;
}

export function applyIconFamily(spec) {
  const fam = getIconFamily(spec?.icon_family);
  if (!fam) return spec;
  return {
    ...spec,
    style: fam.style,
    line_weight: fam.line_weight,
    fill_type: fam.fill_type,
    shape_style: fam.shape_style,
    color_mode: fam.color_mode,
    complexity: fam.complexity,
  };
}

export function validateIconGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const g of ICON_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    if (typeof g.demand_weight !== "number") issues.push(`weight:${g.id}`);
    for (const fam of g.allowed_families || []) {
      if (!ICON_FAMILIES[fam]) issues.push(`family:${g.id}:${fam}`);
    }
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id)) issues.push(`dup_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) {
        if (!ICON_USE_CASES[uc]) issues.push(`use:${sg.id}:${uc}`);
      }
      for (const scene of sg.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`dup_scene:${scene.id}`);
        sceneIds.add(scene.id);
      }
    }
  }
  if (ICON_DEMAND_GENRES.length !== 40) issues.push(`genre_count:${ICON_DEMAND_GENRES.length}`);
  for (const id of ICON_QA_CORE_GENRES) {
    if (!GENRE_BY_ID.has(id)) issues.push(`qa_core_missing:${id}`);
  }
  for (const id of ICON_P0_GENRES) {
    if (!GENRE_BY_ID.get(id)?.p0_shortage) issues.push(`p0_flag:${id}`);
  }
  return {
    ok: issues.length === 0,
    issues,
    core: ICON_CORE_GENRE_COUNT,
    supporting: ICON_SUPPORTING_GENRE_COUNT,
    genres: ICON_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

export function iconSpecFingerprint(spec) {
  return [spec?.genre, spec?.subcategory, spec?.scene, spec?.icon_family, spec?.style, spec?.line_weight, spec?.fill_type, spec?.shape_style]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function buildIconJapaneseTitle(spec) {
  const found = getIconScene(spec.scene) || getIconSubgenre(spec.subcategory);
  const label = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "アイコン";
  const fam = getIconFamily(spec.icon_family);
  const title = fam ? `${label}アイコン（${fam.label_ja}）` : `${label}アイコン`;
  return title.slice(0, 32);
}

export function buildIconDescription(spec) {
  const g = getIconGenre(spec.genre);
  return [getIconScene(spec.scene)?.scene?.label_ja, g?.label_ja, spec.use_case, spec.icon_family]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildIconPromptText(spec) {
  const found = getIconScene(spec.scene);
  const symbol = found?.scene?.prompt_en || "a simple UI symbol";
  const fam = getIconFamily(spec.icon_family);
  const familyClause = fam?.prompt || "simple vector icon, even visual weight";
  const tokens = [
    "TASFUL_ICON_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `style=${spec.style || spec.icon_family || ""}`,
    `fam=${spec.icon_family || ""}`,
  ].join(" ");
  return [
    tokens,
    "::",
    `simple ${symbol} icon`,
    "1:1 canvas, centered single symbol",
    familyClause,
    "same optical size and padding as the icon family",
    "no people, no faces, no hands, no text, no letters, no watermark, no logos, icon only",
  ].join(", ");
}

export function drivePathForIconSpec(spec) {
  return `アイコン/${spec.genre}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForIconSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  const fam = getIconFamily(spec.icon_family);
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    String(spec.scene || "").replace(/_/g, "-"),
    spec.use_case,
    fam?.slug || "fmoutreg",
    q,
    `${dayPart}${scopeSuffix}`,
  ].join("-");
}

function takeKnownFromRight(tokens, set) {
  if (tokens.length >= 2) {
    const two = `${tokens[tokens.length - 2]}_${tokens[tokens.length - 1]}`;
    if (set.has(two)) {
      tokens.splice(-2, 2);
      return two;
    }
  }
  const t = tokens[tokens.length - 1];
  const snake = String(t || "").replace(/-/g, "_");
  if (set.has(t) || set.has(snake)) {
    tokens.pop();
    return set.has(snake) && !set.has(t) ? snake : t;
  }
  return "";
}

export function parseIconSlugParts(slug) {
  let raw = String(slug || "")
    .trim()
    .toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const familySlug = takeKnownFromRight(tokens, new Set(Object.values(ICON_FAMILIES).map((x) => x.slug)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(ICON_USE_CASES)));
  const genre = ICON_DEMAND_GENRES.find((g) => g.id === tokens[0])?.id || tokens[0] || "";
  if (genre) tokens.shift();
  let subcategory = "";
  let scene = "";
  for (let n = Math.min(tokens.length, 4); n >= 1; n -= 1) {
    const cand = tokens.slice(0, n).join("_");
    if (SUB_BY_ID.has(cand)) {
      subcategory = cand;
      tokens.splice(0, n);
      break;
    }
  }
  for (let n = Math.min(tokens.length, 5); n >= 1; n -= 1) {
    const cand = tokens.slice(0, n).join("_");
    if (SCENE_BY_ID.has(cand)) {
      scene = cand;
      tokens.splice(0, n);
      break;
    }
  }
  return {
    genre,
    subcategory,
    scene,
    use_case,
    icon_family: FAMILY_BY_SLUG.get(familySlug) || "",
  };
}

function finalizeIconSpec(raw, fallbackTitle = "") {
  const spec = applyIconFamily(raw);
  spec.title = fallbackTitle || spec.title || buildIconJapaneseTitle(spec);
  spec.prompt = spec.prompt || buildIconPromptText(spec);
  spec.description = spec.description || buildIconDescription(spec);
  return spec;
}

export function parseIconSpecFromPath({ slug = "", metadata = {} } = {}) {
  const familyFromMeta = String(metadata?.icon_family || metadata?.feature || "");
  if (metadata?.genre && metadata?.subcategory && metadata?.scene && familyFromMeta) {
    return finalizeIconSpec(
      {
        genre: String(metadata.genre),
        subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
        scene: String(metadata.scene).replace(/-/g, "_"),
        use_case: String(metadata.use_case || ""),
        icon_family: familyFromMeta,
        style: String(metadata.style || ""),
        line_weight: String(metadata.line_weight || ""),
        fill_type: String(metadata.fill_type || ""),
        shape_style: String(metadata.shape_style || ""),
        color_mode: String(metadata.color_mode || ""),
        complexity: String(metadata.complexity || ""),
        title: metadata.title || "",
      },
      metadata.title || "",
    );
  }
  const fromSlug = parseIconSlugParts(slug);
  const genre = getIconGenre(fromSlug.genre);
  const found = getIconSubgenre(fromSlug.subcategory);
  const sceneFound = getIconScene(fromSlug.scene);
  const family = getIconFamily(fromSlug.icon_family);
  const complete = Boolean(genre) && Boolean(found) && Boolean(sceneFound) && Boolean(family) && Boolean(fromSlug.use_case);
  if (!complete) return null;
  return finalizeIconSpec({
    genre: genre.id,
    subcategory: found.subgenre.id,
    scene: sceneFound.scene.id,
    use_case: fromSlug.use_case,
    icon_family: family.id,
  });
}

export function iconSpecToMetadata(spec) {
  const applied = applyIconFamily(spec);
  return {
    genre: applied.genre || "",
    subcategory: applied.subcategory || "",
    scene: applied.scene || "",
    use_case: applied.use_case || "",
    style: applied.style || "",
    line_weight: applied.line_weight || "",
    fill_type: applied.fill_type || "",
    shape_style: applied.shape_style || "",
    color_mode: applied.color_mode || "",
    complexity: applied.complexity || "",
    feature: applied.icon_family || "",
    orientation: "square",
    layout: "square",
    category: applied.genre || "",
    people_presence: "absent",
    target: "absent",
  };
}

export function classifyLegacyIconItem(item) {
  const hay = [item.subcategory, ...(item.tags || [])].map((x) => String(x || "")).join("|");
  const hits = new Set();
  for (const row of ICON_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy)) row.genre_ids.forEach((g) => hits.add(g));
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
