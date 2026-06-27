/**
 * Builder AI — Field diagnosis UI（Vision · Calc · Live · UI Phase 7）
 * AD-012: 高機能は AI · UI はシンプル · テキスト会話優先 · Store 読取のみ
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_builder_ai_field_ui_v1";
  const MAX_MESSAGES = 40;
  /** UI フェーズ: Gateway / Gemini へ接続せず mock · local のみ */
  const UI_LOCAL_ONLY = true;
  const BUILDER_AI_CHAT_AVATAR = "assets/builder-ai-chat-avatar.png";

  const QUICK_PROMPTS = [
    { label: "現場写真診断", desc: "写真から補修判断を相談", text: "現場写真について補修判断を相談したいです。", intent: "photo", icon: "📷" },
    { label: "見積相談", desc: "見積もりと粗利の目安", text: "案件の見積もりと粗利の目安を相談したいです。", intent: "estimate", icon: "💴" },
    { label: "工程相談", desc: "遅延と今週の予定", text: "工程の遅延や今週の予定を整理したいです。", intent: "schedule", icon: "📅" },
    { label: "未入金確認", desc: "未入金・支払遅延", text: "未入金・支払遅延の案件を確認したいです。", intent: "unpaid", icon: "💰" },
    { label: "書類作成", desc: "登録書類の状況", text: "登録されている書類の状況を確認したいです。", intent: "documents", icon: "📄" },
    { label: "通知確認", desc: "未読と優先通知", text: "未読通知と優先度の高い通知を確認したいです。", intent: "notifications", icon: "🔔" },
  ];

  const HUB_LINKS = [
    { label: "司令塔", href: "project-dashboard.html", key: "dashboard" },
    { label: "案件ハブ", href: "project-hub.html", key: "hub" },
    { label: "カレンダー", href: "project-calendar.html", key: "calendar" },
    { label: "Vision", href: "project-detail.html", key: "vision", needsProject: true },
    { label: "Finance", href: "project-hub.html", key: "finance", hash: "#finance" },
    { label: "Documents", href: "project-hub.html", key: "documents", hash: "#documents" },
    { label: "Notifications", href: "project-hub.html", key: "notifications", hash: "#notifications" },
  ];

  const SOURCE_LABELS = {
    text: "",
    voice: "🎤 ",
    camera_snapshot: "📷 Live ",
  };

  const VOICE_STATE_LABELS = {
    ready: "Ready",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    error: "Error",
  };

  function getIntegration() {
    return global.TasuBuilderVoiceIntegration;
  }

  function renderVoiceState(payload) {
    const el = $("[data-builder-ai-voice-state]");
    const coreEl = $("[data-builder-ai-voice-core-status]");
    const state = payload?.state || "ready";
    const label = VOICE_STATE_LABELS[state] || VOICE_STATE_LABELS.ready;
    const text = payload?.detail ? `${label} — ${payload.detail}` : label;
    if (el) {
      el.textContent = text;
      el.className = "builder-ai-ui-voice-state builder-ai-v2-voice-state";
      if (state !== "ready") el.classList.add(`builder-ai-ui-voice-state--${state}`);
    }
    if (coreEl) {
      coreEl.textContent = label;
      coreEl.dataset.state = state;
    }

    const voiceBtns = document.querySelectorAll("[data-builder-ai-ui-voice], [data-builder-ai-ui-voice-composer]");
    voiceBtns.forEach((btn) => {
      btn.setAttribute("aria-pressed", state === "listening" ? "true" : "false");
      btn.disabled = sending && state !== "listening";
    });
  }

  function initVoiceIntegration() {
    const Integration = getIntegration();
    if (!Integration?.init) return;
    Integration.init({
      surface: "builder_ai",
      onSubmit: async (payload) => {
        await sendMessage(payload.text, { ...(payload.options || {}), channel: payload.channel });
      },
    });
    Integration.onVoiceStateChange(renderVoiceState);
    renderVoiceState(Integration.getVoiceState());
  }

  /**
   * Text / Voice 共通入口（Voice は Integration 経由のみ）
   */
  async function submit(payload) {
    const Integration = getIntegration();
    if (!Integration?.submit) {
      const text = String(payload?.text ?? payload ?? "").trim();
      if (!text) return { ok: false, error: "empty_text" };
      await sendMessage(text, payload?.options || {});
      return { ok: true, channel: "text" };
    }
    return Integration.submit(payload);
  }

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

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list.slice(-MAX_MESSAGES) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_MESSAGES)));
    } catch {
      /* ignore */
    }
  }

  function getVision() {
    return global.TasuBuilderAIVision;
  }

  function getActor() {
    return global.TasuBuilderAIContext?.resolveActor?.({}) || { actorType: "guest", label: "ゲスト" };
  }

  function getProjectIdFromUrl() {
    try {
      return new URLSearchParams(global.location?.search || "").get("projectId") || "";
    } catch {
      return "";
    }
  }

  function formatYenLocal(amount) {
    const n = Number(amount) || 0;
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function getStore() {
    const Store = global.TasuBuilderProjectStore;
    Store?.ensureSeed?.();
    return Store;
  }

  function buildHubLinkHref(link) {
    const projectId = getProjectIdFromUrl();
    let href = link.href;
    if (link.needsProject && projectId) {
      href = `project-detail.html?id=${encodeURIComponent(projectId)}`;
    } else if (link.needsProject && !projectId) {
      href = "project-hub.html";
    }
    const hash = link.hash || "";
    return `${href}${hash}`;
  }

  function bindHubLinks() {
    const nav = $("[data-builder-ai-ui-hub-links]");
    if (!nav) return;
    nav.innerHTML = HUB_LINKS.map((link) => {
      const href = buildHubLinkHref(link);
      const title = link.needsProject && !getProjectIdFromUrl() ? `${link.label}（案件ハブ経由）` : link.label;
      return `<a class="builder-ai-ui-hub-links__link" href="${escapeHtml(href)}">${escapeHtml(title)}</a>`;
    }).join("");
  }

  function detectConsultIntent(text) {
    const t = String(text || "");
    if (/未入金|支払|入金|overdue|未払/i.test(t)) return "unpaid";
    if (/書類|document|契約書|pdf|図面/i.test(t)) return "documents";
    if (/通知|未読|notification/i.test(t)) return "notifications";
    if (/工程|スケジュール|遅延|予定|カレンダー/i.test(t)) return "schedule";
    if (/見積|粗利|原価|finance|収支/i.test(t)) return "estimate";
    if (/写真|現場|外壁|屋根|診断|vision|補修/i.test(t)) return "photo";
    return "";
  }

  function buildLocalStoreConsultReply(intent, userText) {
    const Store = getStore();
    if (!Store) {
      return "案件ストアが読み込まれていません。";
    }

    const projectId = getProjectIdFromUrl();
    const lines = ["【Builder AI · ローカル参考回答】", ""];

    switch (intent) {
      case "unpaid": {
        const summary = Store.getFinanceSummary?.() || {};
        const unpaid = Store.getUnpaidProjects?.() || [];
        const overdue = Store.getOverduePaymentProjects?.() || [];
        lines.push(
          `未入金案件: ${summary.unpaidCount ?? unpaid.length} 件`,
          `支払遅延: ${summary.overdueCount ?? overdue.length} 件`,
          `登録案件: ${summary.projectCount ?? 0} 件`
        );
        if (unpaid.length) {
          lines.push("", "— 未入金・一部入金 —");
          unpaid.slice(0, 5).forEach((p) => {
            const fin = p.finance || {};
            lines.push(`· ${p.name}: ${fin.paymentStatusLabel || fin.paymentStatus || "未払"}`);
          });
        }
        if (projectId) {
          const p = Store.getProject?.(projectId);
          if (p?.finance) {
            lines.push("", `連携案件「${p.name}」: ${Store.formatFinanceDetail?.(p.finance) || ""}`);
          }
        }
        lines.push("", "詳細は司令塔ダッシュボード · 案件ハブの Finance をご確認ください。");
        break;
      }
      case "documents": {
        const summary = Store.getDocumentSummary?.() || {};
        lines.push(
          `書類合計: ${summary.totalDocuments ?? 0} 件`,
          `写真 ${summary.photoCount ?? 0} · PDF ${summary.pdfCount ?? 0} · 図面 ${summary.drawingCount ?? 0} · 契約 ${summary.contractCount ?? 0}`
        );
        if (projectId) {
          const p = Store.getProject?.(projectId);
          const counts = p ? Store.getProjectDocumentCounts?.(p) : null;
          if (counts) {
            lines.push("", `連携案件「${p.name}」: 書類 ${counts.total} 件`);
          }
        }
        lines.push("", "書類の追加・更新は案件ハブ / 案件詳細から行えます。");
        break;
      }
      case "notifications": {
        const summary = Store.getNotificationSummary?.() || {};
        lines.push(
          `通知合計: ${summary.totalNotifications ?? 0} 件`,
          `未読 ${summary.unreadCount ?? 0} · 高優先 ${summary.highPriorityCount ?? 0}`,
          `期限超過 ${summary.overdueCount ?? 0} · 本日期限 ${summary.dueTodayCount ?? 0}`
        );
        if (projectId) {
          const p = Store.getProject?.(projectId);
          const counts = p ? Store.getProjectNotificationCounts?.(p) : null;
          if (counts) {
            lines.push("", `連携案件「${p.name}」: 未読 ${counts.unread} 件`);
          }
        }
        lines.push("", "通知の詳細は案件ハブ · 司令塔ダッシュボードをご確認ください。");
        break;
      }
      case "schedule": {
        const delayed = Store.getDelayedProjects?.() || [];
        const week = Store.getThisWeekProjects?.() || [];
        const today = Store.getTodayProjects?.() || [];
        lines.push(
          `今日の予定: ${today.length} 件`,
          `今週の予定: ${week.length} 件`,
          `工程遅延: ${delayed.length} 件`
        );
        if (delayed.length) {
          lines.push("", "— 遅延案件 —");
          delayed.slice(0, 5).forEach((p) => {
            lines.push(`· ${p.name}（終了予定 ${p.scheduleEndDate || "—"}）`);
          });
        }
        lines.push("", "カレンダー · 司令塔ダッシュボードで工程を確認できます。");
        break;
      }
      case "estimate": {
        const summary = Store.getFinanceSummary?.() || {};
        lines.push(
          `見積合計: ${formatYenLocal(summary.totalEstimate)}`,
          `原価合計: ${formatYenLocal(summary.totalCost)}`,
          `粗利合計: ${formatYenLocal(summary.totalGrossProfit)}`,
          `対象案件: ${summary.projectCount ?? 0} 件`
        );
        if (projectId) {
          const p = Store.getProject?.(projectId);
          if (p) {
            const fin = Store.calculateProjectFinance?.(p) || p.finance || {};
            lines.push(
              "",
              `連携案件「${p.name}」`,
              `見積 ${formatYenLocal(fin.estimateAmount)} · 原価 ${formatYenLocal(fin.costAmount)} · 粗利 ${formatYenLocal(fin.grossProfit)}`
            );
          }
        }
        lines.push("", "概算のたたき台です。正式見積は案件詳細 · 見積機能で確認してください。");
        break;
      }
      case "photo":
      default: {
        const Vision = getVision();
        if (photoFile) {
          lines.push("添付写真をもとに参考診断を実行します。");
        } else {
          lines.push(
            Vision?.PHOTO_GUIDE ||
              "現場写真を添付すると、劣化箇所の参考診断をより具体的にお伝えできます。",
            "",
            "「写真 · カメラ · 音声」から画像を選択するか、下の入力欄に状況を書いて送信してください。"
          );
        }
        if (userText) lines.push("", `相談: ${String(userText).slice(0, 120)}`);
        break;
      }
    }

    lines.push("", "※ 参考情報です。契約 · 請求 · 完了の確定は行いません。");
    return lines.join("\n");
  }

  function isStoreConsultIntent(intent) {
    return ["unpaid", "documents", "notifications", "schedule", "estimate"].includes(intent);
  }

  function bindProjectContext() {
    const projectId = getProjectIdFromUrl();
    const panel = $("[data-builder-ai-project-context]");
    const text = $("[data-builder-ai-project-context-text]");
    const detailLink = $("[data-builder-ai-project-detail-link]");
    if (!projectId || !panel) return projectId;

    const Store = global.TasuBuilderProjectStore;
    Store?.ensureSeed?.();
    const project = Store?.getProject?.(projectId);
    panel.hidden = false;
    if (text) {
      text.textContent = project
        ? `診断結果は案件「${project.name}」（${project.id}）に保存されます。`
        : `案件 ID ${projectId} に診断を保存します。`;
    }
    if (detailLink) {
      detailLink.href = `project-detail.html?id=${encodeURIComponent(projectId)}`;
    }
    return projectId;
  }

  function saveDiagnosisToProject(result, meta) {
    const projectId = getProjectIdFromUrl();
    if (!projectId || !result?.diagnosis) return null;
    const Store = global.TasuBuilderProjectStore;
    return Store?.saveVisionDiagnosis?.(projectId, result.diagnosis, meta) || null;
  }

  /** Phase 6-B: 将来の AI 日程変更 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareScheduleIntent(intent) {
    const projectId = getProjectIdFromUrl();
    if (!projectId || !intent) return null;
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewScheduleIntent?.(projectId, { ...intent, source: "ai_assistant" }) || null;
  }

  /** Phase 6-C: 将来の AI 収支 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareFinanceIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewFinanceIntent?.(intentText) || null;
  }

  /** Phase 6-D: 将来の AI 見積 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareEstimateIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewEstimateIntent?.(intentText) || null;
  }

  /** Phase 6-D: 将来の AI 請求 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareInvoiceIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewInvoiceIntent?.(intentText) || null;
  }

  /** Phase 6-E: 将来の AI 契約 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareContractIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewContractIntent?.(intentText) || null;
  }

  /** Phase 6-E: 将来の AI 完了 intent プレビュー（現時点では UI から未呼び出し） */
  function prepareCompletionIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewCompletionIntent?.(intentText) || null;
  }

  /** Phase 6-F: 将来の AI ドキュメント intent プレビュー（現時点では UI から未呼び出し） */
  function prepareDocumentIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewDocumentIntent?.(intentText) || null;
  }

  /** Phase 6-G: 将来の AI 通知 intent プレビュー（Gateway 未接続 · 実更新なし） */
  function prepareNotificationIntent(intentText) {
    const Store = global.TasuBuilderProjectStore;
    return Store?.previewNotificationIntent?.(intentText) || null;
  }

  let messages = loadHistory();
  let sending = false;
  let photoFile = null;
  let photoObjectUrl = "";

  function setStatus(text, busy) {
    const el = $("[data-builder-ai-ui-status]");
    if (el) {
      el.textContent = text || "";
      el.classList.toggle("builder-ai-ui-status--busy", Boolean(busy));
    }
    const send = $("[data-builder-ai-ui-send]");
    const input = $("[data-builder-ai-ui-input]");
    if (send) send.disabled = Boolean(busy);
    if (input) input.disabled = Boolean(busy);
  }

  function setVisionState(state) {
    const wrap = $("[data-builder-ai-ui-vision-result]");
    if (!wrap) return;
    const normalized = state || "idle";
    wrap.dataset.visionState = normalized;
    const visible = normalized !== "idle";
    wrap.hidden = !visible;
    wrap.classList.toggle("builder-ai-ui-vision-result--visible", visible);
    wrap.classList.toggle("builder-ai-ui-vision-result--analyzing", normalized === "analyzing");
    wrap.classList.toggle("builder-ai-ui-vision-result--complete", normalized === "complete");
    wrap.classList.toggle("builder-ai-ui-vision-result--error", normalized === "error");
    wrap.classList.toggle("builder-ai-ui-vision-result--no-image", normalized === "no_image");
  }

  function renderVisionDiagnosis(result) {
    const wrap = $("[data-builder-ai-ui-vision-result]");
    const body = $("[data-builder-ai-ui-vision-result-body]");
    if (!wrap || !body) return;

    if (!result?.diagnosis || !result?.displayHtml) {
      body.innerHTML = "";
      if (result?.visionState === "no_image") {
        body.innerHTML =
          '<p class="builder-ai-ui-vision-result__hint">現場写真を添付すると、AIの参考診断をより具体的に表示できます。</p>';
      }
      return;
    }

    body.innerHTML = result.displayHtml;
  }

  function formatMessageMeta(m) {
    const parts = [];
    const prefix = SOURCE_LABELS[m.source] || "";
    if (prefix) parts.push(prefix.trim());
    if (m.imageName && m.role === "user") parts.push(`📷 ${m.imageName}`);
    return parts.length ? parts.join(" · ") : "";
  }

  function formatMessageTime(m) {
    const ts = m.at || Date.now();
    try {
      return new Date(ts).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function renderDemoActions() {
    return `<div class="builder-ai-v2-msg__actions">
      <button type="button" class="builder-ai-v2-msg-action builder-ai-v2-msg-action--primary">詳細レポートを作成</button>
      <button type="button" class="builder-ai-v2-msg-action">工程表を確認</button>
    </div>`;
  }

  function renderMessages() {
    const log = $("[data-builder-ai-ui-messages]");
    if (!log) return;
    log.innerHTML = "";
    messages.forEach((m) => {
      if (m.role === "system") {
        const div = document.createElement("div");
        div.className = "builder-ai-ui-msg builder-ai-ui-msg--system builder-ai-v2-msg--system";
        div.textContent = m.content;
        log.appendChild(div);
        return;
      }
      const row = document.createElement("div");
      row.className = `builder-ai-v2-msg-row builder-ai-v2-msg-row--${m.role}`;
      const avatar = document.createElement("span");
      avatar.className = "builder-ai-v2-msg__avatar";
      avatar.setAttribute("aria-hidden", "true");
      if (m.role === "user") {
        avatar.textContent = "👤";
      } else {
        const avatarImg = document.createElement("img");
        avatarImg.className = "builder-ai-v2-msg__avatar-img";
        avatarImg.src = BUILDER_AI_CHAT_AVATAR;
        avatarImg.width = 42;
        avatarImg.height = 42;
        avatarImg.alt = "";
        avatarImg.decoding = "async";
        avatar.appendChild(avatarImg);
      }
      const stack = document.createElement("div");
      stack.className = `builder-ai-v2-msg__stack builder-ai-v2-msg__stack--${m.role}`;
      if (m.role === "assistant") {
        const sender = document.createElement("span");
        sender.className = "builder-ai-v2-msg__sender";
        sender.textContent = "Builder AI";
        stack.appendChild(sender);
      }
      const bubble = document.createElement("div");
      bubble.className = `builder-ai-ui-msg builder-ai-v2-msg builder-ai-v2-msg--${m.role}`;
      const meta = formatMessageMeta(m);
      const time = formatMessageTime(m);
      let body = escapeHtml(m.content);
      if (meta && m.role === "user") {
        body += `<br><span class="builder-ai-ui-msg__meta">${escapeHtml(meta)}</span>`;
      } else if (m.imageName && m.role === "user") {
        body += `<br><span class="builder-ai-ui-msg__meta">📷 ${escapeHtml(m.imageName)}</span>`;
      }
      bubble.innerHTML = body;
      if (m.demoActions) {
        bubble.insertAdjacentHTML("beforeend", renderDemoActions());
      }
      stack.appendChild(bubble);
      const timeEl = document.createElement("time");
      timeEl.className = "builder-ai-v2-msg__time";
      timeEl.dateTime = new Date(m.at || Date.now()).toISOString();
      timeEl.textContent = time;
      stack.appendChild(timeEl);
      if (m.role === "user") {
        row.appendChild(stack);
        row.appendChild(avatar);
      } else {
        row.appendChild(avatar);
        row.appendChild(stack);
      }
      log.appendChild(row);
    });
    log.scrollTop = log.scrollHeight;
    renderHistoryRail();
  }

  function renderHistoryRail() {
    const list = $("[data-builder-ai-ui-history]");
    if (!list) return;
    const items = messages
      .filter((m) => m.role === "user")
      .slice(-4)
      .reverse();
    if (!items.length) {
      list.innerHTML = '<li class="builder-ai-v2-history__empty">まだ相談履歴がありません</li>';
      return;
    }
    list.innerHTML = items
      .map((m) => {
        const title = String(m.content || "").trim().slice(0, 42) || "相談";
        const thumb = m.imageName ? "📷" : "💬";
        const when = formatMessageTime(m);
        return `<li class="builder-ai-v2-history__item"><span class="builder-ai-v2-history__thumb" aria-hidden="true">${thumb}</span><div><p class="builder-ai-v2-history__title">${escapeHtml(title)}</p><p class="builder-ai-v2-history__meta">${escapeHtml(when)}</p></div></li>`;
      })
      .join("");
  }

  function pushSystem(text) {
    messages.push({ role: "system", content: text, source: "text" });
    saveHistory(messages);
    renderMessages();
  }

  function clearPhotoPreview() {
    if (photoObjectUrl) {
      try {
        URL.revokeObjectURL(photoObjectUrl);
      } catch {
        /* ignore */
      }
    }
    photoObjectUrl = "";
    photoFile = null;
    const preview = $("[data-builder-ai-ui-photo-preview]");
    const thumb = $("[data-builder-ai-ui-photo-thumb]");
    const nameEl = $("[data-builder-ai-ui-photo-name]");
    const input = $("[data-builder-ai-ui-photo-input]");
    if (preview) preview.classList.remove("builder-ai-ui-photo__preview--visible");
    if (thumb) {
      thumb.removeAttribute("src");
      thumb.hidden = true;
    }
    if (nameEl) nameEl.textContent = "";
    if (input) input.value = "";
  }

  function showPhotoPreview(file) {
    const Vision = getVision();
    if (Vision?.isImageTooLarge?.(file)) {
      pushSystem(`画像は ${Vision.MAX_IMAGE_MB || 4}MB 以下にしてください。`);
      return;
    }
    const preview = $("[data-builder-ai-ui-photo-preview]");
    const thumb = $("[data-builder-ai-ui-photo-thumb]");
    const nameEl = $("[data-builder-ai-ui-photo-name]");
    if (!preview || !thumb || !nameEl) return;
    if (photoObjectUrl) {
      try {
        URL.revokeObjectURL(photoObjectUrl);
      } catch {
        /* ignore */
      }
    }
    photoFile = file;
    photoObjectUrl = URL.createObjectURL(file);
    thumb.src = photoObjectUrl;
    thumb.hidden = false;
    nameEl.textContent = file.name;
    preview.classList.add("builder-ai-ui-photo__preview--visible");
  }

  function bindPhotoUpload() {
    const input = $("[data-builder-ai-ui-photo-input]");
    const removeBtn = $("[data-builder-ai-ui-photo-remove]");
    const Vision = getVision();
    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (Vision?.isAcceptedImage && !Vision.isAcceptedImage(file)) {
        pushSystem("jpg / png / webp 形式の画像を選択してください。");
        input.value = "";
        return;
      }
      showPhotoPreview(file);
    });

    removeBtn?.addEventListener("click", () => clearPhotoPreview());
  }

  function quickCardHtml(p) {
    return `<button type="button" class="builder-ai-v2-quick-card" data-builder-ai-ui-quick="${escapeHtml(p.text)}" data-builder-ai-ui-intent="${escapeHtml(p.intent || "")}">
      <span class="builder-ai-v2-quick-card__icon" aria-hidden="true">${escapeHtml(p.icon || "💬")}</span>
      <span class="builder-ai-v2-quick-card__body">
        <strong class="builder-ai-v2-quick-card__title">${escapeHtml(p.label)}</strong>
        <span class="builder-ai-v2-quick-card__desc">${escapeHtml(p.desc || "")}</span>
      </span>
      <span class="builder-ai-v2-quick-card__chev" aria-hidden="true">›</span>
    </button>`;
  }

  function bindQuickPrompts() {
    const html = QUICK_PROMPTS.map(quickCardHtml).join("");
    const containers = document.querySelectorAll("[data-builder-ai-ui-quick], [data-builder-ai-ui-quick-mobile]");
    if (!containers.length) return;
    containers.forEach((wrap) => {
      wrap.innerHTML = html;
    });
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-builder-ai-ui-quick]");
      if (!btn || sending) return;
      const text = btn.getAttribute("data-builder-ai-ui-quick") || "";
      const intent = btn.getAttribute("data-builder-ai-ui-intent") || "";
      void submit({ channel: "text", text, options: { fromQuick: true, consultIntent: intent } });
    });
  }

  function bindShellUI() {
    const sidebar = document.querySelector(".builder-ai-v2-sidebar");
    const toggle = $("[data-builder-ai-v2-menu-toggle]");
    const backdrop = $("[data-builder-ai-v2-backdrop]");
    const closeSidebar = () => {
      document.body.classList.remove("builder-ai-v2-sidebar-open");
      toggle?.setAttribute("aria-expanded", "false");
      backdrop?.setAttribute("hidden", "");
    };
    toggle?.addEventListener("click", () => {
      const open = document.body.classList.toggle("builder-ai-v2-sidebar-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) backdrop?.removeAttribute("hidden");
      else backdrop?.setAttribute("hidden", "");
    });
    backdrop?.addEventListener("click", closeSidebar);
    sidebar?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 767px)").matches) closeSidebar();
      });
    });
    $("[data-builder-ai-v2-history-scroll]")?.addEventListener("click", () => {
      $("[data-builder-ai-ui-messages]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bindVoiceButton() {
    const handler = async () => {
      if (sending) return;
      getIntegration()?.stopVoiceOutput?.();
      const out = await (getIntegration()?.submitVoiceCapture?.() || Promise.resolve({ ok: false, error: "voice_unavailable" }));
      if (!out?.ok && out?.error) pushSystem(out.error);
    };
    $("[data-builder-ai-ui-voice]")?.addEventListener("click", handler);
    $("[data-builder-ai-ui-voice-composer]")?.addEventListener("click", handler);
  }

  function bindLiveModule() {
    global.TasuBuilderAILive?.init?.({
      onSnapshot: async ({ file, question }) => {
        setVisionState("analyzing");
        setStatus("スナップショット解析中…", true);
        await submit({ channel: "text", text: question, options: { photoFile: file, source: "camera_snapshot", fromLive: true } });
      },
      onStatus: (text) => {
        if (text && !sending) setStatus(text, false);
      },
    });
  }

  function bindComposerVoice() {
    const input = $("[data-builder-ai-ui-input]");
    const composer = input?.closest(".builder-ai-ui-composer");
    if (!input || !composer) return;

    global.TasuBuilderAIVoice?.mountComposerVoice?.({
      inputEl: input,
      hostEl: composer,
      onTranscript: (text) => submit({ channel: "voice", text, options: { fromVoice: true } }),
    });

    $("[data-builder-ai-ui-send]")?.addEventListener(
      "click",
      () => getIntegration()?.stopVoiceOutput?.(),
      true
    );
  }

  async function sendMessage(forcedText, opts) {
    if (sending) return;
    const options = opts && typeof opts === "object" ? opts : {};
    const input = $("[data-builder-ai-ui-input]");
    const text = String(forcedText != null ? forcedText : input?.value || "").trim();
    if (!text) return;

    const source = options.source || "text";
    const Vision = getVision();
    const Orch = global.TasuBuilderAICalcOrchestrator;
    const sentPhoto = options.photoFile || photoFile;
    const sentPhotoName = sentPhoto?.name || "";
    const consultIntent =
      options.consultIntent || detectConsultIntent(text);

    getIntegration()?.stopVoiceOutput?.();

    if (UI_LOCAL_ONLY && isStoreConsultIntent(consultIntent) && !sentPhoto) {
      sending = true;
      setStatus("確認中…", true);
      messages.push({ role: "user", content: text, source });
      renderMessages();
      if (input && !options.fromQuick && !options.fromVoice) input.value = "";

      const reply = buildLocalStoreConsultReply(consultIntent, text);
      messages.push({ role: "assistant", content: reply, source: "text" });
      saveHistory(messages);
      renderMessages();
      setStatus("ローカル参考回答", false);
      setTimeout(() => setStatus("", false), 2000);
      sending = false;
      return;
    }

    if (!sentPhoto && Orch?.isCalcQuery?.(text)) {
      sending = true;
      setStatus("計算中…", true);
      messages.push({ role: "user", content: text, source });
      renderMessages();
      if (input && !options.fromQuick && !options.fromVoice) input.value = "";

      const calcResult = await Orch.runFromNaturalLanguage({
        userText: text,
        actor: getActor(),
        preferRemote: false,
      });

      if (calcResult.ok && calcResult.reply) {
        messages.push({ role: "assistant", content: calcResult.reply, source: "text" });
        saveHistory(messages);
        renderMessages();
        getIntegration()?.notifyAssistantReply?.(calcResult.reply);
        setStatus(calcResult.usedRemote ? "計算 + AI 要約" : "計算完了", false);
        setTimeout(() => setStatus("", false), 2000);
      } else if (calcResult.reply) {
        pushSystem(calcResult.reply);
        setStatus("", false);
      } else {
        pushSystem("計算条件が不足しています。面積 · 原価 · 金額 等を追記してください。");
        setStatus("", false);
      }
      sending = false;
      return;
    }

    if (!Vision?.runFieldDiagnosis) {
      if (UI_LOCAL_ONLY) {
        sending = true;
        setStatus("送信中…", true);
        messages.push({ role: "user", content: text, source });
        renderMessages();
        if (input && !options.fromQuick && !options.fromVoice) input.value = "";
        const reply = buildLocalStoreConsultReply(consultIntent || "photo", text);
        messages.push({ role: "assistant", content: reply, source: "text" });
        saveHistory(messages);
        renderMessages();
        setStatus("ローカル参考回答", false);
        setTimeout(() => setStatus("", false), 2000);
        sending = false;
        return;
      }
      pushSystem("Builder AI Vision モジュールが読み込まれていません。");
      return;
    }

    sending = true;
    setVisionState(sentPhoto ? "analyzing" : "idle");
    setStatus(sentPhoto ? "解析中…" : "送信中…", true);

    messages.push({
      role: "user",
      content: text,
      imageName: sentPhotoName,
      source,
    });
    renderMessages();
    if (input && !options.fromQuick && !options.fromVoice) input.value = "";

    const result = await Vision.runFieldDiagnosis({
      userText: text,
      photoFile: sentPhoto,
      messages,
      actor: getActor(),
      preferRemote: UI_LOCAL_ONLY ? false : undefined,
    });

    if (!result.ok && result.reply) {
      setVisionState("error");
      renderVisionDiagnosis(result);
      pushSystem(result.reply);
      setStatus("エラー", false);
      setTimeout(() => setStatus("", false), 2500);
      sending = false;
      return;
    }

    if (result.reply) {
      messages.push({
        role: "assistant",
        content: result.reply,
        source: "text",
        diagnosis: result.diagnosis || null,
      });
      saveHistory(messages);
      renderMessages();
      getIntegration()?.notifyAssistantReply?.(result.reply);
    }

    if (result.visionState === "no_image" || result.photoRequired) {
      setVisionState("no_image");
      renderVisionDiagnosis(result);
    } else if (result.diagnosis) {
      setVisionState("complete");
      renderVisionDiagnosis(result);
      if (result.usedVision && getProjectIdFromUrl()) {
        const saved = saveDiagnosisToProject(result, {
          userText: text,
          imageName: sentPhotoName,
        });
        if (saved?.ok) {
          pushSystem(`案件 ${getProjectIdFromUrl()} に AI 参考診断を保存しました。`);
        }
      }
    } else {
      setVisionState("idle");
      renderVisionDiagnosis(null);
    }

    if (result.usedVision && sentPhoto && !options.fromLive) {
      clearPhotoPreview();
    }

    if (result.usedRemote) {
      setStatus("診断完了", false);
      setTimeout(() => setStatus("", false), 2000);
    } else if (result.fallback_used) {
      setStatus("参考診断（オフライン）", false);
      setTimeout(() => setStatus("", false), 2500);
    } else if (result.photoRequired) {
      setStatus("画像なし", false);
      setTimeout(() => setStatus("", false), 2000);
    } else {
      setStatus("", false);
    }

    sending = false;
  }

  function bindComposer() {
    $("[data-builder-ai-ui-send]")?.addEventListener("click", () => {
      const input = $("[data-builder-ai-ui-input]");
      const text = String(input?.value || "").trim();
      void submit({ channel: "text", text });
    });
    $("[data-builder-ai-ui-input]")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        const input = $("[data-builder-ai-ui-input]");
        const text = String(input?.value || "").trim();
        void submit({ channel: "text", text });
      }
    });
    $("[data-builder-ai-ui-clear]")?.addEventListener("click", () => {
      messages = [];
      saveHistory(messages);
      renderMessages();
      clearPhotoPreview();
      global.TasuBuilderAILive?.closePanel?.();
      getIntegration()?.stopVoiceOutput?.();
      getIntegration()?.stopSession?.("cleared");
      setStatus("", false);
      setVisionState("idle");
      renderVisionDiagnosis(null);
    });
  }

  function seedDemoConversation() {
    const base = Date.now() - 8 * 60 * 1000;
    messages.push(
      {
        role: "user",
        content: "本日の現場状況を教えてください。資材搬入は予定通りですか？",
        source: "text",
        at: base,
      },
      {
        role: "assistant",
        content:
          "おはようございます。本日の資材搬入予定を確認しました。\n\n· コンクリート打設資材 — 09:00 搬入済み\n· 外壁パネル — 13:00 到着予定（15分の遅延見込み）\n\n搬入前に現場写真をいただければ、配置場所の確認もお手伝いできます。",
        source: "text",
        at: base + 2800,
        demoActions: true,
      },
      {
        role: "user",
        content: "外壁パネル搬入前に写真を送ります。配置場所の判断もお願いします。",
        source: "text",
        at: base + 180000,
      }
    );
    saveHistory(messages);
  }

  function seedWelcome() {
    if (messages.length) return;
    seedDemoConversation();
  }

  function init() {
    bindProjectContext();
    bindHubLinks();
    seedWelcome();
    renderMessages();
    bindPhotoUpload();
    bindQuickPrompts();
    bindShellUI();
    bindLiveModule();
    initVoiceIntegration();
    bindVoiceButton();
    bindComposerVoice();
    bindComposer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuBuilderAIUi = {
    init,
    submit,
    sendMessage,
    pushSystem,
    prepareScheduleIntent,
    prepareFinanceIntent,
    prepareEstimateIntent,
    prepareInvoiceIntent,
    prepareContractIntent,
    prepareCompletionIntent,
    prepareDocumentIntent,
    prepareNotificationIntent,
    UI_LOCAL_ONLY,
    buildLocalStoreConsultReply,
    useFieldStub: false,
  };
})(typeof window !== "undefined" ? window : globalThis);
