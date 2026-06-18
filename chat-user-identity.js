/**
 * テスト用: URL の userId で currentUserId / me を上書き（開発のみ）
 * 本番: Supabase Auth / JWT talk_user_id を優先
 * 例: chat-detail.html?roomId=...&userId=u_hiro （要 ?talkDev=1 または localhost）
 */
(function () {
  "use strict";

  const root =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
        ? window
        : {};

  const PROFILE_BY_USER_ID = {
    u_me: {
      displayName: "あなた",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
    },
    u_hiro: {
      displayName: "ひろ",
      avatarUrl: "https://placehold.co/64x64/fff6df/7a5710?text=H",
    },
    u_job_demo_full: {
      displayName: "タスク確認株式会社",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=J",
    },
    u_sachi: {
      displayName: "さちこ",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=S",
    },
    u_store: {
      displayName: "premium_home",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=PH",
    },
    u_bakery: {
      displayName: "TASFUL Bakery",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=BK",
    },
  };

  let urlOverrideWarned = false;

  function getUserIdFromUrl() {
    const params = new URLSearchParams(location.search);
    return String(params.get("userId") || "").trim();
  }

  function getConfigUserId() {
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    return cfg.currentUserId || cfg.me?.id || "u_me";
  }

  function isTalkDevMode() {
    return window.TasuTalkRuntime?.isTalkDevMode?.() === true;
  }

  function isTalkProductionMode() {
    return window.TasuTalkRuntime?.isTalkProductionMode?.() === true;
  }

  function warnUrlOverrideIgnored() {
    if (urlOverrideWarned) return;
    urlOverrideWarned = true;
    console.warn(
      "[TasuChatUserIdentity] ?userId= は本番では無効です。Supabase 認証の talk_user_id を使用してください。"
    );
  }

  function getEffectiveUserId() {
    const authId = window.TasuTalkRuntime?.getAuthTalkUserIdSync?.() || "";
    const fromUrl = getUserIdFromUrl();

    if (isTalkProductionMode()) {
      if (fromUrl) warnUrlOverrideIgnored();
      if (authId) return authId;
      return getConfigUserId();
    }

    if (isTalkDevMode() && fromUrl) return fromUrl;
    if (authId) return authId;
    if (fromUrl) return fromUrl;
    return getConfigUserId();
  }

  function memberAvatarOverride(userId) {
    return window.TasuMemberProfile?.getAvatarUrlForUser?.(userId) || "";
  }

  function resolveProfile(userId) {
    const id = String(userId || "").trim();
    if (root.TasuTalkChatProfile?.resolveProfile) {
      const p = root.TasuTalkChatProfile.resolveProfile(id);
      const known = PROFILE_BY_USER_ID[id];
      const profileName = String(p.display_name || "").trim();
      if (known && (!profileName || profileName === id || /^u_[a-z0-9_]+$/i.test(profileName))) {
        const avatarUrl = memberAvatarOverride(id) || known.avatarUrl;
        return { id, displayName: known.displayName, avatarUrl };
      }
      return {
        id: p.user_id || id,
        displayName: p.display_name,
        avatarUrl: p.profile_image,
        profile: p,
      };
    }
    const known = PROFILE_BY_USER_ID[userId];
    if (known) {
      const avatarUrl = memberAvatarOverride(userId) || known.avatarUrl;
      return { id: userId, displayName: known.displayName, avatarUrl };
    }
    const cfg = window.TASU_CHAT_SUPABASE_CONFIG || {};
    if (cfg.me?.id === userId && cfg.me.displayName) {
      return {
        id: userId,
        displayName: cfg.me.displayName,
        avatarUrl: memberAvatarOverride(userId) || cfg.me.avatarUrl || "",
      };
    }
    const label = userId.slice(0, 2).toUpperCase() || "?";
    const avatarUrl =
      memberAvatarOverride(userId) ||
      `https://placehold.co/64x64/f3ead4/967622?text=${encodeURIComponent(label)}`;
    return {
      id: userId,
      displayName: userId,
      avatarUrl,
    };
  }

  function getEffectiveMeProfile() {
    return resolveProfile(getEffectiveUserId());
  }

  function applyToConfig() {
    const id = getEffectiveUserId();
    const me = getEffectiveMeProfile();
    if (!window.TASU_CHAT_SUPABASE_CONFIG) {
      window.TASU_CHAT_SUPABASE_CONFIG = {};
    }
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = id;
    window.TASU_CHAT_SUPABASE_CONFIG.me = me;
  }

  function appendUserIdToUrl(url) {
    if (isTalkProductionMode()) return url;
    const userId = getUserIdFromUrl();
    if (!userId) return url;
    try {
      const u = new URL(url, location.href);
      u.searchParams.set("userId", userId);
      if (isTalkDevMode()) u.searchParams.set("talkDev", "1");
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}userId=${encodeURIComponent(userId)}&talkDev=1`;
    }
  }

  applyToConfig();

  function getProfileForUserId(userId) {
    return resolveProfile(String(userId || "").trim());
  }

  window.TasuChatUserIdentity = {
    getUserIdFromUrl,
    getEffectiveUserId,
    getEffectiveMeProfile,
    getProfileForUserId,
    applyToConfig,
    appendUserIdToUrl,
    isTalkDevMode,
    isTalkProductionMode,
  };
})();
