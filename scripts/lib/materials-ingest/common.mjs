/**
 * Materials ingest — shared helpers (Build-time Index V1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadIngestConfig() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
  return raw;
}

export function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return { __error: String(err && err.message ? err.message : err) };
  }
}

export function isNonEmptyFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

export function toIso(value, fallbackDate = null) {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate.toISOString();
  }
  return new Date().toISOString();
}

export function fileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return null;
  }
}

export function titleCaseSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function truncateText(text, max = 120) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function uniqueTags(tags) {
  const out = [];
  const seen = new Set();
  for (const t of tags || []) {
    const v = String(t || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export const MATERIALS_METADATA_FIELDS = Object.freeze([
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
  // Canonical genre (all material types). Empty only for honest legacy rows — never infer.
  "genre",
  "mood",
  "energy",
  "bpm",
  "duration",
  "duration_sec",
  "loopable",
  "instrumental",
  "intensity",
  "scene",
  "copy_space",
  "people_presence",
  "people_count",
  "composition",
  "lighting",
  "file_hash",
  "license",
  "license_status",
  "provider",
  "generator",
  "asset_form",
  "background_type",
  "brightness",
  "complexity",
  "line_weight",
  "fill_type",
  "shape_style",
  "color_mode",
  "component_type",
  "layout_type",
  "responsive_mode",
  "theme",
  "density",
  "runtime",
  "framework",
  "dependency",
  "difficulty",
  "text_type",
  "tone",
  "length",
  "template_variables",
  "presentation_purpose",
  "slide_type",
  "design_family",
  "aspect_ratio",
]);

function metadataValue(value) {
  if (Array.isArray(value)) return uniqueTags(value);
  if (value == null) return "";
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Preserve the existing generator metadata vocabulary in the public index.
 * Alias mapping is limited to fields already emitted by repository generators;
 * absent business metadata remains empty instead of being inferred.
 */
export function normalizeMaterialsMetadata(meta = {}, context = {}) {
  const width = Number(meta.width);
  const height = Number(meta.height);
  const measuredSize =
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? `${width}x${height}`
      : "";
  const formats = Array.isArray(context.formats) ? context.formats : [];
  return {
    category: metadataValue(meta.category || context.category || context.categoryId),
    use_case: metadataValue(meta.use_case),
    industry: metadataValue(meta.industry),
    style: metadataValue(meta.style),
    layout: metadataValue(meta.layout || meta.layoutPreset),
    orientation: metadataValue(meta.orientation || meta.aspectRatio),
    color_family: metadataValue(meta.color_family),
    season: metadataValue(meta.season),
    target: metadataValue(meta.target),
    format: metadataValue(meta.format || formats),
    size: metadataValue(meta.size || measuredSize || meta.aspectRatio),
    language: metadataValue(meta.language || meta.languageLabel),
    feature: metadataValue(meta.feature),
    genre: metadataValue(meta.genre),
    mood: metadataValue(meta.mood),
    energy: metadataValue(meta.energy),
    bpm: metadataValue(meta.bpm),
    duration: metadataValue(meta.duration),
    duration_sec: metadataValue(meta.duration_sec),
    loopable: metadataValue(meta.loopable),
    instrumental: metadataValue(meta.instrumental),
    intensity: metadataValue(meta.intensity),
    scene: metadataValue(meta.scene),
    copy_space: metadataValue(meta.copy_space),
    people_presence: metadataValue(meta.people_presence || meta.target),
    people_count: metadataValue(meta.people_count),
    composition: metadataValue(meta.composition || meta.layout),
    lighting: metadataValue(meta.lighting),
    file_hash: metadataValue(meta.file_hash || meta.sha256),
    license: metadataValue(meta.license),
    license_status: metadataValue(meta.license_status),
    provider: metadataValue(meta.provider),
    generator: metadataValue(meta.generator || meta.source_generator),
    asset_form: metadataValue(meta.asset_form || meta.layout),
    background_type: metadataValue(meta.background_type),
    brightness: metadataValue(meta.brightness),
    complexity: metadataValue(meta.complexity),
    line_weight: metadataValue(meta.line_weight),
    fill_type: metadataValue(meta.fill_type),
    shape_style: metadataValue(meta.shape_style),
    color_mode: metadataValue(meta.color_mode),
    component_type: metadataValue(meta.component_type),
    layout_type: metadataValue(meta.layout_type || meta.layout),
    responsive_mode: metadataValue(meta.responsive_mode),
    theme: metadataValue(meta.theme),
    density: metadataValue(meta.density),
    runtime: metadataValue(meta.runtime),
    framework: metadataValue(meta.framework || meta.moduleStyle || meta.module_style),
    dependency: metadataValue(
      Array.isArray(meta.dependencies) ? meta.dependencies.join(",") : meta.dependency || meta.dependencies,
    ),
    difficulty: metadataValue(meta.difficulty),
    text_type: metadataValue(meta.text_type),
    tone: metadataValue(meta.tone),
    length: metadataValue(meta.length),
    template_variables: metadataValue(
      Array.isArray(meta.template_variables) ? meta.template_variables.join(",") : meta.template_variables,
    ),
    presentation_purpose: metadataValue(meta.presentation_purpose || meta.purpose),
    slide_type: metadataValue(meta.slide_type),
    design_family: metadataValue(meta.design_family),
    aspect_ratio: metadataValue(meta.aspect_ratio || meta.aspectRatio),
  };
}

export function padVariation(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1) return null;
  return String(num).padStart(3, "0");
}

export function parseVariationFromName(name, packageSlug) {
  const base = String(name || "")
    .replace(/\.[^.]+$/, "")
    .replace(/_+$/, "");
  const slug = String(packageSlug || "");
  if (slug) {
    const prefixed = new RegExp(`^${escapeRegExp(slug)}[-_](\\d{3,})$`, "i");
    const m = base.match(prefixed);
    if (m) return padVariation(m[1]);
    const output = base.match(/^output[_-]?(\d{3,})$/i);
    if (output) return padVariation(output[1]);
    return null;
  }
  const generic = base.match(/(?:^|[-_])(\d{3,})$/);
  if (generic) return padVariation(generic[1]);
  const output = base.match(/^output[_-]?(\d{3,})$/i);
  if (output) return padVariation(output[1]);
  return null;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function materialsSlug(packageSlug, variation) {
  const v = padVariation(variation) || String(variation).padStart(3, "0");
  return `${packageSlug}-${v}`;
}

export function materialsId(assetType, packageSlug, variation) {
  const v = padVariation(variation) || String(variation).padStart(3, "0");
  return `${assetType}:${packageSlug}:${v}`;
}

export function categoryFromPath(categoryPath) {
  if (Array.isArray(categoryPath) && categoryPath.length) {
    return {
      category: String(categoryPath[0] || ""),
      subcategory: String(categoryPath[1] || ""),
    };
  }
  return { category: "", subcategory: "" };
}

export function walkMetadataFiles(rootDir) {
  const results = [];
  if (!rootDir || !fs.existsSync(rootDir)) return results;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === ".tmp" || ent.name === "node_modules" || ent.name === "__pycache__") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name === "metadata.json") {
        results.push(full);
      }
    }
  }

  walk(rootDir);
  return results;
}

export function extOf(filePath) {
  return path.extname(filePath).replace(/^\./, "").toLowerCase();
}

export function buildListItem({
  assetType,
  packageSlug,
  variation,
  categoryId,
  title,
  description,
  tags,
  fileFormats,
  updatedAt,
  thumbnailStyle,
  buttonLabel,
  isFree,
  isAdSupported,
  publishable,
  sourceGenerator,
  sourcePath,
  previewType,
  previewPath,
  downloadPath,
  subcategory,
  metadataVersion,
  searchKeywords,
  metadata,
  creatorUserId,
}) {
  const v = padVariation(variation);
  const creatorId = String(creatorUserId || "").trim();
  return {
    // Existing Materials list contract
    id: materialsId(assetType, packageSlug, v),
    slug: materialsSlug(packageSlug, v),
    title,
    category_id: categoryId,
    description,
    tags: uniqueTags(tags),
    file_formats: fileFormats,
    download_count: 0,
    rating: 0,
    rating_count: 0,
    updated_at: updatedAt,
    is_free: isFree !== false,
    is_ad_supported: isAdSupported !== false,
    thumbnail_style: thumbnailStyle,
    button_label: buttonLabel,
    popularity_rank: 9999,

    // Internal ingest fields (UI must not require these)
    asset_type: assetType,
    source_generator: sourceGenerator,
    source_path: sourcePath,
    preview_type: previewType || null,
    preview_path: previewPath || null,
    download_path: downloadPath || null,
    publishable: publishable === true,
    variation: Number(v),
    subcategory: subcategory || "",
    metadata_version: metadataVersion || 1,
    search_keywords: uniqueTags(searchKeywords || []),
    ...Object.fromEntries(
      MATERIALS_METADATA_FIELDS.map((field) => [field, metadata?.[field] ?? ""]),
    ),
    ...(creatorId ? { creator_user_id: creatorId } : {}),
  };
}
