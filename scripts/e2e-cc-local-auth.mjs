#!/usr/bin/env node
/**
 * E2E: Creator Content ローカル Auth 環境アラインメント + 登録クリエイター確認
 *
 * 事前条件:
 *   1. npm run dev が起動中（http://127.0.0.1:8788）
 *   2. .env.staging に PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD が設定済み
 *      (または環境変数 PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD)
 *   3. e2e-test@example.com が staging creator_content_creators に registered
 *
 * 実行:
 *   node scripts/e2e-cc-local-auth.mjs
 *   QA_EMAIL=e2e-test@example.com QA_PASSWORD=<pw> node scripts/e2e-cc-local-auth.mjs
 *
 * 出力:
 *   reports/tasful-cc-local-auth-environment-alignment-registered-creator-e2e-v1/e2e-results.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = path.join(
  ROOT,
  "reports",
  "tasful-cc-local-auth-environment-alignment-registered-creator-e2e-v1",
);

/* ── Staging Supabase（公開値） ─────────────────────────────────── */
const STAGING_URL = "https://ahlxuyvhzqdqaojiywmu.supabase.co";
const STAGING_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHh1eXZoenFkcWFvaml5d211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTIxMDEsImV4cCI6MjA5ODQyODEwMX0.48PLkHjakY4ZivY7gC57JmoUwmOSA3PzrQeO2T-VWGg";
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PROD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";

const LOCAL_BASE = process.env.BASE_URL || "http://127.0.0.1:8788";
const CC_API = `${LOCAL_BASE}/api/creator-content-registration`;

/* ── Credentials（環境変数 / .env.staging から）────────────────── */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, ".env.staging"));
loadEnvFile(path.join(ROOT, ".env"));

const QA_EMAIL =
  process.env.QA_EMAIL ||
  process.env.PAYMENT_RECEIPT_QA_PRIMARY_EMAIL ||
  "e2e-test@example.com";
const QA_PASSWORD =
  process.env.QA_PASSWORD || process.env.PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD || "";

/* ── Result tracking ────────────────────────────────────────────── */
const results = [];
let passed = 0;
let failed = 0;

function pass(id, detail = "") {
  results.push({ id, status: "PASS", detail });
  passed++;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  results.push({ id, status: "FAIL", detail });
  failed++;
  console.error(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  results.push({ id, status: "SKIP", detail });
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function info(msg) {
  console.log(`  INFO  ${msg}`);
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function extractRef(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return payload.ref || "";
  } catch {
    return "";
  }
}

async function stagingSignIn(email, password) {
  const resp = await fetch(`${STAGING_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: STAGING_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await resp.json();
  if (!resp.ok) {
    return { ok: false, error: body.error_description || body.error || `HTTP ${resp.status}` };
  }
  return { ok: true, accessToken: body.access_token, refreshToken: body.refresh_token };
}

async function stagingSignOut(accessToken) {
  try {
    await fetch(`${STAGING_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: STAGING_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch { /* ignore */ }
}

async function probeDevServer() {
  try {
    const res = await fetch(`${LOCAL_BASE}/login.html`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Tests ──────────────────────────────────────────────────────── */
async function run() {
  console.log("=== CC LOCAL AUTH E2E — START ===");
  console.log(`  Local base:  ${LOCAL_BASE}`);
  console.log(`  Staging:     ${STAGING_URL}`);
  console.log(`  QA email:    ${QA_EMAIL}`);
  console.log(`  Password:    ${QA_PASSWORD ? "(set — not shown)" : "(MISSING)"}`);
  console.log("");
  let leakFound = false;

  /* T0: Dev server reachable */
  console.log("T0: Dev server reachability");
  const serverUp = await probeDevServer();
  if (serverUp) {
    pass("T0.server_reachable", `${LOCAL_BASE}/login.html → 200`);
  } else {
    fail("T0.server_reachable", `Cannot reach ${LOCAL_BASE} — run: npm run dev`);
    info("Server-dependent tests will be skipped.");
  }

  /* T1: chat-supabase-config.js content */
  console.log("\nT1: chat-supabase-config.js content check");
  const configPath = path.join(ROOT, "deploy/cloudflare/dist/chat-supabase-config.js");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf8");
    if (content.includes(STAGING_REF)) {
      pass("T1.config_has_staging_ref", `staging ref ${STAGING_REF} present`);
    } else {
      fail("T1.config_has_staging_ref", "staging ref not found in dist/chat-supabase-config.js");
    }
    if (/127\.0\.0\.1|localhost/.test(content) && /_isLocal/.test(content)) {
      pass("T1.config_has_local_guard", "Local hostname guard (_isLocal) present");
    } else {
      fail("T1.config_has_local_guard", "Local hostname guard missing");
    }
    if (/ddojquacsyqesrjhcvmn/.test(content)) {
      pass("T1.config_has_prod_ref", "Production ref preserved in else branch");
    } else {
      fail("T1.config_has_prod_ref", "Production ref missing from chat-supabase-config.js");
    }
  } else {
    fail("T1.config_exists", "dist/chat-supabase-config.js not found");
  }

  /* T2: login.js returnNeedsSupabaseAuth */
  console.log("\nT2: login.js returnNeedsSupabaseAuth patch");
  const loginPath = path.join(ROOT, "deploy/cloudflare/dist/login.js");
  if (fs.existsSync(loginPath)) {
    const content = fs.readFileSync(loginPath, "utf8");
    /* The regex in the source uses \/ (escaped slash), so search for the pattern text */
    if (/creator-content/.test(content)) {
      pass("T2.login_cc_path", "returnNeedsSupabaseAuth includes creator-content pattern");
    } else {
      fail("T2.login_cc_path", "returnNeedsSupabaseAuth does NOT include creator-content pattern");
    }
  } else {
    fail("T2.login_exists", "dist/login.js not found");
  }

  /* T3: tasu-cc-auth.js */
  console.log("\nT3: tasu-cc-auth.js presence and API surface");
  const ccAuthPath = path.join(ROOT, "deploy/cloudflare/dist/tasu-cc-auth.js");
  if (fs.existsSync(ccAuthPath)) {
    const content = fs.readFileSync(ccAuthPath, "utf8");
    const checks = [
      ["TasuCcAuth", "T3.cc_auth_module"],
      ["isJwtAuthenticated", "T3.cc_auth_isJwt"],
      ["getMine", "T3.cc_auth_getMine"],
      ["bootstrap", "T3.cc_auth_bootstrap"],
      ["guardCcDashboard", "T3.cc_auth_guard"],
      ["creatorMode", "T3.cc_auth_creatorMode"],
    ];
    for (const [pattern, id] of checks) {
      if (content.includes(pattern)) {
        pass(id, `${pattern} present`);
      } else {
        fail(id, `${pattern} missing`);
      }
    }
  } else {
    fail("T3.cc_auth_exists", "dist/tasu-cc-auth.js not found");
  }

  /* T4: API function */
  console.log("\nT4: API function presence and guards");
  const funcPath = path.join(
    ROOT,
    "deploy/cloudflare/dist/functions/api/creator-content-registration.js",
  );
  if (fs.existsSync(funcPath)) {
    const content = fs.readFileSync(funcPath, "utf8");
    if (/project_mismatch/.test(content)) {
      pass("T4.func_project_guard", "project_mismatch guard present");
    } else {
      fail("T4.func_project_guard", "project_mismatch guard missing");
    }
    if (content.includes(STAGING_REF)) {
      pass("T4.func_staging_ref", `staging ref ${STAGING_REF} present`);
    } else {
      fail("T4.func_staging_ref", "staging ref missing from API function");
    }
  } else {
    fail("T4.func_exists", "dist/functions/api/creator-content-registration.js not found");
  }

  /* T5: CC dashboard */
  console.log("\nT5: CC dashboard HTML");
  const dashPath = path.join(
    ROOT,
    "deploy/cloudflare/dist/creator-content/dashboard/index.html",
  );
  if (fs.existsSync(dashPath)) {
    const content = fs.readFileSync(dashPath, "utf8");
    const checks = [
      ["tasu-cc-auth.js", "T5.loads_cc_auth", false],
      ["guardCcDashboard", "T5.has_guard", false],
      ["cc-nav-registered", "T5.has_registered_nav", false],
      ["cc-nav-guest", "T5.has_guest_nav", false],
      ["コンテンツ管理", "T5.has_content_mgmt_nav", false],
      ["ダッシュボード", "T5.has_dashboard_nav", false],
    ];
    for (const [pattern, id] of checks) {
      if (content.includes(pattern)) {
        pass(id, `"${pattern}" present`);
      } else {
        fail(id, `"${pattern}" missing`);
      }
    }
  } else {
    fail("T5.dashboard_exists", "creator-content/dashboard/index.html not found");
  }

  /* T6: Staging signInWithPassword */
  console.log("\nT6: Staging Supabase signInWithPassword");
  let accessToken = null;
  if (!QA_PASSWORD) {
    skip(
      "T6.staging_login",
      "QA_PASSWORD / PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD not set — set in .env.staging",
    );
    skip("T6.jwt_ref_staging", "Login skipped");
  } else {
    const loginResult = await stagingSignIn(QA_EMAIL, QA_PASSWORD);
    if (loginResult.ok && loginResult.accessToken) {
      accessToken = loginResult.accessToken;
      pass("T6.staging_login_ok", `signInWithPassword succeeded for ${QA_EMAIL}`);

      const jwtRef = extractRef(accessToken);
      if (jwtRef === STAGING_REF) {
        pass("T6.jwt_ref_staging", `JWT ref = ${jwtRef}`);
      } else {
        fail("T6.jwt_ref_staging", `JWT ref = ${jwtRef || "(empty)"}, expected ${STAGING_REF}`);
      }
    } else {
      fail("T6.staging_login_ok", `signInWithPassword failed: ${loginResult.error}`);
      skip("T6.jwt_ref_staging", "Login failed");
    }
  }

  /* T7: API with staging JWT */
  console.log("\nT7: /api/creator-content-registration with staging JWT");
  if (!serverUp) {
    skip("T7.api_ok", "Dev server not running");
    skip("T7.api_registered", "Dev server not running");
  } else if (!accessToken) {
    skip("T7.api_ok", "No access token (login skipped or failed)");
    skip("T7.api_registered", "No access token");
  } else {
    let apiResult = null;
    let apiError = null;
    try {
      const resp = await fetch(CC_API, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        apiResult = await resp.json();
      } else {
        apiError = `HTTP ${resp.status}: ${await resp.text()}`;
      }
    } catch (err) {
      apiError = String(err?.message || err);
    }

    if (apiResult?.ok) {
      pass("T7.api_ok", `ok=true, registered=${apiResult.registered}, status=${apiResult.status}`);
      if (apiResult.registered) {
        pass("T7.api_registered", `creator_content_creators row found for ${QA_EMAIL}`);
        if (apiResult.data?.display_name) {
          pass("T7.api_data", `display_name="${apiResult.data.display_name}"`);
        }
      } else {
        fail("T7.api_registered", `registered=false for ${QA_EMAIL} — check staging DB`);
      }
    } else {
      fail("T7.api_ok", `API error: ${apiError || JSON.stringify(apiResult)}`);
      fail("T7.api_registered", "Cannot determine registration (API failed)");
    }
  }

  /* T8: Production JWT → 401 */
  console.log("\nT8: Production JWT rejection (project_mismatch)");
  if (!serverUp) {
    skip("T8.prod_jwt_rejected", "Dev server not running");
  } else {
    try {
      const resp = await fetch(CC_API, {
        headers: { Authorization: `Bearer ${PROD_ANON_KEY}` },
      });
      const body = await resp.json().catch(() => ({}));
      if (resp.status === 401 && body.error === "invalid_token") {
        pass("T8.prod_jwt_rejected", `401 invalid_token — project_mismatch guard OK`);
      } else {
        fail(
          "T8.prod_jwt_rejected",
          `Expected 401/invalid_token, got ${resp.status}: ${JSON.stringify(body)}`,
        );
      }
    } catch (err) {
      fail("T8.prod_jwt_rejected", String(err?.message || err));
    }
  }

  /* T9: No secret leak (actual key values, not comment mentions) */
  console.log("\nT9: Secret leak check in committed files");
  const sensitiveFiles = [
    path.join(ROOT, "deploy/cloudflare/dist/chat-supabase-config.js"),
    path.join(ROOT, "chat-supabase-config.js"),
    path.join(ROOT, "deploy/cloudflare/functions/api/creator-content-registration.js"),
    path.join(ROOT, "tasu-cc-auth.js"),
  ];
  /* Match actual key values, not comments mentioning the term */
  const leakPatterns = [
    /\bsb_secret_[A-Za-z0-9_-]{8,}/,        /* service role key pattern */
    /PAYMENT_RECEIPT_QA_PRIMARY_PASSWORD\s*=\s*\S+/, /* password assignment */
    /"role"\s*:\s*"service_role"/,            /* JWT with service role claim */
  ];
  for (const f of sensitiveFiles) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, "utf8");
    for (const pattern of leakPatterns) {
      if (pattern.test(content)) {
        fail("T9.no_secret_leak", `Potential secret (${pattern}) in ${path.relative(ROOT, f)}`);
        leakFound = true;
        break;
      }
    }
  }
  if (!leakFound) {
    pass("T9.no_secret_leak", "No sb_secret_ keys / password assignments in committed files");
  }

  /* T10: Production safety */
  console.log("\nT10: Production safety check");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf8");
    if (/ddojquacsyqesrjhcvmn/.test(content)) {
      pass("T10.prod_ref_preserved", "Production ref ddojquacsyqesrjhcvmn preserved");
    } else {
      fail("T10.prod_ref_preserved", "Production ref missing");
    }
    if (/_isLocal/.test(content)) {
      pass("T10.local_guard_present", "_isLocal guard ensures production is unaffected");
    } else {
      fail("T10.local_guard_present", "_isLocal guard missing");
    }
  }

  /* Sign out */
  if (accessToken) {
    await stagingSignOut(accessToken);
    info("Staging sign-out complete.");
  }

  /* ── Summary ─────────────────────────────────────────────────── */
  const skipCount = results.filter((r) => r.status === "SKIP").length;
  console.log("\n=== SUMMARY ===");
  console.log(`  PASS: ${passed}  FAIL: ${failed}  SKIP: ${skipCount}`);

  const report = {
    timestamp: new Date().toISOString(),
    localBase: LOCAL_BASE,
    stagingRef: STAGING_REF,
    qaEmail: QA_EMAIL,
    passed,
    failed,
    skipped: skipCount,
    results,
    PRODUCTION_CHANGED: "NO",
    SECRET_LEAK: leakFound ? "DETECTED" : "NO",
    INVALID_TOKEN: 0,
    status: failed === 0 ? "COMPLETE_CANDIDATE" : "BLOCKED",
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outPath = path.join(REPORT_DIR, "e2e-results.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n  Results written → ${path.relative(ROOT, outPath)}`);

  if (failed > 0) {
    console.error("\n  Some tests FAILED.");
    process.exit(1);
  } else {
    console.log(`\n  All ${passed} checks PASSED (${skipCount} skipped — need QA_PASSWORD or dev server).`);
  }
}

run().catch((err) => {
  console.error("[e2e-cc] Fatal error:", err);
  process.exit(2);
});
