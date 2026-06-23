/**
 * TASFUL MATCH — profile / pair data stub (no DB, no fetch)
 * Future replacement: match_profiles, match_pairs, match_profile_photos
 */
(function () {
  "use strict";

  var CURRENT_USER = {
    user_id: "stub-user-current",
    display_name: "あなた",
    verification_status: "unverified",
    profile_status: "active",
  };

  var SWIPE_PROFILES = [
    {
      user_id: "stub-user-yui",
      display_name: "ゆい",
      age: 26,
      prefecture: "東京都",
      city: "渋谷区",
      bio: "週末はカフェ巡りが好きです。のんびり話せる方と出会えたら嬉しいです。",
      verification_status: "verified",
      main_photo_url: "🌸",
      hobby_tags: ["カフェ巡り", "旅行", "映画"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T10:00:00+09:00",
    },
    {
      user_id: "stub-user-kenta",
      display_name: "けんた",
      age: 29,
      prefecture: "神奈川県",
      city: "横浜市",
      bio: "ライブとキャンプが好きです。一緒にアウトドア楽しめる方を探しています。",
      verification_status: "verified",
      main_photo_url: "🎸",
      hobby_tags: ["ライブ", "キャンプ", "筋トレ"],
      activity_label: "3日以内に活動",
      last_active_at: "2026-06-20T18:30:00+09:00",
    },
    {
      user_id: "stub-user-misaki",
      display_name: "みさき",
      age: 25,
      prefecture: "東京都",
      city: "世田谷区",
      bio: "写真と散歩が趣味です。まずはメッセージでゆっくり仲良くなれたら嬉しいです。",
      verification_status: "pending",
      main_photo_url: "📷",
      hobby_tags: ["写真", "散歩", "カフェ"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T08:15:00+09:00",
    },
  ];

  var SEARCH_PROFILES = SWIPE_PROFILES.concat([
    {
      user_id: "stub-user-aoi",
      display_name: "あおい",
      age: 28,
      prefecture: "東京都",
      city: "港区",
      bio: "仕事と趣味のバランスを大切にしています。",
      one_line: "落ち着いて話せる方と出会いたいです",
      verification_status: "verified",
      main_photo_url: "🌿",
      hobby_tags: ["ヨガ", "読書"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T11:30:00+09:00",
      is_online: true,
      purpose: ["marriage"],
      compat_percent: 82,
      created_at: "2026-06-18T10:00:00+09:00",
    },
    {
      user_id: "stub-user-ryo",
      display_name: "りょう",
      age: 31,
      prefecture: "神奈川県",
      city: "川崎市",
      bio: "アウトドアと料理が好きです。",
      one_line: "週末一緒にアクティブに過ごせる方募集",
      verification_status: "verified",
      main_photo_url: "🏕",
      hobby_tags: ["キャンプ", "料理"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T09:45:00+09:00",
      is_online: true,
      purpose: ["love", "friends"],
      compat_percent: 74,
      created_at: "2026-06-17T14:00:00+09:00",
    },
    {
      user_id: "stub-user-nana",
      display_name: "なな",
      age: 24,
      prefecture: "埼玉県",
      city: "さいたま市",
      bio: "カフェと映画鑑賞が好きです。",
      one_line: "まずはメッセージからゆっくり仲良くなりたい",
      verification_status: "verified",
      main_photo_url: "☕",
      hobby_tags: ["カフェ", "映画"],
      activity_label: "3日以内に活動",
      last_active_at: "2026-06-19T20:00:00+09:00",
      is_online: false,
      purpose: ["love"],
      compat_percent: 88,
      created_at: "2026-06-20T08:00:00+09:00",
    },
    {
      user_id: "stub-user-haru",
      display_name: "はる",
      age: 27,
      prefecture: "東京都",
      city: "品川区",
      bio: "音楽フェスと散歩が趣味です。",
      one_line: "価値観が合う方と自然体で会いたい",
      verification_status: "pending",
      main_photo_url: "🎵",
      hobby_tags: ["音楽", "散歩"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T07:00:00+09:00",
      is_online: true,
      purpose: ["friends"],
      compat_percent: 69,
      created_at: "2026-06-16T12:00:00+09:00",
    },
    {
      user_id: "stub-user-sota",
      display_name: "そうた",
      age: 33,
      prefecture: "千葉県",
      city: "船橋市",
      bio: "真剣に婚活中です。",
      one_line: "将来を見据えて真剣にお付き合いしたい",
      verification_status: "verified",
      main_photo_url: "💍",
      hobby_tags: ["旅行", "グルメ"],
      activity_label: "1週間以内に活動",
      last_active_at: "2026-06-15T18:00:00+09:00",
      is_online: false,
      purpose: ["marriage"],
      compat_percent: 91,
      created_at: "2026-06-14T09:00:00+09:00",
    },
    {
      user_id: "stub-user-mio",
      display_name: "みお",
      age: 22,
      prefecture: "東京都",
      city: "新宿区",
      bio: "友達から始められる関係が理想です。",
      one_line: "気軽にお話しできる方と繋がりたい",
      verification_status: "verified",
      main_photo_url: "🌷",
      hobby_tags: ["カフェ", "アート"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T12:00:00+09:00",
      is_online: true,
      purpose: ["friends", "love"],
      compat_percent: 76,
      created_at: "2026-06-21T06:00:00+09:00",
    },
    {
      user_id: "stub-user-taku",
      display_name: "たく",
      age: 30,
      prefecture: "神奈川県",
      city: "藤沢市",
      bio: "サーフィンと写真が好きです。",
      one_line: "アクティブに楽しめる相手を探しています",
      verification_status: "verified",
      main_photo_url: "🏄",
      hobby_tags: ["サーフィン", "写真"],
      activity_label: "3日以内に活動",
      last_active_at: "2026-06-20T15:00:00+09:00",
      is_online: false,
      purpose: ["love"],
      compat_percent: 71,
      created_at: "2026-06-13T11:00:00+09:00",
    },
    {
      user_id: "stub-user-emi",
      display_name: "えみ",
      age: 29,
      prefecture: "東京都",
      city: "目黒区",
      bio: "ワインと美術館巡りが好きです。",
      one_line: "落ち着いた雰囲気で会える方希望",
      verification_status: "verified",
      main_photo_url: "🍷",
      hobby_tags: ["ワイン", "美術"],
      activity_label: "24時間以内に活動",
      last_active_at: "2026-06-21T10:30:00+09:00",
      is_online: true,
      purpose: ["marriage", "love"],
      compat_percent: 85,
      created_at: "2026-06-12T16:00:00+09:00",
    },
    {
      user_id: "stub-user-yuki",
      display_name: "ゆき",
      age: 26,
      prefecture: "埼玉県",
      city: "所沢市",
      bio: "ペットと散歩するのが日課です。",
      one_line: "穏やかな関係を築きたいです",
      verification_status: "pending",
      main_photo_url: "🐕",
      hobby_tags: ["散歩", "ペット"],
      activity_label: "1週間以内に活動",
      last_active_at: "2026-06-14T09:00:00+09:00",
      is_online: false,
      purpose: ["friends"],
      compat_percent: 63,
      created_at: "2026-06-11T10:00:00+09:00",
    },
  ]).map(function (profile) {
    if (!profile.one_line) profile.one_line = profile.bio || "";
    if (!profile.purpose) profile.purpose = ["love"];
    if (profile.is_online === undefined) {
      profile.is_online = String(profile.activity_label || "").indexOf("24時間") >= 0;
    }
    if (profile.compat_percent === undefined) profile.compat_percent = 72;
    if (!profile.created_at) profile.created_at = "2026-06-10T10:00:00+09:00";
    return profile;
  });

  var PAIRS = [
    {
      pair_id: "00000000-0000-4000-8000-000000000001",
      user_low_id: "stub-user-current",
      user_high_id: "stub-user-yui",
      partner_user_id: "stub-user-yui",
      partner_display_name: "ゆい",
      partner_photo_url: "🌸",
      status: "active",
      unread_count: 2,
      last_message: "こんにちは！よろしくお願いします",
      updated_at: "2026-06-21T08:00:00+09:00",
    },
    {
      pair_id: "00000000-0000-4000-8000-000000000002",
      user_low_id: "stub-user-current",
      user_high_id: "stub-user-kenta",
      partner_user_id: "stub-user-kenta",
      partner_display_name: "けんた",
      partner_photo_url: "🎸",
      status: "active",
      unread_count: 0,
      last_message: "週末空いてますか？",
      updated_at: "2026-06-20T12:00:00+09:00",
    },
    {
      pair_id: "00000000-0000-4000-8000-000000000003",
      user_low_id: "stub-user-current",
      user_high_id: "stub-user-misaki",
      partner_user_id: "stub-user-misaki",
      partner_display_name: "みさき",
      partner_photo_url: "📷",
      status: "new",
      unread_count: 0,
      last_message: "",
      updated_at: "2026-06-21T09:00:00+09:00",
    },
  ];

  var BLOCKED_USERS = [
    {
      block_id: "stub-block-001",
      blocked_user_id: "stub-user-taro",
      display_name: "たろう 31歳",
      photo_url: "📷",
      reason: "しつこいメッセージ",
      created_at: "2026-06-15T14:00:00+09:00",
    },
    {
      block_id: "stub-block-002",
      blocked_user_id: "stub-user-anon",
      display_name: "匿名ユーザー",
      photo_url: "🎭",
      reason: "不適切なプロフィール",
      created_at: "2026-05-28T09:30:00+09:00",
    },
  ];

  var REPORTS = [
    {
      report_id: "stub-report-001",
      reported_user_id: "stub-user-kenta",
      reported_display_name: "けんた 29歳",
      reason: "harassment",
      status: "in_review",
      created_at: "2026-06-10T11:00:00+09:00",
      detail: "営業目的のメッセージ",
    },
    {
      report_id: "stub-report-002",
      reported_user_id: "stub-user-anon",
      reported_display_name: "匿名ユーザー",
      reason: "impersonation",
      status: "resolved",
      created_at: "2026-05-22T16:00:00+09:00",
      detail: "写真の不一致",
    },
  ];

  var VERIFICATIONS = [
    {
      verification_id: "stub-verification-current",
      user_id: "stub-user-current",
      verification_type: "identity_document",
      status: "not_submitted",
      submitted_at: null,
    },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function resolveMatchUserId() {
    var auth = window.TasfulMatchAuth;
    if (auth && typeof auth.getMatchUserId === "function") {
      var id = auth.getMatchUserId();
      if (id) return id;
    }
    return CURRENT_USER.user_id;
  }

  function applyAuthToUser(user) {
    var auth = window.TasfulMatchAuth;
    if (!auth || typeof auth.getState !== "function") return user;
    var authState = auth.getState();
    user.user_id = resolveMatchUserId();
    if (authState.displayName) user.display_name = authState.displayName;
    if (authState.verificationStatus) {
      user.verification_status = authState.verificationStatus;
    }
    if (authState.profileStatus) user.profile_status = authState.profileStatus;
    return user;
  }

  function remapCurrentUserId(value) {
    if (value === CURRENT_USER.user_id || value === "stub-user-current") {
      return resolveMatchUserId();
    }
    return value;
  }

  function getCurrentUser() {
    return applyAuthToUser(clone(CURRENT_USER));
  }

  function getSwipeProfiles() {
    return clone(SWIPE_PROFILES);
  }

  function getProfileById(userId) {
    var profile = SEARCH_PROFILES.find(function (p) {
      return p.user_id === userId;
    });
    return profile ? clone(profile) : null;
  }

  function normalizeSearchFilters(filters) {
    var f = filters && typeof filters === "object" ? filters : {};
    return {
      age_min: f.age_min != null ? Number(f.age_min) : null,
      age_max: f.age_max != null ? Number(f.age_max) : null,
      prefecture: f.prefecture ? String(f.prefecture) : "",
      prefectures: Array.isArray(f.prefectures) ? f.prefectures.slice() : [],
      purpose: Array.isArray(f.purpose) ? f.purpose.slice() : [],
      verified_only: Boolean(f.verified_only),
      online_only: Boolean(f.online_only),
    };
  }

  function profileMatchesFilters(profile, filters) {
    if (filters.age_min != null && profile.age < filters.age_min) return false;
    if (filters.age_max != null && profile.age > filters.age_max) return false;

    var region = filters.prefecture || "";
    if (region && profile.prefecture !== region) return false;

    if (filters.prefectures.length && filters.prefectures.indexOf(profile.prefecture) < 0) {
      return false;
    }

    if (filters.purpose.length) {
      var purposes = Array.isArray(profile.purpose) ? profile.purpose : [];
      var overlap = filters.purpose.some(function (p) {
        return purposes.indexOf(p) >= 0;
      });
      if (!overlap) return false;
    }

    if (filters.verified_only && profile.verification_status !== "verified") return false;
    if (filters.online_only && !profile.is_online) return false;
    return true;
  }

  function sortSearchProfiles(items, sortKey) {
    var list = items.slice();
    if (sortKey === "newest") {
      list.sort(function (a, b) {
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
      return list;
    }
    if (sortKey === "online") {
      list.sort(function (a, b) {
        var ao = a.is_online ? 1 : 0;
        var bo = b.is_online ? 1 : 0;
        if (bo !== ao) return bo - ao;
        return (b.compat_percent || 0) - (a.compat_percent || 0);
      });
      return list;
    }
    list.sort(function (a, b) {
      return (b.compat_percent || 0) - (a.compat_percent || 0);
    });
    return list;
  }

  function searchProfiles(filters, sortKey) {
    var normalized = normalizeSearchFilters(filters);
    var matched = SEARCH_PROFILES.filter(function (profile) {
      return profileMatchesFilters(profile, normalized);
    });
    return sortSearchProfiles(matched, sortKey || "recommended").map(clone);
  }

  function getPairs() {
    return clone(PAIRS).map(function (pair) {
      pair.user_low_id = remapCurrentUserId(pair.user_low_id);
      return pair;
    });
  }

  function getPairById(pairId) {
    var pair = PAIRS.find(function (p) {
      return p.pair_id === pairId;
    });
    return pair ? clone(pair) : null;
  }

  function getBlockedUsers() {
    return clone(BLOCKED_USERS);
  }

  function getReports() {
    return clone(REPORTS);
  }

  function getCurrentVerification() {
    var uid = resolveMatchUserId();
    var v = VERIFICATIONS.find(function (item) {
      return item.user_id === CURRENT_USER.user_id || item.user_id === uid;
    });
    if (!v) return null;
    var out = clone(v);
    out.user_id = uid;
    return out;
  }

  function getDefaultTargetUserId() {
    return SWIPE_PROFILES[0] ? SWIPE_PROFILES[0].user_id : "stub-user-unknown";
  }

  function getDefaultPairId() {
    return PAIRS[0] ? PAIRS[0].pair_id : "00000000-0000-4000-8000-000000000001";
  }

  window.TasfulMatchDataStub = {
    mode: "data_stub",
    getCurrentUser: getCurrentUser,
    getSwipeProfiles: getSwipeProfiles,
    getProfileById: getProfileById,
    getPairs: getPairs,
    getPairById: getPairById,
    getBlockedUsers: getBlockedUsers,
    getReports: getReports,
    getCurrentVerification: getCurrentVerification,
    getDefaultTargetUserId: getDefaultTargetUserId,
    getDefaultPairId: getDefaultPairId,
    searchProfiles: searchProfiles,
    normalizeSearchFilters: normalizeSearchFilters,
  };
})();
