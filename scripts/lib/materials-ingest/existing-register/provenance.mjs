/**
 * Provenance classifier for Image/Icon existing assets.
 * Never invents ownership. UNKNOWN → HOLD.
 */
import path from "node:path";
import {
  PROVENANCE,
  CONFIRMED_PROVIDERS,
} from "./ssot.mjs";

/**
 * @param {object} input
 * @returns {{ level: string, reasons: string[], auto_register: boolean }}
 */
export function classifyProvenance(input = {}) {
  const reasons = [];
  const meta = input.meta && typeof input.meta === "object" ? input.meta : null;
  const provider = String(
    meta?.provider || meta?.source_generator || input.source_generator || "",
  ).trim();
  const hasMeta = Boolean(meta) && !meta.__error;
  const slug = String(meta?.slug || input.slug || "").trim();
  const status = String(meta?.status || "").toLowerCase();
  const type = String(meta?.type || input.asset_type || "").toLowerCase();
  const packageLayout = Boolean(input.package_dir && hasMeta && slug);
  const knownGenerator =
    CONFIRMED_PROVIDERS.some((p) => provider.toLowerCase().includes(p.toLowerCase())) ||
    provider === "ComfyUI-AutoGenerator";

  if (hasMeta && knownGenerator && slug && ["image", "icon", "illustration", "background"].includes(type || input.asset_type)) {
    reasons.push("metadata_provider_confirmed", "slug_present");
    if (["generated", "ready", "published", "approved", ""].includes(status) || !status) {
      return {
        level: PROVENANCE.CONFIRMED,
        reasons,
        auto_register: true,
      };
    }
  }

  if (hasMeta && slug && packageLayout) {
    const files = Array.isArray(meta.files) ? meta.files : [];
    if (files.length > 0 || input.has_variation_files) {
      reasons.push("formal_package_metadata", "slug_present");
      return {
        level: PROVENANCE.INFERABLE,
        reasons,
        auto_register: true,
        note: "package metadata without explicit provider — allow if variation files match",
      };
    }
  }

  // Directory looks like formal Materials package path but no metadata
  const rel = String(input.relative_path || input.file_path || "").replace(/\\/g, "/");
  const base = path.basename(rel);
  const parent = path.basename(path.dirname(rel));
  const looksPackaged =
    /-(0\d{2}|[0-9]{3})\.(png|jpe?g|webp|gif|svg)$/i.test(base) &&
    parent &&
    parent !== "画像素材" &&
    parent !== "アイコン";

  if (looksPackaged && !hasMeta) {
    reasons.push("filename_variation_pattern_without_metadata");
    return {
      level: PROVENANCE.INFERABLE,
      reasons,
      auto_register: true,
      note: "latin variation filename + Drive path classify without metadata.json",
    };
  }

  const latinSlug = String(input.slug || "").trim();
  if (
    !hasMeta &&
    input.has_variation_files &&
    /^[a-z0-9][a-z0-9-]{1,80}$/i.test(latinSlug) &&
    (input.relative_path || input.package_dir)
  ) {
    reasons.push("latin_slug_from_filename", "drive_path_classified");
    return {
      level: PROVENANCE.INFERABLE,
      reasons,
      auto_register: true,
      note: "classified from existing Drive path + latin filename prefix",
    };
  }

  reasons.push("no_generator_evidence", "no_formal_metadata");
  return {
    level: PROVENANCE.UNKNOWN,
    reasons,
    auto_register: false,
  };
}
