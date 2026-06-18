/**
 * AIワークスペース — 検索結果の表示順・AIまとめ・下書き折りたたみ
 */
(function (global) {
  "use strict";

  const DRAFT_MARKER = "【問い合わせ文の下書き】";
  const DRAFT_PANEL_RE = /<details class="ai-cross-draft-panel"[\s\S]*?<\/details>/i;
  const DRAFT_PRE_RE = /<pre class="ai-cross-draft">[\s\S]*?<\/pre>/i;
  const DRAFT_CTA_RE = /<div class="ai-cross-draft-cta-wrap">[\s\S]*?<\/div>/i;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildContactDraftCtaHtml(cardDataAttrs = "") {
    return (
      '<div class="ai-cross-draft-cta-wrap">' +
      `<button type="button" class="ai-cross-cta ai-cross-cta--gold ai-cross-draft-cta" data-ai-draft-generate${cardDataAttrs}>` +
      "AIで問い合わせ文を作成する →" +
      "</button>" +
      "</div>"
    );
  }

  /** @deprecated use buildContactDraftCtaHtml */
  function buildContactDraftPanel(draftText) {
    void draftText;
    return buildContactDraftCtaHtml("");
  }

  function wrapLegacyDraftHtml(html) {
    let out = String(html || "");
    if (DRAFT_PANEL_RE.test(out)) return out;
    out = out.replace(DRAFT_PRE_RE, (match) => {
      const inner = match.replace(/^<pre class="ai-cross-draft">|<\/pre>$/gi, "");
      const text = inner
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"');
      return buildContactDraftPanel(text);
    });
    return out;
  }

  function extractDraftFromPlain(plain) {
    const text = String(plain || "");
    const idx = text.indexOf(DRAFT_MARKER);
    if (idx < 0) {
      return { contentPlain: text.trim(), draftPlain: "" };
    }
    return {
      contentPlain: text.slice(0, idx).trim(),
      draftPlain: text.slice(idx).trim(),
    };
  }

  function extractDraftFromHtml(html) {
    let body = String(html || "");
    let draftHtml = "";
    const panelMatch = body.match(DRAFT_PANEL_RE);
    if (panelMatch) {
      draftHtml = panelMatch[0];
      body = body.replace(DRAFT_PANEL_RE, "").trim();
      return { contentHtml: body, draftHtml };
    }
    const preMatch = body.match(DRAFT_PRE_RE);
    if (preMatch) {
      draftHtml = wrapLegacyDraftHtml(preMatch[0]);
      body = body.replace(DRAFT_PRE_RE, "").trim();
      return { contentHtml: body, draftHtml };
    }
    return { contentHtml: body, draftHtml: "" };
  }

  function countCrossCards(html) {
    return (String(html || "").match(/ai-cross-card/g) || []).length;
  }

  function extractMarketHint(webPlain, userText) {
    const combined = `${String(webPlain || "")}\n${String(userText || "")}`;
    const range = combined.match(/(\d[\d,]*)\s*万\s*[〜~\-－—]\s*(\d[\d,]*)\s*万/);
    if (range) return `${range[1]}〜${range[2]}万円程度`;
    const single = combined.match(/(\d[\d,]*)\s*万円程度/);
    if (single) return `${single[1]}万円程度`;
    if (/相場|目安|費用感|料金/.test(combined)) return "Web結果の目安を参照";
    return null;
  }

  function computeSummaryBullets(ctx) {
    const mode = String(ctx?.mode || "both");
    const userText = String(ctx?.userText || "");
    const webPlain = String(ctx?.webPlain || "");
    const bullets = [];

    const market = extractMarketHint(webPlain, userText);
    if (market && (mode === "web" || mode === "both")) {
      bullets.push(`相場目安：${market}`);
    }

    if (mode === "both") {
      const count = ctx.candidateCount ?? countCrossCards(ctx.internalHtml || "");
      if (count > 0) bullets.push(`候補業者：${count}件`);
      else if (ctx.hasInternal) bullets.push("候補業者：該当なし");
    }

    if (/相場|見積|塗装|工事|修理|費用|料金|業者/.test(`${userText}${webPlain}`)) {
      bullets.push("現地見積りの比較が有効です");
    }

    if (mode === "both" && countCrossCards(ctx.internalHtml || "") > 0) {
      bullets.push("詳細ページから連絡・見積相談が可能");
    }

    if (mode === "web" && bullets.length < 2) {
      bullets.push("条件により金額は変動します");
      bullets.push("正式な金額は見積りでご確認ください");
    }

    return bullets.filter(Boolean).slice(0, 5);
  }

  function buildSummarySectionHtml(bullets) {
    if (!bullets?.length) return "";
    const items = bullets
      .map((line) => `<li>${escapeHtml(line.replace(/^[・\-]\s*/, ""))}</li>`)
      .join("");
    return (
      '<section class="ai-search-summary">' +
      '<h3 class="ai-search-summary__title">整理結果</h3>' +
      `<ul class="ai-search-summary__list">${items}</ul>` +
      "</section>"
    );
  }

  function buildSummarySectionPlain(bullets) {
    if (!bullets?.length) return "";
    return `【整理結果】\n${bullets.map((b) => `・${b.replace(/^[・\-]\s*/, "")}`).join("\n")}`;
  }

  function layoutTasful(payload, options = {}) {
    if (!payload) return payload;
    let html = wrapLegacyDraftHtml(payload.html || "");
    const layout = String(options.resultLayout || "default");

    if (layout === "candidates-only") {
      html = html.replace(/<div class="ai-cross-intro">[\s\S]*?<\/div>/i, "");
    }

    const cardCount = countCrossCards(html);
    if (cardCount === 0) {
      html = html
        .replace(DRAFT_PANEL_RE, "")
        .replace(DRAFT_PRE_RE, "")
        .replace(DRAFT_CTA_RE, "")
        .trim();
    }

    return { ...payload, html };
  }

  function appendWebSummary(payload, userText) {
    if (!payload) return payload;
    const bullets = computeSummaryBullets({
      mode: "web",
      userText,
      webPlain: payload.plain || "",
    });
    if (!bullets.length) return payload;
    return {
      ...payload,
      html: String(payload.html || "") + buildSummarySectionHtml(bullets),
      plain: String(payload.plain || "") + "\n\n" + buildSummarySectionPlain(bullets),
    };
  }

  function layoutBoth({ internal, web, userText }) {
    if (!internal && !web) return null;

    const stripBadge = global.TasuAiSearchTarget?.stripWebSearchBadge || ((h) => h);
    const htmlParts = [];
    const plainParts = [];
    let internalContentHtml = "";

    if (internal?.html || internal?.plain) {
      const rawHtml = stripBadge(internal.html || "");
      const extracted = extractDraftFromHtml(rawHtml);
      const splitPlain = extractDraftFromPlain(internal.plain || "");
      internalContentHtml = extracted.contentHtml || "";

      htmlParts.push(
        `<section class="ai-hybrid-section ai-hybrid-section--site"><h3 class="ai-hybrid-section__title">TASFUL内の候補</h3><div class="ai-hybrid-section__body">${internalContentHtml}</div></section>`
      );
      plainParts.push(`【TASFUL内の候補】\n${splitPlain.contentPlain || internal.plain || ""}`);
    }

    if (web?.html || web?.plain) {
      htmlParts.push(
        `<section class="ai-hybrid-section ai-hybrid-section--web"><h3 class="ai-hybrid-section__title">Web検索結果</h3><div class="ai-hybrid-section__body">${stripBadge(web.html || "")}</div></section>`
      );
      plainParts.push(`【Web検索結果】\n${web.plain || ""}`);
    }

    const summaryBullets = computeSummaryBullets({
      mode: "both",
      userText,
      webPlain: web?.plain || "",
      internalHtml: htmlParts[0] || "",
      hasInternal: Boolean(internal),
      candidateCount: countCrossCards(internal?.html || ""),
    });
    const summaryHtml = buildSummarySectionHtml(summaryBullets);
    const summaryPlain = buildSummarySectionPlain(summaryBullets);
    if (summaryHtml) {
      htmlParts.push(summaryHtml);
      plainParts.push(summaryPlain);
    }

    return {
      plain: plainParts.filter(Boolean).join("\n\n"),
      html: htmlParts.join(""),
      search_used: Boolean(internal?.search_used || web?.search_used),
      search_query: web?.search_query || "",
      search_provider: web?.search_provider || internal?.search_provider || "",
      search_result_count: web?.search_result_count || 0,
      uiBadgeHtml: "",
    };
  }

  global.TasuAiSearchResultUx = {
    buildContactDraftCtaHtml,
    buildContactDraftPanel,
    wrapLegacyDraftHtml,
    computeSummaryBullets,
    buildSummarySectionHtml,
    layoutTasful,
    appendWebSummary,
    layoutBoth,
    countCrossCards,
  };
})(typeof window !== "undefined" ? window : globalThis);
