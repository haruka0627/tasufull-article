/**
 * TASFUL TALK — 友達メモ（自分だけが見る）
 * 将来 Supabase: talk_friend_private_notes
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_friend_memo_v1";
  const EVENT_NAME = "tasful-talk-friend-memo-changed";
  const DB_TABLE = "talk_friend_private_notes";

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

  function readMap() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMap(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: map }));
    } catch {
      /* ignore */
    }
  }

  function resolveTargetUserId(target) {
    return pickStr(
      typeof target === "string" ? target : null,
      target?.userId,
      target?.partnerUserId,
      target?.partner?.id,
      target?.partnerProfile?.user_id
    );
  }

  function getMemo(target) {
    const userId = resolveTargetUserId(target);
    if (!userId) return "";
    return pickStr(readMap()[userId]?.text);
  }

  function saveMemo(target, text) {
    const userId = resolveTargetUserId(target);
    if (!userId) return null;
    const map = readMap();
    const body = String(text ?? "");
    if (!body.trim()) {
      delete map[userId];
      writeMap(map);
      return null;
    }
    map[userId] = { text: body, updatedAt: nowIso() };
    writeMap(map);
    return map[userId];
  }

  global.TasuTalkFriendMemoStore = {
    STORAGE_KEY,
    EVENT_NAME,
    DB_TABLE,
    getMemo,
    saveMemo,
    resolveTargetUserId,
  };
})(typeof window !== "undefined" ? window : globalThis);
