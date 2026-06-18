#!/usr/bin/env node
/**
 * Deploy preflight: list files to stage (does NOT run git add).
 * Usage: node scripts/report-deploy-git-manifest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

const REQUIRED_UNTRACKED = [
  "favorite-store.js",
  "favorite-actions.js",
  "listing-local-store.js",
  "detail-general.html",
  "detail-general.css",
  "detail-general-loader.js",
  "detail-type-config.js",
  "listing-management.html",
  "listing-management.js",
  "listing-management.css",
  "listing-ai-badge.css",
  "contact-actions.js",
  "login.html",
  "login.js",
  "sales-fees.html",
  "sales-fees.js",
  "sales-fees.css",
  "payment-settings.js",
  "notification-settings.js",
  "member-profile.js",
];

const AI_EXTENSION_JS = [
  "ai-call-consent.js",
  "ai-contact-info.js",
  "ai-cross-search.js",
  "ai-intent-router.js",
  "ai-search-router.js",
  "ai-web-search-serper.js",
];

const SECRET_PATTERNS = [
  { name: "GEMINI_API_KEY literal", re: /GEMINI_API_KEY\s*=\s*["'][^"']+["']/ },
  { name: "Google API key", re: /AIzaSy[a-zA-Z0-9_-]{20,}/ },
  { name: "Stripe live", re: /sk_live_[a-zA-Z0-9]+/ },
  { name: "Stripe test", re: /sk_test_[a-zA-Z0-9]+/ },
  { name: "service_role", re: /service_role|sb_secret_/i },
];

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function lines(cmd) {
  const out = run(cmd);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function isIgnored(rel) {
  try {
    execSync(`git check-ignore -q "${rel.replace(/"/g, '\\"')}"`, { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function scanSecrets(files) {
  const hits = [];
  for (const rel of files) {
    if (!/\.(js|html|json|mjs|env|ts)$/i.test(rel)) continue;
    if (rel.includes("backups/") || rel.includes("node_modules/")) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    } catch {
      continue;
    }
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(text)) hits.push({ file: rel, pattern: p.name });
    }
  }
  return hits;
}

const modified = lines("git -c core.quotepath=false diff --name-only");
const deleted = lines("git -c core.quotepath=false diff --name-only --diff-filter=D");
const untracked = lines("git -c core.quotepath=false ls-files --others --exclude-standard");
const status = lines("git -c core.quotepath=false status --short");

const builder = untracked.filter((f) => f.startsWith("builder/") || f.startsWith("builder-admin/"));
const images = untracked.filter((f) => f.startsWith("images/"));
const models = untracked.filter((f) => f.startsWith("models/"));

const stageUntracked = [
  ...REQUIRED_UNTRACKED.filter((f) => exists(f)),
  ...AI_EXTENSION_JS.filter((f) => exists(f)),
  ...builder,
  ...images,
  ...models,
  ...untracked.filter((f) => {
    if (f.startsWith("anpi-")) return true;
    if (f.startsWith("sql/")) return false;
    if (f.startsWith("docs/")) return false;
    if (f.startsWith("scripts/")) return false;
    if (f.includes("/")) return false;
    return /\.(html|css|js|mjs)$/i.test(f);
  }),
].filter((f, i, a) => a.indexOf(f) === i && !isIgnored(f));

const stageModified = modified.filter((f) => f !== "supabase/.temp/cli-latest");

const stageAll = [...stageModified, ...stageUntracked].sort();

const excludedByGitignore = [
  "backups/ (entire tree)",
  "screenshots/ (entire tree)",
  "scripts/_* and scripts/*.html",
  "supabase/.temp/",
];

const deleteCandidates = [
  ...untracked.filter((f) => f.startsWith("backups/")).slice(0, 5).map(() => null),
];

const requiredCheck = REQUIRED_UNTRACKED.map((f) => ({
  file: f,
  exists: exists(f),
  ignored: isIgnored(f),
  untracked: untracked.includes(f),
  inStageList: stageUntracked.includes(f),
}));

let diffCheckExit = 0;
let diffCheckOut = "";
try {
  diffCheckOut = run("git diff --check 2>&1");
} catch (e) {
  diffCheckExit = e.status || 1;
  diffCheckOut = String(e.stdout || e.stderr || e.message || "");
}

const secretHits = scanSecrets(stageAll);
const anonInConfig = fs.existsSync(path.join(ROOT, "chat-supabase-config.js"))
  ? /eyJhbGci/.test(fs.readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8"))
  : false;

const report = {
  summary: {
    statusLines: status.length,
    modifiedCount: modified.length,
    untrackedCount: untracked.length,
    stageCount: stageAll.length,
    diffCheckExit,
    anonKeyInTrackedConfig: anonInConfig,
  },
  requiredUntracked: requiredCheck,
  stagePaths: stageAll,
  excludedByGitignore,
  deleteCandidates: [
    "backups/_phase2d-extract/ (1119+ files)",
    "backups/*.zip (7 archives)",
    "screenshots/*.png",
    "screenshots/tasful-ui-final-smoke-report.json",
    "scripts/_debug* / scripts/_extract* / scripts/_portal-hero*",
    "scripts/_*.txt / scripts/_*.html fragments",
    "supabase/.temp/cli-latest (do not commit)",
  ],
  secretScan: {
    dangerousHits: secretHits,
    note: anonInConfig
      ? "chat-supabase-config.js has Supabase anon JWT (tracked, expected for client)"
      : null,
  },
  recommendedCommits: [
    "1. fix: chat-user-identity whitespace + .gitignore deploy hygiene",
    "2. feat(detail): Phase 2-D pages, shop footer CSS, favorites wiring",
    "3. feat(platform): detail-general, listing-management, member pages",
    "4. feat(gen-ai): workspace voice/character (modified + tracked assets)",
    "5. feat(builder): builder/ and builder-admin/ MVP",
    "6. chore(scripts): test-tasful-ui-final-smoke, phase2d restore, verify-* (optional separate)",
    "7. docs: production-release-checklist (optional)",
  ],
};

const outPath = path.join(ROOT, "docs", "deploy-git-stage-manifest.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

console.log(JSON.stringify(report.summary, null, 2));
console.log("\nrequired untracked:", requiredCheck.filter((r) => !r.inStageList).length, "missing from stage list");
console.log("manifest:", outPath);
process.exit(requiredCheck.some((r) => !r.exists || !r.inStageList) ? 1 : diffCheckExit);
