/**
 * Builder Calendar — builder_projects Realtime（CAL-MAIN-04）
 *
 * Supabase mode のときだけ購読し、変更時に hydrate + Calendar refresh。
 * Demo fallback 中は購読しない。二重登録禁止 · 離脱時 unsubscribe。
 */
(function (global) {
  "use strict";

  const VERSION = "cal-main-04";
  const CHANNEL_NAME = "builder-projects-calendar";
  const TABLE = "builder_projects";
  const DEBOUNCE_MS = 200;

  let channel = null;
  let started = false;
  let debounceTimer = 0;
  let refreshHandler = null;
  let pageHideBound = false;

  function getStore() {
    return global.TasuBuilderProjectStore;
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isSupabaseMode() {
    return getStore()?.getDataSourceMode?.() === "supabase";
  }

  function warn(msg, detail) {
    try {
      console.warn("[BuilderCalendarRealtime]", msg, detail || "");
    } catch {
      /* ignore */
    }
  }

  function clearDebounce() {
    if (debounceTimer) {
      global.clearTimeout(debounceTimer);
      debounceTimer = 0;
    }
  }

  async function applyRemoteChange() {
    const Store = getStore();
    const Cal = global.TasuBuilderProjectCalendar;
    if (!Store?.hydrateFromSupabase) return;

    try {
      const result = await Store.hydrateFromSupabase();
      if (result?.source !== "supabase") {
        // mode が落ちたら購読停止
        stopRealtime();
        if (typeof refreshHandler === "function") refreshHandler();
        else Cal?.refresh?.();
        return;
      }

      const selectedId = Cal?.getSelectedProject?.() || "";
      if (selectedId && !Store.getProject?.(selectedId)) {
        Cal?.clearSelection?.();
      }

      if (typeof refreshHandler === "function") refreshHandler();
      else Cal?.refresh?.();
    } catch (err) {
      warn("applyRemoteChange failed", err && err.message ? err.message : err);
    }
  }

  function scheduleApply(payload) {
    clearDebounce();
    debounceTimer = global.setTimeout(() => {
      debounceTimer = 0;
      void applyRemoteChange(payload);
    }, DEBOUNCE_MS);
  }

  function bindPageHide() {
    if (pageHideBound || typeof global.addEventListener !== "function") return;
    pageHideBound = true;
    const stop = () => {
      stopRealtime();
    };
    global.addEventListener("pagehide", stop);
    global.addEventListener("beforeunload", stop);
  }

  /**
   * @param {{ onRefresh?: function }} [options]
   * @returns {{ ok: boolean, reason?: string, already?: boolean }}
   */
  function startRealtime(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (typeof opts.onRefresh === "function") refreshHandler = opts.onRefresh;

    // Demo / fallback 中は購読しない（既存購読があれば解除）
    if (!isSupabaseMode()) {
      stopRealtime();
      return { ok: false, reason: "not_supabase_mode" };
    }

    if (started && channel) {
      return { ok: true, already: true, reason: "already_started" };
    }

    const sb = getClient();
    if (!sb || typeof sb.channel !== "function") {
      return { ok: false, reason: "no_client" };
    }

    try {
      // 既存チャンネルがあれば除去してから張り直す（二重登録防止）
      if (channel) {
        try {
          sb.removeChannel(channel);
        } catch {
          /* ignore */
        }
        channel = null;
      }

      channel = sb
        .channel(CHANNEL_NAME)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: TABLE },
          (payload) => scheduleApply(payload),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: TABLE },
          (payload) => scheduleApply(payload),
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: TABLE },
          (payload) => scheduleApply(payload),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            warn("subscription status", status);
          }
        });

      started = true;
      bindPageHide();
      return { ok: true, reason: "started" };
    } catch (err) {
      warn("startRealtime failed", err && err.message ? err.message : err);
      channel = null;
      started = false;
      return { ok: false, reason: "start_failed" };
    }
  }

  function stopRealtime() {
    clearDebounce();
    const sb = getClient();
    if (sb && channel) {
      try {
        sb.removeChannel(channel);
      } catch (err) {
        warn("unsubscribe failed", err && err.message ? err.message : err);
      }
    }
    channel = null;
    started = false;
    return { ok: true };
  }

  function isStarted() {
    return Boolean(started && channel);
  }

  /** テスト用: 購読ハンドラを直接叩く */
  function __testEmitChange(payload) {
    scheduleApply(payload || { eventType: "UPDATE" });
  }

  global.TasuBuilderProjectCalendarRealtime = {
    VERSION,
    CHANNEL_NAME,
    TABLE,
    startRealtime,
    stopRealtime,
    isStarted,
    applyRemoteChange,
    __testEmitChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
