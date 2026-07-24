/**
 * Builder B3 — Supabase repository implementations (P0-01)
 * Direct client CRUD for general jobs · enabled when config + flag
 */
(function (global) {
  "use strict";

  const VERSION = "b3-supabase-p0-01";
  const TABLE_PROJECTS = "builder_projects";
  const TABLE_APPLICATIONS = "builder_project_applications";
  const TABLE_PARTNERS = "builder_partners";

  const Mapper = () => global.TasuBuilderGeneralMapper || {};
  const Session = () => global.TasuBuilderSession || {};
  const Repo = () => global.TasuBuilderRepository || {};

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isEnabled() {
    return global.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.() === true && Boolean(getClient());
  }

  function authRequired() {
    const uid = Session().getAuthUserId?.();
    if (!uid) return Repo().fail?.("auth_required", "authenticated user required") || { ok: false };
    return null;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  const projectRepo = {
    isEnabled,
    async createGeneralProject(input) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");

      const map = Mapper();
      const authUserId = Session().resolveOwnerIdForInsert?.(input?.owner_id);
      const projectKey = input?.project_id || `proj-${Date.now().toString(36)}`;
      const row = map.toGeneralProjectRow?.(input, { authUserId, projectKey });
      if (!row?.owner_id) return Repo().fail?.("owner_id_missing", "owner_id required for RLS");

      const { data, error } = await client.from(TABLE_PROJECTS).insert(row).select("*").single();
      if (error) return Repo().fail?.("supabase_insert_failed", error.message, { code: error.code });
      const item = map.fromGeneralProjectRow?.(data);
      return Repo().ok(item, { source: "supabase", projectKey, owner_id: row.owner_id });
    },

    async listGeneralProjects(filters) {
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");

      const f = filters && typeof filters === "object" ? filters : {};
      let q = client.from(TABLE_PROJECTS).select("*").eq("kind", "builder_board");
      if (f.board_type) q = q.eq("board_type", f.board_type);
      if (f.owner_id) q = q.eq("owner_id", f.owner_id);
      if (f.visibility) q = q.eq("visibility", f.visibility);
      q = q.order("created_at", { ascending: false });

      const { data, error } = await q;
      if (error) return Repo().fail?.("supabase_select_failed", error.message, { code: error.code });
      const map = Mapper();
      const items = (data || []).map((row) => map.fromGeneralProjectRow?.(row));
      return Repo().ok(items, { source: "supabase", count: items.length });
    },

    async getGeneralProjectById(id) {
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");
      const key = String(id || "").trim();
      if (!key) return Repo().fail?.("invalid_id", "id required");

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      let q = client.from(TABLE_PROJECTS).select("*").limit(1);
      q = isUuid ? q.eq("id", key) : q.eq("project_key", key);

      const { data, error } = await q.maybeSingle();
      if (error) return Repo().fail?.("supabase_select_failed", error.message, { code: error.code });
      if (!data) return Repo().fail?.("not_found", "project not found", { id: key });
      const item = Mapper().fromGeneralProjectRow?.(data);
      return Repo().ok(item, { source: "supabase" });
    },

    async updateGeneralProjectStatus(id, status, patch) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const got = await projectRepo.getGeneralProjectById(id);
      if (!got?.ok) return got;

      const client = getClient();
      const uuid = got.data.uuid || got.data.id;
      const body = {
        status: String(status || got.data.status),
        updated_at: new Date().toISOString(),
        ...(patch && typeof patch === "object" ? patch : {}),
      };
      const { data, error } = await client
        .from(TABLE_PROJECTS)
        .update(body)
        .eq("id", uuid)
        .select("*")
        .single();
      if (error) return Repo().fail?.("supabase_update_failed", error.message, { code: error.code });
      return Repo().ok(Mapper().fromGeneralProjectRow?.(data), { source: "supabase" });
    },

    async updateGeneralProjectTalkRoomId(id, talkRoomId) {
      const rid = pickStr(talkRoomId);
      if (!rid) return Repo().fail?.("talk_room_id_missing", "talk_room_id required");
      const got = await projectRepo.getGeneralProjectById(id);
      if (!got?.ok) return got;
      return projectRepo.updateGeneralProjectStatus(id, got.data.status, {
        talk_room_id: rid,
        talk_thread_id: rid,
      });
    },

    async updateGeneralProject(id, project, spec) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const got = await projectRepo.getGeneralProjectById(id);
      if (!got?.ok) return got;

      const p = project && typeof project === "object" ? project : {};
      const sp = spec && typeof spec === "object" ? spec : {};
      const period = sp.period && typeof sp.period === "object" ? sp.period : {};
      const map = Mapper();
      const partial = map.toGeneralProjectRow?.(
        { ...got.data, ...p, spec: sp },
        { authUserId: got.data.owner_id, projectKey: got.data.project_id }
      );
      const body = {
        title: partial.title,
        visibility: partial.visibility,
        contact_policy: partial.contact_policy,
        project_category: partial.project_category,
        schedule_start: pickStr(period.start) || partial.schedule_start || null,
        schedule_end: pickStr(period.end) || partial.schedule_end || null,
        spec: partial.spec,
        updated_at: new Date().toISOString(),
      };

      const client = getClient();
      const uuid = got.data.uuid || got.data.id;
      const { data, error } = await client
        .from(TABLE_PROJECTS)
        .update(body)
        .eq("id", uuid)
        .select("*")
        .single();
      if (error) return Repo().fail?.("supabase_update_failed", error.message, { code: error.code });
      return Repo().ok(map.fromGeneralProjectRow?.(data), { source: "supabase" });
    },

    async ensureTalkRoomForGeneralProject(id, context) {
      const got = await projectRepo.getGeneralProjectById(id);
      if (!got?.ok) return got;
      const talk = global.TasuBuilderProjectTalkRoom;
      if (!talk?.ensureTalkRoomForGeneralProject) {
        return Repo().fail?.("talk_room_unavailable", "Talk room module not loaded");
      }
      const ctx = context && typeof context === "object" ? context : {};
      try {
        const room = await talk.ensureTalkRoomForGeneralProject({
          projectUuid: got.data.uuid || got.data.id,
          projectKey: got.data.project_id,
          ownerAuthUid: got.data.owner_id,
          applicantAuthUid: pickStr(ctx.applicantAuthUid),
          applicantName: pickStr(ctx.applicantName),
          title: got.data.title,
          talkRoomId: got.data.talk_room_id,
        });
        const talkRoomId = pickStr(room?.roomId);
        if (!room?.ok || !talkRoomId) {
          return Repo().fail?.("talk_room_empty", room?.reason || "no room id returned");
        }
        const updated = await projectRepo.updateGeneralProjectTalkRoomId(id, talkRoomId);
        if (!updated?.ok) return updated;
        return Repo().ok(updated.data, {
          source: "supabase",
          talkRoomId,
          mode: room.mode,
          reused: room.reused,
        });
      } catch (e) {
        return Repo().fail?.("talk_room_error", String(e?.message || e));
      }
    },
  };

  const applicationRepo = {
    isEnabled,
    async lookupPartnerByKey(partnerKey) {
      const client = getClient();
      const key = pickStr(partnerKey);
      if (!client || !key) return null;
      const { data, error } = await client
        .from(TABLE_PARTNERS)
        .select("id,partner_key,display_name,status")
        .eq("partner_key", key)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },

    async createApplication(input) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");

      const map = Mapper();
      const partnerKey = input?.partner_id || input?.partner_key;
      const authUserId = Session().getAuthUserId?.();
      const applicationKey = input?.application_id || `app-${Date.now().toString(36)}`;

      let projectUuid = input?.project_uuid || "";
      if (!projectUuid && input?.project_id) {
        const proj = await projectRepo.getGeneralProjectById(input.project_id);
        if (proj?.ok) projectUuid = proj.data.uuid || proj.data.id;
      }
      if (!projectUuid) return Repo().fail?.("project_uuid_required", "project uuid required for applications");

      let partnerUuid = input?.partner_uuid || null;
      if (!partnerUuid && partnerKey) {
        const partnerRow = await applicationRepo.lookupPartnerByKey(partnerKey);
        if (partnerRow?.id) partnerUuid = partnerRow.id;
      }

      const row = map.toApplicationRow?.(input, {
        authUserId,
        applicationKey,
        projectUuid,
        partnerKey,
        partnerUuid,
      });
      if (partnerUuid) row.partner_id = partnerUuid;
      if (!row?.applicant_auth_uid) {
        return Repo().fail?.("applicant_auth_uid_missing", "applicant_auth_uid required for RLS");
      }

      const { data, error } = await client.from(TABLE_APPLICATIONS).insert(row).select("*").single();
      if (error) return Repo().fail?.("supabase_insert_failed", error.message, { code: error.code });
      return Repo().ok(map.fromApplicationRow?.(data), { source: "supabase", owner_id: row.applicant_auth_uid });
    },

    async listApplicationsByProject(projectId) {
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");

      let projectUuid = String(projectId || "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectUuid);
      if (!isUuid) {
        const proj = await projectRepo.getGeneralProjectById(projectUuid);
        if (!proj?.ok) return proj;
        projectUuid = proj.data.uuid;
      }

      const { data, error } = await client
        .from(TABLE_APPLICATIONS)
        .select("*")
        .eq("project_id", projectUuid)
        .order("applied_at", { ascending: false });
      if (error) return Repo().fail?.("supabase_select_failed", error.message, { code: error.code });
      const map = Mapper();
      const items = (data || []).map((row) => map.fromApplicationRow?.(row));
      return Repo().ok(items, { source: "supabase", count: items.length });
    },

    async listApplicationsByUser(applicantAuthUid) {
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");
      const uid = String(applicantAuthUid || Session().getAuthUserId?.() || "").trim();
      if (!uid) return Repo().fail?.("applicant_required", "applicant auth uid required");

      const { data, error } = await client
        .from(TABLE_APPLICATIONS)
        .select("*")
        .eq("applicant_auth_uid", uid)
        .order("applied_at", { ascending: false });
      if (error) return Repo().fail?.("supabase_select_failed", error.message, { code: error.code });
      const items = (data || []).map((row) => Mapper().fromApplicationRow?.(row));
      return Repo().ok(items, { source: "supabase", count: items.length });
    },

    async updateApplicationStatus(applicationId, status, patch) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const client = getClient();
      const key = String(applicationId || "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

      const body = {
        status: String(status),
        updated_at: new Date().toISOString(),
        ...(patch && typeof patch === "object" ? patch : {}),
      };
      let q = client.from(TABLE_APPLICATIONS).update(body);
      q = isUuid ? q.eq("id", key) : q.eq("application_key", key);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) return Repo().fail?.("supabase_update_failed", error.message, { code: error.code });
      if (!data) return Repo().fail?.("not_found", "application not found");
      return Repo().ok(Mapper().fromApplicationRow?.(data), { source: "supabase" });
    },

    async selectApplication(applicationId) {
      return applicationRepo.updateApplicationStatus(applicationId, "selected");
    },

    async rejectApplication(applicationId) {
      return applicationRepo.updateApplicationStatus(applicationId, "rejected");
    },

    async updateApplicationTalkRoomId(applicationId, talkRoomId, existingPayload) {
      const rid = pickStr(talkRoomId);
      if (!rid) return Repo().fail?.("talk_room_id_missing", "talk_room_id required");
      const payload = {
        ...(existingPayload && typeof existingPayload === "object" ? existingPayload : {}),
        talk_room_id: rid,
      };
      return applicationRepo.updateApplicationStatus(applicationId, "selected", { payload });
    },

    async deleteApplication(applicationId) {
      const authErr = authRequired();
      if (authErr) return authErr;
      const client = getClient();
      if (!client) return Repo().fail?.("no_client", "Supabase client unavailable");
      const key = String(applicationId || "").trim();
      if (!key) return Repo().fail?.("invalid_id", "application id required");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      let q = client.from(TABLE_APPLICATIONS).delete();
      q = isUuid ? q.eq("id", key) : q.eq("application_key", key);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) return Repo().fail?.("supabase_delete_failed", error.message, { code: error.code });
      if (!data) return Repo().fail?.("not_found", "application not found");
      return Repo().ok(Mapper().fromApplicationRow?.(data), { source: "supabase", deleted: true });
    },
  };

  global.TasuBuilderRepositoriesSupabase = {
    VERSION,
    isEnabled,
    project: projectRepo,
    application: applicationRepo,
  };
})(typeof window !== "undefined" ? window : globalThis);
