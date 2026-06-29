/**
 * TASFUL AI — 音楽生成 API ラッパー（Gateway / AI Core 非依存）
 */
(function (global) {
  "use strict";

  const DEFAULTS = Object.freeze({
    genre: "ambient",
    bpm: 90,
    mood: "calm",
    lengthSec: 30,
    vocal: false,
    lyrics: false,
  });

  const UNCONFIGURED_MSG = "音楽生成APIが未設定です";

  function getConfig() {
    return global.TasuAiMediaGenConfig?.music || { enabled: false, mock: true };
  }

  function isConfigured() {
    const cfg = getConfig();
    return cfg.enabled === true && Boolean(String(cfg.endpoint || "").trim());
  }

  function getSupabaseConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
  }

  function resolveUserId() {
    const cfg = getSupabaseConfig();
    return String(cfg.currentUserId || cfg.userId || cfg.user_id || "anonymous").trim() || "anonymous";
  }

  function normalizeOpts(opts) {
    const o = opts || {};
    return {
      prompt: String(o.prompt || o.description || "").trim(),
      genre: String(o.genre || DEFAULTS.genre).trim(),
      bpm: Number(o.bpm ?? DEFAULTS.bpm) || DEFAULTS.bpm,
      mood: String(o.mood || o.atmosphere || DEFAULTS.mood).trim(),
      lengthSec: Number(o.lengthSec ?? o.length ?? DEFAULTS.lengthSec) || DEFAULTS.lengthSec,
      vocal: Boolean(o.vocal ?? o.withVocal),
      lyrics: Boolean(o.lyrics ?? o.withLyrics),
      allowMock: o.allowMock === true,
    };
  }

  function mockResult(opts) {
    const id = `mock-music-${Date.now()}`;
    const vocalLine = opts.vocal ? (opts.lyrics ? "ボーカル + 歌詞" : "インスト + ボーカル") : "インスト";
    return {
      ok: true,
      mock: true,
      id,
      message: "【モック】音楽生成プレビュー（API接続前）",
      previewUrl: "",
      markdown:
        `# 音楽生成（モック）\n\n` +
        `- ジャンル: ${opts.genre}\n` +
        `- BPM: ${opts.bpm}\n` +
        `- 雰囲気: ${opts.mood}\n` +
        `- 長さ: ${opts.lengthSec}秒\n` +
        `- ボーカル: ${vocalLine}\n` +
        (opts.prompt ? `- 補足: ${opts.prompt}\n` : "") +
        `\n> 本番 API 接続後に音声 URL が返ります。`,
      params: opts,
    };
  }

  async function postEdge(endpoint, body, timeoutMs) {
    const cfg = getSupabaseConfig();
    const base = String(cfg.url || "").replace(/\/$/, "");
    const anonKey = String(cfg.anonKey || "").trim();
    if (!base || !anonKey) {
      return { ok: false, error: "supabase_not_configured", message: UNCONFIGURED_MSG };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          surface: "ai-workspace",
          user_id: resolveUserId(),
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data?.error === "quota_exceeded") {
        return {
          ok: false,
          quotaExceeded: true,
          error: "quota_exceeded",
          message: "本日の利用上限に達しました。プランをご確認ください。",
          data,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: String(data?.error || res.status),
          message: String(data?.message || data?.error || "音楽生成に失敗しました"),
          httpStatus: res.status,
          data,
        };
      }
      return { ok: true, data };
    } catch (err) {
      const aborted = err && err.name === "AbortError";
      return {
        ok: false,
        error: aborted ? "request_timeout" : String(err?.message || err),
        message: aborted ? "音楽生成がタイムアウトしました。" : "音楽生成 API に接続できませんでした。",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function generate(opts) {
    const normalized = normalizeOpts(opts);
    const cfg = getConfig();
    if (!isConfigured()) {
      if (normalized.allowMock || cfg.mock === true) {
        return mockResult(normalized);
      }
      return { ok: false, unconfigured: true, message: UNCONFIGURED_MSG };
    }

    const edge = await postEdge(
      String(cfg.endpoint).trim(),
      {
        prompt: normalized.prompt,
        genre: normalized.genre,
        bpm: normalized.bpm,
        mood: normalized.mood,
        lengthSec: normalized.lengthSec,
        vocal: normalized.vocal,
        lyrics: normalized.lyrics,
      },
      Math.max(5000, Number(cfg.timeoutMs) || 90000),
    );

    if (edge.ok && edge.data?.ok) {
      return {
        ok: true,
        mock: false,
        mode: edge.data.mode || "edge",
        id: edge.data.id,
        message: edge.data.message || "音楽制作プランを生成しました",
        previewUrl: edge.data.previewUrl || "",
        markdown: edge.data.markdown || "",
        params: edge.data.params || normalized,
        quota: edge.data.quota,
      };
    }

    if (normalized.allowMock || cfg.mock === true) {
      return mockResult(normalized);
    }

    return {
      ok: false,
      error: edge.error || "edge_failed",
      message: edge.message || "音楽生成に失敗しました",
      quotaExceeded: edge.quotaExceeded === true,
    };
  }

  global.TasuAiMusicGenerate = {
    DEFAULTS,
    UNCONFIGURED_MSG,
    isConfigured,
    generate,
    normalizeOpts,
  };
})(typeof window !== "undefined" ? window : globalThis);
