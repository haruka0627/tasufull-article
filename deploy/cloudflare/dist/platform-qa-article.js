/**
 * TASFUL Platform QA — 共有記事コンポーネント（/help · サイト内AI 共通）
 * @see docs/AI/TASFUL_AI_QA.md · AD-015
 */
(function (global) {
  "use strict";

  const COMMON_HEADER = {
    brand: "TASFUL AI",
    lead: "ご質問に関連する案内が見つかりました。",
    sourceNote: "TASFUL内の登録データ・案内ページをもとに回答しています。",
  };

  const ITEM_SOURCE_NOTE = "この回答はTASFUL内の登録データ・案内ページをもとに生成しています。";

  const SERVICE_CTA_MAP = Object.freeze({
    "tasful-ai": { label: "AIを開く", href: "/ai-workspace.html" },
    ai: { label: "AIを開く", href: "/ai-workspace.html" },
    platform: { label: "Platformを見る", href: "/market/" },
    tlv: { label: "TLVを見る", href: "/live/" },
    talk: { label: "Talkを見る", href: "/talk-home.html" },
  });

  const INFO_BOX_LABELS = Object.freeze({
    notice: "補足",
    supplement: "補足",
    caution: "注意",
    point: "ポイント",
    hint: "ヒント",
    tip: "ヒント",
  });

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeArticle(raw) {
    if (!raw) return null;
    return {
      ...raw,
      label: raw.title || raw.label || "",
      query: raw.question || raw.query || "",
    };
  }

  function buildCtaBtn(label, href, primary) {
    const cls = primary
      ? "platform-qa-cta__btn platform-qa-cta__btn--primary ai-message-context-cta__btn ai-message-next-actions__btn--primary"
      : "platform-qa-cta__btn ai-message-context-cta__btn";
    const raw = String(label || "").trim();
    const text = raw.endsWith("→") ? raw : `${raw} →`;
    return (
      `<div class="platform-qa-cta ai-answer-pattern__cta">` +
      `<a class="${cls}" href="${escapeHtml(href || "#")}">${escapeHtml(text)}</a>` +
      `</div>`
    );
  }

  function buildCtaGroup(items) {
    return (
      `<div class="platform-qa-cta platform-qa-cta--group ai-answer-pattern__cta-group ai-site-qa-answer__cta-group">` +
      items
        .map((item, i) => {
          const raw = String(item.label || "").trim();
          const text = raw.endsWith("→") ? raw : `${raw} →`;
          return (
            `<a class="platform-qa-cta__btn ai-message-context-cta__btn${i === 0 ? " platform-qa-cta__btn--primary ai-message-next-actions__btn--primary" : ""}" href="${escapeHtml(item.href || "#")}">${escapeHtml(text)}</a>`
          );
        })
        .join("") +
      `</div>`
    );
  }

  function buildRelatedLinks(links) {
    if (!links || !links.length) return "";
    return (
      `<div class="ai-site-qa-answer__related">` +
      `<p class="ai-site-qa-answer__related-label">関連ページ</p>` +
      `<div class="ai-site-qa-answer__related-grid">` +
      links
        .map((item) => {
          const icon = item.icon
            ? `<span class="ai-site-qa-answer__related-card-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
            : "";
          return (
            `<a class="ai-site-qa-answer__related-card" href="${escapeHtml(item.href || "#")}">` +
            `${icon}` +
            `<span class="ai-site-qa-answer__related-card-title">${escapeHtml(item.label)}</span>` +
            `<span class="ai-site-qa-answer__related-card-action">詳しく見る →</span>` +
            `</a>`
          );
        })
        .join("") +
      `</div>` +
      `</div>`
    );
  }

  function buildFeedback(qaId) {
    function feedbackBtn(value, icon, label) {
      return (
        `<button type="button" class="ai-site-qa-answer__feedback-btn" data-platform-qa-feedback-value="${value}" aria-pressed="false">` +
        `<span class="ai-site-qa-answer__feedback-btn-inner">` +
        `<span class="ai-site-qa-answer__feedback-icon" aria-hidden="true">${icon}</span>` +
        `<span class="ai-site-qa-answer__feedback-text">${label}</span>` +
        `<span class="ai-site-qa-answer__feedback-count" data-platform-qa-feedback-count="${value}" hidden aria-hidden="true"></span>` +
        `</span>` +
        `</button>`
      );
    }
    return (
      `<div class="ai-site-qa-answer__feedback" data-platform-qa-feedback="${escapeHtml(qaId || "")}">` +
      `<div class="ai-site-qa-answer__feedback-rule" aria-hidden="true"></div>` +
      `<p class="ai-site-qa-answer__feedback-label">この回答は役に立ちましたか？</p>` +
      `<div class="ai-site-qa-answer__feedback-actions" role="group" aria-label="回答へのフィードバック">` +
      feedbackBtn("yes", "👍", "はい") +
      feedbackBtn("no", "👎", "いいえ") +
      `</div>` +
      `<div class="ai-site-qa-answer__feedback-rule" aria-hidden="true"></div>` +
      `</div>`
    );
  }

  function buildNumberedSteps(steps) {
    return (
      `<ol class="platform-qa-steps platform-qa-steps--numbered ai-answer-pattern__steps ai-answer-pattern__steps--numbered ai-site-qa-answer__steps">` +
      steps
        .map((step, i) => {
          const title = typeof step === "string" ? step : step.title;
          const desc = typeof step === "string" ? "" : step.desc || "";
          return (
            `<li>` +
            `<span class="platform-qa-steps__num ai-answer-pattern__step-num">${i + 1}</span>` +
            `<span class="platform-qa-steps__copy ai-answer-pattern__step-copy">` +
            `<span class="platform-qa-steps__title ai-answer-pattern__step-title">${escapeHtml(title)}</span>` +
            (desc
              ? `<span class="platform-qa-steps__desc ai-answer-pattern__step-desc">${escapeHtml(desc)}</span>`
              : "") +
            `</span>` +
            `</li>`
          );
        })
        .join("") +
      `</ol>`
    );
  }

  function buildBullets(items) {
    return (
      `<ul class="platform-qa-bullets ai-answer-pattern__bullets">` +
      items.map((text) => `<li>${escapeHtml(text)}</li>`).join("") +
      `</ul>`
    );
  }

  function buildInfoBox(label, text) {
    if (!text) return "";
    return (
      `<div class="platform-qa-infobox ai-site-qa-answer__infobox" role="note">` +
      (label ? `<p class="platform-qa-infobox__label">${escapeHtml(label)}</p>` : "") +
      `<p class="platform-qa-infobox__text">${escapeHtml(text)}</p>` +
      `</div>`
    );
  }

  function collectInfoBoxes(article) {
    const boxes = [];
    if (article.infoBox) {
      if (typeof article.infoBox === "string") {
        boxes.push({ label: "ポイント", text: article.infoBox });
      } else if (article.infoBox.text) {
        boxes.push({
          label: article.infoBox.label || "ポイント",
          text: article.infoBox.text,
        });
      }
    }
    if (Array.isArray(article.infoBoxes)) {
      for (const item of article.infoBoxes) {
        if (!item) continue;
        if (typeof item === "string") boxes.push({ label: "ポイント", text: item });
        else if (item.text) boxes.push({ label: item.label || "ポイント", text: item.text });
      }
    }
    for (const key of ["supplement", "caution", "point", "hint", "tip"]) {
      if (article[key]) {
        boxes.push({ label: INFO_BOX_LABELS[key] || key, text: article[key] });
      }
    }
    if (article.notice) {
      boxes.push({ label: INFO_BOX_LABELS.notice, text: article.notice });
    }
    return boxes;
  }

  function buildInfoBoxesHtml(article) {
    const boxes = collectInfoBoxes(article);
    if (!boxes.length) return "";
    return (
      `<div class="platform-qa-infobox-group ai-site-qa-answer__infobox-group">` +
      boxes.map((box) => buildInfoBox(box.label, box.text)).join("") +
      `</div>`
    );
  }

  function buildServiceCtaHtml(article) {
    const service = String(article.service || "").trim();
    const mapped = SERVICE_CTA_MAP[service];
    if (!mapped?.href) return "";
    const label = mapped.label.endsWith("→") ? mapped.label : `${mapped.label} →`;
    return (
      `<div class="platform-qa-service-cta ai-site-qa-answer__service-cta">` +
      `<a class="platform-qa-service-cta__btn" href="${escapeHtml(mapped.href)}">${escapeHtml(label)}</a>` +
      `</div>`
    );
  }

  function buildNotice(text) {
    return buildInfoBox(INFO_BOX_LABELS.notice, text);
  }

  function buildBody(paragraphs, blocks) {
    const paras = (paragraphs || [])
      .map((p, i, arr) => {
        let cls = "ai-site-qa-answer__para";
        if (i === 0) cls += " ai-site-qa-answer__para--lead";
        else if (i === 1) cls += " ai-site-qa-answer__para--supplement";
        else if (i === arr.length - 1 && (blocks || []).length) cls += " ai-site-qa-answer__para--guide";
        return `<p class="${cls}">${escapeHtml(p)}</p>`;
      })
      .join("");
    return `<div class="platform-qa-body ai-answer-pattern__body ai-md">${paras}${(blocks || []).join("")}</div>`;
  }

  function aiIconHtml(sizeKey) {
    const Icon = global.PlatformQaAiIcon;
    if (Icon?.render) return Icon.render(sizeKey || "md");
    return "";
  }

  function buildVariableBodyHtml(cfg) {
    const article = normalizeArticle(cfg);
    const bodyBlocks = [];
    if (article.steps) bodyBlocks.push(buildNumberedSteps(article.steps));
    if (article.bullets) bodyBlocks.push(buildBullets(article.bullets));

    const paragraphs = [...(article.intro || []), ...(article.paragraphs || [])];
    const relatedHtml = buildRelatedLinks(article.related);
    let ctaHtml = "";
    if (article.cta) ctaHtml = buildCtaBtn(article.cta.label, article.cta.href, true);
    if (article.ctaGroup) ctaHtml = buildCtaGroup(article.ctaGroup);

    const boxContent =
      buildBody(paragraphs, bodyBlocks) +
      relatedHtml +
      ctaHtml +
      buildInfoBoxesHtml(article) +
      buildServiceCtaHtml(article);
    const feedbackId = article.slug || article.id || "";

    return (
      `<div class="ai-site-qa-answer">` +
      `<div class="ai-site-qa-answer__box ai-site-qa-answer__box--accent">` +
      `<p class="ai-site-qa-answer__box-label">` +
      `<span class="ai-site-qa-answer__box-label-icon" aria-hidden="true">${aiIconHtml("md")}</span> ${escapeHtml(COMMON_HEADER.brand)}` +
      `</p>` +
      `<div class="ai-site-qa-answer__content">${boxContent}</div>` +
      `</div>` +
      buildFeedback(feedbackId) +
      `<p class="ai-site-qa-answer__item-source-note" role="note">${escapeHtml(ITEM_SOURCE_NOTE)}</p>` +
      `</div>`
    );
  }

  function buildCommonHeaderHtml() {
    return (
      `<header class="ai-site-qa-layout__header" role="region" aria-label="TASFUL AI Q&amp;A回答">` +
      `<p class="ai-site-qa-layout__brand">` +
      `<span class="ai-site-qa-layout__brand-icon" aria-hidden="true">${aiIconHtml("brand")}</span> ${escapeHtml(COMMON_HEADER.brand)}` +
      `</p>` +
      `<p class="ai-site-qa-layout__lead">${escapeHtml(COMMON_HEADER.lead)}</p>` +
      `<p class="ai-site-qa-layout__source-note">${escapeHtml(COMMON_HEADER.sourceNote)}</p>` +
      `</header>`
    );
  }

  function buildResultContentHtml(cfg, options) {
    const article = normalizeArticle(cfg);
    if (!article) return "";
    const opts = options || {};
    const showIndex = opts.showIndex === true;
    const titleText = showIndex && article.id ? `${article.id}. ${article.label}` : String(article.label || "");
    const cardClass = opts.standaloneCard === true ? " ai-site-qa-result--standalone-card" : "";

    return (
      `<section class="ai-site-qa-result ai-site-qa-layout__item${cardClass}" data-platform-qa-slug="${escapeHtml(article.slug || "")}" data-ai-site-qa-id="${escapeHtml(article.id || "")}" aria-labelledby="platform-qa-result-${escapeHtml(article.slug || article.id || "")}">` +
      `<h3 class="ai-site-qa-result__title ai-section-heading" id="platform-qa-result-${escapeHtml(article.slug || article.id || "")}">${escapeHtml(titleText)}</h3>` +
      `<p class="ai-site-qa-result__query">` +
      `<span class="ai-site-qa-result__query-label">💬 質問</span> ${escapeHtml(article.query || "")}` +
      `</p>` +
      buildVariableBodyHtml(article) +
      `</section>`
    );
  }

  function buildResultsStackHtml(articles, options) {
    const opts = options || {};
    const list = (Array.isArray(articles) ? articles : [articles]).filter(Boolean);
    if (!list.length) return "";
    const cards = list
      .map((item) =>
        buildResultContentHtml(item, {
          ...opts,
          standaloneCard: true,
        })
      )
      .join("");
    const showcaseClass = opts.showcase ? " ai-site-qa-showcase" : "";
    const layoutAttrs = opts.showcase
      ? ' role="region" aria-label="サイト内QA回答UI" data-ai-site-qa-layout'
      : "";
    return (
      `<div class="ai-site-qa-layout platform-qa-article ai-site-qa-layout--per-item-cards${showcaseClass}" data-platform-qa-article data-ai-site-qa-multi="1"${layoutAttrs}>` +
      (opts.includeHeader !== false ? buildCommonHeaderHtml() : "") +
      `<div class="ai-site-qa-layout__stack">` +
      cards +
      `</div></div>`
    );
  }

  function buildResultHtml(cfg, options) {
    return buildResultsStackHtml([cfg], options);
  }

  function listReviewArticles() {
    const Data = global.PlatformQaData;
    if (Data?.listReviewArticles) return Data.listReviewArticles();
    return [];
  }

  function bindFeedback(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-platform-qa-feedback]").forEach((wrap) => {
      wrap.querySelectorAll("[data-platform-qa-feedback-value]").forEach((btn) => {
        btn.addEventListener("click", () => {
          wrap.querySelectorAll("[data-platform-qa-feedback-value]").forEach((b) => {
            b.setAttribute("aria-pressed", "false");
            b.classList.remove("is-selected");
          });
          btn.setAttribute("aria-pressed", "true");
          btn.classList.add("is-selected");
        });
      });
    });
  }

  global.PlatformQaArticle = {
    COMMON_HEADER,
    ITEM_SOURCE_NOTE,
    normalizeArticle,
    buildCommonHeaderHtml,
    buildVariableBodyHtml,
    buildResultContentHtml,
    buildResultsStackHtml,
    buildResultHtml,
    listReviewArticles,
    bindFeedback,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
