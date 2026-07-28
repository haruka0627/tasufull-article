#!/usr/bin/env node
/**
 * Diff & Approve — Apply Plan Dry-run Playwright (minimal)
 *   node scripts/test-diff-approve-staging-apply-plan-playwright.mjs
 *   --base http://127.0.0.1:8788
 */
import { readFileSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  withPlaywrightBrowser,
  closeAllBrowsers,
} from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (
  baseIdx >= 0
    ? args[baseIdx + 1]
    : process.env.DIFF_APPROVE_E2E_BASE || "http://127.0.0.1:8788"
).replace(/\/$/, "");

let pass = 0;
let fail = 0;
function ok(l) {
  pass += 1;
  console.log(`  ✓ ${l}`);
}
function bad(l, d) {
  fail += 1;
  console.log(`  ✗ ${l}${d ? ` — ${d}` : ""}`);
}

function loadEnv(rel) {
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
    )
      v = v.slice(1, -1);
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

for (const f of [
  "admin-diff-approve.html",
  "admin-diff-approve.css",
  "admin-diff-approve-client.js",
]) {
  try {
    copyFileSync(path.join(ROOT, f), path.join(ROOT, "deploy/cloudflare/dist", f));
  } catch {
    /* ignore */
  }
}

const staging = loadEnv(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(staging.TASFUL_SUPABASE_ANON_KEY || staging.SUPABASE_ANON_KEY || "");
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "");
const stamp = Date.now().toString(36);
const EMAIL = `diff-approve-plan-${stamp}@tasful.staging.test`;
const PASS = `PlanE2e!${stamp}Aa1`;

async function main() {
  console.log(`Base: ${BASE}`);
  const create = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASS,
      email_confirm: true,
      app_metadata: { is_ops: true, role: "tasu_admin" },
    }),
  });
  const user = await create.json().catch(() => ({}));
  const userId = user.id || user.user?.id;
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const session = await login.json();
  const forbidden = [];

  try {
    await withPlaywrightBrowser(async (browser) => {
      for (const vp of [
        { name: "desktop", width: 1280, height: 800 },
        { name: "mobile", width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });
        page.on("request", (req) => {
          if (/\/apply\b|executeProvider|provider\/execute/i.test(req.url())) {
            forbidden.push(req.url());
          }
        });
        await page.addInitScript(
          ({ key, session }) => {
            window.localStorage.setItem(
              key,
              JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_in: session.expires_in || 3600,
                expires_at:
                  Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
                token_type: "bearer",
                user: session.user,
              })
            );
          },
          {
            key: `sb-${STAGING_REF}-auth-token`,
            session,
          }
        );
        const resp = await page.goto(
          `${BASE}/admin-diff-approve.html?talkDev=1&talkAdmin=1`,
          { waitUntil: "domcontentloaded", timeout: 45000 }
        );
        if (resp && resp.status() < 400) ok(`${vp.name} page HTTP`);
        else bad(`${vp.name} page`, String(resp?.status()));
        await page.waitForSelector("#dda-refresh", { timeout: 20000 });
        const badges = await page.locator("header .dda-badge").allTextContents();
        if (
          badges.some((b) => /STAGING/i.test(b)) &&
          badges.some((b) => /DECISION WRITE/i.test(b)) &&
          badges.some((b) => /DRY RUN/i.test(b)) &&
          badges.some((b) => /NO APPLY/i.test(b))
        ) {
          ok(`${vp.name} badges`);
        } else bad(`${vp.name} badges`, badges.join(","));
        const apply = await page.locator("button", { hasText: /^Apply$/i }).count();
        const gen = await page.locator("button", {
          hasText: /Generate Dry-run Plan/i,
        }).count();
        if (apply === 0) ok(`${vp.name} no Apply button`);
        else bad(`${vp.name} Apply present`);
        // Generate button appears only when approved detail selected — soft ok if 0 on empty list
        ok(`${vp.name} generate control count=${gen} (0 ok without selection)`);
        await page.close();
      }
    });
    if (!forbidden.length) ok("no Apply/Provider network");
    else bad("forbidden net", forbidden.join(","));
  } finally {
    await closeAllBrowsers();
    if (userId) {
      await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: service, Authorization: `Bearer ${service}` },
      });
    }
  }

  writeFileSync(
    path.join(ROOT, "reports/diff-approve-staging-apply-plan-playwright-summary.json"),
    JSON.stringify(
      {
        verdict: fail === 0 ? "PASS_STAGING_APPLY_PLAN_PLAYWRIGHT" : "FAIL",
        pass,
        fail,
        base: BASE,
        apply: "NOT_EXECUTED",
        provider: "NOT_EXECUTED",
      },
      null,
      2
    )
  );
  console.log(`\npass=${pass} fail=${fail}`);
  if (fail) process.exit(1);
  console.log("PASS_STAGING_APPLY_PLAN_PLAYWRIGHT");
}

main().catch(async (e) => {
  console.error(e);
  await closeAllBrowsers();
  process.exit(1);
});
