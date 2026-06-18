/**
 * 2窓ベンチ — 出品者側 管理ページ待機
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readParams() {
    try {
      return new URLSearchParams(global.location.search);
    } catch {
      return new URLSearchParams();
    }
  }

  function resolveProfile() {
    const params = readParams();
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profileId = pickStr(params.get("demoProfile"));
    const connect = params.get("demoConnect") === "1";
    if (Demo?.getProfile && profileId) {
      return Demo.getProfile(profileId, connect);
    }
    return null;
  }

  function panelCopy(profile) {
    const key = pickStr(profile?.categoryKey, profile?.id);
    const Category = global.TasuPlatformChatCategoryFlow;
    const spec = Category?.getCategorySpec?.(key) || {};
    const notify = Category?.getContactNotifyCopy?.(key) || {};
    const buyerRole = pickStr(notify.buyerRole, "相手");
    const cta = pickStr(notify.cta, "確認する");
    const listLabel = pickStr(notify.managementListLabel, "一覧");
    return {
      badge: pickStr(spec.sellerRole, "出品者"),
      title: `通知から${buyerRole}を確認してください`,
      body: `上の通知タブで「${cta}」を押すと、ここに${listLabel}が表示されます。`,
    };
  }

  function render() {
    const profile = resolveProfile();
    const copy = panelCopy(profile);
    const badge = global.document.querySelector("[data-bench-idle-badge]");
    const title = global.document.querySelector("[data-bench-idle-title]");
    const body = global.document.querySelector("[data-bench-idle-body]");
    const listing = global.document.querySelector("[data-bench-idle-listing]");
    const listingTitle = pickStr(profile?.listingTitle, profile?.listingId);

    if (badge) badge.textContent = copy.badge;
    if (title) title.textContent = copy.title;
    if (body) body.textContent = copy.body;
    if (listing) listing.textContent = listingTitle ? `対象：${listingTitle}` : "";
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})(typeof window !== "undefined" ? window : globalThis);
