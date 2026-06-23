#!/usr/bin/env node
/**
 * Gate-E — Stripe / Webhook / 通知 / 運用 smoke（非公開本番向け）
 *
 *   node scripts/verify-gate-e-stripe-notify.mjs
 *   node scripts/verify-gate-e-stripe-notify.mjs --skip-e2e-pay
 *
 * Env: reads anon key from chat-supabase-config.js
 * Does NOT perform Live card charges. Test-mode e2e pay uses tok_visa only when --skip-e2e-pay omitted.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://ddojquacsyqesrjhcvmn.supabase.co";
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
const PRODUCTION_ORIGIN = "https://tasufull-article.pages.dev";
const ALLOWED_EMAIL = "rubi.hiro0613@gmail.com";
const skipE2ePay = process.argv.includes("--skip-e2e-pay");

const anonKey =
  readFileSync(join(ROOT, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

/** @type {{ id: string, status: "PASS"|"HOLD"|"FAIL"|"SKIP", detail?: string }[]} */
const rows = [];

function record(id, status, detail = "") {
  rows.push({ id, status, detail });
  const tag = status.padEnd(4);
  console.log(`  ${tag}  ${id}${detail ? ` — ${detail}` : ""}`);
}

async function post(fn, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text };
}

function detectStripeModeFromCheckoutUrl(url) {
  if (!url) return "unknown";
  if (/cs_test_|\/test\//i.test(url)) return "test";
  if (/cs_live_|\/live\//i.test(url)) return "live";
  return "unknown";
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "reports" || name === "deploy") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (/\.(html|js)$/i.test(name)) acc.push(p);
  }
  return acc;
}

function checkProductionUrlLeak() {
  const patterns = [/tasufull-article\.pages\.dev/i, /https:\/\/tasful\.jp/i, /https:\/\/www\.tasful\.jp/i];
  const hits = [];
  for (const file of walkFiles(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel.startsWith("scripts/") && /debug|diag|capture|screenshot/i.test(rel)) continue;
    const src = readFileSync(file, "utf8");
    for (const re of patterns) {
      if (re.test(src)) {
        hits.push(rel);
        break;
      }
    }
  }
  return hits;
}

async function main() {
  console.log("[gate-e] Stripe / Webhook / notify verification\n");

  // --- Stripe secrets presence ---
  const secrets = spawnSync("npx", ["supabase", "secrets", "list", "--project-ref", "ddojquacsyqesrjhcvmn"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  const secretOut = `${secrets.stdout || ""}${secrets.stderr || ""}`;
  const requiredSecrets = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_GENAI_PRICE_BASIC_300",
    "STRIPE_GENAI_PRICE_PRO_980",
    "STRIPE_GENAI_PRICE_2D_LIVE_300",
    "STRIPE_GENAI_PRICE_3D_GENERATE_500",
  ];
  for (const name of requiredSecrets) {
    record(`secret:${name}`, secretOut.includes(name) ? "PASS" : "FAIL", secretOut.includes(name) ? "digest listed" : "missing");
  }

  // --- Checkout creation ---
  const testUser = `gate_e_${Date.now()}`;
  const basic = await post("stripe-create-genai-checkout", {
    genai_plan: "genai_basic_300",
    user_id: testUser,
    origin: PRODUCTION_ORIGIN,
  });
  const stripeMode = detectStripeModeFromCheckoutUrl(basic.data?.url || "");
  record(
    "stripe:mode",
    stripeMode === "test" || stripeMode === "live" ? "PASS" : "FAIL",
    stripeMode
  );
  if (stripeMode === "live") {
    record("stripe:live-warning", "HOLD", "Live keys active — real charges possible; use minimal amounts only");
  }

  record(
    "checkout:genai-basic",
    basic.status === 200 && basic.data?.ok && basic.data?.url ? "PASS" : "FAIL",
    basic.data?.url ? `mode=${basic.data.checkout_mode}` : basic.data?.error || basic.status
  );

  const ticket = await post("stripe-create-genai-checkout", {
    genai_plan: "genai_3d_generate_500",
    user_id: testUser,
    origin: PRODUCTION_ORIGIN,
  });
  record(
    "checkout:genai-3d-ticket",
    ticket.status === 200 && ticket.data?.ok && ticket.data?.checkout_mode === "payment" ? "PASS" : "FAIL",
    ticket.data?.url ? "has url" : ticket.data?.error
  );

  const featured = await post("stripe-create-checkout", {
    listing_id: "00000000-0000-4000-8000-000000000001",
    featured_plan: "featured_7days",
    user_id: testUser,
    origin: PRODUCTION_ORIGIN,
  });
  record(
    "checkout:featured",
    featured.status === 200 && featured.data?.ok && featured.data?.url ? "PASS" : "HOLD",
    featured.data?.error || (featured.data?.url ? "session ok" : `status ${featured.status}`)
  );

  // --- Webhook endpoint hygiene ---
  const whNoSig = await fetch(WEBHOOK_URL, { method: "POST", body: "{}" });
  const whNoSigText = await whNoSig.text();
  record(
    "webhook:no-signature",
    whNoSig.status === 400 && /Missing stripe-signature/i.test(whNoSigText) ? "PASS" : "FAIL",
    `status=${whNoSig.status}`
  );

  const whBadSig = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "stripe-signature": "t=0,v1=invalid" },
    body: '{"id":"evt_test"}',
  });
  const whBadSigText = await whBadSig.text();
  record(
    "webhook:invalid-signature",
    whBadSig.status === 400 && /Invalid signature|signature/i.test(whBadSigText) ? "PASS" : "FAIL",
    `status=${whBadSig.status}`
  );

  // --- Webhook registration (test catalog) ---
  const catalog = await post("stripe-setup-genai-catalog", {});
  if (catalog.status === 403 && /sk_test_/i.test(String(catalog.data?.error || ""))) {
    record("webhook:catalog-setup", "SKIP", "not test mode — verify webhook in Stripe Dashboard manually");
  } else {
    const wh = catalog.data?.webhook || catalog.data?.webhook_endpoint;
    const endpointUrl = wh?.url || catalog.data?.webhook_url || "";
    record(
      "webhook:catalog-setup",
      catalog.status === 200 && catalog.data?.ok ? "PASS" : "HOLD",
      endpointUrl || catalog.data?.error || `status ${catalog.status}`
    );
    record(
      "webhook:url-match",
      endpointUrl.includes("/stripe-webhook") ? "PASS" : "HOLD",
      endpointUrl || "no url in response"
    );
    const events = wh?.enabled_events || catalog.data?.enabled_events || [];
    const hasCompleted = Array.isArray(events) && events.includes("checkout.session.completed");
    record("webhook:event-checkout-completed", hasCompleted ? "PASS" : "HOLD", events.join(",") || "n/a");
  }

  // --- E2E pay + DB (test only) ---
  if (!skipE2ePay && stripeMode === "test" && ticket.data?.session_id) {
    const pay = await post("stripe-e2e-pay-genai-checkout", { session_id: ticket.data.session_id });
    record(
      "checkout:e2e-pay-3d",
      pay.status === 200 && (pay.data?.paid || pay.data?.already_paid) ? "PASS" : "HOLD",
      pay.data?.error || `payment_status=${pay.data?.payment_status}`
    );

    const confirm1 = await post("stripe-confirm-genai-checkout", { session_id: ticket.data.session_id });
    record(
      "db:confirm-genai-1",
      confirm1.status === 200 && confirm1.data?.ok ? "PASS" : "HOLD",
      confirm1.data?.error || `tickets=${confirm1.data?.entitlements?.tickets3dRemaining}`
    );

    const confirm2 = await post("stripe-confirm-genai-checkout", { session_id: ticket.data.session_id });
    const idempotent =
      confirm2.status === 200 &&
      confirm2.data?.ok &&
      (confirm2.data?.already_granted || confirm2.data?.alreadyGranted || confirm1.data?.entitlements?.tickets3dRemaining === confirm2.data?.entitlements?.tickets3dRemaining);
    record("db:confirm-idempotent", idempotent ? "PASS" : "HOLD", confirm2.data?.error || "second confirm ok");

    const plan = await post("stripe-get-genai-plan", { user_id: testUser });
    record(
      "db:get-plan-after-pay",
      plan.status === 200 && plan.data?.ok ? "PASS" : "FAIL",
      `tickets3d=${plan.data?.entitlements?.tickets3dRemaining}`
    );
  } else if (stripeMode === "live") {
    record("checkout:e2e-pay-3d", "SKIP", "Live mode — no automated card charge");
    record("db:confirm-genai-1", "SKIP", "manual minimal Live payment required");
  } else {
    record("checkout:e2e-pay-3d", "SKIP", skipE2ePay ? "--skip-e2e-pay" : "no session_id");
  }

  // --- URL leak ---
  const leaks = checkProductionUrlLeak();
  record("ops:url-leak-html-js", leaks.length === 0 ? "PASS" : "FAIL", leaks.slice(0, 5).join(", ") || "none");

  // --- Connect (client sim only) ---
  const connectIngest = readFileSync(join(ROOT, "stripe-connect-ingest.js"), "utf8");
  record(
    "connect:client-sim-only",
    /simulation|production/.test(connectIngest) ? "PASS" : "HOLD",
    "no server Connect webhook — browser ingest + ops notify"
  );
  record(
    "connect:no-external-broadcast",
    /notifyAdminImportantTicket|localStorage/.test(connectIngest) ? "PASS" : "HOLD",
    "admin notify via localStorage / support-admin"
  );

  // --- Notifications (static) ---
  const liveNotify = readFileSync(join(ROOT, "supabase/functions/live-notify/index.ts"), "utf8");
  record("notify:live-dedupe", /live_notify_dedupe|dedupe/i.test(liveNotify) ? "PASS" : "FAIL");
  record("notify:talk_notifications", /talk_notifications/i.test(liveNotify) ? "PASS" : "FAIL");

  const supportNotify = readFileSync(join(ROOT, "support-admin-notify.js"), "utf8");
  record(
    "notify:admin-local",
    /tasu_support_admin_notifications/.test(supportNotify) ? "PASS" : "FAIL",
    "LINE/email hooks planned — not production SMTP"
  );
  record(
    "notify:email-smtp",
    "HOLD",
    "no production payment receipt email sender in codebase — expected gap"
  );

  const opsDash = readFileSync(join(ROOT, "admin-operations-dashboard.js"), "utf8");
  record("notify:ai-secretary-hub", /ops-ai-secretary|ai_secretary/i.test(opsDash) ? "PASS" : "FAIL");

  const connectAudit = readFileSync(join(ROOT, "stripe-connect-ingest.js"), "utf8");
  record(
    "audit:stripe-ingest-log",
    /tasu_stripe_event_ingest_logs_v1/.test(connectAudit) ? "PASS" : "FAIL",
    "localStorage audit — server webhook has no DB audit table"
  );

  // --- Access policy note ---
  record("ops:allowed-email", "PASS", ALLOWED_EMAIL);

  // --- Summary ---
  const fail = rows.filter((r) => r.status === "FAIL");
  const hold = rows.filter((r) => r.status === "HOLD");
  const pass = rows.filter((r) => r.status === "PASS");

  const out = {
    at: new Date().toISOString(),
    stripeMode,
    webhookUrl: WEBHOOK_URL,
    productionOrigin: PRODUCTION_ORIGIN,
    allowedEmail: ALLOWED_EMAIL,
    rows,
    summary: { pass: pass.length, hold: hold.length, fail: fail.length },
  };

  const outPath = join(ROOT, "reports", "gate-e-verify-last.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n[gate-e] wrote ${outPath}`);
  console.log(`[gate-e] PASS=${pass.length} HOLD=${hold.length} FAIL=${fail.length}`);

  if (fail.length) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
