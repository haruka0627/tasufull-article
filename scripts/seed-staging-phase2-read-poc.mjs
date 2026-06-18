#!/usr/bin/env node
/**
 * Staging に Phase 2 read PoC 用サンプル行を投入（service_role 必須）
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-staging-phase2-read-poc.mjs
 */
const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function upsert(table, row) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`${table}: ${res.status} ${text}`);
  }
}

async function main() {
  if (!url || !key) {
    fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (staging only, never commit keys)");
  }

  const now = new Date().toISOString();
  const ticketId = "poc_staging_ticket_001";

  await upsert("support_tickets", {
    id: ticketId,
    user_id: "poc_user",
    title: "Staging PoC Connect",
    body: "Stripe Connect本人確認エラー",
    category: "connect_issue",
    severity: "high",
    status: "needs_review",
    source: "staging_seed",
    created_at: now,
    updated_at: now,
  });

  await upsert("ai_ops_cases", {
    id: "poc_staging_case_001",
    support_ticket_id: ticketId,
    title: "Staging PoC 案件",
    body: "チャージバック通知",
    ops_category: "chargeback",
    ai_risk: "critical",
    status: "needs_review",
    source: "staging_seed",
    created_at: now,
    updated_at: now,
  });

  await upsert("connect_issues", {
    id: "poc_staging_connect_001",
    user_id: "poc_user",
    issue_type: "verification_failed",
    severity: "high",
    status: "open",
    detected_reason: "Staging PoC Connect issue",
    ticket_id: ticketId,
    created_at: now,
    updated_at: now,
  });

  await upsert("builder_partner_evaluations", {
    id: "poc_staging_eval_001",
    partner_id: "poc_partner",
    partner_name: "Staging工務",
    deadline_delta: -1,
    complaint_delta: 0,
    created_by: "staging_seed",
    created_at: now,
  });

  console.log(
    "PASS: seeded support_tickets, connect_issues, ai_ops_cases, builder_partner_evaluations"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
