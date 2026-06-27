/**
 * AI秘書 Phase 7-A — Google Workspace Assistant UI
 */
(function (global) {
  "use strict";

  let mounted = false;

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
            st.status === "done"
              ? "✅"
              : st.status === "blocked"
                ? "⏸"
                : st.status === "error"
                  ? "❌"
                  : st.status === "running"
                    ? "…"
                    : "○";
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
      (plan.context?.summaryText
        ? `<p class="ops-secretary-gmail__snippet">${esc(plan.context.summaryText)}</p>`
        : "") +
      (plan.executedApis?.length
        ? `<p class="ops-secretary-gmail__readonly">API: ${esc(plan.executedApis.join(", "))}</p>`
        : "");
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

  function renderAll(root, plan) {
    renderPlan(root, plan);
    renderLog(root, plan);
    renderActions(root, plan);
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
    renderAll(root, result.plan || Orch().loadLastRun?.());
  }

  async function onApprove(root) {
    const status = $(root, "[data-ops-google-workspace-assistant-status]");
    if (status) status.textContent = "Human Gate 実行中…";
    const result = await Orch()?.approveHumanGate?.();
    if (status) status.textContent = result?.ok ? "実行完了" : `エラー: ${String(result?.error || "failed").slice(0, 80)}`;
    renderAll(root, result?.plan || Orch()?.loadLastRun?.());
    global.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
  }

  function onCancel(root) {
    const plan = Orch()?.loadLastRun?.();
    if (plan) {
      plan.status = "cancelled";
      plan.humanGatePendingId = "";
      Orch().sanitizeRun(plan);
      try {
        global.sessionStorage?.setItem("tasu_secretary_google_workspace_run_v1", JSON.stringify(Orch().sanitizeRun(plan)));
      } catch {
        /* ignore */
      }
    }
    renderAll(root, plan);
    const status = $(root, "[data-ops-google-workspace-assistant-status]");
    if (status) status.textContent = "キャンセルしました";
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-google-workspace-assistant]");
    if (!root || mounted) return;
    mounted = true;

    const form = $(root, "[data-ops-google-workspace-assistant-form]");
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void onSubmit(root);
    });

    $(root, "[data-ops-google-workspace-assistant-approve]")?.addEventListener("click", () => {
      void onApprove(root);
    });
    $(root, "[data-ops-google-workspace-assistant-cancel]")?.addEventListener("click", () => {
      onCancel(root);
    });

    global.addEventListener("tasu:google-workspace-orchestrator-updated", () => {
      renderAll(root, Orch()?.loadLastRun?.());
    });

    renderAll(root, Orch()?.loadLastRun?.());
  }

  global.TasuSecretaryGoogleOrchestratorUI = { mount, renderAll };
})(typeof window !== "undefined" ? window : globalThis);
