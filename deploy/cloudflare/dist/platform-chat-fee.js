/**
 * プラットフォーム手数料 — Connect有無で徴収タイミングを切替
 * - 求人（Connectなし）: 掲載者がやりとり開始時 550円
 * - スキル / 商品 / 店舗 / 業務 / ワーカー（Connectなし）: 「チャットに進む」を押した側が 550円
 * - Connectあり: 取引完了時 5%（最低550円）
 */
(function (global) {
  "use strict";

  const FEE_RATE = 0.05;
  const MIN_FEE_YEN = 550;
  const JOB_CHAT_FEE_YEN = 550;
  const STORAGE_KEY = "tasful_platform_chat_fees_v1";

  const FEE_CATEGORY_KEYS = new Set([
    "skill",
    "product",
    "worker",
    "general",
    "business_service",
    "business-service",
    "business",
    "shop_store",
    "shop-store",
    "shop",
    "builder",
  ]);

  const CATEGORY_LABELS = Object.freeze({
    skill: "スキル",
    product: "商品",
    worker: "ワーカー",
    business_service: "業務サービス",
    "business-service": "業務サービス",
    business: "業務サービス",
    shop_store: "店舗販売",
    "shop-store": "店舗販売",
    shop: "店舗販売",
    job: "求人",
    general: "一般案件",
    builder: "Builder",
  });

  function pushJobHireFlowDiag(step, detail) {
    try {
      const entry = { step, at: new Date().toISOString(), ...(detail || {}) };
      const attach = (win) => {
        if (!win) return;
        const bag = (win.__tasuJobHireFlowDiag =
          win.__tasuJobHireFlowDiag || { startedAt: new Date().toISOString(), events: [] });
        bag.events.push(entry);
        bag.last = entry;
      };
      attach(global);
      try {
        if (global.parent && global.parent !== global) attach(global.parent);
        if (global.top && global.top !== global) attach(global.top);
      } catch {
        /* ignore */
      }
      console.info("[job-hire-flow-diag]", step, detail || "");
    } catch {
      /* ignore */
    }
  }

  const NOTIFY_TYPES = Object.freeze({
    skill: "skill",
    product: "product",
    worker: "worker",
    business_service: "business",
    "business-service": "business",
    business: "business",
    shop_store: "shop",
    "shop-store": "shop",
    shop: "shop",
    job: "job",
    general: "general",
    builder: "builder",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function parsePriceYen(raw) {
    if (global.TasuShopCheckout?.parsePriceYen) {
      return global.TasuShopCheckout.parsePriceYen(raw);
    }
    const digits = String(raw ?? "").replace(/[^\d]/g, "");
    return digits ? Math.round(Number(digits)) : 0;
  }

  function extractListingAmount(listing) {
    if (!listing || typeof listing !== "object") return 0;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const candidates = [
      listing.price_yen,
      listing.price_amount,
      listing.priceNum,
      fd.price_yen,
      fd.price_amount,
      fd.price,
      listing.price,
      listing.main_price_text,
      listing.budget,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const n = Number(candidates[i]);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
      const parsed = parsePriceYen(candidates[i]);
      if (parsed > 0) return parsed;
    }
    return 0;
  }

  function normalizeCategoryKey(raw) {
    const key = pickStr(raw).toLowerCase().replace(/-/g, "_");
    if (key === "shop") return "shop_store";
    if (key === "business" || key === "field_service") return "business_service";
    return key;
  }

  function resolveCategoryKey(listing) {
    if (listing?.scope === "general" || listing?._detail_page_type === "general") {
      return "general";
    }
    const fromListing = pickStr(
      listing?.listing_type,
      listing?.listingType,
      listing?.type,
      listing?.category,
      global.document?.body?.dataset?.detailType
    );
    return normalizeCategoryKey(fromListing);
  }

  function isFeeApplicableCategory(categoryKey) {
    return FEE_CATEGORY_KEYS.has(normalizeCategoryKey(categoryKey));
  }

  function isJobCategory(categoryKey) {
    return normalizeCategoryKey(categoryKey) === "job";
  }

  function getCategoryLabel(categoryKey) {
    return CATEGORY_LABELS[normalizeCategoryKey(categoryKey)] || "取引";
  }

  function getNotifyType(categoryKey) {
    return NOTIFY_TYPES[normalizeCategoryKey(categoryKey)] || "skill";
  }

  function readAllFees() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAllFees(list) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch (err) {
      console.warn("[TasuPlatformChatFee] save failed:", err);
    }
  }

  function resolveFeeKey(ctx) {
    const threadId = pickStr(ctx?.threadId, ctx?.thread_id);
    if (threadId && !threadId.startsWith("deferred:")) return threadId;
    const contactId = pickStr(ctx?.contactId, ctx?.contact_id);
    if (contactId) return `deferred:contact:${contactId}`;
    const applicationId = pickStr(ctx?.applicationId, ctx?.application_id);
    if (applicationId) return `deferred:application:${applicationId}`;
    const requestId = pickStr(ctx?.requestId, ctx?.request_id);
    if (requestId) return `deferred:request:${requestId}`;
    return threadId;
  }

  function getFeeRecord(threadId) {
    const id = pickStr(threadId);
    if (!id) return null;
    return readAllFees().find((row) => pickStr(row.threadId, row.thread_id) === id) || null;
  }

  function getFeeRecordByContext(ctx) {
    const key = resolveFeeKey(ctx);
    if (key) {
      const byKey = getFeeRecord(key);
      if (byKey) return byKey;
    }
    const contactId = pickStr(ctx?.contactId, ctx?.contact_id);
    if (contactId) {
      return readAllFees().find((row) => pickStr(row.contactId) === contactId) || null;
    }
    const applicationId = pickStr(ctx?.applicationId, ctx?.application_id);
    if (applicationId) {
      return readAllFees().find((row) => pickStr(row.applicationId) === applicationId) || null;
    }
    const requestId = pickStr(ctx?.requestId, ctx?.request_id);
    if (requestId) {
      return readAllFees().find((row) => pickStr(row.requestId) === requestId) || null;
    }
    return null;
  }

  function isFeePaidForContext(ctx) {
    const row = getFeeRecordByContext(ctx);
    if (!row) return false;
    if (pickStr(row.status).toLowerCase() === "paid") return true;
    const realThreadId = pickStr(row.realThreadId);
    if (realThreadId) return isFeePaid(realThreadId);
    const threadId = pickStr(row.threadId);
    if (threadId && !String(threadId).startsWith("deferred:")) return isFeePaid(threadId);
    return false;
  }

  function upsertFeeRecord(patch) {
    const threadId = pickStr(patch?.threadId, patch?.thread_id);
    if (!threadId) return null;
    const list = readAllFees();
    const idx = list.findIndex((row) => pickStr(row.threadId, row.thread_id) === threadId);
    const now = new Date().toISOString();
    const prev = idx >= 0 ? list[idx] : {};
    const next = {
      ...prev,
      ...patch,
      threadId,
      updatedAt: now,
      createdAt: pickStr(prev.createdAt) || now,
    };
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    writeAllFees(list);
    return next;
  }

  function isFeePaid(threadId) {
    const row = getFeeRecord(threadId);
    return pickStr(row?.status).toLowerCase() === "paid";
  }

  function markFeePaid(threadId, extra) {
    return upsertFeeRecord({
      threadId,
      status: "paid",
      paidAt: new Date().toISOString(),
      ...(extra && typeof extra === "object" ? extra : {}),
    });
  }

  function calcPlatformFee(amountYen) {
    const base = Math.max(0, Math.round(Number(amountYen) || 0));
    const raw = Math.round(base * FEE_RATE);
    return Math.max(MIN_FEE_YEN, raw);
  }

  function calcJobChatFee() {
    return JOB_CHAT_FEE_YEN;
  }

  function calcPreChatFee(listing) {
    const cat = resolveCategoryKey(listing);
    if (isJobCategory(cat)) return calcJobChatFee();
    const amount = extractListingAmount(listing);
    return calcPlatformFee(amount > 0 ? amount : MIN_FEE_YEN);
  }

  function calcCompletionFee(amountYen) {
    return calcPlatformFee(amountYen);
  }

  function readConnectOverride() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      const q = params.get("platform_connect");
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
      const demo = params.get("demoConnect");
      if (demo === "1" || demo === "true") return true;
      if (demo === "0" || demo === "false") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function hasStripeConnect(listing, categoryKey) {
    const cat = normalizeCategoryKey(categoryKey || resolveCategoryKey(listing));
    if (isJobCategory(cat)) return false;

    const override = readConnectOverride();
    if (override === true) return true;
    if (override === false) return false;

    if (!listing || typeof listing !== "object") return false;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra =
      listing.category_extra?.shop_store && typeof listing.category_extra.shop_store === "object"
        ? listing.category_extra.shop_store
        : {};

    if (listing.platform_connect_enabled === true || fd.platform_connect_enabled === true) {
      return true;
    }

    if (cat === "shop_store" || cat === "shop") {
      const shopConnect = global.TasuPlatformChatCategoryFlow?.isCategoryConnectEnabled?.(
        listing,
        cat
      );
      if (typeof shopConnect === "boolean") return shopConnect;
      const payout = global.TasuShopPayout?.extractShopPayout?.(listing);
      return Boolean(payout?.payout_enabled && payout?.stripe_account_id);
    }

    if (cat === "business_service" || cat === "business") {
      const bizConnect = global.TasuPlatformChatCategoryFlow?.isCategoryConnectEnabled?.(
        listing,
        cat
      );
      if (typeof bizConnect === "boolean") return bizConnect;
    }

    return Boolean(
      listing.stripe_connect_account_id ||
        listing.stripe_account_id ||
        fd.stripe_connect_account_id ||
        fd.stripe_account_id ||
        extra.stripe_account_id
    );
  }

  function shouldGateChatStart(listing) {
    const cat = resolveCategoryKey(listing);
    const Category = global.TasuPlatformChatCategoryFlow;
    if (
      Category?.isConnectRequiredCategory?.(cat) &&
      Category?.isCategoryConnectEnabled?.(listing, cat) !== true
    ) {
      return false;
    }
    if (hasStripeConnect(listing, cat)) return false;
    if (isJobCategory(cat)) return true;
    if (Category?.isConnectFreeFeeCategory?.(cat)) return true;
    return isFeeApplicableCategory(cat);
  }

  /** Connectなしのみ — 550円やりとり開始料（Connect / Connect入口決済では常に false） */
  function requiresConversationStartFee(threadOrListing, options) {
    const thread =
      threadOrListing &&
      typeof threadOrListing === "object" &&
      pickStr(threadOrListing.id, threadOrListing.threadId)
        ? threadOrListing
        : null;
    const listing =
      thread != null
        ? {
            id: thread.listingId,
            listing_type: thread.listingType,
            listingType: thread.listingType,
            category: thread.category,
          }
        : threadOrListing;
    const cat = resolveCategoryKey(listing || thread);
    const Entry = global.TasuPlatformChatConnectEntryFlow;
    const Category = global.TasuPlatformChatCategoryFlow;
    if (Entry?.readConnectEntryPaymentFromUrl?.() === true) return false;
    if (Category?.isMarketplaceConnectEntryThread?.(thread) === true) return false;
    if (hasStripeConnect(listing, cat)) return false;
    if (Entry?.isConnectEntryThread?.(thread) === true) {
      return false;
    }
    if (
      thread &&
      Category?.usesConnectEntryPayment?.(listing) === true &&
      (pickStr(thread.platformStartPhase) === "awaiting_partner" ||
        pickStr(thread.roomStatus, thread.status).toLowerCase() === "fee_pending")
    ) {
      return false;
    }
    const Gate = global.TasuPlatformChatContactGate;
    if (thread && Gate?.isConnectThread?.(thread) === true) return false;
    if (!shouldGateChatStart(listing)) return false;
    if (thread) {
      const rs = pickStr(thread.roomStatus, thread.status).toLowerCase();
      if (rs !== "fee_pending") return false;
      if (Gate?.isGatedPlainThread?.(thread) !== true) return false;
    }
    return true;
  }

  function shouldNotifyOnCompletion(listing) {
    const cat = resolveCategoryKey(listing);
    if (isJobCategory(cat)) return false;
    if (global.TasuPlatformChatCategoryFlow?.usesConnectEntryPayment?.(listing) === true) {
      return false;
    }
    if (!isFeeApplicableCategory(cat)) return false;
    return hasStripeConnect(listing, cat);
  }

  function buildFeePayUrl(detail) {
    const u = new URL("platform-chat-fee-pay.html", global.location?.href || "http://localhost/");
    const threadId = pickStr(detail?.threadId, detail?.thread_id, detail?.thread?.id);
    const listingId = pickStr(detail?.listingId, detail?.listing_id, detail?.listing?.id);
    const category = normalizeCategoryKey(detail?.category || resolveCategoryKey(detail?.listing));
    const notifyId = pickStr(detail?.notificationId, detail?.notifyId);
    if (threadId) u.searchParams.set("thread", threadId);
    if (listingId) u.searchParams.set("listingId", listingId);
    if (category) u.searchParams.set("category", category);
    if (notifyId) u.searchParams.set("notify", notifyId);
    if (detail?.dealId) u.searchParams.set("deal", String(detail.dealId));
    if (detail?.roomId) u.searchParams.set("roomId", String(detail.roomId));
    const applicationId = pickStr(detail?.applicationId, detail?.application_id);
    if (applicationId) u.searchParams.set("applicationId", applicationId);
    const contactId = pickStr(detail?.contactId, detail?.contact_id);
    if (contactId) u.searchParams.set("contactId", contactId);
    const requestId = pickStr(detail?.requestId, detail?.request_id);
    if (requestId) u.searchParams.set("requestId", requestId);
    const from = pickStr(detail?.from);
    if (from) u.searchParams.set("from", from);
    return u.pathname + u.search;
  }

  function buildChatUrl(thread) {
    const threadId = pickStr(thread?.id, thread);
    if (!threadId) {
      return global.TasuTalkChatEntryUrl?.buildTalkChatHubUrl?.() || "talk-home.html?tab=chat";
    }
    if (global.TasuChatThreadStore?.chatListUrl) {
      return global.TasuChatThreadStore.chatListUrl(threadId);
    }
    return `talk-home.html?tab=chat&thread=${encodeURIComponent(threadId)}`;
  }

  function buildChatDetailUrl(detail) {
    const threadId = pickStr(detail?.threadId, detail?.thread?.id);
    const roomId = pickStr(detail?.roomId, detail?.room?.id, detail?.deal?.chat_id);
    const dealId = pickStr(detail?.dealId, detail?.deal?.id);
    let href = "";
    if (roomId) {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("roomId", roomId);
      u.searchParams.set("room", roomId);
      if (dealId) u.searchParams.set("deal", dealId);
      href = u.pathname + u.search;
    } else if (threadId) {
      href = `chat-detail.html?thread=${encodeURIComponent(threadId)}`;
    } else {
      return buildChatUrl({ id: threadId });
    }
    const Entry = global.TasuPlatformChatConnectEntryFlow;
    if (Entry?.shouldAppendConnectEntryUrlParams?.(detail) === true) {
      return Entry.appendConnectEntryUrlParams(href, detail);
    }
    return href;
  }

  function buildCompletionNotifyChatUrl(detail) {
    if (global.TasuPlatformChatCompletion?.buildNotifyChatUrl) {
      const built = global.TasuPlatformChatCompletion.buildNotifyChatUrl(detail);
      if (built && built !== "#") return built;
    }
    const dealId = pickStr(detail?.dealId, detail?.deal?.id);
    const roomId = pickStr(detail?.roomId, detail?.room?.id, detail?.deal?.chat_id);
    const threadId = pickStr(detail?.threadId, detail?.thread?.id);
    const category = normalizeCategoryKey(detail?.category || resolveCategoryKey(detail?.listing));
    if (
      global.TasuPlatformChatCategoryFlow?.isWorkerFlowCategory?.(category) === true &&
      (roomId || dealId)
    ) {
      return buildChatDetailUrl({ roomId, dealId, threadId });
    }
    if (threadId || roomId) return buildChatDetailUrl({ threadId, roomId, dealId });
    return buildChatUrl({ id: threadId });
  }

  /** @deprecated 完了通知は deal-detail ではなくやりとりチャットへ */
  function buildDealDetailUrl(detail) {
    return buildCompletionNotifyChatUrl(detail);
  }

  function notifyNonJobDemoChatStartedAfterPayment(activated) {
    const thread = activated?.thread;
    const threadId = pickStr(activated?.threadId, thread?.id);
    if (!thread || !threadId) return { ok: false, reason: "missing_thread" };
    const categoryKey = normalizeCategoryKey(
      pickStr(thread.listingType, thread.listing_type, resolveCategoryKey({ listing_type: thread.listingType }))
    );
    const listing = {
      id: thread.listingId,
      title: thread.listingTitle,
      listing_type: categoryKey,
    };
    const detail = { thread, threadId, listing, categoryKey };
    const purchaseKeys = new Set([
      "skill",
      "product",
      "worker",
      "general",
      "business_service",
      "business",
      "shop_store",
      "shop",
    ]);
    if (purchaseKeys.has(categoryKey) || categoryKey === "job") {
      const Demo = global.TasuPlatformChatDualWindowDemo;
      const profile =
        Demo?.resolveProfileForThread?.(thread) || Demo?.resolveProfileForListingThread?.(thread);
      const partners = Demo?.resolveBenchPartnerIds?.(profile, thread) || {};
      const result = global.TasuTalkPlatformNotify?.notifyPurchaseChatStartedAfterPayment?.({
        ...detail,
        actorAId: pickStr(partners.sellerId, thread?.sellerId),
        actorBId: pickStr(partners.buyerId, thread?.buyerId, detail?.buyerId),
      });
      if (!result?.ok) {
        postBenchChatStartedFromThread(thread);
      }
      return result || { ok: false, reason: "purchase_notify_missing" };
    }
    const started = global.TasuPlatformChatDualWindowNotify?.notifyDemoChatStarted?.({
      thread,
      threadId,
      payerId: thread?.sellerId,
    });
    if (!started?.ok) {
      postBenchChatStartedFromThread(thread);
    }
    return started || { ok: false, reason: "chat_started_notify_missing" };
  }

  function postBenchChatStartedFromThread(thread, app) {
    const threadId = pickStr(thread?.id);
    if (!threadId) return false;
    try {
      const ok =
        global.TasuPlatformChatBenchEmbed?.postBenchChatStarted?.({
          thread,
          threadId,
          buyerId: pickStr(thread?.buyerId, app?.applicant_id),
        }) === true;
      pushJobHireFlowDiag("benchChatStarted:post", { ok, threadId });
      return ok;
    } catch (err) {
      pushJobHireFlowDiag("benchChatStarted:post", { ok: false, threadId, error: String(err?.message || err) });
      return false;
    }
  }

  /** 求人550円後 — 2窓ベンチへ A/B chat-detail 遷移（応募者通知は notifyJobHiredToApplicant で送る） */
  function emitJobHirePostPayBenchSignals(activated, app) {
    const thread = activated?.thread;
    const threadId = pickStr(activated?.threadId, thread?.id);
    if (!thread || !threadId) return;
    postBenchChatStartedFromThread(thread, app);
  }

  function logJobHireNotifyStorage(applicantRow, app, activated) {
    try {
      const key = global.TasuTalkNotifications?.STORAGE_KEY || "tasful_talk_notifications";
      const all = JSON.parse(global.localStorage.getItem(key) || "[]");
      const buyerId = pickStr(
        applicantRow?.recipientUserId,
        app?.applicant_id,
        activated?.thread?.buyerId
      );
      const hired = (Array.isArray(all) ? all : []).filter(
        (n) =>
          String(n.recipientUserId) === String(buyerId) &&
          String(n.title || "").includes("承諾")
      );
      console.info("[job-hire-notify] tasful_talk_notifications saved", {
        notifyJobHiredToApplicantCalled: Boolean(applicantRow),
        recipientUserId: buyerId || null,
        storageTotal: all.length,
        hiredForApplicant: hired.length,
      });
    } catch (err) {
      console.warn("[job-hire-notify] storage log failed:", err);
    }
  }

  function ensureJobHireThreadReadyForNotify(activated) {
    const jobStore = global.TasuJobApplicationsStore;
    const store = global.TasuChatThreadStore;
    const baseThread = activated?.thread || {};
    const listingId = pickStr(baseThread.listingId, activated?.listingId);
    const applicationId = pickStr(baseThread.applicationId, activated?.applicationId);

    jobStore?.finalizeHireAfterPayment?.(baseThread);

    const listing = jobStore?.resolveListing?.(listingId);
    const app =
      jobStore?.findApplication?.(listingId, applicationId) || activated?.application || null;

    const ensured = store?.ensureChatThreadForAcceptedJob?.({
      listing,
      application: app,
      thread: baseThread,
    });
    const thread = ensured?.thread || baseThread;
    const threadId = pickStr(thread?.id, activated?.threadId, baseThread?.id);

    if (threadId && app && !pickStr(app.thread_id)) {
      jobStore?.finalizeHireAfterPayment?.(thread);
    }

    const threadExists = store?.threadExists?.(threadId) === true;
    const roomExists = store?.roomExists?.(threadId) === true;

    return {
      listing,
      app,
      thread,
      threadId,
      threadExists,
      roomExists,
      ensured,
    };
  }

  function notifyJobHireAfterPayment(activated) {
    const ready = ensureJobHireThreadReadyForNotify(activated);
    const { listing, app, thread, threadId, threadExists, roomExists, ensured } = ready;

    pushJobHireFlowDiag("notifyJobHiredToApplicant:call", {
      threadId,
      applicantId: pickStr(app?.applicant_id, thread?.buyerId),
      threadExists,
      roomExists,
      ensured: ensured?.ok === true,
      created: ensured?.created === true,
    });
    if (!threadId || !threadExists || !roomExists) {
      pushJobHireFlowDiag("notifyJobHiredToApplicant:skip", {
        reason: "thread_not_ready_before_notify",
        threadId,
        threadExists,
        roomExists,
        listingId: pickStr(thread?.listingId, app?.job_id),
        applicationId: pickStr(thread?.applicationId, app?.application_id),
      });
      return app;
    }
    const notifyDetail = { listing, application: app, thread };
    const chatOpened = global.TasuTalkPlatformNotify?.notifyJobChatOpenedToBoth?.(notifyDetail);
    pushJobHireFlowDiag("notifyJobChatOpenedToBoth:ok", {
      called: Boolean(chatOpened?.ok),
      posterRow: Boolean(chatOpened?.posterRow),
      applicantRow: Boolean(chatOpened?.applicantRow),
      threadId,
    });
    const applicantRow = global.TasuTalkPlatformNotify?.notifyJobHiredToApplicant?.(notifyDetail);
    pushJobHireFlowDiag("notifyJobHiredToApplicant:ok", {
      called: Boolean(applicantRow),
      notificationId: pickStr(applicantRow?.id),
      recipientUserId: pickStr(applicantRow?.recipientUserId),
      title: pickStr(applicantRow?.title),
      href: pickStr(applicantRow?.href, applicantRow?.targetUrl),
      threadId,
      roomId: threadId,
    });
    const posterRow = global.TasuTalkPlatformNotify?.notifyJobHiredToPoster?.(notifyDetail);
    pushJobHireFlowDiag("notifyJobHiredToPoster:ok", {
      called: Boolean(posterRow),
      notificationId: pickStr(posterRow?.id),
      recipientUserId: pickStr(posterRow?.recipientUserId),
      title: pickStr(posterRow?.title),
      href: pickStr(posterRow?.href, posterRow?.targetUrl),
      threadId,
      roomId: threadId,
      threadParticipants: thread?.threadParticipants || thread?.participantIds || [],
    });
    const posterId = pickStr(
      posterRow?.recipientUserId,
      thread?.posterUserId,
      thread?.sellerId,
      global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(thread?.listingId, listing)
    );
    const applicantId = pickStr(
      applicantRow?.recipientUserId,
      app?.applicant_id,
      thread?.buyerId,
      thread?.applicantUserId
    );
    try {
      global.TasuTalkPlatformNotify?.refreshBenchNotifyForCompletionRecipients?.(posterId, applicantId);
    } catch {
      /* ignore */
    }
    logJobHireNotifyStorage(applicantRow, app, activated);
    emitJobHirePostPayBenchSignals({ ...activated, thread, threadId }, app);
    return app;
  }

  function activateThreadAfterPayment(threadId) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread_id" };
    const store = global.TasuChatThreadStore;
    const activated = store?.activateThreadAfterFeePaid?.(id);
    if (!activated?.ok) return activated || { ok: false, reason: "activate_failed" };
    markFeePaid(id, { activatedAt: new Date().toISOString() });
    try {
      if (String(activated.thread?.threadKind || "") === "job_hire") {
        notifyJobHireAfterPayment(activated);
      }
      const isDemoThread = global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(id) === true;
      const isJobHire = String(activated.thread?.threadKind || "") === "job_hire";
      if (isDemoThread && !isJobHire) {
        const started = notifyNonJobDemoChatStartedAfterPayment(activated);
        if (!started?.ok) {
          global.TasuTalkPlatformFeeNotify?.notifyChatActivated?.({
            thread: activated.thread,
            listing: {
              id: activated.thread?.listingId,
              title: activated.thread?.listingTitle,
              listing_type: activated.thread?.listingType,
            },
            notifyRequesterOnly: true,
          });
        }
      } else if (!isDemoThread) {
        global.TasuTalkPlatformFeeNotify?.notifyChatActivated?.({
          thread: activated.thread,
          listing: {
            id: activated.thread?.listingId,
            title: activated.thread?.listingTitle,
            listing_type: activated.thread?.listingType || "job",
          },
          notifyRequesterOnly: !isJobHire,
        });
      }
    } catch (err) {
      console.warn("[TasuPlatformChatFee] post-pay notify skipped:", err);
    }
    return activated;
  }

  function ensurePendingFeeDeferred(detail) {
    const listing = detail?.listing;
    const contactId = pickStr(detail?.contactId, detail?.contact_id);
    const applicationId = pickStr(detail?.applicationId, detail?.application_id);
    const requestId = pickStr(detail?.requestId, detail?.request_id);
    const feeKey = resolveFeeKey({ contactId, applicationId, requestId });
    if (!feeKey) return null;
    const category = resolveCategoryKey(listing);
    const isJob = isJobCategory(category);
    const amount =
      detail?.feeAmount != null
        ? Math.round(Number(detail.feeAmount))
        : isJob
          ? calcJobChatFee()
          : calcPreChatFee(listing);
    return upsertFeeRecord({
      threadId: feeKey,
      contactId: contactId || undefined,
      applicationId: applicationId || undefined,
      requestId: requestId || undefined,
      listingId: pickStr(listing?.id, listing?.listing_id, detail?.listingId),
      listingTitle: pickStr(listing?.title, detail?.listingTitle),
      category,
      feeAmount: amount,
      feeRate: isJob ? 0 : FEE_RATE,
      minFeeYen: isJob ? JOB_CHAT_FEE_YEN : MIN_FEE_YEN,
      connectMode: isJob ? "job_flat" : "prepay",
      feePhase: "pre_chat",
      status: "pending",
      deferred: true,
    });
  }

  function migrateFeeRecordToThread(oldKey, threadId) {
    const oldRow = getFeeRecord(oldKey);
    if (!oldRow) return upsertFeeRecord({ threadId, status: "paid", paidAt: new Date().toISOString() });
    const list = readAllFees().filter((row) => pickStr(row.threadId, row.thread_id) !== oldKey);
    writeAllFees(list);
    return upsertFeeRecord({
      ...oldRow,
      threadId,
      realThreadId: threadId,
      deferred: false,
      status: "paid",
      paidAt: pickStr(oldRow.paidAt) || new Date().toISOString(),
    });
  }

  async function activateDeferredAfterPayment(ctx) {
    const feeRow = getFeeRecordByContext(ctx);
    const feeKey = pickStr(feeRow?.threadId);
    const contactId = pickStr(ctx?.contactId, feeRow?.contactId);
    const applicationId = pickStr(ctx?.applicationId, feeRow?.applicationId);
    const requestId = pickStr(ctx?.requestId, feeRow?.requestId);
    const listingId = pickStr(ctx?.listingId, feeRow?.listingId);
    pushJobHireFlowDiag("activateDeferredAfterPayment:start", {
      feeKey,
      contactId,
      applicationId,
      requestId,
      listingId,
    });
    const threadStore = global.TasuChatThreadStore;
    if (!threadStore) {
      pushJobHireFlowDiag("activateDeferredAfterPayment:fail", { reason: "thread_store_missing" });
      return { ok: false, reason: "thread_store_missing" };
    }

    let threadResult = null;

    if (contactId) {
      const Contacts = global.TasuListingContactRequestsStore;
      const contact = Contacts?.findById?.(contactId);
      if (!contact) return { ok: false, reason: "contact_not_found" };
      const listing = Contacts.resolveListing(contact.listing_id);
      threadResult = await Promise.resolve(
        threadStore.createThreadFromContact?.(listing, contact, { feePending: false })
      );
      if (!threadResult?.ok || !threadResult.thread) return threadResult || { ok: false };
      Contacts.finalizeContactAfterPayment(contactId, threadResult.thread.id);
    } else if (applicationId) {
      const jobStore = global.TasuJobApplicationsStore;
      const listing = jobStore?.resolveListing?.(listingId);
      const app = jobStore?.findApplication?.(listingId, applicationId);
      if (!listing || !app) return { ok: false, reason: "application_not_found" };
      threadResult = await Promise.resolve(
        threadStore.createHireThread?.(listing, app, { feePending: false })
      );
      if (!threadResult?.ok || !threadResult.thread) return threadResult || { ok: false };
      jobStore.finalizeHireAfterPayment?.(threadResult.thread);
    } else if (requestId) {
      const workerStore = global.TasuWorkerRequestsStore;
      const listing = workerStore?.resolveListing?.(listingId);
      const req = workerStore?.findRequest?.(listingId, requestId);
      if (!listing || !req) return { ok: false, reason: "request_not_found" };
      threadResult = await Promise.resolve(
        threadStore.createWorkerRequestThread?.(listing, req, { feePending: false })
      );
      if (!threadResult?.ok || !threadResult.thread) return threadResult || { ok: false };
      workerStore.finalizeRequestAfterPayment?.(requestId, threadResult.thread.id);
    } else {
      return { ok: false, reason: "missing_deferred_context" };
    }

    const realThreadId = threadResult.thread.id;
    if (feeKey) migrateFeeRecordToThread(feeKey, realThreadId);
    else markFeePaid(realThreadId, { activatedAt: new Date().toISOString() });

    const activated = await Promise.resolve(threadStore.activateThreadAfterFeePaid?.(realThreadId));
    if (!activated?.ok) {
      pushJobHireFlowDiag("activateDeferredAfterPayment:fail", {
        reason: activated?.reason || "activate_failed",
        threadId: realThreadId,
      });
      return activated || { ok: false, reason: "activate_failed" };
    }

    try {
      const isJobHire = String(activated.thread?.threadKind || "") === "job_hire";
      pushJobHireFlowDiag("activateDeferredAfterPayment:ok", {
        threadId: realThreadId,
        threadKind: activated.thread?.threadKind || "",
        isJobHire,
      });
      if (isJobHire) {
        notifyJobHireAfterPayment({ ...activated, threadId: realThreadId });
      } else {
        const isDemoThread = global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(realThreadId) === true;
        if (isDemoThread) {
          const started = notifyNonJobDemoChatStartedAfterPayment({ ...activated, threadId: realThreadId });
          if (!started?.ok) {
            global.TasuTalkPlatformFeeNotify?.notifyChatActivated?.({
              thread: activated.thread,
              listing: {
                id: activated.thread?.listingId,
                title: activated.thread?.listingTitle,
                listing_type: activated.thread?.listingType,
              },
              notifyRequesterOnly: true,
            });
            postBenchChatStartedFromThread(activated.thread);
          }
        } else {
          global.TasuTalkPlatformFeeNotify?.notifyChatActivated?.({
            thread: activated.thread,
            listing: {
              id: activated.thread?.listingId,
              title: activated.thread?.listingTitle,
              listing_type: activated.thread?.listingType,
            },
            notifyRequesterOnly: true,
          });
          postBenchChatStartedFromThread(activated.thread);
        }
      }
    } catch (err) {
      console.warn("[TasuPlatformChatFee] deferred post-pay notify skipped:", err);
    }

    return { ok: true, thread: activated.thread, threadId: realThreadId };
  }

  function ensurePendingFee(listing, thread, options) {
    const threadId = pickStr(thread?.id);
    if (!threadId) return null;
    const category = resolveCategoryKey(listing);
    const isJob = isJobCategory(category);
    const amount =
      options?.feeAmount != null
        ? Math.round(Number(options.feeAmount))
        : isJob
          ? calcJobChatFee()
          : calcPreChatFee(listing);
    return upsertFeeRecord({
      threadId,
      listingId: pickStr(listing?.id, listing?.listing_id, thread?.listingId),
      listingTitle: pickStr(listing?.title, thread?.listingTitle),
      category,
      feeAmount: amount,
      feeRate: isJob ? 0 : FEE_RATE,
      minFeeYen: isJob ? JOB_CHAT_FEE_YEN : MIN_FEE_YEN,
      connectMode: isJob ? "job_flat" : "prepay",
      feePhase: "pre_chat",
      status: "pending",
    });
  }

  function ensurePendingCompletionFee(detail) {
    const threadId = pickStr(detail?.threadId, detail?.thread?.id);
    if (!threadId) return null;
    const category = normalizeCategoryKey(detail?.category || resolveCategoryKey(detail?.listing));
    const amount =
      detail?.feeAmount != null
        ? Math.round(Number(detail.feeAmount))
        : calcCompletionFee(detail?.agreedAmount);
    return upsertFeeRecord({
      threadId,
      dealId: pickStr(detail?.dealId, detail?.deal?.id),
      listingId: pickStr(detail?.listingId, detail?.listing?.id),
      listingTitle: pickStr(detail?.listingTitle, detail?.listing?.title),
      category,
      feeAmount: amount,
      feeRate: FEE_RATE,
      minFeeYen: MIN_FEE_YEN,
      connectMode: "connect",
      feePhase: "on_complete",
      status: "pending",
    });
  }

  function buildCompletionFeePayUrl(detail) {
    const u = new URL("platform-chat-fee-pay.html", global.location?.href || "http://localhost/");
    const threadId = pickStr(detail?.threadId, detail?.thread?.id);
    const listingId = pickStr(detail?.listingId, detail?.listing?.id);
    const category = normalizeCategoryKey(detail?.category || resolveCategoryKey(detail?.listing));
    const dealId = pickStr(detail?.dealId, detail?.deal?.id);
    if (threadId) u.searchParams.set("thread", threadId);
    if (listingId) u.searchParams.set("listingId", listingId);
    if (category) u.searchParams.set("category", category);
    if (dealId) u.searchParams.set("deal", dealId);
    u.searchParams.set("phase", "complete");
    return u.pathname + u.search;
  }

  function completeCompletionFeePayment(threadId, extra) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread_id" };
    const row = getFeeRecord(id);
    if (pickStr(row?.feePhase) !== "on_complete") {
      return { ok: false, reason: "not_completion_fee" };
    }
    markFeePaid(id, {
      ...(extra && typeof extra === "object" ? extra : {}),
      feePhase: "on_complete",
      connectMode: "connect",
    });
    return { ok: true, threadId: id };
  }

  global.TasuPlatformChatFee = {
    FEE_RATE,
    MIN_FEE_YEN,
    JOB_CHAT_FEE_YEN,
    STORAGE_KEY,
    readAllFees,
    calcPlatformFee,
    calcJobChatFee,
    calcPreChatFee,
    calcCompletionFee,
    resolveCategoryKey,
    normalizeCategoryKey,
    isFeeApplicableCategory,
    isJobCategory,
    getCategoryLabel,
    getNotifyType,
    hasStripeConnect,
    shouldGateChatStart,
    requiresConversationStartFee,
    shouldNotifyOnCompletion,
    resolveFeeKey,
    getFeeRecord,
    getFeeRecordByContext,
    isFeePaidForContext,
    upsertFeeRecord,
    migrateFeeRecordToThread,
    isFeePaid,
    markFeePaid,
    ensurePendingFee,
    ensurePendingFeeDeferred,
    pushJobHireFlowDiag,
    activateDeferredAfterPayment,
    ensurePendingCompletionFee,
    completeCompletionFeePayment,
    activateThreadAfterPayment,
    buildFeePayUrl,
    buildCompletionFeePayUrl,
    buildChatUrl,
    buildChatDetailUrl,
    buildCompletionNotifyChatUrl,
    buildDealDetailUrl,
    extractListingAmount,
    notifyNonJobDemoChatStartedAfterPayment,
    postBenchChatStartedFromThread,
  };
})(typeof window !== "undefined" ? window : globalThis);
