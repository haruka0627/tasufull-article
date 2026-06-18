/**
 * TASFUL TALK — 折りたたみフィルターパネル（タグ型・複数選択・件数・localStorage）
 */
(function (global) {
  "use strict";

  const STATE_KEY = "tasu_talk_filter_state_v1";

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function loadRootState() {
    return readJson(STATE_KEY, {});
  }

  function saveRootState(root) {
    writeJson(STATE_KEY, root || {});
  }

  function loadScope(scopeId, defaults) {
    const root = loadRootState();
    const scope = root[scopeId];
    return { ...defaults, ...(scope && typeof scope === "object" ? scope : {}) };
  }

  function saveScope(scopeId, patch) {
    const root = loadRootState();
    root[scopeId] = { ...(root[scopeId] || {}), ...patch };
    saveRootState(root);
    return root[scopeId];
  }

  function toSet(arr) {
    const list = Array.isArray(arr) ? arr : [];
    return new Set(list.map((id) => String(id)).filter(Boolean));
  }

  function setToArray(set) {
    return set instanceof Set ? [...set] : [];
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatCount(n) {
    const v = Number(n) || 0;
    return `(${v})`;
  }

  function isSelected(selected, sectionId, optionId) {
    const sel = selected?.[sectionId];
    if (sel instanceof Set) return sel.has(String(optionId));
    return toSet(sel).has(String(optionId));
  }

  function renderChip(opt, sectionId, selected) {
    const on = isSelected(selected, sectionId, opt.id);
    return `<button type="button" class="talk-filter-chip${on ? " is-active" : ""}" data-talk-filter-section="${escapeHtml(sectionId)}" data-talk-filter-option="${escapeHtml(opt.id)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(opt.label)}${formatCount(opt.count)}</button>`;
  }

  /**
   * タグ型クイックフィルター（開いたパネル内）
   * @param {HTMLElement} container
   * @param {{
   *   primarySectionId?: string,
   *   primaryOptions: Array<{ id: string, label: string, count?: number }>,
   *   secondaryGroups?: Array<{ id: string, label?: string, options: Array<{ id: string, label: string, count?: number }> }>,
   *   selected: Record<string, Set<string>|string[]|boolean>,
   *   resetLabel?: string,
   *   hint?: string,
   *   onToggle: (sectionId: string, optionId: string, active: boolean) => void,
   *   onReset: () => void,
   * }} config
   */
  function renderTagPanel(container, config) {
    if (!container) return;
    const primarySectionId = config.primarySectionId || "tag";
    const selected = config.selected || {};
    const resetLabel = config.resetLabel || "すべて表示";
    const hint = config.hint || "タップで絞り込み（複数選択可）";

    const primaryHtml = (config.primaryOptions || [])
      .map((opt) => renderChip(opt, primarySectionId, selected))
      .join("");

    const secondaryHtml = (config.secondaryGroups || [])
      .map((group) => {
        const chips = (group.options || [])
          .map((opt) => renderChip(opt, group.id, selected))
          .join("");
        const label = group.label
          ? `<p class="talk-filter-tags__sub-label">${escapeHtml(group.label)}</p>`
          : "";
        const scrollClass = group.scrollable ? " talk-filter-tags__row--scroll" : "";
        return `${label}<div class="talk-filter-tags__row talk-filter-tags__row--sub${scrollClass}" role="group" aria-label="${escapeHtml(group.label || "追加条件")}">${chips}</div>`;
      })
      .join("");

    container.innerHTML = `
      <div class="talk-filter-panel__inner talk-filter-panel__inner--tags">
        <div class="talk-filter-tags__head">
          <button type="button" class="talk-filter-panel__reset" data-talk-filter-reset>${escapeHtml(resetLabel)}</button>
          <p class="talk-filter-tags__hint">${escapeHtml(hint)}</p>
        </div>
        <div class="talk-filter-tags__row" role="group" aria-label="カテゴリ">${primaryHtml}</div>
        ${secondaryHtml}
      </div>`;

    if (!container.dataset.wired) {
      container.dataset.wired = "1";
      container.addEventListener("click", (e) => {
        const chip = /** @type {HTMLElement|null} */ (e.target)?.closest?.("[data-talk-filter-option]");
        if (chip) {
          const sectionId = chip.getAttribute("data-talk-filter-section") || "";
          const optionId = chip.getAttribute("data-talk-filter-option") || "";
          const wasActive = chip.classList.contains("is-active");
          config.onToggle?.(sectionId, optionId, !wasActive);
          return;
        }
        const reset = /** @type {HTMLElement|null} */ (e.target)?.closest?.("[data-talk-filter-reset]");
        if (reset) config.onReset?.();
      });
    }
  }

  /** @deprecated — renderTagPanel を使用 */
  function renderSections(container, config) {
    renderTagPanel(container, {
      primaryOptions: (config.sections || []).flatMap((s) =>
        (s.options || []).map((o) => ({ ...o, _section: s.id }))
      ),
      primarySectionId: "tag",
      selected: config.selected,
      onToggle: config.onToggle,
      onReset: config.onReset,
    });
  }

  /**
   * @param {{
   *   scopeId: string,
   *   toggleBtn: HTMLElement|null,
   *   panel: HTMLElement|null,
   *   defaultOpen?: boolean,
   * }} config
   */
  function bindCollapsible(config) {
    const btn = config.toggleBtn;
    const panel = config.panel;
    if (!btn || !panel) return;

    const scope = loadScope(config.scopeId, { open: config.defaultOpen === true });
    let open = Boolean(scope.open);

    function applyOpen() {
      panel.hidden = !open;
      btn.classList.toggle("is-active", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    applyOpen();

    if (!btn.dataset.filterToggleWired) {
      btn.dataset.filterToggleWired = "1";
      btn.addEventListener("click", () => {
        open = !open;
        saveScope(config.scopeId, { open });
        applyOpen();
      });
    }
  }

  function hasAnySelection(selectedMap) {
    return Object.keys(selectedMap || {}).some((key) => toSet(selectedMap[key]).size > 0);
  }

  global.TasuTalkFilterUi = {
    STATE_KEY,
    loadScope,
    saveScope,
    toSet,
    setToArray,
    renderTagPanel,
    renderSections,
    bindCollapsible,
    hasAnySelection,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
