/**
 * TASFUL AI Workspace — 回答本文の Markdown 読みやすさ（system prompt 追記）
 */
(function (global) {
  "use strict";

  const MARKDOWN_READING_RULES = `回答の読みやすさ（Markdown構造 · 必須）:
- 長文では ## 見出し で短いセクションに分ける
- 重要語は **太字** にする（1段落に太字を詰め込みすぎない）
- 3項目以上の説明は番号付きリスト（1. 2. 3.）にする
- 各リスト項目の1行目は **短い強調語** で始める
- 1段落は2〜3行以内。長い説明は段落を分ける
- 注意点は「## 注意点」「## 確認ポイント」などの見出しで分ける
- 同じ強さの文章を長く連続させない`;

  function appendToSystemPrompt(base) {
    const text = String(base || "").trim();
    if (!text) return MARKDOWN_READING_RULES;
    if (text.includes("Markdown構造 · 必須")) return text;
    return `${text}\n\n${MARKDOWN_READING_RULES}`;
  }

  global.TasuAiWorkspaceAnswerFormat = {
    MARKDOWN_READING_RULES,
    appendToSystemPrompt,
  };
})(typeof window !== "undefined" ? window : globalThis);
