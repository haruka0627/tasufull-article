/**
 * TASFUL TALK — 通知カードアクション
 *
 * 最終方針（通知タブ・公式トーク共通）:
 * - 通知は「知らせる」「該当の既存ページへ案内する」だけ
 * - 構成: タイトル / 本文 / カテゴリチップ / 遷移ボタン（URL必須・CTAのみタップ可）
 * - 通知カード本体はクリック不可。遷移は CTA ボタンのみ。
 * - 業務操作・中継ページ・専用処理画面は禁止
 * - 遷移先は必ず既存ページ（トーク / 案件 / 応募管理 / 安否 / 通報 / 注文 等）
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  const route = () => global.TasuListingRouteResolver;

  function pickIdFromUrl(url) {
    if (route()?.pickIdFromUrl) return route().pickIdFromUrl(url);
    const raw = pickStr(url);
    if (!raw || raw === "#") return "";
    try {
      const base = global.location?.href || "http://localhost/";
      const u = new URL(raw, base);
      return pickStr(u.searchParams.get("id"), u.searchParams.get("shopId"), u.searchParams.get("projectId"));
    } catch {
      const m = raw.match(/[?&](?:id|shopId|projectId)=([^&]+)/i);
      return m ? decodeURIComponent(m[1]) : "";
    }
  }

  function detailHref(type, id) {
    const R = route();
    if (R?.buildDetailUrl) return R.buildDetailUrl(type, id);
    return "#";
  }

  function dealDetailHref(id, hash) {
    const R = route();
    const base = R?.buildDetailUrl ? R.buildDetailUrl("deal", id) : "deal-detail.html";
    const fragment = String(hash || "").trim().replace(/^#/, "");
    if (!fragment) return base;
    const path = String(base).split("#")[0];
    return `${path}#${fragment}`;
  }

  function isBuilderCompletionReport(notification) {
    const n = notification || {};
    const title = String(n.title || "");
    const body = String(n.body || "");
    return /完了報告/i.test(title) || /完了報告/i.test(body);
  }

  function resolveBuilderDealId(notification, listingId) {
    const id = pickStr(listingId, pickIdFromUrl(notification?.targetUrl));
    return id || "builder_demo_001";
  }

  function appendUserId(href) {
    const url = pickStr(href);
    if (!url || url === "#") return url;
    let next = global.TasuChatUserIdentity?.appendUserIdToUrl?.(url) || url;
    if (global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.()) {
      const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
      next = global.TasuPlatformChatLiveFlow.appendLiveFlowParams(next, profile);
    }
    return next;
  }

  function appendChatFromNotify(href) {
    const url = pickStr(href);
    if (!url || url === "#") return url;
    return global.TasuChatThreadStore?.appendChatDetailFromParam?.(url, "notify") || url;
  }

  /** TALK通知・公式トークからの遷移先に from=talk を付与 */
  function isDetailPageHref(href) {
    const raw = pickStr(href);
    if (!raw || raw === "#") return false;
    return /detail-(?:business|general|shop|product|job|skill|worker)/i.test(raw);
  }

  function appendDetailNavFromTalk(href, opts) {
    const url = pickStr(href);
    if (!url || url === "#" || !isDetailPageHref(url)) return url;
    if (global.TasuDetailNav?.appendTalkParams) {
      return global.TasuDetailNav.appendTalkParams(url, opts || {});
    }
    const notify = opts?.notify === true;
    const from = notify ? "notify" : "talk";
    const returnTo = notify ? "talk-home.html?tab=notify" : "talk-home.html?tab=chat";
    const hashIdx = url.indexOf("#");
    const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    if (/[?&]from=/.test(base)) return url;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}from=${from}&returnTo=${encodeURIComponent(returnTo)}${hash}`;
  }

  function appendFromTalkParam(href) {
    const url = pickStr(href);
    if (!url || url === "#") return url;
    if (isDetailPageHref(url)) {
      return appendDetailNavFromTalk(url, { notify: false });
    }
    const hashIdx = url.indexOf("#");
    const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    if (/[?&]from=(?:talk|notify)(?:&|$)/i.test(base)) return url;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}from=talk${hash}`;
  }

  /** 通知タブ・通知CTAからの遷移先に from=notify を付与 */
  function appendFromNotifyParam(href) {
    const url = pickStr(href);
    if (!url || url === "#") return url;
    if (isDetailPageHref(url)) {
      return appendDetailNavFromTalk(url, { notify: true });
    }
    const hashIdx = url.indexOf("#");
    const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
    if (/[?&]from=notify(?:&|$)/i.test(base)) return url;
    if (/[?&]from=talk(?:&|$)/i.test(base)) {
      const nextBase = base.replace(/([?&])from=talk(?=&|$)/i, "$1from=notify");
      return `${nextBase}${hash}`;
    }
    const sep = base.includes("?") ? "&" : "?";
    const returnTo = encodeURIComponent("talk-home.html?tab=notify");
    return `${base}${sep}from=notify&returnTo=${returnTo}${hash}`;
  }

  function shouldKeepNotifyFromParam(notification, href) {
    const n = notification || {};
    if (isDemoReviewOpenNotify(n)) return true;
    const raw = pickStr(href);
    return /(?:^|[?&])from=notify(?:&|$)/i.test(raw) && /(?:^|[?&])openReview=(?:1|true)(?:&|$)/i.test(raw);
  }

  function isPlatformMasterNotification(notification) {
    if (global.TasuTalkPlatformNotifyMaster?.isPlatformMasterNotification) {
      return global.TasuTalkPlatformNotifyMaster.isPlatformMasterNotification(notification);
    }
    const n = notification || {};
    return n.source === "platform_master_v1" || String(n.id || "").startsWith("platform-");
  }

  function isBuilderMasterNotification(notification) {
    if (global.TasuTalkBuilderNotifyMaster?.isBuilderMasterNotification) {
      return global.TasuTalkBuilderNotifyMaster.isBuilderMasterNotification(notification);
    }
    const n = notification || {};
    return n.source === "builder_master_v1" || String(n.id || "").startsWith("builder-");
  }

  function isAnpiMasterNotification(notification) {
    if (global.TasuTalkAnpiNotifyMaster?.isAnpiMasterNotification) {
      return global.TasuTalkAnpiNotifyMaster.isAnpiMasterNotification(notification);
    }
    const n = notification || {};
    return n.source === "anpi_master_v1" || String(n.id || "").startsWith("anpi-");
  }

  function isPlatformFeeMasterNotification(notification) {
    const n = notification || {};
    if (n.source === "platform_fee_master_v1") return true;
    if (n.platformFeeMasterVersion) return true;
    const id = String(n.id || "");
    if (id.startsWith("platform-fee-")) return true;
    return false;
  }

  function isTalkMasterNotification(notification) {
    return (
      isPlatformMasterNotification(notification) ||
      isPlatformFeeMasterNotification(notification) ||
      isBuilderMasterNotification(notification) ||
      isAnpiMasterNotification(notification)
    );
  }

  function isJobChatStartNotifyTitle(title) {
    const t = String(title || "");
    if (
      t === "応募者とのやりとりを開始してください" ||
      t === "掲載者とのやりとりを開始してください"
    ) {
      return true;
    }
    const legacy = global.TasuPlatformChatJobCard?.LEGACY_HIRED_TITLES || ["採用されました"];
    return legacy.includes(t);
  }

  function isJobApplicationNotify(notification) {
    const n = notification || {};
    if (isBuilderBoardApplicationNotify(n)) return false;
    if (String(n.type || "").toLowerCase() === "builder") return false;
    if (String(n.category || "") === "Builder") return false;
    const title = String(n.title || "");
    const href = pickStr(n.href, n.targetUrl, n.actionUrl);
    if (isJobChatStartNotifyTitle(title) || /view=hire-result/.test(href)) return false;
    if (/応募がありました/.test(title)) return true;
    if (/view=applications/.test(href)) return true;
    if (/#applications/.test(href)) return true;
    if (String(n.id || "").startsWith("platform-job-apply")) return true;
    if (String(n.id || "").startsWith("platform-verify-job-apply")) return true;
    if (n.category === "求人" && n.audience === "poster" && /応募/.test(title)) return true;
    return false;
  }

  function isJobHiredApplicantNotify(notification) {
    const n = notification || {};
    if (String(n.type || "").toLowerCase() === "builder") return false;
    if (String(n.category || "") === "Builder") return false;
    const title = String(n.title || "");
    if (title === "応募が承諾されました") return true;
    if (/承諾されました/.test(title) && pickStr(n.recipientRole) === "applicant") return true;
    return false;
  }

  function isJobHiredPosterNotify(notification) {
    const n = notification || {};
    if (String(n.type || "").toLowerCase() === "builder") return false;
    if (String(n.category || "") === "Builder") return false;
    const title = String(n.title || "");
    if (title === "応募者とのやりとりを開始してください") return true;
    if (pickStr(n.recipientRole).toLowerCase() === "poster" && isJobChatStartNotifyTitle(title)) {
      return true;
    }
    return false;
  }

  function isJobHireResultNotify(notification) {
    const n = notification || {};
    if (String(n.type || "").toLowerCase() === "builder") return false;
    if (String(n.category || "") === "Builder") return false;
    if (String(n.id || "").startsWith("platform-verify-builder-")) return false;
    if (isJobHiredApplicantNotify(n)) return true;
    const title = String(n.title || "");
    const href = pickStr(n.href, n.targetUrl, n.actionUrl);
    if (isJobChatStartNotifyTitle(title) && n.category === "求人") return true;
    if (String(n.id || "").startsWith("platform-verify-job-full-poster-start")) return true;
    if (String(n.id || "").startsWith("platform-verify-job-full-applicant-start")) return true;
    return false;
  }

  function threadExistsInStore(threadId) {
    const id = pickStr(threadId);
    if (!id) return false;
    if (global.TasuChatThreadStore?.threadExists) {
      return global.TasuChatThreadStore.threadExists(id);
    }
    return Boolean(global.TasuChatThreadStore?.loadRoom?.(id)?.thread);
  }

  function resolveVerifiedJobHireThreadId(notification, explicitHref) {
    const n = notification || {};
    const listingId = pickStr(n.listingId, pickIdFromUrl(explicitHref));
    const applicationId = pickStr(n.applicationId);
    let threadId = pickStr(n.threadId, n.thread_id);
    const explicit = pickStr(explicitHref);
    if (explicit) {
      try {
        const u = new URL(explicit, global.location?.href || "http://localhost/");
        const fromUrl = pickStr(u.searchParams.get("thread"), u.searchParams.get("roomId"));
        if (fromUrl) threadId = fromUrl;
      } catch {
        /* ignore */
      }
    }
    if (threadExistsInStore(threadId)) return threadId;
    const linked = global.TasuChatThreadStore?.findHireThread?.(listingId, applicationId);
    if (linked?.id) return pickStr(linked.id);
    const app = global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId);
    if (app?.thread_id && threadExistsInStore(app.thread_id)) return pickStr(app.thread_id);
    if (linked?.id) return pickStr(linked.id);
    if (app?.thread_id) return pickStr(app.thread_id);
    return threadId;
  }

  function isJobCompletionNotify(notification) {
    const n = notification || {};
    if (n.category !== "求人") return false;
    const title = String(n.title || "");
    if (title === "やりとりが完了しました") return true;
    if (/完了の申請/.test(title)) return true;
    return String(n.id || "").startsWith("platform-verify-job-full-complete");
  }

  function isJobReviewNotify(notification) {
    const n = notification || {};
    if (n.category !== "求人") return false;
    const title = String(n.title || "");
    if (/評価をお願い/.test(title)) return true;
    return String(n.id || "").startsWith("platform-verify-job-full-review");
  }

  function enrichJobReviewChatNotifyHref(href) {
    const Review = global.TasuPlatformChatReviewFlow;
    const raw = pickStr(href);
    if (!raw) return raw;
    const withFrom = appendChatFromNotify(route()?.normalizeDetailHref?.(raw) || raw);
    return Review?.applyReviewNotifyParamsToChatUrl?.(withFrom, { from: "notify", state: "completed" }) || withFrom;
  }

  function resolveJobCompletionNotifyHref(notification) {
    const n = notification || {};
    const threadId = pickStr(n.threadId, n.thread_id);
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    const reviewOpts =
      String(n.id || "").includes("job-full") || /review=job-full/.test(explicit)
        ? { review: "job-full" }
        : {};
    if (/chat-detail\.html/i.test(explicit) && /[?&]thread=/.test(explicit)) {
      return appendUserId(enrichJobReviewChatNotifyHref(explicit));
    }
    const Review = global.TasuPlatformChatReviewFlow;
    const thread = threadId
      ? (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === threadId) || {
          id: threadId,
        }
      : null;
    const builtReview = Review?.buildReviewOpenChatUrl?.(thread, pickStr(n.recipientUserId), {
      threadId,
      from: "notify",
      state: "completed",
      openReview: "1",
    });
    if (builtReview && builtReview !== "#") {
      return appendUserId(enrichJobReviewChatNotifyHref(builtReview));
    }
    const chatBuilt = global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
      ...reviewOpts,
      userId: pickStr(n.recipientUserId),
      from: "notify",
    });
    if (chatBuilt) return appendUserId(enrichJobReviewChatNotifyHref(chatBuilt));
    return appendUserId(explicit);
  }

  function resolveJobReviewNotifyHref(notification) {
    return resolveJobCompletionNotifyHref(notification);
  }

  function resolveJobPosterChatNotifyHref(notification) {
    const n = notification || {};
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    const listingId = pickStr(n.listingId, pickIdFromUrl(explicit));
    const applicationId = pickStr(n.applicationId);
    const threadId = resolveVerifiedJobHireThreadId(n, explicit);
    const posterId = pickStr(
      n.recipientUserId,
      global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(listingId)
    );
    const built = global.TasuPlatformChatJobFlow?.buildJobChatUrl?.(threadId, {
      userId: posterId,
      listingId,
      applicationId,
      from: "notify",
    });
    if (built && built !== "#" && threadId) {
      return appendUserId(appendChatFromNotify(route()?.normalizeDetailHref?.(built) || built));
    }
    if (threadId && threadExistsInStore(threadId)) {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("thread", threadId);
      u.searchParams.set("from", "notify");
      if (listingId) u.searchParams.set("listingId", listingId);
      if (applicationId) u.searchParams.set("applicationId", applicationId);
      if (posterId) u.searchParams.set("userId", posterId);
      return appendUserId(`${u.pathname}${u.search}`);
    }
    return "";
  }

  function resolveJobHireChatNotifyHref(notification) {
    const n = notification || {};
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    const listingId = pickStr(n.listingId, pickIdFromUrl(explicit));
    const applicationId = pickStr(n.applicationId);
    const threadId = resolveVerifiedJobHireThreadId(n, explicit);
    let applicantId = pickStr(n.applicantId, n.recipientUserId);
    if (!applicantId && explicit) {
      try {
        applicantId = new URL(explicit, global.location?.href || "http://localhost/").searchParams.get(
          "userId"
        );
      } catch {
        /* ignore */
      }
    }
    const app = applicationId
      ? global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId)
      : null;
    const linked = global.TasuChatThreadStore?.findHireThread?.(listingId, applicationId);
    const resolvedThreadId = pickStr(threadId, linked?.id, app?.thread_id);
    const built = global.TasuTalkPlatformNotify?.buildJobHireChatNotifyUrl?.(listingId, {
      userId: applicantId,
      applicationId,
      application: app ? { ...app, thread_id: pickStr(app.thread_id, resolvedThreadId) } : null,
      listing: listingId ? global.TasuJobApplicationsStore?.resolveListing?.(listingId) : null,
      threadId: resolvedThreadId,
      thread: linked || null,
      from: "notify",
    });
    if (built && built !== "#") {
      return appendUserId(appendChatFromNotify(route()?.normalizeDetailHref?.(built) || built));
    }
    if (threadId && threadExistsInStore(threadId)) {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("thread", threadId);
      u.searchParams.set("from", "notify");
      if (listingId) u.searchParams.set("listingId", listingId);
      if (applicationId) u.searchParams.set("applicationId", applicationId);
      if (applicantId) u.searchParams.set("userId", applicantId);
      return appendUserId(`${u.pathname}${u.search}`);
    }
    return "";
  }

  /** @deprecated resolveJobHireChatNotifyHref を使用 */
  function resolveJobHireResultNotifyHref(notification) {
    return resolveJobHireChatNotifyHref(notification);
  }

  function preserveJobNotifyHref(href) {
    const url = pickStr(href);
    if (!url || url === "#") return "";
    if (/view=applications/.test(url) || /#applications/.test(url)) {
      return url;
    }
    return route()?.normalizeDetailHref?.(url) || url;
  }

  function isBuilderBoardApplicationNotify(notification) {
    const n = notification || {};
    if (String(n.id || "") === "builder-board-apply-001") return true;
    const notifyType = String(n.notifyType || n.subType || n.sub_type || "");
    if (notifyType === "application_received") {
      if (
        isBuilderMasterNotification(n) ||
        String(n.type || "").toLowerCase() === "builder" ||
        String(n.category || "") === "Builder" ||
        String(n.audienceScope || "") === "builder_board"
      ) {
        return true;
      }
    }
    const href = pickStr(n.href, n.targetUrl, n.actionUrl);
    if (
      /応募がありました/.test(String(n.title || "")) &&
      /board-project-detail/.test(href) &&
      /view=applications/.test(href)
    ) {
      return true;
    }
    return false;
  }

  function resolveBuilderBoardApplicationNotifyHref(notification) {
    const n = notification || {};
    const master = global.TasuTalkBuilderNotifyMaster;
    const fallback =
      master?.BOARD_PROJECT_DETAIL
        ? `${master.BOARD_PROJECT_DETAIL}&view=applications&role=owner`
        : "builder/board-project-detail.html?id=demo-project-001&view=applications&role=owner";
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    let href = explicit && /board-project-detail/.test(explicit) ? explicit : fallback;
    try {
      const u = new URL(href, global.location?.href || "http://localhost/");
      u.searchParams.set("view", "applications");
      u.searchParams.set("role", "owner");
      href = `${u.pathname}${u.search}`;
    } catch {
      if (!/view=applications/.test(href)) href += (href.includes("?") ? "&" : "?") + "view=applications";
      if (!/role=owner/.test(href)) href += "&role=owner";
    }
    return href;
  }

  function resolveJobApplicationsNotifyHref(notification) {
    const n = notification || {};
    const listingId = pickStr(n.listingId, pickIdFromUrl(pickStr(n.href, n.targetUrl, n.actionUrl)));
    const built = global.TasuTalkPlatformNotify?.buildJobApplicationsNotifyUrl?.(listingId);
    if (built && built !== "#") return built;
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    if (explicit && explicit !== "#") {
      const preserved = preserveJobNotifyHref(explicit);
      if (/view=applications|#applications/.test(preserved)) return preserved;
    }
    return listingId ? `${detailHref("job", listingId)}&view=applications#applications` : "";
  }

  function resolveTalkMasterHref(notification) {
    const n = notification || {};
    if (isBuilderBoardApplicationNotify(n)) {
      return resolveBuilderBoardApplicationNotifyHref(n);
    }
    if (isJobReviewNotify(n)) {
      const href = resolveJobReviewNotifyHref(n);
      if (href) return href;
    }
    if (isJobCompletionNotify(n)) {
      const href = resolveJobCompletionNotifyHref(n);
      if (href) return href;
    }
    if (isJobHiredApplicantNotify(n)) {
      const href = resolveJobHireChatNotifyHref(n);
      if (href) return href;
    }
    if (isJobHiredPosterNotify(n)) {
      const href = resolveJobPosterChatNotifyHref(n);
      if (href) return href;
    }
    if (isJobHireResultNotify(n)) {
      const href = resolveJobHireResultNotifyHref(n);
      if (href) return href;
    }
    if (isJobApplicationNotify(n)) {
      const href = resolveJobApplicationsNotifyHref(n);
      if (href) return href;
    }
    const href = appendUserId(pickStr(n.href, n.targetUrl));
    if (
      (isPlatformMasterNotification(n) || isPlatformFeeMasterNotification(n)) &&
      /deal-detail\.html/i.test(String(href || ""))
    ) {
      return "talk-home.html?tab=notify";
    }
    return href;
  }

  /** @deprecated — resolveTalkMasterHref */
  function resolvePlatformHref(notification) {
    return resolveTalkMasterHref(notification);
  }

  const DEMO_COMPLETION_NOTIFY_SOURCES = new Set([
    "platform_chat_demo_completion_request_v1",
    "platform_chat_demo_buyer_paid_v1",
    "platform_chat_demo_approved_v1",
    "platform_chat_demo_purchase_completed_v1",
    "platform_chat_manual_transfer_paid_v1",
  ]);

  const DEMO_REVIEW_OPEN_NOTIFY_SOURCES = new Set([
    "platform_chat_demo_approved_v1",
    "platform_chat_demo_purchase_completed_v1",
  ]);

  function isDemoReviewOpenNotify(notification) {
    const n = notification || {};
    if (DEMO_REVIEW_OPEN_NOTIFY_SOURCES.has(String(n.source || ""))) return true;
    return /レビュー/.test(pickStr(n.actionLabel)) && pickStr(n.demoState).toLowerCase() === "completed";
  }

  function resolveDemoCompletionChatNotifyHref(notification) {
    const n = notification || {};
    const source = String(n.source || "");
    if (!DEMO_COMPLETION_NOTIFY_SOURCES.has(source)) return "";
    const threadId = pickStr(n.threadId, n.thread_id);
    if (!threadId) return "";
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.resolveProfileForThread?.(threadId);
    if (!profile?.id || !Demo?.chatUrl) return "";
    const recipientUserId = pickStr(
      n.recipientUserId,
      n.recipient_user_id,
      global.TasuChatUserIdentity?.getCurrentUserId?.()
    );
    if (!recipientUserId) return "";
    const state = pickStr(
      n.demoState,
      source.includes("approved") || source.includes("purchase_completed") ? "completed" : "pending"
    );
    const extra = {
      review: Demo.REVIEW_PARAM || "chat-demo",
      connect: profile.connect,
      state,
      from: "notify",
      threadId,
    };
    if (state === "completed" && isDemoReviewOpenNotify(n)) extra.openReview = "1";
    return Demo.chatUrl(profile.id, recipientUserId, extra);
  }

  function ensureChatDetailThreadInHref(notification, href) {
    const n = notification || {};
    const raw = pickStr(href);
    if (!raw || !/chat-detail\.html/i.test(raw)) return raw;
    if (isJobHiredApplicantNotify(n)) {
      const rebuilt = resolveJobHireChatNotifyHref(n);
      if (rebuilt) return rebuilt;
    }
    if (isJobHiredPosterNotify(n)) {
      const rebuilt = resolveJobPosterChatNotifyHref(n);
      if (rebuilt) return rebuilt;
    }
    if (isJobHireResultNotify(n)) {
      const rebuilt = resolveJobHireChatNotifyHref(n) || resolveJobPosterChatNotifyHref(n);
      if (rebuilt) return rebuilt;
    }
    const threadId = resolveVerifiedJobHireThreadId(n, raw);
    if (!threadId) return raw;
    try {
      const u = new URL(raw, global.location?.href || "http://localhost/");
      const current = pickStr(u.searchParams.get("thread"), u.searchParams.get("roomId"));
      if (!current || !threadExistsInStore(current)) {
        u.searchParams.set("thread", threadId);
      }
      u.searchParams.delete("roomId");
      u.searchParams.delete("room");
      u.searchParams.delete("chatId");
      if (pickStr(n.listingId)) u.searchParams.set("listingId", pickStr(n.listingId));
      if (pickStr(n.applicationId)) u.searchParams.set("applicationId", pickStr(n.applicationId));
      const demoState = pickStr(n.demoState);
      if (demoState) u.searchParams.set("demoState", demoState);
      let href = `${u.pathname}${u.search}${u.hash || ""}`;
      if (isDemoReviewOpenNotify(n)) {
        href =
          global.TasuPlatformChatReviewFlow?.applyReviewNotifyParamsToChatUrl?.(href, {
            state: "completed",
            from: "notify",
          }) || href;
      }
      return href;
    } catch {
      return raw;
    }
  }

  function preserveManagementNotifyHref(href) {
    const url = pickStr(href);
    if (!url || url === "#") return "";
    if (
      /view=(contacts|applications|requests)/.test(url) ||
      /#(contacts|applications|requests)/.test(url)
    ) {
      return url;
    }
    return route()?.normalizeDetailHref?.(url) || url;
  }

  /** targetUrl / href / actionUrl を最優先 */
  function resolveExplicitNotificationHref(notification) {
    const n = notification || {};
    const url = pickStr(n.targetUrl, n.href, n.actionUrl);
    if (!url || url === "#") return "";
    const normalized = preserveManagementNotifyHref(url);
    let href = appendUserId(ensureChatDetailThreadInHref(n, normalized));
    if (isDemoReviewOpenNotify(n)) {
      href =
        global.TasuPlatformChatReviewFlow?.applyReviewNotifyParamsToChatUrl?.(href, {
          from: "notify",
          state: "completed",
        }) || href;
    }
    return href;
  }

  function resolveAnpiTypeFallbackHref(notification) {
    const n = notification || {};
    const sub = String(n.subType || n.sub_type || "").toLowerCase();
    if (sub === "setting" || sub === "settings") return "anpi-register.html";
    return "anpi-dashboard.html";
  }

  function resolvePlatformReviewReceivedNotifyHref(notification) {
    const n = notification || {};
    const Review = global.TasuPlatformChatReviewFlow;
    if (Review?.isPlatformReviewNotification?.(n) !== true) return "";
    const threadId = pickStr(n.threadId, n.thread_id);
    const recipientUserId = pickStr(n.recipientUserId, n.recipient_user_id);
    const reviewerId = pickStr(
      n.reviewerId,
      n.reviewer_id,
      global.TasuPlatformChatReviewFlow?.parseReviewerIdFromReviewNotifyId?.(n.id, threadId)
    );
    if (!threadId || !recipientUserId) return "";
    const explicit = pickStr(n.href, n.targetUrl, n.actionUrl);
    if (explicit && /openReviews=(?:1|true)/i.test(explicit)) {
      return route()?.normalizeDetailHref?.(explicit) || explicit;
    }
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === threadId) || {
        id: threadId,
      };
    const built = Review.buildReviewReceivedHref?.(thread, recipientUserId, { reviewerId });
    return built && built !== "#" ? built : "";
  }

  /** 通知「開く」の遷移先（dashboard はフォールバックのみ） */
  function resolveNotificationOpenHref(notification) {
    const n = notification || {};
    if (String(n.source || "") === "shop_market_order_v1") {
      const marketUrl = pickStr(n.targetUrl, n.href, n.actionUrl);
      if (marketUrl) return marketUrl;
    }
    const completionChatHref = resolveDemoCompletionChatNotifyHref(n);
    if (completionChatHref) {
      const href = appendUserId(completionChatHref);
      return shouldKeepNotifyFromParam(n, href) ? href : appendFromNotifyParam(href);
    }
    const reviewReceivedHref = resolvePlatformReviewReceivedNotifyHref(n);
    if (reviewReceivedHref) {
      const href = appendUserId(reviewReceivedHref);
      return shouldKeepNotifyFromParam(n, href) ? href : appendFromNotifyParam(href);
    }
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    if (Flow?.isInitialDemoNotification?.(n, profile)) {
      const spec = Flow.getInitialNotifySpec?.(profile);
      const built = spec ? Flow.buildInitialNotifyHref?.(profile, spec) : "";
      if (built) return appendFromNotifyParam(appendUserId(built));
    }
    if (isTalkMasterNotification(n)) {
      return resolveTalkMasterHref(n) || "talk-home.html?tab=notify";
    }

    if (isBuilderBoardApplicationNotify(n)) {
      return appendFromNotifyParam(appendUserId(resolveBuilderBoardApplicationNotifyHref(n)));
    }

    if (isJobHiredApplicantNotify(n)) {
      const href = resolveJobHireChatNotifyHref(n);
      if (href) return href;
    }

    if (isJobHiredPosterNotify(n)) {
      const href = resolveJobPosterChatNotifyHref(n);
      if (href) return href;
    }

    if (isJobHireResultNotify(n)) {
      const href = resolveJobHireResultNotifyHref(n);
      if (href) return href;
    }

    if (isJobCompletionNotify(n)) {
      const href = resolveJobCompletionNotifyHref(n);
      if (href) return href;
    }

    if (isJobReviewNotify(n)) {
      const href = resolveJobReviewNotifyHref(n);
      if (href) return href;
    }

    if (isJobApplicationNotify(n)) {
      const href = resolveJobApplicationsNotifyHref(n);
      if (href) return href;
    }

    const explicit = resolveExplicitNotificationHref(n);
    if (explicit) return explicit;

    const type = String(n.type || "system").toLowerCase();
    const source = String(n.source || "").toLowerCase();
    const url = pickStr(n.targetUrl, n.href, n.actionUrl);
    const listingId = pickIdFromUrl(url);

    if (type === "anpi" || source.includes("anpi")) return resolveAnpiTypeFallbackHref(n);
    if (source === "ops_watch" || type === "ops_watch") {
      return "admin-operations-dashboard.html?section=ops_watch#ops-ai-secretary";
    }

    if (type === "system") {
      if (source === "dashboard" || url.includes("dash-notices")) {
        return "admin-operations-dashboard.html#ops-ai-secretary";
      }
      if (source.includes("ops")) {
        return "admin-operations-dashboard.html?section=ops_watch#ops-ai-secretary";
      }
      if (url && !/dashboard\.html/i.test(url)) return url;
      return "admin-operations-dashboard.html#ops-ai-secretary";
    }

    if (type === "job") {
      if (isJobApplicationNotify(n)) {
        const href = resolveJobApplicationsNotifyHref(n);
        if (href) return href;
      }
      if (url && /#applications|view=applications/.test(url)) {
        const normalized = route()?.normalizeDetailHref?.(url) || url;
        return normalized;
      }
      return listingId ? detailHref("job", listingId) : url || "talk-home.html?tab=notify";
    }
    if (type === "product") {
      return listingId ? detailHref("product", listingId) : url || "talk-home.html?tab=notify";
    }
    if (type === "shop") return listingId ? detailHref("shop", listingId) : url || "talk-home.html?tab=notify";
    if (type === "business") {
      return appendDetailNavFromTalk(detailHref("business_service", listingId), { notify: true });
    }
    if (type === "builder") {
      const explicit = resolveExplicitNotificationHref(n);
      if (explicit) return explicit;
      const dealId = resolveBuilderDealId(n, listingId);
      if (isBuilderCompletionReport(n)) return dealDetailHref(dealId, "completion");
      if (/支払い|請求|invoice/i.test(String(n.title || "") + String(n.body || ""))) {
        return dealDetailHref(dealId, "invoice");
      }
      return dealDetailHref(dealId);
    }
    if (type === "skill") {
      if (listingId) return detailHref("skill", listingId);
      if (/demo-progress/i.test(url)) return detailHref("skill");
      return url || detailHref("skill");
    }
    if (type === "worker") return listingId ? detailHref("worker", listingId) : url || "talk-home.html?tab=notify";
    if (type === "general") {
      const built = global.TasuTalkPlatformNotify?.buildManagementNotifyUrl?.(listingId, { id: listingId });
      if (built && built !== "#") return built;
      return listingId ? detailHref("general", listingId) : url || "talk-home.html?tab=notify";
    }

    if (url && url !== "#") {
      const normalized = route()?.normalizeDetailHref?.(url) || url;
      if (!/^dashboard\.html/i.test(String(normalized).split("?")[0])) return normalized;
    }
    return "talk-home.html?tab=notify";
  }

  function resolveFollowTarget(notification) {
    const n = notification || {};
    const targetId = pickStr(n.followTargetId, n.follow_target_id);
    const type = pickStr(
      n.followTargetType,
      n.follow_target_type,
      global.TasuTalkCategory?.normalizeFollowType?.(n.type, n)
    );
    if (targetId && type) {
      return { targetId, type, ok: true };
    }
    const fromUrl = pickIdFromUrl(n.targetUrl);
    const fromType = global.TasuTalkCategory?.normalizeFollowType?.(n.type, n) || "";
    if (fromUrl && fromType && global.TasuTalkFollowStore?.VALID_TYPES?.has?.(fromType)) {
      return { targetId: fromUrl, type: fromType, ok: true };
    }
    return { targetId: "", type: "", ok: false };
  }

  /** 通知タブ・公式トークでは業務操作ラベルを出さない（遷移のみ） */
  const FORBIDDEN_BUSINESS_ACTION_LABELS = Object.freeze([
    "受ける",
    "受けない",
    "採用",
    "採用する",
    "不採用",
    "不採用する",
    "承認する",
    "差し戻す",
    "支払う",
    "支払い",
    "完了にする",
    "返信する",
  ]);

  const FORBIDDEN_BUSINESS_ACTION_RE = new RegExp(
    `^(?:${FORBIDDEN_BUSINESS_ACTION_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`
  );

  function isForbiddenBusinessActionLabel(label) {
    const text = String(label || "").trim();
    if (!text) return false;
    if (FORBIDDEN_BUSINESS_ACTION_RE.test(text)) return true;
    return FORBIDDEN_BUSINESS_ACTION_LABELS.some(
      (word) => text === word || text.startsWith(`${word}する`)
    );
  }

  function sanitizeNavigateActionLabel(label) {
    const text = pickStr(label, "詳細を見る");
    if (global.TasuPlatformNotifyActionLabels?.isSemanticNavigateLabel?.(text)) return text;
    return isForbiddenBusinessActionLabel(text) ? "詳細を見る" : text;
  }

  function resolveNotifyActionLabel(notification) {
    const n = notification || {};
    const resolver = global.TasuPlatformNotifyActionLabels?.resolvePlatformNotifyActionLabel;
    if (
      isPlatformMasterNotification(n) ||
      isPlatformFeeMasterNotification(n) ||
      String(n.source || "") === "platform_chat_demo_v1"
    ) {
      return sanitizeNavigateActionLabel(pickStr(resolver?.(n), n.actionLabel, "確認する"));
    }
    return sanitizeNavigateActionLabel(pickStr(n.actionLabel, "確認する"));
  }

  function buildNotifyNavigateAction(notification) {
    const n = notification || {};
    const label = resolveNotifyActionLabel(n);
    if (isTalkMasterNotification(n)) {
      const href = appendFromNotifyParam(appendUserId(resolveTalkMasterHref(n)));
      if (!href || href === "#") return null;
      return {
        id: "navigate",
        label,
        kind: "primary",
        href,
      };
    }
    const rawHref = appendUserId(resolveNotificationOpenHref(n));
    const href = shouldKeepNotifyFromParam(n, rawHref)
      ? rawHref
      : isDetailPageHref(rawHref)
        ? appendDetailNavFromTalk(rawHref, { notify: true })
        : appendFromNotifyParam(rawHref);
    if (!href || href === "#") return null;
    return {
      id: "navigate",
      label,
      kind: "primary",
      href,
    };
  }

  function buildTalkMasterNotificationActions(notification) {
    const nav = buildNotifyNavigateAction(notification);
    return nav ? [nav] : [];
  }

  /** @deprecated */
  function buildPlatformNotificationActions(notification) {
    return buildTalkMasterNotificationActions(notification);
  }

  /**
   * @param {object} notification
   * @returns {Array<object>}
   */
  function buildNotificationActions(notification) {
    const n = notification || {};
    if (isTalkMasterNotification(n)) {
      return buildTalkMasterNotificationActions(n);
    }
    const type = String(n.type || "system").toLowerCase();
    const source = String(n.source || "").toLowerCase();
    const targetUrl = pickStr(n.targetUrl) || "#";
    const openHref = resolveNotificationOpenHref(n);
    const listingId = pickIdFromUrl(openHref) || pickIdFromUrl(targetUrl);
    const unread = Boolean(n.unread);
    const actions = [];

    actions.push({
      id: "open",
      label: "開く",
      kind: "primary",
      href: openHref,
    });

    if (unread) {
      actions.push({ id: "mark-read", label: "既読にする", kind: "default" });
    } else {
      actions.push({ id: "mark-unread", label: "未読に戻す", kind: "default" });
    }

    actions.push({
      id: "hide",
      label: "非表示",
      kind: "danger",
      confirm: "この通知を一覧から非表示にしますか？",
    });

    const pushHref = (id, label, href, kind) => {
      if (!href || href === "#") return;
      actions.push({ id, label, kind: kind || "secondary", href: appendUserId(href) });
    };

    if (source === "follow") {
      const follow = resolveFollowTarget(n);
      if (follow.ok) {
        actions.push({
          id: "follow-unfollow",
          label: "フォロー解除",
          kind: "danger",
          confirm: "フォロー・お気に入りを解除しますか？",
          followTargetId: follow.targetId,
          followTargetType: follow.type,
        });
        actions.push({
          id: "follow-notify-off",
          label: "フォロー通知OFF",
          kind: "default",
          followTargetId: follow.targetId,
          followTargetType: follow.type,
        });
      }
    }

    if (source === "talk-broadcast-draft-send") {
      const draftId = pickStr(n.broadcastDraftId, n.broadcast_draft_id);
      actions.push({
        id: "broadcast-history",
        label: "配信履歴を見る",
        kind: "secondary",
        broadcastDraftId: draftId,
      });
    }

    const bizUrl = detailHref("business_service", listingId);
    const builderDealId = resolveBuilderDealId(n, listingId);
    const builderDealHref = dealDetailHref(builderDealId);
    const builderCompletionHref = dealDetailHref(builderDealId, "completion");
    const typeActions = {
      job: [
        ["view-job", "求人を見る", listingId ? detailHref("job", listingId) : targetUrl],
        ["job-applications", "応募管理へ", "chat-list.html"],
        ["job-chat", "チャットへ", "talk-home.html?tab=chat"],
      ],
      skill: [
        [
          "view-skill",
          "スキルを見る",
          listingId
            ? detailHref("skill", listingId)
            : /demo-progress/i.test(targetUrl)
              ? detailHref("skill")
              : targetUrl,
        ],
        ["skill-talk", "TALKで問い合わせ", "talk-home.html?tab=chat"],
      ],
      worker: [
        ["view-worker", "ワーカーを見る", listingId ? detailHref("worker", listingId) : targetUrl],
        ["worker-talk", "TALKで連絡", "talk-home.html?tab=chat"],
      ],
      product: [
        ["view-product", "商品を見る", listingId ? detailHref("product", listingId) : targetUrl],
        ["product-orders", "注文確認へ", "order-complete.html"],
      ],
      shop: [
        ["view-shop", "店舗を見る", listingId ? detailHref("shop", listingId) : targetUrl],
        ["shop-products", "商品一覧へ", listingId ? detailHref("shop", listingId) : targetUrl],
      ],
      business: [
        ["view-business", "業務サービスを見る", bizUrl],
        ["business-estimate", "見積相談へ", bizUrl],
      ],
      builder: isBuilderCompletionReport(n)
        ? [
            ["view-completion", "完了報告を見る", builderCompletionHref],
            ["view-project", "案件を見る", builderDealHref],
            ["view-builder", "Builderを開く", "builder/index.html"],
          ]
        : [
            ["view-project", "案件を見る", builderDealHref],
            ["view-builder", "Builderを開く", "builder/index.html"],
            ["builder-chat", "チャットへ", "builder/mvp-threads.html"],
          ],
      anpi: [["view-anpi", "安否確認を見る", detailHref("anpi")]],
      system: [["view-detail", "詳細を見る", route()?.normalizeDetailHref?.(targetUrl) || targetUrl]],
    };

    const extras = typeActions[type] || typeActions.system;
    for (let i = 0; i < extras.length; i += 1) {
      const row = extras[i];
      pushHref(row[0], row[1], row[2], "secondary");
    }

    return actions;
  }

  /**
   * @param {string} actionId
   * @param {object} notification
   * @returns {{ ok: boolean, reason?: string, navigate?: string, highlightBroadcastId?: string }}
   */
  function executeNotificationAction(actionId, notification) {
    const id = String(actionId || "").trim();
    const n = notification;
    if (!n?.id) return { ok: false, reason: "no_notification" };

    const store = global.TasuTalkNotifications;
    const data = global.TasuTalkData;
    const followStore = global.TasuTalkFollowStore;

    if (id === "navigate" || id === "platform-action" || id === "open") {
      if (
        String(n.source || "") === "platform_chat_demo_v1" ||
        DEMO_COMPLETION_NOTIFY_SOURCES.has(String(n.source || ""))
      ) {
        const rawHref =
          resolveDemoCompletionChatNotifyHref(n) ||
          pickStr(n.href, n.targetUrl, n.actionUrl);
        const withUser = appendUserId(ensureChatDetailThreadInHref(n, rawHref));
        const demoHref = shouldKeepNotifyFromParam(n, withUser)
          ? withUser
          : appendFromNotifyParam(withUser);
        if (demoHref && demoHref !== "#") {
          data?.markNotificationRead?.(n.id);
          store?.markRead?.(n.id);
          return { ok: true, navigate: demoHref };
        }
      }
      const resolvedHref = isTalkMasterNotification(n)
        ? appendUserId(resolveTalkMasterHref(n))
        : appendUserId(resolveNotificationOpenHref(n));
      const href = shouldKeepNotifyFromParam(n, resolvedHref)
        ? resolvedHref
        : appendFromNotifyParam(resolvedHref);
      if (href && href !== "#") {
        data?.markNotificationRead?.(n.id);
        store?.markRead?.(n.id);
        return { ok: true, navigate: href };
      }
      return { ok: false, reason: "no_url" };
    }

    if (id === "mark-read") {
      data?.markNotificationRead?.(n.id);
      store?.markRead?.(n.id);
      return { ok: true };
    }

    if (id === "mark-unread") {
      data?.markNotificationUnread?.(n.id);
      return { ok: true };
    }

    if (id === "hide") {
      data?.hideNotification?.(n.id);
      return { ok: true };
    }

    if (id === "follow-unfollow") {
      const follow = resolveFollowTarget(n);
      if (!follow.ok) return { ok: false, reason: "no_follow_target" };
      followStore?.unfollow?.(follow.targetId, follow.type);
      return { ok: true };
    }

    if (id === "follow-notify-off") {
      const follow = resolveFollowTarget(n);
      if (!follow.ok) return { ok: false, reason: "no_follow_target" };
      followStore?.setFollowNotifyEnabled?.(follow.targetId, follow.type, undefined, false);
      return { ok: true };
    }

    if (id === "broadcast-history") {
      const draftId = pickStr(n.broadcastDraftId, n.broadcast_draft_id);
      return { ok: true, navigate: "talk-home.html?tab=ai", highlightBroadcastId: draftId || "" };
    }

    const actions = buildNotificationActions(n);
    const act = actions.find((a) => a.id === id);
    if (act?.href) {
      if (id.startsWith("view-") || id === "open") {
        data?.markNotificationRead?.(n.id);
        store?.markRead?.(n.id);
      }
      return { ok: true, navigate: act.href };
    }

    return { ok: false, reason: "unknown_action" };
  }

  global.TasuTalkNotifyActions = {
    buildNotificationActions,
    buildNotifyNavigateAction,
    executeNotificationAction,
    resolveNotificationOpenHref,
    resolveFollowTarget,
    appendFromTalkParam,
    appendFromNotifyParam,
    appendUserId,
    pickIdFromUrl,
    isForbiddenBusinessActionLabel,
    isPlatformMasterNotification,
    isBuilderMasterNotification,
    isAnpiMasterNotification,
    isPlatformFeeMasterNotification,
    isTalkMasterNotification,
    resolveTalkMasterHref,
    resolvePlatformHref,
    buildTalkMasterNotificationActions,
    buildPlatformNotificationActions,
    FORBIDDEN_BUSINESS_ACTION_RE,
    FORBIDDEN_BUSINESS_ACTION_LABELS,
  };
})(typeof window !== "undefined" ? window : globalThis);
