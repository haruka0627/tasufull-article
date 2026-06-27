#!/usr/bin/env node
/**
 * AI秘書 Google OAuth Live — connect via API, open consent in default browser (not Playwright)
 *
 *   node --env-file=.env scripts/secretary-google-oauth-live-open-external.mjs
 *
 * UUID / Token / Secret / authUrl 値は stdout に出さない
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD = "http://127.0.0.1:8788/admin-operations-dashboard.html";

async function fetchAuthUserId() {
  const base = process.env.TASFUL_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.TASFUL_SUPABASE_ANON_KEY;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !sr) throw new Error("missing supabase env");
  const res = await fetch(`${base}/auth/v1/admin/users?per_page=1`, {
    headers: { Authorization: `Bearer ${sr}`, apikey: anon },
  });
  const data = await res.json().catch(() => ({}));
  const id = data.users?.[0]?.id;
  if (!id || !String(id).includes("-")) throw new Error("auth user id unavailable");
  return String(id);
}

async function postConnect(authUserId) {
  const base = process.env.TASFUL_SUPABASE_URL.replace(/\/$/, "");
  const anon = process.env.TASFUL_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/secretary-google-oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-secretary-dev-user-id": authUserId,
      Origin: "http://127.0.0.1:8788",
    },
    body: JSON.stringify({
      action: "connect",
      redirectUri: `${base}/functions/v1/secretary-google-oauth?action=ccallback`.replace(
        "ccallback",
        "callback"
      ),
      promptConsent: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { http: res.status, data };
}

async function openInDefaultBrowser(url) {
  if (process.platform === "win32") {
    // Avoid cmd.exe interpreting & in OAuth query strings (truncates authUrl).
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process -FilePath ${JSON.stringify(url)}`,
      ],
      { cwd: ROOT, windowsHide: true }
    );
    return;
  }
  if (process.platform === "darwin") {
    await execFileAsync("open", [url], { cwd: ROOT });
    return;
  }
  await execFileAsync("xdg-open", [url], { cwd: ROOT });
}

/** Presence-only audit — no secret / token / uuid values in output */
function auditAuthUrlParams(authUrl) {
  const u = new URL(authUrl);
  const keys = [
    "response_type",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "client_id",
    "access_type",
    "prompt",
  ];
  return {
    paramKeyCount: [...u.searchParams.keys()].length,
    requiredPresent: Object.fromEntries(keys.map((k) => [k, u.searchParams.has(k)])),
    responseTypeIsCode: u.searchParams.get("response_type") === "code",
  };
}

/** GET authUrl — detect Google invalid_request without Playwright consent interaction */
async function probeGoogleAuthUrlInvalidRequest(authUrl) {
  try {
    const res = await fetch(authUrl, { redirect: "follow" });
    const text = (await res.text()).slice(0, 8000);
    const missingResponseType = /Required parameter is missing: response_type/i.test(text);
    const invalidRequest = /invalid_request/i.test(text) && /Error 400/i.test(text);
    const signInOrConsent =
      /Sign in with Google|アカウントを選択|Choose an account|consent|Google アカウント/i.test(text);
    return {
      http: res.status,
      missingResponseTypeError: missingResponseType,
      invalidRequestPage: invalidRequest,
      consentOrSignInLikely: signInOrConsent,
      pass: !missingResponseType && !invalidRequest,
    };
  } catch (err) {
    return {
      http: 0,
      missingResponseTypeError: false,
      invalidRequestPage: false,
      consentOrSignInLikely: false,
      pass: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const probeOnly = args.has("--probe-only");
  const noOpen = args.has("--no-open") || probeOnly;

  const authUserId = await fetchAuthUserId();
  const connect = await postConnect(authUserId);
  const d = connect.data || {};
  const authUrl = String(d.authUrl || "").trim();

  const connectPass =
    connect.http === 200 &&
    d.mock === false &&
    d.configured === true &&
    authUrl.includes("accounts.google.com");

  const authUrlAudit = connectPass ? auditAuthUrlParams(authUrl) : null;
  const googleUrlProbe = connectPass ? await probeGoogleAuthUrlInvalidRequest(authUrl) : null;

  if (connectPass && !noOpen) {
    const dashboardUrl = `${DASHBOARD}?secretary_auth_uid=${encodeURIComponent(authUserId)}`;
    await openInDefaultBrowser(dashboardUrl);
    await openInDefaultBrowser(authUrl);
  }

  console.log("=== AI秘書 Google OAuth live external browser ===");
  console.log(`connect_pass: ${connectPass}`);
  console.log(`connect_http: ${connect.http}`);
  console.log(`mock_false: ${d.mock === false}`);
  console.log(`configured_true: ${d.configured === true}`);
  console.log(`auth_url_is_google: ${authUrl.includes("accounts.google.com")}`);
  if (authUrlAudit) {
    console.log(`auth_url_param_key_count: ${authUrlAudit.paramKeyCount}`);
    console.log(
      `auth_url_response_type_present: ${authUrlAudit.requiredPresent.response_type === true}`
    );
    console.log(
      `auth_url_redirect_uri_present: ${authUrlAudit.requiredPresent.redirect_uri === true}`
    );
    console.log(`auth_url_scope_present: ${authUrlAudit.requiredPresent.scope === true}`);
    console.log(`auth_url_state_present: ${authUrlAudit.requiredPresent.state === true}`);
    console.log(
      `auth_url_code_challenge_present: ${authUrlAudit.requiredPresent.code_challenge === true}`
    );
    console.log(`auth_url_response_type_is_code: ${authUrlAudit.responseTypeIsCode === true}`);
  }
  if (googleUrlProbe) {
    console.log(`google_url_probe_http: ${googleUrlProbe.http}`);
    console.log(`google_missing_response_type_error: ${googleUrlProbe.missingResponseTypeError}`);
    console.log(`google_invalid_request_page: ${googleUrlProbe.invalidRequestPage}`);
    console.log(`google_consent_or_signin_likely: ${googleUrlProbe.consentOrSignInLikely}`);
    console.log(`google_url_probe_pass: ${googleUrlProbe.pass}`);
  }
  console.log(`windows_launch_method: ${process.platform === "win32" ? "powershell_start_process" : "platform_default"}`);
  console.log(`external_browser_opened: ${connectPass && !noOpen}`);
  console.log("google_consent: complete manually in regular Chrome (not Playwright)");
  console.log(
    "post_consent: node --env-file=.env scripts/verify-secretary-google-oauth-live-post-consent.mjs"
  );

  const overallPass =
    connectPass &&
    authUrlAudit?.responseTypeIsCode === true &&
    googleUrlProbe?.pass === true;

  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
