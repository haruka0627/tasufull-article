/**
 * やりとりチャット開始手数料 — Connect未利用（先払い）
 */
(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function formatYen(n) {
    const v = Math.max(0, Math.round(Number(n) || 0));
    return `¥${v.toLocaleString("ja-JP")}`;
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      threadId: String(params.get("thread") || "").trim(),
      listingId: String(params.get("listingId") || params.get("listing_id") || "").trim(),
      category: String(params.get("category") || "").trim(),
      notifyId: String(params.get("notify") || "").trim(),
      applicationId: String(params.get("applicationId") || params.get("application_id") || "").trim(),
      contactId: String(params.get("contactId") || params.get("contact_id") || "").trim(),
      requestId: String(params.get("requestId") || params.get("request_id") || "").trim(),
      dealId: String(params.get("deal") || "").trim(),
      roomId: String(params.get("roomId") || "").trim(),
      feeCheckout: String(params.get("fee_checkout") || "").trim(),
      phase: String(params.get("phase") || "").trim() || "pre_chat",
      from: String(params.get("from") || "").trim().toLowerCase(),
    };
  }

  function resolveFromContext(params) {
    const from = pickStr(params?.from).toLowerCase();
    if (from === "talk" || from === "notify") return from;
    return "";
  }

  function appendDevParams(href) {
    try {
      const u = new URL(String(href || ""), window.location.href);
      const cur = new URLSearchParams(window.location.search);
      ["talkDev", "userId"].forEach((key) => {
        const value = pickStr(cur.get(key));
        if (value) u.searchParams.set(key, value);
      });
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return href;
    }
  }

  function resolveBackLinkLabel(from) {
    if (from === "talk") return "← TALKへ戻る";
    if (from === "notify") return "← 通知へ戻る";
    return "← 戻る";
  }

  function buildFallbackBackUrl(from, params) {
    if (from === "talk") {
      return appendDevParams("talk-home.html?tab=chat&thread=official_tasful");
    }
    if (from === "notify") {
      return appendDevParams("talk-home.html?tab=notify");
    }
    const category = pickStr(params?.category).toLowerCase();
    const Fee = window.TasuPlatformChatFee;
    if (Fee?.isJobCategory?.(category) || category === "job") {
      return appendDevParams("job-top.html");
    }
    return appendDevParams("index-top.html");
  }

  function goBackWithFallback(fallbackUrl) {
    if (window.history.length > 1) {
      const start = window.location.href;
      window.history.back();
      window.setTimeout(() => {
        if (window.location.href === start) {
          window.location.href = fallbackUrl;
        }
      }, 450);
      return;
    }
    window.location.href = fallbackUrl;
  }

  function wireBackNavigation(params) {
    const link = document.querySelector("[data-platform-fee-back-link]");
    if (!link) return;
    const from = resolveFromContext(params);
    const fallbackUrl = buildFallbackBackUrl(from, params);
    link.textContent = resolveBackLinkLabel(from);
    link.setAttribute("href", fallbackUrl);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      goBackWithFallback(fallbackUrl);
    });
  }

  function formatApplicationDate(iso) {
    const d = new Date(iso || Date.now());
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function resolveJobApplicationContext(params, thread, listingTitle) {
    const store = window.TasuJobApplicationsStore;
    const jobId = pickStr(params.listingId, thread?.listingId);
    const applicationId = pickStr(params.applicationId, thread?.applicationId);
    const listing = store?.resolveListing?.(jobId);
    const app = applicationId && store?.findApplication ? store.findApplication(jobId, applicationId) : null;
    const fallbackApp =
      !app && store?.listByJob
        ? store.listByJob(jobId).find((row) => String(row.application_id) === applicationId) || null
        : null;
    const resolved = app || fallbackApp;
    return {
      jobTitle: pickStr(listingTitle, listing?.title, listing?.company_name, thread?.listingTitle, "求人"),
      applicantName: pickStr(resolved?.applicant_name, resolved?.applicant_id, "応募者"),
      appliedAt: formatApplicationDate(resolved?.created_at),
    };
  }

  function setJobPayLayout(active) {
    document.body.classList.toggle("platform-fee-pay--job", Boolean(active));
    if (active) setTradePayLayout(false);
    const defaultSummary = $("[data-platform-fee-summary-default]");
    const defaultNote = $("[data-platform-fee-note]");
    const jobPanel = $("[data-platform-fee-job-panel]");
    if (defaultSummary) defaultSummary.hidden = Boolean(active);
    if (defaultNote) defaultNote.hidden = Boolean(active);
    if (jobPanel) {
      if (active) jobPanel.removeAttribute("hidden");
      else jobPanel.setAttribute("hidden", "");
    }
  }

  function setTradePayLayout(active) {
    document.body.classList.toggle("platform-fee-pay--trade", Boolean(active));
    const tradePanel = $("[data-platform-fee-trade-panel]");
    const defaultSummary = $("[data-platform-fee-summary-default]");
    if (tradePanel) {
      if (active) tradePanel.removeAttribute("hidden");
      else tradePanel.setAttribute("hidden", "");
    }
    if (defaultSummary && active) defaultSummary.hidden = true;
  }

  function resolveTradeBuyerLabel(thread) {
    const buyerName = pickStr(thread?.buyerName);
    const buyerId = pickStr(thread?.buyerId);
    const sellerId = pickStr(thread?.sellerId);
    const me = pickStr(
      new URLSearchParams(window.location.search).get("userId"),
      window.TasuChatUserIdentity?.getEffectiveUserId?.()
    );
    if (buyerName && buyerId && buyerId !== sellerId) return buyerName;
    if (me && sellerId && me === sellerId) return "ひろ";
    return buyerName || "購入者";
  }

  function paintTradePayContext(thread, listingTitle, amount) {
    const buyerEl = $("[data-platform-fee-buyer]");
    const listingEl = $("[data-platform-fee-trade-listing]");
    const amountEl = $("[data-platform-fee-trade-amount]");
    if (buyerEl) buyerEl.textContent = resolveTradeBuyerLabel(thread);
    if (listingEl) listingEl.textContent = pickStr(listingTitle, thread?.listingTitle, "取引");
    if (amountEl) amountEl.textContent = formatYen(amount);
  }

  function setStatus(text, isError) {
    const el = $("[data-platform-fee-status]");
    if (!el) return;
    el.textContent = String(text || "");
    el.classList.toggle("is-error", Boolean(isError));
  }

  function resolveListingDetailUrl(category, listingId, thread) {
    const fromThread = pickStr(thread?.detailUrl, thread?._detailUrl);
    if (fromThread && fromThread !== "#") return fromThread;

    const Fee = window.TasuPlatformChatFee;
    const cat = Fee?.normalizeCategoryKey?.(category) || category;
    const routeType = cat === "shop_store" ? "shop" : cat;
    const resolvedId = pickStr(listingId, thread?.listingId);
    const R = window.TasuListingRouteResolver;
    if (R?.buildDetailUrl) {
      if (resolvedId) return R.buildDetailUrl(routeType, resolvedId);
      return R.buildDetailUrl(routeType);
    }
    return "#";
  }

  function appendFromParam(href, from) {
    const value = pickStr(from).toLowerCase();
    if (!value || (value !== "talk" && value !== "notify")) return href;
    try {
      const u = new URL(String(href || ""), window.location.href);
      u.searchParams.set("from", value);
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return href;
    }
  }

  function resolveChatUrl(threadId, from) {
    const id = pickStr(threadId);
    const store = window.TasuChatThreadStore;
    if (store?.chatDetailUrl) return appendFromParam(store.chatDetailUrl(id), from);
    const Fee = window.TasuPlatformChatFee;
    if (Fee?.buildChatDetailUrl) return appendFromParam(Fee.buildChatDetailUrl({ threadId: id }), from);
    if (Fee?.buildChatUrl) return appendFromParam(Fee.buildChatUrl({ id }), from);
    return appendFromParam(`chat-detail.html?thread=${encodeURIComponent(id)}`, from);
  }

  function buildCompletionFeeReviewChatUrl(params, thread, from) {
    const resolvedThreadId = pickStr(params.activatedThreadId, thread?.id, params.threadId);
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread || resolvedThreadId);
    const sellerId = pickStr(thread?.sellerId, profile?.partnerAId);
    const cur = new URLSearchParams(window.location.search);
    const userId = pickStr(cur.get("userId"), sellerId);
    if (profile && Demo?.chatUrl) {
      return appendFromParam(
        Demo.chatUrl(profile.id, userId, {
          state: "completed",
          from: pickStr(from, "notify"),
          openReview: "1",
          threadId: resolvedThreadId,
        }),
        from
      );
    }
    const chatUrl = resolveChatUrl(resolvedThreadId, from);
    try {
      const u = new URL(chatUrl, window.location.href);
      u.searchParams.set("demoState", "completed");
      u.searchParams.set("openReview", "1");
      if (userId) u.searchParams.set("userId", userId);
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return chatUrl;
    }
  }

  function showCompleteView(params, thread, category, listingId) {
    $("[data-platform-fee-pay-panel]")?.setAttribute("hidden", "");
    $("[data-platform-fee-complete]")?.removeAttribute("hidden");

    const chatLink = $("[data-platform-fee-chat-link]");
    const listingLink = $("[data-platform-fee-listing-link]");
    const completeLead = document.querySelector(".shop-platform-fee-complete__lead");
    const completeTitle = document.querySelector("[data-platform-fee-complete] .shop-checkout__title");
    const from = resolveFromContext(params);
    const isCompletion = params.phase === "complete";
    const resolvedThreadId = pickStr(params.activatedThreadId, thread?.id, params.threadId);
    const chatUrl = isCompletion
      ? buildCompletionFeeReviewChatUrl(params, thread, from)
      : resolveChatUrl(resolvedThreadId, from);
    const listingUrl = resolveListingDetailUrl(category, listingId, thread);

    if (chatLink) {
      chatLink.href = chatUrl;
      chatLink.textContent = isCompletion ? "レビューする" : "やりとりチャットへ";
    }
    if (listingLink) {
      listingLink.href = listingUrl !== "#" ? listingUrl : "index-top.html";
      listingLink.hidden = isCompletion;
    }
    if (completeLead) {
      completeLead.textContent = isCompletion
        ? "手数料のお支払いが完了しました。レビューで取引を締めくくれます。"
        : "相手とのやりとりを開始・継続できます。";
    }
    if (completeTitle) {
      completeTitle.textContent = isCompletion ? "手数料支払いが完了しました" : "支払いが完了しました";
    }

    document.title = isCompletion ? "手数料支払いが完了しました | TASFUL" : "支払いが完了しました | TASFUL";
    const subnav = document.querySelector(".page-subnav");
    if (subnav) subnav.hidden = true;

    if (isCompletion) {
      try {
        window.TasuPlatformChatDualWindowNotify?.notifyDemoPurchaseCompletionFeePaid?.({
          thread,
          threadId: resolvedThreadId,
          sellerId: pickStr(thread?.sellerId),
        });
      } catch {
        /* ignore */
      }
    }
  }

  function resolveThread(threadId) {
    const store = window.TasuChatThreadStore;
    if (!store?.loadRoom || !threadId) return null;
    const loaded = store.loadRoom(threadId);
    return loaded?.thread || null;
  }

  function buildStripePayload(threadId, category, amount, listingTitle) {
    const Fee = window.TasuPlatformChatFee;
    const dealId = `local-deal-platform-chat-${threadId}`;
    const isJob = Fee?.isJobCategory?.(category);
    const categoryLabel = Fee?.getCategoryLabel?.(category) || "取引";
    return {
      deal_id: dealId,
      dealId,
      deal_type: "local",
      fee_amount: amount,
      feeAmount: amount,
      platform_fee_amount: amount,
      title: isJob
        ? "TASFUL 求人やりとり開始料（550円）"
        : `TASFUL やりとり手数料（${categoryLabel}）`,
      origin: window.location.origin,
      thread_id: threadId,
      order_type: "platform_chat_fee",
      listing_title: listingTitle || "",
    };
  }

  async function createStripeSession(threadId, category, amount, listingTitle, params) {
    const cfg = window.TasuStripeServiceFeeConfig;
    const key = cfg?.getPublishableAnonKey?.() || "";
    if (!cfg?.createServiceFeeCheckoutUrl || !key) {
      throw new Error("Stripe が未設定です。");
    }

    const body = buildStripePayload(threadId, category, amount, listingTitle);
    const successUrl = new URL("platform-chat-fee-pay.html", window.location.href);
    successUrl.searchParams.set("fee_checkout", "success");
    successUrl.searchParams.set("thread", threadId);
    if (params?.from) successUrl.searchParams.set("from", params.from);
    if (params?.notifyId) successUrl.searchParams.set("notify", params.notifyId);
    if (params?.listingId) successUrl.searchParams.set("listingId", params.listingId);
    if (params?.category) successUrl.searchParams.set("category", params.category);
    if (params?.applicationId) successUrl.searchParams.set("applicationId", params.applicationId);
    if (params?.contactId) successUrl.searchParams.set("contactId", params.contactId);
    if (params?.requestId) successUrl.searchParams.set("requestId", params.requestId);
    if (body.listing_title) successUrl.searchParams.set("listingTitle", body.listing_title);

    const cancelUrl = new URL("platform-chat-fee-pay.html", window.location.href);
    cancelUrl.searchParams.set("thread", threadId);
    cancelUrl.searchParams.set("fee_checkout", "cancelled");
    if (params?.from) cancelUrl.searchParams.set("from", params.from);
    if (params?.notifyId) cancelUrl.searchParams.set("notify", params.notifyId);
    if (params?.listingId) cancelUrl.searchParams.set("listingId", params.listingId);
    if (params?.category) cancelUrl.searchParams.set("category", params.category);
    if (params?.applicationId) cancelUrl.searchParams.set("applicationId", params.applicationId);
    if (params?.contactId) cancelUrl.searchParams.set("contactId", params.contactId);
    if (params?.requestId) cancelUrl.searchParams.set("requestId", params.requestId);

    const res = await fetch(cfg.createServiceFeeCheckoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        ...body,
        success_url: `${successUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl.pathname + cancelUrl.search,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "Checkout 作成に失敗");
    return data.url;
  }

  function isBenchEmbedFeePay() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("benchEmbed") === "1") return true;
      if (window.parent && window.parent !== window) {
        const parentPath = String(window.parent.location?.pathname || "");
        if (/chat-dual-window-demo\.html$/i.test(parentPath)) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function isConnectEntryPayment(params, feeRow) {
    return params?.phase === "connect_entry" || pickStr(feeRow?.feePhase) === "connect_entry";
  }

  function isDeferredPayment(params, feeRow) {
    if (isConnectEntryPayment(params, feeRow)) return true;
    const tid = pickStr(params?.threadId);
    if (tid.startsWith("deferred:")) return true;
    if (pickStr(params?.contactId, params?.applicationId, params?.requestId)) return true;
    if (feeRow?.deferred === true) return true;
    return false;
  }

  async function completePayment(params, feeRow, category, amount) {
    const Fee = window.TasuPlatformChatFee;
    if (!Fee) throw new Error("手数料モジュールが読み込まれていません。");

    const isCompletion = params.phase === "complete";
    const isConnectEntry = isConnectEntryPayment(params, feeRow);
    const feeKey = Fee.resolveFeeKey?.({
      threadId: params.threadId,
      contactId: params.contactId,
      applicationId: params.applicationId,
      requestId: params.requestId,
    });
    const deferred = !isCompletion && isDeferredPayment(params, feeRow);

    if (isCompletion) {
      Fee.completeCompletionFeePayment?.(params.threadId, {
        listingId: pickStr(feeRow?.listingId, params.listingId),
        category,
        feeAmount: amount,
        dealId: params.dealId,
      });
    } else if (deferred) {
      Fee.pushJobHireFlowDiag?.("completePayment:deferred:start", {
        applicationId: params.applicationId,
        contactId: params.contactId,
        feeKey: feeKey || params.threadId,
        benchEmbed: isBenchEmbedFeePay(),
        connectEntry: isConnectEntry,
      });
      Fee.markFeePaid(feeKey || params.threadId, {
        listingId: pickStr(feeRow?.listingId, params.listingId),
        category,
        feeAmount: amount,
        notifyId: params.notifyId,
        connectMode: isConnectEntry ? "connect_entry" : undefined,
        feePhase: isConnectEntry ? "connect_entry" : undefined,
      });

      const activated = isConnectEntry
        ? await Promise.resolve(
            window.TasuPlatformChatConnectEntryFlow?.activateConnectEntryAfterPayment?.({
              contactId: params.contactId,
              applicationId: params.applicationId,
              requestId: params.requestId,
              listingId: pickStr(feeRow?.listingId, params.listingId),
            })
          )
        : await Promise.resolve(
            Fee.activateDeferredAfterPayment?.({
              contactId: params.contactId,
              applicationId: params.applicationId,
              requestId: params.requestId,
              listingId: pickStr(feeRow?.listingId, params.listingId),
            })
          );
      Fee.pushJobHireFlowDiag?.("completePayment:deferred:activated", {
        ok: activated?.ok === true,
        threadId: pickStr(activated?.threadId, activated?.thread?.id),
        reason: pickStr(activated?.reason),
      });
      if (!activated?.ok) {
        throw new Error("やりとりチャットの開始に失敗しました。");
      }
      params.activatedThreadId = pickStr(activated.threadId, activated.thread?.id);
      params.threadId = params.activatedThreadId;
    } else {
      Fee.markFeePaid(params.threadId, {
        listingId: pickStr(feeRow?.listingId, params.listingId),
        category,
        feeAmount: amount,
        notifyId: params.notifyId,
      });

      const activated = await Promise.resolve(Fee.activateThreadAfterPayment?.(params.threadId));
      if (!activated?.ok) {
        throw new Error("やりとりチャットの開始に失敗しました。");
      }
      params.activatedThreadId = pickStr(activated.thread?.id, params.threadId);
    }

    if (params.notifyId && window.TasuTalkNotifications?.markRead) {
      window.TasuTalkNotifications.markRead(params.notifyId);
    }

    const thread = resolveThread(pickStr(params.activatedThreadId, params.threadId));
    const listingId = pickStr(feeRow?.listingId, params.listingId, thread?.listingId);
    showCompleteView(params, thread, category, listingId);
    Fee.pushJobHireFlowDiag?.("completePayment:done", {
      threadId: pickStr(params.activatedThreadId, params.threadId),
      benchEmbed: isBenchEmbedFeePay(),
    });
    return { ok: true };
  }

  async function init() {
    const Fee = window.TasuPlatformChatFee;
    if (!Fee) {
      setStatus("手数料モジュールが読み込まれていません。", true);
      return;
    }

    const params = readParams();
    wireBackNavigation(params);
    if (!params.threadId) {
      const feeKey = Fee.resolveFeeKey?.({
        contactId: params.contactId,
        applicationId: params.applicationId,
        requestId: params.requestId,
      });
      if (feeKey) params.threadId = feeKey;
    }
    if (!params.threadId) {
      setStatus("支払い対象が指定されていません。", true);
      return;
    }

    if (params.feeCheckout === "success") {
      try {
        const thread = resolveThread(pickStr(params.activatedThreadId, params.threadId));
        const feeRow = Fee.getFeeRecordByContext?.(params) || Fee.getFeeRecord(params.threadId);
        const category = Fee.normalizeCategoryKey(params.category || feeRow?.category || thread?.listingType);
        const isCompletion = params.phase === "complete";
        const isJob = Fee.isJobCategory?.(category);
        const amount =
          feeRow?.feeAmount ||
          (isCompletion
            ? Fee.calcCompletionFee?.(feeRow?.agreedAmount || Fee.MIN_FEE_YEN)
            : isJob
              ? Fee.calcJobChatFee?.()
              : Fee.calcPreChatFee({ price: Fee.MIN_FEE_YEN }));
        const listingId = pickStr(feeRow?.listingId, params.listingId, thread?.listingId);

        if (isCompletion && Fee.isFeePaid(params.threadId) && pickStr(feeRow?.feePhase) === "on_complete") {
          showCompleteView(params, thread, category, listingId);
          return;
        }

        if (
          !isCompletion &&
          Fee.isFeePaid(params.threadId) &&
          String(thread?.status || "").toLowerCase() === "open"
        ) {
          showCompleteView(params, thread, category, listingId);
          return;
        }

        await completePayment(params, feeRow, category, amount);
        return;
      } catch (err) {
        setStatus(err?.message || "お支払い後の処理に失敗しました。", true);
        return;
      }
    }

    const isCompletion = params.phase === "complete";
    const isConnectEntry = params.phase === "connect_entry";

    const deferredInit =
      isDeferredPayment(params, null) || String(params.threadId || "").startsWith("deferred:");

    if (
      !isCompletion &&
      !deferredInit &&
      params.notifyId &&
      window.TasuPlatformChatDemoSeed?.resetVerifyFeeThread
    ) {
      const existing = resolveThread(params.threadId);
      const paid =
        Fee.isFeePaid(params.threadId) &&
        String(existing?.status || "").toLowerCase() === "open";
      if (!paid) {
        window.TasuPlatformChatDemoSeed.resetVerifyFeeThread(params.notifyId);
      }
    } else if (!isCompletion && !deferredInit) {
      window.TasuPlatformChatDemoSeed?.ensureThreadForFeePay?.(params);
    }

    const thread = deferredInit ? null : resolveThread(params.threadId);
    let feeRow = Fee.getFeeRecordByContext?.(params) || Fee.getFeeRecord(params.threadId);
    if (isCompletion && params.dealId) {
      window.TasuPlatformChatCompletion?.ensureDemoDealThread?.(params.dealId);
      feeRow =
        feeRow ||
        Fee.ensurePendingCompletionFee?.({
          threadId: params.threadId,
          dealId: params.dealId,
          listingId: params.listingId || thread?.listingId,
          listingTitle: thread?.listingTitle,
          category: params.category || thread?.listingType,
        });
    }
    if (!feeRow && !deferredInit) {
      feeRow = Fee.ensurePendingFee(
        { id: params.listingId || thread?.listingId, title: thread?.listingTitle },
        { id: params.threadId, listingId: thread?.listingId, listingTitle: thread?.listingTitle },
        {}
      );
    }

    const category = Fee.normalizeCategoryKey(params.category || feeRow?.category || thread?.listingType);
    const isJob = Fee.isJobCategory?.(category);
    const amount =
      feeRow?.feeAmount ||
      (isCompletion
        ? Fee.calcCompletionFee?.(feeRow?.agreedAmount || Fee.MIN_FEE_YEN)
        : isJob
          ? Fee.calcJobChatFee?.()
          : Fee.calcPreChatFee({ price: Fee.MIN_FEE_YEN }));
    const listingTitle = pickStr(feeRow?.listingTitle, thread?.listingTitle, params.listingId);
    const resolvedListing = isJob
      ? window.TasuJobApplicationsStore?.resolveListing?.(
          pickStr(params.listingId, thread?.listingId, feeRow?.listingId)
        )
      : null;
    const displayListingTitle = pickStr(
      listingTitle,
      resolvedListing?.title,
      resolvedListing?.company_name,
      isJob ? "求人" : ""
    );

    if (
      !isCompletion &&
      Fee.isFeePaid(params.threadId) &&
      String(thread?.status || "").toLowerCase() === "open"
    ) {
      showCompleteView(
        params,
        thread,
        category,
        pickStr(feeRow?.listingId, params.listingId, thread?.listingId)
      );
      return;
    }

    if (isCompletion && Fee.isFeePaid(params.threadId) && pickStr(feeRow?.feePhase) === "on_complete") {
      showCompleteView(
        params,
        thread,
        category,
        pickStr(feeRow?.listingId, params.listingId, thread?.listingId)
      );
      return;
    }

    const card = $("[data-platform-fee-card]");
    if (card) card.removeAttribute("hidden");
    const catEl = $("[data-platform-fee-category]");
    const listingEl = $("[data-platform-fee-listing]");
    const amountEl = $("[data-platform-fee-amount]");
    const amountDefaultEl = $("[data-platform-fee-amount-default]");
    const rateEl = $("[data-platform-fee-rate]");
    const titleEl = document.querySelector("[data-platform-fee-pay-title]");
    const jobTitleEl = $("[data-platform-fee-job-title]");
    const jobApplicantEl = $("[data-platform-fee-job-applicant]");
    const jobAppliedAtEl = $("[data-platform-fee-job-applied-at]");
    if (catEl) catEl.textContent = Fee.getCategoryLabel(category);
    if (listingEl) listingEl.textContent = displayListingTitle || "取引";
    if (amountEl) amountEl.textContent = formatYen(amount);
    if (amountDefaultEl) amountDefaultEl.textContent = formatYen(amount);
    if (rateEl) {
      rateEl.textContent = isJob ? "やりとり開始利用料" : "5%（最低550円）";
    }
    const noteEl = $("[data-platform-fee-note]");
    const securityEl = $("[data-platform-fee-pay-security]");
    const payBtn = $("[data-platform-fee-pay]");
    if (titleEl) {
      titleEl.textContent = isCompletion
        ? "取引完了手数料のお支払い"
        : isConnectEntry
          ? "お支払い"
          : isJob
            ? "応募者とのやりとりを開始する"
            : "やりとり手数料のお支払い";
    }
    if (isJob && !isCompletion && !isConnectEntry) {
      setJobPayLayout(true);
      const jobCtx = resolveJobApplicationContext(params, thread, displayListingTitle);
      if (jobTitleEl) jobTitleEl.textContent = jobCtx.jobTitle;
      if (jobApplicantEl) jobApplicantEl.textContent = jobCtx.applicantName;
      if (jobAppliedAtEl) jobAppliedAtEl.textContent = jobCtx.appliedAt;
      if (payBtn) payBtn.textContent = "550円を支払ってチャットを始める";
      if (securityEl) securityEl.removeAttribute("hidden");
    } else {
      setJobPayLayout(false);
      if (!isCompletion && !isConnectEntry) {
        setTradePayLayout(true);
        paintTradePayContext(thread, displayListingTitle, amount);
      } else {
        setTradePayLayout(false);
      }
      if (noteEl && !isCompletion) {
        noteEl.textContent = isConnectEntry
          ? "お支払い完了後、やりとりチャットが開始されます。"
          : "お支払い完了後、双方のやりとりチャットを開始できます。";
      }
      if (rateEl && isConnectEntry) {
        rateEl.textContent = "Connect決済（デモ）";
      }
      if (payBtn && !isCompletion) {
        payBtn.textContent = isConnectEntry ? "決済を完了する" : "Stripeで支払う";
      }
      if (securityEl) securityEl.hidden = true;
    }
    document.title = `${titleEl?.textContent || "お支払い"} | TASFUL`;
    setStatus("");

    payBtn?.addEventListener("click", async () => {
      const btn = payBtn;
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        const prev = btn.textContent;
        btn.textContent = "処理中…";
        btn.dataset.platformFeePayPrevLabel = prev || "";
      }
      try {
        if (window.TasuStripeServiceFeeConfig?.isConfigured?.() && !isBenchEmbedFeePay()) {
          const url = await createStripeSession(params.threadId, category, amount, displayListingTitle, params);
          window.location.href = url;
          return;
        }

        const demoPayOk =
          isBenchEmbedFeePay() ||
          window.confirm(
            isCompletion
              ? "デモ環境: Stripe未設定のため、取引完了手数料を支払い済みとして記録しますか？"
              : "デモ環境: Stripe未設定のため、手数料支払い済みとして記録しやりとりチャットを開始しますか？"
          );
        if (demoPayOk) {
          await completePayment(params, feeRow, category, amount);
          return;
        }
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.textContent = pickStr(btn.dataset.platformFeePayPrevLabel, isConnectEntry ? "決済を完了する" : "Stripeで支払う");
        }
      } catch (err) {
        setStatus(err?.message || "お支払いに失敗しました。", true);
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.textContent = pickStr(btn.dataset.platformFeePayPrevLabel, isConnectEntry ? "決済を完了する" : "Stripeで支払う");
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();
