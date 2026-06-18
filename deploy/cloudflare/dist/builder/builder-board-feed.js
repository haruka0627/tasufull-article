/**
 * Builder 掲示板 — 案件 / ワーカー 共通フィード
 */
(function (global) {
  "use strict";

  const DEMO_JOB_ID = "job_demo_full_001";
  const DEMO_WORKER_ID = "demo-worker-001";

  const TYPE_CONFIG = Object.freeze({
    project: {
      type: "project",
      label: "案件",
      applyCta: "応募する",
      appliedCta: "応募済み",
      hireCta: "選定する",
      rejectCta: "断る",
      panelTitle: "応募状況",
      appsSectionLead:
        "応募者の選定 / 断りができます。選定後にやりとりチャットが開きます。",
      applyDetailCta: "この案件に応募する",
      matchVerb: "選定",
      hireNotifyApplicant: "選定されました",
      hireNotifyPoster: "選定が完了しました",
      hireBodyApplicant: "やりとりチャットへ進んでください。",
      hireBodyPoster: "とのやりとりチャットへ進んでください。",
      rejectNotify: "今回は見送りになりました",
      overviewTitle: "案件内容",
      workTitle: "作業内容",
      tradesTitle: "募集職種",
    },
    job: {
      type: "job",
      label: "案件",
      applyCta: "応募する",
      appliedCta: "応募済み",
      hireCta: "選定する",
      rejectCta: "断る",
      panelTitle: "応募状況",
      appsSectionLead:
        "応募者の選定 / 断りができます。選定後にやりとりチャットが開きます。",
      applyDetailCta: "この案件に応募する",
      matchVerb: "選定",
      hireNotifyApplicant: "選定されました",
      hireNotifyPoster: "選定が完了しました",
      hireBodyApplicant: "やりとりチャットへ進んでください。",
      hireBodyPoster: "さんとのやりとりチャットへ進んでください。",
      rejectNotify: "今回は見送りになりました",
      overviewTitle: "案件概要",
      workTitle: "仕事内容",
      tradesTitle: "募集職種",
    },
    worker: {
      type: "worker",
      label: "ワーカー",
      applyCta: "依頼する",
      appliedCta: "依頼済み",
      hireCta: "依頼を受ける",
      rejectCta: "断る",
      panelTitle: "依頼状況",
      appsSectionLead:
        "依頼者への受諾 / 断りができます。受諾後にやりとりチャットが開きます。",
      applyDetailCta: "このワーカーに依頼する",
      matchVerb: "受諾",
      threadKind: "worker_request",
      hireNotifyApplicant: "依頼を引き受けました",
      hireNotifyPoster: "依頼を受けました",
      hireBodyApplicant: "やりとりチャットへ進んでください。",
      hireBodyPoster: "やりとりチャットへ進んでください。",
      rejectNotify: "依頼が辞退されました",
      overviewTitle: "プロフィール",
      workTitle: "対応内容",
      tradesTitle: "スキル・職種",
    },
    calendar: {
      type: "calendar",
      label: "公式カレンダー",
      applyCta: "受ける",
      appliedCta: "受諾済み",
      hireCta: "受ける",
      rejectCta: "受けない",
      panelTitle: "案件確認",
      appsSectionLead: "案件内容を確認し、受諾 / 辞退を選択してください。",
      applyDetailCta: "この案件を受ける",
      matchVerb: "受諾",
      threadKind: "calendar_request",
      assignNotifyTitle: "新着案件が入りました",
      assignNotifyAction: "カレンダーを確認",
      hireNotifyApplicant: "依頼を引き受けました",
      hireNotifyPoster: "依頼を受けました",
      hireBodyApplicant: "やりとりチャットへ進んでください。",
      hireBodyPoster: "やりとりチャットへ進んでください。",
      rejectNotify: "今回は見送りになりました",
      overviewTitle: "案件内容",
      workTitle: "作業内容",
      tradesTitle: "職種",
    },
  });

  const TYPE_TABS = Object.freeze([
    { key: "all", label: "すべて" },
    { key: "project", label: "案件" },
    { key: "worker", label: "ワーカー" },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function resolveBoardType(project) {
    const explicit = pickStr(project?.board_type, project?.projectKind, project?.type);
    if (explicit === "job" || explicit === "worker" || explicit === "project" || explicit === "calendar") {
      return explicit;
    }
    if (String(project?.source || "") === "admin_calendar") return "calendar";
    if (String(project?.kind || "") === "builder_board" && !project?.board_type) return "project";
    return "";
  }

  function matchesBoardTabFilter(project, filterKey) {
    const key = String(filterKey || "all").trim() || "all";
    if (key === "all") return true;
    const boardType = resolveBoardType(project);
    if (key === "project") return boardType === "project" || boardType === "job";
    return boardType === key;
  }

  function resolveProjectCategoryLabel(project) {
    return pickStr(project?.project_category, project?.projectCategory);
  }

  function resolveProjectBadgeLabel(project) {
    return resolveProjectCategoryLabel(project) || getTypeConfig(project).label;
  }

  function isBoardFeedProject(project) {
    return Boolean(resolveBoardType(project));
  }

  function getTypeConfig(projectOrType) {
    const t =
      typeof projectOrType === "string"
        ? projectOrType
        : resolveBoardType(projectOrType) || "project";
    return TYPE_CONFIG[t] || TYPE_CONFIG.project;
  }

  function resolveThreadKind(project) {
    const cfg = getTypeConfig(project);
    return pickStr(cfg.threadKind, resolveBoardType(project) === "worker" ? "worker_request" : "board_match");
  }

  function filterBoardFeed(projects) {
    return (projects || []).filter(isBoardFeedProject);
  }

  function fetchListing(id) {
    const catalog = global.TasuListingDemoCatalog;
    return catalog?.getStoreListing?.(id) || catalog?.STORE_BY_ID?.[id] || null;
  }

  function formatSalary(listing) {
    const fd = listing?.form_data || {};
    if (fd.salary) return String(fd.salary);
    const amt = Number(listing?.salary_amount || listing?.price_amount || 0);
    if (amt >= 10000) return `¥${Math.round(amt / 10000)}万円〜`;
    if (amt > 0) return `¥${amt.toLocaleString()}〜`;
    return "応相談";
  }

  function listingToSpec(listing, boardType) {
    const fd = listing?.form_data || {};
    const tags = String(listing?.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const trades =
      boardType === "worker"
        ? [fd.workerCategory, fd.services, listing?.worker_services]
            .flatMap((x) => String(x || "").split(/[/,、]/))
            .map((t) => t.trim())
            .filter(Boolean)
        : [listing?.category, listing?.subcategory, ...tags].filter(Boolean);

    return {
      area: { label: pickStr(listing?.job_location, listing?.service_area, listing?.worker_area, "全国") },
      period: {
        start: "",
        end: pickStr(listing?.application_deadline, listing?.worker_availability, "随時"),
      },
      budget: { min: Number(listing?.price_amount || 0), max: Number(listing?.salary_amount || listing?.price_amount || 0) },
      reward: formatSalary(listing),
      trade_tags: trades.slice(0, 6),
      trades: trades.slice(0, 6),
      overview: pickStr(listing?.description, listing?.worker_profile, listing?.title),
      work_content: pickStr(
        listing?.required_skills,
        listing?.worker_services,
        fd.services,
        listing?.description
      ),
      preferred_conditions: pickStr(listing?.welcome_skills, listing?.worker_experience, fd.experience_years),
      notes: pickStr(listing?.application_method, listing?.contract_terms, listing?.worker_availability),
      attachments: [],
      thumbnail: pickStr(listing?.thumbnail_url, listing?.image_url),
    };
  }

  function resolveListingProjectCategory(listing, boardType) {
    if (boardType === "worker") return "";
    const listingType = String(listing?.listing_type || "").trim();
    if (listingType === "job") return "職人募集";
    return "協力会社募集";
  }

  function buildListingProject(listing, boardType) {
    const id = pickStr(listing?.id, listing?.listing_id);
    const projectCategory = resolveListingProjectCategory(listing, boardType);
    return {
      project_id: id,
      owner_id: pickStr(listing?.user_id, "u_job_demo_full"),
      title: pickStr(listing?.title, listing?.company_name, id),
      kind: "builder_board",
      board_type: boardType,
      projectKind: boardType,
      type: boardType,
      project_category: projectCategory || undefined,
      status: "open",
      required_partners: Math.max(1, Number(listing?.recruitment_count || 1)),
      selected_partner_ids: [],
      visibility: "public",
      contact_policy: "tasful_talk_only",
      main_thread_id: null,
      source: "board_feed",
      talk_deal_id: id,
      created_at: pickStr(listing?.updated_at, listing?.created_at, nowIso()),
    };
  }

  const MVP_STORAGE_KEY = "tasful:builder:mvp:v1";

  function ensureBoardFeedListings(state) {
    if (!state || typeof state !== "object") return state;
    const next = { ...state };
    next.projects = Array.isArray(next.projects) ? [...next.projects] : [];
    next.specs = { ...(next.specs || {}) };
    next.applications = Array.isArray(next.applications) ? [...next.applications] : [];
    let changed = false;

    const seeds = [
      { id: DEMO_JOB_ID, type: "job" },
      { id: DEMO_WORKER_ID, type: "worker" },
    ];

    seeds.forEach(({ id, type }) => {
      if (next.projects.some((p) => p.project_id === id)) return;
      const listing = fetchListing(id);
      if (!listing) return;
      next.projects.push(buildListingProject(listing, type));
      next.specs[id] = listingToSpec(listing, type);
      changed = true;
    });

    if (!next.applications.some((a) => a.project_id === DEMO_JOB_ID)) {
      next.applications.push({
        application_id: "board-app-job-001",
        project_id: DEMO_JOB_ID,
        partner_id: "demo-partner-002",
        status: "applied",
        ts: "2026-05-28T02:30:00.000Z",
        memo: "Premiere Pro 実務3年。ショート動画制作の実績多数。",
      });
      changed = true;
    }

    if (!next.applications.some((a) => a.project_id === DEMO_WORKER_ID)) {
      next.applications.push({
        application_id: "board-app-worker-001",
        project_id: DEMO_WORKER_ID,
        partner_id: "demo-partner-001",
        status: "applied",
        ts: "2026-05-28T04:10:00.000Z",
        memo: "ショート動画5本の編集を依頼したいです。",
      });
      changed = true;
    }

    if (changed) {
      try {
        global.localStorage.setItem(MVP_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }

    return next;
  }

  function boardDetailHref(projectId, boardType) {
    const id = pickStr(projectId);
    if (!id) return "board-projects.html";
    const sp = new URLSearchParams();
    sp.set("id", id);
    const t = pickStr(boardType);
    if (t && t !== "project") sp.set("type", t);
    if (global.location && String(global.location.search).includes("from=talk")) {
      sp.set("from", "talk");
    }
    return `board-project-detail.html?${sp.toString()}`;
  }

  function boardTypeFromUrl() {
    try {
      const t = new URLSearchParams(global.location.search).get("type") || "";
      if (t === "job" || t === "worker" || t === "project") return t;
    } catch {
      /* ignore */
    }
    return "";
  }

  /** パートナー案件／カレンダー／ワーカー手配 — mvp-thread 面 */
  const MVP_PARTNER_THREAD_KINDS = new Set(["calendar", "worker", "hire", "admin_ops"]);

  function usesMvpPartnerThread(projectOrKind) {
    const kind =
      typeof projectOrKind === "string"
        ? pickStr(projectOrKind)
        : resolveBoardType(projectOrKind) || "project";
    return MVP_PARTNER_THREAD_KINDS.has(kind);
  }

  function resolveThreadNotifyPage(projectOrKind) {
    return usesMvpPartnerThread(projectOrKind) ? "mvp-thread" : "board-thread";
  }

  global.TasuBuilderBoardFeed = {
    DEMO_JOB_ID,
    DEMO_WORKER_ID,
    TYPE_CONFIG,
    TYPE_TABS,
    resolveBoardType,
    matchesBoardTabFilter,
    resolveProjectCategoryLabel,
    resolveProjectBadgeLabel,
    isBoardFeedProject,
    getTypeConfig,
    resolveThreadKind,
    filterBoardFeed,
    ensureBoardFeedListings,
    boardDetailHref,
    boardTypeFromUrl,
    listingToSpec,
    buildListingProject,
    usesMvpPartnerThread,
    resolveThreadNotifyPage,
    MVP_PARTNER_THREAD_KINDS,
  };
})(typeof window !== "undefined" ? window : globalThis);
