/**
 * 会員ダッシュボード — スマホ LINE風ホーム
 */
(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isFieldServiceRow(row) {
    const cats = window.TasuBusinessCategories;
    if (cats?.isFieldServiceListing?.(row)) return true;
    const bt = String(row?.business_type || row?.businessType || "").trim();
    return bt === "field_service";
  }

  function pickRecommendations() {
    const listings = window.TasuBusinessBoardDemo?.getListings?.() || [];
    const jobs = listings.filter((l) => l.businessCategory === "job" || l.category === "job").slice(0, 2);
    const services = listings.filter((l) => isFieldServiceRow(l)).slice(0, 2);
    const projects = listings
      .filter((l) => l.businessCategory === "builder" || l._channel === "builder")
      .slice(0, 2);
    const fallback = listings.slice(0, 2);
    return {
      projects: projects.length ? projects : fallback,
      jobs: jobs.length ? jobs : fallback,
      services: services.length ? services : fallback,
    };
  }

  function listingHref(row) {
    const R = window.TasuListingRouteResolver;
    if (row.detailUrl) {
      const normalized = R?.normalizeDetailHref?.(row.detailUrl) || row.detailUrl;
      if (/[?&]id=/.test(String(normalized))) return normalized;
    }
    if (R?.buildDetailUrlFromRecord) return R.buildDetailUrlFromRecord(row);
    if (row.businessCategory === "job") return R?.buildDetailUrl?.("job", row.id) || "#";
    return R?.buildDetailUrl?.("business_service", row.id) || "#";
  }

  function listingRowHtml(row) {
    const title = row.title || row.name || "掲載";
    const meta = row.area || row.location || row.categoryLabel || "";
    const img = row.image || row.main_image || row.thumbnail || "https://placehold.co/96x96/f1f5f9/94a3b8?text=T";
    return `
      <a class="tasu-mobile-home__row" href="${esc(listingHref(row))}">
        <img class="tasu-mobile-home__row-thumb" src="${esc(img)}" alt="" width="48" height="48" loading="lazy">
        <div class="tasu-mobile-home__row-main">
          <p class="tasu-mobile-home__row-title">${esc(title)}</p>
          <p class="tasu-mobile-home__row-meta">${esc(meta)}</p>
        </div>
        <span class="tasu-mobile-home__row-chevron" aria-hidden="true">›</span>
      </a>`;
  }

  function chatRowHtml(thread) {
    const name =
      thread.partnerProfile?.display_name ||
      thread.partner?.displayName ||
      thread.title ||
      "チャット";
    const preview = thread.lastMessagePreview || thread.last_message_preview || "";
    const href = thread.id
      ? `talk-home.html?tab=chat&thread=${encodeURIComponent(thread.id)}`
      : "talk-home.html?tab=chat";
    const avatar =
      thread.partnerProfile?.profile_image ||
      thread.partnerProfile?.avatar_url ||
      thread.partner?.avatarUrl ||
      "https://placehold.co/96x96/f3ead4/967622?text=%3F";
    return `
      <a class="tasu-mobile-home__row" href="${esc(href)}">
        <img class="tasu-mobile-home__row-thumb" src="${esc(avatar)}" alt="" width="48" height="48" loading="lazy">
        <div class="tasu-mobile-home__row-main">
          <p class="tasu-mobile-home__row-title">${esc(name)}</p>
          <p class="tasu-mobile-home__row-meta">${esc(preview)}</p>
        </div>
        <span class="tasu-mobile-home__row-chevron" aria-hidden="true">›</span>
      </a>`;
  }

  function txRowHtml(row) {
    return `
      <a class="tasu-mobile-home__row" href="${esc(row.href || "demo-progress.html")}">
        <img class="tasu-mobile-home__row-thumb" src="${esc(row.image)}" alt="" width="48" height="48" loading="lazy">
        <div class="tasu-mobile-home__row-main">
          <p class="tasu-mobile-home__row-title">${esc(row.title)}</p>
          <p class="tasu-mobile-home__row-meta">${esc(row.statusLabel || "")} · ${esc(row.partnerName || "")}</p>
        </div>
        <span class="tasu-mobile-home__row-chevron" aria-hidden="true">›</span>
      </a>`;
  }

  const MOBILE_QUICK_SHEETS = {
    explore: {
      title: "探す",
      description: "サービス・求人・市場",
      items: [
        { label: "業務サービス", hint: "法人・業者向けサービス", href: "business.html", icon: "💼" },
        { label: "スキル", hint: "個人のスキル・専門サービス", href: "index.html?category=skill", icon: "✨" },
        { label: "ワーカー", hint: "作業・現場対応のワーカー", href: "index.html?category=worker", icon: "👷" },
        { label: "商品", hint: "フリマ型の商品掲載", href: "index.html?category=product", icon: "🛒" },
        { label: "TASFUL市場", hint: "商品の出品・購入", href: "shop-store.html", icon: "🏪" },
        { label: "店舗・専門店", hint: "実店舗・専門店の販売", href: "shop-vendors.html", icon: "🏬" },
        { label: "求人", hint: "求人募集を探す", href: "job-top.html", icon: "💼" },
        { label: "案件・求人ボード", hint: "案件と求人の統合ボード", href: "public-board.html", icon: "📋" },
      ],
    },
    publish: {
      title: "掲載する",
      description: "サービス掲載・出品管理",
      items: [
        { label: "掲載管理", hint: "掲載中・下書きを管理", href: "listing-management.html", icon: "📋" },
        { label: "業務サービス掲載", hint: "法人・業者向けサービスを掲載", href: "post.html?scope=business", icon: "💼" },
        { label: "スキル掲載", hint: "スキル・専門サービスを掲載", href: "post.html", icon: "✨" },
        { label: "市場出品", hint: "商品を出品する", href: "shop-market-listing-new.html", icon: "📦" },
      ],
    },
    comms: {
      title: "やりとり",
      description: "TALK・チャット・AI",
      items: [
        { label: "TASFUL TALK", hint: "通知・連絡のホーム", href: "talk-home.html", icon: "💬" },
        { label: "すべてのやりとり", hint: "相談・見積・取引チャット", href: "talk-home.html?tab=chat", icon: "📨" },
        { label: "AI相談", hint: "AIに相談する", href: "ai-workspace.html", icon: "🤖" },
      ],
    },
    anpi: {
      title: "安否",
      description: "安否確認・通知管理",
      items: [
        { label: "安否ダッシュボード", hint: "安否状況を確認", href: "anpi-dashboard.html", icon: "📊" },
        { label: "安否サービス登録", hint: "契約者・利用者を登録", href: "anpi-register.html", icon: "📝" },
        { label: "安否通知センター", hint: "通知・連絡を確認", href: "anpi-notifications.html", icon: "🔔" },
      ],
    },
  };

  const MOBILE_QUICK_CARDS = [
    { id: "explore", label: "探す", sub: "サービス・求人", icon: "🔍", theme: "explore", badgeKey: null },
    { id: "publish", label: "掲載する", sub: "出品・掲載", icon: "📤", theme: "publish", badgeKey: null },
    { id: "comms", label: "やりとり", sub: "TALK・AI", icon: "💬", theme: "comms", badgeKey: "comms" },
    { id: "anpi", label: "安否", sub: "確認・通知", icon: "🛡️", theme: "anpi", badgeKey: "anpi" },
  ];

  let mobileSheetOpenId = "";

  function formatQuickBadge(count) {
    const n = Number(count) || 0;
    if (n <= 0) return "";
    const text = n > 99 ? "99+" : String(n);
    return `<span class="tasu-mobile-quick__badge">${esc(text)}</span>`;
  }

  function getQuickBadgeCounts(data, unreadNotify) {
    const comms = Math.max(0, Number(data?.unreadMessages) || 0) + Math.max(0, Number(unreadNotify) || 0);
    const anpiState = window.TasuAnpiNotificationBadge?.getAnpiBadgeState?.();
    const anpi = Number(anpiState?.unread_count) || 0;
    return { comms, anpi };
  }

  function renderMobileSheetItemHtml(item) {
    return `
      <li>
        <a class="tasu-mobile-sheet__card" href="${esc(item.href)}" data-breadcrumb-label="${esc(item.label)}">
          <span class="tasu-mobile-sheet__card-icon" aria-hidden="true">${item.icon || "•"}</span>
          <span class="tasu-mobile-sheet__card-text">
            <span class="tasu-mobile-sheet__card-title">${esc(item.label)}</span>
            <span class="tasu-mobile-sheet__card-hint">${esc(item.hint || "")}</span>
          </span>
          <span class="tasu-mobile-sheet__card-chevron" aria-hidden="true">›</span>
        </a>
      </li>`;
  }

  function isMobileQuickViewport() {
    try {
      return window.matchMedia("(max-width: 960px)").matches;
    } catch {
      return window.innerWidth <= 960;
    }
  }

  function ensureMobileSheetRoot() {
    let root = document.querySelector("[data-tasu-mobile-sheet]");
    if (!root) {
      root = document.createElement("div");
      root.className = "tasu-mobile-sheet";
      root.dataset.tasuMobileSheet = "";
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <button type="button" class="tasu-mobile-sheet__backdrop" data-tasu-mobile-sheet-close aria-label="閉じる"></button>
        <div class="tasu-mobile-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="tasuMobileSheetTitle">
          <header class="tasu-mobile-sheet__head">
            <div class="tasu-mobile-sheet__head-text">
              <h2 class="tasu-mobile-sheet__title" id="tasuMobileSheetTitle" data-tasu-mobile-sheet-title></h2>
              <p class="tasu-mobile-sheet__desc" data-tasu-mobile-sheet-desc></p>
            </div>
            <button type="button" class="tasu-mobile-sheet__close" data-tasu-mobile-sheet-close aria-label="閉じる">✕</button>
          </header>
          <div class="tasu-mobile-sheet__body" data-tasu-mobile-sheet-body></div>
        </div>`;
      document.body.appendChild(root);
    }
    return root;
  }

  function closeMobileSheet() {
    const root = document.querySelector("[data-tasu-mobile-sheet]");
    if (!root) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.classList.remove("is-open");
    document.body.classList.remove("tasu-mobile-sheet-open");
    mobileSheetOpenId = "";
  }

  function openMobileSheet(sheetId) {
    const config = MOBILE_QUICK_SHEETS[sheetId];
    if (!config || !isMobileQuickViewport()) return;

    const root = ensureMobileSheetRoot();
    const title = root.querySelector("[data-tasu-mobile-sheet-title]");
    const desc = root.querySelector("[data-tasu-mobile-sheet-desc]");
    const body = root.querySelector("[data-tasu-mobile-sheet-body]");
    if (!title || !body) return;

    title.textContent = config.title;
    if (desc) desc.textContent = config.description || "";
    body.innerHTML = `
      <ul class="tasu-mobile-sheet__list">
        ${config.items.map(renderMobileSheetItemHtml).join("")}
      </ul>`;

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-open");
    document.body.classList.add("tasu-mobile-sheet-open");
    mobileSheetOpenId = sheetId;
  }

  function renderMobileQuickAccessHtml(badgeCounts) {
    const badges = badgeCounts || { comms: 0, anpi: 0 };
    return `
      <section class="tasu-mobile-quick" aria-label="クイックアクセス">
        <h2 class="tasu-mobile-home__section-title">クイックアクセス</h2>
        <div class="tasu-mobile-quick__grid">
          ${MOBILE_QUICK_CARDS.map((card) => {
            const badge =
              card.badgeKey === "comms"
                ? formatQuickBadge(badges.comms)
                : card.badgeKey === "anpi"
                  ? formatQuickBadge(badges.anpi)
                  : "";
            return `
            <button
              type="button"
              class="tasu-mobile-quick__card tasu-mobile-quick__card--${esc(card.theme)}"
              data-mobile-quick-sheet="${esc(card.id)}"
              aria-haspopup="dialog"
            >
              ${badge}
              <span class="tasu-mobile-quick__icon" aria-hidden="true">${card.icon}</span>
              <span class="tasu-mobile-quick__text">
                <span class="tasu-mobile-quick__label">${esc(card.label)}</span>
                <span class="tasu-mobile-quick__sub">${esc(card.sub)}</span>
              </span>
            </button>`;
          }).join("")}
        </div>
      </section>`;
  }

  function bindMobileQuickSheets() {
    if (window.__tasuMobileQuickSheetBound) return;
    window.__tasuMobileQuickSheetBound = true;
    ensureMobileSheetRoot();

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-mobile-quick-sheet]");
      if (trigger && isMobileQuickViewport()) {
        event.preventDefault();
        openMobileSheet(trigger.getAttribute("data-mobile-quick-sheet") || "explore");
        return;
      }
      if (event.target.closest("[data-tasu-mobile-sheet-close]")) {
        event.preventDefault();
        closeMobileSheet();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileSheetOpenId) {
        event.preventDefault();
        closeMobileSheet();
      }
    });
  }

  function listSection(title, rowsHtml, emptyText) {
    const body = rowsHtml || `<p class="tasu-mobile-home__empty">${esc(emptyText)}</p>`;
    return `
      <section class="tasu-mobile-home__section">
        <h2 class="tasu-mobile-home__section-title">${esc(title)}</h2>
        <div class="tasu-mobile-home__list">${body}</div>
      </section>`;
  }

  async function countUnreadNotifications() {
    try {
      if (window.TasuTalkData?.getNotifications) {
        const rows =
          window.TasuTalkData.getNotifications({
            filter: "unread",
            applySettings: true,
          }) || [];
        return rows.length;
      }
    } catch {
      /* ignore */
    }
    return 0;
  }

  function renderMobileHome(data, unreadNotify) {
    const host = $("[data-tasu-mobile-home]");
    if (!host) return;
    if (!window.matchMedia?.("(max-width: 960px)")?.matches) {
      host.classList.add("tasu-mobile-home--hidden");
      return;
    }
    host.classList.remove("tasu-mobile-home--hidden");

    const profile = data.profile || {};
    const name =
      profile.welcomeName ||
      window.TasuDashboardData?.pickWelcomeName?.(profile) ||
      "会員";
    const avatar =
      window.TasuMemberProfile?.resolveDisplayUrl?.(profile.avatarUrl) ||
      profile.avatarUrl ||
      "https://placehold.co/104x104/f3ead4/967622?text=ME";
    const ongoing = data.stats?.ongoing ?? 0;
    const rec = pickRecommendations();
    const quickBadges = getQuickBadgeCounts(data, unreadNotify);

    const progress = window.TasuDemoDealsData?.PROGRESS || [];
    const applying = progress.slice(0, 3).map((p) => ({
      title: p.service || p.project || "応募中",
      partnerName: p.partner || "",
      statusLabel: p.status || "応募中",
      href: "demo-progress.html",
      image: "https://placehold.co/96x96/e0f2fe/0369a1?text=案",
    }));

    const ongoingRows = (data.ongoingRows || []).slice(0, 3);
    const chats = (data.threads || []).slice(0, 4);
    if (!chats.length && window.TasuTalkData?.getMockExtraChats) {
      chats.push(...window.TasuTalkData.getMockExtraChats().slice(0, 3));
    }

    host.innerHTML = `
      <header class="tasu-mobile-home__top">
        <a class="tasu-mobile-home__profile" href="profile-settings.html">
          <img class="tasu-mobile-home__avatar" src="${esc(avatar)}" width="52" height="52" alt="">
          <div>
            <p class="tasu-mobile-home__name">${esc(name)}</p>
            <p class="tasu-mobile-home__sub">進行中 ${ongoing}件</p>
          </div>
        </a>
        <div class="tasu-mobile-home__actions" aria-label="ホームアクション">
          <a class="tasu-mobile-home__action" href="talk-home.html?tab=notify" aria-label="通知">
            <span class="tasu-mobile-home__action-icon" aria-hidden="true">🔔</span>
            ${unreadNotify > 0 ? `<span class="tasu-mobile-home__action-badge">${unreadNotify > 99 ? "99+" : unreadNotify}</span>` : ""}
          </a>
          <button type="button" class="tasu-mobile-home__action" data-tasu-friend-add-open aria-label="友達追加" data-future-feature="friend_request">
            <span class="tasu-mobile-home__action-icon" aria-hidden="true">＋</span>
          </button>
          <a class="tasu-mobile-home__action" href="profile-settings.html" aria-label="設定">
            <span class="tasu-mobile-home__action-icon" aria-hidden="true">⚙</span>
          </a>
        </div>
      </header>

      ${renderMobileQuickAccessHtml(quickBadges)}

      ${listSection(
        "進行中の取引",
        ongoingRows.map(txRowHtml).join(""),
        "進行中の取引はありません"
      )}
      ${listSection(
        "応募中の案件",
        applying.map(txRowHtml).join(""),
        "応募中の案件はありません"
      )}
      ${listSection(
        "最近のやりとり",
        chats.map(chatRowHtml).join(""),
        "やりとりはまだありません"
      )}
      ${listSection(
        "おすすめ案件",
        rec.projects.map(listingRowHtml).join(""),
        "おすすめ案件を準備中です"
      )}
      ${listSection(
        "おすすめ求人",
        rec.jobs.map(listingRowHtml).join(""),
        "おすすめ求人を準備中です"
      )}
      ${listSection(
        "おすすめサービス",
        rec.services.map(listingRowHtml).join(""),
        "おすすめサービスを準備中です"
      )}

      <div class="tasu-mobile-home__ads" role="note">広告枠（準備中）</div>
    `;
  }

  async function initMobileHome(data) {
    bindMobileQuickSheets();
    const unreadNotify = await countUnreadNotifications();
    renderMobileHome(data, unreadNotify);
    window.addEventListener("resize", () => {
      if (!isMobileQuickViewport()) closeMobileSheet();
      renderMobileHome(data, unreadNotify);
    });
  }

  window.TasuDashboardMobileHome = {
    renderMobileHome,
    initMobileHome,
    openMobileSheet,
    closeMobileSheet,
    MOBILE_QUICK_SHEETS,
  };
})();
