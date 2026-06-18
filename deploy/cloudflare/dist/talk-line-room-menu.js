/**
 * TASFUL TALK — トークルームメニュー（安全 / サブページ遷移）
 */
(function (global) {
  "use strict";

  const Safety = () => global.TasuTalkRoomSafetyStore;
  const SubNav = () => global.TasuTalkSubNav;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getActiveThread() {
    return global.TasuTalkLineRoom?._activeThread || null;
  }

  function getTargetKey(thread) {
    const t = thread || getActiveThread();
    return Safety()?.resolveTargetKey?.(t) || pickStr(t?.id);
  }

  function isOfficialReadonly(thread) {
    return Boolean(thread?._officialRoom || thread?._staticCard);
  }

  function isSocialThread(thread) {
    const t = thread || getActiveThread();
    if (!t || t._officialRoom || t._staticCard) return false;
    return t.chatDomain === "friend" && (t.threadKind === "direct" || t.threadKind === "group");
  }

  function closeRoomMenu() {
    const menu = $("[data-talk-room-menu]");
    if (!menu) return;
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
  }

  function openRoomMenu(anchor) {
    const menu = $("[data-talk-room-menu]");
    const thread = getActiveThread();
    if (!menu || !thread) return;
    renderRoomMenuItems(thread);
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.right = `${Math.max(8, Math.round(global.innerWidth - rect.right))}px`;
    }
  }

  function renderRoomMenuItems(thread) {
    const host = $("[data-talk-room-menu-items]");
    if (!host) return;
    const key = getTargetKey(thread);
    const safety = Safety();
    const official = isOfficialReadonly(thread);
    const social = isSocialThread(thread);
    const pinned = safety?.isPinned?.(key);
    const muted = safety?.isMuted?.(key);
    const blocked = safety?.isBlocked?.(key);

    if (official) {
      host.innerHTML = `
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="calendar-list">カレンダー</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="calendar-list">予定一覧</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="mute">${muted ? "ミュートを解除" : "ミュート"}</button>`;
      return;
    }

    const calendarItems = `
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="calendar-list">カレンダー</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="calendar-add">予定を追加</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="calendar-list">予定一覧</button>`;

    const safetyItems = !social
      ? ""
      : `
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="pin">${pinned ? "ピン留めを解除" : "ピン留め"}</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="mute">${muted ? "ミュートを解除" : "ミュート"}</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="block">${blocked ? "ブロックを解除" : "ブロック"}</button>
      <button type="button" class="talk-room-menu__item talk-room-menu__item--danger" data-talk-room-menu-action="report">通報</button>
      <button type="button" class="talk-room-menu__item" data-talk-room-menu-action="memo">メモ</button>`;

    const profileItem = `<button type="button" class="talk-room-menu__item" data-talk-room-menu-action="profile">プロフィール</button>`;

    host.innerHTML = `${profileItem}${calendarItems}${safetyItems}`;
  }

  function openReportModal() {
    closeRoomMenu();
    const modal = $("[data-talk-report-modal]");
    const host = $("[data-talk-report-reasons]");
    const safety = Safety();
    if (!modal || !host || !safety) return;
    host.innerHTML = safety.REPORT_REASONS.map(
      (row) =>
        `<label class="talk-report-reason"><input type="radio" name="talkReportReason" value="${escapeHtml(row.id)}"> ${escapeHtml(row.label)}</label>`
    ).join("");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function closeReportModal() {
    const modal = $("[data-talk-report-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function submitReport() {
    const safety = Safety();
    const thread = getActiveThread();
    const key = getTargetKey(thread);
    const checked = document.querySelector('input[name="talkReportReason"]:checked');
    const reasonId = pickStr(checked?.value);
    const detail = pickStr($("[data-talk-report-detail]")?.value);
    if (!safety || !key || !reasonId) {
      global.alert?.("通報理由を選択してください。");
      return;
    }
    safety.submitReport({ targetId: key, target: thread, reasonId, detail });
    closeReportModal();
    global.alert?.("通報を受け付けました（デモ）。");
  }

  function navigateSubPage(page, options) {
    closeRoomMenu();
    SubNav()?.navigateToSubPage?.(page, { thread: getActiveThread(), ...options });
  }

  function handleRoomMenuAction(action) {
    const thread = getActiveThread();
    const key = getTargetKey(thread);
    const safety = Safety();
    switch (action) {
      case "profile":
        navigateSubPage("talk-profile.html");
        break;
      case "calendar-list":
        navigateSubPage("talk-calendar.html", { view: "list" });
        break;
      case "calendar-add":
        navigateSubPage("talk-calendar.html", { view: "add" });
        break;
      case "memo":
        navigateSubPage("talk-memo.html");
        break;
      case "pin":
        safety?.togglePinned?.(key);
        renderRoomMenuItems(thread);
        global.TasuTalkHomeUi?.refreshChatThreads?.();
        break;
      case "mute":
        safety?.toggleMuted?.(key);
        renderRoomMenuItems(thread);
        break;
      case "block":
        safety?.toggleBlocked?.(key);
        renderRoomMenuItems(thread);
        break;
      case "report":
        openReportModal();
        break;
      default:
        closeRoomMenu();
    }
  }

  function wire() {
    if (global.__talkLineRoomMenuBound) return;
    global.__talkLineRoomMenuBound = true;

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-talk-room-menu]") && !event.target.closest('[data-talk-line-action="menu"]')) {
        closeRoomMenu();
      }
    });

    document.addEventListener("click", (event) => {
      const item = event.target instanceof Element ? event.target.closest("[data-talk-room-menu-action]") : null;
      if (!item) return;
      event.preventDefault();
      handleRoomMenuAction(item.getAttribute("data-talk-room-menu-action") || "");
    });

    document.querySelectorAll("[data-talk-report-close]").forEach((el) => {
      el.addEventListener("click", closeReportModal);
    });
    $("[data-talk-report-submit]")?.addEventListener("click", submitReport);
  }

  function initRoomMenuHandler() {
    const room = $("[data-talk-line-room]");
    if (!room || room.dataset.roomMenuWired) return;
    room.dataset.roomMenuWired = "1";
    room.addEventListener("click", (event) => {
      const btn = event.target instanceof Element ? event.target.closest('[data-talk-line-action="menu"]') : null;
      if (!btn || btn.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      const menu = $("[data-talk-room-menu]");
      if (menu && !menu.hidden) closeRoomMenu();
      else openRoomMenu(btn);
    });
  }

  function init() {
    wire();
    initRoomMenuHandler();
  }

  global.TasuTalkLineRoomMenu = {
    init,
    initRoomMenuHandler,
    openRoomMenu,
    closeRoomMenu,
    openReportModal,
    navigateSubPage,
  };
})(typeof window !== "undefined" ? window : globalThis);
