/**
 * Business Directory Phase 2 — Edge API router
 * POST { "action": "..." } — data layer only (no UI)
 */
import {
  approveListing,
  createBusinessDirectoryServiceClient,
  createDraftListing,
  getBearerToken,
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
  getOpsListingDetail,
  getListingAuditLogs,
  submitListingForReview,
  suspendListing,
  unpublishListing,
  updateDraftListing,
  type DraftListingInput,
} from "../_shared/business-directory.ts";
import {
  createBusinessDirectoryBillingPortalSession,
  createBusinessDirectorySubscriptionCheckout,
  ensureBusinessDirectoryStripeCatalog,
  syncBusinessDirectorySubscriptionStatus,
} from "../_shared/business-directory-stripe.ts";

function isServiceRoleRequest(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (serviceKey && token === serviceKey) return true;
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return false;
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

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
  approve_note?: string;
  reason?: string;
  target_plan?: string;
  origin?: string;
  success_path?: string;
  cancel_path?: string;
  return_path?: string;
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
      return okResponse({ service: "business-directory", phase: "6" }, req);
    }

    if (action === "ops_ensure_stripe_prices") {
      if (!isServiceRoleRequest(req)) {
        return okResponse({ code: "forbidden", message: "Service role required" }, req, 403);
      }
      const catalog = await ensureBusinessDirectoryStripeCatalog();
      return okResponse(catalog, req);
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
      const listing = await unpublishListing(supabase, auth.userId, actorRole, listingId, body.reason);
      return okResponse({ listing }, req);
    }

    if (action === "create_subscription_checkout") {
      const listingId = String(body.listing_id ?? "").trim();
      const targetPlan = String(body.target_plan ?? body.plan_code ?? "").trim();
      if (!listingId || !targetPlan) {
        return okResponse(
          { code: "validation_error", message: "listing_id and target_plan required" },
          req,
          400,
        );
      }
      const result = await createBusinessDirectorySubscriptionCheckout(
        supabase,
        auth.userId,
        listingId,
        targetPlan,
        req,
        body,
      );
      return okResponse(result, req);
    }

    if (action === "create_billing_portal_session") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const result = await createBusinessDirectoryBillingPortalSession(
        supabase,
        auth.userId,
        listingId,
        req,
        body,
      );
      return okResponse(result, req);
    }

    if (action === "sync_subscription_status") {
      const listingId = String(body.listing_id ?? "").trim();
      if (!listingId) {
        return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
      }
      const result = await syncBusinessDirectorySubscriptionStatus(
        supabase,
        auth.userId,
        listingId,
      );
      return okResponse(result, req);
    }

    // Ops-only (also used by admin UI)
    if (auth.isOps) {
      if (action === "get_ops_listing_detail") {
        const listingId = String(body.listing_id ?? "").trim();
        if (!listingId) {
          return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
        }
        const detail = await getOpsListingDetail(supabase, listingId);
        return okResponse({ detail }, req);
      }

      if (action === "get_listing_audit_logs") {
        const listingId = String(body.listing_id ?? "").trim();
        if (!listingId) {
          return okResponse({ code: "validation_error", message: "listing_id required" }, req, 400);
        }
        const logs = await getListingAuditLogs(supabase, listingId, body.limit);
        return okResponse({ logs }, req);
      }
    }

    // Ops-only mutations
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
      const result = await approveListing(supabase, auth.userId, listingId, {
        note: body.approve_note,
      });
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
      const listing = await restoreListing(supabase, auth.userId, listingId, body.reason);
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
