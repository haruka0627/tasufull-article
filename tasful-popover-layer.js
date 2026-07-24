/**
 * TASFUL — Popover portal layer (fixed positioning, viewport flip)
 * Escapes overflow:hidden ancestors; reusable for menus, flyouts, selectors.
 */
(function (global) {
  "use strict";

  const ROOT_ID = "tasful-popover-root";
  const PORTAL_CLASS = "tasful-popover--portaled";
  /** @type {Map<string, PopoverSession>} */
  const sessions = new Map();

  /**
   * @typedef {Object} PopoverSession
   * @property {string} id
   * @property {HTMLElement} element
   * @property {HTMLElement} anchor
   * @property {Comment} placeholder
   * @property {string} placement
   * @property {number} gap
   * @property {number} margin
   * @property {boolean} flip
   * @property {() => void} [reposition]
   */

  function ensureRoot() {
    const doc = global.document;
    let root = doc.getElementById(ROOT_ID);
    if (!root) {
      root = doc.createElement("div");
      root.id = ROOT_ID;
      root.className = "tasful-popover-root";
      root.setAttribute("aria-hidden", "true");
      doc.body.appendChild(root);
    }
    return root;
  }

  function resolveSession(idOrEl) {
    if (typeof idOrEl === "string") return sessions.get(idOrEl) || null;
    if (!(idOrEl instanceof HTMLElement)) return null;
    const sid = idOrEl.dataset.tasfulPopoverSession;
    if (sid && sessions.has(sid)) return sessions.get(sid);
    for (const session of sessions.values()) {
      if (session.element === idOrEl) return session;
    }
    return null;
  }

  function resolvePlacement(session) {
    const vw = global.innerWidth;
    if (vw <= 520 && session.placement.startsWith("right")) {
      return "top";
    }
    if (vw <= 520 && session.placement.startsWith("left")) {
      return "bottom";
    }
    return session.placement;
  }

  function measure(element) {
    const prev = {
      visibility: element.style.visibility,
      hidden: element.hidden,
    };
    element.style.visibility = "hidden";
    element.hidden = false;
    const rect = element.getBoundingClientRect();
    element.style.visibility = prev.visibility;
    element.hidden = prev.hidden;
    return rect;
  }

  function position(sessionIdOrElement) {
    const session = resolveSession(sessionIdOrElement);
    if (!session) return;

    const { element, anchor, gap, margin, flip } = session;
    const placement = resolvePlacement(session);
    const anchorRect = anchor.getBoundingClientRect();
    const elRect = measure(element);
    const vw = global.innerWidth;
    const vh = global.innerHeight;

    element.style.position = "fixed";
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.width = "";
    element.classList.remove("is-flip-left", "is-flip-right", "is-flip-top", "is-flip-bottom");

    let left = 0;
    let top = 0;

    if (placement === "right-end" || placement === "right-start") {
      left = anchorRect.right + gap;
      top =
        placement === "right-end"
          ? anchorRect.bottom - elRect.height
          : anchorRect.top;

      if (flip && left + elRect.width > vw - margin) {
        left = anchorRect.left - gap - elRect.width;
        element.classList.add("is-flip-left");
      }
    } else if (placement === "left-end" || placement === "left-start") {
      left = anchorRect.left - gap - elRect.width;
      top =
        placement === "left-end"
          ? anchorRect.bottom - elRect.height
          : anchorRect.top;

      if (flip && left < margin) {
        left = anchorRect.right + gap;
        element.classList.add("is-flip-right");
      }
    } else if (placement === "top") {
      left = anchorRect.left;
      top = anchorRect.top - gap - elRect.height;
      const maxWidth = vw - margin * 2;
      element.style.width = `${Math.min(Math.max(elRect.width, 220), maxWidth)}px`;

      const sizedRect = element.getBoundingClientRect();
      top = anchorRect.top - gap - sizedRect.height;

      if (flip && top < margin) {
        top = anchorRect.bottom + gap;
        element.classList.add("is-flip-bottom");
      } else {
        element.classList.add("is-flip-top");
      }

      left = Math.max(margin, Math.min(left, vw - sizedRect.width - margin));
      top = Math.max(margin, Math.min(top, vh - sizedRect.height - margin));

      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
      return;
    } else if (placement === "bottom") {
      left = anchorRect.left;
      top = anchorRect.bottom + gap;
      const maxWidth = vw - margin * 2;
      element.style.width = `${Math.min(Math.max(elRect.width, 220), maxWidth)}px`;

      const sizedRect = element.getBoundingClientRect();

      if (flip && top + sizedRect.height > vh - margin) {
        top = anchorRect.top - gap - sizedRect.height;
        element.classList.add("is-flip-top");
      } else {
        element.classList.add("is-flip-bottom");
      }

      left = Math.max(margin, Math.min(left, vw - sizedRect.width - margin));
      top = Math.max(margin, Math.min(top, vh - sizedRect.height - margin));

      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
      return;
    }

    left = Math.max(margin, Math.min(left, vw - elRect.width - margin));
    top = Math.max(margin, Math.min(top, vh - elRect.height - margin));

    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
  }

  function attachReposition(session) {
    if (session.reposition) return;
    const handler = () => position(session.id);
    session.reposition = handler;
    global.addEventListener("resize", handler, { passive: true });
    global.addEventListener("scroll", handler, { passive: true, capture: true });
  }

  function detachReposition(session) {
    if (!session.reposition) return;
    global.removeEventListener("resize", session.reposition);
    global.removeEventListener("scroll", session.reposition, true);
    session.reposition = undefined;
  }

  /**
   * @param {Object} options
   * @param {HTMLElement} options.element
   * @param {HTMLElement} options.anchor
   * @param {string} [options.id]
   * @param {string} [options.placement]
   * @param {number} [options.gap]
   * @param {number} [options.margin]
   * @param {boolean} [options.flip]
   */
  function mount(options) {
    const {
      element,
      anchor,
      id,
      placement = "right-end",
      gap = 6,
      margin = 8,
      flip = true,
    } = options;

    if (!element || !anchor) return null;

    const sessionId =
      id ||
      element.id ||
      element.dataset.tasfulPopoverId ||
      `tasful-popover-${sessions.size + 1}`;

    let session = sessions.get(sessionId);
    if (!session) {
      const placeholder = global.document.createComment("tasful-popover-placeholder");
      element.parentNode?.insertBefore(placeholder, element);
      session = {
        id: sessionId,
        element,
        anchor,
        placeholder,
        placement,
        gap,
        margin,
        flip,
      };
      sessions.set(sessionId, session);
    } else {
      session.anchor = anchor;
      session.placement = placement;
      session.gap = gap;
      session.margin = margin;
      session.flip = flip;
    }

    ensureRoot().appendChild(element);
    element.classList.add(PORTAL_CLASS);
    element.dataset.tasfulPopoverSession = sessionId;
    attachReposition(session);
    position(sessionId);
    return sessionId;
  }

  function unmount(sessionIdOrElement) {
    const session = resolveSession(sessionIdOrElement);
    if (!session) return;

    detachReposition(session);
    const { element, placeholder } = session;

    element.classList.remove(
      PORTAL_CLASS,
      "is-flip-left",
      "is-flip-right",
      "is-flip-top",
      "is-flip-bottom",
    );
    element.style.position = "";
    element.style.left = "";
    element.style.top = "";
    element.style.right = "";
    element.style.bottom = "";
    element.style.width = "";
    element.style.visibility = "";
    delete element.dataset.tasfulPopoverSession;

    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.remove();
    }

    sessions.delete(session.id);
  }

  function isPortaled(element) {
    return Boolean(element?.classList.contains(PORTAL_CLASS));
  }

  function containsPortaled(target) {
    if (!(target instanceof Node)) return false;
    for (const session of sessions.values()) {
      if (session.element.contains(target)) return true;
    }
    return false;
  }

  global.TasfulPopoverLayer = {
    mount,
    unmount,
    position,
    isPortaled,
    containsPortaled,
    ensureRoot,
  };
})(typeof window !== "undefined" ? window : globalThis);
