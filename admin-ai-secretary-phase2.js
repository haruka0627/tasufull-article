/**
 * AI運営秘書 — Phase2 テキストチャット（通常会話 · Voice Core 連携可）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_admin_ai_secretary_chat_v1";
  const MAX_MESSAGES = 40;
  const MODE_ID = "ops_secretary";

  const SYSTEM_PROMPT =
    "あなたは TASFUL の AI運営秘書です。運営ダッシュボードのオペレーター向けに、" +
    "問い合わせ・通報・Connect・Builder・OPS WATCH などの状況整理と次アクションの提案を、" +
    "簡潔で丁寧な日本語で答えてください。返金・BAN・掲載停止などの実行操作は行わず、" +
    "専用画面への確認・エスカレーションを促してください。";

  let bound = false;
  let voiceBound = false;
  let voiceIntegrationInitialized = false;
  let sending = false;
  let opsSnapshot = null;
  let opsSnapshotAt = 0;
  const SNAPSHOT_TTL_MS = 60000;

  const VOICE_STATE_LABELS = Object.freeze({
    ready: "Ready",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    error: "Error",
  });

  function setOpsSnapshot(ctx) {
    if (!ctx || typeof ctx !== "object") {
      opsSnapshot = null;
      opsSnapshotAt = 0;
      return;
    }
    opsSnapshot = ctx;
    opsSnapshotAt = Date.now();
  }

  function getEffectiveSnapshot() {
    if (opsSnapshot && Date.now() - opsSnapshotAt < SNAPSHOT_TTL_MS) return opsSnapshot;
    return null;
  }

  function buildSystemPrompt(userText) {
    const Builder = global.TasuSecretaryOpsContextBuilder;
    if (!Builder?.build || !Builder?.formatForSystemPrompt) return SYSTEM_PROMPT;
    try {
      const intent = Builder.resolveIntent(userText);
      const opsCtx = Builder.build({
        userText,
        filters: intent.filters || {},
        snapshot: getEffectiveSnapshot(),
      });
      const block = Builder.formatForSystemPrompt(opsCtx);
      if (!block) return SYSTEM_PROMPT;
      return `${SYSTEM_PROMPT}\n\n---\n${block}`;
    } catch {
      return SYSTEM_PROMPT;
    }
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

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      /* ignore */
    }
  }

  function setStatus(state, label, icon) {
    const el = $("[data-ops-phase4-status]");
    if (!el) return;
    el.hidden = state === "idle";
    el.dataset.state = state;
    const iconEl = $("[data-ops-phase4-status-icon]", el);
    const labelEl = $("[data-ops-phase4-status-label]", el);
    if (iconEl) iconEl.textContent = icon || (state === "loading" ? "⏳" : state === "error" ? "⚠️" : "🟢");
    if (labelEl) labelEl.textContent = label || (state === "loading" ? "応答中…" : state === "error" ? "エラー" : "待機中");
  }

  function scrollLog(logEl) {
    if (!logEl) return;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderMessageEl(msg) {
    const div = document.createElement("div");
    const role = msg.role === "user" ? "user" : "assistant";
    div.className = `ops-p2-chat__msg ops-p2-chat__msg--${role}`;
    div.dataset.chatRole = role;
    if (msg.error) {
      div.classList.add("ops-p2-chat__msg--error");
      div.textContent = msg.content;
    } else {
      div.textContent = msg.content;
    }
    return div;
  }

  function renderLog(messages) {
    const logEl = $("[data-ops-phase2-chat-log]");
    if (!logEl) return;
    logEl.innerHTML = "";
    messages.forEach((msg) => {
      logEl.appendChild(renderMessageEl(msg));
    });
    scrollLog(logEl);
  }

  function appendToLog(msg) {
    const logEl = $("[data-ops-phase2-chat-log]");
    if (!logEl) return;
    logEl.appendChild(renderMessageEl(msg));
    scrollLog(logEl);
  }

  function getVoiceIntegration() {
    return global.TasuSecretaryVoiceIntegration;
  }

  function enrichMockReplyWithOpsAnalysis(baseReply, opsAnalysis) {
    if (!opsAnalysis?.ok) return baseReply;
    const total = opsAnalysis.insightSummary?.total;
    if (typeof total !== "number" || total < 1) return baseReply;
    const critical =
      opsAnalysis.groups?.critical?.length ?? opsAnalysis.insightSummary?.bySeverity?.critical ?? 0;
    return (
      `${baseReply}\n\n` +
      `[Operations Intelligence] 検出インサイト: ${total} 件` +
      (critical ? `（Critical ${critical}）` : "")
    );
  }

  function mockSecretaryReply(userText) {
    const text = String(userText || "").trim();
    const preview = text.slice(0, 80);
    if (/^(こんにちは|こんばんは|おはよう|はじめまして)/.test(text)) {
      return (
        "こんにちは。AI運営秘書です。\n\n" +
        "本日の優先対応・問い合わせ・Connect などの整理や、次に開く画面の提案ができます。\n" +
        "具体的な状況を教えてください。"
      );
    }
    if (/未対応|優先|今日/.test(text)) {
      return (
        "承知しました。優先対応の確認は、画面上部の「本日の運営サマリー」や Daily Inbox、\n" +
        "「順番に開始」からたどれます。特定カテゴリ（Connect / 通報 等）があれば教えてください。"
      );
    }
    return (
      `【AI運営秘書 · テキスト応答】\n\n` +
      `「${preview}」について承りました。\n\n` +
      "詳細な案件抽出は下部の「運営コマンド」検索（例: 未対応だけ見せて）もご利用ください。\n" +
      "※ DeepSeek 未接続時はモック応答です。Cloudflare Pages Function（/api/secretary-deepseek-chat）と DEEPSEEK_API_KEY が設定されていれば本番応答します。"
    );
  }

  async function requestAssistantReply(userText, history) {
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) {
      return { content: mockSecretaryReply(userText), mock: true };
    }
    const messages = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    try {
      const out = await Adapter.completeTurn({
        userText,
        messages,
        systemPrompt: buildSystemPrompt(userText),
        modeId: MODE_ID,
        mockFallback: ({ message }) => mockSecretaryReply(message),
      });
      const reply = String(out?.reply || "").trim();
      if (!reply) {
        return { content: mockSecretaryReply(userText), mock: true, error: out?.apiError };
      }
      return {
        content: reply,
        mock: Boolean(out?.fallback_used),
        modelLabel: out?.modelLabel,
        error: out?.fallback_used ? out?.apiError : "",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: mockSecretaryReply(userText), mock: true, error: msg };
    }
  }

  async function dispatchSecretaryMessage(rawText, options) {
    options = options && typeof options === "object" ? options : {};
    const text = String(rawText || "").trim();
    if (!text || sending) return { ok: false, reason: "empty_or_busy" };

    getVoiceIntegration()?.stopVoiceOutput?.();
    global.TasuAiVoiceCore?.stopVoice?.();

    sending = true;
    setStatus("loading", "応答中…", "⏳");

    const input = $("[data-ops-secretary-input]");
    const sendBtn = $("[data-ops-secretary-send]");
    const voiceBtn = $("[data-ops-secretary-voice]");
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;

    const channel = options.channel || (options.fromVoice ? "voice" : "text");
    const opsAnalysis = options.opsAnalysis || null;

    const history = loadHistory();
    const userMsg = {
      role: "user",
      content: text,
      at: Date.now(),
      channel,
      opsIntelligence: opsAnalysis?.ok ? { total: opsAnalysis.insightSummary?.total } : undefined,
    };
    history.push(userMsg);
    saveHistory(history);
    appendToLog(userMsg);
    if (input && channel === "text" && !options.fromQuick) input.value = "";

    try {
      try {
        const GoogleChatRouter = global.TasuSecretaryGoogleChatRouter;
        if (GoogleChatRouter?.tryHandle) {
          const googleRoute = await GoogleChatRouter.tryHandle(text, { history: history.slice(0, -1) });
          if (googleRoute?.handled) {
            const replyContent = String(googleRoute.reply || "").trim();
            const assistantMsg = {
              role: "assistant",
              content: replyContent,
              at: Date.now(),
              mock: Boolean(googleRoute.mock),
              channel,
              googleIntent: googleRoute.intent,
            };
            history.push(assistantMsg);
            saveHistory(history);
            appendToLog(assistantMsg);
            try {
              global.dispatchEvent(
                new CustomEvent("tasu:ai-voice-assistant-reply", {
                  detail: { text: replyContent, surface: MODE_ID, channel },
                })
              );
            } catch {
              /* ignore */
            }
            setStatus("idle", "待機中", "🟢");
            return { ok: true, reply: replyContent, googleHandled: true, googleIntent: googleRoute.intent };
          }
        }
      } catch {
        /* google chat router optional */
      }

      let orchestratorResult = null;
      try {
        const Orch = global.TasuSecretaryOrchestrator;
        if (Orch?.processMessageAsync) {
          orchestratorResult = await Orch.processMessageAsync(text, { tryDeepSeek: true, opsAnalysis });
        } else {
          orchestratorResult = Orch?.processMessage?.(text) || null;
        }
        Orch?.renderPanel?.(orchestratorResult);
        Orch?.renderQueuePanel?.();
      } catch {
        /* orchestrator optional */
      }

      const out = await requestAssistantReply(text, history.slice(0, -1));
      let replyContent = out.content;
      if (out.mock && opsAnalysis) {
        replyContent = enrichMockReplyWithOpsAnalysis(replyContent, opsAnalysis);
      }
      const assistantMsg = {
        role: "assistant",
        content: replyContent,
        at: Date.now(),
        mock: out.mock,
        modelLabel: out.modelLabel,
        channel,
        orchestrator: orchestratorResult?.ok
          ? {
              agentId: orchestratorResult.agent?.id,
              levelId: orchestratorResult.level?.id,
              taskStatus: orchestratorResult.task?.status,
            }
          : undefined,
      };
      history.push(assistantMsg);
      saveHistory(history);
      appendToLog(assistantMsg);

      try {
        global.dispatchEvent(
          new CustomEvent("tasu:ai-voice-assistant-reply", {
            detail: { text: replyContent, surface: MODE_ID, channel },
          })
        );
      } catch {
        /* ignore */
      }

      if (out.error && out.mock) {
        const statusLabel = /DEEPSEEK_API_KEY|DeepSeek API が未設定/.test(out.error)
          ? "DeepSeek 未設定 — モック応答"
          : "API未接続 — モック応答を表示";
        setStatus("error", statusLabel, "⚠️");
        setTimeout(() => setStatus("idle", "待機中", "🟢"), 4000);
      } else {
        setStatus("idle", "待機中", "🟢");
      }
      return { ok: true, reply: replyContent, opsAnalysisOk: Boolean(opsAnalysis?.ok) };
    } catch (err) {
      const errText = err instanceof Error ? err.message : String(err);
      const errMsg = { role: "assistant", content: `エラー: ${errText}`, at: Date.now(), error: true };
      history.push(errMsg);
      saveHistory(history);
      appendToLog(errMsg);
      setStatus("error", errText.slice(0, 60), "⚠️");
      return { ok: false, error: errText };
    } finally {
      sending = false;
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (voiceBtn) voiceBtn.disabled = false;
      input?.focus?.();
    }
  }

  /**
   * Text / Voice 共通入口 — Operations Intelligence Engine 経由（Integration 委譲）
   */
  async function submit(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const text = String(p.text ?? p.message ?? "").trim();
    if (!text) return { ok: false, error: "empty_text" };

    const Integration = getVoiceIntegration();
    if (Integration?.submit) {
      return Integration.submit({ channel: p.channel || "text", text, options: p.options, meta: p.meta });
    }

    const channel = p.channel === "voice" ? "voice" : "text";
    const opsAnalysis = await Integration?.runOperationsIntelligence?.(text, channel);
    return dispatchSecretaryMessage(text, { channel, opsAnalysis, ...(p.options || {}) });
  }

  async function sendMessage(rawText, options) {
    options = options && typeof options === "object" ? options : {};
    if (options._internal) {
      return dispatchSecretaryMessage(rawText, options);
    }
    const channel = options.channel || (options.fromVoice ? "voice" : "text");
    return submit({ channel, text: rawText, options });
  }

  function renderVoiceState(payload) {
    const el = $("[data-ops-secretary-voice-state]");
    if (!el) return;
    const state = payload?.state || "ready";
    const label = VOICE_STATE_LABELS[state] || VOICE_STATE_LABELS.ready;
    el.textContent = payload?.detail ? `${label} — ${payload.detail}` : label;
    el.className = "ops-secretary-voice-state";
    if (state !== "ready") el.classList.add(`ops-secretary-voice-state--${state}`);

    document.querySelectorAll("[data-ops-secretary-voice]").forEach((btn) => {
      btn.setAttribute("aria-pressed", state === "listening" ? "true" : "false");
      btn.disabled = sending && state !== "listening";
    });
  }

  function initVoiceIntegration() {
    if (voiceIntegrationInitialized) return;
    const Integration = getVoiceIntegration();
    if (!Integration?.init) return;
    Integration.init({
      surface: MODE_ID,
      onSubmit: async (payload) => {
        await dispatchSecretaryMessage(payload.text, {
          channel: payload.channel,
          opsAnalysis: payload.meta?.opsAnalysis,
          fromVoice: payload.channel === "voice",
          ...(payload.options || {}),
        });
      },
    });
    Integration.onVoiceStateChange(renderVoiceState);
    renderVoiceState(Integration.getVoiceState());
    voiceIntegrationInitialized = true;
  }

  function bindVoiceButton() {
    if (voiceBound) return;
    const btn = $("[data-ops-secretary-voice]");
    if (!btn) return;
    voiceBound = true;
    btn.addEventListener("click", async () => {
      if (sending) return;
      getVoiceIntegration()?.stopVoiceOutput?.();
      const out = await (getVoiceIntegration()?.submitVoiceCapture?.() ||
        Promise.resolve({ ok: false, error: "voice_unavailable" }));
      if (!out?.ok && out?.error) {
        setStatus("error", String(out.error).slice(0, 60), "⚠️");
        setTimeout(() => setStatus("idle", "待機中", "🟢"), 3000);
      }
    });
    $("[data-ops-secretary-send]")?.addEventListener(
      "click",
      () => getVoiceIntegration()?.stopVoiceOutput?.(),
      true
    );
  }

  function bindChatForm() {
    if (bound) return;
    const form = $("[data-ops-phase2-chat-form]");
    if (!form) return;
    bound = true;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("[data-ops-secretary-input]", form) || $("[data-ops-phase2-chat-input]", form);
      const text = input && "value" in input ? String(input.value).trim() : "";
      if (!text) return;
      void submit({ channel: "text", text });
    });

    const input = $("[data-ops-secretary-input]", form) || $("[data-ops-phase2-chat-input]", form);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    setStatus("idle", "待機中", "🟢");
  }

  function renderBrief(ctx) {
    const brief = $("[data-ops-phase7-chat-brief]");
    if (!brief || brief.dataset.chatBriefBound === "1") return;
    const pending = ctx?.metrics?.pendingTotal ?? ctx?.hub?.pendingCount;
    const line =
      typeof pending === "number"
        ? `本日の未処理サマリー: 約 ${pending} 件。テキストで状況を聞いてください。`
        : "運営状況についてテキストでご質問ください。";
    brief.textContent = line;
    brief.dataset.chatBriefBound = "1";
  }

  function renderQuickChips() {
    const wrap = $("[data-ops-phase7-quick-chat]");
    if (!wrap || wrap.dataset.bound === "1") return;
    const chips = ["本日の優先対応は？", "未対応の問い合わせを整理", "Connect 問題の確認方法"];
    wrap.innerHTML = "";
    chips.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ops-p2-chat__quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => void submit({ channel: "text", text: label, options: { fromQuick: true } }));
      wrap.appendChild(btn);
    });
    wrap.dataset.bound = "1";
  }

  function renderOrchestratorPanelFromLast() {
    const last = global.TasuSecretaryOrchestrator?.getLastResult?.();
    if (last?.ok) global.TasuSecretaryOrchestrator?.renderPanel?.(last);
  }

  function render(ctx) {
    setOpsSnapshot(ctx);
    initVoiceIntegration();
    bindChatForm();
    bindVoiceButton();
    renderLog(loadHistory());
    renderBrief(ctx || {});
    renderQuickChips();
    renderOrchestratorPanelFromLast();
    global.TasuSecretaryOrchestrator?.renderQueuePanel?.();
    global.TasuSecretaryCommandCenterUI?.init?.();
    global.TasuSecretaryMorningReport?.bindMorningReportButton?.();
    global.TasuSecretaryGoogleReadonlyCoordinator?.mount?.();
    global.TasuSecretaryGoogleGmailUI?.mount?.();
    global.TasuSecretaryGoogleCalendarUI?.mount?.();
    global.TasuSecretaryGoogleConnectUI?.mount?.();
    global.TasuSecretaryGoogleContactsUI?.mount?.();
    global.TasuSecretaryGoogleDriveUI?.mount?.();
    global.TasuSecretaryGoogleOrchestratorUI?.mount?.();
  }

  function clearHistoryForTests() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    renderLog([]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindChatForm);
  } else {
    bindChatForm();
  }

  global.TasuAdminAiSecretaryPhase2 = {
    render,
    sendMessage,
    submit,
    dispatchSecretaryMessage,
    loadHistory,
    clearHistoryForTests,
    bindChatForm,
    bindVoiceButton,
    initVoiceIntegration,
    renderVoiceState,
    setOpsSnapshot,
    buildSystemPrompt,
  };
})(typeof window !== "undefined" ? window : globalThis);
