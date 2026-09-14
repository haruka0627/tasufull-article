/**
 * Background coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Prevents gradient/office runaway. Copy-space is weighted for text-overlay uses.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKGROUND_DEMAND_GENRES,
  BACKGROUND_QA_CORE_GENRES,
  BACKGROUND_TYPES,
  BACKGROUND_STYLES,
  buildBackgroundDescription,
  buildBackgroundJapaneseTitle,
  buildBackgroundPromptText,
  classifyLegacyBackgroundItem,
  drivePathForBackgroundSpec,
  backgroundSpecFingerprint,
  listBackgroundSubgenres,
  pickComplexity,
  pickCopySpace,
  pickWeightedOrientation,
  slugForBackgroundSpec,
} from "./background-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const BACKGROUND_COVERAGE_TARGET = Object.freeze({ core: 3, supporting: 2 });
export const BACKGROUND_MAX_GENRE_SHARE = 0.18;

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

export function loadBackgroundInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "background" || it.asset_type === "background");
  } catch {
    return [];
  }
}

export function snapshotBackgroundInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const styleCounts = {};
  const typeCounts = {};
  const colorCounts = {};
  const brightnessCounts = {};
  const copyCounts = {};
  const orientCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  let orientationFilled = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    if (it.orientation) {
      orientationFilled += 1;
      orientCounts[it.orientation] = (orientCounts[it.orientation] || 0) + 1;
    }
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.style && it.background_type && it.color_family);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.style}`] = (styleCounts[`${it.subcategory}|${it.style}`] || 0) + 1;
      typeCounts[it.background_type] = (typeCounts[it.background_type] || 0) + 1;
      colorCounts[`${it.subcategory}|${it.color_family}`] = (colorCounts[`${it.subcategory}|${it.color_family}`] || 0) + 1;
      brightnessCounts[it.brightness || it.lighting] = (brightnessCounts[it.brightness || it.lighting] || 0) + 1;
      copyCounts[it.copy_space] = (copyCounts[it.copy_space] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyBackgroundItem(it);
    if (derived.genre !== "unclassified") {
      classified += 1;
      genreCounts[derived.genre] = (genreCounts[derived.genre] || 0) + 1;
    } else unclassified += 1;
    const sub = String(it.subcategory || "").trim();
    if (sub) subCounts[sub] = (subCounts[sub] || 0) + 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  const zeroOrLowCoverage = BACKGROUND_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? BACKGROUND_COVERAGE_TARGET.core : BACKGROUND_COVERAGE_TARGET.supporting,
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    orientationFilled,
    genreCounts,
    subCounts,
    styleCounts,
    typeCounts,
    colorCounts,
    brightnessCounts,
    copyCounts,
    orientCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage,
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreBackgroundCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const target = genre.tier === "core" ? BACKGROUND_COVERAGE_TARGET.core : BACKGROUND_COVERAGE_TARGET.supporting;
  const styles = subgenre.allowed_styles || genre.allowed_styles;
  const stylesUsed = styles.filter((st) => (inventory.styleCounts[`${subgenre.id}|${st}`] || 0) > 0).length;
  const colors = subgenre.allowed_colors || genre.allowed_colors;
  const colorsUsed = colors.filter((c) => (inventory.colorCounts[`${subgenre.id}|${c}`] || 0) > 0).length;
  const div = Math.max(diversityShortage(stylesUsed, styles.length), diversityShortage(colorsUsed, colors.length));
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target,
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: BACKGROUND_MAX_GENRE_SHARE,
  });
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints) {
  const styles = [...(subgenre.allowed_styles || genre.allowed_styles)];
  const types = [...(subgenre.allowed_types || genre.allowed_types)];
  const colors = [...(subgenre.allowed_colors || genre.allowed_colors)];
  const scenes = subgenre.scenes;
  const uses = subgenre.use_cases;
  const n = usedFingerprints.size;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const salt = n + attempt;
    const use_case = uses[salt % uses.length];
    const spec = {
      genre: genre.id,
      subcategory: subgenre.id,
      scene: scenes[salt % scenes.length].id,
      use_case,
      style: styles.sort((a, b) => (inventory.styleCounts[`${subgenre.id}|${a}`] || 0) - (inventory.styleCounts[`${subgenre.id}|${b}`] || 0))[salt % styles.length],
      background_type: types[salt % types.length],
      color_family: colors.sort((a, b) => (inventory.colorCounts[`${subgenre.id}|${a}`] || 0) - (inventory.colorCounts[`${subgenre.id}|${b}`] || 0))[salt % colors.length],
      brightness: ["light", "medium", "dark"][salt % 3],
      complexity: pickComplexity(use_case, salt),
      copy_space: pickCopySpace(use_case, salt + 3),
      orientation: pickWeightedOrientation(use_case, salt + 7),
    };
    if (use_case === "overlay" || use_case === "document" || use_case === "presentation") {
      if (spec.copy_space === "none") spec.copy_space = "wide_center";
      if (spec.complexity === "rich") spec.complexity = "low";
    }
    const fp = backgroundSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

export function planBackgroundDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadBackgroundInventoryItems(opts.repoRoot);
  const inventory = snapshotBackgroundInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    styleCounts: { ...inventory.styleCounts },
    colorCounts: { ...inventory.colorCounts },
  };
  const exploreN = Math.min(Math.max(1, Math.round(quota * 0.15)), Math.floor(quota * 0.2));
  const out = [];
  const usedFp = new Set();
  const usedTitles = new Set(Object.keys(inventory.titleCounts));
  const usedPrompts = new Set();
  const usedSlugs = new Set();
  let lastGenre = "";
  const planGenre = {};

  function genreShare(id) {
    return out.length ? (planGenre[id] || 0) / out.length : 0;
  }

  function considerSlot(preferSupporting, requireGenreId = "", slotOverride = "") {
    const rows = [];
    for (const { genre, subgenre } of listBackgroundSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      rows.push({ genre, subgenre, ...scoreBackgroundCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre) });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildBackgroundJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) {
        spec.color_family = (row.genre.allowed_colors || []).find((c) => c !== spec.color_family) || spec.color_family;
        spec.title = buildBackgroundJapaneseTitle(spec);
      }
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildBackgroundPromptText(spec);
      spec.description = buildBackgroundDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForBackgroundSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForBackgroundSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: backgroundSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
    }
    return null;
  }

  function commitPick(picked) {
    if (!picked) return false;
    const { spec, slug, left, fp, slot } = picked;
    usedFp.add(fp);
    usedTitles.add(spec.title);
    usedPrompts.add(spec.prompt);
    usedSlugs.add(slug);
    lastGenre = spec.genre;
    planGenre[spec.genre] = (planGenre[spec.genre] || 0) + 1;
    working.subCounts[spec.subcategory] = (working.subCounts[spec.subcategory] || 0) + 1;
    working.genreCounts[spec.genre] = (working.genreCounts[spec.genre] || 0) + 1;
    working.styleCounts[`${spec.subcategory}|${spec.style}`] = (working.styleCounts[`${spec.subcategory}|${spec.style}`] || 0) + 1;
    working.colorCounts[`${spec.subcategory}|${spec.color_family}`] =
      (working.colorCounts[`${spec.subcategory}|${spec.color_family}`] || 0) + 1;
    out.push({
      asset_type: "background",
      drive_path: drivePathForBackgroundSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}/${spec.scene}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genreId of BACKGROUND_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = BACKGROUND_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre && genre.tier === "core" ? BACKGROUND_COVERAGE_TARGET.core : BACKGROUND_COVERAGE_TARGET.supporting;
    if (!shouldSeedCoverageSlot(working.genreCounts[genreId] || 0, target)) continue;
    commitPick(considerSlot(false, genreId));
  }

  let guard = 0;
  while (out.length < quota && guard < quota * 80) {
    guard += 1;
    const needExplore =
      out.filter((x) => x.selection_slot === "exploration").length < exploreN && out.length >= quota - exploreN;
    const picked = needExplore
      ? considerSlot(true, "", "exploration") || considerSlot(false, "", "exploration")
      : considerSlot(false);
    if (!commitPick(picked)) break;
  }
  return out.slice(0, quota);
}

export function assertBackgroundPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => backgroundSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const styles = new Set(lines.map((l) => l.spec?.style).filter(Boolean));
  const types = new Set(lines.map((l) => l.spec?.background_type).filter(Boolean));
  const colors = new Set(lines.map((l) => l.spec?.color_family).filter(Boolean));
  const brightness = new Set(lines.map((l) => l.spec?.brightness).filter(Boolean));
  const copies = new Set(lines.map((l) => l.spec?.copy_space).filter(Boolean));
  const orients = new Set(lines.map((l) => l.spec?.orientation).filter(Boolean));
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
  const overlaySafe = lines.filter((l) => ["hero", "overlay", "presentation", "document", "youtube", "sns", "advertising"].includes(l.spec?.use_case));
  const overlayHasCopy = overlaySafe.filter((l) => l.spec?.copy_space && l.spec.copy_space !== "none");
  return {
    ok:
      uniqueTitles.size === titles.length &&
      uniquePrompts.size === prompts.length &&
      uniqueFp.size === fps.length &&
      uniqueGenres.size >= Math.min(8, lines.length) &&
      maxShare <= 0.45 &&
      maxConsecutive <= 2 &&
      types.size >= 2 &&
      colors.size >= 2 &&
      copies.size >= 2 &&
      (overlaySafe.length === 0 || overlayHasCopy.length >= overlaySafe.length * 0.6) &&
      lines.every((l) => /background only/i.test(l.spec?.prompt || l.line) && /no people/i.test(l.spec?.prompt || l.line)),
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    styles: [...styles],
    backgroundTypes: [...types],
    colors: [...colors],
    brightness: [...brightness],
    copySpaces: [...copies],
    orientations: [...orients],
    maxShare,
    maxConsecutive,
  };
}

void BACKGROUND_TYPES;
void BACKGROUND_STYLES;
