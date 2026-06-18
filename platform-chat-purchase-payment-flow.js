/**
 * product / shop — 支払い方式別フロー（prepaid / bank_transfer / cash_on_delivery）
 */
(function (global) {
  "use strict";

  const PAYMENT_METHODS = Object.freeze({
    PREPAID: "prepaid",
    BANK_TRANSFER: "bank_transfer",
    CASH_ON_DELIVERY: "cash_on_delivery",
  });

  const Category = () => global.TasuPlatformChatCategoryFlow;
  const Completion = () => global.TasuPlatformChatCompletionFlow;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveCategoryKey(thread) {
    return Category()?.resolveCategoryKey?.(thread) || "";
  }

  function appliesToThread(thread) {
    if (thread?.connectEntryPayment === true) return false;
    if (global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryThread?.(thread) === true) {
      return false;
    }
    return Category()?.isProductPurchaseFlowEnabled?.(thread) === true;
  }

  function getPaymentMethod(thread) {
    const raw = pickStr(thread?.paymentMethod, thread?.payment_method).toLowerCase();
    if (raw === PAYMENT_METHODS.BANK_TRANSFER) return PAYMENT_METHODS.BANK_TRANSFER;
    if (raw === PAYMENT_METHODS.CASH_ON_DELIVERY) return PAYMENT_METHODS.CASH_ON_DELIVERY;
    return PAYMENT_METHODS.PREPAID;
  }

  function getSellerId(thread) {
    return Category()?.getSellerId?.(thread) || pickStr(thread?.sellerId);
  }

  function getBuyerId(thread) {
    return Category()?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
  }

  function isSeller(thread, userId) {
    const me = pickStr(userId);
    return Boolean(me && me === getSellerId(thread));
  }

  function isBuyer(thread, userId) {
    const me = pickStr(userId);
    return Boolean(me && me === getBuyerId(thread));
  }

  function isCompleted(thread) {
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    return rs === "completed" || Boolean(thread?.completed);
  }

  function isCompletionFeePaid(thread) {
    if (!shouldQueuePurchaseCompletionFee(thread)) return true;
    return getPurchaseCompletionFeeState(thread).paid === true;
  }

  function isReadyForReview(thread, userId) {
    if (!appliesToThread(thread) || !isCompleted(thread)) return false;
    if (!shouldQueuePurchaseCompletionFee(thread)) return true;
    if (isBuyer(thread, userId)) return true;
    if (isSeller(thread, userId)) return isCompletionFeePaid(thread);
    return false;
  }

  function isProductShipped(thread) {
    return Boolean(thread?.productShipped || thread?.product_shipped);
  }

  function isProductReceived(thread) {
    return Boolean(thread?.productReceived || thread?.product_received);
  }

  function isShippingReady(thread) {
    return Boolean(thread?.shippingReady || thread?.shipping_ready);
  }

  function isBankTransferReported(thread) {
    return Boolean(thread?.bankTransferReported || thread?.bank_transfer_reported);
  }

  function isPaymentConfirmed(thread) {
    return Boolean(thread?.paymentConfirmed || thread?.payment_confirmed);
  }

  function isCodPaymentReported(thread) {
    return Boolean(thread?.codPaymentReported || thread?.cod_payment_reported);
  }

  function isCashOnDeliveryConfirmed(thread) {
    return Boolean(thread?.cashOnDeliveryConfirmed || thread?.cash_on_delivery_confirmed);
  }

  function getCompletionStatus(thread) {
    return Completion()?.getCompletionStatus?.(thread) || "active";
  }

  function readThread(threadId) {
    return Completion()?.readThread?.(threadId) || null;
  }

  function patchThread(threadId, patch) {
    return Completion()?.patchThread?.(threadId, patch) || null;
  }

  function appendSystemMessage(threadId, text) {
    return Completion()?.appendSystemMessage?.(threadId, text);
  }

  function getLabels(thread) {
    return Completion()?.getLabels?.(thread) || {};
  }

  function getCopy(thread) {
    const spec = Category()?.getCategorySpec?.(thread) || {};
    const method = getPaymentMethod(thread);
    return {
      shipBtn: pickStr(spec.sellerCompleteBtn, "商品を発送しました"),
      shipModalTitle: pickStr(spec.sellerModalTitle, spec.sellerCompleteBtn, "発送完了"),
      shipFormTitle: pickStr(spec.shipFormTitle, "発送情報の入力"),
      shipConfirmSubmitBtn: pickStr(spec.shipConfirmSubmitBtn, "発送を確定する"),
      shipConfirmBody: pickStr(spec.sellerConfirmBody, "商品の発送が完了したことを相手に通知します。"),
      receiveBtn: pickStr(spec.receiveBtn, spec.completeBtn, "商品を受け取りました"),
      receiveModalTitle: pickStr(spec.receiveModalTitle, spec.modalTitle, "受取確認"),
      receiveConfirmBody: pickStr(
        spec.receiveConfirmBody,
        spec.confirmBody,
        "商品の受取を確認し、取引を完了します。"
      ),
      shippingReadyBtn: pickStr(spec.shippingReadyBtn, "発送準備完了"),
      shippingReadyConfirmBody: pickStr(
        spec.shippingReadyConfirmBody,
        "発送準備が整いました。購入者へお支払いを依頼します。"
      ),
      bankReportBtn: pickStr(spec.bankReportBtn, "銀行振込が完了しました"),
      bankReportConfirmBody: pickStr(
        spec.bankReportConfirmBody,
        "銀行振込が完了したことを出品者に報告します。"
      ),
      bankReportSystem: pickStr(spec.bankReportSystem, "銀行振込が完了しました。"),
      bankTransferCardTitle: pickStr(spec.bankTransferCardTitle, "振込先のご案内"),
      paymentConfirmBtn: pickStr(spec.paymentConfirmBtn, "入金を確認する"),
      paymentConfirmBody: pickStr(spec.paymentConfirmBody, "入金を確認し、購入者へ通知します。"),
      codReportBtn: pickStr(spec.codReportBtn, "商品受取・支払い完了を報告する"),
      codReportConfirmBody: pickStr(
        spec.codReportConfirmBody,
        "商品の受取と代金支払いが完了したことを報告します。"
      ),
      codConfirmBtn: pickStr(spec.codConfirmBtn, "代引き回収を確認する"),
      codConfirmBody: pickStr(spec.codConfirmBody, "代引きの回収を確認し、取引を完了します。"),
      shipSystem: pickStr(spec.shipSystem, "商品を発送しました"),
      receiveSystem: pickStr(spec.receiveSystem, "商品の受取を確認しました"),
      doneSystem: pickStr(spec.doneSystem, "取引が完了しました"),
      method,
    };
  }

  function getPrimaryActionMode(thread, userId) {
    if (!appliesToThread(thread) || isCompleted(thread)) return "";
    const method = getPaymentMethod(thread);
    const status = getCompletionStatus(thread);
    if (status !== "active") return "";

    if (method === PAYMENT_METHODS.PREPAID) {
      if (isSeller(thread, userId) && !isProductShipped(thread)) return "ship";
      if (isBuyer(thread, userId) && isProductShipped(thread) && !isProductReceived(thread)) {
        return "purchase_receive";
      }
      return "";
    }

    if (method === PAYMENT_METHODS.BANK_TRANSFER) {
      if (isSeller(thread, userId)) {
        if (isBankTransferReported(thread) && !isPaymentConfirmed(thread)) {
          return "purchase_payment_confirm";
        }
        if (isPaymentConfirmed(thread) && !isProductShipped(thread)) return "ship";
        return "";
      }
      if (isBuyer(thread, userId)) {
        if (!isBankTransferReported(thread)) return "purchase_bank_report";
        if (isProductShipped(thread) && !isProductReceived(thread)) return "purchase_receive";
      }
      return "";
    }

    if (method === PAYMENT_METHODS.CASH_ON_DELIVERY) {
      if (isSeller(thread, userId)) {
        if (!isProductShipped(thread)) return "ship";
        return "";
      }
      if (isBuyer(thread, userId) && isProductShipped(thread) && !isProductReceived(thread)) {
        return "purchase_receive";
      }
      return "";
    }

    return "";
  }

  function getPrimaryActionLabel(thread, userId) {
    const mode = getPrimaryActionMode(thread, userId);
    const copy = getCopy(thread);
    if (mode === "ship") return copy.shipBtn;
    if (mode === "purchase_receive") return copy.receiveBtn;
    if (mode === "purchase_shipping_ready") return copy.shippingReadyBtn;
    if (mode === "purchase_bank_report") return copy.bankReportBtn;
    if (mode === "purchase_payment_confirm") return copy.paymentConfirmBtn;
    if (mode === "purchase_cod_report") return copy.codReportBtn;
    if (mode === "purchase_cod_confirm") return copy.codConfirmBtn;
    return "";
  }

  function getStatusNotice(thread, userId) {
    if (!appliesToThread(thread) || isCompleted(thread)) return "";
    const method = getPaymentMethod(thread);
    const spec = Category()?.getCategorySpec?.(thread) || {};

    if (method === PAYMENT_METHODS.PREPAID) {
      if (isSeller(thread, userId) && isProductShipped(thread) && !isProductReceived(thread)) {
        return pickStr(spec.shipWaitingNoticeSeller, "商品を発送しました。購入者の受取確認をお待ちください。");
      }
      if (isBuyer(thread, userId) && !isProductShipped(thread)) {
        return pickStr(spec.prepaidWaitingShipBuyer, "出品者の発送をお待ちください。");
      }
      if (isBuyer(thread, userId) && isProductShipped(thread) && !isProductReceived(thread)) {
        return pickStr(
          spec.shipReceivePromptBuyer,
          "商品が発送されました。到着後に受取確認を行ってください。"
        );
      }
      return "";
    }

    if (method === PAYMENT_METHODS.BANK_TRANSFER) {
      if (isSeller(thread, userId)) {
        if (!isBankTransferReported(thread)) {
          return pickStr(spec.bankWaitingTransferSeller, "購入者の振込をお待ちください。");
        }
        if (!isPaymentConfirmed(thread)) {
          return pickStr(spec.bankConfirmPaymentSeller, "購入者から振込完了報告が届きました。入金を確認してください。");
        }
        if (!isProductShipped(thread)) {
          return pickStr(spec.bankReadyToShipSeller, "入金を確認しました。商品を発送してください。");
        }
        if (!isProductReceived(thread)) {
          return pickStr(spec.shipWaitingNoticeSeller, "商品を発送しました。購入者の受取確認をお待ちください。");
        }
      }
      if (isBuyer(thread, userId)) {
        if (!isBankTransferReported(thread)) {
          return pickStr(spec.bankPayRequestBuyer, "銀行振込を完了してください。");
        }
        if (!isPaymentConfirmed(thread)) {
          return pickStr(spec.bankWaitingConfirmBuyer, "出品者の入金確認をお待ちください。");
        }
        if (!isProductShipped(thread)) {
          return pickStr(spec.bankWaitingShipBuyer, "入金確認が完了しました。商品の発送をお待ちください。");
        }
        if (!isProductReceived(thread)) {
          return pickStr(
            spec.shipReceivePromptBuyer,
            "商品が発送されました。到着後に受取確認を行ってください。"
          );
        }
      }
      return "";
    }

    if (method === PAYMENT_METHODS.CASH_ON_DELIVERY) {
      if (isSeller(thread, userId)) {
        if (isProductShipped(thread) && !isProductReceived(thread)) {
          return pickStr(spec.shipWaitingNoticeSeller, "商品を発送しました。購入者の受取確認をお待ちください。");
        }
      }
      if (isBuyer(thread, userId)) {
        if (!isProductShipped(thread)) {
          return pickStr(spec.codWaitingShipBuyer, "出品者の発送をお待ちください。");
        }
        if (!isProductReceived(thread)) {
          return pickStr(
            spec.codShippedBuyer,
            spec.shipReceivePromptBuyer,
            "商品が発送されました。到着後に受取確認を行ってください。"
          );
        }
      }
    }
    return "";
  }

  function canMarkProductShipped(thread, userId) {
    if (!appliesToThread(thread) || isProductShipped(thread)) return false;
    if (!isSeller(thread, userId) || getCompletionStatus(thread) !== "active") return false;
    const method = getPaymentMethod(thread);
    if (method === PAYMENT_METHODS.BANK_TRANSFER && !isPaymentConfirmed(thread)) return false;
    return getPrimaryActionMode(thread, userId) === "ship";
  }

  const PURCHASE_COMPLETION_FEE_CARD_KIND = "purchase_completion_fee_card";

  function shouldQueuePurchaseCompletionFee(thread) {
    if (!appliesToThread(thread)) return false;
    if (thread?.connectEntryPayment === true) return false;
    const listing = {
      id: thread?.listingId,
      listing_type: thread?.listingType,
      listingType: thread?.listingType,
    };
    return Category()?.isCategoryConnectEnabled?.(listing) === true;
  }

  function resolvePurchaseCompletionFeeBaseAmount(thread) {
    const gross = Math.round(
      Number(
        thread?.connectEntryAmount ||
          global.TasuPlatformChatConnectEntryFlow?.resolveListingAmountYen?.({
            id: thread?.listingId,
            listing_type: thread?.listingType,
            price_amount: thread?.connectEntryAmount,
          }) ||
          global.TasuPlatformChatFee?.extractListingAmount?.({
            id: thread?.listingId,
            listing_type: thread?.listingType,
          })
      ) || 0
    );
    return gross > 0 ? gross : global.TasuPlatformChatFee?.MIN_FEE_YEN || 550;
  }

  function getPurchaseCompletionFeeState(thread) {
    const Fee = global.TasuPlatformChatFee;
    const threadId = pickStr(thread?.id);
    const row = Fee?.getFeeRecord?.(threadId);
    if (!row || pickStr(row.feePhase) !== "on_complete") {
      return { pending: false, paid: false, amount: 0, payUrl: "" };
    }
    const paid = pickStr(row.status).toLowerCase() === "paid";
    const amount = Math.round(Number(row.feeAmount) || 0);
    const payUrl =
      Fee?.buildCompletionFeePayUrl?.({
        threadId,
        listingId: pickStr(thread?.listingId),
        category: resolveCategoryKey(thread),
        feeAmount: amount,
      }) || "";
    return { pending: !paid, paid, amount, payUrl, row };
  }

  function queuePurchaseCompletionFee(thread, threadId) {
    const Fee = global.TasuPlatformChatFee;
    const id = pickStr(threadId, thread?.id);
    if (!id || !Fee?.ensurePendingCompletionFee) return { ok: false };
    const amountBase = resolvePurchaseCompletionFeeBaseAmount(thread);
    const feeAmount = Fee.calcCompletionFee(amountBase);
    const row = Fee.ensurePendingCompletionFee({
      threadId: id,
      listingId: pickStr(thread?.listingId),
      listingTitle: pickStr(thread?.listingTitle),
      category: resolveCategoryKey(thread),
      feeAmount,
      agreedAmount: amountBase,
    });
    return { ok: true, feeAmount, row };
  }

  function appendPurchaseCompletionFeeCard(threadId, thread) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return { ok: false };
    const id = pickStr(threadId, thread?.id);
    const fee = getPurchaseCompletionFeeState(thread);
    if (!fee.pending) return { ok: false, reason: "fee_not_pending" };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? [...map[id]] : [];
      if (list.some((m) => m.kind === PURCHASE_COMPLETION_FEE_CARD_KIND)) {
        return { ok: true, skipped: true };
      }
      list.push({
        id: `msg-${id}-purchase-completion-fee-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: new Date().toISOString(),
        kind: PURCHASE_COMPLETION_FEE_CARD_KIND,
        purchaseCompletionFee: {
          amount: fee.amount,
          payUrl: fee.payUrl,
        },
      });
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap({ [id]: list });
      } else {
        map[id] = list;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  function renderPurchaseCompletionFeeCardHtml(message, thread, userId) {
    const me = pickStr(userId);
    const sellerId = getSellerId(thread);
    if (!me || me !== sellerId) return "";
    const fee = getPurchaseCompletionFeeState(thread);
    if (fee.paid) {
      return (
        `<div class="chat-completion-card-wrap chat-completion-card-wrap--fee-paid" data-purchase-completion-fee-card>` +
        `<p class="chat-completion-card__status chat-completion-card__status--paid chat-completion-card__status--subdued">手数料支払い済み（¥${fee.amount.toLocaleString("ja-JP")}）</p>` +
        `</div>`
      );
    }
    if (!fee.pending || !fee.payUrl) return "";
    return (
      `<div class="chat-completion-card-wrap" data-purchase-completion-fee-card>` +
      `<article class="chat-completion-card chat-completion-card--purchase-fee" aria-label="取引完了手数料">` +
      `<div class="chat-completion-card__fee" data-platform-completion-fee>` +
      `<p class="chat-completion-card__fee-label">取引完了手数料をお支払いください</p>` +
      `<p class="chat-completion-card__fee-amount">¥${fee.amount.toLocaleString("ja-JP")}</p>` +
      `<a class="chat-completion-card__btn chat-completion-card__btn--fee" href="${escHtml(fee.payUrl)}" data-platform-completion-fee-pay>手数料を支払う</a>` +
      `</div>` +
      `</article>` +
      `</div>`
    );
  }

  function finalizePurchaseComplete({ thread, threadId, actorId }) {
    const now = new Date().toISOString();
    const updated = patchThread(threadId, {
      roomStatus: "completed",
      status: "completed",
      completed: true,
      completedAt: now,
      completionApprovedBy: pickStr(actorId),
      completionApprovedAt: now,
    });
    const room = updated || thread;
    appendSystemMessage(threadId, getCopy(room).doneSystem);
    try {
      Category()?.appendPlatformCompletionCard?.(threadId, room);
    } catch {
      /* ignore */
    }
    if (shouldQueuePurchaseCompletionFee(room)) {
      try {
        queuePurchaseCompletionFee(room, threadId);
        appendPurchaseCompletionFeeCard(threadId, room);
      } catch {
        /* ignore */
      }
    }
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoPurchaseCompleted?.({
        thread: room,
        threadId,
        actorId: pickStr(actorId),
      });
    } catch {
      /* ignore */
    }
    if (shouldQueuePurchaseCompletionFee(room)) {
      try {
        global.TasuPlatformChatDualWindowNotify?.notifyDemoPurchaseCompletionFeeRequired?.({
          thread: room,
          threadId,
        });
      } catch {
        /* ignore */
      }
    }
    return { ok: true, thread: room };
  }

  function markShippingReady({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_shipping_ready") {
      return { ok: false, reason: "発送準備完了にできません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, { shippingReady: true, shippingReadyAt: now });
    const updatedRoom = updated || room;
    appendSystemMessage(id, "発送準備が整いました。購入者へお支払いを依頼します。");
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoShippingReady?.({
        thread: updatedRoom,
        threadId: id,
        sellerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    return { ok: true, thread: updatedRoom };
  }

  function reportBankTransfer({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_bank_report") {
      return { ok: false, reason: "振込完了を報告できません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, { bankTransferReported: true, bankTransferReportedAt: now });
    const updatedRoom = updated || room;
    appendSystemMessage(id, getCopy(updatedRoom).bankReportSystem || "銀行振込が完了しました。");
    try {
      appendPurchaseBankDepositConfirmCard(id, updatedRoom);
    } catch {
      /* ignore */
    }
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoBankTransferReported?.({
        thread: updatedRoom,
        threadId: id,
        buyerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    return { ok: true, thread: updatedRoom };
  }

  function confirmBankPayment({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_payment_confirm") {
      return { ok: false, reason: "入金を確認できません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, { paymentConfirmed: true, paymentConfirmedAt: now });
    const updatedRoom = updated || room;
    appendSystemMessage(id, "入金を確認しました。");
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoPaymentConfirmed?.({
        thread: updatedRoom,
        threadId: id,
        sellerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    return { ok: true, thread: updatedRoom };
  }

  function markProductReceived({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_receive") {
      return { ok: false, reason: "受取確認できません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, {
      productReceived: true,
      productReceivedAt: now,
    });
    const updatedRoom = updated || room;
    appendSystemMessage(id, getCopy(updatedRoom).receiveSystem);
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoProductReceived?.({
        thread: updatedRoom,
        threadId: id,
        buyerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    return finalizePurchaseComplete({
      thread: updatedRoom,
      threadId: id,
      actorId: pickStr(userId),
    });
  }

  function reportCodPayment({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_cod_report") {
      return { ok: false, reason: "受取・支払いを報告できません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, { codPaymentReported: true, codPaymentReportedAt: now });
    const updatedRoom = updated || room;
    appendSystemMessage(id, "商品の受取と代金支払いを報告しました。");
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoCodPaymentReported?.({
        thread: updatedRoom,
        threadId: id,
        buyerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    return { ok: true, thread: updatedRoom };
  }

  function confirmCodCollection({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!room) return { ok: false, reason: "チャットが見つかりません" };
    if (getPrimaryActionMode(room, userId) !== "purchase_cod_confirm") {
      return { ok: false, reason: "代引き回収を確認できません" };
    }
    const now = new Date().toISOString();
    const updated = patchThread(id, {
      cashOnDeliveryConfirmed: true,
      cashOnDeliveryConfirmedAt: now,
    });
    if (!updated) return { ok: false, reason: "thread_store_write_failed" };
    const updatedRoom = updated;
    appendSystemMessage(id, "代引き回収を確認しました。");
    try {
      global.TasuPlatformChatDualWindowNotify?.notifyDemoCodConfirmed?.({
        thread: updatedRoom,
        threadId: id,
        sellerId: pickStr(userId),
      });
    } catch {
      /* ignore */
    }
    const result = finalizePurchaseComplete({
      thread: updatedRoom,
      threadId: id,
      actorId: pickStr(userId),
    });
    const persisted = readThread(id);
    const completed =
      persisted?.completed === true ||
      String(persisted?.roomStatus || persisted?.status).toLowerCase() === "completed";
    if (!completed) {
      return { ok: false, reason: "completion_not_persisted", thread: updatedRoom };
    }
    return { ...result, thread: persisted || result?.thread || updatedRoom };
  }

  function readPaymentMethodFromUrlSearch(search) {
    const method = pickStr(new URLSearchParams(String(search || "")).get("paymentMethod")).toLowerCase();
    if (method === PAYMENT_METHODS.BANK_TRANSFER) return PAYMENT_METHODS.BANK_TRANSFER;
    if (method === PAYMENT_METHODS.CASH_ON_DELIVERY) return PAYMENT_METHODS.CASH_ON_DELIVERY;
    if (method === PAYMENT_METHODS.PREPAID) return PAYMENT_METHODS.PREPAID;
    return "";
  }

  function resolvePaymentMethodFromContext(ctx) {
    const raw = pickStr(ctx?.paymentMethod, ctx?.profile?.paymentMethod);
    try {
      const local = readPaymentMethodFromUrlSearch(global.location?.search || "");
      if (local) return local;
      if (global.parent && global.parent !== global) {
        const parent = readPaymentMethodFromUrlSearch(global.parent.location?.search || "");
        if (parent) return parent;
      }
      const stored = raw || pickStr(readThread(pickStr(ctx?.threadId, ctx?.thread?.id))?.paymentMethod);
      if (
        stored === PAYMENT_METHODS.BANK_TRANSFER ||
        stored === PAYMENT_METHODS.CASH_ON_DELIVERY ||
        stored === PAYMENT_METHODS.PREPAID
      ) {
        return stored;
      }
      return PAYMENT_METHODS.PREPAID;
    } catch {
      return raw || PAYMENT_METHODS.PREPAID;
    }
  }

  function syncPaymentMethodFromContext({ threadId, thread } = {}) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!id || !room || !appliesToThread(room)) {
      return { ok: false, reason: "not_applicable", thread: room || null };
    }
    const desired = resolvePaymentMethodFromContext({ threadId: id, thread: room });
    const current = getPaymentMethod(room);
    if (desired === current) {
      return { ok: true, thread: room, skipped: true };
    }
    const patch = createInitialPurchaseThreadFields(desired);
    const updated = patchThread(id, patch);
    const next = updated || { ...room, ...patch };
    return { ok: true, thread: next, changed: true, from: current, to: desired };
  }

  function applyPaymentMethodToThread(thread, paymentMethod) {
    const method = pickStr(paymentMethod, PAYMENT_METHODS.PREPAID).toLowerCase();
    if (!appliesToThread(thread)) return thread;
    return {
      ...thread,
      paymentMethod:
        method === PAYMENT_METHODS.BANK_TRANSFER
          ? PAYMENT_METHODS.BANK_TRANSFER
          : method === PAYMENT_METHODS.CASH_ON_DELIVERY
            ? PAYMENT_METHODS.CASH_ON_DELIVERY
            : PAYMENT_METHODS.PREPAID,
    };
  }

  function createInitialPurchaseThreadFields(paymentMethod) {
    return {
      paymentMethod: pickStr(paymentMethod, PAYMENT_METHODS.PREPAID),
      productShipped: false,
      productShippedAt: "",
      productReceived: false,
      productReceivedAt: "",
      completed: false,
      completedAt: "",
      shippingReady: false,
      shippingReadyAt: "",
      shippingCarrier: "",
      trackingNumber: "",
      bankTransferReported: false,
      bankTransferReportedAt: "",
      paymentConfirmed: false,
      paymentConfirmedAt: "",
      codPaymentReported: false,
      codPaymentReportedAt: "",
      cashOnDeliveryConfirmed: false,
      cashOnDeliveryConfirmedAt: "",
    };
  }

  const PRODUCT_SHIPPING_CARD_KIND = "product_shipping_card";
  const PURCHASE_BANK_TRANSFER_CARD_KIND = "purchase_bank_transfer_card";
  const PURCHASE_BANK_DEPOSIT_CONFIRM_CARD_KIND = "purchase_bank_deposit_confirm_card";

  function fmtYen(amount) {
    try {
      return `${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString("ja-JP")}円`;
    } catch {
      return `${Math.max(0, Math.round(Number(amount) || 0))}円`;
    }
  }

  function resolvePurchaseBankInfo(thread) {
    return (
      global.TasuPlatformChatManualTransferFlow?.resolveBankInfo?.(thread) || {
        holder: "受取人",
        bank: "銀行名",
        branch: "支店名",
        type: "普通",
        number: "0000000",
      }
    );
  }

  function resolvePurchaseTransferAmountYen(thread) {
    const listingId = pickStr(thread?.listingId);
    const listing =
      global.TasuListingContactRequestsStore?.resolveListing?.(listingId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      global.TasuPlatformChatDemoSeed?.resolveListing?.(listingId);
    const raw =
      listing?.price_amount ??
      listing?.priceAmount ??
      listing?.price ??
      thread?.agreedAmount ??
      thread?.agreed_amount ??
      thread?.amountYen ??
      thread?.amount_yen ??
      0;
    const parsed = Math.max(0, Math.round(Number(String(raw).replace(/[^\d]/g, "")) || Number(raw) || 0));
    if (parsed > 0) return parsed;
    return global.TasuPlatformChatManualTransferFlow?.resolveAmountYen?.(thread) || 550;
  }

  function canBuyerReportBankTransfer(thread, userId) {
    if (!appliesToThread(thread) || getPaymentMethod(thread) !== PAYMENT_METHODS.BANK_TRANSFER) {
      return false;
    }
    return (
      isBuyer(thread, userId) &&
      getPrimaryActionMode(thread, userId) === "purchase_bank_report"
    );
  }

  function canSellerConfirmBankPayment(thread, userId) {
    if (!appliesToThread(thread) || getPaymentMethod(thread) !== PAYMENT_METHODS.BANK_TRANSFER) {
      return false;
    }
    return (
      isSeller(thread, userId) &&
      getPrimaryActionMode(thread, userId) === "purchase_payment_confirm"
    );
  }

  function buildPurchaseBankTransferCard(thread) {
    const bank = resolvePurchaseBankInfo(thread);
    const amountYen = resolvePurchaseTransferAmountYen(thread);
    return {
      title: getCopy(thread).bankTransferCardTitle,
      bank: pickStr(bank.bank),
      branch: pickStr(bank.branch),
      type: pickStr(bank.type),
      number: pickStr(bank.number),
      holder: pickStr(bank.holder),
      amountYen,
      amountLabel: fmtYen(amountYen),
    };
  }

  function buildPurchaseBankDepositConfirmCard(thread) {
    const buyerId = getBuyerId(thread);
    const buyerName =
      Completion()?.resolveActorDisplayName?.(buyerId, thread) ||
      Category()?.resolveActorDisplayName?.(buyerId, thread) ||
      pickStr(thread?.buyerName, "購入者");
    const amountYen = resolvePurchaseTransferAmountYen(thread);
    const spec = Category()?.getCategorySpec?.(thread) || {};
    return {
      title: pickStr(spec.bankDepositCardTitle, "入金を確認してください"),
      guide: pickStr(
        spec.bankDepositCardGuide,
        "購入者から銀行振込完了の報告が届きました。入金を確認してください。"
      ),
      buyerName,
      listingTitle: pickStr(thread?.listingTitle, "対象商品"),
      amountYen,
      amountLabel: fmtYen(amountYen),
    };
  }

  function appendPurchaseBankTransferCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!id || !room || !appliesToThread(room)) return { ok: false, reason: "not_applicable" };
    if (getPaymentMethod(room) !== PAYMENT_METHODS.BANK_TRANSFER) {
      return { ok: false, reason: "not_bank_transfer" };
    }
    if (isPaymentConfirmed(room) || isCompleted(room)) {
      return { ok: false, reason: "payment_already_confirmed" };
    }
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      if (list.some((m) => m?.kind === PURCHASE_BANK_TRANSFER_CARD_KIND)) {
        return { ok: true, skipped: true };
      }
      const card = buildPurchaseBankTransferCard(room);
      const now = new Date().toISOString();
      list.push({
        id: `msg-${id}-purchase-bank-transfer-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: now,
        kind: PURCHASE_BANK_TRANSFER_CARD_KIND,
        purchaseBankTransferCard: card,
      });
      map[id] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function renderPurchaseBankTransferCardHtml(message, thread, userId) {
    const room = thread || readThread(message?.roomId || message?.chatId);
    if (!room || getPaymentMethod(room) !== PAYMENT_METHODS.BANK_TRANSFER) return "";

    const card = { ...buildPurchaseBankTransferCard(room), ...(message?.purchaseBankTransferCard || {}) };
    const title = pickStr(card.title, "振込先のご案内");
    const meId = pickStr(userId);
    const threadId = pickStr(room.id, message?.roomId, message?.chatId);
    const reported = isBankTransferReported(room);
    const rows = [
      ["銀行名", pickStr(card.bank)],
      ["支店名", pickStr(card.branch)],
      ["口座種別", pickStr(card.type)],
      ["口座番号", pickStr(card.number)],
      ["口座名義", pickStr(card.holder)],
      ["振込金額", pickStr(card.amountLabel, fmtYen(card.amountYen))],
    ]
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<div class="chat-manual-pay__row"><dt>${escHtml(label)}</dt><dd>${escHtml(value)}</dd></div>`
      )
      .join("");

    const copy = getCopy(room);
    let actionHtml = "";
    if (canBuyerReportBankTransfer(room, meId)) {
      actionHtml =
        `<button type="button" class="chat-manual-pay__btn chat-manual-pay__btn--primary" data-purchase-bank-report data-thread-id="${escHtml(threadId)}">${escHtml(copy.bankReportBtn)}</button>`;
    } else if (isBuyer(room, meId) && reported) {
      actionHtml = `<p class="chat-manual-pay__done" role="status">銀行振込完了を報告しました</p>`;
    } else if (isSeller(room, meId) && !reported) {
      actionHtml = `<p class="chat-manual-pay__hint" role="note">購入者の銀行振込完了報告をお待ちください</p>`;
    }

    return (
      `<div class="chat-manual-pay-wrap" data-platform-bank-transfer-card data-thread-id="${escHtml(threadId)}">` +
      `<article class="chat-manual-pay" aria-label="${escHtml(title)}">` +
      `<h3 class="chat-manual-pay__title">${escHtml(title)}</h3>` +
      `<p class="chat-manual-pay__note">下記の振込先へお支払いのうえ、「${escHtml(copy.bankReportBtn)}」を押してください。</p>` +
      `<dl class="chat-manual-pay__list">${rows}</dl>` +
      (actionHtml ? `<div class="chat-manual-pay__actions">${actionHtml}</div>` : "") +
      `</article>` +
      `</div>`
    );
  }

  function appendPurchaseBankDepositConfirmCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!id || !room || !appliesToThread(room)) return { ok: false, reason: "not_applicable" };
    if (getPaymentMethod(room) !== PAYMENT_METHODS.BANK_TRANSFER) {
      return { ok: false, reason: "not_bank_transfer" };
    }
    if (!isBankTransferReported(room) || isPaymentConfirmed(room) || isCompleted(room)) {
      return { ok: false, reason: "not_ready" };
    }
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      if (list.some((m) => m?.kind === PURCHASE_BANK_DEPOSIT_CONFIRM_CARD_KIND)) {
        return { ok: true, skipped: true };
      }
      const card = buildPurchaseBankDepositConfirmCard(room);
      const now = pickStr(room.bankTransferReportedAt) || new Date().toISOString();
      list.push({
        id: `msg-${id}-purchase-bank-deposit-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: now,
        kind: PURCHASE_BANK_DEPOSIT_CONFIRM_CARD_KIND,
        purchaseBankDepositCard: card,
      });
      map[id] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function renderPurchaseBankDepositConfirmCardHtml(message, thread, userId) {
    const room = thread || readThread(message?.roomId || message?.chatId);
    if (!room || getPaymentMethod(room) !== PAYMENT_METHODS.BANK_TRANSFER) return "";
    if (!isBankTransferReported(room) || isPaymentConfirmed(room)) return "";

    const card = { ...buildPurchaseBankDepositConfirmCard(room), ...(message?.purchaseBankDepositCard || {}) };
    const meId = pickStr(userId);
    const threadId = pickStr(room.id, message?.roomId, message?.chatId);
    const title = pickStr(card.title, "入金を確認してください");
    const copy = getCopy(room);
    const rows = [
      ["購入者", pickStr(card.buyerName)],
      ["対象", pickStr(card.listingTitle)],
      ["振込金額", pickStr(card.amountLabel, fmtYen(card.amountYen))],
    ]
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<div class="chat-manual-pay__row"><dt>${escHtml(label)}</dt><dd>${escHtml(value)}</dd></div>`
      )
      .join("");

    let actionHtml = "";
    if (canSellerConfirmBankPayment(room, meId)) {
      actionHtml =
        `<button type="button" class="chat-manual-pay__btn chat-manual-pay__btn--primary" data-purchase-bank-confirm data-thread-id="${escHtml(threadId)}">${escHtml(copy.paymentConfirmBtn)}</button>`;
    } else if (isSeller(room, meId)) {
      actionHtml = `<p class="chat-manual-pay__done" role="status">入金確認済み</p>`;
    }

    return (
      `<div class="chat-manual-pay-wrap" data-platform-bank-deposit-card data-thread-id="${escHtml(threadId)}">` +
      `<article class="chat-manual-pay" aria-label="${escHtml(title)}">` +
      `<h3 class="chat-manual-pay__title">${escHtml(title)}</h3>` +
      `<p class="chat-manual-pay__note">${escHtml(card.guide)}</p>` +
      `<dl class="chat-manual-pay__list">${rows}</dl>` +
      (actionHtml ? `<div class="chat-manual-pay__actions">${actionHtml}</div>` : "") +
      `</article>` +
      `</div>`
    );
  }

  function syncPurchaseBankTransferCards(thread) {
    const id = pickStr(thread?.id);
    if (!id || !appliesToThread(thread)) return false;
    if (getPaymentMethod(thread) !== PAYMENT_METHODS.BANK_TRANSFER) return false;
    if (isPaymentConfirmed(thread) || isCompleted(thread)) return false;
    const res = appendPurchaseBankTransferCard(id, thread);
    return res?.ok === true && res?.skipped !== true;
  }

  function syncPurchaseBankDepositConfirmCards(thread) {
    const id = pickStr(thread?.id);
    if (!id || !appliesToThread(thread)) return false;
    if (getPaymentMethod(thread) !== PAYMENT_METHODS.BANK_TRANSFER) return false;
    if (!isBankTransferReported(thread) || isPaymentConfirmed(thread) || isCompleted(thread)) {
      return false;
    }
    const res = appendPurchaseBankDepositConfirmCard(id, thread);
    return res?.ok === true && res?.skipped !== true;
  }

  async function reportBankTransferFromCard(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    }
    const btn = trigger?.closest?.("[data-purchase-bank-report]") || trigger;
    if (!btn || btn.disabled || btn.dataset.tasuBankReportSubmitting === "1") {
      return { ok: false, reason: "button_unavailable" };
    }
    const threadId = pickStr(
      btn.getAttribute("data-thread-id"),
      new URL(global.location?.href || "http://localhost/").searchParams.get("thread")
    );
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)) ||
      null;
    if (!threadId) return { ok: false, reason: "missing_thread" };
    global.TasuChatDetailUi?.setFlowActionPending?.(true);
    btn.dataset.tasuBankReportSubmitting = "1";
    btn.disabled = true;
    const res = reportBankTransfer({ threadId, thread, userId: meId });
    if (!res?.ok) {
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuBankReportSubmitting;
      return res;
    }
    if (global.TasuChatDetailUi?.afterFlowPurchaseBankReport) {
      await global.TasuChatDetailUi.afterFlowPurchaseBankReport(res);
    } else if (typeof global.__tasuChatDetailReload === "function") {
      global.__tasuChatDetailReload({ thread: res?.thread });
    }
    global.TasuChatDetailUi?.setFlowActionPending?.(false);
    delete btn.dataset.tasuBankReportSubmitting;
    return res;
  }

  async function confirmBankPaymentFromCard(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    }
    const btn = trigger?.closest?.("[data-purchase-bank-confirm]") || trigger;
    if (!btn || btn.disabled || btn.dataset.tasuBankConfirmSubmitting === "1") {
      return { ok: false, reason: "button_unavailable" };
    }
    const threadId = pickStr(
      btn.getAttribute("data-thread-id"),
      new URL(global.location?.href || "http://localhost/").searchParams.get("thread")
    );
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)) ||
      null;
    if (!threadId) return { ok: false, reason: "missing_thread" };
    global.TasuChatDetailUi?.setFlowActionPending?.(true);
    btn.dataset.tasuBankConfirmSubmitting = "1";
    btn.disabled = true;
    const res = confirmBankPayment({ threadId, thread, userId: meId });
    if (!res?.ok) {
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuBankConfirmSubmitting;
      return res;
    }
    if (global.TasuChatDetailUi?.afterFlowPurchaseBankConfirm) {
      await global.TasuChatDetailUi.afterFlowPurchaseBankConfirm(res);
    } else if (typeof global.__tasuChatDetailReload === "function") {
      global.__tasuChatDetailReload({ thread: res?.thread });
    }
    global.TasuChatDetailUi?.setFlowActionPending?.(false);
    delete btn.dataset.tasuBankConfirmSubmitting;
    return res;
  }

  function reportBankTransferCardFromEvent(ev) {
    void reportBankTransferFromCard(ev?.currentTarget || ev?.target, ev);
    return false;
  }

  function confirmBankPaymentCardFromEvent(ev) {
    void confirmBankPaymentFromCard(ev?.currentTarget || ev?.target, ev);
    return false;
  }

  function requiresShipInputForm(thread) {
    return appliesToThread(thread) && getPaymentMethod(thread) === PAYMENT_METHODS.CASH_ON_DELIVERY;
  }

  function resolveShippingInfoForShip(thread, input) {
    const opts = input || {};
    const carrier = pickStr(opts.carrier);
    const tracking = pickStr(opts.tracking);
    if (carrier || tracking) {
      return {
        carrier: carrier || pickStr(thread?.shippingCarrier, thread?.shipping_carrier, "ヤマト運輸"),
        tracking,
      };
    }
    if (requiresShipInputForm(thread)) {
      return { carrier: "", tracking: "" };
    }
    return resolveDemoShippingInfo(thread);
  }

  function resolveDemoShippingInfo(thread) {
    const carrier = pickStr(thread?.shippingCarrier, thread?.shipping_carrier, "ヤマト運輸");
    const tracking = pickStr(thread?.trackingNumber, thread?.tracking_number);
    if (requiresShipInputForm(thread)) {
      return { carrier, tracking };
    }
    if (tracking) return { carrier, tracking };
    const suffix = pickStr(thread?.id).replace(/\D/g, "").slice(-8) || String(Date.now()).slice(-8);
    return { carrier, tracking: `3591-${suffix}-4820` };
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatShippingCardTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function buildProductShippingCard(thread) {
    const info = resolveDemoShippingInfo(thread);
    return {
      title: "商品が発送されました",
      carrier: pickStr(info.carrier),
      trackingNumber: pickStr(info.tracking),
      shippedAt: pickStr(thread?.productShippedAt, thread?.product_shipped_at),
    };
  }

  function appendProductShippingInfoCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || readThread(id);
    if (!id || !room || !appliesToThread(room) || !isProductShipped(room)) {
      return { ok: false, reason: "not_applicable" };
    }
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      const card = buildProductShippingCard(room);
      const existingIdx = list.findIndex((m) => m?.kind === PRODUCT_SHIPPING_CARD_KIND);
      if (existingIdx >= 0) {
        const existing = list[existingIdx] || {};
        const prev = existing.productShippingCard || {};
        const nextCard = {
          ...prev,
          ...card,
          carrier: pickStr(card.carrier, prev.carrier),
          trackingNumber: pickStr(card.trackingNumber, prev.trackingNumber, prev.tracking),
          title: pickStr(card.title, prev.title, "商品が発送されました"),
        };
        const changed =
          pickStr(prev.carrier) !== pickStr(nextCard.carrier) ||
          pickStr(prev.trackingNumber, prev.tracking) !== pickStr(nextCard.trackingNumber);
        if (!changed) {
          return { ok: true, skipped: true };
        }
        list[existingIdx] = { ...existing, productShippingCard: nextCard };
        map[id] = list;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
        return { ok: true, updated: true, card: nextCard };
      }
      const now = pickStr(room.productShippedAt) || new Date().toISOString();
      list.push({
        id: `msg-${id}-product-shipping-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: now,
        kind: PRODUCT_SHIPPING_CARD_KIND,
        productShippingCard: card,
      });
      map[id] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function renderProductShippingCardHtml(message, thread) {
    const room = thread || readThread(message?.roomId || message?.chatId);
    const fromThread = room && isProductShipped(room) ? buildProductShippingCard(room) : {};
    const fromMsg = message?.productShippingCard || {};
    const card = {
      ...fromThread,
      ...fromMsg,
      title: pickStr(fromMsg.title, fromThread.title, "商品が発送されました"),
      carrier: pickStr(fromMsg.carrier, fromThread.carrier),
      trackingNumber: pickStr(fromMsg.trackingNumber, fromMsg.tracking, fromThread.trackingNumber),
    };
    const title = pickStr(card.title, "商品が発送されました");
    const carrier = pickStr(card.carrier);
    const tracking = pickStr(card.trackingNumber, card.tracking);
    const time = escHtml(formatShippingCardTime(message?.createdAt));
    const rows = [];
    if (carrier) {
      rows.push(`<div><dt>配送会社</dt><dd>${escHtml(carrier)}</dd></div>`);
    }
    if (tracking) {
      rows.push(`<div><dt>追跡番号</dt><dd>${escHtml(tracking)}</dd></div>`);
    }
    return (
      `<div class="chat-shipping-card-wrap" data-platform-shipping-card>` +
      `<article class="chat-shipping-card" aria-label="配送情報">` +
      `<h3 class="chat-shipping-card__title">${escHtml(title)}</h3>` +
      (rows.length ? `<dl class="chat-shipping-card__rows">${rows.join("")}</dl>` : "") +
      `</article>` +
      (time ? `<time class="chat-shipping-card__time">${time}</time>` : "") +
      `</div>`
    );
  }

  function syncProductShippingCards(thread) {
    const id = pickStr(thread?.id);
    if (!id || !appliesToThread(thread) || !isProductShipped(thread)) return false;
    const res = appendProductShippingInfoCard(id, thread);
    return res?.ok === true && res?.skipped !== true;
  }

  global.TasuPlatformChatPurchasePaymentFlow = {
    PAYMENT_METHODS,
    appliesToThread,
    getPaymentMethod,
    getPrimaryActionMode,
    getPrimaryActionLabel,
    getStatusNotice,
    canMarkProductShipped,
    markShippingReady,
    reportBankTransfer,
    confirmBankPayment,
    markProductReceived,
    reportCodPayment,
    confirmCodCollection,
    getCopy,
    resolvePaymentMethodFromContext,
    readPaymentMethodFromUrlSearch,
    syncPaymentMethodFromContext,
    applyPaymentMethodToThread,
    createInitialPurchaseThreadFields,
    isProductShipped,
    isCompleted,
    isProductReceived,
    isShippingReady,
    isBankTransferReported,
    isPaymentConfirmed,
    isCodPaymentReported,
    isCashOnDeliveryConfirmed,
    requiresShipInputForm,
    resolveShippingInfoForShip,
    resolveDemoShippingInfo,
    appendProductShippingInfoCard,
    renderProductShippingCardHtml,
    syncProductShippingCards,
    syncPurchaseBankTransferCards,
    syncPurchaseBankDepositConfirmCards,
    appendPurchaseBankTransferCard,
    appendPurchaseBankDepositConfirmCard,
    renderPurchaseBankTransferCardHtml,
    renderPurchaseBankDepositConfirmCardHtml,
    canBuyerReportBankTransfer,
    canSellerConfirmBankPayment,
    reportBankTransferFromCard,
    confirmBankPaymentFromCard,
    reportBankTransferCardFromEvent,
    confirmBankPaymentCardFromEvent,
    resolvePurchaseTransferAmountYen,
    PRODUCT_SHIPPING_CARD_KIND,
    PURCHASE_BANK_TRANSFER_CARD_KIND,
    PURCHASE_BANK_DEPOSIT_CONFIRM_CARD_KIND,
    PURCHASE_COMPLETION_FEE_CARD_KIND,
    shouldQueuePurchaseCompletionFee,
    getPurchaseCompletionFeeState,
    isCompletionFeePaid,
    isReadyForReview,
    renderPurchaseCompletionFeeCardHtml,
    appendPurchaseCompletionFeeCard,
  };
})(typeof window !== "undefined" ? window : globalThis);
