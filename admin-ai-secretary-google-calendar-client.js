/**
 * AI秘書 Phase 6-F — Google Calendar client (read + write via Human Gate · Edge proxy only)
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    today: "today",
    tomorrow: "tomorrow",
    this_week: "this_week",
    next_7_days: "next_7_days",
  });

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function postCalendarRead(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "calendar_read", ...payload });
  }

  function postCalendarWrite(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "calendar_write", ...payload });
  }

  async function listCalendars(options) {
    options = options || {};
    const result = await postCalendarRead({
      method: "calendarList.list",
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function listEvents(options) {
    options = options || {};
    const result = await postCalendarRead({
      method: "events.list",
      calendarId: options.calendarId || "primary",
      preset: options.preset || undefined,
      timeMin: options.timeMin || undefined,
      timeMax: options.timeMax || undefined,
      q: options.q || options.keyword || undefined,
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function getEvent(calendarId, eventId) {
    const result = await postCalendarRead({
      method: "events.get",
      calendarId: String(calendarId || "primary"),
      eventId: String(eventId || ""),
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function tryWriteBlocked(method) {
    return postCalendarRead({ method: String(method || "events.insert") });
  }

  async function tryWriteWithoutGate(method, fields) {
    return postCalendarWrite({
      method: trim(method, 80) || "events.insert",
      humanGateApproved: false,
      ...(fields || {}),
    });
  }

  async function executeWriteApproved(fields) {
    fields = fields || {};
    if (!fields.pendingId) {
      return { ok: false, error: "human_gate_pending_id_required" };
    }
    const result = await postCalendarWrite({
      method: trim(fields.method, 80) || "events.insert",
      humanGateApproved: true,
      pendingId: trim(fields.pendingId, 120),
      calendarId: trim(fields.calendarId, 300) || "primary",
      eventId: trim(fields.eventId, 200) || undefined,
      title: trim(fields.title, 500) || undefined,
      start: trim(fields.start, 80) || undefined,
      end: trim(fields.end, 80) || undefined,
      allDay: fields.allDay === true,
      location: trim(fields.location, 500) || undefined,
      description: trim(fields.description, 5000) || undefined,
      attendees: Array.isArray(fields.attendees) ? fields.attendees.map(String) : undefined,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  function defaultEndFromStart(startIso) {
    const t = Date.parse(startIso);
    if (!Number.isFinite(t)) return startIso;
    return new Date(t + 3600000).toISOString();
  }

  function parseIntentFallback(userText, existing) {
    existing = existing || {};
    const text = trim(userText, 2000);
    const titleMatch = text.match(/(?:タイトル|件名)[:：]\s*(.+)/i);
    const locMatch = text.match(/(?:場所|ロケーション)[:：]\s*(.+)/i);
    const title = trim(titleMatch?.[1] || text.split(/\n/)[0] || existing.title || "新規予定", 500);
    const start = trim(existing.start, 80) || new Date(Date.now() + 86400000).toISOString();
    return {
      title,
      start,
      end: trim(existing.end, 80) || defaultEndFromStart(start),
      allDay: Boolean(existing.allDay),
      location: trim(locMatch?.[1] || existing.location, 500),
      description: text,
      attendees: [],
    };
  }

  async function parseEventIntent(userText, existingEvent) {
    existingEvent = existingEvent || {};
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    const prompt =
      "あなたは日程アシスタントです。ユーザーの入力から予定情報を抽出し、JSONのみ返してください。" +
      "キー: title, start(ISO8601), end(ISO8601), location, description, attendees(配列)。" +
      "Google Calendar API は実行しないでください。";

    if (!Adapter?.completeTurn) {
      return { ok: true, fields: parseIntentFallback(userText, existingEvent), mock: true };
    }

    const turn = await Adapter.completeTurn({
      userText: trim(userText, 2000),
      systemPrompt: prompt,
      modeId: "ops_secretary",
      mockFallback: () => JSON.stringify(parseIntentFallback(userText, existingEvent)),
    });

    let fields = parseIntentFallback(userText, existingEvent);
    try {
      const m = String(turn.reply || "").match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        fields = {
          title: trim(parsed.title || fields.title, 500),
          start: trim(parsed.start || fields.start, 80),
          end: trim(parsed.end || fields.end, 80) || defaultEndFromStart(fields.start),
          allDay: Boolean(parsed.allDay),
          location: trim(parsed.location || fields.location, 500),
          description: trim(parsed.description || fields.description, 5000),
          attendees: Array.isArray(parsed.attendees) ? parsed.attendees.map(String) : [],
        };
      }
    } catch {
      /* fallback */
    }
    return { ok: true, fields, mock: !!turn.fallback_used };
  }

  function enqueueCalendarHumanGate(calendarAction, fields) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.enqueueFromCalendarEvent) {
      return { ok: false, error: "human_send_gate_missing" };
    }
    const item = HSG.enqueueFromCalendarEvent({
      calendarAction,
      calendarId: fields.calendarId,
      eventId: fields.eventId,
      title: fields.title,
      start: fields.start,
      end: fields.end,
      allDay: fields.allDay,
      location: fields.location,
      description: fields.description,
      attendees: fields.attendees,
    });
    return { ok: true, item };
  }

  async function approvePending(pendingId) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.approveAndExecute) {
      return { ok: false, error: "human_send_gate_missing" };
    }
    return HSG.approveAndExecute(pendingId, { approvedBy: "operator" });
  }

  global.TasuSecretaryGoogleCalendarClient = {
    PRESETS,
    listCalendars,
    listEvents,
    getEvent,
    tryWriteBlocked,
    tryWriteWithoutGate,
    executeWriteApproved,
    parseEventIntent,
    enqueueCalendarHumanGate,
    approvePending,
    defaultEndFromStart,
  };
})(typeof window !== "undefined" ? window : globalThis);
