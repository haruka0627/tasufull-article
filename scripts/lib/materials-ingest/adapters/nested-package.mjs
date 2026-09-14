/**
 * Nested variation adapters: {slug}/{slug}-NNN/metadata.json
 * (web-material / code-material)
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildListItem,
  categoryFromPath,
  extOf,
  fileMtime,
  isNonEmptyFile,
  normalizeMaterialsMetadata,
  parseVariationFromName,
  readJsonSafe,
  toIso,
  truncateText,
  uniqueTags,
} from "../common.mjs";
import {
  englishSearchKeywords,
  resolveJapaneseDisplayTitle,
} from "../japanese-display-title.mjs";
import {
  parseWebSpecFromPath,
  webSpecToMetadata,
} from "../web-demand-genre-ssot.mjs";
import {
  parseCodeSpecFromPath,
  codeSpecToMetadata,
} from "../code-demand-genre-ssot.mjs";
import {
  parseTextSpecFromPath,
  textSpecToMetadata,
} from "../text-demand-genre-ssot.mjs";
import { mergeSpecPreservingPlannedGenre } from "../canonical-genre-generation-contract-v1.mjs";
import { attachResolvedCreatorUserId } from "../creator-ownership-v1.mjs";

const META_SKIP = new Set([
  "metadata.json",
  "prompt.txt",
  "readme.md",
  "package.json",
  "test.js",
  "test.ts",
  "test_main.py",
]);

function listContentFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    if (META_SKIP.has(name.toLowerCase())) continue;
    if (name.endsWith(".csv") || name.endsWith(".json") && name.startsWith("sample")) {
      // fixtures ok for formats? Spec: don't include metadata/prompt; fixtures optional.
      // Include sample fixtures as they are part of package content for code.
    }
    const full = path.join(dir, name);
    if (!isNonEmptyFile(full)) continue;
    out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function formatsFromFiles(files, { entryFile } = {}) {
  const exts = [];
  const seen = new Set();
  const prefer = entryFile ? [entryFile] : [];
  const ordered = [
    ...prefer.map((n) => files.find((f) => path.basename(f) === n)).filter(Boolean),
    ...files,
  ];
  for (const f of ordered) {
    const e = extOf(f);
    if (!e || e === "txt") continue;
    if (seen.has(e)) continue;
    // skip package.json
    if (path.basename(f) === "package.json") continue;
    seen.add(e);
    exts.push(e);
  }
  return exts;
}

function resolvePrompt(dir, meta) {
  const p = path.join(dir, "prompt.txt");
  if (fs.existsSync(p)) {
    try {
      return fs.readFileSync(p, "utf8").trim();
    } catch {
      /* ignore */
    }
  }
  return String(meta.prompt || meta.sourcePrompt || "");
}

function adaptNested(metaPath, meta, cfg, {
  assetType,
  sourceGenerator,
  previewType,
  requiredEntry,
  formatFilter,
}) {
  const dir = path.dirname(metaPath);
  const packageSlug = String(meta.slug || "").trim();
  if (!packageSlug) {
    return { invalid: [{ reason: "missing_slug", metaPath }] };
  }

  const variation = parseVariationFromName(path.basename(dir), packageSlug);
  if (!variation) {
    return { invalid: [{ reason: "invalid_variation_dir", metaPath, dir }] };
  }

  const categoryId = cfg.typeToCategoryId[assetType];
  if (!categoryId) {
    return { invalid: [{ reason: "unmapped_category", assetType, metaPath }] };
  }

  const entryName = requiredEntry || meta.entryFile || null;
  if (entryName) {
    const entryPath = path.join(dir, entryName);
    if (!isNonEmptyFile(entryPath)) {
      return { invalid: [{ reason: "entry_missing", metaPath, entryName }] };
    }
  }

  const files = listContentFiles(dir);
  let formats = formatsFromFiles(files, { entryFile: entryName });
  if (formatFilter) {
    formats = formats.filter((e) => formatFilter.has(e));
  }
  if (!formats.length && entryName) {
    formats = [extOf(entryName)];
  }
  if (!formats.length) {
    return { invalid: [{ reason: "no_content_formats", metaPath }] };
  }

  const pathInfo = categoryFromPath(meta.categoryPath);
  const category = meta.category || pathInfo.category;
  const subcategory = meta.subcategory || pathInfo.subcategory || meta.languageLabel || "";
  const prompt = resolvePrompt(dir, meta);
  const title = resolveJapaneseDisplayTitle({
    title: meta.title,
    prompt,
    description: meta.description,
    categoryPath: meta.categoryPath,
    category,
    subcategory,
    tags: meta.tags,
    assetType,
    slug: packageSlug,
    languageLabel: meta.languageLabel || meta.language,
  });
  const description =
    truncateText(meta.description) ||
    truncateText(prompt) ||
    truncateText(title);

  const searchKeywords = englishSearchKeywords({
    slug: packageSlug,
    title: meta.title,
    prompt,
    description: meta.description,
  });
  const tags = uniqueTags([
    ...(Array.isArray(meta.tags) ? meta.tags : []),
    assetType,
    category,
    subcategory,
    meta.language,
    meta.languageLabel,
    ...formats,
    ...searchKeywords,
  ]);

  const primary =
    (entryName && path.join(dir, entryName)) ||
    files[0] ||
    metaPath;

  const item = attachResolvedCreatorUserId(buildListItem({
    assetType,
    packageSlug,
    variation,
    categoryId,
    title,
    description: description || title,
    tags,
    searchKeywords,
    fileFormats: formats.map((f) => f.toUpperCase()),
    updatedAt: toIso(
      meta.generatedAt || meta.updatedAt || meta.createdAt,
      fileMtime(primary) || fileMtime(metaPath),
    ),
    thumbnailStyle: cfg.thumbnailStyleByCategory[categoryId] || "default",
    buttonLabel: cfg.buttonLabelByCategory[categoryId] || cfg.buttonLabelByCategory.default,
    isFree: cfg.isFree,
    isAdSupported: cfg.isAdSupported,
    publishable: cfg.publishableDefaults[assetType] === true,
    sourceGenerator,
    sourcePath: dir,
    previewType,
    previewPath: null,
    downloadPath: null,
    subcategory,
    metadataVersion: meta.version || 1,
    metadata: normalizeMaterialsMetadata(meta, {
      category,
      categoryId,
      formats,
    }),
  }), meta);

  return { items: [item], invalid: [] };
}

export function adaptWebPackage(metaPath, meta, cfg) {
  const spec = parseWebSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...webSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
      })
    : meta;
  return adaptNested(metaPath, merged, cfg, {
    assetType: "web-material",
    sourceGenerator: "Web-Materials-AutoGenerator",
    previewType: "code",
    requiredEntry: "index.html",
    formatFilter: new Set(["html", "css", "js"]),
  });
}

export function adaptCodePackage(metaPath, meta, cfg) {
  const spec = parseCodeSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...codeSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
        language: spec.language || meta.language,
        runtime: spec.runtime || meta.runtime,
      })
    : meta;
  const entry = merged.entryFile || meta.entryFile || null;
  return adaptNested(metaPath, merged, cfg, {
    assetType: "code-material",
    sourceGenerator: "Code-Materials-AutoGenerator",
    previewType: "code",
    requiredEntry: entry,
    formatFilter: null,
  });
}

export function adaptDocumentPackage(metaPath, meta, cfg) {
  const spec = parseTextSpecFromPath({
    slug: meta.slug,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...textSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
        language: spec.language || meta.language || "ja",
        entryFile: meta.entryFile || "template.txt",
      })
    : { ...meta, entryFile: meta.entryFile || "template.txt" };
  return adaptNested(metaPath, merged, cfg, {
    assetType: "document",
    sourceGenerator: "Text-Materials-AutoGenerator",
    previewType: "document",
    requiredEntry: merged.entryFile || "template.txt",
    formatFilter: null,
  });
}

export function tryReadMeta(metaPath) {
  const meta = readJsonSafe(metaPath);
  if (meta.__error) return { error: meta.__error };
  return { meta };
}
