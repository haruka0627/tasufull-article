/**
 * 業務サービス — 売上管理（fee_paid の service_deals 集計）
 */
(function () {
  "use strict";

  const STATUS_FEE_PAID = "fee_paid";

  const PAYOUT_STATUS = Object.freeze({
    PENDING: "pending",
    SCHEDULED: "scheduled",
    TRANSFERRED: "transferred",
    COMPLETED: "completed",
  });

  function resolvePayoutStatus(deal) {
    const raw = String(deal?.payout_status || deal?.connect_payout_status || "")
      .trim()
      .toLowerCase();
    const allowed = Object.values(PAYOUT_STATUS);
    if (allowed.includes(raw)) return raw;
    return PAYOUT_STATUS.COMPLETED;
  }

  function getCurrentUserId() {
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function resolveServiceTitle(serviceId) {
    const sid = String(serviceId || "").trim();
    if (!sid) return "業務サービス";

    const boards = window.TasuBusinessBoardDemo?.FIELD_SERVICE_LISTINGS;
    if (Array.isArray(boards)) {
      const hit = boards.find(
        (row) =>
          String(row?.id || row?.listing_id || "").trim() === sid ||
          String(row?.service_id || "").trim() === sid
      );
      if (hit) {
        return String(
          hit.title || hit.company_name || hit.name || hit.service_name || ""
        ).trim();
      }
    }

    const noteFromDeal = window.TasuServiceDealsDb?.loadLocal?.()?.find(
      (d) => String(d.service_id) === sid && d.estimate_note
    );
    if (noteFromDeal?.estimate_note) {
      const note = String(noteFromDeal.estimate_note).trim();
      if (note.length <= 40) return note;
      return `${note.slice(0, 40)}…`;
    }

    return `業務サービス（${sid}）`;
  }

  function mapDealToSale(deal, review) {
    if (!deal || String(deal.status) !== STATUS_FEE_PAID) return null;

    const resolved = window.TasuServiceDealsDb?.resolveDealFees?.(deal) || deal;
    const estimateAmount = Math.max(0, Math.round(Number(resolved.agreed_amount) || 0));
    const platformFeeAmount = Math.max(
      0,
      Math.round(Number(resolved.platform_fee_amount) || 0)
    );
    const platformFeeRate =
      Number.isFinite(Number(resolved.platform_fee_rate)) && resolved.platform_fee_rate >= 0
        ? Number(resolved.platform_fee_rate)
        : window.TasuServiceDealsDb?.DEFAULT_FEE_RATE ?? 0.05;
    const providerNetAmount = Math.max(0, estimateAmount - platformFeeAmount);

    return {
      deal_id: String(deal.id),
      service_id: String(deal.service_id || ""),
      service_title: resolveServiceTitle(deal.service_id),
      provider_id: String(deal.provider_user_id || ""),
      client_id: String(deal.client_user_id || ""),
      estimate_amount: estimateAmount,
      platform_fee_amount: platformFeeAmount,
      platform_fee_rate: platformFeeRate,
      provider_net_amount: providerNetAmount,
      platform_fee_paid_at: deal.platform_fee_paid_at || deal.fee_paid_at || null,
      platform_fee_transaction_id: deal.platform_fee_transaction_id
        ? String(deal.platform_fee_transaction_id)
        : null,
      review_rating: review?.rating != null ? Number(review.rating) : null,
      review_comment: review?.comment != null ? String(review.comment).trim() : "",
      deal_completed_at: deal.deal_completed_at || null,
      created_at: deal.created_at || null,
      updated_at: deal.updated_at || null,
      status: STATUS_FEE_PAID,
      payout_status: resolvePayoutStatus(deal),
    };
  }

  function loadFeePaidDeals() {
    const list = window.TasuServiceDealsDb?.loadLocal?.() || [];
    return list.filter((d) => String(d.status) === STATUS_FEE_PAID);
  }

  function getReviewForDeal(dealId) {
    return window.TasuBusinessServiceReviewsDb?.getReviewByDealId?.(dealId) || null;
  }

  function listCompletedDealSales() {
    return loadFeePaidDeals()
      .map((deal) => mapDealToSale(deal, getReviewForDeal(deal.id)))
      .filter(Boolean)
      .sort((a, b) =>
        String(b.platform_fee_paid_at || b.updated_at || "").localeCompare(
          String(a.platform_fee_paid_at || a.updated_at || "")
        )
      );
  }

  function getSalesByProviderId(providerId) {
    const pid = String(providerId || getCurrentUserId()).trim();
    if (!pid) return [];
    return listCompletedDealSales().filter((row) => row.provider_id === pid);
  }

  function getSaleByDealId(dealId) {
    const did = String(dealId || "").trim();
    if (!did) return null;
    const deal =
      window.TasuServiceDealsDb?.fetchLocalDealById?.(did) ||
      loadFeePaidDeals().find((d) => String(d.id) === did);
    if (!deal) return null;
    return mapDealToSale(deal, getReviewForDeal(did));
  }

  function getSalesSummaryByProviderId(providerId) {
    const rows = getSalesByProviderId(providerId);
    const totalDeals = rows.length;
    const totalEstimate = rows.reduce((sum, r) => sum + r.estimate_amount, 0);
    const totalFee = rows.reduce((sum, r) => sum + r.platform_fee_amount, 0);
    const totalNet = rows.reduce((sum, r) => sum + r.provider_net_amount, 0);
    const rated = rows.filter((r) => r.review_rating != null && r.review_rating >= 1);
    const averageRating =
      rated.length > 0
        ? Math.round((rated.reduce((s, r) => s + r.review_rating, 0) / rated.length) * 10) / 10
        : 0;

    return {
      totalDeals,
      totalEstimate,
      totalFee,
      totalNet,
      averageRating,
      ratedCount: rated.length,
    };
  }

  window.TasuBusinessServiceSalesDb = {
    STATUS_FEE_PAID,
    PAYOUT_STATUS,
    resolvePayoutStatus,
    resolveServiceTitle,
    mapDealToSale,
    listCompletedDealSales,
    getSalesByProviderId,
    getSaleByDealId,
    getSalesSummaryByProviderId,
  };
})();
