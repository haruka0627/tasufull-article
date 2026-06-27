/**
 * AI秘書 Phase 3a/3b — Google Chat Router (Gmail / Calendar read-only)
 * Main chat only · no write capabilities · Client read path only
 */
(function (global) {
  "use strict";

  const INTENTS = Object.freeze({
    gmail_unread: "gmail_unread",
    gmail_search: "gmail_search",
    gmail_summarize: "gmail_summarize",
    gmail_pick: "gmail_pick",
    gmail_detail: "gmail_detail",
    gmail_detail_summarize: "gmail_detail_summarize",
    gmail_search_and_detail: "gmail_search_and_detail",
    calendar_today: "calendar_today",
    calendar_tomorrow: "calendar_tomorrow",
    calendar_week: "calendar_week",
    calendar_search: "calendar_search",
    write_blocked: "write_blocked",
    none: "none",
  });

  const WRITE_REPLY =
    "Google 連携は read-only です。返信・送信・予定の追加/変更/削除の実行は未対応です。\n" +
    "メール/予定の確認・要約のみ利用できます。";

  const DISCONNECT_REPLY =
    "Google アカウントが未接続のため、メール/予定を取得できません。\n" +
    "Dashboard の Google タブから OAuth 接続を完了してください。";

  const NO_CONTEXT_REPLY =
    "直近のメール一覧がありません。先に「未読メールある？」などで一覧を取得してください。";

  const GMAIL_LIST_MAX = 8;
  const GMAIL_SUMMARY_MAX = 5;
  const CALENDAR_MAX = 15;
  const GMAIL_BODY_DISPLAY_MAX = 2000;
  const GMAIL_BODY_LLM_MAX = 8000;

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function extractPersonName(text) {
    const m = String(text || "").match(/([一-龯ぁ-んァ-ンA-Za-z0-9]{1,24})\s*さん/);
    return m?.[1] || "";
  }

  function extractPickIndex(text) {
    const m = String(text || "").match(/(\d+)\s*(件目|番目)/);
    if (m?.[1]) return Number(m[1]);
    const kanjiMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };
    const km = String(text || "").match(/([一二三四五六七八])\s*(件目|番目)/);
    if (km?.[1] && kanjiMap[km[1]]) return kanjiMap[km[1]];
    return 0;
  }

  function isGmailDetailText(text) {
    return /詳しく|詳細|全文|内容|見せて/i.test(text);
  }

  function isGmailMailContext(text) {
    return /メール|mail|Gmail|件目|番目|このメール/i.test(text);
  }

  function buildYesterdayQuery() {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    const fmt = (d) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    return `after:${fmt(start)} before:${fmt(end)}`;
  }

  function isWriteIntent(text) {
    const t = String(text || "");
    const write = /返信|送信|下書き|予定を追加|予定追加|予定を入|予定変更|予定削除|削除して|スケジュール.*入|ミーティング.*(入|設定|作成)|打ち合わせ.*(入|設定|作成)/i.test(t);
    const googleCtx = /メール|Gmail|予定|カレンダー|Calendar|Google|スケジュール|打ち合わせ|ミーティング/i.test(t);
    return write && googleCtx;
  }

  function matchIntent(userText) {
    const text = trim(userText, 2000);
    if (!text) return { intent: INTENTS.none, params: {} };

    if (isWriteIntent(text)) {
      return { intent: INTENTS.write_blocked, params: {} };
    }

    const pickIndex = extractPickIndex(text);
    const wantsDetail = isGmailDetailText(text);
    const gmailCtx = isGmailMailContext(text);

    if (pickIndex > 0 && gmailCtx) {
      if (/要約/.test(text)) {
        return { intent: INTENTS.gmail_detail_summarize, params: { pickIndex } };
      }
      return {
        intent: INTENTS.gmail_pick,
        params: { pickIndex, mode: /全文/.test(text) ? "full" : wantsDetail ? "detail" : "show" },
      };
    }

    if (/要約/.test(text) && /(詳しく|詳細|本文)/.test(text) && /メール|mail|Gmail/i.test(text)) {
      const params = {};
      if (/昨日|前日/.test(text)) params.dateHint = "yesterday";
      const name = extractPersonName(text);
      if (name) params.contactName = name;
      return { intent: INTENTS.gmail_detail_summarize, params };
    }

    const contactForDetail = extractPersonName(text);
    if (contactForDetail && /メール|mail|Gmail/i.test(text) && /内容|詳しく|教えて/i.test(text)) {
      return { intent: INTENTS.gmail_search_and_detail, params: { contactName: contactForDetail } };
    }

    if (
      (/このメール|全文/.test(text) || (wantsDetail && gmailCtx)) &&
      !/予定|カレンダー|Calendar/i.test(text)
    ) {
      if (/要約/.test(text)) {
        return { intent: INTENTS.gmail_detail_summarize, params: { mode: /全文/.test(text) ? "full" : "detail" } };
      }
      return { intent: INTENTS.gmail_detail, params: { mode: /全文/.test(text) ? "full" : "detail" } };
    }

    if (/未読.*メール|メール.*未読|未読は/i.test(text)) {
      return { intent: INTENTS.gmail_unread, params: {} };
    }

    if (/要約/.test(text) && /メール|mail|Gmail/i.test(text)) {
      const params = {};
      if (/昨日|前日/.test(text)) params.dateHint = "yesterday";
      const name = extractPersonName(text);
      if (name) params.contactName = name;
      return { intent: INTENTS.gmail_summarize, params };
    }

    if (/今日.*予定|予定.*今日|本日.*予定/i.test(text)) {
      return { intent: INTENTS.calendar_today, params: {} };
    }
    if (/明日.*予定|予定.*明日/i.test(text)) {
      return { intent: INTENTS.calendar_tomorrow, params: {} };
    }
    if (/今週.*予定|予定.*今週|週間.*予定/i.test(text)) {
      return { intent: INTENTS.calendar_week, params: {} };
    }

    if (/予定.*(検索|探)|(.+).*(について|の).*(予定|会議)/i.test(text) && /予定|会議|ミーティング|MTG/i.test(text)) {
      const keyword = text
        .replace(/予定|会議|ミーティング|MTG|教えて|見せて|検索|探して|ください.*/g, " ")
        .replace(/今日|明日|今週/g, " ")
        .trim()
        .slice(0, 80);
      return { intent: INTENTS.calendar_search, params: { query: keyword || text.slice(0, 40) } };
    }

    if (/昨日.*メール|メール.*昨日|前日.*メール/i.test(text)) {
      return { intent: INTENTS.gmail_search, params: { dateHint: "yesterday" } };
    }

    const contactName = extractPersonName(text);
    if (contactName && /メール|mail|Gmail/i.test(text)) {
      return { intent: INTENTS.gmail_search, params: { contactName } };
    }

    if (/メール.*(来|届|検索|探)|(.+?)から.*メール|メール.*あり/i.test(text)) {
      const keyword = text
        .replace(/メール|Gmail|教えて|来てる|届いた|ありますか|ください.*/g, " ")
        .trim()
        .slice(0, 80);
      return { intent: INTENTS.gmail_search, params: { query: keyword || text.slice(0, 40), contactName } };
    }

    return { intent: INTENTS.none, params: {} };
  }

  async function checkConnection() {
    const Coordinator = global.TasuSecretaryGoogleReadonlyCoordinator;
    if (Coordinator?.getState) {
      const st = Coordinator.getState();
      if (st.connected) {
        return { ok: true, connected: true, mock: !!st.mock };
      }
    }
    const OAuth = global.TasuSecretaryGoogleOAuthClient;
    if (!OAuth?.fetchStatus) {
      return { ok: true, connected: false, mock: false, configured: false };
    }
    const status = await OAuth.fetchStatus();
    return {
      ok: true,
      connected: Boolean(status.connected),
      mock: Boolean(status.mock),
      configured: Boolean(status.configured),
    };
  }

  function saveGmailListContext(messages, meta) {
    const Ctx = global.TasuSecretaryGoogleChatGmailContext;
    if (Ctx?.saveList) Ctx.saveList(messages, meta);
  }

  function formatMailLine(m, idx) {
    const subject = trim(m.subject, 120) || "(件名なし)";
    const from = trim(m.from, 80) || "(不明)";
    const snippet = trim(m.snippet, 120);
    return `${idx + 1}. ${subject}（${from}）${snippet ? ` — ${snippet}` : ""}`;
  }

  function formatEventLine(ev, idx) {
    const title = trim(ev.title || ev.summary, 120) || "(無題)";
    let when = "";
    try {
      const start = ev.start ? new Date(ev.start) : null;
      if (start && Number.isFinite(start.getTime())) {
        when = start.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    } catch {
      when = trim(ev.start, 40);
    }
    const loc = trim(ev.location, 60);
    return `${idx + 1}. ${when ? `${when} ` : ""}${title}${loc ? ` @ ${loc}` : ""}`;
  }

  function deterministicGmailReply(intent, messages, label) {
    messages = Array.isArray(messages) ? messages : [];
    const head = label || "メール";
    if (!messages.length) {
      return `${head}は見つかりませんでした。`;
    }
    const lines = messages.slice(0, GMAIL_LIST_MAX).map((m, i) => formatMailLine(m, i));
    return `${head} ${messages.length} 件:\n${lines.join("\n")}`;
  }

  function deterministicCalendarReply(label, events) {
    events = Array.isArray(events) ? events : [];
    if (!events.length) {
      return `${label}はありません。`;
    }
    const lines = events.slice(0, CALENDAR_MAX).map((ev, i) => formatEventLine(ev, i));
    return `${label} ${events.length} 件:\n${lines.join("\n")}`;
  }

  function attachmentNote(message) {
    if (!message?.hasAttachment || !Array.isArray(message.attachments) || !message.attachments.length) {
      return "";
    }
    const names = message.attachments
      .slice(0, 3)
      .map((a) => trim(a.filename, 60))
      .filter(Boolean)
      .join(", ");
    return names ? `\n添付: ${names}` : "";
  }

  function deterministicBodyReply(message, mode, pickIndex) {
    message = message || {};
    const subject = trim(message.subject, 120) || "(件名なし)";
    const from = trim(message.from, 80) || "(不明)";
    const snippet = trim(message.snippet, 300);
    let body = trim(message.bodyText, GMAIL_BODY_DISPLAY_MAX) || snippet;
    const head = pickIndex ? `${pickIndex}件目: ` : "";
    const truncNote = message.bodyTruncated ? "\n（本文は長いため省略）" : "";
    const attach = attachmentNote(message);

    if (mode === "full") {
      return `${head}${subject}（${from}）\n${body}${truncNote}${attach}`;
    }

    const preview = body.slice(0, 800);
    return `${head}${subject}（${from}）\n${preview}${body.length > 800 ? "…" : ""}${truncNote}${attach}`;
  }

  async function summarizeForChat(userText, payloadText, mockFallback) {
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) {
      return { reply: mockFallback(), mock: true };
    }
    const turn = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt:
        "あなたはTASFUL AI運営秘書です。以下のGmail/Calendar read-only 取得結果を、" +
        "運営者向けに3〜6行の日本語で要約してください。件名・時刻・送信者のみ引用可。" +
        "返信・送信・予定変更の提案は不要。Google APIは実行しない。",
      modeId: "ops_secretary",
      mockFallback: () => mockFallback(),
    });
    const reply = trim(turn.reply, 4000);
    return { reply: reply || mockFallback(), mock: !!turn.fallback_used };
  }

  async function summarizeBodyForChat(userText, message, mockFallback, pickIndex) {
    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    const subject = trim(message?.subject, 200) || "(件名なし)";
    const from = trim(message?.from, 200) || "(不明)";
    let body = trim(message?.bodyText, GMAIL_BODY_LLM_MAX) || trim(message?.snippet, 300);
    const San = global.TasuSecretaryOpsContextSanitize;
    if (San?.sanitizeText) body = San.sanitizeText(body, GMAIL_BODY_LLM_MAX);

    const payload = `件名: ${subject}\n差出人: ${from}\n本文:\n${body}`;
    const head = pickIndex ? `${pickIndex}件目 ` : "";

    if (!Adapter?.completeTurn) {
      return { reply: mockFallback(), mock: true };
    }

    const turn = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt:
        "あなたはTASFUL AI運営秘書です。以下のメール本文（read-only 取得）を、" +
        "運営者向けに3〜8行の日本語で要約してください。重要な日付・依頼・金額があれば含めてください。" +
        "返信・送信の提案は不要。\n\n" +
        payload,
      modeId: "ops_secretary",
      mockFallback: () => mockFallback(),
    });

    const summary = trim(turn.reply, 4000) || mockFallback();
    return {
      reply: `${head}${subject}（${from}）\n${summary}${attachmentNote(message)}`,
      mock: !!turn.fallback_used,
    };
  }

  async function fetchMessageBody(messageId) {
    const Gmail = global.TasuSecretaryGoogleGmailClient;
    if (!Gmail?.getMessage) return { ok: false, error: "gmail_client_missing" };
    return Gmail.getMessage(messageId, { includeBody: true });
  }

  async function runGmailUnread() {
    const Gmail = global.TasuSecretaryGoogleGmailClient;
    if (!Gmail?.listMessages) return { ok: false, error: "gmail_client_missing" };
    return Gmail.listMessages({ preset: "unread", maxResults: GMAIL_LIST_MAX });
  }

  async function runGmailSearch(params) {
    const Gmail = global.TasuSecretaryGoogleGmailClient;
    if (!Gmail?.listMessages) return { ok: false, error: "gmail_client_missing" };
    params = params || {};
    let q;
    if (params.dateHint === "yesterday") {
      q = buildYesterdayQuery();
    } else if (params.contactName) {
      q = `from:${params.contactName}`;
    } else if (params.query) {
      q = trim(params.query, 200);
    }
    return Gmail.listMessages({ q, maxResults: params.summarize ? GMAIL_SUMMARY_MAX : GMAIL_LIST_MAX });
  }

  async function runCalendar(preset, params) {
    const Calendar = global.TasuSecretaryGoogleCalendarClient;
    if (!Calendar?.listEvents) return { ok: false, error: "calendar_client_missing" };
    params = params || {};
    return Calendar.listEvents({
      preset,
      q: params.query ? trim(params.query, 120) : undefined,
      maxResults: CALENDAR_MAX,
    });
  }

  function resolveContextRef(params) {
    const Ctx = global.TasuSecretaryGoogleChatGmailContext;
    if (!Ctx) return null;
    if (params?.pickIndex) return Ctx.getByIndex(params.pickIndex);
    return Ctx.getLast();
  }

  async function runGmailDetailFromRef(ref, userText, params) {
    if (!ref?.id) return { ok: false, error: "no_message_ref" };
    const result = await fetchMessageBody(ref.id);
    if (!result.ok) return result;
    const message = result.data?.message;
    if (!message) return { ok: false, error: "message_not_found" };

    const mode = params?.mode || "detail";
    const pickIndex = params?.pickIndex || ref.index || 0;
    const det = () => deterministicBodyReply(message, mode, pickIndex);

    if (/要約/.test(userText) || params?.summarize) {
      const sum = await summarizeBodyForChat(userText, message, det, pickIndex);
      return { ok: true, reply: sum.reply, mock: sum.mock || result.data?.mock };
    }

    return { ok: true, reply: det(), mock: result.data?.mock };
  }

  async function runGmailSearchAndDetail(params, userText) {
    const listResult = await runGmailSearch({ ...params, summarize: false });
    if (!listResult.ok) return listResult;
    const messages = listResult.data?.messages || [];
    const label = params.contactName ? `${params.contactName}さんからのメール` : "該当メール";
    if (!messages.length) {
      return { ok: true, reply: `${label}は見つかりませんでした。`, mock: listResult.data?.mock };
    }

    saveGmailListContext(messages, { sourceIntent: INTENTS.gmail_search_and_detail, label });
    const ref = { index: 1, id: messages[0].id, threadId: messages[0].threadId };
    const detail = await runGmailDetailFromRef(ref, userText, { ...params, pickIndex: 1, summarize: true });
    if (!detail.ok) return detail;
    return { ok: true, reply: detail.reply, mock: Boolean(detail.mock || listResult.data?.mock) };
  }

  async function runGmailDetailSummarize(params, userText) {
    if (params?.dateHint || params?.contactName) {
      const listResult = await runGmailSearch({ ...params, summarize: true });
      if (!listResult.ok) return listResult;
      const messages = listResult.data?.messages || [];
      const label =
        params.dateHint === "yesterday"
          ? "昨日のメール"
          : params.contactName
            ? `${params.contactName}さんからのメール`
            : "メール";
      if (!messages.length) {
        return { ok: true, reply: `${label}は見つかりませんでした。`, mock: listResult.data?.mock };
      }
      saveGmailListContext(messages, { sourceIntent: INTENTS.gmail_detail_summarize, label });
      const pickIndex = params.pickIndex || 1;
      const target = messages[pickIndex - 1] || messages[0];
      const ref = { index: pickIndex, id: target.id, threadId: target.threadId };
      const detail = await runGmailDetailFromRef(ref, userText, { ...params, pickIndex, summarize: true });
      if (!detail.ok) return detail;
      return { ok: true, reply: detail.reply, mock: Boolean(detail.mock || listResult.data?.mock) };
    }

    const ref = resolveContextRef(params);
    if (!ref) {
      return { ok: true, reply: NO_CONTEXT_REPLY, mock: false };
    }
    return runGmailDetailFromRef(ref, userText, { ...params, summarize: true });
  }

  async function executeReadTool(intent, params, userText) {
    if (intent === INTENTS.gmail_pick || intent === INTENTS.gmail_detail) {
      const ref = resolveContextRef(params);
      if (!ref) {
        return { ok: true, reply: NO_CONTEXT_REPLY, mock: false };
      }
      return runGmailDetailFromRef(ref, userText, params);
    }

    if (intent === INTENTS.gmail_detail_summarize) {
      return runGmailDetailSummarize(params, userText);
    }

    if (intent === INTENTS.gmail_search_and_detail) {
      return runGmailSearchAndDetail(params, userText);
    }

    if (intent === INTENTS.gmail_unread) {
      const result = await runGmailUnread();
      if (!result.ok) return result;
      const messages = result.data?.messages || [];
      saveGmailListContext(messages, { sourceIntent: intent, label: "未読メール" });
      const det = () => deterministicGmailReply(intent, messages, "未読メール");
      if (/要約/.test(userText)) {
        const sum = await summarizeForChat(userText, det(), det);
        return { ok: true, reply: sum.reply, mock: sum.mock || result.data?.mock };
      }
      return { ok: true, reply: det(), mock: result.data?.mock };
    }

    if (intent === INTENTS.gmail_search) {
      const result = await runGmailSearch(params);
      if (!result.ok) return result;
      const messages = result.data?.messages || [];
      const label =
        params.dateHint === "yesterday"
          ? "昨日届いたメール"
          : params.contactName
            ? `${params.contactName}さんからのメール`
            : "該当メール";
      saveGmailListContext(messages, { sourceIntent: intent, label });
      return { ok: true, reply: deterministicGmailReply(intent, messages, label), mock: result.data?.mock };
    }

    if (intent === INTENTS.gmail_summarize) {
      const result = await runGmailSearch({ ...params, summarize: true });
      if (!result.ok) return result;
      const messages = result.data?.messages || [];
      const label = params.dateHint === "yesterday" ? "昨日のメール" : "メール";
      saveGmailListContext(messages, { sourceIntent: intent, label });
      const det = () => deterministicGmailReply(intent, messages, label);
      const sum = await summarizeForChat(userText, det(), det);
      return { ok: true, reply: sum.reply, mock: sum.mock || result.data?.mock };
    }

    if (intent === INTENTS.calendar_today) {
      const result = await runCalendar("today", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      return { ok: true, reply: deterministicCalendarReply("今日の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_tomorrow) {
      const result = await runCalendar("tomorrow", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      return { ok: true, reply: deterministicCalendarReply("明日の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_week) {
      const result = await runCalendar("this_week", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      return { ok: true, reply: deterministicCalendarReply("今週の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_search) {
      const result = await runCalendar("next_7_days", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      return { ok: true, reply: deterministicCalendarReply("該当予定", events), mock: result.data?.mock };
    }

    return { ok: false, error: "unknown_intent" };
  }

  async function tryHandle(userText, options) {
    options = options || {};
    const { intent, params } = matchIntent(userText);
    if (intent === INTENTS.none) {
      return { handled: false, intent };
    }

    if (intent === INTENTS.write_blocked) {
      return { handled: true, intent, reply: WRITE_REPLY, mock: false };
    }

    const conn = await checkConnection();
    if (!conn.connected) {
      return { handled: true, intent, reply: DISCONNECT_REPLY, mock: false, disconnected: true };
    }

    const tool = await executeReadTool(intent, params, userText);
    if (!tool.ok) {
      const err = trim(tool.error, 80) || "read_failed";
      return {
        handled: true,
        intent,
        reply: `Google データの取得に失敗しました（${err}）。しばらくしてから再度お試しください。`,
        mock: false,
        error: err,
      };
    }

    let reply = tool.reply;
    if (conn.mock || tool.mock) {
      reply = `${reply}\n\n（mock データ · read-only）`;
    }

    return {
      handled: true,
      intent,
      reply,
      mock: Boolean(conn.mock || tool.mock),
    };
  }

  global.TasuSecretaryGoogleChatRouter = {
    INTENTS,
    matchIntent,
    tryHandle,
    checkConnection,
    WRITE_REPLY,
    DISCONNECT_REPLY,
    NO_CONTEXT_REPLY,
  };
})(typeof window !== "undefined" ? window : globalThis);
