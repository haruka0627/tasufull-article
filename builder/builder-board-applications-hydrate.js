/**
 * Builder General Jobs P0-05 — board applications Supabase hydrate
 *
 * Supabase primary · MVP localStorage fallback
 */
(function (global) {
  "use strict";

  const VERSION = "p2-02-board-apps-hydrate";
  const LOG = "[BuilderBoardAppsHydrate]";
  /** @type {Map<string, { apps: object[], source: string, at: number }>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object|null>>} */
  const inflight = new Map();

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isRepositoryActive() {
    return global.TasuBuilderConfig?.isGeneralJobsRepositoryEnabled?.() === true;
  }

  function applicationRepo() {
    return global.TasuBuilderApplicationRepository || null;
  }

  function mapper() {
    return global.TasuBuilderGeneralMapper || {};
  }

  function mvpApplicationsForProject(projectId, state) {
    const pid = pickStr(projectId);
    return (state?.applications || []).filter((a) => String(a.project_id) === pid);
  }

  function normalizeSupabaseApp(row, project) {
    const map = mapper();
    const parsed = map.fromApplicationRow?.(row) || row || {};
    const projectKey = pickStr(project?.project_id);
    const partnerKey = pickStr(parsed.partner_id, parsed.partner_key, row?.partner_key);
    const dbStatus = pickStr(parsed.status, row?.status) || "applied";
    const payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {};
    const displayStatus = pickStr(payload.display_status);
    let uiStatus = dbStatus;
    if (dbStatus === "applied" && displayStatus === "pending") uiStatus = "applied";

    return {
      id: pickStr(parsed.id, parsed.application_id),
      application_id: pickStr(parsed.application_id, parsed.id),
      supabase_application_id: pickStr(parsed.id),
      project_id: projectKey,
      project_uuid: pickStr(parsed.project_id, project?.supabase_uuid),
      partner_id: partnerKey,
      partner_key: partnerKey,
      partner_uuid: parsed.partner_uuid || row?.partner_id || null,
      applicant_auth_uid: pickStr(parsed.applicant_auth_uid),
      status: uiStatus,
      ts: pickStr(parsed.applied_at, row?.applied_at) || new Date().toISOString(),
      applied_at: pickStr(parsed.applied_at),
      message: pickStr(parsed.message),
      payload,
      talk_room_id: pickStr(payload.talk_room_id, project?.talk_room_id, project?.talkRoomId) || null,
      _source: "supabase",
    };
  }

  function filterWithdrawnApps(apps, state) {
    if (!Array.isArray(apps)) return apps;
    const dual = global.TasuBuilderGeneralJobsDualWrite;
    if (!dual?.isWithdrawnInState) return apps;
    return apps.filter((a) => {
      const pid = pickStr(a?.project_id);
      const keys = [pickStr(a?.partner_id), pickStr(a?.partner_key), pickStr(a?.payload?.partner_key)].filter(
        Boolean
      );
      return !keys.some((kid) => dual.isWithdrawnInState(state, pid, kid));
    });
  }

  function getApplicationsForProject(projectId, state) {
    const cached = cache.get(pickStr(projectId));
    if (cached?.source === "supabase" && Array.isArray(cached.apps)) {
      return {
        apps: filterWithdrawnApps(cached.apps, state),
        source: "supabase",
        cached: true,
      };
    }
    return {
      apps: filterWithdrawnApps(mvpApplicationsForProject(projectId, state), state),
      source: "mvp_local",
      cached: false,
    };
  }

  async function hydrateApplications(project, state) {
    const projectKey = pickStr(project?.project_id);
    if (!projectKey) return null;
    if (!isRepositoryActive() || !isGeneralBoardProject(project)) {
      return { apps: mvpApplicationsForProject(projectKey, state), source: "mvp_local", skipped: true };
    }

    if (inflight.has(projectKey)) return inflight.get(projectKey);

    const run = (async () => {
      const repo = applicationRepo();
      if (!repo?.listApplicationsByProject) {
        return { apps: mvpApplicationsForProject(projectKey, state), source: "mvp_fallback", reason: "no_repo" };
      }
      const projectUuid = pickStr(project.supabase_uuid, project.project_uuid, projectKey);
      try {
        const listed = await repo.listApplicationsByProject(projectUuid);
        if (!listed?.ok || !Array.isArray(listed.data)) {
          console.warn(LOG, "supabase list failed:", listed?.message || listed?.code);
          return {
            apps: mvpApplicationsForProject(projectKey, state),
            source: "mvp_fallback",
            reason: listed?.code || "list_failed",
          };
        }
        const apps = filterWithdrawnApps(
          listed.data.map((row) => normalizeSupabaseApp(row, project)),
          state
        );
        cache.set(projectKey, { apps, source: "supabase", at: Date.now() });
        return { apps, source: "supabase", count: apps.length };
      } catch (err) {
        console.warn(LOG, "hydrate error:", err);
        return {
          apps: mvpApplicationsForProject(projectKey, state),
          source: "mvp_fallback",
          reason: String(err?.message || err),
        };
      }
    })();

    inflight.set(projectKey, run);
    try {
      return await run;
    } finally {
      inflight.delete(projectKey);
    }
  }

  function isGeneralBoardProject(project) {
    if (global.TasuBuilderGeneralJobsDualWrite?.isGeneralBoardProject) {
      return global.TasuBuilderGeneralJobsDualWrite.isGeneralBoardProject(project);
    }
    const kind = pickStr(project?.kind);
    return kind === "builder_board" || pickStr(project?.board_type) === "project";
  }

  function clearCache(projectId) {
    const key = pickStr(projectId);
    if (key) cache.delete(key);
  }

  function listBoardApplications(projectId, opts) {
    const state = opts?.state || {};
    return getApplicationsForProject(projectId, state).apps;
  }

  global.TasuBuilderBoardApplicationsHydrate = {
    VERSION,
    getApplicationsForProject,
    hydrateApplications,
    listBoardApplications,
    normalizeSupabaseApp,
    clearCache,
    mvpApplicationsForProject,
    _cache: cache,
  };

  global.TasuBuilderBoardAdapter = {
    ...(global.TasuBuilderBoardAdapter || {}),
    VERSION,
    listBoardApplications,
    getApplicationsForProject,
    hydrateApplications,
    clearApplicationsCache: clearCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
