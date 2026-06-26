/**
 * TLV デモ支払いフロー — Connect 口座マップ・payment-history 生成（Stripe API 非使用）
 */
import fs from "node:fs";
import path from "node:path";
import { getConfirmedPayoutYen } from "./tlv-payout-consumers.mjs";
import {
  FORBIDDEN_PAYOUT_RECALC_PATTERNS,
  FORBIDDEN_STRIPE_API_PATTERNS,
} from "./tlv-payout-forbidden-patterns.mjs";

export const LIVE_STRIPE_CONNECT_ACCOUNTS_RELATIVE = "live/data/tlv-stripe-connect-accounts.json";

export const VALID_PAYMENT_STATUSES = new Set(["unpaid", "processing", "completed", "failed"]);

/**
 * @param {string} root
 */
export function loadStripeConnectAccounts(root) {
  const filePath = path.join(root, LIVE_STRIPE_CONNECT_ACCOUNTS_RELATIVE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing demo Connect accounts: ${LIVE_STRIPE_CONNECT_ACCOUNTS_RELATIVE}`);
  }
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(doc.accounts)) {
    throw new Error("tlv-stripe-connect-accounts.json must include accounts[]");
  }
  return doc;
}

/**
 * @param {{ accounts: { creator_id: string, stripe_connect_account_id: string }[] }} stripeAccounts
 * @returns {Record<string, string>}
 */
export function buildStripeAccountMap(stripeAccounts) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const row of stripeAccounts.accounts || []) {
    const id = String(row.creator_id || "").trim();
    const acct = String(row.stripe_connect_account_id || "").trim();
    if (id && acct) map[id] = acct;
  }
  return map;
}

/**
 * @param {object} decision
 * @param {Record<string, string>} stripeAccountByCreatorId
 */
export function buildPaymentHistory(decision, stripeAccountByCreatorId = {}) {
  const month = String(decision?.month || "");
  const payments = (decision?.creators || [])
    .map((creator) => {
      const payoutYen = getConfirmedPayoutYen(creator);
      if (payoutYen <= 0) return null;
      const creatorId = creator.creator_id;
      return {
        creator_id: creatorId,
        display_name: creator.display_name,
        stripe_connect_account_id: stripeAccountByCreatorId[creatorId] || "",
        payout_amount_yen: payoutYen,
        currency: "jpy",
        status: "unpaid",
        month,
        demo_mode: true,
      };
    })
    .filter(Boolean);

  return {
    engine_version: "demo-v1",
    demo_mode: true,
    stripe_api_used: false,
    generated_at: new Date().toISOString(),
    month,
    source_of_truth: "monthly-payout-decision.json",
    payments,
  };
}

/**
 * @param {string} source
 */
export function auditNoPayoutRecalculation(source) {
  const hits = [];
  for (const pattern of FORBIDDEN_PAYOUT_RECALC_PATTERNS) {
    if (pattern.test(source)) hits.push(pattern.toString());
  }
  return hits.length === 0;
}

/**
 * @param {string} source
 */
export function auditNoStripeApi(source) {
  for (const pattern of FORBIDDEN_STRIPE_API_PATTERNS) {
    if (pattern.test(source)) return false;
  }
  return true;
}

/**
 * @param {object} ctx
 */
export function validateDemoPaymentFlow(ctx) {
  const {
    decision,
    csvRows = [],
    paymentHistory,
    stripeAccountMap = {},
    generatorSource = "",
    moduleSource = "",
  } = ctx;

  const decisionById = new Map((decision?.creators || []).map((c) => [c.creator_id, c]));
  const payableCreators = (decision?.creators || []).filter((c) => getConfirmedPayoutYen(c) > 0);

  const no_payout_recalculation_in_generator = auditNoPayoutRecalculation(generatorSource);
  const no_payout_recalculation_in_demo_module = auditNoPayoutRecalculation(moduleSource);
  const demo_mode_no_stripe_api =
    auditNoStripeApi(moduleSource) &&
    paymentHistory?.stripe_api_used === false &&
    !paymentHistory?.payments?.some((p) => p.stripe_api_used === true);

  const all_creators_have_stripe_connect_account_id = payableCreators.every((c) => {
    const acct = stripeAccountMap[c.creator_id];
    return typeof acct === "string" && acct.length > 0;
  });

  const csv_has_stripe_connect_account_id =
    csvRows.length > 0 && csvRows.every((r) => String(r.stripe_connect_account_id || "").length > 0);

  const csv_stripe_ids_match_account_map = csvRows.every(
    (r) => stripeAccountMap[r.creator_id] === r.stripe_connect_account_id
  );

  const csv_payout_amount_yen_matches_decision = csvRows.every((r) => {
    const d = decisionById.get(r.creator_id);
    return d && r.payout_amount_jpy === getConfirmedPayoutYen(d);
  });

  const payment_history_generated =
    Array.isArray(paymentHistory?.payments) && paymentHistory.payments.length === payableCreators.length;

  const payment_history_payout_amount_yen_matches_decision = (paymentHistory?.payments || []).every((p) => {
    const d = decisionById.get(p.creator_id);
    return d && p.payout_amount_yen === getConfirmedPayoutYen(d);
  });

  const payment_history_stripe_ids_match_account_map = (paymentHistory?.payments || []).every(
    (p) => stripeAccountMap[p.creator_id] === p.stripe_connect_account_id
  );

  const payment_history_statuses_valid = (paymentHistory?.payments || []).every((p) =>
    VALID_PAYMENT_STATUSES.has(String(p.status || ""))
  );

  const checks = {
    no_payout_recalculation_in_generator,
    no_payout_recalculation_in_demo_module,
    all_creators_have_stripe_connect_account_id,
    csv_has_stripe_connect_account_id,
    csv_stripe_ids_match_account_map,
    csv_payout_amount_yen_matches_decision,
    payment_history_generated,
    payment_history_payout_amount_yen_matches_decision,
    payment_history_stripe_ids_match_account_map,
    payment_history_statuses_valid,
    demo_mode_no_stripe_api,
  };

  return {
    ...checks,
    all_pass: Object.values(checks).every(Boolean),
  };
}
