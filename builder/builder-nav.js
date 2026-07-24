/**
 * Builder サイドバー描画 — TasuBuilderNavConfig
 */
(function (global) {
  "use strict";

  function esc(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveNavBadge(item) {
    if (item.id === "notifications" && global.TasuBuilder?.getUnreadNotificationCount) {
      const n = global.TasuBuilder.getUnreadNotificationCount();
      if (n > 0) return { kind: "count", value: String(n) };
      return null;
    }
    if (item.count) return { kind: "count", value: String(item.count) };
    if (item.badge) return { kind: "muted", value: item.badge };
    return null;
  }

  function renderNavItem(item) {
    if (item.sep) return `<span class="builder-partner-sidebar__sep" aria-hidden="true"></span>`;
    let badge = "";
    const resolved = resolveNavBadge(item);
    if (resolved?.kind === "count") {
      badge = `<span class="builder-partner-sidebar__badge is-purple">${esc(resolved.value)}</span>`;
    } else if (resolved?.kind === "muted") {
      badge = `<span class="builder-partner-sidebar__badge is-muted">${esc(resolved.value)}</span>`;
    }
    return (
      `<a class="builder-partner-sidebar__link" href="${esc(item.href)}" data-builder-nav-id="${esc(item.id)}">` +
      `${esc(item.label)}${badge}` +
      `</a>`
    );
  }

  function mountSidebarNav(role) {
    const host = document.querySelector("[data-builder-nav-autoload]");
    if (!host) return;
    const cfg = global.TasuBuilderNavConfig;
    if (!cfg?.getNavForRole) return;
    const items = cfg.getNavForRole(role || host.getAttribute("data-builder-nav-role") || "partner");
    host.innerHTML = items.map(renderNavItem).join("");
    if (typeof global.TasuBuilder?.syncSidebarNavActive === "function") {
      global.TasuBuilder.syncSidebarNavActive();
    } else if (typeof global.syncSidebarNavActive === "function") {
      global.syncSidebarNavActive();
    }
  }

  function boot() {
    document.querySelectorAll("[data-builder-nav-autoload]").forEach((el) => {
      mountSidebarNav(el.getAttribute("data-builder-nav-role"));
    });
    global.addEventListener("load", () => {
      global.TasuBuilder?.syncSidebarNavActive?.();
    });
  }

  global.TasuBuilderNav = { mountSidebarNav, boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
