/**
 * TASFUL TALK — 通話 UI オーバーレイ（発信 / 着信 / 通話中）
 */
(function (global) {
  "use strict";

  /** @type {HTMLElement|null} */
  let root = null;
  /** @type {HTMLElement|null} */
  let toastEl = null;
  /** @type {number|null} */
  let timerInterval = null;
  /** @type {number} */
  let activeStartedAt = 0;

  const handlers = {
    onCancel: null,
    onAccept: null,
    onReject: null,
    onHangup: null,
    onToggleMute: null,
  };

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "talk-call-overlay";
    root.hidden = true;
    root.setAttribute("data-talk-call-overlay", "");
    root.innerHTML = `
      <div class="talk-call-overlay__backdrop" data-talk-call-backdrop></div>
      <div class="talk-call-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="talkCallTitle">
        <p class="talk-call-overlay__chip" data-talk-call-chip></p>
        <h2 class="talk-call-overlay__title" id="talkCallTitle" data-talk-call-title></h2>
        <p class="talk-call-overlay__subtitle" data-talk-call-subtitle></p>
        <p class="talk-call-overlay__timer" data-talk-call-timer hidden></p>
        <div class="talk-call-overlay__actions" data-talk-call-actions></div>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener("click", (event) => {
      const btn = event.target instanceof Element ? event.target.closest("[data-talk-call-action]") : null;
      if (!btn) return;
      const action = btn.getAttribute("data-talk-call-action");
      if (action === "cancel") handlers.onCancel?.();
      if (action === "accept") handlers.onAccept?.();
      if (action === "reject") handlers.onReject?.();
      if (action === "hangup") handlers.onHangup?.();
      if (action === "mute") handlers.onToggleMute?.();
    });

    return root;
  }

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "talk-call-toast";
    toastEl.hidden = true;
    toastEl.setAttribute("data-talk-call-toast", "");
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function renderActions(buttons) {
    const host = ensureRoot().querySelector("[data-talk-call-actions]");
    if (!host) return;
    host.innerHTML = buttons
      .map(
        (b) =>
          `<button type="button" class="talk-call-btn talk-call-btn--${b.tone || "ghost"}" data-talk-call-action="${b.action}"${b.primary ? ' data-talk-call-primary=""' : ""}>${b.label}</button>`
      )
      .join("");
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    activeStartedAt = 0;
    const timerEl = root?.querySelector("[data-talk-call-timer]");
    if (timerEl) timerEl.hidden = true;
  }

  function startTimer(startedAtMs) {
    stopTimer();
    activeStartedAt = startedAtMs || Date.now();
    const timerEl = ensureRoot().querySelector("[data-talk-call-timer]");
    if (!timerEl) return;
    timerEl.hidden = false;
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      timerEl.textContent = `${mm}:${ss}`;
    };
    tick();
    timerInterval = global.setInterval(tick, 1000);
  }

  function showPanel({ chip, title, subtitle, buttons }) {
    ensureRoot();
    root.hidden = false;
    root.dataset.talkCallState = chip || "";
    const chipEl = root.querySelector("[data-talk-call-chip]");
    const titleEl = root.querySelector("[data-talk-call-title]");
    const subEl = root.querySelector("[data-talk-call-subtitle]");
    if (chipEl) chipEl.textContent = chip || "";
    if (titleEl) titleEl.textContent = title || "";
    if (subEl) subEl.textContent = subtitle || "";
    renderActions(buttons || []);
  }

  function hide() {
    stopTimer();
    if (root) {
      root.hidden = true;
      root.dataset.talkCallState = "";
    }
  }

  function showOutgoing(peerName) {
    showPanel({
      chip: "発信中",
      title: "発信中...",
      subtitle: peerName || "",
      buttons: [{ action: "cancel", label: "キャンセル", tone: "warn" }],
    });
  }

  function showIncoming(peerName) {
    showPanel({
      chip: "着信",
      title: "着信しています",
      subtitle: peerName || "",
      buttons: [
        { action: "reject", label: "拒否", tone: "ghost" },
        { action: "accept", label: "応答", tone: "primary", primary: true },
      ],
    });
  }

  function showActive(peerName, muted) {
    showPanel({
      chip: "通話中",
      title: "通話中",
      subtitle: peerName || "",
      buttons: [
        { action: "mute", label: muted ? "ミュート解除" : "ミュート", tone: "ghost" },
        { action: "hangup", label: "終話", tone: "warn", primary: true },
      ],
    });
    startTimer(Date.now());
  }

  function showToast(message, ms) {
    const el = ensureToast();
    el.textContent = message;
    el.hidden = false;
    global.setTimeout(() => {
      el.hidden = true;
    }, ms || 3200);
  }

  function setHandlers(next) {
    Object.assign(handlers, next || {});
  }

  global.TasuTalkCallUi = {
    showOutgoing,
    showIncoming,
    showActive,
    hide,
    showToast,
    setHandlers,
    startTimer,
    stopTimer,
  };
})(typeof window !== "undefined" ? window : globalThis);
