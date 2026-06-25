/**
 * TLV — 動画視聴側アカウントメニュー（YouTube 視聴 UI 寄せ）
 */
(function (global) {
  "use strict";

  let closeMenuFn = null;
  let panelUid = 0;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function liveCfg() {
    return global.TasuLiveConfig;
  }

  function isAuthenticatedTalkUser() {
    const dev = global.TasuTlvDevAuth;
    if (dev?.isAuthenticatedForTlv) return dev.isAuthenticatedForTlv();
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    return Boolean(auth?.authenticated && auth?.talkUserId);
  }

  function tlvReturnToParam() {
    const loc = global.location;
    return encodeURIComponent(`${loc?.pathname || ""}${loc?.search || ""}${loc?.hash || ""}`);
  }

  function tlvLoginHref() {
    return `../login.html?returnTo=${tlvReturnToParam()}`;
  }

  function tlvSignupHref() {
    return `../signup.html?returnTo=${tlvReturnToParam()}`;
  }

  function studioHomeHref() {
    return "channel-content.html";
  }

  const ACCOUNT_SUBMENUS = Object.freeze({
    language: {
      title: "表示言語",
      note: "他の言語は準備中です",
      options: [
        { label: "日本語", active: true },
        { label: "English", comingSoon: true },
      ],
    },
    region: {
      title: "地域",
      note: "他の地域は準備中です",
      options: [
        { label: "日本", active: true },
        { label: "その他の地域", comingSoon: true },
      ],
    },
  });

  function renderSubmenuHtml(submenuId) {
    const sub = ACCOUNT_SUBMENUS[submenuId];
    if (!sub) return "";
    const options = sub.options
      .map((opt) => {
        if (opt.comingSoon) {
          return `
            <div class="tlv-view-acct__submenu-option tlv-view-acct__submenu-option--disabled" aria-disabled="true">
              <span>${esc(opt.label)}</span>
              <span class="tlv-view-acct__submenu-soon">準備中</span>
            </div>`;
        }
        return `
          <div class="tlv-view-acct__submenu-option is-active">
            <span>${esc(opt.label)}</span>
            <span class="tlv-view-acct__submenu-check" aria-hidden="true">✓</span>
          </div>`;
      })
      .join("");
    return `
      <div class="tlv-view-acct__submenu" data-tlv-view-acct-submenu-view="${esc(submenuId)}">
        <button type="button" class="tlv-view-acct__submenu-back" data-tlv-view-acct-submenu-back>
          <span class="tlv-view-acct__submenu-back-icon" aria-hidden="true">‹</span>
          <span>${esc(sub.title)}</span>
        </button>
        <div class="tlv-view-acct__submenu-list">${options}</div>
        <p class="tlv-view-acct__submenu-note">${esc(sub.note)}</p>
      </div>`;
  }

  function renderRow(item) {
    const iconHtml = item.icon
      ? `<span class="tlv-view-acct__row-icon" aria-hidden="true">${esc(item.icon)}</span>`
      : `<span class="tlv-view-acct__row-icon tlv-view-acct__row-icon--spacer" aria-hidden="true"></span>`;
    const labelText = item.detail ? `${item.label}: ${item.detail}` : item.label;
    const labelHtml = `<span class="tlv-view-acct__row-label">${esc(labelText)}</span>`;
    const chevronHtml = item.chevron
      ? `<span class="tlv-view-acct__row-chevron" aria-hidden="true">›</span>`
      : "";

    if (item.submenu) {
      return `
        <button type="button" class="tlv-view-acct__row" role="menuitem" data-tlv-view-acct-submenu="${esc(item.submenu)}" aria-haspopup="true">
          ${iconHtml}
          ${labelHtml}
          ${chevronHtml}
        </button>`;
    }

    if (item.comingSoon) {
      return `
        <div class="tlv-view-acct__row tlv-view-acct__row--disabled" role="menuitem" aria-disabled="true">
          ${iconHtml}
          ${labelHtml}
          ${chevronHtml}
        </div>`;
    }

    if (item.action === "logout") {
      return `
        <button type="button" class="tlv-view-acct__row" role="menuitem" data-tlv-view-acct-logout>
          ${iconHtml}
          ${labelHtml}
        </button>`;
    }

    return `
      <a class="tlv-view-acct__row" href="${esc(item.href)}" role="menuitem">
        ${iconHtml}
        ${labelHtml}
        ${chevronHtml}
      </a>`;
  }

  function renderGuestPanel() {
    return `
      <div class="tlv-view-acct__guest">
        <p class="tlv-view-acct__guest-text">ログインするとチャンネル管理・通知・収益確認ができます</p>
        <div class="tlv-view-acct__guest-actions">
          <a class="live-btn live-btn--primary" href="${esc(tlvLoginHref())}">ログイン</a>
          <a class="live-btn live-btn--ghost" href="${esc(tlvSignupHref())}">アカウント作成</a>
        </div>
      </div>`;
  }

  function buildPanelHtml() {
    if (!isAuthenticatedTalkUser()) {
      return renderGuestPanel();
    }

    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.() || "";
    const displayName = cfg?.resolveDisplayName?.(userId) || userId || "ユーザー";
    const handle = cfg?.resolveChannelHandle?.(userId) || `@${userId}`;
    const avatarUrl = cfg?.resolveAvatarUrl?.(userId) || "";
    const channelHref = cfg?.profileUrl?.(userId) || "profile.html";

    const quickNavRows = [
      { icon: "◎", label: "マイページ", href: "profile.html" },
      { icon: "🔔", label: "通知", href: "notifications.html" },
      { icon: "▶", label: "チャンネル", href: channelHref },
      { icon: "◆", label: "TLV Studio", href: studioHomeHref() },
    ];
    const accountRows = [
      { icon: "✎", label: "プロフィール編集", href: "settings.html" },
      { icon: "⇄", label: "アカウントを切り替える", href: tlvLoginHref(), chevron: true },
      { icon: "↪", label: "ログアウト", action: "logout" },
    ];
    const creatorRows = [
      { icon: "▶", label: "動画を管理", href: "channel-content.html" },
      { icon: "¥", label: "収益・分析", href: "creator-dashboard.html" },
      { icon: "◇", label: "購入とメンバーシップ", comingSoon: true, chevron: true },
    ];
    const settingsRows = [
      { icon: "☾", label: "表示テーマ", comingSoon: true, chevron: true },
      { icon: "文", label: "表示言語", detail: "日本語", submenu: "language", chevron: true },
      { icon: "⌖", label: "地域", detail: "日本", submenu: "region", chevron: true },
      { icon: "🔔", label: "通知設定", href: "settings.html" },
      { icon: "🛡", label: "安全設定", href: "settings.html" },
      { icon: "?", label: "ヘルプ", href: "../company/faq.html" },
      { icon: "✉", label: "フィードバック", href: "../company/contact.html" },
    ];

    return `
      <div class="tlv-view-acct__profile">
        <img class="tlv-view-acct__avatar" src="${esc(avatarUrl)}" width="40" height="40" alt="" loading="lazy" decoding="async" />
        <div class="tlv-view-acct__profile-text">
          <div class="tlv-view-acct__name">${esc(displayName)}</div>
          <div class="tlv-view-acct__handle">${esc(handle)}</div>
          <a class="tlv-view-acct__channel-link" href="${esc(channelHref)}">チャンネルを表示</a>
        </div>
      </div>
      <div class="tlv-view-acct__section">${quickNavRows.map(renderRow).join("")}</div>
      <div class="tlv-view-acct__divider" aria-hidden="true"></div>
      <div class="tlv-view-acct__section">${accountRows.map(renderRow).join("")}</div>
      <div class="tlv-view-acct__divider" aria-hidden="true"></div>
      <div class="tlv-view-acct__section">${creatorRows.map(renderRow).join("")}</div>
      <div class="tlv-view-acct__divider" aria-hidden="true"></div>
      <div class="tlv-view-acct__section">${settingsRows.map(renderRow).join("")}</div>`;
  }

  function renderTriggerInner() {
    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.() || "";
    const loggedIn = isAuthenticatedTalkUser();
    const avatarUrl = loggedIn && userId ? cfg?.resolveAvatarUrl?.(userId) : "";
    if (avatarUrl) {
      return `<img class="tlv-videos-action__avatar tlv-videos-action__avatar-img" src="${esc(avatarUrl)}" width="28" height="28" alt="" loading="lazy" decoding="async" />`;
    }
    return `<span class="tlv-videos-action__avatar" aria-hidden="true">◎</span>`;
  }

  function nextPanelId(compact) {
    panelUid += 1;
    return compact ? `tlv-view-acct-panel-mobile-${panelUid}` : `tlv-view-acct-panel-desktop-${panelUid}`;
  }

  function renderHtml(options = {}) {
    const compact = Boolean(options.compact);
    const panelId = options.panelId || nextPanelId(compact);
    const triggerClass = compact
      ? "tlv-videos-action tlv-videos-action--icon tlv-videos-action--profile tlv-view-acct__trigger"
      : "tlv-videos-action tlv-videos-action--profile tlv-view-acct__trigger";

    return `
      <div class="tlv-view-acct${compact ? " tlv-view-acct--compact" : ""}" data-tlv-view-acct-menu>
        <button type="button" class="${triggerClass}" data-tlv-view-acct-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="${esc(panelId)}" title="アカウント" aria-label="アカウントメニュー">
          ${renderTriggerInner()}
        </button>
        <div class="tlv-view-acct__panel" id="${esc(panelId)}" data-tlv-view-acct-panel hidden role="menu" aria-label="アカウントメニュー">
          <div class="tlv-view-acct__scroll" data-tlv-view-acct-body></div>
        </div>
      </div>`;
  }

  function positionPanel(panel, trigger) {
    if (!panel || !trigger) return;
    const mqMobile = global.matchMedia("(max-width: 1023px)");
    if (mqMobile.matches) {
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(360, global.innerWidth - margin * 2);
      const left = Math.max(margin, global.innerWidth - width - margin);
      const maxHeight = Math.min(global.innerHeight * 0.9, global.innerHeight - rect.bottom - margin * 2);
      panel.style.position = "fixed";
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(rect.bottom + 8)}px`;
      panel.style.right = "auto";
      panel.style.maxHeight = `${Math.max(240, maxHeight)}px`;
    } else {
      panel.style.position = "";
      panel.style.width = "";
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.maxHeight = "";
    }
  }

  function init(options = {}) {
    if (global.document.body.dataset.tlvViewAcctBound === "1") return;
    global.document.body.dataset.tlvViewAcctBound = "1";

    const mqMobile = global.matchMedia("(max-width: 1023px)");
    let openMenu = null;

    function setOpen(trigger, panel, open) {
      if (!trigger || !panel) return;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
      global.document.body.classList.toggle("tlv-view-acct-open", open);
      openMenu = open ? { trigger, panel } : null;
    }

    function closeMenu() {
      if (!openMenu) return;
      setOpen(openMenu.trigger, openMenu.panel, false);
    }

    function renderPanel(panel) {
      const body = panel.querySelector("[data-tlv-view-acct-body]");
      if (body) body.innerHTML = buildPanelHtml();
    }

    function openMenuFrom(trigger) {
      const menu = trigger.closest("[data-tlv-view-acct-menu]");
      const panel = menu?.querySelector("[data-tlv-view-acct-panel]");
      if (!panel) return;
      options.beforeOpen?.();
      if (openMenu?.trigger === trigger && !panel.hidden) {
        closeMenu();
        return;
      }
      if (openMenu) closeMenu();
      setOpen(trigger, panel, true);
      renderPanel(panel);
      positionPanel(panel, trigger);
    }

    async function handleLogout() {
      closeMenu();
      if (global.TasuTlvDevAuth?.handleDevLogout?.()) {
        global.location.reload();
        return;
      }
      try {
        if (global.TasuMemberAuth?.logout) {
          await global.TasuMemberAuth.logout({ redirect: "../dashboard.html" });
          return;
        }
      } catch (err) {
        console.warn("[TasuTlvViewAccountMenu] logout skipped:", err.message || err);
      }
      global.location.href = "../dashboard.html";
    }

    global.document.addEventListener(
      "click",
      (e) => {
        const toggle = e.target.closest("[data-tlv-view-acct-toggle]");
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          openMenuFrom(toggle);
          return;
        }
        if (e.target.closest("[data-tlv-view-acct-logout]")) {
          e.preventDefault();
          e.stopPropagation();
          handleLogout();
          return;
        }
        const submenuBtn = e.target.closest("[data-tlv-view-acct-submenu]");
        if (submenuBtn && openMenu) {
          e.preventDefault();
          e.stopPropagation();
          const submenuId = submenuBtn.getAttribute("data-tlv-view-acct-submenu");
          const body = openMenu.panel.querySelector("[data-tlv-view-acct-body]");
          if (body && submenuId) body.innerHTML = renderSubmenuHtml(submenuId);
          return;
        }
        if (e.target.closest("[data-tlv-view-acct-submenu-back]") && openMenu) {
          e.preventDefault();
          e.stopPropagation();
          renderPanel(openMenu.panel);
          return;
        }
        if (openMenu && !e.target.closest("[data-tlv-view-acct-menu]")) {
          const body = openMenu.panel.querySelector("[data-tlv-view-acct-body]");
          if (body?.querySelector("[data-tlv-view-acct-submenu-view]")) {
            renderPanel(openMenu.panel);
            return;
          }
          closeMenu();
        }
      },
      true,
    );

    global.document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !openMenu) return;
      const body = openMenu.panel.querySelector("[data-tlv-view-acct-body]");
      if (body?.querySelector("[data-tlv-view-acct-submenu-view]")) {
        renderPanel(openMenu.panel);
        return;
      }
      closeMenu();
    });

    mqMobile.addEventListener("change", () => {
      if (openMenu) positionPanel(openMenu.panel, openMenu.trigger);
    });

    global.addEventListener("resize", () => {
      if (openMenu) positionPanel(openMenu.panel, openMenu.trigger);
    });

    closeMenuFn = closeMenu;
  }

  function close() {
    closeMenuFn?.();
  }

  global.TasuTlvViewAccountMenu = {
    renderHtml,
    buildPanelHtml,
    init,
    close,
    isAuthenticatedTalkUser,
  };
})(typeof window !== "undefined" ? window : globalThis);
