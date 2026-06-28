/**
 * AI秘書 Phase 4-1/4-2 — Google Chat Write Bridge
 * 4-1: Human Gate enqueue only · 4-2: approve → drafts.create result sync
 */
(function (global) {
  "use strict";

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function getContext() {
    return global.TasuSecretaryGoogleChatContext;
  }

  function getGmailClient() {
    return global.TasuSecretaryGoogleGmailClient;
  }

  function getHumanGate() {
    return global.TasuAdminAiHumanSendGate;
  }

  function extractReplyDraftBody(assistantPreview) {
    let text = String(assistantPreview || "");
    text = text.replace(/^【返信案[^】]*】\s*/i, "");
    text = text.replace(/\n\n※ read-only[^\n]*$/i, "");
    text = text.replace(/\n\n※ Human Gate[^\n]*$/i, "");
    text = text.replace(/\n\n※ 返信案 · 未送信[^\n]*$/i, "");
    return text.trim();
  }

  function buildReplyPlanFromFocus(focus, draftBody, reason, meta) {
    meta = meta || {};
    focus = focus || {};
    const Gmail = getGmailClient();
    const base = Gmail?.buildReplyPlan
      ? Gmail.buildReplyPlan({
          id: focus.id,
          threadId: focus.threadId,
          subject: focus.subject,
          from: focus.from,
          snippet: focus.snippet,
        })
      : {
          to: trim(focus.from, 200),
          subject: trim(focus.subject, 200),
          threadId: trim(focus.threadId, 120),
          replyToMessageId: trim(focus.id, 120),
        };

    return {
      subject: base.subject || trim(focus.subject, 200),
      body: trim(draftBody, 12000),
      recipient: base.to || trim(focus.from, 200),
      reason: trim(reason, 300) || "Chat 返信案の Gmail 下書き保存",
      messageId: trim(focus.id, 120),
      threadId: base.threadId || trim(focus.threadId, 120),
      replyToMessageId: base.replyToMessageId || trim(focus.id, 120),
      sourceIntent: trim(meta.sourceIntent, 40) || "context_reply_draft",
    };
  }

  function buildReplyPlanFromContext(reason) {
    const Ctx = getContext();
    const focus = Ctx?.getGmailFocusRef?.();
    if (!focus?.id) {
      return { ok: false, error: "no_gmail_focus" };
    }

    let draftBody = "";
    const planRef = Ctx.getReplyPlanRef?.();
    if (planRef?.body) {
      draftBody = planRef.body;
    } else {
      const turn = Ctx.getLastTurn?.();
      draftBody = extractReplyDraftBody(turn?.assistantPreview || "");
    }

    if (!draftBody) {
      return { ok: false, error: "no_reply_draft" };
    }

    const plan = buildReplyPlanFromFocus(focus, draftBody, reason);
    return { ok: true, plan };
  }

  function persistReplyPlanFromDraft(focus, draftBody, reason, meta) {
    const Ctx = getContext();
    if (!Ctx?.saveReplyPlan || !focus) return null;
    const plan = buildReplyPlanFromFocus(focus, draftBody, reason, meta);
    return Ctx.saveReplyPlan(plan);
  }

  function resolvePolicyBlock(userText) {
    const Gate = global.TasuSecretaryHumanGate;
    if (!Gate?.resolveLevel) return null;
    const level = Gate.resolveLevel({ userText: trim(userText, 500) });
    if (level?.id === "L4") {
      return {
        blocked: true,
        reply:
          "この内容はオーナー対応（L4）のため、Chat からの下書き保存は行えません。\n" +
          "調査・整理のみ利用してください。",
      };
    }
    return null;
  }

  function enqueueGmailDraftFromChat(userText) {
    const policy = resolvePolicyBlock(userText);
    if (policy?.blocked) {
      return { ok: true, reply: policy.reply, mock: false, policyBlocked: true };
    }

    const built = buildReplyPlanFromContext(userText);
    if (!built.ok) {
      const msg =
        built.error === "no_reply_draft"
          ? "返信案がありません。先に「返信案作って」で文案を作成してください。"
          : "直近のメールがありません。先にメール詳細を取得してください。";
      return { ok: true, reply: msg, mock: false, error: built.error };
    }

    const plan = built.plan;
    const Ctx = getContext();
    Ctx?.saveReplyPlan?.(plan);

    const Gmail = getGmailClient();
    if (!Gmail?.enqueueDraftHumanGate) {
      return { ok: false, error: "gmail_enqueue_missing" };
    }

    const queued = Gmail.enqueueDraftHumanGate({
      messageId: plan.messageId,
      threadId: plan.threadId,
      replyToMessageId: plan.replyToMessageId,
      to: plan.recipient,
      subject: plan.subject,
      body: plan.body,
      chatOrigin: true,
      chatIntent: "write_enqueue_gmail_draft",
    });

    if (!queued?.ok || !queued.item?.id) {
      return { ok: false, error: trim(queued?.error, 80) || "enqueue_failed" };
    }

    Ctx?.savePendingGate?.({
      pendingId: queued.item.id,
      kind: "gmail_draft",
      state: "pending",
      sourceIntent: "write_enqueue_gmail_draft",
    });

    const subjectPreview = trim(plan.subject, 80) || "(件名なし)";
    const recipientPreview = trim(plan.recipient, 60) || "(宛先)";

    return {
      ok: true,
      reply:
        `【Human Gate 登録 · 未実行】\n` +
        `Gmail 下書き作成を承認待ちに登録しました。\n\n` +
        `件名: ${subjectPreview}\n` +
        `宛先: ${recipientPreview}\n\n` +
        `Dashboard の Human Gate パネルで内容を確認し、承認してください。\n` +
        `※ この時点では Gmail API は実行されていません`,
      mock: false,
      enqueued: true,
      pendingKind: "gmail_draft",
    };
  }

  function handleGateExecutionResult(item, exec) {
    const Ctx = getContext();
    if (!Ctx || item?.source !== "gmail" || !item?.payload?.chatOrigin) return;
    const payload = item.payload || {};
    const subjectPreview = trim(payload.subject, 80) || "(件名なし)";
    const sourceIntent = trim(payload.chatIntent, 40) || "write_enqueue_gmail_draft";

    if (exec?.ok) {
      const raw = exec.raw?.data || exec.raw || {};
      Ctx.saveDraftExecuteResult?.({
        pendingId: item.id,
        success: true,
        subjectPreview,
        draftId: trim(raw.draftId, 120),
        sourceIntent,
      });
      Ctx.clearPendingGate?.();
      return;
    }

    Ctx.saveDraftExecuteResult?.({
      pendingId: item.id,
      success: false,
      subjectPreview,
      errorPreview: trim(exec?.message, 80) || "draft_failed",
      sourceIntent,
      keepPending: true,
    });
  }

  function handleGateRejected(item) {
    const Ctx = getContext();
    if (!Ctx || item?.source !== "gmail" || !item?.payload?.chatOrigin) return;
    Ctx.clearPendingGate?.();
  }

  global.TasuSecretaryGoogleChatWriteBridge = {
    buildReplyPlanFromFocus,
    buildReplyPlanFromContext,
    persistReplyPlanFromDraft,
    enqueueGmailDraftFromChat,
    extractReplyDraftBody,
    handleGateExecutionResult,
    handleGateRejected,
  };
})(typeof window !== "undefined" ? window : globalThis);
