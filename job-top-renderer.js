/**
 * 求人専用TOP — 高密度テーブル / モバイルカード描画
 */
(function () {
  "use strict";

  const AVATAR_COLORS = [
    { bg: "#c45c26", fg: "#fff" },
    { bg: "#2d6a9f", fg: "#fff" },
    { bg: "#5a7d4a", fg: "#fff" },
    { bg: "#7b5ea7", fg: "#fff" },
    { bg: "#967622", fg: "#fff" },
    { bg: "#3d7a7a", fg: "#fff" },
  ];

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function resolvePublicListPaths() {
    const page = String(document.body?.dataset?.page || "");
    if (page === "public-board") {
      return { detail: "public-board-detail.html", apply: "public-board-detail.html" };
    }
    if (page === "public-jobs") {
      return { detail: "public-job-detail.html", apply: "public-job-detail.html" };
    }
    if (page === "public-projects") {
      return { detail: "public-project-detail.html", apply: "public-project-detail.html" };
    }
    return { detail: "detail-job.html", apply: "detail-job.html" };
  }

  function detailUrl(id, boardType) {
    const base = resolvePublicListPaths().detail;
    const type = String(boardType || "").trim();
    const typeQuery = type ? `&type=${encodeURIComponent(type)}` : "";
    return `${base}?id=${encodeURIComponent(id || "")}${typeQuery}`;
  }

  function applyUrl(id, boardType) {
    return `${detailUrl(id, boardType)}#apply`;
  }

  function isPublicBoardPage() {
    return document.body?.dataset?.page === "public-board";
  }

  function isPublicProjectsPage() {
    return document.body?.dataset?.page === "public-projects";
  }

  function shouldHideFavorite(item) {
    if (isPublicProjectsPage()) return true;
    if (isPublicBoardPage() && item?.boardType === "project") return true;
    return false;
  }

  function buildTypeBadgeHtml(item) {
    if (!isPublicBoardPage()) return "";
    const isProject = item.boardType === "project";
    const mod = isProject ? "project" : "job";
    const label = isProject ? "案件" : "求人";
    return `<span class="job-board-type-badge job-board-type-badge--${mod}">${escapeHtml(label)}</span>`;
  }

  function initials(text) {
    const s = String(text || "").trim();
    if (!s) return "JO";
    const cleaned = s.replace(/株式会社|有限会社|合同会社/g, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (cleaned.length >= 2) return cleaned.slice(0, 2);
    return cleaned.slice(0, 1).toUpperCase();
  }

  function avatarStyle(item) {
    const idx =
      Math.abs(
        String(item.companyName || item.id || "")
          .split("")
          .reduce((a, c) => a + c.charCodeAt(0), 0)
      ) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
  }

  function resolveCompanyThumbnail(url) {
    const raw = String(url || "").trim();
    if (!raw || /placehold\.co/i.test(raw)) return "";
    return raw;
  }

  function buildCompanyAvatarHtml(options = {}) {
    const companyName = options.companyName || options.title || "";
    const alt = escapeAttr(options.alt || companyName || "企業");
    const ini = escapeHtml(options.initials || initials(companyName));
    const sizeClass = options.sizeClass ? ` ${options.sizeClass.trim()}` : "";
    const thumbnail = resolveCompanyThumbnail(options.thumbnail);

    if (thumbnail) {
      return `<span class="job-list-avatar job-list-avatar--img job-company-avatar${sizeClass}">
        <img src="${escapeAttr(thumbnail)}" alt="${alt}" loading="lazy" decoding="async" class="job-list-avatar__img">
      </span>`;
    }

    return `<span class="job-list-avatar job-company-avatar${sizeClass}" aria-hidden="true">${ini}</span>`;
  }

  function buildAvatarHtml(item) {
    return buildCompanyAvatarHtml({
      companyName: item.companyName,
      title: item.title,
      thumbnail: item.thumbnail,
      initials: item.avatarInitials,
    });
  }

  function mountRelatedJobCardIconMedia(media, title) {
    media.classList.add("job-detail-related-card__media--icon");
    media.setAttribute("aria-hidden", "true");
    media.innerHTML = buildCompanyAvatarHtml({
      companyName: title,
      title,
      sizeClass: "job-detail-related-card__icon",
    });
  }

  function buildRelatedJobCardMediaElement(item) {
    const title = item.title || "求人";
    const media = document.createElement("div");
    media.className = "job-detail-related-card__media";
    const thumb = resolveCompanyThumbnail(item.thumbnail);

    if (!thumb) {
      mountRelatedJobCardIconMedia(media, title);
      return media;
    }

    const img = document.createElement("img");
    img.src = thumb;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "job-detail-related-card__thumb";
    img.addEventListener(
      "error",
      function onThumbError() {
        img.removeEventListener("error", onThumbError);
        media.innerHTML = "";
        mountRelatedJobCardIconMedia(media, title);
      },
      { once: true }
    );
    media.appendChild(img);
    return media;
  }

  function buildRelatedJobCardElement(item) {
    const article = document.createElement("article");
    article.className = "job-detail-related-card";
    const link = document.createElement("a");
    link.className = "job-detail-related-card__link";
    link.href = detailUrl(item.id);
    link.appendChild(buildRelatedJobCardMediaElement(item));

    const copy = document.createElement("div");
    copy.className = "job-detail-related-card__copy";
    const locationLine = [item.location, item.workStyle]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .filter((part, index, list) => list.indexOf(part) === index)
      .join(" / ");
    const employmentLine = String(item.employmentType || "").trim();
    const tags = (item.featureTags || []).filter(Boolean).slice(0, 3);
    const tagsHtml = tags.length
      ? `<div class="job-detail-related-card__tags">${tags
          .map((tag) => `<span class="job-detail-related-card__tag">${escapeHtml(tag)}</span>`)
          .join("")}</div>`
      : "";
    copy.innerHTML = `
      <h3 class="job-detail-related-card__title">${escapeHtml(item.title || "求人")}</h3>
      <p class="job-detail-related-card__salary">${escapeHtml(item.salaryDisplay || "応相談")}</p>
      <p class="job-detail-related-card__location">${escapeHtml(locationLine || item.location || "—")}</p>
      ${
        employmentLine
          ? `<p class="job-detail-related-card__employment">${escapeHtml(employmentLine)}</p>`
          : ""
      }
      ${tagsHtml}`;
    link.appendChild(copy);

    const arrow = document.createElement("span");
    arrow.className = "job-detail-related-card__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
    link.appendChild(arrow);
    article.appendChild(link);
    return article;
  }

  const EMPLOYMENT_TAG_LABELS = new Set([
    "正社員",
    "契約社員",
    "業務委託",
    "アルバイト",
    "パート",
    "派遣",
    "短期",
    "単発",
    "インターン",
    "その他",
    "アルバイト・パート",
    "パート・アルバイト",
  ]);

  function isEmploymentTag(label) {
    const s = String(label || "").trim();
    if (EMPLOYMENT_TAG_LABELS.has(s)) return true;
    return /アルバイト|パート|業務委託|正社員|契約|派遣|インターン|単発|短期/.test(s);
  }

  function buildTagsHtml(tags, maxVisible) {
    const list = (tags || []).filter(Boolean);
    const max = maxVisible == null ? 3 : maxVisible;
    if (!list.length) return "";

    const visible = list.slice(0, max);
    const extra = list.length - max;
    const chips = visible
      .map((t) => {
        const urgent = /急募/.test(t);
        const qual = /資格/.test(t);
        const emp = isEmploymentTag(t);
        let mod = "";
        if (urgent) mod = " job-tag--urgent";
        else if (qual) mod = " job-tag--qual";
        else if (emp) mod = " job-tag--employment";
        return `<span class="job-tag${mod}">${escapeHtml(t)}</span>`;
      })
      .join("");

    const more =
      extra > 0 ? `<span class="job-tag job-tag--more">+${extra}</span>` : "";

    return `<div class="job-list-row__tags">${chips}${more}</div>`;
  }

  function statusHtml(item) {
    const key = item.statusKey || "open";
    const label = item.statusLabel || "募集中";
    return `<span class="job-list-status job-list-status--${escapeHtml(key)}">${escapeHtml(label)}</span>`;
  }

  function collectRowTags(item) {
    const merged = [];
    if (item.employmentDisplayLabel) merged.push(item.employmentDisplayLabel);
    (item.featureTags || []).forEach((t) => {
      if (t && t !== item.employmentDisplayLabel) merged.push(t);
    });
    if (item.statusKey === "urgent" && !merged.includes("急募")) merged.unshift("急募");
    const unique = [];
    merged.forEach((t) => {
      if (t && t !== item.statusLabel && !unique.includes(t)) unique.push(t);
    });
    return unique;
  }

  function buildMainCellHtml(item) {
    return `
      <div class="job-list-row__main">
        ${buildAvatarHtml(item)}
        <div class="job-list-row__copy">
          <p class="company-name">${buildTypeBadgeHtml(item)}${escapeHtml(item.companyName || "—")}</p>
          <h2 class="job-title"><a href="${escapeAttr(detailUrl(item.id, item.boardType))}">${escapeHtml(item.title)}</a></h2>
          <div class="job-list-row__meta-badges">
            ${buildTagsHtml(collectRowTags(item), 3)}
          </div>
        </div>
      </div>`;
  }

  function buildAreaHtml(item) {
    const text =
      item.areaPref ||
      item.location ||
      [item.areaCity, item.areaStation].filter(Boolean).join(" ") ||
      "—";
    return `<div class="job-area-text">${escapeHtml(text)}</div>`;
  }

  function buildPeriodHtml(item) {
    return `<div class="job-period-text">${escapeHtml(item.periodLabel || "—")}</div>`;
  }

  function buildSalaryHtml(item) {
    const amount = escapeHtml(item.salaryDisplay || "応相談");
    const type = item.salaryTypeLabel
      ? `<span class="job-salary-type">${escapeHtml(item.salaryTypeLabel)}</span>`
      : "";
    return `<div class="job-salary">${type}<span class="job-salary-amount">${amount}</span></div>`;
  }

  function buildDeadlineHtml(item) {
    return `<div class="job-deadline-cell">
      ${statusHtml(item)}
      <div class="job-deadline-text">${escapeHtml(item.deadlineLabel || "随時")}</div>
    </div>`;
  }

  function buildDateHtml(item) {
    const primary = item.updatedRelative || item.updatedLabel || "—";
    const secondary =
      item.updatedRelative && item.updatedLabel
        ? `<div class="job-date-sub">${escapeHtml(item.updatedLabel)}</div>`
        : "";
    return `<div class="job-date-cell">
      <div class="job-date-main">${escapeHtml(primary)}</div>
      ${secondary}
    </div>`;
  }

  function buildActionsHtml(item) {
    const id = item.id;
    const favBtn = shouldHideFavorite(item)
      ? ""
      : `<button type="button" class="job-favorite-btn" data-favorite-button data-favorite-icon-only="1" data-target-type="job" data-target-id="${escapeAttr(id)}" aria-label="お気に入り"><span class="tasu-favorite-btn__icon" aria-hidden="true">♡</span></button>`;
    return `<div class="job-actions">
      <a class="job-detail-btn" href="${escapeAttr(detailUrl(id, item.boardType))}">詳細を見る</a>
      <a class="job-apply-btn" href="${escapeAttr(applyUrl(id, item.boardType))}">応募する</a>
      ${favBtn}
    </div>`;
  }

  function buildTableRowElement(item) {
    const row = document.createElement("div");
    row.className = `job-list-row job-table-row${
      item.isSpotlight ? " job-list-row--spotlight" : ""
    }`;
    row.setAttribute("role", "row");
    row.dataset.jobRow = item.id;
    row.dataset.favoriteRow = "";

    row.innerHTML = `
      <div class="job-table-cell job-table-cell--main">${buildMainCellHtml(item)}</div>
      <div class="job-table-cell job-table-cell--industry"><span class="job-industry-text">${escapeHtml(item.industryLabel || "—")}</span></div>
      <div class="job-table-cell job-table-cell--area">${buildAreaHtml(item)}</div>
      <div class="job-table-cell job-table-cell--salary">${buildSalaryHtml(item)}</div>
      <div class="job-table-cell job-table-cell--period">${buildPeriodHtml(item)}</div>
      <div class="job-table-cell job-table-cell--deadline">${buildDeadlineHtml(item)}</div>
      <div class="job-table-cell job-table-cell--date">${buildDateHtml(item)}</div>
      <div class="job-table-cell job-table-cell--actions job-action-cell">${buildActionsHtml(item)}</div>
    `;

    return row;
  }

  function buildPrCardElement(item) {
    const article = document.createElement("article");
    article.className = "job-top-pr-card";
    article.dataset.favoriteRow = "";
    article.dataset.jobPrCard = item.id;

    article.innerHTML = `
      <span class="job-top-pr-card__badge">PR</span>
      <div class="job-top-pr-card__top">
        ${buildAvatarHtml(item)}
        <div class="job-top-pr-card__copy">
          <h3 class="job-top-pr-card__title"><a href="${escapeAttr(detailUrl(item.id, item.boardType))}">${escapeHtml(item.title)}</a></h3>
          <p class="job-top-pr-card__company">${escapeHtml(item.companyName || "—")}</p>
        </div>
      </div>
      <dl class="job-top-pr-card__meta">
        <div><dt>業種</dt><dd>${escapeHtml(item.industryLabel || "—")}</dd></div>
        <div><dt>予算/単価</dt><dd class="job-salary">${escapeHtml(item.salaryDisplay || "応相談")}</dd></div>
        <div><dt>募集状況</dt><dd>${statusHtml(item)}</dd></div>
      </dl>
      <div class="job-top-pr-card__actions job-actions">
        <a class="job-detail-btn" href="${escapeAttr(detailUrl(item.id, item.boardType))}">詳細を見る</a>
        <a class="job-apply-btn" href="${escapeAttr(applyUrl(item.id, item.boardType))}">応募する</a>
        ${shouldHideFavorite(item) ? "" : `<button type="button" class="job-favorite-btn" data-favorite-button data-favorite-icon-only="1" data-target-type="job" data-target-id="${escapeAttr(item.id)}" aria-label="お気に入り"><span class="tasu-favorite-btn__icon" aria-hidden="true">♡</span></button>`}
      </div>
    `;

    return article;
  }

  function buildMobileCardElement(item) {
    const article = document.createElement("article");
    article.className = `job-list-mobile-card${item.isSpotlight ? " job-list-mobile-card--spotlight" : ""}`;
    article.dataset.favoriteRow = "";
    article.dataset.jobCard = item.id;

    const dateMeta = [item.updatedLabel, item.updatedRelative].filter(Boolean).join(" · ");

    article.innerHTML = `
      <div class="job-list-mobile-card__top">
        ${buildAvatarHtml(item)}
        <div>
          <p class="company-name">${buildTypeBadgeHtml(item)}${escapeHtml(item.companyName || "—")}</p>
          <h2 class="job-title"><a href="${escapeAttr(detailUrl(item.id, item.boardType))}">${escapeHtml(item.title)}</a></h2>
        </div>
        ${statusHtml(item)}
      </div>
      ${buildTagsHtml(collectRowTags(item), 4)}
      <dl class="job-list-mobile-card__dl">
        <div><dt>業種</dt><dd>${escapeHtml(item.industryLabel || "—")}</dd></div>
        <div><dt>雇用形態</dt><dd>${escapeHtml(item.employmentDisplayLabel || item.employmentType || "—")}</dd></div>
        <div><dt>エリア</dt><dd>${escapeHtml(item.location || item.areaPref || "—")}</dd></div>
        <div><dt>予算/単価</dt><dd class="job-salary">${escapeHtml(item.salaryDisplay || "応相談")}</dd></div>
        <div><dt>必要期間</dt><dd>${escapeHtml(item.periodLabel || "—")}</dd></div>
        <div><dt>応募期限</dt><dd>${escapeHtml(item.deadlineLabel || "—")}</dd></div>
        ${dateMeta ? `<div><dt>更新</dt><dd>${escapeHtml(dateMeta)}</dd></div>` : ""}
      </dl>
      <div class="job-list-mobile-card__actions job-action-cell">
        <div class="job-actions">
          <a class="job-detail-btn" href="${escapeAttr(detailUrl(item.id, item.boardType))}">詳細を見る</a>
          <a class="job-apply-btn" href="${escapeAttr(applyUrl(item.id, item.boardType))}">応募する</a>
          ${shouldHideFavorite(item) ? "" : `<button type="button" class="job-favorite-btn" data-favorite-button data-favorite-icon-only="1" data-target-type="job" data-target-id="${escapeAttr(item.id)}" aria-label="お気に入り"><span class="tasu-favorite-btn__icon" aria-hidden="true">♡</span></button>`}
        </div>
      </div>
    `;

    return article;
  }

  window.TasuJobTopRenderer = {
    buildTableRowElement,
    buildMobileCardElement,
    buildPrCardElement,
    buildCompanyAvatarHtml,
    buildRelatedJobCardElement,
    buildAvatarHtml,
    detailUrl,
    applyUrl,
    initials,
  };
})();
