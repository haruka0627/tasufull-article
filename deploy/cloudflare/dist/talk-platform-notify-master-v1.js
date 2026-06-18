/**
 * TASFUL TALK — プラット通知マスター v3（全カテゴリ検証シード）
 *
 * 通知カード = タイトル + 求人概要 + 確認する
 * 通知タブ + TASFUL TALK（公式ルーム）両方へ配信
 */
(function (global) {
  "use strict";

  const SOURCE = "platform_master_v1";
  const VERSION = "v3.8";

  /** @type {Record<string, { tone: string }>} */
  const PLATFORM_CATEGORY_META = Object.freeze({
    求人: { tone: "green" },
    ワーカー: { tone: "violet" },
    スキル: { tone: "indigo" },
    商品: { tone: "sky" },
    業務サービス: { tone: "teal" },
    店舗販売: { tone: "amber" },
    Builder: { tone: "slate" },
    安否: { tone: "rose" },
    AI: { tone: "purple" },
    公式: { tone: "gold" },
    運営: { tone: "slate" },
  });

  const CATEGORY_TYPE_MAP = Object.freeze({
    求人: "job",
    ワーカー: "worker",
    スキル: "skill",
    商品: "product",
    業務サービス: "business",
    店舗販売: "shop",
    Builder: "builder",
    安否: "anpi",
    AI: "ai",
    公式: "system",
    運営: "system",
  });

  const VERIFY_IDS = Object.freeze([
    "platform-verify-job-full-apply-001",
    "platform-verify-job-full-poster-start-001",
    "platform-verify-job-full-applicant-start-001",
    "platform-verify-job-full-complete-request-001",
    "platform-verify-job-full-complete-001",
    "platform-verify-job-full-review-001",
    "platform-verify-chat-demo-connect-start-a-001",
    "platform-verify-chat-demo-connect-start-b-001",
    "platform-verify-chat-demo-connect-request-001",
    "platform-verify-chat-demo-connect-complete-001",
    "platform-verify-chat-demo-connect-review-001",
    "platform-verify-worker-request-001",
    "platform-verify-worker-accept-001",
    "platform-verify-skill-consult-001",
    "platform-verify-skill-purchase-001",
    "platform-verify-product-inquiry-001",
    "platform-verify-product-purchase-001",
    "platform-verify-business-consult-001",
    "platform-verify-shop-inquiry-001",
    "platform-verify-shop-purchase-001",
    "platform-verify-skill-connect-complete-001",
    "platform-verify-product-connect-complete-001",
    "platform-verify-worker-connect-complete-001",
    "platform-verify-business-connect-complete-001",
    "platform-verify-shop-connect-complete-001",
    "platform-verify-builder-publish-001",
    "platform-verify-builder-hired-001",
    "platform-verify-builder-completion-001",
    "platform-verify-anpi-001",
    "platform-verify-ai-001",
    "platform-verify-official-001",
    "platform-verify-system-001",
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function withTalkDelivery(row) {
    const category = String(row.category || "");
    let sendTalkMessage = row.sendTalkMessage !== false;
    let officialRoomId = pickStr(row.officialRoomId) || null;
    if (!officialRoomId && sendTalkMessage) {
      if (category === "安否" || row.type === "anpi") officialRoomId = "official_anpi";
      else if (category === "運営" || category === "公式") officialRoomId = "official_tasful";
      else officialRoomId = "official_platform";
    }
    if (!sendTalkMessage) officialRoomId = null;
    const attached = global.TasuTalkOfficialRooms?.attachTalkFields?.({
      ...row,
      sendTalkMessage,
      officialRoomId,
    });
    if (attached) {
      return {
        ...row,
        sendNotification: attached.sendNotification !== false,
        sendTalkMessage: attached.sendTalkMessage === true,
        officialRoomId: attached.sendTalkMessage ? pickStr(attached.officialRoomId) || null : null,
      };
    }
    return {
      ...row,
      sendNotification: row.sendNotification !== false,
      sendTalkMessage,
      officialRoomId,
    };
  }

  function platformRow(row) {
    const category = String(row.category || "");
    const base = {
      ...row,
      body: pickStr(row.body),
      minimalNotifyCard: true,
      type: row.type || CATEGORY_TYPE_MAP[category] || "system",
      targetUrl: row.href,
      source: SOURCE,
      platformMasterVersion: VERSION,
      readAt: null,
    };
    const actionLabel =
      pickStr(row.actionLabel) ||
      global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel?.(base) ||
      "確認する";
    return withTalkDelivery({ ...base, actionLabel });
  }

  function buildMaster(now) {
    const t = Number(now) || Date.now();
    const iso = (ms) => new Date(t - ms).toISOString();

    const feePayUrl = (threadId, listingId, category, notifyId) =>
      `platform-chat-fee-pay.html?thread=${encodeURIComponent(threadId)}&listingId=${encodeURIComponent(listingId)}&category=${encodeURIComponent(category)}&notify=${encodeURIComponent(notifyId)}`;

    const prepay = { connectMode: "prepay", feePhase: "pre_chat" };
    const connectComplete = { connectMode: "connect", feePhase: "on_complete" };

    const chatDealUrl = (threadId, dealId) =>
      `chat-detail.html?thread=${encodeURIComponent(threadId)}&deal=${encodeURIComponent(dealId)}`;

    return [
      platformRow({
        id: "platform-verify-job-full-apply-001",
        category: "求人",
        type: "job",
        title: "この求人に応募がありました",
        href: "detail-job.html?id=job_demo_full_001&userId=u_job_demo_full&talkDev=1&review=job-full&view=applications#applications",
        priority: "high",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "応募者：ひろ",
        notifyEventAt: "2026-05-28T04:45:00.000Z",
        notifyEventAtLabel: "2026/05/28 13:45",
        createdAt: "2026-05-28T04:45:00.000Z",
        createdAtLabel: "2026/05/28 13:45",
      }),
      platformRow({
        id: "platform-verify-job-full-poster-start-001",
        category: "求人",
        type: "job",
        title: "応募者とのやりとりを開始してください",
        href: "chat-detail.html?thread=chat-demo-job-full-001&userId=u_job_demo_full&talkDev=1&review=job-full",
        priority: "high",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        threadId: "chat-demo-job-full-001",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "応募者：ひろ",
        notifyEventAt: "2026-05-28T05:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 14:00",
        createdAt: "2026-05-28T05:00:00.000Z",
        createdAtLabel: "2026/05/28 14:00",
      }),
      platformRow({
        id: "platform-verify-job-full-applicant-start-001",
        category: "求人",
        type: "job",
        title: "掲載者とのやりとりを開始してください",
        href: "chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full",
        priority: "high",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        threadId: "chat-demo-job-full-001",
        applicantId: "u_hiro",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "掲載者：タスク確認株式会社",
        notifyEventAt: "2026-05-28T05:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 14:00",
        createdAt: "2026-05-28T05:00:00.000Z",
        createdAtLabel: "2026/05/28 14:00",
      }),
      platformRow({
        id: "platform-verify-job-full-complete-request-001",
        category: "求人",
        type: "job",
        title: "やりとり完了の申請がありました",
        href: "chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full",
        priority: "high",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        threadId: "chat-demo-job-full-001",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "承認するとやりとりが完了します",
        notifyEventAt: "2026-05-28T06:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:00",
        createdAt: "2026-05-28T06:00:00.000Z",
        createdAtLabel: "2026/05/28 15:00",
      }),
      platformRow({
        id: "platform-verify-job-full-complete-001",
        category: "求人",
        type: "job",
        title: "やりとりが完了しました",
        href: "chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full",
        priority: "high",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        threadId: "chat-demo-job-full-001",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "お疲れさまでした",
        notifyEventAt: "2026-05-28T06:30:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:30",
        createdAt: "2026-05-28T06:30:00.000Z",
        createdAtLabel: "2026/05/28 15:30",
      }),
      platformRow({
        id: "platform-verify-job-full-review-001",
        category: "求人",
        type: "job",
        title: "評価をお願いします",
        href: "chat-detail.html?thread=chat-demo-job-full-001&userId=u_hiro&talkDev=1&review=job-full",
        priority: "medium",
        listingId: "job_demo_full_001",
        applicationId: "job-app-demo-full-001",
        threadId: "chat-demo-job-full-001",
        notifyListingTitle: "YouTubeショート動画編集スタッフ募集",
        notifySupplementLine: "掲載者：タスク確認株式会社",
        notifyEventAt: "2026-05-28T06:31:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:31",
        createdAt: "2026-05-28T06:31:00.000Z",
        createdAtLabel: "2026/05/28 15:31",
      }),
      platformRow({
        id: "platform-verify-chat-demo-connect-start-a-001",
        category: "スキル",
        type: "skill",
        title: "やりとりを開始してください",
        href: "chat-detail.html?thread=chat-demo-skill-deal-001&userId=demo-skill-provider&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1",
        priority: "high",
        listingId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        notifyListingTitle: "Web制作・LP改修（React）",
        notifySupplementLine: "相手：ひろ",
        notifyEventAt: "2026-05-28T05:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 14:00",
        createdAt: "2026-05-28T05:00:00.000Z",
        createdAtLabel: "2026/05/28 14:00",
      }),
      platformRow({
        id: "platform-verify-chat-demo-connect-start-b-001",
        category: "スキル",
        type: "skill",
        title: "やりとりを開始してください",
        href: "chat-detail.html?thread=chat-demo-skill-deal-001&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1",
        priority: "high",
        listingId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        notifyListingTitle: "Web制作・LP改修（React）",
        notifySupplementLine: "相手：クリエイター K",
        notifyEventAt: "2026-05-28T05:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 14:00",
        createdAt: "2026-05-28T05:00:00.000Z",
        createdAtLabel: "2026/05/28 14:00",
      }),
      platformRow({
        id: "platform-verify-chat-demo-connect-request-001",
        category: "スキル",
        type: "skill",
        title: "やりとり完了の申請がありました",
        href: "chat-detail.html?thread=chat-demo-skill-deal-001&userId=demo-skill-provider&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1",
        priority: "high",
        listingId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        notifyListingTitle: "Web制作・LP改修（React）",
        notifySupplementLine: "承認すると報酬が支払われます",
        notifyEventAt: "2026-05-28T06:00:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:00",
        createdAt: "2026-05-28T06:00:00.000Z",
        createdAtLabel: "2026/05/28 15:00",
      }),
      platformRow({
        id: "platform-verify-chat-demo-connect-complete-001",
        category: "スキル",
        type: "skill",
        title: "やりとりが完了しました",
        href: "chat-detail.html?thread=chat-demo-skill-deal-001&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1",
        priority: "high",
        listingId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        notifyListingTitle: "Web制作・LP改修（React）",
        notifySupplementLine: "報酬の支払いが完了しました",
        notifyEventAt: "2026-05-28T06:30:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:30",
        createdAt: "2026-05-28T06:30:00.000Z",
        createdAtLabel: "2026/05/28 15:30",
      }),
      platformRow({
        id: "platform-verify-chat-demo-connect-review-001",
        category: "スキル",
        type: "skill",
        title: "評価をお願いします",
        href: "chat-detail.html?thread=chat-demo-skill-deal-001&userId=u_hiro&talkDev=1&review=chat-demo&demoProfile=connect&platform_connect=1",
        priority: "medium",
        listingId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        notifyListingTitle: "Web制作・LP改修（React）",
        notifySupplementLine: "最後に今回のやりとりを評価してください",
        notifyEventAt: "2026-05-28T06:31:00.000Z",
        notifyEventAtLabel: "2026/05/28 15:31",
        createdAt: "2026-05-28T06:31:00.000Z",
        createdAtLabel: "2026/05/28 15:31",
      }),
      platformRow({
        id: "platform-verify-worker-request-001",
        category: "ワーカー",
        type: "worker",
        title: "依頼が届きました",
        href: feePayUrl(
          "chat-demo-worker-fee-001",
          "demo-worker-001",
          "worker",
          "platform-verify-worker-request-001"
        ),
        ...prepay,
        priority: "high",
        listingId: "demo-worker-001",
        threadId: "chat-demo-worker-fee-001",
        notifyListingTitle: "動画編集サポート依頼",
        notifySupplementLine: "依頼者：ひろ",
        notifyEventAt: "2026-05-28T03:05:00.000Z",
        notifyEventAtLabel: "2026/05/28 12:05",
        createdAt: "2026-05-28T03:05:00.000Z",
        createdAtLabel: "2026/05/28 12:05",
      }),
      platformRow({
        id: "platform-verify-worker-accept-001",
        category: "ワーカー",
        type: "worker",
        title: "依頼を受諾しました",
        href: feePayUrl(
          "chat-demo-worker-fee-001",
          "demo-worker-001",
          "worker",
          "platform-verify-worker-accept-001"
        ),
        ...prepay,
        priority: "high",
        listingId: "demo-worker-001",
        threadId: "chat-demo-worker-fee-001",
        notifyListingTitle: "動画編集サポート依頼",
        notifySupplementLine: "依頼者：ひろ",
        notifyEventAt: "2026-05-28T03:20:00.000Z",
        notifyEventAtLabel: "2026/05/28 12:20",
        createdAt: "2026-05-28T03:20:00.000Z",
        createdAtLabel: "2026/05/28 12:20",
      }),
      platformRow({
        id: "platform-verify-skill-consult-001",
        category: "スキル",
        type: "skill",
        title: "相談が届きました",
        href: feePayUrl(
          "chat-demo-skill-fee-001",
          "demo-skill-001",
          "skill",
          "platform-verify-skill-consult-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 5),
        createdAtLabel: "5分前",
      }),
      platformRow({
        id: "platform-verify-skill-purchase-001",
        category: "スキル",
        type: "skill",
        title: "スキルが購入されました",
        href: feePayUrl(
          "chat-demo-skill-fee-001",
          "demo-skill-001",
          "skill",
          "platform-verify-skill-purchase-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 6),
        createdAtLabel: "6分前",
      }),
      platformRow({
        id: "platform-verify-product-inquiry-001",
        category: "商品",
        type: "product",
        title: "商品について問い合わせがありました",
        href: feePayUrl(
          "chat-demo-product-fee-001",
          "demo-product-001",
          "product",
          "platform-verify-product-inquiry-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 7),
        createdAtLabel: "7分前",
      }),
      platformRow({
        id: "platform-verify-product-purchase-001",
        category: "商品",
        type: "product",
        title: "商品が購入されました",
        href: feePayUrl(
          "chat-demo-product-fee-001",
          "demo-product-001",
          "product",
          "platform-verify-product-purchase-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 8),
        createdAtLabel: "8分前",
      }),
      platformRow({
        id: "platform-verify-business-consult-001",
        category: "業務サービス",
        type: "business",
        title: "相談が届きました",
        href: feePayUrl(
          "chat-demo-business-fee-001",
          "demo-business-service-001",
          "business_service",
          "platform-verify-business-consult-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 9),
        createdAtLabel: "9分前",
      }),
      platformRow({
        id: "platform-verify-shop-inquiry-001",
        category: "店舗販売",
        type: "shop",
        title: "問い合わせが届きました",
        href: feePayUrl(
          "chat-demo-shop-fee-001",
          "demo-shop-reworks",
          "shop_store",
          "platform-verify-shop-inquiry-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 10),
        createdAtLabel: "10分前",
      }),
      platformRow({
        id: "platform-verify-shop-purchase-001",
        category: "店舗販売",
        type: "shop",
        title: "商品が購入されました",
        href: feePayUrl(
          "chat-demo-shop-fee-001",
          "demo-shop-reworks",
          "shop_store",
          "platform-verify-shop-purchase-001"
        ),
        ...prepay,
        priority: "high",
        createdAt: iso(1000 * 60 * 11),
        createdAtLabel: "11分前",
      }),
      platformRow({
        id: "platform-verify-skill-connect-complete-001",
        category: "スキル",
        type: "skill",
        title: "取引が完了しました",
        href: chatDealUrl("chat-demo-skill-deal-001", "skill_deal_demo_001"),
        ...connectComplete,
        priority: "high",
        dealId: "skill_deal_demo_001",
        threadId: "chat-demo-skill-deal-001",
        listingId: "skill_deal_demo_001",
        createdAt: iso(1000 * 60 * 11.5),
        createdAtLabel: "12分前",
      }),
      platformRow({
        id: "platform-verify-product-connect-complete-001",
        category: "商品",
        type: "product",
        title: "取引が完了しました",
        href: chatDealUrl("chat-demo-product-deal-001", "product_deal_demo_001"),
        ...connectComplete,
        priority: "high",
        dealId: "product_deal_demo_001",
        threadId: "chat-demo-product-deal-001",
        listingId: "demo-product-001",
        createdAt: iso(1000 * 60 * 11.4),
        createdAtLabel: "12分前",
      }),
      platformRow({
        id: "platform-verify-worker-connect-complete-001",
        category: "ワーカー",
        type: "worker",
        title: "取引が完了しました",
        href: chatDealUrl("chat-demo-worker-deal-001", "worker_deal_demo_001"),
        ...connectComplete,
        priority: "high",
        dealId: "worker_deal_demo_001",
        threadId: "chat-demo-worker-deal-001",
        listingId: "demo-worker-001",
        notifyListingTitle: "動画編集サポート依頼",
        notifySupplementLine: "依頼者：ひろ",
        notifyEventAt: "2026-05-28T07:30:00.000Z",
        notifyEventAtLabel: "2026/05/28 16:30",
        createdAt: "2026-05-28T07:30:00.000Z",
        createdAtLabel: "2026/05/28 16:30",
      }),
      platformRow({
        id: "platform-verify-business-connect-complete-001",
        category: "業務サービス",
        type: "business",
        title: "取引が完了しました",
        href: chatDealUrl("chat-demo-business-deal-001", "business_deal_demo_001"),
        ...connectComplete,
        priority: "high",
        dealId: "business_deal_demo_001",
        threadId: "chat-demo-business-deal-001",
        listingId: "demo-business-service-001",
        createdAt: iso(1000 * 60 * 11.2),
        createdAtLabel: "12分前",
      }),
      platformRow({
        id: "platform-verify-shop-connect-complete-001",
        category: "店舗販売",
        type: "shop",
        title: "取引が完了しました",
        href: chatDealUrl("chat-demo-shop-deal-001", "shop_deal_demo_001"),
        ...connectComplete,
        priority: "high",
        dealId: "shop_deal_demo_001",
        threadId: "chat-demo-shop-deal-001",
        listingId: "demo-shop-reworks",
        createdAt: iso(1000 * 60 * 11.1),
        createdAtLabel: "12分前",
      }),
      platformRow({
        id: "platform-verify-builder-publish-001",
        category: "Builder",
        type: "builder",
        title: "新しい案件が公開されました",
        href: "public-board-detail.html?id=pub-board-project-001&type=project",
        officialRoomId: "official_platform",
        priority: "high",
        createdAt: iso(1000 * 60 * 12),
        createdAtLabel: "12分前",
      }),
      platformRow({
        id: "platform-verify-builder-hired-001",
        category: "Builder",
        type: "builder",
        title: "採用されました",
        href: "builder/board-thread.html?thread_id=thread-demo-001",
        officialRoomId: "official_platform",
        priority: "high",
        createdAt: iso(1000 * 60 * 13),
        createdAtLabel: "13分前",
      }),
      platformRow({
        id: "platform-verify-builder-completion-001",
        category: "Builder",
        type: "builder",
        title: "完了報告が届きました",
        href: "builder/board-thread.html?thread_id=thread-demo-001&role=owner#completion",
        officialRoomId: "official_platform",
        priority: "high",
        createdAt: iso(1000 * 60 * 14),
        createdAtLabel: "14分前",
      }),
      platformRow({
        id: "platform-verify-anpi-001",
        category: "安否",
        type: "anpi",
        title: "安否確認通知",
        href: "anpi-dashboard.html#check",
        officialRoomId: "official_anpi",
        priority: "high",
        createdAt: iso(1000 * 60 * 15),
        createdAtLabel: "15分前",
      }),
      platformRow({
        id: "platform-verify-ai-001",
        category: "AI",
        type: "ai",
        title: "AIからお知らせがあります",
        href: "talk-home.html?tab=ai",
        priority: "high",
        createdAt: iso(1000 * 60 * 16),
        createdAtLabel: "16分前",
      }),
      platformRow({
        id: "platform-verify-official-001",
        category: "公式",
        type: "system",
        title: "運営からのお知らせ",
        href: "talk-home.html?tab=chat",
        priority: "high",
        createdAt: iso(1000 * 60 * 17),
        createdAtLabel: "17分前",
      }),
      platformRow({
        id: "platform-verify-system-001",
        category: "運営",
        type: "system",
        title: "重要なお知らせがあります",
        body: "6/15 02:00–04:00 メンテナンスのため、一時的にログインできなくなる場合があります。",
        href: "dashboard.html",
        priority: "high",
        createdAt: iso(1000 * 60 * 18),
        createdAtLabel: "18分前",
      }),
    ];
  }

  function getPlatformPriorityRank(priority) {
    const p = String(priority || "normal").toLowerCase();
    if (p === "high" || p === "urgent") return 0;
    if (p === "medium" || p === "important") return 1;
    if (p === "low" || p === "normal") return 2;
    return 3;
  }

  function sortPlatformNotifications(list) {
    return (list || []).slice().sort((a, b) => {
      const ra = getPlatformPriorityRank(a?.priority);
      const rb = getPlatformPriorityRank(b?.priority);
      if (ra !== rb) return ra - rb;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }

  function isPlatformMasterNotification(n) {
    if (!n || typeof n !== "object") return false;
    if (n.source === SOURCE && n.platformMasterVersion === VERSION) return true;
    if (n.platformMasterVersion === VERSION) return true;
    const id = String(n.id || "");
    return id.startsWith("platform-verify-") || VERIFY_IDS.includes(id);
  }

  global.TasuTalkPlatformNotifyMaster = {
    SOURCE,
    VERSION,
    VERIFY_IDS,
    PLATFORM_CATEGORY_META,
    CATEGORY_TYPE_MAP,
    buildMaster,
    sortPlatformNotifications,
    getPlatformPriorityRank,
    isPlatformMasterNotification,
  };
})(typeof window !== "undefined" ? window : globalThis);
