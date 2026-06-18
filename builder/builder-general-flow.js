/**
 * TASFUL Builder — 一般案件フロー（General Flow）
 * partner_user / user_user / vendor_user の共通ライフサイクル定義。
 * ops_partner は対象外（運営専用フローは builder.js 側で維持）。
 */
(function (global) {
  "use strict";

  const GENERAL_FLOW_ID = "general_flow";
  const GENERAL_FLOW_VARIANT_IDS = Object.freeze(["partner_user", "user_user", "vendor_user"]);
  const GENERAL_FLOW_VARIANT_SET = new Set(GENERAL_FLOW_VARIANT_IDS);

  const PUBLIC_BOARD_JOB_ID = "pub-board-job-001";
  const PUBLIC_BOARD_PROJECT_ID = "pub-board-project-001";

  /** 全バリアント共通の取引ライフサイクル */
  const GENERAL_FLOW_LIFECYCLE = Object.freeze([
    "project_detail",
    "apply",
    "application_notify",
    "decline_or_start_chat",
    "chat",
    "completion_submit",
    "completion_approve",
    "chat_lock",
    "review_request",
    "review_submit",
    "review_notify",
  ]);

  const GENERAL_FLOW_THREAD_UI_BASE = Object.freeze({
    defaultRole: "user",
    features: { sitePhotos: false, reports: false, completion: false, siteEntry: false, calendarLink: false },
    workflow: ["相談", "見積", "日程調整", "作業完了確認", "レビュー"],
  });

  const GENERAL_FLOW_VARIANTS = Object.freeze({
    partner_user: {
      id: "partner_user",
      threadType: "partner_user",
      title: "ベンチ検証 — キッチンリフォーム相談",
      poster: { role: "partner", id: "demo-partner-002", name: "佐藤建設" },
      applicant: { role: "user", id: "demo-builder-user", name: "田中 花子" },
      publicDetail: { page: "public-board-detail.html", id: PUBLIC_BOARD_JOB_ID, type: "job" },
      benchBuilderFlowParam: "partner_user",
      bench: {
        label: "パートナー ⇔ 一般ユーザー",
        kind: "mvp",
        threadType: "partner_user",
        generalPosterSide: "A",
        projectDetailPage: "public",
        threadId: "thread-demo-002",
        urlId: "demo-thread-002",
        sideA: {
          key: "A",
          role: "partner",
          label: "パートナー",
          actor: { id: "demo-partner-002", type: "partner", name: "佐藤建設" },
          notifyRecipient: "user",
        },
        sideB: {
          key: "B",
          role: "user",
          label: "一般ユーザー",
          actor: { id: "demo-builder-user", type: "user", name: "田中 花子" },
          notifyRecipient: "partner",
        },
      },
      threadUi: {
        typeLabel: "パートナー",
        typeLabelPartner: "一般ユーザー",
        listTitle: "パートナーとのやりとり",
        listTitlePartner: "一般ユーザーとのやりとり",
        listSub: "相談・見積・日程の調整",
        detailSub: "パートナーとのやりとり",
        detailSubPartner: "一般ユーザーとのやりとり",
        workflow: ["相談", "見積", "日程調整", "現地確認", "作業完了確認"],
      },
    },
    user_user: {
      id: "user_user",
      threadType: "user_user",
      title: "ベンチ検証 — 外壁塗装の業者紹介",
      poster: { role: "user", id: "demo-builder-user", name: "田中 花子" },
      applicant: { role: "user", id: "demo-user-peer-001", name: "鈴木 美咲" },
      publicDetail: { page: "public-board-detail.html", id: PUBLIC_BOARD_PROJECT_ID, type: "project" },
      bench: {
        label: "一般ユーザー ⇔ 一般ユーザー",
        kind: "mvp",
        threadType: "user_user",
        generalPosterSide: "A",
        threadId: "thread-demo-007",
        urlId: "demo-thread-007",
        sideA: {
          key: "A",
          role: "user",
          label: "一般ユーザー1",
          actor: { id: "demo-builder-user", type: "builder", name: "田中 花子" },
          notifyRecipient: "user",
        },
        sideB: {
          key: "B",
          role: "user",
          label: "一般ユーザー2",
          actor: { id: "demo-user-peer-001", type: "builder", name: "鈴木 美咲" },
          notifyRecipient: "user",
        },
      },
      threadUi: {
        typeLabel: "一般ユーザー",
        listTitle: "一般ユーザーとのやりとり",
        listSub: "個人間の相談・紹介・日程調整",
        detailSub: "一般ユーザーとのやりとり",
        workflow: ["相談", "見積", "日程調整", "作業完了確認"],
      },
    },
    vendor_user: {
      id: "vendor_user",
      threadType: "vendor_user",
      title: "ベンチ検証 — 設備修理の相談",
      poster: { role: "user", id: "demo-builder-user", name: "田中 花子" },
      applicant: { role: "vendor", id: "demo-vendor-001", name: "港区設備サービス" },
      publicDetail: { page: "public-board-detail.html", id: PUBLIC_BOARD_PROJECT_ID, type: "project" },
      bench: {
        label: "業者 ⇔ 一般ユーザー",
        kind: "mvp",
        threadType: "vendor_user",
        generalPosterSide: "B",
        threadId: "thread-demo-008",
        urlId: "demo-thread-008",
        sideA: {
          key: "A",
          role: "vendor",
          label: "業者登録者",
          actor: { id: "demo-vendor-001", type: "vendor", name: "港区設備サービス" },
          notifyRecipient: "user",
        },
        sideB: {
          key: "B",
          role: "user",
          label: "一般ユーザー",
          actor: { id: "demo-builder-user", type: "user", name: "田中 花子" },
          notifyRecipient: "vendor",
        },
      },
      threadUi: {
        typeLabel: "業者",
        typeLabelVendor: "一般ユーザー",
        listTitle: "業者とのやりとり",
        listTitleVendor: "一般ユーザーとのやりとり",
        listSub: "見積・日程・作業範囲の確認",
        detailSub: "業者とのやりとり",
        detailSubVendor: "一般ユーザーとのやりとり",
        workflow: ["相談", "見積", "日程調整", "作業完了確認"],
      },
    },
  });

  function isGeneralFlowVariant(id) {
    return GENERAL_FLOW_VARIANT_SET.has(String(id || "").trim());
  }

  function isGeneralFlowProject(project) {
    return isGeneralFlowVariant(project?.bench_flow_id || project?.benchFlowId);
  }

  function getGeneralFlowVariantIds() {
    return GENERAL_FLOW_VARIANT_IDS.slice();
  }

  function getVariantConfig(variantId) {
    return GENERAL_FLOW_VARIANTS[String(variantId || "").trim()] || null;
  }

  function getBenchGeneralFlowSpec(variantId, project) {
    const variant = getVariantConfig(variantId);
    if (!variant) return null;
    const spec = {
      variantId: variant.id,
      threadType: variant.threadType,
      title: String(project?.title || variant.title),
      poster: { ...variant.poster },
      applicant: { ...variant.applicant },
      publicDetail: { ...variant.publicDetail },
    };
    const vendorId = String(project?.talk_ai_vendor_id || "").trim();
    if (vendorId && variant.id === "vendor_user") {
      spec.applicant = {
        role: "vendor",
        id: vendorId,
        name: String(project?.talk_ai_vendor_name || "業者"),
      };
    }
    return spec;
  }

  function resolvePublicDetailHref(project, options = {}) {
    const variantId = String(project?.bench_flow_id || project?.benchFlowId || "").trim();
    const variant = getVariantConfig(variantId);
    if (!variant?.publicDetail) return "";
    const rel = options.relative ? "../" : "";
    const pd = variant.publicDetail;
    const page = pd.page || "public-board-detail.html";
    return `${rel}${page}?id=${encodeURIComponent(pd.id)}&type=${encodeURIComponent(pd.type)}`;
  }

  function resolvePublicDetailParams(variantId) {
    const variant = getVariantConfig(variantId);
    if (!variant?.publicDetail) return null;
    const pd = variant.publicDetail;
    return {
      page: pd.page || "public-board-detail.html",
      id: pd.id,
      type: pd.type,
    };
  }

  function buildThreadTypeConfig(variantId) {
    const variant = getVariantConfig(variantId);
    if (!variant) return null;
    return {
      id: variant.id,
      ...GENERAL_FLOW_THREAD_UI_BASE,
      ...variant.threadUi,
    };
  }

  function buildAllThreadTypeConfigs() {
    const out = {};
    GENERAL_FLOW_VARIANT_IDS.forEach((id) => {
      out[id] = buildThreadTypeConfig(id);
    });
    return out;
  }

  function createBenchFlowConfig(variantId) {
    const variant = getVariantConfig(variantId);
    if (!variant?.bench) return null;
    return { id: variant.id, ...variant.bench };
  }

  function createBenchFlowConfigs() {
    const out = {};
    GENERAL_FLOW_VARIANT_IDS.forEach((id) => {
      const cfg = createBenchFlowConfig(id);
      if (cfg) out[id] = cfg;
    });
    return out;
  }

  function generalApplicantSideKey(flowConfig) {
    const f = flowConfig || {};
    return f.generalPosterSide === "B" ? "A" : "B";
  }

  function getBenchBuilderFlowParam(variantId) {
    const variant = getVariantConfig(variantId);
    return String(variant?.benchBuilderFlowParam || variantId || "").trim();
  }

  function pickActorId(actor) {
    return String(actor?.id || "").trim();
  }

  /** 一般案件: 掲載者（A）判定 — ID のみ */
  function isGeneralFlowPoster(actor, spec) {
    if (!spec?.poster) return false;
    return pickActorId(actor) === String(spec.poster.id || "").trim();
  }

  /** 一般案件: 応募者（B）判定 — ID のみ */
  function isGeneralFlowApplicant(actor, spec) {
    if (!spec?.applicant) return false;
    return pickActorId(actor) === String(spec.applicant.id || "").trim();
  }

  function resolveGeneralFlowCounterparty(actor, spec) {
    if (!spec) return null;
    return isGeneralFlowPoster(actor, spec) ? spec.applicant : spec.poster;
  }

  function resolveGeneralFlowPartyBySlot(spec, slot) {
    const s = String(slot || "").trim().toLowerCase();
    if (!spec) return null;
    if (s === "poster" || s === "a") return spec.poster;
    if (s === "applicant" || s === "b") return spec.applicant;
    return null;
  }

  /**
   * 通知受信者を poster/applicant から解決（recipientUserId / recipientSlot 優先）
   */
  function resolveGeneralFlowPartyForRecipient(spec, ref = {}) {
    if (!spec) return null;
    const uid = String(ref.recipientUserId || ref.userId || "").trim();
    if (uid) {
      if (uid === String(spec.poster.id || "").trim()) return spec.poster;
      if (uid === String(spec.applicant.id || "").trim()) return spec.applicant;
    }
    const bySlot = resolveGeneralFlowPartyBySlot(spec, ref.recipientSlot || ref.slot);
    if (bySlot) return bySlot;
    const rr = String(ref.recipientRole || ref.role || "").trim().toLowerCase();
    if (
      rr &&
      rr === String(spec.poster.role || "").trim().toLowerCase() &&
      spec.poster.role !== spec.applicant.role
    ) {
      return spec.poster;
    }
    if (
      rr &&
      rr === String(spec.applicant.role || "").trim().toLowerCase() &&
      spec.poster.role !== spec.applicant.role
    ) {
      return spec.applicant;
    }
    return null;
  }

  function resolveGeneralFlowRecipientUserId(spec, ref = {}) {
    const party = resolveGeneralFlowPartyForRecipient(spec, ref);
    return party ? String(party.id || "").trim() : "";
  }

  /** URL 用ロール（表示・遷移のみ。フロー判定には使わない） */
  function partyUrlRole(party) {
    return String(party?.role || party?.type || "user").trim() || "user";
  }

  global.TasuBuilderGeneralFlow = Object.freeze({
    GENERAL_FLOW_ID,
    GENERAL_FLOW_VARIANT_IDS,
    GENERAL_FLOW_LIFECYCLE,
    GENERAL_FLOW_THREAD_UI_BASE,
    PUBLIC_BOARD_JOB_ID,
    PUBLIC_BOARD_PROJECT_ID,
    isGeneralFlowVariant,
    isGeneralFlowProject,
    getGeneralFlowVariantIds,
    getVariantConfig,
    getBenchGeneralFlowSpec,
    resolvePublicDetailHref,
    resolvePublicDetailParams,
    buildThreadTypeConfig,
    buildAllThreadTypeConfigs,
    createBenchFlowConfig,
    createBenchFlowConfigs,
    generalApplicantSideKey,
    getBenchBuilderFlowParam,
    pickActorId,
    isGeneralFlowPoster,
    isGeneralFlowApplicant,
    resolveGeneralFlowCounterparty,
    resolveGeneralFlowPartyBySlot,
    resolveGeneralFlowPartyForRecipient,
    resolveGeneralFlowRecipientUserId,
    partyUrlRole,
  });
})(typeof window !== "undefined" ? window : globalThis);
