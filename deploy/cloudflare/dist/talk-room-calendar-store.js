/**
 * TASFUL TALK — トーク内カレンダー / 予定（mock store）
 * 将来 Supabase: talk_room_events
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_room_calendar_v1";
  const EVENT_NAME = "tasful-talk-room-calendar-changed";
  const DB_TABLE = "talk_room_events";

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

  function readRaw() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return { events: [] };
      const parsed = JSON.parse(raw);
      return { events: Array.isArray(parsed.events) ? parsed.events : [] };
    } catch {
      return { events: [] };
    }
  }

  function writeRaw(next) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    } catch {
      /* ignore */
    }
  }

  function normalizeEvent(raw, threadId) {
    if (!raw || typeof raw !== "object") return null;
    const title = pickStr(raw.title);
    const startsAt = pickStr(raw.startsAt, raw.dateTime);
    if (!title || !startsAt) return null;
    return {
      id: pickStr(raw.id) || `evt_${Date.now()}`,
      threadId: pickStr(raw.threadId, threadId),
      title,
      startsAt,
      location: pickStr(raw.location),
      memo: pickStr(raw.memo, raw.note),
      mapUrl: pickStr(raw.mapUrl, raw.googleMapUrl),
      notifyEnabled: raw.notifyEnabled !== false,
      meetingTime: pickStr(raw.meetingTime),
      siteAddress: pickStr(raw.siteAddress),
      parking: pickStr(raw.parking),
      belongings: pickStr(raw.belongings),
      assignee: pickStr(raw.assignee),
      navUrl: pickStr(raw.navUrl),
      createdAt: pickStr(raw.createdAt) || nowIso(),
      updatedAt: nowIso(),
    };
  }

  function listEvents(threadId) {
    const id = pickStr(threadId);
    if (!id) return [];
    return readRaw()
      .events.filter((e) => String(e.threadId) === id)
      .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  }

  /**
   * @param {string} threadId
   * @param {object} input
   */
  function addEvent(threadId, input) {
    const id = pickStr(threadId);
    const row = normalizeEvent(input, id);
    if (!id || !row) return null;
    const data = readRaw();
    data.events = [row, ...data.events.filter((e) => String(e.id) !== String(row.id))].slice(0, 500);
    writeRaw(data);
    return row;
  }

  function removeEvent(eventId) {
    const id = pickStr(eventId);
    if (!id) return false;
    const data = readRaw();
    const next = data.events.filter((e) => String(e.id) !== id);
    if (next.length === data.events.length) return false;
    data.events = next;
    writeRaw(data);
    return true;
  }

  function toggleEventNotify(eventId) {
    const id = pickStr(eventId);
    if (!id) return null;
    const data = readRaw();
    const idx = data.events.findIndex((e) => String(e.id) === id);
    if (idx < 0) return null;
    data.events[idx] = {
      ...data.events[idx],
      notifyEnabled: !data.events[idx].notifyEnabled,
      updatedAt: nowIso(),
    };
    writeRaw(data);
    return data.events[idx];
  }

  function resolveNavUrl(event) {
    return pickStr(event?.navUrl, event?.mapUrl);
  }

  function upsertEvents(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    const data = readRaw();
    const byId = new Map(data.events.map((e) => [String(e.id), e]));
    const saved = [];
    list.forEach((raw) => {
      const threadId = pickStr(raw?.threadId);
      const row = normalizeEvent(raw, threadId);
      if (!row) return;
      byId.set(String(row.id), row);
      saved.push(row);
    });
    data.events = [...byId.values()].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    writeRaw(data);
    return saved;
  }

  function removeEventsByIds(ids) {
    const drop = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)));
    if (!drop.size) return 0;
    const data = readRaw();
    const next = data.events.filter((e) => !drop.has(String(e.id)));
    const removed = data.events.length - next.length;
    if (removed > 0) {
      data.events = next;
      writeRaw(data);
    }
    return removed;
  }

  global.TasuTalkRoomCalendarStore = {
    STORAGE_KEY,
    EVENT_NAME,
    DB_TABLE,
    listEvents,
    addEvent,
    upsertEvents,
    removeEvent,
    removeEventsByIds,
    toggleEventNotify,
    resolveNavUrl,
    normalizeEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
