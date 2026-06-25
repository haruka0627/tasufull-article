/**
 * TLV 公開説明ページ（payout-policy.html）— コンテンツ検証ルール
 */

export const PAYOUT_POLICY_HTML_RELATIVE = "live/payout-policy.html";

export const REQUIRED_PHRASES = [
  "payout_amount_yen",
  "支払確定",
  "固定還元率ではない",
  "固定還元率のプラットフォームではありません",
  "payment_fee",
  "platform_cost",
  "cdn_storage_live_cost",
  "reserve_amount",
  "minimum_company_profit",
  "operational_margin",
  "payout_pool",
  "条件ライン",
  "Safety",
  "AIが勝手に",
  "creator-dashboard.html",
];

export const DEDUCTION_ORDER = [
  "total_revenue",
  "payment_fee",
  "platform_cost",
  "cdn_storage_live_cost",
  "reserve_amount",
  "minimum_company_profit",
  "operational_margin",
  "payout_pool",
];

export const FORBIDDEN_PHRASES = [
  /売上から直接.{0,12}%還元/,
  /売上の\d+%を還元/,
  /常に\d+%還元/,
  /固定還元率です/,
  /全員同じ還元率です/,
  /gross_revenue\s*×\s*applied_rate\s*が支払(?:額)?です(?!か)/,
  /gross_revenue\s*×\s*applied_rate\s*で支払(?:額)?が決ま/,
  /AIが還元率を変更します/,
  /AIが自動的に還元率を変更/,
  /AIが還元率を書き換えます/,
  /Math\.round\s*\(/,
  /Math\.floor\s*\(/,
  /Math\.ceil\s*\(/,
];

export const FORBIDDEN_PAYMENT_MISLEAD = [
  {
    pattern: /gross_revenue\s*×\s*applied_rate/,
    allowIfAlsoMatches: /いいえ|再計算しません|参考表示|説明・参考/,
  },
];

/**
 * @param {string} html
 */
export function validatePayoutPolicyContent(html) {
  const missingRequired = REQUIRED_PHRASES.filter((p) => !html.includes(p));

  const forbiddenHits = [];
  for (const pattern of FORBIDDEN_PHRASES) {
    if (pattern.test(html)) forbiddenHits.push(pattern.toString());
  }

  for (const rule of FORBIDDEN_PAYMENT_MISLEAD) {
    if (rule.pattern.test(html) && !rule.allowIfAlsoMatches.test(html)) {
      forbiddenHits.push(`misleading without disclaimer: ${rule.pattern}`);
    }
  }

  const orderIndex = DEDUCTION_ORDER.map((label) => html.indexOf(label));
  const deductionOrderCorrect =
    orderIndex.every((i) => i >= 0) &&
    orderIndex.every((val, i) => i === 0 || val > orderIndex[i - 1]);

  const payoutAmountYenIsFinal =
    html.includes('data-confirmed-payout-field="payout_amount_yen"') &&
    html.includes("支払確定値") &&
    html.includes("payout_amount_yen");

  const noPaymentFromGrossTimesRate =
    html.includes("いいえ") &&
    html.includes("gross_revenue × applied_rate") &&
    html.includes("支払確定額は");

  const aiDoesNotChangeRates =
    html.includes("AIが勝手に") &&
    (html.includes("還元率を書き換えることはありません") ||
      html.includes("AIが勝手に変更するものでもありません"));

  const noRecalcJs =
    !/<script[^>]+src=/.test(html) || !/tlv-payout|payout-engine|generate-/.test(html);

  const hasViewport = html.includes('name="viewport"');
  const hasResponsiveHooks =
    html.includes("tlv-payout-policy") && html.includes("data-page=\"live-payout-policy\"");

  const hasCreatorDashboardLink = html.includes('href="creator-dashboard.html"');

  const allPass =
    missingRequired.length === 0 &&
    forbiddenHits.length === 0 &&
    deductionOrderCorrect &&
    payoutAmountYenIsFinal &&
    noPaymentFromGrossTimesRate &&
    aiDoesNotChangeRates &&
    noRecalcJs &&
    hasViewport &&
    hasResponsiveHooks &&
    hasCreatorDashboardLink;

  return {
    required_phrases_present: missingRequired.length === 0,
    missing_required_phrases: missingRequired,
    no_forbidden_phrases: forbiddenHits.length === 0,
    forbidden_phrase_hits: forbiddenHits,
    deduction_order_correct: deductionOrderCorrect,
    payout_amount_yen_documented_as_final: payoutAmountYenIsFinal,
    gross_times_rate_not_payment_explanation: noPaymentFromGrossTimesRate,
    ai_does_not_change_rates_documented: aiDoesNotChangeRates,
    no_payout_calculation_js: noRecalcJs,
    viewport_meta_present: hasViewport,
    responsive_page_structure: hasResponsiveHooks,
    creator_dashboard_link_present: hasCreatorDashboardLink,
    all_pass: allPass,
  };
}

/**
 * @param {string} css
 */
export function validatePayoutPolicyStyles(css) {
  const hasBase = css.includes(".tlv-payout-policy");
  const hasTablet = /@media[^{]*\(max-width:\s*768px\)/.test(css);
  const hasMobile = /@media[^{]*\(max-width:\s*390px\)/.test(css);

  return {
    payout_policy_styles_present: hasBase,
    responsive_768: hasTablet,
    responsive_390: hasMobile,
    all_pass: hasBase && hasTablet && hasMobile,
  };
}
