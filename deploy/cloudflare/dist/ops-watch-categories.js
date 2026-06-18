/**
 * TASFUL OPS WATCH Phase1 — 監視カテゴリ定義
 */
(function (global) {
  "use strict";

  const TASFUL_CONTEXT =
    "TASFULはスキル・求人・店舗・業務サービス・Builder・安否確認を統合するマーケットプレイス。" +
    "運営判断の観点: Stripe / Stripe Connect（決済・出金・本人確認）、OpenAI / Gemini / Claude（AIワークスペース・TALK AI・検索）、" +
    "Cloudflare / Supabase（配信・認証・DB）、LINE / Google / Apple（通知・ログイン・ストア）、法改正・個人情報保護・生成AI規制。" +
    "ニュース要約ではなく「TASFUL運営に影響するか」を必ず判定し、概要・影響・推奨アクションは空欄にしない。";

  /** @type {ReadonlyArray<{ id: string, label: string, searchQuery: string, aliases: string[], tasfulRelevance: string }>} */
  const WATCH_CATEGORIES = Object.freeze([
    {
      id: "openai",
      label: "OpenAI",
      searchQuery: "OpenAI API pricing model release announcement 2025 2026",
      aliases: ["openai", "chatgpt", "gpt-4", "gpt-5", "o1", "o3"],
      tasfulRelevance: "AIワークスペース・TALK AI下書き・検索オーケストレータのモデル連携",
    },
    {
      id: "claude",
      label: "Claude",
      searchQuery: "Anthropic Claude API pricing release announcement 2025 2026",
      aliases: ["anthropic", "claude", "claude-3", "claude-4"],
      tasfulRelevance: "AIモデルゲートウェイ（claude-chat Edge）・運営分析",
    },
    {
      id: "gemini",
      label: "Gemini",
      searchQuery: "Google Gemini API pricing release announcement 2025 2026",
      aliases: ["gemini", "google ai", "vertex"],
      tasfulRelevance: "デフォルトAIモデル・プラン制限・検索連携",
    },
    {
      id: "grok",
      label: "Grok",
      searchQuery: "xAI Grok API pricing release announcement 2025 2026",
      aliases: ["grok", "xai"],
      tasfulRelevance: "将来のモデル追加候補・競合動向",
    },
    {
      id: "cursor",
      label: "Cursor",
      searchQuery: "Cursor IDE pricing feature release announcement 2025 2026",
      aliases: ["cursor", "cursor ide", "cursor agent"],
      tasfulRelevance: "開発生産性・エージェント運用コスト",
    },
    {
      id: "windsurf",
      label: "Windsurf",
      searchQuery: "Windsurf Codeium IDE pricing release announcement 2025 2026",
      aliases: ["windsurf", "codeium"],
      tasfulRelevance: "開発ツール選定・コスト比較",
    },
    {
      id: "suno",
      label: "Suno",
      searchQuery: "Suno AI music API pricing terms announcement 2025 2026",
      aliases: ["suno", "suno ai"],
      tasfulRelevance: "クリエイター向け音声コンテンツ連携の可能性",
    },
    {
      id: "udio",
      label: "Udio",
      searchQuery: "Udio AI music pricing terms announcement 2025 2026",
      aliases: ["udio"],
      tasfulRelevance: "音楽生成サービス連携・著作権リスク",
    },
    {
      id: "elevenlabs",
      label: "ElevenLabs",
      searchQuery: "ElevenLabs API pricing voice announcement 2025 2026",
      aliases: ["elevenlabs", "eleven labs"],
      tasfulRelevance: "音声通知・ナレーション・TALK音声化の候補",
    },
    {
      id: "stripe",
      label: "Stripe",
      searchQuery: "Stripe payments API fee policy update announcement 2025 2026",
      aliases: ["stripe", "stripe payments"],
      tasfulRelevance: "決済手数料・Checkout・プラットフォーム収益",
    },
    {
      id: "stripe_connect",
      label: "Stripe Connect",
      searchQuery: "Stripe Connect payout onboarding policy update 2025 2026",
      aliases: ["stripe connect", "connect express", "connect onboarding"],
      tasfulRelevance: "出品者出金・本人確認・運営Connectアラート",
    },
    {
      id: "cloudflare",
      label: "Cloudflare",
      searchQuery: "Cloudflare outage security Workers pricing announcement 2025 2026",
      aliases: ["cloudflare", "workers", "turnstile"],
      tasfulRelevance: "CDN・WAF・静的配信・Edge依存",
    },
    {
      id: "supabase",
      label: "Supabase",
      searchQuery: "Supabase pricing RLS auth realtime announcement 2025 2026",
      aliases: ["supabase", "postgres rls"],
      tasfulRelevance: "TALK同期・チャット・OPSデータ・Edge Functions",
    },
  ]);

  const BY_ID = Object.freeze(
    WATCH_CATEGORIES.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, /** @type {Record<string, typeof WATCH_CATEGORIES[number]>} */ ({}))
  );

  function listCategories() {
    return WATCH_CATEGORIES.slice();
  }

  function getCategory(id) {
    return BY_ID[String(id || "").trim()] || null;
  }

  function allCategoryLabels() {
    return WATCH_CATEGORIES.map((c) => c.label);
  }

  function allKnownAliases() {
    const set = new Set();
    WATCH_CATEGORIES.forEach((c) => {
      set.add(c.label.toLowerCase());
      (c.aliases || []).forEach((a) => set.add(String(a).toLowerCase()));
    });
    return set;
  }

  global.TasuOpsWatchCategories = {
    TASFUL_CONTEXT,
    WATCH_CATEGORIES,
    listCategories,
    getCategory,
    allCategoryLabels,
    allKnownAliases,
  };
})(typeof window !== "undefined" ? window : globalThis);
