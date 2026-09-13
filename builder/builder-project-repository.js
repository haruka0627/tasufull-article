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

  async function updatePrivateDraft(id, input) {
    const mapper = global.TasuBuilderGeneralMapper;
    const row = mapper?.toGeneralProjectRow ? mapper.toGeneralProjectRow(input) : input || {};
    row.publication_state = "private_draft";
    const key = String(id || row.project_key || "");
    const c = client();
    if (!c || !key) return { ok: false, reason: "NO_CLIENT", row };
    const slim = {
      title: row.title,
      status: row.status || "open",
      visibility: row.visibility,
      contact_policy: row.contact_policy,
      source: row.source,
      publication_state: "private_draft",
    };
    const tryUpdate = async (col, payload) => {
      const { data, error } = await c.from("builder_projects").update(payload).eq(col, key).select("*").single();
      return { data, error };
    };
    try {
      let { data, error } = await tryUpdate("project_key", row);
      if (error) {
        const retry = await tryUpdate("project_key", slim);
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        const byId = await tryUpdate("id", slim);
        data = byId.data;
        error = byId.error;
      }
      if (error) return { ok: false, reason: "UPDATE_FAILED", code: error.code || "", row };
      return {
        ok: true,
        id: data?.id || "",
        project_key: data?.project_key || key,
        row: data,
        publication_state: data?.publication_state || "private_draft",
      };
    } catch {
      return { ok: false, reason: "UPDATE_THREW", row };
    }
  }

  async function publishGeneralProject(id) {
    const key = String(id || "");
    const c = client();
    if (!c || !key) return { ok: false, reason: "NO_CLIENT" };
    try {
      const run = async (col) =>
        c.from("builder_projects").update({ publication_state: "published" }).eq(col, key).select("id, project_key, publication_state").single();
      let { data, error } = await run("project_key");
      if (error) {
        const retry = await run("id");
        data = retry.data;
        error = retry.error;
      }
      if (error) return { ok: false, reason: "PUBLISH_FAILED", code: error.code || "" };
      if (String(data?.publication_state || "") !== "published") {
        return { ok: false, reason: "PUBLISH_NOT_APPLIED", id: data?.id || "", project_key: data?.project_key || key };
      }
      return { ok: true, id: data?.id || "", project_key: data?.project_key || key, publication_state: "published" };
    } catch {
      return { ok: false, reason: "PUBLISH_THREW" };
    }
  }

  async function listPublicProjects(opts) {
    const c = client();
    if (!c) return { ok: false, rows: [], reason: "NO_CLIENT" };
    try {
      let q = c.from("builder_public_projects_v1").select("*");
      if (opts?.kind) q = q.eq("kind", opts.kind);
      q = q.limit(Math.max(1, Number(opts?.limit) || 40));
      const { data, error } = await q;
      if (error) return { ok: false, rows: [], reason: "LIST_FAILED", code: error.code || "" };
      return { ok: true, rows: Array.isArray(data) ? data : [] };
    } catch {
      return { ok: false, rows: [], reason: "LIST_THREW" };
    }
  }

  global.TasuBuilderProjectRepository = {
    isActive,
    insertPrivateDraft,
    updatePrivateDraft,
    getGeneralProjectById,
    publishGeneralProject,
    listPublicProjects,
  };
})(typeof window !== "undefined" ? window : globalThis);
