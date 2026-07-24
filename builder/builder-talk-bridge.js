/**
 * Builder → TASFUL Talk — チャット基盤ブリッジ
 * Builder は threadId 保存・通知・Talk 遷移のみ。会話 UI は Talk 側。
 */
(function (global) {
  "use strict";

  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";
  const OWNER_ID = "demo-owner-001";

  const THREAD_TYPE_META = Object.freeze({
    ops_partner: {
      label: "運営チャット",
      threadKind: "calendar_request",
      builderFlow: "ops_partner",
      counterpartRole: "owner",
    },
    admin_partner: {
      label: "運営チャット",
      threadKind: "calendar_request",
      builderFlow: "ops_partner",
      counterpartRole: "owner",
    },
    partner_user: {
      label: "案件チャット",
      threadKind: "partner_user",
      builderFlow: "partner_user",
      counterpartRole: "user",
    },
    project_thread: {
      label: "案件チャット",
      threadKind: "project_thread",
      builderFlow: "partner_user",
      counterpartRole: "user",
    },
    user_user: {
      label: "案件チャット",
      threadKind: "user_user",
      builderFlow: "user_user",
      counterpartRole: "user",
    },
    vendor_user: {
      label: "案件チャット",
      threadKind: "vendor_user",
      builderFlow: "vendor_user",
      counterpartRole: "vendor",
    },
    vendor_contact: {
      label: "業者相談",
      threadKind: "vendor_contact",
      builderFlow: "vendor_user",
      counterpartRole: "vendor",
    },
    worker_contact: {
      label: "ワーカー相談",
      threadKind: "worker_contact",
      builderFlow: "partner_user",
      counterpartRole: "partner",
    },
    general_project: {
      label: "案件チャット",
      threadKind: "general_project",
      builderFlow: "partner_user",
      counterpartRole: "user",
    },
    system_notice: {
      label: "システム通知",
      threadKind: "system_notice",
      builderFlow: "ops_partner",
      counterpartRole: "owner",
    },
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function readMvpState() {
    try {
      const raw = global.localStorage?.getItem(MVP_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function threadTypeMeta(threadType, threadKind) {
    const tt = pickStr(threadType).toLowerCase();
    const base = THREAD_TYPE_META[tt] || THREAD_TYPE_META.ops_partner;
    const kind = pickStr(threadKind, base.threadKind);
    return { ...base, threadKind: kind, threadType: tt || "ops_partner" };
  }

  function partnerDisplayName(state, partnerId) {
    const pid = pickStr(partnerId);
    if (!pid) return "協力会社";
    const row = (state?.partners || []).find((p) => String(p.partner_id) === pid);
    return pickStr(row?.name, row?.company_name, pid);
  }

  function projectTitle(state, projectId, fallback) {
    const pid = pickStr(projectId);
    const project = (state?.projects || []).find((p) => String(p.project_id) === pid);
    return pickStr(project?.title, fallback, pid, "Builder案件");
  }

  function resolveGeneralUserId(state) {
    return pickStr(state?.context?.userId, "demo-builder-user");
  }

  function resolveGeneralUserName() {
    return "山田 太郎";
  }

  function resolveOpsPartnerIds(state, builderThread) {
    const tt = pickStr(builderThread?.thread_type, builderThread?.threadType).toLowerCase();
    const contactTargetId = pickStr(builderThread?.contact_target_id, builderThread?.contactTargetId);
    const contactName = pickStr(builderThread?.counterpart_name, builderThread?.contact_target_name);

    if (tt === "worker_contact") {
      const workerId = pickStr(contactTargetId, builderThread?.partner_id);
      return {
        ownerId: resolveGeneralUserId(state),
        partnerId: workerId || "worker-demo-001",
        ownerName: resolveGeneralUserName(),
        partnerName: contactName || "ワーカー",
      };
    }

    if (tt === "vendor_contact" || tt === "vendor_user") {
      const vendorId = pickStr(
        contactTargetId,
        builderThread?.partner_id,
        builderThread?.vendor_id,
        "demo-vendor-001"
      );
      return {
        ownerId: resolveGeneralUserId(state),
        partnerId: vendorId,
        ownerName: resolveGeneralUserName(),
        partnerName: contactName || partnerDisplayName(state, vendorId) || "業者",
      };
    }

    const partnerId = pickStr(
      builderThread?.partner_id,
      builderThread?.partnerId,
      (state?.projects || []).find((p) => String(p.project_id) === String(builderThread?.project_id))
        ?.calendar_assigned_partner_id,
      (state?.projects || []).find((p) => String(p.project_id) === String(builderThread?.project_id))
        ?.selected_partner_ids?.[0]
    );
    return {
      ownerId: pickStr(state?.owner_id, OWNER_ID),
      partnerId: partnerId || "demo-partner-001",
      ownerName: "TASFUL運営",
      partnerName: pickStr(contactName, partnerDisplayName(state, partnerId)),
    };
  }

  function builderMessageToTalk(msg, threadId) {
    const from = msg?.from || {};
    const senderId = pickStr(from.id, from.userId, "system");
    const senderName = pickStr(from.name, from.displayName, senderId);
    const ts = pickStr(msg?.ts, msg?.createdAt, new Date().toISOString());
    return {
      id: pickStr(msg?.msg_id, msg?.id, `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      chatId: threadId,
      roomId: threadId,
      senderId,
      senderName,
      text: String(msg?.text ?? ""),
      createdAt: ts,
      kind: pickStr(msg?.kind, "text"),
    };
  }

  function buildTalkThreadRow(state, builderThread) {
    const threadId = pickStr(builderThread?.thread_id, builderThread?.id);
    if (!threadId) return null;
    const tt = pickStr(builderThread?.thread_type, builderThread?.threadType, "ops_partner");
    const meta = threadTypeMeta(tt, builderThread?.thread_kind || builderThread?.threadKind);
    const projectId = pickStr(builderThread?.project_id, builderThread?.projectId);
    const title = pickStr(builderThread?.list_title, projectTitle(state, projectId, threadId));
    const messages = Array.isArray(builderThread?.messages) ? builderThread.messages : [];
    const lastMsg = messages.length ? messages[messages.length - 1] : null;
    const lastMessage = pickStr(lastMsg?.text, `${title} — Builder案件`);
    const updatedAt = pickStr(lastMsg?.ts, builderThread?.updated_at, new Date().toISOString());
    const ids = resolveOpsPartnerIds(state, builderThread);

    const row = {
      id: threadId,
      chatDomain: "builder",
      threadKind: meta.threadKind,
      builderThreadType: meta.threadType,
      builderFlow: meta.builderFlow,
      projectId,
      listingId: projectId,
      listingTitle: title,
      listing: { id: projectId, title, type: "builder" },
      partner: { displayName: tt === "ops_partner" ? ids.ownerName : ids.partnerName },
      partnerUserId: tt === "ops_partner" ? ids.ownerId : ids.partnerId,
      sellerId: ids.partnerId,
      sellerName: ids.partnerName,
      buyerId: ids.ownerId,
      buyerName: ids.ownerName,
      source: "builder-mvp",
      _talkChannel: "builder",
      lastMessage,
      updatedAt,
      createdAt: updatedAt,
      status: "active",
      roomStatus: "active",
    };

    if (tt === "ops_partner" || tt === "admin_partner") {
      row.partner = { displayName: ids.ownerName };
      row.partnerUserId = ids.ownerId;
      row.sellerId = ids.ownerId;
      row.sellerName = ids.ownerName;
      row.buyerId = ids.partnerId;
      row.buyerName = ids.partnerName;
    } else if (tt === "worker_contact" || tt === "vendor_contact" || tt === "project_thread") {
      row.partner = { displayName: ids.partnerName };
      row.partnerUserId = ids.partnerId;
      row.sellerId = ids.partnerId;
      row.sellerName = ids.partnerName;
      row.buyerId = ids.ownerId;
      row.buyerName = ids.ownerName;
      row.contactTargetId = pickStr(builderThread?.contact_target_id);
    }

    return row;
  }

  function findContactThreadInState(state, threadKind, targetId, projectId) {
    const kind = pickStr(threadKind);
    const tid = pickStr(targetId);
    if (!kind || !tid) return null;
    const pid = pickStr(projectId);
    return (
      Object.values(state?.threads || {}).find((t) => {
        if (String(t.thread_kind || t.thread_type || "") !== kind) return false;
        if (String(t.contact_target_id || t.partner_id || "") !== tid) return false;
        if (pid && String(t.project_id || "") !== pid) return false;
        return true;
      }) || null
    );
  }

  function syncMessagesToTalk(threadId, builderMessages) {
    const id = pickStr(threadId);
    if (!id || !Array.isArray(builderMessages) || !builderMessages.length) return;
    const mapKey = global.TasuChatThreadStore?.MESSAGES_KEY || "tasful_chat_messages";
    try {
      const raw = global.localStorage?.getItem(mapKey);
      const map = raw ? JSON.parse(raw) : {};
      const existing = Array.isArray(map[id]) ? map[id] : [];
      const existingKeys = new Set(existing.map((m) => `${m.senderId}|${m.text}|${m.createdAt}`));
      const merged = [...existing];
      builderMessages.forEach((msg) => {
        const talkMsg = builderMessageToTalk(msg, id);
        const key = `${talkMsg.senderId}|${talkMsg.text}|${talkMsg.createdAt}`;
        if (existingKeys.has(key)) return;
        merged.push(talkMsg);
        existingKeys.add(key);
      });
      if (merged.length !== existing.length) {
        map[id] = merged;
        global.localStorage?.setItem(mapKey, JSON.stringify(map));
      }
    } catch {
      /* ignore */
    }
  }

  function syncBuilderThreadToTalk(threadId, stateOpt) {
    const id = pickStr(threadId);
    if (!id) return { ok: false, reason: "missing_thread_id" };
    const state = stateOpt && typeof stateOpt === "object" ? stateOpt : readMvpState();
    const builderThread = state?.threads?.[id];
    if (!builderThread) return { ok: false, reason: "builder_thread_not_found" };

    const row = buildTalkThreadRow(state, { ...builderThread, thread_id: id });
    if (!row) return { ok: false, reason: "invalid_thread" };

    const store = global.TasuChatThreadStore;
    if (store?.readAll && store?.writeAll) {
      const list = store.readAll();
      const idx = list.findIndex((t) => String(t.id) === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...row, updatedAt: pickStr(row.updatedAt, list[idx].updatedAt) };
      } else {
        list.unshift(row);
      }
      store.writeAll(list);
    } else {
      try {
        const raw = global.localStorage?.getItem("tasful_chat_threads");
        const list = raw ? JSON.parse(raw) : [];
        const safe = Array.isArray(list) ? list : [];
        const idx = safe.findIndex((t) => String(t.id) === id);
        if (idx >= 0) {
          safe[idx] = { ...safe[idx], ...row, updatedAt: pickStr(row.updatedAt, safe[idx].updatedAt) };
        } else {
          safe.unshift(row);
        }
        global.localStorage?.setItem("tasful_chat_threads", JSON.stringify(safe));
      } catch {
        return { ok: false, reason: "talk_store_unavailable" };
      }
    }
    syncMessagesToTalk(id, builderThread.messages || []);
    try {
      global.dispatchEvent?.(new CustomEvent("tasful-chat-threads-changed"));
    } catch {
      /* ignore */
    }
    return { ok: true, threadId: id };
  }

  function chatDetailHref(input) {
    const threadId = pickStr(input?.threadId, input?.thread_id);
    if (!threadId) return listHref(input);
    const role = pickStr(input?.role, "partner");
    const tt = pickStr(input?.threadType, input?.thread_type, "ops_partner");
    const meta = threadTypeMeta(tt);
    const projectId = pickStr(input?.projectId, input?.project_id);
    const sp = new URLSearchParams();
    sp.set("thread", threadId);
    sp.set("from", "builder");
    sp.set("builderFlow", meta.builderFlow);
    if (role) sp.set("builderRole", role);
    if (projectId) sp.set("builderProjectId", projectId);
    return `../chat-detail.html?${sp.toString()}`;
  }

  function normalizeTalkHref(href) {
    const raw = String(href || "").trim();
    if (!raw) return "../talk-home.html?tab=chat&channel=builder";
    if (/^(\.\.\/)?chat-detail\.html/i.test(raw) || /^(\.\.\/)?talk-home\.html/i.test(raw)) return raw;
    if (/^chat-detail\.html/i.test(raw)) return `../${raw}`;
    if (/^talk-home\.html/i.test(raw)) return `../${raw}`;
    return raw;
  }

  function threadHref(input) {
    const threadId = pickStr(input?.threadId, input?.thread_id);
    if (!threadId) {
      const projectId = pickStr(input?.projectId, input?.project_id);
      if (projectId) return openProjectHref({ projectId, role: input?.role, threadType: input?.threadType });
      return listHref(input);
    }
    syncBuilderThreadToTalk(threadId, input?.state);
    return normalizeTalkHref(
      chatDetailHref({
        threadId,
        role: input?.role,
        threadType: input?.threadType,
        projectId: input?.projectId,
      })
    );
  }

  function listHref(input) {
    const role = pickStr(input?.role, "partner");
    const tt = pickStr(input?.threadType, input?.thread_type);
    const sp = new URLSearchParams();
    sp.set("tab", "chat");
    sp.set("channel", "builder");
    sp.set("from", "builder");
    if (role) sp.set("builderRole", role);
    if (tt) sp.set("builderFlow", tt);
    return `../talk-home.html?${sp.toString()}`;
  }

  function openProjectHref(input) {
    const sp = new URLSearchParams();
    const projectId = pickStr(input?.projectId, input?.project_id);
    if (projectId) sp.set("project_id", projectId);
    const role = pickStr(input?.role, "partner");
    if (role) sp.set("role", role);
    const tt = pickStr(input?.threadType, input?.thread_type, "ops_partner");
    if (tt) sp.set("threadType", tt);
    return `talk-thread-open.html?${sp.toString()}`;
  }

  function openContactHref(input) {
    const sp = new URLSearchParams();
    const kind = pickStr(input?.contactKind, input?.threadKind, input?.threadType);
    const targetId = pickStr(input?.targetId, input?.contactTargetId);
    const targetName = pickStr(input?.targetName, input?.contactTargetName);
    const projectId = pickStr(input?.projectId, input?.project_id);
    if (kind) sp.set("contact_kind", kind);
    if (targetId) sp.set("target_id", targetId);
    if (targetName) sp.set("target_name", targetName);
    if (projectId) sp.set("project_id", projectId);
    sp.set("role", pickStr(input?.role, "user"));
    return `talk-thread-open.html?${sp.toString()}`;
  }

  async function ensureAndRedirectFromLocation() {
    const sp = new URLSearchParams(global.location?.search || "");
    const contactKind = pickStr(sp.get("contact_kind"), sp.get("threadKind"));
    const targetId = pickStr(sp.get("target_id"), sp.get("contactTargetId"));
    const targetName = pickStr(sp.get("target_name"));
    const projectId = pickStr(sp.get("project_id"), sp.get("projectId"));
    const presetThread = pickStr(sp.get("thread_id"), sp.get("threadId"));
    const role = pickStr(sp.get("role"), "partner");
    const threadType = pickStr(sp.get("threadType"), sp.get("thread_type"), "ops_partner");

    if (contactKind && targetId && global.TasuBuilderBenchBridge?.openBuilderContactTalk) {
      const result = global.TasuBuilderBenchBridge.openBuilderContactTalk(
        {
          threadKind: contactKind,
          targetId,
          targetName,
          projectId,
          role,
          navigate: false,
        },
        false
      );
      if (result?.ok && result.href) {
        global.location.replace(result.href);
        return;
      }
    }

    if (presetThread) {
      syncBuilderThreadToTalk(presetThread);
      global.location.replace(
        threadHref({ threadId: presetThread, role, threadType, projectId })
      );
      return;
    }

    if (!projectId) {
      global.location.replace(listHref({ role, threadType }));
      return;
    }

    const bridge = global.TasuBuilderBenchBridge;
    if (bridge?.acceptCalendarAssignment && bridge?.getMvpState) {
      const state = bridge.getMvpState();
      const project = (state?.projects || []).find((p) => String(p.project_id) === projectId);
      let threadId = pickStr(project?.main_thread_id);
      if (!threadId) {
        const match = Object.values(state?.threads || {}).find(
          (t) =>
            String(t.project_id) === projectId && String(t.thread_kind || "") === "calendar_request"
        );
        threadId = pickStr(match?.thread_id);
      }
      if (!threadId && String(project?.assignment_status || "") === "accepted") {
        try {
          const result = await Promise.resolve(bridge.acceptCalendarAssignment(projectId));
          threadId = pickStr(result?.threadId, result?.thread_id);
        } catch {
          threadId = "";
        }
      }
      if (threadId) {
        syncBuilderThreadToTalk(threadId, bridge.getMvpState());
        global.location.replace(threadHref({ threadId, role, threadType, projectId }));
        return;
      }
    }

    global.location.replace(listHref({ role, threadType }));
  }

  global.TasuBuilderTalkBridge = {
    MVP_STORAGE_KEY,
    threadTypeMeta,
    findContactThreadInState,
    syncBuilderThreadToTalk,
    threadHref,
    listHref,
    openProjectHref,
    openContactHref,
    chatDetailHref,
    ensureAndRedirectFromLocation,
  };
})(typeof window !== "undefined" ? window : globalThis);
