/**
 * 詳細ページ — review_scores 表示
 * 投稿者 user_id ↔ review_scores.user_id
 *
 * 将来追加予定（コメントのみ）:
 * - 完了率 / 通報率 / 認証済み / 本人確認
 * - Stripe連携 / 危険率 / trust_score（総合スコア）
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasu_chat_seed_v1";

  /** 静的デモ（Supabase / localStorage 未設定時） */
  const DEMO_SCORES = {
    u_hiro: { user_id: "u_hiro", average_rating: 4.9, total_reviews: 23, skipped_reviews: 2 },
    u_store: { user_id: "u_store", average_rating: 4.8, total_reviews: 52, skipped_reviews: 5 },
    u_sachi: { user_id: "u_sachi", average_rating: 4.9, total_reviews: 256, skipped_reviews: 12 },
    u_company: { user_id: "u_company", average_rating: 4.7, total_reviews: 18, skipped_reviews: 1 },
  };

  const MOUNT_POINTS = [
    { selector: "[data-seller-trust-anchor]", position: "afterend", key: "seller" },
    { selector: ".member-name", position: "afterend", key: "name" },
    { selector: ".worker-hero__identity", position: "afterend", key: "hero" },
    { selector: ".seller-actions-col", position: "afterbegin", key: "cta" },
  ];

  function resolveAuthorUserId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("authorId") || params.get("authorUserId") || params.get("userId");
    if (fromQuery) return String(fromQuery).trim();

    const fromBody = document.body?.dataset?.authorUserId;
    if (fromBody) return String(fromBody).trim();

    const section = document.querySelector("#section-seller[data-author-user-id]");
    if (section?.dataset?.authorUserId) {
      return String(section.dataset.authorUserId).trim();
    }

    return "";
  }

  function formatStarGlyphs(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "☆☆☆☆☆";
    const full = Math.min(5, Math.max(0, Math.floor(n)));
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  /**
   * @param {object|null|undefined} row review_scores 行
   * @returns {{ variant: string, text: string, stars: string, average: string, total: number, ariaLabel: string }}
   */
  function formatTrustDisplay(row) {
    if (!row) {
      return {
        variant: "new",
        text: "新規ユーザー",
        stars: "",
        average: "",
        total: 0,
        ariaLabel: "新規ユーザー",
      };
    }

    const total = Number(row.total_reviews ?? 0);
    if (!Number.isFinite(total) || total === 0) {
      return {
        variant: "none",
        text: "レビューなし",
        stars: "",
        average: "",
        total: 0,
        ariaLabel: "レビューなし",
      };
    }

    const avg = Number(row.average_rating ?? 0);
    const avgRounded = Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0;
    const stars = formatStarGlyphs(avgRounded);
    const text = `${stars} ${avgRounded.toFixed(1)}（${total}件）`;

    return {
      variant: "rated",
      text,
      stars,
      average: avgRounded.toFixed(1),
      total,
      ariaLabel: `評価 ${avgRounded.toFixed(1)}、${total}件のレビュー`,
    };
  }

  function fetchReviewScoreDummy(userId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const seed = JSON.parse(raw);
      const scores = seed?.reviewScores;
      if (!scores || typeof scores !== "object") return null;
      return scores[userId] ?? null;
    } catch {
      return null;
    }
  }

  function getSupabaseClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  async function fetchReviewScore(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return null;

    if (window.TasuChatSupabase?.fetchReviewScore) {
      try {
        if (window.TasuChatSupabase.isConfigured?.()) {
          if (window.TasuChatSupabase.init) {
            await window.TasuChatSupabase.init();
          }
          return await window.TasuChatSupabase.fetchReviewScore(uid);
        }
      } catch (err) {
        console.warn("[TasuDetailTrust] TasuChatSupabase.fetchReviewScore failed:", err);
      }
    }

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("review_scores")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();
        if (error) {
          console.warn("[TasuDetailTrust] review_scores fetch error:", error);
          return fetchReviewScoreDummy(uid);
        }
        return data;
      } catch (err) {
        console.warn("[TasuDetailTrust] review_scores fetch failed:", err);
      }
    }

    const dummy = fetchReviewScoreDummy(uid);
    if (dummy) return dummy;
    return DEMO_SCORES[uid] ?? null;
  }

  function buildTrustElement(display) {
    const el = document.createElement("p");
    el.className = `tasu-trust-score tasu-trust-score--${display.variant}`;
    el.setAttribute("aria-label", display.ariaLabel);

    if (display.variant === "rated") {
      el.innerHTML = `<span class="tasu-trust-score__stars" aria-hidden="true">${display.stars}</span><span class="tasu-trust-score__value">${display.average}（${display.total}件）</span>`;
    } else {
      el.textContent = display.text;
    }

    return el;
  }

  function mountTrustBadge(display, mountKey, anchor, position) {
    if (!anchor) return;

    if (anchor.matches("[data-seller-trust-anchor]")) {
      anchor.className = `skill-seller-premium__rating tasu-trust-score tasu-trust-score--${display.variant}`;
      anchor.setAttribute("aria-label", display.ariaLabel);
      if (display.variant === "rated") {
        anchor.innerHTML = `<span class="tasu-trust-score__stars" aria-hidden="true">${display.stars}</span><span class="tasu-trust-score__value">${display.average}（${display.total}件）</span>`;
      } else {
        anchor.textContent = display.text;
      }
      syncLegacyRatingBlocks(display);
      return;
    }

    const parent = position === "afterbegin" ? anchor : anchor.parentElement;
    if (!parent) return;

    const existing = parent.querySelector(`[data-tasu-trust-mount="${mountKey}"]`);
    if (existing) {
      existing.replaceWith(buildTrustElement(display));
      return;
    }

    const el = buildTrustElement(display);
    el.dataset.tasuTrustMount = mountKey;

    if (position === "afterbegin") {
      anchor.insertAdjacentElement("afterbegin", el);
    } else {
      anchor.insertAdjacentElement("afterend", el);
    }
  }

  /** 既存の静的「評価」表示を review_scores と同期（レイアウト維持） */
  function syncLegacyRatingBlocks(display) {
    const ratingStat = document.querySelector(".seller-stat--rating");
    if (ratingStat) {
      const ratingEl = ratingStat.querySelector(".seller-stat__rating");
      const countEl = ratingStat.querySelector(".seller-stat__count");
      const starsEl = ratingStat.querySelector(".seller-stat__stars");

      if (display.variant === "rated") {
        if (ratingEl) {
          ratingEl.innerHTML = "";
          const avgSpan = document.createElement("span");
          avgSpan.textContent = display.average;
          ratingEl.appendChild(avgSpan);
          if (starsEl) {
            starsEl.textContent = display.stars;
          } else {
            const s = document.createElement("span");
            s.className = "seller-stat__stars";
            s.setAttribute("aria-hidden", "true");
            s.textContent = display.stars;
            ratingEl.appendChild(s);
          }
        }
        if (countEl) {
          countEl.textContent = `(${display.total}件)`;
        }
      } else {
        if (ratingEl) {
          ratingEl.textContent = display.text;
        }
        if (starsEl) starsEl.textContent = "";
        if (countEl) countEl.textContent = "";
      }
    }

    const workerBadge = document.querySelector(".worker-inline-badge--rating");
    if (workerBadge) {
      workerBadge.textContent =
        display.variant === "rated" ? `★${display.average}（${display.total}件）` : display.text;
    }
  }

  function mountAll(display) {
    const hasSellerTrust = Boolean(document.querySelector("[data-seller-trust-anchor]"));

    for (const point of MOUNT_POINTS) {
      if (hasSellerTrust && (point.key === "name" || point.key === "cta")) {
        continue;
      }
      const anchor = document.querySelector(point.selector);
      mountTrustBadge(display, point.key, anchor, point.position);
    }
    syncLegacyRatingBlocks(display);
  }

  async function initForUser(userId) {
    const uid = String(userId || resolveAuthorUserId() || "").trim();
    if (!uid) {
      console.warn("[TasuDetailTrust] author user_id not found (data-author-user-id)");
      return null;
    }

    const row = await fetchReviewScore(uid);
    const display = formatTrustDisplay(row);
    mountAll(display);

    window.TasuDetailTrustScore = {
      ...(window.TasuDetailTrustScore || {}),
      userId: uid,
      row,
      display,
      initForUser,
      init,
    };

    return { userId: uid, row, display };
  }

  async function init() {
    return initForUser(resolveAuthorUserId());
  }

  window.TasuDetailTrustScore = {
    resolveAuthorUserId,
    formatTrustDisplay,
    formatStarGlyphs,
    fetchReviewScore,
    init,
    initForUser,
  };

  const isSkillDetail = /detail-skill\.html/i.test(window.location.pathname);
  const isJobDetail =
    document.body?.dataset?.detailType === "job" ||
    /detail-job\.html/i.test(window.location.pathname);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!isSkillDetail && !isJobDetail) void init();
    });
  } else if (!isSkillDetail && !isJobDetail) {
    void init();
  }

  window.addEventListener("tasu:listing-seller-ready", (event) => {
    if (isJobDetail) return;
    const uid = event?.detail?.userId;
    if (uid) void initForUser(uid);
  });
})();
