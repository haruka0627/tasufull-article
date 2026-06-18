/**
 * TASFUL TALK — 利用者 / 運営 通知オーディエンス分離
 */
(function (global) {
  "use strict";

  const OPS_TALK_PAGE = "talk-home.html";
  const AUDIENCE_USER = "user";
  const AUDIENCE_ADMIN_OPS = "admin_ops";

  const ADMIN_OPS_SOURCES = new Set([
    "ops_watch",
    "talk-ops-assistant",
    "admin_ai",
    "admin_ops",
    "ops_watch_analyzer",
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isAdminOpsNotification(row) {
    if (!row || typeof row !== "object") return false;
    const scope = pickStr(row.audienceScope, row.audience_scope);
    if (scope === AUDIENCE_ADMIN_OPS) return true;
    const source = String(row.source || "").toLowerCase();
    if (ADMIN_OPS_SOURCES.has(source)) return true;
    if (source === "support" && row.adminOnly === true) return true;
    if (global.TasuTalkBuilderNotifyMaster?.isAdminOpsBuilderNotification?.(row)) return true;
    const tags = Array.isArray(row.notifyTags) ? row.notifyTags : [];
    if (tags.includes("admin_ops")) return true;
    return false;
  }

  function isUserFacingNotification(row) {
    return !isAdminOpsNotification(row);
  }

  function withAdminOpsAudience(input) {
    return {
      ...(input || {}),
      audienceScope: AUDIENCE_ADMIN_OPS,
      sendTalkMessage: false,
      sendNotification: input?.sendNotification !== false,
      officialRoomId: null,
    };
  }

  function getCurrentAudience() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const fromUrl = pickStr(params.get("audience"));
      if (fromUrl === AUDIENCE_ADMIN_OPS || fromUrl === AUDIENCE_USER) return fromUrl;
    } catch {
      /* ignore */
    }
    const page = currentPageId();
    if (page === "ops-talk") return AUDIENCE_ADMIN_OPS;
    const bodyAudience = pickStr(global.document?.body?.dataset?.talkAudience);
    if (bodyAudience === AUDIENCE_ADMIN_OPS) return AUDIENCE_ADMIN_OPS;
    return AUDIENCE_USER;
  }

  function isAdminOpsTalkContext() {
    return getCurrentAudience() === AUDIENCE_ADMIN_OPS;
  }

  function opsTalkUrl(search = "") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    params.set("audience", AUDIENCE_ADMIN_OPS);
    params.set("tab", params.get("tab") || "chat");
    params.set("talkAdmin", "1");
    return `${OPS_TALK_PAGE}?${params.toString()}`;
  }

  /** @deprecated use opsTalkUrl */
  function legacyOpsTalkAliasUrl(search = "") {
    const q = search.startsWith("?") ? search : search ? `?${search}` : "";
    return `ops-talk.html${q || "?talkAdmin=1"}`;
  }

  function filterUserTalkNotifications(list) {
    return (list || []).filter(isUserFacingNotification);
  }

  function filterOpsTalkNotifications(list) {
    return (list || []).filter(isAdminOpsNotification);
  }

  function currentPageId() {
    return String(document.body?.dataset?.page || "").trim();
  }

  function isOpsTalkPage() {
    if (isAdminOpsTalkContext()) return true;
    const page = currentPageId();
    return page === "ops-talk" || page === "talk-ops-room";
  }

  function shouldSyncOpsAssistantHere() {
    const page = currentPageId();
    if (page === "talk-ops-room" || page === "admin-operations-dashboard") return true;
    return isAdminOpsTalkContext();
  }

  function badgeForNotification(row) {
    const source = String(row?.source || "").toLowerCase();
    const category = pickStr(row?.category);
    if (source === "ops_watch") return "監視";
    if (category === "Connect" || /connect/i.test(String(row?.title || ""))) return "Connect";
    if (category === "安否" || String(row?.type || "") === "anpi") return "安否";
    if (/通報|report/i.test(String(row?.title || ""))) return "通報";
    if (/返金|refund/i.test(String(row?.title || ""))) return "決済";
    if (/RLS|security/i.test(String(row?.title || ""))) return "RLS";
    if (source === "support") return "問い合わせ";
    if (source === "ai_ops" || /AI提案/.test(String(row?.title || ""))) return "AI提案";
    return "重要";
  }

  global.TasuTalkNotifyAudience = {
    OPS_TALK_PAGE,
    AUDIENCE_USER,
    AUDIENCE_ADMIN_OPS,
    getCurrentAudience,
    isAdminOpsTalkContext,
    isAdminOpsNotification,
    isUserFacingNotification,
    withAdminOpsAudience,
    opsTalkUrl,
    legacyOpsTalkAliasUrl,
    filterUserTalkNotifications,
    filterOpsTalkNotifications,
    isOpsTalkPage,
    shouldSyncOpsAssistantHere,
    badgeForNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
