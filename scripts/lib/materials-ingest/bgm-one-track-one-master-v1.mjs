/**
 * BGM one-track-one-master V1.
 * 1 GENRE × 1 UNIQUE CONCEPT → 1 TRACK → 1 QA PASS → 1 Drive master file.
 * Does not enable generators. Does not publish. Does not delete Drive files.
 */
import path from "node:path";

export const BGM_ONE_TRACK_ONE_MASTER_VERSION = "materials-bgm-one-track-one-master-v1";

export const BGM_MASTER_FORMAT = "wav";
export const BGM_WORKSPACE_NOT_INVENTORY_DIR = "_workspace-not-inventory";
export const BGM_DUPLICATE_CANDIDATE_DIR = "_duplicate-candidates";

const SKIP_DIR = new Set([
  ".tmp",
  "node_modules",
  "__pycache__",
  ".git",
  BGM_WORKSPACE_NOT_INVENTORY_DIR,
  BGM_DUPLICATE_CANDIDATE_DIR,
]);

function concept(id, titleJa, promptExtra) {
  return Object.freeze({ id, title_ja: titleJa, prompt_extra: promptExtra });
}

const CAFE_FAMILY = Object.freeze([
  concept("morning_cafe", "朝のカフェ", "morning cafe, warm daylight, soft bossa, unobtrusive under narration"),
  concept("night_lounge", "夜のラウンジ", "night lounge, low lights, mellow groove, late evening"),
  concept("light_acoustic", "軽快なアコースティック", "light acoustic guitar, airy daytime, simple progression"),
  concept("quiet_work", "静かな作業用", "quiet focus bed, minimal percussion, no busy fills"),
  concept("urban_chill", "都会的なチル", "urban chill, modern city evening, restrained beat"),
]);

/** Unique concepts per genre. Same genre may have many tracks only via distinct concepts. */
export const BGM_UNIQUE_CONCEPTS = Object.freeze({
  cafe: CAFE_FAMILY,
  stylish: CAFE_FAMILY,
  ambient: Object.freeze([
    concept("quiet_night", "静かな夜のアンビエンス", "quiet night ambience, no drums, slow pads, spacious"),
    concept("soft_dawn", "やわらかい夜明けの余白", "soft dawn pads, barely-there movement, no melody hook"),
    concept("deep_space", "深い空間のドローン", "deep atmospheric drone, dark-but-calm, no percussion"),
  ]),
  cool: Object.freeze([
    concept("urban_cool", "都会的なクール・ビート", "urban cool beat, modern bass, confident but not aggressive"),
    concept("night_drive", "夜のドライヴ・グルーヴ", "night drive groove, muted guitar, tight drums"),
    concept("minimal_pulse", "ミニマルなパルス", "minimal pulse, sparse hits, stylish restraint"),
  ]),
  game: Object.freeze([
    concept("adventure_stage", "軽快なゲーム・アドベンチャー", "light game adventure bed, bright ostinato, loopable stage"),
    concept("menu_chime", "メニュー画面の軽やかさ", "playful menu bed, short motif, low intensity"),
    concept("field_explore", "フィールド探索のリズム", "exploration field loop, mid tempo, hopeful"),
  ]),
  cinematic: Object.freeze([
    concept("story_swell", "物語を運ぶシネマティックBGM", "storytelling cinematic swell, restrained, no trailer boom"),
    concept("quiet_resolve", "静かに着地する余韻", "quiet cinematic resolve, strings hold, no climax drop"),
  ]),
  cooking: Object.freeze([
    concept("warm_kitchen", "料理が進むあたたかいBGM", "warm kitchen bed, soft bossa, unobtrusive under cooking narration"),
    concept("weekend_brunch", "週末ブランチの陽気さ", "weekend brunch, light acoustic, friendly"),
  ]),
  cute: Object.freeze([
    concept("toy_piano", "おもちゃピアノのかわいいメロディ", "toy piano melody, playful, friendly, no vocals"),
    concept("soft_bounce", "やさしく弾むかわいいメロディ", "soft bounce, pizzicato, light drums"),
  ]),
  emotional: Object.freeze([
    concept("lingering_warmth", "心に残る感動のメロディ", "warm emotional melody, gentle piano, hopeful"),
    concept("quiet_letter", "手紙を書く夜", "quiet letter-writing piano, sparse, sincere"),
  ]),
  lofi: Object.freeze([
    concept("dusty_afternoon", "ほこりっぽいLo-fiの昼下がり", "dusty lofi afternoon, vinyl texture, calm"),
    concept("late_study", "夜更けの作業用Lo-fi", "late-night study lofi, low drums, no vocal chops"),
  ]),
  tense: Object.freeze([
    concept("low_pulse", "低音が脈打つ緊張のBGM", "low pulse suspense bed, sparse hits, no explosion"),
    concept("held_breath", "息をひそめる緊張", "held-breath tension, atmospheric noise, restrained"),
  ]),
  travel: Object.freeze([
    concept("open_road", "旅の景色が広がるアコースティック", "open-road acoustic, breezy, travel scenery"),
    concept("station_morning", "朝の駅からはじまる旅", "morning station acoustic, light shaker, departing"),
  ]),
  vlog: Object.freeze([
    concept("bright_day", "明るく進むVlogの一日", "bright vlog day, light percussion, breezy"),
    concept("city_walk", "街を歩く軽快なVlog", "city-walk vlog, acoustic, medium-high energy"),
  ]),
  corporate: Object.freeze([
    concept("morning_office", "朝のポジティブ・コーポレート", "morning corporate, soft piano, stable professional"),
    concept("product_brief", "落ち着いた説明用ビジネスBGM", "calm business explainer, muted electric, gentle pulse"),
  ]),
  product: Object.freeze([
    concept("premium_showcase", "商品が映えるプレミアムBGM", "premium product showcase, clean electric, modern"),
    concept("soft_unbox", "開封のやさしいテンポ", "soft unboxing bed, unobtrusive, premium"),
  ]),
  tech: Object.freeze([
    concept("clean_future", "クリーンな未来のパルス", "clean futuristic pulse, soft arpeggio, no lead vocal"),
    concept("lab_focus", "ラボの静かな集中", "lab-focus tech bed, subtle pulse, precise"),
  ]),
  brightpop: Object.freeze([
    concept("morning_pop", "朝のポジティブ・ポップ", "bright morning pop instrumental, uplifting, no vocals"),
  ]),
  fresh: Object.freeze([
    concept("forward_fresh", "爽やかに進む前向きBGM", "fresh forward instrumental, clean, optimistic"),
  ]),
  relax: Object.freeze([
    concept("calm_space", "落ち着くLo-fiの余白", "calm relax bed, soft, plenty of space"),
  ]),
  comic: Object.freeze([
    concept("light_gag", "軽快で楽しいコミカルBGM", "light comic instrumental, playful, not cartoon-stinger spam"),
  ]),
  horror: Object.freeze([
    concept("uneasy_air", "肌がざわつくホラーの気配", "uneasy horror atmosphere, no jump-scare boom"),
  ]),
  japanese: Object.freeze([
    concept("wa_scent", "和の香りがする調べ", "japanese-inspired instrumental, restrained, original"),
  ]),
  youtube: Object.freeze([
    concept("stream_bed", "配信が続くYouTube向けBGM", "streaming bed, loopable, under speech"),
  ]),
  shortsns: Object.freeze([
    concept("short_hook", "短尺で映えるSNS向けBGM", "short-form hook bed, quick identity, no vocals"),
  ]),
});

export function listBgmUniqueConcepts(genre) {
  return BGM_UNIQUE_CONCEPTS[String(genre || "")] || [];
}

export function pickBgmUniqueConcept(genre, usedIds = new Set()) {
  const list = listBgmUniqueConcepts(genre);
  if (!list.length) {
    return { ok: false, reason: "no_unique_concepts_for_genre", genre };
  }
  const pick = list.find((c) => !usedIds.has(`${genre}:${c.id}`)) || null;
  if (!pick) {
    return { ok: false, reason: "unique_concepts_exhausted", genre, available: list.length };
  }
  return { ok: true, concept: pick };
}

export function isBgmWorkspaceNotInventory(relOrName) {
  const s = String(relOrName || "").replace(/\\/g, "/");
  if (s.includes(`/${BGM_WORKSPACE_NOT_INVENTORY_DIR}/`) || s.includes(`${BGM_WORKSPACE_NOT_INVENTORY_DIR}/`)) return true;
  if (s.includes(`/${BGM_DUPLICATE_CANDIDATE_DIR}/`)) return true;
  if (s.includes("/.tmp/") || s.startsWith(".tmp/")) return true;
  const base = s.split("/").pop() || s;
  if (/\.original\./i.test(base)) return true;
  if (/^preview[-_.]/i.test(base) || /\.preview\./i.test(base)) return true;
  return false;
}

export function classifyBgmAudioRole(filePath, root) {
  const rel = path.relative(root || path.dirname(filePath), filePath).replace(/\\/g, "/");
  const base = path.basename(filePath);
  if (isBgmWorkspaceNotInventory(rel) || isBgmWorkspaceNotInventory(base)) {
    return "WORKSPACE_NOT_INVENTORY";
  }
  if (SKIP_DIR.has(path.basename(path.dirname(filePath)))) return "WORKSPACE_NOT_INVENTORY";
  return "MASTER_CANDIDATE";
}

export function packageDirForBgmFile(filePath) {
  return path.dirname(filePath);
}

/**
 * Inventory count = unique package masters, not raw wav copies.
 * Multiple wavs in one package (001/002) without distinct concept_id count as 1 track.
 */
export function groupBgmInventoryPackages(files, root) {
  const packages = new Map();
  for (const f of files) {
    if (classifyBgmAudioRole(f, root) !== "MASTER_CANDIDATE") continue;
    const dir = packageDirForBgmFile(f);
    const list = packages.get(dir) || [];
    list.push(f);
    packages.set(dir, list);
  }
  return [...packages.entries()].map(([dir, wavs]) => {
    const sorted = [...wavs].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
    return {
      dir,
      wavs: sorted,
      master: sorted[0],
      extra: sorted.slice(1),
      track_count_files: sorted.length,
      inventory_tracks: 1,
    };
  });
}

export function assertOneMasterSave(files) {
  const reasons = [];
  if (!Array.isArray(files) || files.length !== 1) reasons.push("save_file_count_not_1");
  const name = files?.[0]?.name || "";
  if (name && (isBgmWorkspaceNotInventory(name) || !/\.wav$/i.test(name))) {
    reasons.push("save_not_single_master_wav");
  }
  return { ok: reasons.length === 0, reasons };
}

export function checkBgmOneTrackGates(candidate, state = {}) {
  const reasons = [];
  const assetId = String(candidate.asset_id || "").trim();
  const title = String(candidate.title || candidate.title_ja || candidate.display_title || "").trim();
  const prompt = String(candidate.prompt || candidate.promptText || "").trim();
  const conceptId = String(candidate.concept_id || "").trim();
  const genre = String(candidate.genre || "").trim();
  const hash = candidate.sha256 || candidate.file_hash;
  if (!assetId) reasons.push("missing_asset_id");
  if (state.assetIds instanceof Set && assetId && state.assetIds.has(assetId)) reasons.push("duplicate_asset_id");
  if (state.titles instanceof Set && title && state.titles.has(title)) reasons.push("same_title_repetition");
  if (state.prompts instanceof Set && prompt && state.prompts.has(prompt)) reasons.push("repeated_prompt");
  if (state.concepts instanceof Set && conceptId && genre && state.concepts.has(`${genre}:${conceptId}`)) {
    reasons.push("same_genre_same_concept");
  }
  if (state.hashes instanceof Set && hash && state.hashes.has(hash)) reasons.push("exact_file_hash");
  const save = assertOneMasterSave(candidate.files || [{ name: `${assetId}.wav` }]);
  if (!save.ok) reasons.push(...save.reasons);
  return { ok: reasons.length === 0, reasons };
}

export function rememberBgmTrack(state, candidate, sha256) {
  const assetId = String(candidate.asset_id || "").trim();
  const title = String(candidate.title || candidate.title_ja || candidate.display_title || "").trim();
  const prompt = String(candidate.prompt || "").trim();
  const conceptId = String(candidate.concept_id || "").trim();
  const genre = String(candidate.genre || "").trim();
  if (assetId) state.assetIds.add(assetId);
  if (title) state.titles.add(title);
  if (prompt) state.prompts.add(prompt);
  if (conceptId && genre) state.concepts.add(`${genre}:${conceptId}`);
  if (sha256) state.hashes.add(sha256);
}

export function createBgmOneTrackState() {
  return {
    assetIds: new Set(),
    titles: new Set(),
    prompts: new Set(),
    concepts: new Set(),
    hashes: new Set(),
  };
}

export { SKIP_DIR as BGM_INVENTORY_SKIP_DIRS };
