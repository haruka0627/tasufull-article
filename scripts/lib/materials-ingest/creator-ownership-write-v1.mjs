/**
 * Materials Creator ownership WRITE — optional metadata.creator_user_id.
 * Reuses resolveCanonicalCreatorUserId. Does not invent owners.
 * Client-supplied creator_user_id is never trusted alone.
 */
import {
  CANONICAL_OWNER_ID_FIELDS,
  resolveCanonicalCreatorUserId,
} from "./creator-ownership-v1.mjs";

export const WRITE_CONTRACT_VERSION = "materials_creator_ownership_write.v1";

export const OWNERSHIP_SOURCE = Object.freeze({
  USER: "user",
  CREATOR: "creator",
  PLATFORM: "platform",
  GENERATOR: "generator",
  SYSTEM: "system",
});

/** Existing TASFUL Account demo identity used by Creator Page / listing-seller-profile. */
export const CANONICAL_QA_USER_ID = "u_hiro";

const PLATFORM_SOURCES = new Set([
  OWNERSHIP_SOURCE.PLATFORM,
  OWNERSHIP_SOURCE.GENERATOR,
  OWNERSHIP_SOURCE.SYSTEM,
  "auto-supply",
  "autosupply",
]);

const USER_SOURCES = new Set([OWNERSHIP_SOURCE.USER, OWNERSHIP_SOURCE.CREATOR]);

export class CreatorOwnershipWriteError extends Error {
  constructor(result = {}) {
    super(result.reason || "creator_ownership_denied");
    this.name = "CreatorOwnershipWriteError";
    this.code = result.reason || "creator_ownership_denied";
    this.result = result;
  }
}

function firstClaimedOwnerId(source = {}) {
  if (!source || typeof source !== "object") return "";
  for (const field of CANONICAL_OWNER_ID_FIELDS) {
    const value = String(source[field] == null ? "" : source[field]).trim();
    if (value) return value;
  }
  return "";
}

export function stripOwnerFields(meta = {}) {
  const out = { ...(meta && typeof meta === "object" ? meta : {}) };
  for (const field of CANONICAL_OWNER_ID_FIELDS) {
    delete out[field];
  }
  delete out.__ownership;
  return out;
}

/**
 * Trusted write decision. Never writes generator / platform tokens.
 * @param {{
 *   source?: string,
 *   authenticatedUserId?: string,
 *   claimedUserId?: string,
 *   platformCreatorUserId?: string,
 * }} input
 */
export function resolveTrustedWriteCreatorUserId(input = {}) {
  const source = String(input.source || OWNERSHIP_SOURCE.PLATFORM).trim().toLowerCase();
  const claimed = String(input.claimedUserId == null ? "" : input.claimedUserId).trim();

  if (PLATFORM_SOURCES.has(source)) {
    const official = String(input.platformCreatorUserId == null ? "" : input.platformCreatorUserId).trim();
    if (!official) {
      return {
        ok: true,
        omit: true,
        reason: "platform_no_official_identity",
      };
    }
    const resolved = resolveCanonicalCreatorUserId({ creator_user_id: official });
    if (!resolved.ok) {
      return {
        ok: true,
        omit: true,
        reason: "platform_identity_not_canonical",
        detail: resolved.reason,
      };
    }
    if (claimed && claimed !== resolved.creator_user_id) {
      return { ok: false, reason: "client_spoof_denied", claimed, trusted: resolved.creator_user_id };
    }
    return {
      ok: true,
      omit: false,
      creator_user_id: resolved.creator_user_id,
      source_field: "platformCreatorUserId",
    };
  }

  if (!USER_SOURCES.has(source)) {
    return { ok: false, reason: "unknown_ownership_source", source };
  }

  const authenticated = String(input.authenticatedUserId == null ? "" : input.authenticatedUserId).trim();
  if (!authenticated) {
    return { ok: false, reason: "authenticated_user_required" };
  }
  const trusted = resolveCanonicalCreatorUserId({ creator_user_id: authenticated });
  if (!trusted.ok) {
    return { ok: false, reason: "authenticated_user_not_canonical", detail: trusted.reason };
  }
  if (claimed && claimed !== trusted.creator_user_id) {
    return {
      ok: false,
      reason: "client_spoof_denied",
      claimed,
      trusted: trusted.creator_user_id,
    };
  }
  return {
    ok: true,
    omit: false,
    creator_user_id: trusted.creator_user_id,
    source_field: "authenticatedUserId",
  };
}

/**
 * Apply optional creator_user_id. Fail-closed on spoof.
 * @returns {{ ok: true, metadata: object, omitted?: boolean, creator_user_id?: string } | { ok: false, reason: string, metadata: object }}
 */
export function applyCreatorOwnershipToMetadata(meta = {}, ctx = {}) {
  const cleaned = stripOwnerFields(meta);
  const decided = resolveTrustedWriteCreatorUserId({
    source: ctx.source,
    authenticatedUserId: ctx.authenticatedUserId,
    claimedUserId: ctx.claimedUserId || firstClaimedOwnerId(meta),
    platformCreatorUserId: ctx.platformCreatorUserId,
  });
  if (!decided.ok) {
    return { ...decided, metadata: cleaned };
  }
  if (decided.omit) {
    return { ok: true, omitted: true, reason: decided.reason, metadata: cleaned };
  }
  return {
    ok: true,
    omitted: false,
    creator_user_id: decided.creator_user_id,
    metadata: { ...cleaned, creator_user_id: decided.creator_user_id },
  };
}

/** Platform/generator writers: strip owner fields, never invent. */
export function applyPlatformGeneratorMetadata(meta = {}) {
  const applied = applyCreatorOwnershipToMetadata(meta, { source: OWNERSHIP_SOURCE.PLATFORM });
  return applied.metadata;
}

/**
 * Existing-register: keep a canonical owner already on disk evidence; never invent.
 */
export function preserveTrustedPackageCreatorUserId(meta = {}) {
  const resolved = resolveCanonicalCreatorUserId(meta);
  const cleaned = stripOwnerFields(meta);
  if (resolved.ok) {
    cleaned.creator_user_id = resolved.creator_user_id;
  }
  return cleaned;
}

export function extractOwnershipContext(extraMetadata = {}) {
  const extra = extraMetadata && typeof extraMetadata === "object" ? { ...extraMetadata } : {};
  const ownership = extra.__ownership && typeof extra.__ownership === "object" ? extra.__ownership : {};
  const claimedUserId = firstClaimedOwnerId(extra);
  delete extra.__ownership;
  for (const field of CANONICAL_OWNER_ID_FIELDS) {
    delete extra[field];
  }
  return {
    extra,
    ownership,
    claimedUserId,
    source: ownership.source || OWNERSHIP_SOURCE.PLATFORM,
    authenticatedUserId: ownership.authenticatedUserId,
    platformCreatorUserId: ownership.platformCreatorUserId,
  };
}

export function applyOwnershipOrThrow(meta, ctx) {
  const applied = applyCreatorOwnershipToMetadata(meta, ctx);
  if (!applied.ok) {
    throw new CreatorOwnershipWriteError(applied);
  }
  return applied.metadata;
}
