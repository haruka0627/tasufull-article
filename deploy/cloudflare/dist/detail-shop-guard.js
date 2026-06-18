/**
 * detail-shop.html — file:// やネスト iframe で同一 HTML を読み込まない（先頭で実行）
 */
(function () {
  "use strict";

  const IS_FILE = location.protocol === "file:";
  const PAGE_RE = /detail-shop(?:-store)?\.html/i;

  function isDetailShopUrl(url) {
    return PAGE_RE.test(String(url || ""));
  }

  function isBlockedDetailShopFrameUrl(url) {
    if (!isDetailShopUrl(url)) return false;
    if (!IS_FILE && window.self === window.top) return false;
    return true;
  }

  function sanitizeDetailShopFrameUrl(url) {
    const raw = String(url || "");
    if (!isDetailShopUrl(raw)) return raw;
    try {
      const u = new URL(raw, location.href);
      let id = String(u.searchParams.get("id") || u.searchParams.get("listingId") || "").trim();
      if (/^---shop-/i.test(id)) {
        id = `demo${id.slice(3)}`;
        u.searchParams.set("id", id);
      }
      return u.href;
    } catch (_) {
      return raw;
    }
  }

  function removeBlockedFrames(root) {
    (root || document).querySelectorAll("iframe").forEach((frame) => {
      const src = String(frame.getAttribute("src") || frame.src || "").trim();
      if (!src || !isBlockedDetailShopFrameUrl(src)) return;
      frame.remove();
    });
  }

  function patchIframeSrc() {
    if (!window.HTMLIFrameElement) return;
    const proto = HTMLIFrameElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "src");
    if (!desc || typeof desc.set !== "function" || desc.configurable === false) return;

    Object.defineProperty(proto, "src", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value) {
        const next = String(value || "");
        if (isBlockedDetailShopFrameUrl(next)) {
          removeBlockedFrames(document);
          return;
        }
        desc.set.call(this, sanitizeDetailShopFrameUrl(next));
      },
    });
  }

  patchIframeSrc();
  removeBlockedFrames(document);

  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.target?.tagName === "IFRAME" && m.attributeName === "src") {
          const src = String(m.target.getAttribute("src") || m.target.src || "");
          if (isBlockedDetailShopFrameUrl(src)) m.target.remove();
          continue;
        }
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === "IFRAME") {
            const src = String(node.getAttribute("src") || node.src || "");
            if (isBlockedDetailShopFrameUrl(src)) node.remove();
            return;
          }
          removeBlockedFrames(node);
        });
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  window.__TASU_DETAIL_SHOP_GUARD__ = {
    IS_FILE,
    isBlockedDetailShopFrameUrl,
    removeBlockedFrames,
  };
})();
