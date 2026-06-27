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

function bodyHasSecretLeak(text) {
  const t = String(text || "");
  return (
    /refresh_token|access_token|client_secret|code_verifier/i.test(t) ||
    /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(t) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(t)
  );
}

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

        await page.click('[data-ops-google-tab="mail"]');
        await page.waitForTimeout(1200);

        const gmailAudit = await page.evaluate(() => {
          const summaryMode = document.querySelector("[data-ops-secretary-readonly-summary-mode]")?.dataset?.mode || "";
          const summaryMock = document.querySelector("[data-ops-secretary-google-readonly-summary]")?.dataset?.mock || "";
          const gmailCards = document.querySelector("[data-ops-secretary-gmail-cards]");
          const gmailCardsText = gmailCards?.textContent || "";
          const gmailGated = /接続後にメール/.test(gmailCardsText);
          const gmailCardCount = document.querySelectorAll(".ops-secretary-gmail__card").length;
          const gmailEmpty = /該当メールはありません/.test(gmailCardsText);
          const labelHost = document.querySelector("[data-ops-secretary-gmail-labels]");
          const labelChildCount = labelHost ? labelHost.querySelectorAll("[data-ops-secretary-gmail-label], button, p, span").length : 0;
          const writeVisible = (() => {
            const writeSel =
              '[data-gmail-action="propose-reply"], [data-calendar-action="update"], [data-calendar-action="delete"], [data-ops-secretary-calendar-create-btn]';
            return [...document.querySelectorAll(writeSel)].filter((el) => {
              if (el.hidden) return false;
              if (el.getAttribute("aria-hidden") === "true") return false;
              if (el.closest("[hidden]")) return false;
              const style = globalThis.getComputedStyle?.(el);
              if (style && (style.display === "none" || style.visibility === "hidden")) return false;
              return true;
            }).length;
          })();
          return {
            summaryMode,
            summaryMock,
            gmailGated,
            gmailContentOk: gmailCardCount >= 1 || gmailEmpty,
            labelUiOk: labelChildCount >= 1,
            writeVisible,
            bodyTextSample: document.body.innerText.slice(0, 8000),
          };
        });

        await page.click('[data-ops-google-tab="calendar"]');
        await page.waitForTimeout(1200);

        const calAudit = await page.evaluate(() => {
          const calPanel = document.querySelector("[data-ops-secretary-calendar-panel]");
          const calVisible = calPanel && !calPanel.hidden && calPanel.getAttribute("aria-hidden") !== "true";
          const calCards = document.querySelector("[data-ops-secretary-calendar-cards]");
          const calCardsText = calCards?.textContent || "";
          const calCardCount = document.querySelectorAll(".ops-secretary-calendar__card").length;
          const calEmpty = /予定はありません/.test(calCardsText);
          const calSelect = document.querySelector("[data-ops-secretary-calendar-list] select");
          const calOptionCount = calSelect ? calSelect.querySelectorAll("option").length : 0;
          return {
            calPanelVisible: Boolean(calVisible),
            calContentOk: calCardCount >= 1 || calEmpty,
            calListOk: calOptionCount >= 1,
          };
        });

        const audit = await page.evaluate(() => {
          const label = document.querySelector("[data-ops-secretary-google-status-label]")?.textContent || "";
          const state = document.querySelector("[data-ops-secretary-google-connect]")?.dataset?.state || "";
          const mock = document.querySelector("[data-ops-secretary-google-connect]")?.dataset?.mock || "";
          return { label, state, mock };
        });

        const uiPass =
          gmailAudit.summaryMode === "LIVE" &&
          gmailAudit.summaryMock === "0" &&
          !gmailAudit.gmailGated &&
          gmailAudit.gmailContentOk &&
          gmailAudit.labelUiOk &&
          calAudit.calPanelVisible &&
          calAudit.calContentOk &&
          calAudit.calListOk &&
          gmailAudit.writeVisible === 0 &&
          !bodyHasSecretLeak(gmailAudit.bodyTextSample);

        const pass =
          (resp?.status() ?? 0) === 200 &&
          /Google接続済み/.test(audit.label) &&
          !/mock/.test(audit.label) &&
          audit.state === "connected" &&
          audit.mock === "0" &&
          jsFatals.length === 0 &&
          uiPass;
        out.push({
          viewport: tag,
          http: resp?.status() ?? 0,
          labelPattern: /Google接続済み/.test(audit.label) ? "Google接続済み" : "other",
          connectedState: audit.state,
          mockDataset: audit.mock,
          jsFatalCount: jsFatals.length,
          summaryMode: gmailAudit.summaryMode,
          gmailContentOk: gmailAudit.gmailContentOk,
          gmailLabelsUiOk: gmailAudit.labelUiOk,
          calendarContentOk: calAudit.calContentOk,
          calendarListUiOk: calAudit.calListOk,
          writeVisible: gmailAudit.writeVisible,
          secretInDom: bodyHasSecretLeak(gmailAudit.bodyTextSample),
          uiPass,
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
  const calendarEvents = await postFn(
    base,
    anon,
    "secretary-google-tools",
    { action: "calendar_read", method: "events.list", calendarId: "primary", preset: "today", maxResults: 5 },
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
  const calendarEventsPass = calendarEvents.http === 200 && calendarEvents.data?.ok === true;
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
      eventsListProbe: {
        http: calendarEvents.http,
        ok: calendarEvents.data?.ok === true,
        pass: calendarEventsPass,
      },
    },
    dashboard,
    overallPass:
      statusPass &&
      vaultPass &&
      gmailLabelsPass &&
      profilePass &&
      gmailProfilePass &&
      calendarPass &&
      calendarEventsPass &&
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
  console.log(`calendar events.list: ${calendarEventsPass ? "PASS" : "FAIL"} (http ${calendarEvents.http})`);
  for (const d of dashboard) {
    console.log(
      `dashboard ${d.viewport}: ${d.pass ? "PASS" : "FAIL"} (http ${d.http}, jsFatal ${d.jsFatalCount}, ui ${d.uiPass ? "ok" : "fail"})`
    );
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
