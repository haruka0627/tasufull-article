/**
 * Web coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Suppresses hero/landing runaway. Theme-only clones are not unique (fingerprint omits theme).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WEB_DEMAND_GENRES,
  WEB_P0_GENRES,
  WEB_QA_CORE_GENRES,
  buildWebDescription,
  buildWebJapaneseTitle,
  buildWebPromptText,
  classifyLegacyWebItem,
  drivePathForWebSpec,
  listWebSubgenres,
  slugForWebSpec,
  webSpecFingerprint,
} from "./web-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const WEB_COVERAGE_TARGET = Object.freeze({ core: 3, supporting: 2 });
export const WEB_MAX_GENRE_SHARE = 0.12;

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

export function loadWebInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "web" || it.asset_type === "web" || it.asset_type === "web-material");
  } catch {
    return [];
  }
}

export function snapshotWebInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const styleCounts = {};
  const layoutCounts = {};
  const componentCounts = {};
  const themeCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  let landingTag = 0;
  let heroTag = 0;
  let zipLike = 0;
  let htmlCss = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    const hay = [it.subcategory, ...(it.tags || [])].map((x) => String(x || "")).join("|").toLowerCase();
    if (hay.includes("landing")) landingTag += 1;
    if (hay.includes("hero")) heroTag += 1;
    const formats = (it.file_formats || []).map((f) => String(f).toLowerCase());
    if (formats.includes("zip")) zipLike += 1;
    if (formats.includes("html") && formats.includes("css")) htmlCss += 1;
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.style && it.component_type && (it.layout_type || it.layout));
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.style}`] = (styleCounts[`${it.subcategory}|${it.style}`] || 0) + 1;
      layoutCounts[`${it.subcategory}|${it.layout_type || it.layout}`] = (layoutCounts[`${it.subcategory}|${it.layout_type || it.layout}`] || 0) + 1;
      componentCounts[it.component_type] = (componentCounts[it.component_type] || 0) + 1;
      themeCounts[it.theme] = (themeCounts[it.theme] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyWebItem(it);
    if (derived.genre !== "unclassified") {
      classified += 1;
      genreCounts[derived.genre] = (genreCounts[derived.genre] || 0) + 1;
    } else unclassified += 1;
    const sub = String(it.subcategory || "").trim();
    if (sub) subCounts[sub] = (subCounts[sub] || 0) + 1;
    if (it.layout) layoutCounts[it.layout] = (layoutCounts[it.layout] || 0) + 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  const zeroOrLowCoverage = WEB_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    p0: g.p0_shortage === true,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? WEB_COVERAGE_TARGET.core : WEB_COVERAGE_TARGET.supporting,
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    landingTag,
    heroTag,
    zipLike,
    htmlCss,
    genreCounts,
    subCounts,
    styleCounts,
    layoutCounts,
    componentCounts,
    themeCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage,
    p0Zero: WEB_P0_GENRES.filter((id) => (genreCounts[id] || 0) === 0),
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreWebCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const target = genre.tier === "core" ? WEB_COVERAGE_TARGET.core : WEB_COVERAGE_TARGET.supporting;
  const styles = subgenre.allowed_styles || genre.allowed_styles;
  const layouts = subgenre.allowed_layouts || genre.allowed_layouts;
  const stylesUsed = styles.filter((st) => (inventory.styleCounts[`${subgenre.id}|${st}`] || 0) > 0).length;
  const layoutsUsed = layouts.filter((ly) => (inventory.layoutCounts[`${subgenre.id}|${ly}`] || 0) > 0).length;
  const div = Math.max(diversityShortage(stylesUsed, styles.length), diversityShortage(layoutsUsed, layouts.length));
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target,
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: WEB_MAX_GENRE_SHARE,
  });
  if (genre.id === "hero" && genreCount >= 20) scored.score *= 0.08;
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints) {
  const styles = [...(subgenre.allowed_styles || genre.allowed_styles)];
  const layouts = [...(subgenre.allowed_layouts || genre.allowed_layouts)];
  const components = [...(genre.allowed_components || [genre.component_type])];
  const scenes = subgenre.scenes;
  const uses = subgenre.use_cases;
  const densities = ["compact", "normal", "spacious"];
  const themes = ["light", "dark", "mixed"];
  const n = usedFingerprints.size;
  const sortedStyles = styles.sort(
    (a, b) => (inventory.styleCounts[`${subgenre.id}|${a}`] || 0) - (inventory.styleCounts[`${subgenre.id}|${b}`] || 0),
  );
  const sortedLayouts = layouts.sort(
    (a, b) => (inventory.layoutCounts[`${subgenre.id}|${a}`] || 0) - (inventory.layoutCounts[`${subgenre.id}|${b}`] || 0),
  );
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const salt = n + attempt;
    const style = sortedStyles[salt % sortedStyles.length];
    const spec = {
      genre: genre.id,
      subcategory: subgenre.id,
      scene: scenes[salt % scenes.length].id,
      use_case: uses[salt % uses.length],
      component_type: components[salt % components.length],
      layout_type: sortedLayouts[salt % sortedLayouts.length],
      style,
      theme: style === "darkstyle" ? "dark" : themes[salt % themes.length],
      responsive_mode: salt % 11 === 0 ? "desktop_first" : "responsive",
      density: densities[salt % densities.length],
    };
    const fp = webSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

export function planWebDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadWebInventoryItems(opts.repoRoot);
  const inventory = snapshotWebInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    styleCounts: { ...inventory.styleCounts },
    layoutCounts: { ...inventory.layoutCounts },
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
    for (const { genre, subgenre } of listWebSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      rows.push({ genre, subgenre, ...scoreWebCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre) });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildWebJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildWebPromptText(spec);
      spec.description = buildWebDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForWebSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForWebSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: webSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
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
    working.layoutCounts[`${spec.subcategory}|${spec.layout_type}`] =
      (working.layoutCounts[`${spec.subcategory}|${spec.layout_type}`] || 0) + 1;
    out.push({
      asset_type: "web-material",
      drive_path: drivePathForWebSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}/${spec.layout_type}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genreId of WEB_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = WEB_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre && genre.tier === "core" ? WEB_COVERAGE_TARGET.core : WEB_COVERAGE_TARGET.supporting;
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

export function assertWebPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => webSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const styles = new Set(lines.map((l) => l.spec?.style).filter(Boolean));
  const layouts = new Set(lines.map((l) => l.spec?.layout_type).filter(Boolean));
  const components = new Set(lines.map((l) => l.spec?.component_type).filter(Boolean));
  const themes = new Set(lines.map((l) => l.spec?.theme).filter(Boolean));
  const uniqueTitles = new Set(titles);
  const uniquePrompts = new Set(prompts);
  const uniqueFp = new Set(fps);
  const uniqueGenres = new Set(genres.filter(Boolean));
  const genreCounts = {};
  for (const g of genres) genreCounts[g] = (genreCounts[g] || 0) + 1;
  const maxShare = lines.length ? Math.max(0, ...Object.values(genreCounts)) / lines.length : 0;
  const heroShare = lines.length ? (genreCounts.hero || 0) / lines.length : 0;
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
      heroShare <= 0.25 &&
      maxConsecutive <= 2 &&
      styles.size >= 2 &&
      layouts.size >= 2 &&
      components.size >= 2,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    maxShare,
    heroShare,
    maxConsecutive,
    styles: [...styles],
    layouts: [...layouts],
    components: [...components],
    themes: [...themes],
  };
}
