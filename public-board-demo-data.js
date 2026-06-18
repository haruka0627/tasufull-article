/**
 * public-board レビュー用デモ記事（案件5件 + 求人5件）
 */
(function () {
  "use strict";

  const MVP_KEY = "tasful:builder:mvp:v1";

  const IMG = {
    cross: "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=640&h=480&q=80",
    roof: "https://images.unsplash.com/photo-1632778149395-631e592f65af?auto=format&fit=crop&w=640&h=480&q=80",
    wall: "https://images.unsplash.com/photo-1504307651254-39680f356d36?auto=format&fit=crop&w=640&h=480&q=80",
    cleaning: "https://images.unsplash.com/photo-1581578731548-862527f9c5c?auto=format&fit=crop&w=640&h=480&q=82",
    ac: "https://images.unsplash.com/photo-1631540575784-3e5d2a3e0a0a?auto=format&fit=crop&w=640&h=480&q=80",
    painter: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=640&h=480&q=80",
    electrician: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=640&h=480&q=80",
  };

  const PROJECT_ID_ALIASES = Object.freeze({
    "pub-board-project-001": "pub-board-proj-001",
  });

  const PROJECTS = [
    {
      project_id: "pub-board-proj-001",
      title: "【世田谷区】マンション内装 クロス張替え案件",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-06-01T09:00:00+09:00",
      required_partners: 2,
      selected_partner_ids: [],
    },
    {
      project_id: "pub-board-proj-002",
      title: "【横浜市】戸建て 屋根塗装案件（足場あり）",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-06-02T10:30:00+09:00",
      required_partners: 1,
      selected_partner_ids: [],
    },
    {
      project_id: "pub-board-proj-003",
      title: "【さいたま市】集合住宅 外壁塗装案件",
      kind: "builder_board",
      status: "open",
      visibility: "partner_only",
      created_at: "2026-06-03T11:00:00+09:00",
      required_partners: 2,
      selected_partner_ids: [],
    },
    {
      project_id: "pub-board-proj-004",
      title: "【千葉市】新築戸建て ハウスクリーニング案件",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-06-04T08:15:00+09:00",
      required_partners: 3,
      selected_partner_ids: [],
    },
    {
      project_id: "pub-board-proj-005",
      title: "【品川区】オフィスビル エアコン取付案件",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-06-05T14:00:00+09:00",
      required_partners: 2,
      selected_partner_ids: [],
    },
  ];

  const SPECS = {
    "pub-board-proj-001": {
      area: { label: "東京都世田谷区" },
      period: { start: "2026-06-15", end: "2026-06-28" },
      reward: "¥420,000",
      trade_tags: ["内装", "クロス"],
      thumbnail: IMG.cross,
      overview:
        "築15年マンション3室のクロス張替え案件です。下地補修を含む標準仕様で、現場キー受け渡し済み。",
      work_content:
        "・既存クロスの剥がし・下地補修\n・新規クロス張り（量産品）\n・養生・清掃・完了写真提出",
      preferred_conditions: "内装クロス施工の実績2年以上。近隣配慮・安全管理に慣れている方。",
      notes: "作業時間帯 9:00〜18:00。駐車場1台確保済み。",
      attachments: [{ name: "現場写真.pdf", type: "pdf" }],
    },
    "pub-board-proj-002": {
      area: { label: "神奈川県横浜市" },
      period: { start: "2026-07-01", end: "2026-07-20" },
      budget: { min: 850000, max: 1100000 },
      trade_tags: ["塗装", "屋根"],
      thumbnail: IMG.roof,
      overview: "瓦屋根の高圧洗浄・下塗り・上塗りまでの一式案件。足場は発注者手配済み。",
      work_content:
        "・高圧洗浄\n・シーリング打ち替え\n・下塗り・中塗り・上塗り（フッ素2回）\n・完工報告書作成",
      preferred_conditions: "屋根塗装の施工実績必須。暑さ対策・安全帯使用を徹底できる方。",
      notes: "雨天時は翌営業日に順延。廃材処分は業者手配。",
      attachments: [{ name: "屋根図面.pdf", type: "pdf" }],
    },
    "pub-board-proj-003": {
      area: { label: "埼玉県さいたま市" },
      period: { start: "2026-06-20", end: "2026-08-10" },
      reward: "¥2,800,000",
      trade_tags: ["外壁", "塗装"],
      thumbnail: IMG.wall,
      overview: "5階建集合住宅の外壁塗装（シリコン2回）案件。高所作業・交通誘導あり。",
      work_content:
        "・高圧洗浄・養生\n・下地補修・シーリング\n・外壁塗装2回\n・検査立会い対応",
      preferred_conditions: "外壁塗装の現場監督経験者歓迎。足場会社との連携経験があると尚可。",
      notes: "週末作業なし。近隣説明済み。",
      attachments: [],
    },
    "pub-board-proj-004": {
      area: { label: "千葉県千葉市" },
      period: { start: "2026-06-12", end: "2026-06-18" },
      reward: "¥180,000",
      trade_tags: ["清掃", "内装"],
      thumbnail: IMG.cleaning,
      overview: "新築戸建て引渡し前のハウスクリーニング。床・窓・キッチン・浴室の仕上げ清掃。",
      work_content:
        "・床ワックス・窓拭き\n・キッチン・浴室の仕上げ清掃\n・建具・棚のホコリ除去\n・引渡し前チェックリスト対応",
      preferred_conditions: "ハウスクリーニング経験者優遇。車通勤可（現場駐車2台）。",
      notes: "清掃用具・薬剤は業者持込。",
      attachments: [{ name: "間取り図.jpg", type: "image", url: IMG.cleaning }],
    },
    "pub-board-proj-005": {
      area: { label: "東京都品川区" },
      period: { start: "2026-06-25", end: "2026-07-05" },
      budget: { min: 320000, max: 480000 },
      trade_tags: ["電気", "設備"],
      thumbnail: IMG.ac,
      overview: "オフィスフロア10台の業務用エアコン取付・配管・試運転調整案件。",
      work_content:
        "・既存機撤去・新規機設置\n・配管・ドレン工事\n・試運転・温度調整\n・完了報告",
      preferred_conditions: "第二種電工・冷媒フロン類取扱技術者歓迎。",
      notes: "夜間作業なし。ビル管理会社立会いあり。",
      attachments: [],
    },
  };

  const JOB_IDS = [
    "pub-board-job-001",
    "pub-board-job-002",
    "pub-board-job-003",
    "pub-board-job-004",
    "pub-board-job-005",
  ];

  function seedMvpState() {
    try {
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem(MVP_KEY) || "{}");
      } catch {
        state = {};
      }
      const existing = (state.projects || []).filter(
        (p) => !String(p.project_id || "").startsWith("pub-board-proj-")
      );
      state.projects = [...PROJECTS, ...existing.filter((p) => p.kind === "builder_board")];
      state.specs = { ...(state.specs || {}), ...SPECS };
      localStorage.setItem(MVP_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.TasuPublicBoardDemo = {
    MVP_KEY,
    PROJECTS,
    SPECS,
    JOB_IDS,
    IMAGES: IMG,
    seedMvpState,
    resolveProjectId(projectId) {
      const raw = String(projectId || "").trim();
      return PROJECT_ID_ALIASES[raw] || raw;
    },
    getProject(projectId) {
      const canonicalId = PROJECT_ID_ALIASES[String(projectId || "").trim()] || String(projectId || "").trim();
      const project = PROJECTS.find((p) => p.project_id === canonicalId);
      if (!project) return null;
      return { project, spec: SPECS[canonicalId] || {} };
    },
  };

  if (typeof document !== "undefined") {
    const page = document.body?.dataset?.page || "";
    if (page === "public-board" || page === "public-board-detail") {
      seedMvpState();
    }
  }
})();
