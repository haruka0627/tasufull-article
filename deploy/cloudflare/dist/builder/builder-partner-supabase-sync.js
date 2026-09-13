/**
 * TASFUL Builder — TasuBuilderPartnerSupabaseSync
 * PROVIDER SSOT: builder_partners + builder_workers（後者はテーブルがあるときのみ）
 * Production マイグレーションは適用しない。
 */
(function (global) {
  "use strict";

  function getClient() {
    try {
      if (global.TasuSupabaseClient?.getClient) return global.TasuSupabaseClient.getClient();
      if (global.TasuSupabase?.getClient) return global.TasuSupabase.getClient();
    } catch {
      /* ignore */
    }
    return null;
  }

  function asArray(val) {
    if (Array.isArray(val)) return val.map((s) => String(s || "").trim()).filter(Boolean);
    return String(val || "")
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function mapPartnerRow(input) {
    const cache = global.TasuBuilderCompatCache;
    const partnerKey = String(input.partner_id || input.partner_key || input.id || (cache ? cache.uid("partner") : `partner-${Date.now()}`));
    const type = String(input.partner_type || input.entity || "individual") === "company" ? "company" : "individual";
    return {
      partner_key: partnerKey,
      display_name: String(input.display_name || input.name || "").trim() || "無題パートナー",
      partner_type: type,
      trades: asArray(input.trades),
      areas: asArray(input.areas),
      headline: String(input.headline || input.trade_name || "").trim(),
      profile: String(input.profile || input.furigana || "").trim(),
      contact_policy: String(input.contact_policy || "tasful_talk_only"),
      availability: String(input.availability || "available"),
      status: String(input.status || "active"),
    };
  }

  function mapWorkerRow(input, partnerKey) {
    return {
      worker_key: partnerKey,
      display_name: String(input.display_name || input.name || "").trim() || "無題",
      furigana: String(input.furigana || "").trim(),
      trades: asArray(input.trades),
      areas: asArray(input.areas),
      headline: String(input.headline || "").trim(),
      status: "active",
    };
  }

  async function upsertPartner(input) {
    const client = getClient();
    const row = mapPartnerRow(input);
    if (!client || typeof client.from !== "function") {
      return { ok: false, skipped: true, reason: "NO_CLIENT", partner_key: row.partner_key };
    }
    try {
      const { data, error } = await client
        .from("builder_partners")
        .upsert(row, { onConflict: "partner_key" })
        .select("id, partner_key")
        .single();
      if (error) {
        return { ok: false, reason: "UPSERT_FAILED", code: error.code || "", partner_key: row.partner_key };
      }
      let worker = { ok: false, skipped: true, reason: "NOT_INDIVIDUAL" };
      if (row.partner_type === "individual") {
        worker = await upsertWorker(input, row.partner_key);
      }
      return {
        ok: true,
        id: data?.id || "",
        partner_key: data?.partner_key || row.partner_key,
        worker,
      };
    } catch {
      return { ok: false, reason: "UPSERT_THREW", partner_key: row.partner_key };
    }
  }

  async function upsertWorker(input, partnerKey) {
    const client = getClient();
    if (!client) return { ok: false, skipped: true, reason: "NO_CLIENT" };
    const row = mapWorkerRow(input, partnerKey);
    try {
      const { data, error } = await client
        .from("builder_workers")
        .upsert(row, { onConflict: "worker_key" })
        .select("id, worker_key")
        .single();
      if (error) {
        return { ok: false, skipped: true, reason: "WORKERS_UNAVAILABLE", code: error.code || "" };
      }
      return { ok: true, id: data?.id || "", worker_key: data?.worker_key || row.worker_key };
    } catch {
      return { ok: false, skipped: true, reason: "WORKERS_UNAVAILABLE" };
    }
  }

  async function getProvider(id) {
    const key = String(id || "");
    if (!key) return null;
    const client = getClient();
    if (!client) return null;
    try {
      const byKey = await client.from("builder_partners").select("*").eq("partner_key", key).maybeSingle();
      if (!byKey.error && byKey.data) return byKey.data;
    } catch {
      /* ignore */
    }
    try {
      const byId = await client.from("builder_partners").select("*").eq("id", key).maybeSingle();
      if (!byId.error && byId.data) return byId.data;
    } catch {
      /* ignore */
    }
    try {
      const worker = await client.from("builder_workers").select("*").or(`id.eq.${key},worker_key.eq.${key}`).maybeSingle();
      if (!worker.error && worker.data) return Object.assign({ partner_type: "individual" }, worker.data);
    } catch {
      /* ignore */
    }
    return null;
  }

  global.TasuBuilderPartnerSupabaseSync = {
    getClient,
    mapPartnerRow,
    upsertPartner,
    upsertWorker,
    getProvider,
  };
})(typeof window !== "undefined" ? window : globalThis);
