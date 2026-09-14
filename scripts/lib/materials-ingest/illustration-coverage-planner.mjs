/**
 * Illustration coverage planner — DEMAND_WEIGHT × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Human portraits are never planned (existing illustration-human-exclude).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isHumanIllustrationPath } from "./illustration-human-exclude.mjs";
import {
  ILLUSTRATION_ASSET_FORMS,
  ILLUSTRATION_BACKGROUNDS,
  ILLUSTRATION_DEMAND_GENRES,
  ILLUSTRATION_QA_CORE_GENRES,
  buildIllustrationDescription,
  buildIllustrationJapaneseTitle,
  buildIllustrationPromptText,
  classifyLegacyIllustrationItem,
  drivePathForIllustrationSpec,
  illustrationSpecFingerprint,
  listIllustrationSubgenres,
  slugForIllustrationSpec,
} from "./illustration-demand-genre-ssot.mjs";
import { scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const ILLUSTRATION_COVERAGE_TARGET = Object.freeze({ core: 4, supporting: 2 });
export const ILLUSTRATION_MAX_GENRE_SHARE = 0.18;

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

export function loadIllustrationInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "illustration" || it.asset_type === "illustration");
  } catch {
    return [];
  }
}

export function snapshotIllustrationInventory(items = []) {
  const titleCounts = {};
  const genreCounts = {};
  const subCounts = {};
  const styleCounts = {};
  const formCounts = {};
  const peopleCounts = {};
  const useCaseCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    const hasMeta = Boolean(it.genre && it.subcategory && it.use_case && it.style && it.asset_form);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      genreCounts[it.genre] = (genreCounts[it.genre] || 0) + 1;
      subCounts[it.subcategory] = (subCounts[it.subcategory] || 0) + 1;
      styleCounts[`${it.subcategory}|${it.style}`] = (styleCounts[`${it.subcategory}|${it.style}`] || 0) + 1;
      formCounts[it.asset_form] = (formCounts[it.asset_form] || 0) + 1;
      peopleCounts[it.people_presence || it.target] = (peopleCounts[it.people_presence || it.target] || 0) + 1;
      useCaseCounts[it.use_case] = (useCaseCounts[it.use_case] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyIllustrationItem(it);
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
  const zeroOrLowCoverage = ILLUSTRATION_DEMAND_GENRES.map((g) => ({
    id: g.id,
    tier: g.tier,
    weight: g.demand_weight,
    count: genreCounts[g.id] || 0,
    target: g.tier === "core" ? ILLUSTRATION_COVERAGE_TARGET.core : ILLUSTRATION_COVERAGE_TARGET.supporting,
  })).filter((g) => g.count < g.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    genreCounts,
    subCounts,
    styleCounts,
    formCounts,
    peopleCounts,
    useCaseCounts,
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

export function scoreIllustrationCandidate(genre, subgenre, inventory, planGenreShare, lastGenreId) {
  const subCount = inventory.subCounts[subgenre.id] || 0;
  const genreCount = inventory.genreCounts[genre.id] || 0;
  const target = genre.tier === "core" ? ILLUSTRATION_COVERAGE_TARGET.core : ILLUSTRATION_COVERAGE_TARGET.supporting;
  const styles = genre.allowed_styles;
  const stylesUsed = styles.filter((st) => (inventory.styleCounts[`${subgenre.id}|${st}`] || 0) > 0).length;
  const div = diversityShortage(stylesUsed, styles.length);
  const scored = scoreDemandCandidate({
    demandWeight: genre.demand_weight,
    genreCount,
    subCount,
    target,
    diversity: div,
    lastGenreId,
    genreId: genre.id,
    planGenreShare,
    maxShare: ILLUSTRATION_MAX_GENRE_SHARE,
  });
  return { ...scored, div, subCount, genreCount };
}

function pickUnusedAxes(genre, subgenre, inventory, usedFingerprints) {
  const styles = [...(subgenre.allowed_styles || genre.allowed_styles)].sort((a, b) => {
    const ca = inventory.styleCounts[`${subgenre.id}|${a}`] || 0;
    const cb = inventory.styleCounts[`${subgenre.id}|${b}`] || 0;
    return ca - cb || a.localeCompare(b);
  });
  const formOffset = usedFingerprints.size % ILLUSTRATION_ASSET_FORMS.length;
  const forms = [
    ...ILLUSTRATION_ASSET_FORMS.slice(formOffset),
    ...ILLUSTRATION_ASSET_FORMS.slice(0, formOffset),
  ].sort((a, b) => (inventory.formCounts[a] || 0) - (inventory.formCounts[b] || 0) || a.localeCompare(b));
  const bgOffset = Math.floor(usedFingerprints.size / 2) % ILLUSTRATION_BACKGROUNDS.length;
  const backgrounds = [
    ...ILLUSTRATION_BACKGROUNDS.slice(bgOffset),
    ...ILLUSTRATION_BACKGROUNDS.slice(0, bgOffset),
  ];
  for (const scene of subgenre.scenes) {
    for (const use_case of subgenre.use_cases) {
      for (const style of styles) {
        for (const asset_form of forms) {
          for (const background_type of backgrounds) {
            const spec = {
              genre: genre.id,
              subcategory: subgenre.id,
              scene: scene.id,
              use_case,
              style,
              asset_form,
              background_type,
              people_presence: "absent",
            };
            const fp = illustrationSpecFingerprint(spec);
            if (!usedFingerprints.has(fp)) return spec;
          }
        }
      }
    }
  }
  return null;
}

export function planIllustrationDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadIllustrationInventoryItems(opts.repoRoot);
  const inventory = snapshotIllustrationInventory(items);
  const working = {
    subCounts: { ...inventory.subCounts },
    genreCounts: { ...inventory.genreCounts },
    styleCounts: { ...inventory.styleCounts },
    formCounts: { ...inventory.formCounts },
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
    for (const { genre, subgenre } of listIllustrationSubgenres()) {
      if (requireGenreId && genre.id !== requireGenreId) continue;
      if (preferSupporting && genre.tier !== "supporting") continue;
      rows.push({ genre, subgenre, ...scoreIllustrationCandidate(genre, subgenre, working, genreShare(genre.id), lastGenre) });
    }
    rows.sort((a, b) => b.score - a.score || a.subgenre.id.localeCompare(b.subgenre.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.genre, row.subgenre, working, usedFp);
      if (!spec) continue;
      spec.title = buildIllustrationJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) {
        spec.asset_form = spec.asset_form === "object" ? "set" : "object";
        spec.title = buildIllustrationJapaneseTitle(spec);
      }
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildIllustrationPromptText(spec);
      spec.description = buildIllustrationDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const left = `${drivePathForIllustrationSpec(spec)}/${slugForIllustrationSpec(spec, { variation: (planGenre[spec.genre] || 0) + 1, day, scopeSuffix })}`;
      if (
        isHumanIllustrationPath({
          public_id: "illustration",
          relative_path: left,
          prompt: spec.prompt,
          subcategory: spec.subcategory,
        })
      ) {
        continue;
      }
      const slug = left.split("/").pop();
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      const slot = slotOverride || (preferSupporting ? "exploration" : "exploit");
      return { spec, slug, left, fp: illustrationSpecFingerprint(spec), slot };
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
    working.formCounts[spec.asset_form] = (working.formCounts[spec.asset_form] || 0) + 1;
    out.push({
      asset_type: "illustration",
      drive_path: drivePathForIllustrationSpec(spec),
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

  for (const genreId of ILLUSTRATION_QA_CORE_GENRES) {
    if (out.length >= quota) break;
    const genre = ILLUSTRATION_DEMAND_GENRES.find((g) => g.id === genreId);
    const target = genre && genre.tier === "core" ? ILLUSTRATION_COVERAGE_TARGET.core : ILLUSTRATION_COVERAGE_TARGET.supporting;
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

export function assertIllustrationPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => illustrationSpecFingerprint(l.spec || {}));
  const genres = lines.map((l) => l.spec?.genre);
  const styles = new Set(lines.map((l) => l.spec?.style).filter(Boolean));
  const forms = new Set(lines.map((l) => l.spec?.asset_form).filter(Boolean));
  const scenes = lines.map((l) => l.spec?.scene);
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
      lines.every((l) => /no people/i.test(l.spec?.prompt || l.line)),
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniqueGenres: uniqueGenres.size,
    uniqueScenes: new Set(scenes.filter(Boolean)).size,
    styles: [...styles],
    assetForms: [...forms],
    maxShare,
    maxConsecutive,
  };
}
