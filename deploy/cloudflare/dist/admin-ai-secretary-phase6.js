/**
 * AI 秘書 Phase 6 — Intelligence パネル（Operations Engine 連携）
 * 要約 · 優先順位 · 提案 · Action 候補表示のみ（自動実行なし）
 */
(function (global) {
  "use strict";

  let bound = false;
  let selectedSuggestionId = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getEngine() {
    return global.TasuSecretaryOperationsEngine;
  }

  function getPriority() {
    return global.TasuSecretaryPriorityEngine;
  }

  function query(sel) {
    return typeof document !== "undefined" ? document.querySelector(sel) : null;
  }

  function renderActionButtons(suggestion) {
    const actions = suggestion?.actionCandidates || [];
    if (!actions.length) return "";
    return (
      `<div class="ops-p6-intel-card__actions">` +
      actions
        .map(
          (a) =>
            `<button type="button" class="ops-p3-action ops-p6-action-candidate" ` +
            `data-ops-p6-action-id="${esc(a.id)}" data-ops-p6-suggestion-id="${esc(suggestion.id)}" ` +
            `data-ops-p6-action-href="${esc(a.href || "")}" disabled ` +
            `title="Phase 6: 候補のみ（未実行）">${esc(a.label)}</button>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderSuggestionCard(suggestion) {
    const Priority = getPriority();
    const impact = Priority?.priorityImpactClass?.(suggestion.priority) || "low";
    const label = Priority?.priorityLabel?.(suggestion.priority) || "Info";
    const typeLabel =
      suggestion.type === "question" ? "質問" : suggestion.type === "improvement" ? "改善案" : "提案";

    return (
      `<article class="ops-p6-intel-card" data-ops-p6-suggestion-id="${esc(suggestion.id)}">` +
      `<div class="ops-p6-intel-card__head">` +
      `<span class="ops-p6-intel-card__cat">${esc(suggestion.domainLabel)} · ${esc(typeLabel)}</span>` +
      `<span class="ops-p6-safety ops-p6-safety--l2">${esc(label)}</span>` +
      `</div>` +
      `<h4 class="ops-p6-intel-card__title">${esc(suggestion.headline)}</h4>` +
      `<p class="ops-p6-intel-card__summary">${esc(suggestion.body)}</p>` +
      `<div class="ops-p6-intel-card__impact">` +
      `<span class="ops-p6-impact-level ops-p6-impact--${impact}">${esc(label)}</span>` +
      `<span class="ops-p6-impact-service">${esc(suggestion.domain)}</span>` +
      `</div>` +
      renderActionButtons(suggestion) +
      `<button type="button" class="ops-p3-action ops-p6-detail-open" data-ops-p6-detail="${esc(suggestion.id)}">詳細</button>` +
      `</article>`
    );
  }

  function renderSections(result) {
    const root = query("[data-ops-phase6-intelligence-root]");
    if (!root) return;

    const suggestions = result?.suggestions || [];
    const Priority = getPriority();
    const groups = Priority?.groupByPriority?.(suggestions) || {
      critical: suggestions,
      warning: [],
      info: [],
    };

    const sections = [
      { key: "critical", title: "Critical" },
      { key: "warning", title: "Warning" },
      { key: "info", title: "Info" },
    ];

    const html = sections
      .map((sec) => {
        const items = groups[sec.key] || [];
        if (!items.length) return "";
        return (
          `<section class="ops-p6-intel-section" data-ops-p6-priority="${sec.key}">` +
          `<h4 class="ops-p6-intel-section__title">${esc(sec.title)} (${items.length})</h4>` +
          `<div class="ops-p6-intel-section__grid">` +
          items.map((s) => renderSuggestionCard(s)).join("") +
          `</div></section>`
        );
      })
      .join("");

    root.innerHTML =
      html ||
      `<div class="ops-cc-empty" role="status"><p class="ops-cc-empty__title">インサイトなし</p>` +
      `<p class="ops-cc-empty__detail">現在のしきい値では異常は検出されていません。</p></div>`;
  }

  function renderDetail(result, suggestionId) {
    const panel = query("[data-ops-phase6-intelligence-detail]");
    if (!panel) return;

    const suggestion = (result?.suggestions || []).find((s) => s.id === suggestionId);
    if (!suggestion) {
      panel.hidden = true;
      return;
    }

    const insight = (result?.insights || []).find((i) => i.id === suggestion.insightId);
    panel.hidden = false;
    panel.innerHTML =
      `<div class="ops-p6-intel-detail__head">` +
      `<h4>${esc(suggestion.headline)}</h4>` +
      `<button type="button" class="ops-p6-intel-detail__close" data-ops-p6-detail-close aria-label="閉じる">×</button>` +
      `</div>` +
      `<dl class="ops-p6-intel-detail__dl">` +
      `<dt>優先度</dt><dd>${esc(suggestion.priority)}</dd>` +
      `<dt>種別</dt><dd>${esc(suggestion.type)}</dd>` +
      `<dt>ドメイン</dt><dd>${esc(suggestion.domainLabel)}</dd>` +
      `<dt>変化</dt><dd>${esc(String(suggestion.deltaPct ?? "—"))}%</dd>` +
      `<dt>インサイト</dt><dd>${esc(insight?.summary || "—")}</dd>` +
      `<dt>Provider</dt><dd>${esc(result?.providerId || "—")}</dd>` +
      `</dl>` +
      renderActionButtons(suggestion);
  }

  function updateBadge(result) {
    const badge = query("[data-ops-phase6-intelligence-count]");
    if (badge) badge.textContent = String(result?.suggestions?.length || 0);
  }

  async function refreshIntelligence(options) {
    const Engine = getEngine();
    if (!Engine?.refresh) return null;
    const result = await Engine.refresh(options);
    renderSections(result);
    updateBadge(result);
    if (selectedSuggestionId) renderDetail(result, selectedSuggestionId);
    return result;
  }

  function bindUiOnce() {
    if (bound || typeof document === "undefined") return;
    bound = true;

    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;

      if (t.matches("[data-ops-phase6-intelligence-refresh]")) {
        ev.preventDefault();
        refreshIntelligence();
        return;
      }

      const detailId = t.closest("[data-ops-p6-detail]")?.getAttribute("data-ops-p6-detail");
      if (detailId) {
        ev.preventDefault();
        selectedSuggestionId = detailId;
        renderDetail(getEngine()?.getLastResult?.(), detailId);
        return;
      }

      if (t.matches("[data-ops-p6-detail-close]")) {
        ev.preventDefault();
        selectedSuggestionId = null;
        const panel = query("[data-ops-phase6-intelligence-detail]");
        if (panel) panel.hidden = true;
      }
    });
  }

  function renderIntelligencePanel(options) {
    bindUiOnce();
    refreshIntelligence(options);
  }

  global.TasuAdminAiSecretaryPhase6 = {
    VERSION: "phase6-intelligence-panel",
    renderIntelligencePanel,
    refreshIntelligence,
    renderSections,
    renderDetail,
  };
})(typeof window !== "undefined" ? window : globalThis);
