/**
 * Existing 4109 public inventory duplicate cleanup v1.
 * Public-index overlay only. Never deletes source/download bytes.
 * Generators are not imported or invoked.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File } from "./existing-register/hash.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const POLICY_VERSION = "existing-inventory-duplicate-cleanup-v1";
export const QUARANTINE_PATH = path.join(__dirname, "duplicate-cleanup-quarantine-v1.json");

export const PUBLIC_INDEX_JSON = path.join(REPO_ROOT, "materials", "generated", "materials-index.json");
export const PUBLIC_INDEX_JS = path.join(REPO_ROOT, "materials", "generated", "materials-index.generated.js");
export const DOWNLOADABLE_IDS = path.join(REPO_ROOT, "materials", "generated", "materials-downloadable-ids.json");
export const INTERNAL_INDEX = path.join(
  REPO_ROOT,
  "scripts",
  "lib",
  "materials-ingest",
  "cache",
  "materials-index.internal.json",
);

export const REPORT_DIR = path.join(REPO_ROOT, "reports", "materials-existing-inventory-duplicate-cleanup-v1");
export const ROLLBACK_DIR = path.join(REPORT_DIR, "rollback");

/** Same-title extras are high-confidence user-facing clones (quota/procedural). */
export const HIGH_CONFIDENCE_TITLE_FAMILIES = new Set([
  "web",
  "code",
  "template",
  "presentation",
  "sfx",
]);

/** Title extras may be distinct pictures — perceptual HUMAN_GATE, do not auto-remove. */
export const PERCEPTUAL_REVIEW_FAMILIES = new Set([
  "image",
  "illustration",
  "background",
  "icon",
]);

const META_FIELDS = [
  "category",
  "use_case",
  "industry",
  "style",
  "layout",
  "orientation",
  "color_family",
  "season",
  "target",
  "format",
  "size",
  "language",
  "feature",
];

export function familyOf(item) {
  return String(item?.category_id || item?.asset_type || "")
    .trim()
    .toLowerCase()
    .replace(/-material$/, "");
}

export function normText(value) {
  return String(value == null ? "" : value)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ja-JP");
}

export function descriptionStem(item) {
  return normText(item?.description).replace(/[.…]+$/g, "").slice(0, 80);
}

export function titleKey(item) {
  return `${familyOf(item)}::title::${normText(item?.title)}`;
}

export function structuralKey(item) {
  const family = familyOf(item);
  const parts = [
    family,
    "struct",
    normText(item?.title),
    normText(item?.subcategory),
    normText(item?.layout),
  ];
  // Procedural/DSP clones share title+sub+layout; description/slug noise is not a variant.
  if (!HIGH_CONFIDENCE_TITLE_FAMILIES.has(family)) {
    parts.push(descriptionStem(item));
  }
  return parts.join("::");
}

export function publicFilePath(url, root = REPO_ROOT) {
  const parts = String(url || "")
    .split(/[/?#]/)
    .filter(Boolean);
  return path.join(root, ...parts);
}

export function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256Path(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function filledMetadataCount(item) {
  let n = 0;
  for (const field of META_FIELDS) {
    const value = item?.[field];
    if (Array.isArray(value) ? value.length > 0 : String(value || "").trim()) n += 1;
  }
  return n;
}

export function representativeScore(item, ctx = {}) {
  let score = 0;
  if (ctx.downloadExists) score += 1_000_000;
  if (ctx.previewExists) score += 100_000;
  score += filledMetadataCount(item) * 100;
  score += Number(item.download_count) || 0;
  const ts = Date.parse(item.updated_at || "") || 0;
  score += Math.floor(ts / 1000);
  if (!/q\d{2}-\d{8}/i.test(String(item.slug || ""))) score += 50;
  return score;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function pickKeeper(members, ctxById) {
  const ranked = members.slice().sort((a, b) => {
    const sa = representativeScore(a, ctxById.get(a.id) || {});
    const sb = representativeScore(b, ctxById.get(b.id) || {});
    if (sb !== sa) return sb - sa;
    return String(a.id).localeCompare(String(b.id));
  });
  return ranked[0];
}

function clusterRecord(type, key, members, keeper, confidence, action) {
  const keepId = keeper?.id || null;
  const removeIds = members.filter((m) => m.id !== keepId).map((m) => m.id);
  return {
    type,
    key,
    size: members.length,
    keepId,
    removeIds,
    confidence,
    action,
    family: familyOf(members[0]),
    title: members[0]?.title || "",
    ids: members.map((m) => m.id),
  };
}

/**
 * @param {object[]} items
 * @param {{ hashOf?: Function, exists?: Function }} [io]
 */
export function classifyPublicInventory(items, io = {}) {
  const exists = io.exists || ((p) => fs.existsSync(p));
  const hashOf = io.hashOf || ((p) => {
    if (!exists(p)) return null;
    try {
      return sha256File(p);
    } catch {
      return null;
    }
  });

  const ctxById = new Map();
  const hashById = new Map();
  for (const item of items) {
    const downloadPath = item.download_url ? publicFilePath(item.download_url) : "";
    const previewPath = item.preview_url ? publicFilePath(item.preview_url) : "";
    const downloadExists = downloadPath ? exists(downloadPath) : false;
    const previewExists = previewPath ? exists(previewPath) : false;
    ctxById.set(item.id, { downloadExists, previewExists, downloadPath, previewPath });
    hashById.set(item.id, downloadExists ? hashOf(downloadPath) : null);
  }

  const exactClusters = [];
  const byHash = groupBy(
    items.filter((it) => hashById.get(it.id)),
    (it) => `exact::${hashById.get(it.id)}`,
  );
  for (const [key, members] of byHash) {
    if (members.length < 2) continue;
    const keeper = pickKeeper(members, ctxById);
    exactClusters.push(clusterRecord("EXACT", key, members, keeper, "HIGH", "REMOVE_EXTRAS"));
  }

  const exactRemove = new Set(exactClusters.flatMap((c) => c.removeIds));
  const remaining = items.filter((it) => !exactRemove.has(it.id));

  const titleClusters = [];
  const structuralClusters = [];
  const byTitle = groupBy(remaining, titleKey);
  const byStruct = groupBy(remaining, structuralKey);

  for (const [key, members] of byTitle) {
    if (members.length < 2) continue;
    const family = familyOf(members[0]);
    const high = HIGH_CONFIDENCE_TITLE_FAMILIES.has(family);
    const perceptual = PERCEPTUAL_REVIEW_FAMILIES.has(family);
    const keeper = pickKeeper(members, ctxById);
    const confidence = high ? "HIGH" : perceptual ? "LOW" : "MEDIUM";
    // TITLE is classified for the catalog; removal uses STRUCTURAL/EXACT only
    // so layout/sub/description variants are not blindly collapsed.
    titleClusters.push(clusterRecord("TITLE", key, members, keeper, confidence, "KEEP_ALL"));
  }

  for (const [key, members] of byStruct) {
    if (members.length < 2) continue;
    const family = familyOf(members[0]);
    const high = HIGH_CONFIDENCE_TITLE_FAMILIES.has(family);
    const keeper = pickKeeper(members, ctxById);
    structuralClusters.push(
      clusterRecord(
        "STRUCTURAL",
        key,
        members,
        keeper,
        high ? "HIGH" : "LOW",
        high ? "REMOVE_EXTRAS" : "KEEP_ALL",
      ),
    );
  }

  const semanticClusters = titleClusters.map((c) => ({
    ...c,
    type: "SEMANTIC",
    key: c.key.replace("::title::", "::semantic::"),
  }));

  const clusteredIds = new Set([
    ...exactClusters.flatMap((c) => c.ids),
    ...titleClusters.flatMap((c) => c.ids),
  ]);
  const distinctVariants = items
    .filter((it) => !clusteredIds.has(it.id))
    .map((it) => ({
      type: "DISTINCT_VARIANT",
      key: `distinct::${it.id}`,
      size: 1,
      keepId: it.id,
      removeIds: [],
      confidence: "HIGH",
      action: "KEEP_ALL",
      family: familyOf(it),
      title: it.title || "",
      ids: [it.id],
    }));

  const removeIds = new Set();
  for (const cluster of [...exactClusters, ...titleClusters, ...structuralClusters]) {
    if (cluster.action !== "REMOVE_EXTRAS") continue;
    if (cluster.confidence !== "HIGH") continue;
    for (const id of cluster.removeIds) removeIds.add(id);
  }

  const keepIds = items.filter((it) => !removeIds.has(it.id)).map((it) => it.id);
  for (const cluster of [...exactClusters, ...titleClusters, ...structuralClusters]) {
    if (cluster.action !== "REMOVE_EXTRAS" || cluster.confidence !== "HIGH") continue;
    if (!keepIds.includes(cluster.keepId)) {
      keepIds.push(cluster.keepId);
      removeIds.delete(cluster.keepId);
    }
  }

  const uniqueTitles = (list) => new Set(list.map((it) => `${familyOf(it)}::${normText(it.title)}`)).size;

  return {
    policyVersion: POLICY_VERSION,
    itemCount: items.length,
    uniqueTitleCount: uniqueTitles(items),
    exactClusters,
    titleClusters,
    structuralClusters,
    semanticClusters,
    distinctVariantCount: distinctVariants.length,
    duplicateClusterCount:
      exactClusters.length + titleClusters.length + structuralClusters.length,
    highConfidenceRemoveIds: [...removeIds],
    keepIds: [...new Set(keepIds)],
    ctxById,
    hashById,
  };
}

export function applyClassificationToItems(items, classified) {
  const remove = new Set(classified.highConfidenceRemoveIds);
  const keep = items.filter((it) => !remove.has(it.id));
  const quarantined = items.filter((it) => remove.has(it.id));
  if (keep.length < 1) {
    throw new Error("refuse_blind_delete: keep set empty");
  }
  const keepByCluster = new Map();
  for (const cluster of [
    ...classified.exactClusters,
    ...classified.titleClusters,
    ...classified.structuralClusters,
  ]) {
    if (cluster.action !== "REMOVE_EXTRAS" || cluster.confidence !== "HIGH") continue;
    const kept = keep.filter((it) => cluster.ids.includes(it.id));
    if (kept.length < 1) {
      throw new Error(`refuse_empty_cluster:${cluster.key}`);
    }
    keepByCluster.set(cluster.key, kept.length);
  }
  return { keep, quarantined, keepByCluster };
}

export function loadDuplicateCleanupQuarantine(filePath = QUARANTINE_PATH) {
  if (!fs.existsSync(filePath)) {
    return { version: 1, quarantineIds: [], keepIds: [], applied: false };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Index rebuild overlay: quarantined IDs stay non-public. Source files untouched. */
export function applyQuarantineToWorkingItems(working, quarantine = loadDuplicateCleanupQuarantine()) {
  const blocked = new Set(quarantine.quarantineIds || []);
  if (!blocked.size) return working;
  return working.map((item) => {
    if (!blocked.has(item.id)) return item;
    return { ...item, publishable: false };
  });
}

export function renderPublicIndexJs(payload) {
  return (
    "/* generated by scripts/build-materials-index.mjs — do not edit */\n" +
    "(function (global) {\n" +
    '  "use strict";\n' +
    `  global.TASFUL_MATERIALS_INDEX = ${JSON.stringify(payload)};\n` +
    "})(typeof window !== \"undefined\" ? window : globalThis);\n"
  );
}

export function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  if (fs.statSync(tmp).size < 2) {
    fs.unlinkSync(tmp);
    throw new Error(`atomic write produced empty file: ${filePath}`);
  }
  fs.renameSync(tmp, filePath);
}

function copyIfMissing(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}

export function ensureRollbackBackup() {
  fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
  copyIfMissing(PUBLIC_INDEX_JSON, path.join(ROLLBACK_DIR, "materials-index.json"));
  copyIfMissing(PUBLIC_INDEX_JS, path.join(ROLLBACK_DIR, "materials-index.generated.js"));
  copyIfMissing(DOWNLOADABLE_IDS, path.join(ROLLBACK_DIR, "materials-downloadable-ids.json"));
  if (fs.existsSync(INTERNAL_INDEX)) {
    copyIfMissing(INTERNAL_INDEX, path.join(ROLLBACK_DIR, "materials-index.internal.json"));
  }
  const bak = JSON.parse(fs.readFileSync(path.join(ROLLBACK_DIR, "materials-index.json"), "utf8"));
  return {
    dir: ROLLBACK_DIR.replace(/\\/g, "/"),
    publicIndexSha256: sha256Path(path.join(ROLLBACK_DIR, "materials-index.json")),
    beforePublicCount: bak.itemCount,
    generatedAt: bak.generatedAt,
  };
}

export function writePublicIndexPayload(payload) {
  atomicWrite(PUBLIC_INDEX_JSON, `${JSON.stringify(payload)}\n`);
  atomicWrite(PUBLIC_INDEX_JS, renderPublicIndexJs(payload));
  atomicWrite(
    DOWNLOADABLE_IDS,
    `${JSON.stringify({ version: 1, generatedAt: payload.generatedAt, ids: payload.items.map((i) => i.id) })}\n`,
  );
}

export function syncPublicIndexToDist() {
  const distDir = path.join(REPO_ROOT, "deploy", "cloudflare", "dist", "materials", "generated");
  if (!fs.existsSync(path.dirname(distDir))) return { copied: false, reason: "dist_missing" };
  fs.mkdirSync(distDir, { recursive: true });
  for (const name of ["materials-index.json", "materials-index.generated.js", "materials-downloadable-ids.json"]) {
    const src = path.join(REPO_ROOT, "materials", "generated", name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, name));
  }
  return { copied: true };
}

export function markInternalQuarantined(quarantineIds) {
  if (!fs.existsSync(INTERNAL_INDEX)) return { updated: false };
  const blocked = new Set(quarantineIds);
  const payload = JSON.parse(fs.readFileSync(INTERNAL_INDEX, "utf8"));
  const items = (payload.items || []).map((it) => (blocked.has(it.id) ? { ...it, publishable: false } : it));
  payload.items = items;
  payload.generatedAt = new Date().toISOString();
  atomicWrite(INTERNAL_INDEX, `${JSON.stringify(payload, null, 2)}\n`);
  return { updated: true, itemCount: items.length };
}

export function integrityOfPublicItems(items, exists = (p) => fs.existsSync(p)) {
  const ids = new Set();
  const slugs = new Set();
  const urls = new Set();
  let broken = 0;
  let orphan = 0;
  let dupId = 0;
  let dupSlug = 0;
  let dupUrl = 0;
  for (const item of items) {
    if (!item?.id || !item?.slug || !item?.title || !item?.category_id) orphan += 1;
    if (ids.has(item.id)) dupId += 1;
    else ids.add(item.id);
    if (slugs.has(item.slug)) dupSlug += 1;
    else slugs.add(item.slug);
    if (item.download_url) {
      if (urls.has(item.download_url)) dupUrl += 1;
      else urls.add(item.download_url);
      if (!exists(publicFilePath(item.download_url))) broken += 1;
    } else {
      broken += 1;
    }
    if (item.preview_url && !exists(publicFilePath(item.preview_url))) broken += 1;
  }
  return {
    brokenPublicReferenceCount: broken,
    orphanIndexEntryCount: orphan,
    duplicateIdCount: dupId,
    duplicateSlugCount: dupSlug,
    duplicateDownloadUrlCount: dupUrl,
  };
}

export function searchPublicItems(items, query) {
  const q = normText(query);
  if (!q) return items.slice();
  return items.filter((item) => {
    const hay = normText(
      [
        item.title,
        item.description,
        item.slug,
        ...(item.tags || []),
        ...(item.search_keywords || []),
        item.category_id,
        item.layout,
        item.style,
        item.use_case,
      ].join(" "),
    );
    return hay.includes(q);
  });
}

export function filterPublicItems(items, categoryId) {
  if (!categoryId || categoryId === "all") return items.slice();
  return items.filter((it) => it.category_id === categoryId);
}
