/**
 * Code coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Language is an axis, not a major category. Language-only clones are not unique.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODE_DEMAND_GENRES,
  CODE_P0_GENRES,
  CODE_QA_CORE_GENRES,
  buildCodeDescription,
  buildCodeJapaneseTitle,
  buildCodePromptText,
  classifyLegacyCodeItem,
  codeSpecFingerprint,
  drivePathForCodeSpec,
  inferCodeDifficulty,
  listCodeSubgenres,
  slugForCodeSpec,
} from "./code-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const CODE_COVERAGE_TARGET = Object.freeze({ core: 3, supporting: 2 });
export const CODE_MAX_GENRE_SHARE = 0.18;
export const CODE_MAX_LANGUAGE_SHARE = 0.4;

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

export function loadCodeInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "code" || it.asset_type === "code" || it.asset_type === "code-material");
  } catch {
    return [];
  }
}

export function snapshotCodeInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const languageCounts = {};
  const runtimeCounts = {};
  const formCounts = {};
  const frameworkCounts = {};
  const styleCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    const lang = String(it.language || "").trim().toLowerCase();
    if (lang) languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    if (it.runtime) runtimeCounts[String(it.runtime)] = (runtimeCounts[String(it.runtime)] || 0) + 1;
    if (it.asset_form) formCounts[String(it.asset_form)] = (formCounts[String(it.asset_form)] || 0) + 1;
    if (it.framework) frameworkCounts[String(it.framework)] = (frameworkCounts[String(it.framework)] || 0) + 1;
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.language && it.runtime && it.asset_form);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.asset_form}|${it.approach || ""}`] =
        (styleCounts[`${it.subcategory}|${it.asset_form}|${it.approach || ""}`] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyCodeItem(it);
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
  const zeroOrLowCoverage = CODE_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    p0: g.p0_shortage === true,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? CODE_COVERAGE_TARGET.core : CODE_COVERAGE_TARGET.supporting,
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    genreCounts,
    subCounts,
    languageCounts,
    runtimeCounts,
    formCounts,
    frameworkCounts,
    styleCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowCoverage,
    p0Zero: CODE_P0_GENRES.filter((id) => (genreCounts[id] || 0) === 0),
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scoreCodeCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId, langShare) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const target = genre.tier === "core" ? CODE_COVERAGE_TARGET.core : CODE_COVERAGE_TARGET.supporting;
  const forms = genre.asset_forms;
  const formsUsed = forms.filter((f) => (inventory.formCounts[f] || 0) > 0).length;
  const div = diversityShortage(formsUsed, forms.length);
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target,
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: CODE_MAX_GENRE_SHARE,
  });
  if (langShare >= CODE_MAX_LANGUAGE_SHARE) scored.score *= 0.08;
  if ((inventory.languageCounts.javascript || 0) >= 80 && lastGenreId === "apiclient") scored.score *= 0.5;
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints, planLang) {
  const forms = [...genre.asset_forms];
  const langs = [...genre.languages];
  const runtimes = [...genre.runtimes];
  const scenes = subgenre.scenes;
  const uses = subgenre.use_cases;
  const approaches = ["stdlib", "validated", "retryaware", "batched", "mocked"];
  const n = usedFingerprints.size;
  const sortedLangs = langs.sort((a, b) => (inventory.languageCounts[a] || 0) - (inventory.languageCounts[b] || 0));
  const sortedForms = forms.sort((a, b) => (inventory.formCounts[a] || 0) - (inventory.formCounts[b] || 0));
  for (let attempt = 0; attempt < 56; attempt += 1) {
    const salt = n + attempt;
    let language = sortedLangs[salt % sortedLangs.length];
    if ((planLang[language] || 0) / Math.max(1, n) >= CODE_MAX_LANGUAGE_SHARE && sortedLangs.length > 1) {
      language = sortedLangs[(salt + 1) % sortedLangs.length];
    }
    const compatibleRt = runtimes.filter((rt) => {
      if (language === "sql") return rt === "database";
      if (language === "python") return rt === "python" || rt === "server";
      if (language === "javascript" || language === "typescript") return rt === "node" || rt === "browser" || rt === "server";
      return true;
    });
    const runtime = (compatibleRt.length ? compatibleRt : runtimes)[salt % Math.max(1, compatibleRt.length || runtimes.length)];
    const spec = {
      genre: genre.id,
      subcategory: subgenre.id,
      scene: scenes[salt % scenes.length].id,
      use_case: uses[salt % uses.length],
      language,
      runtime,
      asset_form: sortedForms[salt % sortedForms.length],
      approach: approaches[salt % approaches.length],
      framework: language === "python" || language === "sql" ? "stdlib" : "vanilla",
      dependency: "none",
    };
    spec.difficulty = inferCodeDifficulty(spec);
    const fp = codeSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

export function planCodeDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadCodeInventoryItems(opts.repoRoot);
  const inventory = snapshotCodeInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    languageCounts: { ...inventory.languageCounts },
    formCounts: { ...inventory.formCounts },
    runtimeCounts: { ...inventory.runtimeCounts },
  };
  const exploreN = Math.min(Math.max(1, Math.round(quota * 0.15)), Math.floor(quota * 0.2));
  const out = [];
  const usedFp = new Set();
  const usedTitles = new Set(Object.keys(inventory.titleCounts));
  const usedPrompts = new Set();
  const usedSlugs = new Set();
  let lastGenre = "";
  const planGenre = {};
  const planLang = {};

  function genreShare(id) {
    return out.length ? (planGenre[id] || 0) / out.length : 0;
  }
  function langShareFor(lang) {
    return out.length ? (planLang[lang] || 0) / out.length : 0;
  }

  function considerSlot(preferSupporting, requireGenreId = "", slotOverride = "") {
    const rows = [];
    for (const { genre, subgenre } of listCodeSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      rows.push({
        genre,
        subgenre,
        ...scoreCodeCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre, langShareFor("javascript")),
      });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp, planLang);
      if (!spec) continue;
      spec.title = buildCodeJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildCodePromptText(spec);
      spec.description = buildCodeDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForCodeSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForCodeSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: codeSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
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
    planLang[spec.language] = (planLang[spec.language] || 0) + 1;
    working.subCounts[spec.subcategory] = (working.subCounts[spec.subcategory] || 0) + 1;
    working.genreCounts[spec.genre] = (working.genreCounts[spec.genre] || 0) + 1;
    working.languageCounts[spec.language] = (working.languageCounts[spec.language] || 0) + 1;
    working.formCounts[spec.asset_form] = (working.formCounts[spec.asset_form] || 0) + 1;
    working.runtimeCounts[spec.runtime] = (working.runtimeCounts[spec.runtime] || 0) + 1;
    out.push({
      asset_type: "code-material",
      drive_path: drivePathForCodeSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.subcategory}/${spec.language}/${spec.asset_form}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const genreId of CODE_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = CODE_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre && genre.tier === "core" ? CODE_COVERAGE_TARGET.core : CODE_COVERAGE_TARGET.supporting;
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

export function assertCodePlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => codeSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const langs = new Set(lines.map((l) => l.spec?.language).filter(Boolean));
  const runtimes = new Set(lines.map((l) => l.spec?.runtime).filter(Boolean));
  const forms = new Set(lines.map((l) => l.spec?.asset_form).filter(Boolean));
  const uniqueTitles = new Set(titles);
  const uniquePrompts = new Set(prompts);
  const uniqueFp = new Set(fps);
  const uniqueGenres = new Set(genres.filter(Boolean));
  const genreCounts = {};
  const languageCounts = {};
  for (const g of genres) genreCounts[g] = (genreCounts[g] || 0) + 1;
  for (const l of lines) languageCounts[l.spec?.language] = (languageCounts[l.spec?.language] || 0) + 1;
  const maxShare = lines.length ? Math.max(0, ...Object.values(genreCounts)) / lines.length : 0;
  const jsShare = lines.length ? (languageCounts.javascript || 0) / lines.length : 0;
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
      jsShare <= 0.55 &&
      maxConsecutive <= 2 &&
      langs.size >= 2 &&
      forms.size >= 2 &&
      runtimes.size >= 2,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    maxShare,
    jsShare,
    maxConsecutive,
    languages: [...langs],
    runtimes: [...runtimes],
    forms: [...forms],
    languageCounts,
  };
}
