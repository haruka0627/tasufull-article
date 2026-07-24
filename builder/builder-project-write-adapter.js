/**
 * Builder Project Calendar — Supabase write adapter (P4 Phase 1 / CAL-MAIN-13)
 *
 * - 二重書き込み: Supabase → localStorage
 * - Supabase 失敗時は localStorage にも保存しない
 * - dataSourceMode === "supabase" の場合のみ Supabase write を実行
 * - assignment jsonb は列がある環境のみ best-effort（列無し・RLS NG は握りつぶし・Console Error なし）
 * - UI から直接呼ばれず、Store 経由で使用される
 */
(function (global) {
  "use strict";

  const VERSION = "p4-write-1-cal-main-13";

  /** @type {boolean|null} null=未検出 · true=列あり · false=列なし/不可 */
  let assignmentColumnSupported = null;

  /**
   * Calendar project object → DDL snake_case row に変換
   * calendar の camelCase / PascalCase プロパティを Supabase DDL カラムにマッピング
   */
  /**
   * 現在の認証ユーザーIDを取得（null の場合は未認証）
   * localStorage に保存された Supabase session から直接読み取る
   */
  function getAuthUserId() {
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem("tasu-supabase-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || null;
    } catch (e) {
      return null;
    }
  }

  function toDdlRow(project) {
    const p = project && typeof project === "object" ? project : {};
    const ownerId = getAuthUserId();
    const completion = p.completion || {};
    const estimate = p.estimate || {};
    const rawSitePhotos = Array.isArray(p.sitePhotos) ? p.sitePhotos : [];
    const rawDocuments = Array.isArray(p.documents) ? p.documents : [];

    const row = {
      owner_id: ownerId || null,
      kind: "tasful_managed",
      required_partners: 1,
      title: p.name || null,
      status: p.status || null,
      category: p.category || null,
      customer_name: p.customerName || null,
      customer_contact: p.customerContact || null,
      assigned_vendor: p.assignedVendor || null,
      site_address: p.siteAddress || estimate.customerAddress || null,
      schedule_start: p.scheduleStartDate || null,
      schedule_end: p.scheduleEndDate || null,
      schedule_phase: p.schedulePhase || null,
      work_start_time: p.workStartTime || null,
      work_end_time: p.workEndTime || null,
      manager_name: p.managerName || null,
      manager_phone: p.managerPhone || null,
      talk_room_id: p.talkRoomId || null,
      talk_thread_id: p.talkThreadId || p.talkRoomId || null,
      memo: p.memo || null,
      completion_report: completion.completionStatus
        ? {
            completionStatus: completion.completionStatus || "not_started",
            completionMemo: completion.completionMemo || "",
            startedAt: completion.startedAt || "",
            completedAt: completion.completedAt || "",
            handoverAt: completion.handoverAt || "",
          }
        : null,
      site_photos: rawSitePhotos.length
        ? rawSitePhotos.map((ph) => ({
            id: ph.id || "",
            label: ph.label || "",
            url: ph.url || "",
            at: ph.at || "",
          }))
        : null,
      attachments: rawDocuments.length
        ? rawDocuments.map((d) => ({
            id: d.id || "",
            type: d.type || "other",
            title: d.title || d.filename || "",
            filename: d.filename || "",
            status: d.status || "active",
            description: d.description || "",
            mimeType: d.mimeType || "",
            size: Number(d.size) || 0,
          }))
        : null,
      updated_at: new Date().toISOString(),
    };

    // null 値の削除（Supabase に無用な NULL UPDATE を送らない）
    Object.keys(row).forEach((k) => {
      if (row[k] === null || row[k] === undefined) delete row[k];
    });

    return row;
  }

  /**
   * nowIso のフォールバック
   */
  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * Supabase client を取得
   */
  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  /**
   * Supabase 接続が利用可能か
   */
  function isSupabaseReady() {
    const mode = global.TasuBuilderProjectStore?.getDataSourceMode?.();
    return mode === "supabase" && Boolean(getClient());
  }

  /**
   * プロジェクト保存（INSERT or UPDATE）
   * await 対応: 呼び出し元はこの Promise を await すること
   *
   * @param {object} project - normalizeProject 済みの案件オブジェクト
   * @returns {Promise<{ ok: boolean, source: string, error?: string }>}
   */
  async function writeProject(project) {
    const id = String(project?.id || "").trim();
    if (!id) {
      console.error("[WriteAdapter] writeProject: missing id");
      return { ok: false, source: "adapter", error: "missing_id" };
    }

    const row = toDdlRow(project);
    const sb = getClient();

    // Step 1: Supabase write（接続あり + mode=supabase の場合のみ）
    if (isSupabaseReady() && sb) {
      try {
        // SELECT で既存行の有無を確認
        const { data: existing } = await sb
          .from("builder_projects")
          .select("id")
          .eq("id", id)
          .limit(1)
          .maybeSingle();

        let result;
        if (existing) {
          // UPDATE
          result = await sb.from("builder_projects").update(row).eq("id", id);
        } else {
          // INSERT（id を指定）
          result = await sb.from("builder_projects").insert({ id, ...row });
        }

        if (result?.error) {
          console.error("[WriteAdapter] Supabase write failed:", result.error.message || result.error);
          return { ok: false, source: "supabase", error: String(result.error.message || result.error) };
        }

        return { ok: true, source: "supabase" };
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        console.error("[WriteAdapter] Supabase write exception:", msg);
        return { ok: false, source: "supabase", error: msg };
      }
    }

    // Step 2: Supabase 未接続時は localStorage のみ
    return { ok: true, source: "local" };
  }

  function isMissingAssignmentColumnError(err) {
    const msg = String(err?.message || err?.code || err || "");
    return /assignment/i.test(msg) && /column|schema cache|42703|PGRST204|does not exist/i.test(msg);
  }

  /**
   * assignment 列の有無をメモ化検出（軽い select · Console を汚さない）
   * @returns {Promise<boolean>}
   */
  async function detectAssignmentColumn() {
    if (assignmentColumnSupported === true) return true;
    if (assignmentColumnSupported === false) return false;

    const sb = getClient();
    if (!sb) {
      assignmentColumnSupported = false;
      return false;
    }
    try {
      const { error } = await sb.from("builder_projects").select("assignment").limit(1);
      if (error) {
        if (isMissingAssignmentColumnError(error)) {
          assignmentColumnSupported = false;
          return false;
        }
        // 一時障害などは未確定のまま skip（次回再試行）
        return false;
      }
      assignmentColumnSupported = true;
      return true;
    } catch {
      return false;
    }
  }

  function toAssignmentJsonb(assignment) {
    const a = assignment && typeof assignment === "object" ? assignment : {};
    const status = String(a.status || "").trim().toLowerCase();
    if (!status && !a.partnerId && !a.partner_id) return null;
    const row = {
      status: status === "accepted" || status === "declined" || status === "pending" ? status : "pending",
      partner_id: String(a.partnerId || a.partner_id || "").trim() || null,
      partner_name: String(a.partnerName || a.partner_name || "").trim() || null,
      partner_user_id: a.partnerUserId || a.partner_user_id || null,
      legacy_project_id: a.legacyProjectId || a.legacy_project_id || null,
      accepted_at: a.acceptedAt || a.accepted_at || null,
      declined_at: a.declinedAt || a.declined_at || null,
      updated_at: a.updatedAt || a.updated_at || new Date().toISOString(),
      source: a.source || "partner_assignment",
    };
    Object.keys(row).forEach((k) => {
      if (row[k] === null || row[k] === undefined || row[k] === "") delete row[k];
    });
    return row;
  }

  /**
   * CAL-MAIN-13: assignment jsonb のみ best-effort UPDATE
   * 列無し / RLS / 未接続は ok:false（呼び出し元は無視）
   *
   * @param {string} projectId
   * @param {object} assignment
   * @returns {Promise<{ ok: boolean, source: string, reason?: string, skipped?: boolean }>}
   */
  async function writeAssignment(projectId, assignment) {
    const id = String(projectId || "").trim();
    if (!id) return { ok: false, source: "adapter", reason: "missing_id", skipped: true };

    const payload = toAssignmentJsonb(assignment);
    if (!payload) return { ok: false, source: "adapter", reason: "empty_assignment", skipped: true };

    const sb = getClient();
    if (!sb) return { ok: false, source: "local", reason: "no_client", skipped: true };

    const supported = await detectAssignmentColumn();
    if (!supported) {
      return { ok: false, source: "supabase", reason: "column_unsupported", skipped: true };
    }

    try {
      // .select() で更新行を返す — RLS で 0 行のときも error 無しになり得るため明示チェック
      const result = await sb
        .from("builder_projects")
        .update({ assignment: payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, assignment");

      if (result?.error) {
        if (isMissingAssignmentColumnError(result.error)) {
          assignmentColumnSupported = false;
          return { ok: false, source: "supabase", reason: "column_unsupported", skipped: true };
        }
        // RLS / その他 — Console Error なし
        return {
          ok: false,
          source: "supabase",
          reason: String(result.error.message || result.error.code || "update_failed"),
          skipped: false,
        };
      }
      const updated = Array.isArray(result?.data) ? result.data : [];
      if (!updated.length) {
        return {
          ok: false,
          source: "supabase",
          reason: "no_row_updated",
          skipped: false,
        };
      }
      return { ok: true, source: "supabase", assignment: updated[0]?.assignment || payload };
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (isMissingAssignmentColumnError(err)) {
        assignmentColumnSupported = false;
        return { ok: false, source: "supabase", reason: "column_unsupported", skipped: true };
      }
      return { ok: false, source: "supabase", reason: msg, skipped: false };
    }
  }

  function resetAssignmentColumnCacheForTests() {
    assignmentColumnSupported = null;
  }

  function setAssignmentColumnSupportedForTests(value) {
    assignmentColumnSupported = value === true ? true : value === false ? false : null;
  }

  /**
   * 保存結果を統一的に返す
   * Supabase 成功時 → source="supabase"
   * Supabase 未接続時 → source="local"
   * Supabase 失敗時 → source="supabase", ok=false
   */
  global.TasuBuilderProjectWriteAdapter = {
    VERSION,
    toDdlRow,
    toAssignmentJsonb,
    isSupabaseReady,
    writeProject,
    writeAssignment,
    detectAssignmentColumn,
    resetAssignmentColumnCacheForTests,
    setAssignmentColumnSupportedForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);