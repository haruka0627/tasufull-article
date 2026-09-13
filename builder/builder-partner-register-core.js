/**
 * TASFUL Builder — provider register/edit core
 * mvp-partner-register の永続化 + PartnerSupabaseSync。
 * Supabase first → ProviderStore / MVP COMPAT_CACHE ミラー。
 */
(function (global) {
  "use strict";

  function routes() {
    return global.TasuBuilderCanonicalRoutes;
  }

  function store() {
    return global.TasuBuilderProviderStore;
  }

  function sync() {
    return global.TasuBuilderPartnerSupabaseSync;
  }

  function validate(fields, { requireName } = {}) {
    const errors = [];
    const name = String(fields.display_name || fields.name || "").trim();
    if (requireName && !name) errors.push("display_name");
    return { ok: errors.length === 0, errors };
  }

  async function save(fields, options) {
    const opts = options || {};
    const v = validate(fields, { requireName: opts.requireName !== false });
    if (!v.ok) return { ok: false, reason: "VALIDATION", errors: v.errors };
    const storeApi = store();
    const local = storeApi ? storeApi.save(fields) : { ok: false, record: fields };
    const record = local.record || fields;
    let supabase = { attempted: false, ok: false, skipped: true, reason: "NO_SYNC" };
    const syncApi = sync();
    if (syncApi?.upsertPartner) {
      supabase = { attempted: true, skipped: false, ok: false };
      const upserted = await syncApi.upsertPartner(record);
      supabase = Object.assign({ attempted: true }, upserted);
      if (upserted.ok && upserted.id) {
        record.supabase_id = upserted.id;
        if (storeApi) storeApi.save(record);
      }
    }
    const id = record.partner_id || record.id;
    const href = routes()?.providerDetailHref(id) || `provider-detail.html?id=${encodeURIComponent(id)}`;
    return {
      ok: true,
      id,
      record,
      supabase,
      compatCache: { ok: !!local.ok },
      redirect: href,
    };
  }

  async function load(id) {
    const key = String(id || "");
    if (!key) return null;
    const syncApi = sync();
    if (syncApi?.getProvider) {
      try {
        const remote = await syncApi.getProvider(key);
        if (remote) return remote;
      } catch {
        /* ignore */
      }
    }
    return store()?.get(key) || null;
  }

  global.TasuBuilderPartnerRegisterCore = {
    validate,
    save,
    load,
  };
})(typeof window !== "undefined" ? window : globalThis);
