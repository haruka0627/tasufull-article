/**
 * TASFUL Builder — new-project.html を mvp-post と同じ create core に接続する。
 * HTML 構造は書き換えない。data 属性があるフォームだけ bind する。
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function collect(form) {
    const g = (name, attr) => {
      const el = form.querySelector(`[name="${name}"]`) || (attr ? form.querySelector(attr) : null);
      return el ? String(el.value || "").trim() : "";
    };
    return {
      title: g("title", "[data-canonical-job-title]"),
      category: g("category", "[data-canonical-job-category]"),
      project_category: g("project_category", "[data-canonical-job-category]") || g("category", "[data-canonical-job-category]"),
      detail_category: g("detail_category", "[data-canonical-job-detail-category]"),
      trade_tags: g("trade_tags", "[data-canonical-job-trades]") || g("detail_category", "[data-canonical-job-detail-category]"),
      areas: g("areas", "[data-canonical-job-areas]"),
      description: g("description", "[data-canonical-job-description]"),
      kind: g("kind", "[data-canonical-job-kind]") || "builder_board",
      visibility: g("visibility", "[data-canonical-job-visibility]") || "partner_only",
      contact_policy: g("contact_policy", "[data-canonical-job-contact-policy]") || "tasful_talk_only",
      source: g("source", "[data-canonical-job-source]") || "company",
      start: g("start", "[data-canonical-job-start]"),
      end: g("end", "[data-canonical-job-end]"),
    };
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function bindPreview(form) {
    const titleOut = document.querySelector("[data-canonical-job-preview-title]");
    const bodyOut = document.querySelector("[data-canonical-job-preview-body]");
    const count = document.querySelector("[data-canonical-job-title-count]");
    const titleEl = form.querySelector("[data-canonical-job-title], [name='title']");
    const descEl = form.querySelector("[data-canonical-job-description], [name='description']");
    const catEl = form.querySelector("[data-canonical-job-category], [name='category']");
    const refresh = () => {
      if (count && titleEl) count.textContent = `${String(titleEl.value || "").length}/100`;
      if (titleOut) titleOut.textContent = String(titleEl?.value || "").trim() || "案件タイトルが入ります";
      if (bodyOut) {
        const cat = String(catEl?.value || "").trim();
        const desc = String(descEl?.value || "").trim();
        bodyOut.textContent = [cat, desc].filter(Boolean).join(" / ") || "カテゴリと依頼内容のプレビューです。";
      }
    };
    ["input", "change"].forEach((ev) => {
      titleEl?.addEventListener(ev, refresh);
      descEl?.addEventListener(ev, refresh);
      catEl?.addEventListener(ev, refresh);
    });
    refresh();
  }

  async function onSubmit(form, ev) {
    ev.preventDefault();
    const status = document.querySelector("[data-canonical-job-status]");
    const core = global.TasuBuilderJobCreateCore;
    if (!core) {
      setStatus(status, "投稿コアが未読み込みです。成功扱いにしません。", "error");
      return;
    }
    const fields = collect(form);
    const v = core.validate(fields, { requireTitle: true });
    if (!v.ok) {
      setStatus(status, `入力を確認してください（${v.errors.join(", ")}）。`, "error");
      return;
    }
    const submitBtn = form.querySelector("[data-canonical-job-submit], button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await core.create(fields, { requireTitle: true });
      if (!res.ok) {
        setStatus(status, `投稿できません（${res.reason || "ERROR"}）。`, "error");
        return;
      }
      const flagOn = global.TasuBuilderGeneralJobsRepo?.isEnabled?.();
      if (flagOn && res.supabase && !res.supabase.ok && !res.supabase.skipped) {
        setStatus(status, "Staging 書き込みは失敗しました。COMPAT_CACHE のみ保存。偽の成功は出していません。", "warn");
      } else if (flagOn && res.supabase?.ok) {
        setStatus(status, "Staging に保存しました。詳細へ移動します。", "ok");
      } else {
        setStatus(status, "COMPAT_CACHE に保存しました（Staging flag OFF またはクライアントなし）。詳細へ移動します。", "ok");
      }
      window.location.href = res.redirect;
    } catch (err) {
      setStatus(status, "投稿処理で例外が発生しました。成功扱いにしません。", "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function init() {
    const form = document.querySelector("[data-canonical-job-form]");
    if (!form || form.dataset.wired === "1") return;
    form.dataset.wired = "1";
    bindPreview(form);
    /* submit は builder-new-project-general-jobs-wire.js:persist が DualWrite する */
    document.querySelector("[data-canonical-job-draft]")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const status = document.querySelector("[data-canonical-job-status]");
      try {
        sessionStorage.setItem("tasful:builder:new-project-draft", JSON.stringify(collect(form)));
        setStatus(status, "下書きをこの端末の sessionStorage に保存しました（SSOT ではありません）。", "ok");
      } catch {
        setStatus(status, "下書きを保存できませんでした。", "error");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
