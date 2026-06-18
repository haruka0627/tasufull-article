/**
 * 出品詳細 — 購入者 / 依頼者 / 問い合わせ一覧 #contacts
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
        params.get("view") === "contacts" ||
        params.get("view") === "applications" ||
        params.get("view") === "requests" ||
        params.get("benchManagement") === "1" ||
        global.location.hash === "#contacts" ||
        global.location.hash === "#applications" ||
        global.location.hash === "#requests"
      );
    } catch {
      return false;
    }
  }

  function resolveSellerIdFromListing(listing) {
    return pickStr(
      listing?.user_id,
      listing?.seller_user_id,
      listing?.author_user_id,
      listing?.owner_user_id
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

  function isBenchSellerManagementChrome() {
    return isBenchEmbed() && isManagementView();
  }

  /** benchManagement=1 — 出品者管理ビュー（出品者確認前でも適用） */
  function bootstrapSellerManagementChrome() {
    if (!isBenchSellerManagementChrome()) return;

    ensureBenchEmbedCss();
    const body = global.document.body;
    body.classList.add("listing-bench-seller-management");
    body.dataset.benchManagement = "1";

    const contactsNav = global.document.querySelector("[data-listing-contacts-nav]");
    const contactsSection = global.document.querySelector("[data-listing-contacts-section]");
    const shopBody = global.document.querySelector("[data-shop-restaurant-body]");
    if (shopBody) {
      shopBody.hidden = false;
      shopBody.removeAttribute("hidden");
    }
    if (contactsNav) contactsNav.hidden = false;
    if (contactsSection) {
      contactsSection.hidden = false;
      contactsSection.removeAttribute("hidden");
      const bottomWrap = contactsSection.closest(".detail-bottom-sections");
      if (bottomWrap && contactsSection.parentElement === bottomWrap) {
        bottomWrap.prepend(contactsSection);
      }
      const main = contactsSection.closest("main");
      if (main && bottomWrap && bottomWrap.parentElement === main) {
        main.prepend(bottomWrap);
      }
    }

    global.document.querySelectorAll(".section-nav__link").forEach((link) => {
      const isContacts =
        link === contactsNav ||
        link.getAttribute("href") === "#contacts" ||
        link.hasAttribute("data-listing-contacts-nav");
      if (isContacts) {
        link.hidden = false;
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      } else {
        link.hidden = true;
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      }
    });

    global.window.scrollTo(0, 0);
  }

  function applySellerManagementLayout() {
    bootstrapSellerManagementChrome();
  }

  function resolveListingId(listing) {
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
      global.__tasuListingDetail || { id: resolveListingId() }
    );
  }

  function resolveBenchSellerUserId(listing) {
    const seller = resolveSellerIdFromListing(listing);
    if (seller) return seller;
    const lid = resolveListingId(listing);
    const catalog = global.TasuListingContactRequestsStore?.resolveListing?.(lid);
    const fromCatalog = resolveSellerIdFromListing(catalog);
    if (fromCatalog) return fromCatalog;
    try {
      const params = new URLSearchParams(global.location.search);
      const profileId = pickStr(params.get("demoProfile"));
      const profile = global.TasuPlatformChatDualWindowDemo?.getProfile?.(
        profileId,
        params.get("demoConnect") === "1"
      );
      return pickStr(profile?.partnerAId);
    } catch {
      return "";
    }
  }

  function isEffectiveListingOwner(listing, store) {
    if (!store) return false;
    if (store.isListingOwner?.(listing)) return true;
    if (!isBenchSellerManagementChrome()) return false;
    try {
      const urlUser = pickStr(new URLSearchParams(global.location.search).get("userId"));
      const seller = resolveBenchSellerUserId(listing);
      return Boolean(urlUser && seller && urlUser === seller);
    } catch {
      return false;
    }
  }

  function resolveRequesterDisplayName(contact, store) {
    const rid = pickStr(contact?.requester_id);
    const stored = pickStr(contact?.requester_name);
    if (stored && (!rid || stored !== rid)) return stored;
    const resolved = pickStr(store?.getRequesterName?.(rid));
    return resolved || stored || rid || "—";
  }

  function panelMeta(category) {
    const cat = pickStr(category).toLowerCase().replace(/-/g, "_");
    const copy = global.TasuPlatformChatCategoryFlow?.getContactNotifyCopy?.(cat) || {};
    const buyer = pickStr(copy.buyerRole, "購入者");
    const listLabel = pickStr(copy.managementListLabel, "購入者一覧");
    const spec = global.TasuPlatformChatCategoryFlow?.getCategorySpec?.(
      global.TasuPlatformChatCategoryFlow?.threadStubFromKey?.(cat)
    );
    const contentLabel = pickStr(spec?.pendingContentLabel, `${buyer}内容`);
    return {
      title: listLabel,
      lead: `${buyer}の確認とやりとり開始ができます。550円のお支払い後にチャットが開きます。`,
      contentLabel,
      dateLabel: `${buyer}日時`,
    };
  }

  function statusLabel(status) {
    if (status === "active") return "やりとり開始済み";
    if (status === "awaiting_fee") return "支払い待ち";
    if (status === "rejected") return "見送り";
    return "新規";
  }

  function statusMod(status) {
    if (status === "active") return "open";
    if (status === "awaiting_fee") return "pending";
    if (status === "rejected") return "urgent";
    return "draft";
  }

  function formatContactDate(iso) {
    const d = new Date(iso || Date.now());
    if (!Number.isFinite(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function resolveContactContentText(listing, contact) {
    return pickStr(
      contact?.product_name,
      contact?.product_id,
      listing?.title,
      listing?.listing_title,
      "—"
    );
  }

  function ensureContactCardsCss() {
    if (global.document.getElementById("listing-contact-cards-css")) return;
    const link = global.document.createElement("link");
    link.id = "listing-contact-cards-css";
    link.rel = "stylesheet";
    link.href = "listing-contact-cards.css";
    global.document.head.appendChild(link);
  }

  function findContactThread(threadId) {
    const tid = pickStr(threadId);
    if (!tid) return null;
    return (global.TasuChatThreadStore?.readAll?.() || []).find((row) => String(row.id) === tid) || null;
  }

  function isConnectEntryAwaitingSeller(listing, contact) {
    if (!contact?.thread_id || contact.status !== "active") return false;
    const Category = global.TasuPlatformChatCategoryFlow;
    if (Category?.usesConnectEntryPayment?.(listing) !== true) return false;
    const thread = findContactThread(contact.thread_id);
    if (!thread) return false;
    const rs = pickStr(thread.roomStatus, thread.status).toLowerCase();
    return rs === "fee_pending" || pickStr(thread.platformStartPhase) === "awaiting_partner";
  }

  function chatDetailUrl(threadId, listing) {
    const thread = findContactThread(threadId);
    const Fee = global.TasuPlatformChatFee;
    const Category = global.TasuPlatformChatCategoryFlow;
    const connectEntry =
      Category?.isMarketplaceConnectEntryThread?.(thread) === true ||
      Category?.usesConnectEntryPayment?.(listing) === true;
    const base =
      Fee?.buildChatDetailUrl?.({
        threadId,
        thread,
        listing,
        from: "contacts",
        connectEntryPayment: connectEntry,
        category: Fee?.resolveCategoryKey?.(listing),
      }) ||
      global.TasuChatThreadStore?.chatDetailUrl?.(threadId, { from: "contacts" }) ||
      `chat-detail.html?thread=${encodeURIComponent(threadId)}&from=contacts`;
    return global.TasuChatUserIdentity?.appendUserIdToUrl?.(base) || base;
  }

  function renderContactCardHtml(listing, contact) {
    const st = contact.status || "applied";
    const Fee = global.TasuPlatformChatFee;
    const threadPaid =
      st === "active" && contact.thread_id && Fee?.isFeePaid?.(contact.thread_id);
    const connectAwaitingSeller = isConnectEntryAwaitingSeller(listing, contact);
    const awaitingFee = st === "awaiting_fee";
    const canProceed =
      (st !== "active" && st !== "rejected" && !awaitingFee) || connectAwaitingSeller;
    const meta = panelMeta(
      pickStr(listing?.listing_type, listing?.category, global.document?.body?.dataset?.detailType)
    );
    const chipMod = statusMod(st);

    const proceedBtn = canProceed
      ? `<button type="button" class="listing-contact-card__btn listing-contact-card__btn--primary" data-listing-contact-proceed data-contact-id="${esc(contact.contact_id)}">チャットに進む</button>`
      : "";
    const payResumeBtn =
      awaitingFee && !threadPaid
        ? `<a class="listing-contact-card__btn listing-contact-card__btn--primary" data-listing-contact-pay href="${esc(
            Fee?.buildFeePayUrl?.({
              contactId: contact.contact_id,
              listingId: resolveListingId(listing),
              category: Fee.resolveCategoryKey?.(listing),
              listing,
              from: readPageFromParam() || "notify",
            }) || "#"
          )}">支払いを完了する（550円）</a>`
        : "";
    const rejectBtn =
      st !== "rejected" && !threadPaid
        ? `<button type="button" class="listing-contact-card__btn listing-contact-card__btn--secondary" data-listing-contact-reject data-contact-id="${esc(contact.contact_id)}">断る</button>`
        : "";
    const chatBtn =
      threadPaid && contact.thread_id && !connectAwaitingSeller
        ? `<a class="listing-contact-card__btn listing-contact-card__btn--chat" href="${esc(chatDetailUrl(contact.thread_id, listing))}">チャットを開く</a>`
        : "";

    const memoBlock = contact.memo
      ? `<div class="listing-contact-card__field">` +
        `<dt>メモ</dt>` +
        `<dd>${esc(contact.memo)}</dd>` +
        `</div>`
      : "";

    return (
      `<li class="listing-contact-card job-app-card" data-listing-contact-card data-contact-id="${esc(contact.contact_id)}">` +
      `<div class="listing-contact-card__header">` +
      `<span class="listing-contact-card__avatar" aria-hidden="true">👤</span>` +
      `<p class="listing-contact-card__name">${esc(resolveRequesterDisplayName(contact, global.TasuListingContactRequestsStore))}</p>` +
      `</div>` +
      `<dl class="listing-contact-card__fields">` +
      `<div class="listing-contact-card__field">` +
      `<dt>${esc(meta.contentLabel)}</dt>` +
      `<dd>${esc(resolveContactContentText(listing, contact))}</dd>` +
      `</div>` +
      `<div class="listing-contact-card__field">` +
      `<dt>${esc(meta.dateLabel)}</dt>` +
      `<dd>${esc(formatContactDate(contact.created_at))}</dd>` +
      `</div>` +
      `<div class="listing-contact-card__field">` +
      `<dt>状態</dt>` +
      `<dd><span class="listing-contact-card__chip listing-contact-card__chip--${esc(chipMod)}">${esc(statusLabel(st))}</span></dd>` +
      `</div>` +
      memoBlock +
      `</dl>` +
      `<div class="listing-contact-card__actions">${proceedBtn}${payResumeBtn}${rejectBtn}${chatBtn}</div>` +
      `</li>`
    );
  }

  function renderContactCards(listing, contacts) {
    const host = global.document.querySelector("[data-listing-contacts-list]");
    const countEl = global.document.querySelector("[data-listing-contacts-count]");
    const leadEl = global.document.querySelector("[data-listing-contacts-lead]");
    const titleEl = global.document.querySelector("[data-listing-contacts-title]");
    const section = global.document.querySelector("[data-listing-contacts-section]");
    const store = global.TasuListingContactRequestsStore;
    if (!host || !section || !store) return;

    const benchMgmt = isBenchSellerManagementChrome();
    const owner = isEffectiveListingOwner(listing, store);
    const sellerId = resolveBenchSellerUserId(listing);
    const managementPending = benchMgmt && !owner && !sellerId;
    section.hidden = benchMgmt ? false : !owner && !managementPending;
    const nav = global.document.querySelector("[data-listing-contacts-nav]");
    if (nav) nav.hidden = !(owner || benchMgmt);
    if (!owner) {
      if (managementPending) {
        bootstrapSellerManagementChrome();
        ensureContactCardsCss();
        host.innerHTML =
          `<li class="listing-contact-card listing-contact-card--empty job-app-card job-app-card--empty">` +
          `<p class="listing-contact-card__name">読み込み中…</p>` +
          `<p class="listing-contact-card__field dd">一覧を準備しています。</p>` +
          `</li>`;
      } else if (!benchMgmt) {
        section.hidden = true;
      }
      return;
    }

    const meta = panelMeta(
      pickStr(listing?.listing_type, listing?.category, global.document?.body?.dataset?.detailType)
    );
    if (titleEl) titleEl.textContent = meta.title;
    if (leadEl) {
      leadEl.hidden = false;
      leadEl.textContent = meta.lead;
    }

    const rows = Array.isArray(contacts) ? contacts : store.listByListing(resolveListingId(listing));
    if (countEl) countEl.textContent = `${rows.length} 件`;

    ensureContactCardsCss();

    if (!rows.length) {
      host.innerHTML =
        `<li class="listing-contact-card listing-contact-card--empty job-app-card job-app-card--empty">` +
        `<p class="listing-contact-card__name">まだありません</p>` +
        `<p class="listing-contact-card__field dd">購入・問い合わせがあるとここに表示されます。</p>` +
        `</li>`;
      return;
    }

    host.innerHTML = rows.map((c) => renderContactCardHtml(listing, c)).join("");
    applySellerManagementLayout();
  }

  function syncRequesterStatusForViewer(listing) {
    const store = global.TasuListingContactRequestsStore;
    if (!store || store.isListingOwner(listing)) return;
    const listingId = resolveListingId(listing);
    const me = store.getRequesterId();
    const mine = store.listByListing(listingId).find((r) => String(r.requester_id) === String(me));
    const ctas = global.document.querySelectorAll(
      "[data-listing-primary-cta], [data-tasu-contact-cta], .skill-cta-panel__primary.cta-consult, .skill-cta-panel__secondary.cta-consult"
    );
    ctas.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (!mine) return;
      if (mine.status === "rejected") {
        btn.textContent = "見送り";
        btn.setAttribute("aria-disabled", "true");
      } else if (mine.status === "active" && mine.thread_id) {
        btn.textContent = "やりとり中";
        btn.setAttribute("aria-disabled", "true");
      } else {
        btn.textContent = "送信済み";
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("is-submitted");
      }
    });
  }

  function focusContactsIfRequested() {
    if (!isManagementView()) return;
    const section = global.document.querySelector("[data-listing-contacts-section]");
    if (!section || section.hidden) return;
    if (isBenchSellerManagementChrome()) {
      global.window.scrollTo(0, 0);
      return;
    }
    global.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.classList.add("is-view-focus");
      global.setTimeout(() => section.classList.remove("is-view-focus"), 2400);
    });
  }

  function wireActions() {
    const host = global.document.querySelector("[data-listing-contacts-list]");
    if (!host || host.dataset.listingContactsBound === "1") return;
    host.dataset.listingContactsBound = "1";

    host.addEventListener("click", (ev) => {
      const proceed = ev.target?.closest?.("[data-listing-contact-proceed]");
      const reject = ev.target?.closest?.("[data-listing-contact-reject]");
      if (!proceed && !reject) return;

      const store = global.TasuListingContactRequestsStore;
      const listing = getListing();
      if (!isEffectiveListingOwner(listing, store)) return;

      const contactId = (proceed || reject).getAttribute("data-contact-id");
      const listingId = resolveListingId(listing);
      if (!contactId || !listingId) return;

      if (proceed) {
        const result = store.beginContactChat(listingId, contactId);
        if (result?.payUrl) {
          let navigated =
            global.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate?.(result.payUrl) === true;
          if (!navigated && isBenchEmbed()) {
            try {
              global.parent.postMessage(
                { type: "tasu-bench-frame-navigate", slot: "a-chat", href: result.payUrl },
                "*"
              );
              navigated = true;
            } catch {
              navigated = false;
            }
          }
          if (!navigated) {
            global.location.href = result.payUrl;
          }
        }
      } else {
        store.rejectContact(listingId, contactId);
      }
      refresh(listing);
    });
  }

  function refresh(listing) {
    const row = listing || getListing();
    const store = global.TasuListingContactRequestsStore;
    if (!store) return;
    renderContactCards(row, store.listByListing(resolveListingId(row)));
    syncRequesterStatusForViewer(row);
    focusContactsIfRequested();
  }

  function bootContactsPanel() {
    if (!global.document.querySelector("[data-listing-contacts-section]")) return false;
    bootstrapSellerManagementChrome();
    ensureContactCardsCss();
    wireActions();
    refresh();
    return true;
  }

  function watchLateContactsMount() {
    if (bootContactsPanel()) return;
    const obs = new MutationObserver(() => {
      if (bootContactsPanel()) obs.disconnect();
    });
    obs.observe(global.document.body, { childList: true, subtree: true });
    const loadedObs = new MutationObserver(() => {
      if (global.document.body?.dataset?.listingLoaded === "true") bootContactsPanel();
    });
    loadedObs.observe(global.document.body, {
      attributes: true,
      attributeFilter: ["data-listing-loaded"],
    });
  }

  function init() {
    wireActions();
    watchLateContactsMount();
    global.addEventListener("tasu:listing-applied", (ev) => refresh(ev?.detail?.listing));
    global.addEventListener(
      global.TasuListingContactRequestsStore?.EVENT_NAME || "tasu:listing-contacts-changed",
      () => refresh()
    );
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuListingDetailContacts = {
    refresh,
    renderContactCards,
    focusContactsIfRequested,
    bootstrapSellerManagementChrome,
  };
})(typeof window !== "undefined" ? window : globalThis);
