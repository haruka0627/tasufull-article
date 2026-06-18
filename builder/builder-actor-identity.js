/**
 * TASFUL Builder — actor identity（NB-3 STEP 6）
 * 本番: JWT talk_user_id + deal/thread 参加者 ID のみ。URL / LS role 禁止。
 */
(function (global) {
  "use strict";

  const MVP_ROLE_KEY = "tasful:builder:mvp:role";
  const MVP_SESSION_ROLE_KEY = "tasful:builder:mvp:session:role";
  const MVP_PARTNER_ID_KEY = "tasful:builder:mvp:partner_id";
  const DEFAULT_OWNER_ID = "demo-owner-001";
  const DEFAULT_PARTNER_ID = "demo-partner-001";
  const DEFAULT_USER_ID = "demo-builder-user";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function auth() {
    return global.TasuAuthCurrentUser || {};
  }

  function generalFlow() {
    return global.TasuBuilderGeneralFlow || {};
  }

  function isProductionHost() {
    return auth().isProductionHost?.() === true;
  }

  function canUseRoleFallback() {
    return auth().canUseLocalStorageFallback?.() === true;
  }

  function normalizeMvpRole(raw) {
    const r = String(raw || "").trim().toLowerCase();
    if (r === "partner") return "partner";
    if (r === "vendor") return "vendor";
    if (r === "user" || r === "builder") return "user";
    if (r === "owner" || r === "ops") return "owner";
    return "";
  }

  function searchParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch {
      return new URLSearchParams();
    }
  }

  function readUrlRole() {
    if (!canUseRoleFallback()) return "";
    return normalizeMvpRole(searchParams().get("role"));
  }

  function readUrlPartnerId() {
    if (!canUseRoleFallback()) return "";
    return pickStr(searchParams().get("partnerId"), searchParams().get("partner_id"), searchParams().get("userId"));
  }

  function readDemoRoleFromStorage() {
    if (!canUseRoleFallback()) return "";
    try {
      const session = global.sessionStorage?.getItem(MVP_SESSION_ROLE_KEY);
      if (session) return normalizeMvpRole(session);
    } catch {
      /* ignore */
    }
    try {
      const ls = global.localStorage?.getItem(MVP_ROLE_KEY);
      if (ls === "partner") return "partner";
      if (ls === "user") return "user";
      if (ls === "vendor") return "vendor";
      if (ls === "owner") return "owner";
    } catch {
      /* ignore */
    }
    return "";
  }

  function readDemoPartnerIdFromStorage() {
    if (!canUseRoleFallback()) return "";
    try {
      return pickStr(global.localStorage?.getItem(MVP_PARTNER_ID_KEY));
    } catch {
      return "";
    }
  }

  function getCurrentUserId() {
    const jwt = pickStr(auth().getCurrentUser?.()?.talkUserId);
    if (isProductionHost()) return jwt;
    return pickStr(
      jwt,
      readUrlPartnerId(),
      readDemoConfigUserId(),
      global.TasuChatUserIdentity?.getEffectiveUserId?.(),
      readDemoMemberUserId(),
      DEFAULT_USER_ID
    );
  }

  function readDemoConfigUserId() {
    if (!canUseRoleFallback()) return "";
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return pickStr(cfg.currentUserId, cfg.me?.id);
  }

  function readDemoMemberUserId() {
    if (!canUseRoleFallback()) return "";
    try {
      const raw = global.localStorage?.getItem("tasu_member_session");
      const member = raw ? JSON.parse(raw) : null;
      if (!member || typeof member !== "object") return "";
      return pickStr(member.talk_user_id, member.userId, member.user_id, member.id);
    } catch {
      return "";
    }
  }

  function resolveFlowSpec(project) {
    const flowId = pickStr(project?.bench_flow_id, project?.benchFlowId);
    if (!flowId) return null;
    return generalFlow().getBenchGeneralFlowSpec?.(flowId, project) || null;
  }

  function resolveOwnerId(project, state) {
    return pickStr(project?.owner_id, state?.owner_id, DEFAULT_OWNER_ID);
  }

  function resolveSelectedApplicantId(project, state) {
    const selected = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids : [];
    const fromSelected = pickStr(selected[0]);
    if (fromSelected) return fromSelected;
    const app = (state?.applications || []).find(
      (a) => a.project_id === project?.project_id && a.status === "selected"
    );
    return pickStr(app?.partner_id);
  }

  function resolveParticipants(project, state, flowSpec) {
    const spec = flowSpec || resolveFlowSpec(project);
    const ownerId = resolveOwnerId(project, state);
    const applicantId = resolveSelectedApplicantId(project, state);
    const posterId = pickStr(spec?.poster?.id, ownerId);
    const applicantSpecId = pickStr(spec?.applicant?.id, applicantId);
    const partnerIds = Array.isArray(project?.selected_partner_ids) ? project.selected_partner_ids.map(String) : [];
    const calendarPartner = pickStr(project?.calendar_assigned_partner_id);
    return {
      ownerId,
      posterId,
      applicantId: pickStr(applicantSpecId, applicantId),
      posterRole: pickStr(spec?.poster?.role, "owner"),
      applicantRole: pickStr(spec?.applicant?.role, "partner"),
      partnerIds,
      calendarPartner,
      flowSpec: spec,
    };
  }

  function matchRoleForUserId(userId, participants) {
    const uid = pickStr(userId);
    if (!uid) return { role: "", actorId: "", slot: "none" };
    const p = participants || {};
    if (uid === pickStr(p.ownerId) || uid === DEFAULT_OWNER_ID) {
      return { role: "owner", actorId: uid, slot: "owner" };
    }
    if (p.posterId && uid === p.posterId) {
      return { role: normalizeMvpRole(p.posterRole) || "owner", actorId: uid, slot: "poster" };
    }
    if (p.applicantId && uid === p.applicantId) {
      return { role: normalizeMvpRole(p.applicantRole) || "partner", actorId: uid, slot: "applicant" };
    }
    if (p.partnerIds.includes(uid) || uid === p.calendarPartner) {
      return { role: "partner", actorId: uid, slot: "partner" };
    }
    const spec = p.flowSpec;
    if (spec?.poster?.id === uid) {
      return { role: normalizeMvpRole(spec.poster.role) || "user", actorId: uid, slot: "poster" };
    }
    if (spec?.applicant?.id === uid) {
      return { role: normalizeMvpRole(spec.applicant.role) || "user", actorId: uid, slot: "applicant" };
    }
    if (spec?.poster?.role === "vendor" && spec.poster.id === uid) {
      return { role: "vendor", actorId: uid, slot: "poster" };
    }
    if (spec?.applicant?.role === "vendor" && spec.applicant.id === uid) {
      return { role: "vendor", actorId: uid, slot: "applicant" };
    }
    return { role: "", actorId: uid, slot: "unknown" };
  }

  function getDemoViewRole() {
    if (!canUseRoleFallback()) return "";
    return pickStr(readUrlRole(), readDemoRoleFromStorage(), "owner");
  }

  function getDemoPartnerId() {
    if (!canUseRoleFallback()) return "";
    return pickStr(readUrlPartnerId(), readDemoPartnerIdFromStorage(), DEFAULT_PARTNER_ID);
  }

  function buildActorRecord(role, actorId, state, nameHint) {
    const r = normalizeMvpRole(role) || "owner";
    const id = pickStr(actorId);
    if (r === "owner") {
      return { id: id || DEFAULT_OWNER_ID, type: "owner", name: nameHint || "TASFUL運営", role: "owner" };
    }
    if (r === "user") {
      if (id === "demo-user-peer-001") {
        return { id, type: "user", name: nameHint || "鈴木 美咲", role: "user" };
      }
      return { id: id || DEFAULT_USER_ID, type: "user", name: nameHint || "山田 太郎", role: "user" };
    }
    if (r === "vendor") {
      const vendor = (state?.partners || []).find((p) => p.partner_id === id);
      return { id: id || "demo-vendor-001", type: "vendor", name: nameHint || vendor?.display_name || "業者", role: "vendor" };
    }
    const partner = (state?.partners || []).find((p) => p.partner_id === id);
    return {
      id: id || DEFAULT_PARTNER_ID,
      type: "partner",
      name: nameHint || partner?.display_name || id || "パートナー",
      role: "partner",
    };
  }

  function buildIdentity(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const state = ctx.state || null;
    const project = ctx.project || null;
    const flowSpec = ctx.flowSpec || resolveFlowSpec(project);
    const participants = resolveParticipants(project, state, flowSpec);
    const userId = getCurrentUserId();

    if (isProductionHost()) {
      const match = matchRoleForUserId(userId, participants);
      const actor = buildActorRecord(match.role, match.actorId || userId, state);
      let source = userId ? "jwt" : "unauthenticated";
      if (userId && match.role) source = "jwt_deal_match";
      if (userId && !match.role) source = "jwt_no_match";
      return {
        userId,
        viewRole: match.role,
        actorRole: match.role,
        actorId: pickStr(match.actorId, userId),
        actor,
        slot: match.slot,
        participants,
        isAuthenticated: Boolean(userId),
        isDealParticipant: Boolean(match.role),
        source,
        connectReady: global.TasuConnectState?.isConnectReady?.() === true,
      };
    }

    const viewRole = getDemoViewRole();
    const partnerId = getDemoPartnerId();
    let actorId = partnerId;
    if (viewRole === "owner") actorId = pickStr(participants.ownerId, DEFAULT_OWNER_ID);
    else if (viewRole === "user" && partnerId === "demo-user-peer-001") actorId = partnerId;
    else if (viewRole === "user") actorId = pickStr(partnerId, DEFAULT_USER_ID);
    else if (viewRole === "vendor") actorId = pickStr(partnerId, "demo-vendor-001");

    let source = "demo_fallback";
    if (readUrlRole()) source = "demo_url_role";
    else if (readDemoRoleFromStorage()) source = "demo_localStorage";
    else if (auth().getCurrentUser?.()?.talkUserId) source = "jwt_demo";

    const actor = buildActorRecord(viewRole, actorId, state);
    return {
      userId: pickStr(userId, actorId),
      viewRole,
      actorRole: viewRole,
      actorId,
      actor,
      slot: viewRole,
      participants,
      isAuthenticated: Boolean(pickStr(userId, actorId)),
      isDealParticipant: true,
      source,
      connectReady: global.TasuConnectState?.isConnectReady?.() === true,
    };
  }

  function getBuilderActor(context) {
    return { ...buildIdentity(context) };
  }

  function getBuilderActorForDeal(deal) {
    const d = deal && typeof deal === "object" ? deal : {};
    return getBuilderActor({
      project: d.project || d,
      thread: d.thread || null,
      state: d.state || null,
      flowSpec: d.flowSpec || null,
    });
  }

  function getBuilderActorSource(context) {
    return buildIdentity(context).source;
  }

  function getViewRole(context) {
    return buildIdentity(context).viewRole;
  }

  function getActorRecord(context) {
    return { ...buildIdentity(context).actor };
  }

  function actorContextMatches(context, slot) {
    const identity = buildIdentity(context);
    const uid = pickStr(identity.userId);
    if (!uid) return false;
    const p = identity.participants || {};
    const target = String(slot || "").trim().toLowerCase();
    if (target === "poster") return uid === pickStr(p.posterId);
    if (target === "applicant") return uid === pickStr(p.applicantId);
    if (target === "owner") return uid === pickStr(p.ownerId) || identity.viewRole === "owner";
    if (target === "partner") return identity.viewRole === "partner" || p.partnerIds.includes(uid);
    if (target === "vendor") return identity.viewRole === "vendor";
    return false;
  }

  function isPoster(context) {
    const gf = generalFlow();
    const ctx = context || {};
    const spec = ctx.flowSpec || resolveFlowSpec(ctx.project);
    const actor = getActorRecord(ctx);
    if (spec && gf.isGeneralFlowPoster) return gf.isGeneralFlowPoster(actor, spec);
    return actorContextMatches(ctx, "poster") || actorContextMatches(ctx, "owner");
  }

  function isApplicant(context) {
    const gf = generalFlow();
    const ctx = context || {};
    const spec = ctx.flowSpec || resolveFlowSpec(ctx.project);
    const actor = getActorRecord(ctx);
    if (spec && gf.isGeneralFlowApplicant) return gf.isGeneralFlowApplicant(actor, spec);
    return actorContextMatches(ctx, "applicant") || actorContextMatches(ctx, "partner");
  }

  function isOwner(context) {
    return actorContextMatches(context, "owner") || getViewRole(context) === "owner";
  }

  function isPartner(context) {
    return actorContextMatches(context, "partner") || getViewRole(context) === "partner";
  }

  function isVendor(context) {
    return actorContextMatches(context, "vendor") || getViewRole(context) === "vendor";
  }

  function isGeneralFlowProject(project) {
    const flowId = pickStr(project?.bench_flow_id, project?.benchFlowId);
    return generalFlow().isGeneralFlowVariant?.(flowId) === true;
  }

  function isCompletionSubmitter(context, deps) {
    const ctx = context || {};
    const project = ctx.project;
    const state = ctx.state;
    if (!project) return false;
    const identity = buildIdentity(ctx);
    if (isProductionHost() && !identity.isDealParticipant) return false;

    if (isGeneralFlowProject(project)) {
      const applicantId = resolveSelectedApplicantId(project, state);
      const actorId = pickStr(identity.actorId, identity.userId);
      return Boolean(applicantId && actorId && actorId === applicantId);
    }

    if (deps?.boardType === "worker") {
      return identity.viewRole === "owner";
    }

    if (identity.viewRole !== "partner") return false;
    const pid = pickStr(identity.actorId);
    const selected = Array.isArray(project.selected_partner_ids) ? project.selected_partner_ids : [];
    if (selected.includes(pid)) return true;
    return pickStr(project.calendar_assigned_partner_id) === pid;
  }

  function isCompletionReviewer(context, deps) {
    const ctx = context || {};
    const project = ctx.project;
    const state = ctx.state;
    if (!project) return false;
    const identity = buildIdentity(ctx);
    if (isProductionHost() && !identity.isDealParticipant) return false;

    if (isGeneralFlowProject(project)) {
      const spec = ctx.flowSpec || resolveFlowSpec(project);
      const actorId = pickStr(identity.actorId, identity.userId);
      if (spec?.poster?.id) return Boolean(actorId && actorId === pickStr(spec.poster.id));
      const ownerId = resolveOwnerId(project, state);
      return Boolean(ownerId && actorId === ownerId);
    }

    if (deps?.boardType === "worker") {
      if (identity.viewRole !== "partner") return false;
      const pid = pickStr(identity.actorId);
      const app = (state?.applications || []).find(
        (a) => a.project_id === project.project_id && a.partner_id === pid
      );
      return app?.status === "selected" || resolveSelectedApplicantId(project, state) === pid;
    }

    return identity.viewRole === "owner";
  }

  function canSubmitCompletion(context, deps) {
    const ctx = context || {};
    if (deps?.chatLocked) return false;
    if (deps?.submissionStatus === "submitted" || deps?.submissionStatus === "approved") return false;
    if (deps?.completed) return false;
    if (!deps?.hasSelectedPartner) return false;
    return isCompletionSubmitter(ctx, deps);
  }

  function canApproveCompletion(context, deps) {
    if (deps?.submissionStatus !== "submitted") return false;
    return isCompletionReviewer(context, deps);
  }

  function canPostReview(context, deps) {
    const ctx = context || {};
    if (!deps?.chatLocked) return false;
    if (deps?.reviewSubmitted) return false;
    const identity = buildIdentity(ctx);
    if (isProductionHost() && !identity.isDealParticipant) return false;
    if (isGeneralFlowProject(ctx.project)) {
      return isPoster(ctx) || isApplicant(ctx);
    }
    return identity.viewRole === "owner" || identity.viewRole === "partner";
  }

  function resolveActorIdForDeal(context) {
    const identity = buildIdentity(context);
    if (isProductionHost()) return pickStr(identity.actorId, identity.userId);
    const ctx = context || {};
    const spec = ctx.flowSpec || resolveFlowSpec(ctx.project);
    const urlPid = readUrlPartnerId();
    if (spec) {
      const posterId = pickStr(spec.poster?.id);
      const appId = pickStr(spec.applicant?.id);
      if (urlPid && (urlPid === posterId || urlPid === appId)) return urlPid;
      const actorId = pickStr(identity.actorId);
      if (actorId && (actorId === posterId || actorId === appId)) return actorId;
      return pickStr(actorId, urlPid, posterId);
    }
    return pickStr(identity.actorId, urlPid);
  }

  global.TasuBuilderActorIdentity = {
    MVP_ROLE_KEY,
    MVP_SESSION_ROLE_KEY,
    MVP_PARTNER_ID_KEY,
    DEFAULT_OWNER_ID,
    normalizeMvpRole,
    isProductionHost,
    canUseRoleFallback,
    getCurrentUserId,
    getBuilderActor,
    getBuilderActorForDeal,
    getBuilderActorSource,
    getViewRole,
    getActorRecord,
    getDemoViewRole,
    getDemoPartnerId,
    isPoster,
    isApplicant,
    isOwner,
    isPartner,
    isVendor,
    isCompletionSubmitter,
    isCompletionReviewer,
    canSubmitCompletion,
    canApproveCompletion,
    canPostReview,
    resolveActorIdForDeal,
    resolveParticipants,
    matchRoleForUserId,
    resolveFlowSpec,
  };
})(typeof window !== "undefined" ? window : globalThis);
