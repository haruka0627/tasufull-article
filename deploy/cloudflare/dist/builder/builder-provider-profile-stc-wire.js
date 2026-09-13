/**
 * TASFUL Builder — provider-profile STC save
 * ProviderStore 成功後に upsertFromMvpPartner。
 * publishProvider は呼ばない。Rich は submitProviderForReview → review_pending。
 */
(function (global) {
  "use strict";

  function collect(form) {
    const g = (name, attr) => {
      const el = form.querySelector(`[name="${name}"]`) || (attr ? form.querySelector(attr) : null);
      return el ? String(el.value || "").trim() : "";
    };
    const entity = g("entity", "[data-canonical-provider-entity]") || "individual";
    return {
      partner_id: g("id", "[data-canonical-provider-id]") || new URLSearchParams(location.search).get("id") || "",
      display_name: g("name", "[data-canonical-provider-name]"),
      name: g("name", "[data-canonical-provider-name]"),
      furigana: g("furigana", "[data-canonical-provider-furigana]"),
      trade_name: g("trade_name", "[data-canonical-provider-trade-name]"),
      headline: g("headline", "[data-canonical-provider-headline]") || g("trade_name", "[data-canonical-provider-trade-name]"),
      partner_type: entity === "company" || entity === "法人" ? "company" : "individual",
      trades: g("trades", "[data-canonical-provider-trades]"),
      areas: g("areas", "[data-canonical-provider-areas]"),
      availability: g("availability", "[data-canonical-provider-availability]") || "available",
      profile: g("furigana", "[data-canonical-provider-furigana]"),
      photo_data_url: form.dataset.photoDataUrl || "",
      publicationStatus: "review_pending",
      profileCompletionStatus: "incomplete",
      metadata: {
        furigana: g("furigana", "[data-canonical-provider-furigana]"),
        image: form.dataset.photoDataUrl || "",
        quals: g("quals", "[data-canonical-provider-quals]"),
        years: g("years", "[data-canonical-provider-years]"),
        radius: g("radius", "[data-canonical-provider-radius]"),
      },
    };
  }

  function toMvpPartner(record) {
    return {
      partner_id: record.partner_id || record.id,
      display_name: record.display_name,
      partner_type: record.partner_type,
      trades: record.trades,
      areas: record.areas,
      headline: record.headline,
      profile: record.profile || "",
      availability: record.availability,
    };
  }

  async function submitProviderForReview(record) {
    record.publicationStatus = "review_pending";
    record.profileCompletionStatus = record.display_name ? "incomplete" : "incomplete";
    return record;
  }

  async function save(form) {
    const fields = collect(form);
    if (!fields.display_name) return { ok: false, reason: "VALIDATION", errors: ["display_name"] };
    const store = global.TasuBuilderProviderStore;
    const local = store ? store.save(fields) : { ok: false, record: fields };
    if (!local.ok) return { ok: false, reason: "STORE_FAILED" };
    const record = await submitProviderForReview(local.record);
    store?.save(record);
    let supabase = { attempted: false, ok: false, skipped: true, reason: "NO_SYNC" };
    const sync = global.TasuBuilderPartnerSupabaseSync;
    if (sync?.upsertFromMvpPartner) {
      const upserted = await sync.upsertFromMvpPartner(toMvpPartner(record));
      supabase = Object.assign({ attempted: true, skipped: !!upserted.skipped }, upserted);
      if (upserted.ok && upserted.id) {
        record.supabase_id = upserted.id;
        store?.save(record);
      }
    }
    const id = record.partner_id || record.id;
    return {
      ok: true,
      id,
      record,
      supabase,
      redirect: global.TasuBuilderCanonicalRoutes?.providerDetailHref(id) || `provider-detail.html?id=${encodeURIComponent(id)}`,
    };
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function init() {
    const form = document.querySelector("[data-canonical-provider-form]");
    if (!form || form.dataset.stcWired === "1") return;
    form.dataset.stcWired = "1";
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const status = document.querySelector("[data-canonical-provider-status]");
      const btn = form.querySelector("[data-canonical-provider-submit], button[type='submit']");
      if (btn) btn.disabled = true;
      try {
        const res = await save(form);
        if (!res.ok) {
          setStatus(status, `登録できません（${res.reason}）。`, "error");
          return;
        }
        if (res.supabase.attempted && !res.supabase.ok && !res.supabase.skipped) {
          setStatus(status, "Staging sync 失敗。ProviderStore のみ（review_pending）。auto-publish はしていません。", "warn");
        } else if (res.supabase.ok) {
          setStatus(status, "Staging 同期済み。公開は review_pending（auto-publish なし）。", "ok");
        } else {
          setStatus(status, "ProviderStore に review_pending で保存。詳細へ移動します。", "ok");
        }
        window.location.href = res.redirect;
      } catch {
        setStatus(status, "save 例外。成功扱いにしません。", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.TasuBuilderProviderProfileStcWire = { save, submitProviderForReview, collect };
})(typeof window !== "undefined" ? window : globalThis);
