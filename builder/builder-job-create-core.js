/**
 * TASFUL Builder — job create core
 * mvp-post と同じ mapper / validation を Rich new-project と共有する。
 * Supabase first（flag ON）→ MVP COMPAT_CACHE ミラー。
 */
(function (global) {
  "use strict";

  function routes() {
    return global.TasuBuilderCanonicalRoutes;
  }

  function cache() {
    return global.TasuBuilderCompatCache;
  }

  function repo() {
    return global.TasuBuilderGeneralJobsRepo;
  }

  function parseComma(val) {
    return String(val || "")
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function mapFromForm(fields) {
    const c = cache();
    const project_id = String(fields.project_id || (c ? c.uid("proj") : `proj-${Date.now()}`));
    const title = String(fields.title || "").trim() || "無題案件";
    const project = {
      project_id,
      owner_id: String(fields.owner_id || "owner-demo"),
      title,
      project_category: String(fields.project_category || fields.category || "").trim() || "協力会社募集",
      kind: String(fields.kind || "builder_board") || "builder_board",
      status: "open",
      required_partners: 1,
      selected_partner_ids: [],
      visibility: String(fields.visibility || "partner_only"),
      contact_policy: String(fields.contact_policy || "tasful_talk_only"),
      main_thread_id: null,
      source: String(fields.source || "company"),
      source_template_id: fields.source_template_id || null,
      source_project_id: fields.source_project_id || null,
      source_re_request_id: fields.source_re_request_id || null,
      created_at: c ? c.nowIso() : new Date().toISOString(),
    };
    const spec = {
      trade_tags: Array.isArray(fields.trade_tags) ? fields.trade_tags : parseComma(fields.trade_tags || fields.detail_category),
      area_codes: Array.isArray(fields.areas) ? fields.areas : parseComma(fields.areas),
      period: { start: String(fields.start || ""), end: String(fields.end || "") },
      description: String(fields.description || "").trim(),
      category: String(fields.category || fields.project_category || "").trim(),
      detail_category: String(fields.detail_category || "").trim(),
    };
    if (fields.budget_note) spec.budget_note = String(fields.budget_note);
    return { project, spec };
  }

  function validate(fields, { requireTitle } = {}) {
    const repoApi = repo();
    const mapped = mapFromForm(fields);
    const base = repoApi?.validateJobInput
      ? repoApi.validateJobInput(mapped.project)
      : { ok: true, errors: [] };
    const errors = (base.errors || []).slice();
    if (requireTitle && !String(fields.title || "").trim()) errors.push("title");
    if (requireTitle && !String(fields.category || fields.project_category || "").trim()) errors.push("category");
    if (requireTitle && !String(fields.description || "").trim()) errors.push("description");
    return { ok: errors.length === 0, errors, mapped };
  }

  async function create(fields, options) {
    const opts = options || {};
    const v = validate(fields, { requireTitle: !!opts.requireTitle });
    if (!v.ok) return { ok: false, reason: "VALIDATION", errors: v.errors };
    const { project, spec } = v.mapped;
    const repoApi = repo();
    let supabase = { attempted: false, ok: false, skipped: true, reason: "FLAG_OFF" };
    if (repoApi?.isEnabled?.()) {
      supabase = { attempted: true, skipped: false, ok: false };
      const inserted = await repoApi.insertJob(project);
      supabase = Object.assign({ attempted: true }, inserted);
      if (inserted.ok && inserted.id) project.supabase_id = inserted.id;
      if (inserted.project_key) project.project_id = inserted.project_key;
    }
    const c = cache();
    const mirror = c ? c.upsertJobCache(project, spec) : { ok: false, reason: "NO_CACHE" };
    const id = project.project_id;
    const href = routes()?.projectDetailHref(id) || `project-detail.html?id=${encodeURIComponent(id)}`;
    return {
      ok: true,
      id,
      project,
      spec,
      supabase,
      compatCache: mirror,
      redirect: href,
    };
  }

  global.TasuBuilderJobCreateCore = {
    mapFromForm,
    validate,
    create,
  };
})(typeof window !== "undefined" ? window : globalThis);
