/**
 * TALK ensure-talk-room — lightweight JWT / stub auth
 */
import { corsHeadersFor } from "./cors.ts";

export { handleOptions, jsonResponse } from "./cors.ts";

export class TalkRoomFunctionError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = "TalkRoomFunctionError";
    this.code = code;
    this.status = status;
  }
}

export type TalkAuthUser = {
  talkUserId: string;
  tokenMode: "stub" | "decoded" | "anon";
  claims: Record<string, unknown>;
};

const STUB_TALK_TOKEN = "stub-talk-token";
const STUB_TALK_USER_ID = "u_me";

function pickString(...values: unknown[]): string {
  for (let i = 0; i < values.length; i += 1) {
    const v = String(values[i] ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function getBearerToken(req: Request): string {
  const auth = String(req.headers.get("Authorization") || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readTalkUserIdFromClaims(claims: Record<string, unknown>): string {
  const appMeta =
    claims.app_metadata && typeof claims.app_metadata === "object" && !Array.isArray(claims.app_metadata)
      ? (claims.app_metadata as Record<string, unknown>)
      : {};
  return pickString(
    appMeta.talk_user_id,
    appMeta.member_id,
    claims.talk_user_id,
    claims.member_id,
    claims.sub,
  );
}

export function requireTalkUser(req: Request): TalkAuthUser {
  const token = getBearerToken(req);
  if (!token) {
    throw new TalkRoomFunctionError("unauthorized", "Authorization header required", 401);
  }

  if (token === STUB_TALK_TOKEN) {
    return {
      talkUserId: STUB_TALK_USER_ID,
      tokenMode: "stub",
      claims: { sub: STUB_TALK_USER_ID },
    };
  }

  const claims = decodeJwtPayload(token);
  if (claims) {
    const talkUserId = readTalkUserIdFromClaims(claims);
    if (talkUserId) {
      return { talkUserId, tokenMode: "decoded", claims };
    }
  }

  // anon key as bearer — dev fallback (caller must pass buyer_id/seller_id in body)
  return {
    talkUserId: "",
    tokenMode: "anon",
    claims: {},
  };
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") {
    throw new TalkRoomFunctionError("method_not_allowed", "POST required", 405);
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new TalkRoomFunctionError("invalid_json", "Invalid JSON body", 400);
  }
}

export function validateUuidLike(field: string, value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new TalkRoomFunctionError("invalid_request", `${field} is required`, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new TalkRoomFunctionError("invalid_request", `${field} must be a UUID`, 400);
  }
  return raw;
}

export function handleTalkRoomError(err: unknown, req?: Request): Response {
  if (err instanceof TalkRoomFunctionError) {
    return new Response(
      JSON.stringify({ ok: false, code: err.code, message: err.message }),
      { status: err.status, headers: { ...corsHeadersFor(req), "Content-Type": "application/json" } },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[ensure-talk-room]", message);
  return new Response(
    JSON.stringify({ ok: false, code: "internal_error", message }),
    { status: 500, headers: { ...corsHeadersFor(req), "Content-Type": "application/json" } },
  );
}
