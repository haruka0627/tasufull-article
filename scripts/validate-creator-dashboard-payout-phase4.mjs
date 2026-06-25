#!/usr/bin/env node
/**
 * 実装フェーズ④ — Creator Dashboard 還元表示の整合検証
 *
 *   node scripts/validate-creator-dashboard-payout-phase4.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCreatorRankExplanationForValidation,
  loadCreatorMapForValidation,
  loadMonthlyPayoutDecisionForValidation,
  runCreatorDashboardDisplayValidations,
} from "./tlv-creator-dashboard-display.mjs";
import { validateConsumerIntegrity } from "./tlv-payout-consumers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PAYOUT_DISPLAY_JS = path.join(ROOT, "live", "tlv-creator-payout-display.js");
const DASHBOARD_JS = path.join(ROOT, "live", "live-creator-dashboard.js");
const DASHBOARD_HTML = path.join(ROOT, "live", "creator-dashboard.html");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");

function main() {
  const report = loadCreatorRankExplanationForValidation(ROOT);
  const decision = loadMonthlyPayoutDecisionForValidation(ROOT);
  const creatorMap = loadCreatorMapForValidation(ROOT);
  const payoutDisplaySource = fs.readFileSync(PAYOUT_DISPLAY_JS, "utf8");
  const dashboardSource = fs.readFileSync(DASHBOARD_JS, "utf8");
  const dashboardHtmlSource = fs.readFileSync(DASHBOARD_HTML, "utf8");

  const validations = runCreatorDashboardDisplayValidations({
    report,
    decision,
    payoutDisplaySource,
    dashboardSource,
    dashboardHtmlSource,
    creatorMap,
  });

  let consumerValidations = { all_pass: false };
  const consumerPath = path.join(OUTPUT_DIR, "payout-consumer-validations.json");
  const dashboardPayoutPath = path.join(OUTPUT_DIR, "creator-dashboard-payout.json");
  const adminPath = path.join(OUTPUT_DIR, "admin-payout-display.json");
  const reportPath = path.join(OUTPUT_DIR, "monthly-operator-report.md");
  const csvPath = path.join(OUTPUT_DIR, "stripe-connect-payouts.csv");

  if (
    fs.existsSync(consumerPath) &&
    fs.existsSync(dashboardPayoutPath) &&
    fs.existsSync(adminPath)
  ) {
    const admin = JSON.parse(fs.readFileSync(adminPath, "utf8"));
    const dashboard = JSON.parse(fs.readFileSync(dashboardPayoutPath, "utf8"));
    const csvText = fs.readFileSync(csvPath, "utf8");
    const csvRows = parseCsvRows(csvText);
    const reportMd = fs.readFileSync(reportPath, "utf8");
    const reportOut = {
      recalculation_prohibited: true,
      report_amounts: dashboard.creators.map((c) => ({
        creator_id: c.creator_id,
        payout_amount_yen: c.payout_amount_yen,
      })),
      markdown: reportMd,
    };
    consumerValidations = validateConsumerIntegrity(decision, {
      admin,
      dashboard,
      csvRows,
      report: reportOut,
    });
  }

  const allPass = validations.all_pass && consumerValidations.all_pass;

  const OUTPUT_PATH = path.join(OUTPUT_DIR, "creator-dashboard-display-validations.json");
  const output = {
    generated_at: new Date().toISOString(),
    phase: "④-creator-dashboard-payout-display",
    source_files: {
      monthly_payout_decision: "reports/tlv-business-simulator/output/monthly-payout-decision.json",
      creator_rank_explanation: "live/data/creator-rank-explanation.json",
      payout_display_module: "live/tlv-creator-payout-display.js",
      creator_dashboard: "live/live-creator-dashboard.js",
    },
    validations: {
      ...validations,
      consumer_validations: consumerValidations,
      all_pass: allPass,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log("TLV Creator Dashboard payout display — phase 4 validation:");
  console.log("  Creators checked:", report.creators?.length ?? 0);
  console.log("  Output:", OUTPUT_PATH);
  console.log("  validations.all_pass:", allPass);
  console.log("  consumer validations.all_pass:", consumerValidations.all_pass);

  if (!allPass) {
    console.error(JSON.stringify(output.validations, null, 2));
    process.exit(1);
  }
}

function parseCsvRows(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      creator_id: cols[idx.creator_id],
      payout_amount_jpy: Number(cols[idx.payout_amount_jpy]),
    };
  });
}

main();
