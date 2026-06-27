/**
 * AI秘書 Phase 7-B — Workspace Activity / Audit Log
 * sessionStorage · metadata only · max 100 entries · no tokens/bodies
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_secretary_workspace_activity_v1";
  const MAX_ENTRIES = 100;

  const FORBIDDEN_KEYS = /^(access_token|refresh_token|client_secret|authorization|cookie|replyBody|body|text|summaryText|description)$/i;
  const FORBIDDEN_VALUE = /^(Bearer\s|ya29\.|1\/\/)/i;

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function readAll() {
    try {
      const raw = global.sessionStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(entries) {
    const list = Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : [];
    try {
      global.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    if (typeof CustomEvent !== "undefined") {
      global.dispatchEvent?.(new CustomEvent("tasu:workspace-activity-updated"));
    }
  }

  function sanitizeValue(key, value) {
    if (FORBIDDEN_KEYS.test(String(key || ""))) return undefined;
    if (typeof value === "string") {
      if (FORBIDDEN_VALUE.test(value)) return undefined;
      if (/access_token|refresh_token|client_secret/i.test(value)) return undefined;
      return trim(value, 500);
    }
    if (value && typeof value === "object") return sanitizeObject(value);
    return value;
  }

  function sanitizeObject(obj, depth) {
    depth = depth || 0;
    if (!obj || typeof obj !== "object" || depth > 6) return obj;
    if (Array.isArray(obj)) {
      return obj
        .slice(0, 30)
        .map((row) => sanitizeObject(row, depth + 1))
        .filter((row) => row !== undefined);
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/access_token|refresh_token|client_secret|authorization|cookie/i.test(k)) continue;
      if (k === "snippet" || k === "replyBody" || k === "body" || k === "text") continue;
      const next = sanitizeValue(k, v);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }

  function sanitizeEntry(entry) {
    return sanitizeObject(entry);
  }

  function servicesFromPlan(plan) {
    const set = new Set();
    for (const st of plan?.steps || []) {
      if (st.service && st.service !== "human_gate" && st.service !== "summary") set.add(st.service);
    }
    return [...set];
  }

  function executedStepsFromPlan(plan) {
    return (plan?.steps || []).map((st) => ({
      id: st.id,
      label: st.label,
      service: st.service,
      status: st.status,
    }));
  }

  function mapStatus(plan, override) {
    if (override?.status) return override.status;
    const s = trim(plan?.status, 40);
    if (s === "done") return "success";
    if (s === "error") return "failed";
    if (s === "cancelled") return "cancelled";
    if (s === "awaiting_gate") return "awaiting_gate";
    return s || "unknown";
  }

  function buildEntryFromPlan(plan, options) {
    options = options || {};
    const humanGateRequired = (plan?.steps || []).some((s) => s.kind === "human_gate");
    const entry = {
      requestId: trim(plan?.id, 120),
      timestamp: trim(plan?.startedAt || plan?.createdAt, 80) || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      intent: trim(plan?.intent, 80),
      userTextPreview: trim(plan?.userText, 160),
      plan: {
        steps: executedStepsFromPlan(plan),
      },
      executedSteps: executedStepsFromPlan(plan).filter((s) => s.status === "done" || s.status === "blocked"),
      executedApis: Array.isArray(plan?.executedApis) ? plan.executedApis.slice(0, 20) : [],
      result: trim(options.result || plan?.logs?.[plan.logs.length - 1]?.summary, 300),
      status: mapStatus(plan, options),
      duration: Math.max(0, Number(options.duration) || 0),
      services: servicesFromPlan(plan),
      humanGate: {
        required: humanGateRequired,
        pendingId: trim(plan?.humanGatePendingId || options.pendingId, 120) || null,
        state: options.humanGateState || (humanGateRequired && plan?.status === "awaiting_gate" ? "pending" : null),
      },
      cancelReason: trim(options.cancelReason, 200) || null,
      error: trim(options.error || plan?.error, 300) || null,
    };
    return sanitizeEntry(entry);
  }

  function recordFromPlan(plan, options) {
    if (!plan?.id) return null;
    const entry = buildEntryFromPlan(plan, options);
    const list = readAll();
    const idx = list.findIndex((row) => row.requestId === entry.requestId);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.unshift(entry);
    writeAll(list.slice(0, MAX_ENTRIES));
    return entry;
  }

  function updateActivity(requestId, patch) {
    requestId = trim(requestId, 120);
    if (!requestId) return null;
    const list = readAll();
    const idx = list.findIndex((row) => row.requestId === requestId);
    if (idx < 0) return null;
    list[idx] = sanitizeEntry({ ...list[idx], ...patch, requestId });
    writeAll(list);
    return list[idx];
  }

  function updateHumanGate(requestId, patch) {
    patch = patch || {};
    const list = readAll();
    const idx = list.findIndex((row) => row.requestId === trim(requestId, 120));
    if (idx < 0) return null;
    const prev = list[idx];
    list[idx] = sanitizeEntry({
      ...prev,
      status: patch.status || prev.status,
      error: patch.error ?? prev.error,
      cancelReason: patch.cancelReason ?? prev.cancelReason,
      finishedAt: new Date().toISOString(),
      humanGate: {
        ...(prev.humanGate || {}),
        pendingId: patch.pendingId ?? prev.humanGate?.pendingId ?? null,
        state: patch.state || prev.humanGate?.state,
      },
      result: patch.result || prev.result,
    });
    writeAll(list);
    return list[idx];
  }

  function listActivities(filters) {
    filters = filters || {};
    let rows = readAll();
    const q = trim(filters.q || filters.search, 120).toLowerCase();
    const status = trim(filters.status, 40).toLowerCase();
    const service = trim(filters.service, 40).toLowerCase();
    const humanGate = filters.humanGate === true || filters.humanGate === "1";

    if (status === "success") rows = rows.filter((r) => r.status === "success");
    else if (status === "failed") rows = rows.filter((r) => r.status === "failed");
    else if (status === "cancelled") rows = rows.filter((r) => r.status === "cancelled");
    else if (status === "human_gate" || humanGate) {
      rows = rows.filter((r) => r.humanGate?.required || r.humanGate?.state);
    }

    if (service && ["gmail", "calendar", "contacts", "drive"].includes(service)) {
      rows = rows.filter((r) => (r.services || []).includes(service));
    }

    if (q) {
      rows = rows.filter(
        (r) =>
          String(r.intent || "").toLowerCase().includes(q) ||
          String(r.requestId || "").toLowerCase().includes(q) ||
          String(r.userTextPreview || "").toLowerCase().includes(q)
      );
    }

    return rows.slice(0, MAX_ENTRIES);
  }

  function getActivity(requestId) {
    return readAll().find((row) => row.requestId === trim(requestId, 120)) || null;
  }

  function exportJson(filters) {
    const rows = listActivities(filters);
    return JSON.stringify(sanitizeEntry({ exportedAt: new Date().toISOString(), count: rows.length, entries: rows }), null, 2);
  }

  function clearForTests() {
    try {
      global.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function scanForSecrets(obj) {
    const text = JSON.stringify(obj || {});
    return /access_token|refresh_token|client_secret|authorization\s*:/i.test(text);
  }

  global.TasuSecretaryWorkspaceActivity = {
    STORAGE_KEY,
    MAX_ENTRIES,
    sanitizeEntry,
    recordFromPlan,
    updateActivity,
    updateHumanGate,
    listActivities,
    getActivity,
    exportJson,
    clearForTests,
    scanForSecrets,
    readAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
