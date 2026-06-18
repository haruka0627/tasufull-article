/**
 * 2窓ベンチ — 購入者/依頼者 待機画面
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

  function render() {
    const profile = resolveProfile();
    const Live = global.TasuPlatformChatLiveFlow;
    const pre = profile && Live?.readBenchPreStartRecord?.(profile);
    const badge = global.document.querySelector("[data-bench-wait-badge]");
    const title = global.document.querySelector("[data-bench-wait-title]");
    const body = global.document.querySelector("[data-bench-wait-body]");
    const listing = global.document.querySelector("[data-bench-wait-listing]");

    const status = pickStr(pre?.status);
    const listingTitle = pickStr(profile?.listingTitle, profile?.listingId);

    if (badge) {
      if (status === "awaiting_fee") badge.textContent = "支払い待ち";
      else if (status === "rejected") badge.textContent = "見送り";
      else badge.textContent = "購入済み";
    }

    if (title) {
      if (status === "active") title.textContent = "通知を確認してください";
      else if (status === "rejected") title.textContent = "今回は見送りになりました";
      else if (status === "awaiting_fee") title.textContent = "手数料のお支払い待ちです";
      else title.textContent = "出品者の確認待ちです";
    }

    if (body) {
      if (status === "active") {
        body.textContent = "上の通知タブで案内をご確認ください。";
      } else if (status === "rejected") {
        body.textContent = "出品者が今回のやりとりを見送りました。";
      } else if (status === "awaiting_fee") {
        body.textContent = "出品者が確認中です。手数料のお支払い完了後にチャットが開きます。";
      } else {
        body.textContent = "やりとり開始までお待ちください。出品者が購入者一覧で確認すると、次のステップに進みます。";
      }
    }

    if (listing) {
      listing.textContent = listingTitle ? `対象：${listingTitle}` : "";
    }
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  global.addEventListener("storage", (ev) => {
    const key = String(ev.key || "");
    if (
      key === "tasful_listing_contact_requests_v1" ||
      key === "tasful_job_applications_v1" ||
      key === "tasful_worker_requests_v1" ||
      key === "tasful_talk_notifications"
    ) {
      render();
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
