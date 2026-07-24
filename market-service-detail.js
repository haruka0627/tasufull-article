/**
 * Market サービス詳細ページ — モック / TasuListingStore データ表示
 */
(function () {
  "use strict";

  const API = () => window.TasuMarketServiceDetail;
  const TYPE_LABEL = { product: "商品", skill: "スキル", job: "求人", worker: "ワーカー" };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getListingId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("id");
    if (fromQuery) return fromQuery.trim();
    const path = window.location.pathname.replace(/\/+$/, "");
    const pretty = path.match(/\/market\/services\/([^/?#]+)$/i);
    if (pretty) return decodeURIComponent(pretty[1]);
    return "";
  }

  function normalizeRankKey(raw) {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) return "new";
    if (key === "master" || key === "platinum") return "platinum";
    if (["legend", "diamond", "gold", "silver", "bronze", "new"].includes(key)) return key;
    return "new";
  }

  function rankLabel(rankKey) {
    const k = normalizeRankKey(rankKey);
    if (k === "platinum") return "MASTER";
    return String(k).toUpperCase();
  }

  function rankPlateSrc(rankKey) {
    const k = normalizeRankKey(rankKey);
    const Seller = window.TasuListingSellerProfile;
    if (Seller?.rankPlateImageUrl) {
      const raw = Seller.rankPlateImageUrl(k === "platinum" ? "platinum" : k);
      return String(raw || "").startsWith("/") ? raw : `/${raw}`;
    }
    if (k === "legend") return "/images/rank/legend.png";
    if (k === "diamond") return "/images/rank/diamond.webp";
    return `/images/rank/${k}.webp`;
  }

  function renderStars(rating) {
    const r = Number(rating) || 0;
    const full = Math.max(0, Math.min(5, Math.floor(r)));
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  function resolveAccountLine(listing, seller) {
    const handle = seller?.handle
      ? seller.handle.startsWith("@")
        ? seller.handle
        : `@${seller.handle}`
      : `@${String(listing?.user_id || "seller").slice(0, 16)}`;
    const name = String(seller?.displayName || listing?.seller_name || "").trim();
    return name ? `${name} · ${handle}` : handle;
  }

  function resolveRankKey(listing, seller) {
    return normalizeRankKey(
      seller?.rankKey ||
        seller?.memberRank ||
        listing?.rank ||
        listing?.seller_rank ||
        "new"
    );
  }

  function hydrateAvatar(ring, listing, seller) {
    if (!ring) return;
    const userId = String(listing?.user_id || "").trim();
    const imgUrl =
      seller?.avatarUrl ||
      listing?.thumbnail_url ||
      listing?.image_url ||
      listing?.imageUrl ||
      "";
    const title = String(listing?.title || "T").trim();
    const initial = title ? title[0].toUpperCase() : "T";
    ring.innerHTML = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" decoding="async">`
      : `<span class="msd-avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`;
    ring.setAttribute("data-avatar-hydrated", "1");
    if (userId) ring.setAttribute("data-seller-user-id", userId);
  }

  function renderDetail({ listing, seller }) {
    const root = $("[data-market-service-root]");
    if (!root) return;

    const api = API();
    const type = listing.listing_type || listing.type || "skill";
    const typeLabel = TYPE_LABEL[type] || api?.TYPE_LABEL?.[type] || "掲載";
    const category = api?.resolveCategoryLabel?.(listing) || typeLabel;
    const price = api?.resolvePriceText?.(listing) || "要相談";
    const tags = api?.normalizeTags?.(listing) || [];
    const rating = api?.resolveRating?.(listing) || { average: 0, count: 0 };
    const achievements = api?.resolveAchievements?.(listing, seller) || "—";
    const repeatRate = seller?.repeatRate ?? seller?.repeat_rate;
    const rankKey = resolveRankKey(listing, seller);
    const rankCls = `rank-${rankKey}${rankKey === "platinum" ? " rank-master" : ""}`;
    const accountLine = resolveAccountLine(listing, seller);
    const consultHref = api?.consultUrl?.(listing) || "/talk-home.html";
    const listingId = listing.id;

    const ratingHtml =
      rating.average > 0
        ? `<span class="msd-rating__stars">${escapeHtml(renderStars(rating.average))}</span>
           <span>${rating.average.toFixed(1)}</span>
           ${rating.count > 0 ? `<span class="msd-rating__count">（${rating.count}件）</span>` : ""}`
        : `<span class="msd-rating__count">評価なし</span>`;

    root.innerHTML = `
      <article class="msd-card list-card-seller ${escapeHtml(rankCls)}" data-listing-loaded="true">
        <header class="msd-hero">
          <div class="msd-hero__profile">
            <div class="profile-rank-block">
              <img class="seller-rank-plate-img rank-chip ${escapeHtml(rankCls)}" data-seller-rank-chip
                src="${escapeHtml(rankPlateSrc(rankKey))}" alt="${escapeHtml(rankLabel(rankKey))}"
                width="96" height="24" loading="lazy" decoding="async">
              <div class="avatar-ring profile-avatar ${escapeHtml(rankCls)}" data-rank-avatar aria-hidden="true"></div>
            </div>
          </div>
          <div class="msd-hero__body">
            <div class="msd-badges">
              <span class="msd-type-pill">${escapeHtml(typeLabel)}</span>
              <span class="msd-cat-pill">${escapeHtml(category)}</span>
            </div>
            <h1 class="msd-title">${escapeHtml(listing.title || "サービス")}</h1>
            <p class="msd-seller">
              <span class="msd-seller-id">${escapeHtml(accountLine)}</span>
            </p>
            <div class="msd-rating">${ratingHtml}</div>
            <p class="msd-price">${escapeHtml(price)}</p>
          </div>
          <button type="button" class="fav-round msd-fav" data-favorite-button data-favorite-icon-only="1"
            data-target-type="${escapeHtml(type)}" data-target-id="${escapeHtml(listingId)}" aria-label="お気に入り">♡</button>
        </header>

        <section class="msd-section" aria-label="タグ">
          <h2 class="msd-section__title">タグ</h2>
          <div class="msd-tags">
            ${
              tags.length
                ? tags.map((t) => `<span class="msd-tag">${escapeHtml(t)}</span>`).join("")
                : `<span class="msd-tag">${escapeHtml(typeLabel)}</span>`
            }
          </div>
        </section>

        <section class="msd-section" aria-label="実績">
          <h2 class="msd-section__title">実績</h2>
          <div class="msd-stats">
            <div class="msd-stat">
              <span class="msd-stat__label">取引・実績</span>
              <span class="msd-stat__value">${escapeHtml(achievements)}</span>
            </div>
            <div class="msd-stat">
              <span class="msd-stat__label">リピート率</span>
              <span class="msd-stat__value">${repeatRate != null && repeatRate !== "" ? `${escapeHtml(String(repeatRate))}%` : "—"}</span>
            </div>
          </div>
        </section>

        <section class="msd-section" aria-label="サービス説明">
          <h2 class="msd-section__title">サービス説明</h2>
          <p class="msd-desc">${escapeHtml(listing.description || "説明は準備中です。")}</p>
        </section>

        <div class="msd-actions">
          <a class="btn-outline" href="/market/">マーケット一覧へ戻る</a>
          <a class="btn-primary" href="${escapeHtml(consultHref)}">相談する</a>
        </div>
      </article>
    `;

    hydrateAvatar(root.querySelector("[data-rank-avatar]"), listing, seller);
    if (window.TasuDetailFavorites?.syncAllButtonsOnPage) {
      void window.TasuDetailFavorites.syncAllButtonsOnPage();
    }

    document.title = `${listing.title || "サービス"} | TASFUL Market`;
  }

  function renderNotFound(id) {
    const root = $("[data-market-service-root]");
    if (!root) return;
    root.innerHTML = `
      <div class="msd-card msd-empty">
        <h1 class="msd-empty__title">サービスが見つかりません</h1>
        <p class="msd-empty__text">指定された掲載（ID: ${escapeHtml(id || "—")}）は存在しないか、公開が終了しています。</p>
        <a class="btn-primary" href="/market/">マーケット一覧へ戻る</a>
      </div>
    `;
    document.title = "サービスが見つかりません | TASFUL Market";
  }

  async function init() {
    if (!document.body.classList.contains("market-service-page")) return;
    const id = getListingId();
    if (!id) {
      renderNotFound("");
      return;
    }
    const api = API();
    if (!api?.resolveListing) {
      renderNotFound(id);
      return;
    }
    const result = await api.resolveListing(id);
    if (!result?.listing) {
      renderNotFound(id);
      return;
    }
    renderDetail(result);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
