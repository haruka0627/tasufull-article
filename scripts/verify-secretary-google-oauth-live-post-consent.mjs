#!/usr/bin/env node
/**
 * AI秘書 Google OAuth Live — post-consent verification (API + Dashboard)
 * UUID / Token / Secret 値は stdout / JSON に出さない
 *
 *   node --env-file=.env scripts/verify-secretary-google-oauth-live-post-consent.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_JSON = path.join(ROOT, "reports/ai-secretary-google-oauth-live-e2e.json");

function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).toLowerCase();
    if (
      /token|secret|key|password|authorization|bearer|refresh|access_token|code_verifier|client_secret|client_id|user_id|uuid|email|google_account|vault_row|authurl|id_token/.test(
        key
      )
    ) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") out[k] = redact(v);
    else out[k] = v;
  }
  return out;
}

async function fetchAuthUserIdFromVault(base, anon, sr) {
  const url = `${base.replace(/\/$/, "")}/rest/v1/secretary_google_token_vault?provider=eq.google&select=user_id&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${sr}`,
      Accept: "application/json",
    },
  });
  const rows = await res.json().catch(() => []);
  const id = Array.isArray(rows) && rows[0]?.user_id ? String(rows[0].user_id) : "";
  return id || null;
}

async function countVaultRows(base, anon, sr) {
  const url = `${base.replace(/\/$/, "")}/rest/v1/secretary_google_token_vault?provider=eq.google&select=id`;
  const res = await fetch(url, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${sr}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const range = res.headers.get("content-range") || "";
  const m = range.match(/\/(\d+)$/);
  if (m) return Number(m[1]);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function postFn(base, anon, fn, payload, devUserId) {
  const url = `${base.replace(/\/$/, "")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-secretary-dev-user-id": devUserId,
      Origin: "http://127.0.0.1:8788",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { http: res.status, data: redact(data) };
}

async function runDashboard(devUserId) {
  const base = await findDevServerBaseUrl({ probePath: "admin-operations-dashboard.html" });
  const pageUrl = `${base.replace(/\/$/, "")}/admin-operations-dashboard.html`;
  const out = [];

  await withPlaywrightBrowser(async (browser) => {
    for (const [w, h, tag] of [
      [1280, 900, "1280"],
      [390, 844, "390"],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const jsFatals = [];
      page.on("pageerror", (e) => jsFatals.push(String(e.message || e)));
      try {
        const bootstrapUrl = `${pageUrl}?secretary_auth_uid=${encodeURIComponent(devUserId)}`;
        const resp = await page.goto(bootstrapUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction(
          () => document.querySelector("[data-ops-secretary-google-status-label]"),
          { timeout: 30000 }
        );
        await page.waitForTimeout(2500);
        const audit = await page.evaluate(() => {
          const label = document.querySelector("[data-ops-secretary-google-status-label]")?.textContent || "";
          const state = document.querySelector("[data-ops-secretary-google-connect]")?.dataset?.state || "";
          const mock = document.querySelector("[data-ops-secretary-google-connect]")?.dataset?.mock || "";
          return { label, state, mock };
        });
        const pass =
          (resp?.status() ?? 0) === 200 &&
          /Google接続済み/.test(audit.label) &&
          !/mock/.test(audit.label) &&
          audit.state === "connected" &&
          audit.mock === "0" &&
          jsFatals.length === 0;
        out.push({
          viewport: tag,
          http: resp?.status() ?? 0,
          labelPattern: /Google接続済み/.test(audit.label) ? "Google接続済み" : "other",
          connectedState: audit.state,
          mockDataset: audit.mock,
          jsFatalCount: jsFatals.length,
          pass,
        });
      } finally {
        await page.close();
      }
    }
  });

  return out;
}

async function main() {
  const base = process.env.TASFUL_SUPABASE_URL;
  const anon = process.env.TASFUL_SUPABASE_ANON_KEY;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !sr) {
    console.error("FAIL: missing TASFUL_SUPABASE_URL / ANON / SERVICE_ROLE in env");
    process.exit(1);
  }

  let gitHead = "unknown";
  try {
    gitHead = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    /* ignore */
  }

  const devUserId = await fetchAuthUserIdFromVault(base, anon, sr);
  if (!devUserId) {
    console.error("FAIL: no Token Vault row for provider=google (OAuth callback not completed?)");
    process.exit(1);
  }

  const vaultRows = await countVaultRows(base, anon, sr);

  const status = await postFn(base, anon, "secretary-google-oauth", { action: "status" }, devUserId);
  const st = status.data || {};

  const gmailLabels = await postFn(
    base,
    anon,
    "secretary-google-tools",
    { action: "gmail", method: "labels.list" },
    devUserId
  );
  const gmailProfile = await postFn(
    base,
    anon,
    "secretary-google-tools",
    { action: "gmail", method: "messages.list", maxResults: 1 },
    devUserId
  );
  const calendarList = await postFn(
    base,
    anon,
    "secretary-google-tools",
    { action: "calendar_read", method: "calendarList.list" },
    devUserId
  );

  const dashboard = await runDashboard(devUserId);

  const statusPass =
    status.http === 200 &&
    st.connected === true &&
    st.mock === false &&
    st.configured === true;
  const profilePass = statusPass && Boolean(st.googleAccountEmail);
  const vaultPass = vaultRows >= 1;
  const gmailLabelsPass = gmailLabels.http === 200 && gmailLabels.data?.ok === true;
  const gmailProfilePass = gmailProfile.http === 200 && gmailProfile.data?.ok === true;
  const calendarPass = calendarList.http === 200 && calendarList.data?.ok === true;
  const dashboardPass = dashboard.every((d) => d.pass);

  const report = {
    verifiedAt: new Date().toISOString(),
    gitHead,
    method: "post_consent_api_and_dashboard",
    devUserIdSource: "token_vault_provider_google",
    statusAfterConsent: {
      http: status.http,
      connected: st.connected === true,
      mock: st.mock === false,
      configured: st.configured === true,
      hasEmail: Boolean(st.googleAccountEmail),
      hasScope: Boolean(st.scope),
      hasExpiresAt: Boolean(st.expiresAt),
      pass: statusPass,
    },
    tokenVault: {
      rows: vaultRows,
      hasRow: vaultPass,
      pass: vaultPass,
    },
    gmail: {
      labelsList: { http: gmailLabels.http, ok: gmailLabels.data?.ok === true, pass: gmailLabelsPass },
      profileFromStatus: {
        pass: profilePass,
        hasEmail: Boolean(st.googleAccountEmail),
        note: "googleAccountEmail via oauth status (no token exposure)",
      },
      messagesListProbe: {
        http: gmailProfile.http,
        ok: gmailProfile.data?.ok === true,
        pass: gmailProfilePass,
      },
    },
    calendar: {
      calendarList: { http: calendarList.http, ok: calendarList.data?.ok === true, pass: calendarPass },
    },
    dashboard,
    overallPass:
      statusPass &&
      vaultPass &&
      gmailLabelsPass &&
      profilePass &&
      gmailProfilePass &&
      calendarPass &&
      dashboardPass,
  };

  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("=== AI秘書 Google OAuth Live post-consent ===");
  console.log(`status connected: ${statusPass ? "PASS" : "FAIL"} (http ${status.http})`);
  console.log(`token vault rows: ${vaultPass ? "PASS" : "FAIL"} (count=${vaultRows})`);
  console.log(`gmail labels.list: ${gmailLabelsPass ? "PASS" : "FAIL"} (http ${gmailLabels.http})`);
  console.log(`gmail profile (status email): ${profilePass ? "PASS" : "FAIL"}`);
  console.log(`gmail messages.list: ${gmailProfilePass ? "PASS" : "FAIL"} (http ${gmailProfile.http})`);
  console.log(`calendar calendarList.list: ${calendarPass ? "PASS" : "FAIL"} (http ${calendarList.http})`);
  for (const d of dashboard) {
    console.log(`dashboard ${d.viewport}: ${d.pass ? "PASS" : "FAIL"} (http ${d.http}, jsFatal ${d.jsFatalCount})`);
  }
  console.log(`overall: ${report.overallPass ? "PASS" : "FAIL"}`);
  console.log(`JSON: reports/ai-secretary-google-oauth-live-e2e.json`);

  await closeAllBrowsers();
  process.exit(report.overallPass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err?.message || err);
  await closeAllBrowsers();
  process.exit(1);
});
