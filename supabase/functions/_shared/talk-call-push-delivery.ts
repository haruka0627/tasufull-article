export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type SafePushPayload = {
  type: string;
  call_id: string;
  room_id: string;
  caller_display_name: string;
  target_url: string;
};

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

export function trim(value: unknown, maxLen = 200): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function readVapidConfig(env: Record<string, string | undefined>): VapidConfig | null {
  const publicKey = trim(env.WEB_PUSH_VAPID_PUBLIC_KEY);
  const privateKey = trim(env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const subject = trim(env.WEB_PUSH_VAPID_SUBJECT) || "mailto:support@tasuful.local";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isVapidConfigured(env: Record<string, string | undefined>): boolean {
  return readVapidConfig(env) !== null;
}

export function sanitizePushPayload(
  payload: Record<string, unknown>,
  callId: string,
  targetUrl: string
): SafePushPayload {
  return {
    type: trim(payload.type, 64) || "talk_call_incoming",
    call_id: trim(payload.call_id, 64) || callId,
    room_id: trim(payload.room_id, 128),
    caller_display_name: trim(payload.caller_display_name, 80) || "相手",
    target_url: trim(targetUrl, 512),
  };
}

export function validateOutboundPayload(payload: SafePushPayload): boolean {
  if (!payload.type || !payload.call_id || !payload.room_id || !payload.target_url) return false;
  const text = JSON.stringify(payload).toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    if (text.includes(`"${key}"`)) return false;
  }
  return true;
}

export function buildWebPushPayload(payload: SafePushPayload): string {
  return JSON.stringify({
    type: payload.type,
    call_id: payload.call_id,
    room_id: payload.room_id,
    caller_display_name: payload.caller_display_name,
    target_url: payload.target_url,
  });
}

export function evaluateSessionGuard(
  session: { id?: string; status?: string; expires_at?: string } | null,
  nowIso: string
) {
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

export function isInvalidSubscriptionStatusCode(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}

export function isTerminalEventStatus(status: string): boolean {
  return status === "sent" || status === "skipped" || status === "cancelled";
}

export function shouldAllowRetry(status: string): boolean {
  return status === "failed";
}

export function buildSubscriptionPushObject(row: {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh_key,
      auth: row.auth_key,
    },
  };
}

export const FORBIDDEN_LOG_KEYS = [
  "credential",
  "password",
  "token",
  "email",
  "phone",
  "payment",
  "auth_key",
  "p256dh_key",
  "private_key",
  "vapid",
];

export function safeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_LOG_KEYS.includes(k.toLowerCase())) continue;
    safe[k] = v;
  }
  return safe;
}
