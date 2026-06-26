/**
 * Platform — 共通バッジコンポーネント（最大5個）
 */
(function (global) {
  "use strict";

  const MAX_BADGES = 5;

  const PRODUCT_BADGE_DEFS = Object.freeze([
    { id: "bestseller", label: "ベストセラー", className: "platform-badge--bestseller", test: (l) => num(l?.popular) >= 300 || l?.is_bestseller },
    { id: "popular", label: "人気", className: "platform-badge--popular", test: (l) => num(l?.popular) >= 100 },
    { id: "high-rating", label: "高評価", className: "platform-badge--high-rating", test: (l) => num(l?.review_average ?? l?.rating) >= 4.5 },
    { id: "new", label: "新着", className: "platform-badge--new", test: (l) => l?.is_new || daysSince(l?.created_at) <= 14 },
  ]);

  const SERVICE_BADGE_DEFS = Object.freeze([
    {
      id: "ai-recommend",
      label: "🏅 AIおすすめ",
      className: "platform-badge--ai-recommend",
      interactive: true,
      test: (l, ctx) => global.TasuPlatformAiRecommend?.isRecommended?.(l, ctx),
    },
    { id: "verified", label: "本人確認", className: "platform-badge--verified", test: (l) => l?.identity_verified || l?.kyc_verified || l?.verified },
    { id: "license", label: "資格確認", className: "platform-badge--license", test: (l) => l?.license_verified || l?.has_license },
    { id: "corp", label: "法人認証", className: "platform-badge--corp", test: (l) => l?.corp_verified || l?.business_verified },
    { id: "instant", label: "即対応", className: "platform-badge--instant", test: (l) => /即|instant|sameDay/i.test(String(l?.availability || l?.speed || "")) },
    { id: "nearby", label: "近く", className: "platform-badge--nearby", test: (l, ctx) => ctx?.nearby === true },
  ]);

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function daysSince(iso) {
    if (!iso) return 9999;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return 9999;
    return (Date.now() - t) / 86400000;
  }

  function isProductListing(listing) {
    const t = String(listing?.listing_type || listing?.type || listing?.category || "").toLowerCase();
    return t === "product" || t === "shop-store" || t === "shop_store";
  }

  /**
   * @param {object} listing
   * @param {{ area?: string, budgetMax?: number, nearby?: boolean }} [ctx]
   */
  function collectBadges(listing, ctx) {
    const defs = isProductListing(listing) ? PRODUCT_BADGE_DEFS : SERVICE_BADGE_DEFS;
    const out = [];
    for (const def of defs) {
      if (out.length >= MAX_BADGES) break;
      try {
        if (def.test(listing, ctx)) {
          const extra =
            def.id === "ai-recommend"
              ? { reasons: global.TasuPlatformAiRecommend?.scoreListing?.(listing, ctx)?.reasons || [] }
              : {};
          out.push({ ...def, ...extra });
        }
      } catch {
        /* skip */
      }
    }
    return out.slice(0, MAX_BADGES);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function renderBadgesHtml(listing, ctx) {
    const badges = collectBadges(listing, ctx);
    if (!badges.length) return "";
    const items = badges
      .map((b) => {
        const attrs = b.interactive ? ' data-platform-ai-recommend="1" tabindex="0" role="button"' : "";
        return `<span class="platform-badge ${b.className}" data-badge-id="${esc(b.id)}"${attrs}>${esc(b.label)}</span>`;
      })
      .join("");
    return `<div class="platform-badges" data-platform-badges>${items}</div>`;
  }

  function bindRecommendPopovers(root) {
    const host = root || global.document;
    if (!host?.querySelectorAll) return;
    host.querySelectorAll("[data-platform-ai-recommend]").forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const card = el.closest("[data-listing-id], .card, article");
        const listingId = card?.dataset?.listingId || "";
        showReasonPopover(el, listingId);
      });
    });
  }

  function showReasonPopover(anchor, listingId) {
    global.document.querySelectorAll(".platform-badge-popover").forEach((n) => n.remove());
    const listing = global.TasuPlatformSearchHub?.findListingById?.(listingId) || {};
    const ctx = global.TasuPlatformSearchHub?.getSearchContext?.() || {};
    const reasons = global.TasuPlatformAiRecommend?.formatReasons?.(
      global.TasuPlatformAiRecommend?.scoreListing?.(listing, ctx)?.reasons
    ) || ["✓ 条件に合う候補"];
    const pop = global.document.createElement("div");
    pop.className = "platform-badge-popover";
    pop.innerHTML = `<strong>おすすめ理由</strong><ul>${reasons.slice(0, 5).map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p class="platform-badge-popover__note">※ AIは契約・購入・依頼を決定しません。参考情報としてご利用ください。</p>`;
    global.document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    pop.style.position = "fixed";
    pop.style.left = `${Math.min(rect.left, global.innerWidth - 220)}px`;
    pop.style.top = `${rect.bottom + 6}px`;
    const close = () => pop.remove();
    global.setTimeout(() => global.document.addEventListener("click", close, { once: true }), 0);
  }

  global.TasuPlatformBadges = {
    MAX_BADGES,
    collectBadges,
    renderBadgesHtml,
    bindRecommendPopovers,
  };
})(typeof window !== "undefined" ? window : globalThis);
