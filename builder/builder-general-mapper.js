/**
 * TASFUL Builder — general job mapper
 * Rich spec keys を insert 時に落とさない:
 * prefecture, city, address, postal_code, scale, desired_timing_note
 */
(function (global) {
  "use strict";

  function trim(v) {
    return String(v == null ? "" : v).trim();
  }

  function toGeneralProjectRow(input) {
    const src = input || {};
    const cache = global.TasuBuilderCompatCache;
    const projectKey = trim(src.project_id || src.project_key) || (cache ? cache.uid("proj") : `proj-${Date.now()}`);
    const prefecture = trim(src.prefecture || src.spec?.prefecture);
    const city = trim(src.city || src.spec?.city);
    const address = trim(src.address || src.spec?.address);
    const postal_code = trim(src.postal_code || src.spec?.postal_code);
    const scale = trim(src.scale || src.spec?.scale);
    const desired_timing_note = trim(src.desired_timing_note || src.spec?.desired_timing_note);
    const spec = Object.assign({}, src.spec || {}, {
      prefecture,
      city,
      address,
      postal_code,
      scale,
      desired_timing_note,
      category: trim(src.category || src.project_category || src.spec?.category),
      detail_category: trim(src.detail_category || src.spec?.detail_category),
      description: trim(src.description || src.spec?.description),
      trade_tags: src.trade_tags || src.spec?.trade_tags || [],
      area_codes: src.areas || src.area_codes || src.spec?.area_codes || [],
      period: src.period || src.spec?.period || { start: trim(src.start), end: trim(src.end) },
    });
    return {
      project_key: projectKey,
      owner_id: trim(src.owner_id) || "owner-demo",
      title: trim(src.title) || "無題案件",
      kind: "builder_board",
      status: trim(src.status) || "open",
      publication_state: "private_draft",
      visibility: trim(src.visibility) || "partner_only",
      contact_policy: trim(src.contact_policy) || "tasful_talk_only",
      source: trim(src.source) || "company",
      prefecture,
      city,
      address,
      postal_code,
      scale,
      desired_timing_note,
      spec,
    };
  }

  function fromGeneralProjectRow(row) {
    if (!row) return null;
    const spec = row.spec && typeof row.spec === "object" ? row.spec : {};
    return {
      project: {
        project_id: row.project_key || row.id,
        supabase_id: row.id || "",
        title: row.title,
        kind: row.kind || "builder_board",
        status: row.status,
        publication_state: row.publication_state || "private_draft",
        visibility: row.visibility,
        contact_policy: row.contact_policy,
        source: row.source,
        owner_id: row.owner_id,
        main_thread_id: row.main_thread_id || null,
      },
      spec: Object.assign({}, spec, {
        prefecture: row.prefecture || spec.prefecture || "",
        city: row.city || spec.city || "",
        address: row.address || spec.address || "",
        postal_code: row.postal_code || spec.postal_code || "",
        scale: row.scale || spec.scale || "",
        desired_timing_note: row.desired_timing_note || spec.desired_timing_note || "",
      }),
    };
  }

  global.TasuBuilderGeneralMapper = {
    toGeneralProjectRow,
    fromGeneralProjectRow,
  };
})(typeof window !== "undefined" ? window : globalThis);
