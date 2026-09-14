/**
 * Background Demand Genre SSOT V1 — Web / video / live / ads / SNS / docs / EC.
 * Does not copy Image photo or Illustration object taxonomy.
 * Empty scenes only (no people). Copy-space is a first-class axis.
 */
export const BACKGROUND_DEMAND_GENRE_SSOT_VERSION = "materials-background-demand-genre-ssot-v1";

export const BACKGROUND_TYPES = Object.freeze({
  gradient: { id: "gradient", slug: "tpgrad", label_ja: "グラデーション" },
  pattern: { id: "pattern", slug: "tppat", label_ja: "パターン" },
  texture: { id: "texture", slug: "tptex", label_ja: "テクスチャ" },
  photo_like: { id: "photo_like", slug: "tpphoto", label_ja: "風景調" },
  abstract: { id: "abstract", slug: "tpabs", label_ja: "抽象" },
  geometric: { id: "geometric", slug: "tpgeo", label_ja: "幾何" },
  scenic: { id: "scenic", slug: "tpscenic", label_ja: "風景" },
  studio: { id: "studio", slug: "tpstudio", label_ja: "スタジオ" },
  decorative: { id: "decorative", slug: "tpdec", label_ja: "装飾" },
  minimal: { id: "minimal", slug: "tpmin", label_ja: "ミニマル" },
});

export const BACKGROUND_STYLES = Object.freeze({
  clean: { id: "clean", label_ja: "クリーン" },
  soft: { id: "soft", label_ja: "ソフト" },
  vivid: { id: "vivid", label_ja: "ビビッド" },
  muted: { id: "muted", label_ja: "落ち着いた" },
  elegant: { id: "elegant", label_ja: "エレガント" },
  luxstyle: { id: "luxstyle", label_ja: "ラグジュアリー" },
  cutestyle: { id: "cutestyle", label_ja: "かわいい" },
  corporate: { id: "corporate", label_ja: "コーポレート" },
  futuristic: { id: "futuristic", label_ja: "フューチャー" },
  natural: { id: "natural", label_ja: "ナチュラル" },
  cinematic: { id: "cinematic", label_ja: "シネマ" },
  playful: { id: "playful", label_ja: "プレイフル" },
});

export const BACKGROUND_COLORS = Object.freeze({
  white: { id: "white", slug: "cfwhite", label_ja: "白" },
  black: { id: "black", slug: "cfblack", label_ja: "黒" },
  gray: { id: "gray", slug: "cfgray", label_ja: "グレー" },
  blue: { id: "blue", slug: "cfblue", label_ja: "青" },
  navy: { id: "navy", slug: "cfnavy", label_ja: "ネイビー" },
  green: { id: "green", slug: "cfgreen", label_ja: "緑" },
  red: { id: "red", slug: "cfred", label_ja: "赤" },
  orange: { id: "orange", slug: "cforange", label_ja: "オレンジ" },
  yellow: { id: "yellow", slug: "cfyellow", label_ja: "黄" },
  pink: { id: "pink", slug: "cfpink", label_ja: "ピンク" },
  purple: { id: "purple", slug: "cfpurple", label_ja: "紫" },
  brown: { id: "brown", slug: "cfbrown", label_ja: "茶" },
  beige: { id: "beige", slug: "cfbeige", label_ja: "ベージュ" },
  pastel: { id: "pastel", slug: "cfpastel", label_ja: "パステル" },
  multicolor: { id: "multicolor", slug: "cfmulti", label_ja: "マルチ" },
});

export const BACKGROUND_BRIGHTNESS = Object.freeze({
  light: { id: "light", slug: "brlight", label_ja: "明るい" },
  medium: { id: "medium", slug: "brmedium", label_ja: "中間" },
  dark: { id: "dark", slug: "brdark", label_ja: "暗い" },
});

export const BACKGROUND_COMPLEXITY = Object.freeze({
  minimal: { id: "minimal", slug: "cxmin", label_ja: "最小" },
  low: { id: "low", slug: "cxlow", label_ja: "低" },
  medium: { id: "medium", slug: "cxmed", label_ja: "中" },
  rich: { id: "rich", slug: "cxrich", label_ja: "高密度" },
});

export const BACKGROUND_COPY_SPACES = Object.freeze({
  none: { id: "none", slug: "csnone", label_ja: "全面" },
  left: { id: "left", slug: "csleft", label_ja: "左余白" },
  right: { id: "right", slug: "csright", label_ja: "右余白" },
  center: { id: "center", slug: "cscenter", label_ja: "中央余白" },
  top: { id: "top", slug: "cstop", label_ja: "上余白" },
  bottom: { id: "bottom", slug: "csbottom", label_ja: "下余白" },
  wide_center: { id: "wide_center", slug: "cswide", label_ja: "広い中央余白" },
});

export const BACKGROUND_ORIENTATIONS = Object.freeze(["landscape", "portrait", "square"]);

export const BACKGROUND_USE_CASES = Object.freeze({
  hero: { id: "hero", label_ja: "Web Hero", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 80, portrait: 5, square: 15 } },
  presentation: { id: "presentation", label_ja: "プレゼン", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 85, portrait: 5, square: 10 } },
  youtube: { id: "youtube", label_ja: "YouTube", copy: "high", complexity: ["low", "medium"], orientation: { landscape: 85, portrait: 5, square: 10 } },
  sns: { id: "sns", label_ja: "SNS", copy: "high", complexity: ["low", "medium"], orientation: { landscape: 15, portrait: 40, square: 45 } },
  livestream: { id: "livestream", label_ja: "配信", copy: "high", complexity: ["low", "medium"], orientation: { landscape: 80, portrait: 10, square: 10 } },
  productshow: { id: "productshow", label_ja: "商品展示", copy: "medium", complexity: ["minimal", "low"], orientation: { landscape: 40, portrait: 15, square: 45 } },
  ecommerce: { id: "ecommerce", label_ja: "ECバナー", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 50, portrait: 10, square: 40 } },
  advertising: { id: "advertising", label_ja: "広告", copy: "high", complexity: ["low", "medium"], orientation: { landscape: 45, portrait: 25, square: 30 } },
  blog: { id: "blog", label_ja: "ブログヘッダー", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 80, portrait: 5, square: 15 } },
  titlecard: { id: "titlecard", label_ja: "タイトルカード", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 75, portrait: 15, square: 10 } },
  overlay: { id: "overlay", label_ja: "文字載せ", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 70, portrait: 15, square: 15 } },
  poster: { id: "poster", label_ja: "ポスター", copy: "high", complexity: ["low", "medium"], orientation: { landscape: 20, portrait: 70, square: 10 } },
  menu: { id: "menu", label_ja: "メニュー", copy: "medium", complexity: ["low", "medium"], orientation: { landscape: 40, portrait: 20, square: 40 } },
  document: { id: "document", label_ja: "資料", copy: "high", complexity: ["minimal", "low"], orientation: { landscape: 85, portrait: 5, square: 10 } },
});

/** Audit-only. Never auto-FILL inventory. Unique Japanese subcategory hits only. */
export const BACKGROUND_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "グラデーション", genre_ids: ["gradient"] },
  { legacy: "シンプル", genre_ids: ["minimal"] },
  { legacy: "ビジネス", genre_ids: ["business"] },
  { legacy: "サイバー", genre_ids: ["technology"] },
  { legacy: "自然", genre_ids: ["nature"] },
  { legacy: "季節", genre_ids: ["seasonal"] },
  { legacy: "宇宙", genre_ids: ["space"] },
  { legacy: "イベント", genre_ids: ["seasonal"] },
]);

function sc(id, labelJa, promptEn) {
  return Object.freeze({ id, path_id: id.replace(/_/g, "-"), label_ja: labelJa, prompt_en: promptEn });
}
function sub(id, labelJa, extra = {}) {
  return Object.freeze({
    id,
    path_id: id.replace(/_/g, "-"),
    label_ja: labelJa,
    use_cases: Object.freeze(extra.use_cases || ["hero", "overlay"]),
    scenes: Object.freeze(extra.scenes || [sc(`${id}_sc`, labelJa, extra.prompt_en || `an empty ${labelJa} backdrop`)]),
    allowed_types: extra.allowed_types ? Object.freeze(extra.allowed_types) : null,
    allowed_styles: extra.allowed_styles ? Object.freeze(extra.allowed_styles) : null,
    allowed_colors: extra.allowed_colors ? Object.freeze(extra.allowed_colors) : null,
  });
}
function genre(id, tier, weight, ja, en, types, styles, colors, subs) {
  return Object.freeze({
    id,
    tier,
    demand_weight: weight,
    label_ja: ja,
    label_en: en,
    allowed_types: Object.freeze(types),
    allowed_styles: Object.freeze(styles),
    allowed_colors: Object.freeze(colors),
    subgenres: Object.freeze(subs),
  });
}

const CORP = ["clean", "corporate", "muted", "soft"];
const FUT = ["futuristic", "vivid", "corporate", "cinematic"];
const SOFT = ["soft", "clean", "muted", "natural"];
const POP = ["cutestyle", "playful", "vivid", "soft"];
const LUX = ["luxstyle", "elegant", "muted", "cinematic"];
const NAT = ["natural", "soft", "cinematic", "muted"];
const CINE = ["cinematic", "muted", "vivid", "futuristic"];

const BLUE = ["blue", "navy", "gray", "white"];
const PASTEL = ["pastel", "pink", "beige", "white"];
const DARK = ["black", "navy", "purple", "gray"];
const EARTH = ["beige", "brown", "green", "white"];
const NEON = ["purple", "blue", "red", "black"];

export const BACKGROUND_DEMAND_GENRES = Object.freeze([
  genre("gradient", "core", 10, "グラデーション", "GRADIENT", ["gradient"], ["soft", "vivid", "corporate", "futuristic"], ["blue", "purple", "pink", "orange", "green", "gray", "pastel", "multicolor"], [
    sub("grd_blue", "青", { use_cases: ["hero", "livestream", "overlay"], scenes: [sc("blue_wash", "青グラデ", "a smooth blue gradient wash")] }),
    sub("grd_purple", "紫", { use_cases: ["hero", "sns", "livestream"], scenes: [sc("purple_wash", "紫グラデ", "a smooth purple gradient wash")] }),
    sub("grd_pink", "ピンク", { use_cases: ["sns", "advertising"], scenes: [sc("pink_wash", "ピンクグラデ", "a soft pink gradient wash")] }),
    sub("grd_orange", "オレンジ", { use_cases: ["youtube", "advertising"], scenes: [sc("orange_wash", "オレンジグラデ", "a warm orange gradient wash")] }),
    sub("grd_green", "緑", { use_cases: ["hero", "blog"], scenes: [sc("green_wash", "緑グラデ", "a calm green gradient wash")] }),
    sub("grd_mono", "モノクロ", { use_cases: ["document", "presentation"], scenes: [sc("mono_wash", "モノクログラデ", "a monochrome gray gradient")] }),
    sub("grd_dark", "ダーク", { use_cases: ["livestream", "titlecard"], scenes: [sc("dark_wash", "ダークグラデ", "a dark navy-to-black gradient")] }),
    sub("grd_pastel", "パステル", { use_cases: ["sns", "hero"], scenes: [sc("pastel_wash", "パステルグラデ", "a pastel multi-stop gradient")] }),
    sub("grd_vivid", "ビビッド", { use_cases: ["advertising", "sns"], scenes: [sc("vivid_wash", "ビビッドグラデ", "a vivid saturated gradient")] }),
    sub("grd_mesh", "メッシュ", { use_cases: ["hero", "advertising"], scenes: [sc("mesh_grad", "メッシュグラデ", "a mesh gradient with soft blobs")] }),
    sub("grd_aurora", "オーロラ", { use_cases: ["youtube", "livestream"], scenes: [sc("aurora_grad", "オーロラグラデ", "an aurora-like flowing gradient")] }),
    sub("grd_soft", "ソフト", { use_cases: ["overlay", "document"], scenes: [sc("soft_grad", "ソフトグラデ", "a very soft low-contrast gradient")] }),
  ]),
  genre("minimal", "core", 10, "シンプル・ミニマル", "SIMPLE / MINIMAL", ["minimal", "gradient"], CORP, ["white", "gray", "beige", "black", "navy"], [
    sub("min_white", "白", { use_cases: ["hero", "productshow", "document"], scenes: [sc("white_studio", "白背景", "a clean white studio wall")] }),
    sub("min_gray", "ライトグレー", { use_cases: ["presentation", "document"], scenes: [sc("light_gray", "グレー", "a light gray empty backdrop")] }),
    sub("min_beige", "ベージュ", { use_cases: ["hero", "blog"], scenes: [sc("beige_wall", "ベージュ", "a warm beige empty wall")] }),
    sub("min_dark", "ダーク", { use_cases: ["titlecard", "livestream"], scenes: [sc("dark_empty", "ダーク無地", "a dark empty studio")] }),
    sub("min_clean", "クリーン", { use_cases: ["hero", "overlay"], scenes: [sc("clean_plain", "クリーン", "an ultra-clean plain backdrop")] }),
    sub("min_soft", "ソフト", { use_cases: ["overlay", "blog"], scenes: [sc("soft_plain", "ソフト無地", "a soft slightly shaded plain")] }),
    sub("min_neutral", "ニュートラル", { use_cases: ["document", "presentation"], scenes: [sc("neutral_plain", "ニュートラル", "a neutral off-white backdrop")] }),
    sub("min_shadow", "淡い影", { use_cases: ["productshow", "ecommerce"], scenes: [sc("subtle_shadow", "淡い影", "a plain backdrop with a subtle floor shadow")] }),
    sub("min_depth", "ゆるい奥行き", { use_cases: ["hero", "youtube"], scenes: [sc("gentle_depth", "奥行き", "a plain backdrop with gentle depth fog")] }),
    sub("min_geo", "ミニマル幾何", { use_cases: ["hero", "presentation"], scenes: [sc("min_geo_shape", "幾何", "a nearly empty field with one faint geometric shape")] }),
  ]),
  genre("abstract", "core", 9, "抽象", "ABSTRACT", ["abstract", "gradient"], ["soft", "futuristic", "cinematic", "vivid"], ["blue", "purple", "pastel", "multicolor", "navy"], [
    sub("abs_fluid", "流体", { use_cases: ["hero", "advertising"], scenes: [sc("fluid_flow", "流体", "abstract fluid color flow")] }),
    sub("abs_wave", "ウェーブ", { use_cases: ["hero", "youtube"], scenes: [sc("wave_form", "ウェーブ", "abstract soft waves")] }),
    sub("abs_blur", "ブラー", { use_cases: ["overlay", "titlecard"], scenes: [sc("color_blur", "ブラー", "out-of-focus color blur")] }),
    sub("abs_glow", "グロー", { use_cases: ["livestream", "titlecard"], scenes: [sc("soft_glow", "グロー", "abstract glowing orbs")] }),
    sub("abs_light", "光", { use_cases: ["hero", "youtube"], scenes: [sc("light_rays", "光線", "abstract light rays")] }),
    sub("abs_smoke", "スモーク", { use_cases: ["titlecard", "advertising"], scenes: [sc("smoke_wash", "スモーク", "abstract smoke wisps")] }),
    sub("abs_glass", "ガラス", { use_cases: ["hero", "presentation"], scenes: [sc("glass_blur", "ガラス", "frosted glass abstract")] }),
    sub("abs_liquid", "リキッド", { use_cases: ["advertising", "sns"], scenes: [sc("liquid_metal", "リキッド", "abstract liquid shapes")] }),
    sub("abs_organic", "有機シェイプ", { use_cases: ["hero", "blog"], scenes: [sc("organic_blob", "有機", "soft organic abstract shapes")] }),
    sub("abs_geo", "抽象幾何", { use_cases: ["presentation", "hero"], scenes: [sc("abs_geo", "抽象幾何", "layered abstract geometry")] }),
    sub("abs_layer", "レイヤー", { use_cases: ["hero", "advertising"], scenes: [sc("layered_shapes", "レイヤー", "layered translucent shapes")] }),
  ]),
  genre("pattern", "core", 7, "パターン", "PATTERN", ["pattern", "geometric"], ["clean", "playful", "muted", "corporate"], ["blue", "gray", "navy", "pastel", "multicolor"], [
    sub("pat_geo", "幾何", { use_cases: ["hero", "presentation"], scenes: [sc("geo_repeat", "幾何", "subtle repeating geometric pattern")] }),
    sub("pat_dots", "ドット", { use_cases: ["sns", "blog"], scenes: [sc("dot_grid", "ドット", "soft polka-dot pattern")] }),
    sub("pat_lines", "ライン", { use_cases: ["document", "presentation"], scenes: [sc("line_pattern", "ライン", "thin parallel line pattern")] }),
    sub("pat_grid", "グリッド", { use_cases: ["presentation", "hero"], scenes: [sc("soft_grid", "グリッド", "faint grid pattern")] }),
    sub("pat_stripes", "ストライプ", { use_cases: ["sns", "advertising"], scenes: [sc("stripe_pat", "ストライプ", "soft stripe pattern")] }),
    sub("pat_check", "チェック", { use_cases: ["menu", "sns"], scenes: [sc("check_pat", "チェック", "subtle checker pattern")] }),
    sub("pat_waves", "ウェーブ柄", { use_cases: ["hero", "blog"], scenes: [sc("wave_pat", "ウェーブ柄", "repeating wave pattern")] }),
    sub("pat_circles", "サークル", { use_cases: ["sns", "hero"], scenes: [sc("circle_pat", "サークル", "overlapping circle pattern")] }),
    sub("pat_tri", "トライアングル", { use_cases: ["presentation", "advertising"], scenes: [sc("tri_pat", "三角", "triangle tessellation")] }),
    sub("pat_repeat", "リピート", { use_cases: ["hero", "ecommerce"], scenes: [sc("repeat_pat", "リピート", "seamless repeating motif")] }),
    sub("pat_seamless", "シームレス", { use_cases: ["hero", "livestream"], scenes: [sc("seamless_pat", "シームレス", "tileable seamless pattern")] }),
  ]),
  genre("texture", "core", 7, "テクスチャ", "TEXTURE", ["texture"], NAT, EARTH.concat(["gray"]), [
    sub("tex_paper", "紙", { use_cases: ["document", "blog"], scenes: [sc("paper_tex", "紙", "fine paper texture")] }),
    sub("tex_concrete", "コンクリート", { use_cases: ["hero", "advertising"], scenes: [sc("concrete_tex", "コンクリ", "smooth concrete texture")] }),
    sub("tex_fabric", "布", { use_cases: ["ecommerce", "blog"], scenes: [sc("fabric_tex", "布", "woven fabric texture")] }),
    sub("tex_wood", "木", { use_cases: ["menu", "productshow"], scenes: [sc("wood_tex", "木目", "light wood grain")] }),
    sub("tex_metal", "金属", { use_cases: ["productshow", "hero"], scenes: [sc("metal_tex", "金属", "brushed metal texture")] }),
    sub("tex_stone", "石", { use_cases: ["hero", "menu"], scenes: [sc("stone_tex", "石", "stone surface texture")] }),
    sub("tex_canvas", "キャンバス", { use_cases: ["blog", "poster"], scenes: [sc("canvas_tex", "キャンバス", "canvas weave texture")] }),
    sub("tex_grain", "グレイン", { use_cases: ["overlay", "youtube"], scenes: [sc("film_grain", "グレイン", "fine film grain")] }),
    sub("tex_noise", "ノイズ", { use_cases: ["overlay", "titlecard"], scenes: [sc("soft_noise", "ノイズ", "soft noise texture")] }),
    sub("tex_wall", "壁", { use_cases: ["hero", "productshow"], scenes: [sc("wall_tex", "壁", "painted wall texture")] }),
    sub("tex_plaster", "漆喰", { use_cases: ["hero", "blog"], scenes: [sc("plaster_tex", "漆喰", "plaster wall texture")] }),
    sub("tex_leather", "レザー", { use_cases: ["ecommerce", "productshow"], scenes: [sc("leather_tex", "レザー", "leather texture")] }),
  ]),
  genre("business", "core", 8, "ビジネス・企業", "BUSINESS / CORPORATE", ["minimal", "abstract", "gradient"], CORP, BLUE, [
    sub("biz_clean", "クリーンコーポレート", { use_cases: ["presentation", "document", "hero"], scenes: [sc("corp_clean", "コーポレート", "a clean corporate empty backdrop")] }),
    sub("biz_office", "オフィス抽象", { use_cases: ["hero", "youtube"], scenes: [sc("office_abs", "オフィス抽象", "empty office glass and light, no furniture clutter")] }),
    sub("biz_blue", "ブルーコーポレート", { use_cases: ["presentation", "hero"], scenes: [sc("blue_corp", "ブルー企業", "blue professional empty backdrop")] }),
    sub("biz_present", "プレゼン背景", { use_cases: ["presentation", "overlay"], scenes: [sc("present_bg", "プレゼン", "presentation-safe empty stage wash")] }),
    sub("biz_report", "レポート", { use_cases: ["document", "overlay"], scenes: [sc("report_bg", "レポート", "document-safe light backdrop")] }),
    sub("biz_docs", "ビジネス文書", { use_cases: ["document", "presentation"], scenes: [sc("biz_doc_bg", "文書", "business document empty header backdrop")] }),
    sub("biz_pro", "プロフェッショナル", { use_cases: ["hero", "advertising"], scenes: [sc("pro_bg", "プロ", "professional muted backdrop")] }),
    sub("biz_tech", "テックビジネス", { use_cases: ["hero", "presentation"], scenes: [sc("tech_biz", "テック企業", "technology-business abstract backdrop")] }),
    sub("biz_conf", "カンファレンス", { use_cases: ["youtube", "presentation"], scenes: [sc("conf_wash", "カンファレンス", "empty conference lighting wash")] }),
    sub("biz_intro", "会社紹介", { use_cases: ["hero", "youtube"], scenes: [sc("company_intro", "会社紹介", "company introduction empty backdrop")] }),
  ]),
  genre("technology", "core", 8, "IT・デジタル", "TECHNOLOGY / DIGITAL", ["abstract", "geometric", "gradient"], FUT, ["blue", "navy", "black", "purple"], [
    sub("tec_ai", "AI", { use_cases: ["hero", "youtube"], scenes: [sc("ai_net", "AI", "abstract AI network nodes, no faces")] }),
    sub("tec_net", "ネットワーク", { use_cases: ["hero", "presentation"], scenes: [sc("net_lines", "ネットワーク", "network line mesh")] }),
    sub("tec_data", "データ", { use_cases: ["presentation", "hero"], scenes: [sc("data_viz", "データ", "abstract data visualization field")] }),
    sub("tec_cyber", "サイバー", { use_cases: ["livestream", "titlecard"], scenes: [sc("cyber_grid", "サイバー", "dark cyber grid")] }),
    sub("tec_circuit", "回路", { use_cases: ["hero", "advertising"], scenes: [sc("circuit", "回路", "circuit board traces, no logos")] }),
    sub("tec_dgrid", "デジタルグリッド", { use_cases: ["livestream", "hero"], scenes: [sc("digi_grid", "グリッド", "digital perspective grid")] }),
    sub("tec_future", "フューチャー", { use_cases: ["youtube", "hero"], scenes: [sc("future_abs", "未来", "futuristic empty abstract")] }),
    sub("tec_hud", "HUD", { use_cases: ["titlecard", "livestream"], scenes: [sc("hud_lines", "HUD", "faint HUD lines, no readable text")] }),
    sub("tec_glowline", "光るライン", { use_cases: ["livestream", "advertising"], scenes: [sc("glow_lines", "光ライン", "glowing abstract lines")] }),
    sub("tec_cloud", "クラウド", { use_cases: ["hero", "presentation"], scenes: [sc("cloud_abs", "クラウド", "cloud-computing abstract shapes")] }),
    sub("tec_code", "コード抽象", { use_cases: ["youtube", "hero"], scenes: [sc("code_blur", "コード", "out-of-focus code-like streaks, unreadable")] }),
    sub("tec_techabs", "テック抽象", { use_cases: ["hero", "advertising"], scenes: [sc("tech_abs", "テック抽象", "technology abstract backdrop")] }),
  ]),
  genre("social", "core", 8, "SNS・クリエイター", "SOCIAL / CREATOR", ["gradient", "abstract", "decorative"], ["vivid", "playful", "cinematic", "soft"], ["purple", "pink", "blue", "pastel", "black"], [
    sub("soc_yt", "YouTube", { use_cases: ["youtube", "titlecard"], scenes: [sc("yt_bg", "YouTube", "youtube thumbnail-safe empty backdrop")] }),
    sub("soc_shorts", "Shorts", { use_cases: ["sns", "titlecard"], scenes: [sc("shorts_bg", "Shorts", "vertical shorts empty backdrop")] }),
    sub("soc_live", "ライブ配信", { use_cases: ["livestream", "overlay"], scenes: [sc("live_bg", "配信", "livestream overlay-safe backdrop")] }),
    sub("soc_pod", "ポッドキャスト", { use_cases: ["youtube", "sns"], scenes: [sc("pod_bg", "ポッドキャスト", "podcast cover empty backdrop")] }),
    sub("soc_studio", "クリエイタースタジオ", { use_cases: ["livestream", "youtube"], scenes: [sc("creator_studio", "スタジオ", "empty creator studio wall")] }),
    sub("soc_post", "SNS投稿", { use_cases: ["sns", "advertising"], scenes: [sc("social_post", "投稿", "social post empty backdrop")] }),
    sub("soc_thumb", "サムネ背景", { use_cases: ["youtube", "sns"], scenes: [sc("thumb_bg", "サムネ", "thumbnail empty backdrop with copy space")] }),
    sub("soc_announce", "お知らせ", { use_cases: ["sns", "poster"], scenes: [sc("announce_bg", "お知らせ", "announcement empty backdrop")] }),
    sub("soc_influencer", "インフルエンサー", { use_cases: ["sns", "advertising"], scenes: [sc("influencer_bg", "インフルエンサー", "influencer post empty backdrop")] }),
    sub("soc_streamov", "配信オーバーレイ背景", { use_cases: ["livestream", "overlay"], scenes: [sc("stream_ov", "オーバーレイ", "streaming overlay empty backdrop")] }),
  ]),
  genre("video", "core", 8, "動画編集向け", "VIDEO / MOTION STYLE", ["abstract", "gradient", "scenic"], CINE, DARK.concat(["blue"]), [
    sub("vid_title", "タイトル背景", { use_cases: ["titlecard", "overlay"], scenes: [sc("title_bg", "タイトル", "title-card empty backdrop")] }),
    sub("vid_intro", "イントロ", { use_cases: ["titlecard", "youtube"], scenes: [sc("intro_bg", "イントロ", "intro empty backdrop")] }),
    sub("vid_outro", "アウトロ", { use_cases: ["titlecard", "youtube"], scenes: [sc("outro_bg", "アウトロ", "outro empty backdrop")] }),
    sub("vid_telop", "テロップ背景", { use_cases: ["overlay", "youtube"], scenes: [sc("telop_bg", "テロップ", "telop lower-third empty wash")] }),
    sub("vid_trans", "トランジション静止", { use_cases: ["titlecard", "overlay"], scenes: [sc("trans_still", "トランジション", "transition still empty wash")] }),
    sub("vid_cine", "シネマティック", { use_cases: ["youtube", "titlecard"], scenes: [sc("cine_bg", "シネマ", "cinematic empty backdrop")] }),
    sub("vid_doc", "ドキュメンタリー", { use_cases: ["youtube", "overlay"], scenes: [sc("docu_bg", "ドキュメンタリー", "muted documentary empty backdrop")] }),
    sub("vid_vlog", "Vlog", { use_cases: ["youtube", "sns"], scenes: [sc("vlog_bg", "Vlog", "vlog empty backdrop")] }),
    sub("vid_game", "ゲーム実況", { use_cases: ["livestream", "youtube"], scenes: [sc("gamecast_bg", "実況", "gaming commentary empty backdrop")] }),
    sub("vid_talk", "トーク動画", { use_cases: ["youtube", "livestream"], scenes: [sc("talk_bg", "トーク", "talk-video empty backdrop")] }),
  ]),
  genre("product", "core", 8, "EC・商品背景", "EC / PRODUCT", ["studio", "minimal"], ["clean", "soft", "luxstyle", "corporate"], ["white", "beige", "black", "pastel", "gray"], [
    sub("prd_pedestal", "台座", { use_cases: ["productshow", "ecommerce"], scenes: [sc("pedestal", "台座", "empty product pedestal")] }),
    sub("prd_studio", "スタジオ", { use_cases: ["productshow", "ecommerce"], scenes: [sc("prod_studio", "スタジオ", "empty product studio")] }),
    sub("prd_white", "白ホリゾ", { use_cases: ["productshow", "ecommerce"], scenes: [sc("white_cyc", "白ホリゾ", "white cyclorama")] }),
    sub("prd_pastel", "パステル", { use_cases: ["ecommerce", "sns"], scenes: [sc("pastel_stage", "パステル台", "pastel product stage")] }),
    sub("prd_lux", "ラグジュアリー", { use_cases: ["ecommerce", "advertising"], scenes: [sc("lux_stage", "高級台", "luxury product stage")] }),
    sub("prd_cosme", "コスメ", { use_cases: ["ecommerce", "productshow"], scenes: [sc("cosme_stage", "コスメ台", "cosmetic product empty stage")] }),
    sub("prd_food", "食品", { use_cases: ["ecommerce", "menu"], scenes: [sc("food_stage", "食品台", "food product empty surface")] }),
    sub("prd_tech", "テック製品", { use_cases: ["ecommerce", "productshow"], scenes: [sc("tech_stage", "テック台", "tech product empty stage")] }),
    sub("prd_shadow", "影", { use_cases: ["productshow", "ecommerce"], scenes: [sc("shadow_stage", "影", "soft shadow product surface")] }),
    sub("prd_spot", "スポットライト", { use_cases: ["productshow", "advertising"], scenes: [sc("spot_stage", "スポット", "spotlight product stage")] }),
    sub("prd_display", "ディスプレイ", { use_cases: ["ecommerce", "advertising"], scenes: [sc("display_stage", "展示", "display stage empty")] }),
  ]),
  genre("luxury", "core", 6, "高級・ラグジュアリー", "LUXURY / PREMIUM", ["studio", "texture", "abstract"], LUX, ["black", "navy", "beige", "brown"], [
    sub("lux_gold", "ブラックゴールド", { use_cases: ["advertising", "ecommerce"], scenes: [sc("black_gold", "黒金", "black and gold luxury empty backdrop")] }),
    sub("lux_marble", "マーブル", { use_cases: ["ecommerce", "hero"], scenes: [sc("marble_bg", "大理石", "marble empty surface")] }),
    sub("lux_dark", "ダークラグジュアリー", { use_cases: ["advertising", "titlecard"], scenes: [sc("dark_lux", "ダーク高級", "dark luxury empty backdrop")] }),
    sub("lux_elegant", "エレガント", { use_cases: ["hero", "poster"], scenes: [sc("elegant_bg", "エレガント", "elegant empty backdrop")] }),
    sub("lux_premium", "プレミアム", { use_cases: ["ecommerce", "advertising"], scenes: [sc("premium_bg", "プレミアム", "premium empty backdrop")] }),
    sub("lux_metal", "メタリック", { use_cases: ["productshow", "advertising"], scenes: [sc("metal_lux", "メタリック", "metallic sheen empty backdrop")] }),
    sub("lux_goldlight", "ゴールドライト", { use_cases: ["advertising", "titlecard"], scenes: [sc("gold_light", "金の光", "gold light empty backdrop")] }),
    sub("lux_silk", "シルク", { use_cases: ["ecommerce", "hero"], scenes: [sc("silk_bg", "シルク", "silk drape empty backdrop")] }),
    sub("lux_navy", "ディープネイビー", { use_cases: ["presentation", "hero"], scenes: [sc("deep_navy", "紺", "deep navy empty backdrop")] }),
    sub("lux_champ", "シャンパン", { use_cases: ["advertising", "ecommerce"], scenes: [sc("champagne_bg", "シャンパン", "champagne-tone empty backdrop")] }),
  ]),
  genre("cute", "core", 5, "かわいい・ポップ", "CUTE / POP", ["decorative", "gradient", "pattern"], POP, PASTEL.concat(["multicolor"]), [
    sub("cut_pastel", "パステル", { use_cases: ["sns", "hero"], scenes: [sc("cute_pastel", "パステル", "pastel cute empty backdrop")] }),
    sub("cut_color", "カラフル", { use_cases: ["sns", "advertising"], scenes: [sc("cute_color", "カラフル", "colorful pop empty backdrop")] }),
    sub("cut_heart", "ハート", { use_cases: ["sns", "poster"], scenes: [sc("heart_deco", "ハート", "soft heart decorations, no faces")] }),
    sub("cut_star", "星", { use_cases: ["sns", "titlecard"], scenes: [sc("star_deco", "星", "star decorations empty backdrop")] }),
    sub("cut_bubble", "バブル", { use_cases: ["sns", "hero"], scenes: [sc("bubble_deco", "バブル", "bubble decorations")] }),
    sub("cut_play", "プレイフル", { use_cases: ["sns", "advertising"], scenes: [sc("play_shapes", "遊形", "playful shape backdrop")] }),
    sub("cut_candy", "キャンディ", { use_cases: ["sns", "menu"], scenes: [sc("candy_bg", "キャンディ", "candy-color empty backdrop")] }),
    sub("cut_kawaii", "かわいい", { use_cases: ["sns", "poster"], scenes: [sc("kawaii_bg", "かわいい", "kawaii empty backdrop, no characters")] }),
    sub("cut_pop", "ブライトポップ", { use_cases: ["advertising", "sns"], scenes: [sc("bright_pop", "ポップ", "bright pop empty backdrop")] }),
    sub("cut_soft", "ソフトキュート", { use_cases: ["sns", "blog"], scenes: [sc("soft_cute", "ソフト", "soft cute empty backdrop")] }),
  ]),
  genre("organic", "core", 5, "ナチュラル", "NATURAL / ORGANIC", ["scenic", "texture", "decorative"], NAT, EARTH, [
    sub("org_plant", "植物", { use_cases: ["hero", "blog"], scenes: [sc("plant_blur", "植物", "out-of-focus plants, no people")] }),
    sub("org_leaf", "葉", { use_cases: ["blog", "sns"], scenes: [sc("leaf_bg", "葉", "leaf canopy bokeh")] }),
    sub("org_botan", "ボタニカル", { use_cases: ["hero", "menu"], scenes: [sc("botanical", "ボタニカル", "botanical empty backdrop")] }),
    sub("org_wood", "ウッド", { use_cases: ["menu", "productshow"], scenes: [sc("org_wood", "ウッド", "natural wood empty surface")] }),
    sub("org_earth", "アース", { use_cases: ["hero", "blog"], scenes: [sc("earth_tone", "アース", "earth-tone empty backdrop")] }),
    sub("org_organic", "オーガニック", { use_cases: ["ecommerce", "hero"], scenes: [sc("organic_bg", "オーガニック", "organic empty backdrop")] }),
    sub("org_eco", "エコ", { use_cases: ["hero", "advertising"], scenes: [sc("eco_bg", "エコ", "eco empty backdrop")] }),
    sub("org_light", "自然光", { use_cases: ["hero", "blog"], scenes: [sc("nat_light", "自然光", "natural window light empty wall")] }),
    sub("org_green", "グリーン", { use_cases: ["hero", "sns"], scenes: [sc("greenery", "緑", "greenery empty backdrop")] }),
    sub("org_calm", "カーム", { use_cases: ["overlay", "blog"], scenes: [sc("calm_nat", "穏やか", "calm natural empty backdrop")] }),
  ]),
  genre("nature", "core", 5, "自然・風景", "NATURE / LANDSCAPE", ["scenic", "photo_like"], NAT.concat(["cinematic"]), ["blue", "green", "orange", "beige"], [
    sub("nat_sky", "空", { use_cases: ["hero", "youtube"], scenes: [sc("open_sky", "空", "open sky, no people, no aircraft")] }),
    sub("nat_sea", "海", { use_cases: ["hero", "youtube"], scenes: [sc("calm_sea", "海", "calm sea horizon")] }),
    sub("nat_mtn", "山", { use_cases: ["hero", "youtube"], scenes: [sc("mtn_range", "山", "distant mountain range")] }),
    sub("nat_forest", "森", { use_cases: ["hero", "blog"], scenes: [sc("forest_path", "森", "empty forest, no people")] }),
    sub("nat_field", "野原", { use_cases: ["hero", "sns"], scenes: [sc("field_wide", "野原", "wide field")] }),
    sub("nat_sunset", "夕焼け", { use_cases: ["youtube", "hero"], scenes: [sc("sunset_sky", "夕焼け", "sunset sky")] }),
    sub("nat_sunrise", "朝焼け", { use_cases: ["hero", "youtube"], scenes: [sc("sunrise_sky", "朝焼け", "sunrise sky")] }),
    sub("nat_cloud", "雲", { use_cases: ["hero", "overlay"], scenes: [sc("cloud_sky", "雲", "soft clouds")] }),
    sub("nat_beach", "ビーチ", { use_cases: ["hero", "advertising"], scenes: [sc("empty_beach", "ビーチ", "empty beach")] }),
    sub("nat_lake", "湖", { use_cases: ["hero", "blog"], scenes: [sc("still_lake", "湖", "still lake")] }),
    sub("nat_night", "夜の風景", { use_cases: ["youtube", "titlecard"], scenes: [sc("night_land", "夜景自然", "night landscape, no people")] }),
  ]),
  genre("space", "core", 3, "宇宙・空・星", "SPACE / SKY", ["scenic", "abstract"], CINE, DARK.concat(["blue"]), [
    sub("spa_stars", "星", { use_cases: ["titlecard", "livestream"], scenes: [sc("star_field", "星", "star field")] }),
    sub("spa_galaxy", "銀河", { use_cases: ["youtube", "hero"], scenes: [sc("galaxy_bg", "銀河", "galaxy backdrop")] }),
    sub("spa_nebula", "星雲", { use_cases: ["livestream", "titlecard"], scenes: [sc("nebula_bg", "星雲", "nebula backdrop")] }),
    sub("spa_moon", "月", { use_cases: ["youtube", "sns"], scenes: [sc("moon_sky", "月", "moon in night sky")] }),
    sub("spa_night", "夜空", { use_cases: ["hero", "youtube"], scenes: [sc("night_sky", "夜空", "night sky")] }),
    sub("spa_universe", "宇宙", { use_cases: ["titlecard", "hero"], scenes: [sc("universe_bg", "宇宙", "deep universe backdrop")] }),
    sub("spa_planet", "惑星", { use_cases: ["youtube", "advertising"], scenes: [sc("planet_bg", "惑星", "distant planets, no spacecraft UI")] }),
    sub("spa_cosmic", "コズミック", { use_cases: ["livestream", "hero"], scenes: [sc("cosmic_bg", "コズミック", "cosmic dust backdrop")] }),
    sub("spa_aurora", "オーロラ空", { use_cases: ["youtube", "hero"], scenes: [sc("sky_aurora", "オーロラ", "aurora in night sky")] }),
    sub("spa_deep", "ディープスペース", { use_cases: ["titlecard", "livestream"], scenes: [sc("deep_space", "深宇宙", "deep space")] }),
  ]),
  genre("seasonal", "core", 6, "季節・イベント", "SEASON / EVENT", ["decorative", "scenic", "gradient"], ["soft", "playful", "cinematic", "cutestyle"], ["pink", "orange", "red", "green", "pastel"], [
    sub("sea_spring", "春", { use_cases: ["hero", "sns"], scenes: [sc("spring_bg", "春", "spring empty backdrop")] }),
    sub("sea_sakura", "桜", { use_cases: ["sns", "hero"], scenes: [sc("sakura_bg", "桜", "cherry blossom bokeh, no people")] }),
    sub("sea_summer", "夏", { use_cases: ["hero", "youtube"], scenes: [sc("summer_bg", "夏", "summer sky empty backdrop")] }),
    sub("sea_autumn", "秋", { use_cases: ["hero", "blog"], scenes: [sc("autumn_bg", "秋", "autumn foliage empty")] }),
    sub("sea_winter", "冬", { use_cases: ["hero", "sns"], scenes: [sc("winter_bg", "冬", "winter empty snow scene")] }),
    sub("sea_newyear", "正月", { use_cases: ["poster", "sns"], scenes: [sc("newyear_bg", "正月", "new year empty backdrop, no people")] }),
    sub("sea_val", "バレンタイン", { use_cases: ["sns", "advertising"], scenes: [sc("val_bg", "バレンタイン", "valentine empty backdrop")] }),
    sub("sea_hallo", "ハロウィン", { use_cases: ["sns", "poster"], scenes: [sc("hallo_bg", "ハロウィン", "halloween empty backdrop, no characters")] }),
    sub("sea_xmas", "クリスマス", { use_cases: ["sns", "advertising"], scenes: [sc("xmas_bg", "クリスマス", "christmas empty backdrop")] }),
    sub("sea_fire", "花火", { use_cases: ["youtube", "sns"], scenes: [sc("fireworks_bg", "花火", "fireworks in sky, no crowd")] }),
    sub("sea_fest", "祭り", { use_cases: ["poster", "hero"], scenes: [sc("festival_bg", "祭り", "festival lantern empty street")] }),
    sub("sea_grad", "卒業", { use_cases: ["poster", "sns"], scenes: [sc("grad_bg", "卒業", "graduation empty backdrop, no people")] }),
  ]),
  genre("food", "core", 4, "飲食・カフェ", "FOOD / CAFE", ["scenic", "texture", "studio"], NAT, EARTH.concat(["black"]), [
    sub("foo_cafe", "カフェテーブル", { use_cases: ["menu", "blog"], scenes: [sc("cafe_table", "カフェ", "empty cafe table")] }),
    sub("foo_rest", "レストラン", { use_cases: ["menu", "hero"], scenes: [sc("rest_table", "レストラン", "empty restaurant table")] }),
    sub("foo_bakery", "ベーカリー", { use_cases: ["menu", "sns"], scenes: [sc("bakery_bg", "ベーカリー", "empty bakery counter")] }),
    sub("foo_coffee", "コーヒー", { use_cases: ["menu", "blog"], scenes: [sc("coffee_bg", "コーヒー", "coffee beans and empty table")] }),
    sub("foo_kitchen", "キッチン", { use_cases: ["youtube", "blog"], scenes: [sc("kitchen_bg", "キッチン", "empty kitchen counter")] }),
    sub("foo_menu", "メニュー背景", { use_cases: ["menu", "poster"], scenes: [sc("menu_bg", "メニュー", "food menu empty backdrop")] }),
    sub("foo_wood", "木テーブル", { use_cases: ["menu", "productshow"], scenes: [sc("wood_table", "木テーブル", "wooden table empty")] }),
    sub("foo_dark", "ダークフード", { use_cases: ["menu", "advertising"], scenes: [sc("dark_food", "ダーク料理", "dark food photography backdrop")] }),
    sub("foo_bright", "ブライトフード", { use_cases: ["menu", "sns"], scenes: [sc("bright_food", "明るい料理", "bright food photography backdrop")] }),
  ]),
  genre("beauty", "core", 4, "美容・ファッション", "BEAUTY / FASHION", ["studio", "minimal", "texture"], ["soft", "elegant", "luxstyle", "clean"], PASTEL.concat(["white"]), [
    sub("bea_cosme", "コスメ", { use_cases: ["ecommerce", "productshow"], scenes: [sc("bea_cosme", "コスメ", "cosmetic empty stage")] }),
    sub("bea_salon", "サロン", { use_cases: ["hero", "sns"], scenes: [sc("salon_bg", "サロン", "empty salon interior")] }),
    sub("bea_skin", "スキンケア", { use_cases: ["ecommerce", "blog"], scenes: [sc("skin_bg", "スキンケア", "skincare empty backdrop")] }),
    sub("bea_pastel", "エレガントパステル", { use_cases: ["hero", "sns"], scenes: [sc("ele_pastel", "パステル美容", "elegant pastel empty")] }),
    sub("bea_pink", "ピンク", { use_cases: ["sns", "ecommerce"], scenes: [sc("beauty_pink", "ピンク美容", "soft pink beauty backdrop")] }),
    sub("bea_marble", "マーブル美容", { use_cases: ["ecommerce", "productshow"], scenes: [sc("bea_marble", "大理石美容", "beauty marble surface")] }),
    sub("bea_soft", "ソフトライト", { use_cases: ["hero", "ecommerce"], scenes: [sc("soft_beauty", "ソフト光", "soft light beauty backdrop")] }),
    sub("bea_edit", "ファッション誌", { use_cases: ["advertising", "hero"], scenes: [sc("fashion_ed", "誌面", "fashion editorial empty backdrop")] }),
    sub("bea_stage", "美容ステージ", { use_cases: ["productshow", "ecommerce"], scenes: [sc("beauty_stage", "美容台", "beauty product empty stage")] }),
  ]),
  genre("education", "core", 3, "教育", "EDUCATION", ["minimal", "texture", "decorative"], ["clean", "soft", "playful", "corporate"], ["blue", "green", "beige", "white"], [
    sub("edu_school", "学校", { use_cases: ["hero", "presentation"], scenes: [sc("school_bg", "学校", "empty classroom wall")] }),
    sub("edu_note", "ノート", { use_cases: ["blog", "document"], scenes: [sc("notebook_bg", "ノート", "notebook paper backdrop")] }),
    sub("edu_board", "黒板", { use_cases: ["youtube", "presentation"], scenes: [sc("blackboard", "黒板", "empty blackboard")] }),
    sub("edu_class", "教室", { use_cases: ["youtube", "hero"], scenes: [sc("classroom", "教室", "empty classroom")] }),
    sub("edu_stat", "文房具", { use_cases: ["sns", "blog"], scenes: [sc("stationery_bg", "文房具", "stationery flat empty desk")] }),
    sub("edu_learn", "学習", { use_cases: ["hero", "overlay"], scenes: [sc("learn_bg", "学習", "learning empty backdrop")] }),
    sub("edu_kids", "キッズ", { use_cases: ["sns", "poster"], scenes: [sc("kids_bg", "キッズ", "kids education empty backdrop, no children")] }),
    sub("edu_simple", "シンプル教育", { use_cases: ["document", "overlay"], scenes: [sc("simple_edu", "教育シンプル", "simple education empty")] }),
    sub("edu_online", "オンライン学習", { use_cases: ["hero", "youtube"], scenes: [sc("elearn_bg", "オンライン", "online learning empty backdrop")] }),
  ]),
  genre("medical", "core", 3, "医療・健康", "MEDICAL / HEALTH", ["minimal", "abstract"], ["clean", "soft", "corporate", "muted"], ["white", "blue", "green", "gray"], [
    sub("med_clean", "クリーンメディカル", { use_cases: ["hero", "document"], scenes: [sc("med_clean", "医療クリーン", "clean medical empty backdrop")] }),
    sub("med_bluew", "ブルーホワイト", { use_cases: ["hero", "presentation"], scenes: [sc("blue_white", "青白", "blue-white clinical empty")] }),
    sub("med_hosp", "病院", { use_cases: ["hero", "youtube"], scenes: [sc("hosp_hall", "病院", "empty hospital corridor")] }),
    sub("med_health", "ヘルスケア", { use_cases: ["hero", "advertising"], scenes: [sc("health_bg", "ヘルスケア", "healthcare empty backdrop")] }),
    sub("med_well", "ウェルネス", { use_cases: ["hero", "sns"], scenes: [sc("well_bg", "ウェルネス", "wellness empty backdrop")] }),
    sub("med_green", "ソフトグリーン", { use_cases: ["hero", "blog"], scenes: [sc("soft_med_green", "医療緑", "soft green medical empty")] }),
    sub("med_hygiene", "衛生", { use_cases: ["document", "advertising"], scenes: [sc("hygiene_bg", "衛生", "hygiene empty backdrop")] }),
    sub("med_abs", "医療抽象", { use_cases: ["presentation", "hero"], scenes: [sc("med_abs", "医療抽象", "medical abstract empty")] }),
  ]),
  genre("gaming", "supporting", 4, "ゲーム・eスポーツ", "GAMING / ESPORTS", ["abstract", "geometric"], ["futuristic", "vivid", "cinematic", "playful"], NEON, [
    sub("gam_neon", "ネオン", { use_cases: ["livestream", "youtube"], scenes: [sc("neon_game", "ネオン", "neon gaming empty backdrop")] }),
    sub("gam_cyber", "サイバーゲーム", { use_cases: ["livestream", "titlecard"], scenes: [sc("cyber_game", "サイバーゲー", "cyber gaming empty")] }),
    sub("gam_rgb", "RGB", { use_cases: ["livestream", "sns"], scenes: [sc("rgb_glow", "RGB", "RGB glow empty backdrop")] }),
    sub("gam_dark", "ダークゲーミング", { use_cases: ["livestream", "youtube"], scenes: [sc("dark_game", "ダークゲー", "dark gaming empty")] }),
    sub("gam_future", "フューチャーゲーム", { use_cases: ["titlecard", "livestream"], scenes: [sc("future_game", "未来ゲー", "futuristic gaming empty")] }),
    sub("gam_stream", "配信ゲーム", { use_cases: ["livestream", "overlay"], scenes: [sc("game_stream", "配信ゲー", "game stream overlay empty")] }),
    sub("gam_arena", "eスポーツアリーナ", { use_cases: ["youtube", "livestream"], scenes: [sc("esports_arena", "アリーナ", "empty esports arena lighting")] }),
    sub("gam_glitch", "グリッチ", { use_cases: ["titlecard", "advertising"], scenes: [sc("glitch_bg", "グリッチ", "glitch abstract, no readable text")] }),
  ]),
  genre("music", "supporting", 3, "音楽・エンタメ", "MUSIC / ENTERTAINMENT", ["abstract", "scenic", "decorative"], CINE, DARK.concat(["red"]), [
    sub("mus_stage", "ステージ", { use_cases: ["youtube", "poster"], scenes: [sc("empty_stage", "ステージ", "empty concert stage")] }),
    sub("mus_concert", "コンサート", { use_cases: ["youtube", "advertising"], scenes: [sc("concert_light", "コンサート", "concert lighting, no crowd")] }),
    sub("mus_club", "クラブ", { use_cases: ["sns", "poster"], scenes: [sc("club_light", "クラブ", "club lighting empty")] }),
    sub("mus_spot", "スポットライト", { use_cases: ["titlecard", "youtube"], scenes: [sc("music_spot", "スポット", "spotlight empty stage")] }),
    sub("mus_studio", "音楽スタジオ", { use_cases: ["youtube", "hero"], scenes: [sc("music_studio", "音楽スタジオ", "empty music studio")] }),
    sub("mus_neon", "音楽ネオン", { use_cases: ["sns", "poster"], scenes: [sc("music_neon", "ネオン音楽", "music neon empty")] }),
    sub("mus_fest", "フェス", { use_cases: ["poster", "hero"], scenes: [sc("music_fest", "フェス", "festival lighting empty field")] }),
    sub("mus_ent", "エンタメ", { use_cases: ["advertising", "youtube"], scenes: [sc("ent_bg", "エンタメ", "entertainment empty backdrop")] }),
  ]),
  genre("city", "supporting", 3, "都市・街", "CITY / URBAN", ["photo_like", "scenic", "abstract"], ["cinematic", "muted", "futuristic", "corporate"], ["navy", "gray", "blue", "black"], [
    sub("cit_city", "シティ", { use_cases: ["hero", "youtube"], scenes: [sc("city_skyline", "街", "city skyline, no readable signs")] }),
    sub("cit_office", "オフィス街", { use_cases: ["hero", "presentation"], scenes: [sc("office_dist", "オフィス街", "office district empty street")] }),
    sub("cit_street", "ストリート", { use_cases: ["hero", "sns"], scenes: [sc("empty_street", "通り", "empty urban street")] }),
    sub("cit_night", "ナイトシティ", { use_cases: ["youtube", "titlecard"], scenes: [sc("night_city", "夜の街", "night city bokeh")] }),
    sub("cit_blur", "アーバンブラー", { use_cases: ["overlay", "hero"], scenes: [sc("urban_blur", "ブラー街", "urban blur lights")] }),
    sub("cit_build", "ビル", { use_cases: ["hero", "advertising"], scenes: [sc("buildings", "ビル", "modern buildings, no people")] }),
    sub("cit_arch", "現代建築", { use_cases: ["hero", "presentation"], scenes: [sc("modern_arch", "建築", "modern architecture empty")] }),
  ]),
  genre("japanese", "supporting", 4, "和風", "JAPANESE / TRADITIONAL", ["pattern", "texture", "decorative"], ["elegant", "muted", "natural", "soft"], ["red", "beige", "navy", "green"], [
    sub("jpn_washi", "和紙", { use_cases: ["document", "hero"], scenes: [sc("washi", "和紙", "washi paper texture")] }),
    sub("jpn_asa", "麻の葉", { use_cases: ["hero", "poster"], scenes: [sc("asano_ha", "麻の葉", "asanoha pattern")] }),
    sub("jpn_seigai", "青海波", { use_cases: ["hero", "blog"], scenes: [sc("seigaiha", "青海波", "seigaiha wave pattern")] }),
    sub("jpn_gold", "金箔", { use_cases: ["advertising", "poster"], scenes: [sc("kinpaku", "金箔", "gold leaf empty")] }),
    sub("jpn_sakura", "和桜", { use_cases: ["sns", "hero"], scenes: [sc("jp_sakura", "和桜", "japanese sakura empty")] }),
    sub("jpn_fuji", "富士", { use_cases: ["hero", "poster"], scenes: [sc("fuji_bg", "富士", "mt fuji distant empty")] }),
    sub("jpn_ink", "水墨", { use_cases: ["document", "hero"], scenes: [sc("sumi_bg", "水墨", "sumi-e empty wash")] }),
    sub("jpn_wagara", "和柄", { use_cases: ["hero", "poster"], scenes: [sc("wagara", "和柄", "traditional japanese pattern")] }),
    sub("jpn_modern", "和モダン", { use_cases: ["hero", "presentation"], scenes: [sc("wa_modern", "和モダン", "japanese modern empty")] }),
  ]),
  genre("handdrawn", "supporting", 3, "手描き・クリエイティブ", "HAND-DRAWN / CREATIVE", ["decorative", "texture"], ["playful", "soft", "cutestyle", "natural"], ["pastel", "beige", "multicolor", "white"], [
    sub("hd_doodle", "ドゥードル", { use_cases: ["sns", "blog"], scenes: [sc("doodle_bg", "ドゥードル", "hand-drawn doodle empty, no characters")] }),
    sub("hd_shapes", "手描きシェイプ", { use_cases: ["sns", "hero"], scenes: [sc("hd_shapes", "手描き形", "hand-drawn shapes empty")] }),
    sub("hd_crayon", "クレヨン", { use_cases: ["sns", "poster"], scenes: [sc("crayon_bg", "クレヨン", "crayon texture empty")] }),
    sub("hd_water", "水彩", { use_cases: ["hero", "blog"], scenes: [sc("watercolor_bg", "水彩", "watercolor wash")] }),
    sub("hd_brush", "ブラシ", { use_cases: ["poster", "hero"], scenes: [sc("brush_bg", "ブラシ", "brush stroke empty")] }),
    sub("hd_sketch", "スケッチ", { use_cases: ["blog", "document"], scenes: [sc("sketch_bg", "スケッチ", "sketch paper empty")] }),
    sub("hd_paper", "手作り紙", { use_cases: ["blog", "document"], scenes: [sc("handmade_paper", "手作り紙", "handmade paper")] }),
    sub("hd_art", "プレイフルアート", { use_cases: ["sns", "advertising"], scenes: [sc("play_art", "アート", "playful art empty backdrop")] }),
  ]),
  genre("frame", "supporting", 4, "フレーム・余白付き背景", "FRAME / BORDER BACKGROUND", ["decorative", "minimal"], ["elegant", "clean", "soft", "cutestyle"], ["white", "beige", "navy", "brown"], [
    sub("frm_center", "中央フレーム", { use_cases: ["overlay", "poster"], scenes: [sc("center_frame", "中央枠", "full-bleed backdrop with a center copy frame")] }),
    sub("frm_left", "左装飾", { use_cases: ["overlay", "hero"], scenes: [sc("left_deco", "左装飾", "decoration on the left, empty right copy space")] }),
    sub("frm_right", "右装飾", { use_cases: ["overlay", "hero"], scenes: [sc("right_deco", "右装飾", "decoration on the right, empty left copy space")] }),
    sub("frm_top", "上装飾", { use_cases: ["overlay", "blog"], scenes: [sc("top_deco", "上装飾", "top decoration, empty lower copy space")] }),
    sub("frm_bottom", "下装飾", { use_cases: ["overlay", "youtube"], scenes: [sc("bottom_deco", "下装飾", "bottom decoration, empty upper copy space")] }),
    sub("frm_corner", "角装飾", { use_cases: ["poster", "overlay"], scenes: [sc("corner_deco", "角", "corner ornaments, open center")] }),
    sub("frm_border", "ボーダー", { use_cases: ["poster", "document"], scenes: [sc("border_bg", "ボーダー", "full-page border, open center")] }),
    sub("frm_copy", "コピー余白背景", { use_cases: ["overlay", "hero"], scenes: [sc("copy_bg", "余白背景", "background designed as a full canvas with wide copy space")] }),
  ]),
]);

export const BACKGROUND_CORE_GENRE_COUNT = BACKGROUND_DEMAND_GENRES.filter((g) => g.tier === "core").length;
export const BACKGROUND_SUPPORTING_GENRE_COUNT = BACKGROUND_DEMAND_GENRES.filter((g) => g.tier === "supporting").length;
export const BACKGROUND_QA_CORE_GENRES = Object.freeze([
  "gradient",
  "minimal",
  "abstract",
  "business",
  "technology",
  "product",
  "social",
  "seasonal",
]);

const GENRE_BY_ID = new Map(BACKGROUND_DEMAND_GENRES.map((g) => [g.id, g]));
const SUB_BY_ID = new Map();
const SCENE_BY_ID = new Map();
for (const g of BACKGROUND_DEMAND_GENRES) {
  for (const sg of g.subgenres) {
    SUB_BY_ID.set(sg.id, { genre: g, subgenre: sg });
    for (const scene of sg.scenes) SCENE_BY_ID.set(scene.id, { genre: g, subgenre: sg, scene });
  }
}

const TYPE_BY_SLUG = new Map(Object.values(BACKGROUND_TYPES).map((t) => [t.slug, t.id]));
const COLOR_BY_SLUG = new Map(Object.values(BACKGROUND_COLORS).map((t) => [t.slug, t.id]));
const BR_BY_SLUG = new Map(Object.values(BACKGROUND_BRIGHTNESS).map((t) => [t.slug, t.id]));
const CX_BY_SLUG = new Map(Object.values(BACKGROUND_COMPLEXITY).map((t) => [t.slug, t.id]));
const CS_BY_SLUG = new Map(Object.values(BACKGROUND_COPY_SPACES).map((t) => [t.slug, t.id]));

export function listBackgroundSubgenres() {
  return BACKGROUND_DEMAND_GENRES.flatMap((g) => g.subgenres.map((s) => ({ genre: g, subgenre: s })));
}
export function getBackgroundGenre(id) {
  return GENRE_BY_ID.get(String(id || "")) || null;
}
export function getBackgroundSubgenre(id) {
  return SUB_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}
export function getBackgroundScene(id) {
  return SCENE_BY_ID.get(String(id || "").replace(/-/g, "_")) || null;
}

export function validateBackgroundGenreSsot() {
  const issues = [];
  const genreIds = new Set();
  const subIds = new Set();
  const sceneIds = new Set();
  for (const g of BACKGROUND_DEMAND_GENRES) {
    if (!g.id || genreIds.has(g.id) || /-/.test(g.id)) issues.push(`bad_genre:${g.id}`);
    genreIds.add(g.id);
    for (const t of g.allowed_types || []) {
      if (!BACKGROUND_TYPES[t]) issues.push(`type:${g.id}:${t}`);
    }
    for (const st of g.allowed_styles || []) {
      if (!BACKGROUND_STYLES[st]) issues.push(`style:${g.id}:${st}`);
    }
    for (const c of g.allowed_colors || []) {
      if (!BACKGROUND_COLORS[c]) issues.push(`color:${g.id}:${c}`);
    }
    for (const sg of g.subgenres) {
      if (!sg.id || subIds.has(sg.id)) issues.push(`dup_sub:${sg.id}`);
      subIds.add(sg.id);
      for (const uc of sg.use_cases) {
        if (!BACKGROUND_USE_CASES[uc]) issues.push(`use:${sg.id}:${uc}`);
      }
      for (const scene of sg.scenes) {
        if (!scene.id || sceneIds.has(scene.id)) issues.push(`dup_scene:${scene.id}`);
        sceneIds.add(scene.id);
      }
    }
  }
  if (BACKGROUND_DEMAND_GENRES.length !== 26) issues.push(`genre_count:${BACKGROUND_DEMAND_GENRES.length}`);
  return {
    ok: issues.length === 0,
    issues,
    core: BACKGROUND_CORE_GENRE_COUNT,
    supporting: BACKGROUND_SUPPORTING_GENRE_COUNT,
    genres: BACKGROUND_DEMAND_GENRES.length,
    subgenres: subIds.size,
    scenes: sceneIds.size,
  };
}

export function backgroundSpecFingerprint(spec) {
  return [
    spec?.genre,
    spec?.scene,
    spec?.style,
    spec?.background_type,
    spec?.color_family,
    spec?.brightness,
    spec?.copy_space,
    spec?.orientation,
    spec?.complexity,
  ]
    .map((x) => String(x || "").trim())
    .join("|");
}

export function buildBackgroundJapaneseTitle(spec) {
  const found = getBackgroundScene(spec.scene) || getBackgroundSubgenre(spec.subcategory);
  const label = found?.scene?.label_ja || found?.subgenre?.label_ja || spec.subcategory || "背景";
  const styleJa = BACKGROUND_STYLES[spec.style]?.label_ja;
  const colorJa = BACKGROUND_COLORS[spec.color_family]?.label_ja;
  const bits = [styleJa, colorJa].filter(Boolean);
  const title = bits.length ? `${label}（${bits.join("・")}）` : `${label}背景`;
  return title.slice(0, 32);
}

export function buildBackgroundDescription(spec) {
  const g = getBackgroundGenre(spec.genre);
  return [getBackgroundScene(spec.scene)?.scene?.label_ja, g?.label_ja, spec.use_case, spec.background_type]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildBackgroundPromptText(spec) {
  const found = getBackgroundScene(spec.scene);
  const sceneEn = found?.scene?.prompt_en || "an empty backdrop";
  const typeEn = spec.background_type === "photo_like" ? "photorealistic empty" : String(spec.background_type || "abstract").replace(/_/g, " ");
  const copyEn =
    spec.copy_space === "none"
      ? "full-bleed, even coverage"
      : spec.copy_space === "wide_center"
        ? "wide empty center copy space for text"
        : `clear ${spec.copy_space} copy space for text overlay`;
  const density =
    spec.complexity === "minimal" || spec.complexity === "low"
      ? "very low visual density, text-safe"
      : spec.complexity === "rich"
        ? "rich detail kept away from the copy-safe area"
        : "moderate visual density";
  const orientEn =
    spec.orientation === "portrait" ? "vertical 9:16" : spec.orientation === "square" ? "square 1:1" : "wide 16:9";
  const focal =
    spec.copy_space === "left" || spec.copy_space === "right"
      ? `focal area opposite the ${spec.copy_space} copy space`
      : spec.copy_space === "top" || spec.copy_space === "bottom"
        ? `focal area opposite the ${spec.copy_space} copy space`
        : "soft even focus";
  const tokens = [
    "TASFUL_BG_SPEC",
    `genre=${spec.genre || ""}`,
    `sub=${spec.subcategory || ""}`,
    `scene=${spec.scene || ""}`,
    `use=${spec.use_case || ""}`,
    `style=${spec.style || ""}`,
    `orient=${spec.orientation || ""}`,
    `type=${spec.background_type || ""}`,
  ].join(" ");
  return [
    tokens,
    "::",
    `${typeEn} background, ${sceneEn}`,
    `${spec.style} style, ${spec.color_family} color family, ${spec.brightness} brightness`,
    copyEn,
    density,
    focal,
    `${orientEn} composition`,
    "no people, no faces, no hands, no text, no letters, no watermark, no logos, background only",
  ].join(", ");
}

export function drivePathForBackgroundSpec(spec) {
  return `画像素材/背景/${spec.genre}/${String(spec.subcategory || "").replace(/_/g, "-")}`;
}

export function slugForBackgroundSpec(spec, { variation, day, scopeSuffix = "" } = {}) {
  const q = `q${String(variation || 1).padStart(2, "0")}`;
  const dayPart = String(day || "").replace(/-/g, "");
  return [
    spec.genre,
    String(spec.subcategory || "").replace(/_/g, "-"),
    String(spec.scene || "").replace(/_/g, "-"),
    spec.use_case,
    spec.style,
    BACKGROUND_TYPES[spec.background_type]?.slug || "tpabs",
    BACKGROUND_COLORS[spec.color_family]?.slug || "cfblue",
    BACKGROUND_BRIGHTNESS[spec.brightness]?.slug || "brmedium",
    BACKGROUND_COMPLEXITY[spec.complexity]?.slug || "cxlow",
    BACKGROUND_COPY_SPACES[spec.copy_space]?.slug || "csleft",
    spec.orientation,
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

export function parseBackgroundSlugParts(slug) {
  let raw = String(slug || "").trim().toLowerCase();
  const scope = raw.match(/-(production|qa|smoke|local)$/);
  if (scope) raw = raw.slice(0, -scope[0].length);
  const day = raw.match(/-(\d{8})$/);
  if (day) raw = raw.slice(0, -9);
  const q = raw.match(/-q(\d{2})$/);
  if (q) raw = raw.slice(0, -(q[0].length));
  const tokens = raw.split("-").filter(Boolean);
  const orientation = takeKnownFromRight(tokens, new Set(BACKGROUND_ORIENTATIONS));
  const copySlug = takeKnownFromRight(tokens, new Set(Object.values(BACKGROUND_COPY_SPACES).map((x) => x.slug)));
  const cxSlug = takeKnownFromRight(tokens, new Set(Object.values(BACKGROUND_COMPLEXITY).map((x) => x.slug)));
  const brSlug = takeKnownFromRight(tokens, new Set(Object.values(BACKGROUND_BRIGHTNESS).map((x) => x.slug)));
  const cfSlug = takeKnownFromRight(tokens, new Set(Object.values(BACKGROUND_COLORS).map((x) => x.slug)));
  const tpSlug = takeKnownFromRight(tokens, new Set(Object.values(BACKGROUND_TYPES).map((x) => x.slug)));
  const style = takeKnownFromRight(tokens, new Set(Object.keys(BACKGROUND_STYLES)));
  const use_case = takeKnownFromRight(tokens, new Set(Object.keys(BACKGROUND_USE_CASES)));
  const genre = BACKGROUND_DEMAND_GENRES.find((g) => g.id === tokens[0])?.id || tokens[0] || "";
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
    style,
    background_type: TYPE_BY_SLUG.get(tpSlug) || "",
    color_family: COLOR_BY_SLUG.get(cfSlug) || "",
    brightness: BR_BY_SLUG.get(brSlug) || "",
    complexity: CX_BY_SLUG.get(cxSlug) || "",
    copy_space: CS_BY_SLUG.get(copySlug) || "",
    orientation,
  };
}

export function parseBackgroundSpecFromPath({ slug = "", promptText = "", metadata = {} } = {}) {
  if (metadata?.genre && metadata?.scene && metadata?.background_type && metadata?.color_family && metadata?.orientation) {
    return {
      genre: String(metadata.genre),
      subcategory: String(metadata.subcategory || "").replace(/-/g, "_"),
      scene: String(metadata.scene).replace(/-/g, "_"),
      use_case: String(metadata.use_case || ""),
      style: String(metadata.style || ""),
      background_type: String(metadata.background_type || ""),
      color_family: String(metadata.color_family || ""),
      brightness: String(metadata.brightness || ""),
      complexity: String(metadata.complexity || ""),
      copy_space: String(metadata.copy_space || ""),
      orientation: String(metadata.orientation || ""),
      title: metadata.title || "",
    };
  }
  const fromSlug = parseBackgroundSlugParts(slug);
  const genre = getBackgroundGenre(fromSlug.genre);
  const found = getBackgroundSubgenre(fromSlug.subcategory);
  const sceneFound = getBackgroundScene(fromSlug.scene);
  const complete =
    Boolean(genre) &&
    Boolean(found) &&
    Boolean(sceneFound) &&
    Boolean(fromSlug.style) &&
    Boolean(fromSlug.background_type) &&
    Boolean(fromSlug.color_family) &&
    Boolean(fromSlug.orientation) &&
    Boolean(fromSlug.use_case);
  if (!complete) return null;
  const spec = {
    genre: found.genre.id,
    subcategory: found.subgenre.id,
    scene: sceneFound.scene.id,
    use_case: fromSlug.use_case,
    style: fromSlug.style,
    background_type: fromSlug.background_type,
    color_family: fromSlug.color_family,
    brightness: fromSlug.brightness || "medium",
    complexity: fromSlug.complexity || "low",
    copy_space: fromSlug.copy_space || "left",
    orientation: fromSlug.orientation,
    promptText,
  };
  spec.title = buildBackgroundJapaneseTitle(spec);
  spec.description = buildBackgroundDescription(spec);
  spec.prompt = buildBackgroundPromptText(spec);
  return spec;
}

export function backgroundSpecToMetadata(spec) {
  return {
    genre: spec.genre || "",
    subcategory: spec.subcategory || "",
    scene: spec.scene || "",
    use_case: spec.use_case || "",
    style: spec.style || "",
    background_type: spec.background_type || "",
    color_family: spec.color_family || "",
    brightness: spec.brightness || "",
    complexity: spec.complexity || "",
    copy_space: spec.copy_space || "",
    orientation: spec.orientation || "",
    lighting: spec.brightness || "",
    composition: spec.copy_space || "",
    layout: spec.orientation || "",
    feature: spec.complexity || "",
    category: spec.genre || "",
    season: spec.genre === "seasonal" ? spec.subcategory : "",
    people_presence: "absent",
    target: "absent",
  };
}

export function classifyLegacyBackgroundItem(item) {
  const hay = [item.subcategory, item.genre, ...(item.tags || []), item.title, item.slug]
    .map((x) => String(x || ""))
    .join(" ");
  const hits = new Set();
  for (const row of BACKGROUND_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy)) row.genre_ids.forEach((g) => hits.add(g));
  }
  if (hits.size === 1) return { genre: [...hits][0], confidence: "derived" };
  if (hits.size > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: [...hits] };
  return { genre: "unclassified", confidence: "none" };
}

export function pickWeightedOrientation(useCaseId, salt = 0) {
  const weights = BACKGROUND_USE_CASES[useCaseId]?.orientation || { landscape: 70, portrait: 15, square: 15 };
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let n = Math.abs(Number(salt) || 0) % Math.max(1, total);
  for (const [id, w] of entries) {
    n -= w;
    if (n < 0) return id;
  }
  return "landscape";
}

export function pickCopySpace(useCaseId, salt = 0) {
  const high = BACKGROUND_USE_CASES[useCaseId]?.copy === "high";
  const pool = high
    ? ["left", "right", "wide_center", "top", "center", "bottom"]
    : ["none", "left", "right", "center"];
  return pool[Math.abs(salt) % pool.length];
}

export function pickComplexity(useCaseId, salt = 0) {
  const pool = BACKGROUND_USE_CASES[useCaseId]?.complexity || ["low", "medium"];
  return pool[Math.abs(salt) % pool.length];
}
