/**
 * AI運営秘書 — モード定義（Phase7 UI 用 · 最小実装）
 */
(function (global) {
  "use strict";

  const MODES = Object.freeze([
    { id: "secretary", label: "AI秘書", description: "運営全体を横断して支援します。" },
    { id: "inbox", label: "Inbox", description: "未対応・優先案件の整理。" },
    { id: "connect", label: "Connect", description: "Stripe Connect / 本人確認の確認。" },
  ]);

  function renderModeSwitcher() {
    const menu = document.querySelector("[data-ops-secretary-mode-switcher]");
    if (!menu || menu.dataset.bound === "1") return;
    menu.innerHTML = "";
    MODES.forEach((mode) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ops-p7-mode-picker__item";
      btn.textContent = mode.label;
      btn.dataset.opsMode = mode.id;
      btn.setAttribute("role", "menuitem");
      btn.addEventListener("click", () => {
        const label = document.querySelector("[data-ops-mode-current-label]");
        const desc = document.querySelector("[data-ops-mode-description]");
        if (label) label.textContent = mode.label;
        if (desc) desc.textContent = mode.description;
        const picker = document.getElementById("ops-p7-mode-picker");
        if (picker) picker.open = false;
        const scrollTargets = {
          secretary: "ops-ai-command-center",
          inbox: "ops-ai-daily-inbox",
          connect: "ops-ai-connect",
        };
        const targetId = scrollTargets[mode.id];
        if (targetId && global.TasuAdminOpsDashboardNav?.scrollToSection) {
          global.TasuAdminOpsDashboardNav.scrollToSection(targetId);
        }
      });
      menu.appendChild(btn);
    });
    menu.dataset.bound = "1";
  }

  global.TasuAdminAiSecretary = {
    MODES,
    PERSISTENT_SHELL: {
      mount() {
        /* floating shell — 後続フェーズ */
      },
    },
    renderModeSwitcher,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderModeSwitcher);
  } else {
    renderModeSwitcher();
  }
})(typeof window !== "undefined" ? window : globalThis);
