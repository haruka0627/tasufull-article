/**
 * Image coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Fills real-world photo holes. Does not equal-weight all genres.
 * Does not invent metadata on existing inventory.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMAGE_COMPOSITIONS,
  IMAGE_DEMAND_GENRES,
  IMAGE_LIGHTING,
  IMAGE_ORIENTATIONS,
  IMAGE_QA_CORE_GENRES,
  IMAGE_USE_CASES,
  buildImageDescription,
  buildImageJapaneseTitle,
  buildImagePromptText,
  classifyLegacyImageItem,
  drivePathForImageSpec,
  getImageSubgenre,
  imageSpecFingerprint,
  listImageSubgenres,
  resolveImagePeoplePolicy,
  slugForImageSpec,
} from "./image-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const IMAGE_COVERAGE_TARGET = Object.freeze({
  core: 4,
  supporting: 2,
});

export const IMAGE_MAX_GENRE_SHARE = 0.22;
export const IMAGE_NEAR_DUPLICATE_GATE = Object.freeze({
  status: "DEFERRED",
  reason: "NOT_AVAILABLE — no perceptual image similarity engine in repo; hash≠near-duplicate",
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

export function loadImageInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "image" || it.asset_type === "image");
  } catch {
    return [];
  }
}

export function snapshotImageInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const sceneCounts = {};
  const useCaseCounts = {};
  const peopleCounts = {};
  const orientationCounts = {};
  const styleCounts = {};
  const copyCounts = {};
  const axisCounts = {};
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
      orientationCounts[it.orientation] = (orientationCounts[it.orientation] || 0) + 1;
    }
    const hasMeta =
      Boolean(it.genre) &&
      Boolean(it.subcategory) &&
      Boolean(it.use_case) &&
      Boolean(it.style) &&
      Boolean(it.orientation) &&
      Boolean(it.scene || it.composition);
    if (hasMeta) {
      metadataComplete += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      if (it.scene) sceneCounts[it.scene] = (sceneCounts[it.scene] || 0) + 1;
      useCaseCounts[it.use_case] = (useCaseCounts[it.use_case] || 0) + 1;
      peopleCounts[it.people_presence || it.target] = (peopleCounts[it.people_presence || it.target] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.style}`] = (styleCounts[`${it.subcategory}|${it.style}`] || 0) + 1;
      copyCounts[it.copy_space] = (copyCounts[it.copy_space] || 0) + 1;
      classified += 1;
      continue;
    }
    const derived = classifyLegacyImageItem(it);
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
  const zeroOrLow = IMAGE_DEMAND_GENRES.map((g) => ({
    id: g.id,
    weight: g.demand_weight,
    count: genreCounts[g.id] || 0,
  })).filter((g) => g.count < IMAGE_COVERAGE_TARGET[g.id ? "core" : "core"]);
  const lowCoverage = IMAGE_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? IMAGE_COVERAGE_TARGET.core : IMAGE_COVERAGE_TARGET.supporting,
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
    sceneCounts,
    useCaseCounts,
    peopleCounts,
    orientationCounts,
    styleCounts,
    copyCounts,
    axisCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage: lowCoverage,
  };
}

function targetForGenre(genre) {
  return genre.tier === "core" ? IMAGE_COVERAGE_TARGET.core : IMAGE_COVERAGE_TARGET.supporting;
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreImageCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
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
    maxShare: IMAGE_MAX_GENRE_SHARE,
  });
  return { ...scored, div, subCount, genreCount };
}

function peopleChoices(genre, subgenre) {
  const policy = resolveImagePeoplePolicy(genre, subgenre);
  if (policy === "product_first") {
    return [
      { people_presence: "absent", people_count: "nobody" },
      { people_presence: "present", people_count: "solo", age_context: "adult" },
    ];
  }
  if (policy === "typical") {
    return [
      { people_presence: "present", people_count: "solo", age_context: "adult" },
      { people_presence: "present", people_count: "pair", age_context: "adult" },
      { people_presence: "present", people_count: "smallgroup", age_context: "mixed" },
      { people_presence: "absent", people_count: "nobody" },
    ];
  }
  return [
    { people_presence: "absent", people_count: "nobody" },
    { people_presence: "present", people_count: "solo", age_context: "adult" },
    { people_presence: "present", people_count: "pair", age_context: "mixed" },
  ];
}

function copyChoices(useCaseId, genre) {
  const uc = IMAGE_USE_CASES[useCaseId];
  const high = uc?.copy === "high" || genre.copy_space_bias === "high";
  if (high) return ["right", "left", "center_safe", "top", "none", "bottom"];
  if (uc?.copy === "low") return ["none", "right", "left"];
  return ["none", "right", "left", "center_safe", "top", "bottom"];
}

function orientationChoices(useCaseId) {
  const weights = IMAGE_USE_CASES[useCaseId]?.orientation || { landscape: 50, portrait: 25, square: 25 };
  return [...IMAGE_ORIENTATIONS].sort((a, b) => (weights[b] || 0) - (weights[a] || 0) || a.localeCompare(b));
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints) {
  const scenes = subgenre.scenes;
  const uses = subgenre.use_cases;
  const people = peopleChoices(genre, subgenre);
  const styles = [...genre.allowed_styles].sort((a, b) => {
    const ca = inventory.styleCounts[`${subgenre.id}|${a}`] || 0;
    const cb = inventory.styleCounts[`${subgenre.id}|${b}`] || 0;
    return ca - cb || a.localeCompare(b);
  });
  for (const scene of scenes) {
    for (const use_case of uses) {
      const orients = orientationChoices(use_case);
      const copies = copyChoices(use_case, genre);
      for (const style of styles) {
        for (const pe of people) {
          for (const orientation of orients) {
            for (const copy_space of copies) {
              for (const composition of IMAGE_COMPOSITIONS) {
                for (const lighting of IMAGE_LIGHTING) {
                  const spec = {
                    genre: genre.id,
                    subcategory: subgenre.id,
                    scene: scene.id,
                    use_case,
                    people_presence: pe.people_presence,
                    people_count: pe.people_count,
                    age_context: pe.age_context || "",
                    composition,
                    orientation,
                    copy_space,
                    lighting,
                    style,
                    color_family: lighting === "goldenhour" ? "warm" : lighting === "fluo" ? "cool" : "neutral",
                  };
                  const fp = imageSpecFingerprint(spec);
                  if (!usedFingerprints.has(fp)) return spec;
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

export function planImageDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadImageInventoryItems(opts.repoRoot);
  const inventory = snapshotImageInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    styleCounts: { ...inventory.styleCounts },
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
    if (!out.length) return 0;
    return (planGenre[id] || 0) / out.length;
  }

  function considerSlot(preferSupporting, requireGenreId = "") {
    const rows = [];
    for (const { genre, subgenre } of listImageSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      const scored = scoreImageCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre);
      rows.push({ genre, subgenre, ...scored });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildImageJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) {
        spec.composition = spec.composition === "mediumshot" ? "wide" : "mediumshot";
        spec.title = buildImageJapaneseTitle(spec);
      }
      if (usedTitles.has(spec.title)) {
        spec.copy_space = spec.copy_space === "right" ? "left" : "right";
        spec.title = buildImageJapaneseTitle(spec);
      }
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildImagePromptText(spec);
      spec.description = buildImageDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const fp = imageSpecFingerprint(spec);
      const variation = (planGenre[spec.genre] || 0) + 1;
      const slug = slugForImageSpec(spec, { variation, day, scopeSuffix });
      if (usedSlugs.has(slug) || completed.has(slug)) continue;
      const left = `${drivePathForImageSpec(spec)}/${slug}`;
      if (completed.has(left)) continue;
      return { spec, slug, left, fp, slot: preferSupporting ? "exploration" : "exploit" };
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
    working.styleCounts[`${spec.subcategory}|${spec.style}`] =
      (working.styleCounts[`${spec.subcategory}|${spec.style}`] || 0) + 1;
    out.push({
      asset_type: "image",
      drive_path: drivePathForImageSpec(spec).replace(/\/[^/]+$/, ""),
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

  for (const genreId of IMAGE_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = IMAGE_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre ? targetForGenre(genre) : IMAGE_COVERAGE_TARGET.core;
    if (!shouldSeedCoverageSlot(working.genreCounts[genreId] || 0, target)) continue;
    commitPick(considerSlot(false, genreId));
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

export function assertImagePlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => imageSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const scenes = lines.map((l) => l.spec?.scene);
  const orients = new Set(lines.map((l) => l.spec?.orientation).filter(Boolean));
  const copies = new Set(lines.map((l) => l.spec?.copy_space).filter(Boolean));
  const people = new Set(lines.map((l) => l.spec?.people_presence).filter(Boolean));
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
      uniqueGenres.size >= Math.min(8, lines.length) &&
      maxShare <= 0.45 &&
      maxConsecutive <= 2,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    uniqueScenes: new Set(scenes.filter(Boolean)).size,
    orientations: [...orients],
    copySpaces: [...copies],
    peoplePresence: [...people],
    maxShare,
    maxConsecutive,
  };
}

export { getImageSubgenre };
