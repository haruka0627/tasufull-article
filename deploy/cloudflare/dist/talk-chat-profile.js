/**
 * TASFUL TALK — 共通ユーザープロフィール（友達チャット / 仕事チャットで共有）
 *
 * 将来: 友達追加・グループ・プロフィールページは userId + profile を参照
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_profiles_v1";
  const DEFAULT_AVATAR = "https://placehold.co/96x96/f3ead4/967622?text=%3F";

  /** @readonly */
  const PROFILE_FIELDS = Object.freeze([
    "profile_image",
    "display_name",
    "status_message",
    "category",
    "location",
    "rating",
    "review_count",
  ]);

  const SEED_PROFILES = Object.freeze([
    {
      user_id: "u_hiro",
      profile_image: "https://placehold.co/96x96/fff6df/7a5710?text=H",
      display_name: "ひろ",
      status_message: "渋谷エリアで対応中",
      category: "ワーカー",
      location: "東京都",
      rating: 4.8,
      review_count: 42,
      last_seen_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      online_status: "online",
    },
    {
      user_id: "u_sachi",
      profile_image: "https://placehold.co/96x96/f3ead4/967622?text=S",
      display_name: "さちこ",
      status_message: "制作・納品は平日中心",
      category: "クリエイター",
      location: "大阪府",
      rating: 4.9,
      review_count: 128,
      last_seen_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      online_status: "away",
    },
    {
      user_id: "u_store",
      profile_image: "https://placehold.co/96x96/f3ead4/967622?text=PH",
      display_name: "プレミアムホーム",
      status_message: "店舗・販売の問い合わせ歓迎",
      category: "店舗",
      location: "神奈川県",
      rating: 4.6,
      review_count: 19,
      last_seen_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      online_status: "offline",
    },
  ]);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function clampRating(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (n > 5) return 5;
    return Math.round(n * 10) / 10;
  }

  function clampReviewCount(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function resolveImageUrl(url) {
    const raw = pickStr(url);
    if (!raw) return "";
    if (global.TasuMemberProfile?.resolveDisplayUrl) {
      return global.TasuMemberProfile.resolveDisplayUrl(raw);
    }
    return raw;
  }

  function isPlaceholderAvatar(url) {
    const u = String(url || "").trim();
    if (!u) return true;
    return u === DEFAULT_AVATAR;
  }

  /** profile_image → avatar_url → image_url */
  function pickAvatarUrl(profile, hints) {
    const row = { ...(hints || {}), ...(profile || {}) };
    const candidates = [
      row.profile_image,
      row.profileImage,
      row.avatar_url,
      row.avatarUrl,
      row.image_url,
      row.imageUrl,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const resolved = resolveImageUrl(candidates[i]);
      if (resolved && !isPlaceholderAvatar(resolved)) return resolved;
    }
    return "";
  }

  function getInitials(displayName) {
    const name = String(displayName || "").trim();
    if (!name) return "?";
    const latin = name.match(/[A-Za-z]/g);
    if (latin && latin.length >= 2 && /[A-Za-z]/.test(name)) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    const chars = [...name.replace(/\s/g, "")];
    return chars.slice(0, 2).join("") || "?";
  }

  /**
   * @param {{ profile?: object, hints?: object, displayName?: string, size?: number, className?: string, escapeHtml?: Function }} opts
   */
  function renderAvatarHtml(opts) {
    const esc = opts?.escapeHtml || ((t) => String(t ?? ""));
    const profile = opts?.profile || opts?.hints || {};
    const hints = opts?.hints || {};
    const displayName = pickStr(
      opts?.displayName,
      profile.display_name,
      profile.displayName,
      hints.display_name,
      hints.displayName,
      "?"
    );
    const size = Number(opts?.size) > 0 ? Number(opts.size) : 48;
    const baseClass = pickStr(opts?.className, "talk-avatar");
    const url = pickAvatarUrl(profile, hints);

    if (url) {
      return `<img class="${esc(baseClass)} ${esc(baseClass)}--img" src="${esc(url)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
    }
    const initials = esc(getInitials(displayName));
    return `<span class="${esc(baseClass)} ${esc(baseClass)}--initials" role="img" aria-label="${esc(displayName)}" style="--talk-avatar-size:${size}px">${initials}</span>`;
  }

  /**
   * 共通プロフィール（API / DB 向け snake_case + JS 向けエイリアス）
   * @param {object|null} input
   * @param {string} [userId]
   */
  function normalizeProfile(input, userId) {
    const row = input && typeof input === "object" ? input : {};
    const id = pickStr(userId, row.user_id, row.userId, row.id);
    const profileImage = pickStr(
      row.profile_image,
      row.profileImage,
      row.avatar_url,
      row.avatarUrl,
      row.image_url,
      row.imageUrl
    );
    const displayName = pickStr(row.display_name, row.displayName, row.name, id || "ユーザー");
    const statusMessage = pickStr(row.status_message, row.statusMessage, row.bio);
    const category = pickStr(row.category, row.profile_category);
    const location = pickStr(row.location, row.area);
    const rating = clampRating(row.rating ?? row.score);
    const reviewCount = clampReviewCount(row.review_count ?? row.reviewCount);
    const lastSeenAt = pickStr(row.last_seen_at, row.lastSeenAt);
    const onlineStatus = pickStr(row.online_status, row.onlineStatus).toLowerCase();

    const resolvedImg = resolveImageUrl(profileImage);
    const profile = {
      user_id: id,
      profile_image: resolvedImg,
      display_name: displayName,
      status_message: statusMessage,
      category,
      location,
      rating,
      review_count: reviewCount,
      last_seen_at: lastSeenAt,
      online_status: onlineStatus,
      profileImage: resolvedImg,
      displayName,
      statusMessage,
      reviewCount,
      avatarUrl: resolvedImg,
      image_url: resolvedImg,
      imageUrl: resolvedImg,
    };

    return profile;
  }

  function readStore() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStore(map) {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map || {}));
      global.dispatchEvent?.(new CustomEvent("tasful-talk-profiles-changed"));
    } catch (err) {
      console.warn("[TasuTalkChatProfile] save failed:", err);
    }
  }

  function seedIfEmpty() {
    const map = readStore();
    if (Object.keys(map).length) return map;
    const next = {};
    SEED_PROFILES.forEach((p) => {
      const row = normalizeProfile(p);
      if (row.user_id) next[row.user_id] = row;
    });
    writeStore(next);
    return next;
  }

  /**
   * @param {string} userId
   * @param {object} [hints]
   */
  function resolveProfile(userId, hints) {
    seedIfEmpty();
    const id = pickStr(userId);
    const map = readStore();
    const stored = id ? map[id] : null;
    const hintRow = hints && typeof hints === "object" ? hints : {};

    if (stored) {
      return normalizeProfile({ ...stored, ...hintRow }, id);
    }

    const memberAvatar = global.TasuMemberProfile?.getAvatarUrlForUser?.(id) || "";
    const legacy = global.TasuChatUserIdentity?.resolveProfile?.(id);
    const merged = normalizeProfile(
      {
        user_id: id,
        profile_image: pickStr(
          hintRow.profile_image,
          hintRow.avatarUrl,
          memberAvatar,
          legacy?.avatarUrl
        ),
        display_name: pickStr(hintRow.display_name, hintRow.displayName, legacy?.displayName),
        status_message: hintRow.status_message,
        category: hintRow.category,
        location: hintRow.location,
        rating: hintRow.rating,
        review_count: hintRow.review_count,
        last_seen_at: hintRow.last_seen_at,
        online_status: hintRow.online_status,
      },
      id
    );

    if (id && !map[id]) {
      map[id] = merged;
      writeStore(map);
    }
    return merged;
  }

  function upsertProfile(profile) {
    const row = normalizeProfile(profile);
    if (!row.user_id) return null;
    const map = readStore();
    map[row.user_id] = row;
    writeStore(map);
    return row;
  }

  function getOnlinePresence(userId) {
    const profile = resolveProfile(userId);
    const explicit = pickStr(profile.online_status).toLowerCase();
    if (explicit === "online" || explicit === "away" || explicit === "offline") {
      const labels = { online: "オンライン", away: "離席中", offline: "オフライン" };
      return { status: explicit, label: labels[explicit] || "オフライン", isOnline: explicit === "online" };
    }

    const seen = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : NaN;
    if (Number.isFinite(seen)) {
      const delta = Date.now() - seen;
      if (delta < 1000 * 60 * 5) {
        return { status: "online", label: "オンライン", isOnline: true };
      }
      if (delta < 1000 * 60 * 60) {
        return { status: "away", label: "最近アクティブ", isOnline: false };
      }
    }
    return { status: "offline", label: "オフライン", isOnline: false };
  }

  global.TasuTalkChatProfile = {
    STORAGE_KEY,
    PROFILE_FIELDS,
    DEFAULT_AVATAR,
    normalizeProfile,
    resolveProfile,
    upsertProfile,
    getOnlinePresence,
    seedIfEmpty,
    pickAvatarUrl,
    getInitials,
    renderAvatarHtml,
    isPlaceholderAvatar,
    resolveImageUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
