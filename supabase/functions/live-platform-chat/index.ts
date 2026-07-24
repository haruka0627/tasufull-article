/**
 * Live Platform Chat — Edge Function（in-memory · DB/TLV 非接続）
 *
 * POST { action, surface, ... }
 *   send_message | add_reaction | remove_reaction | system_event | messages
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const SURFACES = new Set(["platform", "tlv", "talk", "builder"]);
const MSG_STATES = { pending: "pending", sent: "sent", blocked: "blocked", deleted: "deleted", failed: "failed" };
const SYSTEM_TYPES = new Set([
  "viewer_joined",
  "viewer_left",
  "broadcast_started",
  "broadcast_ended",
  "warning",
  "provider_notice",
]);

type MessageRecord = {
  id: string;
  surface: string;
  broadcastId: string;
  userId: string;
  text: string;
  state: string;
  createdAt: string;
};

type RoomChat = {
  broadcastId: string;
  surface: string;
  broadcastLive: boolean;
  messages: Map<string, MessageRecord>;
  reactions: Map<string, Map<string, Set<string>>>;
  systemEvents: object[];
  watching: Set<string>;
};

const rooms = new Map<string, RoomChat>();

function roomKey(surface: string, broadcastId: string) {
  return `${surface}:${broadcastId}`;
}

function getRoom(surface: string, broadcastId: string, create = false): RoomChat | undefined {
  const key = roomKey(surface, broadcastId);
  if (!rooms.has(key) && create) {
    rooms.set(key, {
      broadcastId,
      surface,
      broadcastLive: false,
      messages: new Map(),
      reactions: new Map(),
      systemEvents: [],
      watching: new Set(),
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
  const allowed = ["send_message", "add_reaction", "remove_reaction", "system_event", "messages", "set_live", "set_watching"];
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

function assertLive(room: RoomChat) {
  if (!room.broadcastLive) {
    throw Object.assign(new Error("broadcast not live"), { status: 409, code: "BROADCAST_NOT_LIVE" });
  }
}

function assertWatching(room: RoomChat, userId: string) {
  if (!room.watching.has(userId)) {
    throw Object.assign(new Error("viewer not watching"), { status: 403, code: "VIEWER_NOT_WATCHING" });
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
    const broadcastId = String(body.broadcastId ?? "bc-chat-default").trim();
    const room = getRoom(surface, broadcastId, true)!;

    if (action === "set_live") {
      room.broadcastLive = body.live !== false;
      return jsonResponse(req, { ok: true, broadcastLive: room.broadcastLive, surface, stub: true });
    }

    if (action === "set_watching") {
      const userId = requireUserId(body.userId);
      if (body.watching === false) room.watching.delete(userId);
      else room.watching.add(userId);
      return jsonResponse(req, { ok: true, surface, stub: true });
    }

    switch (action) {
      case "send_message": {
        assertLive(room);
        const userId = requireUserId(body.userId);
        assertWatching(room, userId);
        const text = String(body.text ?? "").trim();
        if (!text) throw Object.assign(new Error("message empty"), { status: 400, code: "CHAT_VALIDATION_ERROR" });

        const id = `msg-${Date.now()}`;
        const msg: MessageRecord = {
          id,
          surface,
          broadcastId,
          userId,
          text,
          state: MSG_STATES.sent,
          createdAt: new Date().toISOString(),
        };
        room.messages.set(id, msg);
        return jsonResponse(req, { ok: true, message: msg, surface, stub: true });
      }

      case "add_reaction": {
        assertLive(room);
        const userId = requireUserId(body.userId);
        assertWatching(room, userId);
        const messageId = String(body.messageId ?? "").trim();
        const reaction = String(body.reaction ?? "").trim();
        if (!messageId || !reaction) throw Object.assign(new Error("messageId/reaction required"), { status: 400 });
        if (!room.reactions.has(messageId)) room.reactions.set(messageId, new Map());
        const bucket = room.reactions.get(messageId)!;
        if (!bucket.has(reaction)) bucket.set(reaction, new Set());
        bucket.get(reaction)!.add(userId);
        const counts: Record<string, number> = {};
        for (const [r, users] of bucket.entries()) counts[r] = users.size;
        return jsonResponse(req, { ok: true, messageId, reaction, counts, surface, stub: true });
      }

      case "remove_reaction": {
        const userId = requireUserId(body.userId);
        const messageId = String(body.messageId ?? "").trim();
        const reaction = String(body.reaction ?? "").trim();
        const bucket = room.reactions.get(messageId);
        bucket?.get(reaction)?.delete(userId);
        const counts: Record<string, number> = {};
        if (bucket) for (const [r, users] of bucket.entries()) counts[r] = users.size;
        return jsonResponse(req, { ok: true, messageId, reaction, counts, surface, stub: true });
      }

      case "system_event": {
        const type = String(body.type ?? "").trim().toLowerCase();
        if (!SYSTEM_TYPES.has(type)) {
          throw Object.assign(new Error(`invalid system event type: ${type}`), { status: 400 });
        }
        const event = {
          id: `sys-${Date.now()}`,
          surface,
          broadcastId,
          type,
          payload: body.payload && typeof body.payload === "object" ? body.payload : {},
          createdAt: new Date().toISOString(),
        };
        room.systemEvents.push(event);
        return jsonResponse(req, { ok: true, event, surface, stub: true });
      }

      case "messages": {
        const list = Array.from(room.messages.values()).filter((m) => m.state !== MSG_STATES.deleted);
        return jsonResponse(req, { ok: true, messages: list, surface, stub: true });
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
