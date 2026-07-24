/**
 * Business Directory Phase 2 — shared repository / service / transitions
 * Ref: docs/business-directory-data-model-design.md · AD-013
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "./cors.ts";
import { resolveEffectivePlanCode } from "./business-directory-plans.ts";

export const BD_PHOTO_BUCKET = "business-directory";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

const MEDIA_EDITABLE_STATUSES = new Set<ListingStatus>([
  "draft",
  "rejected",
  "published",
  "unpublished",
]);

/** Service-layer allowed status transitions (strict + ops restore) */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  draft: ["review_requested"],
  review_requested: ["published", "rejected"],
  published: ["suspended", "unpublished", "review_requested"],
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

export type ProfileFaqItem = { q: string; a: string };

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
  full_description?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  faq_items?: ProfileFaqItem[];
  recommended_uses?: string[];
  shop_sales_genre?: string | null;
  service_summary?: string | null;
  price_range_text?: string | null;
  terms_accepted?: boolean;
};

function trimProfileText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function normalizeProfileFaqItems(value: unknown): ProfileFaqItem[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BusinessDirectoryError("validation_error", "faq_items must be an array", 400);
  }
  const items = value
    .map((raw) => {
      const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const q = trimProfileText(row.q, 120);
      const a = trimProfileText(row.a, 600);
      if (!q && !a) return null;
      return { q: q || "ご質問", a: a || "詳細はお問い合わせください。" };
    })
    .filter(Boolean) as ProfileFaqItem[];
  return items.slice(0, 5);
}

export function normalizeRecommendedUses(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BusinessDirectoryError("validation_error", "recommended_uses must be an array", 400);
  }
  return value
    .map((u) => trimProfileText(u, 120))
    .filter(Boolean)
    .slice(0, 5);
}

function validateListingType(v: string): ListingType {
  if (!LISTING_TYPES.includes(v as ListingType)) {
    throw new BusinessDirectoryError("validation_error", "Invalid listing_type", 400);
  }
  return v as ListingType;
}

function validateDraftInput(body: DraftListingInput, partial = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.listing_type !== undefined) out.listing_type = validateListingType(String(body.listing_type));
  if (body.plan_code !== undefined) out.plan_code = "free";
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
  const row: Record<string, unknown> = { listing_id: listingId };

  if (body.company_name !== undefined) row.company_name = pickString(body.company_name);
  if (body.contact_name !== undefined) row.contact_name = pickString(body.contact_name);
  if (body.contact_email !== undefined) row.contact_email = pickString(body.contact_email);
  if (body.contact_phone !== undefined) row.contact_phone = pickString(body.contact_phone);
  if (body.postal_code !== undefined) row.postal_code = pickString(body.postal_code) || null;
  if (body.prefecture !== undefined) row.prefecture = pickString(body.prefecture);
  if (body.city !== undefined) row.city = pickString(body.city);
  if (body.address_line1 !== undefined) row.address_line1 = pickString(body.address_line1);
  if (body.address_line2 !== undefined) row.address_line2 = pickString(body.address_line2) || null;
  if (body.short_description !== undefined) row.short_description = pickString(body.short_description);
  if (body.shop_sales_genre !== undefined) row.shop_sales_genre = pickString(body.shop_sales_genre) || null;
  if (body.service_summary !== undefined) row.service_summary = pickString(body.service_summary) || null;
  if (body.price_range_text !== undefined) row.price_range_text = pickString(body.price_range_text) || null;
  if (body.terms_accepted !== undefined) {
    row.terms_accepted_at = body.terms_accepted ? new Date().toISOString() : null;
  }
  if (body.full_description !== undefined) {
    row.full_description = trimProfileText(body.full_description, 8000) || null;
  }
  if (body.seo_title !== undefined) {
    row.seo_title = trimProfileText(body.seo_title, 60) || null;
  }
  if (body.meta_description !== undefined) {
    row.meta_description = trimProfileText(body.meta_description, 160) || null;
  }
  if (body.faq_items !== undefined) {
    row.faq_items = normalizeProfileFaqItems(body.faq_items);
  }
  if (body.recommended_uses !== undefined) {
    row.recommended_uses = normalizeRecommendedUses(body.recommended_uses);
  }

  const patchKeys = Object.keys(row).filter((key) => key !== "listing_id");
  return patchKeys.length > 0 ? row : null;
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

function assertMediaEditable(status: ListingStatus): void {
  if (!MEDIA_EDITABLE_STATUSES.has(status)) {
    throw new BusinessDirectoryError(
      "invalid_state",
      "Photos and business hours cannot be edited in current status",
      400,
    );
  }
}

type ContentBundle = {
  listing: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  photos: Record<string, unknown>[];
  business_hours: Record<string, unknown>[];
};

async function fetchLiveContentBundle(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ContentBundle> {
  const listing = await getListingOrThrow(supabase, listingId);
  const [{ data: profile }, { data: photos }, { data: hours }] = await Promise.all([
    supabase.from("business_directory_profiles").select("*").eq("listing_id", listingId).maybeSingle(),
    supabase.from("business_directory_photos").select("*").eq("listing_id", listingId).order("sort_order"),
    supabase.from("business_directory_business_hours").select("*").eq("listing_id", listingId).order("sort_order"),
  ]);
  return {
    listing: listing as Record<string, unknown>,
    profile: (profile as Record<string, unknown>) ?? null,
    photos: (photos ?? []) as Record<string, unknown>[],
    business_hours: (hours ?? []) as Record<string, unknown>[],
  };
}

function parsePendingContent(raw: unknown): ContentBundle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    listing: (o.listing && typeof o.listing === "object" ? o.listing : {}) as Record<string, unknown>,
    profile: (o.profile && typeof o.profile === "object" ? o.profile : null) as Record<string, unknown> | null,
    photos: Array.isArray(o.photos) ? (o.photos as Record<string, unknown>[]) : [],
    business_hours: Array.isArray(o.business_hours) ? (o.business_hours as Record<string, unknown>[]) : [],
  };
}

async function loadPendingContent(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ContentBundle | null> {
  const { data, error } = await supabase
    .from("business_directory_pending_updates")
    .select("content_json")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  if (!data) return null;
  return parsePendingContent(data.content_json);
}

async function savePendingContent(
  supabase: SupabaseClient,
  listingId: string,
  content: ContentBundle,
): Promise<void> {
  const { error } = await supabase
    .from("business_directory_pending_updates")
    .upsert({
      listing_id: listingId,
      content_json: content,
      updated_at: new Date().toISOString(),
    }, { onConflict: "listing_id" });
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
}

async function ensurePendingFromLive(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ContentBundle> {
  const existing = await loadPendingContent(supabase, listingId);
  if (existing) return existing;
  const live = await fetchLiveContentBundle(supabase, listingId);
  const pending: ContentBundle = {
    listing: { ...live.listing },
    profile: live.profile ? { ...live.profile } : null,
    photos: live.photos.map((p) => ({ ...p })),
    business_hours: live.business_hours.map((h) => ({ ...h })),
  };
  await savePendingContent(supabase, listingId, pending);
  return pending;
}

async function clearPendingContent(supabase: SupabaseClient, listingId: string): Promise<void> {
  const { error } = await supabase
    .from("business_directory_pending_updates")
    .delete()
    .eq("listing_id", listingId);
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
}

function buildFullContentSnapshot(bundle: ContentBundle): Record<string, unknown> {
  return {
    listing_id: bundle.listing.id,
    listing: bundle.listing,
    profile: bundle.profile,
    photos: bundle.photos,
    business_hours: bundle.business_hours,
    captured_at: new Date().toISOString(),
  };
}

async function getOpenReviewRequest(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("business_directory_review_requests")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "open")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data as Record<string, unknown>) ?? null;
}

function isPubliclyVisibleListing(listing: Record<string, unknown>): boolean {
  const status = String(listing.status);
  if (status === "published") return true;
  if (status === "review_requested" && listing.published_at) return true;
  return false;
}

async function applyContentSnapshotToLive(
  supabase: SupabaseClient,
  listingId: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  const listingPatch = (snapshot.listing && typeof snapshot.listing === "object"
    ? snapshot.listing
    : {}) as Record<string, unknown>;
  const profilePatch = (snapshot.profile && typeof snapshot.profile === "object"
    ? snapshot.profile
    : null) as Record<string, unknown> | null;
  const photos = Array.isArray(snapshot.photos) ? (snapshot.photos as Record<string, unknown>[]) : [];
  const hours = Array.isArray(snapshot.business_hours)
    ? (snapshot.business_hours as Record<string, unknown>[])
    : [];

  const allowedListingKeys = [
    "listing_type", "category_id", "display_name", "slug",
    "service_areas", "hp_mode", "website_url",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowedListingKeys) {
    if (listingPatch[key] !== undefined) patch[key] = listingPatch[key];
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("business_directory_listings").update(patch).eq("id", listingId);
    if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  }

  if (profilePatch) {
    const { listing_id: _drop, id: _id, ...profileFields } = profilePatch;
    const { error } = await supabase
      .from("business_directory_profiles")
      .upsert({ listing_id: listingId, ...profileFields }, { onConflict: "listing_id" });
    if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  }

  const { error: delPhotosErr } = await supabase
    .from("business_directory_photos")
    .delete()
    .eq("listing_id", listingId);
  if (delPhotosErr) throw new BusinessDirectoryError("db_error", delPhotosErr.message, 500);

  if (photos.length) {
    const rows = photos.map((p, idx) => ({
      listing_id: listingId,
      kind: p.kind || (idx === 0 ? "cover" : "gallery"),
      storage_bucket: p.storage_bucket || BD_PHOTO_BUCKET,
      storage_path: p.storage_path,
      alt_text: p.alt_text ?? null,
      sort_order: Number(p.sort_order ?? idx),
      is_primary: Boolean(p.is_primary ?? idx === 0),
    }));
    const { error: insPhotosErr } = await supabase.from("business_directory_photos").insert(rows);
    if (insPhotosErr) throw new BusinessDirectoryError("db_error", insPhotosErr.message, 500);
  }

  const { error: delHoursErr } = await supabase
    .from("business_directory_business_hours")
    .delete()
    .eq("listing_id", listingId);
  if (delHoursErr) throw new BusinessDirectoryError("db_error", delHoursErr.message, 500);

  if (hours.length) {
    const rows = hours.map((h, idx) => ({
      listing_id: listingId,
      day_of_week: h.day_of_week ?? null,
      opens_at: h.opens_at ?? null,
      closes_at: h.closes_at ?? null,
      is_closed: Boolean(h.is_closed ?? false),
      note: h.note ?? null,
      sort_order: Number(h.sort_order ?? idx),
    }));
    const { error: insHoursErr } = await supabase.from("business_directory_business_hours").insert(rows);
    if (insHoursErr) throw new BusinessDirectoryError("db_error", insHoursErr.message, 500);
  }
}

async function updatePublishedPendingListing(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  body: DraftListingInput,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);
  if (String(listing.status) !== "published") {
    throw new BusinessDirectoryError("invalid_state", "Not a published listing", 400);
  }

  const pending = await ensurePendingFromLive(supabase, listingId);
  const validated = validateDraftInput(body, true);

  for (const key of [
    "listing_type", "category_id", "display_name", "slug",
    "service_areas", "hp_mode", "website_url",
  ]) {
    if (validated[key] !== undefined) pending.listing[key] = validated[key];
  }

  const profilePatch = profileFromDraft(body, listingId);
  if (profilePatch) {
    pending.profile = { ...(pending.profile || {}), ...profilePatch };
  }

  await savePendingContent(supabase, listingId, pending);

  await appendAuditLog(supabase, {
    listingId,
    actorUserId: ownerUserId,
    actorRole: "owner",
    action: "listing.pending_update",
    fromStatus: "published",
    toStatus: "published",
  });

  return listing as Record<string, unknown>;
}

function overlayOwnerDetailFromPending(
  live: ContentBundle,
  pending: ContentBundle | null,
): { listing: Record<string, unknown>; profile: Record<string, unknown> | null; photos: Record<string, unknown>[]; business_hours: Record<string, unknown>[] } {
  if (!pending) {
    return {
      listing: live.listing,
      profile: live.profile,
      photos: live.photos,
      business_hours: live.business_hours,
    };
  }
  return {
    listing: { ...live.listing, ...pending.listing, id: live.listing.id, status: live.listing.status },
    profile: pending.profile ? { ...live.profile, ...pending.profile } : live.profile,
    photos: pending.photos.length ? pending.photos : live.photos,
    business_hours: pending.business_hours.length ? pending.business_hours : live.business_hours,
  };
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64Image(contentBase64: string): Uint8Array {
  const raw = contentBase64.includes(",") ? contentBase64.split(",").pop()! : contentBase64;
  const cleaned = raw.replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new BusinessDirectoryError("validation_error", "content_base64 is invalid", 422);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (!bytes.length) {
    throw new BusinessDirectoryError("validation_error", "content_base64 is empty", 422);
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new BusinessDirectoryError("validation_error", "Image exceeds 5MB limit", 422);
  }
  return bytes;
}

function photoPublicUrl(supabase: SupabaseClient, bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

function enrichPhotoRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const bucket = String(row.storage_bucket || BD_PHOTO_BUCKET);
  const path = String(row.storage_path || "");
  const publicUrl = path ? photoPublicUrl(supabase, bucket, path) : "";
  return { ...row, public_url: publicUrl, url: publicUrl };
}

function enrichPhotos(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return (rows ?? []).map((row) => enrichPhotoRow(supabase, row));
}

async function getMaxPhotosForListing(
  supabase: SupabaseClient,
  listing: Record<string, unknown>,
): Promise<number> {
  const planCode = resolveEffectivePlanCode(listing);
  const { data, error } = await supabase
    .from("business_directory_plan_features")
    .select("max_photos")
    .eq("plan_code", planCode)
    .maybeSingle();
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  const max = Number(data?.max_photos);
  return Number.isFinite(max) && max > 0 ? max : 1;
}

export async function uploadListingPhoto(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  input: { content_base64: string; content_type: string; alt_text?: string | null },
): Promise<Record<string, unknown>> {
  let listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const status = String(listing.status) as ListingStatus;
  if (status === "rejected") {
    listing = await transitionListingStatus(supabase, listing, "draft", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.reopen_after_reject",
    });
  } else if (status === "published") {
    const pending = await ensurePendingFromLive(supabase, listingId);
    const contentType = pickString(input.content_type);
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new BusinessDirectoryError("validation_error", "Unsupported image type", 422);
    }
    const bytes = decodeBase64Image(pickString(input.content_base64));
    const maxPhotos = await getMaxPhotosForListing(supabase, listing);
    const currentCount = pending.photos.length;
    if (currentCount >= maxPhotos) {
      throw new BusinessDirectoryError("plan_limit", "Photo limit reached for current plan", 403);
    }
    const ext = extensionForContentType(contentType);
    const objectPath = `${listingId}/pending/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(BD_PHOTO_BUCKET)
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (uploadErr) {
      throw new BusinessDirectoryError("storage_error", uploadErr.message, 500);
    }
    const sortOrder = currentCount;
    const isPrimary = currentCount === 0;
    const photo = {
      id: `pending-${crypto.randomUUID()}`,
      kind: isPrimary ? "cover" : "gallery",
      storage_bucket: BD_PHOTO_BUCKET,
      storage_path: objectPath,
      alt_text: pickString(input.alt_text) || null,
      sort_order: sortOrder,
      is_primary: isPrimary,
    };
    pending.photos = [...pending.photos, photo];
    await savePendingContent(supabase, listingId, pending);
    return enrichPhotoRow(supabase, photo as Record<string, unknown>);
  } else {
    assertMediaEditable(status);
  }

  const contentType = pickString(input.content_type);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new BusinessDirectoryError("validation_error", "Unsupported image type", 422);
  }
  const bytes = decodeBase64Image(pickString(input.content_base64));

  const { count, error: countErr } = await supabase
    .from("business_directory_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (countErr) throw new BusinessDirectoryError("db_error", countErr.message, 500);

  const maxPhotos = await getMaxPhotosForListing(supabase, listing);
  const currentCount = count ?? 0;
  if (currentCount >= maxPhotos) {
    throw new BusinessDirectoryError("plan_limit", "Photo limit reached for current plan", 403);
  }

  const ext = extensionForContentType(contentType);
  const objectPath = `${listingId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BD_PHOTO_BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });
  if (uploadErr) {
    throw new BusinessDirectoryError("storage_error", uploadErr.message, 500);
  }

  const sortOrder = currentCount;
  const isPrimary = currentCount === 0;
  const { data: photo, error: insertErr } = await supabase
    .from("business_directory_photos")
    .insert({
      listing_id: listingId,
      kind: isPrimary ? "cover" : "gallery",
      storage_bucket: BD_PHOTO_BUCKET,
      storage_path: objectPath,
      alt_text: pickString(input.alt_text) || null,
      sort_order: sortOrder,
      is_primary: isPrimary,
    })
    .select("*")
    .single();
  if (insertErr || !photo) {
    throw new BusinessDirectoryError("db_error", insertErr?.message || "photo insert failed", 500);
  }

  return enrichPhotoRow(supabase, photo as Record<string, unknown>);
}

export async function deleteListingPhoto(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  photoId: string,
): Promise<{ deleted: true }> {
  let listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const status = String(listing.status) as ListingStatus;
  if (status === "rejected") {
    listing = await transitionListingStatus(supabase, listing, "draft", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.reopen_after_reject",
    });
  } else if (status === "published") {
    const pending = await ensurePendingFromLive(supabase, listingId);
    const idx = pending.photos.findIndex(
      (p) => String(p.id) === photoId || String(p.storage_path) === photoId,
    );
    if (idx < 0) throw new BusinessDirectoryError("not_found", "Photo not found", 404);
    const removed = pending.photos[idx];
    const objectPath = String(removed.storage_path || "");
    if (objectPath.startsWith(`${listingId}/pending/`)) {
      await supabase.storage.from(BD_PHOTO_BUCKET).remove([objectPath]);
    }
    pending.photos = pending.photos.filter((_, i) => i !== idx);
    if (pending.photos.length) {
      pending.photos = pending.photos.map((p, i) => ({
        ...p,
        sort_order: i,
        is_primary: i === 0,
        kind: i === 0 ? "cover" : "gallery",
      }));
    }
    await savePendingContent(supabase, listingId, pending);
    return { deleted: true };
  } else {
    assertMediaEditable(status);
  }

  const { data: photo, error: fetchErr } = await supabase
    .from("business_directory_photos")
    .select("*")
    .eq("id", photoId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (fetchErr) throw new BusinessDirectoryError("db_error", fetchErr.message, 500);
  if (!photo) throw new BusinessDirectoryError("not_found", "Photo not found", 404);

  const bucket = String(photo.storage_bucket || BD_PHOTO_BUCKET);
  const objectPath = String(photo.storage_path || "");
  if (objectPath) {
    await supabase.storage.from(bucket).remove([objectPath]);
  }

  const { error: delErr } = await supabase
    .from("business_directory_photos")
    .delete()
    .eq("id", photoId)
    .eq("listing_id", listingId);
  if (delErr) throw new BusinessDirectoryError("db_error", delErr.message, 500);

  const { data: remaining } = await supabase
    .from("business_directory_photos")
    .select("id")
    .eq("listing_id", listingId)
    .order("sort_order");
  if (remaining?.length) {
    await supabase
      .from("business_directory_photos")
      .update({ is_primary: false, kind: "gallery" })
      .eq("listing_id", listingId);
    await supabase
      .from("business_directory_photos")
      .update({ is_primary: true, kind: "cover", sort_order: 0 })
      .eq("id", remaining[0].id);
  }

  return { deleted: true };
}

export async function saveBusinessHoursText(
  supabase: SupabaseClient,
  ownerUserId: string,
  listingId: string,
  hoursText: string,
): Promise<Record<string, unknown>[]> {
  let listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  const status = String(listing.status) as ListingStatus;
  if (status === "rejected") {
    listing = await transitionListingStatus(supabase, listing, "draft", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.reopen_after_reject",
    });
  } else if (status === "published") {
    const pending = await ensurePendingFromLive(supabase, listingId);
    const text = String(hoursText ?? "").trim();
    pending.business_hours = text
      ? [{
        day_of_week: null,
        opens_at: null,
        closes_at: null,
        is_closed: false,
        note: text,
        sort_order: 0,
      }]
      : [];
    await savePendingContent(supabase, listingId, pending);
    return pending.business_hours;
  } else {
    assertMediaEditable(status);
  }

  const text = String(hoursText ?? "").trim();
  const { error: delErr } = await supabase
    .from("business_directory_business_hours")
    .delete()
    .eq("listing_id", listingId);
  if (delErr) throw new BusinessDirectoryError("db_error", delErr.message, 500);

  if (!text) return [];

  const { data: row, error: insErr } = await supabase
    .from("business_directory_business_hours")
    .insert({
      listing_id: listingId,
      day_of_week: null,
      opens_at: null,
      closes_at: null,
      is_closed: false,
      note: text,
      sort_order: 0,
    })
    .select("*")
    .single();
  if (insErr || !row) {
    throw new BusinessDirectoryError("db_error", insErr?.message || "hours insert failed", 500);
  }

  return [row as Record<string, unknown>];
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
  if (status === "published") {
    return updatePublishedPendingListing(supabase, ownerUserId, listingId, body);
  }
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
    "listing_type", "category_id", "display_name", "slug",
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
    const { listing_id: _listingId, ...patch } = profilePatch;
    const { error: profileErr } = await supabase
      .from("business_directory_profiles")
      .update(patch)
      .eq("listing_id", listingId);
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
    .select(
      "id, listing_type, status, plan_code, display_name, slug, updated_at, published_at, subscription_status, current_period_end, cancel_at_period_end, stripe_customer_id",
    )
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

  const { data: hours } = await supabase
    .from("business_directory_business_hours")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");

  const { data: lastReject } = await supabase
    .from("business_directory_review_requests")
    .select("reject_reason_code, reject_reason_note, reviewed_at, request_type")
    .eq("listing_id", listingId)
    .eq("status", "rejected")
    .eq("request_type", "initial_publish")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pendingRow = await loadPendingContent(supabase, listingId);
  const openReview = await getOpenReviewRequest(supabase, listingId);
  const liveBundle = {
    listing,
    profile: (profile as Record<string, unknown>) ?? null,
    photos: (photos ?? []) as Record<string, unknown>[],
    business_hours: (hours ?? []) as Record<string, unknown>[],
  };

  let overlaySource = pendingRow;
  if (String(listing.status) === "review_requested" && openReview?.request_type === "content_update") {
    overlaySource = parsePendingContent(openReview.snapshot_json);
  }

  const merged = overlayOwnerDetailFromPending(liveBundle, overlaySource);
  const listingForOwner = {
    ...listing,
    ...merged.listing,
    id: listing.id,
    status: listing.status,
    published_at: listing.published_at,
    owner_user_id: listing.owner_user_id,
  };

  return {
    listing: listingForOwner,
    profile: merged.profile,
    photos: enrichPhotos(supabase, merged.photos),
    business_hours: merged.business_hours,
    reject_reason: lastReject ?? null,
    has_pending_update: Boolean(pendingRow),
    content_update_review: openReview?.request_type === "content_update"
      ? { status: openReview.status, request_type: openReview.request_type }
      : null,
  };
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
  let listing = await getListingOrThrow(supabase, listingId);
  await assertOwner(listing, ownerUserId);

  let from = String(listing.status) as ListingStatus;
  if (from === "rejected") {
    listing = await transitionListingStatus(supabase, listing, "draft", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.reopen_after_reject",
    });
    from = "draft";
  }

  if (requestType === "content_update") {
    if (from !== "published") {
      throw new BusinessDirectoryError(
        "invalid_state",
        "content_update requires published listing",
        400,
      );
    }
    const pending = await loadPendingContent(supabase, listingId);
    if (!pending) {
      throw new BusinessDirectoryError(
        "validation_error",
        "No pending changes to submit for content update",
        400,
      );
    }
    const liveBundle = await fetchLiveContentBundle(supabase, listingId);
    const publishedSnapshot = buildFullContentSnapshot(liveBundle);
    const pendingSnapshot = buildFullContentSnapshot(pending);

    const updated = await transitionListingStatus(supabase, listing, "review_requested", {
      actorUserId: ownerUserId,
      actorRole: "owner",
      action: "listing.submit_content_update",
      metadata: { request_type: "content_update" },
    });

    const { data: reviewReq, error: reviewErr } = await supabase
      .from("business_directory_review_requests")
      .insert({
        listing_id: listingId,
        request_type: "content_update",
        status: "open",
        submitted_by: ownerUserId,
        snapshot_json: pendingSnapshot,
        published_snapshot_json: publishedSnapshot,
      })
      .select("*")
      .single();

    if (reviewErr || !reviewReq) {
      throw new BusinessDirectoryError("db_error", reviewErr?.message || "review insert failed", 500);
    }

    return { listing: updated, review_request: reviewReq };
  }

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
    .eq("slug", slug);

  if (listingType) q = q.eq("listing_type", listingType);

  const { data: rows, error } = await q;
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  const listing = (rows ?? []).find((row) => isPubliclyVisibleListing(row as Record<string, unknown>));
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
    photos: enrichPhotos(supabase, (photos ?? []) as Record<string, unknown>[]),
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
  options: { note?: string } = {},
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  if (String(listing.status) !== "review_requested") {
    throw new BusinessDirectoryError("invalid_state", "Listing is not awaiting review", 400);
  }

  const openReview = await getOpenReviewRequest(supabase, listingId);
  const isContentUpdate = openReview?.request_type === "content_update";

  const review = await closeOpenReviewRequest(supabase, listingId, opsUserId, "approved");
  const note = pickString(options.note);

  if (isContentUpdate) {
    const snapshot = (review.snapshot_json && typeof review.snapshot_json === "object"
      ? review.snapshot_json
      : {}) as Record<string, unknown>;
    await applyContentSnapshotToLive(supabase, listingId, snapshot);
    await clearPendingContent(supabase, listingId);
  }

  const updated = await transitionListingStatus(supabase, listing, "published", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: isContentUpdate ? "listing.approve_content_update" : "listing.approve",
    metadata: note ? { approve_note: note } : {},
  });

  return { listing: updated, review_request: review };
}

export async function rejectListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
  rejectReason: { code?: string; note?: string } = {},
): Promise<Record<string, unknown>> {
  if (!pickString(rejectReason.note)) {
    throw new BusinessDirectoryError("validation_error", "reject_reason_note required", 400);
  }
  const listing = await getListingOrThrow(supabase, listingId);
  if (String(listing.status) !== "review_requested") {
    throw new BusinessDirectoryError("invalid_state", "Listing is not awaiting review", 400);
  }

  const openReview = await getOpenReviewRequest(supabase, listingId);
  const isContentUpdate = openReview?.request_type === "content_update";

  const review = await closeOpenReviewRequest(supabase, listingId, opsUserId, "rejected", rejectReason);

  if (isContentUpdate) {
    await clearPendingContent(supabase, listingId);
    const updated = await transitionListingStatus(supabase, listing, "published", {
      actorUserId: opsUserId,
      actorRole: "ops",
      action: "listing.reject_content_update",
      metadata: {
        reject_reason_code: rejectReason.code ?? null,
        keep_published: true,
      },
    });
    return { listing: updated, review_request: review };
  }

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
  if (!pickString(reason)) {
    throw new BusinessDirectoryError("validation_error", "reason required", 400);
  }
  const listing = await getListingOrThrow(supabase, listingId);
  const updated = await transitionListingStatus(supabase, listing, "suspended", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.suspend",
    metadata: { reason: pickString(reason) },
  });
  return updated;
}

export async function unpublishListing(
  supabase: SupabaseClient,
  actorUserId: string,
  actorRole: "owner" | "ops",
  listingId: string,
  reason?: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  if (actorRole === "owner") {
    await assertOwner(listing, actorUserId);
  }
  const note = pickString(reason);
  const updated = await transitionListingStatus(supabase, listing, "unpublished", {
    actorUserId,
    actorRole,
    action: "listing.unpublish",
    metadata: note ? { reason: note } : {},
  });
  return updated;
}

export async function restoreListing(
  supabase: SupabaseClient,
  opsUserId: string,
  listingId: string,
  reason?: string,
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
  const note = pickString(reason);
  const updated = await transitionListingStatus(supabase, listing, "published", {
    actorUserId: opsUserId,
    actorRole: "ops",
    action: "listing.restore",
    metadata: note ? { restore_note: note } : {},
  });
  return updated;
}

export async function getOpsListingDetail(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Record<string, unknown>> {
  const listing = await getListingOrThrow(supabase, listingId);
  const id = String(listing.id);

  const [
    { data: profile },
    { data: photos },
    { data: hours },
    { data: sns },
    { data: tlv },
    { data: reviewRequests },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from("business_directory_profiles").select("*").eq("listing_id", id).maybeSingle(),
    supabase.from("business_directory_photos").select("*").eq("listing_id", id).order("sort_order"),
    supabase.from("business_directory_business_hours").select("*").eq("listing_id", id).order("sort_order"),
    supabase.from("business_directory_social_links").select("*").eq("listing_id", id).order("sort_order"),
    supabase.from("business_directory_tlv_videos").select("*").eq("listing_id", id).order("sort_order"),
    supabase
      .from("business_directory_review_requests")
      .select("*")
      .eq("listing_id", id)
      .order("submitted_at", { ascending: false })
      .limit(20),
    supabase
      .from("business_directory_audit_logs")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    listing,
    profile: profile ?? null,
    photos: enrichPhotos(supabase, (photos ?? []) as Record<string, unknown>[]),
    business_hours: hours ?? [],
    social_links: sns ?? [],
    tlv_videos: tlv ?? [],
    review_requests: reviewRequests ?? [],
    audit_logs: auditLogs ?? [],
  };
}

export async function getListingAuditLogs(
  supabase: SupabaseClient,
  listingId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { data, error } = await supabase
    .from("business_directory_audit_logs")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(capped);
  if (error) throw new BusinessDirectoryError("db_error", error.message, 500);
  return (data ?? []) as Record<string, unknown>[];
}
