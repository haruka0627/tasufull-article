/**
 * AI 秘書 Phase 5-B — 朝レポート（手動ボタン · cron なし）
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function buildReport() {
    const OpsEvent = global.TasuSecretaryOpsEvent;
    const Queue = global.TasuSecretaryTaskQueue;
    const Ci = global.TasuSecretaryCiIngest;

    let events = [];
    if (OpsEvent?.collectAllAsync) {
      events = await OpsEvent.collectAllAsync({ refreshCi: true });
    } else if (OpsEvent?.collectAllSync) {
      events = OpsEvent.collectAllSync();
    }

    const queue = Queue?.listTasks?.({ limit: 8 }) || [];
    const ciSummary = Ci?.summarizeCiEvents?.(events.filter((e) => e.source === "ci")) || {
      headline: "CI: —",
    };
    const eventSummary = OpsEvent?.summarize?.(events) || { total: 0, bySource: {} };

    return {
      generatedAt: new Date().toISOString(),
      events: events.slice(0, 20),
      eventSummary,
      queue,
      ciSummary,
    };
  }

  function formatReportText(report) {
    const lines = [
      `【朝レポート】${report.generatedAt}`,
      "",
      `OpsEvent: ${report.eventSummary.total} 件（高重要度 ${report.eventSummary.highSeverity || 0}）`,
      `  inbox: ${report.eventSummary.bySource?.inbox || 0} · ops_watch: ${report.eventSummary.bySource?.ops_watch || 0} · ci: ${report.eventSummary.bySource?.ci || 0}`,
      `CI: ${report.ciSummary.headline}`,
      "",
      "Queue（直近）:",
    ];
    if (!report.queue.length) {
      lines.push("  （なし）");
    } else {
      report.queue.forEach((t, i) => {
        lines.push(`  ${i + 1}. [${t.levelId}] ${t.agentId} / ${t.status} / ${t.source} — ${t.userText.slice(0, 60)}`);
      });
    }
    lines.push("", "OpsEvent（抜粋）:");
    if (!report.events.length) {
      lines.push("  （なし）");
    } else {
      report.events.slice(0, 8).forEach((e, i) => {
        lines.push(`  ${i + 1}. [${e.source}] ${e.title} (${e.severity})`);
      });
    }
    return lines.join("\n");
  }

  function renderReportOutput(report) {
    const out = document?.querySelector?.("[data-ops-secretary-morning-report-output]");
    if (!out) return;
    out.hidden = false;
    out.textContent = formatReportText(report);
  }

  async function runManualMorningReport() {
    const report = await buildReport();
    renderReportOutput(report);
    global.TasuSecretaryCommandCenterUI?.setMorningReport?.(report);
    try {
      global.dispatchEvent(new CustomEvent("tasu:secretary-morning-report-generated", { detail: report }));
    } catch {
      /* ignore */
    }
    global.TasuSecretaryOrchestrator?.renderQueuePanel?.();
    return report;
  }

  function bindMorningReportButton() {
    const btn = document?.querySelector?.("[data-ops-secretary-morning-report-btn]");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      void runManualMorningReport();
    });
  }

  function init() {
    bindMorningReportButton();
  }

  if (document?.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuSecretaryMorningReport = {
    buildReport,
    formatReportText,
    runManualMorningReport,
    bindMorningReportButton,
  };
})(typeof window !== "undefined" ? window : globalThis);
