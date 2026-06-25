/**
 * Platform NB-1M — 共通 moderation ログ（AI秘書 / ops 向け）
 * target_type · target_id · actor_type · talk_user_id · flags · reason · severity
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_platform_moderation_logs_v1";
  const MAX_LOGS = 1000;

  const TARGET_TYPES = Object.freeze([
    "listing",
    "business_listing",
    "shop",
    "review",
    "chat",
    "inquiry",
    "profile",
    "attachment",
  ]);

  function readRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeRaw(list) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LOGS)));
    } catch {
      /* ignore */
    }
  }

  function resolveActor(context) {
    const Resolver = global.TasuPlatformActorResolver;
    if (Resolver?.resolvePlatformActor) {
      return Resolver.resolvePlatformActor(context);
    }
    const auth = global.TasuAuthCurrentUser || {};
    return {
      actor_type: auth.isOpsUser?.() ? "admin" : "client",
      talk_user_id: String(auth.getCurrentUserId?.() || context?.talk_user_id || ""),
      is_ops: Boolean(auth.isOpsUser?.()),
    };
  }

  function verdictToSeverity(verdict) {
    if (verdict === "block") return "critical";
    if (verdict === "needs_review") return "warning";
    return "info";
  }

  /**
   * @param {{
   *   target_type: string,
   *   target_id?: string,
   *   verdict?: string,
   *   flags?: string[],
   *   reason?: string,
   *   reasons?: string[],
   *   severity?: string,
   *   surface?: string,
   *   talk_user_id?: string,
   *   actor_type?: string,
   *   meta?: object
   * }} input
   */
  function recordModeration(input) {
    const payload = input && typeof input === "object" ? input : {};
    const actor = resolveActor(payload);
    const verdict = String(payload.verdict || "allow").trim();
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons
      : payload.reason
        ? [String(payload.reason)]
        : [];

    const entry = {
      id: `ml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      target_type: String(payload.target_type || payload.surface || "unknown").trim(),
      target_id: String(payload.target_id || "").trim() || null,
      actor_type: String(payload.actor_type || actor.actor_type || "guest").trim(),
      talk_user_id: String(payload.talk_user_id || actor.talk_user_id || "").trim() || null,
      verdict,
      flags: Array.isArray(payload.flags) ? [...payload.flags] : [],
      reason: reasons.slice(0, 5).join("、"),
      reasons,
      severity: String(payload.severity || verdictToSeverity(verdict)).trim(),
      surface: String(payload.surface || payload.target_type || "").trim() || null,
      meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
      created_at: new Date().toISOString(),
    };

    const list = readRaw();
    list.unshift(entry);
    writeRaw(list);

    try {
      global.dispatchEvent?.(
        new CustomEvent("tasu:moderation-log", { detail: entry })
      );
    } catch {
      /* ignore */
    }

    void persistSupabaseLog(entry);
    return entry;
  }

  async function persistSupabaseLog(entry) {
    const sb = global.TasuSupabase?.getClient?.();
    if (!sb?.from) return;
    try {
      await sb.from("platform_moderation_logs").insert({
        target_type: entry.target_type,
        target_id: entry.target_id,
        actor_type: entry.actor_type,
        talk_user_id: entry.talk_user_id,
        verdict: entry.verdict,
        flags: entry.flags,
        reason: entry.reason,
        severity: entry.severity,
        surface: entry.surface,
        meta: entry.meta,
        created_at: entry.created_at,
      });
    } catch {
      /* table may not exist until migration applied */
    }
  }

  function listRecent(limit) {
    const n = Math.min(Number(limit) || 50, MAX_LOGS);
    return readRaw().slice(0, n);
  }

  function countBySeverity(severity) {
    const s = String(severity || "").trim();
    return readRaw().filter((e) => e.severity === s).length;
  }

  global.TasuPlatformModerationLog = {
    STORAGE_KEY,
    TARGET_TYPES,
    recordModeration,
    listRecent,
    countBySeverity,
    verdictToSeverity,
  };
})(typeof window !== "undefined" ? window : globalThis);
