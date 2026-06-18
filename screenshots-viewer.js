/**
 * Screenshots QA Center — manifest 駆動の確認ビューア
 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);

  let manifest = null;
  let allImages = [];
  let flatList = [];
  let lightboxIndex = -1;

  let filterMode = params.get("mode") || "registered";
  let categoryFilter = params.get("category") || "";
  let diffMode = params.get("diff") === "1";
  let latestMode = params.get("latest") === "1";
  let searchQuery = params.get("search") || "";

  /** manifest.qa.flowSearch があれば優先（scripts/lib/screenshots-qa.mjs と同期） */
  const DEFAULT_FLOW_SEARCH = [
    {
      aliases: ["問い合わせ", "inquiry", "お問い合わせ", "問い合わせ文", "talk-draft"],
      paths: [
        "screenshots/ai-workspace-action/inquiry-generated.png",
        "screenshots/ai-workspace-action/talk-draft-card.png",
        "screenshots/ai-workspace-action/chat-input-prefilled.png",
      ],
      stems: ["inquiry-generated", "talk-draft-card", "chat-input-prefilled"],
    },
  ];

  function getFlowSearch() {
    const fromManifest = manifest?.qa?.flowSearch;
    if (Array.isArray(fromManifest) && fromManifest.length) {
      return fromManifest.map((flow) => ({
        aliases: flow.aliases || [],
        paths: flow.paths || [],
        stems: flow.stems || [],
      }));
    }
    return DEFAULT_FLOW_SEARCH;
  }

  const QUICK_TAG_QUERIES = {
    "AI Workspace": "AI Workspace",
    Builder: "Builder",
    Talk: "Talk",
    Connect: "Connect",
    通知: "通知",
    求人: "求人",
    一般案件: "一般案件",
    問い合わせ: "問い合わせ",
  };

  const app = document.getElementById("app");
  const status = document.getElementById("status");
  const categoryNav = document.getElementById("category-nav");
  const searchInput = document.getElementById("search-input");
  const quickTags = document.getElementById("quick-tags");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCurrentImg = document.getElementById("lb-current-img");
  const lbPrevImg = document.getElementById("lb-prev-img");
  const lbDiff = document.getElementById("lb-diff");
  const lbName = document.getElementById("lb-name");
  const btnDiff = document.getElementById("btn-diff");

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayTitle(img) {
    return img.title || img.stem || img.name;
  }

  function normalizeSearchText(value) {
    return String(value ?? "")
      .toLowerCase()
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatch(text, query) {
    const raw = String(text ?? "");
    if (!raw || !String(query || "").trim()) return escapeHtml(raw);

    const terms = normalizeSearchText(query).split(/\s+/).filter((t) => t.length > 0);
    if (!terms.length) return escapeHtml(raw);

    let parts = [{ text: raw, hit: false }];
    for (const term of terms) {
      const next = [];
      const re = new RegExp(`(${escapeRegExp(term)})`, "gi");
      for (const part of parts) {
        if (part.hit) {
          next.push(part);
          continue;
        }
        const chunks = part.text.split(re);
        for (let i = 0; i < chunks.length; i += 1) {
          if (!chunks[i]) continue;
          const isHit = i % 2 === 1;
          next.push({ text: chunks[i], hit: isHit });
        }
      }
      parts = next;
    }

    return parts
      .map((part) =>
        part.hit
          ? `<mark class="search-hit">${escapeHtml(part.text)}</mark>`
          : escapeHtml(part.text)
      )
      .join("");
  }

  function imageSearchHaystack(img) {
    return [
      displayTitle(img),
      img.description,
      img.category,
      img.categoryId,
      img.sourceUrl,
      img.report,
      img.name,
      img.path,
      img.stem,
      img.folder,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function looksLikeFilenameQuery(query) {
    const raw = String(query || "").trim();
    if (/\.(png|jpe?g|webp|gif)$/i.test(raw)) return true;
    const base = raw.replace(/\.(png|jpe?g|webp|gif)$/i, "");
    return /^[\w.-]+$/.test(base) && base.includes(".") === false && /[-_]/.test(base);
  }

  function matchesFilenameQuery(img, query) {
    const q = normalizeSearchText(query);
    const name = normalizeSearchText(img.name);
    const stem = normalizeSearchText(img.stem);
    const path = normalizeSearchText(img.path);
    const qStem = q.replace(/\.(png|jpe?g|webp|gif)$/, "");
    if (name === q || stem === q || stem === qStem) return true;
    if (path.endsWith(`/${q}`) || path.endsWith(q)) return true;
    return false;
  }

  function resolveFlowSearch(query) {
    const q = normalizeSearchText(query);
    if (!q) return null;
    for (const flow of getFlowSearch()) {
      if (flow.aliases.some((alias) => q === normalizeSearchText(alias))) {
        return flow;
      }
    }
    return null;
  }

  const SEARCH_SYNONYMS = {
    通知: ["notify", "通知", "notif"],
    求人: ["求人", "job", "応募", "job-apply"],
    一般案件: ["builder", "mvp", "案件", "thread", "board-thread"],
  };

  function expandSearchTerms(query) {
    const q = normalizeSearchText(query);
    const terms = q.split(/\s+/).filter(Boolean);
    const extra = [];
    for (const [key, syns] of Object.entries(SEARCH_SYNONYMS)) {
      const nk = normalizeSearchText(key);
      if (q === nk || q.includes(nk) || terms.includes(nk)) {
        extra.push(...syns.map(normalizeSearchText));
      }
    }
    return [...new Set([...terms, ...extra])];
  }

  function resolveCategoryOnlySearch(query) {
    const q = normalizeSearchText(query);
    if (q === "ai workspace" || q === "ai-workspace") return "ai-workspace";
    if (q === "builder" || q === "一般案件") return "builder";
    if (q === "talk") return "talk";
    if (q === "connect") return "connect";
    if (q === "notify" || q === "通知") return "notify";
    if (q === "ai top" || q === "ai-top") return "ai-top";
    return "";
  }

  function matchesSearch(img, query) {
    const q = normalizeSearchText(query);
    if (!q) return true;

    const flow = resolveFlowSearch(query);
    if (flow) {
      return (
        flow.paths.includes(img.path) ||
        flow.stems.some(
          (stem) =>
            String(img.name || "").includes(stem) ||
            String(img.stem || "").includes(stem) ||
            String(img.path || "").includes(stem)
        )
      );
    }

    if (looksLikeFilenameQuery(query)) {
      return matchesFilenameQuery(img, query);
    }

    const categoryOnly = resolveCategoryOnlySearch(query);
    if (categoryOnly) return img.categoryId === categoryOnly;

    const hay = normalizeSearchText(imageSearchHaystack(img));
    const terms = expandSearchTerms(query);
    return terms.every((term) => hay.includes(term));
  }

  function isSearchActive() {
    return Boolean(String(searchQuery || "").trim());
  }

  function qaBadge(status) {
    const s = String(status || "unknown").toLowerCase();
    if (s === "pass") return '<span class="badge badge--pass">PASS</span>';
    if (s === "fail") return '<span class="badge badge--fail">FAIL</span>';
    return '<span class="badge badge--unknown">—</span>';
  }

  function deviceBadge(device) {
    if (device === "pc") return '<span class="badge badge--pc">PC</span>';
    if (device === "sp") return '<span class="badge badge--sp">SP</span>';
    return "";
  }

  function filterLatestBatch(images) {
    if (!images.length) return images;
    const sorted = [...images].sort((a, b) => b.mtime - a.mtime);
    const newest = sorted[0].mtime;
    const windowMs = 3 * 60 * 1000;
    const batch = sorted.filter((img) => newest - img.mtime <= windowMs);
    return batch.length ? batch : sorted.slice(0, Math.min(20, sorted.length));
  }

  function selectImages() {
    let pool = [...allImages];

    if (filterMode === "unregistered") {
      const paths = new Set((manifest?.qa?.unregistered || []).map((r) => r.path));
      pool = pool.filter((img) => paths.has(img.path));
    } else if (filterMode === "registered") {
      pool = pool.filter((img) => img.registered);
    } else if (filterMode === "category" && categoryFilter) {
      pool = pool.filter((img) => img.categoryId === categoryFilter);
    }

    if (categoryFilter && filterMode !== "category" && filterMode !== "unregistered") {
      pool = pool.filter((img) => img.categoryId === categoryFilter);
    }

    if (latestMode) pool = filterLatestBatch(pool);

    if (isSearchActive()) {
      pool = pool.filter((img) => matchesSearch(img, searchQuery));
    }

    return pool.sort((a, b) => {
      if (a.registered !== b.registered) return a.registered ? -1 : 1;
      const ao = a.displayOrder;
      const bo = b.displayOrder;
      if (ao != null && bo != null && ao !== bo) return ao - bo;
      if (ao != null && bo == null) return -1;
      if (ao == null && bo != null) return 1;
      return b.mtime - a.mtime;
    });
  }

  function renderCategoryNav() {
    if (!categoryNav || !manifest?.qa?.categories) return;

    const cats = manifest.qa.categories;
    const registeredTotal = allImages.filter((i) => i.registered).length;
    const unreg = manifest.unregisteredCount || 0;

    const items = [
      {
        id: "",
        label: `QA登録済み (${registeredTotal})`,
        mode: "registered",
        active: filterMode === "registered" && !categoryFilter && !latestMode,
      },
      ...cats
        .filter((c) => c.id !== "other" || c.total > 0)
        .map((c) => ({
          id: c.id,
          label: `${c.label} (${c.registered}/${c.total})`,
          mode: "category",
          active: categoryFilter === c.id && filterMode !== "unregistered",
        })),
      {
        id: "unregistered",
        label: `未登録 ⚠ (${unreg})`,
        mode: "unregistered",
        active: filterMode === "unregistered",
        warn: unreg > 0,
      },
    ];

    categoryNav.innerHTML = items
      .map((item) => {
        const cls = [
          "cat-pill",
          item.active ? "is-active" : "",
          item.warn ? "is-warn" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" class="${cls}" data-cat="${escapeHtml(item.id)}" data-mode="${escapeHtml(item.mode)}">${escapeHtml(item.label)}</button>`;
      })
      .join("");

    categoryNav.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        const cat = btn.dataset.cat || "";
        filterMode = mode === "unregistered" ? "unregistered" : mode === "registered" ? "registered" : "category";
        categoryFilter = mode === "category" ? cat : mode === "registered" && cat ? cat : "";
        if (mode === "registered" && !cat) categoryFilter = "";
        latestMode = false;
        syncUrl();
        render();
      });
    });
  }

  function renderMetaLinks(img) {
    const q = searchQuery;
    const bits = [];
    if (img.report) {
      const label = img.report.replace(/^reports\//, "");
      bits.push(
        `<a class="shot-link" href="${escapeHtml(img.report)}" target="_blank" rel="noopener">📄 ${highlightMatch(label, q)}</a>`
      );
    }
    if (img.sourceUrl) {
      bits.push(
        `<a class="shot-link" href="${escapeHtml(img.sourceUrl)}" target="_blank" rel="noopener">🔗 ${highlightMatch(img.sourceUrl, q)}</a>`
      );
    }
    return bits.length ? `<div class="shot-links">${bits.join("")}</div>` : "";
  }

  function renderDiffBlock(img) {
    if (!diffMode || !img.hasDiff || !img.previousPath) return "";
    return `
      <div class="diff-compare" data-diff>
        <div class="diff-col">
          <span class="diff-label">前回</span>
          <img src="${escapeHtml(img.previousPath)}" alt="前回" loading="lazy">
        </div>
        <div class="diff-col">
          <span class="diff-label">今回</span>
          <img src="${escapeHtml(img.path)}" alt="今回" loading="lazy">
        </div>
      </div>`;
  }

  function renderCard(img, index) {
    const q = searchQuery;
    const title = highlightMatch(displayTitle(img), q);
    const desc = img.description
      ? `<p class="shot-desc">${highlightMatch(img.description, q)}</p>`
      : "";
    const warn = img.registered
      ? ""
      : '<span class="badge badge--warn">未登録</span>';
    const diffBadge = img.hasDiff
      ? '<span class="badge badge--diff">差分あり</span>'
      : "";

    const imageBlock = diffMode && img.hasDiff && img.previousPath
      ? renderDiffBlock(img)
      : `<div class="shot-card__thumb"><img src="${escapeHtml(img.path)}" alt="${escapeHtml(displayTitle(img))}" loading="lazy"></div>`;

    return `
      <article class="shot-card${img.registered ? "" : " shot-card--unregistered"}" data-index="${index}" tabindex="0">
        ${imageBlock}
        <div class="shot-meta">
          <p class="shot-title">${qaBadge(img.qaStatus)}${deviceBadge(img.device)}${warn}${diffBadge}${title}</p>
          ${desc}
          <div class="shot-time" title="${escapeHtml(img.mtimeIso || "")}">📅 ${escapeHtml(img.mtimeLabel || "")}</div>
          ${renderMetaLinks(img)}
          <div class="shot-name">${highlightMatch(img.path, q)}</div>
        </div>
      </article>`;
  }

  function renderUnregisteredWarning() {
    const list = manifest?.qa?.unregistered || [];
    const missing = manifest?.qa?.missingCanonical || [];
    const total = (manifest?.unregisteredCount ?? list.length + missing.length) || 0;
    if (!total || filterMode === "unregistered") return "";

    const show = list.slice(0, 12);
    const more = list.length - show.length;
    const missingLines = missing
      .slice(0, 6)
      .map((p) => `<li><code>${escapeHtml(p)}</code> <span class="muted">（ファイル未生成）</span></li>`)
      .join("");
    return `
      <section class="warn-panel" id="warn-unregistered">
        <h2 class="warn-panel__title">⚠ 重要未登録 (${total} 件)</h2>
        <p class="warn-panel__sub">canonical checklist（<code>scripts/lib/screenshots-qa.mjs</code>）に対する未登録・未生成です。古い検証スクショ ${manifest?.ignoredCount ?? 0} 件はアーカイブ済みで警告しません。未登録 ⚠ が 1 以上のときは完了扱いにしません（<a href="docs/screenshots-qa-rules.md">検証ルール</a>）。</p>
        <ul class="warn-list">
          ${show
            .map(
              (row) =>
                `<li><code>${escapeHtml(row.path)}</code> <span class="muted">${escapeHtml(row.mtimeLabel || "")}</span></li>`
            )
            .join("")}
          ${missingLines}
          ${more > 0 ? `<li class="muted">…他 ${more} 件 — <button type="button" class="linkish" data-show-unregistered>すべて表示</button></li>` : ""}
        </ul>
      </section>`;
  }

  function groupImages(images) {
    const byLabel = new Map();
    for (const img of images) {
      const label = img.category || img.folder;
      if (!byLabel.has(label)) byLabel.set(label, new Map());
      const stems = byLabel.get(label);
      const key = displayTitle(img);
      if (!stems.has(key)) stems.set(key, []);
      stems.get(key).push(img);
    }
    return byLabel;
  }

  function sortDevice(a, b) {
    const order = { pc: 0, sp: 1, other: 2 };
    return (order[a.device] ?? 9) - (order[b.device] ?? 9);
  }

  function render() {
    const shown = selectImages();
    flatList = shown;

    renderCategoryNav();
    syncSearchUi();
    if (btnDiff) btnDiff.classList.toggle("is-active", diffMode);
    document.getElementById("btn-qa")?.classList.toggle(
      "is-active",
      filterMode === "registered" && !latestMode && !categoryFilter
    );
    document.getElementById("btn-latest")?.classList.toggle("is-active", latestMode);

  const missingCanonical = manifest?.qa?.missingCanonical || [];

    if (!shown.length && filterMode === "unregistered" && missingCanonical.length) {
      app.innerHTML = `
        <section class="warn-panel">
          <h2 class="warn-panel__title">未登録 canonical (${missingCanonical.length} 件)</h2>
          <p class="warn-panel__sub">QA checklist に登録予定ですが、ファイルがまだありません。</p>
          <ul class="warn-list">${missingCanonical.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join("")}</ul>
        </section>`;
      status.textContent = `未登録 ${missingCanonical.length} 件（ファイル未生成）`;
      return;
    }

    if (!shown.length) {
      const searchHint = isSearchActive()
        ? `<p class="empty">「${escapeHtml(searchQuery)}」に一致するスクショがありません。</p>`
        : '<p class="empty">表示対象のスクショがありません。<br><code>node scripts/open-latest-screenshots.mjs</code> で manifest を更新してください。</p>';
      app.innerHTML = searchHint;
      status.textContent = isSearchActive() ? `検索結果: 0件` : "0 件";
      return;
    }

    const grouped = groupImages(shown);
    let html = isSearchActive() ? "" : renderUnregisteredWarning();

    if (isSearchActive()) {
      html += `<p class="group-search-banner">検索: <strong>${escapeHtml(searchQuery)}</strong> — 合計 ${shown.length} 件</p>`;
    }

    const inquiryFlow = resolveFlowSearch(searchQuery);
    const showInquiryFlow =
      (inquiryFlow ||
        (categoryFilter === "ai-workspace" &&
          ["inquiry-generated.png", "talk-draft-card.png", "chat-input-prefilled.png"].every((name) =>
            shown.some((img) => String(img.name || "").endsWith(name))
          ))) &&
      shown.some((img) => img.flowGroup === "inquiry-to-talk");

    for (const [label, stems] of grouped) {
      let groupCount = 0;
      for (const [, items] of stems) groupCount += items.length;
      const countLabel = isSearchActive()
        ? `<span class="group-count">検索結果: ${groupCount}件</span>`
        : "";
      html += `<section class="group"><h2 class="group-title">${escapeHtml(label)}${countLabel}</h2>`;
      let flowHeaderShown = false;
      for (const [, items] of stems) {
        const sorted = [...items].sort(sortDevice);
        const isFlowStart =
          showInquiryFlow &&
          !flowHeaderShown &&
          sorted.some((img) => img.flowGroup === "inquiry-to-talk");
        if (isFlowStart) {
          flowHeaderShown = true;
          html += `
            <div class="flow-block" data-inquiry-flow>
              <h3 class="flow-block__title">問い合わせ生成 → TALK下書き → 入力欄反映</h3>
              <p class="flow-block__sub">
                <a class="shot-link" href="reports/ai-workspace-inquiry-to-talk.md" target="_blank" rel="noopener">📄 reports/ai-workspace-inquiry-to-talk.md</a>
              </p>
            </div>`;
        }
        html += `<div class="pair-block"><div class="device-row">`;
        for (const img of sorted) {
          html += renderCard(img, flatList.indexOf(img));
        }
        html += "</div></div>";
      }
      html += "</section>";
    }

    app.innerHTML = html;

    const pass = shown.filter((i) => i.qaStatus === "pass").length;
    const fail = shown.filter((i) => i.qaStatus === "fail").length;
    const modeLabel =
      filterMode === "unregistered"
        ? "未登録"
        : categoryFilter
          ? manifest?.qa?.categories?.find((c) => c.id === categoryFilter)?.label || categoryFilter
          : latestMode
            ? "最新バッチ"
            : "QA登録済み";
    const ignored = manifest?.ignoredCount ?? 0;
    const qaTotal = manifest?.qaRelevantCount ?? allImages.length;
    const searchLabel = isSearchActive() ? `検索「${searchQuery}」${shown.length}件 · ` : "";
    status.textContent = `${searchLabel}${shown.length} 件 · PASS ${pass} / FAIL ${fail} · ${modeLabel} · QA対象 ${qaTotal} / アーカイブ ${ignored}`;

    app.querySelectorAll(".shot-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        openLightbox(Number(card.dataset.index));
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(Number(card.dataset.index));
        }
      });
    });

    document.querySelector("[data-show-unregistered]")?.addEventListener("click", () => {
      filterMode = "unregistered";
      categoryFilter = "";
      syncUrl();
      render();
    });
  }

  async function loadManifest() {
    status.textContent = "読み込み中…";
    const res = await fetch(`screenshots/manifest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("manifest not found");
    manifest = await res.json();
    allImages = [...(manifest.images || [])];
    render();
  }

  function openLightbox(index) {
    if (index < 0 || index >= flatList.length) return;
    lightboxIndex = index;
    const img = flatList[index];
    const showDiff = diffMode && img.hasDiff && img.previousPath;
    if (lbDiff) lbDiff.hidden = !showDiff;
    if (lbImg) lbImg.hidden = showDiff;
    if (showDiff) {
      if (lbPrevImg) {
        lbPrevImg.src = img.previousPath;
        lbPrevImg.alt = `前回 ${img.name}`;
      }
      if (lbCurrentImg) {
        lbCurrentImg.src = img.path;
        lbCurrentImg.alt = img.name;
      }
    } else if (lbImg) {
      lbImg.src = img.path;
      lbImg.alt = img.name;
    }

    lbName.textContent = `${displayTitle(img)} · ${img.qaStatus?.toUpperCase() || "—"} · ${img.mtimeLabel}`;
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    lightboxIndex = -1;
  }

  function stepLightbox(delta) {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + delta + flatList.length) % flatList.length;
    openLightbox(next);
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.delete("latest");
    url.searchParams.delete("category");
    url.searchParams.delete("diff");
    url.searchParams.delete("mode");
    url.searchParams.delete("search");
    if (latestMode) url.searchParams.set("latest", "1");
    if (categoryFilter) url.searchParams.set("category", categoryFilter);
    if (filterMode === "unregistered") url.searchParams.set("mode", "unregistered");
    if (diffMode) url.searchParams.set("diff", "1");
    if (isSearchActive()) url.searchParams.set("search", searchQuery.trim());
    history.replaceState(null, "", url);
  }

  function syncSearchUi() {
    if (searchInput && searchInput.value !== searchQuery) {
      searchInput.value = searchQuery;
    }
    quickTags?.querySelectorAll(".quick-tag").forEach((btn) => {
      const q = btn.getAttribute("data-search") || "";
      const active =
        normalizeSearchText(searchQuery) === normalizeSearchText(q) ||
        normalizeSearchText(searchQuery) === normalizeSearchText(QUICK_TAG_QUERIES[q] || q);
      btn.classList.toggle("is-active", active && isSearchActive());
    });
  }

  function setSearchQuery(value) {
    searchQuery = String(value ?? "");
    if (searchInput) searchInput.value = searchQuery;
    syncUrl();
    render();
  }

  function showError(err) {
    app.innerHTML = `<p class="empty">manifest の読み込みに失敗しました。<br><code>node scripts/open-latest-screenshots.mjs</code> を実行してください。<br><small>${escapeHtml(err.message)}</small></p>`;
    status.textContent = "エラー";
  }

  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value;
    syncUrl();
    render();
  });
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchQuery = "";
      searchInput.value = "";
      syncUrl();
      render();
    }
  });
  quickTags?.querySelectorAll(".quick-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-search") || "";
      setSearchQuery(QUICK_TAG_QUERIES[q] || q);
    });
  });

  document.getElementById("btn-refresh")?.addEventListener("click", () => loadManifest().catch(showError));
  document.getElementById("btn-latest")?.addEventListener("click", () => {
    latestMode = true;
    filterMode = "registered";
    categoryFilter = "";
    syncUrl();
    render();
  });
  document.getElementById("btn-qa")?.addEventListener("click", () => {
    latestMode = false;
    filterMode = "registered";
    categoryFilter = "";
    syncUrl();
    render();
  });
  btnDiff?.addEventListener("click", () => {
    diffMode = !diffMode;
    syncUrl();
    render();
  });
  document.getElementById("lb-close")?.addEventListener("click", closeLightbox);
  document.getElementById("lb-prev")?.addEventListener("click", () => stepLightbox(-1));
  document.getElementById("lb-next")?.addEventListener("click", () => stepLightbox(1));
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.id === "lb-stage") closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox?.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  if (params.get("search")) {
    searchQuery = params.get("search");
    if (searchInput) searchInput.value = searchQuery;
  }

  if (params.get("mode") === "unregistered") filterMode = "unregistered";
  if (params.get("category") === "ai-workspace") {
    filterMode = "registered";
    categoryFilter = "ai-workspace";
  } else if (params.get("category")) {
    categoryFilter = params.get("category");
    filterMode = "category";
  }

  loadManifest().catch(showError);
})();
