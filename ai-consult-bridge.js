/**
 * TASFUL AI — 相談・検索の共通ロジック（横断検索 → FAQ → ゲートウェイ）
 * ai-workspace / 詳細ページ導線はここを経由。TALK内では直接呼ばない。
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeSearchTarget(value) {
    return global.TasuAiSearchTarget?.normalizeTarget?.(value) || "tasful";
  }

  function isWeakCrossResult(cross) {
    if (!cross?.plain) return true;
    if (/意図を特定できませんでした/.test(cross.plain)) return true;
    if (
      /該当する候補が見つかりませんでした/.test(cross.plain) &&
      !String(cross.html || "").includes("ai-cross-card")
    ) {
      return true;
    }
    return false;
  }

  async function tryCrossSearch(prompt, modeId) {
    if (!global.TasuAiCrossSearch?.tryHandle) return null;
    return global.TasuAiCrossSearch.tryHandle({
      modeId: pickStr(modeId, "cross-matching"),
      userText: prompt,
      messages: [{ role: "user", content: prompt }],
    });
  }

  async function tryFaqSearch(prompt) {
    if (global.TasuAiSearch?.searchFaqKnowledgeRich) {
      const rich = await global.TasuAiSearch.searchFaqKnowledgeRich({
        modeId: "faq",
        userText: prompt,
        messages: [{ role: "user", content: prompt }],
      });
      if (rich?.plain) return rich;
    }
    if (global.TasuAiSearch?.search) {
      const plain = await global.TasuAiSearch.search({
        modeId: "faq",
        userText: prompt,
        messages: [{ role: "user", content: prompt }],
        mode: global.TasuAiModes?.getMode?.("faq"),
      });
      if (plain) return { plain: String(plain), html: "" };
    }
    return null;
  }

  /**
   * TASFUL内検索のみ（横断 + FAQ）
   * @returns {Promise<{ plain: string, html: string, provider: string, intent?: string }|null>}
   */
  async function runInternalSearch(input) {
    const prompt = pickStr(input?.userText);
    if (!prompt) return null;

    if (global.TasuAiGenerateUi?.isGenerationIntent?.(prompt)) {
      return null;
    }

    const modeId = pickStr(input?.modeId, "cross-matching");

    const cross = await tryCrossSearch(prompt, modeId);
    if (cross?.plain && !isWeakCrossResult(cross)) {
      return {
        plain: cross.plain,
        html: cross.html || "",
        provider: "tasu-cross-search",
        intent: cross.intent || "",
        search_used: true,
      };
    }

    const faq = await tryFaqSearch(prompt);
    if (faq?.plain) {
      return {
        plain: faq.plain,
        html: faq.html || "",
        provider: "tasu-faq-knowledge",
        search_used: true,
      };
    }

    return null;
  }

  function buildWritingSystemPrompt(basePrompt) {
    const base = pickStr(basePrompt);
    const instruction =
      "ユーザー依頼に沿って文案・文章・問い合わせ文・資料の草案を日本語で作成してください。完成した文案をそのまま提示し、実用的な内容にしてください。";
    return base ? `${base}\n\n${instruction}` : instruction;
  }

  async function runTasfulFallback(input) {
    const prompt = pickStr(input?.userText);
    const modeId = pickStr(input?.modeId, "cross-matching");
    const messages = Array.isArray(input?.messages)
      ? input.messages
      : [{ role: "user", content: prompt }];
    const isWriting = global.TasuAiGenerateUi?.isGenerationIntent?.(prompt);

    if (global.TasuAiModelGateway?.completeTurn) {
      const turn = await global.TasuAiModelGateway.completeTurn({
        userText: prompt,
        modeId,
        messages,
        systemPrompt: isWriting ? buildWritingSystemPrompt(input?.systemPrompt) : pickStr(input?.systemPrompt),
        surface: "ai-workspace",
        skipSearch: true,
        intent: isWriting ? "work" : undefined,
        preferRemote: isWriting,
        mockFallback: ({ model, message }) => {
          const t = String(message || prompt).trim();
          if (/^(こんにちは|こんばんは|おはよう|はじめまして|hello|hi)(?:[!！.。\s]|$)/i.test(t)) {
            return `こんにちは。TASFUL AI Workspaceです。${model?.label || "AI"}でお答えしています。ご用件を教えてください。`;
          }
          return `ご質問ありがとうございます。\n\n「${t.slice(0, 120)}」について、TASFUL内の掲載やFAQに該当が見つかりませんでした。もう少し具体的に教えてください。`;
        },
      });
      if (turn?.reply) {
        return {
          plain: String(turn.reply),
          html: "",
          provider: "tasu-gateway",
          search_used: false,
          model_id: turn.modelId || "",
          model_label: turn.modelLabel || "",
          model_provider: turn.modelProvider || "",
        };
      }
    }

    return {
      plain:
        "TASFUL内の掲載やFAQに該当が見つかりませんでした。キーワードや地域を添えて、もう一度お試しください。",
      html: "",
      provider: "tasu-empty",
      search_used: false,
    };
  }

  /**
   * @param {{ userText: string, modeId?: string, messages?: Array<{role:string,content:string}>, searchTarget?: string }} input
   * @returns {Promise<{ plain: string, html: string, meta: Record<string, unknown> }|null>}
   */
  async function runConsultTurn(input) {
    const prompt = pickStr(input?.userText);
    if (!prompt) return null;

    const searchTarget = normalizeSearchTarget(input?.searchTarget);
    if (searchTarget === "web") return null;

    const modeId = pickStr(input?.modeId, "cross-matching");
    const messages = Array.isArray(input?.messages) ? input.messages : [{ role: "user", content: prompt }];

    if (searchTarget === "both") return null;

    const internal = await runInternalSearch({ userText: prompt, modeId, messages });
    if (internal) {
      return {
        plain: internal.plain,
        html: internal.html || "",
        meta: {
          provider: internal.provider,
          search_used: Boolean(internal.search_used),
          intent: internal.intent || "",
          search_source: "tasful",
        },
      };
    }

    const fallback = await runTasfulFallback({ userText: prompt, modeId, messages });
    return {
      plain: fallback.plain,
      html: fallback.html || "",
      meta: {
        provider: fallback.provider,
        search_used: Boolean(fallback.search_used),
        search_source: "tasful",
        model_id: fallback.model_id || "",
        model_label: fallback.model_label || "",
        model_provider: fallback.model_provider || "",
      },
    };
  }

  global.TasuAiConsultBridge = {
    runConsultTurn,
    runInternalSearch,
    runTasfulFallback,
    tryCrossSearch,
    tryFaqSearch,
    isWeakCrossResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
