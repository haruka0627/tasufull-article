#!/usr/bin/env node
/**
 * MATCH profile live verification (linked ref · T1/T2)
 *
 *   node scripts/verify-match-profile-live.mjs
 *   node scripts/verify-match-profile-live.mjs --skip-deploy
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const T3 = slotByName("T3");
const skipDeploy = process.argv.includes("--skip-deploy");

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const PROFILE_FUNCTIONS = Object.freeze(["match-upsert-profile", "match-upload-photo"]);

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, step, detail = "") {
  results.push({ section, step, ok: true, detail });
  console.log(`  OK  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(section, step, detail = "") {
  results.push({ section, step, ok: false, detail });
  console.error(`  NG  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function restFetch(cfg, { table, query = "", token, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = token || (serviceRole ? cfg.serviceRoleKey : cfg.anonKey);
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    headers: { apikey: key, Authorization: `Bearer ${auth}` },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function edgePost(cfg, functionName, body, token) {
  const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, text };
}

function deployProfileFunctions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...PROFILE_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

async function checkBucketMigration(cfg) {
  const res = await fetch(`${cfg.url}/storage/v1/bucket/match-profile-photos`, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    },
  });
  if (res.status !== 200) {
    throw new Error(`storage API bucket check status=${res.status}`);
  }
  const json = await res.json().catch(() => ({}));
  if (json?.id !== "match-profile-photos" && json?.name !== "match-profile-photos") {
    throw new Error("bucket id mismatch");
  }
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath.replace(/^\//, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ct = filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : filePath.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function writeReport(summary) {
  const out = path.join(ROOT, "reports", "match-profile-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Profile Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Hobby tag policy\n\n`;
  md += `**既存マスタのみ許可**（\`match_hobby_tags.slug\`）。自由追加は不可。  \n`;
  md += `UI チップは \`data-hobby-slug\` でマスタと対応。不足分は migration で \`cafe\` / \`reading\` を追加。\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-profile-live.mjs\n`;
  md += `npx supabase db query --linked --yes -f supabase/migrations/20260624100000_match_profile_storage.sql\n`;
  md += `npx supabase functions deploy match-upsert-profile match-upload-photo --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  fs.writeFileSync(out, md, "utf8");
  console.log(`\nReport: ${out}`);
}

async function runUiSmoke(baseUrl, t1Token) {
  const edgeBoot = ({ functionsBase, token }) => {
    const boot = () => {
      if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
      window.TasfulMatchAuth.configure({
        isAuthenticated: true,
        talkUserId: "t1",
        matchUserId: "t1",
      });
      window.TasfulMatchAPI.configure({
        mode: "edge_stub",
        functionsBaseUrl: functionsBase,
        getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      });
    };
    document.addEventListener("DOMContentLoaded", boot);
    boot();
  };

  for (const vp of [
    ...MATCH_UI_VIEWPORTS,
    { label: "768×1024", width: 768, height: 1024 },
    { label: "1280×900", width: 1280, height: 900 },
  ]) {
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: matchViewportSize(vp) });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });
      await page.goto(`${baseUrl}/match/match-profile-create.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-match-profile-wizard]", { timeout: 8000 });
      await assertMatchNoHorizontalOverflow(page, "profile-create", vp);
      if (errors.length) fail("UI", `console @${vp.label}`, errors.join("; "));
      else pass("UI", `console @${vp.label}`, "0 errors");
      await page.close();
    });
  }

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/match/match-profile-create.html`, { waitUntil: "domcontentloaded" });
    const mode = await page.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (mode === "client_stub") pass("Smoke", "client_stub default", mode);
    else fail("Smoke", "client_stub default", mode);
    await page.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH profile live · ref=${PROJECT_REF}\n`);

  try {
    await checkBucketMigration(cfg);
    pass("Migration", "storage bucket", "match-profile-photos");
  } catch (err) {
    fail("Migration", "storage bucket", String(err.message || err));
  }

  if (!skipDeploy) {
    try {
      deployProfileFunctions();
      pass("Deploy", "edge functions", PROFILE_FUNCTIONS.join(", "));
    } catch (err) {
      fail("Deploy", "edge functions", String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  const t1Login = await login(cfg, T1.email);
  const t2Login = await login(cfg, T2.email);
  const t3Login = await login(cfg, T3.email);
  const t1 = t1Login.data?.access_token || "";
  const t2 = t2Login.data?.access_token || "";
  const t3 = t3Login.data?.access_token || "";
  if (!t1 || !t2 || !t3) {
    fail("JWT", "login", "T1/T2/T3");
    writeReport("login failed");
    process.exit(1);
  }
  pass("JWT", "T1/T2/T3 login", "ok");

  const basePayload = {
    nickname: "E2E Live T1",
    gender: "private",
    birth_date: "1995-03-15",
    prefecture: "東京都",
    city: "渋谷区",
    bio: "linked ref profile live smoke",
    purpose: "love",
    hobby_slugs: ["cafe", "travel"],
    publish: true,
  };

  let profileId = "";
  try {
    const create = await edgePost(cfg, "match-upsert-profile", basePayload, t1);
    if (create.status !== 200 || !create.json?.profile_id) {
      throw new Error(`upsert ${create.status} ${create.text?.slice(0, 200)}`);
    }
    profileId = String(create.json.profile_id);
    pass("Profile", "T1 upsert create/update", profileId.slice(0, 8) + "…");

    const again = await edgePost(
      cfg,
      "match-upsert-profile",
      { ...basePayload, nickname: "E2E Live T1 Updated" },
      t1,
    );
    if (again.status !== 200 || String(again.json?.profile_id) !== profileId) {
      throw new Error("duplicate profile on update");
    }
    pass("Profile", "idempotent upsert", "same profile_id");

    const dupCount = await restFetch(cfg, {
      table: "match_profiles",
      query: "user_id=eq.t1&archived_at=is.null&select=id",
      serviceRole: true,
    });
    if (!Array.isArray(dupCount.json) || dupCount.json.length !== 1) {
      fail("Profile", "single row per user", String(dupCount.json?.length ?? 0));
    } else {
      pass("Profile", "single row per user", "1");
    }
  } catch (err) {
    fail("Profile", "upsert flow", String(err.message || err));
  }

  try {
    const photo1 = await edgePost(
      cfg,
      "match-upload-photo",
      {
        content_base64: TINY_PNG_BASE64,
        content_type: "image/png",
        is_main: true,
      },
      t1,
    );
    if (photo1.status !== 200 || !photo1.json?.photo_id) {
      throw new Error(`photo1 ${photo1.status} ${photo1.text?.slice(0, 200)}`);
    }
    const main1 = String(photo1.json.photo_id);

    const photo2 = await edgePost(
      cfg,
      "match-upload-photo",
      {
        content_base64: TINY_PNG_BASE64,
        content_type: "image/png",
        is_main: true,
      },
      t1,
    );
    if (photo2.status !== 200 || !photo2.json?.photo_id) {
      throw new Error(`photo2 ${photo2.status}`);
    }
    const main2 = String(photo2.json.photo_id);

    const profileRow = await restFetch(cfg, {
      table: "match_profiles",
      query: `id=eq.${profileId}&select=main_photo_id`,
      serviceRole: true,
    });
    const currentMain = profileRow.json?.[0]?.main_photo_id;
    if (currentMain !== main2) {
      fail("Photo", "single main_photo_id", String(currentMain));
    } else {
      pass("Photo", "single main_photo_id", main2.slice(0, 8) + "…");
    }

    const photos = await restFetch(cfg, {
      table: "match_profile_photos",
      query: `profile_id=eq.${profileId}&photo_status=eq.active&select=id`,
      serviceRole: true,
    });
    if (!Array.isArray(photos.json) || photos.json.length < 2) {
      fail("Photo", "match_profile_photos rows", String(photos.json?.length ?? 0));
    } else {
      pass("Photo", "match_profile_photos rows", String(photos.json.length));
    }
    void main1;
  } catch (err) {
    fail("Photo", "upload flow", String(err.message || err));
  }

  try {
    const publicView = await restFetch(cfg, {
      table: "match_profiles_public",
      query: "user_id=eq.t1&select=user_id,display_name,hobby_tags,main_photo_url",
      token: t2,
    });
    if (publicView.status !== 200 || !Array.isArray(publicView.json) || !publicView.json.length) {
      fail("Public", "T2 sees T1", `status=${publicView.status}`);
    } else {
      pass("Public", "T2 sees T1", publicView.json[0].display_name || "ok");
    }
  } catch (err) {
    fail("Public", "match_profiles_public", String(err.message || err));
  }

  const anon = await edgePost(cfg, "match-upsert-profile", basePayload, "");
  if (anon.status === 401) pass("Negative", "anon upsert", "401");
  else fail("Negative", "anon upsert", `status=${anon.status}`);

  const foreign = await edgePost(cfg, "match-upsert-profile", { ...basePayload, user_id: "t2" }, t1);
  if (foreign.status === 403) pass("Negative", "foreign user_id", "403");
  else fail("Negative", "foreign user_id", `status=${foreign.status}`);

  const foreignPhoto = await edgePost(
    cfg,
    "match-upload-photo",
    { content_base64: TINY_PNG_BASE64, content_type: "image/png", profile_id: profileId },
    t3,
  );
  if (foreignPhoto.status === 403) pass("Negative", "foreign photo profile_id", "403");
  else fail("Negative", "foreign photo profile_id", `status=${foreignPhoto.status}`);

  let server;
  try {
    server = await startStaticServer(ROOT, 8796);
    await runUiSmoke("http://127.0.0.1:8796", t1);
  } catch (err) {
    fail("UI", "playwright", String(err.message || err));
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await closeAllBrowsers();
  }

  const stub = spawnSync(process.execPath, [path.join("scripts", "test-match-api-client-stub.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (stub.status === 0) pass("Smoke", "test-match-api-client-stub", "PASS");
  else fail("Smoke", "test-match-api-client-stub", (stub.stderr || "").slice(0, 120));

  const failed = results.filter((r) => !r.ok);
  writeReport(
    failed.length
      ? `${failed.length} check(s) failed.`
      : "Profile live path verified on linked ref (T1/T2).",
  );
  console.log(`\nVerdict: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
