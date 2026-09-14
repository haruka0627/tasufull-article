/**
 * Text template Demand Category SSOT V1 — 文例・文章テンプレート.
 * Public category_id stays `document` (list query `text`). Not an AI writing service.
 * Inventory is never auto-FILL'd. Japanese-first. Placeholders only.
 * Genre list is folded by genre-restructure-web-code-text-v1 (23 canonical).
 */
import { foldTextDemandGenres, resolveGenreAlias, textDriveFolderName } from "./genre-restructure-web-code-text-v1.mjs";

export const TEXT_DEMAND_GENRE_SSOT_VERSION = "materials-text-genre-restructure-v1";
export const TEXT_PUBLIC_CATEGORY_ID = "document";
export const TEXT_LIST_QUERY_ID = "text";
export const TEXT_PUBLIC_DISPLAY_NAME = "文例・文章テンプレート";
export const TEXT_DATA_NAME = "文書テンプレート";
export const TEXT_ASSET_TYPE = "document";
export const TEXT_GENERATOR_NAME = "Text-Materials-AutoGenerator";
export const TEXT_LANGUAGE = "ja";

export const TEXT_TONES = Object.freeze({
  polite: { id: "polite", slug: "tnpol", label_ja: "丁寧" },
  formal: { id: "formal", slug: "tnfrm", label_ja: "フォーマル" },
  friendly: { id: "friendly", slug: "tnfrn", label_ja: "フレンドリー" },
  casual: { id: "casual", slug: "tncas", label_ja: "カジュアル" },
  concise: { id: "concise", slug: "tncon", label_ja: "簡潔" },
  warm: { id: "warm", slug: "tnwrm", label_ja: "温かい" },
  professional: { id: "professional", slug: "tnpro", label_ja: "ビジネス" },
});

export const TEXT_LENGTHS = Object.freeze({
  short: { id: "short", slug: "lnsh", label_ja: "短文" },
  medium: { id: "medium", slug: "lnmd", label_ja: "標準" },
  long: { id: "long", slug: "lnlg", label_ja: "長文" },
});

export const TEXT_TYPES = Object.freeze({
  email: { id: "email", slug: "tteml", label_ja: "メール" },
  sns: { id: "sns", slug: "ttsns", label_ja: "SNS" },
  ad: { id: "ad", slug: "ttad", label_ja: "広告" },
  web: { id: "web", slug: "ttweb", label_ja: "Web" },
  notice: { id: "notice", slug: "ttntc", label_ja: "お知らせ" },
});

export const TEXT_USE_CASES = Object.freeze({
  b2b: { id: "b2b", label_ja: "法人連絡" },
  b2c: { id: "b2c", label_ja: "顧客向け" },
  support: { id: "support", label_ja: "サポート" },
  sales: { id: "sales", label_ja: "営業" },
  sns: { id: "sns", label_ja: "SNS投稿" },
  store: { id: "store", label_ja: "店舗" },
  hr: { id: "hr", label_ja: "採用・人事" },
  internal: { id: "internal", label_ja: "社内" },
  web: { id: "web", label_ja: "Web・LP" },
  event: { id: "event", label_ja: "イベント" },
});

export const TEXT_DEFAULT_VARIABLES = Object.freeze([
  "[会社名]",
  "[担当者名]",
  "[氏名]",
  "[商品名]",
  "[サービス名]",
  "[日時]",
  "[場所]",
  "[URL]",
  "[金額]",
  "[期限]",
  "[問い合わせ先]",
]);

/** Completed legal/medical/finance/tax documents are out of scope. */
export const TEXT_PROFESSIONAL_BLOCK_PATTERNS = Object.freeze([
  /契約書/,
  /法的通知/,
  /内容証明/,
  /訴状/,
  /診断(?:結果|書)/,
  /処方箋/,
  /投資助言/,
  /税務申告/,
  /確定申告書/,
]);

export const TEXT_QA_CORE_GENRES = Object.freeze([
  "businessemail",
  "customersupport",
  "ecproduct",
  "snspost",
  "adcopy",
  "weblp",
  "recruitment",
  "announcement",
  "invitation",
  "faq",
]);

export const TEXT_P0_GENRES = Object.freeze([
  "businessemail",
  "customersupport",
  "ecproduct",
  "snspost",
  "adcopy",
  "weblp",
  "recruitment",
  "announcement",
  "sales",
  "internalbiz",
]);

const UC_B2B = ["b2b", "internal"];
const UC_B2C = ["b2c", "support"];
const UC_SALES = ["sales", "b2b"];
const UC_SNS = ["sns", "b2c"];
const UC_WEB = ["web", "b2c"];
const UC_HR = ["hr", "b2b"];
const UC_STORE = ["store", "b2c"];
const UC_EVENT = ["event", "b2c"];
const UC_INT = ["internal", "b2b"];

const TONE_BIZ = ["polite", "formal", "professional", "concise"];
const TONE_SOFT = ["polite", "friendly", "warm", "concise"];
const TONE_SNS = ["friendly", "casual", "warm", "concise"];
const TONE_AD = ["concise", "friendly", "professional", "casual"];
const LEN_ALL = ["short", "medium", "long"];
const LEN_SHORT = ["short", "medium"];

function sub(id, ja, extra = {}) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(extra.use_cases || UC_B2B),
    structure_key: extra.structure_key || id,
  });
}

function genre(id, tier, weight, ja, en, extra, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    p0_shortage: extra.p0_shortage === true,
    text_types: Object.freeze(extra.text_types || ["email"]),
    tones: Object.freeze(extra.tones || TONE_BIZ),
    lengths: Object.freeze(extra.lengths || LEN_ALL),
    subgenres: Object.freeze(subs),
  });
}

const TEXT_DEMAND_GENRES_SOURCE = Object.freeze([
  genre("businessemail", "core", 15, "ビジネスメール", "BUSINESS EMAIL", { text_types: ["email"], tones: TONE_BIZ, p0_shortage: true }, [
    sub("be_first", "初回連絡"),
    sub("be_hello", "挨拶"),
    sub("be_request", "依頼"),
    sub("be_confirm", "確認"),
    sub("be_question", "質問"),
    sub("be_reply", "回答"),
    sub("be_schedule", "日程調整"),
    sub("be_meeting", "打ち合わせ"),
    sub("be_files", "資料送付"),
    sub("be_follow", "催促"),
    sub("be_remind", "リマインド"),
    sub("be_thanks", "お礼"),
    sub("be_sorry", "お詫び"),
    sub("be_decline", "断り"),
    sub("be_change", "変更連絡"),
    sub("be_handoff", "引き継ぎ"),
    sub("be_leave", "休暇連絡"),
    sub("be_resign", "退職挨拶"),
  ]),
  genre("customersupport", "core", 12, "カスタマーサポート", "CUSTOMER SUPPORT", { text_types: ["email"], tones: TONE_SOFT, p0_shortage: true }, [
    sub("cs_intake", "問い合わせ受付", { use_cases: UC_B2C }),
    sub("cs_reply", "回答", { use_cases: UC_B2C }),
    sub("cs_looking", "調査中", { use_cases: UC_B2C }),
    sub("cs_resolved", "解決案内", { use_cases: UC_B2C }),
    sub("cs_bug", "不具合案内", { use_cases: UC_B2C }),
    sub("cs_maint", "メンテナンス", { use_cases: UC_B2C }),
    sub("cs_delay", "遅延", { use_cases: UC_B2C }),
    sub("cs_cancel", "キャンセル", { use_cases: UC_B2C }),
    sub("cs_return", "返品", { use_cases: UC_B2C }),
    sub("cs_exchange", "交換", { use_cases: UC_B2C }),
    sub("cs_refund", "返金案内", { use_cases: UC_B2C }),
    sub("cs_apology", "謝罪", { use_cases: UC_B2C }),
    sub("cs_faq", "FAQ回答", { use_cases: UC_B2C }),
    sub("cs_offhours", "営業時間外", { use_cases: UC_B2C }),
    sub("cs_done", "対応完了", { use_cases: UC_B2C }),
  ]),
  genre("sales", "core", 8, "営業", "SALES", { text_types: ["email"], tones: TONE_BIZ, p0_shortage: true }, [
    sub("sa_first", "初回営業", { use_cases: UC_SALES }),
    sub("sa_talk", "商談依頼", { use_cases: UC_SALES }),
    sub("sa_appt", "アポイント", { use_cases: UC_SALES }),
    sub("sa_intro", "サービス紹介", { use_cases: UC_SALES }),
    sub("sa_proposal", "提案送付", { use_cases: UC_SALES }),
    sub("sa_quote", "見積送付", { use_cases: UC_SALES }),
    sub("sa_after", "商談後フォロー", { use_cases: UC_SALES }),
    sub("sa_retry", "再提案", { use_cases: UC_SALES }),
    sub("sa_dormant", "休眠顧客", { use_cases: UC_SALES }),
    sub("sa_precon", "契約前確認", { use_cases: UC_SALES }),
    sub("sa_close", "クロージング", { use_cases: UC_SALES }),
    sub("sa_refer", "紹介依頼", { use_cases: UC_SALES }),
  ]),
  genre("ecproduct", "core", 11, "EC・商品説明", "EC / PRODUCT DESCRIPTION", { text_types: ["web"], tones: TONE_SOFT, p0_shortage: true }, [
    sub("ec_title", "商品タイトル", { use_cases: UC_WEB }),
    sub("ec_overview", "商品概要", { use_cases: UC_WEB }),
    sub("ec_feature", "商品特徴", { use_cases: UC_WEB }),
    sub("ec_merit", "メリット", { use_cases: UC_WEB }),
    sub("ec_howto", "使用方法", { use_cases: UC_WEB }),
    sub("ec_size", "サイズ説明", { use_cases: UC_WEB }),
    sub("ec_caution", "注意事項", { use_cases: UC_WEB }),
    sub("ec_ship", "発送案内", { use_cases: UC_WEB }),
    sub("ec_preorder", "予約商品", { use_cases: UC_WEB }),
    sub("ec_oos", "在庫切れ", { use_cases: UC_WEB }),
    sub("ec_restock", "再入荷", { use_cases: UC_WEB }),
    sub("ec_gift", "ギフト", { use_cases: UC_WEB }),
    sub("ec_sale", "セール", { use_cases: UC_WEB }),
    sub("ec_compare", "商品比較", { use_cases: UC_WEB }),
  ]),
  genre("snspost", "core", 11, "SNS投稿", "SNS POST", { text_types: ["sns"], tones: TONE_SNS, lengths: LEN_SHORT, p0_shortage: true }, [
    sub("sn_new", "新商品", { use_cases: UC_SNS }),
    sub("sn_service", "サービス紹介", { use_cases: UC_SNS }),
    sub("sn_news", "お知らせ", { use_cases: UC_SNS }),
    sub("sn_campaign", "キャンペーン", { use_cases: UC_SNS }),
    sub("sn_event", "イベント", { use_cases: UC_EVENT }),
    sub("sn_hours", "営業案内", { use_cases: UC_STORE }),
    sub("sn_behind", "Behind the scenes", { use_cases: UC_SNS }),
    sub("sn_tips", "Tips", { use_cases: UC_SNS }),
    sub("sn_faq", "FAQ", { use_cases: UC_SNS }),
    sub("sn_hire", "採用", { use_cases: UC_HR }),
    sub("sn_thanks", "感謝", { use_cases: UC_SNS }),
    sub("sn_season", "季節投稿", { use_cases: UC_SNS }),
    sub("sn_cta", "CTA付き投稿", { use_cases: UC_SNS }),
  ]),
  genre("adcopy", "core", 10, "広告コピー", "ADVERTISING COPY", { text_types: ["ad"], tones: TONE_AD, lengths: LEN_SHORT, p0_shortage: true }, [
    sub("ad_catch", "キャッチコピー", { use_cases: UC_WEB }),
    sub("ad_head", "見出し", { use_cases: UC_WEB }),
    sub("ad_sub", "サブコピー", { use_cases: UC_WEB }),
    sub("ad_cta", "CTA", { use_cases: UC_WEB }),
    sub("ad_banner", "バナー", { use_cases: UC_WEB }),
    sub("ad_snsad", "SNS広告", { use_cases: UC_SNS }),
    sub("ad_webad", "Web広告", { use_cases: UC_WEB }),
    sub("ad_campaign", "キャンペーン", { use_cases: UC_WEB }),
    sub("ad_sale", "セール", { use_cases: UC_WEB }),
    sub("ad_new", "新商品", { use_cases: UC_WEB }),
    sub("ad_service", "サービス訴求", { use_cases: UC_WEB }),
    sub("ad_problem", "問題解決型", { use_cases: UC_WEB }),
    sub("ad_benefit", "ベネフィット訴求", { use_cases: UC_WEB }),
  ]),
  genre("weblp", "core", 9, "Web・LP文章", "WEB / LANDING PAGE COPY", { text_types: ["web"], tones: TONE_AD, p0_shortage: true }, [
    sub("lp_hero", "Hero headline", { use_cases: UC_WEB }),
    sub("lp_sub", "Hero subcopy", { use_cases: UC_WEB }),
    sub("lp_service", "サービス説明", { use_cases: UC_WEB }),
    sub("lp_feature", "Feature", { use_cases: UC_WEB }),
    sub("lp_benefit", "Benefit", { use_cases: UC_WEB }),
    sub("lp_about", "About", { use_cases: UC_WEB }),
    sub("lp_cta", "CTA", { use_cases: UC_WEB }),
    sub("lp_faq", "FAQ", { use_cases: UC_WEB }),
    sub("lp_price", "Pricing説明", { use_cases: UC_WEB }),
    sub("lp_contact", "Contact誘導", { use_cases: UC_WEB }),
    sub("lp_trust", "Trust", { use_cases: UC_WEB }),
    sub("lp_close", "Closing", { use_cases: UC_WEB }),
  ]),
  genre("recruitment", "core", 8, "求人・採用", "RECRUITMENT", { text_types: ["notice", "email"], tones: TONE_BIZ, p0_shortage: true }, [
    sub("rc_title", "求人タイトル", { use_cases: UC_HR }),
    sub("rc_overview", "募集概要", { use_cases: UC_HR }),
    sub("rc_work", "仕事内容", { use_cases: UC_HR }),
    sub("rc_company", "会社紹介", { use_cases: UC_HR }),
    sub("rc_place", "職場紹介", { use_cases: UC_HR }),
    sub("rc_person", "求める人物像", { use_cases: UC_HR }),
    sub("rc_req", "応募条件", { use_cases: UC_HR }),
    sub("rc_welfare", "福利厚生", { use_cases: UC_HR }),
    sub("rc_select", "選考案内", { use_cases: UC_HR }),
    sub("rc_interview", "面接案内", { use_cases: UC_HR }),
    sub("rc_result", "合否連絡", { use_cases: UC_HR }),
    sub("rc_offer", "内定連絡", { use_cases: UC_HR }),
    sub("rc_reject", "不採用連絡", { use_cases: UC_HR }),
    sub("rc_onboard", "入社案内", { use_cases: UC_HR }),
  ]),
  genre("internalbiz", "core", 7, "社内文書・社内連絡", "INTERNAL BUSINESS", { text_types: ["email", "notice"], tones: TONE_BIZ, p0_shortage: true }, [
    sub("ib_notice", "社内通知", { use_cases: UC_INT }),
    sub("ib_ops", "業務連絡", { use_cases: UC_INT }),
    sub("ib_meet", "会議案内", { use_cases: UC_INT }),
    sub("ib_minutes", "議事録構成", { use_cases: UC_INT }),
    sub("ib_report", "報告", { use_cases: UC_INT }),
    sub("ib_consult", "相談", { use_cases: UC_INT }),
    sub("ib_ask", "依頼", { use_cases: UC_INT }),
    sub("ib_share", "周知", { use_cases: UC_INT }),
    sub("ib_leave", "休暇", { use_cases: UC_INT }),
    sub("ib_attend", "勤怠", { use_cases: UC_INT }),
    sub("ib_move", "異動", { use_cases: UC_INT }),
    sub("ib_join", "入社", { use_cases: UC_INT }),
    sub("ib_leavejob", "退職", { use_cases: UC_INT }),
    sub("ib_outage", "障害連絡", { use_cases: UC_INT }),
    sub("ib_urgent", "緊急連絡", { use_cases: UC_INT }),
  ]),
  genre("announcement", "core", 8, "お知らせ・告知", "ANNOUNCEMENT", { text_types: ["notice"], tones: TONE_BIZ, p0_shortage: true }, [
    sub("an_hours", "営業時間変更", { use_cases: UC_STORE }),
    sub("an_closed", "休業", { use_cases: UC_STORE }),
    sub("an_temp", "臨時休業", { use_cases: UC_STORE }),
    sub("an_move", "移転", { use_cases: UC_STORE }),
    sub("an_open", "開店", { use_cases: UC_STORE }),
    sub("an_end", "閉店", { use_cases: UC_STORE }),
    sub("an_renew", "リニューアル", { use_cases: UC_STORE }),
    sub("an_price", "価格変更", { use_cases: UC_B2C }),
    sub("an_service", "サービス変更", { use_cases: UC_B2C }),
    sub("an_maint", "メンテナンス", { use_cases: UC_B2C }),
    sub("an_outage", "障害", { use_cases: UC_B2C }),
    sub("an_event", "イベント", { use_cases: UC_EVENT }),
    sub("an_campaign", "キャンペーン", { use_cases: UC_B2C }),
    sub("an_important", "重要なお知らせ", { use_cases: UC_B2C }),
  ]),
  genre("youtube", "medium", 7, "YouTube・動画", "YOUTUBE / VIDEO", { text_types: ["sns"], tones: TONE_SNS, lengths: LEN_SHORT }, [
    sub("yt_title", "動画タイトル", { use_cases: UC_SNS }),
    sub("yt_desc", "概要欄", { use_cases: UC_SNS }),
    sub("yt_open", "冒頭", { use_cases: UC_SNS }),
    sub("yt_intro", "導入", { use_cases: UC_SNS }),
    sub("yt_cta", "CTA", { use_cases: UC_SNS }),
    sub("yt_channel", "チャンネル紹介", { use_cases: UC_SNS }),
    sub("yt_shorts", "Shorts説明", { use_cases: UC_SNS }),
    sub("yt_live", "LIVE告知", { use_cases: UC_EVENT }),
    sub("yt_next", "次回予告", { use_cases: UC_SNS }),
    sub("yt_comment", "コメント誘導", { use_cases: UC_SNS }),
    sub("yt_sub", "登録誘導", { use_cases: UC_SNS }),
  ]),
  genre("blog", "medium", 6, "ブログ・記事", "BLOG / ARTICLE", { text_types: ["web"], tones: TONE_SOFT }, [
    sub("bl_title", "タイトル案", { use_cases: UC_WEB }),
    sub("bl_lead", "導入文", { use_cases: UC_WEB }),
    sub("bl_heads", "見出し構成", { use_cases: UC_WEB }),
    sub("bl_howto", "How-to構成", { use_cases: UC_WEB }),
    sub("bl_compare", "比較記事構成", { use_cases: UC_WEB }),
    sub("bl_faq", "FAQ構成", { use_cases: UC_WEB }),
    sub("bl_end", "まとめ", { use_cases: UC_WEB }),
    sub("bl_cta", "CTA", { use_cases: UC_WEB }),
    sub("bl_product", "商品紹介構成", { use_cases: UC_WEB }),
  ]),
  genre("profile", "medium", 6, "プロフィール・自己紹介", "PROFILE / BIO", { text_types: ["sns", "web"], tones: TONE_SOFT, lengths: LEN_SHORT }, [
    sub("pf_personal", "個人", { use_cases: UC_SNS }),
    sub("pf_biz", "ビジネス", { use_cases: UC_B2B }),
    sub("pf_sns", "SNS", { use_cases: UC_SNS }),
    sub("pf_creator", "Creator", { use_cases: UC_SNS }),
    sub("pf_free", "Freelancer", { use_cases: UC_B2B }),
    sub("pf_store", "店舗", { use_cases: UC_STORE }),
    sub("pf_company", "会社", { use_cases: UC_B2B }),
    sub("pf_folio", "ポートフォリオ", { use_cases: UC_WEB }),
    sub("pf_teacher", "講師", { use_cases: UC_EVENT }),
    sub("pf_job", "求職者", { use_cases: UC_HR }),
  ]),
  genre("press", "supporting", 3, "プレスリリース", "PRESS RELEASE", { text_types: ["notice"], tones: TONE_BIZ }, [
    sub("pr_service", "新サービス", { use_cases: UC_WEB }),
    sub("pr_product", "新商品", { use_cases: UC_WEB }),
    sub("pr_event", "イベント", { use_cases: UC_EVENT }),
    sub("pr_partner", "提携", { use_cases: UC_B2B }),
    sub("pr_renew", "リニューアル", { use_cases: UC_WEB }),
    sub("pr_survey", "調査発表", { use_cases: UC_WEB }),
    sub("pr_campaign", "キャンペーン", { use_cases: UC_WEB }),
    sub("pr_company", "会社情報", { use_cases: UC_B2B }),
  ]),
  genre("store", "medium", 6, "店舗・飲食", "STORE / RESTAURANT", { text_types: ["sns", "notice"], tones: TONE_SNS }, [
    sub("st_intro", "店舗紹介", { use_cases: UC_STORE }),
    sub("st_menu", "メニュー紹介", { use_cases: UC_STORE }),
    sub("st_hours", "営業案内", { use_cases: UC_STORE }),
    sub("st_reserve", "予約案内", { use_cases: UC_STORE }),
    sub("st_busy", "混雑案内", { use_cases: UC_STORE }),
    sub("st_newmenu", "新メニュー", { use_cases: UC_STORE }),
    sub("st_soldout", "売り切れ", { use_cases: UC_STORE }),
    sub("st_temp", "臨時休業", { use_cases: UC_STORE }),
    sub("st_takeout", "テイクアウト", { use_cases: UC_STORE }),
    sub("st_delivery", "デリバリー", { use_cases: UC_STORE }),
    sub("st_review", "口コミ返信", { use_cases: UC_STORE }),
  ]),
  genre("beauty", "supporting", 3, "美容・サロン", "BEAUTY / SALON", { text_types: ["sns", "email"], tones: TONE_SOFT }, [
    sub("by_intro", "サロン紹介", { use_cases: UC_STORE }),
    sub("by_menu", "メニュー説明", { use_cases: UC_STORE }),
    sub("by_book", "予約案内", { use_cases: UC_STORE }),
    sub("by_before", "来店前案内", { use_cases: UC_STORE }),
    sub("by_cancel", "キャンセル", { use_cases: UC_STORE }),
    sub("by_new", "新メニュー", { use_cases: UC_STORE }),
    sub("by_campaign", "キャンペーン", { use_cases: UC_STORE }),
    sub("by_after", "施術後案内", { use_cases: UC_STORE }),
  ]),
  genre("realestate", "supporting", 3, "不動産・建設", "REAL ESTATE / CONSTRUCTION", { text_types: ["email", "web"], tones: TONE_BIZ }, [
    sub("re_listing", "物件紹介", { use_cases: UC_B2C }),
    sub("re_view", "内見案内", { use_cases: UC_B2C }),
    sub("re_reply", "問い合わせ返信", { use_cases: UC_B2C }),
    sub("re_work", "工事案内", { use_cases: UC_B2C }),
    sub("re_term", "工期案内", { use_cases: UC_B2C }),
    sub("re_case", "施工事例", { use_cases: UC_WEB }),
    sub("re_reform", "リフォーム紹介", { use_cases: UC_WEB }),
    sub("re_area", "近隣案内", { use_cases: UC_B2C }),
    sub("re_done", "完了報告", { use_cases: UC_B2C }),
  ]),
  genre("education", "medium", 4, "教育・スクール", "EDUCATION", { text_types: ["notice", "email"], tones: TONE_SOFT }, [
    sub("ed_recruit", "生徒募集", { use_cases: UC_EVENT }),
    sub("ed_course", "講座紹介", { use_cases: UC_WEB }),
    sub("ed_class", "授業案内", { use_cases: UC_EVENT }),
    sub("ed_parent", "保護者連絡", { use_cases: UC_B2C }),
    sub("ed_cancel", "休講", { use_cases: UC_EVENT }),
    sub("ed_hw", "宿題", { use_cases: UC_B2C }),
    sub("ed_meet", "面談", { use_cases: UC_B2C }),
    sub("ed_event", "イベント", { use_cases: UC_EVENT }),
    sub("ed_exam", "試験", { use_cases: UC_EVENT }),
    sub("ed_pass", "合格案内", { use_cases: UC_B2C }),
    sub("ed_tips", "学習アドバイス", { use_cases: UC_WEB }),
  ]),
  genre("event", "medium", 5, "イベント", "EVENT", { text_types: ["notice", "email"], tones: TONE_SOFT }, [
    sub("ev_announce", "開催告知", { use_cases: UC_EVENT }),
    sub("ev_recruit", "募集", { use_cases: UC_EVENT }),
    sub("ev_join", "参加案内", { use_cases: UC_EVENT }),
    sub("ev_remind", "リマインド", { use_cases: UC_EVENT }),
    sub("ev_day", "当日案内", { use_cases: UC_EVENT }),
    sub("ev_caution", "注意事項", { use_cases: UC_EVENT }),
    sub("ev_delay", "延期", { use_cases: UC_EVENT }),
    sub("ev_cancel", "中止", { use_cases: UC_EVENT }),
    sub("ev_thanks", "お礼", { use_cases: UC_EVENT }),
    sub("ev_survey", "アンケート", { use_cases: UC_EVENT }),
    sub("ev_next", "次回告知", { use_cases: UC_EVENT }),
  ]),
  genre("seminar", "supporting", 3, "セミナー・ウェビナー", "SEMINAR / WEBINAR", { text_types: ["email", "web"], tones: TONE_BIZ }, [
    sub("sm_lead", "集客", { use_cases: UC_EVENT }),
    sub("sm_overview", "概要", { use_cases: UC_EVENT }),
    sub("sm_speaker", "講師紹介", { use_cases: UC_EVENT }),
    sub("sm_merit", "参加メリット", { use_cases: UC_EVENT }),
    sub("sm_before", "開催前", { use_cases: UC_EVENT }),
    sub("sm_day", "当日", { use_cases: UC_EVENT }),
    sub("sm_after", "開催後", { use_cases: UC_EVENT }),
    sub("sm_files", "資料送付", { use_cases: UC_EVENT }),
    sub("sm_survey", "アンケート", { use_cases: UC_EVENT }),
    sub("sm_next", "次回案内", { use_cases: UC_EVENT }),
  ]),
  genre("thanks", "medium", 5, "お礼", "THANKS / GRATITUDE", { text_types: ["email"], tones: TONE_SOFT }, [
    sub("th_buy", "購入", { use_cases: UC_B2C }),
    sub("th_visit", "来店", { use_cases: UC_STORE }),
    sub("th_refer", "紹介", { use_cases: UC_B2B }),
    sub("th_talk", "商談", { use_cases: UC_SALES }),
    sub("th_gift", "贈り物", { use_cases: UC_B2B }),
    sub("th_event", "イベント参加", { use_cases: UC_EVENT }),
    sub("th_support", "サポート", { use_cases: UC_B2C }),
    sub("th_work", "仕事依頼", { use_cases: UC_B2B }),
  ]),
  genre("apology", "medium", 5, "お詫び", "APOLOGY", { text_types: ["email"], tones: TONE_BIZ }, [
    sub("ap_late", "遅刻", { use_cases: UC_B2B }),
    sub("ap_reply", "返信遅延", { use_cases: UC_B2B }),
    sub("ap_ship", "発送遅延", { use_cases: UC_B2C }),
    sub("ap_miss", "ミス", { use_cases: UC_B2B }),
    sub("ap_bug", "不具合", { use_cases: UC_B2C }),
    sub("ap_oos", "品切れ", { use_cases: UC_B2C }),
    sub("ap_cancel", "キャンセル", { use_cases: UC_B2C }),
    sub("ap_change", "日程変更", { use_cases: UC_B2B }),
  ]),
  genre("request", "medium", 5, "お願い・依頼", "REQUEST", { text_types: ["email"], tones: TONE_BIZ }, [
    sub("rq_check", "確認依頼", { use_cases: UC_B2B }),
    sub("rq_reply", "返信依頼", { use_cases: UC_B2B }),
    sub("rq_files", "資料依頼", { use_cases: UC_B2B }),
    sub("rq_survey", "アンケート", { use_cases: UC_B2C }),
    sub("rq_date", "日程", { use_cases: UC_B2B }),
    sub("rq_work", "作業", { use_cases: UC_INT }),
    sub("rq_help", "協力", { use_cases: UC_B2B }),
    sub("rq_refer", "紹介", { use_cases: UC_SALES }),
  ]),
  genre("invitation", "supporting", 3, "招待・案内", "INVITATION", { text_types: ["email"], tones: TONE_SOFT }, [
    sub("iv_meal", "食事", { use_cases: UC_B2B }),
    sub("iv_event", "イベント", { use_cases: UC_EVENT }),
    sub("iv_party", "パーティー", { use_cases: UC_EVENT }),
    sub("iv_meet", "会合", { use_cases: UC_B2B }),
    sub("iv_online", "オンライン会議", { use_cases: UC_B2B }),
    sub("iv_seminar", "セミナー", { use_cases: UC_EVENT }),
    sub("iv_community", "コミュニティ", { use_cases: UC_EVENT }),
  ]),
  genre("seasonal", "supporting", 3, "季節の挨拶", "SEASONAL GREETING", { text_types: ["email"], tones: TONE_SOFT }, [
    sub("se_newyear", "新年", { use_cases: UC_B2B }),
    sub("se_spring", "春", { use_cases: UC_B2B }),
    sub("se_summer", "夏", { use_cases: UC_B2B }),
    sub("se_heat", "暑中見舞い", { use_cases: UC_B2B }),
    sub("se_lateheat", "残暑", { use_cases: UC_B2B }),
    sub("se_autumn", "秋", { use_cases: UC_B2B }),
    sub("se_yearend", "年末", { use_cases: UC_B2B }),
    sub("se_xmas", "クリスマス", { use_cases: UC_B2C }),
    sub("se_holiday", "年末年始休業", { use_cases: UC_STORE }),
  ]),
  genre("meeting", "supporting", 4, "会議・議事録", "MEETING / MINUTES", { text_types: ["notice"], tones: TONE_BIZ }, [
    sub("mt_invite", "会議案内", { use_cases: UC_INT }),
    sub("mt_agenda", "Agenda", { use_cases: UC_INT }),
    sub("mt_minutes", "議事録", { use_cases: UC_INT }),
    sub("mt_decide", "決定事項", { use_cases: UC_INT }),
    sub("mt_action", "Action Items", { use_cases: UC_INT }),
    sub("mt_issue", "課題", { use_cases: UC_INT }),
    sub("mt_next", "次回予定", { use_cases: UC_INT }),
  ]),
  genre("report", "supporting", 4, "報告・レポート", "REPORT", { text_types: ["notice"], tones: TONE_BIZ }, [
    sub("rp_daily", "日報", { use_cases: UC_INT }),
    sub("rp_week", "週報", { use_cases: UC_INT }),
    sub("rp_month", "月報", { use_cases: UC_INT }),
    sub("rp_progress", "進捗報告", { use_cases: UC_INT }),
    sub("rp_done", "完了報告", { use_cases: UC_INT }),
    sub("rp_outage", "障害報告", { use_cases: UC_INT }),
    sub("rp_research", "調査報告", { use_cases: UC_INT }),
    sub("rp_sales", "売上報告", { use_cases: UC_SALES }),
  ]),
  genre("proposal", "supporting", 4, "企画・提案構成", "PROPOSAL STRUCTURE", { text_types: ["notice"], tones: TONE_BIZ }, [
    sub("pp_plan", "企画書構成", { use_cases: UC_SALES }),
    sub("pp_prop", "提案書構成", { use_cases: UC_SALES }),
    sub("pp_issue", "課題", { use_cases: UC_SALES }),
    sub("pp_solve", "解決策", { use_cases: UC_SALES }),
    sub("pp_benefit", "Benefit", { use_cases: UC_SALES }),
    sub("pp_scope", "Scope", { use_cases: UC_SALES }),
    sub("pp_sched", "Schedule", { use_cases: UC_SALES }),
    sub("pp_kpi", "KPI", { use_cases: UC_SALES }),
    sub("pp_close", "Closing", { use_cases: UC_SALES }),
  ]),
  genre("faq", "medium", 5, "FAQ・ヘルプ", "FAQ / HELP", { text_types: ["web"], tones: TONE_SOFT }, [
    sub("fq_answer", "FAQ回答", { use_cases: UC_WEB }),
    sub("fq_howto", "操作説明", { use_cases: UC_WEB }),
    sub("fq_trouble", "Troubleshooting", { use_cases: UC_WEB }),
    sub("fq_beginner", "初心者案内", { use_cases: UC_WEB }),
    sub("fq_caution", "注意事項", { use_cases: UC_WEB }),
    sub("fq_contact", "問い合わせ誘導", { use_cases: UC_WEB }),
  ]),
  genre("survey", "supporting", 3, "アンケート・レビュー", "SURVEY / REVIEW", { text_types: ["notice", "email"], tones: TONE_SOFT }, [
    sub("sv_nps", "満足度", { use_cases: UC_B2C }),
    sub("sv_afterbuy", "購入後", { use_cases: UC_B2C }),
    sub("sv_afterev", "イベント後", { use_cases: UC_EVENT }),
    sub("sv_service", "サービス評価", { use_cases: UC_B2C }),
    sub("sv_npsform", "NPS形式", { use_cases: UC_B2C }),
    sub("sv_improve", "改善要望", { use_cases: UC_B2C }),
    sub("sv_review", "口コミ依頼", { use_cases: UC_STORE }),
  ]),
]);

export const TEXT_DEMAND_GENRES = Object.freeze(foldTextDemandGenres(TEXT_DEMAND_GENRES_SOURCE));

export const TEXT_CORE_GENRE_COUNT = TEXT_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const TEXT_MEDIUM_GENRE_COUNT = TEXT_DEMAND_GENRES.filter((g) => g.tier === "medium").length;
export const TEXT_SUPPORTING_GENRE_COUNT = TEXT_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;

const GENRE_BY_ID = new Map(TEXT_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
for (const g of TEXT_DEMAND_GENRES) {
  for (const sg of g.subgenres) SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
}

export function listTextSubgenres() {
  return TEXT_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getTextGenre(id) {
  const canonical = resolveGenreAlias("document", id);
  return GENRE_BY_ID.get(String(canonical || "")) || null;
}
export function getTextSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateTextGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  for (const g of TEXT_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    if (typeof g.demand_weight !== "number") issues.push(`weight:${g.id}`);
    if (!["core", "medium", "supporting"].includes(g.tier)) issues.push(`tier:${g.id}`);
    for (const tt of g.text_types) if (!TEXT_TYPES[tt]) issues.push(`type:${g.id}:${tt}`);
    for (const tn of g.tones) if (!TEXT_TONES[tn]) issues.push(`tone:${g.id}:${tn}`);
    for (const ln of g.lengths) if (!TEXT_LENGTHS[ln]) issues.push(`len:${g.id}:${ln}`);
    if (!g.subgenres.length) issues.push(`empty:${g.id}`);
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id) || /-/.test(sg.id)) issues.push(`bad_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) if (!TEXT_USE_CASES[uc]) issues.push(`uc:${sg.id}:${uc}`);
    }
  }
  if (TEXT_DEMAND_GENRES.length !== 23) issues.push(`genre_count:${TEXT_DEMAND_GENRES.length}`);
  if (TEXT_CORE_GENRE_COUNT !== 10) issues.push(`core:${TEXT_CORE_GENRE_COUNT}`);
  return {
    ok: issues.length === 0,
    issues,
    genres: TEXT_DEMAND_GENRES.length,
    subgenres: subIds.size,
    core: TEXT_CORE_GENRE_COUNT,
    medium: TEXT_MEDIUM_GENRE_COUNT,
    supporting: TEXT_SUPPORTING_GENRE_COUNT,
  };
}

/** Tone omitted — honorific-only clones are not unique. */
export function textSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.subcategory,
    spec?.use_case,
    spec?.text_type,
    spec?.length,
    spec?.structure_key || spec?.subcategory,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function buildTextJapaneseTitle(spec) {
  const g = getTextGenre(spec.genre);
  const sg = getTextSubgenre(spec.subcategory)?.subgenre;
  const tone = TEXT_TONES[spec.tone]?.label_ja;
  const len = TEXT_LENGTHS[spec.length]?.label_ja;
  const bits = [tone, len].filter(Boolean);
  const label = sg?.label_ja || spec.subcategory || "文例";
  const head = g ? `${g.label_ja}・${label}` : label;
  const title = bits.length ? `${head}（${bits.join("・")}）` : head;
  return title.slice(0, 40);
}

export function buildTextDescription(spec) {
  const g = getTextGenre(spec.genre);
  const sg = getTextSubgenre(spec.subcategory)?.subgenre;
  return [sg?.label_ja, g?.label_ja, TEXT_TYPES[spec.text_type]?.label_ja, "コピーして使える文例"]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildTextPromptText(spec) {
  const g = getTextGenre(spec.genre);
  const sg = getTextSubgenre(spec.subcategory)?.subgenre;
  return [
    `Japanese reusable ${g?.label_en || spec.genre} template: ${sg?.label_ja || spec.subcategory}`,
    `text_type=${spec.text_type} tone=${spec.tone} length=${spec.length} use_case=${spec.use_case}`,
    "finished copy-ready template with placeholders like [会社名] [担当者名] [商品名] [日時]",
    "no real company/person names, no PII, no third-party reprint, no SEO article farm, no novel",
    "no completed legal/medical/finance/tax documents, no invented facts as certainty",
    "natural Japanese, clear purpose, not AI-redundant, structure unique to this use case",
  ].join(", ");
}

export function drivePathForTextSpec(spec) {
  const folder = textDriveFolderName(spec.genre);
  return `文例・文章テンプレート/${folder}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForTextSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    spec.use_case,
    TEXT_TYPES[spec.text_type]?.slug || "tteml",
    TEXT_TONES[spec.tone]?.slug || "tnpol",
    TEXT_LENGTHS[spec.length]?.slug || "lnmd",
    q,
    `${dayPart}${scopeSuffix}`,
  ].join("-");
}

function takeKnownFromRight(tokens, set) {
  const t = tokens[tokens.length - 1];
  const snake = String(t || "").replace(/-/g, "_");
  if (set.has(t) || set.has(snake)) {
    tokens.pop();
    return set.has(snake) && !set.has(t) ? snake : t;
  }
  return "";
}

const TYPE_BY_SLUG = new Map(Object.values(TEXT_TYPES).map((x) => [x.slug, x.id]));
const TONE_BY_SLUG = new Map(Object.values(TEXT_TONES).map((x) => [x.slug, x.id]));
const LEN_BY_SLUG = new Map(Object.values(TEXT_LENGTHS).map((x) => [x.slug, x.id]));

export function parseTextSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -q[0].length);
  const tokens = raw.split("-").filter(Boolean);
  const lengthSlug = takeKnownFromRight(tokens, new Set(Object.values(TEXT_LENGTHS).map((x) => x.slug)));
  const toneSlug = takeKnownFromRight(tokens, new Set(Object.values(TEXT_TONES).map((x) => x.slug)));
  const typeSlug = takeKnownFromRight(tokens, new Set(Object.values(TEXT_TYPES).map((x) => x.slug)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(TEXT_USE_CASES)));
  const genre = getTextGenre(tokens[0])?.id || tokens[0] || "";
  if (genre) tokens.shift();
  let subcategory = "";
  for (let n = Math.min(tokens.length, 4); n >= 1; n -= 1) {
    const cand = tokens.slice(0, n).join("_");
    if (SUB_BY_ID.has(cand)) {
      subcategory = cand;
      tokens.splice(0, n);
      break;
    }
  }
  return {
    genre,
    subcategory,
    use_case,
    text_type: TYPE_BY_SLUG.get(typeSlug) || "",
    tone: TONE_BY_SLUG.get(toneSlug) || "",
    length: LEN_BY_SLUG.get(lengthSlug) || "",
  };
}

function finalizeTextSpec(raw, fallbackTitle = "") {
  const spec = { ...raw };
  const found = getTextSubgenre(spec.subcategory);
  spec.structure_key = spec.structure_key || found?.subgenre?.structure_key || spec.subcategory;
  spec.language = spec.language || TEXT_LANGUAGE;
  spec.title = fallbackTitle || spec.title || buildTextJapaneseTitle(spec);
  spec.prompt = spec.prompt || buildTextPromptText(spec);
  spec.description = spec.description || buildTextDescription(spec);
  return spec;
}

export function parseTextSpecFromPath({ slug = "", metadata = {} } = {}) {
  if (metadata?.genre && metadata?.subcategory && metadata?.text_type && metadata?.tone && metadata?.length) {
    return finalizeTextSpec(
      {
        genre: getTextGenre(metadata.genre)?.id || resolveGenreAlias("document", metadata.genre) || String(metadata.genre),
        subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
        use_case: String(metadata.use_case || ""),
        text_type: String(metadata.text_type),
        tone: String(metadata.tone),
        length: String(metadata.length),
        language: String(metadata.language || TEXT_LANGUAGE),
        title: metadata.title || "",
      },
      metadata.title || "",
    );
  }
  const fromSlug = parseTextSlugParts(slug);
  const genre = getTextGenre(fromSlug.genre);
  const found = getTextSubgenre(fromSlug.subcategory);
  const complete =
    Boolean(genre) &&
    Boolean(found) &&
    Boolean(fromSlug.use_case) &&
    Boolean(fromSlug.text_type) &&
    Boolean(fromSlug.tone) &&
    Boolean(fromSlug.length);
  if (!complete) return null;
  return finalizeTextSpec({
    genre: genre.id,
    subcategory: found.subgenre.id,
    use_case: fromSlug.use_case,
    text_type: fromSlug.text_type,
    tone: fromSlug.tone,
    length: fromSlug.length,
  });
}

export function textSpecToMetadata(spec) {
  const vars = Array.isArray(spec.template_variables) ? spec.template_variables : TEXT_DEFAULT_VARIABLES;
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    use_case: spec.use_case || "",
    text_type: spec.text_type || "",
    tone: spec.tone || "",
    length: spec.length || "",
    language: spec.language || TEXT_LANGUAGE,
    template_variables: vars.join(","),
    category: spec.genre || "",
    style: spec.tone || "",
    scene: spec.subcategory || "",
    generator: TEXT_GENERATOR_NAME,
  };
}

export function classifyLegacyTextItem(item) {
  const hay = [item.subcategory, item.document_usage, ...(item.tags || [])]
    .map((x) => String(x || "").toLowerCase())
    .join("|");
  if (!hay.trim()) return { genre: "unclassified", confidence: "none" };
  if (/メール|email/.test(hay)) return { genre: "businessemail", confidence: "derived" };
  if (/sns|投稿/.test(hay)) return { genre: "snspost", confidence: "derived" };
  if (/お知らせ|告知/.test(hay)) return { genre: "announcement", confidence: "derived" };
  return { genre: "unclassified", confidence: "none" };
}

export function isProfessionalTextBlocked(text) {
  const s = String(text || "");
  return TEXT_PROFESSIONAL_BLOCK_PATTERNS.some((re) => re.test(s));
}
