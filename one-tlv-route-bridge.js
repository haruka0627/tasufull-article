/**
 * one-tlv-route-bridge.js
 * UI remains Stitch TLV hub HTML (literal). This file only maps clicks → existing TLV routes.
 * Do not alter layout / colors / component structure from here.
 */
(function () {
  "use strict";

  var body = document.body;
  if (body) {
    body.setAttribute("data-page", "one-tlv");
    body.setAttribute("data-ssot", "stitch-tasful-tlv-video-hub");
    body.setAttribute("data-ssot-phase", "v0-ui-hub");
  }

  /**
   * Canonical recovered family (forensic 2026-09-01):
   * TOP stays Stitch `/one-tlv`. Feature screens are the wired Next export under `/live/*`.
   * Formal Go Live Studio is `/one-tlv-go-live` (not the legacy V0 `/live/create/` studio).
   * Do not send users to vanilla flats (shorts.html, profile.html, settings.html, …)
   * or the Stitch Watch shell when a wired Next watch route exists.
   * Settings is the dedicated V0 screen at /live/settings/.
   * AI Preferences has no V0 page — stay on TOP.
   * Following is the dedicated V0 screen at /live/following/.
   * Earnings is the dedicated V0 screen at /live/studio/earnings/.
   */
  var ROUTES = {
    home: "/one-tlv",
    oneTop: "/one-top",
    live: "/live/discover/",
    shorts: "/live/shorts/discover/",
    videos: "/one-tlv",
    following: "/live/following/",
    studio: "/live/studio/",
    create: "/one-tlv-go-live",
    profile: "/live/profile/",
    settings: "/live/settings/",
    aiPreferences: "/one-tlv",
    analytics: "/live/studio/analytics/",
    earnings: "/live/studio/earnings/",
    gifts: "/one-tlv",
    ranking: "/live/ranking/",
    /** LIVE catalog. Header/sidebar 「ライブ」 and TOP 「すべて見る」 land here. */
    discover: "/live/discover/",
    /** Canonical Viewer. Card / enter-live keep real broadcast_id. */
    watch: "/live/watch/",
    notify: "/one-tlv",
  };

  function normalizeText(el) {
    return String(el && el.textContent ? el.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function myPageHref() {
    try {
      var id = "";
      if (window.TasuTlvDevAuth && window.TasuTlvDevAuth.getTlvViewerTalkUserId) {
        id = String(window.TasuTlvDevAuth.getTlvViewerTalkUserId() || "").trim();
      }
      if (!id && window.TasuLiveConfig && window.TasuLiveConfig.getTalkUserId) {
        id = String(window.TasuLiveConfig.getTalkUserId() || "").trim();
      }
      if (id) return "/live/profile/?userId=" + encodeURIComponent(id);
    } catch (_e) {}
    return ROUTES.profile;
  }

  function setHref(anchor, href) {
    if (!anchor || !href) return;
    anchor.setAttribute("href", href);
    anchor.setAttribute("data-tlv-route", href);
  }

  function bindClick(el, href) {
    if (!el || !href) return;
    el.setAttribute("data-tlv-route", href);
    el.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        window.location.href = href;
      },
      false
    );
  }

  function watchHrefHasBroadcastId(href) {
    if (!href) return false;
    try {
      var u = new URL(href, window.location.origin);
      if (String(u.pathname || "").indexOf("/live/watch") === -1) return false;
      return Boolean(
        String(
          u.searchParams.get("broadcast_id") || u.searchParams.get("id") || u.searchParams.get("broadcastId") || ""
        ).trim()
      );
    } catch (_e) {
      return /\/live\/watch\/?.*[?&]broadcast_id=/.test(String(href));
    }
  }

  function isVanillaWatchFallback(href) {
    var s = String(href || "");
    return /watch-live|one-tlv-watch|index\.html#live-broadcasts|videos\.html/i.test(s);
  }

  function resolveCanonicalWatchHrefSync() {
    var card = document.querySelector(
      "[data-one-tlv-live-discovery] [data-watch-href], [data-broadcast-id][data-watch-href]"
    );
    if (card) {
      var cardHref = card.getAttribute("data-watch-href");
      if (watchHrefHasBroadcastId(cardHref) && !isVanillaWatchFallback(cardHref)) return cardHref;
    }
    var data = window.__ONE_TLV_DATA__;
    var streams = data && Array.isArray(data.streams) ? data.streams : [];
    if (streams[0] && watchHrefHasBroadcastId(streams[0].watchHref) && !isVanillaWatchFallback(streams[0].watchHref)) {
      return streams[0].watchHref;
    }
    if (streams[0] && streams[0].id && window.TasuLiveConfig && typeof window.TasuLiveConfig.watchUrl === "function") {
      var fromCfg = window.TasuLiveConfig.watchUrl(streams[0].id);
      if (watchHrefHasBroadcastId(fromCfg)) return fromCfg;
    }
    return null;
  }

  function waitForDiscoveryWatchHref(timeoutMs) {
    return new Promise(function (resolve) {
      var start = Date.now();
      (function tick() {
        var href = resolveCanonicalWatchHrefSync();
        if (href) return resolve(href);
        var src = document.body && document.body.getAttribute("data-discovery-source");
        if (src && src !== "loading") return resolve(null);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, 80);
      })();
    });
  }

  async function resolveCanonicalWatchHref() {
    var href = resolveCanonicalWatchHrefSync();
    if (href) return href;
    href = await waitForDiscoveryWatchHref(4000);
    if (href) return href;
    var api = window.TasuLiveBroadcasts;
    if (api && typeof api.resolveLiveEntryHref === "function") {
      try {
        var liveHref = await api.resolveLiveEntryHref();
        if (watchHrefHasBroadcastId(liveHref) && !isVanillaWatchFallback(liveHref)) return liveHref;
      } catch (_err) {
        /* keep TOP; never invent an id */
      }
    }
    return null;
  }

  function scrollToLiveDiscovery() {
    var section = document.querySelector("[data-one-tlv-live-discovery]");
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bindWatchEntry(el) {
    if (!el || el.getAttribute("data-tlv-watch-entry-bound") === "1") return;
    el.setAttribute("data-tlv-watch-entry-bound", "1");
    el.setAttribute("href", "#");
    el.setAttribute("data-tlv-route", "watch-with-broadcast");
    el.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        resolveCanonicalWatchHref().then(function (href) {
          if (href) window.location.href = href;
          else scrollToLiveDiscovery();
        });
      },
      false
    );
  }

  /**
   * TOP ライブ nav (header / sidebar / mobile): LIVE catalog.
   * Viewer entry stays on cards / enter-live via resolveCanonicalWatchHref.
   */
  function applyLiveNavHref(el) {
    setHref(el, ROUTES.live);
  }

  function bindLiveNav(el) {
    bindDiscoverNav(el);
  }

  function bindDiscoverNav(el) {
    if (!el) return;
    setHref(el, ROUTES.live);
  }

  var NAV_HREF = {
    home: ROUTES.home,
    shorts: ROUTES.shorts,
    following: ROUTES.following,
    categories: ROUTES.videos,
    ranking: ROUTES.ranking,
    profile: ROUTES.profile,
    analytics: ROUTES.analytics,
    earnings: ROUTES.earnings,
    settings: ROUTES.settings,
    "ai-preferences": ROUTES.aiPreferences,
    "explore-all": ROUTES.live,
  };

  var ACTION_HREF = {
    "go-live": ROUTES.create,
    "open-ai-dashboard": ROUTES.analytics,
    "live-predictions": ROUTES.analytics,
  };

  var LIVE_NAV = { live: true };
  var WATCH_ACTIONS = { "enter-live": true };

  function wireAnchorsByLabel(root) {
    var anchors = root.querySelectorAll("a");
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var nav = a.getAttribute("data-tlv-nav");
      if (nav && LIVE_NAV[nav]) {
        bindDiscoverNav(a);
        continue;
      }
      if (nav === "profile") {
        setHref(a, myPageHref());
        continue;
      }
      if (nav && NAV_HREF[nav]) {
        setHref(a, NAV_HREF[nav]);
        continue;
      }
      var t = normalizeText(a);
      if (t === "Home" || t === "HOME" || t === "ホーム") setHref(a, ROUTES.home);
      else if (t === "LIVE" || t === "ライブ") bindDiscoverNav(a);
      else if (t === "Shorts" || t === "SHORTS" || t === "ショート") setHref(a, ROUTES.shorts);
      else if (t === "Following" || t === "フォロー中") setHref(a, ROUTES.following);
      else if (t === "Categories" || t === "カテゴリ") setHref(a, ROUTES.videos);
      else if (t === "Ranking" || t === "ランキング") setHref(a, ROUTES.ranking);
      else if (t === "My Page" || t === "Me" || t === "ME" || t === "マイページ" || t === "マイ")
        setHref(a, myPageHref());
      else if (t === "AI Insights" || t === "AIインサイト") setHref(a, ROUTES.analytics);
      else if (t === "Earnings" || t === "収益") setHref(a, ROUTES.earnings);
      else if (t === "Settings" || t === "設定") setHref(a, ROUTES.settings);
      else if (t === "AI Preferences" || t === "AI設定") setHref(a, ROUTES.aiPreferences);
      else if (/Explore All|すべて見る/i.test(t)) setHref(a, ROUTES.live);
    }
  }

  function wireButtonsByLabel(root) {
    var buttons = root.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var action = b.getAttribute("data-tlv-action");
      if (action && WATCH_ACTIONS[action]) {
        bindWatchEntry(b);
        continue;
      }
      if (action && ACTION_HREF[action]) {
        bindClick(b, ACTION_HREF[action]);
        continue;
      }
      var t = normalizeText(b);
      if (/Go Live Now|配信を開始/i.test(t)) bindClick(b, ROUTES.create);
      else if (/Enter LIVE Session|ライブに入る/i.test(t)) bindWatchEntry(b);
      else if (/Open AI Dashboard|AIダッシュボード/i.test(t)) bindClick(b, ROUTES.analytics);
      else if (/Live Predictions|ライブ予測/i.test(t)) bindClick(b, ROUTES.analytics);
    }

    /* Mobile center FAB (icon-only auto_awesome) → wired Go Live */
    var mobileNav = root.querySelector("nav.md\\:hidden, nav.fixed.bottom-0");
    if (mobileNav) {
      var fab = mobileNav.querySelector("button");
      if (fab && fab.getAttribute("data-tlv-action") !== "enter-live") bindClick(fab, ROUTES.create);
    }
  }

  function wireBrandToOneTop(root) {
    var brand = null;
    var spans = root.querySelectorAll("header span");
    for (var i = 0; i < spans.length; i++) {
      if (/TASFUL TLV/i.test(normalizeText(spans[i]))) {
        brand = spans[i];
        break;
      }
    }
    if (!brand) return;
    brand.style.cursor = "pointer";
    brand.setAttribute("data-tlv-route", ROUTES.oneTop);
    brand.setAttribute("title", "TASFUL ONE TOP");
    brand.addEventListener(
      "click",
      function () {
        window.location.href = ROUTES.oneTop;
      },
      false
    );
  }

  function isLiveDiscoverySection(section) {
    if (!section) return false;
    if (section.hasAttribute("data-one-tlv-live-discovery")) return true;
    var h2 = section.querySelector("h2");
    return Boolean(h2 && /Live Discovery|ライブを見つける/i.test(String(h2.textContent || "")));
  }

  function wireStreamCards(root) {
    /* Live Discovery cards are owned by one-tlv-data-adapter.js (broadcast_id). */
    var cards = root.querySelectorAll(".group.cursor-pointer, .col-span-12.lg\\:col-span-4.group");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (isLiveDiscoverySection(card.closest("section"))) continue;
      if (card.getAttribute("data-one-tlv-card") || card.getAttribute("data-broadcast-id")) continue;
      if (card.getAttribute("data-tlv-route")) continue;
      /* Do not send sample cards to bare /live/watch/. Resolve real broadcast on click. */
      card.setAttribute("data-tlv-route", "watch-with-broadcast");
      card.addEventListener(
        "click",
        function (e) {
          if (e.target && e.target.closest && e.target.closest("a,button")) return;
          e.preventDefault();
          resolveCanonicalWatchHref().then(function (href) {
            if (href) window.location.href = href;
            else scrollToLiveDiscovery();
          });
        },
        false
      );
    }
  }

  function init() {
    wireAnchorsByLabel(document);
    wireButtonsByLabel(document);
    wireBrandToOneTop(document);
    wireStreamCards(document);
    window.__ONE_TLV_BRIDGE__ = {
      version: 8,
      routes: ROUTES,
      canonicalTop: ROUTES.home,
      resolveCanonicalWatchHref: resolveCanonicalWatchHref,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
