/**
 * 安否ダッシュボード — Phase 2–10 authenticated RPC path.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-anpi-dashboard-root]");
  if (!root) return;

  const shell = root.querySelector("[data-anpi-dashboard-shell]");
  const authBanner = root.querySelector("[data-anpi-auth-required]");
  const emptyBanner = root.querySelector("[data-anpi-empty-unregistered]");
  const statusEl = root.querySelector("[data-anpi-dash-status]");
  const errorsEl = root.querySelector("[data-anpi-dash-errors]");
  const todayPanel = root.querySelector("[data-anpi-today-panel]");
  const todayBadge = root.querySelector("[data-anpi-today-badge]");
  const todayMeta = root.querySelector("[data-anpi-today-meta]");
  const confirmBtn = root.querySelector("[data-anpi-confirm-btn]");
  const confirmFeedback = root.querySelector("[data-anpi-confirm-feedback]");
  const settingsSummary = root.querySelector("[data-anpi-settings-summary]");

  /** Ensure today check at most once per page load. */
  let ensuredThisLoad = false;
  let confirmBusy = false;
  /** @type {string|null} */
  let currentCheckId = null;

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

  function renderSettingsSummary(row) {
    if (!settingsSummary || !row) return;
    settingsSummary.hidden = false;
    const enabled = settingsSummary.querySelector("[data-anpi-summary-enabled]");
    const time = settingsSummary.querySelector("[data-anpi-summary-time]");
    const schedule = settingsSummary.querySelector("[data-anpi-summary-schedule]");
    if (enabled) enabled.textContent = row.enabled === false ? "無効" : row.paused_at ? "一時停止中" : "有効";
    if (time) time.textContent = String(row.initial_notification_time || "").slice(0, 5) || "—";
    if (schedule) {
      schedule.textContent =
        row.schedule_type === "weekdays"
          ? `曜日指定 (${(row.weekdays || []).join(",")})`
          : "毎日";
    }
  }

  function updateConfirmUi(mapped, check) {
    currentCheckId = check?.id || check?.check_id || null;
    if (todayBadge) todayBadge.textContent = mapped.label;
    if (todayMeta) {
      const date = check?.local_check_date || "—";
      const confirmed = check?.confirmed_at
        ? ` / 確認 ${window.TasuAnpiRpc.formatTokyoDateTime(check.confirmed_at)}`
        : "";
      todayMeta.textContent = `日付 ${date}${confirmed}`;
    }
    if (!confirmBtn) return;
    const canConfirm = mapped.key === "pending" && !!currentCheckId;
    confirmBtn.disabled = !canConfirm || confirmBusy;
    confirmBtn.textContent = mapped.key === "confirmed" ? "確認済み" : "安否確認する";
  }

  async function loadToday(settings) {
    if (!todayPanel) return;
    todayPanel.hidden = false;

    let check = null;
    const read = await window.TasuAnpiRpc.getTodayCheck();
    if (read.ok && !read.stale) check = read.data;

    if (
      !ensuredThisLoad &&
      settings?.enabled !== false &&
      !settings?.paused_at &&
      (!check || !check.id)
    ) {
      ensuredThisLoad = true;
      const ensured = await window.TasuAnpiRpc.ensureTodayCheck();
      if (ensured.ok && !ensured.stale) {
        if (ensured.data?.skipped_reason) {
          if (todayBadge) todayBadge.textContent = "本日対象外";
          if (todayMeta) todayMeta.textContent = "本日は確認対象外です。";
          if (confirmBtn) confirmBtn.disabled = true;
          return;
        }
        check = {
          id: ensured.data?.check_id,
          status: ensured.data?.status,
          local_check_date: ensured.data?.local_check_date,
          confirmed_at: ensured.data?.confirmed_at,
        };
      } else if (!ensured.ok && !ensured.stale) {
        showError(ensured.error?.userMessage || "本日の確認を準備できませんでした");
      }
    }

    const mapped = window.TasuAnpiRpc.mapCheckStatus(check);
    updateConfirmUi(mapped, check);
  }

  async function bootstrap() {
    if (shell) shell.hidden = false;
    setStatus("読み込み中…");
    showError("");

    try {
      await window.TasuAnpiRpc.requireSession();
    } catch {
      if (authBanner) authBanner.hidden = false;
      if (emptyBanner) emptyBanner.hidden = true;
      if (todayPanel) todayPanel.hidden = true;
      if (settingsSummary) settingsSummary.hidden = true;
      setStatus("");
      return;
    }
    if (authBanner) authBanner.hidden = true;

    const settingsRes = await window.TasuAnpiRpc.getMySettings();
    if (settingsRes.stale) return;
    if (!settingsRes.ok) {
      showError(settingsRes.error?.userMessage || "設定を取得できませんでした");
      setStatus("");
      return;
    }

    if (!settingsRes.data) {
      if (emptyBanner) emptyBanner.hidden = false;
      if (todayPanel) todayPanel.hidden = true;
      if (settingsSummary) settingsSummary.hidden = true;
      setStatus("");
      window.dispatchEvent(new CustomEvent("tasu:anpi-dashboard-ready"));
      return;
    }

    if (emptyBanner) emptyBanner.hidden = true;
    renderSettingsSummary(settingsRes.data);
    await loadToday(settingsRes.data);
    setStatus("");
    window.dispatchEvent(new CustomEvent("tasu:anpi-dashboard-ready"));
  }

  confirmBtn?.addEventListener("click", async () => {
    if (confirmBusy || !currentCheckId) return;
    confirmBusy = true;
    confirmBtn.disabled = true;
    if (confirmFeedback) confirmFeedback.textContent = "送信中…";
    showError("");

    const res = await window.TasuAnpiRpc.confirmCheck(currentCheckId);
    confirmBusy = false;
    if (res.stale) return;
    if (!res.ok) {
      showError(res.error?.userMessage || "確認に失敗しました");
      if (confirmFeedback) confirmFeedback.textContent = res.error?.retryable ? "再試行できます。" : "";
      confirmBtn.disabled = false;
      return;
    }

    const row = {
      id: res.data?.check_id || currentCheckId,
      status: res.data?.status || "confirmed",
      confirmed_at: res.data?.confirmed_at,
      local_check_date: res.data?.local_check_date,
    };
    const mapped = window.TasuAnpiRpc.mapCheckStatus(row);
    updateConfirmUi(mapped, row);
    if (confirmFeedback) {
      confirmFeedback.textContent = res.alreadyConfirmed
        ? "すでに確認済みです。"
        : "安否確認を受け付けました。";
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
