/**
 * 求人詳細 — 応募者カード（掲載者向け）#applications
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

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function chatDetailUrlFromApplications(threadId) {
    const base =
      global.TasuChatThreadStore?.chatDetailUrl?.(threadId, { from: "applications" }) ||
      `chat-detail.html?thread=${encodeURIComponent(threadId)}&from=applications`;
    return global.TasuChatUserIdentity?.appendUserIdToUrl?.(base) || base;
  }

  function resolveJobId(listing) {
    if (listing) return String(listing.id || listing.listing_id || "").trim();
    return String(
      global.document?.body?.dataset?.listingId ||
        global.document?.body?.dataset?.targetId ||
        new URLSearchParams(global.location.search).get("id") ||
        ""
    ).trim();
  }

  function getListing() {
    const id = resolveJobId();
    let listing = null;
    if (global.__tasuDetailContactListing) listing = global.__tasuDetailContactListing;
    else if (global.__tasuListingDetail) listing = global.__tasuListingDetail;
    else if (global.__tasuDetailFavoriteListing) listing = global.__tasuDetailFavoriteListing;
    else {
      const local = global.TasuListingLocalStore?.fetchById?.(id);
      if (local) listing = global.TasuListingLocalStore?.toDetailListing?.(local) || local;
      else {
        const demo = global.TasuListingDemoCatalog?.STORE_BY_ID?.[id];
        if (demo) listing = demo;
        else {
          const storeRow = global.TasuListingStore?.fetchById?.(id);
          if (storeRow) listing = storeRow;
        }
      }
    }
    if (!listing) listing = { id, listing_id: id };
    const posterId = pickStr(listing.user_id, listing.userId, listing.seller_user_id);
    if (!posterId && global.TasuJobApplicationsStore?.resolveListing) {
      const resolved = global.TasuJobApplicationsStore.resolveListing(id);
      if (resolved) {
        listing = {
          ...resolved,
          ...listing,
          user_id: pickStr(listing.user_id, listing.userId, resolved.user_id, resolved.userId),
        };
      }
    }
    return listing;
  }

  function statusLabel(status) {
    if (status === "selected") return "やりとり開始済み";
    if (status === "awaiting_fee") return "支払い待ち";
    if (status === "rejected") return "見送り";
    return "応募中";
  }

  function hireResultStatusLabel(application, threadPaid) {
    if (threadPaid || application?.status === "selected") return "やりとり開始済み";
    return "やりとり開始待ち";
  }

  function hireResultStatusMod(application, threadPaid) {
    if (threadPaid || application?.status === "selected") return "open";
    return "draft";
  }

  function statusMod(status) {
    if (status === "selected") return "open";
    if (status === "awaiting_fee") return "pending";
    if (status === "rejected") return "urgent";
    return "draft";
  }

  function resolveJobTitle(listing, application) {
    const fromListing = pickStr(listing?.title, listing?.company_name);
    if (fromListing) return fromListing;
    const jobId = pickStr(application?.job_id, resolveJobId(listing));
    const resolved = global.TasuJobApplicationsStore?.resolveListing?.(jobId);
    return pickStr(resolved?.title, resolved?.company_name, jobId) || "求人";
  }

  function formatApplicationDate(iso) {
    const d = new Date(iso || Date.now());
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function renderJobTargetBlock(listing, application) {
    const title = resolveJobTitle(listing, application);
    return (
      `<div class="job-app-card__target">` +
      `<p class="job-app-card__target-label">応募先</p>` +
      `<p class="job-app-card__target-title" title="${esc(title)}">${esc(title)}</p>` +
      `</div>`
    );
  }

  const appsListState = {
    query: "",
    filter: "all",
    sort: "newest",
  };

  function normalizeSearchText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function resolveApplicationFilterBucket(listing, application) {
    const st = application?.status || "applied";
    if (st === "rejected") return "rejected";
    if (st === "selected") return "started";
    const Fee = global.TasuPlatformChatFee;
    const threadStore = global.TasuChatThreadStore;
    const hireThread = threadStore?.findHireThread?.(resolveJobId(listing), application?.application_id);
    const activeThreadId = pickStr(application?.thread_id, hireThread?.id);
    if (activeThreadId && Fee?.isFeePaid?.(activeThreadId)) return "started";
    return "applied";
  }

  function applicationSearchHaystack(listing, application) {
    return normalizeSearchText(
      [
        application?.applicant_name,
        application?.applicant_id,
        application?.memo,
        resolveJobTitle(listing, application),
      ].join(" ")
    );
  }

  function sortApplications(rows, sortKey) {
    const list = [...rows];
    if (sortKey === "name") {
      list.sort((a, b) =>
        pickStr(a.applicant_name, a.applicant_id).localeCompare(
          pickStr(b.applicant_name, b.applicant_id),
          "ja"
        )
      );
      return list;
    }
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (sortKey === "newest") list.reverse();
    return list;
  }

  function filterApplications(listing, rows) {
    const query = normalizeSearchText(appsListState.query);
    const filter = appsListState.filter || "all";
    return rows.filter((application) => {
      if (filter !== "all" && resolveApplicationFilterBucket(listing, application) !== filter) {
        return false;
      }
      if (!query) return true;
      return applicationSearchHaystack(listing, application).includes(query);
    });
  }

  function syncApplicationsToolbarVisibility(poster) {
    const toolbar = global.document.querySelector("[data-job-applications-toolbar]");
    if (!toolbar) return;
    toolbar.hidden = !poster || isHireResultView();
  }

  function syncApplicationsToolbarControls() {
    const searchEl = global.document.querySelector("[data-job-applications-search]");
    if (searchEl && searchEl.value !== appsListState.query) {
      searchEl.value = appsListState.query;
    }
    global.document.querySelectorAll("[data-job-applications-filter]").forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const active = btn.getAttribute("data-job-applications-filter") === appsListState.filter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    const sortEl = global.document.querySelector("[data-job-applications-sort]");
    if (sortEl && sortEl.value !== appsListState.sort) {
      sortEl.value = appsListState.sort;
    }
  }

  function readPageFromParam() {
    try {
      return String(new URLSearchParams(global.location.search).get("from") || "").trim();
    } catch {
      return "";
    }
  }

  function renderApplicationCardHtml(listing, application) {
    const st = application.status || "applied";
    const Fee = global.TasuPlatformChatFee;
    const activeThreadId = pickStr(application.thread_id);
    const threadPaid = activeThreadId && Fee?.isFeePaid?.(activeThreadId);
    const awaitingFee = st === "awaiting_fee";
    const canProceed = st !== "selected" && st !== "rejected" && !awaitingFee;
    const proceedBtn = canProceed
      ? `<button type="button" class="job-app-card__btn job-app-card__btn--hire" data-job-app-proceed data-application-id="${esc(application.application_id)}">チャットに進む</button>`
      : "";
    const payResumeBtn =
      awaitingFee && !threadPaid
        ? `<a class="job-app-card__btn job-app-card__btn--hire" data-job-app-pay href="${esc(
            Fee?.buildFeePayUrl?.({
              listingId: resolveJobId(listing),
              category: "job",
              listing,
              applicationId: application.application_id,
              from: readPageFromParam() || "notify",
            }) || "#"
          )}">支払いを完了する（550円）</a>`
        : "";
    const rejectBtn =
      st !== "rejected"
        ? `<button type="button" class="job-app-card__btn job-app-card__btn--reject" data-job-app-reject data-application-id="${esc(application.application_id)}">断る</button>`
        : "";
    const chatBtn =
      st === "selected" && application.thread_id && threadPaid
        ? `<a class="job-app-card__btn job-app-card__btn--chat" href="${esc(
            chatDetailUrlFromApplications(application.thread_id)
          )}">チャットを開く</a>`
        : "";
    return (
      `<li class="job-app-card" data-job-app-card data-application-id="${esc(application.application_id)}">` +
      `<div class="job-app-card__head">` +
      `<p class="job-app-card__name">${esc(application.applicant_name || application.applicant_id)}</p>` +
      `<span class="job-app-card__chip job-app-card__chip--${esc(statusMod(st))}">${esc(statusLabel(st))}</span>` +
      `</div>` +
      renderJobTargetBlock(listing, application) +
      `<p class="job-app-card__meta">${esc(formatApplicationDate(application.created_at))}</p>` +
      (application.memo ? `<p class="job-app-card__memo">${esc(application.memo)}</p>` : "") +
      `<div class="job-app-card__actions">${proceedBtn}${payResumeBtn}${rejectBtn}${chatBtn}</div>` +
      `</li>`
    );
  }

  function renderApplicantCards(listing, applications) {
    const host = global.document.querySelector("[data-job-applications-list]");
    const countEl = global.document.querySelector("[data-job-applications-count]");
    const leadEl = global.document.querySelector("[data-job-applications-lead]");
    const section = global.document.querySelector("[data-job-applications-section]");
    const store = global.TasuJobApplicationsStore;
    if (!host || !section || !store) return;

    const poster = store.isJobPoster(listing);
    section.hidden = !poster;
    syncApplicationsToolbarVisibility(poster);
    const nav = global.document.querySelector("[data-job-applications-nav]");
    if (nav) nav.hidden = !poster;
    if (!poster) return;

    applyApplicationsViewChrome(listing);
    syncApplicationsToolbarControls();

    const rows = Array.isArray(applications) ? applications : store.listByJob(resolveJobId(listing));
    if (countEl) countEl.textContent = `${rows.length} 件`;
    if (leadEl) {
      leadEl.hidden = false;
      leadEl.textContent =
        "応募者とやりとりを始めるには、利用料550円のお支払い後にチャットが開きます。";
    }

    if (!rows.length) {
      host.innerHTML =
        `<li class="job-app-card job-app-card--empty">` +
        `<p class="job-app-card__name">応募者なし</p>` +
        `<p class="job-app-card__meta">まだ応募はありません。</p>` +
        `</li>`;
      return;
    }

    const visibleRows = sortApplications(
      filterApplications(listing, rows),
      appsListState.sort
    );

    if (!visibleRows.length) {
      host.innerHTML =
        `<li class="job-app-card job-app-card--empty">` +
        `<p class="job-app-card__name">該当する応募者なし</p>` +
        `<p class="job-app-card__meta">検索条件やフィルターを変更してください。</p>` +
        `</li>`;
      return;
    }

    host.innerHTML = visibleRows.map((application) => renderApplicationCardHtml(listing, application)).join("");
  }

  function refresh(listing) {
    const row = listing || getListing();
    const store = global.TasuJobApplicationsStore;
    if (!store) return;
    store.seedDemoIfEmpty?.();
    if (isHireResultView() && !store.isJobPoster(row)) {
      renderApplicantHireResult(row);
    } else {
      renderApplicantCards(row, store.listByJob(resolveJobId(row)));
    }
    syncApplicantStatusForViewer(row);
    focusApplicationsIfRequested();
  }

  function renderApplicantHireResult(listing) {
    const host = global.document.querySelector("[data-job-applications-list]");
    const countEl = global.document.querySelector("[data-job-applications-count]");
    const leadEl = global.document.querySelector("[data-job-applications-lead]");
    const section = global.document.querySelector("[data-job-applications-section]");
    const store = global.TasuJobApplicationsStore;
    if (!host || !section || !store) return;

    applyHireResultViewChrome(listing);

    const jobId = resolveJobId(listing);
    const params = getSearchParams();
    const applicationId = pickStr(params.get("applicationId"));
    const me = store.getApplicantId();
    const rows = store.listByJob(jobId);
    const mine =
      rows.find((a) => applicationId && String(a.application_id) === applicationId) ||
      rows.find((a) => String(a.applicant_id) === String(me));

    section.hidden = false;
    const nav = global.document.querySelector("[data-job-applications-nav]");
    if (nav) nav.hidden = true;

    if (countEl) countEl.textContent = mine ? "1 件" : "0 件";
    if (leadEl) {
      leadEl.hidden = false;
      leadEl.textContent = "やりとりを開始できます。";
    }

    if (!mine) {
      host.innerHTML =
        `<li class="job-app-card job-app-card--empty">` +
        `<p class="job-app-card__name">やりとり情報がありません</p>` +
        `<p class="job-app-card__meta">応募状況をご確認ください。</p>` +
        `</li>`;
      return;
    }

    const Fee = global.TasuPlatformChatFee;
    const threadStore = global.TasuChatThreadStore;
    const hireThread = threadStore?.findHireThread?.(jobId, mine.application_id);
    const activeThreadId = pickStr(mine.thread_id, hireThread?.id);
    const threadPaid = activeThreadId && Fee?.isFeePaid?.(activeThreadId);
    const chatUrl =
      activeThreadId && threadPaid ? chatDetailUrlFromApplications(activeThreadId) : "";
    const startBtn = chatUrl
      ? `<a class="job-app-card__btn job-app-card__btn--hire" data-job-app-chat href="${esc(chatUrl)}">やりとりを開始</a>`
      : `<p class="job-app-card__memo">掲載者がやりとりを開始するまでお待ちください。550円のお支払い完了後に双方のチャットが開きます。</p>`;

    host.innerHTML =
      `<li class="job-app-card" data-job-app-card data-application-id="${esc(mine.application_id)}">` +
      `<div class="job-app-card__head">` +
      `<p class="job-app-card__name">${esc(mine.applicant_name || store.getApplicantName?.(mine.applicant_id) || "応募者")}</p>` +
      `<span class="job-app-card__chip job-app-card__chip--${esc(hireResultStatusMod(mine, threadPaid))}">${esc(hireResultStatusLabel(mine, threadPaid))}</span>` +
      `</div>` +
      renderJobTargetBlock(listing, mine) +
      `<p class="job-app-card__meta">${esc(formatApplicationDate(mine.created_at))}</p>` +
      (mine.memo ? `<p class="job-app-card__memo">${esc(mine.memo)}</p>` : "") +
      `<div class="job-app-card__actions">${startBtn}</div>` +
      `</li>`;
  }

  function renderApplySuccessBannerHtml() {
    return (
      `<div class="job-apply-success" data-job-apply-success-mobile role="status" aria-live="polite">` +
      `<p class="job-apply-success__title">応募が完了しました。</p>` +
      `<p class="job-apply-success__text">掲載者からの連絡をお待ちください。</p>` +
      `</div>`
    );
  }

  function syncApplicantApplySuccessBanner(listing) {
    const store = global.TasuJobApplicationsStore;
    if (!store || store.isJobPoster(listing)) return;
    const jobId = resolveJobId(listing);
    const me = store.getApplicantId();
    const mine = store.listByJob(jobId).find((a) => String(a.applicant_id) === String(me));
    const showSuccess =
      mine?.status === "applied" && !isApplicationsFocusChrome() && !isHireResultView();

    const pcBanner = global.document.querySelector("[data-job-apply-success]");
    if (pcBanner) pcBanner.hidden = !showSuccess;

    const mobileHost = global.document.querySelector(".tasu-mdetail-hero--job .tasu-mdetail-hero__content");
    if (!mobileHost) return;

    let mobileBanner = global.document.querySelector("[data-job-apply-success-mobile]");
    if (showSuccess && !mobileBanner) {
      const ctaActions = mobileHost.querySelector(".tasu-mdetail-hero__cta-actions");
      const html = renderApplySuccessBannerHtml();
      if (ctaActions) ctaActions.insertAdjacentHTML("beforebegin", html);
      else mobileHost.insertAdjacentHTML("beforeend", html);
      mobileBanner = global.document.querySelector("[data-job-apply-success-mobile]");
    }
    if (mobileBanner) mobileBanner.hidden = !showSuccess;
  }

  function syncApplicantStatusForViewer(listing) {
    const store = global.TasuJobApplicationsStore;
    if (!store || store.isJobPoster(listing)) return;
    syncApplicantApplySuccessBanner(listing);
    const jobId = resolveJobId(listing);
    const me = store.getApplicantId();
    const mine = store.listByJob(jobId).find((a) => String(a.applicant_id) === String(me));
    const applyBtns = global.document.querySelectorAll(
      "[data-listing-primary-cta], [data-job-dock-apply]"
    );
    applyBtns.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (mine?.status === "applied") {
        btn.textContent = "応募済み";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-applied");
      } else if (mine?.status === "selected") {
        btn.textContent = "やりとり開始済み";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-selected");
      } else if (mine?.status === "rejected") {
        btn.textContent = "見送り";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-rejected");
      }
    });
  }

  let applicationsFocusToken = 0;

  function getSearchParams() {
    return new URLSearchParams(global.location.search);
  }

  function isJobFullReviewMode() {
    return getSearchParams().get("review") === "job-full";
  }

  function redirectLegacyHireResultView() {
    const params = getSearchParams();
    if (params.get("view") !== "hire-result") return;
    params.set("view", "applications");
    const hash = global.location.hash || "#applications";
    global.location.replace(`${global.location.pathname}?${params.toString()}${hash}`);
  }

  redirectLegacyHireResultView();

  function isApplicationsView() {
    const view = getSearchParams().get("view");
    if (view === "applications") return true;
    return global.location.hash === "#applications";
  }

  function isHireResultView() {
    return false;
  }

  /** view=applications — 通知経由の応募者確認モード（通常詳細は対象外） */
  function isApplicationsFocusChrome() {
    if (isJobFullReviewMode()) {
      const view = getSearchParams().get("view");
      return view === "applications" || global.location.hash === "#applications";
    }
    const view = getSearchParams().get("view");
    return view === "applications";
  }

  function isJobNotifyFocusView() {
    return isApplicationsFocusChrome();
  }

  function applicationsViewTitle() {
    if (isHireResultView()) {
      return getSearchParams().get("from") === "talk" ? "やりとり開始" : "応募状況";
    }
    return getSearchParams().get("from") === "talk" ? "応募者確認" : "応募状況";
  }

  function revealPcApplicationsOnMobile() {
    if (!isJobNotifyFocusView()) return;
    const wrap = global.document.querySelector(".job-detail-wrap");
    if (wrap) {
      wrap.removeAttribute("data-tasu-mdetail-pc-hidden");
      wrap.removeAttribute("aria-hidden");
      wrap.hidden = false;
      wrap.style.removeProperty("display");
      wrap.style.removeProperty("visibility");
    }
    const main = global.document.querySelector(".job-detail-main");
    if (main) {
      main.removeAttribute("data-tasu-mdetail-pc-hidden");
      main.removeAttribute("aria-hidden");
      main.hidden = false;
    }
    const mobileShell = global.document.querySelector("[data-tasu-mobile-detail-shell]");
    if (mobileShell) {
      mobileShell.hidden = true;
      mobileShell.setAttribute("aria-hidden", "true");
    }
  }

  function applyApplicationsScrollLock() {
    const on = isJobNotifyFocusView();
    global.document.documentElement.classList.toggle("job-applications-scroll-lock", on);
    global.document.body.classList.toggle("job-applications-scroll-lock", on);
  }

  function applyHireResultViewChrome(listing) {
    applyApplicationsScrollLock();
    if (!isHireResultView()) {
      if (!isApplicationsView()) delete global.document.body.dataset.jobPdView;
      return;
    }
    global.document.body.dataset.jobPdView = "hire-result";
    revealPcApplicationsOnMobile();
    const title = applicationsViewTitle();
    const titleEl = global.document.getElementById("jobApplicationsTitle");
    if (titleEl) titleEl.textContent = title;
    global.document.title = `${title} | TasuFull`;
    const mobileTitle = global.document.querySelector(".tasu-mobile-page-head__title");
    if (mobileTitle) mobileTitle.textContent = title;
    global.TasufulAppMobile?.refreshMobileShellTitle?.();
    const dock = global.document.querySelector(".job-bottom-dock");
    if (dock) dock.hidden = true;
  }

  function applyApplicationsViewChrome(listing) {
    applyApplicationsScrollLock();
    if (!isApplicationsView()) {
      applyHireResultViewChrome(listing);
      return;
    }
    if (isApplicationsFocusChrome()) {
      global.document.body.dataset.jobPdView = isHireResultView() ? "hire-result" : "applications";
      revealPcApplicationsOnMobile();
    } else {
      delete global.document.body.dataset.jobPdView;
    }
    const title = applicationsViewTitle();
    const titleEl = global.document.getElementById("jobApplicationsTitle");
    if (titleEl) titleEl.textContent = title;
    global.document.title = `${title} | TasuFull`;
    const mobileTitle = global.document.querySelector(".tasu-mobile-page-head__title");
    if (mobileTitle) mobileTitle.textContent = title;
    global.TasufulAppMobile?.refreshMobileShellTitle?.();
    const dock = global.document.querySelector(".job-bottom-dock");
    if (dock && global.TasuJobApplicationsStore?.isJobPoster?.(listing)) {
      dock.hidden = true;
    }
  }

  function measureApplicationsScrollOffset() {
    const shellHead = global.document.querySelector("[data-tasu-mobile-shell-head]");
    if (shellHead) return Math.ceil(shellHead.getBoundingClientRect().height) + 10;
    const subheader = global.document.querySelector(".page-subheader");
    if (subheader) return Math.ceil(subheader.getBoundingClientRect().height) + 12;
    return 12;
  }

  function resetApplicationsListScroll() {
    if (!isJobNotifyFocusView()) return false;
    const section = global.document.querySelector("[data-job-applications-section]");
    if (!section || section.hidden) return false;

    const offset = measureApplicationsScrollOffset();
    global.document.documentElement.style.setProperty(
      "--tasu-job-applications-focus-offset",
      `${offset}px`
    );

    const roots = [
      global.document.querySelector("[data-job-applications-list]"),
      global.document.scrollingElement,
      global.document.documentElement,
      global.document.body,
      global.document.querySelector(".job-detail-main"),
      global.document.querySelector("[data-tasu-mobile-detail-shell]"),
    ].filter(Boolean);
    roots.forEach((el) => {
      if (el && typeof el.scrollTop === "number") el.scrollTop = 0;
    });
    global.scrollTo({ top: 0, left: 0, behavior: "auto" });

    section.classList.remove("is-view-focus");
    void section.offsetWidth;
    section.classList.add("is-view-focus");
    global.clearTimeout(section._jobAppsFocusTimer);
    section._jobAppsFocusTimer = global.setTimeout(() => {
      section.classList.remove("is-view-focus");
    }, 3200);

    return true;
  }

  function scheduleApplicationsFocus() {
    if (!isJobNotifyFocusView()) return;
    const token = ++applicationsFocusToken;
    [0, 120, 400].forEach((delay) => {
      global.setTimeout(() => {
        if (token !== applicationsFocusToken) return;
        applyApplicationsViewChrome(getListing());
        resetApplicationsListScroll();
      }, delay);
    });
  }

  function focusApplicationsIfRequested() {
    applyHireResultViewChrome(getListing());
    applyApplicationsViewChrome(getListing());
    if (!isJobNotifyFocusView()) return;
    scheduleApplicationsFocus();
  }

  function wireMobileShellFocus() {
    if (global.document.body.dataset.jobAppsMobileFocusWired === "1") return;
    global.document.body.dataset.jobAppsMobileFocusWired = "1";
    global.addEventListener("tasu:mobile-shell-ready", () => {
      if (global.document?.body?.dataset?.detailType !== "job") return;
      syncApplicantApplySuccessBanner(getListing());
      focusApplicationsIfRequested();
    });
    global.addEventListener("load", () => {
      if (isApplicationsView()) scheduleApplicationsFocus();
    });
  }

  function wireApplicationsToolbar() {
    const toolbar = global.document.querySelector("[data-job-applications-toolbar]");
    if (!toolbar || toolbar.dataset.jobAppsToolbarBound === "1") return;
    toolbar.dataset.jobAppsToolbarBound = "1";

    const searchEl = toolbar.querySelector("[data-job-applications-search]");
    const sortEl = toolbar.querySelector("[data-job-applications-sort]");
    let searchTimer = 0;

    const rerender = () => {
      renderApplicantCards(getListing());
    };

    searchEl?.addEventListener("input", () => {
      appsListState.query = String(searchEl.value || "");
      global.clearTimeout(searchTimer);
      searchTimer = global.setTimeout(rerender, 120);
    });

    sortEl?.addEventListener("change", () => {
      appsListState.sort = String(sortEl.value || "newest");
      rerender();
    });

    toolbar.querySelectorAll("[data-job-applications-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-job-applications-filter") || "all";
        appsListState.filter = next;
        syncApplicationsToolbarControls();
        rerender();
      });
    });
  }

  function wireActions() {
    const host = global.document.querySelector("[data-job-applications-list]");
    if (!host || host.dataset.jobAppsBound === "1") return;
    host.dataset.jobAppsBound = "1";

    host.addEventListener("click", (ev) => {
      const proceed = ev.target?.closest?.("[data-job-app-proceed]");
      const reject = ev.target?.closest?.("[data-job-app-reject]");
      if (!proceed && !reject) return;
      const store = global.TasuJobApplicationsStore;
      if (!store?.isJobPoster?.(getListing())) return;

      const applicationId = (proceed || reject).getAttribute("data-application-id");
      const jobId = resolveJobId();
      if (!applicationId || !jobId) return;

      if (proceed) {
        const btn = proceed;
        const prevLabel = btn.textContent;
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.textContent = "処理中…";
        const result = store.beginJobChat?.(jobId, applicationId);
        if (!result?.ok) {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.textContent = prevLabel || "チャットに進む";
          return;
        }
        if (result.feePending && result.payUrl) {
          try {
            global.TasuPlatformChatBenchEmbed?.postBenchFrameNavigateMessage?.(result.payUrl, {
              slot: "a-chat",
            });
          } catch {
            /* ignore */
          }
          global.location.href = result.payUrl;
          return;
        }
        if (result.payUrl && !result.feePending) {
          global.location.href = result.payUrl;
          return;
        }
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = prevLabel || "チャットに進む";
      } else {
        store.commitReject(jobId, applicationId);
      }
      refresh();
    });
  }

  function init() {
    if (global.document?.body?.dataset?.detailType !== "job") return;
    if (global.history?.scrollRestoration) {
      global.history.scrollRestoration = "manual";
    }
    wireApplicationsToolbar();
    wireActions();
    wireMobileShellFocus();
    if (isApplicationsView()) {
      global.document.body.dataset.jobPdView = "applications";
    } else if (isHireResultView()) {
      global.document.body.dataset.jobPdView = "hire-result";
    }
    applyApplicationsScrollLock();
    refresh();
    global.addEventListener(global.TasuJobApplicationsStore?.EVENT_NAME || "tasu:job-applications-changed", () =>
      refresh()
    );
    global.addEventListener("tasu:listing-applied", (ev) => {
      if (ev?.detail?.listing) refresh(ev.detail.listing);
    });
    if (global.document?.body?.dataset?.listingLoaded === "true") {
      global.setTimeout(() => refresh(), 0);
    }
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuJobDetailApplications = {
    refresh,
    renderApplicantCards,
    focusApplicationsIfRequested,
    applyApplicationsScrollLock,
    isApplicationsView,
    isJobNotifyFocusView,
    scheduleApplicationsFocus,
    syncApplicantApplySuccessBanner,
    getListState: () => ({ ...appsListState }),
    setListState: (next) => {
      if (next && typeof next === "object") {
        if (typeof next.query === "string") appsListState.query = next.query;
        if (typeof next.filter === "string") appsListState.filter = next.filter;
        if (typeof next.sort === "string") appsListState.sort = next.sort;
      }
      refresh();
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
