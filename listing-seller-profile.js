/**
 * 出品者プロフィール — users / profiles / members + review_scores
 *
 * sellerUserId をキーに3テーブルを分離取得:
 *   users    → handle（@ID）
 *   profiles → display_name, avatar_url, last_seen_at, availability_status, work_hours
 *   members  → rank, badge_image_url, is_premium, identity_verified, deals_count, followers_count
 */
(function () {
  "use strict";

  const AVAILABILITY_LABELS = {
    online: "オンライン",
    away: "離席中",
    busy: "対応中",
    offline: "オフライン",
  };

  /**
   * members.rank（text）— 表示ラベル兼ランク判定元
   * 正規化後: new / bronze / silver / gold / platinum / legend（枠・名前・LEGEND演出）
   * 例: "GOLD MEMBER" → gold, "legend" → legend
   */
  const VALID_RANKS = Object.freeze([
    "new",
    "bronze",
    "silver",
    "gold",
    "platinum",
    "legend",
  ]);

  /** members.rank 文字列から固定 rank へ（長い語・上位ランクを先に） */
  const RANK_LABEL_PATTERNS = Object.freeze([
    ["legend", "legend"],
    ["レジェンド", "legend"],
    ["master", "legend"],
    ["platinum", "platinum"],
    ["プラチナ", "platinum"],
    ["plat", "platinum"],
    ["premium", "gold"],
    ["プレミアム", "gold"],
    ["gold", "gold"],
    ["ゴールド", "gold"],
    ["silver", "silver"],
    ["シルバー", "silver"],
    ["bronze", "bronze"],
    ["ブロンズ", "bronze"],
    ["新規", "new"],
    ["new", "new"],
  ]);

  const RANK_PLATE_IMAGE_RANKS = VALID_RANKS;

  const RANK_PLATE_IMAGE_BASE = "images/rank";

  /** ランク別拡張子（未指定は webp）。LEGEND は白背景込み PNG を優先 */
  const RANK_PLATE_FILE_EXT = Object.freeze({
    legend: "png",
  });

  const RANK_LABELS = {
    new: "NEW",
    bronze: "BRONZE",
    silver: "SILVER",
    gold: "GOLD",
    platinum: "PLATINUM",
    legend: "LEGEND",
  };

  const DEMO_PROFILES = {
    u_sachi: {
      userId: "u_sachi",
      displayName: "はるかまん",
      handle: "watch_store",
      avatarUrl: "https://placehold.co/160x160/f3ead4/967622?text=S",
      memberRank: "platinum",
      rankKey: "platinum",
      memberBadgeUrl:
        "https://i.postimg.cc/c4PCckc2/purachinabajji-puratto-yong.png",
      identityVerified: true,
      isPremium: true,
      ndaCompatible: true,
      invoiceRegistered: true,
      officialCertified: true,
      responseTimeLabel: "3時間以内",
      deliveryEstimate: "3〜7日程度",
      dealsCount: 160,
      followersCount: 153,
      lastSeenAt: null,
      lastLoginLabel: "2時間前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
      workHours: "平日 10:00–19:00",
    },
    u_hiro: {
      userId: "u_hiro",
      displayName: "ひろ",
      handle: "hiro_creator",
      avatarUrl: "https://placehold.co/64x64/fff6df/7a5710?text=H",
      memberRank: "gold",
      rankKey: "gold",
      memberBadgeUrl: "",
      identityVerified: true,
      isPremium: false,
      dealsCount: 42,
      followersCount: 28,
      lastLoginLabel: "2時間前",
      availabilityStatus: "away",
      availabilityLabel: "離席中",
      workHours: "週末中心",
    },
    u_job_demo_full: {
      userId: "u_job_demo_full",
      displayName: "タスク確認株式会社",
      handle: "task_kakunin",
      jobListingCount: 4,
      avatarUrl: "https://placehold.co/160x160/e8efe4/5a6b4a?text=T",
      memberRank: "gold",
      rankKey: "gold",
      memberBadgeUrl: "",
      identityVerified: true,
      officialCertified: true,
      isPremium: true,
      responseTimeLabel: "24時間以内",
      dealsCount: 128,
      followersCount: 0,
      lastLoginLabel: "2時間前",
      availabilityStatus: "online",
      availabilityLabel: "オンライン",
      workHours: "平日 10:00–19:00",
      companyIntro:
        "YouTube動画編集・SNS運用を中心に、\nクリエイター支援とコンテンツ制作を行う会社です。\n\n企画・撮影・編集・運用まで\nワンストップでサポートしています。",
      mainServices: [
        "YouTube動画編集",
        "ショート動画制作",
        "SNS運用代行",
        "サムネイル制作",
        "企画・構成",
      ],
      companyOverview: {
        founded: "2020年6月",
        employees: "15名",
        business:
          "YouTube動画編集、SNS運用代行、デジタルマーケティング、コンテンツ制作",
        specialties: "エンタメ系、ビジネス系、教育系、Vlog、商品紹介",
        availableHours: "平日 10:00～19:00",
        serviceArea: "全国（フルリモート対応）",
      },
    },
    u_store: {
      userId: "u_store",
      displayName: "premium_home",
      handle: "premium_home",
      avatarUrl: "https://placehold.co/160x160/f3ead4/967622?text=PH",
      memberRank: "new",
      rankKey: "new",
      memberBadgeUrl: "",
      identityVerified: false,
      isPremium: true,
      dealsCount: 88,
      followersCount: 201,
      lastLoginLabel: "1日前",
      availabilityStatus: "offline",
      availabilityLabel: "オフライン",
      workHours: "要相談",
    },
  };

  function getClient() {
    return window.TasuSupabase?.getClient?.() || null;
  }

  function pick(row, keys, fallback = "") {
    if (!row) return fallback;
    for (let i = 0; i < keys.length; i += 1) {
      const value = row[keys[i]];
      if (value != null && value !== "") return value;
    }
    return fallback;
  }

  function safeStr(value, fallback) {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text === "undefined" || text === "null") return fallback;
    return text;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatHandle(handle, userId) {
    const raw = safeStr(handle, "");
    if (!raw) return userId ? `@${userId}` : "@—";
    return raw.startsWith("@") ? raw : `@${raw}`;
  }

  function formatRelativeLastSeen(iso) {
    if (!iso) return "";
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return "";
    const diff = Date.now() - ms;
    if (diff < 0) return "たった今";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "たった今";
    if (min < 60) return `${min}分前`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    return "30日以上前";
  }

  function resolveAvailabilityLabel(status) {
    const key = String(status || "").trim().toLowerCase();
    return AVAILABILITY_LABELS[key] || safeStr(status, "未設定");
  }

  function matchesRankPattern(haystackLatin, haystackOriginal, needle) {
    const n = String(needle);
    if (!n) return false;
    if (/[a-z]/i.test(n)) {
      return haystackLatin.includes(n.toLowerCase());
    }
    return haystackOriginal.includes(n);
  }

  /**
   * 文字列を rank 固定値へ。判定できない場合は null。
   * GOLD MEMBER / PLATINUM MEMBER / LEGEND SELLER / ゴールド 等に対応。
   */
  function parseRankValue(raw) {
    if (raw == null) return null;
    const original = String(raw).trim();
    if (!original) return null;

    const value = original.toLowerCase();
    if (VALID_RANKS.includes(value)) return value;

    const compact = value.replace(/[^a-z]/g, "");
    if (VALID_RANKS.includes(compact)) return compact;

    for (let i = 0; i < RANK_LABEL_PATTERNS.length; i += 1) {
      const needle = RANK_LABEL_PATTERNS[i][0];
      const rank = RANK_LABEL_PATTERNS[i][1];
      if (matchesRankPattern(value, original, needle)) return rank;
    }

    return null;
  }

  /** parseRankValue のショートカット（不明時 new） */
  function normalizeRankKey(raw) {
    return parseRankValue(raw) || "new";
  }

  /**
   * members.rank のみ — rankRaw は表示用、rank はデザイン用固定値
   */
  function resolveMemberRank(memberRow) {
    const rankRaw = safeStr(memberRow?.rank, "");
    const rank = parseRankValue(rankRaw) || "new";
    return { rank, rankRaw };
  }

  /** 小バッジ文言 — members.rank をそのまま（空なら正規化キーから生成） */
  function resolveRankBadgeLabel(rankRaw, rankKey) {
    const label = safeStr(rankRaw, "");
    if (label) return label;
    return RANK_LABELS[normalizeRankKey(rankKey)] || RANK_LABELS.new;
  }

  function resolveRankPlateImageKey(rankKey) {
    const key = normalizeRankKey(rankKey);
    return RANK_PLATE_IMAGE_RANKS.includes(key) ? key : "new";
  }

  function rankPlateFileExtension(rank) {
    return RANK_PLATE_FILE_EXT[rank] || "webp";
  }

  function rankPlateImageUrl(rankKey) {
    const rank = resolveRankPlateImageKey(rankKey);
    const ext = rankPlateFileExtension(rank);
    return `${RANK_PLATE_IMAGE_BASE}/${rank}.${ext}`;
  }

  function rankPlateImageAlt(rankKey) {
    const imageKey = resolveRankPlateImageKey(rankKey);
    return `${imageKey} member plate`;
  }

  function avatarPlaceholder(userId, displayName) {
    const label = String(displayName || userId || "?").charAt(0) || "?";
    return `https://placehold.co/160x160/f3ead4/967622?text=${encodeURIComponent(label)}`;
  }

  function normalizeSellerProfile(userRow, profileRow, memberRow, sellerUserId) {
    const uid = safeStr(sellerUserId, "");

    const displayName = safeStr(pick(profileRow, ["display_name"], ""), "出品者");
    const handle = safeStr(pick(userRow, ["handle"], ""), uid);
    const lastSeenAt = pick(profileRow, ["last_seen_at"], "");
    const availabilityStatus = pick(profileRow, ["availability_status"], "offline");

    const { rank: rankKey, rankRaw } = resolveMemberRank(memberRow);

    const memberAvatar =
      window.TasuMemberProfile?.getAvatarUrlForUser?.(uid) || "";

    return {
      userId: uid,
      displayName,
      handle,
      avatarUrl:
        memberAvatar ||
        pick(profileRow, ["avatar_url"], "") ||
        avatarPlaceholder(uid, displayName),
      memberRank: rankKey,
      rankKey,
      rankRaw,
      memberBadgeUrl: pick(memberRow, ["badge_image_url"], ""),
      identityVerified: Boolean(memberRow?.identity_verified ?? false),
      isPremium: Boolean(memberRow?.is_premium ?? false),
      ndaCompatible: false,
      invoiceRegistered: false,
      officialCertified: false,
      responseTimeLabel: "—",
      deliveryEstimate: "—",
      dealsCount: Number(memberRow?.deals_count ?? NaN),
      followersCount: Number(memberRow?.followers_count ?? NaN),
      lastSeenAt: lastSeenAt || null,
      lastLoginLabel: formatRelativeLastSeen(lastSeenAt) || "—",
      availabilityStatus,
      availabilityLabel: resolveAvailabilityLabel(availabilityStatus),
      workHours: pick(profileRow, ["work_hours"], "未設定"),
      source: "supabase",
    };
  }

  function isRankPreviewHost() {
    const host = String(window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    return new URLSearchParams(window.location.search).get("rankPreview") === "1";
  }

  /** URL の ?rank= でプレビュー（DBの members.rank は変更しない） */
  function getQueryRankParam() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("rank")) return null;
    return normalizeRankKey(params.get("rank"));
  }

  function applyRankQueryOverride(profile) {
    const override = getQueryRankParam();
    if (!profile || override === null) return profile;
    return {
      ...profile,
      memberRank: override,
      rankKey: override,
      rankRaw: RANK_LABELS[override] || override,
      rankFromQuery: true,
    };
  }

  /** u_me は DB 専用（デモ固定文言は使わない） */
  function resolveMissingUmeProfile() {
    return {
      userId: "u_me",
      displayName: "（DB未登録）ランク確認用出品者",
      handle: "tasu_rank_test",
      avatarUrl: "https://placehold.co/160x160/f5f5f4/a3a3a3?text=T",
      memberRank: "new",
      rankKey: "new",
      memberBadgeUrl: "",
      identityVerified: false,
      isPremium: false,
      ndaCompatible: false,
      invoiceRegistered: false,
      officialCertified: false,
      responseTimeLabel: "—",
      deliveryEstimate: "—",
      dealsCount: NaN,
      followersCount: NaN,
      lastLoginLabel: "—",
      availabilityStatus: "offline",
      availabilityLabel: "未設定",
      workHours: "未設定",
      source: "missing-db",
    };
  }

  function resolveDemoProfile(userId) {
    const uid = safeStr(userId, "");
    if (!uid) return null;

    if (uid === "u_me") {
      return resolveMissingUmeProfile();
    }

    if (DEMO_PROFILES[uid]) {
      return { ...DEMO_PROFILES[uid], source: "demo" };
    }

    return {
      userId: uid,
      displayName: uid,
      handle: uid,
      avatarUrl: avatarPlaceholder(uid, uid),
      memberRank: "",
      rankKey: "new",
      memberBadgeUrl: "",
      identityVerified: false,
      isPremium: false,
      ndaCompatible: false,
      invoiceRegistered: false,
      officialCertified: false,
      responseTimeLabel: "—",
      deliveryEstimate: "—",
      dealsCount: NaN,
      followersCount: NaN,
      lastLoginLabel: "—",
      availabilityStatus: "offline",
      availabilityLabel: "未設定",
      workHours: "未設定",
      source: "fallback",
    };
  }

  function resolveSellerUserIdForMemberLookup(options = {}) {
    const listing = options.listing || null;
    const listingUserId = safeStr(
      pick(listing, ["user_id", "userId"], ""),
      ""
    );
    const listingSellerId = safeStr(
      pick(listing, ["seller_id", "sellerId"], ""),
      ""
    );
    const passedUserId = safeStr(options.userId, "");
    const urlUserId = getQuerySellerUserId();

    return listingUserId || listingSellerId || passedUserId || urlUserId || "";
  }

  function resolvePrimaryMemberQueryUserId(options = {}) {
    const urlUserId = getQuerySellerUserId();
    const sellerUserId = resolveSellerUserIdForMemberLookup(options);
    const listingUserId = safeStr(
      pick(options.listing, ["user_id", "userId"], ""),
      ""
    );

    return (
      safeStr(urlUserId, "") ||
      safeStr(sellerUserId, "") ||
      safeStr(listingUserId, "") ||
      safeStr(options.userId, "")
    );
  }

  function buildMemberQueryUserIds(options = {}) {
    const urlUserId = getQuerySellerUserId();
    const sellerUserId = resolveSellerUserIdForMemberLookup(options);
    const listingUserId = safeStr(
      pick(options.listing, ["user_id", "userId"], ""),
      ""
    );
    const listingSellerId = safeStr(
      pick(options.listing, ["seller_id", "sellerId"], ""),
      ""
    );
    const listingMemberId = safeStr(
      pick(options.listing, ["member_id", "memberId"], ""),
      ""
    );

    const ordered = [
      sellerUserId,
      listingUserId,
      listingSellerId,
      urlUserId,
      listingMemberId,
      safeStr(options.userId, ""),
      resolvePrimaryMemberQueryUserId(options),
    ];

    const seen = new Set();
    return ordered.filter((id) => {
      const v = safeStr(id, "");
      if (!v || seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  }

  async function fetchUserRow(sb, sellerUserId) {
    const queryUserId = safeStr(sellerUserId, "");
    console.log("[TasuListingSellerProfile] users queryUserId (before fetch)", queryUserId);

    const { data, error } = await sb
      .from("users")
      .select("id, handle")
      .eq("id", queryUserId);

    console.log("users raw result", { queryUserId, data, error });

    return { row: data?.[0] || null, error };
  }

  async function fetchProfileRow(sb, sellerUserId) {
    const queryUserId = safeStr(sellerUserId, "");
    console.log("[TasuListingSellerProfile] profiles queryUserId (before fetch)", queryUserId);

    const { data, error } = await sb
      .from("profiles")
      .select(
        "user_id, display_name, avatar_url, last_seen_at, availability_status, work_hours"
      )
      .eq("user_id", queryUserId);

    console.log("profiles raw result", { queryUserId, data, error });

    return { row: data?.[0] || null, error };
  }

  /** members — user_id のみ（PK）。配列取得 → data[0] */
  async function fetchMemberRow(sb, sellerUserId, options = {}) {
    const urlUserId = getQuerySellerUserId();
    const primarySellerUserId = safeStr(sellerUserId, "");
    const queryUserIds = buildMemberQueryUserIds({
      ...options,
      userId: primarySellerUserId,
    });

    let member = null;
    let memberError = null;
    let queryUserId = "";
    let memberQueryMode = null;

    for (let i = 0; i < queryUserIds.length; i += 1) {
      queryUserId = queryUserIds[i];
      console.log("[TasuListingSellerProfile] members queryUserId (before fetch)", queryUserId);

      const { data, error } = await sb
        .from("members")
        .select(
          "user_id, rank, badge_image_url, is_premium, identity_verified, deals_count, followers_count"
        )
        .eq("user_id", queryUserId);

      memberError = error || null;

      console.log("members raw result", { queryUserId, data, error });

      const row = data?.[0] || null;

      console.log("member query result", {
        queryUserId,
        member: row,
        memberError,
        rowCount: Array.isArray(data) ? data.length : 0,
      });

      if (memberError) {
        console.warn("[TasuListingSellerProfile] members lookup error:", memberError);
        continue;
      }

      if (row) {
        member = row;
        memberQueryMode = "members.user_id";
        break;
      }
    }

    return {
      member,
      memberQueryMode,
      memberError,
      queryUserId,
      urlUserId,
      sellerUserId: primarySellerUserId,
    };
  }

  async function fetchUserTables(userId, options = {}) {
    const sb = getClient();
    const sellerUserId = resolveSellerUserIdForMemberLookup({
      ...options,
      userId: safeStr(userId, ""),
    });
    if (!sb || !sellerUserId) return null;

    try {
      const [userLookup, profileLookup, memberLookup] = await Promise.all([
        fetchUserRow(sb, sellerUserId),
        fetchProfileRow(sb, sellerUserId),
        fetchMemberRow(sb, sellerUserId, options),
      ]);

      const userRow = userLookup.row;
      const profileRow = profileLookup.row;
      const memberRow = memberLookup.member;

      console.log("[TasuListingSellerProfile] seller tables", {
        sellerUserId,
        user: userRow,
        profile: profileRow,
        member: memberRow,
        rank: memberRow?.rank,
        rankRaw: memberRow?.rank,
        supabaseUrl: window.TasuSupabase?.getConfig?.()?.url,
      });

      const errors = [userLookup.error, profileLookup.error, memberLookup.memberError].filter(
        Boolean
      );
      if (errors.length) {
        const missingTable = errors.some(
          (e) =>
            String(e.code) === "42P01" ||
            /relation.*does not exist/i.test(String(e.message || ""))
        );
        if (missingTable) return null;
        console.warn("[TasuListingSellerProfile] fetch tables:", errors);
      }

      const hasAny = userRow || profileRow || memberRow;
      if (!hasAny) {
        console.warn(
          "[TasuListingSellerProfile] users / profiles / members いずれも未取得:",
          sellerUserId
        );
        return null;
      }

      const profile = normalizeSellerProfile(
        userRow,
        profileRow,
        memberRow,
        sellerUserId
      );
      profile.memberQueryMode = memberLookup.memberQueryMode;
      profile.memberRow = memberRow || null;
      profile.userRow = userRow || null;
      profile.profileRow = profileRow || null;
      return profile;
    } catch (err) {
      console.warn("[TasuListingSellerProfile] fetch failed:", err);
      return null;
    }
  }

  async function fetchPublicListingCount(userId) {
    const sb = getClient();
    const uid = safeStr(userId, "");
    if (!sb || !uid) return null;

    try {
      const { count, error } = await sb
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("publish_status", "public");

      if (error) {
        console.warn("[TasuListingSellerProfile] listings count:", error);
        return null;
      }
      return Number.isFinite(count) ? count : null;
    } catch {
      return null;
    }
  }

  function genericFallbackProfile() {
    return {
      userId: "",
      displayName: "出品者",
      handle: "",
      avatarUrl: avatarPlaceholder("", "出品者"),
      memberRank: "",
      rankKey: "new",
      memberBadgeUrl: "",
      identityVerified: false,
      isPremium: false,
      dealsCount: NaN,
      followersCount: NaN,
      lastLoginLabel: "—",
      availabilityStatus: "offline",
      availabilityLabel: "未設定",
      workHours: "未設定",
      dealsLabel: "—",
      followersLabel: "—",
      source: "fallback",
    };
  }

  function enrichJobCompanyProfileMeta(profile, userId) {
    if (!profile || typeof profile !== "object") return profile;
    const uid = safeStr(userId, profile.userId || "");
    const demo = DEMO_PROFILES[uid];
    if (!demo) return profile;

    if (
      !Number.isFinite(profile.jobListingCount) &&
      Number.isFinite(demo.jobListingCount)
    ) {
      profile.jobListingCount = demo.jobListingCount;
    }

    if (
      !Number.isFinite(profile.dealsCount) &&
      Number.isFinite(demo.dealsCount)
    ) {
      profile.dealsCount = demo.dealsCount;
    }

    const responseTime = safeStr(profile.responseTimeLabel, "");
    if ((!responseTime || responseTime === "—") && demo.responseTimeLabel) {
      profile.responseTimeLabel = demo.responseTimeLabel;
    }

    return profile;
  }

  async function fetchSellerProfile(userId, options = {}) {
    const uid = safeStr(userId, "");
    if (!uid) return genericFallbackProfile();

    const fromDb = await fetchUserTables(uid, options);
    let profile = fromDb || resolveDemoProfile(uid);
    profile = applyRankQueryOverride(profile);
    profile = enrichJobCompanyProfileMeta(profile, uid);

    if (Number.isFinite(profile.dealsCount) && profile.dealsCount >= 0) {
      profile.dealsLabel = `${profile.dealsCount}件`;
    } else {
      profile.dealsLabel = "—";
    }

    if (Number.isFinite(profile.followersCount) && profile.followersCount >= 0) {
      profile.followersLabel = `${profile.followersCount}`;
    } else {
      profile.followersLabel = "—";
    }

    return profile;
  }

  function formatDealsDisplay(profile) {
    return safeStr(profile.dealsLabel, "—");
  }

  function isJobDetailPage() {
    return document.body?.dataset?.detailType === "job";
  }

  function buildJobCompanyBadges(profile) {
    const badges = [];
    if (profile.identityVerified) {
      badges.push({ label: "本人確認済み", variant: "verified" });
    }
    if (profile.officialCertified) {
      badges.push({ label: "法人認証", variant: "official" });
    }
    return badges;
  }

  function extractJobCompanyListingMeta(listing) {
    if (!listing || typeof listing !== "object") {
      return { location: "—", industry: "—", recruitmentStatus: "—" };
    }

    const fd = listing.form_data || listing.formData || {};
    const Fields = window.TasuJobListingFields;
    const location =
      safeStr(listing.job_location, "") ||
      safeStr(fd.job_location, "") ||
      safeStr(fd.location, "") ||
      safeStr(listing.service_area, "") ||
      safeStr(fd.service_area, "") ||
      safeStr(fd.area, "") ||
      "—";
    const industry =
      safeStr(
        Fields?.normalizeCategoryValue?.(fd.jobCategory) ||
          Fields?.normalizeCategoryValue?.(fd.category) ||
          listing.category ||
          fd.jobCategory ||
          fd.category ||
          listing.industryLabel,
        ""
      ) || "—";
    const recruitmentStatus =
      String(listing.publish_status || "public").trim() === "public"
        ? "募集中"
        : "—";

    return { location, industry, recruitmentStatus };
  }

  function withFetchTimeout(promise, ms, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label || "fetch"} timeout (${ms}ms)`)),
        ms
      );
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function countDemoCatalogPublicJobs(userId) {
    if (!window.TasuListingDemoCatalog?.STORE_BY_ID) return 0;
    return Object.values(window.TasuListingDemoCatalog.STORE_BY_ID).filter(
      (row) =>
        safeStr(row?.listing_type, "") === "job" &&
        safeStr(row?.user_id, "") === userId &&
        safeStr(row?.publish_status, "public") === "public"
    ).length;
  }

  async function fetchPublicJobListingCount(userId) {
    const uid = safeStr(userId, "");
    if (!uid) return null;

    const demoCount = countDemoCatalogPublicJobs(uid);
    if (demoCount > 0) return demoCount;

    const sb = window.TasuSupabase?.getClient?.();
    if (sb) {
      try {
        const { count, error } = await withFetchTimeout(
          sb
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .eq("listing_type", "job")
            .eq("publish_status", "public"),
          4000,
          "job listing count"
        );
        if (!error && Number.isFinite(count) && count > 0) return count;
      } catch (err) {
        console.warn("[listing-seller-profile] job listing count skipped:", err);
      }
    }

    if (window.TasuListingStore?.fetchPublishedListings) {
      try {
        const published = await withFetchTimeout(
          window.TasuListingStore.fetchPublishedListings({
            listing_type: "job",
            limit: 40,
            public_only: true,
          }),
          4000,
          "published job listings"
        );
        const count = (published || []).filter(
          (item) => safeStr(item?.user_id, "") === uid
        ).length;
        if (count > 0) return count;
      } catch (err) {
        console.warn("[listing-seller-profile] published job listings skipped:", err);
      }
    }

    return null;
  }

  async function resolveJobListingCountLabel(userId) {
    const demoProfile = DEMO_PROFILES[safeStr(userId, "")];
    if (
      Number.isFinite(demoProfile?.jobListingCount) &&
      demoProfile.jobListingCount >= 0
    ) {
      return `${demoProfile.jobListingCount}件`;
    }

    const count = await fetchPublicJobListingCount(userId);
    return Number.isFinite(count) && count >= 0 ? `${count}件` : "—";
  }

  function renderJobCompanyBadgeMarkup(badge) {
    return `<span class="job-company-badge job-company-badge--${escapeHtml(badge.variant)}"><span class="job-company-badge__icon" aria-hidden="true">✓</span><span class="job-company-badge__label">${escapeHtml(badge.label)}</span></span>`;
  }

  function renderJobCompanyBadges(host, profile) {
    if (!host) return;
    const badges = buildJobCompanyBadges(profile);
    if (!badges.length) {
      host.innerHTML =
        '<span class="job-company-badge job-company-badge--muted">認証情報なし</span>';
      return;
    }
    host.innerHTML = badges.map((badge) => renderJobCompanyBadgeMarkup(badge)).join("");
  }

  const JOB_COMPANY_OVERVIEW_FIELDS = [
    { key: "founded", label: "設立" },
    { key: "employees", label: "従業員数" },
    { key: "business", label: "事業内容" },
    { key: "specialties", label: "得意ジャンル" },
    { key: "availableHours", label: "対応可能時間" },
    { key: "serviceArea", label: "対応エリア" },
  ];

  function extractJobCompanyProfileDetails(profile, listing) {
    const fd = listing?.form_data || listing?.formData || {};
    const overviewFromProfile = profile?.companyOverview || {};
    const overviewFromForm = fd.company_overview || fd.companyOverview || {};

    const intro =
      safeStr(profile?.companyIntro, "") ||
      safeStr(fd.company_intro, "") ||
      safeStr(fd.company_description, "") ||
      safeStr(fd.company_bio, "") ||
      safeStr(listing?.company_description, "");

    let mainServices = [];
    if (Array.isArray(profile?.mainServices) && profile.mainServices.length) {
      mainServices = profile.mainServices;
    } else if (Array.isArray(fd.main_services)) {
      mainServices = fd.main_services;
    } else if (Array.isArray(fd.mainServices)) {
      mainServices = fd.mainServices;
    } else if (typeof fd.main_services === "string") {
      mainServices = fd.main_services.split(/[,、]/).map((t) => t.trim());
    }

    const overview = {};
    JOB_COMPANY_OVERVIEW_FIELDS.forEach(({ key, label }) => {
      const formKeyMap = {
        founded: ["founded", "established", "company_founded"],
        employees: ["employees", "employee_count", "company_employees"],
        business: ["business", "business_content", "company_business"],
        specialties: ["specialties", "specialty", "company_specialties"],
        availableHours: [
          "available_hours",
          "availableHours",
          "work_hours",
          "company_hours",
        ],
        serviceArea: ["service_area", "serviceArea", "company_area", "area"],
      };
      const keys = formKeyMap[key] || [key];
      let value = safeStr(overviewFromProfile[key], "");
      if (!value) {
        for (let i = 0; i < keys.length; i += 1) {
          const candidate = safeStr(overviewFromForm[keys[i]], "");
          if (candidate) {
            value = candidate;
            break;
          }
        }
      }
      if (!value) {
        for (let i = 0; i < keys.length; i += 1) {
          const candidate = safeStr(fd[keys[i]], "");
          if (candidate) {
            value = candidate;
            break;
          }
        }
      }
      if (!value && key === "availableHours") {
        value = safeStr(profile?.workHours, "");
      }
      if (!value && key === "serviceArea") {
        value =
          safeStr(listing?.job_location, "") ||
          safeStr(fd.location, "") ||
          safeStr(fd.service_area, "");
      }
      if (value && value !== "—") {
        overview[key] = { label, value };
      }
    });

    return {
      intro,
      mainServices: mainServices.filter(Boolean),
      overview,
    };
  }

  function renderJobCompanyIntro(host, intro) {
    if (!host) return;
    const text = safeStr(intro, "");
    if (!text) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }
    host.innerHTML = text
      .split(/\n{2,}|\r\n\r\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeHtml(block.replace(/\n/g, " "))}</p>`)
      .join("");
    host.hidden = false;
  }

  function renderJobCompanyServices(section, services) {
    const wrap = section.querySelector("[data-job-company-services-wrap]");
    const host = section.querySelector("[data-job-company-services]");
    if (!host) return;
    const items = (services || []).map((s) => safeStr(s, "")).filter(Boolean);
    if (!items.length) {
      host.innerHTML = "";
      if (wrap) {
        wrap.hidden = true;
      }
      return;
    }
    host.innerHTML = items
      .map(
        (item) =>
          `<li class="job-company-renewal__service-tag">${escapeHtml(item)}</li>`
      )
      .join("");
    if (wrap) {
      wrap.hidden = false;
    }
  }

  function renderJobCompanyOverview(section, overview) {
    const wrap = section.querySelector("[data-job-company-overview-wrap]");
    const host = section.querySelector("[data-job-company-overview]");
    if (!host) return;
    const rows = JOB_COMPANY_OVERVIEW_FIELDS.map(({ key, label }) => {
      const row = overview?.[key];
      if (!row?.value) return "";
      return `<div class="job-company-renewal__overview-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(row.value)}</dd>
      </div>`;
    }).filter(Boolean);

    if (!rows.length) {
      host.innerHTML = "";
      if (wrap) {
        wrap.hidden = true;
      }
      return;
    }
    host.innerHTML = rows.join("");
    if (wrap) {
      wrap.hidden = false;
    }
  }

  async function renderJobCompanySection(profile, options = {}) {
    const section = document.querySelector("[data-listing-seller]");
    if (!section || !profile) return;

    const listingMeta = extractJobCompanyListingMeta(options.listing);
    const profileDetails = extractJobCompanyProfileDetails(
      profile,
      options.listing
    );
    const listingCountLabel = await resolveJobListingCountLabel(profile.userId);

    const avatarWrap = section.querySelector("[data-job-company-avatar]");
    const avatarHost = avatarWrap || section.querySelector("[data-seller-avatar]");
    const Renderer = window.TasuJobTopRenderer;
    if (avatarWrap && Renderer?.buildCompanyAvatarHtml) {
      avatarWrap.innerHTML = Renderer.buildCompanyAvatarHtml({
        companyName: profile.displayName,
        thumbnail: profile.avatarUrl,
        sizeClass: "job-company-avatar--panel",
        alt: `${profile.displayName || "掲載企業"}のロゴ`,
      });
    } else if (avatarHost && avatarHost.tagName === "IMG") {
      avatarHost.src = profile.avatarUrl || avatarPlaceholder(profile.userId, profile.displayName);
      avatarHost.alt = `${profile.displayName || "掲載企業"}のロゴ`;
      avatarHost.className = "job-company-card__avatar profile-avatar";
    }

    setText("[data-seller-display-name]", safeStr(profile.displayName, "掲載者"));
    setText("[data-job-company-location]", listingMeta.location);
    setText("[data-job-company-industry]", listingMeta.industry);
    setText("[data-job-company-recruitment-status]", listingMeta.recruitmentStatus);
    setStatValueHtml("[data-job-company-listing-count]", listingCountLabel);
    setStatValueHtml("[data-seller-response-time]", safeStr(profile.responseTimeLabel, "—"));
    setStatValueHtml(
      "[data-seller-last-login]",
      profile.lastLoginLabel && profile.lastLoginLabel !== "—"
        ? profile.lastLoginLabel
        : "—"
    );
    setStatValueHtml("[data-seller-deals]", formatDealsDisplay(profile));

    const isOnline = safeStr(profile.availabilityStatus, "offline") === "online";
    const onlineWrap = section.querySelector("[data-seller-status-online]");
    const statusLabelEl = section.querySelector("[data-seller-status-label]");
    const statusDot = section.querySelector("[data-seller-status-dot]");

    if (statusLabelEl) {
      statusLabelEl.textContent = "オンライン";
    }

    if (onlineWrap) {
      onlineWrap.hidden = !isOnline;
      onlineWrap.classList.toggle("job-company-renewal__online--active", isOnline);
    }

    if (statusDot) {
      statusDot.className = "job-company-renewal__online-dot";
      if (isOnline) {
        statusDot.classList.add("job-company-renewal__online-dot--active");
      }
    }

    renderJobCompanyBadges(section.querySelector("[data-seller-badges]"), profile);
    renderJobCompanyIntro(
      section.querySelector("[data-job-company-intro]"),
      profileDetails.intro
    );
    renderJobCompanyServices(section, profileDetails.mainServices);
    renderJobCompanyOverview(section, profileDetails.overview);

    section.setAttribute("data-author-user-id", profile.userId || "");
    section.dataset.sellerSource = profile.source || "";
    delete section.dataset.sellerRank;
    section.removeAttribute("data-seller-rank");
    section.hidden = false;
    section.setAttribute("data-detail-keep", "");

    if (profile.userId) {
      document.body.dataset.authorUserId = profile.userId;
      document.body.dataset.sellerUserId = profile.userId;
    }

  }

  function buildBadges(profile) {
    const badges = [];
    if (profile.identityVerified) {
      badges.push({ label: "本人確認済み", variant: "verified" });
    }
    if (!isJobDetailPage() && profile.isPremium) {
      badges.push({ label: "プレミアム", variant: "premium" });
    }
    if (profile.ndaCompatible) {
      badges.push({ label: "NDA対応", variant: "nda" });
    }
    if (profile.invoiceRegistered) {
      badges.push({ label: "インボイス", variant: "invoice" });
    }
    if (profile.officialCertified) {
      badges.push({ label: "公式認定", variant: "official" });
    }
    if (profile.availabilityStatus === "online") {
      badges.push({ label: "オンライン", variant: "online" });
    }
    return badges;
  }

  /**
   * プロフィール枠色・名前色・ランクチップ（プレート非表示）
   */
  function applySellerRankDisplay(section, profile) {
    if (!section || !profile) return;

    if (document.body?.dataset?.detailType === "job") {
      const avatar = section.querySelector("[data-seller-avatar]");
      const chip = section.querySelector("[data-seller-rank-chip]");
      if (chip) {
        chip.hidden = true;
        chip.textContent = "";
      }
      VALID_RANKS.forEach((rank) => {
        if (avatar) avatar.classList.remove(`rank-${rank}`);
        section.querySelectorAll("[data-seller-display-name], .seller-name").forEach((el) => {
          el.classList.remove(`rank-${rank}`, "seller-name");
        });
      });
      if (avatar) avatar.classList.add("profile-avatar");
      delete section.dataset.sellerRank;
      return;
    }

    const rankKey = normalizeRankKey(profile.rankKey || profile.memberRank);
    const rankClass = resolveRankPlateImageKey(rankKey);
    const rankLabel = resolveRankBadgeLabel(profile.rankRaw, rankKey);

    const avatar = section.querySelector("[data-seller-avatar]");
    const nameEls = section.querySelectorAll(
      "[data-seller-display-name], .seller-name"
    );
    const chip = section.querySelector("[data-seller-rank-chip]");

    VALID_RANKS.forEach((rank) => {
      if (avatar) avatar.classList.remove(`rank-${rank}`);
      nameEls.forEach((el) => el.classList.remove(`rank-${rank}`));
      if (chip) chip.classList.remove(`rank-${rank}`);
    });

    if (avatar) {
      avatar.classList.add("profile-avatar", `rank-${rankClass}`);
    }
    nameEls.forEach((el) => {
      el.classList.add("seller-name", `rank-${rankClass}`);
    });
    if (chip) {
      chip.textContent = rankLabel;
      chip.classList.add("seller-rank-chip", `rank-${rankClass}`);
      chip.hidden = false;
    }

    section.dataset.sellerRank = rankKey;
  }

  /** @deprecated プレート非使用 — applySellerRankDisplay を使用 */
  function renderRankPlate(section, profile) {
    applySellerRankDisplay(section, profile);
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  /** 統計値 — 意味単位での改行（24時間/以内、2時間/前 など） */
  function formatJobRenewalStatValueHtml(text) {
    const raw = safeStr(text, "—");
    if (!raw || raw === "—") return escapeHtml(raw);

    const timeMatch = raw.match(/^(\d+(?:時間|日|分|週間|ヶ月|か月))(.+)$/u);
    if (timeMatch) {
      return (
        `<span class="job-company-renewal__stat-value-stack" aria-label="${escapeHtml(raw)}">` +
        `<span class="job-company-renewal__stat-value-part">${escapeHtml(timeMatch[1])}</span>` +
        `<span class="job-company-renewal__stat-value-part">${escapeHtml(timeMatch[2])}</span>` +
        `</span>`
      );
    }

    return `<span class="job-company-renewal__stat-value-plain">${escapeHtml(raw)}</span>`;
  }

  function setStatValueHtml(selector, text) {
    const html = formatJobRenewalStatValueHtml(text);
    document.querySelectorAll(selector).forEach((el) => {
      el.innerHTML = html;
    });
  }

  function renderBadges(host, profile) {
    if (!host) return;
    const badges = buildBadges(profile);
    if (!badges.length) {
      host.innerHTML =
        '<span class="skill-seller-badge skill-seller-badge--muted">バッジ情報なし</span>';
      return;
    }
    host.innerHTML = badges
      .map(
        (b) =>
          `<span class="skill-seller-badge tag-chip skill-seller-badge--${escapeHtml(b.variant)}">${escapeHtml(b.label)}</span>`
      )
      .join("");
  }

  function renderPremiumCardMetrics(host, profile, trust, extras = {}) {
    const metricsHost = host?.querySelector("[data-premium-seller-metrics]");
    if (!metricsHost) return;

    const items = [];
    const salesRaw = extras.salesCount ?? profile.dealsCount;
    const salesNum = Number(salesRaw);
    if (Number.isFinite(salesNum) && salesNum >= 0) {
      items.push({ label: "販売", value: `${salesNum}件` });
    } else if (profile.dealsLabel && profile.dealsLabel !== "—") {
      items.push({ label: "販売", value: profile.dealsLabel });
    }

    if (trust?.variant === "rated") {
      items.push({
        label: "評価",
        value: `${trust.average}（${trust.total}件）`,
      });
    }

    const followersNum = Number(profile.followersCount);
    if (Number.isFinite(followersNum) && followersNum >= 0) {
      items.push({ label: "フォロワー", value: profile.followersLabel || String(followersNum) });
    }

    const regNum = Number(extras.registrationCount);
    if (Number.isFinite(regNum) && regNum >= 0) {
      items.push({ label: "登録", value: `${regNum}件` });
    } else if (Number.isFinite(extras.listingCount) && extras.listingCount >= 0) {
      items.push({ label: "登録", value: `${extras.listingCount}件` });
    }

    if (!items.length) {
      metricsHost.hidden = true;
      metricsHost.innerHTML = "";
      return;
    }

    metricsHost.hidden = false;
    metricsHost.innerHTML = items
      .map(
        (item) =>
          `<div class="premium-listing-seller__metric"><span class="premium-listing-seller__metric-label">${escapeHtml(item.label)}</span><strong class="premium-listing-seller__metric-value">${escapeHtml(item.value)}</strong></div>`
      )
      .join("");
  }

  function renderPremiumCardSeller(host, profile, options = {}) {
    if (!host || !profile) return;

    applySellerRankDisplay(host, profile);

    const avatar = host.querySelector("[data-seller-avatar]");
    if (avatar) {
      avatar.src =
        profile.avatarUrl || avatarPlaceholder(profile.userId, profile.displayName);
      avatar.alt = `${safeStr(profile.displayName, "出品者")}のプロフィール`;
    }

    const nameEl = host.querySelector("[data-seller-display-name]");
    if (nameEl) {
      nameEl.textContent = safeStr(profile.displayName, "出品者");
    }

    const handleEl = host.querySelector("[data-seller-handle]");
    if (handleEl) {
      handleEl.textContent = formatHandle(profile.handle, profile.userId);
    }

    const status = safeStr(profile.availabilityStatus, "offline");
    const isOnline = status === "online";
    const statusLabelEl = host.querySelector("[data-seller-status-label]");
    if (statusLabelEl) {
      statusLabelEl.textContent = isOnline
        ? safeStr(profile.availabilityLabel, "オンライン")
        : profile.lastLoginLabel && profile.lastLoginLabel !== "—"
          ? `最終ログイン ${profile.lastLoginLabel}`
          : safeStr(profile.availabilityLabel, "オフライン");
      statusLabelEl.classList.toggle("is-online", isOnline);
      statusLabelEl.classList.toggle("is-offline", !isOnline);
    }

    const statusDot = host.querySelector("[data-seller-status-dot]");
    if (statusDot) {
      statusDot.className = `skill-seller-premium__status-dot skill-seller-premium__status-dot--${status}`;
      statusDot.setAttribute(
        "aria-label",
        safeStr(profile.availabilityLabel, "稼働状況")
      );
    }

    renderPremiumCardMetrics(host, profile, options.trust || null, options.extras || {});
  }

  async function hydratePremiumCardSeller(host, options = {}) {
    if (!host || host.dataset.sellerHydrated === "1") return null;
    const userId = safeStr(host.dataset.sellerUserId, "");
    if (!userId) return null;

    host.dataset.sellerHydrated = "1";
    const profile = await fetchSellerProfile(userId, options);
    let trust = null;
    if (window.TasuDetailTrustScore?.fetchReviewScore) {
      const row = await window.TasuDetailTrustScore.fetchReviewScore(userId);
      trust = window.TasuDetailTrustScore.formatTrustDisplay(row);
    }

    const extras = { ...(options.extras || {}) };
    if (extras.listingCount == null) {
      const count = await fetchPublicListingCount(userId);
      if (Number.isFinite(count) && count >= 0) {
        extras.listingCount = count;
      }
    }

    renderPremiumCardSeller(host, profile, { trust, extras });
    return profile;
  }

  async function hydratePremiumProductCardSellers(root = document) {
    const hosts = root.querySelectorAll(
      "[data-premium-seller-host]:not([data-seller-hydrated])"
    );
    if (!hosts.length) return;

    await Promise.all(
      [...hosts].map((host) => {
        const card = host.closest(".premium-listing-card");
        const extras = {};
        if (card?.dataset.sellerSales) {
          extras.salesCount = card.dataset.sellerSales;
        }
        if (card?.dataset.sellerRegistration) {
          extras.registrationCount = card.dataset.sellerRegistration;
        }
        return hydratePremiumCardSeller(host, { extras });
      })
    );
  }

  function renderSellerSection(profile) {
    const section = document.querySelector("[data-listing-seller]");
    if (!section || !profile) return;

    const avatar = section.querySelector("[data-seller-avatar]");
    if (avatar) {
      avatar.src = profile.avatarUrl || avatarPlaceholder(profile.userId, profile.displayName);
      avatar.alt = `${profile.displayName}のプロフィール`;
    }

    setText("[data-seller-display-name]", safeStr(profile.displayName, "出品者"));
    setText("[data-seller-handle]", formatHandle(profile.handle, profile.userId));
    setText("[data-seller-deals]", formatDealsDisplay(profile));
    setText("[data-seller-followers]", safeStr(profile.followersLabel, "—"));
    setText(
      "[data-seller-last-login]",
      profile.lastLoginLabel && profile.lastLoginLabel !== "—"
        ? `最終ログイン：${profile.lastLoginLabel}`
        : "最終ログイン：—"
    );
    setText(
      "[data-seller-availability]",
      profile.lastLoginLabel && profile.lastLoginLabel !== "—"
        ? profile.lastLoginLabel
        : "—"
    );
    setText("[data-seller-work-hours]", safeStr(profile.workHours, "未設定"));
    setText(
      "[data-seller-response-time]",
      safeStr(profile.responseTimeLabel, "—")
    );
    setText(
      "[data-seller-delivery-estimate]",
      safeStr(profile.deliveryEstimate, "—")
    );
    const statusLabelEl = section.querySelector("[data-seller-status-label]");
    if (statusLabelEl) {
      const status = safeStr(profile.availabilityStatus, "offline");
      statusLabelEl.textContent = safeStr(profile.availabilityLabel, "未設定");
      statusLabelEl.className =
        "skill-seller-activity__value skill-seller-activity__value--status";
      statusLabelEl.classList.add(`is-${status}`);
    }

    const statusDot = section.querySelector("[data-seller-status-dot]");
    if (statusDot) {
      statusDot.className = "skill-seller-premium__status-dot";
      statusDot.classList.add(
        `skill-seller-premium__status-dot--${safeStr(profile.availabilityStatus, "offline")}`
      );
      statusDot.setAttribute(
        "aria-label",
        safeStr(profile.availabilityLabel, "稼働状況不明")
      );
    }

    renderRankPlate(section, profile);
    renderBadges(section.querySelector("[data-seller-badges]"), profile);

    section.setAttribute("data-author-user-id", profile.userId || "");
    section.dataset.sellerSource = profile.source || "";
    if (profile.rankFromQuery) {
      section.dataset.sellerRankPreview = "true";
    } else {
      delete section.dataset.sellerRankPreview;
    }
    section.hidden = false;
    section.setAttribute("data-detail-keep", "");

    if (profile.userId) {
      document.body.dataset.authorUserId = profile.userId;
      document.body.dataset.sellerUserId = profile.userId;
    }
  }

  async function syncTrustScore(userId) {
    if (!userId) return;

    if (window.TasuDetailTrustScore?.initForUser) {
      await window.TasuDetailTrustScore.initForUser(userId);
      return;
    }

    if (window.TasuDetailTrustScore?.fetchReviewScore) {
      const row = await window.TasuDetailTrustScore.fetchReviewScore(userId);
      const display = window.TasuDetailTrustScore.formatTrustDisplay(row);
      const anchor = document.querySelector("[data-seller-trust-anchor]");
      if (anchor && display) {
        anchor.setAttribute("aria-label", display.ariaLabel);
      }

      const ratingValue = document.querySelector("[data-seller-rating-value]");
      const ratingCount = document.querySelector("[data-seller-rating-count]");
      const ratingStars = document.querySelector("[data-seller-rating-stars]");
      if (display.variant === "rated") {
        if (ratingValue) ratingValue.textContent = display.average;
        if (ratingStars) ratingStars.textContent = display.stars;
        if (ratingCount) ratingCount.textContent = `(${display.total}件)`;
      } else {
        if (ratingValue) ratingValue.textContent = display.text;
        if (ratingStars) ratingStars.textContent = "";
        if (ratingCount) ratingCount.textContent = "";
      }
    }
  }

  function getQuerySellerUserId() {
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get("userId") ||
      params.get("user_id") ||
      params.get("sellerId") ||
      "";
    return safeStr(raw, "");
  }

  function buildRankPreviewHref(rank) {
    const url = new URL(window.location.href);
    url.searchParams.set("rank", rank);
    return `${url.pathname}${url.search}`;
  }

  function renderRankPreviewBar(profile) {
    const section = document.querySelector("[data-listing-seller]");
    if (!section || !profile?.userId) return;

    const showBar =
      profile.userId === "u_me" &&
      isRankPreviewHost() &&
      /detail-skill\.html/i.test(window.location.pathname);
    let bar = section.querySelector("[data-seller-rank-preview]");

    if (!showBar) {
      bar?.remove();
      return;
    }

    if (!bar) {
      bar = document.createElement("div");
      bar.className = "seller-rank-preview";
      bar.setAttribute("data-seller-rank-preview", "");
      section.querySelector(".skill-seller-premium__head")?.after(bar);
    }

    const activeRank = normalizeRankKey(profile.rankKey || profile.memberRank);
    const dbMissing = profile.source !== "supabase" && profile.source !== "demo";
    const dbRankLabel = profile.rankRaw
      ? `${profile.rankRaw} → ${activeRank}`
      : `rank=${activeRank}`;
    const rankNote = profile.rankFromQuery
      ? `（URLプレビュー: ${RANK_LABELS[activeRank] || activeRank}）`
      : `（DB: ${dbRankLabel}）`;

    const links = VALID_RANKS.map((rank) => {
      const label = RANK_LABELS[rank] || rank;
      const active = rank === activeRank ? ' aria-current="true"' : "";
      return `<a class="seller-rank-preview__link${rank === activeRank ? " is-active" : ""}" href="${escapeHtml(buildRankPreviewHref(rank))}"${active}>${escapeHtml(label)}</a>`;
    }).join("");

    bar.innerHTML = `
      <p class="seller-rank-preview__title">ランク表示プレビュー ${escapeHtml(rankNote)}</p>
      ${
        dbMissing
          ? '<p class="seller-rank-preview__warn">members に u_me がありません。Supabase SQL Editor で <code>supabase/seed_u_me_rank_test.sql</code> を実行してください。</p>'
          : ""
      }
      <div class="seller-rank-preview__links" role="navigation" aria-label="ランク切替">${links}</div>
    `;
  }

  function resolveSellerUserId(options = {}) {
    const fromUrl = getQuerySellerUserId();
    const fromOptions = safeStr(options.userId, "");
    const fromListing = safeStr(
      options.listing?.user_id ||
        options.listing?.userId ||
        options.listing?.seller_id ||
        options.listing?.sellerId ||
        "",
      ""
    );
    const section = document.querySelector("[data-listing-seller]");
    const fromSection = safeStr(section?.dataset?.authorUserId, "");
    const fromBody = safeStr(document.body?.dataset?.authorUserId, "");

    if (fromUrl) return fromUrl;
    if (fromOptions) return fromOptions;
    if (fromListing) return fromListing;
    if (fromSection) return fromSection;
    return fromBody;
  }

  async function render(options = {}) {
    const userId = resolveSellerUserId(options);
    const section = document.querySelector("[data-listing-seller]");
    if (!section) return null;

    const profile = await fetchSellerProfile(userId, options);

    if (isJobDetailPage()) {
      await renderJobCompanySection(profile, options);
    } else {
      renderSellerSection(profile);
      renderRankPreviewBar(profile);
      await syncTrustScore(profile.userId);
    }

    window.dispatchEvent(
      new CustomEvent("tasu:listing-seller-ready", {
        detail: { userId: profile.userId, profile },
      })
    );

    window.TasuListingSellerProfile = {
      ...(window.TasuListingSellerProfile || {}),
      lastProfile: profile,
      lastUserId: profile.userId,
    };

    return profile;
  }

  function bootstrapStaticSeller() {
    if (!/detail-skill\.html/i.test(window.location.pathname)) return;
    if (document.body?.dataset?.listingLoaded === "true") return;
    if (new URLSearchParams(window.location.search).get("id")?.trim()) return;

    const section = document.querySelector("[data-listing-seller]");
    const userId = resolveSellerUserId();
    if (!userId) return;
    void render({ userId });
  }

  window.TasuListingSellerProfile = {
    fetchSellerProfile,
    fetchUserTables,
    fetchUserRow,
    fetchProfileRow,
    fetchMemberRow,
    resolveSellerUserIdForMemberLookup,
    resolvePrimaryMemberQueryUserId,
    buildMemberQueryUserIds,
    render,
    resolveSellerUserId,
    getQuerySellerUserId,
    resolveDemoProfile,
    getQueryRankParam,
    applyRankQueryOverride,
    buildRankPreviewHref,
    isRankPreviewHost,
    formatHandle,
    parseRankValue,
    normalizeRankKey,
    resolveMemberRank,
    resolveRankBadgeLabel,
    resolveRankPlateImageKey,
    rankPlateImageUrl,
    rankPlateFileExtension,
    RANK_PLATE_FILE_EXT,
    rankPlateImageAlt,
    VALID_RANKS,
    RANK_PLATE_IMAGE_RANKS,
    RANK_PLATE_IMAGE_BASE,
    applySellerRankDisplay,
    renderJobCompanySection,
    extractJobCompanyListingMeta,
    fetchPublicJobListingCount,
    buildBadges,
    buildJobCompanyBadges,
    renderPremiumCardSeller,
    renderPremiumCardMetrics,
    hydratePremiumCardSeller,
    hydratePremiumProductCardSellers,
    fetchPublicListingCount,
    RANK_LABELS,
    DEMO_PROFILES,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapStaticSeller);
  } else {
    bootstrapStaticSeller();
  }
})();
