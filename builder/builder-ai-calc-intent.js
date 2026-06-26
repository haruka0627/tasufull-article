/**
 * Builder AI — 自然文から計算 intent / スロット抽出
 */
(function (global) {
  "use strict";

  const TSUBO_TO_SQM = 3.305785;
  const DEFAULT_PAINT_COVERAGE_SQM = 25;

  function parseNum(raw) {
    if (raw === null || raw === undefined || raw === "") return NaN;
    const n = Number(String(raw).replace(/[,，]/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function pick(text, patterns) {
    const t = String(text || "");
    for (const p of patterns) {
      const m = t.match(p);
      if (m && m[1] !== undefined) return String(m[1]).trim();
    }
    return "";
  }

  function pickNum(text, patterns) {
    const raw = pick(text, patterns);
    return raw ? parseNum(raw) : NaN;
  }

  /** @param {string} text */
  function isCalcQuery(text) {
    return detect(text).kind !== "none";
  }

  /**
   * @param {string} text
   * @returns {{
   *   kind: string,
   *   actionId?: string,
   *   chainId?: string,
   *   normalizedText?: string,
   *   slots?: object,
   *   confidence?: number,
   * }}
   */
  function detect(text) {
    const t = String(text || "").trim();
    if (!t) return { kind: "none" };

    const hasArea =
      /([\d.]+)\s*(?:㎡|m2|平方メートル)/i.test(t) ||
      /([\d.]+)\s*坪/i.test(t) ||
      /外壁|屋根|塗装|塗料|クロス/i.test(t);

    if (/何缶|缶.*必要|必要.*缶|何本|何箱/i.test(t) && hasArea) {
      return { kind: "chain", chainId: "material_units", slots: extractMaterialSlots(t), confidence: 0.9 };
    }

    if (/外壁|塗装|塗料|シリコン|ペンキ|外装/i.test(t) && (hasArea || /概算|見積|材料/i.test(t))) {
      return { kind: "chain", chainId: "exterior_paint", slots: extractExteriorPaintSlots(t), confidence: 0.9 };
    }

    if (/缶|本|箱/i.test(t) && hasArea && !/概算|見積|2回|3回|シリコン/i.test(t)) {
      return { kind: "chain", chainId: "material_units", slots: extractMaterialSlots(t), confidence: 0.85 };
    }

    if (/インボイス|請求|税込|税抜|消費税/i.test(t)) {
      return { kind: "action", actionId: "invoice_tax_calc", normalizedText: t, confidence: 0.85 };
    }

    if (/利益率|粗利率|マージン/i.test(t) && /(?:作|出|で)/i.test(t)) {
      return { kind: "chain", chainId: "target_profit", slots: extractTargetProfitSlots(t), confidence: 0.8 };
    }

    if (/原価|見積|粗利|利益/i.test(t)) {
      return { kind: "action", actionId: "estimate_profit_calc", normalizedText: t, confidence: 0.75 };
    }

    if (/人件費|日当|人工|人数/i.test(t)) {
      return { kind: "action", actionId: "labor_cost_calc", normalizedText: t, confidence: 0.75 };
    }

    if (/工期|開始日|終了日|稼働日/i.test(t)) {
      return { kind: "action", actionId: "schedule_calc", normalizedText: t, confidence: 0.75 };
    }

    if (/坪|㎡|m2|畳|単位変換/i.test(t)) {
      return { kind: "action", actionId: "area_unit_calc", normalizedText: t, confidence: 0.7 };
    }

    if (/壁(?:面積)?|天井|クロス|塗装.*数量|ロス率/i.test(t)) {
      return { kind: "action", actionId: "paint_cross_calc", normalizedText: t, confidence: 0.7 };
    }

    if (/材料数量|ロス率|予備|単価/i.test(t)) {
      return { kind: "action", actionId: "material_quantity_calc", normalizedText: t, confidence: 0.65 };
    }

    return { kind: "none" };
  }

  function extractExteriorPaintSlots(text) {
    const tsubo = pickNum(text, [/([\d.]+)\s*坪/i]);
    let wallSqm = pickNum(text, [/外壁\s*([\d.]+)\s*(?:㎡|m2)/i, /([\d.]+)\s*(?:㎡|m2|平方メートル)/i]);
    if (Number.isNaN(wallSqm) && !Number.isNaN(tsubo)) wallSqm = tsubo * TSUBO_TO_SQM;
    const coats = /3回|三回/i.test(text) ? 3 : /2回|二回|2度/i.test(text) ? 2 : 1;
    const lossPct = pickNum(text, [/ロス(?:率)?[:：\s]*([\d.]+)\s*%?/i]) || 10;
    const coverage =
      pickNum(text, [/([\d.]+)\s*㎡\s*[\/／]\s*缶/i, /施工可能(?:面積)?[:：\s]*([\d.]+)/i]) ||
      DEFAULT_PAINT_COVERAGE_SQM;
    const unitPrice = pickNum(text, [/単価[:：\s]*([\d,]+)/i, /([\d,]+)\s*円\s*[\/／]\s*缶/i]);
    return { wallSqm, tsubo, coats, lossPct, coverage, unitPrice, materialType: /シリコン/i.test(text) ? "シリコン" : "塗料" };
  }

  function extractMaterialSlots(text) {
    const tsubo = pickNum(text, [/([\d.]+)\s*坪/i]);
    let area = pickNum(text, [/外壁\s*([\d.]+)\s*(?:㎡|m2)/i, /([\d.]+)\s*(?:㎡|m2)/i]);
    if (Number.isNaN(area) && !Number.isNaN(tsubo)) area = tsubo * TSUBO_TO_SQM;
    const coverage =
      pickNum(text, [/([\d.]+)\s*㎡\s*[\/／]\s*缶/i]) ||
      (/クロス/i.test(text) ? 50 : DEFAULT_PAINT_COVERAGE_SQM);
    const unit = /缶/i.test(text) ? "缶" : /本/i.test(text) ? "本" : /箱/i.test(text) ? "箱" : "缶";
    return { area, coverage, unit };
  }

  function extractTargetProfitSlots(text) {
    const targetRate =
      pickNum(text, [/利益率[:：\s]*([\d.]+)\s*%?/i, /粗利率[:：\s]*([\d.]+)\s*%?/i, /([\d.]+)\s*%\s*(?:の|で)/i]) ||
      NaN;
    const cost = pickNum(text, [/原価[:：\s]*([\d,]+)/i]);
    const estimate = pickNum(text, [/見積(?:金額)?[:：\s]*([\d,]+)/i]);
    return { targetRate, cost, estimate };
  }

  global.TasuBuilderAICalcIntent = {
    TSUBO_TO_SQM,
    DEFAULT_PAINT_COVERAGE_SQM,
    isCalcQuery,
    detect,
    parseNum,
    pickNum,
  };
})(typeof window !== "undefined" ? window : globalThis);
