/**
 * Web Material Demand Category SSOT V1 — reusable sections / components / decorations.
 * Does not copy Icon / Image / Illustration / Background taxonomies.
 * Page type ≠ component type ≠ style. Existing inventory is never auto-FILL'd.
 * Genre list is folded by genre-restructure-web-code-text-v1 (45 canonical).
 */
import { foldWebDemandGenres, resolveGenreAlias, webDriveFolderName } from "./genre-restructure-web-code-text-v1.mjs";

export const WEB_DEMAND_GENRE_SSOT_VERSION = "materials-web-genre-restructure-v1";

export const WEB_COMPONENT_TYPES = Object.freeze({
  page: { id: "page", slug: "ctpage", label_ja: "ページ" },
  section: { id: "section", slug: "ctsect", label_ja: "セクション" },
  component: { id: "component", slug: "ctcomp", label_ja: "部品" },
  decoration: { id: "decoration", slug: "ctdeco", label_ja: "装飾" },
});

export const WEB_LAYOUT_TYPES = Object.freeze({
  single_column: { id: "single_column", slug: "lysingle", label_ja: "1カラム" },
  two_column: { id: "two_column", slug: "lytwo", label_ja: "2カラム" },
  three_column: { id: "three_column", slug: "lythree", label_ja: "3カラム" },
  grid: { id: "grid", slug: "lygrid", label_ja: "グリッド" },
  split: { id: "split", slug: "lysplit", label_ja: "スプリット" },
  centered: { id: "centered", slug: "lycenter", label_ja: "中央" },
  sidebar: { id: "sidebar", slug: "lyside", label_ja: "サイドバー" },
  full_width: { id: "full_width", slug: "lyfull", label_ja: "全幅" },
});

export const WEB_RESPONSIVE_MODES = Object.freeze({
  responsive: { id: "responsive", slug: "rsresp", label_ja: "レスポンシブ" },
  desktop_first: { id: "desktop_first", slug: "rsdesk", label_ja: "Desktop優先" },
  mobile_first: { id: "mobile_first", slug: "rsmob", label_ja: "Mobile優先" },
});

export const WEB_THEMES = Object.freeze({
  light: { id: "light", slug: "thlight", label_ja: "ライト" },
  dark: { id: "dark", slug: "thdark", label_ja: "ダーク" },
  mixed: { id: "mixed", slug: "thmixed", label_ja: "ミックス" },
});

export const WEB_DENSITIES = Object.freeze({
  compact: { id: "compact", slug: "dncompact", label_ja: "密" },
  normal: { id: "normal", slug: "dnnormal", label_ja: "標準" },
  spacious: { id: "spacious", slug: "dnspacious", label_ja: "余白多" },
});

export const WEB_STYLES = Object.freeze({
  minimal: { id: "minimal", slug: "stmin", label_ja: "ミニマル" },
  corporate: { id: "corporate", slug: "stcorp", label_ja: "コーポレート" },
  modern: { id: "modern", slug: "stmod", label_ja: "モダン" },
  premium: { id: "premium", slug: "stprem", label_ja: "プレミアム" },
  elegant: { id: "elegant", slug: "steleg", label_ja: "エレガント" },
  playful: { id: "playful", slug: "stplay", label_ja: "プレイフル" },
  bold: { id: "bold", slug: "stbold", label_ja: "ボールド" },
  soft: { id: "soft", slug: "stsoft", label_ja: "ソフト" },
  darkstyle: { id: "darkstyle", slug: "stdark", label_ja: "ダークスタイル" },
  editorial: { id: "editorial", slug: "stedit", label_ja: "エディトリアル" },
  tech: { id: "tech", slug: "sttech", label_ja: "テック" },
  clean: { id: "clean", slug: "stclean", label_ja: "クリーン" },
  colorful: { id: "colorful", slug: "stcolor", label_ja: "カラフル" },
  japaneseclean: { id: "japaneseclean", slug: "stjp", label_ja: "和モダン" },
});

export const WEB_USE_CASES = Object.freeze({
  saas: { id: "saas", label_ja: "SaaS" },
  ecommerce: { id: "ecommerce", label_ja: "EC" },
  corporate: { id: "corporate", label_ja: "企業" },
  recruitment: { id: "recruitment", label_ja: "採用" },
  blog: { id: "blog", label_ja: "ブログ" },
  app: { id: "app", label_ja: "アプリ" },
  admin: { id: "admin", label_ja: "管理画面" },
});

/** Audit-only unique tag hits. Title excluded. Never auto-FILL. */
export const WEB_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "hero", genre_ids: ["hero"] },
  { legacy: "landing", genre_ids: ["hero"] },
  { legacy: "pricing", genre_ids: ["pricing"] },
  { legacy: "faq", genre_ids: ["faq"] },
  { legacy: "dashboard", genre_ids: ["dashboard"] },
]);

export const WEB_P0_GENRES = Object.freeze([
  "header",
  "cta",
  "feature",
  "testimonial",
  "form",
  "card",
  "login",
  "search",
]);

const STY_CORP = ["minimal", "corporate", "clean", "modern", "japaneseclean"];
const STY_SAAS = ["minimal", "modern", "tech", "clean", "bold"];
const STY_EC = ["modern", "colorful", "bold", "playful", "clean"];
const STY_UI = ["minimal", "modern", "tech", "clean", "soft"];
const STY_PART = ["minimal", "clean", "modern", "soft", "bold"];
const LAY_SEC = ["centered", "split", "two_column", "three_column", "grid", "full_width"];
const LAY_UI = ["single_column", "centered", "full_width", "sidebar"];
const LAY_PART = ["single_column", "centered", "full_width"];
const UC_WEB = ["saas", "corporate", "ecommerce"];
const UC_APP = ["saas", "app", "admin"];
const UC_EC = ["ecommerce", "saas"];
const UC_DOC = ["corporate", "saas", "blog"];

function fn(id, ja, promptEn, extra = {}) {
  const sceneId = `${id}_part`;
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: ja,
    use_cases: Object.freeze(extra.use_cases || UC_WEB),
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

function genre(id, tier, weight, ja, en, extra, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    component_type: extra.component_type || "section",
    allowed_components: Object.freeze(extra.allowed_components || [extra.component_type || "section"]),
    allowed_layouts: Object.freeze(extra.layouts || LAY_SEC),
    allowed_styles: Object.freeze(extra.styles || STY_CORP),
    p0_shortage: extra.p0_shortage === true,
    generator: extra.generator || "section",
    subgenres: Object.freeze(subs),
  });
}

const WEB_DEMAND_GENRES_SOURCE = Object.freeze([
  genre("hero", "core", 7, "ヒーロー", "HERO", { generator: "hero", styles: STY_SAAS, layouts: ["centered", "split", "full_width", "two_column"] }, [
    fn("her_centered", "中央ヒーロー", "a centered hero section with headline, short value text, and two CTAs"),
    fn("her_split", "スプリットヒーロー", "a split hero: copy left, visual placeholder right, stacked on mobile"),
    fn("her_image", "画像ヒーロー", "a hero with contained image placeholder, no overflow"),
    fn("her_product", "プロダクトヒーロー", "a product hero with device mock placeholder and CTA"),
    fn("her_saas", "SaaSヒーロー", "a SaaS product hero, clean, no stock photo people", { use_cases: UC_APP }),
    fn("her_corporate", "コーポレートヒーロー", "a corporate hero with calm headline and contact CTA"),
    fn("her_ecommerce", "ECヒーロー", "an ecommerce hero with product highlight and shop CTA", { use_cases: UC_EC }),
    fn("her_recruitment", "採用ヒーロー", "a recruitment hero with apply CTA, no portraits", { use_cases: ["recruitment", "corporate"] }),
    fn("her_creator", "クリエイターヒーロー", "a creator portfolio hero, work-first, no faces"),
    fn("her_app", "アプリヒーロー", "an app download hero with store buttons as placeholders", { use_cases: ["app", "saas"] }),
    fn("her_video", "動画ヒーロー", "a video-ready hero with 16:9 contained media frame"),
    fn("her_minimal", "ミニマルヒーロー", "a minimal hero, lots of whitespace, one CTA"),
  ]),
  genre("header", "core", 12, "ヘッダー・ナビ", "HEADER / NAVIGATION", { generator: "header", component_type: "component", allowed_components: ["component", "section"], layouts: LAY_UI, styles: STY_UI, p0_shortage: true }, [
    fn("hdr_simple", "シンプルヘッダー", "a simple header: logo, 4 nav links, primary CTA, hamburger on mobile"),
    fn("hdr_centered", "中央ナビ", "a centered navigation header"),
    fn("hdr_mega", "メガメニュー", "a header with mega-menu panel, closed by default"),
    fn("hdr_saas", "SaaSヘッダー", "a SaaS header with product links and login", { use_cases: UC_APP }),
    fn("hdr_ecommerce", "ECヘッダー", "an ecommerce header with search and cart icon", { use_cases: UC_EC }),
    fn("hdr_transparent", "透過ヘッダー", "a transparent overlay header for heroes"),
    fn("hdr_sticky", "追従ヘッダー", "a sticky header bar, compact height"),
    fn("hdr_mobile", "モバイルナビ", "a mobile-first nav drawer pattern"),
    fn("hdr_utility", "ユーティリティナビ", "a utility top bar with language and help links"),
    fn("hdr_account", "アカウントナビ", "an account header with avatar placeholder, no face photo"),
  ]),
  genre("footer", "core", 6, "フッター", "FOOTER", { generator: "footer", layouts: ["full_width", "grid", "three_column"] }, [
    fn("ftr_simple", "シンプルフッター", "a simple footer with copyright and 3 links"),
    fn("ftr_multi", "マルチカラムフッター", "a multi-column footer that stacks on mobile"),
    fn("ftr_saas", "SaaSフッター", "a SaaS footer with product, company, legal columns", { use_cases: UC_APP }),
    fn("ftr_ecommerce", "ECフッター", "an ecommerce footer with shop links", { use_cases: UC_EC }),
    fn("ftr_corporate", "コーポレートフッター", "a corporate footer with address placeholders"),
    fn("ftr_newsletter", "メルマガフッター", "a footer with email signup field, no live submit"),
    fn("ftr_legal", "法務フッター", "a legal footer with privacy and terms links"),
    fn("ftr_social", "ソーシャルフッター", "a footer with social icon buttons, no third-party scripts"),
  ]),
  genre("cta", "core", 12, "CTAセクション", "CTA", { generator: "cta", styles: STY_SAAS, p0_shortage: true }, [
    fn("cta_centered", "中央CTA", "a centered CTA band with headline and one primary button"),
    fn("cta_split", "スプリットCTA", "a split CTA: copy and form-less button group"),
    fn("cta_banner", "バナーCTA", "a full-width CTA banner"),
    fn("cta_signup", "登録CTA", "a signup CTA section with email field, no live API"),
    fn("cta_contact", "問い合わせCTA", "a contact CTA with secondary ghost button"),
    fn("cta_download", "ダウンロードCTA", "a download CTA for a resource"),
    fn("cta_trial", "トライアルCTA", "a free-trial CTA for SaaS", { use_cases: UC_APP }),
    fn("cta_purchase", "購入CTA", "a purchase CTA for ecommerce", { use_cases: UC_EC }),
    fn("cta_app", "アプリCTA", "an app install CTA", { use_cases: ["app"] }),
  ]),
  genre("feature", "core", 11, "特徴・機能紹介", "FEATURE", { generator: "feature", p0_shortage: true }, [
    fn("feat_cards", "機能カード", "a three-up feature card grid that collapses on mobile"),
    fn("feat_icon", "アイコン機能", "icon + title + text feature row, SVG placeholders"),
    fn("feat_alternating", "交互機能", "alternating feature blocks, image then copy"),
    fn("feat_compare", "比較機能", "a comparison of three capabilities"),
    fn("feat_grid", "機能グリッド", "a 2x3 feature grid"),
    fn("feat_product", "商品機能", "product feature highlights"),
    fn("feat_saas", "SaaS機能", "SaaS feature section", { use_cases: UC_APP }),
    fn("feat_service", "サービス機能", "service feature cards"),
  ]),
  genre("benefit", "core", 8, "メリット・価値訴求", "BENEFIT / VALUE", { generator: "feature" }, [
    fn("ben_grid", "メリットグリッド", "a benefits grid with 4 value cards"),
    fn("ben_beforeafter", "ビフォーアフター", "a before/after two-column comparison, no people"),
    fn("ben_value", "価値カード", "value proposition cards"),
    fn("ben_problem", "課題と解決", "problem / solution two-column section"),
    fn("ben_advantages", "選ばれる理由", "reasons-to-choose numbered list"),
    fn("ben_reasons", "理由リスト", "three reasons with short copy"),
    fn("ben_usp", "USPセクション", "a unique selling point band"),
  ]),
  genre("about", "core", 6, "会社・紹介", "ABOUT / COMPANY", { generator: "feature", styles: STY_CORP }, [
    fn("abt_us", "私たちについて", "an about-us section with mission sentence"),
    fn("abt_mission", "ミッション", "a mission statement block"),
    fn("abt_vision", "ビジョン", "a vision statement block"),
    fn("abt_philosophy", "理念", "a company philosophy section"),
    fn("abt_profile", "会社概要", "a company profile definition list"),
    fn("abt_story", "ストーリー", "a company story timeline, no portraits"),
    fn("abt_team", "チーム紹介", "team intro with role cards, no faces"),
    fn("abt_founder", "代表メッセージ", "founder message layout, avatar placeholder only"),
    fn("abt_stats", "数字で見る", "company statistics KPI row"),
  ]),
  genre("service", "core", 10, "サービス紹介", "SERVICE", { generator: "feature" }, [
    fn("svc_cards", "サービスカード", "service offering cards"),
    fn("svc_list", "サービス一覧", "a service list with short blurbs"),
    fn("svc_detail", "サービス詳細", "a service detail intro section"),
    fn("svc_compare", "サービス比較", "service comparison table-like cards"),
    fn("svc_process", "プロセス", "a 4-step process row that stacks on mobile"),
    fn("svc_workflow", "ワークフロー", "a workflow steps section"),
    fn("svc_solution", "ソリューション", "a solution section"),
    fn("svc_industry", "業界別ソリューション", "industry solution cards"),
  ]),
  genre("product", "core", 10, "商品・プロダクト紹介", "PRODUCT", { generator: "feature", styles: STY_EC }, [
    fn("prd_cards", "プロダクトカード", "product intro cards"),
    fn("prd_detail", "詳細イントロ", "product detail intro with specs list"),
    fn("prd_gallery", "ギャラリー", "product gallery grid, contained images"),
    fn("prd_specs", "スペック", "a specs definition list"),
    fn("prd_benefits", "商品メリット", "product benefits bullets"),
    fn("prd_compare", "商品比較", "product comparison cards"),
    fn("prd_variants", "バリエーション", "product variant selector UI, no live cart"),
  ]),
  genre("pricing", "core", 10, "料金", "PRICING", { generator: "pricing", layouts: ["three_column", "grid", "centered"] }, [
    fn("prc_table", "料金表", "a pricing table section", { use_cases: UC_APP }),
    fn("prc_cards", "料金カード", "three pricing cards, middle featured"),
    fn("prc_tier", "プラン比較", "tier comparison"),
    fn("prc_toggle", "月額年額レイアウト", "monthly/yearly toggle layout, visual only"),
    fn("prc_freemium", "フリーミアム", "freemium pricing with free and paid columns"),
    fn("prc_enterprise", "エンタープライズ料金", "enterprise pricing CTA card"),
    fn("prc_addon", "アドオン料金", "add-on pricing list"),
  ]),
  genre("testimonial", "core", 10, "口コミ・実績", "TESTIMONIAL / REVIEW", { generator: "testimonial", p0_shortage: true }, [
    fn("tst_cards", "声カード", "testimonial cards with quote text, initials avatar, no photos"),
    fn("tst_quotes", "引用", "customer quote blocks"),
    fn("tst_grid", "レビューグリッド", "a review grid with star placeholders"),
    fn("tst_casequote", "事例引用", "a case-study quote band"),
    fn("tst_rating", "評価", "rating summary with bars"),
    fn("tst_logos", "導入ロゴ", "customer logo row as gray boxes, no real brands"),
  ]),
  genre("casestudy", "core", 6, "事例・実績", "CASE STUDY / WORKS", { generator: "feature" }, [
    fn("cse_cards", "事例カード", "case study cards with metrics"),
    fn("cse_portfolio", "実績グリッド", "portfolio grid of project cards"),
    fn("cse_beforeafter", "事例ビフォーアフター", "before/after project layout"),
    fn("cse_showcase", "ショーケース", "project showcase row"),
    fn("cse_results", "成果", "client results metrics"),
    fn("cse_metrics", "数値成果", "metrics result KPIs"),
  ]),
  genre("faq", "core", 10, "FAQ", "FAQ", { generator: "faq", layouts: ["single_column", "two_column", "centered"] }, [
    fn("faq_accordion", "アコーディオンFAQ", "an accordion FAQ, first item open"),
    fn("faq_categorized", "カテゴリFAQ", "categorized FAQ with two groups"),
    fn("faq_simple", "シンプルFAQ", "a simple stacked FAQ"),
    fn("faq_support", "サポートFAQ", "support FAQ"),
    fn("faq_pricing", "料金FAQ", "pricing FAQ"),
  ]),
  genre("contact", "core", 10, "お問い合わせ", "CONTACT", { generator: "contact" }, [
    fn("cnt_form", "問い合わせフォーム", "a contact form, preventDefault, no live send"),
    fn("cnt_simple", "シンプル連絡", "simple contact block with email placeholder"),
    fn("cnt_inquiry", "問い合わせCTA", "inquiry CTA plus short form"),
    fn("cnt_map", "地図つき連絡", "map placeholder box plus contact details"),
    fn("cnt_support", "サポート連絡", "support contact cards"),
    fn("cnt_business", "法人問い合わせ", "B2B inquiry form"),
    fn("cnt_reservation", "予約連絡", "reservation contact form, no payment"),
  ]),
  genre("newsletter", "core", 6, "リード獲得", "NEWSLETTER / LEAD", { generator: "cta" }, [
    fn("nws_letter", "ニュースレター", "newsletter signup section, no live API"),
    fn("nws_email", "メール登録", "email signup inline field"),
    fn("nws_ebook", "資料ダウンロード", "ebook download lead form"),
    fn("nws_magnet", "リードマグネット", "lead magnet card"),
    fn("nws_waitlist", "ウェイトリスト", "waitlist signup"),
    fn("nws_early", "アーリーアクセス", "early access form"),
    fn("nws_consultation", "相談予約", "consultation booking CTA"),
  ]),
  genre("trust", "core", 5, "信頼・安心", "TRUST / SECURITY", { generator: "feature" }, [
    fn("trs_security", "セキュリティ", "security assurances with lock icons"),
    fn("trs_certs", "認証", "certification badge row as placeholders"),
    fn("trs_guarantee", "保証", "guarantee section"),
    fn("trs_privacy", "プライバシー", "privacy promise section"),
    fn("trs_badges", "信頼バッジ", "trust badge row, no real brand logos"),
    fn("trs_compliance", "コンプライアンス", "compliance note"),
    fn("trs_support", "サポート約束", "support promise"),
    fn("trs_payment", "決済安全", "payment security note, UI only"),
  ]),
  genre("blog", "core", 9, "ブログ・記事", "BLOG / ARTICLE", { generator: "feature", styles: ["editorial", "clean", "minimal", "japaneseclean"], use_cases: UC_DOC }, [
    fn("blg_list", "記事一覧", "article list with dates", { use_cases: ["blog", "corporate"] }),
    fn("blg_featured", "注目記事", "featured article hero card"),
    fn("blg_cards", "ブログカード", "blog cards grid"),
    fn("blg_category", "カテゴリ一覧", "category list"),
    fn("blg_articlehero", "記事ヒーロー", "article title hero, not a landing page"),
    fn("blg_author", "著者", "author block with initials, no photo"),
    fn("blg_related", "関連記事", "related articles row"),
  ]),
  genre("news", "supporting", 4, "ニュース・プレス", "NEWS / PRESS", { generator: "feature" }, [
    fn("press_list", "ニュース一覧", "news list"),
    fn("press_release", "プレスリリース", "press release item layout"),
    fn("press_announce", "お知らせ", "announcement list"),
    fn("press_media", "メディア掲載", "media coverage placeholders"),
    fn("press_timeline", "更新タイムライン", "update timeline"),
  ]),
  genre("gallery", "core", 5, "ギャラリー・作品", "GALLERY / PORTFOLIO", { generator: "feature", layouts: ["grid", "full_width"] }, [
    fn("gal_grid", "画像グリッド", "image grid with contained placeholders"),
    fn("gal_masonry", "メイソンリ風", "simple CSS masonry-like stacked tiles"),
    fn("gal_project", "プロジェクト", "project gallery"),
    fn("gal_creator", "クリエイター作品", "creator portfolio grid"),
    fn("gal_photo", "写真ギャラリー", "photography grid, no people required"),
    fn("gal_design", "デザイン作品", "design portfolio"),
    fn("gal_hover", "ホバーギャラリー", "hover caption gallery"),
  ]),
  genre("video", "supporting", 4, "動画・メディア", "VIDEO / MEDIA", { generator: "section" }, [
    fn("vid_featured", "動画ヒーロー枠", "featured 16:9 video frame, no autoplay embed"),
    fn("vid_gallery", "動画ギャラリー", "video thumbnail gallery"),
    fn("vid_card", "メディアカード", "media card with play glyph"),
    fn("vid_podcast", "ポッドキャスト", "podcast episode list"),
    fn("vid_stream", "配信セクション", "streaming section UI"),
  ]),
  genre("download", "core", 5, "資料・ダウンロード", "DOWNLOAD / RESOURCE", { generator: "feature" }, [
    fn("dl_cards", "資料カード", "resource download cards"),
    fn("dl_whitepaper", "ホワイトペーパー", "whitepaper download"),
    fn("dl_pdf", "PDFダウンロード", "PDF download row"),
    fn("dl_template", "テンプレ配布", "template download"),
    fn("dl_library", "資料ライブラリ", "document library list"),
    fn("dl_hub", "リソースハブ", "resource hub grid"),
  ]),
  genre("ecgrid", "core", 11, "EC商品一覧", "EC PRODUCT GRID", { generator: "productgrid", styles: STY_EC, layouts: ["grid", "three_column", "full_width"], p0_shortage: true }, [
    fn("ec_grid", "商品グリッド", "ecommerce product grid, 4 cards, stacks on mobile", { use_cases: UC_EC }),
    fn("ec_cards", "商品カード", "product cards with price and cart button, no live checkout"),
    fn("ec_category", "カテゴリグリッド", "category tiles"),
    fn("ec_sale", "セールグリッド", "sale product grid"),
    fn("ec_recommend", "おすすめ", "recommendation row"),
    fn("ec_ranking", "ランキング", "ranking list"),
    fn("ec_new", "新着", "new arrivals"),
    fn("ec_related", "関連商品", "related products"),
  ]),
  genre("cart", "core", 6, "カート・購入", "CART / CHECKOUT", { generator: "section", styles: STY_EC }, [
    fn("cart_summary", "カート要約", "cart summary UI, no payment API", { use_cases: UC_EC }),
    fn("cart_steps", "購入ステップ", "checkout step indicator"),
    fn("cart_order", "注文要約", "order summary panel"),
    fn("cart_payment", "支払いUI", "payment method tiles, UI only"),
    fn("cart_coupon", "クーポン欄", "coupon field"),
    fn("cart_shipping", "配送選択", "shipping selection radios"),
  ]),
  genre("sale", "supporting", 5, "セール・キャンペーン", "SALE / CAMPAIGN", { generator: "banner", styles: STY_EC }, [
    fn("sale_banner", "セールバナー", "sale banner"),
    fn("sale_coupon", "クーポン", "coupon section"),
    fn("sale_limited", "期間限定", "limited offer band"),
    fn("sale_countdown", "カウントダウン", "countdown layout, static numbers"),
    fn("sale_seasonal", "季節キャンペーン", "seasonal campaign section"),
    fn("sale_landing", "キャンペーン帯", "campaign landing section, not a full page"),
  ]),
  genre("subscription", "core", 6, "プラン・サブスク", "PLAN / SUBSCRIPTION", { generator: "pricing" }, [
    fn("sub_cards", "プランカード", "subscription plan cards", { use_cases: UC_APP }),
    fn("sub_compare", "サブスク比較", "subscription comparison"),
    fn("sub_quota", "利用枠", "usage quota meters"),
    fn("sub_addon", "アドオン選択", "add-on selector"),
    fn("sub_upgrade", "アップグレード", "upgrade section"),
  ]),
  genre("dashboard", "core", 11, "ダッシュボード", "DASHBOARD", { generator: "dashboard", layouts: ["sidebar", "grid", "full_width"], styles: STY_UI }, [
    fn("dash_kpi", "KPIカード", "KPI cards overview", { use_cases: UC_APP }),
    fn("dash_analytics", "分析ダッシュボード", "analytics dashboard shell"),
    fn("dash_account", "アカウントダッシュボード", "account dashboard"),
    fn("dash_project", "プロジェクトダッシュボード", "project dashboard"),
    fn("dash_admin", "管理ダッシュボード", "admin dashboard", { use_cases: ["admin", "saas"] }),
    fn("dash_overview", "シンプル概要", "simple overview"),
    fn("dash_activity", "アクティビティ", "activity panel"),
  ]),
  genre("table", "core", 6, "テーブル・一覧", "TABLE / DATA LIST", { generator: "table", layouts: ["full_width", "single_column"] }, [
    fn("tbl_data", "データテーブル", "a responsive data table with horizontal scroll on mobile", { use_cases: UC_APP }),
    fn("tbl_users", "ユーザー一覧", "user list table"),
    fn("tbl_orders", "注文一覧", "order list"),
    fn("tbl_tx", "取引一覧", "transaction list"),
    fn("tbl_projects", "プロジェクト一覧", "project list"),
    fn("tbl_responsive", "レスポンシブ表", "responsive table UI"),
    fn("tbl_sortable", "ソート表UI", "sortable table headers, visual only"),
  ]),
  genre("form", "core", 11, "フォーム", "FORM", { generator: "contact", component_type: "component", allowed_components: ["component", "section"], p0_shortage: true }, [
    fn("frm_login", "ログイン", "login form, preventDefault", { use_cases: UC_APP }),
    fn("frm_signup", "新規登録", "signup form"),
    fn("frm_profile", "プロフィール", "profile form"),
    fn("frm_settings", "設定フォーム", "settings form"),
    fn("frm_checkout", "購入フォーム", "checkout form UI only", { use_cases: UC_EC }),
    fn("frm_search", "検索フォーム", "search form"),
    fn("frm_multistep", "ステップフォーム", "multi-step form chrome, step 1 visible"),
    fn("frm_inquiry", "問い合わせフォーム部品", "inquiry form"),
  ]),
  genre("card", "core", 10, "カード・パネル", "CARD / PANEL", { generator: "feature", component_type: "component", allowed_components: ["component"], layouts: LAY_PART, p0_shortage: true }, [
    fn("crd_simple", "シンプルカード", "a simple content card"),
    fn("crd_profile", "プロフィールカード", "profile card, initials only"),
    fn("crd_stats", "統計カード", "stats card"),
    fn("crd_product", "商品カード部品", "product card"),
    fn("crd_service", "サービスカード部品", "service card"),
    fn("crd_info", "情報カード", "info card"),
    fn("crd_alert", "警告カード", "alert card"),
    fn("crd_expand", "展開カード", "expandable card with details"),
  ]),
  genre("modal", "core", 6, "モーダル・ダイアログ", "MODAL / DIALOG", { generator: "modal", component_type: "component", layouts: ["centered"] }, [
    fn("mdl_confirm", "確認", "confirmation modal"),
    fn("mdl_warning", "警告", "warning modal"),
    fn("mdl_success", "成功", "success modal"),
    fn("mdl_login", "ログインモーダル", "login modal"),
    fn("mdl_signup", "登録モーダル", "signup modal"),
    fn("mdl_share", "シェア", "share modal, no third-party"),
    fn("mdl_settings", "設定モーダル", "settings modal"),
    fn("mdl_detail", "詳細モーダル", "detail modal"),
  ]),
  genre("sidebar", "core", 5, "サイドバー", "SIDEBAR", { generator: "dashboard", layouts: ["sidebar"] }, [
    fn("sb_app", "アプリサイドバー", "app sidebar nav", { use_cases: UC_APP }),
    fn("sb_admin", "管理サイドバー", "admin sidebar"),
    fn("sb_compact", "コンパクトサイドバー", "compact icon sidebar"),
    fn("sb_nested", "入れ子ナビ", "nested navigation"),
    fn("sb_filter", "フィルタサイドバー", "filter sidebar"),
    fn("sb_account", "アカウントサイドバー", "account sidebar"),
  ]),
  genre("tabs", "core", 5, "タブ・アコーディオン", "TABS / ACCORDION", { generator: "tabs", component_type: "component" }, [
    fn("tab_tabs", "タブ", "tabs with three panels"),
    fn("tab_segment", "セグメント", "segmented control"),
    fn("tab_accordion", "アコーディオン部品", "accordion component"),
    fn("tab_category", "カテゴリタブ", "category tabs"),
    fn("tab_settings", "設定タブ", "settings tabs"),
    fn("tab_responsive", "レスポンシブタブ", "tabs that become select-like stacked items on mobile"),
  ]),
  genre("search", "core", 10, "検索・フィルター", "SEARCH / FILTER", { generator: "section", component_type: "component", p0_shortage: true }, [
    fn("srch_bar", "検索バー", "search bar with button"),
    fn("srch_advanced", "詳細検索", "advanced search fields"),
    fn("srch_chips", "フィルタチップ", "filter chips"),
    fn("srch_panel", "フィルタパネル", "filter panel"),
    fn("srch_category", "カテゴリフィルタ", "category filter"),
    fn("srch_sort", "ソート", "sort controls"),
  ]),
  genre("alert", "core", 5, "通知・アラート", "NOTIFICATION / ALERT", { generator: "section", component_type: "component", layouts: LAY_PART }, [
    fn("alrt_toast", "トースト", "toast notice"),
    fn("alrt_banner", "アラートバナー", "alert banner"),
    fn("alrt_success", "成功通知", "success notice"),
    fn("alrt_error", "エラー通知", "error notice"),
    fn("alrt_center", "通知センター", "notification center list"),
    fn("alrt_inbox", "受信通知", "inbox notice row"),
  ]),
  genre("emptystate", "core", 5, "状態画面", "EMPTY / ERROR / STATE", { generator: "section" }, [
    fn("emp_empty", "空状態", "empty state with CTA"),
    fn("emp_noresults", "該当なし", "no results state"),
    fn("emp_loading", "読み込み", "loading skeleton"),
    fn("emp_error", "エラー画面", "error state"),
    fn("emp_maintenance", "メンテナンス", "maintenance state"),
    fn("emp_offline", "オフライン", "offline state"),
    fn("emp_success", "完了", "success state"),
    fn("emp_denied", "権限なし", "permission denied"),
  ]),
  genre("button", "supporting", 12, "ボタン", "BUTTON", { generator: "button", component_type: "component", allowed_components: ["component"], layouts: LAY_PART, styles: STY_PART, p0_shortage: true }, [
    fn("btn_primary", "プライマリ", "a primary button set with hover/focus styles"),
    fn("btn_secondary", "セカンダリ", "secondary buttons"),
    fn("btn_ghost", "ゴースト", "ghost buttons"),
    fn("btn_icon", "アイコンボタン", "icon buttons with SVG, 44px tap target"),
    fn("btn_cta", "CTAボタン", "large CTA button"),
    fn("btn_pill", "ピルボタン", "pill buttons"),
    fn("btn_danger", "危険", "danger button"),
    fn("btn_social", "ソーシャルボタン", "social login-looking buttons, no OAuth"),
  ]),
  genre("badge", "supporting", 6, "バッジ・ラベル", "BADGE / LABEL / TAG", { generator: "section", component_type: "component", layouts: LAY_PART }, [
    fn("bdg_badge", "バッジ", "status badges row"),
    fn("bdg_status", "ステータス", "status labels"),
    fn("bdg_sale", "セールラベル", "sale label"),
    fn("bdg_tag", "カテゴリタグ", "category tags"),
    fn("bdg_new", "NEW", "NEW badge"),
    fn("bdg_pro", "PRO", "PRO badge"),
    fn("bdg_verified", "認証", "verified badge"),
    fn("bdg_count", "通知数", "notification count badge"),
  ]),
  genre("banner", "supporting", 11, "バナー", "BANNER", { generator: "banner", component_type: "decoration", allowed_components: ["decoration", "section"], p0_shortage: true }, [
    fn("bnr_announce", "お知らせバナー", "announcement bar"),
    fn("bnr_campaign", "キャンペーン", "campaign banner"),
    fn("bnr_sale", "セール帯", "sale strip"),
    fn("bnr_maintenance", "メンテ告知", "maintenance banner"),
    fn("bnr_cookie", "Cookie告知", "cookie notice bar, UI only"),
    fn("bnr_app", "アプリ誘導", "app install banner"),
    fn("bnr_promo", "プロモ", "promo banner"),
    fn("bnr_info", "情報バナー", "information banner"),
  ]),
  genre("pagination", "supporting", 5, "ナビ補助", "BREADCRUMB / PAGINATION", { generator: "section", component_type: "component", layouts: LAY_PART }, [
    fn("pag_crumb", "パンくず", "breadcrumb"),
    fn("pag_pages", "ページネーション", "pagination"),
    fn("pag_steps", "ステップ", "step indicator"),
    fn("pag_progress", "進捗ステップ", "progress steps"),
    fn("pag_back", "戻るナビ", "back navigation"),
  ]),
  genre("divider", "supporting", 7, "区切り・装飾", "DIVIDER / DECORATION", { generator: "divider", component_type: "decoration", allowed_components: ["decoration"], layouts: ["full_width"], p0_shortage: true }, [
    fn("div_line", "区切り線", "a simple section divider"),
    fn("div_wave", "ウェーブ", "a CSS wave separator"),
    fn("div_angle", "斜め区切り", "an angled separator"),
    fn("div_gradient", "グラデ区切り", "a gradient separator"),
    fn("div_section", "セクション装飾", "section decoration"),
    fn("div_corner", "角装飾", "corner decoration"),
    fn("div_accent", "背景アクセント", "background accent band"),
  ]),
  genre("frame", "supporting", 4, "フレーム・囲み", "FRAME / CONTAINER", { generator: "section", component_type: "decoration" }, [
    fn("frmc_info", "情報ボックス", "info box"),
    fn("frmc_quote", "引用ボックス", "quote box"),
    fn("frmc_highlight", "ハイライト", "highlight box"),
    fn("frmc_border", "枠コンテナ", "bordered container"),
    fn("frmc_feature", "機能フレーム", "feature frame"),
    fn("frmc_content", "コンテンツ枠", "content frame"),
  ]),
  genre("speech", "supporting", 4, "吹き出し・注釈", "SPEECH / CALLOUT", { generator: "section", component_type: "component", layouts: LAY_PART }, [
    fn("spch_bubble", "吹き出し", "speech bubble"),
    fn("spch_tooltip", "ツールチップ", "tooltip"),
    fn("spch_note", "注釈", "annotation"),
    fn("spch_callout", "コールアウト", "callout"),
    fn("spch_hint", "ヒント", "hint box"),
    fn("spch_comment", "コメント枠", "comment box"),
  ]),
  genre("chart", "supporting", 4, "グラフ・チャート", "CHART / VISUALIZATION", { generator: "section", component_type: "decoration" }, [
    fn("cht_bar", "棒グラフ", "CSS bar chart, no chart library"),
    fn("cht_line", "折れ線", "simple CSS line chart decoration"),
    fn("cht_donut", "ドーナツ", "CSS donut"),
    fn("cht_pie", "円グラフ", "CSS pie decoration"),
    fn("cht_progress", "進捗", "progress bars"),
    fn("cht_kpi", "KPIチャート", "KPI + mini bars"),
    fn("cht_compare", "比較チャート", "comparison bars"),
    fn("cht_dash", "簡易ダッシュチャート", "simple dashboard chart widgets"),
  ]),
  genre("corporate", "supporting", 4, "企業サイト", "CORPORATE", { generator: "feature", styles: STY_CORP, component_type: "section", allowed_components: ["section"] }, [
    fn("corp_home", "企業トップ帯", "company homepage section, not a full site"),
    fn("corp_service", "サービス企業", "service company intro"),
    fn("corp_b2b", "B2B", "B2B section"),
    fn("corp_consult", "コンサル", "consulting section"),
    fn("corp_pro", "士業", "professional service section"),
  ]),
  genre("saas", "supporting", 4, "SaaS・ソフトウェア", "SaaS / SOFTWARE", { generator: "feature", styles: STY_SAAS }, [
    fn("saas_land", "SaaSランディング帯", "SaaS landing section, not a full page", { use_cases: UC_APP }),
    fn("saas_ai", "AIサービス", "AI service section"),
    fn("saas_dev", "開発者向け", "developer service"),
    fn("saas_auto", "自動化", "automation product section"),
    fn("saas_cloud", "クラウド", "cloud software section"),
  ]),
  genre("ecommerce", "supporting", 4, "EC・小売", "EC / RETAIL", { generator: "productgrid", styles: STY_EC }, [
    fn("ecom_land", "ECランディング帯", "ecommerce landing section", { use_cases: UC_EC }),
    fn("ecom_fashion", "ファッション", "fashion retail section"),
    fn("ecom_food", "食品EC", "food shop section"),
    fn("ecom_cosme", "コスメ", "cosmetics shop"),
    fn("ecom_elec", "家電", "electronics shop"),
  ]),
  genre("recruitment", "supporting", 4, "採用", "RECRUITMENT", { generator: "feature" }, [
    fn("rec_top", "採用トップ", "recruitment top section", { use_cases: ["recruitment", "corporate"] }),
    fn("rec_job", "仕事紹介", "job intro"),
    fn("rec_voices", "社員の声", "employee voice quotes, no photos"),
    fn("rec_culture", "カルチャー", "culture section"),
    fn("rec_benefits", "福利厚生", "benefits"),
    fn("rec_apply", "応募CTA", "application CTA"),
  ]),
  genre("restaurant", "supporting", 3, "飲食", "RESTAURANT / FOOD", { generator: "feature" }, [
    fn("rest_shop", "レストラン", "restaurant intro"),
    fn("rest_cafe", "カフェ", "cafe intro"),
    fn("rest_menu", "メニュー", "menu list"),
    fn("rest_reserve", "予約", "reservation CTA, no payment"),
    fn("rest_delivery", "デリバリー", "food delivery section"),
    fn("rest_info", "店舗情報", "shop info"),
  ]),
  genre("beauty", "supporting", 3, "美容・サロン", "BEAUTY / SALON", { generator: "feature" }, [
    fn("bty_salon", "サロン", "salon intro"),
    fn("bty_beauty", "美容", "beauty service"),
    fn("bty_cosme", "化粧品", "cosmetics"),
    fn("bty_reserve", "美容予約", "reservation"),
    fn("bty_staff", "スタッフ", "staff cards, no faces"),
    fn("bty_menu", "メニュー料金", "menu/pricing"),
  ]),
  genre("medical", "supporting", 3, "医療・健康", "MEDICAL / HEALTHCARE", { generator: "feature", styles: STY_CORP }, [
    fn("med_clinic", "クリニック", "clinic intro"),
    fn("med_hospital", "病院", "hospital intro"),
    fn("med_dental", "歯科", "dental"),
    fn("med_wellness", "ウェルネス", "wellness"),
    fn("med_info", "診療案内", "service information"),
    fn("med_contact", "診療予約", "reservation/contact"),
  ]),
  genre("education", "supporting", 3, "教育", "EDUCATION", { generator: "feature" }, [
    fn("edu_school", "学校", "school intro"),
    fn("edu_course", "コース", "course cards"),
    fn("edu_online", "オンライン教育", "online education"),
    fn("edu_tutor", "塾", "tutoring"),
    fn("edu_lesson", "レッスン", "lesson"),
    fn("edu_seminar", "セミナー", "seminar"),
  ]),
  genre("realestate", "supporting", 3, "不動産・建築", "REAL ESTATE / CONSTRUCTION", { generator: "feature" }, [
    fn("re_property", "物件", "property cards"),
    fn("re_construction", "施工", "construction"),
    fn("re_renovation", "リフォーム", "renovation"),
    fn("re_housing", "住宅", "housing"),
    fn("re_works", "施工事例", "works"),
    fn("re_inquiry", "物件問い合わせ", "inquiry"),
  ]),
  genre("creator", "supporting", 3, "クリエイター", "CREATOR / PORTFOLIO", { generator: "feature" }, [
    fn("crea_designer", "デザイナー", "designer portfolio section"),
    fn("crea_photo", "写真家", "photographer"),
    fn("crea_music", "音楽家", "musician"),
    fn("crea_video", "映像", "video creator"),
    fn("crea_artist", "アーティスト", "artist"),
    fn("crea_personal", "個人ポートフォリオ", "personal portfolio"),
  ]),
  genre("eventlp", "supporting", 3, "イベント・LP", "EVENT / LP", { generator: "cta" }, [
    fn("evt_seminar", "セミナーLP帯", "seminar section, not a full landing clone"),
    fn("evt_conference", "カンファレンス", "conference"),
    fn("evt_webinar", "ウェビナー", "webinar"),
    fn("evt_campaign", "キャンペーンLP帯", "campaign section"),
    fn("evt_launch", "ローンチ", "launch"),
    fn("evt_register", "イベント登録", "event registration form, no payment"),
  ]),
]);

export const WEB_DEMAND_GENRES = Object.freeze(foldWebDemandGenres(WEB_DEMAND_GENRES_SOURCE));

export const WEB_CORE_GENRE_COUNT = WEB_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const WEB_SUPPORTING_GENRE_COUNT = WEB_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;
export const WEB_QA_CORE_GENRES = Object.freeze([
  "header",
  "cta",
  "pricing",
  "faq",
  "dashboard",
  "form",
  "login",
  "card",
  "search",
  "testimonial",
]);

const GENRE_BY_ID = new Map(WEB_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const g of WEB_DEMAND_GENRES) {
  for (const sg of g.subgenres) {
    SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
    for (const scene of sg.scenes) SCENE_BY_ID.set(scene.id, { genre: g, subgenre: sg, scene });
  }
}

export function listWebSubgenres() {
  return WEB_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getWebGenre(id) {
  const canonical = resolveGenreAlias("web", id);
  return GENRE_BY_ID.get(String(canonical || "")) || null;
}
export function getWebSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getWebScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateWebGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const g of WEB_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    if (typeof g.demand_weight !== "number") issues.push(`weight:${g.id}`);
    for (const st of g.allowed_styles) if (!WEB_STYLES[st]) issues.push(`style:${g.id}:${st}`);
    for (const ly of g.allowed_layouts) if (!WEB_LAYOUT_TYPES[ly]) issues.push(`layout:${g.id}:${ly}`);
    for (const ct of g.allowed_components) if (!WEB_COMPONENT_TYPES[ct]) issues.push(`comp:${g.id}:${ct}`);
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id)) issues.push(`dup_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) if (!WEB_USE_CASES[uc]) issues.push(`use:${sg.id}:${uc}`);
      for (const scene of sg.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`dup_scene:${scene.id}`);
        sceneIds.add(scene.id);
      }
    }
  }
  if (WEB_DEMAND_GENRES.length !== 45) issues.push(`genre_count:${WEB_DEMAND_GENRES.length}`);
  for (const id of WEB_QA_CORE_GENRES) if (!GENRE_BY_ID.has(id)) issues.push(`qa_missing:${id}`);
  return {
    ok: issues.length === 0,
    issues,
    core: WEB_CORE_GENRE_COUNT,
    supporting: WEB_SUPPORTING_GENRE_COUNT,
    genres: WEB_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

export function webSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.subcategory,
    spec?.scene,
    spec?.component_type,
    spec?.layout_type,
    spec?.style,
    spec?.density,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function buildWebJapaneseTitle(spec) {
  const found = getWebScene(spec.scene) || getWebSubgenre(spec.subcategory);
  const label = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "Web素材";
  const styleJa = WEB_STYLES[spec.style]?.label_ja;
  const layoutJa = WEB_LAYOUT_TYPES[spec.layout_type]?.label_ja;
  const bits = [styleJa, layoutJa].filter(Boolean);
  const title = bits.length ? `${label}（${bits.join("・")}）` : `${label}`;
  return title.slice(0, 32);
}

export function buildWebDescription(spec) {
  const g = getWebGenre(spec.genre);
  return [getWebScene(spec.scene)?.scene?.label_ja, g?.label_ja, spec.component_type, spec.use_case]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildWebPromptText(spec) {
  const found = getWebScene(spec.scene);
  const part = found?.scene?.prompt_en || "a reusable website section";
  const layout = String(spec.layout_type || "centered").replace(/_/g, " ");
  const density = spec.density || "normal";
  const theme = spec.theme || "light";
  const responsive =
    spec.responsive_mode === "desktop_first"
      ? "desktop-first but must stack on 390px without horizontal overflow"
      : spec.responsive_mode === "mobile_first"
        ? "mobile-first, enhance at 720px+"
        : "responsive: desktop layout, mobile stacking, wrap buttons, collapse grids, contain images";
  const tokens = [
    "TASFUL_WEB_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `comp=${spec.component_type || ""}`,
    `layout=${spec.layout_type || ""}`,
    `style=${spec.style || ""}`,
    `theme=${theme}`,
    `density=${density}`,
    `rs=${spec.responsive_mode || "responsive"}`,
  ].join(" ");
  return [
    tokens,
    "::",
    spec.title || buildWebJapaneseTitle(spec),
    `Vanilla HTML/CSS website ${spec.component_type || "section"}: ${part}`,
    `${spec.style} style, ${theme} theme, ${layout} layout, ${density} density`,
    responsive,
    "semantic HTML, viewport meta, no CDN, no frameworks, no stock photos of people, Japanese placeholder copy",
    "no broken asset refs, no eval, no third-party scripts, reusable Web part not a full multi-page site",
  ].join(" ");
}

export function drivePathForWebSpec(spec) {
  const folder = webDriveFolderName(spec.genre);
  return `Web素材/${folder}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForWebSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    String(spec.scene || "").replace(/_/g, "-"),
    spec.use_case,
    WEB_COMPONENT_TYPES[spec.component_type]?.slug || "ctsect",
    WEB_LAYOUT_TYPES[spec.layout_type]?.slug || "lycenter",
    WEB_STYLES[spec.style]?.slug || "stmin",
    WEB_THEMES[spec.theme]?.slug || "thlight",
    WEB_RESPONSIVE_MODES[spec.responsive_mode]?.slug || "rsresp",
    WEB_DENSITIES[spec.density]?.slug || "dnnormal",
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

const COMP_BY_SLUG = new Map(Object.values(WEB_COMPONENT_TYPES).map((x) => [x.slug, x.id]));
const LAY_BY_SLUG = new Map(Object.values(WEB_LAYOUT_TYPES).map((x) => [x.slug, x.id]));
const ST_BY_SLUG = new Map(Object.values(WEB_STYLES).map((x) => [x.slug, x.id]));
const TH_BY_SLUG = new Map(Object.values(WEB_THEMES).map((x) => [x.slug, x.id]));
const RS_BY_SLUG = new Map(Object.values(WEB_RESPONSIVE_MODES).map((x) => [x.slug, x.id]));
const DN_BY_SLUG = new Map(Object.values(WEB_DENSITIES).map((x) => [x.slug, x.id]));

export function parseWebSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const densitySlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_DENSITIES).map((x) => x.slug)));
  const rsSlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_RESPONSIVE_MODES).map((x) => x.slug)));
  const thSlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_THEMES).map((x) => x.slug)));
  const stSlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_STYLES).map((x) => x.slug)));
  const lySlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_LAYOUT_TYPES).map((x) => x.slug)));
  const ctSlug = takeKnownFromRight(tokens, new Set(Object.values(WEB_COMPONENT_TYPES).map((x) => x.slug)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(WEB_USE_CASES)));
  const genre = getWebGenre(tokens[0])?.id || tokens[0] || "";
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
    component_type: COMP_BY_SLUG.get(ctSlug) || "",
    layout_type: LAY_BY_SLUG.get(lySlug) || "",
    style: ST_BY_SLUG.get(stSlug) || "",
    theme: TH_BY_SLUG.get(thSlug) || "",
    responsive_mode: RS_BY_SLUG.get(rsSlug) || "",
    density: DN_BY_SLUG.get(densitySlug) || "",
  };
}

function finalizeWebSpec(raw, fallbackTitle = "") {
  const spec = { ...raw };
  spec.title = fallbackTitle || spec.title || buildWebJapaneseTitle(spec);
  spec.prompt = spec.prompt || buildWebPromptText(spec);
  spec.description = spec.description || buildWebDescription(spec);
  return spec;
}

export function parseWebSpecFromPrompt(text) {
  const raw = String(text || "");
  if (!raw.includes("TASFUL_WEB_SPEC")) return null;
  const grab = (key) => {
    const m = raw.match(new RegExp(`${key}=([a-z0-9_]+)`));
    return m ? m[1] : "";
  };
  const genreRaw = grab("genre");
  const subcategory = grab("sub");
  const scene = grab("scene");
  const component_type = grab("comp");
  const layout_type = grab("layout");
  const style = grab("style");
  const genreObj = getWebGenre(genreRaw);
  if (!genreRaw || !subcategory || !component_type || !layout_type || !style) return null;
  if (!genreObj || !WEB_COMPONENT_TYPES[component_type] || !WEB_LAYOUT_TYPES[layout_type] || !WEB_STYLES[style]) {
    return null;
  }
  return finalizeWebSpec({
    genre: genreObj.id,
    subcategory,
    scene,
    use_case: grab("use"),
    component_type,
    layout_type,
    style,
    theme: grab("theme") || "light",
    responsive_mode: grab("rs") || "responsive",
    density: grab("density") || "normal",
  });
}

export function parseWebSpecFromPath({ slug = "", metadata = {}, promptText = "" } = {}) {
  const fromPrompt = parseWebSpecFromPrompt(promptText || metadata?.prompt || "");
  if (fromPrompt) return fromPrompt;
  if (metadata?.genre && metadata?.subcategory && metadata?.scene && metadata?.component_type && metadata?.layout_type && metadata?.style) {
    const genreObj = getWebGenre(metadata.genre);
    return finalizeWebSpec(
      {
        genre: genreObj?.id || resolveGenreAlias("web", metadata.genre) || String(metadata.genre),
        subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
        scene: String(metadata.scene).replace(/-/g, "_"),
        use_case: String(metadata.use_case || ""),
        component_type: String(metadata.component_type),
        layout_type: String(metadata.layout_type || metadata.layout || ""),
        style: String(metadata.style),
        theme: String(metadata.theme || ""),
        responsive_mode: String(metadata.responsive_mode || ""),
        density: String(metadata.density || metadata.complexity || ""),
        title: metadata.title || "",
      },
      metadata.title || "",
    );
  }
  const fromSlug = parseWebSlugParts(slug);
  const genre = getWebGenre(fromSlug.genre);
  const found = getWebSubgenre(fromSlug.subcategory);
  const sceneFound = getWebScene(fromSlug.scene);
  const complete =
    Boolean(genre) &&
    Boolean(found) &&
    Boolean(sceneFound) &&
    Boolean(fromSlug.use_case) &&
    Boolean(fromSlug.component_type) &&
    Boolean(fromSlug.layout_type) &&
    Boolean(fromSlug.style) &&
    Boolean(fromSlug.theme) &&
    Boolean(fromSlug.responsive_mode) &&
    Boolean(fromSlug.density);
  if (!complete) return null;
  return finalizeWebSpec({
    genre: genre.id,
    subcategory: found.subgenre.id,
    scene: sceneFound.scene.id,
    use_case: fromSlug.use_case,
    component_type: fromSlug.component_type,
    layout_type: fromSlug.layout_type,
    style: fromSlug.style,
    theme: fromSlug.theme,
    responsive_mode: fromSlug.responsive_mode,
    density: fromSlug.density,
  });
}

export function webSpecToMetadata(spec) {
  const industry = ["corporate", "saas", "ecommerce", "recruitment", "restaurant", "beauty", "medical", "education", "realestate", "creator", "eventlp"].includes(
    spec.genre,
  )
    ? spec.genre
    : "";
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    scene: spec.scene || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    layout: spec.layout_type || "",
    component_type: spec.component_type || "",
    layout_type: spec.layout_type || "",
    responsive_mode: spec.responsive_mode || "",
    theme: spec.theme || "",
    density: spec.density || "",
    complexity: spec.density || "",
    industry,
    category: spec.genre || "",
    feature: spec.component_type || "",
    language: "ja",
  };
}

export function classifyLegacyWebItem(item) {
  const hay = [item.subcategory, ...(item.tags || [])].map((x) => String(x || "")).join("|").toLowerCase();
  const hits = new Set();
  for (const row of WEB_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy)) row.genre_ids.forEach((g) => hits.add(g));
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
