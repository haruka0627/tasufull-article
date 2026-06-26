/**
 * AI運営秘書 Phase7 — コマンドセンター（テキストチャット連携 · 最小）
 */
(function (global) {
  "use strict";

  function renderCommandCenterHome(ctx) {
    global.TasuAdminAiSecretary?.renderModeSwitcher?.();
    global.TasuAdminAiSecretaryPhase2?.render?.(ctx);

    const opening = document.querySelector("[data-ops-phase7-opening]");
    if (opening && !opening.textContent.trim()) {
      const n = ctx?.metrics?.pendingTotal;
      opening.textContent =
        typeof n === "number"
          ? `本日 ${n} 件の確認候補があります。下の AIチャット で状況を聞けます。`
          : "AIチャットで運営状況をテキスト入力できます。";
    }

    const todaySlot = document.querySelector("[data-ops-phase7-slot-today]");
    if (todaySlot && !todaySlot.children.length && ctx?.priorityRows?.length) {
      const ul = document.createElement("ul");
      ul.className = "ops-p7-desk-today-list";
      ctx.priorityRows.slice(0, 3).forEach((row) => {
        const li = document.createElement("li");
        li.textContent = row.title || row.label || "優先項目";
        ul.appendChild(li);
      });
      todaySlot.appendChild(ul);
    }
  }

  global.TasuAdminAiSecretaryPhase7 = {
    renderCommandCenterHome,
  };
})(typeof window !== "undefined" ? window : globalThis);
