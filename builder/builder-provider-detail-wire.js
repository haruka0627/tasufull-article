/**
 * TASFUL Builder — provider-detail.html を canonical id で bind。
 * demo は id が無いときだけプレースホルダ。
 */
(function (global) {
  "use strict";

  function text(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val == null || val === "" ? "—" : String(val);
  }

  function join(val) {
    if (Array.isArray(val)) return val.filter(Boolean).join("・") || "—";
    return String(val || "").trim() || "—";
  }

  function showDemo(reason) {
    const banner = document.querySelector("[data-canonical-provider-demo]");
    if (banner) {
      banner.hidden = false;
      banner.textContent = reason;
    }
    text("[data-canonical-provider-name]", "デモ職人（プレースホルダ）");
    text("[data-canonical-provider-entity]", "個人");
    text("[data-canonical-provider-headline]", "id 未指定のためデモ表示です。本番レコードではありません。");
    text("[data-canonical-provider-trades]", "内装・大工");
    text("[data-canonical-provider-areas]", "東京");
    text("[data-canonical-provider-availability]", "空きあり");
  }

  async function init() {
    const root = document.querySelector("[data-canonical-provider-detail]");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id") || "";
    if (!id) {
      showDemo("id が無いためデモプレースホルダを表示しています。");
      global.TasuBuilderCtaBind?.bind(root, {});
      return;
    }
    let rec = null;
    try {
      rec = (await global.TasuBuilderPartnerRegisterCore?.load(id)) || null;
    } catch {
      rec = null;
    }
    if (!rec) rec = global.TasuBuilderProviderStore?.get(id) || null;
    if (!rec) {
      showDemo(`id=${id} のレコードが見つかりません。デモには差し替えず、未検出を表示します。`);
      text("[data-canonical-provider-name]", "提供者レコードが見つかりません");
      text("[data-canonical-provider-headline]", "COMPAT_CACHE / Staging のいずれにもありません。");
      global.TasuBuilderCtaBind?.bind(root, { id });
      return;
    }
    const demo = document.querySelector("[data-canonical-provider-demo]");
    if (demo) demo.hidden = true;
    text("[data-canonical-provider-name]", rec.display_name || rec.name);
    text("[data-canonical-provider-entity]", rec.partner_type === "company" || rec.entity === "法人" ? "法人" : "個人");
    text("[data-canonical-provider-headline]", rec.headline || rec.trade_name || rec.profile);
    text("[data-canonical-provider-trades]", join(rec.trades));
    text("[data-canonical-provider-areas]", join(rec.areas));
    text("[data-canonical-provider-availability]", rec.availability === "available" ? "空きあり" : rec.availability || "—");
    text("[data-canonical-provider-id]", rec.partner_id || rec.id || id);
    const img = document.querySelector("[data-canonical-provider-photo-preview]");
    if (img && rec.photo_data_url) img.src = rec.photo_data_url;
    const edit = document.querySelector("[data-canonical-provider-edit]");
    if (edit) {
      const href = global.TasuBuilderCanonicalRoutes?.providerProfileHref(rec.partner_id || rec.id || id);
      if (href) edit.setAttribute("href", href);
    }
    global.TasuBuilderCtaBind?.bind(root, rec);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
