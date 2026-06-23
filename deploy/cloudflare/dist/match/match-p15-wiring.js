/**
 * TASFUL MATCH — P15 UI wiring (separate from L9 match-wiring.js)
 */
(function () {
  "use strict";

  var activityBumped = false;
  var SEARCH_FILTERS_KEY = "match_search_filters";
  var SEARCH_SORT_KEY = "match_search_sort";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function getRender() {
    return window.MatchP15Render || null;
  }

  function showToast(message) {
    if (window.MatchWiring?.showToast) {
      window.MatchWiring.showToast(message);
      return;
    }
    var toast = qs("[data-match-toast]");
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function apiErrorMessage(result, fallback) {
    if (window.MatchWiring?.apiErrorMessage) {
      return window.MatchWiring.apiErrorMessage(result, fallback);
    }
    if (!result || result.ok) return fallback || "処理に失敗しました";
    return result.message || fallback || "処理に失敗しました";
  }

  function callApi(method, payload) {
    var api = getApi();
    if (!api || typeof api[method] !== "function") {
      return Promise.resolve(null);
    }
    return api[method](payload).then(function (result) {
      console.debug("[MatchP15Wiring]", method, result);
      return result;
    }).catch(function (err) {
      console.debug("[MatchP15Wiring]", method, "error", err);
      return { ok: false, code: "internal_error", message: String(err) };
    });
  }

  function isLoggedIn() {
    return window.TasfulMatchAuth?.isLoggedIn?.() !== false;
  }

  function getTargetUserId(root) {
    if (window.MatchWiring?.getTargetUserId) {
      return window.MatchWiring.getTargetUserId(root);
    }
    if (window.MatchDataRender?.getActiveSwipeUserId) {
      var active = window.MatchDataRender.getActiveSwipeUserId();
      if (active) return active;
    }
    var el = qs("[data-match-target-user-id]", root);
    if (el) return el.getAttribute("data-match-target-user-id") || "";
    return window.TasfulMatchDataStub?.getDefaultTargetUserId?.() || "stub-user-unknown";
  }

  function tryConfigureEdgeStub() {
    if (window.MatchBootstrap?.shouldUseLiveApi?.()) {
      window.MatchBootstrap.configureLiveApi();
      return;
    }

    var api = getApi();
    if (!api) return;

    var params = new URLSearchParams(window.location.search);
    if (params.get("edge_stub") === "1" || params.get("live") === "1") {
      var base = params.get("functions_base") || window.__MATCH_FUNCTIONS_BASE__;
      if (base) {
        api.configure({ mode: "live", functionsBaseUrl: String(base).replace(/\/+$/, "") });
      }
    }
  }

  function bumpActivityOnce() {
    if (activityBumped) return;
    activityBumped = true;
    callApi("updateActivity", {}).then(function (result) {
      if (result?.ok && result.activity_label) {
        getRender()?.setActivityLabels(document, result.activity_label);
      }
    });
  }

  function isEdgeMode() {
    var api = getApi();
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
  }

  function isLiveTargetId(targetUserId) {
    var id = String(targetUserId || "");
    return id.length > 0 && id.indexOf("stub-") !== 0;
  }

  function refreshSwipeP15Target(page, targetUserId) {
    if (!page || !isLiveTargetId(targetUserId)) return;
    loadCompatibility(page, targetUserId);
    recordViewForTarget(targetUserId, "swipe_card");
  }

  function loadCompleteness(root) {
    return callApi("getProfileCompleteness", {}).then(function (result) {
      if (!result?.ok) return;
      getRender()?.renderCompletenessBar(root, result);
      window.MatchAiCta?.resolveCtaLinks(root);
      return result;
    });
  }

  function loadCompatibility(root, targetUserId) {
    if (!targetUserId) return Promise.resolve();
    return callApi("getCompatibility", { target_user_id: targetUserId }).then(function (result) {
      if (!result?.ok) {
        getRender()?.setCompatScore(root, null);
        return;
      }
      getRender()?.setCompatScore(root, result);
      window.MatchAiCta?.resolveCtaLinks(root);
    });
  }

  function recordViewForTarget(targetUserId, source) {
    if (!targetUserId) return;
    callApi("recordProfileView", {
      viewed_user_id: targetUserId,
      source: source || "swipe_card",
    });
  }

  function readStoredFilters() {
    try {
      var raw = sessionStorage.getItem(SEARCH_FILTERS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storeFilters(filters) {
    sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(filters || {}));
  }

  function readStoredSort() {
    return sessionStorage.getItem(SEARCH_SORT_KEY) || "recommended";
  }

  function storeSort(sort) {
    sessionStorage.setItem(SEARCH_SORT_KEY, sort || "recommended");
  }

  function readSearchFormFilters(page) {
    var form = qs("[data-match-search-form]", page);
    if (!form) return {};

    var ageMin = qs("[data-match-search-age-min]", form);
    var ageMax = qs("[data-match-search-age-max]", form);
    var prefecture = qs("[data-match-search-prefecture]", form);
    var verified = qs("[data-match-search-verified]", form);
    var online = qs("[data-match-search-online]", form);
    var purpose = [];

    qsa("[data-match-search-purpose] .match-chip.is-selected", form).forEach(function (chip) {
      var value = chip.getAttribute("data-purpose");
      if (value) purpose.push(value);
    });

    return {
      age_min: ageMin && ageMin.value ? Number(ageMin.value) : null,
      age_max: ageMax && ageMax.value ? Number(ageMax.value) : null,
      prefecture: prefecture ? prefecture.value : "",
      purpose: purpose,
      verified_only: Boolean(verified && verified.checked),
      online_only: Boolean(online && online.checked),
    };
  }

  function applyFiltersToSearchForm(page, filters) {
    if (!filters) return;
    var form = qs("[data-match-search-form]", page);
    if (!form) return;

    var ageMin = qs("[data-match-search-age-min]", form);
    var ageMax = qs("[data-match-search-age-max]", form);
    var prefecture = qs("[data-match-search-prefecture]", form);
    var verified = qs("[data-match-search-verified]", form);
    var online = qs("[data-match-search-online]", form);

    if (ageMin) ageMin.value = filters.age_min != null ? String(filters.age_min) : "";
    if (ageMax) ageMax.value = filters.age_max != null ? String(filters.age_max) : "";
    if (prefecture) {
      if (filters.prefecture) {
        prefecture.value = filters.prefecture;
      } else if (Array.isArray(filters.prefectures) && filters.prefectures.length) {
        prefecture.value = filters.prefectures[0];
      } else {
        prefecture.value = "";
      }
    }
    if (verified) verified.checked = Boolean(filters.verified_only);
    if (online) online.checked = Boolean(filters.online_only);

    var selected = Array.isArray(filters.purpose) ? filters.purpose : [];
    qsa("[data-match-search-purpose] .match-chip", form).forEach(function (chip) {
      var value = chip.getAttribute("data-purpose");
      chip.classList.toggle("is-selected", selected.indexOf(value) >= 0);
    });
  }

  function populateAgeSelects(page) {
    var minSel = qs("[data-match-search-age-min]", page);
    var maxSel = qs("[data-match-search-age-max]", page);
    if (!minSel || !maxSel) return;

    for (var age = 18; age <= 60; age += 1) {
      var optMin = document.createElement("option");
      optMin.value = String(age);
      optMin.textContent = age + "歳";
      minSel.appendChild(optMin);

      var optMax = document.createElement("option");
      optMax.value = String(age);
      optMax.textContent = age + "歳";
      maxSel.appendChild(optMax);
    }
  }

  function navigateToSearchResults(searchId) {
    var href = "match-search-results.html";
    if (searchId) href += "?search_id=" + encodeURIComponent(searchId);
    window.location.href = href;
  }

  function loadSearchResults(page, filters, sort) {
    return callApi("searchProfiles", {
      filters_json: filters || {},
      sort: sort || "recommended",
    }).then(function (result) {
      if (!result?.ok) {
        showToast(apiErrorMessage(result, "検索結果を読み込めませんでした"));
        return;
      }
      getRender()?.renderSearchFilterChips(page, filters);
      getRender()?.renderSearchResultsList(page, result.items || [], result.total);
    });
  }

  function resolveResultsFilters(page) {
    var params = new URLSearchParams(window.location.search);
    var searchId = params.get("search_id");
    var stored = readStoredFilters();

    if (stored) return Promise.resolve(stored);

    if (!searchId) return Promise.resolve({});

    return callApi("listSavedSearches", {}).then(function (result) {
      if (!result?.ok) return {};
      var item = (result.items || []).find(function (row) {
        return row.id === searchId;
      });
      var filters = item?.filters_json || {};
      storeFilters(filters);
      return filters;
    });
  }

  function initSearchPage() {
    var page = qs('[data-page="match-search"]');
    if (!page) return;

    populateAgeSelects(page);
    applyFiltersToSearchForm(page, readStoredFilters());

    qsa("[data-match-search-purpose] .match-chip", page).forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-selected");
      });
    });

    qs("[data-match-search-form]", page)?.addEventListener("submit", function (e) {
      e.preventDefault();
      var filters = readSearchFormFilters(page);
      storeFilters(filters);
      navigateToSearchResults();
    });

    qs("[data-match-search-save]", page)?.addEventListener("click", function () {
      var filters = readSearchFormFilters(page);
      var region = filters.prefecture || "全国";
      var name = region + "の条件";
      callApi("saveSearch", {
        name: name,
        filters_json: filters,
        is_default: false,
      }).then(function (result) {
        if (!result?.ok) {
          showToast(apiErrorMessage(result));
          return;
        }
        storeFilters(filters);
        showToast("検索条件を保存しました");
      });
    });
  }

  function initSearchResultsPage() {
    var page = qs('[data-page="match-search-results"]');
    if (!page) return;

    var sortSelect = qs("[data-match-search-sort]", page);
    var sort = readStoredSort();
    if (sortSelect) sortSelect.value = sort;

    function refresh() {
      resolveResultsFilters(page).then(function (filters) {
        var currentSort = sortSelect ? sortSelect.value : readStoredSort();
        storeSort(currentSort);
        loadSearchResults(page, filters, currentSort);
      });
    }

    sortSelect?.addEventListener("change", function () {
      storeSort(sortSelect.value);
      refresh();
    });

    refresh();
  }

  function initSwipeP15() {
    var page = qs('[data-page="match-swipe"]');
    if (!page) return;

    if (!isEdgeMode()) {
      var targetId = getTargetUserId(page);
      loadCompatibility(page, targetId);
      recordViewForTarget(targetId, "swipe_card");
    }

    qsa("[data-match-favorite-toggle]", page).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!isLoggedIn()) {
          showToast("ログインが必要です");
          return;
        }
        var tid = btn.getAttribute("data-target-user-id") || getTargetUserId(page);
        var favorited = btn.getAttribute("data-favorited") === "1";
        var method = favorited ? "unfavoriteUser" : "favoriteUser";
        var payload = favorited ? { target_user_id: tid } : { target_user_id: tid, source: "swipe" };
        callApi(method, payload).then(function (result) {
          if (!result?.ok) {
            showToast(apiErrorMessage(result));
            return;
          }
          var nowFav = !favorited;
          btn.setAttribute("data-favorited", nowFav ? "1" : "0");
          var favLabel = btn.querySelector(".match-btn__label");
          if (favLabel) favLabel.textContent = nowFav ? "保存済み" : "お気に入り";
          showToast(nowFav ? "お気に入りに追加しました" : "お気に入りを解除しました");
          if (nowFav) bumpActivityOnce();
        });
      });
    });

    qs("[data-match-open-saved-search]", page)?.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.href = "match-search-saved.html";
    });

    qs("[data-match-open-search]", page)?.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.href = "match-search.html";
    });
  }

  function initMypageP15() {
    var page = qs('[data-page="match-mypage"]');
    if (!page) return;

    bumpActivityOnce();
    loadCompleteness(page);
  }

  function initProfileCreateP15() {
    var page = qs('[data-page="match-profile-create"]');
    if (!page) return;

    loadCompleteness(page);

    qs("[data-match-step-next]", page)?.addEventListener("click", function () {
      var dots = qsa("[data-step-dot]", page);
      var activeIdx = dots.findIndex(function (d) { return d.classList.contains("is-active"); });
      if (activeIdx >= dots.length - 1) bumpActivityOnce();
    });
  }

  function initListP15() {
    var page = qs('[data-page="match-list"]');
    if (!page) return;

    qsa("[data-match-pair-list] .match-list-item, [data-match-new-pair]", page).forEach(function (row) {
      var stub = window.TasfulMatchDataStub;
      if (!stub) return;
    });
  }

  function initTalkBridgeP15() {
    if (!qs('[data-page="match-talk-bridge"]')) return;
    bumpActivityOnce();
  }

  function initFavoritesPage() {
    var page = qs('[data-page="match-favorites"]');
    if (!page) return;

    callApi("listFavorites", { limit: 20 }).then(function (result) {
      if (!result?.ok) {
        showToast(apiErrorMessage(result, "お気に入りを読み込めませんでした"));
        return;
      }
      getRender()?.renderFavoriteList(page, result.items || []);
      initFavoriteToggleHandlers(page);
    });
  }

  function initFavoriteToggleHandlers(root) {
    qsa("[data-match-favorite-toggle]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tid = btn.getAttribute("data-target-user-id");
        callApi("unfavoriteUser", { target_user_id: tid }).then(function (result) {
          if (!result?.ok) {
            showToast(apiErrorMessage(result));
            return;
          }
          showToast("お気に入りを解除しました");
          initFavoritesPage();
        });
      });
    });
  }

  function initFootprintsPage() {
    var page = qs('[data-page="match-footprints"]');
    if (!page) return;

    callApi("listProfileViews", { limit: 20 }).then(function (result) {
      if (!result?.ok) {
        showToast(apiErrorMessage(result, "足あとを読み込めませんでした"));
        return;
      }
      getRender()?.renderFootprintList(page, result.items || []);
    });
  }

  function initSavedSearchPage() {
    var page = qs('[data-page="match-search-saved"]');
    if (!page) return;

    function refresh() {
      callApi("listSavedSearches", {}).then(function (result) {
        if (!result?.ok) {
          showToast(apiErrorMessage(result, "検索条件を読み込めませんでした"));
          return;
        }
        getRender()?.renderSavedSearchList(page, result.items || []);
        bindSavedSearchActions(page);
      });
    }

    function bindSavedSearchActions(root) {
      qsa("[data-match-delete-search]", root).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-search-id");
          callApi("deleteSavedSearch", { id: id }).then(function (result) {
            if (!result?.ok) {
              showToast(apiErrorMessage(result));
              return;
            }
            showToast("検索条件を削除しました");
            refresh();
          });
        });
      });
      qsa("[data-match-apply-search]", root).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var searchId = btn.getAttribute("data-search-id");
          callApi("listSavedSearches", {}).then(function (result) {
            if (!result?.ok) {
              showToast(apiErrorMessage(result, "検索条件を読み込めませんでした"));
              return;
            }
            var item = (result.items || []).find(function (row) {
              return row.id === searchId;
            });
            if (!item) {
              showToast("検索条件が見つかりませんでした");
              return;
            }
            storeFilters(item.filters_json || {});
            showToast("この条件で探します");
            window.setTimeout(function () {
              navigateToSearchResults(searchId);
            }, 300);
          });
        });
      });
    }

    qs("[data-match-saved-search-save]", page)?.addEventListener("click", function () {
      var nameInput = qs("[data-match-saved-search-name]", page);
      var name = nameInput ? nameInput.value.trim() : "前回の条件";
      if (!name) {
        showToast("名前を入力してください");
        return;
      }
      callApi("saveSearch", {
        name: name,
        filters_json: { age_min: 25, age_max: 35, verified_only: true },
        is_default: false,
      }).then(function (result) {
        if (!result?.ok) {
          showToast(apiErrorMessage(result));
          return;
        }
        showToast("検索条件を保存しました");
        if (nameInput) nameInput.value = "";
        refresh();
      });
    });

    refresh();
  }

  function hookSwipeActivityBump() {
    var page = qs('[data-page="match-swipe"]');
    if (!page) return;

    qsa('[data-match-swipe-action="skip"], [data-match-swipe-action="like"]', page).forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.setTimeout(function () {
          callApi("updateActivity", {});
          var nextId = getTargetUserId(page);
          loadCompatibility(page, nextId);
          recordViewForTarget(nextId, "swipe_card");
        }, 350);
      });
    });
  }

  window.MatchP15Wiring = {
    callApi: callApi,
    showToast: showToast,
    bumpActivityOnce: bumpActivityOnce,
    refreshFavorites: initFavoritesPage,
    refreshSwipeTarget: refreshSwipeP15Target,
  };

  document.addEventListener("DOMContentLoaded", function () {
    tryConfigureEdgeStub();
    initSwipeP15();
    initMypageP15();
    initProfileCreateP15();
    initListP15();
    initTalkBridgeP15();
    initFavoritesPage();
    initFootprintsPage();
    initSavedSearchPage();
    initSearchPage();
    initSearchResultsPage();
    hookSwipeActivityBump();
    window.MatchAiCta?.resolveCtaLinks(document);
  });
})();
