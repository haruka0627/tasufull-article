/**
 * TASFUL Builder — general-jobs Staging flags
 * isRepositoryActive() は repo stack（mapper + project-repository + client）が揃ったときだけ true。
 */
(function (global) {
  "use strict";

  const FLAG = "TASU_BUILDER_GENERAL_JOBS_REPO";

  function readFlag() {
    try {
      const q = new URLSearchParams(global.location?.search || "").get(FLAG);
      if (q === "true" || q === "1") return true;
      if (q === "false" || q === "0") return false;
    } catch {
      /* ignore */
    }
    try {
      if (global.localStorage?.getItem(FLAG) === "true") return true;
    } catch {
      /* ignore */
    }
    if (global[FLAG] === true) return true;
    try {
      if (global.TasuBuilderConfig?.isGeneralJobsRepoEnabled?.()) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function getClient() {
    try {
      if (global.TasuSupabaseClient?.getClient) return global.TasuSupabaseClient.getClient();
      if (global.TasuSupabase?.getClient) return global.TasuSupabase.getClient();
    } catch {
      /* ignore */
    }
    return null;
  }

  function isRepositoryActive() {
    return Boolean(
      readFlag() &&
        global.TasuBuilderGeneralMapper?.toGeneralProjectRow &&
        global.TasuBuilderProjectRepository &&
        getClient()
    );
  }

  global.TasuBuilderGeneralJobsStagingFlags = {
    FLAG,
    isGeneralJobsRepoEnabled: readFlag,
    isRepositoryActive,
    getClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
