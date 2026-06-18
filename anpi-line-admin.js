/**
 * LINE安否通知 — 管理者向けモード表示・設定カード・運用画面
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDt(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso));
    } catch {
      return String(iso);
    }
  }

  function isAdmin() {
    return global.TasuAnpiLineHealthcheck?.isAnpiLineAdmin?.() === true;
  }

  function getModeLabel() {
    const mode = global.TasuAnpiNotifications?.getLineSendMode?.() || "mock";
    return mode === "production" ? "本番モード" : "モックモード";
  }

  function getModeClass() {
    const mode = global.TasuAnpiNotifications?.getLineSendMode?.() || "mock";
    return mode === "production" ? "production" : "mock";
  }

  function formatStorageSourceLabel(storage) {
    const src = String(storage?.source || "none");
    if (src === "restored") return "Supabase（復元）";
    if (src === "supabase") return "Supabase";
    if (src === "localStorage") return "localStorage";
    return "なし";
  }

  function getHolderOptions() {
    const ctx = global.TasuAnpiUserContext?.getAnpiUserContext?.() || {};
    const holderId = String(ctx.contract_holder_id || "").trim();
    const memberId = String(ctx.member_id || "").trim();
    const opts = {};
    if (holderId) opts.contractHolderId = holderId;
    if (memberId) opts.memberId = memberId;
    return opts;
  }

  function formatPrimaryContextLabel(ctx) {
    if (!ctx) return "—";
    const meta = ctx.metadata && typeof ctx.metadata === "object" ? ctx.metadata : {};
    if (meta.primary === true || ctx.primary === true) return "primary（metadata）";
    if (String(ctx.account_scope || "") === "self") return "primary（account_scope=self）";
    return "非 primary";
  }

  function renderProductionReadinessHtml(readiness) {
    const r = readiness || {};
    const last = r.last_unauthorized;
    return (
      `<section class="anpi-line-admin-page__prod-ready" aria-label="Supabase Production Readiness">` +
      `<h2>Supabase Production Readiness</h2>` +
      `<p class="anpi-line-admin-page__prod-lead">` +
      `<a href="${esc(r.production_checklist_link || "docs/anpi-supabase-production-checklist.md")}">本番移行チェックリスト</a>を参照してください。` +
      `</p>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>RLS mode</dt><dd>${esc(r.rls_enabled || "—")}</dd>` +
      `<dt>dev policy (DB)</dt><dd>${esc(r.dev_policy_detected || "—")} <span class="anpi-line-admin__warn">${esc(r.dev_policy_note || "")}</span></dd>` +
      `<dt>current member_id</dt><dd><code>${esc(r.current_member_id || "—")}</code></dd>` +
      `<dt>authenticated</dt><dd>${esc(r.authenticated_label || (r.authenticated ? "はい" : "いいえ"))}</dd>` +
      `<dt>admin UI flag</dt><dd>${r.admin_ui_flag ? "はい（UIのみ）" : "いいえ"}</dd>` +
      `<dt>admin DB role</dt><dd>${esc(r.admin_db_role || "—")} <span class="anpi-line-admin__warn">${esc(r.admin_db_role_note || "")}</span></dd>` +
      `<dt>context save mode</dt><dd><code>${esc(r.context_save_mode || "—")}</code></dd>` +
      `<dt>logs save mode</dt><dd><code>${esc(r.logs_save_mode || "—")}</code></dd>` +
      `<dt>DB sync</dt><dd>${r.supabase_sync_paused ? esc(r.supabase_sync_paused_message || "停止") : "有効"}</dd>` +
      `<dt>last unauthorized</dt><dd>${last ? esc(`${last.scope} @ ${formatDt(last.at)}`) : "—"}</dd>` +
      `<dt>mock RLS enforce</dt><dd>${r.mock_enforced ? "on" : "off"}</dd>` +
      `</dl>` +
      `</section>`
    );
  }

  function renderRlsAccessHtml(rlsState, rlsStats) {
    const s = rlsState || {};
    const st = rlsStats || {};
    return (
      `<section class="anpi-line-admin-page__rls" aria-label="RLS アクセス">` +
      `<h2>RLS / 権限制御</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>アクセス範囲</dt><dd>${esc(st.scope === "admin" ? "管理者（全件）" : "会員（自分の行のみ）")}</dd>` +
      `<dt>member_id</dt><dd><code>${esc(s.member_id || "—")}</code></dd>` +
      `<dt>管理者</dt><dd>${s.admin ? "はい" : "いいえ"}</dd>` +
      `<dt>LINE運用管理者</dt><dd>${s.line_admin ? "はい" : "いいえ"}</dd>` +
      `<dt>mock RLS</dt><dd>${s.mock_enforced ? "enforce" : "off"}</dd>` +
      `<dt>参照可能 context</dt><dd>${esc(String(st.context_count ?? "—"))}</dd>` +
      `<dt>参照可能 logs</dt><dd>${esc(String(st.logs_count ?? "—"))}</dd>` +
      `</dl>` +
      `</section>`
    );
  }

  function renderIdentityLinkingHtml(ctx, logsFilter) {
    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(ctx) || ctx || {};
    return (
      `<section class="anpi-line-admin-page__identity" aria-label="Identity Linking">` +
      `<h2>Identity Linking</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>member_id</dt><dd><code>${esc(identity.member_id || "—")}</code></dd>` +
      `<dt>contract_holder_id</dt><dd><code>${esc(identity.contract_holder_id || "—")}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(identity.anpi_user_id || identity.user_id || "—")}</code></dd>` +
      `<dt>user_id（後方互換）</dt><dd><code>${esc(identity.user_id || "—")}</code></dd>` +
      `<dt>relationship</dt><dd>${esc(identity.relationship || "—")}</dd>` +
      `<dt>account_scope</dt><dd>${esc(identity.account_scope || "—")}</dd>` +
      `<dt>primary 判定</dt><dd>${esc(formatPrimaryContextLabel(identity))}</dd>` +
      `</dl>` +
      `<h3>Notification Logs identity filter</h3>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>contract_holder_id</dt><dd><code>${esc(logsFilter.contractHolderId || "—")}</code></dd>` +
      `<dt>member_id</dt><dd><code>${esc(logsFilter.memberId || "—")}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(logsFilter.anpiUserId || logsFilter.userId || "—")}</code></dd>` +
      `</dl>` +
      `</section>`
    );
  }

  function hcItemStatus(hc, id) {
    const item = hc?.items?.find((i) => i.id === id);
    if (!item) return "未確認";
    if (item.status === "ok") return "OK";
    if (item.status === "error") return "エラー";
    return "要確認";
  }

  function renderModeBadgeHtml() {
    if (!isAdmin()) return "";
    const label = getModeLabel();
    const mod = getModeClass();
    return (
      `<p class="anpi-line-mode-badge anpi-line-mode-badge--${mod}" data-anpi-line-mode-badge>` +
      `<span class="anpi-line-mode-badge__label">LINE送信モード</span> ` +
      `<strong>${esc(label)}</strong>` +
      `</p>`
    );
  }

  function renderHealthcheckListHtml(items, { compact = false } = {}) {
    if (!items?.length) {
      return `<p class="anpi-line-admin__empty">チェック結果がありません</p>`;
    }
    const cls = compact ? "anpi-line-admin__checks anpi-line-admin__checks--compact" : "anpi-line-admin__checks";
    return (
      `<ul class="${cls}" data-anpi-line-hc-list>` +
      items
        .map(
          (item) =>
            `<li class="anpi-line-admin__check anpi-line-admin__check--${esc(item.status)}" data-hc-id="${esc(item.id)}">` +
            `<span class="anpi-line-admin__check-label">${esc(item.label)}</span>` +
            `<span class="anpi-line-admin__check-status">${esc(item.status)}</span>` +
            `<span class="anpi-line-admin__check-msg">${esc(item.detail || item.message || "")}</span>` +
            (item.recommendation
              ? `<p class="anpi-line-admin__check-rec">${esc(item.recommendation)}</p>`
              : "") +
            `</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function renderLogListHtml(logs, { emptyLabel = "なし" } = {}) {
    if (!logs?.length) {
      return `<p class="anpi-line-admin__empty">${esc(emptyLabel)}</p>`;
    }
    return (
      `<ul class="anpi-line-admin__log-list">` +
      logs
        .map(
          (log) =>
            `<li class="anpi-line-admin__log-item">` +
            `<span class="anpi-line-admin__log-title">${esc(log.title || log.event_type)}</span>` +
            `<span class="anpi-line-admin__log-meta">${esc(formatDt(log.line_sent_at || log.created_at))}</span>` +
            `<span class="anpi-line-admin__log-status anpi-line-admin__log-status--${esc(log.line_status || "pending")}">${esc(log.line_status || "pending")}</span>` +
            (log.line_error_message
              ? `<span class="anpi-line-admin__log-err">${esc(log.line_error_message)}</span>`
              : "") +
            `</li>`
        )
        .join("") +
      `</ul>`
    );
  }

  function renderAdminCardHtml(state) {
    if (!isAdmin()) return "";
    const s = state || {};
    const hc = s.healthcheck || { items: [], summary: { ok: 0, warning: 0, error: 0 } };
    const sum = hc.summary || { ok: 0, warning: 0, error: 0 };
    const stats = s.stats || {};

    return (
      `<section class="anpi-line-admin" data-anpi-line-admin-card aria-label="LINE設定状態（管理者）">` +
      `<h2 class="anpi-line-admin__title">LINE設定状態</h2>` +
      `<p class="anpi-line-admin__link"><a href="anpi-line-admin.html">LINE運用画面を開く</a></p>` +
      `<dl class="anpi-line-admin__dl">` +
      `<dt>送信モード</dt><dd>${esc(getModeLabel())}</dd>` +
      `<dt>LINE Login</dt><dd>${esc(s.line_login_state || "—")}</dd>` +
      `<dt>Messaging API</dt><dd>${esc(s.messaging_api_state || "—")}</dd>` +
      `<dt>Token Exchange</dt><dd>${esc(s.token_exchange_state || "—")}</dd>` +
      `<dt>Push API</dt><dd>${esc(s.push_api_state || "—")}</dd>` +
      `<dt>連携ユーザー</dt><dd>${esc(String(stats.linked_user_count ?? 0))} 件</dd>` +
      `<dt>送信済み</dt><dd>${esc(String(stats.sent_count ?? 0))} 件</dd>` +
      `<dt>送信失敗</dt><dd>${esc(String(stats.failed_count ?? 0))} 件</dd>` +
      `<dt>最終成功</dt><dd>${esc(formatDt(stats.last_success_at))}</dd>` +
      `<dt>最終失敗</dt><dd>${esc(formatDt(stats.last_failure_at))}</dd>` +
      `<dt>Anpi Context</dt><dd>${esc(s.context_storage?.source || "none")}</dd>` +
      `<dt>Storage Source</dt><dd>${esc(formatStorageSourceLabel(s.context_storage))}</dd>` +
      `<dt>Restored</dt><dd>${s.context_storage?.restored ? "はい" : "いいえ"}</dd>` +
      `<dt>member_id</dt><dd><code>${esc(s.identity?.member_id || "—")}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(s.identity?.anpi_user_id || "—")}</code></dd>` +
      `<dt>relationship</dt><dd>${esc(s.identity?.relationship || "—")}</dd>` +
      `<dt>RLS scope</dt><dd>${esc(s.rls_stats?.scope === "admin" ? "全件" : "会員")}</dd>` +
      `<dt>context save</dt><dd><code>${esc(s.production_readiness?.context_save_mode || "—")}</code></dd>` +
      `<dt>Notification Logs Storage</dt><dd>${esc(s.logs_storage?.last_sync_status || "idle")}</dd>` +
      `<dt>localStorage count</dt><dd>${esc(String(s.logs_storage?.local_count ?? 0))}</dd>` +
      `<dt>Supabase count</dt><dd>${esc(String(s.logs_storage?.supabase_count ?? 0))}</dd>` +
      `<dt>Merged count</dt><dd>${esc(String(s.logs_storage?.merged_count ?? 0))}</dd>` +
      `<dt>Logs restored</dt><dd>${s.logs_storage?.restored ? "はい" : "いいえ"}</dd>` +
      `</dl>` +
      `<p class="anpi-line-admin__hc-summary">Healthcheck: OK ${sum.ok} / 注意 ${sum.warning} / エラー ${sum.error}</p>` +
      renderHealthcheckListHtml(hc.items, { compact: true }) +
      `</section>`
    );
  }

  function renderAdminPageHtml(state) {
    if (!isAdmin()) {
      return (
        `<section class="anpi-line-admin-page__denied" data-anpi-line-admin-denied>` +
        `<h1>アクセスできません</h1>` +
        `<p>この画面は管理者のみ利用できます。</p>` +
        `<p><code>localStorage.setItem('tasu_anpi_line_admin_v1','1')</code> または <code>?anpi_admin=1</code></p>` +
        `<p><a href="dashboard.html">ダッシュボードへ戻る</a></p>` +
        `</section>`
      );
    }

    const s = state || {};
    const hc = s.healthcheck || { items: [], summary: { ok: 0, warning: 0, error: 0 } };
    const sum = hc.summary || { ok: 0, warning: 0, error: 0 };
    const stats = s.stats || {};
    const testResult = s.test_push_result || null;

    let testFeedback = "";
    if (testResult) {
      const mod = testResult.ok ? "success" : "error";
      testFeedback =
        `<p class="anpi-line-admin-page__test-result anpi-line-admin-page__test-result--${mod}" data-anpi-line-test-result role="status">` +
        esc(testResult.ok ? "テストPush送信に成功しました。" : `送信失敗: ${testResult.error_message || ""}`) +
        (testResult.error_code ? `（${esc(testResult.error_code)}）` : "") +
        `</p>`;
    }

    return (
      `<div class="anpi-line-admin-page__inner" data-anpi-line-admin-page>` +
      `<header class="anpi-line-admin-page__header">` +
      `<h1 class="anpi-line-admin-page__title">LINE運用（管理者）</h1>` +
      renderModeBadgeHtml() +
      `<nav class="anpi-line-admin-page__nav" aria-label="関連画面">` +
      `<a href="dashboard.html">ダッシュボード</a>` +
      `<a href="anpi-dashboard.html">安否ダッシュボード</a>` +
      `<a href="anpi-notifications.html">安否通知センター</a>` +
      `<a href="anpi-register.html">安否サービス登録</a>` +
      `</nav>` +
      `</header>` +
      `<section class="anpi-line-admin-page__stats" aria-label="送信統計">` +
      `<h2>Push送信統計</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>LINE Login</dt><dd>${esc(s.line_login_state || "—")}</dd>` +
      `<dt>Messaging API</dt><dd>${esc(s.messaging_api_state || "—")}</dd>` +
      `<dt>Token Exchange</dt><dd>${esc(s.token_exchange_state || "—")}</dd>` +
      `<dt>Push API</dt><dd>${esc(s.push_api_state || "—")}</dd>` +
      `<dt>連携ユーザー数</dt><dd>${esc(String(stats.linked_user_count ?? 0))}</dd>` +
      `<dt>送信済み件数</dt><dd>${esc(String(stats.sent_count ?? 0))}</dd>` +
      `<dt>送信失敗件数</dt><dd>${esc(String(stats.failed_count ?? 0))}</dd>` +
      `<dt>最終成功送信</dt><dd>${esc(formatDt(stats.last_success_at))}</dd>` +
      `<dt>最終失敗送信</dt><dd>${esc(formatDt(stats.last_failure_at))}</dd>` +
      `<dt>Anpi Context</dt><dd>${esc(s.context_storage?.source || "none")}</dd>` +
      `<dt>Storage Source</dt><dd>${esc(formatStorageSourceLabel(s.context_storage))}</dd>` +
      `<dt>Restored</dt><dd>${s.context_storage?.restored ? "はい" : "いいえ"}</dd>` +
      `</dl>` +
      `</section>` +
      renderIdentityLinkingHtml(s.identity_context, s.logs_identity_filter) +
      renderRlsAccessHtml(s.rls_state, s.rls_stats) +
      renderProductionReadinessHtml(s.production_readiness) +
      `<section class="anpi-line-admin-page__logs-storage" aria-label="通知ログストレージ">` +
      `<h2>Notification Logs Storage</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>Last sync status</dt><dd>${esc(s.logs_storage?.last_sync_status || "idle")}</dd>` +
      `<dt>localStorage count</dt><dd>${esc(String(s.logs_storage?.local_count ?? 0))}</dd>` +
      `<dt>Supabase count</dt><dd>${esc(String(s.logs_storage?.supabase_count ?? 0))}</dd>` +
      `<dt>Merged count</dt><dd>${esc(String(s.logs_storage?.merged_count ?? 0))}</dd>` +
      `<dt>Last restored at</dt><dd>${esc(formatDt(s.logs_storage?.last_restored_at))}</dd>` +
      `<dt>Logs restored</dt><dd>${s.logs_storage?.restored ? "はい" : "いいえ"}</dd>` +
      `</dl>` +
      `</section>` +
      `<section class="anpi-line-admin-page__test" aria-label="テストPush">` +
      `<h2>テストPush送信</h2>` +
      `<p class="anpi-line-admin-page__test-lead">現在連携中のLINEアカウントへ固定文を送信します（管理者のみ）。</p>` +
      `<pre class="anpi-line-admin-page__test-msg">TASFUL安否サービス\nLINE通知テストです。</pre>` +
      `<button type="button" class="anpi-line-admin-page__test-btn" data-anpi-line-test-push>テストPush送信</button>` +
      testFeedback +
      `</section>` +
      `<section class="anpi-line-admin-page__hc" aria-label="Healthcheck">` +
      `<h2>Healthcheck</h2>` +
      `<p class="anpi-line-admin__hc-summary">OK ${sum.ok} / 注意 ${sum.warning} / エラー ${sum.error}</p>` +
      renderHealthcheckListHtml(hc.items) +
      `</section>` +
      `<div class="anpi-line-admin-page__logs">` +
      `<section aria-label="最近の送信ログ">` +
      `<h2>最近の送信ログ</h2>` +
      renderLogListHtml(stats.recent_sent_logs, { emptyLabel: "送信済みログはありません" }) +
      `</section>` +
      `<section aria-label="最近の失敗ログ">` +
      `<h2>最近の失敗ログ</h2>` +
      renderLogListHtml(stats.recent_failed_logs, { emptyLabel: "失敗ログはありません" }) +
      `</section>` +
      `</div>` +
      `</div>`
    );
  }

  async function buildAdminState(options = {}) {
    const opts = { ...getHolderOptions(), ...options };
    const stats = global.TasuAnpiNotifications?.getLineAdminStats?.(opts) || {};
    const hc = (await global.TasuAnpiLineHealthcheck?.runAnpiLineHealthcheck?.()) || {
      items: [],
      summary: { ok: 0, warning: 0, error: 0 },
    };

    const loginOk =
      hcItemStatus(hc, "line_login_channel_id") === "OK" &&
      hcItemStatus(hc, "line_login_callback_url") !== "エラー";

    const ctxStorage = global.TasuAnpiUserContext?.getStorageInfo?.() || {
      source: "none",
      restored: false,
      supabase_configured: false,
    };

    const logsStorage = global.TasuAnpiNotifications?.getLogsStorageInfo?.() || {
      local_count: 0,
      supabase_count: 0,
      merged_count: 0,
      last_restored_at: "",
      last_sync_status: "idle",
      restored: false,
    };

    const identityContext =
      global.TasuAnpiUserContext?.getAnpiUserContext?.() ||
      global.TasuAnpiIdentity?.readIdentityHint?.() ||
      null;
    const identity = global.TasuAnpiIdentity?.normalizeAnpiIdentity?.(identityContext) || {};
    const logsIdentityFilter = {
      contractHolderId: opts.contractHolderId || identity.contract_holder_id || "",
      memberId: opts.memberId || identity.member_id || "",
      anpiUserId: identity.anpi_user_id || identity.user_id || "",
      userId: identity.anpi_user_id || identity.user_id || "",
    };

    const rlsState = global.TasuAnpiRls?.getRlsState?.() || {};
    const productionReadiness = global.TasuAnpiRls?.getProductionReadiness?.() || {};
    const adminRls = global.TasuAnpiRls?.isAnpiAdmin?.() === true;
    const rlsStats = {
      scope: adminRls ? "admin" : "member",
      context_count: null,
      logs_count: null,
    };

    if (adminRls) {
      const ctxApi = global.TasuAnpiUserContextSupabase;
      const logApi = global.TasuAnpiNotificationLogsSupabase;
      if (ctxApi?.isMockEnabled?.()) {
        rlsStats.context_count = global.__anpiContextSupabaseStore?.size ?? null;
        rlsStats.logs_count = global.__anpiNotificationLogsSupabaseStore?.size ?? null;
      } else if (ctxApi?.isAvailable?.()) {
        const mid = identity.member_id || rlsState.member_id || "";
        const contexts = mid
          ? await ctxApi.loadAnpiUserContextsByMemberId(mid)
          : [];
        rlsStats.context_count = contexts.length;
        const logs = logApi?.loadAnpiNotificationLogs
          ? await logApi.loadAnpiNotificationLogs({ limit: 200 })
          : [];
        rlsStats.logs_count = Array.isArray(logs) ? logs.length : null;
      }
    } else {
      const mid = identity.member_id || rlsState.member_id || "";
      if (mid && global.TasuAnpiUserContextSupabase?.loadAnpiUserContextsByMemberId) {
        const contexts = await global.TasuAnpiUserContextSupabase.loadAnpiUserContextsByMemberId(
          mid
        );
        rlsStats.context_count = contexts.length;
      }
      if (global.TasuAnpiNotificationLogsSupabase?.loadAnpiNotificationLogs) {
        const logs = await global.TasuAnpiNotificationLogsSupabase.loadAnpiNotificationLogs({
          ...logsIdentityFilter,
          limit: 200,
        });
        rlsStats.logs_count = Array.isArray(logs) ? logs.length : 0;
      }
    }

    return {
      stats,
      healthcheck: hc,
      context_storage: ctxStorage,
      logs_storage: logsStorage,
      identity,
      identity_context: identity,
      logs_identity_filter: logsIdentityFilter,
      rls_state: rlsState,
      rls_stats: rlsStats,
      production_readiness: productionReadiness,
      line_login_state: loginOk ? "構成済み" : "要設定",
      messaging_api_state: hcItemStatus(hc, "line_channel_access_token"),
      token_exchange_state: hcItemStatus(hc, "edge_anpi_line_token_exchange"),
      push_api_state: hcItemStatus(hc, "edge_anpi_line_send"),
      last_success_at: stats.last_success_at || "",
      last_failure_at: stats.last_failure_at || "",
      failed_count: stats.failed_count ?? 0,
      test_push_result: options.test_push_result || null,
    };
  }

  async function renderInto(hostSelector, badgeSelector) {
    const host = global.document?.querySelector(hostSelector);
    const badgeHost = badgeSelector ? global.document?.querySelector(badgeSelector) : null;

    if (!isAdmin()) {
      if (host) {
        host.innerHTML = "";
        host.hidden = true;
      }
      if (badgeHost) {
        badgeHost.innerHTML = "";
        badgeHost.hidden = true;
      }
      return;
    }

    const state = await buildAdminState();
    const cardHtml = renderAdminCardHtml(state);
    const badgeHtml = renderModeBadgeHtml();

    if (host) {
      if (cardHtml) {
        host.innerHTML = cardHtml;
        host.hidden = false;
      } else {
        host.innerHTML = "";
        host.hidden = true;
      }
    }

    if (badgeHost) {
      if (badgeHtml) {
        badgeHost.innerHTML = badgeHtml;
        badgeHost.hidden = false;
      } else {
        badgeHost.innerHTML = "";
        badgeHost.hidden = true;
      }
    }
  }

  async function renderAdminPage(hostSelector, options = {}) {
    const host = global.document?.querySelector(hostSelector);
    if (!host) return;
    const state = await buildAdminState(options);
    host.innerHTML = renderAdminPageHtml(state);
  }

  function bindRefresh(hostSelector, badgeSelector) {
    const refresh = () => void renderInto(hostSelector, badgeSelector);
    const events = [
      "tasu:anpi-notification-line-sent",
      "tasful:anpi-notification-line-sent",
      "tasu:anpi-line-send-failed",
      "tasful:anpi-line-send-failed",
      "tasu:anpi-line-send-retried",
      "tasful:anpi-line-send-retried",
      "tasful:anpi-notification-updated",
      "tasu:anpi-notification-updated",
      "tasu:anpi-line-oauth-unlinked",
      "tasful:anpi-line-oauth-unlinked",
    ];
    events.forEach((name) => {
      global.document?.addEventListener(name, refresh);
      global.addEventListener(name, refresh);
    });
    return refresh;
  }

  global.TasuAnpiLineAdmin = {
    isAdmin,
    renderModeBadgeHtml,
    renderHealthcheckListHtml,
    renderAdminCardHtml,
    renderAdminPageHtml,
    buildAdminState,
    renderInto,
    renderAdminPage,
    bindRefresh,
  };
})(typeof window !== "undefined" ? window : globalThis);
