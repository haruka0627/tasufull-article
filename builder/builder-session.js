/**
 * Builder B3 — session / auth uid helpers (P0-01)
 */
(function (global) {
  "use strict";

  const AUTH_LS_KEY = "tasu-supabase-auth";
  const STAGING_E2E_UID = "bf2125bf-47b2-4ec2-9ba4-f12ebc57cb40";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readSupabaseSessionUserId() {
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem(AUTH_LS_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return pickStr(parsed?.user?.id, parsed?.session?.user?.id);
    } catch {
      return "";
    }
  }

  function getAuthUserId() {
    const fromSession = readSupabaseSessionUserId();
    if (fromSession) return fromSession;
    const identity = global.TasuBuilderActorIdentity?.getCurrentUserId?.();
    if (identity) return pickStr(identity);
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const cfgUid = pickStr(cfg.currentUserId, cfg.me?.id);
    if (cfgUid) return cfgUid;
    if (global.TasuBuilderConfig?.getStorageMode?.() === "local") {
      return pickStr(global.TASU_BUILDER_DEMO_AUTH_UID, STAGING_E2E_UID);
    }
    return "";
  }

  function getApplicantAuthUid(fallbackPartnerKey) {
    const uid = getAuthUserId();
    if (uid) return uid;
    if (fallbackPartnerKey) return `demo-applicant:${pickStr(fallbackPartnerKey)}`;
    return "demo-applicant:anonymous";
  }

  function resolveOwnerIdForInsert(explicitOwnerId) {
    return pickStr(explicitOwnerId, getAuthUserId(), "demo-owner-001");
  }

  global.TasuBuilderSession = {
    AUTH_LS_KEY,
    STAGING_E2E_UID,
    getAuthUserId,
    getApplicantAuthUid,
    resolveOwnerIdForInsert,
    readSupabaseSessionUserId,
  };
})(typeof window !== "undefined" ? window : globalThis);
