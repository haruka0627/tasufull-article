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

    // 将来: Edge / 外部 API 呼び出し（endpoint のみ使用 · secret はサーバー側）
    return mockResult(normalized);
  }

  global.TasuAiVideoGenerate = {
    DEFAULTS,
    UNCONFIGURED_MSG,
    isConfigured,
    generate,
    normalizeOpts,
  };
})(typeof window !== "undefined" ? window : globalThis);
