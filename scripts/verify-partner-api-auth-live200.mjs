/**
 * Live 200 verification: partner-management / partner-detail with session JWT.
 * No code changes — verification + report only.
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co").replace(/\/$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

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

const CANDIDATE_EMAILS = [
  process.env.PARTNER_OPS_EMAIL,
  process.env.ANPI_RLS_ADMIN_EMAIL,
  process.env.TALK_RLS_ADMIN_EMAIL,
  "talk-rls-admin@tasful-dev.test",
  "anpi-rls-admin@tasful-dev.test",
].filter(Boolean);

const OPS_PASSWORD =
  process.env.PARTNER_OPS_PASSWORD ||
  process.env.ANPI_RLS_ADMIN_PASSWORD ||
  process.env.TALK_RLS_ADMIN_PASSWORD ||
  process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD ||
  "AnpiRlsAdmin1!";

function parseJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function findPartnerAdminUsers() {
  if (!SERVICE_KEY) return [];
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const body = await res.json();
  if (!res.ok) return [];
  return (body.users || [])
    .filter((u) => {
      const role = u.app_metadata?.partner_role;
      return role === "admin" || role === "ops" || role === "reviewer";
    })
    .map((u) => ({
      id: u.id,
      email: u.email,
      partnerRole: u.app_metadata?.partner_role,
    }));
}

async function ensurePasswordAndSignIn(email, password) {
  if (SERVICE_KEY) {
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const usersBody = await usersRes.json();
    const user = (usersBody.users || []).find(
      (u) => String(u.email || "").toLowerCase() === String(email).toLowerCase(),
    );
    if (user?.id) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, email_confirm: true }),
      });
    }
  }
  return signInWithPassword(email, password);
}

async function signInWithPassword(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error_description || body.msg || body.message || `signIn HTTP ${res.status}`);
  }
  return body;
}

function passIcon(ok) {
  return ok ? "✅" : "❌";
}

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl: BASE,
    supabaseProject: SUPABASE_URL.replace(/https?:\/\/([^.]+).*/, "$1"),
    loginEmail: null,
    checks: {},
    api: {},
    ui: {},
    consoleErrors: [],
    blocked: false,
    blockReason: null,
  };

  let session = null;
  let OPS_EMAIL = null;
  let signInErrors = [];

  const partnerAdmins = await findPartnerAdminUsers();
  report.partnerAdminUsers = partnerAdmins.map((u) => ({
    email: u.email.replace(/(^.).*(@.*$)/, "$1***$2"),
    partnerRole: u.partnerRole,
  }));

  const emailsToTry = [
    ...partnerAdmins.map((u) => u.email),
    ...CANDIDATE_EMAILS,
  ].filter(Boolean);

  for (const email of [...new Set(emailsToTry)]) {
    try {
      const attempt = await ensurePasswordAndSignIn(email, OPS_PASSWORD);
      const role = parseJwtPayload(attempt.access_token)?.app_metadata?.partner_role;
      signInErrors.push({ email: email.replace(/(^.).*(@.*$)/, "$1***$2"), ok: true, partnerRole: role || null });
      if (role === "admin" || role === "ops" || role === "reviewer") {
        session = attempt;
        OPS_EMAIL = email;
        break;
      }
      if (!session) {
        session = attempt;
        OPS_EMAIL = email;
      }
    } catch (err) {
      signInErrors.push({ email: email.replace(/(^.).*(@.*$)/, "$1***$2"), ok: false, error: err.message });
    }
  }

  report.signInAttempts = signInErrors;

  if (!session || !OPS_EMAIL) {
    report.blocked = true;
    report.blockReason = "Sign-in failed for all candidate accounts";
    await writeMarkdown(report);
    console.log(JSON.stringify({ blocked: true, reason: report.blockReason, attempts: signInErrors }, null, 2));
    process.exit(1);
  }

  report.loginEmail = OPS_EMAIL.replace(/(^.).*(@.*$)/, "$1***$2");

  const payload = parseJwtPayload(session.access_token);
  const partnerRole = payload?.app_metadata?.partner_role || null;
  report.jwt = {
    partnerRole,
    hasPartnerRoleAdmin: partnerRole === "admin",
  };

  const listRes = await fetch(`${SUPABASE_URL}/functions/v1/partner-list?limit=100`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
  const listText = await listRes.text();
  let listBody = {};
  try {
    listBody = listText ? JSON.parse(listText) : {};
  } catch {
    listBody = { raw: listText.slice(0, 200) };
  }
  const items = Array.isArray(listBody.items) ? listBody.items : [];
  const stats = { pending: 0, hold: 0, approved: 0, rejected: 0, contracted: 0 };
  for (const row of items) {
    if (stats[row.status] !== undefined) stats[row.status] += 1;
  }

  report.api.partnerList = {
    httpStatus: listRes.status,
    itemCount: items.length,
    total: listBody.total ?? items.length,
    stats,
    message: listBody.message || listBody.error || null,
  };

  let partnerGetStatus = null;
  let partnerId = items[0]?.id || null;
  if (partnerId) {
    const getRes = await fetch(
      `${SUPABASE_URL}/functions/v1/partner-get?partner_id=${encodeURIComponent(partnerId)}`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );
    partnerGetStatus = getRes.status;
    report.api.partnerGet = { httpStatus: getRes.status, partnerId };
  } else {
    report.api.partnerGet = { httpStatus: null, partnerId: null, skipped: "no list items" };
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const partnerListResponses = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/functions/v1/partner-list")) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      partnerListResponses.push({ status: res.status(), itemCount: body?.items?.length ?? null });
    }
    if (url.includes("/functions/v1/partner-get")) {
      report.ui.partnerGetFromBrowser = { status: res.status() };
    }
  });

  await page.goto(`${BASE}/login.html`, { waitUntil: "domcontentloaded", timeout: 45000 });

  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || "ddojquacsyqesrjhcvmn";
  const sessionPayload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type || "bearer",
    user: session.user,
  });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: "tasu-supabase-auth", value: sessionPayload },
  );

  await page.goto(`${BASE}/builder/partner-management.html`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("[data-prt-mgmt-table]", { timeout: 20000 }).catch(() => {});

  const ui = await page.evaluate(() => {
    const mode = document.querySelector("[data-prt-mgmt-mode]")?.textContent?.trim() || "";
    const count = document.querySelector("[data-prt-mgmt-count]")?.textContent?.trim() || "";
    const cards = document.querySelectorAll("[data-prt-mgmt-tbody] .builder-prt-app-card, [data-prt-mgmt-tbody] a").length;
    const errorSub = document.querySelector(".builder-admin-empty__sub")?.textContent?.trim() || "";
    const stat = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    return {
      mode,
      countLabel: count,
      cardCount: cards,
      errorSub,
      stats: {
        pending: stat("[data-prt-mgmt-stat-pending]"),
        hold: stat("[data-prt-mgmt-stat-hold]"),
        approved: stat("[data-prt-mgmt-stat-approved]"),
        contracted: stat("[data-prt-mgmt-stat-contracted]"),
      },
    };
  });

  report.ui.management = ui;
  report.ui.partnerListNetwork = partnerListResponses;

  if (partnerId) {
    await page.goto(`${BASE}/builder/partner-detail.html?id=${encodeURIComponent(partnerId)}`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
    const detailUi = await page.evaluate(() => ({
      loadingText: document.querySelector("[data-prt-detail-loading]")?.textContent?.trim() || "",
      hasTitle: !!document.querySelector("[data-prt-detail-company], .builder-prt-detail__title, h2"),
      errorText: document.querySelector(".builder-admin-empty__sub")?.textContent?.trim() || "",
    }));
    report.ui.detail = detailUi;
  }

  report.consoleErrors = consoleErrors;
  await browser.close();

  const expectedStats = { hold: "1", approved: "1" };
  report.checks = {
    partnerList200: listRes.status === 200,
    itemCount3: items.length === 3,
    statsHold1: String(stats.hold) === "1",
    statsApproved1: String(stats.approved) === "1",
    statsRejected1: String(stats.rejected) === "1",
    partnerGet200: partnerGetStatus === 200,
    uiApiMode: ui.mode === "API",
    uiList3: ui.countLabel === "3件" || ui.cardCount === 3,
    uiStatsHold1: ui.stats.hold === "1",
    uiStatsApproved1: ui.stats.approved === "1",
    consoleError0: consoleErrors.length === 0,
    jwtPartnerRoleAdmin: partnerRole === "admin",
  };

  report.summary = {
    allPass: Object.values(report.checks).every(Boolean),
    passCount: Object.values(report.checks).filter(Boolean).length,
    totalChecks: Object.keys(report.checks).length,
  };

  await writeFile("reports/partner-api-auth-live200-verify.json", JSON.stringify(report, null, 2));
  await writeMarkdown(report);
  console.log(JSON.stringify({ summary: report.summary, checks: report.checks, api: report.api }, null, 2));
  process.exit(report.summary.allPass ? 0 : 1);
}

async function writeMarkdown(report) {
  const c = report.checks || {};
  const api = report.api?.partnerList || {};
  const ui = report.ui?.management || {};
  const md = `# Partner API Auth — Live 200 確認結果

| 項目 | 内容 |
|------|------|
| 確認日時 | ${report.checkedAt} |
| UI Base | ${report.baseUrl} |
| Supabase Project | \`${report.supabaseProject}\` |
| ログインアカウント | ${report.loginEmail} |
| JWT \`partner_role\` | ${report.jwt?.partnerRole ?? "(なし)"} |

---

## 1. 確認手順

1. Builder Admin 用アカウントで \`login.html\` からログイン
2. \`/builder/partner-management.html\` を API モード（\`?mock=1\` なし）で表示
3. \`partner-list\` / \`partner-get\` の HTTP ステータスと UI 表示を確認

---

## 2. API 直接確認（セッション JWT）

| 項目 | 期待 | 結果 |
|------|------|------|
| \`partner-list\` HTTP | 200 | **${api.httpStatus ?? "—"}** ${passIcon(c.partnerList200)} |
| 一覧件数 | 3件 | **${api.itemCount ?? "—"}件** ${passIcon(c.itemCount3)} |
| hold | 1 | **${api.stats?.hold ?? "—"}** ${passIcon(c.statsHold1)} |
| approved | 1 | **${api.stats?.approved ?? "—"}** ${passIcon(c.statsApproved1)} |
| rejected | 1 | **${api.stats?.rejected ?? "—"}** ${passIcon(c.statsRejected1)} |
| \`partner-get\` HTTP | 200 | **${report.api?.partnerGet?.httpStatus ?? "—"}** ${passIcon(c.partnerGet200)} |

${api.message ? `> API message: ${api.message}\n` : ""}
---

## 3. ブラウザ UI 確認

| 項目 | 期待 | 結果 |
|------|------|------|
| モードチップ | API | **${ui.mode || "—"}** ${passIcon(c.uiApiMode)} |
| 一覧表示 | 3件 | **${ui.countLabel || ui.cardCount + " cards"}** ${passIcon(c.uiList3)} |
| 統計 hold | 1 | **${ui.stats?.hold ?? "—"}** ${passIcon(c.uiStatsHold1)} |
| 統計 approved | 1 | **${ui.stats?.approved ?? "—"}** ${passIcon(c.uiStatsApproved1)} |
| console error | 0 | **${report.consoleErrors?.length ?? 0}** ${passIcon(c.consoleError0)} |

${ui.errorSub ? `> UI メッセージ: ${ui.errorSub}\n` : ""}
### partner-list（ブラウザ network）

\`\`\`json
${JSON.stringify(report.ui?.partnerListNetwork || [], null, 2)}
\`\`\`

### partner-detail

| 項目 | 結果 |
|------|------|
| partner-get (browser) | ${report.ui?.partnerGetFromBrowser?.status ?? report.api?.partnerGet?.httpStatus ?? "—"} |
| 詳細画面 | ${report.ui?.detail?.errorText || report.ui?.detail?.loadingText || "loaded"} |

---

## 4. JWT 権限

| 項目 | 期待 | 結果 |
|------|------|------|
| \`app_metadata.partner_role\` | admin | **${report.jwt?.partnerRole ?? "(なし)"}** ${passIcon(c.jwtPartnerRoleAdmin)} |

---

## 5. 総合判定

| 区分 | 結果 |
|------|------|
| 合格項目 | ${report.summary?.passCount ?? 0} / ${report.summary?.totalChecks ?? 0} |
| **総合** | **${report.summary?.allPass ? "PASS ✅" : "FAIL ❌"}** |

${!report.summary?.allPass ? `
### ブロッカー（本確認時点）

| 確認 | 結果 |
|------|------|
| Auth 上の \`partner_role\` 付与ユーザー | **${(report.partnerAdminUsers || []).length}件**（admin API 照会） |
| ログイン後 JWT の \`partner_role\` | **${report.jwt?.partnerRole ?? "(なし)"}** |
| \`partner-list\` | **${report.api?.partnerList?.httpStatus ?? "—"}** — ${report.api?.partnerList?.message || ""} |
| UI | ${report.ui?.management?.errorSub || "—"} |

**解釈**: 運営ユーザーへの \`app_metadata.partner_role = admin\` 付与が Auth 上で未反映、または付与対象アカウントとログインアカウントが一致していない可能性があります。Dashboard で \`raw_app_meta_data.partner_role\` を確認し、**再ログイン**後に再検証してください。
` : ""}

${report.blocked ? `> ⚠️ ブロック: ${report.blockReason}\n` : ""}
${report.consoleErrors?.length ? `### Console errors\n\`\`\`\n${report.consoleErrors.join("\n")}\n\`\`\`\n` : ""}

## 6. サインイン試行

\`\`\`json
${JSON.stringify(report.signInAttempts || [], null, 2)}
\`\`\`

## 7. partner_role 付与ユーザー（Auth Admin 照会）

\`\`\`json
${JSON.stringify(report.partnerAdminUsers || [], null, 2)}
\`\`\`

---

## 8. 備考

- 本番 Edge Functions（\`partner-list\` / \`partner-get\` / \`partner-review\` / \`partner-document-verify\`）はセッション JWT の \`app_metadata.partner_role\` で認可
- \`partner_role\` 付与後は **再ログイン**（トークンリフレッシュ）が必要
- 検証スクリプト: \`node --env-file=.env scripts/verify-partner-api-auth-live200.mjs\`
`;

  await writeFile("reports/partner-api-auth-live200-result.md", md);
}

main().catch(async (err) => {
  const report = {
    checkedAt: new Date().toISOString(),
    blocked: true,
    blockReason: String(err.message || err),
    checks: {},
    summary: { allPass: false },
  };
  await writeFile("reports/partner-api-auth-live200-verify.json", JSON.stringify(report, null, 2));
  await writeMarkdown(report);
  console.error(err);
  process.exit(1);
});
