/**
 * Builder AI — deterministic 計算（業務ツール統合）
 */
(function (global) {
  "use strict";

  const CALC_ACTION_IDS = Object.freeze([
    "invoice_tax_calc",
    "estimate_profit_calc",
    "labor_cost_calc",
    "schedule_calc",
    "area_unit_calc",
    "paint_cross_calc",
    "material_quantity_calc",
  ]);

  function parseNum(raw) {
    if (raw === null || raw === undefined || raw === "") return NaN;
    const n = Number(String(raw).replace(/[,，]/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function pick(text, patterns) {
    const t = String(text || "");
    for (const p of patterns) {
      const m = t.match(p);
      if (m && m[1] !== undefined) return m[1].trim();
    }
    return "";
  }

  function pickNum(text, patterns) {
    const raw = pick(text, patterns);
    return raw ? parseNum(raw) : NaN;
  }

  function roundValue(value, mode) {
    const m = String(mode || "round").toLowerCase();
    if (m === "ceil" || m === "up" || m === "切り上げ") return Math.ceil(value);
    if (m === "floor" || m === "down" || m === "切り捨て") return Math.floor(value);
    return Math.round(value);
  }

  function fmtYen(n) {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);
  }

  function fmtNum(n, digits) {
    return new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  }

  function fmtPct(n) {
    return fmtNum(n, 1) + "%";
  }

  function detectRounding(text) {
    if (/切り上げ|ceil|up/i.test(text)) return "ceil";
    if (/切り捨て|floor|down/i.test(text)) return "floor";
    return "round";
  }

  function detectTaxRate(text) {
    if (/8%|8％|軽減/i.test(text)) return 0.08;
    if (/10%|10％/.test(text)) return 0.1;
    const n = pickNum(text, [/税率[:：\s]*([\d.]+)\s*%/i, /([\d.]+)\s*%\s*税率/i]);
    if (!Number.isNaN(n) && n > 0 && n <= 100) return n / 100;
    return 0.1;
  }

  /** @param {string} text */
  function calcInvoiceTax(text) {
    const rounding = detectRounding(text);
    const rate = detectTaxRate(text);
    const taxInclusive = /税込|込み|inclusive/i.test(text);
    const taxExclusive = /税抜|抜き|exclusive/i.test(text);
    let amount = pickNum(text, [
      /(?:税抜|税込|金額|amount)[:：\s]*([\d,]+)/i,
      /([\d,]+)\s*円/i,
      /^([\d,]+)/,
    ]);
    if (Number.isNaN(amount)) return { ok: false, error: "amount_required" };

    let excl;
    let incl;
    let tax;
    if (taxInclusive && !taxExclusive) {
      incl = amount;
      excl = roundValue(incl / (1 + rate), rounding);
      tax = incl - excl;
    } else {
      excl = amount;
      tax = roundValue(excl * rate, rounding);
      incl = excl + tax;
    }

    const body = [
      "【計算結果 — インボイス・消費税補助】",
      `税抜金額: ${fmtYen(excl)}`,
      `消費税額（${Math.round(rate * 100)}% · ${rounding === "ceil" ? "切り上げ" : rounding === "floor" ? "切り捨て" : "四捨五入"}）: ${fmtYen(tax)}`,
      `税込金額: ${fmtYen(incl)}`,
      "",
      "※正式な請求・インボイス確定ではありません。端数処理・適用税率は運営・経理確認が必要です。",
    ].join("\n");
    return { ok: true, draftBody: body, result: { excl, incl, tax, rate, rounding } };
  }

  function calcEstimateProfit(text) {
    const cost = pickNum(text, [/原価[:：\s]*([\d,]+)/i, /cost[:：\s]*([\d,]+)/i]);
    const estimate = pickNum(text, [/見積(?:金額)?[:：\s]*([\d,]+)/i, /estimate[:：\s]*([\d,]+)/i]);
    const discount = pickNum(text, [/値引(?:き)?(?:率)?[:：\s]*([\d.]+)\s*%?/i]) || 0;
    const discountAmt = pickNum(text, [/値引(?:額)?[:：\s]*([\d,]+)/i]);

    if (Number.isNaN(cost) || Number.isNaN(estimate)) return { ok: false, error: "cost_estimate_required" };

    const gross = estimate - cost;
    const grossRate = estimate > 0 ? (gross / estimate) * 100 : 0;
    const profitRate = cost > 0 ? (gross / cost) * 100 : 0;
    let afterDiscount = estimate;
    if (!Number.isNaN(discountAmt) && discountAmt > 0) afterDiscount = estimate - discountAmt;
    else if (discount > 0) afterDiscount = estimate * (1 - discount / 100);
    const profitAfter = afterDiscount - cost;

    const body = [
      "【計算結果 — 見積・利益補助】",
      `原価: ${fmtYen(cost)}`,
      `見積金額: ${fmtYen(estimate)}`,
      `粗利益: ${fmtYen(gross)}`,
      `粗利益率: ${fmtPct(grossRate)}`,
      `利益率（原価ベース）: ${fmtPct(profitRate)}`,
      discount > 0 || discountAmt > 0
        ? `値引き後見積: ${fmtYen(afterDiscount)} / 値引き後利益: ${fmtYen(profitAfter)}`
        : "",
      "",
      "※採用・契約・請求確定ではありません。",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      draftBody: body,
      result: { cost, estimate, gross, grossRate, profitRate, afterDiscount, profitAfter },
    };
  }

  function calcLaborCost(text) {
    const people = pickNum(text, [/人数[:：\s]*([\d.]+)/i, /([\d.]+)\s*人/i]) || 1;
    const daily = pickNum(text, [/日当[:：\s]*([\d,]+)/i, /daily[:：\s]*([\d,]+)/i]);
    const days = pickNum(text, [/日数[:：\s]*([\d.]+)/i, /([\d.]+)\s*日/i]) || 1;
    const overtime = pickNum(text, [/残業[:：\s]*([\d,]+)/i]) || 0;
    const expense = pickNum(text, [/経費[:：\s]*([\d,]+)/i]) || 0;
    if (Number.isNaN(daily)) return { ok: false, error: "daily_required" };

    const base = people * daily * days;
    const total = base + overtime + expense;
    const body = [
      "【計算結果 — 人件費補助】",
      `人数: ${fmtNum(people, 0)} 人 / 日当: ${fmtYen(daily)} / 日数: ${fmtNum(days, 1)} 日`,
      `基本人件費: ${fmtYen(base)}`,
      `残業: ${fmtYen(overtime)} / 経費: ${fmtYen(expense)}`,
      `合計: ${fmtYen(total)}`,
      "",
      "※正式な労務費確定・支払指示ではありません。",
    ].join("\n");
    return { ok: true, draftBody: body, result: { people, daily, days, overtime, expense, base, total } };
  }

  function parseIsoDate(s) {
    const m = String(s || "").match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function calcSchedule(text) {
    const startRaw = pick(text, [/開始(?:日)?[:：\s]*([\d./-]+)/i, /from[:：\s]*([\d./-]+)/i]);
    const endRaw = pick(text, [/終了(?:日)?[:：\s]*([\d./-]+)/i, /to[:：\s]*([\d./-]+)/i]);
    const start = parseIsoDate(startRaw);
    const end = parseIsoDate(endRaw);
    if (!start || !end || end < start) return { ok: false, error: "dates_required" };

    const excludeWeekends = !/土日含|weekend\s*include/i.test(text);
    let workDays = 0;
    let calendarDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      calendarDays += 1;
      const dow = cur.getDay();
      if (!excludeWeekends || (dow !== 0 && dow !== 6)) workDays += 1;
      cur.setDate(cur.getDate() + 1);
    }

    const body = [
      "【計算結果 — 工期補助】",
      `開始日: ${startRaw} / 終了日: ${endRaw}`,
      `暦日数: ${calendarDays} 日`,
      `稼働日数${excludeWeekends ? "（土日除外）" : ""}: ${workDays} 日`,
      "",
      "※祝日除外は将来対応予定です。確定工期ではありません。",
    ].join("\n");
    return { ok: true, draftBody: body, result: { start: startRaw, end: endRaw, calendarDays, workDays, excludeWeekends } };
  }

  function calcAreaUnit(text) {
    const val = pickNum(text, [/([\d.]+)\s*(?:㎡|m2|平方メートル)/i, /([\d.]+)\s*坪/i, /([\d.]+)\s*畳/i, /^([\d.]+)/]);
    if (Number.isNaN(val)) return { ok: false, error: "value_required" };

    const TSUBO = 3.305785;
    const TATAMI = 1.62;
    let lines = ["【計算結果 — 面積・単位変換】"];

    if (/坪/i.test(text)) {
      lines.push(`${fmtNum(val, 2)} 坪 = ${fmtNum(val * TSUBO, 2)} ㎡ = ${fmtNum((val * TSUBO) / TATAMI, 2)} 畳`);
    } else if (/畳/i.test(text)) {
      lines.push(`${fmtNum(val, 2)} 畳 = ${fmtNum(val * TATAMI, 2)} ㎡ = ${fmtNum((val * TATAMI) / TSUBO, 2)} 坪`);
    } else if (/mm|cm|m|km/i.test(text)) {
      const from = pick(text, [/([\d.]+)\s*(mm|cm|m|km)/i]);
      const m = from.match(/([\d.]+)\s*(mm|cm|m|km)/i);
      if (m) {
        const n = parseNum(m[1]);
        const u = m[2].toLowerCase();
        const toM = u === "mm" ? n / 1000 : u === "cm" ? n / 100 : u === "km" ? n * 1000 : n;
        lines.push(
          `${fmtNum(n, 4)} ${u} = ${fmtNum(toM * 1000, 2)} mm = ${fmtNum(toM * 100, 2)} cm = ${fmtNum(toM, 4)} m = ${fmtNum(toM / 1000, 6)} km`
        );
      }
    } else {
      lines.push(`${fmtNum(val, 2)} ㎡ = ${fmtNum(val / TSUBO, 2)} 坪 = ${fmtNum(val / TATAMI, 2)} 畳`);
    }
    lines.push("", "※現場実測・設計値との照合が必要です。");
    return { ok: true, draftBody: lines.join("\n"), result: { value: val } };
  }

  function calcPaintCross(text) {
    const wall = pickNum(text, [/壁(?:面積)?[:：\s]*([\d.]+)/i]) || 0;
    const ceiling = pickNum(text, [/天井(?:面積)?[:：\s]*([\d.]+)/i]) || 0;
    const openings = pickNum(text, [/開口(?:部)?(?:控除)?[:：\s]*([\d.]+)/i]) || 0;
    const lossPct = pickNum(text, [/ロス(?:率)?[:：\s]*([\d.]+)\s*%?/i]) || 10;
    const gross = Math.max(0, wall + ceiling - openings);
    const qty = gross * (1 + lossPct / 100);

    if (gross <= 0) return { ok: false, error: "area_required" };

    const body = [
      "【計算結果 — 塗装・クロス数量補助】",
      `壁面積: ${fmtNum(wall, 2)} ㎡ / 天井: ${fmtNum(ceiling, 2)} ㎡ / 開口控除: ${fmtNum(openings, 2)} ㎡`,
      `有効面積: ${fmtNum(gross, 2)} ㎡`,
      `ロス率: ${fmtPct(lossPct)} → 必要数量（目安）: ${fmtNum(qty, 2)} ㎡`,
      "",
      "※製品規格・施工条件により変動します。正式発注数量ではありません。",
    ].join("\n");
    return { ok: true, draftBody: body, result: { wall, ceiling, openings, lossPct, gross, qty } };
  }

  function calcMaterialQuantity(text) {
    const qty = pickNum(text, [/数量[:：\s]*([\d.]+)/i, /材料(?:数量)?[:：\s]*([\d.]+)/i, /^([\d.]+)/]);
    const lossPct = pickNum(text, [/ロス(?:率)?[:：\s]*([\d.]+)\s*%?/i]) || 10;
    const spare = pickNum(text, [/予備(?:数量)?[:：\s]*([\d.]+)/i]) || 0;
    const unitPrice = pickNum(text, [/単価[:：\s]*([\d,]+)/i]);
    const laborRef = pickNum(text, [/人工[:：\s]*([\d.]+)/i, /必要人工[:：\s]*([\d.]+)/i]);

    if (Number.isNaN(qty) || qty <= 0) return { ok: false, error: "quantity_required" };

    const withLoss = qty * (1 + lossPct / 100);
    const totalQty = withLoss + spare;
    const materialCost = Number.isFinite(unitPrice) ? totalQty * unitPrice : NaN;

    const body = [
      "【計算結果 — 材料数量概算】",
      `基本数量: ${fmtNum(qty, 2)}`,
      `ロス率: ${fmtPct(lossPct)} → ロス込: ${fmtNum(withLoss, 2)}`,
      spare > 0 ? `予備数量: ${fmtNum(spare, 2)} → 発注目安: ${fmtNum(totalQty, 2)}` : `発注目安: ${fmtNum(totalQty, 2)}`,
      Number.isFinite(unitPrice) ? `単価: ${fmtYen(unitPrice)} → 概算材料費: ${fmtYen(materialCost)}` : "単価: （未入力）",
      Number.isFinite(laborRef) ? `必要人工（参考）: ${fmtNum(laborRef, 1)} 人工` : "",
      "",
      "※概算です。現場寸法・仕様確認後、発注前に人間確認が必要です。",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      draftBody: body,
      result: { qty, lossPct, spare, totalQty, unitPrice, materialCost, laborRef },
    };
  }

  const RUNNERS = Object.freeze({
    invoice_tax_calc: calcInvoiceTax,
    estimate_profit_calc: calcEstimateProfit,
    labor_cost_calc: calcLaborCost,
    schedule_calc: calcSchedule,
    area_unit_calc: calcAreaUnit,
    paint_cross_calc: calcPaintCross,
    material_quantity_calc: calcMaterialQuantity,
  });

  /**
   * @param {string} actionId
   * @param {string} userText
   */
  function run(actionId, userText) {
    const fn = RUNNERS[actionId];
    if (!fn) return { ok: false, error: "unknown_calc" };
    return fn(String(userText || ""));
  }

  function isCalcAction(actionId) {
    return CALC_ACTION_IDS.includes(actionId);
  }

  global.TasuBuilderAICalculators = {
    CALC_ACTION_IDS,
    RUNNERS,
    run,
    isCalcAction,
    roundValue,
    fmtYen,
    fmtPct,
  };
})(typeof window !== "undefined" ? window : globalThis);
