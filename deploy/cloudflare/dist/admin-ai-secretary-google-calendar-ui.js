/**
 * AI秘書 Phase 6-E — Google Calendar read-only UI cards
 */
(function (global) {
  "use strict";

  let mounted = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(root, sel) {
    return (root || document).querySelector(sel);
  }

  function formatDateTime(raw, allDay) {
    if (allDay) return esc(String(raw || "").slice(0, 10));
    const t = Date.parse(String(raw || ""));
    if (!Number.isFinite(t)) return esc(raw || "");
    try {
      return esc(
        new Date(t).toLocaleString("ja-JP", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return esc(raw || "");
    }
  }

  function renderDetail(host, event) {
    if (!host) return;
    if (!event) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML =
      `<article class="ops-secretary-gmail__card ops-secretary-calendar__detail">` +
      `<header class="ops-secretary-gmail__card-head">` +
      `<strong class="ops-secretary-gmail__subject">${esc(event.title)}</strong>` +
      `<span class="ops-secretary-gmail__meta">${esc(event.calendarName)} · ${esc(event.status)}</span>` +
      `</header>` +
      `<dl class="ops-secretary-calendar__detail-list">` +
      `<dt>開始</dt><dd>${formatDateTime(event.start, event.allDay)}${event.allDay ? " (終日)" : ""}</dd>` +
      `<dt>終了</dt><dd>${formatDateTime(event.end, event.allDay)}</dd>` +
      `<dt>場所</dt><dd>${esc(event.location || "—")}</dd>` +
      `<dt>参加者</dt><dd>${Number(event.attendeeCount || 0)} 名</dd>` +
      `</dl>` +
      (event.description ? `<p class="ops-secretary-gmail__snippet">${esc(event.description)}</p>` : "") +
      `<p class="ops-secretary-gmail__readonly">閲覧のみ — 予定変更は Phase 6-F 以降</p>` +
      `<button type="button" class="ops-p3-action" data-ops-calendar-detail-close>閉じる</button>` +
      `</article>`;
    host.querySelector("[data-ops-calendar-detail-close]")?.addEventListener("click", () => {
      host.hidden = true;
      host.innerHTML = "";
    });
  }

  function renderCards(host, events) {
    if (!host) return;
    events = Array.isArray(events) ? events : [];
    if (!events.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">予定はありません（read-only）</p>';
      return;
    }
    host.innerHTML = events
      .map((ev) => {
        const badges = [
          ev.allDay ? '<span class="ops-secretary-gmail__badge">終日</span>' : "",
          ev.location ? '<span class="ops-secretary-gmail__badge">場所</span>' : "",
          Number(ev.attendeeCount) > 0 ? '<span class="ops-secretary-gmail__badge">参加者</span>' : "",
        ].join("");
        return (
          `<article class="ops-secretary-gmail__card ops-secretary-calendar__card" tabindex="0" role="button" ` +
          `data-calendar-event-id="${esc(ev.id)}" data-calendar-id="${esc(ev.calendarId)}">` +
          `<header class="ops-secretary-gmail__card-head">` +
          `<strong class="ops-secretary-gmail__subject">${esc(ev.title)}</strong>` +
          `<span class="ops-secretary-gmail__meta">${formatDateTime(ev.start, ev.allDay)} · ${esc(ev.calendarName)}</span>` +
          `</header>` +
          `<p class="ops-secretary-gmail__snippet">${esc(ev.location || "場所未設定")} · 終了 ${formatDateTime(ev.end, ev.allDay)} · ${Number(ev.attendeeCount || 0)} 名 · ${esc(ev.status)}</p>` +
          (badges ? `<div class="ops-secretary-gmail__badges">${badges}</div>` : "") +
          `</article>`
        );
      })
      .join("");
    bindCardClicks(host);
  }

  function bindCardClicks(host) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const detailHost = host.closest("[data-ops-secretary-calendar-panel]")?.querySelector("[data-ops-secretary-calendar-detail]");
    host.querySelectorAll("[data-calendar-event-id]").forEach((card) => {
      if (card.dataset.bound === "1") return;
      card.dataset.bound = "1";
      const open = () => {
        const eventId = card.getAttribute("data-calendar-event-id");
        const calendarId = card.getAttribute("data-calendar-id") || "primary";
        const cached = (host.__events || []).find((e) => e.id === eventId);
        if (cached) {
          renderDetail(detailHost, cached);
          return;
        }
        void Client?.getEvent?.(calendarId, eventId).then((res) => {
          if (res?.ok && res.data?.event) renderDetail(detailHost, res.data.event);
        });
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  async function loadPreset(root, preset, label) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const host = $(root, "[data-ops-secretary-calendar-cards]");
    const status = $(root, "[data-ops-secretary-calendar-status]");
    if (!Client?.listEvents || !host) return;
    if (status) status.textContent = `${label || "読込中"}…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listEvents({ preset, maxResults: 25 });
    if (!result.ok) {
      if (status) status.textContent = `Calendar エラー: ${String(result.error || "failed").slice(0, 80)}`;
      host.innerHTML = '<p class="ops-secretary-gmail__empty">Calendar を読み込めませんでした</p>';
      return;
    }
    const events = result.data?.events || [];
    host.__events = events;
    renderCards(host, events);
    const mock = result.data?.mock ? " · mock" : "";
    if (status) status.textContent = `${label || "Calendar"} ${events.length} 件${mock}`;
  }

  async function loadSearch(root, q) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const host = $(root, "[data-ops-secretary-calendar-cards]");
    const status = $(root, "[data-ops-secretary-calendar-status]");
    if (!Client?.listEvents || !host) return;
    if (status) status.textContent = `検索: ${q.slice(0, 24)}…`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listEvents({ preset: "next_7_days", q, maxResults: 25 });
    if (!result.ok) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">検索できませんでした</p>';
      return;
    }
    const events = result.data?.events || [];
    host.__events = events;
    renderCards(host, events);
    if (status) status.textContent = `検索 ${events.length} 件`;
  }

  function bindPresets(root) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    if (!Client) return;
    root.querySelectorAll("[data-ops-secretary-calendar-preset]").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-ops-secretary-calendar-preset") || "today";
        void loadPreset(root, preset, btn.textContent?.trim() || preset);
      });
    });
    const searchForm = $(root, "[data-ops-secretary-calendar-search-form]");
    if (searchForm && searchForm.dataset.bound !== "1") {
      searchForm.dataset.bound = "1";
      searchForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const input = $(root, "[data-ops-secretary-calendar-search-input]");
        const q = String(input?.value || "").trim();
        if (!q) return;
        void loadSearch(root, q);
      });
    }
  }

  function bindTabs(root) {
    const workspace = document.querySelector("[data-ops-secretary-google-workspace]");
    if (!workspace || workspace.dataset.tabsBound === "1") return;
    workspace.dataset.tabsBound = "1";
    const mailPanel = workspace.querySelector("[data-ops-secretary-gmail-panel]");
    const calPanel = workspace.querySelector("[data-ops-secretary-calendar-panel]");
    workspace.querySelectorAll("[data-ops-google-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-ops-google-tab");
        workspace.querySelectorAll("[data-ops-google-tab]").forEach((t) => {
          const active = t === tab;
          t.setAttribute("aria-selected", active ? "true" : "false");
          t.classList.toggle("ops-secretary-google-workspace__tab--active", active);
        });
        if (mailPanel) mailPanel.hidden = target !== "mail";
        if (calPanel) calPanel.hidden = target !== "calendar";
      });
    });
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-calendar-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindTabs(root);
    bindPresets(root);
    void loadPreset(root, global.TasuSecretaryGoogleCalendarClient?.PRESETS?.today, "今日の予定");
  }

  global.TasuSecretaryGoogleCalendarUI = { mount, loadPreset, loadSearch, renderCards, renderDetail };
})(typeof window !== "undefined" ? window : globalThis);
