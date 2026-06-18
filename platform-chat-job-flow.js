/**
 * 求人カテゴリ — やりとり開始〜完了〜レビュー（550円のみ・Connect/完了時請求なし）
 */
(function (global) {
  "use strict";

  const DEMO_THREAD_ID = "chat-demo-job-full-001";
  const DEMO_MARKER = "tasful_job_full_flow_demo_v1";
  const RESET_PARAM = "jobFullReset";
  const LISTING_ID = "job_demo_full_001";
  const APPLICATION_ID = "job-app-demo-full-001";
  const POSTER_ID = "u_job_demo_full";
  const APPLICANT_ID = "u_hiro";
  const ACTIVATED_AT = "2026-05-28T05:00:00.000Z";

  const COMPLETION_CARD_TITLE = "やり取りが完了しました";
  const JOB_END_REQUEST_BTN_LABEL = "終了を依頼する";
  const JOB_CONFIRM_END_BTN_LABEL = "やり取りを完了する";
  const JOB_END_REQUESTED_BANNER = "掲載者から終了依頼が届きました";
  const JOB_END_REQUESTED_POSTER_BANNER =
    "終了依頼を送信しました。応募者の完了をお待ちください。";
  const JOB_CLOSED_BANNER = "やり取りは終了しました。レビューを行ってください。";
  const JOB_CLOSED_SEND_BLOCK = "このチャットは終了しています";
  const JOB_END_REQUEST_SYSTEM_MESSAGE = "掲載者がやり取り終了を依頼しました。";
  const JOB_CLOSED_SYSTEM_MESSAGE =
    "やり取りが完了しました。このチャットはクローズされました。";
  const END_REQUESTED_STATUS = "end_requested";
  const JOB_REVIEW_PROMPT_DONE = "レビュー済み";
  const COMPLETION_GUIDE = "お疲れさまでした。評価・レビューでやりとりを締めくくれます。";
  const REVIEW_PROMPT_TITLE = "✓ やりとりが完了しました";
  const REVIEW_PROMPT_BODY = "評価は1分ほどで完了します。最後に今回のやりとりを評価してください。";
  const REVIEW_PROMPT_BTN = "やりとり評価する";
  const REVIEW_PROMPT_DONE =
    global.TasuPlatformChatReviewFlow?.REVIEW_PROMPT_DONE || "✓ 評価を送信しました";

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

  function formatTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isJobThread(thread) {
    const kind = String(thread?.threadKind || "");
    const cat = pickStr(
      thread?.category,
      thread?.listingType,
      global.TasuPlatformChatFee?.resolveCategoryKey?.(thread)
    );
    return kind === "job_hire" || global.TasuPlatformChatFee?.isJobCategory?.(cat);
  }

  function getJobDemoReviewFromUrl() {
    try {
      return new URLSearchParams(global.location?.search || "").get("review") || "";
    } catch {
      return "";
    }
  }

  function isJobFullReviewFromUrl() {
    const review = getJobDemoReviewFromUrl();
    return review === "job-full" || review === "chat-demo";
  }

  function jobFullReviewOptionsFromUrl() {
    const review = getJobDemoReviewFromUrl();
    return review === "job-full" || review === "chat-demo" ? { review } : {};
  }

  function applyJobDemoReviewToUrl(u, options) {
    const review = pickStr(options?.review, getJobDemoReviewFromUrl());
    if (review === "job-full" || review === "chat-demo") {
      u.searchParams.set("review", review);
    }
  }

  function buildJobApplicationsUrl(listingId, options) {
    const id = pickStr(listingId, LISTING_ID);
    const u = new URL("detail-job.html", global.location?.href || "http://localhost/");
    u.searchParams.set("id", id);
    u.searchParams.set("view", "applications");
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "chat"));
    const userId = pickStr(
      options?.userId,
      global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(id)
    );
    if (userId) u.searchParams.set("userId", userId);
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}#applications`;
  }

  function buildJobNotifyUrl(options) {
    const u = new URL("talk-home.html", global.location?.href || "http://localhost/");
    u.searchParams.set("tab", "notify");
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "chat"));
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}`;
  }

  function buildJobTalkUrl(options) {
    const u = new URL("talk-home.html", global.location?.href || "http://localhost/");
    u.searchParams.set("tab", "chat");
    u.searchParams.set("thread", "official_tasful");
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "chat"));
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}`;
  }

  function buildJobCompletionUrl(threadId, options) {
    const u = new URL("job-completion.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", pickStr(threadId));
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "talk"));
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}`;
  }

  function resolveJobChatRecoveryLinks(roomId) {
    const params = new URLSearchParams(global.location?.search || "");
    const listingId = pickStr(params.get("listingId"), LISTING_ID);
    const meId =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      pickStr(params.get("userId"));
    const posterId = pickStr(
      global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(listingId),
      POSTER_ID
    );
    const isPoster = meId && meId === posterId;
    const reviewOpts = jobFullReviewOptionsFromUrl();
    return {
      listingId,
      applicationsUrl: buildJobApplicationsUrl(listingId, {
        userId: posterId,
        from: "chat",
        ...reviewOpts,
      }),
      notifyUrl: buildJobNotifyUrl({ userId: meId, from: "chat", ...reviewOpts }),
      talkUrl: buildJobTalkUrl({ userId: meId, from: "chat", ...reviewOpts }),
      isPoster,
    };
  }

  function ensureJobThreadForAccess(threadId) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread" };
    const store = global.TasuChatThreadStore;
    const existing = (store?.readAll?.() || []).find((t) => String(t.id) === id);
    if (existing) return { ok: true, thread: existing };

    const params = new URLSearchParams(global.location?.search || "");
    const listingId = pickStr(params.get("listingId"));
    const applicationId = pickStr(params.get("applicationId"));
    const access = store?.resolveThreadAccess?.({
      queryThread: id,
      listingId,
      applicationId,
      queryUserId: pickStr(params.get("userId")),
    });
    if (access?.ok && access.threadId) {
      const thread =
        access.thread || (store?.readAll?.() || []).find((t) => String(t.id) === access.threadId);
      if (thread) {
        if (String(thread.id) !== id) {
          return {
            ok: true,
            thread,
            recovered: true,
            correctThreadId: thread.id,
            redirectedFrom: id,
          };
        }
        return {
          ok: true,
          thread,
          recovered: Boolean(access.recoveredFrom),
        };
      }
    }
    if (listingId && applicationId && store?.findHireThread) {
      const linked = store.findHireThread(listingId, applicationId);
      if (linked) {
        if (String(linked.id) !== id) {
          return {
            ok: true,
            thread: linked,
            recovered: true,
            correctThreadId: linked.id,
            redirectedFrom: id,
          };
        }
        return { ok: true, thread: linked, recovered: true };
      }
      const listing = global.TasuJobApplicationsStore?.resolveListing?.(listingId);
      const app = global.TasuJobApplicationsStore?.findApplication?.(listingId, applicationId);
      const ensured = store?.ensureChatThreadForAcceptedJob?.({
        listing,
        application: app,
        thread: { id, listingId, applicationId },
      });
      if (ensured?.thread) {
        if (String(ensured.thread.id) !== id) {
          return {
            ok: true,
            thread: ensured.thread,
            recovered: true,
            created: ensured.created === true,
            correctThreadId: ensured.thread.id,
            redirectedFrom: id,
          };
        }
        return {
          ok: true,
          thread: ensured.thread,
          recovered: true,
          created: ensured.created === true,
        };
      }
    }

    if (id === DEMO_THREAD_ID || (isJobFullReviewFromUrl() && id === DEMO_THREAD_ID)) {
      global.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.();
      const seeded = (store?.readAll?.() || []).find((t) => String(t.id) === id);
      if (seeded) return { ok: true, thread: seeded, seeded: true };
    }

    const apps = global.TasuJobApplicationsStore?.readAll?.() || [];
    const app = apps.find((a) => String(a.thread_id) === id);
    if (app?.job_id && store?.findHireThread) {
      const linked = store.findHireThread(app.job_id, app.application_id);
      if (linked) return { ok: true, thread: linked };
    }

    return { ok: false, reason: "thread_not_found", threadId: id };
  }

  function formatCompletedAt(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function resolveJobCompletionSummary(threadId) {
    const id = pickStr(threadId);
    ensureJobThreadForAccess(id);
    const store = global.TasuChatThreadStore;
    const thread = (store?.readAll?.() || []).find((t) => String(t.id) === id) || null;
    let completedAt = "";
    try {
      const raw = global.localStorage.getItem(store?.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? map[id] : [];
      const card = list.find((m) => m.kind === "job_completion_card");
      completedAt = pickStr(card?.jobCompletionCard?.completedAt, card?.createdAt);
    } catch {
      /* ignore */
    }
    if (!completedAt) {
      completedAt = pickStr(thread?.completedAt, thread?.updatedAt);
    }
    const meId =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "";
    const isBuyer = meId && String(thread?.buyerId) === String(meId);
    const partnerName = isBuyer
      ? pickStr(thread?.sellerName, "掲載者")
      : pickStr(thread?.buyerName, "応募者");
    return {
      thread,
      jobTitle: pickStr(thread?.listingTitle, "YouTubeショート動画編集スタッフ募集"),
      partnerName,
      completedAt,
      completedAtLabel: formatCompletedAt(completedAt),
    };
  }

  function buildJobReviewUrl(threadId, options) {
    const u = new URL("job-review.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", pickStr(threadId));
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "talk"));
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}`;
  }

  function buildJobChatUrl(threadId, options) {
    const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
    u.searchParams.set("thread", pickStr(threadId));
    u.searchParams.set("talkDev", "1");
    u.searchParams.set("from", pickStr(options?.from, "talk"));
    if (options?.listingId) u.searchParams.set("listingId", pickStr(options.listingId));
    if (options?.applicationId) u.searchParams.set("applicationId", pickStr(options.applicationId));
    if (options?.userId) u.searchParams.set("userId", pickStr(options.userId));
    applyJobDemoReviewToUrl(u, options);
    return `${u.pathname}${u.search}`;
  }

  function appendJobCompletionCard(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };

    const card = {
      cardTitle: COMPLETION_CARD_TITLE,
      jobTitle: pickStr(thread?.listingTitle, "YouTubeショート動画編集スタッフ募集"),
      guide: COMPLETION_GUIDE,
      completedAt: new Date().toISOString(),
    };

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[id]) ? [...map[id]] : [];
      if (list.some((m) => m.kind === "job_completion_card")) {
        return { ok: true, skipped: true };
      }
      list.push({
        id: `msg-${id}-job-completion-card`,
        chatId: id,
        roomId: id,
        senderId: "__system__",
        senderName: "TASFUL",
        text: "",
        createdAt: new Date().toISOString(),
        kind: "job_completion_card",
        jobCompletionCard: card,
      });
      map[id] = list;
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap(map);
      } else {
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
      return { ok: true, card };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function getJobBuyerId(thread) {
    return pickStr(thread?.buyerId, thread?.buyer_id, thread?.applicantUserId);
  }

  function getJobSellerId(thread) {
    return pickStr(thread?.sellerId, thread?.seller_id);
  }

  function isDemoSellerUserId(userId) {
    return String(userId || "").startsWith("demo-seller-");
  }

  function resolveJobPosterUserId(thread) {
    const listingId = pickStr(thread?.listingId, thread?.listing?.id);
    const listing =
      thread?.listing ||
      global.TasuJobApplicationsStore?.resolveListing?.(listingId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      null;
    const fromListing = global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(listingId, listing);
    const fromThread = pickStr(thread?.posterUserId, thread?.ownerUserId, thread?.listingOwnerId);
    const sellerId = getJobSellerId(thread);
    const benchPoster = global.TasuTalkPlatformNotify?.resolveBenchPartnerAId?.("job");
    if (fromListing && !isDemoSellerUserId(fromListing)) return fromListing;
    if (fromThread && !isDemoSellerUserId(fromThread)) return fromThread;
    if (sellerId && !isDemoSellerUserId(sellerId)) return sellerId;
    if (benchPoster) return benchPoster;
    return pickStr(fromListing, fromThread, sellerId, benchPoster, POSTER_ID);
  }

  function resolveJobApplicantUserId(thread) {
    return pickStr(thread?.applicantUserId, getJobBuyerId(thread));
  }

  function isJobPoster(thread, userId) {
    const me = pickStr(userId);
    const posterId = resolveJobPosterUserId(thread);
    return Boolean(me && posterId && me === posterId);
  }

  function isJobApplicant(thread, userId) {
    const me = pickStr(userId);
    const applicantId = resolveJobApplicantUserId(thread);
    return Boolean(me && applicantId && me === applicantId);
  }

  function getJobReviewTargetUserId(thread, userId) {
    const me = pickStr(userId);
    const buyer = getJobBuyerId(thread);
    const applicant = resolveJobApplicantUserId(thread);
    const poster = resolveJobPosterUserId(thread);
    const seller = getJobSellerId(thread);
    if (me && buyer && me === buyer) return poster || seller;
    if (me && applicant && me === applicant) return poster || seller;
    if (me && poster && me === poster) return applicant || buyer;
    if (me && seller && me === seller) return applicant || buyer;
    return "";
  }

  function readLocalReviews() {
    try {
      const raw = global.localStorage?.getItem("tasu_chat_seed_v1");
      const seed = raw ? JSON.parse(raw) : {};
      return Array.isArray(seed?.reviews) ? seed.reviews : [];
    } catch {
      return [];
    }
  }

  function hasUserSubmittedReview(threadId, userId, targetUserId) {
    const id = pickStr(threadId);
    const me = pickStr(userId);
    const target = pickStr(
      targetUserId,
      (() => {
        const thread =
          (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === id) ||
          null;
        return thread ? getJobReviewTargetUserId(thread, me) : "";
      })()
    );
    if (global.TasuPlatformChatReviewFlow?.hasUserSubmittedReview) {
      return (
        global.TasuPlatformChatReviewFlow.hasUserSubmittedReview(threadId, userId, target) === true
      );
    }
    if (!id || !me) return false;
    return readLocalReviews().some((row) => {
      if (String(row.room_id) !== id || String(row.reviewer_id) !== me) return false;
      if (!target) return true;
      return String(row.reviewed_user_id) === target;
    });
  }

  function readFreshJobThread(thread, threadId) {
    const id = pickStr(threadId, thread?.id);
    if (!id) return thread || null;
    return (
      (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === id) ||
      thread ||
      null
    );
  }

  const JOB_ACTIVE_STATUS_ALIASES = new Set([
    "",
    "active",
    "open",
    "ready",
    "hired",
    "in_progress",
    "started",
  ]);

  function resolveJobRoomStatus(thread) {
    const fresh = readFreshJobThread(thread);
    return pickStr(fresh?.roomStatus, fresh?.status).toLowerCase();
  }

  function normalizeJobRoomStatus(thread) {
    const rs = resolveJobRoomStatus(thread);
    if (JOB_ACTIVE_STATUS_ALIASES.has(rs)) return "active";
    return rs;
  }

  function isJobRoomActiveForEnd(thread) {
    const rs = normalizeJobRoomStatus(thread);
    return rs === "active";
  }

  function isJobRoomClosed(thread) {
    return resolveJobRoomStatus(thread) === "closed";
  }

  function isJobEndRequested(thread) {
    const rs = resolveJobRoomStatus(thread);
    return rs === END_REQUESTED_STATUS || pickStr(thread?.jobStatus).toLowerCase() === END_REQUESTED_STATUS;
  }

  function isJobConversationClosed(thread) {
    const rs = resolveJobRoomStatus(thread);
    return rs === "closed" || rs === "completed" || rs === "cancelled";
  }

  function resolveJobMessageList(threadId, messages) {
    const id = pickStr(threadId);
    if (Array.isArray(messages) && messages.length > 0) return messages;
    const fromStore = global.TasuChatThreadStore?.getMessages?.(id) || [];
    if (fromStore.length > 0) return fromStore;
    return Array.isArray(messages) ? messages : [];
  }

  function countParticipantMessages(threadId, messages) {
    const id = pickStr(threadId);
    const thread =
      (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === id) || {};
    const buyer = getJobBuyerId(thread);
    const seller = getJobSellerId(thread);
    const poster = resolveJobPosterUserId(thread);
    const applicant = resolveJobApplicantUserId(thread);
    const list = resolveJobMessageList(id, messages);
    return list.filter((msg) => {
      const senderId = pickStr(msg?.senderId, msg?.sender_id);
      if (!senderId || senderId === "__system__") return false;
      if (msg?.kind && !["text", "attachment", "mixed"].includes(String(msg.kind))) return false;
      return (
        senderId === buyer ||
        senderId === seller ||
        senderId === poster ||
        senderId === applicant
      );
    }).length;
  }

  function hasAnyMessage(threadId, messages) {
    const id = pickStr(threadId);
    const list = resolveJobMessageList(id, messages);
    return list.some((msg) => {
      const senderId = pickStr(msg?.senderId, msg?.sender_id);
      if (!senderId || senderId === "__system__") return false;
      const kind = pickStr(msg?.kind, "text").toLowerCase();
      if (kind === "job_hired_card" || kind === "job_application_card") return true;
      if (["text", "attachment", "mixed"].includes(kind)) return true;
      return Boolean(pickStr(msg?.text));
    });
  }

  /** JOB END DEBUG パネル — talkDev=1&debug=1 または benchDebug=1 のときのみ UI 表示 */
  function isJobFlowDebugUiEnabled(options) {
    try {
      const opts = options || {};
      const params =
        opts.searchParams ||
        new URLSearchParams(
          pickStr(opts.search, global.location?.search) || ""
        );
      if (params.get("benchDebug") === "1") return true;
      return params.get("talkDev") === "1" && params.get("debug") === "1";
    } catch {
      return false;
    }
  }

  function getJobEndButtonHiddenReason(thread, userId, messages) {
    const fresh = readFreshJobThread(thread);
    const resolvedMessages = resolveJobMessageList(pickStr(fresh?.id), messages);
    if (!isJobThread(fresh)) return "not_job_thread";
    if (isJobRoomClosed(fresh)) return "room_closed";
    if (isJobEndRequested(fresh)) {
      if (canConfirmEnd(fresh, userId, resolvedMessages)) return "";
      if (isJobApplicant(fresh, userId)) return "end_requested_not_confirmable";
      return "end_requested_poster_waiting";
    }
    if (!isJobRoomActiveForEnd(fresh)) {
      return `room_status_${normalizeJobRoomStatus(fresh)}`;
    }
    if (isJobApplicant(fresh, userId)) return "applicant_active_no_button";
    if (!isJobPoster(fresh, userId)) return "not_poster";
    if (!hasAnyMessage(pickStr(fresh?.id), resolvedMessages)) return "no_messages";
    return "";
  }

  function canRequestEnd(thread, userId, messages) {
    const fresh = readFreshJobThread(thread);
    const resolvedMessages = resolveJobMessageList(pickStr(fresh?.id), messages);
    if (!isJobThread(fresh)) return false;
    if (!isJobRoomActiveForEnd(fresh)) return false;
    if (isJobConversationClosed(fresh) || isJobEndRequested(fresh)) return false;
    if (!isJobPoster(fresh, userId)) return false;
    return hasAnyMessage(pickStr(fresh?.id), resolvedMessages);
  }

  function canConfirmEnd(thread, userId, messages) {
    const fresh = readFreshJobThread(thread);
    const resolvedMessages = resolveJobMessageList(pickStr(fresh?.id), messages);
    if (!isJobThread(fresh)) return false;
    if (!isJobEndRequested(fresh) || isJobRoomClosed(fresh)) return false;
    if (!isJobApplicant(fresh, userId)) return false;
    return hasAnyMessage(pickStr(fresh?.id), resolvedMessages);
  }

  function canEndJobConversation(thread, userId, messages) {
    return canConfirmEnd(thread, userId, messages);
  }

  function canRequestJobEnd(thread, userId, messages) {
    return canRequestEnd(thread, userId, messages);
  }

  function getJobEndButtonState(thread, userId, messages) {
    const fresh = readFreshJobThread(thread);
    const threadId = pickStr(fresh?.id);
    const resolvedMessages = resolveJobMessageList(threadId, messages);
    const hiddenReason = getJobEndButtonHiddenReason(fresh, userId, resolvedMessages);
    const base = {
      visible: false,
      role: "",
      action: "",
      label: "",
      canRequestEnd: false,
      canConfirmEnd: false,
      requestEndButtonVisible: false,
      confirmEndButtonVisible: false,
      buttonHiddenReason: hiddenReason,
      hasAnyMessage: hasAnyMessage(threadId, resolvedMessages),
      normalizedRoomStatus: normalizeJobRoomStatus(fresh),
    };
    if (!isJobThread(fresh) || isJobRoomClosed(fresh)) {
      return base;
    }
    if (canConfirmEnd(fresh, userId, resolvedMessages)) {
      return {
        ...base,
        visible: true,
        role: "applicant",
        action: "job_end_confirm",
        label: JOB_CONFIRM_END_BTN_LABEL,
        canConfirmEnd: true,
        confirmEndButtonVisible: true,
        buttonHiddenReason: "",
      };
    }
    if (canRequestEnd(fresh, userId, resolvedMessages)) {
      return {
        ...base,
        visible: true,
        role: "poster",
        action: "job_end_request",
        label: JOB_END_REQUEST_BTN_LABEL,
        canRequestEnd: true,
        requestEndButtonVisible: true,
        buttonHiddenReason: "",
      };
    }
    return base;
  }

  function requestJobConversationEnd({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = readFreshJobThread(thread, id);
    if (!room || !isJobThread(room)) return { ok: false, reason: "not_job" };
    if (!canRequestEnd(room, userId)) return { ok: false, reason: "cannot_request" };

    const now = new Date().toISOString();
    const posterId = resolveJobPosterUserId(room);
    const patch = global.TasuPlatformChatCompletionFlow?.patchThread;
    const updated =
      (typeof patch === "function"
        ? patch(id, {
            roomStatus: END_REQUESTED_STATUS,
            status: END_REQUESTED_STATUS,
            jobStatus: END_REQUESTED_STATUS,
            endRequestedBy: posterId,
            endRequestedAt: now,
          })
        : null) || {
        ...room,
        roomStatus: END_REQUESTED_STATUS,
        status: END_REQUESTED_STATUS,
        jobStatus: END_REQUESTED_STATUS,
        endRequestedBy: posterId,
        endRequestedAt: now,
      };

    global.TasuPlatformChatCompletionFlow?.appendSystemMessage?.(id, JOB_END_REQUEST_SYSTEM_MESSAGE);

    try {
      global.TasuTalkPlatformNotify?.notifyJobEndRequested?.({
        thread: updated,
        threadId: id,
        roomId: id,
        requesterId: posterId,
        listing: {
          id: pickStr(updated.listingId, LISTING_ID),
          listing_type: "job",
          title: updated.listingTitle,
        },
      });
    } catch (err) {
      console.warn("[TasuPlatformChatJobFlow] notify end request failed:", err);
    }

    return { ok: true, requested: true, thread: updated, endRequested: true };
  }

  function confirmJobEndFromApplicant({ threadId, thread, userId }) {
    const id = pickStr(threadId, thread?.id);
    const room = readFreshJobThread(thread, id);
    if (!room || !isJobThread(room)) return { ok: false, reason: "not_job" };
    if (!canConfirmEnd(room, userId)) return { ok: false, reason: "cannot_confirm" };

    const now = new Date().toISOString();
    const applicantId = resolveJobApplicantUserId(room);
    const patch = global.TasuPlatformChatCompletionFlow?.patchThread;
    const updated =
      (typeof patch === "function"
        ? patch(id, {
            roomStatus: "closed",
            status: "closed",
            jobStatus: "completed",
            closedAt: now,
            closedBy: applicantId,
            closedByUserId: applicantId,
            confirmedEndBy: applicantId,
            completedAt: now,
          })
        : null) || {
        ...room,
        roomStatus: "closed",
        status: "closed",
        jobStatus: "completed",
        closedAt: now,
        closedBy: applicantId,
        closedByUserId: applicantId,
        confirmedEndBy: applicantId,
        completedAt: now,
      };

    global.TasuPlatformChatCompletionFlow?.appendSystemMessage?.(id, JOB_CLOSED_SYSTEM_MESSAGE);

    const listingId = pickStr(updated.listingId, LISTING_ID);
    const listingRow =
      global.TasuJobApplicationsStore?.resolveListing?.(listingId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      null;
    const posterUserId = resolveJobPosterUserId(updated);
    const completionCtx = {
      thread: updated,
      roomId: id,
      threadId: id,
      closedByUserId: applicantId,
      posterUserId,
      applicantUserId: applicantId,
      listing: {
        id: listingId,
        listing_type: "job",
        title: updated.listingTitle,
        user_id: pickStr(listingRow?.user_id, listingRow?.seller_user_id, posterUserId),
      },
    };
    try {
      const Notify = global.TasuTalkPlatformNotify;
      const diag = Notify?.pushJobCompletionNotifyDiag?.("confirmJobEndFromApplicant", {
        roomStatus: pickStr(updated.roomStatus, updated.status),
        jobStatus: pickStr(updated.jobStatus),
        closedByUserId: applicantId,
        posterUserId,
        applicantUserId: applicantId,
        threadId: id,
      });
      if (diag) global.__tasuJobCompletionNotifyDiag = diag;
      Notify?.notifyJobCompletionApprovedToRequester?.({
        ...completionCtx,
        approverId: applicantId,
        requesterId: posterUserId,
      });
    } catch {
      /* ignore */
    }

    handleJobConversationCompleted(completionCtx);

    return { ok: true, thread: updated, closed: true };
  }

  function endJobConversation(detail) {
    return confirmJobEndFromApplicant(detail);
  }

  function shouldShowJobReviewPrompt(thread) {
    return false;
  }

  function renderJobReviewPromptCardHtml(options) {
    const reviewed = options?.reviewed === true;
    const thread = options?.thread || null;
    const userId = pickStr(options?.userId);
    const title = REVIEW_PROMPT_TITLE;
    const body = REVIEW_PROMPT_BODY;
    const action =
      global.TasuPlatformChatReviewFlow?.renderReviewOpenActionHtml?.(thread, userId, {
        reviewed,
        btnLabel: REVIEW_PROMPT_BTN,
        doneLabel: JOB_REVIEW_PROMPT_DONE,
      }) ||
      (reviewed
        ? `<p class="chat-job-review-prompt__done" role="status">${esc(JOB_REVIEW_PROMPT_DONE)}</p>`
        : `<button type="button" class="chat-job-review-prompt__btn" data-platform-review-open data-platform-job-review-open aria-label="${esc(REVIEW_PROMPT_BTN)}">レビューをする</button>`);
    return (
      `<div class="chat-job-review-prompt-wrap" data-platform-job-review-prompt>` +
      `<article class="chat-job-review-prompt" aria-label="${esc(title)}">` +
      `<h3 class="chat-job-review-prompt__title">${esc(title)}</h3>` +
      `<p class="chat-job-review-prompt__body">${esc(body)}</p>` +
      action +
      `</article>` +
      `</div>`
    );
  }

  function renderJobCompletionCardHtml(message, thread, userId) {
    const card = message?.jobCompletionCard || {};
    const title = pickStr(card.cardTitle, COMPLETION_CARD_TITLE);
    const jobTitle = pickStr(card.jobTitle, "求人");
    const guide = pickStr(card.guide, COMPLETION_GUIDE);
    const completedAt = pickStr(card.completedAt, message?.createdAt);
    const time = esc(formatTime(completedAt));
    return (
      `<div class="chat-job-card-wrap" data-platform-job-completion-card>` +
      `<article class="chat-job-card chat-job-card--compact chat-job-card--completion" aria-label="${esc(title)}">` +
      `<p class="chat-job-card__category chat-job-card__category--completion">${esc(title)}</p>` +
      `<h3 class="chat-job-card__title">${esc(jobTitle)}</h3>` +
      `<p class="chat-job-card__guide">${esc(guide)}</p>` +
      `</article>` +
      (time ? `<time class="chat-job-card__time">${time}</time>` : "") +
      `</div>`
    );
  }

  function handleJobConversationCompleted(detail) {
    const thread = detail?.thread || {};
    const roomId = pickStr(detail?.roomId, thread?.id);
    if (!roomId || !isJobThread(thread)) return { ok: false, reason: "not_job" };

    appendJobCompletionCard(roomId, thread);

    const listingId = pickStr(thread.listingId, LISTING_ID);
    const listingRow =
      detail?.listing ||
      global.TasuJobApplicationsStore?.resolveListing?.(listingId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[listingId] ||
      null;
    const listing = {
      id: listingId,
      listing_type: "job",
      title: thread.listingTitle,
      user_id: pickStr(
        listingRow?.user_id,
        listingRow?.seller_user_id,
        detail?.listing?.user_id,
        resolveJobPosterUserId(thread)
      ),
    };
    const payload = {
      listing,
      thread,
      roomId,
      threadId: roomId,
      closedByUserId: pickStr(detail?.closedByUserId, thread?.closedByUserId),
      posterUserId: pickStr(detail?.posterUserId, resolveJobPosterUserId(thread)),
      applicantUserId: pickStr(detail?.applicantUserId, resolveJobApplicantUserId(thread)),
    };

    try {
      global.TasuTalkPlatformNotify?.notifyJobConversationCompleted?.(payload);
    } catch (err) {
      console.warn("[TasuPlatformChatJobFlow] notify after complete failed:", err);
    }

    return { ok: true, roomId };
  }

  function resetToFreshApplyState() {
    if (global.TasuTalkRuntime?.isTalkProductionMode?.() === true) return { ok: false };

    try {
      global.localStorage.removeItem(DEMO_MARKER);
      global.localStorage.removeItem("tasful_job_applications_v1");
      global.localStorage.removeItem("tasful_chat_threads");
      global.localStorage.removeItem("tasful_chat_messages");
      global.localStorage.removeItem("tasful_platform_chat_fees_v1");
      try {
        const raw = global.localStorage.getItem("tasu_chat_seed_v1");
        if (raw) {
          const seed = JSON.parse(raw);
          if (Array.isArray(seed?.reviews)) {
            seed.reviews = seed.reviews.filter((row) => String(row.room_id) !== DEMO_THREAD_ID);
            global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
          }
        }
      } catch {
        /* ignore */
      }
      global.TasuJobApplicationsStore?.seedDemoIfEmpty?.();
      const appsStore = global.TasuJobApplicationsStore;
      if (appsStore?.readAll && appsStore?.writeAll) {
        const next = appsStore
          .readAll()
          .filter(
            (a) =>
              !(
                String(a.job_id) === LISTING_ID &&
                String(a.applicant_id) === APPLICANT_ID
              )
          );
        appsStore.writeAll(next);
      }
      return { ok: true, fresh: true };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function resetInteractiveDemo() {
    if (global.TasuTalkRuntime?.isTalkProductionMode?.() === true) return { ok: false };

    try {
      global.localStorage.removeItem(DEMO_MARKER);
      global.localStorage.removeItem("tasful_job_applications_v1");
      global.localStorage.removeItem("tasful_chat_threads");
      global.localStorage.removeItem("tasful_chat_messages");
      global.localStorage.removeItem("tasful_platform_chat_fees_v1");
      try {
        const raw = global.localStorage.getItem("tasu_chat_seed_v1");
        if (raw) {
          const seed = JSON.parse(raw);
          if (Array.isArray(seed?.reviews)) {
            seed.reviews = seed.reviews.filter((row) => String(row.room_id) !== DEMO_THREAD_ID);
            global.localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));
          }
        }
      } catch {
        /* ignore */
      }
      global.TasuJobApplicationsStore?.seedDemoIfEmpty?.();
      global.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.({ force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }

  function maybeResetFromUrl() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("jobFullFresh") === "1") {
        resetToFreshApplyState();
        params.delete("jobFullFresh");
        const next = `${global.location.pathname}?${params.toString()}${global.location.hash}`;
        global.history.replaceState(null, "", next);
        return;
      }
      if (params.get(RESET_PARAM) !== "1") return;
      resetInteractiveDemo();
      params.delete(RESET_PARAM);
      const next = `${global.location.pathname}?${params.toString()}${global.location.hash}`;
      global.history.replaceState(null, "", next);
    } catch {
      /* ignore */
    }
  }

  function buildJobDualWindowCompletionUrls(options) {
    const base = global.location?.href || "http://localhost/";
    const threadId = DEMO_THREAD_ID;
    const useReview =
      options?.review === "job-full" || isJobFullReviewFromUrl() ? "job-full" : "";

    function chatUrl(userId, extra) {
      const u = new URL("chat-detail.html", base);
      u.searchParams.set("thread", threadId);
      u.searchParams.set("userId", pickStr(userId));
      u.searchParams.set("talkDev", "1");
      if (useReview) u.searchParams.set("review", useReview);
      if (extra?.reset) u.searchParams.set("jobFullReset", "1");
      return `${u.pathname}${u.search}`;
    }

    function notifyUrl(userId) {
      const u = new URL("talk-home.html", base);
      u.searchParams.set("tab", "notify");
      u.searchParams.set("userId", pickStr(userId));
      u.searchParams.set("talkDev", "1");
      if (useReview) u.searchParams.set("review", useReview);
      return `${u.pathname}${u.search}`;
    }

    return {
      threadId,
      posterId: POSTER_ID,
      applicantId: APPLICANT_ID,
      posterChat: chatUrl(POSTER_ID),
      applicantChat: chatUrl(APPLICANT_ID),
      posterChatFresh: chatUrl(POSTER_ID, { reset: true }),
      applicantNotify: notifyUrl(APPLICANT_ID),
      posterNotify: notifyUrl(POSTER_ID),
      launcher: (() => {
        const u = new URL("chat-dual-window-demo.html", base);
        u.searchParams.set("talkDev", "1");
        if (useReview) u.searchParams.set("review", useReview === "job-full" ? "chat-demo" : useReview);
        return `${u.pathname}${u.search}`;
      })(),
    };
  }

  global.TasuPlatformChatJobFlow = {
    DEMO_THREAD_ID,
    DEMO_MARKER,
    LISTING_ID,
    APPLICATION_ID,
    POSTER_ID,
    APPLICANT_ID,
    COMPLETION_CARD_TITLE,
    END_REQUESTED_STATUS,
    JOB_END_REQUEST_BTN_LABEL,
    JOB_CONFIRM_END_BTN_LABEL,
    JOB_END_REQUESTED_BANNER,
    JOB_END_REQUESTED_POSTER_BANNER,
    JOB_CLOSED_BANNER,
    JOB_CLOSED_SEND_BLOCK,
    JOB_CLOSED_SYSTEM_MESSAGE,
    JOB_REVIEW_PROMPT_DONE,
    COMPLETION_GUIDE,
    REVIEW_PROMPT_TITLE,
    REVIEW_PROMPT_BODY,
    REVIEW_PROMPT_BTN,
    REVIEW_PROMPT_DONE,
    isJobThread,
    getJobReviewTargetUserId,
    hasUserSubmittedReview,
    shouldShowJobReviewPrompt,
    renderJobReviewPromptCardHtml,
    buildJobReviewUrl,
    buildJobChatUrl,
    buildJobCompletionUrl,
    buildJobApplicationsUrl,
    buildJobNotifyUrl,
    buildJobTalkUrl,
    buildJobDualWindowCompletionUrls,
    resolveJobChatRecoveryLinks,
    ensureJobThreadForAccess,
    resolveJobCompletionSummary,
    isJobFullReviewFromUrl,
    resolveJobPosterUserId,
    resolveJobApplicantUserId,
    isJobPoster,
    isJobApplicant,
    isJobRoomClosed,
    isJobEndRequested,
    isJobConversationClosed,
    resolveJobMessageList,
    hasAnyMessage,
    isJobFlowDebugUiEnabled,
    normalizeJobRoomStatus,
    isJobRoomActiveForEnd,
    getJobEndButtonHiddenReason,
    canRequestEnd,
    canConfirmEnd,
    canEndJobConversation,
    canRequestJobEnd,
    getJobEndButtonState,
    requestJobConversationEnd,
    confirmJobEndFromApplicant,
    endJobConversation,
    appendJobCompletionCard,
    renderJobCompletionCardHtml,
    handleJobConversationCompleted,
    resetInteractiveDemo,
    resetToFreshApplyState,
    maybeResetFromUrl,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", maybeResetFromUrl);
  } else {
    maybeResetFromUrl();
  }
})(typeof window !== "undefined" ? window : globalThis);
