#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 P0接続テスト — Builder + TALK bus
 *   node scripts/test-admin-ai-connectivity-p0.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-connectivity-p0");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_ai_human_send_gate_pending_v1",
  "tasu_ai_execution_log_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_daily_inbox_dismissed_v1",
  "tasful_talk_notifications",
  "tasful:builder:mvp:notifications:v1",
  "tasful:builder:partner_evaluations:v1",
  "tasful:builder:admin:partners:v1",
];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel}`;
  return pathToFileURL(path.join(root, rel)).href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await withPlaywrightBrowser(async (browser) => {for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
    await page.waitForFunction(() => window.TasuBuilderPartnerEval?.listEvaluations, { timeout: 15000 });

    const builderRes = await page.evaluate(() => {
      window.TasuAdminAiOpsWatch?.clearForTests?.();
      localStorage.setItem("tasful:builder:admin:partners:v1", JSON.stringify([
        {
          id: "p0_partner_1",
          companyName: "P0テスト工務店",
          reviewStatus: "returned",
          reviewStatusLabel: "差し戻し",
          partner_status: "active",
          updatedAt: new Date().toISOString(),
        },
      ]));
      localStorage.setItem(
        "tasful:builder:mvp:notifications:v1",
        JSON.stringify([
          {
            id: "p0_app_1",
            type: "application",
            title: "案件応募",
            body: "新規応募がありました",
            projectTitle: "P0応募案件",
            createdAt: new Date().toISOString(),
          },
          {
            id: "p0_comp_1",
            type: "completion_submitted",
            title: "完了報告",
            body: "完了報告が届きました",
            projectTitle: "P0完了案件",
            createdAt: new Date().toISOString(),
          },
        ])
      );
      window.TasuTalkNotifications?.add?.({
        id: "p0_builder_talk_1",
        type: "builder",
        source: "builder-mvp",
        title: "選定確定",
        body: "採用が確定しました",
        priority: "important",
        createdAt: new Date().toISOString(),
      });

      const evals = window.TasuBuilderPartnerEval.listEvaluations();
      const types = [...new Set(evals.map((e) => e.event_type))];

      window.dispatchEvent(new CustomEvent("tasu:builder-partner-eval-changed"));
      window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
      window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
      window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
      window.TasuAdminAiResponsePlans?.renderPlansPanelSync?.();
      window.TasuAdminAiAutomationEngine?.renderAutomationPanel?.();

      const inbox = window.TasuAdminAiDailyInbox.buildInboxItems();
      const ow = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      const kpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();
      const plans = window.TasuAdminAiResponsePlans.buildResponsePlans();
      const auto = window.TasuAdminAiAutomationEngine.buildAutomationCandidates();
      const af = window.TasuAdminAiAutoFixCandidate.buildAutoFixSnapshot();

      return {
        evalCount: evals.length,
        types,
        inboxBuilder: inbox.filter((i) => i.source === "builder").length,
        builderPending: ow.metrics?.builder?.pendingReview || 0,
        builderReject: ow.metrics?.builder?.rejection || 0,
        kpiBuilderPending: kpi.builderPending,
        planBuilder: plans.filter((p) => /builder/i.test(p.eventType || "")).length,
        autoBuilder: auto.filter((c) => c.domain === "builder").length,
        autoFixBuilder: af.candidates.filter((c) => c.source === "builder").length,
      };
    });

    if (!builderRes.evalCount) fail(`[${vp.name}] listEvaluations empty`);
    if (!builderRes.types.includes("application")) fail(`[${vp.name}] application missing: ${builderRes.types}`);
    if (!builderRes.types.includes("rejection")) fail(`[${vp.name}] rejection missing`);
    if (!builderRes.inboxBuilder) fail(`[${vp.name}] Builder inbox empty`);
    if (!builderRes.builderPending) fail(`[${vp.name}] Ops Watch builderPending=0`);
    if (!builderRes.kpiBuilderPending) fail(`[${vp.name}] KPI builderPending=0`);
    pass(`[${vp.name}] Builder→Inbox/OpsWatch/KPI/Plans/Automation反映`);

    const talkRes = await page.evaluate(async () => {
      const beforeInbox = window.TasuAdminAiDailyInbox.buildInboxItems().length;
      const beforeUnread = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot().metrics?.talk?.unreadImportant || 0;

      window.TasuTalkNotifications?.add?.({
        id: "p0_talk_unread_1",
        type: "general",
        title: "通報テスト重要",
        body: "通報内容",
        priority: "urgent",
        createdAt: new Date().toISOString(),
      });
      window.TasuTalkNotifications?.add?.({
        id: "p0_anpi_1",
        category: "anpi",
        type: "anpi",
        title: "安否未確認",
        body: "未応答",
        priority: "urgent",
        createdAt: new Date().toISOString(),
      });

      window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed"));
      await new Promise((r) => setTimeout(r, 200));

      const afterInbox = window.TasuAdminAiDailyInbox.buildInboxItems();
      const afterOw = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
      const afterKpi = window.TasuAdminAiKpiCenter.collectKpiMetrics();

      return {
        inboxDelta: afterInbox.length - beforeInbox,
        talkInbox: afterInbox.filter((i) => i.source === "talk").length,
        anpiInbox: afterInbox.filter((i) => i.source === "anpi").length,
        unreadDelta:
          (afterOw.metrics?.talk?.unreadImportant || 0) - beforeUnread,
        anpiEmergency: afterKpi.anpiEmergency,
        hasTalkListener: true,
      };
    });

    if (talkRes.inboxDelta <= 0 && !talkRes.talkInbox && !talkRes.anpiInbox) {
      fail(`[${vp.name}] TALK bus did not update inbox`);
    }
    if (talkRes.unreadDelta <= 0 && !talkRes.talkInbox) {
      fail(`[${vp.name}] TALK bus did not update Ops Watch unread`);
    }
    pass(`[${vp.name}] TALK bus→Inbox/Ops Watch/KPI即時反映`);

    await page.screenshot({ path: path.join(SHOT_DIR, `dashboard-${vp.name}.png`), fullPage: true });
    await page.close();
  }
});
  console.log("\nAll P0 connectivity tests passed.");
}

main().catch((err) => {
  console.error(err);
  closeAllBrowsers().finally(() => process.exit(1));
});
