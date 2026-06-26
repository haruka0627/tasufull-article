/**
 * Builder AI — Worker / Partner 検索補助（条件整理 · 将来 DB API 接続用）
 */
(function (global) {
  "use strict";

  const SEARCH_ACTION_IDS = Object.freeze(["worker_search_assist", "partner_search_assist"]);

  const WORKER_FIELDS = Object.freeze([
    { key: "name", label: "氏名", patterns: [/氏名[:：\s]*([^\n,、]+)/i, /名前[:：\s]*([^\n,、]+)/i] },
    { key: "category", label: "対応カテゴリ", patterns: [/カテゴリ[:：\s]*([^\n]+)/i, /職種[:：\s]*([^\n]+)/i] },
    { key: "area", label: "対応エリア", patterns: [/エリア[:：\s]*([^\n]+)/i, /対応(?:エリア|地域)[:：\s]*([^\n]+)/i] },
    { key: "license", label: "保有資格", patterns: [/資格[:：\s]*([^\n]+)/i] },
    { key: "availability", label: "稼働状況", patterns: [/稼働[:：\s]*([^\n]+)/i] },
    { key: "rate", label: "希望単価", patterns: [/単価[:：\s]*([^\n]+)/i, /希望単価[:：\s]*([^\n]+)/i] },
    { key: "experience", label: "経験年数", patterns: [/経験[:：\s]*([^\n]+)/i] },
    { key: "verified", label: "本人確認", patterns: [/本人確認[:：\s]*([^\n]+)/i] },
    { key: "rating", label: "評価", patterns: [/評価[:：\s]*([^\n]+)/i] },
    { key: "ng", label: "NGフラグ", patterns: [/NG[:：\s]*([^\n]+)/i] },
    { key: "history", label: "過去案件", patterns: [/過去案件[:：\s]*([^\n]+)/i] },
  ]);

  const PARTNER_FIELDS = Object.freeze([
    { key: "company", label: "会社名", patterns: [/会社名[:：\s]*([^\n,、]+)/i] },
    { key: "tradeName", label: "屋号", patterns: [/屋号[:：\s]*([^\n,、]+)/i] },
    { key: "representative", label: "代表者", patterns: [/代表[:：\s]*([^\n,、]+)/i] },
    { key: "category", label: "対応カテゴリ", patterns: [/カテゴリ[:：\s]*([^\n]+)/i, /業種[:：\s]*([^\n]+)/i] },
    { key: "area", label: "対応エリア", patterns: [/エリア[:：\s]*([^\n]+)/i] },
    { key: "license", label: "保有資格", patterns: [/資格[:：\s]*([^\n]+)/i] },
    { key: "insurance", label: "保険加入", patterns: [/保険[:：\s]*([^\n]+)/i] },
    { key: "corpNumber", label: "法人番号", patterns: [/法人番号[:：\s]*([^\n]+)/i] },
    { key: "invoiceReg", label: "インボイス登録番号", patterns: [/インボイス[:：\s]*([^\n]+)/i, /登録番号[:：\s]*([^\n]+)/i] },
    { key: "rating", label: "評価", patterns: [/評価[:：\s]*([^\n]+)/i] },
    { key: "scale", label: "対応規模", patterns: [/規模[:：\s]*([^\n]+)/i] },
    { key: "history", label: "過去案件", patterns: [/過去案件[:：\s]*([^\n]+)/i] },
    { key: "ng", label: "NGフラグ", patterns: [/NG[:：\s]*([^\n]+)/i] },
  ]);

  function extractFields(text, fields) {
    const t = String(text || "");
    const out = {};
    fields.forEach((f) => {
      for (const p of f.patterns) {
        const m = t.match(p);
        if (m && m[1]) {
          out[f.key] = m[1].trim();
          break;
        }
      }
    });
    return out;
  }

  function linesFromFields(fields, parsed) {
    return fields
      .map((f) => {
        const v = parsed[f.key];
        return `- ${f.label}: ${v || "（未指定 — 入力または運営確認）"}`;
      })
      .join("\n");
  }

  function comparisonTable(kind) {
    if (kind === "worker") {
      return [
        "| 氏名 | カテゴリ | エリア | 資格 | 稼働 | 単価 | 評価 | 備考 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        "| （DB/API接続後） | — | — | — | — | — | — | 下書き候補 |",
      ].join("\n");
    }
    return [
      "| 会社名 | 屋号 | カテゴリ | エリア | 資格 | インボイス | 評価 | 備考 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| （DB/API接続後） | — | — | — | — | — | — | 下書き候補 |",
    ].join("\n");
  }

  /**
   * @param {string} actionId
   * @param {string} userText
   * @param {{ contextText?: string }} [opts]
   */
  function run(actionId, userText, opts) {
    const kind = actionId === "worker_search_assist" ? "worker" : "partner";
    const fields = kind === "worker" ? WORKER_FIELDS : PARTNER_FIELDS;
    const parsed = extractFields(userText, fields);
    const ctx = String(opts?.contextText || "").trim();
    const title = kind === "worker" ? "Worker検索補助" : "業者・協力会社検索補助";

    const body = [
      `【${title} — 条件整理案】`,
      "",
      "## 検索条件",
      linesFromFields(fields, parsed),
      ctx ? `\n## 案件コンテキスト（参考）\n${ctx.slice(0, 800)}` : "",
      "",
      "## 優先条件（案）",
      "- 案件の作業内容・エリアと一致",
      "- 必要資格・保険の有無",
      "- 評価・稼働状況",
      "",
      "## 除外条件（案）",
      "- NGフラグ該当",
      "- 対応エリア外",
      "- 必須資格不足",
      "",
      "## 候補比較表（テンプレート）",
      comparisonTable(kind),
      "",
      "## 注意点",
      "- 本出力は検索条件整理・比較テンプレートであり、採用・契約の確定ではありません。",
      "- 実候補リストは将来 Worker/Partner DB 検索 API 接続後に自動入力されます。",
      "- **最終選定は運営確認が必要**です。",
      "- おすすめ順整理: `candidate_recommendation` アクションをご利用ください。",
    ]
      .filter(Boolean)
      .join("\n");

    return { ok: true, draftBody: body, parsed, kind, apiReady: false };
  }

  function isSearchAction(actionId) {
    return SEARCH_ACTION_IDS.includes(actionId);
  }

  global.TasuBuilderAISearchAssist = {
    SEARCH_ACTION_IDS,
    WORKER_FIELDS,
    PARTNER_FIELDS,
    run,
    isSearchAction,
    extractFields,
  };
})(typeof window !== "undefined" ? window : globalThis);
