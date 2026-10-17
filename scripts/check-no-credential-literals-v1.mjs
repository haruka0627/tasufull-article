#!/usr/bin/env node
/**
 * Recontamination scanner (offline, read-only). Fails if a tracked (or staged) file contains
 *   - a value that was ever published as a test-account password (matched by SHA-256 against the guard's deny-list, never by plaintext), anywhere inside any
 *     whitespace-separated run (so `E2E_<value>`, `<value>.` or concatenated forms are found), or
 *   - a password-like literal (>= 8 chars) assigned to a password/pass/pwd/secret/pw-style key.
 *   node scripts/check-no-credential-literals-v1.mjs [--staged | --paths a b ...] [--generate-allowlist] [--strict-skips]
 * Prints file names, line numbers and kinds only; never the value. Files that cannot be scanned (too large, unreadable) are listed as WARNINGS.
 * scripts/credential-scan-allowlist-v1.json allows a file only for the specific value hashes recorded in `values` (file + value, not the whole file).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_PASSWORD_SHA256, PUBLIC_PASSWORD_LENGTHS } from "./lib/test-auth-guard-v1.mjs";

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const LITERAL = /(?:password|passwd|pwd|pw|secret)[A-Za-z0-9_]*["']?\s*[:=]\s*["'`]([^"'`$\s{}]{8,})["'`]/gi;
// Case-SENSITIVE on purpose: only an ENV_VAR_NAME (needs an underscore) or an explicit lower-case placeholder prefix is exempt; "EnvAdmin1234!" or "TalkRlsA1x" are values and must be reported.
const SAFE_VALUE = /^([A-Z][A-Z0-9]*_[A-Z0-9_]+$|<|\*|x{4}|process\.env|env[-_.:]|your[-_ ]|changeme|example|placeholder|redacted|stub-|env-test-value)/;
const TEXT_EXT = /\.(mjs|cjs|js|jsx|ts|tsx|json|jsonl|md|mdx|txt|ps1|psm1|sh|bash|cmd|bat|py|rb|sql|html|htm|css|yml|yaml|toml|ini|cfg|conf|csv|log|xml|ipynb|env|example|properties)$/i;
const MAX_BYTES = 3e6, MAX_RUN = 400;
const LENS = [...PUBLIC_PASSWORD_LENGTHS];

export function scanText(text) {
  const findings = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\S+/g)) {
      const run = m[0];
      if (run.length > MAX_RUN) continue;
      for (const len of LENS) for (let k = 0; k + len <= run.length; k++) {
        const h = sha(run.slice(k, k + len));
        if (PUBLIC_PASSWORD_SHA256.has(h)) findings.push({ line: i + 1, kind: "PUBLISHED_PASSWORD_VALUE", hash: h });
      }
    }
    if (/passw|pwd|\bpw\b|secret/i.test(line)) {
      for (const m of line.matchAll(LITERAL)) if (!SAFE_VALUE.test(m[1])) findings.push({ line: i + 1, kind: "PASSWORD_LITERAL", hash: sha(m[1]) });
    }
  });
  return findings;
}

function listFiles(mode, root) {
  const args = mode === "staged" ? ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACM"] : ["ls-files", "-z"];
  return spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1e9 }).stdout.split("\0").filter(Boolean);
}
function readFile(mode, root, f, warnings) {
  if (mode === "staged") return spawnSync("git", ["show", `:${f}`], { cwd: root, encoding: "utf8", maxBuffer: 1e9 }).stdout;
  const p = path.join(root, f);
  if (!fs.existsSync(p)) return ""; // tracked but absent in this checkout (deleted / sparse)
  const st = fs.statSync(p);
  if (!st.isFile()) return "";
  if (st.size > MAX_BYTES) { warnings.push(`${f}: skipped (larger than ${MAX_BYTES} bytes)`); return ""; }
  return fs.readFileSync(p, "utf8");
}

export function scanRepo({ root, mode = "tracked", paths = null, allowlistPath = path.join(root, "scripts/credential-scan-allowlist-v1.json") }) {
  const allow = fs.existsSync(allowlistPath) ? JSON.parse(fs.readFileSync(allowlistPath, "utf8")).files || {} : {};
  const files = paths || listFiles(mode, root);
  const bad = [], warnings = [];
  let scanned = 0;
  for (const f of files) {
    const base = path.basename(f);
    if (!TEXT_EXT.test(f) && !/^\.env/.test(base) && path.extname(f) !== "") continue; // extensionless files ARE scanned
    const text = readFile(mode, root, f, warnings);
    if (!text) continue;
    scanned++;
    let hits = scanText(text);
    const entry = allow[f];
    if (entry) { const ok = new Set(entry.values || []); hits = hits.filter((h) => !ok.has(h.hash)); }
    if (hits.length) bad.push({ file: f, hits });
  }
  return { scanned, bad, warnings };
}

/** Builds allowlist entries (file + value hashes) for the currently flagged files. Entries must be reviewed by a human; reasons are placeholders. */
export function proposeAllowlist(root, previous = {}) {
  const raw = scanRepo({ root, allowlistPath: "/nonexistent" });
  const files = {};
  for (const b of raw.bad) files[b.file] = { reason: previous[b.file]?.reason || "REVIEW NEEDED", values: [...new Set(b.hits.map((h) => h.hash))].sort() };
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const alp = path.join(root, "scripts/credential-scan-allowlist-v1.json");
  if (args.includes("--generate-allowlist")) {
    const prev = fs.existsSync(alp) ? JSON.parse(fs.readFileSync(alp, "utf8")) : { schema: "tasful-credential-scan-allowlist/2", note: "", files: {} };
    prev.schema = "tasful-credential-scan-allowlist/2";
    prev.files = proposeAllowlist(root, prev.files);
    fs.writeFileSync(alp, JSON.stringify(prev, null, 2) + "\n");
    console.log("allowlist (file + value hashes) written for", Object.keys(prev.files).length, "files — review the reasons");
    process.exit(0);
  }
  const mode = args.includes("--staged") ? "staged" : "tracked";
  const pi = args.indexOf("--paths");
  const { scanned, bad, warnings } = scanRepo({ root, mode, paths: pi >= 0 ? args.slice(pi + 1) : null });
  console.log(`credential-literal scan (${mode}): ${scanned} files scanned, ${bad.length} with findings, ${warnings.length} warnings`);
  for (const b of bad) console.log(`  ${b.file}: ${[...new Set(b.hits.map((h) => `${h.kind}@${h.line}`))].join(", ")}`);
  for (const w of warnings.slice(0, 20)) console.log(`  WARN ${w}`);
  process.exit(bad.length || (args.includes("--strict-skips") && warnings.length) ? 1 : 0);
}
