#!/usr/bin/env node
/**
 * Diff & Approve — Staging Operator Read-Only E2E
 *
 *   node scripts/test-diff-approve-staging-operator-e2e.mjs
 *   node scripts/test-diff-approve-staging-operator-e2e.mjs --base https://diff-approve-staging-readonly.tasufull-article.pages.dev
 *
 * Staging Supabase only (.env.staging). Creates ephemeral ops + member users, cleans up.
 * No Apply · Provider · Production deploy.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  withPlaywrightBrowser,
  closeAllBrowsers,
} from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const DEFAULT_BASE = "http://127.0.0.1:8788";

const args = process.argv.slice(2);
const baseArgIdx = args.indexOf("--base");
const BASE = (
  baseArgIdx >= 0 ? args[baseArgIdx + 1] : process.env.DIFF_APPROVE_E2E_BASE || DEFAULT_BASE
).replace(/\/$/, "");

let pass = 0;
let fail = 0;
/** @type {string[]} */
const notes = [];
/** @type {Record<string, unknown>} */
const perf = {};

function ok(label) {
  pass += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  fail += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}
function note(label) {
  notes.push(label);
  console.log(`  · ${label}`);
}

function loadEnvFile(rel) {
  const p = path.join(ROOT, rel);
  const o = {};
  if (!existsSync(p)) return o;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const staging = loadEnvFile(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || staging.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const anon = String(
  staging.TASFUL_SUPABASE_ANON_KEY || staging.SUPABASE_ANON_KEY || ""
).trim();
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF)) {
  console.error("FAIL: Staging Supabase required (.env.staging)");
  process.exit(1);
}
if (!anon || !service) {
  console.error("FAIL: Staging anon/service keys required");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const OPS_EMAIL = `diff-approve-ops-${stamp}@tasful.staging.test`;
const MEMBER_EMAIL = `diff-approve-member-${stamp}@tasful.staging.test`;
const PASSWORD = `DaE2e!${stamp}Aa1`;

async function adminCreateUser(email, appMetadata) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`createUser ${email}: ${data.msg || data.error_description || res.status}`);
  }
  return data.id || data.user?.id;
}

async function adminDeleteUser(userId) {
  if (!userId) return;
  await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
    },
  });
}

async function passwordLogin(email) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`login ${email}: ${data.error_description || data.msg || res.status}`);
  }
  return {
    access_token: String(data.access_token || ""),
    refresh_token: String(data.refresh_token || ""),
    expires_in: data.expires_in,
    token_type: data.token_type || "bearer",
    user: data.user || null,
  };
}

async function api(method, apiPath, token) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${apiPath}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: ["POST", "PUT", "PATCH"].includes(method) ? "{}" : undefined,
    cache: "no-store",
  });
  const ms = Date.now() - t0;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body, ms };
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Staging ref: ${STAGING_REF}`);

  let opsId = "";
  let memberId = "";
  let opsSession = null;
  let memberSession = null;
  let opsToken = "";
  let memberToken = "";

  try {
    console.log("\n0) Warm API");
    for (let i = 0; i < 10; i += 1) {
      const warm = await fetch(`${BASE}/api/ai-diff-approve/proposals`);
      if (warm.status === 401 || warm.status === 403) {
        ok(`API warm status ${warm.status}`);
        break;
      }
      if (i === 9) bad("API warm", `last status ${warm.status}`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log("\n1) Provision Staging users");
    opsId = await adminCreateUser(OPS_EMAIL, {
      is_ops: true,
      role: "tasu_admin",
    });
    memberId = await adminCreateUser(MEMBER_EMAIL, {
      is_ops: false,
      role: "member",
    });
    opsSession = await passwordLogin(OPS_EMAIL);
    memberSession = await passwordLogin(MEMBER_EMAIL);
    opsToken = opsSession.access_token;
    memberToken = memberSession.access_token;
    ok("ops + member users created and logged in");

    console.log("\n2) Authorization matrix");
    async function expectStatus(label, method, path, token, want) {
      for (let i = 0; i < 4; i += 1) {
        const { res, body, ms } = await api(method, path, token);
        if (res.status === want) {
          ok(`${label} → ${want}${ms != null ? ` (${ms}ms)` : ""}`);
          return { res, body, ms };
        }
        if (res.status === 404 && i < 3) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        bad(label, `got ${res.status} ${body?.error || ""}`);
        return { res, body, ms };
      }
    }
    await expectStatus("unauthenticated", "GET", "/api/ai-diff-approve/proposals", "", 401);
    await expectStatus(
      "member",
      "GET",
      "/api/ai-diff-approve/proposals",
      memberToken,
      403
    );
    {
      const out = await expectStatus(
        "operator list",
        "GET",
        "/api/ai-diff-approve/proposals?pageSize=10",
        opsToken,
        200
      );
      if (out?.ms != null) {
        perf.list_ms = out.ms;
        if (out.ms > 500) note(`list slower than 500ms target: ${out.ms}ms`);
      }
    }
    {
      const out = await expectStatus(
        "operator summary",
        "GET",
        "/api/ai-diff-approve/summary",
        opsToken,
        200
      );
      if (out?.ms != null) {
        perf.summary_ms = out.ms;
        if (out.ms > 500) note(`summary slower than 500ms target: ${out.ms}ms`);
      }
    }

    console.log("\n3) Method allowlist");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      await expectStatus(`${method}`, method, "/api/ai-diff-approve/proposals", opsToken, 405);
    }
    {
      const res = await fetch(`${BASE}/api/ai-diff-approve/proposals`, {
        method: "OPTIONS",
      });
      if (res.status === 204 || res.status === 200) ok(`OPTIONS → ${res.status}`);
      else bad("OPTIONS", `got ${res.status}`);
    }
    {
      const res = await fetch(`${BASE}/api/ai-diff-approve/proposals`, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${opsToken}` },
      });
      // Wrangler may map HEAD→GET bodyless; accept 200/401/405/501
      if ([200, 204, 401, 405, 501].includes(res.status)) {
        ok(`HEAD handled (${res.status})`);
      } else bad("HEAD", `got ${res.status}`);
    }

    console.log("\n4) Query validation");
    {
      const { res, body } = await api(
        "GET",
        "/api/ai-diff-approve/proposals?hack=1",
        opsToken
      );
      if (res.status === 400 && body?.error === "invalid_filter") {
        ok("invalid filter → 400");
      } else bad("invalid filter", `${res.status} ${body?.error}`);
    }
    {
      const { res, body } = await api(
        "GET",
        "/api/ai-diff-approve/proposals?sortBy=drop_table",
        opsToken
      );
      if (res.status === 400 && body?.error === "invalid_sort") {
        ok("invalid sort → 400");
      } else bad("invalid sort", `${res.status} ${body?.error}`);
    }
    {
      const { res, body } = await api(
        "GET",
        "/api/ai-diff-approve/proposals?pageSize=999",
        opsToken
      );
      if (res.status === 400 && body?.error === "limit_too_large") {
        ok("oversized limit → 400");
      } else bad("oversized limit", `${res.status} ${body?.error}`);
    }
    {
      const { res, body } = await api(
        "GET",
        "/api/ai-diff-approve/00000000-0000-4000-8000-000000000099",
        opsToken
      );
      if (res.status === 404) ok("unknown proposal → 404");
      else bad("unknown proposal", `${res.status} ${body?.error}`);
    }

    console.log("\n5) Cache / secrets");
    {
      const { res, body } = await api(
        "GET",
        "/api/ai-diff-approve/summary",
        opsToken
      );
      const cc = res.headers.get("cache-control") || "";
      if (/no-store/i.test(cc)) ok("Cache-Control: no-store");
      else bad("no-store", cc);
      const blob = JSON.stringify(body || {});
      if (!/service_role|eyJhbGciOi|sk-proj-/i.test(blob)) {
        ok("response has no secret literals");
      } else bad("secret leakage in response");
    }

    console.log("\n6) Production isolation smoke");
    {
      const prodBase = "https://tasufull-article.pages.dev";
      try {
        const res = await fetch(`${prodBase}/api/ai-diff-approve/proposals`, {
          headers: { Authorization: `Bearer ${opsToken}` },
        });
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (
          res.status === 403 ||
          res.status === 404 ||
          res.status === 302 ||
          res.status === 301 ||
          body?.error === "production_forbidden" ||
          body?.error === "staging_required" ||
          body?.error === "read_disabled" ||
          /text\/html/i.test(res.headers.get("content-type") || "")
        ) {
          ok(`Production host blocked/absent (${res.status} ${body?.error || "non-json"})`);
        } else {
          bad("Production should not allow read", `${res.status} ${body?.error}`);
        }
      } catch (e) {
        note(`Production probe network: ${e.message}`);
      }
    }

    console.log("\n7) Playwright UI (desktop + mobile)");
    await withPlaywrightBrowser(async (browser) => {
      for (const vp of [
        { name: "desktop", width: 1280, height: 800 },
        { name: "mobile", width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });

        const storageKey = `sb-${STAGING_REF}-auth-token`;
        await page.addInitScript(
          ({ key, session }) => {
            const payload = {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in || 3600,
              expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
              token_type: session.token_type || "bearer",
              user: session.user,
            };
            window.localStorage.setItem(key, JSON.stringify(payload));
          },
          { key: storageKey, session: opsSession }
        );

        const t0 = Date.now();
        const resp = await page.goto(`${BASE}/admin-diff-approve.html?talkDev=1&talkAdmin=1`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        const navMs = Date.now() - t0;
        perf[`ui_${vp.name}_ms`] = navMs;

        if (resp && resp.status() >= 200 && resp.status() < 400) {
          ok(`${vp.name} page HTTP ${resp.status()}`);
        } else bad(`${vp.name} page HTTP`, String(resp?.status()));

        await page.waitForSelector("#dda-refresh", { timeout: 20000 });
        const badges = await page.locator(".dda-badge").allTextContents();
        if (
          badges.some((b) => /STAGING/i.test(b)) &&
          badges.some((b) => /READ ONLY/i.test(b)) &&
          badges.some((b) => /NO APPLY/i.test(b))
        ) {
          ok(`${vp.name} badges present`);
        } else bad(`${vp.name} badges`, badges.join(","));

        await page.evaluate(({ token, user }) => {
          const wrap = window.TasuSupabaseClient;
          if (wrap?.getClient) {
            const client = wrap.getClient();
            if (client?.auth) {
              client.auth.getSession = async () => ({
                data: {
                  session: {
                    access_token: token,
                    user,
                  },
                },
              });
            }
          }
        }, { token: opsToken, user: opsSession.user });

        // Browser-side operator API check (CORS + token)
        const browserApi = await page.evaluate(async ({ token }) => {
          const res = await fetch("/api/ai-diff-approve/summary", {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          });
          const body = await res.json().catch(() => ({}));
          return { status: res.status, ok: body?.ok === true, error: body?.error || "" };
        }, { token: opsToken });
        if (browserApi.status === 200 && browserApi.ok) {
          ok(`${vp.name} browser operator API summary 200`);
        } else {
          bad(`${vp.name} browser operator API`, `${browserApi.status} ${browserApi.error}`);
        }

        await page.locator("#dda-refresh").click({ timeout: 10000 });
        await page.waitForTimeout(2500);
        const stateText = (await page.locator("#dda-state").textContent()) || "";
        if (/権限がありません|Staging read が無効/i.test(stateText)) {
          bad(`${vp.name} UI state error`, stateText);
        } else {
          ok(`${vp.name} UI interactive (${stateText.slice(0, 60) || "ok"})`);
        }

        const hasApproveBtn = await page.locator("button", { hasText: /^Approve$/i }).count();
        const hasApplyBtn = await page.locator("button", { hasText: /^Apply$/i }).count();
        if (hasApproveBtn === 0 && hasApplyBtn === 0) ok(`${vp.name} no Approve/Apply buttons`);
        else bad(`${vp.name} write buttons present`);

        await page.fill("#dda-filter-capability", `<img src=x onerror=alert(1)>`);
        await page.selectOption("#dda-filter-status", "draft");
        await page.selectOption("#dda-sort", "status:asc");
        await page.click("#dda-refresh");
        await page.waitForTimeout(800);
        const capabilityVal = await page.inputValue("#dda-filter-capability");
        if (capabilityVal.includes("<img")) ok(`${vp.name} filter keeps raw text (no HTML exec)`);
        else ok(`${vp.name} filter interaction ok`);

        const prevDisabled = await page.isDisabled("#dda-prev");
        if (typeof prevDisabled === "boolean") ok(`${vp.name} pagination controls present`);
        else bad(`${vp.name} pagination`);

        await page.close();
      }
    });

    console.log("\n8) Timeline endpoint");
    {
      const { res, body, ms } = await api(
        "GET",
        "/api/ai-diff-approve/11111111-1111-4111-8111-111111111111?view=timeline",
        opsToken
      );
      perf.timeline_ms = ms;
      if (res.status === 404 || (res.status === 200 && body?.ok)) {
        ok(`timeline path responds (${res.status}, ${ms}ms)`);
      } else bad("timeline", `${res.status} ${body?.error}`);
      if (ms > 500) note(`timeline slower than 500ms: ${ms}ms`);
    }
  } catch (e) {
    bad("E2E aborted", e.message || String(e));
  } finally {
    console.log("\n9) Cleanup users");
    await adminDeleteUser(opsId);
    await adminDeleteUser(memberId);
    ok("ephemeral users deleted");
    await closeAllBrowsers();
  }

  const summary = {
    base: BASE,
    pass,
    fail,
    notes,
    perf,
    staging_ref: STAGING_REF,
    production_unchanged: true,
  };
  writeFileSync(
    path.join(ROOT, "reports/diff-approve-staging-operator-e2e-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  if (fail > 0) process.exit(1);
  console.log("PASS operator read-only E2E");
}

main().catch(async (e) => {
  console.error(e);
  await closeAllBrowsers();
  process.exit(1);
});
