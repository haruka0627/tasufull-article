(function () {
  "use strict";

  var STORAGE_KEY = "tasful_platform_requests_v1";
  var POSTED_BANNER_KEY = "tasful_platform_request_posted_banner_v1";
  var VALID_STATUSES = ["open", "closed", "cancelled"];
  var DISCLOSURE_FEE_YEN = 550;

  var DEMO_REQUESTS = [
    {
      id: "demo-1",
      title: "外壁塗装の見積もりが欲しいです",
      excerpt: "築15年の戸建て。埼玉北部。夏までに施工したい。複数社から相談したいです。",
      body: "築15年の戸建て（延べ約120㎡）の外壁塗装を検討しています。\n\n・希望時期：夏まで\n・予算感：80〜120万円程度\n・足場・高圧洗浄込みの見積もり希望\n\n近隣で実績のある業者さんからご連絡いただけると助かります。",
      category: "リフォーム・塗装",
      area: "埼玉県",
      urgency: "急ぎ",
      budget: "80〜120万円",
      status: "open",
      createdAt: "2026-07-03T10:00:00.000Z",
      date: "2026-07-03",
      author: "匿名",
      source: "demo",
    },
    {
      id: "demo-2",
      title: "店舗の看板デザインと制作",
      excerpt: "飲食店オープンに合わせて看板一式。ロゴはあり。設置工事込みで依頼したい。",
      body: "来月オープン予定の飲食店です。店頭看板・のぼり・メニューボードのデザインと制作をお願いしたいです。\n\nロゴデータは用意済み。設置工事まで一括でお願いできる方を探しています。",
      category: "デザイン・制作",
      area: "東京都",
      urgency: "通常",
      budget: "",
      status: "open",
      createdAt: "2026-07-02T10:00:00.000Z",
      date: "2026-07-02",
      author: "匿名",
      source: "demo",
    },
    {
      id: "demo-3",
      title: "週1回の事務代行をお願いしたい",
      excerpt: "請求書発行・データ入力。リモート可。長期でお願いできる方歓迎。",
      body: "小規模事業の事務代行を週1回（各3時間程度）お願いしたいです。\n\n主な業務：請求書発行、入出金データ入力、メール整理。\nリモート作業可。継続依頼できる方を探しています。",
      category: "事務・バックオフィス",
      area: "神奈川県",
      urgency: "通常",
      budget: "",
      status: "open",
      createdAt: "2026-07-01T10:00:00.000Z",
      date: "2026-07-01",
      author: "匿名",
      source: "demo",
    },
    {
      id: "demo-4",
      title: "エアコン取り付け（2台）",
      excerpt: "新品購入済み。壁穴あけ・配管工事が必要。今週末対応希望。",
      body: "リビングと寝室に新品エアコン（各2.5kW）の取り付けをお願いします。\n\n壁穴あけと配管工事が必要です。エアコン本体は購入済み。今週末の施工を希望しています。",
      category: "設備・工事",
      area: "千葉県",
      urgency: "至急",
      budget: "",
      status: "open",
      createdAt: "2026-06-30T10:00:00.000Z",
      date: "2026-06-30",
      author: "匿名",
      source: "demo",
    },
  ];

  var CATEGORIES = [
    "すべて",
    "リフォーム・塗装",
    "デザイン・制作",
    "事務・バックオフィス",
    "設備・工事",
    "配送・引越し",
    "IT・Web",
    "その他",
  ];

  var STATUS_LABELS = {
    open: "受付中",
    closed: "終了",
    cancelled: "キャンセル",
  };

  var CANDIDATES_STORAGE_KEY = "tasful_platform_request_candidates_v1";

  var CANDIDATE_TYPE_LABELS = {
    company: "業者",
    worker: "ワーカー",
    freelancer: "フリーランス",
    user: "ユーザー",
    builder_partner: "協力会社",
    listing: "掲載",
  };

  var DEMO_CANDIDATES = [
    {
      id: "cand-1",
      name: "埼玉ペイント工房",
      type: "company",
      categories: ["リフォーム・塗装"],
      areas: ["埼玉県"],
      skills: ["外壁塗装", "防水", "見積もり"],
      availability: "available",
      headline: "埼玉北部で外壁・屋根塗装を20年",
      score: 92,
    },
    {
      id: "cand-2",
      name: "首都圏リフォームサービス",
      type: "company",
      categories: ["リフォーム・塗装"],
      areas: ["東京都", "神奈川県"],
      skills: ["内装", "塗装"],
      availability: "busy",
      headline: "マンション・戸建ての総合リフォーム",
      score: 88,
    },
    {
      id: "cand-3",
      name: "看板デザイン・田中",
      type: "freelancer",
      categories: ["デザイン・制作"],
      areas: ["全国", "オンライン"],
      skills: ["看板", "ロゴ", "メニューボード"],
      availability: "available",
      headline: "飲食店の看板デザインが得意です",
      score: 90,
    },
    {
      id: "cand-4",
      name: "渋谷デザインスタジオ",
      type: "worker",
      categories: ["デザイン・制作"],
      areas: ["東京都"],
      skills: ["グラフィック", "店舗デザイン"],
      availability: "busy",
      headline: "都内店舗のブランディング支援",
      score: 85,
    },
    {
      id: "cand-5",
      name: "リモート事務サポートM",
      type: "freelancer",
      categories: ["事務・バックオフィス"],
      areas: ["オンライン", "全国"],
      skills: ["請求書", "データ入力", "メール整理"],
      availability: "available",
      headline: "週次の事務代行・経理補助",
      score: 87,
    },
    {
      id: "cand-6",
      name: "横浜バックオフィス代行",
      type: "worker",
      categories: ["事務・バックオフィス"],
      areas: ["神奈川県"],
      skills: ["経理", "請求書発行"],
      availability: "available",
      headline: "神奈川の中小企業向け事務支援",
      score: 84,
    },
    {
      id: "cand-7",
      name: "千葉設備サービス",
      type: "company",
      categories: ["設備・工事"],
      areas: ["千葉県"],
      skills: ["エアコン", "取り付け", "配管工事"],
      availability: "available",
      headline: "千葉県内のエアコン・設備工事",
      score: 94,
    },
    {
      id: "cand-8",
      name: "全国設備ネットワーク",
      type: "company",
      categories: ["設備・工事"],
      areas: ["全国"],
      skills: ["エアコン", "電気工事"],
      availability: "busy",
      headline: "全国対応の設備工事パートナー",
      score: 96,
    },
    {
      id: "cand-9",
      name: "東京Web制作ラボ",
      type: "freelancer",
      categories: ["IT・Web"],
      areas: ["東京都", "オンライン"],
      skills: ["Web制作", "LP", "WordPress"],
      availability: "available",
      headline: "小規模事業者向けWeb制作",
      score: 91,
    },
    {
      id: "cand-10",
      name: "オンラインITサポート",
      type: "freelancer",
      categories: ["IT・Web"],
      areas: ["オンライン", "全国"],
      skills: ["システム開発", "API", "localStorage"],
      availability: "available",
      headline: "リモートでの開発・保守支援",
      score: 89,
    },
    {
      id: "cand-11",
      name: "関西引越し快適便",
      type: "worker",
      categories: ["配送・引越し"],
      areas: ["大阪府", "兵庫県"],
      skills: ["引越し", "配送"],
      availability: "available",
      headline: "関西エリアの引越し・配送",
      score: 82,
    },
    {
      id: "cand-12",
      name: "沖縄雑務サポート",
      type: "freelancer",
      categories: ["その他"],
      areas: ["沖縄県"],
      skills: ["軽作業", "現地調整"],
      availability: "available",
      headline: "沖縄限定の現地サポート",
      score: 70,
    },
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr() {
    for (var i = 0; i < arguments.length; i += 1) {
      var s = String(arguments[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function newId() {
    return "prq-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    } catch (_e) {
      return String(iso).slice(0, 10);
    }
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return (
        formatDate(iso) +
        " " +
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0")
      );
    } catch (_e2) {
      return String(iso);
    }
  }

  function formatRelativeTime(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
      var diff = Date.now() - d.getTime();
      if (diff < 0) return formatDate(iso);
      var sec = Math.floor(diff / 1000);
      if (sec < 60) return "たった今";
      var min = Math.floor(sec / 60);
      if (min < 60) return min + "分前";
      var hr = Math.floor(min / 60);
      if (hr < 24) return hr + "時間前";
      var day = Math.floor(hr / 24);
      if (day === 1) return "昨日";
      if (day < 7) return day + "日前";
      return formatDate(iso);
    } catch (_e3) {
      return String(iso).slice(0, 10);
    }
  }

  function excerptFromBody(body, max) {
    var text = String(body || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= (max || 72)) return text;
    return text.slice(0, max || 72) + "…";
  }

  function normalizeStored(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = pickStr(raw.id);
    var title = pickStr(raw.title);
    var body = pickStr(raw.body);
    if (!id || !title || !body) return null;
    var status = pickStr(raw.status) || "open";
    if (VALID_STATUSES.indexOf(status) === -1) status = "open";
    var createdAt = pickStr(raw.createdAt) || new Date().toISOString();
    return {
      id: id,
      title: title,
      body: body,
      category: pickStr(raw.category),
      area: pickStr(raw.area, raw.region),
      urgency: pickStr(raw.urgency) || "通常",
      budget: pickStr(raw.budget),
      photos: Array.isArray(raw.photos) ? raw.photos : [],
      status: status,
      createdAt: createdAt,
      updatedAt: pickStr(raw.updatedAt) || createdAt,
      author: "匿名",
      source: "local",
    };
  }

  function toListItem(item) {
    return {
      id: item.id,
      title: item.title,
      excerpt: item.excerpt || excerptFromBody(item.body),
      body: item.body,
      category: item.category,
      area: item.area,
      urgency: item.urgency,
      budget: item.budget || "",
      status: item.status || "open",
      date: item.date || formatDate(item.createdAt),
      createdAt: item.createdAt,
      author: item.author || "匿名",
      source: item.source || "local",
      ownerId: item.ownerId || "",
      isMine: Boolean(item.isMine || item.source === "local"),
    };
  }

  function storedToListItem(stored, currentUserId) {
    if (!stored) return null;
    var item = Object.assign({}, stored);
    if (item.source === "local") item.isMine = true;
    if (!item.isMine && item.ownerId && currentUserId) {
      item.isMine = item.ownerId === currentUserId;
    }
    return toListItem(item);
  }

  var LocalRequestStore = {
    key: STORAGE_KEY,

    readRaw: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_e) {
        return [];
      }
    },

    writeRaw: function (rows) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    },

    listStored: function () {
      return this.readRaw()
        .map(normalizeStored)
        .filter(Boolean)
        .sort(function (a, b) {
          return String(b.createdAt).localeCompare(String(a.createdAt));
        });
    },

    getStoredById: function (id) {
      var rows = this.listStored();
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i].id === id) return rows[i];
      }
      return null;
    },

    save: function (input) {
      var now = new Date().toISOString();
      var item = normalizeStored({
        id: input.id || newId(),
        title: input.title,
        body: input.body,
        category: input.category,
        area: input.area,
        urgency: input.urgency || "通常",
        budget: input.budget || "",
        photos: Array.isArray(input.photos) ? input.photos : [],
        status: input.status || "open",
        createdAt: input.createdAt || now,
        updatedAt: now,
      });
      if (!item) throw new Error("invalid_request");

      var rows = this.readRaw()
        .map(normalizeStored)
        .filter(Boolean);
      var idx = -1;
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i].id === item.id) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        item.createdAt = rows[idx].createdAt || item.createdAt;
        rows[idx] = item;
      } else {
        rows.unshift(item);
      }
      this.writeRaw(rows);
      return item;
    },

    updateStatus: function (id, nextStatus) {
      if (VALID_STATUSES.indexOf(nextStatus) === -1) return null;
      var stored = this.getStoredById(id);
      if (!stored) return null;
      return this.save({
        id: stored.id,
        title: stored.title,
        body: stored.body,
        category: stored.category,
        area: stored.area,
        urgency: stored.urgency,
        budget: stored.budget,
        photos: stored.photos,
        status: nextStatus,
        createdAt: stored.createdAt,
      });
    },

    isLocalRequest: function (id) {
      return Boolean(this.getStoredById(id));
    },

    listAllForDisplay: function () {
      var stored = this.listStored().map(toListItem);
      var demo = DEMO_REQUESTS.map(toListItem);
      var seen = {};
      var merged = [];

      stored.forEach(function (item) {
        seen[item.id] = true;
        merged.push(item);
      });
      demo.forEach(function (item) {
        if (!seen[item.id]) merged.push(item);
      });
      return merged;
    },

    findById: function (id) {
      var stored = this.getStoredById(id);
      if (stored) return toListItem(stored);
      for (var i = 0; i < DEMO_REQUESTS.length; i += 1) {
        if (DEMO_REQUESTS[i].id === id) return toListItem(DEMO_REQUESTS[i]);
      }
      return null;
    },
  };

  function normalizeCandidate(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = pickStr(raw.id);
    var name = pickStr(raw.name);
    var type = pickStr(raw.type);
    if (!id || !name || !CANDIDATE_TYPE_LABELS[type]) return null;
    var categories = Array.isArray(raw.categories) ? raw.categories.map(String).filter(Boolean) : [];
    var areas = Array.isArray(raw.areas) ? raw.areas.map(String).filter(Boolean) : [];
    var skills = Array.isArray(raw.skills) ? raw.skills.map(String).filter(Boolean) : [];
    if (!categories.length || !areas.length) return null;
    var availability = pickStr(raw.availability) || "available";
    if (availability !== "available" && availability !== "busy") availability = "available";
    return {
      id: id,
      name: name,
      type: type,
      categories: categories,
      areas: areas,
      skills: skills,
      availability: availability,
      headline: pickStr(raw.headline) || name,
      score: Number(raw.score) || 70,
      source: pickStr(raw.source) || "local",
    };
  }

  var CandidateStore = {
    key: CANDIDATES_STORAGE_KEY,

    listAll: function () {
      var local = [];
      try {
        var raw = localStorage.getItem(CANDIDATES_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            local = parsed.map(normalizeCandidate).filter(Boolean);
          }
        }
      } catch (_e) {
        local = [];
      }

      var demo = DEMO_CANDIDATES.map(function (c) {
        return normalizeCandidate(Object.assign({ source: "demo" }, c));
      }).filter(Boolean);

      var seen = {};
      var merged = [];
      local.forEach(function (c) {
        seen[c.id] = true;
        merged.push(c);
      });
      demo.forEach(function (c) {
        if (!seen[c.id]) merged.push(c);
      });
      return merged;
    },
  };

  function extractPrefecture(area) {
    var text = String(area || "").trim();
    var m = text.match(/(.+?[都道府県])/);
    return m ? m[1] : text;
  }

  function areaMatches(requestArea, candidateAreas) {
    var req = String(requestArea || "").trim();
    var pref = extractPrefecture(req);
    if (!req) return false;
    return candidateAreas.some(function (a) {
      if (a === "全国" || a === "オンライン") return true;
      if (req.indexOf(a) >= 0) return true;
      if (pref && (a.indexOf(pref) >= 0 || pref.indexOf(a) >= 0)) return true;
      return false;
    });
  }

  function categoryMatches(requestCategory, candidateCategories) {
    var cat = pickStr(requestCategory);
    if (!cat) return false;
    return candidateCategories.indexOf(cat) >= 0;
  }

  function collectKeywordHits(request, candidate) {
    var hay = (pickStr(request.title) + " " + pickStr(request.body)).toLowerCase();
    if (!hay) return { hits: 0, reasons: [] };

    var hits = 0;
    var reasons = [];
    candidate.skills.forEach(function (skill) {
      var s = String(skill || "").trim();
      if (!s) return;
      if (hay.indexOf(s.toLowerCase()) >= 0) {
        hits += 1;
        if (reasons.indexOf("キーワード一致") === -1) reasons.push("キーワード一致");
      }
    });
    return { hits: hits, reasons: reasons };
  }

  function isUrgentRequest(request) {
    var u = pickStr(request.urgency);
    return u === "急ぎ" || u === "至急";
  }

  function matchCandidates(request) {
    if (!request) return [];
    var urgent = isUrgentRequest(request);
    var all = CandidateStore.listAll();
    var matched = [];

    all.forEach(function (candidate) {
      var catOk = categoryMatches(request.category, candidate.categories);
      var areaOk = areaMatches(request.area, candidate.areas);
      if (!catOk || !areaOk) return;

      var kw = collectKeywordHits(request, candidate);
      var reasons = [];
      if (catOk) reasons.push("カテゴリ一致");
      if (areaOk) {
        if (candidate.areas.indexOf("全国") >= 0) reasons.push("全国対応");
        else if (candidate.areas.indexOf("オンライン") >= 0) reasons.push("オンライン対応");
        else reasons.push("エリア一致");
      }
      kw.reasons.forEach(function (r) {
        if (reasons.indexOf(r) === -1) reasons.push(r);
      });

      var matchScore = Number(candidate.score) || 70;
      matchScore += kw.hits * 8;
      if (urgent && candidate.availability === "available") {
        matchScore += 40;
        reasons.push("急ぎ対応可");
      } else if (urgent && candidate.availability !== "available") {
        matchScore -= 30;
      }

      matched.push({
        candidate: candidate,
        matchScore: matchScore,
        reasons: reasons,
        urgentRank: urgent && candidate.availability === "available" ? 1 : 0,
      });
    });

    matched.sort(function (a, b) {
      if (b.urgentRank !== a.urgentRank) return b.urgentRank - a.urgentRank;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (Number(b.candidate.score) || 0) - (Number(a.candidate.score) || 0);
    });

    return matched;
  }

  var VALID_STORE_MODES = ["local", "supabase", "dual"];
  var SupabaseStore = window.TasuPlatformRequestSupabaseStore || null;
  var MatchesStore = window.TasuPlatformRequestMatchesSupabaseStore || null;
  var NotificationStore = window.TasuPlatformRequestNotificationStore || null;
  var TalkBridge = window.TasuPlatformRequestTalkBridge || null;
  var PaymentBridge = window.TasuPlatformRequestPaymentBridge || null;

  function resolveStoreMode() {
    var cfg = window.TasuPlatformRequestConfig || {};
    var fromCfg = pickStr(cfg.storeMode);
    if (VALID_STORE_MODES.indexOf(fromCfg) >= 0) {
      return { mode: fromCfg, explicit: true };
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = pickStr(params.get("prq_store"), params.get("storeMode"));
      if (VALID_STORE_MODES.indexOf(fromQuery) >= 0) {
        return { mode: fromQuery, explicit: true };
      }
    } catch (_eMode) {
      /* ignore */
    }
    return { mode: "local", explicit: false };
  }

  var _resolvedStore = resolveStoreMode();

  var Adapter = {
    mode: _resolvedStore.mode,
    _explicitStoreMode: _resolvedStore.explicit ? _resolvedStore.mode : null,
    _readyPromise: null,
    _userId: null,
    _authReady: false,
    _remoteRows: [],
    _useRemote: false,
    _fallbackReason: "",
    _warned: false,
    _pendingToast: false,
    _pendingToastMsg: "",

    getEffectiveMode: function () {
      if (this._explicitStoreMode === "local") return "local";
      if (!SupabaseStore || !SupabaseStore.isConfigured()) return "local";
      if (!this._authReady || !this._userId) return "local";
      if (this._explicitStoreMode) return this._explicitStoreMode;
      return "dual";
    },

    hasExplicitStoreMode: function () {
      return Boolean(this._explicitStoreMode);
    },

    getExplicitStoreMode: function () {
      return this._explicitStoreMode;
    },

    _maybeNotifyFallback: function (msg) {
      if (this._warned) return;
      this._warned = true;
      var text =
        msg ||
        "Platform Request のサーバー保存は利用できないため local storage fallback を使用しています";
      console.warn("[TasuPlatformRequest] " + text);
      if (typeof showToast === "function") {
        showToast(text);
      } else {
        this._pendingToast = true;
        this._pendingToastMsg = text;
      }
    },

    flushPendingStubToast: function () {
      if (!this._pendingToast) return;
      this._pendingToast = false;
      if (typeof showToast === "function" && this._pendingToastMsg) {
        showToast(this._pendingToastMsg);
      }
      this._pendingToastMsg = "";
    },

    ensureReady: function () {
      if (this._readyPromise) return this._readyPromise;
      var self = this;
      this._readyPromise = this._bootstrap().catch(function (err) {
        console.warn("[TasuPlatformRequest] ensureReady failed:", err);
        self._useRemote = false;
        self._fallbackReason = "bootstrap_failed";
      });
      return this._readyPromise;
    },

    _bootstrap: function () {
      var self = this;
      if (self._explicitStoreMode === "local") {
        self._authReady = true;
        return Promise.resolve();
      }
      if (!SupabaseStore || !SupabaseStore.isConfigured()) {
        self._fallbackReason = "not_configured";
        self._maybeNotifyFallback(
          "Supabase 未設定のため local storage fallback を使用しています"
        );
        return Promise.resolve();
      }
      return SupabaseStore.getSessionUserId().then(function (uid) {
        self._userId = uid || null;
        self._authReady = true;
        if (!uid) {
          self._useRemote = false;
          self._fallbackReason = "not_authenticated";
          if (self._explicitStoreMode === "supabase" || self._explicitStoreMode === "dual") {
            self._maybeNotifyFallback(
              "ログインすると依頼をサーバーに保存できます（現在は local storage fallback）"
            );
          }
          return;
        }
        self._useRemote = true;
        return self._refreshRemoteCache();
      });
    },

    _refreshRemoteCache: function () {
      var self = this;
      if (!SupabaseStore || !self._useRemote) return Promise.resolve([]);
      return SupabaseStore.listRows(self._userId).then(function (res) {
        if (!res.ok) {
          self._remoteRows = [];
          if (res.reason === "rls_denied") {
            self._maybeNotifyFallback("アクセス権限がないため一覧を取得できませんでした");
          }
          return [];
        }
        self._remoteRows = res.rows || [];
        return self._remoteRows;
      });
    },

    _mergeDisplayItems: function () {
      var effective = this.getEffectiveMode();
      var currentUserId = this._userId || "";
      var merged = [];
      var seen = {};

      if (effective === "supabase" || effective === "dual") {
        (this._remoteRows || []).forEach(function (row) {
          var item = storedToListItem(row, currentUserId);
          if (!item) return;
          seen[item.id] = true;
          if (item.legacyLocalId) seen[item.legacyLocalId] = true;
          merged.push(item);
        });
      }

      if (effective === "local" || effective === "dual" || !this._useRemote) {
        LocalRequestStore.listStored().forEach(function (stored) {
          if (seen[stored.id]) return;
          if (effective !== "local") {
            var dup = (this._remoteRows || []).some(function (row) {
              return row.legacyLocalId === stored.id;
            });
            if (dup) return;
          }
          seen[stored.id] = true;
          merged.push(toListItem(stored));
        }, this);
      }

      DEMO_REQUESTS.forEach(function (demo) {
        if (!seen[demo.id]) merged.push(toListItem(demo));
      });

      merged.sort(function (a, b) {
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
      return merged;
    },

    listRequests: function () {
      return this._mergeDisplayItems();
    },

    listRequestsAsync: function () {
      var self = this;
      return this.ensureReady().then(function () {
        if (self._useRemote) return self._refreshRemoteCache();
        return [];
      }).then(function () {
        return self._mergeDisplayItems();
      });
    },

    getRequest: function (id) {
      var effective = this.getEffectiveMode();
      var currentUserId = this._userId || "";

      if (effective === "supabase" || effective === "dual") {
        for (var i = 0; i < (this._remoteRows || []).length; i += 1) {
          var row = this._remoteRows[i];
          if (row.id === id || row.legacyLocalId === id) {
            return storedToListItem(row, currentUserId);
          }
        }
      }

      var stored = LocalRequestStore.getStoredById(id);
      if (stored) return toListItem(stored);
      for (var d = 0; d < DEMO_REQUESTS.length; d += 1) {
        if (DEMO_REQUESTS[d].id === id) return toListItem(DEMO_REQUESTS[d]);
      }
      return null;
    },

    getRequestAsync: function (id) {
      var self = this;
      return this.ensureReady().then(function () {
        var cached = self.getRequest(id);
        if (cached) return cached;
        if (!self._useRemote || !SupabaseStore) return null;
        return SupabaseStore.getById(id, self._userId).then(function (res) {
          if (!res.ok || !res.row) return null;
          var idx = -1;
          for (var i = 0; i < (self._remoteRows || []).length; i += 1) {
            if (self._remoteRows[i].id === res.row.id) {
              idx = i;
              break;
            }
          }
          if (idx >= 0) self._remoteRows[idx] = res.row;
          else self._remoteRows.unshift(res.row);
          return storedToListItem(res.row, self._userId);
        });
      });
    },

    createRequest: function (payload) {
      if (this.getEffectiveMode() === "local" || !this._useRemote) {
        return LocalRequestStore.save(payload);
      }
      return this.createRequestAsync(payload);
    },

    createRequestAsync: function (payload) {
      var self = this;
      return this.ensureReady().then(function () {
        if (!self._useRemote || !SupabaseStore || !self._userId) {
          self._maybeNotifyFallback();
          return LocalRequestStore.save(payload);
        }

        var legacyId = newId();
        return SupabaseStore.createRow(payload, self._userId, legacyId).then(function (res) {
          if (!res.ok || !res.row) {
            if (res.reason === "rls_denied") {
              self._maybeNotifyFallback("投稿権限がないためローカルに保存しました");
            } else {
              self._maybeNotifyFallback("サーバー保存に失敗したためローカルに保存しました");
            }
            return LocalRequestStore.save(payload);
          }

          self._remoteRows.unshift(res.row);

          if (self.getEffectiveMode() === "dual") {
            try {
              LocalRequestStore.save({
                id: legacyId,
                title: payload.title,
                body: payload.body,
                category: payload.category,
                area: payload.area,
                urgency: payload.urgency,
                budget: payload.budget,
                photos: payload.photos,
                status: payload.status || "open",
              });
            } catch (mirrorErr) {
              console.warn("[TasuPlatformRequest] dual mirror failed:", mirrorErr);
            }
          }

          return storedToListItem(res.row, self._userId);
        });
      });
    },

    updateRequestStatus: function (id, nextStatus) {
      if (VALID_STATUSES.indexOf(nextStatus) === -1) return null;
      if (this.getEffectiveMode() === "local" || !this._useRemote) {
        var prev = LocalRequestStore.getStoredById(id);
        var localUpdated = LocalRequestStore.updateStatus(id, nextStatus);
        if (localUpdated && (nextStatus === "open" || nextStatus === "closed")) {
          this._emitStatusNotifications(
            { id: id, ownerId: this._userId, status: nextStatus },
            prev ? prev.status : "",
            nextStatus
          );
        }
        return localUpdated ? toListItem(localUpdated) : null;
      }
      return this.updateRequestStatusAsync(id, nextStatus);
    },

    updateRequestStatusAsync: function (id, nextStatus) {
      var self = this;
      if (VALID_STATUSES.indexOf(nextStatus) === -1) return Promise.resolve(null);

      return this.ensureReady().then(function () {
        if (!self._useRemote || !SupabaseStore || !SupabaseStore.isUuid(id) || !self._userId) {
          var localItem = LocalRequestStore.updateStatus(id, nextStatus);
          return localItem ? toListItem(localItem) : null;
        }

        return SupabaseStore.updateStatusRow(id, nextStatus, self._userId).then(function (res) {
          if (!res.ok || !res.row) {
            if (res.reason === "rls_denied") {
              self._maybeNotifyFallback("ステータス更新の権限がありません");
            }
            return null;
          }

          var previousStatus = "";
          for (var pi = 0; pi < (self._remoteRows || []).length; pi += 1) {
            if (self._remoteRows[pi].id === id) {
              previousStatus = self._remoteRows[pi].status || "";
              break;
            }
          }

          for (var i = 0; i < (self._remoteRows || []).length; i += 1) {
            if (self._remoteRows[i].id === res.row.id) {
              self._remoteRows[i] = res.row;
              break;
            }
          }

          if (self.getEffectiveMode() === "dual" && res.row.legacyLocalId) {
            LocalRequestStore.updateStatus(res.row.legacyLocalId, nextStatus);
          }

          if (nextStatus === "open" || nextStatus === "closed") {
            self._emitStatusNotifications(res.row, previousStatus, nextStatus);
          }

          return storedToListItem(res.row, self._userId);
        });
      });
    },

    canEditRequest: function (request) {
      if (!request) return false;
      if (request.isMine) return true;
      if (this.getEffectiveMode() === "local") return LocalRequestStore.isLocalRequest(request.id);
      if (request.source === "local") return true;
      if (request.ownerId && this._userId) return request.ownerId === this._userId;
      return false;
    },

    listCandidates: function () {
      return CandidateStore.listAll();
    },

    matchCandidatesForRequest: function (request) {
      return matchCandidates(request);
    },

    matchCandidates: function (request) {
      return this.matchCandidatesForRequest(request);
    },

    listMatchesForRequestAsync: function (requestId) {
      var self = this;
      return this.ensureReady().then(function () {
        if (!self._useRemote || !MatchesStore || !MatchesStore.isConfigured()) {
          return { ok: false, reason: "not_configured", rows: [] };
        }
        if (!MatchesStore.isUuid(requestId)) {
          return { ok: false, reason: "invalid_request", rows: [] };
        }
        return MatchesStore.listForRequest(requestId).then(function (res) {
          if (!res.ok && res.reason === "rls_denied") {
            self._maybeNotifyFallback("マッチ一覧の取得権限がありません");
          }
          return res;
        });
      });
    },

    listMatchesForCandidateAsync: function () {
      var self = this;
      return this.ensureReady().then(function () {
        if (!self._useRemote || !MatchesStore || !MatchesStore.isConfigured() || !self._userId) {
          return { ok: false, reason: "not_configured", rows: [] };
        }
        return MatchesStore.listForCandidate().then(function (res) {
          if (!res.ok && res.reason === "rls_denied") {
            self._maybeNotifyFallback("自分宛マッチの取得権限がありません");
          }
          return res;
        });
      });
    },

    syncMatchesForRequestAsync: function (request) {
      var self = this;
      return this.ensureReady().then(function () {
        if (!self._useRemote || !MatchesStore || !MatchesStore.isConfigured() || !self._userId) {
          return { ok: false, reason: "not_configured", inserted: [], skipped: [] };
        }
        if (!request || !MatchesStore.isUuid(request.id)) {
          return { ok: false, reason: "invalid_request", inserted: [], skipped: [] };
        }
        var localMatches = matchCandidates(request);
        var payload = [];
        localMatches.forEach(function (m) {
          var c = m.candidate || {};
          var type = pickStr(c.type);
          var mappedType = type === "company" ? "company" : type === "worker" ? "worker" : "freelancer";
          var candidateId = pickStr(c.supabaseCandidateId, c.candidateId);
          if (!candidateId || !MatchesStore.isUuid(candidateId)) return;
          if (!MatchesStore.resolveCandidateUserIdClient(mappedType, candidateId)) return;
          payload.push({
            candidate_type: mappedType,
            candidate_id: candidateId,
            match_score: Math.round(Number(m.matchScore) || 0),
            match_reasons: Array.isArray(m.reasons) ? m.reasons : [],
          });
        });
        if (!payload.length) {
          return { ok: true, reason: "no_resolvable_candidates", inserted: [], skipped: [] };
        }
        return MatchesStore.createMatchesViaEdge(request.id, payload);
      });
    },

    _buildRequestMetaMap: function () {
      var map = {};
      var uid = this._userId || "";
      (this._remoteRows || []).forEach(function (row) {
        if (!row || !row.id) return;
        map[row.id] = { ownerId: pickStr(row.ownerId), status: pickStr(row.status) || "open" };
      });
      LocalRequestStore.listStored().forEach(function (row) {
        if (!row || !row.id) return;
        map[row.id] = { ownerId: uid, status: pickStr(row.status) || "open" };
      });
      return map;
    },

    _emitStatusNotifications: function (row, previousStatus, nextStatus) {
      if (!row || !row.id) return;
      var requestId = row.id;
      var ownerId = pickStr(row.ownerId, this._userId);
      var effective = this.getEffectiveMode();

      if (effective === "local" || !this._useRemote) {
        if (!NotificationStore || !ownerId) return;
        var ownerMsg =
          nextStatus === "closed"
            ? "依頼が終了しました"
            : nextStatus === "open"
              ? "依頼が受付中になりました"
              : "依頼のステータスが更新されました";
        NotificationStore.addLocal({
          requestId: requestId,
          recipientId: ownerId,
          ownerId: ownerId,
          kind: "status",
          requestStatus: nextStatus,
          message: ownerMsg,
        });
        return;
      }

      if (!NotificationStore || !NotificationStore.isConfigured()) return;
      if (previousStatus === nextStatus) return;
      NotificationStore.notifyStatusChangeViaEdge(requestId, nextStatus, previousStatus).catch(function (err) {
        console.warn("[TasuPlatformRequest] status notification failed:", err);
      });
    },

    listNotificationsAsync: function () {
      var self = this;
      return this.ensureReady().then(function () {
        var uid = pickStr(self._userId);
        if (!uid) return { ok: false, reason: "not_authenticated", rows: [] };

        var effective = self.getEffectiveMode();
        var meta = self._buildRequestMetaMap();
        var ownerByRequest = {};
        Object.keys(meta).forEach(function (rid) {
          ownerByRequest[rid] = meta[rid].ownerId;
        });

        if (effective === "local") {
          var localRows = NotificationStore ? NotificationStore.listLocal(uid) : [];
          return { ok: true, rows: localRows, source: "local" };
        }

        if (!self._useRemote || !NotificationStore || !NotificationStore.isConfigured()) {
          return { ok: false, reason: "not_configured", rows: [] };
        }

        return NotificationStore.listForRecipient(uid, ownerByRequest).then(function (res) {
          if (!res.ok) return res;
          var rows = (res.rows || []).map(function (row) {
            var requestMeta = meta[row.requestId] || {};
            if (!row.message || row.kind === "status") {
              row.message = NotificationStore.deriveMessage(row, {
                ownerId: ownerByRequest[row.requestId],
                requestStatus: requestMeta.status,
                matchCount: 1,
              });
            }
            return row;
          });
          if (effective === "dual") {
            var localRows = NotificationStore.listLocal(uid);
            var seen = {};
            rows.forEach(function (r) {
              seen[r.id] = true;
            });
            localRows.forEach(function (lr) {
              if (!seen[lr.id]) rows.unshift(lr);
            });
          }
          return { ok: true, rows: rows, source: effective };
        });
      });
    },

    unreadNotificationCountAsync: function () {
      var self = this;
      return this.listNotificationsAsync().then(function (res) {
        if (!res.ok) return { ok: false, count: 0, reason: res.reason };
        var count = (res.rows || []).filter(function (row) {
          return row.isUnread;
        }).length;
        return { ok: true, count: count };
      });
    },

    markNotificationReadAsync: function (notificationId) {
      var self = this;
      return this.ensureReady().then(function () {
        var uid = pickStr(self._userId);
        var nid = pickStr(notificationId);
        if (!uid || !nid) return { ok: false, reason: "invalid_args", updated: 0 };
        if (!NotificationStore) return { ok: false, reason: "not_configured", updated: 0 };

        var effective = self.getEffectiveMode();
        if (effective === "local" || !NotificationStore.isUuid(nid)) {
          var changed = NotificationStore.markLocalRead(nid, uid);
          return { ok: changed, updated: changed ? 1 : 0, reason: changed ? "" : "not_found" };
        }

        if (!self._useRemote || !NotificationStore.isConfigured()) {
          return { ok: false, reason: "not_configured", updated: 0 };
        }

        return NotificationStore.markAsReadViaEdge([nid]);
      });
    },

    markAllNotificationsReadAsync: function () {
      var self = this;
      return this.listNotificationsAsync().then(function (res) {
        if (!res.ok) return { ok: false, updated: 0, reason: res.reason };
        var unreadIds = (res.rows || [])
          .filter(function (row) {
            return row.isUnread;
          })
          .map(function (row) {
            return row.id;
          });
        if (!unreadIds.length) return { ok: true, updated: 0 };

        var effective = self.getEffectiveMode();
        if (effective === "local") {
          var n = NotificationStore ? NotificationStore.markAllLocalRead(self._userId) : 0;
          return { ok: true, updated: n };
        }

        if (!NotificationStore || !NotificationStore.isConfigured()) {
          return { ok: false, updated: 0, reason: "not_configured" };
        }

        var edgeIds = unreadIds.filter(function (id) {
          return NotificationStore.isUuid(id);
        });
        var localCount = 0;
        unreadIds.forEach(function (id) {
          if (!NotificationStore.isUuid(id) && NotificationStore.markLocalRead(id, self._userId)) {
            localCount += 1;
          }
        });
        if (!edgeIds.length) return { ok: true, updated: localCount };
        return NotificationStore.markAsReadViaEdge(edgeIds).then(function (edgeRes) {
          return {
            ok: Boolean(edgeRes.ok),
            updated: (Number(edgeRes.updated) || 0) + localCount,
            reason: edgeRes.reason || "",
          };
        });
      });
    },

    listLocalMigratableItems: function () {
      return LocalRequestStore.listStored().filter(function (row) {
        if (!row || !row.id) return false;
        var id = String(row.id);
        if (id.indexOf("demo-") === 0) return false;
        return id.indexOf("prq-") === 0;
      });
    },

    countLocalMigratablePendingAsync: function () {
      var self = this;
      return this.ensureReady().then(function () {
        var items = self.listLocalMigratableItems();
        if (!items.length) {
          return { ok: true, total: 0, pending: 0, synced: 0, forbidden: false };
        }
        if (!SupabaseStore || !SupabaseStore.isConfigured()) {
          return {
            ok: false,
            reason: "production_forbidden",
            total: items.length,
            pending: 0,
            synced: 0,
            forbidden: true,
          };
        }
        if (!self._useRemote || !self._userId) {
          return { ok: true, total: items.length, pending: items.length, synced: 0, forbidden: false };
        }
        var pending = 0;
        var synced = 0;
        var chain = Promise.resolve();
        items.forEach(function (item) {
          chain = chain.then(function () {
            return SupabaseStore.getById(item.id, self._userId).then(function (res) {
              if (res.ok && res.row) synced += 1;
              else pending += 1;
            });
          });
        });
        return chain.then(function () {
          return { ok: true, total: items.length, pending: pending, synced: synced, forbidden: false };
        });
      });
    },

    syncLocalToSupabaseAsync: function () {
      var self = this;
      return this.ensureReady().then(function () {
        if (!SupabaseStore || !SupabaseStore.isConfigured()) {
          return {
            ok: false,
            reason: "production_forbidden",
            created: [],
            skipped: [],
            failed: [],
          };
        }
        if (!self._useRemote || !self._userId) {
          return {
            ok: false,
            reason: "not_authenticated",
            created: [],
            skipped: [],
            failed: [],
          };
        }
        var items = self.listLocalMigratableItems();
        if (!items.length) {
          return {
            ok: true,
            reason: "nothing_to_sync",
            created: [],
            skipped: [],
            failed: [],
          };
        }
        var created = [];
        var skipped = [];
        var failed = [];
        var chain = Promise.resolve();
        items.forEach(function (item) {
          chain = chain.then(function () {
            return SupabaseStore.getById(item.id, self._userId).then(function (existing) {
              if (existing.ok && existing.row) {
                skipped.push({
                  localId: item.id,
                  remoteId: existing.row.id,
                  reason: "already_synced",
                });
                return;
              }
              var payload = {
                title: item.title,
                body: item.body,
                category: item.category,
                area: item.area,
                urgency: item.urgency,
                budget: item.budget,
                photos: item.photos,
                status: item.status,
              };
              return SupabaseStore.createRow(payload, self._userId, item.id).then(function (res) {
                if (res.ok && res.row) {
                  created.push({ localId: item.id, remoteId: res.row.id });
                  self._remoteRows = self._remoteRows || [];
                  var dupIdx = -1;
                  for (var i = 0; i < self._remoteRows.length; i += 1) {
                    if (self._remoteRows[i].id === res.row.id) {
                      dupIdx = i;
                      break;
                    }
                  }
                  if (dupIdx >= 0) self._remoteRows[dupIdx] = res.row;
                  else self._remoteRows.unshift(res.row);
                } else {
                  failed.push({ localId: item.id, reason: res.reason || "create_failed" });
                }
              });
            });
          });
        });
        return chain.then(function () {
          return {
            ok: failed.length === 0,
            reason: failed.length ? "partial_failure" : "ok",
            created: created,
            skipped: skipped,
            failed: failed,
          };
        });
      });
    },

    isLocalRequest: function (id) {
      return LocalRequestStore.isLocalRequest(id);
    },

    key: STORAGE_KEY,

    readRaw: function () {
      return LocalRequestStore.readRaw();
    },

    writeRaw: function (rows) {
      return LocalRequestStore.writeRaw(rows);
    },

    listStored: function () {
      return LocalRequestStore.listStored();
    },

    getStoredById: function (id) {
      return LocalRequestStore.getStoredById(id);
    },

    save: function (input) {
      return this.createRequest(input);
    },

    updateStatus: function (id, nextStatus) {
      return this.updateRequestStatus(id, nextStatus);
    },

    listAllForDisplay: function () {
      return this.listRequests();
    },

    findById: function (id) {
      return this.getRequest(id);
    },

    startTalkForMatchAsync: function (requestId, matchId, opts) {
      if (!TalkBridge) {
        return Promise.resolve({ ok: false, reason: "talk_bridge_missing" });
      }
      return TalkBridge.startTalkForMatch(requestId, matchId, opts || {});
    },
  };

  function candidateTypeClass(type) {
    if (type === "company" || type === "builder_partner") return "prq-tag--type-company";
    if (type === "worker") return "prq-tag--type-worker";
    if (type === "freelancer" || type === "user") return "prq-tag--type-freelancer";
    return "";
  }

  function mapDisplayType(type) {
    if (type === "user") return "freelancer";
    if (type === "builder_partner") return "company";
    return type;
  }

  function supabaseMatchToCard(row) {
    var displayType = mapDisplayType(row.candidateType);
    var reasons = Array.isArray(row.matchReasons) ? row.matchReasons : [];
    return {
      matchId: pickStr(row.id),
      candidate: {
        id: row.candidateId,
        name: row.displayName || "候補",
        type: displayType,
        categories: [],
        areas: [],
        skills: [],
        availability: "available",
        headline: "サーバー保存のマッチ候補（P3 ローカル候補より優先表示）",
        score: row.matchScore,
      },
      matchScore: row.matchScore,
      reasons: reasons.length ? reasons : ["マッチ登録済み"],
      source: "supabase",
    };
  }

  function runTalkStart(request, matchId, triggerBtn) {
    var rid = pickStr(request && request.id);
    var mid = pickStr(matchId);
    if (triggerBtn) triggerBtn.disabled = true;
    return Adapter.startTalkForMatchAsync(rid, mid, { title: pickStr(request.title) })
      .then(function (res) {
        if (triggerBtn) triggerBtn.disabled = false;
        if (!res.ok) {
          showToast("Talk の開始に失敗しました（ログイン・Staging 接続を確認してください）");
          return res;
        }
        TalkBridge.navigateToTalk(res.roomId, { requestId: rid, matchId: mid });
        return res;
      })
      .catch(function (err) {
        if (triggerBtn) triggerBtn.disabled = false;
        console.warn("[TasuPlatformRequest] start talk failed:", err);
        showToast("Talk の開始に失敗しました");
        return { ok: false, reason: "error" };
      });
  }

  function handleStartTalk(request, matchId, triggerBtn) {
    var rid = pickStr(request && request.id);
    var mid = pickStr(matchId);
    if (!rid || !mid || !TalkBridge || !TalkBridge.isUuid(mid)) {
      showToast("Talk を開始するにはマッチ情報が必要です");
      return Promise.resolve({ ok: false, reason: "invalid_args" });
    }
    if (PaymentBridge && PaymentBridge.isConfigured()) {
      return PaymentBridge.hasPaidEntitlementAsync(mid).then(function (ent) {
        if (!ent.paid) {
          var fee = PaymentBridge.resolveFeeYen ? PaymentBridge.resolveFeeYen() : DISCLOSURE_FEE_YEN;
          showToast("Talk開始には情報開示料（¥" + String(fee) + "）のお支払いが必要です");
          return { ok: false, reason: "payment_required" };
        }
        return runTalkStart(request, mid, triggerBtn);
      });
    }
    return runTalkStart(request, mid, triggerBtn);
  }

  function bindCandidateCardActions(list, request) {
    $all("[data-prq-notify-candidate]", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        showToast("通知候補への追加は P5 以降で接続予定です");
      });
    });
    $all("[data-prq-talk-candidate]", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest("[data-prq-candidate-card]");
        var matchId = card ? card.getAttribute("data-prq-match-id") : "";
        handleStartTalk(request, matchId, btn);
      });
    });
    $all("[data-prq-respond-candidate]", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest("[data-prq-candidate-card]");
        var matchId = card ? card.getAttribute("data-prq-match-id") : "";
        var name = btn.getAttribute("data-candidate-name") || "候補者";
        openRespondModal(request, name, matchId);
      });
    });
  }

  function paintCandidatesSection(request, matches, sourceLabel) {
    var section = $("[data-prq-candidates-section]");
    var list = $("[data-prq-candidates-list]");
    var empty = $("[data-prq-candidates-empty]");
    var count = $("[data-prq-candidates-count]");
    var sub = $("[data-prq-candidates-sub]");
    if (!section || !list || !empty) return;

    section.hidden = false;
    if (sub) {
      sub.textContent =
        sourceLabel === "supabase"
          ? "Supabase に保存されたマッチ候補です（ローカル抽出より優先）"
          : "投稿内容から抽出した通知候補です（まだ通知は送信されません）";
    }
    if (count) {
      count.textContent = String(matches.length) + "件";
    }

    if (!matches.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = matches.map(renderCandidateCard).join("");
    bindCandidateCardActions(list, request);
  }

  function renderCandidatesSection(request) {
    var effective = Adapter.getEffectiveMode();
    var canRemote =
      (effective === "supabase" || effective === "dual") &&
      MatchesStore &&
      MatchesStore.isConfigured() &&
      MatchesStore.isUuid(request && request.id);

    if (!canRemote) {
      paintCandidatesSection(request, Adapter.matchCandidatesForRequest(request), "local");
      return;
    }

    Adapter.listMatchesForRequestAsync(request.id)
      .then(function (res) {
        if (res.ok && res.rows && res.rows.length) {
          paintCandidatesSection(
            request,
            res.rows.map(supabaseMatchToCard),
            "supabase"
          );
          return;
        }
        paintCandidatesSection(request, Adapter.matchCandidatesForRequest(request), "local");
      })
      .catch(function (err) {
        console.warn("[TasuPlatformRequest] matches load failed:", err);
        paintCandidatesSection(request, Adapter.matchCandidatesForRequest(request), "local");
      });
  }

  function renderNotificationItem(row) {
    var matchId = pickStr(row.matchId);
    var detailHref =
      "platform-request-detail.html?id=" +
      encodeURIComponent(row.requestId || "") +
      (matchId ? "&match_id=" + encodeURIComponent(matchId) + "&prq_talk=1" : "") +
      "&prq_store=supabase";
    var unreadClass = row.isUnread ? " is-unread" : " is-read";
    var stateLabel = row.isUnread ? "未読" : "既読";
    return (
      '<article class="prq-notification' +
      unreadClass +
      '" data-prq-notification data-notification-id="' +
      esc(row.id) +
      '" data-request-id="' +
      esc(row.requestId || "") +
      '"' +
      (matchId ? ' data-match-id="' + esc(matchId) + '"' : "") +
      ">" +
      '<div class="prq-notification__head">' +
      '<span class="prq-notification__badge">' +
      esc(stateLabel) +
      "</span>" +
      '<time class="prq-notification__time" datetime="' +
      esc(row.createdAt || "") +
      '">' +
      esc(formatRelativeTime(row.createdAt)) +
      "</time>" +
      "</div>" +
      '<p class="prq-notification__message">' +
      esc(row.message || "通知") +
      "</p>" +
      '<div class="prq-notification__actions">' +
      '<a class="prq-btn prq-btn--ghost prq-btn--sm" href="' +
      esc(detailHref) +
      '">依頼を見る</a>' +
      (matchId
        ? '<a class="prq-btn prq-btn--cyan prq-btn--sm" href="' +
          esc(detailHref) +
          '">Talk開始</a>'
        : "") +
      (row.isUnread
        ? '<button type="button" class="prq-btn prq-btn--sm" data-prq-notification-read>既読にする</button>'
        : "") +
      "</div>" +
      "</article>"
    );
  }

  function bindNotificationPanelEvents(panel) {
    if (!panel || panel.getAttribute("data-prq-notifications-bound") === "1") return;
    panel.setAttribute("data-prq-notifications-bound", "1");

    panel.addEventListener("click", function (e) {
      var readBtn = e.target.closest("[data-prq-notification-read]");
      if (!readBtn) return;
      var item = readBtn.closest("[data-prq-notification]");
      if (!item) return;
      var nid = item.getAttribute("data-notification-id");
      if (!nid) return;
      Adapter.markNotificationReadAsync(nid).then(function (res) {
        if (!res.ok) {
          showToast("既読の更新に失敗しました");
          return;
        }
        paintNotificationsPanel();
      });
    });

    var markAll = $("[data-prq-notifications-mark-all]", panel);
    if (markAll) {
      markAll.addEventListener("click", function () {
        Adapter.markAllNotificationsReadAsync().then(function (res) {
          if (!res.ok) {
            showToast("既読の更新に失敗しました");
            return;
          }
          paintNotificationsPanel();
        });
      });
    }
  }

  function paintNotificationsPanel() {
    var panel = $("[data-prq-notifications]");
    var list = $("[data-prq-notifications-list]");
    var empty = $("[data-prq-notifications-empty]");
    var unreadBadge = $("[data-prq-notifications-unread]");
    if (!panel || !list) return;

    bindNotificationPanelEvents(panel);

    Adapter.listNotificationsAsync().then(function (res) {
      var rows = res.ok ? res.rows || [] : [];
      var unread = rows.filter(function (row) {
        return row.isUnread;
      }).length;

      if (unreadBadge) {
        if (unread > 0) {
          unreadBadge.textContent = String(unread);
          unreadBadge.hidden = false;
        } else {
          unreadBadge.textContent = "";
          unreadBadge.hidden = true;
        }
      }

      if (!rows.length) {
        panel.hidden = false;
        list.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
      }

      panel.hidden = false;
      if (empty) empty.hidden = true;
      list.innerHTML = rows.map(renderNotificationItem).join("");
    });
  }

  function renderIncomingMatchesPanel(rows) {
    var panel = $("[data-prq-incoming-matches]");
    var list = $("[data-prq-incoming-matches-list]");
    var empty = $("[data-prq-incoming-matches-empty]");
    if (!panel || !list) return;
    if (!rows || !rows.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    if (empty) empty.hidden = true;
    list.innerHTML = rows
      .map(function (row) {
        var href =
          "platform-request-detail.html?id=" + encodeURIComponent(row.requestId || "");
        return (
          '<a class="prq-incoming-match" href="' +
          href +
          '">' +
          '<span class="prq-incoming-match__score">' +
          esc(String(Math.round(row.matchScore))) +
          "</span>" +
          '<span class="prq-incoming-match__meta">' +
          esc(row.displayName || "マッチ") +
          " · " +
          esc(formatRelativeTime(row.createdAt)) +
          "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  function renderCandidateCard(match) {
    var c = match.candidate;
    var areasText = c.areas.join(" · ");
    var catsText = c.categories.join(" · ");
    var reasonsHtml = match.reasons
      .map(function (r) {
        return '<span class="prq-tag prq-tag--reason">' + esc(r) + "</span>";
      })
      .join("");

    return (
      '<article class="prq-candidate-card" data-prq-candidate-card data-prq-candidate-id="' +
      esc(c.id) +
      '"' +
      (pickStr(match.matchId) ? ' data-prq-match-id="' + esc(match.matchId) + '"' : "") +
      ' data-prq-candidate-availability="' +
      esc(c.availability) +
      '">' +
      '<div class="prq-candidate-card__head">' +
      '<div class="prq-candidate-card__identity">' +
      '<h3 class="prq-candidate-card__name">' +
      esc(c.name) +
      "</h3>" +
      '<span class="prq-tag ' +
      candidateTypeClass(c.type) +
      '">' +
      esc(CANDIDATE_TYPE_LABELS[c.type] || c.type) +
      "</span>" +
      "</div>" +
      '<span class="prq-candidate-card__score" aria-label="マッチスコア">' +
      esc(String(Math.round(match.matchScore))) +
      "</span>" +
      "</div>" +
      '<p class="prq-candidate-card__headline">' +
      esc(c.headline) +
      "</p>" +
      '<dl class="prq-candidate-card__meta">' +
      "<div><dt>対応エリア</dt><dd>" +
      esc(areasText) +
      "</dd></div>" +
      "<div><dt>カテゴリ</dt><dd>" +
      esc(catsText) +
      "</dd></div>" +
      "</dl>" +
      '<div class="prq-candidate-card__reasons" aria-label="一致理由">' +
      reasonsHtml +
      "</div>" +
      '<div class="prq-candidate-card__actions">' +
      '<button type="button" class="prq-btn prq-btn--primary prq-btn--sm" data-prq-respond-candidate data-candidate-name="' +
      esc(c.name) +
      '">対応できます</button>' +
      '<button type="button" class="prq-btn prq-btn--ghost prq-btn--sm" data-prq-notify-candidate>通知候補にする</button>' +
      '<button type="button" class="prq-btn prq-btn--cyan prq-btn--sm" data-prq-talk-candidate>Talk開始</button>' +
      "</div>" +
      "</article>"
    );
  }

  var respondModalLastFocus = null;

  function getFocusableElements(root) {
    return $all(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      root
    ).filter(function (el) {
      return el.offsetParent !== null || el === root;
    });
  }

  function trapModalFocus(e, panel) {
    if (e.key !== "Tab" || !panel) return;
    var focusable = getFocusableElements(panel);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openRespondModal(request, candidateName, matchId) {
    var modal = $("[data-prq-respond-modal]");
    if (!modal) return;

    var panel = $(".prq-modal__panel", modal);
    var nameEl = $("[data-prq-modal-candidate-name]");
    var titleEl = $("[data-prq-modal-request-title]");
    var feeEl = $("[data-prq-modal-fee]");
    var feeYen =
      PaymentBridge && PaymentBridge.resolveFeeYen
        ? PaymentBridge.resolveFeeYen()
        : DISCLOSURE_FEE_YEN;
    if (nameEl) nameEl.textContent = candidateName || "—";
    if (titleEl) titleEl.textContent = pickStr(request && request.title) || "—";
    if (feeEl) feeEl.textContent = "¥" + String(feeYen);
    modal.setAttribute("data-prq-modal-request-id", pickStr(request && request.id));
    modal.setAttribute("data-prq-modal-match-id", pickStr(matchId));

    respondModalLastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("prq-modal-open");

    var proceed = $("[data-prq-modal-proceed]");
    if (proceed) {
      proceed.focus();
    } else if (panel) {
      panel.focus();
    }
  }

  function closeRespondModal() {
    var modal = $("[data-prq-respond-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("prq-modal-open");
    if (respondModalLastFocus && respondModalLastFocus.focus) {
      respondModalLastFocus.focus();
    }
  }

  function bindRespondModal() {
    var modal = $("[data-prq-respond-modal]");
    if (!modal || modal.getAttribute("data-prq-modal-bound") === "1") return;
    modal.setAttribute("data-prq-modal-bound", "1");

    $all("[data-prq-modal-close]", modal).forEach(function (el) {
      el.addEventListener("click", closeRespondModal);
    });

    var cancel = $("[data-prq-modal-cancel]");
    if (cancel) cancel.addEventListener("click", closeRespondModal);

    var proceed = $("[data-prq-modal-proceed]");
    if (proceed) {
      proceed.addEventListener("click", function () {
        var modalEl = $("[data-prq-respond-modal]");
        var requestId = modalEl ? modalEl.getAttribute("data-prq-modal-request-id") : "";
        var matchId = modalEl ? modalEl.getAttribute("data-prq-modal-match-id") : "";
        if (!PaymentBridge || !PaymentBridge.isConfigured()) {
          closeRespondModal();
          showToast("決済には Staging ログインと Supabase 接続が必要です");
          return;
        }
        if (!matchId || !PaymentBridge.isUuid(matchId)) {
          closeRespondModal();
          showToast("マッチ情報がないため決済を開始できません（Supabase マッチが必要です）");
          return;
        }
        proceed.disabled = true;
        PaymentBridge.startCheckout(requestId, matchId)
          .then(function (res) {
            proceed.disabled = false;
            if (res.redirect) return res;
            closeRespondModal();
            if (res.ok && (res.already_paid || res.paid)) {
              showToast("決済済みです。Talk を開始します");
              var req = { id: requestId };
              paintContactReveal(req, matchId);
              return handleStartTalk(req, matchId, null);
            }
            if (res.ok && res.data && res.data.simulate) {
              showToast("決済が完了しました（Staging シミュレート）");
              paintContactReveal({ id: requestId }, matchId);
              return handleStartTalk({ id: requestId }, matchId, null);
            }
            showToast("決済の開始に失敗しました");
            return res;
          })
          .catch(function () {
            proceed.disabled = false;
            showToast("決済の開始に失敗しました");
          });
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.hidden) {
        closeRespondModal();
        return;
      }
      if (!modal.hidden) {
        var panel = $(".prq-modal__panel", modal);
        trapModalFocus(e, panel);
      }
    });
  }

  function renderStatusControls(request, onStatusChange) {
    var wrap = $("[data-prq-status-controls]");
    if (!wrap) return;

    var isEditable = Adapter.canEditRequest(request);
    wrap.hidden = !isEditable;
    if (!isEditable) return;

    $all("[data-prq-status-set]", wrap).forEach(function (btn) {
      var next = btn.getAttribute("data-prq-status-set");
      btn.classList.toggle("is-active", next === request.status);
      btn.onclick = function () {
        if (!next || next === request.status) return;
        Promise.resolve(Adapter.updateRequestStatus(request.id, next)).then(function (updated) {
          if (!updated) {
            showToast("ステータスの更新に失敗しました");
            return;
          }
          if (onStatusChange) onStatusChange(updated);
          showToast("ステータスを「" + (STATUS_LABELS[next] || next) + "」に更新しました");
        });
      };
    });
  }

  function applyDetailStatusUI(item) {
    var status = $("[data-prq-detail-status]");
    if (!status) return;
    status.textContent = STATUS_LABELS[item.status] || item.status || "受付中";
    status.className = "prq-detail__meta-value prq-detail__status " + statusClass(item.status);
    renderStatusControls(item, function (updated) {
      applyDetailStatusUI(updated);
    });
  }

  function showToast(msg) {
    var toast = $("[data-prq-toast]");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2800);
  }

  function urgencyClass(urgency) {
    if (urgency === "至急" || urgency === "急ぎ") return "prq-tag--urgent";
    return "";
  }

  function statusClass(status) {
    if (status === "open") return "prq-tag--status-open";
    if (status === "closed") return "prq-tag--status-closed";
    if (status === "cancelled") return "prq-tag--status-cancelled";
    return "";
  }

  function hasShownPostedBanner(id) {
    if (!id) return true;
    try {
      var raw = localStorage.getItem(POSTED_BANNER_KEY);
      var map = raw ? JSON.parse(raw) : {};
      return !!map[id];
    } catch (_e) {
      return false;
    }
  }

  function markPostedBannerShown(id) {
    if (!id) return;
    try {
      var raw = localStorage.getItem(POSTED_BANNER_KEY);
      var map = raw && typeof JSON.parse(raw) === "object" ? JSON.parse(raw) : {};
      map[id] = true;
      localStorage.setItem(POSTED_BANNER_KEY, JSON.stringify(map));
    } catch (_e2) {
      /* UI-only key — ignore */
    }
  }

  function cleanPostedParam(params) {
    if (!params || params.get("posted") !== "1") return;
    params.delete("posted");
    var qs = params.toString();
    var url = window.location.pathname + (qs ? "?" + qs : "");
    history.replaceState(null, "", url);
  }

  function initPostedBanner(id, params) {
    var banner = $("[data-prq-posted-banner]");
    if (!banner || !id) return;

    var shouldShow = params.get("posted") === "1" && !hasShownPostedBanner(id);
    if (!shouldShow) {
      if (params.get("posted") === "1") cleanPostedParam(params);
      return;
    }

    banner.hidden = false;
    markPostedBannerShown(id);
    cleanPostedParam(params);

    var closeBtn = $("[data-prq-posted-banner-close]");
    if (closeBtn && !closeBtn.getAttribute("data-prq-bound")) {
      closeBtn.setAttribute("data-prq-bound", "1");
      closeBtn.addEventListener("click", function () {
        banner.hidden = true;
      });
    }
  }

  function paintLocalSyncPanel(onSynced) {
    var panel = $("[data-prq-local-sync]");
    if (!panel) return;

    Adapter.countLocalMigratablePendingAsync().then(function (info) {
      if (!info || info.forbidden || !info.total || !Adapter._userId) {
        panel.hidden = true;
        return;
      }

      panel.hidden = false;
      var summary = $("[data-prq-local-sync-summary]", panel);
      if (summary) {
        var pending = typeof info.pending === "number" ? info.pending : info.total;
        summary.textContent =
          "このブラウザに保存された依頼が " +
          String(info.total) +
          " 件あります。未同期 " +
          String(pending) +
          " 件をサーバーへコピーできます（端末内のデータは残ります）。";
      }

      var btn = $("[data-prq-local-sync-btn]", panel);
      var statusEl = $("[data-prq-local-sync-status]", panel);
      if (!btn || btn.getAttribute("data-prq-bound")) return;

      btn.setAttribute("data-prq-bound", "1");
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        btn.disabled = true;
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "同期中…";
        }
        Adapter.syncLocalToSupabaseAsync()
          .then(function (res) {
            btn.disabled = false;
            var createdN = (res.created || []).length;
            var skipN = (res.skipped || []).length;
            var failN = (res.failed || []).length;
            if (createdN > 0) {
              showToast(createdN + " 件をサーバーへ同期しました");
            } else if (skipN > 0 && failN === 0) {
              showToast("同期済みの依頼はスキップしました");
            } else if (failN > 0) {
              showToast("一部の依頼を同期できませんでした");
            }
            if (statusEl) {
              statusEl.textContent =
                "作成 " + createdN + " · スキップ " + skipN + (failN ? " · 失敗 " + failN : "");
            }
            return Adapter.countLocalMigratablePendingAsync();
          })
          .then(function (nextInfo) {
            if (summary && nextInfo) {
              var nextPending = typeof nextInfo.pending === "number" ? nextInfo.pending : 0;
              summary.textContent =
                "このブラウザに保存された依頼が " +
                String(nextInfo.total) +
                " 件あります。未同期 " +
                String(nextPending) +
                " 件をサーバーへコピーできます（端末内のデータは残ります）。";
            }
            return Adapter.listRequestsAsync();
          })
          .then(function (items) {
            if (typeof onSynced === "function") onSynced(items || []);
          })
          .catch(function (err) {
            btn.disabled = false;
            console.warn("[TasuPlatformRequest] local sync failed:", err);
            if (statusEl) {
              statusEl.hidden = false;
              statusEl.textContent = "同期に失敗しました。端末内のデータは保持されています。";
            }
            showToast("同期に失敗しました");
          });
      });
    });
  }

  function cardStatusModifier(status) {
    if (status === "closed") return "prq-card--closed";
    if (status === "cancelled") return "prq-card--cancelled";
    return "prq-card--open";
  }

  function initList() {
    if (document.body.getAttribute("data-prq-page") !== "list") return;

    var grid = $("[data-prq-grid]");
    var empty = $("[data-prq-empty]");
    var searchInput = $("[data-prq-search]");
    var catRoot = $("[data-prq-cats]");
    if (!grid) return;

    var allItems = [];
    var activeCat = "すべて";

    function updateEmptyCopy(filteredCount) {
      if (!empty) return;
      var titleEl = $("[data-prq-empty-title]", empty);
      var textEl = $("[data-prq-empty-text]", empty);
      var zeroPosts = allItems.length === 0;
      if (zeroPosts) {
        if (titleEl) titleEl.textContent = "最初の依頼を投稿してみましょう";
        if (textEl) {
          textEl.textContent =
            "Talk Home から依頼を投稿すると、条件に合う候補が表示されます。";
        }
      } else if (!filteredCount) {
        if (titleEl) titleEl.textContent = "該当する依頼がありません";
        if (textEl) textEl.textContent = "条件を変えるか、新しい依頼を投稿してみてください。";
      }
    }

    function renderCards(items) {
      if (!items.length) {
        grid.innerHTML = "";
        if (empty) empty.hidden = false;
        updateEmptyCopy(0);
        return;
      }
      if (empty) empty.hidden = true;
      grid.innerHTML = items
        .map(function (item) {
          var relTime = formatRelativeTime(item.createdAt);
          var fullTime = formatDateTime(item.createdAt);
          var st = item.status || "open";
          return (
            '<a class="prq-card ' +
            cardStatusModifier(st) +
            '" href="platform-request-detail.html?id=' +
            encodeURIComponent(item.id) +
            '" data-prq-card data-category="' +
            esc(item.category) +
            '" aria-label="' +
            esc(item.title) +
            '">' +
            '<div class="prq-card__top">' +
            '<span class="prq-tag ' +
            statusClass(st) +
            '">' +
            esc(STATUS_LABELS[st] || st) +
            "</span>" +
            (item.isMine
              ? '<span class="prq-tag prq-tag--mine"><span class="prq-tag__dot" aria-hidden="true"></span>自分の投稿</span>'
              : "") +
            "</div>" +
            "<h3 class=\"prq-card__title\">" +
            esc(item.title) +
            "</h3>" +
            '<div class="prq-card__tags">' +
            '<span class="prq-tag prq-tag--cat">' +
            esc(item.category) +
            "</span>" +
            (item.urgency && item.urgency !== "通常"
              ? '<span class="prq-tag ' + urgencyClass(item.urgency) + '">' + esc(item.urgency) + "</span>"
              : "") +
            "</div>" +
            '<p class="prq-card__excerpt">' +
            esc(item.excerpt) +
            "</p>" +
            '<div class="prq-card__foot">' +
            '<span class="prq-card__area" title="地域">' +
            esc(item.area) +
            "</span>" +
            '<time class="prq-card__time" datetime="' +
            esc(item.createdAt || "") +
            '" title="' +
            esc(fullTime) +
            '">' +
            esc(relTime) +
            "</time>" +
            "</div>" +
            "</a>"
          );
        })
        .join("");
    }

    function filter() {
      var q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
      var filtered = allItems.filter(function (item) {
        var catOk = activeCat === "すべて" || item.category === activeCat;
        if (!catOk) return false;
        if (!q) return true;
        var hay = (
          item.title +
          " " +
          item.excerpt +
          " " +
          item.body +
          " " +
          item.category +
          " " +
          item.area +
          " " +
          (item.budget || "")
        ).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      renderCards(filtered);
    }

    if (catRoot) {
      catRoot.innerHTML = CATEGORIES.map(function (cat) {
        return (
          '<button type="button" class="prq-cat-chip' +
          (cat === activeCat ? " is-active" : "") +
          '" data-prq-cat="' +
          esc(cat) +
          '">' +
          esc(cat) +
          "</button>"
        );
      }).join("");

      catRoot.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-prq-cat]");
        if (!btn) return;
        activeCat = btn.getAttribute("data-prq-cat") || "すべて";
        $all("[data-prq-cat]", catRoot).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        filter();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", filter);
    }

    Adapter.listRequestsAsync().then(function (items) {
      allItems = items || [];
      filter();
      paintLocalSyncPanel(function (syncedItems) {
        allItems = syncedItems || [];
        filter();
      });
      var mode = Adapter.getEffectiveMode();
      if (mode === "supabase" || mode === "dual") {
        Adapter.listMatchesForCandidateAsync().then(function (res) {
          if (res.ok) renderIncomingMatchesPanel(res.rows);
        });
      }
      paintNotificationsPanel();
    });
  }

  function setFieldError(fieldEl, message) {
    if (!fieldEl) return;
    var wrap = fieldEl.closest(".prq-field");
    if (!wrap) return;
    var err = wrap.querySelector("[data-prq-field-error]");
    if (message) {
      wrap.classList.add("is-invalid");
      if (err) {
        err.textContent = message;
        err.hidden = false;
      }
      fieldEl.setAttribute("aria-invalid", "true");
    } else {
      wrap.classList.remove("is-invalid");
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
      fieldEl.removeAttribute("aria-invalid");
    }
  }

  function clearFormErrors(form) {
    $all(".prq-field.is-invalid", form).forEach(function (wrap) {
      wrap.classList.remove("is-invalid");
      var err = wrap.querySelector("[data-prq-field-error]");
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
    });
    $all("[aria-invalid]", form).forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function initCharCounters(form) {
    var titleEl = $("#prq-title", form);
    var bodyEl = $("#prq-body", form);
    var titleCounter = $('[data-prq-counter="prq-title"]');
    var bodyCounter = $('[data-prq-counter="prq-body"]');

    function updateTitle() {
      if (!titleEl || !titleCounter) return;
      var len = (titleEl.value || "").length;
      titleCounter.textContent = len + " / 80";
    }
    function updateBody() {
      if (!bodyEl || !bodyCounter) return;
      var len = (bodyEl.value || "").length;
      bodyCounter.textContent = len + " 文字";
    }
    if (titleEl) {
      titleEl.addEventListener("input", updateTitle);
      updateTitle();
    }
    if (bodyEl) {
      bodyEl.addEventListener("input", updateBody);
      updateBody();
    }
  }

  function initCreate() {
    if (document.body.getAttribute("data-prq-page") !== "create") return;

    var form = $("[data-prq-create-form]");
    var photoBtn = $("[data-prq-photo]");
    var photoLabel = $("[data-prq-photo-label-text]");
    if (!form) return;

    initCharCounters(form);

    var mockPhotos = [];

    function refreshPhotoLabel() {
      if (!photoLabel) return;
      if (!mockPhotos.length) {
        photoLabel.textContent = "写真を追加（モック · 任意）";
        return;
      }
      photoLabel.textContent = "写真 " + mockPhotos.length + " 件（モック）";
    }

    $all("input, select, textarea", form).forEach(function (el) {
      el.addEventListener("input", function () {
        setFieldError(el, "");
      });
      el.addEventListener("change", function () {
        setFieldError(el, "");
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFormErrors(form);

      var titleEl = $("#prq-title", form);
      var bodyEl = $("#prq-body", form);
      var categoryEl = $("#prq-category", form);
      var areaEl = $("#prq-area", form);
      var urgencyEl = $("#prq-urgency", form);
      var budgetEl = $("#prq-budget", form);

      var title = pickStr(titleEl && titleEl.value);
      var body = pickStr(bodyEl && bodyEl.value);
      var category = pickStr(categoryEl && categoryEl.value);
      var area = pickStr(areaEl && areaEl.value);
      var hasError = false;

      if (!title) {
        setFieldError(titleEl, "タイトルを入力してください");
        hasError = true;
      }
      if (!body) {
        setFieldError(bodyEl, "内容を入力してください");
        hasError = true;
      }
      if (!category) {
        setFieldError(categoryEl, "カテゴリを選択してください");
        hasError = true;
      }
      if (!area) {
        setFieldError(areaEl, "地域を入力してください");
        hasError = true;
      }

      if (hasError) {
        var firstInvalid = $(".prq-field.is-invalid input, .prq-field.is-invalid select, .prq-field.is-invalid textarea", form);
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      Promise.resolve(
        Adapter.createRequest({
          title: title,
          body: body,
          category: category,
          area: area,
          urgency: pickStr(urgencyEl && urgencyEl.value) || "通常",
          budget: pickStr(budgetEl && budgetEl.value),
          photos: mockPhotos.slice(),
          status: "open",
        })
      )
        .then(function (saved) {
          if (!saved || !saved.id) {
            showToast("保存に失敗しました。もう一度お試しください。");
            return;
          }
          window.location.href =
            "platform-request-detail.html?id=" +
            encodeURIComponent(saved.id) +
            "&posted=1";
        })
        .catch(function () {
          showToast("保存に失敗しました。もう一度お試しください。");
        });
    });

    if (photoBtn) {
      photoBtn.addEventListener("click", function () {
        mockPhotos.push({
          id: "mock-photo-" + Date.now(),
          name: "request-photo-" + (mockPhotos.length + 1) + ".jpg",
          addedAt: new Date().toISOString(),
        });
        refreshPhotoLabel();
        showToast("写真をモック追加しました（実アップロードは今後対応）");
      });
    }
  }

  function paintContactReveal(request, matchId) {
    var section = $("[data-prq-contact-reveal]");
    if (!section || !PaymentBridge || !PaymentBridge.isConfigured()) {
      if (section) section.hidden = true;
      return Promise.resolve();
    }
    var rid = pickStr(request && request.id);
    var mid = pickStr(matchId);
    if (!rid || !mid || !PaymentBridge.isUuid(mid)) {
      section.hidden = true;
      return Promise.resolve();
    }
    return PaymentBridge.hasPaidEntitlementAsync(mid).then(function (ent) {
      if (!ent.paid) {
        section.hidden = true;
        return;
      }
      return PaymentBridge.fetchContactReveal(rid, mid).then(function (res) {
        if (!res.ok) {
          section.hidden = true;
          return;
        }
        section.hidden = false;
        var emailEl = $("[data-prq-contact-email]");
        var labelEl = $("[data-prq-contact-label]");
        if (labelEl) {
          labelEl.textContent =
            res.revealed_for === "owner" ? "候補者の連絡先" : "依頼者の連絡先";
        }
        if (emailEl) emailEl.textContent = pickStr(res.contact && res.contact.email, "（未登録）");
      });
    });
  }

  function handleCheckoutReturn(request) {
    if (!PaymentBridge || !PaymentBridge.isConfigured()) return Promise.resolve();
    var parsed = PaymentBridge.parseCheckoutReturnParams();
    if (!parsed) return Promise.resolve();

    if (parsed.outcome === "cancelled") {
      showToast("決済をキャンセルしました");
      PaymentBridge.clearCheckoutQueryParams();
      return Promise.resolve();
    }

    if (parsed.outcome !== "success" || !parsed.session_id) return Promise.resolve();

    return PaymentBridge.confirmCheckout(parsed.session_id, parsed.request_id, parsed.match_id)
      .then(function (res) {
        PaymentBridge.clearCheckoutQueryParams();
        if (!res.ok) {
          showToast("決済の確認に失敗しました");
          return res;
        }
        showToast("決済が完了しました");
        var req = request || { id: parsed.request_id };
        paintContactReveal(req, parsed.match_id);
        if (parsed.match_id) return handleStartTalk(req, parsed.match_id, null);
        return res;
      })
      .catch(function () {
        PaymentBridge.clearCheckoutQueryParams();
        showToast("決済の確認に失敗しました");
      });
  }

  function paintDetailTalkCta(request) {
    var btn = $("[data-prq-start-talk]");
    if (!btn || !request) return;

    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (_eParams) {
      params = null;
    }
    var hintMatchId = params ? pickStr(params.get("match_id")) : "";
    var wantTalk = params ? pickStr(params.get("prq_talk")) === "1" : false;

    function showForMatch(matchId) {
      if (!matchId || !TalkBridge || !TalkBridge.isUuid(matchId)) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.setAttribute("data-prq-match-id", matchId);
      if (wantTalk) btn.classList.add("is-highlight");
      if (!btn.getAttribute("data-prq-talk-bound")) {
        btn.setAttribute("data-prq-talk-bound", "1");
        btn.addEventListener("click", function () {
          handleStartTalk(request, btn.getAttribute("data-prq-match-id"), btn);
        });
      }
    }

    if (hintMatchId && TalkBridge && TalkBridge.isUuid(hintMatchId)) {
      showForMatch(hintMatchId);
      return;
    }

    var mode = Adapter.getEffectiveMode();
    if (mode === "supabase" || mode === "dual") {
      Adapter.listMatchesForRequestAsync(request.id).then(function (ownerRes) {
        if (ownerRes.ok && ownerRes.rows && ownerRes.rows.length) {
          showForMatch(ownerRes.rows[0].id);
          return;
        }
        Adapter.listMatchesForCandidateAsync().then(function (candRes) {
          if (!candRes.ok) {
            btn.hidden = true;
            return;
          }
          var mine = (candRes.rows || []).filter(function (row) {
            return pickStr(row.requestId) === pickStr(request.id);
          });
          if (mine.length) showForMatch(mine[0].id);
          else btn.hidden = true;
        });
      });
      return;
    }

    btn.hidden = true;
  }

  function initDetail() {
    if (document.body.getAttribute("data-prq-page") !== "detail") return;

    bindRespondModal();

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "";

    var content = $("[data-prq-detail-content]");
    var notFound = $("[data-prq-not-found]");
    var respond = $("[data-prq-respond]");

    function showNotFound() {
      if (content) content.hidden = true;
      if (notFound) notFound.hidden = false;
      document.title = "依頼が見つかりません | Platform Request | TASFUL";
    }

    function renderDetail(item) {
      if (notFound) notFound.hidden = true;
      if (content) content.hidden = false;

      initPostedBanner(id, params);

      var title = $("[data-prq-detail-title]");
      var body = $("[data-prq-detail-body]");
      var area = $("[data-prq-detail-area]");
      var category = $("[data-prq-detail-category]");
      var urgency = $("[data-prq-detail-urgency]");
      var date = $("[data-prq-detail-date]");
      var author = $("[data-prq-detail-author]");
      var status = $("[data-prq-detail-status]");
      var budget = $("[data-prq-detail-budget]");
      var budgetRow = $("[data-prq-detail-budget-row]");
      var areaChip = $("[data-prq-detail-area-chip]");
      var categoryChip = $("[data-prq-detail-category-chip]");
      var urgencyChip = $("[data-prq-detail-urgency-chip]");
      var budgetChip = $("[data-prq-detail-budget-chip]");

      if (title) title.textContent = item.title;
      if (body) body.textContent = item.body;
      if (area) area.textContent = item.area || "—";
      if (category) category.textContent = item.category || "—";
      if (urgency) urgency.textContent = item.urgency || "通常";
      if (areaChip) areaChip.textContent = item.area || "—";
      if (categoryChip) categoryChip.textContent = item.category || "—";
      if (urgencyChip) {
        if (item.urgency && item.urgency !== "通常") {
          urgencyChip.textContent = item.urgency;
          urgencyChip.className = "prq-tag " + urgencyClass(item.urgency);
          urgencyChip.hidden = false;
        } else {
          urgencyChip.hidden = true;
        }
      }
      if (budgetChip) {
        if (item.budget) {
          budgetChip.textContent = "予算 " + item.budget;
          budgetChip.hidden = false;
        } else {
          budgetChip.hidden = true;
        }
      }
      if (date) {
        date.textContent = formatRelativeTime(item.createdAt);
        date.setAttribute("datetime", item.createdAt || "");
        date.setAttribute("title", formatDateTime(item.createdAt));
      }
      if (author) author.textContent = item.author || "匿名";
      if (status) {
        applyDetailStatusUI(item);
      }
      if (budget && budgetRow) {
        if (item.budget) {
          budget.textContent = item.budget;
          budgetRow.hidden = false;
        } else {
          budgetRow.hidden = true;
        }
      }

      if (respond) {
        respond.addEventListener("click", function () {
          showToast("候補カードの「対応できます」から仮導線をお試しください");
        });
      }

      var feeCard = $("[data-prq-fee-card]");
      if (feeCard) feeCard.hidden = false;

      renderCandidatesSection(item);
      paintDetailTalkCta(item);
      paintNotificationsPanel();

      var hintMatch = "";
      try {
        hintMatch = pickStr(new URLSearchParams(window.location.search).get("match_id"));
      } catch (_eHint) {
        hintMatch = "";
      }
      if (hintMatch) paintContactReveal(item, hintMatch);
      handleCheckoutReturn(item);
    }

    if (!id) {
      showNotFound();
      return;
    }

    Adapter.getRequestAsync(id).then(function (item) {
      if (!item) {
        showNotFound();
        return;
      }
      renderDetail(item);
    });
  }

  function init() {
    Adapter.ensureReady().finally(function () {
      Adapter.flushPendingStubToast();
      initList();
      initCreate();
      initDetail();
    });
  }

  window.TasuPlatformRequestStore = Adapter;
  window.TasuPlatformRequestAdapter = Adapter;
  window.TasuPlatformRequestCandidates = CandidateStore;
  window.TasuPlatformRequestMatcher = {
    matchCandidates: function (request) {
      return Adapter.matchCandidates(request);
    },
    listCandidates: function () {
      return Adapter.listCandidates();
    },
  };
  window.TasuPlatformRequestFee = {
    disclosureYen: DISCLOSURE_FEE_YEN,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
