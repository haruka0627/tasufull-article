/**
 * TASFUL TALK — カレンダー専用ページ
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function formatDateTime(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return pickStr(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}/${m}/${day} ${hh}:${mm}`;
    } catch {
      return pickStr(iso);
    }
  }

  function resolveDisplayName(ctx) {
    const id = pickStr(ctx?.id);
    const officialNames = {
      official_platform: "TASFULプラット通知",
      official_anpi: "TASFUL安否通知",
      official_tasful: "TASFUL運営通知",
    };
    if (officialNames[id]) return officialNames[id];
    const friendDemoNames = {
      "talk-mock-friend-001": "田中 一郎",
    };
    if (friendDemoNames[id]) return friendDemoNames[id];
    if (ctx?._officialRoom) {
      return officialNames[id] || "通知ルーム";
    }
    return pickStr(ctx?.groupName, ctx?.partnerProfile?.display_name, ctx?.partner?.displayName, "トーク");
  }

  function setView(mode) {
    const list = mode !== "add";
    const listEl = $('[data-talk-calendar-view="list"]');
    const formEl = $('[data-talk-calendar-view="form"]');
    if (listEl) listEl.hidden = !list;
    if (formEl) formEl.hidden = list;
    document.querySelectorAll("[data-talk-calendar-tab]").forEach((tab) => {
      const on = tab.getAttribute("data-talk-calendar-tab") === (list ? "list" : "add");
      tab.classList.toggle("is-active", on);
    });
  }

  function resetCalendarForm() {
    document.querySelectorAll("[data-talk-calendar-field]").forEach((el) => {
      const key = el.getAttribute("data-talk-calendar-field");
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        el.checked = key === "notifyEnabled";
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = "";
      }
    });
    const dt = $('[data-talk-calendar-field="startsAt"]');
    if (dt instanceof HTMLInputElement) {
      const d = new Date(Date.now() + 86400000);
      d.setMinutes(0, 0, 0);
      dt.value = d.toISOString().slice(0, 16);
    }
  }

  function renderCalendarList(threadId) {
    const host = $("[data-talk-calendar-list]");
    const cal = global.TasuTalkRoomCalendarStore;
    if (!host || !cal) return;
    const events = cal.listEvents(threadId);
    if (!events.length) {
      host.innerHTML = `<p class="talk-calendar-empty">予定はまだありません。</p>`;
      return;
    }
    host.innerHTML = events
      .map((evt) => {
        const nav = cal.resolveNavUrl(evt);
        const place = pickStr(evt.location, evt.siteAddress);
        return `
        <article class="talk-calendar-card" data-talk-calendar-event-id="${escapeHtml(evt.id)}">
          <time class="talk-calendar-card__time" datetime="${escapeHtml(evt.startsAt)}">${escapeHtml(formatDateTime(evt.startsAt))}</time>
          <h4 class="talk-calendar-card__title">${escapeHtml(evt.title)}</h4>
          ${place ? `<p class="talk-calendar-card__place">📍 ${escapeHtml(place)}</p>` : ""}
          ${evt.memo ? `<p class="talk-calendar-card__memo">${escapeHtml(evt.memo)}</p>` : ""}
          ${evt.meetingTime ? `<p class="talk-calendar-card__meta">集合: ${escapeHtml(evt.meetingTime)}</p>` : ""}
          ${evt.parking ? `<p class="talk-calendar-card__meta">駐車場: ${escapeHtml(evt.parking)}</p>` : ""}
          ${evt.belongings ? `<p class="talk-calendar-card__meta">持ち物: ${escapeHtml(evt.belongings)}</p>` : ""}
          ${evt.assignee ? `<p class="talk-calendar-card__meta">担当: ${escapeHtml(evt.assignee)}</p>` : ""}
          <div class="talk-calendar-card__footer">
            <span class="talk-calendar-card__notify">${evt.notifyEnabled ? "🔔 通知ON" : "🔕 通知OFF"}</span>
            ${nav ? `<a class="talk-calendar-card__nav talk-calendar-card__nav--cta" href="${escapeHtml(nav)}" target="_blank" rel="noopener noreferrer">ナビを開く</a>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  function readCalendarForm() {
    const read = (key) => {
      const el = $(`[data-talk-calendar-field="${key}"]`);
      if (!el) return "";
      if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
      return pickStr(el.value);
    };
    return {
      title: read("title"),
      startsAt: read("startsAt"),
      location: read("location"),
      memo: read("memo"),
      mapUrl: read("mapUrl"),
      notifyEnabled: read("notifyEnabled") !== false,
      meetingTime: read("meetingTime"),
      siteAddress: read("siteAddress"),
      parking: read("parking"),
      belongings: read("belongings"),
      assignee: read("assignee"),
      navUrl: read("navUrl"),
    };
  }

  function init() {
    const ctx = global.TasuTalkSubNav?.readThreadContext?.();
    const threadId = pickStr(ctx?.id);
    const params = new URLSearchParams(global.location.search);
    const view = pickStr(params.get("view")) || "list";

    const back = $("[data-talk-sub-back]");
    const backHref = global.TasuTalkSubNav?.buildBackToChatHref?.(threadId);
    if (back && backHref) back.setAttribute("href", backHref);

    const sub = $("[data-talk-calendar-subtitle]");
    if (sub) sub.textContent = resolveDisplayName(ctx);

    if (!threadId) {
      const listHost = $("[data-talk-calendar-list]");
      if (listHost) listHost.innerHTML = `<p class="talk-sub-page__empty">トーク情報が見つかりません。</p>`;
      return;
    }

    setView(view === "add" ? "add" : "list");
    if (view === "add") resetCalendarForm();
    else renderCalendarList(threadId);

    document.querySelectorAll("[data-talk-calendar-tab]").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = tab.getAttribute("data-talk-calendar-tab") || "list";
        const url = new URL(global.location.href);
        url.searchParams.set("view", mode);
        global.history.replaceState(null, "", url.pathname + url.search);
        setView(mode === "add" ? "add" : "list");
        if (mode === "add") resetCalendarForm();
        else renderCalendarList(threadId);
      });
    });

    $("[data-talk-calendar-submit]")?.addEventListener("click", () => {
      const cal = global.TasuTalkRoomCalendarStore;
      if (!cal) return;
      const payload = readCalendarForm();
      if (!payload.title || !payload.startsAt) {
        global.alert?.("タイトルと日時を入力してください。");
        return;
      }
      cal.addEvent(threadId, payload);
      const url = new URL(global.location.href);
      url.searchParams.set("view", "list");
      global.history.replaceState(null, "", url.pathname + url.search);
      setView("list");
      renderCalendarList(threadId);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
