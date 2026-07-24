/**
 * Builder General Jobs P0-02 — Supabase primary + MVP mirror dual-write
 *
 * Flag OFF  → MVP only (legacy)
 * Flag ON   → Supabase first · success → MVP mirror · fail → MVP fallback
 */
(function (global) {
  "use strict";

  const VERSION = "p3-withdraw-delete-mirror";
  const LOG = "[BuilderGeneralDualWrite]";

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

  function isRepositoryActive() {
    return global.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.() === true;
  }

  function projectRepo() {
    return global.TasuBuilderProjectRepository || null;
  }

  function applicationRepo() {
    return global.TasuBuilderApplicationRepository || null;
  }

  function resolveOwnerId(explicit) {
    return global.TasuBuilderSession?.resolveOwnerIdForInsert?.(explicit) || pickStr(explicit) || "demo-owner-001";
  }

  function resolveApplicantAuthUid(partnerId) {
    return global.TasuBuilderSession?.getApplicantAuthUid?.(partnerId) || global.TasuBuilderSession?.getAuthUserId?.() || "";
  }

  function isGeneralBoardProject(project) {
    if (!project || typeof project !== "object") return false;
    const kind = pickStr(project.kind);
    if (kind === "builder_board") return true;
    return pickStr(project.board_type, project.boardType) === "project" || pickStr(project.board_type) === "worker";
  }

  /**
   * 投稿: Supabase primary → MVP mirror
   */
  async function createProjectWithMirror({ project, spec, api }) {
    const p = project && typeof project === "object" ? project : {};
    const ownerId = resolveOwnerId(p.owner_id);
    const enriched = {
      ...p,
      owner_id: ownerId,
      owner_auth_uid: ownerId,
      kind: "builder_board",
      project_category: "general",
      board_type: pickStr(p.board_type, p.boardType) || "project",
      spec: spec && typeof spec === "object" ? spec : {},
    };

    let supabaseOk = false;
    let supabaseData = null;

    if (isRepositoryActive()) {
      try {
        const res = await projectRepo()?.createGeneralProject?.(enriched);
        if (res?.ok && res.data) {
          supabaseOk = true;
          supabaseData = res.data;
        } else {
          console.warn(LOG, "createGeneralProject failed:", res?.message || res?.code || "unknown");
        }
      } catch (err) {
        console.warn(LOG, "createGeneralProject error:", err);
      }
    }

    const mirrored = {
      ...p,
      owner_id: ownerId,
      owner_auth_uid: ownerId,
      kind: "builder_board",
      project_category: p.project_category || enriched.project_category,
    };
    if (supabaseOk && supabaseData) {
      const uuid = pickStr(supabaseData.uuid, supabaseData.id);
      if (uuid) {
        mirrored.supabase_uuid = uuid;
        mirrored.project_uuid = uuid;
      }
    }

    const next = api.reload();
    next.projects = [mirrored, ...(next.projects || [])];
    next.specs = { ...(next.specs || {}), [p.project_id]: spec || {} };
    api.commit(next, { project: mirrored, mode: "create" });

    return {
      ok: true,
      project: mirrored,
      supabaseOk,
      fallback: isRepositoryActive() && !supabaseOk,
      source: supabaseOk ? "supabase+mirror" : isRepositoryActive() ? "mvp_fallback" : "mvp_only",
    };
  }

  /**
   * 応募: Supabase primary → MVP mirror
   */
  async function applyWithMirror({ api, projectId, partnerId, project, typeCfg, message, payload }) {
    const pid = pickStr(projectId);
    const myPartnerId = pickStr(partnerId);
    if (!pid || !myPartnerId || !project) return false;

    const applicationId = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const applicantAuthUid = resolveApplicantAuthUid(myPartnerId);
    const applicationRow = {
      application_id: applicationId,
      project_id: pid,
      partner_id: myPartnerId,
      applicant_auth_uid: applicantAuthUid,
      status: "applied",
      ts: nowIso(),
      message: pickStr(message) || null,
      payload: {
        ...(payload && typeof payload === "object" ? payload : {}),
        display_status: "pending",
        applicant_role: pickStr(payload?.applicant_role, "partner"),
      },
    };

    let supabaseOk = false;

    if (isRepositoryActive() && isGeneralBoardProject(project)) {
      try {
        const res = await applicationRepo()?.createApplication?.({
          ...applicationRow,
          project_uuid: pickStr(project.supabase_uuid, project.project_uuid),
        });
        if (res?.ok) {
          supabaseOk = true;
          if (res.data?.application_id) applicationRow.application_id = res.data.application_id;
          if (res.data?.id) applicationRow.supabase_application_id = res.data.id;
        } else {
          console.warn(LOG, "createApplication failed:", res?.message || res?.code || "unknown");
        }
      } catch (err) {
        console.warn(LOG, "createApplication error:", err);
      }
    }

    const next = api.reload();
    const dup = (next.applications || []).some(
      (a) => a.project_id === pid && a.partner_id === myPartnerId
    );
    if (dup) return false;

    next.withdrawn_board_applications = (next.withdrawn_board_applications || []).filter(
      (w) => withdrawKey(w.project_id, w.partner_id) !== withdrawKey(pid, myPartnerId)
    );

    next.applications = [...(next.applications || []), applicationRow];
    api.commit(next);

    const cfg = typeCfg || {};
    api.pushNotification({
      type: "application",
      body:
        cfg.type === "worker"
          ? `${project.title || pid} に依頼がありました。`
          : `案件に応募がありました（${project.title || pid}）`,
      project_id: pid,
      thread_id: null,
    });

    if (isRepositoryActive() && !supabaseOk) {
      console.warn(LOG, "apply MVP fallback", { project_id: pid, partner_id: myPartnerId });
    }
    global.TasuBuilderBoardAdapter?.clearApplicationsCache?.(pid);
    return true;
  }

  function withdrawKey(projectId, partnerId) {
    return `${pickStr(projectId)}::${pickStr(partnerId)}`;
  }

  function isWithdrawnInState(state, projectId, partnerId) {
    const key = withdrawKey(projectId, partnerId);
    return (state?.withdrawn_board_applications || []).some(
      (w) => withdrawKey(w.project_id, w.partner_id) === key
    );
  }

  /**
   * 応募取り下げ: Supabase DELETE (RLS P3) → MVP mirror + withdrawn 記録
   */
  async function withdrawWithMirror({ api, projectId, partnerId, project }) {
    const pid = pickStr(projectId);
    const myPartnerId = pickStr(partnerId);
    if (!pid || !myPartnerId || !project) return false;

    const next = api.reload();
    if (isWithdrawnInState(next, pid, myPartnerId)) return false;

    const myApp = (next.applications || []).find(
      (a) => a.project_id === pid && a.partner_id === myPartnerId
    );
    if (!myApp) return false;
    if (pickStr(myApp.status) !== "applied") return false;

    const selectedIds = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selectedIds.includes(myPartnerId)) return false;

    let supabaseOk = false;
    const applicationId = pickStr(
      myApp.supabase_application_id,
      myApp.id,
      myApp.application_id
    );

    if (isRepositoryActive() && isGeneralBoardProject(project) && applicationId) {
      try {
        const repo = applicationRepo();
        const del =
          repo?.deleteApplication?.(applicationId) ||
          repo?.withdrawApplication?.(applicationId);
        const res = await del;
        if (res?.ok) {
          supabaseOk = true;
        } else {
          console.warn(LOG, "deleteApplication failed:", res?.message || res?.code || "unknown");
        }
      } catch (err) {
        console.warn(LOG, "deleteApplication error:", err);
      }
    }

    next.applications = (next.applications || []).filter(
      (a) => !(a.project_id === pid && a.partner_id === myPartnerId)
    );
    next.withdrawn_board_applications = [
      ...(next.withdrawn_board_applications || []),
      {
        project_id: pid,
        partner_id: myPartnerId,
        application_id: pickStr(myApp.application_id, myApp.id),
        supabase_application_id: applicationId || null,
        ts: nowIso(),
        supabase_ok: supabaseOk,
      },
    ];
    api.commit(next);

    if (isRepositoryActive() && !supabaseOk) {
      console.warn(LOG, "withdraw MVP fallback (apply P3 RLS on Staging for Supabase sync)", {
        project_id: pid,
        partner_id: myPartnerId,
      });
    }

    global.TasuBuilderBoardAdapter?.clearApplicationsCache?.(pid);
    return true;
  }

  /**
   * 案件編集: Supabase PATCH → MVP mirror
   */
  async function updateProjectWithMirror({ project, spec, api }) {
    const p = project && typeof project === "object" ? project : {};
    const pid = pickStr(p.project_id);
    if (!pid) return { ok: false, reason: "project_id_missing" };

    let supabaseOk = false;
    if (isRepositoryActive() && isGeneralBoardProject(p)) {
      try {
        const res = await projectRepo()?.updateGeneralProject?.(pid, p, spec || {});
        if (res?.ok) supabaseOk = true;
        else console.warn(LOG, "updateGeneralProject failed:", res?.message || res?.code);
      } catch (err) {
        console.warn(LOG, "updateGeneralProject error:", err);
      }
    }

    const next = api.reload();
    const idx = (next.projects || []).findIndex((x) => x.project_id === pid);
    if (idx < 0) return { ok: false, reason: "project_not_found" };

    next.projects[idx] = {
      ...next.projects[idx],
      ...p,
      kind: "builder_board",
      updated_at: nowIso(),
    };
    next.specs = { ...(next.specs || {}), [pid]: spec || next.specs?.[pid] || {} };
    api.commit(next, { project: next.projects[idx], mode: "update" });

    return {
      ok: true,
      project: next.projects[idx],
      supabaseOk,
      fallback: isRepositoryActive() && !supabaseOk,
      source: supabaseOk ? "supabase+mirror" : isRepositoryActive() ? "mvp_fallback" : "mvp_only",
    };
  }

  /**
   * 選定/却下: MVP は builder.js が先に実行 · ここで Supabase 同期
   */
  async function syncDecisionWithMirror({ project, partnerId, selected }) {
    if (!isRepositoryActive() || !isGeneralBoardProject(project)) return { ok: false, skipped: true };

    const repo = applicationRepo();
    if (!repo) return { ok: false, skipped: true };

    const projectUuid = pickStr(project.supabase_uuid, project.project_uuid);
    const partnerKey = pickStr(partnerId);

    try {
      let applicationId = null;
      if (projectUuid) {
        const listed = await repo.listApplicationsByProject(projectUuid);
        if (listed?.ok && Array.isArray(listed.data)) {
          const match = listed.data.find(
            (a) => pickStr(a.partner_id) === partnerKey || pickStr(a.partner_key) === partnerKey
          );
          applicationId = pickStr(match?.id, match?.application_id);
        }
      }

      if (!applicationId) {
        applicationId = `app-${project.project_id}-${partnerKey}`;
      }

      const res = selected
        ? await repo.selectApplication(applicationId)
        : await repo.rejectApplication(applicationId);

      if (!res?.ok) {
        console.warn(LOG, "syncDecision failed:", res?.message || res?.code, {
          project_id: project.project_id,
          partnerId,
          selected,
        });
        return { ok: false, fallback: true };
      }
      global.TasuBuilderBoardAdapter?.clearApplicationsCache?.(project.project_id);
      return { ok: true, supabaseOk: true, data: res.data };
    } catch (err) {
      console.warn(LOG, "syncDecision error:", err);
      return { ok: false, fallback: true };
    }
  }

  /**
   * 選定後 Talk Room ensure（selected のみ · rejected では呼ばない）
   * Supabase primary → MVP mirror talk_room_id
   */
  async function syncTalkRoomAfterSelection({ project, partnerId, api, threadId, selected }) {
    if (!selected || !isGeneralBoardProject(project)) {
      return { ok: false, skipped: true, reason: "not_selected" };
    }

    const projectUuid = pickStr(project.supabase_uuid, project.project_uuid);
    const projectKey = pickStr(project.project_id);
    const ownerAuthUid = resolveOwnerId(project.owner_id);
    let applicantAuthUid = resolveApplicantAuthUid(partnerId);
    let applicationId = null;
    let applicationPayload = null;

    if (isRepositoryActive() && projectUuid) {
      try {
        const listed = await applicationRepo()?.listApplicationsByProject?.(projectUuid);
        if (listed?.ok && Array.isArray(listed.data)) {
          const match = listed.data.find(
            (a) => pickStr(a.partner_id) === pickStr(partnerId) || pickStr(a.partner_key) === pickStr(partnerId)
          );
          if (match) {
            applicationId = pickStr(match.id, match.application_id);
            applicantAuthUid = pickStr(match.applicant_auth_uid, applicantAuthUid);
            applicationPayload = match.payload || null;
          }
        }
      } catch (err) {
        console.warn(LOG, "listApplications for talk ensure:", err);
      }
    }

    let talkRoomId = pickStr(project.talk_room_id, project.talkRoomId);
    let supabaseOk = false;
    let mode = null;

    if (isRepositoryActive() && (projectUuid || projectKey)) {
      try {
        const ensureRes = await projectRepo()?.ensureTalkRoomForGeneralProject?.(projectUuid || projectKey, {
          applicantAuthUid,
          applicantName: partnerId,
        });
        if (ensureRes?.ok) {
          talkRoomId = pickStr(ensureRes.data?.talk_room_id, ensureRes.meta?.talkRoomId, talkRoomId);
          supabaseOk = Boolean(talkRoomId);
          mode = ensureRes.meta?.mode || "repository";
        } else {
          console.warn(LOG, "ensureTalkRoomForGeneralProject failed:", ensureRes?.message || ensureRes?.code);
        }
      } catch (err) {
        console.warn(LOG, "ensureTalkRoomForGeneralProject error:", err);
      }
    }

    if (!talkRoomId) {
      const Talk = global.TasuBuilderProjectTalkRoom;
      if (Talk?.ensureTalkRoomForGeneralProject) {
        try {
          const localEnsure = await Talk.ensureTalkRoomForGeneralProject({
            projectUuid,
            projectKey,
            ownerAuthUid,
            applicantAuthUid,
            title: project.title,
            talkRoomId: project.talk_room_id,
          });
          if (localEnsure?.ok && localEnsure.roomId) {
            talkRoomId = localEnsure.roomId;
            mode = localEnsure.mode || "talk_module";
          }
        } catch (err) {
          console.warn(LOG, "talk module ensure error:", err);
        }
      }
    }

    if (isRepositoryActive() && applicationId && talkRoomId) {
      try {
        await applicationRepo()?.updateApplicationTalkRoomId?.(applicationId, talkRoomId, applicationPayload);
      } catch (err) {
        console.warn(LOG, "updateApplicationTalkRoomId error:", err);
      }
    }

    const mvpApi = api && typeof api.reload === "function" ? api : null;
    if (mvpApi && talkRoomId) {
      try {
        const next = mvpApi.reload();
        const pidx = (next.projects || []).findIndex((x) => x.project_id === projectKey);
        if (pidx >= 0) {
          next.projects[pidx] = {
            ...next.projects[pidx],
            talk_room_id: talkRoomId,
            talkRoomId: talkRoomId,
            talk_thread_id: talkRoomId,
            main_thread_id: pickStr(threadId, next.projects[pidx].main_thread_id),
          };
        }
        next.applications = (next.applications || []).map((a) => {
          if (a.project_id !== projectKey || a.partner_id !== partnerId) return a;
          const payload = { ...(a.payload || {}), talk_room_id: talkRoomId };
          return { ...a, talk_room_id: talkRoomId, payload };
        });
        mvpApi.commit(next);
      } catch (err) {
        console.warn(LOG, "MVP mirror talk_room_id error:", err);
      }
    }

    return {
      ok: Boolean(talkRoomId),
      talkRoomId: talkRoomId || null,
      supabaseOk,
      mvpThreadId: pickStr(threadId) || null,
      mode,
      fallback: isRepositoryActive() && !supabaseOk && Boolean(talkRoomId),
    };
  }

  global.TasuBuilderGeneralJobsDualWrite = {
    VERSION,
    isRepositoryActive,
    isGeneralBoardProject,
    createProjectWithMirror,
    applyWithMirror,
    withdrawWithMirror,
    updateProjectWithMirror,
    isWithdrawnInState,
    withdrawKey,
    syncDecisionWithMirror,
    syncTalkRoomAfterSelection,
    resolveOwnerId,
    resolveApplicantAuthUid,
  };
})(typeof window !== "undefined" ? window : globalThis);
