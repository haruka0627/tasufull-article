/**
 * Builder B3 — board feed adapter (P2-08)
 * Supabase hydrate は builder-board-applications-hydrate.js がマージ。
 * 一覧・応募は runtime bind（builder.js）または MVP localStorage fallback。
 */
(function (global) {
  "use strict";

  const VERSION = "p3-board-adapter";
  const MVP_KEY = "tasful:builder:mvp:v1";

  /** @type {object|null} */
  let runtime = null;

  function bindRuntime(hooks) {
    runtime = hooks && typeof hooks === "object" ? hooks : null;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function loadMvpStateFallback() {
    try {
      const raw = global.localStorage?.getItem?.(MVP_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { projects: [], applications: [], specs: {}, withdrawn_board_applications: [] };
  }

  function reloadState() {
    if (typeof runtime?.reload === "function") return runtime.reload();
    return loadMvpStateFallback();
  }

  function isBoardFeedProject(project) {
    if (global.TasuBuilderBoardFeed?.isBoardFeedProject?.(project)) return true;
    if (global.TasuBuilderGeneralJobsDualWrite?.isGeneralBoardProject?.(project)) return true;
    const kind = pickStr(project?.kind);
    return kind === "builder_board";
  }

  function filterProjects(projects) {
    const feed = global.TasuBuilderBoardFeed;
    if (feed?.filterBoardFeed) return feed.filterBoardFeed(projects || []);
    return (projects || []).filter(isBoardFeedProject);
  }

  function listBoardProjects() {
    const state = reloadState();
    const projects = filterProjects(state.projects || []);
    const source =
      global.TasuBuilderApplicationRepository?.getActiveSource?.() ||
      global.TasuBuilderDataProvider?.getActiveGeneralJobsSource?.() ||
      "mvp_local";
    return { state, projects, source };
  }

  function getBoardProject(projectId) {
    const key = pickStr(projectId);
    const bundle = listBoardProjects();
    const project =
      (bundle.projects || []).find((p) => pickStr(p.project_id) === key) ||
      (bundle.state.projects || []).find((p) => pickStr(p.project_id) === key) ||
      null;
    return { state: bundle.state, project, source: bundle.source };
  }

  function listMyApplications(partnerId, state) {
    const st = state && typeof state === "object" ? state : reloadState();
    const pid = pickStr(partnerId);
    const dual = global.TasuBuilderGeneralJobsDualWrite;
    return (st.applications || []).filter((a) => {
      if (pickStr(a.partner_id) !== pid) return false;
      if (dual?.isWithdrawnInState?.(st, a.project_id, pid)) return false;
      return pickStr(a.status) === "applied";
    });
  }

  async function applyToProject(projectId, partnerId, hooks) {
    const api = {
      reload: reloadState,
      commit: (next) => {
        try {
          global.localStorage?.setItem?.(MVP_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      },
      pushNotification: () => {},
    };
    const pid = pickStr(projectId);
    const myPartnerId = pickStr(partnerId);
    const project = (reloadState().projects || []).find((p) => pickStr(p.project_id) === pid);
    if (!project) return { ok: false, code: "project_not_found" };

    const dual = global.TasuBuilderGeneralJobsDualWrite;
    if (dual?.applyWithMirror) {
      const ok = await dual.applyWithMirror({
        api: runtime?.mvpApi?.() || api,
        projectId: pid,
        partnerId: myPartnerId,
        project,
        typeCfg: hooks?.getBoardTypeConfig?.(project) || { type: "project" },
      });
      return { ok: ok === true };
    }
    return { ok: false, code: "dual_write_unavailable" };
  }

  async function withdrawApplication(projectId, partnerId) {
    const pid = pickStr(projectId);
    const myPartnerId = pickStr(partnerId);
    const state = reloadState();
    const project = (state.projects || []).find((p) => pickStr(p.project_id) === pid);
    if (!project) return { ok: false, code: "project_not_found" };

    const dual = global.TasuBuilderGeneralJobsDualWrite;
    if (dual?.withdrawWithMirror) {
      const api = runtime?.mvpApi?.() || {
        reload: reloadState,
        commit: (next) => {
          try {
            global.localStorage?.setItem?.(MVP_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        },
      };
      const ok = await dual.withdrawWithMirror({ api, projectId: pid, partnerId: myPartnerId, project });
      return { ok: ok === true };
    }
    return { ok: false, code: "dual_write_unavailable" };
  }

  function commitBoardMutation(mutator, opts) {
    if (typeof runtime?.commitBoardMutation === "function") {
      return runtime.commitBoardMutation(mutator, opts);
    }
    return null;
  }

  function ensureFeedListings(loaded) {
    if (typeof runtime?.ensureFeedListings === "function") {
      return runtime.ensureFeedListings(loaded);
    }
    const feed = global.TasuBuilderBoardFeed;
    if (feed?.ensureBoardFeedListings) return feed.ensureBoardFeedListings(loaded);
    return loaded;
  }

  function recordBoardEvent(state, type, payload) {
    if (typeof runtime?.recordBoardEvent === "function") {
      runtime.recordBoardEvent(state, type, payload);
    }
  }

  const existing = global.TasuBuilderBoardAdapter || {};

  global.TasuBuilderBoardAdapter = {
    ...existing,
    VERSION,
    bindRuntime,
    listBoardProjects,
    getBoardProject,
    listMyApplications,
    applyToProject,
    withdrawApplication,
    commitBoardMutation,
    ensureFeedListings,
    recordBoardEvent,
    isBoardFeedProject,
    reloadState,
  };
})(typeof window !== "undefined" ? window : globalThis);
