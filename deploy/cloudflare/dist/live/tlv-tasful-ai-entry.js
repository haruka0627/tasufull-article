/**
 * TLV Studio → TASFUL AI Workspace 導線（TLV専用AIは作らない）
 */
(function (global) {
  "use strict";

  const WORKSPACE_PATH = "../ai-workspace.html";
  const SOURCE = "tlv";

  function workspaceHref() {
    return `${WORKSPACE_PATH}?source=${SOURCE}`;
  }

  function renderLink(className) {
    const href = workspaceHref();
    return (
      `<a class="tlv-tasful-ai-entry ${className}" href="${href}" data-tlv-tasful-ai-entry` +
      ` target="_blank" rel="noopener noreferrer" aria-label="TASFUL AI Workspace を開く">` +
      `<span class="tlv-tasful-ai-entry__icon" aria-hidden="true">✨</span>` +
      `<span class="tlv-tasful-ai-entry__label">TASFUL AI</span></a>`
    );
  }

  function insertBeforeCreate(actions, html) {
    if (!actions || actions.querySelector("[data-tlv-tasful-ai-entry]")) return;
    const wrap = global.document.createElement("div");
    wrap.innerHTML = html.trim();
    const link = wrap.firstElementChild;
    if (!link) return;
    const create =
      actions.querySelector(".tlv-studio-topbar__create") ||
      actions.querySelector("[data-tlv-create-menu]") ||
      actions.querySelector(".live-btn--primary");
    if (create) actions.insertBefore(link, create);
    else actions.appendChild(link);
  }

  function mountStudioTopbar() {
    global.document.querySelectorAll(".tlv-studio-topbar__actions").forEach((actions) => {
      insertBeforeCreate(actions, renderLink("tlv-tasful-ai-entry--studio-topbar"));
    });
  }

  function mountStudioMobileHeader() {
    global.document.querySelectorAll(".tlv-studio-mobile-header").forEach((header) => {
      if (header.querySelector("[data-tlv-tasful-ai-entry]")) return;
      const upload = header.querySelector(".tlv-studio-mobile-header__upload");
      const wrap = global.document.createElement("div");
      wrap.innerHTML = renderLink("tlv-tasful-ai-entry--studio-mobile");
      const link = wrap.firstElementChild;
      if (!link) return;
      if (upload) header.insertBefore(link, upload);
      else header.appendChild(link);
    });
  }

  function mountVideosChrome() {
    global.document
      .querySelectorAll(".tlv-videos-topbar__actions, .tlv-mobile-videos-toprow__actions")
      .forEach((actions) => {
        insertBeforeCreate(actions, renderLink("tlv-tasful-ai-entry--videos-topbar"));
      });
    global.document.querySelectorAll(".tlv-desktop-topbar--videos").forEach((bar) => {
      if (bar.querySelector("[data-tlv-tasful-ai-entry]")) return;
      const upload = bar.querySelector('a.live-btn--primary[href*="upload"]');
      if (!upload) return;
      const wrap = global.document.createElement("div");
      wrap.innerHTML = renderLink("tlv-tasful-ai-entry--videos-compact");
      const link = wrap.firstElementChild;
      if (link) upload.parentElement?.insertBefore(link, upload);
    });
  }

  function init(options) {
    mountStudioTopbar();
    mountStudioMobileHeader();
    if (options?.videos !== false) mountVideosChrome();
  }

  function autoInitFromDom() {
    if (global.document.querySelector(".tlv-studio-topbar__actions")) {
      init({ videos: false });
      return;
    }
    if (
      global.document.querySelector(".tlv-videos-topbar__actions") ||
      global.document.body?.getAttribute("data-page") === "live-video-upload"
    ) {
      mountVideosChrome();
    }
  }

  global.TasuTlvTasfulAiEntry = {
    SOURCE,
    workspaceHref,
    init,
    mountStudioTopbar,
    mountStudioMobileHeader,
    mountVideosChrome,
  };

  if (typeof global.document !== "undefined") {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", autoInitFromDom);
    } else {
      autoInitFromDom();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
