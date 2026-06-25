#!/usr/bin/env node
/**
 * 実装フェーズ⑥ — 公開説明ページ（payout-policy.html）検証
 *
 *   node scripts/validate-payout-policy-phase6.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAYOUT_POLICY_HTML_RELATIVE,
  validatePayoutPolicyContent,
  validatePayoutPolicyStyles,
} from "./tlv-payout-policy-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const HTML_PATH = path.join(ROOT, PAYOUT_POLICY_HTML_RELATIVE);
const CSS_PATH = path.join(ROOT, "live", "live.css");
const OUTPUT_PATH = path.join(
  ROOT,
  "reports",
  "tlv-business-simulator",
  "output",
  "payout-policy-validations.json"
);

function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error("Missing:", HTML_PATH);
    process.exit(1);
  }

  const html = fs.readFileSync(HTML_PATH, "utf8");
  const css = fs.readFileSync(CSS_PATH, "utf8");

  const contentValidations = validatePayoutPolicyContent(html);
  const styleValidations = validatePayoutPolicyStyles(css);

  const allPass = contentValidations.all_pass && styleValidations.all_pass;

  const output = {
    generated_at: new Date().toISOString(),
    phase: "⑥-payout-policy-public-page",
    page: PAYOUT_POLICY_HTML_RELATIVE,
    url_path: "/live/payout-policy.html",
    validations: {
      content: contentValidations,
      styles: styleValidations,
      all_pass: allPass,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log("TLV payout policy — phase 6 validation:");
  console.log("  Page:", HTML_PATH);
  console.log("  URL: /live/payout-policy.html");
  console.log("  content.all_pass:", contentValidations.all_pass);
  console.log("  styles.all_pass:", styleValidations.all_pass);
  console.log("  validations.all_pass:", allPass);
  console.log("  Output:", OUTPUT_PATH);

  if (!allPass) {
    console.error(JSON.stringify(output.validations, null, 2));
    process.exit(1);
  }
}

main();
