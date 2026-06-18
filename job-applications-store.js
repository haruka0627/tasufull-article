/**
 * 求人応募 — 応募記録（やりとり開始550円支払い後にチャット作成）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_job_applications_v1";
  const EVENT_NAME = "tasu:job-applications-changed";

  const DEMO_APPLICANTS = Object.freeze({
    u_hiro: { displayName: "ひろ", memo: "Premiere Pro 実務3年。ショート動画制作の実績多数。" },
    u_sachi: { displayName: "さちこ", memo: "CapCut中心。週25時間稼働可能です。" },
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newApplicationId() {
    return `job-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getApplicantId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getApplicantName(userId) {
    const id = pickStr(userId);
    const profile = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (profile?.displayName) return profile.displayName;
    if (DEMO_APPLICANTS[id]) return DEMO_APPLICANTS[id].displayName;
    return id || "応募者";
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const safe = Array.isArray(list) ? list : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuJobApplicationsStore] save failed:", err);
    }
    return safe;
  }

  function resolveListing(jobId) {
    const id = pickStr(jobId);
    const local = global.TasuListingLocalStore?.fetchById?.(id);
    if (local) return global.TasuListingLocalStore?.toDetailListing?.(local) || local;
    const storeRow = global.TasuListingStore?.fetchById?.(id);
    if (storeRow) return storeRow;
    const demo = global.TasuListingDemoCatalog?.STORE_BY_ID?.[id];
    if (demo) return demo;
    return {
      id,
      listing_id: id,
      title: "YouTubeショート動画編集スタッフ募集",
      user_id: "u_job_demo_full",
      company_name: "タスク確認株式会社",
    };
  }

  function isJobPoster(listing) {
    const posterId = pickStr(listing?.user_id, listing?.seller_user_id, listing?.author_user_id);
    const me = getApplicantId();
    if (!posterId) return false;
    return posterId === me;
  }

  function jobDemoFullSeedRows() {
    return [
      {
        application_id: "job-app-demo-001",
        job_id: "job_demo_full_001",
        applicant_id: "u_hiro",
        applicant_name: "ひろ",
        status: "applied",
        memo: DEMO_APPLICANTS.u_hiro.memo,
        created_at: "2026-05-28T02:30:00.000Z",
        thread_id: null,
      },
      {
        application_id: "job-app-demo-002",
        job_id: "job_demo_full_001",
        applicant_id: "u_sachi",
        applicant_name: "さちこ",
        status: "applied",
        memo: DEMO_APPLICANTS.u_sachi.memo,
        created_at: "2026-05-28T03:05:00.000Z",
        thread_id: null,
      },
      {
        application_id: "job-app-demo-003",
        job_id: "job_demo_full_001",
        applicant_id: "u_worker",
        applicant_name: "けんた",
        status: "applied",
        memo: "週末中心で稼働可能。Premiere・DaVinci対応。",
        created_at: "2026-05-28T03:40:00.000Z",
        thread_id: null,
      },
    ];
  }

  function isLiveFlowSeedSkip() {
    try {
      return new URLSearchParams(global.location?.search || "").get("liveFlow") === "1";
    } catch {
      return false;
    }
  }

  function seedDemoIfEmpty() {
    if (isLiveFlowSeedSkip()) {
      return readAll();
    }
    let list = readAll();
    const seeded = jobDemoFullSeedRows();
    if (list.some((a) => a.job_id === "job_demo_full_001")) {
      const missing = seeded.filter(
        (row) => !list.some((a) => String(a.application_id) === row.application_id)
      );
      if (missing.length) list = writeAll([...missing, ...list]);
      return list;
    }
    return writeAll([...seeded, ...list]);
  }

  function listByJob(jobId) {
    seedDemoIfEmpty();
    const jid = pickStr(jobId);
    return readAll()
      .filter((a) => String(a.job_id) === jid)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  function findApplication(jobId, applicationId) {
    return listByJob(jobId).find((a) => String(a.application_id) === String(applicationId)) || null;
  }

  function hasApplied(jobId, applicantId) {
    const jid = pickStr(jobId);
    const aid = pickStr(applicantId || getApplicantId());
    return readAll().some(
      (a) => String(a.job_id) === jid && String(a.applicant_id) === aid && a.status !== "rejected"
    );
  }

  /**
   * 応募送信（チャットは作らない）
   * @param {object} listing
   */
  function submitApplication(listing) {
    const jobId = pickStr(listing?.id, listing?.listing_id);
    if (!jobId) return { ok: false, reason: "missing_job_id" };

    const applicantId = getApplicantId();
    if (isJobPoster(listing)) return { ok: false, reason: "poster_cannot_apply" };

    seedDemoIfEmpty();
    if (hasApplied(jobId, applicantId)) return { ok: false, reason: "already_applied" };

    const row = {
      application_id: newApplicationId(),
      job_id: jobId,
      applicant_id: applicantId,
      applicant_name: getApplicantName(applicantId),
      status: "applied",
      memo: "",
      created_at: nowIso(),
      thread_id: null,
    };

    const list = readAll();
    list.unshift(row);
    writeAll(list);

    let notifyRow = null;
    try {
      notifyRow = global.TasuTalkPlatformNotify?.notifyJobApplicationReceived?.({
        listing,
        application: row,
      });
    } catch (err) {
      console.warn("[TasuJobApplicationsStore] notify skipped:", err);
    }

    try {
      global.TasuPlatformChatFeeGateFlow?.afterConnectFreeBuyerSubmitted?.(listing, row);
    } catch {
      /* bench B-chat / A-notify refresh — 求人も fee-gate 系と同経路 */
    }

    try {
      const posterId = pickStr(
        listing.user_id,
        listing.seller_user_id,
        global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(jobId, listing)
      );
      global.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.(posterId, {
        immediate: true,
        force: true,
        reason: "job_apply_poster_notify",
      });
    } catch {
      /* ignore */
    }

    return { ok: true, application: row, notify: notifyRow };
  }

  /**
   * 応募者一覧から「やりとりに進む」— 550円支払い画面へ
   */
  function beginJobChat(jobId, applicationId) {
    const listing = resolveListing(jobId);
    const app = findApplication(jobId, applicationId);
    if (!app) return { ok: false, reason: "application_not_found" };
    if (app.status === "rejected") return { ok: false, reason: "already_rejected" };

    const Fee = global.TasuPlatformChatFee;
    if (!Fee?.buildFeePayUrl || !Fee?.ensurePendingFeeDeferred) {
      return { ok: false, reason: "fee_module_missing" };
    }

    if (app.status === "selected" && app.thread_id) {
      const paid = Fee.isFeePaid?.(app.thread_id);
      if (paid) {
        return {
          ok: true,
          application: app,
          threadId: app.thread_id,
          feePending: false,
          payUrl: Fee.buildChatUrl?.({ id: app.thread_id }) || `chat-detail.html?thread=${encodeURIComponent(app.thread_id)}`,
        };
      }
    }

    const list = readAll();
    const idx = list.findIndex(
      (r) => String(r.job_id) === String(jobId) && String(r.application_id) === String(applicationId)
    );
    if (idx < 0) return { ok: false, reason: "application_not_found" };

    list[idx] = {
      ...list[idx],
      status: "awaiting_fee",
      updated_at: nowIso(),
    };
    writeAll(list);

    const feeAmount = Fee.calcJobChatFee?.() || Fee.JOB_CHAT_FEE_YEN || 550;
    Fee.ensurePendingFeeDeferred({
      listing,
      applicationId,
      listingId: jobId,
      feeAmount,
    });

    let pageFrom = "";
    try {
      pageFrom = String(new URLSearchParams(global.location?.search || "").get("from") || "").trim();
    } catch {
      pageFrom = "";
    }

    const payUrl = Fee.buildFeePayUrl({
      applicationId,
      listingId: jobId,
      category: "job",
      listing,
      from: pageFrom || "notify",
    });

    try {
      const posterId = pickStr(
        listing.user_id,
        listing.seller_user_id,
        global.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(jobId, listing)
      );
      global.TasuPlatformChatBenchEmbed?.postBenchRecipientNotifyRefresh?.(posterId, {
        immediate: true,
        force: true,
        reason: "job_begin_chat_fee",
      });
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      feePending: true,
      application: list[idx],
      payUrl,
      feeAmount,
    };
  }

  /** 550円支払い完了後 — 応募を採用済みにしスレッドを紐付け */
  function finalizeHireAfterPayment(thread) {
    const jobId = pickStr(thread?.listingId);
    const applicationId = pickStr(thread?.applicationId);
    const threadId = pickStr(thread?.id);
    if (!jobId || !applicationId || !threadId) return { ok: false, reason: "missing_context" };

    const apps = readAll();
    const idx = apps.findIndex(
      (a) => String(a.job_id) === jobId && String(a.application_id) === applicationId
    );
    if (idx < 0) return { ok: false, reason: "application_not_found" };

    apps[idx] = {
      ...apps[idx],
      status: "selected",
      thread_id: threadId,
      updated_at: nowIso(),
    };
    writeAll(apps);
    return { ok: true, application: apps[idx] };
  }

  /** @deprecated beginJobChat を使用 */
  function commitHire(jobId, applicationId) {
    return beginJobChat(jobId, applicationId);
  }

  function commitReject(jobId, applicationId) {
    const listing = resolveListing(jobId);
    const apps = readAll();
    const idx = apps.findIndex(
      (a) => String(a.job_id) === String(jobId) && String(a.application_id) === String(applicationId)
    );
    if (idx < 0) return { ok: false, reason: "application_not_found" };
    const app = apps[idx];
    if (app.status === "rejected") return { ok: true, application: app };

    apps[idx] = {
      ...app,
      status: "rejected",
      updated_at: nowIso(),
    };
    writeAll(apps);

    try {
      global.TasuTalkPlatformNotify?.notifyJobRejected?.({
        listing,
        application: apps[idx],
      });
    } catch (err) {
      console.warn("[TasuJobApplicationsStore] reject notify skipped:", err);
    }

    return { ok: true, application: apps[idx] };
  }

  global.TasuJobApplicationsStore = {
    STORAGE_KEY,
    EVENT_NAME,
    readAll,
    listByJob,
    findApplication,
    hasApplied,
    isJobPoster,
    resolveListing,
    submitApplication,
    beginJobChat,
    finalizeHireAfterPayment,
    commitHire,
    commitReject,
    seedDemoIfEmpty,
    writeAll,
    getApplicantId,
    getApplicantName,
  };
})(typeof window !== "undefined" ? window : globalThis);
