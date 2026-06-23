/**
 * Partner P1 — shared auth, validation, DB helpers
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "./cors.ts";

export type PartnerRole = "admin" | "ops" | "reviewer";

export const PARTNER_SOURCES = ["iwasho", "tasful", "builder"] as const;
export const PARTNER_TYPES = [
  "corporation",
  "sole_proprietor",
  "solo_contractor",
  "freelance",
] as const;
export const PARTNER_STATUSES = [
  "pending",
  "hold",
  "approved",
  "rejected",
  "contracted",
] as const;
export const REVIEW_ACTIONS = ["approve", "hold", "reject"] as const;
export const HOLD_REASON_CODES = [
  "H01", "H02", "H03", "H04", "H05", "H06",
  "H07", "H08", "H09", "H10", "H11", "H12",
] as const;
export const REJECT_REASON_CODES = [
  "R01", "R02", "R03", "R04", "R05", "R06",
  "R07", "R08", "R09", "R10", "R11", "R12",
] as const;

export const DOCUMENT_TYPES = [
  "insurance_policy",
  "workers_comp_proof",
  "construction_license",
  "qualification",
  "company_profile",
] as const;

export class PartnerFunctionError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PartnerFunctionError";
    this.code = code;
    this.status = status;
  }
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

export function okResponse(body: Record<string, unknown>, req?: Request, status = 200): Response {
  return jsonResponse({ ok: true, ...body }, status, req);
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  req?: Request,
): Response {
  return jsonResponse({ ok: false, code, error: code, message }, status, req);
}

export function handlePartnerError(err: unknown, req?: Request): Response {
  if (err instanceof PartnerFunctionError) {
    return errorResponse(err.code, err.message, err.status, req);
  }
  console.error("[partner]", err);
  return errorResponse("internal_error", "Internal server error", 500, req);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(req) });
  }
  return null;
}

export function requireMethod(req: Request, method: string): void {
  if (req.method !== method) {
    throw new PartnerFunctionError("method_not_allowed", `Method ${method} required`, 405);
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    throw new PartnerFunctionError("invalid_json", "Failed to read request body", 400);
  }
  if (!text.trim()) {
    throw new PartnerFunctionError("invalid_json", "Request body is empty", 400);
  }
  try {
    const parsed = JSON.parse(text) as T;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new PartnerFunctionError("invalid_json", "JSON body must be an object", 400);
    }
    return parsed;
  } catch (err) {
    if (err instanceof PartnerFunctionError) throw err;
    throw new PartnerFunctionError("invalid_json", "Invalid JSON body", 400);
  }
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export function getSupabaseEnv() {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return { url, anonKey, serviceRoleKey };
}

export function assertSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.url || !env.anonKey) {
    throw new PartnerFunctionError(
      "internal_error",
      "SUPABASE_URL or SUPABASE_ANON_KEY not configured",
      500,
    );
  }
  return env;
}

export function createPartnerServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = assertSupabaseEnv();
  if (!serviceRoleKey) {
    throw new PartnerFunctionError(
      "internal_error",
      "SUPABASE_SERVICE_ROLE_KEY not configured",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

async function verifyBearerWithSupabase(
  token: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && typeof user === "object" ? (user as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type PartnerAuthUser = {
  userId: string;
  role: PartnerRole;
  authMode: "jwt" | "dev_header";
};

function normalizeRole(raw: string): PartnerRole | null {
  const r = raw.trim().toLowerCase();
  if (r === "admin" || r === "ops" || r === "reviewer") return r;
  return null;
}

export async function resolvePartnerAuth(req: Request): Promise<PartnerAuthUser | null> {
  const allowDevHeader = String(Deno.env.get("PARTNER_ALLOW_DEV_HEADER") ?? "").trim() === "1";
  if (allowDevHeader) {
    const devRole = normalizeRole(req.headers.get("X-Partner-Role") ?? "");
    if (devRole) {
      return {
        userId: pickString(req.headers.get("X-Partner-User-Id"), "dev-reviewer"),
        role: devRole,
        authMode: "dev_header",
      };
    }
  }

  const token = getBearerToken(req);
  if (!token) return null;

  const { url, anonKey } = assertSupabaseEnv();
  const user = await verifyBearerWithSupabase(token, url, anonKey);
  if (!user) return null;

  const appMeta = (user.app_metadata && typeof user.app_metadata === "object"
    ? user.app_metadata
    : {}) as Record<string, unknown>;
  const role = normalizeRole(pickString(appMeta.partner_role, user.partner_role));
  if (!role) return null;

  return {
    userId: pickString(user.id, user.sub, "unknown"),
    role,
    authMode: "jwt",
  };
}

export async function requirePartnerRole(
  req: Request,
  allowed: PartnerRole[],
): Promise<PartnerAuthUser> {
  const user = await resolvePartnerAuth(req);
  if (!user) {
    throw new PartnerFunctionError("unauthorized", "Authentication required", 401);
  }
  if (!allowed.includes(user.role)) {
    throw new PartnerFunctionError("forbidden", "Insufficient partner role", 403);
  }
  return user;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type PartnerCreateBody = {
  source?: string;
  company_name?: string;
  representative_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  partner_type?: string;
  business_types?: string[];
  service_area?: string;
  postal_code?: string;
  corporate_number?: string;
  website_url?: string;
  sns_url?: string;
  monthly_capacity?: string;
  available_schedule?: string;
  achievements?: string;
  invoice_number?: string;
  insurance_status?: string;
  insurance_personal_limit?: string;
  insurance_property_limit?: string;
  workers_comp_type?: string;
  raw_application?: Record<string, unknown>;
  pending_documents?: string[];
};

export function validatePartnerCreate(body: PartnerCreateBody): Record<string, unknown> {
  const source = pickString(body.source);
  if (!PARTNER_SOURCES.includes(source as (typeof PARTNER_SOURCES)[number])) {
    throw new PartnerFunctionError("validation_error", "Invalid source", 400);
  }

  const company_name = pickString(body.company_name);
  const representative_name = pickString(body.representative_name);
  const contact_name = pickString(body.contact_name);
  const email = pickString(body.email);
  const phone = pickString(body.phone);
  const address = pickString(body.address);
  const partner_type = pickString(body.partner_type);
  const service_area = pickString(body.service_area);

  if (!company_name) throw new PartnerFunctionError("validation_error", "company_name is required", 400);
  if (!representative_name) {
    throw new PartnerFunctionError("validation_error", "representative_name is required", 400);
  }
  if (!contact_name) throw new PartnerFunctionError("validation_error", "contact_name is required", 400);
  if (!email) throw new PartnerFunctionError("validation_error", "email is required", 400);
  if (!isValidEmail(email)) throw new PartnerFunctionError("validation_error", "Invalid email", 400);
  if (!phone) throw new PartnerFunctionError("validation_error", "phone is required", 400);
  if (!address) throw new PartnerFunctionError("validation_error", "address is required", 400);
  if (!partner_type || !PARTNER_TYPES.includes(partner_type as (typeof PARTNER_TYPES)[number])) {
    throw new PartnerFunctionError("validation_error", "Invalid partner_type", 400);
  }
  if (!service_area) throw new PartnerFunctionError("validation_error", "service_area is required", 400);

  const business_types = Array.isArray(body.business_types)
    ? body.business_types.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (business_types.length === 0) {
    throw new PartnerFunctionError("validation_error", "business_types is required", 400);
  }

  return {
    source,
    company_name,
    representative_name,
    contact_name,
    email,
    phone,
    address,
    partner_type,
    business_types,
    service_area,
    postal_code: pickString(body.postal_code) || null,
    corporate_number: pickString(body.corporate_number) || null,
    website_url: pickString(body.website_url) || null,
    sns_url: pickString(body.sns_url) || null,
    monthly_capacity: pickString(body.monthly_capacity) || null,
    available_schedule: pickString(body.available_schedule) || null,
    achievements: pickString(body.achievements) || null,
    invoice_number: pickString(body.invoice_number) || null,
    insurance_status: pickString(body.insurance_status) || null,
    insurance_personal_limit: pickString(body.insurance_personal_limit) || null,
    insurance_property_limit: pickString(body.insurance_property_limit) || null,
    workers_comp_type: pickString(body.workers_comp_type) || null,
    raw_application: body.raw_application && typeof body.raw_application === "object"
      ? body.raw_application
      : {},
    status: "pending",
    pending_documents: Array.isArray(body.pending_documents)
      ? body.pending_documents.filter((d) =>
        DOCUMENT_TYPES.includes(d as (typeof DOCUMENT_TYPES)[number])
      )
      : [],
  };
}

export function statusForAction(action: string): string {
  if (action === "approve") return "approved";
  if (action === "hold") return "hold";
  if (action === "reject") return "rejected";
  throw new PartnerFunctionError("validation_error", "Invalid action", 400);
}

export function assertReviewTransition(current: string, action: string): void {
  if (current === "approved" || current === "rejected" || current === "contracted") {
    throw new PartnerFunctionError(
      "invalid_transition",
      `Cannot review from status: ${current}`,
      400,
    );
  }
  if (!REVIEW_ACTIONS.includes(action as (typeof REVIEW_ACTIONS)[number])) {
    throw new PartnerFunctionError("validation_error", "Invalid action", 400);
  }
}

export function validateReasonCode(action: string, reasonCode: string | null): void {
  if (!reasonCode) {
    if (action === "hold" || action === "reject") {
      throw new PartnerFunctionError("validation_error", "reason_code is required", 400);
    }
    return;
  }
  if (action === "hold" && !HOLD_REASON_CODES.includes(reasonCode as (typeof HOLD_REASON_CODES)[number])) {
    throw new PartnerFunctionError("validation_error", "Invalid hold reason_code", 400);
  }
  if (action === "reject" && !REJECT_REASON_CODES.includes(reasonCode as (typeof REJECT_REASON_CODES)[number])) {
    throw new PartnerFunctionError("validation_error", "Invalid reject reason_code", 400);
  }
}

export function formatProfileSummary(row: Record<string, unknown>) {
  return {
    id: row.id,
    partner_code: row.partner_code,
    source: row.source,
    company_name: row.company_name,
    partner_type: row.partner_type,
    business_types: row.business_types,
    service_area: row.service_area,
    status: row.status,
    email: row.email,
    phone: row.phone,
    representative_name: row.representative_name,
    contact_name: row.contact_name,
    invoice_number: row.invoice_number,
    insurance_status: row.insurance_status,
    workers_comp_type: row.workers_comp_type,
    contracted: row.contracted,
    created_at: row.created_at,
    approved_at: row.approved_at,
  };
}
