/**
 * Platform OPS-FLOW-2 — action_url / target 共通仕様
 * Content Gate · AI秘書 inbox · 審査画面の深いリンク
 */
(function (global) {
  "use strict";

  const REVIEW_PAGE = "admin-operations-dashboard.html";
  const REVIEW_HASH = "#ops-content-gate";

  function normalizeTable(targetType, surface) {
    const t = String(targetType || surface || "listings").trim().toLowerCase();
    if (t === "listing" || t === "listing_attachment") return "listings";
    if (t === "business_listing") return "business_listings";
    if (t === "shop" || t === "shop_local") return "shop_local";
    if (t === "review") return "listings";
    return t === "listings" || t === "business_listings" ? t : "listings";
  }

  /**
   * @param {{
   *   target_type?: string,
   *   target_id?: string,
   *   surface?: string,
   *   listing_id?: string,
   *   moderation_status?: string,
   *   event_type?: string,
   *   mode?: string
   * }} input
   */
  function buildContentReviewUrl(input) {
    const params = new URLSearchParams();
    const targetType = normalizeTable(input?.target_type, input?.surface);
    const targetId = String(
      input?.target_id || input?.listing_id || input?.id || ""
    ).trim();

    if (targetType) params.set("target_type", targetType);
    if (targetId) params.set("target_id", targetId);
    if (input?.type) params.set("type", String(input.type));
    if (input?.id && !targetId) params.set("id", String(input.id));
    if (input?.moderation_status) params.set("moderation_status", String(input.moderation_status));
    if (input?.event_type) params.set("event_type", String(input.event_type));
    if (input?.event_id) params.set("event_id", String(input.event_id));
    if (input?.mode) params.set("mode", String(input.mode));
    if (input?.severity) params.set("severity", String(input.severity));

    const q = params.toString();
    return `${REVIEW_PAGE}${q ? `?${q}` : ""}${REVIEW_HASH}`;
  }

  function buildSupportTicketUrl(ticketId) {
    return `support-trouble-center.html?ticket=${encodeURIComponent(String(ticketId || ""))}`;
  }

  function buildAiOpsCaseUrl(caseId) {
    return `admin-ai-operations-center.html?case=${encodeURIComponent(String(caseId || ""))}`;
  }

  function buildReportListUrl() {
    return "support-trouble-center.html?filter=report";
  }

  function parseReviewParams(search) {
    const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    return {
      target_type: params.get("target_type") || params.get("type") || "",
      target_id: params.get("target_id") || params.get("id") || "",
      moderation_status: params.get("moderation_status") || "",
      event_type: params.get("event_type") || "",
      event_id: params.get("event_id") || "",
      mode: params.get("mode") || "",
      severity: params.get("severity") || "",
    };
  }

  function resolveSeverity(signal) {
    const explicit = String(signal?.severity || "").trim();
    if (explicit) return explicit;
    const type = String(signal?.type || "");
    if (/blocked|contact_leak/.test(type)) return "critical";
    if (/auto_cleared|approved_auto/.test(type)) return "info";
    if (/needs_review|flagged|unscanned/.test(type)) return "warning";
    return "medium";
  }

  function enrichSignal(signal) {
    const meta = signal?.meta && typeof signal.meta === "object" ? signal.meta : {};
    const targetType = normalizeTable(
      meta.target_type || signal.target_type,
      meta.surface || signal.surface
    );
    const targetId = String(
      meta.target_id || meta.listing_id || signal.target_id || ""
    ).trim();
    const moderationStatus =
      meta.moderation_status ||
      signal.moderation_status ||
      (signal.type && /blocked|contact_leak/.test(signal.type) ? "blocked" : "pending_review");
    const severity = resolveSeverity(signal);

    const action_url = buildContentReviewUrl({
      target_type: targetType,
      target_id: targetId,
      moderation_status: moderationStatus,
      event_type: signal.type,
      mode: /blocked|contact_leak/.test(String(signal.type || "")) ? "critical" : "",
      event_id: signal.event_id || signal.id,
      severity,
    });

    return {
      ...signal,
      target_type: targetType,
      target_id: targetId || null,
      moderation_status: moderationStatus,
      severity,
      action_url,
      event_id: signal.event_id || signal.id || `cg-${Date.now().toString(36)}`,
    };
  }

  global.TasuPlatformOpsActionUrl = {
    REVIEW_PAGE,
    REVIEW_HASH,
    normalizeTable,
    buildContentReviewUrl,
    buildSupportTicketUrl,
    buildAiOpsCaseUrl,
    buildReportListUrl,
    parseReviewParams,
    enrichSignal,
  };
})(typeof window !== "undefined" ? window : globalThis);
