/**
 * TasuFull — ワーカー専用一覧カード
 */
(function (global) {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {object} data
   * @returns {HTMLLIElement}
   */
  function createWorkerCard(data) {
    const li = document.createElement("li");
    li.className = "card-list__item card-list__item--worker";
    li.setAttribute("data-filterable", "");

    const nameLine = `${data.name}｜${data.ageGroup}`;
    const verifiedHtml = data.verified
      ? '<span class="worker-card__verified">✔ 本人確認済み</span>'
      : "";

    const categoriesHtml = (data.categories ?? [])
      .map((c) => `<span class="worker-card__category">${escapeHtml(c)}</span>`)
      .join("");

    const tagsHtml = (data.tags ?? [])
      .map((t) => `<span class="worker-card__chip">${escapeHtml(t)}</span>`)
      .join("");

    const sectionLabel = escapeHtml(data.sectionLabel ?? "ワーカー");
    const targetIdRaw = String(data.targetId || data.id || "").trim();
    const consultHref = targetIdRaw
      ? `detail-worker.html?id=${encodeURIComponent(targetIdRaw)}`
      : escapeHtml(data.href ?? "detail-worker.html");

    const targetId = escapeHtml(targetIdRaw);

    li.innerHTML = `
      <button
        type="button"
        class="card-list__favorite tasu-favorite-btn"
        data-favorite-button
        data-target-type="worker"
        data-target-id="${targetId}"
        data-user-id="u_me"
        aria-label="お気に入り"
        aria-pressed="false"
      ><span class="tasu-favorite-btn__icon" aria-hidden="true">♡</span></button>
      <article
        class="worker-card"
        data-category="worker"
        data-type="worker"
        data-target-type="worker"
        data-listing-title="${escapeHtml(data.title)}"
        data-target-id="${targetId}"
        data-rank="${escapeHtml(data.section === "premium" ? "premium" : "free")}"
        ${data.section === "premium" ? 'data-premium="true" data-listing-level="paid"' : ""}
        data-price="${Number(data.priceValue) || 0}"
        data-date="${Number(data.date) || 0}"
        data-popular="${Number(data.reviewCount) || 0}"
        data-same-day="${data.sameDay ? "yes" : "no"}"
        data-night="${data.night ? "yes" : "no"}"
        data-has-car="${data.hasCar ? "yes" : "no"}"
      >
        <div class="worker-card__inner">
          <header class="worker-card__top">
            <img
              class="worker-card__avatar"
              src="${escapeHtml(data.avatar)}"
              alt="${escapeHtml(data.name)}のプロフィール"
              width="72"
              height="72"
              loading="lazy"
            >
            <div class="worker-card__identity">
              <p class="worker-card__section">${sectionLabel}</p>
              <p class="worker-card__name">${escapeHtml(nameLine)}</p>
              ${verifiedHtml}
            </div>
          </header>

          <div class="worker-card__categories" aria-label="カテゴリ">
            ${categoriesHtml}
          </div>

          <h3 class="worker-card__title">
            <a class="worker-card__title-link" href="${consultHref}">${escapeHtml(data.title)}</a>
          </h3>

          <p class="worker-card__area">
            <span class="worker-card__area-icon" aria-hidden="true">📍</span>
            ${escapeHtml(data.area)}
          </p>

          <div class="worker-card__chips" aria-label="対応タグ">
            ${tagsHtml}
          </div>

          <p class="worker-card__price">${escapeHtml(data.priceLabel)}</p>

          <footer class="worker-card__footer">
            <p class="worker-card__rating" aria-label="評価 ${escapeHtml(data.rating)}">
              <span class="worker-card__rating-star" aria-hidden="true">★</span>
              <span class="worker-card__rating-score">${escapeHtml(data.rating)}</span>
              <span class="worker-card__rating-count">(${escapeHtml(data.reviewCount)})</span>
            </p>
            <a class="worker-card__cta" href="${consultHref}">相談する</a>
          </footer>
        </div>
      </article>
    `;

    return li;
  }

  function mountWorkerCards(samples) {
    const list = samples ?? global.WORKER_CARD_SAMPLES ?? [];
    const premiumList = document.querySelector(".card-list--premium");
    const freeList = document.querySelector(".card-list--free");

    list.forEach((data) => {
      const card = createWorkerCard(data);
      const target = data.section === "premium" ? premiumList : freeList;
      if (!target) {
        return;
      }

      const items = target.querySelectorAll(".card-list__item:not(.card-list__item--worker)");
      if (data.section === "premium" && items.length >= 2) {
        items[1].after(card);
        return;
      }
      if (data.id === "w2" && items.length >= 1) {
        items[0].after(card);
        return;
      }
      if (data.id === "w3" && items.length >= 3) {
        items[2].after(card);
        return;
      }
      target.appendChild(card);
    });

    if (window.TasuListings?.refreshListingIndex) {
      window.TasuListings.refreshListingIndex();
      window.TasuListings.applyFilters?.();
    }
  }

  global.TasuWorkerCards = {
    createWorkerCard,
    mountWorkerCards,
  };

  if (
    document.querySelector(".card-list--premium, .card-list--free") &&
    !document.querySelector(".card-list__item--worker") &&
    (global.WORKER_CARD_SAMPLES?.length ?? 0) > 0
  ) {
    mountWorkerCards();
  }
})(
  typeof window !== "undefined" ? window : globalThis
);
