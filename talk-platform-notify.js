/**
 * TASFUL TALK — プラットフォーム各画面から通知タブへ流し込み（localStorage のみ）
 * talk-notifications-store.js の後に読み込む。未読込時は no-op。
 */
(function (global) {
  "use strict";

  const BUILDER_TARGET = "builder/mvp-threads.html";
  const ANPI_TARGET = "anpi-notifications.html";
  const ANPI_URGENT_TARGET = "anpi-dashboard.html#check";

  /** 緊急系 — TALKタップで安否確認ページへ直遷移 */
  const ANPI_URGENT_TALK_EVENT_TYPES = new Set([
    "urgent_keyword_detected",
    "emergency",
    "anpi_alert",
    "manual_alert",
  ]);

  /** 安否ログ → TALK 通知（頻度の高いデモ・連携解除は除外） */
  const ANPI_TALK_EVENT_TYPES = new Set([
    "urgent_keyword_detected",
    "emergency",
    "anpi_alert",
    "manual_alert",
    "call_consent_opened",
    "call_consent_accepted",
    "call_consent_cancelled",
    "ai_search",
    "line_test_push",
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function formatJobNotifyEventLabel(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function resolveListingCompanyName(listing) {
    const formData =
      listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    return (
      pickStr(
        listing?.company_name,
        formData.company,
        listing?.seller_name,
        listing?.sellerName,
        listing?.poster_name
      ) || "掲載者"
    );
  }

  function buildJobNotifyCardFields(detail, kind) {
    const listing = detail?.listing || {};
    const application = detail?.application || {};
    const thread = detail?.thread || {};
    const listingTitle = pickStr(listing.title, thread.listingTitle) || "求人";
    let supplementLine = "";
    let eventAt = pickStr(detail?.eventAt, application.updated_at, application.created_at);

    if (kind === "apply") {
      supplementLine = `応募者：${pickStr(application.applicant_name) || "応募者"}`;
      eventAt = pickStr(application.created_at, eventAt);
    } else if (kind === "hired") {
      supplementLine = `掲載者：${resolveListingCompanyName(listing)}`;
      eventAt = pickStr(application.updated_at, application.selected_at, application.hired_at, eventAt);
    } else if (kind === "complete_request") {
      const flow = global.TasuPlatformChatCompletionFlow;
      supplementLine = flow?.formatNotifyRequestFrom
        ? flow.formatNotifyRequestFrom(
            pickStr(detail?.requesterName),
            thread,
            pickStr(detail?.requesterId, thread?.completionRequestedBy)
          )
        : pickStr(detail?.requesterName)
          ? `${detail.requesterName}さんから`
          : "相手から";
      eventAt = pickStr(thread.completionRequestedAt, eventAt);
    } else if (kind === "complete") {
      supplementLine = pickStr(detail?.notifySupplementLine) || "お疲れさまでした";
      eventAt = pickStr(thread.completedAt, eventAt);
    }

    if (!eventAt) eventAt = new Date().toISOString();

    return {
      notifyListingTitle: listingTitle,
      notifySupplementLine: supplementLine,
      notifyEventAt: eventAt,
      notifyEventAtLabel: formatJobNotifyEventLabel(eventAt),
    };
  }

  const BUILDER_BENCH_TALK_FLOWS = new Set(["ops_partner", "partner_user", "user_user", "vendor_user"]);

  function isBuilderBenchTalkNotifySession() {
    try {
      if (global.sessionStorage?.getItem("tasu:builder:ops-bench") === "1") return true;
      const sp = new URLSearchParams(global.location?.search || "");
      if (sp.get("benchEmbed") !== "1") return false;
      return BUILDER_BENCH_TALK_FLOWS.has(pickStr(sp.get("builderFlow")));
    } catch {
      return false;
    }
  }

  /** @deprecated use isBuilderBenchTalkNotifySession */
  function isOpsPartnerBenchSession() {
    return isBuilderBenchTalkNotifySession();
  }

  function seedStore() {
    const store = global.TasuTalkNotifications;
    if (!store?.add) return null;
    if (isBuilderBenchTalkNotifySession()) return store;
    const seeds = global.TasuTalkData?.SEED_NOTIFICATIONS;
    if (typeof store.seedIfEmpty === "function" && Array.isArray(seeds)) {
      store.seedIfEmpty(seeds);
    }
    return store;
  }

  /**
   * @param {object} input
   * @returns {object|null}
   */
  const BENCH_PARTNER_A_BY_PROFILE = Object.freeze({
    skill: "u_sachi",
    job: "u_job_demo_full",
    worker: "demo-worker-001",
    general: "u_general_demo",
    product: "u_product",
    shop: "u_shop_demo",
    business: "u_business_demo",
    builder: "u_builder_demo",
  });

  const BUILDER_OWNER_USER_ID = "demo-owner-001";
  const BUILDER_PARTNER_USER_ID = "demo-partner-001";

  function resolveBuilderNotifyRecipientUserId(detail) {
    const explicit = pickStr(detail?.recipientUserId, detail?.recipient_user_id);
    if (explicit) return explicit;
    const role = pickStr(detail?.recipientRole, detail?.audience).toLowerCase();
    if (role === "owner" || role === "ops") return BUILDER_OWNER_USER_ID;
    if (role === "partner") {
      const pid = pickStr(detail?.recipientPartnerId, detail?.partnerId, detail?.to);
      if (pid && pid !== BUILDER_OWNER_USER_ID) return pid;
      return BUILDER_PARTNER_USER_ID;
    }
    return "";
  }

  function emitBuilderBenchNotifyRefresh(row) {
    try {
      const BenchEmbed = global.TasuBuilderBenchEmbed;
      if (!BenchEmbed?.isBuilderBenchParent?.()) return false;
      global.parent?.postMessage?.(
        {
          type: "builder:ops:notification-created",
          recipientRole: pickStr(row?.recipientRole),
          recipientUserId: pickStr(row?.recipientUserId, row?.recipient_user_id),
          href: pickStr(row?.href, row?.targetUrl),
          notificationType: pickStr(row?.type),
          title: pickStr(row?.title),
          threadId: pickStr(row?.threadId, row?.thread_id),
        },
        "*"
      );
      return true;
    } catch {
      return false;
    }
  }

  function emitBenchNotifyRefresh(row, listing) {
    if (emitBuilderBenchNotifyRefresh(row)) return;
    const Gate = global.TasuPlatformChatFeeGateFlow;
    if (Gate?.postBenchSellerNotifyRefresh?.(row, listing)) return;
    if (global.TasuPlatformChatBenchEmbed?.postBenchInitialNotifyRefresh?.(row)) return;
  }

  function pushNotification(input) {
    if (!input || typeof input !== "object") return null;
    try {
      let row = null;
      if (typeof global.TasuTalkData?.addNotification === "function") {
        row = global.TasuTalkData.addNotification(input);
      } else {
        const store = seedStore();
        if (!store) return null;
        row = store.add(input);
      }
      if (row) {
        const listingId = pickStr(row.listingId, row.listing_id);
        const listing =
          global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
          global.TasuListingContactRequestsStore?.resolveListing?.(listingId) ||
          (listingId ? { id: listingId, listing_id: listingId } : null);
        emitBenchNotifyRefresh(row, listing);
      }
      return row;
    } catch (err) {
      console.warn("[TasuTalkPlatformNotify] push failed:", err);
      return null;
    }
  }

  /** 評価送信後 — 評価された側へ（全プラットフォームカテゴリ共通） */
  function notifyPlatformReviewReceived(input) {
    if (!input || typeof input !== "object") return null;
    const draft = {
      ...input,
      body: pickStr(input.body),
      sendTalkMessage: input.sendTalkMessage !== false,
      officialRoomId: pickStr(input.officialRoomId, "official_tasful"),
      minimalNotifyCard: input.minimalNotifyCard !== false,
      source: pickStr(input.source, "platform_chat_review_v1"),
    };
    const actionLabel =
      pickStr(input.actionLabel) ||
      global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.(draft) ||
      "評価を見る";
    return pushNotification({ ...draft, actionLabel });
  }

  const route = () => global.TasuListingRouteResolver;

  function detailJobUrl(listingId) {
    return route()?.buildDetailUrl?.("job", listingId) || "#";
  }

  function resolveJobPosterUserId(listingId, listing) {
    const id = pickStr(listingId, listing?.id, listing?.listing_id);
    const row =
      listing ||
      global.TasuJobApplicationsStore?.resolveListing?.(id) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[id] ||
      {};
    return pickStr(row.user_id, row.seller_user_id, row.author_user_id);
  }

  function resolveListingSellerUserId(listingId, listing) {
    const id = pickStr(listingId, listing?.id, listing?.listing_id);
    const row =
      listing ||
      global.TasuListingContactRequestsStore?.resolveListing?.(id) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[id] ||
      {};
    return pickStr(row.user_id, row.seller_user_id, row.author_user_id);
  }

  function resolveBenchPartnerAId(categoryKey) {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("review") !== "chat-demo" && params.get("review") !== "job-full") return "";
      const Gate = global.TasuPlatformChatFeeGateFlow;
      const fromGate = Gate?.resolveBenchSellerUserId?.({ listing_type: categoryKey }, params);
      if (fromGate) return fromGate;
      const norm = (k) => String(k || "").toLowerCase().replace(/-/g, "_");
      const ck = norm(categoryKey);
      return pickStr(BENCH_PARTNER_A_BY_PROFILE[ck], BENCH_PARTNER_A_BY_PROFILE[categoryKey]);
    } catch {
      /* ignore */
    }
    return "";
  }

  function resolveWorkerOwnerUserId(listingId, listing) {
    const id = pickStr(listingId, listing?.id, listing?.listing_id);
    try {
      const raw = global.localStorage.getItem("tasful_listings");
      const list = raw ? JSON.parse(raw) : [];
      const localRow = (Array.isArray(list) ? list : []).find((r) => String(r?.id) === id);
      if (localRow) {
        return pickStr(localRow.user_id, localRow.seller_user_id, localRow.author_user_id);
      }
    } catch {
      /* ignore */
    }
    const local = global.TasuListingLocalStore?.fetchById?.(id);
    if (local) {
      const detail = global.TasuListingLocalStore?.toDetailListing?.(local) || local;
      return pickStr(detail.user_id, detail.seller_user_id, detail.author_user_id);
    }
    return resolveListingSellerUserId(id, listing);
  }

  function contactsNotifyActionLabel(categoryKey) {
    const copy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(categoryKey);
    if (copy?.cta) return copy.cta;
    const Category = global.TasuPlatformChatCategoryFlow;
    const flowBase = Category?.resolveFlowBaseKey?.(categoryKey) || categoryKey;
    if (flowBase === "worker") return "依頼者を確認する";
    if (flowBase === "job") return "応募者を確認する";
    if (flowBase === "product") return "購入者を確認する";
    return "購入者を確認する";
  }

  function resolveManagementRouteType(categoryKey) {
    const cat = pickStr(categoryKey).toLowerCase().replace(/-/g, "_");
    if (cat === "shop_store" || cat === "shop") return "shop";
    if (cat === "business_service" || cat === "business") return "business_service";
    if (cat === "product") return "product";
    if (cat === "worker") return "worker";
    if (cat === "general") return "general";
    if (cat === "builder") return "builder";
    if (cat === "job") return "job";
    return "skill";
  }

  /** 購入 / 依頼通知 → 出品者の管理一覧（CATEGORY_SPECS.managementView） */
  function buildManagementNotifyUrl(listingId, listing, options) {
    const id = pickStr(listingId, listing?.id, listing?.listing_id);
    if (!id) return "#";
    const Fee = global.TasuPlatformChatFee;
    const categoryKey =
      Fee?.resolveCategoryKey?.(listing || { id }) || pickStr(options?.category);
    const copy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(categoryKey) || {};
    const view = pickStr(copy.managementView, "contacts");
    const routeType = resolveManagementRouteType(categoryKey);
    const Resolver = global.TasuListingRouteResolver;
    let built = route()?.buildDetailUrl?.(routeType, id);
    if (!built || built === "#") {
      const routePath = Resolver?.TYPE_ROUTES?.[routeType]?.path;
      if (routePath) {
        built = `${routePath}?id=${encodeURIComponent(id)}`;
      }
    }
    if (!built || built === "#") return "#";
    try {
      const u = new URL(String(built).split("#")[0], global.location?.href || "http://localhost/");
      u.searchParams.set("view", view);
      const sellerId =
        categoryKey === "worker"
          ? resolveWorkerOwnerUserId(id, listing)
          : resolveListingSellerUserId(id, listing);
      if (sellerId) u.searchParams.set("userId", sellerId);
      if (global.TasuTalkRuntime?.isTalkProductionMode?.() !== true) {
        u.searchParams.set("talkDev", "1");
      }
      const contactId = pickStr(
        options?.contactId,
        options?.contact?.contact_id,
        options?.requestId,
        options?.request?.request_id
      );
      if (contactId && view === "contacts") u.searchParams.set("contactId", contactId);
      if (contactId && view === "requests") u.searchParams.set("requestId", contactId);
      return `${u.pathname}${u.search}#${view}`;
    } catch {
      const sellerId =
        categoryKey === "worker"
          ? resolveWorkerOwnerUserId(id, listing)
          : resolveListingSellerUserId(id, listing);
      const base = String(built).split("#")[0];
      const sep = base.includes("?") ? "&" : "?";
      let url = `${base}${sep}view=${encodeURIComponent(view)}`;
      if (sellerId) url += `&userId=${encodeURIComponent(sellerId)}&talkDev=1`;
      return `${url}#${view}`;
    }
  }

  function buildListingContactsNotifyUrl(listingId, listing, options) {
    return buildManagementNotifyUrl(listingId, listing, options);
  }

  function buildWorkerRequestsNotifyUrl(listingId, listing) {
    return buildManagementNotifyUrl(listingId, listing, { category: "worker" });
  }

  /** 求人応募通知 → 掲載者の応募者一覧（#applications + poster userId） */
  function buildJobApplicationsNotifyUrl(listingId, listing) {
    const id = pickStr(listingId, listing?.id, listing?.listing_id);
    if (!id) return "#";
    const built = detailJobUrl(id);
    if (!built || built === "#") return "#";
    try {
      const u = new URL(String(built).split("#")[0], global.location?.href || "http://localhost/");
      u.searchParams.set("view", "applications");
      const posterId = resolveJobPosterUserId(id, listing);
      if (posterId) u.searchParams.set("userId", posterId);
      if (global.TasuTalkRuntime?.isTalkProductionMode?.() !== true) {
        u.searchParams.set("talkDev", "1");
      }
      return `${u.pathname}${u.search}#applications`;
    } catch {
      const posterId = resolveJobPosterUserId(id, listing);
      const base = String(built).split("#")[0];
      const sep = base.includes("?") ? "&" : "?";
      let url = `${base}${sep}view=applications`;
      if (posterId) url += `&userId=${encodeURIComponent(posterId)}&talkDev=1`;
      return `${url}#applications`;
    }
  }

  function jobHireThreadReadyInStore(threadId) {
    const id = pickStr(threadId);
    if (!id) return false;
    const store = global.TasuChatThreadStore;
    if (!store) return false;
    if (store.threadExists?.(id) === true) return true;
    if (store.roomExists?.(id) === true) return true;
    return Boolean(store.loadRoom?.(id)?.thread);
  }

  function resolveJobHireNotifyThreadId(listingId, options) {
    const jobId = pickStr(listingId, options?.listingId, options?.listing?.id);
    const applicationId = pickStr(options?.applicationId, options?.application?.application_id);
    const hinted = pickStr(
      options?.threadId,
      options?.thread?.id,
      options?.application?.thread_id
    );
    const store = global.TasuChatThreadStore;
    if (hinted && jobHireThreadReadyInStore(hinted)) return hinted;

    const linked = store?.findHireThread?.(jobId, applicationId);
    const linkedId = pickStr(linked?.id);
    if (linkedId) return linkedId;

    const app =
      options?.application ||
      global.TasuJobApplicationsStore?.findApplication?.(jobId, applicationId);
    const appThreadId = pickStr(app?.thread_id, options?.application?.thread_id);
    if (appThreadId && jobHireThreadReadyInStore(appThreadId)) return appThreadId;

    if (hinted && (linkedId === hinted || appThreadId === hinted)) return hinted;
    if (
      hinted &&
      pickStr(options?.thread?.id) === hinted &&
      pickStr(options?.thread?.listingId, options?.thread?.applicationId) &&
      (pickStr(options?.thread?.listingId) === jobId ||
        pickStr(options?.thread?.applicationId) === applicationId)
    ) {
      return hinted;
    }

    const liveFlow = global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true;
    if (liveFlow) {
      if (hinted && jobHireThreadReadyInStore(hinted)) return hinted;
      if (hinted && options?.threadVerified === true) return hinted;
      return "";
    }
    if (
      !liveFlow &&
      jobId === "job_demo_full_001" &&
      applicationId === "job-app-demo-001"
    ) {
      const demoId = pickStr(global.TasuPlatformChatJobCard?.DEMO_HIRE_THREAD_ID, "chat-demo-job-hired-001");
      if (store?.threadExists?.(demoId)) return demoId;
    }
    if (
      !liveFlow &&
      jobId === "job_demo_full_001" &&
      applicationId === "job-app-demo-full-001" &&
      global.TasuPlatformChatJobFlow?.isJobFullReviewFromUrl?.()
    ) {
      const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
      if (store?.threadExists?.(demoId)) return demoId;
    }
    return "";
  }

  function isDemoSellerUserId(userId) {
    return String(userId || "").startsWith("demo-seller-");
  }

  function resolveJobHirePosterUserId(thread, listing) {
    const listingId = pickStr(listing?.id, listing?.listing_id, thread?.listingId);
    const JobFlow = global.TasuPlatformChatJobFlow;
    const sellerId = pickStr(thread?.sellerId, thread?.seller_id);
    return pickStr(
      JobFlow?.resolveJobPosterUserId?.(thread),
      resolveJobPosterUserId(listingId, listing),
      thread?.posterUserId,
      thread?.ownerUserId,
      thread?.listingOwnerId,
      !isDemoSellerUserId(sellerId) ? sellerId : "",
      resolveBenchPartnerAId("job")
    );
  }

  function resolveJobHireApplicantUserId(thread, application) {
    return pickStr(
      application?.applicant_id,
      thread?.applicantUserId,
      thread?.buyerId,
      thread?.buyer_id
    );
  }

  function patchJobHireThreadParticipants(thread, listing, application) {
    const threadId = pickStr(thread?.id);
    if (!threadId) return thread || {};
    const posterUserId = resolveJobHirePosterUserId(thread, listing);
    const applicantUserId = resolveJobHireApplicantUserId(thread, application);
    const participants = [...new Set([posterUserId, applicantUserId].filter(Boolean))];
    const next = {
      ...thread,
      id: threadId,
      roomId: pickStr(thread.roomId, threadId),
      sellerId: posterUserId || thread.sellerId,
      posterUserId,
      partnerUserId: posterUserId || thread.partnerUserId,
      ownerUserId: posterUserId || thread.ownerUserId,
      listingOwnerId: posterUserId || thread.listingOwnerId,
      buyerId: applicantUserId || thread.buyerId,
      applicantUserId,
      participantIds: participants,
      threadParticipants: participants,
    };
    const store = global.TasuChatThreadStore;
    if (store?.readAll && store?.writeAll) {
      const list = store.readAll().map((row) => (String(row.id) === threadId ? { ...row, ...next } : row));
      store.writeAll(list);
    }
    return next;
  }

  function resolveJobHireNotifyContext(detail) {
    const listing = detail?.listing || {};
    const application = detail?.application || {};
    const thread = detail?.thread || {};
    const ensured = global.TasuChatThreadStore?.ensureChatThreadForAcceptedJob?.({
      listing,
      application,
      thread,
    });
    const baseThread = ensured?.thread || thread;
    const listingId = pickStr(listing.id, listing.listing_id, baseThread.listingId);
    const applicationId = pickStr(application.application_id, baseThread.applicationId);
    const syncedApplication = {
      ...application,
      thread_id: pickStr(baseThread.id, application.thread_id),
      job_id: pickStr(application.job_id, listingId),
    };
    const verifiedThread = patchJobHireThreadParticipants(baseThread, listing, syncedApplication);
    const threadId = pickStr(verifiedThread.id, syncedApplication.thread_id);
    const posterUserId = resolveJobHirePosterUserId(verifiedThread, listing);
    const applicantUserId = resolveJobHireApplicantUserId(verifiedThread, syncedApplication);
    const threadReady = jobHireThreadReadyInStore(threadId);
    const reviewOpts = jobReviewOptionsFromContext(verifiedThread);
    const urlBase = {
      listingId,
      applicationId,
      listing,
      application: syncedApplication,
      thread: verifiedThread,
      threadId,
      threadVerified: threadReady,
      ...reviewOpts,
      from: "notify",
    };
    return {
      listing,
      listingId,
      application: syncedApplication,
      applicationId,
      thread: verifiedThread,
      threadId,
      roomId: threadId,
      posterUserId,
      applicantUserId,
      threadParticipants: verifiedThread.threadParticipants || [],
      threadReady,
      ensured,
      applicantChatUrl: buildJobHireChatNotifyUrl(listingId, { ...urlBase, userId: applicantUserId }),
      posterChatUrl: buildJobHireChatNotifyUrl(listingId, { ...urlBase, userId: posterUserId }),
    };
  }

  /** 求人550円支払い後 — やりとりチャット通知 */
  function buildJobHireChatNotifyUrl(listingId, options) {
    const jobId = pickStr(listingId, options?.listingId, options?.listing?.id);
    const applicationId = pickStr(options?.applicationId, options?.application?.application_id);
    const resolvedThreadId =
      resolveJobHireNotifyThreadId(listingId, options) || pickStr(options?.threadId, options?.thread?.id);
    if (!resolvedThreadId) return "#";

    const applicantId = pickStr(
      options?.userId,
      options?.applicantId,
      options?.application?.applicant_id
    );
    try {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("thread", resolvedThreadId);
      if (jobId) u.searchParams.set("listingId", jobId);
      if (applicationId) u.searchParams.set("applicationId", applicationId);
      if (applicantId) u.searchParams.set("userId", applicantId);
      const review = pickStr(options?.review);
      if (review === "job-full" || review === "chat-demo") {
        u.searchParams.set("review", review);
      } else if (resolvedThreadId === pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID)) {
        u.searchParams.set("review", "job-full");
      }
      if (global.TasuTalkRuntime?.isTalkProductionMode?.() !== true) {
        u.searchParams.set("talkDev", "1");
      }
      const from = pickStr(options?.from);
      if (from) u.searchParams.set("from", from);
      return u.pathname + u.search;
    } catch {
      let url = `chat-detail.html?thread=${encodeURIComponent(resolvedThreadId)}`;
      if (jobId) url += `&listingId=${encodeURIComponent(jobId)}`;
      if (applicationId) url += `&applicationId=${encodeURIComponent(applicationId)}`;
      if (applicantId) url += `&userId=${encodeURIComponent(applicantId)}`;
      const review = pickStr(options?.review);
      if (review === "job-full" || review === "chat-demo") {
        url += `&review=${encodeURIComponent(review)}`;
      } else if (resolvedThreadId === "chat-demo-job-full-001") {
        url += "&review=job-full";
      }
      url += "&talkDev=1";
      return url;
    }
  }

  /** @deprecated 応募者通知は buildJobHireChatNotifyUrl を使用 */
  function buildJobHireResultNotifyUrl(listingId, options) {
    return buildJobHireChatNotifyUrl(listingId, options);
  }

  function detailWorkerUrl(listingId) {
    const id = pickStr(listingId);
    if (!id) return "#";
    const built = route()?.buildDetailUrl?.("worker", id);
    if (built && built !== "#") return built;
    return `detail-worker.html?id=${encodeURIComponent(id)}`;
  }

  function detailBusinessUrl(serviceId) {
    return route()?.buildDetailUrl?.("business_service", serviceId) || "#";
  }

  function detailShopUrl(shopId) {
    return route()?.buildDetailUrl?.("shop", shopId) || "#";
  }

  function shopProductUrl(shopId, productId) {
    if (!pickStr(shopId) || !pickStr(productId)) return detailShopUrl(shopId);
    if (global.TasuShopCheckout?.buildProductDetailUrl) {
      return global.TasuShopCheckout.buildProductDetailUrl(shopId, productId);
    }
    const u = new URL("detail-shop-product.html", global.location?.href || "http://localhost/");
    u.searchParams.set("shopId", shopId);
    u.searchParams.set("productId", productId);
    return u.pathname + u.search;
  }

  function orderCompleteUrl(extra) {
    if (global.TasuShopCheckout?.buildOrderCompleteUrl) {
      return global.TasuShopCheckout.buildOrderCompleteUrl(extra || {});
    }
    return "order-complete.html";
  }

  function jobReviewOptionsFromContext(thread) {
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    if (pickStr(thread?.id, thread?.threadId) === demoId) {
      try {
        const review = new URLSearchParams(global.location?.search || "").get("review");
        if (review === "chat-demo" || review === "job-full") return { review };
      } catch {
        /* ignore */
      }
      return { review: "chat-demo" };
    }
    try {
      const review = new URLSearchParams(global.location?.search || "").get("review");
      if (review === "chat-demo" || review === "job-full") return { review };
    } catch {
      /* ignore */
    }
    if (global.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread) === true) {
      return { review: "chat-demo" };
    }
    return {};
  }

  function ensureJobCompletionNotifyDiag() {
    if (!global.__tasuJobCompletionNotifyDiag || typeof global.__tasuJobCompletionNotifyDiag !== "object") {
      global.__tasuJobCompletionNotifyDiag = {
        startedAt: new Date().toISOString(),
        events: [],
        generated: [],
        skipped: [],
        reviewNotifications: [],
      };
    }
    return global.__tasuJobCompletionNotifyDiag;
  }

  function pushJobCompletionNotifyDiag(step, data) {
    const diag = ensureJobCompletionNotifyDiag();
    const entry = { step: pickStr(step), at: new Date().toISOString(), ...(data || {}) };
    diag.events.push(entry);
    try {
      console.info("[job-completion-notify]", step, data || {});
    } catch {
      /* ignore */
    }
    return diag;
  }

  function collectJobReviewNotificationsFromStore(threadId) {
    const tid = pickStr(threadId);
    const all = global.TasuTalkNotifications?.getAll?.() || [];
    return all.filter(
      (n) =>
        String(n.title || "").includes("やり取りが完了") &&
        (!tid || String(n.threadId) === tid)
    );
  }

  function resolveJobCompletionPosterId(thread, detail) {
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const listing =
      detail?.listing ||
      global.TasuJobApplicationsStore?.resolveListing?.(listingId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      null;
    const JobFlow = global.TasuPlatformChatJobFlow;
    return pickStr(
      detail?.posterUserId,
      JobFlow?.resolveJobPosterUserId?.(thread),
      resolveJobPosterUserId(listingId, listing),
      resolveBenchPartnerAId("job"),
      thread?.posterUserId,
      thread?.sellerId
    );
  }

  function resolveJobCompletionApplicantId(thread, detail) {
    const JobFlow = global.TasuPlatformChatJobFlow;
    return pickStr(
      detail?.applicantUserId,
      JobFlow?.resolveJobApplicantUserId?.(thread),
      thread?.applicantUserId,
      thread?.buyerId,
      detail?.application?.applicant_id
    );
  }

  function findDuplicateCompletionNotify(threadId, recipientUserId) {
    const tid = pickStr(threadId);
    const uid = pickStr(recipientUserId);
    if (!tid || !uid) return null;
    return (
      (global.TasuTalkNotifications?.getAll?.() || []).find(
        (n) =>
          String(n.threadId) === tid &&
          String(n.recipientUserId) === uid &&
          String(n.title || "").includes("やり取りが完了")
      ) || null
    );
  }

  function refreshBenchNotifyForCompletionRecipients(posterId, applicantId) {
    [posterId, applicantId].forEach((uid) => {
      if (!uid) return;
      const sent =
        global.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.(uid, {
          immediate: true,
          force: true,
          reason: "job_hire_notify_refresh",
        }) === true;
      if (sent) return;
      try {
        const payload = {
          type: "tasu-bench-worker-requested",
          recipientUserId: uid,
          immediate: true,
          force: true,
        };
        global.parent?.postMessage?.(payload, "*");
        if (global.top && global.top !== global.self && global.top !== global.parent) {
          global.top.postMessage(payload, "*");
        }
      } catch {
        /* ignore */
      }
    });
  }

  function pushJobMinimalNotify(input) {
    if (!input || typeof input !== "object") return null;
    const draft = {
      ...input,
      type: "job",
      category: "求人",
      body: pickStr(input.body) || "",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "job",
    };
    const actionLabel =
      pickStr(input.actionLabel) ||
      global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.(draft) ||
      "確認する";
    return pushNotification({ ...draft, actionLabel });
  }

  /**
   * 求人応募 — 掲載者向け（手数料ゲート対象外）
   * @param {{ listing?: object, application?: object }} detail
   */
  function notifyJobApplicationReceived(detail) {
    const listing = detail?.listing || {};
    const listingId = pickStr(listing.id, listing.listing_id);
    const targetUrl = buildJobApplicationsNotifyUrl(listingId, listing);

    return pushJobMinimalNotify({
      title: "この求人に応募がありました",
      actionLabel: contactsNotifyActionLabel("job"),
      href: targetUrl,
      targetUrl,
      priority: "high",
      recipientRole: "poster",
      recipientUserId: pickStr(
        listing.user_id,
        listing.seller_user_id,
        resolveJobPosterUserId(listingId, listing),
        resolveBenchPartnerAId("job")
      ),
      listingId,
      applicationId: pickStr(detail?.application?.application_id),
      ...buildJobNotifyCardFields(detail, "apply"),
    });
  }

  /** @deprecated — 応募時チャット作成は廃止。notifyJobApplicationReceived を使用 */
  function notifyJobApplication(detail) {
    return notifyJobApplicationReceived(detail);
  }

  /** 求人550円支払い後 — 応募者への承諾通知 */
  function notifyJobHiredToApplicant(detail) {
    const ctx = resolveJobHireNotifyContext(detail);
    global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToApplicant:enter", {
      applicantId: ctx.applicantUserId,
      posterUserId: ctx.posterUserId,
      threadId: ctx.threadId,
      roomId: ctx.roomId,
      listingId: ctx.listingId,
      applicationId: ctx.applicationId,
      threadParticipants: ctx.threadParticipants,
      threadReady: ctx.threadReady,
      ensured: ctx.ensured?.ok === true,
      created: ctx.ensured?.created === true,
    });
    if (!ctx.threadId || !ctx.threadReady) {
      global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToApplicant:fail", {
        reason: "thread_not_ready_before_notify",
        threadId: ctx.threadId,
        listingId: ctx.listingId,
        applicationId: ctx.applicationId,
        threadReady: ctx.threadReady,
      });
      return null;
    }
    if (!ctx.applicantUserId || ctx.applicantChatUrl === "#") {
      global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToApplicant:fail", {
        reason: "missing_applicant_href",
        threadId: ctx.threadId,
        applicantUserId: ctx.applicantUserId,
      });
      return null;
    }

    const copy =
      global.TasuPlatformChatJobCard?.JOB_NOTIFY_COPY?.hiredApplicant || {
        title: "応募が承諾されました",
        body: "掲載者が応募を承諾しました。やり取りチャットで条件確認・日程調整を進めてください。",
        cta: "やり取りチャットを開く",
      };

    const row = pushJobMinimalNotify({
      title: copy.title,
      body: copy.body,
      actionLabel: copy.cta,
      href: ctx.applicantChatUrl,
      targetUrl: ctx.applicantChatUrl,
      priority: "high",
      recipientRole: "applicant",
      recipientUserId: ctx.applicantUserId,
      threadId: ctx.threadId,
      listingId: ctx.listingId,
      applicationId: ctx.applicationId,
      ...buildJobNotifyCardFields(
        { ...detail, thread: ctx.thread, application: ctx.application },
        "hired"
      ),
    });
    try {
      global.__tasuJobHireNotifyDiag = {
        applicantNotifyCreated: Boolean(row),
        applicantNotifyRecipient: ctx.applicantUserId,
        posterUserId: ctx.posterUserId,
        threadId: ctx.threadId,
        roomId: ctx.roomId,
        threadParticipants: ctx.threadParticipants,
      };
    } catch {
      /* ignore */
    }
    return row;
  }

  function notifyJobHiredToPoster(detail) {
    const ctx = resolveJobHireNotifyContext(detail);
    global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToPoster:enter", {
      posterUserId: ctx.posterUserId,
      applicantUserId: ctx.applicantUserId,
      threadId: ctx.threadId,
      roomId: ctx.roomId,
      listingId: ctx.listingId,
      applicationId: ctx.applicationId,
      threadParticipants: ctx.threadParticipants,
      threadReady: ctx.threadReady,
    });
    if (!ctx.threadId || !ctx.threadReady) {
      global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToPoster:fail", {
        reason: "thread_not_ready_before_notify",
        threadId: ctx.threadId,
        posterUserId: ctx.posterUserId,
      });
      return null;
    }
    if (!ctx.posterUserId || ctx.posterChatUrl === "#") {
      global.TasuPlatformChatFee?.pushJobHireFlowDiag?.("notifyJobHiredToPoster:fail", {
        reason: "missing_poster_href",
        threadId: ctx.threadId,
        posterUserId: ctx.posterUserId,
      });
      return null;
    }

    const notifyTitle =
      global.TasuPlatformChatJobCard?.NOTIFY_TITLES?.poster ||
      "応募者とのやりとりを開始してください";

    const row = pushJobMinimalNotify({
      title: notifyTitle,
      href: ctx.posterChatUrl,
      targetUrl: ctx.posterChatUrl,
      priority: "high",
      recipientRole: "poster",
      recipientUserId: ctx.posterUserId,
      threadId: ctx.threadId,
      listingId: ctx.listingId,
      applicationId: ctx.applicationId,
      ...buildJobNotifyCardFields(
        { ...detail, thread: ctx.thread, application: ctx.application },
        "hired"
      ),
    });
    try {
      global.__tasuJobHireNotifyDiag = {
        ...(global.__tasuJobHireNotifyDiag || {}),
        posterNotifyCreated: Boolean(row),
        posterNotifyRecipient: ctx.posterUserId,
        posterUserId: ctx.posterUserId,
        applicantUserId: ctx.applicantUserId,
        threadId: ctx.threadId,
        roomId: ctx.roomId,
        threadParticipants: ctx.threadParticipants,
      };
    } catch {
      /* ignore */
    }
    return row;
  }

  function jobFullReviewOptions(thread) {
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    if (pickStr(thread?.id, thread?.threadId) !== demoId) return {};
    try {
      const review = new URLSearchParams(global.location?.search || "").get("review");
      if (review === "chat-demo" || review === "job-full") return { review };
    } catch {
      /* ignore */
    }
    return { review: "chat-demo" };
  }

  /** 求人やりとり終了依頼 — 応募者へ完了確認 */
  function notifyJobEndRequested(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, detail?.roomId, thread?.id);
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    const isDemo = threadId === demoId;
    const applicantId = pickStr(
      thread.buyerId,
      detail?.application?.applicant_id,
      global.TasuPlatformChatJobFlow?.resolveJobApplicantUserId?.(thread)
    );
    const reviewOpts = jobReviewOptionsFromContext(thread);
    const chatUrl =
      pickStr(detail?.href) ||
      global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
        userId: applicantId,
        ...reviewOpts,
        from: "talk",
      }) ||
      (threadId ? `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1` : "#");

    const copy =
      global.TasuPlatformChatJobCard?.JOB_NOTIFY_COPY?.endRequest || {
        title: "掲載者から終了依頼が届きました",
        body: "掲載者がやり取り終了を依頼しました。内容を確認のうえ完了してください。",
        cta: "やり取りを完了する",
      };

    return pushJobMinimalNotify({
      id: isDemo ? "platform-verify-job-full-end-request-001" : undefined,
      title: copy.title,
      body: copy.body,
      actionLabel: copy.cta,
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      recipientRole: "applicant",
      recipientUserId: applicantId,
      threadId,
      listingId,
      applicationId: pickStr(thread.applicationId, detail?.application?.application_id),
      requesterName: pickStr(detail?.requesterName),
      ...buildJobNotifyCardFields(detail, "end_request"),
    });
  }

  /** 求人やりとり完了申請 — 応募者へ確認依頼 */
  function notifyJobCompletionRequested(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, detail?.roomId, thread?.id);
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    const isDemo = threadId === demoId;
    const applicantId = pickStr(thread.buyerId, detail?.application?.applicant_id);
    const reviewOpts = jobReviewOptionsFromContext(thread);
    const chatUrl =
      pickStr(detail?.href) ||
      global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
        userId: applicantId,
        ...reviewOpts,
        from: "talk",
      }) ||
      (threadId ? `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1` : "#");

    const copy =
      global.TasuPlatformChatJobCard?.JOB_NOTIFY_COPY?.completionRequest || {
        title: "取引完了の確認依頼",
        body: "掲載者から取引完了申請が届きました。内容を確認してください。",
        cta: "取引内容を確認する",
      };

    return pushJobMinimalNotify({
      id: isDemo ? "platform-verify-job-full-complete-request-001" : undefined,
      title: copy.title,
      body: copy.body,
      actionLabel: copy.cta,
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      recipientRole: "applicant",
      recipientUserId: applicantId,
      threadId,
      listingId,
      applicationId: pickStr(thread.applicationId, detail?.application?.application_id),
      requesterName: pickStr(detail?.requesterName),
      ...buildJobNotifyCardFields(detail, "complete_request"),
    });
  }

  /** 求人 — 応募者が完了承認した直後、依頼者（掲載者）へ承認通知 */
  function notifyJobCompletionApprovedToRequester(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, detail?.roomId, thread?.id);
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    const isDemo = threadId === demoId;
    const applicantId = resolveJobCompletionApplicantId(thread, detail);
    const posterId = resolveJobCompletionPosterId(thread, detail);
    const approverId = pickStr(detail?.approverId, detail?.closedByUserId, thread?.closedByUserId);
    const requesterId = pickStr(
      detail?.requesterId,
      thread?.endRequestedBy,
      thread?.completionRequestedBy,
      posterId
    );
    const recipientUserId = requesterId;
    if (!threadId || !recipientUserId || !approverId) {
      return { ok: false, skipped: true, reason: "invalid_input" };
    }
    if (recipientUserId === approverId) {
      return { ok: false, skipped: true, reason: "same_user" };
    }

    const notifyId = isDemo
      ? "platform-verify-job-full-complete-approved-poster-001"
      : `platform-job-completion-approved-${threadId}-${recipientUserId}`;
    const existing = (global.TasuTalkNotifications?.getAll?.() || []).find(
      (n) => String(n.id) === notifyId
    );
    if (existing) {
      return { ok: true, notification: existing, duplicate: true };
    }

    const reviewOpts = jobReviewOptionsFromContext(thread);
    const chatUrl =
      global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
        userId: recipientUserId,
        from: "notify",
        ...reviewOpts,
      }) ||
      (threadId ? `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1` : "#");

    const row = pushJobMinimalNotify({
      id: notifyId,
      title: "やり取り完了が承認されました",
      body: "応募者がやり取り完了を承認しました。",
      actionLabel: "確認する",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      recipientRole: recipientUserId === posterId ? "poster" : "applicant",
      recipientUserId,
      threadId,
      listingId,
      applicationId: pickStr(thread.applicationId, detail?.application?.application_id),
      ...buildJobNotifyCardFields(detail, "complete"),
    });

    pushJobCompletionNotifyDiag("notifyJobCompletionApprovedToRequester", {
      threadId,
      recipientUserId,
      approverId,
      requesterId,
      posterUserId: posterId,
      applicantUserId: applicantId,
      created: Boolean(row),
    });

    try {
      global.__tasuCompletionApprovedNotifyDiag = {
        completionApprovedNotifyCreated: Boolean(row),
        completionApprovedNotifyRecipient: recipientUserId,
        approverId,
        requesterId,
        posterUserId: posterId,
        applicantUserId: applicantId,
        threadId,
      };
    } catch {
      /* ignore */
    }

    if (row) {
      refreshBenchNotifyForCompletionRecipients(posterId, applicantId);
    }

    return row;
  }

  /** 求人やりとり完了 — 双方へレビュー導線付き完了通知 */
  function notifyJobConversationCompleted(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, detail?.roomId, thread?.id);
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    const isDemo = threadId === demoId;
    const applicantId = resolveJobCompletionApplicantId(thread, detail);
    const posterId = resolveJobCompletionPosterId(thread, detail);
    const diag = pushJobCompletionNotifyDiag("notifyJobConversationCompleted:enter", {
      threadId,
      listingId,
      roomStatus: pickStr(thread.roomStatus, thread.status),
      jobStatus: pickStr(thread.jobStatus),
      closedByUserId: pickStr(detail?.closedByUserId, thread?.closedByUserId),
      posterUserId: posterId,
      applicantUserId: applicantId,
      threadSellerId: pickStr(thread.sellerId),
      threadBuyerId: pickStr(thread.buyerId),
    });
    const reviewOpts = jobReviewOptionsFromContext(thread);
    const copy =
      global.TasuPlatformChatJobCard?.JOB_NOTIFY_COPY?.tradeCompleted || {
        title: "取引が完了しました",
        body: "お疲れさまでした。レビューで取引を締めくくれます。",
        cta: "レビューをする",
      };
    const cardFields = buildJobNotifyCardFields(detail, "complete");
    const recipientPlans = [
      {
        recipientRole: "poster",
        recipientUserId: posterId,
        reviewTargetUserId: applicantId,
        idSuffix: "poster",
      },
      {
        recipientRole: "applicant",
        recipientUserId: applicantId,
        reviewTargetUserId: posterId,
        idSuffix: "applicant",
      },
    ];

    const recipients = [];
    recipientPlans.forEach((row) => {
      let skipReason = "";
      if (!pickStr(row.recipientUserId)) skipReason = "recipientUserId missing";
      else if (!pickStr(row.reviewTargetUserId)) skipReason = "reviewTargetUserId invalid";
      else if (pickStr(row.recipientUserId) === pickStr(row.reviewTargetUserId)) skipReason = "same user";
      else if (findDuplicateCompletionNotify(threadId, row.recipientUserId)) {
        skipReason = "duplicate notification";
      }
      if (skipReason) {
        diag.skipped.push({ ...row, skipReason });
        pushJobCompletionNotifyDiag("notifyJobConversationCompleted:skip", {
          recipientRole: row.recipientRole,
          recipientUserId: row.recipientUserId,
          reviewTargetUserId: row.reviewTargetUserId,
          skipReason,
        });
        return;
      }
      recipients.push(row);
    });

    let last = null;
    recipients.forEach((row, index) => {
      pushJobCompletionNotifyDiag("notifyJobConversationCompleted:generate", {
        generateTargetUserId: row.recipientUserId,
        reviewTargetUserId: row.reviewTargetUserId,
        title: "やり取りが完了しました",
        type: "job",
        recipientRole: row.recipientRole,
      });
      const reviewUrl =
        global.TasuPlatformChatReviewFlow?.buildReviewOpenChatUrl?.(thread, row.recipientUserId, {
          threadId,
          from: "notify",
          state: "completed",
          openReview: "1",
        }) ||
        global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
          userId: row.recipientUserId,
          from: "notify",
          ...reviewOpts,
        }) ||
        "#";
      last = pushJobMinimalNotify({
        id: isDemo
          ? index === 0
            ? "platform-verify-job-full-complete-001"
            : `platform-verify-job-full-complete-001-${row.idSuffix}`
          : undefined,
        title: "やり取りが完了しました",
        body: copy.body,
        actionLabel: "レビューをする",
        href: reviewUrl,
        targetUrl: reviewUrl,
        priority: "high",
        recipientRole: row.recipientRole,
        recipientUserId: row.recipientUserId,
        reviewTargetUserId: row.reviewTargetUserId,
        threadId,
        listingId,
        applicationId: pickStr(thread.applicationId, detail?.application?.application_id),
        ...cardFields,
      });
      if (last) {
        diag.generated.push({
          id: last.id,
          recipientUserId: last.recipientUserId,
          reviewTargetUserId: last.reviewTargetUserId,
          title: last.title,
          type: last.type,
        });
      }
    });

    diag.reviewNotifications = collectJobReviewNotificationsFromStore(threadId);
    pushJobCompletionNotifyDiag("notifyJobConversationCompleted:done", {
      generatedCount: diag.generated.length,
      skippedCount: diag.skipped.length,
      reviewNotifications: diag.reviewNotifications.map((n) => ({
        recipientUserId: n.recipientUserId,
        reviewTargetUserId: n.reviewTargetUserId,
        title: n.title,
        type: n.type,
        id: n.id,
      })),
    });
    refreshBenchNotifyForCompletionRecipients(posterId, applicantId);
    return last;
  }

  /** 求人完了後 — チャット内レビュー導線（補助で job-review も可） */
  function notifyJobReviewRequest(detail) {
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, detail?.roomId, thread?.id);
    const listingId = pickStr(detail?.listing?.id, thread?.listingId);
    const demoId = pickStr(global.TasuPlatformChatJobFlow?.DEMO_THREAD_ID, "chat-demo-job-full-001");
    const isDemo = threadId === demoId;
    const chatUrl =
      global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
        userId: pickStr(thread.buyerId),
        ...jobFullReviewOptions(thread),
        from: "talk",
      }) ||
      (threadId ? `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1` : "#");

    return pushJobMinimalNotify({
      id: isDemo ? "platform-verify-job-full-review-001" : undefined,
      title: "評価をお願いします",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "medium",
      recipientRole: "buyer",
      threadId,
      listingId,
      applicationId: pickStr(thread.applicationId, detail?.application?.application_id),
      ...buildJobNotifyCardFields(detail, "review"),
    });
  }

  /** 一般案件 — 取引完了申請（チャットへ） */
  function notifyDealCompletionRequested(detail) {
    const thread = detail?.thread || {};
    const listing = detail?.listing || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const listingId = pickStr(listing.id, listing.listing_id, thread?.listingId);
    const Fee = global.TasuPlatformChatFee;
    const categoryKey = Fee?.resolveCategoryKey?.(listing) || Fee?.resolveCategoryKey?.(thread) || "skill";
    const connectDemoId = "chat-demo-skill-deal-001";
    const isConnectDemo = threadId === connectDemoId;
    const chatUrl =
      pickStr(detail?.href) ||
      Fee?.buildChatDetailUrl?.({ threadId, thread, listingId }) ||
      (threadId ? `chat-detail.html?thread=${encodeURIComponent(threadId)}&talkDev=1` : "#");

    const requesterId = pickStr(detail?.requesterId);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const partners = Demo?.resolveBenchPartnerIds?.(null, thread) || {};
    const sellerId = pickStr(partners.sellerId, thread.sellerId);
    const buyerId = pickStr(partners.buyerId, thread.buyerId);
    const recipientRole =
      requesterId && requesterId === sellerId
        ? "buyer"
        : requesterId && requesterId === buyerId
          ? "seller"
          : "seller";
    const recipientUserId = recipientRole === "buyer" ? buyerId : sellerId;

    return pushNotification({
      type: Fee?.getNotifyType?.(categoryKey) || "skill",
      category: Fee?.getCategoryLabel?.(categoryKey) || "取引",
      title: pickStr(detail?.title) || "やりとり完了の申請がありました",
      body: "",
      actionLabel:
        global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.({
          title: pickStr(detail?.title) || "やりとり完了の申請がありました",
        }) || "承認する",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole,
      recipientUserId,
      threadId,
      listingId,
      requesterName: pickStr(detail?.requesterName),
      id: isConnectDemo ? "platform-verify-chat-demo-connect-request-001" : undefined,
    });
  }

  function notifyJobRejected(detail) {
    const listing = detail?.listing || {};
    const listingId = pickStr(listing.id, listing.listing_id);

    return pushJobMinimalNotify({
      title: "今回は見送りになりました",
      href: detailJobUrl(listingId),
      targetUrl: detailJobUrl(listingId),
      priority: "medium",
      recipientRole: "applicant",
      listingId,
    });
  }

  function notifyWorkerRequestReceived(detail) {
    return notifyListingPurchased(detail, {
      type: "worker",
      categoryLabel: "ワーカー",
    });
  }

  function notifyWorkerAcceptedToRequester(detail) {
    const listing = detail?.listing || {};
    const thread = detail?.thread || {};
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const title = pickStr(listing.title, thread.listingTitle) || "ワーカー";
    const threadId = pickStr(thread.id, detail?.request?.thread_id);
    const chatUrl = threadId
      ? `chat-detail.html?thread=${encodeURIComponent(threadId)}`
      : detailWorkerUrl(listingId);

    return pushNotification({
      type: "worker",
      category: "ワーカー",
      title: "依頼を引き受けました",
      body: `${title} — やりとりチャットへ進んでください。`,
      actionLabel: "チャットを開く",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "requester",
      listingId,
      notifyListingTitle: title,
      notifySupplementLine: `ワーカー：${pickStr(thread.sellerName, "ワーカー")}`,
      threadId,
    });
  }

  function notifyWorkerAcceptedToWorker(detail) {
    const listing = detail?.listing || {};
    const thread = detail?.thread || {};
    const request = detail?.request || {};
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const title = pickStr(listing.title, thread.listingTitle) || "ワーカー";
    const requester = pickStr(request.requester_name) || "依頼者";
    const threadId = pickStr(thread.id, request.thread_id);
    const chatUrl = threadId
      ? `chat-detail.html?thread=${encodeURIComponent(threadId)}`
      : detailWorkerUrl(listingId);

    return pushNotification({
      type: "worker",
      category: "ワーカー",
      title: "やりとりが開始されました",
      body: `${requester} さんとのやりとりチャットが開始されました。内容を確認してください。`,
      actionLabel: "チャットを開く",
      href: chatUrl,
      targetUrl: chatUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "worker",
      recipientUserId: pickStr(thread.sellerId, request.worker_id),
      listingId,
      notifyListingTitle: title,
      notifySupplementLine: `依頼者：${requester}`,
      threadId,
    });
  }

  function notifyWorkerRejected(detail) {
    const listing = detail?.listing || {};
    const listingId = pickStr(listing.id, listing.listing_id);
    const title = pickStr(listing.title) || "ワーカー";

    return pushNotification({
      type: "worker",
      category: "ワーカー",
      title: "依頼が辞退されました",
      body: `${title} の依頼結果が届きました。`,
      actionLabel: "内容を確認",
      href: detailWorkerUrl(listingId),
      targetUrl: detailWorkerUrl(listingId),
      priority: "medium",
      source: "worker",
      recipientRole: "requester",
    });
  }

  /**
   * 業務サービス — 問い合わせ / 見積相談開始
   * @param {{ listing?: object, room?: object, deal?: object, intent?: string }} detail
   */
  function notifyBusinessInquiry(detail) {
    const listing = detail?.listing || {};
    const room = detail?.room || {};
    const contact = detail?.contact || {};
    const thread = detail?.thread || {};
    const serviceId = pickStr(
      listing.id,
      listing.demo_id,
      listing.form_data?.demo_id,
      detail?.serviceId,
      thread.listingId
    );
    const listingTitle = pickStr(
      listing.title,
      listing.company_name,
      thread.listingTitle,
      global.TasuBusinessServiceFlow?.getListingTitle?.(listing)
    ) || "業務サービス";
    const intent = String(detail?.intent || "consult").trim();
    const intentLabel = intent === "estimate" ? "見積もり相談" : "問い合わせ";
    const requesterName = pickStr(contact.requester_name, thread.buyerName) || "依頼者";

    const roomId = pickStr(room.id, room.chat_id, detail?.deal?.chat_id);
    let targetUrl = buildListingContactsNotifyUrl(serviceId, listing, {
      contactId: contact.contact_id,
      category: "business_service",
    });
    if (!contact.contact_id && roomId && global.TasuBusinessServiceFlow?.chatDetailUrl) {
      targetUrl = global.TasuBusinessServiceFlow.chatDetailUrl(roomId, detail?.deal?.id);
    } else if (!contact.contact_id && roomId) {
      targetUrl = `chat-detail.html?roomId=${encodeURIComponent(roomId)}`;
    } else if (!contact.contact_id) {
      targetUrl = detailBusinessUrl(serviceId);
    }

    const contactCopy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.("business_service") || {};

    return pushNotification({
      type: "business",
      category: "業務サービス",
      title: pickStr(contactCopy.title, "相談/依頼が届きました"),
      body: pickStr(
        contactCopy.body,
        `${listingTitle} — ${requesterName} さんから${intentLabel}がありました。内容を確認してください。`
      ),
      actionLabel: pickStr(contactCopy.cta, contactsNotifyActionLabel("business_service")),
      href: targetUrl,
      targetUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "business",
      recipientRole: "provider",
      recipientUserId: pickStr(
        thread.sellerId,
        listing.user_id,
        resolveListingSellerUserId(serviceId, listing),
        resolveBenchPartnerAId("business_service")
      ),
      listingId: serviceId,
      notifyListingTitle: listingTitle,
      notifySupplementLine: `依頼者：${requesterName}`,
    });
  }

  /**
   * 店舗 — 注文
   * @param {{ order?: object, shopId?: string, productId?: string }} detail
   */
  function notifyShopProductPurchased(detail) {
    const order = detail?.order || {};
    const shopId = pickStr(order.shop_id, order.shop_listing_id, detail?.shopId);
    const listing =
      detail?.listing ||
      global.TasuListingContactRequestsStore?.resolveListing?.(shopId) ||
      { id: shopId, listing_type: "shop_store" };
    const contact =
      detail?.contact ||
      global.TasuListingContactRequestsStore?.listByListing?.(shopId)?.[0] ||
      {
        product_id: pickStr(order.product_id, detail?.productId),
        product_name: pickStr(order.product_name, detail?.productName),
        requester_name: pickStr(detail?.buyerName, "購入者"),
      };
    return notifyListingPurchased(
      { listing, contact, order },
      {
        type: "shop",
        categoryLabel: "店舗・販売",
        title: "商品が購入されました",
        fallbackTitle: pickStr(listing.title, "店舗商品"),
      }
    );
  }

  function notifyShopOrder(detail) {
    const order = detail?.order || {};
    const shopId = pickStr(order.shop_id, order.shop_listing_id, detail?.shopId);
    const productId = pickStr(order.product_id, detail?.productId);
    const productName = pickStr(order.product_name, detail?.productName) || "商品";
    const listing = global.TasuListingContactRequestsStore?.resolveListing?.(shopId);
    const Checkout = global.TasuShopCheckout;
    if (
      listing &&
      Checkout?.isShopConnectPurchaseMode?.(listing, {
        shopId,
        productId,
        productName,
        demoConnect: detail?.demoConnect,
      })
    ) {
      const recorded = Checkout?.recordShopPurchaseContact?.({
        shopId,
        productId,
        productName,
        shop: listing,
        demoConnect: detail?.demoConnect,
      });
      if (recorded?.ok) {
        return notifyShopProductPurchased({
          listing: recorded.listing || listing,
          contact: recorded.contact,
          order,
        });
      }
    }

    const targetUrl = orderCompleteUrl({
      demo: order.source === "demo" ? "1" : undefined,
      order_id: order.id,
      shopId,
      productId,
    });

    return pushNotification({
      type: "shop",
      title: "店舗・販売に新しい通知があります",
      body: `${productName} の注文が発生しました。`,
      targetUrl,
      priority: "important",
      source: "shop",
    });
  }

  function buildSellerPlatformChatUrl(thread, listing) {
    const threadId = pickStr(thread?.id);
    const sellerId = pickStr(thread?.sellerId, listing?.user_id, listing?.seller_user_id);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(thread);
    if (profile && Demo?.chatUrl && sellerId) {
      return Demo.chatUrl(profile.id, sellerId, {
        review: Demo.REVIEW_PARAM || "chat-demo",
        connect: profile.connect,
        from: "notify",
      });
    }
    if (!threadId) return "#";
    try {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("thread", threadId);
      if (sellerId) u.searchParams.set("userId", sellerId);
      if (global.TasuTalkRuntime?.isTalkProductionMode?.() !== true) {
        u.searchParams.set("talkDev", "1");
      }
      u.searchParams.set("from", "notify");
      return u.pathname + u.search;
    } catch {
      return `chat-detail.html?thread=${encodeURIComponent(threadId)}`;
    }
  }

  function notifyListingPurchased(detail, opts) {
    const listing = detail?.listing || {};
    const contact = detail?.contact || {};
    const thread = detail?.thread || {};
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const listingTitle = pickStr(listing.title, thread.listingTitle) || pickStr(opts?.fallbackTitle, "出品");
    const categoryKey = global.TasuPlatformChatFee?.resolveCategoryKey?.(listing) || pickStr(opts?.type);
    const contactCopy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(categoryKey) || {};
    const buyerLabel = pickStr(contactCopy.buyerRole, "購入者");
    const buyerName = pickStr(contact.requester_name, thread.buyerName, detail?.buyerName) || buyerLabel;
    const contactsUrl = buildManagementNotifyUrl(listingId, listing, {
      contactId: contact.contact_id,
      category: categoryKey,
      contact,
    });
    const categoryLabel = pickStr(opts?.categoryLabel, "取引");
    const type = pickStr(opts?.type, "listing");

    return pushNotification({
      type,
      category: categoryLabel,
      title: pickStr(opts?.title, contactCopy.title, `${categoryLabel}が購入されました`),
      body: pickStr(
        opts?.body,
        contactCopy.body,
        `${listingTitle} — ${buyerName} さんが購入しました。内容を確認してください。`
      ),
      actionLabel: pickStr(contactCopy.cta, contactsNotifyActionLabel(categoryKey)),
      href: contactsUrl,
      targetUrl: contactsUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "seller",
      recipientUserId: pickStr(
        thread.sellerId,
        resolveListingSellerUserId(listingId, listing),
        resolveWorkerOwnerUserId(listingId, listing),
        listing.user_id,
        resolveBenchPartnerAId(categoryKey)
      ),
      listingId,
      notifyListingTitle: listingTitle,
      notifySupplementLine: `${buyerLabel}：${buyerName}`,
    });
  }

  function notifyListingContactDeclined(detail) {
    const listing = detail?.listing || {};
    const contact = detail?.contact || {};
    const thread = detail?.thread || {};
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const listingTitle = pickStr(listing.title, thread.listingTitle) || "出品";
    const sellerName = pickStr(thread.sellerName, "出品者");
    const buyerId = pickStr(contact.requester_id, thread.buyerId);
    const Fee = global.TasuPlatformChatFee;
    const categoryKey = Fee?.resolveCategoryKey?.(listing) || "";
    const categoryLabel = Fee?.getCategoryLabel?.(categoryKey) || "取引";
    const type = Fee?.getNotifyType?.(categoryKey) || "skill";
    const detailUrl = buildListingContactsNotifyUrl(listingId, listing, { category: categoryKey });

    return pushNotification({
      type,
      category: categoryLabel,
      title: "今回は見送りになりました",
      body: `${sellerName} さんが今回の${categoryLabel}（${listingTitle}）のやりとりを見送りました。`,
      actionLabel: "内容を確認する",
      href: detailUrl,
      targetUrl: detailUrl,
      priority: "medium",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "buyer",
      recipientUserId: buyerId,
      listingId,
      notifyListingTitle: listingTitle,
    });
  }

  /**
   * スキル — 購入（Connectなし: 出品者へ通知 → 出品者がチャット開始）
   */
  function notifySkillPurchased(detail) {
    return notifyListingPurchased(detail, {
      type: "skill",
      categoryLabel: "スキル",
      title: "スキルが購入されました",
      fallbackTitle: "スキル",
    });
  }

  function notifyProductPurchased(detail) {
    return notifyListingPurchased(detail, {
      type: "product",
      categoryLabel: "商品",
      title: "商品が購入されました",
      fallbackTitle: "商品",
    });
  }

  const PURCHASE_CHAT_STARTED_CATEGORY_KEYS = new Set([
    "skill",
    "product",
    "worker",
    "general",
    "business_service",
    "business",
    "shop_store",
    "shop",
  ]);

  function resolvePurchaseCategoryKey(detail) {
    const thread = detail?.thread || {};
    const listing = detail?.listing || {};
    const Fee = global.TasuPlatformChatFee;
    const raw = pickStr(
      detail?.categoryKey,
      listing.listing_type,
      thread.listingType,
      Fee?.resolveCategoryKey?.(listing)
    );
    return Fee?.normalizeCategoryKey?.(raw) || raw || "skill";
  }

  function resolvePurchaseDemoProfileId(categoryKey) {
    const key = pickStr(categoryKey).toLowerCase().replace(/-/g, "_");
    if (key === "business_service" || key === "business") return "business";
    if (key === "shop_store" || key === "shop") return "shop";
    return key || "skill";
  }

  /** Connectなし購入系 — やりとり開始通知の chat-detail URL（スキルUI導線と同型） */
  function buildPurchaseChatNotifyUrl(listingId, options) {
    const thread = options?.thread || {};
    const threadId = pickStr(options?.threadId, thread?.id);
    const userId = pickStr(options?.userId);
    const categoryKey = resolvePurchaseCategoryKey({ thread, listing: options?.listing, categoryKey: options?.categoryKey });
    const resolvedListingId = pickStr(listingId, thread?.listingId);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile =
      Demo?.resolveProfileForThread?.(thread || threadId) ||
      Demo?.getProfile?.(resolvePurchaseDemoProfileId(categoryKey), options?.connect === true);
    if (profile && Demo?.chatUrl && threadId && userId) {
      const state = pickStr(options?.state, options?.demoState);
      const extra = {
        threadId,
        listingId: resolvedListingId,
        from: pickStr(options?.from, "notify"),
        connect: options?.connect === true || profile.connect,
        review: options?.review,
      };
      if (state) {
        extra.state = state;
        if (state === "completed") extra.openReview = pickStr(options?.openReview, "1");
      }
      return Demo.chatUrl(profile.id, userId, extra);
    }
    if (!threadId || !userId) return "#";
    const demoProfile = resolvePurchaseDemoProfileId(categoryKey);
    try {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("thread", threadId);
      if (resolvedListingId) u.searchParams.set("listingId", resolvedListingId);
      u.searchParams.set("userId", userId);
      u.searchParams.set("demoProfile", demoProfile);
      u.searchParams.set("demoConnect", options?.connect === true ? "1" : "0");
      u.searchParams.set("from", pickStr(options?.from, "notify"));
      if (global.TasuTalkRuntime?.isTalkProductionMode?.() !== true) {
        u.searchParams.set("talkDev", "1");
      }
      return u.pathname + u.search;
    } catch {
      return `chat-detail.html?thread=${encodeURIComponent(threadId)}&listingId=${encodeURIComponent(resolvedListingId)}&userId=${encodeURIComponent(userId)}&demoProfile=${encodeURIComponent(demoProfile)}&demoConnect=0&from=notify&talkDev=1`;
    }
  }

  /** @deprecated use buildPurchaseChatNotifyUrl */
  function buildProductChatNotifyUrl(listingId, options) {
    return buildPurchaseChatNotifyUrl(listingId, { ...options, categoryKey: "product" });
  }

  function collectPurchaseChatStartedBuyerIdCandidates(detail, thread, profile) {
    return [
      pickStr(detail?.actorBId, detail?.buyerUserId, detail?.buyerId),
      pickStr(thread?.buyerId),
      pickStr(profile?.partnerBId),
      pickStr(detail?.contact?.requester_id),
    ].filter(Boolean);
  }

  /** worker 等 — 依頼者IDが seller に誤って入るのを防ぎ bench A / 掲載者を優先 */
  function resolvePurchaseChatStartedSellerUserId(detail, categoryKey, thread, listing, listingId, profile) {
    const benchA = resolveBenchPartnerAId(categoryKey);
    const profileA = pickStr(profile?.partnerAId);
    const listingOwner =
      categoryKey === "worker"
        ? resolveWorkerOwnerUserId(listingId, listing)
        : resolveListingSellerUserId(listingId, listing);
    const threadSeller = pickStr(thread?.sellerId, thread?.partnerUserId);
    const detailSeller = pickStr(detail?.actorAId, detail?.sellerUserId);
    const buyerIds = new Set(collectPurchaseChatStartedBuyerIdCandidates(detail, thread, profile));
    const tryPick = (...candidates) => {
      for (const raw of candidates) {
        const id = pickStr(raw);
        if (!id || buyerIds.has(id)) continue;
        return id;
      }
      return "";
    };
    if (categoryKey === "worker") {
      return (
        tryPick(detailSeller, profileA, benchA, listingOwner, threadSeller) ||
        pickStr(profileA, benchA, listingOwner, threadSeller, detailSeller)
      );
    }
    return pickStr(detailSeller, threadSeller, profileA, listingOwner, benchA);
  }

  function resolvePurchaseChatStartedBuyerUserId(detail, thread, profile) {
    return pickStr(
      detail?.actorBId,
      detail?.buyerUserId,
      detail?.buyerId,
      profile?.partnerBId,
      thread?.buyerId,
      detail?.contact?.requester_id
    );
  }

  function resolvePurchaseChatStartedNotifyContext(detail) {
    const thread = detail?.thread || {};
    const listing = detail?.listing || {};
    const categoryKey = resolvePurchaseCategoryKey(detail);
    const threadId = pickStr(detail?.threadId, thread?.id);
    const listingId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const listingTitle =
      pickStr(listing.title, thread.listingTitle) ||
      global.TasuPlatformChatFee?.getCategoryLabel?.(categoryKey) ||
      "出品";
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile =
      Demo?.resolveProfileForThread?.(thread || threadId) ||
      Demo?.getProfile?.(resolvePurchaseDemoProfileId(categoryKey), false);
    const contactCopy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(categoryKey) || {};
    const spec = global.TasuPlatformChatCategoryFlow?.getCategorySpec?.(
      global.TasuPlatformChatCategoryFlow?.threadStubFromKey?.(categoryKey)
    ) || {};
    const buyerLabel = pickStr(contactCopy.buyerRole, spec.buyerRole, "購入者");
    const sellerLabel = pickStr(spec.sellerRole, "出品者");
    const sellerUserId = resolvePurchaseChatStartedSellerUserId(
      detail,
      categoryKey,
      thread,
      listing,
      listingId,
      profile
    );
    const buyerUserId = resolvePurchaseChatStartedBuyerUserId(detail, thread, profile);
    const buyerName = pickStr(detail?.buyerName, thread.buyerName, detail?.contact?.requester_name) || buyerLabel;
    const sellerName = pickStr(thread.sellerName, sellerLabel);
    const categoryLabel = global.TasuPlatformChatFee?.getCategoryLabel?.(categoryKey) || spec.label || "スキル";
    const notifyType = global.TasuPlatformChatFee?.getNotifyType?.({ listing_type: categoryKey }) || categoryKey;
    const urlBase = { thread, threadId, listingId, listing, categoryKey, from: "notify" };
    return {
      thread,
      threadId,
      listingId,
      listingTitle,
      categoryKey,
      categoryLabel,
      notifyType,
      sellerUserId,
      buyerUserId,
      buyerName,
      sellerName,
      buyerLabel,
      sellerLabel,
      sellerChatUrl: buildPurchaseChatNotifyUrl(listingId, { ...urlBase, userId: sellerUserId }),
      buyerChatUrl: buildPurchaseChatNotifyUrl(listingId, { ...urlBase, userId: buyerUserId }),
    };
  }

  function buildPurchaseChatStartedNotifyFields(ctx, role) {
    const copy = global.TasuPlatformChatCategoryFlow?.getChatStartedNotifyCopy?.(ctx.categoryKey) || {};
    const title = pickStr(copy.title, "やりとりが開始されました");
    const cta = pickStr(copy.cta, "チャットを開く");
    const body =
      role === "seller"
        ? pickStr(
            copy.sellerBody,
            `${ctx.buyerName} さんとのやりとりチャットが開始されました。内容を確認してください。`
          )
        : pickStr(
            copy.buyerBody,
            `${ctx.sellerLabel}が確認し、チャットが開始されました。内容を確認してください。`
          );
    return {
      title,
      body,
      actionLabel: cta,
      notifyListingTitle: ctx.listingTitle,
      notifySupplementLine:
        role === "seller"
          ? `${ctx.buyerLabel}：${ctx.buyerName}`
          : `${ctx.sellerLabel}：${ctx.sellerName}`,
    };
  }

  /** スキル基準 — 550円支払い後: 出品者/掲載者（A）へやりとり開始通知 */
  function notifyPurchaseChatStartedToSeller(detail) {
    const ctx = resolvePurchaseChatStartedNotifyContext(detail);
    if (!ctx.threadId || !ctx.sellerUserId || ctx.sellerChatUrl === "#") return null;
    const fields = buildPurchaseChatStartedNotifyFields(ctx, "seller");
    return pushNotification({
      id: `platform-${ctx.categoryKey}-chat-started-seller-${ctx.threadId}-${ctx.sellerUserId}`,
      type: ctx.notifyType,
      category: ctx.categoryLabel,
      ...fields,
      href: ctx.sellerChatUrl,
      targetUrl: ctx.sellerChatUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "seller",
      recipientUserId: ctx.sellerUserId,
      threadId: ctx.threadId,
      listingId: ctx.listingId,
    });
  }

  /** スキル基準 — 550円支払い後: 購入者/依頼者（B）へやりとり開始通知 */
  function notifyPurchaseChatStartedToBuyer(detail) {
    const ctx = resolvePurchaseChatStartedNotifyContext(detail);
    if (!ctx.threadId || !ctx.buyerUserId || ctx.buyerChatUrl === "#") return null;
    const fields = buildPurchaseChatStartedNotifyFields(ctx, "buyer");
    return pushNotification({
      id: `platform-${ctx.categoryKey}-chat-started-buyer-${ctx.threadId}-${ctx.buyerUserId}`,
      type: ctx.notifyType,
      category: ctx.categoryLabel,
      ...fields,
      href: ctx.buyerChatUrl,
      targetUrl: ctx.buyerChatUrl,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "buyer",
      recipientUserId: ctx.buyerUserId,
      threadId: ctx.threadId,
      listingId: ctx.listingId,
    });
  }

  function buildJobChatOpenedNotifyFields(ctx, role) {
    const applicantName = pickStr(ctx.application?.applicant_name, ctx.thread?.buyerName, "応募者");
    const posterLabel = pickStr(global.TasuPlatformChatJobCard?.JOB_NOTIFY_COPY?.posterRole, "掲載者");
    return {
      title: "やりとりが開始されました",
      body:
        role === "poster"
          ? `${applicantName} さんとのやりとりチャットが開始されました。内容を確認してください。`
          : "応募した求人のやりとりチャットが開通しました。",
      actionLabel: role === "poster" ? "チャットを開く" : "やりとりを開く",
      notifyListingTitle: pickStr(ctx.listing?.title, ctx.thread?.listingTitle) || "求人",
      notifySupplementLine:
        role === "poster" ? `応募者：${applicantName}` : `${posterLabel}：掲載者`,
    };
  }

  /** 求人 — やりとり開通時に A/B 双方へ「やりとりが開始されました」 */
  function notifyJobChatOpenedToBoth(detail) {
    const ctx = resolveJobHireNotifyContext(detail);
    if (!ctx.threadId || !ctx.threadReady) {
      return { ok: false, reason: "thread_not_ready", threadId: ctx.threadId };
    }
    const posterFields = buildJobChatOpenedNotifyFields(ctx, "poster");
    const applicantFields = buildJobChatOpenedNotifyFields(ctx, "applicant");
    const posterRow =
      ctx.posterUserId && ctx.posterChatUrl !== "#"
        ? pushJobMinimalNotify({
            id: `platform-job-chat-started-poster-${ctx.threadId}-${ctx.posterUserId}`,
            ...posterFields,
            href: ctx.posterChatUrl,
            targetUrl: ctx.posterChatUrl,
            priority: "high",
            recipientRole: "poster",
            recipientUserId: ctx.posterUserId,
            threadId: ctx.threadId,
            listingId: ctx.listingId,
            applicationId: ctx.applicationId,
            ...buildJobNotifyCardFields(
              { ...detail, thread: ctx.thread, application: ctx.application },
              "hired"
            ),
          })
        : null;
    const applicantRow =
      ctx.applicantUserId && ctx.applicantChatUrl !== "#"
        ? pushJobMinimalNotify({
            id: `platform-job-chat-started-applicant-${ctx.threadId}-${ctx.applicantUserId}`,
            ...applicantFields,
            href: ctx.applicantChatUrl,
            targetUrl: ctx.applicantChatUrl,
            priority: "high",
            recipientRole: "applicant",
            recipientUserId: ctx.applicantUserId,
            threadId: ctx.threadId,
            listingId: ctx.listingId,
            applicationId: ctx.applicationId,
            ...buildJobNotifyCardFields(
              { ...detail, thread: ctx.thread, application: ctx.application },
              "hired"
            ),
          })
        : null;
    const ok = Boolean(posterRow || applicantRow);
    if (ok && ctx.threadId) {
      refreshBenchNotifyForCompletionRecipients(ctx.posterUserId, ctx.applicantUserId);
      try {
        global.TasuPlatformChatBenchEmbed?.postBenchChatStarted?.({
          thread: ctx.thread,
          threadId: ctx.threadId,
          buyerId: ctx.applicantUserId,
        });
      } catch {
        /* ignore */
      }
    }
    return { ok, posterRow, applicantRow, categoryKey: "job" };
  }

  const PLATFORM_CHAT_MESSAGE_SOURCE = "platform_chat_demo_message_v1";
  const PLATFORM_CHAT_MESSAGE_TITLE = "新しいメッセージが届きました";
  const PLATFORM_CHAT_MESSAGE_CTA = "チャットを開く";

  /** デモ/ライブフロー — 送信者ではなく相手へメッセージ通知（thread ごとに最新1件へ更新） */
  function notifyPlatformChatMessage(detail) {
    const threadId = pickStr(detail?.threadId, detail?.roomId);
    const senderId = pickStr(detail?.senderId);
    const recipientUserId = pickStr(detail?.recipientUserId);
    const text = pickStr(detail?.text);
    if (!threadId || !senderId || !recipientUserId || !text || recipientUserId === senderId) {
      return null;
    }
    const preview = text.length > 48 ? `${text.slice(0, 48)}…` : text;
    const senderName = pickStr(detail?.senderName, "相手");
    const notifyId = pickStr(
      detail?.id,
      `platform-chat-demo-message-${threadId}-${recipientUserId}`
    );
    const href = pickStr(detail?.href, detail?.targetUrl, "#");
    return pushNotification({
      id: notifyId,
      type: pickStr(detail?.type, "skill"),
      category: pickStr(detail?.category, "取引"),
      title: PLATFORM_CHAT_MESSAGE_TITLE,
      body: `${senderName}：${preview}`,
      actionLabel: PLATFORM_CHAT_MESSAGE_CTA,
      href,
      targetUrl: href,
      priority: "medium",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: PLATFORM_CHAT_MESSAGE_SOURCE,
      senderUserId: senderId,
      recipientUserId,
      threadId,
      listingId: pickStr(detail?.listingId),
      notifyListingTitle: pickStr(detail?.notifyListingTitle),
    });
  }

  /** スキル基準 — やりとり開始時に A/B 双方へ通知 */
  function notifyPurchaseChatStartedAfterPayment(detail) {
    const categoryKey = resolvePurchaseCategoryKey(detail);
    if (categoryKey === "job") {
      return notifyJobChatOpenedToBoth(detail);
    }
    if (!PURCHASE_CHAT_STARTED_CATEGORY_KEYS.has(categoryKey)) {
      return { ok: false, reason: "unsupported_category", categoryKey };
    }
    const ctx = resolvePurchaseChatStartedNotifyContext(detail);
    const enriched = {
      ...detail,
      actorAId: ctx.sellerUserId,
      actorBId: ctx.buyerUserId,
    };
    const sellerRow = notifyPurchaseChatStartedToSeller(enriched);
    const buyerRow = notifyPurchaseChatStartedToBuyer(enriched);
    const thread = detail?.thread || {};
    const threadId = pickStr(detail?.threadId, thread?.id);
    const ok = Boolean(sellerRow || buyerRow);
    if (ok && threadId) {
      try {
        global.TasuPlatformChatBenchEmbed?.postBenchChatStarted?.({
          thread,
          threadId,
          buyerId: pickStr(thread.buyerId, detail?.buyerId),
        });
      } catch {
        /* ignore */
      }
    }
    return { ok, sellerRow, buyerRow, categoryKey };
  }

  function notifyProductChatStartedToSeller(detail) {
    return notifyPurchaseChatStartedToSeller({ ...detail, categoryKey: "product" });
  }

  function notifyProductChatStartedToBuyer(detail) {
    return notifyPurchaseChatStartedToBuyer({ ...detail, categoryKey: "product" });
  }

  function notifyProductChatStartedAfterPayment(detail) {
    return notifyPurchaseChatStartedAfterPayment({ ...detail, categoryKey: "product" });
  }

  /**
   * 店舗 — 問い合わせ（新規相談スレッド）
   * @param {{ listing?: object, thread?: object, productId?: string, productName?: string }} detail
   */
  function notifyShopInquiry(detail) {
    const listing = detail?.listing || {};
    const contact = detail?.contact || {};
    const thread = detail?.thread || {};
    const shopId = pickStr(listing.id, listing.listing_id, thread.listingId);
    const productId = pickStr(detail?.productId, contact.product_id);
    const shopName = pickStr(
      listing.title,
      listing.company_name,
      listing.form_data?.shop_name,
      thread.listingTitle
    ) || "店舗";
    const productName = pickStr(detail?.productName, contact.product_name);
    const targetUrl = buildListingContactsNotifyUrl(shopId, listing, {
      contactId: contact.contact_id,
      category: "shop_store",
    });

    const buyerName = pickStr(contact.requester_name, thread.buyerName) || "お客様";
    const contactCopy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.("shop_store") || {};
    const body = pickStr(
      contactCopy.body,
      productName
        ? `${shopName} — ${productName} について ${buyerName} さんからお問い合わせがありました。`
        : `${shopName} — ${buyerName} さんからお問い合わせがありました。内容を確認してください。`
    );

    return pushNotification({
      type: "shop",
      category: pickStr(global.TasuPlatformChatFee?.getCategoryLabel?.("shop_store"), "店舗・販売"),
      title: pickStr(contactCopy.title, "予約/注文が入りました"),
      body,
      actionLabel: pickStr(contactCopy.cta, contactsNotifyActionLabel("shop_store")),
      href: targetUrl,
      targetUrl,
      priority: "important",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "shop",
      recipientRole: "seller",
      recipientUserId: pickStr(
        thread.sellerId,
        listing.user_id,
        listing.seller_user_id,
        resolveListingSellerUserId(shopId, listing),
        resolveBenchPartnerAId("shop_store")
      ),
      listingId: shopId,
      notifyListingTitle: shopName,
      notifySupplementLine: `注文者：${buyerName}`,
    });
  }

  /**
   * 安否確認ログ作成
   * @param {object} log
   */
  function shouldNotifyAnpiLog(log) {
    const ev = String(log?.event_type || "").trim();
    if (!ev || ev === "line_oauth_unlinked" || ev === "line_notification_preview") {
      return false;
    }
    return ANPI_TALK_EVENT_TYPES.has(ev);
  }

  function resolveAnpiTalkTargetUrl(log) {
    const ev = String(log?.event_type || "").trim();
    if (ANPI_URGENT_TALK_EVENT_TYPES.has(ev)) return ANPI_URGENT_TARGET;
    return ANPI_TARGET;
  }

  function notifyAnpiRequest(log) {
    if (!shouldNotifyAnpiLog(log)) return null;
    const label =
      global.TasuAnpiNotifications?.EVENT_TYPE_LABELS?.[log.event_type] ||
      log.title ||
      log.event_type ||
      "安否";
    const targetUrl = resolveAnpiTalkTargetUrl(log);
    return pushNotification({
      type: "anpi",
      title: "安否確認通知があります",
      body: pickStr(log.message, log.title, label).slice(0, 160) || label,
      targetUrl,
      href: targetUrl,
      actionLabel: "確認する",
      priority: ANPI_URGENT_TALK_EVENT_TYPES.has(String(log.event_type || "").trim())
        ? "urgent"
        : "normal",
      source: "anpi",
      sendTalkMessage: true,
      officialRoomId: "official_anpi",
    });
  }

  function builderBoardThreadHref(threadId, role) {
    const tid = pickStr(threadId);
    if (!tid) return BUILDER_TARGET;
    const href = `builder/board-thread.html?thread_id=${encodeURIComponent(tid)}`;
    const r = pickStr(role);
    return r ? `${href}&role=${encodeURIComponent(r)}` : href;
  }

  function builderMvpThreadHref(threadId, role, threadType) {
    const tid = pickStr(threadId);
    if (!tid) return BUILDER_TARGET;
    const r = pickStr(role) || "partner";
    const tt = pickStr(threadType);
    const base = `builder/mvp-thread.html?thread_id=${encodeURIComponent(tid)}&role=${encodeURIComponent(r)}`;
    return tt ? `${base}&threadType=${encodeURIComponent(tt)}` : base;
  }

  function usesMvpPartnerThreadSurface(projectKind) {
    const kind = pickStr(projectKind).toLowerCase();
    return kind === "calendar" || kind === "worker" || kind === "hire" || kind === "admin_ops";
  }

  function resolveBuilderOpsThreadType(projectKind) {
    const kind = pickStr(projectKind).toLowerCase();
    return kind === "calendar" || kind === "admin_ops" ? "ops_partner" : "";
  }

  const BUILDER_GENERAL_MVP_THREAD_TYPES = new Set(["partner_user", "user_user", "vendor_user"]);

  function resolveBuilderNotifyThreadRole(recipientRole) {
    const role = pickStr(recipientRole).toLowerCase();
    if (role === "owner" || role === "partner" || role === "user" || role === "vendor") return role;
    return "partner";
  }

  function resolveBuilderThreadNotifyHref({ projectKind, threadId, recipientRole, projectId, threadType }) {
    const role = resolveBuilderNotifyThreadRole(recipientRole);
    const generalThreadType = pickStr(threadType);
    if (!pickStr(threadId)) {
      if (usesMvpPartnerThreadSurface(projectKind)) {
        return `builder/partner-assignment.html?role=${encodeURIComponent(role)}&projectId=${encodeURIComponent(
          pickStr(projectId) || "builder_demo_001"
        )}`;
      }
      return builderBoardProjectHref(projectId);
    }
    if (BUILDER_GENERAL_MVP_THREAD_TYPES.has(generalThreadType)) {
      return builderMvpThreadHref(threadId, role, generalThreadType);
    }
    if (usesMvpPartnerThreadSurface(projectKind)) {
      return builderMvpThreadHref(threadId, role, resolveBuilderOpsThreadType(projectKind));
    }
    return builderBoardThreadHref(threadId, role);
  }

  function builderBoardProjectHref(projectId, view) {
    const pid = pickStr(projectId);
    if (!pid) return "builder/board-projects.html";
    const base = `builder/board-project-detail.html?id=${encodeURIComponent(pid)}`;
    return view ? `${base}&view=${encodeURIComponent(view)}` : base;
  }

  function builderApplicantRejectPublicHref(projectId, projectKind, detail) {
    const explicit = pickStr(detail?.href);
    if (explicit && explicit !== "#" && !/view=applications/i.test(explicit)) {
      return explicit.replace(/^\.\.\//, "");
    }
    const flowId = pickStr(detail?.bench_flow_id, detail?.benchFlowId, detail?.threadType);
    const generalHref =
      typeof globalThis.TasuBuilderGeneralFlow?.resolvePublicDetailHref === "function"
        ? globalThis.TasuBuilderGeneralFlow.resolvePublicDetailHref(
            { bench_flow_id: flowId },
            { relative: false }
          )
        : "";
    if (generalHref) return generalHref.replace(/^\.\.\//, "");
    const pid = pickStr(projectId);
    if (pid === "job_demo_full_001") {
      return "public-board-detail.html?id=pub-board-job-001&type=job";
    }
    if (pid === "demo-project-001") {
      return "public-board-detail.html?id=pub-board-project-001&type=project";
    }
    const type = pickStr(projectKind).toLowerCase() === "job" ? "job" : "project";
    return pid ? `public-board-detail.html?id=${encodeURIComponent(pid)}&type=${type}` : "public-board.html";
  }

  function resolveBuilderMvpNotifyPayload(detail) {
    const type = pickStr(detail?.type).toLowerCase();
    const projectId = pickStr(detail?.projectId, detail?.project_id);
    const threadId = pickStr(detail?.threadId, detail?.thread_id);
    const projectTitle = pickStr(detail?.projectTitle, detail?.title) || "案件";
    const body = pickStr(detail?.body);

    const explicitTitle = pickStr(detail?.title);
    const explicitBody = pickStr(detail?.body);
    const explicitHref = pickStr(detail?.href);
    const recipientRole = pickStr(detail?.recipientRole).toLowerCase();
    const threadType = pickStr(detail?.threadType, detail?.bench_thread_type);

    const map = {
      application: {
        title: "応募がありました",
        actionLabel: "応募者を見る",
        href: builderBoardProjectHref(projectId, "applications"),
        audienceScope: "builder_board",
      },
      selected: {
        title: "採用されました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — やりとりチャットへ進んでください。`,
      },
      hire_confirmed: {
        title: "採用が完了しました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — やりとりチャットへ進んでください。`,
      },
      ai_vendor_consult: {
        title: "相談リクエストが届きました",
        actionLabel: "相談を確認する",
        href: builderMvpThreadHref(threadId, recipientRole || "vendor", "vendor_user"),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — AI業者検索から相談が届きました。`,
      },
      request_accepted: {
        title: "依頼を引き受けられました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — やりとりチャットへ進んでください。`,
      },
      rejected: {
        title: "今回は見送りになりました",
        actionLabel: "案件を見る",
        href: builderApplicantRejectPublicHref(
          projectId,
          pickStr(detail?.projectKind, detail?.board_type),
          detail
        ),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} の選考結果が届きました。`,
        noChat: true,
      },
      request_declined: {
        title: "依頼が辞退されました",
        actionLabel: "内容を確認",
        href: builderBoardProjectHref(projectId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} の依頼は辞退されました。`,
        noChat: true,
      },
      message: {
        title: "新しいメッセージが届きました",
        actionLabel: "やり取りを見る",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
      },
      attachment: {
        title: "添付ファイルが届きました",
        actionLabel: "ファイルを確認",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
      },
      completion_submitted: {
        title: "完了報告が届きました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — 完了報告をご確認ください。`,
      },
      completion_rejected: {
        title: "完了報告が差し戻されました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — 完了報告が差し戻されました。`,
      },
      completed: {
        title: "完了報告が届きました",
        actionLabel: "チャットを開く",
        href: builderBoardThreadHref(threadId),
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — 完了報告をご確認ください。`,
      },
      calendar_assignment: {
        title: "新しい案件が追加されました",
        actionLabel: "確認する",
        href: `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectId || "builder_demo_001")}`,
        audienceScope: "admin_ops",
        projectKind: "calendar",
      },
      completion_approved: {
        title: "完了報告が承認されました",
        actionLabel: "確認する",
        href: builderMvpThreadHref(threadId, "partner"),
        audienceScope: "admin_ops",
        projectKind: "admin_ops",
        defaultBody: `${projectTitle} — 完了報告が承認されました。`,
      },
      review_request: {
        title: "取引が完了しました",
        actionLabel: "レビューする",
        href: `${builderMvpThreadHref(threadId, recipientRole || "partner", threadType)}&openReview=1&notifyOpen=1`,
        audienceScope: "builder_board",
        defaultBody: `${projectTitle} — 相手の評価をお願いします。`,
      },
      review_received: {
        title: "レビューが投稿されました",
        actionLabel: "レビューを確認する",
        href: `${builderMvpThreadHref(threadId, recipientRole || "partner", threadType)}&notifyOpen=1#review`,
        audienceScope: "builder_board",
        defaultBody: "相手からの評価が更新されました。",
      },
      review_submitted: {
        title: "レビューが投稿されました",
        actionLabel: "レビューを確認する",
        href: `${builderMvpThreadHref(threadId, recipientRole || "partner", threadType)}&notifyOpen=1#review`,
        audienceScope: "builder_board",
        defaultBody: "相手からの評価が更新されました。",
      },
      dispatch: {
        title: "運営手配が完了しました",
        actionLabel: "案件を見る",
        href: builderBoardProjectHref(projectId),
        audienceScope: "admin_ops",
        projectKind: "admin_ops",
      },
      site_photo: {
        title: "現場写真が追加されました",
        actionLabel: "写真を確認",
        href: builderBoardThreadHref(threadId),
        audienceScope: "admin_ops",
        projectKind: "admin_ops",
      },
      attendance_enter: {
        title: "入場しました",
        actionLabel: "確認する",
        href: builderMvpThreadHref(threadId, "owner"),
        audienceScope: "admin_ops",
        projectKind: "admin_ops",
        defaultBody: `${projectTitle} — パートナーが現場に入場しました。`,
      },
      attendance_leave: {
        title: "退場しました",
        actionLabel: "確認する",
        href: builderMvpThreadHref(threadId, "owner"),
        audienceScope: "admin_ops",
        projectKind: "admin_ops",
        defaultBody: `${projectTitle} — パートナーが現場から退場しました。`,
      },
    };

    const row = map[type] || {
      title: "案件の更新があります",
      actionLabel: "詳細を見る",
      href: builderBoardProjectHref(projectId),
      audienceScope: "builder_board",
    };

    const projectKind = pickStr(detail?.projectKind, detail?.board_type, row.projectKind) || "project";
    const usesMvpSurface = usesMvpPartnerThreadSurface(projectKind);
    const isCalendarOps =
      projectKind === "calendar" || type === "calendar_assignment" || row.projectKind === "calendar";
    const threadNotifyHrefArgs = {
      projectKind,
      threadId,
      recipientRole,
      projectId,
      threadType,
    };

    let title = explicitTitle || row.title;
    let href = row.href;
    let audienceScope = row.audienceScope;
    let resolvedProjectKind = row.projectKind || projectKind;

    const threadNotifyTypes = new Set([
      "selected",
      "hire_confirmed",
      "request_accepted",
      "message",
      "attachment",
      "completion_submitted",
      "completion_rejected",
      "completion_approved",
      "completed",
      "review_request",
      "review_received",
      "review_submitted",
      "site_photo",
      "attendance_enter",
      "attendance_leave",
    ]);

    if (explicitHref) {
      href = explicitHref;
    } else if (type === "rejected" && projectId) {
      href = builderApplicantRejectPublicHref(projectId, projectKind, detail);
    } else if (threadNotifyTypes.has(type) && threadId) {
      href = resolveBuilderThreadNotifyHref(threadNotifyHrefArgs);
    }

    if (!explicitHref && isCalendarOps && usesMvpSurface) {
      audienceScope = "admin_ops";
      resolvedProjectKind = projectKind === "calendar" ? "calendar" : resolvedProjectKind;
      if (type === "calendar_assignment") {
        title = explicitTitle || "新しい案件が追加されました";
        href = `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectId || "builder_demo_001")}`;
      } else if (type === "selected") {
        title = explicitTitle || "依頼を引き受けました";
        href = resolveBuilderThreadNotifyHref({
          ...threadNotifyHrefArgs,
          projectKind: "calendar",
          recipientRole: "partner",
        });
      } else if (type === "hire_confirmed") {
        title = explicitTitle || "案件を受諾しました";
        href = resolveBuilderThreadNotifyHref({
          ...threadNotifyHrefArgs,
          projectKind: "calendar",
          recipientRole: recipientRole || "owner",
        });
      } else if (type === "rejected") {
        title = explicitTitle || "今回は見送りになりました";
        href = `builder/partner-assignment.html?role=partner&projectId=${encodeURIComponent(projectId || "builder_demo_001")}`;
      } else if (type === "request_declined") {
        title = explicitTitle || "パートナーが案件を辞退しました";
        href = "#";
      } else if (type === "completion_submitted" || type === "completion_rejected" || type === "completed") {
        title =
          explicitTitle ||
          (type === "completion_rejected"
            ? "完了報告が差し戻されました"
            : type === "completion_submitted"
              ? "完了報告が提出されました"
              : "完了報告が届きました");
        href = resolveBuilderThreadNotifyHref(threadNotifyHrefArgs);
      } else if (type === "completion_approved") {
        title = explicitTitle || "完了報告が承認されました";
        href = resolveBuilderThreadNotifyHref({
          ...threadNotifyHrefArgs,
          recipientRole: recipientRole || "partner",
        });
      } else if (type === "message" || type === "attachment") {
        title = explicitTitle || "新しいメッセージがあります";
      }
    } else if (!explicitHref && usesMvpSurface && (projectKind === "admin_ops" || audienceScope === "admin_ops")) {
      audienceScope = "admin_ops";
      resolvedProjectKind = projectKind === "admin_ops" ? "admin_ops" : resolvedProjectKind;
      if (type === "message" || type === "attachment") {
        title = explicitTitle || "新しいメッセージがあります";
      } else if (type === "completion_submitted") {
        title = explicitTitle || "完了報告が提出されました";
        href = resolveBuilderThreadNotifyHref(threadNotifyHrefArgs);
      } else if (type === "completion_approved") {
        title = explicitTitle || "完了報告が承認されました";
      }
    } else if (
      !explicitHref &&
      (type === "completion_submitted" || type === "completion_rejected" || type === "completed") &&
      threadId
    ) {
      href = resolveBuilderThreadNotifyHref(threadNotifyHrefArgs);
    }

    if (
      (type === "review_request" || type === "review_received" || type === "review_submitted") &&
      (usesMvpSurface || projectKind === "admin_ops" || projectKind === "calendar")
    ) {
      audienceScope = "admin_ops";
      resolvedProjectKind = projectKind === "calendar" ? "calendar" : "admin_ops";
    }

    const actionLabel = pickStr(detail?.actionLabel) || row.actionLabel || "確認する";

    const notifyOnly =
      detail?.notifyOnly === true ||
      (type === "request_declined" && isCalendarOps && (!href || href === "#"));

    return {
      title,
      actionLabel,
      href,
      audienceScope,
      projectKind: resolvedProjectKind,
      recipientRole: recipientRole || detail?.audience || "",
      projectTitle,
      body: explicitBody || body || row.defaultBody || `${projectTitle} に関するお知らせです。`,
      notifyOnly,
      priority:
        type === "application" || type === "selected" || type === "hire_confirmed" ? "high" : "normal",
    };
  }

  /**
   * Builder MVP — TALK通知タブへ builder_board / admin_ops を振り分け
   * @param {{ type?: string, body?: string, title?: string, projectTitle?: string, projectId?: string, project_id?: string, threadId?: string, thread_id?: string }} [detail]
   */
  function notifyBuilderGuide(detail) {
    const payload = resolveBuilderMvpNotifyPayload(detail || {});
    const isOpsExchange = payload.audienceScope === "admin_ops";
    const sendTalkMessage =
      detail?.sendTalkMessage === true || (detail?.sendTalkMessage !== false && isOpsExchange);

    const recipientUserId = resolveBuilderNotifyRecipientUserId({
      ...detail,
      recipientRole: payload.recipientRole || detail?.recipientRole || "",
    });
    const actionLabel =
      pickStr(detail?.actionLabel) ||
      payload.actionLabel ||
      (payload.audienceScope === "admin_ops" ? "現場連絡を開く" : "確認する");

    return pushNotification({
      type: "builder",
      category: "Builder",
      title: payload.title,
      body: payload.body,
      actionLabel,
      secondaryActionLabel: pickStr(detail?.secondaryActionLabel),
      builderNotifyKind: pickStr(detail?.builderNotifyKind),
      href: payload.href,
      targetUrl: payload.href,
      notifyOnly: payload.notifyOnly === true || detail?.notifyOnly === true,
      priority: payload.priority,
      source: "builder-mvp",
      audienceScope: payload.audienceScope,
      projectKind: payload.projectKind,
      recipientRole: payload.recipientRole || detail?.recipientRole || "",
      recipientUserId,
      threadId: pickStr(detail?.threadId, detail?.thread_id),
      thread_id: pickStr(detail?.threadId, detail?.thread_id),
      projectId: pickStr(detail?.projectId, detail?.project_id),
      project_id: pickStr(detail?.projectId, detail?.project_id),
      projectTitle: payload.projectTitle || pickStr(detail?.projectTitle, detail?.project_title) || "",
      sendTalkMessage,
      officialRoomId: sendTalkMessage ? pickStr(detail?.officialRoomId) || "official_builder" : null,
    });
  }

  function isJobListing(listing) {
    const type = pickStr(
      listing?.listing_type,
      listing?.listingType,
      listing?.type,
      global.document?.body?.dataset?.detailType
    ).toLowerCase();
    return type === "job";
  }

  function isShopListing(listing) {
    const type = pickStr(
      listing?.listing_type,
      listing?.listingType,
      listing?.type,
      global.document?.body?.dataset?.detailType
    ).toLowerCase();
    return type === "shop_store" || type === "shop-store";
  }

  function onAnpiLogCreated(ev) {
    const log = ev?.detail?.log || ev?.detail;
    if (log && typeof log === "object") notifyAnpiRequest(log);
  }

  /** deliverLog 以外で log-created のみ発火する経路用（例: LINE テスト Push） */
  function initEventBridges() {
    if (!global.document || global.__tasuTalkPlatformNotifyBridge) return;
    global.__tasuTalkPlatformNotifyBridge = true;
    global.document.addEventListener("tasu:anpi-notification-log-created", onAnpiLogCreated);
    global.document.addEventListener("tasful:anpi-notification-created", onAnpiLogCreated);
  }

  initEventBridges();

  global.TasuTalkPlatformNotify = {
    ANPI_TALK_EVENT_TYPES,
    ANPI_URGENT_TALK_EVENT_TYPES,
    BUILDER_TARGET,
    ANPI_TARGET,
    ANPI_URGENT_TARGET,
    resolveAnpiTalkTargetUrl,
    pushNotification,
    notifyJobApplication,
    notifyJobApplicationReceived,
    notifyJobHiredToApplicant,
    notifyJobHiredToPoster,
    notifyJobEndRequested,
    notifyJobCompletionRequested,
    notifyJobCompletionApprovedToRequester,
    notifyJobConversationCompleted,
    notifyJobReviewRequest,
    notifyPlatformReviewReceived,
    notifyDealCompletionRequested,
    notifyJobRejected,
    notifyWorkerRequestReceived,
    notifyWorkerAcceptedToRequester,
    notifyWorkerAcceptedToWorker,
    notifyWorkerRejected,
    detailWorkerUrl,
    buildJobApplicationsNotifyUrl,
    buildManagementNotifyUrl,
    buildListingContactsNotifyUrl,
    buildWorkerRequestsNotifyUrl,
    notifyListingPurchased,
    contactsNotifyActionLabel,
    buildJobHireChatNotifyUrl,
    buildJobHireResultNotifyUrl,
    resolveJobPosterUserId,
    refreshBenchNotifyForCompletionRecipients,
    pushJobCompletionNotifyDiag,
    collectJobReviewNotificationsFromStore,
    notifyBusinessInquiry,
    notifySkillPurchased,
    notifyListingContactDeclined,
    notifyProductPurchased,
    buildPurchaseChatNotifyUrl,
    buildProductChatNotifyUrl,
    notifyPurchaseChatStartedToSeller,
    notifyPurchaseChatStartedToBuyer,
    notifyPurchaseChatStartedAfterPayment,
    notifyJobChatOpenedToBoth,
    notifyPlatformChatMessage,
    notifyProductChatStartedToSeller,
    notifyProductChatStartedToBuyer,
    notifyProductChatStartedAfterPayment,
    notifyShopOrder,
    notifyShopProductPurchased,
    notifyShopInquiry,
    notifyAnpiRequest,
    notifyBuilderGuide,
    resolveBuilderMvpNotifyPayload,
    builderBoardThreadHref,
    builderMvpThreadHref,
    usesMvpPartnerThreadSurface,
    resolveBuilderThreadNotifyHref,
    builderBoardProjectHref,
    shouldNotifyAnpiLog,
    isJobListing,
    isShopListing,
    initEventBridges,
  };
})(typeof window !== "undefined" ? window : globalThis);
