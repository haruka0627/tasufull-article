/**
 * AI 秘書 Phase 5-A/B/C — Operations Orchestrator
 * OpsEvent · Command · Classifier · Registry · Queue · Human Gate · UI
 */
(function (global) {
  "use strict";

  let lastResult = null;

  function getModule(name) {
    return global[name] || null;
  }

  function executeAgentStub(agent, task) {
    return {
      ok: true,
      stub: true,
      agentId: agent?.id || task?.agentId,
      message: "Agent execution stub — not run in Phase 5-B",
    };
  }

  function pickRelatedOpsEvents(text, events) {
    events = Array.isArray(events) ? events : [];
    const t = String(text || "").toLowerCase();
    if (!t) return events.slice(0, 3);
    const matched = events.filter((e) => {
      const blob = `${e.title} ${e.summary} ${e.category} ${e.source}`.toLowerCase();
      return (
        (t.includes("ci") && e.source === "ci") ||
        (t.includes("watch") && e.source === "ops_watch") ||
        (t.includes("inbox") && e.source === "inbox") ||
        (t.includes("builder") && e.category === "builder_consult") ||
        (t.includes("通報") && e.category === "report") ||
        blob.split(/\s+/).some((w) => w.length > 3 && t.includes(w))
      );
    });
    return (matched.length ? matched : events).slice(0, 5);
  }

  async function processMessageAsync(userText, options) {
    options = options || {};
    const Classifier = getModule("TasuSecretaryClassifier");
    const Registry = getModule("TasuSecretaryAgentRegistry");
    const Queue = getModule("TasuSecretaryTaskQueue");
    const Gate = getModule("TasuSecretaryHumanGate");
    const OpsEvent = getModule("TasuSecretaryOpsEvent");

    if (!Classifier?.classify || !Registry?.resolveAgent || !Queue?.enqueue || !Gate?.resolveLevel) {
      return { ok: false, error: "orchestrator_modules_missing" };
    }

    let opsEvents = [];
    if (OpsEvent?.collectAllAsync && options.skipOpsEvent !== true) {
      try {
        opsEvents = await OpsEvent.collectAllAsync({ refreshCi: options.refreshCi !== false });
      } catch {
        opsEvents = OpsEvent.collectAllSync?.() || [];
      }
    } else if (OpsEvent?.collectAllSync) {
      opsEvents = OpsEvent.collectAllSync();
    }

    const relatedOpsEvents = pickRelatedOpsEvents(userText, opsEvents);

    let classification;
    if (Classifier.classifyUnified && options.tryDeepSeek !== false) {
      classification = await Classifier.classifyUnified(userText, { tryDeepSeek: options.tryDeepSeek !== false });
    } else {
      classification = Classifier.classifyWithCommand
        ? Classifier.classifyWithCommand(userText)
        : Classifier.classify(userText);
    }

    const agent = Registry.resolveAgent(classification.primaryAgentId);
    const level = Gate.resolveLevel({
      userText,
      classification,
      severity: classification.severity,
      category: classification.category,
    });

    const task = Queue.enqueue({
      userText,
      agentId: agent.id,
      category: classification.category,
      levelId: level.id,
      source: options.source || "chat",
      classification,
      commandResult: classification.commandResult || classification.commandAfter || null,
      opsEventIds: relatedOpsEvents.map((e) => e.id),
    });

    Queue.updateStatus(task.id, "running");

    let finalStatus = "completed";
    let agentResult;
    let humanGateBridge = null;

    try {
      agentResult = executeAgentStub(agent, task);

      if (level.id === "L3") {
        humanGateBridge = Gate.bridgeToHumanSendGate?.(
          task,
          userText,
          level,
          classification.commandResult || classification.commandAfter
        );
        finalStatus = "waiting_human";
        Queue.updateStatus(task.id, finalStatus, {
          agentResult,
          humanGateId: humanGateBridge?.pendingId || null,
        });
      } else if (level.id === "L4") {
        humanGateBridge = Gate.bridgeToHumanSendGate?.(task, userText, level, classification.commandResult);
        finalStatus = "waiting_human";
        Queue.updateStatus(task.id, finalStatus, { agentResult });
      } else if (Gate.requiresHumanApproval(level.id)) {
        finalStatus = "waiting_human";
        Queue.updateStatus(task.id, finalStatus, { agentResult });
      } else {
        Queue.updateStatus(task.id, "completed", { agentResult });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Queue.updateStatus(task.id, "failed", { error: msg });
      finalStatus = "failed";
    }

    const updatedTask = Queue.getTask(task.id);

    lastResult = {
      ok: true,
      classification,
      agent,
      level,
      task: updatedTask,
      agentResult: updatedTask?.agentResult || agentResult,
      humanGateBridge,
      opsEvents: relatedOpsEvents,
      opsEventSummary: OpsEvent?.summarize?.(opsEvents) || null,
    };

    try {
      global.dispatchEvent(
        new CustomEvent("tasu:secretary-orchestrator-processed", { detail: lastResult })
      );
    } catch {
      /* ignore */
    }

    renderPanel(lastResult);
    renderQueuePanel();

    return lastResult;
  }

  function processMessage(userText, options) {
    return processMessageAsync(userText, { ...(options || {}), tryDeepSeek: false });
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function querySlot(sel) {
    const doc = typeof document !== "undefined" ? document : null;
    return doc ? doc.querySelector(sel) : null;
  }

  function renderPanel(result) {
    const slot = querySlot("[data-ops-phase2-agent-levels]");
    if (!slot) return;

    const data = result || lastResult;
    if (!data?.ok) {
      slot.innerHTML = "";
      slot.hidden = true;
      return;
    }

    const agentLabel = data.agent?.label || data.classification?.primaryAgentId || "—";
    const severity = data.classification?.severity || "—";
    const levelLabel = data.level?.label || data.level?.id || "—";
    const queueStatus = data.task?.status || "—";
    const source = data.task?.source || "chat";
    const method = data.classification?.method || "regex";
    const cmdCount = data.classification?.commandExtracted ?? data.task?.commandResult?.rows?.length ?? 0;
    const gateNote = data.humanGateBridge?.bridged
      ? `Human Send Gate: 承認待ち (${data.humanGateBridge.pendingId || "—"})`
      : data.level?.id === "L4"
        ? "L4 — オーナー対応（Gate 登録なし）"
        : "—";

    slot.hidden = false;
    slot.innerHTML =
      `<div class="ops-orchestrator-panel" data-ops-orchestrator-panel>` +
      `<p><strong>担当Agent:</strong> ${esc(agentLabel)}</p>` +
      `<p><strong>重要度:</strong> ${esc(severity)}</p>` +
      `<p><strong>${esc(levelLabel)}</strong></p>` +
      `<p><strong>Queue status:</strong> ${esc(queueStatus)}</p>` +
      `<p><strong>Source:</strong> ${esc(source)}</p>` +
      `<p><strong>分類:</strong> ${esc(method)}${cmdCount ? ` · 抽出 ${cmdCount} 件` : ""}</p>` +
      `<p><strong>Gate:</strong> ${esc(gateNote)}</p>` +
      `</div>`;
  }

  function renderQueuePanel() {
    global.TasuSecretaryCommandCenterUI?.renderAll?.();
  }

  function getLastResult() {
    return lastResult;
  }

  function clearForTests() {
    lastResult = null;
    getModule("TasuSecretaryTaskQueue")?.clearForTests?.();
    getModule("TasuSecretaryCiIngest")?.clearForTests?.();
    global.TasuSecretaryCommandCenterUI?.clearForTests?.();
    const slot = querySlot("[data-ops-phase2-agent-levels]");
    if (slot) {
      slot.innerHTML = "";
      slot.hidden = true;
    }
  }

  function init() {
    renderQueuePanel();
    global.TasuSecretaryMorningReport?.bindMorningReportButton?.();
  }

  if (document?.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuSecretaryOrchestrator = {
    processMessage,
    processMessageAsync,
    renderPanel,
    renderQueuePanel,
    getLastResult,
    clearForTests,
    executeAgentStub,
  };
})(typeof window !== "undefined" ? window : globalThis);
