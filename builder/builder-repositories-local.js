/**
 * Builder B3 — local (MVP fallback) repository (P0-01)
 * Mirrors MVP state shape · dedicated LS for tests · bridge hook for P0-02
 */
(function (global) {
  "use strict";

  const VERSION = "b3-local-p0-01";
  const LS_PROJECTS = "tasful:builder:b3:general:projects:v1";
  const LS_APPLICATIONS = "tasful:builder:b3:general:applications:v1";
  const Mapper = () => global.TasuBuilderGeneralMapper || {};
  const Session = () => global.TasuBuilderSession || {};

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function uid(prefix) {
    return `${prefix || "id"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isEnabled() {
    return true;
  }

  function loadProjects() {
    return readJson(LS_PROJECTS, { items: [] });
  }

  function saveProjects(state) {
    writeJson(LS_PROJECTS, state);
    return state;
  }

  function loadApplications() {
    return readJson(LS_APPLICATIONS, { items: [] });
  }

  function saveApplications(state) {
    writeJson(LS_APPLICATIONS, state);
    return state;
  }

  const projectRepo = {
    isEnabled,
    async createGeneralProject(input) {
      const map = Mapper();
      const authUserId = Session().resolveOwnerIdForInsert?.(input?.owner_id);
      const projectKey = input?.project_id || uid("proj");
      const row = map.toGeneralProjectRow?.(input, { authUserId, projectKey }) || input;
      const item = map.fromGeneralProjectRow?.({
        ...row,
        id: projectKey,
        project_key: projectKey,
      });
      const state = loadProjects();
      state.items = [item, ...(state.items || [])];
      saveProjects(state);
      return global.TasuBuilderRepository?.ok?.(item, { source: "mvp_local", projectKey }) || { ok: true, data: item };
    },

    async listGeneralProjects(filters) {
      const f = filters && typeof filters === "object" ? filters : {};
      let items = (loadProjects().items || []).slice();
      if (f.kind) items = items.filter((p) => p.kind === f.kind);
      if (f.board_type) items = items.filter((p) => p.board_type === f.board_type);
      if (f.owner_id) items = items.filter((p) => p.owner_id === f.owner_id);
      return global.TasuBuilderRepository?.ok?.(items, { source: "mvp_local", count: items.length }) || { ok: true, data: items };
    },

    async getGeneralProjectById(id) {
      const key = String(id || "").trim();
      const item = (loadProjects().items || []).find(
        (p) => p.id === key || p.project_id === key || p.uuid === key
      );
      if (!item) {
        return global.TasuBuilderRepository?.fail?.("not_found", "project not found", { id: key }) || { ok: false };
      }
      return global.TasuBuilderRepository?.ok?.(item, { source: "mvp_local" }) || { ok: true, data: item };
    },

    async updateGeneralProjectStatus(id, status, patch) {
      const key = String(id || "").trim();
      const state = loadProjects();
      const idx = (state.items || []).findIndex(
        (p) => p.id === key || p.project_id === key || p.uuid === key
      );
      if (idx < 0) {
        return global.TasuBuilderRepository?.fail?.("not_found", "project not found", { id: key }) || { ok: false };
      }
      state.items[idx] = {
        ...state.items[idx],
        status: String(status || state.items[idx].status),
        ...(patch && typeof patch === "object" ? patch : {}),
        updated_at: new Date().toISOString(),
      };
      saveProjects(state);
      return global.TasuBuilderRepository?.ok?.(state.items[idx], { source: "mvp_local" }) || { ok: true, data: state.items[idx] };
    },

    async ensureTalkRoomForGeneralProject(id, context) {
      const res = await projectRepo.getGeneralProjectById(id);
      if (!res?.ok) return res;
      const talk = global.TasuBuilderProjectTalkRoom;
      if (!talk?.ensureTalkRoomForGeneralProject) {
        return global.TasuBuilderRepository?.fail?.("talk_room_unavailable", "Talk room module not loaded") || { ok: false };
      }
      const ctx = context && typeof context === "object" ? context : {};
      try {
        const room = await talk.ensureTalkRoomForGeneralProject({
          projectUuid: res.data.uuid || res.data.id,
          projectKey: res.data.project_id,
          ownerAuthUid: res.data.owner_id,
          applicantAuthUid: ctx.applicantAuthUid,
          title: res.data.title,
          talkRoomId: res.data.talk_room_id,
        });
        const talkRoomId = String(room?.roomId || "").trim();
        if (!room?.ok || !talkRoomId) {
          return global.TasuBuilderRepository?.fail?.("talk_room_empty", room?.reason || "no room id") || { ok: false };
        }
        return projectRepo.updateGeneralProjectTalkRoomId(id, talkRoomId);
      } catch (e) {
        return global.TasuBuilderRepository?.fail?.("talk_room_error", String(e?.message || e)) || { ok: false };
      }
    },

    async updateGeneralProjectTalkRoomId(id, talkRoomId) {
      const rid = String(talkRoomId || "").trim();
      if (!rid) {
        return global.TasuBuilderRepository?.fail?.("talk_room_id_missing", "talk_room_id required") || { ok: false };
      }
      const got = await projectRepo.getGeneralProjectById(id);
      if (!got?.ok) return got;
      return projectRepo.updateGeneralProjectStatus(id, got.data.status, {
        talk_room_id: rid,
        talk_thread_id: rid,
      });
    },
  };

  const applicationRepo = {
    isEnabled,
    async lookupPartnerByKey(partnerKey) {
      const key = String(partnerKey || "").trim();
      if (!key) return null;
      const demo = [
        { id: "a1000000-0000-4000-8000-000000000001", partner_key: "demo-partner-001", display_name: "デモ協力会社" },
        { id: "a1000000-0000-4000-8000-000000000004", partner_key: "demo-partner-e2e-p05", display_name: "E2E P05 Partner" },
      ];
      return demo.find((p) => p.partner_key === key) || null;
    },

    async createApplication(input) {
      const map = Mapper();
      const partnerKey = input?.partner_id || input?.partner_key;
      const authUserId = Session().getApplicantAuthUid?.(partnerKey);
      const applicationKey = input?.application_id || uid("app");
      const projectUuid = input?.project_uuid || input?.project_id;
      const row = map.toApplicationRow?.(input, {
        authUserId,
        applicationKey,
        projectUuid,
        partnerKey,
      });
      const item = map.fromApplicationRow?.({
        ...row,
        id: applicationKey,
        application_key: applicationKey,
      });
      const state = loadApplications();
      const dup = (state.items || []).some(
        (a) =>
          a.project_id === item.project_id &&
          (a.applicant_auth_uid === item.applicant_auth_uid || a.partner_id === item.partner_id)
      );
      if (dup) {
        return global.TasuBuilderRepository?.fail?.("duplicate_application", "already applied") || { ok: false };
      }
      state.items = [item, ...(state.items || [])];
      saveApplications(state);
      return global.TasuBuilderRepository?.ok?.(item, { source: "mvp_local", applicationKey }) || { ok: true, data: item };
    },

    async listApplicationsByProject(projectId) {
      const key = String(projectId || "").trim();
      const items = (loadApplications().items || []).filter((a) => a.project_id === key);
      return global.TasuBuilderRepository?.ok?.(items, { source: "mvp_local", count: items.length }) || { ok: true, data: items };
    },

    async listApplicationsByUser(applicantAuthUid) {
      const uidKey = String(applicantAuthUid || Session().getAuthUserId?.() || "").trim();
      const items = (loadApplications().items || []).filter((a) => a.applicant_auth_uid === uidKey);
      return global.TasuBuilderRepository?.ok?.(items, { source: "mvp_local", count: items.length }) || { ok: true, data: items };
    },

    async updateApplicationStatus(applicationId, status, patch) {
      const key = String(applicationId || "").trim();
      const state = loadApplications();
      const idx = (state.items || []).findIndex(
        (a) => a.id === key || a.application_id === key
      );
      if (idx < 0) {
        return global.TasuBuilderRepository?.fail?.("not_found", "application not found") || { ok: false };
      }
      state.items[idx] = {
        ...state.items[idx],
        status: String(status || state.items[idx].status),
        ...(patch && typeof patch === "object" ? patch : {}),
        updated_at: new Date().toISOString(),
      };
      saveApplications(state);
      return global.TasuBuilderRepository?.ok?.(state.items[idx], { source: "mvp_local" }) || { ok: true, data: state.items[idx] };
    },

    async selectApplication(applicationId) {
      return applicationRepo.updateApplicationStatus(applicationId, "selected");
    },

    async rejectApplication(applicationId) {
      return applicationRepo.updateApplicationStatus(applicationId, "rejected");
    },

    async updateApplicationTalkRoomId(applicationId, talkRoomId, existingPayload) {
      const rid = String(talkRoomId || "").trim();
      if (!rid) {
        return global.TasuBuilderRepository?.fail?.("talk_room_id_missing", "talk_room_id required") || { ok: false };
      }
      const payload = {
        ...(existingPayload && typeof existingPayload === "object" ? existingPayload : {}),
        talk_room_id: rid,
      };
      return applicationRepo.updateApplicationStatus(applicationId, "selected", { payload });
    },

    async deleteApplication(applicationId) {
      const key = String(applicationId || "").trim();
      const state = loadApplications();
      const idx = (state.items || []).findIndex(
        (a) => a.id === key || a.application_id === key || a.application_key === key
      );
      if (idx < 0) {
        return global.TasuBuilderRepository?.fail?.("not_found", "application not found") || { ok: false };
      }
      const removed = state.items[idx];
      state.items = state.items.filter((_, i) => i !== idx);
      saveApplications(state);
      return global.TasuBuilderRepository?.ok?.(removed, { source: "mvp_local", deleted: true }) || { ok: true, data: removed };
    },
  };

  global.TasuBuilderRepositoriesLocal = {
    VERSION,
    isEnabled,
    project: projectRepo,
    application: applicationRepo,
    _testKeys: { LS_PROJECTS, LS_APPLICATIONS },
  };
})(typeof window !== "undefined" ? window : globalThis);
