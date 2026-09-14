/**
 * Illustration Demand Genre SSOT V1 — Web / ads / SNS / docs / shops / teaching.
 * Does not copy Image photo taxonomy. Does not generate human portraits
 * (existing illustration-human-exclude). Character genre = role props only.
 */
export const ILLUSTRATION_DEMAND_GENRE_SSOT_VERSION = "materials-illustration-demand-genre-ssot-v1";

export const ILLUSTRATION_STYLES = Object.freeze({
  flat: { id: "flat", label_ja: "フラット" },
  simple: { id: "simple", label_ja: "シンプル" },
  line: { id: "line", label_ja: "ライン" },
  cute: { id: "cute", label_ja: "かわいい" },
  pop: { id: "pop", label_ja: "ポップ" },
  minimal: { id: "minimal", label_ja: "ミニマル" },
  corporate: { id: "corporate", label_ja: "コーポレート" },
  soft: { id: "soft", label_ja: "ソフト" },
  colorful: { id: "colorful", label_ja: "カラフル" },
  isometric: { id: "isometric", label_ja: "アイソメ" },
  handdrawn: { id: "handdrawn", label_ja: "手描き" },
  monochrome: { id: "monochrome", label_ja: "モノクロ" },
});

export const ILLUSTRATION_ASSET_FORMS = Object.freeze(["object", "set", "scene", "isolated", "copyspace"]);
export const ILLUSTRATION_BACKGROUNDS = Object.freeze(["whiteiso", "scenebg", "copyspacebg"]);
export const ILLUSTRATION_USE_CASES = Object.freeze({
  web: { id: "web", label_ja: "Web" },
  blog: { id: "blog", label_ja: "ブログ" },
  sns: { id: "sns", label_ja: "SNS" },
  advertising: { id: "advertising", label_ja: "広告" },
  document: { id: "document", label_ja: "資料" },
  ecommerce: { id: "ecommerce", label_ja: "EC" },
  campaign: { id: "campaign", label_ja: "キャンペーン" },
  editorial: { id: "editorial", label_ja: "記事" },
});

/** Audit-only. Never auto-FILL inventory. Unique hits only. */
export const ILLUSTRATION_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "動物", genre_ids: ["animal"] },
  { legacy: "野菜", genre_ids: ["food"] },
  { legacy: "果物", genre_ids: ["food"] },
  { legacy: "肉", genre_ids: ["food"] },
  { legacy: "魚料理", genre_ids: ["food"] },
  { legacy: "スイーツ", genre_ids: ["food"] },
  { legacy: "パン", genre_ids: ["food"] },
  { legacy: "カフェ", genre_ids: ["food"] },
  { legacy: "ドリンク", genre_ids: ["food"] },
  { legacy: "お弁当", genre_ids: ["food"] },
  { legacy: "寿司", genre_ids: ["food"] },
  { legacy: "ラーメン", genre_ids: ["food"] },
  { legacy: "焼肉", genre_ids: ["food"] },
  { legacy: "食べ物", genre_ids: ["food"] },
  { legacy: "住宅", genre_ids: ["housing"] },
  { legacy: "マンション", genre_ids: ["housing"] },
  { legacy: "ビル", genre_ids: ["housing"] },
  { legacy: "大工", genre_ids: ["housing"] },
  { legacy: "配管工事", genre_ids: ["housing"] },
  { legacy: "足場", genre_ids: ["housing"] },
  { legacy: "解体", genre_ids: ["housing"] },
  { legacy: "塗装", genre_ids: ["housing"] },
  { legacy: "測量", genre_ids: ["housing"] },
  { legacy: "設計図", genre_ids: ["housing"] },
  { legacy: "会議", genre_ids: ["business"] },
  { legacy: "プレゼン", genre_ids: ["business"] },
  { legacy: "営業", genre_ids: ["business"] },
  { legacy: "経営", genre_ids: ["business"] },
  { legacy: "スタートアップ", genre_ids: ["business"] },
  { legacy: "契約", genre_ids: ["legal"] },
  { legacy: "マーケティング", genre_ids: ["marketing"] },
  { legacy: "求人", genre_ids: ["recruitment"] },
  { legacy: "採用", genre_ids: ["recruitment"] },
  { legacy: "面接", genre_ids: ["recruitment"] },
  { legacy: "チームワーク", genre_ids: ["business"] },
  { legacy: "テクノロジー", genre_ids: ["technology"] },
  { legacy: "乗り物", genre_ids: ["transport"] },
  { legacy: "家電", genre_ids: ["technology"] },
  { legacy: "自然", genre_ids: ["nature"] },
  { legacy: "ハロウィン", genre_ids: ["seasonal"] },
  { legacy: "和風", genre_ids: ["seasonal"] },
]);

function sc(id, labelJa, promptEn) {
  return Object.freeze({ id, path_id: id.replace(/_/g, "-"), label_ja: labelJa, prompt_en: promptEn });
}

function sub(id, labelJa, extra = {}) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: labelJa,
    use_cases: Object.freeze(extra.use_cases || ["web", "blog"]),
    scenes: Object.freeze(
      extra.scenes || [sc(`${id}_scene`, labelJa, extra.prompt_en || `a simple illustration of ${labelJa}`)],
    ),
    allowed_styles: extra.allowed_styles ? Object.freeze(extra.allowed_styles) : null,
  });
}

function genre(id, tier, weight, ja, en, styles, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    allowed_styles: Object.freeze(styles),
    subgenres: Object.freeze(subs),
  });
}

const CORP = ["corporate", "flat", "minimal", "simple"];
const CUTE = ["cute", "pop", "soft", "colorful", "flat"];
const DOC = ["flat", "line", "simple", "corporate"];
const FOOD = ["flat", "cute", "colorful", "soft"];
const TECH = ["flat", "isometric", "minimal", "corporate"];

export const ILLUSTRATION_DEMAND_GENRES = Object.freeze([
  genre("business", "core", 12, "ビジネス・仕事", "BUSINESS / WORK", CORP, [
    sub("biz_meeting", "会議", { use_cases: ["web", "document"], scenes: [sc("conf_table", "会議テーブル", "an empty conference table with laptops and notepads, no people")] }),
    sub("biz_desk", "PC作業", { use_cases: ["web", "blog"], scenes: [sc("office_desk", "デスク", "a tidy office desk with a laptop and coffee mug, no people")] }),
    sub("biz_office", "オフィス", { use_cases: ["web", "advertising"], scenes: [sc("office_interior", "オフィス", "a simple office interior with desks and a plant, no people")] }),
    sub("biz_sales", "営業", { use_cases: ["web", "document"], scenes: [sc("sales_kit", "営業資料", "a sales folder, business cards and a tablet on a table, no people")] }),
    sub("biz_present", "プレゼン", { use_cases: ["document", "web"], scenes: [sc("present_board", "プレゼン", "a presentation screen and pointer on a stage, no people")] }),
    sub("biz_team", "チームワーク", { use_cases: ["web", "campaign"], scenes: [sc("team_board", "チームボード", "a whiteboard with sticky notes and markers, no people")] }),
    sub("biz_remote", "リモートワーク", { use_cases: ["blog", "sns"], scenes: [sc("home_desk", "在宅デスク", "a home-office desk with laptop and headset, no people")] }),
    sub("biz_tasks", "タスク管理", { use_cases: ["web", "blog"], scenes: [sc("kanban", "タスクボード", "a kanban board with colored cards, no people")] }),
    sub("biz_growth", "成長", { use_cases: ["web", "document"], scenes: [sc("growth_chart", "成長グラフ", "an upward growth chart illustration, no people")] }),
    sub("biz_goal", "目標達成", { use_cases: ["web", "campaign"], scenes: [sc("target_flag", "目標", "a target and flag illustration, no people")] }),
    sub("biz_solve", "課題解決", { use_cases: ["web", "document"], scenes: [sc("puzzle_fit", "課題解決", "puzzle pieces fitting together, no people")] }),
    sub("biz_manage", "経営", { use_cases: ["document", "web"], scenes: [sc("org_chart", "経営", "a simple organization chart, no people")] }),
    sub("biz_startup", "起業", { use_cases: ["web", "blog"], scenes: [sc("startup_desk", "起業", "a startup desk with a notebook and lightbulb icon, no people")] }),
    sub("biz_support", "カスタマーサポート", { use_cases: ["web", "document"], scenes: [sc("headset_desk", "サポート", "a headset and helpdesk computer, no people")] }),
  ]),
  genre("lifestyle", "core", 11, "人物・ライフスタイル", "PEOPLE / LIFESTYLE", CUTE, [
    sub("life_daily", "日常", { use_cases: ["web", "sns"], scenes: [sc("daily_still", "日常小物", "everyday home still life with a mug and keys, no people")] }),
    sub("life_talk", "会話", { use_cases: ["web", "sns"], scenes: [sc("talk_cups", "会話", "two coffee cups facing each other on a cafe table, no people")] }),
    sub("life_phone", "スマートフォン", { use_cases: ["sns", "advertising"], scenes: [sc("phone_still", "スマホ", "a smartphone on a table showing a generic blank screen, no people")] }),
    sub("life_hobby", "趣味", { use_cases: ["blog", "sns"], scenes: [sc("hobby_kit", "趣味", "hobby tools and a sketchbook on a desk, no people")] }),
    sub("life_relax", "リラックス", { use_cases: ["web", "sns"], scenes: [sc("relax_sofa", "リラックス", "a sofa, blanket and tea cup, no people")] }),
    sub("life_joy", "喜び", { use_cases: ["sns", "campaign"], scenes: [sc("joy_confetti", "喜び", "confetti and a smiling star symbol, no people")] }),
    sub("life_worry", "悩み", { use_cases: ["web", "blog"], scenes: [sc("worry_cloud", "悩み", "a thought cloud over a notebook, no people")] }),
    sub("life_think", "考える", { use_cases: ["web", "editorial"], scenes: [sc("think_lamp", "考える", "a desk lamp and question-mark doodle, no people")] }),
    sub("life_sleep", "睡眠", { use_cases: ["web", "blog"], scenes: [sc("sleep_bed", "睡眠", "a tidy bed and moon icon, no people")] }),
    sub("life_shop", "買い物", { use_cases: ["advertising", "sns"], scenes: [sc("shop_bag", "買い物", "shopping bags on a floor, no people")] }),
    sub("life_home", "生活シーン", { use_cases: ["web", "blog"], scenes: [sc("home_corner", "生活", "a living-room corner with a plant and lamp, no people")] }),
  ]),
  genre("technology", "core", 11, "IT・AI・デジタル", "TECHNOLOGY / AI / DIGITAL", TECH, [
    sub("tech_ai", "AI", { use_cases: ["web", "document"], scenes: [sc("ai_chip", "AI", "an AI chip and circuit illustration, no people, no hologram faces")] }),
    sub("tech_robot", "ロボット", { use_cases: ["web", "blog"], scenes: [sc("bot_arm", "ロボット", "a simple industrial robot arm, no humanoid face, no people")] }),
    sub("tech_code", "プログラミング", { use_cases: ["web", "blog"], scenes: [sc("code_screen", "コード", "a laptop showing generic code blocks, no readable secrets, no people")] }),
    sub("tech_cloud", "クラウド", { use_cases: ["web", "document"], scenes: [sc("cloud_icon", "クラウド", "a cloud computing symbol with servers, no people")] }),
    sub("tech_data", "データ", { use_cases: ["document", "web"], scenes: [sc("data_bars", "データ", "simple data bars and a pie chart, no people")] }),
    sub("tech_server", "サーバー", { use_cases: ["web", "document"], scenes: [sc("server_rack", "サーバー", "a server rack illustration, no people")] }),
    sub("tech_cyber", "サイバーセキュリティ", { use_cases: ["web", "document"], scenes: [sc("lock_shield", "セキュリティ", "a padlock and shield, no people")] }),
    sub("tech_mobile", "スマートフォン", { use_cases: ["sns", "web"], scenes: [sc("app_phone", "スマホ", "a smartphone with a generic app grid, no people")] }),
    sub("tech_web", "Web", { use_cases: ["web", "advertising"], scenes: [sc("browser_win", "Web", "a simple browser window illustration, no people")] }),
    sub("tech_app", "アプリ", { use_cases: ["web", "sns"], scenes: [sc("app_tiles", "アプリ", "app tiles on a phone screen, no logos, no people")] }),
    sub("tech_auto", "自動化", { use_cases: ["web", "document"], scenes: [sc("gear_flow", "自動化", "gears connected in a workflow, no people")] }),
    sub("tech_net", "ネットワーク", { use_cases: ["web", "document"], scenes: [sc("net_nodes", "ネットワーク", "network nodes connected by lines, no people")] }),
  ]),
  genre("finance", "core", 10, "金融・お金", "FINANCE / MONEY", CORP, [
    sub("fin_save", "貯金", { use_cases: ["web", "advertising"], scenes: [sc("coin_jar", "貯金", "a coin jar and piggy bank, no people")] }),
    sub("fin_invest", "投資", { use_cases: ["web", "document"], scenes: [sc("invest_chart", "投資", "an investment line chart, no people")] }),
    sub("fin_budget", "家計", { use_cases: ["blog", "web"], scenes: [sc("budget_book", "家計", "a household budget notebook and calculator, no people")] }),
    sub("fin_pay", "決済", { use_cases: ["web", "ecommerce"], scenes: [sc("pay_terminal", "決済", "a payment terminal and generic card, no brand logos, no people")] }),
    sub("fin_card", "クレジットカード", { use_cases: ["advertising", "web"], scenes: [sc("card_still", "カード", "an unbranded credit card, no people")] }),
    sub("fin_bank", "銀行", { use_cases: ["web", "document"], scenes: [sc("bank_build", "銀行", "a simple bank building, no people")] }),
    sub("fin_insure", "保険", { use_cases: ["web", "document"], scenes: [sc("insure_umb", "保険", "an umbrella over a house icon, no people")] }),
    sub("fin_tax", "税金", { use_cases: ["blog", "web"], scenes: [sc("tax_docs", "税金", "tax documents and a calculator, no people")] }),
    sub("fin_account", "会計", { use_cases: ["document", "web"], scenes: [sc("ledger", "会計", "an accounting ledger and coins, no people")] }),
    sub("fin_stock", "株式", { use_cases: ["web", "blog"], scenes: [sc("stock_candles", "株式", "simple candlestick chart, no people")] }),
    sub("fin_asset", "資産形成", { use_cases: ["web", "advertising"], scenes: [sc("asset_steps", "資産形成", "stepping stones labeled as savings, no people")] }),
    sub("fin_tech", "FinTech", { use_cases: ["web", "advertising"], scenes: [sc("fintech_phone", "FinTech", "a phone with a generic finance app, no people")] }),
  ]),
  genre("healthcare", "core", 10, "医療・健康", "HEALTHCARE / MEDICAL", DOC, [
    sub("med_clinic", "病院", { use_cases: ["web", "document"], scenes: [sc("clinic_build", "病院", "a simple clinic building, no people")] }),
    sub("med_exam", "診察", { use_cases: ["web", "blog"], scenes: [sc("exam_desk", "診察", "an exam desk with a stethoscope, no people")] }),
    sub("med_dental", "歯科", { use_cases: ["web", "advertising"], scenes: [sc("dental_chair", "歯科", "a dental chair and tools, no people")] }),
    sub("med_pharma", "薬", { use_cases: ["web", "ecommerce"], scenes: [sc("pill_bottle", "薬", "unlabeled medicine bottles, no people")] }),
    sub("med_check", "健康診断", { use_cases: ["web", "blog"], scenes: [sc("health_chart", "健診", "a health checklist clipboard, no people")] }),
    sub("med_care", "介護用品", { use_cases: ["web", "document"], scenes: [sc("care_items", "介護用品", "a wheelchair and care kit, no people")] }),
    sub("med_mental", "メンタルヘルス", { use_cases: ["web", "blog"], scenes: [sc("calm_plant", "メンタル", "a calm plant and heart symbol, no people")] }),
    sub("med_well", "ウェルネス", { use_cases: ["web", "sns"], scenes: [sc("well_water", "ウェルネス", "a water bottle and yoga mat, no people")] }),
    sub("med_sport", "運動", { use_cases: ["web", "sns"], scenes: [sc("dumbbell", "運動", "dumbbells and a jump rope, no people")] }),
    sub("med_nutrition", "栄養", { use_cases: ["blog", "web"], scenes: [sc("food_plate", "栄養", "a balanced meal plate, no people")] }),
    sub("med_kit", "医師道具", { use_cases: ["web", "document"], scenes: [sc("med_bag", "医療バッグ", "a medical bag and first-aid kit, no people")] }),
    sub("med_nurse_kit", "看護用品", { use_cases: ["web", "document"], scenes: [sc("nurse_tray", "看護トレイ", "a nursing tray with supplies, no people")] }),
  ]),
  genre("education", "core", 10, "教育・学習", "EDUCATION / LEARNING", DOC, [
    sub("edu_study", "勉強", { use_cases: ["web", "sns"], scenes: [sc("study_desk", "勉強", "a study desk with books and a lamp, no people")] }),
    sub("edu_school", "学校", { use_cases: ["web", "document"], scenes: [sc("school_build", "学校", "a school building, no people")] }),
    sub("edu_teach", "教材", { use_cases: ["web", "blog"], scenes: [sc("teach_board", "黒板", "a chalkboard with simple drawings, no people")] }),
    sub("edu_online", "オンライン学習", { use_cases: ["web", "advertising"], scenes: [sc("elearn_laptop", "eラーニング", "a laptop with a play button for a lesson, no people")] }),
    sub("edu_juku", "塾", { use_cases: ["web", "advertising"], scenes: [sc("juku_desk", "塾", "a tutoring desk with workbooks, no people")] }),
    sub("edu_exam", "資格", { use_cases: ["web", "blog"], scenes: [sc("exam_pencil", "資格", "exam pencils and an application form, no people")] }),
    sub("edu_read", "読書", { use_cases: ["blog", "sns"], scenes: [sc("open_book", "読書", "an open book and reading glasses, no people")] }),
    sub("edu_stationery", "文房具", { use_cases: ["ecommerce", "web"], scenes: [sc("pen_set", "文房具", "pens, a ruler and sticky notes, no people")] }),
    sub("edu_grad", "卒業", { use_cases: ["campaign", "sns"], scenes: [sc("grad_cap", "卒業", "a graduation cap and diploma, no people")] }),
    sub("edu_seminar", "研修", { use_cases: ["document", "web"], scenes: [sc("seminar_room", "研修", "an empty training room with chairs, no people")] }),
    sub("edu_elearn", "e-learning", { use_cases: ["web", "advertising"], scenes: [sc("course_tiles", "コース", "e-learning course tiles, no people")] }),
  ]),
  genre("shopping", "core", 9, "EC・ショッピング", "EC / SHOPPING", FOOD, [
    sub("shop_online", "ネット通販", { use_cases: ["web", "ecommerce"], scenes: [sc("shop_browser", "通販", "a shopping website on a laptop, no people")] }),
    sub("shop_cart", "カート", { use_cases: ["ecommerce", "web"], scenes: [sc("cart_icon", "カート", "a shopping cart with boxes, no people")] }),
    sub("shop_buy", "商品購入", { use_cases: ["ecommerce", "advertising"], scenes: [sc("checkout_box", "購入", "a product box and receipt, no people")] }),
    sub("shop_pay", "決済", { use_cases: ["ecommerce", "web"], scenes: [sc("wallet_pay", "決済", "a wallet and generic card, no people")] }),
    sub("shop_sale", "セール", { use_cases: ["campaign", "sns"], scenes: [sc("sale_tag", "セール", "sale tags on products, no text logos, no people")] }),
    sub("shop_ship", "配送", { use_cases: ["web", "ecommerce"], scenes: [sc("parcel", "配送", "a cardboard parcel with tape, no people")] }),
    sub("shop_pack", "梱包", { use_cases: ["web", "ecommerce"], scenes: [sc("pack_box", "梱包", "packing peanuts and a box, no people")] }),
    sub("shop_review", "レビュー", { use_cases: ["web", "blog"], scenes: [sc("star_review", "レビュー", "star ratings on a card, no people")] }),
    sub("shop_gift", "ギフト", { use_cases: ["sns", "ecommerce"], scenes: [sc("gift_box", "ギフト", "a wrapped gift box, no people")] }),
    sub("shop_store", "店舗購入", { use_cases: ["web", "advertising"], scenes: [sc("storefront", "店舗", "a small shop storefront, no people")] }),
  ]),
  genre("marketing", "core", 9, "マーケティング・SNS", "MARKETING / SNS", CORP, [
    sub("mkt_sns", "SNS", { use_cases: ["sns", "web"], scenes: [sc("sns_phones", "SNS", "phones arranged for social posting, blank screens, no people")] }),
    sub("mkt_post", "投稿", { use_cases: ["sns", "campaign"], scenes: [sc("post_layout", "投稿", "a social post layout with copy space, no text, no people")] }),
    sub("mkt_like", "いいね", { use_cases: ["sns", "web"], scenes: [sc("like_heart", "いいね", "a like-heart symbol, no people")] }),
    sub("mkt_follow", "フォロワー", { use_cases: ["sns", "web"], scenes: [sc("follow_plus", "フォロー", "a follow-plus symbol, no people")] }),
    sub("mkt_ad", "広告", { use_cases: ["advertising", "web"], scenes: [sc("ad_banner", "広告", "an ad banner shape with copy space, no text, no people")] }),
    sub("mkt_seo", "SEO", { use_cases: ["web", "document"], scenes: [sc("seo_search", "SEO", "a search bar and ranking bars, no people")] }),
    sub("mkt_content", "コンテンツ制作", { use_cases: ["web", "blog"], scenes: [sc("content_desk", "制作", "a content desk with camera and notes, no people")] }),
    sub("mkt_mail", "メールマーケティング", { use_cases: ["web", "document"], scenes: [sc("mail_stack", "メール", "envelopes and a megaphone, no people")] }),
    sub("mkt_analytics", "分析", { use_cases: ["document", "web"], scenes: [sc("analytics", "分析", "analytics charts, no people")] }),
    sub("mkt_campaign", "キャンペーン", { use_cases: ["campaign", "sns"], scenes: [sc("campaign_flag", "キャンペーン", "campaign flags and a gift, no people")] }),
    sub("mkt_creator", "インフルエンサー道具", { use_cases: ["sns", "advertising"], scenes: [sc("creator_kit", "撮影キット", "a phone tripod and ring light, no people")] }),
  ]),
  genre("food", "core", 9, "食べ物・飲み物", "FOOD / DRINK", FOOD, [
    sub("food_washoku", "和食", { use_cases: ["web", "sns"], scenes: [sc("bento", "和食", "a Japanese meal on a tray, no people")] }),
    sub("food_yoshoku", "洋食", { use_cases: ["web", "sns"], scenes: [sc("pasta_plate", "洋食", "a pasta plate, no people")] }),
    sub("food_veg", "野菜", { use_cases: ["ecommerce", "blog"], scenes: [sc("veg_set", "野菜", "a set of vegetables, no people")] }),
    sub("food_fruit", "果物", { use_cases: ["ecommerce", "sns"], scenes: [sc("fruit_set", "果物", "a set of fruits, no people")] }),
    sub("food_meat", "肉", { use_cases: ["web", "blog"], scenes: [sc("meat_cut", "肉", "illustrated meat cuts, no people")] }),
    sub("food_fish", "魚", { use_cases: ["web", "blog"], scenes: [sc("fish_plate", "魚", "a fish on a plate, no people")] }),
    sub("food_bread", "パン", { use_cases: ["sns", "ecommerce"], scenes: [sc("bread_loaf", "パン", "a loaf of bread, no people")] }),
    sub("food_sweet", "スイーツ", { use_cases: ["sns", "ecommerce"], scenes: [sc("cake_slice", "スイーツ", "a cake slice, no people")] }),
    sub("food_coffee", "コーヒー", { use_cases: ["sns", "web"], scenes: [sc("coffee_cup", "コーヒー", "a coffee cup and saucer, no people")] }),
    sub("food_drink", "ドリンク", { use_cases: ["sns", "ecommerce"], scenes: [sc("drink_glass", "ドリンク", "a drink glass, no people")] }),
    sub("food_cafe", "カフェ", { use_cases: ["web", "sns"], scenes: [sc("cafe_table", "カフェ", "a cafe table with pastry, no people")] }),
    sub("food_cook", "調理", { use_cases: ["blog", "web"], scenes: [sc("cook_pot", "調理", "a cooking pot and utensils, no people")] }),
    sub("food_ing", "食材", { use_cases: ["blog", "ecommerce"], scenes: [sc("ing_board", "食材", "ingredients on a cutting board, no people")] }),
  ]),
  genre("housing", "core", 6, "住宅・建築", "HOUSING / CONSTRUCTION", DOC, [
    sub("hou_house", "家", { use_cases: ["web", "advertising"], scenes: [sc("house_ext", "家", "a simple house exterior, no people")] }),
    sub("hou_condo", "マンション", { use_cases: ["web", "advertising"], scenes: [sc("condo_ext", "マンション", "a condominium building, no people")] }),
    sub("hou_room", "部屋", { use_cases: ["web", "blog"], scenes: [sc("empty_room", "部屋", "an empty furnished room, no people")] }),
    sub("hou_interior", "インテリア", { use_cases: ["web", "sns"], scenes: [sc("interior_set", "インテリア", "furniture and a plant, no people")] }),
    sub("hou_build", "建設", { use_cases: ["web", "document"], scenes: [sc("site_crane", "建設", "a construction site with a crane, no people")] }),
    sub("hou_work", "工事", { use_cases: ["web", "document"], scenes: [sc("work_cones", "工事", "traffic cones and tools, no people")] }),
    sub("hou_reform", "リフォーム", { use_cases: ["web", "advertising"], scenes: [sc("paint_roll", "リフォーム", "paint roller and sample boards, no people")] }),
    sub("hou_tools", "工具", { use_cases: ["ecommerce", "web"], scenes: [sc("tool_set", "工具", "a set of hand tools, no people")] }),
    sub("hou_helmet", "作業用品", { use_cases: ["web", "document"], scenes: [sc("safety_helm", "ヘルメット", "a safety helmet and gloves, no people")] }),
    sub("hou_estate", "不動産", { use_cases: ["web", "advertising"], scenes: [sc("key_house", "不動産", "a house key and listing board, no people")] }),
    sub("hou_move", "引越し", { use_cases: ["web", "advertising"], scenes: [sc("move_boxes", "引越し", "moving boxes and tape, no people")] }),
    sub("hou_diy", "DIY", { use_cases: ["blog", "web"], scenes: [sc("diy_bench", "DIY", "a DIY workbench, no people")] }),
  ]),
  genre("recruitment", "core", 6, "求人・キャリア", "RECRUITMENT / CAREER", CORP, [
    sub("rec_job", "求人", { use_cases: ["web", "advertising"], scenes: [sc("job_board", "求人", "a job listing board, no people")] }),
    sub("rec_interview", "面接", { use_cases: ["web", "blog"], scenes: [sc("interview_chairs", "面接", "two chairs and a table for an interview, no people")] }),
    sub("rec_hire", "採用", { use_cases: ["web", "campaign"], scenes: [sc("hire_badge", "採用", "a welcome badge and desk, no people")] }),
    sub("rec_change", "転職", { use_cases: ["web", "blog"], scenes: [sc("change_bag", "転職", "a briefcase and city skyline, no people")] }),
    sub("rec_jobhunt", "就職活動", { use_cases: ["web", "blog"], scenes: [sc("resume_set", "就活", "a resume and envelopes, no people")] }),
    sub("rec_cv", "履歴書", { use_cases: ["web", "blog"], scenes: [sc("cv_paper", "履歴書", "a blank resume sheet, no photos of faces, no people")] }),
    sub("rec_career", "キャリア", { use_cases: ["web", "document"], scenes: [sc("career_ladder", "キャリア", "a career ladder illustration, no people")] }),
    sub("rec_onboard", "新入社員", { use_cases: ["web", "document"], scenes: [sc("welcome_desk", "入社", "a welcome desk with a plant, no people")] }),
    sub("rec_train", "研修", { use_cases: ["document", "web"], scenes: [sc("train_slides", "研修", "training slides on a screen, no people")] }),
    sub("rec_join", "チーム加入", { use_cases: ["web", "campaign"], scenes: [sc("join_puzzle", "加入", "a puzzle piece joining a team icon, no people")] }),
  ]),
  genre("childcare", "core", 6, "家族・子育て", "FAMILY / CHILDCARE", CUTE, [
    sub("fam_stroller", "育児用品", { use_cases: ["web", "advertising"], scenes: [sc("stroller", "ベビーカー", "a baby stroller, no people")] }),
    sub("fam_toys", "遊び", { use_cases: ["web", "sns"], scenes: [sc("toy_blocks", "おもちゃ", "toy blocks and a ball, no people")] }),
    sub("fam_learn", "学習", { use_cases: ["web", "blog"], scenes: [sc("kids_desk", "学習机", "a small study desk with crayons, no people")] }),
    sub("fam_chores", "家事", { use_cases: ["web", "blog"], scenes: [sc("apron_kit", "家事", "an apron and cleaning cloths, no people")] }),
    sub("fam_event", "家族イベント", { use_cases: ["sns", "campaign"], scenes: [sc("party_table", "イベント", "a family party table setting, no people")] }),
    sub("fam_bottle", "赤ちゃん用品", { use_cases: ["web", "ecommerce"], scenes: [sc("baby_bottle", "哺乳瓶", "a baby bottle and rattle, no people")] }),
    sub("fam_home", "家庭", { use_cases: ["web", "advertising"], scenes: [sc("family_table", "食卓", "a dining table with four empty chairs, no people")] }),
    sub("fam_preg", "マタニティ用品", { use_cases: ["web", "blog"], scenes: [sc("preg_kit", "マタニティ", "maternity items on a table, no people")] }),
  ]),
  genre("beauty", "core", 5, "美容・ファッション", "BEAUTY / FASHION", CUTE, [
    sub("bea_cosme", "コスメ", { use_cases: ["ecommerce", "sns"], scenes: [sc("cosme_set", "コスメ", "cosmetic bottles without logos, no people")] }),
    sub("bea_skin", "スキンケア", { use_cases: ["ecommerce", "web"], scenes: [sc("skin_bottles", "スキンケア", "skincare bottles, no people")] }),
    sub("bea_hair", "ヘア", { use_cases: ["web", "ecommerce"], scenes: [sc("hair_tools", "ヘア", "a comb and hairdryer, no people")] }),
    sub("bea_nail", "ネイル", { use_cases: ["sns", "web"], scenes: [sc("nail_set", "ネイル", "nail polish bottles, no people")] }),
    sub("bea_fashion", "ファッション", { use_cases: ["sns", "web"], scenes: [sc("clothes_set", "服", "folded clothes and a hanger, no people")] }),
    sub("bea_acc", "アクセサリー", { use_cases: ["ecommerce", "sns"], scenes: [sc("jewelry", "アクセサリー", "simple jewelry on linen, no people")] }),
    sub("bea_salon", "サロン", { use_cases: ["web", "advertising"], scenes: [sc("salon_chair", "サロン", "a salon chair and mirror, no people")] }),
    sub("bea_beauty", "美容", { use_cases: ["web", "sns"], scenes: [sc("beauty_desk", "美容", "a vanity table, no people")] }),
  ]),
  genre("hospitality", "core", 5, "店舗・サービス", "SHOP / SERVICE", CORP, [
    sub("hos_counter", "接客カウンター", { use_cases: ["web", "document"], scenes: [sc("service_counter", "カウンター", "a shop counter, no people")] }),
    sub("hos_register", "レジ", { use_cases: ["web", "document"], scenes: [sc("register", "レジ", "a cash register, no people")] }),
    sub("hos_eatery", "飲食店", { use_cases: ["web", "advertising"], scenes: [sc("eatery_table", "飲食店", "a restaurant table setting, no people")] }),
    sub("hos_hotel", "ホテル", { use_cases: ["web", "advertising"], scenes: [sc("hotel_lobby", "ホテル", "a hotel lobby desk, no people")] }),
    sub("hos_salonshop", "美容室", { use_cases: ["web", "advertising"], scenes: [sc("hair_salon", "美容室", "salon interior, no people")] }),
    sub("hos_front", "受付", { use_cases: ["web", "document"], scenes: [sc("front_desk", "受付", "a reception desk, no people")] }),
    sub("hos_cs", "カスタマーサービス", { use_cases: ["web", "document"], scenes: [sc("cs_headset", "CS", "a customer-service headset and screen, no people")] }),
    sub("hos_retail", "小売店", { use_cases: ["web", "advertising"], scenes: [sc("retail_shelf", "小売", "retail shelves, no people")] }),
    sub("hos_apron", "店員用品", { use_cases: ["web", "document"], scenes: [sc("staff_apron", "エプロン", "a staff apron and name badge, no people")] }),
  ]),
  genre("transport", "core", 5, "交通・物流", "TRANSPORT / LOGISTICS", DOC, [
    sub("tra_car", "自動車", { use_cases: ["web", "advertising"], scenes: [sc("car_side", "自動車", "a simple car side view, no people")] }),
    sub("tra_train", "電車", { use_cases: ["web", "blog"], scenes: [sc("train_side", "電車", "a commuter train, no people")] }),
    sub("tra_bus", "バス", { use_cases: ["web"], scenes: [sc("bus_side", "バス", "a city bus, no people")] }),
    sub("tra_plane", "飛行機", { use_cases: ["web", "advertising"], scenes: [sc("plane", "飛行機", "an airplane, no people")] }),
    sub("tra_bike", "自転車", { use_cases: ["web", "sns"], scenes: [sc("bicycle", "自転車", "a bicycle, no people")] }),
    sub("tra_delivery", "配送", { use_cases: ["web", "ecommerce"], scenes: [sc("delivery_van", "配送", "a delivery van, no people")] }),
    sub("tra_truck", "トラック", { use_cases: ["web", "document"], scenes: [sc("truck", "トラック", "a truck, no people")] }),
    sub("tra_warehouse", "倉庫", { use_cases: ["web", "document"], scenes: [sc("warehouse", "倉庫", "a warehouse aisle, no people")] }),
    sub("tra_parcel", "宅配", { use_cases: ["web", "ecommerce"], scenes: [sc("door_parcel", "宅配", "a parcel at a door, no people")] }),
    sub("tra_logi", "物流", { use_cases: ["web", "document"], scenes: [sc("logi_boxes", "物流", "stacked logistics boxes, no people")] }),
  ]),
  genre("manufacturing", "supporting", 3, "製造・産業", "MANUFACTURING / INDUSTRY", DOC, [
    sub("mfg_factory", "工場", { use_cases: ["web", "document"], scenes: [sc("factory", "工場", "a factory building, no people")] }),
    sub("mfg_machine", "機械", { use_cases: ["web", "document"], scenes: [sc("machine", "機械", "a manufacturing machine, no people")] }),
    sub("mfg_line", "生産ライン", { use_cases: ["web", "document"], scenes: [sc("prod_line", "ライン", "a production line, no people")] }),
    sub("mfg_qc", "品質管理", { use_cases: ["web", "document"], scenes: [sc("qc_clip", "検品", "a quality-check clipboard, no people")] }),
    sub("mfg_pack", "梱包", { use_cases: ["web"], scenes: [sc("mfg_pack", "梱包", "packed goods on a pallet, no people")] }),
    sub("mfg_make", "製造", { use_cases: ["web", "document"], scenes: [sc("make_gear", "製造", "gears and a product, no people")] }),
  ]),
  genre("travel", "core", 5, "旅行・レジャー", "TRAVEL / LEISURE", CUTE, [
    sub("trv_trip", "旅行", { use_cases: ["web", "advertising"], scenes: [sc("suitcase", "旅行", "a suitcase and passport, no people")] }),
    sub("trv_sight", "観光", { use_cases: ["web", "sns"], scenes: [sc("landmark", "観光", "a simple landmark, no people")] }),
    sub("trv_hotel", "ホテル", { use_cases: ["web", "advertising"], scenes: [sc("hotel_bed", "ホテル", "a hotel bed, no people")] }),
    sub("trv_sea", "海", { use_cases: ["sns", "web"], scenes: [sc("sea_wave", "海", "sea waves and a beach umbrella, no people")] }),
    sub("trv_mtn", "山", { use_cases: ["web", "sns"], scenes: [sc("mountain", "山", "a mountain, no people")] }),
    sub("trv_camp", "キャンプ", { use_cases: ["sns", "web"], scenes: [sc("tent", "キャンプ", "a tent and campfire, no people")] }),
    sub("trv_outdoor", "アウトドア", { use_cases: ["web", "sns"], scenes: [sc("backpack", "アウトドア", "a hiking backpack, no people")] }),
    sub("trv_onsen", "温泉", { use_cases: ["web", "advertising"], scenes: [sc("onsen", "温泉", "an onsen outdoor bath, no people")] }),
    sub("trv_leisure", "レジャー", { use_cases: ["web", "sns"], scenes: [sc("picnic", "レジャー", "a picnic blanket and basket, no people")] }),
  ]),
  genre("sports", "core", 5, "スポーツ", "SPORTS / FITNESS", CUTE, [
    sub("spo_run", "ランニング", { use_cases: ["web", "sns"], scenes: [sc("run_shoes", "ランニング", "running shoes, no people")] }),
    sub("spo_gym", "筋トレ", { use_cases: ["web", "sns"], scenes: [sc("gym_wts", "筋トレ", "gym weights, no people")] }),
    sub("spo_yoga", "ヨガ", { use_cases: ["web", "sns"], scenes: [sc("yoga_mat", "ヨガ", "a yoga mat, no people")] }),
    sub("spo_soccer", "サッカー", { use_cases: ["web", "sns"], scenes: [sc("soccer_ball", "サッカー", "a soccer ball, no people")] }),
    sub("spo_base", "野球", { use_cases: ["web", "sns"], scenes: [sc("baseball", "野球", "a baseball and bat, no people")] }),
    sub("spo_basket", "バスケット", { use_cases: ["web", "sns"], scenes: [sc("basketball", "バスケ", "a basketball, no people")] }),
    sub("spo_swim", "水泳", { use_cases: ["web"], scenes: [sc("swim_goggles", "水泳", "swim goggles and a cap, no people")] }),
    sub("spo_watch", "スポーツ観戦", { use_cases: ["web", "sns"], scenes: [sc("stadium", "観戦", "a stadium, no people")] }),
  ]),
  genre("nature", "supporting", 3, "自然・環境", "NATURE / ENVIRONMENT", FOOD, [
    sub("nat_tree", "木", { use_cases: ["web", "blog"], scenes: [sc("tree", "木", "a tree, no people")] }),
    sub("nat_flower", "花", { use_cases: ["sns", "web"], scenes: [sc("flower", "花", "flowers, no people")] }),
    sub("nat_forest", "森", { use_cases: ["web"], scenes: [sc("forest", "森", "a forest, no people")] }),
    sub("nat_sea", "海", { use_cases: ["web", "sns"], scenes: [sc("ocean", "海", "an ocean, no people")] }),
    sub("nat_mtn", "山", { use_cases: ["web"], scenes: [sc("nat_mtn", "山", "mountains, no people")] }),
    sub("nat_weather", "天気", { use_cases: ["web", "blog"], scenes: [sc("sun_cloud", "天気", "sun and cloud, no people")] }),
    sub("nat_eco", "エコ", { use_cases: ["web", "advertising"], scenes: [sc("recycle", "リサイクル", "recycling bins, no people")] }),
    sub("nat_solar", "太陽光", { use_cases: ["web", "document"], scenes: [sc("solar", "太陽光", "solar panels, no people")] }),
    sub("nat_ev", "EV", { use_cases: ["web", "advertising"], scenes: [sc("ev_car", "EV", "an electric car at a charger, no brand, no people")] }),
    sub("nat_sustain", "サステナビリティ", { use_cases: ["web", "document"], scenes: [sc("leaf_globe", "サステナ", "a leaf and globe, no people")] }),
  ]),
  genre("animal", "core", 4, "動物・ペット", "ANIMAL / PET", CUTE, [
    sub("ani_dog", "犬", { use_cases: ["web", "sns"], scenes: [sc("dog", "犬", "a friendly dog, no people")] }),
    sub("ani_cat", "猫", { use_cases: ["web", "sns"], scenes: [sc("cat", "猫", "a sitting cat, no people")] }),
    sub("ani_bird", "鳥", { use_cases: ["web", "sns"], scenes: [sc("bird", "鳥", "a bird, no people")] }),
    sub("ani_fish", "魚", { use_cases: ["web"], scenes: [sc("fish", "魚", "a fish, no people")] }),
    sub("ani_small", "小動物", { use_cases: ["web", "sns"], scenes: [sc("rabbit", "小動物", "a rabbit, no people")] }),
    sub("ani_wild", "野生動物", { use_cases: ["web", "blog"], scenes: [sc("deer", "野生", "a deer, no people")] }),
    sub("ani_sea", "海の生き物", { use_cases: ["web", "blog"], scenes: [sc("dolphin", "海の生き物", "a dolphin, no people")] }),
    sub("ani_petlife", "ペット用品", { use_cases: ["web", "ecommerce"], scenes: [sc("pet_bowl", "ペット用品", "a pet bowl and leash, no people")] }),
    sub("ani_vet", "動物病院", { use_cases: ["web", "advertising"], scenes: [sc("vet_bag", "動物病院", "a vet bag and clinic sign, no people")] }),
  ]),
  genre("seasonal", "core", 9, "季節・行事", "SEASON / HOLIDAY", CUTE, [
    sub("sea_newyear", "正月", { use_cases: ["campaign", "web"], scenes: [sc("kadomatsu", "正月", "kadomatsu and a fan, no people")] }),
    sub("sea_setsubun", "節分", { use_cases: ["sns", "web"], scenes: [sc("oni_beans", "節分", "roasted beans and an oni mask, no people")] }),
    sub("sea_valentine", "バレンタイン", { use_cases: ["sns", "ecommerce"], scenes: [sc("choco", "バレンタイン", "chocolates, no people")] }),
    sub("sea_hinamatsuri", "ひな祭り", { use_cases: ["web", "sns"], scenes: [sc("hina_dolls", "ひな人形", "stylized hina doll objects, no people, no realistic portraits")] }),
    sub("sea_sakura", "桜", { use_cases: ["web", "sns"], scenes: [sc("sakura", "桜", "cherry blossoms, no people")] }),
    sub("sea_entrance", "入学", { use_cases: ["campaign", "web"], scenes: [sc("randoseru", "入学", "a school backpack, no people")] }),
    sub("sea_grad", "卒業", { use_cases: ["campaign", "sns"], scenes: [sc("diploma", "卒業", "a diploma and cap, no people")] }),
    sub("sea_gw", "ゴールデンウィーク", { use_cases: ["web", "campaign"], scenes: [sc("gw_bag", "GW", "a travel bag and calendar, no people")] }),
    sub("sea_rain", "梅雨", { use_cases: ["web", "sns"], scenes: [sc("umbrella", "梅雨", "an umbrella and rain, no people")] }),
    sub("sea_festival", "夏祭り", { use_cases: ["web", "sns"], scenes: [sc("lanterns", "夏祭り", "festival lanterns, no people")] }),
    sub("sea_fireworks", "花火", { use_cases: ["sns", "web"], scenes: [sc("fireworks", "花火", "fireworks, no people")] }),
    sub("sea_halloween", "ハロウィン", { use_cases: ["sns", "campaign"], scenes: [sc("pumpkin", "ハロウィン", "a halloween pumpkin, no people")] }),
    sub("sea_xmas", "クリスマス", { use_cases: ["sns", "campaign"], scenes: [sc("xmas_tree", "クリスマス", "a christmas tree, no people")] }),
    sub("sea_yearend", "年末", { use_cases: ["web", "campaign"], scenes: [sc("yearend", "年末", "a calendar and broom, no people")] }),
    sub("sea_four", "春夏秋冬", { use_cases: ["web", "blog"], scenes: [sc("four_seasons", "四季", "four small seasonal icons, no people")] }),
  ]),
  genre("emotion", "core", 9, "感情・リアクション", "EMOTION / REACTION", CUTE, [
    sub("emo_joy", "喜ぶ", { use_cases: ["sns", "web"], scenes: [sc("joy_star", "喜び", "sparkles and a jumping star symbol, no people")] }),
    sub("emo_anger", "怒る", { use_cases: ["sns", "web"], scenes: [sc("anger_mark", "怒り", "an anger mark and steam, no people")] }),
    sub("emo_sad", "悲しい", { use_cases: ["web", "sns"], scenes: [sc("sad_rain", "悲しみ", "a rain cloud over a wilted flower, no people")] }),
    sub("emo_surprise", "驚く", { use_cases: ["sns", "web"], scenes: [sc("surprise_bang", "驚き", "an exclamation burst, no people")] }),
    sub("emo_trouble", "困る", { use_cases: ["web", "sns"], scenes: [sc("sweat_drop", "困る", "a large sweat drop, no people")] }),
    sub("emo_worry", "悩む", { use_cases: ["web", "blog"], scenes: [sc("scribble", "悩み", "scribbled thought lines, no people")] }),
    sub("emo_rush", "焦る", { use_cases: ["sns", "web"], scenes: [sc("rush_clock", "焦る", "a rushing clock, no people")] }),
    sub("emo_relief", "安心", { use_cases: ["web", "sns"], scenes: [sc("relief_sun", "安心", "a sun coming from clouds, no people")] }),
    sub("emo_tired", "疲れる", { use_cases: ["web", "sns"], scenes: [sc("tired_zzz", "疲れ", "zzz over a pillow, no people")] }),
    sub("emo_cheer", "応援", { use_cases: ["campaign", "sns"], scenes: [sc("cheer_flag", "応援", "a cheering flag, no people")] }),
    sub("emo_success", "成功", { use_cases: ["web", "campaign"], scenes: [sc("success_check", "成功", "a big check mark, no people")] }),
    sub("emo_fail", "失敗", { use_cases: ["web", "sns"], scenes: [sc("fail_cross", "失敗", "a gentle cross mark, no people")] }),
  ]),
  genre("communication", "core", 9, "コミュニケーション", "COMMUNICATION", CORP, [
    sub("com_chat", "チャット", { use_cases: ["web", "sns"], scenes: [sc("chat_bubbles", "チャット", "chat bubbles, no people")] }),
    sub("com_phone", "電話", { use_cases: ["web", "document"], scenes: [sc("handset", "電話", "a telephone handset, no people")] }),
    sub("com_mail", "メール", { use_cases: ["web", "document"], scenes: [sc("envelope", "メール", "an envelope, no people")] }),
    sub("com_meet", "オンライン会議", { use_cases: ["web", "document"], scenes: [sc("meet_grid", "会議グリッド", "an empty video-call grid, no faces, no people")] }),
    sub("com_ask", "質問", { use_cases: ["web", "blog"], scenes: [sc("question", "質問", "a question mark in a bubble, no people")] }),
    sub("com_consult", "相談", { use_cases: ["web", "advertising"], scenes: [sc("consult_desk", "相談", "two empty chairs and a desk, no people")] }),
    sub("com_notice", "お知らせ", { use_cases: ["web", "campaign"], scenes: [sc("megaphone", "お知らせ", "a megaphone, no people")] }),
    sub("com_review", "口コミ", { use_cases: ["web", "blog"], scenes: [sc("review_card", "口コミ", "review cards, no people")] }),
    sub("com_talk", "会話", { use_cases: ["web", "sns"], scenes: [sc("two_bubbles", "会話", "two speech bubbles, no people")] }),
  ]),
  genre("security", "core", 5, "セキュリティ・安全", "SECURITY / SAFETY", DOC, [
    sub("sec_password", "パスワード", { use_cases: ["web", "document"], scenes: [sc("password", "パスワード", "a password field with dots, no people")] }),
    sub("sec_login", "ログイン", { use_cases: ["web"], scenes: [sc("login", "ログイン", "a login form, no people")] }),
    sub("sec_auth", "認証", { use_cases: ["web", "document"], scenes: [sc("auth_check", "認証", "a checkmark on an ID card silhouette, no face photo, no people")] }),
    sub("sec_privacy", "個人情報", { use_cases: ["web", "document"], scenes: [sc("privacy_lock", "個人情報", "a lock over a document, no people")] }),
    sub("sec_crime", "防犯", { use_cases: ["web", "advertising"], scenes: [sc("door_lock", "防犯", "a door lock, no people")] }),
    sub("sec_shield", "セキュリティ", { use_cases: ["web", "document"], scenes: [sc("sec_shield", "シールド", "a security shield, no people")] }),
    sub("sec_scam", "詐欺注意", { use_cases: ["web", "campaign"], scenes: [sc("scam_warn", "詐欺注意", "a warning triangle over a phone, no people")] }),
    sub("sec_warn", "警告", { use_cases: ["web", "document"], scenes: [sc("warning", "警告", "a warning sign, no people")] }),
    sub("sec_ok", "安全確認", { use_cases: ["web", "document"], scenes: [sc("safety_ok", "安全", "a safety check clipboard, no people")] }),
  ]),
  genre("disaster", "supporting", 3, "防災・緊急", "DISASTER PREVENTION", DOC, [
    sub("dis_quake", "地震", { use_cases: ["web", "document"], scenes: [sc("quake", "地震", "a house with seismic waves, no people")] }),
    sub("dis_typhoon", "台風", { use_cases: ["web"], scenes: [sc("typhoon", "台風", "a typhoon swirl, no people")] }),
    sub("dis_rain", "大雨", { use_cases: ["web"], scenes: [sc("heavy_rain", "大雨", "heavy rain over a house, no people")] }),
    sub("dis_evac", "避難", { use_cases: ["web", "document"], scenes: [sc("evac_sign", "避難", "an evacuation sign, no people")] }),
    sub("dis_kit", "防災用品", { use_cases: ["web", "ecommerce"], scenes: [sc("emergency_kit", "防災用品", "an emergency kit, no people")] }),
    sub("dis_food", "非常食", { use_cases: ["web", "ecommerce"], scenes: [sc("emergency_food", "非常食", "emergency food cans, no people")] }),
    sub("dis_anpi", "安否確認", { use_cases: ["web", "document"], scenes: [sc("anpi_phone", "安否", "a phone with a check, no people")] }),
    sub("dis_fire", "消防", { use_cases: ["web"], scenes: [sc("fire_truck", "消防", "a fire truck, no people")] }),
    sub("dis_ems", "救急", { use_cases: ["web"], scenes: [sc("ambulance", "救急", "an ambulance, no people")] }),
  ]),
  genre("legal", "supporting", 2, "法律・士業", "LEGAL / PROFESSIONAL", CORP, [
    sub("leg_contract", "契約", { use_cases: ["web", "document"], scenes: [sc("contract", "契約", "a contract and stamp, no people")] }),
    sub("leg_law", "弁護士道具", { use_cases: ["web", "advertising"], scenes: [sc("law_scale", "法律", "scales of justice, no people")] }),
    sub("leg_tax", "税理士道具", { use_cases: ["web"], scenes: [sc("tax_abacus", "税務", "an abacus and tax form, no people")] }),
    sub("leg_cpa", "会計士道具", { use_cases: ["web"], scenes: [sc("cpa_books", "会計", "account books, no people")] }),
    sub("leg_proc", "行政手続", { use_cases: ["web"], scenes: [sc("gov_form", "手続", "government forms, no people")] }),
    sub("leg_consult", "法律相談", { use_cases: ["web", "advertising"], scenes: [sc("law_desk", "相談", "a consultation desk, no people")] }),
    sub("leg_docs", "書類", { use_cases: ["web", "document"], scenes: [sc("doc_stack", "書類", "a stack of documents, no people")] }),
    sub("leg_stamp", "判子", { use_cases: ["web"], scenes: [sc("hanko", "判子", "a Japanese name stamp, no people")] }),
  ]),
  genre("aging", "core", 5, "シニア", "SENIOR / AGING", SOFT_STYLES(), [
    sub("age_daily", "日常用品", { use_cases: ["web", "blog"], scenes: [sc("age_tea", "日常", "tea cups and a newspaper, no people")] }),
    sub("age_hobby", "趣味", { use_cases: ["web", "blog"], scenes: [sc("age_garden", "趣味", "gardening tools, no people")] }),
    sub("age_exercise", "運動", { use_cases: ["web", "advertising"], scenes: [sc("age_walk", "運動", "walking shoes, no people")] }),
    sub("age_phone", "スマートフォン", { use_cases: ["web", "blog"], scenes: [sc("age_phone", "スマホ", "a large-button phone, no people")] }),
    sub("age_trip", "旅行", { use_cases: ["web", "advertising"], scenes: [sc("age_bag", "旅行", "a travel bag, no people")] }),
    sub("age_health", "健康", { use_cases: ["web", "blog"], scenes: [sc("age_health", "健康", "a blood-pressure cuff, no people")] }),
    sub("age_work", "仕事", { use_cases: ["web"], scenes: [sc("age_desk", "仕事", "a simple work desk, no people")] }),
  ]),
  genre("housework", "supporting", 3, "清掃・家事", "CLEANING / HOUSEWORK", CUTE, [
    sub("hw_clean", "掃除", { use_cases: ["web", "advertising"], scenes: [sc("broom", "掃除", "a broom and dustpan, no people")] }),
    sub("hw_laundry", "洗濯", { use_cases: ["web", "blog"], scenes: [sc("laundry", "洗濯", "a washing machine and basket, no people")] }),
    sub("hw_cook", "料理", { use_cases: ["web", "blog"], scenes: [sc("hw_pot", "料理", "pots on a stove, no people")] }),
    sub("hw_tidy", "片付け", { use_cases: ["web", "blog"], scenes: [sc("tidy_box", "片付け", "storage boxes, no people")] }),
    sub("hw_organize", "整理収納", { use_cases: ["blog", "web"], scenes: [sc("shelf_org", "収納", "an organized shelf, no people")] }),
    sub("hw_trash", "ゴミ出し", { use_cases: ["web"], scenes: [sc("trash_bags", "ゴミ出し", "sorted trash bags, no people")] }),
    sub("hw_pro", "ハウスクリーニング", { use_cases: ["web", "advertising"], scenes: [sc("pro_clean", "清掃", "a mop and spray bottle, no people")] }),
    sub("hw_hygiene", "衛生", { use_cases: ["web", "advertising"], scenes: [sc("soap", "衛生", "soap and a sink, no people")] }),
  ]),
  genre("character", "supporting", 2, "キャラクター・人物表現", "CHARACTER / AVATAR", CUTE, [
    sub("cha_biz_prop", "ビジネス小物", { use_cases: ["web", "document"], scenes: [sc("biz_badge", "名刺", "a business badge and briefcase, no people")] }),
    sub("cha_school_prop", "学生小物", { use_cases: ["web"], scenes: [sc("school_bag", "学生鞄", "a school bag and pencil case, no people")] }),
    sub("cha_shop_prop", "店員小物", { use_cases: ["web"], scenes: [sc("shop_cap", "店員帽", "a shop cap and name tag, no people")] }),
    sub("cha_med_prop", "医療小物", { use_cases: ["web"], scenes: [sc("med_cross", "医療", "a medical cross and bag, no people")] }),
    sub("cha_work_prop", "作業小物", { use_cases: ["web"], scenes: [sc("helm_gloves", "作業", "a helmet and gloves, no people")] }),
    sub("cha_creator_prop", "クリエイター小物", { use_cases: ["web", "sns"], scenes: [sc("pen_tablet", "制作", "a pen tablet, no people")] }),
    sub("cha_symbol", "表情シンボル", { use_cases: ["sns", "web"], scenes: [sc("emoji_set", "シンボル", "a set of simple emotion symbols, no people, no faces")] }),
    sub("cha_frame", "アバター枠", { use_cases: ["web", "sns"], scenes: [sc("avatar_frame", "枠", "an empty circular avatar frame, no face inside, no people")] }),
  ]),
  genre("decorative", "supporting", 3, "装飾・デザイン素材", "DECORATIVE / DESIGN ELEMENTS", CUTE, [
    sub("dec_bubble", "吹き出し", { use_cases: ["web", "sns"], scenes: [sc("speech_bubble", "吹き出し", "an empty speech bubble, no people")] }),
    sub("dec_frame", "フレーム", { use_cases: ["web", "sns"], scenes: [sc("photo_frame", "フレーム", "a decorative frame, no people")] }),
    sub("dec_ribbon", "リボン", { use_cases: ["web", "campaign"], scenes: [sc("ribbon", "リボン", "a ribbon, no people")] }),
    sub("dec_label", "ラベル", { use_cases: ["web", "ecommerce"], scenes: [sc("label", "ラベル", "a blank label, no people")] }),
    sub("dec_badge", "バッジ", { use_cases: ["web", "campaign"], scenes: [sc("badge", "バッジ", "a decorative badge, no people")] }),
    sub("dec_heading", "見出し装飾", { use_cases: ["web", "blog"], scenes: [sc("heading", "見出し", "a heading ornament, no people")] }),
    sub("dec_divider", "区切り", { use_cases: ["web", "blog"], scenes: [sc("divider", "区切り", "a decorative divider, no people")] }),
    sub("dec_doodle", "手描き装飾", { use_cases: ["web", "sns"], scenes: [sc("doodle", "手描き", "hand-drawn doodle ornaments, no people")] }),
    sub("dec_sparkle", "キラキラ", { use_cases: ["sns", "campaign"], scenes: [sc("sparkle", "キラキラ", "sparkles, no people")] }),
    sub("dec_speed", "集中線", { use_cases: ["sns", "web"], scenes: [sc("speed_lines", "集中線", "manga speed lines, no people")] }),
  ]),
]);

function SOFT_STYLES() {
  return ["soft", "flat", "simple", "corporate"];
}

export const ILLUSTRATION_CORE_GENRE_COUNT = ILLUSTRATION_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const ILLUSTRATION_SUPPORTING_GENRE_COUNT = ILLUSTRATION_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;
export const ILLUSTRATION_QA_CORE_GENRES = Object.freeze([
  "business",
  "healthcare",
  "education",
  "technology",
  "food",
  "seasonal",
  "emotion",
  "housing",
]);

const GENRE_BY_ID = new Map(ILLUSTRATION_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const g of ILLUSTRATION_DEMAND_GENRES) {
  for (const sg of g.subgenres) {
    SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
    for (const scene of sg.scenes) SCENE_BY_ID.set(scene.id, { genre: g, subgenre: sg, scene });
  }
}

export function listIllustrationSubgenres() {
  return ILLUSTRATION_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getIllustrationGenre(id) {
  return GENRE_BY_ID.get(String(id || "")) || null;
}
export function getIllustrationSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getIllustrationScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateIllustrationGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const g of ILLUSTRATION_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    if (["people", "family", "senior", "person", "child"].includes(g.id)) issues.push(`human_path_id:${g.id}`);
    for (const token of [g.id, ...(g.subgenres || []).map((s) => s.id)]) {
      const segs = String(token).split(/[_-]/);
      if (segs.some((s) => /^(portrait|person|people|human|man|woman|child|children|family|couple|businessman|businesswoman|baby|senior)$/i.test(s))) {
        issues.push(`human_token:${token}`);
      }
    }
    for (const st of g.allowed_styles || []) {
      if (!ILLUSTRATION_STYLES[st]) issues.push(`unknown_style:${g.id}:${st}`);
    }
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id)) issues.push(`dup_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) {
        if (!ILLUSTRATION_USE_CASES[uc]) issues.push(`use:${sg.id}:${uc}`);
      }
      for (const scene of sg.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`dup_scene:${scene.id}`);
        sceneIds.add(scene.id);
        if (!/no people/i.test(scene.prompt_en)) issues.push(`people_in_prompt:${scene.id}`);
      }
    }
  }
  if (ILLUSTRATION_DEMAND_GENRES.length !== 30) issues.push(`genre_count:${ILLUSTRATION_DEMAND_GENRES.length}`);
  return {
    ok: issues.length === 0,
    issues,
    core: ILLUSTRATION_CORE_GENRE_COUNT,
    supporting: ILLUSTRATION_SUPPORTING_GENRE_COUNT,
    genres: ILLUSTRATION_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

export function illustrationSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.scene,
    spec?.style,
    spec?.asset_form,
    spec?.people_presence,
    spec?.background_type,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

const STYLE_JA = Object.fromEntries(Object.values(ILLUSTRATION_STYLES).map((s) => [s.id, s.label_ja]));
const FORM_JA = {
  object: "単体",
  set: "セット",
  scene: "シーン",
  isolated: "切り抜き",
  copyspace: "余白あり",
};

export function buildIllustrationJapaneseTitle(spec) {
  const found = getIllustrationScene(spec.scene) || getIllustrationSubgenre(spec.subcategory);
  const label = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "イラスト";
  const bits = [STYLE_JA[spec.style], FORM_JA[spec.asset_form]].filter(Boolean);
  const title = bits.length ? `${label}（${bits.join("・")}）` : `${label}のイラスト`;
  return title.slice(0, 32);
}

export function buildIllustrationDescription(spec) {
  const g = getIllustrationGenre(spec.genre);
  return [getIllustrationScene(spec.scene)?.scene?.label_ja, g?.label_ja, spec.use_case, spec.style]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildIllustrationPromptText(spec) {
  const found = getIllustrationScene(spec.scene);
  const sceneEn = found?.scene?.prompt_en || "a simple object";
  const styleEn = spec.style === "handdrawn" ? "hand-drawn" : spec.style;
  const formEn = {
    object: "single object",
    set: "a small matching set",
    scene: "a simple scene without characters",
    isolated: "isolated cutout",
    copyspace: "composition with empty copy space",
  }[spec.asset_form] || "single object";
  const bg =
    spec.background_type === "whiteiso"
      ? "isolated on white background"
      : spec.background_type === "copyspacebg"
        ? "soft background with copy space"
        : "simple colored background";
  const tokens = [
    "TASFUL_ILL_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `style=${spec.style || ""}`,
    `form=${spec.asset_form || ""}`,
  ].join(" ");
  return [
    tokens,
    "::",
    `Clean ${styleEn} vector illustration of ${sceneEn}`,
    formEn,
    bg,
    "no people, no faces, no hands, no text, no watermark, no logos",
  ].join(", ");
}

export function drivePathForIllustrationSpec(spec) {
  return `画像素材/イラスト/${spec.genre}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForIllustrationSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    String(spec.scene || "").replace(/_/g, "-"),
    spec.use_case,
    spec.style,
    spec.asset_form,
    spec.background_type,
    spec.people_presence,
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

export function parseIllustrationSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const people_presence = takeKnownFromRight(tokens, new Set(["absent", "present"]));
  const background_type = takeKnownFromRight(tokens, new Set(ILLUSTRATION_BACKGROUNDS));
  const asset_form = takeKnownFromRight(tokens, new Set(ILLUSTRATION_ASSET_FORMS));
  const style = takeKnownFromRight(tokens, new Set(Object.keys(ILLUSTRATION_STYLES)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(ILLUSTRATION_USE_CASES)));
  const genre = ILLUSTRATION_DEMAND_GENRES.find((g) => g.id === tokens[0])?.id || tokens[0] || "";
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
  return { genre, subcategory, scene, use_case, style, asset_form, background_type, people_presence };
}

export function parseIllustrationSpecFromPath({ categoryPath = [], slug = "", promptText = "", metadata = {} } = {}) {
  if (metadata?.genre && metadata?.scene && metadata?.style && metadata?.asset_form) {
    return {
      genre: String(metadata.genre),
      subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
      scene: String(metadata.scene).replace(/-/g, "_"),
      use_case: String(metadata.use_case || ""),
      style: String(metadata.style || ""),
      asset_form: String(metadata.asset_form || ""),
      background_type: String(metadata.background_type || ""),
      people_presence: String(metadata.people_presence || "absent"),
      title: metadata.title || "",
    };
  }
  const fromSlug = parseIllustrationSlugParts(slug);
  const genre = getIllustrationGenre(fromSlug.genre);
  const found = getIllustrationSubgenre(fromSlug.subcategory);
  const sceneFound = getIllustrationScene(fromSlug.scene);
  const complete =
    Boolean(genre) &&
    Boolean(found) &&
    Boolean(sceneFound) &&
    Boolean(fromSlug.style) &&
    Boolean(fromSlug.asset_form) &&
    Boolean(fromSlug.use_case);
  if (!complete) return null;
  const spec = {
    genre: found.genre.id,
    subcategory: found.subgenre.id,
    scene: sceneFound.scene.id,
    use_case: fromSlug.use_case,
    style: fromSlug.style,
    asset_form: fromSlug.asset_form,
    background_type: fromSlug.background_type || "whiteiso",
    people_presence: fromSlug.people_presence || "absent",
    promptText,
  };
  spec.title = buildIllustrationJapaneseTitle(spec);
  spec.description = buildIllustrationDescription(spec);
  spec.prompt = buildIllustrationPromptText(spec);
  return spec;
}

export function illustrationSpecToMetadata(spec) {
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    scene: spec.scene || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    asset_form: spec.asset_form || "",
    background_type: spec.background_type || "",
    people_presence: spec.people_presence || "absent",
    target: spec.people_presence || "absent",
    color_family: spec.color_family || (spec.style === "monochrome" ? "muted" : spec.style === "colorful" ? "vivid" : "neutral"),
    layout: spec.asset_form || "",
    composition: spec.asset_form || "",
    copy_space: spec.asset_form === "copyspace" || spec.background_type === "copyspacebg" ? "right" : "none",
    people_count: spec.people_presence === "absent" ? "nobody" : "",
    category: spec.genre || "",
    season: spec.genre === "seasonal" ? spec.subcategory : "",
  };
}

export function classifyLegacyIllustrationItem(item) {
  const hay = [item.subcategory, item.genre, ...(item.tags || []), item.title, item.slug]
    .map((x) => String(x || ""))
    .join(" ");
  const hits = new Set();
  for (const row of ILLUSTRATION_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy)) row.genre_ids.forEach((g) => hits.add(g));
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
