/**
 * support_tickets / support_events / connect_issues — localStorage + Supabase 準備
 */
(function (global) {
  "use strict";

  const TICKETS_KEY = "tasu_support_tickets_v1";
  const EVENTS_KEY = "tasu_support_events_v1";
  const CONNECT_KEY = "tasu_connect_issues_v1";
  const EVENT_BUS = "tasu:support-tickets-updated";
  const LIFECYCLE_EVENT_BUS = "tasu:support-lifecycle-event";

  const LIFECYCLE_EVENT_TYPES = Object.freeze({
    reopened: "support_reopened",
    complaint: "support_complaint",
  });

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeJson(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_BUS, { detail: { key } }));
    } catch {
      /* ignore */
    }
  }

  function mergeFromRemote(local, cacheKey) {
    const Read = global.TasuSupabaseOpsRead;
    if (Read?.mergeList) return Read.mergeList(local, cacheKey);
    return local;
  }

  function listTickets(filter) {
    let list = mergeFromRemote(readJson(TICKETS_KEY), "support_tickets");
    if (filter?.status) list = list.filter((t) => t.status === filter.status);
    if (filter?.category) list = list.filter((t) => t.category === filter.category);
    if (filter?.severity) list = list.filter((t) => t.severity === filter.severity);
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function getTicket(id) {
    return listTickets().find((t) => t.id === id) || null;
  }

  function saveTicket(ticket) {
    const list = readJson(TICKETS_KEY);
    const idx = list.findIndex((t) => t.id === ticket.id);
    const isNew = idx < 0;
    const next = { ...ticket, updated_at: new Date().toISOString() };
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    writeJson(TICKETS_KEY, list);
    if (isNew && global.TasuSupabaseOpsWrite?.insertSupportTicket) {
      void global.TasuSupabaseOpsWrite.insertSupportTicket(next);
    } else if (!isNew && global.TasuSupabaseOpsWrite?.dualWriteTicketUpdate) {
      global.TasuSupabaseOpsWrite.dualWriteTicketUpdate(next);
    }
    return next;
  }

  function appendEvent(ticketId, eventType, payloadSummary, payload) {
    const events = readJson(EVENTS_KEY);
    const row = {
      id: uid("evt"),
      ticket_id: ticketId,
      event_type: eventType,
      payload_summary: payloadSummary || "",
      payload: payload || null,
      created_at: new Date().toISOString(),
    };
    events.unshift(row);
    writeJson(EVENTS_KEY, events.slice(0, 5000));
    if (global.TasuSupabaseOpsWrite?.insertSupportEvent) {
      void global.TasuSupabaseOpsWrite.insertSupportEvent(row);
    }
    if (
      eventType === LIFECYCLE_EVENT_TYPES.reopened ||
      eventType === LIFECYCLE_EVENT_TYPES.complaint
    ) {
      try {
        global.dispatchEvent(
          new CustomEvent(LIFECYCLE_EVENT_BUS, { detail: { event: row, ticketId, eventType } })
        );
      } catch {
        /* ignore */
      }
    }
    return row;
  }

  function listAllEvents(filter) {
    let events = readJson(EVENTS_KEY);
    if (filter?.ticketId) events = events.filter((e) => e.ticket_id === filter.ticketId);
    if (filter?.eventType) events = events.filter((e) => e.event_type === filter.eventType);
    return events.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function listLifecycleEvents(options) {
    const todayOnly = options?.todayOnly === true;
    const today = new Date().toISOString().slice(0, 10);
    return listAllEvents().filter((e) => {
      if (
        e.event_type !== LIFECYCLE_EVENT_TYPES.reopened &&
        e.event_type !== LIFECYCLE_EVENT_TYPES.complaint
      ) {
        return false;
      }
      if (todayOnly && String(e.created_at || "").slice(0, 10) !== today) return false;
      return true;
    });
  }

  function recordSupportReopened(ticketId, summary, payload) {
    return appendEvent(
      ticketId,
      LIFECYCLE_EVENT_TYPES.reopened,
      summary || "同一利用者の再問い合わせ",
      payload || null
    );
  }

  function recordSupportComplaint(ticketId, summary, payload) {
    return appendEvent(
      ticketId,
      LIFECYCLE_EVENT_TYPES.complaint,
      summary || "通報・クレーム案件",
      payload || null
    );
  }

  function countLifecycleEvents(eventType, options) {
    const todayOnly = options?.todayOnly !== false;
    return listLifecycleEvents({ todayOnly }).filter((e) => e.event_type === eventType).length;
  }

  function listEvents(ticketId) {
    return readJson(EVENTS_KEY)
      .filter((e) => e.ticket_id === ticketId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function listConnectIssues(filter) {
    let list = mergeFromRemote(readJson(CONNECT_KEY), "connect_issues");
    if (filter?.status) list = list.filter((c) => c.status === filter.status);
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function saveConnectIssue(issue) {
    const list = readJson(CONNECT_KEY);
    const idx = list.findIndex((c) => c.id === issue.id);
    const isNew = idx < 0;
    const next = { ...issue, updated_at: new Date().toISOString() };
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    writeJson(CONNECT_KEY, list);
    if (isNew && global.TasuSupabaseOpsWrite?.insertConnectIssue) {
      void global.TasuSupabaseOpsWrite.insertConnectIssue(next);
    }
    return next;
  }

  function clearAllForTests() {
    localStorage.removeItem(TICKETS_KEY);
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(CONNECT_KEY);
  }

  global.TasuSupportTicketStore = {
    TICKETS_KEY,
    EVENTS_KEY,
    CONNECT_KEY,
    LIFECYCLE_EVENT_TYPES,
    LIFECYCLE_EVENT_BUS,
    uid,
    listTickets,
    getTicket,
    saveTicket,
    appendEvent,
    listEvents,
    listAllEvents,
    listLifecycleEvents,
    recordSupportReopened,
    recordSupportComplaint,
    countLifecycleEvents,
    listConnectIssues,
    saveConnectIssue,
    clearAllForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
