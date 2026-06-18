/**
 * AI検索結果の保持（詳細ページ往復後も候補一覧を復元）
 * sessionStorage key: tasuAiSearchState
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasuAiSearchState";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function read() {
    try {
      const raw = global.sessionStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function save(state) {
    if (!state || typeof state !== "object") return;
    try {
      const next = {
        ...state,
        savedAt: new Date().toISOString(),
      };
      global.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("[TasuAiSearchState] save failed:", err);
    }
  }

  function clear() {
    try {
      global.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function isSearchResultState(state) {
    if (!state) return false;
    if (state.isSearch === true) return true;
    return Boolean(String(state.outputHtml || "").includes("ai-cross-card"));
  }

  function findScrollParent(el) {
    let node = el;
    while (node && node !== global.document?.body) {
      const style = global.getComputedStyle?.(node);
      const overflowY = style?.overflowY || "";
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 4
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return global.document?.scrollingElement || null;
  }

  function resolveScrollContainer(fromEl, surface) {
    if (fromEl) {
      const inChat = fromEl.closest("[data-ai-chat-messages]");
      if (inChat) {
        return findScrollParent(inChat) || inChat;
      }
      const inTalkRich = fromEl.closest("[data-talk-ai-output-html]");
      if (inTalkRich) return findTalkScrollParent(inTalkRich);
      const inTalkPanel = fromEl.closest('[data-talk-panel="ai"]');
      if (inTalkPanel) return findTalkScrollParent(inTalkPanel);
    }
    if (surface === "workspace") {
      const scroller = global.document?.getElementById("chat-scroller");
      if (scroller) return scroller;
      const messages = global.document?.querySelector("[data-ai-chat-messages]");
      if (messages) {
        const scrollable = findScrollParent(messages);
        if (scrollable) return scrollable;
      }
      return global.document?.scrollingElement;
    }
    if (surface === "talk") {
      return (
        findTalkScrollParent(global.document?.querySelector("[data-talk-ai-output-html]")) ||
        global.document?.querySelector('[data-talk-panel="ai"]') ||
        global.document?.scrollingElement
      );
    }
    return global.document?.scrollingElement;
  }

  function findTalkScrollParent(el) {
    let node = el;
    while (node && node !== global.document?.body) {
      const style = global.getComputedStyle?.(node);
      const overflowY = style?.overflowY || "";
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 4
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return global.document?.scrollingElement || null;
  }

  function readScrollTop(container) {
    if (!container) return 0;
    if (container === global.document?.scrollingElement) {
      return global.scrollY || container.scrollTop || 0;
    }
    return container.scrollTop || 0;
  }

  function applyScrollTop(container, scrollTop) {
    const top = Number(scrollTop);
    if (!Number.isFinite(top) || top < 0) return;
    if (!container) return;
    if (container === global.document?.scrollingElement) {
      global.scrollTo?.(0, top);
      return;
    }
    container.scrollTop = top;
  }

  function restoreScroll(state, containerHint) {
    const container =
      containerHint || resolveScrollContainer(null, state?.surface);
    if (!container || state?.scrollTop == null) return;
    const top = state.scrollTop;
    requestAnimationFrame(() => {
      applyScrollTop(container, top);
      requestAnimationFrame(() => applyScrollTop(container, top));
    });
  }

  function patchScrollOnNavigate(state, fromEl) {
    if (!isSearchResultState(state)) return state;
    const container = resolveScrollContainer(fromEl, state.surface);
    return {
      ...state,
      scrollTop: readScrollTop(container),
      returnHref: String(global.location?.pathname || "") + String(global.location?.search || ""),
    };
  }

  function bindDetailLinkCapture() {
    if (global.__tasuAiSearchStateLinkBound) return;
    global.__tasuAiSearchStateLinkBound = true;

    global.document?.addEventListener(
      "click",
      (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        const link = target.closest(
          "a.ai-cross-cta[href], .ai-cross-card a[href], [data-ai-faq-hit] a[href]"
        );
        if (!link || link.getAttribute("target") === "_blank") return;
        const href = String(link.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || /^tel:|^mailto:|^javascript:/i.test(href)) {
          return;
        }

        const state = read();
        if (!isSearchResultState(state)) return;

        if (global.TasuDetailNav?.buildAiDetailUrl && !/[?&]from=/.test(href)) {
          link.setAttribute(
            "href",
            global.TasuDetailNav.buildAiDetailUrl(href, {
              q: pickStr(state?.input),
              returnTo: String(global.location?.pathname || "").replace(/^\//, "") +
                String(global.location?.search || ""),
            })
          );
        }

        save(patchScrollOnNavigate(state, link));
      },
      true
    );
  }

  function requestRestore() {
    try {
      global.dispatchEvent(
        new CustomEvent("tasu:ai-search-state-restore", { detail: { state: read() } })
      );
    } catch {
      /* ignore */
    }
  }

  function init() {
    bindDetailLinkCapture();
    global.addEventListener("pageshow", (ev) => {
      const state = read();
      if (!isSearchResultState(state)) return;
      if (ev.persisted || state.returnHref) {
        requestRestore();
      }
    });
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiSearchState = {
    STORAGE_KEY,
    read,
    save,
    clear,
    isSearchResultState,
    resolveScrollContainer,
    readScrollTop,
    applyScrollTop,
    restoreScroll,
    patchScrollOnNavigate,
    requestRestore,
  };
})(typeof window !== "undefined" ? window : globalThis);
