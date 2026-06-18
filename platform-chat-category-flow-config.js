/**
 * 全カテゴリ共通 — 期待フロー定義（通知→CTA→チャット→完了→レビュー）
 */
(function (global) {
  "use strict";

  const pickStr = (...vals) => {
    for (const v of vals) {
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  /** @typedef {"active"|"end_requested"|"completion_requested"|"completion_reported"|"closed"|"completed"} FlowStage */

  const COMMON_DIAGNOSTICS = Object.freeze([
    "expectedNotificationA",
    "expectedNotificationB",
    "actualNotificationA",
    "actualNotificationB",
    "notificationExists",
    "recipientMatches",
    "notificationDomVisible",
    "expectedCtaLabel",
    "actualCtaLabel",
    "ctaHref",
    "ctaThreadId",
    "threadExists",
    "roomExists",
    "chatLookupResult",
    "chatOpenedA",
    "chatOpenedB",
    "chatLoadReadyA",
    "chatLoadReadyB",
    "messageAtoB",
    "messageBtoA",
    "composerEnabledA",
    "composerEnabledB",
    "expectedCompletionButtonA",
    "expectedCompletionButtonB",
    "actualCompletionButtonA",
    "actualCompletionButtonB",
    "completionButtonVisibleA",
    "completionButtonVisibleB",
    "completionStatus",
    "roomStatus",
    "reviewNotificationA",
    "reviewNotificationB",
    "reviewTargetA",
    "reviewTargetB",
    "reviewCtaVisibleA",
    "reviewCtaVisibleB",
    "reviewSubmittedA",
    "reviewSubmittedB",
    "duplicateReviewBlocked",
  ]);

  /** @type {Record<string, object>} */
  const CATEGORY_FLOW_CONFIGS = Object.freeze({
    job: {
      category: "job",
      label: "求人",
      demoProfiles: ["job"],
      actorA: { role: "poster", label: "掲載者" },
      actorB: { role: "applicant", label: "応募者" },
      expectedSteps: [
        "apply_notify",
        "hire_notify",
        "fee_pay",
        "chat_started",
        "active_chat",
        "end_request",
        "end_confirm",
        "closed",
        "review",
      ],
      expectedNotifications: {
        applyA: { title: "応募が届きました", recipient: "A" },
        hiredB: { title: "応募が承諾されました", recipient: "B" },
        completionAB: { title: "やり取りが完了しました", recipient: "both" },
      },
      expectedCta: {
        applyA: "応募者を確認する",
        hiredB: "やり取りチャットを開く",
        review: "レビューする",
      },
      completionFlow: { type: "job_end_two_step", skipsPostChatCompletionFlow: true },
      expectedReviewFlow: { dualNotify: true, reviewPerSide: true },
      expectedDiagnostics: [
        ...COMMON_DIAGNOSTICS,
        "hasAnyMessage",
        "canRequestEnd",
        "canConfirmEnd",
        "requestEndButtonVisible",
        "confirmEndButtonVisible",
        "buttonHiddenReason",
        "chatJobEndBarExists",
        "requestButtonVisible",
      ],
      stages: {
        active: {
          expectedCompletionActor: "A",
          expectedButtonA: "終了を依頼する",
          expectedButtonB: "none",
          bButtonHiddenOk: true,
          composerEnabled: true,
        },
        end_requested: {
          expectedCompletionActor: "B",
          expectedButtonA: "依頼済み表示",
          expectedButtonB: "やり取りを完了する",
          composerEnabled: true,
        },
        closed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
        completed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
      },
      benchNotifyTarget: { side: "B", titleMatch: /応募が承諾されました/ },
    },

    general: {
      category: "general",
      label: "一般案件",
      demoProfiles: ["general"],
      actorA: { role: "requester", label: "依頼者" },
      actorB: { role: "contractor", label: "出品者/受注者" },
      expectedSteps: [
        "request_notify",
        "accept_notify",
        "chat_started",
        "active_chat",
        "completion_request",
        "completion_approve",
        "completed",
        "review",
      ],
      expectedNotifications: {
        requestA: { title: "応募/依頼が届きました", recipient: "A" },
        startedB: { title: "やりとりが開始されました", recipient: "B" },
        completionAB: { title: "やり取りが完了しました", recipient: "both" },
      },
      expectedCta: {
        requestA: "応募者/依頼者を確認する",
        chat: "チャットを開く",
        review: "レビューする",
      },
      completionFlow: { type: "request_approve", requesterSide: "B", approverSide: "A" },
      expectedReviewFlow: { dualNotify: true, reviewPerSide: true },
      expectedDiagnostics: COMMON_DIAGNOSTICS,
      stages: {
        active: {
          expectedCompletionActor: "B",
          expectedButtonA: "none",
          expectedButtonB: "完了申請する",
          bButtonHiddenOk: false,
          composerEnabled: true,
        },
        completion_requested: {
          expectedCompletionActor: "A",
          expectedButtonA: "完了を承認する",
          expectedButtonB: "申請済み",
          composerEnabled: true,
        },
        completed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
      },
      benchNotifyTarget: { side: "A", titleMatch: /応募|依頼が届きました/ },
    },

    purchase_no_connect: {
      category: "purchase_no_connect",
      label: "Connectなし購入",
      demoProfiles: ["skill", "product", "shop", "business", "worker"],
      actorA: { role: "buyer", label: "購入者" },
      actorB: { role: "seller", label: "掲載者" },
      expectedSteps: [
        "purchase_notify",
        "payer_paid_notify",
        "chat_started",
        "active_chat",
        "completion_request",
        "completion_approve",
        "manual_transfer",
        "completed",
        "review",
      ],
      expectedNotifications: {
        purchaseB: { title: /購入|予約|相談|依頼が/, recipient: "B" },
        payerPaidB: { title: /支払いました|入金/, recipient: "B" },
        completionAB: { title: "取引が完了しました", recipient: "both" },
      },
      expectedCta: {
        purchase: /確認する/,
        chat: "チャットを開く",
        review: "レビューする",
      },
      completionFlow: { type: "request_approve", requesterSide: "B", approverSide: "A", manualTransfer: true },
      expectedReviewFlow: { dualNotify: true, reviewPerSide: true },
      expectedDiagnostics: [
        ...COMMON_DIAGNOSTICS,
        "payoutInfoVisible",
        "contactInfoVisible",
        "noConnectPaymentInstructionVisible",
      ],
      stages: {
        active: {
          expectedCompletionActor: "B",
          expectedButtonA: "none",
          expectedButtonB: "取引完了を申請する",
          composerEnabled: true,
        },
        completion_requested: {
          expectedCompletionActor: "A",
          expectedButtonA: "取引完了を承認する",
          expectedButtonB: "申請済み",
          composerEnabled: true,
        },
        completed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
      },
      benchNotifyTarget: { side: "B", titleMatch: /購入|予約|相談|依頼が/ },
    },

    purchase_connect: {
      category: "purchase_connect",
      label: "Connectあり購入",
      demoProfiles: ["connect"],
      actorA: { role: "buyer", label: "購入者" },
      actorB: { role: "seller", label: "掲載者" },
      expectedSteps: [
        "purchase_notify",
        "chat_started",
        "active_chat",
        "delivery_request",
        "completion_approve",
        "stripe_payment",
        "completed",
        "review",
      ],
      expectedNotifications: {
        purchaseB: { title: /購入/, recipient: "B" },
        completionAB: { title: "取引が完了しました", recipient: "both" },
      },
      expectedCta: { purchase: "購入者を確認する", chat: "チャットを開く", review: "レビューする" },
      completionFlow: { type: "connect_request_approve", requesterSide: "B", approverSide: "A" },
      expectedReviewFlow: { dualNotify: true, reviewPerSide: true },
      expectedDiagnostics: [
        ...COMMON_DIAGNOSTICS,
        "stripePaymentStatus",
        "connectAccountStatus",
        "transferStatus",
        "payoutStatus",
      ],
      stages: {
        active: {
          expectedCompletionActor: "B",
          expectedButtonA: "none",
          expectedButtonB: "納品/完了申請する",
          composerEnabled: true,
        },
        completion_requested: {
          expectedCompletionActor: "A",
          expectedButtonA: "承認する",
          expectedButtonB: "申請済み",
          composerEnabled: true,
        },
        completed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
      },
      benchNotifyTarget: { side: "B", titleMatch: /購入/ },
    },

    builder: {
      category: "builder",
      label: "Builder",
      demoProfiles: ["builder"],
      actorA: { role: "prime", label: "元請け/依頼者" },
      actorB: { role: "partner", label: "パートナー" },
      expectedSteps: [
        "apply_notify",
        "assign_notify",
        "chat_started",
        "active_chat",
        "completion_report",
        "completion_approve",
        "completed",
        "review",
      ],
      expectedNotifications: {
        applyA: { title: /案件応募|依頼が届きました/, recipient: "A" },
        completionAB: { title: "案件が完了しました", recipient: "both" },
      },
      expectedCta: { apply: "応募者/依頼者を確認する", chat: "チャットを開く", review: "レビューする" },
      completionFlow: { type: "report_approve", reporterSide: "B", approverSide: "A" },
      expectedReviewFlow: { dualNotify: true, reviewPerSide: true },
      expectedDiagnostics: [
        ...COMMON_DIAGNOSTICS,
        "sitePhotosUploaded",
        "reportPdfGenerated",
        "completionReportVisible",
        "approvalButtonVisible",
        "builderProjectStatus",
      ],
      stages: {
        active: {
          expectedCompletionActor: "B",
          expectedButtonA: "none",
          expectedButtonB: "完了報告する",
          composerEnabled: true,
        },
        completion_reported: {
          expectedCompletionActor: "A",
          expectedButtonA: "完了を承認する",
          expectedButtonB: "報告済み",
          composerEnabled: true,
        },
        completed: {
          expectedButtonA: "レビューをする",
          expectedButtonB: "レビューをする",
          composerEnabled: false,
        },
      },
      benchNotifyTarget: { side: "A", titleMatch: /案件応募|依頼が届きました/ },
    },
  });

  const DEMO_PROFILE_TO_CONFIG = Object.freeze({
    job: "job",
    general: "general",
    skill: "purchase_no_connect",
    product: "purchase_no_connect",
    shop: "purchase_no_connect",
    business: "purchase_no_connect",
    worker: "purchase_no_connect",
    connect: "purchase_connect",
    builder: "builder",
  });

  function resolveConfigKey(profileOrKey, options) {
    const raw = pickStr(profileOrKey?.categoryKey, profileOrKey?.id, profileOrKey);
    if (CATEGORY_FLOW_CONFIGS[raw]) return raw;
    if (options?.connect === true || raw === "connect") return "purchase_connect";
    return DEMO_PROFILE_TO_CONFIG[raw] || raw || "job";
  }

  function getCategoryFlowConfig(profileOrKey, options) {
    const key = resolveConfigKey(profileOrKey, options);
    return CATEGORY_FLOW_CONFIGS[key] || CATEGORY_FLOW_CONFIGS.job;
  }

  function resolveFlowStage(roomStatus, jobStatus, completionStatus, config) {
    const rs = pickStr(roomStatus, completionStatus).toLowerCase();
    const js = pickStr(jobStatus).toLowerCase();
    if (rs === "closed" || rs === "completed" || js === "completed") return "completed";
    if (rs === "end_requested" || js === "end_requested") return "end_requested";
    if (rs === "completion_pending" || rs === "completion_requested") return "completion_requested";
    if (rs === "completion_reported") return "completion_reported";
    if (config?.category === "builder" && rs === "reported") return "completion_reported";
    return "active";
  }

  function getStageExpectations(config, stage) {
    const cfg = config || CATEGORY_FLOW_CONFIGS.job;
    return cfg.stages?.[stage] || cfg.stages?.active || {};
  }

  global.TasuPlatformChatCategoryFlowConfig = {
    CATEGORY_FLOW_CONFIGS,
    DEMO_PROFILE_TO_CONFIG,
    COMMON_DIAGNOSTICS,
    getCategoryFlowConfig,
    resolveConfigKey,
    resolveFlowStage,
    getStageExpectations,
  };
})(typeof window !== "undefined" ? window : globalThis);
