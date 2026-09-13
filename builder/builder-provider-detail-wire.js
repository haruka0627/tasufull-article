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

  function loadPublished(row) {
    if (!row) return null;
    const pub = String(row.publicationStatus || row.publication_status || "").toLowerCase();
    const complete = String(row.profileCompletionStatus || row.profile_completion_status || "").toLowerCase();
    if (pub && pub !== "published") return { gated: true, row, reason: "NOT_PUBLISHED" };
    if (complete && complete !== "complete") return { gated: true, row, reason: "INCOMPLETE" };
    return { gated: false, row };
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
    let rec = global.TasuBuilderProviderStore?.get(id) || null;
    if (!rec) {
      try {
        rec = (await global.TasuBuilderPartnerRegisterCore?.load(id)) || null;
      } catch {
        rec = null;
      }
    }
    if (!rec && global.TasuBuilderPartnerSupabaseSync?.getProvider) {
      try {
        rec = await global.TasuBuilderPartnerSupabaseSync.getProvider(id);
      } catch {
        rec = null;
      }
    }
    const published = loadPublished(rec);
    if (published?.gated) {
      const banner = document.querySelector("[data-canonical-provider-demo]");
      if (banner) {
        banner.hidden = false;
        banner.textContent = `公開ゲート未通過（${published.reason}）。Rich 登録は review_pending のため、auto-publish しません。`;
      }
      rec = published.row;
    }
    if (!rec) {
      showDemo(`id=${id} のレコードが見つかりません。デモには差し替えず、未検出を表示します。`);
      text("[data-canonical-provider-name]", "提供者レコードが見つかりません");
      text("[data-canonical-provider-headline]", "COMPAT_CACHE / Staging のいずれにもありません。");
      global.TasuBuilderCtaBind?.bind(root, { id });
      return;
    }
    const demo = document.querySelector("[data-canonical-provider-demo]");
    if (demo && !published?.gated) demo.hidden = true;
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

  global.TasuBuilderProviderDetailWire = { loadPublished };
})(typeof window !== "undefined" ? window : globalThis);
