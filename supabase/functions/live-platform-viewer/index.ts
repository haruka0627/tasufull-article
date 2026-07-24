/**
 * Live Platform Viewer — Edge Function（in-memory · DB/TLV 非接続）
 *
 * POST { action, surface, userId, ... }
 *   join | leave | reconnect | heartbeat | permission | watch_state | ccu | kick
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const SURFACES = new Set(["platform", "tlv", "talk", "builder"]);
const VIEWER_STATES = {
  idle: "idle",
  joining: "joining",
  watching: "watching",
  reconnecting: "reconnecting",
  left: "left",
  kicked: "kicked",
  expired: "expired",
  failed: "failed",
} as const;

type ViewerState = (typeof VIEWER_STATES)[keyof typeof VIEWER_STATES];

type ViewerRecord = {
  userId: string;
  surface: string;
  broadcastId: string;
  state: ViewerState;
  lastHeartbeatAt: number;
};

type RoomRecord = {
  broadcastId: string;
  surface: string;
  broadcastLive: boolean;
  viewers: Map<string, ViewerRecord>;
  banned: Set<string>;
  kicked: Set<string>;
};

const HEARTBEAT_TTL_MS = 30_000;
/** key: `${surface}:${broadcastId}` */
const rooms = new Map<string, RoomRecord>();

function roomKey(surface: string, broadcastId: string) {
  return `${surface}:${broadcastId}`;
}

function getRoom(surface: string, broadcastId: string, create = false): RoomRecord | undefined {
  const key = roomKey(surface, broadcastId);
  if (!rooms.has(key) && create) {
    rooms.set(key, {
      broadcastId,
      surface,
      broadcastLive: false,
      viewers: new Map(),
      banned: new Set(),
      kicked: new Set(),
    });
  }
  return rooms.get(key);
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
  const allowed = ["join", "leave", "reconnect", "heartbeat", "permission", "watch_state", "ccu", "kick", "set_live"];
  if (!allowed.includes(a)) {
    throw Object.assign(new Error(`invalid action: ${a || "(empty)"}`), { status: 400 });
  }
  return a;
}

function requireUserId(raw: unknown): string {
  const u = String(raw ?? "").trim();
  if (!u) throw Object.assign(new Error("userId required"), { status: 400 });
  return u;
}

function expireStale(room: RoomRecord, nowMs = Date.now()) {
  const expired: string[] = [];
  for (const [uid, rec] of room.viewers.entries()) {
    if (rec.state === VIEWER_STATES.watching && nowMs - rec.lastHeartbeatAt > HEARTBEAT_TTL_MS) {
      rec.state = VIEWER_STATES.expired;
      room.viewers.delete(uid);
      expired.push(uid);
    }
  }
  return expired;
}

function getCcu(room: RoomRecord, nowMs = Date.now()) {
  expireStale(room, nowMs);
  let count = 0;
  for (const rec of room.viewers.values()) {
    if (rec.state === VIEWER_STATES.watching) count += 1;
  }
  return count;
}

function checkPermission(
  room: RoomRecord,
  userId: string,
  action: "join" | "reconnect",
  viewerState: ViewerState
) {
  if (room.banned.has(userId)) {
    throw Object.assign(new Error("viewer banned"), { status: 403, code: "VIEWER_BANNED" });
  }
  if (action === "join") {
    if (room.kicked.has(userId) || viewerState === VIEWER_STATES.kicked) {
      throw Object.assign(new Error("viewer kicked"), { status: 403, code: "VIEWER_KICKED" });
    }
    if (!room.broadcastLive) {
      throw Object.assign(new Error("broadcast not live"), { status: 409, code: "BROADCAST_NOT_LIVE" });
    }
    return;
  }
  if (viewerState === VIEWER_STATES.expired) {
    throw Object.assign(new Error("viewer expired"), { status: 403, code: "VIEWER_EXPIRED" });
  }
  if (room.kicked.has(userId) || viewerState === VIEWER_STATES.kicked) {
    throw Object.assign(new Error("viewer kicked"), { status: 403, code: "VIEWER_KICKED" });
  }
  if (!room.broadcastLive) {
    throw Object.assign(new Error("broadcast not live"), { status: 409, code: "BROADCAST_NOT_LIVE" });
  }
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
    const broadcastId = String(body.broadcastId ?? "bc-edge-default").trim();
    const room = getRoom(surface, broadcastId, true)!;

    if (action === "set_live") {
      room.broadcastLive = body.live !== false;
      return jsonResponse(req, { ok: true, broadcastLive: room.broadcastLive, surface, stub: true });
    }

    const userId = requireUserId(body.userId);
    const now = Date.now();
    let viewer = room.viewers.get(userId);
    const viewerState = viewer?.state ?? VIEWER_STATES.idle;

    switch (action) {
      case "permission": {
        const permAction = String(body.permAction ?? "join").trim().toLowerCase() as "join" | "reconnect";
        checkPermission(room, userId, permAction, viewerState);
        return jsonResponse(req, { ok: true, allowed: true, surface, stub: true });
      }

      case "join": {
        checkPermission(room, userId, "join", viewerState);
        viewer = {
          userId,
          surface,
          broadcastId,
          state: VIEWER_STATES.watching,
          lastHeartbeatAt: now,
        };
        room.viewers.set(userId, viewer);
        const ccu = getCcu(room, now);
        return jsonResponse(req, { ok: true, state: viewer.state, ccu, surface, stub: true });
      }

      case "leave": {
        if (!viewer) throw Object.assign(new Error("viewer not found"), { status: 404 });
        room.viewers.delete(userId);
        return jsonResponse(req, { ok: true, state: VIEWER_STATES.left, ccu: getCcu(room, now), surface, stub: true });
      }

      case "reconnect": {
        if (!viewer) throw Object.assign(new Error("viewer not found"), { status: 404 });
        checkPermission(room, userId, "reconnect", viewer.state);
        viewer.state = VIEWER_STATES.watching;
        viewer.lastHeartbeatAt = now;
        return jsonResponse(req, { ok: true, state: viewer.state, ccu: getCcu(room, now), surface, stub: true });
      }

      case "heartbeat": {
        if (!viewer || viewer.state !== VIEWER_STATES.watching) {
          throw Object.assign(new Error("heartbeat requires watching"), { status: 409, code: "VIEWER_STATE_ERROR" });
        }
        viewer.lastHeartbeatAt = now;
        expireStale(room, now);
        return jsonResponse(req, { ok: true, ccu: getCcu(room, now), surface, stub: true });
      }

      case "watch_state": {
        return jsonResponse(req, {
          ok: true,
          watchState: {
            viewerState: viewer?.state ?? VIEWER_STATES.idle,
            broadcastId,
            broadcastLive: room.broadcastLive,
            ccu: getCcu(room, now),
            lastHeartbeatAt: viewer?.lastHeartbeatAt ? new Date(viewer.lastHeartbeatAt).toISOString() : null,
            surface,
          },
          stub: true,
        });
      }

      case "ccu":
        return jsonResponse(req, { ok: true, ccu: getCcu(room, now), surface, stub: true });

      case "kick": {
        room.kicked.add(userId);
        if (viewer) room.viewers.delete(userId);
        return jsonResponse(req, { ok: true, kicked: userId, ccu: getCcu(room, now), surface, stub: true });
      }

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
