/**
 * Text template coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * High-demand majors must not stay at 0 while only supporting grows.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEXT_ASSET_TYPE,
  TEXT_DEMAND_GENRES,
  TEXT_P0_GENRES,
  TEXT_PUBLIC_CATEGORY_ID,
  TEXT_QA_CORE_GENRES,
  buildTextDescription,
  buildTextJapaneseTitle,
  buildTextPromptText,
  classifyLegacyTextItem,
  drivePathForTextSpec,
  listTextSubgenres,
  slugForTextSpec,
  textSpecFingerprint,
} from "./text-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const TEXT_COVERAGE_TARGET = Object.freeze({ core: 3, medium: 2, supporting: 2 });
export const TEXT_MAX_GENRE_SHARE = 0.18;

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

function targetFor(genre) {
  if (genre.tier === "core") return TEXT_COVERAGE_TARGET.core;
  if (genre.tier === "medium") return TEXT_COVERAGE_TARGET.medium;
  return TEXT_COVERAGE_TARGET.supporting;
}

export function loadTextInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter(
      (it) => it.category_id === TEXT_PUBLIC_CATEGORY_ID || it.asset_type === TEXT_ASSET_TYPE,
    );
  } catch {
    return [];
  }
}

export function snapshotTextInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const toneCounts = {};
  const lengthCounts = {};
  const typeCounts = {};
  const languageCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    const lang = String(it.language || "").trim().toLowerCase();
    if (lang) languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.text_type && it.tone && it.length);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      toneCounts[it.tone] = (toneCounts[it.tone] || 0) + 1;
      lengthCounts[it.length] = (lengthCounts[it.length] || 0) + 1;
      typeCounts[it.text_type] = (typeCounts[it.text_type] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyTextItem(it);
    if (derived.genre !== "unclassified") {
      classified += 1;
      genreCounts[derived.genre] = (genreCounts[derived.genre] || 0) + 1;
    } else unclassified += 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  const zeroOrLowCoverage = TEXT_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    p0: g.p0_shortage === true,
    count: genreCounts[g.id] || 0,
    target: targetFor(g),
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    genreCounts,
    subCounts,
    toneCounts,
    lengthCounts,
    typeCounts,
    languageCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage,
    p0Zero: TEXT_P0_GENRES.filter((id) => (genreCounts[id] || 0) === 0),
    highDemandZero: TEXT_DEMAND_GENRES.filter((g) => g.tier === "core" && (genreCounts[g.id] || 0) === 0).map((g) => g.id),
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreTextCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const tonesUsed = genre.tones.filter((t) => (inventory.toneCounts[t] || 0) > 0).length;
  const div = diversityShortage(tonesUsed, genre.tones.length);
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target: targetFor(genre),
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: TEXT_MAX_GENRE_SHARE,
  });
  if (genre.tier === "supporting" && inventory.highDemandZero?.length) scored.score *= 0.15;
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, usedFingerprints) {
  const types = [...genre.text_types];
  const tones = [...genre.tones];
  const lengths = [...genre.lengths];
  const uses = subgenre.use_cases;
  const n = usedFingerprints.size;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const salt = n + attempt;
    const spec = {
      genre: genre.id,
      subcategory: subgenre.id,
      structure_key: subgenre.structure_key,
      use_case: uses[salt % uses.length],
      text_type: types[salt % types.length],
      tone: tones[salt % tones.length],
      length: lengths[salt % lengths.length],
      language: "ja",
    };
    const fp = textSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

export function planTextDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadTextInventoryItems(opts.repoRoot);
  const inventory = snapshotTextInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    toneCounts: { ...inventory.toneCounts },
    lengthCounts: { ...inventory.lengthCounts },
    highDemandZero: inventory.highDemandZero,
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
    for (const { genre, subgenre } of listTextSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier === "core") continue;
      rows.push({
        genre,
        subgenre,
        ...scoreTextCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre),
      });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, usedFp);
      if (!spec) continue;
      spec.title = buildTextJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildTextPromptText(spec);
      spec.description = buildTextDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForTextSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForTextSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: textSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
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
    working.toneCounts[spec.tone] = (working.toneCounts[spec.tone] || 0) + 1;
    working.lengthCounts[spec.length] = (working.lengthCounts[spec.length] || 0) + 1;
    working.highDemandZero = TEXT_DEMAND_GENRES.filter((g) => g.tier === "core" && (working.genreCounts[g.id] || 0) === 0).map(
      (g) => g.id,
    );
    out.push({
      asset_type: TEXT_ASSET_TYPE,
      drive_path: drivePathForTextSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}/${spec.text_type}/${spec.length}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genreId of TEXT_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = TEXT_DEMAND_GENRES.find((g) => g.id === genreId);
    if (!shouldSeedCoverageSlot(working.genreCounts[genreId] || 0, genre ? targetFor(genre) : TEXT_COVERAGE_TARGET.core)) continue;
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

export function assertTextPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => textSpecFingerprint(l.spec || {}));
  const bodies = lines.map((l) => l.spec?.content || "");
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
  const coreSeeded = TEXT_QA_CORE_GENRES.filter((id) => uniqueGenres.has(id)).length;
  return {
    ok:
      uniqueTitles.size === titles.length &&
      uniquePrompts.size === prompts.length &&
      uniqueFp.size === fps.length &&
      uniqueGenres.size >= Math.min(8, lines.length) &&
      maxShare <= 0.45 &&
      maxConsecutive <= 2 &&
      coreSeeded >= Math.min(10, lines.length),
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueBodies: new Set(bodies.filter(Boolean)).size,
    uniqueGenres: uniqueGenres.size,
    maxShare,
    maxConsecutive,
    coreSeeded,
    genres: [...uniqueGenres],
  };
}
