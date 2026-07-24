/**
 * Builder General Jobs — project repository facade (P0-01)
 * Routes to Supabase when enabled · else MVP local fallback
 */
(function (global) {
  "use strict";

  const VERSION = "general-project-repo-p0-01";

  function backend() {
    const cfg = global.TasuBuilderConfig || {};
    const pick = global.TasuBuilderRepository?.pickBackend;
    const supa = global.TasuBuilderRepositoriesSupabase?.project;
    const local = global.TasuBuilderRepositoriesLocal?.project;
    if (typeof pick === "function") {
      return pick(supa, local, () => cfg.isGeneralJobsRepositoryEnabled?.());
    }
    if (cfg.isGeneralJobsRepositoryEnabled?.() && supa?.isEnabled?.()) {
      return { repo: supa, source: "supabase" };
    }
    return { repo: local, source: "mvp_local" };
  }

  function delegate(method, args) {
    const { repo, source } = backend();
    if (!repo || typeof repo[method] !== "function") {
      return Promise.resolve(
        global.TasuBuilderRepository?.fail?.("repository_unavailable", `${method} not available`) || { ok: false }
      );
    }
    return Promise.resolve(repo[method](...args)).then((res) => {
      if (res && typeof res === "object" && res.meta == null) {
        res.meta = { ...(res.meta || {}), routedSource: source };
      }
      return res;
    });
  }

  global.TasuBuilderProjectRepository = {
    VERSION,
    getActiveSource() {
      return backend().source;
    },
    isSupabaseActive() {
      return backend().source === "supabase";
    },
    createGeneralProject(input) {
      return delegate("createGeneralProject", [input]);
    },
    listGeneralProjects(filters) {
      return delegate("listGeneralProjects", [filters]);
    },
    getGeneralProjectById(id) {
      return delegate("getGeneralProjectById", [id]);
    },
    updateGeneralProjectStatus(id, status, patch) {
      return delegate("updateGeneralProjectStatus", [id, status, patch]);
    },
    updateGeneralProject(id, project, spec) {
      return delegate("updateGeneralProject", [id, project, spec]);
    },
    updateGeneralProjectTalkRoomId(id, talkRoomId) {
      return delegate("updateGeneralProjectTalkRoomId", [id, talkRoomId]);
    },
    ensureTalkRoomForGeneralProject(id, context) {
      return delegate("ensureTalkRoomForGeneralProject", [id, context]);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
