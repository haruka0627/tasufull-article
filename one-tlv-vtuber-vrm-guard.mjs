/**
 * VRM upload / preset guard + license metadata extract (V1 — no legal auto-approve).
 */

export const VRM_MAX_BYTES = 50 * 1024 * 1024; // 50 MiB
export const PRESET_VRM_URL =
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@v3.5.3/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";
export const PRESET_VRM_LABEL = "TLV Preset · VRM1 Constraint Twist Sample (pixiv/three-vrm examples)";

/**
 * @param {File | Blob | null | undefined} file
 * @param {{ name?: string }} [hint]
 */
export function validateVrmUpload(file, hint = {}) {
  if (!file) return { ok: false, error: "no_file", code: "NO_FILE" };
  const name = String(hint.name || file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const size = Number(file.size) || 0;

  if (size <= 0) {
    return { ok: false, error: "empty_file", code: "EMPTY_FILE" };
  }
  if (size > VRM_MAX_BYTES) {
    return {
      ok: false,
      error: `file_too_large: ${size} > ${VRM_MAX_BYTES}`,
      code: "FILE_TOO_LARGE",
      maxBytes: VRM_MAX_BYTES,
      size,
    };
  }
  const extOk = name.endsWith(".vrm");
  const mimeOk =
    !type ||
    type === "application/octet-stream" ||
    type === "model/gltf-binary" ||
    type.includes("vrm") ||
    type.includes("gltf");
  if (!extOk) {
    return { ok: false, error: "UNSUPPORTED_VRM: expected .vrm file", code: "BAD_EXTENSION" };
  }
  if (!mimeOk) {
    return {
      ok: false,
      error: `UNSUPPORTED_VRM: unexpected MIME ${type}`,
      code: "BAD_MIME",
      mime: type,
    };
  }
  return { ok: true, name, size, mime: type || "application/octet-stream" };
}

/**
 * Extract display/audit metadata. Never auto-approves commercial use.
 * @param {object | null | undefined} vrm
 * @param {{ source?: string, sourceLabel?: string }} [ctx]
 */
export function extractVrmLicenseMeta(vrm, ctx = {}) {
  const meta = vrm?.meta || {};
  // VRM 1.0 meta vs 0.x field names
  const title =
    meta.name || meta.title || meta.modelName || null;
  const authors = meta.authors || (meta.author ? [meta.author] : null);
  const author =
    (Array.isArray(authors) && authors[0]) || meta.author || meta.contactInformation || null;
  const version = meta.metaVersion || meta.version || null;
  const copyright = meta.copyrightInformation || meta.copyright || null;
  const licenseUrl = meta.licenseUrl || meta.otherLicenseUrl || meta.otherPermissionUrl || null;
  const thirdParty = meta.thirdPartyLicenses || null;

  const commercial =
    meta.commercialUssageName ||
    meta.commercialUsage ||
    meta.allowCommercialUse ||
    null;
  const redistribution =
    meta.allowRedistribution != null
      ? meta.allowRedistribution
      : meta.licenseName || null;
  const modification =
    meta.modification ||
    meta.allowModification ||
    null;
  const avatarPermission =
    meta.avatarPermission || meta.allowedUserName || null;

  const fieldsPresent = [
    title,
    author,
    licenseUrl,
    commercial,
    redistribution,
    modification,
  ].filter((v) => v != null && String(v).trim() !== "").length;

  const incomplete = fieldsPresent < 3;
  const warnings = [];
  if (incomplete) {
    warnings.push("VRM_LICENSE_METADATA_INCOMPLETE");
  }
  if (commercial == null || String(commercial).trim() === "") {
    warnings.push("COMMERCIAL_USAGE_UNKNOWN");
  }
  // Never claim commercial OK — only surface raw values.
  warnings.push("NO_AUTO_COMMERCIAL_APPROVAL");

  const hasHumanoid = Boolean(vrm?.humanoid);
  if (!hasHumanoid) {
    warnings.push("MISSING_HUMANOID");
  }

  return {
    source: ctx.source || "unknown",
    sourceLabel: ctx.sourceLabel || null,
    title,
    author,
    authors: authors || (author ? [author] : []),
    version,
    copyright,
    licenseUrl,
    thirdPartyLicenses: thirdParty,
    commercialUsage: commercial != null ? String(commercial) : null,
    redistribution: redistribution != null ? String(redistribution) : null,
    modification: modification != null ? String(modification) : null,
    avatarPermission: avatarPermission != null ? String(avatarPermission) : null,
    hasHumanoid,
    hasExpression: Boolean(vrm?.expressionManager),
    hasLookAt: Boolean(vrm?.lookAt),
    hasSpringBone: Boolean(vrm?.springBoneManager || vrm?.springBone),
    metaVersion: version,
    incomplete,
    warnings,
    /** Explicit: UI must not treat as legal clearance */
    commercialApproved: false,
  };
}
