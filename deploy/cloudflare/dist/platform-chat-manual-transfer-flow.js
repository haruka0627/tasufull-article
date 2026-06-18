/**
 * Connectなし — 取引完了後の銀行振込案内（チャット内カード + 相互通知）
 * - 承認後に「お支払い先を確認してください」カードを表示
 * - 購入者/依頼者: 「支払いました」
 * - 掲載者/出品者/提供者: 「入金確認しました」
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_platform_manual_transfer_v1";
  const SOURCE_PAID = "platform_chat_manual_transfer_paid_v1";
  const SOURCE_CONFIRMED = "platform_chat_manual_transfer_confirmed_v1";

  const PAYMENT_CARD_KIND = "manual_transfer_payment_card";
  const DEPOSIT_CARD_KIND = "manual_transfer_deposit_confirm_card";
  const DEPOSIT_GUIDE_TEXT =
    "購入者から支払い報告がありました。入金を確認後、取引を完了してください。";
  const DEPOSIT_COMPLETE_BTN = "取引完了";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readStateMap() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStateMap(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map || {}));
      try {
        global.dispatchEvent(new CustomEvent("tasful-manual-transfer-changed"));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }

  function getThreadState(threadId) {
    const id = pickStr(threadId);
    if (!id) return { status: "none" };
    const map = readStateMap();
    const row = map[id];
    if (!row || typeof row !== "object") return { status: "none" };
    return {
      status: pickStr(row.status, "none"),
      paidAt: pickStr(row.paidAt),
      confirmedAt: pickStr(row.confirmedAt),
      amountYen: Number(row.amountYen) || 0,
      dueAt: pickStr(row.dueAt),
    };
  }

  function setThreadState(threadId, patch) {
    const id = pickStr(threadId);
    if (!id) return getThreadState(id);
    const map = readStateMap();
    map[id] = {
      ...(map[id] || {}),
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
    };
    writeStateMap(map);
    return getThreadState(id);
  }

  function resolveBankInfo(thread) {
    // デモ用: 売り手ごとに固定の口座（将来的に seller profile に寄せる）
    const sellerId = pickStr(thread?.sellerId);
    const demo = {
      u_sachi: {
        holder: "サチコ デモ",
        bank: "みらい銀行",
        branch: "渋谷支店",
        type: "普通",
        number: "1234567",
      },
      u_product: {
        holder: "PREMIUM HOME",
        bank: "みらい銀行",
        branch: "新宿支店",
        type: "普通",
        number: "2345678",
      },
      u_shop_demo: {
        holder: "RE:WORKS",
        bank: "みらい銀行",
        branch: "渋谷支店",
        type: "当座",
        number: "3456789",
      },
      u_business_demo: {
        holder: "トソウコウボウサポート",
        bank: "みらい銀行",
        branch: "大阪支店",
        type: "普通",
        number: "4567890",
      },
      u_job_demo_full: {
        holder: "タスク確認株式会社",
        bank: "みらい銀行",
        branch: "渋谷支店",
        type: "普通",
        number: "5678901",
      },
      "demo-worker-001": {
        holder: "代行ワーカーA",
        bank: "みらい銀行",
        branch: "新宿支店",
        type: "普通",
        number: "6789012",
      },
      u_general_demo: {
        holder: "タスフル イチジ",
        bank: "みらい銀行",
        branch: "千葉支店",
        type: "普通",
        number: "7890123",
      },
      "demo-builder-user": {
        holder: "ヤマダ タロウ",
        bank: "みらい銀行",
        branch: "品川支店",
        type: "普通",
        number: "8901234",
      },
    };
    return (
      demo[sellerId] || {
        holder: "受取人",
        bank: "銀行名",
        branch: "支店名",
        type: "普通",
        number: "0000000",
      }
    );
  }

  function resolveAmountYen(thread) {
    // デモは thread 上に price がないことが多いので、最低限 550 を出す（取引代金は後で拡張）
    const fee = 550;
    const raw =
      thread?.agreedAmount ??
      thread?.agreed_amount ??
      thread?.amountYen ??
      thread?.amount_yen ??
      0;
    const amount = Math.max(0, Math.round(Number(raw) || 0));
    return amount > 0 ? amount : fee;
  }

  function resolveDueAt() {
    const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
    return d.toISOString();
  }

  function fmtYen(amount) {
    try {
      return `${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString("ja-JP")}円`;
    } catch {
      return `${Math.max(0, Math.round(Number(amount) || 0))}円`;
    }
  }

  function fmtDate(iso) {
    const s = pickStr(iso);
    if (!s) return "—";
    try {
      const d = new Date(s);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return `${y}/${m}/${day}`;
    } catch {
      return "—";
    }
  }

  function isConnectThread(thread) {
    return global.TasuPlatformChatConnectChatFlow?.isConnectThread?.(thread) === true;
  }

  function isManualTransferActive(thread) {
    if (!thread) return false;
    if (
      global.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(thread) === true
    ) {
      return false;
    }
    if (global.TasuPlatformChatCategoryFlow?.skipsPostChatCompletionFlow?.(thread) === true) {
      return false;
    }
    if (isConnectThread(thread)) return false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === "awaiting_payment") return true;
    if (rs === "completed") {
      const st = getThreadState(thread.id);
      return st.status === "pending" || st.status === "paid" || st.status === "confirmed";
    }
    return false;
  }

  /** @deprecated isManualTransferActive */
  function isManualTransferRequired(thread) {
    return isManualTransferActive(thread);
  }

  function resolvePaymentUrl(thread) {
    return pickStr(thread?.manualPaymentUrl, thread?.paymentUrl, thread?.payment_url);
  }

  function canBuyerReportPaid(thread, meId) {
    const me = pickStr(meId);
    if (!me) return false;
    const buyerId =
      global.TasuPlatformChatCategoryFlow?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
    return me === pickStr(buyerId);
  }

  function canSellerConfirm(thread, meId) {
    const me = pickStr(meId);
    if (!me) return false;
    const sellerId =
      global.TasuPlatformChatCategoryFlow?.getSellerId?.(thread) || pickStr(thread?.sellerId);
    return me === pickStr(sellerId);
  }

  function readMessages(threadId) {
    const store = global.TasuChatThreadStore;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return Array.isArray(map?.[threadId]) ? map[threadId] : [];
    } catch {
      return [];
    }
  }

  function writeMessages(threadId, list) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    if (typeof store.writeMessagesMap === "function") {
      store.writeMessagesMap({ [threadId]: list });
      return;
    }
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[threadId] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function ensureBuyerPaymentCardMessage(threadId, thread) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread" };
    const list = readMessages(id);
    if (list.some((m) => m.kind === PAYMENT_CARD_KIND)) return { ok: true, skipped: true };

    const amountYen = resolveAmountYen(thread);
    const dueAt = resolveDueAt();
    setThreadState(id, { amountYen, dueAt, status: "pending" });

    list.push({
      id: `msg-${id}-manual-transfer-card`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: PAYMENT_CARD_KIND,
      manualTransferCard: {
        title: "掲載者の振込先を確認してください",
        paymentUrl: resolvePaymentUrl(thread),
      },
    });
    writeMessages(id, list);
    return { ok: true };
  }

  /** @deprecated ensureBuyerPaymentCardMessage */
  function ensurePaymentCardMessage(threadId, thread) {
    return ensureBuyerPaymentCardMessage(threadId, thread);
  }

  function ensureDepositConfirmCardMessage(threadId, thread) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread" };
    const list = readMessages(id);
    if (list.some((m) => m.kind === DEPOSIT_CARD_KIND)) return { ok: true, skipped: true };

    const Category = global.TasuPlatformChatCategoryFlow;
    const Completion = global.TasuPlatformChatCompletionFlow;
    const buyerId = Category?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
    const buyerName =
      Completion?.resolveActorDisplayName?.(buyerId, thread) ||
      Category?.resolveActorDisplayName?.(buyerId, thread) ||
      pickStr(thread?.buyerName, "購入者");
    const amountYen = getThreadState(id).amountYen || resolveAmountYen(thread);

    list.push({
      id: `msg-${id}-manual-deposit-card`,
      chatId: id,
      roomId: id,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: new Date().toISOString(),
      kind: DEPOSIT_CARD_KIND,
      manualDepositCard: {
        title: "入金を確認してください",
        guide: DEPOSIT_GUIDE_TEXT,
        buyerName,
        listingTitle: pickStr(thread?.listingTitle, "対象案件"),
        amountYen,
      },
    });
    writeMessages(id, list);
    return { ok: true };
  }

  function renderManualTransferCardHtml(message, thread, meId) {
    if (!canBuyerReportPaid(thread, meId)) return "";

    const card = message?.manualTransferCard || {};
    const title = pickStr(card.title, "掲載者の振込先を確認してください");
    const bank = resolveBankInfo(thread);
    const state = getThreadState(thread?.id || thread?.threadId || thread?.roomId || message?.roomId);
    const amountYen = state.amountYen || resolveAmountYen(thread);
    const dueAt = state.dueAt || resolveDueAt();
    const status = pickStr(state.status, "pending");
    const paymentUrl = pickStr(card.paymentUrl, resolvePaymentUrl(thread));

    const paymentUrlBtn = paymentUrl
      ? `<a class="chat-manual-pay__btn chat-manual-pay__btn--ghost" href="${esc(paymentUrl)}" target="_blank" rel="noopener noreferrer">支払いページを開く</a>`
      : "";

    const threadId = pickStr(thread?.id, message?.roomId, message?.chatId);
    const buyerBtn =
      status !== "paid" && status !== "confirmed"
        ? `<button type="button" class="chat-manual-pay__btn chat-manual-pay__btn--primary" data-manual-pay-report-paid onclick="return TasuPlatformChatManualTransferFlow.reportPaidCardFromEvent(event)">支払いました</button>`
        : `<p class="chat-manual-pay__done" role="status">支払い報告済み</p>`;

    const note = paymentUrl
      ? `<p class="chat-manual-pay__note">お支払いページまたは下記の振込先へお支払いください。</p>`
      : `<p class="chat-manual-pay__note">この取引はTASFUL決済対象外です。下記の振込先へお支払いください。</p>`;

    const rows = [
      ["口座名義", bank.holder],
      ["銀行名", bank.bank],
      ["支店名", bank.branch],
      ["口座種別", bank.type],
      ["口座番号", bank.number],
      ["支払い金額", fmtYen(amountYen)],
      ["支払い期限", fmtDate(dueAt)],
    ]
      .map(
        ([k, v]) =>
          `<div class="chat-manual-pay__row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`
      )
      .join("");

    return (
      `<div class="chat-manual-pay-wrap" data-manual-transfer-card data-thread-id="${esc(threadId)}">` +
      `<article class="chat-manual-pay" aria-label="${esc(title)}">` +
      `<h3 class="chat-manual-pay__title">${esc(title)}</h3>` +
      note +
      `<dl class="chat-manual-pay__list">${rows}</dl>` +
      `<div class="chat-manual-pay__actions">` +
      paymentUrlBtn +
      buyerBtn +
      `</div>` +
      `</article>` +
      `</div>`
    );
  }

  function renderDepositConfirmCardHtml(message, thread, meId) {
    if (!canSellerConfirm(thread, meId)) return "";

    const card = message?.manualDepositCard || {};
    const title = pickStr(card.title, "入金を確認してください");
    const state = getThreadState(thread?.id || thread?.threadId || thread?.roomId || message?.roomId);
    const status = pickStr(state.status, "pending");
    const roomDone =
      pickStr(thread?.roomStatus, thread?.status).toLowerCase() === "completed" ||
      Boolean(thread?.manualDepositConfirmedBy);
    if (status !== "paid" && status !== "confirmed" && !roomDone) {
      return `<p class="chat-manual-pay__hint" role="note">購入者の「支払いました」後に入金確認ができます</p>`;
    }

    const Category = global.TasuPlatformChatCategoryFlow;
    const Completion = global.TasuPlatformChatCompletionFlow;
    const buyerId = Category?.getBuyerId?.(thread) || pickStr(thread?.buyerId);
    const payerLabel =
      global.TasuPlatformChatCategoryFlow?.getPayerPaidNotifyCopy?.(thread)?.payerRoleLabel ||
      global.TasuPlatformChatCategoryFlow?.getLabels?.(thread)?.payerRoleLabel ||
      "購入者";
    const buyerName = pickStr(
      card.buyerName,
      Completion?.resolveActorDisplayName?.(buyerId, thread),
      thread?.buyerName,
      payerLabel
    );
    const listingTitle = pickStr(card.listingTitle, thread?.listingTitle, "対象案件");
    const amountYen = Number(card.amountYen) || state.amountYen || resolveAmountYen(thread);

    const guide = pickStr(card.guide, DEPOSIT_GUIDE_TEXT);
    const rows = [
      [payerLabel, buyerName],
      ["対象案件", listingTitle],
      ["支払い金額", fmtYen(amountYen)],
    ]
      .map(
        ([k, v]) =>
          `<div class="chat-manual-pay__row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`
      )
      .join("");

    const threadId = pickStr(thread?.id, message?.roomId, message?.chatId);
    const action =
      status === "paid" && !roomDone
        ? `<button type="button" class="chat-manual-pay__btn chat-manual-pay__btn--primary" data-manual-pay-confirm-deposit onclick="return TasuPlatformChatManualTransferFlow.confirmDepositCardFromEvent(event)">${esc(DEPOSIT_COMPLETE_BTN)}</button>`
        : `<p class="chat-manual-pay__done" role="status">取引完了済み</p>`;

    return (
      `<div class="chat-manual-pay-wrap" data-manual-deposit-card data-thread-id="${esc(threadId)}">` +
      `<article class="chat-manual-pay chat-manual-pay--deposit" aria-label="${esc(title)}">` +
      `<h3 class="chat-manual-pay__title">${esc(title)}</h3>` +
      `<p class="chat-manual-pay__note">${esc(guide)}</p>` +
      `<dl class="chat-manual-pay__list">${rows}</dl>` +
      `<div class="chat-manual-pay__actions">${action}</div>` +
      `</article>` +
      `</div>`
    );
  }

  function pushRuntimeNotification(draft) {
    const store = global.TasuTalkNotifications;
    if (!store?.getAll || !store?.saveAll) return { ok: false, reason: "missing_store" };
    const notifyId = pickStr(draft.id);
    const byId = new Map((store.getAll() || []).map((n) => [String(n.id), n]));
    const existing = byId.get(String(notifyId)) || null;
    const row = {
      ...(existing || {}),
      ...draft,
      readAt: existing?.readAt || null,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    byId.set(String(notifyId), row);
    store.saveAll([...byId.values()], { localOnly: true, silent: true, source: pickStr(draft.source) });
    global.TasuTalkOfficialRooms?.syncNotification?.(row);
    try {
      global.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    } catch {
      /* ignore */
    }
    return { ok: true, notification: row };
  }

  function resolveOtherUserId(thread, actorId) {
    const me = pickStr(actorId);
    const sellerId = pickStr(thread?.sellerId);
    const buyerId = pickStr(thread?.buyerId);
    if (me && me === sellerId) return buyerId;
    if (me && me === buyerId) return sellerId;
    return "";
  }

  function buildManualTransferNotifyHref(threadId, recipientUserId) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(threadId);
    if (profile?.id && Demo?.chatUrl) {
      return Demo.chatUrl(profile.id, recipientUserId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: profile.connect,
        state: "active",
        from: "notify",
        threadId,
      });
    }
    return `chat-detail.html?thread=${encodeURIComponent(threadId)}&userId=${encodeURIComponent(recipientUserId)}&talkDev=1&from=notify`;
  }

  function notifyPaidReported(thread, threadId, actorId) {
    const recipientUserId = resolveOtherUserId(thread, actorId);
    if (!recipientUserId) return { ok: false };

    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) === true) {
      return global.TasuPlatformChatDualWindowNotify?.notifyDemoBuyerPaid?.({
        thread,
        threadId,
        buyerId: pickStr(actorId),
        sellerId: recipientUserId,
      });
    }

    const paidCopy =
      global.TasuPlatformChatCategoryFlow?.getPayerPaidNotifyCopy?.(thread) || {
        title: "購入者が支払いました",
        body: "入金を確認してください",
        cta: "入金を確認する",
      };
    const href = buildManualTransferNotifyHref(threadId, recipientUserId);
    const id = `platform-chat-manual-paid-${threadId}-${recipientUserId}`;
    return pushRuntimeNotification({
      id,
      type: pickStr(thread?.listingType, "platform"),
      category: pickStr(thread?.category, "取引"),
      title: paidCopy.title,
      body: paidCopy.body,
      actionLabel: paidCopy.cta,
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      source: SOURCE_PAID,
      senderUserId: pickStr(actorId),
      recipientUserId,
      threadId,
      listingId: pickStr(thread?.listingId),
      notifyListingTitle: pickStr(thread?.listingTitle),
      minimalNotifyCard: true,
    });
  }

  function reportPaid({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === id) || null;
    if (!id || !room) return { ok: false, reason: "missing_thread" };
    if (!isManualTransferActive(room)) return { ok: false, reason: "not_required" };
    if (!canBuyerReportPaid(room, userId)) return { ok: false, reason: "not_buyer" };

    const st = getThreadState(id);
    if (st.status === "paid" || st.status === "confirmed") return { ok: true, skipped: true };

    setThreadState(id, { status: "paid", paidAt: new Date().toISOString() });
    ensureDepositConfirmCardMessage(id, room);
    notifyPaidReported(room, id, userId);
    return { ok: true };
  }

  function confirmDepositAndComplete({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = thread || (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === id) || null;
    if (!id || !room) return { ok: false, reason: "missing_thread" };
    if (!isManualTransferActive(room)) return { ok: false, reason: "not_required" };
    if (!canSellerConfirm(room, userId)) return { ok: false, reason: "not_seller" };

    const st = getThreadState(id);
    if (st.status === "confirmed") return { ok: true, skipped: true };
    if (st.status !== "paid") return { ok: false, reason: "not_paid_yet" };

    const Completion = global.TasuPlatformChatCompletionFlow;
    const res =
      Completion?.completeAfterManualDeposit?.({
        threadId: id,
        thread: room,
        userId,
      }) || { ok: false, reason: "completion_failed" };
    return res;
  }

  /** @deprecated confirmDepositAndComplete */
  function confirmPaid({ threadId, thread, userId }) {
    return confirmDepositAndComplete({ threadId, thread, userId });
  }

  function isPaymentConfirmedForReview(thread) {
    if (!thread) return false;
    if (isConnectThread(thread)) return false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs !== "completed") return false;
    if (pickStr(thread?.manualDepositConfirmedBy, thread?.manualDepositConfirmedAt)) return true;
    const st = getThreadState(thread.id);
    if (st.status === "confirmed") return true;
    // completeAfterManualDeposit sets room completed; manual row may still read paid until reload
    if (st.status === "paid" && isManualTransferActive(thread)) return true;
    return false;
  }

  function resolveThreadIdFromCard(trigger, thread, message) {
    return pickStr(
      thread?.id,
      message?.roomId,
      message?.chatId,
      trigger?.closest?.("[data-manual-deposit-card], [data-manual-transfer-card]")?.getAttribute?.(
        "data-thread-id"
      ),
      new URL(global.location?.href || "http://localhost/").searchParams.get("thread")
    );
  }

  function showTransferInlineError(message) {
    const text = pickStr(message, "操作を完了できませんでした");
    if (global.TasuChatDetailUi?.showFlowError) {
      global.TasuChatDetailUi.showFlowError(text);
      return;
    }
    const errorEl = global.document?.getElementById?.("chatInlineError");
    if (errorEl) {
      errorEl.textContent = text;
      errorEl.style.display = "block";
    }
  }

  async function refreshChatAfterDepositConfirm(res, threadId) {
    const detailUi = global.TasuChatDetailUi;
    if (detailUi?.afterFlowDepositConfirm) {
      await detailUi.afterFlowDepositConfirm(res);
      return;
    }
    if (typeof global.__tasuChatDetailReload === "function") {
      global.__tasuChatDetailReload({ thread: res?.thread });
      return;
    }
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:manual-deposit-confirmed", {
          detail: { threadId, thread: res?.thread, result: res },
        })
      );
    } catch {
      /* ignore */
    }
  }

  async function reportPaidFromUi(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    }
    const btn = trigger?.closest?.("[data-manual-pay-report-paid]") || trigger;
    if (!btn || btn.disabled || btn.dataset.tasuPaidSubmitting === "1") {
      return { ok: false, reason: "button_unavailable" };
    }
    const threadId = resolveThreadIdFromCard(btn);
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)) || null;
    if (!threadId) {
      showTransferInlineError("チャットルームを特定できませんでした");
      return { ok: false, reason: "missing_thread" };
    }
    global.TasuChatDetailUi?.setFlowActionPending?.(true);
    btn.dataset.tasuPaidSubmitting = "1";
    btn.disabled = true;
    const res = reportPaid({ threadId, thread, userId: meId });
    if (!res?.ok) {
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuPaidSubmitting;
      showTransferInlineError(res?.reason || "支払い報告を送信できませんでした");
      return res;
    }
    if (global.TasuChatDetailUi?.afterFlowReportPaid) {
      await global.TasuChatDetailUi.afterFlowReportPaid(res);
    } else if (typeof global.__tasuChatDetailReload === "function") {
      global.__tasuChatDetailReload({ thread });
    }
    delete btn.dataset.tasuPaidSubmitting;
    global.TasuChatDetailUi?.setFlowActionPending?.(false);
    return res;
  }

  async function confirmDepositFromUi(trigger, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    }
    const btn = trigger?.closest?.("[data-manual-pay-confirm-deposit]") || trigger;
    if (!btn || btn.disabled || btn.dataset.tasuDepositSubmitting === "1") {
      return { ok: false, reason: "button_unavailable" };
    }
    const threadId = resolveThreadIdFromCard(btn);
    const root = global.document?.documentElement;
    if (root && root.dataset.tasuDepositInFlight === threadId) {
      return { ok: false, reason: "deposit_in_flight" };
    }
    const meId = global.TasuChatUserIdentity?.getEffectiveUserId?.() || "";
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(threadId)) || null;
    if (!threadId) {
      showTransferInlineError("チャットルームを特定できませんでした");
      return { ok: false, reason: "missing_thread" };
    }
    global.TasuChatDetailUi?.setFlowActionPending?.(true);
    if (root) root.dataset.tasuDepositInFlight = threadId;
    btn.dataset.tasuDepositSubmitting = "1";
    btn.disabled = true;
    let res;
    try {
      res = confirmDepositAndComplete({ threadId, thread, userId: meId });
    } catch (err) {
      if (root) delete root.dataset.tasuDepositInFlight;
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuDepositSubmitting;
      showTransferInlineError(String(err?.message || err || "入金確認を完了できませんでした"));
      return { ok: false, reason: String(err?.message || err) };
    }
    if (!res?.ok) {
      if (root) delete root.dataset.tasuDepositInFlight;
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuDepositSubmitting;
      showTransferInlineError(res?.reason || "入金確認を完了できませんでした");
      return res;
    }
    try {
      await refreshChatAfterDepositConfirm(res, threadId);
    } catch (err) {
      if (root) delete root.dataset.tasuDepositInFlight;
      global.TasuChatDetailUi?.setFlowActionPending?.(false);
      btn.disabled = false;
      delete btn.dataset.tasuDepositSubmitting;
      showTransferInlineError(String(err?.message || err || "完了後の画面更新に失敗しました"));
      return { ok: false, reason: String(err?.message || err) };
    }
    if (root) delete root.dataset.tasuDepositInFlight;
    delete btn.dataset.tasuDepositSubmitting;
    global.TasuChatDetailUi?.setFlowActionPending?.(false);
    try {
      global.parent?.postMessage?.({ type: "tasu-bench-chat-refresh", threadId }, "*");
    } catch {
      /* ignore */
    }
    return res;
  }

  function reportPaidCardFromEvent(ev) {
    void reportPaidFromUi(ev?.currentTarget, ev);
    return false;
  }

  function confirmDepositCardFromEvent(ev) {
    void confirmDepositFromUi(ev?.currentTarget, ev);
    return false;
  }

  function installManualTransferCardBridge() {
    const root = global.document?.documentElement;
    if (!root || root.dataset.tasuManualTransferBridge === "1") return;
    root.dataset.tasuManualTransferBridge = "1";
    global.document.addEventListener(
      "pointerdown",
      (ev) => {
        if (ev.target?.closest?.("[data-manual-pay-report-paid]")) {
          void reportPaidFromUi(ev.target.closest("[data-manual-pay-report-paid]"), ev);
          return;
        }
        if (ev.target?.closest?.("[data-manual-pay-confirm-deposit]")) {
          void confirmDepositFromUi(ev.target.closest("[data-manual-pay-confirm-deposit]"), ev);
        }
      },
      true
    );
  }

  function syncManualTransferCards(thread) {
    const id = pickStr(thread?.id);
    if (!id || !isManualTransferActive(thread)) return false;
    let changed = false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === "awaiting_payment") {
      const buyerRes = ensureBuyerPaymentCardMessage(id, thread);
      if (buyerRes?.ok && !buyerRes?.skipped) changed = true;
    }
    const st = getThreadState(id);
    if (st.status === "paid" && rs !== "completed") {
      const sellerRes = ensureDepositConfirmCardMessage(id, thread);
      if (sellerRes?.ok && !sellerRes?.skipped) changed = true;
    }
    return changed;
  }

  installManualTransferCardBridge();

  global.TasuPlatformChatManualTransferFlow = {
    STORAGE_KEY,
    SOURCE_PAID,
    SOURCE_CONFIRMED,
    PAYMENT_CARD_KIND,
    DEPOSIT_CARD_KIND,
    CARD_KIND: PAYMENT_CARD_KIND,
    isManualTransferActive,
    isManualTransferRequired,
    ensureBuyerPaymentCardMessage,
    ensurePaymentCardMessage,
    ensureDepositConfirmCardMessage,
    renderManualTransferCardHtml,
    renderDepositConfirmCardHtml,
    reportPaid,
    confirmDepositAndComplete,
    confirmPaid,
    getThreadState,
    isPaymentConfirmedForReview,
    syncManualTransferCards,
    resolveBankInfo,
    resolvePaymentUrl,
    reportPaidFromUi,
    confirmDepositFromUi,
    reportPaidCardFromEvent,
    confirmDepositCardFromEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);

