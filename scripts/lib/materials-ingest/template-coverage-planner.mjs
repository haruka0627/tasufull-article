/**
 * Template coverage planner — existing catalog families × layout/style/orientation.
 * Generic fill is forbidden. Count-under-quota is valid.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEMPLATE_FAMILIES,
  TEMPLATE_LAYOUTS,
  TEMPLATE_ORIENTATIONS,
  TEMPLATE_STYLES,
  buildTemplateJapaneseTitle,
  buildTemplatePromptText,
  classifyLegacyTemplateItem,
  drivePathForTemplateSpec,
  getTemplateFamily,
  slugForTemplateSpec,
  templateSpecFingerprint,
} from "./template-demand-genre-ssot.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const TEMPLATE_COVERAGE_TARGET = Object.freeze({ family: 2 });
export const TEMPLATE_MAX_FAMILY_SHARE = 0.22;

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

export function loadTemplateInventoryItems(repoRoot = ROOT) {
  const indexPath = path.join(repoRoot, "materials/generated/materials-index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return (index.items || []).filter((it) => it.category_id === "template" || it.asset_type === "template");
  } catch {
    return [];
  }
}

export function snapshotTemplateInventory(items = []) {
  const titleCounts = {};
  const familyCounts = {};
  const layoutCounts = {};
  const styleCounts = {};
  let classified = 0;
  let unclassified = 0;
  let metadataComplete = 0;
  for (const it of items) {
    const title = String(it.title || "").trim();
    titleCounts[title] = (titleCounts[title] || 0) + 1;
    const hasMeta = Boolean(it.genre && it.layout_type && it.style);
    if (hasMeta) {
      metadataComplete += 1;
      classified += 1;
      familyCounts[it.genre] = (familyCounts[it.genre] || 0) + 1;
      layoutCounts[it.layout_type] = (layoutCounts[it.layout_type] || 0) + 1;
      styleCounts[`${it.genre}|${it.style}`] = (styleCounts[`${it.genre}|${it.style}`] || 0) + 1;
      continue;
    }
    const derived = classifyLegacyTemplateItem(it);
    if (derived.genre !== "unclassified") {
      classified += 1;
      familyCounts[derived.genre] = (familyCounts[derived.genre] || 0) + 1;
    } else unclassified += 1;
  }
  const dupTitles = Object.entries(titleCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  return {
    total: items.length,
    classified,
    unclassified,
    metadataComplete,
    familyCounts,
    layoutCounts,
    styleCounts,
    titleCounts,
    duplicateTitles: dupTitles,
    titleLoopTop: dupTitles.slice(0, 8).map(([title, n]) => ({ title, n })),
  };
}

function rotateKeys(obj, n) {
  const keys = Object.keys(obj);
  if (!keys.length) return keys;
  const i = ((n % keys.length) + keys.length) % keys.length;
  return keys.slice(i).concat(keys.slice(0, i));
}

function scoreFamily(fam, working, share) {
  const count = working.familyCounts[fam.id] || 0;
  const shortage = Math.max(0, TEMPLATE_COVERAGE_TARGET.family - count);
  const diversity = 1 - Math.min(1, share);
  return shortage * 4 + (count === 0 ? 6 : 0) + diversity * 2;
}

export function planTemplateDailyQuotaLines(opts = {}) {
  const quota = Math.max(0, Number(opts.quota) || 30);
  const now = opts.now || new Date();
  const day = yyyymmdd(now);
  const completed = opts.completedKeys || new Set();
  const scope = String(opts.scope || "").trim().toLowerCase();
  const scopeSuffix = scope && scope !== "local" ? `-${scope.replace(/[^a-z0-9-]/g, "-")}` : "";
  const items = opts.items || loadTemplateInventoryItems(opts.repoRoot);
  const inventory = snapshotTemplateInventory(items);
  const working = {
    familyCounts: { ...inventory.familyCounts },
    layoutCounts: { ...inventory.layoutCounts },
    styleCounts: { ...inventory.styleCounts },
  };
  const exploreN = Math.min(Math.max(1, Math.round(quota * 0.15)), Math.floor(quota * 0.2));
  const out = [];
  const usedFp = new Set();
  const usedTitles = new Set(Object.keys(inventory.titleCounts));
  const usedPrompts = new Set();
  const usedSlugs = new Set();
  const planFamily = {};

  function familyShare(id) {
    return out.length ? (planFamily[id] || 0) / out.length : 0;
  }

  function consider() {
    const rows = TEMPLATE_FAMILIES.map((fam) => ({
      fam,
      score: scoreFamily(fam, working, familyShare(fam.id)),
    })).sort((a, b) => b.score - a.score || a.fam.id.localeCompare(b.fam.id));
    for (const row of rows) {
      if (familyShare(row.fam.id) >= TEMPLATE_MAX_FAMILY_SHARE && out.length >= 4) continue;
      const layouts = rotateKeys(TEMPLATE_LAYOUTS, out.length);
      const styles = rotateKeys(TEMPLATE_STYLES, Math.floor(out.length / 2));
      const orients = rotateKeys(TEMPLATE_ORIENTATIONS, out.length);
      const uses = row.fam.use_cases || ["business"];
      for (const layout_type of layouts) {
        for (const style of styles) {
          for (const orientation of orients) {
            for (const use_case of uses) {
              const spec = {
                genre: row.fam.id,
                family: row.fam.id,
                layout_type,
                style,
                orientation,
                use_case,
                format: row.fam.format,
                generator: row.fam.generator,
              };
              spec.title = buildTemplateJapaneseTitle(spec);
              spec.prompt = buildTemplatePromptText(spec);
              const fp = templateSpecFingerprint(spec);
              if (usedFp.has(fp) || usedTitles.has(spec.title) || usedPrompts.has(spec.prompt)) continue;
              const slug = slugForTemplateSpec(spec, { variation: (planFamily[spec.genre] || 0) + 1, day, scopeSuffix });
              const left = `${drivePathForTemplateSpec(spec)}/${slug}`;
              if (usedSlugs.has(slug) || completed.has(slug) || completed.has(left)) continue;
              return { spec, slug, left, fp };
            }
          }
        }
      }
    }
    return null;
  }

  let guard = 0;
  while (out.length < quota && guard < quota * 40) {
    guard += 1;
    const picked = consider();
    if (!picked) break;
    const { spec, slug, left, fp } = picked;
    usedFp.add(fp);
    usedTitles.add(spec.title);
    usedPrompts.add(spec.prompt);
    usedSlugs.add(slug);
    planFamily[spec.genre] = (planFamily[spec.genre] || 0) + 1;
    working.familyCounts[spec.genre] = (working.familyCounts[spec.genre] || 0) + 1;
    const slot = out.length >= quota - exploreN ? "exploration" : "exploit";
    out.push({
      asset_type: "template",
      drive_path: drivePathForTemplateSpec(spec),
      slug,
      use_case: spec.use_case,
      selection_slot: slot,
      demand_reason: `${spec.genre}/${spec.layout_type}/${spec.style}`,
      line: `${left}|${spec.prompt}`,
      output_key: left,
      spec,
    });
  }
  return out;
}

export function assertTemplatePlanDiversity(lines) {
  const fps = lines.map((l) => templateSpecFingerprint(l.spec || {}));
  const titles = lines.map((l) => l.spec?.title || "");
  const prompts = lines.map((l) => l.spec?.prompt || l.line.split("|")[1] || "");
  const families = lines.map((l) => l.spec?.genre);
  const uniqueFp = new Set(fps);
  const uniqueTitles = new Set(titles);
  const uniquePrompts = new Set(prompts);
  const issues = [];
  if (uniqueFp.size !== lines.length) issues.push("dup_fingerprint");
  if (uniqueTitles.size !== lines.length) issues.push("dup_title");
  if (uniquePrompts.size !== lines.length) issues.push("dup_prompt");
  const counts = {};
  for (const id of families) counts[id] = (counts[id] || 0) + 1;
  for (const [id, n] of Object.entries(counts)) {
    if (lines.length >= 8 && n / lines.length > TEMPLATE_MAX_FAMILY_SHARE + 0.15) issues.push(`share:${id}`);
  }
  return { ok: issues.length === 0, issues, uniqueFp: uniqueFp.size, uniqueTitles: uniqueTitles.size };
}

export { getTemplateFamily };
