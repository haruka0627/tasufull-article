/**
 * TASFUL TALK — 友達追加 / グループ作成（mock store）
 * 将来 Supabase: talk_friend_requests, talk_groups
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_friend_hub_v1";
  const EVENT_NAME = "tasful-talk-friend-hub-changed";
  const DB_TABLE_REQUESTS = "talk_friend_requests";
  const DB_TABLE_GROUPS = "talk_groups";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function readRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return { inviteLinks: [], pendingRequests: [], groups: [] };
      const parsed = JSON.parse(raw);
      return {
        inviteLinks: Array.isArray(parsed.inviteLinks) ? parsed.inviteLinks : [],
        pendingRequests: Array.isArray(parsed.pendingRequests) ? parsed.pendingRequests : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      };
    } catch {
      return { inviteLinks: [], pendingRequests: [], groups: [] };
    }
  }

  function writeRaw(next) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    } catch {
      /* ignore */
    }
  }

  function getMyInviteCode() {
    const uid =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me";
    return `TALK-${String(uid).replace(/^u_/, "").slice(0, 8).toUpperCase() || "ME"}`;
  }

  function buildInviteUrl() {
    const code = getMyInviteCode();
    const base = pickStr(global.location?.origin, "https://tasful.app");
    return `${base}/talk-home.html?tab=chat&invite=${encodeURIComponent(code)}`;
  }

  /**
   * @param {{ method: string, query?: string, note?: string }} input
   */
  function createPendingRequest(input) {
    const method = pickStr(input?.method);
    const query = pickStr(input?.query);
    if (!method || !query) return null;
    const data = readRaw();
    const row = {
      id: `fr_${Date.now()}`,
      method,
      query,
      note: pickStr(input?.note),
      status: "pending",
      createdAt: nowIso(),
    };
    data.pendingRequests = [row, ...data.pendingRequests].slice(0, 100);
    writeRaw(data);
    return row;
  }

  function createInviteLink() {
    const data = readRaw();
    const url = buildInviteUrl();
    const row = {
      id: `inv_${Date.now()}`,
      url,
      code: getMyInviteCode(),
      createdAt: nowIso(),
      expiresAt: null,
    };
    data.inviteLinks = [row, ...data.inviteLinks].slice(0, 20);
    writeRaw(data);
    return row;
  }

  /**
   * @param {{ name: string, memberIds?: string[], note?: string }} input
   */
  function createGroupDraft(input) {
    const name = pickStr(input?.name);
    if (!name) return null;
    const data = readRaw();
    const row = {
      id: `grp_${Date.now()}`,
      name,
      memberIds: Array.isArray(input?.memberIds) ? input.memberIds.map(String) : [],
      note: pickStr(input?.note),
      createdAt: nowIso(),
      threadId: `talk-group-${Date.now()}`,
    };
    data.groups = [row, ...data.groups].slice(0, 50);
    writeRaw(data);
    return row;
  }

  function searchByPhone(phone) {
    const q = pickStr(phone).replace(/\D/g, "");
    if (q.length < 4) return [];
    return [
      {
        userId: "u_demo_phone_001",
        displayName: "佐藤 花子",
        phoneMasked: `***-****-${q.slice(-4)}`,
        statusMessage: "TALK ID: sato_hana",
      },
    ];
  }

  function searchById(idQuery) {
    const q = pickStr(idQuery).toLowerCase();
    if (q.length < 2) return [];
    return [
      {
        userId: "u_demo_id_001",
        displayName: "山田 太郎",
        talkId: q.includes("@") ? q : `@${q}`,
        statusMessage: "よろしくお願いします",
      },
    ];
  }

  global.TasuTalkFriendHubStore = {
    STORAGE_KEY,
    EVENT_NAME,
    DB_TABLE_REQUESTS,
    DB_TABLE_GROUPS,
    readRaw,
    getMyInviteCode,
    buildInviteUrl,
    createPendingRequest,
    createInviteLink,
    createGroupDraft,
    searchByPhone,
    searchById,
  };
})(typeof window !== "undefined" ? window : globalThis);
