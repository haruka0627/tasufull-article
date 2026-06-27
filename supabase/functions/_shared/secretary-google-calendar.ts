/**
 * AI秘書 Phase 6-E — Google Calendar read-only API (Edge · server-side only)
 * Allowed: calendarList.list · events.list · events.get
 * Forbidden: insert · update · delete · clear
 */
import {
  ensureGoogleAccessToken,
  isSecretaryGoogleMockMode,
} from "./secretary-google-oauth.ts";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export const CALENDAR_READ_METHODS = Object.freeze([
  "calendarList.list",
  "events.list",
  "events.get",
]);

export const CALENDAR_WRITE_METHODS = Object.freeze([
  "events.insert",
  "events.update",
  "events.patch",
  "events.delete",
  "events.move",
  "events.import",
  "events.quickAdd",
  "calendars.insert",
  "calendars.update",
  "calendars.patch",
  "calendars.delete",
  "calendars.clear",
  "calendarList.insert",
  "calendarList.update",
  "calendarList.patch",
  "calendarList.delete",
]);

/** Phase 6-F allowed write methods (non-recurring single events). */
export const CALENDAR_WRITE_ALLOWED_PHASE6F = Object.freeze([
  "events.insert",
  "events.update",
  "events.delete",
]);

export type CalendarReadRequest = {
  method: string;
  calendarId?: string;
  eventId?: string;
  preset?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string;
  maxResults?: number;
  pageToken?: string;
  singleEvents?: boolean;
  orderBy?: string;
};

export type CalendarWriteRequest = {
  method: string;
  humanGateApproved?: boolean;
  pendingId?: string;
  calendarId?: string;
  eventId?: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  timeZone?: string;
};

export type CalendarEventCard = {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  attendeeCount: number;
  status: string;
  description: string;
  htmlLink: string;
};

function trim(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

export function isCalendarReadMethod(method: string): boolean {
  return CALENDAR_READ_METHODS.includes(String(method || "").trim());
}

export function isCalendarWriteMethod(method: string): boolean {
  return CALENDAR_WRITE_METHODS.includes(String(method || "").trim());
}

export function isCalendarWriteAllowedPhase6F(method: string): boolean {
  return CALENDAR_WRITE_ALLOWED_PHASE6F.includes(String(method || "").trim());
}

export function isCalendarWriteBlockedPhase6F(method: string): boolean {
  const m = String(method || "").trim();
  return isCalendarWriteMethod(m) && !isCalendarWriteAllowedPhase6F(m);
}

function sanitizeKeyword(q: string): string {
  return trim(q, 200).replace(/[\r\n\0]/g, " ");
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function buildPresetRange(preset: string, now = new Date()): { timeMin: string; timeMax: string; label: string } {
  const p = trim(preset, 40).toLowerCase();
  const today = startOfDay(now);

  if (p === "today") {
    return {
      timeMin: today.toISOString(),
      timeMax: addDays(today, 1).toISOString(),
      label: "今日の予定",
    };
  }
  if (p === "tomorrow") {
    const t = addDays(today, 1);
    return {
      timeMin: t.toISOString(),
      timeMax: addDays(today, 2).toISOString(),
      label: "明日の予定",
    };
  }
  if (p === "this_week") {
    const weekStart = startOfWeekMonday(now);
    return {
      timeMin: weekStart.toISOString(),
      timeMax: addDays(weekStart, 7).toISOString(),
      label: "今週の予定",
    };
  }
  if (p === "next_7_days" || p === "week") {
    return {
      timeMin: now.toISOString(),
      timeMax: addDays(now, 7).toISOString(),
      label: "今後7日",
    };
  }
  return {
    timeMin: today.toISOString(),
    timeMax: addDays(today, 1).toISOString(),
    label: "今日の予定",
  };
}

function parseEventDateTime(raw: Record<string, unknown> | undefined): { iso: string; allDay: boolean } {
  if (!raw || typeof raw !== "object") return { iso: "", allDay: false };
  if (raw.date) return { iso: String(raw.date), allDay: true };
  if (raw.dateTime) return { iso: String(raw.dateTime), allDay: false };
  return { iso: "", allDay: false };
}

export function normalizeEvent(
  raw: Record<string, unknown>,
  calendarId: string,
  calendarName: string
): CalendarEventCard {
  const start = parseEventDateTime(raw.start as Record<string, unknown>);
  const end = parseEventDateTime(raw.end as Record<string, unknown>);
  const attendees = Array.isArray(raw.attendees) ? raw.attendees : [];
  return {
    id: String(raw.id || ""),
    calendarId,
    calendarName,
    title: trim(raw.summary, 500) || "(タイトルなし)",
    start: start.iso,
    end: end.iso,
    allDay: start.allDay || end.allDay,
    location: trim(raw.location, 500),
    attendeeCount: attendees.length,
    status: trim(raw.status, 40) || "confirmed",
    description: trim(raw.description, 2000),
    htmlLink: trim(raw.htmlLink, 500),
  };
}

const MOCK_CALENDARS = [
  { id: "primary", summary: "メインカレンダー", primary: true },
  { id: "mock_ops", summary: "TASFUL 運営", primary: false },
];

function mockEventsForRange(timeMin: string, timeMax: string, q: string): CalendarEventCard[] {
  const min = Date.parse(timeMin);
  const max = Date.parse(timeMax);
  const query = sanitizeKeyword(q).toLowerCase();
  const base: CalendarEventCard[] = [
    {
      id: "mock_evt_1",
      calendarId: "primary",
      calendarName: "メインカレンダー",
      title: "運営ミーティング",
      start: new Date(min + 3600000).toISOString(),
      end: new Date(min + 7200000).toISOString(),
      allDay: false,
      location: "オンライン",
      attendeeCount: 3,
      status: "confirmed",
      description: "Platform / Builder 進捗確認",
      htmlLink: "",
    },
    {
      id: "mock_evt_2",
      calendarId: "primary",
      calendarName: "メインカレンダー",
      title: "Connect 審査フォロー",
      start: new Date(min + 86400000).toISOString(),
      end: new Date(min + 90000000).toISOString(),
      allDay: false,
      location: "本社",
      attendeeCount: 2,
      status: "confirmed",
      description: "",
      htmlLink: "",
    },
    {
      id: "mock_evt_3",
      calendarId: "mock_ops",
      calendarName: "TASFUL 運営",
      title: "終日: リリース準備",
      start: new Date(min).toISOString().slice(0, 10),
      end: new Date(min).toISOString().slice(0, 10),
      allDay: true,
      location: "",
      attendeeCount: 0,
      status: "confirmed",
      description: "",
      htmlLink: "",
    },
  ];
  return base.filter((ev) => {
    const startMs = Date.parse(ev.start);
    if (Number.isFinite(min) && Number.isFinite(startMs) && startMs < min) return false;
    if (Number.isFinite(max) && Number.isFinite(startMs) && startMs >= max) return false;
    if (query && !ev.title.toLowerCase().includes(query) && !ev.location.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

async function calendarFetch(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const url = new URL(`${CALENDAR_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: trim((data.error as Record<string, unknown>)?.message || data.error || `http_${res.status}`, 300),
    };
  }
  return { ok: true, status: res.status, data };
}

async function executeMockCalendar(req: CalendarReadRequest) {
  const method = trim(req.method);
  if (method === "calendarList.list") {
    return { ok: true, mock: true, calendars: MOCK_CALENDARS };
  }
  const preset = trim(req.preset);
  const range =
    req.timeMin && req.timeMax
      ? { timeMin: trim(req.timeMin, 80), timeMax: trim(req.timeMax, 80), label: "custom" }
      : buildPresetRange(preset || "today");
  const q = sanitizeKeyword(req.q || "");

  if (method === "events.list") {
    const events = mockEventsForRange(range.timeMin, range.timeMax, q);
    return {
      ok: true,
      mock: true,
      preset: preset || undefined,
      timeMin: range.timeMin,
      timeMax: range.timeMax,
      events,
      resultSizeEstimate: events.length,
    };
  }
  if (method === "events.get") {
    const id = trim(req.eventId, 120);
    const events = mockEventsForRange(range.timeMin, range.timeMax, "");
    const hit = events.find((e) => e.id === id) || events[0];
    return { ok: true, mock: true, event: hit };
  }
  return { ok: false, error: "unknown_calendar_method" };
}

async function executeLiveCalendar(accessToken: string, req: CalendarReadRequest) {
  const method = trim(req.method);
  const maxResults = Math.min(Math.max(Number(req.maxResults) || 25, 1), 50);

  if (method === "calendarList.list") {
    const res = await calendarFetch(accessToken, "/users/me/calendarList", {
      maxResults,
      pageToken: trim(req.pageToken, 200) || undefined,
    });
    if (!res.ok) return res;
    const items = Array.isArray(res.data?.items) ? res.data?.items : [];
    const calendars = items.map((c) => ({
      id: trim((c as Record<string, unknown>).id, 300),
      summary: trim((c as Record<string, unknown>).summary, 300),
      primary: Boolean((c as Record<string, unknown>).primary),
    }));
    return {
      ok: true,
      calendars,
      nextPageToken: trim(res.data?.nextPageToken, 200) || null,
    };
  }

  const calendarId = trim(req.calendarId, 300) || "primary";
  const preset = trim(req.preset);
  const range =
    req.timeMin && req.timeMax
      ? { timeMin: trim(req.timeMin, 80), timeMax: trim(req.timeMax, 80), label: "custom" }
      : buildPresetRange(preset || "today");

  if (method === "events.list") {
    const calRes = await calendarFetch(accessToken, "/users/me/calendarList", { maxResults: 50 });
    const calItems = Array.isArray(calRes.data?.items) ? calRes.data?.items : [];
    const calNameMap = new Map<string, string>();
    for (const c of calItems) {
      const row = c as Record<string, unknown>;
      calNameMap.set(String(row.id || ""), trim(row.summary, 300) || String(row.id || ""));
    }
    const calendarName = calNameMap.get(calendarId) || calendarId;

    const listRes = await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        maxResults,
        singleEvents: req.singleEvents !== false,
        orderBy: trim(req.orderBy, 40) || "startTime",
        pageToken: trim(req.pageToken, 200) || undefined,
        q: sanitizeKeyword(req.q || "") || undefined,
      }
    );
    if (!listRes.ok) return listRes;
    const refs = Array.isArray(listRes.data?.items) ? listRes.data?.items : [];
    const events = refs.map((raw) => normalizeEvent(raw as Record<string, unknown>, calendarId, calendarName));
    return {
      ok: true,
      preset: preset || undefined,
      timeMin: range.timeMin,
      timeMax: range.timeMax,
      calendarId,
      events,
      resultSizeEstimate: events.length,
      nextPageToken: trim(listRes.data?.nextPageToken, 200) || null,
    };
  }

  if (method === "events.get") {
    const eventId = trim(req.eventId, 200);
    if (!eventId) return { ok: false, error: "event_id_required" };
    const res = await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
    if (!res.ok) return res;
    const calRes = await calendarFetch(accessToken, "/users/me/calendarList", { maxResults: 50 });
    const calItems = Array.isArray(calRes.data?.items) ? calRes.data?.items : [];
    const hit = calItems.find((c) => String((c as Record<string, unknown>).id) === calendarId) as
      | Record<string, unknown>
      | undefined;
    const calendarName = trim(hit?.summary, 300) || calendarId;
    return { ok: true, event: normalizeEvent(res.data || {}, calendarId, calendarName) };
  }

  return { ok: false, error: "unknown_calendar_method" };
}

export async function executeCalendarRead(userId: string, req: CalendarReadRequest) {
  const method = trim(req.method);
  if (!method) return { ok: false, error: "method_required" };
  if (isCalendarWriteMethod(method)) {
    return { ok: false, error: "calendar_read_only", method, phase: "6-E" };
  }
  if (!isCalendarReadMethod(method)) {
    return { ok: false, error: "calendar_method_not_allowed", method };
  }

  if (isSecretaryGoogleMockMode()) {
    return executeMockCalendar(req);
  }

  const token = await ensureGoogleAccessToken(userId);
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error || "not_connected" };
  }

  return executeLiveCalendar(token.accessToken, req);
}

const DEFAULT_TZ = "Asia/Tokyo";

function buildEventResource(req: CalendarWriteRequest): Record<string, unknown> {
  const title = trim(req.title, 500);
  const location = trim(req.location, 500);
  const description = trim(req.description, 5000);
  const tz = trim(req.timeZone, 80) || DEFAULT_TZ;
  const allDay = Boolean(req.allDay);
  const startRaw = trim(req.start, 80);
  const endRaw = trim(req.end, 80);
  const body: Record<string, unknown> = {};
  if (title) body.summary = title;
  if (location) body.location = location;
  if (description) body.description = description;
  if (startRaw) {
    body.start = allDay ? { date: startRaw.slice(0, 10) } : { dateTime: startRaw, timeZone: tz };
  }
  if (endRaw) {
    body.end = allDay ? { date: endRaw.slice(0, 10) } : { dateTime: endRaw, timeZone: tz };
  }
  const attendees = Array.isArray(req.attendees)
    ? req.attendees.map((email) => ({ email: trim(email, 200) })).filter((a) => a.email)
    : [];
  if (attendees.length) body.attendees = attendees.slice(0, 20);
  return body;
}

function assertCalendarHumanGate(req: CalendarWriteRequest) {
  if (!req.humanGateApproved || !trim(req.pendingId, 120)) {
    return { ok: false as const, error: "human_gate_required", phase: "6-F" };
  }
  return { ok: true as const };
}

async function calendarMutate(
  accessToken: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "DELETE" && res.status === 204) {
    return { ok: true, status: 204, data: { deleted: true } };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: trim((data.error as Record<string, unknown>)?.message || data.error || `http_${res.status}`, 300),
    };
  }
  return { ok: true, status: res.status, data };
}

async function executeMockCalendarWrite(req: CalendarWriteRequest) {
  const gate = assertCalendarHumanGate(req);
  if (!gate.ok) return gate;
  const method = trim(req.method);
  const calendarId = trim(req.calendarId, 300) || "primary";
  if (method === "events.insert") {
    const id = `mock_evt_${trim(req.pendingId, 20).slice(0, 8) || Date.now()}`;
    const event = normalizeEvent(
      {
        id,
        summary: trim(req.title, 500) || "新規予定",
        start: req.allDay ? { date: trim(req.start, 10) } : { dateTime: trim(req.start, 80) },
        end: req.allDay ? { date: trim(req.end, 10) } : { dateTime: trim(req.end, 80) },
        location: trim(req.location, 500),
        description: trim(req.description, 2000),
        status: "confirmed",
      },
      calendarId,
      "メインカレンダー"
    );
    return { ok: true, mock: true, method, eventId: id, event, pendingId: trim(req.pendingId, 120) };
  }
  if (method === "events.update") {
    const eventId = trim(req.eventId, 200);
    if (!eventId) return { ok: false, error: "event_id_required" };
    return {
      ok: true,
      mock: true,
      method,
      eventId,
      updated: true,
      pendingId: trim(req.pendingId, 120),
    };
  }
  if (method === "events.delete") {
    const eventId = trim(req.eventId, 200);
    if (!eventId) return { ok: false, error: "event_id_required" };
    return { ok: true, mock: true, method, eventId, deleted: true, pendingId: trim(req.pendingId, 120) };
  }
  return { ok: false, error: "unknown_calendar_write_method" };
}

async function executeLiveCalendarWrite(accessToken: string, req: CalendarWriteRequest) {
  const method = trim(req.method);
  const calendarId = trim(req.calendarId, 300) || "primary";
  const eventBody = buildEventResource(req);

  if (method === "events.insert") {
    if (!eventBody.summary || !eventBody.start) return { ok: false, error: "event_fields_required" };
    const res = await calendarMutate(
      accessToken,
      "POST",
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      eventBody
    );
    if (!res.ok) return res;
    const event = normalizeEvent(res.data || {}, calendarId, calendarId);
    return { ok: true, method, eventId: event.id, event, pendingId: trim(req.pendingId, 120) };
  }

  if (method === "events.update") {
    const eventId = trim(req.eventId, 200);
    if (!eventId) return { ok: false, error: "event_id_required" };
    const res = await calendarMutate(
      accessToken,
      "PATCH",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      eventBody
    );
    if (!res.ok) return res;
    const event = normalizeEvent(res.data || {}, calendarId, calendarId);
    return { ok: true, method, eventId, event, updated: true, pendingId: trim(req.pendingId, 120) };
  }

  if (method === "events.delete") {
    const eventId = trim(req.eventId, 200);
    if (!eventId) return { ok: false, error: "event_id_required" };
    const res = await calendarMutate(
      accessToken,
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
    if (!res.ok) return res;
    return { ok: true, method, eventId, deleted: true, pendingId: trim(req.pendingId, 120) };
  }

  return { ok: false, error: "unknown_calendar_write_method" };
}

export async function executeCalendarWrite(userId: string, req: CalendarWriteRequest) {
  const method = trim(req.method);
  if (!method) return { ok: false, error: "method_required" };
  if (isCalendarWriteBlockedPhase6F(method)) {
    return { ok: false, error: "calendar_write_forbidden", method, phase: "6-F+" };
  }
  if (!isCalendarWriteAllowedPhase6F(method)) {
    return { ok: false, error: "calendar_write_method_not_allowed", method };
  }

  const gate = assertCalendarHumanGate(req);
  if (!gate.ok) return gate;

  if (isSecretaryGoogleMockMode()) {
    return executeMockCalendarWrite(req);
  }

  const token = await ensureGoogleAccessToken(userId);
  if (!token.ok || !token.accessToken) {
    return { ok: false, error: token.error || "not_connected" };
  }

  return executeLiveCalendarWrite(token.accessToken, req);
}
