/**
 * パートナー評価管理画面
 */
(function () {
  "use strict";

  const Store = window.TasuBuilderPartnerEval;
  const Parse = window.TasuBuilderPartnerEvalParse;
  if (!Store || !Parse) return;

  let pendingHide = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setMessage(text, ok) {
    const el = document.querySelector("[data-builder-eval-message]");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-ok", Boolean(ok));
    el.classList.toggle("is-error", text && !ok);
  }

  function renderScores() {
    const list = document.querySelector("[data-builder-eval-score-list]");
    const count = document.querySelector("[data-builder-eval-score-count]");
    if (!list) return;
    const rows = Store.listPartnerScoreboard(false);
    if (count) count.textContent = `${rows.length} 件`;
    if (!rows.length) {
      list.innerHTML = `<li class="builder-list-item"><p class="builder-list-item__sub">評価データがありません</p></li>`;
      return;
    }
    list.innerHTML = rows
      .map((r) => {
        const s = r.score;
        const sign = (n) => (n > 0 ? `+${n}` : String(n));
        return (
          `<li class="builder-list-item">` +
          `<div class="builder-list-item__main">` +
          `<p class="builder-list-item__title">${esc(r.partner_name)}</p>` +
          Store.formatScoreSummary(r.partner_id, r.partner_name).html +
          `<p class="builder-list-item__sub">最終評価: ${esc(s.last_evaluated_at || "—")}</p>` +
          `</div></li>`
        );
      })
      .join("");
  }

  function renderHistory() {
    const list = document.querySelector("[data-builder-eval-history-list]");
    if (!list) return;
    const rows = Store.getBuilderPartnerEvaluations().slice(0, 40);
    if (!rows.length) {
      list.innerHTML = `<li class="builder-list-item"><p class="builder-list-item__sub">履歴なし</p></li>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (e) =>
          `<li class="builder-list-item">` +
          `<div class="builder-list-item__main">` +
          `<p class="builder-list-item__title">${esc(e.partner_name)}</p>` +
          `<p class="builder-list-item__sub">期日 ${e.deadline_delta > 0 ? "+" : ""}${e.deadline_delta} · クレーム ${e.complaint_delta > 0 ? "+" : ""}${e.complaint_delta} · ${esc(e.created_at)}</p>` +
          `<p class="builder-list-item__sub">${esc(e.note || e.project_id || "")}</p>` +
          `</div></li>`
      )
      .join("");
  }

  function renderHidden() {
    const list = document.querySelector("[data-builder-eval-hidden-list]");
    const count = document.querySelector("[data-builder-eval-hidden-count]");
    if (!list) return;
    const rows = Store.listHiddenPartners();
    if (count) count.textContent = `${rows.length} 件`;
    if (!rows.length) {
      list.innerHTML = `<li class="builder-list-item"><p class="builder-list-item__sub">非表示パートナーはありません</p></li>`;
      return;
    }
    const events = Store.getBuilderPartnerStatusEvents();
    list.innerHTML = rows
      .map((r) => {
        const ev = events.find((e) => e.partner_id === r.partner_id);
        return (
          `<li class="builder-list-item">` +
          `<div class="builder-list-item__main">` +
          `<p class="builder-list-item__title">${esc(r.partner_name)} <span class="builder-perf-badge builder-perf-badge--hidden">${esc(r.partner_status)}</span></p>` +
          `<p class="builder-list-item__sub">理由: ${esc(ev?.reason || "—")} / ${esc(ev?.created_by || "")} / ${esc(ev?.created_at || "")}</p>` +
          Store.formatScoreSummary(r.partner_id, r.partner_name).html +
          `</div></li>`
        );
      })
      .join("");
  }

  function refresh() {
    renderScores();
    renderHistory();
    renderHidden();
  }

  function openHideModal(parsed) {
    pendingHide = parsed;
    const modal = document.querySelector("[data-builder-eval-modal]");
    const text = document.querySelector("[data-builder-eval-modal-text]");
    if (text) {
      text.textContent = `「${parsed.partnerName}」をドタキャン対応として候補・検索から非表示にします。よろしいですか？`;
    }
    if (modal) modal.hidden = false;
  }

  function closeHideModal() {
    pendingHide = null;
    const modal = document.querySelector("[data-builder-eval-modal]");
    if (modal) modal.hidden = true;
  }

  function bind() {
    const form = document.querySelector("[data-builder-eval-form]");
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const raw = document.querySelector("[data-builder-eval-input]")?.value || "";
      const project_id = document.querySelector("[data-builder-eval-project-id]")?.value || "";
      const parsed = Parse.parseBuilderPartnerEvaluationInput(raw);
      if (!parsed.ok) {
        setMessage(parsed.error, false);
        return;
      }
      if (parsed.type === "hide") {
        openHideModal(parsed);
        setMessage("非表示操作は確認後に実行されます", true);
        return;
      }
      const result = Store.addBuilderPartnerEvaluation({
        partner_name: parsed.partnerName,
        deadline_delta: parsed.deadline_delta,
        complaint_delta: parsed.complaint_delta,
        project_id: project_id || null,
        created_by: "admin",
      });
      if (!result.ok) {
        setMessage(result.error, false);
        return;
      }
      setMessage(
        `「${result.partner.partner_name}」を登録しました（合計 ${result.score.total_score} / 期日 ${result.score.deadline_score} / クレーム ${result.score.no_complaint_score}）`,
        true
      );
      form.reset();
      refresh();
    });

    document.querySelectorAll("[data-builder-eval-modal-cancel]").forEach((el) => {
      el.addEventListener("click", closeHideModal);
    });
    document.querySelector("[data-builder-eval-modal-confirm]")?.addEventListener("click", () => {
      if (!pendingHide) return;
      const result = Store.applyPartnerHideStatus({
        partner_name: pendingHide.partnerName,
        hide_status: pendingHide.hide_status,
        reason: pendingHide.hide_reason,
        created_by: "admin",
      });
      closeHideModal();
      if (!result.ok) {
        setMessage(result.error, false);
        return;
      }
      setMessage(`「${result.partner.partner_name}」を非表示にしました`, true);
      document.querySelector("[data-builder-eval-form]")?.reset();
      refresh();
    });

    window.addEventListener("tasu:builder-partner-eval-changed", refresh);
    window.addEventListener("builder:admin-partners-changed", refresh);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bind();
      refresh();
    });
  } else {
    bind();
    refresh();
  }
})();
