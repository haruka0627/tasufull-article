/**
 * TASFUL MATCH — Edge Function shared helpers (JWT stub phase)
 * No real JWT signature verification or DB access.
 * Ref: reports/match-edge-jwt-design.md
 */
import { corsHeadersFor } from "./cors.ts";

export { handleOptions } from "./cors.ts";

/** @deprecated Prefer corsHeadersFor(req) — re-export for MATCH stubs */
export function corsHeaders(req?: Request): Record<string, string> {
  return corsHeadersFor(req);
}

export class MatchFunctionError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = "MatchFunctionError";
    this.code = code;
    this.status = status;
  }
}

export type JwtClaims = Record<string, unknown>;

export type MatchAuthUser = {
  ok: true;
  authMode: "jwt_stub" | "jwt_verified";
  tokenMode: "stub" | "decoded";
  talkUserId: string;
  matchUserId: string;
  /** @deprecated Use talkUserId / matchUserId — kept for existing Function callers */
  userId: string;
  claims: JwtClaims;
  debugOnly?: {
    xMatchUserId?: string;
    xMatchUserIdMismatch?: boolean;
    warnings?: string[];
  };
};

export type MatchAdminUser = MatchAuthUser & {
  adminRole: string | null;
  adminMode: "claims" | "header_fallback";
};

const STUB_MATCH_TOKEN = "stub-match-token";
const STUB_TALK_USER_ID = "stub-user-current";

export function isMatchVerifyJwtEnabled(): boolean {
  return String(Deno.env.get("MATCH_VERIFY_JWT") ?? "").trim() === "1";
}

export function isStubBearerToken(token: string): boolean {
  return String(token ?? "").trim() === STUB_MATCH_TOKEN;
}

const STUB_TOKEN_PAYLOAD: JwtClaims = {
  sub: "stub-auth-user-id",
  app_metadata: {
    talk_user_id: STUB_TALK_USER_ID,
    member_id: STUB_TALK_USER_ID,
    role: "authenticated",
  },
};

function pickString(...values: unknown[]): string {
  for (let i = 0; i < values.length; i += 1) {
    const v = String(values[i] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function readAppMetadata(claims: JwtClaims): Record<string, unknown> {
  const nested = claims.app_metadata;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return {};
}

function decodeBase64Url(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * Stub JWT payload decode — no signature verification.
 * TODO(production): replace with verifyJwt() using Supabase JWKS / auth.getUser().
 */
export function decodeJwtPayloadStub(token: string): JwtClaims | null {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return null;

  if (trimmed === STUB_MATCH_TOKEN) {
    return { ...STUB_TOKEN_PAYLOAD };
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;

  const json = decodeBase64Url(parts[1] ?? "");
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Extract MATCH / TALK text user id from JWT claims (stub-safe parse only).
 * Priority: app_metadata.talk_user_id → talk_user_id → app_metadata.member_id
 */
export function extractTalkUserIdFromClaims(claims: JwtClaims | null): string | null {
  if (!claims || typeof claims !== "object") return null;

  const appMeta = readAppMetadata(claims);

  // Do NOT use user_metadata.talk_user_id (user-editable) or sub (UUID).
  const talkUserId = pickString(
    appMeta.talk_user_id,
    claims.talk_user_id,
    appMeta.member_id,
  );

  return talkUserId || null;
}

export function extractAdminRoleFromClaims(
  claims: JwtClaims | null,
): { isAdmin: boolean; adminRole: string | null } {
  if (!claims || typeof claims !== "object") {
    return { isAdmin: false, adminRole: null };
  }

  const appMeta = readAppMetadata(claims);
  const role = pickString(appMeta.role, claims.role).toLowerCase();
  const isOpsRaw = appMeta.is_ops ?? claims.is_ops;
  const isOps =
    isOpsRaw === true ||
    String(isOpsRaw ?? "").trim().toLowerCase() === "true";

  if (role === "tasu_admin") {
    return { isAdmin: true, adminRole: "tasu_admin" };
  }
  if (role === "match_admin") {
    return { isAdmin: true, adminRole: "match_admin" };
  }
  if (isOps) {
    return { isAdmin: true, adminRole: "is_ops" };
  }

  return { isAdmin: false, adminRole: role || null };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  req?: Request,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  req?: Request,
): Response {
  return jsonResponse({ ok: false, code, error: code, message }, status, req);
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    throw new MatchFunctionError("invalid_json", "Failed to read request body", 400);
  }

  if (!text.trim()) {
    throw new MatchFunctionError("invalid_json", "Request body is empty", 400);
  }

  try {
    const parsed = JSON.parse(text) as T;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new MatchFunctionError("invalid_json", "JSON body must be an object", 400);
    }
    return parsed;
  } catch (err) {
    if (err instanceof MatchFunctionError) throw err;
    throw new MatchFunctionError("invalid_json", "Invalid JSON body", 400);
  }
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

/** Optional response fields for stub Functions */
export function authResponseFields(user: MatchAuthUser): {
  auth_mode: string;
  match_user_id: string;
} {
  return {
    auth_mode: user.authMode,
    match_user_id: user.matchUserId,
  };
}

/**
 * Supabase Auth JWT verification via /auth/v1/user (signature validated server-side).
 */
export async function verifyBearerWithSupabase(
  token: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<JwtClaims | null> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed || isStubBearerToken(trimmed)) return null;

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${trimmed}`,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as Record<string, unknown>;
    if (!user || typeof user !== "object") return null;
    return {
      sub: user.id,
      app_metadata: (user.app_metadata as JwtClaims) || {},
      user_metadata: (user.user_metadata as JwtClaims) || {},
    };
  } catch {
    return null;
  }
}

async function resolveJwtClaimsForToken(
  token: string,
  options: { supabaseUrl?: string; anonKey?: string } = {},
): Promise<{ claims: JwtClaims; tokenMode: MatchAuthUser["tokenMode"]; verified: boolean }> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    throw new MatchFunctionError("unauthorized", "Authorization header required", 401);
  }

  if (isStubBearerToken(trimmed)) {
    const claims = decodeJwtPayloadStub(trimmed);
    if (!claims) {
      throw new MatchFunctionError("unauthorized", "Invalid or unsupported token", 401);
    }
    return { claims, tokenMode: "stub", verified: false };
  }

  const supabaseUrl = options.supabaseUrl ?? Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = options.anonKey ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (isMatchVerifyJwtEnabled()) {
    if (!supabaseUrl || !anonKey) {
      throw new MatchFunctionError(
        "internal_error",
        "SUPABASE_URL and SUPABASE_ANON_KEY required when MATCH_VERIFY_JWT=1",
        500,
      );
    }
    const verifiedClaims = await verifyBearerWithSupabase(trimmed, supabaseUrl, anonKey);
    if (!verifiedClaims) {
      throw new MatchFunctionError("unauthorized", "Invalid or expired JWT", 401);
    }
    return { claims: verifiedClaims, tokenMode: "decoded", verified: true };
  }

  const claims = decodeJwtPayloadStub(trimmed);
  if (!claims) {
    throw new MatchFunctionError("unauthorized", "Invalid or unsupported token", 401);
  }
  return { claims, tokenMode: "decoded", verified: false };
}

function buildMatchAuthUser(
  req: Request,
  resolved: { claims: JwtClaims; tokenMode: MatchAuthUser["tokenMode"]; verified: boolean },
): MatchAuthUser {
  const talkUserId = extractTalkUserIdFromClaims(resolved.claims);
  if (!talkUserId) {
    throw new MatchFunctionError("forbidden", "JWT talk_user_id claim required", 403);
  }

  const xMatchUserId = req.headers.get("x-match-user-id")?.trim() || undefined;
  const warnings: string[] = [];
  let xMatchUserIdMismatch = false;

  if (xMatchUserId && xMatchUserId !== talkUserId) {
    xMatchUserIdMismatch = true;
    warnings.push(
      `x-match-user-id (${xMatchUserId}) does not match JWT talk_user_id (${talkUserId}); header is not trusted`,
    );
  }

  return {
    ok: true,
    authMode: resolved.verified ? "jwt_verified" : "jwt_stub",
    tokenMode: resolved.tokenMode,
    talkUserId,
    matchUserId: talkUserId,
    userId: talkUserId,
    claims: resolved.claims,
    ...(xMatchUserId || warnings.length
      ? {
        debugOnly: {
          ...(xMatchUserId ? { xMatchUserId, xMatchUserIdMismatch } : {}),
          ...(warnings.length ? { warnings } : {}),
        },
      }
      : {}),
  };
}

/**
 * Resolve authenticated user — decode JWT claims; optional Supabase verify when MATCH_VERIFY_JWT=1.
 */
export async function requireUserAsync(
  req: Request,
  options: { supabaseUrl?: string; anonKey?: string } = {},
): Promise<MatchAuthUser> {
  const token = getBearerToken(req);
  if (!token) {
    throw new MatchFunctionError("unauthorized", "Authorization header required", 401);
  }
  const resolved = await resolveJwtClaimsForToken(token, options);
  return buildMatchAuthUser(req, resolved);
}

/**
 * @deprecated Use requireUserAsync — sync decode-only shim for legacy imports.
 */
export function requireUser(req: Request): MatchAuthUser {
  const token = getBearerToken(req);
  if (!token) {
    throw new MatchFunctionError("unauthorized", "Authorization header required", 401);
  }
  const claims = decodeJwtPayloadStub(token);
  if (!claims) {
    throw new MatchFunctionError("unauthorized", "Invalid or unsupported token", 401);
  }
  return buildMatchAuthUser(req, {
    claims,
    tokenMode: isStubBearerToken(token) ? "stub" : "decoded",
    verified: false,
  });
}

/**
 * Admin guard — async · uses requireUserAsync then role claims.
 */
export async function requireAdminAsync(req: Request): Promise<MatchAdminUser> {
  const user = await requireUserAsync(req);
  const admin = extractAdminRoleFromClaims(user.claims);
  const adminHeader = req.headers.get("x-match-admin")?.trim().toLowerCase() ?? "";
  const headerFallback = adminHeader === "true" && !isMatchVerifyJwtEnabled();

  if (!admin.isAdmin && !headerFallback) {
    throw new MatchFunctionError("forbidden", "Admin access required", 403);
  }

  return {
    ...user,
    adminRole: admin.adminRole ?? (headerFallback ? "header_fallback" : null),
    adminMode: admin.isAdmin ? "claims" : "header_fallback",
  };
}

/** @deprecated Use requireAdminAsync */
export function requireAdmin(req: Request): MatchAdminUser {
  const user = requireUser(req);
  const admin = extractAdminRoleFromClaims(user.claims);
  const adminHeader = req.headers.get("x-match-admin")?.trim().toLowerCase() ?? "";
  const headerFallback = adminHeader === "true" && !isMatchVerifyJwtEnabled();

  if (!admin.isAdmin && !headerFallback) {
    throw new MatchFunctionError("forbidden", "Admin access required", 403);
  }

  return {
    ...user,
    adminRole: admin.adminRole ?? (headerFallback ? "header_fallback" : null),
    adminMode: admin.isAdmin ? "claims" : "header_fallback",
  };
}

export function validateString(
  field: string,
  value: unknown,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {},
): string {
  const { required = true, minLength = 1, maxLength = 500 } = options;

  if (value === undefined || value === null || value === "") {
    if (!required) return "";
    throw new MatchFunctionError("validation_error", `${field} is required`, 422);
  }

  if (typeof value !== "string") {
    throw new MatchFunctionError("validation_error", `${field} must be a string`, 422);
  }

  const trimmed = value.trim();
  if (required && trimmed.length < minLength) {
    throw new MatchFunctionError("validation_error", `${field} is required`, 422);
  }
  if (trimmed.length > maxLength) {
    throw new MatchFunctionError(
      "validation_error",
      `${field} must be at most ${maxLength} characters`,
    );
  }
  return trimmed;
}

export function validateEnum<T extends string>(
  field: string,
  value: unknown,
  allowed: readonly T[],
): T {
  const str = validateString(field, value, { minLength: 1, maxLength: 64 });
  if (!allowed.includes(str as T)) {
    throw new MatchFunctionError(
      "validation_error",
      `${field} must be one of: ${allowed.join(", ")}`,
      422,
    );
  }
  return str as T;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuidLike(field: string, value: unknown): string {
  const str = validateString(field, value, { minLength: 1, maxLength: 64 });
  if (!UUID_RE.test(str) && !str.startsWith("stub-")) {
    throw new MatchFunctionError("validation_error", `${field} must be a valid uuid`, 422);
  }
  return str;
}

export function validateTextLength(
  field: string,
  value: unknown,
  maxLength: number,
  options: { required?: boolean } = {},
): string {
  return validateString(field, value, {
    required: options.required ?? false,
    minLength: options.required ? 1 : 0,
    maxLength,
  });
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") {
    throw new MatchFunctionError("method_not_allowed", "POST only", 405);
  }
}

export function handleMatchError(err: unknown, req: Request): Response {
  if (err instanceof MatchFunctionError) {
    return errorResponse(err.code, err.message, err.status, req);
  }
  console.error("[match-function] unexpected error", err);
  return errorResponse("internal_error", "Unexpected error", 500, req);
}
