/**
 * Builder AI — MVP コンテキスト読取・権限スコープ
 */
(function (global) {
  "use strict";

  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";
  const MVP_ROLE_KEY = "tasful:builder:mvp:role";
  const MVP_PARTNER_ID_KEY = "tasful:builder:mvp:partner_id";
  const DEFAULT_OWNER_ID = "demo-owner-001";

  function trim(s, max) {
    return String(s || "")
      .trim()
      .slice(0, max || 2000);
  }

  function loadMvpState() {
    try {
      const raw = global.localStorage?.getItem(MVP_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return state && typeof state === "object" ? state : null;
    } catch {
      return null;
    }
  }

  function normalizeActorType(raw) {
    const r = String(raw || "")
      .trim()
      .toLowerCase();
    if (r === "admin") return "admin";
    if (r === "partner") return "partner";
    if (r === "owner" || r === "client") return "owner";
    if (r === "guest") return "guest";
    if (r === "user" || r === "builder") return "owner";
    return "guest";
  }

  /**
   * @param {{ role?: string, actorType?: string, actorId?: string, partnerId?: string }} [options]
   */
  function resolveActor(options) {
    const opts = options && typeof options === "object" ? options : {};
    let role = opts.actorType || opts.role || "";
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (!role) role = params.get("role") || params.get("actor_type") || "";
      if (!role) role = global.sessionStorage?.getItem("tasful:builder:mvp:session:role") || "";
      if (!role) role = global.localStorage?.getItem(MVP_ROLE_KEY) || "";
    } catch {
      /* ignore */
    }
    const actorType = normalizeActorType(role || opts.actorType || "guest");
    let partnerId = trim(opts.partnerId || "", 120);
    try {
      if (!partnerId) {
        const params = new URLSearchParams(global.location?.search || "");
        partnerId = trim(params.get("partnerId") || params.get("partner_id") || "", 120);
      }
      if (!partnerId) partnerId = trim(global.localStorage?.getItem(MVP_PARTNER_ID_KEY) || "", 120);
    } catch {
      /* ignore */
    }
    const state = loadMvpState();
    const ownerId = trim(state?.owner_id || DEFAULT_OWNER_ID, 120);
    const actorId =
      actorType === "partner"
        ? partnerId || "partner-unknown"
        : actorType === "owner"
          ? ownerId
          : actorType === "admin"
            ? trim(opts.actorId || "admin", 120)
            : "guest";

    return {
      actorType,
      actorId,
      ownerId,
      partnerId: partnerId || "",
      label:
        actorType === "admin"
          ? "運営"
          : actorType === "partner"
            ? "協力会社"
            : actorType === "owner"
              ? "依頼元"
              : "ゲスト",
    };
  }

  function findProject(state, projectId) {
    const id = trim(projectId, 120);
    if (!state || !id) return null;
    return (state.projects || []).find((p) => p?.project_id === id) || null;
  }

  function partnerRelatedToProject(state, project, partnerId) {
    const pid = trim(partnerId, 120);
    if (!pid || !project) return false;
    const selected = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selected.includes(pid)) return true;
    if (trim(project.calendar_assigned_partner_id, 120) === pid) return true;
    return (state.applications || []).some(
      (a) => a?.project_id === project.project_id && a?.partner_id === pid
    );
  }

  /**
   * @param {{ actorType: string, actorId?: string, ownerId?: string, partnerId?: string }} actor
   * @param {string} projectId
   * @param {object|null} state
   */
  function canAccessProject(actor, projectId, state) {
    const project = findProject(state, projectId);
    if (!project) return { ok: false, reason: "project_not_found", project: null };
    const type = normalizeActorType(actor?.actorType);
    if (type === "admin") return { ok: true, reason: "", project };
    if (type === "guest") return { ok: false, reason: "guest_no_project", project: null };
    if (type === "owner") {
      const ownerId = trim(actor?.ownerId || actor?.actorId || DEFAULT_OWNER_ID, 120);
      if (trim(project.owner_id, 120) === ownerId) return { ok: true, reason: "", project };
      return { ok: false, reason: "owner_scope", project: null };
    }
    if (type === "partner") {
      const pid = trim(actor?.partnerId || actor?.actorId, 120);
      if (partnerRelatedToProject(state, project, pid)) return { ok: true, reason: "", project };
      return { ok: false, reason: "partner_scope", project: null };
    }
    return { ok: false, reason: "unknown_actor", project: null };
  }

  function summarizeSpec(spec, actorType) {
    if (!spec || typeof spec !== "object") return "";
    const lines = [];
    if (spec.work_content) lines.push(`作業内容: ${trim(spec.work_content, 400)}`);
    if (spec.description) lines.push(`概要: ${trim(spec.description, 300)}`);
    if (spec.site_address) lines.push(`現場: ${trim(spec.site_address, 120)}`);
    const budget = spec.budget;
    if (budget && (budget.min || budget.max)) {
      lines.push(`予算目安: ${budget.min || "—"} 〜 ${budget.max || "—"}`);
    }
    if (spec.schedule_summary) lines.push(`工程要約: ${trim(spec.schedule_summary, 300)}`);
    if (spec.builder_summary && actorType === "admin") {
      lines.push(`運営メモ: ${trim(spec.builder_summary, 200)}`);
    }
    return lines.join("\n");
  }

  function summarizeThread(state, project, actorType) {
    const threadId = project?.main_thread_id;
    if (!threadId) return "";
    const thread = state?.threads?.[threadId];
    if (!thread) return "";
    const lines = [`スレッド状態: ${trim(thread.status, 40)}`];
    const msgs = (thread.messages || []).slice(-3);
    msgs.forEach((m, i) => {
      const who = trim(m?.from?.name || m?.from?.type || "unknown", 40);
      lines.push(`直近メッセージ${i + 1}(${who}): ${trim(m?.text, 160)}`);
    });
    if (actorType !== "guest" && thread.completion_submission?.status) {
      lines.push(`完了提出: ${trim(thread.completion_submission.status, 40)}`);
    }
    return lines.join("\n");
  }

  function summarizeApplications(state, project, actorType, actor) {
    const apps = (state?.applications || []).filter((a) => a?.project_id === project?.project_id);
    if (!apps.length) return "";
    if (actorType === "partner") {
      const mine = apps.find((a) => a.partner_id === actor.partnerId);
      if (!mine) return "応募: 未応募";
      return `自応募状態: ${trim(mine.status, 20)}`;
    }
    if (actorType === "owner" || actorType === "admin") {
      return `応募数: ${apps.length} / 採用済: ${apps.filter((a) => a.status === "selected").length}`;
    }
    return "";
  }

  /**
   * @param {string} projectId
   * @param {{ actorType: string, actorId?: string, ownerId?: string, partnerId?: string }} actor
   * @param {object|null} [stateIn]
   */
  function buildProjectContext(projectId, actor, stateIn) {
    const state = stateIn || loadMvpState();
    const access = canAccessProject(actor, projectId, state);
    if (!access.ok) {
      return { ok: false, reason: access.reason, text: "", project: null };
    }
    const project = access.project;
    const spec = state?.specs?.[project.project_id] || {};
    const actorType = normalizeActorType(actor?.actorType);
    const parts = [
      `案件ID: ${project.project_id}`,
      `タイトル: ${trim(project.title, 120)}`,
      `ステータス: ${trim(project.status, 40)}`,
      `種別: ${trim(project.kind, 40)}`,
    ];
    const specText = summarizeSpec(spec, actorType);
    if (specText) parts.push("", specText);
    const appText = summarizeApplications(state, project, actorType, actor);
    if (appText) parts.push(appText);
    const threadText = summarizeThread(state, project, actorType);
    if (threadText) parts.push("", threadText);
    return { ok: true, reason: "", text: parts.join("\n"), project };
  }

  function listAccessibleProjects(actor, stateIn) {
    const state = stateIn || loadMvpState();
    if (!state) return [];
    const type = normalizeActorType(actor?.actorType);
    const projects = Array.isArray(state.projects) ? state.projects : [];
    if (type === "admin") {
      return projects.map((p) => ({ id: p.project_id, title: trim(p.title, 80) }));
    }
    if (type === "guest") return [];
    if (type === "owner") {
      const ownerId = trim(actor?.ownerId || DEFAULT_OWNER_ID, 120);
      return projects
        .filter((p) => trim(p.owner_id, 120) === ownerId)
        .map((p) => ({ id: p.project_id, title: trim(p.title, 80) }));
    }
    if (type === "partner") {
      const pid = trim(actor?.partnerId, 120);
      return projects
        .filter((p) => partnerRelatedToProject(state, p, pid))
        .map((p) => ({ id: p.project_id, title: trim(p.title, 80) }));
    }
    return [];
  }

  global.TasuBuilderAIContext = {
    MVP_STORAGE_KEY,
    loadMvpState,
    resolveActor,
    normalizeActorType,
    canAccessProject,
    buildProjectContext,
    listAccessibleProjects,
    findProject,
  };
})(typeof window !== "undefined" ? window : globalThis);
