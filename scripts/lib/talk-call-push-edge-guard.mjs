/**
 * TALK Push Edge — session guard（Node テスト用・Edge Function と同期）
 */
const TERMINAL_STATUSES = new Set(["ended", "rejected", "missed", "active", "busy"]);

export function evaluateSessionGuard(session, nowIso = new Date().toISOString()) {
  if (!session?.id) {
    return { ok: false, delivery_status: "failed", reason: "session_not_found" };
  }
  const status = String(session.status || "").trim();
  if (TERMINAL_STATUSES.has(status)) {
    return { ok: false, delivery_status: "skipped", reason: `session_${status}` };
  }
  if (status !== "ringing") {
    return { ok: false, delivery_status: "skipped", reason: `session_${status || "unknown"}` };
  }
  const expiresAt = String(session.expires_at || "").trim();
  if (expiresAt && expiresAt <= nowIso) {
    return { ok: false, delivery_status: "skipped", reason: "session_expired" };
  }
  return { ok: true, delivery_status: "pending", reason: "ringing" };
}

export function sanitizePushPayload(payload, callId) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    type: String(p.type || "talk_call_incoming").slice(0, 64),
    call_id: String(p.call_id || callId || "").slice(0, 64),
    room_id: String(p.room_id || "").slice(0, 128),
    caller_display_name: String(p.caller_display_name || "").slice(0, 80),
  };
}
