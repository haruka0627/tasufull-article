/**
 * パートナー実績評価（期日遵守・クレームなし）— localStorage
 */
(function (global) {
  "use strict";

  const EVAL_KEY = "tasful:builder:partner_evaluations:v1";
  const STATUS_EVENTS_KEY = "tasful:builder:partner_status_events:v1";
  const VISIBILITY_KEY = "tasful:builder:partner_visibility:v1";
  const ADMIN_PARTNERS_KEY = "tasful:builder:admin:partners:v1";
  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";
  const HIDDEN_STATUSES = new Set(["hidden", "disabled", "blocked"]);
  const EVENT_NAME = "tasu:builder-partner-eval-changed";

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function normalizeName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/株式会社|（株）|\(株\)/g, "");
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeJson(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      /* ignore */
    }
  }

  function readAdminPartners() {
    try {
      const raw = localStorage.getItem(ADMIN_PARTNERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAdminPartners(list) {
    localStorage.setItem(ADMIN_PARTNERS_KEY, JSON.stringify(list));
    try {
      global.dispatchEvent(new CustomEvent("builder:admin-partners-changed"));
    } catch {
      /* ignore */
    }
  }

  function readMvpPartners() {
    try {
      const raw = localStorage.getItem(MVP_STORAGE_KEY);
      if (!raw) return [];
      const state = JSON.parse(raw);
      return Array.isArray(state?.partners) ? state.partners : [];
    } catch {
      return [];
    }
  }

  /** @returns {object|null} */
  function findBuilderPartnerByName(name) {
    const q = normalizeName(name);
    if (!q) return null;

    const admin = readAdminPartners().find((p) => {
      const cn = normalizeName(p.companyName);
      return cn === q || cn.includes(q) || q.includes(cn);
    });

    const mvpStored = readMvpPartners().find((p) => {
      const dn = normalizeName(p.display_name || p.displayName);
      return dn === q || dn.includes(q) || q.includes(dn);
    });

    const mvpDemo = (global.__BUILDER_DEMO_PARTNER_NAMES__ || []).find((p) => {
      const dn = normalizeName(p.display_name);
      return dn === q || dn.includes(q) || q.includes(dn);
    });

    const mvp = mvpStored || mvpDemo;
    const partner_name =
      admin?.companyName || mvp?.display_name || mvp?.displayName || String(name).trim();
    const partner_id = admin?.id || mvp?.partner_id || `name:${normalizeName(partner_name)}`;

    return {
      partner_id,
      partner_name,
      admin_partner_id: admin?.id || null,
      mvp_partner_id: mvp?.partner_id || null,
      admin_partner: admin || null,
      mvp_partner: mvp || null,
    };
  }

  function getBuilderPartnerEvaluations(filter) {
    let list = readJson(EVAL_KEY);
    const Read = global.TasuSupabaseOpsRead;
    if (Read?.mergeList) list = Read.mergeList(list, "builder_partner_evaluations");
    if (filter?.partner_id) {
      list = list.filter((e) => e.partner_id === filter.partner_id);
    }
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function getBuilderPartnerStatusEvents(filter) {
    let list = readJson(STATUS_EVENTS_KEY);
    if (filter?.partner_id) {
      list = list.filter((e) => e.partner_id === filter.partner_id);
    }
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function recomputeScoreFromHistory(partnerId) {
    const evs = getBuilderPartnerEvaluations({ partner_id: partnerId });
    let deadline_score = 0;
    let no_complaint_score = 0;
    evs.forEach((e) => {
      deadline_score += Number(e.deadline_delta) || 0;
      no_complaint_score += Number(e.complaint_delta) || 0;
    });
    return {
      partner_id: partnerId,
      deadline_score,
      no_complaint_score,
      total_score: deadline_score + no_complaint_score,
      review_count: evs.length,
      last_evaluated_at: evs[0]?.created_at || null,
    };
  }

  function getBuilderPartnerScore(partnerId) {
    return recomputeScoreFromHistory(String(partnerId || ""));
  }

  function readVisibilityMap() {
    const Primary = global.TasuSupabaseOpsPrimaryConfig;
    const PC = global.TasuSupabaseOpsPrimaryCache;
    if (Primary?.isPrimarySource?.() && PC?.readTableCache) {
      const cached = PC.readTableCache("builder_partner_visibility");
      if (cached && typeof cached === "object" && Object.keys(cached).length) {
        return cached;
      }
    }
    try {
      const raw = localStorage.getItem(VISIBILITY_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function writeVisibilityMap(map) {
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(map));
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      /* ignore */
    }
  }

  function getPartnerStatusRecord(partnerId, partnerName) {
    const admin = readAdminPartners();
    const found = admin.find((p) => p.id === partnerId);
    if (found) {
      return { source: "admin", partner: found, status: found.partner_status || "active" };
    }

    const map = readVisibilityMap();
    if (partnerId && map[partnerId]) {
      return { source: "visibility", partner: null, status: map[partnerId] };
    }

    const byName = partnerName ? findBuilderPartnerByName(partnerName) : null;
    if (byName?.admin_partner) {
      return {
        source: "admin",
        partner: byName.admin_partner,
        status: byName.admin_partner.partner_status || "active",
      };
    }
    if (byName?.mvp_partner_id && map[byName.mvp_partner_id]) {
      return { source: "visibility", partner: null, status: map[byName.mvp_partner_id] };
    }
    return { source: "none", partner: null, status: "active" };
  }

  function isPartnerHidden(partnerId, partnerName) {
    const rec = getPartnerStatusRecord(partnerId, partnerName);
    return HIDDEN_STATUSES.has(String(rec.status || "").toLowerCase());
  }

  function isPartnerVisibleForListing(partnerId, partnerName) {
    return !isPartnerHidden(partnerId, partnerName);
  }

  function hasDuplicateEvaluation(input) {
    const pid = input.partner_id;
    const projectId = input.project_id ? String(input.project_id) : "";
    if (!projectId) return false;
    return getBuilderPartnerEvaluations({ partner_id: pid }).some(
      (e) =>
        String(e.project_id || "") === projectId &&
        e.deadline_delta === input.deadline_delta &&
        e.complaint_delta === input.complaint_delta
    );
  }

  function addBuilderPartnerEvaluation(input) {
    const partner = findBuilderPartnerByName(input.partner_name || input.partnerName);
    if (!partner) {
      return { ok: false, error: "パートナーが見つかりません" };
    }

    const row = {
      id: uid("peval"),
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      project_id: input.project_id ? String(input.project_id) : null,
      project_title: input.project_title ? String(input.project_title) : null,
      deadline_delta: Number(input.deadline_delta) || 0,
      complaint_delta: Number(input.complaint_delta) || 0,
      note: input.note ? String(input.note) : "",
      created_by: input.created_by || "admin",
      created_at: new Date().toISOString(),
    };

    if (!row.deadline_delta && !row.complaint_delta) {
      return { ok: false, error: "評価の増減が0のため登録しません" };
    }

    if (hasDuplicateEvaluation(row)) {
      return { ok: false, error: "同一案件・同一評価が既に登録されています" };
    }

    const list = readJson(EVAL_KEY);
    list.unshift(row);
    writeJson(EVAL_KEY, list.slice(0, 5000));
    if (global.TasuSupabaseOpsWrite?.insertBuilderEvaluation) {
      void global.TasuSupabaseOpsWrite.insertBuilderEvaluation(row);
    }

    const score = recomputeScoreFromHistory(partner.partner_id);
    return { ok: true, evaluation: row, partner, score };
  }

  function applyPartnerHideStatus(input) {
    const partner = findBuilderPartnerByName(input.partner_name || input.partnerName);
    if (!partner) return { ok: false, error: "パートナーが見つかりません" };

    const status = input.partner_status || input.hide_status || "hidden";
    const reason = input.reason || input.hide_reason || "管理者による非表示";
    const created_by = input.created_by || "admin";

    if (partner.admin_partner_id) {
      const list = readAdminPartners();
      const idx = list.findIndex((p) => p.id === partner.admin_partner_id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          partner_status: status,
          updatedAt: new Date().toISOString(),
        };
        saveAdminPartners(list);
      }
    }

    const vis = readVisibilityMap();
    vis[partner.partner_id] = status;
    if (partner.mvp_partner_id) vis[partner.mvp_partner_id] = status;
    writeVisibilityMap(vis);

    const statusRow = {
      id: uid("pstat"),
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      partner_status: status,
      action: "hidden",
      reason,
      created_by,
      created_at: new Date().toISOString(),
    };
    const events = readJson(STATUS_EVENTS_KEY);
    events.unshift(statusRow);
    writeJson(STATUS_EVENTS_KEY, events.slice(0, 2000));
    if (global.TasuSupabaseOpsWrite?.insertBuilderStatusEvent) {
      void global.TasuSupabaseOpsWrite.insertBuilderStatusEvent(statusRow);
    }
    if (global.TasuSupabaseOpsWrite?.updateBuilderPartnerVisibility) {
      void global.TasuSupabaseOpsWrite.updateBuilderPartnerVisibility(
        partner.partner_id,
        status
      );
    }

    return { ok: true, partner, status, reason };
  }

  function getPerformanceBadge(total) {
    const t = Number(total) || 0;
    if (t >= 10) return { label: "優良", mod: "excellent" };
    if (t >= 5) return { label: "安定", mod: "stable" };
    if (t < 0) return { label: "要注意", mod: "warn" };
    return { label: "標準", mod: "normal" };
  }

  function formatScoreSummary(partnerId, partnerName) {
    const score = getBuilderPartnerScore(partnerId);
    const badge = getPerformanceBadge(score.total_score);
    const hidden = isPartnerHidden(partnerId, partnerName);
    return {
      score,
      badge,
      hidden,
      html: formatScoreHtml(score, badge, hidden),
    };
  }

  function formatScoreHtml(score, badge, hidden) {
    const sign = (n) => (n > 0 ? `+${n}` : String(n));
    const hiddenTag = hidden
      ? `<span class="builder-perf-badge builder-perf-badge--hidden">非表示</span>`
      : "";
    return (
      `<div class="builder-perf" data-builder-perf>` +
      hiddenTag +
      `<span class="builder-perf-badge builder-perf-badge--${badge.mod}">${badge.label}</span>` +
      `<span class="builder-perf-line">実績評価：${sign(score.total_score)}</span>` +
      `<span class="builder-perf-line">期日遵守：${sign(score.deadline_score)}</span>` +
      `<span class="builder-perf-line">クレームなし：${sign(score.no_complaint_score)}</span>` +
      `<span class="builder-perf-line">評価回数：${score.review_count}件</span>` +
      `</div>`
    );
  }

  function listPartnerScoreboard(includeHidden) {
    const ids = new Map();
    getBuilderPartnerEvaluations().forEach((e) => ids.set(e.partner_id, e.partner_name));
    readAdminPartners().forEach((p) => ids.set(p.id, p.companyName));
    if (includeHidden) {
      getBuilderPartnerStatusEvents().forEach((e) => ids.set(e.partner_id, e.partner_name));
    }

    return [...ids.entries()]
      .map(([partner_id, partner_name]) => {
        const score = getBuilderPartnerScore(partner_id);
        const badge = getPerformanceBadge(score.total_score);
        const hidden = isPartnerHidden(partner_id, partner_name);
        return { partner_id, partner_name, score, badge, hidden };
      })
      .filter((row) => includeHidden || !row.hidden)
      .sort((a, b) => b.score.total_score - a.score.total_score);
  }

  function listHiddenPartners() {
    const rows = [];
    const seen = new Set();
    readAdminPartners()
      .filter((p) => HIDDEN_STATUSES.has(String(p.partner_status || "").toLowerCase()))
      .forEach((p) => {
        seen.add(p.id);
        rows.push({
          partner_id: p.id,
          partner_name: p.companyName,
          partner_status: p.partner_status,
          score: getBuilderPartnerScore(p.id),
        });
      });
    const map = readVisibilityMap();
    Object.keys(map).forEach((pid) => {
      if (!HIDDEN_STATUSES.has(String(map[pid]).toLowerCase()) || seen.has(pid)) return;
      const ev = getBuilderPartnerStatusEvents({ partner_id: pid })[0];
      rows.push({
        partner_id: pid,
        partner_name: ev?.partner_name || pid,
        partner_status: map[pid],
        score: getBuilderPartnerScore(pid),
      });
    });
    return rows;
  }

  function clearAllForTests() {
    localStorage.removeItem(EVAL_KEY);
    localStorage.removeItem(STATUS_EVENTS_KEY);
    localStorage.removeItem(VISIBILITY_KEY);
  }

  const BUILDER_EVENT_MAP = {
    application: { status: "needs_review", event_type: "application" },
    selected: { status: "info", event_type: "hire" },
    hire_confirmed: { status: "info", event_type: "hire" },
    completion_submitted: { status: "needs_review", event_type: "completion_report" },
    completion_report: { status: "needs_review", event_type: "completion_report" },
    completion_rejected: { status: "needs_review", event_type: "rejection" },
    rejected: { status: "needs_review", event_type: "rejection" },
  };

  function inferBuilderEventTypeFromText(title, body, kind) {
    const k = String(kind || "").toLowerCase();
    if (k && BUILDER_EVENT_MAP[k]) return BUILDER_EVENT_MAP[k];
    const t = `${title || ""} ${body || ""}`;
    if (/応募|application/i.test(t)) return BUILDER_EVENT_MAP.application;
    if (/選定|採用|hire|selected/i.test(t)) return BUILDER_EVENT_MAP.hire_confirmed;
    if (/完了報告|completion/i.test(t) && /差し戻し|reject|却下/i.test(t)) {
      return BUILDER_EVENT_MAP.completion_rejected;
    }
    if (/完了報告|completion/i.test(t)) return BUILDER_EVENT_MAP.completion_submitted;
    if (/差し戻し|reject|却下/i.test(t)) return BUILDER_EVENT_MAP.rejected;
    return { status: "needs_review", event_type: "needs_review" };
  }

  function normalizeReviewStatus(status) {
    const s = String(status || "").toLowerCase();
    if (s === "pending") return "unreviewed";
    if (s === "rejected") return "returned";
    return s;
  }

  /** AI運営秘書向け — 評価・通知・審査を統合した一覧 */
  function listEvaluations() {
    const rows = [];
    const seen = new Set();

    function push(row) {
      const key = String(row.id || `${row.event_type}_${row.partner_id}_${row.created_at}`);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    }

    readAdminPartners().forEach((p) => {
      const rs = normalizeReviewStatus(p.reviewStatus || p.review_status);
      if (!["unreviewed", "reviewing", "returned", ""].includes(rs)) return;
      const hidden = HIDDEN_STATUSES.has(String(p.partner_status || "").toLowerCase());
      push({
        id: `admin_partner_${p.id}`,
        partner_id: p.id,
        partner_name: p.companyName || p.name || "Builderパートナー",
        display_name: p.companyName || p.name || "",
        status: "needs_review",
        event_type: rs === "returned" ? "rejection" : "needs_review",
        reason: p.reviewStatusLabel || p.review_status_label || "パートナー審査",
        summary: p.reviewStatusLabel || "",
        note: p.admin_note || "",
        visibility: hidden ? "hidden" : "visible",
        identity_verified: p.identity_verified !== false,
        score: Number(p.score) || 0,
        created_at: p.createdAt || p.created_at || new Date().toISOString(),
        updated_at: p.updatedAt || p.updated_at || p.createdAt || new Date().toISOString(),
      });
    });

    getBuilderPartnerEvaluations().forEach((e) => {
      const needsReview = (Number(e.complaint_delta) || 0) < 0 || (Number(e.deadline_delta) || 0) < 0;
      if (!needsReview) return;
      push({
        id: e.id,
        partner_id: e.partner_id,
        partner_name: e.partner_name,
        display_name: e.partner_name,
        status: "needs_review",
        event_type: "needs_review",
        reason: e.note || "評価要確認",
        summary: e.note || "",
        note: e.note || "",
        visibility: isPartnerHidden(e.partner_id, e.partner_name) ? "hidden" : "visible",
        identity_verified: true,
        score: (Number(e.deadline_delta) || 0) + (Number(e.complaint_delta) || 0),
        created_at: e.created_at,
        updated_at: e.created_at,
      });
    });

    getBuilderPartnerStatusEvents().forEach((ev) => {
      const hidden = HIDDEN_STATUSES.has(String(ev.partner_status || "").toLowerCase());
      push({
        id: ev.id,
        partner_id: ev.partner_id,
        partner_name: ev.partner_name,
        display_name: ev.partner_name,
        status: "needs_review",
        event_type: hidden || ev.action === "hidden" ? "rejection" : "needs_review",
        reason: ev.reason || ev.partner_status || "ステータス変更",
        summary: ev.reason || "",
        note: ev.reason || "",
        visibility: hidden ? "hidden" : "visible",
        identity_verified: true,
        created_at: ev.created_at,
        updated_at: ev.created_at,
      });
    });

    try {
      const raw = localStorage.getItem("tasful:builder:mvp:notifications:v1");
      const mvpList = raw ? JSON.parse(raw) : [];
      (Array.isArray(mvpList) ? mvpList : []).forEach((n) => {
        const nt = String(n.type || "").trim();
        const cfg = BUILDER_EVENT_MAP[nt] || inferBuilderEventTypeFromText(n.title, n.body, nt);
        if (!cfg) return;
        push({
          id: n.id || `mvp_${nt}_${n.projectId || n.project_id || n.threadId || ""}`,
          partner_id: n.partnerId || n.partner_id || n.projectId || n.project_id || "",
          partner_name: n.projectTitle || n.title || "Builder案件",
          display_name: n.projectTitle || n.title || "",
          status: cfg.status,
          event_type: cfg.event_type,
          reason: n.body || n.title || nt,
          summary: n.title || "",
          note: n.body || "",
          visibility: "visible",
          identity_verified: true,
          created_at: n.createdAt || n.ts || new Date().toISOString(),
          updated_at: n.updatedAt || n.createdAt || n.ts || new Date().toISOString(),
        });
      });
    } catch {
      /* ignore */
    }

    const talk = global.TasuTalkNotifications;
    if (talk?.getAll) {
      (talk.getAll() || [])
        .filter(
          (n) =>
            String(n.type || "").toLowerCase() === "builder" ||
            String(n.source || "").toLowerCase().includes("builder")
        )
        .forEach((n) => {
          const cfg = inferBuilderEventTypeFromText(
            n.title,
            n.body,
            n.builderNotifyKind || n.type
          );
          push({
            id: `talk_builder_${n.id}`,
            partner_id: n.recipientUserId || n.projectId || n.project_id || "",
            partner_name: n.projectTitle || n.title || "Builder",
            display_name: n.projectTitle || n.title || "",
            status: cfg.status,
            event_type: cfg.event_type,
            reason: n.body || n.title || "",
            summary: n.title || "",
            note: n.body || "",
            visibility: "visible",
            identity_verified: true,
            talk_unread: talk.isUnread?.(n) !== false && !n.readAt,
            created_at: n.createdAt || new Date().toISOString(),
            updated_at: n.createdAt || new Date().toISOString(),
          });
        });
    }

    return rows.sort((a, b) =>
      String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))
    );
  }

  global.TasuBuilderPartnerEval = {
    EVAL_KEY,
    STATUS_EVENTS_KEY,
    getBuilderPartnerEvaluations,
    listEvaluations,
    addBuilderPartnerEvaluation,
    getBuilderPartnerScore,
    findBuilderPartnerByName,
    recomputeScoreFromHistory,
    isPartnerHidden,
    isPartnerVisibleForListing,
    applyPartnerHideStatus,
    getBuilderPartnerStatusEvents,
    listPartnerScoreboard,
    listHiddenPartners,
    formatScoreSummary,
    getPerformanceBadge,
    clearAllForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
