/**
 * LINE螳牙凄騾夂衍 窶・邂｡逅・・髄縺代Δ繝ｼ繝芽｡ｨ遉ｺ繝ｻ險ｭ螳壹き繝ｼ繝峨・驕狗畑逕ｻ髱｢
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
    if (!iso) return "窶・;
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
    return mode === "production" ? "譛ｬ逡ｪ繝｢繝ｼ繝・ : "繝｢繝・け繝｢繝ｼ繝・;
  }

  function getModeClass() {
    const mode = global.TasuAnpiNotifications?.getLineSendMode?.() || "mock";
    return mode === "production" ? "production" : "mock";
  }

  function formatStorageSourceLabel(storage) {
    const src = String(storage?.source || "none");
    if (src === "restored") return "Supabase・亥ｾｩ蜈・ｼ・;
    if (src === "supabase") return "Supabase";
    if (src === "localStorage") return "localStorage";
    return "縺ｪ縺・;
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
    if (!ctx) return "窶・;
    const meta = ctx.metadata && typeof ctx.metadata === "object" ? ctx.metadata : {};
    if (meta.primary === true || ctx.primary === true) return "primary・・etadata・・;
    if (String(ctx.account_scope || "") === "self") return "primary・・ccount_scope=self・・;
    return "髱・primary";
  }

  function renderProductionReadinessHtml(readiness) {
    const r = readiness || {};
    const last = r.last_unauthorized;
    return (
      `<section class="anpi-line-admin-page__prod-ready" aria-label="Supabase Production Readiness">` +
      `<h2>Supabase Production Readiness</h2>` +
      `<p class="anpi-line-admin-page__prod-lead">` +
      `<a href="${esc(r.production_checklist_link || "docs/anpi-supabase-production-checklist.md")}">譛ｬ逡ｪ遘ｻ陦後メ繧ｧ繝・け繝ｪ繧ｹ繝・/a>繧貞盾辣ｧ縺励※縺上□縺輔＞縲Ａ +
      `</p>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>RLS mode</dt><dd>${esc(r.rls_enabled || "窶・)}</dd>` +
      `<dt>dev policy (DB)</dt><dd>${esc(r.dev_policy_detected || "窶・)} <span class="anpi-line-admin__warn">${esc(r.dev_policy_note || "")}</span></dd>` +
      `<dt>current member_id</dt><dd><code>${esc(r.current_member_id || "窶・)}</code></dd>` +
      `<dt>authenticated</dt><dd>${esc(r.authenticated_label || (r.authenticated ? "縺ｯ縺・ : "縺・＞縺・))}</dd>` +
      `<dt>admin UI flag</dt><dd>${r.admin_ui_flag ? "縺ｯ縺・ｼ・I縺ｮ縺ｿ・・ : "縺・＞縺・}</dd>` +
      `<dt>admin DB role</dt><dd>${esc(r.admin_db_role || "窶・)} <span class="anpi-line-admin__warn">${esc(r.admin_db_role_note || "")}</span></dd>` +
      `<dt>context save mode</dt><dd><code>${esc(r.context_save_mode || "窶・)}</code></dd>` +
      `<dt>logs save mode</dt><dd><code>${esc(r.logs_save_mode || "窶・)}</code></dd>` +
      `<dt>DB sync</dt><dd>${r.supabase_sync_paused ? esc(r.supabase_sync_paused_message || "蛛懈ｭ｢") : "譛牙柑"}</dd>` +
      `<dt>last unauthorized</dt><dd>${last ? esc(`${last.scope} @ ${formatDt(last.at)}`) : "窶・}</dd>` +
      `<dt>mock RLS enforce</dt><dd>${r.mock_enforced ? "on" : "off"}</dd>` +
      `</dl>` +
      `</section>`
    );
  }

  function renderRlsAccessHtml(rlsState, rlsStats) {
    const s = rlsState || {};
    const st = rlsStats || {};
    return (
      `<section class="anpi-line-admin-page__rls" aria-label="RLS 繧｢繧ｯ繧ｻ繧ｹ">` +
      `<h2>RLS / 讓ｩ髯仙宛蠕｡</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>繧｢繧ｯ繧ｻ繧ｹ遽・峇</dt><dd>${esc(st.scope === "admin" ? "邂｡逅・・ｼ亥・莉ｶ・・ : "莨壼藤・郁・蛻・・陦後・縺ｿ・・)}</dd>` +
      `<dt>member_id</dt><dd><code>${esc(s.member_id || "窶・)}</code></dd>` +
      `<dt>邂｡逅・・/dt><dd>${s.admin ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `<dt>LINE驕狗畑邂｡逅・・/dt><dd>${s.line_admin ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `<dt>mock RLS</dt><dd>${s.mock_enforced ? "enforce" : "off"}</dd>` +
      `<dt>蜿ら・蜿ｯ閭ｽ context</dt><dd>${esc(String(st.context_count ?? "窶・))}</dd>` +
      `<dt>蜿ら・蜿ｯ閭ｽ logs</dt><dd>${esc(String(st.logs_count ?? "窶・))}</dd>` +
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
      `<dt>member_id</dt><dd><code>${esc(identity.member_id || "窶・)}</code></dd>` +
      `<dt>contract_holder_id</dt><dd><code>${esc(identity.contract_holder_id || "窶・)}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(identity.anpi_user_id || identity.user_id || "窶・)}</code></dd>` +
      `<dt>user_id・亥ｾ梧婿莠呈鋤・・/dt><dd><code>${esc(identity.user_id || "窶・)}</code></dd>` +
      `<dt>relationship</dt><dd>${esc(identity.relationship || "窶・)}</dd>` +
      `<dt>account_scope</dt><dd>${esc(identity.account_scope || "窶・)}</dd>` +
      `<dt>primary 蛻､螳・/dt><dd>${esc(formatPrimaryContextLabel(identity))}</dd>` +
      `</dl>` +
      `<h3>Notification Logs identity filter</h3>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>contract_holder_id</dt><dd><code>${esc(logsFilter.contractHolderId || "窶・)}</code></dd>` +
      `<dt>member_id</dt><dd><code>${esc(logsFilter.memberId || "窶・)}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(logsFilter.anpiUserId || logsFilter.userId || "窶・)}</code></dd>` +
      `</dl>` +
      `</section>`
    );
  }

  function hcItemStatus(hc, id) {
    const item = hc?.items?.find((i) => i.id === id);
    if (!item) return "譛ｪ遒ｺ隱・;
    if (item.status === "ok") return "OK";
    if (item.status === "error") return "繧ｨ繝ｩ繝ｼ";
    return "隕∫｢ｺ隱・;
  }

  function renderModeBadgeHtml() {
    if (!isAdmin()) return "";
    const label = getModeLabel();
    const mod = getModeClass();
    return (
      `<p class="anpi-line-mode-badge anpi-line-mode-badge--${mod}" data-anpi-line-mode-badge>` +
      `<span class="anpi-line-mode-badge__label">LINE騾∽ｿ｡繝｢繝ｼ繝・/span> ` +
      `<strong>${esc(label)}</strong>` +
      `</p>`
    );
  }

  function renderHealthcheckListHtml(items, { compact = false } = {}) {
    if (!items?.length) {
      return `<p class="anpi-line-admin__empty">繝√ぉ繝・け邨先棡縺後≠繧翫∪縺帙ｓ</p>`;
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

  function renderLogListHtml(logs, { emptyLabel = "縺ｪ縺・ } = {}) {
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
      `<section class="anpi-line-admin" data-anpi-line-admin-card aria-label="LINE險ｭ螳夂憾諷具ｼ育ｮ｡逅・・ｼ・>` +
      `<h2 class="anpi-line-admin__title">LINE險ｭ螳夂憾諷・/h2>` +
      `<p class="anpi-line-admin__link"><a href="anpi-line-admin.html">LINE驕狗畑逕ｻ髱｢繧帝幕縺・/a></p>` +
      `<dl class="anpi-line-admin__dl">` +
      `<dt>騾∽ｿ｡繝｢繝ｼ繝・/dt><dd>${esc(getModeLabel())}</dd>` +
      `<dt>LINE Login</dt><dd>${esc(s.line_login_state || "窶・)}</dd>` +
      `<dt>Messaging API</dt><dd>${esc(s.messaging_api_state || "窶・)}</dd>` +
      `<dt>Token Exchange</dt><dd>${esc(s.token_exchange_state || "窶・)}</dd>` +
      `<dt>Push API</dt><dd>${esc(s.push_api_state || "窶・)}</dd>` +
      `<dt>騾｣謳ｺ繝ｦ繝ｼ繧ｶ繝ｼ</dt><dd>${esc(String(stats.linked_user_count ?? 0))} 莉ｶ</dd>` +
      `<dt>騾∽ｿ｡貂医∩</dt><dd>${esc(String(stats.sent_count ?? 0))} 莉ｶ</dd>` +
      `<dt>騾∽ｿ｡螟ｱ謨・/dt><dd>${esc(String(stats.failed_count ?? 0))} 莉ｶ</dd>` +
      `<dt>譛邨よ・蜉・/dt><dd>${esc(formatDt(stats.last_success_at))}</dd>` +
      `<dt>譛邨ょ､ｱ謨・/dt><dd>${esc(formatDt(stats.last_failure_at))}</dd>` +
      `<dt>Anpi Context</dt><dd>${esc(s.context_storage?.source || "none")}</dd>` +
      `<dt>Storage Source</dt><dd>${esc(formatStorageSourceLabel(s.context_storage))}</dd>` +
      `<dt>Restored</dt><dd>${s.context_storage?.restored ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `<dt>member_id</dt><dd><code>${esc(s.identity?.member_id || "窶・)}</code></dd>` +
      `<dt>anpi_user_id</dt><dd><code>${esc(s.identity?.anpi_user_id || "窶・)}</code></dd>` +
      `<dt>relationship</dt><dd>${esc(s.identity?.relationship || "窶・)}</dd>` +
      `<dt>RLS scope</dt><dd>${esc(s.rls_stats?.scope === "admin" ? "蜈ｨ莉ｶ" : "莨壼藤")}</dd>` +
      `<dt>context save</dt><dd><code>${esc(s.production_readiness?.context_save_mode || "窶・)}</code></dd>` +
      `<dt>Notification Logs Storage</dt><dd>${esc(s.logs_storage?.last_sync_status || "idle")}</dd>` +
      `<dt>localStorage count</dt><dd>${esc(String(s.logs_storage?.local_count ?? 0))}</dd>` +
      `<dt>Supabase count</dt><dd>${esc(String(s.logs_storage?.supabase_count ?? 0))}</dd>` +
      `<dt>Merged count</dt><dd>${esc(String(s.logs_storage?.merged_count ?? 0))}</dd>` +
      `<dt>Logs restored</dt><dd>${s.logs_storage?.restored ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `</dl>` +
      `<p class="anpi-line-admin__hc-summary">Healthcheck: OK ${sum.ok} / 豕ｨ諢・${sum.warning} / 繧ｨ繝ｩ繝ｼ ${sum.error}</p>` +
      renderHealthcheckListHtml(hc.items, { compact: true }) +
      `</section>`
    );
  }

  function renderAdminPageHtml(state) {
    if (!isAdmin()) {
      return (
        `<section class="anpi-line-admin-page__denied" data-anpi-line-admin-denied>` +
        `<h1>繧｢繧ｯ繧ｻ繧ｹ縺ｧ縺阪∪縺帙ｓ</h1>` +
        `<p>縺薙・逕ｻ髱｢縺ｯ邂｡逅・・・縺ｿ蛻ｩ逕ｨ縺ｧ縺阪∪縺吶・/p>` +
        `<p><code>localStorage.setItem('tasu_anpi_line_admin_v1','1')</code> 縺ｾ縺溘・ <code>?anpi_admin=1</code></p>` +
        `<p><a href="dashboard.html">繝繝・す繝･繝懊・繝峨∈謌ｻ繧・/a></p>` +
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
        esc(testResult.ok ? "繝・せ繝・ush騾∽ｿ｡縺ｫ謌仙粥縺励∪縺励◆縲・ : `騾∽ｿ｡螟ｱ謨・ ${testResult.error_message || ""}`) +
        (testResult.error_code ? `・・{esc(testResult.error_code)}・荏 : "") +
        `</p>`;
    }

    return (
      `<div class="anpi-line-admin-page__inner" data-anpi-line-admin-page>` +
      `<header class="anpi-line-admin-page__header">` +
      `<h1 class="anpi-line-admin-page__title">LINE驕狗畑・育ｮ｡逅・・ｼ・/h1>` +
      renderModeBadgeHtml() +
      `<nav class="anpi-line-admin-page__nav" aria-label="髢｢騾｣逕ｻ髱｢">` +
      `<a href="dashboard.html">繝繝・す繝･繝懊・繝・/a>` +
      `<a href="anpi-dashboard.html">螳牙凄繝繝・す繝･繝懊・繝・/a>` +
      `<a href="anpi-notifications.html">螳牙凄遒ｺ隱榊ｱ･豁ｴ</a>` +
      `<a href="anpi-register.html">螳牙凄繧ｵ繝ｼ繝薙せ逋ｻ骭ｲ</a>` +
      `</nav>` +
      `</header>` +
      `<section class="anpi-line-admin-page__stats" aria-label="騾∽ｿ｡邨ｱ險・>` +
      `<h2>Push騾∽ｿ｡邨ｱ險・/h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>LINE Login</dt><dd>${esc(s.line_login_state || "窶・)}</dd>` +
      `<dt>Messaging API</dt><dd>${esc(s.messaging_api_state || "窶・)}</dd>` +
      `<dt>Token Exchange</dt><dd>${esc(s.token_exchange_state || "窶・)}</dd>` +
      `<dt>Push API</dt><dd>${esc(s.push_api_state || "窶・)}</dd>` +
      `<dt>騾｣謳ｺ繝ｦ繝ｼ繧ｶ繝ｼ謨ｰ</dt><dd>${esc(String(stats.linked_user_count ?? 0))}</dd>` +
      `<dt>騾∽ｿ｡貂医∩莉ｶ謨ｰ</dt><dd>${esc(String(stats.sent_count ?? 0))}</dd>` +
      `<dt>騾∽ｿ｡螟ｱ謨嶺ｻｶ謨ｰ</dt><dd>${esc(String(stats.failed_count ?? 0))}</dd>` +
      `<dt>譛邨よ・蜉滄∽ｿ｡</dt><dd>${esc(formatDt(stats.last_success_at))}</dd>` +
      `<dt>譛邨ょ､ｱ謨鈴∽ｿ｡</dt><dd>${esc(formatDt(stats.last_failure_at))}</dd>` +
      `<dt>Anpi Context</dt><dd>${esc(s.context_storage?.source || "none")}</dd>` +
      `<dt>Storage Source</dt><dd>${esc(formatStorageSourceLabel(s.context_storage))}</dd>` +
      `<dt>Restored</dt><dd>${s.context_storage?.restored ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `</dl>` +
      `</section>` +
      renderIdentityLinkingHtml(s.identity_context, s.logs_identity_filter) +
      renderRlsAccessHtml(s.rls_state, s.rls_stats) +
      renderProductionReadinessHtml(s.production_readiness) +
      `<section class="anpi-line-admin-page__logs-storage" aria-label="騾夂衍繝ｭ繧ｰ繧ｹ繝医Ξ繝ｼ繧ｸ">` +
      `<h2>Notification Logs Storage</h2>` +
      `<dl class="anpi-line-admin__dl anpi-line-admin__dl--stats">` +
      `<dt>Last sync status</dt><dd>${esc(s.logs_storage?.last_sync_status || "idle")}</dd>` +
      `<dt>localStorage count</dt><dd>${esc(String(s.logs_storage?.local_count ?? 0))}</dd>` +
      `<dt>Supabase count</dt><dd>${esc(String(s.logs_storage?.supabase_count ?? 0))}</dd>` +
      `<dt>Merged count</dt><dd>${esc(String(s.logs_storage?.merged_count ?? 0))}</dd>` +
      `<dt>Last restored at</dt><dd>${esc(formatDt(s.logs_storage?.last_restored_at))}</dd>` +
      `<dt>Logs restored</dt><dd>${s.logs_storage?.restored ? "縺ｯ縺・ : "縺・＞縺・}</dd>` +
      `</dl>` +
      `</section>` +
      `<section class="anpi-line-admin-page__test" aria-label="繝・せ繝・ush">` +
      `<h2>繝・せ繝・ush騾∽ｿ｡</h2>` +
      `<p class="anpi-line-admin-page__test-lead">迴ｾ蝨ｨ騾｣謳ｺ荳ｭ縺ｮLINE繧｢繧ｫ繧ｦ繝ｳ繝医∈蝗ｺ螳壽枚繧帝∽ｿ｡縺励∪縺呻ｼ育ｮ｡逅・・・縺ｿ・峨・/p>` +
      `<pre class="anpi-line-admin-page__test-msg">TASFUL螳牙凄繧ｵ繝ｼ繝薙せ\nLINE騾夂衍繝・せ繝医〒縺吶・/pre>` +
      `<button type="button" class="anpi-line-admin-page__test-btn" data-anpi-line-test-push>繝・せ繝・ush騾∽ｿ｡</button>` +
      testFeedback +
      `</section>` +
      `<section class="anpi-line-admin-page__hc" aria-label="Healthcheck">` +
      `<h2>Healthcheck</h2>` +
      `<p class="anpi-line-admin__hc-summary">OK ${sum.ok} / 豕ｨ諢・${sum.warning} / 繧ｨ繝ｩ繝ｼ ${sum.error}</p>` +
      renderHealthcheckListHtml(hc.items) +
      `</section>` +
      `<div class="anpi-line-admin-page__logs">` +
      `<section aria-label="譛霑代・騾∽ｿ｡繝ｭ繧ｰ">` +
      `<h2>譛霑代・騾∽ｿ｡繝ｭ繧ｰ</h2>` +
      renderLogListHtml(stats.recent_sent_logs, { emptyLabel: "騾∽ｿ｡貂医∩繝ｭ繧ｰ縺ｯ縺ゅｊ縺ｾ縺帙ｓ" }) +
      `</section>` +
      `<section aria-label="譛霑代・螟ｱ謨励Ο繧ｰ">` +
      `<h2>譛霑代・螟ｱ謨励Ο繧ｰ</h2>` +
      renderLogListHtml(stats.recent_failed_logs, { emptyLabel: "螟ｱ謨励Ο繧ｰ縺ｯ縺ゅｊ縺ｾ縺帙ｓ" }) +
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
      hcItemStatus(hc, "line_login_callback_url") !== "繧ｨ繝ｩ繝ｼ";

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
      line_login_state: loginOk ? "讒区・貂医∩" : "隕∬ｨｭ螳・,
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

