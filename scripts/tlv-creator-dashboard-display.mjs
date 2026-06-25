/**
 * TLV Creator Dashboard — 月次還元表示（表示専用・再計算禁止）
 * 正本: creator-rank-explanation.json
 */
import fs from "node:fs";
import path from "node:path";

export const CREATOR_RANK_EXPLANATION_RELATIVE =
  "reports/tlv-business-simulator/output/creator-rank-explanation.json";

export const LIVE_CREATOR_RANK_EXPLANATION_RELATIVE =
  "live/data/creator-rank-explanation.json";

export const LIVE_PAYOUT_CREATOR_MAP_RELATIVE = "live/data/tlv-payout-creator-map.json";

/** Dashboard 還元パネルで禁止するソースパターン */
export const FORBIDDEN_PAYOUT_DISPLAY_PATTERNS = [
  /\bgross_revenue\s*\*/,
  /\*\s*applied_rate\b/,
  /\bapplied_rate\s*\*/,
  /Math\.round\s*\(/,
  /\*\s*100\s*\)/,
  /\/\s*100\b/,
  /\bgrossTimesRate/i,
  /\bestimateRevenue/i,
];

/**
 * 整数円の表示のみ（計算・丸め変更なし）
 * @param {number} yen
 */
export function formatConfirmedYenDisplay(yen) {
  if (!Number.isInteger(yen) || yen < 0) {
    throw new Error(`formatConfirmedYenDisplay requires non-negative integer yen, got ${yen}`);
  }
  return `¥${yen.toLocaleString("ja-JP")}`;
}

/**
 * @param {string} value
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} report — creator-rank-explanation.json
 * @param {object} options
 */
export function resolveCreatorRecord(report, options = {}) {
  const creators = report?.creators ?? [];
  if (!creators.length) return null;

  const queryParam = options.queryParam ?? "payoutCreator";
  const fromQuery = options.searchParams?.get?.(queryParam)?.trim();
  if (fromQuery) {
    return creators.find((c) => c.creator_id === fromQuery) ?? null;
  }

  const explicitId = options.creatorId?.trim();
  if (explicitId) {
    return creators.find((c) => c.creator_id === explicitId) ?? null;
  }

  const talkUserId = options.talkUserId?.trim();
  const map = options.creatorMap ?? {};
  const mappedId = talkUserId && map.by_talk_user_id?.[talkUserId];
  if (mappedId) {
    return creators.find((c) => c.creator_id === mappedId) ?? null;
  }

  const fallbackId = map.default_creator_id;
  if (fallbackId) {
    return creators.find((c) => c.creator_id === fallbackId) ?? null;
  }

  return null;
}

/**
 * @param {object} creator — creator-rank-explanation.json creators[]
 * @param {object} [meta]
 */
export function renderCreatorPayoutPanelHtml(creator, meta = {}) {
  if (creator?.payout_amount_yen == null) {
    throw new Error("creator.payout_amount_yen is required");
  }
  if (!Number.isInteger(creator.payout_amount_yen)) {
    throw new Error(`creator.payout_amount_yen must be integer, got ${creator.payout_amount_yen}`);
  }

  const month = meta.month ?? creator.next_month ?? "";
  const reportMonth = meta.reportMonth ?? "";
  const guaranteeLabel = creator.guarantee_applied ? "適用" : "なし";
  const payoutYen = creator.payout_amount_yen;
  const grossYen = creator.gross_revenue;
  const appliedRate = creator.applied_rate;

  return `
    <section
      class="tlv-creator-payout"
      data-tlv-creator-payout
      data-tlv-payout-display-only="true"
      data-creator-id="${escapeHtml(creator.creator_id)}"
      data-confirmed-payout-field="payout_amount_yen"
      data-payout-amount-yen="${payoutYen}"
      data-gross-revenue-yen="${grossYen}"
      data-applied-rate="${escapeHtml(String(appliedRate))}"
      aria-labelledby="tlv-creator-payout-heading"
    >
      <header class="tlv-creator-payout__head">
        <h2 class="tlv-creator-payout__title" id="tlv-creator-payout-heading">月次支払（確定値）</h2>
        <p class="tlv-creator-payout__meta">
          対象月 <strong>${escapeHtml(reportMonth || month)}</strong>
          · <code>payout_amount_yen</code> 表示専用（再計算なし）
        </p>
      </header>
      <p class="tlv-creator-payout__notice">
        支払確定値 <code>payout_amount_yen</code> は <code>monthly-payout-decision.json</code> と一致します。
        説明文は <code>creator-rank-explanation.json</code> をそのまま表示します。Dashboard では <code>gross_revenue × applied_rate</code> をしません。
      </p>
      <dl class="tlv-creator-payout__facts">
        <div class="tlv-creator-payout__fact">
          <dt>ランク</dt>
          <dd data-display-field="rank">${escapeHtml(creator.rank)}</dd>
        </div>
        <div class="tlv-creator-payout__fact">
          <dt>ランク表示</dt>
          <dd>${escapeHtml(creator.rank_display ?? creator.rank)}</dd>
        </div>
        <div class="tlv-creator-payout__fact">
          <dt>対象収益</dt>
          <dd data-display-field="gross_revenue">${escapeHtml(formatConfirmedYenDisplay(grossYen))}</dd>
        </div>
        <div class="tlv-creator-payout__fact">
          <dt>適用率</dt>
          <dd data-display-field="applied_rate">${escapeHtml(String(appliedRate))}%</dd>
        </div>
        <div class="tlv-creator-payout__fact tlv-creator-payout__fact--highlight">
          <dt>支払確定額 <span class="tlv-creator-payout__field-id">payout_amount_yen</span></dt>
          <dd data-display-field="payout_amount_yen">${escapeHtml(formatConfirmedYenDisplay(payoutYen))}</dd>
        </div>
        <div class="tlv-creator-payout__fact">
          <dt>保証適用</dt>
          <dd data-display-field="guarantee_applied">${escapeHtml(guaranteeLabel)}</dd>
        </div>
      </dl>
      <div class="tlv-creator-payout__texts">
        <article class="tlv-creator-payout__text-block">
          <h3 class="tlv-creator-payout__text-title">ランク説明</h3>
          <p data-display-field="rank_explanation">${escapeHtml(creator.rank_explanation ?? "")}</p>
        </article>
        <article class="tlv-creator-payout__text-block">
          <h3 class="tlv-creator-payout__text-title">還元説明</h3>
          <p data-display-field="payout_explanation">${escapeHtml(creator.payout_explanation ?? "")}</p>
        </article>
        <article class="tlv-creator-payout__text-block">
          <h3 class="tlv-creator-payout__text-title">調整理由</h3>
          <p data-display-field="adjustment_explanation">${escapeHtml(creator.adjustment_explanation ?? "")}</p>
        </article>
        <article class="tlv-creator-payout__text-block">
          <h3 class="tlv-creator-payout__text-title">次月ガイダンス</h3>
          <p data-display-field="next_month_guidance">${escapeHtml(creator.next_month_guidance ?? "")}</p>
        </article>
        <article class="tlv-creator-payout__text-block tlv-creator-payout__text-block--notice">
          <h3 class="tlv-creator-payout__text-title">支払予定</h3>
          <p data-display-field="payment_notice">${escapeHtml(creator.payment_notice ?? "")}</p>
        </article>
      </div>
    </section>
  `.trim();
}

/**
 * @param {string} source
 */
export function auditPayoutDisplaySource(source) {
  const hits = [];
  for (const pattern of FORBIDDEN_PAYOUT_DISPLAY_PATTERNS) {
    if (pattern.test(source)) {
      hits.push(pattern.toString());
    }
  }
  return {
    no_payout_recalculation_logic: hits.length === 0,
    forbidden_pattern_hits: hits,
  };
}

/**
 * @param {object} creator
 * @param {string} html
 */
export function verifyRenderedPayoutPanel(creator, html) {
  const payoutYen = creator.payout_amount_yen;
  const grossYen = creator.gross_revenue;
  const appliedRate = String(creator.applied_rate);

  const amountAttr = `data-payout-amount-yen="${payoutYen}"`;
  const grossAttr = `data-gross-revenue-yen="${grossYen}"`;
  const rateAttr = `data-applied-rate="${appliedRate}"`;

  const displayYen = formatConfirmedYenDisplay(payoutYen);
  const displayGross = formatConfirmedYenDisplay(grossYen);

  return {
    panel_has_confirmed_amount_attr: html.includes(amountAttr),
    panel_has_gross_attr: html.includes(grossAttr),
    panel_has_applied_rate_attr: html.includes(rateAttr),
    displays_payout_amount_yen: html.includes(displayYen),
    displays_gross_revenue: html.includes(displayGross),
    displays_applied_rate: html.includes(`${appliedRate}%`),
    displays_rank: html.includes(escapeHtml(creator.rank)),
    displays_rank_explanation: html.includes(escapeHtml(creator.rank_explanation ?? "")),
    displays_payout_explanation: html.includes(escapeHtml(creator.payout_explanation ?? "")),
    displays_adjustment_explanation: html.includes(escapeHtml(creator.adjustment_explanation ?? "")),
    displays_next_month_guidance: html.includes(escapeHtml(creator.next_month_guidance ?? "")),
    displays_payment_notice: html.includes(escapeHtml(creator.payment_notice ?? "")),
    dashboard_display_equals_payout_amount_yen:
      html.includes(amountAttr) && html.includes(displayYen) && payoutYen === creator.payout_amount_yen,
    amounts_match_json:
      html.includes(amountAttr) &&
      html.includes(grossAttr) &&
      html.includes(displayYen) &&
      payoutYen === creator.payout_amount_yen,
    yen_integrity:
      Number.isInteger(creator.payout_amount_yen) &&
      creator.payout_amount_yen === (creator.payout_amount ?? creator.payout_amount_yen),
  };
}

/**
 * @param {object} explanation — creator-rank-explanation.json
 * @param {object} decision — monthly-payout-decision.json
 */
export function verifyExplanationMatchesDecision(explanation, decision) {
  const decisionById = new Map(
    (decision?.creators ?? []).map((c) => [c.creator_id, c])
  );

  const perCreator = (explanation?.creators ?? []).map((ex) => {
    const dec = decisionById.get(ex.creator_id);
    if (!dec) {
      return { creator_id: ex.creator_id, found_in_decision: false, payout_amount_yen_match: false };
    }
    return {
      creator_id: ex.creator_id,
      found_in_decision: true,
      explanation_payout_amount_yen: ex.payout_amount_yen,
      decision_payout_amount_yen: dec.payout_amount_yen,
      payout_amount_yen_match: ex.payout_amount_yen === dec.payout_amount_yen,
      gross_revenue_match: ex.gross_revenue === dec.gross_revenue,
      applied_rate_match: ex.applied_rate === dec.applied_rate,
    };
  });

  const allMatch = perCreator.every(
    (c) => c.found_in_decision && c.payout_amount_yen_match
  );

  return {
    per_creator: perCreator,
    payout_amount_yen_matches_monthly_decision: allMatch,
  };
}

/**
 * @param {object} ctx
 */
export function runCreatorDashboardDisplayValidations(ctx) {
  const {
    report,
    decision,
    payoutDisplaySource,
    dashboardSource,
    dashboardHtmlSource = "",
    creatorMap,
  } = ctx;

  const sourceAudit = auditPayoutDisplaySource(payoutDisplaySource);

  const dashboard_integrated =
    /tlv-creator-payout-display\.js/.test(dashboardHtmlSource) &&
    /TasuTlvCreatorPayoutDisplay/.test(dashboardSource) &&
    /fetchAndRenderPayoutPanel/.test(dashboardSource);

  const perCreator = (report.creators ?? []).map((creator) => {
    const html = renderCreatorPayoutPanelHtml(creator, { reportMonth: report.month });
    const checks = verifyRenderedPayoutPanel(creator, html);
    const allCreatorPass = Object.values(checks).every(Boolean);
    return { creator_id: creator.creator_id, checks, all_pass: allCreatorPass };
  });

  const allCreatorsPass = perCreator.every((c) => c.all_pass);
  const allHavePayoutYen = (report.creators ?? []).every(
    (c) => Number.isInteger(c.payout_amount_yen) && c.payout_amount_yen >= 0
  );

  const resolvedSample = resolveCreatorRecord(report, {
    creatorMap,
    talkUserId: "u_me",
  });
  const resolveWorks = resolvedSample != null && resolvedSample.creator_id === "cr_001";

  const decisionIntegrity = decision
    ? verifyExplanationMatchesDecision(report, decision)
    : { payout_amount_yen_matches_monthly_decision: false, per_creator: [] };

  const allPass =
    sourceAudit.no_payout_recalculation_logic &&
    allCreatorsPass &&
    allHavePayoutYen &&
    resolveWorks &&
    dashboard_integrated &&
    decisionIntegrity.payout_amount_yen_matches_monthly_decision;

  return {
    no_payout_recalculation_in_display_module: sourceAudit.no_payout_recalculation_logic,
    forbidden_pattern_hits: sourceAudit.forbidden_pattern_hits,
    dashboard_uses_payout_display_module: dashboard_integrated,
    dashboard_display_equals_payout_amount_yen: allCreatorsPass,
    all_creators_render_match_json: allCreatorsPass,
    payout_amount_yen_integer_for_all: allHavePayoutYen,
    payout_amount_yen_matches_monthly_decision:
      decisionIntegrity.payout_amount_yen_matches_monthly_decision,
    creator_resolve_sample_u_me: resolveWorks,
    decision_integrity: decisionIntegrity,
    per_creator: perCreator,
    all_pass: allPass,
  };
}

/**
 * @param {string} root
 */
export function loadCreatorRankExplanationForValidation(root) {
  const livePath = path.join(root, LIVE_CREATOR_RANK_EXPLANATION_RELATIVE);
  const outputPath = path.join(root, CREATOR_RANK_EXPLANATION_RELATIVE);
  const jsonPath = fs.existsSync(livePath) ? livePath : outputPath;
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`creator-rank-explanation.json not found at ${jsonPath}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

/**
 * @param {string} root
 */
export function loadCreatorMapForValidation(root) {
  const mapPath = path.join(root, LIVE_PAYOUT_CREATOR_MAP_RELATIVE);
  if (!fs.existsSync(mapPath)) return { default_creator_id: "cr_001", by_talk_user_id: { u_me: "cr_001" } };
  return JSON.parse(fs.readFileSync(mapPath, "utf8"));
}

const MONTHLY_DECISION_RELATIVE =
  "reports/tlv-business-simulator/output/monthly-payout-decision.json";

/**
 * @param {string} root
 */
export function loadMonthlyPayoutDecisionForValidation(root) {
  const decisionPath = path.join(root, MONTHLY_DECISION_RELATIVE);
  if (!fs.existsSync(decisionPath)) {
    throw new Error(`monthly-payout-decision.json not found at ${decisionPath}`);
  }
  return JSON.parse(fs.readFileSync(decisionPath, "utf8"));
}
