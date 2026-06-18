/**
 * TASFUL TALK — 配信対象ユーザー（モック / 将来 Supabase）
 */
(function (global) {
  "use strict";

  /** @type {Readonly<Record<string, ReadonlyArray<{ id: string, label?: string }>>>} */
  const MOCK_BY_SEGMENT = Object.freeze({
    all: [
      { id: "u_me", label: "あなた" },
      { id: "u_hiro", label: "ひろ" },
      { id: "u_sachi", label: "さちこ" },
      { id: "u_store", label: "店舗" },
    ],
    construction: [
      { id: "u_me", label: "あなた" },
      { id: "u_store", label: "店舗" },
    ],
    job: [{ id: "u_hiro", label: "ひろ" }],
    business_service: [{ id: "u_sachi", label: "さちこ" }],
    shop: [{ id: "u_store", label: "店舗" }],
    anpi: [{ id: "u_me", label: "あなた" }],
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getSenderUserId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function normalizeSegmentId(segmentId) {
    const s = String(segmentId || "all").trim();
    if (s === "business") return "business_service";
    return s;
  }

  /**
   * セグメント別モック受信者（初回は少人数）
   * @param {string} segmentId
   * @returns {Promise<Array<{ id: string, label?: string }>>}
   */
  async function resolveRecipients(segmentId) {
    const seg = normalizeSegmentId(segmentId);
    const mock = MOCK_BY_SEGMENT[seg] || MOCK_BY_SEGMENT.all || [];
    const unique = new Map();
    mock.forEach((u) => {
      if (u?.id) unique.set(String(u.id), { id: String(u.id), label: u.label || u.id });
    });

    if (global.TasuTalkSupabaseSync?.isAvailable?.()) {
      try {
        const remote = await fetchRecipientsFromSupabase(seg);
        if (remote?.length) {
          remote.forEach((u) => {
            if (u?.id) unique.set(String(u.id), u);
          });
        }
      } catch (err) {
        console.warn("[TasuTalkBroadcastAudience] supabase fetch skipped:", err);
      }
    }

    return Array.from(unique.values());
  }

  /**
   * 将来: talk_broadcast_audience 等のテーブルから取得
   * @param {string} segmentId
   */
  async function fetchRecipientsFromSupabase(segmentId) {
    const sb = global.TasuSupabase?.getClient?.();
    if (!sb) return null;
    const table = global.TASU_CHAT_SUPABASE_CONFIG?.talkBroadcastAudienceTable;
    if (!table) return null;

    const { data, error } = await sb
      .from(table)
      .select("user_id, display_name")
      .eq("segment", segmentId)
      .limit(500);
    if (error) {
      console.warn("[TasuTalkBroadcastAudience] fetch failed:", error.message || error);
      return null;
    }
    if (!Array.isArray(data)) return null;
    return data.map((row) => ({
      id: String(row.user_id || "").trim(),
      label: String(row.display_name || row.user_id || "").trim(),
    })).filter((u) => u.id);
  }

  global.TasuTalkBroadcastAudience = {
    MOCK_BY_SEGMENT,
    getSenderUserId,
    resolveRecipients,
    normalizeSegmentId,
  };
})(typeof window !== "undefined" ? window : globalThis);
