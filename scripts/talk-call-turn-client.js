(function (global) {
  "use strict";

  const ENDPOINT = "/api/talk-voice-turn-credentials";
  let cached = null;
  let boundSessionId = null;

  function config() {
    const value = global.TASU_TALK_CALL_CONFIG;
    return value && typeof value === "object" ? value : {};
  }

  function truthy(value) {
    return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || ""));
  }

  function isEnabled() {
    return truthy(config().selfHostedTurnEnabled);
  }

  function validIceServers(servers) {
    if (!Array.isArray(servers) || servers.length < 2) return false;
    return servers.every((server) => {
      const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
      return urls.every((url) => /^(stun|turn|turns):[a-z0-9.-]+(?::\d+)?(?:\?.*)?$/i.test(String(url || "")));
    });
  }

  function getIceServers(sessionId) {
    const want = sessionId != null ? String(sessionId) : boundSessionId;
    if (!want || !cached || String(cached.sessionId) !== want) return [];
    if (Date.parse(cached.expiresAt) - Date.now() < 30_000) return [];
    return cached.iceServers.map((item) => ({ ...item }));
  }

  async function getAccessToken() {
    const sb = global.TasuSupabase?.getClient?.();
    const session = (await sb?.auth?.getSession?.())?.data?.session;
    return String(session?.access_token || "").trim();
  }

  async function ensureForSession(sessionId) {
    if (!isEnabled()) return { ok: true, enabled: false, iceServers: [] };
    const sid = String(sessionId || "");
    if (!sid) {
      clear();
      return { ok: false, error: "invalid_session" };
    }
    if (
      cached?.sessionId === sid &&
      Date.parse(cached.expiresAt) - Date.now() >= 30_000
    ) {
      boundSessionId = sid;
      return { ok: true, enabled: true, iceServers: getIceServers(sid), expiresAt: cached.expiresAt };
    }
    const token = await getAccessToken();
    if (!token) {
      clear();
      return { ok: false, error: "auth_required" };
    }
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: sid }),
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      clear();
      return { ok: false, error: "voice_relay_unavailable" };
    }
    let body = {};
    try {
      body = await response.json();
    } catch {
      clear();
      return { ok: false, error: "voice_relay_unavailable" };
    }
    if (!response.ok || !body?.ok || !validIceServers(body.iceServers)) {
      clear();
      return {
        ok: false,
        error:
          body?.error === "session_forbidden" || body?.error === "thread_forbidden"
            ? "voice_connection_unavailable"
            : "voice_relay_unavailable",
      };
    }
    cached = {
      sessionId: String(body.sessionId || sid),
      iceServers: body.iceServers.map((item) => ({ ...item })),
      expiresAt: String(body.expiresAt),
    };
    boundSessionId = sid;
    return { ok: true, enabled: true, iceServers: getIceServers(sid), expiresAt: cached.expiresAt };
  }

  function clear() {
    cached = null;
    boundSessionId = null;
  }

  global.TasuTalkCallTurnClient = {
    isEnabled,
    ensureForSession,
    getIceServers,
    clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
