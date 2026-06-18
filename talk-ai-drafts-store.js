/**
 * TASFUL TALK — AI 下書き（Supabase + localStorage キャッシュ）
 * キー: tasful_talk_ai_drafts
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_ai_drafts";
  const SYNC_STORE_ID = "ai";
  const DB_TABLE = "talk_ai_drafts";
  const EVENT_NAME = "tasful-talk-ai-drafts-changed";
  const MAX_DRAFTS = 100;
  const DEFAULT_LIST_LIMIT = 5;

  const VALID_MODES = new Set([
    "qa",
    "ad",
    "notice",
    "project",
    "job",
    "vendor_search",
    "business",
    "shop",
  ]);
  const VALID_STATUS = new Set(["draft", "used", "discarded"]);

  const MODE_LABELS = Object.freeze({
    qa: "QA AI",
    ad: "広告作成AI",
    notice: "通知作成AI",
    project: "案件作成AI",
    job: "求人作成AI",
    business: "業務サービス掲載AI",
    shop: "店舗掲載AI",
    vendor_search: "AI業者検索",
  });

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

  function newId() {
    return `talk-ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /** @param {string} mode */
  function normalizeMode(mode) {
    const m = String(mode || "").toLowerCase();
    if (m === "notification" || m === "notify") return "notice";
    if (m === "advertisement" || m === "広告") return "ad";
    if (VALID_MODES.has(m)) return m;
    return "qa";
  }

  function normalizeStatus(status) {
    const s = String(status || "draft").toLowerCase();
    return VALID_STATUS.has(s) ? s : "draft";
  }

  /**
   * @param {object} raw
   */
  function normalizeDraft(raw) {
    const createdAt = pickStr(raw?.createdAt) || nowIso();
    return {
      id: pickStr(raw?.id) || newId(),
      mode: normalizeMode(raw?.mode),
      input: String(raw?.input ?? ""),
      output: String(raw?.output ?? ""),
      status: normalizeStatus(raw?.status),
      createdAt,
      updatedAt: pickStr(raw?.updatedAt) || createdAt,
    };
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeDraft);
    } catch (err) {
      console.warn("[TasuTalkAiDrafts] read failed:", err);
      return [];
    }
  }

  function writeAll(list, options) {
    const sync = global.TasuTalkSupabaseSync;
    if (sync?.writeLocal && options?.localOnly !== true) {
      return sync.writeLocal(
        {
          id: SYNC_STORE_ID,
          storageKey: STORAGE_KEY,
          eventName: EVENT_NAME,
          maxRows: MAX_DRAFTS,
          normalize: normalizeDraft,
        },
        list,
        { source: options?.source || "write" }
      );
    }
    const safe = Array.isArray(list) ? list.slice(0, MAX_DRAFTS).map(normalizeDraft) : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuTalkAiDrafts] save failed:", err);
    }
    return safe;
  }

  function draftToDbRow(row, userId) {
    const n = normalizeDraft(row);
    return {
      id: n.id,
      user_id: String(userId || ""),
      mode: n.mode,
      input: n.input,
      output: n.output,
      status: n.status,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    };
  }

  function draftFromDbRow(row) {
    if (!row || typeof row !== "object") return null;
    return normalizeDraft({
      id: row.id,
      mode: row.mode,
      input: row.input,
      output: row.output,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  function syncUpsert(row) {
    global.TasuTalkSupabaseSync?.scheduleUpsert?.(SYNC_STORE_ID, row);
  }

  function syncDelete(id) {
    global.TasuTalkSupabaseSync?.scheduleDelete?.(SYNC_STORE_ID, id);
  }

  function sortMerged(list) {
    return list
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function registerSupabaseSync() {
    const sync = global.TasuTalkSupabaseSync;
    if (!sync?.register || sync.__aiDraftsRegistered) return;
    sync.__aiDraftsRegistered = true;
    sync.register({
      id: SYNC_STORE_ID,
      table: DB_TABLE,
      storageKey: STORAGE_KEY,
      eventName: EVENT_NAME,
      maxRows: MAX_DRAFTS,
      orderColumn: "updated_at",
      normalize: normalizeDraft,
      toRow: draftToDbRow,
      fromRow: draftFromDbRow,
      sortMerged,
    });
  }

  function init() {
    registerSupabaseSync();
    return global.TasuTalkSupabaseSync?.initStore?.(SYNC_STORE_ID) || Promise.resolve(readAll());
  }

  function excerpt(text, max) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "（なし）";
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }

  /**
   * @param {{ mode: string, input?: string, output?: string, status?: string }} input
   */
  function add(input) {
    const row = normalizeDraft({
      ...input,
      id: newId(),
      status: input?.status || "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const list = readAll();
    list.unshift(row);
    writeAll(list, { localOnly: true });
    syncUpsert(row);
    return row;
  }

  function findById(id) {
    return readAll().find((d) => String(d.id) === String(id)) || null;
  }

  /**
   * @param {string} id
   * @param {object} patch
   */
  function update(id, patch) {
    const list = readAll();
    const idx = list.findIndex((d) => String(d.id) === String(id));
    if (idx < 0) return null;
    list[idx] = normalizeDraft({
      ...list[idx],
      ...patch,
      id: list[idx].id,
      updatedAt: nowIso(),
    });
    writeAll(list, { localOnly: true });
    syncUpsert(list[idx]);
    return list[idx];
  }

  function remove(id) {
    const before = readAll();
    const list = before.filter((d) => String(d.id) !== String(id));
    writeAll(list, { localOnly: true });
    syncDelete(id);
    return list.length < before.length;
  }

  /**
   * @param {{ limit?: number, includeDiscarded?: boolean }} [options]
   */
  function listRecent(options) {
    const limit = Math.min(Number(options?.limit) || DEFAULT_LIST_LIMIT, 20);
    const includeDiscarded = options?.includeDiscarded === true;
    return readAll()
      .filter((d) => includeDiscarded || d.status !== "discarded")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
  }

  function markUsed(id) {
    return update(id, { status: "used" });
  }

  function markDiscarded(id) {
    return update(id, { status: "discarded" });
  }

  function modeLabel(mode) {
    return MODE_LABELS[normalizeMode(mode)] || mode;
  }

  function canPushAsNotification(mode) {
    const m = normalizeMode(mode);
    return m === "ad" || m === "notice" || m === "project" || m === "job";
  }

  function titleFromOutput(output, mode) {
    const lines = String(output || "")
      .split("\n")
      .map((l) => l.replace(/^【[^】]+】\s*/, "").trim())
      .filter(Boolean);
    const first = lines[0] || "";
    if (first) return first.slice(0, 80);
    return modeLabel(mode) + "の下書き";
  }

  /**
   * AI 下書き → TALK 通知
   * @param {{ mode: string, input?: string, output: string }} draft
   */
  function pushAsNotification(draft) {
    const mode = normalizeMode(draft?.mode);
    if (!canPushAsNotification(mode)) {
      return { ok: false, reason: "not_notifiable_mode" };
    }

    const body = excerpt(draft.output, 200);
    const title = titleFromOutput(draft.output, mode);

    /** @type {{ type: string, title: string, body: string, targetUrl: string, priority: string, source: string }} */
    let payload = {
      type: "system",
      title,
      body,
      targetUrl: "talk-home.html?tab=notify",
      priority: "normal",
      source: "talk-ai",
    };

    if (mode === "notice") {
      payload = {
        type: "system",
        title: title.startsWith("【") ? title : `【お知らせ】${title}`,
        body,
        targetUrl: "talk-home.html?tab=notify",
        priority: "important",
        source: "talk-ai-notice",
      };
    } else if (mode === "ad") {
      payload = {
        type: "system",
        title: title.startsWith("【") ? title : `【広告】${title}`,
        body,
        targetUrl: "talk-home.html?tab=notify",
        priority: "normal",
        source: "talk-ai-ad",
      };
    } else if (mode === "project") {
      payload = {
        type: "skill",
        title: title.startsWith("【") ? title : `【スキル】${title}`,
        body,
        targetUrl: "builder/mvp-project-new.html",
        priority: "important",
        source: "talk-ai-project",
      };
    } else if (mode === "job") {
      payload = {
        type: "job",
        title: title.startsWith("【") ? title : `【求人】${title}`,
        body,
        targetUrl: "post.html?type=job",
        priority: "important",
        source: "talk-ai-job",
      };
    }

    try {
      if (typeof global.TasuTalkData?.addNotification === "function") {
        const row = global.TasuTalkData.addNotification(payload);
        return { ok: true, notification: row };
      }
      const store = global.TasuTalkNotifications;
      if (store?.add) {
        const row = store.add(payload);
        return { ok: true, notification: row };
      }
      return { ok: false, reason: "notify_store_missing" };
    } catch (err) {
      console.warn("[TasuTalkAiDrafts] pushAsNotification failed:", err);
      return { ok: false, reason: err?.message || String(err) };
    }
  }

  function canApplyToPostForm(mode) {
    const m = normalizeMode(mode);
    return m === "project" || m === "job" || m === "business" || m === "shop";
  }

  function buildPostFormApplyUrl(mode, draftId) {
    const id = pickStr(draftId);
    if (!id || !canApplyToPostForm(mode)) return null;
    const m = normalizeMode(mode);
    if (m === "project") {
      return `builder/mvp-project-new.html?talkDraftId=${encodeURIComponent(id)}`;
    }
    if (m === "job") {
      return `post.html?type=job&talkDraftId=${encodeURIComponent(id)}`;
    }
    if (m === "shop") {
      return `post.html?scope=business&postType=shop-store&talkDraftId=${encodeURIComponent(id)}`;
    }
    return `post.html?scope=business&talkDraftId=${encodeURIComponent(id)}`;
  }

  registerSupabaseSync();

  global.TasuTalkAiDrafts = {
    STORAGE_KEY,
    DB_TABLE,
    SYNC_STORE_ID,
    EVENT_NAME,
    init,
    VALID_MODES,
    VALID_STATUS,
    MODE_LABELS,
    normalizeMode,
    readAll,
    add,
    findById,
    update,
    remove,
    listRecent,
    markUsed,
    markDiscarded,
    modeLabel,
    excerpt,
    canPushAsNotification,
    canApplyToPostForm,
    buildPostFormApplyUrl,
    pushAsNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
