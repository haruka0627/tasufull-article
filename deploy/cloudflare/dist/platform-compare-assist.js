/**
 * Platform — AI比較 assist（compare_assist · 契約決定なし）
 */
(function (global) {
  "use strict";

  const ACTION_ID = "compare_assist";
  const BASKET_KEY = "tasu_platform_compare_basket";

  function readBasket() {
    try {
      const raw = global.sessionStorage?.getItem(BASKET_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeBasket(items) {
    try {
      global.sessionStorage?.setItem(BASKET_KEY, JSON.stringify(items.slice(0, 5)));
    } catch {
      /* ignore */
    }
  }

  function addToBasket(listing) {
    const id = String(listing?.id || listing?.listing_id || "").trim();
    if (!id) return readBasket();
    const prev = readBasket().filter((x) => x.id !== id);
    const row = {
      id,
      title: listing?.title || listing?.name || id,
      type: listing?.listing_type || listing?.type || "",
      price: listing?.price ?? listing?.price_amount,
      area: listing?.area || listing?.service_area || "",
      rating: listing?.review_average ?? listing?.rating,
    };
    writeBasket([row, ...prev]);
    return readBasket();
  }

  function labelFor(row) {
    return row.title || row.id;
  }

  /**
   * @param {object[]} listings 比較対象（2件以上推奨）
   * @param {{ userText?: string }} [opts]
   */
  function run(listings, opts) {
    const items = (listings || []).slice(0, 5);
    if (items.length < 2) {
      return { ok: false, error: "need_two", message: "比較には2件以上の候補が必要です。" };
    }

    const ctx = global.TasuPlatformSearchHub?.getSearchContext?.() || {};
    const scored = items.map((l) => ({
      listing: l,
      ...(global.TasuPlatformAiRecommend?.scoreListing?.(l, ctx) || { score: 0, reasons: [] }),
    }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const headers = ["項目", ...items.map((l) => l.title || l.name || "候補")];
    const rows = [
      ["エリア", ...items.map((l) => l.area || l.service_area || "—")],
      ["価格", ...items.map((l) => formatPrice(l))],
      ["評価", ...items.map((l) => l.review_average ?? l.rating ?? "—")],
      ["即対応", ...items.map((l) => (/即/i.test(String(l.availability || "")) ? "可" : "—"))],
    ];

    const table = [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");

    const goodPoints = scored.map(
      (s) => `- **${labelFor(s.listing)}**: ${(s.reasons || []).slice(0, 3).map((r) => r.text).join(" · ") || "条件確認中"}`
    );

    const cautions = [
      "- AIは契約・購入・依頼を決定しません。",
      "- 価格・工期・保証は掲載ページと見積で最終確認してください。",
    ];

    const comparePoints = [
      "- エリア・価格帯・評価・対応速度",
      "- 資格・本人確認・法人認証の有無",
      "- レビュー内容と実績",
    ];

    const aiUrl =
      global.TasuAiWorkspaceLinks?.buildCompareAssistUrl?.(
        items.map((l) => l.id),
        `比較: ${items.map((l) => l.title).join(" / ")}`
      ) || "ai-workspace.html?mode=cross-matching";

    const body = [
      "【AI比較 — 下書き】",
      "",
      "## 比較表",
      table,
      "",
      "## 良い点",
      ...goodPoints,
      "",
      "## 注意点",
      ...cautions,
      "",
      "## AIおすすめ理由（参考）",
      `- 参考1位: **${labelFor(best.listing)}** — ${(best.reasons || []).map((r) => r.text).join(" · ") || "総合スコア参考"}`,
      "",
      "## 比較ポイント",
      ...comparePoints,
      "",
      "## 判断材料",
      "- 最終判断は依頼者・購入者が行ってください。",
      "- 不明点は TASFUL AI または出品者へ確認してください。",
      "",
      `## TASFUL AI で続ける\n${aiUrl}`,
    ].join("\n");

    return { ok: true, action: ACTION_ID, body, best, scored, aiUrl };
  }

  function formatPrice(l) {
    const n = Number(l?.price ?? l?.price_amount);
    if (Number.isFinite(n) && n > 0) return `¥${n.toLocaleString("ja-JP")}`;
    return l?.priceText || l?.price_label || "要相談";
  }

  global.TasuPlatformCompareAssist = {
    ACTION_ID,
    BASKET_KEY,
    readBasket,
    writeBasket,
    addToBasket,
    run,
  };
})(typeof window !== "undefined" ? window : globalThis);
