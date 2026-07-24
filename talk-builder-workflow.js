/**

 * TASFUL Talk — Builder 案件ワークフロー UI（chat-detail 専用）

 * Builder 内チャット UI は作らず、Talk 側でヘッダー・状態・完了報告を扱う。

 */

(function (global) {

  "use strict";



  const WORKFLOW_STATE_KEY = "tasful:talk:builder-workflow-state:v1";

  const COMPLETION_REPORT_KEY = "tasful:talk:builder-completion-reports:v1";

  const CONTACT_REVEAL_KEY = "tasful:builder:contact-reveals:v1";

  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";

  const CONTACT_REVEAL_FEE_YEN = global.TasuBuilderBillingPolicy?.CONTACT_REVEAL_FEE_YEN || 550;

  const COMPLETION_PHOTO_MAX = 5;



  const HEADER_KINDS = new Set(["worker_contact", "vendor_contact", "project_thread", "admin_partner"]);

  const WORKFLOW_KINDS = new Set(["project_thread", "admin_partner"]);

  const CONTACT_CONSULT_KINDS = new Set(["worker_contact", "vendor_contact"]);

  const CONTACT_GATE_KINDS = new Set(["worker_contact", "vendor_contact", "project_thread"]);



  const KIND_LABELS = Object.freeze({

    worker_contact: "ワーカー相談",

    vendor_contact: "業者相談",

    project_thread: "案件スレッド",

    admin_partner: "運営案件",

  });



  /** 運営 × パートナー — 入退場のみ（作業開始/施工中なし · 再入場可） */

  const ADMIN_STATUS_FLOW = Object.freeze({

    accepted: {

      label: "受諾済み",

      actions: [{ next: "entered", label: "入場", actorRoles: ["partner", "owner"] }],

    },

    entered: {

      label: "入場済み",

      actions: [{ next: "exited", label: "退場", actorRoles: ["partner", "owner"] }],

    },

    exited: {

      label: "退場済み",

      actions: [

        { next: "entered", label: "入場", actorRoles: ["partner", "owner"] },

        { next: "completion_reported", label: "完了報告", opensModal: true, actorRoles: ["partner", "owner"] },

      ],

    },

    completion_reported: {

      label: "運営確認待ち",

      actions: [],

    },

    ops_confirming: {

      label: "運営承認待ち",

      actions: [{ next: "completed", label: "承認する", actorRoles: ["owner"] }],

    },

    completed: { label: "完了", actions: [] },

  });



  /** 一般案件 — 入退場なし · 依頼者承認 */

  const PROJECT_STATUS_FLOW = Object.freeze({

    accepted: {

      label: "受諾済み",

      next: "started",

      nextLabel: "作業開始",

      actorRoles: ["partner"],

    },

    started: {

      label: "作業開始",

      next: "working",

      nextLabel: "施工中",

      actorRoles: ["partner"],

    },

    working: {

      label: "施工中",

      next: "completion_reported",

      nextLabel: "完了報告",

      opensModal: true,

      actorRoles: ["partner"],

    },

    completion_reported: {

      label: "完了報告済み",

      next: "client_confirming",

      nextLabel: null,

      actorRoles: [],

    },

    client_confirming: {

      label: "依頼者確認待ち",

      next: "completed",

      nextLabel: "承認する",

      actorRoles: ["user"],

    },

    completed: { label: "完了", next: null, actorRoles: [] },

  });



  const TRANSITION_SYSTEM_MSG = Object.freeze({

    entered: "入場しました",

    started: "作業開始しました",

    working: "施工中に変更しました",

    exited: "退場しました",

    ops_confirming: "運営確認待ちです",

    client_confirming: "依頼者確認待ちです",

  });



  let wired = false;

  let activeThreadId = "";

  let activeThread = null;



  function pickStr(...vals) {

    for (let i = 0; i < vals.length; i += 1) {

      const s = String(vals[i] ?? "").trim();

      if (s) return s;

    }

    return "";

  }



  function esc(text) {

    return String(text ?? "")

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }



  function readJson(key, fallback) {

    try {

      const raw = global.localStorage?.getItem(key);

      const parsed = raw ? JSON.parse(raw) : fallback;

      return parsed && typeof parsed === "object" ? parsed : fallback;

    } catch {

      return fallback;

    }

  }



  function writeJson(key, value) {

    try {

      global.localStorage?.setItem(key, JSON.stringify(value));

      return true;

    } catch {

      return false;

    }

  }



  function readUrlParams() {

    try {

      return new URLSearchParams(global.location?.search || "");

    } catch {

      return new URLSearchParams();

    }

  }



  function resolveViewerRole() {

    const r = pickStr(readUrlParams().get("builderRole")).toLowerCase();

    if (r === "owner" || r === "admin" || r === "ops") return "owner";

    if (r === "partner") return "partner";

    return "user";

  }



  function statusFlowForKind(kind) {

    return kind === "admin_partner" ? ADMIN_STATUS_FLOW : PROJECT_STATUS_FLOW;

  }



  function normalizeAdminWorkflowStatus(status) {

    const s = pickStr(status);

    if (s === "started" || s === "working") return "entered";

    return s;

  }



  /** @param {object} spec */

  function getStatusActions(spec) {

    if (!spec) return [];

    if (Array.isArray(spec.actions)) return spec.actions;

    if (spec.next) {

      return [

        {

          next: spec.next,

          label: spec.nextLabel || "次へ",

          opensModal: Boolean(spec.opensModal),

          actorRoles: spec.actorRoles || [],

        },

      ];

    }

    return [];

  }



  function isBuilderDomainThread(thread) {

    if (!thread) return false;

    if (global.TasuPlatformChatCategoryFlow?.isBuilderThread?.(thread) === true) return true;

    return String(thread.chatDomain || "").toLowerCase() === "builder";

  }



  function mapFlowToKind(flow) {

    const f = pickStr(flow).toLowerCase();

    if (f === "vendor_user") return "vendor_contact";

    if (f === "ops_partner") return "admin_partner";

    if (f === "partner_user") return "project_thread";

    return "";

  }



  function resolveBuilderThreadKind(thread) {

    if (!thread) return null;



    const storeRow = (() => {

      const id = pickStr(thread?.id, thread?.roomId);

      if (!id || !global.TasuChatThreadStore?.readAll) return null;

      return global.TasuChatThreadStore.readAll().find((r) => String(r.id) === id) || null;

    })();

    const merged = storeRow ? { ...thread, ...storeRow } : thread;



    const storeKind = pickStr(

      merged.threadKind,

      merged.thread_kind,

      merged.builderThreadKind

    ).toLowerCase();



    if (storeKind === "worker_contact") return "worker_contact";

    if (storeKind === "vendor_contact") return "vendor_contact";

    if (storeKind === "project_thread") return "project_thread";

    if (storeKind === "admin_partner") return "admin_partner";

    if (storeKind === "calendar_request") {

      const tt = pickStr(merged.builderThreadType, merged.thread_type).toLowerCase();

      if (tt === "admin_partner" || tt === "ops_partner" || isBuilderDomainThread(merged)) {

        return "admin_partner";

      }

    }



    const builderThreadType = pickStr(merged.builderThreadType, merged.thread_type).toLowerCase();

    if (builderThreadType === "worker_contact") return "worker_contact";

    if (builderThreadType === "vendor_contact") return "vendor_contact";

    if (builderThreadType === "project_thread") return "project_thread";

    if (builderThreadType === "admin_partner" || builderThreadType === "ops_partner") {

      return "admin_partner";

    }



    const urlFlow = pickStr(readUrlParams().get("builderFlow"));

    const fromFlow = mapFlowToKind(urlFlow);

    if (fromFlow) return fromFlow;



    const legacyKind = pickStr(thread.kind, thread.type).toLowerCase();

    if (HEADER_KINDS.has(legacyKind)) return legacyKind;



    if (isBuilderDomainThread(merged) && urlFlow) return mapFlowToKind(urlFlow) || null;



    return null;

  }



  function isBuilderWorkflowThread(thread) {

    const kind = resolveBuilderThreadKind(thread);

    return Boolean(kind && HEADER_KINDS.has(kind));

  }



  function readWorkflowStateMap() {

    return readJson(WORKFLOW_STATE_KEY, {});

  }



  function getBuilderWorkflowState(threadId) {

    const id = pickStr(threadId);

    if (!id) return null;

    const row = readWorkflowStateMap()[id];

    if (!row || typeof row !== "object") return null;

    return { ...row };

  }



  function saveBuilderWorkflowState(threadId, patch) {

    const id = pickStr(threadId);

    if (!id) return null;

    const map = readWorkflowStateMap();

    const prev = map[id] && typeof map[id] === "object" ? map[id] : {};

    const next = {

      ...prev,

      ...patch,

      threadId: id,

      updatedAt: new Date().toISOString(),

    };

    map[id] = next;

    writeJson(WORKFLOW_STATE_KEY, map);

    global.dispatchEvent?.(

      new CustomEvent("tasu:talk-builder-workflow-changed", { detail: { threadId: id, state: next } })

    );

    return next;

  }



  function getBuilderCompletionReport(threadId) {

    const id = pickStr(threadId);

    if (!id) return null;

    const map = readJson(COMPLETION_REPORT_KEY, {});

    const row = map[id];

    return row && typeof row === "object" ? { ...row } : null;

  }



  function saveBuilderCompletionReport(threadId, report) {

    const id = pickStr(threadId);

    if (!id) return null;

    const map = readJson(COMPLETION_REPORT_KEY, {});

    const row = {

      ...report,

      threadId: id,

      savedAt: new Date().toISOString(),

    };

    map[id] = row;

    if (!writeJson(COMPLETION_REPORT_KEY, map)) return null;

    return row;

  }



  function defaultWorkflowStatus(thread) {

    const kind = resolveBuilderThreadKind(thread);

    if (!WORKFLOW_KINDS.has(kind)) return null;

    return "accepted";

  }



  function resolveWorkflowStatus(thread) {

    const id = pickStr(thread?.id, thread?.roomId);

    const kind = resolveBuilderThreadKind(thread);

    const flow = statusFlowForKind(kind);

    const saved = getBuilderWorkflowState(id);

    let status = pickStr(saved?.status);

    if (kind === "admin_partner") status = normalizeAdminWorkflowStatus(status);

    if (status && flow[status]) return status;

    return defaultWorkflowStatus(thread);

  }



  function resolveContactTarget(thread, kind) {

    const targetId = pickStr(

      thread?.contactTargetId,

      thread?.contact_target_id,

      thread?.partner?.id,

      kind === "vendor_contact" ? thread?.partner?.partnerId : ""

    );

    let targetType = "partner";

    if (kind === "worker_contact") targetType = "worker";

    else if (kind === "vendor_contact") targetType = "partner";

    else if (kind === "project_thread") targetType = "partner";

    return { targetType, targetId };

  }



  function isContactRevealed(targetType, targetId) {

    const tid = pickStr(targetId);

    if (!tid) return true;

    if (global.TasuBuilderContactReveal?.isRevealed) {

      return global.TasuBuilderContactReveal.isRevealed(targetType, tid);

    }

    const map = readJson(CONTACT_REVEAL_KEY, {});

    const row = map[`${targetType}:${tid}`];

    return String(row?.status || "") === "active";

  }



  function needsContactRevealGate(thread, kind) {

    if (kind === "admin_partner") return false;

    if (!CONTACT_GATE_KINDS.has(kind)) return false;

    const role = resolveViewerRole();

    if (role !== "user") return false;

    const { targetType, targetId } = resolveContactTarget(thread, kind);

    if (!targetId) return false;

    return !isContactRevealed(targetType, targetId);

  }



  function shouldShowStatusRowOverflow(thread) {

    if (!thread) return true;

    const kind = resolveBuilderThreadKind(thread);

    if (kind && HEADER_KINDS.has(kind)) return false;

    return true;

  }



  function getBuilderRevealedContact(thread) {

    const kind = resolveBuilderThreadKind(thread);

    if (!CONTACT_GATE_KINDS.has(kind)) return null;

    const row = readContactReveal(thread, kind);

    if (row?.contact) return row.contact;

    const { targetType, targetId } = resolveContactTarget(thread, kind);

    if (!targetId || !isContactRevealed(targetType, targetId)) return null;

    return global.TasuBuilderContactReveal?.demoContact?.(targetType, targetId) || null;

  }



  function resolvePeerDisplayName(thread) {

    if (!thread || !isBuilderWorkflowThread(thread)) return null;

    const revealed = getBuilderRevealedContact(thread);

    const name = pickStr(

      revealed?.name,

      thread?.partner?.displayName,

      thread?.partner?.name,

      thread?.targetName,

      thread?.contactTargetName

    );

    return name || null;

  }



  /**
   * Talk ヘッダー右上（電話 / ビデオ / メニュー）の表示可否。
   * 運営案件は常に非表示。一般 / ワーカー / 業者は開示後のみ。通常 Talk は表示。
   * @param {object|null|undefined} thread
   * @returns {boolean}
   */
  function shouldShowTalkHeaderActions(thread) {

    if (!thread) return true;

    const kind = resolveBuilderThreadKind(thread);

    if (!kind || !HEADER_KINDS.has(kind)) return true;

    if (kind === "admin_partner") return false;

    if (CONTACT_GATE_KINDS.has(kind)) return !needsContactRevealGate(thread, kind);

    return true;

  }



  function setHeaderActionButtonVisible(btn, show) {

    if (!btn) return;

    btn.hidden = !show;

    btn.setAttribute("aria-hidden", show ? "false" : "true");

  }



  function applyTalkHeaderActions(thread) {

    const show = shouldShowTalkHeaderActions(thread);

    try {

      document.body.dataset.chatHeaderActionsVisible = show ? "1" : "0";

    } catch {

      /* ignore */

    }



    document.querySelectorAll("[data-chat-header-actions]").forEach((host) => {

      host.hidden = !show;

      host.classList.toggle("chat-header-actions--visible", show);

      host.classList.toggle("chat-header-actions--hidden", !show);

    });



    document.querySelectorAll("[data-chat-header-action]").forEach((btn) => {

      setHeaderActionButtonVisible(btn, show);

    });



    const overflowBtn = document.getElementById("chatOverflowBtn");

    const overflowPanel = document.getElementById("chatOverflowPanel");

    if (overflowBtn) {

      const showOverflow = shouldShowStatusRowOverflow(thread);

      overflowBtn.hidden = !showOverflow;

      if (!showOverflow) {

        overflowBtn.setAttribute("aria-expanded", "false");

        if (overflowPanel) overflowPanel.hidden = true;

      }

    }



    global.TasuTalkCallChatDetail?.syncFromThread?.(thread);

  }



  function readMvpProject(projectId) {

    const pid = pickStr(projectId);

    if (!pid) return null;

    const state = readJson(MVP_STORAGE_KEY, {});

    return (state.projects || []).find((p) => String(p.project_id) === pid) || null;

  }



  function readContactReveal(thread, kind) {

    const { targetType, targetId } = resolveContactTarget(thread, kind);

    if (!targetId) return null;

    if (!isContactRevealed(targetType, targetId)) return null;

    const map = readJson(CONTACT_REVEAL_KEY, {});

    return map[`${targetType}:${targetId}`] || null;

  }



  function buildMetaItems(thread, kind) {

    const items = [];

    const projectId = pickStr(thread?.projectId, thread?.listingId, thread?.listing?.id);

    const project = readMvpProject(projectId);

    const title = pickStr(

      thread?.listingTitle,

      thread?.listing?.title,

      project?.title,

      project?.list_title

    );

    const counterpart = pickStr(

      thread?.partner?.displayName,

      thread?.sellerName,

      thread?.buyerName

    );

    const schedule = pickStr(project?.scheduled_date, project?.schedule_date, project?.construction_date);

    const location = pickStr(project?.location, project?.site_address, project?.address);



    if (title) items.push({ label: "案件名", value: title });

    if (counterpart) items.push({ label: "相手", value: counterpart });

    if (schedule) items.push({ label: "施工日", value: schedule });

    if (location) items.push({ label: "場所", value: location });



    const reveal = readContactReveal(thread, kind);

    if (reveal?.contact) {

      items.push({ label: "連絡先", value: "開示済み" });

    }



    const wf = getBuilderWorkflowState(pickStr(thread?.id, thread?.roomId));

    if (wf?.enteredAt) items.push({ label: "入場", value: "済" });

    if (wf?.exitedAt) items.push({ label: "退場", value: "済" });



    return items;

  }



  function builderOpenHref(thread, kind) {

    const projectId = pickStr(thread?.projectId, thread?.listingId);

    if (kind === "worker_contact") return "builder/find-workers.html";

    if (kind === "vendor_contact") return "builder/partners.html";

    if (projectId) return `builder/mvp-project-detail.html?id=${encodeURIComponent(projectId)}`;

    return "builder/project-calendar.html";

  }



  function transitionSystemMessage(fromStatus, toStatus, kind, report) {

    if (toStatus === "completion_reported" && report) {

      return [

        "完了報告しました",

        report.workContent ? `作業内容: ${report.workContent}` : "",

        report.photoCount ? `完了写真: ${report.photoCount}枚` : "",

        report.memo ? `メモ: ${report.memo}` : "",

        report.extraCost ? `追加費用: ${report.extraCost}` : "",

      ]

        .filter(Boolean)

        .join("\n");

    }

    if (toStatus === "completed") {

      return kind === "admin_partner" ? "運営が完了を承認しました" : "依頼者が完了を承認しました";

    }

    return TRANSITION_SYSTEM_MSG[toStatus] || "";

  }



  function canActOnTransition(kind, fromStatus, toStatus, role) {

    const flow = statusFlowForKind(kind);

    const spec = flow[fromStatus];

    if (!spec) return false;

    const action = getStatusActions(spec).find((a) => a.next === toStatus);

    if (!action) return false;

    const actors = action.actorRoles || [];

    if (!actors.length) return false;

    return actors.includes(role);

  }



  function setTalkComposerLocked(locked, reason) {

    const input = document.getElementById("chatInput");

    const send = document.getElementById("chatSend");

    const attach = document.getElementById("chatAttach");

    const composer = document.querySelector(".chat-composer");

    const placeholder = locked

      ? reason || "連絡先開示（550円）後にメッセージを送信できます"

      : "メッセージ（Enterで送信 / Shift+Enterで改行）";

    if (input) {

      input.disabled = Boolean(locked);

      input.placeholder = placeholder;

    }

    if (send) send.disabled = Boolean(locked);

    if (attach) attach.disabled = Boolean(locked);

    if (composer) composer.dataset.builderContactLocked = locked ? "1" : "0";

  }



  async function appendSystemMessage(threadId, text) {

    const id = pickStr(threadId);

    const body = pickStr(text);

    if (!id || !body) return { ok: false };



    const mapKey = global.TasuChatThreadStore?.MESSAGES_KEY || "tasful_chat_messages";

    const map = readJson(mapKey, {});

    const list = Array.isArray(map[id]) ? [...map[id]] : [];

    const msg = {

      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

      chatId: id,

      roomId: id,

      senderId: "__system__",

      senderName: "TASFUL",

      text: body,

      createdAt: new Date().toISOString(),

      kind: "system",

    };

    list.push(msg);

    map[id] = list;

    writeJson(mapKey, map);



    const threads = global.TasuChatThreadStore?.readAll?.() || readJson("tasful_chat_threads", []);

    if (Array.isArray(threads)) {

      const idx = threads.findIndex((t) => String(t.id) === id);

      if (idx >= 0) {

        threads[idx] = { ...threads[idx], lastMessage: body.slice(0, 160), updatedAt: msg.createdAt };

        if (global.TasuChatThreadStore?.writeAll) global.TasuChatThreadStore.writeAll(threads);

        else writeJson("tasful_chat_threads", threads);

      }

    }

    return { ok: true, message: msg };

  }



  function requestUiRefresh(threadId) {

    global.dispatchEvent?.(

      new CustomEvent("tasu:talk-builder-workflow-changed", { detail: { threadId: pickStr(threadId) } })

    );

    try {

      global.postMessage?.({ type: "tasu-chat-reload-room", threadId: pickStr(threadId) }, "*");

    } catch {

      /* ignore */

    }

    void global.TasuChatDetailUi?.reloadRoomStateFromStore?.();

  }



  function hidePanel() {

    const panel = document.getElementById("talkBuilderWorkflowPanel");

    if (panel) panel.hidden = true;

    const reportHost = document.getElementById("talkBuilderCompletionReportHost");

    if (reportHost) {

      reportHost.hidden = true;

      reportHost.innerHTML = "";

    }

    setTalkComposerLocked(false);

  }



  function shouldShowCompletionReportCard(kind, status, role) {

    if (kind === "admin_partner" && (role === "owner" || role === "partner")) {

      return status === "ops_confirming" || status === "completion_reported";

    }

    if (kind === "project_thread" && role === "user") {

      return status === "client_confirming" || status === "completion_reported";

    }

    return false;

  }



  function canApproveCompletionReport(kind, status, role) {

    if (kind === "admin_partner" && role === "owner" && status === "ops_confirming") return true;

    if (kind === "project_thread" && role === "user" && status === "client_confirming") return true;

    return false;

  }



  /** @type {{ name: string, src: string }[]} */
  let activeCompletionReportPhotos = [];

  let completionPhotoLightboxWired = false;

  function normalizeCompletionPhotoPreviews(report) {
    const previews = Array.isArray(report?.photoPreviews) ? report.photoPreviews : [];
    const names = Array.isArray(report?.photoNames) ? report.photoNames.filter(Boolean) : [];
    const count = Math.max(Number(report?.photoCount) || 0, previews.length, names.length);
    if (count < 1) return [];

    const items = [];
    const limit = Math.min(count, COMPLETION_PHOTO_MAX);
    for (let i = 0; i < limit; i += 1) {
      const preview = previews[i];
      if (preview && typeof preview === "object") {
        items.push({
          name: pickStr(preview.name, names[i], `写真${i + 1}`),
          src: pickStr(preview.src),
        });
      } else if (names[i]) {
        items.push({ name: names[i], src: "" });
      } else {
        items.push({ name: `写真${i + 1}`, src: "" });
      }
    }
    return items;
  }

  function renderCompletionPhotoThumb(item, index) {
    const name = pickStr(item?.name, `写真${index + 1}`);
    const src = pickStr(item?.src);
    if (src && /^data:image\//i.test(src)) {
      return (
        `<li class="talk-builder-completion-report__photo-item">` +
        `<button type="button" class="talk-builder-completion-report__photo-thumb" ` +
        `data-talk-builder-completion-photo-thumb data-photo-index="${index}" ` +
        `aria-label="${esc(name)} を拡大">` +
        `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" />` +
        `</button>` +
        `<span class="talk-builder-completion-report__photo-name">${esc(name)}</span>` +
        `</li>`
      );
    }
    return (
      `<li class="talk-builder-completion-report__photo-item talk-builder-completion-report__photo-item--missing">` +
      `<div class="talk-builder-completion-report__photo-thumb talk-builder-completion-report__photo-thumb--missing" role="img" aria-label="画像を読み込めませんでした">` +
      `<span class="talk-builder-completion-report__photo-missing">画像を読み込めませんでした</span>` +
      `</div>` +
      `<span class="talk-builder-completion-report__photo-name">${esc(name)}</span>` +
      `</li>`
    );
  }

  function renderCompletionPhotoBlock(report) {

    const items = normalizeCompletionPhotoPreviews(report);

    if (!items.length) return "";

    activeCompletionReportPhotos = items.slice();

    const thumbs = items.map((item, index) => renderCompletionPhotoThumb(item, index)).join("");

    return (
      `<div class="talk-builder-completion-report__photos">` +
      `<dt>完了写真</dt>` +
      `<dd class="talk-builder-completion-report__photos-body">` +
      `<p class="talk-builder-completion-report__photo-count-label">${items.length}枚</p>` +
      `<ul class="talk-builder-completion-report__photo-list">${thumbs}</ul>` +
      `</dd>` +
      `</div>`
    );

  }

  function ensureCompletionPhotoLightbox() {
    let el = document.getElementById("talkBuilderCompletionPhotoLightbox");
    if (el) return el;
    el = document.createElement("div");
    el.id = "talkBuilderCompletionPhotoLightbox";
    el.className = "talk-builder-completion-photo-lightbox";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "完了写真プレビュー");
    el.innerHTML =
      `<div class="talk-builder-completion-photo-lightbox__backdrop" data-talk-builder-completion-lightbox-close tabindex="-1" aria-hidden="true"></div>` +
      `<div class="talk-builder-completion-photo-lightbox__panel">` +
      `<button type="button" class="talk-builder-completion-photo-lightbox__close" data-talk-builder-completion-lightbox-close aria-label="閉じる">×</button>` +
      `<img class="talk-builder-completion-photo-lightbox__img" data-talk-builder-completion-lightbox-img alt="" />` +
      `<p class="talk-builder-completion-photo-lightbox__caption" data-talk-builder-completion-lightbox-caption hidden></p>` +
      `</div>`;
    document.body.appendChild(el);
    return el;
  }

  function openCompletionPhotoLightbox(src, name) {
    const el = ensureCompletionPhotoLightbox();
    const img = el.querySelector("[data-talk-builder-completion-lightbox-img]");
    const caption = el.querySelector("[data-talk-builder-completion-lightbox-caption]");
    if (img) {
      img.src = src;
      img.alt = name || "完了写真";
    }
    if (caption) {
      if (name) {
        caption.textContent = name;
        caption.hidden = false;
      } else {
        caption.hidden = true;
        caption.textContent = "";
      }
    }
    el.hidden = false;
    document.body.classList.add("talk-builder-completion-photo-lightbox-open");
    el.querySelector(".talk-builder-completion-photo-lightbox__close")?.focus();
  }

  function closeCompletionPhotoLightbox() {
    const el = document.getElementById("talkBuilderCompletionPhotoLightbox");
    if (!el || el.hidden) return;
    el.hidden = true;
    document.body.classList.remove("talk-builder-completion-photo-lightbox-open");
    const img = el.querySelector("[data-talk-builder-completion-lightbox-img]");
    if (img) img.removeAttribute("src");
  }

  function onCompletionPhotoThumbClick(ev) {
    const closeTarget = ev.target?.closest?.("[data-talk-builder-completion-lightbox-close]");
    if (closeTarget) {
      ev.preventDefault();
      closeCompletionPhotoLightbox();
      return;
    }
    const btn = ev.target?.closest?.("[data-talk-builder-completion-photo-thumb]");
    if (!btn) return;
    ev.preventDefault();
    const idx = Number(btn.dataset.photoIndex);
    const item = activeCompletionReportPhotos[idx];
    if (!item?.src) return;
    openCompletionPhotoLightbox(item.src, item.name);
  }

  function onCompletionPhotoLightboxKeydown(ev) {
    if (ev.key !== "Escape") return;
    const el = document.getElementById("talkBuilderCompletionPhotoLightbox");
    if (!el || el.hidden) return;
    ev.preventDefault();
    closeCompletionPhotoLightbox();
  }

  function wireCompletionPhotoLightbox() {
    if (completionPhotoLightboxWired) return;
    completionPhotoLightboxWired = true;
    ensureCompletionPhotoLightbox();
    document.addEventListener("click", onCompletionPhotoThumbClick);
    document.addEventListener("keydown", onCompletionPhotoLightboxKeydown);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }



  function renderCompletionReportCard(thread, kind) {

    const host = document.getElementById("talkBuilderCompletionReportHost");

    if (!host) return;



    const status = resolveWorkflowStatus(thread);

    const role = resolveViewerRole();



    if (!shouldShowCompletionReportCard(kind, status, role)) {

      host.hidden = true;

      host.innerHTML = "";

      return;

    }



    const threadId = pickStr(thread?.id, thread?.roomId);

    const report = getBuilderCompletionReport(threadId);



    host.hidden = false;



    if (!report || !pickStr(report.workContent)) {

      host.innerHTML =

        `<article class="talk-builder-completion-report talk-builder-completion-report--missing" data-talk-builder-completion-report role="alert">` +

        `<h3 class="chat-completion-card__title">完了報告</h3>` +

        `<p class="talk-builder-completion-report__error">完了報告データを取得できません</p>` +

        `<p class="talk-builder-completion-report__diag">threadId: ${esc(threadId)} · status: ${esc(status)} · role: ${esc(role)}</p>` +

        `</article>`;

      return;

    }



    const rows = [

      `<div><dt>作業内容</dt><dd>${esc(report.workContent)}</dd></div>`,

    ];

    if (pickStr(report.memo)) {

      rows.push(`<div><dt>メモ</dt><dd>${esc(report.memo)}</dd></div>`);

    }

    if (pickStr(report.extraCost)) {

      rows.push(`<div><dt>追加費用</dt><dd>${esc(report.extraCost)}</dd></div>`);

    }

    const photoBlock = renderCompletionPhotoBlock(report);

    if (photoBlock) rows.push(photoBlock);



    const approveHtml = canApproveCompletionReport(kind, status, role)

      ? `<div class="chat-completion-card__actions">` +

        `<button type="button" class="chat-completion-card__btn chat-completion-card__btn--approve" data-talk-builder-next data-next-status="completed">承認する</button>` +

        `</div>`

      : "";



    host.innerHTML =

      `<div class="chat-completion-card-wrap talk-builder-completion-report-wrap">` +

      `<article class="chat-completion-card talk-builder-completion-report" data-talk-builder-completion-report aria-label="完了報告">` +

      `<h3 class="chat-completion-card__title">完了報告</h3>` +

      `<dl class="chat-completion-card__rows">${rows.join("")}</dl>` +

      approveHtml +

      `</article>` +

      `</div>`;

  }



  function renderMeta(host, items) {

    if (!host) return;

    if (!items.length) {

      host.innerHTML = "";

      host.hidden = true;

      return;

    }

    host.hidden = false;

    host.innerHTML = items

      .map(

        (item) =>

          `<div class="talk-builder-workflow__meta-item"><span class="talk-builder-workflow__meta-label">${esc(

            item.label

          )}</span><span class="talk-builder-workflow__meta-value">${esc(item.value)}</span></div>`

      )

      .join("");

  }



  function renderContactRevealGate(thread, kind) {

    const host = document.getElementById("talkBuilderContactRevealHost");

    if (!host) return false;



    if (kind === "admin_partner" || !CONTACT_GATE_KINDS.has(kind)) {

      host.innerHTML = "";

      host.hidden = true;

      setTalkComposerLocked(false);

      return false;

    }



    const { targetType, targetId } = resolveContactTarget(thread, kind);

    const revealed = isContactRevealed(targetType, targetId);



    if (revealed) {

      const block =

        global.TasuBuilderContactReveal?.renderContactBlock?.(targetType, targetId, { escapeHtml: esc }) ||

        "";

      if (block) {

        host.hidden = false;

        host.innerHTML = block;

        setTalkComposerLocked(false);

        return true;

      }

    }



    if (!needsContactRevealGate(thread, kind)) {

      host.innerHTML = "";

      host.hidden = true;

      setTalkComposerLocked(false);

      return false;

    }



    const block =

      global.TasuBuilderContactReveal?.renderContactBlock?.(targetType, targetId, { escapeHtml: esc }) ||

      `<div class="builder-contact-reveal builder-contact-reveal--locked">` +

        `<p class="builder-contact-reveal__lead">直接連絡先の開示と Talk の有効化には、連絡先開示料 ${CONTACT_REVEAL_FEE_YEN}円（税込）が必要です。</p>` +

        `<button type="button" class="builder-btn builder-btn--secondary" data-builder-contact-reveal data-reveal-type="${esc(

          targetType

        )}" data-reveal-target-id="${esc(targetId)}">` +

        `連絡先を開示する（${CONTACT_REVEAL_FEE_YEN}円）</button>` +

        `<p class="builder-contact-reveal__note">連絡先開示料 — チャット料金ではありません</p>` +

        `</div>`;



    host.hidden = false;

    host.innerHTML = block;

    global.TasuBuilderContactReveal?.wireContactRevealButtons?.(host);

    setTalkComposerLocked(

      true,

      `連絡先開示料 ${CONTACT_REVEAL_FEE_YEN}円 支払い後にメッセージを送信できます（チャット料金ではありません）`

    );

    return true;

  }



  function renderStatusRow(thread, kind) {

    const row = document.getElementById("talkBuilderWorkflowStatusRow");

    const badge = document.getElementById("talkBuilderWorkflowStatusBadge");

    const actionsHost = document.getElementById("talkBuilderWorkflowActions");

    const hint = document.getElementById("talkBuilderWorkflowStatusHint");

    if (!row || !badge) return;



    if (CONTACT_CONSULT_KINDS.has(kind)) {

      if (needsContactRevealGate(thread, kind)) {

        row.hidden = true;

        if (actionsHost) actionsHost.hidden = true;

        if (hint) hint.hidden = true;

        return;

      }

      row.hidden = false;

      badge.textContent = "相談中";

      badge.className = "chat-pill talk-builder-workflow__status-badge talk-builder-workflow__status-badge--consult";

      if (actionsHost) {

        actionsHost.innerHTML = "";

        actionsHost.hidden = true;

      }

      if (hint) hint.hidden = true;

      return;

    }



    if (!WORKFLOW_KINDS.has(kind)) {

      row.hidden = true;

      if (actionsHost) actionsHost.hidden = true;

      if (hint) hint.hidden = true;

      return;

    }



    if (needsContactRevealGate(thread, kind)) {

      row.hidden = true;

      if (actionsHost) actionsHost.hidden = true;

      if (hint) {

        hint.hidden = false;

        hint.textContent = "連絡先開示後に案件ステータスを操作できます";

      }

      return;

    }



    const role = resolveViewerRole();

    const status = resolveWorkflowStatus(thread);

    const flow = statusFlowForKind(kind);

    const spec = flow[status];

    if (!spec) {

      row.hidden = true;

      return;

    }



    row.hidden = false;

    badge.textContent = spec.label;

    badge.className = "chat-pill talk-builder-workflow__status-badge";



    const actions = getStatusActions(spec);

    const visibleActions = actions.filter((a) => canActOnTransition(kind, status, a.next, role));



    if (actionsHost) {

      if (!visibleActions.length) {

        actionsHost.innerHTML = "";

        actionsHost.hidden = true;

      } else {

        actionsHost.hidden = false;

        actionsHost.innerHTML = visibleActions

          .map(

            (a, idx) =>

              `<button type="button" class="chat-complete-btn${idx > 0 ? " chat-complete-btn--ghost" : ""}" data-talk-builder-next data-next-status="${esc(

                a.next

              )}"${a.opensModal ? ' data-opens-modal="1"' : ""}>${esc(a.label)}</button>`

          )

          .join("");

      }

    }



    if (!visibleActions.length) {

      if (hint) {

        hint.hidden = false;

        if (status === "ops_confirming") {

          hint.textContent = role === "partner" ? "運営の承認をお待ちください" : "運営のみ承認できます";

        } else if (status === "client_confirming") {

          hint.textContent = role === "partner" ? "依頼者の承認をお待ちください" : "依頼者のみ承認できます";

        } else if (status === "completion_reported") {

          hint.textContent = "運営確認待ちです";

        } else if (status === "completed") {

          hint.hidden = true;

        } else if (status === "exited" && kind === "admin_partner") {

          hint.textContent = role === "owner" ? "パートナーが入退場・完了報告を操作します" : "";

          hint.hidden = role !== "owner";

        } else if (status === "working" && kind === "project_thread") {

          hint.textContent = role === "user" ? "作業者が操作します" : "";

          hint.hidden = role !== "user";

        } else {

          hint.textContent = "操作権限がありません";

        }

      }

      return;

    }



    if (hint) hint.hidden = true;

  }



  function apply(thread) {

    activeThread = thread || null;

    activeThreadId = pickStr(thread?.id, thread?.roomId);



    if (!isBuilderWorkflowThread(thread)) {

      hidePanel();

      applyTalkHeaderActions(thread);

      return;

    }



    const kind = resolveBuilderThreadKind(thread);

    const panel = document.getElementById("talkBuilderWorkflowPanel");

    const kindEl = document.getElementById("talkBuilderWorkflowKind");

    const metaEl = document.getElementById("talkBuilderWorkflowMeta");

    const builderLink = document.getElementById("talkBuilderWorkflowOpenBuilder");



    if (!panel || !kindEl) return;



    panel.hidden = false;

    kindEl.textContent = KIND_LABELS[kind] || "Builder";



    renderMeta(metaEl, buildMetaItems(thread, kind));

    renderContactRevealGate(thread, kind);

    renderStatusRow(thread, kind);

    renderCompletionReportCard(thread, kind);



    if (builderLink) {

      builderLink.href = builderOpenHref(thread, kind);

      builderLink.hidden = false;

    }



    applyTalkHeaderActions(thread);

  }



  async function advanceStatus(nextStatus, options) {

    const threadId = pickStr(activeThreadId, activeThread?.id, activeThread?.roomId);

    const kind = resolveBuilderThreadKind(activeThread);

    const flow = statusFlowForKind(kind);

    if (!threadId || !flow[nextStatus]) return false;



    const fromStatus = pickStr(options?.fromStatus, resolveWorkflowStatus(activeThread));

    const role = resolveViewerRole();



    if (!options?.force && fromStatus && !canActOnTransition(kind, fromStatus, nextStatus, role)) return false;



    const patch = { status: nextStatus };

    if (nextStatus === "entered") patch.enteredAt = new Date().toISOString();

    if (nextStatus === "exited") patch.exitedAt = new Date().toISOString();

    saveBuilderWorkflowState(threadId, patch);



    if (nextStatus === "completion_reported" && options?.report) {

      const savedReport = saveBuilderCompletionReport(threadId, options.report);

      if (!savedReport || !pickStr(savedReport.workContent)) {

        if (fromStatus) saveBuilderWorkflowState(threadId, { status: fromStatus });

        apply(activeThread);

        requestUiRefresh(threadId);

        return false;

      }

    }



    const systemText = pickStr(

      options?.systemMsg,

      transitionSystemMessage(fromStatus, nextStatus, kind, options?.report)

    );



    if (systemText) await appendSystemMessage(threadId, systemText);



    if (global.TasuChatDetailUi?.reloadRoomStateFromStore) {

      await global.TasuChatDetailUi.reloadRoomStateFromStore();

    } else {

      requestUiRefresh(threadId);

    }

    apply(activeThread);

    return true;

  }



  function completionPhotoDedupeKey(file) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  function setCompletionPhotoInputFiles(files) {
    const photoInput = document.getElementById("talkBuilderCompletionPhotos");
    if (!photoInput) return;
    const dt = new DataTransfer();
    (files || []).forEach((file) => {
      if (isCompletionPhotoFile(file)) dt.items.add(file);
    });
    photoInput.files = dt.files;
  }

  function mergeCompletionPhotoFiles(incomingFiles, { append = false } = {}) {
    const base = append ? getCompletionPhotoFiles() : [];
    const seen = new Set();
    const merged = [];

    function push(file) {
      if (!isCompletionPhotoFile(file)) return;
      const key = completionPhotoDedupeKey(file);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(file);
    }

    base.forEach(push);
    (incomingFiles || []).forEach(push);
    setCompletionPhotoInputFiles(merged);
    return merged;
  }

  function validateCompletionPhotoSelection() {
    const err = document.getElementById("talkBuilderCompletionError");
    const count = getCompletionPhotoFiles().length;
    if (count > COMPLETION_PHOTO_MAX) {
      if (err) {
        err.textContent = `完了写真は最大${COMPLETION_PHOTO_MAX}枚までです`;
        err.hidden = false;
      }
      return false;
    }
    if (err) err.hidden = true;
    return true;
  }

  function clearCompletionPhotoDragState() {
    completionPhotoDragDepth = 0;
    document
      .getElementById("talkBuilderCompletionPhotoDrop")
      ?.classList.remove("is-dragover");
  }

  let completionPhotoDragDepth = 0;

  function wireCompletionPhotoDropZone() {
    const dropZone = document.getElementById("talkBuilderCompletionPhotoDrop");
    const photoInput = document.getElementById("talkBuilderCompletionPhotos");
    if (!dropZone || !photoInput || dropZone.dataset.wiredDrop === "1") return;
    dropZone.dataset.wiredDrop = "1";

    dropZone.addEventListener("click", (ev) => {
      if (ev.target === photoInput) return;
      ev.preventDefault();
      photoInput.click();
    });

    dropZone.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        photoInput.click();
      }
    });

    dropZone.addEventListener("dragenter", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      completionPhotoDragDepth += 1;
      dropZone.classList.add("is-dragover");
    });

    dropZone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropZone.classList.add("is-dragover");
    });

    dropZone.addEventListener("dragleave", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      completionPhotoDragDepth -= 1;
      if (completionPhotoDragDepth <= 0) {
        clearCompletionPhotoDragState();
      }
    });

    dropZone.addEventListener("drop", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      clearCompletionPhotoDragState();
      const dropped = ev.dataTransfer?.files ? Array.from(ev.dataTransfer.files) : [];
      const images = dropped.filter(isCompletionPhotoFile);
      if (!images.length && dropped.length) {
        const err = document.getElementById("talkBuilderCompletionError");
        if (err) {
          err.textContent = "画像ファイルのみ添付できます";
          err.hidden = false;
        }
        return;
      }
      if (!images.length) return;
      mergeCompletionPhotoFiles(images, { append: true });
      validateCompletionPhotoSelection();
      updateCompletionPhotoCountUI();
    });
  }

  function isCompletionPhotoFile(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    if (type.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(String(file.name || ""));
  }

  function getCompletionPhotoFiles() {
    const photoInput = document.getElementById("talkBuilderCompletionPhotos");
    const files = photoInput?.files ? Array.from(photoInput.files) : [];
    return files.filter(isCompletionPhotoFile);
  }

  function updateCompletionPhotoCountUI() {
    const countEl = document.getElementById("talkBuilderCompletionPhotoCount");
    if (!countEl) return;
    const selectedFiles = getCompletionPhotoFiles();
    const count = selectedFiles.length;
    if (count > 0) {
      countEl.hidden = false;
      countEl.textContent = `${count}枚選択済み`;
    } else {
      countEl.hidden = true;
      countEl.textContent = "";
    }
  }

  function resetCompletionPhotoUI() {
    const photos = document.getElementById("talkBuilderCompletionPhotos");
    if (photos) photos.value = "";
    clearCompletionPhotoDragState();
    updateCompletionPhotoCountUI();
  }

  function openCompletionModal() {

    const kind = resolveBuilderThreadKind(activeThread);

    const status = resolveWorkflowStatus(activeThread);

    if (kind === "admin_partner" && status !== "exited") return;

    if (kind === "project_thread" && status !== "working") return;



    const modal = document.getElementById("talkBuilderCompletionModal");

    if (!modal) return;

    modal.hidden = false;

    const err = document.getElementById("talkBuilderCompletionError");

    if (err) err.hidden = true;

    resetCompletionPhotoUI();

  }



  function closeCompletionModal() {

    const modal = document.getElementById("talkBuilderCompletionModal");

    if (modal) modal.hidden = true;

  }



  async function submitCompletionModal() {

    const kind = resolveBuilderThreadKind(activeThread);

    const status = resolveWorkflowStatus(activeThread);

    const workContent = pickStr(document.getElementById("talkBuilderCompletionWork")?.value);

    const memo = pickStr(document.getElementById("talkBuilderCompletionMemo")?.value);

    const extraCost = pickStr(document.getElementById("talkBuilderCompletionExtra")?.value);

    const photoInput = document.getElementById("talkBuilderCompletionPhotos");

    const err = document.getElementById("talkBuilderCompletionError");



    const photoFiles = getCompletionPhotoFiles();

    const photoCount = photoFiles.length;



    if (kind === "admin_partner" && status !== "exited") {

      if (err) {

        err.textContent = "退場後に完了報告してください";

        err.hidden = false;

      }

      return;

    }

    if (kind === "project_thread" && status !== "working") {

      if (err) {

        err.textContent = "施工中のみ完了報告できます";

        err.hidden = false;

      }

      return;

    }

    if (!workContent) {

      if (err) {

        err.textContent = "作業内容を入力してください";

        err.hidden = false;

      }

      return;

    }

    if (photoCount < 1) {

      if (err) {

        err.textContent = "完了写真を1枚以上添付してください";

        err.hidden = false;

      }

      return;

    }

    if (photoCount > COMPLETION_PHOTO_MAX) {

      if (err) {

        err.textContent = `完了写真は最大${COMPLETION_PHOTO_MAX}枚までです`;

        err.hidden = false;

      }

      return;

    }



    const photoPreviews = await Promise.all(
      photoFiles.slice(0, COMPLETION_PHOTO_MAX).map(async (file) => {
        try {
          const src = await readFileAsDataUrl(file);
          return { name: file.name, src };
        } catch {
          return { name: file.name, src: "" };
        }
      })
    );

    const report = {

      workContent,

      memo,

      extraCost,

      photoCount,

      photoNames: photoFiles.map((f) => f.name),

      photoPreviews,

    };



    const threadId = pickStr(activeThreadId, activeThread?.id, activeThread?.roomId);

    const reportedOk = await advanceStatus("completion_reported", {

      fromStatus: status,

      report,

    });

    const savedReport = getBuilderCompletionReport(threadId);

    if (!reportedOk || !pickStr(savedReport?.workContent)) {

      if (err) {

        err.textContent =

          "完了報告の保存に失敗しました。写真サイズを小さくして再送してください。";

        err.hidden = false;

      }

      const modal = document.getElementById("talkBuilderCompletionModal");

      if (modal) modal.hidden = false;

      return;

    }



    closeCompletionModal();



    const confirmStatus = kind === "admin_partner" ? "ops_confirming" : "client_confirming";

    await advanceStatus(confirmStatus, {

      fromStatus: "completion_reported",

      force: true,

    });

  }



  function onNextClick(ev) {

    const btn = ev.target?.closest?.("[data-talk-builder-next]");

    if (!btn || btn.disabled) return;

    ev.preventDefault();



    const nextStatus = pickStr(btn.dataset.nextStatus);

    if (!nextStatus) return;



    const kind = resolveBuilderThreadKind(activeThread);

    const current = resolveWorkflowStatus(activeThread);

    const role = resolveViewerRole();



    if (!canActOnTransition(kind, current, nextStatus, role)) return;



    if (btn.dataset.opensModal === "1") {

      openCompletionModal();

      return;

    }



    void advanceStatus(nextStatus, { fromStatus: current });

  }



  function onContactRevealed() {

    apply(activeThread);

    requestUiRefresh(activeThreadId);

  }



  function wireUiOnce() {

    if (wired) return;

    wired = true;



    document.addEventListener("click", onNextClick);



    document.getElementById("talkBuilderCompletionSubmit")?.addEventListener("click", () => {

      void submitCompletionModal();

    });

    document.querySelectorAll("[data-talk-builder-completion-close]").forEach((el) => {

      el.addEventListener("click", closeCompletionModal);

    });

    document.getElementById("talkBuilderCompletionPhotos")?.addEventListener("change", () => {
      validateCompletionPhotoSelection();
      updateCompletionPhotoCountUI();
    });

    wireCompletionPhotoDropZone();

    wireCompletionPhotoLightbox();



    document.addEventListener("builder:contact-revealed", onContactRevealed);

    document.addEventListener("builder:contact-reveal-changed", onContactRevealed);



    global.TasuBuilderContactReveal?.wireContactRevealButtons?.(document);

  }



  global.TasuTalkBuilderWorkflow = {

    WORKFLOW_STATE_KEY,

    COMPLETION_REPORT_KEY,

    ADMIN_STATUS_FLOW,

    PROJECT_STATUS_FLOW,

    resolveBuilderThreadKind,

    resolveViewerRole,

    isBuilderWorkflowThread,

    needsContactRevealGate,

    shouldShowTalkHeaderActions,

    shouldShowStatusRowOverflow,

    applyTalkHeaderActions,

    getBuilderRevealedContact,

    resolvePeerDisplayName,

    getBuilderWorkflowState,

    saveBuilderWorkflowState,

    getBuilderCompletionReport,

    saveBuilderCompletionReport,

    apply,

    appendSystemMessage,

    requestUiRefresh,

    setTalkComposerLocked,

    wireUiOnce,

  };



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", wireUiOnce);

  } else {

    wireUiOnce();

  }

})(typeof window !== "undefined" ? window : globalThis);


