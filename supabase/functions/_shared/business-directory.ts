/**
 * Business Directory Phase 2 — shared repository / service / transitions
 * Ref: docs/business-directory-data-model-design.md · AD-013
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "./cors.ts";

export const LISTING_TYPES = ["shop_retail", "business_service"] as const;
export const LISTING_STATUSES = [
  "draft",
  "review_requested",
  "published",
  "rejected",
  "suspended",
  "unpublished",
  "archived",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingType = (typeof LISTING_TYPES)[number];

/** Service-layer allowed status transitions (strict + ops restore) */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ["review_requested"],
  review_requested: ["published", "rejected"],
  published: ["suspended", "unpublished"],
  rejected: ["draft"],
  suspended: ["review_requested", "published"],
  unpublished: ["review_requested", "published"],
  archived: [],
};

export class BusinessDirectoryError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "BusinessDirectoryError";
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

export function handleBusinessDirectoryError(err: unknown, req?: Request): Response {
  if (err instanceof BusinessDirectoryError) {
    return errorResponse(err.code, err.message, err.status, req);
  }
  console.error("[business-directory]", err);
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
    throw new BusinessDirectoryError("method_not_allowed", `Method ${method} required`, 405);
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    throw new BusinessDirectoryError("invalid_json", "Failed to read request body", 400);
  }
  if (!text.trim()) return {} as T;
  try {
    const parsed = JSON.parse(text) as T;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new BusinessDirectoryError("invalid_json", "JSON body must be an object", 400);
    }
    return parsed;
  } catch (err) {
    if (err instanceof BusinessDirectoryError) throw err;
    throw new BusinessDirectoryError("invalid_json", "Invalid JSON body", 400);
  }
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
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
    throw new BusinessDirectoryError(
      "internal_error",
      "SUPABASE_URL or SUPABASE_ANON_KEY not configured",
      500,
    );
  }
  return env;
}

export function createBusinessDirectoryServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = assertSupabaseEnv();
  if (!serviceRoleKey) {
    throw new BusinessDirectoryError(
      "internal_error",
      "SUPABASE_SERVICE_ROLE_KEY not configured",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

function isOpsFromJwt(user: Record<string, unknown>): boolean {
  const roles = [
    pickString(user.role),
    pickString((user.app_metadata as Record<string, unknown>)?.role),
    pickString((user.user_metadata as Record<string, unknown>)?.role),
    pickString((user.app_metadata as Record<string, unknown>)?.ops_admin),
  ].map((r) => r.toLowerCase());
  return roles.some((r) =>
    ["ops_admin", "tasu_admin", "tasu_ops_admin", "admin"].includes(r)
  ) || String(user.ops_admin ?? "") === "true";
}

export type BusinessDirectoryAuth = {
  userId: string;
  isOps: boolean;
  authMode: "jwt" | "dev_header";
};

export async function resolveBusinessDirectoryAuth(req: Request): Promise<BusinessDirectoryAuth | null> {
  const allowDev = String(Deno.env.get("BUSINESS_DIRECTORY_ALLOW_DEV_HEADER") ?? "").trim() === "1";
  if (allowDev) {
    const devUser = pickString(req.headers.get("X-Business-Directory-User-Id"));
    if (devUser) {
      const isOps = pickString(req.headers.get("X-Business-Directory-Ops")) === "1";
      return { userId: devUser, isOps, authMode: "dev_header" };
    }
  }

  const token = getBearerToken(req);
  if (!token) return null;

  const { url, anonKey } = assertSupabaseEnv();
  const user = await verifyBearerWithSupabase(token, url, anonKey);
  if (!user) return null;

  return {
    userId: pickString(user.id, user.sub),
    isOps: isOpsFromJwt(user),
    authMode: "jwt",
  };
}

export async function requireAuth(req: Request): Promise<BusinessDirectoryAuth> {
  const auth = await resolveBusinessDirectoryAuth(req);
  if (!auth?.userId) {
    throw new BusinessDirectoryError("unauthorized", "Authentication required", 401);
  }
  return auth;
}

export async function requireOps(req: Request): Promise<BusinessDirectoryAuth> {
  const auth = await requireAuth(req);
  if (!auth.isOps) {
    throw new BusinessDirectoryError("forbidden", "Ops role required", 403);
  }
  return auth;
}

export function assertStatusTransition(from: ListingStatus, to: ListingStatus): void {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessDirectoryError(
      "invalid_transition",
      `Cannot transition from ${from} to ${to}`,
      400,
    );
  }
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "listing";
}

export type DraftListingInput = {
  listing_type?: string;
  plan_code?: string;
  category_id?: string;
  display_name?: string;
  slug?: string;
  service_areas?: string[];
  hp_mode?: string;
  website_url?: string | null;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  postal_code?: string | null;
  prefecture?: string;
  city?: string;
  address_line1?: string;
  address_line2?: string | null;
  short_description?: string;
  shop_sales_genre?: string | null;
  service_summary?: string | null;
  price_range_text?: string | null;
  terms_accepted?: boolean;
};

function validateListingType(v: string): ListingType {
  if (!LISTING_TYPES.includes(v as ListingType)) {
    throw new BusinessDirectoryError("validation_error", "Invalid listing_type", 400);
  }
  return v as ListingType;
}

function validateDraftInput(body: DraftListingInput, partial = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.listing_type !== undefined) out.listing_type = validateListingType(String(body.listing_type));
  if (body.plan_code !== undefined) out.plan_code = pickString(body.plan_code) || "free";
  if (body.category_id !== undefined) out.category_id = pickString(body.category_id);
  if (body.display_name !== undefined) out.display_name = pickString(body.display_name);
  if (body.slug !== undefined) out.slug = slugify(pickString(body.slug));
  if (body.service_areas !== undefined) {
    out.service_areas = Array.isArray(body.service_areas)
      ? body.service_areas.map((a) => String(a).trim()).filter(Boolean)
      : [];
  }
  if (body.hp_mode !== undefined) {
    const mode = pickString(body.hp_mode);
    if (mode && !["external_redirect", "full_page"].includes(mode)) {
      throw new BusinessDirectoryError("validation_error", "Invalid hp_mode", 400);
    }
    out.hp_mode = mode || "full_page";
  }
  if (body.website_url !== undefined) out.website_url = pickString(body.website_url) || null;

  if (!partial) {
    if (!out.listing_type) throw new BusinessDirectoryError("validation_error", "listing_type required", 400);
    if (!out.category_id) throw new BusinessDirectoryError("validation_error", "category_id required", 400);
    if (!out.display_name) throw new BusinessDirectoryError("validation_error", "display_name required", 400);
    if (!Array.isArray(out.service_areas) || (out.service_areas as string[]).length === 0) {
      throw new BusinessDirectoryError("validation_error", "service_areas required", 400);
    }
    if (!pickString(body.company_name)) {
      throw new BusinessDirectoryError("validation_error", "company_name required", 400);
    }
    if (!pickString(body.contact_name)) {
      throw new BusinessDirectoryError("validation_error", "contact_name required", 400);
    }
    if (!pickString(body.contact_email)) {
      throw new BusinessDirectoryError("validation_error", "contact_email required", 400);
    }
    if (!pickString(body.contact_phone)) {
      throw new BusinessDirectoryError("validation_error", "contact_phone required", 400);
    }
    if (!pickString(body.prefecture) || !pickString(body.city) || !pickString(body.address_line1)) {
      throw new BusinessDirectoryError("validation_error", "address required", 400);
    }
    if (!pickString(body.short_description)) {
      throw new BusinessDirectoryError("validation_error", "short_description required", 400);
    }
    if (body.terms_accepted !== true) {
      throw new BusinessDirectoryError("validation_error", "terms_accepted required", 400);
    }
  }

  return out;
}

function profileFromDraft(body: DraftListingInput, listingId: string): Record<string, unknown> | null {
  const company = pickString(body.company_name);
  if (!company && body.company_name === undefined) return null;
  return {
    listing_id: listingId,
    company_name: company,
    contact_name: pickString(body.contact_name),
    contact_email: pickString(body.contact_email),
    contact_phone: pickString(body.contact_phone),
    postal_code: pickString(body.postal_code) || null,
    prefecture: pickString(body.prefecture),
    city: pickString(body.city),
    address_line1: pickString(body.address_line1),
    address_line2: pickString(body.address_line2) || null,
    short_description: pickString(body.short_description),
    shop_sales_genre: pickString(body.shop_sales_genre) || null,
    service_summary: pickString(body.service_summary) || null,
    price_range_text: pickString(body.price_range_text) || null,
    terms_accepted_at: body.terms_accepted ? new Date().toISOString() : null,
  };
}

export async function appendAuditLog(
  supabase: SupabaseClient,
  params: {
    listingId: string;
    actorUserId: string | null;
    actorRole: "owner" | "ops" | "system";
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("business_directory_audit_logs").insert({
    listing_id: params.listingId,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    action: params.action,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error("[business-directory] audit", error);
    throw new BusinessDirectoryError("audit_failed", error.message, 500);
  }
}

async function getListingOrThrow(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  if (!data) throw new BusinessDirectoryError("not_found", "Listing not found", 404);
  return data as Record<string, unknown>;
}

async function assertOwner(
  listing: Record<string, unknown>,
  ownerUserId: string,
): Promise<void> {
  if (String(listing.owner_user_id) !== ownerUserId) {
    throw new BusinessDirectoryError("forbidden", "Not listing owner", 403);
  }
}

async function transitionListingStatus(
  supabase: SupabaseClient,
  listing: Record<string, unknown>,
  toStatus: ListingStatus,
  audit: {
    actorUserId: string | null;
    actorRole: "owner" | "ops" | "system";
    action: string;
    metadata?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const fromStatus = String(listing.status) as ListingStatus;
  assertStatusTransition(fromStatus, toStatus);

  const patch: Record<string, unknown> = { status: toStatus };
  if (toStatus === "published") {
    patch.published_at = listing.published_at || new Date().toISOString();
  }
  if (toStatus === "suspended") {
    patch.suspended_at = new Date().toISOString();
  }
  if (toStatus === "archived") {
    patch.archived_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("business_directory_listings")
    .update(patch)
    .eq("id", listing.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new BusinessDirectoryError("db_error", error?.message || "update failed", 500);
  }

  await appendAuditLog(supabase, {
    listingId: String(listing.id),
    actorUserId: audit.actorUserId,
    actorRole: audit.actorRole,
    action: audit.action,
    fromStatus,
    toStatus,
    metadata: audit.metadata,
  });

  return data as Record<string, unknown>;
}

export async function createDraftListing(
  supabase: SupabaseClient,
  ownerUserId: string,
  body: DraftListingInput,
): Promise<Record<string, unknown>> {
  const validated = validateDraftInput(body, false);
  const displayName = String(validated.display_name);
  const slug = validated.slug
    ? String(validated.slug)
    : `${slugify(displayName)}-${crypto.randomUUID().slice(0, 8)}`;

  const { data: listing, error: listingErr } = await supabase
    .from("business_directory_listings")
    .insert({
      owner_user_id: ownerUserId,
      listing_type: validated.listing_type,
      status: "draft",
      plan_code: validated.plan_code || "free",
      category_id: validated.category_id,
      display_name: displayName,
      slug,
      service_areas: validated.service_areas,
      hp_mode: validated.hp_mode || "full_page",
      website_url: validated.website_url ?? null,
    })
    .select("*")
    .single();

  if (listingErr || !listing) {
    throw new BusinessDirectoryError("db_error", listingErr?.message || "insert failed", 500);
  }

  const profileRow = profileFromDraft(body, String(listing.id));
  if (profileRow) {
    const { error: profileErr } = await supabase
      .from("business_directory_profiles")
      .insert(profileRow);
    if (profileErr) {
      throw new BusinessDirectoryError("db_error", profileErr.message, 500);
    }
  }

  await appendAuditLog(supabase, {
    listingId: String(listing.id),
    actorUserId: ownerUserId,
    actorRole: "owner",
    action: "listing.created",
    fromStatus: null,
    toStatus: "draft",
  });

  return listing as Record<string, unknown>;
}

export async function updateDraftListing(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  body: DraftListingInput,
): Promise<Record<string, unknown>> {
  let listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const status = String(listing.status) as ListingStatus;
  if (!["draft", "rejected"].includes(status)) {
    throw new BusinessDirectoryError(
      "invalid_state",
      "Can only update draft or rejected listings",
      400,
    );
  }

  if (status === "rejected") {
    listing = await transitionListingStatus(supabase, listing, "draft", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.reopen_after_reject",
    });
  }

  const validated = validateDraftInput(body, true);
  const listingPatch: Record<string, unknown> = {};
  for (const key of [
    "listing_type", "plan_code", "category_id", "display_name", "slug",
    "service_areas", "hp_mode", "website_url",
  ]) {
    if (validated[key] !== undefined) listingPatch[key] = validated[key];
  }

  if (Object.keys(listingPatch).length > 0) {
    const { data, error } = await supabase
      .from("business_directory_listings")
      .update(listingPatch)
      .eq("id", listingId)
      .select("*")
      .single();
    if (error || !data) {
      throw new BusinessDirectoryError("db_error", error?.message || "update failed", 500);
    }
    listing = data as Record<string, unknown>;
  }

  const profilePatch = profileFromDraft(body, listingId);
  if (profilePatch) {
    const { company_name, contact_name, contact_email, contact_phone, postal_code,
      prefecture, city, address_line1, address_line2, short_description,
      shop_sales_genre, service_summary, price_range_text, terms_accepted_at } = profilePatch;

    const { error: profileErr } = await supabase
      .from("business_directory_profiles")
      .upsert({
        listing_id: listingId,
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        postal_code,
        prefecture,
        city,
        address_line1,
        address_line2,
        short_description,
        shop_sales_genre,
        service_summary,
        price_range_text,
        terms_accepted_at: terms_accepted_at || undefined,
      }, { onConflict: "listing_id" });
    if (profileErr) {
      throw new BusinessDirectoryError("db_error", profileErr.message, 500);
    }
  }

  await appendAuditLog(supabase, {
    listingId,
    actorUserId: ownerUserId,
    actorRole: "owner",
    action: "profile.update",
    fromStatus: String(listing.status),
    toStatus: String(listing.status),
  });

  return listing;
}

export async function getOwnerListings(
  supabase: SupabaseClient,
  ownerUserId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("id, listing_type, status, plan_code, display_name, slug, updated_at, published_at")
    .eq("owner_user_id", ownerUserId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getOwnerListingDetail(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const { data: profile } = await supabase
    .from("business_directory_profiles")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();

  const { data: photos } = await supabase
    .from("business_directory_photos")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");

  return { listing, profile: profile ?? null, photos: photos ?? [] };
}

function buildListingSnapshot(listing: Record<string, unknown>, profile: unknown): Record<string, unknown> {
  return {
    listing_id: listing.id,
    display_name: listing.display_name,
    listing_type: listing.listing_type,
    plan_code: listing.plan_code,
    category_id: listing.category_id,
    status: listing.status,
    profile,
    captured_at: new Date().toISOString(),
  };
}

export async function submitListingForReview(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  requestType: "initial_publish" | "content_update" = "initial_publish",
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const from = String(listing.status) as ListingStatus;
  if (!["draft", "suspended", "unpublished"].includes(from)) {
    throw new BusinessDirectoryError(
      "invalid_state",
      "Listing cannot be submitted for review from current status",
      400,
    );
  }

  const { data: profile } = await supabase
    .from("business_directory_profiles")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();

  const updated = await transitionListingStatus(supabase, listing, "review_requested", {
    actorUserId: ownerUserId,
    actorRole: "owner",
    action: "listing.submit_review",
  });

  const { data: reviewReq, error: reviewErr } = await supabase
    .from("business_directory_review_requests")
    .insert({
      listing_id: listingId,
      request_type: requestType,
      status: "open",
      submitted_by: ownerUserId,
      snapshot_json: buildListingSnapshot(updated, profile),
    })
    .select("*")
    .single();

  if (reviewErr || !reviewReq) {
    throw new BusinessDirectoryError("db_error", reviewErr?.message || "review insert failed", 500);
  }

  return { listing: updated, review_request: reviewReq };
}

export async function getPublicListings(
  supabase: SupabaseClient,
  filters: { listing_type?: string; limit?: number; offset?: number } = {},
): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("business_directory_listings_public")
    .select("*")
    .order("published_at", { ascending: false });

  if (filters.listing_type) {
    q = q.eq("listing_type", filters.listing_type);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getPublicListingDetail(
  supabase: SupabaseClient,
  slug: string,
  listingType?: string,
): Promise<Record<string, unknown>> {
  let q = supabase
    .from("business_directory_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published");

  if (listingType) q = q.eq("listing_type", listingType);

  const { data: listing, error } = await q.maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  if (!listing) throw new BusinessDirectoryError("not_found", "Published listing not found", 404);

  const listingId = String(listing.id);
  const [{ data: profile }, { data: photos }, { data: hours }, { data: sns }, { data: tlv }] =
    await Promise.all([
      supabase.from("business_directory_profiles").select("*").eq("listing_id", listingId).maybeSingle(),
      supabase.from("business_directory_photos").select("*").eq("listing_id", listingId).order("sort_order"),
      supabase.from("business_directory_business_hours").select("*").eq("listing_id", listingId).order("sort_order"),
      supabase.from("business_directory_social_links").select("*").eq("listing_id", listingId).order("sort_order"),
      supabase.from("business_directory_tlv_videos").select("*").eq("listing_id", listingId).order("sort_order"),
    ]);

  return {
    listing,
    profile: profile ?? null,
    photos: photos ?? [],
    business_hours: hours ?? [],
    social_links: sns ?? [],
    tlv_videos: tlv ?? [],
  };
}

export async function getReviewQueue(
  supabase: SupabaseClient,
  filters: { status?: string; limit?: number } = {},
): Promise<Record<string, unknown>[]> {
  const status = filters.status || "open";
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);

  const { data, error } = await supabase
    .from("business_directory_review_requests")
    .select("*, business_directory_listings(id, display_name, listing_type, plan_code, status)")
    .eq("status", status)
    .order("submitted_at", { ascending: true })
    .limit(limit);

  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data ?? []) as Record<string, unknown>[];
}

async function closeOpenReviewRequest(
  supabase: SupabaseClient,
  listingId: string,
  opsUserId: string,
  outcome: "approved" | "rejected",
  rejectReason?: { code?: string; note?: string },
): Promise<Record<string, unknown>> {
  const { data: openReq, error: fetchErr } = await supabase
    .from("business_directory_review_requests")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "open")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw new BusinessDirectoryError("db_error", fetchErr.message, 500);
  if (!openReq) {
    throw new BusinessDirectoryError("invalid_state", "No open review request", 400);
  }

  const { data, error } = await supabase
    .from("business_directory_review_requests")
    .update({
      status: outcome,
      reviewed_by: opsUserId,
      reviewed_at: new Date().toISOString(),
      reject_reason_code: outcome === "rejected" ? (rejectReason?.code ?? null) : null,
      reject_reason_note: outcome === "rejected" ? (rejectReason?.note ?? null) : null,
    })
    .eq("id", openReq.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new BusinessDirectoryError("db_error", error?.message || "review update failed", 500);
  }
  return data as Record<string, unknown>;
}

export async function approveListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  if (String(listing.status) !== "review_requested") {
    throw new BusinessDirectoryError("invalid_state", "Listing is not awaiting review", 400);
  }

  const review = await closeOpenReviewRequest(supabase, listingId, opsUserId, "approved");
  const updated = await transitionListingStatus(supabase, listing, "published", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.approve",
  });

  return { listing: updated, review_request: review };
}

export async function rejectListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
  rejectReason: { code?: string; note?: string } = {},
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  if (String(listing.status) !== "review_requested") {
    throw new BusinessDirectoryError("invalid_state", "Listing is not awaiting review", 400);
  }

  const review = await closeOpenReviewRequest(supabase, listingId, opsUserId, "rejected", rejectReason);
  const updated = await transitionListingStatus(supabase, listing, "rejected", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.reject",
    metadata: { reject_reason_code: rejectReason.code ?? null },
  });

  return { listing: updated, review_request: review };
}

export async function suspendListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  const updated = await transitionListingStatus(supabase, listing, "suspended", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.suspend",
    metadata: reason ? { reason } : {},
  });
  return updated;
}

export async function unpublishListing(
  supabase: SupabaseClient,
  actorUserId: string,
  actorRole: "owner" | "ops",
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  if (actorRole === "owner") {
    await assertOwner(listing, actorUserId);
  }
  const updated = await transitionListingStatus(supabase, listing, "unpublished", {
    actorUserId,
    actorRole,
    action: "listing.unpublish",
  });
  return updated;
}

export async function restoreListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  const from = String(listing.status) as ListingStatus;
  if (!["suspended", "unpublished"].includes(from)) {
    throw new BusinessDirectoryError(
      "invalid_state",
      "Only suspended or unpublished listings can be restored",
      400,
    );
  }
  const updated = await transitionListingStatus(supabase, listing, "published", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.restore",
  });
  return updated;
}
