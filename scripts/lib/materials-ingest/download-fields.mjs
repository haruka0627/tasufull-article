/**
 * Download field helpers for Materials Real Download V1
 */
import path from "node:path";
import { resolveCanonicalCreatorUserId } from "./creator-ownership-v1.mjs";

export const DOWNLOAD_PUBLIC_DIRS = {
  image: "image",
  illustration: "illustration",
  background: "background",
  icon: "icon",
  sfx: "sfx",
  bgm: "bgm",
  template: "template",
  presentation: "presentation",
  "web-material": "web",
  "code-material": "code",
  document: "document",
};

export const ZIP_ASSET_TYPES = new Set(["web-material", "code-material"]);
export const FILE_ASSET_TYPES = new Set([
  "image",
  "illustration",
  "background",
  "icon",
  "sfx",
  "bgm",
  "template",
  "presentation",
  "document",
]);

export function publicDownloadDir(assetType) {
  return DOWNLOAD_PUBLIC_DIRS[assetType] || null;
}

export function resolveDownloadKind(assetType) {
  if (ZIP_ASSET_TYPES.has(assetType)) return "zip";
  if (FILE_ASSET_TYPES.has(assetType)) return "file";
  return null;
}

export function resolveDownloadFilename(item) {
  const kind = resolveDownloadKind(item.asset_type);
  if (!kind) return null;
  if (kind === "zip") return `${item.slug}.zip`;
  const src = item.source_path || "";
  const ext = path.extname(src).replace(/^\./, "").toLowerCase();
  if (!ext) {
    const fmt = Array.isArray(item.file_formats) && item.file_formats[0]
      ? String(item.file_formats[0]).toLowerCase()
      : "bin";
    return `${item.slug}.${fmt}`;
  }
  return `${item.slug}.${ext}`;
}

export function resolveDownloadUrl(item, filename) {
  const dir = publicDownloadDir(item.asset_type);
  if (!dir || !filename) return null;
  return `/materials/generated/downloads/${dir}/${filename}`;
}

export function resolvePreviewUrl(item, downloadUrl) {
  if (!item || item.publishable !== true) return null;
  if (["image", "illustration", "background", "icon", "sfx", "bgm"].includes(item.asset_type)) {
    return downloadUrl || null;
  }
  if (["template", "presentation"].includes(item.asset_type)) {
    const dir = publicDownloadDir(item.asset_type);
    return dir ? `/materials/generated/previews/${dir}/${item.slug}.svg` : null;
  }
  return null;
}

export function attachDownloadFields(item) {
  const assetType = item.asset_type;
  const publishable = item.publishable === true;
  const kind = resolveDownloadKind(assetType);
  const downloadable = publishable && kind != null;
  const filename = downloadable ? resolveDownloadFilename(item) : null;
  const url = downloadable ? resolveDownloadUrl(item, filename) : null;
  const previewUrl = resolvePreviewUrl(item, url);

  return {
    ...item,
    download_kind: kind,
    download_filename: filename,
    download_url: url,
    downloadable,
    preview_url: previewUrl,
  };
}

/** Public browser-safe item (no Drive absolute paths). */
export function toPublicItem(item) {
  const withDl = attachDownloadFields(item);
  const {
    source_path: _sp,
    preview_path: _pp,
    download_path: _dp,
    ...rest
  } = withDl;
  const owner = resolveCanonicalCreatorUserId(rest);
  if (owner.ok) rest.creator_user_id = owner.creator_user_id;
  else delete rest.creator_user_id;
  return {
    ...rest,
    // keep download_url as public contract; download_path unused
    download_path: null,
  };
}

/** Internal build record (not served to browser). */
export function toInternalRecord(item) {
  const withDl = attachDownloadFields(item);
  return {
    id: withDl.id,
    slug: withDl.slug,
    asset_type: withDl.asset_type,
    category_id: withDl.category_id,
    publishable: withDl.publishable === true,
    downloadable: withDl.downloadable === true,
    download_kind: withDl.download_kind,
    download_filename: withDl.download_filename,
    download_url: withDl.download_url,
    preview_url: withDl.preview_url,
    source_path: withDl.source_path || null,
    package_path:
      withDl.download_kind === "zip" ? withDl.source_path || null : null,
    file_formats: withDl.file_formats || [],
    variation: withDl.variation,
    ...(withDl.creator_user_id ? { creator_user_id: withDl.creator_user_id } : {}),
  };
}
