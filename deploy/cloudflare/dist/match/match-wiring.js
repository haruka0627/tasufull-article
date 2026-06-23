/**
 * TASFUL MATCH — UI wiring for TasfulMatchAPI client_stub
 * No fetch, no Supabase. Falls back when API is unavailable.
 */
(function () {
  "use strict";

  var REPORT_REASON_MAP = {
    message: "inappropriate_message",
    impersonation: "impersonation",
    harassment: "harassment",
    other: "other",
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function showToast(message) {
    var toast = qs("[data-match-toast]");
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function callApi(method, payload) {
    var api = getApi();
    if (!api || typeof api[method] !== "function") {
      return Promise.resolve(null);
    }
    return api[method](payload).then(function (result) {
      console.debug("[MatchWiring]", method, payload, result);
      return result;
    }).catch(function (err) {
      console.debug("[MatchWiring]", method, "error", err);
      return { ok: false, code: "internal_error", message: String(err) };
    });
  }

  function apiErrorMessage(result, fallback) {
    if (!result || result.ok) return fallback || "処理に失敗しました";
    if (window.MatchLoginGate?.isUnauthorized?.(result)) {
      window.MatchLoginGate.show();
      return window.MatchLoginGate.MESSAGE;
    }
    if (window.MatchBetaGate?.isBetaNotAllowed?.(result)) {
      window.MatchBetaGate.show();
      return window.MatchBetaGate.MESSAGE;
    }
    if (result.code === "validation_error") return result.message || "入力内容を確認してください";
    if (result.code === "phase_not_enabled") return result.message || "スーパーいいねは準備中です";
    return result.message || fallback || "処理に失敗しました";
  }

  function talkRoomErrorMessage(result) {
    if (!result || result.ok) return "";
    var code = String(result.code || "");
    if (code === "forbidden") return "このマッチにアクセスできません";
    if (code === "blocked") return "ブロック中のためメッセージを開始できません";
    if (code === "conflict") return "このマッチは解除済みか、利用できません";
    if (code === "unauthorized") return "ログインが必要です";
    return apiErrorMessage(result, "TALK接続に失敗しました");
  }

  function blockUser(blockedUserId, reason) {
    return callApi("blockUser", {
      blocked_user_id: blockedUserId,
      reason: reason || "",
    });
  }

  function getTargetUserId(root) {
    if (window.MatchDataRender?.getActiveSwipeUserId) {
      var active = window.MatchDataRender.getActiveSwipeUserId();
      if (active) return active;
    }
    var el = qs("[data-match-target-user-id]", root) || qs("[data-match-target-user-id]");
    if (el) return el.getAttribute("data-match-target-user-id") || "stub-user-unknown";
    var stub = window.TasfulMatchDataStub;
    if (stub) return stub.getDefaultTargetUserId();
    return "stub-user-unknown";
  }

  function getPairId(el) {
    if (el && el.getAttribute("data-match-pair-id")) {
      return el.getAttribute("data-match-pair-id");
    }
    var body = document.body.getAttribute("data-match-pair-id");
    if (body) return body;
    var stub = window.TasfulMatchDataStub;
    if (stub) return stub.getDefaultPairId();
    return "00000000-0000-4000-8000-000000000001";
  }

  function initSwipeWiring() {
    var page = qs('[data-page="match-swipe"]');
    if (!page) return;

    var skipBtn = qs('[data-match-swipe-action="skip"]', page);
    var likeBtn = qs('[data-match-swipe-action="like"]', page);
    var superBtn = qs('[data-match-swipe-action="super_like"]', page);

    function advanceCardMock() {
      var card = qs(".match-profile-card", page);
      if (card) {
        card.style.transition = "transform 0.25s ease, opacity 0.25s ease";
        card.style.transform = "translateX(-120%)";
        card.style.opacity = "0.35";
        setTimeout(function () {
          card.style.transform = "";
          card.style.opacity = "";
        }, 280);
      }
    }

    function isLiveFeed() {
      var api = getApi();
      return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub") && window.MatchFeedWiring;
    }

    function advanceAfterSwipe() {
      advanceCardMock();
      if (isLiveFeed()) {
        window.MatchFeedWiring.afterSwipe();
        return;
      }
      window.MatchDataRender?.advanceSwipeProfile?.();
    }

    function handleSwipe(action, options) {
      options = options || {};
      var currentTargetId = getTargetUserId(page);
      return callApi("recordSwipe", {
        target_user_id: currentTargetId,
        action: action,
      }).then(function (result) {
        if (!result) {
          if (options.fallbackToast) showToast(options.fallbackToast);
          if (options.fallbackNavigate) window.location.href = options.fallbackNavigate;
          if (options.fallbackAdvance) {
            advanceAfterSwipe();
          }
          return;
        }
        if (!result.ok) {
          if (result.code === "phase_not_enabled") {
            showToast("スーパーいいねは準備中です");
          } else {
            showToast(apiErrorMessage(result));
          }
          return;
        }
        if (action === "like") {
          if (result.matched && result.pair_id) {
            showToast("マッチしました！");
            window.setTimeout(function () {
              window.location.href =
                "match-talk-bridge.html?pair_id=" + encodeURIComponent(result.pair_id);
            }, 400);
            return;
          }
          showToast("いいねしました");
          if (isLiveFeed()) {
            advanceAfterSwipe();
            return;
          }
          window.setTimeout(function () {
            window.location.href = "match-list.html";
          }, 400);
          return;
        }
        if (action === "skip") {
          showToast("スキップしました");
          advanceAfterSwipe();
          return;
        }
        showToast("送信しました");
      });
    }

    skipBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      handleSwipe("skip", { fallbackToast: "スキップしました", fallbackAdvance: true });
    });

    likeBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      if (handleSwipe._likeTimer) {
        clearTimeout(handleSwipe._likeTimer);
      }
      handleSwipe._likeTimer = window.setTimeout(function () {
        handleSwipe._likeTimer = null;
        handleSwipe("like", { fallbackNavigate: "match-list.html" });
      }, 260);
    });

    superBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      handleSwipe("super_like", {});
    });

    likeBtn?.addEventListener("dblclick", function (e) {
      e.preventDefault();
      if (handleSwipe._likeTimer) {
        clearTimeout(handleSwipe._likeTimer);
        handleSwipe._likeTimer = null;
      }
      handleSwipe("super_like", {});
    });
  }

  function handleTalkCta(el) {
    el.addEventListener("click", function (e) {
      var api = getApi();
      if (!api) return;

      e.preventDefault();
      var pairId = getPairId(el);
      var apiMode = api.mode || "client_stub";

      callApi("ensureTalkRoom", { pair_id: pairId }).then(function (result) {
        if (!result || !result.ok) {
          showToast(talkRoomErrorMessage(result) || "TALK接続に失敗しました");
          return;
        }
        var redirectUrl = result.redirect_url;
        if (!redirectUrl) {
          showToast("ルームURLを取得できませんでした");
          return;
        }
        if (apiMode === "client_stub") {
          showToast("TALKルーム準備完了（スタブ）");
          console.debug("[MatchWiring] ensureTalkRoom stub redirect:", redirectUrl);
          return;
        }
        window.location.href = redirectUrl;
      });
    });
  }

  function initTalkBridgeWiring() {
    var page = qs('[data-page="match-talk-bridge"]');
    if (!page) return;

    var cta = qs("[data-match-talk-cta]", page);
    if (!cta) return;

    handleTalkCta(cta);
  }

  function initReportWiring() {
    var root = qs("[data-match-report-form]");
    if (!root || !getApi()) return;

    var options = qsa("[data-report-reason]", root);
    var detailInput = qs(".match-textarea", root);
    var reportedUserId = getTargetUserId(root);

    qs("[data-report-submit]", root)?.addEventListener("click", function () {
      var selected = options.find(function (o) {
        return o.classList.contains("is-selected");
      });
      var reasonKey = selected?.getAttribute("data-report-reason") || "";
      var reason = REPORT_REASON_MAP[reasonKey];
      if (!reason) {
        showToast("通報理由を選択してください");
        return;
      }

      var detail = detailInput ? detailInput.value.trim() : "";

      callApi("submitReport", {
        reported_user_id: reportedUserId,
        reason: reason,
        detail: detail,
      }).then(function (result) {
        if (!result) return;

        if (!result.ok) {
          showToast(apiErrorMessage(result, "通報を送信できませんでした"));
          return;
        }

        var label =
          selected?.querySelector(".match-report-option__label")?.textContent || "通報";
        var history = qs("[data-report-history]", root);
        var targetProfile = window.TasfulMatchDataStub?.getProfileById?.(reportedUserId);
        var targetLabel = targetProfile
          ? targetProfile.display_name + " " + targetProfile.age + "歳"
          : "対象ユーザー";
        if (history) {
          var item = document.createElement("article");
          item.className = "match-history-item";
          item.innerHTML =
            '<div class="match-history-item__top">' +
            '<span class="match-history-item__title">' + label + "</span>" +
            '<span class="match-history-item__date">たった今</span>' +
            "</div>" +
            '<p class="match-history-item__meta">対象：' + targetLabel + " · スタブ送信</p>" +
            '<span class="match-history-item__status">受付済み</span>';
          history.prepend(item);
        }
        showToast("通報を受け付けました");
      });
    }, true);
  }

  function initListWiring() {
    var page = qs('[data-page="match-list"]');
    if (!page) return;

    qsa("[data-match-talk-cta]", page).forEach(function (cta) {
      handleTalkCta(cta);
    });
  }

  function initVerifyWiring() {
    var root = qs("[data-match-verify-flow]");
    if (!root || !getApi()) return;
    if (window.MatchVerificationWiring) return;

    var api = getApi();
    if (api.isLiveMode && api.isLiveMode()) return;

    callApi("submitVerification", {
      verification_type: "phone",
      metadata: {},
    });
  }

  window.MatchWiring = {
    getApi: getApi,
    callApi: callApi,
    showToast: showToast,
    blockUser: blockUser,
    getTargetUserId: getTargetUserId,
    apiErrorMessage: apiErrorMessage,
    talkRoomErrorMessage: talkRoomErrorMessage,
    initListWiring: initListWiring,
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSwipeWiring();
    initTalkBridgeWiring();
    initListWiring();
    initReportWiring();
    initVerifyWiring();
  });
})();
