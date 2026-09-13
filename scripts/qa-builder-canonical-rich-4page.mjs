#!/usr/bin/env node
/**
 * Static + optional Staging QA for Canonical Rich 4-page wiring.
 * Never prints secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(id, detail) {
  results.push({ id, status: "PASS", detail });
}
function fail(id, detail) {
  results.push({ id, status: "FAIL", detail });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const richPages = [
  "builder/new-project.html",
  "builder/provider-profile.html",
  "builder/provider-detail.html",
  "builder/project-detail.html",
];
const mvpLegacy = [
  "builder/mvp-post.html",
  "builder/mvp-partner-register.html",
  "builder/mvp-project-detail.html",
  "builder/mvp-project-new.html",
];

richPages.forEach((p) => (exists(p) ? pass(`exists:${p}`, "present") : fail(`exists:${p}`, "missing")));
mvpLegacy.forEach((p) => (exists(p) ? pass(`legacy:${p}`, "kept") : fail(`legacy:${p}`, "deleted")));

for (const p of ["builder/new-project.html", "builder/provider-profile.html", "builder/provider-detail.html"]) {
  const html = read(p);
  if (/builder\.css|mvp-dark/.test(html)) fail(`no-dark-css:${p}`, "imports dark MVP css");
  else pass(`no-dark-css:${p}`, "isolated light host");
}

const top = read("builder/builder-top.html");
if (top.includes('data-builder-top-action="post_job"') && top.includes("new-project.html")) {
  pass("top-post-job", "post_job → new-project.html");
} else fail("top-post-job", "missing post_job remap");
if (top.includes("/partner-register.html?source=builder") && top.includes('data-builder-top-action="iwasho"')) {
  pass("top-iwasho", "IWASHO partner-register kept");
} else fail("top-iwasho", "IWASHO link missing");
if (top.includes("builder-top-route-bridge.js")) pass("top-bridge", "bridge script loaded");
else fail("top-bridge", "bridge script missing");
if (top.includes("find-workers.html") && top.includes("../public-board.html")) {
  pass("top-find", "find_jobs / find_workers kept");
} else fail("top-find", "find routes missing");

const np = read("builder/new-project.html");
if (np.includes("builder-new-project-wire.js") && np.includes("builder-job-create-core.js")) {
  pass("new-project-wire", "create core + wire");
} else fail("new-project-wire", "wire missing");

const pp = read("builder/provider-profile.html");
if (pp.includes("builder-partner-supabase-sync.js") && pp.includes("builder-provider-store.js")) {
  pass("provider-profile-sync", "PartnerSupabaseSync + ProviderStore");
} else fail("provider-profile-sync", "sync missing");

const fw = read("builder/find-workers.html");
if (fw.includes("builder-search-detail-bridge.js")) pass("search-bridge-fw", "loaded");
else fail("search-bridge-fw", "missing");

const pd = read("builder/project-detail.html");
if (pd.includes("data-canonical-job-detail") && pd.includes("builder-project-detail-canonical-wire.js")) {
  pass("project-detail-bind", "canonical bind host");
} else fail("project-detail-bind", "bind host missing");

const forbiddenSql = [
  "supabase/migrations/20260914120000",
  "supabase/migrations/20260914130000",
];
forbiddenSql.forEach((p) => {
  const hits = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.startsWith(path.basename(p)));
  hits.length ? fail(`no-prod-migration:${p}`, hits.join(",")) : pass(`no-prod-migration:${p}`, "absent");
});

const stagingUrl = process.env.TASU_STAGING_SUPABASE_URL || process.env.SUPABASE_URL || "";
const stagingKey = process.env.TASU_STAGING_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
if (stagingUrl && stagingKey) {
  pass("staging-secrets", "present (values not printed)");
  if (!/supabase\.co/.test(stagingUrl)) fail("staging-url-shape", "unexpected host shape");
  else pass("staging-url-shape", "host looks like supabase");
} else {
  results.push({
    id: "staging-live-write",
    status: "SKIP",
    detail: "Staging secrets not available in this environment. Static QA only.",
  });
}

const failed = results.filter((r) => r.status === "FAIL");
const report = {
  ok: failed.length === 0,
  failed: failed.length,
  passed: results.filter((r) => r.status === "PASS").length,
  skipped: results.filter((r) => r.status === "SKIP").length,
  results,
};
const outDir = path.join(root, "reports/tasful-builder-canonical-rich-4page-functional-wiring-v1");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "qa-static.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, passed: report.passed, failed: report.failed, skipped: report.skipped }, null, 2));
if (failed.length) process.exit(1);
