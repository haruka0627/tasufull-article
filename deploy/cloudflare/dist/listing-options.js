/**
 * TasuFull — 掲載オプション（JSON配列）のフォーム編集・詳細表示
 * 形式: [{ "title": string, "desc": string, "price": number }, ...]
 */
(function (global) {
  "use strict";

  const DEFAULT_SKILL_DETAIL_OPTIONS = Object.freeze([
    {
      title: "高画質化",
      desc: "出力解像度を高品質に調整",
      price: 10000,
    },
    {
      title: "モーション追加",
      desc: "基本モーションを1種追加",
      price: 15000,
    },
    {
      title: "衣装差分",
      desc: "衣装バリエーションを1種追加",
      price: 20000,
    },
    {
      title: "表情差分追加",
      desc: "4種類の表情を追加",
      price: 10000,
    },
    {
      title: "短納期対応",
      desc: "通常より早い納品スケジュール",
      price: 15000,
    },
  ]);

  function formatYen(amount) {
    return `¥${amount.toLocaleString("ja-JP")}`;
  }

  function parseOptions(raw) {
    if (raw == null || raw === "") {
      return [];
    }
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => ({
        title: String(item?.title ?? "").trim(),
        desc: String(item?.desc ?? item?.description ?? "").trim(),
        price: Number.parseInt(item?.price, 10),
      }))
      .filter((item) => item.title && Number.isFinite(item.price) && item.price >= 0);
  }

  function readOptionsFromPage() {
    const el = document.getElementById("listing-options-data");
    if (!el) {
      return [];
    }
    return parseOptions(el.textContent);
  }

  const PAID_OPTIONS_HEADING_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h14l-1.25 9a1 1 0 01-1 .9H7.25a1 1 0 01-1-.9L6 6z"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 11h6"/>
    </svg>
  `;

  function isSkillPaidOptionsPage() {
    return document.body?.dataset?.detailType === "skill";
  }

  /**
   * 見出し付きシェルが無い場合に HTML を組み立てる（CSS だけでは見出しが出ない問題の対策）
   */
  function ensurePaidOptionsShell(section) {
    const root =
      section ||
      document.querySelector("[data-paid-options-root]") ||
      document.getElementById("section-options");

    if (!root) {
      return { section: null, list: null, total: null, hint: null };
    }

    if (!isSkillPaidOptionsPage()) {
      return {
        section: root,
        list: root.querySelector("#optionList"),
        total: root.querySelector("#optionTotal"),
        hint: root.querySelector("[data-options-hint]"),
      };
    }

    root.classList.add("paid-options-section");

    let heading = root.querySelector(".paid-options-heading");
    if (!heading) {
      const prevTotal = root.querySelector("#optionTotal")?.textContent?.trim();
      const prevHint = root.querySelector("[data-options-hint]")?.textContent?.trim();
      const totalText = prevTotal || "¥80,000〜";
      const hintText = prevHint || "オプションを選択してください";

      root.innerHTML = `
        <div class="paid-options-card">
          <div class="paid-options-heading">
            <span class="paid-options-icon" aria-hidden="true">${PAID_OPTIONS_HEADING_ICON}</span>
            <h2 id="paidOptionsTitle" class="paid-options-title">有料オプション</h2>
          </div>
          <div class="paid-options-body">
            <div class="paid-options-layout">
              <div class="paid-options-list" id="optionList" role="list" aria-label="有料オプション一覧"></div>
              <aside class="paid-options-total" aria-live="polite">
                <span class="paid-options-total__accent" aria-hidden="true"></span>
                <span class="paid-options-total__label">合計金額</span>
                <strong id="optionTotal" class="paid-options-total__price">${totalText}</strong>
                <p class="paid-options-total__hint" data-options-hint>${hintText}</p>
              </aside>
            </div>
          </div>
        </div>
      `;
      heading = root.querySelector(".paid-options-heading");
    }

    if (heading && heading.getAttribute("data-paid-options-heading-ready") !== "1") {
      const iconWrap = heading.querySelector(".paid-options-icon");
      if (iconWrap && !iconWrap.querySelector("svg")) {
        iconWrap.innerHTML = PAID_OPTIONS_HEADING_ICON;
      }
      const titleEl = heading.querySelector(".paid-options-title, #paidOptionsTitle");
      if (titleEl && !titleEl.textContent.trim()) {
        titleEl.textContent = "有料オプション";
      }
      heading.setAttribute("data-paid-options-heading-ready", "1");
    }

    return {
      section: root,
      list: root.querySelector("#optionList"),
      total: root.querySelector("#optionTotal"),
      hint: root.querySelector("[data-options-hint]"),
    };
  }

  function createOptionCard(option) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-paid-option-card";
    btn.dataset.price = String(option.price);
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-pressed", "false");

    btn.innerHTML = `
      <span class="skill-paid-option-card__check" aria-hidden="true"></span>
      <span class="skill-paid-option-card__content">
        <span class="skill-paid-option-card__name"></span>
        <span class="skill-paid-option-card__desc"></span>
        <span class="skill-paid-option-card__price"></span>
      </span>
    `;

    const nameEl = btn.querySelector(".skill-paid-option-card__name");
    const descEl = btn.querySelector(".skill-paid-option-card__desc");
    const priceEl = btn.querySelector(".skill-paid-option-card__price");

    if (nameEl) nameEl.textContent = option.title;
    if (descEl) descEl.textContent = option.desc || "";
    if (priceEl) priceEl.textContent = `+${formatYen(option.price)}`;

    return btn;
  }

  function bindOptionButtons(list, totalNode, basePrice, totalApprox) {
    function updateTotal() {
      let sum = basePrice;
      list.querySelectorAll(".skill-paid-option-card").forEach((item) => {
        if (!item.classList.contains("is-active")) {
          return;
        }
        const price = Number.parseInt(item.dataset.price ?? "0", 10);
        if (Number.isFinite(price)) {
          sum += price;
        }
      });
      const suffix = totalApprox ? "〜" : "";
      totalNode.textContent = `${formatYen(sum)}${suffix}`;
    }

    list.querySelectorAll(".skill-paid-option-card").forEach((item) => {
      item.addEventListener("click", () => {
        const active = item.classList.toggle("is-active");
        item.setAttribute("aria-pressed", active ? "true" : "false");
        updateTotal();
      });
    });

    updateTotal();
  }

  function setSectionVisible(section, navLink, visible) {
    if (section) {
      section.hidden = !visible;
    }
    if (navLink) {
      navLink.hidden = !visible;
      if (!visible) {
        navLink.setAttribute("aria-hidden", "true");
      } else {
        navLink.removeAttribute("aria-hidden");
      }
    }
  }

  /**
   * 詳細ページ: JSON からオプションカードを生成
   */
  function initDetail(config) {
    const {
      basePrice = 0,
      totalApprox = true,
      hintText = "オプションを選択してください",
      forceShow = false,
    } = config || {};

    const section = document.getElementById("section-options");
    const shell = ensurePaidOptionsShell(section);
    const list = shell.list;
    const totalNode = shell.total;
    const navLink = document.querySelector('.section-nav__link[href="#section-options"]');
    const hintNode = shell.hint || section?.querySelector("[data-options-hint]");

    if (!list || !totalNode) {
      return;
    }

    let options = readOptionsFromPage();
    if (options.length === 0) {
      options = DEFAULT_SKILL_DETAIL_OPTIONS.slice();
    }

    if (options.length === 0 && !forceShow) {
      setSectionVisible(section, navLink, false);
      return;
    }

    setSectionVisible(section, navLink, true);
    list.innerHTML = "";
    options.forEach((opt) => list.appendChild(createOptionCard(opt)));

    if (hintNode && hintText) {
      hintNode.textContent = hintText;
    }

    const initialSuffix = totalApprox ? "〜" : "";
    const safeBase = Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 80000;
    totalNode.textContent = `${formatYen(safeBase)}${initialSuffix}`;
    bindOptionButtons(list, totalNode, safeBase, totalApprox);
  }

  function syncFormHiddenInput(container, hiddenInput) {
    const rows = container.querySelectorAll("[data-option-row]");
    const options = [];
    rows.forEach((row) => {
      const title = row.querySelector("[data-option-title]")?.value?.trim() ?? "";
      const desc = row.querySelector("[data-option-desc]")?.value?.trim() ?? "";
      const priceRaw = row.querySelector("[data-option-price]")?.value ?? "";
      const price = Number.parseInt(priceRaw, 10);
      if (!title || !Number.isFinite(price) || price < 0) {
        return;
      }
      options.push({ title, desc, price });
    });
    hiddenInput.value = JSON.stringify(options, null, 0);
    return options;
  }

  function createFormRow() {
    const row = document.createElement("div");
    row.className = "listing-option-row options-row";
    row.dataset.optionRow = "";
    row.innerHTML = `
      <label class="listing-option-field">
        <span class="listing-option-field__label">オプション名</span>
        <input type="text" data-option-title class="listing-option-field__input" placeholder="例：延長保証" maxlength="80" required>
      </label>
      <label class="listing-option-field listing-option-field--wide">
        <span class="listing-option-field__label">説明</span>
        <input type="text" data-option-desc class="listing-option-field__input" placeholder="例：保証期間+1年" maxlength="120">
      </label>
      <label class="listing-option-field listing-option-field--price">
        <span class="listing-option-field__label">金額（円）</span>
        <input type="number" data-option-price class="listing-option-field__input" placeholder="3000" min="0" step="1" required>
      </label>
      <button type="button" class="listing-option-row__remove" data-option-remove aria-label="このオプションを削除">削除</button>
    `;
    row.querySelector("[data-option-remove]")?.addEventListener("click", () => {
      row.remove();
    });
    return row;
  }

  /**
   * 出品フォーム: オプション行の追加・JSON同期
   */
  function initForm(formEl) {
    if (!formEl) {
      return;
    }

    const container = formEl.querySelector("[data-options-builder]");
    const hiddenInput = formEl.querySelector("[data-options-json]");
    const addBtn = formEl.querySelector("[data-options-add]");
    const typeSelect = formEl.querySelector("[data-listing-type]");
    const optionsBlock = formEl.querySelector("[data-options-block]");
    const optionsSection = formEl.querySelector("[data-options-section]");

    if (!container || !hiddenInput || !addBtn) {
      return;
    }

    function toggleOptionsBlock() {
      const type = typeSelect?.value ?? "product";
      const show = type === "product" || type === "skill" || type === "worker";
      if (optionsBlock) {
        optionsBlock.hidden = !show;
      }
      if (optionsSection) {
        optionsSection.hidden = !show;
      }
    }

    addBtn.addEventListener("click", () => {
      container.appendChild(createFormRow());
    });

    if (typeSelect) {
      typeSelect.addEventListener("change", toggleOptionsBlock);
      toggleOptionsBlock();
    }

    const initial = parseOptions(hiddenInput.value);
    if (initial.length > 0) {
      initial.forEach(() => container.appendChild(createFormRow()));
      const rows = container.querySelectorAll("[data-option-row]");
      initial.forEach((opt, i) => {
        const row = rows[i];
        if (!row) {
          return;
        }
        row.querySelector("[data-option-title]").value = opt.title;
        row.querySelector("[data-option-desc]").value = opt.desc;
        row.querySelector("[data-option-price]").value = String(opt.price);
      });
    } else {
      container.appendChild(createFormRow());
    }

    formEl.addEventListener("submit", (event) => {
      const type = typeSelect?.value ?? "product";
      if (type === "job") {
        hiddenInput.value = "[]";
        return;
      }
      const options = syncFormHiddenInput(container, hiddenInput);
      if (options.length === 0) {
        hiddenInput.value = "[]";
      }
    });

    formEl.addEventListener("input", () => {
      if (typeSelect?.value === "job") {
        return;
      }
      syncFormHiddenInput(container, hiddenInput);
    });
  }

  global.TasuListingOptions = {
    parseOptions,
    formatYen,
    initDetail,
    initForm,
    createOptionCard,
    ensurePaidOptionsShell,
    DEFAULT_SKILL_DETAIL_OPTIONS,
  };
})(typeof window !== "undefined" ? window : globalThis);
