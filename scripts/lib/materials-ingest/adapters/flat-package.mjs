/**
 * Flat package adapters: one metadata.json + variation files in same dir
 * (image / icon / sfx / bgm / template / presentation)
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
  imageSpecToMetadata,
  parseImageSpecFromPath,
} from "../image-demand-genre-ssot.mjs";
import {
  illustrationSpecToMetadata,
  parseIllustrationSpecFromPath,
} from "../illustration-demand-genre-ssot.mjs";
import {
  backgroundSpecToMetadata,
  parseBackgroundSpecFromPath,
} from "../background-demand-genre-ssot.mjs";
import {
  iconSpecToMetadata,
  parseIconSpecFromPath,
} from "../icon-demand-genre-ssot.mjs";
import {
  parsePresentationSpecFromPath,
  presentationSpecToMetadata,
} from "../presentation-demand-genre-ssot.mjs";
import { parseSfxSpecFromPath, sfxSpecToMetadata } from "../sfx-demand-genre-ssot.mjs";
import { mergeSpecPreservingPlannedGenre } from "../canonical-genre-generation-contract-v1.mjs";
import { attachResolvedCreatorUserId } from "../creator-ownership-v1.mjs";

const SKIP_NAMES = new Set(["metadata.json", "prompt.txt", "readme.md", "package.json"]);

function listAssetFiles(dir, allowedExts) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_NAMES.has(name.toLowerCase())) continue;
    const full = path.join(dir, name);
    if (!isNonEmptyFile(full)) continue;
    const ext = extOf(full);
    if (allowedExts && !allowedExts.has(ext)) continue;
    out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
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
  return String(meta.prompt || meta.sourcePrompt || meta.expandedCaption || "");
}

function baseNormalize(ctx) {
  const {
    assetType,
    metaPath,
    meta,
    cfg,
    allowedExts,
    previewType,
    sourceGenerator,
  } = ctx;
  const dir = path.dirname(metaPath);
  const packageSlug = String(meta.slug || "").trim();
  if (!packageSlug) {
    return { invalid: [{ reason: "missing_slug", metaPath }] };
  }

  const categoryId = cfg.typeToCategoryId[assetType];
  if (!categoryId) {
    return { invalid: [{ reason: "unmapped_category", assetType, metaPath }] };
  }

  const pathInfo = categoryFromPath(meta.categoryPath);
  const category = meta.category || pathInfo.category;
  const subcategory = meta.subcategory || pathInfo.subcategory;
  const prompt = resolvePrompt(dir, meta);
  const files = listAssetFiles(dir, allowedExts);

  if (!files.length) {
    return { invalid: [{ reason: "no_variation_files", metaPath, packageSlug }] };
  }

  const publishableDefault = cfg.publishableDefaults[assetType] === true;
  const items = [];
  const invalid = [];

  for (const filePath of files) {
    const variation = parseVariationFromName(path.basename(filePath), packageSlug);
    if (!variation) {
      invalid.push({
        reason: "invalid_variation_name",
        file: filePath,
        packageSlug,
      });
      continue;
    }

    const formats = [extOf(filePath)];
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
      ...formats,
      ...searchKeywords,
    ]);

    const updatedAt = toIso(
      meta.generatedAt || meta.updatedAt || meta.createdAt,
      fileMtime(filePath) || fileMtime(metaPath),
    );

    items.push(
      attachResolvedCreatorUserId(buildListItem({
        assetType,
        packageSlug,
        variation,
        categoryId,
        title,
        description: description || title,
        tags,
        searchKeywords,
        fileFormats: formats.map((f) => f.toUpperCase()),
        updatedAt,
        thumbnailStyle: cfg.thumbnailStyleByCategory[categoryId] || "default",
        buttonLabel: cfg.buttonLabelByCategory[categoryId] || cfg.buttonLabelByCategory.default,
        isFree: cfg.isFree,
        isAdSupported: cfg.isAdSupported,
        publishable: publishableDefault,
        sourceGenerator,
        sourcePath: filePath,
        previewType,
        previewPath: previewType === "image" ? filePath : previewType === "audio" ? filePath : null,
        downloadPath: null,
        subcategory,
        metadataVersion: meta.version || 1,
        metadata: normalizeMaterialsMetadata(meta, {
          category,
          categoryId,
          formats,
        }),
      }), meta),
    );
  }

  return { items, invalid };
}

export function adaptRasterPackage(metaPath, meta, cfg, assetType) {
  return baseNormalize({
    assetType,
    metaPath,
    meta,
    cfg,
    allowedExts: new Set(["png", "jpg", "jpeg", "webp", "gif"]),
    previewType: "image",
    sourceGenerator: "ComfyUI-AutoGenerator",
  });
}

export function adaptImagePackage(metaPath, meta, cfg) {
  const spec = parseImageSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...imageSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
      })
    : meta;
  return adaptRasterPackage(metaPath, merged, cfg, "image");
}

export function adaptIllustrationPackage(metaPath, meta, cfg) {
  const spec = parseIllustrationSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...illustrationSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
      })
    : meta;
  return adaptRasterPackage(metaPath, merged, cfg, "illustration");
}

export function adaptBackgroundPackage(metaPath, meta, cfg) {
  const spec = parseBackgroundSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...backgroundSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
      })
    : meta;
  return adaptRasterPackage(metaPath, merged, cfg, "background");
}

export function adaptIconPackage(metaPath, meta, cfg) {
  const spec = parseIconSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...iconSpecToMetadata(spec),
        title: spec.title || meta.title,
        description: spec.description || meta.description,
      })
    : meta;
  return baseNormalize({
    assetType: "icon",
    metaPath,
    meta: merged,
    cfg,
    allowedExts: new Set(["png", "jpg", "jpeg", "webp", "svg"]),
    previewType: "image",
    sourceGenerator: "ComfyUI-AutoGenerator",
  });
}

export function adaptSfxPackage(metaPath, meta, cfg) {
  const spec = parseSfxSpecFromPath({
    categoryPath: meta.categoryPath || meta.category_path,
    slug: meta.slug,
    promptText: meta.prompt,
    metadata: meta,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...sfxSpecToMetadata(spec),
        title: spec.title || meta.title,
      })
    : meta;
  return baseNormalize({
    assetType: "sfx",
    metaPath,
    meta: merged,
    cfg,
    allowedExts: new Set(["wav", "mp3", "ogg"]),
    previewType: "audio",
    sourceGenerator: "SFX-AutoGenerator",
  });
}

export function adaptBgmPackage(metaPath, meta, cfg) {
  return baseNormalize({
    assetType: "bgm",
    metaPath,
    meta,
    cfg,
    allowedExts: new Set(["wav", "mp3", "ogg"]),
    previewType: "audio",
    sourceGenerator: "BGM-AutoGenerator",
  });
}

export function adaptTemplatePackage(metaPath, meta, cfg) {
  // xlsx/docx → existing Materials category `template` (not new document id)
  return baseNormalize({
    assetType: "template",
    metaPath,
    meta,
    cfg,
    allowedExts: new Set(["xlsx", "docx"]),
    previewType: "document",
    sourceGenerator: "Template-AutoGenerator",
  });
}

export function adaptPresentationPackage(metaPath, meta, cfg) {
  const spec = parsePresentationSpecFromPath({
    slug: meta.slug,
    metadata: meta,
    prompt: meta.prompt || meta.sourcePrompt,
  });
  const merged = spec
    ? mergeSpecPreservingPlannedGenre(meta, {
        ...presentationSpecToMetadata(spec),
        title: spec.title || meta.title,
      })
    : meta;
  return baseNormalize({
    assetType: "presentation",
    metaPath,
    meta: merged,
    cfg,
    allowedExts: new Set(["pptx"]),
    previewType: "presentation",
    sourceGenerator: "Presentation-AutoGenerator",
  });
}

export function tryReadMeta(metaPath) {
  const meta = readJsonSafe(metaPath);
  if (meta.__error) return { error: meta.__error };
  return { meta };
}
