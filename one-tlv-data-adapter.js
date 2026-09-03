/**
 * one-tlv-data-adapter.js
 * Live Discovery only — maps existing TasuLiveBroadcasts / live_broadcasts into Stitch card DOM.
 * Does not alter layout, classes, or inject live/** UI markup.
 */
(function (global) {
  "use strict";

  var CARD_LIMIT = 4;
  /** Wired Next LIVE Viewer (LiveKit / chat / follow). Not the Stitch one-tlv-watch shell. */
  var WATCH_BASE = "/live/watch/";

  function qsForceFallback() {
    try {
      return new URLSearchParams(global.location.search || "").get("data") === "fallback";
    } catch (_) {
      return false;
    }
  }

  function findDiscoverySection() {
    var marked = document.querySelector("[data-one-tlv-live-discovery]");
    if (marked) return marked;
    var headings = document.querySelectorAll("h2");
    for (var i = 0; i < headings.length; i++) {
      if (/Live Discovery|ライブを見つける/i.test(String(headings[i].textContent || ""))) {
        return headings[i].closest("section");
      }
    }
    return null;
  }

  function findDiscoveryCards(section) {
    if (!section) return [];
    return Array.prototype.slice.call(section.querySelectorAll(".group.cursor-pointer"));
  }

  function formatViewers(n) {
    var v = Number(n);
    if (!isFinite(v) || v < 0) v = 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(v));
  }

  function statusBadgeKey(status) {
    var s = String(status || "").toLowerCase();
    if (s === "scheduled") return "tlv.badge.soon";
    if (s === "ended") return "tlv.badge.ended";
    return "tlv.badge.live";
  }

  function statusBadgeText(status) {
    var key = statusBadgeKey(status);
    var I18n = global.TasuShortVideoI18n;
    if (I18n && typeof I18n.t === "function") {
      var loc = typeof I18n.getStoredLocale === "function" ? I18n.getStoredLocale() : "ja-JP";
      return I18n.t(key, loc);
    }
    var s = String(status || "").toLowerCase();
    if (s === "live") return "LIVE";
    if (s === "scheduled") return "SOON";
    if (s === "ended") return "ENDED";
    return s ? s.toUpperCase() : "LIVE";
  }

  function resolveThumbUrl(row, cfg) {
    var path = String(row && row.thumb_storage_path ? row.thumb_storage_path : "").trim();
    if (path && cfg && typeof cfg.getPublicStorageUrl === "function") {
      var url = cfg.getPublicStorageUrl(cfg.STORAGE_BUCKET_VIDEO_THUMBS || "live-thumbnails", path);
      if (url) return url;
    }
    return null;
  }

  function normalizeRow(row, cfg) {
    var id = String(row && row.id ? row.id : "").trim();
    var creatorId = String(row && row.creator_id ? row.creator_id : "").trim();
    var title = String(row && row.title ? row.title : "").trim() || "無題の配信";
    var status = String(row && row.status ? row.status : "").trim() || "live";
    var viewers = row && row.peak_viewers != null ? row.peak_viewers : 0;
    var creatorName =
      (cfg && typeof cfg.resolveDisplayName === "function" && creatorId
        ? cfg.resolveDisplayName(creatorId)
        : "") || creatorId || "クリエイター";
    var avatar =
      (cfg && typeof cfg.resolveAvatarUrl === "function" && creatorId
        ? cfg.resolveAvatarUrl(creatorId)
        : "") || null;
    var thumb = resolveThumbUrl(row, cfg);
    var tag =
      (cfg && typeof cfg.labelStreamProvider === "function"
        ? cfg.labelStreamProvider(row && row.stream_provider)
        : "") || status.toUpperCase();
    var watchHref = WATCH_BASE + "?broadcast_id=" + encodeURIComponent(id);
    return {
      id: id,
      title: title,
      creatorId: creatorId,
      creatorName: creatorName,
      thumbnail: thumb,
      avatar: avatar,
      viewerCount: viewers,
      viewerLabel: formatViewers(viewers),
      liveStatus: status,
      liveBadge: statusBadgeText(status),
      category: tag,
      watchHref: watchHref,
    };
  }

  function prioritizeRows(rows) {
    var list = Array.isArray(rows) ? rows.slice() : [];
    var live = list.filter(function (r) {
      return String(r.status || "") === "live";
    });
    var rest = list.filter(function (r) {
      return String(r.status || "") !== "live";
    });
    return live.concat(rest).slice(0, CARD_LIMIT);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setImgSrc(img, src, alt) {
    if (!img || !src) return;
    img.setAttribute("src", src);
    if (alt) img.setAttribute("alt", alt);
  }

  function findLiveBadge(card) {
    var keyed = card.querySelector('[data-i18n="tlv.badge.live"], [data-i18n="tlv.badge.soon"], [data-i18n="tlv.badge.ended"]');
    if (keyed) return keyed;
    var nodes = card.querySelectorAll("div, span");
    for (var i = 0; i < nodes.length; i++) {
      var t = String(nodes[i].textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (
        t === "LIVE" ||
        t === "SOON" ||
        t === "ENDED" ||
        t === "ライブ" ||
        t === "まもなく" ||
        t === "終了"
      )
        return nodes[i];
    }
    return null;
  }

  function findViewerLabel(card) {
    var icons = card.querySelectorAll(".material-symbols-outlined");
    for (var i = 0; i < icons.length; i++) {
      if (String(icons[i].textContent || "").trim() === "visibility") {
        var parent = icons[i].parentElement;
        if (parent) return parent;
      }
    }
    return null;
  }

  function findCategorySpans(card) {
    return Array.prototype.slice.call(
      card.querySelectorAll(".absolute.bottom-4 span, .absolute.bottom-3 span")
    );
  }

  /**
   * Patch copy / src / data attrs only — keep classes and node tree.
   */
  function applyStreamToCard(card, stream) {
    if (!card || !stream || !stream.id) return false;

    card.setAttribute("data-one-tlv-card", "1");
    card.setAttribute("data-broadcast-id", stream.id);
    card.setAttribute("data-live-status", stream.liveStatus);
    card.setAttribute("data-watch-href", stream.watchHref);
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");

    var thumb = card.querySelector(".relative img");
    setImgSrc(thumb, stream.thumbnail, stream.title);

    var badge = findLiveBadge(card);
    if (badge) {
      badge.setAttribute("data-i18n", statusBadgeKey(stream.liveStatus));
      setText(badge, stream.liveBadge);
    }

    var viewers = findViewerLabel(card);
    if (viewers) {
      var vis = viewers.querySelector(".material-symbols-outlined");
      viewers.textContent = "";
      if (vis) viewers.appendChild(vis);
      viewers.appendChild(document.createTextNode(" " + stream.viewerLabel));
    }

    var cats = findCategorySpans(card);
    for (var c = 0; c < cats.length; c++) {
      var catKey = cats[c].getAttribute("data-i18n") || "";
      if (catKey.indexOf("tlv.cat.") === 0 || catKey.indexOf("tlv.tag.") === 0) continue;
      if (c === 0) setText(cats[c], stream.category || stream.liveBadge);
      else if (stream.liveStatus) setText(cats[c], stream.liveBadge);
    }

    var title = card.querySelector("h3");
    setText(title, stream.title);

    var avatars = card.querySelectorAll('img[alt="Avatar"], .flex.gap-3 img, .flex.gap-4 img');
    for (var a = 0; a < avatars.length; a++) {
      if (avatars[a] !== thumb) {
        setImgSrc(avatars[a], stream.avatar, stream.creatorName);
        break;
      }
    }

    // Creator name: first descriptive <p> under title block
    var namePs = card.querySelectorAll(".min-w-0 p");
    if (namePs[0]) {
      // Preserve nested icons (e.g. auto_awesome) when present
      var icon = namePs[0].querySelector(".material-symbols-outlined");
      if (icon) {
        namePs[0].textContent = "";
        namePs[0].appendChild(document.createTextNode(stream.creatorName + " "));
        namePs[0].appendChild(icon);
      } else {
        setText(namePs[0], stream.creatorName);
      }
    }

    if (!card.__oneTlvClickBound) {
      card.__oneTlvClickBound = true;
      card.addEventListener(
        "click",
        function (e) {
          if (e.target && e.target.closest && e.target.closest("a,button")) return;
          var href = card.getAttribute("data-watch-href");
          if (href) global.location.href = href;
        },
        false
      );
      card.addEventListener(
        "keydown",
        function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            var href = card.getAttribute("data-watch-href");
            if (href) global.location.href = href;
          }
        },
        false
      );
    }

    return true;
  }

  function markSectionMeta(section, meta) {
    if (!section) return;
    section.setAttribute("data-one-tlv-discovery", "1");
    section.setAttribute("data-discovery-source", meta.source || "unknown");
    section.setAttribute("data-discovery-count", String(meta.count || 0));
    if (meta.error) section.setAttribute("data-discovery-error", String(meta.error).slice(0, 180));
    else section.removeAttribute("data-discovery-error");
  }

  /**
   * Apply normalized streams to existing Stitch cards.
   * If fewer streams than cards, remaining cards keep sample UI (fallback).
   */
  function applyStreams(streams, meta) {
    var section = findDiscoverySection();
    var cards = findDiscoveryCards(section);
    var list = Array.isArray(streams) ? streams : [];
    var applied = 0;
    for (var i = 0; i < cards.length; i++) {
      if (list[i]) {
        if (applyStreamToCard(cards[i], list[i])) applied += 1;
      } else {
        cards[i].setAttribute("data-one-tlv-card", "sample");
        cards[i].removeAttribute("data-broadcast-id");
      }
    }
    markSectionMeta(section, {
      source: (meta && meta.source) || "apply",
      count: applied,
      error: meta && meta.error,
    });
    global.__ONE_TLV_DATA__ = {
      source: (meta && meta.source) || "apply",
      count: applied,
      streams: list.slice(0, CARD_LIMIT),
      error: (meta && meta.error) || null,
      fallback: Boolean(meta && meta.fallback),
    };
    return global.__ONE_TLV_DATA__;
  }

  async function fetchNormalizedStreams() {
    var cfg = global.TasuLiveConfig;
    var api = global.TasuLiveBroadcasts;
    if (!cfg || !api || typeof api.fetchHubBroadcasts !== "function") {
      throw new Error("TasuLiveBroadcasts.fetchHubBroadcasts unavailable");
    }
    var rows = await api.fetchHubBroadcasts(24);
    var picked = prioritizeRows(rows);
    return picked.map(function (row) {
      return normalizeRow(row, cfg);
    });
  }

  async function loadDiscovery() {
    var section = findDiscoverySection();
    markSectionMeta(section, { source: "loading", count: 0 });

    if (qsForceFallback()) {
      applyStreams([], { source: "forced-fallback", count: 0, fallback: true });
      return global.__ONE_TLV_DATA__;
    }

    try {
      var streams = await fetchNormalizedStreams();
      if (!streams.length) {
        applyStreams([], { source: "empty", count: 0, fallback: true });
        return global.__ONE_TLV_DATA__;
      }
      applyStreams(streams, { source: "api", count: streams.length, fallback: false });
      return global.__ONE_TLV_DATA__;
    } catch (err) {
      console.warn("[TasuOneTlvDataAdapter] discovery fallback:", err);
      applyStreams([], {
        source: "error-fallback",
        count: 0,
        fallback: true,
        error: err && (err.message || String(err)),
      });
      return global.__ONE_TLV_DATA__;
    }
  }

  function create() {
    return {
      loadDiscovery: loadDiscovery,
      applyStreams: applyStreams,
      fetchNormalizedStreams: fetchNormalizedStreams,
      normalizeRow: normalizeRow,
      formatViewers: formatViewers,
      findDiscoveryCards: function () {
        return findDiscoveryCards(findDiscoverySection());
      },
    };
  }

  global.TasuOneTlvDataAdapter = {
    create: create,
    applyStreams: applyStreams,
    formatViewers: formatViewers,
  };

  function boot() {
    var adapter = create();
    adapter.loadDiscovery().then(function (state) {
      if (document.body) {
        document.body.setAttribute("data-discovery-source", state.source || "");
        document.body.setAttribute("data-discovery-count", String(state.count || 0));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
