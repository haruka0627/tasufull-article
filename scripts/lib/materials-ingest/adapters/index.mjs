/**
 * Route metadata.json → generator adapter by Drive root / meta.type
 */
import path from "node:path";
import {
  adaptBgmPackage,
  adaptIconPackage,
  adaptImagePackage,
  adaptIllustrationPackage,
  adaptBackgroundPackage,
  adaptPresentationPackage,
  adaptSfxPackage,
  adaptTemplatePackage,
  tryReadMeta as tryReadFlat,
} from "./flat-package.mjs";
import {
  adaptCodePackage,
  adaptWebPackage,
  adaptDocumentPackage,
  tryReadMeta as tryReadNested,
} from "./nested-package.mjs";
import { publicCategoryFromDrivePath } from "../path-category.mjs";
import { isHumanIllustrationPath } from "../illustration-human-exclude.mjs";
import {
  evaluateSizeContract,
  readRasterDimensions,
} from "../size-contract.mjs";
import fs from "node:fs";

function detectAssetType(metaPath, meta, rootKey) {
  const mapped = publicCategoryFromDrivePath(metaPath, meta);
  if (mapped?.asset_type) return mapped.asset_type;
  const t = String(meta.type || "").toLowerCase();
  if (t === "image" || t === "icon" || t === "illustration" || t === "background") {
    return t;
  }
  if (t) return t;
  return rootKey;
}

export function adaptMetadataFile(metaPath, rootKey, cfg) {
  const reader =
    rootKey === "web-material" || rootKey === "code-material" || rootKey === "document" ? tryReadNested : tryReadFlat;
  const { meta, error } = reader(metaPath);
  if (error || !meta) {
    return {
      items: [],
      invalid: [{ reason: "metadata_unreadable", metaPath, detail: error }],
      excluded: [],
    };
  }

  const assetType = detectAssetType(metaPath, meta, rootKey);
  let result;

  switch (assetType) {
    case "image":
      result = adaptImagePackage(metaPath, meta, cfg);
      break;
    case "illustration":
      result = adaptIllustrationPackage(metaPath, meta, cfg);
      break;
    case "background":
      result = adaptBackgroundPackage(metaPath, meta, cfg);
      break;
    case "icon":
      result = adaptIconPackage(metaPath, meta, cfg);
      break;
    case "sfx":
      result = adaptSfxPackage(metaPath, meta, cfg);
      break;
    case "bgm":
      result = adaptBgmPackage(metaPath, meta, cfg);
      break;
    case "template":
      result = adaptTemplatePackage(metaPath, meta, cfg);
      break;
    case "presentation":
      result = adaptPresentationPackage(metaPath, meta, cfg);
      break;
    case "web-material":
      result = adaptWebPackage(metaPath, meta, cfg);
      break;
    case "code-material":
      result = adaptCodePackage(metaPath, meta, cfg);
      break;
    case "document":
      result = adaptDocumentPackage(metaPath, meta, cfg);
      break;
    default:
      return {
        items: [],
        invalid: [{ reason: "unknown_asset_type", assetType, metaPath }],
        excluded: [],
      };
  }

  const items = result.items || [];
  const invalid = result.invalid || [];
  const excluded = [];

  const mapped = publicCategoryFromDrivePath(metaPath, meta);
  const formalItems = [];
  for (const item of items) {
    if (item.asset_type === "bgm" && !isFormalBgmPackage(metaPath, meta, item)) {
      excluded.push({
        reason: "bgm_non_formal",
        id: item.id,
        metaPath,
      });
      continue;
    }
    if (
      isHumanIllustrationPath({
        public_id: item.asset_type || item.category_id,
        asset_type: item.asset_type,
        category_id: item.category_id,
        relative_path: metaPath,
        file_path: item.source_path,
        slug: item.slug,
        prompt: meta.prompt,
        category_path: meta.categoryPath,
      })
    ) {
      excluded.push({
        reason: "illustration_human_excluded",
        id: item.id,
        metaPath,
      });
      continue;
    }
    if (["image", "illustration", "background", "icon"].includes(item.asset_type)) {
      const dim = item.source_path
        ? readRasterDimensions(item.source_path, fs)
        : null;
      const size = evaluateSizeContract({
        width: dim?.width,
        height: dim?.height,
        major: mapped?.major,
        publicId: item.category_id || item.asset_type,
      });
      if (size.applicable && !size.ok) {
        invalid.push({
          reason: size.reason,
          id: item.id,
          metaPath,
          width: size.width,
          height: size.height,
          major: size.major,
        });
        continue;
      }
    }
    formalItems.push(item);
  }

  return { items: formalItems, invalid, excluded, assetType, metaPath: path.normalize(metaPath) };
}

function isFormalBgmPackage(metaPath, meta, item) {
  const p = String(metaPath || item?.source_path || "").replace(/\\/g, "/").toLowerCase();
  const slug = String(meta?.slug || item?.slug || "").toLowerCase();
  if (p.includes("/_qa/") || p.includes("\\_qa\\")) return false;
  if (/(^|[-_/])(smoke|live-e2e|fixture|dummy)([-_/]|$)/i.test(slug)) return false;
  if (/(^|[-_/])(smoke|live-e2e|fixture|dummy)([-_/]|$)/i.test(p)) return false;
  const status = String(meta?.status || "").toLowerCase();
  if (status && !["generated", "ready", "published", "approved"].includes(status)) return false;
  return true;
}
