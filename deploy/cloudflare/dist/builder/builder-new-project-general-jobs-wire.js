/**
 * TASFUL Builder — new-project persist → DualWrite
 * isRepositoryActive() が false なら Supabase は叩かず COMPAT_CACHE のみ。
 * publication_state は private_draft。publishGeneralProject は呼ばない。
 */
(function (global) {
  "use strict";

  function collect(form) {
    const g = (name, attr) => {
      const el = form.querySelector(`[name="${name}"]`) || (attr ? form.querySelector(attr) : null);
      return el ? String(el.value || "").trim() : "";
    };
    return {
      title: g("title", "[data-canonical-job-title]"),
      category: g("category", "[data-canonical-job-category]"),
      project_category: g("category", "[data-canonical-job-category]"),
      detail_category: g("detail_category", "[data-canonical-job-detail-category]"),
      description: g("description", "[data-canonical-job-description]"),
      prefecture: g("prefecture", "[data-canonical-job-prefecture]"),
      city: g("city", "[data-canonical-job-city]"),
      address: g("address", "[data-canonical-job-address]"),
      postal_code: g("postal_code", "[data-canonical-job-postal-code]"),
      scale: g("scale", "[data-canonical-job-scale]"),
      desired_timing_note: g("desired_timing_note", "[data-canonical-job-timing]"),
      kind: g("kind", "[data-canonical-job-kind]") || "builder_board",
      visibility: g("visibility", "[data-canonical-job-visibility]") || "partner_only",
      contact_policy: g("contact_policy", "[data-canonical-job-contact-policy]") || "tasful_talk_only",
      source: g("source", "[data-canonical-job-source]") || "company",
      start: g("start", "[data-canonical-job-start]"),
      end: g("end", "[data-canonical-job-end]"),
      trade_tags: g("detail_category", "[data-canonical-job-detail-category]"),
      areas: g("areas", "[data-canonical-job-areas]"),
    };
  }

  function isRepositoryActive() {
    return Boolean(global.TasuBuilderGeneralJobsStagingFlags?.isRepositoryActive?.());
  }

  async function persist(fields) {
    const mapper = global.TasuBuilderGeneralMapper;
    const row = mapper?.toGeneralProjectRow ? mapper.toGeneralProjectRow(fields) : fields;
    row.publication_state = "private_draft";
    let supabase = { attempted: false, ok: false, skipped: true, reason: "REPO_INACTIVE" };
    if (isRepositoryActive() && global.TasuBuilderProjectRepository?.insertPrivateDraft) {
      const inserted = await global.TasuBuilderProjectRepository.insertPrivateDraft(row);
      supabase = Object.assign({ attempted: true, skipped: false }, inserted);
      if (inserted.ok) {
        row.project_key = inserted.project_key || row.project_key;
        row.supabase_id = inserted.id;
      }
    }
    const mapped = mapper?.fromGeneralProjectRow
      ? mapper.fromGeneralProjectRow(row)
      : { project: { project_id: row.project_key, title: row.title }, spec: row.spec || {} };
    if (mapped.project) {
      mapped.project.project_id = row.project_key || mapped.project.project_id;
      mapped.project.publication_state = "private_draft";
    }
    const cache = global.TasuBuilderCompatCache?.upsertJobCache(mapped.project, mapped.spec);
    const id = mapped.project?.project_id || row.project_key;
    const href = global.TasuBuilderCanonicalRoutes?.projectDetailHref(id) || `project-detail.html?id=${encodeURIComponent(id)}`;
    return {
      ok: true,
      id,
      row,
      mapped,
      supabase,
      compatCache: cache,
      redirect: href,
      dualWrite: true,
    };
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function init() {
    const form = document.querySelector("[data-canonical-job-form]");
    if (!form || form.dataset.generalJobsWired === "1") return;
    form.dataset.generalJobsWired = "1";
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const status = document.querySelector("[data-canonical-job-status]");
      const fields = collect(form);
      if (!fields.title || !fields.category || !fields.description) {
        setStatus(status, "タイトル・カテゴリー・依頼詳細は必須です。", "error");
        return;
      }
      const btn = form.querySelector("[data-canonical-job-submit], button[type='submit']");
      if (btn) btn.disabled = true;
      try {
        const res = await persist(fields);
        if (res.supabase.attempted && !res.supabase.ok) {
          setStatus(status, `Staging insert は失敗（${res.supabase.reason || "ERROR"}）。COMPAT_CACHE のみ。published 直 insert はしていません。`, "warn");
        } else if (res.supabase.ok) {
          setStatus(status, "private_draft で Staging に保存しました。詳細へ移動します。", "ok");
        } else {
          setStatus(status, "Repository inactive。COMPAT_CACHE のみ保存（isRepositoryActive=false）。", "ok");
        }
        window.location.href = res.redirect;
      } catch {
        setStatus(status, "persist 例外。成功扱いにしません。", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.TasuBuilderNewProjectGeneralJobsWire = {
    persist,
    isRepositoryActive,
    collect,
  };
})(typeof window !== "undefined" ? window : globalThis);
