/**
 * TASFUL Builder — application repository（detail 読取用）
 */
(function (global) {
  "use strict";

  function client() {
    return global.TasuBuilderGeneralJobsStagingFlags?.getClient?.() || null;
  }

  async function listByProjectId(projectId) {
    const key = String(projectId || "");
    const c = client();
    if (!c || !key) return [];
    try {
      const { data, error } = await c.from("builder_project_applications").select("*").eq("project_id", key);
      if (error || !Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  }

  global.TasuBuilderApplicationRepository = {
    listByProjectId,
  };
})(typeof window !== "undefined" ? window : globalThis);
