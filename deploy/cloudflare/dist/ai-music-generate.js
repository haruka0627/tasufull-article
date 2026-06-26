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

  async function generate(opts) {
    const normalized = normalizeOpts(opts);
    const cfg = getConfig();
    if (!isConfigured()) {
      if (normalized.allowMock || cfg.mock === true) {
        return mockResult(normalized);
      }
      return { ok: false, unconfigured: true, message: UNCONFIGURED_MSG };
    }
    return mockResult(normalized);
  }

  global.TasuAiMusicGenerate = {
    DEFAULTS,
    UNCONFIGURED_MSG,
    isConfigured,
    generate,
    normalizeOpts,
  };
})(typeof window !== "undefined" ? window : globalThis);
