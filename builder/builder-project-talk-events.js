/**
 * Builder Calendar — Talk イベント連携（CAL-MAIN-03）
 *
 * ステータス変更 / 完了報告を Talk Room のシステムメッセージとして記録する。
 * Talk 書き込み失敗は握りつぶし（Builder 保存は成功のまま）。
 */
(function (global) {
  "use strict";

  const VERSION = "cal-main-03";
  const DEDUP_KEY = "tasu_builder_talk_events_v1";
  const DEDUP_TTL_MS = 1000 * 60 * 60 * 24 * 14;

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

  function readDedup() {
    try {
      const raw = global.localStorage?.getItem?.(DEDUP_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function writeDedup(map) {
    try {
      global.localStorage?.setItem?.(DEDUP_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function pruneDedup(map) {
    const now = Date.now();
    const next = {};
    Object.keys(map || {}).forEach((k) => {
      const ts = Number(map[k]) || 0;
      if (now - ts < DEDUP_TTL_MS) next[k] = ts;
    });
    return next;
  }

  /** @returns {boolean} true = 投稿してよい */
  function claimEvent(eventKey) {
    const key = pickStr(eventKey);
    if (!key) return false;
    const map = pruneDedup(readDedup());
    if (map[key]) return false;
    map[key] = Date.now();
    writeDedup(map);
    return true;
  }

  function releaseEvent(eventKey) {
    const key = pickStr(eventKey);
    if (!key) return;
    const map = readDedup();
    delete map[key];
    writeDedup(map);
  }

  async function resolveRoomId(projectId, project) {
    const Talk = global.TasuBuilderProjectTalkRoom;
    const existing = pickStr(project?.talkRoomId, project?.talkThreadId);
    if (Talk?.isStableTalkRoomId?.(existing) || Talk?.isCanonicalTalkRoomId?.(existing)) {
      return existing;
    }
    if (!Talk?.ensureTalkRoomForProject) return "";
    try {
      const ensured = await Talk.ensureTalkRoomForProject(projectId);
      return pickStr(ensured?.roomId);
    } catch {
      return "";
    }
  }

  function readLocalMessages(roomId) {
    try {
      const seed = JSON.parse(global.localStorage?.getItem?.("tasu_chat_seed_v1") || "{}");
      const list = seed.messagesByChatId?.[roomId];
      return Array.isArray(list) ? list.slice() : [];
    } catch {
      return [];
    }
  }

  function ensureLocalThreadShell(roomId, title) {
    const Chat = global.TasuChatSupabase;
    if (!Chat?.registerLocalConsultRoom) return;
    const rid = pickStr(roomId);
    const prev = readLocalMessages(rid);
    Chat.registerLocalConsultRoom(
      {
        id: rid,
        listing: { id: rid, type: "builder_calendar", title: pickStr(title, "Builder") },
        partner: {
          id: "builder_ops",
          displayName: "Builder",
          avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=B",
        },
        buyerId: "u_me",
        sellerId: "builder_ops",
        status: "active",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        lastReadAt: nowIso(),
        unreadCount: 0,
        source: "builder_calendar",
      },
      prev,
    );
  }

  async function postSystemMessage(roomId, text, meta) {
    const rid = pickStr(roomId);
    const body = pickStr(text);
    if (!rid || !body) return { ok: false, reason: "empty" };

    const Chat = global.TasuChatSupabase;
    const input = {
      senderId: "__system__",
      senderName: "Builder",
      text: body,
      kind: "system",
    };

    let localMsg = null;
    // 常に local seed にミラー（検証・オフライン・UI フォールバック用）
    if (Chat?.insertLocalRoomMessage) {
      try {
        ensureLocalThreadShell(rid, meta?.title);
        localMsg = Chat.insertLocalRoomMessage(rid, input);
        try {
          Chat.touchLocalRoomActivity?.(rid, body.slice(0, 160));
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    }

    // UUID room は transaction_messages にも best-effort
    if (Chat?.insertMessage && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rid)) {
      try {
        await Chat.insertMessage(rid, input);
      } catch {
        /* RLS 等 — local ミラーがあれば成功扱い */
      }
    }

    if (localMsg) return { ok: true, message: localMsg, mode: "local_mirror" };

    if (global.TasuChatService?.saveDealSystemMessage) {
      try {
        const res = await global.TasuChatService.saveDealSystemMessage(rid, body);
        if (res?.ok) return { ok: true, message: res.message, mode: "chat_service" };
      } catch {
        /* ignore */
      }
    }

    return { ok: false, reason: "post_failed" };
  }

  function statusLabelJa(status, Store) {
    const s = pickStr(status);
    if (Store?.statusLabel) return Store.statusLabel(s) || s;
    const map = {
      inquiry: "問い合わせ",
      estimating: "見積中",
      contracted: "契約済",
      in_progress: "施工中",
      working: "作業中",
      completed: "完了",
      cancelled: "キャンセル",
    };
    return map[s] || s || "—";
  }

  function buildStatusMessage(project, oldStatus, newStatus, meta) {
    const Store = global.TasuBuilderProjectStore;
    const title = pickStr(project?.name, project?.id, "案件");
    const oldLabel = statusLabelJa(oldStatus, Store);
    const newLabel = statusLabelJa(newStatus, Store);
    const changedAt = pickStr(meta?.changedAt, nowIso());
    return [
      `案件ステータスが「${newLabel}」に変更されました。`,
      `案件: ${title}`,
      `projectId: ${pickStr(project?.id)}`,
      `変更: ${oldLabel} → ${newLabel}`,
      `changedAt: ${changedAt}`,
    ].join("\n");
  }

  function buildCompletionMessage(project, completion, meta) {
    const title = pickStr(project?.name, project?.id, "案件");
    const status = pickStr(completion?.completionStatus, "completed");
    const Store = global.TasuBuilderProjectStore;
    const statusLabel =
      Store?.completionStatusLabel?.(status) ||
      ({ not_started: "未着手", working: "作業中", inspection: "検査中", completed: "完了", handed_over: "引渡し済" }[
        status
      ] || status);
    const memo = pickStr(completion?.completionMemo, meta?.memo);
    const photos = Array.isArray(completion?.photos)
      ? completion.photos
      : Array.isArray(project?.sitePhotos)
        ? project.sitePhotos
        : [];
    const submittedAt = pickStr(meta?.submittedAt, completion?.completedAt, nowIso());
    const reportId = pickStr(meta?.reportId, `cr_${project?.id}_${submittedAt}`);
    return [
      "完了報告が提出されました。",
      "写真・メモを確認してください。",
      `案件: ${title}`,
      `projectId: ${pickStr(project?.id)}`,
      `報告状態: ${statusLabel}`,
      `reportId: ${reportId}`,
      `submittedAt: ${submittedAt}`,
      `メモ: ${memo ? "あり" : "なし"}`,
      `写真: ${photos.length > 0 ? `あり（${photos.length}件）` : "なし"}`,
    ].join("\n");
  }

  /**
   * ステータス変更を Talk に投稿（非同期 · 失敗しても throw しない）
   */
  async function notifyStatusChanged(projectId, oldStatus, newStatus, project) {
    const pid = pickStr(projectId);
    const oldS = pickStr(oldStatus);
    const newS = pickStr(newStatus);
    if (!pid || !newS || oldS === newS) return { ok: false, reason: "noop" };

    const changedAt = nowIso();
    const eventKey = `status:${pid}:${oldS}:${newS}:${changedAt.slice(0, 16)}`;
    if (!claimEvent(eventKey)) return { ok: false, reason: "duplicate" };

    try {
      const proj = project || global.TasuBuilderProjectStore?.getProject?.(pid);
      if (!proj) {
        releaseEvent(eventKey);
        return { ok: false, reason: "project_not_found" };
      }
      const roomId = await resolveRoomId(pid, proj);
      if (!roomId) {
        releaseEvent(eventKey);
        return { ok: false, reason: "no_room" };
      }
      const text = buildStatusMessage(proj, oldS, newS, { changedAt });
      const posted = await postSystemMessage(roomId, text);
      if (!posted.ok) releaseEvent(eventKey);
      return { ...posted, roomId, eventKey };
    } catch {
      releaseEvent(eventKey);
      return { ok: false, reason: "exception" };
    }
  }

  /**
   * 完了報告を Talk に投稿（非同期 · 失敗しても throw しない）
   */
  async function notifyCompletionReported(projectId, completion, project, meta) {
    const pid = pickStr(projectId);
    if (!pid) return { ok: false, reason: "noop" };

    const submittedAt = pickStr(meta?.submittedAt, completion?.completedAt, nowIso());
    const status = pickStr(completion?.completionStatus, "completed");
    const eventKey = `completion:${pid}:${status}:${submittedAt.slice(0, 16)}`;
    if (!claimEvent(eventKey)) return { ok: false, reason: "duplicate" };

    try {
      const proj = project || global.TasuBuilderProjectStore?.getProject?.(pid);
      if (!proj) {
        releaseEvent(eventKey);
        return { ok: false, reason: "project_not_found" };
      }
      const roomId = await resolveRoomId(pid, proj);
      if (!roomId) {
        releaseEvent(eventKey);
        return { ok: false, reason: "no_room" };
      }
      const text = buildCompletionMessage(proj, completion || proj.completion, {
        ...meta,
        submittedAt,
        reportId: `cr_${pid}_${submittedAt}`,
      });
      const posted = await postSystemMessage(roomId, text);
      if (!posted.ok) releaseEvent(eventKey);
      return { ...posted, roomId, eventKey };
    } catch {
      releaseEvent(eventKey);
      return { ok: false, reason: "exception" };
    }
  }

  /** fire-and-forget ヘルパ（Store から呼ぶ） */
  function emitStatusChanged(projectId, oldStatus, newStatus, project) {
    try {
      notifyStatusChanged(projectId, oldStatus, newStatus, project).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function emitCompletionReported(projectId, completion, project, meta) {
    try {
      notifyCompletionReported(projectId, completion, project, meta).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  global.TasuBuilderProjectTalkEvents = {
    VERSION,
    DEDUP_KEY,
    claimEvent,
    notifyStatusChanged,
    notifyCompletionReported,
    emitStatusChanged,
    emitCompletionReported,
    buildStatusMessage,
    buildCompletionMessage,
    postSystemMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
