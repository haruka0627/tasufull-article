/**
 * Materials All List Filter UI / Genre Architecture Unification V1 — Node contract.
 * Projects Demand Genre SSOT + preserved SIDE_CAT keys into list Filter catalogs.
 * Does not redefine Generator taxonomies. Does not delete SIDE_CAT arrays.
 */
import {
  SFX_DEMAND_GENRES,
  SFX_DEMAND_GENRE_SSOT_VERSION,
  SFX_LEGACY_UI_USAGE_MAP,
  SFX_STYLE_CATALOG,
  classifyLegacySfxItem,
} from "./materials-ingest/sfx-demand-genre-ssot.mjs";
import {
  IMAGE_DEMAND_GENRES,
  IMAGE_DEMAND_GENRE_SSOT_VERSION,
  IMAGE_LEGACY_UI_USAGE_MAP,
  IMAGE_USE_CASES,
  IMAGE_PEOPLE_PRESENCE,
  IMAGE_COLOR_FAMILIES,
  IMAGE_STYLE_CATALOG,
  classifyLegacyImageItem,
} from "./materials-ingest/image-demand-genre-ssot.mjs";
import {
  ILLUSTRATION_DEMAND_GENRES,
  ILLUSTRATION_DEMAND_GENRE_SSOT_VERSION,
  ILLUSTRATION_LEGACY_UI_USAGE_MAP,
  ILLUSTRATION_USE_CASES,
  ILLUSTRATION_STYLES,
  classifyLegacyIllustrationItem,
} from "./materials-ingest/illustration-demand-genre-ssot.mjs";
import {
  BACKGROUND_DEMAND_GENRES,
  BACKGROUND_DEMAND_GENRE_SSOT_VERSION,
  BACKGROUND_LEGACY_UI_USAGE_MAP,
  BACKGROUND_USE_CASES,
  BACKGROUND_STYLES,
  BACKGROUND_COLORS,
  BACKGROUND_BRIGHTNESS,
  classifyLegacyBackgroundItem,
} from "./materials-ingest/background-demand-genre-ssot.mjs";
import {
  WEB_DEMAND_GENRES,
  WEB_DEMAND_GENRE_SSOT_VERSION,
  WEB_LEGACY_UI_USAGE_MAP,
  classifyLegacyWebItem,
} from "./materials-ingest/web-demand-genre-ssot.mjs";
import {
  CODE_DEMAND_GENRES,
  CODE_DEMAND_GENRE_SSOT_VERSION,
  CODE_LEGACY_UI_USAGE_MAP,
  classifyLegacyCodeItem,
} from "./materials-ingest/code-demand-genre-ssot.mjs";
import {
  TEXT_DEMAND_GENRES,
  TEXT_DEMAND_GENRE_SSOT_VERSION,
  classifyLegacyTextItem,
} from "./materials-ingest/text-demand-genre-ssot.mjs";
import {
  ICON_DEMAND_GENRES,
  ICON_DEMAND_GENRE_SSOT_VERSION,
  ICON_LEGACY_UI_USAGE_MAP,
  classifyLegacyIconItem,
} from "./materials-ingest/icon-demand-genre-ssot.mjs";
import {
  PRESENTATION_DEMAND_PURPOSES,
  PRESENTATION_DEMAND_SSOT_VERSION,
  PRESENTATION_LEGACY_PURPOSE_MAP,
  classifyLegacyPresentationItem,
} from "./materials-ingest/presentation-demand-genre-ssot.mjs";
import {
  BGM_DEMAND_GENRES,
  BGM_DEMAND_GENRE_SSOT_VERSION,
  BGM_GENRE_ALIAS_TO_CANONICAL,
  BGM_LEGACY_UI_USAGE_MAP,
  classifyLegacyBgmItem,
  resolveBgmGenreAlias,
} from "./materials-ingest/bgm-demand-genre-ssot.mjs";
import {
  CODE_GENRE_ALIAS_TO_CANONICAL,
  TEXT_GENRE_ALIAS_TO_CANONICAL,
  WEB_GENRE_ALIAS_TO_CANONICAL,
  resolveGenreAlias,
} from "./materials-ingest/genre-restructure-web-code-text-v1.mjs";

export const MATERIALS_GENRE_FILTER_CONTRACT_VERSION = "materials-category-distribution-filter-v1";

function compactDemand(genres, source) {
  return genres.map((g) =>
    Object.freeze({
      id: g.id,
      label: g.label_ja,
      source,
      uiOnly: false,
    }),
  );
}

function side(id, extra = {}) {
  return Object.freeze({
    id,
    label: extra.label || id,
    source: "side_cat",
    uiOnly: extra.uiOnly === true,
    tag: extra.tag || "",
    axisNote: extra.axisNote || "genre",
  });
}

/**
 * SIDE_CAT keys must match materials-*-list.js SIDE_CATS (test-enforced).
 * axisNote: genre = connect as ジャンル; language_proxy / other = show catalog, no fake match.
 */
export const SIDE_CAT_GENRE_CATALOGS = Object.freeze({
  background: Object.freeze([
    side("グラデーション"),
    side("テクスチャ"),
    side("自然・風景"),
    side("抽象・パターン"),
    side("ビジネス・シンプル"),
    side("季節・イベント"),
    side("宇宙・空・星"),
    side("その他"),
  ]),
  web: Object.freeze([
    side("バナー・ヘッダー", { uiOnly: true, axisNote: "unbacked" }),
    side("ランディングページ", { tag: "landing" }),
    side("UIパーツ・要素", { uiOnly: true, axisNote: "unbacked" }),
    side("フレーム・囲み枠", { uiOnly: true, axisNote: "unbacked" }),
    side("ボタン", { uiOnly: true, axisNote: "unbacked" }),
    side("吹き出し・マーカー", { uiOnly: true, axisNote: "unbacked" }),
    side("区切り線・装飾", { uiOnly: true, axisNote: "unbacked" }),
    side("グラフ・チャート", { uiOnly: true, axisNote: "unbacked" }),
    side("ヒーロー", { tag: "hero" }),
    side("その他", { uiOnly: true, axisNote: "unbacked" }),
  ]),
  code: Object.freeze([
    side("フロントエンド", { uiOnly: true, axisNote: "unbacked" }),
    side("バックエンド", { tag: "python", axisNote: "language_proxy" }),
    side("データベース", { tag: "csv", axisNote: "language_proxy" }),
    side("UI・コンポーネント", { uiOnly: true, axisNote: "unbacked" }),
    side("API・通信", { uiOnly: true, axisNote: "unbacked" }),
    side("認証・セキュリティ", { uiOnly: true, axisNote: "unbacked" }),
    side("ユーティリティ", { tag: "file", axisNote: "other" }),
    side("その他", { tag: "data", axisNote: "other" }),
  ]),
  template: Object.freeze([
    side("名刺", { tag: "名刺" }),
    side("POP", { tag: "POP" }),
    side("チラシ", { tag: "チラシ" }),
    side("メニュー・料金表", { tag: "料金表" }),
    side("ショップカード", { tag: "ショップカード" }),
    side("提案書・企画書", { tag: "提案" }),
    side("会社紹介・IR", { tag: "会社紹介", uiOnly: true, axisNote: "unbacked" }),
    side("ピッチデッキ", { tag: "ピッチ", uiOnly: true, axisNote: "unbacked" }),
    side("セミナー・講演", { tag: "セミナー", uiOnly: true, axisNote: "unbacked" }),
    side("事業計画・戦略", { tag: "事業計画", uiOnly: true, axisNote: "unbacked" }),
    side("マーケティング", { tag: "マーケティング", uiOnly: true, axisNote: "unbacked" }),
    side("報告書・レポート", { tag: "報告書", uiOnly: true, axisNote: "unbacked" }),
    side("教育・研修", { tag: "教育", uiOnly: true, axisNote: "unbacked" }),
    side("請求書・経理", { tag: "請求書" }),
  ]),
  icon: Object.freeze([
    side("ビジネス・仕事", { tag: "ビジネス" }),
    side("UI・操作", { tag: "UI" }),
    side("SNS・コミュニケーション", { tag: "SNS" }),
    side("デバイス・テクノロジー", { tag: "デバイス" }),
    side("生活・日用品", { tag: "生活" }),
    side("教育・学習", { tag: "教育" }),
    side("医療・健康", { tag: "医療" }),
    side("乗り物・交通", { tag: "交通" }),
    side("スポーツ・趣味", { tag: "スポーツ" }),
    side("その他", { tag: "その他" }),
  ]),
  presentation: Object.freeze([
    side("提案書・企画書", { tag: "提案" }),
    side("会社紹介・IR", { tag: "会社紹介", uiOnly: true, axisNote: "unbacked" }),
    side("ピッチデッキ", { tag: "ピッチ", uiOnly: true, axisNote: "unbacked" }),
    side("セミナー・講演", { tag: "セミナー", uiOnly: true, axisNote: "unbacked" }),
    side("事業計画・戦略", { tag: "事業計画", uiOnly: true, axisNote: "unbacked" }),
    side("マーケティング", { tag: "マーケティング", uiOnly: true, axisNote: "unbacked" }),
    side("報告書・レポート", { tag: "報告書", uiOnly: true, axisNote: "unbacked" }),
    side("教育・研修", { tag: "教育", uiOnly: true, axisNote: "unbacked" }),
    side("営業資料", { tag: "営業資料" }),
    side("その他", { uiOnly: true, axisNote: "unbacked" }),
  ]),
  document: Object.freeze([
    side("ビジネス文書", { tag: "ビジネス" }),
    side("メール文例", { tag: "メール" }),
    side("お知らせ・案内", { tag: "お知らせ" }),
    side("自己紹介・プロフィール", { tag: "自己紹介" }),
    side("お礼・お詫び", { tag: "お礼" }),
    side("SNS・投稿文", { tag: "SNS", uiOnly: true, axisNote: "unbacked" }),
    side("キャッチコピー", { tag: "キャッチコピー", uiOnly: true, axisNote: "unbacked" }),
    side("契約・法務文書", { tag: "契約", uiOnly: true, axisNote: "unbacked" }),
    side("プレスリリース", { tag: "プレス", uiOnly: true, axisNote: "unbacked" }),
    side("その他", { tag: "文書" }),
  ]),
});

export const TYPE_FILTER_LAYOUT = Object.freeze({
  sfx: Object.freeze(["ジャンル", "用途", "スタイル", "長さ", "形式"]),
  bgm: Object.freeze(["ジャンル", "用途", "雰囲気", "長さ", "形式"]),
  image: Object.freeze(["ジャンル", "用途", "人物", "向き", "色", "スタイル", "形式"]),
  illustration: Object.freeze(["ジャンル", "用途", "スタイル", "人物", "背景", "色", "形式"]),
  background: Object.freeze(["ジャンル", "用途", "スタイル", "色", "明るさ", "向き", "形式"]),
  web: Object.freeze(["ジャンル", "用途", "スタイル", "レイアウト", "テーマ", "形式"]),
  code: Object.freeze(["ジャンル", "言語", "Runtime / FW", "用途", "形式", "ライセンス"]),
  template: Object.freeze(["ジャンル", "用途", "業種", "スタイル", "カラー", "形式"]),
  icon: Object.freeze(["ジャンル", "用途", "スタイル", "線", "塗り", "色", "形式"]),
  presentation: Object.freeze(["ジャンル", "デザイン", "カラー", "形式"]),
  document: Object.freeze(["ジャンル", "用途", "文体・トーン", "長さ", "言語"]),
});

/** Types with a Generator Demand Genre SSOT on HEAD. Others must not invent catalogs. */
export const DEMAND_GENRE_CATEGORY_IDS = Object.freeze([
  "sfx",
  "image",
  "illustration",
  "background",
  "web",
  "code",
  "document",
  "icon",
  "presentation",
  "bgm",
]);

export function getGenreCatalog(categoryId) {
  if (categoryId === "sfx") return compactDemand(SFX_DEMAND_GENRES, "demand");
  if (categoryId === "image") return compactDemand(IMAGE_DEMAND_GENRES, "demand");
  if (categoryId === "illustration") return compactDemand(ILLUSTRATION_DEMAND_GENRES, "demand");
  if (categoryId === "background") return compactDemand(BACKGROUND_DEMAND_GENRES, "demand");
  if (categoryId === "web") return compactDemand(WEB_DEMAND_GENRES, "demand");
  if (categoryId === "code") return compactDemand(CODE_DEMAND_GENRES, "demand");
  if (categoryId === "document") return compactDemand(TEXT_DEMAND_GENRES, "demand");
  if (categoryId === "icon") return compactDemand(ICON_DEMAND_GENRES, "demand");
  if (categoryId === "presentation") return compactDemand(PRESENTATION_DEMAND_PURPOSES, "demand");
  if (categoryId === "bgm") return compactDemand(BGM_DEMAND_GENRES, "demand");
  if (SIDE_CAT_GENRE_CATALOGS[categoryId]) return SIDE_CAT_GENRE_CATALOGS[categoryId];
  return [];
}

function normalizeDerived(derived) {
  const genre = derived.genre && derived.genre !== "unclassified" ? derived.genre : derived.purpose && derived.purpose !== "unclassified" ? derived.purpose : "";
  if (derived.confidence === "derived" && genre) return { genre, confidence: "derived" };
  return { genre: "", confidence: derived.confidence || "none", candidates: derived.candidates };
}

export function classifyDemandGenre(item, categoryId) {
  const catalog = getGenreCatalog(categoryId);
  const exact = String(item?.genre || item?.purpose || "").trim();
  if (exact) {
    const canonical =
      categoryId === "bgm" ? resolveBgmGenreAlias(exact) : resolveGenreAlias(categoryId, exact);
    if (canonical && catalog.some((g) => g.id === canonical)) {
      return { genre: canonical, confidence: exact === canonical ? "exact" : "mapped" };
    }
  }
  if (categoryId === "sfx") return normalizeDerived(classifyLegacySfxItem(item));
  if (categoryId === "image") return normalizeDerived(classifyLegacyImageItem(item));
  if (categoryId === "illustration") return normalizeDerived(classifyLegacyIllustrationItem(item));
  if (categoryId === "background") return normalizeDerived(classifyLegacyBackgroundItem(item));
  if (categoryId === "web") return normalizeDerived(classifyLegacyWebItem(item));
  if (categoryId === "code") return normalizeDerived(classifyLegacyCodeItem(item));
  if (categoryId === "document") return normalizeDerived(classifyLegacyTextItem(item));
  if (categoryId === "icon") return normalizeDerived(classifyLegacyIconItem(item));
  if (categoryId === "presentation") return normalizeDerived(classifyLegacyPresentationItem(item));
  if (categoryId === "bgm") return normalizeDerived(classifyLegacyBgmItem(item));
  return { genre: "", confidence: "none" };
}

export function matchSideCatRow(item, row) {
  if (!row || row.uiOnly === true || !row.tag) return false;
  const tag = String(row.tag).toLowerCase();
  return (item?.tags || []).some((t) => String(t).toLowerCase().includes(tag));
}

export function matchListGenre(item, categoryId, genreId) {
  if (!genreId) return true;
  const catalog = getGenreCatalog(categoryId);
  if (catalog.some((g) => g.id === genreId)) {
    const row = catalog.find((g) => g.id === genreId);
    if (row?.source === "side_cat") return matchSideCatRow(item, row);
    return matchDemandGenre(item, categoryId, genreId);
  }
  const side = (SIDE_CAT_GENRE_CATALOGS[categoryId] || []).find((g) => g.id === genreId);
  if (side) return matchSideCatRow(item, side);
  return false;
}

export function matchDemandGenre(item, categoryId, genreId) {
  if (!genreId) return true;
  const classified = classifyDemandGenre(item, categoryId);
  return classified.genre === genreId;
}

export function buildBrowserPayload() {
  return {
    version: MATERIALS_GENRE_FILTER_CONTRACT_VERSION,
    sfxDemandVersion: SFX_DEMAND_GENRE_SSOT_VERSION,
    imageDemandVersion: IMAGE_DEMAND_GENRE_SSOT_VERSION,
    catalogs: {
      sfx: compactDemand(SFX_DEMAND_GENRES, "demand"),
      image: compactDemand(IMAGE_DEMAND_GENRES, "demand"),
      illustration: compactDemand(ILLUSTRATION_DEMAND_GENRES, "demand"),
      background: compactDemand(BACKGROUND_DEMAND_GENRES, "demand"),
      bgm: compactDemand(BGM_DEMAND_GENRES, "demand"),
      web: compactDemand(WEB_DEMAND_GENRES, "demand"),
      code: compactDemand(CODE_DEMAND_GENRES, "demand"),
      template: SIDE_CAT_GENRE_CATALOGS.template,
      icon: compactDemand(ICON_DEMAND_GENRES, "demand"),
      presentation: compactDemand(PRESENTATION_DEMAND_PURPOSES, "demand"),
      document: compactDemand(TEXT_DEMAND_GENRES, "demand"),
    },
    sideCatCatalogs: SIDE_CAT_GENRE_CATALOGS,
    sfxLegacyMap: SFX_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    imageLegacyMap: IMAGE_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    illustrationLegacyMap: ILLUSTRATION_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    illustrationDemandVersion: ILLUSTRATION_DEMAND_GENRE_SSOT_VERSION,
    backgroundDemandVersion: BACKGROUND_DEMAND_GENRE_SSOT_VERSION,
    backgroundLegacyMap: BACKGROUND_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    webDemandVersion: WEB_DEMAND_GENRE_SSOT_VERSION,
    webLegacyMap: WEB_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    codeDemandVersion: CODE_DEMAND_GENRE_SSOT_VERSION,
    codeLegacyMap: CODE_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    documentDemandVersion: TEXT_DEMAND_GENRE_SSOT_VERSION,
    bgmDemandVersion: BGM_DEMAND_GENRE_SSOT_VERSION,
    bgmLegacyMap: BGM_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    genreAliases: Object.freeze({
      web: WEB_GENRE_ALIAS_TO_CANONICAL,
      code: CODE_GENRE_ALIAS_TO_CANONICAL,
      document: TEXT_GENRE_ALIAS_TO_CANONICAL,
      bgm: BGM_GENRE_ALIAS_TO_CANONICAL,
    }),
    documentLegacyMap: Object.freeze([
      { legacy: "メール", genre_ids: ["businessemail"] },
      { legacy: "email", genre_ids: ["businessemail"] },
      { legacy: "sns", genre_ids: ["snspost"] },
      { legacy: "投稿", genre_ids: ["snspost"] },
      { legacy: "お知らせ", genre_ids: ["announcement"] },
      { legacy: "告知", genre_ids: ["announcement"] },
    ]),
    iconDemandVersion: ICON_DEMAND_GENRE_SSOT_VERSION,
    iconLegacyMap: ICON_LEGACY_UI_USAGE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [...row.genre_ids],
    })),
    presentationDemandVersion: PRESENTATION_DEMAND_SSOT_VERSION,
    presentationLegacyMap: PRESENTATION_LEGACY_PURPOSE_MAP.map((row) => ({
      legacy: row.legacy,
      genre_ids: [row.purpose_id],
    })),
    backgroundUseCases: Object.values(BACKGROUND_USE_CASES).map((u) => ({ id: u.id, label: u.label_ja })),
    backgroundStyles: Object.values(BACKGROUND_STYLES).map((s) => ({ id: s.id, label: s.label_ja })),
    backgroundColors: Object.values(BACKGROUND_COLORS).map((c) => ({ id: c.id, label: c.label_ja })),
    backgroundBrightness: Object.values(BACKGROUND_BRIGHTNESS).map((b) => ({ id: b.id, label: b.label_ja })),
    imageStyles: Object.values(IMAGE_STYLE_CATALOG).map((s) => ({ id: s.id, label: s.label_ja })),
    sfxStyles: Object.values(SFX_STYLE_CATALOG).map((s) => ({ id: s.id, label: s.label_ja })),
    illustrationUseCases: Object.values(ILLUSTRATION_USE_CASES).map((u) => ({ id: u.id, label: u.label_ja })),
    illustrationStyles: Object.values(ILLUSTRATION_STYLES).map((s) => ({ id: s.id, label: s.label_ja })),
    imageUseCases: Object.values(IMAGE_USE_CASES).map((u) => ({ id: u.id, label: u.label_ja })),
    imagePeople: IMAGE_PEOPLE_PRESENCE.map((id) => ({
      id,
      label: id === "present" ? "人物あり" : id === "absent" ? "人物なし" : id,
    })),
    imageColors: IMAGE_COLOR_FAMILIES.map((id) => ({ id, label: id })),
    filterLayout: TYPE_FILTER_LAYOUT,
  };
}

export {
  SFX_DEMAND_GENRES,
  IMAGE_DEMAND_GENRES,
  ILLUSTRATION_DEMAND_GENRES,
  BACKGROUND_DEMAND_GENRES,
  WEB_DEMAND_GENRES,
  CODE_DEMAND_GENRES,
  TEXT_DEMAND_GENRES,
  ICON_DEMAND_GENRES,
  PRESENTATION_DEMAND_PURPOSES,
  BGM_DEMAND_GENRES,
  classifyLegacySfxItem,
  classifyLegacyImageItem,
  classifyLegacyIllustrationItem,
  classifyLegacyBackgroundItem,
  classifyLegacyWebItem,
  classifyLegacyCodeItem,
  classifyLegacyTextItem,
  classifyLegacyIconItem,
  classifyLegacyPresentationItem,
  classifyLegacyBgmItem,
};
