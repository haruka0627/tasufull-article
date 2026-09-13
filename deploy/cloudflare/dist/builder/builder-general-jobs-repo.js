/**
 * TASFUL Builder — general-jobs repo（Staging dual-write）
 * JOB SSOT: builder_projects kind=builder_board
 * public projection: builder_public_projects_v1（読取のみ想定）
 * 有効化: TASU_BUILDER_GENERAL_JOBS_REPO=true（query / localStorage / global）
 * Production マイグレーションは適用しない。
 */
(function (global) {
  "use strict";

  const FLAG = "TASU_BUILDER_GENERAL_JOBS_REPO";
  const KIND = "builder_board";

  function readFlag() {
    try {
      const q = new URLSearchParams(global.location?.search || "").get(FLAG);
      if (q === "true" || q === "1") return true;
      if (q === "false" || q === "0") return false;
    } catch {
      /* ignore */
    }
    try {
      const ls = global.localStorage?.getItem(FLAG);
      if (ls === "true" || ls === "1") return true;
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

  function mapToRow(input) {
    const cache = global.TasuBuilderCompatCache;
    const projectKey = String(input.project_id || input.project_key || (cache ? cache.uid("proj") : `proj-${Date.now()}`));
    return {
      project_key: projectKey,
      owner_id: String(input.owner_id || "owner-demo"),
      title: String(input.title || "").trim() || "無題案件",
      kind: KIND,
      status: String(input.status || "open"),
      required_partners: Math.max(1, Number(input.required_partners || 1)),
      visibility: String(input.visibility || "partner_only"),
      contact_policy: String(input.contact_policy || "tasful_talk_only"),
      source: String(input.source || "company"),
    };
  }

  function validateJobInput(input) {
    const errors = [];
    const title = String(input?.title || "").trim();
    const kind = String(input?.kind || KIND);
    const visibility = String(input?.visibility || "partner_only");
    const contact = String(input?.contact_policy || "tasful_talk_only");
    const source = String(input?.source || "company");
    if (kind && kind !== "builder_board" && kind !== "tasful_managed") errors.push("kind");
    if (!["public", "private", "partner_only", "team_only"].includes(visibility)) errors.push("visibility");
    if (!["tasful_talk_only", "owner_allowed", "admin_only"].includes(contact)) errors.push("contact_policy");
    if (!["tasful", "company", "partner", "public_user"].includes(source)) errors.push("source");
    return { ok: errors.length === 0, errors, titleRequiredForUi: !title };
  }

  async function insertJob(input) {
    const enabled = readFlag();
    const client = getClient();
    const row = mapToRow(input);
    if (!enabled) {
      return { ok: false, skipped: true, reason: "FLAG_OFF", project_key: row.project_key };
    }
    if (!client || typeof client.from !== "function") {
      return { ok: false, skipped: true, reason: "NO_CLIENT", project_key: row.project_key };
    }
    try {
      const { data, error } = await client.from("builder_projects").insert(row).select("id, project_key").single();
      if (error) {
        return {
          ok: false,
          reason: "INSERT_FAILED",
          code: error.code || "",
          project_key: row.project_key,
        };
      }
      return {
        ok: true,
        id: data?.id || "",
        project_key: data?.project_key || row.project_key,
        kind: KIND,
      };
    } catch {
      return { ok: false, reason: "INSERT_THREW", project_key: row.project_key };
    }
  }

  async function getJob(id) {
    const key = String(id || "");
    if (!key) return null;
    const enabled = readFlag();
    const client = getClient();
    if (!enabled || !client) return null;
    try {
      let q = client.from("builder_projects").select("*").eq("kind", KIND);
      const byKey = await q.eq("project_key", key).maybeSingle();
      if (!byKey.error && byKey.data) return byKey.data;
    } catch {
      /* ignore */
    }
    try {
      const byId = await client.from("builder_projects").select("*").eq("id", key).maybeSingle();
      if (!byId.error && byId.data) return byId.data;
    } catch {
      /* ignore */
    }
    try {
      const pub = await client.from("builder_public_projects_v1").select("*").or(`id.eq.${key},project_key.eq.${key}`).maybeSingle();
      if (!pub.error && pub.data) return pub.data;
    } catch {
      /* ignore */
    }
    return null;
  }

  global.TasuBuilderGeneralJobsRepo = {
    FLAG,
    KIND,
    isEnabled: readFlag,
    getClient,
    mapToRow,
    validateJobInput,
    insertJob,
    getJob,
  };
})(typeof window !== "undefined" ? window : globalThis);
