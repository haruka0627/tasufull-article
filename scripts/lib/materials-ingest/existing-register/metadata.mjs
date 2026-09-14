/**
 * Metadata normalize/generate from evidence only — no paid AI, no invention.
 */
import path from "node:path";
import { uniqueTags } from "../common.mjs";
import { resolveJapaneseDisplayTitle } from "../japanese-display-title.mjs";
import { preserveTrustedPackageCreatorUserId } from "../creator-ownership-write-v1.mjs";

const SKIP = new Set(["metadata.json", "prompt.txt", "readme.md", "package.json"]);

/**
 * Build metadata object from package evidence. Returns null if insufficient.
 */
export function buildMetadataFromEvidence(input = {}) {
  const assetType = String(input.asset_type || "").toLowerCase();
  if (!["image", "icon", "illustration", "background"].includes(assetType)) return null;

  const existing = input.meta && !input.meta.__error ? { ...input.meta } : null;
  if (existing?.slug && existing?.type) {
    return {
      ok: true,
      source: "EXISTING_METADATA",
      meta: preserveTrustedPackageCreatorUserId({
        ...existing,
        type: existing.type || assetType,
        provenance: input.provenance_level || null,
        register_version: "existing-register-v1",
      }),
    };
  }

  const dir = String(input.package_dir || "");
  const slug = String(input.slug || path.basename(dir) || "").trim();
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,80}$/i.test(slug)) {
    return { ok: false, reason: "metadata_insufficient_slug", meta: null };
  }

  const files = (input.files || []).filter((f) => {
    const n = path.basename(f).toLowerCase();
    return !SKIP.has(n);
  });
  if (!files.length) {
    return { ok: false, reason: "metadata_insufficient_files", meta: null };
  }

  const promptPath = input.prompt_text ? String(input.prompt_text) : "";
  const categoryPath = String(input.category_path || "").replace(/\\/g, "/");
  const parts = categoryPath.split("/").filter(Boolean);
  // Expect .../{top}/{middle}/.../{slug}
  const subcategory = parts.length >= 2 ? parts[parts.length - 2] : "";
  const middle = parts.length >= 3 ? parts[parts.length - 3] : parts[0] || "";

  const tags = uniqueTags(
    [assetType, subcategory, middle, ...(input.known_tags || [])].filter(Boolean),
  );

  const meta = {
    version: 1,
    type: assetType,
    categoryPath: categoryPath || undefined,
    slug,
    prompt: promptPath || undefined,
    files: files.map((f) => path.basename(f)),
    imageCount: files.length,
    provider: input.provider || undefined,
    status: "ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title:
      input.title ||
      resolveJapaneseDisplayTitle({
        title: input.title,
        prompt: promptPath,
        categoryPath: categoryPath,
        category: middle,
        subcategory,
        tags,
        assetType,
        slug,
      }),
    subcategory: subcategory || undefined,
    tags,
    provenance: input.provenance_level || null,
    register_version: "existing-register-v1",
    metadata_evidence: "directory_filename_package_only",
  };

  // Do not invent dimensions/license/prompt when absent
  if (!meta.prompt) delete meta.prompt;
  if (!meta.provider) delete meta.provider;

  return { ok: true, source: "EVIDENCE_NORMALIZED", meta: preserveTrustedPackageCreatorUserId(meta) };
}
