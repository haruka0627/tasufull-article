/**
 * TASFUL AI — 動画生成 API ラッパー（Gateway / AI Core 非依存）
 */
(function (global) {
  "use strict";

  const DEFAULTS = Object.freeze({
    size: "1280x720",
    durationSec: 8,
    quality: "standard",
    style: "cinematic",
  });

  const UNCONFIGURED_MSG = "動画生成APIが未設定です";

  function getConfig() {
    return global.TasuAiMediaGenConfig?.video || { enabled: false, mock: true };
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
      prompt: String(o.prompt || "").trim(),
      size: String(o.size || DEFAULTS.size).trim(),
      durationSec: Number(o.durationSec ?? o.duration ?? DEFAULTS.durationSec) || DEFAULTS.durationSec,
      quality: String(o.quality || DEFAULTS.quality).trim(),
      style: String(o.style || DEFAULTS.style).trim(),
      allowMock: o.allowMock === true,
    };
  }

  function mockResult(opts) {
    const id = `mock-video-${Date.now()}`;
    return {
      ok: true,
      mock: true,
      id,
      message: "【モック】動画生成プレビュー（API接続前）",
      previewUrl: "",
      markdown:
        `# 動画生成（モック）\n\n` +
        `- プロンプト: ${opts.prompt || "—"}\n` +
        `- サイズ: ${opts.size}\n` +
        `- 時間: ${opts.durationSec}秒\n` +
        `- 品質: ${opts.quality}\n` +
        `- スタイル: ${opts.style}\n\n` +
        `> 本番 API 接続後に動画 URL が返ります。`,
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
          message: String(data?.message || data?.error || "動画生成に失敗しました"),
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
        message: aborted ? "動画生成がタイムアウトしました。" : "動画生成 API に接続できませんでした。",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param {object} [opts]
   * @returns {Promise<object>}
   */
  async function generate(opts) {
    const normalized = normalizeOpts(opts);
    if (!normalized.prompt) {
      return { ok: false, error: "empty_prompt", message: "プロンプトを入力してください。" };
    }

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
        size: normalized.size,
        durationSec: normalized.durationSec,
        quality: normalized.quality,
        style: normalized.style,
      },
      Math.max(5000, Number(cfg.timeoutMs) || 90000),
    );

    if (edge.ok && edge.data?.ok) {
      return {
        ok: true,
        mock: false,
        mode: edge.data.mode || "edge",
        id: edge.data.id,
        message: edge.data.message || "動画制作プランを生成しました",
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
      message: edge.message || "動画生成に失敗しました",
      quotaExceeded: edge.quotaExceeded === true,
    };
  }

  global.TasuAiVideoGenerate = {
    DEFAULTS,
    UNCONFIGURED_MSG,
    isConfigured,
    generate,
    normalizeOpts,
  };
})(typeof window !== "undefined" ? window : globalThis);
