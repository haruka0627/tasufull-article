/**
 * TASFUL MATCH — P15 UI render helpers (labels only · no raw timestamps)
 */
(function () {
  "use strict";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setActivityLabels(root, label) {
    var value = String(label || "しばらく未活動");
    (root || document).querySelectorAll("[data-match-activity-label]").forEach(function (el) {
      el.textContent = value;
    });
  }

  function setCompatScore(root, data) {
    var percent = typeof data?.percent === "number" ? data.percent : null;
    var common = Array.isArray(data?.common_points) ? data.common_points : [];
    var scoreEl = qs("[data-match-compat-score]", root);
    var commonEl = qs("[data-match-compat-common]", root);

    if (scoreEl) {
      if (percent === null) {
        scoreEl.hidden = true;
      } else {
        scoreEl.hidden = false;
        scoreEl.innerHTML =
          '相性 <span class="match-compat-chip__percent">' + percent + "</span>%";
        scoreEl.setAttribute("data-compat-percent", String(percent));
        scoreEl.setAttribute("data-compat-count", String(data?.common_count || common.length));
      }
    }

    if (commonEl) {
      if (!common.length) {
        commonEl.innerHTML = "";
        commonEl.hidden = true;
      } else {
        commonEl.hidden = false;
        var count = data?.common_count || common.length;
        commonEl.innerHTML =
          '<span class="match-compat-common__summary">💖 共通点' +
          count +
          "件</span>" +
          '<div class="match-compat-chips">' +
          common
            .slice(0, 4)
            .map(function (p) {
              var icon = p.icon || commonPointIcon(p.key);
              return (
                '<span class="match-compat-point-chip">' +
                escapeHtml(icon) +
                " " +
                escapeHtml(p.label) +
                "</span>"
              );
            })
            .join("") +
          "</div>";
      }
    }
  }

  function commonPointIcon(key) {
    if (key === "purpose") return "💘";
    if (key === "hobby") return "☕";
    if (key === "prefecture") return "📍";
    return "💖";
  }

  function renderCompletenessBar(root, data) {
    var bar = qs("[data-match-completeness-bar]", root);
    var text = qs("[data-match-completeness-text]", root);
    var list = qs("[data-match-completeness-items]", root);
    var percent = typeof data?.percent === "number" ? Math.max(0, Math.min(100, data.percent)) : 0;

    if (bar) {
      var fill = qs(".match-completeness-bar__fill", bar) || bar;
      fill.style.width = percent + "%";
      bar.setAttribute("aria-valuenow", String(percent));
    }
    if (text) text.textContent = "プロフィール完成度 " + percent + "%";

    if (list && Array.isArray(data?.items)) {
      list.innerHTML = data.items
        .map(function (item) {
          var done = item.done ? " is-done" : "";
          return (
            '<li class="match-completeness-item' + done + '">' +
            '<span class="match-completeness-item__mark" aria-hidden="true">' +
            (item.done ? "💖" : "🤍") +
            "</span>" +
            '<span class="match-completeness-item__label">' +
            escapeHtml(item.label) +
            "</span></li>"
          );
        })
        .join("");
    }
  }

  function renderFavoriteList(root, items) {
    var mount = qs("[data-match-favorite-list]", root);
    var empty = qs("[data-match-favorite-empty]", root);
    if (!mount) return;

    if (!items || !items.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    mount.innerHTML = items
      .map(function (item) {
        var profile = item.profile || {};
        var label = profile.activity_label || "しばらく未活動";
        return (
          '<article class="match-p15-list-item" data-favorite-id="' +
          escapeHtml(item.favorite_id) +
          '">' +
          '<span class="match-p15-list-item__avatar" aria-hidden="true">' +
          escapeHtml(profile.main_photo_url || "👤") +
          "</span>" +
          '<div class="match-p15-list-item__body">' +
          '<p class="match-p15-list-item__title">' +
          escapeHtml(profile.display_name || "ユーザー") +
          " " +
          escapeHtml(profile.age ? profile.age + "歳" : "") +
          "</p>" +
          '<p class="match-p15-list-item__meta">' +
          escapeHtml(profile.prefecture || "") +
          " · " +
          '<span class="match-activity-label">' +
          escapeHtml(label) +
          "</span></p></div>" +
          '<button type="button" class="match-btn match-btn--secondary match-btn--sm" data-match-favorite-toggle data-favorited="1" data-target-user-id="' +
          escapeHtml(item.target_user_id) +
          '">解除</button></article>'
        );
      })
      .join("");
  }

  function renderFootprintList(root, items) {
    var mount = qs("[data-match-footprint-list]", root);
    var empty = qs("[data-match-footprint-empty]", root);
    if (!mount) return;

    if (!items || !items.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    mount.innerHTML = items
      .map(function (item) {
        var profile = item.profile || {};
        var name = profile.display_name || "ユーザー";
        var fpLabel = item.footprint_label || "—";
        var actLabel = profile.activity_label || "";
        return (
          '<article class="match-p15-list-item">' +
          '<span class="match-p15-list-item__avatar" aria-hidden="true">' +
          escapeHtml(profile.main_photo_url || "👤") +
          "</span>" +
          '<div class="match-p15-list-item__body">' +
          '<p class="match-p15-list-item__title">' +
          escapeHtml(name) +
          "さんがプロフィールを見ました</p>" +
          '<p class="match-p15-list-item__meta">' +
          '<span class="match-footprint-label">' +
          escapeHtml(fpLabel) +
          "</span>" +
          (actLabel ? " · " + escapeHtml(actLabel) : "") +
          "</p></div></article>"
        );
      })
      .join("");
  }

  function renderSavedSearchList(root, items) {
    var mount = qs("[data-match-saved-search-list]", root);
    var empty = qs("[data-match-saved-search-empty]", root);
    if (!mount) return;

    if (!items || !items.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    mount.innerHTML = items
      .map(function (item) {
        var filters = item.filters_json || {};
        var chips = [];
        if (filters.age_min || filters.age_max) {
          chips.push((filters.age_min || "?") + "–" + (filters.age_max || "?") + "歳");
        }
        if (Array.isArray(filters.prefectures) && filters.prefectures.length) {
          chips.push(filters.prefectures.slice(0, 2).join("・"));
        }
        if (filters.verified_only) chips.push("本人確認済み");
        return (
          '<article class="match-p15-search-item" data-search-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="match-p15-search-item__body">' +
          '<p class="match-p15-search-item__title">' +
          escapeHtml(item.name) +
          (item.is_default ? ' <span class="match-status-badge match-status-badge--default">💖 デフォルト</span>' : "") +
          "</p>" +
          '<p class="match-p15-search-item__chips">' +
          (chips.length ? chips.map(function (c) { return '<span class="match-tag">' + escapeHtml(c) + "</span>"; }).join("") : '<span class="match-p15-search-item__empty-hint">まだ条件が設定されていません</span>') +
          "</p></div>" +
          '<div class="match-p15-search-item__actions">' +
          '<button type="button" class="match-btn match-btn--saved-search-apply" data-match-apply-search data-search-id="' +
          escapeHtml(item.id) +
          '">💖 この条件で探す</button>' +
          '<button type="button" class="match-btn match-btn--saved-search-delete" data-match-delete-search data-search-id="' +
          escapeHtml(item.id) +
          '">削除</button></div></article>'
        );
      })
      .join("");
  }

  function purposeLabel(key) {
    if (key === "love") return "恋愛";
    if (key === "marriage") return "婚活";
    if (key === "friends") return "友達から";
    return key;
  }

  function buildFilterChips(filters) {
    var chips = [];
    var f = filters || {};
    if (f.age_min || f.age_max) {
      chips.push((f.age_min || "?") + "–" + (f.age_max || "?") + "歳");
    }
    if (f.prefecture) chips.push(f.prefecture);
    if (Array.isArray(f.prefectures) && f.prefectures.length) {
      chips.push(f.prefectures.slice(0, 2).join("・"));
    }
    if (Array.isArray(f.purpose) && f.purpose.length) {
      chips.push(f.purpose.map(purposeLabel).join("・"));
    }
    if (f.verified_only) chips.push("本人確認済み");
    if (f.online_only) chips.push("オンライン中");
    return chips;
  }

  function renderSearchFilterChips(root, filters) {
    var mount = qs("[data-match-search-chips]", root);
    if (!mount) return;
    var chips = buildFilterChips(filters);
    if (!chips.length) {
      mount.innerHTML = '<span class="match-tag match-tag--lavender">すべて</span>';
      return;
    }
    mount.innerHTML = chips
      .map(function (chip) {
        return '<span class="match-tag">' + escapeHtml(chip) + "</span>";
      })
      .join("");
  }

  function renderSearchResultsList(root, items, total) {
    var mount = qs("[data-match-search-results-list]", root);
    var empty = qs("[data-match-search-empty]", root);
    var countEl = qs("[data-match-search-count]", root);
    var count = typeof total === "number" ? total : items ? items.length : 0;

    if (countEl) {
      countEl.textContent = count + "人見つかりました";
    }

    if (!mount) return;

    if (!items || !items.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    mount.innerHTML = items
      .map(function (profile) {
        var verified =
          profile.verification_status === "verified"
            ? '<span class="match-status-badge match-status-badge--mint">本人確認済み</span>'
            : "";
        var region = profile.prefecture || "";
        var oneLine = profile.one_line || profile.bio || "";
        var compat =
          typeof profile.compat_percent === "number"
            ? '<span class="match-search-result-card__compat">相性 ' + profile.compat_percent + "%</span>"
            : "";
        return (
          '<article class="match-search-result-card" data-user-id="' +
          escapeHtml(profile.user_id) +
          '">' +
          '<div class="match-search-result-card__top">' +
          '<span class="match-search-result-card__avatar" aria-hidden="true">' +
          escapeHtml(profile.main_photo_url || "👤") +
          "</span>" +
          '<div class="match-search-result-card__head">' +
          '<p class="match-search-result-card__name">' +
          escapeHtml(profile.display_name || "ユーザー") +
          " <span>" +
          escapeHtml(profile.age ? profile.age + "歳" : "") +
          "</span></p>" +
          '<p class="match-search-result-card__meta">' +
          escapeHtml(region) +
          verified +
          "</p>" +
          compat +
          "</div></div>" +
          '<p class="match-search-result-card__bio">' +
          escapeHtml(oneLine) +
          "</p>" +
          '<div class="match-search-result-card__actions">' +
          '<a class="match-btn match-btn--secondary match-btn--sm" href="match-swipe.html?user_id=' +
          encodeURIComponent(profile.user_id) +
          '">見る</a>' +
          '<a class="match-btn match-btn--primary match-btn--sm" href="match-swipe.html?user_id=' +
          encodeURIComponent(profile.user_id) +
          '">スワイプで見る</a>' +
          "</div></article>"
        );
      })
      .join("");
  }

  window.MatchP15Render = {
    setActivityLabels: setActivityLabels,
    setCompatScore: setCompatScore,
    renderCompletenessBar: renderCompletenessBar,
    renderFavoriteList: renderFavoriteList,
    renderFootprintList: renderFootprintList,
    renderSavedSearchList: renderSavedSearchList,
    renderSearchFilterChips: renderSearchFilterChips,
    renderSearchResultsList: renderSearchResultsList,
    buildFilterChips: buildFilterChips,
    escapeHtml: escapeHtml,
  };
})();
