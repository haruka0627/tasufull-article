/**
 * Builder AI — 計算ツール orchestrator（deterministic 実行 + 要約）
 */
(function (global) {
  "use strict";

  const DISCLAIMER = "※計算結果は参考値です。現場実測・仕様確認後、発注・請求前に人間確認が必要です。";

  function fmtYen(n) {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);
  }

  function fmtNum(n, d) {
    return new Intl.NumberFormat("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }

  function fmtPct(n) {
    return fmtNum(n, 1) + "%";
  }

  function getIntent() {
    return global.TasuBuilderAICalcIntent;
  }

  function getCalc() {
    return global.TasuBuilderAICalculators;
  }

  function getMaterialToolCalculate() {
    const tools = global.BuilderConstructionTools;
    if (tools?.calculate) {
      return (area, coverage) => tools.calculate("material-calculator", { area, coverage });
    }
    return (area, coverage) => ({
      area,
      coverage,
      quantity: coverage > 0 ? Math.ceil(area / coverage) : 0,
    });
  }

  function isCalcQuery(text) {
    return getIntent()?.isCalcQuery?.(text) === true;
  }

  function runMaterialUnits(slots) {
    const area = Number(slots?.area) || 0;
    const coverage = Number(slots?.coverage) || getIntent()?.DEFAULT_PAINT_COVERAGE_SQM || 25;
    const unit = slots?.unit || "缶";
    if (area <= 0) return { ok: false, error: "area_required", hint: "施工面積（㎡ または 坪）を指定してください。" };

    const toolResult = getMaterialToolCalculate()(area, coverage);
    const body = [
      "【計算結果 — 材料数量（Builder ツール）】",
      `施工面積: ${fmtNum(area, 2)} ㎡`,
      `1${unit}あたり施工可能: ${fmtNum(coverage, 2)} ㎡`,
      `必要数量: ${toolResult.quantity} ${unit}（切り上げ）`,
      "",
      DISCLAIMER,
    ].join("\n");
    return {
      ok: true,
      actionId: "material_unit_calc",
      draftBody: body,
      result: { area, coverage, quantity: toolResult.quantity, unit },
    };
  }

  function runExteriorPaintChain(slots) {
    const wallSqm = Number(slots?.wallSqm) || 0;
    const tsubo = Number(slots?.tsubo) || NaN;
    const coats = Number(slots?.coats) || 1;
    const lossPct = Number(slots?.lossPct) || 10;
    const coverage = Number(slots?.coverage) || getIntent()?.DEFAULT_PAINT_COVERAGE_SQM || 25;
    const materialType = slots?.materialType || "塗料";

    if (wallSqm <= 0) {
      return { ok: false, error: "area_required", hint: "外壁面積（㎡）または 坪 を指定してください。" };
    }

    const paintedArea = wallSqm * coats;
    const withLoss = paintedArea * (1 + lossPct / 100);
    const toolResult = getMaterialToolCalculate()(withLoss, coverage);
    const unitPrice = Number(slots?.unitPrice);
    const materialCost = Number.isFinite(unitPrice) ? toolResult.quantity * unitPrice : NaN;

    const lines = [
      "【計算結果 — 外壁塗装チェーン（Builder ツール）】",
      !Number.isNaN(tsubo) ? `入力: ${fmtNum(tsubo, 2)} 坪 → 外壁面積目安 ${fmtNum(wallSqm, 2)} ㎡` : `外壁面積: ${fmtNum(wallSqm, 2)} ㎡`,
      `塗装回数: ${coats} 回 / 材料: ${materialType}`,
      `塗布面積（回数込）: ${fmtNum(paintedArea, 2)} ㎡`,
      `ロス率: ${fmtPct(lossPct)} → ロス込面積: ${fmtNum(withLoss, 2)} ㎡`,
      `必要 ${toolResult.quantity} 缶（1缶 ${fmtNum(coverage, 2)} ㎡ 想定 · 切り上げ）`,
    ];
    if (Number.isFinite(materialCost)) lines.push(`概算材料費: ${fmtYen(materialCost)}（単価 ${fmtYen(unitPrice)}/缶）`);
    lines.push("", "【確認ポイント】", "- 足場 · 高圧洗浄 · 下地補修 · 養生は別途", "- 実際の塗布可能面積は製品仕様で確認", "", DISCLAIMER);

    return {
      ok: true,
      actionId: "paint_cross_calc",
      chainId: "exterior_paint",
      draftBody: lines.join("\n"),
      result: { wallSqm, coats, lossPct, withLoss, cans: toolResult.quantity, coverage, materialCost },
    };
  }

  function runTargetProfitChain(slots) {
    const targetRate = Number(slots?.targetRate);
    const cost = Number(slots?.cost);
    const estimate = Number(slots?.estimate);

    if (!Number.isFinite(targetRate) || targetRate <= 0 || targetRate >= 100) {
      return { ok: false, error: "target_rate_required", hint: "目標利益率（例: 25%）を指定してください。" };
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      return { ok: false, error: "cost_required", hint: "原価（例: 原価 800000）を一緒に入力してください。" };
    }

    const margin = targetRate / 100;
    const requiredEstimate = Math.round(cost / (1 - margin));
    const gross = requiredEstimate - cost;
    const grossRate = requiredEstimate > 0 ? (gross / requiredEstimate) * 100 : 0;

    const body = [
      "【計算結果 — 目標利益率からの見積目安】",
      `原価: ${fmtYen(cost)}`,
      `目標利益率: ${fmtPct(targetRate)}`,
      `必要見積目安: ${fmtYen(requiredEstimate)}`,
      `粗利益: ${fmtYen(gross)} / 粗利率: ${fmtPct(grossRate)}`,
      Number.isFinite(estimate) && estimate > 0 ? `入力見積との差: ${fmtYen(estimate - requiredEstimate)}` : "",
      "",
      "※逆算の参考値です。採用・契約確定ではありません。",
      DISCLAIMER,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ok: true,
      actionId: "estimate_profit_calc",
      chainId: "target_profit",
      draftBody: body,
      result: { cost, targetRate, requiredEstimate, gross, grossRate },
    };
  }

  function runDirectAction(actionId, normalizedText) {
    const Calc = getCalc();
    if (!Calc?.run) return { ok: false, error: "calc_missing" };
    const r = Calc.run(actionId, normalizedText);
    if (!r.ok) return r;
    return { ok: true, actionId, draftBody: r.draftBody, result: r.result };
  }

  function executeIntent(intent) {
    if (intent.kind === "chain") {
      if (intent.chainId === "exterior_paint") return runExteriorPaintChain(intent.slots);
      if (intent.chainId === "material_units") return runMaterialUnits(intent.slots);
      if (intent.chainId === "target_profit") return runTargetProfitChain(intent.slots);
      return { ok: false, error: "unknown_chain" };
    }
    if (intent.kind === "action" && intent.actionId) {
      return runDirectAction(intent.actionId, intent.normalizedText || "");
    }
    return { ok: false, error: "no_intent" };
  }

  function buildSummary(userText, calcResult) {
    const intro = `ご質問「${String(userText || "").slice(0, 80)}」について、Builder 内部計算ツールで算出しました。`;
    return `${intro}\n\n${calcResult.draftBody}`;
  }

  /**
   * @param {{
   *   userText?: string,
   *   actor?: object,
   *   preferRemote?: boolean,
   *   summarize?: boolean,
   * }} params
   */
  async function runFromNaturalLanguage(params) {
    const userText = String(params?.userText || "").trim();
    const Intent = getIntent();
    if (!Intent?.detect) return { ok: false, error: "intent_missing", reply: "" };

    const intent = Intent.detect(userText);
    if (intent.kind === "none") return { ok: false, error: "not_calc", reply: "" };

    const calcResult = executeIntent(intent);
    if (!calcResult.ok) {
      const hint = calcResult.hint || "計算に必要な数値（面積 · 原価 · 金額 等）を追記してください。";
      return { ok: false, error: calcResult.error || "calc_failed", reply: hint };
    }

    const summary = buildSummary(userText, calcResult);
    const Core = global.TasuBuilderAICore;

    if (params?.summarize !== false && Core?.runAction && params?.preferRemote !== false) {
      const actionId = calcResult.actionId || "faq_answer";
      const enriched = await Core.runAction({
        action: actionId,
        userText,
        actor: params?.actor,
        toolContext: JSON.stringify(calcResult.result || {}),
        precalc: { draftBody: calcResult.draftBody },
        preferRemote: params?.preferRemote,
      });
      if (enriched?.draft) {
        return {
          ok: true,
          reply: String(enriched.draft).replace(/^【下書き・確認用】\s*/u, "").trim(),
          actionId,
          usedCalc: true,
          usedRemote: enriched.usedRemote,
          fallback_used: enriched.fallback_used,
          chainId: calcResult.chainId || "",
        };
      }
    }

    return {
      ok: true,
      reply: summary,
      actionId: calcResult.actionId,
      usedCalc: true,
      usedRemote: false,
      chainId: calcResult.chainId || "",
    };
  }

  global.TasuBuilderAICalcOrchestrator = {
    isCalcQuery,
    runFromNaturalLanguage,
    executeIntent,
    runExteriorPaintChain,
    runMaterialUnits,
    runTargetProfitChain,
  };
})(typeof window !== "undefined" ? window : globalThis);
