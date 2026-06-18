/**
 * TASFUL TALK — WebRTC ICE / TURN 設定（Phase5 / 5.6 運用ハードニング）
 *
 * ブラウザ: window.TASU_TALK_CALL_CONFIG / TASFUL_TURN_* / localStorage demo 安全
 * Node テスト: process.env.TASFUL_TURN_*
 */
(function (global) {
  "use strict";

  const DEFAULT_STUN_URL = "stun:stun.l.google.com:19302";
  const DEBUG_STORAGE_KEY = "tasu_talk_call_debug";

  const ENV_URL_KEYS = ["TASFUL_TURN_URL", "VITE_TASFUL_TURN_URL"];
  const ENV_USER_KEYS = ["TASFUL_TURN_USERNAME", "VITE_TASFUL_TURN_USERNAME"];
  const ENV_CRED_KEYS = ["TASFUL_TURN_CREDENTIAL", "VITE_TASFUL_TURN_CREDENTIAL"];

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readProcessEnv() {
    try {
      if (typeof process !== "undefined" && process.env && typeof process.env === "object") {
        return process.env;
      }
    } catch {
      /* ignore */
    }
    return {};
  }

  function readTalkCallConfigObject() {
    const cfg = global.TASU_TALK_CALL_CONFIG;
    return cfg && typeof cfg === "object" ? cfg : {};
  }

  function firstEnvValue(keys, env) {
    for (let i = 0; i < keys.length; i += 1) {
      const v = pickStr(env[keys[i]]);
      if (v) return v;
    }
    return "";
  }

  function optionsTruthy(v) {
    return v === true || v === 1 || String(v || "").toLowerCase() === "true";
  }

  function isInternalDiagnosticsAllowed() {
    try {
      const env = readProcessEnv();
      if (env.NODE_ENV === "test") return true;
      if (env.TASFUL_TALK_CALL_INTERNAL_TEST === "1") return true;
    } catch {
      /* ignore */
    }
    const cfg = readTalkCallConfigObject();
    if (optionsTruthy(cfg.internalTest)) return true;
    try {
      const search = String(global.location?.search || "");
      if (/[?&]talkDev=1(?:&|$)/i.test(search)) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isTalkCallDebugAllowed() {
    const cfg = readTalkCallConfigObject();
    if (cfg.allowDebug === false) return false;
    return true;
  }

  function resolveTurnSettings(options) {
    const env = { ...readProcessEnv(), ...(options?.env || {}) };
    const cfg = { ...readTalkCallConfigObject(), ...(options?.talkCallConfig || {}) };

    const urlRaw = pickStr(
      options?.turnUrl,
      cfg.turnUrl,
      cfg.turn_url,
      cfg.TURN_URL,
      cfg.urls,
      global.TASFUL_TURN_URL,
      firstEnvValue(ENV_URL_KEYS, env)
    );
    const username = pickStr(
      options?.turnUsername,
      cfg.turnUsername,
      cfg.turn_username,
      cfg.TURN_USERNAME,
      global.TASFUL_TURN_USERNAME,
      firstEnvValue(ENV_USER_KEYS, env)
    );
    const credential = pickStr(
      options?.turnCredential,
      cfg.turnCredential,
      cfg.turn_credential,
      cfg.TURN_CREDENTIAL,
      global.TASFUL_TURN_CREDENTIAL,
      firstEnvValue(ENV_CRED_KEYS, env)
    );

    return { urlRaw, username, credential };
  }

  function parseTurnUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item || "").trim()).filter(Boolean);
    }
    return String(raw)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeTurnUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^(stun|turn|turns):/i.test(u)) return u;
    return `turn:${u}`;
  }

  function getTalkCallIceServers(options) {
    const { urlRaw, username, credential } = resolveTurnSettings(options);
    const servers = [{ urls: DEFAULT_STUN_URL }];
    const turnUrls = parseTurnUrls(urlRaw).map(normalizeTurnUrl).filter(Boolean);

    if (!turnUrls.length) {
      return servers;
    }

    if (!username || !credential) {
      console.warn(
        "[TasuTalkCallIce] TURN URL is set but username/credential are missing; TURN servers disabled (STUN only)."
      );
      return servers;
    }

    turnUrls.forEach((url) => {
      servers.push({ urls: url, username, credential });
    });
    return servers;
  }

  function buildTalkCallPeerConnectionConfig(options) {
    return {
      iceServers: getTalkCallIceServers(options),
    };
  }

  function isTalkCallDebugEnabled() {
    if (!isTalkCallDebugAllowed()) return false;
    if (optionsTruthy(readTalkCallConfigObject().debug)) return true;
    try {
      const search = String(global.location?.search || "");
      if (/[?&]talkCallDebug=1(?:&|$)/i.test(search)) return true;
    } catch {
      /* ignore */
    }
    try {
      if (global.localStorage?.getItem(DEBUG_STORAGE_KEY) === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function sanitizeDebugPayload(payload) {
    const safe = payload && typeof payload === "object" ? { ...payload } : {};
    delete safe.credential;
    delete safe.turnCredential;
    delete safe.password;
    delete safe.username;
    delete safe.turnUsername;
    if (safe.candidate && typeof safe.candidate === "object") {
      safe.candidate = {
        type: safe.candidate.type || safe.candidate.candidateType || "",
        protocol: safe.candidate.protocol || "",
        address: safe.candidate.address ? "[redacted]" : "",
      };
    }
    if (typeof safe.candidate === "string") {
      safe.candidate = safe.candidate.replace(/\d+\.\d+\.\d+\.\d+/g, "[ip]");
    }
    return safe;
  }

  function logIceDebug(event, payload) {
    if (!isTalkCallDebugEnabled()) return;
    console.debug("[TasuTalkCallIce]", event, sanitizeDebugPayload(payload));
  }

  function getConfigSummary(options) {
    const { urlRaw, username, credential } = resolveTurnSettings(options);
    const turnUrls = parseTurnUrls(urlRaw).map(normalizeTurnUrl).filter(Boolean);
    const turnEnabled = turnUrls.length > 0 && Boolean(username) && Boolean(credential);
    return {
      stun: DEFAULT_STUN_URL,
      turnConfigured: turnUrls.length > 0,
      turnEnabled,
      turnUrlCount: turnEnabled ? turnUrls.length : 0,
      debug: isTalkCallDebugEnabled(),
      allowDebug: readTalkCallConfigObject().allowDebug !== false,
    };
  }

  /** dev/test のみ — credential / username は含まない */
  function getIceConfig(options) {
    if (!isInternalDiagnosticsAllowed()) return null;
    const { urlRaw, username, credential } = resolveTurnSettings(options);
    const turnUrls = parseTurnUrls(urlRaw).map(normalizeTurnUrl).filter(Boolean);
    return {
      stun: DEFAULT_STUN_URL,
      turnUrls,
      turnUrlCount: turnUrls.length,
      hasUsername: Boolean(username),
      hasCredential: Boolean(credential),
      turnEnabled: turnUrls.length > 0 && Boolean(username) && Boolean(credential),
    };
  }

  function getTalkCallConnectionSummary() {
    if (!isTalkCallDebugEnabled()) return null;
    const webRtc = global.TasuTalkCallWebRtc;
    if (!webRtc?.getConnectionDiagnostics) return null;
    const diag = webRtc.getConnectionDiagnostics();
    const config = getConfigSummary();
    return {
      ...diag,
      turnEnabled: config.turnEnabled,
      debug: true,
    };
  }

  const publicApi = {
    DEFAULT_STUN_URL,
    getTalkCallIceServers,
    buildTalkCallPeerConnectionConfig,
    isTalkCallDebugEnabled,
    isTalkCallDebugAllowed,
    logIceDebug,
    getConfigSummary,
    getTalkCallConnectionSummary,
  };

  if (isInternalDiagnosticsAllowed()) {
    publicApi.getIceConfig = getIceConfig;
    publicApi._test = {
      parseTurnUrls,
      normalizeTurnUrl,
      resolveTurnSettings,
      isInternalDiagnosticsAllowed,
    };
  }

  global.TasuTalkCallIceConfig = publicApi;
})(typeof window !== "undefined" ? window : globalThis);
