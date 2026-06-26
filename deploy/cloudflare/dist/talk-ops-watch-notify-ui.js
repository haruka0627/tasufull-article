/**
 * TASFUL OPS WATCH — TALK 通知タブ UI（コンパクト表示・詳細モーダル・色分け）
 */
(function (global) {
  "use strict";

  const SOURCE = "ops_watch";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isOpsWatchNotification(n) {
    return String(n?.source || "").toLowerCase() === SOURCE;
  }

  function isDailySummary(n) {
    return (
      isOpsWatchNotification(n) &&
      (n?.opsWatchKind === "daily_summary" || String(n?.title || "").includes("日次サマリー"))
    );
  }

  function opsImportance(n) {
    const imp = pickStr(n?.opsWatchImportance, n?.opsWatchDetail?.importance).toLowerCase();
    if (imp === "high" || imp === "medium" || imp === "low") return imp;
    const body = String(n?.body || "");
    if (body.includes("\n高\n") || body.startsWith("【OPS WATCH】\n\n高")) return "high";
    if (body.includes("\n低\n")) return "low";
    return "medium";
  }

  function importanceModifier(n) {
    const imp = opsImportance(n);
    if (imp === "high") return "talk-notify-card--ops-high";
    if (imp === "low") return "talk-notify-card--ops-low";
    return "talk-notify-card--ops-medium";
  }

  function importanceBadgeHtml(n, escapeHtml) {
    const imp = opsImportance(n);
    const labels = { high: "高", medium: "中", low: "低" };
    const cls = {
      high: "talk-ops-watch-imp--high",
      medium: "talk-ops-watch-imp--medium",
      low: "talk-ops-watch-imp--low",
    };
    return `<span class="talk-ops-watch-imp ${cls[imp] || cls.medium}">${escapeHtml(labels[imp] || "中")}</span>`;
  }

  function formatBodySections(body, escapeHtml) {
    const lines = String(body || "").split("\n");
    return lines
      .map((line) => {
        const t = line.trim();
        if (!t) return "";
        if (t === "【OPS WATCH】") {
          return `<p class="talk-ops-watch-body__brand">${escapeHtml(t)}</p>`;
        }
        if (t.startsWith("■")) {
          return `<p class="talk-ops-watch-body__section">${escapeHtml(t)}</p>`;
        }
        if (t === "(なし)" || t === "（なし）") return "";
        if (t.startsWith("検出記事数:")) {
          return `<p class="talk-ops-watch-body__count">${escapeHtml(t)}</p>`;
        }
        if (t === "詳細は別画面またはモーダル") {
          return `<p class="talk-ops-watch-body__hint">${escapeHtml(t)}</p>`;
        }
        if (t === "---") return "";
        return `<p class="talk-ops-watch-body__line">${escapeHtml(line)}</p>`;
      })
      .filter(Boolean)
      .join("");
  }

  function getCardsForNotification(notification) {
    const Store = global.TasuOpsWatchStore;
    if (!Store?.getCard) return [];
    const ids = Array.isArray(notification?.opsWatchCardIds)
      ? notification.opsWatchCardIds
      : notification?.opsWatchDetail?.cardId
        ? [notification.opsWatchDetail.cardId]
        : [];
    return ids.map((id) => Store.getCard(id)).filter(Boolean);
  }

  function ensureModal() {
    let root = document.querySelector("[data-talk-ops-watch-modal]");
    if (root) return root;

    root = document.createElement("div");
    root.className = "talk-ops-watch-modal";
    root.setAttribute("data-talk-ops-watch-modal", "");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="talk-broadcast-modal__backdrop" data-talk-ops-watch-close tabindex="-1" aria-hidden="true"></div>
      <div class="talk-ops-watch-modal__panel" role="dialog" aria-modal="true" aria-labelledby="talkOpsWatchModalTitle">
        <header class="talk-broadcast-modal__head">
          <h3 id="talkOpsWatchModalTitle" class="talk-broadcast-modal__title" data-talk-ops-watch-modal-title>OPS WATCH 詳細</h3>
          <button type="button" class="talk-broadcast-modal__close" data-talk-ops-watch-close aria-label="閉じる">✕</button>
        </header>
        <div class="talk-ops-watch-modal__body" data-talk-ops-watch-modal-body></div>
      </div>`;
    document.body.appendChild(root);

    root.querySelectorAll("[data-talk-ops-watch-close]").forEach((el) => {
      el.addEventListener("click", () => closeDetailModal());
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetailModal();
    });
    return root;
  }

  function escape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveCategoryForCard(card) {
    const id = pickStr(card?.categoryId);
    const fromStore = id ? global.TasuOpsWatchCategories?.getCategory?.(id) : null;
    if (fromStore) return fromStore;
    return {
      id,
      label: pickStr(card?.categoryLabel) || "監視",
      tasfulRelevance: "",
    };
  }

  function ensureCardForDisplay(card) {
    const Analyzer = global.TasuOpsWatchAnalyzer;
    const category = resolveCategoryForCard(card);
    const sources = Array.isArray(card?.sources) ? card.sources : [];
    if (Analyzer?.ensureReportQuality) {
      return Analyzer.ensureReportQuality(card, category, { results: sources });
    }
    return {
      ...card,
      summary: pickStr(card?.summary) || global.TasuOpsWatchAnalyzer?.REPORT_FALLBACK?.summary || "情報を取得しましたが、要約を生成できませんでした。",
      tasfulImpact:
        pickStr(card?.tasfulImpact) ||
        global.TasuOpsWatchAnalyzer?.REPORT_FALLBACK?.tasfulImpact ||
        "現時点でTASFULへの直接的な影響は確認されていません。",
      recommendedAction:
        pickStr(card?.recommendedAction) ||
        global.TasuOpsWatchAnalyzer?.REPORT_FALLBACK?.recommendedAction ||
        "監視継続",
    };
  }

  function renderReportSections(card, escapeHtml) {
    const row = ensureCardForDisplay(card);
    return (
      `<h5>■概要</h5>` +
      `<p>${escapeHtml(row.summary)}</p>` +
      `<h5>■TASFULへの影響</h5>` +
      `<p>${escapeHtml(row.tasfulImpact)}</p>` +
      `<h5>■推奨アクション</h5>` +
      `<p>${escapeHtml(row.recommendedAction)}</p>`
    );
  }

  function renderDetailHtml(notification) {
    if (isDailySummary(notification)) {
      const detail = notification.opsWatchDetail || {};
      const stats = detail.stats || {};
      const full = pickStr(detail.fullBody) || "";
      return `
        <section class="talk-ops-watch-detail">
          <p class="talk-ops-watch-detail__lead">日次サマリー（実行結果）</p>
          <pre class="talk-ops-watch-detail__pre">${escape(full || notification.body || "")}</pre>
          <dl class="talk-ops-watch-detail__stats">
            <div><dt>カテゴリ</dt><dd>${escape(stats.categoriesRun ?? 0)}</dd></div>
            <div><dt>通知</dt><dd>${escape(stats.talkNotifications ?? 0)}</dd></div>
            <div><dt>重要/中/低</dt><dd>${escape(stats.high ?? 0)} / ${escape(stats.medium ?? 0)} / ${escape(stats.low ?? 0)}</dd></div>
          </dl>
        </section>`;
    }

    const cards = getCardsForNotification(notification);
    const detail = notification.opsWatchDetail || {};
    const blocks = cards.length
      ? cards
      : [
          {
            categoryLabel: detail.categoryLabel,
            headline: detail.headline,
            importance: detail.importance,
            summary: detail.summary,
            tasfulImpact: detail.tasfulImpact,
            recommendedAction: detail.recommendedAction,
            introductionProposal: detail.introductionProposal,
            sources: detail.sources,
            analysisSource: detail.analysisSource,
            searchResultCount: detail.searchResultCount,
          },
        ];

    return blocks
      .map((card, idx) => {
        const analysis = pickStr(card.analysisSource);
        const analysisLine = analysis
          ? analysis.toLowerCase().includes("template")
            ? "analysis: template fallback"
            : `analysis: ${analysis}`
          : "";
        const sources = Array.isArray(card.sources) ? card.sources : [];
        const srcHtml = sources.length
          ? `<ul class="talk-ops-watch-detail__sources">${sources
              .slice(0, 8)
              .map(
                (s, i) =>
                  `<li><a href="${escape(pickStr(s.url))}" target="_blank" rel="noopener noreferrer">${escape(
                    pickStr(s.title) || `参照 ${i + 1}`
                  )}</a></li>`
              )
              .join("")}</ul>`
          : "";
        const display = ensureCardForDisplay(card);
        return `
        <section class="talk-ops-watch-detail${idx > 0 ? " talk-ops-watch-detail--sep" : ""}">
          <h4 class="talk-ops-watch-detail__title">${escape(pickStr(display.headline, display.categoryLabel, "監視レポート"))}</h4>
          ${analysisLine ? `<p class="talk-ops-watch-detail__meta">${escape(analysisLine)}</p>` : ""}
          ${renderReportSections(display, escape)}
          ${
            display.introductionProposal
              ? `<h5>■導入提案</h5><p>${escape(display.introductionProposal)}</p>`
              : ""
          }
          ${srcHtml ? `<h5>■参考リンク</h5>${srcHtml}` : ""}
        </section>`;
      })
      .join("");
  }

  function openDetailModal(notificationOrId) {
    const id =
      typeof notificationOrId === "string"
        ? notificationOrId
        : pickStr(notificationOrId?.id);
    const row =
      (typeof notificationOrId === "object" && notificationOrId) ||
      global.TasuTalkData?.findNotificationById?.(id) ||
      global.TasuTalkNotifications?.findById?.(id);
    if (!row || !isOpsWatchNotification(row)) return false;

    const modal = ensureModal();
    const titleEl = modal.querySelector("[data-talk-ops-watch-modal-title]");
    const bodyEl = modal.querySelector("[data-talk-ops-watch-modal-body]");
    if (titleEl) titleEl.textContent = pickStr(row.title) || "OPS WATCH 詳細";
    if (bodyEl) bodyEl.innerHTML = renderDetailHtml(row);

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("talk-ops-watch-modal-open");
    return true;
  }

  function closeDetailModal() {
    const modal = document.querySelector("[data-talk-ops-watch-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("talk-ops-watch-modal-open");
  }

  /**
   * @param {object} n
   * @param {{ escapeHtml: Function, formatNotifyTime: Function, unread: boolean, readLabel: string, readClass: string, actionsHtml?: string }} ctx
   */
  function renderOpsWatchCardHtml(n, ctx) {
    const { escapeHtml, formatNotifyTime, unread, readLabel, readClass, actionsHtml } = ctx;
    const impMod = importanceModifier(n);
    const daily = isDailySummary(n);
    const typeLabel = daily ? "日次サマリー" : "OPS WATCH";
    const bodyHtml = formatBodySections(n.body, escapeHtml);
    const count = Number(n.opsWatchArticleCount) || 0;
    const countBadge =
      !daily && count > 1
        ? `<span class="talk-ops-watch-count-badge">${escapeHtml(`検出 ${count}件`)}</span>`
        : "";

    return `
      <article class="talk-notify-card talk-notify-card--ops talk-notify-card--cta-only talk-notify-card--compact ${impMod}${unread ? " talk-notify-card--unread" : ""}${daily ? " talk-notify-card--ops-daily" : ""}" data-talk-notify-id="${escapeHtml(n.id)}" data-talk-ops-watch-card="1" aria-label="${escapeHtml(n.title)}">
        <div class="talk-notify-card__compact">
          <header class="talk-notify-card__head talk-notify-card__head--compact">
            <span class="talk-notify-card__type talk-notify-card__type--ops">${escapeHtml(typeLabel)}</span>
            <span class="talk-notify-card__head-extra">
              ${countBadge}
              ${importanceBadgeHtml(n, escapeHtml)}
              <span class="talk-notify-read ${readClass}">${readLabel}</span>
            </span>
            <span class="talk-notify-card__time">${escapeHtml(formatNotifyTime(n.createdAt))}</span>
          </header>
          <div class="talk-notify-card__body">
            <p class="talk-notify-card__title">${escapeHtml(n.title)}</p>
            <div class="talk-ops-watch-body talk-notify-card__text">${bodyHtml}</div>
            <p class="talk-notify-card__meta talk-notify-card__meta--legacy">
              <time datetime="${escapeHtml(n.createdAt)}">${escapeHtml(formatNotifyTime(n.createdAt))}</time>
            </p>
            <button type="button" class="talk-notify-card__action talk-notify-card__platform-action talk-notify-card__action--primary talk-notify-card__card-cta talk-notify-card__minimal-action" data-talk-notify-action="ops-detail" data-talk-notify-id="${escapeHtml(n.id)}">詳細を見る</button>
          </div>
        </div>
        ${actionsHtml || ""}
      </article>`;
  }

  global.TasuTalkOpsWatchNotifyUi = {
    SOURCE,
    isOpsWatchNotification,
    isDailySummary,
    opsImportance,
    importanceModifier,
    renderOpsWatchCardHtml,
    renderDetailHtml,
    openDetailModal,
    closeDetailModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
