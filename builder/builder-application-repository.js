/**
 * Builder General Jobs — application repository facade (P0-01)
 */
(function (global) {
  "use strict";

  const VERSION = "general-application-repo-p0-01";

  function backend() {
    const cfg = global.TasuBuilderConfig || {};
    const pick = global.TasuBuilderRepository?.pickBackend;
    const supa = global.TasuBuilderRepositoriesSupabase?.application;
    const local = global.TasuBuilderRepositoriesLocal?.application;
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

  global.TasuBuilderApplicationRepository = {
    VERSION,
    getActiveSource() {
      return backend().source;
    },
    isSupabaseActive() {
      return backend().source === "supabase";
    },
    createApplication(input) {
      return delegate("createApplication", [input]);
    },
    listApplicationsByProject(projectId) {
      return delegate("listApplicationsByProject", [projectId]);
    },
    lookupPartnerByKey(partnerKey) {
      return delegate("lookupPartnerByKey", [partnerKey]);
    },
    listApplicationsByUser(applicantAuthUid) {
      return delegate("listApplicationsByUser", [applicantAuthUid]);
    },
    updateApplicationStatus(applicationId, status, patch) {
      return delegate("updateApplicationStatus", [applicationId, status, patch]);
    },
    selectApplication(applicationId) {
      return delegate("selectApplication", [applicationId]);
    },
    rejectApplication(applicationId) {
      return delegate("rejectApplication", [applicationId]);
    },
    updateApplicationTalkRoomId(applicationId, talkRoomId, existingPayload) {
      return delegate("updateApplicationTalkRoomId", [applicationId, talkRoomId, existingPayload]);
    },
    deleteApplication(applicationId) {
      return delegate("deleteApplication", [applicationId]);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
