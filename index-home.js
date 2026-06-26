/**
 * 一般TOP（index.html）— ランク/ランキング重視UI
 */
(function () {
  "use strict";

  const FEATURED_SLOTS = 3;
  const RANK_SLOTS = 3;
  const NEW_PAGE_SIZE = 8;

  const TYPE_LABEL = {
    product: "商品",
    skill: "スキル",
    job: "求人",
    worker: "ワーカー",
  };

  const POPULAR_TAGS = [
    "動画編集",
    "AI画像生成",
    "ロゴ制作",
    "配送",
    "修理",
    "ゲーム代行",
    "SNS運用",
  ];

  const CATEGORY_ICONS = [
    { key: "all", label: "すべて", icon: "▦" },
    { key: "product", label: "商品", icon: "🛍" },
    { key: "skill", label: "スキル", icon: "✨" },
    { key: "job", label: "求人", icon: "📋" },
    { key: "worker", label: "ワーカー", icon: "🧑‍💻" },
    { key: "video", label: "動画・映像", icon: "🎬" },
    { key: "design", label: "デザイン", icon: "🎨" },
    { key: "ai_it", label: "AI・IT", icon: "🤖" },
    { key: "writing", label: "ライティング", icon: "✍" },
    { key: "biz", label: "ビジネス", icon: "📈" },
    { key: "consult", label: "相談", icon: "💬" },
    { key: "life", label: "生活・暮らし", icon: "🏠" },
    { key: "event", label: "イベント", icon: "🎪" },
  ];

  const DEMO_LISTINGS = [
    {
      id: "demo_skill_001",
      listing_type: "skill",
      type: "skill",
      user_id: "u_sachi",
      title: "プロ品質の動画編集・ショート動画制作",
      description: "YouTube・SNS向け。テロップ・BGM・サムネまで一貫対応。",
      priceText: "¥10,000〜",
      imageUrl: "https://placehold.co/160x160/e8efe4/5a6b4a?text=V",
      popular: 420,
      review_count: 186,
      review_average: 4.9,
      is_featured: true,
      tags: ["動画編集", "ショート動画"],
      form_data: {
        skill_category: "video",
        delivery_time: "within_3_days",
        service_format: "online",
      },
    },
    {
      id: "demo_product_001",
      listing_type: "product",
      type: "product",
      user_id: "u_store",
      title: "プレミアム家電セット 2026",
      description: "人気のスマート家電をセットでお届け。限定100セット。",
      priceText: "¥89,800",
      imageUrl: "https://placehold.co/160x160/f3ead4/967622?text=P",
      popular: 380,
      review_count: 312,
      review_average: 4.8,
      is_featured: true,
      tags: ["限定", "送料無料"],
      form_data: {
        product_category: "home_appliances",
        item_condition: "new",
        delivery_type: "shipping",
      },
    },
    {
      id: "demo_worker_001",
      listing_type: "worker",
      type: "worker",
      user_id: "u_hiro",
      title: "即日対応できる動画編集者",
      description: "法人・個人問わず丁寧に対応。リピート率92%。",
      priceText: "1件 ¥3,000〜",
      imageUrl: "https://placehold.co/160x160/fff6df/7a5710?text=W",
      popular: 290,
      review_count: 86,
      review_average: 4.7,
      is_featured: true,
      tags: ["即日対応", "法人対応"],
      form_data: {
        worker_task: "light_work",
        worker_area: "online",
        worker_time: "same_day",
      },
    },
    {
      id: "demo_job_001",
      listing_type: "job",
      type: "job",
      user_id: "u_me",
      title: "動画編集スタッフ募集（業務委託可）",
      description: "週3日〜。ショート動画・YouTube編集経験者歓迎。",
      priceText: "月額 ¥25万〜",
      imageUrl: "https://placehold.co/160x160/f0e6e0/6b4a3d?text=J",
      popular: 150,
      review_count: 24,
      review_average: 4.5,
      tags: ["急募", "リモート可"],
    },
    {
      id: "demo_skill_002",
      listing_type: "skill",
      type: "skill",
      user_id: "u_me",
      title: "AI画像生成・ロゴ制作パッケージ",
      description: "ブランドに合わせたロゴとSNS用素材をセット提供。",
      priceText: "¥15,000〜",
      imageUrl: "https://placehold.co/160x160/e0e7ff/4338ca?text=AI",
      popular: 210,
      review_count: 64,
      review_average: 4.6,
      tags: ["AI", "ロゴ"],
      form_data: {
        skill_category: "ai_it",
        delivery_time: "within_1_week",
        service_format: "data_delivery",
      },
    },
    {
      id: "demo_worker_002",
      listing_type: "worker",
      type: "worker",
      user_id: "u_store",
      title: "丁寧対応のWeb制作パートナー",
      description: "全国オンライン。ディレクションから実装まで。",
      priceText: "¥50,000〜",
      imageUrl: "https://placehold.co/160x160/dbeafe/1d4ed8?text=Web",
      popular: 175,
      review_count: 52,
      review_average: 4.8,
      tags: ["Web制作", "法人対応"],
      form_data: {
        worker_task: "office",
        worker_area: "nationwide",
        worker_time: "weekday",
      },
    },
  ];

  const DEMO_SELLERS = {
    u_sachi: {
      userId: "u_sachi",
      displayName: "はるかまん",
      rankKey: "legend",
      avatarUrl: "https://placehold.co/160x160/f3ead4/967622?text=S",
      dealsCount: 850,
      repeatRate: 92,
    },
    u_store: {
      userId: "u_store",
      displayName: "premium_home",
      rankKey: "master",
      avatarUrl: "https://placehold.co/160x160/f3ead4/967622?text=PH",
      dealsCount: 158,
      repeatRate: 88,
    },
    u_hiro: {
      userId: "u_hiro",
      displayName: "ひろ",
      rankKey: "diamond",
      avatarUrl: "https://placehold.co/64x64/fff6df/7a5710?text=H",
      dealsCount: 420,
      repeatRate: 90,
    },
    u_me: {
      userId: "u_me",
      displayName: "TASFUL出品者",
      rankKey: "gold",
      avatarUrl: "https://placehold.co/64x64/e8efe4/5a6b4a?text=T",
      dealsCount: 120,
      repeatRate: 85,
    },
  };

  const latestState = {
    category: "all",
    query: "",
    availableOnly: false,
    featuredOnly: false,
    rating45Only: false,
    priceRange: "",
    sort: "newest",
    newVisible: NEW_PAGE_SIZE,
    productCategory: "",
    productCondition: "",
    productDelivery: "",
    skillCategory: "",
    skillDeliveryTime: "",
    skillFormat: "",
    workerTask: "",
    workerArea: "",
    workerTime: "",
  };

  const TYPE_FILTER_STATE_KEYS = [
    "productCategory",
    "productCondition",
    "productDelivery",
    "skillCategory",
    "skillDeliveryTime",
    "skillFormat",
    "workerTask",
    "workerArea",
    "workerTime",
  ];

  const FILTER_FIELD_PATHS = {
    productCategory: [
      "product_category",
      "form_data.product_category",
      "form_data.category_key",
      "category_key",
      "category",
    ],
    productCondition: [
      "item_condition",
      "product_condition",
      "form_data.item_condition",
      "form_data.product_condition",
      "form_data.condition",
    ],
    productDelivery: [
      "delivery_type",
      "delivery_method",
      "form_data.delivery_type",
      "form_data.delivery_method",
      "form_data.handoff_type",
    ],
    skillCategory: [
      "skill_category",
      "form_data.skill_category",
      "form_data.category_key",
      "category_key",
      "category",
    ],
    skillDeliveryTime: [
      "delivery_time",
      "lead_time",
      "form_data.delivery_time",
      "form_data.lead_time",
      "form_data.deadline",
    ],
    skillFormat: [
      "service_format",
      "delivery_format",
      "form_data.service_format",
      "form_data.delivery_format",
      "form_data.format",
    ],
    workerTask: [
      "worker_task",
      "service_task",
      "form_data.worker_task",
      "form_data.service_task",
      "form_data.task_type",
    ],
    workerArea: ["worker_area", "service_area", "form_data.worker_area", "form_data.service_area"],
    workerTime: [
      "worker_time",
      "availability_hours",
      "form_data.worker_time",
      "form_data.availability_hours",
      "form_data.schedule",
    ],
  };

  const FILTER_KEYWORDS = {
    productCategory: {
      home_appliances: ["家電", "スマート家電", "home_appliances"],
      gadget: ["ガジェット", "gadget", "電子機器"],
      daily: ["日用品", "daily", "生活雑貨"],
      fashion: ["ファッション", "fashion", "服", "アパレル"],
      handmade: ["ハンドメイド", "handmade", "手作り"],
      digital: ["デジタル商品", "digital", "ダウンロード", "電子書籍"],
      other: ["その他"],
    },
    productCondition: {
      new: ["新品", "new", "未開封"],
      like_new: ["未使用に近い", "like_new", "美品"],
      used: ["中古", "used"],
      imperfect: ["訳あり", "imperfect", "傷", "ジャンク"],
    },
    productDelivery: {
      shipping: ["配送", "送料", "発送", "shipping", "宅配"],
      handoff: ["手渡し", "対面", "handoff", "受け渡し"],
      same_day: ["即日", "当日", "same_day"],
    },
    skillCategory: {
      video: ["動画編集", "video", "映像", "youtube", "ショート動画"],
      design: ["デザイン", "design", "ロゴ", "バナー"],
      ai_it: ["ai", "it", "画像生成", "プログラム", "開発"],
      writing: ["ライティング", "writing", "記事", "コピー"],
      sns: ["sns", "運用", "instagram", "tiktok"],
      consult: ["相談", "consult", "カウンセリング"],
      fortune: ["占い", "fortune", "鑑定"],
      clerical: ["事務代行", "clerical", "入力", "代行"],
      other: ["その他"],
    },
    skillDeliveryTime: {
      same_day: ["即日", "same_day", "当日"],
      within_3_days: ["3日以内", "within_3_days", "72時間"],
      within_1_week: ["1週間以内", "within_1_week", "7日"],
      consult: ["相談可", "要相談", "consult"],
    },
    skillFormat: {
      online: ["オンライン", "online", "リモート"],
      chat: ["チャット", "chat", "line"],
      call: ["通話", "call", "zoom", "電話"],
      data_delivery: ["データ納品", "data_delivery", "ファイル納品"],
    },
    workerTask: {
      shopping: ["買い物代行", "shopping", "買い物"],
      delivery: ["配送", "配達", "delivery", "宅配"],
      cleaning: ["掃除", "清掃", "cleaning"],
      light_work: ["軽作業", "light_work", "作業"],
      companion: ["相談相手", "話し相手", "companion", "付き添い"],
      onsite: ["出張対応", "onsite", "出張"],
      office: ["事務サポート", "事務", "office", "入力"],
      other: ["その他"],
    },
    workerArea: {
      nearby: ["近く", "近隣", "地域", "nearby"],
      online: ["オンライン", "online", "リモート"],
      nationwide: ["全国対応", "nationwide", "全国"],
      onsite: ["出張可", "出張", "onsite"],
    },
    workerTime: {
      same_day: ["即日対応", "即日", "same_day"],
      night: ["深夜対応", "深夜", "night"],
      weekend: ["土日対応", "土日", "週末", "weekend"],
      weekday: ["平日対応", "平日", "weekday"],
    },
  };

  const state = {
    all: [],
  };

  let latestSearchTimer = null;
  let latestRenderGen = 0;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clampText(text, fallback = "—") {
    const s = String(text ?? "").trim();
    return s ? s : fallback;
  }

  function detailUrl(item) {
    const type = item.listing_type || item.type;
    const id = item.id;
    if (type === "product") return `/detail-product.html?id=${encodeURIComponent(id)}`;
    if (type === "worker") return `/detail-worker.html?id=${encodeURIComponent(id)}`;
    if (type === "job") return `/detail-job.html?id=${encodeURIComponent(id)}`;
    if (type === "skill") {
      const userId = item.user_id || "u_me";
      return `/detail-skill.html?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`;
    }
    return "#";
  }

  function ctaLabel(item) {
    const type = item.listing_type || item.type;
    if (type === "job") return "応募する";
    if (type === "worker" || type === "skill") return "相談する";
    if (type === "product") return "購入・相談";
    return "詳細を見る";
  }

  function avatarUrl(item) {
    return (
      item.thumbnail_url ||
      item.thumbnailUrl ||
      item.imageUrl ||
      item.image_url ||
      "https://placehold.co/160x160/f3f2ef/9ca3af?text=T"
    );
  }

  function priceText(item) {
    return item.priceText || item.price_text || item.price || "要相談";
  }

  function normalizeRankKey(raw) {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) return "new";
    if (key === "legend") return "legend";
    // 一般TOPは master を platinum 表現に寄せる（新デザインでも同キーを利用）
    if (key === "platinum") return "platinum";
    if (key === "master") return "platinum";
    if (key === "diamond") return "diamond";
    if (key === "gold") return "gold";
    if (key === "silver") return "silver";
    if (key === "bronze") return "bronze";
    if (key === "new") return "new";
    return "new";
  }

  function resolveRankKeyFrom(item, sellerProfile) {
    const raw =
      sellerProfile?.rank ||
      sellerProfile?.rankKey ||
      item?.seller_profile?.rank ||
      item?.sellerProfile?.rank ||
      item?.rank ||
      item?.seller_rank ||
      item?.form_data?.rank ||
      "NEW";
    return normalizeRankKey(raw);
  }

  const RANK_CLASS_RE = /\brank-(legend|platinum|master|diamond|gold|silver|bronze|new)\b/g;

  function rankClassList(rankKey) {
    const k = normalizeRankKey(rankKey);
    // MASTER は platinum と同義だが、要求classとして rank-master も付ける
    if (k === "platinum") return ["rank-platinum", "rank-master"];
    return [`rank-${k}`];
  }

  function setRankClasses(el, rankKey) {
    if (!el) return;
    el.className = String(el.className || "").replace(RANK_CLASS_RE, "").replace(/\s{2,}/g, " ").trim();
    rankClassList(rankKey).forEach((cls) => el.classList.add(cls));
  }

  function rankLabel(rankKey) {
    const k = normalizeRankKey(rankKey);
    if (k === "platinum") return "MASTER";
    if (k === "diamond") return "DIAMOND";
    return String(k).toUpperCase();
  }

  function renderAvatarRingHtml(sellerUserId, rankCls, opts = {}) {
    const emptyRing = opts.emptyRing === true;
    const emptyAttr = emptyRing ? ' data-empty-ring="1"' : "";
    const cls = String(rankCls || "").includes("rank-platinum") ? `${rankCls} rank-master` : rankCls;
    return `<div class="avatar-ring profile-avatar ${escapeHtml(cls)}" aria-hidden="true" data-rank-avatar data-seller-user-id="${escapeHtml(sellerUserId || "")}"${emptyAttr}></div>`;
  }

  function renderRankChipHtml(rankKey, rankCls, extraAttrs = "") {
    const attrs = extraAttrs ? ` ${extraAttrs}` : "";
    const cls = String(rankCls || "").includes("rank-platinum") ? `${rankCls} rank-master` : rankCls;
    return `<span class="seller-rank-chip rank-chip ${escapeHtml(cls)}" data-seller-rank-chip${attrs}>${escapeHtml(rankLabel(rankKey))}</span>`;
  }

  function resolvePrimaryImageUrl(row) {
    try {
      const imageUrl =
        window.TasuListingImages?.resolvePrimaryImageUrl?.(row) ||
        row?.image_url ||
        row?.main_image_url ||
        row?.thumbnail_url ||
        row?.form_data?.image_url ||
        row?.form_data?.thumbnail_url ||
        (Array.isArray(row?.images) ? row.images[0] : "") ||
        "";

      return imageUrl ? String(imageUrl) : "";
    } catch (err) {
      console.error("[index-home] resolvePrimaryImageUrl failed:", err);
      return "";
    }
  }

  function initialsFrom(text) {
    const s = String(text || "").trim();
    if (!s) return "T";
    const first = s[0];
    return first ? first.toUpperCase() : "T";
  }

  const sellerProfileCache = new Map();

  function resolveSellerAvatarUrl(item, sellerProfile) {
    const p = sellerProfile || {};
    const sp = item?.seller_profile || item?.sellerProfile || {};
    const avatarUrl =
      p.avatarUrl ||
      sp?.avatar_url ||
      sp?.profile_image_url ||
      item?.profile_image_url ||
      item?.avatar_url ||
      item?.user_avatar ||
      item?.icon_url ||
      "";
    return String(avatarUrl || "").trim();
  }

  function fetchSellerProfileCached(userId) {
    const key = String(userId || "").trim();
    if (!key) return Promise.resolve(null);
    if (sellerProfileCache.has(key)) return sellerProfileCache.get(key);
    const api = window.TasuListingSellerProfile;
    const promise =
      api?.fetchSellerProfile
        ? api.fetchSellerProfile(key, { demoFallback: true }).catch((err) => {
            console.error("[index-home] fetchSellerProfile failed:", err);
            return null;
          })
        : Promise.resolve(null);
    sellerProfileCache.set(key, promise);
    return promise;
  }

  function hydrateSellerAvatars(root) {
    const host = root || document;
    host
      .querySelectorAll("[data-rank-avatar][data-seller-user-id]")
      .forEach((ring) => {
        const userId = ring.getAttribute("data-seller-user-id") || "";
        if (!userId) return;
        if (ring.getAttribute("data-avatar-hydrated") === "1") return;
        ring.setAttribute("data-avatar-hydrated", "1");
        const emptyRing = ring.getAttribute("data-empty-ring") === "1";
        void fetchSellerProfileCached(userId).then((profile) => {
          const card =
            ring.closest(".list-card-seller") ||
            ring.closest(".home-list-card") ||
            ring.closest(".featured-big") ||
            ring.closest(".rank-item") ||
            ring.closest("li");
          const title =
            card?.querySelector(".home-list-title a")?.textContent ||
            card?.querySelector(".featured-title a")?.textContent ||
            card?.querySelector(".rank-name")?.textContent ||
            card?.querySelector("a")?.textContent ||
            "";

          const rankKey = resolveRankKeyFrom(null, profile);
          setRankClasses(ring, rankKey);
          if (card) setRankClasses(card, rankKey);
          const chip =
            card?.querySelector("[data-seller-rank-chip]") ||
            card?.querySelector(".seller-rank-chip") ||
            card?.querySelector(".rank-chip");
          if (chip) {
            chip.classList.add("seller-rank-chip", "rank-chip");
            setRankClasses(chip, rankKey);
            chip.textContent = rankLabel(rankKey);
          }

          try {
            console.log("[index rank]", { title, sellerId: userId, rank: rankKey, sellerProfile: profile });
          } catch {
            // ignore
          }

          if (emptyRing) return;

          const url = resolveSellerAvatarUrl({ seller_profile: profile }, profile);
          if (!url) return;
          const img = document.createElement("img");
          img.className = "home-rank-avatar";
          img.alt = "";
          img.loading = "lazy";
          img.src = url;
          img.addEventListener("error", () => {
            img.remove();
          });
          ring.appendChild(img);
        });
      });
  }

  function safeNormalize(row) {
    const normalizer = window.TasuListingRenderer?.normalizeGeneralRow;
    if (typeof normalizer === "function") return normalizer(row);
    return row;
  }

  function nowMs() {
    return Date.now();
  }

  function parseTimeMs(value) {
    if (!value) return 0;
    try {
      const t = new Date(value).getTime();
      return Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  }

  // job と確定したものだけ除外（category未設定を理由に除外しない）
  function isJobListing(item) {
    const values = [
      item?.type,
      item?.listing_type,
      item?.category,
      item?.category_key,
      item?.form_type,
      item?.item_type,
      item?.listing_category,
      item?.form_data?.listing_type,
      item?.form_data?.type,
      item?.form_data?.category_key,
      item?.form_data?.category,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase().trim());

    return values.some(
      (v) => v === "job" || v === "jobs" || v === "求人" || v === "recruitment"
    );
  }

  function isAllowedGeneralType(item) {
    const t = String(item?.listing_type || item?.type || "").toLowerCase().trim();
    if (!t) return true; // 未設定は一旦残す（job確定でなければ落とさない）
    return t === "product" || t === "skill" || t === "worker" || t === "商品" || t === "スキル" || t === "ワーカー";
  }

  function isFeaturedActive(item) {
    try {
      if (window.TasuListingFeatured?.isActive) {
        return Boolean(window.TasuListingFeatured.isActive(item));
      }
    } catch {
      // ignore
    }
    if (item?.is_featured === true) {
      const until = parseTimeMs(item?.featured_until);
      if (!until) return true;
      return until > nowMs();
    }
    return Boolean(item?.isFeaturedSlot || item?.isFeatured);
  }

  function mergeWithDemo(rows) {
    const seen = new Set();
    const merged = [];
    (rows || []).forEach((r) => {
      const id = String(r?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(r);
    });
    DEMO_LISTINGS.forEach((d) => {
      if (!seen.has(d.id)) merged.push(d);
    });
    return merged;
  }

  async function loadListings() {
    const store = window.TasuListingStore;
    if (!store?.fetchPublishedListings) return mergeWithDemo([]);
    try {
      const rows = await store.fetchPublishedListings({
        limit: 120,
        public_only: true,
        localFallback: true,
      });
      return mergeWithDemo((rows || []).map((r) => safeNormalize(r)).filter(Boolean));
    } catch {
      return mergeWithDemo([]);
    }
  }

  async function loadFeatured() {
    const store = window.TasuListingStore;
    if (!store?.fetchActiveFeaturedListings) return [];
    try {
      const rows = await store.fetchActiveFeaturedListings({
        limit: 60,
        public_only: true,
      });
      return (rows || []).map((r) => safeNormalize(r)).filter(Boolean);
    } catch {
      return [];
    }
  }

  function scorePopular(item) {
    return (
      Number(item.favorite_count ?? 0) * 3 +
      Number(item.popular ?? 0) +
      Number(item.view_count ?? 0) * 0.5
    );
  }

  function scoreTrending(item) {
    const base = Number(item.view_count ?? 0) + Number(item.popular ?? 0) * 0.6;
    const created = item.created_at ? new Date(item.created_at).getTime() : Date.now() - 86400000;
    const ageDays = Math.max(1, (Date.now() - created) / 86400000);
    return base / Math.sqrt(ageDays);
  }

  function scoreHighRated(item) {
    const rating =
      Number(item.review_average ?? item.rating ?? item.form_data?.rating ?? 0) || 0;
    const count = Number(item.review_count ?? 0) || 0;
    return rating * 100 + Math.min(count, 200);
  }

  function renderStars(ratingValue) {
    const r = Number(ratingValue ?? 0) || 0;
    const full = Math.max(0, Math.min(5, Math.floor(r)));
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  function formatReviewCount(countValue) {
    const c = Number(countValue ?? 0) || 0;
    return c > 0 ? `（${c}件）` : "";
  }

  function resolveAccountLine(item) {
    const rawHandle = String(item?.handle || item?.account_handle || item?.form_data?.handle || "").trim();
    const sellerName = String(item?.name || item?.seller_name || item?.form_data?.name || "").trim();
    const title = String(item?.title || "").trim();

    const handle = rawHandle
      ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`)
      : `@${String(item?.user_id || "seller").slice(0, 14)}`;

    const chosen = handle || sellerName;
    if (!chosen) return "";
    if (title && chosen === title) return "";
    return chosen;
  }

  function isAvailable(item) {
    const v = String(item?.availability_status || item?.availability || item?.status || "").toLowerCase();
    if (!v) return false;
    return v === "online" || v === "available" || v === "open";
  }

  function pickFeaturedTop(featuredRaw, all) {
    const pool = [];
    const seen = new Set();
    const push = (item) => {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      pool.push(item);
    };
    const isAllowed = (r) => isAllowedGeneralType(r) && !isJobListing(r);
    (featuredRaw || []).filter(isAllowed).forEach(push);
    all.filter((r) => (r.is_featured || r.isFeaturedSlot) && isAllowed(r)).forEach(push);
    [...all].filter(isAllowed).sort((a, b) => scorePopular(b) - scorePopular(a)).forEach(push);
    DEMO_LISTINGS.filter((d) => d.is_featured && isAllowed(d)).forEach(push);

    const top = pool.slice(0, FEATURED_SLOTS);
    while (top.length < FEATURED_SLOTS) {
      const filler = DEMO_LISTINGS[top.length % DEMO_LISTINGS.length];
      if (!top.some((t) => t.id === filler.id)) top.push({ ...filler });
      else break;
    }
    return top.slice(0, FEATURED_SLOTS);
  }

  function padRankItems(items) {
    const out = items.slice(0, RANK_SLOTS);
    const seen = new Set(out.map((i) => i.id));
    for (const d of DEMO_LISTINGS) {
      if (out.length >= RANK_SLOTS) break;
      if (isJobListing(d) || !isAllowedGeneralType(d)) continue;
      if (!seen.has(d.id)) {
        out.push(d);
        seen.add(d.id);
      }
    }
    return out.slice(0, RANK_SLOTS);
  }

  async function resolveSeller(listing) {
    const userId = listing.user_id || "";
    if (DEMO_SELLERS[userId]) return DEMO_SELLERS[userId];
    const api = window.TasuListingSellerProfile;
    if (!api) {
      return {
        userId,
        displayName: listing.name || "出品者",
        rankKey: "gold",
        avatarUrl: avatarUrl(listing),
        dealsCount: 0,
        repeatRate: 0,
      };
    }
    const demo = api.resolveDemoProfile?.(userId);
    if (demo) {
      return {
        ...demo,
        rankKey: normalizeRankKey(demo.rankKey || demo.memberRank || demo.member_rank),
      };
    }
    try {
      const profile = await api.fetchSellerProfile(userId, { demoFallback: true });
      const resolved =
        profile || {
          userId,
          displayName: listing.name || "出品者",
          rankKey: "gold",
          avatarUrl: avatarUrl(listing),
          dealsCount: 0,
          repeatRate: 0,
        };
      return {
        ...resolved,
        rankKey: normalizeRankKey(resolved.rankKey || resolved.memberRank || resolved.member_rank),
      };
    } catch {
      return {
        userId,
        displayName: listing.name || "出品者",
        rankKey: "gold",
        avatarUrl: avatarUrl(listing),
        dealsCount: 0,
        repeatRate: 0,
      };
    }
  }

  function renderCategoryIcons() {
    const host = $("[data-home-cats]");
    if (!host) return;
    host.innerHTML = "";
    CATEGORY_ICONS.forEach((c) => {
      const el = document.createElement("a");
      el.href = c.key === "job" ? "/job-top.html" : "#new";
      el.className = `home-cat${c.key === "all" ? " is-active" : ""}`;
      el.dataset.homeCat = c.key;
      el.innerHTML = `<span class="home-cat__icon" aria-hidden="true">${escapeHtml(c.icon)}</span><span class="home-cat__label">${escapeHtml(c.label)}</span>`;
      el.addEventListener("click", (e) => {
        if (c.key === "job") return;
        e.preventDefault();
        $$(".home-cat").forEach((n) => n.classList.remove("is-active"));
        el.classList.add("is-active");
        if (c.key === "all") {
          setLatestCategory("all");
        } else if (["product", "skill", "worker"].includes(c.key)) {
          setLatestCategory(c.key);
        }
        latestState.newVisible = NEW_PAGE_SIZE;
        syncLatestFilterForm();
        refreshLatestList();
      });
      host.appendChild(el);
    });
  }

  function renderPopularTags() {
    const host = $("[data-home-popular]");
    if (!host) return;
    host.innerHTML = "";
    POPULAR_TAGS.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "home-tag";
      b.textContent = t;
      b.addEventListener("click", () => {
        const input = $("[data-home-search-input]");
        if (input) input.value = t;
      });
      host.appendChild(b);
    });
  }

  function renderPrSection(allRows) {
    // 小さいPRカードセクションは廃止（冗長なため）
    const section = document.querySelector("[data-home-pr-section]");
    if (section) section.remove();
  }

  function renderFeaturedCards(items, sellerMap) {
    const host = $("[data-home-featured]");
    if (!host) return;
    host.innerHTML = "";
    const medals = ["1", "2", "3"];

    items.forEach((it, idx) => {
      const seller = sellerMap.get(it.id) || {};
      const rankKey = resolveRankKeyFrom(it, seller);
      const rankCls = `rank-${rankKey}`;
      const ratingVal = Number(it.review_average ?? 0);
      const ratingText =
        ratingVal > 0
          ? `${renderStars(ratingVal)} ${ratingVal.toFixed(1)}${formatReviewCount(it.review_count)}`
          : "";
      const tags = (it.tags || it.displayTags || []).slice(0, 3);
      const tagHtml = tags.length
        ? tags.map((t) => `<span class="featured-tag">${escapeHtml(t)}</span>`).join("")
        : `<span class="featured-tag">${escapeHtml(TYPE_LABEL[it.listing_type] || "掲載")}</span>`;
      const typeLabel = TYPE_LABEL[it.listing_type] || "掲載";
      const accountLine = resolveAccountLine(it);
      const available = isAvailable(it);

      const card = document.createElement("article");
      card.className = `featured-big${isFeaturedActive(it) ? " is-featured" : ""} list-card-seller ${rankCls}`;
      card.innerHTML = `
        <span class="featured-medal is-${medals[idx]}" aria-label="${idx + 1}位">${idx + 1}</span>
        <button type="button" class="fav-round featured-fav" data-favorite-button data-favorite-icon-only="1"
          data-target-type="${escapeHtml(it.listing_type)}" data-target-id="${escapeHtml(it.id)}" aria-label="お気に入り">♡</button>
        <span class="featured-badge">PR</span>
        <div class="featured-profile list-card-seller ${escapeHtml(rankCls)}">
          <div class="profile-rank-block">
            ${renderAvatarRingHtml(it.user_id || "", rankCls, { emptyRing: false })}
            ${renderRankChipHtml(rankKey, rankCls, 'class="rank-chip"')}
          </div>
          <div class="featured-seller-meta">
            <div class="card-badges-row">
              <span class="type-pill">${escapeHtml(typeLabel)}</span>
              <span class="home-list-new">NEW</span>
            </div>
            <div class="card-title-row featured-title"><a href="${escapeHtml(detailUrl(it))}">${escapeHtml(clampText(it.title))}</a></div>
            ${accountLine ? `<div class="card-account-row">${escapeHtml(accountLine)}</div>` : ""}
            <div class="card-rating-row">
              ${ratingText ? `<span class="stars">${escapeHtml(ratingText)}</span>` : ""}
              ${available ? `<span class="home-list-availability"><span class="home-dot" aria-hidden="true"></span>対応可能</span>` : ""}
            </div>
            <div class="card-desc-row featured-desc">${escapeHtml(clampText(it.description, ""))}</div>
            <div class="card-tags-row featured-tags">${tagHtml}</div>
          </div>
        </div>
        <div class="featured-stats">
          <span>実績 ${escapeHtml(String(seller.dealsCount ?? "—"))}+</span>
          <span>リピート ${escapeHtml(String(seller.repeatRate ?? "—"))}%</span>
        </div>
        <p class="featured-price">${escapeHtml(priceText(it))}</p>
        <div class="featured-actions">
          <a class="btn-outline" href="${escapeHtml(detailUrl(it))}">詳細を見る</a>
          <a class="btn-primary" href="${escapeHtml(detailUrl(it))}">${escapeHtml(ctaLabel(it))}</a>
        </div>
      `;
      host.appendChild(card);
    });
    hydrateSellerAvatars(host);
  }

  function renderRankColumn(hostSel, items) {
    const host = $(hostSel);
    if (!host) return;
    host.innerHTML = "";
    padRankItems(items).forEach((it, idx) => {
      const rankKey = resolveRankKeyFrom(it, null);
      const rankCls = `rank-${rankKey}`;
      const a = document.createElement("a");
      a.className = `rank-item list-card-seller ${rankCls}`;
      a.href = detailUrl(it);
      const rating = Number(it.review_average ?? 0);
      const sub =
        rating > 0
          ? `★ ${rating.toFixed(1)} · ${TYPE_LABEL[it.listing_type] || "掲載"}`
          : `${TYPE_LABEL[it.listing_type] || "掲載"}`;
      a.innerHTML = `
        <span class="rank-num">${idx + 1}</span>
        <span class="rank-avatar" aria-hidden="true">
          <div class="profile-rank-block profile-rank-block--sm">
            ${renderAvatarRingHtml(it.user_id || "", rankCls, { emptyRing: true })}
            ${renderRankChipHtml(rankKey, rankCls, 'class="rank-chip" style="transform:scale(0.68);transform-origin:center;max-width:72px"')}
          </div>
        </span>
        <span class="rank-body">
          <p class="rank-name">${escapeHtml(clampText(it.title))}</p>
          <p class="rank-sub">${escapeHtml(sub)}</p>
        </span>
        <span class="rank-right">
          <span class="rank-price">${escapeHtml(priceText(it))}</span>
        </span>
      `;
      host.appendChild(a);
    });
    hydrateSellerAvatars(host);
  }

  function parsePriceAmount(row) {
    const amount =
      Number(row.price_amount ?? row.worker_price_amount ?? row.form_data?.price_amount) ||
      (() => {
        const text = String(priceText(row) || "");
        const m = text.replace(/,/g, "").match(/(\d{1,})(?=\s*円)/);
        return m ? Number(m[1]) : NaN;
      })();
    return Number.isFinite(amount) ? amount : NaN;
  }

  function normalizeFilterSlug(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[\s・\-]+/g, "_");
  }

  function getValueByPath(obj, path) {
    return String(path || "")
      .split(".")
      .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  function flattenFormDataValues(fd, depth = 0, out = []) {
    if (!fd || depth > 3) return out;
    if (typeof fd === "string" || typeof fd === "number") {
      out.push(String(fd));
      return out;
    }
    if (Array.isArray(fd)) {
      fd.forEach((v) => {
        if (typeof v === "string" || typeof v === "number") out.push(String(v));
      });
      return out;
    }
    if (typeof fd === "object") {
      Object.values(fd).forEach((v) => flattenFormDataValues(v, depth + 1, out));
    }
    return out;
  }

  function collectFieldTokens(row, paths) {
    const tokens = [];
    (paths || []).forEach((path) => {
      let val;
      if (path.startsWith("form_data.")) {
        const fd = row.form_data && typeof row.form_data === "object" ? row.form_data : {};
        val = getValueByPath(fd, path.replace("form_data.", ""));
      } else {
        val = row[path] ?? getValueByPath(row, path);
      }
      if (val != null && val !== "") tokens.push(String(val));
    });
    return tokens;
  }

  function buildListingFilterHaystack(item) {
    const fd = item?.form_data && typeof item.form_data === "object" ? item.form_data : {};
    const tags = (item.tags || item.displayTags || []).join(" ");
    const flatFd = flattenFormDataValues(fd).join(" ");
    const parts = [
      item.title,
      item.description,
      tags,
      item.category,
      item.category_key,
      item.categoryLabel,
      item.product_category,
      item.skill_category,
      item.worker_task,
      flatFd,
      TYPE_LABEL[item.listing_type] || "",
    ];
    return parts
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesTypedFilter(row, stateKey, filterValue) {
    if (!filterValue) return true;
    const paths = FILTER_FIELD_PATHS[stateKey] || [];
    const needle = normalizeFilterSlug(filterValue);
    const tokens = collectFieldTokens(row, paths).map(normalizeFilterSlug);
    if (tokens.some((t) => t === needle || (t && (t.includes(needle) || needle.includes(t))))) return true;
    const hay = buildListingFilterHaystack(row);
    const keywords = FILTER_KEYWORDS[stateKey]?.[filterValue] || [];
    return keywords.some((kw) => hay.includes(String(kw).toLowerCase()));
  }

  function applyCategoryTypedFilters(rows) {
    const cat = latestState.category;
    if (cat === "product") {
      return rows.filter(
        (r) =>
          matchesTypedFilter(r, "productCategory", latestState.productCategory) &&
          matchesTypedFilter(r, "productCondition", latestState.productCondition) &&
          matchesTypedFilter(r, "productDelivery", latestState.productDelivery)
      );
    }
    if (cat === "skill") {
      return rows.filter(
        (r) =>
          matchesTypedFilter(r, "skillCategory", latestState.skillCategory) &&
          matchesTypedFilter(r, "skillDeliveryTime", latestState.skillDeliveryTime) &&
          matchesTypedFilter(r, "skillFormat", latestState.skillFormat)
      );
    }
    if (cat === "worker") {
      return rows.filter(
        (r) =>
          matchesTypedFilter(r, "workerTask", latestState.workerTask) &&
          matchesTypedFilter(r, "workerArea", latestState.workerArea) &&
          matchesTypedFilter(r, "workerTime", latestState.workerTime)
      );
    }
    return rows;
  }

  function resetCategorySpecificFilters() {
    TYPE_FILTER_STATE_KEYS.forEach((key) => {
      latestState[key] = "";
    });
  }

  function hasActiveTypeFilters() {
    return TYPE_FILTER_STATE_KEYS.some((key) => Boolean(latestState[key]));
  }

  function setLatestCategory(category) {
    const next = category || "all";
    if (latestState.category !== next) {
      resetCategorySpecificFilters();
    }
    latestState.category = next;
    updateTypeFiltersVisibility();
  }

  function updateTypeFiltersVisibility() {
    const wrap = $("[data-home-type-filters-wrap]");
    const cat = latestState.category;
    const show = cat === "product" || cat === "skill" || cat === "worker";
    if (wrap) wrap.hidden = !show;

    $$("[data-home-type-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.homeTypePanel !== cat;
    });

    const title = $("[data-home-type-filters-title]");
    const labels = { product: "商品", skill: "スキル", worker: "ワーカー" };
    if (title) title.textContent = labels[cat] ? `${labels[cat]}の詳細条件` : "詳細条件";

    const panel = $("[data-home-type-filters-panel]");
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    if (!panel) return;
    if (!show) return;
    if (!mobile) {
      panel.classList.add("is-open");
      panel.classList.remove("is-collapsed");
      const toggle = $("[data-home-type-filters-toggle]");
      toggle?.setAttribute("aria-expanded", "true");
    }
  }

  function initTypeFiltersPanel() {
    const panel = $("[data-home-type-filters-panel]");
    const toggle = $("[data-home-type-filters-toggle]");
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    if (!panel || !toggle) return;
    if (mobile) {
      panel.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    } else {
      panel.classList.add("is-open");
      panel.classList.remove("is-collapsed");
      toggle.setAttribute("aria-expanded", "true");
    }
  }

  function normalizeSortKey(sort) {
    const s = String(sort || "newest");
    if (s === "rated") return "rating";
    if (s === "price-asc") return "price_low";
    if (s === "price-desc") return "price_high";
    return s;
  }

  function sortLatestRows(rows) {
    const sortKey = normalizeSortKey(latestState.sort);
    const getPrice = parsePriceAmount;
    const sorted = [...rows];

    const compareFeaturedFirst = (a, b) => {
      const fa = isFeaturedActive(a) ? 1 : 0;
      const fb = isFeaturedActive(b) ? 1 : 0;
      if (fb !== fa) return fb - fa;
      return 0;
    };

    if (sortKey === "price_low" || sortKey === "price_high") {
      sorted.sort((a, b) => {
        const pa = getPrice(a);
        const pb = getPrice(b);
        if (!Number.isFinite(pa) && !Number.isFinite(pb)) return 0;
        if (!Number.isFinite(pa)) return 1;
        if (!Number.isFinite(pb)) return -1;
        return sortKey === "price_low" ? pa - pb : pb - pa;
      });
      return sorted;
    }

    if (sortKey === "featured") {
      sorted.sort((a, b) => {
        const featuredCmp = compareFeaturedFirst(a, b);
        if (featuredCmp) return featuredCmp;
        return parseTimeMs(b.created_at) - parseTimeMs(a.created_at);
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      const featuredCmp = compareFeaturedFirst(a, b);
      if (featuredCmp) return featuredCmp;
      if (sortKey === "popular") return scorePopular(b) - scorePopular(a);
      if (sortKey === "rating") return scoreHighRated(b) - scoreHighRated(a);
      return parseTimeMs(b.created_at) - parseTimeMs(a.created_at);
    });
    return sorted;
  }

  function applyLatestFilters(sourceRows) {
    const items = Array.isArray(sourceRows) ? sourceRows : state.all;
    let rows = Array.isArray(items) ? items.slice() : [];

    // 1. 求人除外（category未設定は job 確定でなければ残す）
    rows = rows.filter((r) => !isJobListing(r) && isAllowedGeneralType(r));

    // 2. カテゴリ
    if (latestState.category !== "all") {
      rows = rows.filter((r) => (r.listing_type || r.type) === latestState.category);
    }

    // 3. 検索
    const query = String(latestState.query || "").trim().toLowerCase();
    if (query) {
      rows = rows.filter((r) => {
        const handle =
          r.handle ||
          r.seller_handle ||
          r.form_data?.handle ||
          `@${String(r.user_id || "seller").slice(0, 14)}`;
        const sellerName = String(r.name || r.seller_name || r.form_data?.name || "").trim();
        const hay = `${buildListingFilterHaystack(r)} ${handle} ${sellerName}`.toLowerCase();
        return hay.includes(query);
      });
    }

    // 4. 対応可能のみ
    if (latestState.availableOnly) {
      rows = rows.filter((r) => isAvailable(r));
    }

    // 5. 上位掲載のみ
    if (latestState.featuredOnly) {
      rows = rows.filter((r) => isFeaturedActive(r));
    }

    // 6. 評価4.5+
    if (latestState.rating45Only) {
      rows = rows.filter((r) => Number(r.review_average ?? 0) >= 4.5);
    }

    // 7. 価格帯
    if (latestState.priceRange) {
      const parseBand = String(latestState.priceRange);
      const [minRaw, maxRaw] = parseBand.split("-");
      const min = minRaw ? Number(minRaw) : 0;
      const max = maxRaw ? Number(maxRaw) : Infinity;
      rows = rows.filter((r) => {
        const amount = parsePriceAmount(r);
        if (!Number.isFinite(amount)) return false;
        return amount >= min && amount <= max;
      });
    }

    // 8. カテゴリ別詳細フィルター
    rows = applyCategoryTypedFilters(rows);

    // 9. ソート
    return sortLatestRows(rows);
  }

  function filterNewList() {
    return applyLatestFilters();
  }

  function hasActiveLatestFilters() {
    return Boolean(
      String(latestState.query || "").trim() ||
        latestState.category !== "all" ||
        latestState.availableOnly ||
        latestState.featuredOnly ||
        latestState.rating45Only ||
        latestState.priceRange ||
        latestState.sort !== "newest" ||
        hasActiveTypeFilters()
    );
  }

  function latestCountLabel(count) {
    const n = Number(count) || 0;
    const q = String(latestState.query || "").trim();
    if (q) return `「${q}」の検索結果：${n}件`;
    return `${n}件表示中`;
  }

  function updateLatestCount(count) {
    const total =
      typeof count === "number" && Number.isFinite(count) ? count : applyLatestFilters().length;
    const text = latestCountLabel(total);
    $$("[data-home-latest-count]").forEach((el) => {
      el.textContent = text;
    });
    $$("[data-home-latest-count-footer]").forEach((el) => {
      el.textContent = text;
    });
  }

  function updateFilterActiveState() {
    syncTabButtons();

    const q = String(latestState.query || "").trim();
    const form = $("[data-home-latest-search-form]");
    if (form) form.classList.toggle("has-query", Boolean(q));

    const pillChecked = [
      ["available", latestState.availableOnly],
      ["featured", latestState.featuredOnly],
      ["rating", latestState.rating45Only],
    ];
    pillChecked.forEach(([key, on]) => {
      const pill = $(`[data-home-filter-pill="${key}"]`);
      if (pill) pill.classList.toggle("is-checked", Boolean(on));
    });

    const pricePill = $('[data-home-filter-pill="price"]');
    if (pricePill) pricePill.classList.toggle("is-active", Boolean(latestState.priceRange));

    const sortWrap = $("[data-home-sort-wrap]");
    if (sortWrap) sortWrap.classList.toggle("is-active", latestState.sort !== "newest");

    const filterReset = $("[data-home-filter-reset]");
    if (filterReset) filterReset.hidden = !hasActiveLatestFilters();

    TYPE_FILTER_STATE_KEYS.forEach((key) => {
      const pill = $(`[data-home-filter-pill="${key}"]`);
      if (pill) pill.classList.toggle("is-active", Boolean(latestState[key]));
    });
  }

  function syncLatestFilterForm() {
    const q = $("[data-home-new-search]");
    if (q) q.value = latestState.query || "";
    const c1 = $("[data-home-filter-available]");
    const c2 = $("[data-home-filter-featured]");
    const c3 = $("[data-home-filter-rating]");
    const ps = $("[data-home-filter-price]");
    const ss = $("[data-home-sort]");
    if (c1) c1.checked = latestState.availableOnly;
    if (c2) c2.checked = latestState.featuredOnly;
    if (c3) c3.checked = latestState.rating45Only;
    if (ps) ps.value = latestState.priceRange || "";
    if (ss) ss.value = latestState.sort || "newest";
    TYPE_FILTER_STATE_KEYS.forEach((key) => {
      const sel = $(`[data-home-type-filter="${key}"]`);
      if (sel) sel.value = latestState[key] || "";
    });
    syncTabButtons();
    updateTypeFiltersVisibility();
    updateFilterActiveState();
  }

  function resetLatestFilters() {
    latestState.query = "";
    latestState.availableOnly = false;
    latestState.featuredOnly = false;
    latestState.rating45Only = false;
    latestState.priceRange = "";
    latestState.sort = "newest";
    latestState.category = "all";
    latestState.newVisible = NEW_PAGE_SIZE;
    resetCategorySpecificFilters();
    syncLatestFilterForm();
  }

  function refreshLatestList() {
    const filtered = applyLatestFilters();
    updateLatestCount(filtered.length);
    updateFilterActiveState();
    void renderLatestList(filtered);
  }

  function scheduleLatestRefresh() {
    clearTimeout(latestSearchTimer);
    latestSearchTimer = setTimeout(() => refreshLatestList(), 150);
  }

  async function renderLatestList(rowsAll) {
    const gen = ++latestRenderGen;
    const host = $("[data-home-new-list]");
    if (!host) return;
    const empty = $("[data-home-new-empty]");
    const moreWrap = $("[data-home-load-more]")?.closest(".home-more");
    const filtered = Array.isArray(rowsAll) ? rowsAll : applyLatestFilters();
    const rows = filtered.slice(0, latestState.newVisible);

    if (gen !== latestRenderGen) return;

    host.innerHTML = "";
    if (empty) empty.hidden = filtered.length !== 0;
    if (moreWrap) moreWrap.style.display = filtered.length > latestState.newVisible ? "" : "none";
    updateLatestCount(filtered.length);
    updateFilterActiveState();

    const profiles = await Promise.all(
      rows.map((it) => fetchSellerProfileCached(it.user_id || ""))
    );

    if (gen !== latestRenderGen) return;

    rows.forEach((it, idx) => {
      try {
        const sellerProfile = profiles[idx];
        const rankKey = resolveRankKeyFrom(it, sellerProfile);
        const rankCls = rankClassList(rankKey).join(" ");
        const rating = Number(it.review_average ?? 0);
        const accountLine = resolveAccountLine(it);
        const ratingText =
          rating > 0 ? `${renderStars(rating)} ${rating.toFixed(1)}${formatReviewCount(it.review_count)}` : "";
        const tags = (it.tags || it.displayTags || []).slice(0, 5);
        const typeLabel = TYPE_LABEL[it.listing_type] || "掲載";
        const sellerUserId = it.user_id || "";
        const available = isAvailable(it);
        const title = clampText(it.title);
        const desc = clampText(it.description, "");
        const cta = ctaLabel(it);
        const price = priceText(it);
        const showNewChip = (() => {
          const ts = it.created_at ? new Date(it.created_at).getTime() : 0;
          if (!ts) return false;
          return Date.now() - ts < 14 * 86400000;
        })();

        try {
          console.log("[index rank]", {
            title,
            sellerId: sellerUserId,
            rank: rankKey,
            sellerProfile,
          });
        } catch {
          // ignore
        }

        const card = document.createElement("div");
        card.className = `home-list-card list-card-seller ${rankCls}${isFeaturedActive(it) ? " is-featured" : ""}`;

        card.innerHTML = `
          <div class="home-list-thumb" aria-hidden="true">
            <div class="profile-rank-block">
              ${renderAvatarRingHtml(sellerUserId, rankCls, { emptyRing: true })}
              ${renderRankChipHtml(rankKey, rankCls, 'class="rank-chip"')}
            </div>
          </div>

          <div class="home-list-main">
            <div class="card-badges-row">
              <span class="type-pill">${escapeHtml(typeLabel)}</span>
              ${showNewChip ? `<span class="home-list-new">NEW</span>` : ""}
            </div>

            <div class="card-title-row home-list-title"><a href="${escapeHtml(detailUrl(it))}">${escapeHtml(title)}</a></div>
            ${accountLine ? `<div class="card-account-row">${escapeHtml(accountLine)}</div>` : ""}
            <div class="card-rating-row">
              ${ratingText ? `<span class="stars">${escapeHtml(ratingText)}</span>` : ""}
              ${available ? `<span class="home-list-availability"><span class="home-dot" aria-hidden="true"></span>対応可能</span>` : ""}
            </div>
            <div class="card-desc-row home-list-desc">${escapeHtml(desc)}</div>
            <div class="card-tags-row home-list-tags">${tags
              .map((t) => `<span class="home-list-tag">${escapeHtml(t)}</span>`)
              .join("")}</div>
          </div>

          <div class="home-list-side">
            <div class="home-list-price">${escapeHtml(price)}</div>
            <a class="btn-primary home-list-cta" href="${escapeHtml(detailUrl(it))}">${escapeHtml(cta)}</a>
            <button type="button" class="fav-round" data-favorite-button data-favorite-icon-only="1"
              data-target-type="${escapeHtml(it.listing_type)}" data-target-id="${escapeHtml(it.id)}" aria-label="お気に入り">♡</button>
          </div>
        `;

        host.appendChild(card);
      } catch (err) {
        console.error("[index-home] renderNewList item failed:", err, it);
      }
    });
    syncFavorites(host);
    hydrateSellerAvatars(host);
  }

  async function renderNewList() {
    return renderLatestList(applyLatestFilters());
  }

  function renderRecent() {
    const host = $("[data-home-recent]");
    if (!host) return;
    const recent = filterNewList().slice(0, 3);
    if (!recent.length) {
      host.innerHTML = `<li><span class="side-card__text">まだ閲覧履歴がありません</span></li>`;
      return;
    }
    host.innerHTML = recent
      .map(
        (it) => {
          const rankKey = resolveRankKeyFrom(it, null);
          const rankCls = rankClassList(rankKey).join(" ");
          return `
      <li class="list-card-seller ${escapeHtml(rankCls)}">
        <span class="side-recent__thumb">
          <div class="profile-rank-block profile-rank-block--xs">
            ${renderAvatarRingHtml(it.user_id || "", rankCls, { emptyRing: true })}
            ${renderRankChipHtml(rankKey, rankCls, 'class="rank-chip" style="transform:scale(0.62);transform-origin:center;max-width:64px"')}
          </div>
        </span>
        <a href="${escapeHtml(detailUrl(it))}">${escapeHtml(clampText(it.title))}</a>
        <span class="side-recent__price">${escapeHtml(priceText(it))}</span>
      </li>`
        }
      )
      .join("");
    hydrateSellerAvatars(host);
  }

  function syncTabButtons() {
    $$("[data-home-tab]").forEach((btn) => {
      const active = btn.dataset.homeTab === latestState.category;
      btn.classList.toggle("is-active", active);
    });
  }

  function syncFavorites(root) {
    const db = window.TasuFavoritesDb;
    if (!db?.isFavorite) return;
    (root || document)
      .querySelectorAll("[data-favorite-button][data-target-type][data-target-id]")
      .forEach((btn) => {
        const id = btn.dataset.targetId;
        const type = btn.dataset.targetType;
        if (!id || !type) return;
        const userId = "u_me";
        void db.isFavorite(userId, type, id).then((saved) => {
          const filter = db.buildFilter(userId, type, id);
          db.syncFavoriteButtonsUi(filter, saved, btn);
        });
      });
  }

  function bindControls() {
    $("[data-home-search]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = String($("[data-home-search-input]")?.value || "").trim();
      if (!q) return;
      window.location.href = `/listing-category-page.html?q=${encodeURIComponent(q)}`;
    });

    const applySearchFromInput = () => {
      latestState.query = String($("[data-home-new-search]")?.value || "").trim();
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    };

    $("[data-home-latest-search-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      applySearchFromInput();
    });

    $("[data-home-new-search-btn]")?.addEventListener("click", (e) => {
      e.preventDefault();
      applySearchFromInput();
    });

    $$("[data-home-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLatestCategory(btn.dataset.homeTab || "all");
        latestState.newVisible = NEW_PAGE_SIZE;
        syncLatestFilterForm();
        refreshLatestList();
        renderRecent();
      });
    });

    $$("[data-home-type-filter]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const key = e.target.dataset.homeTypeFilter;
        if (!key || !TYPE_FILTER_STATE_KEYS.includes(key)) return;
        latestState[key] = e.target.value || "";
        latestState.newVisible = NEW_PAGE_SIZE;
        refreshLatestList();
        renderRecent();
      });
    });

    $("[data-home-type-filters-toggle]")?.addEventListener("click", () => {
      const panel = $("[data-home-type-filters-panel]");
      const toggle = $("[data-home-type-filters-toggle]");
      if (!panel || !toggle) return;
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      panel.classList.toggle("is-collapsed", !open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    $("[data-home-sort]")?.addEventListener("change", (e) => {
      latestState.sort = e.target.value || "newest";
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    });

    $("[data-home-new-search]")?.addEventListener("input", (e) => {
      latestState.query = e.target.value || "";
      latestState.newVisible = NEW_PAGE_SIZE;
      updateLatestCount(applyLatestFilters().length);
      updateFilterActiveState();
      scheduleLatestRefresh();
      renderRecent();
    });

    $("[data-home-filter-available]")?.addEventListener("change", (e) => {
      latestState.availableOnly = Boolean(e.target.checked);
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    });

    $("[data-home-filter-featured]")?.addEventListener("change", (e) => {
      latestState.featuredOnly = Boolean(e.target.checked);
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    });

    $("[data-home-filter-rating]")?.addEventListener("change", (e) => {
      latestState.rating45Only = Boolean(e.target.checked);
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    });

    $("[data-home-filter-price]")?.addEventListener("change", (e) => {
      latestState.priceRange = e.target.value || "";
      latestState.newVisible = NEW_PAGE_SIZE;
      refreshLatestList();
      renderRecent();
    });

    const onResetFilters = () => {
      resetLatestFilters();
      refreshLatestList();
      renderRecent();
    };

    $("[data-home-new-reset]")?.addEventListener("click", onResetFilters);
    $("[data-home-filter-reset]")?.addEventListener("click", onResetFilters);

    $("[data-home-load-more]")?.addEventListener("click", () => {
      latestState.newVisible += NEW_PAGE_SIZE;
      refreshLatestList();
    });
  }

  async function init() {
    if (!document.body.classList.contains("home-page")) return;

    try {
      document.querySelectorAll('[data-home-tab="job"]').forEach((n) => n.remove());
      renderCategoryIcons();
      renderPopularTags();
      bindControls();
      initTypeFiltersPanel();
      syncLatestFilterForm();
    } catch (err) {
      console.error("[index-home] init (static render) failed:", err);
    }

    let all = [];
    let featuredRaw = [];
    try {
      [all, featuredRaw] = await Promise.all([loadListings(), loadFeatured()]);
      state.all = all;
    } catch (err) {
      console.error("[index-home] load listings failed:", err);
      state.all = DEMO_LISTINGS.slice();
      all = state.all;
      featuredRaw = [];
    }

    try {
      console.log("[index-home] listings total:", Array.isArray(all) ? all.length : 0);
      console.log(
        "[index-home] listings type snapshot:",
        (Array.isArray(all) ? all : []).slice(0, 30).map((it) => ({
          type: it?.type,
          listing_type: it?.listing_type,
          category: it?.category,
          category_key: it?.category_key,
          form_type: it?.form_type,
          item_type: it?.item_type,
        }))
      );
    } catch {
      // ignore
    }

    const featuredTop = pickFeaturedTop(featuredRaw, all);
    const sellerMap = new Map();
    await Promise.all(
      featuredTop.map(async (it) => {
        sellerMap.set(it.id, await resolveSeller(it));
      })
    );

    try {
      renderFeaturedCards(featuredTop, sellerMap);
    } catch (err) {
      console.error("[index-home] renderFeaturedCards failed:", err);
    }

    const generalOnly = (Array.isArray(all) ? all : []).filter(
      (r) => isAllowedGeneralType(r) && !isJobListing(r)
    );
    const popular = [...generalOnly].sort((a, b) => scorePopular(b) - scorePopular(a));
    const trending = [...generalOnly].sort((a, b) => scoreTrending(b) - scoreTrending(a));
    const rated = [...generalOnly].sort((a, b) => scoreHighRated(b) - scoreHighRated(a));

    try {
      renderRankColumn("[data-home-rank-popular]", popular);
      renderRankColumn("[data-home-rank-trending]", trending);
      renderRankColumn("[data-home-rank-rated]", rated);
    } catch (err) {
      console.error("[index-home] renderRankColumn failed:", err);
    }

    try {
      renderPrSection(all);
      refreshLatestList();
      renderRecent();
      syncFavorites(document);
    } catch (err) {
      console.error("[index-home] final render failed:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
