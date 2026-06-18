/**
 * 詳細ページ — 相談・問い合わせ CTA → tasful_chat_threads
 */
(function (global) {
  "use strict";

  /** 業務サービス詳細は TasuBusinessServiceFlow（service_deals + transaction_rooms）へ委譲 */
  const BUSINESS_SERVICE_FLOW_BUTTON_SELECTOR = [
    "[data-business-service-consult]",
    "[data-business-service-estimate]",
    "[data-business-service-chat]",
    "[data-bsf-route]",
  ].join(", ");

  const CONTACT_BUTTON_SELECTOR = [
    "[data-tasu-contact-cta]",
    "[data-biz-detail-inquiry]",
    "[data-biz-detail-sticky-inquiry]",
    "[data-listing-primary-cta]",
    ".cta-consult",
  ].join(", ");

  let currentListing = null;
  let toastTimer = null;

  function getStore() {
    return global.TasuChatThreadStore;
  }

  function pickListingId(listing) {
    return String(listing?.id || listing?.listing_id || "").trim();
  }

  function ensureToastHost() {
    let el = document.querySelector("[data-tasu-contact-toast]");
    if (el) return el;
    el = document.createElement("div");
    el.className = "tasu-contact-toast";
    el.setAttribute("data-tasu-contact-toast", "");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function notifyBenchBuyerPurchased() {
    if (global.TasuPlatformChatBenchEmbed?.postBenchBuyerPurchased?.()) return;
    try {
      const params = new URLSearchParams(global.location.search);
      if (params.get("benchEmbed") !== "1") return;
      const Live = global.TasuPlatformChatLiveFlow;
      const Demo = global.TasuPlatformChatDualWindowDemo;
      const profileId = params.get("demoProfile");
      const connect = params.get("demoConnect") === "1";
      let href = "";
      if (Live?.benchBuyerWaitingUrl && Demo?.getProfile) {
        const profile = Demo.getProfile(profileId, connect);
        if (profile?.partnerBId) {
          href = Live.benchBuyerWaitingUrl(profile, profile.partnerBId);
        }
      }
      if (!href) {
        const u = new URL("platform-chat-bench-buyer-wait.html", global.location.href);
        params.forEach((value, key) => u.searchParams.set(key, value));
        href = u.href;
      }
      global.parent.postMessage(
        {
          type: "tasu-bench-frame-navigate",
          slot: "b-chat",
          href,
          opensBuyerWaiting: true,
        },
        "*"
      );
    } catch {
      /* ignore */
    }
  }

  function showToast(message) {
    const el = ensureToastHost();
    el.textContent = String(message || "");
    el.hidden = false;
    el.classList.add("is-visible");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("is-visible");
    }, 2200);
  }

  function normalizeButtonText(btn) {
    return String(btn?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isAiConsultButton(btn) {
    if (!btn) return false;
    if (btn.matches("[data-biz-detail-ai-consult], [data-shop-bind='ctaAiText']")) return true;
    const text = normalizeButtonText(btn);
    return /AIに相談|AI相談/i.test(text);
  }

  function isFavoriteButton(btn) {
    return Boolean(
      btn?.closest?.("[data-biz-detail-favorite], [data-favorite-button], [data-tasu-favorite]")
    );
  }

  function isFieldServiceDetailPage() {
    const detailType = String(global.document?.body?.dataset?.detailType || "").trim();
    if (detailType === "field_service") return true;
    const listing = currentListing || global.__tasuDetailContactListing;
    if (listing && global.TasuBusinessCategories?.isFieldServiceListing?.(listing)) {
      return true;
    }
    return false;
  }

  function isBusinessServiceDetailCtaRegion(btn) {
    return Boolean(
      btn?.closest?.(
        "[data-bsd-cta-actions], [data-biz-detail-sidebar-actions], .bsd-cta-card, [data-biz-detail-sticky-actions], .biz-detail-fv__aside, .bsd-cta-card__actions"
      )
    );
  }

  function isBusinessServiceFlowButton(btn) {
    if (!btn || !(btn instanceof Element)) return false;
    if (btn.matches(BUSINESS_SERVICE_FLOW_BUTTON_SELECTOR)) {
      if (isFieldServiceDetailPage()) return true;
      if (global.TasuBusinessCategories?.isFieldServiceListing?.(currentListing)) return true;
    }
    if (!isFieldServiceDetailPage()) return false;
    if (
      btn.matches(
        "[data-biz-detail-inquiry], [data-biz-detail-estimate], [data-biz-detail-sticky-inquiry], [data-biz-detail-sticky-estimate]"
      ) &&
      isBusinessServiceDetailCtaRegion(btn)
    ) {
      return true;
    }
    if (isBusinessServiceDetailCtaRegion(btn)) {
      const text = normalizeButtonText(btn);
      if (/相談|問い合わせ|見積もり/.test(text)) return true;
    }
    return false;
  }

  function isContactCtaButton(btn) {
    if (!btn || !(btn instanceof Element)) return false;
    if (isFavoriteButton(btn) || isAiConsultButton(btn)) return false;
    if (isJobApplyButton(btn)) return true;
    if (isWorkerRequestButton(btn)) return true;
    if (isConnectFreeFeeGatePrimary(btn)) return true;
    if (isBusinessServiceFlowButton(btn)) return false;
    if (btn.matches(CONTACT_BUTTON_SELECTOR)) return true;
    const text = normalizeButtonText(btn);
    if (!text) return false;
    if (/お気に入り/.test(text)) return false;
    return /相談する|問い合わせる|問い合わせ|お問い合わせ|見積もり相談|参加について相談|見積もりを依頼|チャットで問い合わせ|購入・相談|購入する|購入|Webで問い合わせ|LINEで問い合わせ/i.test(
      text
    );
  }

  function resolveIntent(btn) {
    const text = normalizeButtonText(btn);
    if (/見積もり/.test(text)) return "estimate";
    if (/購入/.test(text)) return "purchase";
    return "consult";
  }

  function isJobDetailPage() {
    return String(global.document?.body?.dataset?.detailType || "").toLowerCase() === "job";
  }

  function isJobApplyButton(btn) {
    if (!btn || !isJobDetailPage()) return false;
    if (btn.matches("[data-listing-primary-cta], [data-job-dock-apply], .hero-apply-btn")) return true;
    const text = normalizeButtonText(btn);
    return /^応募する$/.test(text);
  }

  function isWorkerDetailPage() {
    return String(global.document?.body?.dataset?.detailType || "").toLowerCase() === "worker";
  }

  function isWorkerRequestButton(btn) {
    if (!btn || !isWorkerDetailPage()) return false;
    if (btn.matches("[data-listing-primary-cta]")) return true;
    const text = normalizeButtonText(btn);
    return /^依頼する$/.test(text);
  }

  /** Connectなし fee gate — 見積/依頼 primary（general / business 等の mdetail 隠しCTA含む） */
  function isConnectFreeFeeGatePrimary(btn) {
    if (!btn || !(btn instanceof Element)) return false;
    if (
      !btn.matches(
        "[data-business-service-estimate], [data-biz-detail-estimate], [data-biz-detail-sticky-estimate]"
      )
    ) {
      return false;
    }
    const listing = resolveListingForButton(btn);
    return Boolean(global.TasuPlatformChatFeeGateFlow?.usesConnectFreeFeeGate?.(listing));
  }

  function resolveListingForButton(btn) {
    if (currentListing && pickListingId(currentListing)) {
      return currentListing;
    }

    const listingId = String(
      global.document?.body?.dataset?.listingId ||
        global.document?.body?.dataset?.targetId ||
        new URLSearchParams(global.location.search).get("id") ||
        ""
    ).trim();

    if (!listingId) return null;

    const store = global.TasuListingLocalStore;
    const local = store?.fetchById?.(listingId);
    if (local) {
      const detail = store.toDetailListing?.(local) || local;
      return { ...detail, _localRecord: local };
    }

    return {
      id: listingId,
      title:
        global.document.querySelector("[data-biz-detail-title]")?.textContent?.trim() ||
        global.document.querySelector("[data-listing-title]")?.textContent?.trim() ||
        listingId,
      category: global.document.body?.dataset?.detailType || "",
      listing_type: global.document.body?.dataset?.detailType || "",
    };
  }

  function bindContactButtons() {
    document.querySelectorAll(CONTACT_BUTTON_SELECTOR).forEach((btn) => {
      if (btn.dataset.tasuContactBound === "1") return;
      if (!isContactCtaButton(btn)) return;
      btn.dataset.tasuContactBound = "1";
      if (btn.tagName === "A") {
        const href = btn.getAttribute("href");
        if (href && href !== "#") btn.dataset.tasuContactHref = href;
        btn.setAttribute("href", "#");
      }
      if (btn.tagName === "BUTTON" && !btn.type) btn.type = "button";
      btn.setAttribute("data-tasu-contact-cta", "");
    });
  }

  function tryBenchPartnerUserJobApply(btn) {
    const Embed = global.TasuBuilderBenchEmbed;
    if (!Embed?.isBuilderBenchParent?.()) return null;
    try {
      const params = new URLSearchParams(global.location.search);
      if (params.get("benchEmbed") !== "1") return null;
      if (params.get("builderFlow") !== "partner_user") return null;
      const listing = resolveListingForButton(btn);
      const listingId = pickListingId(listing) || params.get("id");
      if (listingId !== "pub-board-job-001") return null;
      if (!Embed.postGeneralFlowApply?.(listingId)) return null;
      showToast("応募が完了しました。掲載者からの連絡をお待ちください。");
      global.dispatchEvent(
        new CustomEvent("tasu:job-applications-changed", { detail: { listing, bench: true } })
      );
      return { ok: true, mode: "bench_general_flow" };
    } catch {
      return null;
    }
  }

  function startJobApply(btn) {
    const benchResult = tryBenchPartnerUserJobApply(btn);
    if (benchResult?.ok) return benchResult;

    const listing = resolveListingForButton(btn);
    if (!listing || !pickListingId(listing)) {
      console.warn("[TasuContactActions] listing not found for job apply");
      return { ok: false };
    }

    const appStore = global.TasuJobApplicationsStore;
    if (!appStore?.submitApplication) {
      console.warn("[TasuContactActions] TasuJobApplicationsStore not loaded");
      return { ok: false };
    }

    const result = appStore.submitApplication(listing);
    if (!result?.ok) {
      if (result?.reason === "already_applied") showToast("すでに応募済みです");
      else if (result?.reason === "poster_cannot_apply") showToast("掲載者は応募できません");
      else showToast("応募を送信できませんでした");
      return result;
    }

    showToast("応募が完了しました。掲載者からの連絡をお待ちください。");
    global.dispatchEvent(
      new CustomEvent("tasu:job-applications-changed", { detail: { listing } })
    );
    global.TasuJobDetailApplications?.refresh?.(listing);
    try {
      global.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.(
        pickStr(listing.user_id, listing.seller_user_id),
        { immediate: true, force: true, reason: "job_apply_click" }
      );
    } catch {
      /* ignore */
    }
    return result;
  }

  function startConnectEntryPurchase(btn, listing, intent) {
    const Entry = global.TasuPlatformChatConnectEntryFlow;
    const resolvedListing = listing || resolveListingForButton(btn);
    if (!resolvedListing || !pickListingId(resolvedListing)) {
      console.warn("[TasuContactActions] listing not found for connect entry");
      return { ok: false };
    }
    if (!Entry?.submitConnectEntry) {
      console.warn("[TasuContactActions] TasuPlatformChatConnectEntryFlow not loaded");
      return { ok: false };
    }

    const params = new URLSearchParams(global.location.search);
    const result = Entry.submitConnectEntry(resolvedListing, {
      intent: /依頼/.test(normalizeButtonText(btn)) ? "purchase" : intent,
      productId: params.get("product_id") || params.get("productId") || "",
      productName: params.get("subject") || "",
    });

    if (!result?.ok) {
      const reason = pickStr(result?.reason);
      if (reason === "already_submitted" || reason === "already_requested") {
        showToast("すでに送信済みです");
      } else if (reason === "owner_cannot_contact" || reason === "owner_cannot_request") {
        showToast("送信できません");
      } else if (reason === "missing_listing_amount") {
        showToast("商品価格が設定されていません");
      } else {
        showToast("決済を開始できませんでした");
      }
      return result;
    }

    showToast("決済画面へ移動します");
    if (result.payUrl) {
      global.setTimeout(() => {
        const navigated =
          global.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate?.(result.payUrl) === true;
        if (!navigated) {
          global.location.href = result.payUrl;
        }
      }, 280);
    }
    return result;
  }

  function startConnectFreeFeeGate(btn) {
    const Gate = global.TasuPlatformChatFeeGateFlow;
    const listing = resolveListingForButton(btn);
    if (!listing || !pickListingId(listing)) {
      console.warn("[TasuContactActions] listing not found for fee gate");
      return { ok: false };
    }
    if (!Gate?.submitConnectFreeContact) {
      console.warn("[TasuContactActions] TasuPlatformChatFeeGateFlow not loaded");
      return { ok: false };
    }

    const intent = resolveIntent(btn);
    const params = new URLSearchParams(global.location.search);
    const result = Gate.submitConnectFreeContact(listing, {
      intent,
      productId: params.get("product_id") || params.get("productId") || "",
      productName: params.get("subject") || "",
    });

    if (!result?.ok) {
      const reason = pickStr(result?.reason);
      if (reason === Gate.alreadySubmittedReason?.(listing) || reason === "already_requested") {
        showToast(Gate.alreadySubmittedToast?.(listing) || "すでに送信済みです");
      } else if (reason === "owner_cannot_request" || reason === "owner_cannot_contact") {
        showToast(Gate.ownerCannotSubmitToast?.(listing) || "送信できません");
      } else {
        showToast("送信できませんでした");
      }
      return result;
    }

    showToast(Gate.buyerSubmittedToast?.(listing, intent) || "送信しました");
    return result;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function startContact(btn) {
    if (isJobApplyButton(btn)) return startJobApply(btn);

    const store = getStore();
    if (!store) {
      console.warn("[TasuContactActions] TasuChatThreadStore not loaded");
      return { ok: false };
    }

    const listing = resolveListingForButton(btn);
    if (!listing || !pickListingId(listing)) {
      console.warn("[TasuContactActions] listing not found for contact CTA");
      return { ok: false };
    }

    const intent = resolveIntent(btn);
    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "";
    if (
      Category?.isConnectRequiredCategory?.(cat) &&
      Category?.isConnectRequiredRequestIntent?.(intent) &&
      Category?.shouldAllowConnectRequiredRequest?.(listing) !== true
    ) {
      showToast(Category.getConnectRequiredSetupMessage?.(cat) || "決済設定が必要です");
      return { ok: false, reason: "connect_required" };
    }

    const Entry = global.TasuPlatformChatConnectEntryFlow;
    const purchaseIntent =
      intent === "purchase" ||
      isWorkerRequestButton(btn) ||
      /購入|依頼する|依頼/.test(normalizeButtonText(btn));
    const connectEntryIntent =
      purchaseIntent || (cat === "skill" && intent === "estimate");
    if (Entry?.usesConnectEntryPayment?.(listing) && connectEntryIntent) {
      return startConnectEntryPurchase(btn, listing, intent);
    }

    const Gate = global.TasuPlatformChatFeeGateFlow;
    if (Gate?.usesConnectFreeFeeGate?.(listing)) {
      return startConnectFreeFeeGate(btn);
    }

    const result = store.createOrOpenThread(listing, {
      intent,
      feePending: false,
    });
    if (!result?.ok || !result.thread) return result;

    if (result.created) showToast("相談スレッドを作成しました");
    else showToast("既存の相談スレッドを開きます");

    try {
      if (result.created && notify && fee?.shouldNotifyOnCompletion?.(listing)) {
        /* Connect利用時はチャット開始通知なし */
      } else if (result.created && notify) {
        if (notify.isJobListing?.(listing)) {
          /* 求人応募は startJobApply 経由。相談のみチャット作成 */
        } else if (notify.isShopListing?.(listing)) {
          /* shop 問い合わせは上で出品者通知のみ返却 */
        }
      }
    } catch (err) {
      console.warn("[TasuContactActions] TALK notify skipped:", err);
    }

    global.setTimeout(() => {
      global.location.href = store.chatListUrl(result.thread.id);
    }, 280);

    return result;
  }

  function onContactButtonClick(event) {
    const btn = event.target?.closest?.(
      `${CONTACT_BUTTON_SELECTOR}, a, button, [role="button"]`
    );
    if (!btn || !isContactCtaButton(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (btn.disabled) return;
    btn.disabled = true;
    try {
      startContact(btn);
    } finally {
      global.setTimeout(() => {
        btn.disabled = false;
      }, 600);
    }
  }

  function mountForListing(listing) {
    if (!listing || typeof listing !== "object") return;
    currentListing = listing;
    global.__tasuDetailContactListing = listing;
    const listingId = pickListingId(listing);
    if (listingId) {
      global.document.body.dataset.listingId = listingId;
      global.document.body.dataset.targetId = listingId;
    }
    bindContactButtons();
  }

  function onListingApplied(event) {
    const listing = event?.detail?.listing;
    if (listing) mountForListing(listing);
  }

  const BENCH_PRIMARY_CTA_SELECTORS = [
    ".shop-mobile-inquiry-dock__btn",
    "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    "[data-listing-primary-cta]",
    ".skill-cta-panel__primary.cta-consult",
    "[data-biz-detail-inquiry]",
  ];

  function focusBenchPrimaryCta() {
    for (const sel of BENCH_PRIMARY_CTA_SELECTORS) {
      const el = global.document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      try {
        el.scrollIntoView({ block: "center", behavior: "instant" });
      } catch {
        el.scrollIntoView(true);
      }
      return el;
    }
    return null;
  }

  function applyBenchEmbedDetailChrome() {
    try {
      const params = new URLSearchParams(global.location.search);
      if (params.get("benchEmbed") !== "1") return;
      const body = global.document.body;
      if (!body) return;
      body.dataset.benchEmbed = "1";
      const benchViewport = String(params.get("benchViewport") || "").trim();
      if (benchViewport) body.dataset.benchViewport = benchViewport;
      if (!global.document.getElementById("platform-chat-bench-embed-css")) {
        const link = global.document.createElement("link");
        link.id = "platform-chat-bench-embed-css";
        link.rel = "stylesheet";
        link.href = "platform-chat-bench-embed.css";
        global.document.head.appendChild(link);
      }
      global.requestAnimationFrame(() => focusBenchPrimaryCta());
      global.setTimeout(focusBenchPrimaryCta, 400);
      global.setTimeout(focusBenchPrimaryCta, 1400);
    } catch {
      /* ignore */
    }
  }

  function init() {
    applyBenchEmbedDetailChrome();
    bindContactButtons();
    if (global.__tasuDetailContactListing) {
      mountForListing(global.__tasuDetailContactListing);
    } else if (global.__tasuDetailFavoriteListing) {
      mountForListing(global.__tasuDetailFavoriteListing);
    }
    global.setTimeout(focusBenchPrimaryCta, 2000);
  }

  global.addEventListener("tasu:listing-applied", onListingApplied);
  document.addEventListener("click", onContactButtonClick, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuContactActions = {
    CONTACT_BUTTON_SELECTOR,
    BUSINESS_SERVICE_FLOW_BUTTON_SELECTOR,
    mountForListing,
    startContact,
    startJobApply,
    isJobApplyButton,
    isContactCtaButton,
    isBusinessServiceFlowButton,
    isFieldServiceDetailPage,
    showToast,
  };
})(typeof window !== "undefined" ? window : globalThis);
