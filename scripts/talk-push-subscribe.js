/**
 * TASFUL TALK — Web Push subscription helper（Phase7 最小）
 *
 * - permission が granted の場合のみ subscribe
 * - default / denied では requestPermission しない
 * - VAPID public key 未設定なら skip
 */
(function (global) {
  "use strict";

  const SW_URL = "/talk-service-worker.js";
  const SW_SCOPE = "/";
  const SUBSCRIPTIONS_TABLE = "talk_push_subscriptions";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getVapidPublicKey() {
    const cfg = global.TASU_TALK_CALL_CONFIG || {};
    return pickStr(
      cfg.webPushVapidPublicKey,
      cfg.WEB_PUSH_VAPID_PUBLIC_KEY,
      cfg.vapidPublicKey,
      cfg.VAPID_PUBLIC_KEY,
      global.TASFUL_TALK_VAPID_PUBLIC_KEY,
      global.WEB_PUSH_VAPID_PUBLIC_KEY
    );
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      ""
    );
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isPushSubscribeEnabled() {
    const cfg = global.TASU_TALK_CALL_CONFIG || {};
    if (cfg.pushSubscribeEnabled === false) return false;
    return true;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = global.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      await navigator.serviceWorker.ready;
      return reg;
    } catch {
      return null;
    }
  }

  async function upsertSubscription(userId, subscription) {
    const sb = getClient();
    if (!sb || !subscription?.endpoint) return { ok: false, reason: "no_client" };

    const json = subscription.toJSON();
    const keys = json.keys || {};
    const row = {
      user_id: userId,
      endpoint: String(subscription.endpoint),
      p256dh_key: String(keys.p256dh || ""),
      auth_key: String(keys.auth || ""),
      status: "active",
      user_agent: String(navigator.userAgent || "").slice(0, 512),
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from(SUBSCRIPTIONS_TABLE).upsert(row, {
      onConflict: "user_id,endpoint",
    });
    if (error) {
      console.warn("[TasuTalkPushSubscribe] upsert:", error.message || error);
      return { ok: false, reason: "upsert_failed" };
    }
    return { ok: true };
  }

  async function trySyncSubscription(options) {
    if (!isPushSubscribeEnabled()) return { ok: false, skipped: true, reason: "disabled" };
    if (!("PushManager" in global) || !("Notification" in global)) {
      return { ok: false, skipped: true, reason: "unsupported" };
    }

    const permission = Notification.permission;
    if (permission !== "granted") {
      return { ok: false, skipped: true, reason: `permission_${permission || "default"}` };
    }

    const vapidKey = pickStr(options?.vapidPublicKey, getVapidPublicKey());
    if (!vapidKey) {
      return { ok: false, skipped: true, reason: "vapid_unconfigured" };
    }

    const userId = pickStr(options?.userId, getMeId());
    if (!userId) {
      return { ok: false, skipped: true, reason: "no_user" };
    }

    const reg = await registerServiceWorker();
    if (!reg?.pushManager) {
      return { ok: false, skipped: true, reason: "no_sw" };
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch (err) {
        console.warn("[TasuTalkPushSubscribe] subscribe:", err?.message || err);
        return { ok: false, reason: "subscribe_failed" };
      }
    }

    return upsertSubscription(userId, subscription);
  }

  global.TasuTalkPushSubscribe = {
    SW_URL,
    SW_SCOPE,
    getVapidPublicKey,
    trySyncSubscription,
    registerServiceWorker,
  };
})(typeof window !== "undefined" ? window : globalThis);
