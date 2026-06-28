/**
 * TLV chargeback/refund — staging integration tests (T-CB-01..11)
 */
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "scripts/sql/tlv-staging-chargeback-integration.sql").replace(/\\/g, "/");

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
console.log("TLV chargeback/refund staging integration tests\n");

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
  console.error("Failed to parse staging SQL output.\n", combined.slice(-1200));
  process.exit(1);
}

const byId = Object.fromEntries(rows.map((r) => [r.test_id, r]));

for (const id of [
  "T-CB-01",
  "T-CB-02",
  "T-CB-03",
  "T-CB-03b",
  "T-CB-03c",
  "T-CB-06",
  "T-CB-07",
  "T-CB-08",
  "T-CB-09",
  "T-CB-10",
]) {
  const r = byId[id];
  const ok = isPass(r?.passed);
  console.log(`${ok ? "PASS" : "FAIL"}: ${id}${r?.detail ? ` — ${String(r.detail).slice(0, 100)}` : ""}`);
  if (!ok) failed += 1;
}

console.log(failed ? `\n${failed} failed` : "\nAll chargeback staging tests passed");
process.exit(failed ? 1 : 0);
