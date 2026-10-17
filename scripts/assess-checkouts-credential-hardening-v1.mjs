#!/usr/bin/env node
/**
 * READ-ONLY inventory of every registered git worktree/checkout with respect to the exposed-test-credential problem.
 * Writes nothing into any checkout, prints no value. Output: JSON (per checkout) + counts.
 *   node scripts/assess-checkouts-credential-hardening-v1.mjs [--json out.json]
 *
 * Classes:
 *   MISSING_ON_DISK  registered but the directory is gone (nothing to do; `git worktree prune` is an Owner housekeeping decision)
 *   HARDENED         guard module present, no published value in any file that ever held one, and the exposed-account writers use the guard (or are sign-in only)
 *   CLEAN            no published value and no Auth-writing helper for the exposed accounts (nothing to harden)
 *   NEEDS_PATCH      published values / old helper present and every relevant file is unmodified vs HEAD (the porter could REPLACE_CLEAN)
 *   DIRTY_CONFLICT   published values / old helper present and at least one relevant file has local modifications (needs a 3-way merge / human)
 *   UNKNOWN          git/file errors
 * Reach: an env file (.env / .env.staging; existence only) in the checkout means a Staging/Production-capable credential may be available to its scripts.
 * `locked` worktrees belong to running agent sessions and must never be modified by this tooling.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { PUBLIC_PASSWORD_SHA256, PUBLIC_PASSWORD_LENGTHS } = await import(pathToFileURL(path.join(here, "scripts/lib/test-auth-guard-v1.mjs")).href);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const git = (cwd, args, opt = {}) => spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1e9, timeout: opt.timeout || 60000 });
const LENS = [...PUBLIC_PASSWORD_LENGTHS];
// Token-level check (fast): published values appear as whole tokens in the watched files; the full sliding-window scan lives in check-no-credential-literals-v1.mjs.
function hasPublished(text) {
  for (const m of text.matchAll(/[A-Za-z0-9!@#%^&*_.-]{8,40}/g)) {
    const t = m[0];
    if (!PUBLIC_PASSWORD_LENGTHS.has(t.length)) continue;
    if (PUBLIC_PASSWORD_SHA256.has(sha(t))) return true;
  }
  return false;
}

// 1. files that ever held a published value (names only; derived from history with in-memory values)
const lits = new Set();
const g = git(here, ["grep", "-hE", "password|PASSWORD", "HEAD", "--", "scripts", "reports", "docs"]).stdout || "";
for (const m of g.matchAll(/(?:password|PASSWORD)["'`]?\s*[:=|]\s*["'`]([A-Za-z0-9!@#%^&*_.\-]{8,24})["'`]/g)) if (PUBLIC_PASSWORD_SHA256.has(sha(m[1]))) lits.add(m[1]);
for (const c of ["fd23dba3a:scripts/lib/talk-rls-test-auth.mjs", "fd23dba3a:scripts/issue-anpi-rls-jwt.mjs", "8918aceb8:scripts/test-tlv-payment-rls-staging.mjs"]) {
  const t = git(here, ["show", c]).stdout || "";
  for (const m of t.matchAll(/password:\s*"([^"]{6,})"/g)) if (PUBLIC_PASSWORD_SHA256.has(sha(m[1]))) lits.add(m[1]);
}
const commits = new Set();
for (const l of lits) for (const line of git(here, ["log", "--all", "--format=%H", "-S" + l]).stdout.split("\n").filter(Boolean)) commits.add(line);
const files = new Set();
{
  // fixed-string search for the published values inside each commit that ever touched one (fast; the pattern file lives in the OS temp dir and is deleted)
  const os = await import("node:os");
  const pat = path.join(os.tmpdir(), `pub-patterns-${process.pid}.txt`);
  fs.writeFileSync(pat, [...lits].join("\n") + "\n");
  try {
    for (const c of commits) for (const f of git(here, ["grep", "-l", "-F", "-f", pat, c, "--"]).stdout.split("\n").filter(Boolean)) files.add(f.replace(/^[0-9a-f]{40}:/, ""));
  } finally { fs.rmSync(pat, { force: true }); }
}
// files that deliberately still hold a (verified-invalid) published value for an unrelated example.com fixture are reviewed in scripts/credential-scan-allowlist-v1.json and do not make a checkout 'contaminated'
const ALLOWED = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(here, "scripts/credential-scan-allowlist-v1.json"), "utf8")).files || {}));
const WATCH = [...files].filter((x) => !ALLOWED.has(x)).sort();
const HELPER = "scripts/lib/talk-rls-test-auth.mjs";
const WRITERS = ["scripts/lib/talk-rls-test-auth.mjs", "scripts/issue-anpi-rls-jwt.mjs", "scripts/test-tlv-payment-rls-staging.mjs", "scripts/verify-talk-rls-staging.mjs", "scripts/verify-partner-mgmt-real-login.mjs", "scripts/verify-partner-api-auth-live200.mjs"];

// 2. registered worktrees
const reg = git(here, ["worktree", "list", "--porcelain"]).stdout.split(/\n\n/).map((b) => Object.fromEntries(b.split("\n").filter(Boolean).map((l) => { const i = l.indexOf(" "); return i < 0 ? [l, true] : [l.slice(0, i), l.slice(i + 1)]; }))).filter((b) => b.worktree);
const seen = new Map();
const rows = [];
for (const w of reg) {
  const p = w.worktree;
  const row = { path: p, branch: w.branch ? w.branch.replace("refs/heads/", "") : (w.detached ? "(detached)" : "?"), head: String(w.HEAD || "").slice(0, 9), locked: w.locked !== undefined, duplicate_of: seen.get(p.toLowerCase()) || null };
  seen.set(p.toLowerCase(), p);
  if (!fs.existsSync(p)) { rows.push({ ...row, class: "MISSING_ON_DISK" }); continue; }
  try {
    row.env_files = [".env", ".env.staging"].filter((f) => fs.existsSync(path.join(p, f)));
    row.guard_module = fs.existsSync(path.join(p, "scripts/lib/test-auth-guard-v1.mjs"));
    const found = [];
    for (const f of WATCH) {
      const fp = path.join(p, f);
      if (!fs.existsSync(fp)) continue;
      const st = fs.statSync(fp);
      if (!st.isFile() || st.size > 1.5e6) continue;
      if (hasPublished(fs.readFileSync(fp, "utf8"))) found.push(f);
    }
    row.files_with_published_values = found;
    const helperPath = path.join(p, HELPER);
    const helperText = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, "utf8") : "";
    row.helper = !helperText ? "absent" : /test-auth-guard-v1/.test(helperText) ? "guarded" : /admin\/users/.test(helperText) && /PUT|POST/.test(helperText) ? "unguarded-writer" : "sign-in-only";
    row.writers_unguarded = WRITERS.filter((f) => { const t = fs.existsSync(path.join(p, f)) ? fs.readFileSync(path.join(p, f), "utf8") : ""; return t && /admin\/users/.test(t) && /(method:\s*["'](PUT|POST)|-Method (Put|Post))/i.test(t) && !/test-auth-guard-v1/.test(t); });
    const dirty = git(p, ["status", "--porcelain", "--", ...WRITERS, ...found], { timeout: 30000 });
    if (dirty.status !== 0) { rows.push({ ...row, class: "UNKNOWN", note: "git status failed" }); continue; }
    row.relevant_files_modified = dirty.stdout.split("\n").filter(Boolean).length;
    const risky = found.length > 0 || row.helper === "unguarded-writer" || row.writers_unguarded.length > 0;
    row.class = !risky ? (row.guard_module ? "HARDENED" : "CLEAN") : row.relevant_files_modified > 0 ? "DIRTY_CONFLICT" : "NEEDS_PATCH";
    rows.push(row);
  } catch (e) { rows.push({ ...row, class: "UNKNOWN", note: String(e.message).slice(0, 80) }); }
}
const count = (f) => rows.filter(f).length;
const summary = {
  watched_files: WATCH.length,
  registered: rows.length,
  duplicates: count((r) => r.duplicate_of),
  by_class: Object.fromEntries([...new Set(rows.map((r) => r.class))].map((c) => [c, count((r) => r.class === c)])),
  locked_by_running_sessions: count((r) => r.locked),
  existing_with_env_file: count((r) => r.env_files && r.env_files.length),
  recontamination_capable: rows.filter((r) => ["NEEDS_PATCH", "DIRTY_CONFLICT"].includes(r.class) && r.env_files && r.env_files.length).map((r) => r.path),
};
const out = { summary, rows };
const oi = process.argv.indexOf("--json");
if (oi >= 0) fs.writeFileSync(process.argv[oi + 1], JSON.stringify(out, null, 1));
console.log(JSON.stringify(summary, null, 1));
