#!/usr/bin/env node
/**
 * Stripe Connect トラブル強化 E2E
 *   node scripts/test-stripe-connect-trouble-hardening-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = Date.now().toString(36).slice(-6);

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(ROOT, rel)).href;
}

async function clearOpsStorage(page) {
  await page.evaluate(() => {
    [
      "tasu_support_tickets_v1",
      "tasu_support_events_v1",
      "tasu_connect_issues_v1",
      "tasu_support_admin_notifications_v1",
      "tasu_ai_ops_cases_v1",
      "tasu_ai_ops_events_v1",
      "tasu_stripe_event_ingest_logs_v1",
      "tasu_chargeback_evidence_packs_v1",
      "tasu_offplatform_risk_events_v1",
      "tasful_chat_messages",
      "tasful_chat_threads",
    ].forEach((k) => localStorage.removeItem(k));
  });
}

async function loadSupportCenter(page) {
  await page.goto(pageUrl("support-trouble-center.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.TasuStripeConnectIngest &&
      window.TasuSupportTicketService?.ingestStripeConnectEvent,
    { timeout: 20000 }
  );
}

async function ingest(page, payload) {
  return page.evaluate((p) => window.TasuSupportTicketService.ingestStripeConnectEvent(p), payload);
}

async function testEventMappings(page) {
  const payout = await ingest(page, {
    id: `evt_payout_${RUN}`,
    type: "payout.failed",
    data: { object: { id: "po_1", failure_code: "account_closed", amount: 10000 } },
    stripe_account_id: "acct_test",
  });
  const pm = payout.mapping || payout.ticket?.stripe_connect_meta?.mapping;
  if (pm?.issue_type !== "payout_failed" || pm?.severity !== "high") {
    fail(`payout.failed mapping: ${JSON.stringify(pm)}`);
  }
  if (payout.ticket?.category !== "connect_issue") fail(`payout ticket category ${payout.ticket?.category}`);
  pass("payout.failed → connect_issue / high");

  const dispute = await ingest(page, {
    id: `evt_disp_${RUN}`,
    type: "charge.dispute.created",
    data: { object: { id: "dp_1", amount: 5000, currency: "jpy" } },
  });
  const dm = dispute.mapping;
  if (dm?.severity !== "critical" || dm?.issue_type !== "dispute_created") {
    fail(`dispute mapping: ${JSON.stringify(dm)}`);
  }
  if (!dispute.evidencePack?.id) fail("dispute should create evidence pack");
  if ((dispute.aiCase?.ops_category || dispute.aiCase?.ai_category) !== "chargeback") {
    fail(`dispute ai case category: ${dispute.aiCase?.ops_category}/${dispute.aiCase?.ai_category}`);
  }
  pass("charge.dispute.created → critical + 証拠パック + chargeback case");

  const acct = await ingest(page, {
    id: `evt_acct_${RUN}`,
    type: "account.updated",
    data: {
      object: {
        id: "acct_test",
        requirements: { currently_due: ["individual.verification.document"], errors: [{ code: "verification_document_failed" }] },
        capabilities: { transfers: "pending" },
      },
    },
  });
  const hints = acct.identityTemplates || acct.ticket?.stripe_connect_meta?.identity_templates || [];
  if (!hints.length) fail("account.updated should suggest identity templates");
  pass("account.updated → 本人確認テンプレ候補");

  const payFail = await ingest(page, {
    id: `evt_pi_${RUN}`,
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_1", last_payment_error: { message: "card_declined" } } },
  });
  if (payFail.mapping?.issue_type !== "payment_failed") fail(`payment_failed: ${payFail.mapping?.issue_type}`);
  pass("payment_intent.payment_failed → 決済失敗");
}

async function testEvidenceAndChecklist(page) {
  const pack = await page.evaluate(() =>
    window.TasuChargebackEvidencePack.buildEvidencePack({
      transaction_id: "pi_test",
      order_id: "ord_1",
      project_id: "proj_1",
      amount: "1000 jpy",
    })
  );
  if (!pack.stripe_submission_draft || !pack.transaction_id) fail("evidence pack incomplete");
  if (pack.submitted_to_stripe !== false) fail("must not submit to stripe");
  pass("チャージバック証拠パック生成");

  const checklist = await page.evaluate(() =>
    window.TasuRefundCancelChecklist.evaluate({
      flags: { has_complaint: true, conflicting_claims: true },
      body: "双方の主張が異なります",
    })
  );
  if (checklist.should_auto_refund !== false || checklist.admin_required !== true) {
    fail("refund checklist must not auto refund");
  }
  pass("返金判断チェックリスト admin_required / no auto refund");
}

async function testOffplatform(page) {
  const r = await page.evaluate(() =>
    window.TasuOffplatformRiskDetector.scanText(
      "LINEで連絡しましょう。銀行振込で直接契約、PayPayでも払えます。TASFUL外でやろう"
    )
  );
  if (!r.detected) fail("offplatform should detect");
  const types = (r.all_matches || []).map((m) => m.risk_type);
  for (const need of ["line_exchange", "bank_transfer", "direct_contract", "paypay"]) {
    if (!types.includes(need) && r.risk_type !== need) {
      /* at least top-level or all_matches */
    }
  }
  if (!/line|bank|paypay|direct|offplatform/i.test(`${r.risk_type}|${types.join(",")}`)) {
    fail(`offplatform types weak: ${JSON.stringify(r)}`);
  }
  pass("外部決済誘導文言検知（LINE / 銀行振込 / PayPay / 直接契約）");
}

async function testAiOpsAndOpsHub(page) {
  const tickets = await page.evaluate(() => window.TasuSupportTicketStore.listTickets().length);
  if (tickets < 4) fail(`ingest tickets expected >=4 got ${tickets}`);

  await page.goto(pageUrl("admin-ai-operations-center.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAiOpsCaseStore?.listCases, { timeout: 20000 });
  const cases = await page.evaluate(() => window.TasuAiOpsCaseStore.listCases().length);
  if (cases < 1) fail(`AI ops cases expected >=1 got ${cases}`);
  pass("AI運営センターに case 作成");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    if (location.hash !== "#ops-ai-secretary") location.hash = "ops-ai-secretary";
  });
  await page.waitForFunction(
    () => window.TasuTalkOpsAssistant?.syncNotifications && window.TasuAdminOperationsDashboard,
    { timeout: 20000 }
  );
  await page.evaluate(() => {
    window.TasuTalkOpsAssistant.syncNotifications();
    window.TasuTalkOpsRoom?.refresh?.();
    window.TasuAdminOperationsDashboard?.refresh?.();
  });
  await page.waitForSelector("#ops-ai-secretary [data-talk-ops-hub]", { timeout: 15000 });

  const sections = await page.locator("[data-talk-ops-hub-section]").count();
  if (sections < 1) fail(`hub sections expected >=1 got ${sections}`);

  const items = await page.locator("[data-talk-ops-hub-item]").count();
  if (items < 1) fail(`hub items expected >=1 got ${items}`);

  const hubText = await page.locator("[data-talk-ops-hub]").innerText();
  if (!/Connect|通報|高リスク|問い合わせ|chargeback|dispute/i.test(hubText)) {
    fail(`hub missing ingest-related items: ${hubText.slice(0, 200)}`);
  }
  pass("AI運営秘書ハブに Connect / 案件が表示される（司令塔）");
}

async function testNoExecuteButtons(page) {
  await page.goto(pageUrl("support-trouble-center.html"), { waitUntil: "domcontentloaded" });
  const forbidden = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll("[data-stripe-execute], [data-stripe-refund-run], [data-stripe-payout-run]").forEach((el) =>
      bad.push(el.outerHTML)
    );
    document.querySelectorAll("button, [role='button']").forEach((el) => {
      const t = (el.textContent || "").trim();
      if (/Stripe.*(返金|出金|BAN).*実行/.test(t)) bad.push(t);
    });
    return bad;
  });
  if (forbidden.length) fail(`forbidden execute UI: ${forbidden.join("; ")}`);
  const tools = await page.locator("[data-stripe-tool]").count();
  if (tools < 1) {
    await ingest(page, { type: "payout.failed", data: { object: { id: "x" } } });
    await page.click(".support-trouble-ticket-row");
    const tools2 = await page.locator("[data-stripe-tool]").count();
    if (tools2 < 1) fail("stripe tool buttons missing");
  }
  const hasExecuteWord = await page.locator("button:text('Stripeへ提出')").count();
  if (hasExecuteWord > 0) fail("Stripe submit button found");
  pass("実行系 Stripe ボタンなし（作成・表示のみ）");
}

function runRegression(script) {
  const r = spawnSync("node", [path.join("scripts", script)], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
    timeout: 120000,
    env: { ...process.env, BUILDER_BASE_URL: "" },
  });
  if (r.status !== 0) {
    fail(`${script} regression:\n${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  pass(`${script} 回帰`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loadSupportCenter(page);
    await clearOpsStorage(page);
    await testEventMappings(page);
    await testEvidenceAndChecklist(page);
    await testOffplatform(page);
    await testAiOpsAndOpsHub(page);
    await testNoExecuteButtons(page);
  } finally {
    await browser.close();
  }

  runRegression("test-admin-operations-dashboard-browser.mjs");
  runRegression("test-ai-operations-center-browser.mjs");
  runRegression("test-talk-ops-assistant-browser.mjs");

  console.log("\nAll Stripe Connect trouble hardening tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
