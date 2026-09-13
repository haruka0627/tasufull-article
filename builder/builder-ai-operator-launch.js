/**
 * TASFUL Builder — operator launch paths
 * partner / contractor_register → provider-profile.html
 */
(function (global) {
  "use strict";

  const PROJECT_FORM_PATH = "new-project.html";
  const PROVIDER_FORM_PATH = "provider-profile.html";

  function pathForIntent(intent) {
    const k = String(intent || "");
    if (k === "partner" || k === "contractor_register" || k === "partner_register" || k === "register_worker") {
      return PROVIDER_FORM_PATH;
    }
    if (k === "post_job" || k === "project_form") return PROJECT_FORM_PATH;
    return "";
  }

  global.TasuBuilderAiOperatorLaunch = {
    PROJECT_FORM_PATH,
    PROVIDER_FORM_PATH,
    pathForIntent,
  };
})(typeof window !== "undefined" ? window : globalThis);
