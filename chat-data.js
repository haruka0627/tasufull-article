/**
 * ダミーデータ（後で Supabase へ差し替え想定）
 * - スレッド: Stripe決済が完了したら作成される想定
 * - 期限: expiresAt で制御（期限切れなら送信不可）
 * - TasuChatDisplayCatalog: 掲載名・相手名の解決 + 一覧レビュー用ショーケース
 */
(function () {
  "use strict";

  const ME = {
    id: "u_me",
    displayName: "あなた",
    avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
  };

  /** @type {Record<string, { title: string, type?: string, contactKind?: string, category?: string }>} */
  const LISTING_BY_ID = {
    listing_001: {
      title: "業務代行・買い物サポート（渋谷エリア）",
      type: "business",
      contactKind: "consult",
      category: "業務サービス",
    },
    listing_002: {
      title: "店舗内装リニューアル一式（見積対応）",
      type: "business",
      contactKind: "estimate",
      category: "リフォーム",
    },
    worker_hiro_001: {
      title: "渋谷周辺で買い物代行・即日対応します",
      type: "worker",
      contactKind: "deal",
      category: "ワーカー",
    },
    skill_sd_2026: {
      title: "SDキャラ制作（商用OK）",
      type: "skill",
      contactKind: "deal",
      category: "クリエイター",
    },
    product_set_2026: {
      title: "プレミアム家電セット 2026",
      type: "product",
      contactKind: "deal",
      category: "店舗商品",
    },
    shop_demo_bento: {
      title: "駅前弁当店「おかずの詰め合わせ」",
      type: "shop_store",
      contactKind: "deal",
      category: "店舗",
    },
    builder_project_alpha: {
      title: "Builder案件：LP制作（納品・検収あり）",
      type: "builder",
      contactKind: "deal",
      category: "Builder",
    },
    biz_consult_office: {
      title: "法人向けバックオフィス代行",
      type: "business",
      contactKind: "consult",
      category: "業務サービス",
    },
    biz_estimate_sign: {
      title: "看板・サイン制作（見積り依頼）",
      type: "business",
      contactKind: "estimate",
      category: "制作",
    },
  };

  /** @type {Record<string, { displayName: string, companyName?: string, shopName?: string, avatarUrl?: string }>} */
  const USER_BY_ID = {
    u_hiro: {
      displayName: "ひろ",
      companyName: "ひろ代行サービス",
      avatarUrl: "https://placehold.co/64x64/fff6df/7a5710?text=H",
    },
    u_sachi: {
      displayName: "さちこ",
      companyName: "さちこデザイン",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=S",
    },
    u_store: {
      displayName: "プレミアムホーム",
      shopName: "プレミアムホーム",
      avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=PH",
    },
    u_vendor_tanaka: {
      displayName: "田中工務店",
      companyName: "株式会社田中工務店",
      avatarUrl: "https://placehold.co/64x64/e0f2fe/1d4ed8?text=T",
    },
    u_shop_owner: {
      displayName: "おかず弁当 店長",
      shopName: "おかず弁当 駅前店",
      avatarUrl: "https://placehold.co/64x64/fef3c7/b45309?text=O",
    },
    u_builder_partner: {
      displayName: "Studio Alpha",
      companyName: "Studio Alpha",
      avatarUrl: "https://placehold.co/64x64/ede9fe/6d28d9?text=A",
    },
    u_biz_consult: {
      displayName: "山田（業務代行）",
      companyName: "TASFUL認定パートナー",
      avatarUrl: "https://placehold.co/64x64/dcfce7/15803d?text=Y",
    },
  };

  /** @type {Array<object>} */
  const threads = [
    {
      id: "chat_001",
      listing: { id: "worker_hiro_001", type: "worker", title: LISTING_BY_ID.worker_hiro_001.title },
      partner: { id: "u_hiro", displayName: USER_BY_ID.u_hiro.displayName, avatarUrl: USER_BY_ID.u_hiro.avatarUrl },
      buyerId: "u_me",
      sellerId: "u_hiro",
      me: ME,
      status: "active",
      roomStatus: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 42).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      unreadCount: 2,
      lastMessagePreview: "ありがとうございます。牛乳・卵・米5kg、あと冷凍食品も少しあります。",
    },
    {
      id: "chat_002",
      listing: { id: "skill_sd_2026", type: "skill", title: LISTING_BY_ID.skill_sd_2026.title },
      partner: { id: "u_sachi", displayName: USER_BY_ID.u_sachi.displayName, avatarUrl: USER_BY_ID.u_sachi.avatarUrl },
      buyerId: "u_me",
      sellerId: "u_sachi",
      me: ME,
      status: "active",
      roomStatus: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 7).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      unreadCount: 0,
      lastMessagePreview: "配信用のアイコンです。ゆるめの等身で、表情差分も検討してます。",
    },
    {
      id: "chat_003",
      listing: { id: "product_set_2026", type: "product", title: LISTING_BY_ID.product_set_2026.title },
      partner: { id: "u_store", displayName: USER_BY_ID.u_store.displayName, avatarUrl: USER_BY_ID.u_store.avatarUrl },
      buyerId: "u_me",
      sellerId: "u_store",
      me: ME,
      status: "expired",
      roomStatus: "expired",
      expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      unreadCount: 0,
      lastMessagePreview: "ありがとうございます。こちらで住所は入力済みです。",
    },
    {
      id: "chat_004",
      listing: { id: "biz_consult_office", type: "business", title: LISTING_BY_ID.biz_consult_office.title },
      partner: {
        id: "u_biz_consult",
        displayName: USER_BY_ID.u_biz_consult.displayName,
        avatarUrl: USER_BY_ID.u_biz_consult.avatarUrl,
      },
      buyerId: "u_me",
      sellerId: "u_biz_consult",
      me: ME,
      contactKind: "consult",
      platformContactKind: "consult",
      threadKind: "listing_inquiry",
      status: "active",
      roomStatus: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      unreadCount: 1,
      lastMessagePreview: "初回ヒアリングの日程、来週火曜の午後はいかがでしょうか。",
      _localConsult: true,
      _category: "業務サービス",
    },
    {
      id: "chat_005",
      listing: { id: "biz_estimate_sign", type: "business", title: LISTING_BY_ID.biz_estimate_sign.title },
      partner: {
        id: "u_vendor_tanaka",
        displayName: USER_BY_ID.u_vendor_tanaka.displayName,
        avatarUrl: USER_BY_ID.u_vendor_tanaka.avatarUrl,
      },
      buyerId: "u_me",
      sellerId: "u_vendor_tanaka",
      me: ME,
      contactKind: "estimate",
      platformContactKind: "estimate",
      status: "fee_pending",
      roomStatus: "fee_pending",
      _feePending: true,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      unreadCount: 0,
      lastMessagePreview: "現地調査のうえ、正式見積りをお送りします。",
    },
    {
      id: "chat_006",
      listing: { id: "builder_project_alpha", type: "builder", title: LISTING_BY_ID.builder_project_alpha.title },
      partner: {
        id: "u_builder_partner",
        displayName: USER_BY_ID.u_builder_partner.displayName,
        avatarUrl: USER_BY_ID.u_builder_partner.avatarUrl,
      },
      buyerId: "u_me",
      sellerId: "u_builder_partner",
      me: ME,
      contactKind: "deal",
      status: "completed",
      roomStatus: "completed",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      unreadCount: 0,
      lastMessagePreview: "納品物を確認しました。ありがとうございました。",
    },
    {
      id: "official_tasful",
      listing: { id: "official_tasful", type: "official", title: "TASFUL運営からのお知らせ" },
      partner: { id: "official_tasful", displayName: "TASFUL運営", avatarUrl: "https://placehold.co/64x64/f1f5f9/334155?text=T" },
      me: ME,
      _officialRoom: true,
      threadKind: "official",
      status: "active",
      roomStatus: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      unreadCount: 0,
      lastMessagePreview: "本人確認の審査が完了しました。",
    },
    {
      id: "demo-notify-purchase-001",
      listing: { id: "shop_demo_bento", type: "shop_store", title: LISTING_BY_ID.shop_demo_bento.title },
      partner: { id: "u_shop_owner", displayName: USER_BY_ID.u_shop_owner.displayName, avatarUrl: USER_BY_ID.u_shop_owner.avatarUrl },
      buyerId: "u_me",
      sellerId: "u_shop_owner",
      me: ME,
      _notifyCard: true,
      minimalNotifyCard: true,
      source: "notify",
      _talkChannel: "notify",
      status: "active",
      roomStatus: "active",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      lastReadAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      unreadCount: 1,
      lastMessagePreview: "ご注文を受け付けました。店舗より確認メッセージが届きます。",
    },
  ];

  /** @type {Record<string, Array<{id:string, chatId:string, senderId:string, senderName:string, senderAvatarUrl:string, text:string, createdAt:string, kind:"text"}>>} */
  const messagesByChatId = {
    chat_001: [
      {
        id: "m_001",
        chatId: "chat_001",
        senderId: "u_me",
        senderName: "あなた",
        senderAvatarUrl: ME.avatarUrl,
        text: "はじめまして。明日18時ごろに、スーパーで買い物代行をお願いできますか？",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        kind: "text",
      },
      {
        id: "m_002",
        chatId: "chat_001",
        senderId: "u_hiro",
        senderName: USER_BY_ID.u_hiro.displayName,
        senderAvatarUrl: USER_BY_ID.u_hiro.avatarUrl,
        text: "可能です！対応エリア内なのでスムーズに動けます。購入リストと店舗（候補）を教えてください。",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5 + 1000 * 60 * 9).toISOString(),
        kind: "text",
      },
      {
        id: "m_003",
        chatId: "chat_001",
        senderId: "u_me",
        senderName: "あなた",
        senderAvatarUrl: ME.avatarUrl,
        text: "ありがとうございます。牛乳・卵・米5kg、あと冷凍食品も少しあります。",
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        kind: "text",
      },
    ],
    chat_002: [
      {
        id: "m_101",
        chatId: "chat_002",
        senderId: "u_sachi",
        senderName: USER_BY_ID.u_sachi.displayName,
        senderAvatarUrl: USER_BY_ID.u_sachi.avatarUrl,
        text: "ご依頼ありがとうございます。用途（配信/グッズ等）と、イメージに近い参考画像があれば共有ください。",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
        kind: "text",
      },
    ],
    chat_003: [
      {
        id: "m_201",
        chatId: "chat_003",
        senderId: "u_store",
        senderName: USER_BY_ID.u_store.displayName,
        senderAvatarUrl: USER_BY_ID.u_store.avatarUrl,
        text: "お支払い確認が取れました。発送先住所の確認をお願いします。",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        kind: "text",
      },
    ],
  };

  function resolveListing(listingId) {
    const id = String(listingId || "").trim();
    if (!id) return null;
    return LISTING_BY_ID[id] ? { id, ...LISTING_BY_ID[id] } : null;
  }

  function resolveUser(userId) {
    const id = String(userId || "").trim();
    if (!id) return null;
    return USER_BY_ID[id] ? { user_id: id, ...USER_BY_ID[id] } : null;
  }

  function getShowcaseThreads() {
    return threads.slice();
  }

  window.TasuChatDisplayCatalog = {
    LISTING_BY_ID,
    USER_BY_ID,
    resolveListing,
    resolveUser,
    getShowcaseThreads,
  };

  window.TasuChatDummy = {
    threads,
    messagesByChatId,
  };
})();
