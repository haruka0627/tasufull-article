/**
 * TLV 公開説明ページ（payout-policy.html）— コンテンツ検証ルール
 */

export const PAYOUT_POLICY_HTML_RELATIVE = "live/payout-policy.html";

export const REQUIRED_PHRASES = [
  "TLV_PROGRESSIVE_V1",
  "monthly_settlements.payout_amount_jpy",
  "eligible_net_basis_jpy",
  "revenue_share_brackets",
  "支払確定",
  "月間Eligible Net",
  "最大99%は3,000万円超部分の限界率",
  "Creator 80% / TASFUL 20%",
  "Creator 90% / TASFUL 10%",
  "Creator 95% / TASFUL 5%",
  "Creator 99% / TASFUL 1%",
  "累進合計のみが金額計算SSOT",
  "限界率・実効率は表示／監査値",
  "AIがBracket、対象控除、支払額を書き換えることはありません",
  "creator-dashboard.html",
];

export const PROGRESSIVE_ORDER = [
  "eligible_net_basis_jpy",
  "first 5,000,000",
  "next 5,000,000",
  "next 20,000,000",
  "above 30,000,000",
  "revenue_share_brackets",
  "payout_amount_jpy",
];

export const FORBIDDEN_PHRASES = [
  /5,?000,?000.{0,30}全額.{0,20}90%/,
  /10,?000,?000.{0,30}全額.{0,20}95%/,
  /Rank.{0,20}(支払|還元率|適用率)/,
  /payout_pool/,
  /payout_amount_yen/,
  /gross_revenue\s*×\s*applied_rate/,
  /Math\.round\s*\(/,
  /Math\.floor\s*\(/,
  /Math\.ceil\s*\(/,
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

  const progressiveFlow = html.match(
    /<ol[^>]+data-revenue-share-model="TLV_PROGRESSIVE_V1"[^>]*>[\s\S]*?<\/ol>/
  )?.[0] ?? "";
  const orderIndex = PROGRESSIVE_ORDER.map((label) => progressiveFlow.indexOf(label));
  const progressiveOrderCorrect =
    orderIndex.every((i) => i >= 0) &&
    orderIndex.every((val, i) => i === 0 || val > orderIndex[i - 1]);

  const persistedPayoutAmountIsFinal =
    html.includes('data-confirmed-payout-field="payout_amount_jpy"') &&
    html.includes("支払確定値") &&
    html.includes("monthly_settlements.payout_amount_jpy");

  const noPaymentFromDisplayRate =
    html.includes("Eligible Net × 限界率または実効率") &&
    html.includes("表示率から再計算しません");

  const aiDoesNotChangeFinancialContract =
    html.includes("AIがBracket、対象控除、支払額を書き換えることはありません");

  const noRecalcJs =
    !/<script[^>]+src=/.test(html) || !/tlv-payout|payout-engine|generate-/.test(html);

  const hasViewport = html.includes('name="viewport"');
  const hasResponsiveHooks =
    html.includes("tlv-payout-policy") && html.includes("data-page=\"live-payout-policy\"");

  const hasCreatorDashboardLink = html.includes('href="creator-dashboard.html"');

  const allPass =
    missingRequired.length === 0 &&
    forbiddenHits.length === 0 &&
    progressiveOrderCorrect &&
    persistedPayoutAmountIsFinal &&
    noPaymentFromDisplayRate &&
    aiDoesNotChangeFinancialContract &&
    noRecalcJs &&
    hasViewport &&
    hasResponsiveHooks &&
    hasCreatorDashboardLink;

  return {
    required_phrases_present: missingRequired.length === 0,
    missing_required_phrases: missingRequired,
    no_forbidden_phrases: forbiddenHits.length === 0,
    forbidden_phrase_hits: forbiddenHits,
    progressive_order_correct: progressiveOrderCorrect,
    persisted_payout_amount_documented_as_final: persistedPayoutAmountIsFinal,
    display_rates_not_payment_calculation: noPaymentFromDisplayRate,
    ai_does_not_change_financial_contract: aiDoesNotChangeFinancialContract,
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
