/**
 * AI秘書 Phase 6-D — Gmail client (read + write via Human Gate · Edge proxy only)
 */
(function (global) {
  "use strict";

  const PRESETS = Object.freeze({
    unread: "is:unread in:inbox",
    important: "is:important in:inbox",
    attachment: "has:attachment in:inbox",
    inbox: "in:inbox",
  });

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function postGmail(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "gmail", ...payload });
  }

  function postGmailWrite(payload) {
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.postAction) {
      return Promise.resolve({ ok: false, error: "oauth_client_missing" });
    }
    return OAuth.postAction(OAuth.TOOLS_FN, { action: "gmail_write", ...payload });
  }

  function extractEmailFrom(from) {
    const raw = trim(from, 500);
    const angle = raw.match(/<([^>]+@[^>]+)>/);
    if (angle?.[1]) return angle[1];
    const plain = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return plain ? plain[0] : raw;
  }

  function normalizeReplySubject(subject) {
    const s = trim(subject, 500) || "(件名なし)";
    return /^re:/i.test(s) ? s : `Re: ${s}`;
  }

  function buildReplyPlan(message) {
    message = message || {};
    return {
      to: extractEmailFrom(message.from),
      subject: normalizeReplySubject(message.subject),
      threadId: trim(message.threadId, 120),
      replyToMessageId: trim(message.id, 120),
      contextSnippet: trim(message.snippet, 300),
    };
  }

  async function listMessages(options) {
    options = options || {};
    const q = trim(options.q || options.presetQuery || PRESETS[options.preset] || "");
    const result = await postGmail({
      method: "messages.list",
      q: q || undefined,
      maxResults: options.maxResults || 10,
      pageToken: options.pageToken,
      labelIds: Array.isArray(options.labelIds) ? options.labelIds.map(String) : undefined,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function getMessage(messageId, options) {
    options = options || {};
    const result = await postGmail({
      method: "messages.get",
      messageId: trim(messageId, 120),
      includeBody: Boolean(options.includeBody),
    });
    if (!result.ok) return result;
    const data = result.data || {};
    const message = data.message || result.message;
    return {
      ok: true,
      data: {
        ...data,
        message,
        mock: Boolean(data.mock || result.mock),
      },
    };
  }

  async function getThread(threadId, options) {
    options = options || {};
    const result = await postGmail({
      method: "threads.get",
      threadId: trim(threadId, 120),
      includeBody: Boolean(options.includeBody),
    });
    if (!result.ok) return result;
    const data = result.data || {};
    const thread = data.thread || result.thread;
    return {
      ok: true,
      data: {
        ...data,
        thread,
        mock: Boolean(data.mock || result.mock),
      },
    };
  }

  async function listLabels() {
    const result = await postGmail({ method: "labels.list" });
    if (!result.ok) return result;
    const data = result.data || {};
    const labels = Array.isArray(data.labels) ? data.labels : Array.isArray(result.labels) ? result.labels : [];
    return { ok: true, data: { ...data, labels } };
  }

  async function tryWriteBlocked(method) {
    return postGmail({ method: trim(method, 80) || "messages.send" });
  }

  async function tryWriteWithoutGate(method, fields) {
    return postGmailWrite({
      method: trim(method, 80) || "drafts.create",
      humanGateApproved: false,
      ...(fields || {}),
    });
  }

  async function executeWriteApproved(fields) {
    fields = fields || {};
    if (!fields.pendingId) {
      return { ok: false, error: "human_gate_pending_id_required" };
    }
    const result = await postGmailWrite({
      method: trim(fields.method, 80) || "drafts.create",
      humanGateApproved: true,
      pendingId: trim(fields.pendingId, 120),
      to: trim(fields.to, 500) || undefined,
      subject: trim(fields.subject, 500) || undefined,
      body: trim(fields.body, 12000) || undefined,
      threadId: trim(fields.threadId, 120) || undefined,
      replyToMessageId: trim(fields.replyToMessageId, 120) || undefined,
      draftId: trim(fields.draftId, 120) || undefined,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data || {} };
  }

  async function proposeReply(message) {
    message = message || {};
    const plan = buildReplyPlan(message);
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    const prompt =
      "あなたはTASFUL運営秘書です。以下の受信メールに対する返信案を日本語で作成してください。" +
      "送信はしません。本文のみ返してください。\n\n" +
      `From: ${trim(message.from, 200)}\n` +
      `Subject: ${trim(message.subject, 200)}\n` +
      `Snippet: ${plan.contextSnippet}`;

    if (!Adapter?.completeTurn) {
      return {
        ok: true,
        plan,
        body: `（mock返信案）\n\n${plan.contextSnippet} について確認いたします。\n\nよろしくお願いいたします。`,
        mock: true,
      };
    }

    const turn = await Adapter.completeTurn({
      userText: "上記メールへの返信案を作成してください。",
      systemPrompt: prompt,
      modeId: "ops_secretary",
      mockFallback: () =>
        `（mock返信案）\n\n${plan.contextSnippet} について確認いたします。\n\nよろしくお願いいたします。`,
    });

    return {
      ok: true,
      plan,
      body: trim(turn.reply, 12000),
      mock: !!turn.fallback_used,
      modelLabel: turn.modelLabel,
    };
  }

  function enqueueDraftHumanGate(fields) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.enqueueFromGmailDraft) {
      return { ok: false, error: "human_send_gate_missing" };
    }
    const item = HSG.enqueueFromGmailDraft({
      gmailAction: "draft_create",
      messageId: fields.messageId,
      threadId: fields.threadId,
      replyToMessageId: fields.replyToMessageId,
      to: fields.to,
      subject: fields.subject,
      body: fields.body,
      chatOrigin: Boolean(fields.chatOrigin),
      chatIntent: fields.chatIntent,
    });
    return { ok: true, item };
  }

  function enqueueSendHumanGate(fields) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.enqueueFromGmailDraft) {
      return { ok: false, error: "human_send_gate_missing" };
    }
    const item = HSG.enqueueFromGmailDraft({
      gmailAction: "send",
      messageId: fields.messageId,
      threadId: fields.threadId,
      replyToMessageId: fields.replyToMessageId,
      to: fields.to,
      subject: fields.subject,
      body: fields.body,
      draftId: fields.draftId,
    });
    return { ok: true, item };
  }

  async function approveDraftPending(pendingId) {
    const HSG = global.TasuAdminAiHumanSendGate;
    if (!HSG?.approveAndExecute) {
      return { ok: false, error: "human_send_gate_missing" };
    }
    return HSG.approveAndExecute(pendingId, { approvedBy: "operator" });
  }

  async function approveSendPending(pendingId) {
    return approveDraftPending(pendingId);
  }

  global.TasuSecretaryGoogleGmailClient = {
    PRESETS,
    buildReplyPlan,
    listMessages,
    getMessage,
    getThread,
    listLabels,
    tryWriteBlocked,
    tryWriteWithoutGate,
    executeWriteApproved,
    proposeReply,
    enqueueDraftHumanGate,
    enqueueSendHumanGate,
    approveDraftPending,
    approveSendPending,
  };
})(typeof window !== "undefined" ? window : globalThis);
