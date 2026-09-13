/**
 * TASFUL Builder — general project repository
 * Insert は必ず private_draft。publish は MVP の publishGeneralProject 経路のみ。
 */
(function (global) {
  "use strict";

  function flags() {
    return global.TasuBuilderGeneralJobsStagingFlags;
  }

  function client() {
    return flags()?.getClient?.() || null;
  }

  function isActive() {
    return Boolean(flags()?.isRepositoryActive?.());
  }

  async function insertPrivateDraft(input) {
    const mapper = global.TasuBuilderGeneralMapper;
    const row = mapper?.toGeneralProjectRow ? mapper.toGeneralProjectRow(input) : input;
    row.publication_state = "private_draft";
    const c = client();
    if (!c) return { ok: false, reason: "NO_CLIENT", row };
    const slim = {
      project_key: row.project_key,
      owner_id: row.owner_id,
      title: row.title,
      kind: "builder_board",
      status: row.status || "open",
      visibility: row.visibility,
      contact_policy: row.contact_policy,
      source: row.source,
    };
    try {
      let { data, error } = await c.from("builder_projects").insert(row).select("*").single();
      if (error) {
        const retry = await c.from("builder_projects").insert(slim).select("*").single();
        data = retry.data;
        error = retry.error;
        if (error) return { ok: false, reason: "INSERT_FAILED", code: error.code || "", row, slim: true };
      }
      if (String(data?.publication_state || "") === "published") {
        return { ok: false, reason: "RLS_PUBLISH_ON_INSERT_FORBIDDEN", row, id: data?.id };
      }
      return {
        ok: true,
        id: data?.id || "",
        project_key: data?.project_key || row.project_key,
        row: data,
        publication_state: data?.publication_state || "private_draft",
      };
    } catch {
      return { ok: false, reason: "INSERT_THREW", row };
    }
  }

  async function getGeneralProjectById(id) {
    const key = String(id || "");
    if (!key) return null;
    const c = client();
    if (!c) return null;
    const mapper = global.TasuBuilderGeneralMapper;
    const trySelect = async (col, val) => {
      try {
        const { data, error } = await c.from("builder_projects").select("*").eq(col, val).maybeSingle();
        if (!error && data) return mapper?.fromGeneralProjectRow ? mapper.fromGeneralProjectRow(data) : data;
      } catch {
        /* ignore */
      }
      return null;
    };
    return (await trySelect("project_key", key)) || (await trySelect("id", key));
  }

  async function publishGeneralProject(id) {
    const key = String(id || "");
    const c = client();
    if (!c || !key) return { ok: false, reason: "NO_CLIENT" };
    try {
      const { data, error } = await c
        .from("builder_projects")
        .update({ publication_state: "published" })
        .eq("project_key", key)
        .select("id, project_key, publication_state")
        .single();
      if (error) return { ok: false, reason: "PUBLISH_FAILED", code: error.code || "" };
      return { ok: true, id: data?.id || "", project_key: data?.project_key || key };
    } catch {
      return { ok: false, reason: "PUBLISH_THREW" };
    }
  }

  global.TasuBuilderProjectRepository = {
    isActive,
    insertPrivateDraft,
    getGeneralProjectById,
    publishGeneralProject,
  };
})(typeof window !== "undefined" ? window : globalThis);
