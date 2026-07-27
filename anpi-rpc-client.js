/**
 * ANPI Phase 2–10 authenticated RPC client (product UI).
 * - Uses TasuSupabase session only (never service_role).
 * - Owner is always auth.uid() on the server; never trust UI-supplied owner ids.
 * - Optional window.__ANPI_RPC_MOCK__ for local tests (no network).
 */
(function (global) {
  "use strict";

  const CONFIRM_SOURCE = "anpi_ui";
  const RELATIONSHIPS = Object.freeze([
    "parent",
    "child",
    "spouse",
    "relative",
    "friend",
    "caregiver",
    "other",
  ]);
  const SCHEDULE_TYPES = Object.freeze(["daily", "weekdays"]);

  /** @type {Map<string, number>} */
  const seqByKey = new Map();
  /** @type {Set<string>} */
  const inFlight = new Set();

  function classifyError(err) {
    const message = String(err?.message || err?.error_description || err || "").trim();
    const status = Number(err?.status || err?.statusCode || 0);
    const code = String(err?.code || "").trim();

    if (
      status === 401 ||
      /jwt|not authenticated|auth_required|login|session/i.test(message) ||
      message === "anpi_auth_required"
    ) {
      return { kind: "UNAUTHENTICATED", retryable: false, message, code: message || code };
    }
    if (
      status === 403 ||
      /permission denied|not_accessible|not_revokeable|forbidden/i.test(message) ||
      /^anpi_.*not_accessible$/i.test(message)
    ) {
      return { kind: "FORBIDDEN", retryable: false, message, code: message || code };
    }
    if (status === 409 || /anpi_contact_duplicate|23505/i.test(message)) {
      return { kind: "CONFLICT", retryable: false, message, code: message || code };
    }
    if (
      message === "ALREADY_CONFIRMED" ||
      /already confirmed|duplicate:\s*true/i.test(message)
    ) {
      return { kind: "ALREADY_CONFIRMED", retryable: false, message, code: message || code };
    }
    if (/conflict/i.test(message)) {
      return { kind: "CONFLICT", retryable: false, message, code: message || code };
    }
    if (
      status === 400 ||
      status === 422 ||
      /invalid_|required|22023|22000|not_confirmable|not_today/i.test(message) ||
      /^anpi_invalid_/i.test(message)
    ) {
      return { kind: "VALIDATION", retryable: false, message, code: message || code };
    }
    if (status === 404 || /not_found|PGRST116/i.test(message)) {
      return { kind: "NOT_FOUND", retryable: false, message, code: message || code };
    }
    if (/Failed to fetch|NetworkError|network|timeout|AbortError/i.test(message) || status === 0) {
      return { kind: "NETWORK", retryable: true, message, code: code || "network" };
    }
    if (status >= 500 || /500|internal/i.test(message)) {
      return { kind: "SERVER", retryable: true, message, code: code || String(status || "server") };
    }
    return { kind: "UNKNOWN", retryable: true, message, code: code || "unknown" };
  }

  function userMessage(kind, code) {
    switch (kind) {
      case "UNAUTHENTICATED":
        return "ログインが必要です。再度ログインしてください。";
      case "FORBIDDEN":
        return "この操作を行う権限がありません。";
      case "VALIDATION":
        return "入力内容を確認してください。";
      case "NOT_FOUND":
        return "対象のデータが見つかりません。";
      case "CONFLICT":
        return "すでに登録済みか、重複する操作です。";
      case "ALREADY_CONFIRMED":
        return "すでに安否確認済みです。";
      case "NETWORK":
        return "通信に失敗しました。接続を確認して再試行してください。";
      case "SERVER":
        return "サーバーで問題が発生しました。しばらくしてから再試行してください。";
      default:
        return "処理に失敗しました。しばらくしてから再試行してください。";
    }
  }

  function normalizeError(err) {
    const classified = classifyError(err);
    return {
      ok: false,
      kind: classified.kind,
      retryable: classified.retryable,
      code: classified.code,
      // Never expose SQLSTATE / stack to UI consumers via this field.
      userMessage: userMessage(classified.kind, classified.code),
      detail: classified.message,
    };
  }

  function unwrapRow(data) {
    if (data == null) return null;
    if (Array.isArray(data)) return data[0] ?? null;
    return data;
  }

  function hasSettingsRow(row) {
    if (!row || typeof row !== "object") return false;
    return Boolean(row.id || row.owner_user_id || row.subject_user_id);
  }

  function hoursToInterval(hours) {
    const n = Number(hours);
    if (!Number.isFinite(n)) return "2 hours";
    const clamped = Math.min(24, Math.max(0.5, n));
    if (clamped === Math.floor(clamped)) return `${clamped} hours`;
    const minutes = Math.round(clamped * 60);
    return `${minutes} minutes`;
  }

  function intervalToHours(value) {
    if (value == null) return 2;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const s = String(value).trim();
    const hm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hm) {
      return Number(hm[1]) + Number(hm[2]) / 60 + Number(hm[3] || 0) / 3600;
    }
    const hours = s.match(/(\d+(?:\.\d+)?)\s*hour/i);
    if (hours) return Number(hours[1]);
    const mins = s.match(/(\d+)\s*min/i);
    if (mins) return Number(mins[1]) / 60;
    return 2;
  }

  function normalizeTime(value) {
    const s = String(value || "").trim();
    if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
    if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    return "08:00:00";
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  /** For local harness: set __ANPI_RPC_MOCK__.unauthenticated = true */
  async function requireSession() {
    const mock = global.__ANPI_RPC_MOCK__;
    if (mock && typeof mock.rpc === "function") {
      if (mock.unauthenticated) {
        const err = normalizeError({ message: "anpi_auth_required", status: 401 });
        throw Object.assign(new Error(err.detail), err);
      }
      return { client: null, session: { access_token: "mock", user: { id: "mock" } } };
    }
    const client = getClient();
    if (!client) {
      const err = normalizeError({ message: "anpi_auth_required", status: 401 });
      throw Object.assign(new Error(err.detail), err);
    }
    const { data, error } = await client.auth.getSession();
    if (error) {
      const err = normalizeError(error);
      throw Object.assign(new Error(err.detail), err);
    }
    const session = data?.session;
    if (!session?.access_token) {
      const err = normalizeError({ message: "anpi_auth_required", status: 401 });
      throw Object.assign(new Error(err.detail), err);
    }
    return { client, session };
  }

  async function rpc(name, args, options = {}) {
    const guardKey = options.guardKey || name;

    if (options.singleFlight) {
      if (inFlight.has(guardKey)) {
        return {
          ok: false,
          error: normalizeError({ message: "anpi_request_in_flight", status: 409 }),
          stale: false,
        };
      }
      inFlight.add(guardKey);
    }

    const seq = (seqByKey.get(guardKey) || 0) + 1;
    seqByKey.set(guardKey, seq);

    try {
      const mock = global.__ANPI_RPC_MOCK__;
      if (mock && typeof mock.rpc === "function") {
        if (mock.unauthenticated) {
          return {
            ok: false,
            stale: false,
            error: normalizeError({ message: "anpi_auth_required", status: 401 }),
          };
        }
        const mocked = await mock.rpc(name, args || {});
        if (seqByKey.get(guardKey) !== seq) {
          return { ok: false, stale: true, error: normalizeError({ message: "stale" }) };
        }
        if (mocked?.ok === false) {
          return { ok: false, stale: false, error: normalizeError(mocked.error || mocked) };
        }
        return { ok: true, stale: false, data: mocked?.data ?? mocked };
      }

      const { client } = await requireSession();
      const { data, error } = await client.rpc(name, args || {});
      if (seqByKey.get(guardKey) !== seq) {
        return { ok: false, stale: true, error: normalizeError({ message: "stale" }) };
      }
      if (error) {
        return { ok: false, stale: false, error: normalizeError(error) };
      }
      return { ok: true, stale: false, data };
    } catch (e) {
      if (seqByKey.get(guardKey) !== seq) {
        return { ok: false, stale: true, error: normalizeError({ message: "stale" }) };
      }
      return { ok: false, stale: false, error: normalizeError(e) };
    } finally {
      if (options.singleFlight) inFlight.delete(guardKey);
    }
  }

  async function getMySettings() {
    const res = await rpc("anpi_get_my_settings", {}, { guardKey: "get_settings" });
    if (!res.ok) return res;
    const row = unwrapRow(res.data);
    return { ok: true, stale: res.stale, data: hasSettingsRow(row) ? row : null };
  }

  async function upsertMySettings(input) {
    const args = {
      p_enabled: input.enabled !== false,
      p_schedule_type: SCHEDULE_TYPES.includes(input.schedule_type) ? input.schedule_type : "daily",
      p_weekdays: Array.isArray(input.weekdays) && input.weekdays.length ? input.weekdays : [1, 2, 3, 4, 5, 6, 7],
      p_initial_notification_time: normalizeTime(input.initial_notification_time),
      p_reminder_count: Math.min(2, Math.max(0, Number(input.reminder_count ?? 2))),
      p_reminder_policy: input.reminder_policy || { interval_minutes: [120, 240] },
      p_contact_notify_after: hoursToInterval(input.contact_notify_after_hours ?? 2),
    };
    const res = await rpc("anpi_upsert_my_settings", args, {
      guardKey: "upsert_settings",
      singleFlight: true,
    });
    if (!res.ok) return res;
    return { ok: true, stale: res.stale, data: unwrapRow(res.data) };
  }

  async function listContacts() {
    const res = await rpc("anpi_phase5_list_my_emergency_contacts", {}, { guardKey: "list_contacts" });
    if (!res.ok) return res;
    const rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    return { ok: true, stale: res.stale, data: rows };
  }

  async function upsertContact(input) {
    const args = {
      p_contact_id: input.contact_id || null,
      p_contact_user_id: input.contact_user_id || null,
      p_relationship: RELATIONSHIPS.includes(input.relationship) ? input.relationship : "other",
      p_priority: Math.min(10, Math.max(1, Number(input.priority || 1))),
      p_channel: "talk",
    };
    const res = await rpc("anpi_phase5_upsert_emergency_contact", args, {
      guardKey: "upsert_contact",
      singleFlight: true,
    });
    if (!res.ok) return res;
    return { ok: true, stale: res.stale, data: unwrapRow(res.data) };
  }

  async function setContactPaused(contactId, paused) {
    const res = await rpc(
      "anpi_phase5_set_contact_paused",
      { p_contact_id: contactId, p_paused: !!paused },
      { guardKey: `pause_${contactId}`, singleFlight: true }
    );
    if (!res.ok) return res;
    return { ok: true, stale: res.stale, data: unwrapRow(res.data) };
  }

  async function revokeContact(contactId) {
    const res = await rpc(
      "anpi_revoke_contact",
      { p_contact_id: contactId },
      { guardKey: `revoke_${contactId}`, singleFlight: true }
    );
    if (!res.ok) return res;
    return { ok: true, stale: res.stale, data: res.data === true || res.data == null ? true : res.data };
  }

  async function reorderContacts(contactIds) {
    const res = await rpc(
      "anpi_phase5_reorder_emergency_contacts",
      { p_contact_ids: contactIds },
      { guardKey: "reorder_contacts", singleFlight: true }
    );
    return res.ok ? { ok: true, stale: res.stale, data: res.data } : res;
  }

  async function getTodayCheck() {
    const res = await rpc("anpi_get_my_today_check", {}, { guardKey: "get_today" });
    if (!res.ok) return res;
    const row = unwrapRow(res.data);
    return { ok: true, stale: res.stale, data: row?.id ? row : null };
  }

  async function ensureTodayCheck() {
    const res = await rpc("anpi_ensure_my_today_check", {}, {
      guardKey: "ensure_today",
      singleFlight: true,
    });
    if (!res.ok) return res;
    return { ok: true, stale: res.stale, data: unwrapRow(res.data) };
  }

  async function confirmCheck(checkId) {
    const res = await rpc(
      "anpi_confirm_check",
      { p_check_id: checkId, p_source: CONFIRM_SOURCE },
      { guardKey: `confirm_${checkId}`, singleFlight: true }
    );
    if (!res.ok) return res;
    const row = unwrapRow(res.data);
    if (row?.duplicate === true) {
      return {
        ok: true,
        stale: res.stale,
        data: row,
        alreadyConfirmed: true,
      };
    }
    return { ok: true, stale: res.stale, data: row, alreadyConfirmed: false };
  }

  async function listCheckHistory(limit) {
    const res = await rpc(
      "anpi_list_my_check_history",
      { p_limit: Math.min(90, Math.max(1, Number(limit) || 30)) },
      { guardKey: "history" }
    );
    if (!res.ok) return res;
    const rows = Array.isArray(res.data) ? res.data : [];
    return {
      ok: true,
      stale: res.stale,
      data: rows.map(normalizeHistoryRow),
    };
  }

  const CHECK_STATUS_LABELS = Object.freeze({
    scheduled: "確認予定",
    notified: "確認通知済み",
    reminded: "再通知済み",
    overdue: "確認待ち期限超過",
    contact_notified: "緊急連絡先へ未確認通知済み",
    confirmed: "確認済み",
    confirmed_late: "遅れて確認済み",
    paused: "一時停止",
    cancelled: "中止",
  });

  function normalizeHistoryRow(row) {
    if (!row || typeof row !== "object") return null;
    const status = String(row.status || "");
    return {
      check_id: row.check_id || row.id || null,
      local_check_date: row.local_check_date || null,
      status,
      status_label: CHECK_STATUS_LABELS[status] || "不明な状態",
      scheduled_at: row.scheduled_at || null,
      confirmed_at: row.confirmed_at || null,
      confirmation_source: row.confirmation_source || null,
    };
  }

  function mapCheckStatus(row) {
    if (!row) return { key: "none", label: "本日の確認は未作成", status: null };
    const status = String(row.status || "");
    const label = CHECK_STATUS_LABELS[status] || status || "不明";
    let key = "other";
    if (status === "confirmed" || status === "confirmed_late") key = "confirmed";
    else if (status === "scheduled" || status === "notified" || status === "reminded") key = "pending";
    else if (status === "overdue" || status === "contact_notified") key = "attention";
    else if (status === "paused" || status === "cancelled") key = "inactive";
    return { key, label, status };
  }

  function formatTokyoDateTime(value) {
    if (value == null || value === "") return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return "—";
    }
  }

  function formatTokyoDate(value) {
    if (value == null || value === "") return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, day] = String(value).split("-");
      return `${y}/${m}/${day}`;
    }
    return formatTokyoDateTime(value).split(" ")[0] || "—";
  }

  global.TasuAnpiRpc = {
    RELATIONSHIPS,
    SCHEDULE_TYPES,
    CONFIRM_SOURCE,
    CHECK_STATUS_LABELS,
    classifyError,
    normalizeError,
    userMessage,
    hasSettingsRow,
    hoursToInterval,
    intervalToHours,
    normalizeTime,
    normalizeHistoryRow,
    formatTokyoDateTime,
    formatTokyoDate,
    requireSession,
    getMySettings,
    upsertMySettings,
    listContacts,
    upsertContact,
    setContactPaused,
    revokeContact,
    reorderContacts,
    getTodayCheck,
    ensureTodayCheck,
    confirmCheck,
    listCheckHistory,
    mapCheckStatus,
  };
})(typeof window !== "undefined" ? window : globalThis);
