/**
 * TASFUL Builder — ProviderStore（COMPAT_CACHE）
 * SSOT ではない。Supabase 成功後のミラー、およびオフライン表示用。
 */
(function (global) {
  "use strict";

  function cache() {
    return global.TasuBuilderCompatCache;
  }

  function normalize(input, fallbackId) {
    const c = cache();
    const id = String(input.partner_id || input.id || fallbackId || (c ? c.uid("partner") : `partner-${Date.now()}`));
    const type = String(input.partner_type || input.entity || "individual") === "company" ? "company" : "individual";
    return {
      id,
      partner_id: id,
      display_name: String(input.display_name || input.name || "").trim() || "無題パートナー",
      furigana: String(input.furigana || "").trim(),
      trade_name: String(input.trade_name || input.headline || "").trim(),
      partner_type: type,
      entity: type === "company" ? "法人" : "個人",
      trades: Array.isArray(input.trades)
        ? input.trades
        : String(input.trades || "")
            .split(/[,、]/)
            .map((s) => s.trim())
            .filter(Boolean),
      areas: Array.isArray(input.areas)
        ? input.areas
        : String(input.areas || "")
            .split(/[,、]/)
            .map((s) => s.trim())
            .filter(Boolean),
      headline: String(input.headline || input.trade_name || "").trim(),
      profile: String(input.profile || input.furigana || "").trim(),
      contact_policy: String(input.contact_policy || "tasful_talk_only"),
      availability: String(input.availability || "available"),
      status: "active",
      photo_data_url: String(input.photo_data_url || ""),
      updated_at: c ? c.nowIso() : new Date().toISOString(),
      supabase_id: input.supabase_id || "",
    };
  }

  function save(input) {
    const record = normalize(input);
    const c = cache();
    if (!c) return { ok: false, reason: "NO_CACHE", record };
    const cacheRes = c.upsertProviderCache(record);
    const mvp = c.readMvp();
    mvp.partners = [record, ...(mvp.partners || []).filter((p) => String(p.partner_id) !== record.partner_id)];
    c.writeMvp(mvp);
    return { ok: cacheRes.ok, record };
  }

  function get(id) {
    const c = cache();
    return c ? c.getProviderCache(id) : null;
  }

  function list() {
    const c = cache();
    if (!c) return [];
    const fromStore = c.readProviders();
    const fromMvp = c.readMvp().partners || [];
    const seen = new Set();
    const out = [];
    [...fromStore, ...fromMvp].forEach((row) => {
      const id = String(row.id || row.partner_id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(row);
    });
    return out;
  }

  global.TasuBuilderProviderStore = {
    normalize,
    save,
    get,
    list,
  };
})(typeof window !== "undefined" ? window : globalThis);
