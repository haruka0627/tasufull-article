#!/usr/bin/env node
/**
 * 実装フェーズ⑤ — 管理画面 TLV 月次還元の整合検証
 *
 *   node scripts/validate-admin-payouts-phase5.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAdminPayoutDataForValidation,
  runAdminPayoutValidations,
} from "./tlv-admin-payout-display.mjs";
import { validateConsumerIntegrity } from "./tlv-payout-consumers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ADMIN_JS = path.join(ROOT, "live", "live-admin-payouts.js");
const ADMIN_HTML = path.join(ROOT, "live", "admin-payouts.html");
const OUTPUT_DIR = path.join(ROOT, "reports", "tlv-business-simulator", "output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "admin-payouts-validations.json");

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

function loadConsumerValidations(decision) {
  const adminPath = path.join(OUTPUT_DIR, "admin-payout-display.json");
  const dashboardPath = path.join(OUTPUT_DIR, "creator-dashboard-payout.json");
  const csvPath = path.join(OUTPUT_DIR, "stripe-connect-payouts.csv");
  const reportPath = path.join(OUTPUT_DIR, "monthly-operator-report.md");

  if (!fs.existsSync(adminPath) || !fs.existsSync(dashboardPath)) {
    return { all_pass: false, skipped: true, reason: "consumer outputs missing — run generate-payout-outputs.mjs" };
  }

  const admin = JSON.parse(fs.readFileSync(adminPath, "utf8"));
  const dashboard = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));
  const csvRows = parseCsvRows(fs.readFileSync(csvPath, "utf8"));
  const reportMd = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";
  const report = {
    recalculation_prohibited: true,
    report_amounts: dashboard.creators.map((c) => ({
      creator_id: c.creator_id,
      payout_amount_yen: c.payout_amount_yen,
    })),
    markdown: reportMd,
  };

  return validateConsumerIntegrity(decision, { admin, dashboard, csvRows, report });
}

function main() {
  const { decision, explanation, rows, csvRows, csvString } =
    loadAdminPayoutDataForValidation(ROOT);
  const adminSource = fs.readFileSync(ADMIN_JS, "utf8");
  const adminHtmlSource = fs.readFileSync(ADMIN_HTML, "utf8");

  const validations = runAdminPayoutValidations({
    decision,
    explanation,
    adminSource,
    adminHtmlSource,
    rows,
    csvRows,
    csvString,
  });

  const consumerValidations = loadConsumerValidations(decision);
  const allPass = validations.all_pass && consumerValidations.all_pass === true;

  const output = {
    generated_at: new Date().toISOString(),
    phase: "⑤-admin-payouts",
    source_files: {
      monthly_payout_decision: "live/data/monthly-payout-decision.json",
      creator_rank_explanation: "live/data/creator-rank-explanation.json",
      admin_page: "live/admin-payouts.html",
      admin_module: "live/live-admin-payouts.js",
    },
    creators_checked: rows.length,
    validations: {
      ...validations,
      consumer_validations: consumerValidations,
      all_pass: allPass,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log("TLV admin payouts — phase 5 validation:");
  console.log("  Creators checked:", rows.length);
  console.log("  identity_holds:", validations.identity_holds);
  console.log("  Output:", OUTPUT_PATH);
  console.log("  validations.all_pass:", allPass);
  console.log("  consumer validations.all_pass:", consumerValidations.all_pass);

  if (!allPass) {
    console.error(JSON.stringify(output.validations, null, 2));
    process.exit(1);
  }
}

main();
