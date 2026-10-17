#!/usr/bin/env node
/**
 * Port the credential-recontamination hardening (this worktree's guard module, scanners, and fixed test-auth helpers) into ANOTHER checkout's working tree
 * without committing, resetting, stashing, rebasing or merging any branch.
 *
 *   node scripts/port-test-auth-hardening-v1.mjs <targetCheckout>            dry run (default): prints what would happen, writes nothing
 *   node scripts/port-test-auth-hardening-v1.mjs <targetCheckout> --apply     applies; every touched file is first copied to a backup directory OUTSIDE both repositories
 *
 * 1. New files (guard module, scanners, allowlist, test) are copied if absent.
 * 2. Helper/scripts: identical-to-base files are replaced; locally modified files are 3-way merged with `git merge-file` (EOL-normalised). A file is written only if the
 *    merge has zero conflicts and passes `node --check`; otherwise it is left untouched and reported.
 * 3. Containment pass for everything the scanner still flags (including unmerged files): published password values are removed (fail closed), the implicit Production
 *    URL default is removed, and a Staging/loopback-only target assertion is injected after `const SUPABASE_URL = ...`.
 * No Secrets are printed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(process.argv[2] || "");
const apply = process.argv.includes("--apply");
if (!process.argv[2] || !fs.existsSync(path.join(target, ".git"))) { console.error("usage: node scripts/port-test-auth-hardening-v1.mjs <targetCheckout> [--apply]"); process.exit(2); }
if (path.resolve(target) === path.resolve(here)) { console.error("target is this checkout"); process.exit(2); }

const NEW_FILES = ["scripts/lib/test-auth-guard-v1.mjs", "scripts/check-no-credential-literals-v1.mjs", "scripts/check-auth-mutation-sites-v1.mjs", "scripts/credential-scan-allowlist-v1.json", "scripts/test-talk-test-auth-hardening-v1.mjs"];
const MANAGED = new Set(["scripts/lib/test-auth-guard-v1.mjs", "scripts/check-no-credential-literals-v1.mjs", "scripts/check-auth-mutation-sites-v1.mjs", "scripts/test-talk-test-auth-hardening-v1.mjs"]);
const PATCHED = ["scripts/lib/talk-rls-test-auth.mjs", "scripts/issue-anpi-rls-jwt.mjs", "scripts/test-tlv-payment-rls-staging.mjs", "scripts/verify-talk-rls-staging.mjs", "scripts/verify-partner-mgmt-real-login.mjs", "scripts/verify-partner-api-auth-live200.mjs", "scripts/smoke-platform-nb1m-post-fe-deploy-final-smoke.mjs"];

const git = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1e9 });
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(os.tmpdir(), "tasful-port-backups", `${path.basename(target)}-${stamp}`);
const report = { target, mode: apply ? "APPLY" : "DRY_RUN", backupDir: apply ? backupDir : null, files: [] };
const note = (file, action, detail = "") => report.files.push({ file, action, detail });
const toLf = (x) => x.replace(/\r\n/g, "\n");

function backup(rel) {
  const src = path.join(target, rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function nodeCheck(content) {
  const tmp = path.join(os.tmpdir(), `port-check-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, content);
  const ok = spawnSync("node", ["--check", tmp], { encoding: "utf8" }).status === 0;
  fs.rmSync(tmp, { force: true });
  return ok;
}

// 1. new files
for (const rel of NEW_FILES) {
  const src = path.join(here, rel), dst = path.join(target, rel);
  if (!fs.existsSync(src)) { note(rel, "SKIP", "missing in source"); continue; }
  const content = fs.readFileSync(src);
  if (fs.existsSync(dst)) {
    if (sha(fs.readFileSync(dst)) === sha(content)) { note(rel, "UNCHANGED", "target already has this version"); continue; }
    if (MANAGED.has(rel)) { note(rel, "UPDATE_MANAGED", "older copy of a file this tool installs; replaced (backup kept)"); if (apply) { backup(rel); fs.writeFileSync(dst, content); } continue; }
    note(rel, "SKIP_EXISTING_DIFFERENT", "target-specific file (e.g. allowlist) left as is — regenerate it in the target with the scanner's --generate-allowlist"); continue;
  }
  note(rel, "COPY_NEW");
  if (apply) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, content); }
}

// 2. helpers and scripts
for (const rel of PATCHED) {
  const dst = path.join(target, rel), mine = path.join(here, rel);
  if (!fs.existsSync(dst)) { note(rel, "SKIP", "not present in target"); continue; }
  const baseBlob = git(here, ["show", `HEAD:${rel}`]);
  const targetHeadBlob = git(target, ["rev-parse", `HEAD:${rel}`]).stdout.trim();
  const myHeadBlob = git(here, ["rev-parse", `HEAD:${rel}`]).stdout.trim();
  if (!targetHeadBlob || targetHeadBlob !== myHeadBlob) { note(rel, "SKIP_DIFFERENT_BASE", "target HEAD blob differs from the shared base; port manually"); continue; }
  const rawOurs = fs.readFileSync(dst, "utf8");
  const eol = rawOurs.includes("\r\n") ? "\r\n" : "\n";
  const ours = toLf(rawOurs), theirs = toLf(fs.readFileSync(mine, "utf8")), base = toLf(baseBlob.stdout);
  const dirty = git(target, ["status", "--short", "--", rel]).stdout.trim();
  let merged, how;
  if (ours === base) { merged = theirs; how = "REPLACE_CLEAN"; }
  else {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "port-merge-"));
    fs.writeFileSync(path.join(d, "ours"), ours); fs.writeFileSync(path.join(d, "base"), base); fs.writeFileSync(path.join(d, "theirs"), theirs);
    const r = spawnSync("git", ["merge-file", "-p", path.join(d, "ours"), path.join(d, "base"), path.join(d, "theirs")], { encoding: "utf8", maxBuffer: 1e9 });
    fs.rmSync(d, { recursive: true, force: true });
    if (r.status !== 0) { note(rel, "SKIP_MERGE_CONFLICT", `${r.status} conflict(s) — left to the containment pass (local modifications: ${dirty ? "yes" : "no"})`); continue; }
    merged = r.stdout; how = "THREE_WAY_MERGE";
  }
  if (merged === ours) { note(rel, "UNCHANGED", "already equal to the hardened version"); continue; }
  if (!nodeCheck(merged)) { note(rel, "SKIP_SYNTAX", "merged result failed node --check — left untouched"); continue; }
  note(rel, how, `local-mod:${dirty ? "yes" : "no"} before:${sha(ours)} after:${sha(merged)}`);
  if (apply) { backup(rel); fs.writeFileSync(dst, eol === "\r\n" ? merged.replace(/\n/g, "\r\n") : merged); }
}

// 3. containment pass
const guardUrl = pathToFileURL(path.join(here, "scripts/lib/test-auth-guard-v1.mjs")).href;
const { PUBLIC_PASSWORD_SHA256, PUBLIC_PASSWORD_LENGTHS } = await import(guardUrl);
const { scanRepo } = await import(pathToFileURL(path.join(here, "scripts/check-no-credential-literals-v1.mjs")).href);
const TOKEN = /[A-Za-z0-9!@#%^&*_.\-]{8,40}/g;
const PROD_DEFAULT = /process\.env\.SUPABASE_URL\s*\|\|\s*"https:\/\/ddojquacsyqesrjhcvmn\.supabase\.co"/g;
function contain(text, rel) {
  let out = text;
  const changes = [];
  out = out.replace(TOKEN, (t) => {
    if (!PUBLIC_PASSWORD_LENGTHS.has(t.length) || !PUBLIC_PASSWORD_SHA256.has(crypto.createHash("sha256").update(t).digest("hex"))) return t;
    if (!changes.includes("published-value-removed")) changes.push("published-value-removed");
    return rel.endsWith(".md") ? "<redacted: published value removed>" : "";
  });
  if (PROD_DEFAULT.test(out)) { out = out.replace(PROD_DEFAULT, 'process.env.SUPABASE_URL || ""'); changes.push("implicit-Production-URL-default-removed"); }
  const guardPresent = fs.existsSync(path.join(target, "scripts/lib/test-auth-guard-v1.mjs")) || apply === false;
  if (/\.(mjs|js)$/.test(rel) && /^const SUPABASE_URL\s*=/m.test(out) && !/assertTestAuthTarget/.test(out) && guardPresent && /^scripts\/[^/]+\.(mjs|js)$/.test(rel)) {
    const nl = out.includes("\r\n") ? "\r\n" : "\n";
    out = out.replace(/^(const SUPABASE_URL\s*=[^\n]*\n)/m, (m) => m + "assertTestAuthTarget(SUPABASE_URL); // Staging host or loopback only (credential recontamination guard)" + nl);
    const imp = 'import { assertTestAuthTarget } from "./lib/test-auth-guard-v1.mjs";' + nl;
    const idx = out.search(/^import /m);
    out = idx >= 0 ? out.slice(0, idx) + imp + out.slice(idx) : imp + out;
    changes.push("target-assertion-injected");
  }
  return { out, changes };
}
const flagged = scanRepo({ root: target, allowlistPath: path.join(here, "scripts/credential-scan-allowlist-v1.json") }).bad.map((b) => b.file);
const containTargets = [...new Set([...flagged, "scripts/verify-partner-mgmt-real-login.mjs", "scripts/verify-partner-api-auth-live200.mjs"])].filter((r) => /\.(mjs|js|md|json|ps1)$/.test(r) && fs.existsSync(path.join(target, r)));
for (const rel of containTargets) {
  const p = path.join(target, rel);
  const before = fs.readFileSync(p, "utf8");
  const { out, changes } = contain(before, rel);
  if (out === before) continue;
  if (/\.(mjs|js)$/.test(rel) && !nodeCheck(out)) { note(rel, "CONTAIN_SKIP_SYNTAX", "result failed node --check — untouched"); continue; }
  note(rel, "CONTAIN", changes.join("+"));
  if (apply) { backup(rel); fs.writeFileSync(p, out); }
}
console.log(JSON.stringify(report, null, 1));
