#!/usr/bin/env node
/**
 * AI秘書 — Google OAuth live bootstrap
 *   GCP Client 作成後 · .env に CLIENT_ID / CLIENT_SECRET を設定して実行
 *
 *   node --env-file=.env scripts/secretary-google-oauth-live-bootstrap.mjs
 *
 * Secret / Token 値は stdout に出さない
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const LOCAL = "http://127.0.0.1:8788";

function redact(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).toLowerCase();
    if (/token|secret|key|password|authorization|bearer|refresh|access_token|code_verifier|client_secret|client_id/.test(key)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") out[k] = redact(v);
    else out[k] = v;
  }
  return out;
}

function secretPresenceFromList(listRaw) {
  const names = [];
  for (const line of listRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*\|/);
    if (m) names.push(m[1]);
  }
  const check = (n) => names.includes(n);
  return {
    SECRETARY_GOOGLE_OAUTH_MOCK: check("SECRETARY_GOOGLE_OAUTH_MOCK") ? "present" : "absent",
    SECRETARY_GOOGLE_REDIRECT_URI: check("SECRETARY_GOOGLE_REDIRECT_URI") ? "present" : "absent",
    SECRETARY_GOOGLE_CLIENT_ID: check("SECRETARY_GOOGLE_CLIENT_ID") ? "present" : "absent",
    SECRETARY_GOOGLE_CLIENT_SECRET: check("SECRETARY_GOOGLE_CLIENT_SECRET") ? "present" : "absent",
  };
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: opts.silent ? ["pipe", "pipe", "pipe"] : "inherit", ...opts });
}

async function apiLiveSmoke(devUserId) {
  const base = process.env.TASFUL_SUPABASE_URL.replace(/\/$/, "");
  const anon = process.env.TASFUL_SUPABASE_ANON_KEY;
  const oauthFn = `${base}/functions/v1/secretary-google-oauth`;
  const toolsFn = `${base}/functions/v1/secretary-google-tools`;
  const headers = {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "x-secretary-dev-user-id": devUserId,
    Origin: LOCAL,
  };
  async function post(url, payload) {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    return { http: r.status, data: redact(await r.json().catch(() => ({}))) };
  }
  const connectRes = await post(oauthFn, {
    action: "connect",
    redirectUri: `${oauthFn}?action=callback`,
    promptConsent: true,
  });
  const c = connectRes.data || {};
  const out = {
    connect: {
      http: connectRes.http,
      ok: c.ok,
      mock: c.mock,
      hasAuthUrl: Boolean(c.authUrl),
      authUrlIsGoogle: typeof c.authUrl === "string" && c.authUrl.includes("accounts.google.com"),
      error: c.error || null,
    },
  };
  const st = (await post(oauthFn, { action: "status" })).data || {};
  out.statusBefore = { connected: st.connected, mock: st.mock };
  return out;
}

async function main() {
  const clientId = process.env.SECRETARY_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.SECRETARY_GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error("FAIL: SECRETARY_GOOGLE_CLIENT_ID / SECRETARY_GOOGLE_CLIENT_SECRET required in .env");
    process.exit(1);
  }

  console.log("== Supabase secrets set (values not logged) ==");
  run(`npx supabase secrets set --env-file .env SECRETARY_GOOGLE_CLIENT_ID SECRETARY_GOOGLE_CLIENT_SECRET --project-ref ${PROJECT_REF}`, {
    silent: true,
  });

  console.log("== Unset SECRETARY_GOOGLE_OAUTH_MOCK ==");
  try {
    run(`npx supabase secrets unset SECRETARY_GOOGLE_OAUTH_MOCK --project-ref ${PROJECT_REF}`, { silent: true });
  } catch {
    console.log("MOCK secret already absent or unset skipped");
  }

  console.log("== Edge redeploy ==");
  run(
    `npx supabase functions deploy secretary-google-oauth secretary-google-tools --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes`
  );

  const listRaw = run(`npx supabase secrets list --project-ref ${PROJECT_REF}`, { silent: true });
  const secrets = secretPresenceFromList(listRaw);
  console.log("Secrets presence:", secrets);

  const base = process.env.TASFUL_SUPABASE_URL.replace(/\/$/, "");
  const devUserId = (
    await (
      await fetch(`${base}/auth/v1/admin/users?per_page=1`, {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.TASFUL_SUPABASE_ANON_KEY,
        },
      })
    ).json()
  ).users?.[0]?.id;

  const api = await apiLiveSmoke(devUserId);
  console.log("API connect smoke:", JSON.stringify(api, null, 2));

  const liveReady =
    secrets.SECRETARY_GOOGLE_CLIENT_ID === "present" &&
    secrets.SECRETARY_GOOGLE_CLIENT_SECRET === "present" &&
    secrets.SECRETARY_GOOGLE_OAUTH_MOCK === "absent" &&
    api.connect?.http === 200 &&
    api.connect?.mock === false &&
    api.connect?.authUrlIsGoogle === true;

  if (!liveReady) {
    console.error("FAIL: live bootstrap checks failed");
    process.exit(1);
  }

  console.log("PASS: live bootstrap — connect returns Google authUrl (mock:false)");
  console.log("NEXT: complete browser consent as test user, then run live callback E2E");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
