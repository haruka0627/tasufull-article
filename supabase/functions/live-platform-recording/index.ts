/**
 * Live Platform Recording — Edge Function（in-memory · DB/TLV/VOD 非接続）
 *
 * POST { action, surface, ... }
 *   start | stop | status | archive
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const SURFACES = new Set(["platform", "tlv", "talk", "builder"]);
const STATES = {
  idle: "idle",
  starting: "starting",
  recording: "recording",
  stopping: "stopping",
  completed: "completed",
  failed: "failed",
  expired: "expired",
} as const;

type RecordingMeta = {
  recordingId: string;
  broadcastId: string;
  sessionId: string | null;
  surface: string;
  provider: string;
  startedAt: string | null;
  stoppedAt: string | null;
  durationSec: number | null;
  storageKey: string | null;
  playbackUrl: string | null;
  status: string;
  errorCode: string | null;
  startedMs?: number;
};

type RoomRec = {
  broadcastId: string;
  surface: string;
  broadcastLive: boolean;
  recording: RecordingMeta | null;
  archive: object | null;
};

const rooms = new Map<string, RoomRec>();

function roomKey(surface: string, broadcastId: string) {
  return `${surface}:${broadcastId}`;
}

function getRoom(surface: string, broadcastId: string, create = false): RoomRec | undefined {
  const key = roomKey(surface, broadcastId);
  if (!rooms.has(key) && create) {
    rooms.set(key, { broadcastId, surface, broadcastLive: false, recording: null, archive: null });
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
  const allowed = ["start", "stop", "status", "archive", "set_live"];
  if (!allowed.includes(a)) {
    throw Object.assign(new Error(`invalid action: ${a || "(empty)"}`), { status: 400 });
  }
  return a;
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
    const broadcastId = String(body.broadcastId ?? "bc-rec-default").trim();
    const room = getRoom(surface, broadcastId, true)!;

    if (action === "set_live") {
      room.broadcastLive = body.live !== false;
      return jsonResponse(req, { ok: true, broadcastLive: room.broadcastLive, surface, stub: true });
    }

    switch (action) {
      case "start": {
        if (!room.broadcastLive) {
          throw Object.assign(new Error("broadcast not live"), { status: 409, code: "BROADCAST_NOT_LIVE" });
        }
        if (room.recording && room.recording.status === STATES.recording) {
          throw Object.assign(new Error("already recording"), { status: 409, code: "RECORDING_STATE_ERROR" });
        }
        const recordingId = String(body.recordingId ?? `rec-${Date.now()}`).trim();
        const startedAt = new Date().toISOString();
        room.recording = {
          recordingId,
          broadcastId,
          sessionId: body.sessionId ? String(body.sessionId) : null,
          surface,
          provider: "stub",
          startedAt,
          stoppedAt: null,
          durationSec: null,
          storageKey: `stub-rec://${surface}/${broadcastId}/${recordingId}`,
          playbackUrl: null,
          status: STATES.recording,
          errorCode: null,
          startedMs: Date.now(),
        };
        return jsonResponse(req, { ok: true, state: STATES.recording, metadata: stripInternal(room.recording), surface, stub: true });
      }

      case "stop": {
        const rec = room.recording;
        if (!rec || rec.status !== STATES.recording) {
          throw Object.assign(new Error("not recording"), { status: 409, code: "RECORDING_STATE_ERROR" });
        }
        const stoppedAt = new Date().toISOString();
        const durationSec = rec.startedMs ? Math.max(0, Math.floor((Date.now() - rec.startedMs) / 1000)) : 0;
        rec.stoppedAt = stoppedAt;
        rec.durationSec = durationSec;
        rec.playbackUrl = `stub-playback://${surface}/${broadcastId}/${rec.recordingId}.mp4`;
        rec.status = STATES.completed;
        return jsonResponse(req, { ok: true, state: STATES.completed, metadata: stripInternal(rec), surface, stub: true });
      }

      case "status":
        return jsonResponse(req, {
          ok: true,
          state: room.recording?.status ?? STATES.idle,
          metadata: room.recording ? stripInternal(room.recording) : null,
          surface,
          stub: true,
        });

      case "archive": {
        const rec = room.recording;
        if (!rec || rec.status !== STATES.completed) {
          throw Object.assign(new Error("recording not completed"), { status: 409, code: "RECORDING_STATE_ERROR" });
        }
        const ttlSec = Number(body.ttlSec) > 0 ? Number(body.ttlSec) : 86400;
        room.archive = {
          archiveId: `arc-${rec.recordingId}`,
          recordingId: rec.recordingId,
          broadcastId,
          surface,
          storageKey: rec.storageKey,
          playbackUrl: rec.playbackUrl,
          durationSec: rec.durationSec,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
        };
        return jsonResponse(req, { ok: true, archive: room.archive, metadata: stripInternal(rec), surface, stub: true });
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

function stripInternal(rec: RecordingMeta) {
  const { startedMs, ...rest } = rec;
  return rest;
}
