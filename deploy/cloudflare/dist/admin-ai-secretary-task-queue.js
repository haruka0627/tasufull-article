/**
 * AI 秘書 Phase 5-A/B — Agent Task Queue（メモリ · DB なし）
 */
(function (global) {
  "use strict";

  const STATUSES = Object.freeze(["pending", "running", "waiting_human", "completed", "failed"]);
  const MAX_TASKS = 100;

  /** @type {Array<object>} */
  let queue = [];
  let seq = 0;

  function isValidStatus(status) {
    return STATUSES.includes(String(status || ""));
  }

  function mapUrgency(classification) {
    const s = String(classification?.severity || "medium").toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high") return "high";
    if (s === "low") return "low";
    return "medium";
  }

  function enqueue(payload) {
    payload = payload && typeof payload === "object" ? payload : {};
    const task = {
      id: `sec-task-${Date.now()}-${++seq}`,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userText: String(payload.userText || "").slice(0, 500),
      agentId: String(payload.agentId || "secretary"),
      category: String(payload.category || "general"),
      levelId: String(payload.levelId || "L2"),
      source: String(payload.source || "chat"),
      urgency: String(payload.urgency || mapUrgency(payload.classification)),
      classification: payload.classification || null,
      commandResult: payload.commandResult || null,
      opsEventIds: Array.isArray(payload.opsEventIds) ? payload.opsEventIds.slice(0, 10) : [],
      humanGateId: payload.humanGateId || null,
      ownerOnly: payload.levelId === "L4",
      agentResult: null,
      error: null,
    };
    queue.unshift(task);
    if (queue.length > MAX_TASKS) queue.length = MAX_TASKS;
    emitUpdated();
    return task;
  }

  function updateStatus(taskId, status, patch) {
    const id = String(taskId || "");
    const task = queue.find((t) => t.id === id);
    if (!task) return null;
    if (!isValidStatus(status)) return null;
    task.status = status;
    task.updatedAt = Date.now();
    if (patch && typeof patch === "object") {
      if (patch.agentResult !== undefined) task.agentResult = patch.agentResult;
      if (patch.error !== undefined) task.error = patch.error;
      if (patch.humanGateId !== undefined) task.humanGateId = patch.humanGateId;
      if (patch.commandResult !== undefined) task.commandResult = patch.commandResult;
    }
    emitUpdated();
    return task;
  }

  function listTasks(options) {
    options = options || {};
    let items = queue.slice();
    if (options.status) items = items.filter((t) => t.status === options.status);
    if (options.levelId) items = items.filter((t) => t.levelId === options.levelId);
    if (options.agentId) items = items.filter((t) => t.agentId === options.agentId);
    if (options.source) items = items.filter((t) => t.source === options.source);
    if (options.urgency) items = items.filter((t) => t.urgency === options.urgency);
    const limit = Number(options.limit) || items.length;
    return items.slice(0, limit);
  }

  function getTask(taskId) {
    return queue.find((t) => t.id === String(taskId || "")) || null;
  }

  function getLatestTask() {
    return queue[0] || null;
  }

  function clearForTests() {
    queue = [];
    seq = 0;
  }

  function emitUpdated() {
    try {
      global.dispatchEvent(new CustomEvent("tasu:secretary-task-queue-updated"));
    } catch {
      /* ignore */
    }
  }

  global.TasuSecretaryTaskQueue = {
    STATUSES,
    enqueue,
    updateStatus,
    listTasks,
    mapUrgency,
    getTask,
    getLatestTask,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
