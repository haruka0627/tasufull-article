/**
 * chat-dual-window-demo — 通知起点の実操作フロー（liveFlow=1）
 * 状態切替ではなく、ボタン操作 → 通知生成 → CTA → 次操作 を案内する。
 */
(function (global) {
  "use strict";

  const LIVE_FLOW_PARAM = "liveFlow";
  const LIVE_FLOW_RESET_PARAM = "liveFlowReset";
  const MARKER = "tasful_chat_live_flow_v1";
  const FANOUT_KEY = "tasful_talk_notify_fanout";

  const DETAIL_LISTING_BY_CATEGORY = Object.freeze({
    job: "job_demo_full_001",
    skill: "demo-skill-001",
    worker: "demo-worker-001",
    general: "demo-general-001",
    product: "demo-product-001",
    shop: "demo-shop-reworks",
    business: "demo-business-service-001",
    builder: "builder_demo_001",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readSearchParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch {
      return new URLSearchParams();
    }
  }

  function isChatDemoReviewFromUrl() {
    const review = readSearchParams().get("review");
    return review === "chat-demo" || review === "job-full";
  }

  function isLiveFlowMode() {
    return readSearchParams().get(LIVE_FLOW_PARAM) === "1" || isChatDemoReviewFromUrl();
  }

  function getListingIdsForProfile(profile) {
    const ids = new Set();
    if (!profile) return ids;
    const key = pickStr(profile.id, profile.categoryKey).replace(/-/g, "_");
    const detailId = DETAIL_LISTING_BY_CATEGORY[key] || DETAIL_LISTING_BY_CATEGORY.business;
    if (detailId) ids.add(detailId);
    if (profile.listingId) ids.add(profile.listingId);
    if (profile.dealId) ids.add(profile.dealId);
    return ids;
  }

  function threadMatchesProfile(thread, profile) {
    if (!thread || !profile) return false;
    const listingIds = getListingIdsForProfile(profile);
    const lid = pickStr(thread.listingId, thread.listing_id);
    if (!listingIds.has(lid)) return false;
    const seller = pickStr(thread.sellerId, thread.partnerUserId);
    const buyer = pickStr(thread.buyerId);
    const strictMatch =
      (seller === profile.partnerAId && buyer === profile.partnerBId) ||
      (seller === profile.partnerBId && buyer === profile.partnerAId);
    if (strictMatch) return true;
    if (profile.id !== "job" && profile.id !== "builder") {
      const purchaseProfiles = new Set([
        "skill",
        "worker",
        "general",
        "product",
        "shop",
        "business",
      ]);
      if (purchaseProfiles.has(profile.id)) {
        if (
          (profile.id === "shop" || profile.id === "business") &&
          profile.connect !== true
        ) {
          return false;
        }
        return true;
      }
    }
    return false;
  }

  function isVerifySeedNotification(row) {
    const id = pickStr(row?.id);
    if (!/^platform-verify-/i.test(id)) return false;
    const src = String(row?.source || "").trim();
    return src === "platform_chat_demo_v1" || src === "master" || !src;
  }

  function isRuntimeLiveFlowNotification(row) {
    if (isVerifySeedNotification(row)) return false;
    const src = String(row?.source || "").trim();
    if (!src || src === "platform_chat_demo_v1" || src === "master") return false;
    return true;
  }

  function notificationMatchesProfile(row, profile) {
    if (!row || !profile) return false;
    if (global.TasuPlatformChatDualWindowFlow?.isInitialDemoNotification?.(row, profile)) {
      return true;
    }
    if (isVerifySeedNotification(row)) return false;

    const listingIds = getListingIdsForProfile(profile);
    const threadId = pickStr(row.threadId, row.thread_id);
    if (threadId) {
      const store = global.TasuChatThreadStore;
      const thread = (store?.readAll?.() || []).find((t) => String(t.id) === threadId);
      if (thread) return threadMatchesProfile(thread, profile);
      const recipient = pickStr(row.recipientUserId);
      const listingIds = getListingIdsForProfile(profile);
      const lid = pickStr(row.listingId, row.listing_id);
      if (recipient && listingIds.has(lid) && isRuntimeLiveFlowNotification(row)) {
        return true;
      }
    }

    const lid = pickStr(row.listingId, row.listing_id);
    if (lid && listingIds.has(lid)) {
      return isRuntimeLiveFlowNotification(row);
    }

    const href = pickStr(row.href, row.targetUrl);
    if (href) {
      for (const id of listingIds) {
        if (href.includes(id) && isRuntimeLiveFlowNotification(row)) return true;
      }
    }

    if (profile.id === "worker" && String(row.type || "") === "worker") {
      for (const id of listingIds) {
        if (href.includes(id) && isRuntimeLiveFlowNotification(row)) return true;
      }
    }
    if (profile.id === "job" && String(row.type || "") === "job") {
      for (const id of listingIds) {
        if ((href.includes(id) || lid === id) && isRuntimeLiveFlowNotification(row)) return true;
      }
    }

    return false;
  }

  function appendLiveFlowParams(url, profile, extra) {
    const p = profile || global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    try {
      const u = new URL(String(url || ""), global.location?.href || "http://localhost/");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", "chat-demo");
      u.searchParams.set(LIVE_FLOW_PARAM, "1");
      if (p?.id) u.searchParams.set("demoProfile", p.id);
      if (p?.connect) {
        u.searchParams.set("demoConnect", "1");
        u.searchParams.set("platform_connect", p.platformConnect || "1");
      } else {
        u.searchParams.set("demoConnect", "0");
      }
      Object.entries(extra || {}).forEach(([k, v]) => {
        if (v != null && v !== "") u.searchParams.set(k, String(v));
      });
      if (!u.searchParams.get("paymentMethod")) {
        const parentMethod = pickStr(
          new URLSearchParams(global.location?.search || "").get("paymentMethod")
        );
        if (parentMethod) u.searchParams.set("paymentMethod", parentMethod);
      }
      return `${u.pathname}${u.search}${u.hash || ""}`;
    } catch {
      return String(url || "#");
    }
  }

  function detailPagePath(profile) {
    const route = global.TasuListingRouteResolver;
    const detailId =
      DETAIL_LISTING_BY_CATEGORY[pickStr(profile?.id)] ||
      pickStr(profile?.listingId) ||
      "demo-skill-001";
    const type = pickStr(profile?.listingType, profile?.categoryKey);
    return route?.buildDetailUrl?.(type, detailId) || `detail-skill.html?id=${encodeURIComponent(detailId)}`;
  }

  function notifyTabUrl(profile, userId) {
    return appendLiveFlowParams(
      global.TasuPlatformChatDualWindowDemo?.notifyUrl?.(profile.id, userId, {
        review: "chat-demo",
        connect: profile.connect,
      }) || "talk-home.html?tab=notify",
      profile,
      { userId }
    );
  }

  function detailUrl(profile, userId, extraParams) {
    const path = detailPagePath(profile);
    return appendLiveFlowParams(path, profile, { userId, ...(extraParams || {}) });
  }

  function managementPageUrl(profile, userId) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    if (Demo?.detailPageUrl) {
      return Demo.detailPageUrl(profile.id, userId, {
        review: "chat-demo",
        connect: profile.connect,
        benchManagement: true,
      });
    }
    return detailUrl(profile, userId, { view: "contacts", benchManagement: "1" });
  }

  function benchBuyerWaitingUrl(profile, userId) {
    const base = global.location?.href || "http://localhost/";
    const u = new URL("platform-chat-bench-buyer-wait.html", base);
    return appendLiveFlowParams(u.pathname + u.search, profile, { userId: pickStr(userId) });
  }

  function benchSellerIdleUrl(profile, userId) {
    const base = global.location?.href || "http://localhost/";
    const u = new URL("platform-chat-bench-seller-idle.html", base);
    return appendLiveFlowParams(u.pathname + u.search, profile, { userId: pickStr(userId) });
  }

  function benchBuyerDetailUrl(profile, userId) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    if (Demo?.detailPageUrl) {
      return Demo.detailPageUrl(profile.id, userId, {
        review: "chat-demo",
        connect: profile.connect,
      });
    }
    return detailUrl(profile, userId);
  }

  function hasBenchPurchased(profile) {
    return Boolean(readBenchPreStartRecord(profile));
  }

  function isMarketplaceConnectEntryProfile(profile) {
    return global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryProfile?.(profile) === true;
  }

  function hasBenchSellerPurchaseNotify(profile) {
    if (!profile?.partnerAId) return false;
    const sellerId = String(profile.partnerAId);
    const rows = global.TasuTalkNotifications?.getAll?.() || [];
    return rows.some((row) => {
      if (String(row.recipientUserId || row.recipient_user_id) !== sellerId) return false;
      const title = String(row.title || "");
      return /購入|スキルが購入|依頼が届き|購入者/.test(title);
    });
  }

  function shouldShowBenchSellerManagement(profile, options) {
    const opts = options || {};
    if (!profile?.connect) return false;
    if (opts.sellerManagementOpened === true) return true;
    if (!isMarketplaceConnectEntryProfile(profile)) return true;
    if (hasOpenBenchChat(profile)) return true;
    return hasBenchSellerPurchaseNotify(profile);
  }

  function shouldShowBenchBuyerWaiting(profile) {
    if (!profile || profile.connect === true) return false;
    return hasBenchPurchased(profile);
  }

  function buildBenchFeePayUrl(profile) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const base = global.location?.href || "http://localhost/";
    const u = new URL("platform-chat-fee-pay.html", base);
    const pre = readBenchPreStartRecord(profile);
    const key = pickStr(profile?.id);
    if (key === "job") {
      const appId = pickStr(pre?.application_id, Demo?.getDemoApplicationId?.(profile));
      if (appId) u.searchParams.set("applicationId", appId);
    } else {
      const contactId = pickStr(pre?.contact_id, Demo?.getDemoContactId?.(profile));
      if (contactId) u.searchParams.set("contactId", contactId);
    }
    u.searchParams.set("listingId", profile.listingId);
    u.searchParams.set("category", profile.categoryKey || profile.listingType);
    u.searchParams.set("from", "notify");
    return appendLiveFlowParams(u.pathname + u.search, profile, { userId: profile.partnerAId });
  }

  function readBenchPreStartRecord(profile) {
    if (!profile) return null;
    const key = pickStr(profile.id);
    const listingId = pickStr(profile.listingId);

    if (key === "job") {
      try {
        const raw = global.localStorage.getItem("tasful_job_applications_v1");
        const apps = raw ? JSON.parse(raw) : [];
        return (Array.isArray(apps) ? apps : []).find((a) => String(a.job_id) === listingId) || null;
      } catch {
        return null;
      }
    }

    const Contacts = global.TasuListingContactRequestsStore;
    if (Contacts?.listByListing) {
      const rows = Contacts.listByListing(listingId);
      return rows.find((r) => String(r.requester_id) === String(profile.partnerBId)) || rows[0] || null;
    }
    try {
      const raw = global.localStorage.getItem("tasful_listing_contact_requests_v1");
      const list = raw ? JSON.parse(raw) : [];
      return (
        (Array.isArray(list) ? list : []).find(
          (r) =>
            String(r.listing_id) === listingId && String(r.requester_id) === String(profile.partnerBId)
        ) || null
      );
    } catch {
      return null;
    }
  }

  function hasBenchPreStartSellerNotify(profile) {
    const notifyStore = global.TasuTalkNotifications;
    if (!profile || !notifyStore?.getAll) return false;
    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = pickStr(profile.categoryKey, profile.id);
    const copy = Category?.getContactNotifyCopy?.(cat) || {};
    const expectedTitle = pickStr(copy.title);
    const listingIds = getListingIdsForProfile(profile);
    return (notifyStore.getAll() || []).some((n) => {
      if (!isRuntimeLiveFlowNotification(n)) return false;
      if (pickStr(n.recipientUserId) !== pickStr(profile.partnerAId)) return false;
      const lid = pickStr(n.listingId, n.listing_id);
      if (lid && listingIds.has && !listingIds.has(lid)) return false;
      if (expectedTitle && !String(n.title || "").includes(expectedTitle)) return false;
      return true;
    });
  }

  function resolveBenchListingForProfile(profile) {
    const listingId = pickStr(profile?.listingId);
    const cat = pickStr(profile?.categoryKey, profile?.id);
    return (
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      global.TasuListingContactRequestsStore?.resolveListing?.(listingId) ||
      { id: listingId, listing_id: listingId, listing_type: cat }
    );
  }

  function createBenchPreStartSellerNotifyRow(profile, record) {
    const listing = resolveBenchListingForProfile(profile);
    const Fee = global.TasuPlatformChatFee;
    const Category = global.TasuPlatformChatCategoryFlow;
    const cat = pickStr(profile.categoryKey, profile.id);
    const contact = record || {};
    const contactCopy = Category?.getContactNotifyCopy?.(cat) || {};
    const listingTitle = pickStr(listing?.title, profile.listingTitle) || "出品";
    const buyerLabel = pickStr(contactCopy.buyerRole, "購入者");
    const buyerName = pickStr(contact.requester_name, contact.requester_id) || buyerLabel;
    const href = managementPageUrl(profile, profile.partnerAId);
    const payload = {
      type: Fee?.getNotifyType?.(listing) || cat,
      category: Fee?.getCategoryLabel?.(cat) || cat,
      title: pickStr(contactCopy.title, "依頼が届きました"),
      body: pickStr(
        contactCopy.body,
        `${pickStr(contactCopy.title, "通知が届きました")}。${pickStr(
          contactCopy.managementListLabel,
          "一覧"
        )}で内容を確認してください。`
      ),
      actionLabel: pickStr(contactCopy.cta, "確認する"),
      href,
      targetUrl: href,
      priority: "high",
      sendTalkMessage: true,
      officialRoomId: "official_tasful",
      minimalNotifyCard: true,
      source: "platform",
      recipientRole: "seller",
      recipientUserId: profile.partnerAId,
      listingId: pickStr(profile.listingId, listing?.id, listing?.listing_id),
      notifyListingTitle: listingTitle,
      notifySupplementLine: `${buyerLabel}：${buyerName}`,
    };

    const Notify = global.TasuTalkPlatformNotify;
    if (Notify?.notifyListingPurchased) {
      return Notify.notifyListingPurchased(
        { listing, contact },
        {
          type: payload.type,
          categoryLabel: payload.category,
          title: payload.title,
          body: payload.body,
        }
      );
    }

    const store = global.TasuTalkNotifications;
    if (!store?.add) return null;
    return store.add(payload);
  }

  /** 購入済みだが出品者通知が欠けている実画面状態を復元（worker-0 等） */
  const PURCHASE_DUAL_CHAT_STARTED_PROFILES = new Set([
    "skill",
    "product",
    "worker",
    "business",
    "shop",
    "general",
  ]);

  function notifyPurchaseChatStartedForBench(detail) {
    return global.TasuTalkPlatformNotify?.notifyPurchaseChatStartedAfterPayment?.(detail);
  }

  /** @deprecated */
  function notifyProductChatStartedForBench(detail) {
    return notifyPurchaseChatStartedForBench(detail);
  }

  function ensureBenchPreStartSellerNotify(profile, options) {
    const opts = options || {};
    if (!profile || profile.connect === true) return null;
    if (!hasBenchPurchased(profile)) return null;

    const record = readBenchPreStartRecord(profile);
    if (!record) return null;

    const listing = resolveBenchListingForProfile(profile);
    const Gate = global.TasuPlatformChatFeeGateFlow;

    if (hasBenchPreStartSellerNotify(profile)) {
      if (opts.refresh !== false) {
        Gate?.postBenchSellerNotifyRefresh?.(
          { recipientUserId: profile.partnerAId, recipientRole: "seller" },
          listing
        );
      }
      return { ok: true, existed: true, contact: record };
    }

    const row = createBenchPreStartSellerNotifyRow(profile, record);
    if (row && opts.refresh !== false) {
      Gate?.postBenchSellerNotifyRefresh?.(row, listing);
    }
    return row || { ok: true, created: true, contact: record };
  }

  function hasOpenBenchChat(profile) {
    const thread = readBenchThread(profile);
    if (!thread) return false;
    const Gate = global.TasuPlatformChatContactGate;
    if (Gate?.shouldBlockChatDetailAccess?.(thread)) return false;
    const rs = String(thread.roomStatus || thread.status || "").toLowerCase();
    if (profile?.connect === true) {
      return rs === "active" || rs === "open" || rs === "completion_pending" || rs === "completed";
    }
    const Fee = global.TasuPlatformChatFee;
    if (Fee?.isFeePaid && !Fee.isFeePaid(thread.id)) return false;
    return rs === "active" || rs === "open" || rs === "completion_pending" || rs === "completed";
  }

  function benchChatFrameUrl(profile, userId, options) {
    const opts = options || {};
    const uid = pickStr(userId);
    if (uid === profile.partnerAId && opts.sellerManagementOpened === true) {
      return managementPageUrl(profile, uid);
    }
    if (hasOpenBenchChat(profile)) {
      return chatUrl(profile, uid, opts);
    }
    if (uid === profile.partnerAId) {
      if (shouldShowBenchSellerManagement(profile, opts)) {
        return managementPageUrl(profile, uid);
      }
      return benchSellerIdleUrl(profile, uid);
    }
    if (profile?.connect !== true) {
      return shouldShowBenchBuyerWaiting(profile)
        ? benchBuyerWaitingUrl(profile, uid)
        : benchBuyerDetailUrl(profile, uid);
    }
    if (isMarketplaceConnectEntryProfile(profile) && !shouldShowBenchBuyerWaiting(profile)) {
      return benchBuyerDetailUrl(profile, uid);
    }
    return benchBuyerWaitingUrl(profile, uid);
  }

  function resolveChatThreadContext(profile, userId, options) {
    const opts = options || {};
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const store = global.TasuChatThreadStore;
    const threadId = pickStr(opts.threadId, Demo?.resolveActiveThreadIdForProfile?.(profile));
    if (!threadId) return { threadId: "", listingId: "", applicationId: "" };

    const threadRow =
      (store?.readAll?.() || []).find((row) => String(row.id) === threadId) || null;
    let listingId = pickStr(opts.listingId, threadRow?.listingId, profile?.listingId);
    let applicationId = pickStr(opts.applicationId, threadRow?.applicationId);

    if (!applicationId) {
      const apps = global.TasuJobApplicationsStore?.readAll?.() || [];
      const byThread = apps.find((a) => pickStr(a.thread_id) === threadId);
      applicationId = pickStr(byThread?.application_id);
      if (!applicationId && listingId) {
        const selected = apps.find(
          (a) => String(a.job_id) === listingId && String(a.status) === "selected"
        );
        applicationId = pickStr(selected?.application_id);
      }
      if (!applicationId && profile?.id === "job") {
        const pre = readBenchPreStartRecord(profile);
        applicationId = pickStr(pre?.application_id, Demo?.getDemoApplicationId?.(profile));
      }
    }
    if (!listingId && profile?.id === "job") {
      listingId = pickStr(DETAIL_LISTING_BY_CATEGORY.job, profile?.listingId);
    }
    return { threadId, listingId, applicationId };
  }

  function chatUrl(profile, userId, options) {
    const opts = options || {};
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const uid = pickStr(userId);
    const ctx = resolveChatThreadContext(profile, uid, opts);
    const threadId = ctx.threadId;
    if (!threadId && profile?.connect !== true) {
      if (uid === profile.partnerAId) {
        return opts.sellerManagementOpened === true
          ? managementPageUrl(profile, uid)
          : benchSellerIdleUrl(profile, uid);
      }
      return shouldShowBenchBuyerWaiting(profile)
        ? benchBuyerWaitingUrl(profile, uid)
        : benchBuyerDetailUrl(profile, uid);
    }
    const path =
      Demo?.chatUrl?.(profile.id, uid, {
        review: "chat-demo",
        connect: profile.connect,
        from: pickStr(opts.from, "talk"),
        threadId: threadId || undefined,
        listingId: ctx.listingId || undefined,
        applicationId: ctx.applicationId || undefined,
      }) || `chat-detail.html?thread=${encodeURIComponent(threadId || profile.threadId || "")}`;
    return appendLiveFlowParams(path, profile, { userId: uid });
  }

  function resolveStepSide(profile, userId) {
    return pickStr(userId) === profile.partnerAId ? "A" : "B";
  }

  function actNotify(profile, userId, label) {
    const side = resolveStepSide(profile, userId);
    return {
      label: pickStr(label) || `${side}: 通知を開く`,
      href: notifyTabUrl(profile, userId),
      side,
    };
  }

  function actChat(profile, userId, label) {
    const side = resolveStepSide(profile, userId);
    return {
      label: pickStr(label) || `${side}: チャットを開く`,
      href: chatUrl(profile, userId),
      side,
    };
  }

  function actOpen(profile, userId, href, label) {
    return {
      label: pickStr(label) || "開く",
      href: pickStr(href) || "#",
      side: resolveStepSide(profile, userId),
    };
  }

  function enrichLiveFlowSteps(steps, profile) {
    const A = profile.partnerAId;
    const B = profile.partnerBId;
    const completeUid = profile.requesterSide === "B" ? B : A;
    const approveUid = profile.requesterSide === "B" ? A : B;
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(
      global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile)
    ) || {};

    return (steps || []).map((step) => {
      if (step.actions?.length) return step;
      if (step.kind === "reset") {
        return {
          ...step,
          actions: [{ label: "このカテゴリをリセット", kind: "reset-category" }],
        };
      }

      const id = pickStr(step.id);
      let actions = [];

      if (id === "apply" || id === "request" || id === "contact" || id === "deal-open") {
        const uid = step.actor === "B" ? B : A;
        actions = [actOpen(profile, uid, step.href, step.button || "詳細を開く")];
      } else if (id === "start-notify" || id === "apply-notify") {
        const uid = step.actor === "B" ? B : A;
        const waitSide = uid === A ? "B" : "A";
        const waitUid = uid === A ? B : A;
        actions = [
          actNotify(profile, uid, "通知を開く"),
          actNotify(profile, waitUid, `${waitSide}: 通知タブ（相手待機）`),
        ];
      } else if (id === "fee" || id === "hire-fee" || id === "accept") {
        const uid = step.actor === "A" ? A : step.actor === "B" ? B : A;
        if (step.href && step.button) {
          actions = [actOpen(profile, uid, step.href, step.button)];
        } else {
          actions = [
            actOpen(profile, uid, buildBenchFeePayUrl(profile), "550円を支払う（デモ）"),
          ];
        }
      } else if (id === "contact-gate") {
        const uid = step.actor === "A" ? A : step.actor === "B" ? B : A;
        actions = [
          actOpen(
            profile,
            uid,
            step.href || managementPageUrl(profile, uid),
            step.button || "管理ページを開く"
          ),
        ];
      } else if (id === "chat-started") {
        const uid = step.actor === "B" ? B : A;
        actions = [
          actNotify(profile, uid, "通知を開く"),
          actChat(profile, uid, "チャットを開く"),
        ];
      } else if (id === "manual-pay" || id === "connect-pay") {
        actions = [actChat(profile, approveUid, step.button || "チャットを開く")];
      } else if (id === "manual-confirm") {
        actions = [
          actNotify(profile, completeUid, "通知を開く"),
          actChat(profile, completeUid, "入金確認"),
        ];
      } else if (id === "connect-pay-notify") {
        actions = [
          actNotify(profile, completeUid, "通知を開く"),
          actChat(profile, completeUid, "チャットを開く"),
        ];
      } else if (id === "chat-b" || id === "fee-b" || id === "approve" || id === "msg-b") {
        const uid =
          step.actor === "A" ? A : step.actor === "B" ? B : step.actor?.includes("B") ? B : approveUid;
        actions = [
          actNotify(profile, uid, "通知を開く"),
          actChat(profile, uid, step.button ? `チャットを開く（${step.button}）` : "チャットを開く"),
        ];
      } else if (id === "msg-a" || id === "chat-a") {
        actions = [actChat(profile, A, "チャットを開く")];
      } else if (id === "chat-start" || id === "chat-active") {
        actions = [
          actNotify(profile, A, "A: 通知を開く"),
          actNotify(profile, B, "B: 通知を開く"),
        ];
      } else if (id === "complete-request") {
        actions = [
          actChat(
            profile,
            completeUid,
            `チャットを開く（${step.button || labels.completeBtn || "完了申請"}）`
          ),
        ];
      } else if (id === "review") {
        actions = [
          actChat(profile, A, "A: チャットを開く（評価）"),
          actChat(profile, B, "B: チャットを開く（評価）"),
        ];
      } else if (id === "cancel-branch") {
        actions = [
          actChat(profile, A, "A: チャットを開く"),
          actChat(profile, B, "B: チャットを開く"),
        ];
      } else if (step.href) {
        const uid = step.actor === "B" ? B : A;
        actions = [actOpen(profile, uid, step.href, step.button || "開く")];
      }

      return { ...step, actions };
    });
  }

  function feePayHint(profile) {
    return "手数料支払い画面で「支払う（デモ）」を押す";
  }

  function getFirstNotifyByCategory(categoryKey) {
    const Category = global.TasuPlatformChatCategoryFlow;
    const copy = Category?.getContactNotifyCopy?.(categoryKey) || {};
    return {
      audience: "A",
      title: pickStr(copy.title, "通知が届きました"),
      cta: pickStr(copy.cta, "確認する"),
    };
  }

  const CHAT_STARTED_NOTIFY = Object.freeze({
    audience: "A",
    title: "やりとりが開始されました",
    cta: "チャットを開く",
  });

  function buildPlainFeeGateSteps(profile, categoryKey) {
    const A = profile.partnerAId;
    const B = profile.partnerBId;
    const key = pickStr(categoryKey, profile.id);
    const Category = global.TasuPlatformChatCategoryFlow;
    const firstNotify = getFirstNotifyByCategory(key);
    const contactCopy = Category?.getContactNotifyCopy?.(key) || {};
    const chatStartedCopy = Category?.getChatStartedNotifyCopy?.(key) || {};
    const completeSide = profile.requesterSide === "B" ? "B" : "A";
    const approveSide = profile.requesterSide === "B" ? "A" : "B";
    const labels = Category?.getLabels?.(
      global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile)
    ) || {};
    const completeBtn = labels.completeBtn || "完了";
    const approveBtn = labels.approveBtn || "承認する";
    const feeSide = A;
    const feeActor = "A";
    const feeAction =
      key === "job"
        ? "応募者カードの「チャットに進む」→ 手数料支払い画面 → 支払う（デモ）"
        : "対象者カードの「チャットに進む」→ 550円支払い（出品者/掲載者側）→ スレッド生成・チャット解放";

    const mgmtUrl = managementPageUrl(profile, A);
    const mgmtView = pickStr(contactCopy.managementView, "contacts");
    const mgmtLabel =
      pickStr(contactCopy.managementListLabel) ||
      (mgmtView === "applications" ? "応募者一覧" : mgmtView === "requests" ? "依頼者一覧" : "購入者/依頼者一覧");

    const steps = [
      { id: "reset", label: "0. フローをリセット", actor: "—", action: "下の「フローをリセット」を実行", kind: "reset" },
      {
        id: "start-notify",
        label: "1. スタート通知",
        actor: "A",
        action: `「${firstNotify.title}」→ ${firstNotify.cta} → 管理ページ（スレッド未作成）`,
        href: notifyTabUrl(profile, A),
        expectNotify: firstNotify,
      },
      {
        id: "contact-gate",
        label: `2. ${mgmtLabel}`,
        actor: "A",
        action:
          key === "job"
            ? "応募者カードで「チャットに進む」または「断る」（チャットはまだ開かない）"
            : "対象者カードで「チャットに進む」または「断る」（チャットはまだ開かない）",
        href: mgmtUrl,
        button: "チャットに進む",
      },
      {
        id: "fee",
        label: key === "job" ? "3. やりとり開始（550円）" : "3. やりとり開始料550円",
        actor: feeActor,
        action: feeAction,
        href: buildBenchFeePayUrl(profile),
        button: "支払いを完了する（550円）",
      },
      {
        id: "chat-started",
        label: "4. やりとり開始通知",
        actor: PURCHASE_DUAL_CHAT_STARTED_PROFILES.has(key) ? "A / B" : "B",
        action:
          key === "job"
            ? "通知「掲載者とのやりとりが開始されました」→ CTA「チャットを開く」"
            : PURCHASE_DUAL_CHAT_STARTED_PROFILES.has(key)
              ? "出品者・購入者/依頼者双方へ「やりとりが開始されました」→「チャットを開く」"
              : "購入者/依頼者へ「やりとりが開始されました」通知 → チャットで返信可能",
        href: notifyTabUrl(profile, B),
        expectNotify:
          key === "job"
            ? { audience: "B", title: "応募が承諾されました", cta: "やり取りチャットを開く" }
            : {
                audience: "B",
                title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
                cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
              },
        expectNotifyA: PURCHASE_DUAL_CHAT_STARTED_PROFILES.has(key)
          ? {
              audience: "A",
              title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
              cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
            }
          : null,
      },
      {
        id: "msg-a",
        label: "5. パートナーAがメッセージ送信",
        actor: "A",
        action: "チャットでメッセージを送信 → 相手へ新着通知",
        href: notifyTabUrl(profile, A),
      },
      {
        id: "msg-b",
        label: "5. パートナーBが返信",
        actor: "B",
        action: "通知「新しいメッセージ」→ チャットで返信 → 相手へ新着通知",
        href: notifyTabUrl(profile, B),
      },
      {
        id: "complete-request",
        label: `6. ${completeBtn}を申請`,
        actor: completeSide,
        action: `チャット下部「${completeBtn}」→「申請する」→ 相手へ申請通知`,
        button: completeBtn,
      },
      {
        id: "approve",
        label: `7. ${approveBtn}`,
        actor: approveSide,
        action: `通知 → チャットで「${approveBtn}」→ 銀行振込案内カード表示`,
        href: notifyTabUrl(profile, approveSide === "A" ? A : B),
        button: approveBtn,
      },
      {
        id: "manual-pay",
        label: "8. 銀行振込（支払い側）",
        actor: approveSide,
        action: "銀行振込案内カード →「支払いました」→ 相手へ支払い報告通知",
        href: notifyTabUrl(profile, approveSide === "A" ? A : B),
      },
      {
        id: "manual-confirm",
        label: "9. 入金確認（受取側）",
        actor: completeSide,
        action: "「入金確認しました」→ 相手へ入金確認通知 → 評価導線表示",
        href: notifyTabUrl(profile, completeSide === "A" ? A : B),
      },
      {
        id: "review",
        label: "10. 評価する",
        actor: "A / B",
        action: "入金確認後の評価カードから送信（双方）→ 相手へ評価通知",
        button: labels.reviewPromptBtn || "評価する",
      },
      {
        id: "cancel-branch",
        label: "（別ルート）キャンセル",
        actor: "A / B",
        action: "チャット開始後、下部メニュー「キャンセル」→ 理由選択 → 相手へキャンセル通知",
        button: "キャンセル",
      },
    ];

    if (Category?.skipsPostChatCompletionFlow?.(key) === true) {
      const skipIds = new Set(Category.POST_CHAT_COMPLETION_STEP_IDS || []);
      return steps.filter((step) => !skipIds.has(step.id));
    }
    return steps;
  }

  function shopProductDetailBenchUrl(profile, userId) {
    const listingId = pickStr(profile?.listingId, DETAIL_LISTING_BY_CATEGORY.shop);
    try {
      const u = new URL("detail-shop-product.html", global.location?.href || "http://localhost/");
      u.searchParams.set("shopId", listingId);
      u.searchParams.set("productId", "0");
      if (profile?.connect === true) u.searchParams.set("demoConnect", "1");
      const uid = pickStr(userId, profile?.partnerBId);
      if (uid) u.searchParams.set("userId", uid);
      u.searchParams.set("talkDev", "1");
      if (readSearchParams().get("benchEmbed") === "1") u.searchParams.set("benchEmbed", "1");
      return u.pathname + u.search;
    } catch {
      return `detail-shop-product.html?shopId=${encodeURIComponent(listingId)}&productId=0&demoConnect=1`;
    }
  }

  function buildShopConnectPurchaseSteps(profile, categoryKey) {
    const A = profile.partnerAId;
    const B = profile.partnerBId;
    const key = pickStr(categoryKey, profile.id);
    const Category = global.TasuPlatformChatCategoryFlow;
    const firstNotify = getFirstNotifyByCategory(key);
    const contactCopy = Category?.getContactNotifyCopy?.(key) || {};
    const chatStartedCopy = Category?.getChatStartedNotifyCopy?.(key) || {};
    const labels = Category?.getLabels?.(
      global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile)
    ) || {};
    const mgmtUrl = managementPageUrl(profile, A);
    const productUrl = shopProductDetailBenchUrl(profile, B);

    return [
      { id: "reset", label: "0. フローをリセット", actor: "—", action: "下の「フローをリセット」を実行", kind: "reset" },
      {
        id: "shop-purchase",
        label: "1. 店舗商品を購入",
        actor: "B",
        action: "店舗商品詳細の「購入する」→ 決済完了（Connect）",
        href: productUrl,
        button: "購入する",
      },
      {
        id: "start-notify",
        label: "2. 購入通知（A）",
        actor: "A",
        action: `「${firstNotify.title}」→ ${firstNotify.cta} → 購入者一覧`,
        href: notifyTabUrl(profile, A),
        expectNotify: firstNotify,
      },
      {
        id: "contact-gate",
        label: "3. 購入を確認",
        actor: "A",
        action: "購入者カードの「チャットに進む」→ 商品系チャット開始",
        href: mgmtUrl,
        button: "チャットに進む",
      },
      {
        id: "chat-started",
        label: "4. やりとり開始通知",
        actor: "A / B",
        action: "双方へ「やりとりが開始されました」→「チャットを開く」",
        href: notifyTabUrl(profile, B),
        expectNotify: {
          audience: "B",
          title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
          cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
        },
        expectNotifyA: {
          audience: "A",
          title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
          cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
        },
      },
      {
        id: "product-ship",
        label: "5. 商品発送",
        actor: "A",
        action: "出品者が「商品を発送しました」→ 購入者へ通知",
        button: labels.sellerCompleteBtn || "商品を発送しました",
      },
      {
        id: "product-receive",
        label: "6. 商品受取",
        actor: "B",
        action: "購入者が「商品を受け取りました」→ 取引完了",
        button: labels.receiveBtn || "商品を受け取りました",
      },
      {
        id: "completion-fee",
        label: "7. 取引完了手数料（A）",
        actor: "A",
        action: "取引完了手数料の支払い通知 → 手数料支払い画面",
        href: notifyTabUrl(profile, A),
      },
      {
        id: "review",
        label: "8. レビュー",
        actor: "A / B",
        action: "手数料支払い後のレビュー通知 → レビュー画面",
        button: labels.reviewPromptBtn || "レビューする",
      },
      {
        id: "cancel-branch",
        label: "（別ルート）キャンセル",
        actor: "A / B",
        action: "チャット開始後、下部メニュー「キャンセル」→ 理由選択 → 相手へキャンセル通知",
        button: "キャンセル",
      },
    ];
  }

  function buildConnectPaymentSteps(profile, categoryKey) {
    const A = profile.partnerAId;
    const B = profile.partnerBId;
    const key = pickStr(categoryKey, profile.id);
    const firstNotify = getFirstNotifyByCategory(key);
    const completeSide = profile.requesterSide === "B" ? "B" : "A";
    const approveSide = profile.requesterSide === "B" ? "A" : "B";
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(
      global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile)
    ) || {};

    return [
      { id: "reset", label: "0. フローをリセット", actor: "—", action: "下の「フローをリセット」を実行", kind: "reset" },
      {
        id: "start-notify",
        label: "1. スタート通知",
        actor: "A",
        action: `「${firstNotify.title}」→ チャット開始（Connectは開始前手数料なし）`,
        href: notifyTabUrl(profile, A),
        expectNotify: firstNotify,
      },
      {
        id: "chat-active",
        label: "2. 双方でチャット確認",
        actor: "A / B",
        action: "双方がチャットでやりとり",
        href: notifyTabUrl(profile, B),
      },
      {
        id: "complete-request",
        label: `3. ${labels.completeBtn || "完了"}を申請`,
        actor: completeSide,
        action: `「${labels.completeBtn || "完了"}」→ 申請する → 相手へ通知`,
        button: labels.completeBtn || "完了",
      },
      {
        id: "approve",
        label: `4. ${labels.approveBtn || "承認する"}`,
        actor: approveSide,
        action: "承認 → Connect支払いカード表示（銀行振込フローは出ない）",
        href: notifyTabUrl(profile, approveSide === "A" ? A : B),
        button: labels.approveBtn || "承認する",
      },
      {
        id: "connect-pay",
        label: "5. Connect支払い",
        actor: approveSide,
        action: "「TASFUL決済でお支払い」カード →「支払いを完了する」",
        href: notifyTabUrl(profile, approveSide === "A" ? A : B),
      },
      {
        id: "connect-pay-notify",
        label: "6. 支払い完了通知",
        actor: completeSide,
        action: "「支払いが完了しました」通知 → 評価導線表示",
        href: notifyTabUrl(profile, completeSide === "A" ? A : B),
        expectNotify: { audience: "A", title: "支払いが完了しました", cta: "確認する" },
      },
      {
        id: "review",
        label: "7. 評価する",
        actor: "A / B",
        action: "Connect支払い完了後の評価カード → 相手へ評価通知",
        button: labels.reviewPromptBtn || "評価する",
      },
      {
        id: "cancel-branch",
        label: "（別ルート）キャンセル→返金",
        actor: "A / B",
        action: "キャンセル →「返金が処理されました」通知",
        button: "キャンセル",
      },
    ];
  }

  function buildPlainSteps(profile) {
    return buildPlainFeeGateSteps(profile, profile.id);
  }

  function buildConnectSteps(profile) {
    return buildConnectPaymentSteps(profile, profile.id);
  }

  function buildConnectEntrySteps(profile, categoryKey) {
    const A = profile.partnerAId;
    const B = profile.partnerBId;
    const key = pickStr(categoryKey, profile.id);
    const Category = global.TasuPlatformChatCategoryFlow;
    const firstNotify = getFirstNotifyByCategory(key);
    const chatStartedCopy = Category?.getChatStartedNotifyCopy?.(key) || {};
    const completeSide = profile.requesterSide === "B" ? "B" : "A";
    const approveSide = profile.requesterSide === "B" ? "A" : "B";
    const labels = Category?.getLabels?.(
      global.TasuPlatformChatDualWindowDemo?.buildThreadStub?.(profile)
    ) || {};
    const completeBtn = labels.completeBtn || "完了";
    const approveBtn = labels.approveBtn || "承認する";
    const detailUrl = global.TasuPlatformChatDualWindowDemo?.buildArticleDetailUrl?.(profile, B, {
      benchEmbed: "1",
    });

    const steps = [
      { id: "reset", label: "0. フローをリセット", actor: "—", action: "下の「フローをリセット」を実行", kind: "reset" },
      {
        id: "start-notify",
        label: "1. スタート通知",
        actor: "A",
        action: `「${firstNotify.title}」→ ${firstNotify.cta}`,
        href: notifyTabUrl(profile, A),
        expectNotify: firstNotify,
      },
      {
        id: "detail-purchase",
        label: "2. 詳細で購入/依頼",
        actor: "B",
        action: "詳細ページの購入/依頼ボタン → Connect入口決済へ",
        href: detailUrl,
        button: key === "worker" ? "依頼する" : "購入する",
      },
      {
        id: "connect-entry-pay",
        label: "3. Connect入口決済",
        actor: "B",
        action: "商品/サービス代金を決済（デモ）→ チャット開通",
        href: detailUrl,
        button: "決済を完了する",
      },
      {
        id: "chat-started",
        label: "4. やりとり開始通知",
        actor: PURCHASE_DUAL_CHAT_STARTED_PROFILES.has(key) ? "A / B" : "B",
        action: "双方へ「やりとりが開始されました」→「チャットを開く」",
        href: notifyTabUrl(profile, B),
        expectNotify: {
          audience: "B",
          title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
          cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
        },
        expectNotifyA: PURCHASE_DUAL_CHAT_STARTED_PROFILES.has(key)
          ? {
              audience: "A",
              title: pickStr(chatStartedCopy.title, "やりとりが開始されました"),
              cta: pickStr(chatStartedCopy.cta, "チャットを開く"),
            }
          : null,
      },
      {
        id: "msg-a",
        label: "5. パートナーAがメッセージ送信",
        actor: "A",
        action: "チャットでメッセージを送信 → 相手へ新着通知",
        href: notifyTabUrl(profile, A),
      },
      {
        id: "msg-b",
        label: "5. パートナーBが返信",
        actor: "B",
        action: "通知「新しいメッセージ」→ チャットで返信 → 相手へ新着通知",
        href: notifyTabUrl(profile, B),
      },
      {
        id: "complete-request",
        label: `6. ${completeBtn}を申請`,
        actor: completeSide,
        action: `チャット下部「${completeBtn}」→「申請する」→ 相手へ申請通知`,
        button: completeBtn,
      },
      {
        id: "approve",
        label: `7. ${approveBtn}`,
        actor: approveSide,
        action: `通知 → チャットで「${approveBtn}」→ 取引完了`,
        href: notifyTabUrl(profile, approveSide === "A" ? A : B),
        button: approveBtn,
      },
      {
        id: "review",
        label: "8. 評価する",
        actor: "A / B",
        action: "完了後の評価カードから送信（双方）→ 相手へ評価通知",
        button: labels.reviewPromptBtn || "評価する",
      },
      {
        id: "cancel-branch",
        label: "（別ルート）キャンセル",
        actor: "A / B",
        action: "チャット開始後、下部メニュー「キャンセル」→ 理由選択 → 相手へキャンセル通知",
        button: "キャンセル",
      },
    ];

    if (Category?.isProductFlowCategory?.(key) === true) {
      const tailStart = steps.findIndex((s) => s.id === "complete-request");
      const head = steps.slice(0, tailStart >= 0 ? tailStart : steps.length);
      const productTail = [
        {
          id: "product-ship",
          label: "6. 発送完了",
          actor: "A",
          action: "出品者が「商品を発送しました」→ 購入者へ通知",
          button: labels.sellerCompleteBtn || "商品を発送しました",
        },
        {
          id: "product-receive",
          label: "7. 受取確認",
          actor: "B",
          action: "購入者が「商品を受け取りました」→ 取引完了",
          button: labels.receiveBtn || "商品を受け取りました",
        },
        {
          id: "review",
          label: "8. 評価する",
          actor: "A / B",
          action: "受取後の評価カードから送信（双方）",
          button: labels.reviewPromptBtn || "評価する",
        },
        steps.find((s) => s.id === "cancel-branch"),
      ].filter(Boolean);
      return head.concat(productTail);
    }

    if (Category?.skipsPostChatCompletionFlow?.(key) === true) {
      const skipIds = new Set(Category.POST_CHAT_COMPLETION_STEP_IDS || []);
      return steps.filter((step) => !skipIds.has(step.id));
    }
    return steps;
  }

  function buildLiveFlowSteps(profile) {
    if (!profile) return [];
    const Category = global.TasuPlatformChatCategoryFlow;
    const key = pickStr(profile.categoryKey, profile.id);
    let base;
    if (profile.connect && Category?.isShopStoreCategory?.(key)) {
      base = buildShopConnectPurchaseSteps(profile, key);
    } else if (profile.connect && Category?.isMarketplaceConnectCategory?.(key)) {
      base = buildConnectEntrySteps(profile, key);
    } else if (profile.connect) {
      base = buildConnectSteps(profile);
    } else {
      base = buildPlainSteps(profile);
    }
    return enrichLiveFlowSteps(base, profile);
  }

  function buildLauncherPinActions(profile) {
    if (!profile) return [];
    return [
      actNotify(profile, profile.partnerAId, "A: 通知タブ"),
      actNotify(profile, profile.partnerBId, "B: 通知タブ"),
    ];
  }

  const TEST_BENCH_CHECK_BASE = Object.freeze([
    { id: "notify", label: "通知発生" },
    { id: "cta", label: "CTA" },
    { id: "nav", label: "遷移" },
    { id: "message", label: "チャット送信" },
    { id: "complete-request", label: "完了申請" },
    { id: "approve", label: "承認" },
    { id: "cancel", label: "キャンセル" },
    { id: "review", label: "評価" },
  ]);

  const TEST_BENCH_CHECK_CONNECT = Object.freeze([
    { id: "connect-pay", label: "Connect支払い" },
    { id: "connect-refund", label: "Connect返金" },
  ]);

  function buildTestBenchChecks(profile) {
    const rows = [...TEST_BENCH_CHECK_BASE];
    if (profile?.connect) rows.push(...TEST_BENCH_CHECK_CONNECT);
    return rows;
  }

  const MANUAL_BENCH_PATTERNS = Object.freeze([
    { id: "job-0", categoryId: "job", connect: false, label: "求人", order: 1 },
    { id: "skill-0", categoryId: "skill", connect: false, label: "スキル / Connectなし", order: 2 },
    { id: "skill-1", categoryId: "skill", connect: true, label: "スキル / Connectあり", order: 3 },
    { id: "worker-0", categoryId: "worker", connect: false, label: "ワーカー / Connectなし", order: 4 },
    { id: "worker-1", categoryId: "worker", connect: true, label: "ワーカー / Connectあり", order: 5 },
    { id: "product-0", categoryId: "product", connect: false, label: "商品 / Connectなし", order: 6 },
    { id: "product-1", categoryId: "product", connect: true, label: "商品 / Connectあり", order: 7 },
    { id: "shop-0", categoryId: "shop", connect: false, label: "店舗・販売 / Connectなし", order: 8 },
    { id: "shop-1", categoryId: "shop", connect: true, label: "店舗・販売 / Connectあり", order: 9 },
    { id: "business-0", categoryId: "business", connect: false, label: "業務サービス / Connectなし", order: 10 },
    { id: "business-1", categoryId: "business", connect: true, label: "業務サービス / Connectあり", order: 11 },
    { id: "general-0", categoryId: "general", connect: false, label: "一般案件 / Connectなし", order: 12 },
    { id: "general-1", categoryId: "general", connect: true, label: "一般案件 / Connectあり", order: 13 },
    { id: "builder-0", categoryId: "builder", connect: false, label: "Builder / Connectなし", order: 14 },
    { id: "builder-1", categoryId: "builder", connect: true, label: "Builder / Connectあり", order: 15 },
  ]);

  function getManualBenchPatterns() {
    return MANUAL_BENCH_PATTERNS;
  }

  function resolveManualBenchPattern(patternId, categoryId, connect) {
    const id = pickStr(patternId);
    if (id === "job-1") {
      return MANUAL_BENCH_PATTERNS.find((p) => p.id === "job-0") || MANUAL_BENCH_PATTERNS[0];
    }
    if (id) {
      const row = MANUAL_BENCH_PATTERNS.find((p) => p.id === id);
      if (row) {
        if (row.categoryId === "job") {
          return MANUAL_BENCH_PATTERNS.find((p) => p.id === "job-0") || row;
        }
        return row;
      }
    }
    const cat = pickStr(categoryId, "job");
    if (cat === "job") {
      return MANUAL_BENCH_PATTERNS.find((p) => p.id === "job-0") || MANUAL_BENCH_PATTERNS[0];
    }
    const conn = connect === true;
    return (
      MANUAL_BENCH_PATTERNS.find((p) => p.categoryId === cat && p.connect === conn) ||
      MANUAL_BENCH_PATTERNS[0]
    );
  }

  function getRunnableBenchSteps(profile) {
    return buildLiveFlowSteps(profile).filter((s) => s.kind !== "reset" && s.id !== "cancel-branch");
  }

  function readBenchThread(profile) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !profile) return null;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const pre = readBenchPreStartRecord(profile);
    const tid =
      Demo?.resolveActiveThreadIdForProfile?.(profile) ||
      pickStr(pre?.thread_id, profile?.threadId);
    if (!tid) return null;
    return (store.readAll() || []).find((t) => String(t.id) === tid) || null;
  }

  function readBenchMessageCount(threadId) {
    const id = pickStr(threadId);
    if (!id) return 0;
    const store = global.TasuChatThreadStore;
    if (store?.getMessages) {
      return (store.getMessages(id) || []).filter((m) => {
        const sid = pickStr(m.senderId);
        const text = pickStr(m.text);
        return sid && sid !== "__system__" && text;
      }).length;
    }
    try {
      const key = store?.MESSAGES_KEY || "tasful_chat_messages";
      const raw = global.localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      return list.filter((m) => {
        const sid = pickStr(m.senderId);
        const text = pickStr(m.text);
        return sid && sid !== "__system__" && text;
      }).length;
    } catch {
      return 0;
    }
  }

  function hasBenchReviewNotification(profile) {
    const all = global.TasuTalkNotifications?.getAll?.() || [];
    return all.some((n) => {
      if (!notificationMatchesProfile(n, profile)) return false;
      return String(n.source || "") === "platform_chat_review_v1";
    });
  }

  function benchStepById(steps, stepId) {
    const index = steps.findIndex((s) => s.id === stepId);
    return { index: index < 0 ? 0 : index, step: index < 0 ? steps[0] : steps[index] };
  }

  function buildBenchStepResult(steps, stepId, done) {
    const { index, step } = benchStepById(steps, stepId);
    const doneThrough = done === true ? steps.length - 1 : Math.max(-1, index - 1);
    return {
      index,
      doneThrough,
      total: steps.length,
      step,
      steps,
      done: done === true,
      stepId: done ? "done" : stepId,
    };
  }

  function benchStepIndex(steps, stepId) {
    const index = steps.findIndex((s) => s.id === stepId);
    return index < 0 ? -1 : index;
  }

  /** storage / 通知 / 応募状態からマイルストーン完了を補正（上部ステップタグ用） */
  function detectBenchMilestoneDoneThrough(profile, steps) {
    if (!profile || !steps?.length) return -1;
    let doneThrough = -1;
    const bump = (stepId) => {
      const idx = benchStepIndex(steps, stepId);
      if (idx >= 0) doneThrough = Math.max(doneThrough, idx);
    };

    if (profile.connect === true) return doneThrough;

    const key = pickStr(profile.id, profile.categoryKey);
    if (key === "job") {
      if (hasBenchPreStartSellerNotify(profile)) bump("start-notify");
      const pre = readBenchPreStartRecord(profile);
      const st = pickStr(pre?.status);
      if (st === "awaiting_fee" || st === "hired" || pickStr(pre?.thread_id)) {
        bump("contact-gate");
      }
      const Fee = global.TasuPlatformChatFee;
      const thread = readBenchThread(profile);
      const tid = pickStr(thread?.id);
      const rs = String(thread?.roomStatus || thread?.status || "").toLowerCase();
      const feePaid =
        (tid && Fee?.isFeePaid?.(tid)) ||
        Fee?.isFeePaidForContext?.({
          applicationId: pickStr(pre?.application_id),
          listingId: profile.listingId,
        });
      if (feePaid || st === "hired" || (thread && (rs === "open" || rs === "active"))) {
        bump("fee");
      }
      const all = global.TasuTalkNotifications?.getAll?.() || [];
      const hiredNotify = all.some(
        (n) =>
          String(n.recipientUserId) === String(profile.partnerBId) &&
          /承諾/.test(String(n.title || ""))
      );
      if (hiredNotify) bump("chat-started");
      const msgCount = readBenchMessageCount(tid);
      if (msgCount >= 1) bump("msg-a");
      if (msgCount >= 2) bump("msg-b");
      return doneThrough;
    }

    if (hasBenchPreStartSellerNotify(profile)) bump("start-notify");
    const pre = readBenchPreStartRecord(profile);
    if (pre && pickStr(pre.status) === "awaiting_fee") bump("contact-gate");
    const thread = readBenchThread(profile);
    const Fee = global.TasuPlatformChatFee;
    if (thread && Fee?.isFeePaid?.(thread.id)) bump("fee");
    const all = global.TasuTalkNotifications?.getAll?.() || [];
    const chatStartedFor = (uid) =>
      all.some(
        (n) =>
          String(n.recipientUserId) === String(uid) &&
          /やりとりが開始/.test(String(n.title || ""))
      );
    if (chatStartedFor(profile.partnerAId) && chatStartedFor(profile.partnerBId)) {
      bump("chat-started");
    }
    const msgCount = readBenchMessageCount(thread?.id);
    if (msgCount >= 1) bump("msg-a");
    if (msgCount >= 2) bump("msg-b");
    return doneThrough;
  }

  function mergeBenchMilestoneProgress(profile, result) {
    const steps = result?.steps || [];
    if (!steps.length) return result;
    const milestoneDone = detectBenchMilestoneDoneThrough(profile, steps);
    const baseDoneThrough =
      result?.done === true ? steps.length - 1 : Math.max(-1, (result?.index ?? 0) - 1);
    const doneThrough = Math.max(baseDoneThrough, milestoneDone);
    if (result?.done === true) {
      return { ...result, doneThrough: steps.length - 1, index: steps.length };
    }
    const currentIndex = Math.min(Math.max(doneThrough + 1, result?.index ?? 0), steps.length - 1);
    return {
      ...result,
      doneThrough,
      index: currentIndex,
      stepId: steps[currentIndex]?.id || result.stepId,
      step: steps[currentIndex] || result.step,
    };
  }

  function detectBenchStepProgress(profile) {
    const steps = getRunnableBenchSteps(profile);
    const finish = (stepId, done) =>
      mergeBenchMilestoneProgress(profile, buildBenchStepResult(steps, stepId, done === true));
    if (!steps.length) {
      return { index: 0, total: 0, step: null, steps, done: false, stepId: "start-notify", doneThrough: -1 };
    }

    if (hasBenchReviewNotification(profile)) {
      return finish("review", true);
    }

    const thread = readBenchThread(profile);
    const tid = pickStr(thread?.id, profile?.threadId);
    const rs = String(thread?.roomStatus || thread?.status || "").toLowerCase();
    const Fee = global.TasuPlatformChatFee;
    const Manual = global.TasuPlatformChatManualTransferFlow;
    const Connect = global.TasuPlatformChatConnectChatFlow;
    const connect = profile?.connect === true;
    const feePaid = thread && Fee?.isFeePaid?.(thread.id);
    const msgCount = readBenchMessageCount(tid);

    if (connect) {
      if (thread && Connect?.isPaymentCompletedForReview?.(thread)) {
        return finish("review", false);
      }
      if (rs === "completed") {
        return finish("connect-pay", false);
      }
      if (rs === "completion_pending" || pickStr(thread?.completionRequestedBy)) {
        return finish("approve", false);
      }
      if (thread && (rs === "active" || rs === "open")) {
        return finish("chat-active", false);
      }
      return finish("start-notify", false);
    }

    const preRecord = readBenchPreStartRecord(profile);
    const preStatus = pickStr(preRecord?.status);

    if (!thread) {
      if (!preRecord) {
        return finish("start-notify", false);
      }
      if (preStatus === "awaiting_fee") {
        return finish("fee", false);
      }
      if (preStatus === "applied" || preStatus === "requested" || preStatus === "rejected") {
        return finish("contact-gate", false);
      }
      return finish("start-notify", false);
    }

    const Gate = global.TasuPlatformChatContactGate;
    if (thread && Gate?.shouldBlockChatDetailAccess?.(thread)) {
      if (preStatus === "awaiting_fee") {
        return finish("fee", false);
      }
      return finish("contact-gate", false);
    }

    if (thread && !feePaid && (rs === "fee_pending" || preStatus === "awaiting_fee")) {
      return finish("fee", false);
    }

    if (rs === "completed") {
      const manualSt = Manual?.getThreadState?.(tid) || {};
      const st = pickStr(manualSt.status);
      if (st === "confirmed") {
        return finish("review", false);
      }
      if (st === "paid") {
        return finish("manual-confirm", false);
      }
      return finish("manual-pay", false);
    }

    if (rs === "completion_pending" || pickStr(thread?.completionRequestedBy)) {
      return finish("approve", false);
    }

    if (thread && (rs === "active" || rs === "open")) {
      if (msgCount >= 2) {
        return finish("complete-request", false);
      }
      if (msgCount >= 1) {
        return finish("msg-b", false);
      }
      return finish("chat-started", false);
    }

    return finish("start-notify", false);
  }

  function buildBenchStepGuide(profile, progress) {
    const prog = progress || detectBenchStepProgress(profile);
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const sides = Demo?.getSideMeta?.(profile) || {};
    const pattern = resolveManualBenchPattern(null, profile?.id, profile?.connect);
    const step = prog.step;
    const actor = pickStr(step?.actor, "—");
    let sideKey = "";
    let sideMeta = null;
    if (actor === "A") {
      sideKey = "A";
      sideMeta = sides.A;
    } else if (actor === "B") {
      sideKey = "B";
      sideMeta = sides.B;
    } else if (actor.includes("A") && !actor.includes("B")) {
      sideKey = "A";
      sideMeta = sides.A;
    } else if (actor.includes("B") && !actor.includes("A")) {
      sideKey = "B";
      sideMeta = sides.B;
    }

    const expectNotify = step?.expectNotify;
    const expectNotifyA = step?.expectNotifyA;
    let notifyHint = "";
    const formatNotifyExpect = (spec) => {
      if (!spec?.title) return "";
      const notifySide = spec.audience === "A" ? sides.A : sides.B;
      let hint = `${notifySide?.role || spec.audience}（${notifySide?.name || "—"}）へ「${spec.title}」`;
      if (spec.cta) hint += ` / CTA「${spec.cta}」`;
      return hint;
    };
    const hints = [formatNotifyExpect(expectNotifyA), formatNotifyExpect(expectNotify)].filter(Boolean);
    notifyHint = hints.join(" / ");

    const flowNote = profile?.connect
      ? "Connectあり: 550円ゲートなし・銀行振込なし"
      : "Connectなし: 550円ゲート→銀行振込→入金確認後に評価";

    return {
      patternId: pattern.id,
      patternLabel: pattern.label,
      patternOrder: pattern.order,
      flowNote,
      done: prog.done,
      stepIndex: prog.index,
      stepTotal: prog.total,
      stepId: prog.stepId,
      stepLabel: pickStr(step?.label, prog.done ? "完了" : "—"),
      stepAction: pickStr(step?.action, ""),
      actor,
      sideKey,
      sideRole: sideMeta?.role || "",
      sideName: sideMeta?.name || "",
      sideUserId: sideMeta?.userId || "",
      notifyHint,
      actions: step?.actions || [],
      expectNotify: expectNotify || null,
    };
  }

  function buildBenchSidePanel(profile, guide, progress) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const sides = Demo?.getSideMeta?.(profile) || {};
    const thread = readBenchThread(profile);
    const rs = thread
      ? String(thread.roomStatus || thread.status || "active").toLowerCase()
      : "none";
    const rsLabels = {
      active: "やりとり中",
      open: "やりとり中",
      completion_pending: "完了申請中",
      completed: "完了",
      cancelled: "キャンセル",
      fee_pending: "手数料待ち（550円）",
      none: "スレッド未作成",
    };

    function basePanel(sideKey) {
      const meta = sides[sideKey] || {};
      return {
        sideKey,
        role: pickStr(meta.role),
        name: pickStr(meta.name),
        userId: pickStr(meta.userId),
        roomStatus: rs,
        roomStatusLabel: rsLabels[rs] || rs,
        nextAction: "待機（相手の操作を待つ）",
        isActive: false,
      };
    }

    const panels = { A: basePanel("A"), B: basePanel("B") };
    const g = guide || buildBenchStepGuide(profile, progress);

    (g.actions || []).forEach((action) => {
      const sk = pickStr(action.side);
      if (!panels[sk]) return;
      panels[sk].nextAction = pickStr(action.label, "操作する");
      panels[sk].isActive = true;
    });

    if (g.sideKey && panels[g.sideKey]) {
      panels[g.sideKey].isActive = true;
      if (/^待機/.test(panels[g.sideKey].nextAction)) {
        panels[g.sideKey].nextAction = pickStr(g.stepAction, g.stepLabel);
      }
      const other = g.sideKey === "A" ? "B" : "A";
      if (g.notifyHint && /^待機/.test(panels[other].nextAction)) {
        panels[other].nextAction = "通知タブで着信を確認";
      }
    }

    if (g.actor === "A / B") {
      const text = pickStr(g.stepAction, g.stepLabel);
      panels.A.nextAction = text;
      panels.B.nextAction = text;
      panels.A.isActive = true;
      panels.B.isActive = true;
    }

    if (g.done) {
      panels.A.nextAction = "完了（評価通知まで到達）";
      panels.B.nextAction = "完了（評価通知まで到達）";
    }

    const Connect = global.TasuPlatformChatConnectChatFlow;
    let sellerConnect = "";
    if (profile?.connect && Connect?.getSellerConnectStatus) {
      const st = Connect.getSellerConnectStatus(profile.partnerAId);
      const map = {
        ready: "Connect利用可能",
        identity: "本人確認未完了",
        payout: "振込先未登録",
      };
      sellerConnect = map[st] || st;
    }

    return {
      connectMode: profile?.connect ? "Connectあり" : "Connectなし",
      sellerConnect,
      panels,
    };
  }

  function getTestBenchInitialNotify(profile) {
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const initialId = Flow?.getInitialNotifyId?.(profile);
    const row =
      (initialId &&
        (global.TasuTalkNotifications?.getAll?.() || []).find(
          (n) => String(n.id) === String(initialId)
        )) ||
      null;
    if (!row) return null;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const side =
      String(row.recipientUserId) === String(profile.partnerAId)
        ? "A"
        : String(row.recipientUserId) === String(profile.partnerBId)
          ? "B"
          : "?";
    return {
      side,
      title: pickStr(row.title),
      cta: pickStr(row.actionLabel),
      recipientUserId: pickStr(row.recipientUserId),
    };
  }

  function clearFanoutForUsers(userIds) {
    try {
      const raw = global.localStorage.getItem(FANOUT_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (!map || typeof map !== "object") return;
      userIds.forEach((uid) => {
        if (uid) delete map[String(uid)];
      });
      global.localStorage.setItem(FANOUT_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  const DEMO_RUNTIME_NOTIFY_SOURCES = new Set([
    "platform_chat_demo_message_v1",
    "platform_chat_demo_completion_request_v1",
    "platform_chat_demo_approved_v1",
    "platform_chat_demo_cancelled_v1",
    "platform_chat_demo_chat_started_v1",
    "platform_chat_demo_product_shipped_v1",
    "platform_chat_demo_shipping_ready_v1",
    "platform_chat_demo_bank_transfer_reported_v1",
    "platform_chat_demo_payment_confirmed_v1",
    "platform_chat_demo_product_received_v1",
    "platform_chat_demo_cod_reported_v1",
    "platform_chat_demo_cod_confirmed_v1",
    "platform_chat_demo_purchase_completed_v1",
    "platform_chat_demo_initial_v1",
    "platform_chat_demo_v1",
    "platform_fee_v1",
    "platform_chat_review_v1",
  ]);

  function notificationTargetsProfileUsers(row, profile) {
    const recipient = pickStr(row?.recipientUserId);
    return recipient === profile.partnerAId || recipient === profile.partnerBId;
  }

  function shouldResetNotificationForProfile(row, profile) {
    if (!row || !profile) return false;
    const src = String(row?.source || "");
    if (DEMO_RUNTIME_NOTIFY_SOURCES.has(src) && notificationTargetsProfileUsers(row, profile)) {
      return true;
    }
    if (src === "platform_chat_demo_v1" || src === "platform_chat_demo_initial_v1") {
      return notificationMatchesProfile(row, profile) || notificationTargetsProfileUsers(row, profile);
    }
    if (notificationMatchesProfile(row, profile)) return true;
    const listingIds = getListingIdsForProfile(profile);
    const lid = pickStr(row?.listingId, row?.listing_id);
    const threadId = pickStr(row?.threadId, row?.thread_id);
    if (threadId) {
      if (threadId === profile.threadId || DemoThreadIdsForProfile(profile).has(threadId)) {
        return true;
      }
      const store = global.TasuChatThreadStore;
      const thread = (store?.readAll?.() || []).find((t) => String(t.id) === threadId);
      if (thread && threadMatchesProfile(thread, profile)) return true;
    }
    if (lid && listingIds.has(lid)) {
      return (
        src === "platform" ||
        src === "shop" ||
        src === "business" ||
        src === "job" ||
        src === "worker" ||
        DEMO_RUNTIME_NOTIFY_SOURCES.has(src)
      );
    }
    const recipient = pickStr(row?.recipientUserId);
    if (recipient === profile.partnerAId || recipient === profile.partnerBId) {
      return (
        DEMO_RUNTIME_NOTIFY_SOURCES.has(src) ||
        src === "platform" ||
        src === "shop" ||
        src === "business" ||
        src === "job" ||
        src === "worker"
      );
    }
    return false;
  }

  function DemoThreadIdsForProfile(profile) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const ids = new Set([pickStr(profile?.threadId)]);
    const base = Demo?.CATEGORY_BASE?.[profile?.id];
    if (base?.plainThreadId) ids.add(base.plainThreadId);
    if (base?.connectThreadId) ids.add(base.connectThreadId);
    return ids;
  }

  function resetLiveFlow(options) {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.getProfile?.(options?.profile, options?.connect);
    if (!profile) return { ok: false, reason: "missing_profile" };

    const listingIds = getListingIdsForProfile(profile);
    const threadIds = new Set([...DemoThreadIdsForProfile(profile)]);

    const store = global.TasuChatThreadStore;
    if (store?.readAll && store?.writeAll) {
      const keep = [];
      (store.readAll() || []).forEach((t) => {
        const lid = pickStr(t.listingId);
        const matchesListing = listingIds.has(lid);
        const matchesProfile = threadMatchesProfile(t, profile);
        const matchesDemoId =
          t.id === profile.threadId ||
          t.id === Demo.CATEGORY_BASE?.[profile.id]?.plainThreadId ||
          t.id === Demo.CATEGORY_BASE?.[profile.id]?.connectThreadId;
        if (matchesListing || matchesDemoId || matchesProfile) {
          threadIds.add(String(t.id));
          return;
        }
        keep.push(t);
      });
      store.writeAll(keep);
    }

    if (store?.MESSAGES_KEY && threadIds.size) {
      try {
        const raw = global.localStorage.getItem(store.MESSAGES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        threadIds.forEach((id) => {
          delete map[id];
        });
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
    }

    try {
      const feeKey = global.TasuPlatformChatFee?.STORAGE_KEY || "tasful_platform_chat_fees_v1";
      const raw = global.localStorage.getItem(feeKey);
      const fees = raw ? JSON.parse(raw) : [];
      if (Array.isArray(fees)) {
        const next = fees.filter((row) => !threadIds.has(pickStr(row.threadId, row.thread_id)));
        global.localStorage.setItem(feeKey, JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }

    if (profile.id === "job") {
      try {
        const key = "tasful_job_applications_v1";
        const raw = global.localStorage.getItem(key);
        const apps = raw ? JSON.parse(raw) : [];
        const jid = DETAIL_LISTING_BY_CATEGORY.job;
        if (Array.isArray(apps)) {
          global.localStorage.setItem(
            key,
            JSON.stringify(apps.filter((a) => String(a.job_id) !== jid))
          );
        }
      } catch {
        /* ignore */
      }
      try {
        global.localStorage.removeItem("tasful_job_full_flow_demo_v1");
      } catch {
        /* ignore */
      }
    }

    if (profile.id === "worker") {
      const wr = global.TasuWorkerRequestsStore;
      if (wr?.readAll) {
        const wid = DETAIL_LISTING_BY_CATEGORY.worker;
        const next = (wr.readAll() || []).filter(
          (r) => String(r.worker_id) !== wid && String(r.worker_id) !== "demo-worker-001"
        );
        try {
          global.localStorage.setItem("tasful_worker_requests_v1", JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    }

    try {
      const contactKey = "tasful_listing_contact_requests_v1";
      const rawContacts = global.localStorage.getItem(contactKey);
      const contacts = rawContacts ? JSON.parse(rawContacts) : [];
      if (Array.isArray(contacts)) {
        const nextContacts = contacts.filter((row) => !listingIds.has(pickStr(row.listing_id)));
        global.localStorage.setItem(contactKey, JSON.stringify(nextContacts));
      }
    } catch {
      /* ignore */
    }

    try {
      const feeKey = global.TasuPlatformChatFee?.STORAGE_KEY || "tasful_platform_chat_fees_v1";
      const rawFees = global.localStorage.getItem(feeKey);
      const fees = rawFees ? JSON.parse(rawFees) : [];
      if (Array.isArray(fees)) {
        const demoContactId = global.TasuPlatformChatDualWindowDemo?.getDemoContactId?.(profile);
        const nextFees = fees.filter((row) => {
          const lid = pickStr(row.listingId);
          const cid = pickStr(row.contactId);
          const aid = pickStr(row.applicationId);
          const rid = pickStr(row.requestId);
          if (listingIds.has(lid)) return false;
          if (demoContactId && cid === demoContactId) return false;
          if (profile.id === "job" && aid === "job-app-demo-full-001") return false;
          if (profile.id === "worker" && rid === "worker-req-demo-dual-001") return false;
          return true;
        });
        global.localStorage.setItem(feeKey, JSON.stringify(nextFees));
      }
    } catch {
      /* ignore */
    }

    if (profile.dealId) {
      try {
        const raw = global.localStorage.getItem("tasful_platform_completion_v1");
        const map = raw ? JSON.parse(raw) : {};
        if (map && typeof map === "object" && map[profile.dealId]) {
          delete map[profile.dealId];
          global.localStorage.setItem("tasful_platform_completion_v1", JSON.stringify(map));
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const manualKey =
        global.TasuPlatformChatManualTransferFlow?.STORAGE_KEY || "tasful_platform_manual_transfer_v1";
      const rawManual = global.localStorage.getItem(manualKey);
      const manualMap = rawManual ? JSON.parse(rawManual) : {};
      if (manualMap && typeof manualMap === "object") {
        const nextManual = { ...manualMap };
        threadIds.forEach((id) => {
          delete nextManual[id];
        });
        global.localStorage.setItem(manualKey, JSON.stringify(nextManual));
      }
    } catch {
      /* ignore */
    }

    try {
      global.localStorage.removeItem("tasful_chat_dual_window_demo_v1");
      global.localStorage.removeItem("tasful_platform_verify_fee_threads_v1");
      global.localStorage.removeItem("tasful_platform_verify_connect_complete_v1");
    } catch {
      /* ignore */
    }

    const notifyStore = global.TasuTalkNotifications;
    if (notifyStore?.getAll && notifyStore?.saveAll) {
      const removedIds = [];
      const next = (notifyStore.getAll() || []).filter((n) => {
        if (isVerifySeedNotification(n)) {
          removedIds.push(String(n.id));
          return false;
        }
        const keep = !shouldResetNotificationForProfile(n, profile);
        if (!keep) removedIds.push(String(n.id));
        return keep;
      });
      notifyStore.saveAll(next);
      global.TasuTalkOfficialRooms?.purgeNotificationMessages?.(removedIds);
    }

    clearFanoutForUsers([profile.partnerAId, profile.partnerBId]);

    try {
      const raw = global.localStorage.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      if (Array.isArray(seed.reviews) && threadIds.size) {
        seed.reviews = seed.reviews.filter((r) => !threadIds.has(String(r.room_id)));
        global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
      }
    } catch {
      /* ignore */
    }

    try {
      global.localStorage.removeItem("tasful_job_full_flow_demo_v1");
    } catch {
      /* ignore */
    }

    try {
      global.localStorage.removeItem("tasful_platform_notify_master_v2");
    } catch {
      /* ignore */
    }

    try {
      global.localStorage.setItem(
        MARKER,
        JSON.stringify({ profile: profile.id, connect: profile.connect, at: Date.now() })
      );
    } catch {
      /* ignore */
    }

    global.__tasuTalkNotificationsBootstrapped = false;

    try {
      const payKey = global.TasuPlatformChatConnectChatFlow?.PAYMENT_STORAGE_KEY || "tasful_platform_connect_payments_v1";
      const rawPay = global.localStorage.getItem(payKey);
      const payMap = rawPay ? JSON.parse(rawPay) : {};
      if (payMap && typeof payMap === "object") {
        const nextPay = { ...payMap };
        threadIds.forEach((id) => {
          delete nextPay[id];
        });
        global.localStorage.setItem(payKey, JSON.stringify(nextPay));
      }
    } catch {
      /* ignore */
    }

    global.TasuPlatformChatDualWindowDemo?.ensureInitialDemoChainState?.(profile, {
      force: true,
      benchPrePurchase: isLiveFlowMode() && profile.connect !== true,
    });
    try {
      global.TasuPlatformChatConnectChatFlow?.syncDemoConnectRequirementNotifications?.(profile);
    } catch {
      /* ignore */
    }

    global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    global.dispatchEvent(new CustomEvent("tasu:talk-notifications-changed"));

    return { ok: true, profile, clearedThreads: [...threadIds] };
  }

  function purgeStaleJobApplicationThreadRefs(listingIds, staleThreadIds) {
    const lids = new Set((listingIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    const stale = new Set((staleThreadIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    const cleared = [];
    try {
      const key = "tasful_job_applications_v1";
      const raw = global.localStorage.getItem(key);
      const apps = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(apps)) return cleared;
      const next = apps.map((row) => {
        const jobId = pickStr(row.job_id, row.listingId);
        const threadId = pickStr(row.thread_id, row.threadId);
        if (lids.size && !lids.has(jobId)) return row;
        if (threadId && (stale.has(threadId) || /^chat-/i.test(threadId))) {
          cleared.push(threadId);
          return { ...row, thread_id: "", threadId: "" };
        }
        const appId = pickStr(row.application_id, row.applicationId);
        if (appId && /^job-app-/i.test(appId)) {
          return { ...row, thread_id: "", threadId: "" };
        }
        return row;
      });
      global.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return cleared;
  }

  function purgeBenchCompletionReviewState(staleThreadIds, profile) {
    const stale = new Set((staleThreadIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    try {
      const raw = global.localStorage.getItem("tasful_platform_completion_v1");
      const map = raw ? JSON.parse(raw) : {};
      if (map && typeof map === "object") {
        const next = { ...map };
        Object.keys(next).forEach((key) => {
          if (stale.has(key)) delete next[key];
        });
        if (profile?.dealId && stale.size) delete next[profile.dealId];
        global.localStorage.setItem("tasful_platform_completion_v1", JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }
    try {
      const manualKey =
        global.TasuPlatformChatManualTransferFlow?.STORAGE_KEY || "tasful_platform_manual_transfer_v1";
      const rawManual = global.localStorage.getItem(manualKey);
      const manualMap = rawManual ? JSON.parse(rawManual) : {};
      if (manualMap && typeof manualMap === "object") {
        const nextManual = { ...manualMap };
        stale.forEach((id) => {
          delete nextManual[id];
        });
        global.localStorage.setItem(manualKey, JSON.stringify(nextManual));
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = global.localStorage.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      if (seed && typeof seed === "object" && Array.isArray(seed.reviews)) {
        seed.reviews = seed.reviews.filter((row) => !stale.has(pickStr(row.room_id, row.roomId)));
        global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
      }
    } catch {
      /* ignore */
    }
  }

  function runAggressiveBenchPurge(profile, options) {
    const opts = options || {};
    const listingIds = [...getListingIdsForProfile(profile)];
    const staleThreadIds = [
      ...new Set(
        [opts.previousRunThreadId, ...(opts.staleThreadIds || []), ...(opts.clearedThreads || [])]
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      ),
    ];
    const purgeOpts = {
      allKinds: profile.id === "job",
      staleThreadIds,
      staleResetTokens: [opts.previousResetToken].filter(Boolean),
      participantIds: [profile.partnerAId, profile.partnerBId],
    };
    const threadPurge = global.TasuChatThreadStore?.purgeBenchListingThreads?.(listingIds, purgeOpts);
    const notifyPurge = global.TasuTalkNotifications?.purgeRecipientsNotifications?.(
      [profile.partnerAId, profile.partnerBId],
      {
        removeAllForRecipients: true,
        staleThreadIds,
        removeJobBenchRuntime: true,
      }
    );
    const globalNotifyPurge =
      global.TasuTalkNotifications?.purgeNotificationsReferencingThreads?.(staleThreadIds);
    const clearedAppThreads = purgeStaleJobApplicationThreadRefs(listingIds, staleThreadIds);
    purgeBenchCompletionReviewState(staleThreadIds, profile);
    return {
      threadPurge,
      notifyPurge,
      globalNotifyPurge,
      clearedAppThreads,
      staleThreadIds,
      listingIds,
    };
  }

  /**
   * 2窓ベンチ — 1 run 完了後の「リセットして再実行」用（カテゴリ設定は維持）
   */
  function resetBenchRun(options) {
    const opts = options || {};
    const staleThreadIds = [
      pickStr(opts.previousRunThreadId),
      ...(opts.staleThreadIds || []),
    ].filter(Boolean);
    const base = resetLiveFlow(options);
    const profile = base?.profile;
    if (!profile) return { ...base, ok: false, reason: pickStr(base?.reason, "missing_profile") };

    const listingIds = [...getListingIdsForProfile(profile)];
    const firstPurge = runAggressiveBenchPurge(profile, {
      ...opts,
      clearedThreads: [...(base.clearedThreads || []), ...staleThreadIds],
      staleThreadIds,
    });

    if (profile.id === "job") {
      try {
        global.localStorage.removeItem("tasful_job_full_flow_demo_v1");
        global.localStorage.removeItem("tasful_platform_verify_fee_threads_v1");
      } catch {
        /* ignore */
      }
    }

    try {
      global.localStorage.removeItem("tasful_chat_dual_window_demo_v1");
    } catch {
      /* ignore */
    }

    global.TasuPlatformChatDualWindowDemo?.ensureInitialDemoChainState?.(profile, {
      force: true,
      benchPrePurchase: isLiveFlowMode() && profile.connect !== true,
    });
    try {
      global.TasuPlatformChatConnectChatFlow?.syncDemoConnectRequirementNotifications?.(profile);
    } catch {
      /* ignore */
    }

    const secondPurge = runAggressiveBenchPurge(profile, {
      ...opts,
      clearedThreads: [
        ...new Set([
          ...(base.clearedThreads || []),
          ...staleThreadIds,
          ...(firstPurge.threadPurge?.removedIds || []),
        ]),
      ],
      staleThreadIds,
    });

    global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    global.dispatchEvent(new CustomEvent("tasu:talk-notifications-changed"));

    const payload = {
      ...base,
      ok: true,
      runId: opts.runId,
      resetAt: new Date().toISOString(),
      purgedThreadIds: [
        ...new Set([
          ...(base.clearedThreads || []),
          ...(firstPurge.threadPurge?.removedIds || []),
          ...(secondPurge.threadPurge?.removedIds || []),
          ...staleThreadIds,
        ]),
      ],
      purgedNotificationIds: [
        ...new Set([
          ...(firstPurge.notifyPurge?.removedIds || []),
          ...(firstPurge.globalNotifyPurge?.removedIds || []),
          ...(secondPurge.notifyPurge?.removedIds || []),
          ...(secondPurge.globalNotifyPurge?.removedIds || []),
        ]),
      ],
    };
    try {
      global.__tasuBenchLastReset = payload;
    } catch {
      /* ignore */
    }
    return payload;
  }

  function resetAllDemoCategories() {
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const order = Demo?.DEMO_CATEGORY_ORDER || [];
    const results = [];
    order.forEach((id) => {
      results.push(resetLiveFlow({ profile: id, connect: false }));
      const base = Demo?.CATEGORY_BASE?.[id];
      if (base?.connectThreadId && base?.dealId) {
        results.push(resetLiveFlow({ profile: id, connect: true }));
      }
    });
    return { ok: true, results };
  }

  function maybeResetLiveFlowFromUrl() {
    if (!isLiveFlowMode()) return;
    // 2窓ベンチ親は bootBenchFromUrl が reset を担当（三重 reset / boot 抜け防止）
    if (/chat-dual-window-demo\.html$/i.test(String(global.location?.pathname || ""))) return;
    if (readSearchParams().get(LIVE_FLOW_RESET_PARAM) !== "1") return;
    const Demo = global.TasuPlatformChatDualWindowDemo;
    resetLiveFlow({
      profile: Demo?.getDemoProfileIdFromUrl?.(),
      connect: Demo?.getDemoConnectFromUrl?.(),
    });
    try {
      const params = readSearchParams();
      params.delete(LIVE_FLOW_RESET_PARAM);
      const next = `${global.location.pathname}?${params.toString()}${global.location.hash || ""}`;
      global.history.replaceState(null, "", next);
    } catch {
      /* ignore */
    }
  }

  global.TasuPlatformChatLiveFlow = {
    LIVE_FLOW_PARAM,
    LIVE_FLOW_RESET_PARAM,
    DETAIL_LISTING_BY_CATEGORY,
    isLiveFlowMode,
    getListingIdsForProfile,
    threadMatchesProfile,
    notificationMatchesProfile,
    isRuntimeLiveFlowNotification,
    appendLiveFlowParams,
    detailPagePath,
    detailUrl,
    managementPageUrl,
    buildBenchFeePayUrl,
    readBenchPreStartRecord,
    readBenchThread,
    hasOpenBenchChat,
    benchChatFrameUrl,
    benchBuyerWaitingUrl,
    benchBuyerDetailUrl,
    benchSellerIdleUrl,
    hasBenchPurchased,
    hasBenchPreStartSellerNotify,
    ensureBenchPreStartSellerNotify,
    notifyPurchaseChatStartedForBench,
    notifyProductChatStartedForBench,
    shouldShowBenchBuyerWaiting,
    chatUrl,
    notifyTabUrl,
    buildLiveFlowSteps,
    buildLauncherPinActions,
    buildTestBenchChecks,
    getTestBenchInitialNotify,
    MANUAL_BENCH_PATTERNS,
    getManualBenchPatterns,
    resolveManualBenchPattern,
    getRunnableBenchSteps,
    detectBenchStepProgress,
    buildBenchStepGuide,
    buildBenchSidePanel,
    TEST_BENCH_CHECK_BASE,
    TEST_BENCH_CHECK_CONNECT,
    resetLiveFlow,
    resetBenchRun,
    resetDemoCategory: resetLiveFlow,
    resetAllDemoCategories,
    maybeResetLiveFlowFromUrl,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", maybeResetLiveFlowFromUrl);
  } else {
    maybeResetLiveFlowFromUrl();
  }
})(typeof window !== "undefined" ? window : globalThis);
