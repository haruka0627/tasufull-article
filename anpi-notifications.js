/**
 * ANPI notifications / check history — Phase 2–10 RPC path (read-only).
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-anpi-notifications-root]");
  if (!root) return;

  const authGate = root.querySelector("[data-anpi-auth-gate]");
  const statusEl = root.querySelector("[data-anpi-page-status]");
  const errorsEl = root.querySelector("[data-anpi-page-errors]");
  const todayCard = root.querySelector("[data-anpi-today-card]");
  const todayBadge = root.querySelector("[data-anpi-today-badge]");
  const todayMeta = root.querySelector("[data-anpi-today-meta]");
  const historySection = root.querySelector("[data-anpi-history-section]");
  const loadingEl = root.querySelector("[data-anpi-loading]");
  const emptyEl = root.querySelector("[data-anpi-empty]");
  const listEl = root.querySelector("[data-anpi-history-list]");
  const refreshBtn = root.querySelector("[data-anpi-refresh]");

  let loading = false;
  let loadSeq = 0;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function showError(msg) {
    if (!errorsEl) return;
    if (!msg) {
      errorsEl.hidden = true;
      errorsEl.textContent = "";
      return;
    }
    errorsEl.hidden = false;
    errorsEl.textContent = msg;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sourceLabel(source) {
    switch (String(source || "")) {
      case "anpi_ui":
        return "安否画面";
      case "talk":
        return "メッセージ";
      case "admin_recovery":
        return "管理者復旧";
      case "migration":
        return "移行";
      default:
        return source ? "その他" : "—";
    }
  }

  function renderToday(row) {
    if (!todayCard) return;
    todayCard.hidden = false;
    const mapped = window.TasuAnpiRpc.mapCheckStatus(row);
    if (todayBadge) todayBadge.textContent = mapped.label;
    if (todayMeta) {
      if (!row) {
        todayMeta.textContent = "本日分の確認データはありません。設定画面で安否サービスを有効にしてください。";
        return;
      }
      const date = window.TasuAnpiRpc.formatTokyoDate(row.local_check_date);
      const scheduled = window.TasuAnpiRpc.formatTokyoDateTime(row.scheduled_at);
      const confirmed = row.confirmed_at
        ? ` / 確認 ${window.TasuAnpiRpc.formatTokyoDateTime(row.confirmed_at)}`
        : "";
      todayMeta.textContent = `日付 ${date} / 予定 ${scheduled}${confirmed}`;
    }
  }

  function renderHistory(rows) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const items = (rows || []).filter(Boolean);
    if (emptyEl) emptyEl.hidden = items.length > 0;
    items.forEach((row) => {
      const li = document.createElement("li");
      li.className = "anpi-history-item";
      const mapped = window.TasuAnpiRpc.mapCheckStatus(row);
      li.innerHTML =
        `<div class="anpi-history-item__main">` +
        `<strong class="anpi-history-item__date">${escapeHtml(
          window.TasuAnpiRpc.formatTokyoDate(row.local_check_date)
        )}</strong>` +
        `<span class="anpi-history-item__status anpi-history-item__status--${escapeHtml(
          mapped.key
        )}">${escapeHtml(mapped.label)}</span>` +
        `</div>` +
        `<dl class="anpi-history-item__meta">` +
        `<div><dt>予定</dt><dd>${escapeHtml(
          window.TasuAnpiRpc.formatTokyoDateTime(row.scheduled_at)
        )}</dd></div>` +
        `<div><dt>確認</dt><dd>${escapeHtml(
          window.TasuAnpiRpc.formatTokyoDateTime(row.confirmed_at)
        )}</dd></div>` +
        `<div><dt>確認経路</dt><dd>${escapeHtml(sourceLabel(row.confirmation_source))}</dd></div>` +
        `</dl>`;
      listEl.appendChild(li);
    });
  }

  async function loadAll() {
    if (loading) return;
    loading = true;
    const seq = ++loadSeq;
    showError("");
    setStatus("読み込み中…");
    if (loadingEl) loadingEl.hidden = false;
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      await window.TasuAnpiRpc.requireSession();
    } catch {
      if (authGate) authGate.hidden = false;
      if (todayCard) todayCard.hidden = true;
      if (historySection) historySection.hidden = true;
      setStatus("");
      loading = false;
      if (loadingEl) loadingEl.hidden = true;
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    if (authGate) authGate.hidden = true;
    if (historySection) historySection.hidden = false;

    try {
      // Read-only today status — do not call ensure from this page.
      const todayRes = await window.TasuAnpiRpc.getTodayCheck();
      if (seq !== loadSeq) return;
      if (!todayRes.ok) {
        if (todayRes.error?.kind === "UNAUTHENTICATED") {
          if (authGate) authGate.hidden = false;
          if (historySection) historySection.hidden = true;
        } else {
          showError(todayRes.error?.userMessage || "本日の状態を取得できませんでした");
        }
      } else if (!todayRes.stale) {
        renderToday(todayRes.data);
      }

      const histRes = await window.TasuAnpiRpc.listCheckHistory(30);
      if (seq !== loadSeq) return;
      if (!histRes.ok) {
        showError(histRes.error?.userMessage || "履歴を取得できませんでした");
        setStatus(histRes.error?.retryable ? "再試行できます。" : "");
      } else if (!histRes.stale) {
        renderHistory(histRes.data);
        setStatus(histRes.data.length ? `履歴 ${histRes.data.length} 件` : "");
      }
    } finally {
      if (seq === loadSeq) {
        loading = false;
        if (loadingEl) loadingEl.hidden = true;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    }
  }

  refreshBtn?.addEventListener("click", () => {
    loadAll();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll);
  } else {
    loadAll();
  }
})();
