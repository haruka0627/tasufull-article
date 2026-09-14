/**
 * Materials Creator Upload / Register UI V1
 * Wires completed UI to existing package writer + ownership + PUBLIC_INDEX.
 * Client never sets creator_user_id.
 */
(function (global) {
  "use strict";

  var API = "/api/materials/user-register";
  var MAX_TITLE = 100;
  var MAX_DESC = 500;
  var state = {
    file: null,
    previewUrl: "",
    tags: [],
    slug: "",
  };

  var CATEGORY_TYPES = {
    sfx: { label: "効果音 / SFX", accept: ".wav,.mp3,.ogg", formats: "WAV, MP3, OGG", preview: "audio" },
    image: { label: "画像素材", accept: ".png,.jpg,.jpeg,.webp", formats: "PNG, JPG, JPEG, WEBP", preview: "image" },
    illustration: { label: "イラスト素材", accept: ".png,.jpg,.jpeg,.webp", formats: "PNG, JPG, JPEG, WEBP", preview: "image" },
    background: { label: "背景素材", accept: ".png,.jpg,.jpeg,.webp", formats: "PNG, JPG, JPEG, WEBP", preview: "image" },
    icon: { label: "アイコン", accept: ".png,.jpg,.jpeg,.webp", formats: "PNG, JPG, JPEG, WEBP", preview: "image" },
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function sessionUser() {
    var Auth = global.TasuMemberAuth;
    var s = Auth && typeof Auth.readMemberSession === "function" ? Auth.readMemberSession() : null;
    if (!s || typeof s !== "object") return null;
    var id = String(s.id || s.userId || s.user_id || "").trim();
    if (!id) return null;
    return {
      id: id,
      name: String(s.display_name || s.displayName || s.name || "TASFUL クリエイター").trim(),
    };
  }

  function isLocalHost() {
    var host = String(global.location && global.location.hostname || "").toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  }

  function showStatus(message, isError) {
    var el = $("[data-upload-status]");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function fillCategories() {
    var select = $("[data-category]");
    if (!select) return;
    var cats = (global.TasuMaterialsData && global.TasuMaterialsData.CATEGORIES) || [];
    cats.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (!CATEGORY_TYPES[cat.id]) {
        opt.textContent += "（この画面では未配線）";
      }
      select.appendChild(opt);
    });
  }

  function selectedCategory() {
    return String(($("[data-category]") || {}).value || "").trim();
  }

  function updateFormatHint() {
    var spec = CATEGORY_TYPES[selectedCategory()];
    var el = $("[data-upload-formats]");
    var input = $("[data-upload-file]");
    if (spec) {
      if (el) el.textContent = "対応形式: " + spec.formats + " / 最大サイズ: 50MB";
      if (input) input.accept = spec.accept;
    } else if (el) {
      el.textContent = "対応形式はカテゴリ選択後に表示されます（最大 50MB）";
    }
  }

  function renderTags() {
    var box = $("[data-tag-chips]");
    if (!box) return;
    box.innerHTML = "";
    state.tags.forEach(function (tag, idx) {
      var chip = document.createElement("span");
      chip.className = "mat-up-chip";
      chip.textContent = tag + " ";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "タグを削除");
      btn.textContent = "×";
      btn.addEventListener("click", function () {
        state.tags.splice(idx, 1);
        renderTags();
      });
      chip.appendChild(btn);
      box.appendChild(chip);
    });
  }

  function addTag(raw) {
    var tag = String(raw || "").trim();
    if (!tag || state.tags.indexOf(tag) >= 0 || state.tags.length >= 20) return;
    state.tags.push(tag);
    renderTags();
  }

  function clearPreview() {
    if (state.previewUrl) {
      try {
        URL.revokeObjectURL(state.previewUrl);
      } catch (_err) {
        /* ignore */
      }
    }
    state.previewUrl = "";
    var box = $("[data-preview]");
    if (!box) return;
    box.innerHTML =
      '<i class="fa-regular fa-image" aria-hidden="true"></i><p>ファイルをアップロードすると</p><p>プレビューが表示されます</p>';
  }

  function renderPreview() {
    var box = $("[data-preview]");
    if (!box || !state.file) {
      clearPreview();
      return;
    }
    var spec = CATEGORY_TYPES[selectedCategory()] || {};
    var type = String(state.file.type || "");
    if (state.previewUrl) {
      try {
        URL.revokeObjectURL(state.previewUrl);
      } catch (_err2) {
        /* ignore */
      }
    }
    if (spec.preview === "image" || type.indexOf("image/") === 0) {
      state.previewUrl = URL.createObjectURL(state.file);
      box.innerHTML = "";
      var img = document.createElement("img");
      img.alt = "プレビュー";
      img.src = state.previewUrl;
      box.appendChild(img);
      return;
    }
    if (spec.preview === "audio" || type.indexOf("audio/") === 0) {
      state.previewUrl = URL.createObjectURL(state.file);
      box.innerHTML = "";
      var audio = document.createElement("audio");
      audio.controls = true;
      audio.src = state.previewUrl;
      box.appendChild(audio);
      return;
    }
    box.innerHTML =
      '<i class="fa-regular fa-image" aria-hidden="true"></i><p>この形式のプレビューには未対応です</p>';
  }

  function setFile(file) {
    state.file = file || null;
    var nameEl = $("[data-upload-filename]");
    if (nameEl) {
      nameEl.hidden = !file;
      nameEl.textContent = file ? file.name : "";
    }
    renderPreview();
  }

  function visibilityValue() {
    var draft = $("[data-visibility-draft]");
    return draft && draft.checked ? "draft" : "public";
  }

  function authHeaders() {
    var headers = {};
    var user = sessionUser();
    if (isLocalHost() && user) {
      headers["X-TASFUL-MATERIALS-LOCAL-USER"] = user.id;
    }
    return headers;
  }

  function clientValidation(forPublish) {
    if (!sessionUser()) return "ログインが必要です。";
    if (!state.file) return "ファイルを選択してください。";
    var title = String(($("[data-title]") || {}).value || "").trim();
    if (!title) return "タイトルを入力してください。";
    if (!selectedCategory()) return "カテゴリを選択してください。";
    if (!CATEGORY_TYPES[selectedCategory()]) return "このカテゴリのユーザー投稿は未配線です。";
    if (forPublish) {
      var rights = $("[data-rights]");
      if (!rights || !rights.checked) return "権利の確認が必要です。";
      if (visibilityValue() !== "public") return "公開するには公開設定で「公開する」を選んでください。";
    }
    return "";
  }

  function buildForm(action) {
    var fd = new FormData();
    fd.append("action", action);
    fd.append("title", String(($("[data-title]") || {}).value || "").trim());
    fd.append("description", String(($("[data-description]") || {}).value || "").trim());
    fd.append("category_id", selectedCategory());
    fd.append("tags", JSON.stringify(state.tags));
    fd.append("visibility", action === "publish" ? "public" : "draft");
    fd.append("rights_confirmed", $("[data-rights]") && $("[data-rights]").checked ? "1" : "0");
    if (state.slug) fd.append("slug", state.slug);
    if (state.file) fd.append("file", state.file, state.file.name);
    return fd;
  }

  function showSuccess(data) {
    var box = $("[data-success]");
    if (!box) return;
    box.hidden = false;
    var detail = $("[data-detail-handoff]");
    var creator = $("[data-creator-handoff]");
    if (detail) detail.href = data.detailHref || "#";
    if (creator) creator.href = data.creatorHref || "#";
  }

  async function postAction(action) {
    var err = clientValidation(action === "publish");
    if (err) {
      showStatus(err, true);
      return;
    }
    showStatus(action === "publish" ? "公開しています…" : "下書きを保存しています…", false);
    var res = await fetch(API, {
      method: "POST",
      headers: authHeaders(),
      body: buildForm(action),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (_err3) {
      data = {};
    }
    if (!res.ok || !data.ok) {
      showStatus(data.code || data.reason || "保存に失敗しました", true);
      return;
    }
    state.slug = data.slug || state.slug;
    if ($("[data-slug]")) $("[data-slug]").value = state.slug || "";
    if (action === "publish") {
      showStatus("公開しました", false);
      showSuccess(data);
    } else {
      showStatus("下書きを保存しました（slug: " + (data.slug || "") + "）", false);
    }
  }

  async function restoreDraft(slug) {
    var user = sessionUser();
    if (!user || !slug) return;
    var res = await fetch(API + "?action=draft&slug=" + encodeURIComponent(slug), {
      headers: authHeaders(),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (_err4) {
      data = {};
    }
    if (!data.ok || !data.metadata) return;
    state.slug = data.slug || slug;
    if ($("[data-slug]")) $("[data-slug]").value = state.slug || "";
    if ($("[data-title]")) $("[data-title]").value = data.metadata.title || "";
    if ($("[data-description]")) $("[data-description]").value = data.metadata.description || "";
    if ($("[data-category]") && data.metadata.type) $("[data-category]").value = data.metadata.type;
    state.tags = Array.isArray(data.metadata.tags) ? data.metadata.tags.slice() : [];
    renderTags();
    updateCounts();
    updateFormatHint();
    showStatus("下書きを復元しました", false);
  }

  function updateCounts() {
    var title = $("[data-title]");
    var desc = $("[data-description]");
    if ($("[data-title-count]") && title) {
      $("[data-title-count]").textContent = String(title.value.length) + " / " + MAX_TITLE;
    }
    if ($("[data-desc-count]") && desc) {
      $("[data-desc-count]").textContent = String(desc.value.length) + " / " + MAX_DESC;
    }
  }

  function bindVisibility() {
    document.querySelectorAll('input[name="mat-up-vis"]').forEach(function (input) {
      input.addEventListener("change", function () {
        document.querySelectorAll(".mat-up-choice").forEach(function (lab) {
          lab.classList.toggle("is-selected", lab.querySelector("input") && lab.querySelector("input").checked);
        });
      });
    });
  }

  function applyAccount(user) {
    if ($("[data-upload-user-id]")) $("[data-upload-user-id]").textContent = user ? user.id : "";
    if ($("[data-upload-display-name]") && user) {
      $("[data-upload-display-name]").textContent = user.name || "TASFUL クリエイター";
    }
    document.querySelectorAll("[data-upload-posted-link], [data-upload-creator-link]").forEach(function (a) {
      if (user) a.href = "/materials/creator.html?id=" + encodeURIComponent(user.id);
    });
  }

  async function mount() {
    fillCategories();
    var user = sessionUser();
    applyAccount(user);
    var gate = $("[data-auth-gate]");
    if (!user) {
      document.body.classList.add("is-unauth");
      if (gate) gate.hidden = false;
      return;
    }
    if (gate) gate.hidden = true;

    var fileInput = $("[data-upload-file]");
    var drop = $("[data-upload-dropzone]");
    var pick = $("[data-upload-pick]");
    if (pick && fileInput) {
      pick.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        fileInput.click();
      });
    }
    if (drop && fileInput) {
      drop.addEventListener("click", function () {
        fileInput.click();
      });
      drop.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        drop.classList.add("is-drag");
      });
      drop.addEventListener("dragleave", function () {
        drop.classList.remove("is-drag");
      });
      drop.addEventListener("drop", function (ev) {
        ev.preventDefault();
        drop.classList.remove("is-drag");
        if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) {
          setFile(ev.dataTransfer.files[0]);
        }
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        setFile(fileInput.files && fileInput.files[0] ? fileInput.files[0] : null);
      });
    }

    var title = $("[data-title]");
    var desc = $("[data-description]");
    if (title) title.addEventListener("input", updateCounts);
    if (desc) desc.addEventListener("input", updateCounts);
    updateCounts();

    var tagInput = $("[data-tag-input]");
    if (tagInput) {
      tagInput.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          addTag(tagInput.value);
          tagInput.value = "";
        }
      });
    }

    var cat = $("[data-category]");
    if (cat) cat.addEventListener("change", function () {
      updateFormatHint();
      renderPreview();
    });
    updateFormatHint();
    bindVisibility();

    var save = $("[data-save-draft]");
    var previewBtn = $("[data-preview-btn]");
    var publish = $("[data-publish]");
    if (save) save.addEventListener("click", function () { postAction("draft"); });
    if (publish) publish.addEventListener("click", function () { postAction("publish"); });
    if (previewBtn) {
      previewBtn.addEventListener("click", function () {
        var err = clientValidation(false);
        if (err) {
          showStatus(err, true);
          return;
        }
        renderPreview();
        var section = $("[data-preview-section]");
        if (section && section.scrollIntoView) section.scrollIntoView({ behavior: "smooth", block: "start" });
        showStatus("右側（モバイルでは基本情報の下）のプレビューを確認してください。公開は「公開する」のみです。", false);
      });
    }

    var logout = $("[data-upload-logout]");
    if (logout && global.TasuMemberAuth && global.TasuMemberAuth.logout) {
      logout.addEventListener("click", function () {
        global.TasuMemberAuth.logout();
      });
    }

    var params = new URLSearchParams(global.location.search || "");
    var slug = params.get("slug") || params.get("draft");
    if (slug) await restoreDraft(slug);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})(typeof window !== "undefined" ? window : this);
