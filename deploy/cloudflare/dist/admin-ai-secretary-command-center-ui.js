/**
 * AI 秘書 Phase 5-C — Command Center UI（Queue · フィルタ · L3/L4 · 朝レポート · OpsEvent）
 */
(function (global) {
  "use strict";

  const DEFAULT_FILTERS = Object.freeze({
    levelId: "",
    agentId: "",
    source: "",
    status: "",
    urgency: "",
  });

  let filters = { ...DEFAULT_FILTERS };
  let selectedTaskId = null;
  let selectedEventId = null;
  let lastMorningReport = null;
  let bound = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(ms) {
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
    } catch {
      return "—";
    }
  }

  function getRegistry() {
    return global.TasuSecretaryAgentRegistry;
  }

  function getQueue() {
    return global.TasuSecretaryTaskQueue;
  }

  function getHSG() {
    return global.TasuAdminAiHumanSendGate;
  }

  function queryRoot() {
    const doc = typeof document !== "undefined" ? document : null;
    return doc ? doc.querySelector("[data-ops-secretary-command-center]") : null;
  }

  function agentLabel(id) {
    return getRegistry()?.getAgent?.(id)?.label || id || "—";
  }

  function levelBadge(levelId, ownerOnly) {
    if (levelId === "L4" || ownerOnly) {
      return `<span class="ops-cc-badge ops-cc-badge--l4" data-owner-only>L4 · あなた対応</span>`;
    }
    if (levelId === "L3") return `<span class="ops-cc-badge ops-cc-badge--l3">L3 · 承認待ち</span>`;
    if (levelId === "L1") return `<span class="ops-cc-badge ops-cc-badge--l1">L1</span>`;
    return `<span class="ops-cc-badge ops-cc-badge--l2">${esc(levelId || "L2")}</span>`;
  }

  function urgencyBadge(u) {
    const cls =
      u === "critical" ? "critical" : u === "high" ? "high" : u === "low" ? "low" : "medium";
    return `<span class="ops-cc-urgency ops-cc-urgency--${cls}">${esc(u || "medium")}</span>`;
  }

  function emptyState(title, detail) {
    return (
      `<div class="ops-cc-empty" role="status">` +
      `<p class="ops-cc-empty__title">${esc(title)}</p>` +
      `<p class="ops-cc-empty__detail">${esc(detail)}</p>` +
      `</div>`
    );
  }

  function renderFiltersHtml() {
    const Registry = getRegistry();
    const agents = Registry?.listAgents?.() || [];
    const Queue = getQueue();
    const tasks = Queue?.listTasks?.() || [];
    const sources = [...new Set(tasks.map((t) => t.source).filter(Boolean))];

    const agentOpts = agents
      .map(
        (a) =>
          `<option value="${esc(a.id)}"${filters.agentId === a.id ? " selected" : ""}>${esc(a.label)}</option>`
      )
      .join("");

    const sourceOpts = sources
      .map((s) => `<option value="${esc(s)}"${filters.source === s ? " selected" : ""}>${esc(s)}</option>`)
      .join("");

    return (
      `<div class="ops-cc-filters" data-ops-cc-filters>` +
      `<label>Level<select data-ops-cc-filter="levelId">` +
      `<option value="">すべて</option>` +
      ["L1", "L2", "L3", "L4"]
        .map((l) => `<option value="${l}"${filters.levelId === l ? " selected" : ""}>${l}</option>`)
        .join("") +
      `</select></label>` +
      `<label>Agent<select data-ops-cc-filter="agentId"><option value="">すべて</option>${agentOpts}</select></label>` +
      `<label>Source<select data-ops-cc-filter="source"><option value="">すべて</option>${sourceOpts}</select></label>` +
      `<label>Status<select data-ops-cc-filter="status">` +
      `<option value="">すべて</option>` +
      (Queue?.STATUSES || [])
        .map((s) => `<option value="${s}"${filters.status === s ? " selected" : ""}>${s}</option>`)
        .join("") +
      `</select></label>` +
      `<label>Urgency<select data-ops-cc-filter="urgency">` +
      `<option value="">すべて</option>` +
      ["critical", "high", "medium", "low"]
        .map((u) => `<option value="${u}"${filters.urgency === u ? " selected" : ""}>${u}</option>`)
        .join("") +
      `</select></label>` +
      `<button type="button" class="ops-p2-chat__quick-btn" data-ops-cc-filter-reset>リセット</button>` +
      `</div>`
    );
  }

  function renderQueueTable() {
    const Queue = getQueue();
    if (!Queue?.listTasks) {
      return emptyState("Queue 未読込", "Task Queue モジュールがありません。");
    }

    const tasks = Queue.listTasks({ ...filters, limit: 30 });
    if (!tasks.length) {
      return emptyState("Queue なし", "フィルタ条件に一致するタスクがありません。");
    }

    const rows = tasks
      .map((t) => {
        const sel = selectedTaskId === t.id ? " ops-cc-row--selected" : "";
        const ownerRow = t.levelId === "L4" || t.ownerOnly ? " ops-cc-row--owner" : "";
        return (
          `<tr class="ops-cc-row${sel}${ownerRow}" data-ops-cc-task-row="${esc(t.id)}">` +
          `<td>${levelBadge(t.levelId, t.ownerOnly)}</td>` +
          `<td>${esc(agentLabel(t.agentId))}</td>` +
          `<td>${esc(t.source)}</td>` +
          `<td>${esc(t.status)}</td>` +
          `<td>${urgencyBadge(t.urgency)}</td>` +
          `<td>${formatTime(t.createdAt)}</td>` +
          `<td class="ops-cc-cell-preview">${esc(t.userText.slice(0, 60))}</td>` +
          `</tr>`
        );
      })
      .join("");

    return (
      `<div class="ops-cc-queue" data-ops-cc-queue>` +
      `<h4 class="ops-cc-section-title">Task Queue</h4>` +
      `<div class="ops-ai-table-wrap"><table class="ops-ai-table ops-cc-table">` +
      `<thead><tr><th>Level</th><th>Agent</th><th>Source</th><th>Status</th><th>Urgency</th><th>Created</th><th>Preview</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></div></div>`
    );
  }

  function renderL3Panel() {
    const HSG = getHSG();
    if (!HSG?.readPendingQueue) {
      return emptyState("承認キュー未接続", "Human Send Gate が読み込まれていません。");
    }

    const pending = HSG.readPendingQueue().filter((p) => p.source === "orchestrator" || p.payload?.orchestrator);
    if (!pending.length) {
      return (
        `<div class="ops-cc-l3" data-ops-cc-l3>` +
        `<h4 class="ops-cc-section-title">L3 承認キュー</h4>` +
        emptyState("承認待ちなし", "Orchestrator 経由の L3 返信案はありません。") +
        `</div>`
      );
    }

    const cards = pending
      .map((p) => {
        const agentId = p.payload?.agentId || "secretary";
        return (
          `<article class="ops-cc-l3-card" data-ops-cc-l3-card="${esc(p.id)}">` +
          `<header><strong>返信案</strong> · ${esc(p.source)} · ${esc(agentLabel(agentId))}</header>` +
          `<textarea class="ops-cc-l3-edit" data-ops-cc-l3-proposal="${esc(p.id)}" rows="3">${esc(p.proposal || p.recommendation)}</textarea>` +
          `<p class="ops-cc-l3-meta">${esc(p.reason || "")}</p>` +
          `<div class="ops-cc-l3-actions">` +
          `<button type="button" class="ops-p2-chat__quick-btn" data-ops-cc-l3-approve="${esc(p.id)}">承認（送信なし）</button>` +
          `<button type="button" class="ops-p2-chat__quick-btn" data-ops-cc-l3-reject="${esc(p.id)}">却下</button>` +
          `<button type="button" class="ops-p2-chat__quick-btn" data-ops-cc-l3-save="${esc(p.id)}">編集保存</button>` +
          `</div></article>`
        );
      })
      .join("");

    return (
      `<div class="ops-cc-l3" data-ops-cc-l3>` +
      `<h4 class="ops-cc-section-title">L3 承認キュー <span class="ops-cc-count">${pending.length}</span></h4>` +
      `<p class="ops-cc-hint">承認は記録のみです。利用者への送信は Phase 6 以降。</p>` +
      cards +
      `</div>`
    );
  }

  function renderL4Panel() {
    const Queue = getQueue();
    const l4 = (Queue?.listTasks?.() || []).filter((t) => t.levelId === "L4" || t.ownerOnly);
    if (!l4.length) {
      return (
        `<div class="ops-cc-l4" data-ops-cc-l4>` +
        `<h4 class="ops-cc-section-title">L4 オーナー対応</h4>` +
        emptyState("L4 案件なし", "オーナー直接対応が必要な案件はありません。") +
        `</div>`
      );
    }

    const items = l4
      .map(
        (t) =>
          `<li class="ops-cc-l4-item">` +
          `<span class="ops-cc-badge ops-cc-badge--l4" data-owner-only>あなた対応</span> ` +
          `${esc(t.userText.slice(0, 80))} · ${esc(agentLabel(t.agentId))} · ${formatTime(t.createdAt)}` +
          `<p class="ops-cc-l4-note">AI 自動処理は行いません。</p></li>`
      )
      .join("");

    return (
      `<div class="ops-cc-l4" data-ops-cc-l4>` +
      `<h4 class="ops-cc-section-title">L4 オーナー対応 <span class="ops-cc-count">${l4.length}</span></h4>` +
      `<ul class="ops-cc-l4-list">${items}</ul></div>`
    );
  }

  function renderMorningReportPanel() {
    const report = lastMorningReport;
    if (!report) {
      return (
        `<div class="ops-cc-morning" data-ops-cc-morning>` +
        `<h4 class="ops-cc-section-title">朝レポート</h4>` +
        `<button type="button" class="ops-p2-chat__quick-btn" data-ops-secretary-morning-report-btn>朝レポート生成（手動）</button>` +
        emptyState("未生成", "ボタンを押して Queue / OpsEvent / CI を集約します。") +
        `</div>`
      );
    }

    const events = report.events || [];
    const critical = events.filter((e) => e.severity === "high" || e.meta?.watchSeverity === "critical");
    const ciFailed = events.filter((e) => e.source === "ci" && (e.status === "failed" || e.meta?.status === "failed"));
    const warnings = events.filter((e) => e.severity === "medium" && e.source === "ops_watch");
    const priorities = (report.queue || []).filter((t) => t.levelId === "L3" || t.levelId === "L4" || t.urgency === "critical").slice(0, 5);

    const list = (items, empty) =>
      items.length
        ? `<ul>${items.map((i) => `<li>${esc(i.title || i.userText || i.id)}</li>`).join("")}</ul>`
        : `<p class="ops-cc-muted">${esc(empty)}</p>`;

    return (
      `<div class="ops-cc-morning" data-ops-cc-morning>` +
      `<h4 class="ops-cc-section-title">朝レポート</h4>` +
      `<button type="button" class="ops-p2-chat__quick-btn" data-ops-secretary-morning-report-btn>再生成</button>` +
      `<p class="ops-cc-morning-meta">生成: ${esc(report.generatedAt)}</p>` +
      `<div class="ops-cc-morning-chips">` +
      `<span class="ops-cc-chip">OpsEvent ${report.eventSummary?.total || 0}</span>` +
      `<span class="ops-cc-chip">Queue ${(report.queue || []).length}</span>` +
      `<span class="ops-cc-chip">${esc(report.ciSummary?.headline || "CI —")}</span>` +
      `</div>` +
      `<div class="ops-cc-morning-grid">` +
      `<section><h5>Critical / High</h5>${list(critical, "なし")}</section>` +
      `<section><h5>OPS WATCH warning</h5>${list(warnings, "なし")}</section>` +
      `<section><h5>CI failed</h5>${list(ciFailed, "CI レポート未読込または失敗なし")}</section>` +
      `<section><h5>本日の優先対応</h5>${list(priorities, "優先 Queue なし")}</section>` +
      `</div></div>`
    );
  }

  function renderEventDetail() {
    const OpsEvent = global.TasuSecretaryOpsEvent;
    const Queue = getQueue();
    let event = selectedEventId ? OpsEvent?.getEventById?.(selectedEventId) : null;
    let task = selectedTaskId ? Queue?.getTask?.(selectedTaskId) : null;

    if (!event && task?.opsEventIds?.length) {
      event = OpsEvent?.getEventById?.(task.opsEventIds[0]) || null;
    }

    if (!event && !task) {
      return (
        `<div class="ops-cc-detail" data-ops-cc-detail>` +
        `<h4 class="ops-cc-section-title">OpsEvent / Task 詳細</h4>` +
        emptyState("未選択", "Queue 行をクリックして詳細を表示します。") +
        `</div>`
      );
    }

    const cls = task?.classification || {};
    const method = cls.method || "regex";
    const reason = cls.matchedRule || cls.error || "—";
    const gateLevel = task?.levelId || event?.suggestedLevel || "—";

    if (event) {
      return (
        `<div class="ops-cc-detail" data-ops-cc-detail>` +
        `<h4 class="ops-cc-section-title">OpsEvent 詳細</h4>` +
        `<dl class="ops-cc-dl">` +
        `<dt>Event ID</dt><dd>${esc(event.id)}</dd>` +
        `<dt>Source</dt><dd>${esc(event.source)}</dd>` +
        `<dt>Summary</dt><dd>${esc(event.summary || event.title)}</dd>` +
        `<dt>Category</dt><dd>${esc(event.category)}</dd>` +
        `<dt>Assigned Agent</dt><dd>${esc((event.suggestedAgents || []).join(", ") || "—")}</dd>` +
        `<dt>Classification</dt><dd>${esc(method)} · ${esc(reason)}</dd>` +
        `<dt>Human Gate</dt><dd>${esc(gateLevel)}</dd>` +
        `</dl></div>`
      );
    }

    return (
      `<div class="ops-cc-detail" data-ops-cc-detail>` +
      `<h4 class="ops-cc-section-title">Task 詳細</h4>` +
      `<dl class="ops-cc-dl">` +
      `<dt>Task ID</dt><dd>${esc(task.id)}</dd>` +
      `<dt>Source</dt><dd>${esc(task.source)}</dd>` +
      `<dt>Category</dt><dd>${esc(task.category)}</dd>` +
      `<dt>Agent</dt><dd>${esc(agentLabel(task.agentId))}</dd>` +
      `<dt>Classification</dt><dd>${esc(method)} · ${esc(reason)}</dd>` +
      `<dt>Human Gate</dt><dd>${esc(gateLevel)}</dd>` +
      `${cls.deepseekUsed === false && method.includes("regex") ? `<dt>Note</dt><dd>DeepSeek structured 未使用 / フォールバック</dd>` : ""}` +
      `</dl></div>`
    );
  }

  function renderAll() {
    const root = queryRoot();
    if (!root) return;

    root.innerHTML =
      `<div class="ops-cc-root" data-ops-cc-root>` +
      renderFiltersHtml() +
      renderQueueTable() +
      renderL3Panel() +
      renderL4Panel() +
      renderMorningReportPanel() +
      renderEventDetail() +
      `</div>`;

    bindInteractions(root);
    global.TasuSecretaryMorningReport?.bindMorningReportButton?.();
  }

  function bindInteractions(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll("[data-ops-cc-filter]").forEach((sel) => {
      if (sel.dataset.bound === "1") return;
      sel.dataset.bound = "1";
      sel.addEventListener("change", () => {
        const key = sel.getAttribute("data-ops-cc-filter");
        if (key) filters[key] = sel.value;
        renderAll();
      });
    });

    const reset = root.querySelector("[data-ops-cc-filter-reset]");
    if (reset && reset.dataset.bound !== "1") {
      reset.dataset.bound = "1";
      reset.addEventListener("click", () => {
        filters = { ...DEFAULT_FILTERS };
        renderAll();
      });
    }

    root.querySelectorAll("[data-ops-cc-task-row]").forEach((row) => {
      row.addEventListener("click", () => {
        selectedTaskId = row.getAttribute("data-ops-cc-task-row");
        selectedEventId = null;
        renderAll();
      });
    });

    root.querySelectorAll("[data-ops-cc-l3-approve]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-ops-cc-l3-approve");
        const HSG = getHSG();
        const Queue = getQueue();
        const res = HSG?.approvePendingWithoutSend?.(id);
        if (res?.ok) {
          const taskId = res.item?.payload?.taskId;
          if (taskId) Queue?.updateStatus?.(taskId, "completed", { humanGateId: id });
        }
        renderAll();
        global.TasuSecretaryOrchestrator?.renderPanel?.(global.TasuSecretaryOrchestrator?.getLastResult?.());
      });
    });

    root.querySelectorAll("[data-ops-cc-l3-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-ops-cc-l3-reject");
        getHSG()?.rejectPendingItem?.(id);
        renderAll();
      });
    });

    root.querySelectorAll("[data-ops-cc-l3-save]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-ops-cc-l3-save");
        const ta = root.querySelector(`[data-ops-cc-l3-proposal="${id}"]`);
        getHSG()?.updatePendingProposal?.(id, ta?.value || "");
        renderAll();
      });
    });
  }

  function setMorningReport(report) {
    lastMorningReport = report;
    renderAll();
  }

  function getFilters() {
    return { ...filters };
  }

  function clearForTests() {
    filters = { ...DEFAULT_FILTERS };
    selectedTaskId = null;
    selectedEventId = null;
    lastMorningReport = null;
    bound = false;
    const root = queryRoot();
    if (root) root.innerHTML = "";
  }

  function init() {
    if (bound) return;
    bound = true;
    renderAll();
    [
      "tasu:secretary-task-queue-updated",
      "tasu:secretary-orchestrator-processed",
      "tasu:admin-ai-human-send-gate-updated",
      "tasu:secretary-morning-report-generated",
    ].forEach((ev) => {
      global.addEventListener(ev, () => renderAll());
    });
  }

  if (document?.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuSecretaryCommandCenterUI = {
    renderAll,
    setMorningReport,
    getFilters,
    clearForTests,
    init,
  };
})(typeof window !== "undefined" ? window : globalThis);
