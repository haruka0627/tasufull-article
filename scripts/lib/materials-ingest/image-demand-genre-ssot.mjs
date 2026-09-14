/**
 * Image Demand Genre SSOT V1 — Web / ads / SNS / EC / docs / jobs / shops.
 * Internal IDs are stable slugs. Japanese labels are presentation only.
 * Does not copy SFX taxonomy. Does not invent unlimited major genres.
 * Wedding/funeral live under seasonal (not a 26th major).
 */
export const IMAGE_DEMAND_GENRE_SSOT_VERSION = "materials-image-demand-genre-ssot-v1";

export const IMAGE_ORIENTATIONS = Object.freeze(["landscape", "portrait", "square"]);
export const IMAGE_COPY_SPACES = Object.freeze([
  "none",
  "left",
  "right",
  "top",
  "bottom",
  "center_safe",
]);
export const IMAGE_PEOPLE_PRESENCE = Object.freeze(["present", "absent"]);
export const IMAGE_PEOPLE_COUNTS = Object.freeze(["solo", "pair", "smallgroup", "crowd", "nobody"]);
export const IMAGE_COMPOSITIONS = Object.freeze([
  "wide",
  "mediumshot",
  "closeup",
  "overhead",
  "environmental",
]);
export const IMAGE_LIGHTING = Object.freeze(["daylight", "studio", "overcast", "goldenhour", "fluo"]);
export const IMAGE_COLOR_FAMILIES = Object.freeze(["neutral", "warm", "cool", "vivid", "muted"]);
export const IMAGE_AGE_CONTEXTS = Object.freeze(["child", "young_adult", "adult", "senior", "mixed"]);

export const IMAGE_STYLE_CATALOG = Object.freeze({
  corporate: { id: "corporate", label_ja: "コーポレート" },
  editorial: { id: "editorial", label_ja: "エディトリアル" },
  luxury: { id: "luxury", label_ja: "高級" },
  minimal: { id: "minimal", label_ja: "ミニマル" },
  documentary: { id: "documentary", label_ja: "ドキュメンタリー" },
  candid: { id: "candid", label_ja: "スナップ" },
  polished: { id: "polished", label_ja: "整った" },
});

export const IMAGE_USE_CASES = Object.freeze({
  web: { id: "web", label_ja: "Web", orientation: { landscape: 70, portrait: 15, square: 15 }, copy: "high" },
  blog: { id: "blog", label_ja: "ブログ", orientation: { landscape: 75, portrait: 10, square: 15 }, copy: "medium" },
  sns: { id: "sns", label_ja: "SNS", orientation: { landscape: 15, portrait: 40, square: 45 }, copy: "high" },
  advertising: { id: "advertising", label_ja: "広告", orientation: { landscape: 40, portrait: 30, square: 30 }, copy: "high" },
  ecommerce: { id: "ecommerce", label_ja: "EC", orientation: { landscape: 25, portrait: 15, square: 60 }, copy: "high" },
  job_ad: { id: "job_ad", label_ja: "求人", orientation: { landscape: 50, portrait: 30, square: 20 }, copy: "high" },
  document: { id: "document", label_ja: "資料", orientation: { landscape: 80, portrait: 10, square: 10 }, copy: "medium" },
  campaign: { id: "campaign", label_ja: "キャンペーン", orientation: { landscape: 40, portrait: 25, square: 35 }, copy: "high" },
  listing: { id: "listing", label_ja: "物件・商品一覧", orientation: { landscape: 35, portrait: 15, square: 50 }, copy: "medium" },
  editorial: { id: "editorial", label_ja: "記事", orientation: { landscape: 60, portrait: 25, square: 15 }, copy: "low" },
});

export const IMAGE_ORIENTATION_RATIO = Object.freeze({
  landscape: "16-9",
  portrait: "9-16",
  square: "1-1",
});

/** Existing list subcategory / tags → genre candidates. Audit only — never auto-FILL inventory. */
export const IMAGE_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "ビジネス", genre_ids: ["business"] },
  { legacy: "自然", genre_ids: ["travel", "environment"] },
  { legacy: "食べ物", genre_ids: ["food"] },
  { legacy: "季節", genre_ids: ["seasonal"] },
  { legacy: "SNS", genre_ids: ["marketing"] },
  { legacy: "自動化", genre_ids: ["technology"] },
  { legacy: "サイボーグ", genre_ids: ["technology"] },
  { legacy: "ホログラム", genre_ids: ["technology"] },
  { legacy: "メカ", genre_ids: ["technology"] },
  { legacy: "ドローン", genre_ids: ["technology"] },
  { legacy: "チャット", genre_ids: ["marketing", "technology"] },
  { legacy: "いいね", genre_ids: ["marketing"] },
  { legacy: "フォロー", genre_ids: ["marketing"] },
  { legacy: "コメント", genre_ids: ["marketing"] },
  { legacy: "通知", genre_ids: ["marketing"] },
  { legacy: "AI", genre_ids: ["technology"] },
  { legacy: "求人", genre_ids: ["recruitment"] },
  { legacy: "住宅", genre_ids: ["housing"] },
  { legacy: "美容", genre_ids: ["beauty"] },
  { legacy: "医療", genre_ids: ["healthcare"] },
]);

function sc(id, labelJa, promptEn) {
  return Object.freeze({ id, path_id: id.replace(/_/g, "-"), label_ja: labelJa, prompt_en: promptEn });
}

function sub(id, labelJa, extra = {}) {
  const scenes = extra.scenes || [
    sc(`${id}_scene`, labelJa, extra.prompt_en || `Photorealistic scene of ${labelJa}`),
  ];
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: labelJa,
    label_en: extra.label_en || id.replace(/_/g, " "),
    use_cases: Object.freeze(extra.use_cases || ["web", "blog"]),
    scenes: Object.freeze(scenes),
    people_policy: extra.people_policy || "",
  });
}

export const IMAGE_DEMAND_GENRES = Object.freeze([
  Object.freeze({
    id: "business",
    tier: "core",
    demand_weight: 12,
    label_ja: "ビジネス・仕事",
    label_en: "BUSINESS / WORK",
    people_policy: "typical",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["corporate", "polished", "minimal", "editorial"]),
    subgenres: Object.freeze([
      sub("meeting", "会議", { use_cases: ["web", "document", "advertising"], scenes: [sc("meeting_room", "会議室", "a Japanese office meeting around a conference table"), sc("video_meeting", "オンライン会議", "a video conference on a laptop in a bright office")] }),
      sub("sales", "営業", { use_cases: ["web", "document", "job_ad"], scenes: [sc("client_visit", "商談", "a salesperson talking with a client in a meeting room")] }),
      sub("office", "オフィス", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("open_office", "オフィスフロア", "a modern open-plan office with desks and daylight")] }),
      sub("deskwork", "PC作業", { use_cases: ["web", "blog", "sns"], scenes: [sc("laptop_desk", "デスクワーク", "a person working on a laptop at a clean office desk")] }),
      sub("teamwork", "チーム", { use_cases: ["job_ad", "web", "campaign"], scenes: [sc("team_huddle", "チーム作業", "a small team collaborating around a whiteboard")] }),
      sub("management", "経営", { use_cases: ["document", "web"], scenes: [sc("exec_office", "経営会議", "executives reviewing documents in a calm boardroom")] }),
      sub("presentation", "プレゼン", { use_cases: ["document", "web", "advertising"], scenes: [sc("stage_talk", "プレゼン", "a presenter speaking in front of a screen in a conference room")] }),
      sub("remote", "リモートワーク", { use_cases: ["blog", "sns", "web"], scenes: [sc("home_office", "在宅勤務", "a tidy home office with laptop and natural window light")] }),
      sub("clerical", "事務", { use_cases: ["job_ad", "web"], scenes: [sc("admin_desk", "事務作業", "clerical work with documents and a computer at an office desk")] }),
      sub("support", "カスタマーサポート", { use_cases: ["job_ad", "web"], scenes: [sc("call_center", "カスタマーサポート", "a support specialist with a headset at a helpdesk")] }),
    ]),
  }),
  Object.freeze({
    id: "lifestyle",
    tier: "core",
    demand_weight: 10,
    label_ja: "人物・ライフスタイル",
    label_en: "PEOPLE / LIFESTYLE",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["candid", "editorial", "polished", "documentary"]),
    subgenres: Object.freeze([
      sub("daily_life", "日常生活", { use_cases: ["web", "blog", "sns"], scenes: [sc("morning_kitchen", "日常の朝", "everyday morning life in a Japanese apartment kitchen")] }),
      sub("smartphone_life", "スマートフォン", { use_cases: ["sns", "advertising", "web"], scenes: [sc("phone_commute", "スマホを見る", "a person looking at a smartphone in daily life, photorealistic")] }),
      sub("conversation", "会話", { use_cases: ["web", "sns", "advertising"], scenes: [sc("cafe_talk", "会話", "two people talking casually at a cafe table")] }),
      sub("shopping", "買い物", { use_cases: ["advertising", "sns", "web"], scenes: [sc("retail_browse", "買い物", "shopping in a bright retail aisle with product shelves")] }),
      sub("hobby", "趣味", { use_cases: ["blog", "sns", "editorial"], scenes: [sc("hobby_desk", "趣味", "a person enjoying a hobby at a table with natural light")] }),
      sub("relax", "リラックス", { use_cases: ["web", "sns", "campaign"], scenes: [sc("sofa_rest", "リラックス", "someone relaxing on a sofa in a sunlit living room")] }),
      sub("youth", "若者", { use_cases: ["sns", "campaign", "web"], scenes: [sc("young_street", "街の若者", "young adults walking a city street in daylight")] }),
      sub("adults", "大人", { use_cases: ["web", "advertising", "blog"], scenes: [sc("adult_weekday", "大人の日常", "working-age adults in everyday weekday clothing outdoors")] }),
      sub("solo_life", "一人", { use_cases: ["blog", "sns", "web"], scenes: [sc("solo_cafe", "一人時間", "one person spending quiet time at a cafe window")] }),
      sub("group_life", "グループ", { use_cases: ["sns", "campaign", "web"], scenes: [sc("friends_park", "グループ", "a small group of friends outdoors in a park")] }),
    ]),
  }),
  Object.freeze({
    id: "housing",
    tier: "core",
    demand_weight: 9,
    label_ja: "住宅・建築・不動産",
    label_en: "HOUSING / ARCHITECTURE / REAL ESTATE",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "minimal", "luxury", "polished"]),
    subgenres: Object.freeze([
      sub("house", "戸建て", { use_cases: ["listing", "web", "advertising"], scenes: [sc("detached_exterior", "戸建て外観", "a Japanese detached house exterior in daylight, real-estate photo")] }),
      sub("mansion", "マンション", { use_cases: ["listing", "web"], scenes: [sc("condo_exterior", "マンション外観", "a condominium building exterior, clean architectural photo")] }),
      sub("living", "リビング", { use_cases: ["listing", "web", "blog"], scenes: [sc("living_room", "リビング", "a bright living room interior with sofa and window light")] }),
      sub("kitchen", "キッチン", { use_cases: ["listing", "web", "blog"], scenes: [sc("home_kitchen", "キッチン", "a modern home kitchen interior, no food mess")] }),
      sub("bath", "浴室", { use_cases: ["listing", "web"], scenes: [sc("bathroom", "浴室", "a clean Japanese bathroom interior, bright and tidy")] }),
      sub("interior", "インテリア", { use_cases: ["web", "blog", "sns"], scenes: [sc("styled_interior", "インテリア", "styled interior design detail with furniture and daylight")] }),
      sub("realestate", "不動産", { use_cases: ["listing", "advertising", "web"], scenes: [sc("agent_keys", "不動産", "real-estate viewing of an empty bright apartment")] }),
      sub("newbuild", "新築", { use_cases: ["listing", "advertising"], scenes: [sc("new_house", "新築", "a newly built house with clean landscaping")] }),
      sub("reform", "リフォーム", { use_cases: ["web", "blog", "advertising"], scenes: [sc("renovation", "リフォーム", "a home renovation interior in progress, tools neatly placed")] }),
      sub("site", "建設現場", { use_cases: ["job_ad", "web", "document"], scenes: [sc("construction_site", "建設現場", "a construction site with safety gear visible, photorealistic")] }),
      sub("tools", "工具", { use_cases: ["ecommerce", "web"], people_policy: "product_first", scenes: [sc("tool_still", "工具", "construction tools arranged on a workbench, product-style photo")] }),
      sub("worker", "作業員", { use_cases: ["job_ad", "web"], scenes: [sc("site_worker", "作業員", "a construction worker in safety gear on a building site")] }),
    ]),
  }),
  Object.freeze({
    id: "food",
    tier: "core",
    demand_weight: 9,
    label_ja: "飲食・料理",
    label_en: "FOOD / DRINK",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "luxury", "candid", "polished"]),
    subgenres: Object.freeze([
      sub("washoku", "和食", { use_cases: ["web", "sns", "advertising"], scenes: [sc("sushi_plate", "和食", "beautifully plated Japanese washoku on a table, food photography")] }),
      sub("yoshoku", "洋食", { use_cases: ["web", "sns", "advertising"], scenes: [sc("western_plate", "洋食", "a western-style restaurant dish with natural lighting")] }),
      sub("cafe", "カフェ", { use_cases: ["sns", "web", "campaign"], scenes: [sc("cafe_table", "カフェ", "a cafe table with coffee and pastry, photorealistic")] }),
      sub("sweets", "スイーツ", { use_cases: ["sns", "ecommerce", "advertising"], scenes: [sc("dessert_plate", "スイーツ", "a dessert on a ceramic plate, soft daylight")] }),
      sub("drink", "ドリンク", { use_cases: ["sns", "ecommerce", "advertising"], scenes: [sc("drink_glass", "ドリンク", "a fresh drink in a glass with condensation, no text on glass")] }),
      sub("ingredients", "食材", { use_cases: ["blog", "ecommerce", "web"], people_policy: "product_first", scenes: [sc("fresh_produce", "食材", "fresh ingredients on a wooden counter, overhead food photo")] }),
      sub("cooking", "調理", { use_cases: ["blog", "web", "sns"], scenes: [sc("cooking_hands", "調理", "hands cooking in a kitchen, food in progress, photorealistic")] }),
      sub("restaurant", "レストラン", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("restaurant_interior", "レストラン", "a restaurant interior with set tables and warm lighting")] }),
      sub("takeout", "テイクアウト", { use_cases: ["sns", "advertising", "web"], scenes: [sc("takeout_bag", "テイクアウト", "takeout food packaging on a counter, no logos")] }),
      sub("healthfood", "健康食品", { use_cases: ["ecommerce", "web", "blog"], people_policy: "product_first", scenes: [sc("healthy_bowl", "健康食品", "a healthy grain bowl with vegetables, clean food photo")] }),
    ]),
  }),
  Object.freeze({
    id: "beauty",
    tier: "core",
    demand_weight: 7,
    label_ja: "美容・ファッション",
    label_en: "BEAUTY / FASHION",
    people_policy: "typical",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["luxury", "polished", "editorial", "minimal"]),
    subgenres: Object.freeze([
      sub("salon", "美容室", { use_cases: ["web", "advertising", "sns"], scenes: [sc("hair_salon", "美容室", "a bright hair salon interior with chairs and mirrors")] }),
      sub("cosmetics", "コスメ", { use_cases: ["ecommerce", "sns", "advertising"], people_policy: "product_first", scenes: [sc("cosmetic_still", "コスメ", "cosmetic bottles on a clean surface, no brand logos")] }),
      sub("skincare", "スキンケア", { use_cases: ["ecommerce", "web", "sns"], scenes: [sc("skincare_routine", "スキンケア", "a skincare routine on a bathroom shelf, photorealistic")] }),
      sub("nail", "ネイル", { use_cases: ["sns", "web", "advertising"], scenes: [sc("nail_care", "ネイル", "a nail salon table with tidy tools and soft lighting")] }),
      sub("beauty_salon", "サロン", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("esthetic_room", "エステサロン", "a calm esthetic salon room with clean linens")] }),
      sub("haircare", "ヘアケア", { use_cases: ["ecommerce", "advertising", "web"], scenes: [sc("hair_wash", "ヘアケア", "haircare products beside a salon basin, no logos")] }),
      sub("fashion", "ファッション", { use_cases: ["sns", "advertising", "web"], scenes: [sc("street_fashion", "ファッション", "everyday fashion look in a city setting, photorealistic")] }),
      sub("accessory", "アクセサリー", { use_cases: ["ecommerce", "sns"], people_policy: "product_first", scenes: [sc("jewelry_still", "アクセサリー", "simple jewelry on a linen background, product photo")] }),
    ]),
  }),
  Object.freeze({
    id: "healthcare",
    tier: "core",
    demand_weight: 7,
    label_ja: "医療・健康",
    label_en: "MEDICAL / HEALTHCARE / WELLNESS",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["corporate", "documentary", "polished", "minimal"]),
    subgenres: Object.freeze([
      sub("doctor", "医師", { use_cases: ["web", "job_ad", "document"], scenes: [sc("clinic_doctor", "医師", "a doctor in a bright clinic consultation room")] }),
      sub("nursing", "看護", { use_cases: ["job_ad", "web"], scenes: [sc("nurse_care", "看護", "a nurse checking notes at a hospital station")] }),
      sub("hospital", "病院", { use_cases: ["web", "document"], scenes: [sc("hospital_corridor", "病院", "a clean hospital corridor with daylight, photorealistic")] }),
      sub("exam", "診察", { use_cases: ["web", "blog"], scenes: [sc("exam_room", "診察", "a clinic exam room with a doctor and patient at a desk")] }),
      sub("dental", "歯科", { use_cases: ["web", "advertising"], scenes: [sc("dental_clinic", "歯科", "a dental clinic chair in a bright treatment room")] }),
      sub("pharmacy", "薬局", { use_cases: ["web", "job_ad"], scenes: [sc("pharmacy_counter", "薬局", "a pharmacy counter with organized shelves, no brand logos")] }),
      sub("caregiving", "介護", { use_cases: ["web", "job_ad", "document"], scenes: [sc("elder_care", "介護", "caregiving in a bright residential care room, respectful documentary")] }),
      sub("healthcheck", "健康管理", { use_cases: ["blog", "web", "sns"], scenes: [sc("health_measure", "健康管理", "a person checking health at home with a simple device")] }),
      sub("fitness_health", "フィットネス", { use_cases: ["web", "sns", "advertising"], scenes: [sc("gym_training", "フィットネス", "a person training in a clean gym, photorealistic")] }),
      sub("wellness", "ウェルネス", { use_cases: ["web", "sns", "campaign"], scenes: [sc("wellness_stretch", "ウェルネス", "a calm wellness stretch in a bright room")] }),
    ]),
  }),
  Object.freeze({
    id: "education",
    tier: "core",
    demand_weight: 6,
    label_ja: "教育・学習",
    label_en: "EDUCATION / LEARNING",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "candid", "corporate", "documentary"]),
    subgenres: Object.freeze([
      sub("school", "学校", { use_cases: ["web", "document"], scenes: [sc("classroom", "教室", "a bright classroom with desks, photorealistic school interior")] }),
      sub("study", "勉強", { use_cases: ["blog", "sns", "web"], scenes: [sc("study_desk", "勉強", "a student studying at a desk with notebooks and a lamp")] }),
      sub("juku", "塾", { use_cases: ["web", "advertising"], scenes: [sc("cram_class", "塾", "a small tutoring class around a table")] }),
      sub("online_learn", "オンライン学習", { use_cases: ["web", "sns", "advertising"], scenes: [sc("online_class", "オンライン学習", "online learning on a laptop at a home desk")] }),
      sub("qualification", "資格", { use_cases: ["web", "advertising", "blog"], scenes: [sc("exam_prep", "資格勉強", "exam preparation books and notes on a desk")] }),
      sub("child_learn", "子どもの学習", { use_cases: ["web", "blog", "advertising"], scenes: [sc("child_homework", "子どもの学習", "a child doing homework at a kitchen table")] }),
      sub("university", "大学", { use_cases: ["web", "document"], scenes: [sc("campus_walk", "大学", "a university campus walkway in daylight")] }),
      sub("seminar", "研修", { use_cases: ["document", "job_ad", "web"], scenes: [sc("corporate_training", "研修", "adults in a corporate training room")] }),
      sub("reading", "読書", { use_cases: ["blog", "sns", "web"], scenes: [sc("reading_nook", "読書", "someone reading a book by a window")] }),
    ]),
  }),
  Object.freeze({
    id: "technology",
    tier: "core",
    demand_weight: 8,
    label_ja: "IT・テクノロジー",
    label_en: "TECHNOLOGY / IT",
    people_policy: "optional",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["corporate", "minimal", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("ai_tech", "AI", { use_cases: ["web", "document", "advertising"], scenes: [sc("ai_workspace", "AI活用", "a realistic office using AI tools on a computer screen, no fake holograms")] }),
      sub("pc_tech", "PC", { use_cases: ["web", "ecommerce", "blog"], scenes: [sc("dev_desk", "PC作業", "a computer workstation with dual monitors in an office")] }),
      sub("mobile_tech", "スマートフォン", { use_cases: ["sns", "advertising", "web"], scenes: [sc("app_phone", "スマホ操作", "hands holding a smartphone showing a generic app UI, no logos")] }),
      sub("programming", "プログラミング", { use_cases: ["job_ad", "web", "blog"], scenes: [sc("code_screen", "プログラミング", "a developer writing code on a laptop, realistic office")] }),
      sub("cloud", "クラウド", { use_cases: ["web", "document"], scenes: [sc("server_room", "クラウド基盤", "a clean server room corridor, photorealistic")] }),
      sub("data", "データ", { use_cases: ["document", "web"], scenes: [sc("dashboard_desk", "データ分析", "analytics dashboards on a monitor at a desk, no readable secret text")] }),
      sub("security", "サイバーセキュリティ", { use_cases: ["web", "document"], scenes: [sc("sec_ops", "セキュリティ", "a security operations desk with multiple monitors")] }),
      sub("robot", "ロボット", { use_cases: ["web", "blog"], scenes: [sc("factory_robot", "ロボット", "an industrial robot arm in a factory, photorealistic")] }),
      sub("digital", "デジタル", { use_cases: ["web", "advertising"], scenes: [sc("tablet_work", "デジタル業務", "tablet and laptop on a meeting table")] }),
      sub("network", "ネットワーク", { use_cases: ["web", "document"], scenes: [sc("network_rack", "ネットワーク", "network equipment in a tidy rack, photorealistic")] }),
    ]),
  }),
  Object.freeze({
    id: "product",
    tier: "core",
    demand_weight: 9,
    label_ja: "EC・商品・物撮り",
    label_en: "EC / PRODUCT",
    people_policy: "product_first",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["minimal", "luxury", "polished", "corporate"]),
    subgenres: Object.freeze([
      sub("backdrop", "商品背景", { use_cases: ["ecommerce", "advertising"], scenes: [sc("seamless_bg", "商品背景", "an empty seamless product photography backdrop, no product yet")] }),
      sub("pedestal", "商品台座", { use_cases: ["ecommerce", "advertising"], scenes: [sc("product_plinth", "商品台座", "a product pedestal on a studio sweep, empty platform")] }),
      sub("package", "パッケージ", { use_cases: ["ecommerce", "web"], scenes: [sc("plain_box", "パッケージ", "a plain unlabeled product box on a white surface")] }),
      sub("cosmetic_product", "コスメ商品", { use_cases: ["ecommerce", "sns"], scenes: [sc("beauty_bottle", "コスメ商品", "unlabeled cosmetic bottles on a marble surface")] }),
      sub("food_product", "食品商品", { use_cases: ["ecommerce", "advertising"], scenes: [sc("grocery_pack", "食品商品", "packaged food on a clean table, labels unreadable / blank")] }),
      sub("gadget", "ガジェット", { use_cases: ["ecommerce", "web"], scenes: [sc("gadget_still", "ガジェット", "a generic gadget on a desk, no brand logos")] }),
      sub("whitebg", "白背景", { use_cases: ["ecommerce"], scenes: [sc("isolated_white", "白背景物撮り", "a simple object isolated on pure white background, studio lighting")] }),
      sub("luxury_bg", "高級商品背景", { use_cases: ["ecommerce", "advertising"], scenes: [sc("dark_luxury", "高級背景", "a dark luxury product backdrop with soft rim light")] }),
      sub("sale", "セール", { use_cases: ["campaign", "sns", "advertising"], scenes: [sc("sale_table", "セール陳列", "a retail sale table of generic products, no text overlays")] }),
      sub("gift", "ギフト", { use_cases: ["sns", "ecommerce", "campaign"], scenes: [sc("gift_wrap", "ギフト", "a wrapped gift box with ribbon on a table, no logos")] }),
    ]),
  }),
  Object.freeze({
    id: "marketing",
    tier: "core",
    demand_weight: 9,
    label_ja: "SNS・広告・マーケティング",
    label_en: "SNS / ADVERTISING / MARKETING",
    people_policy: "optional",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["polished", "editorial", "corporate", "candid"]),
    subgenres: Object.freeze([
      sub("sns_post", "SNS投稿", { use_cases: ["sns", "campaign"], scenes: [sc("social_flatlay", "SNS投稿", "a clean social-media flat lay with phone and notebook, no on-screen text")] }),
      sub("campaign_vis", "キャンペーン", { use_cases: ["campaign", "advertising"], scenes: [sc("campaign_set", "キャンペーン", "a campaign photo set with copy space, photorealistic")] }),
      sub("sale_ad", "セール告知", { use_cases: ["advertising", "sns"], scenes: [sc("promo_scene", "セール告知", "a promotional retail scene with empty copy space, no text")] }),
      sub("announce", "告知", { use_cases: ["sns", "web", "advertising"], scenes: [sc("announce_bg", "告知背景", "a simple announcement background with a subject and copy space")] }),
      sub("ad_bg", "広告背景", { use_cases: ["advertising"], scenes: [sc("ad_backdrop", "広告背景", "an advertising backdrop with strong copy space and a simple subject")] }),
      sub("thumb_bg", "サムネイル背景", { use_cases: ["sns", "web"], scenes: [sc("thumb_scene", "サムネイル背景", "a thumbnail-friendly scene with a clear focal subject and copy space")] }),
      sub("marketing_work", "マーケティング", { use_cases: ["web", "document", "job_ad"], scenes: [sc("marketing_desk", "マーケ作業", "a marketing team reviewing printouts on a desk")] }),
      sub("influencer", "インフルエンサー", { use_cases: ["sns", "advertising"], scenes: [sc("creator_shoot", "撮影", "a creator filming with a phone on a tripod, photorealistic")] }),
      sub("video_announce", "動画告知", { use_cases: ["sns", "campaign"], scenes: [sc("video_set", "動画告知", "a small video recording setup with lights and a backdrop")] }),
    ]),
  }),
  Object.freeze({
    id: "recruitment",
    tier: "core",
    demand_weight: 8,
    label_ja: "求人・採用",
    label_en: "RECRUITMENT / HR",
    people_policy: "typical",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["corporate", "candid", "polished", "documentary"]),
    subgenres: Object.freeze([
      sub("interview", "面接", { use_cases: ["job_ad", "web", "advertising"], scenes: [sc("office_interview", "面接", "a job interview across a table in a bright office"), sc("panel_interview", "複数面接", "a candidate speaking with two interviewers in an office")] }),
      sub("hiring", "採用", { use_cases: ["job_ad", "campaign", "web"], scenes: [sc("hiring_event", "採用イベント", "a company recruiting booth at a career event")] }),
      sub("job_posting", "求人", { use_cases: ["job_ad", "advertising", "sns"], scenes: [sc("workplace_hero", "求人写真", "a workplace hero photo suitable for a job advertisement")] }),
      sub("newhire", "新入社員", { use_cases: ["job_ad", "web"], scenes: [sc("first_day", "新入社員", "new employees being welcomed in an office lobby")] }),
      sub("hr_training", "研修", { use_cases: ["job_ad", "document"], scenes: [sc("onboarding", "研修", "onboarding training in a meeting room")] }),
      sub("hr_team", "チーム", { use_cases: ["job_ad", "web"], scenes: [sc("diverse_team", "職場チーム", "a workplace team standing together in an office, natural poses")] }),
      sub("workplace", "職場風景", { use_cases: ["job_ad", "web", "sns"], scenes: [sc("office_life", "職場風景", "candid office life with people working at desks")] }),
      sub("career", "キャリア", { use_cases: ["web", "blog", "job_ad"], scenes: [sc("career_talk", "キャリア相談", "a career counseling conversation at a desk")] }),
      sub("jobchange", "転職", { use_cases: ["web", "advertising", "blog"], scenes: [sc("resume_desk", "転職準備", "a person reviewing documents at home before a job change")] }),
    ]),
  }),
  Object.freeze({
    id: "hospitality",
    tier: "core",
    demand_weight: 6,
    label_ja: "店舗・サービス",
    label_en: "SHOP / SERVICE / HOSPITALITY",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["polished", "candid", "corporate", "editorial"]),
    subgenres: Object.freeze([
      sub("service", "接客", { use_cases: ["job_ad", "web", "advertising"], scenes: [sc("counter_service", "接客", "a staff member greeting a customer at a shop counter")] }),
      sub("retail", "小売店", { use_cases: ["web", "job_ad"], scenes: [sc("retail_floor", "小売店", "a retail shop floor with neat shelves")] }),
      sub("eatery", "飲食店", { use_cases: ["web", "job_ad", "sns"], scenes: [sc("restaurant_staff", "飲食店", "restaurant staff preparing a table")] }),
      sub("hotel", "ホテル", { use_cases: ["web", "advertising"], scenes: [sc("hotel_lobby", "ホテル", "a hotel lobby with reception desk, photorealistic")] }),
      sub("reception", "受付", { use_cases: ["web", "job_ad"], scenes: [sc("front_desk", "受付", "a reception desk in a bright office lobby")] }),
      sub("store_salon", "店舗サロン", { use_cases: ["web", "advertising"], scenes: [sc("shop_salon", "サロン店舗", "a small salon shop interior with waiting chairs")] }),
      sub("clerk", "店員", { use_cases: ["job_ad", "web"], scenes: [sc("shop_clerk", "店員", "a shop clerk arranging products on a shelf")] }),
      sub("register", "レジ", { use_cases: ["job_ad", "web"], scenes: [sc("checkout", "レジ", "a checkout counter in a retail store")] }),
      sub("customer_care", "顧客対応", { use_cases: ["web", "job_ad"], scenes: [sc("customer_talk", "顧客対応", "staff helping a customer on the shop floor")] }),
    ]),
  }),
  Object.freeze({
    id: "family",
    tier: "core",
    demand_weight: 5,
    label_ja: "家族・子育て",
    label_en: "FAMILY / CHILDCARE",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["candid", "documentary", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("parent_child", "親子", { use_cases: ["web", "blog", "advertising"], scenes: [sc("parent_walk", "親子", "a parent and child walking together outdoors")] }),
      sub("baby", "赤ちゃん", { use_cases: ["web", "blog"], scenes: [sc("baby_home", "赤ちゃん", "a baby at home with a parent, respectful documentary")] }),
      sub("children", "子ども", { use_cases: ["web", "blog", "sns"], scenes: [sc("kids_playroom", "子ども", "children playing with toys in a living room")] }),
      sub("home_family", "家庭", { use_cases: ["web", "advertising"], scenes: [sc("family_home", "家庭", "a family at home in a living room")] }),
      sub("childcare", "育児", { use_cases: ["blog", "web", "advertising"], scenes: [sc("childcare_kitchen", "育児", "childcare at a kitchen table with snacks")] }),
      sub("family_time", "家族団らん", { use_cases: ["web", "sns", "advertising"], scenes: [sc("dinner_table", "団らん", "a family eating together at a dining table")] }),
      sub("kids_play", "子どもの遊び", { use_cases: ["web", "sns"], scenes: [sc("park_play", "公園遊び", "children playing in a neighborhood park")] }),
    ]),
  }),
  Object.freeze({
    id: "senior",
    tier: "core",
    demand_weight: 3,
    label_ja: "シニア",
    label_en: "SENIOR",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["documentary", "candid", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("senior_daily", "高齢者の日常", { use_cases: ["web", "blog"], scenes: [sc("senior_home", "シニアの日常", "an older adult in everyday home life, dignified documentary")] }),
      sub("senior_hobby", "趣味", { use_cases: ["web", "blog"], scenes: [sc("senior_garden", "シニアの趣味", "an older adult enjoying a hobby outdoors")] }),
      sub("senior_family", "家族", { use_cases: ["web", "advertising"], scenes: [sc("multi_gen", "三世代", "an older adult with family in a living room")] }),
      sub("senior_work", "仕事", { use_cases: ["job_ad", "web"], scenes: [sc("senior_office", "シニアの仕事", "an older adult working at an office desk")] }),
      sub("senior_phone", "スマートフォン", { use_cases: ["web", "blog", "advertising"], scenes: [sc("senior_smartphone", "スマホ", "an older adult using a smartphone at a table")] }),
      sub("senior_exercise", "運動", { use_cases: ["web", "advertising"], scenes: [sc("senior_walk", "運動", "an older adult walking for exercise in a park")] }),
      sub("senior_travel", "旅行", { use_cases: ["web", "advertising"], scenes: [sc("senior_trip", "旅行", "older travelers at a station platform")] }),
      sub("senior_health", "健康的な生活", { use_cases: ["web", "blog"], scenes: [sc("senior_meal", "健康生活", "a healthy home-cooked meal with an older adult")] }),
    ]),
  }),
  Object.freeze({
    id: "finance",
    tier: "core",
    demand_weight: 6,
    label_ja: "金融・お金",
    label_en: "FINANCE / MONEY",
    people_policy: "optional",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["corporate", "minimal", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("household", "家計", { use_cases: ["web", "blog", "advertising"], scenes: [sc("budget_table", "家計", "household budgeting with a notebook and calculator at a table")] }),
      sub("saving", "貯蓄", { use_cases: ["web", "advertising"], scenes: [sc("savings_jar", "貯蓄", "saving coins in a jar beside a notebook, photorealistic")] }),
      sub("payment", "決済", { use_cases: ["web", "advertising", "sns"], scenes: [sc("card_pay", "決済", "paying at a store terminal with a card, no brand logos")] }),
      sub("creditcard", "クレジットカード", { use_cases: ["advertising", "web"], people_policy: "product_first", scenes: [sc("card_still", "カード", "a generic unbranded card on a desk")] }),
      sub("invest", "投資", { use_cases: ["web", "document", "blog"], scenes: [sc("invest_screen", "投資", "a person reviewing a generic chart on a laptop")] }),
      sub("insurance", "保険", { use_cases: ["web", "document"], scenes: [sc("insurance_talk", "保険相談", "an insurance consultation across a desk")] }),
      sub("accounting", "会計", { use_cases: ["job_ad", "document", "web"], scenes: [sc("ledger_desk", "会計", "accounting work with documents and a computer")] }),
      sub("tax", "税金", { use_cases: ["blog", "web"], scenes: [sc("tax_docs", "税務", "tax documents and a laptop on a home desk")] }),
      sub("asset", "資産形成", { use_cases: ["web", "advertising"], scenes: [sc("planning_couple", "資産形成", "two people planning finances at a kitchen table")] }),
      sub("fintech", "FinTech", { use_cases: ["web", "advertising"], scenes: [sc("fintech_app", "FinTech", "using a finance app on a smartphone, generic UI")] }),
    ]),
  }),
  Object.freeze({
    id: "logistics",
    tier: "core",
    demand_weight: 5,
    label_ja: "製造・物流",
    label_en: "MANUFACTURING / LOGISTICS",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["documentary", "corporate", "polished", "editorial"]),
    subgenres: Object.freeze([
      sub("factory", "工場", { use_cases: ["job_ad", "web", "document"], scenes: [sc("factory_floor", "工場", "a clean factory floor with machinery, photorealistic")] }),
      sub("warehouse", "倉庫", { use_cases: ["job_ad", "web"], scenes: [sc("warehouse_aisle", "倉庫", "a warehouse aisle with shelves and boxes")] }),
      sub("delivery", "配送", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("parcel_handoff", "配送", "a delivery person handing a parcel at a doorway")] }),
      sub("truck", "トラック", { use_cases: ["web", "job_ad"], scenes: [sc("loading_truck", "トラック", "loading boxes onto a truck at a depot")] }),
      sub("manufacture", "製造", { use_cases: ["job_ad", "web"], scenes: [sc("assembly_line", "製造", "an assembly line with workers in safety gear")] }),
      sub("inspection", "検品", { use_cases: ["job_ad", "web"], scenes: [sc("qc_table", "検品", "quality inspection of products on a table")] }),
      sub("packing", "梱包", { use_cases: ["job_ad", "web", "ecommerce"], scenes: [sc("pack_station", "梱包", "packing products into cardboard boxes")] }),
      sub("factory_worker", "作業員", { use_cases: ["job_ad", "web"], scenes: [sc("plant_worker", "工場作業員", "a factory worker in uniform at a workstation")] }),
      sub("logihub", "物流センター", { use_cases: ["web", "document"], scenes: [sc("fulfillment", "物流センター", "a logistics center with conveyor and parcels")] }),
    ]),
  }),
  Object.freeze({
    id: "travel",
    tier: "core",
    demand_weight: 5,
    label_ja: "旅行・自然",
    label_en: "TRAVEL / NATURE",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "documentary", "candid", "luxury"]),
    subgenres: Object.freeze([
      sub("sea", "海", { use_cases: ["web", "sns", "advertising"], scenes: [sc("coast", "海", "a Japanese coastline in clear daylight")] }),
      sub("mountain", "山", { use_cases: ["web", "sns"], scenes: [sc("mountain_trail", "山", "a mountain trail with trees and sky")] }),
      sub("citytour", "都市観光", { use_cases: ["web", "sns", "advertising"], scenes: [sc("city_street", "都市観光", "a Japanese city sightseeing street in daylight")] }),
      sub("domestic", "国内旅行", { use_cases: ["web", "advertising"], scenes: [sc("station_trip", "国内旅行", "travelers with luggage at a Japanese station")] }),
      sub("overseas", "海外旅行風景", { use_cases: ["web", "advertising"], scenes: [sc("airport_trip", "空港", "travelers walking in an airport terminal")] }),
      sub("travel_hotel", "ホテル", { use_cases: ["web", "advertising"], scenes: [sc("hotel_room", "ホテル客室", "a tidy hotel room with a made bed and window")] }),
      sub("outdoor", "アウトドア", { use_cases: ["web", "sns"], scenes: [sc("hiking", "アウトドア", "a hiking trail through woods")] }),
      sub("camping", "キャンプ", { use_cases: ["sns", "web", "advertising"], scenes: [sc("campsite", "キャンプ", "a campsite with a tent in a forest clearing")] }),
      sub("landscape", "自然風景", { use_cases: ["web", "sns", "editorial"], people_policy: "product_first", scenes: [sc("nature_vista", "自然風景", "a wide nature landscape with sky and trees, no people")] }),
    ]),
  }),
  Object.freeze({
    id: "seasonal",
    tier: "core",
    demand_weight: 6,
    label_ja: "季節・イベント",
    label_en: "SEASON / EVENT",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "candid", "polished", "luxury"]),
    subgenres: Object.freeze([
      sub("spring", "春", { use_cases: ["web", "sns", "campaign"], scenes: [sc("spring_park", "春", "a spring park with fresh greenery")] }),
      sub("summer", "夏", { use_cases: ["web", "sns", "campaign"], scenes: [sc("summer_street", "夏", "a summer street scene with strong sunlight")] }),
      sub("autumn", "秋", { use_cases: ["web", "sns"], scenes: [sc("autumn_leaves", "秋", "autumn foliage along a path")] }),
      sub("winter", "冬", { use_cases: ["web", "sns"], scenes: [sc("winter_town", "冬", "a winter town street with cold daylight")] }),
      sub("newyear", "正月", { use_cases: ["campaign", "web", "sns"], scenes: [sc("newyear_home", "正月", "a Japanese New Year home scene with simple decorations, no text")] }),
      sub("valentine", "バレンタイン", { use_cases: ["sns", "ecommerce", "campaign"], scenes: [sc("valentine_table", "バレンタイン", "handmade chocolate on a table, no logos")] }),
      sub("sakura", "桜", { use_cases: ["web", "sns", "advertising"], scenes: [sc("cherry_blossom", "桜", "cherry blossoms in a park, photorealistic")] }),
      sub("halloween", "ハロウィン", { use_cases: ["sns", "campaign"], scenes: [sc("halloween_still", "ハロウィン", "subtle Halloween still life, no text")] }),
      sub("christmas", "クリスマス", { use_cases: ["sns", "campaign", "ecommerce"], scenes: [sc("xmas_table", "クリスマス", "a Christmas table setting, no logos")] }),
      sub("yearend", "年末年始", { use_cases: ["web", "campaign"], scenes: [sc("yearend_street", "年末年始", "a Japanese year-end shopping street")] }),
      sub("wedding", "結婚式", { use_cases: ["web", "advertising", "sns"], scenes: [sc("wedding_venue", "結婚式場", "a bright wedding venue interior, no identifiable faces required")] }),
      sub("funeral", "葬儀・法要", { use_cases: ["web", "document"], scenes: [sc("memorial_calm", "法要", "a calm memorial-altar room, respectful, no logos")] }),
    ]),
  }),
  Object.freeze({
    id: "sports",
    tier: "core",
    demand_weight: 4,
    label_ja: "スポーツ",
    label_en: "SPORTS / FITNESS",
    people_policy: "typical",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["documentary", "candid", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("running", "ランニング", { use_cases: ["web", "sns", "advertising"], scenes: [sc("morning_run", "ランニング", "a person running on a riverside path")] }),
      sub("gym", "ジム", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("gym_floor", "ジム", "a gym floor with equipment, photorealistic")] }),
      sub("soccer", "サッカー", { use_cases: ["web", "sns"], scenes: [sc("soccer_field", "サッカー", "a soccer practice on a field")] }),
      sub("baseball", "野球", { use_cases: ["web", "sns"], scenes: [sc("baseball_ground", "野球", "baseball practice on a dirt infield")] }),
      sub("basketball", "バスケットボール", { use_cases: ["web", "sns"], scenes: [sc("basket_court", "バスケ", "a basketball court with a player dribbling")] }),
      sub("yoga", "ヨガ", { use_cases: ["web", "sns", "advertising"], scenes: [sc("yoga_room", "ヨガ", "a yoga pose in a bright studio")] }),
      sub("workout", "トレーニング", { use_cases: ["web", "sns"], scenes: [sc("bodyweight", "トレーニング", "bodyweight training in a park")] }),
      sub("outdoorsports", "アウトドアスポーツ", { use_cases: ["web", "sns"], scenes: [sc("cycling", "サイクリング", "cycling on a suburban road")] }),
    ]),
  }),
  Object.freeze({
    id: "environment",
    tier: "core",
    demand_weight: 3,
    label_ja: "環境・エネルギー",
    label_en: "ENVIRONMENT / ENERGY",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["editorial", "documentary", "minimal", "corporate"]),
    subgenres: Object.freeze([
      sub("solar", "太陽光", { use_cases: ["web", "document"], scenes: [sc("solar_roof", "太陽光", "rooftop solar panels on a house in daylight")] }),
      sub("ev", "EV", { use_cases: ["web", "advertising"], scenes: [sc("ev_charge", "EV充電", "an electric car at a charging station, no brand logos")] }),
      sub("renewable", "再生可能エネルギー", { use_cases: ["web", "document"], scenes: [sc("wind_farm", "再エネ", "wind turbines in a rural landscape")] }),
      sub("energy_save", "省エネ", { use_cases: ["web", "blog"], scenes: [sc("led_home", "省エネ", "an energy-efficient home interior with LED lighting")] }),
      sub("eco", "エコ", { use_cases: ["web", "sns", "advertising"], scenes: [sc("recycle_bin", "エコ", "recycling bins in a tidy outdoor area")] }),
      sub("sustain", "サステナビリティ", { use_cases: ["web", "document"], scenes: [sc("green_office", "サステナ", "a green office with plants and daylight")] }),
      sub("conservation", "自然保護", { use_cases: ["web", "editorial"], scenes: [sc("forest_path", "自然保護", "a conserved forest path")] }),
    ]),
  }),
  Object.freeze({
    id: "pet",
    tier: "supporting",
    demand_weight: 3,
    label_ja: "ペット・動物",
    label_en: "PET / ANIMAL",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["candid", "editorial", "polished", "documentary"]),
    subgenres: Object.freeze([
      sub("dog", "犬", { use_cases: ["web", "sns", "advertising"], scenes: [sc("dog_walk", "犬", "a dog on a leash during a neighborhood walk")] }),
      sub("cat", "猫", { use_cases: ["web", "sns"], scenes: [sc("cat_window", "猫", "a cat sitting by a home window")] }),
      sub("smallpet", "小動物", { use_cases: ["web", "sns"], scenes: [sc("rabbit_home", "小動物", "a small pet in a clean home setting")] }),
      sub("pet_life", "ペットとの生活", { use_cases: ["web", "advertising"], scenes: [sc("pet_sofa", "ペット生活", "a person relaxing with a pet on a sofa")] }),
      sub("petshop", "ペットショップ", { use_cases: ["web", "job_ad"], scenes: [sc("pet_store", "ペットショップ", "a pet shop aisle with supplies, no logos")] }),
      sub("vet", "動物病院", { use_cases: ["web", "advertising"], scenes: [sc("vet_clinic", "動物病院", "a veterinary clinic exam table, photorealistic")] }),
    ]),
  }),
  Object.freeze({
    id: "housework",
    tier: "supporting",
    demand_weight: 3,
    label_ja: "清掃・家事",
    label_en: "CLEANING / HOUSEWORK",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["candid", "editorial", "polished", "corporate"]),
    subgenres: Object.freeze([
      sub("cleaning", "掃除", { use_cases: ["web", "advertising", "job_ad"], scenes: [sc("room_clean", "掃除", "cleaning a living room floor, photorealistic")] }),
      sub("laundry", "洗濯", { use_cases: ["web", "blog", "advertising"], scenes: [sc("laundry_room", "洗濯", "laundry in a home laundry area")] }),
      sub("kitchen_clean", "キッチン清掃", { use_cases: ["web", "advertising"], scenes: [sc("sink_clean", "キッチン清掃", "cleaning a kitchen sink and counter")] }),
      sub("houseclean", "ハウスクリーニング", { use_cases: ["web", "job_ad"], scenes: [sc("pro_clean", "ハウスクリーニング", "a professional cleaner wiping a window")] }),
      sub("tidying", "整理収納", { use_cases: ["blog", "web", "sns"], scenes: [sc("closet_tidy", "整理収納", "a tidy closet with organized clothes")] }),
      sub("chores", "家事", { use_cases: ["web", "blog"], scenes: [sc("home_chores", "家事", "everyday housework in a kitchen")] }),
      sub("hygiene", "衛生", { use_cases: ["web", "advertising"], scenes: [sc("handwash", "衛生", "washing hands at a sink")] }),
    ]),
  }),
  Object.freeze({
    id: "transport",
    tier: "supporting",
    demand_weight: 3,
    label_ja: "交通・公共",
    label_en: "TRANSPORT / PUBLIC INFRASTRUCTURE",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["documentary", "editorial", "corporate", "candid"]),
    subgenres: Object.freeze([
      sub("train", "電車", { use_cases: ["web", "blog"], scenes: [sc("train_platform", "電車", "a Japanese train platform in daylight")] }),
      sub("bus", "バス", { use_cases: ["web"], scenes: [sc("bus_stop", "バス", "a city bus at a bus stop")] }),
      sub("car", "自動車", { use_cases: ["web", "advertising"], scenes: [sc("city_car", "自動車", "a car on a city street, no brand emphasis")] }),
      sub("road", "道路", { use_cases: ["web", "document"], scenes: [sc("highway", "道路", "a highway in daylight")] }),
      sub("station", "駅", { use_cases: ["web", "advertising"], scenes: [sc("station_concourse", "駅", "a station concourse with ticket gates")] }),
      sub("airport", "空港", { use_cases: ["web", "advertising"], scenes: [sc("airport_hall", "空港", "an airport departure hall")] }),
      sub("bicycle", "自転車", { use_cases: ["web", "sns"], scenes: [sc("city_bike", "自転車", "a bicycle parked on a residential street")] }),
      sub("public_facility", "公共施設", { use_cases: ["web", "document"], scenes: [sc("city_hall", "公共施設", "a public building entrance")] }),
    ]),
  }),
  Object.freeze({
    id: "safety",
    tier: "supporting",
    demand_weight: 2,
    label_ja: "防災・安全",
    label_en: "SAFETY / DISASTER PREVENTION",
    people_policy: "optional",
    copy_space_bias: "medium",
    allowed_styles: Object.freeze(["documentary", "corporate", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("bosai", "防災", { use_cases: ["web", "document", "campaign"], scenes: [sc("emergency_kit", "防災", "an emergency kit on a tatami or floor, photorealistic")] }),
      sub("evacuation", "避難", { use_cases: ["web", "document"], scenes: [sc("evac_drill", "避難", "an evacuation drill in a schoolyard")] }),
      sub("crime_prev", "防犯", { use_cases: ["web", "advertising"], scenes: [sc("door_lock", "防犯", "locking a front door from inside")] }),
      sub("fire", "消防", { use_cases: ["web", "job_ad"], scenes: [sc("fire_station", "消防", "a fire station exterior with an engine")] }),
      sub("earthquake", "地震対策", { use_cases: ["web", "blog"], scenes: [sc("secure_furniture", "地震対策", "furniture secured in a living room")] }),
      sub("stockpile", "備蓄", { use_cases: ["web", "blog", "ecommerce"], scenes: [sc("water_stock", "備蓄", "bottled water and supplies stored neatly")] }),
      sub("safety_check", "安全確認", { use_cases: ["web", "document"], scenes: [sc("site_check", "安全確認", "a safety check with a helmet and clipboard")] }),
      sub("security_guard", "セキュリティ", { use_cases: ["job_ad", "web"], scenes: [sc("guard_lobby", "セキュリティ", "a security desk in a building lobby")] }),
    ]),
  }),
  Object.freeze({
    id: "legal",
    tier: "supporting",
    demand_weight: 2,
    label_ja: "法律・士業・専門サービス",
    label_en: "LEGAL / PROFESSIONAL SERVICES",
    people_policy: "typical",
    copy_space_bias: "high",
    allowed_styles: Object.freeze(["corporate", "minimal", "editorial", "polished"]),
    subgenres: Object.freeze([
      sub("lawyer", "弁護士", { use_cases: ["web", "advertising"], scenes: [sc("law_office", "弁護士", "a lawyer consulting a client in a calm office")] }),
      sub("tax_accountant", "税理士", { use_cases: ["web", "advertising"], scenes: [sc("tax_office", "税理士", "a tax accountant at a desk with documents")] }),
      sub("cpa", "会計士", { use_cases: ["web", "job_ad"], scenes: [sc("audit_desk", "会計士", "an accountant reviewing files in an office")] }),
      sub("admin_scrivener", "行政書士", { use_cases: ["web"], scenes: [sc("scrivener_desk", "行政書士", "an administrative scrivener office with forms")] }),
      sub("consultant", "コンサルタント", { use_cases: ["web", "job_ad"], scenes: [sc("consult_meeting", "コンサルタント", "a consultant presenting papers in a meeting")] }),
      sub("contract", "契約", { use_cases: ["web", "document"], scenes: [sc("contract_sign", "契約", "signing documents at a meeting table")] }),
      sub("legal_affairs", "法務", { use_cases: ["job_ad", "document", "web"], scenes: [sc("legal_team", "法務", "a corporate legal team at a conference table")] }),
      sub("consult", "相談", { use_cases: ["web", "advertising"], scenes: [sc("advice_desk", "相談", "a professional consultation across a desk")] }),
    ]),
  }),
]);

export const IMAGE_CORE_GENRE_COUNT = IMAGE_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const IMAGE_SUPPORTING_GENRE_COUNT = IMAGE_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;
export const IMAGE_QA_CORE_GENRES = Object.freeze([
  "business",
  "housing",
  "food",
  "healthcare",
  "technology",
  "product",
  "recruitment",
  "beauty",
]);

const GENRE_BY_ID = new Map(IMAGE_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const genre of IMAGE_DEMAND_GENRES) {
  for (const sgItem of genre.subgenres) {
    SUB_BY_ID.set(sgItem.id, { genre, subgenre: sgItem });
    for (const scene of sgItem.scenes) {
      SCENE_BY_ID.set(scene.id, { genre, subgenre: sgItem, scene });
    }
  }
}

export function listImageSubgenres() {
  return IMAGE_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}

export function getImageGenre(id) {
  return GENRE_BY_ID.get(String(id || "")) || null;
}

export function getImageSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function getImageScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateImageGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const genre of IMAGE_DEMAND_GENRES) {
    if (!genre.id || genreIds.has(genre.id) || /-/.test(genre.id)) issues.push(`bad_genre:${genre.id}`);
    genreIds.add(genre.id);
    if (!genre.allowed_styles?.length) issues.push(`no_styles:${genre.id}`);
    if (!Number.isFinite(genre.demand_weight)) issues.push(`no_weight:${genre.id}`);
    for (const style of genre.allowed_styles || []) {
      if (!IMAGE_STYLE_CATALOG[style]) issues.push(`unknown_style:${genre.id}:${style}`);
    }
    for (const sgItem of genre.subgenres) {
      if (!sgItem.id || subIds.has(sgItem.id)) issues.push(`duplicate_or_empty_sub:${sgItem.id}`);
      subIds.add(sgItem.id);
      if (!sgItem.use_cases?.length) issues.push(`missing_use_case:${sgItem.id}`);
      for (const uc of sgItem.use_cases) {
        if (!IMAGE_USE_CASES[uc]) issues.push(`unknown_use:${sgItem.id}:${uc}`);
      }
      if (!sgItem.scenes?.length) issues.push(`no_scene:${sgItem.id}`);
      for (const scene of sgItem.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`duplicate_or_empty_scene:${scene.id}`);
        sceneIds.add(scene.id);
        if (!scene.prompt_en) issues.push(`no_prompt:${scene.id}`);
      }
    }
  }
  if (IMAGE_DEMAND_GENRES.length !== 25) issues.push(`genre_count:${IMAGE_DEMAND_GENRES.length}`);
  if (IMAGE_CORE_GENRE_COUNT !== 20) issues.push(`core_count:${IMAGE_CORE_GENRE_COUNT}`);
  if (IMAGE_SUPPORTING_GENRE_COUNT !== 5) issues.push(`supporting_count:${IMAGE_SUPPORTING_GENRE_COUNT}`);
  const seasonal = getImageGenre("seasonal");
  const ceremonial = (seasonal?.subgenres || []).filter((s) => s.id === "wedding" || s.id === "funeral");
  if (ceremonial.length !== 2) issues.push("ceremonial_not_under_seasonal");
  return {
    ok: issues.length === 0,
    issues,
    core: IMAGE_CORE_GENRE_COUNT,
    supporting: IMAGE_SUPPORTING_GENRE_COUNT,
    genres: IMAGE_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

export function imageSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.scene || spec?.scene_id,
    spec?.composition,
    spec?.orientation,
    spec?.people_presence,
    spec?.style,
    spec?.copy_space,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

const STYLE_JA = Object.fromEntries(Object.values(IMAGE_STYLE_CATALOG).map((s) => [s.id, s.label_ja]));
const ORIENT_JA = { landscape: "横", portrait: "縦", square: "正方形" };
const COPY_JA = {
  none: "",
  left: "左余白",
  right: "右余白",
  top: "上余白",
  bottom: "下余白",
  center_safe: "中央安全",
};
const PEOPLE_JA = { present: "人物あり", absent: "人物なし" };
const COUNT_JA = { solo: "一人", pair: "二人", smallgroup: "少人数", crowd: "グループ", nobody: "" };
const COMP_JA = {
  wide: "ワイド",
  mediumshot: "ミディアム",
  closeup: "クローズアップ",
  overhead: "俯瞰",
  environmental: "環境",
};

export function buildImageJapaneseTitle(spec) {
  const found = getImageScene(spec.scene) || getImageSubgenre(spec.subcategory);
  const sceneLabel = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "画像";
  const bits = [];
  if (spec.people_presence === "present" && spec.people_count && COUNT_JA[spec.people_count]) {
    bits.push(COUNT_JA[spec.people_count]);
  } else if (spec.people_presence === "absent") {
    bits.push("静物");
  }
  if (COPY_JA[spec.copy_space]) bits.push(COPY_JA[spec.copy_space]);
  if (spec.orientation && spec.orientation !== "landscape") bits.push(ORIENT_JA[spec.orientation] || "");
  const attr = bits.filter(Boolean).join("・");
  let title = attr ? `${sceneLabel}（${attr}）` : sceneLabel;
  if (title.length > 28) title = sceneLabel;
  return title.slice(0, 32);
}

export function buildImageDescription(spec) {
  const found = getImageScene(spec.scene);
  const genre = getImageGenre(spec.genre);
  const parts = [
    found?.scene?.label_ja || spec.subcategory,
    genre?.label_ja,
    spec.use_case && IMAGE_USE_CASES[spec.use_case]?.label_ja,
    spec.people_presence === "present" ? PEOPLE_JA.present : PEOPLE_JA.absent,
    ORIENT_JA[spec.orientation],
    STYLE_JA[spec.style],
  ].filter(Boolean);
  return parts.join(" / ").slice(0, 120);
}

function peopleClause(spec) {
  if (spec.people_presence === "absent") {
    return "no people, no faces, no hands in frame";
  }
  const count = {
    solo: "one person",
    pair: "two people",
    smallgroup: "a small group of three to four people",
    crowd: "a group of people",
    nobody: "no people",
  }[spec.people_count] || "people present";
  const age = {
    child: "including a child",
    young_adult: "young adults",
    adult: "working-age adults",
    senior: "older adults",
    mixed: "mixed ages",
  }[spec.age_context] || "natural everyday appearance";
  return `${count}, ${age}, photorealistic, candid posture, no celebrity likeness`;
}

function copyClause(spec) {
  if (!spec.copy_space || spec.copy_space === "none") return "full-bleed composition";
  if (spec.copy_space === "center_safe") return "subject kept away from the exact center so text can sit safely";
  return `clear empty copy space on the ${spec.copy_space} for headline text, no letters in the image`;
}

export function buildImagePromptText(spec) {
  const found = getImageScene(spec.scene);
  const sceneEn = found?.scene?.prompt_en || "a photorealistic stock scene";
  const orientEn = {
    landscape: "horizontal 16:9 framing",
    portrait: "vertical 9:16 framing",
    square: "1:1 square framing",
  }[spec.orientation] || "balanced framing";
  const compEn = {
    wide: "wide establishing shot",
    mediumshot: "medium shot",
    closeup: "close-up",
    overhead: "overhead angle",
    environmental: "environmental wide shot with context",
  }[spec.composition] || "medium shot";
  const tokens = [
    "TASFUL_IMG_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `style=${spec.style || ""}`,
    `orient=${spec.orientation || ""}`,
    `comp=${spec.composition || ""}`,
    `fmt=${spec.format || "png"}`,
  ].join(" ");
  return [
    tokens,
    "::",
    `Photorealistic commercial stock photograph of ${sceneEn}`,
    peopleClause(spec),
    `${compEn}, ${orientEn}`,
    copyClause(spec),
    `${spec.lighting} lighting, ${spec.style} photographic style, ${spec.color_family} color palette`,
    "no text, no watermark, no logos, no UI overlay, natural photography",
  ].join(", ");
}

export function resolveImagePeoplePolicy(genre, subgenre) {
  return subgenre?.people_policy || genre?.people_policy || "optional";
}

export function drivePathForImageSpec(spec) {
  const genre = spec.genre;
  const subPath = String(spec.subcategory || "").replace(/_/g, "-");
  const ratio = IMAGE_ORIENTATION_RATIO[spec.orientation] || "16-9";
  return `画像素材/${genre}/${subPath}/${ratio}`;
}

export function slugForImageSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const sub = String(spec.subcategory || "").replace(/_/g, "-");
  const scene = String(spec.scene || "").replace(/_/g, "-");
  const copy = spec.copy_space === "center_safe" ? "center-safe" : spec.copy_space;
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    sub,
    scene,
    spec.use_case?.replace(/_/g, "-"),
    spec.people_presence,
    spec.people_count,
    spec.composition,
    spec.orientation,
    copy,
    spec.style,
    spec.lighting,
    spec.color_family,
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
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const t = tokens[i];
    const snake = t.replace(/-/g, "_");
    if (set.has(t) || set.has(snake)) {
      tokens.splice(i, 1);
      return set.has(snake) && !set.has(t) ? snake : set.has(t) ? t : snake;
    }
  }
  return "";
}

export function parseImageSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const color_family = takeKnownFromRight(tokens, new Set(IMAGE_COLOR_FAMILIES));
  const lighting = takeKnownFromRight(tokens, new Set(IMAGE_LIGHTING));
  const style = takeKnownFromRight(tokens, new Set(Object.keys(IMAGE_STYLE_CATALOG)));
  let copy_space = "";
  if (tokens[tokens.length - 1] === "safe" && tokens[tokens.length - 2] === "center") {
    tokens.splice(-2, 2);
    copy_space = "center_safe";
  } else {
    copy_space = takeKnownFromRight(tokens, new Set(["none", "left", "right", "top", "bottom"]));
  }
  const orientation = takeKnownFromRight(tokens, new Set(IMAGE_ORIENTATIONS));
  const composition = takeKnownFromRight(tokens, new Set(IMAGE_COMPOSITIONS));
  const people_count = takeKnownFromRight(tokens, new Set(IMAGE_PEOPLE_COUNTS));
  const people_presence = takeKnownFromRight(tokens, new Set(IMAGE_PEOPLE_PRESENCE));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(IMAGE_USE_CASES)));
  const genre = IMAGE_DEMAND_GENRES.find((g) => g.id === tokens[0])?.id || tokens[0] || "";
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
    people_presence,
    people_count,
    composition,
    orientation,
    copy_space: copy_space || "none",
    style,
    lighting,
    color_family,
  };
}

export function parseImageSpecFromPath({ categoryPath = [], slug = "", promptText = "", metadata = {} } = {}) {
  if (metadata?.genre && metadata?.scene && metadata?.orientation) {
    return {
      genre: String(metadata.genre),
      subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
      scene: String(metadata.scene).replace(/-/g, "_"),
      use_case: String(metadata.use_case || ""),
      people_presence: String(metadata.people_presence || metadata.target || ""),
      people_count: String(metadata.people_count || ""),
      composition: String(metadata.composition || metadata.layout || ""),
      orientation: String(metadata.orientation || ""),
      copy_space: String(metadata.copy_space || ""),
      style: String(metadata.style || ""),
      lighting: String(metadata.lighting || ""),
      color_family: String(metadata.color_family || ""),
      title: metadata.title || "",
    };
  }
  const fromSlug = parseImageSlugParts(slug);
  const segs = (categoryPath || []).map((s) => String(s));
  const genreId = fromSlug.genre || String(segs[0] || "").replace(/-/g, "_");
  const subId = fromSlug.subcategory || String(segs[1] || "").replace(/-/g, "_");
  const found = getImageSubgenre(subId);
  const sceneFound = getImageScene(fromSlug.scene);
  const genre = getImageGenre(genreId);
  if (!found && !genre) return null;
  const spec = {
    genre: found?.genre.id || genreId,
    subcategory: found?.subgenre.id || subId,
    scene: sceneFound?.scene.id || found?.subgenre.scenes[0]?.id || fromSlug.scene,
    use_case: fromSlug.use_case || found?.subgenre.use_cases[0] || "web",
    people_presence: fromSlug.people_presence || "absent",
    people_count: fromSlug.people_count || "nobody",
    composition: fromSlug.composition || "mediumshot",
    orientation: fromSlug.orientation || "landscape",
    copy_space: fromSlug.copy_space || "none",
    style: fromSlug.style || genre?.allowed_styles?.[0] || "corporate",
    lighting: fromSlug.lighting || "daylight",
    color_family: fromSlug.color_family || "neutral",
    promptText,
  };
  spec.title = buildImageJapaneseTitle(spec);
  spec.description = buildImageDescription(spec);
  spec.prompt = buildImagePromptText(spec);
  return spec;
}

export function imageSpecToMetadata(spec) {
  const seasonal = spec.genre === "seasonal" ? spec.subcategory : "";
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    scene: spec.scene || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    layout: spec.composition || "",
    composition: spec.composition || "",
    orientation: spec.orientation || "",
    color_family: spec.color_family || "",
    target: spec.people_presence || "",
    people_presence: spec.people_presence || "",
    people_count: spec.people_count || "",
    copy_space: spec.copy_space || "",
    lighting: spec.lighting || "",
    season: seasonal,
    category: spec.genre || "",
  };
}

export function classifyLegacyImageItem(item) {
  const hay = [
    item.subcategory,
    item.genre,
    item.use_case,
    ...(item.tags || []),
    item.title,
    item.slug,
  ]
    .map((x) => String(x || ""))
    .join(" ");
  const hits = new Set();
  for (const row of IMAGE_LEGACY_UI_USAGE_MAP) {
    if (hay.toLowerCase().includes(String(row.legacy).toLowerCase())) {
      row.genre_ids.forEach((g) => hits.add(g));
    }
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}
