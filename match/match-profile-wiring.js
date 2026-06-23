/**
 * TASFUL MATCH — profile create live wiring (edge_stub only)
 */
(function () {
  "use strict";

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
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2400);
  }

  function mapGenderLabel(label) {
    var map = {
      女性: "female",
      男性: "male",
      その他: "other",
      非公開: "private",
    };
    return map[String(label || "").trim()] || "private";
  }

  function readField(name) {
    var el = qs('[data-profile-field="' + name + '"]');
    if (!el) return "";
    return String(el.value || "").trim();
  }

  function selectedHobbySlugs(root) {
    return qsa("[data-match-hobby-chip].is-selected", root)
      .map(function (chip) {
        return chip.getAttribute("data-hobby-slug") || "";
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function collectPayload(root, publish) {
    return {
      nickname: readField("nickname"),
      gender: mapGenderLabel(readField("gender")),
      birth_date: readField("birth_date"),
      prefecture: readField("prefecture"),
      city: readField("city") || null,
      bio: readField("bio") || null,
      purpose: readField("purpose") || null,
      hobby_slugs: selectedHobbySlugs(root),
      publish: publish === true,
    };
  }

  function validatePayload(payload) {
    if (!payload.nickname) return "ニックネームを入力してください";
    if (!payload.birth_date) return "生年月日を入力してください";
    if (!payload.prefecture) return "居住地を選択してください";
    return "";
  }

  function initPhotoSlots(root) {
    qsa("[data-profile-photo-slot]", root).forEach(function (slot, index) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.hidden = true;
      input.setAttribute("data-profile-photo-input", "");
      if (index === 0) input.setAttribute("data-profile-photo-main", "true");
      slot.appendChild(input);

      slot.addEventListener("click", function () {
        input.click();
      });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          showToast("画像は2MB以下にしてください");
          input.value = "";
          return;
        }
        slot.classList.add("has-image");
        slot.textContent = file.name.slice(0, 18) + (file.name.length > 18 ? "…" : "");
      });
    });
  }

  async function uploadPendingPhotos(root) {
    var api = getApi();
    if (!api || typeof api.uploadPhoto !== "function") return { ok: true };

    var inputs = qsa("[data-profile-photo-input]", root);
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var file = input.files && input.files[0];
      if (!file) continue;
      var base64 = await fileToBase64(file);
      var result = await api.uploadPhoto({
        content_base64: base64,
        content_type: file.type || "image/jpeg",
        is_main: input.hasAttribute("data-profile-photo-main"),
        display_order: i,
      });
      if (!result || !result.ok) {
        return result || { ok: false, message: "写真のアップロードに失敗しました" };
      }
    }
    return { ok: true };
  }

  async function submitWizard() {
    var root = qs("[data-match-profile-wizard]");
    if (!root) return { ok: false, message: "wizard not found" };

    if (!isEdgeMode()) {
      return { ok: true, mode: "client_stub" };
    }

    var api = getApi();
    if (!api || typeof api.upsertProfile !== "function") {
      return { ok: false, message: "APIが利用できません" };
    }

    var payload = collectPayload(root, true);
    var validationError = validatePayload(payload);
    if (validationError) {
      return { ok: false, message: validationError };
    }

    var upsert = await api.upsertProfile(payload);
    if (window.MatchBetaGate?.handleApiResult?.(upsert)) {
      return upsert;
    }
    if (!upsert || !upsert.ok) {
      return upsert || { ok: false, message: "プロフィールの保存に失敗しました" };
    }

    var photoResult = await uploadPendingPhotos(root);
    if (!photoResult.ok) {
      return photoResult;
    }

    return { ok: true, profile_id: upsert.profile_id };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = qs("[data-match-profile-wizard]");
    if (!root) return;
    initPhotoSlots(root);
  });

  window.MatchProfileWiring = {
    submitWizard: submitWizard,
    isEdgeMode: isEdgeMode,
  };
})();
