/**
 * AI Workspace — TASFUL内検索クエリ解析（AI API不使用）
 */
(function (global) {
  "use strict";

  const PREFECTURES =
    /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|埼玉|千葉県|千葉|東京都|東京|神奈川県|神奈川|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|京都|大阪府|大阪|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|福岡|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;

  const TYPE_PATTERNS = {
    vendor: /業者|法人|見積|工事|清掃|メンテ|修繕|業務サービス|屋根|外壁|塗装|リフォーム/,
    worker: /ワーカー|作業員|人手|手伝|軽作業|Connect|コネクト|connect/i,
    job: /求人|採用|募集|転職|バイト|アルバイト|正社員|パート|時給|月給/,
    product: /商品|買いたい|購入|在庫|物販|ショップ|店舗|お店/,
  };

  function normalizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractPrefecture(text) {
    const m = text.match(PREFECTURES);
    if (!m) return "";
    const raw = m[0];
    if (raw === "埼玉") return "埼玉県";
    if (raw === "東京") return "東京都";
    if (raw === "大阪") return "大阪府";
    if (raw === "京都") return "京都府";
    if (raw === "千葉") return "千葉県";
    if (raw === "神奈川") return "神奈川県";
    if (raw === "福岡") return "福岡県";
    return raw;
  }

  function extractMinRating(text) {
    const m = text.match(/評価\s*([4-5])(?:\s*以上|点)?|([4-5])\s*点以上|([4-5])\s*以上/);
    if (m) return Number(m[1] || m[2] || m[3]);
    if (/高評価|評価4|★{4,}/.test(text)) return 4;
    return null;
  }

  function extractPriceRange(text) {
    const budget = text.match(/(\d+[\d,]*\s*円|\d+\s*万円?|予算\s*[\d,万円]+|〜\s*[\d,万円]+)/)?.[0] || "";
    return budget;
  }

  function inferSort(text) {
    if (/安い|価格順|予算/.test(text)) return "price_asc";
    if (/評価|口コミ|人気/.test(text)) return "rating_desc";
    if (/近い|近く|距離/.test(text)) return "nearby";
    return "relevance";
  }

  function inferType(text) {
    if (TYPE_PATTERNS.job.test(text)) return "job";
    if (TYPE_PATTERNS.product.test(text) && !TYPE_PATTERNS.vendor.test(text)) return "product";
    if (TYPE_PATTERNS.worker.test(text) && !TYPE_PATTERNS.vendor.test(text)) return "worker";
    if (TYPE_PATTERNS.vendor.test(text)) return "vendor";
    if (/探して|比較|紹介/.test(text)) return "vendor";
    return "";
  }

  function inferCategoryKeyword(text) {
    if (/屋根|防水|雨漏り/.test(text)) return "屋根修理";
    if (/草刈|除草|庭|芝生|剪定/.test(text)) return "草刈り";
    if (/エアコン|水道|電気|設備/.test(text)) return "設備修理";
    if (/引っ越し|搬入|配送/.test(text)) return "配送・搬入";
    return "";
  }

  function parseWorkspaceSearchQuery(userText) {
    const text = normalizeText(userText);
    return {
      text,
      type: inferType(text),
      category: inferCategoryKeyword(text),
      prefecture: extractPrefecture(text),
      area: extractPrefecture(text),
      keyword: text
        .replace(PREFECTURES, " ")
        .replace(/評価\s*[4-5].*?以上/g, " ")
        .replace(/Connect対応|connect対応|コネクト対応/gi, " ")
        .replace(/探して|比較して|教えて|ほしい/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120),
      minRating: extractMinRating(text),
      connectOnly: /Connect|コネクト|connect対応/i.test(text),
      nearby: /近く|近所|周辺|付近|近い/.test(text),
      compareMode: /比較/.test(text),
      priceRange: extractPriceRange(text),
      sort: inferSort(text),
    };
  }

  function formatCriteriaSummary(parsed) {
    if (!parsed) return "";
    const lines = ["【検索条件】"];
    if (parsed.type) lines.push(`・種別: ${parsed.type}`);
    if (parsed.category) lines.push(`・カテゴリ: ${parsed.category}`);
    if (parsed.prefecture) lines.push(`・地域: ${parsed.prefecture}`);
    if (parsed.minRating) lines.push(`・評価: ${parsed.minRating}以上`);
    if (parsed.connectOnly) lines.push("・Connect対応");
    if (parsed.nearby) lines.push("・近くの候補");
    if (parsed.compareMode) lines.push("・比較モード");
    if (parsed.sort && parsed.sort !== "relevance") lines.push(`・並び: ${parsed.sort}`);
    return lines.join("\n");
  }

  global.TasuAiWorkspaceSearchIntent = {
    parseWorkspaceSearchQuery,
    formatCriteriaSummary,
    extractPrefecture,
    extractMinRating,
  };
})(typeof window !== "undefined" ? window : globalThis);
