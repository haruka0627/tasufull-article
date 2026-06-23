/**
 * TASFUL MATCH — render UI from TasfulMatchDataStub (no fetch)
 */
(function () {
  "use strict";

  var swipeIndex = 0;

  var REPORT_REASON_LABELS = {
    inappropriate_message: "不適切なメッセージ",
    impersonation: "なりすまし",
    harassment: "迷惑行為",
    other: "その他",
  };

  var REPORT_STATUS_LABELS = {
    in_review: "対応中",
    resolved: "完了",
    submitted: "受付済み",
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function getStub() {
    return window.TasfulMatchDataStub || null;
  }

  function getProfiles() {
    var stub = getStub();
    if (stub) return stub.getSwipeProfiles();
    return [];
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, "/");
    return (
      d.getFullYear() +
      "/" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function formatRelativeTime(iso) {
    if (!iso) return "";
    var diff = Date.now() - new Date(iso).getTime();
    var hours = Math.floor(diff / 3600000);
    if (hours < 1) return "たった今";
    if (hours < 24) return hours + "時間前";
    if (hours < 48) return "昨日";
    return formatDate(iso);
  }

  function verificationLabel(status) {
    if (status === "verified") return "本人確認済み";
    if (status === "pending") return "本人確認審査中";
    return "本人確認未完了";
  }

  function isPhotoRegistered(url) {
    if (!url || typeof url !== "string") return false;
    var trimmed = url.trim();
    if (!trimmed) return false;
    return (
      /^(https?:\/\/|\/|images\/)/.test(trimmed) ||
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(trimmed)
    );
  }

  function renderSwipePhoto(photoEl, profile) {
    if (!photoEl || !profile) return;

    var badge = qs(".match-profile-card__photo-badge", photoEl);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "match-profile-card__photo-badge";
      photoEl.appendChild(badge);
    }

    Array.from(photoEl.childNodes).forEach(function (node) {
      if (node !== badge) photoEl.removeChild(node);
    });

    if (isPhotoRegistered(profile.main_photo_url)) {
      photoEl.classList.remove("match-profile-card__photo--empty");
      var img = document.createElement("img");
      img.className = "match-profile-card__photo-img";
      img.src = profile.main_photo_url;
      img.alt = "";
      img.decoding = "async";
      photoEl.appendChild(img);
      return;
    }

    photoEl.classList.add("match-profile-card__photo--empty");
    var placeholder = document.createElement("div");
    placeholder.className = "match-profile-card__photo-placeholder";
    placeholder.innerHTML =
      '<span class="match-profile-card__photo-placeholder-icon" aria-hidden="true">🌸</span>' +
      '<span class="match-profile-card__photo-placeholder-text">写真を登録すると<br />マッチしやすくなります</span>';
    photoEl.appendChild(placeholder);
  }

  function renderSwipeProfile(profile, index, total) {
    var card = qs("[data-match-profile-card]");
    if (!card || !profile) return;

    card.setAttribute("data-match-target-user-id", profile.user_id);

    var photo = qs(".match-profile-card__photo", card);
    if (photo) {
      var badge = qs(".match-profile-card__photo-badge", photo);
      if (badge) badge.textContent = index + 1 + " / " + total;
      renderSwipePhoto(photo, profile);
    }

    var name = qs(".match-profile-card__name", card);
    if (name) name.innerHTML = profile.display_name + " <span>" + profile.age + "歳</span>";

    var meta = qs(".match-profile-card__meta", card);
    if (meta) {
      var activityLabel = profile.activity_label || "しばらく未活動";
      meta.innerHTML =
        '<span class="match-activity-label" data-match-activity-label>' +
        activityLabel +
        "</span> · " +
        profile.prefecture +
        " · " +
        verificationLabel(profile.verification_status);
    }

    var tags = qs(".match-profile-card__tags", card);
    if (tags) {
      tags.innerHTML = (profile.hobby_tags || [])
        .map(function (tag, i) {
          var cls = i === 1 ? "match-tag match-tag--lavender" : "match-tag";
          return '<span class="' + cls + '">' + tag + "</span>";
        })
        .join("");
    }

    var bio = qs(".match-profile-card__bio", card);
    if (bio) bio.textContent = profile.bio || "";

    var metaBar = qs(".match-swipe-meta");
    if (metaBar) {
      var spans = metaBar.querySelectorAll("span");
      if (spans[1]) spans[1].textContent = index + 1 + " / " + total;
    }

    var favoriteBtn = qs("[data-match-favorite-toggle]", document);
    if (favoriteBtn) {
      favoriteBtn.setAttribute("data-target-user-id", profile.user_id);
      favoriteBtn.setAttribute("data-favorited", "0");
      var favLabel = qs(".match-btn__label", favoriteBtn);
      if (favLabel) favLabel.textContent = "お気に入り";
    }

    var blockModal = qs("[data-match-block-modal] p");
    if (blockModal) {
      blockModal.textContent =
        profile.display_name +
        "さんをブロックすると、お互いに表示されなくなります。";
    }
  }

  function renderSwipeEmptyState(message) {
    var stage = qs(".match-swipe-stage");
    var card = qs("[data-match-profile-card]");
    var actions = qs(".match-swipe-actions");
    var p15 = qs("[data-match-p15-section]");
    var meta = qs(".match-swipe-meta");
    var aiCta = stage ? qs(".match-ai-cta--profile", stage) : null;

    if (card) card.hidden = true;
    if (actions) actions.hidden = true;
    if (p15) p15.hidden = true;
    if (meta) meta.hidden = true;
    if (aiCta) aiCta.hidden = true;

    var empty = qs("[data-match-swipe-empty]");
    if (!empty && stage) {
      empty = document.createElement("div");
      empty.className = "match-empty-state";
      empty.setAttribute("data-match-swipe-empty", "");
      stage.appendChild(empty);
    }
    if (empty) {
      empty.hidden = false;
      empty.innerHTML =
        "<p>" +
        (message ||
          "本日のおすすめは以上です。新しいメンバーが増えるまでまたチェックしてみましょう。") +
        "</p>";
    }
  }

  function hideSwipeEmptyState() {
    var empty = qs("[data-match-swipe-empty]");
    var card = qs("[data-match-profile-card]");
    var actions = qs(".match-swipe-actions");
    var p15 = qs("[data-match-p15-section]");
    var meta = qs(".match-swipe-meta");
    var stage = qs(".match-swipe-stage");
    var aiCta = stage ? qs(".match-ai-cta--profile", stage) : null;

    if (empty) empty.hidden = true;
    if (card) card.hidden = false;
    if (actions) actions.hidden = false;
    if (p15) p15.hidden = false;
    if (meta) meta.hidden = false;
    if (aiCta) aiCta.hidden = false;
  }

  function initSwipePage() {
    if (!qs('[data-page="match-swipe"]')) return;
    var api = window.TasfulMatchAPI;
    if (api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub")) return;
    var profiles = getProfiles();
    if (!profiles.length) return;

    var params = new URLSearchParams(window.location.search);
    var userId = params.get("user_id");
    swipeIndex = 0;

    if (userId) {
      var profile = getStub()?.getProfileById(userId);
      if (profile) {
        renderSwipeProfile(profile, 0, 1);
        return;
      }
    }

    renderSwipeProfile(profiles[swipeIndex], swipeIndex, profiles.length);
  }

  function advanceSwipeProfile() {
    var profiles = getProfiles();
    if (!profiles.length) return;
    swipeIndex = (swipeIndex + 1) % profiles.length;
    renderSwipeProfile(profiles[swipeIndex], swipeIndex, profiles.length);
  }

  function getActiveSwipeUserId() {
    var card = qs("[data-match-target-user-id]");
    if (card) return card.getAttribute("data-match-target-user-id") || "";
    var stub = getStub();
    return stub ? stub.getDefaultTargetUserId() : "stub-user-unknown";
  }

  function renderPairListItem(pair) {
    var unreadClass = pair.unread_count > 0 ? " match-list-item__preview--unread" : "";
    var preview = pair.last_message || "まだメッセージはありません";
    var location = pair.partner_display_name;
    var profile = getStub()?.getProfileById(pair.partner_user_id);
    var ageSuffix = profile ? " " + profile.age + "歳" : "";
    var area = profile ? " · " + profile.prefecture.replace(/[都道府県]$/, "") : "";

    var item = document.createElement("a");
    item.className = "match-list-item";
    item.href = "match-talk-bridge.html?pair_id=" + encodeURIComponent(pair.pair_id);
    item.setAttribute("data-match-pair-id", pair.pair_id);
    item.innerHTML =
      '<span class="match-list-item__avatar" aria-hidden="true">' +
      (pair.partner_photo_url || "👤") +
      (pair.unread_count > 0
        ? '<span class="match-list-item__badge">' + pair.unread_count + "</span>"
        : "") +
      "</span>" +
      '<span class="match-list-item__body">' +
      '<span class="match-list-item__top">' +
      '<span class="match-list-item__name">' +
      location +
      ageSuffix +
      area +
      "</span>" +
      '<span class="match-list-item__time">' +
      formatRelativeTime(pair.updated_at) +
      "</span>" +
      "</span>" +
      '<span class="match-list-item__preview' +
      unreadClass +
      '">' +
      preview +
      "</span>" +
      "</span>";
    return item;
  }

  function isEdgeListMode() {
    var api = window.TasfulMatchAPI;
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
  }

  function renderPairListRow(pair) {
    var item = renderPairListItem(pair);
    if (!isEdgeListMode()) return item;

    var row = document.createElement("div");
    row.className = "match-list-row";
    row.setAttribute("data-match-pair-row", "");
    row.setAttribute("data-match-pair-id", pair.pair_id);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "match-list-row__unmatch";
    btn.setAttribute("data-match-unmatch", "");
    btn.setAttribute("data-match-pair-id", pair.pair_id);
    btn.setAttribute("aria-label", pair.partner_display_name + "とのマッチを解除");
    btn.textContent = "解除";
    row.appendChild(item);
    row.appendChild(btn);
    return row;
  }

  function initListPage() {
    var page = qs('[data-page="match-list"]');
    if (!page) return;

    var api = window.TasfulMatchAPI;
    if (api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub")) return;

    var stub = getStub();
    var pairs = stub ? stub.getPairs() : [];
    renderPairListPage(page, pairs);
  }

  function renderPairListPage(page, pairs) {
    if (!page || !pairs) return;

    var listRoot = qs("[data-match-pair-list]", page);
    var newRoot = qs("[data-match-new-pair]", page);

    if (listRoot) {
      listRoot.innerHTML = "";
      pairs
        .filter(function (p) {
          return p.status !== "new";
        })
        .forEach(function (pair) {
          listRoot.appendChild(renderPairListRow(pair));
        });
    }

    if (newRoot) {
      var newest = pairs.find(function (p) {
        return p.status === "new";
      });
      if (newest) {
        var profile = getStub()?.getProfileById(newest.partner_user_id);
        newRoot.innerHTML =
          '<div class="match-new-match-card__row">' +
          '<span class="match-list-item__avatar" style="width:48px;height:48px;font-size:22px" aria-hidden="true">' +
          (newest.partner_photo_url || "👤") +
          "</span>" +
          '<div style="flex:1;min-width:0">' +
          '<p class="match-list-item__name" style="margin:0">' +
          newest.partner_display_name +
          (profile ? " " + profile.age + "歳 · " + profile.prefecture.replace(/[都道府県]$/, "") : "") +
          "</p>" +
          '<p class="match-list-item__preview">まだメッセージはありません</p>' +
          "</div>" +
          "</div>" +
          '<a class="match-btn match-btn--primary match-btn--block" style="margin-top:14px" href="match-talk-bridge.html?pair_id=' +
          encodeURIComponent(newest.pair_id) +
          '" data-match-talk-cta data-match-pair-id="' +
          newest.pair_id +
          '">メッセージする</a>' +
          (isEdgeListMode()
            ? '<button type="button" class="match-btn match-btn--text match-btn--block match-new-match-card__unmatch" data-match-unmatch data-match-pair-id="' +
              newest.pair_id +
              '">マッチ解除</button>'
            : "");
      } else {
        newRoot.innerHTML = "";
      }
    }

    var badge = qs(".match-tabbar__badge", page);
    if (badge && pairs.length) {
      var unreadTotal = pairs.reduce(function (sum, p) {
        return sum + (p.unread_count || 0);
      }, 0);
      if (unreadTotal > 0) {
        badge.textContent = String(unreadTotal);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
  }

  function initTalkBridgePage() {
    var page = qs('[data-page="match-talk-bridge"]');
    if (!page) return;

    var stub = getStub();
    var params = new URLSearchParams(window.location.search);
    var pairId = params.get("pair_id") || (stub ? stub.getDefaultPairId() : "");
    var pair = stub ? stub.getPairById(pairId) : null;

    if (pairId) {
      page.setAttribute("data-match-pair-id", pairId);
      document.body.setAttribute("data-match-pair-id", pairId);
    }

    if (!pair) return;

    var desc = qs(".match-bridge__desc", page);
    if (desc) {
      desc.innerHTML =
        pair.partner_display_name +
        "さんとのメッセージは <strong>TASFUL TALK</strong> で行います。既存の安心基盤（AI監視・通報）がそのまま使えます。";
    }

    var illus = qs(".match-bridge__illus", page);
    if (illus) illus.textContent = pair.partner_photo_url || "💬";
  }

  function initReportPage() {
    var root = qs("[data-match-report-form]");
    if (!root) return;

    var params = new URLSearchParams(window.location.search);
    var stub = getStub();
    var targetId =
      params.get("user_id") ||
      (window.MatchDataRender?.getActiveSwipeUserId?.() || "") ||
      (stub ? stub.getDefaultTargetUserId() : "stub-user-yui");
    var profile = stub ? stub.getProfileById(targetId) : null;

    var target = qs(".match-report-target", root);
    if (target) {
      target.setAttribute("data-match-target-user-id", targetId);
      var avatar = qs(".match-report-target__avatar", target);
      var name = qs(".match-report-target__name", target);
      if (avatar) {
        if (profile && isPhotoRegistered(profile.main_photo_url)) {
          avatar.innerHTML = "";
          var img = document.createElement("img");
          img.src = profile.main_photo_url;
          img.alt = "";
          img.decoding = "async";
          avatar.appendChild(img);
        } else {
          avatar.textContent = profile?.main_photo_url || "👤";
        }
      }
      if (name) {
        name.textContent = profile
          ? profile.display_name + " " + profile.age + "歳"
          : "通報対象ユーザー (" + targetId + ")";
      }
    }

    var history = qs("[data-report-history]", root);
    if (!history || !stub) return;

    history.innerHTML = stub.getReports().map(function (report) {
      var title = REPORT_REASON_LABELS[report.reason] || report.reason;
      var status =
        REPORT_STATUS_LABELS[report.status] ||
        (report.status === "resolved" ? "完了" : "対応中");
      var statusStyle =
        report.status === "resolved"
          ? ' style="background:var(--match-mint);color:#2d7a5e"'
          : "";
      return (
        '<article class="match-history-item">' +
        '<div class="match-history-item__top">' +
        '<span class="match-history-item__title">' +
        title +
        "</span>" +
        '<span class="match-history-item__date">' +
        formatDate(report.created_at) +
        "</span>" +
        "</div>" +
        "<p class=\"match-history-item__meta\">対象：" +
        report.reported_display_name +
        (report.detail ? " · " + report.detail : "") +
        "</p>" +
        '<span class="match-history-item__status"' +
        statusStyle +
        ">" +
        status +
        "</span>" +
        "</article>"
      );
    }).join("");
  }

  function initBlockPage() {
    var list = qs("[data-match-block-list]");
    if (!list) return;

    var stub = getStub();
    if (!stub) return;

    list.innerHTML = stub.getBlockedUsers().map(function (user) {
      return (
        '<article class="match-block-item" data-block-user data-blocked-user-id="' +
        user.blocked_user_id +
        '">' +
        '<span class="match-block-item__avatar" aria-hidden="true">' +
        (user.photo_url || "👤") +
        "</span>" +
        '<div class="match-block-item__body">' +
        '<p class="match-block-item__name">' +
        user.display_name +
        "</p>" +
        '<p class="match-block-item__meta">' +
        formatDate(user.created_at) +
        " にブロック</p>" +
        "</div>" +
        '<button type="button" class="match-block-item__unblock" data-block-unblock>解除</button>' +
        "</article>"
      );
    }).join("");
  }

  function initVerifyPage() {
    var root = qs("[data-match-verify-flow]");
    if (!root) return;

    var api = window.TasfulMatchAPI;
    if (api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub")) return;

    var stub = getStub();
    if (!stub) return;

    var user = stub.getCurrentUser();
    var verification = stub.getCurrentVerification();
    var subtitle = qs(".match-form-subtitle", root);

    if (subtitle && user && verification) {
      var statusText =
        verification.status === "not_submitted"
          ? "本人確認はまだ完了していません。"
          : "本人確認ステータス: " + verification.status;
      subtitle.textContent =
        user.display_name +
        "さん、安心して出会うために電話番号と身分証で本人確認を行います。（" +
        statusText +
        "）";
    }
  }

  window.MatchDataRender = {
    getActiveSwipeUserId: getActiveSwipeUserId,
    advanceSwipeProfile: advanceSwipeProfile,
    renderSwipeProfile: renderSwipeProfile,
    renderSwipeEmptyState: renderSwipeEmptyState,
    hideSwipeEmptyState: hideSwipeEmptyState,
    renderPairListPage: renderPairListPage,
    renderPairListItem: renderPairListItem,
    renderPairListRow: renderPairListRow,
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSwipePage();
    initListPage();
    initTalkBridgePage();
    initReportPage();
    initBlockPage();
    initVerifyPage();
  });
})();
