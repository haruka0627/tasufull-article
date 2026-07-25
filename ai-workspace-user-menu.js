/**
 * TASFUL AI Workspace — ユーザープロフィールメニュー（Popover）
 */
(function (global) {
  "use strict";

  let helpSubmenuHoverTimer = null;
  let helpSubmenuOpenedAt = 0;

  /* Unfinished non-BD QA hubs (/help/, /help/faq/, …) are not linked.
   * Only formal tracked pages remain as help destinations. */
  const HELP_HREFS = Object.freeze({
    terms: "/ai-terms.html",
    privacy: "/company/legal/privacy.html",
    bug: "/company/contact.html",
  });

  function $(sel, root) {
    return (root || global.document).querySelector(sel);
  }

  function syncUserMenuHeader() {
    const name = $("[data-ai-workspace-user-name]")?.textContent?.trim() || "ゲスト";
    const plan = $("[data-ai-workspace-user-plan]")?.textContent?.trim() || "Free";
    const menuName = $("[data-ai-user-menu-name]");
    const menuPlan = $("[data-ai-user-menu-plan]");
    if (menuName) menuName.textContent = name;
    if (menuPlan) menuPlan.textContent = plan;
  }

  function isMenuOpen() {
    const menu = $("[data-ai-workspace-user-menu]");
    return Boolean(menu && !menu.hidden);
  }

  function isHelpSubmenuOpen() {
    const submenu = $("[data-ai-user-menu-help-submenu]");
    return Boolean(submenu && !submenu.hidden);
  }

  function positionHelpSubmenu() {
    const submenu = $("[data-ai-user-menu-help-submenu]");
    if (!submenu || submenu.hidden) return;
    global.TasfulPopoverLayer?.position?.("ai-user-menu-help-submenu");
  }

  function closeHelpSubmenu() {
    const submenu = $("[data-ai-user-menu-help-submenu]");
    const trigger = $("[data-ai-user-menu-help-trigger]");
    const wrap = $("[data-ai-user-menu-help-wrap]");
    if (helpSubmenuHoverTimer) {
      clearTimeout(helpSubmenuHoverTimer);
      helpSubmenuHoverTimer = null;
    }
    global.TasfulPopoverLayer?.unmount?.("ai-user-menu-help-submenu");
    if (submenu) submenu.hidden = true;
    trigger?.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
    wrap?.classList.remove("is-flip-left");
  }

  function openHelpSubmenu() {
    const submenu = $("[data-ai-user-menu-help-submenu]");
    const trigger = $("[data-ai-user-menu-help-trigger]");
    if (!submenu || !trigger) return;
    submenu.hidden = false;
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    helpSubmenuOpenedAt = Date.now();
    global.TasfulPopoverLayer?.mount?.({
      id: "ai-user-menu-help-submenu",
      element: submenu,
      anchor: trigger,
      placement: "right-end",
      gap: 6,
      margin: 8,
      flip: true,
    });
    global.requestAnimationFrame(() => positionHelpSubmenu());
  }

  function closeUserMenu() {
    closeHelpSubmenu();
    const menu = $("[data-ai-workspace-user-menu]");
    const toggle = $("[data-ai-workspace-user-menu-toggle]");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
  }

  function openUserMenu() {
    const menu = $("[data-ai-workspace-user-menu]");
    const toggle = $("[data-ai-workspace-user-menu-toggle]");
    if (!menu) return;
    syncUserMenuHeader();
    menu.hidden = false;
    toggle?.setAttribute("aria-expanded", "true");
  }

  function toggleUserMenu() {
    if (isMenuOpen()) closeUserMenu();
    else openUserMenu();
  }

  async function handleLogout() {
    closeUserMenu();
    try {
      if (global.TasuMemberAuth?.logout) {
        await global.TasuMemberAuth.logout({ redirect: "index-top.html" });
        return;
      }
    } catch (err) {
      console.warn("[TasuAiWorkspaceUserMenu] logout:", err);
    }
    global.location.href = "index-top.html";
  }

  function bindHelpFlyout() {
    const wrap = $("[data-ai-user-menu-help-wrap]");
    const trigger = $("[data-ai-user-menu-help-trigger]");
    const submenu = $("[data-ai-user-menu-help-submenu]");
    if (!wrap || !trigger || !submenu) return;

    const scheduleClose = () => {
      if (Date.now() - helpSubmenuOpenedAt < 280) return;
      if (helpSubmenuHoverTimer) clearTimeout(helpSubmenuHoverTimer);
      helpSubmenuHoverTimer = setTimeout(() => closeHelpSubmenu(), 160);
    };

    const cancelClose = () => {
      if (helpSubmenuHoverTimer) {
        clearTimeout(helpSubmenuHoverTimer);
        helpSubmenuHoverTimer = null;
      }
    };

    trigger.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cancelClose();
      if (!isHelpSubmenuOpen()) openHelpSubmenu();
    });

    wrap.addEventListener("mouseenter", () => {
      cancelClose();
      openHelpSubmenu();
    });

    wrap.addEventListener("mouseleave", (ev) => {
      const related = ev.relatedTarget;
      if (related instanceof Node) {
        if (submenu.contains(related) || wrap.contains(related)) return;
        if (global.TasfulPopoverLayer?.containsPortaled?.(related)) return;
      }
      scheduleClose();
    });

    submenu.addEventListener("mouseenter", cancelClose);
    submenu.addEventListener("mouseleave", (ev) => {
      const related = ev.relatedTarget;
      if (related instanceof Node) {
        if (submenu.contains(related) || wrap.contains(related)) return;
        if (global.TasfulPopoverLayer?.containsPortaled?.(related)) return;
      }
      scheduleClose();
    });

    submenu.addEventListener("click", (ev) => {
      const item = ev.target.closest("[data-ai-help-item]");
      if (!item) return;
      ev.preventDefault();
      const href = HELP_HREFS[item.getAttribute("data-ai-help-item") || ""];
      closeUserMenu();
      if (href) global.location.href = href;
    });

    global.addEventListener("resize", () => {
      if (isHelpSubmenuOpen()) positionHelpSubmenu();
    });
  }

  function bindUserMenu() {
    const toggle = $("[data-ai-workspace-user-menu-toggle]");
    const menu = $("[data-ai-workspace-user-menu]");
    if (!toggle || !menu) return;

    bindHelpFlyout();

    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleUserMenu();
    });

    menu.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ai-user-menu-help-wrap]")) {
        ev.stopPropagation();
        return;
      }
      if (ev.target.closest("[data-ai-user-menu-upgrade]")) {
        ev.preventDefault();
        closeUserMenu();
        global.TasuAiWorkspacePlanUpgrade?.openPlanUpgrade?.();
        return;
      }
      if (ev.target.closest("[data-ai-workspace-settings-open]")) {
        ev.preventDefault();
        closeUserMenu();
        global.TasuAiWorkspaceSettings?.openSettings?.();
        return;
      }
      if (ev.target.closest("[data-ai-user-menu-logout]")) {
        ev.preventDefault();
        void handleLogout();
        return;
      }
      if (ev.target.closest("[data-ai-user-menu-profile]")) {
        ev.preventDefault();
        closeUserMenu();
        global.TasuAiWorkspaceProfile?.openProfileModal?.();
        return;
      }
    });

    global.document.addEventListener("click", (ev) => {
      if (!isMenuOpen()) return;
      if (ev.target.closest("[data-ai-workspace-user-menu]")) return;
      if (ev.target.closest("[data-ai-workspace-user-menu-toggle]")) return;
      if (global.TasfulPopoverLayer?.containsPortaled?.(ev.target)) return;
      closeUserMenu();
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (isHelpSubmenuOpen()) {
        closeHelpSubmenu();
        return;
      }
      if (isMenuOpen()) closeUserMenu();
    });

    global.addEventListener("tasu:ai-plan-changed", syncUserMenuHeader);
  }

  function init() {
    bindUserMenu();
    syncUserMenuHeader();
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspaceUserMenu = {
    openUserMenu,
    closeUserMenu,
    syncUserMenuHeader,
    openHelpSubmenu,
    closeHelpSubmenu,
  };
})(typeof window !== "undefined" ? window : globalThis);
