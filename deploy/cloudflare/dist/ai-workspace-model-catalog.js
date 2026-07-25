/**
 * TASFUL AI Workspace — モデルカタログ（設定UI用 · 表示メタデータ）
 */
(function (global) {
  "use strict";

  /** @type {Record<string, object>} */
  const PROFILES = Object.freeze({
    auto: {
      id: "auto",
      name: "Auto（推奨）",
      isAuto: true,
      tagline: "用途に応じて自動選択",
      balance: 5,
    },
    "claude-sonnet": {
      id: "claude-sonnet",
      name: "Claude Sonnet",
      provider: "Anthropic",
      speed: 5,
      quality: 5,
      cost: 3,
      strengths: ["長文回答", "コード", "企画", "会話"],
    },
    "gpt-5": {
      id: "gpt-5",
      name: "GPT-5",
      provider: "OpenAI",
      speed: 4,
      quality: 5,
      cost: 4,
      strengths: ["推論", "分析", "資料作成"],
    },
    "gemini-2.5-pro": {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      provider: "Google",
      speed: 5,
      quality: 4,
      cost: 3,
      strengths: ["検索", "翻訳", "要約"],
    },
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      provider: "DeepSeek",
      speed: 4,
      quality: 4,
      cost: 5,
      strengths: ["コード", "低コスト"],
    },
    grok: {
      id: "grok",
      name: "Grok",
      provider: "xAI",
      speed: 5,
      quality: 4,
      strengths: ["リアルタイム", "SNS情報"],
    },
    mistral: {
      id: "mistral",
      name: "Mistral",
      provider: "Mistral AI",
      speed: 5,
      quality: 3,
      cost: 5,
      strengths: ["軽量処理"],
    },
    "gpt-image": {
      id: "gpt-image",
      name: "GPT Image",
      provider: "OpenAI",
      strengths: ["写真", "デザイン", "UI"],
    },
    imagen: {
      id: "imagen",
      name: "Imagen",
      provider: "Google",
      strengths: ["写真品質", "人物"],
    },
    flux: {
      id: "flux",
      name: "Flux",
      provider: "Black Forest Labs",
      strengths: ["イラスト", "ロゴ"],
    },
    "stable-diffusion": {
      id: "stable-diffusion",
      name: "Stable Diffusion",
      strengths: ["ローカル利用", "カスタマイズ"],
    },
    runway: {
      id: "runway",
      name: "Runway",
      highlight: "映画品質",
    },
    veo: {
      id: "veo",
      name: "Veo",
      provider: "Google",
      highlight: "リアル映像",
    },
    pika: {
      id: "pika",
      name: "Pika",
      highlight: "SNS動画",
    },
    "gemini-search": {
      id: "gemini-search",
      name: "Gemini Search",
      provider: "Google",
      strengths: ["検索", "要約"],
    },
    "brave-search": {
      id: "brave-search",
      name: "Brave Search",
      provider: "Brave",
      strengths: ["プライバシー", "Web検索"],
    },
    "google-search": {
      id: "google-search",
      name: "Google Search",
      provider: "Google",
      strengths: ["検索精度", "情報収集"],
    },
    gemini: {
      id: "gemini",
      name: "Gemini",
      provider: "Google",
      speed: 5,
      quality: 4,
      cost: 3,
      strengths: ["翻訳", "要約", "多言語"],
    },
  });

  const USE_CASE_MODEL_IDS = Object.freeze({
    chat: ["auto", "claude-sonnet", "gpt-5", "gemini-2.5-pro", "deepseek", "grok", "mistral"],
    image: ["auto", "gpt-image", "imagen", "flux", "stable-diffusion"],
    video: ["auto", "runway", "veo", "pika"],
    search: ["auto", "gemini-search", "brave-search", "google-search"],
    code: ["auto", "claude-sonnet", "gpt-5", "deepseek"],
    translation: ["auto", "gemini", "gpt-5"],
    analysis: ["auto", "gpt-5", "claude-sonnet", "gemini"],
  });

  function getProfile(modelId) {
    return PROFILES[modelId] || null;
  }

  function getUseCaseModelIds(useCaseId) {
    return USE_CASE_MODEL_IDS[useCaseId] ? [...USE_CASE_MODEL_IDS[useCaseId]] : ["auto"];
  }

  function getDisplayName(modelId) {
    return getProfile(modelId)?.name || modelId;
  }

  global.TasuAiWorkspaceModelCatalog = {
    PROFILES,
    USE_CASE_MODEL_IDS,
    getProfile,
    getUseCaseModelIds,
    getDisplayName,
  };
})(typeof window !== "undefined" ? window : globalThis);
