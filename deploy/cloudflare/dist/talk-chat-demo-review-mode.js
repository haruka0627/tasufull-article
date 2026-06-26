/**
 * 共通チャットフロー確認デモ — review=chat-demo
 * 2窓実操作フロー: 操作で増えた通知のみ表示（静的一覧・シーン再現なし）
 */
(function (global) {
  "use strict";

  const REVIEW_PARAM = "chat-demo";
  const LEGACY_REVIEW_PARAM = "job-full";
  const OFFICIAL_PLATFORM = "official_platform";

  const NOTIFY_FILTER_DROP_CODES = Object.freeze({
    CATEGORY_MISMATCH: "notify_filter_category_mismatch",
    STAGE_MISMATCH: "notify_filter_stage_mismatch",
    SCOPE_HIDDEN: "notify_filter_scope_hidden",
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

  function isChatDemoReviewMode() {
    try {
      const review = readSearchParams().get("review");
      return review === REVIEW_PARAM || review === LEGACY_REVIEW_PARAM;
    } catch {
      return false;
    }
  }

  function isLegacyJobFullReviewMode() {
    try {
      return readSearchParams().get("review") === LEGACY_REVIEW_PARAM;
    } catch {
      return false;
    }
  }

  function getDemoUserIdFromUrl() {
    const params = readSearchParams();
    const urlUid = pickStr(params.get("userId"));
    if (urlUid) return urlUid;
    if (isBenchEmbedMode()) {
      const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
      const sides = profile ? global.TasuPlatformChatDualWindowDemo?.getSideMeta?.(profile) : null;
      const role = pickStr(params.get("benchRole")).toLowerCase();
      const side = pickStr(params.get("benchSide"));
      if (role === "poster" || side === "A") return pickStr(sides?.A?.userId);
      if (role === "applicant" || side === "B") return pickStr(sides?.B?.userId);
    }
    return "";
  }

  function getActiveNotifyIds() {
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    if (profile?.notifyIds?.length) return profile.notifyIds;
    return global.TasuPlatformChatDualWindowFlow?.buildNotifyIds?.("job", false) || [];
  }

  function isLiveFlowDemo() {
    return global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true;
  }

  /** 2窓テストベンチ iframe 内 — 本番UIのままデータフィルタのみ適用 */
  function isBenchEmbedMode() {
    if (readSearchParams().get("benchEmbed") === "1") return true;
    try {
      if (global.self !== global.top) {
        const parentPath = String(global.parent?.location?.pathname || "");
        return parentPath.includes("chat-dual-window-demo");
      }
    } catch {
      /* cross-origin parent */
    }
    return false;
  }

  function resolveDemoRecipientUserId(row, profile) {
    const explicit = pickStr(row?.recipientUserId);
    if (explicit) return explicit;
    const role = pickStr(row?.recipientRole).toLowerCase();
    if (!role || !profile) return "";
    const Demo = global.TasuPlatformChatDualWindowDemo;
    const sides = Demo?.getSideMeta?.(profile);
    if (!sides) return "";
    if (role === "both") return "";
    if (profile.categoryKey === "job") {
      if (role === "poster") return sides.A.userId;
      if (role === "applicant") return sides.B.userId;
    }
    if (role === "seller" || role === "worker") return sides.A.userId;
    if (role === "buyer" || role === "requester") return sides.B.userId;
    return "";
  }

  function notificationMatchesDemoUser(row) {
    const uid = getDemoUserIdFromUrl();
    if (!uid) return true;
    const sender = pickStr(row?.senderUserId);
    if (sender && sender === uid) return false;
    const recipient = pickStr(row?.recipientUserId);
    if (recipient) return recipient === uid;
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const roleRecipient = resolveDemoRecipientUserId(row, profile);
    if (roleRecipient) return roleRecipient === uid;
    if (pickStr(row?.recipientRole).toLowerCase() === "both") return true;
    if (isLiveFlowDemo()) return false;
    if (!profile) return true;
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const notifies = Flow?.getNotifies?.(profile.id, profile.connect) || [];
    const spec = notifies.find((n) => n.id === resolveNotificationId(row));
    if (!spec) return false;
    return pickStr(Flow?.resolveNotifyUserId?.(profile, spec)) === uid;
  }

  function getActiveThreadId() {
    return global.TasuPlatformChatDualWindowDemo?.getProfile?.()?.threadId || "chat-demo-job-full-001";
  }

  function resolveNotificationId(row) {
    if (!row || typeof row !== "object") return "";
    return pickStr(row.id, row.notifyCard?.notificationId);
  }

  function isChatDemoReviewNotification(row) {
    const id = resolveNotificationId(row);
    return getActiveNotifyIds().includes(id);
  }

  function isDynamicPlatformReviewNotification(row) {
    return global.TasuPlatformChatReviewFlow?.isPlatformReviewNotification?.(row) === true;
  }

  function isDynamicDemoMessageNotification(row) {
    return global.TasuPlatformChatDualWindowNotify?.isDemoMessageNotification?.(row) === true;
  }

  function isDynamicDemoRuntimeNotification(row) {
    return global.TasuPlatformChatDualWindowNotify?.isDemoRuntimeNotification?.(row) === true;
  }

  /** liveFlow 実操作通知 — recipientUserId が A/B notify の userId と一致すれば通す */
  function passesLiveFlowRecipientGate(row) {
    const Live = global.TasuPlatformChatLiveFlow;
    const uid = getDemoUserIdFromUrl();
    if (!uid || Live?.isRuntimeLiveFlowNotification?.(row) !== true) return false;
    const recipient = pickStr(row?.recipientUserId);
    if (recipient && recipient === uid) return true;
    return notificationMatchesDemoUser(row);
  }

  function isInitialContactRuntimeNotification(row) {
    const src = String(row?.source || "").toLowerCase();
    const type = String(row?.type || "").toLowerCase();
    const srcOk =
      ["platform", "shop", "business", "job", "worker"].includes(src) ||
      (src === "platform" &&
        ["skill", "product", "worker", "general", "shop", "business"].includes(type));
    if (!srcOk) return false;
    const Live = global.TasuPlatformChatLiveFlow;
    if (!Live?.isRuntimeLiveFlowNotification?.(row)) return false;
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    if (!profile) return false;
    const listingIds = Live.getListingIdsForProfile?.(profile) || new Set();
    const lid = pickStr(row?.listingId, row?.listing_id);
    if (lid && listingIds.has && listingIds.has(lid)) return true;
    if (Live.notificationMatchesProfile?.(row, profile)) return true;
    return false;
  }

  function isDynamicReviewNotification(row) {
    return (
      isDynamicPlatformReviewNotification(row) ||
      isDynamicDemoMessageNotification(row) ||
      isDynamicDemoRuntimeNotification(row) ||
      isInitialContactRuntimeNotification(row)
    );
  }

  function evaluateChatDemoReviewNotificationFilter(row, ctx) {
    const baseOk = {
      passed: true,
      isCategoryMatch: true,
      isStageMatch: true,
      isHiddenByScope: false,
      isHiddenByRead: false,
      filterDropReason: "",
      filterDropNgCode: "",
    };
    if (!isChatDemoReviewMode()) return baseOk;

    const uid = pickStr(ctx?.currentUserId, getDemoUserIdFromUrl());
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const Live = global.TasuPlatformChatLiveFlow;
    const Flow = global.TasuPlatformChatDualWindowFlow;
    const id = resolveNotificationId(row);
    const dynamic = isDynamicReviewNotification(row);

    if (
      uid &&
      pickStr(row?.recipientUserId) === uid &&
      (pickStr(row?.type) === "job" ||
        pickStr(row?.source) === "job" ||
        pickStr(row?.category) === "求人")
    ) {
      return baseOk;
    }
    if (
      uid &&
      pickStr(row?.recipientUserId) === uid &&
      (pickStr(row?.source) === "platform_chat_review_v1" ||
        /やり取り完了が承認|レビューされました/.test(String(row?.title || ""))) &&
      (pickStr(row?.threadId, row?.thread_id) || pickStr(row?.listingId, row?.listing_id))
    ) {
      return baseOk;
    }

    if (
      uid &&
      pickStr(row?.recipientUserId) === uid &&
      String(row?.source || "").toLowerCase() === "platform_chat_demo_connect_requirements_v1"
    ) {
      return baseOk;
    }

    if (!notificationMatchesDemoUser(row)) {
      const recipient = pickStr(row?.recipientUserId);
      const sender = pickStr(row?.senderUserId);
      return {
        passed: false,
        isCategoryMatch: true,
        isStageMatch: true,
        isHiddenByScope: true,
        isHiddenByRead: false,
        filterDropReason:
          `demo user scope mismatch\n\nexpected:\ncurrentUserId=${uid || "—"}\n\nactual:\n` +
          `currentUserId=${uid || "—"} / notification.recipientUserId=${recipient || "—"}` +
          (sender ? ` / notification.senderUserId=${sender}` : ""),
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.SCOPE_HIDDEN,
      };
    }

    if (isLiveFlowDemo() && Live?.isRuntimeLiveFlowNotification) {
      if (Live.isRuntimeLiveFlowNotification(row) === true) {
        if (!passesLiveFlowRecipientGate(row)) {
          return {
            passed: false,
            isCategoryMatch: true,
            isStageMatch: false,
            isHiddenByScope: false,
            isHiddenByRead: false,
            filterDropReason:
              `liveFlow recipient gate failed\n\nexpected:\ncurrentUserId=${uid || "—"}\n\nactual:\n` +
              `recipientUserId=${pickStr(row?.recipientUserId) || "—"} passesLiveFlowRecipientGate=false`,
            filterDropNgCode: NOTIFY_FILTER_DROP_CODES.STAGE_MISMATCH,
          };
        }
        if (!profile || !Live?.notificationMatchesProfile) {
          if (!dynamic) {
            return {
              passed: false,
              isCategoryMatch: false,
              isStageMatch: false,
              isHiddenByScope: false,
              isHiddenByRead: false,
              filterDropReason:
                `not dynamic runtime notification and profile gate unavailable\n\nexpected:\n` +
                `dynamic or profile-matched notification\n\nactual:\nnotificationId=${id || "—"}`,
              filterDropNgCode: NOTIFY_FILTER_DROP_CODES.CATEGORY_MISMATCH,
            };
          }
          return baseOk;
        }
        if (Flow?.isInitialDemoNotification?.(row, profile)) return baseOk;
        if (dynamic) return baseOk;
        if (!Live.notificationMatchesProfile(row, profile)) {
          return {
            passed: false,
            isCategoryMatch: true,
            isStageMatch: false,
            isHiddenByScope: false,
            isHiddenByRead: false,
            filterDropReason:
              `notificationMatchesProfile=false\n\nexpected:\nprofile=${pickStr(profile?.id)} stage match\n\nactual:\n` +
              `notificationId=${id || "—"} type=${pickStr(row?.type)} source=${pickStr(row?.source)}`,
            filterDropNgCode: NOTIFY_FILTER_DROP_CODES.STAGE_MISMATCH,
          };
        }
        return baseOk;
      }
      if (!dynamic) {
        return {
          passed: false,
          isCategoryMatch: false,
          isStageMatch: false,
          isHiddenByScope: false,
          isHiddenByRead: false,
          filterDropReason:
            `not_runtime_live_flow\n\nexpected:\nruntime live-flow notification\n\nactual:\n` +
            `notificationId=${id || "—"} type=${pickStr(row?.type)} source=${pickStr(row?.source)}`,
          filterDropNgCode: NOTIFY_FILTER_DROP_CODES.CATEGORY_MISMATCH,
        };
      }
      return baseOk;
    }

    const allowed = new Set(getActiveNotifyIds());
    if (!dynamic && id && !allowed.has(id)) {
      return {
        passed: false,
        isCategoryMatch: false,
        isStageMatch: true,
        isHiddenByScope: false,
        isHiddenByRead: false,
        filterDropReason:
          `notify id not in activeNotifyIds\n\nexpected:\nactiveNotifyIds includes ${id}\n\nactual:\n` +
          `allowed=[${[...allowed].join(", ")}] notificationId=${id}`,
        filterDropNgCode: NOTIFY_FILTER_DROP_CODES.CATEGORY_MISMATCH,
      };
    }
    return baseOk;
  }

  function filterChatDemoReviewNotifications(list) {
    if (!isChatDemoReviewMode()) return list;
    const uid = getDemoUserIdFromUrl();
    const ctx = { currentUserId: uid };
    return (list || []).filter((n) => evaluateChatDemoReviewNotificationFilter(n, ctx).passed);
  }

  function filterChatDemoReviewTalkMessages(roomId, messages) {
    if (!isChatDemoReviewMode()) return messages;
    if (String(roomId || "") !== OFFICIAL_PLATFORM) return messages;
    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const Live = global.TasuPlatformChatLiveFlow;
    if (isLiveFlowDemo() && profile && Live?.notificationMatchesProfile) {
      const Flow = global.TasuPlatformChatDualWindowFlow;
      return (messages || []).filter((m) => {
        const nid = pickStr(m?.notifyCard?.notificationId, String(m?.id || "").replace(/^official-notify-/, ""));
        const row = (global.TasuTalkNotifications?.getAll?.() || []).find((n) => String(n.id) === nid);
        if (!row) return false;
        if (Flow?.isInitialDemoNotification?.(row, profile)) {
          return notificationMatchesDemoUser(row);
        }
        if (
          isDynamicPlatformReviewNotification(row) ||
          isDynamicDemoMessageNotification(row) ||
          isDynamicDemoRuntimeNotification(row)
        ) {
          return notificationMatchesDemoUser(row);
        }
        if (!Live.notificationMatchesProfile(row, profile)) return false;
        return notificationMatchesDemoUser(row);
      });
    }
    const allowed = new Set(getActiveNotifyIds());
    return (messages || []).filter((m) => {
      const nid = pickStr(m?.notifyCard?.notificationId, String(m?.id || "").replace(/^official-notify-/, ""));
      const row = (global.TasuTalkNotifications?.getAll?.() || []).find((n) => String(n.id) === nid);
      if (
        row &&
        (isDynamicPlatformReviewNotification(row) ||
          isDynamicDemoMessageNotification(row) ||
          isDynamicDemoRuntimeNotification(row))
      ) {
        return notificationMatchesDemoUser(row);
      }
      if (!allowed.has(nid)) return false;
      return row ? notificationMatchesDemoUser(row) : true;
    });
  }

  function filterChatDemoReviewChatThreads(threads) {
    if (!isChatDemoReviewMode()) return threads;
    const demoId = getActiveThreadId();
    return (threads || []).filter((t) => {
      const id = String(t?.id || "");
      return id === OFFICIAL_PLATFORM || id === demoId;
    });
  }

  function getChatDemoReviewMasterRows() {
    return (
      global.TasuPlatformChatDualWindowFlow?.buildNotifyRowsForProfile?.(
        global.TasuPlatformChatDualWindowDemo?.getProfile?.()
      ) || []
    );
  }

  function ensureChatDemoReviewTalkMessages() {
    if (!isChatDemoReviewMode() || isLiveFlowDemo()) return;
    if (global.__tasfulChatDemoReviewTalkSynced) return;
    global.__tasfulChatDemoReviewTalkSynced = true;
    const rows = getChatDemoReviewMasterRows();
    rows.forEach((n) => global.TasuTalkOfficialRooms?.syncNotification?.(n));
    global.TasuTalkOfficialRooms?.upsertOfficialThread?.(OFFICIAL_PLATFORM);
  }

  function isTalkHomeNotifyTab() {
    const body = global.document?.body;
    if (!body || body.dataset.page !== "talk-home") return false;
    return readSearchParams().get("tab") === "notify";
  }

  const BENCH_NOTIFY_FRAME_MIN_H = 520;
  const BENCH_NOTIFY_FRAME_FALLBACK_MIN_H = 480;
  const BENCH_CHAT_FRAME_MIN_H = 360;
  let lastBenchNotifyFrameHeight = 0;

  /** iframe 内 notify — 親 iframe の実高さに合わせる（480px 固定だとリストが表示領域外に伸びる） */
  function syncBenchNotifyEmbedHeight(forcedHeight) {
    if (!isBenchEmbedMode() || !isTalkHomeNotifyTab()) return false;
    const root = global.document?.documentElement;
    const body = global.document?.body;
    if (!root || !body) return false;
    const forced = Math.round(Number(forcedHeight) || 0);
    if (forced > 0) lastBenchNotifyFrameHeight = forced;
    const innerH = Math.round(
      global.innerHeight || root.clientHeight || global.document.documentElement.clientHeight || 0
    );
    const measured =
      forced > 0
        ? forced
        : lastBenchNotifyFrameHeight > 0
          ? lastBenchNotifyFrameHeight
          : Math.min(innerH || BENCH_NOTIFY_FRAME_MIN_H, 320);
    const vh =
      forced > 0 || lastBenchNotifyFrameHeight > 0
        ? Math.max(96, measured)
        : Math.max(BENCH_NOTIFY_FRAME_FALLBACK_MIN_H, measured);
    root.style.height = `${vh}px`;
    root.style.minHeight = `${vh}px`;
    root.style.maxHeight = `${vh}px`;
    root.style.overflow = "hidden";
    body.style.height = `${vh}px`;
    body.style.minHeight = `${vh}px`;
    body.style.maxHeight = `${vh}px`;
    body.style.overflow = "hidden";

    const panel = global.document.querySelector('[data-talk-panel="notify"]');
    const card = panel?.querySelector(".talk-card");
    const toolbar = panel?.querySelector(".talk-notify-toolbar");
    const list = global.document.querySelector("[data-talk-notify-list]");
    const prevListScrollTop = Math.round(list?.scrollTop || 0);
    const toolbarH = Math.round(toolbar?.getBoundingClientRect?.().height || 24);
    const panelMin = Math.max(96, vh - 6);
    const listMax = Math.max(72, vh - toolbarH - 10);
    if (panel) {
      panel.style.minHeight = "0";
      panel.style.maxHeight = `${panelMin}px`;
      panel.style.height = `${panelMin}px`;
      panel.style.setProperty("--tasu-bench-notify-panel-min-h", `${panelMin}px`);
      panel.style.setProperty("--talk-notify-list-max-height", `${listMax}px`);
    }
    if (card) {
      card.style.minHeight = "0";
      card.style.maxHeight = `${Math.max(96, vh - 4)}px`;
      card.style.height = "100%";
    }
    if (list) {
      list.style.height = `${listMax}px`;
      list.style.maxHeight = `${listMax}px`;
      list.style.minHeight = "0";
      list.classList.add("talk-notify-list--scrollable");
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
      const restoreTop = Math.min(Math.max(0, prevListScrollTop), maxScroll);
      if (restoreTop > 0) {
        const restore = () => {
          list.scrollTop = restoreTop;
        };
        restore();
        global.requestAnimationFrame(restore);
        global.setTimeout(restore, 40);
      }
    }
    return true;
  }

  let lastBenchChatEmbedVh = 0;

  /** iframe 内チャット — 親プレビュー高さに合わせて body を伸ばす */
  function syncBenchChatEmbedHeight(forcedHeight) {
    if (!isBenchEmbedMode() || isTalkHomeNotifyTab()) return false;
    const root = global.document?.documentElement;
    const body = global.document?.body;
    if (!root || !body) return false;
    const measured = Math.round(
      Number(forcedHeight) ||
        global.innerHeight ||
        root.clientHeight ||
        BENCH_CHAT_FRAME_MIN_H
    );
    const vh = Math.max(BENCH_CHAT_FRAME_MIN_H, measured);
    const scrollEl =
      global.document.getElementById("chatMessages") || global.document.scrollingElement || body;
    const prevScrollTop = Math.round(scrollEl?.scrollTop || 0);
    const embedDiag = global.__tasuBenchEmbedScrollDiag || {};
    const userScrolling =
      embedDiag.isUserScrolling === true || global.__tasuBenchEmbedScrollQuietUntil > Date.now();
    if (forcedHeight && Math.abs(vh - lastBenchChatEmbedVh) < 2) {
      if (prevScrollTop > 0) scrollEl.scrollTop = prevScrollTop;
      return true;
    }
    lastBenchChatEmbedVh = vh;
    root.style.height = `${vh}px`;
    root.style.minHeight = `${vh}px`;
    root.style.maxHeight = `${vh}px`;
    root.style.overflow = "hidden";
    body.style.height = `${vh}px`;
    body.style.minHeight = `${vh}px`;
    body.style.maxHeight = `${vh}px`;
    body.style.overflow = "auto";
    body.classList.add("talk-bench-chat-compact");
    const main = global.document.querySelector(".chat-detail-page, .chat-page, main");
    if (main) {
      main.style.minHeight = `${Math.max(280, vh - 8)}px`;
    }
    if (prevScrollTop > 0 && (userScrolling || prevScrollTop > 12)) {
      const restore = () => {
        scrollEl.scrollTop = prevScrollTop;
      };
      restore();
      global.requestAnimationFrame(restore);
      global.setTimeout(restore, 40);
    }
    return true;
  }

  function wireBenchEmbedMessageHandlers() {
    if (global.__tasuBenchEmbedMsgWired) return;
    global.__tasuBenchEmbedMsgWired = true;
    global.addEventListener("message", (ev) => {
      const data = ev.data || {};
      if (data.type === "tasu-bench-chat-frame-height") {
        syncBenchChatEmbedHeight(Number(data.height) || 0);
      }
      if (data.type === "tasu-bench-notify-frame-height" && isTalkHomeNotifyTab()) {
        syncBenchNotifyEmbedHeight(Number(data.height) || 0);
      }
    });
  }

  function applyBenchEmbedChrome() {
    if (!isBenchEmbedMode()) return false;
    const body = global.document?.body;
    if (!body) return false;

    body.dataset.benchEmbed = "1";
    const benchViewport = pickStr(readSearchParams().get("benchViewport"));
    if (benchViewport) body.dataset.benchViewport = benchViewport;
    if (readSearchParams().get("benchManagement") === "1") {
      body.dataset.benchManagement = "1";
    }
    if (isChatDemoReviewMode()) {
      body.dataset.talkChatDemoReview = "1";
    }
    if (isTalkHomeNotifyTab()) {
      body.classList.add("talk-bench-notify-compact");
      const notifyPanel = global.document.querySelector('[data-talk-panel="notify"]');
      if (notifyPanel) notifyPanel.hidden = false;
      syncBenchNotifyEmbedHeight();
      global.requestAnimationFrame(() => syncBenchNotifyEmbedHeight());
      global.setTimeout(() => syncBenchNotifyEmbedHeight(), 80);
      global.addEventListener("resize", syncBenchNotifyEmbedHeight);
    }
    const lead = global.document.querySelector("[data-talk-simple-lead]");
    if (lead) lead.hidden = true;
    if (!global.document.getElementById("platform-chat-bench-embed-css")) {
      const link = global.document.createElement("link");
      link.id = "platform-chat-bench-embed-css";
      link.rel = "stylesheet";
      link.href = "platform-chat-bench-embed.css";
      global.document.head.appendChild(link);
    }
    wireBenchEmbedMessageHandlers();
    if (!isTalkHomeNotifyTab()) {
      if (!global.__tasuBenchChatResizeWired) {
        global.__tasuBenchChatResizeWired = true;
        global.addEventListener("resize", () => {
          const scrollEl =
            global.document.getElementById("chatMessages") ||
            global.document.scrollingElement ||
            global.document.body;
          const prevScrollTop = Math.round(scrollEl?.scrollTop || 0);
          syncBenchChatEmbedHeight(global.innerHeight);
          if (prevScrollTop > 0) {
            const restore = () => {
              scrollEl.scrollTop = prevScrollTop;
            };
            restore();
            global.requestAnimationFrame(restore);
          }
        });
      }
      syncBenchChatEmbedHeight();
      global.requestAnimationFrame(() => syncBenchChatEmbedHeight());
      global.setTimeout(() => syncBenchChatEmbedHeight(), 80);
    }
    return true;
  }

  function applyDocumentChrome() {
    if (applyBenchEmbedChrome()) return;
    if (!isChatDemoReviewMode()) return;
    const body = global.document?.body;
    if (!body) return;

    body.classList.add("talk-chat-demo-review-mode");
    body.dataset.talkChatDemoReview = "1";
    if (isLegacyJobFullReviewMode()) {
      body.classList.add("talk-job-full-review-mode");
      body.dataset.talkJobFullReview = "1";
    }

    const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.();
    const sub = global.document.querySelector(".talk-notify-toolbar__sub");
    if (sub) {
      const connect = profile?.connect ? "Connectあり" : "Connectなし";
      const uid = getDemoUserIdFromUrl();
      const side = uid ? global.TasuPlatformChatDualWindowDemo?.resolveSideForUserId?.(profile, uid) : null;
      const role = side ? `${side.role}（${side.name}）` : uid || "—";
      sub.textContent = `2窓実操作 — ${pickStr(profile?.label, "求人")} / ${role} — ${connect}`;
    }

    const lead = global.document.querySelector("[data-talk-simple-lead]");
    if (lead) lead.hidden = true;
  }

  function initChatDemoReviewMode() {
    applyDocumentChrome();
    if (!isChatDemoReviewMode()) return;
    ensureChatDemoReviewTalkMessages();
  }

  global.TasuTalkChatDemoReviewMode = {
    REVIEW_PARAM,
    LEGACY_REVIEW_PARAM,
    OFFICIAL_PLATFORM,
    isChatDemoReviewMode,
    isLegacyJobFullReviewMode,
    isChatDemoReviewNotification,
    filterChatDemoReviewNotifications,
    filterChatDemoReviewTalkMessages,
    filterChatDemoReviewChatThreads,
    getDemoUserIdFromUrl,
    notificationMatchesDemoUser,
    evaluateChatDemoReviewNotificationFilter,
    NOTIFY_FILTER_DROP_CODES,
    getChatDemoReviewMasterRows,
    ensureChatDemoReviewTalkMessages,
    applyDocumentChrome,
    initChatDemoReviewMode,
    isBenchEmbedMode,
    syncBenchNotifyEmbedHeight,
    syncBenchChatEmbedHeight,
  };

  global.TasuTalkJobFullReviewMode = Object.assign(global.TasuTalkJobFullReviewMode || {}, {
    isJobFullReviewMode: isChatDemoReviewMode,
    filterJobFullReviewNotifications: filterChatDemoReviewNotifications,
    filterJobFullReviewTalkMessages: filterChatDemoReviewTalkMessages,
    filterJobFullReviewChatThreads: filterChatDemoReviewChatThreads,
    initJobFullReviewMode: initChatDemoReviewMode,
  });

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", initChatDemoReviewMode);
  } else {
    initChatDemoReviewMode();
  }
})(typeof window !== "undefined" ? window : globalThis);
