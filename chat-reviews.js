/**
 * 取引完了後レビュー・信頼スコア・自動完了判定
 * ジモティー型: 完了・レビューは軽量、review_scores で信頼を蓄積
 */
(function () {
  "use strict";

  const AUTO_COMPLETE_DAYS = 7;
  const AUTO_COMPLETE_MS = AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000;

  const REVIEW_TITLE = "取引相手を評価";
  const REVIEW_SUB =
    "出品者への評価は任意です。スキップしても取引は完了したままです。";
  const REVIEW_SKIP_LABEL = "スキップして完了";
  const REVIEW_SUBMIT_LABEL = "評価を送る";

  // 将来: seller → buyer レビュー（任意・双方向）
  // function submitSellerToBuyerReview({ roomId, sellerId, buyerId, rating, comment }) { ... }

  function getBuyerId(room) {
    if (!room) return "";
    return String(room.buyerId ?? room.buyer_id ?? "").trim();
  }

  function getSellerId(room) {
    if (!room) return "";
    return String(room.sellerId ?? room.seller_id ?? "").trim();
  }

  /** buyer_id のみ「取引完了」ボタンを表示 */
  function isBuyerForRoom(room, userId) {
    const buyerId = getBuyerId(room);
    const meId = String(userId ?? "").trim();
    if (!buyerId || !meId) return false;
    return buyerId === meId;
  }

  /** buyer が seller を評価する想定 */
  function getReviewedUserIdForBuyer(room) {
    const sellerId = getSellerId(room);
    if (sellerId) return sellerId;
    const buyerId = getBuyerId(room);
    const partnerId = room?.partner?.id ?? "";
    if (partnerId && partnerId !== buyerId) return String(partnerId);
    return "";
  }

  function getDbRoomStatus(room) {
    if (window.TasuChatRoomStatus?.getRoomStatus) {
      return window.TasuChatRoomStatus.getRoomStatus(room);
    }
    const raw = room?.roomStatus ?? room?.status ?? "active";
    const s = String(raw).toLowerCase();
    if (s === "completed" || s === "cancelled" || s === "active") return s;
    return "active";
  }

  function getExpiresAtMs(room) {
    const raw = room?.expiresAt ?? room?.expires_at ?? "";
    if (!raw) return NaN;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  /**
   * 自動完了可否（Edge Function / cron 用・今回は判定のみ）
   * @param {object} room
   * @param {number} reportsCount
   * @returns {boolean}
   */
  function canAutoCompleteRoom(room, reportsCount) {
    if (!room) return false;
    if (getDbRoomStatus(room) !== "active") return false;

    const count = Number(reportsCount);
    if (Number.isFinite(count) && count > 0) return false;

    const expiresMs = getExpiresAtMs(room);
    if (!Number.isFinite(expiresMs)) return false;

    return Date.now() - expiresMs >= AUTO_COMPLETE_MS;
  }

  /**
   * review_scores 更新用（クライアント・サーバー共通ロジック）
   * @param {{ average_rating?: number, total_reviews?: number, skipped_reviews?: number }|null} existing
   * @param {{ rating?: number|null, isSkipped: boolean }} input
   */
  function computeReviewScoreUpdate(existing, input) {
    const prevTotal = existing?.total_reviews ?? 0;
    const prevSkipped = existing?.skipped_reviews ?? 0;
    const prevAvg = Number(existing?.average_rating ?? 0);
    const ratedCount = Math.max(0, prevTotal - prevSkipped);

    const isSkipped = Boolean(input.isSkipped);
    const rating = input.rating;

    const newTotal = prevTotal + 1;
    const newSkipped = prevSkipped + (isSkipped ? 1 : 0);
    let newAvg = prevAvg;

    if (!isSkipped && rating >= 1 && rating <= 5) {
      newAvg =
        ratedCount === 0 ? rating : (prevAvg * ratedCount + rating) / (ratedCount + 1);
    }

    return {
      average_rating: Math.round(newAvg * 100) / 100,
      total_reviews: newTotal,
      skipped_reviews: newSkipped,
    };
  }

  function validateRating(rating) {
    const n = Number(rating);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
  }

  window.TasuChatReviews = {
    AUTO_COMPLETE_DAYS,
    REVIEW_TITLE,
    REVIEW_SUB,
    REVIEW_SKIP_LABEL,
    REVIEW_SUBMIT_LABEL,
    getBuyerId,
    getSellerId,
    isBuyerForRoom,
    getReviewedUserIdForBuyer,
    canAutoCompleteRoom,
    computeReviewScoreUpdate,
    validateRating,
  };
})();
