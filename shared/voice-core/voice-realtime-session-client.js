/**
 * Voice Core — OpenAI Realtime session client (Edge fetch · runtime injectors · auto refresh)
 * Phase 5-C-2: no Product UI wiring · injectors only via TasuVoiceCore.setRuntimeInjectors
 */
(function (global) {
  "use strict";

  const EDGE_NAME = "openai-realtime-session";
  const DEFAULT_SURFACE = "tasful_ai";
  const REFRESH_LEAD_MS = 30_000;
  const DEFAULT_TIMEOUT_MS = 12_000;
  const SK_PATTERN = /^sk-/i;

  /** @type {object|null} */
  let currentSession = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let refreshTimer = null;
  /** @type {Promise<object>|null} */
  let refreshInFlight = null;

  function trimText(value, maxLen) {
    return String(value ?? "").trim().slice(0, maxLen);
  }

  function getSupabaseEndpoint(edgeName) {
    const raw = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const base = trimText(raw.url || raw.SUPABASE_URL, 512).replace(/\/$/, "");
    const resolveKey =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallback(config) {
        const k = trimText(config?.anonKey || config?.anon_key, 4096);
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/${edgeName}` : "",
      anonKey,
    };
  }

  function parseExpiresAtMs(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1e12 ? value : value * 1000;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function maskCredentialValue(value) {
    const v = trimText(value, 4096);
    if (!v) return "";
    if (v.length <= 10) return "[set]";
    return `${v.slice(0, 6)}…${v.slice(-4)}`;
  }

  function assertSafeCredential(credential) {
    const value = trimText(credential?.value, 4096);
    if (!value) return null;
    if (SK_PATTERN.test(value) || /^sb_secret_/i.test(value)) {
      return null;
    }
    return {
      type: trimText(credential.type, 64) || "ephemeral_token",
      value,
      expiresAt: credential.expiresAt,
    };
  }

  function normalizeSessionPayload(data, surface) {
    const cred = assertSafeCredential(data?.credential);
    if (!cred) return null;
    return {
      surface: trimText(data?.surface || surface, 64) || surface,
      endpoint: trimText(data?.endpoint, 512),
      model: trimText(data?.model, 128),
      credential: cred,
      fetchedAt: Date.now(),
    };
  }

  function setRuntimeInjectors(injectors) {
    if (global.TasuVoiceCore?.setRuntimeInjectors) {
      global.TasuVoiceCore.setRuntimeInjectors(injectors);
      return;
    }
    if (global.TasuVoiceCoreRealtimeConnectPolicy?.setRuntimeInjectors) {
      global.TasuVoiceCoreRealtimeConnectPolicy.setRuntimeInjectors(injectors);
    }
  }

  function shouldRefreshSoon(session, nowMs) {
    const expiresMs = parseExpiresAtMs(session?.credential?.expiresAt);
    if (!expiresMs) return false;
    return expiresMs - (nowMs || Date.now()) <= REFRESH_LEAD_MS;
  }

  function buildInjectors(session) {
    const surface = session?.surface || DEFAULT_SURFACE;
    return {
      isLiveEnabled: () => true,
      useWebSocketTransport: true,
      getEndpoint() {
        const live = currentSession || session;
        return live?.endpoint ? String(live.endpoint) : null;
      },
      getModel() {
        const live = currentSession || session;
        return live?.model ? String(live.model) : "";
      },
      async getSessionCredential() {
        let live = currentSession || session;
        if (shouldRefreshSoon(live)) {
          await refresh({ surface: live?.surface || surface });
          live = currentSession || session;
        }
        const cred = assertSafeCredential(live?.credential);
        if (!cred) return null;
        const expiresMs = parseExpiresAtMs(cred.expiresAt);
        return {
          type: cred.type,
          value: cred.value,
          expiresAt: expiresMs || undefined,
        };
      },
      getSessionOptions() {
        return {};
      },
    };
  }

  function applyInjectors(session) {
    setRuntimeInjectors(buildInjectors(session));
  }

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function scheduleRefresh(session) {
    clearRefreshTimer();
    const expiresMs = parseExpiresAtMs(session?.credential?.expiresAt);
    if (!expiresMs) return;

    const delay = Math.max(0, expiresMs - Date.now() - REFRESH_LEAD_MS);
    refreshTimer = setTimeout(() => {
      refresh({ surface: session?.surface || DEFAULT_SURFACE }).catch(() => {
        /* auto refresh failure is non-fatal; caller may retry on next credential read */
      });
    }, delay);
  }

  /**
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async function fetchSession(options) {
    options = options || {};
    const { url, anonKey } = getSupabaseEndpoint(EDGE_NAME);
    if (!url || !anonKey) {
      return { ok: false, error: "supabase_not_configured", httpStatus: 0 };
    }

    const surface = trimText(options.surface || DEFAULT_SURFACE, 64) || DEFAULT_SURFACE;
    const body = { surface };
    const model = trimText(options.model, 128);
    if (model) body.model = model;

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const timer =
      controller &&
      setTimeout(() => {
        controller.abort();
      }, timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (timer) clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          error: trimText(data?.error || `edge_${res.status}`, 500) || "edge_error",
          httpStatus: res.status,
          data,
        };
      }

      const session = normalizeSessionPayload(data, surface);
      if (!session?.endpoint || !session.credential?.value) {
        return {
          ok: false,
          error: "invalid_session_response",
          httpStatus: res.status,
          data,
        };
      }

      return { ok: true, session, httpStatus: res.status };
    } catch (err) {
      if (timer) clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: message || "fetch_failed",
        httpStatus: 0,
      };
    }
  }

  /**
   * Fetch Edge session and register runtime injectors.
   * @param {object} [options]
   */
  async function refresh(options) {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const result = await fetchSession(options);
      if (!result.ok) {
        return result;
      }

      currentSession = result.session;
      applyInjectors(currentSession);
      scheduleRefresh(currentSession);

      return {
        ok: true,
        session: getCurrentSession(),
        injectorsRegistered: Boolean(global.TasuVoiceCoreRealtimeConnectPolicy?.getRuntimeInjectors?.()),
        httpStatus: result.httpStatus,
      };
    })();

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  }

  function clear() {
    clearRefreshTimer();
    currentSession = null;
    setRuntimeInjectors(null);
    return { ok: true };
  }

  function getCurrentSession() {
    if (!currentSession) return null;

    const cred = currentSession.credential;
    const expiresAtMs = parseExpiresAtMs(cred?.expiresAt);
    const msUntilExpiry = expiresAtMs ? Math.max(0, expiresAtMs - Date.now()) : null;
    const msUntilAutoRefresh =
      expiresAtMs != null ? Math.max(0, expiresAtMs - Date.now() - REFRESH_LEAD_MS) : null;

    return {
      surface: currentSession.surface,
      endpoint: currentSession.endpoint,
      model: currentSession.model,
      credential: cred
        ? {
            type: cred.type,
            valueMasked: maskCredentialValue(cred.value),
            hasValue: Boolean(cred.value),
            expiresAt: cred.expiresAt,
          }
        : null,
      fetchedAt: currentSession.fetchedAt,
      expiresAtMs,
      msUntilExpiry,
      msUntilAutoRefresh,
      autoRefreshLeadMs: REFRESH_LEAD_MS,
      refreshTimerActive: Boolean(refreshTimer),
    };
  }

  function getInjectorsStatus() {
    const Policy = global.TasuVoiceCoreRealtimeConnectPolicy;
    const injectors = Policy?.getRuntimeInjectors?.() || null;
    const Config = global.TasuVoiceCore?.createRealtimeConfig;
    const config = Config ? Config() : null;

    return {
      registered: Boolean(injectors),
      liveEnabled: Policy?.isLiveConnectionEnabled?.() === true,
      useWebSocketTransport: injectors?.useWebSocketTransport === true,
      endpoint: config?.getEndpoint?.() || null,
      model: config?.getModel?.() || "",
      hasSession: Boolean(currentSession),
    };
  }

  function getPolicySnapshot(options) {
    options = options || {};
    const Core = global.TasuVoiceCore;
    if (!Core?.resolveConnectPolicy) {
      return { mode: "unknown", reason: "voice_core_missing" };
    }
    const mockCompatible = options.mockCompatible !== false;
    return Core.resolveConnectPolicy({ mockCompatible });
  }

  global.TasuVoiceRealtimeSessionClient = {
    EDGE_NAME,
    REFRESH_LEAD_MS,
    DEFAULT_SURFACE,
    getSupabaseEndpoint,
    parseExpiresAtMs,
    fetchSession,
    refresh,
    clear,
    getCurrentSession,
    getInjectorsStatus,
    getPolicySnapshot,
    shouldRefreshSoon,
  };
})(typeof window !== "undefined" ? window : globalThis);
