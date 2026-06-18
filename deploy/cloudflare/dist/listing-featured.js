/**
 * 上位掲載 — Stripe Checkout・出品者向けモーダル・決済戻り処理
 */
(function () {
  "use strict";

  const SUCCESS_MESSAGE = "上位掲載が有効になりました";

  const LEGACY_PLAN_MAP = {
    "7days": "featured_7days",
    "30days": "featured_30days",
  };

  function getPlansFromConfig() {
    const fromCfg = window.TasuStripeFeaturedConfig?.PLANS;
    if (fromCfg && typeof fromCfg === "object") {
      return { ...fromCfg };
    }
    return {
      featured_7days: {
        id: "featured_7days",
        label: "上位掲載（7日）",
        priceLabel: "¥980",
        days: 7,
        amountJpy: 980,
        kind: "featured",
        priority: 1,
      },
      featured_30days: {
        id: "featured_30days",
        label: "上位掲載（30日）",
        priceLabel: "¥2,980",
        days: 30,
        amountJpy: 2980,
        kind: "featured",
        priority: 2,
      },
      pr_30days: {
        id: "pr_30days",
        label: "PR掲載（30日）",
        priceLabel: "¥4,980",
        days: 30,
        amountJpy: 4980,
        kind: "pr",
        priority: 3,
      },
    };
  }

  const PLANS = getPlansFromConfig();

  let modalBound = false;
  let modalListingId = null;

  function resolvePlanId(planId) {
    const key = String(planId || "").trim();
    if (PLANS[key]) return key;
    if (LEGACY_PLAN_MAP[key]) return LEGACY_PLAN_MAP[key];
    return null;
  }

  function parseFeaturedUntil(raw) {
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isTruthyFlag(value) {
    return value === true || value === "true" || value === "t" || value === 1 || value === "1";
  }

  function isActive(row) {
    if (!row || !isTruthyFlag(row.is_featured)) return false;
    const until = parseFeaturedUntil(row.featured_until);
    if (!until) return false;
    return until.getTime() > Date.now();
  }

  function isFeaturedSlotActive(row) {
    if (!isActive(row)) return false;
    const plan = resolvePlanId(row.featured_plan);
    const meta = plan ? PLANS[plan] : null;
    return Boolean(meta && meta.kind === "featured");
  }

  function isPrActive(row) {
    if (!isActive(row)) return false;
    return resolvePlanId(row.featured_plan) === "pr_30days";
  }

  function buildFeaturedPatch(planId) {
    const resolved = resolvePlanId(planId);
    const plan = resolved ? PLANS[resolved] : null;
    if (!plan) return null;

    const until = new Date();
    until.setDate(until.getDate() + (plan.days || 0));

    return {
      is_featured: true,
      featured_until: until.toISOString(),
      featured_plan: plan.id,
      featured_priority: plan.priority || 0,
    };
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 注目掲載スポットライト用プラン優先（同ティア内は shuffle で1件） */
  const SPOTLIGHT_PLAN_PRIORITY = ["pr_30days", "featured_30days", "featured_7days"];

  function pickSpotlightListing(rows) {
    const active = (Array.isArray(rows) ? rows : []).filter(isActive);
    if (!active.length) return null;

    for (const planId of SPOTLIGHT_PLAN_PRIORITY) {
      const tier = active.filter((row) => resolvePlanId(row.featured_plan) === planId);
      if (tier.length) {
        return shuffle(tier)[0];
      }
    }

    return shuffle(active)[0];
  }

  /** 注目掲載（一覧サイズ）— 有効な featured 全プランからランダム1件 */
  function pickRandomFeaturedListing(rows) {
    const active = (Array.isArray(rows) ? rows : []).filter(isActive);
    if (!active.length) return null;
    return shuffle(active)[0];
  }

  function pickRandomPrListing(rows) {
    const prRows = (Array.isArray(rows) ? rows : []).filter(isPrActive);
    if (!prRows.length) return null;
    return shuffle(prRows)[0];
  }

  function formatFeaturedUntilLabel(untilRaw) {
    const until = parseFeaturedUntil(untilRaw);
    if (!until) return "";
    return until.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCurrentUserId() {
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      ""
    );
  }

  function isListingOwner(listing) {
    const owner = String(listing?.user_id || listing?.userId || "").trim();
    const me = String(getCurrentUserId() || "").trim();
    return Boolean(owner && me && owner === me);
  }

  function isUuidListingId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(id || "")
    );
  }

  function getStripeConfig() {
    return window.TasuStripeFeaturedConfig || null;
  }

  function getPublishableAnonKey() {
    const cfg = getStripeConfig();
    const key =
      cfg?.getPublishableAnonKey?.() ||
      cfg?.anonKey ||
      window.TasuSupabasePublicKey?.resolvePublishableAnonKey?.(
        window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {}
      ) ||
      "";
    if (window.TasuSupabasePublicKey?.isForbiddenKey?.(key)) {
      return "";
    }
    return key;
  }

  function stripeHeaders() {
    const anonKey = getPublishableAnonKey();
    if (!anonKey) {
      throw new Error(
        "Supabase の公開キー（anon / sb_publishable）が未設定です。service_role キーはブラウザでは使えません。"
      );
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    };
  }

  async function createStripeCheckoutSession(listingId, planId) {
    const cfg = getStripeConfig();
    if (!cfg?.isConfigured?.()) {
      throw new Error(
        "Stripe Checkout が未設定です。Functions のデプロイと STRIPE_SECRET_KEY を確認してください。"
      );
    }

    const resolved = resolvePlanId(planId);
    if (!resolved) {
      throw new Error("プランが正しくありません");
    }

    const res = await fetch(cfg.createCheckoutUrl, {
      method: "POST",
      headers: stripeHeaders(),
      body: JSON.stringify({
        listing_id: listingId,
        featured_plan: resolved,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const checkoutUrl = data.checkout_url || data.url;
    if (!res.ok || !checkoutUrl) {
      throw new Error(data.error || "Checkout Session の作成に失敗しました");
    }

    return { ...data, url: checkoutUrl };
  }

  async function confirmCheckoutSession(sessionId) {
    const cfg = getStripeConfig();
    if (!cfg?.confirmCheckoutUrl) {
      throw new Error("確認 API が未設定です");
    }

    const res = await fetch(cfg.confirmCheckoutUrl, {
      method: "POST",
      headers: stripeHeaders(),
      body: JSON.stringify({ session_id: sessionId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "決済の確認に失敗しました");
    }

    return data;
  }

  function cleanCheckoutQueryParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("featured_checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  async function verifyFeaturedInDb(listingId) {
    const store = window.TasuListingStore;
    if (!store?.fetchListingById) {
      return { ok: false, error: "掲載ストアが未読み込みです" };
    }

    const row = await store.fetchListingById(listingId);
    if (!row) {
      return { ok: false, error: "掲載を再取得できませんでした" };
    }

    if (!isActive(row)) {
      return {
        ok: false,
        error: "DB にまだ反映されていません",
        row,
      };
    }

    return { ok: true, row };
  }

  async function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("featured_checkout");
    const sessionId = params.get("session_id");

    if (checkout === "cancelled") {
      cleanCheckoutQueryParams();
      return { ok: false, cancelled: true };
    }

    if (checkout !== "success" || !sessionId) {
      return null;
    }

    try {
      const result = await confirmCheckoutSession(sessionId);
      cleanCheckoutQueryParams();
      return {
        ok: true,
        message: SUCCESS_MESSAGE,
        listing_id: result.listing_id,
        featured_plan: result.featured_plan,
        session_id: sessionId,
      };
    } catch (err) {
      cleanCheckoutQueryParams();
      return {
        ok: false,
        error: err?.message || "決済の確認に失敗しました",
      };
    }
  }

  function buildActiveStatusHtml(listing) {
    const untilLabel = formatFeaturedUntilLabel(listing.featured_until);
    const planKey = resolvePlanId(listing.featured_plan);
    const plan = planKey ? PLANS[planKey] : null;
    const planLabel = plan?.label || "上位掲載";
    const isPr = plan?.kind === "pr" || planKey === "pr_30days";
    const badgeLabel = isPr ? "PR掲載中" : "上位掲載中";
    const badgeClass = isPr
      ? "listing-featured-status__badge listing-featured-status__badge--pr"
      : "listing-featured-status__badge";

    return (
      '<div class="listing-featured-status" data-featured-status>' +
      '<span class="' +
      badgeClass +
      '">' +
      escapeHtml(badgeLabel) +
      "</span>" +
      '<p class="listing-featured-status__text">' +
      escapeHtml(planLabel) +
      " — " +
      escapeHtml(untilLabel) +
      "まで有効です。TOPの注目掲載欄に表示されます。</p></div>"
    );
  }

  function buildOwnerSectionHtml(listing, options) {
    const opts = options || {};
    const toastClass = opts.checkoutError
      ? "listing-featured-owner__toast--error"
      : "listing-featured-owner__toast--success";
    const toastHtml = opts.checkoutMessage
      ? '<p class="listing-featured-owner__toast ' +
        toastClass +
        '" role="status">' +
        escapeHtml(opts.checkoutMessage) +
        "</p>"
      : "";

    if (listing && isActive(listing)) {
      return (
        '<div class="listing-featured-owner__inner">' +
        toastHtml +
        buildActiveStatusHtml(listing) +
        "</div>"
      );
    }

    return (
      '<div class="listing-featured-owner__inner">' +
      toastHtml +
      '<button type="button" class="listing-featured-owner__btn" data-featured-open-modal>' +
      "上位掲載する" +
      "</button>" +
      "</div>"
    );
  }

  function buildModalPlanButtonsHtml() {
    return Object.values(PLANS)
      .map((plan) => {
        const prClass = plan.kind === "pr" || plan.id === "pr_30days" ? " listing-featured-modal__plan--pr" : "";
        return (
          '<button type="button" class="listing-featured-modal__plan' +
          prClass +
          '" data-featured-plan="' +
          escapeHtml(plan.id) +
          '">' +
          '<span class="listing-featured-modal__plan-label">' +
          escapeHtml(plan.label) +
          "</span>" +
          '<span class="listing-featured-modal__plan-price">' +
          escapeHtml(plan.priceLabel) +
          "</span></button>"
        );
      })
      .join("");
  }

  function ensureFeaturedModal() {
    let modal = document.querySelector("[data-featured-modal]");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "listing-featured-modal";
    modal.setAttribute("data-featured-modal", "");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="listing-featured-modal__backdrop" data-featured-modal-close tabindex="-1"></div>' +
      '<div class="listing-featured-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="featuredModalTitle">' +
      '<button type="button" class="listing-featured-modal__close" data-featured-modal-close aria-label="閉じる">×</button>' +
      '<p class="listing-featured-modal__eyebrow">おすすめ</p>' +
      '<h2 id="featuredModalTitle" class="listing-featured-modal__title">上位掲載プラン</h2>' +
      '<p class="listing-featured-modal__lead">プランを選ぶと Stripe の決済ページへ移動します。完了後、自動で掲載が有効になります。</p>' +
      '<div class="listing-featured-modal__plans" role="group" aria-label="プラン選択">' +
      buildModalPlanButtonsHtml() +
      "</div>" +
      '<p class="listing-featured-modal__note" data-featured-modal-note>テストモードのカードでお試しください。</p>' +
      "</div>";

    document.body.appendChild(modal);
    bindFeaturedModal(modal);
    return modal;
  }

  function closeFeaturedModal() {
    const modal = document.querySelector("[data-featured-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("listing-featured-modal-open");
    modalListingId = null;
  }

  function openFeaturedModal(listingId) {
    if (!isUuidListingId(listingId)) {
      window.alert("Supabase に保存した掲載（UUID）のみ Stripe 決済できます。");
      return;
    }

    const modal = ensureFeaturedModal();
    modalListingId = listingId;

    const note = modal.querySelector("[data-featured-modal-note]");
    if (note) {
      note.textContent = "テストモードのカードでお試しください。";
      note.classList.remove("is-error", "is-busy");
    }

    modal.querySelectorAll("[data-featured-plan]").forEach((btn) => {
      btn.disabled = false;
    });

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("listing-featured-modal-open");
    modal.querySelector("[data-featured-plan]")?.focus();
  }

  function bindFeaturedModal(modal) {
    if (!modal || modalBound) return;
    modalBound = true;

    modal.querySelectorAll("[data-featured-modal-close]").forEach((el) => {
      el.addEventListener("click", closeFeaturedModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeFeaturedModal();
      }
    });

    modal.querySelectorAll("[data-featured-plan]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const planId = btn.getAttribute("data-featured-plan");
        const listingId = modalListingId;
        if (!listingId || !planId) return;

        const note = modal.querySelector("[data-featured-modal-note]");
        modal.querySelectorAll("[data-featured-plan]").forEach((el) => {
          el.disabled = true;
        });
        if (note) {
          note.textContent = "Stripe 決済ページへ移動しています…";
          note.classList.add("is-busy");
          note.classList.remove("is-error");
        }

        try {
          const checkout = await createStripeCheckoutSession(listingId, planId);
          const redirectUrl = checkout.checkout_url || checkout.url;
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }
          throw new Error("Checkout URL を取得できませんでした");
        } catch (err) {
          modal.querySelectorAll("[data-featured-plan]").forEach((el) => {
            el.disabled = false;
          });
          if (note) {
            note.textContent = err?.message || "決済の開始に失敗しました";
            note.classList.add("is-error");
            note.classList.remove("is-busy");
          }
        }
      });
    });
  }

  function bindOwnerSection(section, listing) {
    const openBtn = section.querySelector("[data-featured-open-modal]");
    openBtn?.addEventListener("click", () => {
      openFeaturedModal(listing.id);
    });
  }

  function renderPostSuccessUpsell(container, options) {
    if (!container) return;

    const listingId = options?.listingId;
    if (!listingId) {
      container.hidden = true;
      return;
    }

    if (!isUuidListingId(listingId)) {
      container.innerHTML =
        '<p class="listing-featured-modal__note">掲載保存後、詳細ページ（UUID）から上位掲載をお申し込みください。</p>';
      container.hidden = false;
      return;
    }

    container.innerHTML =
      '<div class="listing-featured-owner">' +
      '<div class="listing-featured-owner__inner">' +
      '<button type="button" class="listing-featured-owner__btn" data-featured-open-modal>上位掲載する</button>' +
      "</div></div>";
    container.hidden = false;

    container.querySelector("[data-featured-open-modal]")?.addEventListener("click", () => {
      openFeaturedModal(listingId);
    });
  }

  function mountDetailOwnerFeatured(listing, extraOptions) {
    if (!listing?.id) return;

    const opts = extraOptions || {};
    const showOwnerUi = opts.forceOwner === true || isListingOwner(listing);

    let section = document.querySelector("[data-featured-upsell-section]");
    if (!section) {
      section = document.createElement("section");
      section.className =
        "listing-featured-upsell-section section-anchor skill-section-spaced mb-4";
      section.setAttribute("data-featured-upsell-section", "");
      section.setAttribute("aria-label", "上位掲載（出品者）");
      const anchor = document.getElementById("section-seller");
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(section, anchor);
      } else {
        document.querySelector("main")?.appendChild(section);
      }
    }

    if (!showOwnerUi) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }

    if (!isUuidListingId(listing.id)) {
      section.hidden = false;
      section.innerHTML =
        '<div class="listing-featured-owner"><p class="listing-featured-modal__note">この掲載はデモ ID のため Stripe 決済できません。Supabase 保存済みの掲載でお試しください。</p></div>';
      return;
    }

    section.hidden = false;
    section.innerHTML =
      '<div class="listing-featured-owner" data-featured-owner-block>' +
      buildOwnerSectionHtml(listing, opts) +
      "</div>";

    bindOwnerSection(section, listing);
  }

  /**
   * 詳細ページ load 用 — 決済戻り処理 → 掲載再取得 → 出品者 UI 描画
   */
  async function initDetailFeatured(listing, options) {
    const opts = options || {};
    const current = listing;
    mountDetailOwnerFeatured(current, {
      checkoutMessage: opts.checkoutMessage || "",
      checkoutError: Boolean(opts.checkoutError),
    });
    return {
      listing: current,
      checkoutMessage: opts.checkoutMessage || "",
      checkoutError: Boolean(opts.checkoutError),
    };
  }

  function hasCheckoutReturnParams() {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("featured_checkout") === "success" && Boolean(params.get("session_id"))
    );
  }

  window.TasuListingFeatured = {
    PLANS,
    SPOTLIGHT_PLAN_PRIORITY,
    resolvePlanId,
    isActive,
    isFeaturedSlotActive,
    isPrActive,
    pickSpotlightListing,
    pickRandomFeaturedListing,
    pickRandomPrListing,
    isListingOwner,
    getCurrentUserId,
    buildFeaturedPatch,
    shuffle,
    formatFeaturedUntilLabel,
    createStripeCheckoutSession,
    confirmCheckoutSession,
    handleCheckoutReturn,
    hasCheckoutReturnParams,
    verifyFeaturedInDb,
    initDetailFeatured,
    SUCCESS_MESSAGE,
    openFeaturedModal,
    mountDetailOwnerFeatured,
    mountDetailUpsell: mountDetailOwnerFeatured,
    renderPostSuccessUpsell,
    isUuidListingId,
  };
})();
