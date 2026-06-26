#!/usr/bin/env node
/**
 * TLV 収益分配 — 表示・CSV・Dashboard・月次レポート出力
 * 支払額は monthly-payout-decision.json の payout_amount_yen のみ（再計算禁止）
 *
 *   node scripts/generate-payout-outputs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FINANCIAL_INTEGRITY_POLICY } from "./tlv-payout-financial.mjs";
import {
  SOURCE_OF_TRUTH,
  buildAdminPayoutDisplay,
  buildCreatorDashboardPayout,
  buildStripeConnectCsvRows,
  stripeConnectCsvString,
  buildMonthlyOperatorReport,
  validateConsumerIntegrity,
} from "./tlv-payout-consumers.mjs";
import {
  loadStripeConnectAccounts,
  buildStripeAccountMap,
  buildPaymentHistory,
  validateDemoPaymentFlow,
} from "./tlv-demo-payment-flow.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");

const DECISION_PATH = path.join(OUTPUT_DIR, "monthly-payout-decision.json");
const EXPLANATION_PATH = path.join(OUTPUT_DIR, "creator-rank-explanation.json");

const ADMIN_PATH = path.join(OUTPUT_DIR, "admin-payout-display.json");
const DASHBOARD_PATH = path.join(OUTPUT_DIR, "creator-dashboard-payout.json");
const CSV_PATH = path.join(OUTPUT_DIR, "stripe-connect-payouts.csv");
const REPORT_PATH = path.join(OUTPUT_DIR, "monthly-operator-report.md");
const VALIDATIONS_PATH = path.join(OUTPUT_DIR, "payout-consumer-validations.json");
const PAYMENT_HISTORY_PATH = path.join(OUTPUT_DIR, "payment-history.json");
const LIVE_DATA_DIR = path.join(ROOT, "live", "data");
const LIVE_PAYMENT_HISTORY_PATH = path.join(LIVE_DATA_DIR, "payment-history.json");

const GENERATOR_PATH = path.join(ROOT, "scripts", "generate-payout-outputs.mjs");
const DEMO_MODULE_PATH = path.join(ROOT, "scripts", "tlv-demo-payment-flow.mjs");

function syncPaymentHistoryToLiveData(paymentHistory) {
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  fs.writeFileSync(
    LIVE_PAYMENT_HISTORY_PATH,
    JSON.stringify(paymentHistory, null, 2) + "\n",
    "utf8"
  );
}

/**
 * @param {object} decision
 * @param {object} explanation
 * @param {Record<string, string>} stripeAccountByCreatorId
 */
export function buildPayoutConsumerOutputs(decision, explanation, stripeAccountByCreatorId = {}) {
  const admin = buildAdminPayoutDisplay(decision);
  const dashboard = buildCreatorDashboardPayout(decision, explanation);
  const csvRows = buildStripeConnectCsvRows(decision, stripeAccountByCreatorId);
  const report = buildMonthlyOperatorReport(decision, explanation);
  const paymentHistory = buildPaymentHistory(decision, stripeAccountByCreatorId);

  const validations = validateConsumerIntegrity(decision, {
    admin,
    dashboard,
    csvRows,
    report,
  });

  const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf8");
  const moduleSource = fs.readFileSync(DEMO_MODULE_PATH, "utf8");
  const demoPaymentValidations = validateDemoPaymentFlow({
    decision,
    csvRows,
    paymentHistory,
    stripeAccountMap: stripeAccountByCreatorId,
    generatorSource,
    moduleSource,
  });

  return {
    generated_at: new Date().toISOString(),
    source_of_truth: SOURCE_OF_TRUTH,
    financial_integrity: {
      consumer_rule: FINANCIAL_INTEGRITY_POLICY.consumer_rule,
      confirmed_payout_field: FINANCIAL_INTEGRITY_POLICY.confirmed_payout_field,
      recalculation_prohibited: true,
    },
    source_files: {
      monthly_payout_decision: "reports/tlv-business-simulator/output/monthly-payout-decision.json",
      creator_rank_explanation: "reports/tlv-business-simulator/output/creator-rank-explanation.json",
    },
    outputs: {
      admin_payout_display: "reports/tlv-business-simulator/output/admin-payout-display.json",
      creator_dashboard_payout: "reports/tlv-business-simulator/output/creator-dashboard-payout.json",
      stripe_connect_csv: "reports/tlv-business-simulator/output/stripe-connect-payouts.csv",
      monthly_operator_report: "reports/tlv-business-simulator/output/monthly-operator-report.md",
      payment_history: "reports/tlv-business-simulator/output/payment-history.json",
    },
    admin,
    dashboard,
    paymentHistory,
    csv_row_count: csvRows.length,
    report_amount_count: report.report_amounts.length,
    validations,
    demo_payment_validations: demoPaymentValidations,
    _csvRows: csvRows,
    _reportMarkdown: report.markdown,
  };
}

function main() {
  if (!fs.existsSync(DECISION_PATH)) {
    console.error("Missing:", DECISION_PATH);
    console.error("Run: node scripts/generate-monthly-payout-decision.mjs");
    process.exit(1);
  }
  if (!fs.existsSync(EXPLANATION_PATH)) {
    console.error("Missing:", EXPLANATION_PATH);
    console.error("Run: node scripts/generate-creator-rank-explanation.mjs");
    process.exit(1);
  }

  const decision = JSON.parse(fs.readFileSync(DECISION_PATH, "utf8"));
  const explanation = JSON.parse(fs.readFileSync(EXPLANATION_PATH, "utf8"));
  const stripeAccounts = loadStripeConnectAccounts(ROOT);
  const stripeAccountByCreatorId = buildStripeAccountMap(stripeAccounts);

  const bundle = buildPayoutConsumerOutputs(decision, explanation, stripeAccountByCreatorId);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(ADMIN_PATH, JSON.stringify(bundle.admin, null, 2) + "\n", "utf8");
  fs.writeFileSync(DASHBOARD_PATH, JSON.stringify(bundle.dashboard, null, 2) + "\n", "utf8");
  fs.writeFileSync(CSV_PATH, stripeConnectCsvString(bundle._csvRows), "utf8");
  fs.writeFileSync(REPORT_PATH, bundle._reportMarkdown + "\n", "utf8");
  fs.writeFileSync(
    PAYMENT_HISTORY_PATH,
    JSON.stringify(bundle.paymentHistory, null, 2) + "\n",
    "utf8"
  );
  syncPaymentHistoryToLiveData(bundle.paymentHistory);

  const validationsDoc = {
    generated_at: bundle.generated_at,
    source_of_truth: bundle.source_of_truth,
    financial_integrity: bundle.financial_integrity,
    source_files: bundle.source_files,
    outputs: bundle.outputs,
    validations: bundle.validations,
    demo_payment_validations: bundle.demo_payment_validations,
  };
  fs.writeFileSync(VALIDATIONS_PATH, JSON.stringify(validationsDoc, null, 2) + "\n", "utf8");

  const allPass =
    bundle.validations.all_pass && bundle.demo_payment_validations.all_pass === true;

  console.log("TLV payout consumer outputs — generated:");
  console.log("  Source of truth:", SOURCE_OF_TRUTH);
  console.log("  Admin:", ADMIN_PATH);
  console.log("  Dashboard:", DASHBOARD_PATH);
  console.log("  CSV:", CSV_PATH);
  console.log("  Report:", REPORT_PATH);
  console.log("  Payment history:", PAYMENT_HISTORY_PATH);
  console.log("  Live payment history:", LIVE_PAYMENT_HISTORY_PATH);
  console.log("  Validations:", VALIDATIONS_PATH);
  console.log("  CSV rows:", bundle.csv_row_count);
  console.log("  Consumer validations all_pass:", bundle.validations.all_pass);
  console.log("  Demo payment validations all_pass:", bundle.demo_payment_validations.all_pass);
  if (!allPass) {
    console.error("  FAILED:", JSON.stringify(validationsDoc, null, 2));
    process.exit(1);
  }
}

main();
