/**
 * 安否通知ログ — localStorage + 電話同意イベント連携（LINE送信は土台のみ）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_anpi_notification_logs_v1";
  const LINE_SEND_MOCK_KEY = "tasu_anpi_line_send_mock_v1";
  const MAX_LOGS = 200;
  const STALE_LINE_SEND_MS = 10 * 60 * 1000;

  /** @type {{ local_count: number, supabase_count: number, merged_count: number, last_restored_at: string, last_sync_at: string, last_sync_status: string, restored: boolean }} */
  let logsStorageMeta = {
    local_count: 0,
    supabase_count: 0,
    merged_count: 0,
    last_restored_at: "",
    last_sync_at: "",
    last_sync_status: "idle",
    restored: false,
  };

  /** @type {Promise<object>|null} */
  let logsSyncPromise = null;
  let logsSyncGeneration = 0;

  const EVENT_TYPE_LABELS = {
    ai_search: "AI検索",
    call_consent_opened: "電話（確認）",
    call_consent_accepted: "電話（同意）",
    call_consent_cancelled: "電話（キャンセル）",
    site_navigation: "サイト案内",
    urgent_keyword_detected: "緊急キーワード",
    line_notification_preview: "TASFUL TALKテスト（デモ）",
    line_oauth_unlinked: "TASFUL TALK連携解除",
    line_test_push: "TASFUL TALKテストPush（管理者）",
  };

  const LINE_TEST_PUSH_MESSAGE = "TASFUL安否サービス\nLINE通知テストです。";

  const LINE_STATUSES = new Set(["pending", "sent", "failed"]);

  /** 利用者向け表示用 — 運営・デバッグ文言を除去 */
  function formatUserFacingLineError(message, code) {
    const msg = String(message || "").trim();
    const c = String(code || "").trim();
    const blob = `${msg} ${c}`;
    if (!blob.trim()) return { message: "", code: "" };
    if (
      /edge function|failed to fetch|localstorage|token exchange|push api|到達性|supabase\.co\/functions|functions\/v1/i.test(
        blob
      )
    ) {
      return {
        message: "外部通知の送信に失敗しました。時間をおいて再度お試しください。",
        code: "",
      };
    }
    if (/timeout|time_out/i.test(blob)) {
      return { message: "送信がタイムアウトしました。時間をおいて再度お試しください。", code: "" };
    }
    return { message: msg, code: "" };
  }

  /** LINE Push 送信対象イベント（allowlist） */
  const LINE_DELIVERABLE_EVENT_TYPES = new Set([
    "urgent_keyword_detected",
    "emergency",
    "anpi_alert",
    "manual_alert",
  ]);

  const LINE_ERROR_CODES = {
    TOKEN_MISSING: "TOKEN_MISSING",
    LINE_API_ERROR: "LINE_API_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",
    INVALID_USER: "INVALID_USER",
    INVALID_REQUEST: "INVALID_REQUEST",
    ALREADY_SENT: "ALREADY_SENT",
    SEND_IN_PROGRESS: "SEND_IN_PROGRESS",
    NOT_DELIVERABLE: "NOT_DELIVERABLE",
    UNKNOWN: "UNKNOWN",
  };

  const LINE_STATUS_LABELS = {
    pending: "TASFUL TALK未送信",
    sent: "TASFUL TALK送信済み",
    failed: "TASFUL TALK送信失敗",
  };

  const STATUS_LABELS = {
    pending: "保留",
    sent: "送信済",
    failed: "失敗",
    local_only: "TASFUL内",
  };

  const URGENT_KEYWORDS = [
    "倒れた",
    "動けない",
    "救急車",
    "胸が痛い",
    "息苦しい",
    "意識がない",
    "火事",
    "水漏れが止まらない",
    "鍵が開かない",
    "詐欺かも",
    "お金を払ってしまった",
  ];

  const URGENT_USER_MESSAGE =
    "緊急の可能性があります。必要に応じて119番、警察、家族、管理会社などへ連絡してください。";

  /** @type {{ userText?: string, intent?: string, items?: object[] }|null} */
  let lastSearchContext = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function formatJaDateTime(iso) {
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function newId() {
    return `anpi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function isAnpiActive() {
    return global.TasuAnpiUserContext?.isAnpiUser?.() === true;
  }

  function getCtx() {
    return global.TasuAnpiUserContext?.getAnpiUserContext?.() || null;
  }

  function priorityForEventType(eventType) {
    if (eventType === "urgent_keyword_detected") return "urgent";
    if (eventType === "call_consent_accepted") return "high";
    if (
      eventType === "call_consent_opened" ||
      eventType === "call_consent_cancelled"
    ) {
      return "medium";
    }
    return "normal";
  }

  function normalizeLineFields(log) {
    const status = String(log?.line_status || "pending").trim();
    return {
      line_notification_enabled: log?.line_notification_enabled === true,
      line_user_id: String(log?.line_user_id || "").trim(),
      line_preview_sent_at: log?.line_preview_sent_at ? String(log.line_preview_sent_at) : null,
      line_sent_at: log?.line_sent_at ? String(log.line_sent_at) : null,
      line_status: LINE_STATUSES.has(status) ? status : "pending",
      line_error_message: String(log?.line_error_message || "").trim(),
      line_error_code: String(log?.line_error_code || "").trim(),
      line_send_in_progress: log?.line_send_in_progress === true,
    };
  }

  function isLineDeliverableEventType(eventType) {
    return LINE_DELIVERABLE_EVENT_TYPES.has(String(eventType || "").trim());
  }

  function isLineAlreadySent(log) {
    if (!log) return false;
    if (log.line_status === "sent") return true;
    return Boolean(log.line_sent_at);
  }

  function isLineSendInProgress(log) {
    return log?.line_send_in_progress === true;
  }

  function logHasLineNotifyChannel(log) {
    const channels = log?.notify_channels || getCtx()?.notify_channels || [];
    return Array.isArray(channels) && channels.includes("line");
  }

  /** 現在のユーザーコンテキストで LINE 通知が有効か */
  function isCurrentLineNotificationActive() {
    const ctx = getCtx();
    if (!ctx) return false;
    const link = global.TasuAnpiUserContext?.getLineLinkState?.() || {};
    const line_user_id = String(ctx.line_user_id || link.line_user_id || "").trim();
    if (!line_user_id) return false;
    if (ctx.line_notification_enabled !== true) return false;
    const channels = ctx.notify_channels || [];
    return Array.isArray(channels) && channels.includes("line");
  }

  /**
   * LINE Push 送信対象か（イベント種別・設定・未送信・非送信中）
   * @param {object} log
   */
  function resolveLineUserIdForSend(entry) {
    const ctx = getCtx();
    const link = global.TasuAnpiUserContext?.getLineLinkState?.() || {};
    if (isCurrentLineNotificationActive()) {
      return String(
        ctx?.line_user_id || link.line_user_id || entry?.line_user_id || ""
      ).trim();
    }
    return String(entry?.line_user_id || "").trim();
  }

  function isLineDeliverableLog(log) {
    if (!log) return false;
    if (!isCurrentLineNotificationActive()) return false;
    if (!isLineDeliverableEventType(log.event_type)) return false;
    if (log.line_notification_enabled !== true) return false;
    if (!String(log.line_user_id || "").trim()) return false;
    if (!logHasLineNotifyChannel(log)) return false;
    if (isLineAlreadySent(log)) return false;
    if (isLineSendInProgress(log)) return false;
    return true;
  }

  function canRetryLineNotification(log) {
    if (!log) return false;
    if (!isCurrentLineNotificationActive()) return false;
    if (!isLineDeliverableEventType(log.event_type)) return false;
    if (log.line_notification_enabled !== true) return false;
    if (!String(log.line_user_id || "").trim()) return false;
    if (!logHasLineNotifyChannel(log)) return false;
    if (log.line_status !== "failed") return false;
    if (isLineAlreadySent(log)) return false;
    if (isLineSendInProgress(log)) return false;
    return true;
  }

  function resolveLineErrorCode(apiResult, fallbackMessage) {
    const direct = String(apiResult?.error_code || "").trim();
    if (direct && LINE_ERROR_CODES[direct]) return direct;
    const msg = String(apiResult?.error_message || apiResult?.message || fallbackMessage || "")
      .toLowerCase();
    if (msg.includes("token") || msg.includes("not configured")) return LINE_ERROR_CODES.TOKEN_MISSING;
    if (msg.includes("line api")) return LINE_ERROR_CODES.LINE_API_ERROR;
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return LINE_ERROR_CODES.NETWORK_ERROR;
    }
    if (msg.includes("user") || msg.includes("invalid")) return LINE_ERROR_CODES.INVALID_USER;
    return LINE_ERROR_CODES.UNKNOWN;
  }

  function getLineSendMode() {
    if (isClientLineSendMockEnabled()) return "mock";
    const { url, anonKey } = getAnpiLineSendEndpoint();
    if (!url || !anonKey) return "mock";
    return "production";
  }

  function lineDefaultsFromContext() {
    const ctx = getCtx();
    const link = global.TasuAnpiUserContext?.getLineLinkState?.() || {};
    return {
      line_notification_enabled: ctx?.line_notification_enabled === true,
      line_user_id: String(ctx?.line_user_id || link.line_user_id || "").trim(),
      line_preview_sent_at: null,
      line_sent_at: null,
      line_status: "pending",
    };
  }

  function isBadgeCountableLog(log) {
    const type = log?.event_type;
    if (type === "line_notification_preview") return false;
    if (type === "line_oauth_unlinked") return false;
    if (type === "line_test_push") return false;
    return true;
  }

  function isLineSendTargetLog(log) {
    if (!log) return false;
    return log.line_notification_enabled === true && Boolean(String(log.line_user_id || "").trim());
  }

  function isLineSendFailureLog(log) {
    if (!isLineSendTargetLog(log)) return false;
    return log.line_status === "failed";
  }

  /**
   * @param {{ contractHolderId?: string }} [options]
   */
  function getLineSendFailureSummary(options = {}) {
    const empty = {
      failed_count: 0,
      latest_failed_at: "",
      latest_failed_logs: [],
      retryable_count: 0,
    };
    const holderId = String(options.contractHolderId || "").trim();
    let logs = getRawLogsFromStorage();
    if (holderId) {
      logs = logs.filter((l) => l.contract_holder_id === holderId);
    }
    if (!isCurrentLineNotificationActive()) return empty;

    const failed = logs.filter(isLineSendFailureLog);
    if (!failed.length) return empty;

    failed.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      failed_count: failed.length,
      latest_failed_at: String(failed[0]?.created_at || ""),
      latest_failed_logs: failed.slice(0, 3),
      retryable_count: failed.filter(canRetryLineNotification).length,
    };
  }

  function normalizeLogEntry(log) {
    if (!log || typeof log !== "object") return null;
    const eventType = String(log.event_type || "");
    const line = normalizeLineFields(log);
    const id = String(log.id || log.log_id || "").trim() || newId();
    const ts = String(log.created_at || nowIso());
    const ctx = getCtx();
    const identity =
      global.TasuAnpiIdentity?.normalizeAnpiIdentity?.({
        ...ctx,
        ...log,
      }) || {};

    const anpiUserId = String(
      identity.anpi_user_id || log.anpi_user_id || log.user_id || ctx?.anpi_user_id || ctx?.user_id || ""
    ).trim();

    return {
      ...log,
      id,
      log_id: String(log.log_id || id).trim() || id,
      member_id: String(identity.member_id || log.member_id || "").trim(),
      contract_holder_id: String(
        identity.contract_holder_id || log.contract_holder_id || ""
      ).trim(),
      anpi_user_id: anpiUserId,
      user_id: anpiUserId,
      ...line,
      is_read: log.is_read === true,
      priority: log.priority || priorityForEventType(eventType),
      created_at: ts,
      updated_at: String(log.updated_at || ts),
      read_at: log.read_at ? String(log.read_at) : "",
    };
  }

  function expireStaleLineSendInProgressOnLogs(logs) {
    const now = Date.now();
    return logs.map((log) => {
      if (!log?.line_send_in_progress) return log;
      const baseTs = parseTs(log.updated_at || log.created_at);
      if (!baseTs || now - baseTs < STALE_LINE_SEND_MS) return log;
      return normalizeLogEntry({
        ...log,
        line_send_in_progress: false,
        updated_at: nowIso(),
      });
    });
  }

  function parseTs(iso) {
    const api = global.TasuAnpiNotificationLogsSupabase;
    if (api?.parseTs) return api.parseTs(iso);
    const t = new Date(String(iso || "")).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function resolveSyncScope() {
    const ctx = getCtx();
    const memberId =
      String(ctx?.member_id || "").trim() ||
      global.TasuAnpiIdentity?.resolveCurrentMemberId?.(ctx) ||
      "";
    const anpiUserId = String(ctx?.anpi_user_id || ctx?.user_id || "").trim();
    return {
      contractHolderId: String(ctx?.contract_holder_id || "").trim(),
      memberId,
      anpiUserId,
      userId: anpiUserId,
    };
  }

  function mergeLogsById(localLogs, remoteLogs) {
    const map = new Map();
    const put = (log) => {
      const entry = normalizeLogEntry(log);
      if (!entry?.id) return;
      const existing = map.get(entry.id);
      if (!existing) {
        map.set(entry.id, entry);
        return;
      }
      const localTs = parseTs(existing.updated_at);
      const remoteTs = parseTs(entry.updated_at);
      map.set(entry.id, remoteTs > localTs ? entry : existing);
    };
    localLogs.forEach(put);
    remoteLogs.forEach(put);
    return [...map.values()].sort(
      (a, b) => parseTs(b.created_at) - parseTs(a.created_at)
    );
  }

  function dispatchLogsRestored(detail) {
    const payload = { detail, bubbles: true };
    global.document?.dispatchEvent?.(
      new CustomEvent("tasu:anpi-notification-logs-restored", payload)
    );
    global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-logs-restored", payload));
  }

  function queueRemoteUpsertLogs(logs) {
    const api = global.TasuAnpiNotificationLogsSupabase;
    if (!api?.upsertAnpiNotificationLogs || !logs?.length) return;
    void api.upsertAnpiNotificationLogs(logs).catch(() => {
      /* UI に影響させない */
    });
  }

  function queueRemoteUpsertLog(log) {
    const api = global.TasuAnpiNotificationLogsSupabase;
    if (!api?.upsertAnpiNotificationLog || !log?.id) return;
    void api.upsertAnpiNotificationLog(log).catch(() => {
      /* ignore */
    });
  }

  function readLogsFromLocalStorageOnly() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return expireStaleLineSendInProgressOnLogs(
        raw.map(normalizeLogEntry).filter(Boolean)
      );
    } catch {
      return [];
    }
  }

  function getRawLogsFromStorage() {
    return readLogsFromLocalStorageOnly();
  }

  function persistLogsLocalOnly(logs) {
    const normalized = expireStaleLineSendInProgressOnLogs(
      logs.slice(0, MAX_LOGS).map(normalizeLogEntry).filter(Boolean)
    );
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
    logsStorageMeta.merged_count = normalized.length;
    return normalized;
  }

  function saveRawLogs(logs, options = {}) {
    if (options.bumpGeneration !== false) {
      logsSyncGeneration += 1;
    }
    const withTs = logs.map((log) =>
      normalizeLogEntry({
        ...log,
        updated_at: log.updated_at || nowIso(),
      })
    );
    const saved = persistLogsLocalOnly(withTs);
    if (options.skipRemote !== true) {
      queueRemoteUpsertLogs(saved);
    }
    return saved;
  }

  function getLogsStorageInfo() {
    return { ...logsStorageMeta };
  }

  /**
   * localStorage と Supabase を log_id 単位で同期
   * @returns {Promise<{ ok: boolean, restored?: boolean, merged_count?: number }>}
   */
  async function syncAnpiNotificationLogsWithSupabase() {
    const api = global.TasuAnpiNotificationLogsSupabase;
    const generationAtStart = logsSyncGeneration;
    logsStorageMeta.last_sync_at = nowIso();

    if (!isAnpiActive()) {
      logsStorageMeta.last_sync_status = "skipped";
      return { ok: true, restored: false };
    }

    const scope = resolveSyncScope();
    const localAtStart = readLogsFromLocalStorageOnly();
    logsStorageMeta.local_count = localAtStart.length;

    if (!api?.isAvailable?.()) {
      logsStorageMeta.last_sync_status = "local_only";
      logsStorageMeta.supabase_count = 0;
      logsStorageMeta.merged_count = localAtStart.length;
      return { ok: true, restored: false };
    }

    let remote = [];
    try {
      remote = await api.loadAnpiNotificationLogs({
        contractHolderId: scope.contractHolderId,
        memberId: scope.memberId,
        anpiUserId: scope.anpiUserId,
        userId: scope.userId,
        limit: MAX_LOGS,
      });
    } catch (err) {
      console.warn(
        "[AnpiNotificationLogs] sync load failed",
        err instanceof Error ? err.message : err
      );
      logsStorageMeta.last_sync_status = "error";
      return { ok: false, restored: false };
    }

    if (logsSyncGeneration !== generationAtStart) {
      return { ok: true, restored: false };
    }

    logsStorageMeta.supabase_count = remote.length;
    const localNow = readLogsFromLocalStorageOnly();
    const merged = mergeLogsById(localNow, remote);
    persistLogsLocalOnly(merged);
    logsStorageMeta.merged_count = merged.length;

    const toPush = merged.filter((m) => {
      const r = remote.find((x) => x.id === m.id);
      if (!r) return true;
      return parseTs(m.updated_at) > parseTs(r.updated_at);
    });
    if (toPush.length) {
      queueRemoteUpsertLogs(toPush);
    }

    const restored =
      remote.length > 0 &&
      remote.some((r) => !localAtStart.some((l) => l.id === r.id));
    if (restored) {
      logsStorageMeta.restored = true;
      logsStorageMeta.last_restored_at = nowIso();
      logsStorageMeta.last_sync_status = "restored";
      dispatchLogsRestored({
        merged_count: merged.length,
        storage: getLogsStorageInfo(),
      });
    } else {
      logsStorageMeta.restored = false;
      logsStorageMeta.last_sync_status = "ok";
    }

    return { ok: true, restored, merged_count: merged.length };
  }

  function initAnpiNotificationLogs() {
    if (!logsSyncPromise) {
      logsSyncPromise = syncAnpiNotificationLogsWithSupabase().finally(() => {
        logsSyncPromise = null;
      });
    }
    return logsSyncPromise;
  }

  function getLogs() {
    if (!isAnpiActive()) return [];
    return getRawLogsFromStorage();
  }

  function saveLogs(logs) {
    if (!isAnpiActive()) return;
    saveRawLogs(logs);
  }

  /**
   * 契約者向け一覧（ログイン未実装のため contractHolderId 省略時は全件）
   * @param {{ contractHolderId?: string }} [options]
   */
  function getLogsForContractHolder(options = {}) {
    let logs = getRawLogsFromStorage();
    const holderId = String(options.contractHolderId || "").trim();
    if (holderId) {
      logs = logs.filter((l) => l.contract_holder_id === holderId);
    }
    return logs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * @param {{ contractHolderId?: string }} [options]
   */
  function getNotificationSummary(options = {}) {
    const logs = getLogsForContractHolder(options).filter(isBadgeCountableLog);
    const urgentLogs = logs.filter((l) => l.event_type === "urgent_keyword_detected");
    let latestUrgentAt = "";
    let latestUrgentTs = -Infinity;
    for (const log of urgentLogs) {
      const t = new Date(log.created_at).getTime();
      if (Number.isFinite(t) && t > latestUrgentTs) {
        latestUrgentTs = t;
        latestUrgentAt = log.created_at;
      }
    }
    return {
      total: logs.length,
      unread: logs.filter((l) => !l.is_read).length,
      urgent: urgentLogs.length,
      unread_urgent: urgentLogs.filter((l) => !l.is_read).length,
      latest_urgent_at: latestUrgentAt,
    };
  }

  function dispatchAnpiNotificationEvents(eventName, detail) {
    const payload = { detail, bubbles: true };
    global.document?.dispatchEvent?.(new CustomEvent(eventName, payload));
    if (eventName === "tasu:anpi-notification-log-created") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-created", payload));
    }
    if (
      eventName === "tasu:anpi-notification-read" ||
      eventName === "tasu:anpi-notification-bulk-read"
    ) {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-updated", payload));
    }
    if (eventName === "tasu:anpi-notification-line-preview") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-line-preview", payload));
    }
    if (
      eventName === "tasu:anpi-notification-line-sent" ||
      eventName === "tasu:anpi-notification-updated"
    ) {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-updated", payload));
    }
    if (eventName === "tasu:anpi-notification-line-sent") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-line-sent", payload));
    }
    if (eventName === "tasu:anpi-line-send-failed") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-line-send-failed", payload));
    }
    if (eventName === "tasu:anpi-line-send-retried") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-line-send-retried", payload));
    }
    if (eventName === "tasu:anpi-line-oauth-unlinked") {
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-line-oauth-unlinked", payload));
      global.dispatchEvent?.(new CustomEvent("tasful:anpi-notification-updated", payload));
    }
  }

  function getAnpiLineSendEndpoint() {
    const raw = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const base = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const resolveKey =
      global.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
      function fallbackResolve(config) {
        const k = String(config?.anonKey || config?.anon_key || "").trim();
        if (/^sb_secret_/i.test(k)) return "";
        return k;
      };
    const anonKey = resolveKey(raw);
    return {
      url: base ? `${base}/functions/v1/anpi-line-send` : "",
      anonKey,
    };
  }

  function isClientLineSendMockEnabled() {
    try {
      return global.localStorage.getItem(LINE_SEND_MOCK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setClientLineSendMockEnabled(enabled) {
    try {
      if (enabled) {
        global.localStorage.setItem(LINE_SEND_MOCK_KEY, "1");
      } else {
        global.localStorage.removeItem(LINE_SEND_MOCK_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {object} body
   */
  function clientMockLineSend(body) {
    if (body?.force_fail === true) {
      return {
        ok: true,
        success: false,
        line_sent_at: null,
        line_status: "failed",
        error_message: "Mock send failed (dev)",
        error_code: LINE_ERROR_CODES.UNKNOWN,
        mock: true,
      };
    }
    return {
      ok: true,
      success: true,
      line_sent_at: nowIso(),
      line_status: "sent",
      error_message: null,
      error_code: null,
      mock: true,
    };
  }

  /**
   * @param {object} body
   */
  async function invokeLineSendApi(body) {
    if (isClientLineSendMockEnabled()) {
      return clientMockLineSend(body);
    }

    const { url, anonKey } = getAnpiLineSendEndpoint();
    if (!url || !anonKey) {
      return clientMockLineSend(body);
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error_message = String(data.message || data.error_message || `HTTP ${res.status}`);
        return {
          ok: false,
          success: false,
          line_sent_at: null,
          line_status: "failed",
          error_message,
          error_code: data.error_code || resolveLineErrorCode(data, error_message),
          mock: false,
        };
      }
      return {
        ...data,
        success: data.success === true,
        line_status: data.line_status || (data.success ? "sent" : "failed"),
        line_sent_at: data.line_sent_at || null,
        mock: data.mock === true,
      };
    } catch (err) {
      if (isClientLineSendMockEnabled()) {
        return clientMockLineSend(body);
      }
      const error_message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        success: false,
        line_sent_at: null,
        line_status: "failed",
        error_message,
        error_code: resolveLineErrorCode(null, error_message),
        mock: false,
      };
    }
  }

  function updateLogLineSendState(logId, patch) {
    const logs = getRawLogsFromStorage();
    const idx = logs.findIndex((l) => l.id === logId);
    if (idx < 0) return null;
    logsSyncGeneration += 1;
    logs[idx] = normalizeLogEntry({
      ...logs[idx],
      ...patch,
      updated_at: nowIso(),
    });
    saveRawLogs(logs);
    return logs[idx];
  }

  function shouldAttemptLineSend(log) {
    if (!isCurrentLineNotificationActive()) return false;
    const ctx = getCtx();
    const merged = {
      ...log,
      line_notification_enabled: ctx?.line_notification_enabled === true,
      line_user_id: resolveLineUserIdForSend(log),
      notify_channels: log?.notify_channels || ctx?.notify_channels || [],
    };
    return isLineDeliverableLog(merged);
  }

  /**
   * LINE公式API経由で送信し、ログに line_sent_at / line_status を反映
   * @param {object|string} logOrId
   * @param {{ force_fail?: boolean }} [options]
   * @returns {Promise<{ ok: boolean, log?: object, errors?: string[], line_send?: object }>}
   */
  async function sendLineNotificationForLog(logOrId, options = {}) {
    const logId = typeof logOrId === "string" ? logOrId : logOrId?.id;
    if (!logId) {
      return { ok: false, errors: ["通知ログが指定されていません。"] };
    }

    let logs = getRawLogsFromStorage();
    let idx = logs.findIndex((l) => l.id === logId);
    let entry = idx >= 0 ? logs[idx] : null;
    if (!entry && typeof logOrId === "object") {
      entry = normalizeLogEntry(logOrId);
      if (entry) {
        logs.unshift(entry);
        saveRawLogs(logs);
        idx = 0;
      }
    }
    if (!entry) {
      return { ok: false, errors: ["通知ログが見つかりません。"] };
    }

    if (isLineAlreadySent(entry)) {
      return {
        ok: true,
        skipped: true,
        reason: "already_sent",
        log: entry,
        errors: [],
      };
    }

    if (isLineSendInProgress(entry)) {
      return {
        ok: false,
        skipped: true,
        reason: "send_in_progress",
        log: entry,
        errors: ["LINE送信処理中です。しばらくお待ちください。"],
      };
    }

    const wasFailed = entry.line_status === "failed";

    const ctx = getCtx();
    const line_user_id = resolveLineUserIdForSend(entry);
    const line_notification_enabled = ctx?.line_notification_enabled === true;
    const mergedForCheck = {
      ...entry,
      line_notification_enabled,
      line_user_id,
      notify_channels: entry.notify_channels || ctx?.notify_channels || [],
    };

    const errors = [];
    if (!isCurrentLineNotificationActive()) {
      errors.push("LINE通知が無効、または連携が解除されています。");
    }
    if (!line_user_id) errors.push("LINE連携が完了していません。");
    if (!line_notification_enabled) errors.push("LINE通知が有効になっていません。");
    if (!logHasLineNotifyChannel(mergedForCheck)) {
      errors.push("通知チャネルにLINEが含まれていません。");
    }
    if (!isLineDeliverableEventType(entry.event_type)) {
      errors.push("この通知種別はLINE送信対象外です。");
    }
    if (errors.length) {
      return { ok: false, errors };
    }

    if (!wasFailed && !isLineDeliverableLog(mergedForCheck)) {
      return {
        ok: false,
        errors: ["LINE送信条件を満たしていません。"],
        log: entry,
      };
    }

    if (wasFailed && !canRetryLineNotification(mergedForCheck)) {
      return {
        ok: false,
        errors: ["LINE再送できません。"],
        log: entry,
      };
    }

    updateLogLineSendState(logId, { line_send_in_progress: true });

    const message =
      String(entry.message || "").trim() ||
      String(entry.title || "").trim() ||
      "【TASFUL安否通知】";

    let apiResult;
    try {
      apiResult = await invokeLineSendApi({
        line_user_id,
        message: message.slice(0, 5000),
        notification_type: String(entry.event_type || "").trim(),
        contract_holder_id: String(entry.contract_holder_id || "").trim(),
        log_id: entry.id,
        line_status: entry.line_status,
        line_sent_at: entry.line_sent_at || null,
        ...(options.force_fail === true ? { force_fail: true } : {}),
      });
    } catch (err) {
      apiResult = {
        success: false,
        error_message: err instanceof Error ? err.message : String(err),
        error_code: LINE_ERROR_CODES.NETWORK_ERROR,
      };
    }

    const success = apiResult?.success === true;
    const error_message = success
      ? ""
      : String(apiResult?.error_message || apiResult?.message || "LINE送信に失敗しました。");
    const error_code = success ? "" : resolveLineErrorCode(apiResult, error_message);

    const patch = {
      line_notification_enabled: true,
      line_user_id,
      line_send_in_progress: false,
      line_sent_at: success ? String(apiResult.line_sent_at || nowIso()) : entry.line_sent_at || null,
      line_status: success ? "sent" : "failed",
      line_error_message: error_message,
      line_error_code: error_code,
    };

    const updated = updateLogLineSendState(logId, patch);
    if (!updated) {
      updateLogLineSendState(logId, { line_send_in_progress: false });
      return { ok: false, errors: ["ログの更新に失敗しました。"] };
    }

    const detail = { log: updated, line_send: apiResult };
    if (success) {
      dispatchAnpiNotificationEvents("tasu:anpi-notification-line-sent", detail);
      if (wasFailed) {
        dispatchAnpiNotificationEvents("tasu:anpi-line-send-retried", detail);
      }
    } else {
      dispatchAnpiNotificationEvents("tasu:anpi-line-send-failed", detail);
    }
    dispatchAnpiNotificationEvents("tasu:anpi-notification-updated", detail);

    return {
      ok: success,
      log: updated,
      errors: success ? [] : [error_message],
      line_send: apiResult,
    };
  }

  /**
   * 契約者向け：未読を一括既読（通知センター閲覧時）
   * @param {{ contractHolderId?: string }} [options]
   * @returns {number}
   */
  function markAllNotificationsReadForContractHolder(options = {}) {
    const holderId = String(options.contractHolderId || "").trim();
    const ts = nowIso();
    let logs = getRawLogsFromStorage();
    if (holderId) {
      logs = logs.map((log) =>
        log.contract_holder_id === holderId
          ? { ...log, is_read: true, read_at: ts, updated_at: ts }
          : log
      );
    } else {
      logs = logs.map((log) => ({
        ...log,
        is_read: true,
        read_at: ts,
        updated_at: ts,
      }));
    }
    const beforeUnread = getRawLogsFromStorage().filter((l) => {
      if (holderId && l.contract_holder_id !== holderId) return false;
      return !l.is_read;
    }).length;
    logsSyncGeneration += 1;
    saveRawLogs(logs);
    const api = global.TasuAnpiNotificationLogsSupabase;
    if (holderId) {
      void api?.markAllAnpiNotificationsReadForContractHolder?.(holderId);
    } else {
      const scope = resolveSyncScope();
      if (scope.contractHolderId) {
        void api?.markAllAnpiNotificationsReadForContractHolder?.(scope.contractHolderId);
      }
    }
    if (beforeUnread > 0) {
      dispatchAnpiNotificationEvents("tasu:anpi-notification-bulk-read", {
        contract_holder_id: holderId,
        marked: beforeUnread,
      });
    }
    return beforeUnread;
  }

  function isUrgentLog(log) {
    return log?.event_type === "urgent_keyword_detected";
  }

  /**
   * @param {string} id
   */
  function markNotificationRead(id) {
    const logs = getRawLogsFromStorage();
    const idx = logs.findIndex((l) => l.id === id);
    if (idx < 0) return null;
    const ts = nowIso();
    logs[idx] = {
      ...logs[idx],
      is_read: true,
      read_at: ts,
      updated_at: ts,
    };
    logsSyncGeneration += 1;
    saveRawLogs(logs);
    void global.TasuAnpiNotificationLogsSupabase?.markAnpiNotificationLogRead?.(id);
    dispatchAnpiNotificationEvents("tasu:anpi-notification-read", {
      id,
      log: logs[idx],
    });
    return logs[idx];
  }

  function getContractHolderIdFromUrl() {
    try {
      return String(
        new URLSearchParams(global.location?.search || "").get("contract_holder_id") || ""
      ).trim();
    } catch {
      return "";
    }
  }

  /**
   * 048-***-**** 形式（先頭2–3桁 + *** + 下4桁）
   * @param {string} phone
   */
  function maskPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) return "***";
    const last4 = digits.slice(-4);
    let head = digits.slice(0, 3);
    if (digits.startsWith("0") && digits.length >= 10) {
      head = digits.slice(0, 2);
    }
    return `${head}-***-${last4}`;
  }

  function detectUrgentKeyword(text) {
    const t = String(text || "");
    if (!t) return null;
    return URGENT_KEYWORDS.find((kw) => t.includes(kw)) || null;
  }

  function shouldLogAiSearch(level) {
    return level === "all_ai_actions";
  }

  function shouldLogCallEvent() {
    const level = getCtx()?.notification_level || "call_only";
    return (
      level === "call_only" ||
      level === "all_ai_actions" ||
      level === "important_only"
    );
  }

  function baseLogFields(eventType, overrides = {}) {
    const ctx = getCtx();
    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(ctx) || ctx || {};
    return {
      id: newId(),
      event_type: eventType,
      member_id: identity.member_id || "",
      anpi_user_id: identity.anpi_user_id || identity.user_id || "",
      user_id: identity.anpi_user_id || identity.user_id || "",
      user_name: ctx?.user_name || "",
      contract_holder_id: identity.contract_holder_id || "",
      contract_holder_name: ctx?.contract_holder_name || "",
      contract_holder_relation: ctx?.contract_holder_relation || "",
      channel: "tasful_chat",
      title: "",
      message: "",
      intent: "",
      source_type: "",
      item_id: "",
      item_title: "",
      item_category: "",
      phone_masked: "",
      status: "pending",
      is_read: false,
      priority: priorityForEventType(eventType),
      created_at: nowIso(),
      notify_channels: Array.isArray(ctx?.notify_channels) ? [...ctx.notify_channels] : [],
      ...lineDefaultsFromContext(),
      ...overrides,
    };
  }

  const LINE_PREVIEW_DEMO_MESSAGE =
    "【TASFUL安否・デモ】安否通知のTASFUL TALKテストです。本番送信は行われていません。契約者の方はTASFUL内の安否通知センターもあわせてご確認ください。";

  /**
   * LINEテスト通知（デモ）— line_preview_sent_at を記録、本番送信なし
   * @param {{ line_notification_enabled?: boolean, line_user_id?: string }} [options]
   * @returns {{ ok: boolean, log?: object, errors?: string[] }}
   */
  function recordLinePreviewNotification(options = {}) {
    const ctx = getCtx();
    const link = global.TasuAnpiUserContext?.getLineLinkState?.() || {};
    const line_user_id = String(
      options.line_user_id || ctx?.line_user_id || link.line_user_id || ""
    ).trim();
    const line_notification_enabled =
      options.line_notification_enabled === true ||
      ctx?.line_notification_enabled === true ||
      link.line_notification_enabled === true;

    const errors = [];
    if (!line_user_id) errors.push("LINE連携が完了していません。");
    if (!line_notification_enabled) errors.push("LINE通知が有効になっていません。");
    if (errors.length) {
      return { ok: false, errors };
    }

    const previewAt = nowIso();
    const raw = baseLogFields("line_notification_preview", {
      channel: "line",
      title: "【TASFUL安否通知】TASFUL TALKテスト（デモ）",
      message: LINE_PREVIEW_DEMO_MESSAGE,
      status: "local_only",
      is_read: true,
      priority: "normal",
      line_notification_enabled: true,
      line_user_id,
      line_preview_sent_at: previewAt,
      line_sent_at: null,
      line_status: "pending",
    });
    const entry = normalizeLogEntry(raw);
    if (!entry) {
      return { ok: false, errors: ["ログの作成に失敗しました。"] };
    }

    const logs = getRawLogsFromStorage();
    logs.unshift(entry);
    saveRawLogs(logs);

    dispatchAnpiNotificationEvents("tasu:anpi-notification-line-preview", entry);
    dispatchAnpiNotificationEvents("tasu:anpi-notification-log-created", entry);

    return { ok: true, log: entry, errors: [] };
  }

  /**
   * LINE OAuth 連携解除ログ
   * @returns {{ ok: boolean, log?: object, errors?: string[] }}
   */
  function recordLineOAuthUnlinked() {
    if (!isAnpiActive()) {
      return { ok: false, errors: ["安否ユーザーとして登録されていません。"] };
    }

    const raw = baseLogFields("line_oauth_unlinked", {
      channel: "tasful_chat",
      title: "TASFUL TALK連携を解除しました",
      message: "TASFUL TALK通知の連携が解除されました。今後、TASFUL TALK通知は送信されません。",
      status: "local_only",
      is_read: true,
      priority: "normal",
      line_notification_enabled: false,
      line_user_id: "",
      line_status: "pending",
    });
    const entry = normalizeLogEntry(raw);
    if (!entry) {
      return { ok: false, errors: ["ログの作成に失敗しました。"] };
    }

    const logs = getRawLogsFromStorage();
    logs.unshift(entry);
    saveRawLogs(logs);

    dispatchAnpiNotificationEvents("tasu:anpi-line-oauth-unlinked", entry);
    dispatchAnpiNotificationEvents("tasu:anpi-notification-log-created", entry);
    dispatchAnpiNotificationEvents("tasu:anpi-notification-updated", {
      log: entry,
      reason: "line_oauth_unlinked",
    });

    return { ok: true, log: entry, errors: [] };
  }

  function intentLabel(intent) {
    const labels = global.TasuAiCrossSearch?.INTENT_LABELS || {};
    return labels[intent] || intent || "—";
  }

  function categoryLabelFromKind(kind, category) {
    if (category) return String(category);
    const map = {
      business_service: "業務サービス",
      worker: "ワーカー",
      skill: "スキル",
      product: "商品",
      shop_product: "店舗・商品",
      job: "求人",
      shop: "店舗",
    };
    return map[kind] || kind || "—";
  }

  /**
   * @param {object} log
   */
  async function sendAnpiLineNotification(log) {
    if (!shouldAttemptLineSend(log)) {
      return { ok: true, skipped: true, status: "local_only", reason: "not_deliverable" };
    }
    return sendLineNotificationForLog(log);
  }

  /**
   * 管理者向け LINE 送信統計
   * @param {{ contractHolderId?: string, recentLimit?: number }} [options]
   */
  function getLineAdminStats(options = {}) {
    const holderId = String(options.contractHolderId || "").trim();
    const limit = Math.min(Number(options.recentLimit) || 5, 20);
    let logs = getRawLogsFromStorage().filter(isLineSendTargetLog);
    if (holderId) {
      logs = logs.filter((l) => l.contract_holder_id === holderId);
    }

    const sent = logs.filter((l) => l.line_status === "sent");
    const failed = logs.filter((l) => l.line_status === "failed");
    const sortDesc = (a, b, field) =>
      new Date(b[field] || b.created_at).getTime() - new Date(a[field] || a.created_at).getTime();

    sent.sort((a, b) => sortDesc(a, b, "line_sent_at"));
    failed.sort((a, b) => sortDesc(a, b, "created_at"));

    const ctx = getCtx();
    const link = global.TasuAnpiUserContext?.getLineLinkState?.() || {};
    const linked_user_id = String(ctx?.line_user_id || link.line_user_id || "").trim();

    return {
      linked_user_count: linked_user_id ? 1 : 0,
      sent_count: sent.length,
      failed_count: failed.length,
      last_success_at: sent[0]?.line_sent_at || "",
      last_failure_at: failed[0]?.created_at || "",
      recent_sent_logs: sent.slice(0, limit),
      recent_failed_logs: failed.slice(0, limit),
      line_send_mode: getLineSendMode(),
      line_linked: Boolean(linked_user_id),
    };
  }

  /**
   * 管理者向けテスト Push（event_type: line_test_push）
   * @returns {Promise<{ ok: boolean, log?: object, errors?: string[], line_send?: object }>}
   */
  async function sendLineTestPush() {
    if (global.TasuAnpiLineHealthcheck?.isAnpiLineAdmin?.() !== true) {
      return { ok: false, errors: ["管理者のみ実行できます。"] };
    }
    if (!isAnpiActive()) {
      return { ok: false, errors: ["安否ユーザーとして登録されていません。"] };
    }

    const line_user_id = resolveLineUserIdForSend({});
    if (!line_user_id) {
      return { ok: false, errors: ["LINE連携が完了していません。"] };
    }

    const raw = baseLogFields("line_test_push", {
      channel: "line",
      title: "TASFUL TALKテストPush（管理者）",
      message: LINE_TEST_PUSH_MESSAGE,
      status: "local_only",
      is_read: true,
      priority: "normal",
      line_notification_enabled: true,
      line_user_id,
      line_status: "pending",
      line_error_message: "",
      line_error_code: "",
    });
    const entry = normalizeLogEntry(raw);
    if (!entry) {
      return { ok: false, errors: ["ログの作成に失敗しました。"] };
    }

    const logs = getRawLogsFromStorage();
    logs.unshift(entry);
    saveRawLogs(logs);
    dispatchAnpiNotificationEvents("tasu:anpi-notification-log-created", entry);

    updateLogLineSendState(entry.id, { line_send_in_progress: true });

    let apiResult;
    try {
      apiResult = await invokeLineSendApi({
        line_user_id,
        message: LINE_TEST_PUSH_MESSAGE,
        notification_type: "line_test_push",
        contract_holder_id: String(entry.contract_holder_id || "").trim(),
        log_id: entry.id,
      });
    } catch (err) {
      apiResult = {
        success: false,
        error_message: err instanceof Error ? err.message : String(err),
        error_code: LINE_ERROR_CODES.NETWORK_ERROR,
      };
    }

    const success = apiResult?.success === true;
    const error_message = success
      ? ""
      : String(apiResult?.error_message || apiResult?.message || "LINE送信に失敗しました。");
    const error_code = success ? "" : resolveLineErrorCode(apiResult, error_message);

    const updated = updateLogLineSendState(entry.id, {
      line_send_in_progress: false,
      line_sent_at: success ? String(apiResult.line_sent_at || nowIso()) : null,
      line_status: success ? "sent" : "failed",
      line_error_message: error_message,
      line_error_code: error_code,
    });

    const detail = { log: updated, line_send: apiResult };
    if (success) {
      dispatchAnpiNotificationEvents("tasu:anpi-notification-line-sent", detail);
    } else {
      dispatchAnpiNotificationEvents("tasu:anpi-line-send-failed", detail);
    }
    dispatchAnpiNotificationEvents("tasu:anpi-notification-updated", detail);

    return {
      ok: success,
      log: updated,
      errors: success ? [] : [error_message],
      line_send: apiResult,
      error_code,
      error_message,
    };
  }

  function getLineSendStats(options = {}) {
    const holderId = String(options.contractHolderId || "").trim();
    let logs = getRawLogsFromStorage().filter(isLineSendTargetLog);
    if (holderId) {
      logs = logs.filter((l) => l.contract_holder_id === holderId);
    }
    const sent = logs.filter((l) => l.line_status === "sent" && l.line_sent_at);
    const failed = logs.filter((l) => l.line_status === "failed");
    sent.sort((a, b) => new Date(b.line_sent_at).getTime() - new Date(a.line_sent_at).getTime());
    failed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return {
      last_success_at: sent[0]?.line_sent_at || "",
      last_failure_at: failed[0]?.created_at || "",
      failed_count: failed.length,
    };
  }

  /**
   * @param {object} log
   */
  async function deliverLog(log) {
    if (!isAnpiActive()) return null;
    const logs = getLogs();
    const entry = { ...log, status: log.status || "pending" };
    logs.unshift(entry);
    saveLogs(logs);

    const finalized = {
      ...entry,
      status: "local_only",
    };
    let updated = getLogs().map((l) => (l.id === entry.id ? finalized : l));
    saveLogs(updated);

    if (shouldAttemptLineSend(finalized)) {
      await sendLineNotificationForLog(finalized.id);
      updated = getLogs();
      const refreshed = updated.find((l) => l.id === entry.id);
      if (refreshed) {
        dispatchAnpiNotificationEvents("tasu:anpi-notification-log-created", refreshed);
        return refreshed;
      }
    }

    dispatchAnpiNotificationEvents("tasu:anpi-notification-log-created", finalized);

    return finalized;
  }

  function appendNotificationLog(partial) {
    if (!isAnpiActive()) return null;
    return deliverLog(baseLogFields(partial.event_type, partial));
  }

  function setLastSearchContext(ctx) {
    lastSearchContext = ctx ? { ...ctx } : null;
  }

  function getLastSearchContext() {
    return lastSearchContext ? { ...lastSearchContext } : null;
  }

  /**
   * @param {{ userText?: string, intent?: string, navKey?: string, itemCount?: number }} meta
   */
  function recordAiSearch(meta = {}) {
    if (!isAnpiActive()) return null;
    const ctx = getCtx();
    const level = ctx?.notification_level || "call_only";
    const userText = String(meta.userText || "").trim();
    const urgent = detectUrgentKeyword(userText);
    if (urgent) {
      return recordUrgentKeyword(userText, urgent);
    }
    if (!shouldLogAiSearch(level)) return null;

    setLastSearchContext({
      userText,
      intent: meta.intent || "",
      items: meta.items || [],
    });

    const message =
      `${ctx.user_name}様がAIに「${userText.slice(0, 120)}」と相談しました。`;

    return appendNotificationLog({
      event_type: "ai_search",
      title: "【TASFUL安否通知】AI検索",
      message,
      intent: meta.intent || "",
      source_type: meta.source_type || "cross_search",
      status: "pending",
    });
  }

  function recordUrgentKeyword(userText, matchedKeyword) {
    if (!isAnpiActive()) return null;
    const ctx = getCtx();
    const kw = matchedKeyword || detectUrgentKeyword(userText);
    const message = [
      `【TASFUL安否通知】`,
      `${ctx.user_name}様のメッセージに緊急の可能性があるキーワード（${kw}）が含まれています。`,
      "",
      `内容: ${String(userText || "").slice(0, 200)}`,
      "",
      URGENT_USER_MESSAGE,
      "",
      "TASFULは救急対応・通報・契約・決済を代行しません。",
    ].join("\n");

    return appendNotificationLog({
      event_type: "urgent_keyword_detected",
      title: "【TASFUL安否通知】緊急キーワード",
      message,
      intent: "urgent",
      status: "pending",
    });
  }

  function buildCallAcceptedMessage(detail) {
    const ctx = getCtx();
    const search = getLastSearchContext();
    const content = search?.userText || detail.intent || "（内容未記録）";
    const candidate = detail.title || "（候補未記録）";
    const category = detail.category || categoryLabelFromKind(detail.sourceType, detail.category);
    const dt = formatJaDateTime(detail.timestamp || nowIso());

    return [
      "【TASFUL安否通知】",
      `${ctx.user_name}様が、AI検索結果から業者へ電話しようとしています。`,
      "",
      "内容:",
      content,
      "",
      "候補:",
      candidate,
      "",
      "カテゴリ:",
      category,
      "",
      "日時:",
      dt,
      "",
      "TASFULは電話内容・契約・料金・支払いを保証しません。",
      "必要に応じてご家族で確認してください。",
    ].join("\n");
  }

  function recordCallConsentEvent(detail, eventType) {
    if (!isAnpiActive()) return null;
    if (!shouldLogCallEvent()) return null;

    const phoneMasked = maskPhone(detail?.phone || "");
    let title = "【TASFUL安否通知】電話";
    let message = "";

    if (eventType === "call_consent_opened") {
      title = "【TASFUL安否通知】電話（確認画面）";
      message = [
        `${getCtx().user_name}様が「${detail.title || "候補"}」へ電話する前の確認画面を開きました。`,
        `カテゴリ: ${detail.category || "—"}`,
        phoneMasked ? `電話（マスク）: ${phoneMasked}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } else if (eventType === "call_consent_accepted") {
      title = "【TASFUL安否通知】電話（同意）";
      message = buildCallAcceptedMessage(detail || {});
    } else if (eventType === "call_consent_cancelled") {
      title = "【TASFUL安否通知】電話（キャンセル）";
      message = `${getCtx().user_name}様が「${detail.title || "候補"}」への電話をキャンセルしました。`;
    }

    return appendNotificationLog({
      event_type: eventType,
      title,
      message,
      intent: detail?.intent || "",
      source_type: detail?.sourceType || "",
      item_id: detail?.itemId || "",
      item_title: detail?.title || "",
      item_category: detail?.category || "",
      phone_masked: phoneMasked,
      status: "pending",
    });
  }

  function recordSiteNavigation(navKey, userText) {
    if (!isAnpiActive()) return null;
    const level = getCtx()?.notification_level;
    if (level !== "all_ai_actions") return null;
    const ctx = getCtx();
    return appendNotificationLog({
      event_type: "site_navigation",
      title: "【TASFUL安否通知】サイト案内",
      message: `${ctx.user_name}様がAIでサイト案内（${navKey || "general"}）を利用しました。\n${String(userText || "").slice(0, 80)}`,
      intent: "site_navigation",
      status: "pending",
    });
  }

  /**
   * @param {string} userText
   * @returns {{ logged: boolean, urgent: boolean, message: string }}
   */
  function checkAndRecordUrgent(userText) {
    if (!isAnpiActive()) return { logged: false, urgent: false, message: "" };
    const kw = detectUrgentKeyword(userText);
    if (!kw) return { logged: false, urgent: false, message: "" };
    recordUrgentKeyword(userText, kw);
    return { logged: true, urgent: true, message: URGENT_USER_MESSAGE };
  }

  function onCrossSearchComplete({ userText, intent, items, navKey }) {
    if (!isAnpiActive()) return;
    if (intent === "site_navigation" && navKey) {
      recordSiteNavigation(navKey, userText);
      return;
    }
    recordAiSearch({
      userText,
      intent,
      items,
      source_type: "cross_search",
    });
  }

  const EVENT_CALL_OPENED = "tasu:ai-call-consent-opened";
  const EVENT_CALL_ACCEPTED = "tasu:ai-call-consent-accepted";
  const EVENT_CALL_CANCELLED = "tasu:ai-call-consent-cancelled";

  let bridgeBound = false;

  function initAnpiNotificationBridge() {
    if (bridgeBound || !global.document) return;
    bridgeBound = true;

    global.document.addEventListener(EVENT_CALL_OPENED, (e) => {
      recordCallConsentEvent(e.detail || {}, "call_consent_opened");
    });
    global.document.addEventListener(EVENT_CALL_ACCEPTED, (e) => {
      recordCallConsentEvent(e.detail || {}, "call_consent_accepted");
    });
    global.document.addEventListener(EVENT_CALL_CANCELLED, (e) => {
      recordCallConsentEvent(e.detail || {}, "call_consent_cancelled");
    });
  }

  function clearLogs() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  global.TasuAnpiNotifications = {
    STORAGE_KEY,
    STALE_LINE_SEND_MS,
    URGENT_KEYWORDS,
    URGENT_USER_MESSAGE,
    EVENT_TYPE_LABELS,
    STATUS_LABELS,
    formatUserFacingLineError,
    getLogs,
    getRawLogsFromStorage,
    getLogsStorageInfo,
    initAnpiNotificationLogs,
    syncAnpiNotificationLogsWithSupabase,
    saveRawLogs,
    getLogsForContractHolder,
    getNotificationSummary,
    getLineSendFailureSummary,
    getLineSendStats,
    getLineSendMode,
    LINE_STATUS_LABELS,
    LINE_DELIVERABLE_EVENT_TYPES,
    LINE_ERROR_CODES,
    isLineDeliverableLog,
    isLineDeliverableEventType,
    isLineAlreadySent,
    canRetryLineNotification,
    isLineSendTargetLog,
    isLineSendFailureLog,
    markAllNotificationsReadForContractHolder,
    markNotificationRead,
    isUrgentLog,
    priorityForEventType,
    getContractHolderIdFromUrl,
    saveLogs,
    clearLogs,
    maskPhone,
    detectUrgentKeyword,
    appendNotificationLog,
    deliverLog,
    sendAnpiLineNotification,
    setLastSearchContext,
    getLastSearchContext,
    recordAiSearch,
    recordUrgentKeyword,
    recordCallConsentEvent,
    recordLinePreviewNotification,
    recordLineOAuthUnlinked,
    sendLineTestPush,
    getLineAdminStats,
    isCurrentLineNotificationActive,
    resolveLineUserIdForSend,
    sendLineNotificationForLog,
    invokeLineSendApi,
    getAnpiLineSendEndpoint,
    setClientLineSendMockEnabled,
    isClientLineSendMockEnabled,
    isBadgeCountableLog,
    recordSiteNavigation,
    checkAndRecordUrgent,
    onCrossSearchComplete,
    initAnpiNotificationBridge,
  };

  function bootNotificationLogs() {
    initAnpiNotificationBridge();
    if (isAnpiActive()) {
      void initAnpiNotificationLogs();
    }
  }

  if (global.document) {
    global.document.addEventListener?.("tasu:anpi-context-restored", () => {
      logsSyncPromise = null;
      if (isAnpiActive()) {
        void initAnpiNotificationLogs();
      }
    });
    global.document.addEventListener?.("tasful:anpi-context-restored", () => {
      logsSyncPromise = null;
      if (isAnpiActive()) {
        void initAnpiNotificationLogs();
      }
    });

    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", bootNotificationLogs);
    } else {
      bootNotificationLogs();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
