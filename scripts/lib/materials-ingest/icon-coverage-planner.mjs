/**
 * Icon coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * P0 zero categories (device / home / transport) get shortage boost, not bulk fill.
 * Families are discrete bundles (no cartesian stroke×fill×color).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ICON_DEMAND_GENRES,
  ICON_P0_GENRES,
  ICON_QA_CORE_GENRES,
  applyIconFamily,
  buildIconDescription,
  buildIconJapaneseTitle,
  buildIconPromptText,
  classifyLegacyIconItem,
  drivePathForIconSpec,
  iconSpecFingerprint,
  listIconSubgenres,
  slugForIconSpec,
} from "./icon-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const ICON_COVERAGE_TARGET = Object.freeze({ core: 3, supporting: 2 });
export const ICON_MAX_GENRE_SHARE = 0.18;

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

export function loadIconInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "icon" || it.asset_type === "icon");
  } catch {
    return [];
  }
}

const SIDE_CAT_TAGS = Object.freeze([
  { key: "ビジネス・仕事", tag: "ビジネス" },
  { key: "UI・操作", tag: "UI" },
  { key: "SNS・コミュニケーション", tag: "SNS" },
  { key: "デバイス・テクノロジー", tag: "デバイス" },
  { key: "生活・日用品", tag: "生活" },
  { key: "教育・学習", tag: "教育" },
  { key: "医療・健康", tag: "医療" },
  { key: "乗り物・交通", tag: "交通" },
  { key: "スポーツ・趣味", tag: "スポーツ" },
  { key: "その他", tag: "その他" },
]);

export function snapshotIconInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const familyCounts = {};
  const styleCounts = {};
  const lineCounts = {};
  const fillCounts = {};
  const shapeCounts = {};
  const sideCatCounts = {};
  for (const row of SIDE_CAT_TAGS) sideCatCounts[row.key] = 0;
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  let styleFilled = 0;
  let lineFilled = 0;
  let fillFilled = 0;
  let shapeFilled = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    if (it.style) {
      styleFilled += 1;
      styleCounts[it.style] = (styleCounts[it.style] || 0) + 1;
    }
    if (it.line_weight) {
      lineFilled += 1;
      lineCounts[it.line_weight] = (lineCounts[it.line_weight] || 0) + 1;
    }
    if (it.fill_type) {
      fillFilled += 1;
      fillCounts[it.fill_type] = (fillCounts[it.fill_type] || 0) + 1;
    }
    if (it.shape_style) {
      shapeFilled += 1;
      shapeCounts[it.shape_style] = (shapeCounts[it.shape_style] || 0) + 1;
    }
    const hay = [it.subcategory, ...(it.tags || [])].map((x) => String(x || "")).join("|");
    for (const row of SIDE_CAT_TAGS) {
      if (hay.includes(row.tag)) sideCatCounts[row.key] += 1;
    }
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.style && (it.feature || it.icon_family));
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      const fam = it.feature || it.icon_family;
      familyCounts[`${it.subcategory}|${fam}`] = (familyCounts[`${it.subcategory}|${fam}`] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyIconItem(it);
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
  const zeroOrLowCoverage = ICON_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    p0: g.p0_shortage === true,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? ICON_COVERAGE_TARGET.core : ICON_COVERAGE_TARGET.supporting,
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    styleFilled,
    lineFilled,
    fillFilled,
    shapeFilled,
    genreCounts,
    subCounts,
    familyCounts,
    styleCounts,
    lineCounts,
    fillCounts,
    shapeCounts,
    sideCatCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage,
    p0Zero: ICON_P0_GENRES.filter((id) => (genreCounts[id] || 0) === 0),
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreIconCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const target = genre.tier === "core" ? ICON_COVERAGE_TARGET.core : ICON_COVERAGE_TARGET.supporting;
  const families = subgenre.allowed_families || genre.allowed_families;
  const familiesUsed = families.filter((fam) => (inventory.familyCounts[`${subgenre.id}|${fam}`] || 0) > 0).length;
  const div = diversityShortage(familiesUsed, families.length);
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target,
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: ICON_MAX_GENRE_SHARE,
  });
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints) {
  const families = [...(subgenre.allowed_families || genre.allowed_families)];
  const scenes = subgenre.scenes;
  const uses = subgenre.use_cases;
  const n = usedFingerprints.size;
  const sortedFamilies = families.sort(
    (a, b) => (inventory.familyCounts[`${subgenre.id}|${a}`] || 0) - (inventory.familyCounts[`${subgenre.id}|${b}`] || 0),
  );
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const salt = n + attempt;
    const spec = applyIconFamily({
      genre: genre.id,
      subcategory: subgenre.id,
      scene: scenes[salt % scenes.length].id,
      use_case: uses[salt % uses.length],
      icon_family: sortedFamilies[salt % sortedFamilies.length],
    });
    const fp = iconSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

export function planIconDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadIconInventoryItems(opts.repoRoot);
  const inventory = snapshotIconInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    familyCounts: { ...inventory.familyCounts },
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
    for (const { genre, subgenre } of listIconSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      rows.push({ genre, subgenre, ...scoreIconCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre) });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildIconJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildIconPromptText(spec);
      spec.description = buildIconDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForIconSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForIconSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: iconSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
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
    working.familyCounts[`${spec.subcategory}|${spec.icon_family}`] =
      (working.familyCounts[`${spec.subcategory}|${spec.icon_family}`] || 0) + 1;
    out.push({
      asset_type: "icon",
      drive_path: drivePathForIconSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}/${spec.icon_family}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genreId of ICON_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = ICON_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre && genre.tier === "core" ? ICON_COVERAGE_TARGET.core : ICON_COVERAGE_TARGET.supporting;
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

export function assertIconPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => iconSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const families = new Set(lines.map((l) => l.spec?.icon_family).filter(Boolean));
  const styles = new Set(lines.map((l) => l.spec?.style).filter(Boolean));
  const weights = new Set(lines.map((l) => l.spec?.line_weight).filter(Boolean));
  const fills = new Set(lines.map((l) => l.spec?.fill_type).filter(Boolean));
  const shapes = new Set(lines.map((l) => l.spec?.shape_style).filter(Boolean));
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
      maxConsecutive <= 2 &&
      families.size >= 2 &&
      styles.size >= 2,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    maxShare,
    maxConsecutive,
    families: [...families],
    styles: [...styles],
    lineWeights: [...weights],
    fills: [...fills],
    shapes: [...shapes],
  };
}
