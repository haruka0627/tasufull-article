/**
 * AI秘書 Phase 7-B — Google Workspace Assistant UI (+ Activity tab)
 */
(function (global) {
  "use strict";

  let mounted = false;
  let activeTab = "assistant";
  let activityFilters = { status: "", service: "", q: "" };
  let selectedRequestId = "";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function Orch() {
    return global.TasuSecretaryGoogleOrchestrator;
  }

  function Activity() {
    return global.TasuSecretaryWorkspaceActivity;
  }

  function formatTime(iso) {
    const t = Date.parse(String(iso || ""));
    if (!Number.isFinite(t)) return esc(iso || "");
    try {
      return esc(new Date(t).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
    } catch {
      return esc(iso || "");
    }
  }

  function formatDuration(ms) {
    const n = Number(ms || 0);
    if (n < 1000) return `${n}ms`;
    return `${(n / 1000).toFixed(1)}s`;
  }

  function setTab(root, tab) {
    activeTab = tab;
    const assistantPanel = $(root, "[data-ops-gws-assistant-panel]");
    const activityPanel = $(root, "[data-ops-gws-activity-panel]");
    root.querySelectorAll("[data-ops-gws-assistant-tab]").forEach((btn) => {
      const active = btn.getAttribute("data-ops-gws-assistant-tab") === tab;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.classList.toggle("ops-secretary-google-workspace__tab--active", active);
    });
    if (assistantPanel) assistantPanel.hidden = tab !== "assistant";
    if (activityPanel) activityPanel.hidden = tab !== "activity";
    if (tab === "activity") renderActivity(root);
  }

  function renderPlan(root, plan) {
    const host = $(root, "[data-ops-google-workspace-assistant-plan]");
    if (!host) return;
    if (!plan?.steps?.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">実行計画はまだありません</p>';
      return;
    }
    host.innerHTML =
      `<p class="ops-secretary-gmail__readonly">Intent: ${esc(plan.intent)} · Status: ${esc(plan.status)}</p>` +
      `<ol class="ops-secretary-gws-plan">` +
      plan.steps
        .map((st) => {
          const badge =
            st.status === "done" ? "✅" : st.status === "blocked" ? "⏸" : st.status === "error" ? "❌" : st.status === "running" ? "…" : "○";
          return `<li class="ops-secretary-gws-plan__item ops-secretary-gws-plan__item--${esc(st.status)}">${badge} ${esc(st.label)}</li>`;
        })
        .join("") +
      `</ol>`;
  }

  function renderLog(root, plan) {
    const host = $(root, "[data-ops-google-workspace-assistant-log]");
    if (!host) return;
    const logs = Array.isArray(plan?.logs) ? plan.logs : [];
    if (!logs.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">実行ログはまだありません</p>';
      return;
    }
    host.innerHTML =
      `<h5 class="ops-secretary-gws-log__title">実行ログ</h5>` +
      `<ul class="ops-secretary-gws-log">` +
      logs
        .map(
          (row) =>
            `<li>${esc(row.label || row.stepId || "")} — ${row.ok ? esc(row.summary || "OK") : esc(row.error || "ERROR")}${row.humanGate ? " · Human Gate" : ""}</li>`
        )
        .join("") +
      `</ul>` +
      (plan.executedApis?.length ? `<p class="ops-secretary-gmail__readonly">API: ${esc(plan.executedApis.join(", "))}</p>` : "");
  }

  function renderActions(root, plan) {
    const approveBtn = $(root, "[data-ops-google-workspace-assistant-approve]");
    const cancelBtn = $(root, "[data-ops-google-workspace-assistant-cancel]");
    const awaiting = plan?.status === "awaiting_gate" && plan?.humanGatePendingId;
    if (approveBtn) {
      approveBtn.hidden = !awaiting;
      approveBtn.disabled = !awaiting;
    }
    if (cancelBtn) cancelBtn.hidden = !awaiting;
  }

  function renderAssistant(root, plan) {
    renderPlan(root, plan);
    renderLog(root, plan);
    renderActions(root, plan);
  }

  function renderActivityList(root) {
    const host = $(root, "[data-ops-gws-activity-list]");
    if (!host || !Activity()?.listActivities) return;
    const rows = Activity().listActivities(activityFilters);
    if (!rows.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Activity はありません</p>';
      return;
    }
    host.innerHTML = rows
      .map(
        (row) =>
          `<button type="button" class="ops-secretary-gmail__card ops-secretary-gws-activity__row" data-gws-activity-id="${esc(row.requestId)}">` +
          `<span class="ops-secretary-gmail__meta">${formatTime(row.timestamp)} · ${esc(formatDuration(row.duration))}</span>` +
          `<strong class="ops-secretary-gmail__subject">${esc(row.intent)}</strong>` +
          `<span class="ops-secretary-gmail__snippet">${esc(row.status)}${row.humanGate?.state ? ` · HG:${esc(row.humanGate.state)}` : ""}</span>` +
          `</button>`
      )
      .join("");
    host.querySelectorAll("[data-gws-activity-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRequestId = btn.getAttribute("data-gws-activity-id") || "";
        renderActivityDetail(root);
      });
    });
  }

  function renderActivityDetail(root) {
    const host = $(root, "[data-ops-gws-activity-detail]");
    if (!host) return;
    const row = selectedRequestId ? Activity()?.getActivity?.(selectedRequestId) : null;
    if (!row) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML =
      `<article class="ops-secretary-gmail__card">` +
      `<h5 class="ops-secretary-gws-log__title">詳細 · ${esc(row.requestId)}</h5>` +
      `<dl class="ops-secretary-calendar__detail-list">` +
      `<dt>Intent</dt><dd>${esc(row.intent)}</dd>` +
      `<dt>Status</dt><dd>${esc(row.status)}</dd>` +
      `<dt>Duration</dt><dd>${esc(formatDuration(row.duration))}</dd>` +
      `<dt>Human Gate</dt><dd>${esc(row.humanGate?.state || "—")}</dd>` +
      `<dt>APIs</dt><dd>${esc((row.executedApis || []).join(", ") || "—")}</dd>` +
      `<dt>Error</dt><dd>${esc(row.error || "—")}</dd>` +
      `</dl>` +
      `<pre class="ops-secretary-gws-activity__json">${esc(JSON.stringify(row, null, 2).slice(0, 4000))}</pre>` +
      `</article>`;
  }

  function renderActivity(root) {
    renderActivityList(root);
    renderActivityDetail(root);
  }

  function bindActivityFilters(root) {
    root.querySelectorAll("[data-ops-gws-activity-filter]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-ops-gws-activity-filter") || "";
        if (["success", "failed", "cancelled", "human_gate"].includes(kind)) {
          activityFilters.status = activityFilters.status === kind ? "" : kind;
        } else if (["gmail", "calendar", "contacts", "drive"].includes(kind)) {
          activityFilters.service = activityFilters.service === kind ? "" : kind;
        }
        renderActivity(root);
      });
    });
    const searchForm = $(root, "[data-ops-gws-activity-search-form]");
    if (searchForm && searchForm.dataset.bound !== "1") {
      searchForm.dataset.bound = "1";
      searchForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = $(root, "[data-ops-gws-activity-search-input]");
        activityFilters.q = String(input?.value || "").trim();
        renderActivity(root);
      });
    }
    const exportBtn = $(root, "[data-ops-gws-activity-export]");
    if (exportBtn && exportBtn.dataset.bound !== "1") {
      exportBtn.dataset.bound = "1";
      exportBtn.addEventListener("click", () => {
        const json = Activity()?.exportJson?.(activityFilters) || "[]";
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `workspace-activity-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  async function onSubmit(root) {
    const input = $(root, "[data-ops-google-workspace-assistant-input]");
    const status = $(root, "[data-ops-google-workspace-assistant-status]");
    const text = String(input?.value || "").trim();
    if (!text || !Orch()?.runWorkspaceRequest) return;

    if (status) status.textContent = "Intent解析中…";
    const result = await Orch().runWorkspaceRequest(text);
    if (status) {
      status.textContent = result.ok
        ? result.awaitingHumanGate
          ? "Human Gate 承認待ち"
          : "完了"
        : `エラー: ${String(result.error || "failed").slice(0, 80)}`;
    }
    renderAssistant(root, result.plan || Orch().loadLastRun?.());
  }

  async function onApprove(root) {
    const status = $(root, "[data-ops-google-workspace-assistant-status]");
    if (status) status.textContent = "Human Gate 実行中…";
    const result = await Orch()?.approveHumanGate?.();
    if (status) status.textContent = result?.ok ? "実行完了" : `エラー: ${String(result?.error || "failed").slice(0, 80)}`;
    renderAssistant(root, result?.plan || Orch()?.loadLastRun?.());
    renderActivity(root);
    global.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
  }

  function onCancel(root) {
    const result = Orch()?.cancelHumanGate?.(Orch()?.loadLastRun?.(), "operator_cancelled");
    renderAssistant(root, result?.plan || Orch()?.loadLastRun?.());
    renderActivity(root);
    const status = $(root, "[data-ops-google-workspace-assistant-status]");
    if (status) status.textContent = "キャンセルしました";
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-google-workspace-assistant]");
    if (!root || mounted) return;
    mounted = true;

    root.querySelectorAll("[data-ops-gws-assistant-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        setTab(root, tab.getAttribute("data-ops-gws-assistant-tab") || "assistant");
      });
    });

    $(root, "[data-ops-google-workspace-assistant-form]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void onSubmit(root);
    });
    $(root, "[data-ops-google-workspace-assistant-approve]")?.addEventListener("click", () => void onApprove(root));
    $(root, "[data-ops-google-workspace-assistant-cancel]")?.addEventListener("click", () => onCancel(root));

    bindActivityFilters(root);
    setTab(root, "assistant");

    global.addEventListener("tasu:google-workspace-orchestrator-updated", () => {
      renderAssistant(root, Orch()?.loadLastRun?.());
    });
    global.addEventListener("tasu:workspace-activity-updated", () => {
      if (activeTab === "activity") renderActivity(root);
    });

    renderAssistant(root, Orch()?.loadLastRun?.());
  }

  global.TasuSecretaryGoogleOrchestratorUI = { mount, renderAssistant, renderActivity, setTab };
})(typeof window !== "undefined" ? window : globalThis);
