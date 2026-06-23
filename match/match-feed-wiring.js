/**
 * TASFUL MATCH — swipe feed live wiring (live / edge_stub)
 */
(function () {
  "use strict";

  var queue = [];
  var queueTotal = 0;
  var loading = false;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function isEdgeMode() {
    var api = getApi();
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
  }

  function mapItemToSwipeProfile(item) {
    return {
      user_id: item.user_id,
      profile_id: item.profile_id,
      display_name: item.display_name || "マッチ相手",
      age: item.age,
      prefecture: item.prefecture || "",
      city: item.city,
      bio: item.bio,
      purpose: item.purpose,
      verification_status: item.verification_status || "none",
      main_photo_url: item.main_photo_url,
      hobby_tags: item.hobby_tags || [],
      activity_label: item.activity_label,
      completion_score: item.completion_score,
    };
  }

  function showCurrent() {
    var render = window.MatchDataRender;
    if (!render) return;

    if (!queue.length) {
      if (render.renderSwipeEmptyState) render.renderSwipeEmptyState();
      return;
    }

    if (render.hideSwipeEmptyState) render.hideSwipeEmptyState();
    var profile = mapItemToSwipeProfile(queue[0]);
    var index = Math.max(0, queueTotal - queue.length);
    render.renderSwipeProfile(profile, index, queueTotal || queue.length);

    var page = qs('[data-page="match-swipe"]');
    if (page && window.MatchP15Wiring?.refreshSwipeTarget) {
      window.MatchP15Wiring.refreshSwipeTarget(page, profile.user_id);
    }
  }

  function loadFeed(options) {
    options = options || {};
    var api = getApi();
    if (!api || typeof api.searchProfiles !== "function") return Promise.resolve(false);
    if (loading) return Promise.resolve(false);
    loading = true;

    return api
      .searchProfiles({
        filters_json: options.filters || {},
        sort: options.sort || "recommended",
        limit: options.limit || 20,
        cursor: options.cursor || null,
      })
      .then(function (result) {
        loading = false;
        if (window.MatchLoginGate?.handleApiResult?.(result)) return false;
        if (window.MatchBetaGate?.handleApiResult?.(result)) return false;
        if (!result || !result.ok) return false;
        var items = Array.isArray(result.items) ? result.items : [];
        if (!options.append) {
          queue = items.slice();
          queueTotal = typeof result.total === "number" ? result.total : items.length;
        } else {
          queue = queue.concat(items);
          if (typeof result.total === "number") queueTotal = result.total;
        }
        if (!options.silent) showCurrent();
        return true;
      })
      .catch(function () {
        loading = false;
        return false;
      });
  }

  function afterSwipe() {
    if (!isEdgeMode()) return;
    queue.shift();
    if (queue.length) {
      showCurrent();
      return;
    }
    loadFeed({ silent: false }).then(function (ok) {
      if (!ok || !queue.length) {
        window.MatchDataRender?.renderSwipeEmptyState?.();
      }
    });
  }

  function initSwipeFeedLive() {
    var page = qs('[data-page="match-swipe"]');
    if (!page || !isEdgeMode()) return;

    loadFeed().then(function (ok) {
      if (!ok) {
        window.MatchDataRender?.renderSwipeEmptyState?.(
          "候補を読み込めませんでした。しばらくしてから再度お試しください。",
        );
      }
    });
  }

  window.MatchFeedWiring = {
    loadFeed: loadFeed,
    afterSwipe: afterSwipe,
    showCurrent: showCurrent,
    getQueueLength: function () {
      return queue.length;
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSwipeFeedLive();
  });
})();
