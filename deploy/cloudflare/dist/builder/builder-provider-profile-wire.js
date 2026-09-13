/**
 * TASFUL Builder — provider-profile.html → PartnerSupabaseSync / ProviderStore
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
      furigana: g("furigana", "[data-canonical-provider-furigana]"),
      trade_name: g("trade_name", "[data-canonical-provider-trade-name]"),
      headline: g("headline", "[data-canonical-provider-headline]") || g("trade_name", "[data-canonical-provider-trade-name]"),
      partner_type: entity === "company" || entity === "法人" ? "company" : "individual",
      trades: g("trades", "[data-canonical-provider-trades]"),
      areas: g("areas", "[data-canonical-provider-areas]"),
      availability: g("availability", "[data-canonical-provider-availability]") || "available",
      profile: g("furigana", "[data-canonical-provider-furigana]"),
      photo_data_url: form.dataset.photoDataUrl || "",
    };
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function fill(form, record) {
    if (!record) return;
    const set = (attr, val) => {
      const el = form.querySelector(attr);
      if (el && val != null) el.value = String(val);
    };
    set("[data-canonical-provider-name]", record.display_name || record.name);
    set("[data-canonical-provider-furigana]", record.furigana || record.profile);
    set("[data-canonical-provider-trade-name]", record.trade_name || record.headline);
    set("[data-canonical-provider-trades]", Array.isArray(record.trades) ? record.trades.join(", ") : record.trades);
    set("[data-canonical-provider-areas]", Array.isArray(record.areas) ? record.areas.join(", ") : record.areas);
    const entity = form.querySelector("[data-canonical-provider-entity]");
    if (entity) entity.value = record.partner_type === "company" ? "company" : "individual";
  }

  async function init() {
    const form = document.querySelector("[data-canonical-provider-form]");
    if (!form || form.dataset.wired === "1") return;
    form.dataset.wired = "1";
    const status = document.querySelector("[data-canonical-provider-status]");
    const id = new URLSearchParams(location.search).get("id") || "";
    if (id && global.TasuBuilderPartnerRegisterCore?.load) {
      const rec = await global.TasuBuilderPartnerRegisterCore.load(id);
      if (rec) fill(form, rec);
    }

    const photoInput = form.querySelector("[data-canonical-provider-photo]");
    photoInput?.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        form.dataset.photoDataUrl = String(reader.result || "");
        const img = document.querySelector("[data-canonical-provider-photo-preview]");
        if (img) img.src = form.dataset.photoDataUrl;
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const core = global.TasuBuilderPartnerRegisterCore;
      if (!core) {
        setStatus(status, "登録コアが未読み込みです。成功扱いにしません。", "error");
        return;
      }
      const fields = collect(form);
      const btn = form.querySelector("[data-canonical-provider-submit], button[type='submit']");
      if (btn) btn.disabled = true;
      try {
        const res = await core.save(fields, { requireName: true });
        if (!res.ok) {
          setStatus(status, `登録できません（${(res.errors || [res.reason]).join(", ")}）。`, "error");
          return;
        }
        if (res.supabase?.attempted && !res.supabase.ok && !res.supabase.skipped) {
          setStatus(status, "Staging 同期は失敗しました。ProviderStore COMPAT_CACHE のみ保存。", "warn");
        } else if (res.supabase?.ok) {
          setStatus(status, "Staging に保存しました。詳細へ移動します。", "ok");
        } else {
          setStatus(status, "ProviderStore COMPAT_CACHE に保存しました。詳細へ移動します。", "ok");
        }
        window.location.href = res.redirect;
      } catch {
        setStatus(status, "登録処理で例外が発生しました。成功扱いにしません。", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
