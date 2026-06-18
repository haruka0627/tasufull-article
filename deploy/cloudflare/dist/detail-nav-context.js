/**
 * 詳細ページ — 流入元に応じたパンくず・戻る導線
 * URL params: from, returnTo, q, cat, catLabel
 */
(function (global) {
  "use strict";

  const LIST_HREF = "business.html";
  const FAVORITE_HREF = "favorites-list.html";
  const TALK_HREF = "talk-home.html?tab=chat";
  const NOTIFY_HREF = "talk-home.html?tab=notify";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

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

  function relativeHrefFromUrl(url) {
    try {
      const path = String(url.pathname || "").replace(/^\//, "");
      const qs = url.search || "";
      return `${path}${qs}`;
    } catch {
      return "";
    }
  }

  function appendDetailNavParams(href, nav) {
    const base = String(href || "").trim();
    if (!base || base === "#") return base;
    try {
      const url = new URL(base, global.location?.href || "http://localhost/");
      if (nav?.from) url.searchParams.set("from", nav.from);
      if (nav?.returnTo) url.searchParams.set("returnTo", nav.returnTo);
      if (nav?.q) url.searchParams.set("q", nav.q);
      if (nav?.cat) url.searchParams.set("cat", nav.cat);
      if (nav?.catLabel) url.searchParams.set("catLabel", nav.catLabel);
      return relativeHrefFromUrl(url);
    } catch {
      return base;
    }
  }

  function parseFromLocation(loc) {
    const location = loc || global.location;
    const params = new URLSearchParams(location?.search || "");
    const from = pickStr(params.get("from")) || "list";
    return {
      from,
      returnTo: pickStr(params.get("returnTo")),
      q: pickStr(params.get("q")),
      cat: pickStr(params.get("cat"), params.get("business_category")),
      catLabel: pickStr(params.get("catLabel")),
    };
  }

  function defaultAiReturnTo() {
    const loc = global.location;
    if (loc && /ai-workspace\.html/i.test(loc.pathname || "")) {
      return relativeHrefFromUrl(loc);
    }
    const links = global.TasuAiWorkspaceLinks;
    if (links?.buildUrl) return links.buildUrl({ mode: links.DEFAULT_MODE || "cross-matching" });
    return "ai-workspace.html?mode=cross-matching";
  }

  function resolveAiReturnTo(ctx) {
    if (ctx?.returnTo) return ctx.returnTo;
    const state = global.TasuAiSearchState?.read?.();
    if (state?.returnHref) return state.returnHref;
    return defaultAiReturnTo();
  }

  function resolveCategoryHref(ctx) {
    if (ctx?.returnTo) return ctx.returnTo;
    if (ctx?.cat) {
      return `${LIST_HREF}?business_category=${encodeURIComponent(ctx.cat)}`;
    }
    return LIST_HREF;
  }

  function resolveBackLink(ctx, listing) {
    const from = pickStr(ctx?.from, "list");
    switch (from) {
      case "ai":
        return { href: resolveAiReturnTo(ctx), label: "← AI検索結果に戻る" };
      case "favorite":
        return {
          href: pickStr(ctx?.returnTo, FAVORITE_HREF),
          label: "← お気に入りに戻る",
        };
      case "talk":
        return {
          href: pickStr(ctx?.returnTo, TALK_HREF),
          label: "← TALKに戻る",
        };
      case "notify":
        return {
          href: pickStr(ctx?.returnTo, NOTIFY_HREF),
          label: "← 通知に戻る",
        };
      case "category":
        return {
          href: resolveCategoryHref(ctx),
          label: "← 法人・業者一覧に戻る",
        };
      case "list":
      default:
        return {
          href: pickStr(ctx?.returnTo, LIST_HREF),
          label: "← 法人・業者一覧に戻る",
        };
    }
  }

  function renderBreadcrumbHtml(ctx, listing) {
    const company = escapeHtml(listing?.company_name || listing?.title || "詳細");
    const catLabel = escapeHtml(
      ctx?.catLabel || listing?.categoryLabel || listing?.business_category || "業者"
    );
    const from = pickStr(ctx?.from, "list");
    const aiHome =
      global.TasuAiWorkspaceLinks?.buildUrl?.({
        mode: global.TasuAiWorkspaceLinks?.DEFAULT_MODE || "cross-matching",
      }) || "ai-workspace.html?mode=cross-matching";

    switch (from) {
      case "ai": {
        const resultsHref = escapeAttr(resolveAiReturnTo(ctx));
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${escapeAttr(aiHome)}">TASFUL AI</a> &gt; ` +
          `<a href="${resultsHref}">検索結果</a> &gt; ` +
          `<span>${company}</span>`
        );
      }
      case "favorite":
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${FAVORITE_HREF}">お気に入り</a> &gt; ` +
          `<span>${company}</span>`
        );
      case "talk":
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${TALK_HREF}">TALK</a> &gt; ` +
          `<span>${company}</span>`
        );
      case "notify":
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${NOTIFY_HREF}">通知</a> &gt; ` +
          `<span>${company}</span>`
        );
      case "category": {
        const catHref = escapeAttr(resolveCategoryHref(ctx));
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${LIST_HREF}">法人・業者一覧</a> &gt; ` +
          `<a href="${catHref}">${catLabel}</a> &gt; ` +
          `<span>${company}</span>`
        );
      }
      case "list":
      default:
        return (
          `<a href="index.html">Home</a> &gt; ` +
          `<a href="${LIST_HREF}">法人・業者一覧</a> &gt; ` +
          `<span>${catLabel}</span> &gt; ` +
          `<span>${company}</span>`
        );
    }
  }

  function applyDetailNav(listing, opts) {
    const o = { breadcrumb: true, back: true, ...(opts || {}) };
    const ctx = parseFromLocation();
    const breadcrumb = global.document?.querySelector("[data-breadcrumb]");
    if (o.breadcrumb && breadcrumb && !breadcrumb.classList.contains("biz-detail-breadcrumb--shop")) {
      const company = listing?.company_name || listing?.title || "詳細";
      const applied = global.TasuCommonBreadcrumb?.applyDetailFallback?.(ctx, listing, {
        theme: "biz-detail",
        nav: breadcrumb,
      });
      if (!applied) {
        global.TasuCommonBreadcrumb?.setCurrentLabel(company);
      }
    }
    const back = global.document?.querySelector("[data-biz-detail-back]");
    if (o.back && back && !back.hidden) {
      const link = resolveBackLink(ctx, listing);
      back.href = link.href;
      back.textContent = link.label;
    }
  }

  function buildAiDetailUrl(href, opts) {
    const o = opts || {};
    return appendDetailNavParams(href, {
      from: "ai",
      returnTo: pickStr(o.returnTo, defaultAiReturnTo()),
      q: pickStr(o.q),
    });
  }

  function appendBoardListParams(href, listing) {
    if (!href || href === "#") return href;
    const params = new URLSearchParams(global.location?.search || "");
    const activeCat = pickStr(
      params.get("business_category"),
      global.document?.querySelector("[data-business-category-nav] [data-biz-cat].is-active")?.dataset
        ?.bizCat
    );
    const returnTo = relativeHrefFromUrl(global.location || { pathname: LIST_HREF, search: "" });
    const catLabel = pickStr(
      listing?.categoryLabel,
      activeCat && global.TasuBusinessCategories?.getCategoryLabel?.(activeCat)
    );
    if (activeCat) {
      return appendDetailNavParams(href, {
        from: "category",
        returnTo,
        cat: activeCat,
        catLabel,
      });
    }
    return appendDetailNavParams(href, {
      from: "list",
      returnTo: returnTo || LIST_HREF,
    });
  }

  function appendFavoriteParams(href) {
    return appendDetailNavParams(href, {
      from: "favorite",
      returnTo: FAVORITE_HREF,
    });
  }

  function appendTalkParams(href, opts) {
    const notify = opts?.notify === true;
    return appendDetailNavParams(href, {
      from: notify ? "notify" : "talk",
      returnTo: pickStr(
        opts?.returnTo,
        notify ? NOTIFY_HREF : TALK_HREF
      ),
    });
  }

  global.TasuDetailNav = {
    parseFromLocation,
    appendDetailNavParams,
    renderBreadcrumbHtml,
    resolveBackLink,
    applyDetailNav,
    buildAiDetailUrl,
    appendBoardListParams,
    appendFavoriteParams,
    appendTalkParams,
  };
})(typeof window !== "undefined" ? window : globalThis);
