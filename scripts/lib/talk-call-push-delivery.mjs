/**
 * TALK Push delivery — Node テスト用（Edge _shared と同期）
 */
const FORBIDDEN_KEYS = new Set([
  "email",
  "phone",
  "address",
  "token",
  "credential",
  "password",
  "payment",
  "role",
  "auth_key",
  "p256dh_key",
]);

const TERMINAL_SESSION_STATUSES = new Set(["ended", "rejected", "missed", "active", "busy"]);

export function trim(value, maxLen = 200) {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function readVapidConfig(env = {}) {
  const publicKey = trim(env.WEB_PUSH_VAPID_PUBLIC_KEY);
  const privateKey = trim(env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const subject = trim(env.WEB_PUSH_VAPID_SUBJECT) || "mailto:support@tasuful.local";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isVapidConfigured(env = {}) {
  return readVapidConfig(env) !== null;
}

export function sanitizePushPayload(payload, callId, targetUrl) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    type: trim(p.type, 64) || "talk_call_incoming",
    call_id: trim(p.call_id, 64) || callId,
    room_id: trim(p.room_id, 128),
    caller_display_name: trim(p.caller_display_name, 80) || "相手",
    target_url: trim(targetUrl, 512),
  };
}

export function validateOutboundPayload(payload) {
  if (!payload?.type || !payload.call_id || !payload.room_id || !payload.target_url) return false;
  const text = JSON.stringify(payload).toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    if (text.includes(`"${key}"`)) return false;
  }
  return true;
}

export function buildWebPushPayload(payload) {
  return JSON.stringify({
    type: payload.type,
    call_id: payload.call_id,
    room_id: payload.room_id,
    caller_display_name: payload.caller_display_name,
    target_url: payload.target_url,
  });
}

export function evaluateSessionGuard(session, nowIso = new Date().toISOString()) {
  if (!session?.id) {
    return { ok: false, delivery_status: "failed", reason: "session_not_found", retry_eligible: true };
  }
  const status = trim(session.status, 32);
  if (TERMINAL_SESSION_STATUSES.has(status)) {
    return { ok: false, delivery_status: "skipped", reason: `session_${status}`, retry_eligible: false };
  }
  if (status !== "ringing") {
    return { ok: false, delivery_status: "skipped", reason: `session_${status || "unknown"}`, retry_eligible: false };
  }
  const expiresAt = trim(session.expires_at, 64);
  if (expiresAt && expiresAt <= nowIso) {
    return { ok: false, delivery_status: "skipped", reason: "session_expired", retry_eligible: false };
  }
  return { ok: true, delivery_status: "pending", reason: "ringing", retry_eligible: false };
}

export function isInvalidSubscriptionStatusCode(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

export function isTerminalEventStatus(status) {
  return status === "sent" || status === "skipped" || status === "cancelled";
}

export function buildSubscriptionPushObject(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh_key, auth: row.auth_key },
  };
}

/**
 * @param {object} opts
 * @param {object|null} opts.vapid
 * @param {object} opts.event
 * @param {object|null} opts.session
 * @param {object[]} opts.subscriptions
 * @param {(sub: object, payload: string) => Promise<{ ok: boolean, statusCode?: number }>} opts.sendFn
 */
export async function deliverPendingPushEvent(opts) {
  const { vapid, event, session, subscriptions, sendFn } = opts;
  if (!event?.id || event.delivery_status !== "pending") {
    return { delivery_status: event?.delivery_status || "skipped", reason: "not_pending", retry_eligible: false };
  }
  if (isTerminalEventStatus(event.delivery_status)) {
    return { delivery_status: event.delivery_status, reason: "already_terminal", retry_eligible: false };
  }

  const guard = evaluateSessionGuard(session);
  if (!guard.ok) {
    return { delivery_status: guard.delivery_status, reason: guard.reason, retry_eligible: guard.retry_eligible };
  }

  if (!vapid) {
    return { delivery_status: "skipped", reason: "vapid_unconfigured", retry_eligible: false };
  }

  const safePayload = sanitizePushPayload(event.payload || {}, event.call_id, event.target_url);
  if (!validateOutboundPayload(safePayload)) {
    return { delivery_status: "failed", reason: "invalid_payload", retry_eligible: false };
  }

  const pushBody = buildWebPushPayload(safePayload);
  const activeSubs = (subscriptions || []).filter((s) => String(s.status || "active") === "active");
  if (!activeSubs.length) {
    return { delivery_status: "failed", reason: "no_subscription", retry_eligible: true };
  }

  const inactiveEndpoints = [];
  let sent = false;
  let lastStatus = 0;

  for (const sub of activeSubs) {
    const result = await sendFn(buildSubscriptionPushObject(sub), pushBody);
    if (result.ok) {
      sent = true;
      break;
    }
    lastStatus = Number(result.statusCode || 0);
    if (isInvalidSubscriptionStatusCode(lastStatus)) {
      inactiveEndpoints.push(sub.endpoint);
    }
  }

  if (sent) {
    return {
      delivery_status: "sent",
      reason: "delivered",
      retry_eligible: false,
      inactiveEndpoints,
    };
  }

  return {
    delivery_status: "failed",
    reason: inactiveEndpoints.length ? "invalid_subscription" : "send_failed",
    retry_eligible: true,
    inactiveEndpoints,
    lastStatus,
  };
}
