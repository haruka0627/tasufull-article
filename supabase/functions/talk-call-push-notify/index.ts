import webpush from "https://esm.sh/web-push@3.6.7?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  buildSubscriptionPushObject,
  buildWebPushPayload,
  evaluateSessionGuard,
  isInvalidSubscriptionStatusCode,
  isTerminalEventStatus,
  isVapidConfigured,
  readVapidConfig,
  safeLogPayload,
  sanitizePushPayload,
  trim,
  validateOutboundPayload,
} from "../_shared/talk-call-push-delivery.ts";

type RequestBody = {
  call_id?: string;
  event_id?: string;
  mock?: boolean;
};

type PushEventRow = {
  id: string;
  call_id: string;
  callee_user_id: string;
  room_id: string;
  payload: Record<string, unknown>;
  target_url: string;
  delivery_status: string;
  retry_eligible: boolean;
};

type SessionRow = {
  id: string;
  status: string;
  expires_at: string;
  callee_id: string;
  caller_id: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  status: string;
};

function safeLog(event: string, payload: Record<string, unknown>) {
  console.log(`[talk-call-push-notify] ${event}`, safeLogPayload(payload));
}

async function patchEvent(
  supabaseUrl: string,
  headers: Record<string, string>,
  eventId: string,
  patch: Record<string, unknown>,
  onlyIfPending = false
) {
  const qs = onlyIfPending
    ? `id=eq.${encodeURIComponent(eventId)}&delivery_status=eq.pending`
    : `id=eq.${encodeURIComponent(eventId)}`;
  const res = await fetch(`${supabaseUrl}/rest/v1/talk_call_push_events?${qs}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  }).catch(() => null);
  if (!res?.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : null;
}

async function markSubscriptionInactive(
  supabaseUrl: string,
  headers: Record<string, string>,
  endpoint: string
) {
  await fetch(
    `${supabaseUrl}/rest/v1/talk_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "inactive", updated_at: new Date().toISOString() }),
    }
  ).catch(() => null);
}

async function fetchPendingEvent(
  supabaseUrl: string,
  headers: Record<string, string>,
  callId: string,
  eventId?: string
): Promise<PushEventRow | null> {
  let url = `${supabaseUrl}/rest/v1/talk_call_push_events?delivery_status=eq.pending&select=id,call_id,callee_user_id,room_id,payload,target_url,delivery_status,retry_eligible&limit=1`;
  if (eventId) {
    url = `${supabaseUrl}/rest/v1/talk_call_push_events?id=eq.${encodeURIComponent(eventId)}&delivery_status=eq.pending&select=id,call_id,callee_user_id,room_id,payload,target_url,delivery_status,retry_eligible&limit=1`;
  } else {
    url += `&call_id=eq.${encodeURIComponent(callId)}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const rows = (await res.json()) as PushEventRow[];
  return Array.isArray(rows) ? rows[0] : null;
}

async function fetchActiveSubscriptions(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string
): Promise<SubscriptionRow[]> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/talk_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,endpoint,p256dh_key,auth_key,status`,
    { headers }
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as SubscriptionRow[];
  return Array.isArray(rows) ? rows : [];
}

function extractWebPushStatusCode(err: unknown): number {
  if (!err || typeof err !== "object") return 0;
  const statusCode = (err as { statusCode?: number }).statusCode;
  return Number(statusCode || 0);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const callId = trim(body.call_id, 64);
  const eventId = trim(body.event_id, 64);
  if (!callId && !eventId) {
    return jsonResponse({ ok: false, error: "missing_call_id" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "supabase_not_configured",
      call_id: callId || undefined,
    });
  }

  const env = Deno.env.toObject();
  const authHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const patchHeaders = {
    ...authHeaders,
    "Content-Type": "application/json",
  };

  const event = await fetchPendingEvent(supabaseUrl, authHeaders, callId, eventId || undefined);
  if (!event?.id) {
    return jsonResponse({ ok: true, skipped: true, reason: "no_pending_event", call_id: callId });
  }
  if (isTerminalEventStatus(event.delivery_status)) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "already_terminal",
      event_id: event.id,
      delivery_status: event.delivery_status,
    });
  }

  const resolvedCallId = trim(event.call_id, 64);
  const sessionRes = await fetch(
    `${supabaseUrl}/rest/v1/talk_call_sessions?id=eq.${encodeURIComponent(resolvedCallId)}&select=id,status,expires_at,callee_id,caller_id&limit=1`,
    { headers: authHeaders }
  );
  if (!sessionRes.ok) {
    safeLog("session_fetch_failed", { call_id: resolvedCallId, status: sessionRes.status });
    await patchEvent(supabaseUrl, patchHeaders, event.id, {
      delivery_status: "failed",
      retry_eligible: true,
      sent_at: new Date().toISOString(),
    }, true);
    return jsonResponse({ ok: false, error: "session_fetch_failed", call_id: resolvedCallId }, 502);
  }

  const sessionRows = (await sessionRes.json()) as SessionRow[];
  const session = Array.isArray(sessionRows) ? sessionRows[0] : null;
  const guard = evaluateSessionGuard(session, new Date().toISOString());

  if (!guard.ok) {
    safeLog("session_guard", {
      call_id: resolvedCallId,
      reason: guard.reason,
      delivery_status: guard.delivery_status,
    });
    await patchEvent(supabaseUrl, patchHeaders, event.id, {
      delivery_status: guard.delivery_status,
      retry_eligible: guard.retry_eligible,
      sent_at: new Date().toISOString(),
    }, true);
    return jsonResponse({
      ok: true,
      skipped: guard.delivery_status === "skipped",
      call_id: resolvedCallId,
      event_id: event.id,
      delivery_status: guard.delivery_status,
      reason: guard.reason,
    });
  }

  const safePayload = sanitizePushPayload(
    (event.payload || {}) as Record<string, unknown>,
    resolvedCallId,
    event.target_url
  );
  if (!validateOutboundPayload(safePayload)) {
    await patchEvent(supabaseUrl, patchHeaders, event.id, {
      delivery_status: "failed",
      retry_eligible: false,
      sent_at: new Date().toISOString(),
    }, true);
    return jsonResponse({ ok: false, error: "invalid_payload", call_id: resolvedCallId }, 400);
  }

  if (!isVapidConfigured(env) || body.mock === true) {
    safeLog("vapid_skip", { call_id: resolvedCallId, event_id: event.id });
    await patchEvent(supabaseUrl, patchHeaders, event.id, {
      delivery_status: "skipped",
      retry_eligible: false,
      sent_at: new Date().toISOString(),
    }, true);
    return jsonResponse({
      ok: true,
      skipped: true,
      call_id: resolvedCallId,
      event_id: event.id,
      delivery_status: "skipped",
      reason: "vapid_unconfigured",
      payload: safePayload,
    });
  }

  const vapid = readVapidConfig(env)!;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const subscriptions = await fetchActiveSubscriptions(
    supabaseUrl,
    authHeaders,
    trim(event.callee_user_id, 128)
  );
  if (!subscriptions.length) {
    await patchEvent(supabaseUrl, patchHeaders, event.id, {
      delivery_status: "failed",
      retry_eligible: true,
      sent_at: new Date().toISOString(),
    }, true);
    return jsonResponse({
      ok: true,
      call_id: resolvedCallId,
      event_id: event.id,
      delivery_status: "failed",
      reason: "no_subscription",
      retry_eligible: true,
    });
  }

  const pushBody = buildWebPushPayload(safePayload);
  let delivered = false;
  const inactiveEndpoints: string[] = [];
  let lastStatus = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(buildSubscriptionPushObject(sub), pushBody);
      delivered = true;
      break;
    } catch (err) {
      lastStatus = extractWebPushStatusCode(err);
      safeLog("send_failed", {
        call_id: resolvedCallId,
        event_id: event.id,
        status_code: lastStatus,
        endpoint_suffix: trim(sub.endpoint, 32).slice(-16),
      });
      if (isInvalidSubscriptionStatusCode(lastStatus)) {
        inactiveEndpoints.push(sub.endpoint);
        await markSubscriptionInactive(supabaseUrl, patchHeaders, sub.endpoint);
      }
    }
  }

  if (delivered) {
    const patched = await patchEvent(
      supabaseUrl,
      patchHeaders,
      event.id,
      { delivery_status: "sent", retry_eligible: false, sent_at: new Date().toISOString() },
      true
    );
    safeLog("sent", { call_id: resolvedCallId, event_id: event.id, patched: Boolean(patched) });
    return jsonResponse({
      ok: true,
      call_id: resolvedCallId,
      event_id: event.id,
      delivery_status: "sent",
      payload: safePayload,
    });
  }

  await patchEvent(
    supabaseUrl,
    patchHeaders,
    event.id,
    {
      delivery_status: "failed",
      retry_eligible: true,
      sent_at: new Date().toISOString(),
    },
    true
  );

  return jsonResponse({
    ok: true,
    call_id: resolvedCallId,
    event_id: event.id,
    delivery_status: "failed",
    reason: inactiveEndpoints.length ? "invalid_subscription" : "send_failed",
    retry_eligible: true,
    inactive_count: inactiveEndpoints.length,
    last_status: lastStatus || undefined,
  });
});
