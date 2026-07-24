#!/usr/bin/env node
/**
 * Builder General Jobs Phase 2 — deploy flag injection verify (local only)
 *
 *   node scripts/verify-builder-general-jobs-deploy-flags.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";
import {
  detectSupabaseTier,
  parseBoolEnv,
  parseStorageModeEnv,
  renderBuilderDeployFlagsJs,
  validateSupabaseTierAlignment,
} from "./lib/builder-deploy-flags.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGE = path.join(ROOT, "deploy/cloudflare/stage-cloudflare-pages.mjs");
const DIST_FLAGS = path.join(ROOT, "deploy/cloudflare/dist/builder/builder-general-jobs-deploy-flags.js");
const STAGING_URL = "https://ahlxuyvhzqdqaojiywmu.supabase.co";

function loadStagingAnonKey() {
  const localCfg = path.join(ROOT, "chat-supabase-config.js");
  if (fs.existsSync(localCfg)) {
    const js = fs.readFileSync(localCfg, "utf8");
    const key = js.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
    if (key && js.includes(STAGING_URL.replace("https://", "").split(".")[0])) return key;
    if (key) return key;
  }
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.staging-placeholder";
}

const STAGING_ANON = loadStagingAnonKey();

const errors = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log(`PASS ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.error(`FAIL ${msg}`);
}

function runBuild(env) {
  const merged = { ...process.env };
  delete merged.TASU_BUILDER_GENERAL_JOBS_REPO;
  delete merged.TASU_BUILDER_STORAGE_MODE;
  Object.assign(merged, env);
  if (env.TASU_BUILDER_GENERAL_JOBS_REPO === undefined) {
    delete merged.TASU_BUILDER_GENERAL_JOBS_REPO;
  }
  if (env.TASU_BUILDER_STORAGE_MODE === undefined) {
    delete merged.TASU_BUILDER_STORAGE_MODE;
  }
  return spawnSync(process.execPath, [STAGE], {
    cwd: ROOT,
    env: merged,
    encoding: "utf8",
  });
}

function readDistFlags() {
  return fs.readFileSync(DIST_FLAGS, "utf8");
}

function testUnitParsers() {
  if (parseBoolEnv("true") !== true) fail("parseBoolEnv true");
  else pass("parseBoolEnv true");
  if (parseBoolEnv("false") !== false) fail("parseBoolEnv false");
  else pass("parseBoolEnv false");
  if (parseStorageModeEnv("supabase") !== "supabase") fail("parseStorageMode supabase");
  else pass("parseStorageMode supabase");
  if (parseStorageModeEnv("local") !== "local") fail("parseStorageMode local");
  else pass("parseStorageMode local");
}

function testTierAlignment() {
  const previewOk = validateSupabaseTierAlignment(STAGING_URL, {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "feature-x",
  });
  if (!previewOk.ok || previewOk.cfDeployTarget !== "preview") fail("preview+staging alignment");
  else pass("preview+staging alignment");

  const previewBad = validateSupabaseTierAlignment("https://ddojquacsyqesrjhcvmn.supabase.co", {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "feature-x",
  });
  if (previewBad.ok) fail("preview+production must fail");
  else pass("preview+production blocked");

  const prodOk = validateSupabaseTierAlignment("https://ddojquacsyqesrjhcvmn.supabase.co", {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "cf-pages-deploy",
  });
  if (!prodOk.ok || prodOk.cfDeployTarget !== "production") fail("production+production alignment");
  else pass("production+production alignment");

  const prodBad = validateSupabaseTierAlignment(STAGING_URL, {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "cf-pages-deploy",
  });
  if (prodBad.ok) fail("production+staging must fail");
  else pass("production+staging blocked");
}

function testRenderRollbackSnippet() {
  const js = renderBuilderDeployFlagsJs({
    storageMode: "local",
    generalJobsRepo: false,
    supabaseTier: "production",
    cfDeployTarget: "production",
  });
  if (!js.includes('TASU_BUILDER_STORAGE_MODE = "local"')) fail("rollback render storage");
  else pass("rollback render storage=local");
  if (!js.includes("TASU_BUILDER_GENERAL_JOBS_REPO = false")) fail("rollback render repo");
  else pass("rollback render repo=false");
}

function testBuildMatrix() {
  const cases = [
    {
      id: "flags-on-staging",
      env: {
        TASFUL_SUPABASE_URL: STAGING_URL,
        TASFUL_SUPABASE_ANON_KEY: STAGING_ANON,
        TASU_BUILDER_GENERAL_JOBS_REPO: "true",
        TASU_BUILDER_STORAGE_MODE: "supabase",
      },
      expect: {
        repo: true,
        mode: "supabase",
        tier: "staging",
      },
    },
    {
      id: "rollback-off",
      env: {
        TASFUL_SUPABASE_URL: STAGING_URL,
        TASFUL_SUPABASE_ANON_KEY: STAGING_ANON,
        TASU_BUILDER_GENERAL_JOBS_REPO: "false",
        TASU_BUILDER_STORAGE_MODE: "local",
      },
      expect: {
        repo: false,
        mode: "local",
        tier: "staging",
      },
    },
    {
      id: "unset-flags",
      env: {
        TASFUL_SUPABASE_URL: STAGING_URL,
        TASFUL_SUPABASE_ANON_KEY: STAGING_ANON,
      },
      expect: {
        repoUnset: true,
        modeUnset: true,
        tier: "staging",
      },
    },
  ];

  for (const spec of cases) {
    const r = runBuild(spec.env);
    if (r.status !== 0) {
      fail(`build ${spec.id}: ${r.stderr || r.stdout}`);
      continue;
    }
    if (!fs.existsSync(DIST_FLAGS)) {
      fail(`build ${spec.id}: deploy-flags.js missing`);
      continue;
    }
    const body = readDistFlags();
    if (detectSupabaseTier(STAGING_URL) !== spec.expect.tier) {
      fail(`build ${spec.id}: tier detect`);
    }
    if (spec.expect.repoUnset) {
      if (body.includes("TASU_BUILDER_GENERAL_JOBS_REPO =")) fail(`build ${spec.id}: repo should be unset`);
      else pass(`build ${spec.id}: repo unset (staging-flags may auto-on locally)`);
    } else if (!body.includes(`TASU_BUILDER_GENERAL_JOBS_REPO = ${spec.expect.repo}`)) {
      fail(`build ${spec.id}: repo=${spec.expect.repo}`);
    } else {
      pass(`build ${spec.id}: repo=${spec.expect.repo}`);
    }
    if (spec.expect.modeUnset) {
      if (body.includes("TASU_BUILDER_STORAGE_MODE =")) fail(`build ${spec.id}: mode should be unset`);
      else pass(`build ${spec.id}: mode unset`);
    } else if (!body.includes(`TASU_BUILDER_STORAGE_MODE = "${spec.expect.mode}"`)) {
      fail(`build ${spec.id}: mode=${spec.expect.mode}`);
    } else {
      pass(`build ${spec.id}: mode=${spec.expect.mode}`);
    }
  }
}

function testDistArtifacts() {
  if (!fs.existsSync(DIST_FLAGS)) {
    fail("dist builder-general-jobs-deploy-flags.js missing");
    return;
  }
  const body = readDistFlags();
  if (!body.includes("TASU_BUILDER_GENERAL_JOBS_REPO = true")) fail("dist repo=true missing");
  else pass("dist repo=true");
  if (!body.includes('TASU_BUILDER_STORAGE_MODE = "supabase"')) fail("dist mode=supabase missing");
  else pass("dist mode=supabase");
  if (!body.includes("TASU_BUILDER_DEPLOY_FLAGS_META")) fail("dist meta missing");
  else pass("dist meta present");

  const htmlPath = path.join(ROOT, "deploy/cloudflare/dist/builder/admin-applications.html");
  if (!fs.existsSync(htmlPath)) {
    fail("dist admin-applications.html missing");
    return;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes("builder-general-jobs-deploy-flags.js")) fail("HTML deploy-flags script not injected");
  else pass("HTML deploy-flags script injected");
  const flagsIdx = html.indexOf("builder-general-jobs-deploy-flags.js");
  const configIdx = html.indexOf("builder-config.js");
  if (flagsIdx < 0 || configIdx < 0 || flagsIdx > configIdx) {
    fail("HTML script order: deploy-flags must precede builder-config");
  } else {
    pass("HTML script order deploy-flags → builder-config");
  }
}

async function testRuntimeOn8788() {
  await requireDevServer();
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/builder/admin-applications.html?talkDev=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(800);

    const onState = await page.evaluate(() => ({
      storage: window.TasuBuilderConfig?.getStorageMode?.(),
      repo: window.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.(),
      meta: window.TASU_BUILDER_DEPLOY_FLAGS_META || null,
      rawRepo: window.TASU_BUILDER_GENERAL_JOBS_REPO,
      rawMode: window.TASU_BUILDER_STORAGE_MODE,
    }));

    if (!onState.meta) fail("8788 deploy-flags meta missing (rebuild with npm run build:pages)");
    else pass(`8788 meta tier=${onState.meta.supabaseTier} cf=${onState.meta.cfDeployTarget}`);

    if (onState.storage !== "supabase") fail(`8788 storage expected supabase got ${onState.storage}`);
    else pass("8788 storage=supabase");

    if (onState.repo !== true) fail(`8788 repo expected true got ${onState.repo}`);
    else pass("8788 GENERAL_JOBS_REPO enabled");

    await page.evaluate(() => {
      window.TASU_BUILDER_GENERAL_JOBS_REPO = false;
      window.TASU_BUILDER_STORAGE_MODE = "local";
    });
    const rollback = await page.evaluate(() => ({
      storage: window.TasuBuilderConfig?.getStorageMode?.(),
      repo: window.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.(),
    }));
    if (rollback.storage !== "local") fail(`8788 rollback storage got ${rollback.storage}`);
    else pass("8788 rollback storage=local");
    if (rollback.repo !== false) fail(`8788 rollback repo got ${rollback.repo}`);
    else pass("8788 rollback GENERAL_JOBS_REPO=false");
  });
}

async function main() {
  console.log("=== verify-builder-general-jobs-deploy-flags ===\n");

  spawnSync(process.execPath, ["scripts/stop-pages-dev.mjs"], { cwd: ROOT, stdio: "inherit" });

  testUnitParsers();
  testTierAlignment();
  testRenderRollbackSnippet();
  testBuildMatrix();

  // Final build: flags ON for dev runtime check
  const finalBuild = runBuild({
    TASFUL_SUPABASE_URL: STAGING_URL,
    TASFUL_SUPABASE_ANON_KEY: STAGING_ANON,
    TASU_BUILDER_GENERAL_JOBS_REPO: "true",
    TASU_BUILDER_STORAGE_MODE: "supabase",
  });
  if (finalBuild.status !== 0) {
    fail(`final build for 8788: ${finalBuild.stderr || finalBuild.stdout}`);
  } else {
    pass("final build for 8788");
    testDistArtifacts();
    if (process.env.SKIP_8788 === "1") {
      pass("8788 runtime skipped (SKIP_8788=1)");
    } else {
      try {
        await testRuntimeOn8788();
      } catch (err) {
        fail(`8788 runtime: ${err?.message || err} (run: npm run dev)`);
      }
    }
  }

  await closeAllBrowsers();

  console.log(`\n=== RESULT: ${errors.length ? "FAIL" : "PASS"} (${passes.length} pass / ${errors.length} fail) ===`);
  if (errors.length) {
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

await main();
