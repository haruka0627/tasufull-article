/**
 * TASFUL Materials — category SSOT (video-first V1)
 *
 * Display labels vs internal values are separate.
 * Primary chips are video-production oriented.
 * Legacy categories stay URL-compatible and filterable; they are not primary chips.
 * Do not remap mixed `image` (画像素材) → `photo` (写真).
 */
(function (global) {
  "use strict";

  const ALL = Object.freeze({ id: "all", label: "すべて", kind: "all" });

  const PRIMARY = Object.freeze([
    ALL,
    Object.freeze({ id: "bgm", label: "BGM", kind: "primary" }),
    Object.freeze({ id: "sfx", label: "効果音/SFX", kind: "primary" }),
    Object.freeze({ id: "photo", label: "写真", kind: "primary" }),
    Object.freeze({ id: "illustration", label: "イラスト", kind: "primary" }),
    Object.freeze({ id: "background", label: "背景", kind: "primary" }),
    Object.freeze({ id: "icon", label: "アイコン", kind: "primary" }),
    Object.freeze({ id: "overlay", label: "オーバーレイ", kind: "primary" }),
    Object.freeze({ id: "frame", label: "フレーム・装飾", kind: "primary" }),
    Object.freeze({ id: "telop", label: "テロップ素材", kind: "primary" }),
    Object.freeze({ id: "transition", label: "トランジション", kind: "primary" }),
  ]);

  const LEGACY = Object.freeze([
    Object.freeze({ id: "template", label: "テンプレート", kind: "legacy" }),
    Object.freeze({ id: "web", label: "Web素材", kind: "legacy" }),
    Object.freeze({ id: "code", label: "コード", kind: "legacy" }),
    Object.freeze({ id: "document", label: "文例・文章テンプレート", kind: "legacy" }),
    Object.freeze({ id: "tool", label: "ツール", kind: "legacy" }),
    Object.freeze({ id: "presentation", label: "プレゼン", kind: "legacy" }),
    Object.freeze({
      id: "image",
      label: "画像素材",
      kind: "legacy",
      mapping: "UNKNOWN",
      note: "Staging の image は自然/automation/river 等が混在。写真へ一括 remap しない。",
    }),
  ]);

  const FINDING_ONLY = Object.freeze([
    Object.freeze({
      id: "thumbnail",
      label: "サムネイル",
      kind: "finding",
      note: "Primary chip ではない。用途タグが無い場合のみ Finding に出す。",
    }),
  ]);

  const HIDDEN_FROM_PRIMARY_IDS = Object.freeze(LEGACY.map((c) => c.id));

  const ALIAS_TO_ID = Object.freeze({
    all: "all",
    すべて: "all",
    bgm: "bgm",
    sfx: "sfx",
    "効果音/sfx": "sfx",
    効果音: "sfx",
    "sfx": "sfx",
    photo: "photo",
    写真: "photo",
    illustration: "illustration",
    イラスト: "illustration",
    background: "background",
    背景: "background",
    icon: "icon",
    アイコン: "icon",
    overlay: "overlay",
    オーバーレイ: "overlay",
    frame: "frame",
    "フレーム・装飾": "frame",
    フレーム: "frame",
    telop: "telop",
    テロップ素材: "telop",
    テロップ: "telop",
    transition: "transition",
    トランジション: "transition",
    template: "template",
    テンプレート: "template",
    web: "web",
    web素材: "web",
    code: "code",
    コード: "code",
    document: "document",
    "文例・文章テンプレート": "document",
    文例: "document",
    tool: "tool",
    ツール: "tool",
    presentation: "presentation",
    プレゼン: "presentation",
    image: "image",
    画像素材: "image",
    thumbnail: "thumbnail",
    サムネイル: "thumbnail",
  });

  const IMAGE_FAMILY = Object.freeze([
    "photo",
    "illustration",
    "background",
    "icon",
    "overlay",
    "frame",
    "telop",
    "image",
  ]);

  const FILTERS = Object.freeze({
    color: Object.freeze({
      id: "color",
      label: "カラー",
      kind: "shared",
      families: IMAGE_FAMILY,
    }),
    format: Object.freeze({
      id: "format",
      label: "形式",
      kind: "shared",
      families: IMAGE_FAMILY,
    }),
    slide_size: Object.freeze({
      id: "slide_size",
      label: "スライドサイズ",
      kind: "presentation_only",
      families: Object.freeze(["presentation"]),
    }),
    slide_theme: Object.freeze({
      id: "slide_theme",
      label: "テーマ",
      kind: "presentation_only",
      families: Object.freeze(["presentation"]),
    }),
  });

  const TRANSPARENCY = Object.freeze({
    id: "transparent",
    label: "透過素材",
    status: "DEFERRED",
    reason: "透過はカテゴリではない。実メタデータが無いため attribute filter も出さない。",
  });

  const ALL_DEFS = Object.freeze([...PRIMARY, ...LEGACY, ...FINDING_ONLY]);
  const BY_ID = Object.freeze(
    ALL_DEFS.reduce((acc, def) => {
      acc[def.id] = def;
      return acc;
    }, Object.create(null))
  );

  function normalizeKey(raw) {
    return String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function resolveCategoryId(raw) {
    const key = normalizeKey(raw);
    if (!key || key === "transparent" || key === "透過素材") return "all";
    if (ALIAS_TO_ID[key]) return ALIAS_TO_ID[key];
    if (BY_ID[key]) return key;
    return "";
  }

  function getCategoryDef(raw) {
    const id = resolveCategoryId(raw);
    return id && BY_ID[id] ? BY_ID[id] : null;
  }

  function isPrimaryChip(raw) {
    const id = resolveCategoryId(raw);
    return PRIMARY.some((c) => c.id === id);
  }

  function isLegacyCategory(raw) {
    const id = resolveCategoryId(raw);
    return LEGACY.some((c) => c.id === id);
  }

  function isFindingOnly(raw) {
    const id = resolveCategoryId(raw);
    return FINDING_ONLY.some((c) => c.id === id);
  }

  function getPrimaryChips() {
    return PRIMARY.slice();
  }

  function getLegacyCategories() {
    return LEGACY.slice();
  }

  function getVisibleFilters(rawCategory) {
    const id = resolveCategoryId(rawCategory) || "all";
    return Object.values(FILTERS).filter((f) => {
      if (f.kind === "presentation_only") return id === "presentation";
      if (id === "all") return f.kind === "shared";
      return f.families.includes(id);
    });
  }

  function shouldShowPresentationFilters(rawCategory) {
    return resolveCategoryId(rawCategory) === "presentation";
  }

  function shouldShowTransparencyFilter() {
    return false;
  }

  function remapImageToPhoto() {
    return Object.freeze({
      remapped: false,
      mapping: "UNKNOWN",
      from: "image",
      to: "photo",
      reason: "image は混在カテゴリ。写真への speculative remap はしない。",
    });
  }

  function labelFor(raw) {
    const def = getCategoryDef(raw);
    if (def) return def.label;
    const id = resolveCategoryId(raw);
    if (id === "all") return ALL.label;
    return String(raw || "").trim();
  }

  const api = Object.freeze({
    ALL,
    PRIMARY,
    LEGACY,
    FINDING_ONLY,
    HIDDEN_FROM_PRIMARY_IDS,
    ALIAS_TO_ID,
    IMAGE_FAMILY,
    FILTERS,
    TRANSPARENCY,
    BY_ID,
    normalizeKey,
    resolveCategoryId,
    getCategoryDef,
    isPrimaryChip,
    isLegacyCategory,
    isFindingOnly,
    getPrimaryChips,
    getLegacyCategories,
    getVisibleFilters,
    shouldShowPresentationFilters,
    shouldShowTransparencyFilter,
    remapImageToPhoto,
    labelFor,
  });

  global.TasuMaterialsCategories = api;
})(typeof window !== "undefined" ? window : globalThis);
