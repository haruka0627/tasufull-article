/**
 * TASFUL TALK — 下書き生成用プロバイダ（相談・検索は ai-workspace へ委譲）
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

  function isConsultSearchMode(mode) {
    const m = String(mode || "").toLowerCase();
    return m === "qa";
  }

  async function tasuTalkProvider(mode, input) {
    const prompt = pickStr(input?.prompt, input?.text, input?.message);
    if (!prompt) {
      return { text: "入力内容を記載してください。", meta: { provider: "tasu" } };
    }

    if (isConsultSearchMode(mode)) {
      const consult = await global.TasuAiConsultBridge?.runConsultTurn?.({
        userText: prompt,
        modeId: "cross-matching",
      });
      if (consult?.plain) {
        return {
          text: consult.plain,
          meta: {
            provider: consult.meta?.provider || "tasu-consult",
            html: consult.html || "",
            search_used: true,
          },
        };
      }
    }

    const turn = await global.TasuAiModelGateway?.completeTurn?.({
      userText: prompt,
      modeId: `talk-${mode}`,
      surface: "talk",
      mockFallback: ({ message, searchContext }) => {
        const searchNote = searchContext ? "\n\n※ Web検索結果を参照する想定です。" : "";
        return (
          `【TALK ${mode} 下書き（モック）】\n\n` +
          `${message.slice(0, 500)}${searchNote}\n\n` +
          `※ ${global.TasuAiPlanModels?.getModel?.(global.TasuAiPlanModels.getSelectedModelId())?.label || "AI"} で生成`
        );
      },
    });

    return {
      text: turn?.reply || "（応答を取得できませんでした）",
      meta: {
        provider: "tasu",
        model: turn?.modelId,
        search_used: turn?.search_used,
        fallback_used: turn?.fallback_used,
      },
    };
  }

  function register() {
    if (!global.TasuTalkAi?.registerTalkAiProvider) return;
    global.TasuTalkAi.registerTalkAiProvider("tasu", tasuTalkProvider);
    global.TasuTalkAi.setTalkAiProvider("tasu");
  }

  if (global.TasuTalkAi) register();
  else global.addEventListener("load", register);

  global.TasuTalkAiSearchBridge = {
    tasuTalkProvider,
    register,
    tryCrossSearch: (prompt) => global.TasuAiConsultBridge?.tryCrossSearch?.(prompt),
    tryFaqSearch: (prompt) => global.TasuAiConsultBridge?.tryFaqSearch?.(prompt),
  };
})(typeof window !== "undefined" ? window : globalThis);
