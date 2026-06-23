/**
 * TASFUL 共通パンくず — sessionStorage 遷移履歴 + data-breadcrumb 自動描画
 */
(function (global) {
  "use strict";

  const SEP = "＞";
  const STORAGE_STACK = "tasu_breadcrumb_stack_v1";
  const STORAGE_PENDING = "tasu_breadcrumb_pending_v1";
  const MAX_LEVELS = 5;

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(str) {
    return esc(str).replace(/'/g, "&#39;");
  }

  function isValidItem(item) {
    return item && String(item.label || "").trim();
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(isValidItem).map((item) => ({
      label: String(item.label).trim(),
      href: item.href ? String(item.href).trim() : "",
      key: item.key ? String(item.key).trim() : "",
    }));
  }

  function renderHtml(items, sep) {
    const list = normalizeItems(items);
    if (!list.length) return "";
    const parts = [];
    list.forEach((item, idx) => {
      if (idx > 0) {
        parts.push(`<span class="tasu-common-breadcrumb__sep" aria-hidden="true">${esc(sep)}</span>`);
      }
      const isLast = idx === list.length - 1;
      if (!isLast && item.href) {
        parts.push(`<a href="${escAttr(item.href)}">${esc(item.label)}</a>`);
      } else if (!isLast) {
        parts.push(`<span>${esc(item.label)}</span>`);
      } else {
        parts.push(`<span class="tasu-common-breadcrumb__current" aria-current="page">${esc(item.label)}</span>`);
      }
    });
    return parts.join("");
  }

  function applyTheme(nav, theme, extraClass) {
    nav.className = "tasu-common-breadcrumb";
    if (theme === "biz-detail") {
      nav.classList.add("biz-detail-breadcrumb");
    } else if (theme) {
      nav.classList.add(`tasu-common-breadcrumb--${theme}`);
    }
    if (extraClass) {
      extraClass.split(/\s+/).filter(Boolean).forEach((c) => nav.classList.add(c));
    }
  }

  function renderNav(nav, items, opts) {
    if (!nav) return false;
    const list = normalizeItems(items);
    if (!list.length) {
      nav.hidden = true;
      nav.innerHTML = "";
      return false;
    }
    applyTheme(nav, opts?.theme || nav.dataset.breadcrumbTheme || "platform", opts?.extraClass);
    nav.setAttribute("aria-label", opts?.ariaLabel || "パンくず");
    nav.innerHTML = renderHtml(list, opts?.sep || SEP);
    nav.hidden = false;
    return true;
  }

  function getNavs(selector) {
    return Array.from(global.document?.querySelectorAll(selector || "[data-breadcrumb]") || []);
  }

  function readJson(key, fallback) {
    try {
      const raw = global.sessionStorage?.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.sessionStorage?.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function readStack() {
    const stack = readJson(STORAGE_STACK, []);
    return Array.isArray(stack) ? stack.filter((e) => e && e.key && e.label) : [];
  }

  function writeStack(stack) {
    writeJson(STORAGE_STACK, stack);
  }

  function readPending() {
    return readJson(STORAGE_PENDING, null);
  }

  function writePending(pending) {
    if (!pending) {
      try {
        global.sessionStorage?.removeItem(STORAGE_PENDING);
      } catch {
        /* ignore */
      }
      return;
    }
    writeJson(STORAGE_PENDING, pending);
  }

  function isInternalHref(href) {
    const raw = String(href || "").trim();
    if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return false;
    if (/^(mailto:|tel:|sms:)/i.test(raw)) return false;
    try {
      const url = new URL(raw, global.location?.href || "http://localhost/");
      const origin = global.location?.origin || url.origin;
      if (url.origin !== origin) return false;
      const path = String(url.pathname || "");
      if (/^\/admin-operations|^\/api\//i.test(path)) return false;
      return /\.html$/i.test(path) || path === "/" || path.endsWith("/");
    } catch {
      return /^[a-z0-9_./-]+\.html/i.test(raw);
    }
  }

  function resolveFullHref(href) {
    try {
      const url = new URL(String(href || "").trim(), global.location?.href || "http://localhost/");
      const path = url.pathname.replace(/\\/g, "/");
      const search = url.search || "";
      return `${path.replace(/^\//, "")}${search}` || "index.html";
    } catch {
      return String(href || "").trim();
    }
  }

  function pageKeyFromHref(href) {
    const cfg = global.TasuBreadcrumbConfig;
    if (cfg?.pageKeyFromHref) return cfg.pageKeyFromHref(href);
    try {
      const url = new URL(String(href || "").trim(), global.location?.href || "http://localhost/");
      const pk = cfg?.normalizePageKey?.({ pathname: url.pathname }) || "";
      const id =
        url.searchParams.get("id") ||
        url.searchParams.get("listingId") ||
        url.searchParams.get("shopId") ||
        url.searchParams.get("productId") ||
        url.searchParams.get("thread") ||
        url.searchParams.get("project_id");
      return id ? `${pk}::${id}` : pk;
    } catch {
      return String(href || "").trim();
    }
  }

  function stackEntry(label, href) {
    const full = resolveFullHref(href || global.location?.href || "");
    return {
      key: pageKeyFromHref(full),
      label: String(label || "").trim(),
      href: full,
    };
  }

  function readPageLabel() {
    const body = global.document?.body;
    return (
      String(body?.dataset?.breadcrumbPageLabel || "").trim() ||
      String(global.document?.querySelector("[data-breadcrumb-page-label]")?.textContent || "").trim()
    );
  }

  function currentPageEntry(overrideLabel) {
    const cfg = global.TasuBreadcrumbConfig?.resolveCurrentMeta?.(global.location);
    const label =
      overrideLabel ||
      readPageLabel() ||
      cfg?.label ||
      cfg?.defaultLabel ||
      "現在地";
    return stackEntry(label, global.location?.href || "");
  }

  function pushDedupe(stack, item) {
    if (!item?.key || !item?.label) return stack;
    const idx = stack.findIndex((e) => e.key === item.key);
    if (idx >= 0) {
      const next = stack.slice(0, idx);
      next.push(item);
      return next;
    }
    return [...stack, item];
  }

  function compressStack(stack, max) {
    const limit = Math.max(2, Number(max) || MAX_LEVELS);
    if (stack.length <= limit) return stack;
    return stack.slice(-limit);
  }

  function stackToTrail(stack) {
    return stack.map(({ label, href }) => ({ label, href }));
  }

  function parseFromAttr(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => {
            if (!item) return null;
            const href = resolveFullHref(item.href || "");
            const label = String(item.label || "").trim();
            if (!label) return null;
            return { key: pageKeyFromHref(href), label, href };
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    }
    const parts = text.split("|");
    if (parts.length >= 2) {
      const href = resolveFullHref(parts[0]);
      const label = parts.slice(1).join("|").trim();
      if (label) return [{ key: pageKeyFromHref(href), label, href }];
    }
    return [];
  }

  function navigationType() {
    try {
      return global.performance?.getEntriesByType?.("navigation")?.[0]?.type || "";
    } catch {
      return "";
    }
  }

  function isDirectAccess(pending) {
    if (pending?.href) return false;
    const stack = readStack();
    const navType = navigationType();
    if (navType === "reload" && stack.length > 0) return false;
    if (navType === "reload") return true;
    const ref = String(global.document?.referrer || "").trim();
    if (!ref) return true;
    return !isInternalHref(ref);
  }

  function recoverStackFromReferrer(stack) {
    const ref = String(global.document?.referrer || "").trim();
    if (!ref || !isInternalHref(ref)) return stack;
    const refHref = resolveFullHref(ref);
    const refKey = pageKeyFromHref(refHref);
    if (stack.some((e) => e.key === refKey)) return stack;
    const refLabel =
      global.TasuBreadcrumbConfig?.resolveLabelForHref?.(refHref) ||
      global.TasuBreadcrumbConfig?.resolveCurrentMeta?.({ href: ref, pathname: new URL(ref).pathname })?.label ||
      "前のページ";
    return pushDedupe(stack, { key: refKey, label: refLabel, href: refHref });
  }

  function resolveStaticTrail() {
    const cfg = global.TasuBreadcrumbConfig?.resolveRoute?.(global.location);
    if (!cfg) return null;
    if (cfg.dynamic && !cfg.trail) return { ...cfg, trail: null };
    return cfg;
  }

  function renderFromStack(stack, theme, extraClass) {
    const trail = stackToTrail(stack);
    getNavs().forEach((nav) => {
      nav.dataset.breadcrumbManaged = "history";
      if (theme) nav.dataset.breadcrumbTheme = theme;
      renderNav(nav, trail, { theme, extraClass });
    });
    try {
      global.dispatchEvent(new CustomEvent("tasu:breadcrumb-updated", { detail: { items: trail, source: "history" } }));
    } catch {
      /* ignore */
    }
  }

  function buildHistoryTrail() {
    const pending = readPending();
    const staticCfg = resolveStaticTrail();
    const cfg = global.TasuBreadcrumbConfig?.resolveCurrentMeta?.(global.location) || staticCfg;
    const theme = staticCfg?.theme || cfg?.theme || "platform";

    if (staticCfg?.trail?.length && !staticCfg.dynamic) {
      writePending(null);
      const trail = staticCfg.trail.map((item) => ({
        label: String(item.label || "").trim(),
        href: item.href ? String(item.href).trim() : "",
      }));
      writeStack(
        trail.map((item, idx) => {
          const href =
            item.href ||
            (idx === trail.length - 1 ? resolveFullHref(global.location.href) : "");
          return {
            key: href ? pageKeyFromHref(href) : `static-${idx}`,
            label: item.label,
            href,
          };
        })
      );
      return { mode: "static", trail, theme };
    }

    if (isDirectAccess(pending)) {
      writePending(null);
      const directStaticCfg = resolveStaticTrail();
      if (directStaticCfg?.trail?.length) {
        writeStack(
          directStaticCfg.trail.map((item, idx) => {
            const href = item.href || (idx === directStaticCfg.trail.length - 1 ? resolveFullHref(global.location.href) : "");
            return {
              key: href ? pageKeyFromHref(href) : `static-${idx}`,
              label: item.label,
              href,
            };
          })
        );
        return { mode: "static", trail: directStaticCfg.trail, theme: directStaticCfg.theme || theme };
      }
      if (directStaticCfg?.dynamic) {
        const placeholder = directStaticCfg.defaultLabel || cfg?.defaultLabel || "詳細";
        writeStack([stackEntry(placeholder, global.location.href)]);
        return { mode: "history", trail: [{ label: placeholder }], theme };
      }
      return { mode: "none", trail: [], theme };
    }

    let stack = readStack();
    if (!stack.length) {
      stack = recoverStackFromReferrer(stack);
    }

    let pendingForCurrent = pending;
    if (pending?.href) {
      const pendingKey = pageKeyFromHref(resolveFullHref(pending.href));
      const currentKey = pageKeyFromHref(global.location.href);
      if (pendingKey && currentKey && pendingKey !== currentKey) {
        const parentLabel =
          String(pending.label || "").trim() ||
          global.TasuBreadcrumbConfig?.resolveLabelForHref?.(pending.href) ||
          "前のページ";
        stack = pushDedupe(stack, stackEntry(parentLabel, pending.href));
        pendingForCurrent = null;
      }
    }

    const currentLabel =
      pendingForCurrent?.label ||
      readPageLabel() ||
      cfg?.label ||
      cfg?.defaultLabel ||
      "現在地";
    const current = stackEntry(currentLabel, global.location.href);
    stack = pushDedupe(stack, current);
    stack = compressStack(stack, MAX_LEVELS);
    writeStack(stack);
    writePending(null);

    return { mode: "history", trail: stackToTrail(stack), theme };
  }

  function initNav(nav) {
    if (!nav || nav.dataset.breadcrumbManaged === "manual") return;
    const built = buildHistoryTrail();
    if (!built.trail?.length) {
      if (built.mode === "none") {
        nav.hidden = true;
        nav.innerHTML = "";
      }
      return;
    }
    nav.dataset.breadcrumbManaged = built.mode === "static" ? "static" : "history";
    nav.dataset.breadcrumbTheme = built.theme || "platform";
    renderNav(nav, built.trail, { theme: built.theme });
  }

  function initAll() {
    const built = buildHistoryTrail();
    getNavs().forEach((nav) => {
      if (nav.dataset.breadcrumbManaged === "manual") return;
      if (!built.trail?.length) {
        if (built.mode === "none") {
          nav.hidden = true;
          nav.innerHTML = "";
        }
        return;
      }
      nav.dataset.breadcrumbManaged = built.mode === "static" ? "static" : "history";
      nav.dataset.breadcrumbTheme = built.theme || "platform";
      renderNav(nav, built.trail, { theme: built.theme });
    });
  }

  function rerenderFromStack(opts) {
    const stack = readStack();
    if (!stack.length) return;
    const cfg = global.TasuBreadcrumbConfig?.resolveCurrentMeta?.(global.location);
    renderFromStack(stack, opts?.theme || cfg?.theme, opts?.extraClass);
  }

  function setTrail(items, opts) {
    const list = normalizeItems(items);
    if (opts?.replace || opts?.source === "static") {
      const navs = opts?.nav ? [opts.nav] : getNavs();
      navs.forEach((nav) => {
        if (!nav) return;
        nav.dataset.breadcrumbManaged = "manual";
        if (opts?.theme) nav.dataset.breadcrumbTheme = opts.theme;
        renderNav(nav, list, opts);
      });
      writeStack(
        list.map((item, idx) => ({
          key: item.href ? pageKeyFromHref(item.href) : `manual-${idx}`,
          label: item.label,
          href: item.href || "",
        }))
      );
      try {
        global.dispatchEvent(new CustomEvent("tasu:breadcrumb-updated", { detail: { items: list, source: "manual" } }));
      } catch {
        /* ignore */
      }
      return;
    }
    rerenderFromStack(opts);
  }

  function setCurrentLabel(label) {
    const text = String(label || "").trim();
    if (!text) return;
    const stack = readStack();
    if (stack.length) {
      stack[stack.length - 1].label = text;
      writeStack(stack);
    }
    getNavs().forEach((nav) => {
      const cur = nav.querySelector(".tasu-common-breadcrumb__current");
      if (cur) cur.textContent = text;
    });
    try {
      global.dispatchEvent(new CustomEvent("tasu:breadcrumb-updated", { detail: { label: text, source: "current-label" } }));
    } catch {
      /* ignore */
    }
  }

  function ensureParentEntry(item) {
    const parent = stackEntry(item.label, item.href);
    if (!parent.label) return;
    let stack = readStack();
    if (!stack.length) {
      stack = [parent, currentPageEntry()];
      writeStack(compressStack(stack, MAX_LEVELS));
      rerenderFromStack();
      return;
    }
    const last = stack[stack.length - 1];
    const parentIdx = stack.length - 2;
    if (parentIdx >= 0 && stack[parentIdx].key === parent.key) {
      stack[parentIdx] = { ...stack[parentIdx], ...parent };
    } else if (last.key === parent.key) {
      stack[stack.length - 1] = { ...last, ...parent };
    } else {
      stack = [...stack.slice(0, -1), parent, last];
    }
    writeStack(compressStack(stack, MAX_LEVELS));
    rerenderFromStack();
  }

  function setParentChain(parentItems) {
    const parents = normalizeItems(parentItems).map((item) => stackEntry(item.label, item.href));
    if (!parents.length) return;
    let stack = readStack();
    const current = stack.length ? { ...stack[stack.length - 1] } : currentPageEntry();
    const anchorBases = [
      "shop-store.html",
      "business.html",
      "dashboard.html",
      "index-top.html",
      "index.html",
      "talk-home.html",
      "ai-workspace.html",
    ];
    let cut = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      const base = String(stack[i].key || "").split("::")[0];
      if (anchorBases.includes(base)) {
        cut = i + 1;
        break;
      }
    }
    const prefix = stack.slice(0, cut);
    stack = [...prefix, ...parents, current];
    writeStack(compressStack(stack, MAX_LEVELS));
    rerenderFromStack();
  }

  function refresh() {
    getNavs().forEach((nav) => {
      if (nav.dataset.breadcrumbManaged === "manual") return;
      initNav(nav);
    });
  }

  function handleLinkClick(event) {
    const a = event.target?.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = a.getAttribute("href");
    if (!href || !isInternalHref(href)) return;

    let stack = readStack();
    const leavingKey = pageKeyFromHref(global.location?.href || "");
    const last = stack[stack.length - 1];
    if (!last || last.key !== leavingKey) {
      stack = pushDedupe(stack, currentPageEntry());
    }

    const fromSeed = parseFromAttr(a.dataset.breadcrumbFrom);
    if (fromSeed.length) {
      stack = fromSeed;
    }

    writeStack(compressStack(stack, MAX_LEVELS));

    const destHref = resolveFullHref(href);
    const destLabel =
      String(a.dataset.breadcrumbLabel || "").trim() ||
      global.TasuBreadcrumbConfig?.resolveLabelForHref?.(destHref, { link: a }) ||
      "次へ";
    writePending({ href: destHref, label: destLabel, key: pageKeyFromHref(destHref) });
  }

  function bindNavigationCapture() {
    if (global.document?.__tasuBreadcrumbCaptureBound) return;
    global.document.__tasuBreadcrumbCaptureBound = true;
    global.document.addEventListener("click", handleLinkClick, true);
  }

  /** detail-nav-context 互換 — 直接アクセス時の静的フォールバック用 */
  function itemsFromDetailNav(ctx, listing) {
    const company = listing?.company_name || listing?.title || "詳細";
    const catLabel = ctx?.catLabel || listing?.categoryLabel || listing?.business_category || "業者";
    const LIST = "business.html";
    const from = String(ctx?.from || "list").trim();

    const aiHome =
      global.TasuAiWorkspaceLinks?.buildUrl?.({
        mode: global.TasuAiWorkspaceLinks?.DEFAULT_MODE || "cross-matching",
      }) || "ai-workspace.html?mode=cross-matching";

    const resolveAiReturnTo = () => {
      if (ctx?.returnTo) return ctx.returnTo;
      const state = global.TasuAiSearchState?.read?.();
      if (state?.returnHref) return state.returnHref;
      return aiHome;
    };

    const resolveCategoryHref = () => {
      if (ctx?.returnTo) return ctx.returnTo;
      if (ctx?.cat) return `${LIST}?business_category=${encodeURIComponent(ctx.cat)}`;
      return LIST;
    };

    switch (from) {
      case "ai":
        return [
          { label: "TASFUL AI", href: aiHome },
          { label: "検索結果", href: resolveAiReturnTo() },
          { label: company },
        ];
      case "favorite":
        return [
          { label: "お気に入り", href: "favorites-list.html" },
          { label: company },
        ];
      case "talk":
        return [
          { label: "TALK", href: "talk-home.html?tab=chat" },
          { label: company },
        ];
      case "notify":
        return [
          { label: "通知", href: "talk-home.html?tab=notify" },
          { label: company },
        ];
      case "category":
        return [
          { label: "法人・業者一覧", href: LIST },
          { label: catLabel, href: resolveCategoryHref() },
          { label: company },
        ];
      default:
        return [
          { label: "法人・業者一覧", href: LIST },
          { label: catLabel },
          { label: company },
        ];
    }
  }

  function itemsFromStoreShop(listing) {
    const shopName = listing?.company_name || listing?.title || "ショップ";
    if (!global.TasuBusinessWording?.pickStoreShopBreadcrumbGenre) {
      return [
        { label: "ショップ一覧", href: "business.html" },
        { label: shopName },
      ];
    }
    const genre = global.TasuBusinessWording.pickStoreShopBreadcrumbGenre(listing);
    return [
      { label: "ショップ一覧", href: "business.html" },
      { label: genre, href: "business.html?business_category=shop_store" },
      { label: shopName },
    ];
  }

  function applyDetailFallback(ctx, listing, opts) {
    const stack = readStack();
    const company = listing?.company_name || listing?.title || "詳細";
    const hasHistoryTrail = stack.length > 1 && !isDirectAccess(null);
    if (hasHistoryTrail) {
      setCurrentLabel(company);
      rerenderFromStack({ theme: opts?.theme, extraClass: opts?.extraClass });
      return true;
    }
    const items = opts?.shop
      ? itemsFromStoreShop(listing)
      : itemsFromDetailNav(ctx, listing);
    setTrail(items, { ...opts, replace: true, source: "static" });
    return false;
  }

  global.TasuCommonBreadcrumb = {
    init: initAll,
    refresh,
    setTrail,
    setCurrentLabel,
    ensureParentEntry,
    setParentChain,
    renderNav,
    itemsFromDetailNav,
    itemsFromStoreShop,
    applyDetailFallback,
    readStack,
    writeStack,
    clearStack: () => writeStack([]),
    normalizePageKey: () => global.TasuBreadcrumbConfig?.normalizePageKey?.(global.location) || "",
    isInternalHref,
  };

  bindNavigationCapture();

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})(typeof window !== "undefined" ? window : globalThis);
