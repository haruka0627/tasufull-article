/**
 * TASFUL — 友達追加モーダル（スマホホーム等）
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function openModal() {
    const modal = $("[data-tasu-friend-add-modal]");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tasu-friend-add-open");
  }

  function closeModal() {
    const modal = $("[data-tasu-friend-add-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tasu-friend-add-open");
  }

  function wire() {
    if (global.__tasuFriendAddWired) return;
    global.__tasuFriendAddWired = true;

    document.addEventListener("click", (e) => {
      const openBtn = e.target?.closest?.("[data-tasu-friend-add-open]");
      if (!openBtn) return;
      e.preventDefault();
      openModal();
    });

    document.querySelectorAll("[data-tasu-friend-add-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    const modal = $("[data-tasu-friend-add-modal]");
    modal?.addEventListener("click", (e) => {
      if (e.target?.matches?.("[data-tasu-friend-add-close]")) closeModal();
    });

    global.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  global.TasufulFriendAdd = { openModal, closeModal, wire };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})(typeof window !== "undefined" ? window : globalThis);
