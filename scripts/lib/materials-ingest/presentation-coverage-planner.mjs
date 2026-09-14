/**
 * Presentation coverage planner —
 * PURPOSE_DEMAND × SLIDE_TYPE_DEMAND × COVERAGE_SHORTAGE × DIVERSITY_SHORTAGE.
 * Does not treat total inventory count as success. Does not delete existing items.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRESENTATION_ASSET_TYPE,
  PRESENTATION_DEMAND_PURPOSES,
  PRESENTATION_DESIGN_FAMILIES,
  PRESENTATION_HIGH_SLIDE_IDS,
  PRESENTATION_INDUSTRIES,
  PRESENTATION_LAYOUT_TYPES,
  PRESENTATION_QA_CORE_FAMILIES,
  PRESENTATION_QA_CORE_SLIDE_TYPES,
  PRESENTATION_SET_STRUCTURES,
  PRESENTATION_SLIDE_TYPES,
  buildPresentationDescription,
  buildPresentationJapaneseTitle,
  buildPresentationPromptText,
  classifyLegacyPresentationItem,
  drivePathForPresentationSpec,
  inferPresentationDensity,
  presentationSpecFingerprint,
  slugForPresentationSpec,
} from "./presentation-demand-genre-ssot.mjs";
import { coverageShortage, scoreDemandCandidate, shouldSeedCoverageSlot } from "./genre-coverage-priority-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const PRESENTATION_COVERAGE_TARGET = Object.freeze({ core: 2, supporting: 1, slide: 1 });
export const PRESENTATION_MAX_PURPOSE_SHARE = 0.22;
export const PRESENTATION_MAX_FAMILY_SHARE = 0.28;
export const PRESENTATION_MAX_COMBO_SHARE = 0.12;

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

export function loadPresentationInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "presentation" || it.asset_type === "presentation");
  } catch {
    return [];
  }
}

export function snapshotPresentationInventory(items = []) {
  const titleCounts = {};
  const purposeCounts = {};
  const slideCounts = {};
  const familyCounts = {};
  const layoutCounts = {};
  const densityCounts = {};
  const industryCounts = {};
  const comboCounts = {};
  const headerBias = { orange_ui_thumb: 0, layout_preset: {} };
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  let previewComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    if (it.preview_url || it.preview_path) previewComplete += 1;
    if (it.thumbnail_style === "presentation") headerBias.orange_ui_thumb += 1;
    const layoutPreset = String(it.layout || "").trim();
    if (layoutPreset) headerBias.layout_preset[layoutPreset] = (headerBias.layout_preset[layoutPreset] || 0) + 1;
    const hasMeta = Boolean(it.presentation_purpose && it.slide_type && it.design_family && it.layout_type);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      purposeCounts[it.presentation_purpose] = (purposeCounts[it.presentation_purpose] || 0) + 1;
      slideCounts[it.slide_type] = (slideCounts[it.slide_type] || 0) + 1;
      familyCounts[it.design_family] = (familyCounts[it.design_family] || 0) + 1;
      layoutCounts[it.layout_type] = (layoutCounts[it.layout_type] || 0) + 1;
      if (it.density) densityCounts[it.density] = (densityCounts[it.density] || 0) + 1;
      if (it.industry) industryCounts[it.industry] = (industryCounts[it.industry] || 0) + 1;
      const combo = `${it.design_family}|${it.layout_type}|${it.slide_type}`;
      comboCounts[combo] = (comboCounts[combo] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyPresentationItem(it);
    if (derived.purpose !== "unclassified") {
      classified += 1;
      purposeCounts[derived.purpose] = (purposeCounts[derived.purpose] || 0) + 1;
    } else unclassified += 1;
    if (layoutPreset) layoutCounts[layoutPreset] = (layoutCounts[layoutPreset] || 0) + 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  const zeroOrLowPurposes = PRESENTATION_DEMAND_PURPOSES.map((p) => ({
    id: p.id,
    tier: p.tier,
    weight: p.demand_weight,
    count: purposeCounts[p.id] || 0,
    target: p.tier === "core" ? PRESENTATION_COVERAGE_TARGET.core : PRESENTATION_COVERAGE_TARGET.supporting,
  })).filter((p) => p.count < p.target);
  const zeroOrLowSlides = PRESENTATION_SLIDE_TYPES.map((s) => ({
    id: s.id,
    weight: s.demand_weight,
    count: slideCounts[s.id] || 0,
    target: PRESENTATION_COVERAGE_TARGET.slide,
  })).filter((s) => s.count < s.target);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    previewComplete,
    purposeCounts,
    slideCounts,
    familyCounts,
    layoutCounts,
    densityCounts,
    industryCounts,
    comboCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
    zeroOrLowPurposes,
    zeroOrLowSlides,
    highDemandZero: PRESENTATION_DEMAND_PURPOSES.filter((p) => p.tier === "core" && (purposeCounts[p.id] || 0) === 0).map((p) => p.id),
    highSlideZero: PRESENTATION_HIGH_SLIDE_IDS.filter((id) => (slideCounts[id] || 0) === 0),
    headerBias,
  };
}

function diversityShortage(used, allowedLen) {
  if (!allowedLen) return 1;
  if (!used) return 1;
  return Math.max(0.25, 1 - used / allowedLen);
}

export function scorePresentationCandidate(purpose, slide, inventory, planPurposeShare, lastPurposeId, planFamilyShare) {
  const purposeCount = inventory.purposeCounts[purpose.id] || 0;
  const slideCount = inventory.slideCounts[slide.id] || 0;
  const purposeTarget = purpose.tier === "core" ? PRESENTATION_COVERAGE_TARGET.core : PRESENTATION_COVERAGE_TARGET.supporting;
  const familiesUsed = purpose.families.filter((f) => (inventory.familyCounts[f] || 0) > 0).length;
  const div = diversityShortage(familiesUsed, purpose.families.length);
  const scored = scoreDemandCandidate({
    demandWeight: purpose.demand_weight * (slide.demand_weight || 1),
    genreCount: purposeCount,
    subCount: purposeCount,
    target: purposeTarget,
    diversity: div,
    lastGenreId: lastPurposeId,
    genreId: purpose.id,
    planGenreShare: planPurposeShare,
    maxShare: PRESENTATION_MAX_PURPOSE_SHARE,
  });
  scored.score *= coverageShortage(slideCount, PRESENTATION_COVERAGE_TARGET.slide);
  if (planFamilyShare >= PRESENTATION_MAX_FAMILY_SHARE) scored.score *= 0.08;
  if ((inventory.highDemandZero || []).length > 0 && purpose.tier === "supporting") scored.score *= 0.15;
  return { ...scored, div, purposeCount, slideCount };
}

function pickUnusedAxes(purpose, slide, inventory, usedFingerprints, planFamily) {
  const families = [...purpose.families];
  const layouts = [...(slide.layouts || Object.keys(PRESENTATION_LAYOUT_TYPES))];
  const industries = [...purpose.industries];
  const subs = purpose.subcategories;
  const n = usedFingerprints.size;
  const sortedFamilies = families.sort((a, b) => (inventory.familyCounts[a] || 0) - (inventory.familyCounts[b] || 0));
  const sortedLayouts = layouts.sort((a, b) => (inventory.layoutCounts[a] || 0) - (inventory.layoutCounts[b] || 0));
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const salt = n + attempt;
    let design_family = sortedFamilies[salt % sortedFamilies.length];
    if ((planFamily[design_family] || 0) / Math.max(1, n) >= PRESENTATION_MAX_FAMILY_SHARE && sortedFamilies.length > 1) {
      design_family = sortedFamilies[(salt + 1) % sortedFamilies.length];
    }
    const spec = {
      purpose: purpose.id,
      slide_type: slide.id,
      design_family,
      layout_type: sortedLayouts[salt % sortedLayouts.length],
      density: inferPresentationDensity(purpose.id, design_family),
      industry: industries[salt % industries.length],
      subcategory: subs[salt % subs.length].id,
      generation_mode: "slide",
      aspect_ratio: "16:9",
    };
    const combo = `${spec.design_family}|${spec.layout_type}|${spec.slide_type}`;
    if ((inventory.comboCounts[combo] || 0) > 2 && attempt < 20) continue;
    const fp = presentationSpecFingerprint(spec);
    if (!usedFingerprints.has(fp)) return spec;
  }
  return null;
}

function slideById(id) {
  return PRESENTATION_SLIDE_TYPES.find((s) => s.id === id) || null;
}

export function planPresentationDailyQuotaLines(opts = {}) {
  const quota = Math.max(1, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadPresentationInventoryItems(opts.repoRoot);
  const inventory = snapshotPresentationInventory(items);
  const working = {
    purposeCounts: { ...inventory.purposeCounts },
    slideCounts: { ...inventory.slideCounts },
    familyCounts: { ...inventory.familyCounts },
    layoutCounts: { ...inventory.layoutCounts },
    comboCounts: { ...inventory.comboCounts },
    highDemandZero: [...inventory.highDemandZero],
  };
  const exploreN = Math.min(Math.max(1, Math.round(quota * 0.15)), Math.floor(quota * 0.2));
  const out = [];
  const usedFp = new Set();
  const usedTitles = new Set(Object.keys(inventory.titleCounts));
  const usedPrompts = new Set();
  const usedSlugs = new Set();
  let lastPurpose = "";
  const planPurpose = {};
  const planFamily = {};

  function purposeShare(id) {
    return out.length ? (planPurpose[id] || 0) / out.length : 0;
  }
  function familyShare() {
    const counts = Object.values(planFamily);
    const max = counts.length ? Math.max(...counts) : 0;
    return out.length ? max / out.length : 0;
  }

  function considerSlot(preferSupporting, requireSlideId = "", requirePurposeId = "", slotOverride = "") {
    const rows = [];
    for (const purpose of PRESENTATION_DEMAND_PURPOSES) {
      if (requirePurposeId && purpose.id !== requirePurposeId) continue;
      if (preferSupporting && purpose.tier === "core") continue;
      const slideIds = new Set([...(purpose.slide_types || []), ...PRESENTATION_HIGH_SLIDE_IDS.slice(0, 8)]);
      for (const sid of slideIds) {
        if (requireSlideId && sid !== requireSlideId) continue;
        const slide = slideById(sid);
        if (!slide) continue;
        rows.push({
          purpose,
          slide,
          ...scorePresentationCandidate(purpose, slide, working, purposeShare(purpose.id), lastPurpose, familyShare()),
        });
      }
    }
    rows.sort((a, b) => b.score - a.score || a.slide.id.localeCompare(b.slide.id) || a.purpose.id.localeCompare(b.purpose.id));
    for (const row of rows) {
      const spec = pickUnusedAxes(row.purpose, row.slide, working, usedFp, planFamily);
      if (!spec) continue;
      spec.title = buildPresentationJapaneseTitle(spec);
      if (usedTitles.has(spec.title)) continue;
      spec.prompt = buildPresentationPromptText(spec);
      spec.description = buildPresentationDescription(spec);
      if (usedPrompts.has(spec.prompt)) continue;
      const slug = slugForPresentationSpec(spec, { variation: (planPurpose[spec.purpose] || 0) + 1, day, scopeSuffix });
      const left = `${drivePathForPresentationSpec(spec)}/${slug}`;
      if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
      return { spec, slug, left, fp: presentationSpecFingerprint(spec), slot: slotOverride || (preferSupporting ? "exploration" : "exploit") };
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
    lastPurpose = spec.purpose;
    planPurpose[spec.purpose] = (planPurpose[spec.purpose] || 0) + 1;
    planFamily[spec.design_family] = (planFamily[spec.design_family] || 0) + 1;
    working.purposeCounts[spec.purpose] = (working.purposeCounts[spec.purpose] || 0) + 1;
    working.slideCounts[spec.slide_type] = (working.slideCounts[spec.slide_type] || 0) + 1;
    working.familyCounts[spec.design_family] = (working.familyCounts[spec.design_family] || 0) + 1;
    working.layoutCounts[spec.layout_type] = (working.layoutCounts[spec.layout_type] || 0) + 1;
    const combo = `${spec.design_family}|${spec.layout_type}|${spec.slide_type}`;
    working.comboCounts[combo] = (working.comboCounts[combo] || 0) + 1;
    working.highDemandZero = PRESENTATION_DEMAND_PURPOSES.filter((p) => p.tier === "core" && (working.purposeCounts[p.id] || 0) === 0).map(
      (p) => p.id,
    );
    out.push({
      asset_type: PRESENTATION_ASSET_TYPE,
      drive_path: drivePathForPresentationSpec(spec),
      slug,
      use_case: spec.purpose,
      selection_slot: slot,
      demand_reason: `${spec.purpose}/${spec.slide_type}/${spec.design_family}/${spec.layout_type}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
    return true;
  }

  for (const slideId of PRESENTATION_QA_CORE_SLIDE_TYPES) {
    if (out.length >= quota) break;
    if (!shouldSeedCoverageSlot(working.slideCounts[slideId] || 0, PRESENTATION_COVERAGE_TARGET.slide)) continue;
    commitPick(considerSlot(false, slideId));
  }

  let guard = 0;
  while (out.length < quota && guard < quota * 80) {
    guard += 1;
    const needExplore =
      out.filter((x) => x.selection_slot === "exploration").length < exploreN && out.length >= quota - exploreN;
    const picked = needExplore
      ? considerSlot(true, "", "", "exploration") || considerSlot(false, "", "", "exploration")
      : considerSlot(false);
    if (!commitPick(picked)) break;
  }
  return out.slice(0, quota);
}

export function assertPresentationPlanDiversity(lines) {
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.line.split("|").slice(1).join("|"));
  const fps = lines.map((l) => presentationSpecFingerprint(l.spec || {}));
  const purposes = lines.map((l) => l.spec?.purpose);
  const slides = new Set(lines.map((l) => l.spec?.slide_type).filter(Boolean));
  const families = new Set(lines.map((l) => l.spec?.design_family).filter(Boolean));
  const layouts = new Set(lines.map((l) => l.spec?.layout_type).filter(Boolean));
  const combos = new Set(lines.map((l) => `${l.spec?.design_family}|${l.spec?.layout_type}|${l.spec?.slide_type}`));
  const uniqueTitles = new Set(titles);
  const uniquePrompts = new Set(prompts);
  const uniqueFp = new Set(fps);
  const uniquePurposes = new Set(purposes.filter(Boolean));
  const purposeCounts = {};
  for (const p of purposes) purposeCounts[p] = (purposeCounts[p] || 0) + 1;
  const maxShare = lines.length ? Math.max(0, ...Object.values(purposeCounts)) / lines.length : 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let prev = "";
  for (const p of purposes) {
    if (p === prev) consecutive += 1;
    else consecutive = 1;
    prev = p;
    if (consecutive > maxConsecutive) maxConsecutive = consecutive;
  }
  const coreSlides = PRESENTATION_QA_CORE_SLIDE_TYPES.filter((id) => slides.has(id)).length;
  const qaFamilies = PRESENTATION_QA_CORE_FAMILIES.filter((id) => families.has(id)).length;
  const oldLoop = lines.some((l) => /シンプルな(営業資料|会社紹介|提案書|ピッチ)スライド/.test(l.line));
  return {
    ok:
      uniqueTitles.size === titles.length &&
      uniquePrompts.size === prompts.length &&
      uniqueFp.size === fps.length &&
      uniquePurposes.size >= Math.min(6, lines.length) &&
      slides.size >= Math.min(8, lines.length) &&
      families.size >= Math.min(3, lines.length) &&
      layouts.size >= 2 &&
      combos.size === lines.length &&
      maxShare <= 0.45 &&
      maxConsecutive <= 2 &&
      coreSlides >= Math.min(12, lines.length) &&
      qaFamilies >= Math.min(3, lines.length) &&
      !oldLoop,
    uniqueTitles: uniqueTitles.size,
    uniquePrompts: uniquePrompts.size,
    uniqueFingerprints: uniqueFp.size,
    uniquePurposes: uniquePurposes.size,
    uniqueSlides: slides.size,
    uniqueFamilies: families.size,
    uniqueLayouts: layouts.size,
    uniqueCombos: combos.size,
    maxShare,
    maxConsecutive,
    coreSlides,
    qaFamilies,
    purposes: [...uniquePurposes],
    slides: [...slides],
    families: [...families],
    oldLoop,
  };
}

export { PRESENTATION_SET_STRUCTURES, PRESENTATION_QA_CORE_FAMILIES };
