/**
 * Duplicate detection for existing-asset register (hash + id + normalized name).
 * No vector DB.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256File(filePath, maxBytes = 32 * 1024 * 1024) {
  const st = fs.statSync(filePath);
  if (st.size > maxBytes) {
    // Large file: hash size + first/last 1MB windows
    const fd = fs.openSync(filePath, "r");
    try {
      const head = Buffer.alloc(Math.min(1024 * 1024, st.size));
      fs.readSync(fd, head, 0, head.length, 0);
      const tailLen = Math.min(1024 * 1024, st.size);
      const tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, Math.max(0, st.size - tailLen));
      return crypto
        .createHash("sha256")
        .update(String(st.size))
        .update(head)
        .update(tail)
        .digest("hex");
    } finally {
      fs.closeSync(fd);
    }
  }
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function normalizeFilename(name) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_]+/g, "-");
}

export function buildDuplicateIndex(existingItems = []) {
  const byId = new Set();
  const byName = new Set();
  const byHash = new Set();
  for (const item of existingItems) {
    if (item?.id) byId.add(String(item.id));
    if (item?.slug && item?.variation != null) {
      byId.add(`${item.asset_type || item.category_id}:${item.slug}:${item.variation}`);
    }
    if (item?.download_filename) byName.add(normalizeFilename(item.download_filename));
    if (item?.file_hash) byHash.add(String(item.file_hash));
    if (item?.sha256) byHash.add(String(item.sha256));
  }
  return { byId, byName, byHash };
}

/**
 * @returns {{ duplicate: boolean, reason: string|null }}
 */
export function checkDuplicate(candidate, index) {
  const id = String(candidate.id || "");
  if (id && index.byId.has(id)) {
    return { duplicate: true, reason: "exact_asset_id" };
  }
  const name = normalizeFilename(candidate.filename || path.basename(candidate.file_path || ""));
  if (name && index.byName.has(name)) {
    return { duplicate: true, reason: "normalized_filename" };
  }
  if (candidate.sha256 && index.byHash.has(candidate.sha256)) {
    return { duplicate: true, reason: "exact_file_hash" };
  }
  return { duplicate: false, reason: null };
}
