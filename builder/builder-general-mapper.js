/**
 * Builder General Jobs — MVP ↔ Supabase row mapper (P0-01)
 * Pure transforms · no I/O
 */
(function (global) {
  "use strict";

  const VERSION = "p0-01-general-mapper-1";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * MVP 投稿フォーム / project オブジェクト → builder_projects INSERT row
   * @param {object} input
   * @param {{ authUserId?: string, projectKey?: string }} ctx
   */
  function toGeneralProjectRow(input, ctx) {
    const p = input && typeof input === "object" ? input : {};
    const spec = p.spec && typeof p.spec === "object" ? p.spec : {};
    const period = spec.period && typeof spec.period === "object" ? spec.period : {};
    const authUserId = pickStr(ctx?.authUserId, p.owner_id);

    const row = {
      project_key: pickStr(ctx?.projectKey, p.project_id, p.project_key),
      owner_id: authUserId || "demo-owner-001",
      title: pickStr(p.title) || "無題案件",
      kind: "builder_board",
      status: pickStr(p.status) || "open",
      required_partners: Math.max(1, Number(p.required_partners) || 1),
      selected_partner_ids: Array.isArray(p.selected_partner_ids) ? p.selected_partner_ids : [],
      visibility: pickStr(p.visibility) || "partner_only",
      contact_policy: pickStr(p.contact_policy) || "tasful_talk_only",
      source: pickStr(p.source) || "public_user",
      project_category: pickStr(p.project_category, p.projectCategory) || null,
      board_type: pickStr(p.board_type, p.boardType) || "project",
      main_thread_id: p.main_thread_id || null,
      source_template_id: p.source_template_id || null,
      talk_room_id: pickStr(p.talk_room_id, p.talkRoomId) || null,
      talk_thread_id: pickStr(p.talk_thread_id, p.talkThreadId) || null,
      schedule_start: pickStr(period.start) || null,
      schedule_end: pickStr(period.end) || null,
      spec: {
        trade_tags: Array.isArray(spec.trade_tags) ? spec.trade_tags : [],
        area_codes: Array.isArray(spec.area_codes) ? spec.area_codes : [],
        period: { start: pickStr(period.start), end: pickStr(period.end) },
        description: pickStr(spec.description),
        budget_note: pickStr(spec.budget_note) || null,
      },
      created_at: pickStr(p.created_at) || nowIso(),
      updated_at: nowIso(),
    };

    Object.keys(row).forEach((k) => {
      if (row[k] === null || row[k] === undefined) delete row[k];
    });
    return row;
  }

  /**
   * Supabase row → Repository API shape（一覧/詳細）
   */
  function fromGeneralProjectRow(row) {
    const r = row && typeof row === "object" ? row : {};
    const spec = r.spec && typeof r.spec === "object" ? r.spec : {};
    const id = pickStr(r.id, r.project_key);
    return {
      id,
      project_id: pickStr(r.project_key, r.id),
      uuid: pickStr(r.id),
      owner_id: pickStr(r.owner_id),
      title: pickStr(r.title),
      kind: pickStr(r.kind) || "builder_board",
      status: pickStr(r.status) || "open",
      required_partners: Number(r.required_partners) || 1,
      selected_partner_ids: Array.isArray(r.selected_partner_ids) ? r.selected_partner_ids : [],
      visibility: pickStr(r.visibility),
      contact_policy: pickStr(r.contact_policy),
      source: pickStr(r.source),
      project_category: pickStr(r.project_category),
      board_type: pickStr(r.board_type) || "project",
      main_thread_id: r.main_thread_id || null,
      talk_room_id: pickStr(r.talk_room_id),
      talk_thread_id: pickStr(r.talk_thread_id),
      spec,
      created_at: pickStr(r.created_at),
      updated_at: pickStr(r.updated_at),
    };
  }

  /**
   * MVP application → builder_project_applications INSERT row
   */
  function toApplicationRow(input, ctx) {
    const a = input && typeof input === "object" ? input : {};
    const authUserId = pickStr(ctx?.authUserId, ctx?.applicantAuthUid, a.applicant_auth_uid);
    const row = {
      application_key: pickStr(ctx?.applicationKey, a.application_id, a.application_key),
      project_id: pickStr(ctx?.projectUuid, a.project_uuid, a.project_id),
      applicant_auth_uid: authUserId,
      partner_id: a.partner_uuid || ctx?.partnerUuid || null,
      partner_key: pickStr(a.partner_id, a.partner_key, ctx?.partnerKey) || null,
      status: pickStr(a.status) || "applied",
      message: pickStr(a.message, a.body) || null,
      payload: a.payload && typeof a.payload === "object" ? a.payload : null,
      applied_at: pickStr(a.ts, a.applied_at) || nowIso(),
      updated_at: nowIso(),
    };
    if (!row.partner_key && !row.partner_id) {
      row.partner_key = pickStr(ctx?.partnerKey, "demo-partner-001");
    }
    Object.keys(row).forEach((k) => {
      if (row[k] === null || row[k] === undefined) delete row[k];
    });
    return row;
  }

  function fromApplicationRow(row) {
    const r = row && typeof row === "object" ? row : {};
    return {
      id: pickStr(r.id),
      application_id: pickStr(r.application_key, r.id),
      project_id: pickStr(r.project_id),
      applicant_auth_uid: pickStr(r.applicant_auth_uid),
      partner_id: pickStr(r.partner_key, r.partner_id),
      partner_uuid: r.partner_id || null,
      status: pickStr(r.status) || "applied",
      message: pickStr(r.message),
      payload: r.payload || null,
      applied_at: pickStr(r.applied_at),
      updated_at: pickStr(r.updated_at),
    };
  }

  global.TasuBuilderGeneralMapper = {
    VERSION,
    toGeneralProjectRow,
    fromGeneralProjectRow,
    toApplicationRow,
    fromApplicationRow,
  };
})(typeof window !== "undefined" ? window : globalThis);
