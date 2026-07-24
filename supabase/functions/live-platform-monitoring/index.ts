/**
 * Live Platform Monitoring — Edge Function（in-memory · DB/TLV 非接続）
 *
 * POST { action, surface, ... }
 *   health | metrics | status | provider | smoke
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const SURFACES = new Set(["platform", "tlv", "talk", "builder"]);
const HEALTH = {
  healthy: "healthy",
  degraded: "degraded",
  failed: "failed",
  unknown: "unknown",
} as const;

type SurfaceMetrics = {
  activeSessions: number;
  liveBroadcasts: number;
  activeViewers: number;
  ccu: number;
  messagesSent: number;
  messagesBlocked: number;
  reactions: number;
  activeRecordings: number;
  completedRecordings: number;
  providerStatus: string;
  lastHeartbeatAt: string | null;
  errors: { code: string; message: string; at: string }[];
};

type SurfaceState = {
  surface: string;
  health: string;
  providerStatus: string;
  broadcastLive: boolean;
  sessionActive: boolean;
  recordingActive: boolean;
  metrics: SurfaceMetrics;
};

const store = new Map<string, SurfaceState>();

function emptyMetrics(): SurfaceMetrics {
  return {
    activeSessions: 0,
    liveBroadcasts: 0,
    activeViewers: 0,
    ccu: 0,
    messagesSent: 0,
    messagesBlocked: 0,
    reactions: 0,
    activeRecordings: 0,
    completedRecordings: 0,
    providerStatus: "unknown",
    lastHeartbeatAt: null,
    errors: [],
  };
}

function getState(surface: string): SurfaceState {
  if (!store.has(surface)) {
    store.set(surface, {
      surface,
      health: HEALTH.unknown,
      providerStatus: "unknown",
      broadcastLive: false,
      sessionActive: false,
      recordingActive: false,
      metrics: emptyMetrics(),
    });
  }
  return store.get(surface)!;
}

function parseSurface(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!SURFACES.has(s)) {
    throw Object.assign(new Error(`invalid surface: ${s || "(empty)"}`), { status: 400, code: "SURFACE_ERROR" });
  }
  return s;
}

function parseAction(raw: unknown): string {
  const a = String(raw ?? "").trim().toLowerCase();
  const allowed = ["health", "metrics", "status", "provider", "smoke", "patch"];
  if (!allowed.includes(a)) {
    throw Object.assign(new Error(`invalid action: ${a || "(empty)"}`), { status: 400 });
  }
  return a;
}

function evaluateHealth(state: SurfaceState): string {
  if (state.providerStatus === "failed") return HEALTH.failed;
  if (state.metrics.errors.length > 5) return HEALTH.degraded;
  if (state.providerStatus === "degraded") return HEALTH.degraded;
  if (state.broadcastLive || state.sessionActive) return HEALTH.healthy;
  return HEALTH.unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid json" }, 400);
  }

  try {
    const surface = parseSurface(body.surface);
    const action = parseAction(body.action);
    const state = getState(surface);

    if (action === "patch") {
      if (body.metrics && typeof body.metrics === "object") {
        Object.assign(state.metrics, body.metrics);
      }
      if (body.providerStatus) state.providerStatus = String(body.providerStatus);
      if (body.broadcastLive != null) state.broadcastLive = body.broadcastLive !== false;
      if (body.sessionActive != null) state.sessionActive = body.sessionActive !== false;
      if (body.recordingActive != null) state.recordingActive = body.recordingActive !== false;
      state.health = evaluateHealth(state);
      return jsonResponse(req, { ok: true, surface, state, stub: true });
    }

    switch (action) {
      case "health":
        state.health = evaluateHealth(state);
        return jsonResponse(req, {
          ok: state.health === HEALTH.healthy,
          health: state.health,
          surface,
          issues: state.health === HEALTH.healthy ? [] : [`edge stub: ${state.health}`],
          checkedAt: new Date().toISOString(),
          stub: true,
        });

      case "metrics":
        return jsonResponse(req, { ok: true, surface, metrics: state.metrics, stub: true });

      case "status":
        return jsonResponse(req, {
          ok: true,
          surface,
          services: {
            session: { active: state.sessionActive },
            broadcast: { live: state.broadcastLive },
            recording: { recording: state.recordingActive },
          },
          stub: true,
        });

      case "provider":
        return jsonResponse(req, {
          ok: state.providerStatus !== "failed",
          status: state.providerStatus,
          providerId: "stub",
          stub: true,
        });

      case "smoke":
        if (body.failAtStep) {
          state.metrics.errors.push({
            code: "MONITORING_SMOKE_FAILED",
            message: `failed at ${body.failAtStep}`,
            at: new Date().toISOString(),
          });
          state.health = HEALTH.failed;
          return jsonResponse(req, {
            ok: false,
            smoke: { ok: false, failedStep: body.failAtStep, steps: [{ name: String(body.failAtStep), ok: false }] },
            code: "MONITORING_SMOKE_FAILED",
            stub: true,
          });
        }
        state.broadcastLive = true;
        state.sessionActive = true;
        state.metrics.liveBroadcasts = 1;
        state.metrics.activeSessions = 1;
        state.health = HEALTH.healthy;
        return jsonResponse(req, {
          ok: true,
          smoke: {
            ok: true,
            steps: [
              { name: "session_create", ok: true },
              { name: "broadcast_start", ok: true },
              { name: "viewer_join", ok: true },
              { name: "chat_send", ok: true },
              { name: "recording_stop", ok: true },
              { name: "cleanup", ok: true },
            ],
          },
          stub: true,
        });

      default:
        return jsonResponse(req, { ok: false, error: "unknown action" }, 400);
    }
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return jsonResponse(
      req,
      { ok: false, error: e.message || "error", code: e.code || "UNKNOWN_ERROR" },
      e.status || 500
    );
  }
});
