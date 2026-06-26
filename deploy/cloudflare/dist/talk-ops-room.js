/**
 * TASFUL TALK — AI運営秘書（運営情報集約ハブ）
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const OPS_WATCH_TOOLS_HTML =
    `<details class="talk-ops-watch-tools" data-talk-ops-watch-tools>` +
    `<summary>OPS WATCH 手動実行（24h自動＋即時）</summary>` +
    `<p class="talk-ops-watch__hint">TALKを開いたときに自動実行されます。必要時のみ手動で全カテゴリまたは個別実行してください。</p>` +
    `<div class="talk-ops-watch__actions">` +
    `<button type="button" class="talk-ops-watch__btn talk-ops-watch__btn--primary" data-ops-watch-run="all">全実行</button>` +
    `<button type="button" class="talk-ops-watch__btn" data-ops-watch-run="openai">OpenAI</button>` +
    `<button type="button" class="talk-ops-watch__btn" data-ops-watch-run="stripe">Stripe</button>` +
    `<button type="button" class="talk-ops-watch__btn" data-ops-watch-run="cursor">Cursor</button>` +
    `</div>` +
    `<p class="talk-ops-watch__status" data-ops-watch-status aria-live="polite"></p>` +
    `<div class="talk-ops-watch__result" data-ops-watch-result hidden></div>` +
    `</details>`;

  const SECTION_LINKS = {
    priority: "support-trouble-center.html",
    open_inquiry: "support-trouble-center.html",
    report: "admin-ai-operations-center.html",
    anpi: "anpi-dashboard.html",
    connect: "support-trouble-center.html?filter=connect",
    builder: "builder/admin-partner-evaluations.html",
    ops_watch: "talk-home.html?tab=notify&talkAdmin=1",
  };

  function renderHubItem(item) {
    const pri =
      item.priority === "critical" ? "critical" : item.priority === "high" ? "high" : "";
    return (
      `<li class="talk-ops-hub-item${pri ? ` talk-ops-hub-item--${pri}` : ""}" data-talk-ops-hub-item>` +
      `<a class="talk-ops-hub-item__link" href="${esc(item.href)}" data-talk-ops-detail-link>` +
      `<span class="talk-ops-hub-item__title">${esc(item.title)}</span>` +
      (item.meta ? `<span class="talk-ops-hub-item__meta">${esc(item.meta)}</span>` : "") +
      `</a>` +
      `<span class="talk-ops-hub-item__action">${esc(item.linkLabel)}</span>` +
      `</li>`
    );
  }

  function isDashboardHub() {
    return document.body?.dataset?.page === "admin-operations-dashboard";
  }

  function renderWatchDashboardSection(sec) {
    const items = sec.items || [];
    const importantCount = items.filter(
      (i) => i.priority === "critical" || i.priority === "high"
    ).length;
    const normalCount = Math.max(0, items.length - importantCount);
    const preview = items.slice(0, 3);
    const rest = items.slice(3);
    const previewHtml = preview.length
      ? `<ul class="talk-ops-hub-section__list talk-ops-hub-section__list--preview">${preview.map(renderHubItem).join("")}</ul>`
      : `<p class="talk-ops-hub-empty talk-ops-hub-empty--ok">問題なし</p>`;
    const watchMoreHtml = rest.length
      ? `<ul class="talk-ops-hub-section__list talk-ops-hub-section__list--more" hidden data-ops-watch-more>` +
        `${rest.map(renderHubItem).join("")}</ul>` +
        `<button type="button" class="talk-ops-hub-section__expand" data-ops-watch-expand data-ops-watch-rest="${rest.length}">一覧を見る</button>`
      : "";
    const footer =
      `<a class="talk-ops-hub-section__more" href="#ops-ai-watch">Ops Watchパネルへ →</a>` +
      (SECTION_LINKS.ops_watch
        ? `<a class="talk-ops-hub-section__more" href="${esc(SECTION_LINKS.ops_watch)}">TALK通知で一覧へ →</a>`
        : "");
    return (
      `<section class="talk-ops-hub-section talk-ops-hub-section--watch-compact" data-talk-ops-hub-section="ops_watch">` +
      `<header class="talk-ops-hub-section__head">` +
      `<h2 class="talk-ops-hub-section__title">${esc(sec.label)}</h2>` +
      `</header>` +
      `<div class="talk-ops-watch-summary">` +
      `<div class="talk-ops-watch-summary__counts">` +
      `<span class="talk-ops-watch-summary__count talk-ops-watch-summary__count--important">重要: <strong>${esc(importantCount)}</strong> 件</span>` +
      `<span class="talk-ops-watch-summary__count talk-ops-watch-summary__count--normal">通常: <strong>${esc(normalCount)}</strong> 件</span>` +
      `</div>` +
      previewHtml +
      watchMoreHtml +
      `</div>` +
      footer +
      `</section>`
    );
  }

  function renderSection(sec) {
    const isDash = isDashboardHub();
    if (isDash && sec.id === "ops_watch") {
      return renderWatchDashboardSection(sec);
    }
    const isEmpty = !sec.items?.length;
    const isWatch = sec.id === "ops_watch";
    let items = sec.items ? [...sec.items] : [];
    let watchMoreHtml = "";

    if (isDash && isWatch && items.length > 3) {
      const rest = items.slice(3);
      items = items.slice(0, 3);
      watchMoreHtml =
        `<ul class="talk-ops-hub-section__list talk-ops-hub-section__list--more" hidden data-ops-watch-more>` +
        `${rest.map(renderHubItem).join("")}</ul>` +
        `<button type="button" class="talk-ops-hub-section__expand" data-ops-watch-expand data-ops-watch-rest="${rest.length}">一覧を見る（残り${rest.length}件）</button>`;
    }

    const list = items.length
      ? `<ul class="talk-ops-hub-section__list">${items.map(renderHubItem).join("")}</ul>${watchMoreHtml}`
      : isDash
        ? `<p class="talk-ops-hub-empty talk-ops-hub-empty--ok">問題なし</p>`
        : `<p class="talk-ops-hub-empty">該当なし — 現時点で対応候補はありません</p>`;
    const footer = SECTION_LINKS[sec.id]
      ? `<a class="talk-ops-hub-section__more" href="${esc(SECTION_LINKS[sec.id])}">一覧・詳細へ →</a>`
      : "";
    const tools = sec.id === "ops_watch" && !isDash ? OPS_WATCH_TOOLS_HTML : "";
    const compactClass = isDash && isEmpty ? " talk-ops-hub-section--empty" : "";
    return (
      `<section class="talk-ops-hub-section${compactClass}" data-talk-ops-hub-section="${esc(sec.id)}">` +
      `<header class="talk-ops-hub-section__head">` +
      `<h2 class="talk-ops-hub-section__title">${esc(sec.label)}</h2>` +
      `<span class="talk-ops-hub-section__count" data-talk-ops-hub-count>${esc(sec.count)}</span>` +
      `</header>` +
      list +
      footer +
      tools +
      `</section>`
    );
  }

  function bindHubInteractions() {
    document.querySelectorAll("[data-ops-watch-expand]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const section = btn.closest("[data-talk-ops-hub-section]");
        const more = section?.querySelector("[data-ops-watch-more]");
        if (!more) return;
        const rest = btn.getAttribute("data-ops-watch-rest") || "0";
        if (more.hidden) {
          more.hidden = false;
          btn.textContent = "閉じる";
        } else {
          more.hidden = true;
          btn.textContent = `一覧を見る（残り${rest}件）`;
        }
      });
    });
  }

  function renderMetrics(metrics) {
    if (!metrics) return "";
    const rows = [
      { label: "未対応", value: metrics.openCount ?? metrics.open },
      { label: "要確認", value: metrics.needsReviewCount ?? metrics.needsReview },
      { label: "高リスク", value: metrics.highCriticalCount ?? metrics.highRisk },
      { label: "Connect", value: metrics.connectCount ?? metrics.connect },
      { label: "通報・違反", value: metrics.violationReportCount },
      { label: "安否", value: metrics.anpiCount },
      { label: "Builder", value: metrics.builderCount },
      { label: "TALK通知", value: metrics.opsWatchCount },
    ].filter((r) => r.value != null);
    return rows
      .map(
        (r) =>
          `<span class="talk-ops-metric"><span class="talk-ops-metric__label">${esc(r.label)}</span>` +
          `<strong class="talk-ops-metric__value">${esc(r.value)}</strong></span>`
      )
      .join("");
  }

  function renderHub() {
    const Ops = window.TasuTalkOpsAssistant;
    const hubHost = document.querySelector("[data-talk-ops-hub]");
    if (!Ops || !hubHost) return;

    const hub = Ops.buildHubSections();
    hubHost.innerHTML = (hub.sections || []).map(renderSection).join("");
    bindHubInteractions();

    const summaryEl = document.querySelector("[data-talk-ops-summary]");
    if (summaryEl) summaryEl.textContent = hub.summaryText || "";

    const metricsEl = document.querySelector("[data-talk-ops-metrics]");
    if (metricsEl) metricsEl.innerHTML = renderMetrics(hub.metrics);
  }

  function showCommandResult(text) {
    const el = document.querySelector("[data-talk-ops-command-result]");
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  function init() {
    const Ops = window.TasuTalkOpsAssistant;
    if (!Ops) return;

    Ops.syncNotifications();
    renderHub();
    window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
    window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
    window.TasuAdminMorningSummary?.bindNav?.();
    window.TasuAdminMorningSummary?.render?.(
      window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() || {}
    );
    window.TasuAdminAiSecretaryPhase2?.render?.();
    window.TasuSecretaryOrchestrator?.renderPanel?.(
      window.TasuSecretaryOrchestrator?.getLastResult?.() || null
    );
    window.TasuSecretaryOrchestrator?.renderQueuePanel?.();
    window.TasuSecretaryMorningReport?.bindMorningReportButton?.();

    document.querySelector("[data-talk-ops-command-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.querySelector("[data-talk-ops-command-input]");
      const text = input && "value" in input ? String(input.value).trim() : "";
      if (!text) return;
      Ops.postUserCommand(text);
      if (input) input.value = "";
      const msgs = Ops.getRoomMessages();
      const last = msgs[msgs.length - 1];
      if (last?.opsCommandText) showCommandResult(last.opsCommandText);
      else if (last?.text) showCommandResult(last.text);
      try {
        window.dispatchEvent(new CustomEvent("tasu:admin-ops-command-result"));
      } catch {
        /* ignore */
      }
    });

    const refresh = () => {
      Ops.syncNotifications();
      renderHub();
      window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
      window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
      window.TasuAdminMorningSummary?.render?.(
        window.TasuAdminOperationsDashboard?.buildMetrics?.() ||
          window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() ||
          {}
      );
      try {
        window.dispatchEvent(new CustomEvent("tasu:talk-ops-hub-rendered"));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("tasu:talk-ops-hub-updated", refresh);
    window.addEventListener("tasu:supabase-ops-read-hydrated", refresh);
    window.addEventListener("tasu:admin-ops-dashboard-refresh", refresh);

    [
      "tasu:stripe-connect-ingested",
      "tasu:chargeback-evidence-pack-created",
      "tasu:support-tickets-updated",
      "tasu:ai-ops-cases-changed",
      "tasful-talk-notifications-changed",
      "tasu:ops-watch-daily-summary",
      "tasful-chat-threads-changed",
    ].forEach((ev) => window.addEventListener(ev, refresh));
  }

  window.TasuTalkOpsRoom = {
    renderHub,
    refresh() {
      window.TasuTalkOpsAssistant?.syncNotifications?.();
      renderHub();
      window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
      window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
      window.TasuAdminMorningSummary?.render?.(
        window.TasuAdminOperationsDashboard?.buildMetrics?.() ||
          window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() ||
          {}
      );
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
