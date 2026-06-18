/**
 * ワーカー詳細 — 依頼カード（ワーカー本人向け）#requests
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveWorkerId(listing) {
    if (listing) return String(listing.id || listing.listing_id || "").trim();
    return String(
      global.document?.body?.dataset?.listingId ||
        global.document?.body?.dataset?.targetId ||
        new URLSearchParams(global.location.search).get("id") ||
        ""
    ).trim();
  }

  function getListing() {
    return (
      global.__tasuDetailContactListing ||
      global.__tasuDetailFavoriteListing ||
      { id: resolveWorkerId() }
    );
  }

  function statusLabel(status) {
    if (status === "accepted") return "やりとり開始済み";
    if (status === "awaiting_fee") return "支払い待ち";
    if (status === "rejected") return "見送り";
    return "依頼中";
  }

  function statusMod(status) {
    if (status === "accepted") return "open";
    if (status === "awaiting_fee") return "pending";
    if (status === "rejected") return "urgent";
    return "draft";
  }

  function readPageFromParam() {
    try {
      return String(new URLSearchParams(global.location.search).get("from") || "").trim();
    } catch {
      return "";
    }
  }

  function isBenchEmbed() {
    return (
      global.document?.body?.dataset?.benchEmbed === "1" ||
      new URLSearchParams(global.location.search).get("benchEmbed") === "1"
    );
  }

  function isManagementView() {
    try {
      const params = new URLSearchParams(global.location.search);
      return (
        params.get("view") === "requests" ||
        params.get("benchManagement") === "1" ||
        global.location.hash === "#requests"
      );
    } catch {
      return false;
    }
  }

  function isBenchSellerManagementChrome() {
    return (
      isBenchEmbed() &&
      isManagementView() &&
      (global.document.body.classList.contains("listing-bench-seller-management") ||
        global.document.body.dataset.benchManagement === "1")
    );
  }

  function ensureBenchEmbedCss() {
    if (!isBenchEmbed() || global.document.getElementById("platform-chat-bench-embed-css")) return;
    const link = global.document.createElement("link");
    link.id = "platform-chat-bench-embed-css";
    link.rel = "stylesheet";
    link.href = "platform-chat-bench-embed.css";
    global.document.head.appendChild(link);
  }

  /** benchManagement / view=requests — 依頼者一覧のみ表示（skill/job の #contacts 相当） */
  function bootstrapWorkerBenchManagementChrome() {
    if (!isBenchEmbed() || !isManagementView()) return;

    ensureBenchEmbedCss();
    const body = global.document.body;
    body.classList.add("listing-bench-seller-management");
    body.dataset.benchManagement = "1";

    const section = global.document.querySelector("[data-worker-requests-section]");
    const nav = global.document.querySelector("[data-worker-requests-nav]");
    if (section) section.hidden = false;
    if (nav) nav.hidden = false;

    global.document.querySelectorAll(".section-nav__link").forEach((link) => {
      const isRequests =
        link === nav ||
        link.getAttribute("href") === "#requests" ||
        link.hasAttribute("data-worker-requests-nav");
      if (isRequests) {
        link.hidden = false;
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      } else {
        link.hidden = true;
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      }
    });

    const main =
      global.document.querySelector("main") ||
      global.document.querySelector(".skill-detail-wrap");
    if (main && section && section.parentElement === main) {
      main.prepend(section);
    }

    global.window.scrollTo(0, 0);
  }

  function renderRequestCards(listing, requests) {
    const host = global.document.querySelector("[data-worker-requests-list]");
    const countEl = global.document.querySelector("[data-worker-requests-count]");
    const leadEl = global.document.querySelector("[data-worker-requests-lead]");
    const section = global.document.querySelector("[data-worker-requests-section]");
    const store = global.TasuWorkerRequestsStore;
    if (!host || !section || !store) return;

    bootstrapWorkerBenchManagementChrome();

    const owner = store.isWorkerOwner(listing);
    section.hidden = !owner;
    const nav = global.document.querySelector("[data-worker-requests-nav]");
    if (nav) nav.hidden = !owner;
    if (!owner) return;

    const rows = Array.isArray(requests)
      ? requests
      : store.listByWorker(resolveWorkerId(listing));
    if (countEl) countEl.textContent = `${rows.length} 件`;
    if (leadEl) {
      leadEl.hidden = false;
      leadEl.textContent =
        "依頼者の確認とやりとり開始ができます。550円のお支払い後にチャットが開きます。";
    }

    if (!rows.length) {
      host.innerHTML =
        `<li class="job-app-card job-app-card--empty">` +
        `<p class="job-app-card__name">依頼なし</p>` +
        `<p class="job-app-card__meta">まだ依頼はありません。</p>` +
        `</li>`;
      return;
    }

    host.innerHTML = rows
      .map((r) => {
        const st = r.status || "requested";
        const Fee = global.TasuPlatformChatFee;
        const threadPaid = st === "accepted" && r.thread_id && Fee?.isFeePaid?.(r.thread_id);
        const awaitingFee = st === "awaiting_fee";
        const canProceed = st !== "accepted" && st !== "rejected" && !awaitingFee;
        const acceptBtn = canProceed
          ? `<button type="button" class="job-app-card__btn job-app-card__btn--hire" data-worker-req-accept data-request-id="${esc(r.request_id)}">チャットに進む</button>`
          : "";
        const payResumeBtn =
          awaitingFee && !threadPaid
            ? `<a class="job-app-card__btn job-app-card__btn--hire" data-worker-req-pay href="${esc(
                Fee?.buildFeePayUrl?.({
                  requestId: r.request_id,
                  listingId: resolveWorkerId(listing),
                  category: "worker",
                  listing,
                  from: readPageFromParam() || "notify",
                }) || "#"
              )}">支払いを完了する（550円）</a>`
            : "";
        const rejectBtn =
          st !== "rejected"
            ? `<button type="button" class="job-app-card__btn job-app-card__btn--reject" data-worker-req-reject data-request-id="${esc(r.request_id)}">断る</button>`
            : "";
        const chatBtn =
          threadPaid && r.thread_id
            ? `<a class="job-app-card__btn job-app-card__btn--chat" href="${esc(
                global.TasuChatThreadStore?.chatDetailUrl?.(r.thread_id) ||
                  `chat-detail.html?thread=${encodeURIComponent(r.thread_id)}`
              )}">チャットを開く</a>`
            : "";
        return (
          `<li class="job-app-card" data-worker-req-card data-request-id="${esc(r.request_id)}">` +
          `<div class="job-app-card__head">` +
          `<p class="job-app-card__name">${esc(r.requester_name || r.requester_id)}</p>` +
          `<span class="job-app-card__chip job-app-card__chip--${esc(statusMod(st))}">${esc(statusLabel(st))}</span>` +
          `</div>` +
          `<p class="job-app-card__meta">${esc(new Date(r.created_at || Date.now()).toLocaleString("ja-JP"))}</p>` +
          (r.memo ? `<p class="job-app-card__memo">${esc(r.memo)}</p>` : "") +
          `<div class="job-app-card__actions">${acceptBtn}${payResumeBtn}${rejectBtn}${chatBtn}</div>` +
          `</li>`
        );
      })
      .join("");
  }

  function refresh(listing) {
    const row = listing || getListing();
    const store = global.TasuWorkerRequestsStore;
    if (!store) return;
    const workerId = resolveWorkerId(row);
    if (store.isWorkerOwner(row)) store.seedDemoIfEmpty?.(workerId);
    renderRequestCards(row, store.listByWorker(workerId));
    syncRequesterStatusForViewer(row);
    focusRequestsIfRequested();
  }

  function syncRequesterStatusForViewer(listing) {
    const store = global.TasuWorkerRequestsStore;
    if (!store || store.isWorkerOwner(listing)) return;
    const workerId = resolveWorkerId(listing);
    const me = store.getRequesterId();
    const mine = store.listByWorker(workerId).find((r) => String(r.requester_id) === String(me));
    const requestBtns = global.document.querySelectorAll("[data-listing-primary-cta]");
    requestBtns.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (mine?.status === "requested") {
        btn.textContent = "依頼済み";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-requested");
      } else if (mine?.status === "accepted") {
        btn.textContent = "受諾済み";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-accepted");
      } else if (mine?.status === "rejected") {
        btn.textContent = "辞退";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-rejected");
      }
    });
  }

  function focusRequestsIfRequested() {
    if (global.location.hash !== "#requests") return;
    const section = global.document.querySelector("[data-worker-requests-section]");
    if (!section || section.hidden) return;
    global.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.classList.add("is-view-focus");
      global.setTimeout(() => section.classList.remove("is-view-focus"), 2400);
    });
  }

  function wireActions() {
    const host = global.document.querySelector("[data-worker-requests-list]");
    if (!host || host.dataset.workerReqsBound === "1") return;
    host.dataset.workerReqsBound = "1";

    host.addEventListener("click", (ev) => {
      const accept = ev.target?.closest?.("[data-worker-req-accept]");
      const reject = ev.target?.closest?.("[data-worker-req-reject]");
      if (!accept && !reject) return;
      const store = global.TasuWorkerRequestsStore;
      if (!store?.isWorkerOwner?.(getListing())) return;

      const requestId = (accept || reject).getAttribute("data-request-id");
      const workerId = resolveWorkerId();
      if (!requestId || !workerId) return;

      if (accept) {
        const result = store.beginWorkerChat?.(workerId, requestId);
        if (result?.payUrl && result.feePending) {
          global.location.href = result.payUrl;
        }
      } else {
        store.commitReject(workerId, requestId);
      }
      refresh();
    });
  }

  function init() {
    if (global.document?.body?.dataset?.detailType !== "worker") return;
    wireActions();
    bootstrapWorkerBenchManagementChrome();
    const boot = () => refresh();
    if (global.document.body?.dataset?.listingLoaded === "true") boot();
    global.addEventListener("tasu:listing-applied", (ev) => {
      refresh(ev?.detail?.listing);
    });
    global.addEventListener(
      global.TasuWorkerRequestsStore?.EVENT_NAME || "tasu:worker-requests-changed",
      () => refresh()
    );
    global.addEventListener("tasu:worker-request-submitted", () => refresh());
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuWorkerDetailRequests = {
    refresh,
    renderRequestCards,
    focusRequestsIfRequested,
    bootstrapWorkerBenchManagementChrome,
  };
})(typeof window !== "undefined" ? window : globalThis);
