/**
 * TASFUL MATCH — admin review UI (edge/live only)
 */
(function () {
  "use strict";

  const REASON_LABELS = {
    inappropriate_message: "不適切なメッセージ",
    impersonation: "なりすまし",
    harassment: "ハラスメント",
    other: "その他",
  };

  function isEdgeMode() {
    return window.TasfulMatchAPI && (typeof window.TasfulMatchAPI.isLiveMode === "function" ? window.TasfulMatchAPI.isLiveMode() : window.TasfulMatchAPI.mode === "live" || window.TasfulMatchAPI.mode === "edge_stub");
  }

  function toast(message) {
    const el = document.querySelector("[data-match-toast]");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    window.setTimeout(() => el.classList.remove("is-visible"), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text) {
    const el = document.querySelector("[data-admin-status]");
    if (el) el.textContent = text;
  }

  function activeTab() {
    return document.querySelector(".match-admin-tab.is-active")?.getAttribute("data-admin-tab") || "reports";
  }

  function switchTab(tabKey) {
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-admin-tab") === tabKey;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      const on = panel.getAttribute("data-admin-panel") === tabKey;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
  }

  async function adminCall(body) {
    return window.TasfulMatchAPI.adminReview(body);
  }

  function renderEmpty(listEl, message) {
    listEl.innerHTML =
      `<p class="match-admin-empty">${escapeHtml(message || "該当なし")}</p>`;
  }

  function renderReports(listEl, items) {
    if (!items.length) {
      renderEmpty(listEl, "未処理の通報はありません");
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const reportedName = item.reported?.display_name || item.reported_user_id;
        const reporterName = item.reporter?.display_name || item.reporter_user_id;
        const reason = REASON_LABELS[item.reason] || item.reason;
        return `
          <article class="match-admin-card" data-report-id="${escapeHtml(item.report_id)}">
            <header class="match-admin-card__head">
              <span class="match-admin-badge">${escapeHtml(item.status)}</span>
              <time>${escapeHtml((item.created_at || "").slice(0, 16).replace("T", " "))}</time>
            </header>
            <p class="match-admin-card__title">${escapeHtml(reportedName)} への通報</p>
            <p class="match-admin-card__meta">通報者: ${escapeHtml(reporterName)} · ${escapeHtml(reason)}</p>
            ${item.detail ? `<p class="match-admin-card__detail">${escapeHtml(item.detail)}</p>` : ""}
            <div class="match-admin-card__actions">
              <button type="button" class="match-btn match-btn--primary match-btn--sm" data-admin-action="report-resolve" data-id="${escapeHtml(item.report_id)}">解決</button>
              <button type="button" class="match-btn match-btn--secondary match-btn--sm" data-admin-action="report-dismiss" data-id="${escapeHtml(item.report_id)}">却下</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderVerifications(listEl, items, kind) {
    if (!items.length) {
      renderEmpty(listEl, "審査待ちはありません");
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const name = item.profile?.display_name || item.user_id;
        const doc = item.id_document_type ? ` · ${item.id_document_type}` : "";
        return `
          <article class="match-admin-card" data-verification-id="${escapeHtml(item.verification_id)}">
            <header class="match-admin-card__head">
              <span class="match-admin-badge">${escapeHtml(item.status)}</span>
              <span>${escapeHtml(kind)}</span>
            </header>
            <p class="match-admin-card__title">${escapeHtml(name)}</p>
            <p class="match-admin-card__meta">user: ${escapeHtml(item.user_id)}${escapeHtml(doc)}</p>
            <div class="match-admin-card__actions">
              <button type="button" class="match-btn match-btn--primary match-btn--sm" data-admin-action="verification-approve" data-id="${escapeHtml(item.verification_id)}">承認</button>
              <button type="button" class="match-btn match-btn--secondary match-btn--sm" data-admin-action="verification-reject" data-id="${escapeHtml(item.verification_id)}">却下</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderProfiles(listEl, items) {
    if (!items.length) {
      renderEmpty(listEl, "プロフィールがありません");
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const suspended = item.profile_status === "suspended";
        return `
          <article class="match-admin-card" data-profile-id="${escapeHtml(item.profile_id)}">
            <header class="match-admin-card__head">
              <span class="match-admin-badge ${suspended ? "is-warn" : ""}">${escapeHtml(item.profile_status)}</span>
            </header>
            <p class="match-admin-card__title">${escapeHtml(item.display_name || item.user_id)}</p>
            <p class="match-admin-card__meta">user: ${escapeHtml(item.user_id)} · 本人: ${escapeHtml(item.verification_status)} · 年齢: ${item.age_verified ? "済" : "未"}</p>
            <div class="match-admin-card__actions">
              ${
                suspended
                  ? `<button type="button" class="match-btn match-btn--primary match-btn--sm" data-admin-action="profile-unsuspend" data-id="${escapeHtml(item.profile_id)}">停止解除</button>`
                  : `<button type="button" class="match-btn match-btn--secondary match-btn--sm" data-admin-action="profile-suspend" data-id="${escapeHtml(item.profile_id)}">停止</button>`
              }
            </div>
          </article>`;
      })
      .join("");
  }

  async function loadTab(tabKey) {
    if (!isEdgeMode()) return;
    const listEl = document.querySelector(`[data-admin-list="${tabKey}"]`);
    if (!listEl) return;
    listEl.innerHTML = `<p class="match-admin-empty">読み込み中…</p>`;

    try {
      if (tabKey === "reports") {
        const res = await adminCall({ intent: "list_reports" });
        if (!res.ok) throw new Error(res.message || "list failed");
        renderReports(listEl, res.items || []);
        return;
      }
      if (tabKey === "identity" || tabKey === "age") {
        const res = await adminCall({
          intent: "list_verifications",
          verification_type: tabKey === "identity" ? "identity" : "age",
        });
        if (!res.ok) throw new Error(res.message || "list failed");
        renderVerifications(listEl, res.items || [], tabKey === "identity" ? "本人確認" : "年齢確認");
        return;
      }
      if (tabKey === "profiles") {
        const res = await adminCall({ intent: "list_profiles" });
        if (!res.ok) throw new Error(res.message || "list failed");
        renderProfiles(listEl, res.items || []);
      }
    } catch (err) {
      renderEmpty(listEl, err.message || "読み込みに失敗しました");
    }
  }

  async function handleAction(event) {
    const btn = event.target.closest("[data-admin-action]");
    if (!btn || !isEdgeMode()) return;
    const action = btn.getAttribute("data-admin-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;
    btn.disabled = true;

    try {
      let res;
      if (action === "report-resolve") {
        res = await adminCall({ action: "REPORT_REVIEW", report_id: id, decision: "resolve" });
      } else if (action === "report-dismiss") {
        res = await adminCall({ action: "REPORT_REVIEW", report_id: id, decision: "dismiss" });
      } else if (action === "verification-approve") {
        res = await adminCall({ action: "VERIFICATION_REVIEW", verification_id: id, decision: "approve" });
      } else if (action === "verification-reject") {
        res = await adminCall({ action: "VERIFICATION_REVIEW", verification_id: id, decision: "reject" });
      } else if (action === "profile-suspend") {
        res = await adminCall({ action: "PROFILE_ACTION", profile_id: id, decision: "suspend" });
      } else if (action === "profile-unsuspend") {
        res = await adminCall({ action: "PROFILE_ACTION", profile_id: id, decision: "unsuspend" });
      }
      if (!res?.ok) throw new Error(res?.message || "操作に失敗しました");
      toast("処理しました");
      await loadTab(activeTab());
    } catch (err) {
      toast(err.message || "エラーが発生しました");
      btn.disabled = false;
    }
  }

  function init() {
    const root = document.querySelector("[data-match-admin-root]");
    if (!root) return;

    if (!isEdgeMode()) {
      setStatus("client_stub モードです。管理機能は live 接続時のみ利用できます。");
      return;
    }

    setStatus("管理者として接続中");
    loadTab("reports");

    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-admin-tab");
        if (!tab) return;
        switchTab(tab);
        loadTab(tab);
      });
    });

    document.querySelectorAll("[data-admin-refresh]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-admin-refresh");
        if (tab) loadTab(tab);
      });
    });

    root.addEventListener("click", handleAction);
  }

  window.MatchAdminWiring = { init, loadTab, isEdgeMode };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
