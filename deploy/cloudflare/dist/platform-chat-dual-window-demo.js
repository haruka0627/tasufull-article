/**
 * 共通チャットフロー確認デモ — 2窓ランチャー / 実操作フロー用シード
 */
(function (global) {
  "use strict";

  const REVIEW_PARAM = "chat-demo";
  const LEGACY_REVIEW_PARAM = "job-full";
  const RESET_PARAM = "chatDemoReset";
  const PROFILE_PARAM = "demoProfile";
  const STATE_PARAM = "demoState";
  const NOTIFY_PARAM = "demoNotify";
  const MARKER = "tasful_chat_dual_window_demo_v1";

  const DEMO_CONTACT_IDS = Object.freeze({
    skill: "contact-demo-skill-dual-001",
    worker: "contact-demo-worker-dual-001",
    general: "contact-demo-general-dual-001",
    product: "contact-demo-product-dual-001",
    shop: "contact-demo-shop-dual-001",
    business: "contact-demo-business-dual-001",
    builder: "contact-demo-builder-dual-001",
  });

  const CONNECT_PARAM = "demoConnect";

  const DEMO_STATES = Object.freeze({
    preStart: "pre-start",
    notify: "notify",
    active: "active",
    pending: "pending",
    completed: "completed",
    review: "review",
    reviewed: "reviewed",
    cancelled: "cancelled",
    connectPay: "connect-pay",
    connectRefund: "connect-refund",
  });

  /** @type {Record<string, object>} */
  const CATEGORY_BASE = Object.freeze({
    job: {
      categoryKey: "job",
      label: "求人",
      articleListingId: "job_demo_full_001",
      plainThreadId: "chat-demo-job-full-001",
      connectThreadId: "chat-demo-job-deal-001",
      dealId: "job_deal_demo_001",
      partnerAId: "u_job_demo_full",
      partnerAName: "タスク確認株式会社",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "job_demo_full_001",
      listingType: "job",
      listingTitle: "YouTubeショート動画編集スタッフ募集",
      category: "求人",
      hello: "条件確認・日程調整はこのチャットで進めてください。",
    },
    skill: {
      categoryKey: "skill",
      label: "スキル",
      articleListingId: "demo-skill-001",
      plainThreadId: "chat-demo-skill-plain-001",
      connectThreadId: "chat-demo-skill-deal-001",
      dealId: "skill_deal_demo_001",
      partnerAId: "u_sachi",
      partnerAName: "さちこ",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-skill-001",
      listingType: "skill",
      listingTitle: "プロ品質の動画編集・ショート動画制作",
      category: "スキル",
      hello: "ご購入ありがとうございます。内容確認から進めさせてください。",
    },
    worker: {
      categoryKey: "worker",
      label: "ワーカー",
      articleListingId: "demo-worker-001",
      plainThreadId: "chat-demo-worker-plain-001",
      connectThreadId: "chat-demo-worker-deal-001",
      dealId: "worker_deal_demo_001",
      partnerAId: "demo-worker-001",
      partnerAName: "代行ワーカーA",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-worker-001",
      listingType: "worker",
      listingTitle: "即日対応できる動画編集者",
      category: "ワーカー",
      hello: "依頼内容の確認をお願いします。",
      notifyIds: [],
    },
    product: {
      categoryKey: "product",
      label: "商品",
      articleListingId: "demo-product-001",
      plainThreadId: "chat-demo-product-plain-001",
      connectThreadId: "chat-demo-product-deal-001",
      dealId: "product_deal_demo_001",
      partnerAId: "u_product",
      partnerAName: "premium_home",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-product-001",
      listingType: "product",
      listingTitle: "プレミアム家電セット 2026",
      category: "商品",
      hello: "商品の発送状況をご確認ください。",
      notifyIds: [],
    },
    shop: {
      categoryKey: "shop_store",
      label: "店舗・販売",
      articleListingId: "demo-shop-reworks",
      plainThreadId: "chat-demo-shop-plain-001",
      connectThreadId: "chat-demo-shop-deal-001",
      dealId: "shop_deal_demo_001",
      partnerAId: "u_shop_demo",
      partnerAName: "RE:WORKS 渋谷店",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-shop-reworks",
      listingType: "shop_store",
      listingTitle: "工具・機材の販売・買取",
      category: "店舗販売",
      hello: "受け取り方法をご確認ください。",
      notifyIds: [],
    },
    business: {
      categoryKey: "business_service",
      label: "業務サービス",
      articleListingId: "demo-business-service-001",
      plainThreadId: "chat-demo-business-plain-001",
      connectThreadId: "chat-demo-business-deal-001",
      dealId: "business_deal_demo_001",
      partnerAId: "u_business_demo",
      partnerAName: "塗装工房サポート",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-business-service-001",
      listingType: "business_service",
      listingTitle: "外壁塗装・防水工事の見積相談",
      category: "業務サービス",
      hello: "作業日程と見積内容をご確認ください。",
      notifyIds: [],
    },
    general: {
      categoryKey: "general",
      label: "一般案件",
      articleListingId: "demo-general-001",
      plainThreadId: "chat-demo-general-plain-001",
      connectThreadId: "chat-demo-general-deal-001",
      dealId: "general_deal_demo_001",
      partnerAId: "u_general_demo",
      partnerAName: "TASFUL運営",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "demo-general-001",
      listingType: "general",
      listingTitle: "地域交流イベント参加者募集",
      category: "一般案件",
      hello: "案件内容の確認をお願いします。",
      notifyIds: [],
    },
    builder: {
      categoryKey: "builder",
      label: "Builder",
      articleListingId: "builder_demo_001",
      plainThreadId: "chat-demo-builder-plain-001",
      connectThreadId: "chat-demo-builder-deal-001",
      dealId: "builder_deal_demo_001",
      partnerAId: "demo-builder-user",
      partnerAName: "山田 太郎",
      partnerBId: "u_hiro",
      partnerBName: "ひろ",
      listingId: "builder_demo_001",
      listingType: "builder",
      listingTitle: "Builder案件デモ",
      category: "Builder",
      hello: "案件内容の確認をお願いします。",
      notifyIds: [],
    },
  });

  const DEMO_CATEGORY_ORDER = Object.freeze([
    "job",
    "skill",
    "worker",
    "general",
    "product",
    "shop",
    "business",
    "builder",
  ]);

  /** @type {Record<string, Array<{ side: "A"|"B", text: string }>>} */
  const DEMO_ACTIVE_CONVERSATIONS = Object.freeze({
    job: [
      { side: "A", text: "条件確認・日程調整はこのチャットで進めてください。" },
      { side: "B", text: "了解しました。初稿は来週木曜までに提出します。" },
      { side: "A", text: "初稿の提出期限は来週金曜までで問題ないでしょうか。" },
    ],
    skill: [
      { side: "A", text: "ご購入ありがとうございます。内容確認から進めさせてください。" },
      { side: "B", text: "よろしくお願いします。LP改修の構成案を共有します。" },
      { side: "A", text: "納品予定日は来週金曜を想定しています。" },
      { side: "A", text: "ヒアリングです。①ターゲット層 ②参考URL ③優先したい納期を教えてください。" },
    ],
    worker: [
      { side: "B", text: "依頼ありがとうございます。渋谷エリアの買い物代行、承りました。" },
      { side: "A", text: "よろしくお願いします。買い物リストを送ります。" },
      { side: "B", text: "リスト確認しました。14時頃に代行を開始します。" },
    ],
    product: [
      { side: "A", text: "ご購入ありがとうございます。発送準備に入ります。" },
      { side: "B", text: "よろしくお願いします。" },
      { side: "A", text: "明日の午前中に発送予定です。追跡番号は発送後お送りします。" },
    ],
    shop: [
      { side: "A", text: "お問い合わせありがとうございます。取り置き可能です。" },
      { side: "B", text: "よろしくお願いします。明日午後に来店します。" },
      { side: "A", text: "受け取り方法は店頭受取で問題ありません。" },
    ],
    business: [
      { side: "A", text: "ご相談ありがとうございます。現地確認の日程を調整させてください。" },
      { side: "B", text: "よろしくお願いします。外壁の状態写真を送ります。" },
      { side: "A", text: "見積内容と作業日程のご確認をお願いします。" },
    ],
    general: [
      { side: "A", text: "ご応募/ご依頼ありがとうございます。内容確認から進めます。" },
      { side: "B", text: "よろしくお願いします。詳細を共有します。" },
      { side: "A", text: "作業日程のご確認をお願いします。" },
    ],
    builder: [
      { side: "A", text: "案件へのご応募/ご依頼ありがとうございます。" },
      { side: "B", text: "よろしくお願いします。作業内容を共有します。" },
      { side: "A", text: "作業完了の承認をお願いします。" },
    ],
  });

  /** @type {Record<string, { side: "A"|"B", text: string }>} */
  const DEMO_PENDING_TAIL = Object.freeze({
    skill: { side: "A", text: "納品物の確認をお願いします。" },
    worker: { side: "B", text: "依頼内容の確認をお願いします。" },
    product: { side: "A", text: "商品の発送状況をご確認ください。" },
    shop: { side: "A", text: "受け取り方法をご確認ください。" },
    business: { side: "A", text: "作業完了の承認をお願いします。" },
    general: { side: "A", text: "作業完了の承認をお願いします。" },
    builder: { side: "A", text: "作業完了の承認をお願いします。" },
    job: { side: "A", text: "やりとり完了の承認をお願いします。" },
  });

  const PURCHASE_LIKE_SCENES = new Set([
    "purchase",
    "apply",
    "inquiry",
    "consult",
    "request",
    "request-accepted",
    "estimate",
    "estimate-approved",
  ]);

  const START_LIKE_SCENES = new Set(["start", "start-b", "shipped", "reservation"]);

  const PRE_REQUEST_SCENES = new Set(["complete-request"]);

  const COMPLETE_CARD_SCENES = new Set(["complete"]);

  const REVIEW_CARD_SCENES = new Set(["review"]);

  const CANCEL_SCENES = new Set(["cancel"]);

  const CONNECT_PAY_SCENES = new Set(["connect-pay"]);

  const CONNECT_REFUND_SCENES = new Set(["connect-refund"]);

  function normalizeCategoryParam(raw) {
    const q = pickStr(raw).toLowerCase();
    if (q === "plain") return "job";
    if (q === "connect") return "skill";
    if (q === "shop" || q === "shop_store" || q === "shop-store") return "shop";
    if (q === "business" || q === "business_service" || q === "business-service") return "business";
    if (CATEGORY_BASE[q]) return q;
    return "job";
  }

  function getDemoConnectFromUrl() {
    const profile = pickStr(readSearchParams().get(PROFILE_PARAM)).toLowerCase();
    if (profile === "job") return false;
    const q = pickStr(readSearchParams().get(CONNECT_PARAM)).toLowerCase();
    if (q === "1" || q === "true") return true;
    if (q === "0" || q === "false") return false;
    return profile === "connect";
  }

  function isJobConnectExcluded(categoryKey) {
    return normalizeCategoryParam(categoryKey) === "job";
  }

  function buildProfile(categoryKey, connect) {
    const base = CATEGORY_BASE[categoryKey] || CATEGORY_BASE.job;
    const canConnect = Boolean(base.dealId && base.connectThreadId) && !isJobConnectExcluded(categoryKey);
    const useConnect = connect && canConnect;
    const spec = global.TasuPlatformChatCategoryFlow?.getCategorySpec?.({
      listingType: base.listingType,
      category: base.category,
    });
    const requester = spec?.requester || (categoryKey === "job" ? "seller" : "buyer");
    const articleListingId = pickStr(base.articleListingId, base.listingId);
    return {
      id: categoryKey,
      categoryKey: base.categoryKey,
      label: `${base.label}${useConnect ? "（Connectあり）" : ""}`,
      threadId: useConnect ? base.connectThreadId : base.plainThreadId,
      dealId: useConnect ? base.dealId : "",
      connectListingId: useConnect ? pickStr(base.dealId) : "",
      articleListingId,
      partnerAId: base.partnerAId,
      partnerAName: base.partnerAName,
      partnerBId: base.partnerBId,
      partnerBName: base.partnerBName,
      listingId: articleListingId,
      listingType: base.listingType,
      listingTitle: base.listingTitle,
      category: base.category,
      hello: base.hello,
      connect: useConnect,
      requesterSide: requester === "buyer" ? "B" : "A",
      platformConnect: useConnect ? "1" : "",
      notifyIds:
        global.TasuPlatformChatDualWindowFlow?.buildNotifyIds?.(
          global.TasuPlatformChatDualWindowFlow?.normalizeFlowCategoryKey?.(categoryKey) || categoryKey,
          useConnect
        ) || [],
    };
  }

  function listAllDemoThreadIds() {
    const ids = new Set();
    Object.values(CATEGORY_BASE).forEach((base) => {
      if (base.plainThreadId) ids.add(base.plainThreadId);
      if (base.connectThreadId) ids.add(base.connectThreadId);
    });
    return ids;
  }

  const DEMO_THREAD_IDS = listAllDemoThreadIds();

  const PROFILES = Object.freeze(
    Object.fromEntries(DEMO_CATEGORY_ORDER.map((key) => [key, buildProfile(key, false)]))
  );

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

  function readSearchParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch {
      return new URLSearchParams();
    }
  }

  function isChatDemoReviewFromUrl() {
    const review = readSearchParams().get("review");
    return review === REVIEW_PARAM || review === LEGACY_REVIEW_PARAM;
  }

  function getDemoProfileIdFromUrl() {
    return normalizeCategoryParam(readSearchParams().get(PROFILE_PARAM));
  }

  function getDemoStateFromUrl() {
    const q = pickStr(readSearchParams().get(STATE_PARAM));
    if (q && DEMO_STATES[q]) return q;
    if (q === "connect-pay") return DEMO_STATES.connectPay;
    if (q === "connect-refund") return DEMO_STATES.connectRefund;
    return DEMO_STATES.active;
  }

  function getProfile(profileId, connectOverride) {
    const key = normalizeCategoryParam(pickStr(profileId, getDemoProfileIdFromUrl()));
    let connect =
      typeof connectOverride === "boolean" ? connectOverride : getDemoConnectFromUrl();
    if (isJobConnectExcluded(key)) connect = false;
    return buildProfile(key, connect);
  }

  function readThreadById(threadOrId) {
    const id = typeof threadOrId === "string" ? threadOrId : pickStr(threadOrId?.id);
    if (!id) return null;
    if (typeof threadOrId === "object" && threadOrId?.id) return threadOrId;
    const store = global.TasuChatThreadStore;
    return (store?.readAll?.() || []).find((t) => String(t.id) === id) || null;
  }

  const BENCH_PURCHASE_PROFILES = new Set([
    "skill",
    "worker",
    "general",
    "product",
    "shop",
    "business",
  ]);

  function normalizeListingTypeKey(raw) {
    const k = pickStr(raw).toLowerCase().replace(/-/g, "_");
    if (k === "shop_store") return "shop";
    if (k === "business_service") return "business";
    return k;
  }

  function isBenchPurchaseProfileKey(key) {
    return BENCH_PURCHASE_PROFILES.has(pickStr(key));
  }

  /** listingId から skill/product 等のベンチプロファイルを解決（partner ID 不一致の実画面 thread 用） */
  function resolveProfileForListingThread(thread) {
    if (!thread) return null;
    const lid = pickStr(thread.listingId, thread.listing_id);
    if (!lid) return null;
    const threadType = normalizeListingTypeKey(thread.listingType);
    for (const key of DEMO_CATEGORY_ORDER) {
      if (!isBenchPurchaseProfileKey(key)) continue;
      const base = CATEGORY_BASE[key];
      const listingIds = new Set([base.listingId, base.articleListingId].filter(Boolean));
      if (!listingIds.has(lid)) continue;
      const baseType = normalizeListingTypeKey(base.listingType);
      if (threadType && threadType !== key && threadType !== baseType) continue;
      const connectId = pickStr(base.connectThreadId);
      const useConnect =
        Boolean(pickStr(thread.dealId)) || (connectId && String(thread.id) === connectId);
      return buildProfile(key, useConnect);
    }
    return null;
  }

  /** ベンチ A/B — プロファイル定義を正とする partner ID（worker: demo-worker-001 / u_hiro 等） */
  function resolveBenchPartnerIds(profile, thread) {
    const profileA = pickStr(profile?.partnerAId);
    const profileB = pickStr(profile?.partnerBId);
    if (profileA && profileB) {
      return { sellerId: profileA, buyerId: profileB, profile: profile || null };
    }
    const resolvedProfile =
      profile || resolveProfileForThread(thread) || resolveProfileForListingThread(thread);
    if (resolvedProfile?.partnerAId && resolvedProfile?.partnerBId) {
      return {
        sellerId: pickStr(resolvedProfile.partnerAId),
        buyerId: pickStr(resolvedProfile.partnerBId),
        profile: resolvedProfile,
      };
    }
    return {
      sellerId: pickStr(thread?.sellerId, thread?.partnerUserId),
      buyerId: pickStr(thread?.buyerId, thread?.buyer_id),
      profile: resolvedProfile,
    };
  }

  /** 実画面 thread の seller/buyer をベンチプロファイルへ揃える（完了・通知の宛先ずれ防止） */
  function normalizeThreadPartnerIdsForBench(thread) {
    if (!thread) return thread;
    const profile = resolveProfileForThread(thread) || resolveProfileForListingThread(thread);
    if (!profile || !isBenchPurchaseProfileKey(profile.id)) return thread;
    const { sellerId, buyerId } = resolveBenchPartnerIds(profile, thread);
    if (!sellerId || !buyerId) return thread;
    if (
      pickStr(thread.sellerId, thread.partnerUserId) === sellerId &&
      pickStr(thread.buyerId) === buyerId
    ) {
      return thread;
    }
    return {
      ...thread,
      sellerId,
      sellerName: pickStr(profile.partnerAName, thread.sellerName),
      partnerUserId: sellerId,
      buyerId,
      buyerName: pickStr(profile.partnerBName, thread.buyerName),
    };
  }

  function resolveProfileForThread(threadOrId) {
    const id = typeof threadOrId === "string" ? threadOrId : pickStr(threadOrId?.id);
    for (const key of DEMO_CATEGORY_ORDER) {
      const plain = buildProfile(key, false);
      const conn = buildProfile(key, true);
      if (id === plain.threadId) return plain;
      if (conn.connect && id === conn.threadId) return conn;
    }

    const thread = readThreadById(threadOrId);
    const Live = global.TasuPlatformChatLiveFlow;
    if (thread && Live?.threadMatchesProfile) {
      for (const key of DEMO_CATEGORY_ORDER) {
        const plain = buildProfile(key, false);
        if (Live.threadMatchesProfile(thread, plain)) return plain;
        const conn = buildProfile(key, true);
        if (conn.connect && Live.threadMatchesProfile(thread, conn)) return conn;
      }
    }
    if (thread) {
      const byListing = resolveProfileForListingThread(thread);
      if (byListing) return byListing;
    }
    return null;
  }

  function isDemoThread(threadOrId) {
    const id = typeof threadOrId === "string" ? threadOrId : pickStr(threadOrId?.id);
    if (DEMO_THREAD_IDS.has(id)) return true;
    return resolveProfileForThread(threadOrId) != null;
  }

  function buildThreadStub(profile) {
    return {
      id: profile.threadId,
      listingId: profile.listingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      source: "chat-dual-window-demo",
    };
  }

  function buildReviewQuery(options) {
    const review = pickStr(options?.review, REVIEW_PARAM);
    const profile = pickStr(options?.profile, getDemoProfileIdFromUrl());
    const state = pickStr(options?.state);
    const parts = [`review=${encodeURIComponent(review)}`, `demoProfile=${encodeURIComponent(profile)}`];
    if (state) parts.push(`${STATE_PARAM}=${encodeURIComponent(state)}`);
    return parts.join("&");
  }

  function appendLiveFlowToUrl(url, profile, userId) {
    const Live = global.TasuPlatformChatLiveFlow;
    if (Live?.isLiveFlowMode?.() && Live?.appendLiveFlowParams) {
      return Live.appendLiveFlowParams(url, profile, { userId: pickStr(userId) });
    }
    return url;
  }

  function resolveActiveThreadIdForProfile(profile) {
    const p = profile?.partnerAId ? profile : getProfile(profile);
    const store = global.TasuChatThreadStore;
    const Live = global.TasuPlatformChatLiveFlow;
    const Fee = global.TasuPlatformChatFee;
    const connectThreadId = p.connect !== true ? pickStr(CATEGORY_BASE?.[p.id]?.connectThreadId) : "";

    if (p.connect !== true && Live?.readBenchPreStartRecord) {
      const pre = Live.readBenchPreStartRecord(p);
      const paidThreadId = pickStr(pre?.thread_id);
      if (paidThreadId) {
        const paid = store?.readAll?.()?.find((t) => String(t.id) === paidThreadId);
        if (paid) return paidThreadId;
      }
    }

    if (store?.readAll) {
      if (p.id === "job" || p.categoryKey === "job") {
        const listingId = pickStr(p.listingId);
        const hireThreads = (store.readAll() || []).filter(
          (t) =>
            String(t.threadKind || "") === "job_hire" &&
            (!listingId || String(t.listingId) === listingId)
        );
        const paidHire = hireThreads.filter((t) => Fee?.isFeePaid?.(t.id));
        if (paidHire.length) return pickStr(paidHire[0].id);
        const activeHire = hireThreads.find((t) => {
          const rs = String(t.roomStatus || t.status || "").toLowerCase();
          return rs === "active" || rs === "open" || rs === "end_requested" || rs === "closed";
        });
        if (activeHire) return pickStr(activeHire.id);
      }
    }

    if (store?.readAll && Live?.threadMatchesProfile) {
      const matches = (store.readAll() || []).filter((t) => {
        if (!Live.threadMatchesProfile(t, p)) return false;
        if (p.connect !== true) {
          if (connectThreadId && String(t.id) === connectThreadId) return false;
          if (pickStr(t.dealId)) return false;
          if (String(t.source || "") === "platform-completion-demo") return false;
        }
        return true;
      });
      const contactThread = matches.find(
        (t) => pickStr(t.contactId) || String(t.source || "") === "listing-contact-paid"
      );
      if (contactThread) return pickStr(contactThread.id);
      const feePaid = matches.filter((t) => Fee?.isFeePaid?.(t.id));
      if (feePaid.length) return pickStr(feePaid[0].id);
      if (matches.length) return pickStr(matches[0].id);
    }
    if (p.connect) {
      const seeded = (store?.readAll?.() || []).find((t) => String(t.id) === String(p.threadId));
      if (seeded) return pickStr(p.threadId);
    }
    return "";
  }

  function chatUrl(profileId, userId, extra) {
    const p = getProfile(profileId, extra?.connect);
    const threadId = pickStr(extra?.threadId, resolveActiveThreadIdForProfile(p));
    if (!threadId) {
      return detailPageUrl(p.id, userId, {
        review: pickStr(extra?.review, REVIEW_PARAM),
        connect: p.connect,
      });
    }
    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", threadId);
    u.searchParams.set("userId", pickStr(userId));
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("review", pickStr(extra?.review, REVIEW_PARAM));
    u.searchParams.set(PROFILE_PARAM, p.id);
    const store = global.TasuChatThreadStore;
    const threadRow =
      (store?.readAll?.() || []).find((row) => String(row.id) === threadId) ||
      store?.findHireThread?.(pickStr(p.listingId), pickStr(extra?.applicationId)) ||
      null;
    const listingId = pickStr(extra?.listingId, threadRow?.listingId, p.listingId);
    let applicationId = pickStr(extra?.applicationId, threadRow?.applicationId);
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
    }
    if (listingId) u.searchParams.set("listingId", listingId);
    if (applicationId) u.searchParams.set("applicationId", applicationId);
    if (p.connect) {
      u.searchParams.set(CONNECT_PARAM, "1");
      u.searchParams.set("platform_connect", p.platformConnect || "1");
      const Category = global.TasuPlatformChatCategoryFlow;
      const listing = {
        id: listingId,
        listing_type: pickStr(threadRow?.listingType, p.listingType),
        title: pickStr(threadRow?.listingTitle, p.listingTitle),
      };
      const connectEntryThread =
        threadRow?.connectEntryPayment === true ||
        Category?.isMarketplaceConnectEntryThread?.(threadRow) === true;
      const connectEntryProfile = Category?.isMarketplaceConnectEntryProfile?.(p) === true;
      if (connectEntryThread || connectEntryProfile) {
        u.searchParams.set("connectEntryPayment", "1");
        u.searchParams.set("entryProfile", pickStr(p.id, p.categoryKey));
      }
    } else {
      u.searchParams.set(CONNECT_PARAM, "0");
    }
    if (extra?.reset) u.searchParams.set(RESET_PARAM, "1");
    if (extra?.state) u.searchParams.set(STATE_PARAM, pickStr(extra.state));
    if (extra?.notify) u.searchParams.set(NOTIFY_PARAM, pickStr(extra.notify));
    if (extra?.from) u.searchParams.set("from", pickStr(extra.from));
    if (extra?.openReview) u.searchParams.set("openReview", pickStr(extra.openReview));
    if (extra?.openReviews) u.searchParams.set("openReviews", pickStr(extra.openReviews));
    if (extra?.reviewerId) u.searchParams.set("reviewerId", pickStr(extra.reviewerId));
    return appendLiveFlowToUrl(`${u.pathname}${u.search}`, p, userId);
  }

  function getSideMeta(profile) {
    const p = profile?.partnerAId ? profile : getProfile(profile);
    const stub = buildThreadStub(p);
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(stub) || {};
    const workerSellerRole =
      p.categoryKey === "worker" ? "ワーカー" : labels.sellerRole || "パートナー A";
    return {
      A: {
        userId: p.partnerAId,
        name: p.partnerAName,
        role: workerSellerRole,
      },
      B: {
        userId: p.partnerBId,
        name: p.partnerBName,
        role: labels.buyerRole || "パートナー B",
      },
    };
  }

  function resolveSideForUserId(profile, userId) {
    const uid = pickStr(userId);
    const sides = getSideMeta(profile);
    if (uid === sides.A.userId) return { side: "A", ...sides.A };
    if (uid === sides.B.userId) return { side: "B", ...sides.B };
    return null;
  }

  function detailPageUrl(profileId, userId, extra) {
    const p = getProfile(profileId, extra?.connect);
    const uid = pickStr(userId);
    const review = pickStr(extra?.review, REVIEW_PARAM);
    const base = global.location?.href || "http://localhost/";
    const side = resolveSideForUserId(p, uid);
    const sideKey = side?.side || (uid === p.partnerAId ? "A" : "B");

    if (p.categoryKey === "job") {
      const u = new URL("detail-job.html", base);
      u.searchParams.set("id", p.listingId);
      u.searchParams.set("userId", uid);
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", review);
      u.searchParams.set(PROFILE_PARAM, p.id);
      if (sideKey === "A") {
        u.searchParams.set("view", "applications");
        return appendLiveFlowToUrl(`${u.pathname}${u.search}#applications`, p, uid);
      }
      return appendLiveFlowToUrl(`${u.pathname}${u.search}`, p, uid);
    }

    const listingType = p.listingType === "shop_store" ? "shop" : p.listingType;
    const path =
      global.TasuListingRouteResolver?.TYPE_ROUTES?.[listingType]?.path ||
      (listingType === "skill"
        ? "detail-skill.html"
        : listingType === "product"
          ? "detail-product.html"
          : listingType === "worker"
            ? "detail-worker.html"
            : listingType === "business_service"
              ? "detail-business-service.html"
              : listingType === "builder"
                ? "deal-detail.html"
                : "detail-general.html");
    const u = new URL(path, base);
    u.searchParams.set("id", p.listingId);
    u.searchParams.set("userId", uid);
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("review", review);
    u.searchParams.set(PROFILE_PARAM, p.id);
    if (p.connect) {
      u.searchParams.set(CONNECT_PARAM, "1");
      u.searchParams.set("platform_connect", p.platformConnect || "1");
    } else if (sideKey === "A" && uid === p.partnerAId) {
      if (extra?.benchManagement) {
        u.searchParams.set("benchManagement", "1");
      }
      const mgmt = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(p.categoryKey) || {};
      const mgmtView = pickStr(mgmt.managementView);
      if (mgmtView) {
        const contactId = getDemoContactId(p);
        if (contactId && mgmtView === "contacts" && !p.connect) {
          u.searchParams.set("contactId", contactId);
        }
        u.searchParams.set("view", mgmtView);
        return appendLiveFlowToUrl(`${u.pathname}${u.search}#${mgmtView}`, p, uid);
      }
    }
    return appendLiveFlowToUrl(`${u.pathname}${u.search}`, p, uid);
  }

  function getDemoContactId(profile) {
    const key = pickStr(profile?.id, profile?.categoryKey);
    return DEMO_CONTACT_IDS[key] || `contact-demo-${key}-001`;
  }

  function getDemoApplicationId(profile) {
    if (pickStr(profile?.id, profile?.categoryKey) === "job") return "job-app-demo-full-001";
    return "";
  }

  function getDemoWorkerRequestId(profile) {
    if (pickStr(profile?.id, profile?.categoryKey) !== "worker") return "";
    const store = global.TasuWorkerRequestsStore;
    const listingId = pickStr(profile?.listingId);
    if (store?.listByWorker && listingId) {
      const rows = store.listByWorker(listingId);
      const match =
        rows.find((r) => String(r.requester_id) === String(profile.partnerBId)) || rows[0];
      if (match?.request_id) return String(match.request_id);
    }
    return "";
  }

  function notifyUrl(profileId, userId, extra) {
    const p = getProfile(profileId, extra?.connect);
    const u = new URL("talk-home.html", global.location?.href || "http://localhost/");
    u.searchParams.set("tab", "notify");
    u.searchParams.set("userId", pickStr(userId));
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("review", pickStr(extra?.review, REVIEW_PARAM));
    u.searchParams.set(PROFILE_PARAM, p.id);
    if (p.connect) {
      u.searchParams.set(CONNECT_PARAM, "1");
      u.searchParams.set("platform_connect", p.platformConnect || "1");
    } else {
      u.searchParams.set(CONNECT_PARAM, "0");
    }
    return appendLiveFlowToUrl(`${u.pathname}${u.search}`, p, userId);
  }

  function buildDualWindowDemoUrls(options) {
    const profileId = normalizeCategoryParam(pickStr(options?.profile, getDemoProfileIdFromUrl()));
    const connect = options?.connect === true || (options?.connect !== false && getDemoConnectFromUrl());
    const p = getProfile(profileId, connect);
    const review = pickStr(options?.review, REVIEW_PARAM);
    const requesterId = p.requesterSide === "B" ? p.partnerBId : p.partnerAId;
    const approverId = p.requesterSide === "B" ? p.partnerAId : p.partnerBId;

    const launcher = (() => {
      const u = new URL("chat-dual-window-demo.html", global.location?.href || "http://localhost/");
      u.searchParams.set("talkDev", "1");
      u.searchParams.set("review", review);
      u.searchParams.set(PROFILE_PARAM, p.id);
      if (p.connect) {
        u.searchParams.set(CONNECT_PARAM, "1");
        u.searchParams.set("platform_connect", p.platformConnect || "1");
      } else {
        u.searchParams.set(CONNECT_PARAM, "0");
      }
      return `${u.pathname}${u.search}`;
    })();

    const sides = getSideMeta(p);
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const article = ensureDemoArticleForProfile(p);
    const buildSide = (key) => {
      const meta = sides[key];
      return {
        side: key,
        role: meta.role,
        userId: meta.userId,
        name: meta.name,
        notify: notifyUrl(p.id, meta.userId, { review, connect: p.connect }),
        chat: chatUrl(p.id, meta.userId, { review, connect: p.connect }),
        detail: detailPageUrl(p.id, meta.userId, { review, connect: p.connect }),
      };
    };
    const sideA = buildSide("A");
    const sideB = buildSide("B");

    return {
      profileId: p.id,
      categoryKey: p.categoryKey,
      profileLabel: p.label,
      connect: p.connect,
      articleListingId: getArticleListingId(p),
      articleTitle: pickStr(article?.title, p.listingTitle),
      articleDetailA: detailPageUrl(p.id, p.partnerAId, { review, connect: p.connect }),
      articleDetailB: detailPageUrl(p.id, p.partnerBId, { review, connect: p.connect }),
      threadId: p.threadId,
      partnerAId: p.partnerAId,
      partnerAName: p.partnerAName,
      partnerBId: p.partnerBId,
      partnerBName: p.partnerBName,
      sideA,
      sideB,
      sides,
      requesterId,
      approverId,
      partnerAChat: sideA.chat,
      partnerBChat: sideB.chat,
      partnerANotify: sideA.notify,
      partnerBNotify: sideB.notify,
      partnerADetail: sideA.detail,
      partnerBDetail: sideB.detail,
      launcher,
    };
  }

  function seedPlainThread(profile) {
    if (profile.categoryKey === "job") {
      global.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.({ force: true });
    }
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const activatedAt = new Date().toISOString();
    const rows = store.readAll();
    const thread = {
      id: profile.threadId,
      chatDomain: "work",
      threadKind: profile.categoryKey === "job" ? "job_hire" : "listing_inquiry",
      listingId: profile.listingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      partnerUserId: profile.partnerAId,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      roomStatus: "active",
      status: "open",
      source: "chat-dual-window-demo",
      lastMessage: getConversationPreview(profile, "purchase"),
      createdAt: activatedAt,
      updatedAt: activatedAt,
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
    };
    if (profile.categoryKey === "job") {
      thread.applicationId = "job-app-demo-full-001";
    }
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (
      Purchase?.createInitialPurchaseThreadFields &&
      global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(profile) === true
    ) {
      const paymentMethod = Purchase.resolvePaymentMethodFromContext?.({
        profile,
        paymentMethod: profile.paymentMethod,
      });
      Object.assign(thread, Purchase.createInitialPurchaseThreadFields(paymentMethod));
    }
    store.writeAll([thread, ...rows.filter((t) => String(t.id) !== profile.threadId)]);
    return thread;
  }

  function seedConnectThread(profile) {
    if (profile.dealId) {
      global.TasuPlatformChatCompletion?.purgeCompletionReportFromThread?.(profile.threadId);
      clearCompletionForDeal(profile.dealId);
    }
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;

    const activatedAt = new Date().toISOString();
    const rows = store.readAll();
    const existing = rows.find((t) => String(t.id) === profile.threadId);
    const thread = {
      ...(existing || {}),
      id: profile.threadId,
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId: profile.listingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      partnerUserId: profile.partnerAId,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      dealId: profile.dealId,
      roomStatus: "active",
      status: "open",
      source: "chat-dual-window-demo",
      lastMessage: "納品物の確認をお願いします。",
      createdAt: existing?.createdAt || activatedAt,
      updatedAt: activatedAt,
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
    };
    store.writeAll([thread, ...rows.filter((t) => String(t.id) !== profile.threadId)]);
    return thread;
  }

  function writeMessages(threadId, messages) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[threadId] = Array.isArray(messages) ? messages : [];
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }

  function partnerFromSide(profile, side) {
    if (side === "B") {
      return { id: profile.partnerBId, name: profile.partnerBName };
    }
    return { id: profile.partnerAId, name: profile.partnerAName };
  }

  function getConversationLinesForScene(profile, sceneKey) {
    const scene = pickStr(sceneKey, "purchase");
    const all = DEMO_ACTIVE_CONVERSATIONS[profile.categoryKey] || [{ side: "A", text: profile.hello }];
    const tail = DEMO_PENDING_TAIL[profile.categoryKey];

    if (PURCHASE_LIKE_SCENES.has(scene)) {
      return all.slice(0, Math.min(2, all.length));
    }
    if (START_LIKE_SCENES.has(scene)) {
      return all.slice(0, all.length);
    }
    if (PRE_REQUEST_SCENES.has(scene)) {
      const lines = [...all];
      if (tail?.text) lines.push(tail);
      return lines;
    }
    if (
      COMPLETE_CARD_SCENES.has(scene) ||
      REVIEW_CARD_SCENES.has(scene) ||
      CONNECT_PAY_SCENES.has(scene) ||
      CONNECT_REFUND_SCENES.has(scene)
    ) {
      const lines = [...all];
      if (tail?.text) lines.push(tail);
      return lines;
    }
    if (CANCEL_SCENES.has(scene)) {
      return all.slice(0, Math.min(2, all.length));
    }
    return all.slice(0, Math.min(2, all.length));
  }

  function getConversationPreview(profile, sceneKey) {
    const lines = getConversationLinesForScene(profile, sceneKey);
    const last = lines[lines.length - 1];
    return pickStr(last?.text, profile.hello);
  }

  function buildConversationTextMessages(threadId, profile, lines) {
    const rows = Array.isArray(lines) && lines.length ? lines : [{ side: "A", text: profile.hello }];
    const baseMs = Date.now() - rows.length * 120000;
    return rows.map((row, index) => {
      const partner = partnerFromSide(profile, row.side);
      return {
        id: `msg-${threadId}-active-${index}`,
        chatId: threadId,
        roomId: threadId,
        senderId: partner.id,
        senderName: partner.name,
        text: row.text,
        createdAt: new Date(baseMs + index * 120000).toISOString(),
        kind: "text",
      };
    });
  }

  function resolveSeedSceneKey() {
    const notifyId = pickStr(readSearchParams().get(NOTIFY_PARAM));
    if (notifyId) {
      return global.TasuPlatformChatDualWindowFlow?.resolveNotifySceneKey?.(notifyId) || "";
    }
    const state = getDemoStateFromUrl();
    if (state === DEMO_STATES.pending) return "complete-request";
    if (state === DEMO_STATES.completed) return "complete";
    if (state === DEMO_STATES.review) return "review";
    if (state === DEMO_STATES.cancelled) return "cancel";
    if (state === DEMO_STATES.connectPay) return "connect-pay";
    if (state === DEMO_STATES.connectRefund) return "connect-refund";
    return "purchase";
  }

  function resolveThreadStateForScene(sceneKey) {
    const scene = pickStr(sceneKey, "purchase");
    if (REVIEW_CARD_SCENES.has(scene)) return DEMO_STATES.review;
    if (COMPLETE_CARD_SCENES.has(scene) || CONNECT_PAY_SCENES.has(scene)) return DEMO_STATES.completed;
    if (CANCEL_SCENES.has(scene)) return DEMO_STATES.cancelled;
    if (CONNECT_REFUND_SCENES.has(scene)) return DEMO_STATES.connectRefund;
    if (PRE_REQUEST_SCENES.has(scene)) return DEMO_STATES.pending;
    return DEMO_STATES.active;
  }

  function hasExplicitDemoSeedInUrl() {
    if (global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true) return false;
    return Boolean(pickStr(readSearchParams().get(STATE_PARAM)) || pickStr(readSearchParams().get(NOTIFY_PARAM)));
  }

  function appendCompletionRequestMessage(base, threadId, profile, threadStub, labels, Flow, now) {
    const requesterId = profile.requesterSide === "B" ? profile.partnerBId : profile.partnerAId;
    const requesterName = profile.requesterSide === "B" ? profile.partnerBName : profile.partnerAName;
    base.push({
      id: `msg-${threadId}-sys-request`,
      chatId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text:
        Flow?.formatCompletionRequestMessage?.(threadStub, requesterName, requesterId) ||
        `${requesterName}さんが${labels.completeBtn || "完了"}を申請しました`,
      createdAt: now,
      kind: "system",
    });
  }

  function appendCompletionDoneMessages(base, threadId, profile, threadStub, labels, Connect, now, sceneKey) {
    const scene = pickStr(sceneKey);
    const doneText = profile.connect
      ? pickStr(labels.reviewPromptTitle, `✓ ${labels.completedNotice}`)
      : pickStr(labels.doneSystem, "取引が完了しました");
    base.push({
      id: `msg-${threadId}-sys-done`,
      chatId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: doneText,
      createdAt: now,
      kind: "system",
    });

    if (CONNECT_PAY_SCENES.has(scene) && profile.connect && Connect?.buildPaymentDoneCardMessage) {
      base.push(Connect.buildPaymentDoneCardMessage(threadId, threadStub));
      return;
    }

    if (profile.connect && Connect?.buildPaymentDoneCardMessage && !CONNECT_PAY_SCENES.has(scene)) {
      base.push(Connect.buildPaymentDoneCardMessage(threadId, threadStub));
      return;
    }

    if (profile.categoryKey === "job") {
      base.push({
        id: `msg-${threadId}-job-completion-card`,
        chatId: threadId,
        roomId: threadId,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: now,
        kind: "job_completion_card",
        jobCompletionCard: {
          cardTitle: labels.completionCardTitle,
          jobTitle: profile.listingTitle,
          guide: labels.completionCardGuide,
          completedAt: now,
        },
      });
      return;
    }

    base.push({
      id: `msg-${threadId}-platform-completion-card`,
      chatId: threadId,
      roomId: threadId,
      senderId: "__system__",
      senderName: "TASFUL",
      text: "",
      createdAt: now,
      kind: "platform_completion_card",
      platformCompletionCard: {
        cardTitle: labels.completionCardTitle,
        listingTitle: profile.listingTitle,
        guide: labels.completionCardGuide,
        completedAt: now,
        categoryKey: profile.categoryKey,
      },
    });
  }

  function resetThreadMessages(threadId, profile, state, sceneKey) {
    const now = new Date().toISOString();
    const scene = pickStr(sceneKey, resolveSeedSceneKey(), "purchase");
    const threadStub = buildThreadStub(profile);
    const labels = global.TasuPlatformChatCategoryFlow?.getLabels?.(threadStub) || {};
    const base = buildConversationTextMessages(
      threadId,
      profile,
      getConversationLinesForScene(profile, scene)
    );
    const Connect = global.TasuPlatformChatConnectChatFlow;
    const Cancel = global.TasuPlatformChatCancelFlow;
    const Flow = global.TasuPlatformChatCompletionFlow;

    if (COMPLETE_CARD_SCENES.has(scene) || REVIEW_CARD_SCENES.has(scene) || CONNECT_PAY_SCENES.has(scene)) {
      appendCompletionRequestMessage(base, threadId, profile, threadStub, labels, Flow, now);
      if (profile.connect && Connect?.appendConnectRequestFollowUpMessages) {
        Connect.appendConnectRequestFollowUpMessages(threadId, { skipWrite: true, messages: base });
      }
      appendCompletionDoneMessages(base, threadId, profile, threadStub, labels, Connect, now, scene);
    }

    if (CONNECT_REFUND_SCENES.has(scene)) {
      appendCompletionRequestMessage(base, threadId, profile, threadStub, labels, Flow, now);
      if (profile.connect && Connect?.buildPendingApprovalCardMessage) {
        base.push(Connect.buildPendingApprovalCardMessage(threadId, threadStub));
      }
      base.push({
        id: `msg-${threadId}-sys-connect-cancel`,
        chatId: threadId,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "やりとりをキャンセルしました",
        createdAt: now,
        kind: "system",
      });
      if (Connect?.buildRefundDoneCardMessage) {
        base.push(Connect.buildRefundDoneCardMessage(threadId));
      }
    }

    if (CANCEL_SCENES.has(scene)) {
      base.push({
        id: `msg-${threadId}-sys-cancel`,
        chatId: threadId,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "取引がキャンセルされました。理由：条件不一致",
        createdAt: now,
        kind: "system",
      });
    }

    if (PRE_REQUEST_SCENES.has(scene)) {
      appendCompletionRequestMessage(base, threadId, profile, threadStub, labels, Flow, now);
      if (profile.connect && Connect?.appendConnectRequestFollowUpMessages) {
        Connect.appendConnectRequestFollowUpMessages(threadId, { skipWrite: true, messages: base });
      }
      if (Connect?.buildPendingApprovalCardMessage) {
        base.push(Connect.buildPendingApprovalCardMessage(threadId, threadStub));
      }
    }

    writeMessages(threadId, base);
  }

  function patchThreadState(profile, state) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const requesterId = profile.requesterSide === "B" ? profile.partnerBId : profile.partnerAId;
    const approverId = profile.requesterSide === "B" ? profile.partnerAId : profile.partnerBId;
    const now = new Date().toISOString();
    let patch = {
      roomStatus: "active",
      status: "open",
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
      updatedAt: now,
    };

    if (state === "pending") {
      patch = {
        ...patch,
        roomStatus: "completion_pending",
        completionRequestedBy: requesterId,
        completionRequestedAt: now,
      };
    } else if (state === "completed" || state === "review" || state === "reviewed" || state === "connect-pay") {
      patch = {
        ...patch,
        roomStatus: "completed",
        status: "completed",
        completionRequestedBy: requesterId,
        completionRequestedAt: now,
        completionApprovedBy: approverId,
        completedAt: now,
      };
    } else if (state === "connect-refund") {
      patch = {
        ...patch,
        roomStatus: "cancelled",
        status: "cancelled",
        completionRequestedBy: requesterId,
        completionRequestedAt: now,
        cancelledBy: profile.partnerAId,
        cancelReason: "条件不一致",
        cancelledAt: now,
      };
    } else if (state === "cancelled") {
      patch = {
        ...patch,
        roomStatus: "cancelled",
        status: "cancelled",
        cancelledBy: profile.partnerAId,
        cancelReason: "条件不一致",
        cancelledAt: now,
      };
    }

    const list = store.readAll().map((t) =>
      String(t.id) === profile.threadId ? { ...t, ...patch } : t
    );
    store.writeAll(list);
    global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
    return list.find((t) => String(t.id) === profile.threadId) || null;
  }

  function seedDemoReviewSubmitted(threadId, userId) {
    const id = pickStr(threadId);
    const me = pickStr(userId);
    if (!id || !me) return;
    try {
      const raw = global.localStorage.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      const reviews = Array.isArray(seed.reviews) ? seed.reviews : [];
      if (!reviews.some((row) => String(row.room_id) === id && String(row.reviewer_id) === me)) {
        reviews.push({
          room_id: id,
          reviewer_id: me,
          rating: 5,
          created_at: new Date().toISOString(),
        });
      }
      seed.reviews = reviews;
      global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
    } catch {
      /* ignore */
    }
  }

  function mapStateToScene(state) {
    const s = pickStr(state, DEMO_STATES.active);
    if (s === DEMO_STATES.pending) return "complete-request";
    if (s === DEMO_STATES.completed) return "complete";
    if (s === DEMO_STATES.review) return "review";
    if (s === DEMO_STATES.cancelled) return "cancel";
    if (s === DEMO_STATES.connectPay) return "connect-pay";
    if (s === DEMO_STATES.connectRefund) return "connect-refund";
    if (s === DEMO_STATES.active) return "purchase";
    return "purchase";
  }

  function removeDemoThreadFromStore(threadId) {
    const id = pickStr(threadId);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.readAll || !store?.writeAll) return;
    store.writeAll((store.readAll() || []).filter((t) => String(t.id) !== id));
    writeMessages(id, []);
  }

  function clearFeeRecordForThread(threadId) {
    const id = pickStr(threadId);
    if (!id) return;
    try {
      const feeKey = global.TasuPlatformChatFee?.STORAGE_KEY || "tasful_platform_chat_fees_v1";
      const raw = global.localStorage.getItem(feeKey);
      const fees = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(fees)) return;
      global.localStorage.setItem(
        feeKey,
        JSON.stringify(fees.filter((row) => pickStr(row.threadId, row.thread_id) !== id))
      );
    } catch {
      /* ignore */
    }
  }

  function clearCompletionForDeal(dealId) {
    const id = pickStr(dealId);
    if (!id) return;
    try {
      const raw = global.localStorage.getItem("tasful_platform_completion_v1");
      const map = raw ? JSON.parse(raw) : {};
      if (map && typeof map === "object" && map[id]) {
        delete map[id];
        global.localStorage.setItem("tasful_platform_completion_v1", JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }
  }

  function clearReviewsForThread(threadId) {
    const id = pickStr(threadId);
    if (!id) return;
    try {
      const raw = global.localStorage.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(seed.reviews)) return;
      seed.reviews = seed.reviews.filter((row) => String(row.room_id) !== id);
      global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
    } catch {
      /* ignore */
    }
  }

  function clearJobApplicationsForListing(listingId) {
    const lid = pickStr(listingId);
    if (!lid) return;
    try {
      const raw = global.localStorage.getItem("tasful_job_applications_v1");
      const apps = raw ? JSON.parse(raw) : [];
      const next = (Array.isArray(apps) ? apps : []).filter((a) => String(a.job_id) !== lid);
      global.localStorage.setItem("tasful_job_applications_v1", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function seedJobPreStart(profile) {
    const listingId = profile.listingId;
    removeDemoThreadFromStore(profile.threadId);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    try {
      global.localStorage.removeItem("tasful_job_full_flow_demo_v1");
    } catch {
      /* ignore */
    }
    const row = {
      application_id: "job-app-demo-full-001",
      job_id: listingId,
      applicant_id: profile.partnerBId,
      applicant_name: profile.partnerBName,
      status: "applied",
      memo: "ポートフォリオ添付済み。平日夜と土日対応可。",
      created_at: new Date().toISOString(),
      thread_id: null,
    };
    try {
      const raw = global.localStorage.getItem("tasful_job_applications_v1");
      const apps = raw ? JSON.parse(raw) : [];
      const next = [
        row,
        ...(Array.isArray(apps) ? apps : []).filter((a) => String(a.job_id) !== listingId),
      ];
      global.localStorage.setItem("tasful_job_applications_v1", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function clearContactRequestPreStart(profile) {
    removeDemoThreadFromStore(profile.threadId);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    if (profile.dealId) clearCompletionForDeal(profile.dealId);
    try {
      const listingId = pickStr(profile.listingId);
      const key = "tasful_listing_contact_requests_v1";
      const raw = global.localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.listing_id) !== listingId
      );
      global.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function seedContactRequestPreStart(profile, contactKind) {
    clearContactRequestPreStart(profile);

    const contactId = getDemoContactId(profile);
    const kind = pickStr(contactKind, "purchase");
    const row = {
      contact_id: contactId,
      listing_id: profile.listingId,
      listing_type: profile.listingType,
      requester_id: profile.partnerBId,
      requester_name: profile.partnerBName,
      contact_kind: kind,
      product_name: pickStr(profile.listingTitle),
      status: "applied",
      memo: "",
      thread_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const key = "tasful_listing_contact_requests_v1";
      const raw = global.localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = [
        row,
        ...(Array.isArray(list) ? list : []).filter(
          (r) => String(r.listing_id) !== String(profile.listingId)
        ),
      ];
      global.localStorage.setItem(key, JSON.stringify(next));
      global.dispatchEvent(
        new CustomEvent("tasu:listing-contacts-changed", { detail: { listing: { id: profile.listingId } } })
      );
    } catch {
      /* ignore */
    }

    return row;
  }

  function seedWorkerPreStart(profile) {
    removeDemoThreadFromStore(profile.threadId);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    try {
      const wid = pickStr(profile.listingId);
      const raw = global.localStorage.getItem("tasful_worker_requests_v1");
      const list = raw ? JSON.parse(raw) : [];
      const next = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.worker_id) !== wid && String(r.worker_id) !== "demo-worker-001"
      );
      global.localStorage.setItem("tasful_worker_requests_v1", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function isMarketplaceConnectEntryPreStartProfile(profile) {
    return global.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryProfile?.(profile) === true;
  }

  function seedMarketplaceConnectEntryPreStart(profile, contactKind) {
    void contactKind;
    removeDemoThreadFromStore(profile.threadId);
    writeMessages(profile.threadId, []);
    global.TasuPlatformChatCompletion?.purgeCompletionReportFromThread?.(profile.threadId);
    if (profile.dealId) clearCompletionForDeal(profile.dealId);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    clearContactRequestPreStart(profile);
    return { ok: true, awaitingConnectEntryPayment: true };
  }

  function seedPlainPurchasePreStart(profile, contactKind) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const activatedAt = new Date().toISOString();
    const kind = pickStr(contactKind, "purchase");
    const isWorker =
      global.TasuPlatformChatCategoryFlow?.isWorkerFlowCategory?.(profile.categoryKey || profile.id) ===
      true;
    const thread = {
      id: profile.threadId,
      chatDomain: "work",
      threadKind: isWorker ? "worker_request" : "listing_inquiry",
      listingId: profile.listingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      partnerUserId: profile.partnerAId,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      roomStatus: "active",
      status: "open",
      source: "chat-dual-window-demo",
      platformContactKind: kind,
      lastMessage: getConversationPreview(profile, kind === "inquiry" ? "inquiry" : "purchase"),
      createdAt: activatedAt,
      updatedAt: activatedAt,
      activatedAt,
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
      productShipped: false,
      productShippedAt: "",
    };
    if (profile.connect === true) {
      const listing = {
        id: profile.listingId,
        listing_type: profile.listingType,
        title: profile.listingTitle,
        price_amount: profile.priceAmount,
      };
      const entryPatch =
        global.TasuPlatformChatConnectEntryFlow?.applyConnectEntryThreadPatch?.(thread, listing) ||
        thread;
      Object.assign(thread, entryPatch);
    }
    store.writeAll([thread, ...(store.readAll() || []).filter((t) => String(t.id) !== profile.threadId)]);
    writeMessages(profile.threadId, []);
    global.TasuPlatformChatCompletion?.purgeCompletionReportFromThread?.(profile.threadId);
    if (profile.dealId) clearCompletionForDeal(profile.dealId);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (
      Purchase?.createInitialPurchaseThreadFields &&
      global.TasuPlatformChatCategoryFlow?.isProductPurchaseFlowEnabled?.(profile) === true
    ) {
      const paymentMethod = Purchase.resolvePaymentMethodFromContext?.({
        profile,
        paymentMethod: profile.paymentMethod,
      });
      const list = store.readAll();
      const idx = list.findIndex((t) => String(t.id) === profile.threadId);
      if (idx >= 0) {
        Object.assign(list[idx], Purchase.createInitialPurchaseThreadFields(paymentMethod));
        if (profile.connect === true) {
          const now = pickStr(list[idx].connectEntryPaidAt, list[idx].activatedAt, activatedAt);
          list[idx].paymentConfirmed = true;
          list[idx].paymentConfirmedAt = now;
        }
        store.writeAll(list);
        return list[idx];
      }
    }
    return thread;
  }

  function seedFeePendingThread(profile, contactKind) {
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const activatedAt = new Date().toISOString();
    const kind = pickStr(contactKind, "purchase");
    const thread = {
      id: profile.threadId,
      chatDomain: "work",
      threadKind:
        global.TasuPlatformChatCategoryFlow?.isWorkerFlowCategory?.(profile.categoryKey) === true
          ? "worker_request"
          : "listing_inquiry",
      listingId: profile.listingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      partnerUserId: profile.partnerAId,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      roomStatus: "fee_pending",
      status: "fee_pending",
      source: "chat-dual-window-demo",
      platformStartPhase: "awaiting_partner",
      platformContactKind: kind,
      lastMessage: getConversationPreview(profile, kind === "inquiry" ? "inquiry" : "purchase"),
      createdAt: activatedAt,
      updatedAt: activatedAt,
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
      productShipped: false,
      productShippedAt: "",
    };
    if (profile.dealId) thread.dealId = profile.dealId;
    store.writeAll([thread, ...(store.readAll() || []).filter((t) => String(t.id) !== profile.threadId)]);
    writeMessages(profile.threadId, []);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    try {
      global.TasuPlatformChatFee?.ensurePendingFee?.(
        { id: profile.listingId, listing_type: profile.listingType, title: profile.listingTitle },
        thread,
        { feeAmount: 550 }
      );
    } catch {
      /* ignore */
    }
    return thread;
  }

  function seedConnectPreStart(profile, phase) {
    if (profile.dealId) {
      global.TasuPlatformChatCompletion?.purgeCompletionReportFromThread?.(profile.threadId);
      clearCompletionForDeal(profile.dealId);
    }
    const store = global.TasuChatThreadStore;
    if (!store?.readAll || !store?.writeAll) return null;
    const activatedAt = new Date().toISOString();
    const sceneKey = pickStr(phase, "purchase");
    const connectListingId = pickStr(profile.connectListingId, profile.dealId, profile.listingId);
    const thread = {
      id: profile.threadId,
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId: connectListingId,
      listingType: profile.listingType,
      listingTitle: profile.listingTitle,
      category: profile.category,
      sellerId: profile.partnerAId,
      sellerName: profile.partnerAName,
      partnerUserId: profile.partnerAId,
      buyerId: profile.partnerBId,
      buyerName: profile.partnerBName,
      dealId: profile.dealId,
      roomStatus: "active",
      status: "open",
      source: "chat-dual-window-demo",
      lastMessage: getConversationPreview(profile, sceneKey),
      createdAt: activatedAt,
      updatedAt: activatedAt,
      completionRequestedBy: "",
      completionRequestedAt: "",
      completionApprovedBy: "",
      completedAt: "",
      cancelReason: "",
      cancelledBy: "",
      cancelledAt: "",
      cancelRequestStatus: "",
      cancelRequestedBy: "",
      cancelRequestReason: "",
      cancelRequestedAt: "",
      productShipped: false,
      productShippedAt: "",
    };
    store.writeAll([thread, ...(store.readAll() || []).filter((t) => String(t.id) !== profile.threadId)]);
    resetThreadMessages(profile.threadId, profile, DEMO_STATES.active, sceneKey);
    clearFeeRecordForThread(profile.threadId);
    clearReviewsForThread(profile.threadId);
    return thread;
  }

  function getArticleListingId(profile) {
    return pickStr(profile?.articleListingId, profile?.listingId);
  }

  function resolveDemoArticleRow(profile) {
    const id = getArticleListingId(profile);
    const catalog = global.TasuListingDemoCatalog;
    if (!id || !catalog) return null;
    const key = profile?.categoryKey || profile?.id;
    if (key === "shop_store" || key === "shop") {
      return catalog.getShopStoreListing?.(id) || null;
    }
    if (key === "business_service" || key === "business") {
      return catalog.getFieldServiceListing?.(id) || null;
    }
    return catalog.getStoreListing?.(id) || null;
  }

  function persistDemoArticleToLocalStore(row, profile) {
    const id = pickStr(row?.id, getArticleListingId(profile));
    if (!id || !row) return { ok: false, reason: "missing_row" };
    try {
      const key = "tasful_listings";
      const raw = global.localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const ownerId = pickStr(profile?.partnerAId, row.user_id, row.seller_user_id);
      const normalized = {
        ...row,
        id,
        user_id: ownerId,
        seller_user_id: pickStr(row.seller_user_id, ownerId),
        listingType: row.listing_type || row.listingType || row.type,
        listing_type: row.listing_type || row.listingType || row.type,
        imageUrl: row.image_url || row.imageUrl || row.thumbnail_url || row.image,
        priceLabel: row.priceLabel || row.price_label || "",
        status: row.status || row.publish_status || "active",
        publish_status: row.publish_status || "public",
        source: "chat-dual-window-demo",
        updatedAt: new Date().toISOString(),
      };
      const next = [
        normalized,
        ...(Array.isArray(list) ? list : []).filter((item) => String(item?.id) !== id),
      ];
      global.localStorage.setItem(key, JSON.stringify(next));
      global.dispatchEvent?.(new CustomEvent("tasu:listings-updated", { detail: { key } }));
      return { ok: true, id, title: pickStr(row.title, profile?.listingTitle) };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function ensureDemoArticleForProfile(profile) {
    const row = resolveDemoArticleRow(profile);
    if (!row) {
      return { ok: false, reason: "missing_catalog_row", id: getArticleListingId(profile) };
    }
    return persistDemoArticleToLocalStore(row, profile);
  }

  function buildArticleDetailUrl(profile, userId, extra) {
    return detailPageUrl(profile?.id, userId, {
      review: REVIEW_PARAM,
      connect: profile?.connect,
      ...(extra || {}),
    });
  }

  function seedPreStartDemoState(profile, options) {
    const opts = options || {};
    ensureDemoArticleForProfile(profile);
    if (opts.benchPrePurchase === true && profile.connect !== true) {
      return { ok: true, mode: "bench_initial" };
    }
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const initialSpec = Flow?.getInitialNotifySpec?.(profile);
    const phase = pickStr(initialSpec?.phase, "purchase");

    if (profile.categoryKey === "job") {
      seedJobPreStart(profile);
      return { ok: true, mode: "job_apply" };
    }
    if (
      global.TasuPlatformChatCategoryFlow?.isConnectRequiredCategory?.(
        profile.categoryKey || profile.id
      ) &&
      profile.connect !== true
    ) {
      const flowKey = global.TasuPlatformChatDualWindowFlow?.normalizeFlowCategoryKey?.(
        profile.categoryKey || profile.id
      );
      const contactKind = flowKey === "shop" ? "inquiry" : "consult";
      seedContactRequestPreStart(profile, contactKind);
      return { ok: true, mode: "connect_required_inquiry" };
    }
    if (profile.connect) {
      if (global.TasuPlatformChatCategoryFlow?.isShopStoreCategory?.(profile.categoryKey || profile.id)) {
        clearContactRequestPreStart(profile);
        removeDemoThreadFromStore(profile.threadId);
        clearFeeRecordForThread(profile.threadId);
        clearReviewsForThread(profile.threadId);
        return { ok: true, mode: "shop_purchase_bench_initial" };
      }
      if (isMarketplaceConnectEntryPreStartProfile(profile)) {
        const contactKind =
          phase === "inquiry"
            ? "inquiry"
            : phase === "consult" || phase === "request"
              ? "consult"
              : "purchase";
        clearContactRequestPreStart(profile);
        seedMarketplaceConnectEntryPreStart(profile, contactKind);
        return { ok: true, mode: "marketplace_connect_pre_start" };
      }
      seedConnectPreStart(profile, phase);
      return { ok: true, mode: "connect_pre_start" };
    }
    const contactKind =
      phase === "inquiry"
        ? "inquiry"
        : phase === "consult" || phase === "request"
          ? "consult"
          : "purchase";
    if (global.TasuPlatformChatCategoryFlow?.isWorkerFlowCategory?.(profile.categoryKey || profile.id)) {
      seedWorkerPreStart(profile);
    }
    seedContactRequestPreStart(profile, contactKind);
    return { ok: true, mode: "contact_request" };
  }

  function ensureInitialDemoChainState(profileOrOptions, options) {
    const opts = profileOrOptions?.threadId ? options || {} : profileOrOptions || {};
    const profile =
      profileOrOptions?.threadId || profileOrOptions?.partnerAId
        ? profileOrOptions
        : getProfile(opts.profile, opts.connect);
    const Flow = global.TasuPlatformChatDualWindowFlow;
    if (!profile || !Flow) return { ok: false, reason: "missing_profile" };

    const article = ensureDemoArticleForProfile(profile);

    if (opts.benchPrePurchase === true && profile.connect !== true) {
      // job-0 ベンチ: 応募レコードが無いと 550円→notifyJobHiredToApplicant まで到達しない
      if (pickStr(profile.id, profile.categoryKey) === "job") {
        seedJobPreStart(profile);
      }
      return {
        ok: true,
        mode: "bench_initial",
        profile,
        threadId: profile.threadId,
        article,
      };
    }

    if (
      !opts.force &&
      (Flow.profileThreadIsMidFlow?.(profile) || Flow.profileHasMidFlowNotifications?.(profile))
    ) {
      return { ok: true, skipped: true, reason: "mid_flow", article };
    }

    const seedResult = seedPreStartDemoState(profile);
    if (
      seedResult?.mode !== "shop_purchase_bench_initial" &&
      seedResult?.mode !== "marketplace_connect_pre_start"
    ) {
      Flow.syncInitialDemoNotification?.(profile, { force: opts.force === true });
    }
    return {
      ok: true,
      mode: seedResult?.mode,
      profile,
      threadId: profile.threadId,
      initialNotifyId:
        seedResult?.mode === "shop_purchase_bench_initial"
          ? null
          : Flow.getInitialNotifyId?.(profile),
    };
  }

  function resetDemoCategory(options) {
    return global.TasuPlatformChatLiveFlow?.resetLiveFlow?.(options) || { ok: false };
  }

  function resetAllDemoCategories() {
    return global.TasuPlatformChatLiveFlow?.resetAllDemoCategories?.() || { ok: false };
  }

  function resetDemoState(options) {
    const profile = getProfile(options?.profile, options?.connect);
    const state = pickStr(options?.state, DEMO_STATES.active);
    const sceneKey = pickStr(options?.scene, mapStateToScene(state));
    const threadState = resolveThreadStateForScene(sceneKey);
    if (state !== DEMO_STATES.preStart) {
      if (profile.connect) seedConnectThread(profile);
      else seedPlainThread(profile);
      resetThreadMessages(profile.threadId, profile, threadState, sceneKey);
      patchThreadState(profile, threadState);
      if (state === DEMO_STATES.reviewed) {
        seedDemoReviewSubmitted(profile.threadId, profile.partnerBId);
        seedDemoReviewSubmitted(profile.threadId, profile.partnerAId);
      }
    }
    try {
      global.localStorage.setItem(MARKER, JSON.stringify({ profile: profile.id, state, at: Date.now() }));
    } catch {
      /* ignore */
    }
    return { ok: true, profile, state, threadId: profile.threadId };
  }

  function resolveAutoSeedState() {
    if (!isChatDemoReviewFromUrl()) return DEMO_STATES.active;
    const state = getDemoStateFromUrl();
    if (!state || state === DEMO_STATES.preStart || state === DEMO_STATES.notify) {
      return DEMO_STATES.active;
    }
    return state;
  }

  function ensureDemoThreadForAccess(threadId) {
    const id = pickStr(threadId);
    if (!id || !isDemoThread(id)) {
      return { ok: false, reason: "not_demo_thread", threadId: id };
    }

    const store = global.TasuChatThreadStore;
    if (!store?.readAll) {
      return { ok: false, reason: "missing_store", threadId: id };
    }

    const profile = resolveProfileForThread(id);
    if (!profile) {
      return { ok: false, reason: "profile_not_found", threadId: id };
    }

    const existing = store.readAll().find((t) => String(t.id) === id);
    const messages = existing ? (store.getMessages?.(id) || []) : [];
    const liveFlow = global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true;
    const shouldReseed = isChatDemoReviewFromUrl() && hasExplicitDemoSeedInUrl();

    if (existing && !shouldReseed) {
      return { ok: true, thread: existing };
    }

    if (liveFlow) {
      if (existing) return { ok: true, thread: existing };
      const profile = resolveProfileForThread(id);
      if (profile) {
        const benchEmbed = global.TasuTalkChatDemoReviewMode?.isBenchEmbedMode?.() === true;
        ensureInitialDemoChainState(profile, {
          force: false,
          benchPrePurchase: benchEmbed && liveFlow && profile.connect !== true,
        });
      }
      const seeded = store.readAll().find((t) => String(t.id) === id);
      return seeded
        ? { ok: true, thread: seeded, seeded: true }
        : { ok: false, reason: "no_thread_yet", threadId: id };
    }

    if (!isChatDemoReviewFromUrl()) {
      return existing
        ? { ok: true, thread: existing }
        : { ok: false, reason: "review_required", threadId: id };
    }

    const sceneKey = resolveSeedSceneKey();
    const threadState = resolveThreadStateForScene(sceneKey);
    if (profile.categoryKey === "job") {
      global.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.({ force: shouldReseed });
    }
    if (profile.connect) seedConnectThread(profile);
    else seedPlainThread(profile);
    resetThreadMessages(profile.threadId, profile, threadState, sceneKey);
    patchThreadState(profile, threadState);
    const list = store.readAll().map((t) =>
      String(t.id) === profile.threadId
        ? {
            ...t,
            lastMessage: getConversationPreview(profile, sceneKey),
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    store.writeAll(list);

    const seeded = store.readAll().find((t) => String(t.id) === id);
    return seeded
      ? { ok: true, thread: seeded, seeded: true }
      : { ok: false, reason: "seed_failed", threadId: id };
  }

  function maybeResetFromUrl() {
    if (!isChatDemoReviewFromUrl()) return;
    // 2窓ベンチ親は bootBenchFromUrl が reset を担当
    if (/chat-dual-window-demo\.html$/i.test(String(global.location?.pathname || ""))) return;
    const params = readSearchParams();
    const shouldReset =
      params.get(RESET_PARAM) === "1" ||
      params.get("jobFullReset") === "1" ||
      params.get(global.TasuPlatformChatLiveFlow?.LIVE_FLOW_RESET_PARAM || "liveFlowReset") === "1";
    if (!shouldReset) return;
    const profileId = getDemoProfileIdFromUrl();
    const connect = getDemoConnectFromUrl();
    if (global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true) {
      global.TasuPlatformChatLiveFlow.resetLiveFlow({ profile: profileId, connect });
    } else {
      const state = getDemoStateFromUrl();
      if (state === DEMO_STATES.preStart) return;
      resetDemoState({
        profile: profileId,
        state: state === DEMO_STATES.active ? DEMO_STATES.active : state,
        connect,
      });
    }
    try {
      params.delete(RESET_PARAM);
      params.delete("jobFullReset");
      params.delete(global.TasuPlatformChatLiveFlow?.LIVE_FLOW_RESET_PARAM || "liveFlowReset");
      const next = `${global.location.pathname}?${params.toString()}${global.location.hash}`;
      global.history.replaceState(null, "", next);
    } catch {
      /* ignore */
    }
  }

  function shouldShowReviewPrompt(thread, userId) {
    return false;
  }

  function hasUserSubmittedReview(threadId, userId) {
    return global.TasuPlatformChatCategoryFlow?.hasUserSubmittedReview?.(threadId, userId) === true;
  }

  function renderReviewPromptCardHtml(threadOrOptions, options) {
    const thread =
      threadOrOptions && typeof threadOrOptions === "object" && threadOrOptions.id
        ? threadOrOptions
        : resolveProfileForThread(global.TasuPlatformChatDualWindowDemo?.getActiveThreadId?.()) ||
          buildThreadStub(getProfile());
    const opts = options || (threadOrOptions && !threadOrOptions.id ? threadOrOptions : {});
    return (
      global.TasuPlatformChatCategoryFlow?.renderReviewPromptCardHtml?.(thread, opts) || ""
    );
  }

  function getActiveThreadId() {
    return resolveActiveThreadIdForProfile(getProfile());
  }

  global.TasuPlatformChatDualWindowDemo = {
    REVIEW_PARAM,
    LEGACY_REVIEW_PARAM,
    RESET_PARAM,
    PROFILE_PARAM,
    CONNECT_PARAM,
    STATE_PARAM,
    NOTIFY_PARAM,
    DEMO_STATES,
    DEMO_CATEGORY_ORDER,
    CATEGORY_BASE,
    PROFILES,
    DEMO_THREAD_IDS,
    isChatDemoReviewFromUrl,
    getDemoProfileIdFromUrl,
    getDemoConnectFromUrl,
    getDemoStateFromUrl,
    getProfile,
    buildProfile,
    isDemoThread,
    resolveProfileForThread,
    resolveProfileForListingThread,
    resolveBenchPartnerIds,
    normalizeThreadPartnerIdsForBench,
    resolveActiveThreadIdForProfile,
    buildThreadStub,
    buildReviewQuery,
    buildDualWindowDemoUrls,
    getSideMeta,
    resolveSideForUserId,
    detailPageUrl,
    chatUrl,
    notifyUrl,
    resetDemoState,
    resetDemoCategory,
    resetAllDemoCategories,
    getArticleListingId,
    ensureDemoArticleForProfile,
    buildArticleDetailUrl,
    DEMO_CONTACT_IDS,
    getDemoContactId,
    getDemoApplicationId,
    getDemoWorkerRequestId,
    seedContactRequestPreStart,
    clearContactRequestPreStart,
    ensureInitialDemoChainState,
    seedPreStartDemoState,
    ensureDemoThreadForAccess,
    buildNotifyRowsForProfile: (...args) =>
      global.TasuPlatformChatDualWindowFlow?.buildNotifyRowsForProfile?.(...args),
    maybeResetFromUrl,
    shouldShowReviewPrompt,
    hasUserSubmittedReview,
    renderReviewPromptCardHtml,
    getActiveThreadId,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", maybeResetFromUrl);
  } else {
    maybeResetFromUrl();
  }
})(typeof window !== "undefined" ? window : globalThis);
