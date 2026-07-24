/**
 * Builder Project Calendar — Phase 6-B / P0-8 / Phase 2–3
 */
(function (global) {
  "use strict";

  const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const WEEKDAYS_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
  const TRANSITION_MS = 150;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDateJa(dateStr) {
    const Store = global.TasuBuilderProjectStore;
    const d = Store?.parseDateOnly?.(dateStr);
    if (!d) return dateStr || "—";
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  }

  function detailUrl(projectId) {
    return `project-detail.html?id=${encodeURIComponent(projectId)}`;
  }

  /** PC: month | week（将来 day 等も可） */
  let desktopViewMode = "month";
  /**
   * スマホ: agenda | month（将来 week / day3 / day1 等を追加可能）
   * デフォルトは一覧（agenda）
   */
  let mobileViewMode = "agenda";
  let anchorDate = new Date();
  /** @type {string} YYYY-MM-DD */
  let selectedDate = "";
  /** @type {string} project id */
  let selectedProject = "";
  /** スマホ一覧のスクロール位置（一覧⇔月切替で保持） */
  let agendaScrollY = 0;
  let scrollTodayPending = false;
  /** スマホ一覧 Accordion（一覧⇔月切替後も保持） */
  const accordionState = {
    today: true,
    week: false,
    delayed: false,
  };
  /** main | attachments | photos | completion */
  let detailViewMode = "main";
  /** スマホ詳細シート表示 */
  let mobileDetailOpen = false;
  const COMPLETION_DRAFT_KEY = "tasu_builder_cal_completion_draft_v1";

  function getStore() {
    return global.TasuBuilderProjectStore;
  }

  function isMobileCal() {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches;
  }

  function getViewMode() {
    return isMobileCal() ? mobileViewMode : desktopViewMode;
  }

  function setViewMode(mode) {
    const next = String(mode || "").trim();
    if (isMobileCal()) {
      if (next === "agenda" || next === "month") {
        if (mobileViewMode === "agenda" && next === "month") saveAgendaScroll();
        mobileViewMode = next;
      }
    } else if (next === "month" || next === "week") {
      desktopViewMode = next;
    }
  }

  function saveAgendaScroll() {
    if (!isMobileCal() || mobileViewMode !== "agenda") return;
    agendaScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  }

  function restoreAgendaScroll() {
    if (!isMobileCal() || mobileViewMode !== "agenda") return;
    const y = agendaScrollY;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }

  function syncViewTabs() {
    const mobile = isMobileCal();
    const active = getViewMode();
    document.querySelectorAll("[data-builder-pc-view]").forEach((btn) => {
      const mode = btn.getAttribute("data-builder-pc-view") || "";
      const on = mode === active;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.body.classList.toggle("builder-pc-is-mobile", mobile);
    document.body.dataset.builderPcView = active;
  }

  function setAnchor(d) {
    anchorDate = new Date(d);
    anchorDate.setHours(12, 0, 0, 0);
  }

  function monthLabel(d) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }

  function weekLabel(Store) {
    const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
    return `${formatDateJa(range.start)} – ${formatDateJa(range.end)}`;
  }

  /**
   * 状態カラー統一:
   * 未開始=orange / 作業中=cyan / 完了=green / 遅延=magenta / キャンセル=gray
   */
  function projectStatusMeta(p, Store) {
    const st = String(p?.status || "").toLowerCase();
    if (st === "cancelled" || st === "canceled") {
      return { text: "キャンセル", tone: "cancelled" };
    }
    if (Store?.isDelayedProject?.(p)) {
      return { text: "遅延", tone: "delay" };
    }
    if (st === "completed") {
      return { text: "完了", tone: "done" };
    }
    if (st === "in_progress" || st === "working") {
      return { text: "作業中", tone: "working" };
    }
    const cs = String(p?.completion?.completionStatus || "").toLowerCase();
    if (cs === "completed" || cs === "handed_over") {
      return { text: "完了", tone: "done" };
    }
    if (cs === "working" || cs === "inspection") {
      return { text: "作業中", tone: "working" };
    }
    return { text: "未開始", tone: "not_started" };
  }

  function statusLabel(p, Store) {
    return projectStatusMeta(p, Store);
  }

  function accentTone(p, Store) {
    return projectStatusMeta(p, Store).tone;
  }

  function eventAccentClass(p, Store) {
    return `builder-pc-event--${projectStatusMeta(p, Store).tone}`;
  }

  function countBadgeLabel(count) {
    if (count <= 0) return "";
    if (count >= 3) return "3+";
    return String(count);
  }

  function ensureSelectedDate(Store) {
    if (!Store) return;
    const today = Store.todayDateOnly();
    const projects = Store.listScheduledProjects();
    if (!selectedDate) selectedDate = today;
    if (!isMobileCal() && desktopViewMode === "week") {
      const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
      if (selectedDate < range.start || selectedDate > range.end) {
        selectedDate = range.start;
      }
      syncSelectedProjectForDate(Store, projects);
      return;
    }
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const sel = Store.parseDateOnly(selectedDate);
    if (!sel || sel.getFullYear() !== y || sel.getMonth() !== m) {
      const dayNum = sel ? sel.getDate() : 1;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const clamped = Math.min(dayNum, lastDay);
      selectedDate = Store.toDateOnlyString(new Date(y, m, clamped, 12, 0, 0, 0));
    }
    syncSelectedProjectForDate(Store, projects);
  }

  function syncSelectedProjectForDate(Store, projects) {
    const list = projects || Store.listScheduledProjects();
    const dayProjects = projectsForDay(selectedDate, list);
    if (selectedProject && dayProjects.some((p) => p.id === selectedProject)) return;
    selectedProject = dayProjects[0]?.id || "";
  }

  function resolveDateForProject(p, Store) {
    const today = Store.todayDateOnly();
    if (Store.isDateInRange(today, p.scheduleStartDate, p.scheduleEndDate)) return today;
    if (selectedDate && Store.isDateInRange(selectedDate, p.scheduleStartDate, p.scheduleEndDate)) {
      return selectedDate;
    }
    return p.scheduleStartDate || today;
  }

  /** 共通選択: 日付（月セル・一覧日付） */
  function selectDate(dateStr, opts) {
    const Store = getStore();
    if (!Store || !dateStr) return;
    const options = opts || {};
    selectedDate = dateStr;
    const d = Store.parseDateOnly(dateStr);
    if (d) setAnchor(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));
    const dayProjects = projectsForDay(dateStr, Store.listScheduledProjects());
    if (options.projectId && dayProjects.some((p) => p.id === options.projectId)) {
      selectedProject = options.projectId;
    } else if (!dayProjects.some((p) => p.id === selectedProject)) {
      selectedProject = dayProjects[0]?.id || "";
    }
    // スマホ: 月表示のまま（一覧へ勝手に切り替えない）
    refresh({ restoreAgenda: options.restoreAgenda });
  }

  /** 共通選択: 案件カード・月セル内イベント・一覧ブロック */
  function selectProject(projectId, opts) {
    const Store = getStore();
    if (!Store || !projectId) return;
    const p = Store.getProject?.(projectId) || Store.listScheduledProjects?.().find((x) => x.id === projectId);
    if (!p) return;
    selectedProject = projectId;
    selectedDate = resolveDateForProject(p, Store);
    const d = Store.parseDateOnly(selectedDate);
    if (d) setAnchor(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));
    detailViewMode = "main";
    // スマホ: 現在の view（一覧/月）を維持し、詳細シートを開く
    if (isMobileCal()) mobileDetailOpen = true;
    refresh(opts);
  }

  /** 作業時間（フィールドがあれば優先、なければ現場標準の表示） */
  function workTimeLabel(p) {
    const start = String(p.workStartTime || p.startTime || "").trim();
    const end = String(p.workEndTime || p.endTime || "").trim();
    if (start && end) return `${start}〜${end}`;
    if (start) return start;
    return "09:00〜17:00";
  }

  function companyLabel(p) {
    const vendor = String(p.assignedVendor || "").trim();
    if (vendor && vendor !== "（未アサイン）") return vendor;
    return String(p.customerName || "").trim() || "—";
  }

  /**
   * PC左カラム / スマホ一覧共通の案件行
   * 優先: 作業時間 → 案件名 → ステータス → 会社 → 工期(補助)
   */
  function buildMiniListHtml(projects, Store, emptyText) {
    if (!projects.length) {
      return `<li class="builder-pc-mini-list__item builder-pc-mini-list__item--empty"><span class="builder-pc-mini-list__meta">${escapeHtml(emptyText)}</span></li>`;
    }
    return projects
      .map((p) => {
        const st = statusLabel(p, Store);
        const tone = accentTone(p, Store);
        const range = `${formatDateJa(p.scheduleStartDate)} → ${formatDateJa(p.scheduleEndDate)}`;
        const selected = p.id === selectedProject ? " is-selected" : "";
        return (
          `<li class="builder-pc-mini-list__item builder-pc-mini-list__item--${tone}${selected}" data-builder-pc-project="${escapeHtml(p.id)}">` +
          `<span class="builder-pc-mini-list__accent" aria-hidden="true"></span>` +
          `<button type="button" class="builder-pc-mini-list__body" data-builder-pc-project="${escapeHtml(p.id)}">` +
          `<span class="builder-pc-mini-list__name">${escapeHtml(p.name)}</span>` +
          `<span class="builder-pc-mini-list__status builder-pc-status builder-pc-status--${st.tone}">${escapeHtml(st.text)}</span>` +
          `<span class="builder-pc-mini-list__company">${escapeHtml(companyLabel(p))}</span>` +
          `<span class="builder-pc-mini-list__time">${escapeHtml(workTimeLabel(p))}</span>` +
          `<span class="builder-pc-mini-list__meta">${escapeHtml(range)}${st.tone === "delay" ? " · 遅延" : ""}</span>` +
          `</button>` +
          `</li>`
        );
      })
      .join("");
  }

  function buildWidgetSectionHtml(title, ariaLabel, projects, Store, emptyText, extraClass) {
    const cls = ["builder-pc-widget", extraClass].filter(Boolean).join(" ");
    return (
      `<section class="${cls}" aria-label="${escapeHtml(ariaLabel)}">` +
      `<h2 class="builder-pc-widget__title">${escapeHtml(title)}</h2>` +
      `<ul class="builder-pc-mini-list">${buildMiniListHtml(projects, Store, emptyText)}</ul>` +
      `</section>`
    );
  }

  /** スマホ一覧 Accordion セクション */
  function buildAccordionSectionHtml(key, title, projects, Store, emptyText, extraClass) {
    const open = Boolean(accordionState[key]);
    const marker = open ? "▼" : "▶";
    const cls = ["builder-pc-widget", "builder-pc-accordion", open ? "is-open" : "", extraClass]
      .filter(Boolean)
      .join(" ");
    return (
      `<section class="${cls}" data-builder-pc-accordion="${escapeHtml(key)}" aria-label="${escapeHtml(title)}">` +
      `<button type="button" class="builder-pc-accordion__toggle" data-builder-pc-accordion-toggle="${escapeHtml(key)}" aria-expanded="${open ? "true" : "false"}">` +
      `<span class="builder-pc-accordion__marker" aria-hidden="true">${marker}</span>` +
      `<span class="builder-pc-accordion__title">${escapeHtml(title)}</span>` +
      `<span class="builder-pc-accordion__count">${projects.length}</span>` +
      `</button>` +
      `<div class="builder-pc-accordion__panel">` +
      `<div class="builder-pc-accordion__panelInner">` +
      `<ul class="builder-pc-mini-list">${buildMiniListHtml(projects, Store, emptyText)}</ul>` +
      `</div>` +
      `</div>` +
      `</section>`
    );
  }

  function bindAccordion(root) {
    (root || document).querySelectorAll("[data-builder-pc-accordion-toggle]").forEach((btn) => {
      if (btn.dataset.boundAccordion === "1") return;
      btn.dataset.boundAccordion = "1";
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-builder-pc-accordion-toggle") || "";
        if (!key || !(key in accordionState)) return;
        accordionState[key] = !accordionState[key];
        const open = accordionState[key];
        const section = btn.closest("[data-builder-pc-accordion]");
        section?.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        const marker = btn.querySelector(".builder-pc-accordion__marker");
        if (marker) marker.textContent = open ? "▼" : "▶";
      });
    });
  }

  function bindProjectSelect(root) {
    (root || document).querySelectorAll("[data-builder-pc-project]").forEach((el) => {
      if (el.dataset.boundSelect === "1") return;
      el.dataset.boundSelect = "1";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = el.getAttribute("data-builder-pc-project") || "";
        if (id) selectProject(id);
      });
    });
  }

  function renderMiniList(listEl, projects, emptyText) {
    if (!listEl) return;
    listEl.innerHTML = buildMiniListHtml(projects, getStore(), emptyText);
    bindProjectSelect(listEl);
  }

  function renderWidgets() {
    if (isMobileCal()) return;
    const Store = getStore();
    if (!Store) return;
    Store.ensureSeed?.();
    renderMiniList($("[data-builder-pc-today]"), Store.getTodayProjects(), "本日の予定案件はありません");
    renderMiniList($("[data-builder-pc-week]"), Store.getThisWeekProjects(), "今週の予定案件はありません");
    renderMiniList($("[data-builder-pc-delayed]"), Store.getDelayedProjects(), "遅延案件はありません");
  }

  function renderDetailSummary(Store) {
    const todayCount = Store.getTodayProjects().length;
    const weekCount = Store.getThisWeekProjects().length;
    const delayedCount = Store.getDelayedProjects().length;
    return (
      `<div class="builder-pc-detail__summary builder-pc-fade" data-builder-pc-detail-summary>` +
      `<h3 class="builder-pc-detail__summaryTitle">案件詳細</h3>` +
      `<ul class="builder-pc-detail__summaryList">` +
      `<li class="builder-pc-detail__summaryItem"><span class="builder-pc-detail__summaryLabel">今日の案件</span><strong class="builder-pc-detail__summaryValue" data-builder-pc-summary-today>${todayCount}件</strong></li>` +
      `<li class="builder-pc-detail__summaryItem"><span class="builder-pc-detail__summaryLabel">今週の案件</span><strong class="builder-pc-detail__summaryValue" data-builder-pc-summary-week>${weekCount}件</strong></li>` +
      `<li class="builder-pc-detail__summaryItem builder-pc-detail__summaryItem--delay"><span class="builder-pc-detail__summaryLabel">遅延案件</span><strong class="builder-pc-detail__summaryValue" data-builder-pc-summary-delayed>${delayedCount}件</strong></li>` +
      `</ul>` +
      `<p class="builder-pc-detail__summaryHint">案件を選択すると詳細情報を表示します</p>` +
      `</div>`
    );
  }

  function siteAddressOf(p) {
    return String(p.siteAddress || p.estimate?.customerAddress || "").trim();
  }

  function managerNameOf(p) {
    return String(p.managerName || p.assignedVendor || p.customerName || "—").trim() || "—";
  }

  function managerPhoneOf(p) {
    return String(p.managerPhone || p.customerContact || "").trim();
  }

  function mapsSearchUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
  }

  function mapsDirectionsUrl(address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || "")}`;
  }

  function telHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : "";
  }

  function talkRoomIdOf(p) {
    return String(p?.talkRoomId || p?.talkThreadId || "").trim();
  }

  /** Talk から戻る先（サイトルート相対） */
  function calendarReturnTo(projectId) {
    const sp = new URLSearchParams();
    sp.set("projectId", projectId);
    sp.set("openDetail", "1");
    return `builder/project-calendar.html?${sp.toString()}`;
  }

  /**
   * 表示用 href（正本 room がある場合のみ chat-detail。未確保時は #）
   * 実遷移は openTalkForProject が ensure 後に行う。
   */
  function messageHref(p) {
    const Talk = global.TasuBuilderProjectTalkRoom;
    const projectId = String(p?.id || "").trim();
    const tid = talkRoomIdOf(p);
    if (Talk?.isStableTalkRoomId?.(tid) || Talk?.isCanonicalTalkRoomId?.(tid)) {
      return Talk.buildTalkHref(projectId, tid, { baseHref: "../chat-detail.html" });
    }
    return `#builder-talk-${encodeURIComponent(projectId)}`;
  }

  async function openTalkForProject(projectId) {
    const pid = String(projectId || selectedProject || "").trim();
    if (!pid) return { ok: false, reason: "missing_project" };
    const Talk = global.TasuBuilderProjectTalkRoom;
    let roomId = "";
    if (Talk?.ensureTalkRoomForProject) {
      const ensured = await Talk.ensureTalkRoomForProject(pid);
      if (ensured?.ok && ensured.roomId) roomId = ensured.roomId;
    }
    if (!roomId) {
      const p = getStore()?.getProject?.(pid);
      roomId = talkRoomIdOf(p);
    }
    if (!roomId) return { ok: false, reason: "no_room" };
    const href =
      Talk?.buildTalkHref?.(pid, roomId, { baseHref: "../chat-detail.html" }) ||
      `../chat-detail.html?thread=${encodeURIComponent(roomId)}&from=builder_calendar&projectId=${encodeURIComponent(pid)}&returnTo=${encodeURIComponent(calendarReturnTo(pid))}`;
    global.location.href = href;
    return { ok: true, roomId, href };
  }

  function restoreFromUrl() {
    try {
      const sp = new URLSearchParams(global.location.search);
      const projectId = String(sp.get("projectId") || sp.get("builderProjectId") || "").trim();
      if (!projectId) return false;
      const Store = getStore();
      Store?.ensureSeed?.();
      // remote cache に無くても localStorage を含めて探す（Talk 戻り用）
      const project =
        Store?.getProject?.(projectId) ||
        (Store?.listProjectsLocal?.() || []).find((x) => x.id === projectId);
      if (!project) return false;
      selectedProject = projectId;
      selectedDate = resolveDateForProject(project, Store);
      const d = Store.parseDateOnly?.(selectedDate);
      if (d) setAnchor(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));
      detailViewMode = "main";
      if (isMobileCal()) mobileDetailOpen = sp.get("openDetail") !== "0";
      refresh();
      return true;
    } catch {
      return false;
    }
  }

  function activeDocuments(p) {
    return (p.documents || []).filter((d) => d && d.status !== "archived" && d.status !== "deleted");
  }

  function sitePhotosOf(p) {
    if (Array.isArray(p.sitePhotos) && p.sitePhotos.length) return p.sitePhotos;
    return p.completion?.photos || [];
  }

  function readCompletionDraft(projectId) {
    try {
      const all = JSON.parse(localStorage.getItem(COMPLETION_DRAFT_KEY) || "{}");
      return all[projectId] || null;
    } catch {
      return null;
    }
  }

  function writeCompletionDraft(projectId, draft) {
    try {
      const all = JSON.parse(localStorage.getItem(COMPLETION_DRAFT_KEY) || "{}");
      all[projectId] = draft;
      localStorage.setItem(COMPLETION_DRAFT_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }

  function buildDetailActionsHtml(p) {
    const address = siteAddressOf(p);
    const phone = managerPhoneOf(p);
    const mapUrl = address ? mapsSearchUrl(address) : "";
    const navUrl = address ? mapsDirectionsUrl(address) : "";
    const tel = telHref(phone);
    const msg = messageHref(p);
    const disabledMap = address ? "" : " disabled aria-disabled=\"true\"";
    const disabledTel = tel ? "" : " disabled aria-disabled=\"true\"";
    return (
      `<div class="builder-pc-actions" data-builder-pc-actions>` +
      (mapUrl
        ? `<a class="builder-pc-actionBtn" data-builder-pc-action="map" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">GoogleMapで開く</a>`
        : `<button type="button" class="builder-pc-actionBtn" data-builder-pc-action="map"${disabledMap}>GoogleMapで開く</button>`) +
      (navUrl
        ? `<a class="builder-pc-actionBtn" data-builder-pc-action="nav" href="${escapeHtml(navUrl)}" target="_blank" rel="noopener noreferrer">ナビ開始</a>`
        : `<button type="button" class="builder-pc-actionBtn" data-builder-pc-action="nav"${disabledMap}>ナビ開始</button>`) +
      (tel
        ? `<a class="builder-pc-actionBtn" data-builder-pc-action="tel" href="${escapeHtml(tel)}">電話する</a>`
        : `<button type="button" class="builder-pc-actionBtn" data-builder-pc-action="tel"${disabledTel}>電話する</button>`) +
      `<a class="builder-pc-actionBtn" data-builder-pc-action="message" data-builder-pc-open-talk="${escapeHtml(p.id)}" href="${escapeHtml(msg)}">メッセージ</a>` +
      `<button type="button" class="builder-pc-actionBtn" data-builder-pc-action="attachments" data-builder-pc-detail-nav="attachments">添付を見る</button>` +
      `<button type="button" class="builder-pc-actionBtn" data-builder-pc-action="photos" data-builder-pc-detail-nav="photos">現場写真</button>` +
      `<button type="button" class="builder-pc-actionBtn builder-pc-actionBtn--primary" data-builder-pc-action="completion" data-builder-pc-detail-nav="completion">完了報告</button>` +
      `</div>`
    );
  }

  function buildDetailMainHtml(p, Store) {
    const st = statusLabel(p, Store);
    const range = `${formatDateJa(p.scheduleStartDate)} → ${formatDateJa(p.scheduleEndDate)}`;
    const phase = p.schedulePhaseLabel || "—";
    const address = siteAddressOf(p) || "—";
    const phone = managerPhoneOf(p) || "—";
    const memo = String(p.memo || "").trim() || "—";
    const docs = activeDocuments(p);
    const photos = sitePhotosOf(p);
    return (
      `<div class="builder-pc-detail__inner builder-pc-fade" data-builder-pc-detail-main>` +
      `<p class="builder-pc-detail__date">${escapeHtml(formatDayHeading(selectedDate, Store))}</p>` +
      `<h3 class="builder-pc-detail__title">${escapeHtml(p.name)}</h3>` +
      `<span class="builder-pc-detail__status builder-pc-status builder-pc-status--${st.tone}">${escapeHtml(st.text)}</span>` +
      `<dl class="builder-pc-detail__meta">` +
      `<div><dt>会社 / 顧客</dt><dd>${escapeHtml(companyLabel(p))}</dd></div>` +
      `<div><dt>工程</dt><dd>${escapeHtml(phase)}</dd></div>` +
      `<div><dt>日程</dt><dd>${escapeHtml(range)}</dd></div>` +
      `<div><dt>作業時間</dt><dd>${escapeHtml(workTimeLabel(p))}</dd></div>` +
      `<div><dt>現場住所</dt><dd data-builder-pc-field="address">${escapeHtml(address)}</dd></div>` +
      `<div><dt>担当者名</dt><dd data-builder-pc-field="manager">${escapeHtml(managerNameOf(p))}</dd></div>` +
      `<div><dt>電話番号</dt><dd data-builder-pc-field="phone">${escapeHtml(phone)}</dd></div>` +
      `<div><dt>メモ</dt><dd data-builder-pc-field="memo">${escapeHtml(memo)}</dd></div>` +
      `<div><dt>添付</dt><dd>${docs.length ? `${docs.length}件` : "なし"} · <button type="button" class="builder-pc-detail__inlineLink" data-builder-pc-detail-nav="attachments">添付を見る</button></dd></div>` +
      `<div><dt>現場写真</dt><dd>${photos.length ? `${photos.length}件` : "なし"} · <button type="button" class="builder-pc-detail__inlineLink" data-builder-pc-detail-nav="photos">現場写真</button></dd></div>` +
      `<div><dt>完了報告</dt><dd><button type="button" class="builder-pc-detail__inlineLink" data-builder-pc-detail-nav="completion">完了報告を開く</button></dd></div>` +
      `</dl>` +
      buildDetailActionsHtml(p) +
      `<a class="builder-pc-detail__link" href="${detailUrl(p.id)}">案件詳細ページを開く</a>` +
      `</div>`
    );
  }

  function buildAttachmentsHtml(p) {
    const docs = activeDocuments(p);
    let list = "";
    if (!docs.length) {
      list = `<p class="builder-pc-detail__emptyNote" data-builder-pc-attachments-empty>添付はありません</p>`;
    } else {
      list =
        `<ul class="builder-pc-detail__list" data-builder-pc-attachments-list>` +
        docs
          .map(
            (d) =>
              `<li class="builder-pc-detail__listItem">` +
              `<span class="builder-pc-detail__listTitle">${escapeHtml(d.title || d.filename || "添付")}</span>` +
              `<span class="builder-pc-detail__listMeta">${escapeHtml(d.typeLabel || d.type || "")}${d.filename ? ` · ${escapeHtml(d.filename)}` : ""}</span>` +
              `</li>`,
          )
          .join("") +
        `</ul>`;
    }
    return (
      `<div class="builder-pc-detail__sub builder-pc-fade" data-builder-pc-detail-attachments>` +
      `<div class="builder-pc-detail__subHead">` +
      `<button type="button" class="builder-pc-detail__back" data-builder-pc-detail-nav="main">‹ 戻る</button>` +
      `<h3 class="builder-pc-detail__subTitle">添付一覧</h3>` +
      `</div>` +
      list +
      `</div>`
    );
  }

  function buildPhotosHtml(p) {
    const photos = sitePhotosOf(p);
    let list = "";
    if (!photos.length) {
      list = `<p class="builder-pc-detail__emptyNote" data-builder-pc-photos-empty>現場写真はまだありません</p>`;
    } else {
      list =
        `<ul class="builder-pc-detail__list" data-builder-pc-photos-list>` +
        photos
          .map(
            (ph) =>
              `<li class="builder-pc-detail__listItem builder-pc-detail__listItem--photo">` +
              `<span class="builder-pc-detail__photoThumb" aria-hidden="true"></span>` +
              `<span class="builder-pc-detail__listTitle">${escapeHtml(ph.label || "現場写真")}</span>` +
              `<span class="builder-pc-detail__listMeta">${escapeHtml(ph.at || "—")}</span>` +
              `</li>`,
          )
          .join("") +
        `</ul>`;
    }
    return (
      `<div class="builder-pc-detail__sub builder-pc-fade" data-builder-pc-detail-photos>` +
      `<div class="builder-pc-detail__subHead">` +
      `<button type="button" class="builder-pc-detail__back" data-builder-pc-detail-nav="main">‹ 戻る</button>` +
      `<h3 class="builder-pc-detail__subTitle">現場写真</h3>` +
      `</div>` +
      list +
      `</div>`
    );
  }

  function buildCompletionHtml(p) {
    const draft = readCompletionDraft(p.id);
    const memo = draft?.memo || p.completion?.completionMemo || "";
    const status = draft?.completionStatus || p.completion?.completionStatus || "working";
    return (
      `<div class="builder-pc-detail__sub builder-pc-fade" data-builder-pc-detail-completion>` +
      `<div class="builder-pc-detail__subHead">` +
      `<button type="button" class="builder-pc-detail__back" data-builder-pc-detail-nav="main">‹ 戻る</button>` +
      `<h3 class="builder-pc-detail__subTitle">完了報告</h3>` +
      `</div>` +
      `<form class="builder-pc-completionForm" data-builder-pc-completion-form data-project-id="${escapeHtml(p.id)}">` +
      `<label class="builder-pc-completionForm__label">ステータス` +
      `<select class="builder-pc-completionForm__input" name="completionStatus" data-builder-pc-completion-status>` +
      `<option value="working"${status === "working" ? " selected" : ""}>作業中</option>` +
      `<option value="inspection"${status === "inspection" ? " selected" : ""}>検査中</option>` +
      `<option value="completed"${status === "completed" ? " selected" : ""}>完了</option>` +
      `<option value="handed_over"${status === "handed_over" ? " selected" : ""}>引渡し済</option>` +
      `</select></label>` +
      `<label class="builder-pc-completionForm__label">報告メモ` +
      `<textarea class="builder-pc-completionForm__input builder-pc-completionForm__textarea" name="memo" data-builder-pc-completion-memo rows="4" placeholder="完了内容・残作業など">${escapeHtml(memo)}</textarea></label>` +
      `<p class="builder-pc-completionForm__note">Demo / localStorage に保存します（本番同期なし）</p>` +
      `<button type="submit" class="builder-pc-actionBtn builder-pc-actionBtn--primary" data-builder-pc-completion-submit>報告を保存</button>` +
      `<p class="builder-pc-completionForm__msg" data-builder-pc-completion-msg hidden></p>` +
      `</form>` +
      `</div>`
    );
  }

  function buildProjectDetailHtml(p, Store) {
    if (detailViewMode === "attachments") return buildAttachmentsHtml(p);
    if (detailViewMode === "photos") return buildPhotosHtml(p);
    if (detailViewMode === "completion") return buildCompletionHtml(p);
    return buildDetailMainHtml(p, Store);
  }

  function bindDetailInteractions(root) {
    if (!root) return;
    root.querySelectorAll("[data-builder-pc-detail-nav]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const mode = btn.getAttribute("data-builder-pc-detail-nav") || "main";
        detailViewMode = mode;
        renderDetailPanel();
      });
    });
    root.querySelectorAll("[data-builder-pc-open-talk], [data-builder-pc-action='message']").forEach((el) => {
      if (el.dataset.boundTalk === "1") return;
      el.dataset.boundTalk = "1";
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const pid =
          el.getAttribute("data-builder-pc-open-talk") ||
          selectedProject ||
          "";
        el.setAttribute("aria-busy", "true");
        openTalkForProject(pid).finally(() => {
          el.removeAttribute("aria-busy");
        });
      });
    });
    const form = root.querySelector("[data-builder-pc-completion-form]");
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const projectId = form.getAttribute("data-project-id") || selectedProject;
      const statusEl = form.querySelector("[data-builder-pc-completion-status]");
      const memoEl = form.querySelector("[data-builder-pc-completion-memo]");
      const msgEl = form.querySelector("[data-builder-pc-completion-msg]");
      const completionStatus = statusEl?.value || "completed";
      const memo = String(memoEl?.value || "").trim();
      const draft = {
        completionStatus,
        memo,
        savedAt: new Date().toISOString(),
      };
      writeCompletionDraft(projectId, draft);
      const Store = getStore();
      Store?.updateCompletion?.(projectId, {
        completionStatus,
        completionMemo: memo,
        completionReason: memo || "カレンダーから完了報告",
      });
      if (msgEl) {
        msgEl.hidden = false;
        msgEl.textContent = "完了報告を保存しました（Demo）";
      }
    });
  }

  function ensureMobileDetailHost() {
    let host = $("[data-builder-pc-mobile-detail]");
    if (host) return host;
    host = document.createElement("div");
    host.className = "builder-pc-sheet";
    host.setAttribute("data-builder-pc-mobile-detail", "");
    host.hidden = true;
    host.innerHTML =
      `<div class="builder-pc-sheet__backdrop" data-builder-pc-sheet-close tabindex="-1"></div>` +
      `<div class="builder-pc-sheet__panel" role="dialog" aria-modal="true" aria-label="案件詳細">` +
      `<div class="builder-pc-sheet__head">` +
      `<h2 class="builder-pc-sheet__title">案件詳細</h2>` +
      `<button type="button" class="builder-pc-sheet__close" data-builder-pc-sheet-close aria-label="閉じる">×</button>` +
      `</div>` +
      `<div class="builder-pc-sheet__body" data-builder-pc-mobile-detail-body></div>` +
      `</div>`;
    document.body.appendChild(host);
    host.querySelectorAll("[data-builder-pc-sheet-close]").forEach((el) => {
      el.addEventListener("click", () => {
        mobileDetailOpen = false;
        detailViewMode = "main";
        renderDetailPanel();
      });
    });
    return host;
  }

  function renderDetailPanel() {
    const Store = getStore();
    if (!Store) return;
    const projects = Store.listScheduledProjects();
    const p = projects.find((x) => x.id === selectedProject);

    const pcHost = $("[data-builder-pc-detail]");
    if (pcHost) {
      if (isMobileCal()) {
        pcHost.hidden = true;
      } else {
        pcHost.hidden = false;
        if (!p) {
          detailViewMode = "main";
          pcHost.innerHTML = renderDetailSummary(Store);
        } else {
          pcHost.innerHTML = buildProjectDetailHtml(p, Store);
          bindDetailInteractions(pcHost);
        }
      }
    }

    const sheet = ensureMobileDetailHost();
    const body = sheet.querySelector("[data-builder-pc-mobile-detail-body]");
    if (!isMobileCal()) {
      sheet.hidden = true;
      mobileDetailOpen = false;
      document.body.classList.remove("builder-pc-sheet-open");
      return;
    }
    if (!mobileDetailOpen || !p) {
      sheet.hidden = true;
      document.body.classList.remove("builder-pc-sheet-open");
      if (body) body.innerHTML = "";
      return;
    }
    sheet.hidden = false;
    document.body.classList.add("builder-pc-sheet-open");
    if (body) {
      body.innerHTML = buildProjectDetailHtml(p, Store);
      bindDetailInteractions(body);
    }
  }

  function projectsForDay(dateStr, projects) {
    const Store = getStore();
    return projects.filter((p) => Store.isDateInRange(dateStr, p.scheduleStartDate, p.scheduleEndDate));
  }

  function maxEventsPerDay() {
    if (typeof window.matchMedia !== "function") return 3;
    if (window.matchMedia("(max-width: 390px)").matches) return 1;
    if (window.matchMedia("(max-width: 768px)").matches) return 2;
    return 3;
  }

  function renderDayEvents(dayProjects, Store, options) {
    const max = options?.max ?? maxEventsPerDay();
    const showPhase = Boolean(options?.showPhase);
    let html = "";
    dayProjects.slice(0, max).forEach((p) => {
      const accent = eventAccentClass(p, Store);
      const selected = p.id === selectedProject ? " is-selected" : "";
      html +=
        `<button type="button" class="builder-pc-event ${accent}${selected}" data-builder-pc-project="${escapeHtml(p.id)}" title="${escapeHtml(p.name)}">` +
        `${escapeHtml(p.name)}` +
        (showPhase
          ? `<br><span class="builder-pc-mini-list__meta">${escapeHtml(p.schedulePhaseLabel)}</span>`
          : "") +
        `</button>`;
    });
    if (dayProjects.length > max) {
      html += `<span class="builder-pc-event-more">+${dayProjects.length - max}</span>`;
    }
    return html;
  }

  function formatDayHeading(dateStr, Store) {
    const d = Store.parseDateOnly(dateStr);
    if (!d) return dateStr;
    const wd = WEEKDAYS_SHORT[d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
  }

  /** Googleカレンダー風: 時間列 + 色付き予定ブロック */
  function renderAgendaTimeline(dayList, projects, Store) {
    let html = `<div class="builder-pc-agenda" data-builder-pc-agenda data-builder-pc-agenda-scroll>`;
    let any = false;
    dayList.forEach((cell) => {
      const dateStr = Store.toDateOnlyString(cell);
      const dayProjects = projectsForDay(dateStr, projects);
      if (!dayProjects.length && dateStr !== selectedDate) return;
      any = true;
      const isToday = dateStr === Store.todayDateOnly();
      html += `<section class="builder-pc-agendaDay${isToday ? " is-today" : ""}${dateStr === selectedDate ? " is-selected" : ""}" data-agenda-day="${dateStr}">`;
      html += `<button type="button" class="builder-pc-agendaDay__head" data-builder-pc-day="${dateStr}">${escapeHtml(formatDayHeading(dateStr, Store))}</button>`;
      if (!dayProjects.length) {
        const emptyMsg =
          dateStr === Store.todayDateOnly()
            ? "今日の予定はありません"
            : `${formatDayHeading(dateStr, Store)}の予定はありません`;
        html += `<p class="builder-pc-agendaEmpty" data-builder-pc-agenda-empty>${escapeHtml(emptyMsg)}</p>`;
      } else {
        html += `<ul class="builder-pc-agendaList">`;
        dayProjects.forEach((p) => {
          const st = statusLabel(p, Store);
          const company = companyLabel(p);
          const accent = eventAccentClass(p, Store);
          const timeLabel = workTimeLabel(p);
          const range = `${formatDateJa(p.scheduleStartDate)} → ${formatDateJa(p.scheduleEndDate)}`;
          const timeParts = timeLabel.split("〜");
          const timeMain = timeParts[0] || timeLabel;
          const timeSub = timeParts[1] || "";
          const selected = p.id === selectedProject ? " is-selected" : "";
          html +=
            `<li class="builder-pc-agendaItem">` +
            `<div class="builder-pc-agendaItem__time" aria-hidden="true">` +
            `<span class="builder-pc-agendaItem__timeText">${escapeHtml(timeMain)}</span>` +
            (timeSub
              ? `<span class="builder-pc-agendaItem__timeSub">${escapeHtml(timeSub)}</span>`
              : "") +
            `</div>` +
            `<button type="button" class="builder-pc-agendaBlock ${accent}${selected}" data-builder-pc-project="${escapeHtml(p.id)}">` +
            `<span class="builder-pc-agendaBlock__bar" aria-hidden="true"></span>` +
            `<span class="builder-pc-agendaBlock__body">` +
            `<span class="builder-pc-agendaBlock__title">${escapeHtml(p.name)}</span>` +
            `<span class="builder-pc-agendaBlock__status builder-pc-status builder-pc-status--${st.tone}">${escapeHtml(st.text)}</span>` +
            `<span class="builder-pc-agendaBlock__place">${escapeHtml(company)}</span>` +
            `<span class="builder-pc-agendaBlock__period">${escapeHtml(range)}</span>` +
            `</span>` +
            `</button>` +
            `</li>`;
        });
        html += `</ul>`;
      }
      html += `</section>`;
    });
    if (!any) {
      html += `<p class="builder-pc-agendaEmpty">表示できる予定はありません</p>`;
    }
    html += `</div>`;
    return html;
  }

  function pickerDays(Store) {
    const days = [];
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d += 1) {
      days.push(new Date(y, m, d, 12, 0, 0, 0));
    }
    return days;
  }

  function scrollSelectionIntoView() {
    if (!isMobileCal()) {
      const day = document.querySelector(`.builder-pc-day.is-selected, .builder-pc-day[data-builder-pc-month-day="${selectedDate}"]`);
      day?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      return;
    }
    if (mobileViewMode === "agenda") {
      const chip = document.querySelector(".builder-pc-dayChip.is-selected");
      chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: scrollTodayPending ? "smooth" : "auto" });
      const section = document.querySelector(`[data-agenda-day="${selectedDate}"]`);
      section?.scrollIntoView({ block: "nearest", behavior: scrollTodayPending ? "smooth" : "auto" });
    } else {
      const day = document.querySelector(`.builder-pc-day.is-selected`);
      day?.scrollIntoView({ block: "nearest", behavior: scrollTodayPending ? "smooth" : "auto" });
    }
  }

  function renderMobile() {
    const wrap = $("[data-builder-pc-calendar-body]");
    const label = $("[data-builder-pc-period-label]");
    const Store = getStore();
    if (!wrap || !Store) return;

    ensureSelectedDate(Store);
    if (label) label.textContent = monthLabel(anchorDate);

    const projects = Store.listScheduledProjects();
    const today = Store.todayDateOnly();
    const days = pickerDays(Store);

    let pickerHtml = `<div class="builder-pc-dayPicker" data-builder-pc-day-picker role="listbox" aria-label="日付選択">`;
    days.forEach((cell) => {
      const dateStr = Store.toDateOnlyString(cell);
      const count = projectsForDay(dateStr, projects).length;
      const wd = WEEKDAYS_SHORT[cell.getDay()];
      const isSel = dateStr === selectedDate;
      const isToday = dateStr === today;
      const classes = ["builder-pc-dayChip"];
      if (isSel) classes.push("is-selected");
      if (isToday) classes.push("is-today");
      const badge = countBadgeLabel(count);
      pickerHtml +=
        `<button type="button" class="${classes.join(" ")}" role="option" aria-selected="${isSel ? "true" : "false"}" data-builder-pc-day="${dateStr}">` +
        `<span class="builder-pc-dayChip__num">${cell.getDate()}</span>` +
        `<span class="builder-pc-dayChip__wd">${wd}</span>` +
        (badge
          ? `<span class="builder-pc-dayChip__count" aria-label="${count}件">${escapeHtml(badge)}</span>`
          : "") +
        `</button>`;
    });
    pickerHtml += `</div>`;

    const sel = Store.parseDateOnly(selectedDate);
    const agendaDays = sel ? [sel] : days.slice(0, 1);
    const todayProjects = Store.getTodayProjects();
    const weekProjects = Store.getThisWeekProjects();
    const delayedProjects = Store.getDelayedProjects();

    wrap.innerHTML =
      `<div class="builder-pc-mobile builder-pc-fade" data-builder-pc-mobile data-builder-pc-mobile-mode="agenda">` +
      pickerHtml +
      `<div class="builder-pc-agendaWrap" aria-label="選択日の予定">` +
      renderAgendaTimeline(agendaDays, projects, Store) +
      `</div>` +
      `<div class="builder-pc-mobileWidgets" data-builder-pc-mobile-widgets>` +
      buildAccordionSectionHtml(
        "today",
        "今日の案件",
        todayProjects,
        Store,
        "本日の予定案件はありません",
      ) +
      buildAccordionSectionHtml(
        "week",
        "今週の案件",
        weekProjects,
        Store,
        "今週の予定案件はありません",
      ) +
      buildAccordionSectionHtml(
        "delayed",
        "遅延案件",
        delayedProjects,
        Store,
        "遅延案件はありません",
        "builder-pc-widget--delay",
      ) +
      `</div>` +
      `</div>`;

    wrap.querySelectorAll("[data-builder-pc-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dateStr = btn.getAttribute("data-builder-pc-day") || selectedDate;
        selectDate(dateStr);
      });
    });
    bindProjectSelect(wrap);
    bindAccordion(wrap);
  }

  function playViewTransition(wrap) {
    if (!wrap || !isMobileCal()) return;
    wrap.classList.remove("builder-pc-view-enter");
    void wrap.offsetWidth;
    wrap.classList.add("builder-pc-view-enter");
  }

  function renderMonth() {
    const wrap = $("[data-builder-pc-calendar-body]");
    const label = $("[data-builder-pc-period-label]");
    const Store = getStore();
    if (!wrap || !Store) return;

    ensureSelectedDate(Store);
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    if (label) label.textContent = monthLabel(anchorDate);

    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    const projects = Store.listScheduledProjects();
    const today = Store.todayDateOnly();
    const max = maxEventsPerDay();
    let html = '<div class="builder-pc-month builder-pc-fade"><div class="builder-pc-month__head">';
    WEEKDAYS.forEach((w) => {
      html += `<span>${w}</span>`;
    });
    html += '</div><div class="builder-pc-month__grid">';

    for (let i = 0; i < 42; i += 1) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const inMonth = cell.getMonth() === month;
      const dayProjects = projectsForDay(dateStr, projects);
      const count = dayProjects.length;
      const badge = countBadgeLabel(count);
      const classes = ["builder-pc-day"];
      if (!inMonth) classes.push("builder-pc-day--muted");
      if (dateStr === today) classes.push("builder-pc-day--today");
      if (dateStr === selectedDate) classes.push("is-selected");

      html += `<div class="${classes.join(" ")}" data-builder-pc-month-day="${dateStr}" role="button" tabindex="0">`;
      html += `<span class="builder-pc-day__num">${cell.getDate()}</span>`;
      // 件数 Badge は案件がある日のみ（0件は非表示）
      if (count > 0 && badge && inMonth) {
        html += `<span class="builder-pc-day__count" aria-label="${count}件">${escapeHtml(badge)}</span>`;
      }
      html += renderDayEvents(dayProjects, Store, { max: isMobileCal() ? Math.min(max, 2) : max });
      html += "</div>";
    }
    html += "</div></div>";
    wrap.innerHTML = html;
    wrap.querySelectorAll(".builder-pc-day").forEach((day) => {
      day.addEventListener("pointerdown", () => {
        day.classList.add("is-press");
        window.setTimeout(() => day.classList.remove("is-press"), TRANSITION_MS);
      });
      const activate = () => {
        const dateStr = day.getAttribute("data-builder-pc-month-day") || "";
        if (!dateStr || day.classList.contains("builder-pc-day--muted")) return;
        selectDate(dateStr);
      };
      day.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-builder-pc-project]")) return;
        activate();
      });
      day.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          activate();
        }
      });
    });
    bindProjectSelect(wrap);
  }

  function renderWeek() {
    const wrap = $("[data-builder-pc-calendar-body]");
    const label = $("[data-builder-pc-period-label]");
    const Store = getStore();
    if (!wrap || !Store) return;

    ensureSelectedDate(Store);
    const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
    if (label) label.textContent = weekLabel(Store);

    const start = Store.parseDateOnly(range.start);
    const projects = Store.listScheduledProjects();
    const today = Store.todayDateOnly();

    let html = '<div class="builder-pc-week builder-pc-fade">';
    html += '<div class="builder-pc-week__row">';
    for (let i = 0; i < 7; i += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const isToday = dateStr === today;
      const isSel = dateStr === selectedDate;
      html +=
        `<div class="builder-pc-week__cell builder-pc-week__head${isToday ? " builder-pc-day--today" : ""}${isSel ? " is-selected" : ""}" data-builder-pc-month-day="${dateStr}" role="button" tabindex="0">` +
        `${WEEKDAYS[i]}<br>${cell.getMonth() + 1}/${cell.getDate()}` +
        `</div>`;
    }
    html += '</div><div class="builder-pc-week__row">';

    for (let i = 0; i < 7; i += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      const dateStr = Store.toDateOnlyString(cell);
      const dayProjects = projectsForDay(dateStr, projects);
      const isSel = dateStr === selectedDate;
      html += `<div class="builder-pc-week__cell${isSel ? " is-selected" : ""}" data-builder-pc-month-day="${dateStr}">`;
      if (!dayProjects.length) {
        html += `<span class="builder-pc-mini-list__meta">—</span>`;
      } else {
        html += renderDayEvents(dayProjects, Store, { max: maxEventsPerDay(), showPhase: true });
      }
      html += "</div>";
    }
    html += "</div></div>";
    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-builder-pc-month-day]").forEach((cell) => {
      cell.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-builder-pc-project]")) return;
        const dateStr = cell.getAttribute("data-builder-pc-month-day") || "";
        if (dateStr) selectDate(dateStr);
      });
    });
    bindProjectSelect(wrap);
  }

  function renderCalendar(opts) {
    const options = opts || {};
    syncViewTabs();
    const wrap = $("[data-builder-pc-calendar-body]");
    const prevMode = wrap?.dataset?.lastMobileMode || "";
    const restoringAgenda = isMobileCal() && mobileViewMode === "agenda" && prevMode === "month";

    if (isMobileCal()) {
      if (mobileViewMode === "month") renderMonth();
      else renderMobile();
      if (prevMode && prevMode !== mobileViewMode) playViewTransition(wrap);
      if (wrap) wrap.dataset.lastMobileMode = mobileViewMode;
      if (restoringAgenda || options.restoreAgenda) restoreAgendaScroll();
      else if (scrollTodayPending) {
        requestAnimationFrame(() => scrollSelectionIntoView());
      } else if (mobileViewMode === "agenda") {
        requestAnimationFrame(() => {
          const active = wrap?.querySelector(".builder-pc-dayChip.is-selected");
          active?.scrollIntoView({ inline: "center", block: "nearest" });
        });
      }
      scrollTodayPending = false;
      return;
    }
    if (wrap) delete wrap.dataset.lastMobileMode;
    if (desktopViewMode === "week") renderWeek();
    else renderMonth();
    if (scrollTodayPending) {
      requestAnimationFrame(() => scrollSelectionIntoView());
    }
    scrollTodayPending = false;
  }

  function refresh(opts) {
    renderWidgets();
    renderCalendar(opts);
    renderDetailPanel();
  }

  function shiftPeriod(delta) {
    const mobile = isMobileCal();
    const Store = getStore();
    if (!mobile && desktopViewMode === "week") {
      anchorDate.setDate(anchorDate.getDate() + delta * 7);
      if (Store) {
        const range = Store.getWeekRange(Store.toDateOnlyString(anchorDate));
        selectedDate = range.start;
        syncSelectedProjectForDate(Store);
      }
      refresh();
      return;
    }

    // 月送り: 選択日を可能な限り保持、存在しない日のみ月末へ補正
    const sel = Store?.parseDateOnly?.(selectedDate);
    const dayNum = sel ? sel.getDate() : 1;
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth() + delta;
    const target = new Date(y, m, 1, 12, 0, 0, 0);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const clamped = Math.min(dayNum, lastDay);
    setAnchor(new Date(target.getFullYear(), target.getMonth(), clamped, 12, 0, 0, 0));
    if (Store) {
      selectedDate = Store.toDateOnlyString(anchorDate);
      syncSelectedProjectForDate(Store);
    }
    refresh();
  }

  function goToday() {
    const Store = getStore();
    const now = new Date();
    setAnchor(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
    if (Store) {
      selectedDate = Store.todayDateOnly();
      syncSelectedProjectForDate(Store);
    }
    scrollTodayPending = true;
    agendaScrollY = 0;
    refresh();
  }

  function bindToolbar() {
    $("[data-builder-pc-prev]")?.addEventListener("click", () => shiftPeriod(-1));
    $("[data-builder-pc-next]")?.addEventListener("click", () => shiftPeriod(1));
    $("[data-builder-pc-today-btn]")?.addEventListener("click", () => goToday());

    document.querySelectorAll("[data-builder-pc-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-builder-pc-view") || "month";
        setViewMode(mode);
        syncViewTabs();
        refresh({ restoreAgenda: mode === "agenda" });
      });
    });
  }

  async function init() {
    const Store = getStore();
    if (!Store) return;
    Store.ensureSeed?.();
    try {
      await Store.hydrateFromSupabase?.();
    } catch {
      /* Demo fallback — hydrate 内でも握りつぶし済み */
    }
    setAnchor(new Date());
    selectedDate = Store.todayDateOnly();
    syncSelectedProjectForDate(Store);
    bindToolbar();
    if (!restoreFromUrl()) refresh();

    // CAL-MAIN-04: Supabase mode のみ Realtime 購読
    try {
      const Rt = global.TasuBuilderProjectCalendarRealtime;
      if (Store.getDataSourceMode?.() === "supabase") {
        Rt?.startRealtime?.({ onRefresh: () => refresh() });
      } else {
        Rt?.stopRealtime?.();
      }
    } catch {
      /* ignore */
    }

    let resizeTimer = 0;
    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => refresh(), 120);
      },
      { passive: true },
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void init();
    });
  } else {
    void init();
  }

  global.TasuBuilderProjectCalendar = {
    init,
    refresh,
    renderCalendar,
    getViewMode,
    setViewMode,
    getSelectedDate: () => selectedDate,
    getSelectedProject: () => selectedProject,
    getAccordionState: () => ({ ...accordionState }),
    getDetailViewMode: () => detailViewMode,
    isMobileDetailOpen: () => mobileDetailOpen,
    selectDate,
    selectProject,
    mapsSearchUrl,
    mapsDirectionsUrl,
    telHref,
    messageHref,
    openTalkForProject,
    talkRoomIdOf,
    calendarReturnTo,
    restoreFromUrl,
    closeMobileDetail: () => {
      mobileDetailOpen = false;
      detailViewMode = "main";
      renderDetailPanel();
    },
    /** テスト用: 選択解除して右パネル要約を表示 */
    clearSelection: () => {
      selectedProject = "";
      detailViewMode = "main";
      mobileDetailOpen = false;
      refresh();
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
