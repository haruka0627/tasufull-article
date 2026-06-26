/**
 * Platform — AI条件検索 assist（自然文 → 条件整理 · TASFUL AI 入口）
 * Platform専用AIは作らない。deterministic 整理 + ai-workspace へ誘導。
 */
(function (global) {
  "use strict";

  const ACTION_ID = "search_assist";

  const FIELD_PATTERNS = Object.freeze([
    { key: "area", label: "エリア", patterns: [/埼玉|東京|神奈川|大阪|千葉|愛知|福岡|北海道/i, /(?:都|府|県)[^\s、,]+/, /エリア[:：\s]*([^\n]+)/i] },
    { key: "budget", label: "予算", patterns: [/(\d+)\s*万(?:円)?(?:以内|以下)/, /予算[:：\s]*([\d,]+)/i] },
    { key: "category", label: "カテゴリ", patterns: [/外壁塗装|ハウスクリーニング|エアコン|水道修理|内装|リフォーム|動画編集|AI/i] },
    { key: "staff", label: "スタッフ", patterns: [/女性スタッフ|男性スタッフ|女性/i] },
    { key: "instant", label: "即対応", patterns: [/即対応|即日|今日中|急ぎ/i] },
    { key: "license", label: "資格", patterns: [/資格[:：\s]*([^\n]+)/i, /有資格|第二種電工|建設業/i] },
  ]);

  function extractConditions(text) {
    const t = String(text || "");
    const out = {};
    FIELD_PATTERNS.forEach((f) => {
      for (const p of f.patterns) {
        const m = t.match(p);
        if (m) {
          out[f.key] = m[1] !== undefined ? String(m[1]).trim() : m[0].trim();
          break;
        }
      }
    });
    return out;
  }

  function parseBudgetYen(conditions) {
    const raw = String(conditions.budget || "");
    const man = raw.match(/(\d+)\s*万/);
    if (man) return Number(man[1]) * 10000;
    const num = Number(String(raw).replace(/[,，]/g, ""));
    return Number.isFinite(num) ? num : NaN;
  }

  function buildAiQuery(conditions) {
    const parts = ["以下の条件で掲載を探してください（整理のみ・確定依頼はしません）"];
    if (conditions.area) parts.push(`エリア: ${conditions.area}`);
    if (conditions.budget) parts.push(`予算: ${conditions.budget}`);
    if (conditions.category) parts.push(`内容: ${conditions.category}`);
    if (conditions.staff) parts.push(`希望: ${conditions.staff}`);
    if (conditions.instant) parts.push("即対応希望");
    if (conditions.license) parts.push(`資格: ${conditions.license}`);
    return parts.join(" / ");
  }

  /**
   * @param {string} userText
   * @param {{ listings?: object[], context?: object }} [opts]
   */
  function run(userText, opts) {
    const conditions = extractConditions(userText);
    const ctx = {
      area: conditions.area || opts?.context?.area || "",
      budgetMax: parseBudgetYen(conditions) || opts?.context?.budgetMax,
    };
    const listings = opts?.listings || [];
    const ranked = global.TasuPlatformAiRecommend?.rankListings?.(listings, ctx) || [];
    const top = ranked.filter((r) => r.recommended).slice(0, 5);

    const conditionLines = FIELD_PATTERNS.map((f) => {
      const v = conditions[f.key];
      return `- ${f.label}: ${v || "（未指定）"}`;
    });

    const candidateLines = top.length
      ? top.map((r, i) => `${i + 1}. ${r.listing?.title || r.listing?.name || "候補"}（参考スコア ${r.score}）`)
      : ["（候補は TASFUL AI または一覧検索で確認）"];

    const aiUrl =
      global.TasuAiWorkspaceLinks?.buildSearchAssistUrl?.(buildAiQuery(conditions)) ||
      `ai-workspace.html?mode=cross-matching&q=${encodeURIComponent(buildAiQuery(conditions))}&send=1`;

    const body = [
      "【AI条件検索 — 整理案】",
      "",
      "## 検索条件",
      ...conditionLines,
      "",
      "## 候補一覧（参考 · 確定選定ではありません）",
      ...candidateLines,
      "",
      "## AIおすすめ",
      top.length ? top.map((r) => `- ${r.listing?.title || "候補"}: ${(r.reasons || []).map((x) => x.text).join(" · ") || "条件一致"}`).join("\n") : "- TASFUL AI で追加候補を確認してください",
      "",
      "## 注意点",
      "- 契約・購入・応募の確定はユーザーまたは運営が行います。",
      "- 表示候補は参考です。最新情報は掲載ページで確認してください。",
      "",
      `## TASFUL AI で続ける\n${aiUrl}`,
    ].join("\n");

    return { ok: true, action: ACTION_ID, conditions, ctx, ranked: top, aiUrl, body };
  }

  global.TasuPlatformSearchAssist = {
    ACTION_ID,
    FIELD_PATTERNS,
    extractConditions,
    buildAiQuery,
    run,
  };
})(typeof window !== "undefined" ? window : globalThis);
