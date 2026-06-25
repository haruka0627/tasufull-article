#!/usr/bin/env node
/**
 * Platform OPS-FLOW-2 — Playwright 実画面確認
 *   npm run build:pages && npm run dev
 *   node scripts/smoke-platform-ops-flow-2-browser.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "reports", "platform-ops-flow-2-browser.json");
const results = [];

function record(id, pass, actual, notes = "") {
  results.push({ id, pass, actual, notes });
  console.log(pass ? "PASS" : "FAIL", id, "—", actual);
}

async function gotoReady(page, path) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
}

/** Content Gate: 通知 → 深いリンク → 対象表示 → Approve → Inbox 完了 */
async function runModerationFlow(page, base, cfg) {
  await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
  const setup = await page.evaluate(async (c) => {
    window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
    const Queue = window.TasuPlatformModerationQueue;
    Queue?.trackLocalListing?.(
      {
        id: c.id,
        user_id: "u_smoke",
        title: c.title,
        publish_status: "pending_review",
        moderation_status: "pending_review",
        moderation_flags: c.flags || [],
      },
      c.table
    );
    const signal = {
      id: c.eventId,
      event_id: c.eventId,
      type: c.eventType,
      severity: c.severity || "warning",
      title: c.title,
      body: c.body || "",
      surface: c.surface || c.table,
      target_id: c.id,
      target_type: c.table,
      moderation_status: "pending_review",
      flags: c.flags || [],
      at: new Date().toISOString(),
    };
    const enriched = window.TasuPlatformOpsActionUrl?.enrichSignal?.(signal) || signal;
    const pushed = window.TasuPlatformOpsInboxBridge?.pushExternalSignal?.(enriched);
    const beforeCount = window.TasuAdminOperationsDashboard?.buildMetrics?.()?.pendingReviewCount ?? 0;
    const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const row = items.find((i) => i.sourceId === c.eventId);
    return {
      pushed: pushed?.pushed,
      action_url: enriched.action_url,
      hasSeverity: String(enriched.action_url || "").includes("severity="),
      hasTargetFields: !!(enriched.target_type && enriched.target_id && enriched.severity),
      beforeCount,
      inboxCategory: row?.category,
    };
  }, cfg);

  await gotoReady(
    page,
    `${base}/admin-operations-dashboard.html?talkAdmin=1&target_type=${encodeURIComponent(cfg.table)}&target_id=${encodeURIComponent(cfg.id)}#ops-content-gate`
  );
  const review = await page.evaluate(async (c) => {
    await window.TasuPlatformOpsContentReview?.refresh?.();
    const detail = document.querySelector("[data-ops-content-review-detail]");
    const text = detail?.textContent || "";
    return {
      hasTitle: text.includes(c.title),
      hasApprove: !!detail?.querySelector("[data-ops-review-approve]"),
      hasHighlight: !!detail?.querySelector("[data-ops-review-highlight]"),
    };
  }, cfg);

  const after = await page.evaluate(async (c) => {
    const btn = document.querySelector("[data-ops-review-approve]");
    if (!btn) return { ok: false, reason: "no approve btn" };
    btn.click();
    await new Promise((r) => setTimeout(r, 500));
    const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const cg = items.filter((i) => i.source === "content_gate" && i.sourceId === c.eventId);
    const afterCount = window.TasuAdminOperationsDashboard?.buildMetrics?.()?.pendingReviewCount ?? 0;
    const q = window.TasuPlatformModerationQueue?.readLocalQueue?.() || [];
    const row = q.find((x) => x.id === c.id);
    return {
      ok: true,
      inboxRemaining: cg.length,
      afterCount,
      mod: row?.moderation_status,
      pub: row?.publish_status,
    };
  }, cfg);

  const pass =
    setup.pushed &&
    setup.hasTargetFields &&
    review.hasTitle &&
    review.hasApprove &&
    after.ok &&
    after.inboxRemaining === 0 &&
    (after.mod === "approved" || after.pub === "public") &&
    after.afterCount < setup.beforeCount;

  record(
    cfg.testId,
    pass,
    JSON.stringify({ setup, review, after }),
    cfg.eventType
  );
}

async function main() {
  const base = await requireDevServer();
  mkdirSync(join(ROOT, "reports"), { recursive: true });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    await runModerationFlow(page, base, {
      testId: "flow-post-needs-review",
      eventId: "smoke-needs-review-1",
      eventType: "moderation.needs_review",
      id: "local_smoke_post_1",
      table: "listings",
      title: "スモーク投稿 pending",
      body: "PayPay 要確認",
      flags: ["paypay"],
    });

    await runModerationFlow(page, base, {
      testId: "flow-listing-flagged",
      eventId: "smoke-listing-flagged-1",
      eventType: "listing.flagged",
      id: "local_smoke_listing_1",
      table: "listings",
      title: "スモーク listing flagged",
      flags: ["paypay"],
    });

    await runModerationFlow(page, base, {
      testId: "flow-review-flagged",
      eventId: "smoke-review-flagged-1",
      eventType: "review.flagged",
      id: "local_smoke_review_1",
      table: "listings",
      title: "スモーク review flagged",
      surface: "review",
      flags: ["review_abuse"],
    });

    await runModerationFlow(page, base, {
      testId: "flow-shop-flagged",
      eventId: "smoke-shop-flagged-1",
      eventType: "shop.flagged",
      id: "local_smoke_shop_1",
      table: "shop_local",
      title: "スモーク shop flagged",
      surface: "shop",
    });

    await runModerationFlow(page, base, {
      testId: "flow-attachment-unscanned",
      eventId: "smoke-attach-1",
      eventType: "attachment.unscanned",
      id: "local_smoke_attach_1",
      table: "listings",
      title: "スモーク attachment unscanned",
      surface: "listing_attachment",
      flags: ["attachment_unscanned"],
    });

    await runModerationFlow(page, base, {
      testId: "flow-attachment-flagged",
      eventId: "smoke-attach-flagged-1",
      eventType: "attachment.flagged",
      id: "local_smoke_attach_flag_1",
      table: "listings",
      title: "スモーク attachment flagged",
      flags: ["attachment_scanned"],
    });

    // contact_leak → critical → 確認済み → Completed
    await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
    const critical = await page.evaluate(() => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      const signal = {
        id: "smoke-leak-1",
        event_id: "smoke-leak-1",
        type: "contact_leak_attempt",
        severity: "critical",
        title: "連絡先流出",
        body: "phone",
        target_id: "blocked-1",
        surface: "listing",
        flags: ["phone"],
        at: new Date().toISOString(),
      };
      const enriched = window.TasuPlatformOpsActionUrl?.enrichSignal?.(signal);
      const r = window.TasuPlatformOpsInboxBridge?.pushExternalSignal?.(enriched);
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.eventType === "contact_leak_attempt");
      return {
        pushed: r?.pushed,
        category: row?.category,
        url: row?.targetUrl,
        hasSeverity: String(enriched?.action_url || "").includes("severity=critical"),
        modeCritical: String(enriched?.action_url || "").includes("mode=critical"),
      };
    });
    record(
      "flow-contact-leak-inbox",
      critical.pushed && critical.category === "needs_judgment" && critical.hasSeverity,
      JSON.stringify(critical)
    );

    await gotoReady(
      page,
      `${base}/admin-operations-dashboard.html?talkAdmin=1&target_type=listings&target_id=blocked-1&mode=critical&event_type=contact_leak_attempt&event_id=smoke-leak-1#ops-content-gate`
    );
    const leakDone = await page.evaluate(async () => {
      await window.TasuPlatformOpsContentReview?.refresh?.();
      const ack = document.querySelector("[data-ops-review-ack]");
      if (!ack) return { ok: false, reason: "no ack" };
      ack.click();
      await new Promise((r) => setTimeout(r, 400));
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.filter((i) => i.eventType === "contact_leak_attempt");
      return { ok: true, inboxRemaining: row.length, hasHighlight: !!document.querySelector("[data-ops-review-highlight]") };
    });
    record("flow-contact-leak-complete", leakDone.ok && leakDone.inboxRemaining === 0, JSON.stringify(leakDone));

    // Support: 通知 → ticket 表示 → 返信 → Completed
    await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
    const supportSetup = await page.evaluate(() => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      const Store = window.TasuSupportTicketStore;
      const ticket = Store?.saveTicket?.({
        id: "smoke_support_ticket_1",
        user_id: "u_smoke",
        title: "スモーク Support 問い合わせ",
        body: "テスト問い合わせ本文",
        status: "open",
        severity: "medium",
        category: "general_auto_reply",
        source: "smoke",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.id === "inbox_support_smoke_support_ticket_1");
      return { ticketId: ticket?.id, inInbox: !!row, targetUrl: row?.targetUrl };
    });
    record(
      "flow-support-inbox",
      supportSetup.inInbox && String(supportSetup.targetUrl || "").includes("smoke_support_ticket_1"),
      JSON.stringify(supportSetup)
    );

    await gotoReady(page, `${base}/support-trouble-center.html?ticket=smoke_support_ticket_1`);
    const supportView = await page.evaluate(() => {
      const detail = document.querySelector("[data-support-ticket-detail]");
      const text = detail?.textContent || "";
      const selected = document.querySelector(".support-trouble-ticket-row.is-selected");
      return {
        hasBody: text.includes("テスト問い合わせ本文"),
        hasSelected: !!selected,
        hasActions: !!document.querySelector('[data-support-action="send_reply"]'),
      };
    });
    record("flow-support-target-display", supportView.hasBody && supportView.hasSelected, JSON.stringify(supportView));

    const supportDone = await page.evaluate(() => {
      window.TasuSupportTicketService?.applyAdminAction?.("smoke_support_ticket_1", "send_reply", "smoke reply");
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.id === "inbox_support_smoke_support_ticket_1");
      return { inboxRemaining: row ? 1 : 0, cleared: !row };
    });
    record("flow-support-reply-complete", supportDone.cleared, JSON.stringify(supportDone));

    // Report: submitReport bridge → AI-ops inbox → resolved → Completed
    await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
    const reportSetup = await page.evaluate(() => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      window.TasuAiOpsCaseStore?.clearAllForTests?.();
      window.dispatchEvent?.(
        new CustomEvent("tasu:chat-report-submitted", {
          detail: {
            reason: "迷惑行為",
            detail: "スモーク通報",
            roomId: "room_smoke",
            messageId: "msg_smoke",
            reporterId: "u_reporter",
          },
        })
      );
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      const cases = window.TasuAiOpsCaseStore?.listCases?.() || [];
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.source === "ai_ops" && i.eventType === "report");
      return { caseId: cases[0]?.id, inInbox: !!row, targetUrl: row?.targetUrl };
    });
    record(
      "flow-report-inbox",
      reportSetup.inInbox && !!reportSetup.caseId,
      JSON.stringify(reportSetup)
    );

    await gotoReady(page, `${base}/support-trouble-center.html?filter=report`);
    const reportFilter = await page.evaluate(() => ({
      activeFilter: document.querySelector('[data-support-filter="report"]')?.classList.contains("is-active"),
    }));
    record("flow-report-filter", reportFilter.activeFilter, JSON.stringify(reportFilter));

    const reportDone = await page.evaluate((caseId) => {
      window.TasuAiOpsCaseStore?.applyAdminAction?.(caseId, "resolved", "smoke resolved");
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.source === "ai_ops" && i.sourceId === caseId);
      return { cleared: !row };
    }, reportSetup.caseId);
    record("flow-report-complete", reportDone.cleared, JSON.stringify(reportDone));

    // auto_cleared → auto_done Inbox
    await gotoReady(page, `${base}/admin-operations-dashboard.html?talkAdmin=1`);
    const autoCleared = await page.evaluate(() => {
      window.TasuPlatformOpsInboxBridge?.clearCompletedForTests?.();
      const signal = {
        id: "smoke-auto-1",
        event_id: "smoke-auto-1",
        type: "moderation.auto_cleared",
        severity: "info",
        title: "自動クリア",
        target_id: "local_auto_1",
        surface: "listing",
        at: new Date().toISOString(),
      };
      const enriched = window.TasuPlatformOpsActionUrl?.enrichSignal?.(signal);
      const r = window.TasuPlatformOpsInboxBridge?.pushExternalSignal?.(enriched);
      const items = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
      const row = items.find((i) => i.eventType === "moderation.auto_cleared");
      return { pushed: r?.pushed, category: row?.category, severity: enriched?.severity };
    });
    record(
      "flow-auto-cleared-inbox",
      autoCleared.pushed && autoCleared.category === "auto_done",
      JSON.stringify(autoCleared)
    );
  });

  await closeAllBrowsers();
  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
    results,
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nDone: ${summary.pass} pass / ${summary.fail} fail → ${OUT}`);
  if (summary.fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
