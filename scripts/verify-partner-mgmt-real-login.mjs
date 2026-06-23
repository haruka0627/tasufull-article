/**
 * Partner management — full real-login verification (8 steps).
 *
 *   node --env-file=.env scripts/verify-partner-mgmt-real-login.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env for password reset + partner_role grant.
 * Optional: PARTNER_OPS_EMAIL / PARTNER_OPS_PASSWORD (default: talk-rls-admin@tasful-dev.test / TalkRlsAdmin1!)
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const LOGIN_URL = `${BASE}/login.html?return=builder/partner-management.html`;
const MGMT_URL = `${BASE}/builder/partner-management.html`;

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co").replace(/\/$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const OPS_EMAIL =
  process.env.PARTNER_OPS_EMAIL ||
  process.env.TALK_RLS_ADMIN_EMAIL ||
  "talk-rls-admin@tasful-dev.test";
const OPS_PASSWORD =
  process.env.PARTNER_OPS_PASSWORD ||
  process.env.TALK_RLS_ADMIN_PASSWORD ||
  "TalkRlsAdmin1!";

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

function resolveServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const ref = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!ref) return "";
    const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    });
    const keys = JSON.parse(raw);
    const row = Array.isArray(keys)
      ? keys.find((k) => k.name === "service_role" || k.id === "service_role")
      : null;
    return row?.api_key || "";
  } catch {
    return "";
  }
}

const SERVICE_KEY = resolveServiceKey();

function maskEmail(email) {
  return String(email || "").replace(/(^.).*(@.*$)/, "$1***$2");
}

function parseJwt(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function partnerRoleFromToken(token) {
  const p = parseJwt(token);
  return p?.app_metadata?.partner_role || null;
}

async function authAdmin(pathSuffix, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathSuffix}`, {
    method: options.method || "GET",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function signInPassword(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || `signIn HTTP ${res.status}`);
  }
  return data;
}

async function findUserByEmail(email) {
  const res = await authAdmin("/admin/users?per_page=200");
  if (!res.ok) throw new Error(`admin/users HTTP ${res.status}`);
  return (res.data?.users || []).find(
    (u) => String(u.email || "").toLowerCase() === String(email).toLowerCase(),
  );
}

async function ensureOpsUser(email, password) {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  let user = await findUserByEmail(email);
  if (!user) {
    const created = await authAdmin("/admin/users", {
      method: "POST",
      body: { email, password, email_confirm: true },
    });
    if (!created.ok) throw new Error(`create user HTTP ${created.status}`);
    user = created.data?.user || created.data;
  } else {
    await authAdmin(`/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      body: { password, email_confirm: true },
    });
  }
  return user;
}

async function setPartnerRole(userId, role) {
  const userRes = await authAdmin(`/admin/users/${encodeURIComponent(userId)}`);
  if (!userRes.ok) throw new Error(`get user HTTP ${userRes.status}`);
  const current = {
    ...(userRes.data?.app_metadata || userRes.data?.raw_app_meta_data || {}),
  };
  const nextMeta = { ...current, partner_role: role };
  const put = await authAdmin(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: { app_metadata: nextMeta },
  });
  if (!put.ok) throw new Error(`set partner_role HTTP ${put.status}`);
  return nextMeta;
}

async function clearPartnerRole(userId) {
  const userRes = await authAdmin(`/admin/users/${encodeURIComponent(userId)}`);
  if (!userRes.ok) throw new Error(`get user HTTP ${userRes.status}`);
  const current = {
    ...(userRes.data?.app_metadata || userRes.data?.raw_app_meta_data || {}),
  };
  const nextMeta = { ...current, partner_role: null };
  const put = await authAdmin(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: { app_metadata: nextMeta },
  });
  if (!put.ok) throw new Error(`clear partner_role HTTP ${put.status}`);
  const verify = await authAdmin(`/admin/users/${encodeURIComponent(userId)}`);
  const after = verify.data?.app_metadata?.partner_role ?? verify.data?.raw_app_meta_data?.partner_role ?? null;
  return { cleared: after == null || after === "" };
}

function sessionStorageValue(session) {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type || "bearer",
    user: session.user,
  });
}

async function browserLoginFlow(email, password) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const partnerListRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/functions/v1/partner-list")) {
      const auth = req.headers()["authorization"] || req.headers()["Authorization"] || "";
      partnerListRequests.push({
        url: url.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "eyJ…"),
        hasBearer: /^Bearer\s+\S+/i.test(auth),
        bearerPrefix: auth ? auth.slice(0, 16) + "…" : null,
      });
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/functions/v1/partner-list")) {
      const req = res.request();
      const auth = req.headers()["authorization"] || req.headers()["Authorization"] || "";
      let body = null;
      try {
        const t = await res.text();
        body = t.length > 300 ? t.slice(0, 300) : t;
      } catch {
        body = null;
      }
      partnerListRequests.push({
        phase: "response",
        status: res.status(),
        hasBearer: /^Bearer\s+\S+/i.test(auth),
        bodyPreview: body,
      });
    }
  });

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });

  const loginPageAudit = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const ret = String(params.get("return") || "");
    const devSkip = window.TasuMemberAuth?.DEV_SKIP_AUTH === true;
    const needsSupabase = /partner-management\.html|partner-detail\.html/.test(
      ret.split("#")[0].split("?")[0].replace(/^\.\//, ""),
    );
    const form = document.querySelector("[data-login-form]");
    const email = document.querySelector("[data-login-email]");
    const password = document.querySelector("[data-login-password]");
    return {
      returnParam: ret,
      devSkipAuth: devSkip,
      returnNeedsSupabaseAuth: needsSupabase,
      devSkipWouldBind: devSkip && !needsSupabase,
      hasLoginForm: !!form,
      hasEmailInput: !!email,
      hasPasswordInput: !!password,
    };
  });

  await page.fill("[data-login-email]", email);
  await page.fill("[data-login-password]", password);
  await page.click("[data-login-submit]");

  await page.waitForURL(/partner-management\.html/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const sessionProbe = await page.evaluate(async () => {
    const client = window.TasuSupabase?.getClient?.();
    if (!client?.auth?.getSession) return { error: "no client" };
    const { data, error } = await client.auth.getSession();
    return {
      hasSession: !!data?.session,
      hasAccessToken: !!data?.session?.access_token,
      partnerRole: data?.session?.user?.app_metadata?.partner_role || null,
      readPartnerRole: window.TASU_PARTNER_API?.readPartnerRoleFromSession?.(data?.session) || null,
      getSessionError: error?.message || null,
    };
  });

  const ui = await page.evaluate(() => {
    const errSub = document.querySelector(".builder-admin-empty__sub")?.textContent?.trim() || "";
    const hint = document.querySelector(".builder-admin-empty__hint")?.textContent?.trim() || "";
    const cards = document.querySelectorAll(
      "[data-prt-mgmt-tbody] .builder-prt-app-card, [data-prt-mgmt-tbody] a.builder-prt-app-card",
    ).length;
    const stat = (sel) => document.querySelector(sel)?.textContent?.trim() || "0";
    return {
      mode: document.querySelector("[data-prt-mgmt-mode]")?.textContent?.trim() || "",
      errorSub: errSub,
      hint,
      cardCount: cards,
      stats: {
        pending: stat("[data-prt-mgmt-stat-pending]"),
        hold: stat("[data-prt-mgmt-stat-hold]"),
        approved: stat("[data-prt-mgmt-stat-approved]"),
        contracted: stat("[data-prt-mgmt-stat-contracted]"),
      },
    };
  });

  await browser.close();

  return { loginPageAudit, sessionProbe, ui, partnerListRequests, consoleErrors };
}

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    loginUrl: LOGIN_URL,
    mgmtUrl: MGMT_URL,
    opsEmail: maskEmail(OPS_EMAIL),
    hasServiceKey: !!SERVICE_KEY,
    steps: {},
    blocked: false,
    blockReason: null,
  };

  // Step 1 — login page audit (no credentials)
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  report.steps.step1_loginPage = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const ret = String(params.get("return") || "");
    const devSkip = window.TasuMemberAuth?.DEV_SKIP_AUTH === true;
    const needsSupabase = /partner-management\.html|partner-detail\.html/.test(
      ret.split("#")[0].split("?")[0].replace(/^\.\//, ""),
    );
    return {
      pass: devSkip && needsSupabase,
      devSkipAuth: devSkip,
      returnNeedsSupabaseAuth: needsSupabase,
      devSkipBypassed: devSkip && needsSupabase,
      hasForm: !!document.querySelector("[data-login-form]"),
    };
  });
  await browser.close();

  if (!ANON_KEY) {
    report.blocked = true;
    report.blockReason = "SUPABASE_ANON_KEY missing";
    await writeReport(report);
    process.exit(1);
  }

  if (!SERVICE_KEY) {
    report.blocked = true;
    report.blockReason =
      "SUPABASE_SERVICE_ROLE_KEY missing — cannot reset password or set partner_role. Add to .env and re-run.";
    report.steps.step6_roleGrant = { skipped: true, reason: report.blockReason };
    await writeReport(report);
    console.log(JSON.stringify({ blocked: true, reason: report.blockReason, step1: report.steps.step1_loginPage }, null, 2));
    process.exit(1);
  }

  // Ensure user exists + password
  const user = await ensureOpsUser(OPS_EMAIL, OPS_PASSWORD);
  report.opsUserId = user.id;

  // Step 5 prep — clear partner_role, login, verify forbidden
  const clearResult = await clearPartnerRole(user.id);
  let sessionNoRole = await signInPassword(OPS_EMAIL, OPS_PASSWORD);
  const jwtRoleNoRole = partnerRoleFromToken(sessionNoRole.access_token);
  report.steps.step3_getSession_noRole = {
    hasAccessToken: !!sessionNoRole.access_token,
    partnerRole: jwtRoleNoRole,
    authMetadataCleared: clearResult.cleared,
  };

  const listNoRole = await fetch(`${SUPABASE_URL}/functions/v1/partner-list?limit=5`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${sessionNoRole.access_token}`,
      "Content-Type": "application/json",
    },
  });
  report.steps.step4_partnerList_noRole = {
    note: "client blocks before fetch if no partner_role",
    directApiStatus: listNoRole.status,
  };

  const browserNoRole = await browserLoginFlow(OPS_EMAIL, OPS_PASSWORD);
  report.steps.step2_browserLogin_noRole = {
    loginPage: browserNoRole.loginPageAudit,
    session: browserNoRole.sessionProbe,
    ui: browserNoRole.ui,
    partnerListRequests: browserNoRole.partnerListRequests,
  };
  report.steps.step5_forbiddenUi = {
    pass:
      jwtRoleNoRole == null &&
      (/権限がありません/.test(browserNoRole.ui.errorSub) ||
        /権限がありません/.test(browserNoRole.ui.hint)),
    errorSub: browserNoRole.ui.errorSub,
    jwtPartnerRole: jwtRoleNoRole,
    partnerListSent: browserNoRole.partnerListRequests.some((r) => r.hasBearer),
  };

  // Step 6 — grant partner_role
  const meta = await setPartnerRole(user.id, "admin");
  report.steps.step6_roleGrant = {
    pass: meta.partner_role === "admin",
    app_metadata_partner_role: meta.partner_role,
  };

  // Step 7 — re-login (fresh JWT)
  const sessionWithRole = await signInPassword(OPS_EMAIL, OPS_PASSWORD);
  const jwtRole = partnerRoleFromToken(sessionWithRole.access_token);
  report.steps.step7_reloginJwt = {
    pass: jwtRole === "admin",
    partnerRole: jwtRole,
    hasAccessToken: !!sessionWithRole.access_token,
  };

  const listWithRole = await fetch(`${SUPABASE_URL}/functions/v1/partner-list?limit=100`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${sessionWithRole.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const listBody = await listWithRole.json().catch(() => ({}));
  const items = Array.isArray(listBody.items) ? listBody.items : [];
  report.steps.step4_partnerList_withRole = {
    httpStatus: listWithRole.status,
    itemCount: items.length,
    hasBearer: true,
  };

  const browserWithRole = await browserLoginFlow(OPS_EMAIL, OPS_PASSWORD);
  report.steps.step8_uiWithRole = {
    session: browserWithRole.sessionProbe,
    ui: browserWithRole.ui,
    partnerListRequests: browserWithRole.partnerListRequests,
    pass:
      browserWithRole.sessionProbe.hasAccessToken &&
      (browserWithRole.sessionProbe.partnerRole === "admin" ||
        browserWithRole.sessionProbe.readPartnerRole === "admin") &&
      browserWithRole.ui.cardCount > 0 &&
      browserWithRole.partnerListRequests.some((r) => r.hasBearer && r.status === 200),
  };

  report.summary = {
    step1_devSkipBypassed: report.steps.step1_loginPage?.devSkipBypassed === true,
    step3_accessToken: report.steps.step3_getSession_noRole?.hasAccessToken === true,
    step5_forbidden: report.steps.step5_forbiddenUi?.pass === true,
    step6_roleGranted: report.steps.step6_roleGrant?.pass === true,
    step7_jwtRole: report.steps.step7_reloginJwt?.pass === true,
    step8_listVisible: report.steps.step8_uiWithRole?.pass === true,
    allPass: false,
  };
  report.summary.allPass = Object.entries(report.summary)
    .filter(([k]) => k !== "allPass")
    .every(([, v]) => v === true);

  await writeReport(report);
  console.log(JSON.stringify({ summary: report.summary, steps: report.steps }, null, 2));
  process.exit(report.summary.allPass ? 0 : 1);
}

async function writeReport(report) {
  await writeFile(
    path.join(ROOT, "reports/partner-mgmt-real-login-verify.json"),
    JSON.stringify(report, null, 2),
  );

  const s = report.summary || {};
  const md = `# 協力パートナー管理 — 実ログイン検証

| 項目 | 内容 |
|------|------|
| 確認日時 | ${report.checkedAt} |
| ログイン URL | ${report.loginUrl} |
| 運営アカウント | ${report.opsEmail} |
| SERVICE_KEY | ${report.hasServiceKey ? "あり" : "なし"} |

## ステップ結果

| # | 内容 | 結果 |
|---|------|------|
| 1 | DEV_SKIP_AUTH バイパス（return=partner-management） | ${s.step1_devSkipBypassed ? "PASS" : "FAIL"} |
| 2 | 実 Supabase ログイン（ブラウザ） | ${report.steps.step2_browserLogin_noRole ? "実施" : "—"} |
| 3 | getSession() access_token | ${s.step3_accessToken ? "PASS" : "FAIL"} |
| 4 | partner-list Bearer | ${report.steps.step4_partnerList_withRole?.httpStatus === 200 ? "PASS (200)" : "—"} |
| 5 | partner_role 未設定 → 権限エラー | ${s.step5_forbidden ? "PASS" : "FAIL"} |
| 6 | raw_app_meta_data partner_role=admin | ${s.step6_roleGranted ? "PASS" : report.steps.step6_roleGrant?.skipped ? "SKIP" : "FAIL"} |
| 7 | 再ログイン JWT partner_role | ${s.step7_jwtRole ? "PASS" : "FAIL"} |
| 8 | 件数カード・一覧表示 | ${s.step8_listVisible ? "PASS" : "FAIL"} |

${report.blocked ? `\n> ブロック: ${report.blockReason}\n` : ""}

## 総合: ${s.allPass ? "PASS" : "FAIL"}

詳細 JSON: \`reports/partner-mgmt-real-login-verify.json\`
`;

  await writeFile(path.join(ROOT, "reports/partner-mgmt-real-login-verify.md"), md);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
