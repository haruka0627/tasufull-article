#!/usr/bin/env node
/**
 * Phase7.2 — DB / Edge / セキュリティ プローブ（credential 出力なし）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTalkSupabaseConfig } from "./lib/talk-rls-test-auth.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const result = {
  db: {},
  edge: {},
  client: {},
  security: {},
};

async function probeDb(cfg) {
  const headers = { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` };
  const base = cfg.url;

  // Tables exist
  for (const table of ["talk_call_push_events", "talk_push_subscriptions"]) {
    const res = await fetch(`${base}/rest/v1/${table}?limit=0`, {
      headers: { ...headers, Prefer: "count=exact" },
    });
    result.db[table] = { reachable: res.ok, status: res.status };
  }

  // Column probe via insert/select shape (retry_eligible, status)
  const probeRes = await fetch(
    `${base}/rest/v1/talk_call_push_events?select=id,delivery_status,retry_eligible&limit=1`,
    { headers }
  );
  result.db.push_events_retry_eligible = {
    columnExists: probeRes.ok,
    status: probeRes.status,
  };

  const subProbe = await fetch(
    `${base}/rest/v1/talk_push_subscriptions?select=id,status&limit=1`,
    { headers }
  );
  result.db.subscriptions_status = {
    columnExists: subProbe.ok,
    status: subProbe.status,
  };

  // RLS policies via pg (if rpc unavailable, infer from REST behavior)
  const rlsRes = await fetch(`${base}/rest/v1/rpc/talk_current_user_id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);
  result.db.rls_helpers = { talk_current_user_id_rpc: rlsRes?.ok ?? false };

  // Check no vapid private in payload samples
  const sampleRes = await fetch(
    `${base}/rest/v1/talk_call_push_events?select=payload&limit=5`,
    { headers }
  );
  if (sampleRes.ok) {
    const rows = await sampleRes.json();
    const forbidden = ["email", "phone", "token", "credential", "payment", "private_key", "vapid"];
    let payloadClean = true;
    for (const row of rows) {
      const text = JSON.stringify(row.payload || {}).toLowerCase();
      for (const k of forbidden) {
        if (text.includes(`"${k}"`)) payloadClean = false;
      }
    }
    result.security.db_payload_samples_clean = payloadClean;
    result.security.db_payload_sample_count = rows.length;
  }
}

async function probeEdge(cfg) {
  const fnUrl = `${cfg.url.replace(/\/$/, "")}/functions/v1/talk-call-push-notify`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.serviceKey}`,
      apikey: cfg.serviceKey,
    },
    body: JSON.stringify({ call_id: "00000000-0000-0000-0000-000000000000" }),
  }).catch(() => null);

  result.edge.url = fnUrl;
  result.edge.deployed = res !== null && res.status !== 404;
  result.edge.status = res?.status ?? 0;
  if (res?.ok || res?.status === 400 || res?.status === 502) {
    try {
      const body = await res.json();
      result.edge.response_keys = Object.keys(body);
      result.edge.skipped_or_handled = body.skipped === true || body.reason !== undefined || body.error !== undefined;
      const bodyStr = JSON.stringify(body);
      result.security.edge_response_no_secrets =
        !bodyStr.includes("privateKey") &&
        !bodyStr.includes("WEB_PUSH_VAPID_PRIVATE") &&
        !bodyStr.includes("credential");
    } catch {
      result.edge.parse_error = true;
    }
  }
}

function probeClientSource() {
  const files = [
    "scripts/talk-push-subscribe.js",
    "talk-service-worker.js",
    "scripts/talk-call-push-events.js",
    "chat-supabase-config.example.js",
  ];
  const forbiddenClient = [
    "WEB_PUSH_VAPID_PRIVATE",
    "vapidPrivateKey",
    "turnCredential:",
    "TASFUL_TURN_CREDENTIAL",
  ];
  result.client.files_checked = files.length;
  result.client.private_key_in_client_source = false;
  result.client.webPushVapidPublicKey_supported = false;
  result.client.sw_scope_root = false;
  result.client.builder_sw_separate = false;

  const subSrc = readFileSync(join(ROOT, "scripts/talk-push-subscribe.js"), "utf8");
  result.client.webPushVapidPublicKey_supported = subSrc.includes("webPushVapidPublicKey");
  result.client.private_key_in_client_source =
    subSrc.includes("WEB_PUSH_VAPID_PRIVATE") || subSrc.includes("vapidPrivateKey");

  const swSrc = readFileSync(join(ROOT, "talk-service-worker.js"), "utf8");
  result.client.sw_scope_root = swSrc.includes('scope: /') || readFileSync(join(ROOT, "scripts/talk-push-subscribe.js"), "utf8").includes('SW_SCOPE = "/"');

  const builderSw = readFileSync(join(ROOT, "builder/service-worker.js"), "utf8");
  result.client.builder_sw_separate =
    builderSw.includes("/builder/") && !swSrc.includes("/builder/");

  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    for (const bad of forbiddenClient) {
      if (src.includes(bad) && f !== "chat-supabase-config.example.js") {
        if (bad.includes("TURN") && f === "scripts/talk-call-push-events.js") continue;
        result.client.private_key_in_client_source = result.client.private_key_in_client_source || bad.includes("VAPID");
      }
    }
  }

  const edgeSrc = readFileSync(join(ROOT, "supabase/functions/talk-call-push-notify/index.ts"), "utf8");
  result.security.edge_uses_safeLog = edgeSrc.includes("safeLog(");
  result.security.edge_no_console_log_body = !edgeSrc.includes("console.log(body");
}

async function main() {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey) {
    console.log(JSON.stringify({ error: "supabase_config_missing", result }, null, 2));
    process.exit(1);
  }
  await probeDb(cfg);
  await probeEdge(cfg);
  probeClientSource();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
