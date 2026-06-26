/**
 * AI運営秘書 — 本日の運営サマリー（朝3分UX）
 * 既存ストア集計のみ。新機能追加なし。
 */
(function (global) {
  "use strict";

  function formatMorningYen(n) {
    const v = Math.round(Number(n) || 0);
    return `¥${v.toLocaleString("ja-JP")}`;
  }

  function buildMorningSummaryChips(metrics) {
    const ow = global.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const kpi = global.TasuAdminAiKpiCenter?.collectKpiMetrics?.();
    const hsg = global.TasuAdminAiHumanSendGate?.buildHumanSendGateSnapshot?.();
    const af = global.TasuAdminAiAutoFixCandidate?.buildAutoFixSnapshot?.();

    const owCritical = ow?.summary?.criticalCount || 0;
    const owWarning = ow?.summary?.warningCount || 0;
    const hsgPending = hsg?.summary?.pendingCount || 0;
    const hsgCritical = hsg?.summary?.criticalCount || 0;
    const afCount = af?.summary?.candidateCount || 0;
    const afCritical = af?.summary?.criticalCount || 0;

    const inquiries = kpi?.inquiries ?? metrics?.todayNew ?? 0;
    const revenue = kpi?.totalRevenue ?? kpi?.revenue ?? 0;
    const unresolved = kpi?.unresolved ?? 0;
    const emergency = kpi?.anpiEmergency ?? 0;
    const connectFail = kpi?.connectFailures ?? 0;
    const builderPending = kpi?.builderPending ?? 0;

    return [
      {
        id: "anomaly",
        label: "異常",
        value: `${owCritical + owWarning}件`,
        severity: owCritical > 0 ? "critical" : owWarning > 0 ? "warning" : "normal",
        href: "#ops-ai-watch",
      },
      {
        id: "approval",
        label: "承認待ち",
        value: `${hsgPending}件`,
        severity: hsgCritical > 0 ? "critical" : hsgPending > 0 ? "warning" : "normal",
        href: "#ops-ai-hsg",
      },
      {
        id: "inquiries",
        label: "問い合わせ",
        value: `${inquiries}件`,
        severity: "normal",
        href: "#ops-ai-kpi",
      },
      {
        id: "revenue",
        label: "売上",
        value: formatMorningYen(revenue),
        severity: "normal",
        href: "#ops-ai-kpi",
      },
      {
        id: "unresolved",
        label: "未対応",
        value: `${unresolved}件`,
        severity: unresolved > 0 ? "warning" : "normal",
        href: "#ops-ai-hub",
      },
      {
        id: "emergency",
        label: "emergency",
        value: `${emergency}件`,
        severity: emergency > 0 ? "critical" : "normal",
        href: "#ops-ai-watch",
      },
      {
        id: "connect-fail",
        label: "Connect失敗",
        value: `${connectFail}件`,
        severity: connectFail > 0 ? "warning" : "normal",
        href: "#ops-ai-watch",
      },
      {
        id: "builder-pending",
        label: "Builder承認",
        value: `${builderPending}件`,
        severity: builderPending > 0 ? "warning" : "normal",
        href: "#ops-ai-hub",
      },
      {
        id: "autofix",
        label: "改善候補",
        value: `${afCount}件`,
        severity: afCritical > 0 ? "critical" : afCount > 0 ? "warning" : "normal",
        href: "#ops-ai-autofix",
      },
    ];
  }

  function scrollToMorningTarget(targetId) {
    if (global.TasuAdminOpsDashboardNav?.scrollToSection) {
      global.TasuAdminOpsDashboardNav.scrollToSection(targetId);
      return;
    }
    const el = global.document?.getElementById(targetId);
    if (!el) return;
    let node = el.parentElement;
    while (node) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderMorningSummary(metrics) {
    const chips = buildMorningSummaryChips(metrics);
    global.document?.querySelectorAll("[data-ops-morning-summary-chips]").forEach((host) => {
      host.innerHTML = chips
        .map(
          (c) =>
            `<a href="${c.href}" class="ops-ai-morning-chip ops-ai-morning-chip--${c.severity}" role="listitem" data-ops-morning-chip="${c.id}">` +
            `<span class="ops-ai-morning-chip__label">${c.label}</span>` +
            `<span class="ops-ai-morning-chip__value">${c.value}</span>` +
            `</a>`
        )
        .join("");
    });
  }

  function bindMorningSummaryNav(options) {
    if (bindMorningSummaryNav._bound || !global.document) return;
    bindMorningSummaryNav._bound = true;
    global.document.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-ops-morning-chip]");
      if (!chip) return;
      const href = chip.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      e.preventDefault();
      const targetId = href.slice(1);
      options?.onNavigate?.(targetId, chip);
      scrollToMorningTarget(targetId);
      if (global.history?.replaceState) {
        global.history.replaceState(null, "", href);
      }
    });
  }

  global.TasuAdminMorningSummary = {
    formatMorningYen,
    buildMorningSummaryChips,
    render: renderMorningSummary,
    bindNav: bindMorningSummaryNav,
    scrollToTarget: scrollToMorningTarget,
  };
})(typeof window !== "undefined" ? window : globalThis);
