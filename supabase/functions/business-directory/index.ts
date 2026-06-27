/**
 * Business Directory Phase 2 — Edge API router
 * POST { "action": "..." } — data layer only (no UI)
 */
import {
  approveListing,
  createBusinessDirectoryServiceClient,
  createDraftListing,
  getOwnerListingDetail,
  getOwnerListings,
  getPublicListingDetail,
  getPublicListings,
  getReviewQueue,
  handleBusinessDirectoryError,
  handleOptions,
  okResponse,
  parseJsonBody,
  rejectListing,
  requireAuth,
  requireMethod,
  requireOps,
  restoreListing,
  submitListingForReview,
  suspendListing,
  unpublishListing,
  updateDraftListing,
  type DraftListingInput,
} from "../_shared/business-directory.ts";

type ActionBody = DraftListingInput & {
  action?: string;
  listing_id?: string;
  slug?: string;
  listing_type?: string;
  request_type?: string;
  limit?: number;
  offset?: number;
  reject_reason_code?: string;
  reject_reason_note?: string;
  reason?: string;
};

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requireMethod(req, "POST");
    const body = await parseJsonBody<ActionBody>(req);
    const action = String(body.action ?? "health").trim();
    const supabase = createBusinessDirectoryServiceClient();

    if (action === "health") {
      return okResponse({ service: "business-directory", phase: "2" }, req);
    }

    if (action === "get_public_listings") {
      const listings = await getPublicListings(supabase, {
        listing_type: body.listing_type,
        limit: body.limit,
        offset: body.offset,
      });
      return okResponse({ listings }, req);
    }

    if (action === "get_public_listing_detail") {
      const slug = String(body.slug ?? "").trim();
      if (!slug) {
        return okResponse({ code: "validation_error", message: "slug required" }, req, 400);
      }
      const detail = await getPublicListingDetail(supabase, slug, body.listing_type);
      return okResponse({ detail }, req);
    }

    const auth = await requireAuth(req);

    if (action === "create_draft_listing") {
      const listing = await createDraftListing(supabase, auth.userId, body);
      return okResponse({ listing }, req, 201);
    }

    if (action === "update_draft_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const listing = await updateDraftListing(supabase, auth.userId, listingId, body);
      return okResponse({ listing }, req);
    }

    if (action === "get_owner_listings") {
      const listings = await getOwnerListings(supabase, auth.userId);
      return okResponse({ listings }, req);
    }

    if (action === "get_owner_listing_detail") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const detail = await getOwnerListingDetail(supabase, auth.userId, listingId);
      return okResponse({ detail }, req);
    }

    if (action === "submit_listing_for_review") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const requestType = body.request_type === "content_update" ? "content_update" : "initial_publish";
      const result = await submitListingForReview(supabase, auth.userId, listingId, requestType);
      return okResponse(result as Record<string, unknown>, req);
    }

    if (action === "unpublish_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const actorRole = auth.isOps ? "ops" : "owner";
      const listing = await unpublishListing(supabase, auth.userId, actorRole, listingId);
      return okResponse({ listing }, req);
    }

    // Ops-only
    await requireOps(req);

    if (action === "get_review_queue") {
      const queue = await getReviewQueue(supabase, { limit: body.limit });
      return okResponse({ queue }, req);
    }

    if (action === "approve_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const result = await approveListing(supabase, auth.userId, listingId);
      return okResponse(result as Record<string, unknown>, req);
    }

    if (action === "reject_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const result = await rejectListing(supabase, auth.userId, listingId, {
        code: body.reject_reason_code,
        note: body.reject_reason_note,
      });
      return okResponse(result as Record<string, unknown>, req);
    }

    if (action === "suspend_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const listing = await suspendListing(supabase, auth.userId, listingId, body.reason);
      return okResponse({ listing }, req);
    }

    if (action === "restore_listing") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const listing = await restoreListing(supabase, auth.userId, listingId);
      return okResponse({ listing }, req);
    }

    return okResponse({ code: "unknown_action", message: `Unknown action: ${action}` }, req, 400);
  } catch (err) {
    return handleBusinessDirectoryError(err, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
