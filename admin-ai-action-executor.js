/**
 * AI運営司令塔 — ワンボタン実行（確認モーダル + 監査ログ）
 * 送信・外部APIはモック。UI / 状態遷移 / 監査は本番想定。
 */
(function (global) {
  "use strict";

  const EXECUTED_KEY = "tasu_ai_action_executed_v1";
  const AUDIT_KEY = "tasu_ai_action_audit_log_v1";
  const MAX_AUDIT = 200;

  const ACTION_TYPE = Object.freeze({
    reviewOnly: "review_only",
    prepareReply: "prepare_reply",
    sendReply: "send_reply",
    bulkResolve: "bulk_resolve",
    openDetail: "open_detail",
  });

  const ACTION_LEVEL = Object.freeze({
    reviewOnly: 1,
    draftPrep: 2,
    mockExec: 3,
    realSend: 4,
    settingsChange: 5,
  });

  const MAX_EXECUTABLE_LEVEL = ACTION_LEVEL.mockExec;

  const ACTION_LEVEL_LABEL = Object.freeze({
    1: "詳細確認のみ",
    2: "下書き・準備のみ",
    3: "モック実行",
    4: "実送信",
    5: "設定変更・料金変更",
  });

  const EXECUTABLE_TYPES = new Set([
    ACTION_TYPE.prepareReply,
    ACTION_TYPE.sendReply,
    ACTION_TYPE.bulkResolve,
  ]);

  let boardIndex = Object.create(null);
  let pendingRow = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, data) {
    global.localStorage.setItem(key, JSON.stringify(data));
  }

  function readExecutedMap() {
    const raw = readJson(EXECUTED_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function writeExecutedMap(map) {
    writeJson(EXECUTED_KEY, map);
  }

  function readAuditLog() {
    const list = readJson(AUDIT_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function appendAudit(entry) {
    const list = readAuditLog();
    list.unshift(entry);
    writeJson(AUDIT_KEY, list.slice(0, MAX_AUDIT));
    return entry;
  }

  function getExecutedBy() {
    const jwt = global.TasuAuthCurrentUser?.getCurrentUser?.()?.talkUserId;
    if (jwt) return jwt;
    if (global.TasuAuthOpsGuard?.canAccessOps?.()) {
      return global.TasuAuthCurrentUser?.getCurrentUser?.()?.talkUserId || "ops_admin";
    }
    if (global.TasuAuthCurrentUser?.canUseLocalStorageFallback?.() === false) return "";
    return (
      global.TasuMemberAuth?.getCurrentUserId?.() ||
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      "ops_admin"
    );
  }

  function formatJaDateTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit", month: "numeric", day: "numeric" });
    } catch {
      return String(iso).slice(0, 16);
    }
  }

  function isExecutableType(type) {
    return EXECUTABLE_TYPES.has(String(type || ""));
  }

  function inferActionLevel(actionType, explicitLevel) {
    const n = Number(explicitLevel);
    if (n >= 1 && n <= 5) return n;
    const t = String(actionType || "");
    if (t === ACTION_TYPE.prepareReply) return ACTION_LEVEL.draftPrep;
    if (t === ACTION_TYPE.sendReply || t === ACTION_TYPE.bulkResolve) return ACTION_LEVEL.mockExec;
    return ACTION_LEVEL.reviewOnly;
  }

  function getActionLevelLabel(level) {
    return ACTION_LEVEL_LABEL[level] || `Lv.${level}`;
  }

  function isLevelBlocked(level) {
    return Number(level) >= ACTION_LEVEL.realSend;
  }

  function canExecuteRow(row) {
    if (!row || !isExecutableType(row.actionType)) return false;
    const level = inferActionLevel(row.actionType, row.actionLevel);
    return level <= MAX_EXECUTABLE_LEVEL;
  }

  function getExecutedState(actionId) {
    return readExecutedMap()[String(actionId || "")] || null;
  }

  function markExecuted(actionId, patch) {
    const map = readExecutedMap();
    map[String(actionId)] = {
      ...(map[String(actionId)] || {}),
      ...patch,
      executedAt: patch.executedAt || new Date().toISOString(),
    };
    writeExecutedMap(map);
    return map[String(actionId)];
  }

  function indexBoard(board) {
    boardIndex = Object.create(null);
    ["urgent", "today", "ai", "latest", "normal"].forEach((zone) => {
      (board[zone] || []).forEach((row) => {
        boardIndex[row.id] = row;
      });
    });
  }

  function getBoardRow(actionId) {
    return boardIndex[String(actionId || "")] || null;
  }

  function buildPreview(row) {
    const payload = row.executionPayload || {};
    const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
    if (row.actionType === ACTION_TYPE.sendReply || row.actionType === ACTION_TYPE.prepareReply) {
      warnings.push("実際の送信・Stripe操作は行いません（準備確認のみ）。");
    }
    if (row.actionType === ACTION_TYPE.bulkResolve) {
      warnings.push("チケットの自動クローズは行いません。整理ラベル付与のみ（モック）。");
    }
    return {
      target: payload.target || row.happened,
      executionSummary: payload.executionSummary || row.recommendation,
      aiJudgement: row.aiDecision,
      recommendationReason: payload.recommendationReason || row.recommendation,
      bodyText: payload.bodyText || "",
      attachments: payload.attachments || [],
      warnings: [...new Set(warnings.filter(Boolean))],
      before: payload.before || null,
      afterPreview: payload.afterPreview || null,
    };
  }

  function mockExecute(row) {
    const type = row.actionType;
    const payload = row.executionPayload || {};
    const before = payload.before || { status: "pending" };

    if (type === ACTION_TYPE.prepareReply) {
      const after = {
        status: "reply_prepared",
        connectId: payload.connectId || null,
        ticketId: payload.ticketId || null,
        preparedAt: new Date().toISOString(),
      };
      return {
        ok: true,
        result: "返信文・添付候補の確認準備を完了しました（送信は未実行）。",
        before,
        after,
      };
    }

    if (type === ACTION_TYPE.sendReply) {
      const after = {
        status: "send_prepared",
        ticketId: payload.ticketId || null,
        draftSaved: true,
        sent: false,
        preparedAt: new Date().toISOString(),
      };
      return {
        ok: true,
        result: "問い合わせ返信の送信準備を完了しました（実送信は未実行）。",
        before,
        after,
      };
    }

    if (type === ACTION_TYPE.bulkResolve) {
      const ids = payload.ticketIds || [];
      const after = {
        status: "bulk_organized",
        ticketIds: ids,
        organizedCount: ids.length,
        organizedAt: new Date().toISOString(),
      };
      return {
        ok: true,
        result: `${ids.length}件の未対応チケットを整理キューに登録しました（自動クローズなし）。`,
        before,
        after,
      };
    }

    return { ok: false, result: "この操作は実行できません。", before, after: before };
  }

  function renderModalContent(row, preview) {
    const host = global.document?.querySelector("[data-ops-action-modal-body]");
    if (!host) return;
    const attachHtml =
      preview.attachments.length > 0
        ? `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">添付候補</h3><ul class="ops-ai-action-modal__list">${preview.attachments
            .map((a) => `<li>${esc(a)}</li>`)
            .join("")}</ul></section>`
        : "";
    const bodyHtml = preview.bodyText
      ? `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">送信文 / 変更内容</h3><pre class="ops-ai-action-modal__pre">${esc(preview.bodyText)}</pre></section>`
      : "";
    const warnHtml =
      preview.warnings.length > 0
        ? `<section class="ops-ai-action-modal__block ops-ai-action-modal__block--warn"><h3 class="ops-ai-action-modal__label">注意点</h3><ul class="ops-ai-action-modal__list">${preview.warnings
            .map((w) => `<li>${esc(w)}</li>`)
            .join("")}</ul></section>`
        : "";

    host.innerHTML =
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">対象</h3><p class="ops-ai-action-modal__text">${esc(preview.target)}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">実行内容</h3><p class="ops-ai-action-modal__text">${esc(preview.executionSummary)}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">AI判断</h3><p class="ops-ai-action-modal__text">${esc(preview.aiJudgement)}</p></section>` +
      `<section class="ops-ai-action-modal__block"><h3 class="ops-ai-action-modal__label">推奨理由</h3><p class="ops-ai-action-modal__text">${esc(preview.recommendationReason)}</p></section>` +
      bodyHtml +
      attachHtml +
      warnHtml;

    const titleEl = global.document?.querySelector("[data-ops-action-modal-title]");
    if (titleEl) titleEl.textContent = row.actionLabel || "実行内容の確認";
  }

  function openModal(row) {
    const modal = global.document?.querySelector("[data-ops-action-modal]");
    if (!modal || !row) return;
    if (!canExecuteRow(row)) return;
    pendingRow = row;
    global.TasuAdminAiActionPreflightChecklist?.setModalRunVisible?.(true);
    delete modal.dataset.mode;
    delete modal.dataset.actionLevel;
    renderModalContent(row, buildPreview(row));
    modal.hidden = false;
    modal.dataset.actionId = row.id;
    modal.dataset.actionType = row.actionType || "";
  }

  function closeModal() {
    const modal = global.document?.querySelector("[data-ops-action-modal]");
    if (!modal) return;
    modal.hidden = true;
    delete modal.dataset.actionId;
    delete modal.dataset.actionType;
    delete modal.dataset.mode;
    delete modal.dataset.actionLevel;
    global.TasuAdminAiActionPreflightChecklist?.setModalRunVisible?.(true);
    pendingRow = null;
  }

  function runPendingExecution() {
    const row = pendingRow;
    if (!row || !canExecuteRow(row)) {
      closeModal();
      return { ok: false, reason: "invalid_action" };
    }

    const exec = mockExecute(row);
    const executedAt = new Date().toISOString();
    const executedBy = getExecutedBy();
    const preview = buildPreview(row);
    const level = inferActionLevel(row.actionType, row.actionLevel);
    const auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      actionId: row.id,
      actionType: row.actionType,
      actionLevel: level,
      source: row.source || row.executionPayload?.source || "action_board",
      title: row.happened,
      target: preview.target,
      executedAt,
      executedBy,
      before: exec.before,
      after: exec.after,
      aiJudgement: row.aiDecision,
      recommendation: row.recommendation,
      result: exec.result,
      bodyText: preview.bodyText || "",
      attachments: preview.attachments || [],
      warnings: preview.warnings || [],
    };

    appendAudit(auditEntry);
    markExecuted(row.id, {
      actionType: row.actionType,
      resultMessage: exec.result,
      auditActionId: auditEntry.actionId,
    });

    closeModal();

    try {
      global.dispatchEvent(new CustomEvent("tasu:ai-action-executed", { detail: auditEntry }));
    } catch {
      /* ignore */
    }

    global.TasuAdminAiActionBoard?.refreshFromContext?.();
    return { ok: exec.ok, audit: auditEntry };
  }

  function bindModal() {
    const modal = global.document?.querySelector("[data-ops-action-modal]");
    if (!modal || modal.dataset.wired === "1") return;
    modal.dataset.wired = "1";

    modal.querySelector("[data-ops-action-modal-backdrop]")?.addEventListener("click", closeModal);
    modal.querySelector("[data-ops-action-modal-cancel]")?.addEventListener("click", closeModal);
    modal.querySelector("[data-ops-action-modal-run]")?.addEventListener("click", () => {
      runPendingExecution();
    });

    global.document?.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.hidden) closeModal();
    });
  }

  function bindBoardExecute() {
    const root = global.document?.querySelector("[data-ops-action-board]");
    if (!root || root.dataset.execWired === "1") return;
    root.dataset.execWired = "1";

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ops-action-execute]");
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute("data-ops-action-execute");
      const row = getBoardRow(id);
      if (!row || getExecutedState(id) || !canExecuteRow(row)) return;
      openModal(row);
    });
  }

  function init() {
    bindModal();
    bindBoardExecute();
  }

  function clearForTests() {
    writeJson(EXECUTED_KEY, {});
    writeJson(AUDIT_KEY, []);
    pendingRow = null;
  }

  global.TasuAdminAiActionExecutor = {
    ACTION_TYPE,
    ACTION_LEVEL,
    ACTION_LEVEL_LABEL,
    MAX_EXECUTABLE_LEVEL,
    EXECUTABLE_TYPES,
    inferActionLevel,
    getActionLevelLabel,
    isLevelBlocked,
    canExecuteRow,
    isExecutableType,
    getExecutedState,
    markExecuted,
    readAuditLog,
    appendAudit,
    indexBoard,
    getBoardRow,
    buildPreview,
    mockExecute,
    openModal,
    closeModal,
    runPendingExecution,
    init,
    clearForTests,
    formatJaDateTime,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
