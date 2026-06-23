/**
 * TASFUL MATCH — verification live wiring (live / edge_stub)
 */
(function () {
  "use strict";

  var DOC_TYPE_MAP = {
    運転免許証: "drivers_license",
    マイナンバーカード: "mynumber",
    パスポート: "passport",
    在留カード: "residence_card",
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function getApi() {
    return window.TasfulMatchAPI || null;
  }

  function isEdgeMode() {
    var api = getApi();
    return api && (typeof api.isLiveMode === "function" ? api.isLiveMode() : api.mode === "live" || api.mode === "edge_stub");
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
    }, 2400);
  }

  function apiErrorMessage(result, fallback) {
    if (window.MatchWiring?.apiErrorMessage) {
      return window.MatchWiring.apiErrorMessage(result, fallback);
    }
    if (!result || result.ok) return fallback || "処理に失敗しました";
    return result.message || fallback || "処理に失敗しました";
  }

  function isPendingStatus(status) {
    return (
      status === "pending" ||
      status === "submitted" ||
      status === "under_review" ||
      status === "phone_verified"
    );
  }

  function renderFlowState(root, panelIndex) {
    var steps = qsa("[data-verify-step]", root);
    var panels = qsa("[data-verify-panel]", root);
    steps.forEach(function (step, i) {
      step.classList.toggle("is-active", i === panelIndex);
      step.classList.toggle("is-done", i < panelIndex);
      var num = step.querySelector(".match-verify-step__num");
      if (num) num.textContent = i < panelIndex ? "✓" : String(i + 1);
    });
    panels.forEach(function (panel) {
      var idx = Number(panel.getAttribute("data-verify-panel"));
      panel.classList.toggle("is-active", idx === panelIndex);
    });
  }

  function updateStatusBanner(root, items) {
    var subtitle = qs(".match-form-subtitle", root);
    if (!subtitle) return;

    var identity = items.find(function (item) {
      return item.verification_type === "identity";
    });
    var age = items.find(function (item) {
      return item.verification_type === "age";
    });
    var parts = [];
    if (identity && isPendingStatus(identity.status)) parts.push("本人確認：審査中");
    else if (identity && identity.status === "approved") parts.push("本人確認：完了");
    if (age && isPendingStatus(age.status)) parts.push("年齢確認：審査中");
    else if (age && age.status === "approved") parts.push("年齢確認：完了");
    if (!parts.length) parts.push("本人確認・年齢確認の申請を受け付けます");

    subtitle.textContent = parts.join(" · ");
  }

  function applyVerificationState(root, items) {
    updateStatusBanner(root, items);
    var identityPending = items.some(function (item) {
      return item.verification_type === "identity" && isPendingStatus(item.status);
    });
    var agePending = items.some(function (item) {
      return item.verification_type === "age" && isPendingStatus(item.status);
    });
    var identityApproved = items.some(function (item) {
      return item.verification_type === "identity" && item.status === "approved";
    });

    if (identityApproved) {
      renderFlowState(root, 3);
      return;
    }
    if (identityPending || agePending) {
      renderFlowState(root, 2);
      return;
    }
    renderFlowState(root, 1);
  }

  function loadVerificationState(root) {
    var api = getApi();
    if (!api || typeof api.listVerifications !== "function") return Promise.resolve();
    return api.listVerifications().then(function (result) {
      if (!result || !result.ok || !Array.isArray(result.items)) return;
      applyVerificationState(root, result.items);
    });
  }

  function readDocumentType(root) {
    var select = qs("[data-verify-doc-type]", root);
    if (!select) return null;
    var label = String(select.value || "").trim();
    return DOC_TYPE_MAP[label] || null;
  }

  function submitType(root, verificationType) {
    var api = getApi();
    if (!api || typeof api.submitVerification !== "function") return;

    var payload = { verification_type: verificationType, metadata: {} };
    if (verificationType === "identity") {
      payload.id_document_type = readDocumentType(root);
    }

    api.submitVerification(payload).then(function (result) {
      if (!result || !result.ok) {
        showToast(apiErrorMessage(result, "確認申請を送信できませんでした"));
        return;
      }
      showToast("確認申請を受け付けました");
      loadVerificationState(root);
    });
  }

  function initVerifyLiveWiring() {
    var root = qs("[data-match-verify-flow]");
    if (!root || !isEdgeMode()) return;

    qsa("[data-verify-submit-identity]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        submitType(root, "identity");
      });
    });

    qsa("[data-verify-submit-age]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        submitType(root, "age");
      });
    });

    qsa("[data-verify-next]", root).forEach(function (btn) {
      if (btn.hasAttribute("data-verify-submit-identity") || btn.hasAttribute("data-verify-submit-age")) {
        return;
      }
      btn.addEventListener("click", function () {
        if (!isEdgeMode()) return;
        showToast("審査完了は管理者承認後に反映されます");
      });
    });

    loadVerificationState(root);
  }

  window.MatchVerificationWiring = {
    loadVerificationState: loadVerificationState,
    applyVerificationState: applyVerificationState,
  };

  document.addEventListener("DOMContentLoaded", function () {
    initVerifyLiveWiring();
  });
})();
