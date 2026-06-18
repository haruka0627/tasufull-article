/**
 * 会社単位レビュー（public.company_reviews / public.companies）
 */
(function () {
  "use strict";

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function isUuid(id) {
    return UUID_RE.test(String(id || "").trim());
  }

  function normalizeReviewRow(row) {
    if (!row) return null;
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
    const serviceType = String(row.service_type || "").trim();
    const tags = serviceType
      ? serviceType.split(/[,、]/).map((t) => t.trim()).filter(Boolean)
      : [];
    const title = String(row.title || "").trim();
    const reviewerName = String(row.reviewer_name || "").trim() || "利用者";
    const createdAt = row.created_at || "";

    return {
      id: row.id,
      rating,
      comment: String(row.comment || "").trim(),
      title,
      service_type: serviceType,
      tags,
      reviewer_name: reviewerName,
      meta: title,
      created_at: createdAt,
      date: formatReviewDateLabel(createdAt),
      date_iso: createdAt ? String(createdAt).slice(0, 10) : "",
    };
  }

  function formatReviewDateLabel(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function computeBreakdownFromRatings(ratings, totalCount) {
    const counts = [0, 0, 0, 0, 0];
    (ratings || []).forEach((r) => {
      const star = Math.min(5, Math.max(1, Number(r) || 0));
      if (star >= 1 && star <= 5) counts[star - 1] += 1;
    });
    const total = Math.max(Number(totalCount) || 0, ratings?.length || 0, 1);
    return [5, 4, 3, 2, 1].map((star) => {
      const count = counts[star - 1];
      const pct = Math.round((count / total) * 100);
      return { star, pct, count };
    });
  }

  /**
   * @param {string} companyId
   * @param {{ limit?: number }} [options]
   */
  async function fetchCompanyReviewsByCompanyId(companyId, options = {}) {
    const cid = String(companyId || "").trim();
    if (!cid || !isUuid(cid)) {
      return { reviews: [], ratingAvg: 0, reviewCount: 0, breakdown: [] };
    }

    const sb = getClient();
    if (!sb) {
      return { reviews: [], ratingAvg: 0, reviewCount: 0, breakdown: [] };
    }

    const limit = Math.min(Math.max(Number(options.limit) || 4, 1), 8);

    try {
      const [companyRes, recentRes, ratingsRes] = await Promise.all([
        sb
          .from("companies")
          .select("id, rating_avg, review_count")
          .eq("id", cid)
          .maybeSingle(),
        sb
          .from("company_reviews")
          .select(
            "id, company_id, reviewer_name, rating, title, comment, service_type, created_at"
          )
          .eq("company_id", cid)
          .eq("is_visible", true)
          .order("created_at", { ascending: false })
          .limit(limit),
        sb
          .from("company_reviews")
          .select("rating")
          .eq("company_id", cid)
          .eq("is_visible", true),
      ]);

      if (companyRes.error) {
        console.warn("[TasuCompanyReviews] companies fetch:", companyRes.error);
      }
      if (recentRes.error) {
        console.warn("[TasuCompanyReviews] reviews fetch:", recentRes.error);
      }
      if (ratingsRes.error) {
        console.warn("[TasuCompanyReviews] ratings fetch:", ratingsRes.error);
      }

      const company = companyRes.data || {};
      const reviewCount = Number(company.review_count) || 0;
      const ratingAvg = Number(company.rating_avg) || 0;
      const reviews = (recentRes.data || [])
        .map(normalizeReviewRow)
        .filter(Boolean);
      const allRatings = (ratingsRes.data || []).map((r) => r.rating);
      const breakdown = computeBreakdownFromRatings(allRatings, reviewCount);

      return {
        reviews,
        ratingAvg,
        reviewCount,
        breakdown,
      };
    } catch (err) {
      console.warn("[TasuCompanyReviews] fetch failed:", err);
      return { reviews: [], ratingAvg: 0, reviewCount: 0, breakdown: [] };
    }
  }

  window.TasuCompanyReviews = {
    fetchCompanyReviewsByCompanyId,
    normalizeReviewRow,
    computeBreakdownFromRatings,
    formatReviewDateLabel,
    isUuid,
  };
})();
