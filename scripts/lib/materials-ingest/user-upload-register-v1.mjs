/**
 * Materials Creator Upload / Register V1 — existing writers + ownership + ingest.
 * No second Material DB / Creator DB / PUBLIC_INDEX / Card engine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_SOURCE,
  EXISTING_MATERIALS_CATEGORIES,
  validateUserListing,
} from "../materials-user-digital-products/contract.mjs";
import {
  USER_UPLOAD_MAX_BYTES,
  validateUserUpload,
} from "../materials-user-digital-products/security.mjs";
import {
  expectedFilenames,
  preparePackageTmp,
  promotePackageFromTmp,
} from "../../../SFX-AutoGenerator/lib/package.js";
import {
  adaptBackgroundPackage,
  adaptIconPackage,
  adaptImagePackage,
  adaptIllustrationPackage,
  adaptSfxPackage,
} from "./adapters/flat-package.mjs";
import { loadIngestConfig } from "./common.mjs";
import { toPublicItem } from "./download-fields.mjs";
import {
  applyOwnershipOrThrow,
  CANONICAL_QA_USER_ID,
  OWNERSHIP_SOURCE,
  resolveTrustedWriteCreatorUserId,
} from "./creator-ownership-write-v1.mjs";
import {
  ingestRegisteredSfxPackage,
  writeServedPublicIndexJs,
} from "./register-user-material-package-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const UPLOAD_CONTRACT_VERSION = "materials_creator_upload_register_ui.v1";
export { CANONICAL_QA_USER_ID, USER_UPLOAD_MAX_BYTES };

export const OPS_DIR = path.join(ROOT, "reports", "ops", "materials-creator-upload-ui-v1");
export const PACKAGES_DIR = path.join(OPS_DIR, "packages");
export const SOURCE_INDEX_JSON = path.join(ROOT, "materials", "generated", "materials-index.json");
export const DIST_INDEX_JS = path.join(
  ROOT,
  "deploy",
  "cloudflare",
  "dist",
  "materials",
  "generated",
  "materials-index.generated.js",
);

/** Categories this UI can write through existing package adapters. */
export const SUPPORTED_UPLOAD_CATEGORIES = Object.freeze([
  "sfx",
  "image",
  "illustration",
  "background",
  "icon",
]);

export const CATEGORY_UPLOAD_SPEC = Object.freeze({
  sfx: Object.freeze({
    subtype: "audio_sfx",
    listingSubtype: "audio_sfx",
    assetType: "sfx",
    adapter: "sfx",
    exts: Object.freeze([".wav", ".mp3", ".ogg"]),
    categoryPath: Object.freeze(["テロップ", "pop"]),
    preview: "audio",
  }),
  image: Object.freeze({
    subtype: "image_design",
    listingSubtype: "image_design",
    assetType: "image",
    adapter: "image",
    exts: Object.freeze([".png", ".jpg", ".jpeg", ".webp"]),
    categoryPath: Object.freeze(["画像素材"]),
    preview: "image",
  }),
  illustration: Object.freeze({
    subtype: "illustration",
    listingSubtype: "illustration",
    assetType: "illustration",
    adapter: "illustration",
    exts: Object.freeze([".png", ".jpg", ".jpeg", ".webp"]),
    categoryPath: Object.freeze(["イラスト"]),
    preview: "image",
  }),
  background: Object.freeze({
    subtype: "image_design",
    listingSubtype: "other_digital",
    assetType: "background",
    adapter: "background",
    exts: Object.freeze([".png", ".jpg", ".jpeg", ".webp"]),
    categoryPath: Object.freeze(["背景"]),
    preview: "image",
  }),
  icon: Object.freeze({
    subtype: "image_design",
    listingSubtype: "other_digital",
    assetType: "icon",
    adapter: "icon",
    exts: Object.freeze([".png", ".jpg", ".jpeg", ".webp"]),
    categoryPath: Object.freeze(["アイコン"]),
    preview: "image",
  }),
});

const MIME_BY_EXT = Object.freeze({
  ".png": Object.freeze(["image/png"]),
  ".jpg": Object.freeze(["image/jpeg"]),
  ".jpeg": Object.freeze(["image/jpeg"]),
  ".webp": Object.freeze(["image/webp"]),
  ".wav": Object.freeze(["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"]),
  ".mp3": Object.freeze(["audio/mpeg", "audio/mp3"]),
  ".ogg": Object.freeze(["audio/ogg", "application/ogg"]),
});

const ADAPTERS = Object.freeze({
  sfx: adaptSfxPackage,
  image: adaptImagePackage,
  illustration: adaptIllustrationPackage,
  background: adaptBackgroundPackage,
  icon: adaptIconPackage,
});

export function sanitizeUploadSlug(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  if (!s || s === "." || s === ".." || s.includes("..")) return "";
  return s;
}

export function makeUploadSlug(title, categoryId) {
  const fromTitle = sanitizeUploadSlug(
    String(title || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
  const cat = sanitizeUploadSlug(categoryId) || "mat";
  const stamp = Date.now().toString(36);
  return fromTitle ? `${fromTitle.slice(0, 40)}-${stamp}` : `user-${cat}-${stamp}`;
}

export function assertSafeBasename(fileName) {
  const raw = String(fileName || "").replace(/\\/g, "/");
  if (!raw || raw.includes("..") || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    return { ok: false, reason: "path_traversal_denied" };
  }
  const base = path.posix.basename(raw);
  if (!base || base !== raw.split("/").pop()) {
    return { ok: false, reason: "path_traversal_denied" };
  }
  if (/[<>:"|?*\u0000]/.test(base)) {
    return { ok: false, reason: "path_traversal_denied" };
  }
  return { ok: true, basename: base };
}

export function sniffFileKind(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 4) return "";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "wav";
  }
  if (buf.toString("ascii", 0, 4) === "OggS") return "ogg";
  if (buf.toString("ascii", 0, 3) === "ID3") return "mp3";
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "mp3";
  return "";
}

export function validateUploadBytes({ categoryId, fileName, mimeType, buffer }) {
  const spec = CATEGORY_UPLOAD_SPEC[String(categoryId || "")];
  if (!spec) return { ok: false, reason: "unsupported_category" };
  const safe = assertSafeBasename(fileName);
  if (!safe.ok) return safe;
  const ext = path.extname(safe.basename).toLowerCase();
  if (!spec.exts.includes(ext)) {
    return { ok: false, reason: "file_type_not_allowed", ext };
  }
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!buf.length) return { ok: false, reason: "file_size_required" };
  if (buf.length > USER_UPLOAD_MAX_BYTES) return { ok: false, reason: "file_too_large" };
  const mime = String(mimeType || "").trim().toLowerCase();
  const allowedMime = MIME_BY_EXT[ext] || [];
  if (mime && allowedMime.length && !allowedMime.includes(mime)) {
    return { ok: false, reason: "mime_not_allowed", mime };
  }
  const kind = sniffFileKind(buf);
  const expectedKind = ext === ".jpg" || ext === ".jpeg" ? "jpeg" : ext.slice(1);
  if (kind && kind !== expectedKind) {
    return { ok: false, reason: "file_content_mismatch", kind, ext };
  }
  if (!kind) {
    return { ok: false, reason: "file_content_unrecognized" };
  }
  const upload = validateUserUpload({
    subtype: spec.subtype,
    file_name: safe.basename,
    byte_size: buf.length,
    execution_mode: "download",
  });
  if (!upload.ok) return { ok: false, reason: upload.error || "invalid_file", ...upload };
  return { ok: true, spec, ext, basename: safe.basename, byteSize: buf.length };
}

function userPackageDir(userId, slug) {
  const uid = String(userId || "").trim();
  if (!uid || uid.includes("..") || /[\\/]/.test(uid) || !/^[a-zA-Z0-9_-]+$/.test(uid)) {
    return { ok: false, reason: "invalid_package_path" };
  }
  const s = sanitizeUploadSlug(slug);
  if (!s) return { ok: false, reason: "invalid_package_path" };
  const dir = path.resolve(PACKAGES_DIR, uid, s);
  const root = path.resolve(PACKAGES_DIR, uid);
  if (!dir.startsWith(root + path.sep) && dir !== root) {
    return { ok: false, reason: "path_traversal_denied" };
  }
  return { ok: true, dir, userId: uid, slug: s };
}

function parseTags(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 20);
  }
  return String(input || "")
    .split(/[,\s　]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeVisibility(raw, action) {
  const v = String(raw || "").trim().toLowerCase();
  if (action === "draft" || v === "draft" || v === "private") return "draft";
  if (action === "publish" || v === "public") return "public";
  return "draft";
}

export function registerUserUploadedPackage(input = {}) {
  const authenticatedUserId = String(input.authenticatedUserId || "").trim();
  const claimedUserId = input.claimedUserId == null ? "" : String(input.claimedUserId).trim();
  const categoryId = String(input.categoryId || "").trim();
  const action = String(input.action || "draft").trim().toLowerCase();
  const title = String(input.title || "").trim().slice(0, 100);
  const description = String(input.description || "").trim().slice(0, 500);
  const tags = parseTags(input.tags);
  const visibility = normalizeVisibility(input.visibility, action);

  if (!EXISTING_MATERIALS_CATEGORIES.includes(categoryId)) {
    return { ok: false, reason: "unknown_materials_category" };
  }
  const spec = CATEGORY_UPLOAD_SPEC[categoryId];
  if (!spec) return { ok: false, reason: "unsupported_category" };
  if (!title) return { ok: false, reason: "title_required" };

  const trust = resolveTrustedWriteCreatorUserId({
    source: OWNERSHIP_SOURCE.USER,
    authenticatedUserId,
    claimedUserId,
  });
  if (!trust.ok) {
    return { ok: false, stage: "resolveTrustedWriteCreatorUserId", ...trust };
  }

  const listing = validateUserListing({
    source: PRODUCT_SOURCE.USER,
    creator_user_id: trust.creator_user_id,
    subtype: spec.listingSubtype,
    category_id: categoryId,
    distribution: "free",
  });
  if (!listing.ok) {
    return { ok: false, stage: "validateUserListing", ...listing };
  }

  const slug = sanitizeUploadSlug(input.slug) || makeUploadSlug(title, categoryId);
  const dest = userPackageDir(trust.creator_user_id, slug);
  if (!dest.ok) return dest;

  const buf = Buffer.isBuffer(input.fileBuffer)
    ? input.fileBuffer
    : Buffer.from(input.fileBuffer || []);
  const bytesCheck = validateUploadBytes({
    categoryId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: buf,
  });
  if (!bytesCheck.ok) return { ok: false, stage: "validateUploadBytes", ...bytesCheck };

  const packageFile = `${slug}-001${bytesCheck.ext}`;
  fs.mkdirSync(dest.dir, { recursive: true });

  if (categoryId === "sfx") {
    const expected = expectedFilenames(slug, 1);
    const destName = bytesCheck.ext === ".wav" ? expected[0] : packageFile;
    const tmp = preparePackageTmp(dest.dir, { reset: true });
    fs.writeFileSync(path.join(tmp, destName), buf);
    let metadata;
    try {
      metadata = promotePackageFromTmp(dest.dir, {
        expectedFiles: [destName],
        promptText: description || title,
        slug,
        categoryPath: [...spec.categoryPath],
        sampleRate: 48000,
        bitDepth: 16,
        channels: 2,
        presetId: "user-upload",
        fileStats: [{ variation: 1, bytes: buf.length, filename: destName }],
        extraMetadata: {
          title,
          description,
          tags,
          visibility,
          status: visibility === "public" ? "generated" : "draft",
          format: bytesCheck.ext.slice(1),
          product_source: PRODUCT_SOURCE.USER,
          __ownership: {
            source: OWNERSHIP_SOURCE.USER,
            authenticatedUserId: trust.creator_user_id,
          },
          ...(claimedUserId ? { creator_user_id: claimedUserId } : {}),
        },
      });
    } catch (err) {
      return {
        ok: false,
        stage: "promotePackageFromTmp",
        reason: err?.code || err?.message || String(err),
        error: String(err?.message || err),
      };
    }
    return {
      ok: true,
      slug,
      categoryId,
      visibility,
      packageDir: dest.dir,
      metaPath: path.join(dest.dir, "metadata.json"),
      assetPath: path.join(dest.dir, destName),
      downloadFilename: destName,
      creator_user_id: metadata.creator_user_id,
      metadata,
      listing,
    };
  }

  const assetPath = path.join(dest.dir, packageFile);
  fs.writeFileSync(assetPath, buf);
  let metadata;
  try {
    metadata = applyOwnershipOrThrow(
      {
        version: 1,
        type: spec.assetType,
        categoryPath: [...spec.categoryPath],
        slug,
        title,
        description,
        tags,
        files: [packageFile],
        visibility,
        status: visibility === "public" ? "generated" : "draft",
        product_source: PRODUCT_SOURCE.USER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        source: OWNERSHIP_SOURCE.USER,
        authenticatedUserId: trust.creator_user_id,
        claimedUserId,
      },
    );
  } catch (err) {
    return {
      ok: false,
      stage: "applyOwnershipOrThrow",
      reason: err?.code || err?.message || String(err),
      error: String(err?.message || err),
    };
  }
  fs.writeFileSync(
    path.join(dest.dir, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
  return {
    ok: true,
    slug,
    categoryId,
    visibility,
    packageDir: dest.dir,
    metaPath: path.join(dest.dir, "metadata.json"),
    assetPath,
    downloadFilename: packageFile,
    creator_user_id: metadata.creator_user_id,
    metadata,
    listing,
  };
}

export function ingestRegisteredUserPackage(packageDir, categoryId) {
  const spec = CATEGORY_UPLOAD_SPEC[String(categoryId || "")];
  if (!spec) return { items: [], invalid: [{ reason: "unsupported_category" }] };
  if (spec.adapter === "sfx") {
    return ingestRegisteredSfxPackage(packageDir);
  }
  const metaPath = path.join(packageDir, "metadata.json");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (String(meta.visibility || "").toLowerCase() === "draft") {
    return { meta, items: [], invalid: [{ reason: "draft_not_ingested" }], draft: true };
  }
  const cfg = loadIngestConfig();
  const adapter = ADAPTERS[spec.adapter];
  const adapted = adapter(metaPath, meta, cfg);
  return {
    meta,
    items: (adapted.items || []).map((item) => toPublicItem(item)),
    invalid: adapted.invalid || [],
  };
}

export function readDraftPackage(userId, slug) {
  const dest = userPackageDir(userId, slug);
  if (!dest.ok) return dest;
  const metaPath = path.join(dest.dir, "metadata.json");
  if (!fs.existsSync(metaPath)) return { ok: false, reason: "draft_not_found" };
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return { ok: false, reason: "malformed_metadata" };
  }
  if (String(metadata.creator_user_id || "") !== String(userId)) {
    return { ok: false, reason: "cross_user_overwrite_denied" };
  }
  return {
    ok: true,
    slug: dest.slug,
    packageDir: dest.dir,
    metadata,
    visibility: metadata.visibility || "draft",
  };
}

export function listDraftPackages(userId) {
  const uid = String(userId || "").trim();
  const root = path.join(PACKAGES_DIR, uid);
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const metaPath = path.join(root, name, "metadata.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (String(meta.creator_user_id || "") !== uid) continue;
      if (String(meta.visibility || "draft").toLowerCase() === "public") continue;
      out.push({
        slug: String(meta.slug || name),
        title: String(meta.title || ""),
        categoryId: String(meta.type || ""),
        visibility: "draft",
      });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export function readSourceIndex() {
  return JSON.parse(fs.readFileSync(SOURCE_INDEX_JSON, "utf8"));
}

export function readServedIndex() {
  if (fs.existsSync(DIST_INDEX_JS)) {
    const txt = fs.readFileSync(DIST_INDEX_JS, "utf8");
    const marker = "global.TASFUL_MATERIALS_INDEX = ";
    const start = txt.indexOf(marker);
    if (start >= 0) {
      const slice = txt.slice(start + marker.length);
      const end = slice.indexOf(";\n})");
      if (end > 0) {
        try {
          return JSON.parse(slice.slice(0, end));
        } catch {
          /* fall through */
        }
      }
    }
  }
  return readSourceIndex();
}

export function mergeServedPublicItem(publicItem) {
  const source = readSourceIndex();
  const current = readServedIndex();
  const sourceIds = new Set((source.items || []).map((it) => it.id));
  const extras = (current.items || []).filter((it) => it && it.id && !sourceIds.has(it.id));
  const nextExtras = extras.filter((it) => it.id !== publicItem.id);
  nextExtras.push(publicItem);
  const served = {
    ...source,
    generatedAt: new Date().toISOString(),
    items: [...(source.items || []), ...nextExtras],
  };
  served.itemCount = served.items.length;
  fs.mkdirSync(path.dirname(DIST_INDEX_JS), { recursive: true });
  fs.writeFileSync(DIST_INDEX_JS, writeServedPublicIndexJs(served));
  return served;
}

export function removeServedPublicItem(itemId) {
  const source = readSourceIndex();
  const current = readServedIndex();
  const sourceIds = new Set((source.items || []).map((it) => it.id));
  const extras = (current.items || []).filter(
    (it) => it && it.id && !sourceIds.has(it.id) && it.id !== itemId,
  );
  const served = {
    ...source,
    generatedAt: new Date().toISOString(),
    items: [...(source.items || []), ...extras],
  };
  served.itemCount = served.items.length;
  fs.mkdirSync(path.dirname(DIST_INDEX_JS), { recursive: true });
  fs.writeFileSync(DIST_INDEX_JS, writeServedPublicIndexJs(served));
  return served;
}

export function restoreServedIndexFromSource() {
  const source = readSourceIndex();
  fs.mkdirSync(path.dirname(DIST_INDEX_JS), { recursive: true });
  fs.writeFileSync(DIST_INDEX_JS, writeServedPublicIndexJs(source));
  return source;
}

export function copyAssetToDistDownloads(publicItem, assetPath) {
  const url = String(publicItem.download_url || "");
  const m = url.match(/^\/materials\/generated\/downloads\/([^/]+)\/([^/]+)$/);
  if (!m || !assetPath || !fs.existsSync(assetPath)) return "";
  const dest = path.join(ROOT, "deploy", "cloudflare", "dist", "materials", "generated", "downloads", m[1], m[2]);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(assetPath, dest);
  return dest;
}

export function deleteUserPackage(userId, slug) {
  const dest = userPackageDir(userId, slug);
  if (!dest.ok) return dest;
  if (fs.existsSync(dest.dir)) fs.rmSync(dest.dir, { recursive: true, force: true });
  return { ok: true };
}

export function publicItemIsLeakedDraft(item) {
  if (!item || typeof item !== "object") return false;
  const vis = String(item.visibility || item.status || "").toLowerCase();
  return vis === "draft" || vis === "private" || item.publishable === false;
}
