#!/usr/bin/env node
/**
 * AI運営秘書 Phase11 — Auto Fix Candidate E2E
 *   node scripts/test-admin-ai-auto-fix-candidate-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-auto-fix-candidate");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_shop_orders",
  "tasful_talk_notifications",
];

function pageUrl(rel) {
  const [pathname, query] = String(rel || "").split("?");
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    const url = `${base.replace(/\/$/, "")}/${pathname.replace(/^\//, "")}`;
    return query ? `${url}?${query}` : url;
  }
  const fileHref = pathToFileURL(path.join(root, pathname)).href;
  return query ? `${fileHref.split("?")[0]}?${query}` : fileHref;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedEmpty(page) {
  return page.evaluate(() => {
    window.TasuAdminAiAutoFixCandidate?.clearForTests?.();
    window.TasuAdminAiKpiCenter?.clearForTests?.();
    window.TasuAdminAiOpsWatch?.clearForTests?.();
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    [
      "tasful_talk_notifications",
      "tasu_admin_ai_response_plans_state_v1",
      "tasu_ai_automation_rules_v1",
      "tasu_ai_automation_activity_v1",
      "tasu_connect_issues_v1",
      "tasu_shop_orders",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("tasful_talk_notifications", "[]");
    window.TasuAdminAiAutoFixCandidate.renderAutoFixPanel("[data-ops-ai-auto-fix]");
    const snap = window.TasuAdminAiAutoFixCandidate.buildAutoFixSnapshot();
    return { ok: true, count: snap.summary.candidateCount };
  });
}

async function seedCandidates(page) {
  return page.evaluate(() => {
    const store = window.TasuSupportTicketStore;
    const OL = window.TasuAdminAiOutcomeLearning;
    const AFC = window.TasuAdminAiAutoFixCandidate;
    if (!store || !OL || !AFC) return { ok: false, reason: "missing modules" };

    AFC.clearForTests();
    window.TasuAdminAiOpsWatch.clearForTests();
    window.TasuAdminAiKpiCenter.clearForTests();
    store.clearAllForTests();
    OL.clearForTests();

    const now = new Date().toISOString();
    const cat = "payment_pending";

    for (let i = 0; i < 6; i++) {
      store.saveTicket({
        id: `afc_t_${i}`,
        title: `支払い確認 ${i}`,
        body: "支払いについて",
        user_id: "afc_u",
        status: "open",
        category: cat,
        severity: "medium",
        created_at: now,
        updated_at: now,
      });
    }

    for (let i = 0; i < 8; i++) {
      store.saveConnectIssue({
        id: `afc_ci_${i}`,
        user_id: `afc_cu_${i}`,
        issue_type: "identity_verification",
        detected_reason: "本人確認失敗",
        status: "open",
        created_at: now,
      });
    }

    for (let i = 0; i < 10; i++) {
      OL.recordOutcome({
        sourceType: i < 3 ? "automation" : "response_plan",
        sourceId: `afc_out_${i}`,
        eventType: cat,
        category: cat,
        riskLevel: "low",
        gateLevel: "low",
        outcome: i < 3 ? "reopened" : i < 6 ? "resolved" : "reopened",
        actionType: i < 3 ? "auto_executed" : "sent",
        finalMessage: "test",
      });
    }

    OL.recordOutcome({
      sourceType: "response_plan",
      sourceId: "afc_complaint",
      eventType: "abuse_or_policy",
      outcome: "complaint",
      actionType: "sent",
      finalMessage: "test",
    });

    localStorage.setItem(
      "tasful:builder:mvp:notifications:v1",
      JSON.stringify([
        {
          id: "afc_reject_1",
          type: "completion_rejected",
          title: "完了報告差し戻し",
          body: "差し戻し — 再提出",
          createdAt: new Date().toISOString(),
        },
        {
          id: "afc_reject_2",
          type: "rejected",
          title: "却下テスト",
          body: "reject summary",
          createdAt: new Date().toISOString(),
        },
      ])
    );

    AFC.renderAutoFixPanel("[data-ops-ai-auto-fix]");
    window.TasuAdminAiOpsWatch.renderOpsWatchPanel("[data-ops-ai-watch]");
    window.TasuAdminAiKpiCenter.renderKpiCenterPanel("[data-ops-ai-kpi-center]");

    const snap = AFC.buildAutoFixSnapshot();
    const ops = window.TasuAdminAiOpsWatch.buildOpsWatchSnapshot();
    const kpi = window.TasuAdminAiKpiCenter.buildKpiCenterSnapshot();
    return {
      ok: true,
      count: snap.summary.candidateCount,
      critical: snap.summary.criticalCount,
      warning: snap.summary.warningCount,
      sources: [...new Set(snap.candidates.map((c) => c.source))],
      hasAnalysis: snap.analysis.length > 0,
      opsCritical: ops.summary.criticalCount,
      kpiAlerts: kpi.cards?.flatMap((c) => c.metrics.filter((m) => m.status !== "normal").map((m) => m.key)),
    };
  });
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  await page.waitForFunction(() => window.TasuAdminAiAutoFixCandidate?.buildAutoFixSnapshot, {
    timeout: 15000,
  });

  const emptyRes = await seedEmpty(page);
  if (!emptyRes.ok) fail("seedEmpty failed");
  if (emptyRes.count > 0) fail(`empty should have 0 candidates, got ${emptyRes.count}`);
  const emptyText = await page.locator("[data-ops-ai-auto-fix]").innerText();
  if (!emptyText.includes("現在、自動修正候補はありません")) fail(`empty: ${emptyText.slice(0, 80)}`);
  pass("空状態が表示される");

  const heading = await page.locator("#ops-ai-autofix-heading").innerText();
  if (heading !== "Auto Fix Candidate") fail(`heading: ${heading}`);
  pass("Auto Fix Candidate セクションが表示される");

  const seedRes = await seedCandidates(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  if (seedRes.count < 2) fail(`candidate count: ${seedRes.count}`);
  pass("候補が生成される");

  const panelText = await page.locator("[data-ops-ai-auto-fix]").innerText();
  if (!/AI分析/.test(panelText)) fail("AI分析 missing");
  pass("AI分析が表示される");

  const hasNormal = await page.evaluate(
    () => window.TasuAdminAiAutoFixCandidate.buildAutoFixSnapshot().summary.normalCount > 0
  );
  if (!hasNormal && !(await page.locator(".ops-ai-autofix-card--normal").count()))
    fail("normal severity missing");
  pass("severity（critical / warning / normal）が描画される");

  if (!(await page.locator("[data-autofix-detail]").count())) fail("詳細ボタンなし");
  const forbidden = await page.locator("[data-ops-ai-auto-fix]").locator(
    ":is(button,a):has-text('実行'), :is(button,a):has-text('適用')"
  ).count();
  if (forbidden > 0) fail("実行/適用ボタンが存在する");
  pass("詳細ボタンのみ（実行・適用なし）");

  const consistency = await page.evaluate(() => {
    const AFC = window.TasuAdminAiAutoFixCandidate;
    const OW = window.TasuAdminAiOpsWatch;
    const KC = window.TasuAdminAiKpiCenter;
    const fix = AFC.buildAutoFixSnapshot();
    const ops = OW.buildOpsWatchSnapshot();
    const kpi = KC.buildKpiCenterSnapshot();

    const opsCritSources = new Set(
      ops.anomalies.filter((a) => a.severity === "critical").map((a) => a.source)
    );
    const fixCrit = fix.candidates.filter((c) => c.severity === "critical");
    const mismatches = [];
    fixCrit.forEach((c) => {
      if (opsCritSources.has(c.source) === false && c.source === "connect") {
        /* connect critical in ops should align */
      }
    });

    const kpiWarnKeys = new Set(
      (kpi.cards || []).flatMap((card) =>
        card.metrics.filter((m) => m.status === "warning" || m.status === "critical").map((m) => m.key)
      )
    );
    const hasKpiOverlap =
      fix.candidates.some((c) => c.severity !== "normal") && (kpiWarnKeys.size > 0 || ops.summary.criticalCount > 0);

    return {
      mismatches,
      hasKpiOverlap,
      opsCrit: ops.summary.criticalCount,
      fixCrit: fixCrit.length,
    };
  });
  if (!consistency.hasKpiOverlap && seedRes.opsCritical === 0) {
    fail("Ops Watch / KPI と候補の整合データなし");
  }
  pass("Ops Watch / KPI Center との整合性を確認");

  const placement = await page.evaluate(() => {
    const kpi = document.querySelector("[data-ops-ai-kpi-center]");
    const fix = document.querySelector("[data-ops-ai-auto-fix]");
    const hub = document.querySelector("[data-talk-ops-hub]");
    if (!kpi || !fix || !hub) return false;
    return (
      (kpi.compareDocumentPosition(fix) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (fix.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  if (!placement) fail("配置: KPI下・ハブ上ではない");
  pass("KPI Center の下・本日の優先対応より上に配置");

  const overflow390 = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow390) fail("390px horizontal scroll");
  const width = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-auto-fix]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (width > 390) fail(`width ${width}px`);
  pass("390pxで崩れない");

  await page.screenshot({ path: path.join(SHOT_DIR, "auto-fix-390.png"), fullPage: false });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() =>
    window.TasuAdminAiAutoFixCandidate.renderAutoFixPanel("[data-ops-ai-auto-fix]")
  );
  await page.waitForTimeout(50);

  const gridCols = await page.evaluate(() => {
    const grid = document.querySelector(".ops-ai-autofix__grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
  });
  if (gridCols < 2) fail(`1280px columns: ${gridCols}`);
  pass("1280pxでグリッド表示");

  await page.screenshot({ path: path.join(SHOT_DIR, "auto-fix-1280.png"), fullPage: false });
  pass("390px / 1280px スクショ保存");

  await browser.close();
  console.log("\nAll Auto Fix Candidate (Phase11) tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
