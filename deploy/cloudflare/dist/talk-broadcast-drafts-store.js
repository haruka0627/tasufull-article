/**
 * TASFUL TALK — 配信下書き（Supabase + localStorage キャッシュ）
 * キー: tasful_talk_broadcast_drafts
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_broadcast_drafts";
  const SYNC_STORE_ID = "broadcast";
  const DB_TABLE = "talk_broadcast_drafts";
  const EVENT_NAME = "tasful-talk-broadcast-drafts-changed";
  const MAX_ROWS = 100;
  const DEFAULT_LIST_LIMIT = 5;
  const SEND_QUEUE_KEY = "tasful_talk_broadcast_send_queue";

  const VALID_KINDS = new Set([
    "ad",
    "notice",
    "anpi",
    "skill",
    "job",
    "shop",
    "business",
    "builder",
    "system",
    "project",
  ]);
  const VALID_STATUS = new Set(["draft", "scheduled", "sent", "discarded"]);
  const VALID_PRIORITIES = new Set(["normal", "important", "urgent"]);
  const BROADCAST_AI_KINDS = new Set(["ad", "notice"]);

  const KIND_LABELS = Object.freeze({
    ad: "広告",
    notice: "通知",
    anpi: "安否",
    skill: "スキル",
    job: "求人",
    shop: "店舗・販売",
    business: "業務サービス",
    builder: "Builder",
    system: "運営",
    project: "スキル",
  });

  const STATUS_LABELS = Object.freeze({
    draft: "下書き",
    scheduled: "予約",
    sent: "送信済み",
    discarded: "破棄",
  });

  const PRIORITY_LABELS = Object.freeze({
    normal: "通常",
    important: "重要",
    urgent: "緊急",
  });

  /** @type {ReadonlyArray<{ id: string, label: string, count: number }>} */
  const TARGET_SEGMENTS = Object.freeze([
    { id: "all", label: "全ユーザー", count: 1280 },
    { id: "construction", label: "建設ユーザー", count: 320 },
    { id: "job", label: "求人ユーザー", count: 210 },
    { id: "business_service", label: "業務サービスユーザー", count: 180 },
    { id: "shop", label: "店舗・販売ユーザー", count: 140 },
    { id: "anpi", label: "安否サービス利用者", count: 52 },
  ]);

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
    return `talk-bcast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeKind(kind) {
    if (global.TasuTalkCategory?.normalizeBroadcastKind) {
      return global.TasuTalkCategory.normalizeBroadcastKind(kind);
    }
    const k = String(kind || "").toLowerCase();
    if (k === "notification" || k === "notify") return "notice";
    if (k === "advertisement" || k === "広告") return "ad";
    return VALID_KINDS.has(k) ? k : "system";
  }

  function normalizeStatus(status) {
    const s = String(status || "draft").toLowerCase();
    return VALID_STATUS.has(s) ? s : "draft";
  }

  function normalizePriority(priority) {
    const p = String(priority || "normal").toLowerCase();
    return VALID_PRIORITIES.has(p) ? p : "normal";
  }

  function segmentById(id) {
    return TARGET_SEGMENTS.find((s) => s.id === id) || null;
  }

  function resolveTargetCount(segmentId) {
    const seg = segmentById(segmentId);
    return seg ? seg.count : 0;
  }

  function titleFromBody(body, kind) {
    const lines = String(body || "")
      .split("\n")
      .map((l) => l.replace(/^【[^】]+】\s*/, "").trim())
      .filter(Boolean);
    const first = lines[0] || "";
    if (first) return first.slice(0, 80);
    return `${KIND_LABELS[normalizeKind(kind)] || "配信"}の下書き`;
  }

  /**
   * @param {object} raw
   */
  function normalizeRow(raw) {
    const createdAt = pickStr(raw?.createdAt) || nowIso();
    const segmentId = pickStr(raw?.targetSegment, raw?.segment) || "all";
    const kind = normalizeKind(raw?.kind);
    return {
      id: pickStr(raw?.id) || newId(),
      sourceDraftId: pickStr(raw?.sourceDraftId) || "",
      kind,
      title: pickStr(raw?.title) || titleFromBody(raw?.body, kind),
      body: String(raw?.body ?? ""),
      targetSegment: segmentId,
      targetCount: Number.isFinite(Number(raw?.targetCount))
        ? Math.max(0, Math.floor(Number(raw.targetCount)))
        : resolveTargetCount(segmentId),
      status: normalizeStatus(raw?.status),
      priority: normalizePriority(raw?.priority),
      createdAt,
      updatedAt: pickStr(raw?.updatedAt) || createdAt,
      scheduledAt:
        raw && Object.prototype.hasOwnProperty.call(raw, "scheduledAt") && raw.scheduledAt == null
          ? null
          : pickStr(raw?.scheduledAt) || null,
      sentAt:
        raw && Object.prototype.hasOwnProperty.call(raw, "sentAt") && raw.sentAt == null
          ? null
          : pickStr(raw?.sentAt) || null,
      targetUrl: pickStr(raw?.targetUrl, raw?.target_url) || defaultTargetUrl(kind),
      sendHistory: normalizeSendHistory(raw?.sendHistory),
    };
  }

  function defaultTargetUrl(kind) {
    const k = normalizeKind(kind);
    if (k === "skill" || k === "project") return "post.html?type=skill";
    if (k === "job") return "post.html?type=job";
    if (k === "shop") return "post.html?type=shop";
    if (k === "business") return "post.html?type=business";
    if (k === "builder") return "builder/mvp-project-new.html";
    return "talk-home.html?tab=notify";
  }

  function kindToNotifyType(kind, data) {
    if (global.TasuTalkCategory?.broadcastKindToNotifyType) {
      return global.TasuTalkCategory.broadcastKindToNotifyType(kind, data);
    }
    const k = normalizeKind(kind);
    if (k === "job") return "job";
    return "system";
  }

  /** @param {unknown} raw */
  function normalizeSendHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => ({
        id: pickStr(entry?.id) || `bcast-log-${Date.now()}`,
        sentAt: pickStr(entry?.sentAt) || nowIso(),
        targetSegment: pickStr(entry?.targetSegment) || "all",
        recipientCount: Math.max(0, Number(entry?.recipientCount) || 0),
        deliveredCount: Math.max(0, Number(entry?.deliveredCount) || 0),
        failedCount: Math.max(0, Number(entry?.failedCount) || 0),
        deliveryMode: pickStr(entry?.deliveryMode) || "unknown",
        recipientIds: Array.isArray(entry?.recipientIds)
          ? entry.recipientIds.map(String).slice(0, 20)
          : [],
      }))
      .slice(0, 30);
  }

  function canBroadcastSend(row) {
    const s = normalizeStatus(row?.status);
    return s === "draft" || s === "scheduled";
  }

  function canMockBroadcastSend(row) {
    return canBroadcastSend(row);
  }

  function isOnline() {
    return global.navigator?.onLine !== false;
  }

  function readSendQueue() {
    try {
      const raw = global.localStorage.getItem(SEND_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function writeSendQueue(ids) {
    try {
      global.localStorage.setItem(SEND_QUEUE_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] send queue write failed:", err);
    }
  }

  function enqueueBroadcastSend(id) {
    const sid = String(id || "").trim();
    if (!sid) return;
    const q = readSendQueue();
    if (!q.includes(sid)) {
      q.push(sid);
      writeSendQueue(q);
    }
  }

  async function flushBroadcastSendQueue() {
    if (!isOnline()) return [];
    const queue = readSendQueue();
    const remaining = [];
    for (const id of queue) {
      const result = await sendBroadcastDraft(id);
      if (!result?.ok) remaining.push(id);
    }
    writeSendQueue(remaining);
    return remaining;
  }

  /**
   * @param {object} row
   * @param {string} userId
   */
  function buildNotificationPayload(row, userId) {
    const kind = normalizeKind(row?.kind);
    const type = kindToNotifyType(kind, { ...row, kind, listingType: kind });
    const title = pickStr(row?.title) || titleFromBody(row?.body, kind);
    const body = String(row?.body ?? "").slice(0, 500);
    const segment = segmentLabel(row?.targetSegment);
    const notifyBody = [
      body,
      "",
      `【一斉配信】${segment}（${String(row?.targetCount ?? 0)}名）`,
    ]
      .join("\n")
      .trim();

    const displayTitle = title.startsWith("【")
      ? title
      : `【${KIND_LABELS[kind] || "配信"}】${title}`;

    return {
      id: `talk-n-bcast-${row.id}-${userId}`,
      type,
      title: displayTitle,
      body: notifyBody,
      targetUrl: pickStr(row?.targetUrl) || defaultTargetUrl(kind),
      priority: normalizePriority(row?.priority),
      source: "talk-broadcast-draft-send",
      broadcastDraftId: row.id,
      createdAt: nowIso(),
      readAt: null,
    };
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeRow);
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] read failed:", err);
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
          maxRows: MAX_ROWS,
          normalize: normalizeRow,
        },
        list,
        { source: options?.source || "write" }
      );
    }
    const safe = Array.isArray(list) ? list.slice(0, MAX_ROWS).map(normalizeRow) : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] save failed:", err);
    }
    return safe;
  }

  function rowToDb(row, userId) {
    const n = normalizeRow(row);
    return {
      id: n.id,
      user_id: String(userId || ""),
      source_draft_id: n.sourceDraftId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      target_segment: n.targetSegment,
      target_count: n.targetCount,
      status: n.status,
      priority: n.priority,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
      sent_at: n.sentAt || null,
      scheduled_at: n.scheduledAt || null,
      target_url: n.targetUrl,
      send_history: n.sendHistory,
    };
  }

  function rowFromDb(row) {
    if (!row || typeof row !== "object") return null;
    return normalizeRow({
      id: row.id,
      sourceDraftId: row.source_draft_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      targetSegment: row.target_segment,
      targetCount: row.target_count,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      targetUrl: row.target_url,
      sendHistory: row.send_history,
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
    if (!sync?.register || sync.__broadcastDraftsRegistered) return;
    sync.__broadcastDraftsRegistered = true;
    sync.register({
      id: SYNC_STORE_ID,
      table: DB_TABLE,
      storageKey: STORAGE_KEY,
      eventName: EVENT_NAME,
      maxRows: MAX_ROWS,
      orderColumn: "updated_at",
      normalize: normalizeRow,
      toRow: rowToDb,
      fromRow: rowFromDb,
      sortMerged,
    });
  }

  function init() {
    registerSupabaseSync();
    if (!global.__talkBroadcastSendQueueOnlineBound) {
      global.__talkBroadcastSendQueueOnlineBound = true;
      global.addEventListener("online", () => {
        flushBroadcastSendQueue().catch((err) => {
          console.warn("[TasuTalkBroadcastDrafts] flush queue failed:", err);
        });
      });
    }
    const p = global.TasuTalkSupabaseSync?.initStore?.(SYNC_STORE_ID) || Promise.resolve(readAll());
    return Promise.resolve(p).then((list) => {
      flushBroadcastSendQueue();
      return list;
    });
  }

  function findById(id) {
    return readAll().find((r) => String(r.id) === String(id)) || null;
  }

  /**
   * @param {object} input
   */
  function add(input) {
    const segmentId = pickStr(input?.targetSegment) || "all";
    const row = normalizeRow({
      ...input,
      id: newId(),
      targetSegment: segmentId,
      targetCount: input?.targetCount ?? resolveTargetCount(segmentId),
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

  function update(id, patch) {
    const list = readAll();
    const idx = list.findIndex((r) => String(r.id) === String(id));
    if (idx < 0) return null;
    const segmentId = pickStr(patch?.targetSegment, list[idx].targetSegment) || "all";
    list[idx] = normalizeRow({
      ...list[idx],
      ...patch,
      id: list[idx].id,
      targetSegment: segmentId,
      targetCount: patch?.targetCount ?? resolveTargetCount(segmentId),
      updatedAt: nowIso(),
    });
    writeAll(list, { localOnly: true });
    syncUpsert(list[idx]);
    return list[idx];
  }

  function remove(id) {
    const before = readAll().length;
    const list = readAll().filter((r) => String(r.id) !== String(id));
    writeAll(list, { localOnly: true });
    syncDelete(id);
    return list.length < before;
  }

  /**
   * @param {{ limit?: number }} [options]
   */
  function listRecent(options) {
    const limit = Math.min(Number(options?.limit) || DEFAULT_LIST_LIMIT, 20);
    return readAll()
      .filter((r) => r.status !== "discarded")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
  }

  /**
   * 未送信・予約の配信下書き
   * @param {{ limit?: number }} [options]
   */
  function listPending(options) {
    const limit = Math.min(Number(options?.limit) || DEFAULT_LIST_LIMIT, 20);
    return readAll()
      .filter((r) => r.status === "draft" || r.status === "scheduled")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
  }

  function aiModeForBroadcast(mode) {
    return (
      global.TasuTalkAiDrafts?.normalizeMode?.(mode) ||
      global.TasuTalkAi?.normalizeMode?.(mode) ||
      String(mode || "").toLowerCase()
    );
  }

  function canSaveFromAiMode(mode) {
    return BROADCAST_AI_KINDS.has(aiModeForBroadcast(mode));
  }

  function kindFromAiMode(mode) {
    const m = aiModeForBroadcast(mode);
    return BROADCAST_AI_KINDS.has(m) ? m : normalizeKind(mode);
  }

  /**
   * AI下書きIDを確保（未保存なら先にAI下書きへ保存）
   * @param {{ draftId?: string, mode: string, input?: string, output?: string }} payload
   */
  function ensureSourceDraftId(payload) {
    const existing = pickStr(payload?.draftId);
    if (existing) return existing;
    try {
      const row = global.TasuTalkAiDrafts?.add?.({
        mode: global.TasuTalkAiDrafts?.normalizeMode?.(payload?.mode) || payload?.mode,
        input: payload?.input || "",
        output: payload?.output || "",
        status: "draft",
      });
      return row?.id || "";
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] ensureSourceDraftId failed:", err);
      return "";
    }
  }

  function segmentLabel(segmentId) {
    return segmentById(segmentId)?.label || segmentId || "—";
  }

  function markDiscarded(id) {
    return update(id, { status: "discarded" });
  }

  /**
   * 配信下書き → 自分の通知タブへテスト追加
   * @param {object} row
   * @param {{ productionMock?: boolean }} [options]
   */
  function pushTestNotification(row, options) {
    const kind = normalizeKind(row?.kind);
    if (kind !== "ad" && kind !== "notice") {
      return { ok: false, reason: "unsupported_kind" };
    }

    const productionMock = options?.productionMock === true;
    const title = pickStr(row?.title) || titleFromBody(row?.body, kind);
    const body = pickStr(row?.body).slice(0, 500);
    const priority = normalizePriority(row?.priority);
    const segment = segmentLabel(row?.targetSegment);
    const count = row?.targetCount ?? 0;

    const footer = productionMock
      ? `【本番送信モック】配信対象: ${segment}（${count.toLocaleString("ja-JP")}名・モック）\n※ 実ユーザーへの一斉送信は未実施`
      : `【配信テスト】対象: ${segment}（${count.toLocaleString("ja-JP")}名・モック）`;

    const notifyBody = [body, "", footer]
      .filter((line, i, arr) => i < 2 || line !== "" || arr[i - 1] !== "")
      .join("\n")
      .trim();

    const titlePrefix = productionMock ? "本番送信モック" : "配信テスト";
    const payload = {
      type: "system",
      title: title.startsWith("【")
        ? title
        : `【${titlePrefix}・${KIND_LABELS[kind]}】${title}`,
      body: notifyBody,
      targetUrl: "talk-home.html?tab=notify",
      priority,
      source: productionMock ? "talk-broadcast-draft-send" : "talk-broadcast-draft",
    };

    try {
      if (typeof global.TasuTalkData?.addNotification === "function") {
        const notification = global.TasuTalkData.addNotification(payload);
        return { ok: true, notification };
      }
      const store = global.TasuTalkNotifications;
      if (store?.add) {
        const notification = store.add(payload);
        return { ok: true, notification };
      }
      return { ok: false, reason: "notify_store_missing" };
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] pushTestNotification failed:", err);
      return { ok: false, reason: err?.message || String(err) };
    }
  }

  /**
   * 本番一斉送信
   * @param {string} id
   */
  async function sendBroadcastDraft(id) {
    const existing = findById(id);
    if (!existing) return { ok: false, reason: "not_found" };
    if (!canBroadcastSend(existing)) {
      return { ok: false, reason: "invalid_status", status: existing.status };
    }
    if (!isOnline()) {
      enqueueBroadcastSend(id);
      return { ok: false, reason: "offline", queued: true };
    }

    const runtime = global.TasuTalkRuntime;
    if (runtime?.isTalkProductionMode?.() === true) {
      const edgeUrl = runtime?.getBroadcastEdgeUrl?.();
      if (edgeUrl) {
        try {
          const sb = global.TasuSupabase?.getClient?.();
          const headers = { "Content-Type": "application/json" };
          if (sb) {
            const { data: sess } = await sb.auth.getSession();
            const token = sess?.session?.access_token;
            if (token) headers.Authorization = `Bearer ${token}`;
          }
          const res = await fetch(edgeUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ broadcastDraftId: String(id) }),
          });
          if (res.ok) {
            const body = await res.json().catch(() => ({}));
            if (body?.ok) return body;
          }
        } catch (err) {
          console.warn("[TasuTalkBroadcastDrafts] edge send failed:", err);
        }
      }
      return {
        ok: false,
        reason: "production_edge_required",
        message:
          "本番配信は未設定です。管理者用 Edge Function（talk-broadcast-send）のデプロイが必要です。",
      };
    }

    const audience = global.TasuTalkBroadcastAudience;
    if (!audience?.resolveRecipients) {
      return { ok: false, reason: "audience_missing" };
    }

    let recipients = [];
    try {
      recipients = await audience.resolveRecipients(existing.targetSegment);
    } catch (err) {
      console.warn("[TasuTalkBroadcastDrafts] resolveRecipients failed:", err);
      return { ok: false, reason: "audience_error" };
    }

    if (!recipients.length) {
      return { ok: false, reason: "no_recipients" };
    }

    const now = nowIso();
    let row = update(id, { status: "scheduled", scheduledAt: now });
    if (!row) return { ok: false, reason: "schedule_failed" };

    const deliverItems = recipients.map((u) => ({
      userId: u.id,
      notification: buildNotificationPayload(row, u.id),
    }));

    const notifyStore = global.TasuTalkNotifications;
    if (!notifyStore?.deliverToUsers) {
      update(id, { status: "draft", scheduledAt: null });
      return { ok: false, reason: "notify_store_missing" };
    }

    const deliverResult = await notifyStore.deliverToUsers(deliverItems);
    if (!deliverResult?.ok) {
      update(id, { status: "draft", scheduledAt: null });
      if (deliverResult?.reason === "offline") {
        enqueueBroadcastSend(id);
      }
      return deliverResult || { ok: false, reason: "delivery_failed" };
    }

    const historyEntry = {
      id: `bcast-log-${Date.now()}`,
      sentAt: now,
      targetSegment: row.targetSegment,
      recipientCount: recipients.length,
      deliveredCount: deliverResult.delivered ?? recipients.length,
      failedCount: deliverResult.failed ?? 0,
      deliveryMode: deliverResult.mode || "unknown",
      recipientIds: recipients.map((r) => r.id),
    };

    row = update(id, {
      status: "sent",
      sentAt: now,
      targetCount: recipients.length,
      sendHistory: [...(row.sendHistory || []), historyEntry],
    });

    if (!row) return { ok: false, reason: "sent_update_failed" };

    return {
      ok: true,
      row,
      history: historyEntry,
      delivered: deliverResult.delivered,
      recipients: recipients.map((r) => r.id),
    };
  }

  /** @deprecated 互換 — sendBroadcastDraft を使用 */
  function executeMockBroadcastSend(id) {
    return sendBroadcastDraft(id);
  }

  registerSupabaseSync();

  global.TasuTalkBroadcastDrafts = {
    STORAGE_KEY,
    DB_TABLE,
    SYNC_STORE_ID,
    EVENT_NAME,
    init,
    TARGET_SEGMENTS,
    KIND_LABELS,
    STATUS_LABELS,
    PRIORITY_LABELS,
    normalizeKind,
    normalizeRow,
    readAll,
    add,
    update,
    findById,
    remove,
    listRecent,
    listPending,
    canSaveFromAiMode,
    kindFromAiMode,
    ensureSourceDraftId,
    segmentById,
    segmentLabel,
    resolveTargetCount,
    canBroadcastSend,
    canMockBroadcastSend,
    buildNotificationPayload,
    pushTestNotification,
    sendBroadcastDraft,
    executeMockBroadcastSend,
    enqueueBroadcastSend,
    flushBroadcastSendQueue,
    markDiscarded,
    SEND_QUEUE_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
