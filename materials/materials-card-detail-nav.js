/**
 * TASFUL Materials — list card body → existing Detail URL
 * Does not wrap cards in <a>. Reuses the title (or media) detail.html href.
 */
(function (global) {
  "use strict";

  const CARD_SELECTOR = [
    "[data-sfx-card]",
    "[data-bgm-card]",
    "[data-img-card]",
    "[data-ill-card]",
    "[data-bg-card]",
    "[data-icon-card]",
    "[data-web-card]",
    "[data-code-card]",
    "[data-doc-card]",
    "[data-pres-card]",
    "[data-tpl-card]",
    "[data-materials-card]",
  ].join(",");

  const ACTION_SELECTOR = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "audio",
    "video",
    "[role='button']",
    "[role='menuitem']",
    "[data-mat-favorite-btn]",
    "[data-mat-download-btn]",
    "[data-sfx-play]",
    "[data-bgm-play]",
  ].join(",");

  function isDetailHref(href) {
    const raw = String(href || "").trim();
    if (!raw || raw === "#" || /^javascript:/i.test(raw)) return false;
    const path = raw.split("#")[0].split("?")[0];
    return /(^|\/)detail\.html$/i.test(path);
  }

  function resolveDetailHref(card) {
    if (!card || !card.querySelector) return "";
    const title = card.querySelector("h3 a[href], a.mat-bgm-title-link[href]");
    const titleHref = title && title.getAttribute("href");
    if (isDetailHref(titleHref)) return titleHref;
    const links = card.querySelectorAll("a[href]");
    for (let i = 0; i < links.length; i += 1) {
      const href = links[i].getAttribute("href");
      if (isDetailHref(href)) return href;
    }
    return "";
  }

  function isActionTarget(target) {
    if (!target || !target.closest) return false;
    return Boolean(target.closest(ACTION_SELECTOR));
  }

  function selectionInside(card) {
    try {
      const sel = global.getSelection && global.getSelection();
      if (!sel || sel.isCollapsed) return false;
      const node = sel.anchorNode;
      return Boolean(node && card.contains(node));
    } catch {
      return false;
    }
  }

  function goToDetail(href, ev) {
    if (!isDetailHref(href)) return;
    if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) {
      global.open(href, "_blank", "noopener");
      return;
    }
    global.location.assign(href);
  }

  function onClick(ev) {
    if (ev.defaultPrevented) return;
    if (typeof ev.button === "number" && ev.button !== 0) return;
    const raw = ev.target;
    const target = raw && raw.nodeType === 3 ? raw.parentElement : raw;
    if (!target || !target.closest) return;
    if (isActionTarget(target)) return;
    const card = target.closest(CARD_SELECTOR);
    if (!card) return;
    if (selectionInside(card)) return;
    const href = resolveDetailHref(card);
    if (!href) return;
    ev.preventDefault();
    goToDetail(href, ev);
  }

  function bindDocument(doc) {
    const root = doc || global.document;
    if (!root || root.__tasfulMatCardNavBound) return;
    root.__tasfulMatCardNavBound = true;
    root.addEventListener("click", onClick);
  }

  function init() {
    const doc = global.document;
    if (!doc?.body) return;
    if (doc.body.getAttribute("data-page") !== "materials_list" &&
        doc.body.getAttribute("data-page") !== "materials_creator") return;
    bindDocument(doc);
  }

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  global.TasuMaterialsCardDetailNav = {
    CARD_SELECTOR,
    ACTION_SELECTOR,
    isDetailHref,
    resolveDetailHref,
    isActionTarget,
    bindDocument,
  };
})(typeof window !== "undefined" ? window : globalThis);
