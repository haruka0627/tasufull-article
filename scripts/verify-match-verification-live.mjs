#!/usr/bin/env node
/**
 * MATCH verification live verification (linked ref · T1/T2)
 *
 *   node scripts/verify-match-verification-live.mjs
 *   node scripts/verify-match-verification-live.mjs --skip-deploy
 *   node scripts/verify-match-verification-live.mjs --skip-ui
 */
import { spawnSync } from "node:child_process";
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
const skipDeploy = process.argv.includes("--skip-deploy");
const skipUi = process.argv.includes("--skip-ui");
const skipMigration = process.argv.includes("--skip-migration");

const FN = "match-submit-verification";

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

async function login(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.access_token || "";
}

async function restFetch(cfg, { table, method = "GET", query = "", body, token }) {
  const key = token ? cfg.anonKey : cfg.serviceRoleKey;
  const auth = token || cfg.serviceRoleKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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

async function edgePost(cfg, body, token) {
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.url}/functions/v1/${FN}`, {
    method: "POST",
    headers,
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

function applyMigrationFile(relPath) {
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", relPath]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 600));
}

function applyMigrations() {
  applyMigrationFile("supabase/migrations/20260625100000_match_verification_age_type.sql");
  applyMigrationFile("supabase/migrations/20260625110000_match_verification_profile_sync.sql");
}

function deployFunction() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    FN,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

async function cleanupVerifications(cfg, userId) {
  await restFetch(cfg, {
    table: "match_verifications",
    method: "DELETE",
    query: `user_id=eq.${userId}`,
  });
  await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `user_id=eq.${userId}&archived_at=is.null`,
    body: { verification_status: "none" },
  });
}

async function ensureProfile(cfg, userId) {
  const existing = await restFetch(cfg, {
    table: "match_profiles",
    query: `user_id=eq.${userId}&archived_at=is.null&select=id`,
  });
  if (Array.isArray(existing.json) && existing.json.length) return;
  await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: userId,
      nickname: `Verify ${userId}`,
      gender: "private",
      birth_date: "1995-06-15",
      prefecture: "東京都",
      profile_status: "active",
      verification_status: "none",
    },
  });
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
  const out = path.join(ROOT, "reports", "match-verification-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Verification Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Design decisions\n\n`;
  md += `| Topic | Decision |\n|-------|----------|\n`;
  md += `| eKYC | **未連携**（provider=manual, metadata.mvp=true） |\n`;
  md += `| 書類画像 | **保存しない**（storage path 未送信） |\n`;
  md += `| API type \`identity\` | DB \`identity_document\` にマップ |\n`;
  md += `| API type \`age\` | DB \`age\` 行（migration 追加） |\n`;
  md += `| age_verified | **専用カラムなし**。年齢は \`match_verifications(type=age)\` で管理。承認後に profile 反映は管理 API TODO |\n`;
  md += `| profile 反映 | identity 申請時のみ \`verification_status=pending\` |\n`;
  md += `| 重複申請 | 同一 type の open 行を **update**（冪等） |\n`;
  md += `| 一覧取得 | 同一 Edge \`intent=list\`（追加 Function なし） |\n\n`;
  md += `## Admin TODO\n\n`;
  md += `- \`match-admin-review\` live 化（verification approve/reject）\n`;
  md += `- pending 一覧 UI（\`match_verifications.status in (pending, under_review)\`）\n`;
  md += `- 承認時 \`match_profiles.verification_status = verified\`（identity）/ age 承認フラグ\n`;
  md += `- eKYC ベンダー連携時は \`provider=ekyc_vendor\` + storage path のみ\n\n`;
  md += `## Re-match / safety regression\n\n`;
  md += `本スクリプトは verification 専用。コアE2E/safety/unmatch は別 verify スクリプトで維持。\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-verification-live.mjs\n`;
  md += `npx supabase db query --linked --yes -f supabase/migrations/20260625100000_match_verification_age_type.sql\n`;
  md += `npx supabase db query --linked --yes -f supabase/migrations/20260625110000_match_verification_profile_sync.sql\n`;
  md += `npx supabase functions deploy ${FN} --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
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

  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      ...MATCH_UI_VIEWPORTS,
      { label: "768×1024", width: 768, height: 1024 },
      { label: "1280×900", width: 1280, height: 900 },
    ];
    for (const vp of viewports) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err.message || err)));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !/favicon\.ico/i.test(msg.text())) errors.push(msg.text());
      });
      await page.setViewportSize(matchViewportSize(vp));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });
      await page.goto(`${baseUrl}/match/match-verify.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      await assertMatchNoHorizontalOverflow(page);
      const label = vp.label || `${vp.width}px`;
      const hasWiring = await page.evaluate(() => Boolean(window.MatchVerificationWiring));
      if (hasWiring) pass("UI", `${label} wiring`, "loaded");
      else fail("UI", `${label} wiring`, "missing");
      if (errors.length) fail("UI", `${label} console`, errors.slice(0, 2).join("; "));
      else pass("UI", `${label} console`, "0 errors");
      await page.close();
    }

    const stubPage = await browser.newPage();
    await stubPage.goto(`${baseUrl}/match/match-verify.html`, { waitUntil: "domcontentloaded" });
    const stubMode = await stubPage.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (stubMode === "client_stub") pass("Smoke", "client_stub default", stubMode);
    else fail("Smoke", "client_stub default", stubMode);
    await stubPage.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH verification live · ref=${PROJECT_REF}\n`);

  if (!skipMigration) {
    try {
      applyMigrations();
      pass("Migration", "verification migrations", "applied");
    } catch (err) {
      fail("Migration", "apply", String(err.message || err));
    }
  } else {
    pass("Migration", "skipped", "--skip-migration");
  }

  if (!skipDeploy) {
    try {
      deployFunction();
      pass("Deploy", FN, "deployed");
    } catch (err) {
      fail("Deploy", FN, String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  let t1Token = "";
  let t2Token = "";
  let identityId = "";

  try {
    [t1Token, t2Token] = await Promise.all([login(cfg, T1.email), login(cfg, T2.email)]);
    if (!t1Token || !t2Token) throw new Error("login failed");
    pass("Auth", "T1/T2 login", "ok");
  } catch (err) {
    fail("Auth", "login", String(err.message || err));
  }

  if (t1Token && t2Token) {
    try {
      await ensureProfile(cfg, "t1");
      await ensureProfile(cfg, "t2");
      await cleanupVerifications(cfg, "t1");
      await cleanupVerifications(cfg, "t2");

      const anon = await edgePost(cfg, { intent: "submit", verification_type: "identity" }, undefined);
      if (anon.status === 401) pass("Security", "anon 401", "401");
      else fail("Security", "anon 401", `status=${anon.status}`);

      const badType = await edgePost(cfg, { intent: "submit", verification_type: "ekyc_vendor" }, t1Token);
      if (badType.status === 422) pass("Validation", "invalid type", "422");
      else fail("Validation", "invalid type", `status=${badType.status}`);

      const identity = await edgePost(
        cfg,
        {
          intent: "submit",
          verification_type: "identity",
          id_document_type: "drivers_license",
        },
        t1Token,
      );
      if (identity.status !== 200 || identity.json?.status !== "pending") {
        throw new Error(`identity: ${identity.status} ${identity.text?.slice(0, 200)}`);
      }
      identityId = String(identity.json.verification_id || "");
      pass("Submit", "T1 identity pending", identityId.slice(0, 8));

      const profile = await restFetch(cfg, {
        table: "match_profiles",
        query: "user_id=eq.t1&archived_at=is.null&select=verification_status",
      });
      if (profile.json?.[0]?.verification_status === "pending") {
        pass("Profile", "verification_status pending", "ok");
      } else {
        fail("Profile", "verification_status", JSON.stringify(profile.json?.[0]));
      }

      const dup = await edgePost(
        cfg,
        { intent: "submit", verification_type: "identity", id_document_type: "passport" },
        t1Token,
      );
      if (dup.status === 200 && dup.json?.verification_id === identityId) {
        pass("Submit", "identity duplicate update", "same id");
      } else {
        fail("Submit", "identity duplicate", `id=${dup.json?.verification_id}`);
      }

      const age = await edgePost(cfg, { intent: "submit", verification_type: "age" }, t1Token);
      if (age.status !== 200 || age.json?.status !== "pending") {
        throw new Error(`age: ${age.status} ${age.text?.slice(0, 200)}`);
      }
      pass("Submit", "T1 age pending", String(age.json.verification_id).slice(0, 8));

      const rows = await restFetch(cfg, {
        table: "match_verifications",
        query: "user_id=eq.t1&archived_at=is.null&select=verification_type,status,id_document_storage_path",
      });
      const list = Array.isArray(rows.json) ? rows.json : [];
      const types = list.map((r) => r.verification_type);
      if (types.includes("identity_document") && types.includes("age")) {
        pass("DB", "verification rows", types.join(","));
      } else {
        fail("DB", "verification rows", types.join(","));
      }
      const hasStorage = list.some((r) => r.id_document_storage_path);
      if (!hasStorage) pass("Security", "no document storage path", "ok");
      else fail("Security", "no document storage path", "found path");

      const t1List = await edgePost(cfg, { intent: "list" }, t1Token);
      const t2List = await edgePost(cfg, { intent: "list" }, t2Token);
      if (t1List.status === 200 && (t1List.json?.items?.length ?? 0) >= 2) {
        pass("List", "T1 items", String(t1List.json.items.length));
      } else {
        fail("List", "T1 items", String(t1List.json?.items?.length));
      }
      if (t2List.status === 200 && (t2List.json?.items?.length ?? 0) === 0) {
        pass("List", "T2 isolated", "0 items");
      } else {
        fail("List", "T2 isolated", String(t2List.json?.items?.length));
      }

      const t2Identity = await edgePost(
        cfg,
        { intent: "submit", verification_type: "identity" },
        t2Token,
      );
      if (t2Identity.status === 200 && t2Identity.json?.verification_id !== identityId) {
        pass("Security", "T2 own application", t2Identity.json.verification_id.slice(0, 8));
      } else {
        fail("Security", "T2 own application", `status=${t2Identity.status}`);
      }
    } catch (err) {
      fail("Flow", "verification", String(err.message || err));
    }
  }

  if (!skipUi && t1Token) {
    const port = 18791;
    const server = await startStaticServer(ROOT, port);
    try {
      await runUiSmoke(`http://127.0.0.1:${port}`, t1Token);
    } catch (err) {
      fail("UI", "playwright", String(err.message || err));
    } finally {
      server.close();
    }
  } else if (skipUi) {
    pass("UI", "skipped", "--skip-ui");
  }

  await closeAllBrowsers();
  const failed = results.filter((r) => !r.ok);
  writeReport(
    failed.length === 0
      ? "Verification MVP live passed on linked ref."
      : `${failed.length} check(s) failed.`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
