/**
 * Live Platform Broadcast — Edge Function（in-memory · DB/TLV 非接続）
 *
 * POST { action, surface, ... }
 *   create | start | stop | health | viewer_count | state
 *
 * Phase B stub — 本番 DB 接続は Phase B+ / schema 適用後
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const SURFACES = new Set(["platform", "tlv", "talk", "builder"]);
const STATES = {
  draft: "draft",
  starting: "starting",
  live: "live",
  stopping: "stopping",
  ended: "ended",
  failed: "failed",
} as const;

type BroadcastState = (typeof STATES)[keyof typeof STATES];

type BroadcastRecord = {
  id: string;
  surface: string;
  title: string;
  roomId: string;
  hostUserId: string | null;
  state: BroadcastState;
  viewerCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

/** In-memory store keyed by `${surface}:${broadcastId}` — cold start resets */
const store = new Map<string, BroadcastRecord>();

function storeKey(surface: string, id: string) {
  return `${surface}:${id}`;
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
  const allowed = ["create", "start", "stop", "health", "viewer_count", "state"];
  if (!allowed.includes(a)) {
    throw Object.assign(new Error(`invalid action: ${a || "(empty)"}`), { status: 400 });
  }
  return a;
}

function getLatestForSurface(surface: string): BroadcastRecord | undefined {
  let latest: BroadcastRecord | undefined;
  for (const rec of store.values()) {
    if (rec.surface !== surface) continue;
    if (!latest || rec.createdAt > latest.createdAt) latest = rec;
  }
  return latest;
}

function handleCreate(body: Record<string, unknown>, surface: string) {
  const id = String(body.broadcastId ?? `bc-${Date.now()}`).trim();
  const key = storeKey(surface, id);
  const existing = store.get(key);
  if (existing && existing.state !== STATES.ended && existing.state !== STATES.failed) {
    throw Object.assign(new Error("broadcast already exists"), { status: 409, code: "BROADCAST_STATE_ERROR" });
  }

  const rec: BroadcastRecord = {
    id,
    surface,
    title: String(body.title ?? "").trim(),
    roomId: String(body.roomId ?? `room-${Date.now()}`).trim(),
    hostUserId: body.hostUserId ? String(body.hostUserId).trim() : null,
    state: STATES.draft,
    viewerCount: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
  };
  store.set(key, rec);
  return { ok: true, state: rec.state, broadcast: rec };
}

function handleStart(surface: string) {
  const rec = getLatestForSurface(surface);
  if (!rec) throw Object.assign(new Error("broadcast not found"), { status: 404 });
  if (rec.state !== STATES.draft) {
    throw Object.assign(new Error(`start requires draft (current: ${rec.state})`), {
      status: 409,
      code: "BROADCAST_STATE_ERROR",
    });
  }
  rec.state = STATES.starting;
  rec.state = STATES.live;
  rec.startedAt = new Date().toISOString();
  return { ok: true, state: rec.state, broadcast: rec };
}

function handleStop(surface: string, reason?: unknown) {
  const rec = getLatestForSurface(surface);
  if (!rec) throw Object.assign(new Error("broadcast not found"), { status: 404 });
  if (rec.state !== STATES.live) {
    throw Object.assign(new Error(`stop requires live (current: ${rec.state})`), {
      status: 409,
      code: "BROADCAST_STATE_ERROR",
    });
  }
  rec.state = STATES.stopping;
  rec.state = STATES.ended;
  rec.endedAt = new Date().toISOString();
  return { ok: true, state: rec.state, broadcast: rec, reason: reason ? String(reason) : "user" };
}

function handleHealth(surface: string) {
  const rec = getLatestForSurface(surface);
  if (!rec) throw Object.assign(new Error("broadcast not found"), { status: 404 });
  const issues: string[] = [];
  if (rec.state === STATES.failed) issues.push("broadcast failed");
  const health = {
    ok: issues.length === 0 && rec.state !== STATES.failed,
    broadcastState: rec.state,
    providerOk: true,
    providerId: "stub",
    viewerCount: rec.viewerCount,
    sessionState: null,
    checkedAt: new Date().toISOString(),
    issues,
    stub: true,
  };
  return { ok: true, health };
}

function handleViewerCount(surface: string, countRaw: unknown) {
  const rec = getLatestForSurface(surface);
  if (!rec) throw Object.assign(new Error("broadcast not found"), { status: 404 });
  if (rec.state !== STATES.live) {
    throw Object.assign(new Error(`viewer_count requires live (current: ${rec.state})`), {
      status: 409,
      code: "BROADCAST_STATE_ERROR",
    });
  }
  const count = Math.max(0, Math.floor(Number(countRaw) || 0));
  if (!Number.isFinite(count)) {
    throw Object.assign(new Error("viewerCount must be non-negative integer"), { status: 400 });
  }
  rec.viewerCount = count;
  return { ok: true, state: rec.state, viewerCount: count };
}

function handleState(surface: string) {
  const rec = getLatestForSurface(surface);
  if (!rec) throw Object.assign(new Error("broadcast not found"), { status: 404 });
  return { ok: true, state: rec.state, broadcast: rec };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "invalid json" }, 400);
  }

  try {
    const surface = parseSurface(body.surface);
    const action = parseAction(body.action);

    let result: Record<string, unknown>;
    switch (action) {
      case "create":
        result = handleCreate(body, surface);
        break;
      case "start":
        result = handleStart(surface);
        break;
      case "stop":
        result = handleStop(surface, body.reason);
        break;
      case "health":
        result = handleHealth(surface);
        break;
      case "viewer_count":
        result = handleViewerCount(surface, body.count);
        break;
      case "state":
        result = handleState(surface);
        break;
      default:
        result = { ok: false, error: "unknown action" };
    }

    return jsonResponse(req, { ...result, surface, stub: true, edge: "live-platform-broadcast" });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return jsonResponse(
      req,
      { ok: false, error: e.message || "error", code: e.code || "UNKNOWN_ERROR" },
      e.status || 500
    );
  }
});
