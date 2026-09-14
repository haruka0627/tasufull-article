/**
 * SFX coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Fills video-editing holes. Does not equal-weight all genres.
 * Does not invent metadata on existing inventory.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SFX_DEMAND_GENRES,
  SFX_INTENSITY_VALUES,
  buildSfxJapaneseTitle,
  buildSfxPromptText,
  classifyLegacySfxItem,
  drivePathForSfxSpec,
  getSfxSubgenre,
  listSfxSubgenres,
  resolveSfxSynthPreset,
  sfxSpecFingerprint,
  slugForSfxSpec,
} from "./sfx-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const SFX_COVERAGE_TARGET = Object.freeze({
  core: 4,
  supporting: 2,
});

export const SFX_MAX_GENRE_SHARE = 0.28;
export const SFX_NEAR_AUDIO_DUPLICATE_GATE = Object.freeze({
  status: "DEFERRED",
  reason: "NOT_AVAILABLE — no audio fingerprint engine in repo; hash≠perceptual",
});

function yyyymmdd(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

export function loadSfxInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "sfx" || it.asset_type === "sfx");
  } catch {
    return [];
  }
}

export function snapshotSfxInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const styleCounts = {};
  const durationCounts = {};
  const useCaseCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    const hasMeta =
      Boolean(it.genre) &&
      Boolean(it.subcategory) &&
      Boolean(it.use_case) &&
      Boolean(it.style) &&
      Boolean(it.duration);
    if (hasMeta) {
      metadataComplete += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.style}`] = (styleCounts[`${it.subcategory}|${it.style}`] || 0) + 1;
      durationCounts[it.duration] = (durationCounts[it.duration] || 0) + 1;
      useCaseCounts[it.use_case] = (useCaseCounts[it.use_case] || 0) + 1;
      classified += 1;
      continue;
    }
    const derived = classifyLegacySfxItem(it);
    if (derived.genre !== "unclassified") {
      classified += 1;
      genreCounts[derived.genre] = (genreCounts[derived.genre] || 0) + 1;
    } else {
      unclassified += 1;
    }
    const sub = String(it.subcategory || "").trim();
    if (sub) subCounts[sub] = (subCounts[sub] || 0) + 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    genreCounts,
    subCounts,
    styleCounts,
    durationCounts,
    useCaseCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
  };
}

function targetForGenre(genre) {
  return genre.tier === "core" ? SFX_COVERAGE_TARGET.core : SFX_COVERAGE_TARGET.supporting;
}

function diversityShortage(styleCount, allowedLen) {
  if (!allowedLen) return 1;
  if (!styleCount) return 1;
  return Math.max(0.25, 1 - styleCount / allowedLen);
}

export function scoreSfxCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const stylesUsed = genre.allowed_styles.filter(
    (st) => (inventory.styleCounts[`${subgenre.id}|${st}`] || 0) > 0,
  ).length;
  const div = diversityShortage(stylesUsed, genre.allowed_styles.length);
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target: targetForGenre(genre),
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: SFX_MAX_GENRE_SHARE,
  });
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedStyle(genre, subgenre, inventory, usedFingerprints) {
  const ranked = [...genre.allowed_styles].sort((a, b) => {
    const ca = inventory.styleCounts[`${subgenre.id}|${a}`] || 0;
    const cb = inventory.styleCounts[`${subgenre.id}|${b}`] || 0;
    return ca - cb || a.localeCompare(b);
  });
  for (const style of ranked) {
    const duration = subgenre.duration_default;
    for (const intensity of SFX_INTENSITY_VALUES) {
      const spec = {
        genre: genre.id,
        subcategory: subgenre.id,
        use_case: subgenre.use_case,
        style,
        duration,
        intensity,
        synth_preset: resolveSfxSynthPreset({ ...subgenre, genre: genre.id, subcategory: subgenre.id }),
        reverse: subgenre.reverse === true,
        invert_riser: subgenre.invert_riser === true,
      };
      const fp = sfxSpecFingerprint(spec);
      if (!usedFingerprints.has(fp)) return spec;
    }
  }
  return null;
}

export function planSfxDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadSfxInventoryItems(opts.repoRoot);
  const inventory = snapshotSfxInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    styleCounts: { ...inventory.styleCounts },
  };
  const exploreN = Math.min(Math.max(1, Math.round(quota * 0.15)), Math.floor(quota * 0.2));
  const out = [];
  const usedFp = new Set();
  const usedTitles = new Set(Object.keys(inventory.titleCounts));
  const usedSlugs = new Set();
  let lastGenre = "";
  const planGenre = {};
  const seededCore = new Set();

  function genreShare(id) {
    if (!out.length) return 0;
    return (planGenre[id] || 0) / out.length;
  }

  function considerSlot(preferSupporting, requireGenreId = "") {
    const rows = [];
    for (const { genre, subgenre } of listSfxSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      const scored = scoreSfxCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre);
      rows.push({ genre, subgenre, ...scored });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedStyle(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildSfxJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) {
        spec.intensity = spec.intensity === "medium" ? "strong" : spec.intensity;
        spec.title = buildSfxJapaneseTitle(spec);
      }
      if (usedTitles.has(spec.title)) continue;
      const fp = sfxSpecFingerprint(spec);
      const variation = (planGenre[spec.genre] || 0) + 1;
      const slug = slugForSfxSpec(spec, { variation, day, scopeSuffix });
      if (usedSlugs.has(slug) || completed.has(slug)) continue;
      const left = `${drivePathForSfxSpec(spec)}/${slug}`;
      if (completed.has(left)) continue;
      spec.synth_preset = resolveSfxSynthPreset(spec);
      spec.prompt = buildSfxPromptText(spec);
      return { spec, slug, left, fp, slot: preferSupporting ? "exploration" : "exploit" };
    }
    return null;
  }

  function commitPick(picked) {
    if (!picked) return false;
    const { spec, slug, left, fp, slot } = picked;
    usedFp.add(fp);
    usedTitles.add(spec.title);
    usedSlugs.add(slug);
    lastGenre = spec.genre;
    planGenre[spec.genre] = (planGenre[spec.genre] || 0) + 1;
    working.subCounts[spec.subcategory] = (working.subCounts[spec.subcategory] || 0) + 1;
    working.genreCounts[spec.genre] = (working.genreCounts[spec.genre] || 0) + 1;
    working.styleCounts[`${spec.subcategory}|${spec.style}`] =
      (working.styleCounts[`${spec.subcategory}|${spec.style}`] || 0) + 1;
    out.push({
      asset_type: "sfx",
      drive_path: drivePathForSfxSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genre of SFX_DEMAND_GENRES) {
    if (genre.tier !== "core" || out.length >= quota) break;
    if (!shouldSeedCoverageSlot(working.genreCounts[genre.id] || 0, targetForGenre(genre))) continue;
    const picked = considerSlot(false, genre.id);
    if (commitPick(picked)) seededCore.add(genre.id);
  }

  let guard = 0;
  while (out.length < quota && guard < quota * 80) {
    guard += 1;
    const needExplore =
      out.filter((x) => x.selection_slot === "exploration").length < exploreN &&
      out.length >= quota - exploreN;
    const picked = considerSlot(needExplore) || considerSlot(false);
    if (!commitPick(picked)) break;
  }

  return out.slice(0, quota);
}

export function assertSfxPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || l.line.split("|")[1]);
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => sfxSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const uniqueTitles = new Set(titles);
  const uniquePrompts = new Set(prompts);
  const uniqueFp = new Set(fps);
  const uniqueGenres = new Set(genres.filter(Boolean));
  const genreCounts = {};
  for (const g of genres) genreCounts[g] = (genreCounts[g] || 0) + 1;
  const maxShare = lines.length ? Math.max(0, ...Object.values(genreCounts)) / lines.length : 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let prev = "";
  for (const g of genres) {
    if (g === prev) consecutive += 1;
    else consecutive = 1;
    prev = g;
    if (consecutive > maxConsecutive) maxConsecutive = consecutive;
  }
  return {
    ok:
      uniqueTitles.size === titles.length &&
      uniquePrompts.size === prompts.length &&
      uniqueFp.size === fps.length &&
      uniqueGenres.size >= Math.min(4, lines.length) &&
      maxShare <= 0.45 &&
      maxConsecutive <= 2,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    maxShare,
    maxConsecutive,
  };
}

export { getSfxSubgenre };
