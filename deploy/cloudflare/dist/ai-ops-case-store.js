/**
 * AI運営センター — 案件ストア（support連携 + localStorage）
 */
(function (global) {
  "use strict";

  const CASES_KEY = "tasu_ai_ops_cases_v1";
  const EVENTS_KEY = "tasu_ai_ops_events_v1";
  const EVENT_BUS = "tasu:ai-ops-cases-changed";

  function uid(p) {
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function readCases() {
    try {
      const raw = localStorage.getItem(CASES_KEY);
      const data = raw ? JSON.parse(raw) : [];
      const local = Array.isArray(data) ? data : [];
      const Read = global.TasuSupabaseOpsRead;
      if (Read?.mergeList) return Read.mergeList(local, "ai_ops_cases");
      return local;
    } catch {
      return [];
    }
  }

  function writeCases(list) {
    localStorage.setItem(CASES_KEY, JSON.stringify(list));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_BUS));
    } catch {
      /* ignore */
    }
  }

  function appendEvent(caseId, eventType, summary, payload) {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      const events = raw ? JSON.parse(raw) : [];
      const row = {
        id: uid("aevt"),
        case_id: caseId,
        event_type: eventType,
        payload_summary: summary,
        payload: payload || null,
        created_at: new Date().toISOString(),
      };
      events.unshift(row);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(0, 5000)));
      if (global.TasuSupabaseOpsWrite?.insertAiOpsEvent) {
        void global.TasuSupabaseOpsWrite.insertAiOpsEvent(row);
      }
      return row;
    } catch {
      return null;
    }
  }

  function syncFromSupportTickets() {
    const store = global.TasuSupportTicketStore;
    const provider = global.TasuAiOpsProvider;
    if (!store || !provider) return 0;

    const tickets = store.listTickets();
    const cases = readCases();
    const byTicket = new Set(cases.map((c) => c.support_ticket_id).filter(Boolean));
    let added = 0;

    tickets.forEach((t) => {
      if (byTicket.has(t.id)) return;
      const row = createCaseFromInput(
        {
          title: t.title,
          body: t.body,
          source: t.source || "support_ticket",
          support_ticket_id: t.id,
          support_category: t.category,
          severity: t.severity,
          status: t.status === "resolved" ? "resolved" : t.status === "needs_review" ? "needs_review" : "open",
          related_project_id: t.related_project_id,
          related_order_id: t.related_order_id,
          user_id: t.user_id,
        },
        false
      );
      if (row) added += 1;
    });

    return added;
  }

  function createCaseFromInput(input, notify = true) {
    const provider = global.TasuAiOpsProvider;
    const Types = global.TasuAiOpsTypes;
    const Notify = global.TasuAiOpsNotify;
    if (!provider) return null;

    const now = new Date().toISOString();
    const draft = {
      id: input.id || uid("aops"),
      support_ticket_id: input.support_ticket_id || null,
      source: input.source || "manual",
      title: String(input.title || "運営案件").slice(0, 200),
      body: String(input.body || "").trim(),
      support_category: input.support_category || "",
      severity: input.severity || "medium",
      status: input.status || "needs_review",
      ops_category: input.ops_category || "",
      related_project_id: input.related_project_id || null,
      related_order_id: input.related_order_id || null,
      user_id: input.user_id || "unknown",
      admin_note: "",
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };

    const forcedOpsCategory = input.ops_category || "";
    const ai = provider.analyzeCase(draft);
    Object.assign(draft, ai);
    if (forcedOpsCategory) draft.ops_category = forcedOpsCategory;
    if (!draft.ops_category) draft.ops_category = draft.ai_category;

    const list = readCases();
    const dup = input.support_ticket_id
      ? list.find((c) => c.support_ticket_id === input.support_ticket_id)
      : null;
    if (dup) return dup;

    list.unshift(draft);
    writeCases(list);
    appendEvent(draft.id, "case_created", `案件作成: ${draft.ops_category}`, { ai });
    if (global.TasuSupabaseOpsWrite?.insertAiOpsCase) {
      void global.TasuSupabaseOpsWrite.insertAiOpsCase(draft);
    }

    if (notify && Notify) Notify.notifyAdminAiOpsCase(draft);
    return draft;
  }

  function getCase(id) {
    return readCases().find((c) => c.id === id) || null;
  }

  function saveCase(row) {
    const list = readCases();
    const idx = list.findIndex((c) => c.id === row.id);
    const next = { ...row, updated_at: new Date().toISOString() };
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    writeCases(list);
    if (idx >= 0 && global.TasuSupabaseOpsWrite?.dualWriteCaseUpdate) {
      global.TasuSupabaseOpsWrite.dualWriteCaseUpdate(next);
    }
    return next;
  }

  function listCases(filter) {
    syncFromSupportTickets();
    const Types = global.TasuAiOpsTypes;
    let list = readCases();

    if (filter?.tab && Types) {
      list = list.filter((c) => Types.tabForCase(c) === filter.tab);
    }
    if (filter?.ops_category) {
      list = list.filter((c) => (c.ops_category || c.ai_category) === filter.ops_category);
    }
    if (filter?.ai_risk) {
      list = list.filter((c) => c.ai_risk === filter.ai_risk);
    }
    if (filter?.ai_risk_in) {
      list = list.filter((c) => filter.ai_risk_in.includes(c.ai_risk));
    }
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.status_in) {
      list = list.filter((c) => filter.status_in.includes(c.status));
    }
    if (filter?.q) {
      const q = String(filter.q).toLowerCase();
      list = list.filter((c) => `${c.title} ${c.body} ${c.ai_summary}`.toLowerCase().includes(q));
    }

    return list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  function applyAdminAction(caseId, action, note) {
    const c = getCase(caseId);
    if (!c) return null;

    const plans = {
      send_reply: { status: "in_progress", event: "reply_planned", summary: "返信送信（管理者確認済み・予定）" },
      needs_review: { status: "needs_review", event: "needs_review", summary: "要確認へ変更" },
      resolved: { status: "resolved", event: "resolved", summary: "解決済み", resolved: true },
      refund_candidate: { status: "needs_review", event: "refund_planned", summary: "返金候補（API未実行）" },
      listing_suspend_candidate: { status: "needs_review", event: "listing_suspend_planned", summary: "掲載停止候補（未実行）" },
      account_restrict_candidate: { status: "needs_review", event: "restrict_planned", summary: "アカウント制限候補（未実行）" },
      ban_candidate: { status: "needs_review", event: "ban_planned", summary: "BAN候補（未実行）" },
      connect_verified: { status: "in_progress", event: "connect_verified_planned", summary: "Connect確認済み（記録のみ）" },
    };

    const plan = plans[action];
    if (!plan) return null;

    c.status = plan.status;
    if (note) c.admin_note = String(note).trim();
    if (plan.resolved) c.resolved_at = new Date().toISOString();

    const saved = saveCase(c);
    appendEvent(caseId, plan.event, plan.summary, { action, note });

    if (c.support_ticket_id && global.TasuSupportTicketService?.applyAdminAction) {
      const map = {
        send_reply: "send_reply",
        resolved: "resolved",
        refund_candidate: "refund",
        connect_verified: "connect_verified",
        ban_candidate: "ban_candidate",
        account_restrict_candidate: "account_restrict",
      };
      const supportAction = map[action];
      if (supportAction) {
        global.TasuSupportTicketService.applyAdminAction(c.support_ticket_id, supportAction, note);
      }
    }

    const Notify = global.TasuAiOpsNotify;
    if (plan.resolved && Notify?.markRead) Notify.markRead(caseId);
    if (plan.resolved) {
      global.TasuAdminAiDailyInbox?.completeInboxItem?.(`inbox_aiops_${caseId}`);
    }

    return saved;
  }

  function clearAllForTests() {
    localStorage.removeItem(CASES_KEY);
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem("tasu_ai_ops_admin_notifications_v1");
  }

  global.TasuAiOpsCaseStore = {
    syncFromSupportTickets,
    createCaseFromInput,
    listCases,
    getCase,
    applyAdminAction,
    clearAllForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
