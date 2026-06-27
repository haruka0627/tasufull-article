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
    context_more_detail: "context_more_detail",
    context_reply_draft: "context_reply_draft",
    context_refine_short: "context_refine_short",
    context_refine_keigo: "context_refine_keigo",
    context_refine_polite: "context_refine_polite",
    context_refine_casual: "context_refine_casual",
    context_refine_bullets: "context_refine_bullets",
    context_refine_lines3: "context_refine_lines3",
    context_refine_one_line: "context_refine_one_line",
    context_refine_subject: "context_refine_subject",
    context_triage: "context_triage",
    context_cross_calendar: "context_cross_calendar",
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

  const NO_FOLLOWUP_REPLY =
    "直近のメールや応答がありません。先にメール/予定を取得するか、詳細を表示してください。";

  const READONLY_DRAFT_FOOTER = "\n\n※ read-only · 送信・下書き保存は未対応";

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

  function getChatContext() {
    return global.TasuSecretaryGoogleChatContext;
  }

  function stripMockFooter(reply) {
    return String(reply || "")
      .replace(/\n\n（mock データ · read-only）\s*$/, "")
      .trim();
  }

  function isReplyDraftIntent(text) {
    return /返信案|返信文|下書き案|文案/.test(text) && /作|考|提示|見せ|ください|して|お願い/.test(text);
  }

  function isPronounMailRef(text) {
    return /^(それ|これ|あれ|このメール|あのメール|そのメール|この件)|^(それ|これ|あの)(は|を|の|、)/.test(
      String(text || "").trim()
    );
  }

  function isPronounCalendarRef(text) {
    return /その予定|この予定|あの予定/.test(text);
  }

  function hadRecentGmailInHistory(history) {
    if (!Array.isArray(history)) return false;
    const tail = history.slice(-8);
    return tail.some((m) => {
      const gi = String(m?.googleIntent || "");
      return gi.startsWith("gmail") || gi.startsWith("context_");
    });
  }

  function hasResolvableGmailContext(history) {
    const U = getChatContext();
    if (U?.hasGmailFocus?.()) return true;
    if (U?.hasGmailList?.()) return true;
    const turn = U?.getLastTurn?.();
    if (turn && turn.kind !== "calendar") return true;
    return hadRecentGmailInHistory(history);
  }

  function hasResolvableCalendarContext(history) {
    const U = getChatContext();
    if (U?.hasCalendarList?.()) return true;
    const turn = U?.getLastTurn?.();
    if (turn?.kind === "calendar") return true;
    if (!Array.isArray(history)) return false;
    return history.slice(-8).some((m) => String(m?.googleIntent || "").startsWith("calendar"));
  }

  function isTriageText(text) {
    const t = String(text || "");
    return (
      /(このメール|あのメール|そのメール|メール|それ|この件).*(重要|急ぎ|後で|返信必要|優先|要対応)/i.test(t) ||
      /^(重要|急ぎ|後でいい|後回し|返信必要|対応優先度|要対応)/.test(t.trim()) ||
      /重要\s*[？?]|急ぎ\s*[？?]|後でいい\s*[？?]|返信必要\s*[？?]|対応優先度\s*[？?]|優先度\s*[？?]/.test(t)
    );
  }

  function isCrossCalendarText(text) {
    const t = String(text || "");
    return (
      /予定.*(照ら|比較|確認)|照らして|今日の予定と|返信.*(いつ|タイミング|時期)|いつ返信|いつがいい/i.test(t) ||
      (/この予定|その予定/.test(t) && /前|対応|返信|間に/.test(t))
    );
  }

  function isReplyDraftLastTurn() {
    const turn = getChatContext()?.getLastTurn?.();
    if (!turn) return false;
    const si = String(turn.sourceIntent || "");
    if (si === INTENTS.context_reply_draft) return true;
    if (si.startsWith("context_refine_")) return true;
    return /返信案|未送信/.test(turn.assistantPreview || "");
  }

  function isRefineText(text) {
    return /もっと短く|短くして|短めに|簡潔に|敬語|丁寧|カジュアル|箇条書き|ブレット|3行|３行|1文|１文|一件名|件名案|件名も/.test(
      String(text || "")
    );
  }

  function matchRefineMode(text) {
    const t = String(text || "");
    if (/件名案|件名も|一件名/.test(t)) return "subject";
    if (/箇条書き|ブレット/.test(t)) return "bullets";
    if (/3行|３行/.test(t)) return "lines3";
    if (/1文|１文/.test(t)) return "one_line";
    if (/カジュアル|くだけた|フランク/.test(t)) return "casual";
    if (/もっと丁寧/.test(t)) return "polite";
    if (/敬語|丁寧に|丁寧語/.test(t)) return "keigo";
    if (/もっと短く|短くして|短めに|簡潔に/.test(t)) return "short";
    return "";
  }

  function refineIntentForMode(mode) {
    const map = {
      short: INTENTS.context_refine_short,
      keigo: INTENTS.context_refine_keigo,
      polite: INTENTS.context_refine_polite,
      casual: INTENTS.context_refine_casual,
      bullets: INTENTS.context_refine_bullets,
      lines3: INTENTS.context_refine_lines3,
      one_line: INTENTS.context_refine_one_line,
      subject: INTENTS.context_refine_subject,
    };
    return map[mode] || INTENTS.none;
  }

  function isWriteIntent(text) {
    const t = String(text || "");
    if (isReplyDraftIntent(t)) return false;
    const write =
      /返信して|返信を送|送信して|送信を|下書きを?(作|保存|作成)|下書き保存|下書き作成|予定を追加|予定追加|予定を入|予定変更|予定削除|削除して|スケジュール.*入|ミーティング.*(入|設定|作成)|打ち合わせ.*(入|設定|作成)/i.test(
        t
      );
    const googleCtx = /メール|Gmail|予定|カレンダー|Calendar|Google|スケジュール|打ち合わせ|ミーティング/i.test(t);
    return write && googleCtx;
  }

  function matchIntent(userText, options) {
    options = options || {};
    const history = options.history;
    const text = trim(userText, 2000);
    if (!text) return { intent: INTENTS.none, params: {} };

    if (isWriteIntent(text)) {
      return { intent: INTENTS.write_blocked, params: {} };
    }

    const chatCtx = getChatContext();

    if (isTriageText(text) && hasResolvableGmailContext(history)) {
      return { intent: INTENTS.context_triage, params: {} };
    }

    if (isCrossCalendarText(text) && hasResolvableGmailContext(history)) {
      return {
        intent: INTENTS.context_cross_calendar,
        params: { needsCalendar: !chatCtx?.hasCalendarList?.() },
      };
    }

    if (isRefineText(text) && isReplyDraftLastTurn() && chatCtx?.hasLastTurn?.()) {
      const mode = matchRefineMode(text);
      const refineIntent = refineIntentForMode(mode);
      if (refineIntent !== INTENTS.none) {
        return { intent: refineIntent, params: { refineMode: mode } };
      }
    }

    if (isReplyDraftIntent(text)) {
      if (hasResolvableGmailContext(history)) {
        return { intent: INTENTS.context_reply_draft, params: { useFocus: true } };
      }
    }

    if (/もっと短く|短くして|短めに|簡潔に/.test(text) && chatCtx?.hasLastTurn?.() && isReplyDraftLastTurn()) {
      return { intent: INTENTS.context_refine_short, params: {} };
    }

    if (/敬語|丁寧に|丁寧語/.test(text) && chatCtx?.hasLastTurn?.() && isReplyDraftLastTurn()) {
      return { intent: INTENTS.context_refine_keigo, params: {} };
    }

    if (
      (isPronounMailRef(text) || /^(それ|このメール|あのメール|この件)/.test(text)) &&
      /詳しく|もう少し|詳細/.test(text) &&
      !/要約/.test(text)
    ) {
      if (hasResolvableGmailContext(history)) {
        return {
          intent: INTENTS.context_more_detail,
          params: { mode: /全文/.test(text) ? "full" : "detail", useFocus: true },
        };
      }
    }

    const pickIndex = extractPickIndex(text);
    const wantsDetail = isGmailDetailText(text);
    const gmailCtx = isGmailMailContext(text) || isPronounMailRef(text);

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
      const params = { useFocus: true };
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
      (/このメール|あのメール|全文|それ/.test(text) || (wantsDetail && gmailCtx)) &&
      !/予定|カレンダー|Calendar/i.test(text) &&
      !isPronounCalendarRef(text)
    ) {
      if (hasResolvableGmailContext(history)) {
        if (/要約/.test(text)) {
          return {
            intent: INTENTS.gmail_detail_summarize,
            params: { mode: /全文/.test(text) ? "full" : "detail", useFocus: true },
          };
        }
        return {
          intent: INTENTS.gmail_detail,
          params: { mode: /全文/.test(text) ? "full" : "detail", useFocus: true },
        };
      }
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

  function saveCalendarListContext(events, meta) {
    const U = getChatContext();
    if (U?.saveCalendarList) U.saveCalendarList(events, meta);
  }

  function persistGmailFocus(message, meta) {
    const U = getChatContext();
    if (U?.saveGmailFocus) U.saveGmailFocus(message, meta);
  }

  function persistLastTurn(intent, userText, reply, kind) {
    const U = getChatContext();
    if (U?.saveLastTurn) {
      U.saveLastTurn({
        sourceIntent: intent,
        userText,
        assistantText: stripMockFooter(reply),
        kind: kind || "gmail",
      });
    }
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

  function resolveContextRef(params, options) {
    options = options || {};
    params = params || {};
    const U = getChatContext();
    const Ctx = global.TasuSecretaryGoogleChatGmailContext;

    if (params.pickIndex && Ctx?.getByIndex) {
      const byIdx = Ctx.getByIndex(params.pickIndex);
      if (byIdx?.id) return { index: params.pickIndex, id: byIdx.id, threadId: byIdx.threadId };
    }

    const focus = U?.getGmailFocusRef?.();
    if (focus?.id && (params.useFocus !== false || params.fromFocus || params.preferFocus)) {
      return {
        index: focus.index,
        id: focus.id,
        threadId: focus.threadId,
        fromFocus: true,
        bodyPreview: focus.bodyPreview,
      };
    }

    if (params.useFocus !== false && focus?.id) {
      return {
        index: focus.index,
        id: focus.id,
        threadId: focus.threadId,
        fromFocus: true,
        bodyPreview: focus.bodyPreview,
      };
    }

    const first = U?.getGmailListFirst?.();
    if (first?.id && params.allowListFallback !== false) {
      return { index: first.index || 1, id: first.id, threadId: first.threadId };
    }

    const turn = U?.getLastTurn?.();
    if (turn?.kind === "gmail" && focus?.id) {
      return {
        index: focus.index,
        id: focus.id,
        threadId: focus.threadId,
        fromFocus: true,
        bodyPreview: focus.bodyPreview,
      };
    }

    const history = options.history;
    if (Array.isArray(history) && history.length && hadRecentGmailInHistory(history)) {
      if (first?.id) {
        return { index: first.index || 1, id: first.id, threadId: first.threadId };
      }
    }

    if (Ctx?.getLast) {
      const last = Ctx.getLast();
      if (last?.id) return { index: last.index, id: last.id, threadId: last.threadId };
    }

    return null;
  }

  function resolveGmailFocusForContext() {
    const U = getChatContext();
    const focus = U?.getGmailFocusRef?.();
    if (focus?.id) return focus;
    const first = U?.getGmailListFirst?.();
    if (first?.id) {
      return {
        index: first.index || 1,
        id: first.id,
        threadId: first.threadId,
        subject: first.subject,
        from: first.from,
        snippet: first.snippet,
        date: first.date,
        bodyPreview: first.snippet,
      };
    }
    return null;
  }

  function formatCalendarContextForLlm(calMeta) {
    if (!calMeta?.items?.length) return "（予定なし）";
    return calMeta.items
      .slice(0, CALENDAR_MAX)
      .map((ev) => {
        const title = trim(ev.title, 120) || "(無題)";
        const start = trim(ev.start, 40);
        const loc = trim(ev.location, 60);
        return `- ${start ? `${start} ` : ""}${title}${loc ? ` @ ${loc}` : ""}`;
      })
      .join("\n");
  }

  function focusToMessage(focus) {
    if (!focus) return null;
    return {
      id: focus.id,
      threadId: focus.threadId,
      subject: focus.subject,
      from: focus.from,
      snippet: focus.snippet,
      date: focus.date,
      bodyText: focus.bodyPreview,
      bodyTruncated: focus.bodyTruncated,
      hasAttachment: focus.hasAttachment,
      attachments: (focus.attachmentNames || []).map((filename) => ({ filename })),
    };
  }

  function deterministicReplyDraft(focus) {
    const subject = trim(focus?.subject, 120) || "件名";
    const snippet = trim(focus?.bodyPreview || focus?.snippet, 200);
    return `（mock返信案）\n\n${subject} について確認いたします。\n${snippet ? `\n${snippet.slice(0, 120)}` : ""}\n\nよろしくお願いいたします。`;
  }

  function deterministicRefineShort(text) {
    const lines = String(text || "")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.slice(0, 3).join("\n") || String(text || "").slice(0, 200);
  }

  function deterministicRefineKeigo(text) {
    const base = String(text || "").trim();
    if (!base) return "（mock）承知いたしました。";
    return base
      .replace(/です$/gm, "でございます")
      .replace(/ます$/gm, "ます")
      .slice(0, 800);
  }

  function deterministicRefinePolite(text) {
    const base = String(text || "").trim();
    if (!base) return "（mock）恐れ入りますが、ご確認ください。";
    return `恐れ入りますが、\n${base}`.slice(0, 800);
  }

  function deterministicRefineCasual(text) {
    const base = String(text || "").trim();
    if (!base) return "（mock）了解です！";
    return base.replace(/いたします/g, "します").replace(/でございます/g, "です").slice(0, 800);
  }

  function deterministicRefineBullets(text) {
    const lines = String(text || "")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((l) => `・${l.replace(/^・/, "")}`).join("\n") || "・（mock）確認します";
  }

  function deterministicRefineLines3(text) {
    return deterministicRefineShort(text);
  }

  function deterministicRefineOneLine(text) {
    const flat = String(text || "")
      .replace(/\n+/g, " ")
      .trim();
    return flat.slice(0, 120) || "（mock）確認します。";
  }

  function deterministicRefineSubject(text, focus) {
    const subject = trim(focus?.subject, 80) || "Re: 件名";
    const body = deterministicRefineOneLine(text);
    return `件名案: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}\n\n${body}`;
  }

  function deterministicTriage(focus, userText) {
    const subject = trim(focus?.subject, 80) || "件名";
    const snippet = trim(focus?.bodyPreview || focus?.snippet, 120);
    const urgent = /期限|至急|ASAP|本日|今日中|緊急/i.test(`${subject} ${snippet} ${userText}`);
    const stars = urgent ? "★★★★☆" : "★★★☆☆";
    return (
      `重要度\n${stars}\n\n` +
      `理由\n（mock）${subject} — ${snippet || "内容を確認してください"}\n\n` +
      `推奨\n${urgent ? "本日中に確認・返信を検討" : "時間のあるときに確認"}`
    );
  }

  function deterministicCrossCalendar(focus, calMeta, userText) {
    const subject = trim(focus?.subject, 80) || "メール";
    const calLines = formatCalendarContextForLlm(calMeta);
    const timing =
      /いつ|タイミング|時期/.test(userText) || /返信.*なら/.test(userText)
        ? "空き時間: 予定の合間または予定前後を推奨"
        : "予定との兼ね合い: 上記予定を確認のうえ対応";
    return (
      `【Gmail × Calendar 照合 · read-only】\n\n` +
      `メール: ${subject}\n\n` +
      `今日の予定:\n${calLines}\n\n` +
      `所見\n（mock）${timing}\n\n` +
      `※ 予定の追加・変更は未対応`
    );
  }

  function extractReplyDraftBody(assistantPreview) {
    let text = String(assistantPreview || "");
    text = text.replace(/^【返信案[^】]*】\s*/i, "");
    text = text.replace(/\n\n※ read-only[^\n]*$/i, "");
    return text.trim();
  }

  async function runContextMoreDetail(params, userText) {
    const U = getChatContext();
    const focus = U?.getGmailFocusRef?.();
    if (!focus?.id) {
      return { ok: true, reply: NO_FOLLOWUP_REPLY, mock: false };
    }
    if (focus.bodyPreview) {
      const message = focusToMessage(focus);
      const pickIndex = focus.index || 0;
      if (/要約/.test(userText)) {
        const sum = await summarizeBodyForChat(userText, message, () => deterministicBodyReply(message, params?.mode, pickIndex), pickIndex);
        persistGmailFocus(message, { index: pickIndex, sourceIntent: INTENTS.context_more_detail });
        return { ok: true, reply: sum.reply, mock: sum.mock };
      }
      const reply = deterministicBodyReply(message, params?.mode || "detail", pickIndex);
      return { ok: true, reply, mock: false };
    }
    return runGmailDetailFromRef(
      { index: focus.index, id: focus.id, threadId: focus.threadId, fromFocus: Boolean(focus.bodyPreview) },
      userText,
      { ...params, pickIndex: focus.index, sourceIntent: INTENTS.context_more_detail },
      {}
    );
  }

  async function runContextTriage(userText) {
    const focus = resolveGmailFocusForContext();
    if (!focus) {
      return { ok: true, reply: NO_FOLLOWUP_REPLY, mock: false };
    }

    let body = trim(focus.bodyPreview, 1500) || trim(focus.snippet, 300);
    const San = global.TasuSecretaryOpsContextSanitize;
    if (San?.sanitizeText) body = San.sanitizeText(body, 1500);

    const det = () => deterministicTriage(focus, userText);
    const payload =
      `件名: ${trim(focus.subject, 200)}\n差出人: ${trim(focus.from, 200)}\n本文:\n${body}\n\n` +
      "上記メールについて、重要度（★1〜5）、理由、推奨アクションを日本語で回答してください。" +
      "形式: 重要度 / 理由 / 推奨 の3セクション。送信・予定変更は不要。";

    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) {
      return { ok: true, reply: det(), mock: true };
    }

    const turn = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt: "あなたはTASFUL AI運営秘書です。" + payload,
      modeId: "ops_secretary",
      mockFallback: det,
    });

    return {
      ok: true,
      reply: trim(turn.reply, 4000) || det(),
      mock: !!turn.fallback_used,
    };
  }

  async function runContextCrossCalendar(userText, params) {
    const focus = resolveGmailFocusForContext();
    if (!focus) {
      return { ok: true, reply: NO_FOLLOWUP_REPLY, mock: false };
    }

    const U = getChatContext();
    let calMeta = U?.getCalendarListMeta?.();
    let calMock = false;

    if ((!calMeta?.items?.length || params?.needsCalendar) && U && !U.hasCalendarList?.()) {
      const result = await runCalendar("today", {});
      if (result.ok) {
        const events = result.data?.events || [];
        saveCalendarListContext(events, { sourceIntent: INTENTS.context_cross_calendar, label: "今日の予定", preset: "today" });
        calMeta = U.getCalendarListMeta?.();
        calMock = Boolean(result.data?.mock);
      }
    }

    let body = trim(focus.bodyPreview, 1200) || trim(focus.snippet, 300);
    const San = global.TasuSecretaryOpsContextSanitize;
    if (San?.sanitizeText) body = San.sanitizeText(body, 1200);

    const calText = formatCalendarContextForLlm(calMeta);
    const det = () => deterministicCrossCalendar(focus, calMeta, userText);
    const payload =
      `【メール】\n件名: ${trim(focus.subject, 200)}\n差出人: ${trim(focus.from, 200)}\n本文:\n${body}\n\n` +
      `【今日の予定】\n${calText}\n\n` +
      "Gmail と Calendar を read-only で照合し、返信タイミングや対応優先の所見を日本語で述べてください。" +
      "予定の追加・変更・送信は不要。";

    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) {
      return { ok: true, reply: det(), mock: true || calMock };
    }

    const turn = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt: "あなたはTASFUL AI運営秘書です。" + payload,
      modeId: "ops_secretary",
      mockFallback: det,
    });

    return {
      ok: true,
      reply: trim(turn.reply, 4000) || det(),
      mock: !!turn.fallback_used || calMock,
    };
  }

  async function runContextReplyDraft(userText) {
    const focus = resolveGmailFocusForContext();
    if (!focus) {
      return { ok: true, reply: NO_FOLLOWUP_REPLY, mock: false };
    }
    const U = getChatContext();
    const preview = U.getGmailFocusPreview?.() || focus;
    const det = () => `【返信案 · 未送信】\n${deterministicReplyDraft(preview)}${READONLY_DRAFT_FOOTER}`;

    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    let body = trim(focus.bodyPreview, 1500) || trim(focus.snippet, 300);
    const San = global.TasuSecretaryOpsContextSanitize;
    if (San?.sanitizeText) body = San.sanitizeText(body, 1500);

    const payload =
      `件名: ${trim(focus.subject, 200)}\n差出人: ${trim(focus.from, 200)}\n本文:\n${body}\n\n` +
      "上記メールへの返信案を日本語で作成してください。送信はしません。本文のみ返してください。";

    if (!Adapter?.completeTurn) {
      return { ok: true, reply: det(), mock: true };
    }

    const turn = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt: "あなたはTASFUL AI運営秘書です。" + payload,
      modeId: "ops_secretary",
      mockFallback: () => deterministicReplyDraft(preview),
    });

    const draft = trim(turn.reply, 4000) || deterministicReplyDraft(preview);
    return {
      ok: true,
      reply: `【返信案 · 未送信】\n${draft}${READONLY_DRAFT_FOOTER}`,
      mock: !!turn.fallback_used,
    };
  }

  async function runContextRefine(userText, mode) {
    const turn = getChatContext()?.getLastTurn?.();
    if (!turn?.assistantPreview || !isReplyDraftLastTurn()) {
      return { ok: true, reply: NO_FOLLOWUP_REPLY, mock: false };
    }

    const draftBody = extractReplyDraftBody(turn.assistantPreview);
    const focus = getChatContext()?.getGmailFocusPreview?.();

    const detMap = {
      keigo: () => deterministicRefineKeigo(draftBody),
      polite: () => deterministicRefinePolite(draftBody),
      casual: () => deterministicRefineCasual(draftBody),
      bullets: () => deterministicRefineBullets(draftBody),
      lines3: () => deterministicRefineLines3(draftBody),
      one_line: () => deterministicRefineOneLine(draftBody),
      subject: () => deterministicRefineSubject(draftBody, focus),
      short: () => deterministicRefineShort(draftBody),
    };
    const det = detMap[mode] || detMap.short;

    const promptMap = {
      keigo: "以下の返信案を敬語のビジネス調に書き直してください。送信・実行操作は不要。\n\n",
      polite: "以下の返信案をより丁寧なビジネス調に書き直してください。送信・実行操作は不要。\n\n",
      casual: "以下の返信案をカジュアルだが礼儀正しい調子に書き直してください。送信・実行操作は不要。\n\n",
      bullets: "以下の返信案を箇条書き（・始まり）に整理してください。送信・実行操作は不要。\n\n",
      lines3: "以下の返信案を3行以内に要約してください。送信・実行操作は不要。\n\n",
      one_line: "以下の返信案を1文に要約してください。送信・実行操作は不要。\n\n",
      subject: "以下の返信案に加え、適切な件名案（Re: で始める）も提示してください。送信・実行操作は不要。\n\n",
      short: "以下の返信案を3行以内に短く要約してください。送信・実行操作は不要。\n\n",
    };

    const Adapter = global.TasuSecretaryDeepSeekAdapter;
    if (!Adapter?.completeTurn) {
      const out = det();
      return {
        ok: true,
        reply: mode === "subject" ? out : `【返信案 · 未送信】\n${out}${READONLY_DRAFT_FOOTER}`,
        mock: true,
      };
    }

    const result = await Adapter.completeTurn({
      userText: trim(userText, 500),
      systemPrompt: (promptMap[mode] || promptMap.short) + draftBody,
      modeId: "ops_secretary",
      mockFallback: det,
    });

    let reply = trim(result.reply, 4000) || det();
    if (mode !== "subject" && !/^【返信案/.test(reply)) {
      reply = `【返信案 · 未送信】\n${reply}${READONLY_DRAFT_FOOTER}`;
    } else if (mode === "subject" && !/件名/.test(reply)) {
      reply = det();
    } else if (mode === "subject") {
      reply = `${reply}${READONLY_DRAFT_FOOTER}`;
    }

    return {
      ok: true,
      reply,
      mock: !!result.fallback_used,
    };
  }

  async function runGmailDetailFromRef(ref, userText, params, options) {
    if (!ref?.id) return { ok: false, error: "no_message_ref" };

    const mode = params?.mode || "detail";
    const pickIndex = params?.pickIndex || ref.index || 0;
    const U = getChatContext();
    const focus = U?.getGmailFocusRef?.();

    if (ref.fromFocus && focus?.bodyPreview && ref.id === focus.id) {
      const message = focusToMessage(focus);
      const det = () => deterministicBodyReply(message, mode, pickIndex);
      persistGmailFocus(message, {
        index: pickIndex,
        pickIndex,
        sourceIntent: params?.sourceIntent || INTENTS.gmail_detail,
      });
      if (/要約/.test(userText) || params?.summarize) {
        const sum = await summarizeBodyForChat(userText, message, det, pickIndex);
        return { ok: true, reply: sum.reply, mock: sum.mock };
      }
      return { ok: true, reply: det(), mock: false };
    }

    const result = await fetchMessageBody(ref.id);
    if (!result.ok) return result;
    const message = result.data?.message;
    if (!message) return { ok: false, error: "message_not_found" };

    const det = () => deterministicBodyReply(message, mode, pickIndex);

    persistGmailFocus(message, {
      index: pickIndex,
      pickIndex,
      sourceIntent: params?.sourceIntent || INTENTS.gmail_detail,
    });

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

  async function runGmailDetailSummarize(params, userText, options) {
    options = options || {};
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
      const detail = await runGmailDetailFromRef(ref, userText, { ...params, pickIndex, summarize: true }, options);
      if (!detail.ok) return detail;
      return { ok: true, reply: detail.reply, mock: Boolean(detail.mock || listResult.data?.mock) };
    }

    const ref = resolveContextRef(params, options);
    if (!ref) {
      return { ok: true, reply: NO_CONTEXT_REPLY, mock: false };
    }
    return runGmailDetailFromRef(ref, userText, { ...params, summarize: true }, options);
  }

  async function executeReadTool(intent, params, userText, options) {
    options = options || {};

    if (intent === INTENTS.context_triage) {
      return runContextTriage(userText);
    }

    if (intent === INTENTS.context_cross_calendar) {
      return runContextCrossCalendar(userText, params);
    }

    if (intent === INTENTS.context_more_detail) {
      return runContextMoreDetail(params, userText);
    }

    if (intent === INTENTS.context_reply_draft) {
      return runContextReplyDraft(userText);
    }

    if (intent === INTENTS.context_refine_short) {
      return runContextRefine(userText, "short");
    }

    if (intent === INTENTS.context_refine_keigo) {
      return runContextRefine(userText, "keigo");
    }

    if (intent === INTENTS.context_refine_polite) {
      return runContextRefine(userText, "polite");
    }

    if (intent === INTENTS.context_refine_casual) {
      return runContextRefine(userText, "casual");
    }

    if (intent === INTENTS.context_refine_bullets) {
      return runContextRefine(userText, "bullets");
    }

    if (intent === INTENTS.context_refine_lines3) {
      return runContextRefine(userText, "lines3");
    }

    if (intent === INTENTS.context_refine_one_line) {
      return runContextRefine(userText, "one_line");
    }

    if (intent === INTENTS.context_refine_subject) {
      return runContextRefine(userText, "subject");
    }

    if (intent === INTENTS.gmail_pick || intent === INTENTS.gmail_detail) {
      const ref = resolveContextRef(params, options);
      if (!ref) {
        return { ok: true, reply: NO_CONTEXT_REPLY, mock: false };
      }
      return runGmailDetailFromRef(ref, userText, params, options);
    }

    if (intent === INTENTS.gmail_detail_summarize) {
      return runGmailDetailSummarize(params, userText, options);
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
      saveCalendarListContext(events, { sourceIntent: intent, label: "今日の予定", preset: "today" });
      return { ok: true, reply: deterministicCalendarReply("今日の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_tomorrow) {
      const result = await runCalendar("tomorrow", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      saveCalendarListContext(events, { sourceIntent: intent, label: "明日の予定", preset: "tomorrow" });
      return { ok: true, reply: deterministicCalendarReply("明日の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_week) {
      const result = await runCalendar("this_week", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      saveCalendarListContext(events, { sourceIntent: intent, label: "今週の予定", preset: "this_week" });
      return { ok: true, reply: deterministicCalendarReply("今週の予定", events), mock: result.data?.mock };
    }
    if (intent === INTENTS.calendar_search) {
      const result = await runCalendar("next_7_days", params);
      if (!result.ok) return result;
      const events = result.data?.events || [];
      saveCalendarListContext(events, { sourceIntent: intent, label: "該当予定", preset: "next_7_days" });
      return { ok: true, reply: deterministicCalendarReply("該当予定", events), mock: result.data?.mock };
    }

    return { ok: false, error: "unknown_intent" };
  }

  async function tryHandle(userText, options) {
    options = options || {};
    const { intent, params } = matchIntent(userText, options);
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

    const tool = await executeReadTool(intent, params, userText, options);
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

    const kind =
      String(intent).startsWith("calendar") || intent === INTENTS.context_cross_calendar
        ? "calendar"
        : "gmail";
    persistLastTurn(intent, userText, reply, kind);

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
    NO_FOLLOWUP_REPLY,
  };
})(typeof window !== "undefined" ? window : globalThis);
