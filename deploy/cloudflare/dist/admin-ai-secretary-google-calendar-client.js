/**
 * AI秘書 Phase 6-E — Google Calendar read-only client (Edge proxy only)
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    today: "today",
    tomorrow: "tomorrow",
    this_week: "this_week",
    next_7_days: "next_7_days",
  });

  function postCalendar(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "calendar_read", ...payload });
  }

  async function listCalendars(options) {
    options = options || {};
    const result = await postCalendar({
      method: "calendarList.list",
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function listEvents(options) {
    options = options || {};
    const result = await postCalendar({
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
    const result = await postCalendar({
      method: "events.get",
      calendarId: String(calendarId || "primary"),
      eventId: String(eventId || ""),
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function tryWriteBlocked(method) {
    return postCalendar({ method: String(method || "events.insert") });
  }

  global.TasuSecretaryGoogleCalendarClient = {
    PRESETS,
    listCalendars,
    listEvents,
    getEvent,
    tryWriteBlocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
