/**
 * 業務サービス — 相談→チャット→支払い案内→完了→TASFUL手数料
 */
(function () {
  "use strict";

  const PLATFORM_FEE_RATE = 0.05;

  function escAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getServiceId(listing) {
    return String(listing?.id || listing?.demo_id || listing?.form_data?.demo_id || "").trim();
  }

  function getProviderUserId(listing) {
    return String(
      listing?.user_id ||
        listing?.seller_user_id ||
        listing?.form_data?.user_id ||
        `provider_${getServiceId(listing)}`
    ).trim();
  }

  function getClientUserId() {
    return (
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getListingTitle(listing) {
    const bs = window.TasuBusinessServiceData?.getBusinessService?.(listing);
    return (
      String(listing?.title || bs?.hero?.service_name || listing?.company_name || "業務サービス").trim() ||
      "業務サービス"
    );
  }

  function chatDetailUrl(roomId, dealId) {
    const u = new URL("chat-detail.html", window.location.href);
    u.searchParams.set("roomId", String(roomId));
    u.searchParams.set("room", String(roomId));
    if (dealId) u.searchParams.set("deal", String(dealId));
    return u.pathname + u.search;
  }

  function feePayUrl(dealId) {
    const u = new URL("service-fee-pay.html", window.location.href);
    u.searchParams.set("deal", String(dealId));
    return u.pathname + u.search;
  }

  async function startConsultation(listing, options) {
    const serviceId = getServiceId(listing);
    if (!serviceId) throw new Error("掲載IDがありません");

    const intent = String(options?.intent || "consult").trim();
    const Category = window.TasuPlatformChatCategoryFlow;
    const cat = window.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || "business_service";
    if (
      Category?.isConnectRequiredCategory?.(cat) &&
      Category?.isConnectRequiredRequestIntent?.(intent) &&
      Category?.shouldAllowConnectRequiredRequest?.(listing) !== true
    ) {
      throw new Error(
        Category.getConnectRequiredSetupMessage?.(cat) ||
          "このカテゴリは決済設定が必要です。出品者の決済設定が完了すると、購入できます。"
      );
    }

    const fee = window.TasuPlatformChatFee;
    if (fee?.shouldGateChatStart?.(listing)) {
      const store = window.TasuChatThreadStore;
      const local = store?.createOrOpenThread?.(listing, { intent });
      if (!local?.ok || !local.thread) throw new Error("相談の準備に失敗しました");
      if (!fee.isFeePaid(local.thread.id)) {
        fee.ensurePendingFee(listing, local.thread, {});
        try {
          window.TasuTalkPlatformNotify?.notifyBusinessInquiry?.({
            listing,
            thread: local.thread,
            intent: options?.intent,
          });
        } catch (err) {
          console.warn("[BusinessServiceFlow] seller notify skipped:", err);
        }
        window.location.href = `chat-detail.html?thread=${encodeURIComponent(local.thread.id)}`;
        return { thread: local.thread, feePending: true };
      }
    }

    const clientId = getClientUserId();
    const providerId = getProviderUserId(listing);

    let deal = await window.TasuServiceDealsDb?.findOpenDeal?.(serviceId, clientId);
    if (!deal) {
      const snapshot =
        window.TasuBusinessServicePayment?.snapshotForDeal?.(listing) || {};
      deal = await window.TasuServiceDealsDb.insertDeal({
        service_id: serviceId,
        listing_type: "business",
        client_user_id: clientId,
        provider_user_id: providerId,
        status: "consulting",
        platform_fee_rate: PLATFORM_FEE_RATE,
        payment_method_snapshot: snapshot,
      });
    }

    const room = await window.TasuChatSupabase?.createBusinessConsultRoomViaEnsure?.({
      listing,
      deal,
      intent,
    }) || await window.TasuChatSupabase?.createBusinessConsultRoom?.({
      listing,
      deal,
      intent,
    });

    if (!room?.id) throw new Error("チャットルームを作成できませんでした");

    if (deal.id && deal.chat_id !== room.id) {
      deal = await window.TasuServiceDealsDb.updateDeal(deal.id, {
        chat_id: room.id,
        status: deal.status === "consulting" ? "consulting" : deal.status,
      });
    }

    const intro =
      intent === "estimate"
        ? "見積もりを依頼します。内容を確認のうえ、ご返信をお願いします。"
        : "業務について相談したいです。よろしくお願いします。";

    try {
      await window.TasuChatService?.saveMessage?.(
        room.id,
        { text: intro, senderId: clientId },
        room.row || room
      );
    } catch (err) {
      console.warn("[BusinessServiceFlow] intro message skipped:", err);
    }

    if (!fee?.shouldNotifyOnCompletion?.(listing)) {
      try {
        window.TasuTalkPlatformNotify?.notifyBusinessInquiry?.({
          listing,
          room,
          deal,
          intent,
          serviceId,
        });
      } catch (err) {
        console.warn("[BusinessServiceFlow] TALK notify skipped:", err);
      }
    }

    window.location.href = chatDetailUrl(room.id, deal?.id);
    return { deal, room };
  }

  async function completeDeal(dealId, agreedAmount) {
    const deal = await window.TasuServiceDealsDb.fetchDealById(dealId);
    if (!deal) throw new Error("取引が見つかりません");

    const amount = Math.max(0, Math.round(Number(agreedAmount) || 0));
    if (amount < 1) throw new Error("成約金額を入力してください");

    const fees = window.TasuServiceDealsDb.calcFee(
      amount,
      deal.platform_fee_rate ?? PLATFORM_FEE_RATE
    );

    const updated = await window.TasuServiceDealsDb.updateDeal(dealId, {
      status: "fee_pending",
      agreed_amount: fees.agreed_amount,
      platform_fee_amount: fees.platform_fee_amount,
      platform_fee_rate: fees.platform_fee_rate,
      completed_at: new Date().toISOString(),
    });

    const chatId = String(updated?.chat_id || deal.chat_id || "").trim();
    if (chatId && window.TasuChatService?.completeTransaction) {
      try {
        await window.TasuChatService.completeTransaction(chatId, null);
      } catch (err) {
        console.warn("[BusinessServiceFlow] chat room complete skipped:", err);
      }
    }

    return updated;
  }

  function bindConsultButtons(listing) {
    const serviceId = getServiceId(listing);
    if (!serviceId) return;

    window.__tasuBusinessServiceFlowListing = listing;

    const onConsult = (ev, intent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const btn = ev.currentTarget;
      if (btn?.disabled) return;
      if (btn) btn.disabled = true;
      startConsultation(listing, { intent })
        .catch((err) => {
          alert(err.message || "チャットを開始できませんでした");
          if (btn) btn.disabled = false;
        });
    };

    const selectors = [
      "[data-business-service-consult]",
      "[data-business-service-estimate]",
      "[data-business-service-chat]",
      "[data-biz-detail-inquiry]",
      "[data-biz-detail-estimate]",
      "[data-biz-detail-sticky-inquiry]",
      "[data-biz-detail-sticky-estimate]",
    ];

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.dataset.bsfBound) return;
        el.dataset.bsfBound = "1";
        el.dataset.bsfRoute = "1";
        if (el.tagName === "A") {
          const href = el.getAttribute("href");
          if (href && href !== "#") el.dataset.bsfOriginalHref = href;
          el.setAttribute("href", "#");
        }
        if (el.tagName === "BUTTON" && !el.type) el.type = "button";
        const intent = el.matches(
          "[data-business-service-estimate], [data-biz-detail-estimate], [data-biz-detail-sticky-estimate]"
        )
          ? "estimate"
          : "consult";
        el.addEventListener("click", (ev) => onConsult(ev, intent));
      });
    });
  }

  function isFieldServiceDetailPage() {
    const detailType = String(document.body?.dataset?.detailType || "").trim();
    return detailType === "field_service";
  }

  function patchDetailAnchors(listing) {
    if (!window.TasuBusinessDetail) return;
    const origInquiry = window.TasuBusinessDetail.getDetailInquiryAnchor;
    if (origInquiry && !origInquiry._bsfPatched) {
      window.TasuBusinessDetail.getDetailInquiryAnchor = function (l) {
        if (window.TasuBusinessCategories?.isFieldServiceListing?.(l)) {
          return "#";
        }
        return origInquiry(l);
      };
      window.TasuBusinessDetail.getDetailInquiryAnchor._bsfPatched = true;
    }
  }

  function initDetailPage(listing) {
    patchDetailAnchors(listing);
    window.TasuBusinessServicePayment?.renderDetailSection?.(listing);
    bindConsultButtons(listing);
    fixLegacyChatLinks(listing);
  }

  function fixLegacyChatLinks(listing) {
    const serviceId = getServiceId(listing);
    document.querySelectorAll('a[href*="chat.html"]').forEach((a) => {
      if (a.dataset.bsfLinkFixed) return;
      a.dataset.bsfLinkFixed = "1";
      a.setAttribute("href", "#");
      a.setAttribute("data-business-service-consult", "");
    });
    document.querySelectorAll("[data-biz-detail-sticky-inquiry]").forEach((a) => {
      a.setAttribute("data-business-service-consult", "");
      a.setAttribute("href", "#");
    });
    document.querySelectorAll("[data-biz-detail-sticky-estimate]").forEach((a) => {
      a.setAttribute("data-business-service-estimate", "");
      a.setAttribute("href", "#");
    });
  }

  window.TasuBusinessServiceFlow = {
    PLATFORM_FEE_RATE,
    getServiceId,
    chatDetailUrl,
    feePayUrl,
    startConsultation,
    completeDeal,
    bindConsultButtons,
    initDetailPage,
    isFieldServiceDetailPage,
  };
})();
