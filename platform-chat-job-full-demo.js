/**
 * 求人 end-to-end デモ — chat-demo-job-full-001 シード
 */
(function (global) {
  "use strict";

  const Flow = () => global.TasuPlatformChatJobFlow || {};
  const DEMO_THREAD_ID = "chat-demo-job-full-001";
  const DEMO_MARKER = "tasful_job_full_flow_demo_v1";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function ensureJobFullFlowDemo(options) {
    if (global.TasuTalkRuntime?.isTalkProductionMode?.() === true) {
      return { ok: false, reason: "production" };
    }
    if (
      options?.force !== true &&
      global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true &&
      global.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.() !== true
    ) {
      return { ok: true, skipped: true, reason: "live_flow" };
    }
    const force = options?.force === true;
    try {
      if (!force && global.localStorage.getItem(DEMO_MARKER) === "1") {
        return { ok: true, skipped: true, threadId: DEMO_THREAD_ID };
      }
    } catch {
      return { ok: false, reason: "storage" };
    }

    const store = global.TasuChatThreadStore;
    const existingThread = (store?.readAll?.() || []).find((t) => String(t.id) === DEMO_THREAD_ID);
    const existingStatus = String(existingThread?.roomStatus || existingThread?.status || "").toLowerCase();
    if (
      !force &&
      existingThread &&
      (existingThread.completionRequestedBy ||
        existingStatus === "completion_pending" ||
        existingStatus === "completed")
    ) {
      return { ok: true, skipped: true, threadId: DEMO_THREAD_ID, reason: "completion_flow" };
    }

    const F = Flow();
    const appsStore = global.TasuJobApplicationsStore;
    if (!store?.readAll || !appsStore?.readAll) {
      return { ok: false, reason: "missing_store" };
    }

    appsStore.seedDemoIfEmpty?.();

    const listingId = F.LISTING_ID || "job_demo_full_001";
    const applicationId = F.APPLICATION_ID || "job-app-demo-full-001";
    const activatedAt = "2026-05-28T05:00:00.000Z";
    const threads = store.readAll();
    let thread = threads.find((t) => String(t.id) === DEMO_THREAD_ID);

    if (!thread) {
      thread = {
        id: DEMO_THREAD_ID,
        chatDomain: "work",
        threadKind: "job_hire",
        applicationId,
        listingId,
        listingType: "job",
        listingTitle: "YouTubeショート動画編集スタッフ募集",
        category: "求人",
        sellerId: F.POSTER_ID || "u_job_demo_full",
        sellerName: "タスク確認株式会社",
        partnerUserId: F.POSTER_ID || "u_job_demo_full",
        buyerId: F.APPLICANT_ID || "u_hiro",
        buyerName: "ひろ",
        status: "open",
        roomStatus: "active",
        source: "job-full-demo",
        lastMessage: "条件確認・日程調整はこのチャットで進めてください。",
        createdAt: activatedAt,
        updatedAt: activatedAt,
        activatedAt,
      };
      try {
        global.localStorage.setItem(
          store.STORAGE_KEY,
          JSON.stringify([thread, ...threads.filter((t) => String(t.id) !== DEMO_THREAD_ID)])
        );
        global.dispatchEvent(new CustomEvent("tasful-chat-threads-changed"));
      } catch {
        return { ok: false, reason: "thread_save_failed" };
      }
    }

    const apps = appsStore.readAll();
    const idx = apps.findIndex(
      (a) => String(a.job_id) === listingId && String(a.application_id) === applicationId
    );
    const nextApps = [...apps];
    const appRow = {
      job_id: listingId,
      application_id: applicationId,
      applicant_id: F.APPLICANT_ID || "u_hiro",
      applicant_name: "ひろ",
      status: "selected",
      thread_id: DEMO_THREAD_ID,
      memo: "ポートフォリオ添付済み。平日夜と土日対応可。",
      created_at: "2026-05-28T04:50:00.000Z",
      updated_at: activatedAt,
    };
    if (idx >= 0) nextApps[idx] = { ...nextApps[idx], ...appRow };
    else nextApps.unshift(appRow);
    try {
      global.localStorage.setItem("tasful_job_applications_v1", JSON.stringify(nextApps));
    } catch {
      return { ok: false, reason: "application_save_failed" };
    }

    global.TasuPlatformChatFee?.markFeePaid?.(DEMO_THREAD_ID, {
      listingId,
      category: "job",
      feeAmount: 550,
    });

    global.TasuPlatformChatJobCard?.seedJobHiredCardMessage?.(DEMO_THREAD_ID, thread);

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map[DEMO_THREAD_ID]) ? [...map[DEMO_THREAD_ID]] : [];
      const sellerId = F.POSTER_ID || "u_job_demo_full";
      const buyerId = F.APPLICANT_ID || "u_hiro";
      const sellerName = "タスク確認株式会社";
      const buyerName = "ひろ";
      const t1 = new Date(activatedAt).getTime() + 60000;
      const t2 = t1 + 120000;
      const extras = [
        {
          id: `msg-${DEMO_THREAD_ID}-poster-msg`,
          chatId: DEMO_THREAD_ID,
          roomId: DEMO_THREAD_ID,
          senderId: sellerId,
          senderName: sellerName,
          text: "初稿の提出期限は来週金曜までで問題ないでしょうか。",
          createdAt: new Date(t1).toISOString(),
          kind: "text",
        },
        {
          id: `msg-${DEMO_THREAD_ID}-applicant-msg`,
          chatId: DEMO_THREAD_ID,
          roomId: DEMO_THREAD_ID,
          senderId: buyerId,
          senderName: buyerName,
          text: "問題ありません。木曜までに初稿をお送りします。",
          createdAt: new Date(t2).toISOString(),
          kind: "text",
        },
      ];
      extras.forEach((msg) => {
        if (!list.some((m) => String(m.id) === msg.id)) list.push(msg);
      });
      map[DEMO_THREAD_ID] = list;
      if (typeof store.writeMessagesMap === "function") {
        store.writeMessagesMap(map);
      } else {
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
    } catch {
      /* ignore message extras */
    }

    try {
      global.localStorage.setItem(DEMO_MARKER, "1");
    } catch {
      /* ignore */
    }

    return { ok: true, threadId: DEMO_THREAD_ID };
  }

  global.TasuPlatformChatJobFullDemo = {
    DEMO_THREAD_ID,
    ensureJobFullFlowDemo,
  };

  function initJobFullDemoSeed() {
    if (global.TasuPlatformChatLiveFlow?.isLiveFlowMode?.() === true) return;
    if (global.TasuTalkJobFullReviewMode?.isJobFullReviewMode?.()) {
      ensureJobFullFlowDemo({ force: true });
      return;
    }
    try {
      if (global.localStorage.getItem(DEMO_MARKER) === "1") {
        ensureJobFullFlowDemo();
      }
    } catch {
      /* ignore */
    }
  }

  initJobFullDemoSeed();
})(typeof window !== "undefined" ? window : globalThis);
