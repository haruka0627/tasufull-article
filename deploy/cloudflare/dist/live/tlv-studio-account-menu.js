/**
 * TLV — Studio 側アカウントメニュー（YouTube Studio UI 寄せ・簡素）
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

  function tlvVideosHref() {
    return liveCfg()?.videosListUrl?.() || "videos.html";
  }

  function renderGuestPanel() {
    return `
      <div class="tlv-studio-acct__guest">
        <p class="tlv-studio-acct__guest-text">ログインするとチャンネル管理・通知・収益確認ができます</p>
        <div class="tlv-studio-acct__guest-actions">
          <a class="live-btn live-btn--primary" href="${esc(tlvLoginHref())}">ログイン</a>
          <a class="live-btn live-btn--ghost" href="${esc(tlvSignupHref())}">アカウント作成</a>
        </div>
      </div>`;
  }

  function renderRow(item) {
    const iconHtml = item.icon
      ? `<span class="tlv-studio-acct__row-icon" aria-hidden="true">${esc(item.icon)}</span>`
      : `<span class="tlv-studio-acct__row-icon tlv-studio-acct__row-icon--spacer" aria-hidden="true"></span>`;
    const labelHtml = `<span class="tlv-studio-acct__row-label">${esc(item.label)}</span>`;
    const chevronHtml = item.chevron
      ? `<span class="tlv-studio-acct__row-chevron" aria-hidden="true">›</span>`
      : "";

    if (item.comingSoon) {
      return `
        <div class="tlv-studio-acct__row tlv-studio-acct__row--disabled" role="menuitem" aria-disabled="true">
          ${iconHtml}
          ${labelHtml}
          ${chevronHtml}
        </div>`;
    }

    if (item.action === "logout") {
      return `
        <button type="button" class="tlv-studio-acct__row" role="menuitem" data-tlv-studio-acct-logout>
          ${iconHtml}
          ${labelHtml}
        </button>`;
    }

    if (item.action === "studio-settings") {
      return `
        <button type="button" class="tlv-studio-acct__row" role="menuitem" data-tlv-studio-settings-open>
          ${iconHtml}
          ${labelHtml}
          ${chevronHtml}
        </button>`;
    }

    return `
      <a class="tlv-studio-acct__row" href="${esc(item.href)}" role="menuitem">
        ${iconHtml}
        ${labelHtml}
        ${chevronHtml}
      </a>`;
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

    const navRows = [
      { icon: "▶", label: "チャンネル", href: channelHref },
      { icon: "⌂", label: "TLVに戻る", href: tlvVideosHref() },
      { icon: "⚙", label: "Studio設定", action: "studio-settings", chevron: true },
    ];
    const accountRows = [
      { icon: "⇄", label: "アカウントを切り替える", href: tlvLoginHref(), chevron: true },
      { icon: "↪", label: "ログアウト", action: "logout" },
    ];
    const footerRows = [
      { icon: "☾", label: "デザイン: デバイスのテーマ", comingSoon: true, chevron: true },
      { icon: "✉", label: "フィードバックを送信", href: "../company/contact.html" },
    ];

    return `
      <div class="tlv-studio-acct__profile">
        <img class="tlv-studio-acct__avatar" src="${esc(avatarUrl)}" width="36" height="36" alt="" loading="lazy" decoding="async" />
        <div class="tlv-studio-acct__profile-text">
          <div class="tlv-studio-acct__name">${esc(displayName)}</div>
          <div class="tlv-studio-acct__handle">${esc(handle)}</div>
        </div>
      </div>
      <div class="tlv-studio-acct__section">${navRows.map(renderRow).join("")}</div>
      <div class="tlv-studio-acct__divider" aria-hidden="true"></div>
      <div class="tlv-studio-acct__section">${accountRows.map(renderRow).join("")}</div>
      <div class="tlv-studio-acct__divider" aria-hidden="true"></div>
      <div class="tlv-studio-acct__section">${footerRows.map(renderRow).join("")}</div>`;
  }

  function renderTriggerInner() {
    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.() || "";
    const loggedIn = isAuthenticatedTalkUser();
    const avatarUrl = loggedIn && userId ? cfg?.resolveAvatarUrl?.(userId) : "";
    if (avatarUrl) {
      return `<span class="tlv-studio-acct__trigger-avatar" style="background-image:url('${esc(avatarUrl)}')"></span>`;
    }
    return `<span class="tlv-studio-acct__trigger-avatar tlv-studio-acct__trigger-avatar--placeholder" aria-hidden="true">◎</span>`;
  }

  function nextPanelId(variant) {
    panelUid += 1;
    return variant === "mobile" ? `tlv-studio-acct-panel-mobile-${panelUid}` : `tlv-studio-acct-panel-topbar-${panelUid}`;
  }

  function renderHtml(options = {}) {
    const variant = options.variant === "mobile" ? "mobile" : "topbar";
    const compact = Boolean(options.compact || variant === "mobile");
    const panelId = options.panelId || nextPanelId(variant);
    const triggerClass =
      variant === "mobile"
        ? "tlv-studio-acct__trigger tlv-studio-acct__trigger--mobile"
        : "tlv-studio-acct__trigger tlv-studio-acct__trigger--topbar";

    return `
      <div class="tlv-studio-acct${compact ? " tlv-studio-acct--compact" : ""}" data-tlv-studio-acct-menu data-tlv-studio-acct-variant="${esc(variant)}">
        <button type="button" class="${triggerClass}" data-tlv-studio-acct-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="${esc(panelId)}" title="アカウント" aria-label="アカウントメニュー">
          ${renderTriggerInner()}
        </button>
        <div class="tlv-studio-acct__panel" id="${esc(panelId)}" data-tlv-studio-acct-panel hidden role="menu" aria-label="アカウントメニュー">
          <div class="tlv-studio-acct__scroll" data-tlv-studio-acct-body></div>
        </div>
      </div>`;
  }

  function positionPanel(panel, trigger) {
    if (!panel || !trigger) return;
    const mqMobile = global.matchMedia("(max-width: 1023px)");
    if (mqMobile.matches) {
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(320, global.innerWidth - margin * 2);
      const left = Math.max(margin, global.innerWidth - width - margin);
      const maxHeight = Math.min(global.innerHeight * 0.88, global.innerHeight - rect.bottom - margin * 2);
      panel.style.position = "fixed";
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(rect.bottom + 8)}px`;
      panel.style.right = "auto";
      panel.style.maxHeight = `${Math.max(220, maxHeight)}px`;
    } else {
      panel.style.position = "";
      panel.style.width = "";
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.maxHeight = "";
    }
  }

  function createTopbarAvatarPlaceholder() {
    const cfg = liveCfg();
    const userId = cfg?.getTalkUserId?.() || "";
    const a = global.document.createElement("a");
    a.className = "tlv-studio-topbar__avatar";
    a.href = cfg?.profileUrl?.(userId) || "profile.html";
    a.setAttribute("data-tlv-studio-topbar-avatar", "");
    a.setAttribute("aria-label", "アカウント");
    return a;
  }

  function pruneStrayStudioAcctMenus() {
    global.document
      .querySelectorAll(
        ".tlv-studio-app > .tlv-studio-acct, .tlv-studio-topbar > .tlv-studio-acct, .tlv-studio-mobile-shell > .tlv-studio-acct",
      )
      .forEach((el) => el.remove());
  }

  function dedupeStudioAcctMenus(slotSelector, keep = 1) {
    const menus = [...global.document.querySelectorAll(slotSelector)];
    menus.slice(keep).forEach((el) => el.remove());
  }

  function removeTopbarAcctMenus() {
    global.document.querySelectorAll(".tlv-studio-topbar__actions [data-tlv-studio-acct-menu]").forEach((el) => {
      el.replaceWith(createTopbarAvatarPlaceholder());
    });
  }

  function removeMobileAcctMenus() {
    global.document.querySelectorAll(".tlv-studio-mobile-header [data-tlv-studio-acct-menu]").forEach((el) => {
      el.remove();
    });
  }

  function mountTopbarAcctMenu() {
    dedupeStudioAcctMenus(".tlv-studio-topbar__actions [data-tlv-studio-acct-menu]", 1);
    const actions = global.document.querySelector(".tlv-studio-topbar__actions");
    if (!actions || actions.querySelector("[data-tlv-studio-acct-menu]")) return;

    const avatar = actions.querySelector("[data-tlv-studio-topbar-avatar].tlv-studio-topbar__avatar");
    if (!avatar || avatar.closest("[data-tlv-studio-acct-menu]")) return;
    avatar.outerHTML = renderHtml({ variant: "topbar" });
  }

  function mountMobileAcctMenu() {
    dedupeStudioAcctMenus(".tlv-studio-mobile-header [data-tlv-studio-acct-menu]", 1);
    global.document.querySelectorAll(".tlv-studio-mobile-header").forEach((header) => {
      if (header.querySelector("[data-tlv-studio-acct-menu]")) return;
      const upload = header.querySelector(".tlv-studio-mobile-header__upload");
      const html = renderHtml({ variant: "mobile", compact: true });
      if (upload) upload.insertAdjacentHTML("beforebegin", html);
      else header.insertAdjacentHTML("beforeend", html);
    });
  }

  function mountStudioMenus() {
    pruneStrayStudioAcctMenus();
    const isMobile = global.matchMedia("(max-width: 1023px)").matches;

    if (isMobile) {
      removeTopbarAcctMenus();
      mountMobileAcctMenu();
    } else {
      removeMobileAcctMenus();
      mountTopbarAcctMenu();
    }

    pruneStrayStudioAcctMenus();
    dedupeStudioAcctMenus("[data-tlv-studio-acct-menu]", 1);
  }

  function init(options = {}) {
    if (global.document.body.dataset.tlvStudioAcctBound === "1") return;
    global.document.body.dataset.tlvStudioAcctBound = "1";

    const mqMobile = global.matchMedia("(max-width: 1023px)");
    let openMenu = null;

    function setOpen(trigger, panel, open) {
      if (!trigger || !panel) return;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
      global.document.body.classList.toggle("tlv-studio-acct-open", open);
      openMenu = open ? { trigger, panel } : null;
    }

    function closeMenu() {
      if (!openMenu) return;
      setOpen(openMenu.trigger, openMenu.panel, false);
    }

    function renderPanel(panel) {
      const body = panel.querySelector("[data-tlv-studio-acct-body]");
      if (body) body.innerHTML = buildPanelHtml();
    }

    function openMenuFrom(trigger) {
      const menu = trigger.closest("[data-tlv-studio-acct-menu]");
      const panel = menu?.querySelector("[data-tlv-studio-acct-panel]");
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
        console.warn("[TasuTlvStudioAccountMenu] logout skipped:", err.message || err);
      }
      global.location.href = "../dashboard.html";
    }

    global.document.addEventListener(
      "click",
      (e) => {
        const toggle = e.target.closest("[data-tlv-studio-acct-toggle]");
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          openMenuFrom(toggle);
          return;
        }
        if (e.target.closest("[data-tlv-studio-acct-logout]")) {
          e.preventDefault();
          e.stopPropagation();
          handleLogout();
          return;
        }
        if (e.target.closest("[data-tlv-studio-settings-open]") && openMenu) {
          closeMenu();
          return;
        }
        if (openMenu && !e.target.closest("[data-tlv-studio-acct-menu]")) {
          closeMenu();
        }
      },
      true,
    );

    global.document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openMenu) closeMenu();
    });

    mqMobile.addEventListener("change", () => {
      if (openMenu) closeMenu();
      mountStudioMenus();
    });

    global.addEventListener("resize", () => {
      if (openMenu) positionPanel(openMenu.panel, openMenu.trigger);
    });

    closeMenuFn = closeMenu;
  }

  function mountAndInit(options = {}) {
    mountStudioMenus();
    init(options);
  }

  function close() {
    closeMenuFn?.();
  }

  global.TasuTlvStudioAccountMenu = {
    renderHtml,
    buildPanelHtml,
    mountStudioMenus,
    mountAndInit,
    init,
    close,
    isAuthenticatedTalkUser,
  };
})(typeof window !== "undefined" ? window : globalThis);
