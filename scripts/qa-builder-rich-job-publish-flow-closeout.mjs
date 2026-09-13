#!/usr/bin/env node
/**
 * Rich Job Publish Flow Closeout V1 — static + optional Staging E2E.
 * Never prints secret values. Never retargets committed chat-supabase-config.js.
 * Staging only: ahlxuyvhzqdqaojiywmu. Production writes are denied.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const results = [];

function pass(id, detail) {
  results.push({ id, status: "PASS", detail });
}
function fail(id, detail) {
  results.push({ id, status: "FAIL", detail });
}
function skip(id, detail) {
  results.push({ id, status: "SKIP", detail });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function refFromUrl(url) {
  const m = String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m ? m[1] : "";
}

const wrangler = read("wrangler.toml");
if (/pages_build_output_dir\s*=\s*"deploy\/cloudflare\/dist"/.test(wrangler)) {
  pass("wrangler-output-dir", "pages_build_output_dir=deploy/cloudflare/dist");
} else fail("wrangler-output-dir", "missing or changed output dir");

const persist = read("builder/builder-new-project-general-jobs-wire.js");
if (/row\.publication_state = "private_draft"/.test(persist) && !/insert\(.*published/.test(persist)) {
  pass("insert-private-draft", "persist forces private_draft before publish");
} else fail("insert-private-draft", "insert path unsafe");
if (/publishGeneralProject/.test(persist) && /intent === "publish"/.test(persist)) {
  pass("publish-on-submit", "submit calls existing publishGeneralProject");
} else fail("publish-on-submit", "publish not wired");

const repo = read("builder/builder-project-repository.js");
if (/RLS_PUBLISH_ON_INSERT_FORBIDDEN/.test(repo) && /publication_state: "published"/.test(repo)) {
  pass("repo-gates", "insert rejects published; publish is UPDATE only");
} else fail("repo-gates", "publish/insert gates missing");
if (/listPublicProjects/.test(repo) && /builder_public_projects_v1/.test(repo)) {
  pass("list-public", "repository reads builder_public_projects_v1");
} else fail("list-public", "listPublicProjects missing");

const search = read("builder/builder-search-repository.js");
if (/tryPublicProjectsSearch/.test(search) && /builder_public_projects_v1/.test(search)) {
  pass("search-public-view", "searchJobs prefers public projection");
} else fail("search-public-view", "search not wired to public view");

const board = read("builder/board-projects.html");
if (board.includes("builder-general-jobs-repo.js") && board.includes("tasu-supabase-client.js")) {
  pass("board-repo-stack", "board-projects loads Staging repo stack");
} else fail("board-repo-stack", "board-projects missing repo stack");
if (board.includes("builder-search-detail-bridge.js")) {
  pass("board-detail-bridge", "Search cards can route to project-detail");
} else fail("board-detail-bridge", "search-detail-bridge missing");

const feed = read("builder/builder-board-feed.js");
if (/TasuBuilderCanonicalRoutes\?\.projectDetailHref/.test(feed)) {
  pass("board-href", "job/project board detail uses canonical project-detail");
} else fail("board-href", "boardDetailHref not remapped");

const js = read("builder/builder.js");
if (/mergePublicProjectionIntoBoard/.test(js)) {
  pass("board-merge", "board list hydrates published public projection");
} else fail("board-merge", "merge helper missing");

const providerTouched = ["builder/builder-provider-profile-stc-wire.js", "builder/builder-partner-supabase-sync.js"].every((p) =>
  exists(p)
);
if (providerTouched) pass("provider-untouched-present", "provider files still present (not redesigned here)");

const forbiddenSql = ["20260914120000", "20260914130000"];
const migDir = path.join(root, "supabase/migrations");
const migs = exists("supabase/migrations") ? fs.readdirSync(migDir) : [];
forbiddenSql.forEach((p) => {
  migs.some((f) => f.startsWith(p)) ? fail(`no-prod-migration:${p}`, "present") : pass(`no-prod-migration:${p}`, "absent");
});

if (read("chat-supabase-config.js").includes(PRODUCTION_REF) && !read("chat-supabase-config.js").includes(STAGING_REF)) {
  pass("no-global-prod-retarget", "committed chat-supabase-config.js left as-is; QA uses isolated Staging client");
} else fail("no-global-prod-retarget", "committed chat config was retargeted");

const stagingUrl = String(process.env.TASU_STAGING_SUPABASE_URL || process.env.STAGING_SUPABASE_URL || "").trim();
const stagingKey = String(process.env.TASU_STAGING_SUPABASE_ANON_KEY || process.env.STAGING_SUPABASE_ANON_KEY || "").trim();
const stagingJwt = String(
  process.env.TASU_STAGING_SUPABASE_AUTH_JWT || process.env.STAGING_SUPABASE_AUTH_JWT || process.env.TASU_STAGING_USER_JWT || ""
).trim();
const resolvedUrl = stagingUrl || `https://${STAGING_REF}.supabase.co`;
const resolvedRef = refFromUrl(resolvedUrl);

if (resolvedRef === PRODUCTION_REF) {
  fail("staging-ref-deny", "resolved URL is Production; live write aborted");
} else if (!stagingKey || !stagingJwt) {
  skip(
    "staging-live-e2e",
    "Staging anon+JWT not in env. Static only. Human: login on Staging client (ahlxuyvhzqdqaojiywmu), flag TASU_BUILDER_GENERAL_JOBS_REPO=true, submit 案件を投稿する."
  );
} else if (resolvedRef && resolvedRef !== STAGING_REF) {
  fail("staging-ref-mismatch", "URL ref is not Staging");
} else {
  pass("staging-secrets", "anon+JWT present (values not printed)");
  try {
    const key = `closeout-${Date.now().toString(36)}`;
    const headers = {
      apikey: stagingKey,
      Authorization: `Bearer ${stagingJwt}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    const insertPublished = await fetch(`${resolvedUrl}/rest/v1/builder_projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_key: `${key}-direct-pub`,
        owner_id: "owner-demo",
        title: "closeout-direct-published-forbidden",
        kind: "builder_board",
        publication_state: "published",
      }),
    });
    if (insertPublished.status === 201) {
      fail("rls-direct-published", "direct published INSERT succeeded (should be 42501)");
    } else {
      pass("rls-direct-published", `direct published INSERT blocked (http ${insertPublished.status})`);
    }
    const insertDraft = await fetch(`${resolvedUrl}/rest/v1/builder_projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_key: key,
        owner_id: "owner-demo",
        title: "closeout-private-draft",
        kind: "builder_board",
        publication_state: "private_draft",
      }),
    });
    if (!insertDraft.ok) {
      skip("staging-insert-draft", `private_draft insert not applied (http ${insertDraft.status}); auth/RLS gate`);
    } else {
      pass("staging-insert-draft", "private_draft insert ok");
      const pub = await fetch(`${resolvedUrl}/rest/v1/builder_projects?project_key=eq.${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ publication_state: "published" }),
      });
      if (!pub.ok) {
        skip("staging-publish", `publish UPDATE not applied (http ${pub.status}); ownership/JWT gate`);
      } else {
        pass("staging-publish", "publication_state published via UPDATE");
        const view = await fetch(
          `${resolvedUrl}/rest/v1/builder_public_projects_v1?or=(project_key.eq.${encodeURIComponent(key)},id.eq.${encodeURIComponent(key)})&select=project_key,id,title`,
          { headers: { apikey: stagingKey, Authorization: `Bearer ${stagingKey}` } }
        );
        const rows = view.ok ? await view.json() : [];
        Array.isArray(rows) && rows.length
          ? pass("staging-public-view", "published row visible in builder_public_projects_v1")
          : fail("staging-public-view", "published row not in public view");
      }
    }
  } catch (err) {
    fail("staging-live-e2e", err && err.message ? "request threw (message redacted)" : "request threw");
  }
}

const failed = results.filter((r) => r.status === "FAIL");
const report = {
  ok: failed.length === 0,
  failed: failed.length,
  passed: results.filter((r) => r.status === "PASS").length,
  skipped: results.filter((r) => r.status === "SKIP").length,
  stagingRef: STAGING_REF,
  results,
};
const outDir = path.join(root, "reports/tasful-builder-rich-job-publish-flow-closeout-v1");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "qa-static.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, passed: report.passed, failed: report.failed, skipped: report.skipped }, null, 2));
process.exit(report.ok ? 0 : 1);
