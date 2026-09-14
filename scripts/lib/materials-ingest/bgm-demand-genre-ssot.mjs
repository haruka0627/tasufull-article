/**
 * BGM Demand Genre SSOT V1 — Materials UI ジャンル（16 mood/use families).
 * Internal IDs are English slugs. Japanese labels are presentation only.
 * Does not enable generators. Does not publish. Drive folders stay PRIVATE.
 */
import { composeGenerationDisplayTitleJa } from "./japanese-display-title.mjs";

export const BGM_DEMAND_GENRE_SSOT_VERSION = "materials-bgm-demand-genre-ssot-v1";

export const BGM_PUBLIC_STATUS = Object.freeze({
  PRIVATE: "PRIVATE",
  UNPUBLISHED: "UNPUBLISHED",
});

/** Future asset manifest fields (align with existing private-metadata.json). */
export const BGM_ASSET_MANIFEST_FIELDS = Object.freeze([
  "asset_id",
  "title",
  "title_ja",
  "display_title",
  "genre",
  "usage",
  "duration",
  "duration_sec",
  "format",
  "file_format",
  "generator",
  "model",
  "model_id",
  "model_version",
  "model_commit_sha",
  "model_commit",
  "prompt",
  "seed",
  "generated_at",
  "created_at",
  "qa_status",
  "quality_status",
  "license",
  "public_status",
  "public_publish_status",
]);

function genre(id, labelJa, labelEn, driveFolder, extra = {}) {
  return Object.freeze({
    id,
    path_id: id,
    tier: extra.tier || "core",
    demand_weight: extra.demand_weight || 8,
    label_ja: labelJa,
    label_en: labelEn,
    drive_folder: driveFolder,
    public_status: BGM_PUBLIC_STATUS.PRIVATE,
    reuse_existing: extra.reuse_existing === true,
  });
}

/**
 * Folders are relative to ingest driveRoots.bgm (`G:/マイドライブ/BGM`).
 * Same-meaning existing folders are reused (no Japanese duplicate names).
 */
export const BGM_DEMAND_GENRES = Object.freeze([
  genre("brightpop", "明るい・ポップ", "BRIGHT / POP", "_private-inventory/brightpop"),
  genre("cafe", "おしゃれ・カフェ", "CAFE / STYLISH", "_private-inventory/stylish", { reuse_existing: true }),
  genre("fresh", "爽やか・前向き", "FRESH / UPBEAT", "_private-inventory/fresh"),
  genre("relax", "落ち着く・リラックス", "RELAX / CALM", "_private-inventory/lofi", { reuse_existing: true }),
  genre("emotional", "感動・エモーショナル", "EMOTIONAL", "_private-inventory/emotional", { reuse_existing: true }),
  genre("comic", "楽しい・コミカル", "COMIC / FUN", "_private-inventory/comic"),
  genre("cute", "かわいい", "CUTE", "_private-inventory/cute", { reuse_existing: true }),
  genre("cool", "かっこいい・スタイリッシュ", "COOL / STYLISH", "_private-inventory/cool", { reuse_existing: true }),
  genre("cinematic", "シネマティック・壮大", "CINEMATIC", "_private-inventory/cinematic", { reuse_existing: true }),
  genre("tense", "緊張・サスペンス", "TENSE / SUSPENSE", "_private-inventory/tense", { reuse_existing: true }),
  genre("horror", "ホラー・不気味", "HORROR", "_private-inventory/horror"),
  genre("japanese", "和風", "JAPANESE / WA", "_private-inventory/japanese"),
  genre("game", "ゲーム", "GAME", "_private-inventory/game", { reuse_existing: true }),
  genre("corporate", "企業・ビジネス", "CORPORATE / BUSINESS", "_private-inventory/corporate"),
  genre("youtube", "配信・YouTube", "STREAMING / YOUTUBE", "_private-inventory/youtube"),
  genre("shortsns", "ショート動画・SNS", "SHORT / SNS", "_private-inventory/shortsns"),
]);

const BY_ID = new Map(BGM_DEMAND_GENRES.map((g) => [g.id, g]));

export const BGM_CANONICAL_GENRE_IDS = Object.freeze(BGM_DEMAND_GENRES.map((g) => g.id));

/** AutoGenerator / private-inventory ids → canonical UI genre. No title guessing. */
export const BGM_GENRE_ALIAS_TO_CANONICAL = Object.freeze({
  stylish: "cafe",
  lofi: "relax",
  "lo-fi": "relax",
  cute: "cute",
  cool: "cool",
  emotional: "emotional",
  cinematic: "cinematic",
  tense: "tense",
  game: "game",
  corporate: "corporate",
  horror: "horror",
  brightpop: "brightpop",
  cafe: "cafe",
  fresh: "fresh",
  relax: "relax",
  comic: "comic",
  japanese: "japanese",
  youtube: "youtube",
  shortsns: "shortsns",
});

export const BGM_LEGACY_UI_USAGE_MAP = Object.freeze([
  { legacy: "かわいい", genre_ids: ["cute"] },
  { legacy: "Cute", genre_ids: ["cute"] },
  { legacy: "cute", genre_ids: ["cute"] },
  { legacy: "かっこいい", genre_ids: ["cool"] },
  { legacy: "Cool", genre_ids: ["cool"] },
  { legacy: "cool", genre_ids: ["cool"] },
  { legacy: "おしゃれ", genre_ids: ["cafe"] },
  { legacy: "Stylish", genre_ids: ["cafe"] },
  { legacy: "stylish", genre_ids: ["cafe"] },
  { legacy: "落ち着く", genre_ids: ["relax"] },
  { legacy: "Lofi", genre_ids: ["relax"] },
  { legacy: "lofi", genre_ids: ["relax"] },
  { legacy: "感動", genre_ids: ["emotional"] },
  { legacy: "Emotional", genre_ids: ["emotional"] },
  { legacy: "emotional", genre_ids: ["emotional"] },
  { legacy: "シネマティック", genre_ids: ["cinematic"] },
  { legacy: "Cinematic", genre_ids: ["cinematic"] },
  { legacy: "cinematic", genre_ids: ["cinematic"] },
  { legacy: "緊張", genre_ids: ["tense"] },
  { legacy: "Tense", genre_ids: ["tense"] },
  { legacy: "tense", genre_ids: ["tense"] },
  { legacy: "ホラー", genre_ids: ["horror"] },
  { legacy: "Horror", genre_ids: ["horror"] },
  { legacy: "ゲーム", genre_ids: ["game"] },
  { legacy: "Game", genre_ids: ["game"] },
  { legacy: "game", genre_ids: ["game"] },
  { legacy: "企業", genre_ids: ["corporate"] },
  { legacy: "ビジネス", genre_ids: ["corporate"] },
  { legacy: "Corporate", genre_ids: ["corporate"] },
  { legacy: "和風", genre_ids: ["japanese"] },
]);

export function getBgmGenre(id) {
  const raw = String(id || "").trim();
  const canonical = BGM_GENRE_ALIAS_TO_CANONICAL[raw] || raw;
  return BY_ID.get(canonical) || null;
}

export function resolveBgmGenreAlias(genreId) {
  const raw = String(genreId || "").trim();
  if (!raw) return "";
  return BGM_GENRE_ALIAS_TO_CANONICAL[raw] || raw;
}

export function classifyLegacyBgmItem(item) {
  const exact = resolveBgmGenreAlias(item?.genre || item?.subcategory || "");
  if (exact && BY_ID.has(exact)) return { genre: exact, confidence: "exact" };
  const hay = [item?.title, item?.subcategory, ...(item?.tags || [])].map((x) => String(x || "")).join("|");
  const hits = [];
  for (const row of BGM_LEGACY_UI_USAGE_MAP) {
    if (hay.includes(row.legacy) && !hits.includes(row.genre_ids[0])) hits.push(row.genre_ids[0]);
  }
  if (hits.length === 1) return { genre: hits[0], confidence: "derived" };
  if (hits.length > 1) return { genre: "unclassified", confidence: "ambiguous", candidates: hits };
  return { genre: "unclassified", confidence: "none" };
}

export function drivePathForBgmSpec(spec, bgmRoot) {
  const g = getBgmGenre(spec?.genre);
  const rel = g?.drive_folder || `_private-inventory/${spec?.genre || "unmapped"}`;
  if (!bgmRoot) return rel;
  return `${String(bgmRoot).replace(/\\/g, "/")}/${rel}`;
}

export function bgmSpecToMetadata(spec) {
  const g = getBgmGenre(spec?.genre);
  return {
    genre: g?.id || "",
    subcategory: spec?.subcategory || g?.id || "",
    usage: spec?.usage || "",
    duration: spec?.duration || "",
    format: spec?.format || spec?.file_format || "wav",
    generator: spec?.generator || "",
    model: spec?.model || spec?.model_id || "",
    model_version: spec?.model_version || "",
    model_commit_sha: spec?.model_commit_sha || spec?.model_commit || "",
    prompt: spec?.prompt || "",
    seed: spec?.seed ?? "",
    generated_at: spec?.generated_at || spec?.created_at || "",
    qa_status: spec?.qa_status || spec?.quality_status || "",
    license: spec?.license || "",
    public_status: BGM_PUBLIC_STATUS.PRIVATE,
    public_publish_status: "UNPUBLISHED",
  };
}

export function buildBgmJapaneseTitle(spec = {}) {
  const g = getBgmGenre(spec.genre);
  return composeGenerationDisplayTitleJa({
    category: "bgm",
    genre: spec.genre,
    genre_label_ja: g?.label_ja,
    usage: spec.usage,
    used: spec.used,
  });
}

export function validateBgmGenreSsot() {
  const issues = [];
  const ids = new Set();
  for (const g of BGM_DEMAND_GENRES) {
    if (!g.id || !/^[a-z][a-z0-9]*$/.test(g.id)) issues.push(`bad_id:${g.id}`);
    if (ids.has(g.id)) issues.push(`dup:${g.id}`);
    ids.add(g.id);
    if (g.id === "default" || g.label_ja === "その他") issues.push(`forbidden:${g.id}`);
    if (!g.drive_folder || !g.drive_folder.startsWith("_private-inventory/")) {
      issues.push(`drive_not_private:${g.id}`);
    }
  }
  if (BGM_DEMAND_GENRES.length !== 16) issues.push(`genre_count:${BGM_DEMAND_GENRES.length}`);
  return { ok: issues.length === 0, issues, genres: BGM_DEMAND_GENRES.length };
}
