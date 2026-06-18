/**
 * TASFUL — AI音声カタログ（Phase1: Web Speech API / 静的）
 */
(function (global) {
  "use strict";

  /** @type {ReadonlyArray<object>} */
  const VOICES = Object.freeze([
    {
      id: "std_neutral",
      label: "標準・落ち着いた",
      gender: "neutral",
      tone: "calm",
      isPremium: false,
      enabled: true,
      previewText: "こんにちは。TASFULの標準音声です。",
      browserMatch: { lang: "ja", nameHints: ["google 日本語", "microsoft ichiro", "kyoko"] },
      sortOrder: 10,
    },
    {
      id: "std_friendly_f",
      label: "やわらかい女性",
      gender: "female",
      tone: "friendly",
      isPremium: false,
      enabled: true,
      previewText: "こんにちは。やわらかい声でお読みします。",
      browserMatch: { lang: "ja", nameHints: ["haruka", "nanami", "female", "kyoko", "google 日本語"] },
      sortOrder: 20,
    },
    {
      id: "std_clear_m",
      label: "はっきり男性",
      gender: "male",
      tone: "clear",
      isPremium: false,
      enabled: true,
      previewText: "こんにちは。はっきりした声でお読みします。",
      browserMatch: { lang: "ja", nameHints: ["ichiro", "keita", "male", "microsoft ichiro"] },
      sortOrder: 30,
    },
    {
      id: "std_bright_f",
      label: "明るい女性",
      gender: "female",
      tone: "bright",
      isPremium: false,
      enabled: true,
      previewText: "こんにちは。明るいトーンでお読みします。",
      browserMatch: { lang: "ja", nameHints: ["nanami", "haruka", "female"] },
      sortOrder: 40,
    },
    {
      id: "prem_warm_f",
      label: "プレミアム・温かみのある女性",
      gender: "female",
      tone: "warm",
      isPremium: true,
      enabled: false,
      previewText: "プレミアム音声の試聴は準備中です。",
      browserMatch: { lang: "ja", nameHints: [] },
      sortOrder: 100,
    },
    {
      id: "prem_narrator",
      label: "プレミアム・ナレーター",
      gender: "neutral",
      tone: "narrator",
      isPremium: true,
      enabled: false,
      previewText: "プレミアム音声の試聴は準備中です。",
      browserMatch: { lang: "ja", nameHints: [] },
      sortOrder: 110,
    },
    {
      id: "prem_character",
      label: "プレミアム・キャラクター音声",
      gender: "neutral",
      tone: "character",
      isPremium: true,
      enabled: false,
      previewText: "プレミアム音声の試聴は準備中です。",
      browserMatch: { lang: "ja", nameHints: [] },
      sortOrder: 120,
    },
  ]);

  function listAll() {
    return VOICES.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  function listStandard() {
    return listAll().filter((v) => !v.isPremium && v.enabled !== false);
  }

  function listPremium() {
    return listAll().filter((v) => v.isPremium);
  }

  function getById(voiceId) {
    const id = String(voiceId || "").trim();
    return VOICES.find((v) => v.id === id) || null;
  }

  function getDefaultVoiceId() {
    const first = listStandard()[0];
    return first?.id || "std_neutral";
  }

  function isSelectable(voiceId) {
    const row = getById(voiceId);
    return Boolean(row && !row.isPremium && row.enabled !== false);
  }

  global.TasuVoiceCatalog = {
    VOICES,
    listAll,
    listStandard,
    listPremium,
    getById,
    getDefaultVoiceId,
    isSelectable,
  };
})(typeof window !== "undefined" ? window : globalThis);
