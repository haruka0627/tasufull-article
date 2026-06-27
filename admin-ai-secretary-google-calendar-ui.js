/**
 * AI秘書 Phase 6-F — Google Calendar UI (read + write workflow + Human Gate)
 */
(function (global) {
  "use strict";

  let mounted = false;
  const uiState = { phase: "view", pendingId: "", draft: null, selectedEvent: null };

  const STATE_LABELS = Object.freeze({
    view: "閲覧",
    create_confirm: "作成確認待ち",
    update_confirm: "更新確認待ち",
    delete_confirm: "削除確認待ち",
    done: "完了",
  });

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

  function renderStatusBadge(root) {
    const status = $(root, "[data-ops-secretary-calendar-status]");
    if (!status) return;
    const label = STATE_LABELS[uiState.phase] || STATE_LABELS.view;
    const base = status.dataset.baseLabel || status.textContent.split(" · ")[0] || "Calendar";
    status.textContent = `${base} · ${label}`;
  }

  function renderConfirmPanel(root) {
    const host = $(root, "[data-ops-secretary-calendar-confirm]");
    if (!host) return;
    const draft = uiState.draft;
    if (!draft || uiState.phase === "view" || uiState.phase === "done") {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    const actionLabel =
      uiState.phase === "delete_confirm"
        ? "予定削除確認"
        : uiState.phase === "update_confirm"
          ? "予定変更確認"
          : "予定作成確認";
    host.innerHTML =
      `<article class="ops-secretary-gmail__card ops-secretary-calendar__confirm">` +
      `<h5 class="ops-secretary-calendar__confirm-title">${esc(actionLabel)}</h5>` +
      `<p class="ops-secretary-gmail__snippet"><strong>${esc(draft.title || "")}</strong></p>` +
      `<p class="ops-secretary-gmail__snippet">${formatDateTime(draft.start, draft.allDay)} → ${formatDateTime(draft.end, draft.allDay)}</p>` +
      `<p class="ops-secretary-gmail__snippet">${esc(draft.location || "場所未設定")}</p>` +
      `<label class="ops-secretary-gmail__confirm-check">` +
      `<input type="checkbox" data-calendar-confirm-check /> 内容を確認しました` +
      `</label>` +
      `<div class="ops-secretary-gmail__actions">` +
      `<button type="button" class="ops-p3-action" data-calendar-action="approve" disabled>承認</button>` +
      `<button type="button" class="ops-p3-action" data-calendar-action="cancel">キャンセル</button>` +
      `</div>` +
      `<p class="ops-secretary-gmail__readonly">Human Gate 承認後のみ実行されます</p>` +
      `</article>`;
    host.querySelector("[data-calendar-confirm-check]")?.addEventListener("change", (ev) => {
      const btn = host.querySelector('[data-calendar-action="approve"]');
      if (btn) btn.disabled = !ev.target.checked;
    });
    host.querySelector('[data-calendar-action="approve"]')?.addEventListener("click", () => {
      void handleApprove(root);
    });
    host.querySelector('[data-calendar-action="cancel"]')?.addEventListener("click", () => {
      resetWorkflow(root);
    });
  }

  function resetWorkflow(root) {
    uiState.phase = "view";
    uiState.pendingId = "";
    uiState.draft = null;
    renderConfirmPanel(root);
    renderStatusBadge(root);
  }

  async function handleApprove(root) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    if (!uiState.pendingId || !Client?.approvePending) return;
    const approved = await Client.approvePending(uiState.pendingId);
    if (approved?.ok) {
      uiState.phase = "done";
      renderConfirmPanel(root);
      renderStatusBadge(root);
      void loadPreset(root, Client.PRESETS.today, "今日の予定");
      setTimeout(() => resetWorkflow(root), 1500);
    }
  }

  function startHumanGate(root, calendarAction, fields) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const HSG = global.TasuAdminAiHumanSendGate;
    const queued = Client.enqueueCalendarHumanGate(calendarAction, fields);
    if (!queued.ok || !queued.item?.id) return;
    uiState.pendingId = queued.item.id;
    uiState.draft = fields;
    uiState.phase =
      calendarAction === "delete"
        ? "delete_confirm"
        : calendarAction === "update"
          ? "update_confirm"
          : "create_confirm";
    HSG?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
    renderConfirmPanel(root);
    renderStatusBadge(root);
  }

  function renderDetail(host, event, root) {
    if (!host) return;
    if (!event) {
      host.hidden = true;
      host.innerHTML = "";
      uiState.selectedEvent = null;
      return;
    }
    uiState.selectedEvent = event;
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
      `<div class="ops-secretary-gmail__actions">` +
      `<button type="button" class="ops-p3-action" data-calendar-action="update">予定を変更</button>` +
      `<button type="button" class="ops-p3-action" data-calendar-action="delete">予定を削除</button>` +
      `<button type="button" class="ops-p3-action" data-ops-calendar-detail-close>閉じる</button>` +
      `</div>` +
      `</article>`;
    host.querySelector("[data-ops-calendar-detail-close]")?.addEventListener("click", () => {
      renderDetail(host, null, root);
    });
    host.querySelector('[data-calendar-action="update"]')?.addEventListener("click", () => {
      const fields = {
        calendarId: event.calendarId || "primary",
        eventId: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        location: event.location,
        description: event.description,
      };
      startHumanGate(root, "update", fields);
    });
    host.querySelector('[data-calendar-action="delete"]')?.addEventListener("click", () => {
      startHumanGate(root, "delete", {
        calendarId: event.calendarId || "primary",
        eventId: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
      });
    });
  }

  function renderCards(host, events) {
    if (!host) return;
    events = Array.isArray(events) ? events : [];
    if (!events.length) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">予定はありません</p>';
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
    const root = host.closest("[data-ops-secretary-calendar-panel]");
    const detailHost = root?.querySelector("[data-ops-secretary-calendar-detail]");
    host.querySelectorAll("[data-calendar-event-id]").forEach((card) => {
      if (card.dataset.bound === "1") return;
      card.dataset.bound = "1";
      const open = () => {
        const eventId = card.getAttribute("data-calendar-event-id");
        const calendarId = card.getAttribute("data-calendar-id") || "primary";
        const cached = (host.__events || []).find((e) => e.id === eventId);
        if (cached) {
          renderDetail(detailHost, cached, root);
          return;
        }
        void Client?.getEvent?.(calendarId, eventId).then((res) => {
          if (res?.ok && res.data?.event) renderDetail(detailHost, res.data.event, root);
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
    if (status) {
      status.dataset.baseLabel = label || "Calendar";
      status.textContent = `${label || "読込中"}…`;
    }
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
    if (status) {
      status.dataset.baseLabel = `${label || "Calendar"} ${events.length} 件${mock}`;
      renderStatusBadge(root);
    }
  }

  async function loadSearch(root, q) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const host = $(root, "[data-ops-secretary-calendar-cards]");
    const status = $(root, "[data-ops-secretary-calendar-status]");
    if (!Client?.listEvents || !host) return;
    if (status) status.dataset.baseLabel = `検索 ${q.slice(0, 24)}`;
    host.innerHTML = '<p class="ops-secretary-gmail__empty">読込中…</p>';
    const result = await Client.listEvents({ preset: "next_7_days", q, maxResults: 25 });
    if (!result.ok) {
      host.innerHTML = '<p class="ops-secretary-gmail__empty">検索できませんでした</p>';
      return;
    }
    const events = result.data?.events || [];
    host.__events = events;
    renderCards(host, events);
    renderStatusBadge(root);
  }

  async function handleCreate(root) {
    const Client = global.TasuSecretaryGoogleCalendarClient;
    const input = $(root, "[data-ops-secretary-calendar-create-input]");
    const text = String(input?.value || "").trim();
    if (!text) return;
    const parsed = await Client.parseEventIntent(text, {});
    if (!parsed.ok || !parsed.fields) return;
    const fields = {
      calendarId: "primary",
      title: parsed.fields.title,
      start: parsed.fields.start,
      end: parsed.fields.end,
      allDay: parsed.fields.allDay,
      location: parsed.fields.location,
      description: parsed.fields.description,
      attendees: parsed.fields.attendees,
    };
    startHumanGate(root, "create", fields);
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
    const createBtn = $(root, "[data-ops-secretary-calendar-create-btn]");
    if (createBtn && createBtn.dataset.bound !== "1") {
      createBtn.dataset.bound = "1";
      createBtn.addEventListener("click", () => void handleCreate(root));
    }
    const createForm = $(root, "[data-ops-secretary-calendar-create-form]");
    if (createForm && createForm.dataset.bound !== "1") {
      createForm.dataset.bound = "1";
      createForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        void handleCreate(root);
      });
    }
  }

  function bindTabs(root) {
    const workspace = document.querySelector("[data-ops-secretary-google-workspace]");
    if (!workspace || workspace.dataset.tabsBound === "1") return;
    workspace.dataset.tabsBound = "1";
    const mailPanel = workspace.querySelector("[data-ops-secretary-gmail-panel]");
    const calPanel = workspace.querySelector("[data-ops-secretary-calendar-panel]");
    const contactsPanel = workspace.querySelector("[data-ops-secretary-contacts-panel]");
    const drivePanel = workspace.querySelector("[data-ops-secretary-drive-panel]");
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
        if (contactsPanel) contactsPanel.hidden = target !== "contacts";
        if (drivePanel) drivePanel.hidden = target !== "drive";
      });
    });
  }

  function mount(root) {
    root = root || document.querySelector("[data-ops-secretary-calendar-panel]");
    if (!root || mounted) return;
    mounted = true;
    bindTabs(root);
    bindPresets(root);
    global.addEventListener("tasu:admin-ai-human-send-gate-updated", () => renderConfirmPanel(root));
    void loadPreset(root, global.TasuSecretaryGoogleCalendarClient?.PRESETS?.today, "今日の予定");
  }

  global.TasuSecretaryGoogleCalendarUI = {
    mount,
    loadPreset,
    loadSearch,
    renderCards,
    renderDetail,
    STATE_LABELS,
  };
})(typeof window !== "undefined" ? window : globalThis);
