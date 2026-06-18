/**
 * プラット取引 — 完了報告（やりとりチャット内カード）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_platform_completion_v1";

  /** @type {Record<string, object>} */
  const CONNECT_DEAL_SPECS = Object.freeze({
    skill_deal_demo_001: {
      threadId: "chat-demo-skill-deal-001",
      listingId: "skill_deal_demo_001",
      listingType: "skill",
      category: "スキル",
      listingTitle: "Web制作・LP改修（React）",
      sellerId: "demo-skill-provider",
      sellerName: "クリエイター K",
      agreedAmount: 120000,
    },
    worker_deal_demo_001: {
      threadId: "chat-demo-worker-deal-001",
      listingId: "demo-worker-001",
      listingType: "worker",
      category: "ワーカー",
      listingTitle: "渋谷エリア買い物代行",
      sellerId: "demo-worker-001",
      sellerName: "代行ワーカーA",
      agreedAmount: 3000,
    },
    business_deal_demo_001: {
      threadId: "chat-demo-business-deal-001",
      listingId: "demo-business-service-001",
      listingType: "business_service",
      category: "業務サービス",
      listingTitle: "外壁塗装・シリコン塗装",
      sellerId: "u_business_demo",
      sellerName: "塗装工房サポート",
      agreedAmount: 850000,
    },
    job_deal_demo_001: {
      threadId: "chat-demo-job-deal-001",
      listingId: "job_demo_full_001",
      listingType: "job",
      category: "求人",
      listingTitle: "YouTubeショート動画編集スタッフ募集",
      sellerId: "u_job_demo_full",
      sellerName: "タスク確認株式会社",
      agreedAmount: 250000,
    },
  });

  const DEAL_THREAD_MAP = Object.freeze(
    Object.fromEntries(
      Object.entries(CONNECT_DEAL_SPECS).map(([dealId, spec]) => [dealId, spec.threadId])
    )
  );

  /** 旧デモ — 商品系は購入フローへ移行済み（完了報告デモの掃除用） */
  const LEGACY_PRODUCT_PURCHASE_DEAL_THREADS = Object.freeze({
    shop_deal_demo_001: "chat-demo-shop-deal-001",
    product_deal_demo_001: "chat-demo-product-deal-001",
  });

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

  function readStateMap() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStateMap(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    } catch {
      /* ignore */
    }
  }

  function getConnectDealSpec(dealId) {
    const key = pickStr(dealId);
    return key ? CONNECT_DEAL_SPECS[key] || null : null;
  }

  /** worker / business_service のみ — 完了報告カード（skill/product/shop は別フロー） */
  function usesCompletionReportDealFlow(dealId) {
    const key = pickStr(dealId);
    if (LEGACY_PRODUCT_PURCHASE_DEAL_THREADS[key]) return false;
    const spec = getConnectDealSpec(key);
    if (!spec) return false;
    const cat = global.TasuPlatformChatCategoryFlow?.normalizeCategoryKey?.(spec.listingType) || "";
    if (cat === "skill" || cat === "product" || cat === "shop" || cat === "shop_store") {
      return false;
    }
    if (global.TasuPlatformChatCategoryFlow?.isProductFlowCategory?.(cat) === true) {
      return false;
    }
    return cat === "worker" || cat === "business" || cat === "business_service";
  }

  function resolveDealThreadIdForPurge(dealId) {
    const key = pickStr(dealId);
    return pickStr(DEAL_THREAD_MAP[key], LEGACY_PRODUCT_PURCHASE_DEAL_THREADS[key]);
  }

  function purgeCompletionReportFromThread(threadId) {
    const id = pickStr(threadId);
    const store = global.TasuChatThreadStore;
    if (!id || !store?.MESSAGES_KEY) return { ok: false };
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map?.[id]) ? map[id] : [];
      const next = list.filter((m) => {
        if (m?.kind === "completion_report") return false;
        const text = String(m?.text || "");
        if (/作業が完了しました|完了報告をご確認/.test(text)) return false;
        return true;
      });
      if (next.length !== list.length) {
        map[id] = next;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
      return { ok: true, removed: list.length - next.length };
    } catch {
      return { ok: false };
    }
  }

  function resolveDealId(detail) {
    return pickStr(detail?.dealId, detail?.deal?.id, detail?.notification?.dealId);
  }

  function resolveThreadId(detail) {
    const dealId = resolveDealId(detail);
    return pickStr(
      detail?.threadId,
      detail?.thread?.id,
      DEAL_THREAD_MAP[dealId],
      detail?.roomId,
      detail?.room?.id,
      detail?.deal?.chat_id
    );
  }

  function resolveRoomId(detail) {
    return pickStr(detail?.roomId, detail?.room?.id, detail?.deal?.chat_id);
  }

  function buildNotifyChatUrl(detail) {
    const dealId = resolveDealId(detail);
    const roomId = resolveRoomId(detail);
    const threadId = resolveThreadId(detail);
    const base = global.location?.href || "http://localhost/";

    if (roomId && !threadId.startsWith("chat-")) {
      const u = new URL("chat-detail.html", base);
      u.searchParams.set("roomId", roomId);
      u.searchParams.set("room", roomId);
      if (dealId) u.searchParams.set("deal", dealId);
      return u.pathname + u.search;
    }

    const tid = threadId || (dealId ? DEAL_THREAD_MAP[dealId] : "");
    if (!tid) return "#";
    const u = new URL("chat-detail.html", base);
    u.searchParams.set("thread", tid);
    if (dealId) u.searchParams.set("deal", dealId);
    return u.pathname + u.search;
  }

  function getDemoDeal(dealId) {
    return global.TasuDemoDealsData?.getProgressDealById?.(dealId) || null;
  }

  function extractAgreedAmount(deal, spec) {
    const estimate = deal?.estimate?.amount;
    if (estimate) {
      const digits = String(estimate).replace(/[^\d]/g, "");
      if (digits) return Math.round(Number(digits));
    }
    if (deal?.agreed_amount != null) return Math.round(Number(deal.agreed_amount));
    return Math.max(0, Math.round(Number(spec?.agreedAmount) || 0));
  }

  function buildReportFromDemoDeal(dealId) {
    const deal = getDemoDeal(dealId);
    if (!deal?.hasCompletionReport) return null;
    const report = deal.completionReport || {};
    return {
      title: "完了報告",
      reporterName: report.reporterName || deal.clientName || "—",
      submittedContent: report.submittedContent || "作業完了報告（デモ）",
      attachments: report.attachments || "—",
      confirmMemo: pickStr(report.confirmMemo, ""),
      receivedAt: report.receivedAt || deal.updatedLabel || "—",
    };
  }

  function getCompletionReport(dealId) {
    const key = pickStr(dealId);
    if (!key) return null;
    const map = readStateMap();
    const stored = map[key]?.report;
    if (stored && typeof stored === "object") {
      return {
        title: pickStr(stored.title, "完了報告"),
        reporterName: pickStr(stored.reporterName, "—"),
        submittedContent: pickStr(stored.submittedContent, stored.content, "—"),
        attachments: pickStr(stored.attachments, "—"),
        confirmMemo: pickStr(stored.confirmMemo, ""),
        receivedAt: pickStr(stored.receivedAt, "—"),
        status: pickStr(stored.status, map[key]?.status),
      };
    }
    return null;
  }

  function getCompletionStatus(dealId) {
    const key = pickStr(dealId);
    if (!key) return "none";
    const map = readStateMap();
    const row = map[key];
    if (row?.status === "approved" || row?.status === "rejected") return row.status;
    if (row?.status === "pending" || row?.report) return "pending";
    return "none";
  }

  function getCompletionFeeState(dealId) {
    const spec = getConnectDealSpec(dealId);
    const threadId = pickStr(spec?.threadId, DEAL_THREAD_MAP[dealId]);
    const Fee = global.TasuPlatformChatFee;
    const row = Fee?.getFeeRecord?.(threadId);
    if (!row || pickStr(row.feePhase) !== "on_complete") {
      return { pending: false, paid: false, amount: 0, payUrl: "" };
    }
    const paid = pickStr(row.status).toLowerCase() === "paid";
    const amount = Math.round(Number(row.feeAmount) || 0);
    const payUrl =
      Fee?.buildCompletionFeePayUrl?.({
        threadId,
        dealId,
        listingId: spec?.listingId,
        category: spec?.listingType,
        feeAmount: amount,
      }) || "";
    return { pending: !paid, paid, amount, payUrl, row };
  }

  function setCompletionStatus(dealId, status, extra) {
    const key = pickStr(dealId);
    if (!key) return;
    const map = readStateMap();
    map[key] = {
      ...(map[key] || {}),
      status,
      ...(extra || {}),
      updatedAt: new Date().toISOString(),
    };
    writeStateMap(map);
    syncCompletionMessageStatus(key, status, extra);
  }

  function syncCompletionMessageStatus(dealId, status, extra) {
    const store = global.TasuChatThreadStore;
    if (!store?.MESSAGES_KEY) return;
    const threadId = DEAL_THREAD_MAP[dealId] || "";
    if (!threadId) return;
    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(map?.[threadId]) ? map[threadId] : [];
      let changed = false;
      const next = list.map((m) => {
        if (m.kind !== "completion_report" || String(m.dealId) !== String(dealId)) return m;
        changed = true;
        return {
          ...m,
          completionReport: {
            ...(m.completionReport || {}),
            status,
            rejectReason: extra?.rejectReason || "",
          },
        };
      });
      if (changed) {
        map[threadId] = next;
        global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }
  }

  function appendCompletionReportMessage(dealId, detail) {
    const key = pickStr(dealId);
    if (!usesCompletionReportDealFlow(key)) {
      return { ok: false, reason: "product_purchase_flow" };
    }
    const spec = getConnectDealSpec(key);
    const store = global.TasuChatThreadStore;
    const threadId = pickStr(detail?.threadId, spec?.threadId);
    if (!spec || !store?.MESSAGES_KEY || !threadId) {
      return { ok: false, reason: "missing_context" };
    }

    const reporterName = pickStr(
      detail?.reporterName,
      detail?.userName,
      spec.sellerName,
      "出品者"
    );
    const report = {
      title: "完了報告",
      reporterName,
      submittedContent: pickStr(detail?.submittedContent, detail?.content, "作業完了報告"),
      attachments: pickStr(detail?.attachments, "—"),
      confirmMemo: pickStr(detail?.confirmMemo, ""),
      receivedAt: new Date().toLocaleString("ja-JP"),
      status: "pending",
    };

    const map = readStateMap();
    map[key] = {
      ...(map[key] || {}),
      status: "pending",
      report,
      updatedAt: new Date().toISOString(),
    };
    writeStateMap(map);

    try {
      const raw = global.localStorage.getItem(store.MESSAGES_KEY);
      const msgMap = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(msgMap[threadId]) ? msgMap[threadId] : [];
      const filtered = list.filter(
        (m) => !(m.kind === "completion_report" && String(m.dealId) === key)
      );
      filtered.push({
        id: `msg-platform-completion-${key}`,
        chatId: threadId,
        roomId: threadId,
        senderId: pickStr(detail?.reporterId, spec.sellerId),
        senderName: reporterName,
        text: "",
        kind: "completion_report",
        dealId: key,
        createdAt: new Date().toISOString(),
        completionReport: { ...report, status: "pending" },
      });
      filtered.push({
        id: `msg-platform-completion-intro-${key}`,
        chatId: threadId,
        roomId: threadId,
        senderId: pickStr(detail?.reporterId, spec.sellerId),
        senderName: reporterName,
        text: "作業が完了しました。完了報告をご確認ください。",
        kind: "text",
        createdAt: new Date().toISOString(),
      });
      msgMap[threadId] = filtered;
      global.localStorage.setItem(store.MESSAGES_KEY, JSON.stringify(msgMap));
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }

    return { ok: true, dealId: key, threadId, report };
  }

  function ensureDemoDealThread(dealId) {
    const key = pickStr(dealId);
    if (!usesCompletionReportDealFlow(key)) {
      const threadId = resolveDealThreadIdForPurge(key);
      if (threadId) purgeCompletionReportFromThread(threadId);
      return { ok: false, reason: "product_purchase_flow" };
    }
    const spec = getConnectDealSpec(key);
    const store = global.TasuChatThreadStore;
    if (!spec || !store?.readAll || !store?.STORAGE_KEY) {
      return { ok: false, reason: "no_spec_or_store" };
    }

    const deal = getDemoDeal(key);
    const report = getCompletionReport(key) || buildReportFromDemoDeal(key);
    if (!deal || !report) return { ok: false, reason: "no_demo_deal" };

    const threads = store.readAll();
    let thread = threads.find((t) => String(t.id) === spec.threadId);
    if (!thread) {
      thread = {
        id: spec.threadId,
        chatDomain: "work",
        threadKind: "listing_inquiry",
        listingId: spec.listingId,
        listingType: spec.listingType,
        listingTitle: spec.listingTitle,
        category: spec.category,
        image: "",
        detailUrl: buildNotifyChatUrl({ dealId: key, threadId: spec.threadId }),
        sellerId: spec.sellerId,
        sellerName: report.reporterName || spec.sellerName,
        partnerUserId: spec.sellerId,
        buyerId: global.TasuChatUserIdentity?.getEffectiveUserId?.() || "u_me",
        buyerName: global.TasuChatUserIdentity?.getEffectiveDisplayName?.() || "依頼者（デモ）",
        status: "open",
        source: "platform-completion-demo",
        lastMessage: "完了報告が届きました",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        updatedAt: new Date().toISOString(),
        dealId: key,
      };
      threads.unshift(thread);
      global.localStorage.setItem(store.STORAGE_KEY, JSON.stringify(threads));
    }

    const status = getCompletionStatus(key);
    if ((status === "pending" || deal?.hasCompletionReport) && report) {
      appendCompletionReportMessage(key, {
        threadId: spec.threadId,
        reporterName: report.reporterName,
        submittedContent: report.submittedContent,
        attachments: report.attachments,
      });
    }

    if (deal && !deal.chatHref?.includes(spec.threadId)) {
      deal.chatHref = buildNotifyChatUrl({ dealId: key, threadId: spec.threadId });
    }

    return { ok: true, threadId: spec.threadId, dealId: key };
  }

  function ensureDemoSkillDealThread() {
    return ensureDemoDealThread("skill_deal_demo_001");
  }

  function ensureAllConnectCompleteDemos() {
    return Object.keys(CONNECT_DEAL_SPECS)
      .filter((dealId) => usesCompletionReportDealFlow(dealId))
      .map((dealId) => ensureDemoDealThread(dealId));
  }

  function renderCompletionFeeActions(dealId) {
    const fee = getCompletionFeeState(dealId);
    if (fee.paid) {
      return `<p class="chat-completion-card__status chat-completion-card__status--paid">手数料支払い済み（¥${fee.amount.toLocaleString("ja-JP")}）</p>`;
    }
    if (!fee.pending || !fee.payUrl) return "";
    return (
      `<div class="chat-completion-card__fee" data-platform-completion-fee>` +
      `<p class="chat-completion-card__fee-label">取引完了手数料（5%・最低550円）</p>` +
      `<p class="chat-completion-card__fee-amount">¥${fee.amount.toLocaleString("ja-JP")}</p>` +
      `<a class="chat-completion-card__btn chat-completion-card__btn--fee" href="${esc(fee.payUrl)}" data-platform-completion-fee-pay>手数料を支払う</a>` +
      `</div>`
    );
  }

  function renderCompletionCardHtml(message) {
    const dealId = pickStr(message?.dealId, message?.completionReport?.dealId);
    if (!usesCompletionReportDealFlow(dealId)) return "";
    const report = message?.completionReport || getCompletionReport(dealId);
    if (!report) return "";
    const status = pickStr(report.status, getCompletionStatus(dealId)) || "pending";
    const title = pickStr(report.title, "完了報告");
    const content = pickStr(report.submittedContent, report.content);
    const attachments = pickStr(report.attachments);
    const confirmMemo = pickStr(report.confirmMemo);
    const time = esc(formatTime(message?.createdAt));

    let actions = "";
    if (status === "pending") {
      actions =
        `<div class="chat-completion-card__actions">` +
        `<button type="button" class="chat-completion-card__btn chat-completion-card__btn--approve" data-platform-completion-approve data-deal-id="${esc(dealId)}">承認する</button>` +
        `<button type="button" class="chat-completion-card__btn chat-completion-card__btn--reject" data-platform-completion-reject data-deal-id="${esc(dealId)}">差し戻す</button>` +
        `</div>`;
    } else if (status === "approved") {
      actions =
        `<p class="chat-completion-card__status chat-completion-card__status--approved">承認済み</p>` +
        renderCompletionFeeActions(dealId);
    } else if (status === "rejected") {
      const reason = pickStr(report.rejectReason);
      actions =
        `<p class="chat-completion-card__status chat-completion-card__status--rejected">差し戻し済み</p>` +
        (reason ? `<p class="chat-completion-card__reject-reason">理由：${esc(reason)}</p>` : "");
    }

    return (
      `<div class="chat-completion-card-wrap" data-platform-completion-card data-deal-id="${esc(dealId)}">` +
      `<article class="chat-completion-card" aria-label="完了報告">` +
      `<h3 class="chat-completion-card__title">${esc(title)}</h3>` +
      `<dl class="chat-completion-card__rows">` +
      `<div><dt>報告内容</dt><dd>${esc(content)}</dd></div>` +
      `<div><dt>添付ファイル</dt><dd>${esc(attachments)}</dd></div>` +
      (confirmMemo ? `<div><dt>確認メモ</dt><dd>${esc(confirmMemo)}</dd></div>` : "") +
      `</dl>` +
      actions +
      `</article>` +
      (time ? `<time class="chat-completion-card__time">${time}</time>` : "") +
      `</div>`
    );
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function queueCompletionFee(dealId) {
    const key = pickStr(dealId);
    const spec = getConnectDealSpec(key);
    const Fee = global.TasuPlatformChatFee;
    if (!key || !spec || !Fee?.ensurePendingCompletionFee) {
      return { ok: false, reason: "missing_context" };
    }
    const deal = getDemoDeal(key);
    const amountBase = extractAgreedAmount(deal, spec);
    const feeAmount = Fee.calcCompletionFee(amountBase);
    const row = Fee.ensurePendingCompletionFee({
      threadId: spec.threadId,
      dealId: key,
      listingId: spec.listingId,
      listingTitle: spec.listingTitle,
      category: spec.listingType,
      feeAmount,
      agreedAmount: amountBase,
    });
    const payUrl = Fee.buildCompletionFeePayUrl({
      threadId: spec.threadId,
      dealId: key,
      listingId: spec.listingId,
      category: spec.listingType,
      feeAmount,
    });
    return { ok: true, feeAmount, payUrl, row };
  }

  function approveCompletion(dealId) {
    const key = pickStr(dealId);
    if (!key || getCompletionStatus(key) !== "pending") {
      return { ok: false, reason: "not_pending" };
    }
    setCompletionStatus(key, "approved");
    const fee = queueCompletionFee(key);
    return { ok: true, status: "approved", fee };
  }

  function rejectCompletion(dealId, reason) {
    const key = pickStr(dealId);
    if (!key || getCompletionStatus(key) !== "pending") {
      return { ok: false, reason: "not_pending" };
    }
    const note = pickStr(reason) || "内容を修正してください。";
    setCompletionStatus(key, "rejected", { rejectReason: note });
    return { ok: true, status: "rejected" };
  }

  function bindCompletionCardActions(container, onChange) {
    if (!container || container.dataset.platformCompletionBound === "1") return;
    container.dataset.platformCompletionBound = "1";
    container.addEventListener("click", (ev) => {
      const approveBtn = ev.target.closest("[data-platform-completion-approve]");
      const rejectBtn = ev.target.closest("[data-platform-completion-reject]");
      if (approveBtn) {
        const id = pickStr(approveBtn.dataset.dealId);
        const res = approveCompletion(id);
        if (res.ok && typeof onChange === "function") onChange();
        return;
      }
      if (rejectBtn) {
        const id = pickStr(rejectBtn.dataset.dealId);
        const reason = global.prompt("差し戻し理由を入力してください", "") || "";
        if (!String(reason).trim()) return;
        const res = rejectCompletion(id, reason);
        if (res.ok && typeof onChange === "function") onChange();
      }
    });
  }

  function scrollToCompletionCard() {
    const el = global.document?.querySelector("[data-platform-completion-card]");
    if (!el) return;
    global.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  global.TasuPlatformChatCompletion = {
    STORAGE_KEY,
    DEMO_SKILL_DEAL_ID: "skill_deal_demo_001",
    DEMO_SKILL_THREAD_ID: "chat-demo-skill-deal-001",
    CONNECT_DEAL_SPECS,
    DEAL_THREAD_MAP,
    buildNotifyChatUrl,
    getConnectDealSpec,
    usesCompletionReportDealFlow,
    purgeCompletionReportFromThread,
    appendCompletionReportMessage,
    ensureDemoDealThread,
    ensureDemoSkillDealThread,
    ensureAllConnectCompleteDemos,
    getCompletionReport,
    getCompletionStatus,
    getCompletionFeeState,
    approveCompletion,
    rejectCompletion,
    renderCompletionCardHtml,
    bindCompletionCardActions,
    scrollToCompletionCard,
  };
})(typeof window !== "undefined" ? window : globalThis);
