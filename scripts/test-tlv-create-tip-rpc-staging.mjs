/**
 * TLV create_tip_transaction — staging integration tests (T-TIP-01..10)
 * Runs scripts/sql/tlv-staging-create-tip-integration.sql via supabase db query --linked
 */
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "scripts/sql/tlv-staging-create-tip-integration.sql").replace(/\\/g, "/");

function parseRows(out) {
  const boundaryIdx = out.indexOf('"boundary"');
  if (boundaryIdx < 0) return { rows: [], raw: out };
  const start = out.lastIndexOf("{", boundaryIdx);
  if (start < 0) return { rows: [], raw: out };
  let depth = 0;
  for (let i = start; i < out.length; i++) {
    if (out[i] === "{") depth++;
    else if (out[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(out.slice(start, i + 1));
        } catch {
          return { rows: [], raw: out };
        }
      }
    }
  }
  return { rows: [], raw: out };
}

function isPass(v) {
  return v === true || v === "true";
}

let failed = 0;
console.log("TLV create_tip_transaction staging integration tests\n");

let combined = "";
try {
  combined = execSync(`npx supabase db query --linked -f "${sqlPath}"`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (err) {
  combined = String(err.stdout ?? "") + String(err.stderr ?? "") + String(err.message ?? "");
}

const { rows } = parseRows(combined);
if (!rows.length) {
  console.error("Failed to parse staging SQL output.\n", combined.slice(-800));
  process.exit(1);
}

const byId = Object.fromEntries(rows.map((r) => [r.test_id, r]));
const tip10 =
  isPass(byId["T-TIP-10a"]?.passed) &&
  isPass(byId["T-TIP-10b"]?.passed) &&
  isPass(byId["T-TIP-10c"]?.passed);

for (const id of [
  "T-TIP-01",
  "T-TIP-02",
  "T-TIP-03",
  "T-TIP-04",
  "T-TIP-05",
  "T-TIP-06",
  "T-TIP-07",
  "T-TIP-08",
  "T-TIP-09",
]) {
  const r = byId[id];
  const ok = isPass(r?.passed);
  console.log(`${ok ? "PASS" : "FAIL"}: ${id}${r?.detail ? ` — ${String(r.detail).slice(0, 120)}` : ""}`);
  if (!ok) failed += 1;
}

console.log(
  `${tip10 ? "PASS" : "FAIL"}: T-TIP-10 — 10a=${byId["T-TIP-10a"]?.passed} 10b=${byId["T-TIP-10b"]?.passed} 10c=${byId["T-TIP-10c"]?.passed}`,
);
if (!tip10) failed += 1;

for (const id of [
  "DB-wallet_ledger",
  "DB-lot_sum",
  "DB-tip_alloc",
  "DB-review_revenue",
  "DB-idempotency",
  "DB-fraud_gauge",
  "DB-stream_events_no_jpy",
  "DB-score_insert_only",
  "DB-no_text_wallet_join",
]) {
  const r = byId[id];
  const ok = isPass(r?.passed);
  console.log(`${ok ? "PASS" : "FAIL"}: ${id}${r?.detail ? ` — ${r.detail}` : ""}`);
  if (!ok) failed += 1;
}

console.log(failed ? `\n${failed} failed` : "\nAll staging integration tests passed");
process.exit(failed ? 1 : 0);
