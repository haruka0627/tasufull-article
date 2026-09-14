/**
 * TASFUL Materials — primary chip + filter wiring (video-first V1)
 * Existing catalog / download / ads / billing are not replaced here.
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function cats() {
    return global.TasuMaterialsCategories;
  }

  function repo() {
    return global.TasuMaterialsRepository;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readUrlState() {
    const C = cats();
    const params = new URLSearchParams(global.location?.search || "");
    const category = C.resolveCategoryId(params.get("category") || params.get("cat") || "all") || "all";
    return {
      category,
      q: String(params.get("q") || params.get("query") || "").trim(),
      color: String(params.get("color") || "").trim(),
      format: String(params.get("format") || "").trim(),
      slide_size: String(params.get("slide_size") || "").trim(),
      slide_theme: String(params.get("slide_theme") || "").trim(),
    };
  }

  function writeUrlState(state) {
    if (!global.history?.replaceState || !global.location) return;
    const params = new URLSearchParams(global.location.search || "");
    const category = state.category && state.category !== "all" ? state.category : "";
    const pairs = [
      ["category", category],
      ["q", state.q || ""],
      ["color", state.color || ""],
      ["format", state.format || ""],
      ["slide_size", cats().shouldShowPresentationFilters(state.category) ? state.slide_size || "" : ""],
      ["slide_theme", cats().shouldShowPresentationFilters(state.category) ? state.slide_theme || "" : ""],
    ];
    pairs.forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("cat");
    params.delete("query");
    const next = params.toString();
    const url = `${global.location.pathname}${next ? `?${next}` : ""}${global.location.hash || ""}`;
    global.history.replaceState(state, "", url);
  }

  function renderChips(host, state) {
    const C = cats();
    if (!host) return;
    const chips = C.getPrimaryChips();
    host.innerHTML = chips
      .map((chip) => {
        const on = (state.category || "all") === chip.id;
        return `<button type="button" class="materials-chip${on ? " is-active" : ""}" data-materials-chip="${esc(chip.id)}" aria-pressed="${on ? "true" : "false"}">${esc(chip.label)}</button>`;
      })
      .join("");
  }

  function renderFilters(host, state) {
    const C = cats();
    if (!host) return;
    const visible = C.getVisibleFilters(state.category);
    if (!visible.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = visible
      .map((f) => {
        const value = esc(state[f.id] || "");
        return (
          `<label class="materials-filter">` +
          `<span>${esc(f.label)}</span>` +
          `<input type="text" data-materials-filter="${esc(f.id)}" value="${value}" placeholder="${esc(f.label)}" autocomplete="off">` +
          `</label>`
        );
      })
      .join("");
  }

  function renderResults(root, result, state) {
    const list = $("[data-materials-list]", root);
    const empty = $("[data-materials-empty]", root);
    const count = $("[data-materials-count]", root);
    const finding = $("[data-materials-finding]", root);
    const title = $("[data-materials-empty-title]", root);
    const text = $("[data-materials-empty-text]", root);
    const C = cats();
    const label = C.labelFor(state.category);
    const n = result.total;
    if (count) count.textContent = `${n}件`;
    if (list) {
      if (!n) {
        list.innerHTML = "";
      } else {
        list.innerHTML = result.items
          .map((item) => {
            const name = esc(item.title || item.name || item.id || "素材");
            const cat = esc(C.labelFor(item.category_id || item.category || ""));
            return `<li class="materials-card"><p class="materials-card__title">${name}</p><p class="materials-card__meta">${cat}</p></li>`;
          })
          .join("");
      }
    }
    if (empty) {
      empty.hidden = n > 0;
      if (title) {
        title.textContent = state.q
          ? "該当する素材がありません"
          : `${label}の素材はまだありません`;
      }
      if (text) {
        text.textContent = state.q
          ? "キーワードやカテゴリを変えて再検索してください。"
          : "このカテゴリに公開素材はありません（件数は実カタログの 0 件です）。";
      }
    }
    if (finding) {
      const found = repo().getFindingItems(repo().readCatalog());
      if (!found.length) {
        finding.hidden = true;
        finding.innerHTML = "";
      } else {
        finding.hidden = false;
        finding.innerHTML =
          `<h2 class="materials-finding__title">Finding</h2>` +
          `<ul class="materials-finding__list">${found
            .map((item) => `<li>${esc(item.title || item.name || item.id || "サムネイル")}</li>`)
            .join("")}</ul>`;
      }
    }
  }

  function apply(root, state) {
    const result = repo().search(state);
    renderChips($("[data-materials-chips]", root), state);
    renderFilters($("[data-materials-filters]", root), state);
    renderResults(root, result, state);
    writeUrlState(state);
    const searchInput = $("[data-materials-q]", root);
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    return result;
  }

  function bind(root) {
    const host = root || document;
    let state = readUrlState();
    apply(host, state);

    host.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-materials-chip]");
      if (!btn) return;
      state = { ...state, category: btn.getAttribute("data-materials-chip") || "all" };
      if (!cats().shouldShowPresentationFilters(state.category)) {
        state.slide_size = "";
        state.slide_theme = "";
      }
      apply(host, state);
    });

    const form = $("[data-materials-search]", host);
    if (form) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const q = $("[data-materials-q]", host)?.value || "";
        state = { ...state, q: String(q).trim() };
        apply(host, state);
      });
    }

    host.addEventListener("change", (ev) => {
      const input = ev.target.closest("[data-materials-filter]");
      if (!input) return;
      const key = input.getAttribute("data-materials-filter");
      if (!key) return;
      state = { ...state, [key]: String(input.value || "").trim() };
      apply(host, state);
    });

    return {
      getState: () => ({ ...state }),
      apply: (next) => {
        state = { ...state, ...next };
        return apply(host, state);
      },
    };
  }

  const api = Object.freeze({
    readUrlState,
    writeUrlState,
    renderChips,
    renderFilters,
    apply,
    bind,
  });

  global.TasuMaterialsUi = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if ($("[data-materials-page]")) bind(document);
      });
    } else if ($("[data-materials-page]")) {
      bind(document);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
