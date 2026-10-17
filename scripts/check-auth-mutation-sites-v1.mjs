#!/usr/bin/env node
/**
 * Static inventory + gate for code that WRITES to Supabase Auth (admin create/update/delete of users, or SQL on auth.users).
 *   guarded : imports scripts/lib/test-auth-guard-v1.mjs AND calls authAdminWriteGate( (an import, a comment or assertTestAuthTarget alone does not count)
 *             AND does not approve itself (set TALK_ALLOW_AUTH_ADMIN_WRITE / TALK_AUTH_WRITE_* in code, Object.assign(process.env, ...), or pass env/now to the gate)
 *   legacy  : not guarded, but listed in scripts/auth-mutation-allowlist-v1.json together with the SHA-256 of the file as it was reviewed
 *   NEW / CHANGED_SINCE_REVIEW : not guarded and not listed, or listed but edited since the review  => FAIL
 *   --strict additionally fails when a legacy entry is Production-locked (production-ref-in-code).
 *   node scripts/check-auth-mutation-sites-v1.mjs [--json] [--generate-allowlist] [--strict]
 * Detection covers whole-file patterns (a write verb anywhere in a file that references the admin users endpoint), PowerShell/curl/axios forms,
 * supabase-js admin write methods and SQL against auth.users. It looks at every tracked text/code file outside node_modules.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST = path.join(root, "scripts/auth-mutation-allowlist-v1.json");
const CODE_EXT = /\.(mjs|cjs|js|jsx|ts|tsx|ps1|psm1|sh|bash|cmd|bat|py|rb|sql|yml|yaml)$/i;
// hash over LF-normalised text so the review key does not depend on a checkout's line-ending conversion (core.autocrlf)
const sha = (s) => crypto.createHash("sha256").update(String(s).replace(/\r\n/g, "\n")).digest("hex");

const ADMIN_REF = /admin\/users|\.auth\.admin\b|auth\.admin\[|auth\/v1\/admin/;
const WRITE_VERB = [
  /method\s*[:=]\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i,
  /-Method\s+["']?(Put|Post|Delete|Patch)/i,
  /\bcurl\b[^\n]*\s-X\s*(POST|PUT|PATCH|DELETE)/i,
  /\baxios\.(post|put|patch|delete)\b/i,
  /\.(createUser|updateUserById|deleteUser|inviteUserByEmail|generateLink)\s*\(/,
  /auth\.admin\[\s*["'`](createUser|updateUserById|deleteUser)/,
  /\bfetch\([^)]*admin\/users[^)]*\)[\s\S]{0,300}?method\s*:/i,
];
const SQL_WRITE = /\b(update\s+auth\.users|insert\s+into\s+auth\.users|delete\s+from\s+auth\.users|alter\s+table\s+auth\.users)\b/i;
const TARGET_LOCK = (t) => (t.includes("ddojquacsyqesrjhcvmn") ? "production-ref-in-code" : t.includes("ahlxuyvhzqdqaojiywmu") ? "staging-ref-in-code" : "env-driven");

const SCOPE_VAR = String.raw`(?:TALK_ALLOW_AUTH_ADMIN_WRITE|TALK_AUTH_WRITE_(?:ACCOUNTS|OPS|EXPIRES))`;
const SELF_SCOPE = [
  new RegExp(String.raw`process\.env(?:\.${SCOPE_VAR}|\[\s*["'\x60]${SCOPE_VAR}["'\x60]\s*\])\s*(?:=(?!=)|\|\|=|\?\?=)`),
  /\b(?:Object\.(?:assign|defineProperty|defineProperties)|Reflect\.(?:set|defineProperty))\s*\(\s*process\.env\b/,
  /\bauthAdminWriteGate\s*\(\s*\{[^}]*?(?:\benv\b|\bnow\b)\s*[:,}]/,
];

export function classify(text, file = "") {
  const sqlWriter = /\.sql$/i.test(file) ? SQL_WRITE.test(text) : SQL_WRITE.test(text) && /(\bquery\b|\bexecute\b|\.sql)/i.test(text);
  const apiWriter = ADMIN_REF.test(text) && WRITE_VERB.some((r) => r.test(text));
  if (!apiWriter && !sqlWriter) return null;
  // comments are ignored (a commented-out call must not count) and the WRITE gate is required: assertTestAuthTarget alone only checks the host, not account/password/scope
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
  // self-approval: code that sets the operator's Staging write scope itself, or hands the gate its own env/now, does not count as guarded
  const selfApproves = SELF_SCOPE.some((r) => r.test(code));
  const guarded = /import[^;\n]*test-auth-guard-v1|require\([^)]*test-auth-guard-v1/.test(code) && /\bauthAdminWriteGate\s*\(/.test(code) && !selfApproves;
  return { guarded, lock: TARGET_LOCK(text), kind: apiWriter ? "admin-api" : "sql" };
}

export function inventory(rootDir = root) {
  const files = spawnSync("git", ["ls-files", "-z"], { cwd: rootDir, encoding: "utf8", maxBuffer: 1e9 }).stdout.split("\0").filter((f) => CODE_EXT.test(f) && !/(^|\/)node_modules\//.test(f));
  const rows = [];
  for (const f of files) {
    const p = path.join(rootDir, f);
    if (!fs.existsSync(p) || fs.statSync(p).size > 3e6) continue;
    const text = fs.readFileSync(p, "utf8");
    const c = classify(text, f);
    if (c) rows.push({ file: f, sha256: sha(text), ...c });
  }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  const rows = inventory();
  if (args.includes("--generate-allowlist")) {
    const out = { schema: "tasful-auth-mutation-allowlist/2", note: "Reviewed legacy Auth writers that do NOT use test-auth-guard-v1, keyed by the SHA-256 of the file as reviewed (an edit forces a re-review). New writers must use the guard.", files: Object.fromEntries(rows.filter((r) => !r.guarded).map((r) => [r.file, { lock: r.lock, kind: r.kind, sha256: r.sha256, reason: "legacy owner/environment-specific tool; reviewed 2026-10-17; no published password literal (see check-no-credential-literals-v1)" }])) };
    fs.writeFileSync(ALLOWLIST, JSON.stringify(out, null, 1) + "\n");
    console.log("allowlist written with", Object.keys(out.files).length, "legacy files");
    process.exit(0);
  }
  const allow = fs.existsSync(ALLOWLIST) ? JSON.parse(fs.readFileSync(ALLOWLIST, "utf8")).files : {};
  const unguarded = rows.filter((r) => !r.guarded);
  const summary = {
    writers: rows.length,
    guarded: rows.length - unguarded.length,
    legacy_listed: unguarded.filter((r) => allow[r.file] && allow[r.file].sha256 === r.sha256).length,
    NEW_unguarded: unguarded.filter((r) => !allow[r.file]).map((r) => r.file),
    CHANGED_SINCE_REVIEW: unguarded.filter((r) => allow[r.file] && allow[r.file].sha256 !== r.sha256).map((r) => r.file),
    legacy_production_locked: unguarded.filter((r) => r.lock === "production-ref-in-code").length,
    legacy_by_lock: {},
  };
  for (const r of unguarded) summary.legacy_by_lock[r.lock] = (summary.legacy_by_lock[r.lock] || 0) + 1;
  console.log(JSON.stringify(summary, null, 1));
  const fail = summary.NEW_unguarded.length || summary.CHANGED_SINCE_REVIEW.length || (args.includes("--strict") && summary.legacy_production_locked);
  process.exit(fail ? 1 : 0);
}
