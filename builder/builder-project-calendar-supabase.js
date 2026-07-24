/**
 * Builder Project Calendar — Supabase read adapter (P3)
 *
 * - テーブル未作成 / 未設定 / fetch 失敗時は呼び出し元が Demo fallback
 * - UI は normalizeProject 済みオブジェクトのみを使う
 * - write は対象外（read 優先）
 */
(function (global) {
  "use strict";

  /** 設計正本: builder/builder-supabase-schema-notes.md · 本番 DDL は未適用の可能性あり */
  const TABLE_CANDIDATES = Object.freeze(["builder_projects", "builder_project_hub"]);
  const VERSION = "p3-read-1";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function pickDateOnly(...vals) {
    const s = pickStr(...vals);
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function asArray(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function asObject(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try {
        const parsed = JSON.parse(v);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  /**
   * Supabase row → Calendar project 入力（normalizeProject 前）
   * 列名ゆれを吸収する。
   */
  function mapRowToProject(row) {
    const r = row && typeof row === "object" ? row : {};
    const id = pickStr(r.id, r.project_id, r.projectId);
    if (!id) return null;

    const name = pickStr(r.title, r.name, r.project_name, r.projectName) || "（無題）";
    const customerName = pickStr(
      r.customer_name,
      r.customerName,
      r.company_name,
      r.companyName,
      r.client_name,
    );
    const assignedVendor = pickStr(r.assigned_vendor, r.assignedVendor, r.vendor_name, r.company_name);
    const status = pickStr(r.status, r.project_status) || "inquiry";
    const scheduleStartDate = pickDateOnly(
      r.schedule_start,
      r.schedule_start_date,
      r.scheduleStartDate,
      r.start_date,
      r.startDate,
    );
    const scheduleEndDate = pickDateOnly(
      r.schedule_end,
      r.schedule_end_date,
      r.scheduleEndDate,
      r.end_date,
      r.endDate,
    );
    const workStartTime = pickStr(r.work_start_time, r.workStartTime, r.start_time) || "09:00";
    const workEndTime = pickStr(r.work_end_time, r.workEndTime, r.end_time) || "17:00";
    const siteAddress = pickStr(r.address, r.site_address, r.siteAddress, r.location);
    const managerName = pickStr(
      r.contact_name,
      r.contactName,
      r.manager_name,
      r.managerName,
      assignedVendor,
      customerName,
    );
    const managerPhone = pickStr(
      r.contact_phone,
      r.contactPhone,
      r.manager_phone,
      r.managerPhone,
      r.phone,
      r.customer_contact,
      r.customerContact,
    );
    const memo = pickStr(r.memo, r.note, r.notes);
    const talkRoomId = pickStr(
      r.talk_room_id,
      r.talkRoomId,
      r.talk_thread_id,
      r.talkThreadId,
      r.main_thread_id,
      r.mainThreadId,
      r.thread_id,
    );
    const schedulePhase = pickStr(r.schedule_phase, r.schedulePhase, r.phase) || "inquiry";
    const category = pickStr(r.category, r.category_id) || "other";
    const updatedAt = pickStr(r.updated_at, r.updatedAt) || new Date().toISOString();
    const createdAt = pickStr(r.created_at, r.createdAt) || updatedAt;

    const attachments = asArray(r.attachments ?? r.documents);
    const sitePhotos = asArray(r.site_photos ?? r.sitePhotos ?? r.photos);
    const completionRaw = asObject(r.completion_report ?? r.completionReport ?? r.completion);
    const estimateAddress = pickStr(r.customer_address, r.customerAddress, siteAddress);

    // CAL-MAIN-13: assignment jsonb（列が無い / null なら付けない → hydrate 側で local 維持）
    let assignment;
    if (Object.prototype.hasOwnProperty.call(r, "assignment") && r.assignment != null) {
      const a = asObject(r.assignment);
      if (a && (a.status || a.partner_id || a.partnerId)) {
        assignment = {
          status: pickStr(a.status, "pending") || "pending",
          partnerId: pickStr(a.partnerId, a.partner_id),
          partnerName: pickStr(a.partnerName, a.partner_name),
          acceptedAt: pickStr(a.acceptedAt, a.accepted_at),
          declinedAt: pickStr(a.declinedAt, a.declined_at),
          updatedAt: pickStr(a.updatedAt, a.updated_at),
          source: pickStr(a.source, "supabase"),
        };
      }
    }

    const documents = attachments.map((d, i) => {
      const item = d && typeof d === "object" ? d : { title: String(d || "") };
      return {
        id: pickStr(item.id, `doc-${id}-${i}`),
        type: pickStr(item.type, "other") || "other",
        title: pickStr(item.title, item.name, item.filename, "添付"),
        filename: pickStr(item.filename, item.file_name, item.name),
        status: pickStr(item.status, "active") || "active",
        description: pickStr(item.description),
        mimeType: pickStr(item.mimeType, item.mime_type),
        size: Number(item.size) || 0,
      };
    });

    const photos = sitePhotos.map((ph, i) => {
      const item = ph && typeof ph === "object" ? ph : { label: String(ph || "") };
      return {
        id: pickStr(item.id, `sph-${id}-${i}`),
        label: pickStr(item.label, item.title, item.caption, "現場写真"),
        url: pickStr(item.url, item.public_url, item.publicUrl),
        at: pickStr(item.at, item.uploaded_at, item.uploadedAt),
      };
    });

    const completion = {
      completionStatus: pickStr(
        completionRaw.completionStatus,
        completionRaw.completion_status,
        completionRaw.status,
        "not_started",
      ),
      completionMemo: pickStr(
        completionRaw.completionMemo,
        completionRaw.completion_memo,
        completionRaw.work_content,
        completionRaw.note,
        completionRaw.memo,
      ),
      startedAt: pickDateOnly(completionRaw.startedAt, completionRaw.started_at),
      completedAt: pickDateOnly(completionRaw.completedAt, completionRaw.completed_at),
      handoverAt: pickDateOnly(completionRaw.handoverAt, completionRaw.handover_at),
      photos,
    };

    return {
      id,
      name,
      category,
      customerName,
      customerContact: managerPhone,
      assignedVendor,
      status,
      scheduleStartDate,
      scheduleEndDate,
      schedulePhase,
      workStartTime,
      workEndTime,
      siteAddress,
      managerName,
      managerPhone,
      talkThreadId: talkRoomId,
      talkRoomId: talkRoomId,
      sitePhotos: photos,
      documents,
      completion,
      memo,
      estimate: estimateAddress
        ? {
            customerAddress: estimateAddress,
            customerName,
            estimateStatus: "draft",
            items: [],
          }
        : undefined,
      createdAt,
      updatedAt,
      source: "supabase",
      _dataSource: "supabase",
      ...(assignment ? { assignment } : {}),
    };
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isConfigured() {
    return Boolean(global.TasuSupabase?.isConfigured?.() && getClient());
  }

  /**
   * @returns {Promise<{ ok: boolean, projects?: object[], source: string, table?: string, error?: string }>}
   */
  async function fetchProjectsFromSupabase() {
    if (!isConfigured()) {
      return { ok: false, source: "unconfigured", error: "supabase_unconfigured", projects: [] };
    }
    const sb = getClient();
    if (!sb) {
      return { ok: false, source: "unconfigured", error: "supabase_client_missing", projects: [] };
    }

    let lastError = "";
    const timeoutMs = 4000;
    for (let i = 0; i < TABLE_CANDIDATES.length; i += 1) {
      const table = TABLE_CANDIDATES[i];
      try {
        const query = sb.from(table).select("*").limit(500);
        const raced = await Promise.race([
          query,
          new Promise((_, reject) => {
            global.setTimeout(() => reject(new Error("timeout")), timeoutMs);
          }),
        ]);
        const { data, error } = raced || {};
        if (error) {
          lastError = `${table}:${error.message || error.code || "error"}`;
          // 42P01 undefined_table / PGRST205 — try next candidate
          continue;
        }
        const rows = Array.isArray(data) ? data : [];
        const projects = rows.map(mapRowToProject).filter(Boolean);
        return {
          ok: true,
          source: "supabase",
          table,
          projects,
          error: projects.length ? "" : "empty",
        };
      } catch (err) {
        lastError = `${table}:${err && err.message ? err.message : String(err)}`;
      }
    }

    return {
      ok: false,
      source: "fetch_failed",
      error: lastError || "fetch_failed",
      projects: [],
    };
  }

  global.TasuBuilderProjectCalendarData = {
    VERSION,
    TABLE_CANDIDATES,
    mapRowToProject,
    isConfigured,
    fetchProjectsFromSupabase,
  };
})(typeof window !== "undefined" ? window : globalThis);
