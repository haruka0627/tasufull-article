/**
 * TASFUL AI — プラン別モデル選択 UI
 */
(function (global) {
  "use strict";

  const MOUNT_ATTR = "data-ai-model-selector-mounted";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderOptions(planId, selectedId) {
    const list = global.TasuAiPlanModels?.listModelsForPlan?.(planId) || [];
    return list
      .filter((m) => !m.hidden)
      .map((m) => {
        const disabled = m.disabled || m.comingSoon;
        const selected = m.id === selectedId ? " selected" : "";
        const hint = m.upgradeHint || (m.comingSoon ? "準備中" : "");
        return (
          `<option value="${escapeHtml(m.id)}"${selected}` +
          (disabled ? " disabled" : "") +
          `>${escapeHtml(m.label)}${hint ? `（${escapeHtml(hint)}）` : ""}</option>`
        );
      })
      .join("");
  }

  const STYLE_HINTS = Object.freeze({
    "gemini-flash": "すばやく回答を得たいときに",
    gpt: "バランスの良い回答",
    claude: "より深く、正確に答えたいときに",
  });

  function renderWorkspaceChips(planId, selectedId) {
    const list = global.TasuAiPlanModels?.listModelsForPlan?.(planId) || [];
    return list
      .filter((m) => !m.hidden)
      .map((m) => {
        const active = m.id === selectedId ? " is-active" : "";
        const disabled = !m.selectable ? " is-disabled" : "";
        const hint = STYLE_HINTS[m.id] || "";
        const hintText = m.upgradeHint || hint;
        const ariaHint = hintText ? ` aria-label="${escapeHtml(m.label)}（${escapeHtml(hintText)}）"` : "";
        const title = hintText ? ` title="${escapeHtml(hintText)}"` : "";
        return (
          `<button type="button" class="ai-model-chip ai-model-chip--card${active}${disabled}"` +
          ` data-ai-model-chip="${escapeHtml(m.id)}"` +
          ` data-ai-provider="${escapeHtml(m.provider || "")}"` +
          (m.selectable ? "" : " disabled") +
          ` aria-pressed="${m.id === selectedId ? "true" : "false"}"` +
          `${title}${ariaHint}>` +
          `<span class="ai-model-chip__label">${escapeHtml(m.shortLabel || m.label)}</span>` +
          (hint ? `<span class="ai-model-chip__hint">${escapeHtml(hint)}</span>` : "") +
          (m.comingSoon ? `<span class="ai-model-chip__soon">準備中</span>` : "") +
          `</button>`
        );
      })
      .join("");
  }

  function bindChipEvents(bar) {
    const chipsEl = bar.querySelector("[data-ai-model-chips]");
    if (!chipsEl || chipsEl.dataset.bound) return;
    chipsEl.dataset.bound = "1";
    chipsEl.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-ai-model-chip]");
      if (!btn || btn.disabled) return;
      const next = btn.getAttribute("data-ai-model-chip");
      if (!next) return;
      if (global.TasuAiPlanModels?.setSelectedModelId?.(next)) {
        updateBar(bar);
      }
    });
  }

  function updateBar(root) {
    if (!root) return;
    const Plans = global.TasuAiPlanModels;
    const planId = Plans?.resolveUserPlan?.() || "free";
    const selectedId = Plans?.getSelectedModelId?.() || "gemini-flash";
    const model = Plans?.getModel?.(selectedId);
    const labelEl = root.querySelector("[data-ai-model-current-label]");
    const selectEl = root.querySelector("[data-ai-model-select]");
    const chipsEl = root.querySelector("[data-ai-model-chips]");
    if (labelEl) labelEl.textContent = model?.label || selectedId;
    if (selectEl) {
      selectEl.innerHTML = renderOptions(planId, selectedId);
      selectEl.value = selectedId;
    }
    if (chipsEl) {
      chipsEl.innerHTML = renderWorkspaceChips(planId, selectedId);
      bindChipEvents(root);
    }
    root.setAttribute("data-ai-user-plan", planId);
    root.setAttribute("data-ai-selected-model", selectedId);
  }

  function mount(host, options) {
    if (!host || host.getAttribute(MOUNT_ATTR)) return host.querySelector("[data-ai-model-bar]");

    const isWorkspace = options?.variant === "workspace";
    const variant = options?.variant === "compact" ? " ai-model-bar--compact" : "";
    const workspaceVariant = isWorkspace ? " ai-model-bar--workspace" : "";
    const bar = document.createElement("div");
    bar.className = `ai-model-bar${variant}${workspaceVariant}`;
    bar.setAttribute("data-ai-model-bar", "");

    if (isWorkspace) {
      bar.innerHTML =
        `<div class="ai-model-bar__workspace">` +
        `<div class="ai-model-bar__workspace-head">` +
        `<span class="ai-model-bar__workspace-title">回答スタイル</span>` +
        `</div>` +
        `<div class="ai-model-bar__chips" data-ai-model-chips role="tablist" aria-label="回答スタイルを選択"></div>` +
        `</div>`;
    } else {
      bar.innerHTML =
        `<div class="ai-model-bar__row">` +
        `<span class="ai-model-bar__current">現在のAI: <strong data-ai-model-current-label>Gemini</strong></span>` +
        `<label class="ai-model-bar__select-wrap">` +
        `<span class="ai-model-bar__select-label">モデル</span>` +
        `<select class="ai-model-bar__select" data-ai-model-select aria-label="回答スタイルを選択"></select>` +
        `</label>` +
        `</div>`;
    }

    host.insertBefore(bar, host.firstChild);
    host.setAttribute(MOUNT_ATTR, "1");

    const selectEl = bar.querySelector("[data-ai-model-select]");
    selectEl?.addEventListener("change", () => {
      const next = selectEl.value;
      global.TasuAiPlanModels?.setSelectedModelId?.(next);
      updateBar(bar);
    });

    if (isWorkspace) bindChipEvents(bar);

    const onPlanChange = () => updateBar(bar);
    global.addEventListener("tasu:ai-plan-changed", onPlanChange);
    global.addEventListener("tasu:ai-model-changed", onPlanChange);

    updateBar(bar);
    return bar;
  }

  function initWorkspaceChat() {
    const host = document.querySelector("[data-ai-model-selector-host]");
    if (host) mount(host, { variant: "workspace" });
    const head = document.querySelector("[data-ai-workspace-chat] .ai-chat__head");
    if (head) mount(head, { variant: "compact" });
  }

  function initGenAiChat() {
    const head = document.querySelector("[data-gen-ai-chat] .chat-area__head");
    if (head) mount(head, { variant: "compact" });
  }

  function initTalkAi() {
    const card = document.querySelector('[data-talk-panel="ai"] .talk-card');
    if (card) {
      const host = card.querySelector(".talk-ai-modes")?.parentElement || card;
      mount(host, { variant: "compact" });
    }
  }

  function initAll() {
    initWorkspaceChat();
    initGenAiChat();
    initTalkAi();
  }

  global.TasuAiModelSelector = {
    mount,
    updateBar,
    initAll,
    initWorkspaceChat,
    initGenAiChat,
    initTalkAi,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})(typeof window !== "undefined" ? window : globalThis);
