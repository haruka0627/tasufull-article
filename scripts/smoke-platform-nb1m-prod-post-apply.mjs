#!/usr/bin/env node
/**
 * Platform NB-1M — 本番適用後 最小 Smoke
 *
 * 本番 DB migration 適用・公開切替後に人間承認のうえ実行。
 * 事前実行禁止（staging/dev 用は smoke-platform-nb1m-content-gate-browser.mjs）
 *
 *   set NB1M_PROD_SMOKE=1
 *   set SUPABASE_URL=https://<PRODUCTION_REF>.supabase.co
 *   npm run build:pages && npm run dev
 *   node scripts/smoke-platform-nb1m-prod-post-apply.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ddojquacsyqesrjhcvmn";
const OUT = join(ROOT, "reports", "platform-nb1m-prod-smoke.json");
const results = [];

function record(id, pass, actual) {
  results.push({ id, pass, actual });
  console.log(pass ? "PASS" : "FAIL", id, "—", actual);
}

function assertProdSmokeAllowed() {
  if (process.env.NB1M_PROD_SMOKE !== "1") {
    throw new Error("NB1M_PROD_SMOKE=1 required — post-apply prod smoke only");
  }
  const url = process.env.SUPABASE_URL || "";
  const ref = url.match(/https:\/\/([^.]+)/)?.[1] || "";
  if (ref === STAGING_REF) {
    throw new Error(`SUPABASE_URL is staging ${STAGING_REF} — use staging smoke instead`);
  }
  if (!ref) console.warn("[prod-smoke] SUPABASE_URL unset — browser-only checks");
}

async function gotoReady(page, path) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1000);
}

async function main() {
  assertProdSmokeAllowed();
  const base = await requireDevServer();
  mkdirSync(join(ROOT, "reports"), { recursive: true });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    // safe
    await gotoReady(page, `${base}/post.html`);
    const safe = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanListing?.({ title: "prod smoke safe", description: "通常の説明" });
      return { verdict: r?.verdict, blocked: r?.blocked === true, publish: r?.publish_status };
    });
    record("prod-safe", safe?.verdict === "allow" && !safe?.blocked, JSON.stringify(safe));

    // PayPay needs_review
    const paypay = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanListing?.({ title: "PayPay", description: "PayPayで支払い" });
      return { verdict: r?.verdict, pending: r?.publish_status === "pending_review" };
    });
    record("prod-paypay", paypay?.verdict === "needs_review" && paypay?.pending, JSON.stringify(paypay));

    // phone block
    const phone = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanListing?.({ title: "x", description: "090-1234-5678" });
      return { blocked: r?.blocked === true, verdict: r?.verdict };
    });
    record("prod-phone", phone?.blocked && phone?.verdict === "block", JSON.stringify(phone));

    // email block
    const mail = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanListing?.({ title: "x", description: "test@example.com" });
      return { blocked: r?.blocked === true, verdict: r?.verdict };
    });
    record("prod-mail", mail?.blocked && mail?.verdict === "block", JSON.stringify(mail));

    // URL block
    const urlBlock = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanListing?.({ title: "x", description: "https://evil.example.com" });
      return { blocked: r?.blocked === true, verdict: r?.verdict };
    });
    record("prod-url", urlBlock?.blocked && urlBlock?.verdict === "block", JSON.stringify(urlBlock));

    // attachment unscanned
    const attach = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanAttachments?.([{ name: "a.png", ocrText: null }]);
      return { verdict: r?.verdict, unscanned: r?.flags?.includes?.("attachment_unscanned") };
    });
    record("prod-attachment", attach?.verdict === "needs_review", JSON.stringify(attach));

    // review flagged
    const review = await page.evaluate(async () => {
      const Gate = window.TasuPlatformContentGate;
      const r = await Gate?.scanReview?.({ comment: "詐欺師 PayPay 090-1111-2222" });
      return { verdict: r?.verdict };
    });
    record("prod-review", review?.verdict === "block" || review?.verdict === "needs_review", JSON.stringify(review));

    // support block
    await gotoReady(page, `${base}/support.html`);
    const support = await page.evaluate(async () => {
      const Svc = window.TasuSupportTicketService;
      const r = await Svc?.submitInquiry?.({
        user_id: "prod_smoke",
        title: "test",
        body: "090-1234-5678",
        category: "general_auto_reply",
      });
      return { blocked: r?.ok === false || !!r?.error };
    });
    record("prod-support-block", support?.blocked, JSON.stringify(support));

    // OPS: approve + reject + Completed inbox
    await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
    const opsFlow = await page.evaluate(async () => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      const Q = window.TasuPlatformModerationQueue;
      const Bridge = window.TasuPlatformOpsInboxBridge;
      const Inbox = window.TasuAdminAiDailyInbox;
      const Url = window.TasuPlatformOpsActionUrl;

      Q?.trackLocalListing?.(
        {
          id: "prod_smoke_approve",
          user_id: "u",
          title: "prod approve",
          publish_status: "pending_review",
          moderation_status: "pending_review",
        },
        "listings"
      );
      const sigApprove = Url?.enrichSignal?.({
        event_id: "prod-smoke-approve",
        type: "listing.flagged",
        target_id: "prod_smoke_approve",
        surface: "listing",
      });
      Bridge?.pushExternalSignal?.(sigApprove);
      const approve = await Q?.applyReviewAction?.({
        id: "prod_smoke_approve",
        table: "listings",
        action: "approve",
      });
      const inboxAfterApprove =
        Inbox?.buildInboxItems?.().filter((i) => i.sourceId === "prod-smoke-approve").length ?? -1;

      Q?.trackLocalListing?.(
        {
          id: "prod_smoke_reject",
          user_id: "u",
          title: "prod reject",
          publish_status: "pending_review",
          moderation_status: "pending_review",
        },
        "listings"
      );
      const sigReject = Url?.enrichSignal?.({
        event_id: "prod-smoke-reject",
        type: "moderation.needs_review",
        target_id: "prod_smoke_reject",
        surface: "listing",
      });
      Bridge?.pushExternalSignal?.(sigReject);
      const reject = await Q?.applyReviewAction?.({
        id: "prod_smoke_reject",
        table: "listings",
        action: "reject",
      });
      const inboxAfterReject =
        Inbox?.buildInboxItems?.().filter((i) => i.sourceId === "prod-smoke-reject").length ?? -1;

      return {
        approveOk: approve?.ok,
        approveMod: approve?.patch?.moderation_status,
        inboxAfterApprove,
        rejectOk: reject?.ok,
        rejectMod: reject?.patch?.moderation_status,
        inboxAfterReject,
      };
    });
    record(
      "prod-ops-approve",
      opsFlow?.approveOk && opsFlow?.approveMod === "approved" && opsFlow?.inboxAfterApprove === 0,
      JSON.stringify(opsFlow)
    );
    record(
      "prod-ops-reject",
      opsFlow?.rejectOk && opsFlow?.rejectMod === "rejected" && opsFlow?.inboxAfterReject === 0,
      JSON.stringify(opsFlow)
    );
    record(
      "prod-ops-completed",
      opsFlow?.inboxAfterApprove === 0 && opsFlow?.inboxAfterReject === 0,
      JSON.stringify({ approve: opsFlow?.inboxAfterApprove, reject: opsFlow?.inboxAfterReject })
    );

    // contact_leak critical → ack → Completed
    const leak = await page.evaluate(async () => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      const Bridge = window.TasuPlatformOpsInboxBridge;
      const pushed = Bridge?.pushExternalSignal?.({
        event_id: "prod-smoke-leak",
        type: "contact_leak_attempt",
        severity: "critical",
        target_id: "prod-leak-1",
        surface: "listing",
      });
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.eventType === "contact_leak_attempt");
      Bridge?.completeInboxItem?.("inbox_cg_prod-smoke-leak");
      const after = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      return {
        pushed: pushed?.pushed,
        category: row?.category,
        cleared: !after.some((i) => i.eventType === "contact_leak_attempt"),
      };
    });
    record(
      "prod-contact-leak",
      leak?.pushed && leak?.category === "needs_judgment" && leak?.cleared,
      JSON.stringify(leak)
    );

    // report → inbox bridge
    const report = await page.evaluate(() => {
      window.TasuAiOpsCaseStore?.clearAllForTests?.();
      window.dispatchEvent?.(
        new CustomEvent("tasu:chat-report-submitted", {
          detail: { reason: "spam", detail: "prod smoke", roomId: "r1", reporterId: "u1" },
        })
      );
      const cases = window.TasuAiOpsCaseStore?.listCases?.() || [];
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      return { caseCount: cases.length, inInbox: items.some((i) => i.source === "ai_ops") };
    });
    record("prod-report-inbox", report?.caseCount > 0 && report?.inInbox, JSON.stringify(report));
  });

  await closeAllBrowsers();
  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
    results,
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nProd post-apply smoke: ${summary.pass} pass / ${summary.fail} fail → ${OUT}`);
  if (summary.fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
