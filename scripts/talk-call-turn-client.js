(function (global) {
  "use strict";

  const ENDPOINT = "/api/talk-voice-turn-credentials";
  let cached = null;

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

  function getIceServers() {
    if (!cached || Date.parse(cached.expiresAt) - Date.now() < 30_000) return [];
    return cached.iceServers.map((item) => ({ ...item }));
  }

  async function getAccessToken() {
    const sb = global.TasuSupabase?.getClient?.();
    const session = (await sb?.auth?.getSession?.())?.data?.session;
    return String(session?.access_token || "").trim();
  }

  async function ensureForSession(sessionId) {
    if (!isEnabled()) return { ok: true, enabled: false, iceServers: [] };
    if (
      cached?.sessionId === String(sessionId) &&
      Date.parse(cached.expiresAt) - Date.now() >= 30_000
    ) {
      return { ok: true, enabled: true, iceServers: getIceServers(), expiresAt: cached.expiresAt };
    }
    const token = await getAccessToken();
    if (!token) return { ok: false, error: "auth_required" };
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: String(sessionId || "") }),
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      return { ok: false, error: "voice_relay_unavailable" };
    }
    let body = {};
    try {
      body = await response.json();
    } catch {
      return { ok: false, error: "voice_relay_unavailable" };
    }
    if (!response.ok || !body?.ok || !validIceServers(body.iceServers)) {
      return {
        ok: false,
        error:
          body?.error === "session_forbidden" || body?.error === "thread_forbidden"
            ? "voice_connection_unavailable"
            : "voice_relay_unavailable",
      };
    }
    cached = {
      sessionId: String(body.sessionId),
      iceServers: body.iceServers.map((item) => ({ ...item })),
      expiresAt: String(body.expiresAt),
    };
    return { ok: true, enabled: true, iceServers: getIceServers(), expiresAt: cached.expiresAt };
  }

  function clear() {
    cached = null;
  }

  global.TasuTalkCallTurnClient = {
    isEnabled,
    ensureForSession,
    getIceServers,
    clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
