/**
 * AI 秘書 Phase 5-B — DeepSeek structured 分類（失敗時 regex fallback）
 */
(function (global) {
  "use strict";

  const CLASSIFY_PROMPT =
    "You classify TASFUL ops messages. Reply with ONLY one JSON object, no markdown:\n" +
    '{"primaryAgentId":"architecture|builder|platform|tlv|secretary|tasful-ai|qa|review|release|docs|security|performance|database|ci|product|prompt-ai|ux-ui|api-integration|devops","category":"string","severity":"low|medium|high|critical","confidence":0.0-1.0}';

  function parseJsonFromReply(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const obj = JSON.parse(candidate.slice(start, end + 1));
      if (!obj || typeof obj !== "object") return null;
      const agentId = String(obj.primaryAgentId || "").trim();
      if (!agentId) return null;
      return {
        ok: true,
        primaryAgentId: agentId,
        category: String(obj.category || "general"),
        severity: String(obj.severity || "medium"),
        confidence: Number(obj.confidence) || 0.75,
        matchedRule: "deepseek_structured",
        method: "deepseek",
      };
    } catch {
      return null;
    }
  }

  async function classifyWithDeepSeek(userText) {
    const text = String(userText || "").trim();
    if (!text) return null;
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) return null;
    try {
      const out = await Adapter.completeTurn({
        userText: text,
        systemPrompt: CLASSIFY_PROMPT,
        messages: [],
        modeId: "ops_secretary_classify",
        mockFallback: () => "",
      });
      if (out?.fallback_used || !out?.reply) return null;
      const parsed = parseJsonFromReply(out.reply);
      if (!parsed) return null;
      return { ...parsed, userText: text };
    } catch {
      return null;
    }
  }

  global.TasuSecretaryDeepSeekClassifier = {
    CLASSIFY_PROMPT,
    parseJsonFromReply,
    classifyWithDeepSeek,
  };
})(typeof window !== "undefined" ? window : globalThis);
