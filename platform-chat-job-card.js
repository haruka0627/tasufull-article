/**
 * 求人やりとりチャット — 550円支払い後のやりとり開始カード
 */
(function (global) {
  "use strict";

  const DEMO_HIRE_THREAD_ID = "chat-demo-job-hired-001";
  const DEMO_HIRE_MARKER = "tasful_job_chat_start_demo_v1";
  const CARD_TITLE = "応募者とのやりとりを開始してください";
  const GUIDE_TEXT = "条件確認・日程調整はこのチャットで進めてください。";
  const NOTIFY_TITLES = Object.freeze({
    poster: CARD_TITLE,
    applicant: "応募が承諾されました",
  });
  const JOB_NOTIFY_COPY = Object.freeze({
    hiredApplicant: {
      title: "応募が承諾されました",
      body: "掲載者が応募を承諾しました。やり取りチャットで条件確認・日程調整を進めてください。",
      cta: "やり取りチャットを開く",
    },
    completionRequest: {
      title: "取引完了の確認依頼",
      body: "掲載者から取引完了申請が届きました。内容を確認してください。",
      cta: "取引内容を確認する",
    },
    endRequest: {
      title: "掲載者から終了依頼が届きました",
      body: "掲載者がやり取り終了を依頼しました。内容を確認のうえ完了してください。",
      cta: "やり取りを完了する",
    },
    tradeCompleted: {
      title: "やり取りが完了しました",
      body: "お疲れさまでした。レビューでやり取りを締めくくれます。",
      cta: "レビューをする",
    },
  });
  const LEGACY_HIRED_TITLES = Object.freeze(["採用されました", "採用が完了しました", "採用確定"]);

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

  function formatHireDate(iso) {
    const d = new Date(iso || Date.now());
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function resolveApplication(thread) {
    const store = global.TasuJobApplicationsStore;
    const jobId = pickStr(thread?.listingId, thread?.listing?.id);
    const applicationId = pickStr(thread?.applicationId);
    if (!store?.findApplication || !jobId || !applicationId) return null;
    return store.findApplication(jobId, applicationId);
  }

  function resolveJobTitle(thread, app) {
    const jobId = pickStr(thread?.listingId, thread?.listing?.id, app?.job_id);
    const listing =
      global.TasuJobApplicationsStore?.resolveListing?.(jobId) ||
      global.TasuListingDemoCatalog?.STORE_BY_ID?.[jobId];
    return pickStr(thread?.listingTitle, thread?.listing?.title, listing?.title, listing?.company_name) || "求人";
  }

  function resolveApplicantName(thread, app) {
    return pickStr(
      thread?.buyerName,
      app?.applicant_name,
      global.TasuJobApplicationsStore?.getApplicantName?.(app?.applicant_id, thread?.buyerId)
    );
  }

  function resolvePosterName(thread, app) {
    const jobId = pickStr(thread?.listingId, app?.job_id);
    const listing = global.TasuJobApplicationsStore?.resolveListing?.(jobId);
    return pickStr(thread?.sellerName, listing?.company_name, listing?.user_name, "掲載者");
  }

  function profileAvatar(userId) {
    return pickStr(global.TasuChatUserIdentity?.getProfileForUserId?.(userId)?.avatarUrl);
  }

  function buildJobHiredCard(thread) {
    const app = resolveApplication(thread);
    const hiredAt = pickStr(thread?.activatedAt, thread?.updatedAt, app?.updated_at, thread?.createdAt);
    return {
      cardTitle: CARD_TITLE,
      jobTitle: resolveJobTitle(thread, app),
      applicantName: resolveApplicantName(thread, app),
      posterName: resolvePosterName(thread, app),
      startedAt: formatHireDate(hiredAt),
      hiredAt: formatHireDate(hiredAt),
      guide: GUIDE_TEXT,
      applicationId: pickStr(thread?.applicationId, app?.application_id),
    };
  }

  /** @deprecated — buildJobHiredCard を使用 */
  function buildJobApplicationCard(thread) {
    return buildJobHiredCard(thread);
  }

  function resolveCardThread(message) {
    const threadId = pickStr(message?.chatId, message?.roomId);
    const loaded = global.TasuChatThreadStore?.loadRoom?.(threadId);
    const row = global.TasuChatThreadStore?.readAll?.()?.find((t) => String(t.id) === threadId);
    if (row) return row;
    return loaded?.thread || null;
  }

  function seedJobHiredCardMessage(threadId, thread) {
    const id = pickStr(threadId, thread?.id);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false, reason: "no_store" };

    const card = buildJobHiredCard(thread);
    const sellerId = pickStr(thread?.sellerId);
    const sellerName = pickStr(thread?.sellerName, card.posterName) || "掲載者";
    const buyerId = pickStr(thread?.buyerId);
    const buyerName = pickStr(thread?.buyerName, card.applicantName) || "応募者";
    const now =
      pickStr(thread?.activatedAt, thread?.updatedAt, thread?.createdAt) ||
      new Date().toISOString();
    const introText = `${buyerName} さんとのやりとりを開始しました。${GUIDE_TEXT}`;

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const existing = Array.isArray(map[id]) ? map[id] : [];
      if (
        existing.some(
          (m) =>
            m?.kind === "job_hired_card" || String(m?.id) === `msg-${id}-job-hired-card`
        )
      ) {
        return { ok: true, skipped: true, card };
      }

      const seeded = [
        {
          id: `msg-${id}-job-hired-card`,
          chatId: id,
          roomId: id,
          senderId: sellerId,
          senderName: sellerName,
          text: "",
          createdAt: now,
          kind: "job_hired_card",
          jobHiredCard: card,
        },
        {
          id: `msg-${id}-hire-owner`,
          chatId: id,
          roomId: id,
          senderId: sellerId,
          senderName: sellerName,
          senderAvatarUrl: profileAvatar(sellerId),
          text: introText,
          createdAt: now,
          kind: "text",
        },
        {
          id: `msg-${id}-hire-applicant`,
          chatId: id,
          roomId: id,
          senderId: buyerId,
          senderName: buyerName,
          senderAvatarUrl: profileAvatar(buyerId),
          text: "よろしくお願いします。",
          createdAt: now,
          kind: "text",
        },
      ];
      const byId = new Map(existing.map((m) => [String(m.id), m]));
      seeded.forEach((m) => byId.set(String(m.id), m));
      map[id] = [...byId.values()].sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
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

  function seedJobApplicationCardMessage(threadId, thread) {
    return seedJobHiredCardMessage(threadId, thread);
  }

  function renderJobHiredCardHtml(message) {
    const thread = resolveCardThread(message);
    const card = thread
      ? buildJobHiredCard(thread)
      : { ...(message?.jobHiredCard || message?.jobApplicationCard || {}) };
    const cardTitle = pickStr(card.cardTitle, card.categoryLabel, CARD_TITLE);
    const jobTitle = pickStr(card.jobTitle, "求人");
    const applicantName = pickStr(card.applicantName);
    const posterName = pickStr(card.posterName);
    const startedAt = pickStr(card.startedAt, card.hiredAt);
    const guide = pickStr(card.guide, GUIDE_TEXT);
    const time = esc(formatTime(message?.createdAt));

    const row = (label, value, extraClass) =>
      value
        ? `<div class="chat-job-card__row"><span class="chat-job-card__label">${esc(label)}</span><span class="chat-job-card__value${extraClass ? ` ${extraClass}` : ""}">${esc(value)}</span></div>`
        : "";

    return (
      `<div class="chat-job-card-wrap" data-platform-job-hired-card>` +
      `<article class="chat-job-card chat-job-card--compact chat-job-card--hired" aria-label="${esc(cardTitle)}">` +
      `<p class="chat-job-card__category chat-job-card__category--hired">${esc(cardTitle)}</p>` +
      `<h3 class="chat-job-card__title">${esc(jobTitle)}</h3>` +
      row("応募者", applicantName) +
      row("掲載者", posterName) +
      row("開始日時", startedAt) +
      `<p class="chat-job-card__guide">${esc(guide)}</p>` +
      `</article>` +
      (time ? `<time class="chat-job-card__time">${time}</time>` : "") +
      `</div>`
    );
  }

  function renderJobApplicationCardHtml(message) {
    return renderJobHiredCardHtml(message);
  }

  function ensureJobHireNotifyDemo() {
    if (global.TasuTalkRuntime?.isTalkProductionMode?.() === true) return { ok: false, reason: "production" };
    try {
      if (global.localStorage.getItem(DEMO_HIRE_MARKER) === "1") return { ok: true, skipped: true };
    } catch {
      return { ok: false, reason: "storage" };
    }

    const store = global.TasuChatThreadStore;
    const appsStore = global.TasuJobApplicationsStore;
    if (!store?.readAll || !appsStore?.readAll) {
      return { ok: false, reason: "missing_store" };
    }

    appsStore.seedDemoIfEmpty?.();

    const listingId = "job_demo_full_001";
    const applicationId = "job-app-demo-001";
    const activatedAt = "2026-05-28T04:15:00.000Z";
    const threads = store.readAll();
    let thread = threads.find((t) => String(t.id) === DEMO_HIRE_THREAD_ID);

    if (!thread) {
      thread = {
        id: DEMO_HIRE_THREAD_ID,
        chatDomain: "work",
        threadKind: "job_hire",
        applicationId,
        listingId,
        listingType: "job",
        listingTitle: "YouTubeショート動画編集スタッフ募集",
        category: "求人",
        sellerId: "u_job_demo_full",
        sellerName: "タスク確認株式会社",
        partnerUserId: "u_job_demo_full",
        buyerId: "u_hiro",
        buyerName: "ひろ",
        status: "open",
        source: "job-hire",
        lastMessage: GUIDE_TEXT,
        createdAt: activatedAt,
        updatedAt: activatedAt,
        activatedAt,
      };
      try {
        global.localStorage.setItem(
          "tasful_chat_threads",
          JSON.stringify([thread, ...threads.filter((t) => String(t.id) !== DEMO_HIRE_THREAD_ID)])
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
    if (idx >= 0) {
      const nextApps = [...apps];
      nextApps[idx] = {
        ...nextApps[idx],
        status: "selected",
        thread_id: DEMO_HIRE_THREAD_ID,
        updated_at: activatedAt,
      };
      try {
        global.localStorage.setItem("tasful_job_applications_v1", JSON.stringify(nextApps));
        global.dispatchEvent(
          new CustomEvent(appsStore.EVENT_NAME || "tasu:job-applications-changed", {
            detail: { list: nextApps },
          })
        );
      } catch {
        return { ok: false, reason: "application_save_failed" };
      }
    }

    global.TasuPlatformChatFee?.markFeePaid?.(DEMO_HIRE_THREAD_ID, {
      listingId,
      category: "job",
      feeAmount: 550,
    });

    seedJobHiredCardMessage(DEMO_HIRE_THREAD_ID, thread);

    try {
      global.localStorage.setItem(DEMO_HIRE_MARKER, "1");
    } catch {
      /* ignore */
    }
    return { ok: true, threadId: DEMO_HIRE_THREAD_ID };
  }

  global.TasuPlatformChatJobCard = {
    DEMO_HIRE_THREAD_ID,
    CARD_TITLE,
    GUIDE_TEXT,
    NOTIFY_TITLES,
    JOB_NOTIFY_COPY,
    LEGACY_HIRED_TITLES,
    buildJobHiredCard,
    buildJobApplicationCard,
    seedJobHiredCardMessage,
    seedJobApplicationCardMessage,
    renderJobHiredCardHtml,
    renderJobApplicationCardHtml,
    ensureJobHireNotifyDemo,
  };
})(typeof window !== "undefined" ? window : globalThis);
