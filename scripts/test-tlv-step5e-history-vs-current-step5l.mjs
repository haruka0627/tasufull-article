import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const packageUrl = new URL("../reports/tlv-step5e-reconciliation-disposition-package.json", import.meta.url);
const bytes = readFileSync(packageUrl);
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

assert.equal(sha256(bytes), "BF6B3D68A42C52CED87932466C6AC0D470E8670B74795AD1BBE782C6F63DD069");
const evidence = JSON.parse(bytes);
assert.equal(evidence.schema_version, "tasful.tlv_reconciliation_disposition.step5e.v1");
assert.equal(evidence.scope, "REPOSITORY_ONLY");

const drift = [];
for (const source of evidence.source_evidence) {
  const url = new URL(source.path.replaceAll("\\", "/"), root);
  const currentBytes = statSync(url).size;
  const currentHash = sha256(readFileSync(url));
  if (currentBytes !== source.bytes || currentHash !== source.sha256) {
    drift.push({ path: source.path, expectedBytes: source.bytes, expectedHash: source.sha256, currentBytes, currentHash });
  }
}

const authorizedProgressiveDrift = new Map([
  ["docs/TLV_FINANCIAL_CONTRACT_SCOPE_FREEZE.md", "90BBD61DA5299A80A9B508430FF5B15A4062E7DDAFD84C847A831FEFE303371C"],
  ["docs/TLV_SETTLEMENT_ENGINE.md", "1CD824B458481A3487E8F1B6143B18F8348FAE6DF4FDC40DCE9C910E6AB29BFA"],
  ["docs/adr/ADR-040-tasful-product-option-benefit-policy.md", "4941A886EC7D92DC97116CA02A6D5435C82CEDBF26F6874E14B1B9A1787C775C"],
  ["supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", "2099978EB9B584674A854789B6B5F5C1F628FEF978457B3768D4E8D5CE93F883"],
  ["scripts/lib/economics/tlv-settlement.mjs", "1606012CF5FC04D0363B73FB9498812ADA27DF20D9B2452EA8282A3EE29C582D"],
]);

assert.equal(drift.length, authorizedProgressiveDrift.size);
for (const entry of drift) {
  assert.equal(
    entry.currentHash,
    authorizedProgressiveDrift.get(entry.path),
    `unexpected post-STEP5E drift: ${entry.path}`,
  );
}

console.log("TLV_STEP5E_HISTORICAL_EVIDENCE: PRESERVED");
console.log("HISTORICAL_VERIFIER: EXPECTED_DRIFT_DETECTED_ONLY_IN_GATE02_PROGRESSIVE_SSOT");
console.log("CURRENT_REGRESSION_BASELINE: GATE02_PROGRESSIVE_AND_STEP5K_TESTS_REQUIRED");
