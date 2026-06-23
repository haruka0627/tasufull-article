/**
 * TASFUL MATCH — static UI mock helpers (no API)
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function initProfileWizard() {
    const root = qs("[data-match-profile-wizard]");
    if (!root) return;

    const steps = qsa("[data-match-step]", root);
    const dots = qsa("[data-step-dot]", document);
    const label = qs("[data-match-progress-label]");
    const stepLabels = ["基本情報", "写真", "自己紹介", "趣味・確認"];
    let current = 0;

    function render() {
      steps.forEach((el, i) => el.classList.toggle("is-active", i === current));
      dots.forEach((dot, i) => {
        const item = dot.closest(".match-progress-dots__item");
        if (!item) return;
        item.classList.toggle("is-active", i === current);
        item.classList.toggle("is-done", i < current);
      });
      if (label) label.textContent = `ステップ ${current + 1} / ${steps.length} — ${stepLabels[current] || ""}`;
      const back = qs("[data-match-step-back]", root);
      const next = qs("[data-match-step-next]", root);
      if (back) back.hidden = current === 0;
      if (next) next.textContent = current === steps.length - 1 ? "プロフィールを作成" : "次へ";
    }

    qs("[data-match-step-back]", root)?.addEventListener("click", () => {
      if (current > 0) {
        current -= 1;
        render();
      }
    });

    qs("[data-match-step-next]", root)?.addEventListener("click", () => {
      if (current < steps.length - 1) {
        current += 1;
        render();
        return;
      }
      if (window.MatchProfileWiring?.submitWizard) {
        window.MatchProfileWiring.submitWizard().then((result) => {
          if (!result || !result.ok) {
            const msg = result?.message || "プロフィールの保存に失敗しました";
            showToast(msg);
            return;
          }
          if (result.mode === "client_stub") {
            window.location.href = "match-swipe.html";
            return;
          }
          showToast("プロフィールを作成しました");
          window.setTimeout(() => {
            window.location.href = "match-swipe.html";
          }, 400);
        });
        return;
      }
      window.location.href = "match-swipe.html";
    });

    qsa(".match-chip", root).forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("is-selected"));
    });

    render();
  }

  function initSwipeMenus() {
    const reportModal = qs("[data-match-report-modal]");
    const blockModal = qs("[data-match-block-modal]");

    function open(modal) {
      if (modal) modal.classList.add("is-open");
    }
    function close(modal) {
      if (modal) modal.classList.remove("is-open");
    }

    qs("[data-match-open-report]")?.addEventListener("click", () => {
      const targetUserId =
        window.MatchDataRender?.getActiveSwipeUserId?.() ||
        document.querySelector("[data-match-target-user-id]")?.getAttribute("data-match-target-user-id") ||
        "";
      const link = reportModal?.querySelector('a[href*="match-report.html"]');
      if (link && targetUserId) {
        link.setAttribute("href", "match-report.html?user_id=" + encodeURIComponent(targetUserId));
      }
      open(reportModal);
    });
    qs("[data-match-open-block]")?.addEventListener("click", () => open(blockModal));

    qs("[data-match-block-confirm]")?.addEventListener("click", () => {
      close(blockModal);
      const targetUserId =
        window.MatchDataRender?.getActiveSwipeUserId?.() ||
        document.querySelector("[data-match-target-user-id]")?.getAttribute("data-match-target-user-id") ||
        window.TasfulMatchDataStub?.getDefaultTargetUserId?.() ||
        "stub-user-unknown";

      if (window.MatchWiring?.blockUser) {
        window.MatchWiring.blockUser(targetUserId, "swipe_modal").then((result) => {
          if (!result) {
            showToast("ブロックしました");
            return;
          }
          if (!result.ok) {
            showToast(result.message || "ブロックできませんでした");
            return;
          }
          showToast("ブロックしました");
          if (window.MatchFeedWiring?.afterSwipe) {
            window.MatchFeedWiring.afterSwipe();
          } else if (window.MatchCoreWiring?.refreshPairList) {
            window.MatchCoreWiring.refreshPairList();
          }
        });
        return;
      }

      showToast("ブロックしました");
    });

    qsa("[data-match-modal-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close(reportModal);
        close(blockModal);
      });
    });

    qsa(".match-modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.remove("is-open");
      });
    });
  }

  function initChips() {
    qsa("[data-match-hobby-chip]").forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("is-selected"));
    });
  }

  function showToast(message) {
    const toast = qs("[data-match-toast]");
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function initMockToasts() {
    qsa("[data-match-mock-toast]").forEach((btn) => {
      btn.addEventListener("click", () => showToast(btn.getAttribute("data-match-mock-toast")));
    });
  }

  function initVerifyFlow() {
    const root = qs("[data-match-verify-flow]");
    if (!root) return;
    if (window.MatchVerificationWiring) return;

    const api = window.TasfulMatchAPI;
    if (api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub")) return;

    const steps = qsa("[data-verify-step]", root);
    const panels = qsa("[data-verify-panel]", root);
    let current = 1;

    function render() {
      steps.forEach((step, i) => {
        step.classList.toggle("is-active", i === current);
        step.classList.toggle("is-done", i < current);
        const num = step.querySelector(".match-verify-step__num");
        if (num) num.textContent = i < current ? "✓" : String(i + 1);
      });
      panels.forEach((panel) => {
        const idx = Number(panel.getAttribute("data-verify-panel"));
        panel.classList.toggle("is-active", idx === current);
      });
    }

    qsa("[data-verify-next]", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const verifyType = btn.getAttribute("data-verify-type");

        if (verifyType === "identity_document" && window.MatchWiring?.callApi) {
          window.MatchWiring.callApi("submitVerification", {
            verification_type: "identity_document",
            metadata: {},
          }).then((result) => {
            if (!result) {
              if (current < 3) {
                current += 1;
                render();
              }
              return;
            }
            if (!result.ok) {
              window.MatchWiring.showToast?.(result.message || "本人確認を送信できませんでした");
              return;
            }
            window.MatchWiring.showToast?.("本人確認書類を受け付けました");
            if (current < 3) {
              current += 1;
              render();
            }
          });
          return;
        }

        if (current < 3) {
          current += 1;
          render();
        }
      });
    });

    render();
  }

  function initReportFormLegacy() {
    const root = qs("[data-match-report-form]");
    if (!root) return;

    const options = qsa("[data-report-reason]", root);
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        options.forEach((o) => o.classList.remove("is-selected"));
        opt.classList.add("is-selected");
      });
    });

    qs("[data-report-submit]", root)?.addEventListener("click", () => {
      if (window.MatchWiring?.getApi?.()) return;
      const selected = options.find((o) => o.classList.contains("is-selected"));
      const label = selected?.querySelector(".match-report-option__label")?.textContent || "通報";
      const history = qs("[data-report-history]", root);
      if (history) {
        const item = document.createElement("article");
        item.className = "match-history-item";
        item.innerHTML = `
          <div class="match-history-item__top">
            <span class="match-history-item__title">${label}</span>
            <span class="match-history-item__date">たった今</span>
          </div>
          <p class="match-history-item__meta">対象：ゆい 26歳 · 送信済み</p>
          <span class="match-history-item__status">受付済み</span>
        `;
        history.prepend(item);
      }
      showToast("通報を受け付けました");
    });
  }

  function initReportForm() {
    initReportFormLegacy();
  }

  function initBlockList() {
    const list = qs("[data-match-block-list]");
    if (!list) return;

    const empty = qs("[data-block-empty]");

    function syncEmpty() {
      const remaining = qsa("[data-block-user]", list).length;
      if (empty) empty.hidden = remaining > 0;
      list.hidden = remaining === 0;
    }

    qsa("[data-block-unblock]", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (window.MatchWiring?.getApi?.()) {
          showToast("ブロック解除APIは次フェーズ予定");
          return;
        }

        const row = btn.closest("[data-block-user]");
        const name = row?.querySelector(".match-block-item__name")?.textContent || "ユーザー";
        row?.remove();
        syncEmpty();
        showToast(`${name} のブロックを解除しました`);
      });
    });

    syncEmpty();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initProfileWizard();
    initSwipeMenus();
    initChips();
    initMockToasts();
    initVerifyFlow();
    initReportForm();
    initBlockList();
  });
})();
