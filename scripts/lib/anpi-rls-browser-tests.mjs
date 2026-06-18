/**
 * 安否 RLS アクセス制御 — ブラウザ E2E 共通ブロック（P9-4）
 *
 * @param {import('playwright').Page} page
 * @param {{ name: string }} vp
 * @param {(step: string, detail?: string) => void} pass
 * @param {(step: string, detail?: string) => void} fail
 */
export async function runAnpiRlsBrowserTests(page, vp, pass, fail) {
  const prefix = `${vp.name}: RLS`;

  await page.waitForFunction(
    () => Boolean(window.TasuAnpiRls?.canReadContextRow && window.TasuAnpiUserContextSupabase),
    { timeout: 15000 }
  );

  const seed = await page.evaluate(() => {
    window.__ANPI_CONTEXT_SUPABASE_MOCK__ = true;
    window.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__ = true;
    window.__ANPI_RLS_MOCK_ENFORCE__ = true;
    window.__anpiContextSupabaseStore = new Map();
    window.__anpiNotificationLogsSupabaseStore = new Map();
    window.TasuAnpiRls?.resetMockRlsContext?.();

    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};

    const baseRow = (userId, memberId, holderId) => {
      window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = memberId;
      const row = window.TasuAnpiUserContextSupabase.contextToRow({
        user_id: userId,
        is_anpi_user: true,
        user_name: `user_${userId}`,
        member_id: memberId,
        contract_holder_id: holderId,
        contract_holder_name: "契約者",
        contract_holder_relation: "本人",
        contract_holder_email: "a@example.com",
        contract_holder_phone_masked: "03-***-1111",
        user_phone_masked: "09-***-1111",
        notify_channels: ["tasful_chat"],
        notification_level: "call_only",
        contract_holder_contact_method: "tasful_chat",
        line_notification_enabled: false,
        consent: {
          no_auto_execution: true,
          self_confirm_required: true,
          tasful_no_guarantee: true,
          emergency_contact_required: true,
          agreed_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      row.member_id = memberId;
      row.anpi_user_id = userId;
      row.contract_holder_id = holderId;
      return row;
    };

    const selfRow = baseRow("anpi_rls_self", "member_a", "member_a");
    const familyRow = baseRow("anpi_rls_family", "member_a", "member_a");
    familyRow.relationship = "child";
    familyRow.account_scope = "family";
    const otherRow = baseRow("anpi_rls_other", "member_b", "member_b");

    window.__anpiContextSupabaseStore.set("anpi_rls_self", selfRow);
    window.__anpiContextSupabaseStore.set("anpi_rls_family", familyRow);
    window.__anpiContextSupabaseStore.set("anpi_rls_other", otherRow);

    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "member_a";
    const logSelf = window.TasuAnpiNotificationLogsSupabase.logToRow({
      id: "log_rls_self",
      event_type: "ai_search",
      title: "self",
      user_id: "anpi_rls_self",
      member_id: "member_a",
      contract_holder_id: "member_a",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    logSelf.member_id = "member_a";
    logSelf.contract_holder_id = "member_a";
    logSelf.anpi_user_id = "anpi_rls_self";
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "member_b";
    const logOther = window.TasuAnpiNotificationLogsSupabase.logToRow({
      id: "log_rls_other",
      event_type: "ai_search",
      title: "other",
      user_id: "anpi_rls_other",
      member_id: "member_b",
      contract_holder_id: "member_b",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    logOther.member_id = "member_b";
    logOther.contract_holder_id = "member_b";
    logOther.anpi_user_id = "anpi_rls_other";
    window.__anpiNotificationLogsSupabaseStore.set("log_rls_self", logSelf);
    window.__anpiNotificationLogsSupabaseStore.set("log_rls_other", logOther);

    return { ok: true };
  });

  if (!seed?.ok) {
    fail(`${prefix} seed`);
    return;
  }

  const selfRead = await page.evaluate(async () => {
    window.TasuAnpiRls.setMockRlsContext({ memberId: "member_a", admin: false });
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "member_a";
    const ctx = await window.TasuAnpiUserContextSupabase.loadAnpiUserContext("anpi_rls_self");
    const denied = await window.TasuAnpiUserContextSupabase.loadAnpiUserContext("anpi_rls_other");
    const list = await window.TasuAnpiUserContextSupabase.loadAnpiUserContextsByMemberId("member_a");
    return {
      self: Boolean(ctx?.user_id),
      other: denied,
      memberList: list.length,
    };
  });

  if (selfRead.self && !selfRead.other && selfRead.memberList >= 1) {
    pass(`${prefix} 本人・契約者は自分の行のみ`);
  } else {
    fail(`${prefix} 本人・契約者は自分の行のみ`, JSON.stringify(selfRead));
  }

  const holderLogs = await page.evaluate(async () => {
    window.TasuAnpiRls.setMockRlsContext({ memberId: "member_a", admin: false });
    const logs = await window.TasuAnpiNotificationLogsSupabase.loadAnpiNotificationLogs({
      contractHolderId: "member_a",
      limit: 20,
    });
    const otherLog = logs.find((l) => l.id === "log_rls_other");
    return { count: logs.length, hasOther: Boolean(otherLog) };
  });

  if (holderLogs.count >= 1 && !holderLogs.hasOther) {
    pass(`${prefix} 契約者は自分の通知ログのみ`);
  } else {
    fail(`${prefix} 契約者は自分の通知ログのみ`, JSON.stringify(holderLogs));
  }

  const otherDenied = await page.evaluate(async () => {
    window.TasuAnpiRls.setMockRlsContext({ memberId: "member_c", admin: false });
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "member_c";
    const ctx = await window.TasuAnpiUserContextSupabase.loadAnpiUserContext("anpi_rls_self");
    const upsert = await window.TasuAnpiUserContextSupabase.upsertAnpiUserContext({
      user_id: "anpi_rls_self",
      is_anpi_user: true,
      user_name: "hack",
      member_id: "member_c",
      contract_holder_id: "member_c",
      contract_holder_name: "x",
      contract_holder_relation: "本人",
      contract_holder_email: "x@example.com",
      contract_holder_phone_masked: "03-***-0000",
      user_phone_masked: "09-***-0000",
      notify_channels: ["tasful_chat"],
      notification_level: "call_only",
      contract_holder_contact_method: "tasful_chat",
      line_notification_enabled: false,
      consent: {
        no_auto_execution: true,
        self_confirm_required: true,
        tasful_no_guarantee: true,
        emergency_contact_required: true,
        agreed_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ctx, upsert };
  });

  if (
    !otherDenied.ctx &&
    (!otherDenied.upsert?.ok || otherDenied.upsert?.unauthorized || otherDenied.upsert?.error === "unauthorized")
  ) {
    pass(`${prefix} 他人は参照・更新不可`);
  } else {
    fail(`${prefix} 他人は参照・更新不可`, JSON.stringify(otherDenied));
  }

  const adminAll = await page.evaluate(async () => {
    window.TasuAnpiRls.setMockRlsContext({ memberId: "member_a", admin: true });
    localStorage.setItem("tasu_anpi_line_admin_v1", "1");
    const self = await window.TasuAnpiUserContextSupabase.loadAnpiUserContext("anpi_rls_self");
    const other = await window.TasuAnpiUserContextSupabase.loadAnpiUserContext("anpi_rls_other");
    const logs = await window.TasuAnpiNotificationLogsSupabase.loadAnpiNotificationLogs({ limit: 50 });
    return {
      self: Boolean(self),
      other: Boolean(other),
      logs: logs.length,
      admin: window.TasuAnpiRls.isAnpiAdmin(),
    };
  });

  if (adminAll.self && adminAll.other && adminAll.logs >= 2 && adminAll.admin) {
    pass(`${prefix} 管理者は全件参照`);
  } else {
    fail(`${prefix} 管理者は全件参照`, JSON.stringify(adminAll));
  }

  const uiErr = await page.evaluate(() => {
    window.TasuAnpiRls.setMockRlsContext({ memberId: "member_x", admin: false });
    window.TasuAnpiRls.notifyUnauthorized("test.ui", { reason: "e2e" });
    const el = document.querySelector("[data-anpi-rls-error]");
    return { shown: Boolean(el && !el.hidden) };
  });

  if (uiErr.shown) pass(`${prefix} unauthorized UI`);
  else fail(`${prefix} unauthorized UI`);
}
