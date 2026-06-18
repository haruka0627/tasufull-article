/**
 * プラット側カテゴリ — 完了・キャンセル・評価フロー（Builder 除外）
 */
(function (global) {
  "use strict";

  const REVIEW_PROMPT_BODY =
    "評価は1分ほどで完了します。最後に今回のやりとりを評価してください。";
  const REVIEW_PROMPT_DONE =
    global.TasuPlatformChatReviewFlow?.REVIEW_PROMPT_DONE || "✓ 評価を送信しました";

  /** @type {Record<string, object>} */
  const CATEGORY_SPECS = Object.freeze({
    job: {
      key: "job",
      label: "求人",
      sellerRole: "掲載者",
      buyerRole: "応募者",
      requester: "seller",
      contactNotifyTitle: "応募が届きました",
      contactNotifyCta: "応募者を確認する",
      managementListLabel: "応募者一覧",
      managementView: "applications",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      skipsPostChatCompletionFlow: true,
      completeBtn: "やりとり完了",
      completeDone: "やりとり完了済み",
      approveBtn: "やりとり完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "やりとり完了",
      confirmBody: "やりとり完了を申請します。相手が承認するとやりとりが締めくくられます。",
      requestSuffix: "やりとり完了を申請しました",
      doneSystem: "やりとりが完了しました",
      completedNotice: "やりとりが完了しました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "やりとり終了のため送信できません",
      cancelModalTitle: "やりとりを終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "やりとり評価",
      reviewSub: "相手への評価は任意です。スキップしてもやりとりは完了したままです。",
      reviewPromptTitle: "✓ やりとりが完了しました",
      reviewPromptBtn: "やりとり評価する",
      completionCardTitle: "やりとりが完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "やりとり完了申請",
    },
    skill: {
      key: "skill",
      label: "スキル",
      sellerRole: "出品者",
      buyerRole: "購入者",
      requester: "seller",
      contactNotifyTitle: "購入されました",
      contactNotifyCta: "購入者を確認する",
      buyerSubmittedToast: "購入が完了しました。出品者の確認をお待ちください。",
      alreadySubmittedToast: "すでに送信済みです",
      alreadySubmittedReason: "already_submitted",
      ownerCannotSubmitToast: "出品者は送信できません",
      managementListLabel: "購入者一覧",
      managementView: "contacts",
      pendingContentLabel: "納品内容",
      payerPaidNotifyTitle: "購入者が支払いました",
      payerPaidNotifyBody: "入金を確認してください",
      payerPaidNotifyCta: "入金を確認する",
      payerRoleLabel: "購入者",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      completeBtn: "納品完了申請",
      sellerCompleteBtn: "納品完了",
      sellerModalTitle: "納品完了",
      sellerConfirmBody: "納品完了を相手に通知します。相手が確認すると取引が完了します。",
      shipSystem: "納品が完了しました",
      receiveBtn: "納品を確認",
      receiveSystem: "納品が確認されました",
      completeDone: "納品完了済み",
      approveBtn: "納品完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "納品完了申請",
      confirmBody: "納品完了を申請します。相手が承認すると取引が締めくくられます。",
      requestSuffix: "納品完了を申請しました",
      doneSystem: "納品が確認されました",
      completedNotice: "納品が確認されました",
      connectPendingBody: "出品者から納品完了の通知が届きました。内容をご確認のうえ、受け取りを確定してください。",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "取引終了のため送信できません",
      cancelModalTitle: "取引を終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
      reviewPromptTitle: "",
      reviewPromptBody: "取引ありがとうございました。評価をお願いします。",
      reviewPromptShowStars: true,
      reviewPromptBtn: "レビューを書く",
      reviewBtn: "レビューを書く",
      completionCardTitle: "取引が完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "納品内容を確認してください",
      connectPendingBody: "出品者から納品完了の申請が届きました。承認または差し戻しを選んでください。",
      rejectBtn: "差し戻す",
      approvedAwaitingPaymentSystem:
        "納品を承認しました。振込先をご確認のうえ、お支払い後に「支払いました」を押してください。",
    },
    worker: {
      key: "worker",
      label: "ワーカー",
      sellerRole: "ワーカー",
      buyerRole: "依頼者",
      requester: "seller",
      contactNotifyTitle: "依頼が届きました",
      contactNotifyCta: "依頼者を確認する",
      buyerSubmittedToast: "依頼を送信しました",
      alreadySubmittedToast: "すでに依頼済みです",
      alreadySubmittedReason: "already_submitted",
      ownerCannotSubmitToast: "本人は依頼できません",
      managementListLabel: "依頼者一覧",
      managementView: "contacts",
      pendingContentLabel: "作業内容",
      payerPaidNotifyTitle: "依頼者が支払いました",
      payerPaidNotifyBody: "入金を確認してください",
      payerPaidNotifyCta: "入金を確認する",
      payerRoleLabel: "依頼者",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      completeBtn: "作業完了申請",
      sellerCompleteBtn: "作業完了",
      sellerModalTitle: "作業完了",
      sellerConfirmBody: "作業完了を相手に通知します。相手が確認すると取引が完了します。",
      shipSystem: "作業が完了しました",
      receiveBtn: "作業内容を確認",
      receiveSystem: "作業完了が確認されました",
      completeDone: "作業完了済み",
      approveBtn: "作業完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "作業完了申請",
      confirmBody:
        "作業完了を申請します。依頼者の承認後、Stripe Connect決済で報酬が支払われます。",
      requestSuffix: "作業完了を申請しました",
      approvedAwaitingConnectPaymentSystem:
        "作業完了を承認しました。依頼者のStripe Connect決済をお待ちください。",
      doneSystem: "作業完了が確認されました",
      completedNotice: "作業完了が確認されました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "やりとり終了のため送信できません",
      cancelModalTitle: "やりとりを終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
      reviewPromptTitle: "",
      reviewPromptBody: "取引ありがとうございました。評価をお願いします。",
      reviewPromptShowStars: true,
      reviewPromptBtn: "レビューを書く",
      reviewBtn: "レビューを書く",
      completionCardTitle: "取引が完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "作業内容を確認してください",
      connectPendingBody: "ワーカーから作業完了の通知が届きました。内容をご確認のうえ、受け取りを確定してください。",
      approvedAwaitingPaymentSystem:
        "作業を承認しました。振込先をご確認のうえ、お支払い後に「支払いました」を押してください。",
    },
    general: {
      key: "general",
      label: "一般案件",
      sellerRole: "掲載者",
      buyerRole: "依頼者",
      requester: "seller",
      contactNotifyTitle: "応募/依頼が届きました",
      contactNotifyCta: "応募者/依頼者を確認する",
      buyerSubmittedToast: "依頼を送信しました。掲載者の確認をお待ちください。",
      alreadySubmittedToast: "すでに送信済みです",
      alreadySubmittedReason: "already_submitted",
      ownerCannotSubmitToast: "掲載者は送信できません",
      managementListLabel: "応募者/依頼者一覧",
      managementView: "contacts",
      pendingContentLabel: "作業内容",
      payerPaidNotifyTitle: "依頼者が支払いました",
      payerPaidNotifyBody: "入金を確認してください",
      payerPaidNotifyCta: "入金を確認する",
      payerRoleLabel: "依頼者",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      completeBtn: "作業完了申請",
      completeDone: "作業完了済み",
      approveBtn: "作業完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "作業完了申請",
      confirmBody:
        "作業完了を申請します。依頼者の承認後、Stripe Connect決済で報酬が支払われます。",
      requestSuffix: "作業完了を申請しました",
      approvedAwaitingConnectPaymentSystem:
        "作業完了を承認しました。依頼者のStripe Connect決済をお待ちください。",
      doneSystem: "取引が完了しました",
      completedNotice: "取引が完了しました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "取引終了のため送信できません",
      cancelModalTitle: "取引を終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
      reviewPromptTitle: "",
      reviewPromptBody: "取引ありがとうございました。評価をお願いします。",
      reviewPromptShowStars: true,
      reviewPromptBtn: "レビューする",
      completionCardTitle: "取引が完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "作業内容を確認してください",
      approvedAwaitingPaymentSystem:
        "作業を承認しました。振込先をご確認のうえ、お支払い後に「支払いました」を押してください。",
    },
    product: {
      key: "product",
      label: "商品",
      sellerRole: "出品者",
      buyerRole: "購入者",
      requester: "buyer",
      contactNotifyTitle: "商品が購入されました",
      contactNotifyCta: "購入者を確認する",
      buyerSubmittedToast: "購入が完了しました。出品者の確認をお待ちください。",
      alreadySubmittedToast: "すでに送信済みです",
      alreadySubmittedReason: "already_submitted",
      ownerCannotSubmitToast: "出品者は送信できません",
      managementListLabel: "購入者一覧",
      managementView: "contacts",
      pendingContentLabel: "商品内容",
      payerPaidNotifyTitle: "購入者が支払いました",
      payerPaidNotifyBody: "入金を確認してください",
      payerPaidNotifyCta: "入金を確認する",
      payerRoleLabel: "購入者",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      completeBtn: "受け取り完了申請",
      sellerCompleteBtn: "発送完了",
      completeDone: "受け取り完了済み",
      approveBtn: "受け取り完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "受け取り完了申請",
      sellerModalTitle: "発送完了",
      confirmBody: "受け取り完了を申請します。相手が承認すると取引が締めくくられます。",
      sellerConfirmBody: "商品の発送が完了したことを相手に通知します。",
      shipNotifyTitle: "商品が発送されました",
      shipNotifyBody: "出品者から発送通知が届きました。到着後に受け取り完了を申請してください。",
      shipNotifyCta: "確認する",
      shipReceivePromptBuyer: "商品が発送されました。到着後に受取確認を行ってください。",
      shipWaitingNoticeSeller: "商品を発送しました。購入者の受取確認をお待ちください。",
      shipFormTitle: "発送情報の入力",
      shipConfirmSubmitBtn: "発送を確定する",
      receiveBtn: "受取確認",
      receiveModalTitle: "受取確認",
      receiveConfirmBody: "商品の受取を確認し、取引を完了します。",
      receiveSystem: "商品の受け取りが確認されました",
      shippingReadyBtn: "発送準備完了",
      shippingReadyConfirmBody: "発送準備が整いました。購入者へお支払いを依頼します。",
      bankReportBtn: "銀行振込が完了しました",
      bankReportConfirmBody: "銀行振込が完了したことを出品者に報告します。",
      bankReportSystem: "銀行振込が完了しました。",
      bankTransferCardTitle: "振込先のご案内",
      bankDepositCardTitle: "入金を確認してください",
      bankDepositCardGuide: "購入者から銀行振込完了の報告が届きました。入金を確認してください。",
      paymentConfirmBtn: "入金を確認する",
      paymentConfirmBody: "入金を確認し、購入者へ通知します。",
      codReportBtn: "商品受取・支払い完了を報告する",
      codReportConfirmBody: "商品の受取と代金支払いが完了したことを報告します。",
      codConfirmBtn: "代引き回収を確認する",
      codConfirmBody: "代引きの回収を確認し、取引を完了します。",
      prepaidWaitingShipBuyer: "出品者の発送をお待ちください。",
      bankWaitingReadyBuyer: "出品者の発送準備をお待ちください。",
      bankPayRequestBuyer: "銀行振込を完了してください。",
      bankWaitingConfirmBuyer: "出品者の入金確認をお待ちください。",
      bankWaitingShipBuyer: "入金確認が完了しました。商品の発送をお待ちください。",
      bankWaitingTransferSeller: "購入者の振込をお待ちください。",
      bankConfirmPaymentSeller: "購入者から振込完了報告が届きました。入金を確認してください。",
      bankReadyToShipSeller: "入金を確認しました。商品を発送してください。",
      codWaitingShipBuyer: "出品者の発送をお待ちください。",
      codShippedBuyer: "商品が発送されました。到着時に代金をお支払いください。",
      codWaitingReportSeller: "購入者の受取・支払い報告をお待ちください。",
      codConfirmPromptSeller: "購入者から受取・支払い報告が届きました。代引き回収を確認してください。",
      codWaitingConfirmBuyer: "出品者の代引き回収確認をお待ちください。",
      requestSuffix: "発送完了を申請しました",
      shipSystem: "商品を発送しました",
      doneSystem: "商品の受け取りが確認されました",
      completedNotice: "商品の受け取りが確認されました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "取引終了のため送信できません",
      cancelModalTitle: "取引を終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
      reviewPromptTitle: "",
      reviewPromptBody: "取引ありがとうございました。評価をお願いします。",
      reviewPromptShowStars: true,
      reviewPromptBtn: "レビューを書く",
      reviewBtn: "レビューを書く",
      completionCardTitle: "取引が完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "商品内容を確認してください",
      connectPendingBody: "出品者から発送完了の通知が届きました。商品到着後、受取確認を行ってください。",
      approvedAwaitingPaymentSystem:
        "発送を承認しました。振込先をご確認のうえ、お支払い後に「支払いました」を押してください。",
    },
    builder: {
      key: "builder",
      label: "Builder",
      sellerRole: "掲載者",
      buyerRole: "依頼者",
      requester: "seller",
      contactNotifyTitle: "案件応募/依頼が届きました",
      contactNotifyCta: "応募者/依頼者を確認する",
      managementListLabel: "応募者/依頼者一覧",
      managementView: "contacts",
      pendingContentLabel: "作業内容",
      payerPaidNotifyTitle: "依頼者が支払いました",
      payerPaidNotifyBody: "入金を確認してください",
      payerPaidNotifyCta: "入金を確認する",
      payerRoleLabel: "依頼者",
      chatStartedNotifyTitle: "やりとりが開始されました",
      chatStartedNotifyCta: "チャットを開く",
      completeBtn: "作業完了申請",
      completeDone: "作業完了済み",
      approveBtn: "作業完了を承認",
      pendingBtn: "完了申請中",
      modalTitle: "作業完了申請",
      confirmBody:
        "作業完了を申請します。依頼者の承認後、Stripe Connect決済で報酬が支払われます。",
      requestSuffix: "作業完了を申請しました",
      approvedAwaitingConnectPaymentSystem:
        "作業完了を承認しました。依頼者のStripe Connect決済をお待ちください。",
      doneSystem: "取引が完了しました",
      completedNotice: "取引が完了しました",
      completedPlaceholder: "このやりとりは完了しています。履歴としてご確認いただけます。",
      cancelledPlaceholder: "取引終了のため送信できません",
      cancelModalTitle: "取引を終了",
      cancelModalBody: "理由を選択してください。終了後はチャットが閲覧専用になります。",
      reviewTitle: "評価",
      reviewSub: "相手への評価は任意です。スキップしても取引は完了したままです。",
      reviewPromptTitle: "",
      reviewPromptBody: "取引ありがとうございました。評価をお願いします。",
      reviewPromptShowStars: true,
      reviewPromptBtn: "レビューする",
      completionCardTitle: "取引が完了しました",
      completionCardGuide: "お取引ありがとうございました。",
      connectPendingTitle: "作業内容を確認してください",
      approvedAwaitingPaymentSystem:
        "作業を承認しました。振込先をご確認のうえ、お支払い後に「支払いました」を押してください。",
    },
  });

  /** 購入/完了フローの共通基底（個別フロー実装禁止） */
  const FLOW_BASE_BY_KEY = Object.freeze({
    shop_store: "product",
    business_service: "worker",
  });

  /** 表示上のカテゴリ名のみ差し替え（フロー文言は基底カテゴリと同一） */
  const CATEGORY_IDENTITY = Object.freeze({
    shop_store: {
      key: "shop_store",
      label: "店舗・販売",
      contactNotifyTitle: "商品が購入されました",
      contactNotifyCta: "購入を確認する",
      buyerSubmittedToast: "購入が完了しました。店舗の確認をお待ちください。",
      managementListLabel: "購入者一覧",
    },
    business_service: { key: "business_service", label: "業務サービス" },
  });

  const PLATFORM_CATEGORY_KEYS = Object.freeze([
    "job",
    "skill",
    "worker",
    "general",
    "product",
    "shop_store",
    "business_service",
    "builder",
  ]);

  const POST_CHAT_COMPLETION_STEP_IDS = Object.freeze([
    "complete-request",
    "approve",
    "manual-pay",
    "manual-confirm",
    "review",
  ]);

  const ROLE_PARTICLE_WORDS = new Set([
    "掲載者",
    "応募者",
    "出品者",
    "購入者",
    "募集者",
    "販売者",
    "依頼者",
    "提供者",
    "利用者",
  ]);

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

  function normalizeCategoryKey(raw) {
    const Fee = global.TasuPlatformChatFee;
    if (Fee?.normalizeCategoryKey) return Fee.normalizeCategoryKey(raw);
    const key = pickStr(raw).toLowerCase().replace(/-/g, "_");
    if (key === "shop" || key === "shopstore") return "shop_store";
    if (key === "business" || key === "business_service") return "business_service";
    return key;
  }

  function resolveCategoryKey(thread) {
    if (!thread) return "";
    const Fee = global.TasuPlatformChatFee;
    const fromListing = Fee?.resolveCategoryKey?.({
      listing_type: thread.listingType || thread.listing_type,
      listingType: thread.listingType,
      category: thread.category,
      type: thread.listingType,
    });
    if (fromListing) return normalizeCategoryKey(fromListing);
    if (global.TasuPlatformChatJobFlow?.isJobThread?.(thread)) return "job";
    const lt = normalizeCategoryKey(thread.listingType || thread.listing_type);
    if (CATEGORY_SPECS[lt]) return lt;
    const cat = normalizeCategoryKey(thread.category);
    if (CATEGORY_SPECS[cat]) return cat;
    if (thread.threadKind === "job_hire" || thread.applicationId) return "job";
    return "";
  }

  function resolveFlowBaseKey(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : resolveCategoryKey(keyOrThread);
    return FLOW_BASE_BY_KEY[key] || key;
  }

  function isProductFlowCategory(keyOrThread) {
    return resolveFlowBaseKey(keyOrThread) === "product";
  }

  function isWorkerFlowCategory(keyOrThread) {
    return resolveFlowBaseKey(keyOrThread) === "worker";
  }

  const SHOP_CONNECT_SETUP_MESSAGE =
    "この店舗は現在、購入決済に対応していません。出品者の決済設定が完了すると、商品を購入できます。";
  const SHOP_CONNECT_BENCH_MESSAGE = "Connectなし店舗のため、購入フローは無効です。";
  const CONNECT_REQUIRED_SETUP_MESSAGE =
    "このカテゴリは決済設定が必要です。出品者の決済設定が完了すると、購入できます。";
  const CONNECT_REQUIRED_BENCH_MESSAGE =
    "Connectなしのため、購入・依頼フローは無効です。";

  const CONNECT_FREE_FEE_CATEGORY_KEYS = new Set(["product", "worker"]);
  const CONNECT_REQUIRED_CATEGORY_KEYS = new Set(["shop_store", "shop", "business_service", "business"]);
  const MARKETPLACE_CONNECT_CATEGORY_KEYS = new Set(["skill", "product", "worker"]);
  const MARKETPLACE_CONNECT_SETUP_MESSAGE =
    "この出品者は決済設定が完了していません。Connect設定完了後に購入できます。";

  function isShopStoreCategory(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : normalizeCategoryKey(resolveCategoryKey(keyOrThread));
    return key === "shop_store" || key === "shop";
  }

  function isBusinessServiceCategory(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : normalizeCategoryKey(resolveCategoryKey(keyOrThread));
    return key === "business_service" || key === "business";
  }

  function isConnectRequiredCategory(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : normalizeCategoryKey(resolveCategoryKey(keyOrThread));
    return isShopStoreCategory(key) || isBusinessServiceCategory(key);
  }

  function isConnectFreeFeeCategory(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : normalizeCategoryKey(resolveCategoryKey(keyOrThread));
    return CONNECT_FREE_FEE_CATEGORY_KEYS.has(key);
  }

  function isMarketplaceConnectCategory(keyOrThread) {
    const key =
      typeof keyOrThread === "string"
        ? normalizeCategoryKey(keyOrThread)
        : normalizeCategoryKey(resolveCategoryKey(keyOrThread));
    return MARKETPLACE_CONNECT_CATEGORY_KEYS.has(key);
  }

  function usesConnectEntryPayment(listing, options) {
    const cat = resolveCategoryKey(listing);
    if (!isMarketplaceConnectCategory(cat)) return false;
    return isCategoryConnectEnabled(listing, cat, options) === true;
  }

  /** skill / product / worker — Connect入口決済ベンチ（決済前はチャット未開始） */
  function isMarketplaceConnectEntryProfile(profile) {
    if (!profile || profile.connect !== true) return false;
    return isMarketplaceConnectCategory(profile);
  }

  /** Connect入口決済で開始したスレッド（完了報告 / work-service フローと分離） */
  function isMarketplaceConnectEntryThread(thread) {
    const Entry = global.TasuPlatformChatConnectEntryFlow;
    if (Entry?.readConnectEntryPaymentFromUrl?.() === true) {
      const urlProfile = Entry.readEntryProfileFromUrl?.() || "";
      if (!urlProfile || isMarketplaceConnectCategory(urlProfile)) return true;
    }
    if (!thread) return false;
    if (thread.connectEntryPayment === true) return true;
    if (Entry?.isConnectEntryThread?.(thread) === true) return true;
    const cat = resolveCategoryKey(thread);
    if (!isMarketplaceConnectCategory(cat)) return false;
    const rs = pickStr(thread.roomStatus, thread.status).toLowerCase();
    const awaitingPartner = pickStr(thread.platformStartPhase) === "awaiting_partner";
    if ((rs === "fee_pending" || awaitingPartner) && usesConnectEntryPayment(thread)) {
      return true;
    }
    return false;
  }

  function getMarketplaceConnectSetupMessage(options) {
    if (options?.bench === true) {
      return "Connectなしのため、Connect決済での購入はできません。";
    }
    return MARKETPLACE_CONNECT_SETUP_MESSAGE;
  }

  function readDemoConnectFlag(context) {
    try {
      if (context && typeof context === "object") {
        if (context.demoConnect === true || context.connect === true) return true;
        if (context.demoConnect === false || context.connect === false) return false;
      }
      const params = new URLSearchParams(global.location?.search || "");
      const q = pickStr(params.get("demoConnect")).toLowerCase();
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function isBusinessServiceConnectEnabled(listing, options) {
    const demoFlag = readDemoConnectFlag(options?.context || listing);
    if (demoFlag === true) return true;
    if (demoFlag === false) return false;

    if (!listing || typeof listing !== "object") return false;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const snap = listing.payment_method_snapshot || fd.payment_method_snapshot || {};

    if (listing.platform_connect_enabled === true || fd.platform_connect_enabled === true) {
      return true;
    }
    if (snap.connect_enabled === true || snap.stripe_connect === true) return true;

    return Boolean(
      listing.stripe_connect_account_id ||
        listing.stripe_account_id ||
        fd.stripe_connect_account_id ||
        fd.stripe_account_id
    );
  }

  function isShopPurchaseConnectEnabled(listing, options) {
    const demoFlag = readDemoConnectFlag(options?.context || listing);
    if (demoFlag === true) return true;
    if (demoFlag === false) return false;

    if (!listing || typeof listing !== "object") return false;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra =
      listing.category_extra?.shop_store && typeof listing.category_extra.shop_store === "object"
        ? listing.category_extra.shop_store
        : {};

    if (listing.platform_connect_enabled === true || fd.platform_connect_enabled === true) {
      return true;
    }

    const payout = global.TasuShopPayout?.extractShopPayout?.(listing);
    if (payout?.payout_enabled && payout?.stripe_account_id) return true;

    return Boolean(
      listing.stripe_connect_account_id ||
        listing.stripe_account_id ||
        fd.stripe_connect_account_id ||
        fd.stripe_account_id ||
        extra.stripe_account_id
    );
  }

  function isCategoryConnectEnabled(listing, categoryKey, options) {
    const key = normalizeCategoryKey(
      categoryKey ||
        (typeof listing === "string" ? listing : resolveCategoryKey(listing))
    );
    if (key === "job") return false;
    if (isShopStoreCategory(key)) return isShopPurchaseConnectEnabled(listing, options);
    if (isBusinessServiceCategory(key)) return isBusinessServiceConnectEnabled(listing, options);
    return global.TasuPlatformChatFee?.hasStripeConnect?.(listing, key) === true;
  }

  function isConnectRequiredRequestIntent(intent) {
    const kind = pickStr(intent).toLowerCase();
    return kind === "purchase" || kind === "request" || kind === "estimate";
  }

  function isProductPurchaseFlowEnabled(listingOrThread, options) {
    if (!isProductFlowCategory(listingOrThread)) return false;
    const entity =
      typeof listingOrThread === "object" && listingOrThread ? listingOrThread : null;
    const opts = entity ? { ...(options || {}), context: entity } : options || {};
    if (isShopStoreCategory(listingOrThread)) {
      if (entity?.platformConnectMode === "shop_checkout") return true;
      if (
        pickStr(entity?.paymentMethod) &&
        pickStr(entity?.platformContactKind, entity?.contact_kind) === "purchase"
      ) {
        return true;
      }
      const listing =
        opts?.listing ||
        (entity?.listingId
          ? global.TasuListingContactRequestsStore?.resolveListing?.(entity.listingId)
          : null) ||
        (entity && !entity.listingType && !entity.listing_type ? entity : null);
      return isShopPurchaseConnectEnabled(listing, opts);
    }
    return true;
  }

  function getShopConnectSetupMessage(options) {
    if (options?.bench === true) return SHOP_CONNECT_BENCH_MESSAGE;
    return SHOP_CONNECT_SETUP_MESSAGE;
  }

  function getConnectRequiredSetupMessage(categoryKey, options) {
    const key = normalizeCategoryKey(categoryKey);
    if (isShopStoreCategory(key)) return getShopConnectSetupMessage(options);
    if (options?.bench === true) return CONNECT_REQUIRED_BENCH_MESSAGE;
    return CONNECT_REQUIRED_SETUP_MESSAGE;
  }

  function shouldAllowConnectRequiredRequest(listing, options) {
    const cat = resolveCategoryKey(listing);
    if (!isConnectRequiredCategory(cat)) return true;
    return isCategoryConnectEnabled(listing, cat, options) === true;
  }

  function applyConnectRequiredListingUiPolicy(listing, root) {
    const cat = resolveCategoryKey(listing);
    if (!isConnectRequiredCategory(cat) || isCategoryConnectEnabled(listing, cat)) {
      return { applied: false };
    }
    const doc = root || global.document;
    if (!doc?.querySelectorAll) return { applied: false, reason: "missing_document" };

    const removeSelectors = [
      "[data-business-service-estimate]",
      "[data-biz-detail-estimate]",
      "[data-biz-detail-sticky-estimate]",
      "[data-shop-product-buy]",
      ".shop-prod-btn--buy",
    ];
    removeSelectors.forEach((sel) => {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const message = getConnectRequiredSetupMessage(cat);
    const hosts = [
      doc.querySelector("[data-bsd-cta-actions]"),
      doc.querySelector("[data-biz-detail-sidebar-actions]"),
      doc.querySelector("#section-shop-products"),
      doc.querySelector("[data-shop-products-root]"),
    ].filter(Boolean);

    hosts.forEach((host) => {
      if (host.querySelector(".connect-required-setup-notice")) return;
      const note = doc.createElement("div");
      note.className = "connect-required-setup-notice";
      note.setAttribute("role", "status");
      note.textContent = message;
      host.insertBefore(note, host.firstChild);
    });

    return { applied: true, message };
  }

  function buildCategorySpec(key) {
    const normalized = normalizeCategoryKey(key);
    const baseKey = resolveFlowBaseKey(normalized);
    const base = CATEGORY_SPECS[baseKey] || CATEGORY_SPECS.skill;
    const identity = CATEGORY_IDENTITY[normalized] || {};
    return {
      ...base,
      ...identity,
      key: pickStr(identity.key, normalized),
    };
  }

  function getCategorySpec(thread) {
    const key =
      typeof thread === "string" ? normalizeCategoryKey(thread) : resolveCategoryKey(thread);
    if (!key) return CATEGORY_SPECS.skill;
    return buildCategorySpec(key);
  }

  function threadStubFromKey(rawKey) {
    const key = normalizeCategoryKey(rawKey);
    const spec = buildCategorySpec(key);
    return { listingType: key, category: spec.label || rawKey };
  }

  function skipsPostChatCompletionFlow(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    return spec.skipsPostChatCompletionFlow === true || spec.key === "job";
  }

  function getContactNotifyCopy(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    const listLabel = pickStr(spec.managementListLabel, "一覧");
    return {
      title: pickStr(spec.contactNotifyTitle),
      body: pickStr(
        spec.contactNotifyBody,
        `${pickStr(spec.contactNotifyTitle)}。${listLabel}で内容を確認してください。`
      ),
      cta: pickStr(spec.contactNotifyCta, "確認する"),
      managementListLabel: listLabel,
      managementView: pickStr(spec.managementView, "contacts"),
      buyerRole: pickStr(spec.buyerRole, "購入者"),
    };
  }

  function getConnectFreeGateCopy(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    const buyer = pickStr(spec.buyerRole, "相手");
    return {
      buyerSubmittedToast:
        pickStr(spec.buyerSubmittedToast) ||
        `${buyer}からの申し込みを受け付けました。確認をお待ちください。`,
      alreadySubmittedToast: pickStr(spec.alreadySubmittedToast, "すでに送信済みです"),
      alreadySubmittedReason: pickStr(spec.alreadySubmittedReason, "already_submitted"),
      ownerCannotSubmitToast: pickStr(spec.ownerCannotSubmitToast, "送信できません"),
    };
  }

  function getPayerPaidNotifyCopy(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    return {
      title: pickStr(spec.payerPaidNotifyTitle, `${pickStr(spec.buyerRole, "相手")}が支払いました`),
      body: pickStr(spec.payerPaidNotifyBody, "入金を確認してください"),
      cta: pickStr(spec.payerPaidNotifyCta, "入金を確認する"),
      payerRoleLabel: pickStr(spec.payerRoleLabel, spec.buyerRole, "相手"),
    };
  }

  function getProductShippedStatusNotice(thread, userId) {
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread)) {
      return pickStr(Purchase.getStatusNotice?.(thread, userId));
    }
    const spec = getCategorySpec(thread);
    if (!isProductFlowCategory(spec.key) || !isProductShipped(thread)) return "";
    const me = pickStr(userId);
    if (me && me === getSellerId(thread)) {
      return pickStr(spec.shipWaitingNoticeSeller, "商品を発送しました。購入者の受取確認をお待ちください。");
    }
    if (me && me === getBuyerId(thread)) {
      return pickStr(
        spec.shipReceivePromptBuyer,
        spec.shipNotifyBody,
        "商品が発送されました。到着後に受取確認を行ってください。"
      );
    }
    return "";
  }

  function getProductShippedNotifyCopy(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    return {
      title: pickStr(spec.shipNotifyTitle, "商品が発送されました"),
      body: pickStr(spec.shipNotifyBody, "出品者から発送通知が届きました。到着後に受け取り完了を申請してください。"),
      cta: pickStr(spec.shipNotifyCta, "確認する"),
    };
  }

  function getChatStartedNotifyCopy(threadOrKey) {
    const spec =
      typeof threadOrKey === "string"
        ? getCategorySpec(threadStubFromKey(threadOrKey))
        : getCategorySpec(threadOrKey);
    return {
      title: pickStr(spec.chatStartedNotifyTitle, "やりとりが開始されました"),
      cta: pickStr(spec.chatStartedNotifyCta, "チャットを開く"),
    };
  }

  function isBuilderThread(thread) {
    if (!thread) return false;
    const kind = pickStr(thread.threadKind, thread.kind, thread.projectKind).toLowerCase();
    const source = pickStr(thread.source, thread.origin).toLowerCase();
    const channel = pickStr(thread.channel, thread.notifyChannel).toLowerCase();
    const scope = pickStr(thread.audienceScope, thread.builderScope).toLowerCase();
    const id = pickStr(thread.id);
    if (kind.includes("builder")) return true;
    if (source.includes("builder")) return true;
    if (channel.includes("builder")) return true;
    if (scope.includes("builder")) return true;
    if (/^builder[-_]/i.test(id)) return true;
    if (String(thread.chatDomain || "").toLowerCase() === "builder") return true;
    return false;
  }

  function isPlatformCompletionThread(thread) {
    if (!thread) return false;
    const key = resolveCategoryKey(thread);
    if (key === "builder") return true;
    if (isBuilderThread(thread)) return false;
    if (global.TasuPlatformChatJobFlow?.isJobThread?.(thread)) return true;
    if (!key) return false;
    if (key === "job") return true;
    return global.TasuPlatformChatFee?.isFeeApplicableCategory?.(key) === true;
  }

  function getBuyerId(thread) {
    const partners = global.TasuPlatformChatDualWindowDemo?.resolveBenchPartnerIds?.(null, thread);
    if (partners?.profile && partners.buyerId) return partners.buyerId;
    return pickStr(thread?.buyerId, thread?.buyer_id);
  }

  function getSellerId(thread) {
    const partners = global.TasuPlatformChatDualWindowDemo?.resolveBenchPartnerIds?.(null, thread);
    if (partners?.profile && partners.sellerId) return partners.sellerId;
    return pickStr(thread?.sellerId, thread?.seller_id);
  }

  function sanitizeUserFacingLabel(str) {
    return global.TasuPlatformChatCompletionFlow?.sanitizeUserFacingLabel?.(str) || pickStr(str);
  }

  function resolveListingCompanyName(thread) {
    return global.TasuPlatformChatCompletionFlow?.resolveListingCompanyName?.(thread) || "";
  }

  function resolveRoleLabel(thread, userId) {
    const spec = getCategorySpec(thread);
    const me = pickStr(userId);
    if (me && me === getSellerId(thread)) return spec.sellerRole;
    if (me && me === getBuyerId(thread)) return spec.buyerRole;
    return "利用者";
  }

  function resolveActorDisplayName(userId, thread) {
    const id = pickStr(userId);
    if (!id) return "利用者";
    const profileName = sanitizeUserFacingLabel(
      global.TasuChatUserIdentity?.getProfileForUserId?.(id)?.displayName
    );
    if (profileName) return profileName;
    const isBuyer = id === getBuyerId(thread);
    const isSeller = id === getSellerId(thread);
    const threadRoleName = sanitizeUserFacingLabel(
      isBuyer ? thread?.buyerName : isSeller ? thread?.sellerName : ""
    );
    if (threadRoleName) return threadRoleName;
    if (isSeller) {
      const company = resolveListingCompanyName(thread);
      if (company) return company;
    }
    return resolveRoleLabel(thread, userId);
  }

  function formatActorParticle(name) {
    const n = pickStr(name);
    if (!n) return "が";
    if (ROLE_PARTICLE_WORDS.has(n)) return "が";
    if (/株式会社|有限会社|合同会社|（株）|\(株\)/.test(n)) return "が";
    return "さんが";
  }

  function formatCompletionRequestMessage(thread, actorName, userId) {
    const spec = getCategorySpec(thread);
    const actor =
      sanitizeUserFacingLabel(actorName) ||
      resolveActorDisplayName(userId, thread) ||
      resolveRoleLabel(thread, userId);
    return `${actor}${formatActorParticle(actor)}${spec.requestSuffix}`;
  }

  function getLabels(thread) {
    const spec = getCategorySpec(thread);
    return {
      categoryKey: spec.key,
      categoryLabel: spec.label,
      sellerRole: spec.sellerRole,
      buyerRole: spec.buyerRole,
      completeBtn: spec.completeBtn,
      completeDone: spec.completeDone,
      pendingBtn: spec.pendingBtn,
      approveBtn: spec.approveBtn,
      cancelBtn: "キャンセル",
      modalTitle: spec.modalTitle,
      cancelModalTitle: spec.cancelModalTitle,
      cancelModalBody: spec.cancelModalBody,
      cancelSubmitLabel: "終了する",
      confirmBody: spec.confirmBody,
      submitLabel: "申請する",
      requestSystem: (name, userId) => formatCompletionRequestMessage(thread, name, userId),
      doneSystem: spec.doneSystem,
      notifyRequestTitle: (name, userId) => formatCompletionRequestMessage(thread, name, userId),
      completedNotice: spec.completedNotice,
      completedPlaceholder: spec.completedPlaceholder,
      cancelledPlaceholder: spec.cancelledPlaceholder,
      reviewBtn: "レビューする",
      reviewTitle: spec.reviewTitle,
      reviewSub: spec.reviewSub,
      reviewPromptTitle: pickStr(spec.reviewPromptTitle),
      reviewPromptBody: pickStr(spec.reviewPromptBody, REVIEW_PROMPT_BODY),
      reviewPromptShowStars: spec.reviewPromptShowStars === true,
      reviewPromptBtn: spec.reviewPromptBtn,
      reviewPromptDone: REVIEW_PROMPT_DONE,
      connectPendingTitle: pickStr(spec.connectPendingTitle, spec.pendingContentLabel, "内容を確認してください"),
      pendingContentLabel: pickStr(spec.pendingContentLabel),
      connectPendingBody: pickStr(spec.connectPendingBody, "承認すると報酬が支払われます。"),
      contactNotifyTitle: spec.contactNotifyTitle,
      contactNotifyCta: spec.contactNotifyCta,
      managementListLabel: spec.managementListLabel,
      payerPaidNotifyTitle: spec.payerPaidNotifyTitle,
      payerPaidNotifyBody: spec.payerPaidNotifyBody,
      payerPaidNotifyCta: spec.payerPaidNotifyCta,
      payerRoleLabel: pickStr(spec.payerRoleLabel, spec.buyerRole),
      chatStartedNotifyTitle: spec.chatStartedNotifyTitle,
      chatStartedNotifyCta: spec.chatStartedNotifyCta,
      approvedAwaitingPaymentSystem: spec.approvedAwaitingPaymentSystem,
      rejectBtn: spec.rejectBtn || "キャンセルする",
      completionCardTitle: spec.completionCardTitle,
      completionCardGuide: spec.completionCardGuide,
      sellerCompleteBtn: spec.sellerCompleteBtn || "",
      sellerModalTitle: spec.sellerModalTitle || spec.sellerCompleteBtn || "",
      sellerConfirmBody: spec.sellerConfirmBody || "",
      shipSystem: spec.shipSystem || "",
      receiveBtn: spec.receiveBtn || "",
      receiveSystem: spec.receiveSystem || spec.doneSystem || "",
    };
  }

  const MARKETPLACE_CONNECT_CONFIRM_CARD_KIND = "marketplace_connect_confirm_card";

  function buildMarketplaceConnectConfirmCard(threadId, thread) {
    const labels = getLabels(thread);
    const listingTitle = pickStr(thread?.listingTitle, labels.categoryLabel, "対象案件");
    return {
      title: pickStr(labels.connectPendingTitle, labels.pendingContentLabel, "内容を確認してください"),
      body: pickStr(
        labels.connectPendingBody,
        "内容をご確認のうえ、受け取りを確定してください。"
      ),
      listingTitle,
      status: "pending",
    };
  }

  function appendMarketplaceConnectConfirmCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    if (!id || !isMarketplaceConnectEntryThread(thread)) {
      return { ok: false, reason: "not_applicable" };
    }
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      if (list.some((m) => m.kind === MARKETPLACE_CONNECT_CONFIRM_CARD_KIND)) {
        return { ok: true, skipped: true };
      }
      const now = pickStr(thread?.productShippedAt, thread?.completionRequestedAt) || new Date().toISOString();
      const card = buildMarketplaceConnectConfirmCard(id, thread);
      list.push({
        id: `msg-${id}-marketplace-connect-confirm`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: now,
        kind: MARKETPLACE_CONNECT_CONFIRM_CARD_KIND,
        marketplaceConnectConfirmCard: card,
      });
      map[id] = list;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function removeMarketplaceConnectConfirmCard(threadId) {
    const id = pickStr(threadId);
    if (!id) return;
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      const next = list.filter((m) => m.kind !== MARKETPLACE_CONNECT_CONFIRM_CARD_KIND);
      if (next.length === list.length) return;
      map[id] = next;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function renderMarketplaceConnectConfirmCardHtml(message, thread) {
    const room = thread || null;
    const fromMsg = message?.marketplaceConnectConfirmCard || {};
    const card = {
      ...buildMarketplaceConnectConfirmCard(pickStr(room?.id, message?.roomId), room),
      ...fromMsg,
    };
    const title = pickStr(card.title, "内容を確認してください");
    const body = pickStr(card.body);
    const listingTitle = pickStr(card.listingTitle);
    return (
      `<div class="chat-job-card-wrap" data-marketplace-connect-confirm-card>` +
      `<article class="chat-job-card chat-job-card--pending" aria-label="${esc(title)}">` +
      `<h3 class="chat-job-card__title">${esc(title)}</h3>` +
      (listingTitle ? `<p class="chat-job-card__job">${esc(listingTitle)}</p>` : "") +
      (body ? `<p class="chat-job-card__guide">${esc(body)}</p>` : "") +
      `</article>` +
      `</div>`
    );
  }

  function getReviewTitleForUser(thread) {
    return getLabels(thread).reviewTitle;
  }

  function getReviewTargetLabel(thread, userId) {
    const spec = getCategorySpec(thread);
    const me = pickStr(userId);
    const partnerName =
      me && me === getSellerId(thread)
        ? pickStr(sanitizeUserFacingLabel(thread?.buyerName), spec.buyerRole)
        : pickStr(
            sanitizeUserFacingLabel(thread?.sellerName),
            resolveListingCompanyName(thread),
            spec.sellerRole
          );
    return `評価対象：${pickStr(sanitizeUserFacingLabel(partnerName), partnerName, "相手")}`;
  }

  function getCompletionRequesterId(thread) {
    const spec = getCategorySpec(thread);
    return spec.requester === "buyer" ? getBuyerId(thread) : getSellerId(thread);
  }

  function canRequestCompletion(thread, userId) {
    if (isMarketplaceConnectEntryThread(thread)) return false;
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread)) return false;
    if (!isPlatformCompletionThread(thread)) return false;
    const status =
      global.TasuPlatformChatCompletionFlow?.getCompletionStatus?.(thread) || "active";
    if (status !== "active") return false;
    const me = pickStr(userId);
    const requesterId = getCompletionRequesterId(thread);
    if (!me || !requesterId || me !== requesterId) return false;
    return true;
  }

  function isProductShipped(thread) {
    return Boolean(thread?.productShipped || thread?.product_shipped);
  }

  function canMarkProductShipped(thread, userId) {
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread)) {
      return Purchase.canMarkProductShipped?.(thread, userId) === true;
    }
    if (isMarketplaceConnectEntryThread(thread)) {
      const status =
        global.TasuPlatformChatCompletionFlow?.getCompletionStatus?.(thread) || "active";
      if (status !== "active") return false;
      const me = pickStr(userId);
      return me === getSellerId(thread) && !isProductShipped(thread);
    }
    return false;
  }

  function requiresWorkReportForm(thread) {
    if (!isWorkerFlowCategory(thread)) return false;
    if (global.TasuPlatformChatPurchasePaymentFlow?.appliesToThread?.(thread) === true) {
      return false;
    }
    if (isMarketplaceConnectEntryThread(thread)) return false;
    return isPlatformCompletionThread(thread);
  }

  function getPrimaryActionMode(thread, userId) {
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread)) {
      return pickStr(Purchase.getPrimaryActionMode?.(thread, userId));
    }
    const flow = global.TasuPlatformChatCompletionFlow;
    const status = flow?.getCompletionStatus?.(thread) || "active";
    const me = pickStr(userId);
    if (isMarketplaceConnectEntryThread(thread)) {
      if (status === "completion_pending") {
        if (me === pickStr(thread?.completionRequestedBy)) return "pending";
        if (flow?.canApproveCompletion?.(thread, userId)) return "approve";
        return "";
      }
      if (status === "active" && canMarkProductShipped(thread, userId)) return "ship";
      return "";
    }
    const requesterId = pickStr(thread?.completionRequestedBy);
    if (status === "completion_pending") {
      if (requesterId && requesterId === me) return "pending";
      if (flow?.canApproveCompletion?.(thread, userId)) return "approve";
      return "";
    }
    if (status === "awaiting_payment") return "";
    if (!isWorkerFlowCategory(thread) && !isBusinessServiceCategory(thread)) {
      if (canMarkProductShipped(thread, userId)) return "ship";
    }
    if (flow?.canApproveCompletion?.(thread, userId)) return "approve";
    if (canRequestCompletion(thread, userId)) return "request";
    return "";
  }

  function getPrimaryActionLabel(thread, userId) {
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread)) {
      return pickStr(Purchase.getPrimaryActionLabel?.(thread, userId));
    }
    const spec = getCategorySpec(thread);
    const mode = getPrimaryActionMode(thread, userId);
    if (mode === "pending") return spec.pendingBtn;
    if (mode === "approve") {
      if (isMarketplaceConnectEntryThread(thread)) {
        return spec.receiveBtn || spec.approveBtn;
      }
      return spec.approveBtn;
    }
    if (mode === "ship") return spec.sellerCompleteBtn || "発送完了";
    if (mode === "request") return spec.completeBtn;
    return "";
  }

  function canShowPrimaryAction(thread, userId) {
    return Boolean(getPrimaryActionMode(thread, userId));
  }

  function isReviewEligible(thread, userId) {
    if (!isPlatformCompletionThread(thread)) return false;
    if (skipsPostChatCompletionFlow(thread)) return false;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs !== "completed") return false;
    if (isMarketplaceConnectEntryThread(thread)) return true;
    const Purchase = global.TasuPlatformChatPurchasePaymentFlow;
    if (Purchase?.appliesToThread?.(thread) === true) {
      if (userId) return Purchase.isReadyForReview?.(thread, userId) === true;
      return Purchase.isCompleted?.(thread) === true;
    }
    const WorkSvc = global.TasuPlatformChatWorkServiceConnectFlow;
    if (WorkSvc?.isWorkServiceConnectThread?.(thread) === true) {
      return WorkSvc.isReadyForReview?.(thread, userId) === true;
    }
    const Connect = global.TasuPlatformChatConnectChatFlow;
    if (Connect?.isConnectThread?.(thread) === true && Connect?.isPaymentCompletedForReview) {
      return Connect.isPaymentCompletedForReview(thread) === true;
    }
    const manual = global.TasuPlatformChatManualTransferFlow;
    if (manual?.isManualTransferActive?.(thread) === true) {
      return manual.isPaymentConfirmedForReview?.(thread) === true;
    }
    return true;
  }

  /** チャット内レビュー常設は不可 — TALK通知→レビュー画面のみ */
  function shouldShowReviewPrompt(thread, userId) {
    return false;
  }

  function hasUserSubmittedReview(threadId, userId) {
    return global.TasuPlatformChatReviewFlow?.hasUserSubmittedReview?.(threadId, userId) === true;
  }

  function renderReviewPromptCardHtml(thread, options) {
    const labels = getLabels(thread);
    const reviewed = options?.reviewed === true;
    const cardLabel = pickStr(labels.reviewPromptTitle, labels.reviewPromptBody, "レビュー");
    const titleHtml = labels.reviewPromptTitle
      ? `<h3 class="chat-job-review-prompt__title">${esc(labels.reviewPromptTitle)}</h3>`
      : "";
    const starsHtml = labels.reviewPromptShowStars
      ? `<p class="chat-job-review-prompt__stars" aria-hidden="true">★★★★★</p>`
      : "";
    const action =
      global.TasuPlatformChatReviewFlow?.renderReviewOpenActionHtml?.(thread, pickStr(options?.userId), {
        reviewed,
        labels,
      }) ||
      (reviewed
        ? `<p class="chat-job-review-prompt__done" role="status">${esc(labels.reviewPromptDone)}</p>`
        : `<button type="button" class="chat-job-review-prompt__btn" data-platform-review-open data-platform-job-review-open aria-label="${esc(labels.reviewPromptBtn)}">${esc(labels.reviewPromptBtn)}</button>`);
    return (
      `<div class="chat-job-review-prompt-wrap" data-platform-job-review-prompt>` +
      `<article class="chat-job-review-prompt" aria-label="${esc(cardLabel)}">` +
      titleHtml +
      `<p class="chat-job-review-prompt__body">${esc(labels.reviewPromptBody)}</p>` +
      starsHtml +
      action +
      `</article>` +
      `</div>`
    );
  }

  function appendPlatformCompletionCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    if (
      !isMarketplaceConnectEntryThread(thread) &&
      global.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(thread) === true
    ) {
      return { ok: true, skipped: true, reason: "work_service_notify_only" };
    }
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false };
    const labels = getLabels(thread);
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? [...map[id]] : [];
      if (list.some((m) => m.kind === "platform_completion_card")) {
        return { ok: true, skipped: true };
      }
      list.push({
        id: `msg-${id}-platform-completion-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: new Date().toISOString(),
        kind: "platform_completion_card",
        platformCompletionCard: {
          cardTitle: labels.completionCardTitle,
          listingTitle: pickStr(thread?.listingTitle, labels.categoryLabel),
          guide: labels.completionCardGuide,
          completedAt: new Date().toISOString(),
          categoryKey: labels.categoryKey,
        },
      });
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap({ [id]: list });
      } else {
        map[id] = list;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function renderPlatformCompletionCardHtml(message, thread, userId) {
    const WorkSvc = global.TasuPlatformChatWorkServiceConnectFlow;
    if (
      !isMarketplaceConnectEntryThread(thread) &&
      WorkSvc?.isWorkServiceConnectThread?.(thread) === true
    ) {
      return "";
    }
    const card = message?.platformCompletionCard || {};
    const title = pickStr(card.cardTitle, "取引が完了しました");
    const listingTitle = pickStr(card.listingTitle, "");
    const guide = pickStr(card.guide, "");
    return (
      `<div class="chat-job-card-wrap" data-platform-completion-card>` +
      `<article class="chat-job-card chat-job-card--completion" aria-label="${esc(title)}">` +
      `<h3 class="chat-job-card__title">${esc(title)}</h3>` +
      (listingTitle ? `<p class="chat-job-card__job">${esc(listingTitle)}</p>` : "") +
      (guide ? `<p class="chat-job-card__guide">${esc(guide)}</p>` : "") +
      `</article>` +
      `</div>`
    );
  }

  global.TasuPlatformChatCategoryFlow = {
    CATEGORY_SPECS,
    PLATFORM_CATEGORY_KEYS,
    REVIEW_PROMPT_BODY,
    REVIEW_PROMPT_DONE,
    normalizeCategoryKey,
    resolveCategoryKey,
    resolveFlowBaseKey,
    isProductFlowCategory,
    isWorkerFlowCategory,
    isShopStoreCategory,
    isBusinessServiceCategory,
    isConnectRequiredCategory,
    isConnectFreeFeeCategory,
    isMarketplaceConnectCategory,
    usesConnectEntryPayment,
    isMarketplaceConnectEntryProfile,
    isMarketplaceConnectEntryThread,
    MARKETPLACE_CONNECT_CATEGORY_KEYS,
    MARKETPLACE_CONNECT_SETUP_MESSAGE,
    getMarketplaceConnectSetupMessage,
    readDemoConnectFlag,
    isShopPurchaseConnectEnabled,
    isBusinessServiceConnectEnabled,
    isCategoryConnectEnabled,
    isConnectRequiredRequestIntent,
    isProductPurchaseFlowEnabled,
    CONNECT_FREE_FEE_CATEGORY_KEYS,
    CONNECT_REQUIRED_CATEGORY_KEYS,
    SHOP_CONNECT_SETUP_MESSAGE,
    SHOP_CONNECT_BENCH_MESSAGE,
    CONNECT_REQUIRED_SETUP_MESSAGE,
    CONNECT_REQUIRED_BENCH_MESSAGE,
    getShopConnectSetupMessage,
    getConnectRequiredSetupMessage,
    shouldAllowConnectRequiredRequest,
    applyConnectRequiredListingUiPolicy,
    getCategorySpec,
    threadStubFromKey,
    skipsPostChatCompletionFlow,
    getContactNotifyCopy,
    getConnectFreeGateCopy,
    getPayerPaidNotifyCopy,
    getProductShippedNotifyCopy,
    getProductShippedStatusNotice,
    getChatStartedNotifyCopy,
    POST_CHAT_COMPLETION_STEP_IDS,
    isBuilderThread,
    isPlatformCompletionThread,
    getLabels,
    getReviewTitleForUser,
    getReviewTargetLabel,
    resolveActorDisplayName,
    resolveRoleLabel,
    formatActorParticle,
    formatCompletionRequestMessage,
    getCompletionRequesterId,
    canRequestCompletion,
    canMarkProductShipped,
    requiresWorkReportForm,
    isProductShipped,
    getPrimaryActionMode,
    getPrimaryActionLabel,
    canShowPrimaryAction,
    isReviewEligible,
    shouldShowReviewPrompt,
    hasUserSubmittedReview,
    renderReviewPromptCardHtml,
    appendPlatformCompletionCard,
    renderPlatformCompletionCardHtml,
    MARKETPLACE_CONNECT_CONFIRM_CARD_KIND,
    appendMarketplaceConnectConfirmCard,
    removeMarketplaceConnectConfirmCard,
    renderMarketplaceConnectConfirmCardHtml,
    getBuyerId,
    getSellerId,
  };
})(typeof window !== "undefined" ? window : globalThis);
