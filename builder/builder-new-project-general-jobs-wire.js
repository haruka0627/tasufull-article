/**
 * TASFUL Builder — new-project persist → DualWrite
 * isRepositoryActive() が false なら Supabase は叩かず COMPAT_CACHE のみ。
 * insert/update は必ず private_draft。publish は既存 publishGeneralProject のみ。
 * 案件を投稿する → intent=publish。下書きとして保存 → intent=draft（publish しない）。
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
      project_key: g("project_key", "[data-canonical-job-project-key]"),
      project_id: g("project_id", "[data-canonical-job-project-id]"),
    };
  }

  function isRepositoryActive() {
    return Boolean(global.TasuBuilderGeneralJobsStagingFlags?.isRepositoryActive?.());
  }

  function readUrlId() {
    try {
      return String(new URLSearchParams(global.location?.search || "").get("id") || "").trim();
    } catch {
      return "";
    }
  }

  async function resolveOwnerId(fields) {
    const fromFields = String(fields?.owner_id || "").trim();
    try {
      const c = global.TasuBuilderGeneralJobsStagingFlags?.getClient?.();
      if (c?.auth?.getUser) {
        const { data } = await c.auth.getUser();
        const uid = String(data?.user?.id || "").trim();
        if (uid) return uid;
      }
    } catch {
      /* ignore */
    }
    return fromFields || "owner-demo";
  }

  async function persist(fields, options) {
    const intent = options?.intent === "publish" ? "publish" : "draft";
    const mapper = global.TasuBuilderGeneralMapper;
    const repo = global.TasuBuilderProjectRepository;
    const ownerId = await resolveOwnerId(fields);
    const existingKey = String(fields?.project_key || fields?.project_id || readUrlId() || "").trim();
    const row = mapper?.toGeneralProjectRow
      ? mapper.toGeneralProjectRow(Object.assign({}, fields, { owner_id: ownerId, project_key: existingKey || fields?.project_key }))
      : Object.assign({}, fields, { owner_id: ownerId });
    row.publication_state = "private_draft";
    let supabase = { attempted: false, ok: false, skipped: true, reason: "REPO_INACTIVE", intent };
    if (isRepositoryActive() && repo?.insertPrivateDraft) {
      let saved;
      if (existingKey && repo.updatePrivateDraft) {
        saved = await repo.updatePrivateDraft(existingKey, row);
        if (!saved.ok) saved = await repo.insertPrivateDraft(row);
      } else {
        saved = await repo.insertPrivateDraft(row);
      }
      supabase = Object.assign({ attempted: true, skipped: false, intent }, saved);
      if (saved.ok) {
        row.project_key = saved.project_key || row.project_key;
        row.supabase_id = saved.id;
        if (intent === "publish" && repo.publishGeneralProject) {
          const pub = await repo.publishGeneralProject(row.project_key || saved.project_key || saved.id);
          supabase.publish = pub;
          if (pub.ok) row.publication_state = "published";
        }
      }
    }
    const mapped = mapper?.fromGeneralProjectRow
      ? mapper.fromGeneralProjectRow(row)
      : { project: { project_id: row.project_key, title: row.title }, spec: row.spec || {} };
    if (mapped.project) {
      mapped.project.project_id = row.project_key || mapped.project.project_id;
      mapped.project.publication_state = row.publication_state || "private_draft";
    }
    const cache = global.TasuBuilderCompatCache?.upsertJobCache(mapped.project, mapped.spec);
    const id = mapped.project?.project_id || row.project_key;
    const href = global.TasuBuilderCanonicalRoutes?.projectDetailHref(id) || `project-detail.html?id=${encodeURIComponent(id)}`;
    return {
      ok: true,
      id,
      intent,
      row,
      mapped,
      supabase,
      compatCache: cache,
      redirect: href,
      dualWrite: true,
      published: Boolean(supabase.publish?.ok),
    };
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function publishStatusText(res) {
    if (res.supabase.attempted && !res.supabase.ok) {
      return `Staging insert は失敗（${res.supabase.reason || "ERROR"}）。COMPAT_CACHE のみ。published 直 insert はしていません。`;
    }
    if (res.supabase.ok && res.published) {
      return "公開しました（published）。詳細へ移動します。";
    }
    if (res.supabase.ok && res.intent === "publish") {
      const why = res.supabase.publish?.reason || res.supabase.publish?.code || "PUBLISH_FAILED";
      return `private_draft まで保存。公開遷移は失敗（${why}）。published 直 insert はしていません。`;
    }
    if (res.supabase.ok) {
      return "private_draft で Staging に保存しました。";
    }
    return "Repository inactive。COMPAT_CACHE のみ保存（isRepositoryActive=false）。";
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
        const res = await persist(fields, { intent: "publish" });
        const kind = res.supabase.attempted && !res.supabase.ok ? "warn" : res.published || res.supabase.ok ? "ok" : "ok";
        setStatus(status, publishStatusText(res), kind);
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
    resolveOwnerId,
  };
})(typeof window !== "undefined" ? window : globalThis);
