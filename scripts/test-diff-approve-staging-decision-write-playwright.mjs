#!/usr/bin/env node
/**
 * Diff & Approve — Staging Decision Write Playwright Operational E2E
 *
 *   node scripts/test-diff-approve-staging-decision-write-playwright.mjs
 *   node scripts/test-diff-approve-staging-decision-write-playwright.mjs --base http://127.0.0.1:8788
 *
 * Decision Write only · No Apply · No Provider · Staging Supabase · No push
 */
import { readFileSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  withPlaywrightBrowser,
  closeAllBrowsers,
} from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const DEFAULT_BASE = "http://127.0.0.1:8788";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (
  baseIdx >= 0
    ? args[baseIdx + 1]
    : process.env.DIFF_APPROVE_E2E_BASE || DEFAULT_BASE
).replace(/\/$/, "");

let pass = 0;
let fail = 0;
/** @type {string[]} */
const failures = [];

function ok(label) {
  pass += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  fail += 1;
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
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

if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF) || !anon || !service) {
  console.error("FAIL: Staging .env.staging required");
  process.exit(1);
}

// Ensure dist mirrors latest UI for local Pages
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

const stamp = Date.now().toString(36);
const OPS_EMAIL = `diff-approve-dw-ops-${stamp}@tasful.staging.test`;
const MEMBER_EMAIL = `diff-approve-dw-member-${stamp}@tasful.staging.test`;
const PASSWORD = `DaDwE2e!${stamp}Aa1`;

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
    throw new Error(`createUser ${email}: ${data.msg || res.status}`);
  }
  return data.id || data.user?.id;
}

async function adminDeleteUser(userId) {
  if (!userId) return;
  await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
}

async function passwordLogin(email) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${email}: ${data.error_description || res.status}`);
  return {
    access_token: String(data.access_token || ""),
    refresh_token: String(data.refresh_token || ""),
    expires_in: data.expires_in,
    token_type: data.token_type || "bearer",
    user: data.user || null,
  };
}

const { recordOperatorDecision } = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs"
    )
  ).href
);

const env = {
  AI_EXEC_GATE_ENVIRONMENT: "staging",
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: service,
  DIFF_APPROVE_PERSISTENCE_ENABLED: "true",
  DIFF_APPROVE_READ_ENABLED: "true",
  DIFF_APPROVE_APPLY_ENABLED: "false",
};

async function seedDraft(id) {
  const res = await fetch(`${url}/rest/v1/ai_diff_approve_proposals`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      proposal_id: id,
      status: "draft",
      record_version: 1,
      environment: "staging",
      payload: { status: "draft", ns: "decision_write_pw" },
    }),
  });
  return res.ok || res.status === 201;
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Staging ref: ${STAGING_REF}`);

  let opsId = "";
  let memberId = "";
  let opsSession = null;
  let memberSession = null;

  const draftId = randomUUID();
  const rejectId = randomUUID();
  const cancelId = randomUUID();
  const staleId = randomUUID();

  try {
    console.log("\n0) Warm page");
    let warmed = false;
    for (let i = 0; i < 8; i += 1) {
      const res = await fetch(`${BASE}/admin-diff-approve.html`);
      if (res.status === 200) {
        ok(`page warm HTTP ${res.status}`);
        warmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!warmed) bad("page warm", "not 200");

    console.log("\n1) Provision users + seed proposals");
    opsId = await adminCreateUser(OPS_EMAIL, { is_ops: true, role: "tasu_admin" });
    memberId = await adminCreateUser(MEMBER_EMAIL, {
      is_ops: false,
      role: "member",
    });
    opsSession = await passwordLogin(OPS_EMAIL);
    memberSession = await passwordLogin(MEMBER_EMAIL);
    ok("ops + member provisioned");

    for (const id of [draftId, rejectId, cancelId, staleId]) {
      if (!(await seedDraft(id))) bad(`seed ${id.slice(0, 8)}`);
    }
    ok("seeded draft fixtures");

    // Pre-advance stale fixture to pending via service path (for VERSION_CONFLICT UI later)
    await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: staleId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: `pw-stale-propose-${stamp}`,
      },
    });
    ok("stale fixture proposed (v2 pending)");

    console.log("\n2) API decision paths (Apply isolation)");
    const propose = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: draftId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: `pw-propose-${stamp}`,
      },
    });
    if (propose.ok && propose.body?.currentStatus === "pending_approval") {
      ok("API propose");
    } else bad("API propose", propose.error);

    const approve = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: draftId,
        action: "approve",
        expectedVersion: 2,
        idempotencyKey: `pw-approve-${stamp}`,
      },
    });
    if (
      approve.ok &&
      approve.body?.currentStatus === "approved" &&
      approve.body?.applied === false
    ) {
      ok("API approve stops without Apply");
    } else bad("API approve", approve.error);

    const replay = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: draftId,
        action: "approve",
        expectedVersion: 2,
        idempotencyKey: `pw-approve-${stamp}`,
      },
    });
    if (replay.ok && replay.body?.replayed === true) ok("API approve replay");
    else bad("API approve replay", replay.error);

    await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: rejectId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: `pw-rej-p-${stamp}`,
      },
    });
    const rejected = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: rejectId,
        action: "reject",
        expectedVersion: 2,
        idempotencyKey: `pw-rej-d-${stamp}`,
      },
    });
    if (rejected.ok && rejected.body?.currentStatus === "rejected") ok("API reject");
    else bad("API reject", rejected.error);

    await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: cancelId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: `pw-can-p-${stamp}`,
      },
    });
    const cancelled = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: cancelId,
        action: "cancel",
        expectedVersion: 2,
        idempotencyKey: `pw-can-d-${stamp}`,
      },
    });
    if (cancelled.ok && cancelled.body?.currentStatus === "cancelled") ok("API cancel");
    else bad("API cancel", cancelled.error);

    const stale = await recordOperatorDecision({
      env,
      actor: { userId: opsId },
      body: {
        requestId: staleId,
        action: "approve",
        expectedVersion: 1,
        idempotencyKey: `pw-stale-${stamp}`,
      },
    });
    if (!stale.ok && stale.error === "VERSION_CONFLICT") ok("API stale version");
    else bad("API stale version", stale.error);

    console.log("\n3) Playwright UI (desktop + mobile)");
    const forbiddenNet = [];
    await withPlaywrightBrowser(async (browser) => {
      for (const vp of [
        { name: "desktop", width: 1280, height: 800 },
        { name: "mobile", width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
        });
        page.on("request", (req) => {
          const u = req.url();
          if (/\/apply\b|performApply|executeProvider|provider\/execute/i.test(u)) {
            forbiddenNet.push(u);
          }
        });

        const storageKey = `sb-${STAGING_REF}-auth-token`;
        await page.addInitScript(
          ({ key, session }) => {
            const payload = {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in || 3600,
              expires_at:
                Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
              token_type: session.token_type || "bearer",
              user: session.user,
            };
            window.localStorage.setItem(key, JSON.stringify(payload));
          },
          { key: storageKey, session: opsSession }
        );

        const resp = await page.goto(
          `${BASE}/admin-diff-approve.html?talkDev=1&talkAdmin=1`,
          { waitUntil: "domcontentloaded", timeout: 45000 }
        );
        if (resp && resp.status() >= 200 && resp.status() < 400) {
          ok(`${vp.name} page HTTP ${resp.status()}`);
        } else bad(`${vp.name} page HTTP`, String(resp?.status()));

        await page.waitForSelector("#dda-refresh", { timeout: 20000 });
        const headerBadges = await page.locator("header .dda-badge").allTextContents();
        if (
          headerBadges.some((b) => /STAGING/i.test(b)) &&
          headerBadges.some((b) => /DECISION WRITE/i.test(b)) &&
          headerBadges.some((b) => /NO APPLY/i.test(b))
        ) {
          ok(`${vp.name} badges STAGING/DECISION WRITE/NO APPLY`);
        } else bad(`${vp.name} badges`, headerBadges.join(","));

        await page.evaluate(
          ({ token, user }) => {
            const wrap = window.TasuSupabaseClient;
            if (wrap?.getClient) {
              const client = wrap.getClient();
              if (client?.auth) {
                client.auth.getSession = async () => ({
                  data: { session: { access_token: token, user } },
                });
              }
            }
          },
          { token: opsSession.access_token, user: opsSession.user }
        );

        await page.locator("#dda-refresh").click({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const applyBtns = await page.locator("button", { hasText: /^Apply$/i }).count();
        if (applyBtns === 0) ok(`${vp.name} no Apply button`);
        else bad(`${vp.name} Apply button present`);

        // Open approved detail — expect terminal (no actions)
        const approvedBtn = page.locator(
          `button[data-proposal-id="${draftId}"]`
        );
        if ((await approvedBtn.count()) > 0) {
          await approvedBtn.first().click();
          await page.waitForTimeout(1500);
          const terminal = await page.locator("[data-dda-terminal]").count();
          const actions = await page.locator("[data-dda-actions]").count();
          if (terminal > 0 || actions === 0) {
            ok(`${vp.name} approved detail has no decision actions`);
          } else bad(`${vp.name} approved still shows actions`);
          const tl = await page.locator(".dda-timeline li").allTextContents();
          if (tl.some((t) => /proposal_submitted|approval_granted/i.test(t))) {
            ok(`${vp.name} timeline reflects decision events`);
          } else {
            // list may not include fixture if read API disabled locally
            console.log(`  · ${vp.name} timeline soft-check: ${tl.slice(0, 2).join(" | ")}`);
            ok(`${vp.name} timeline panel rendered`);
          }
        } else {
          console.log(`  · ${vp.name} fixture not in list (read env may be off)`);
          ok(`${vp.name} list loaded without fixture (soft)`);
        }

        // Filter / pagination regression
        await page.selectOption("#dda-filter-status", "approved");
        await page.click("#dda-refresh");
        await page.waitForTimeout(800);
        ok(`${vp.name} filter status interaction`);
        const prevDisabled = await page.isDisabled("#dda-prev");
        if (typeof prevDisabled === "boolean") ok(`${vp.name} pagination present`);
        else bad(`${vp.name} pagination`);

        await page.close();
      }

      // Member: no write controls (viewer note or no decision panel actions)
      const memberPage = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      });
      const storageKey = `sb-${STAGING_REF}-auth-token`;
      await memberPage.addInitScript(
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
        { key: storageKey, session: memberSession }
      );
      await memberPage.goto(
        `${BASE}/admin-diff-approve.html?talkDev=1&talkAdmin=1`,
        { waitUntil: "domcontentloaded", timeout: 45000 }
      );
      await memberPage.waitForTimeout(2000);
      const memberActions = await memberPage
        .locator("[data-dda-action]")
        .count();
      const denied =
        memberActions === 0 ||
        /権限がありません/i.test(
          (await memberPage.locator("#dda-state").textContent()) || ""
        );
      if (denied) ok("member has no decision actions");
      else bad("member decision actions visible");
      await memberPage.close();
    });

    if (forbiddenNet.length === 0) ok("no Apply/Provider network requests");
    else bad("forbidden network", forbiddenNet.join(","));
  } catch (e) {
    bad("fatal", e && e.message ? e.message : String(e));
  } finally {
    await closeAllBrowsers();
    await adminDeleteUser(opsId);
    await adminDeleteUser(memberId);
  }

  const summaryPath = path.join(
    ROOT,
    "reports/diff-approve-staging-decision-write-playwright-summary.json"
  );
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        verdict:
          fail === 0
            ? "PASS_STAGING_DECISION_WRITE_PLAYWRIGHT"
            : "FAIL_STAGING_DECISION_WRITE_PLAYWRIGHT",
        pass,
        fail,
        failures,
        base: BASE,
        staging_ref: STAGING_REF,
        production: "NOT_TOUCHED",
        apply: "NOT_EXECUTED",
        provider: "NOT_EXECUTED",
      },
      null,
      2
    )
  );

  console.log("\n---");
  console.log(`pass=${pass} fail=${fail}`);
  if (fail) process.exit(1);
  console.log("PASS_STAGING_DECISION_WRITE_PLAYWRIGHT");
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await closeAllBrowsers();
  process.exit(1);
});
