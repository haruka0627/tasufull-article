/**
 * Presentation Demand SSOT V1 — purpose ≠ slide_type ≠ design_family ≠ layout.
 * Existing inventory is never auto-FILL'd. Format remains editable PPTX 16:9.
 */
export const PRESENTATION_DEMAND_SSOT_VERSION = "materials-presentation-demand-coverage-diversity-v1";
export const PRESENTATION_ASSET_TYPE = "presentation";
export const PRESENTATION_ASPECT_PRIMARY = "16:9";
export const PRESENTATION_ORANGE_FORBIDDEN = Object.freeze(["EA580C", "F97316", "FB923C", "F59E0B", "C2410C"]);

export const PRESENTATION_TEMPLATE_VARIABLES = Object.freeze([
  "[会社名]",
  "[サービス名]",
  "[タイトル]",
  "[担当者名]",
  "[日付]",
  "[売上]",
  "[KPI]",
  "[課題]",
  "[解決策]",
  "[画像]",
  "[グラフデータ]",
  "[カテゴリA]",
  "[カテゴリB]",
  "[期間]",
  "[前年比]",
]);

export const PRESENTATION_DENSITIES = Object.freeze({
  minimal: { id: "minimal", label_ja: "最小" },
  low: { id: "low", label_ja: "低" },
  medium: { id: "medium", label_ja: "中" },
  information_dense: { id: "information_dense", label_ja: "情報密度高" },
});

export const PRESENTATION_LAYOUT_TYPES = Object.freeze({
  centered: { id: "centered", label_ja: "中央" },
  left_aligned: { id: "left_aligned", label_ja: "左揃え" },
  right_aligned: { id: "right_aligned", label_ja: "右揃え" },
  two_column: { id: "two_column", label_ja: "2カラム" },
  three_column: { id: "three_column", label_ja: "3カラム" },
  split: { id: "split", label_ja: "スプリット" },
  card_grid: { id: "card_grid", label_ja: "カードグリッド" },
  full_image: { id: "full_image", label_ja: "全面画像" },
  chart_focus: { id: "chart_focus", label_ja: "チャート主" },
  number_focus: { id: "number_focus", label_ja: "数字主" },
  timeline: { id: "timeline", label_ja: "タイムライン" },
  comparison: { id: "comparison", label_ja: "比較" },
  table: { id: "table", label_ja: "表" },
  asymmetric: { id: "asymmetric", label_ja: "非対称" },
  editorial: { id: "editorial", label_ja: "エディトリアル" },
});

export const PRESENTATION_INDUSTRIES = Object.freeze({
  general: { id: "general", label_ja: "汎用" },
  technology: { id: "technology", label_ja: "テクノロジー" },
  ai: { id: "ai", label_ja: "AI" },
  finance: { id: "finance", label_ja: "金融" },
  healthcare: { id: "healthcare", label_ja: "ヘルスケア" },
  education: { id: "education", label_ja: "教育" },
  construction: { id: "construction", label_ja: "建設" },
  real_estate: { id: "real_estate", label_ja: "不動産" },
  ecommerce: { id: "ecommerce", label_ja: "EC" },
  retail: { id: "retail", label_ja: "小売" },
  beauty: { id: "beauty", label_ja: "美容" },
  food: { id: "food", label_ja: "飲食" },
  manufacturing: { id: "manufacturing", label_ja: "製造" },
  recruitment: { id: "recruitment", label_ja: "採用" },
  creator: { id: "creator", label_ja: "クリエイター" },
});

/** header_style drives Family chrome — never a single orange top bar for all. */
export const PRESENTATION_DESIGN_FAMILIES = Object.freeze({
  corporateclean: { id: "corporateclean", label_ja: "企業・クリーン", header_style: "left_bar", density: "medium" },
  minimal: { id: "minimal", label_ja: "ミニマル", header_style: "none", density: "low" },
  modern: { id: "modern", label_ja: "モダン", header_style: "none", density: "low" },
  darkbusiness: { id: "darkbusiness", label_ja: "ダークビジネス", header_style: "bottom_bar", density: "medium" },
  technology: { id: "technology", label_ja: "テクノロジー", header_style: "bottom_bar", density: "low" },
  startup: { id: "startup", label_ja: "スタートアップ", header_style: "asymmetric", density: "minimal" },
  premium: { id: "premium", label_ja: "高級", header_style: "thin_band", density: "low" },
  elegant: { id: "elegant", label_ja: "エレガント", header_style: "thin_band", density: "low" },
  creative: { id: "creative", label_ja: "クリエイティブ", header_style: "left_block", density: "medium" },
  colorful: { id: "colorful", label_ja: "カラフル", header_style: "left_block", density: "medium" },
  pop: { id: "pop", label_ja: "ポップ", header_style: "left_block", density: "low" },
  soft: { id: "soft", label_ja: "ソフト", header_style: "none", density: "medium" },
  natural: { id: "natural", label_ja: "ナチュラル", header_style: "thin_band", density: "medium" },
  education: { id: "education", label_ja: "教育", header_style: "left_bar", density: "medium" },
  editorial: { id: "editorial", label_ja: "エディトリアル", header_style: "asymmetric", density: "information_dense" },
  japanesebusiness: { id: "japanesebusiness", label_ja: "日本企業向け", header_style: "thin_band", density: "medium" },
  monochrome: { id: "monochrome", label_ja: "モノクロ", header_style: "left_bar", density: "medium" },
  bold: { id: "bold", label_ja: "大胆", header_style: "full_band", density: "low" },
  gradient: { id: "gradient", label_ja: "グラデーション", header_style: "full_band", density: "low" },
  simpledocument: { id: "simpledocument", label_ja: "シンプル資料", header_style: "none", density: "information_dense" },
});

function st(id, ja, weight, layouts) {
  return Object.freeze({
    id,
    label_ja: ja,
    demand_weight: weight,
    layouts: Object.freeze(layouts),
  });
}

const LY_TITLE = ["centered", "left_aligned", "full_image"];
const LY_TEXT = ["left_aligned", "two_column", "split", "editorial"];
const LY_CARDS = ["card_grid", "three_column", "two_column", "asymmetric"];
const LY_FLOW = ["timeline", "left_aligned", "three_column"];
const LY_CMP = ["comparison", "two_column", "table", "split"];
const LY_NUM = ["number_focus", "chart_focus", "card_grid"];
const LY_CHART = ["chart_focus", "split", "two_column"];
const LY_CLOSE = ["centered", "left_aligned", "split"];

export const PRESENTATION_SLIDE_TYPES = Object.freeze([
  st("cover", "表紙", 12, LY_TITLE),
  st("agenda", "目次", 12, ["left_aligned", "two_column", "editorial"]),
  st("sectiondivider", "章扉", 12, LY_TITLE),
  st("executivesummary", "要約", 12, LY_TEXT),
  st("problem", "課題", 12, LY_TEXT),
  st("solution", "解決策", 12, LY_TEXT),
  st("concept", "コンセプト", 7, LY_TITLE),
  st("textimage", "文章＋画像", 7, ["split", "two_column", "asymmetric"]),
  st("feature", "特徴", 12, LY_CARDS),
  st("benefit", "メリット", 12, LY_CARDS),
  st("points", "ポイント整理", 7, LY_CARDS),
  st("process", "プロセス", 12, LY_FLOW),
  st("steps", "手順", 7, LY_FLOW),
  st("timeline", "タイムライン", 12, ["timeline", "left_aligned"]),
  st("roadmap", "ロードマップ", 12, ["timeline", "three_column"]),
  st("schedule", "スケジュール", 7, ["table", "timeline"]),
  st("comparison", "比較", 12, LY_CMP),
  st("beforeafter", "ビフォーアフター", 7, ["split", "comparison"]),
  st("proscons", "メリット・デメリット", 7, ["two_column", "comparison"]),
  st("pricing", "料金", 12, ["card_grid", "table", "three_column"]),
  st("plancomparison", "プラン比較", 7, ["table", "comparison"]),
  st("kpi", "KPI", 12, LY_NUM),
  st("bignumber", "大きな数字", 12, ["number_focus", "centered"]),
  st("statistics", "統計", 7, LY_NUM),
  st("barchart", "棒グラフ", 12, LY_CHART),
  st("linechart", "折れ線", 7, LY_CHART),
  st("piedonut", "円・ドーナツ", 4, LY_CHART),
  st("table", "表", 12, ["table", "left_aligned"]),
  st("matrix", "マトリクス", 4, ["table", "card_grid"]),
  st("quadrant", "4象限", 4, ["card_grid", "split"]),
  st("funnel", "ファネル", 4, ["left_aligned", "asymmetric"]),
  st("pyramid", "ピラミッド", 4, ["centered", "left_aligned"]),
  st("cycle", "サイクル", 4, ["centered", "card_grid"]),
  st("flow", "フロー", 4, LY_FLOW),
  st("orgchart", "組織図", 4, ["card_grid", "left_aligned"]),
  st("team", "チーム", 12, LY_CARDS),
  st("profile", "プロフィール", 7, ["split", "left_aligned"]),
  st("persona", "顧客・ペルソナ", 7, ["split", "two_column"]),
  st("journey", "カスタマージャーニー", 7, ["timeline", "table"]),
  st("market", "市場", 7, LY_CHART),
  st("competition", "競合", 7, LY_CMP),
  st("swot", "SWOT", 7, ["card_grid", "table"]),
  st("casestudy", "事例", 12, LY_TEXT),
  st("testimonial", "口コミ・コメント", 7, ["centered", "card_grid"]),
  st("portfolio", "実績", 7, LY_CARDS),
  st("productshowcase", "商品紹介", 7, ["split", "card_grid"]),
  st("screenshot", "画面紹介", 7, ["full_image", "split"]),
  st("maplocation", "地図・場所", 4, ["split", "full_image"]),
  st("faq", "FAQ", 7, ["left_aligned", "two_column"]),
  st("qa", "質疑応答", 7, ["centered", "left_aligned"]),
  st("checklist", "チェックリスト", 7, ["left_aligned", "two_column"]),
  st("risk", "リスク", 7, LY_TEXT),
  st("actionitems", "アクション", 7, ["table", "left_aligned"]),
  st("nextsteps", "次のステップ", 7, LY_FLOW),
  st("cta", "CTA", 12, LY_CLOSE),
  st("contact", "連絡先", 12, LY_CLOSE),
  st("thankyou", "終了", 7, LY_TITLE),
  st("quote", "引用", 7, ["centered", "editorial"]),
  st("imagefocus", "画像メイン", 4, ["full_image", "asymmetric"]),
  st("closingsummary", "まとめ", 12, LY_TEXT),
]);

const HIGH_SLIDE = Object.freeze(
  PRESENTATION_SLIDE_TYPES.filter((s) => s.demand_weight >= 12).map((s) => s.id),
);

function sub(id, ja) {
  return Object.freeze({ id, label_ja: ja });
}

function purpose(id, tier, weight, ja, en, extras, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    slide_types: Object.freeze(extras.slide_types),
    densities: Object.freeze(extras.densities || ["medium", "low"]),
    industries: Object.freeze(extras.industries || ["general", "technology"]),
    families: Object.freeze(extras.families || ["corporateclean", "modern", "japanesebusiness"]),
    subcategories: Object.freeze(subs),
  });
}

const D_PITCH = ["minimal", "low"];
const D_REPORT = ["medium", "information_dense"];
const D_SEMI = ["low", "medium"];
const IND_BIZ = ["general", "technology", "finance"];
const IND_CRE = ["general", "creator", "technology"];
const FAM_CORP = ["corporateclean", "japanesebusiness", "minimal", "modern"];
const FAM_TECH = ["technology", "darkbusiness", "modern", "startup"];
const FAM_SOFT = ["soft", "education", "natural", "simpledocument"];

export const PRESENTATION_SET_STRUCTURES = Object.freeze({
  salesproposal: Object.freeze([
    "cover", "agenda", "problem", "solution", "feature", "benefit", "casestudy", "pricing", "schedule", "cta",
  ]),
  pitchdeck: Object.freeze([
    "cover", "problem", "solution", "productshowcase", "market", "competition", "kpi", "nextsteps", "team", "cta",
  ]),
  companyprofile: Object.freeze([
    "cover", "executivesummary", "concept", "timeline", "feature", "benefit", "portfolio", "team", "contact",
  ]),
});

export const PRESENTATION_DEMAND_PURPOSES = Object.freeze([
  purpose("salesproposal", "core", 15, "営業・提案資料", "SALES PROPOSAL", {
    slide_types: PRESENTATION_SET_STRUCTURES.salesproposal,
    densities: D_SEMI,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("sp_customer", "顧客提案"), sub("sp_service", "サービス提案"), sub("sp_solution", "ソリューション"),
    sub("sp_quote", "見積説明"), sub("sp_impl", "導入提案"), sub("sp_close", "クロージング"),
  ]),
  purpose("businessplan", "core", 10, "事業計画", "BUSINESS PLAN", {
    slide_types: ["cover", "executivesummary", "market", "roadmap", "kpi", "orgchart", "risk", "closingsummary"],
    densities: D_REPORT,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("bp_overview", "事業概要"), sub("bp_market", "市場"), sub("bp_strategy", "戦略"), sub("bp_revenue", "収益モデル"),
    sub("bp_finance", "財務計画"), sub("bp_roadmap", "ロードマップ"), sub("bp_risk", "リスク"), sub("bp_org", "組織"),
  ]),
  purpose("projectproposal", "core", 13, "企画書", "PROJECT PROPOSAL", {
    slide_types: ["cover", "agenda", "problem", "solution", "concept", "schedule", "kpi", "cta"],
    densities: D_SEMI,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("pp_bg", "背景"), sub("pp_problem", "課題"), sub("pp_obj", "目的"), sub("pp_idea", "アイデア"),
    sub("pp_sol", "解決策"), sub("pp_sched", "スケジュール"), sub("pp_budget", "予算"), sub("pp_kpi", "KPI"),
    sub("pp_effect", "期待効果"),
  ]),
  purpose("companyprofile", "core", 12, "会社紹介", "COMPANY PROFILE", {
    slide_types: PRESENTATION_SET_STRUCTURES.companyprofile,
    densities: D_SEMI,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("cp_overview", "会社概要"), sub("cp_history", "沿革"), sub("cp_mission", "ミッション"), sub("cp_vision", "ビジョン"),
    sub("cp_values", "価値観"), sub("cp_services", "サービス"), sub("cp_strengths", "強み"), sub("cp_org", "組織"),
    sub("cp_achieve", "実績"), sub("cp_access", "アクセス"),
  ]),
  purpose("serviceproduct", "core", 12, "サービス・商品紹介", "SERVICE / PRODUCT", {
    slide_types: ["cover", "feature", "benefit", "process", "pricing", "comparison", "faq", "cta"],
    densities: D_SEMI,
    industries: ["general", "ecommerce", "technology", "retail"],
    families: ["modern", "corporateclean", "startup"],
  }, [
    sub("sv_overview", "概要"), sub("sv_feat", "特徴"), sub("sv_ben", "メリット"), sub("sv_use", "ユースケース"),
    sub("sv_flow", "ワークフロー"), sub("sv_price", "料金"), sub("sv_cmp", "比較"), sub("sv_faq", "FAQ"), sub("sv_cta", "CTA"),
  ]),
  purpose("pitchdeck", "core", 9, "ピッチデック", "STARTUP / PITCH DECK", {
    slide_types: PRESENTATION_SET_STRUCTURES.pitchdeck,
    densities: D_PITCH,
    industries: ["technology", "ai", "creator", "general"],
    families: FAM_TECH,
  }, [
    sub("pd_vision", "ビジョン"), sub("pd_problem", "課題"), sub("pd_sol", "解決策"), sub("pd_prod", "プロダクト"),
    sub("pd_market", "市場"), sub("pd_tract", "トラクション"), sub("pd_model", "ビジネスモデル"), sub("pd_comp", "競合"),
    sub("pd_gtm", "GTM"), sub("pd_team", "チーム"), sub("pd_fin", "財務"), sub("pd_ask", "Ask"),
  ]),
  purpose("marketing", "medium", 8, "マーケティング", "MARKETING", {
    slide_types: ["cover", "persona", "journey", "funnel", "kpi", "barchart", "cta"],
    densities: D_SEMI,
    industries: ["general", "ecommerce", "retail", "creator"],
    families: ["modern", "colorful", "startup"],
  }, [
    sub("mk_market", "市場"), sub("mk_persona", "ペルソナ"), sub("mk_journey", "ジャーニー"), sub("mk_channel", "チャネル"),
    sub("mk_camp", "キャンペーン"), sub("mk_kpi", "KPI"), sub("mk_funnel", "ファネル"), sub("mk_content", "コンテンツ"),
    sub("mk_analytics", "分析"),
  ]),
  purpose("report", "core", 11, "報告資料", "REPORT", {
    slide_types: ["cover", "executivesummary", "kpi", "barchart", "risk", "actionitems", "nextsteps"],
    densities: D_REPORT,
    industries: IND_BIZ,
    families: ["simpledocument", "corporateclean", "japanesebusiness"],
  }, [
    sub("rp_exec", "エグゼクティブサマリ"), sub("rp_result", "結果"), sub("rp_progress", "進捗"), sub("rp_kpi", "KPI"),
    sub("rp_issue", "課題"), sub("rp_analysis", "分析"), sub("rp_action", "アクション"), sub("rp_next", "次のステップ"),
  ]),
  purpose("meeting", "core", 9, "会議", "MEETING", {
    slide_types: ["cover", "agenda", "executivesummary", "actionitems", "nextsteps", "closingsummary"],
    densities: D_SEMI,
    industries: ["general"],
    families: ["simpledocument", "minimal", "japanesebusiness"],
  }, [
    sub("mt_agenda", "アジェンダ"), sub("mt_obj", "目的"), sub("mt_disc", "議論"), sub("mt_status", "状況"),
    sub("mt_dec", "決定"), sub("mt_action", "アクション"), sub("mt_next", "次回"),
  ]),
  purpose("projectstatus", "core", 9, "プロジェクト進捗", "PROJECT STATUS", {
    slide_types: ["cover", "timeline", "kpi", "risk", "actionitems", "nextsteps"],
    densities: D_REPORT,
    industries: ["general", "technology", "construction"],
    families: FAM_CORP,
  }, [
    sub("ps_mile", "マイルストーン"), sub("ps_time", "タイムライン"), sub("ps_prog", "進捗"), sub("ps_task", "タスク"),
    sub("ps_block", "ブロッカー"), sub("ps_risk", "リスク"), sub("ps_res", "リソース"), sub("ps_next", "次アクション"),
  ]),
  purpose("finance", "medium", 7, "財務・経営数値", "FINANCE", {
    slide_types: ["cover", "kpi", "barchart", "linechart", "table", "closingsummary"],
    densities: D_REPORT,
    industries: ["finance", "general"],
    families: ["corporateclean", "simpledocument", "monochrome"],
  }, [
    sub("fn_rev", "売上"), sub("fn_cost", "コスト"), sub("fn_profit", "利益"), sub("fn_budget", "予算"),
    sub("fn_fcst", "予測"), sub("fn_var", "差異"), sub("fn_kpi", "KPI"), sub("fn_sum", "財務サマリ"),
  ]),
  purpose("recruitment", "medium", 7, "採用・人事", "RECRUITMENT / HR", {
    slide_types: ["cover", "concept", "team", "benefit", "process", "cta"],
    densities: D_SEMI,
    industries: ["recruitment", "general"],
    families: ["soft", "modern", "corporateclean"],
  }, [
    sub("hr_culture", "カルチャー"), sub("hr_job", "職種"), sub("hr_ben", "福利"), sub("hr_emp", "社員"),
    sub("hr_career", "キャリア"), sub("hr_onb", "オンボーディング"), sub("hr_org", "組織"), sub("hr_pitch", "採用ピッチ"),
  ]),
  purpose("training", "medium", 7, "研修・教育", "TRAINING / EDUCATION", {
    slide_types: ["cover", "agenda", "concept", "steps", "checklist", "closingsummary"],
    densities: D_SEMI,
    industries: ["education", "general"],
    families: FAM_SOFT,
  }, [
    sub("ed_lesson", "レッスン"), sub("ed_concept", "概念"), sub("ed_explain", "説明"), sub("ed_ex", "例"),
    sub("ed_exer", "演習"), sub("ed_quiz", "クイズ"), sub("ed_sum", "まとめ"), sub("ed_obj", "学習目標"),
  ]),
  purpose("seminar", "medium", 6, "セミナー", "SEMINAR / WEBINAR", {
    slide_types: ["cover", "agenda", "problem", "solution", "quote", "qa", "cta"],
    densities: D_SEMI,
    industries: IND_CRE,
    families: ["education", "modern", "soft"],
  }, [
    sub("sm_open", "オープニング"), sub("sm_speaker", "講師"), sub("sm_agenda", "アジェンダ"), sub("sm_topic", "本題"),
    sub("sm_data", "データ"), sub("sm_ex", "事例"), sub("sm_sum", "まとめ"), sub("sm_qa", "Q&A"), sub("sm_cta", "CTA"),
  ]),
  purpose("research", "medium", 5, "調査・分析", "RESEARCH / ANALYSIS", {
    slide_types: ["cover", "executivesummary", "barchart", "comparison", "closingsummary"],
    densities: D_REPORT,
    industries: IND_BIZ,
    families: ["simpledocument", "editorial", "monochrome"],
  }, [
    sub("rs_obj", "調査目的"), sub("rs_method", "手法"), sub("rs_data", "データ"), sub("rs_find", "発見"),
    sub("rs_cmp", "比較"), sub("rs_ins", "示唆"), sub("rs_conc", "結論"), sub("rs_rec", "提言"),
  ]),
  purpose("casestudy", "medium", 6, "事例紹介", "CASE STUDY", {
    slide_types: ["cover", "problem", "solution", "process", "kpi", "testimonial", "closingsummary"],
    densities: D_SEMI,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("cs_cust", "顧客"), sub("cs_chal", "課題"), sub("cs_sol", "解決"), sub("cs_impl", "導入"),
    sub("cs_result", "結果"), sub("cs_met", "指標"), sub("cs_test", "証言"), sub("cs_sum", "まとめ"),
  ]),
  purpose("portfolio", "supporting", 4, "ポートフォリオ", "PORTFOLIO", {
    slide_types: ["cover", "profile", "portfolio", "process", "contact"],
    densities: D_PITCH,
    industries: IND_CRE,
    families: ["creative", "editorial", "minimal"],
  }, [
    sub("pf_profile", "プロフィール"), sub("pf_works", "作品"), sub("pf_proj", "プロジェクト"), sub("pf_proc", "プロセス"),
    sub("pf_skill", "スキル"), sub("pf_result", "成果"), sub("pf_client", "クライアント"), sub("pf_contact", "連絡"),
  ]),
  purpose("event", "supporting", 4, "イベント", "EVENT", {
    slide_types: ["cover", "agenda", "schedule", "maplocation", "cta", "thankyou"],
    densities: D_SEMI,
    industries: ["general", "creator"],
    families: ["colorful", "pop", "modern"],
  }, [
    sub("ev_intro", "紹介"), sub("ev_prog", "プログラム"), sub("ev_spk", "登壇"), sub("ev_sched", "日程"),
    sub("ev_spon", "スポンサー"), sub("ev_venue", "会場"), sub("ev_ann", "告知"), sub("ev_close", "クロージング"),
  ]),
  purpose("productroadmap", "supporting", 5, "ロードマップ", "PRODUCT ROADMAP", {
    slide_types: ["cover", "concept", "roadmap", "timeline", "feature", "closingsummary"],
    densities: D_SEMI,
    industries: ["technology", "ai", "general"],
    families: FAM_TECH,
  }, [
    sub("rm_vision", "ビジョン"), sub("rm_cur", "現状"), sub("rm_phase", "フェーズ"), sub("rm_mile", "マイルストーン"),
    sub("rm_feat", "機能"), sub("rm_time", "タイムライン"), sub("rm_fut", "将来"),
  ]),
  purpose("internalstrategy", "supporting", 5, "社内戦略", "INTERNAL STRATEGY", {
    slide_types: ["cover", "executivesummary", "problem", "roadmap", "kpi", "orgchart"],
    densities: D_REPORT,
    industries: IND_BIZ,
    families: FAM_CORP,
  }, [
    sub("is_obj", "目的"), sub("is_cur", "現状"), sub("is_issue", "課題"), sub("is_str", "戦略"),
    sub("is_pri", "優先"), sub("is_org", "組織"), sub("is_kpi", "KPI"), sub("is_road", "ロードマップ"),
  ]),
]);

export const PRESENTATION_QA_CORE_SLIDE_TYPES = Object.freeze([
  "cover", "problem", "solution", "feature", "process", "comparison",
  "pricing", "kpi", "timeline", "team", "casestudy", "cta",
]);

export const PRESENTATION_QA_CORE_FAMILIES = Object.freeze(["corporateclean", "modern", "technology"]);

export const PRESENTATION_QA_CORE_PURPOSES = Object.freeze([
  "salesproposal", "projectproposal", "companyprofile", "serviceproduct", "pitchdeck", "report",
]);

const GENERIC_LEGACY_TAGS = new Set([
  "presentation", "pptx", "ppt", "プレゼン", "プレゼン資料", "プレゼンテンプレート",
  "シンプル", "ミニマル", "modern", "clean", "general",
]);

export const PRESENTATION_LEGACY_PURPOSE_MAP = Object.freeze([
  { legacy: "営業資料", purpose_id: "salesproposal" },
  { legacy: "sales", purpose_id: "salesproposal" },
  { legacy: "会社紹介", purpose_id: "companyprofile" },
  { legacy: "company", purpose_id: "companyprofile" },
  { legacy: "提案書", purpose_id: "projectproposal" },
  { legacy: "proposal", purpose_id: "projectproposal" },
  { legacy: "ピッチ", purpose_id: "pitchdeck" },
  { legacy: "pitch", purpose_id: "pitchdeck" },
  { legacy: "startup", purpose_id: "pitchdeck" },
]);

const PURPOSE_BY_ID = new Map(PRESENTATION_DEMAND_PURPOSES.map((p) => [p.id, p]));
const SLIDE_BY_ID = new Map(PRESENTATION_SLIDE_TYPES.map((s) => [s.id, s]));
const SUB_BY_ID = new Map();
for (const p of PRESENTATION_DEMAND_PURPOSES) {
  for (const s of p.subcategories) SUB_BY_ID.set(s.id, { purpose: p, sub: s });
}

export function getPresentationPurpose(id) {
  return PURPOSE_BY_ID.get(id) || null;
}
export function getPresentationSlideType(id) {
  return SLIDE_BY_ID.get(id) || null;
}

export function listPresentationPurposeSubs() {
  const out = [];
  for (const purpose of PRESENTATION_DEMAND_PURPOSES) {
    for (const subcat of purpose.subcategories) out.push({ purpose, subcat });
  }
  return out;
}

export function presentationSpecFingerprint(spec) {
  return [
    spec.purpose || spec.presentation_purpose || "",
    spec.slide_type || "",
    spec.design_family || "",
    spec.layout_type || "",
    spec.density || "",
    spec.industry || "",
    spec.generation_mode || "slide",
  ].join("|");
}

export function inferPresentationDensity(purposeId, familyId) {
  const p = PURPOSE_BY_ID.get(purposeId);
  const f = PRESENTATION_DESIGN_FAMILIES[familyId];
  if (p?.id === "pitchdeck") return "minimal";
  if (p?.id === "report" || p?.id === "finance") return "information_dense";
  return f?.density || p?.densities?.[0] || "medium";
}

export function buildPresentationJapaneseTitle(spec) {
  const p = PURPOSE_BY_ID.get(spec.purpose);
  const s = SLIDE_BY_ID.get(spec.slide_type);
  const f = PRESENTATION_DESIGN_FAMILIES[spec.design_family];
  const sub = SUB_BY_ID.get(spec.subcategory)?.sub;
  const slideJa = s?.label_ja || spec.slide_type;
  const purposeJa = p?.label_ja || spec.purpose;
  const famJa = f?.label_ja || spec.design_family;
  const subJa = sub?.label_ja || "";
  if (spec.generation_mode === "set") return `${purposeJa}セット（${famJa}）`;
  return subJa ? `${purposeJa}・${slideJa}（${subJa} / ${famJa}）` : `${purposeJa}・${slideJa}（${famJa}）`;
}

export function buildPresentationDescription(spec) {
  const vars = PRESENTATION_TEMPLATE_VARIABLES.slice(0, 8).join(" ");
  return `${buildPresentationJapaneseTitle(spec)}。16:9 編集可能なPPTX。placeholder: ${vars}。実在企業名や確定事実は埋め込まない。`;
}

export function buildPresentationPromptText(spec) {
  const title = spec.title || buildPresentationJapaneseTitle(spec);
  const tokens = [
    "TASFUL_PRES_SPEC",
    `purpose=${spec.purpose}`,
    `slide=${spec.slide_type}`,
    `family=${spec.design_family}`,
    `layout=${spec.layout_type}`,
    `density=${spec.density}`,
    `industry=${spec.industry}`,
    `mode=${spec.generation_mode || "slide"}`,
    `sub=${spec.subcategory}`,
  ].join(" ");
  return [
    tokens,
    "::",
    title,
    "editable PPTX 16:9.",
    "placeholders only: [会社名] [サービス名] [KPI] [課題] [解決策] [グラフデータ].",
    "no real company facts, no orange header clone, vary hierarchy by family and layout.",
    spec.generation_mode === "set" ? "same design family slide set, missing types first." : "single reusable slide, not a padded full deck clone.",
  ].join(" ");
}

export function drivePathForPresentationSpec(spec) {
  const p = PURPOSE_BY_ID.get(spec.purpose);
  const s = SLIDE_BY_ID.get(spec.slide_type);
  const purposeJa = p?.label_ja || spec.purpose;
  const slideJa = spec.generation_mode === "set" ? "セット" : s?.label_ja || spec.slide_type;
  return `プレゼン/${purposeJa}/${slideJa}/${spec.design_family}`;
}

export function slugForPresentationSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.purpose,
    spec.slide_type,
    spec.design_family,
    String(spec.layout_type || "").replace(/_/g, ""),
    spec.density === "information_dense" ? "dense" : spec.density,
    spec.industry,
    spec.generation_mode === "set" ? "set" : "slide",
    q,
    `${dayPart}${scopeSuffix}`,
  ].join("-");
}

export function parsePresentationSpecFromPrompt(text) {
  const raw = String(text || "");
  if (!raw.includes("TASFUL_PRES_SPEC")) return null;
  const grab = (key) => {
    const m = raw.match(new RegExp(`${key}=([a-z0-9_]+)`));
    return m ? m[1] : "";
  };
  const purpose = grab("purpose");
  const slide_type = grab("slide");
  const design_family = grab("family");
  if (!PURPOSE_BY_ID.has(purpose) || !SLIDE_BY_ID.has(slide_type) || !PRESENTATION_DESIGN_FAMILIES[design_family]) {
    return null;
  }
  return {
    purpose,
    slide_type,
    design_family,
    layout_type: grab("layout") || "left_aligned",
    density: grab("density") || inferPresentationDensity(purpose, design_family),
    industry: grab("industry") || "general",
    generation_mode: grab("mode") || "slide",
    subcategory: grab("sub") || "",
  };
}

export function parsePresentationSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const purpose = PURPOSE_BY_ID.has(tokens[0]) ? tokens.shift() : "";
  const slide_type = SLIDE_BY_ID.has(tokens[0]) ? tokens.shift() : "";
  const design_family = PRESENTATION_DESIGN_FAMILIES[tokens[0]] ? tokens.shift() : "";
  const layoutRaw = tokens[0] || "";
  const layout_type = Object.keys(PRESENTATION_LAYOUT_TYPES).find((id) => id.replace(/_/g, "") === layoutRaw) || "";
  if (layout_type) tokens.shift();
  let density = "";
  if (tokens[0] === "dense") {
    density = "information_dense";
    tokens.shift();
  } else if (PRESENTATION_DENSITIES[tokens[0]]) {
    density = tokens.shift();
  }
  const industry = PRESENTATION_INDUSTRIES[tokens[0]] ? tokens.shift() : "";
  const generation_mode = tokens[0] === "set" || tokens[0] === "slide" ? tokens.shift() : "slide";
  return { purpose, slide_type, design_family, layout_type, density, industry, generation_mode };
}

export function parsePresentationSpecFromPath({ slug = "", metadata = {}, prompt = "" } = {}) {
  if (metadata?.presentation_purpose && metadata?.slide_type && metadata?.design_family) {
    return {
      purpose: metadata.presentation_purpose,
      slide_type: metadata.slide_type,
      design_family: metadata.design_family,
      layout_type: metadata.layout_type || "",
      density: metadata.density || "",
      industry: metadata.industry || "general",
      generation_mode: metadata.generation_mode || "slide",
      subcategory: metadata.subcategory || "",
      title: metadata.title || "",
    };
  }
  const fromPrompt = parsePresentationSpecFromPrompt(prompt);
  if (fromPrompt) return fromPrompt;
  const fromSlug = parsePresentationSlugParts(slug);
  if (fromSlug.purpose && fromSlug.slide_type && fromSlug.design_family) return fromSlug;
  return null;
}

export function presentationSpecToMetadata(spec) {
  return {
    presentation_purpose: spec.purpose || "",
    genre: spec.purpose || "",
    subcategory: spec.subcategory || "",
    slide_type: spec.slide_type || "",
    design_family: spec.design_family || "",
    layout_type: spec.layout_type || "",
    layout: spec.layout_type || "",
    density: spec.density || "",
    industry: spec.industry || "",
    aspect_ratio: PRESENTATION_ASPECT_PRIMARY,
    size: PRESENTATION_ASPECT_PRIMARY,
    orientation: PRESENTATION_ASPECT_PRIMARY,
    use_case: spec.purpose || "",
    style: spec.design_family || "",
    language: "ja",
    template_variables: PRESENTATION_TEMPLATE_VARIABLES.join(","),
    generator: "Presentation-AutoGenerator",
    category: spec.purpose || "",
    feature: spec.generation_mode || "slide",
  };
}

export function classifyLegacyPresentationItem(item) {
  const hay = [item.subcategory, item.layout, ...(item.tags || [])]
    .map((x) => String(x || "").toLowerCase())
    .filter((t) => t && !GENERIC_LEGACY_TAGS.has(t));
  const raw = [item.subcategory, item.layout, ...(item.tags || [])].map((x) => String(x || ""));
  for (const row of PRESENTATION_LEGACY_PURPOSE_MAP) {
    const hit = raw.some((t) => t === row.legacy) || hay.includes(row.legacy.toLowerCase());
    if (hit) return { purpose: row.purpose_id, slide_type: "unclassified", design_family: "unclassified", confidence: "derived" };
  }
  return { purpose: "unclassified", slide_type: "unclassified", design_family: "unclassified", confidence: "none" };
}

export function validatePresentationSsot() {
  const issues = [];
  const pids = new Set();
  const sids = new Set();
  if (PRESENTATION_DEMAND_PURPOSES.length !== 20) issues.push(`purposes ${PRESENTATION_DEMAND_PURPOSES.length}`);
  if (PRESENTATION_SLIDE_TYPES.length !== 60) issues.push(`slides ${PRESENTATION_SLIDE_TYPES.length}`);
  if (Object.keys(PRESENTATION_DESIGN_FAMILIES).length !== 20) issues.push("families");
  let core = 0;
  let medium = 0;
  let supporting = 0;
  let subs = 0;
  for (const p of PRESENTATION_DEMAND_PURPOSES) {
    if (pids.has(p.id) || /[^a-z0-9]/.test(p.id)) issues.push(`purpose id ${p.id}`);
    pids.add(p.id);
    if (p.tier === "core") core += 1;
    else if (p.tier === "medium") medium += 1;
    else supporting += 1;
    if (!p.slide_types?.length) issues.push(`no slides ${p.id}`);
    for (const s of p.subcategories) {
      if (SUB_BY_ID.get(s.id)?.purpose.id !== p.id && SUB_BY_ID.get(s.id)) issues.push(`dup sub ${s.id}`);
      subs += 1;
    }
  }
  for (const s of PRESENTATION_SLIDE_TYPES) {
    if (sids.has(s.id) || /[^a-z0-9]/.test(s.id)) issues.push(`slide id ${s.id}`);
    sids.add(s.id);
  }
  if (core !== 9 || medium !== 7 || supporting !== 4) issues.push(`tiers c${core} m${medium} s${supporting}`);
  for (const id of HIGH_SLIDE) {
    if (!sids.has(id)) issues.push(`high missing ${id}`);
  }
  return {
    ok: issues.length === 0,
    issues,
    purposes: PRESENTATION_DEMAND_PURPOSES.length,
    slide_types: PRESENTATION_SLIDE_TYPES.length,
    families: Object.keys(PRESENTATION_DESIGN_FAMILIES).length,
    subcategories: subs,
    core,
    medium,
    supporting,
    high_slide_count: HIGH_SLIDE.length,
  };
}

export const PRESENTATION_CORE_PURPOSE_COUNT = PRESENTATION_DEMAND_PURPOSES.filter((p) => p.tier === "core").length;
export const PRESENTATION_HIGH_SLIDE_IDS = HIGH_SLIDE;
