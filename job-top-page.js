/**
 * 求人専用TOP — データ取得・絞り込み・描画
 */
(function () {
  "use strict";

  const PAGE_SIZE = 8;

  const POPULAR_TAGS = [
    "軽作業",
    "ドライバー",
    "建設",
    "現場作業",
    "施工管理",
    "清掃",
    "配送",
    "警備",
    "飲食",
    "イベント",
    "事務",
    "Web制作",
  ];

  const JOB_INDUSTRY_OPTIONS = [
    "建設",
    "土木",
    "解体",
    "設備",
    "電気工事",
    "内装",
    "施工管理",
    "現場作業",
    "警備",
    "清掃",
    "配送",
    "ドライバー",
    "倉庫",
    "物流",
    "軽作業",
    "製造",
    "工場",
    "飲食",
    "接客",
    "販売",
    "店舗スタッフ",
    "イベント",
    "引越し",
    "農業",
    "介護",
    "福祉",
    "医療補助",
    "美容",
    "サロン",
    "事務",
    "営業",
    "コールセンター",
    "Web制作",
    "動画編集",
    "デザイン",
    "SNS運用",
    "AI関連",
    "IT",
    "エンジニア",
    "ライター",
    "教育",
    "講師",
    "その他",
  ];

  /** 職種/業種フィルター用キーワード（部分一致） */
  const JOB_TYPE_MATCH_RULES = {
    建設: ["建設", "工事", "施工", "建築", "リフォーム", "土木", "解体", "設備", "電気", "内装", "施工管理", "現場"],
    土木: ["土木", "土工", "造成", "舗装", "基礎"],
    解体: ["解体", "アスベスト除去"],
    設備: ["設備", "空調", "給排水", "配管", "hvac"],
    電気工事: ["電気工事", "電気", "配線", "弱電", "照明"],
    内装: ["内装", "インテリア", "クロス", "床工事"],
    施工管理: ["施工管理", "現場監督", "監理", "ゼネコン"],
    現場作業: ["現場作業", "現場作業員", "作業員", "土木作業", "建設作業"],
    警備: ["警備", "セキュリティ", "交通誘導", "施設警備"],
    清掃: ["清掃", "クリーニング", "掃除", "ハウスクリーニング", "ビル清掃"],
    配送: ["配送", "配達", "デリバリー", "宅配", "ラストワン"],
    ドライバー: ["ドライバー", "運転", "運転手", "タクシー", "トラック", "軽貨物"],
    倉庫: ["倉庫", "入出庫", "ピッキング", "仕分け", "梱包"],
    物流: ["物流", "ロジスティクス", "3pl", "倉庫"],
    軽作業: ["軽作業", "軽作", "単純作業", "ピッキング"],
    製造: ["製造", "生産", "組立", "ライン作業"],
    工場: ["工場", "製造ライン", "組立"],
    飲食: ["飲食", "厨房", "調理", "ホール", "カフェ", "レストラン", "居酒屋"],
    接客: ["接客", "販売接客", "ホール", "レジ"],
    販売: ["販売", "セールス", "店頭", "アパレル"],
    店舗スタッフ: ["店舗", "店舗スタッフ", "コンビニ", "スーパー", "レジ"],
    イベント: ["イベント", "イベントスタッフ", "会場", "設営", "撤去"],
    引越し: ["引越", "引越し", "搬出", "搬入"],
    農業: ["農業", "農作", "収穫", "果樹", "畜産"],
    介護: ["介護", "介護士", "ヘルパー", "訪問介護", "デイサービス"],
    福祉: ["福祉", "障害", "支援員", "生活支援"],
    医療補助: ["医療", "看護補助", "病院", "クリニック", "受付"],
    美容: ["美容", "エステ", "ネイル", "まつげ"],
    サロン: ["サロン", "美容室", "理容", "ヘア"],
    事務: ["事務", "一般事務", "データ入力", "経理補助", "オフィス"],
    営業: ["営業", "ルート営業", "法人営業", "反響営業"],
    コールセンター: ["コールセンター", "テレオペ", "受電", "架電"],
    Web制作: ["web制作", "web", "ホームページ", "wordpress", "フロントエンド"],
    動画編集: ["動画編集", "動画", "youtube", "映像", "premiere"],
    デザイン: ["デザイン", "グラフィック", "illustrator", "photoshop", "ui"],
    SNS運用: ["sns", "sns運用", "instagram", "tiktok", "運用代行"],
    AI関連: ["ai", "人工知能", "chatgpt", "生成ai", "プロンプト"],
    IT: ["it", "情報システム", "インフラ", "サーバー", "ヘルプデスク"],
    エンジニア: ["エンジニア", "開発", "プログラマ", "バックエンド", "react"],
    ライター: ["ライター", "記事作成", "コンテンツ", "編集"],
    教育: ["教育", "塾", "スクール", "講師"],
    講師: ["講師", "インストラクター", "トレーナー", "指導"],
    その他: [],
  };

  /** タブ・親カテゴリへの関連付け */
  const INDUSTRY_PARENT_LABELS = {
    土木: ["建設"],
    解体: ["建設"],
    設備: ["建設"],
    電気工事: ["建設"],
    内装: ["建設"],
    施工管理: ["建設"],
    現場作業: ["建設"],
    倉庫: ["配送", "物流"],
    物流: ["配送"],
    動画編集: ["クリエイティブ"],
    Web制作: ["クリエイティブ", "IT"],
    デザイン: ["クリエイティブ"],
    SNS運用: ["クリエイティブ"],
    AI関連: ["IT"],
    エンジニア: ["IT"],
    接客: ["飲食", "販売"],
    店舗スタッフ: ["販売"],
    工場: ["製造"],
    医療補助: ["介護", "福祉"],
    サロン: ["美容"],
    コールセンター: ["事務"],
    ライター: ["クリエイティブ"],
    講師: ["教育"],
  };

  const EMPLOYMENT_OPTIONS = [
    "正社員",
    "契約社員",
    "業務委託",
    "アルバイト",
    "パート",
    "派遣",
    "短期",
    "単発",
    "インターン",
    "その他",
  ];

  /** 雇用形態フィルター用（業種とは別） */
  const EMPLOYMENT_MATCH_RULES = {
    正社員: ["正社員", "fulltime", "フルタイム", "常勤", "正規雇用"],
    契約社員: ["契約社員", "契約", "有期雇用", "契約社員"],
    業務委託: ["業務委託", "委託", "フリーランス", "freelance", "請負"],
    アルバイト: ["アルバイト", "バイト", "アルバイト・パート", "parttime", "part-time"],
    パート: ["パート", "パートタイム", "アルバイト・パート", "非常勤"],
    派遣: ["派遣", "人材派遣", "派遣社員"],
    短期: ["短期", "短期間", "期間限定", "短期アルバイト"],
    単発: ["単発", "1日", "日雇い", "スポット", "日払い"],
    インターン: ["インターン", "インターンシップ", "実習", "インターン生"],
    その他: [],
  };

  const CATEGORY_TABS = [
    { key: "all", label: "すべて", match: [] },
    {
      key: "construction",
      label: "建設",
      match: ["建設", "土木", "解体", "設備", "電気", "内装", "施工管理", "現場"],
    },
    { key: "delivery", label: "配送", match: ["配送", "物流", "倉庫", "配達", "デリバリー"] },
    { key: "driver", label: "ドライバー", match: ["ドライバー", "運転", "タクシー", "軽貨物", "トラック"] },
    { key: "light_work", label: "軽作業", match: ["軽作業", "ピッキング", "仕分け", "梱包"] },
    { key: "cleaning", label: "清掃", match: ["清掃", "クリーニング", "掃除"] },
    { key: "security", label: "警備", match: ["警備", "セキュリティ", "交通誘導"] },
    { key: "food", label: "飲食", match: ["飲食", "厨房", "調理", "ホール", "カフェ", "レストラン"] },
    { key: "retail", label: "販売", match: ["販売", "店舗", "接客", "レジ", "コンビニ"] },
    { key: "office", label: "事務", match: ["事務", "一般事務", "データ入力", "経理"] },
    {
      key: "creative",
      label: "クリエイティブ",
      match: ["クリエイティブ", "動画", "web", "デザイン", "sns", "ライター"],
    },
    { key: "it", label: "IT", match: ["it", "エンジニア", "開発", "ai", "プログラ", "インフラ"] },
    { key: "event", label: "イベント", match: ["イベント", "会場", "設営"] },
    { key: "other", label: "その他", match: [] },
  ];

  /** 審査・非表示対象（違法・グレー・高リスク） */
  const BLOCKED_JOB_PATTERNS = [
    /アダルト|風俗|デリヘル|ソープ|キャバクラ|ホストクラブ|夜ワーク|ナイトワーク/i,
    /闇バイト|闇アルバイト|闇仕事|犯罪/i,
    /名義貸し|名義譲渡|口座売買|口座買取|口座譲渡/i,
    /携帯契約代行|回線契約代行|sim契約代行/i,
    /違法配送|無許可運送|薬物|違法物/i,
    /高額即金.*(不透明|保証|確実|必ず)/i,
    /即日現金.*(高額|100万|50万)/i,
    /タワマン|タワーマンション.*(転売|名義)/i,
  ];

  /** 求人UI確認用 — listing-demo-catalog.js と同一IDのみ */
  const CANONICAL_JOB_DEMO_IDS = Object.freeze([
    "job_demo_full_001",
    "job_demo_full_002",
    "job_demo_full_003",
    "job_demo_full_004",
  ]);

  function getCanonicalDemoJobRows() {
    const catalog = window.TasuListingDemoCatalog;
    const rows = [];
    const now = Date.now();

    CANONICAL_JOB_DEMO_IDS.forEach((id, index) => {
      const row = catalog?.getStoreListing?.(id);
      if (!row) return;
      rows.push({
        ...row,
        listing_type: row.listing_type || "job",
        publish_status: row.publish_status || "public",
        updated_at:
          row.updated_at || new Date(now - index * 3600000).toISOString(),
        is_featured: id === "job_demo_full_001",
      });
    });

    return rows;
  }

  function mapCanonicalDemoRows(rows) {
    const store = window.TasuListingStore;
    return rows
      .map((row) =>
        store?.rowToListing
          ? store.rowToListing({ ...row, _source: "demo-catalog" })
          : row
      )
      .filter(isPublishedJob)
      .filter((listing) => {
        const Fields = window.TasuJobListingFields;
        const normalized = Fields?.normalizeJobListing
          ? Fields.normalizeJobListing(listing)
          : { title: listing.title, tags: [] };
        return !isBlockedJobListing(listing, normalized);
      });
  }

  function mergeCanonicalDemoJobsFirst(rows, canonical) {
    const canonicalIds = new Set(CANONICAL_JOB_DEMO_IDS);
    const rest = rows.filter((row) => !canonicalIds.has(row.id));
    return [...canonical, ...rest];
  }

  let allItems = [];
  let filteredItems = [];
  let currentPage = 1;
  let activeTab = "all";
  let prRotationTimer = null;
  let lastPrPickKey = "";
  const PR_ROTATE_MS = 10000;
  const PR_SLOT_MAX = 3;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function isPublishedJob(listing) {
    if (!listing || listing.listing_type !== "job") return false;
    const status = String(listing.publish_status || listing.status || "public").toLowerCase();
    if (status === "draft" || status === "scheduled") return false;
    return true;
  }

  function formatDateLabel(raw) {
    if (!raw) return "";
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}/${m}/${day}`;
    } catch {
      return "";
    }
  }

  function formatRelativeTime(raw) {
    if (!raw) return "";
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "";
      const diffMs = Date.now() - d.getTime();
      if (diffMs < 0) return "たった今";
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "たった今";
      if (mins < 60) return `${mins}分前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}時間前`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}日前`;
      if (days < 30) return `${Math.floor(days / 7)}週間前`;
      return "";
    } catch {
      return "";
    }
  }

  function companyInitials(name) {
    const s = String(name || "")
      .trim()
      .replace(/株式会社|有限会社|合同会社/g, "")
      .trim();
    if (!s) return "JO";
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (s.length >= 2) return s.slice(0, 2);
    return s.slice(0, 1).toUpperCase();
  }

  function buildSearchHaystack(listing, normalized) {
    const tagList = normalized.tags || [];
    return [
      normalized.title,
      normalized.description,
      normalized.category,
      normalized.subcategory,
      normalized.location,
      normalized.employmentType,
      normalized.workStyle,
      tagList.join(" "),
      listing.company_name,
      listing.description,
      listing.employment_type,
      listing.work_style,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function isBlockedJobListing(listing, normalized) {
    const hay = buildSearchHaystack(listing, normalized || { tags: [] });
    return BLOCKED_JOB_PATTERNS.some((re) => re.test(hay));
  }

  function inferCategoryLabels(listing, normalized) {
    const hay = buildSearchHaystack(listing, normalized);
    const labels = new Set();

    [normalized.category, normalized.subcategory, listing.category, listing.subcategory]
      .filter(Boolean)
      .forEach((v) => labels.add(String(v).trim()));

    JOB_INDUSTRY_OPTIONS.forEach((label) => {
      if (label === "その他") return;
      const keys = JOB_TYPE_MATCH_RULES[label] || [label];
      if (keys.some((k) => hay.includes(String(k).toLowerCase()))) {
        labels.add(label);
      }
    });

    labels.forEach((label) => {
      (INDUSTRY_PARENT_LABELS[label] || []).forEach((parent) => labels.add(parent));
    });

    if (!labels.size) labels.add("その他");
    return Array.from(labels);
  }

  function inferEmploymentLabel(listing, normalized) {
    const hay = buildSearchHaystack(listing, normalized);
    const raw = String(
      normalized.employmentType || listing.employment_type || ""
    ).trim();

    if (raw) {
      if (/アルバイト・パート|パート・アルバイト/i.test(raw)) return raw;
      for (const label of EMPLOYMENT_OPTIONS) {
        if (label === "その他") continue;
        if (raw.includes(label)) return label;
      }
      return raw;
    }

    for (const label of EMPLOYMENT_OPTIONS) {
      if (label === "その他") continue;
      const keys = EMPLOYMENT_MATCH_RULES[label] || [label];
      if (keys.some((k) => hay.includes(String(k).toLowerCase()))) {
        return label;
      }
    }

    if (/業務委託|フリーランス|委託/i.test(hay)) return "業務委託";
    if (/派遣/i.test(hay)) return "派遣";
    if (/インターン/i.test(hay)) return "インターン";
    if (/単発|日雇い|1日/i.test(hay)) return "単発";
    if (/短期/i.test(hay)) return "短期";
    if (/アルバイト|バイト/i.test(hay)) return "アルバイト";
    if (/パート/i.test(hay)) return "パート";
    if (/正社員|常勤/i.test(hay)) return "正社員";
    if (/契約社員|契約/i.test(hay)) return "契約社員";

    return "";
  }

  function matchesEmployment(item, employment) {
    if (!employment) return true;
    if (employment === "その他") {
      const others = EMPLOYMENT_OPTIONS.filter((l) => l !== "その他");
      return !others.some((label) => matchesEmployment(item, label));
    }

    const hay = item.searchHaystack || "";
    const label = String(item.employmentDisplayLabel || item.employmentType || "").toLowerCase();
    const et = employment.toLowerCase();

    if (label === et || label.includes(et)) return true;
    if (hay.includes(et)) return true;

    if (employment === "アルバイト" && /アルバイト・パート|パート・アルバイト/.test(label)) {
      return true;
    }
    if (employment === "パート" && /アルバイト・パート|パート・アルバイト/.test(label)) {
      return true;
    }

    const keys = EMPLOYMENT_MATCH_RULES[employment];
    if (keys && keys.length) {
      return keys.some((k) => hay.includes(String(k).toLowerCase()));
    }

    return false;
  }

  function matchesJobType(item, jobType) {
    if (!jobType) return true;
    if (jobType === "その他") {
      const others = JOB_INDUSTRY_OPTIONS.filter((l) => l !== "その他");
      return !others.some((label) => matchesJobType(item, label));
    }
    const jt = jobType.toLowerCase();
    const hay = item.searchHaystack || "";
    const labels = (item.categoryLabels || []).map((l) => l.toLowerCase());

    if (labels.includes(jt)) return true;
    if (String(item.category || "").toLowerCase() === jt) return true;
    if (String(item.industryLabel || "").toLowerCase() === jt) return true;
    if (hay.includes(jt)) return true;

    const keys = JOB_TYPE_MATCH_RULES[jobType];
    if (keys && keys.length) {
      return keys.some((k) => {
        const kw = String(k).toLowerCase();
        return hay.includes(kw) || labels.some((l) => l.includes(kw));
      });
    }

    return false;
  }

  function resolveIndustryLabel(normalized, listing, categoryLabels) {
    const labels = categoryLabels || [];
    if (labels.length && labels[0] !== "その他") {
      return labels.find((l) => l !== "その他") || labels[0];
    }
    return (
      normalized.subcategory ||
      normalized.category ||
      listing.subcategory ||
      listing.category ||
      "その他"
    );
  }

  function parseLocationParts(location) {
    const text = String(location || "").trim();
    if (!text) return { pref: "", city: "", station: "" };

    const prefMatch = text.match(/^(北海道|.{2,3}[都府県])/);
    const pref = prefMatch ? prefMatch[1] : "";

    let rest = text;
    if (pref) rest = rest.slice(pref.length).replace(/^[・\s/]+/, "");

    const stationMatch = rest.match(/(?:最寄[り]?[：:]?\s*)?([^/・]+駅)/);
    const station = stationMatch ? stationMatch[1].trim() : "";

    let city = rest;
    if (station) {
      city = city.replace(station, "").replace(/最寄[り]?[：:]?/g, "").replace(/[・/]/g, " ").trim();
    }
    city = city.split(/[・/]/)[0].trim();

    return { pref, city, station };
  }

  function resolvePeriodLabel(listing, normalized) {
    const explicit = String(listing.job_period || "").trim();
    if (explicit) return explicit;

    const hay = [
      normalized.contractTerms,
      normalized.workStyle,
      (normalized.tags || []).join(" "),
      listing.description,
    ]
      .join(" ")
      .toLowerCase();

    if (/単発|スポット|1日/.test(hay)) return "単発";
    if (/3ヶ月契約/.test(hay)) return "3ヶ月契約〜";
    if (/3ヶ月/.test(hay)) return "3ヶ月〜";
    if (/短期|数ヶ月/.test(hay)) return "短期";
    if (/長期|正社員|無期/.test(hay)) return "長期";
    if (/アルバイト|パート/.test(hay)) return "パート・アルバイト";
    return normalized.employmentType || "要相談";
  }

  function resolveStatus(listing, normalized) {
    const tags = (normalized.tags || []).join(" ");
    const hay = `${tags} ${listing.description || ""} ${normalized.title || ""}`;

    if (/募集終了|終了|締切済|closed/i.test(hay)) {
      return { key: "closed", label: "募集終了" };
    }
    if (/急募/.test(hay)) {
      return { key: "urgent", label: "急募" };
    }
    if (/すぐ開始|即日|すぐに働ける|即戦力/.test(hay)) {
      return { key: "soon", label: "すぐ開始" };
    }
    return { key: "open", label: "募集中" };
  }

  function isFeaturedUntilValid(listing) {
    const untilRaw = listing.featured_until || listing.featuredUntil;
    if (!untilRaw) return true;
    const until = new Date(untilRaw).getTime();
    if (Number.isNaN(until)) return true;
    return until > Date.now();
  }

  /** 上位掲載（PR枠・一覧上部のゴールド行） */
  function isFeaturedPromotion(listing) {
    if (!listing || listing.listing_type !== "job") return false;
    if (!isPublishedJob(listing)) return false;
    if (!isFeaturedUntilValid(listing)) return false;

    const flagged = Boolean(listing.is_featured || listing.isFeatured);
    const plan = String(listing.featured_plan || listing.featuredPlan || "").trim();
    const promo = String(
      listing.promotion_status || listing.promotionStatus || ""
    )
      .trim()
      .toLowerCase();
    const ftype = String(listing.featured_type || listing.featuredType || "")
      .trim()
      .toLowerCase();

    if (promo === "active" && (flagged || plan || ftype === "top" || ftype === "pr")) {
      return true;
    }
    if ((ftype === "top" || ftype === "pr") && (flagged || plan)) return true;
    if (flagged) return true;
    if (plan) return true;

    return false;
  }

  function isSpotlight(listing, status) {
    if (isFeaturedPromotion(listing)) return true;
    if (status.key === "urgent") return true;
    return false;
  }

  function normalizeBoardItem(listing) {
    const Fields = window.TasuJobListingFields;
    const normalized = Fields?.normalizeJobListing
      ? Fields.normalizeJobListing(listing)
      : { raw: listing, title: listing.title, tags: [] };

    const location = normalized.location || "";
    const loc = parseLocationParts(location);
    const status = resolveStatus(listing, normalized);
    const salaryTypeLabel =
      Fields?.formatSalaryTypeLabel?.(normalized.salaryType) ||
      normalized.salaryType ||
      "";

    const featureTags = [];
    const tagList = normalized.tags || [];
    tagList.slice(0, 6).forEach((t) => featureTags.push(t));
    if (status.key === "urgent" && !featureTags.includes("急募")) featureTags.unshift("急募");
    const employmentDisplayLabel = inferEmploymentLabel(listing, normalized);
    if (
      employmentDisplayLabel &&
      !featureTags.includes(employmentDisplayLabel)
    ) {
      featureTags.push(employmentDisplayLabel);
    }

    const req = normalized.applicationRequirements || normalized.requiredSkills || "";
    const requirementsShort =
      req.length > 56 ? `${req.slice(0, 56)}…` : req || "—";
    const updatedRaw = listing.updated_at || listing.created_at;
    const categoryLabels = inferCategoryLabels(listing, normalized);
    const searchHaystack = buildSearchHaystack(listing, normalized);

    return {
      id: listing.id,
      title: normalized.title || "求人タイトル未設定",
      companyName: normalized.seller?.companyName || listing.company_name || "",
      avatarInitials: companyInitials(
        normalized.seller?.companyName || listing.company_name
      ),
      thumbnail: normalized.thumbnail || normalized.image || "",
      industryLabel: resolveIndustryLabel(normalized, listing, categoryLabels),
      categoryLabels,
      location,
      areaPref: loc.pref,
      areaCity: loc.city,
      areaStation: loc.station,
      category: normalized.category || listing.category || "",
      subcategory: normalized.subcategory || "",
      employmentType: normalized.employmentType || listing.employment_type || "",
      employmentDisplayLabel,
      salaryTypeLabel,
      salaryDisplay: normalized.price?.text || "応相談",
      workingHours: normalized.workingHours || "",
      workStyle: normalized.workStyle || "",
      periodLabel: resolvePeriodLabel(listing, normalized),
      deadlineLabel:
        String(
          listing.application_deadline ||
            listing.job_application_deadline ||
            ""
        ).trim() || "随時",
      requirementsShort,
      featureTags: featureTags.slice(0, 5),
      tags: tagList,
      statusKey: status.key,
      statusLabel: status.label,
      updatedLabel: formatDateLabel(updatedRaw),
      updatedRelative: formatRelativeTime(updatedRaw),
      isSpotlight: isSpotlight(listing, status),
      isFeaturedPromotion: isFeaturedPromotion(listing),
      searchHaystack,
      boardType: "job",
      raw: listing,
    };
  }

  function readFilterState() {
    const topForm = $("[data-job-top-search-form]");
    const sideForm = $("[data-job-top-filter-form]");
    const topFd = topForm ? new FormData(topForm) : new FormData();
    const sideFd = sideForm ? new FormData(sideForm) : new FormData();

    return {
      keyword: String(topFd.get("keyword") || sideFd.get("keyword") || "").trim(),
      jobType: String(topFd.get("job_type") || sideFd.get("job_type") || "").trim(),
      area: String(topFd.get("area") || sideFd.get("area") || "").trim(),
      salary: String(topFd.get("salary") || sideFd.get("salary") || "").trim(),
      employment: String(topFd.get("employment") || sideFd.get("employment") || "").trim(),
      period: String(sideFd.get("period") || "").trim(),
      recruitment: String(sideFd.get("recruitment") || "").trim(),
      condUrgent: sideFd.get("cond_urgent") === "on",
      condSoon: sideFd.get("cond_soon") === "on",
      condLicense: sideFd.get("cond_license") === "on",
    };
  }

  function matchesTab(item, tabKey) {
    if (isPublicBoardMode()) {
      if (tabKey === "all") return true;
      if (tabKey === "project") return item.boardType === "project";
      if (tabKey === "job") return item.boardType === "job";
      return true;
    }
    if (tabKey === "all") return true;
    const tab = CATEGORY_TABS.find((t) => t.key === tabKey);
    if (!tab) return true;
    if (tabKey === "other") {
      const known = CATEGORY_TABS.filter((t) => t.key !== "all" && t.key !== "other");
      return !known.some((t) => matchesTab(item, t.key));
    }
    const hay = item.searchHaystack;
    const labelHay = [
      item.category,
      item.subcategory,
      ...(item.categoryLabels || []),
      ...(item.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    return (tab.match || []).some(
      (m) => hay.includes(m.toLowerCase()) || labelHay.includes(m.toLowerCase())
    );
  }

  function matchesFilters(item, state) {
    if (state.keyword) {
      const kw = state.keyword.toLowerCase();
      if (!item.searchHaystack.includes(kw)) return false;
    }
    if (state.jobType && !matchesJobType(item, state.jobType)) return false;
    if (state.area) {
      const area = state.area.toLowerCase();
      if (!item.searchHaystack.includes(area) && !item.location.toLowerCase().includes(area)) {
        return false;
      }
    }
    if (state.salary) {
      const sal = state.salary.toLowerCase();
      if (!item.searchHaystack.includes(sal) && !item.salaryDisplay.toLowerCase().includes(sal)) {
        return false;
      }
    }
    if (state.employment && !matchesEmployment(item, state.employment)) return false;

    if (state.period) {
      const p = state.period.toLowerCase();
      if (!item.periodLabel.toLowerCase().includes(p) && !item.searchHaystack.includes(p)) {
        return false;
      }
    }

    if (state.recruitment) {
      if (state.recruitment === "open" && item.statusKey !== "open") return false;
      if (state.recruitment === "urgent" && item.statusKey !== "urgent") return false;
      if (state.recruitment === "soon" && item.statusKey !== "soon") return false;
      if (state.recruitment === "closed" && item.statusKey !== "closed") return false;
    }

    const hay = item.searchHaystack;
    if (state.condUrgent && item.statusKey !== "urgent" && !hay.includes("急募")) return false;
    if (state.condSoon && item.statusKey !== "soon" && !/すぐ開始|即日/.test(hay)) return false;
    if (state.condLicense && !/資格|免許|資格必須|資格必要/.test(hay)) return false;

    return true;
  }

  function applyFilters(items, state, tabKey) {
    return items.filter((item) => matchesTab(item, tabKey) && matchesFilters(item, state));
  }

  function orderRows(items) {
    const featured = [];
    const urgent = [];
    const regular = [];
    items.forEach((item) => {
      if (item.isFeaturedPromotion) featured.push(item);
      else if (item.statusKey === "urgent") urgent.push(item);
      else regular.push(item);
    });
    return [...featured, ...urgent, ...regular];
  }

  function getFeaturedPrPool() {
    return allItems.filter((item) => item.isFeaturedPromotion);
  }

  function pickRandomFeaturedJobs(pool, count, avoidKey) {
    const n = Math.min(count, pool.length);
    if (!n) return [];
    let picked = [];
    let attempts = 0;
    while (attempts < 12) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      picked = shuffled.slice(0, n);
      const key = picked
        .map((p) => p.id)
        .sort()
        .join(",");
      if (key !== avoidKey || pool.length <= n) break;
      attempts += 1;
    }
    return picked;
  }

  function renderFeaturedPrJobs(items) {
    const section = $("[data-job-top-pr-section]");
    const grid = $("[data-job-top-pr-grid]");
    const renderer = window.TasuJobTopRenderer;
    if (isPublicProjectsMode() || isPublicBoardMode()) {
      if (section) section.hidden = true;
      return;
    }
    if (!section || !grid) return;

    if (!items.length) {
      section.hidden = true;
      grid.innerHTML = "";
      return;
    }

    section.hidden = false;
    if (!renderer?.buildPrCardElement) return;

    const doSwap = () => {
      grid.innerHTML = "";
      const frag = document.createDocumentFragment();
      items.forEach((item) => frag.appendChild(renderer.buildPrCardElement(item)));
      grid.appendChild(frag);
      syncFavorites(section);
    };

    // 初回は即表示、2回目以降はフェード
    if (!grid.dataset.prRenderedOnce) {
      grid.dataset.prRenderedOnce = "1";
      doSwap();
      return;
    }

    grid.classList.add("is-fade-out");
    window.setTimeout(() => {
      doSwap();
      // 次フレームで戻す（自然なフェードイン）
      window.requestAnimationFrame(() => {
        grid.classList.remove("is-fade-out");
      });
    }, 280);
  }

  function rotateFeaturedPrJobs() {
    const pool = getFeaturedPrPool();
    if (!pool.length) {
      renderFeaturedPrJobs([]);
      return;
    }
    const picked = pickRandomFeaturedJobs(pool, PR_SLOT_MAX, lastPrPickKey);
    lastPrPickKey = picked
      .map((p) => p.id)
      .sort()
      .join(",");
    renderFeaturedPrJobs(picked);
  }

  function startPrRotation() {
    stopPrRotation();
    rotateFeaturedPrJobs();
    const pool = getFeaturedPrPool();
    if (!pool.length) return;
    if (pool.length <= PR_SLOT_MAX) return;
    prRotationTimer = window.setInterval(rotateFeaturedPrJobs, PR_ROTATE_MS);
  }

  function stopPrRotation() {
    if (prRotationTimer) {
      window.clearInterval(prRotationTimer);
      prRotationTimer = null;
    }
  }

  async function fetchJobs() {
    const store = window.TasuListingStore;
    let rows = [];

    if (store?.fetchPublishedListings) {
      rows = await store.fetchPublishedListings({
        limit: 100,
        listing_type: "job",
        public_only: false,
        localFallback: true,
      });
    }

    rows = rows.filter(isPublishedJob);
    rows = rows.filter((listing) => {
      const Fields = window.TasuJobListingFields;
      const normalized = Fields?.normalizeJobListing
        ? Fields.normalizeJobListing(listing)
        : { title: listing.title, tags: [] };
      return !isBlockedJobListing(listing, normalized);
    });

    const canonical = mapCanonicalDemoRows(getCanonicalDemoJobRows());

    if (!rows.length && canonical.length) {
      rows = canonical;
    } else if (canonical.length) {
      rows = mergeCanonicalDemoJobsFirst(rows, canonical);
    }

    return rows.map(normalizeBoardItem);
  }

  const BUILDER_MVP_STORAGE_KEY = "tasful:builder:mvp:v1";

  const PUBLIC_PROJECT_FALLBACK = [
    {
      project_id: "demo-project-001",
      title: "新宿区 共同住宅 外装改修",
      kind: "builder_board",
      status: "open",
      visibility: "public",
      created_at: "2026-05-25T10:10:00+09:00",
      required_partners: 1,
      selected_partner_ids: [],
    },
    {
      project_id: "builder_demo_001",
      title: "店舗内装リニューアル（Builder）",
      kind: "builder_board",
      status: "open",
      visibility: "partner_only",
      created_at: "2026-06-06T00:00:00+09:00",
      required_partners: 1,
      selected_partner_ids: [],
    },
  ];

  const PUBLIC_PROJECT_SPEC_FALLBACK = {
    "demo-project-001": {
      area: { label: "東京都新宿区" },
      period: { start: "2026-06-10", end: "2026-06-30" },
      budget: { min: 600000, max: 900000 },
      trade_tags: ["足場", "建設"],
      overview: "共同住宅の外装改修に伴う足場工事の一般案件です。",
      work_content: "仮設足場の設計・施工・解体まで一括対応。",
    },
    builder_demo_001: {
      area: { label: "東京都渋谷区" },
      period: { start: "2026-06-10", end: "2026-06-28" },
      reward: "¥980,000",
      trade_tags: ["内装"],
      overview: "店舗内装リニューアル一式の協力会社募集。",
      work_content: "設計・施工・仕上げまでの内装工事。",
    },
  };

  function readBuilderMvpState() {
    try {
      const raw = localStorage.getItem(BUILDER_MVP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function formatPublicBudget(budget, reward) {
    if (reward) return String(reward);
    if (!budget || typeof budget !== "object") return "応相談";
    const max = Number(budget.max || budget.min || 0);
    if (!Number.isFinite(max) || max <= 0) return "応相談";
    if (max >= 10000) return `${Math.round(max / 10000).toLocaleString()}万円`;
    return `${max.toLocaleString()}円`;
  }

  function formatTradeLabel(tag) {
    const map = {
      scaffold: "足場",
      interior: "内装",
      carpenter: "大工",
      electrician: "電気",
    };
    const t = String(tag || "").trim();
    return map[t] || t;
  }

  function normalizePublicProjectItem(project, spec) {
    const trades = (spec?.trade_tags || spec?.trades || []).map(formatTradeLabel).filter(Boolean);
    const area = spec?.area?.label || spec?.area || "—";
    const period =
      spec?.period?.start && spec?.period?.end
        ? `${spec.period.start}〜${spec.period.end}`
        : "—";
    const tags = [...trades];
    if (!tags.includes("一般案件")) tags.unshift("一般案件");
    const hay = [
      project.title,
      spec?.overview,
      spec?.work_content,
      area,
      trades.join(" "),
      "業務委託",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      id: project.project_id,
      title: project.title || "案件",
      companyName: "TASFUL Builder",
      avatarInitials: companyInitials("TASFUL Builder"),
      thumbnail: spec?.thumbnail || spec?.image_url || "",
      industryLabel: trades[0] || "建設",
      categoryLabels: trades.length ? trades : ["建設"],
      location: area,
      areaPref: area.split(/[都道府県]/)[0] || area,
      areaCity: "",
      areaStation: "",
      category: trades[0] || "建設",
      subcategory: "",
      employmentType: "contract",
      employmentDisplayLabel: "業務委託",
      salaryTypeLabel: "報酬",
      salaryDisplay: formatPublicBudget(spec?.budget, spec?.reward),
      workingHours: "",
      workStyle: "",
      periodLabel: period,
      deadlineLabel: spec?.period?.end || "随時",
      requirementsShort: (spec?.overview || "").slice(0, 56) || "—",
      featureTags: tags.slice(0, 5),
      tags,
      statusKey: "open",
      statusLabel: "募集中",
      updatedLabel: formatDateLabel(project.created_at),
      updatedRelative: formatRelativeTime(project.created_at),
      isSpotlight: false,
      isFeaturedPromotion: false,
      searchHaystack: hay,
      boardType: "project",
      raw: { project, spec, kind: "builder_board" },
    };
  }

  function resolvePublicProjectSpecs(state) {
    const demo = window.TasuPublicBoardDemo;
    return {
      ...(demo?.SPECS || {}),
      ...PUBLIC_PROJECT_SPEC_FALLBACK,
      ...(state?.specs || {}),
    };
  }

  function resolvePublicProjectRecords(state) {
    const demo = window.TasuPublicBoardDemo;
    if (isPublicBoardMode() && demo?.PROJECTS?.length) {
      return demo.PROJECTS.slice();
    }
    let projects = (state.projects || []).filter(
      (p) => String(p.kind || "") === "builder_board"
    );
    if (!projects.length) {
      projects = (demo?.PROJECTS || PUBLIC_PROJECT_FALLBACK).slice();
    }
    return projects;
  }

  async function fetchPublicBoardDemoJobs() {
    const ids = window.TasuPublicBoardDemo?.JOB_IDS || [];
    const catalog = window.TasuListingDemoCatalog;
    const now = Date.now();
    const rows = ids
      .map((id, index) => {
        const row = catalog?.getStoreListing?.(id);
        if (!row) return null;
        return {
          ...row,
          listing_type: row.listing_type || "job",
          publish_status: row.publish_status || "public",
          updated_at: row.updated_at || new Date(now - index * 7200000).toISOString(),
        };
      })
      .filter(Boolean);
    return mapCanonicalDemoRows(rows).map(normalizeBoardItem);
  }

  function fetchPublicProjects() {
    const state = readBuilderMvpState();
    const specs = resolvePublicProjectSpecs(state);
    const projects = resolvePublicProjectRecords(state);
    return projects.map((p) => {
      const spec = specs[p.project_id] || {};
      return normalizePublicProjectItem(p, spec);
    });
  }

  const BOARD_TYPE_TABS = [
    { key: "all", label: "すべて", match: [] },
    { key: "project", label: "案件", match: [] },
    { key: "job", label: "求人", match: [] },
  ];

  function getTopPageMode() {
    return document.body?.dataset?.page || "job-top";
  }

  function isPublicBoardMode() {
    return getTopPageMode() === "public-board";
  }

  function isPublicProjectsMode() {
    return getTopPageMode() === "public-projects";
  }

  function isSupportedTopPage() {
    return ["job-top", "public-jobs", "public-projects", "public-board"].includes(getTopPageMode());
  }

  function itemSortTime(item) {
    const raw = item.raw || {};
    const ts =
      raw.project?.created_at ||
      raw.updated_at ||
      raw.created_at ||
      "";
    const n = new Date(ts).getTime();
    return Number.isFinite(n) ? n : 0;
  }

  async function fetchPublicBoardItems() {
    const projects = fetchPublicProjects();
    const jobs = await fetchPublicBoardDemoJobs();
    return [...projects, ...jobs].sort((a, b) => itemSortTime(b) - itemSortTime(a));
  }

  function syncFavorites(root) {
    const db = window.TasuFavoritesDb;
    if (!db?.isFavorite) return;
    root.querySelectorAll("[data-favorite-button][data-target-type='job']").forEach((btn) => {
      const id = btn.dataset.targetId;
      if (!id) return;
      void db.isFavorite("u_me", "job", id).then((saved) => {
        const filter = db.buildFilter("u_me", "job", id);
        db.syncFavoriteButtonsUi(filter, saved, btn);
      });
    });
  }

  function isMobileJobTopViewport() {
    try {
      return window.matchMedia("(max-width: 768px)").matches;
    } catch {
      return false;
    }
  }

  function renderPagination(totalPages) {
    const nav = $("[data-job-top-pagination]");
    if (!nav) return;
    nav.innerHTML = "";
    nav.classList.toggle(
      "job-top-pagination--mobile-load-more",
      isMobileJobTopViewport()
    );

    const pages = Math.max(1, totalPages);
    if (!filteredItems.length) return;

    if (isMobileJobTopViewport()) {
      if (currentPage < pages) {
        const loadMore = document.createElement("button");
        loadMore.type = "button";
        loadMore.className = "job-top-pagination__load-more";
        loadMore.textContent = "もっと見る";
        loadMore.addEventListener("click", () => {
          if (currentPage < pages) {
            currentPage += 1;
            renderBoard();
          }
        });
        nav.appendChild(loadMore);
      }
      return;
    }

    for (let p = 1; p <= pages; p += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(p);
      btn.classList.toggle("is-active", p === currentPage);
      btn.addEventListener("click", () => {
        currentPage = p;
        renderBoard();
        nav.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      nav.appendChild(btn);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "次へ";
    next.disabled = currentPage >= pages;
    next.addEventListener("click", () => {
      if (currentPage < pages) {
        currentPage += 1;
        renderBoard();
      }
    });
    nav.appendChild(next);

    const last = document.createElement("button");
    last.type = "button";
    last.textContent = "最終へ";
    last.disabled = currentPage >= pages;
    last.addEventListener("click", () => {
      currentPage = pages;
      renderBoard();
    });
    nav.appendChild(last);
  }

  function renderBoard() {
    const renderer = window.TasuJobTopRenderer;
    const tableBody = $("[data-job-list-body]");
    const mobileList = $("[data-job-list-mobile]");
    const emptyEl = $("[data-job-top-empty]");
    const countEl = $("[data-job-top-count]");
    const rangeEl = $("[data-job-top-range]");
    const sortSelect = $("[data-job-top-sort]");

    if (!renderer || !tableBody) return;

    const state = readFilterState();
    const sort = sortSelect?.value || "newest";

    filteredItems = applyFilters(allItems, state, activeTab);

    if (window.TasuListingRenderer?.sortListings) {
      const rawList = filteredItems.map((i) => i.raw);
      const sorted = window.TasuListingRenderer.sortListings(rawList, sort);
      const orderMap = new Map(sorted.map((r, idx) => [r.id, idx]));
      filteredItems.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = orderRows(filteredItems.slice(start, start + PAGE_SIZE));

    if (countEl) countEl.textContent = String(total);
    if (rangeEl) {
      if (!total) {
        rangeEl.textContent = "0件";
      } else if (isMobileJobTopViewport()) {
        const to = Math.min(currentPage * PAGE_SIZE, total);
        rangeEl.textContent = `1〜${to}件 / ${total}件`;
      } else {
        const from = start + 1;
        const to = Math.min(start + PAGE_SIZE, total);
        rangeEl.textContent = `${from}〜${to}件 / ${total}件`;
      }
    }

    if (!total) {
      tableBody.innerHTML = "";
      if (mobileList) mobileList.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      renderPagination(0);
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    tableBody.innerHTML = "";
    const frag = document.createDocumentFragment();
    pageItems.forEach((item) => frag.appendChild(renderer.buildTableRowElement(item)));
    tableBody.appendChild(frag);

    if (mobileList) {
      mobileList.innerHTML = "";
      const mfrag = document.createDocumentFragment();
      const mobileItems = isMobileJobTopViewport()
        ? orderRows(filteredItems.slice(0, currentPage * PAGE_SIZE))
        : pageItems;
      mobileItems.forEach((item) => mfrag.appendChild(renderer.buildMobileCardElement(item)));
      mobileList.appendChild(mfrag);
    }

    renderPagination(totalPages);
    syncFavorites(document);
  }

  function initTabs() {
    const host = $("[data-job-top-tabs]");
    if (!host) return;

    const tabs = isPublicBoardMode() ? BOARD_TYPE_TABS : CATEGORY_TABS;
    host.setAttribute("aria-label", isPublicBoardMode() ? "種別フィルター" : "求人カテゴリ");

    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `job-top-tabs__btn${tab.key === activeTab ? " is-active" : ""}`;
      btn.textContent = tab.label;
      btn.setAttribute("data-job-tab", tab.key);
      btn.addEventListener("click", () => {
        activeTab = tab.key;
        currentPage = 1;
        host.querySelectorAll("[data-job-tab]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.jobTab === activeTab);
        });
        renderBoard();
      });
      host.appendChild(btn);
    });
  }

  function initEmploymentSelects() {
    const selects = $$("[data-job-top-employment-select]");
    selects.forEach((sel) => {
      const preserved = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      EMPLOYMENT_OPTIONS.forEach((label) => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        sel.appendChild(opt);
      });
      if (preserved && [...sel.options].some((o) => o.value === preserved)) {
        sel.value = preserved;
      }
    });
  }

  function initJobTypeSelects() {
    const selects = $$("[data-job-top-industry-select]");
    selects.forEach((sel) => {
      const preserved = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      JOB_INDUSTRY_OPTIONS.forEach((label) => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        sel.appendChild(opt);
      });
      if (preserved && [...sel.options].some((o) => o.value === preserved)) {
        sel.value = preserved;
      }
    });
  }

  function initPopularTags() {
    const host = $("[data-job-top-popular-tags]");
    if (!host) return;

    POPULAR_TAGS.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "job-top-search__tag";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        const input = $("[data-job-top-keyword]");
        if (input) input.value = label;
        currentPage = 1;
        renderBoard();
      });
      host.appendChild(btn);
    });
  }

  function initFilterPanel() {
    const toggle = $("[data-job-top-filter-toggle]");
    const panel = $("[data-job-top-filter-panel]");
    if (toggle && panel && window.matchMedia("(max-width: 1024px)").matches) {
      panel.classList.add("is-collapsed");
      toggle.setAttribute("aria-expanded", "false");
    }
    if (toggle && panel) {
      toggle.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    }

    $("[data-job-top-filter-apply]")?.addEventListener("click", () => {
      currentPage = 1;
      renderBoard();
    });

    $("[data-job-top-filter-clear]")?.addEventListener("click", () => {
      const form = $("[data-job-top-filter-form]");
      form?.reset();
      const topForm = $("[data-job-top-search-form]");
      topForm?.reset();
      currentPage = 1;
      activeTab = "all";
      $$("[data-job-top-tabs] [data-job-tab]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.jobTab === "all");
      });
      activeTab = "all";
      renderBoard();
    });
  }

  function initForms() {
    $("[data-job-top-search-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      currentPage = 1;
      renderBoard();
    });

    $("[data-job-top-sort]")?.addEventListener("change", () => {
      currentPage = 1;
      renderBoard();
    });
  }

  async function init() {
    if (!isSupportedTopPage()) return;

    initJobTypeSelects();
    initEmploymentSelects();
    initTabs();
    initPopularTags();
    initFilterPanel();
    initForms();

    if (isPublicBoardMode()) {
      allItems = await fetchPublicBoardItems();
      console.log("[public-board] loaded items:", allItems.length);
    } else if (isPublicProjectsMode()) {
      allItems = fetchPublicProjects();
      console.log("[public-projects] loaded projects:", allItems.length);
    } else {
      allItems = await fetchJobs();
      console.log("[job-top] loaded jobs:", allItems.length);
      startPrRotation();
    }
    renderBoard();
  }

  window.addEventListener("pagehide", stopPrRotation);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
