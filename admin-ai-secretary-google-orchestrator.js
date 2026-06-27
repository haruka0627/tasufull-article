/**
 * AI秘書 Phase 7-A — Google Workspace Orchestrator
 * Combines Gmail / Calendar / Contacts / Drive clients (Phase 6 · no new Google APIs)
 * DeepSeek = intent/params/summary only · Human Gate for write paths unchanged
 */
(function (global) {
  "use strict";

  const LOG_STORAGE_KEY = "tasu_secretary_google_workspace_run_v1";

  const INTENTS = Object.freeze({
    gmail_reply: "gmail_reply",
    calendar_create: "calendar_create",
    gmail_drive_search: "gmail_drive_search",
    contacts_search: "contacts_search",
    drive_search: "drive_search",
    gmail_search: "gmail_search",
  });

  function trim(value, max) {
    return String(value ?? "").trim().slice(0, max || 4000);
  }

  function genId() {
    return `gws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function clients() {
    return {
      Gmail: global.TasuSecretaryGoogleGmailClient,
      Calendar: global.TasuSecretaryGoogleCalendarClient,
      Contacts: global.TasuSecretaryGoogleContactsClient,
      Drive: global.TasuSecretaryGoogleDriveClient,
      OAuth: global.TasuSecretaryGoogleOAuthClient,
      Adapter: global.TasuSecretaryDeepSeekAdapter,
    };
  }

  function extractPersonName(text) {
    const m = String(text || "").match(/([一-龯ぁ-んァ-ンA-Za-z]{1,20})\s*さん/);
    return m?.[1] || "";
  }

  function extractKeyword(text) {
    const raw = trim(text, 500);
    const quoted = raw.match(/[「『"]([^」』"]+)[」』"]/);
    if (quoted?.[1]) return trim(quoted[1], 120);
    const stripped = raw
      .replace(/(?:を|を)?(?:探して|検索|見つけて|ください|お願い).*/g, "")
      .replace(/(?:昨日|今日|届いた|メール|Drive|ドライブ|ファイル|見積書)/g, " ")
      .trim();
    return trim(stripped, 120) || raw.slice(0, 80);
  }

  function parseIntentFallback(userText) {
    const text = trim(userText, 2000);
    const contactName = extractPersonName(text);
    const keyword = extractKeyword(text);

    if (/返信/.test(text)) {
      return { ok: true, intent: INTENTS.gmail_reply, params: { contactName, query: contactName || keyword }, mock: true };
    }
    if (/打ち合わせ|ミーティング|MTG|予定/.test(text)) {
      return { ok: true, intent: INTENTS.calendar_create, params: { contactName, userText: text }, mock: true };
    }
    if (/見積|添付|メール.*探|探して|届いた/.test(text)) {
      return { ok: true, intent: INTENTS.gmail_drive_search, params: { keyword }, mock: true };
    }
    if (/Drive|ドライブ|ファイル/.test(text)) {
      return { ok: true, intent: INTENTS.drive_search, params: { keyword }, mock: true };
    }
    if (/連絡先|Contacts|さん/.test(text) && contactName) {
      return { ok: true, intent: INTENTS.contacts_search, params: { query: contactName }, mock: true };
    }
    return { ok: true, intent: INTENTS.gmail_search, params: { query: keyword || text.slice(0, 80) }, mock: true };
  }

  async function parseIntent(userText) {
    userText = trim(userText, 2000);
    if (!userText) return { ok: false, error: "input_required" };

    const { Adapter } = clients();
    const systemPrompt =
      "あなたはGoogle WorkspaceアシスタントのIntent解析器です。" +
      "ユーザーの入力から intent と params のみをJSONで返してください。" +
      "Google APIは実行しないでください。" +
      'intent は "gmail_reply" | "calendar_create" | "gmail_drive_search" | "contacts_search" | "drive_search" | "gmail_search" のいずれか。' +
      'params 例: { "contactName": "田中", "keyword": "見積書", "userText": "..." }';

    if (!Adapter?.completeTurn) {
      return parseIntentFallback(userText);
    }

    const turn = await Adapter.completeTurn({
      userText,
      systemPrompt,
      modeId: "ops_secretary",
      mockFallback: () => JSON.stringify(parseIntentFallback(userText)),
    });

    try {
      const m = String(turn.reply || "").match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const intent = trim(parsed.intent, 80);
        if (Object.values(INTENTS).includes(intent)) {
          return {
            ok: true,
            intent,
            params: parsed.params && typeof parsed.params === "object" ? parsed.params : {},
            mock: !!turn.fallback_used,
          };
        }
      }
    } catch {
      /* fallback */
    }
    const fb = parseIntentFallback(userText);
    return { ...fb, mock: fb.mock || !!turn.fallback_used };
  }

  function buildPlan(intentResult, userText) {
    const intent = intentResult.intent;
    const params = intentResult.params || {};
    const steps = [];

    if (intent === INTENTS.gmail_reply) {
      steps.push(
        step("contacts_search", "① Contacts検索", "contacts", "read", "searchContacts"),
        step("gmail_search", "② Gmail検索", "gmail", "read", "listMessages"),
        step("reply_draft", "③ 返信案生成", "gmail", "read", "proposeReply"),
        step("human_gate", "④ Human Gate", "human_gate", "human_gate", "enqueueDraft"),
        step("draft_create", "⑤ Draft作成", "gmail", "write", "executeDraft", true)
      );
    } else if (intent === INTENTS.calendar_create) {
      steps.push(
        step("contacts_search", "① Contacts検索", "contacts", "read", "searchContacts"),
        step("calendar_check", "② Calendar確認", "calendar", "read", "listEvents"),
        step("human_gate", "③ Human Gate", "human_gate", "human_gate", "enqueueCalendar"),
        step("calendar_create", "④ Calendar作成", "calendar", "write", "executeCalendar", true)
      );
    } else if (intent === INTENTS.gmail_drive_search) {
      steps.push(
        step("gmail_search", "① Gmail検索", "gmail", "read", "listMessages"),
        step("drive_search", "② Drive検索", "drive", "read", "listFiles"),
        step("summarize", "③ 要約表示", "summary", "read", "summarizeResults")
      );
    } else if (intent === INTENTS.contacts_search) {
      steps.push(step("contacts_search", "① Contacts検索", "contacts", "read", "searchContacts"));
    } else if (intent === INTENTS.drive_search) {
      steps.push(step("drive_search", "① Drive検索", "drive", "read", "listFiles"));
    } else {
      steps.push(step("gmail_search", "① Gmail検索", "gmail", "read", "listMessages"));
    }

    return {
      id: genId(),
      intent,
      userText: trim(userText, 2000),
      params,
      steps,
      status: "ready",
      logs: [],
      context: {},
      humanGatePendingId: "",
      executedApis: [],
      createdAt: new Date().toISOString(),
    };
  }

  function step(id, label, service, kind, action, humanGateRequired) {
    return {
      id,
      label,
      service,
      kind,
      action,
      humanGateRequired: Boolean(humanGateRequired),
      status: "pending",
    };
  }

  function pushLog(plan, entry) {
    plan.logs.push({
      at: new Date().toISOString(),
      ...entry,
    });
  }

  function recordApi(plan, name) {
    if (!plan.executedApis.includes(name)) plan.executedApis.push(name);
  }

  async function ensureConnected() {
    const { OAuth } = clients();
    if (!OAuth?.fetchStatus) return { ok: true, mock: true };
    const status = await OAuth.fetchStatus();
    if (!status.connected && !status.mock) {
      return { ok: false, error: "not_connected" };
    }
    return { ok: true, connected: status.connected, mock: status.mock };
  }

  async function runContactsSearch(plan) {
    const { Contacts } = clients();
    const q = trim(plan.params.contactName || plan.params.query, 120);
    if (!Contacts?.searchContacts) return { ok: false, error: "contacts_client_missing" };
    recordApi(plan, "people.searchContacts");
    const result = await Contacts.searchContacts(q || plan.userText.slice(0, 40));
    if (!result.ok) return result;
    const contacts = result.data?.contacts || [];
    const primary = contacts[0] || null;
    return {
      ok: true,
      summary: `Contacts ${contacts.length} 件`,
      contextPatch: { contacts, contact: primary, contactEmail: primary?.emails?.[0] || "" },
    };
  }

  async function runGmailSearch(plan) {
    const { Gmail } = clients();
    if (!Gmail?.listMessages) return { ok: false, error: "gmail_client_missing" };
    recordApi(plan, "messages.list");
    const email = trim(plan.context.contactEmail, 200);
    const keyword = trim(plan.params.keyword || plan.params.query, 200);
    const q = email ? `from:${email} OR to:${email}` : keyword || undefined;
    const result = await Gmail.listMessages({ q, maxResults: 10 });
    if (!result.ok) return result;
    const messages = result.data?.messages || [];
    return {
      ok: true,
      summary: `Gmail ${messages.length} 件`,
      contextPatch: { messages, message: messages[0] || null },
    };
  }

  async function runProposeReply(plan) {
    const { Gmail } = clients();
    const message = plan.context.message;
    if (!message) return { ok: false, error: "message_not_found" };
    if (!Gmail?.proposeReply) return { ok: false, error: "gmail_client_missing" };
    recordApi(plan, "deepseek.reply_draft");
    const proposed = await Gmail.proposeReply(message);
    if (!proposed.ok) return proposed;
    return {
      ok: true,
      summary: "返信案を生成しました",
      contextPatch: {
        replyPlan: proposed.plan,
        replyBody: proposed.body,
      },
    };
  }

  async function runEnqueueGmailDraft(plan) {
    const { Gmail } = clients();
    const planFields = plan.context.replyPlan || {};
    const body = plan.context.replyBody || "";
    if (!Gmail?.enqueueDraftHumanGate) return { ok: false, error: "human_gate_missing" };
    const queued = Gmail.enqueueDraftHumanGate({
      messageId: plan.context.message?.id,
      threadId: planFields.threadId,
      replyToMessageId: planFields.replyToMessageId,
      to: planFields.to || plan.context.contactEmail,
      subject: planFields.subject,
      body,
    });
    if (!queued.ok || !queued.item?.id) return { ok: false, error: queued.error || "enqueue_failed" };
    return {
      ok: true,
      awaitHumanGate: true,
      pendingId: queued.item.id,
      summary: "Human Gate 承認待ち（Gmail 下書き）",
      contextPatch: { humanGateSource: "gmail", pendingId: queued.item.id },
    };
  }

  async function runCalendarCheck(plan) {
    const { Calendar } = clients();
    if (!Calendar?.listEvents) return { ok: false, error: "calendar_client_missing" };
    recordApi(plan, "events.list");
    const result = await Calendar.listEvents({ preset: "tomorrow", maxResults: 15 });
    if (!result.ok) return result;
    const events = result.data?.events || [];
    return {
      ok: true,
      summary: `明日の予定 ${events.length} 件`,
      contextPatch: { calendarEvents: events },
    };
  }

  async function runEnqueueCalendar(plan) {
    const { Calendar } = clients();
    if (!Calendar?.parseEventIntent || !Calendar?.enqueueCalendarHumanGate) {
      return { ok: false, error: "calendar_client_missing" };
    }
    recordApi(plan, "deepseek.event_intent");
    const parsed = await Calendar.parseEventIntent(plan.userText, {
      title: plan.params.contactName ? `${plan.params.contactName}さん 打ち合わせ` : undefined,
      attendees: plan.context.contactEmail ? [plan.context.contactEmail] : [],
    });
    if (!parsed.ok || !parsed.fields) return { ok: false, error: "intent_parse_failed" };
    const fields = {
      calendarId: "primary",
      title: parsed.fields.title,
      start: parsed.fields.start,
      end: parsed.fields.end,
      allDay: parsed.fields.allDay,
      location: parsed.fields.location,
      description: parsed.fields.description,
      attendees: parsed.fields.attendees?.length
        ? parsed.fields.attendees
        : plan.context.contactEmail
          ? [plan.context.contactEmail]
          : [],
    };
    const queued = Calendar.enqueueCalendarHumanGate("create", fields);
    if (!queued.ok || !queued.item?.id) return { ok: false, error: queued.error || "enqueue_failed" };
    return {
      ok: true,
      awaitHumanGate: true,
      pendingId: queued.item.id,
      summary: "Human Gate 承認待ち（Calendar 作成）",
      contextPatch: { humanGateSource: "calendar", calendarFields: fields, pendingId: queued.item.id },
    };
  }

  async function runDriveSearch(plan) {
    const { Drive } = clients();
    if (!Drive?.listFiles) return { ok: false, error: "drive_client_missing" };
    recordApi(plan, "files.list");
    const keyword = trim(plan.params.keyword || plan.params.query, 200);
    const result = await Drive.listFiles({ q: keyword, preset: keyword ? undefined : "recent", maxResults: 10 });
    if (!result.ok) return result;
    const files = result.data?.files || [];
    return {
      ok: true,
      summary: `Drive ${files.length} 件`,
      contextPatch: { files },
    };
  }

  async function runSummarize(plan) {
    const { Adapter } = clients();
    const messages = plan.context.messages || [];
    const files = plan.context.files || [];
    const payload =
      `Gmail: ${messages.map((m) => m.subject).join(" / ") || "なし"}\n` +
      `Drive: ${files.map((f) => f.name).join(" / ") || "なし"}`;

    if (!Adapter?.completeTurn) {
      return {
        ok: true,
        summary: "要約（mock）",
        contextPatch: { summaryText: `メール ${messages.length} 件 · ファイル ${files.length} 件`, mock: true },
      };
    }

    recordApi(plan, "deepseek.summary");
    const turn = await Adapter.completeTurn({
      userText: `以下の検索結果を運営者向けに3行で要約してください:\n${payload}`,
      systemPrompt: "要約のみ。Google APIは実行しない。",
      modeId: "ops_secretary",
      mockFallback: () => `メール ${messages.length} 件 · ファイル ${files.length} 件が見つかりました。`,
    });

    return {
      ok: true,
      summary: "要約を生成しました",
      contextPatch: { summaryText: trim(turn.reply, 4000), mock: !!turn.fallback_used },
    };
  }

  async function executeStep(plan, st) {
    const action = st.action;
    if (action === "searchContacts") return runContactsSearch(plan);
    if (action === "listMessages") return runGmailSearch(plan);
    if (action === "proposeReply") return runProposeReply(plan);
    if (action === "enqueueDraft") return runEnqueueGmailDraft(plan);
    if (action === "listEvents") return runCalendarCheck(plan);
    if (action === "enqueueCalendar") return runEnqueueCalendar(plan);
    if (action === "listFiles") return runDriveSearch(plan);
    if (action === "summarizeResults") return runSummarize(plan);
    if (action === "executeDraft" || action === "executeCalendar") {
      return { ok: true, summary: "Human Gate 承認後に実行", skipped: true };
    }
    return { ok: false, error: "unknown_step" };
  }

  function sanitizeRun(plan) {
    const clone = JSON.parse(JSON.stringify(plan || {}));
    const walk = (obj) => {
      if (!obj || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(walk);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/access_token|refresh_token|client_secret|code_verifier/i.test(k)) continue;
        out[k] = walk(v);
      }
      return out;
    };
    return walk(clone);
  }

  function saveRun(plan) {
    try {
      global.sessionStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify(sanitizeRun(plan)));
    } catch {
      /* ignore */
    }
    if (typeof CustomEvent !== "undefined") {
      global.dispatchEvent?.(new CustomEvent("tasu:google-workspace-orchestrator-updated", { detail: { id: plan.id } }));
    }
  }

  function loadLastRun() {
    try {
      const raw = global.sessionStorage?.getItem(LOG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function runWorkspaceRequest(userText) {
    const conn = await ensureConnected();
    if (!conn.ok) {
      return { ok: false, error: conn.error, plan: null };
    }

    const intentResult = await parseIntent(userText);
    if (!intentResult.ok) return { ok: false, error: intentResult.error, plan: null };

    const plan = buildPlan(intentResult, userText);
    plan.status = "running";
    saveRun(plan);

    for (const st of plan.steps) {
      if (st.kind === "write") {
        st.status = "pending";
        continue;
      }
      st.status = "running";
      const result = await executeStep(plan, st);
      if (result.contextPatch) {
        plan.context = { ...plan.context, ...result.contextPatch };
      }
      if (result.awaitHumanGate) {
        st.status = "blocked";
        plan.status = "awaiting_gate";
        plan.humanGatePendingId = result.pendingId || plan.context.pendingId || "";
        pushLog(plan, { stepId: st.id, label: st.label, ok: true, humanGate: true, summary: result.summary });
        saveRun(plan);
        return { ok: true, plan, awaitingHumanGate: true };
      }
      if (!result.ok) {
        st.status = "error";
        plan.status = "error";
        plan.error = result.error || "step_failed";
        pushLog(plan, { stepId: st.id, label: st.label, ok: false, error: plan.error });
        saveRun(plan);
        return { ok: false, error: plan.error, plan };
      }
      st.status = result.skipped ? "pending" : "done";
      pushLog(plan, { stepId: st.id, label: st.label, ok: true, summary: result.summary });
      saveRun(plan);
    }

    if (plan.status !== "awaiting_gate") {
      plan.status = "done";
      saveRun(plan);
    }
    return { ok: true, plan };
  }

  async function approveHumanGate(plan) {
    plan = plan || loadLastRun();
    if (!plan?.humanGatePendingId) return { ok: false, error: "no_pending_gate" };

    const { Gmail, Calendar } = clients();
    let exec;
    if (plan.context.humanGateSource === "calendar" || plan.intent === INTENTS.calendar_create) {
      exec = await Calendar?.approvePending?.(plan.humanGatePendingId);
    } else {
      exec = await Gmail?.approveDraftPending?.(plan.humanGatePendingId);
    }

    const gateStep = plan.steps.find((s) => s.kind === "human_gate");
    const writeStep = plan.steps.find((s) => s.kind === "write");
    if (gateStep) gateStep.status = exec?.ok ? "done" : "error";
    if (writeStep) writeStep.status = exec?.ok ? "done" : "error";

    pushLog(plan, {
      stepId: writeStep?.id || "write",
      label: "Human Gate 承認実行",
      ok: !!exec?.ok,
      humanGate: true,
      summary: exec?.message || exec?.error || (exec?.ok ? "実行完了" : "実行失敗"),
    });

    plan.status = exec?.ok ? "done" : "error";
    plan.error = exec?.ok ? "" : String(exec?.error || "gate_execute_failed");
    plan.humanGatePendingId = "";
    saveRun(plan);
    return { ok: !!exec?.ok, plan, exec };
  }

  async function recoverFromOAuthError(plan) {
    const { OAuth } = clients();
    if (!OAuth?.fetchStatus) return { ok: false, error: "oauth_client_missing" };
    const status = await OAuth.fetchStatus();
    if (status.connected || status.mock) {
      return runWorkspaceRequest(plan?.userText || "");
    }
    return { ok: false, error: "not_connected", plan };
  }

  global.TasuSecretaryGoogleOrchestrator = {
    INTENTS,
    parseIntent,
    buildPlan,
    runWorkspaceRequest,
    approveHumanGate,
    loadLastRun,
    sanitizeRun,
    ensureConnected,
    recoverFromOAuthError,
  };
})(typeof window !== "undefined" ? window : globalThis);
