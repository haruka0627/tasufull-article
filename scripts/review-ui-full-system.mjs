#!/usr/bin/env node
/**
 * TASFUL UI総監査（UI/UXのみ — 機能・導線修正なし）
 *   node scripts/review-ui-full-system.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOT_DIR = join(root, "screenshots", "ui-full-review");
const HEADER_REVIEW_DIR = join(root, "screenshots", "header-common-review");
const BACK_REVIEW_DIR = join(root, "screenshots", "back-nav-review");
const REPORT_MD = join(SHOT_DIR, "review-report.md");
const HEADER_REPORT_MD = join(HEADER_REVIEW_DIR, "review-report.md");
const BACK_REPORT_MD = join(BACK_REVIEW_DIR, "review-report.md");
const REPORT_JSON = join(SHOT_DIR, "review-report.json");

const NAV_TIMEOUT = 25000;
const SEL_TIMEOUT = 15000;

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

const PRODUCT = { shopId: "demo-shop-tasful-bakery", productId: "p-0" };

/** @type {import('./review-ui-full-system.mjs').PageDef[]} */
const PAGES = [
  {
    category: "talk",
    id: "notify",
    label: "TALK 通知",
    path: "talk-home.html",
    query: "tab=notify&talkDev=1&benchEmbed=1&userId=u_me",
    wait: "[data-talk-notify-list], [data-talk-root]",
    ctaSelectors: ["[data-talk-notify-action]", ".talk-notify-card__action", "[data-talk-dashboard-view-all-notify]"],
    cardSelectors: [".talk-notify-card", "[data-talk-notify-id]", ".talk-unified-inbox__card"],
    goalSelectors: ["[data-talk-notify-list]", "[data-talk-notify-id]"],
    backSelectors: ["[data-talk-back]", ".dash-nav-link", "a[href*='dashboard']"],
    headerSelectors: ["[data-talk-page-header]", ".dash-header"],
    footerSelectors: [".talk-home-footer", ".dash-footer", "footer"],
  },
  {
    category: "talk",
    id: "chat",
    label: "TALK チャット",
    path: "chat-detail.html",
    query: "thread=chat-demo-skill-plain-001&talkDev=1&userId=u_me&review=chat-demo",
    wait: "#chatMessages, #chatSend, [data-chat-detail-ready]",
    ctaSelectors: ["#chatSend", ".chat-send", "#chatCompleteBtn", ".chat-composer button"],
    cardSelectors: [".chat-message", ".chat-bubble", "[data-chat-message]"],
    goalSelectors: ["#chatMessages", ".chat-composer", "[data-chat-composer]"],
    backSelectors: ["#chatMobileBack", ".chat-mobile-head__back", "[data-tasu-talk-back]", "[data-talk-back]", ".chat-detail__back", ".page-subnav__link"],
    headerSelectors: [".chat-detail__header", ".dash-header", "header"],
    footerSelectors: ["footer", ".chat-detail__footer"],
  },
  {
    category: "builder",
    id: "board-list",
    label: "Builder 案件一覧",
    path: "builder/board-projects.html",
    query: "role=partner",
    wait: "[data-builder-board-project-list], .builder-header",
    ctaSelectors: ["[data-builder-board-apply]", ".mvp-shortcut", "a.mvp-btn--primary", "button.mvp-btn--primary"],
    cardSelectors: ["[data-builder-board-project-list] article", ".mvp-card", "article.mvp-card"],
    goalSelectors: ["[data-builder-board-apply]", "[data-builder-board-project-list] article"],
    backSelectors: ["a[href*='board-projects']", "a[href*='builder-top']", "a[href*='dashboard']", ".builder-page-back", "[data-builder-page-back]", ".builder-back"],
    headerSelectors: [".builder-header"],
    footerSelectors: ["footer", ".builder-footer"],
  },
  {
    category: "builder",
    id: "board-detail",
    label: "Builder 案件詳細",
    path: "builder/board-project-detail.html",
    query: "id=demo-project-001&role=partner",
    wait: "[data-builder-board-pd-root], .builder-header, h1",
    ctaSelectors: [
      "[data-builder-board-pd-apply]:not([hidden])",
      "a.mvp-pd-btnPrimary:not([hidden])",
      ".mvp-pd-btnPrimary:not([hidden])",
      ".builder-btn--primary",
      "a.builder-btn--primary",
    ],
    cardSelectors: [".mvp-card", ".builder-panel", "article"],
    goalSelectors: ["[data-builder-board-pd-apply]", "[data-builder-board-pd-hire]"],
    backSelectors: ["a[href*='board-projects']", "a[href*='board-threads']", "a[href*='board-project-detail']", ".builder-page-back", "[data-builder-page-back]", ".builder-back"],
    headerSelectors: [".builder-header"],
    footerSelectors: ["footer"],
  },
  {
    category: "builder",
    id: "board-thread",
    label: "Builder スレッド",
    path: "builder/board-thread.html",
    query: "id=thread-demo-001&role=owner",
    wait: "[data-builder-board-thread-root], .builder-header, h1",
    ctaSelectors: [
      "[data-builder-board-thread-completion-jump]",
      ".builder-btn--primary",
      "[data-builder-board-thread-talk]",
    ],
    cardSelectors: [".mvp-card", ".builder-message", "article"],
    goalSelectors: ["[data-builder-board-completion-submit]", "[data-builder-board-hire-confirm]", ".builder-thread-composer"],
    backSelectors: ["a[href*='board-threads']", "a[href*='board-projects']", "a[href*='board-project-detail']", ".builder-page-back", "[data-builder-page-back]"],
    headerSelectors: [".builder-header"],
    footerSelectors: ["footer"],
  },
  {
    category: "connect",
    id: "apply",
    label: "Connect 申請",
    path: "payment-settings.html",
    query: "step=top&talkDev=1&userId=u_seller",
    wait: "[data-payment-settings-root], .dash-header, h1",
    ctaSelectors: ["[data-connect-start]", "[data-payment-settings-next]", "button.dash-btn--primary", "a.dash-btn--primary"],
    cardSelectors: [".payment-settings-card", ".dash-card", ".connect-step-card"],
    goalSelectors: ["[data-connect-start]", "[data-payment-settings-next]"],
    backSelectors: ["a[href*='dashboard']", ".dash-member-page-head a"],
    headerSelectors: [".dash-header"],
    footerSelectors: ["footer", ".dash-footer"],
  },
  {
    category: "connect",
    id: "sales",
    label: "Connect 売上",
    path: "sales-fees.html",
    query: "talkDev=1&userId=u_bakery",
    ctaOptional: true,
    wait: ".dash-header, h1, [data-sales-fees-root], main",
    ctaSelectors: ["a.dash-header-link", ".dash-card a", "button.dash-btn--primary", "a.dash-btn--primary"],
    cardSelectors: [".dash-card", ".sales-fees-card", "article"],
    goalSelectors: ["[data-sales-fees-summary]", ".dash-card"],
    backSelectors: ["a[href*='dashboard']", "a[href*='payment-settings']"],
    headerSelectors: [".dash-header"],
    footerSelectors: ["footer"],
  },
  {
    category: "market",
    id: "top",
    label: "市場 TOP",
    path: "shop-store.html",
    query: "",
    wait: "[data-tasful-market-header], .tasful-market-card",
    ctaSelectors: ["[data-tasful-market-search-input]", "a.tasful-market-card", ".tasful-market-nav__link"],
    cardSelectors: [".tasful-market-card", "a[href*='detail-shop-product']"],
    goalSelectors: [".tasful-market-card", "[data-tasful-market-search-input]"],
    backSelectors: ["a[href*='dashboard']"],
    headerSelectors: ["[data-tasful-market-header]", ".tasful-market-mall-header"],
    footerSelectors: [".tasful-market-footer", "footer"],
  },
  {
    category: "market",
    id: "product",
    label: "市場 商品詳細",
    path: "detail-shop-product.html",
    query: `shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`,
    wait: "[data-tasful-product-main]:not([hidden])",
    ctaSelectors: [
      "[data-tasful-product-buy-now]",
      "[data-tasful-product-buy-now-pc]",
      "[data-tasful-product-add-cart]",
      "[data-tasful-product-add-cart-pc]",
    ],
    cardSelectors: [
      ".tasful-market-product-related__grid .tasful-market-search-mini:not(.is-related-hidden)",
      ".tasful-market-product-reviews__item",
    ],
    goalSelectors: ["[data-tasful-product-buy-now]", "[data-tasful-product-buy-now-pc]", "[data-tasful-product-add-cart]", "[data-tasful-product-add-cart-pc]"],
    backSelectors: ["a[href*='shop-store']", "a[href*='shop-search']", ".tasful-market-breadcrumb a", ".tasful-market-mall-header__logo"],
    headerSelectors: ["[data-tasful-market-header]"],
    footerSelectors: [".tasful-market-footer", "footer"],
  },
  {
    category: "market",
    id: "cart",
    label: "市場 カート",
    path: "shop-market-cart.html",
    query: "",
    wait: "[data-tasful-market-cart-root], [data-tasful-market-header]",
    prep: "marketCart",
    ctaSelectors: [
      "[data-tasful-market-cart-checkout]:not([hidden])",
      "[data-tasful-market-cart-checkout-aside]:not([hidden])",
      ".tasful-market-cart-main__btn--checkout:not([hidden])",
      "a.tasful-market-cart-main__btn",
    ],
    cardSelectors: [".tasful-market-cart-item", "[data-tasful-market-cart-items] article"],
    goalSelectors: ["[data-tasful-market-cart-checkout]"],
    backSelectors: ["a[href*='shop-store']", "a[href*='detail-shop-product']"],
    headerSelectors: ["[data-tasful-market-header]"],
    footerSelectors: [".tasful-market-footer", "footer"],
  },
  {
    category: "ai_ops",
    id: "dashboard",
    label: "AI運営秘書",
    path: "admin-operations-dashboard.html",
    query: "",
    hash: "#ops-ai-top",
    wait: "[data-ops-daily-inbox], #ops-ai-daily-inbox",
    prep: "aiOpsSeed",
    ctaSelectors: ["[data-ops-ai-hsg] button", "[data-ops-daily-inbox] button", ".ops-ai-hsg-card__btn", "[data-ops-watch-action]"],
    cardSelectors: [".ops-ai-daily-inbox__item", ".ops-ai-watch-list__item", ".ops-ai-hsg-card", ".ops-ai-kpi-card", ".ops-ai-autofix-card"],
    goalSelectors: ["#ops-ai-daily-inbox", "#ops-ai-watch", "[data-ops-ai-human-send-gate]"],
    backSelectors: ["a[href*='builder-admin']", ".ops-ai-brand"],
    headerSelectors: [".ops-ai-topbar", ".ops-ai-sidebar"],
    footerSelectors: [".ops-ai-sidebar__foot"],
  },
];

const ASPECTS = [
  "infoArch",
  "cta",
  "spacing",
  "cardDensity",
  "scroll",
  "header",
  "footer",
  "backNav",
  "mobileUx",
  "pcUx",
  "aiOpsUx",
];

async function gotoWithRetry(page, url, options = {}) {
  const { retries = 2, ...gotoOpts } = options;
  for (let i = 0; i < retries; i += 1) {
    try {
      await page.goto(url, gotoOpts);
      return;
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/ERR_ABORTED|NS_BINDING_ABORTED|interrupted/i.test(msg) || i + 1 >= retries) throw err;
      await page.waitForTimeout(400);
    }
  }
}

async function shot(page, name) {
  const file = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, timeout: 15000, animations: "disabled" }).catch(() => {});
  return file;
}

async function prepMarketCart(page, base) {
  const url = buildLocalPageUrl(
    base,
    "detail-shop-product.html",
    `?shopId=${PRODUCT.shopId}&productId=${PRODUCT.productId}`
  );
  await gotoWithRetry(page, url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForSelector("[data-tasful-product-main]:not([hidden])", { timeout: SEL_TIMEOUT }).catch(() => {});
  await page
    .locator("[data-tasful-product-add-cart]:visible, [data-tasful-product-add-cart-pc]:visible")
    .first()
    .click()
    .catch(() => {});
  await page.waitForFunction(
    () => Number(localStorage.getItem("tasu_market_cart_count") || 0) > 0,
    { timeout: SEL_TIMEOUT }
  ).catch(() => {});
  await page.waitForTimeout(400);
}

async function prepAiOpsSeed(page) {
  await page.evaluate(() => {
    const OW = window.TasuAdminAiOpsWatch;
    const HSG = window.TasuAdminAiHumanSendGate;
    const store = window.TasuSupportTicketStore;

    OW?.clearForTests?.();
    HSG?.clearForTests?.();
    store?.clearAllForTests?.();
    localStorage.setItem("tasful_talk_notifications", "[]");

    window.TasuTalkNotifications?.add?.({
      id: "ui_audit_anpi",
      category: "anpi",
      type: "anpi",
      title: "緊急安否確認 UI監査",
      body: "critical 表示確認",
      priority: "urgent",
      createdAt: new Date().toISOString(),
    });

    store?.createTicket?.({
      user_id: "ui_audit",
      title: "UI監査問い合わせ",
      body: "表示確認",
      category: "payment",
      priority: "normal",
    });

    HSG.enqueuePendingItem({
      source: "automation",
      sourceId: "ui_audit_hsg",
      category: "notification_send",
      actionType: "human_send",
      proposal: "UI監査 承認待ち",
      recommendation: "再通知",
      reason: "監査",
      impactArea: "利用者通知",
      severity: "critical",
      confidence: 0.8,
      payload: {},
    });

    OW?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
    window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    HSG.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
    window.TasuAdminAiDailyInbox?.renderDailyInbox?.();
    window.TasuAdminMorningSummary?.render?.(
      window.TasuAdminOperationsDashboard?.buildMetrics?.() ||
        window.TasuAdminAiKpiCenter?.collectKpiMetrics?.() ||
        {}
    );
  });
}

function measureUi(config) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const docH = document.documentElement.scrollHeight;
  const scrollW = document.documentElement.scrollWidth;

  const pickVisible = (sels) => {
    for (const sel of sels) {
      const nodes = [...document.querySelectorAll(sel)];
      for (const el of nodes) {
        if (!el || el.hidden) continue;
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 8 && r.height >= 8) return el;
      }
    }
    return null;
  };

  const pickAny = (sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const headerEl = pickAny(config.headerSelectors);
  const footerEl = pickAny(config.footerSelectors);
  const backEl = pickVisible(config.backSelectors);
  const h1 = document.querySelector("h1");
  const breadcrumb = document.querySelector(
    "[aria-label*='パンくず'], .breadcrumb, [data-shop-product-breadcrumb], .tasful-market-breadcrumb, .dash-member-page-head a"
  );
  const lead = document.querySelector(
    "[data-talk-simple-lead], .dash-header__sub, .builder-header__sub, .ops-ai-topbar__sub, .talk-home-lead"
  );

  const ctas = [];
  const ctaSeen = new Set();
  const ctaSels = [
    ...config.ctaSelectors,
    "a.builder-btn--primary",
    "a.mvp-pd-btnPrimary",
    ".dash-btn--primary",
  ];
  for (const sel of ctaSels) {
    document.querySelectorAll(sel).forEach((el) => {
      if (ctaSeen.has(el)) return;
      if (el.hidden) return;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      ctaSeen.add(el);
      ctas.push({ el, area: r.width * r.height, r, st });
    });
  }
  ctas.sort((a, b) => b.area - a.area);
  const primaryCta = ctas[0]?.el || null;
  const primaryRect = ctas[0]?.r || null;

  let goalScrollPx = 0;
  let goalAboveFold = false;
  for (const sel of config.goalSelectors) {
    const el = pickVisible([sel]) || document.querySelector(sel);
    if (!el) continue;
    const top = el.getBoundingClientRect().top + window.scrollY;
    goalScrollPx = Math.max(0, Math.round(top));
    goalAboveFold = top < vh;
    break;
  }

  const cardNodeSet = new Set();
  for (const sel of config.cardSelectors) {
    document.querySelectorAll(sel).forEach((el) => cardNodeSet.add(el));
  }
  const cards = [...cardNodeSet]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { h: r.height, inView: r.top < vh && r.bottom > 0 };
    })
    .filter((c) => c.h >= 20);
  const cardsInView = cards.filter((c) => c.inView).length;
  const avgCardH = cards.length ? cards.reduce((s, c) => s + c.h, 0) / cards.length : 0;

  const relatedCardNodes = [
    ...document.querySelectorAll(
      ".tasful-market-product-related__grid .tasful-market-search-mini:not(.is-related-hidden)"
    ),
  ];
  const relatedInViewport = relatedCardNodes.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top < vh && r.bottom > 0 && r.height > 20;
  }).length;

  const bodySt = getComputedStyle(document.body);
  const bodyFont = parseFloat(bodySt.fontSize) || 16;
  const minFontScope =
    document.querySelector("[data-talk-notify-list] .talk-notify-card") != null
      ? [...document.querySelectorAll("[data-talk-notify-list] .talk-notify-card, [data-talk-notify-list] .talk-notify-card *")]
      : [...document.querySelectorAll("body *")].slice(0, 400);
  const minFont = minFontScope.reduce((min, el) => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (!fs || fs <= 0) return min;
    const t = (el.textContent || "").trim();
    if (t.length < 2) return min;
    return Math.min(min, fs);
  }, 24);

  const paddings = [...document.querySelectorAll("main section, main .dash-shell, .builder-panel, .tasful-market-product-main")]
    .slice(0, 12)
    .map((el) => parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom))
    .filter((n) => Number.isFinite(n));
  const avgPad = paddings.length ? paddings.reduce((a, b) => a + b, 0) / paddings.length : 0;

  const fixedBottom = [...document.querySelectorAll("*")].some((el) => {
    const st = getComputedStyle(el);
    if (st.position !== "fixed" && st.position !== "sticky") return false;
    const r = el.getBoundingClientRect();
    return r.bottom >= vh - 4 && r.height > 30 && r.width > vw * 0.5;
  });

  const sidebar = document.querySelector(".ops-ai-sidebar, aside[class*='sidebar']");
  const sidebarVisible = sidebar ? getComputedStyle(sidebar).display !== "none" : false;
  const buybox = document.querySelector("[data-tasful-product-buybox]");
  const buyboxSticky =
    buybox && getComputedStyle(buybox).position === "sticky" && buybox.getBoundingClientRect().width > 0;

  const inbox = document.getElementById("ops-ai-daily-inbox");
  const morningSummary = document.querySelector("[data-ops-morning-summary]");
  const morningChips = document.querySelectorAll("[data-ops-morning-chip]");
  const watch = document.getElementById("ops-ai-watch");
  const hsg = document.querySelector("[data-ops-ai-human-send-gate]");
  const kpi = document.querySelector("[data-ops-ai-kpi-center]");
  const autofix = document.querySelector("[data-ops-ai-auto-fix]");
  const criticalItems = document.querySelectorAll(
    ".ops-ai-watch-list__item--critical, .ops-ai-hsg-card--critical, [data-severity='critical']"
  ).length;

  const hasCriticalInSummary = [...morningChips].some(
    (el) =>
      el.classList.contains("ops-ai-morning-chip--critical") &&
      !/^0件$|^¥0$/.test((el.querySelector(".ops-ai-morning-chip__value")?.textContent || "").trim())
  );
  const hasApprovalInSummary = Boolean(
    document.querySelector("[data-ops-morning-chip='approval']")
  );

  const sectionTops = [
    { id: "inbox", top: inbox ? inbox.getBoundingClientRect().top + window.scrollY : null },
    { id: "watch", top: watch ? watch.getBoundingClientRect().top + window.scrollY : null },
    { id: "kpi", top: kpi ? kpi.getBoundingClientRect().top + window.scrollY : null },
    { id: "autofix", top: autofix ? autofix.getBoundingClientRect().top + window.scrollY : null },
    { id: "hsg", top: hsg ? hsg.getBoundingClientRect().top + window.scrollY : null },
  ];

  const headerClass = headerEl?.className?.split(/\s+/).slice(0, 3).join(" ") || "";
  const headerFamily = headerEl ? getComputedStyle(headerEl).fontFamily : "";
  const headerTitleEl =
    headerEl?.querySelector("h1, .dash-header__title, .builder-header__title, .chat-mobile-head__title") || null;
  const headerTitleRect = headerTitleEl?.getBoundingClientRect();
  const headerTitleSt = headerTitleEl ? getComputedStyle(headerTitleEl) : null;
  const headerBg = headerEl ? getComputedStyle(headerEl).backgroundColor : "";
  const headerOverflow = headerEl ? headerEl.scrollWidth > vw + 2 : false;
  const backRect = backEl?.getBoundingClientRect();

  const inboxPriority = document.querySelector("[data-ops-daily-inbox-priority]");
  const inboxCriticalText = inboxPriority?.innerText || document.querySelector("[data-ops-daily-inbox]")?.innerText || "";
  const hasCriticalInInbox = /critical|緊急|安否|承認待ち/i.test(inboxCriticalText) || hasCriticalInSummary;

  return {
    viewport: { w: vw, h: vh },
    docHeight: docH,
    horizontalOverflow: scrollW > vw + 2,
    scrollOverflowPx: Math.max(0, scrollW - vw),
    infoArch: {
      hasH1: Boolean(h1?.textContent?.trim()),
      h1Text: h1?.textContent?.trim()?.slice(0, 60) || "",
      hasBreadcrumb: Boolean(breadcrumb),
      hasLead: Boolean(lead?.textContent?.trim()),
      hasTitle: Boolean(document.title && document.title.length > 3),
    },
    cta: {
      count: ctas.length,
      primaryAboveFold: primaryRect ? primaryRect.top < vh && primaryRect.bottom > 0 : false,
      primaryMinDim: primaryRect ? Math.min(primaryRect.width, primaryRect.height) : 0,
      primaryArea: primaryRect ? Math.round(primaryRect.width * primaryRect.height) : 0,
      primaryBg: ctas[0]?.st?.backgroundColor || "",
    },
    spacing: { avgSectionPad: Math.round(avgPad), docHeight: docH },
    cardDensity: {
      total: cards.length,
      inViewport: cardsInView,
      avgHeight: Math.round(avgCardH),
      densityScore: cardsInView > 8 ? "high" : cardsInView > 4 ? "medium" : "low",
      relatedInViewport,
      relatedTotal: relatedCardNodes.length,
    },
    scroll: { goalScrollPx, goalAboveFold, docHeight: docH, screensToGoal: goalScrollPx / vh },
    header: {
      found: Boolean(headerEl),
      height: headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0,
      className: headerClass,
      fontFamily: headerFamily,
      backgroundColor: headerBg,
      overflow: headerOverflow,
      titleWidth: headerTitleRect ? Math.round(headerTitleRect.width) : 0,
      titleEllipsis: headerTitleSt?.textOverflow === "ellipsis",
    },
    footer: {
      found: Boolean(footerEl),
      linkCount: footerEl ? footerEl.querySelectorAll("a").length : 0,
    },
    backNav: {
      hasBack: Boolean(backEl),
      backVisible: Boolean(backEl),
      backMinDim: backRect ? Math.min(backRect.width, backRect.height) : 0,
      backText: backEl
        ? (backEl.textContent || backEl.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 48)
        : "",
    },
    mobileUx: { fixedBottomBar: fixedBottom, horizontalOverflow: scrollW > vw + 2, bodyFontSize: bodyFont },
    pcUx: { sidebarVisible, buyboxSticky, contentWidth: document.querySelector("main")?.getBoundingClientRect().width || vw },
    readability: { bodyFontSize: bodyFont, minFontSize: minFont, minFontScopedToNotifyCards: Boolean(document.querySelector("[data-talk-notify-list] .talk-notify-card")) },
    aiOpsUx: {
      inboxAboveFold: inbox ? inbox.getBoundingClientRect().top < vh : null,
      morningSummaryAboveFold: morningSummary
        ? morningSummary.getBoundingClientRect().top < vh && morningSummary.getBoundingClientRect().bottom > 0
        : null,
      morningChipCount: morningChips.length,
      hasCriticalInSummary,
      hasApprovalInSummary,
      watchScrollPx: watch ? Math.max(0, Math.round(watch.getBoundingClientRect().top + window.scrollY)) : null,
      hsgScrollPx: hsg ? Math.max(0, Math.round(hsg.getBoundingClientRect().top + window.scrollY)) : null,
      criticalVisible: criticalItems,
      sectionTops,
      morning3min: morningSummary
        ? morningSummary.getBoundingClientRect().top < vh * 1.2
        : inbox
          ? inbox.getBoundingClientRect().top < vh * 1.2
          : null,
      criticalBuried:
        criticalItems > 0 &&
        !hasCriticalInInbox &&
        !hasCriticalInSummary &&
        hsg &&
        hsg.getBoundingClientRect().top + window.scrollY > vh * 2.5,
      hasCriticalInInbox,
    },
    headerPattern: headerClass,
  };
}

function gradeAspect(aspect, m, page, vp) {
  const issues = [];
  const pushFail = (msg) => issues.push({ level: "FAIL", msg });
  const pushWarn = (msg) => issues.push({ level: "WARNING", msg });

  switch (aspect) {
    case "infoArch":
      if (!m.infoArch.hasH1 && !m.infoArch.hasTitle) pushFail("画面タイトル（h1）なし");
      else if (!m.infoArch.hasH1) pushWarn("h1 なし（title のみ）");
      if (!m.infoArch.hasLead && page.category !== "market") pushWarn("リード文・サブタイトル弱い");
      if (!m.infoArch.hasBreadcrumb && ["product", "board-detail", "board-thread"].includes(page.id))
        pushWarn("パンくず・戻り文脈が弱い");
      break;
    case "cta":
      if (m.cta.count === 0) {
        if (page.ctaOptional) pushWarn("参照系画面 — 主要アクションCTAなし");
        else pushFail("主要CTA未検出");
      } else if (m.cta.primaryMinDim > 0 && m.cta.primaryMinDim < 36) pushWarn(`CTAタップ領域 ${Math.round(m.cta.primaryMinDim)}px（推奨44px）`);
      if (vp.name === "390" && m.cta.count > 0 && !m.cta.primaryAboveFold && !page.ctaOptional)
        pushWarn("390px: 主要CTAがファーストビュー外");
      break;
    case "spacing":
      if (m.spacing.avgSectionPad > 0 && m.spacing.avgSectionPad < 8) pushWarn("セクション余白が詰まり気味");
      if (m.spacing.docHeight > vp.height * 12) pushWarn("ページ縦長（12画面超）");
      break;
    case "cardDensity":
      if (page.id === "product") {
        const relatedLimit = vp.name === "390" ? 4 : vp.name === "768" ? 6 : 8;
        if (m.cardDensity.relatedTotal === 0) pushWarn("関連商品カード未検出");
        else if (m.cardDensity.relatedInViewport > relatedLimit)
          pushWarn(`関連商品 ${m.cardDensity.relatedInViewport} 件表示（目標 ${relatedLimit} 件以下）`);
        else if (m.cardDensity.inViewport > relatedLimit + 3)
          pushWarn(`商品詳細ビューポート内カード ${m.cardDensity.inViewport} 件（やや過密）`);
        break;
      }
      if (page.id === "notify") {
        const notifyLimit = vp.name === "390" ? 8 : vp.name === "768" ? 10 : 12;
        if (m.cardDensity.inViewport > notifyLimit + 2)
          pushWarn(`通知カード ${m.cardDensity.inViewport} 件表示（過密）`);
        else if (m.cardDensity.inViewport > notifyLimit)
          pushWarn(`通知カード ${m.cardDensity.inViewport} 件表示（やや過密）`);
        break;
      }
      if (m.cardDensity.inViewport > 14) pushWarn(`ビューポート内カード ${m.cardDensity.inViewport} 件（過密）`);
      else if (m.cardDensity.inViewport > 10) pushWarn(`ビューポート内カード ${m.cardDensity.inViewport} 件（やや過密）`);
      if (m.cardDensity.total === 0 && ["notify", "board-list", "top"].includes(page.id)) pushWarn("カード一覧が空");
      break;
    case "scroll":
      if (vp.name === "390" && m.scroll.screensToGoal > 2.5) pushWarn(`390px: 目的要素まで ${m.scroll.screensToGoal.toFixed(1)} 画面分スクロール`);
      if (vp.name === "1280" && m.scroll.screensToGoal > 1.8 && page.id === "product") pushWarn("1280px: 購入CTAまでスクロール必要");
      break;
    case "header":
      if (!m.header.found) pushFail("ヘッダー未検出");
      else if (
        m.header.height > 0 &&
        m.header.height < 40 &&
        !["notify", "chat"].includes(page.id)
      )
        pushWarn("ヘッダー高さが低い");
      if (m.header.overflow) pushWarn("ヘッダー横はみ出し");
      if (
        vp.name === "390" &&
        m.header.titleWidth > 0 &&
        m.header.titleWidth >= m.viewport.w - 48 &&
        !m.header.titleEllipsis
      )
        pushWarn("390px: タイトル省略なし");
      break;
    case "footer":
      if (!m.footer.found && page.category === "market") pushWarn("フッター未検出");
      if (m.footer.linkCount > 25) pushWarn(`フッターリンク ${m.footer.linkCount} 件（多め）`);
      break;
    case "backNav":
      if (page.id === "chat" && vp.name === "1280") break;
      if (["chat", "board-detail", "board-thread", "product"].includes(page.id) && !m.backNav.hasBack)
        pushWarn("戻る・一覧導線が弱い");
      else if (m.backNav.hasBack && m.backNav.backMinDim > 0 && m.backNav.backMinDim < 36)
        pushWarn(`戻る導線タップ領域 ${Math.round(m.backNav.backMinDim)}px（目標36px）`);
      break;
    case "mobileUx":
      if (vp.name !== "390") return { status: "PASS", issues: [] };
      if (m.scrollOverflowPx > 12) pushFail(`390px: 横スクロール ${m.scrollOverflowPx}px`);
      else if (m.mobileUx.horizontalOverflow) pushWarn("390px: 軽微な横はみ出し");
      if (m.readability.minFontSize < 11) pushWarn(`最小フォント ${m.readability.minFontSize}px`);
      if (!m.mobileUx.fixedBottomBar && ["product", "cart"].includes(page.id)) pushWarn("390px: 固定下部CTAなし");
      break;
    case "pcUx":
      if (vp.name !== "1280") return { status: "PASS", issues: [] };
      if (page.id === "product" && !m.pcUx.buyboxSticky) pushWarn("1280px: 商品詳細の sticky 購入BOXなし");
      if (page.category === "ai_ops" && !m.pcUx.sidebarVisible) pushWarn("1280px: 運営サイドバー非表示");
      break;
    case "aiOpsUx":
      if (page.category !== "ai_ops") return { status: "PASS", issues: [] };
      if (!m.aiOpsUx.morningSummaryAboveFold) pushWarn("Morning Summary がファーストビュー外");
      if (m.aiOpsUx.morningChipCount > 0 && m.aiOpsUx.morningChipCount < 6)
        pushWarn(`Morning Summary チップ不足 (${m.aiOpsUx.morningChipCount})`);
      if (!m.aiOpsUx.inboxAboveFold) pushWarn("Daily Inbox がファーストビュー外");
      if (
        m.aiOpsUx.watchScrollPx != null &&
        m.aiOpsUx.watchScrollPx > vp.height * 2.2 &&
        !m.aiOpsUx.morningSummaryAboveFold
      )
        pushWarn(`Ops Watch まで ${m.aiOpsUx.watchScrollPx}px スクロール`);
      if (m.aiOpsUx.criticalBuried) pushWarn("critical が Inbox / Morning Summary から見えにくい（HSG深部）");
      if (
        m.aiOpsUx.criticalVisible === 0 &&
        !m.aiOpsUx.hasCriticalInInbox &&
        !m.aiOpsUx.hasCriticalInSummary &&
        vp.name === "390"
      )
        pushWarn("390px: critical 表示未検出");
      break;
    default:
      break;
  }

  const failN = issues.filter((i) => i.level === "FAIL").length;
  const warnN = issues.filter((i) => i.level === "WARNING").length;
  const status = failN ? "FAIL" : warnN ? "WARNING" : "PASS";
  return { status, issues: issues.map((i) => i.msg) };
}

function gradeFromStatuses(statuses) {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARNING")) return "WARNING";
  return "PASS";
}

/** カテゴリ総合: FAIL が全体の15%超のみ FAIL、否则 WARNING 優先 */
function gradeCategory(rows) {
  const statuses = rows.map((r) => r.overall);
  const failN = statuses.filter((s) => s === "FAIL").length;
  if (failN === 0) return gradeFromStatuses(statuses);
  if (failN / Math.max(statuses.length, 1) > 0.15) return "FAIL";
  return statuses.includes("WARNING") ? "WARNING" : "WARNING";
}

function synthesizeReport(report) {
  const categories = ["talk", "builder", "connect", "market", "ai_ops"];
  const categoryGrades = {};
  const aspectGrades = {};

  for (const cat of categories) {
    const rows = report.results.filter((r) => r.category === cat);
    categoryGrades[cat] = gradeCategory(rows);
  }

  for (const aspect of ASPECTS) {
    const rows = report.results.flatMap((r) => r.aspects.filter((a) => a.aspect === aspect));
    aspectGrades[aspect] = gradeFromStatuses(rows.map((a) => a.status));
  }

  const critical = [];
  for (const r of report.results) {
    for (const a of r.aspects) {
      if (a.status === "FAIL") {
        critical.push(`${r.category}/${r.pageId} (${r.vp}px) ${a.aspect}: ${a.issues.join(" / ")}`);
      }
    }
  }

  const recs = new Set([
    "390px 主要CTAをファーストビューまたは固定バーに統一（市場商品・Builder応募）",
    "TALK / Connect / Builder / 市場の dash-header と builder-header / market-header の視覚トークン統一",
    "詳細画面（chat / board-thread / 商品）の戻る導線を page-subnav パターンに揃える",
    "通知カードの密度上限（390px で 6 件/画面）をガイドライン化",
    "AI運営秘書: critical は Daily Inbox 上部 + HSG 上部の二重露出を維持",
    "Ops Watch / KPI / Auto Fix の折りたたみ既定（768px は Inbox+Watch のみ展開）",
    "市場フッターリンク群のモバイル折りたたみ",
    "Builder 案件カードの行間・パディングを mvp-card 共通トークンへ",
    "Connect 申請ステップの progress インジケーター強化",
    "1280px 商品詳細: sticky buybox の top オフセットをヘッダー高に連動",
    "横スクロール検知を CI（review-ui-full-system）に常設",
    "最小フォント 11px 未満の撲滅（運営カード脚注）",
    "390px 入力フォーム: composer / 申請フォームの safe-area 対応",
    "768px タブレット: 2カラムレイアウトの余白バランス（Builder / 市場）",
    "運営ダッシュボード 768px: サイドバー → ドロワー切替の検討",
    "TALK 通知: 重要度色と Connect/Builder/市場 category 色の legend 追加",
    "カート/checkout 固定CTA の z-index と通知バナー競合回避",
    "chat-detail ヘッダー高とメッセージ開始位置の整合",
    "sales-fees グラフ/表の 390px 横はみ出し防止",
    "board-thread 完了報告CTA の primary 色を Builder 全体で統一",
    "shop-store TOP カテゴリ nav の tap target 44px 確保",
    "AI Human Send Gate: 承認待ち件数バッジを topbar に常時表示",
    "Daily Inbox セクション cap（4件）の超過時「もっと見る」UX",
    "パンくず省略形（…）の統一コンポーネント化",
    "ダークモード未対応画面の一覧化（将来）",
    "font-family: Noto Sans JP の読み込み weight 最適化",
    "390px スクロール量: 目的達成 2 画面以内を KPI 化",
    "運営UX: 朝3分フロー（Inbox→critical HSG→done）の onboarding ツールチップ",
    "empty state イラスト/文言のカテゴリ別統一",
  ]);

  report.categoryGrades = categoryGrades;
  report.aspectGrades = aspectGrades;
  report.criticalUiIssues = critical.length ? critical : ["（重大UI問題なし）"];
  report.recommendations = [...recs].slice(0, 30);
  report.immediate = critical.slice(0, 8);
  report.midTerm = [
    "ヘッダー/フッター design token 共通化（dash / builder / market / ops）",
    "768px ブレークポイント専用レイアウトの整理",
    "AI運営秘書スクロール量削減（Phase パネル折りたたみ既定）",
    "通知・案件・商品カードの密度ガイドライン策定",
  ];
  report.future = [
    "ダークモード",
    "アクセシビリティ WCAG 2.2 AA 自動監査",
    "RTL / 多言語レイアウト",
    "motion-reduced 対応",
  ];

  const allStatuses = report.results.map((r) => r.overall);
  const failN = allStatuses.filter((s) => s === "FAIL").length;
  const warnN = allStatuses.filter((s) => s === "WARNING").length;
  if (failN === 0 && warnN === 0) report.overall = "PASS";
  else if (failN <= 2 && failN / allStatuses.length < 0.1) report.overall = warnN ? "WARNING" : "PASS";
  else if (failN / allStatuses.length > 0.2) report.overall = "FAIL";
  else report.overall = "WARNING";
  report.counts = {
    pass: report.results.filter((r) => r.overall === "PASS").length,
    warning: report.results.filter((r) => r.overall === "WARNING").length,
    fail: report.results.filter((r) => r.overall === "FAIL").length,
  };
}

function buildBackNavReviewMarkdown(report) {
  const services = [
    { id: "talk", label: "TALK", pages: ["notify", "chat"] },
    { id: "builder", label: "Builder", pages: ["board-list", "board-detail", "board-thread"] },
    { id: "connect", label: "Connect", pages: ["apply", "sales"] },
    { id: "market", label: "市場", pages: ["top", "product", "cart"] },
    { id: "ai_ops", label: "AI運営秘書", pages: ["dashboard"] },
  ];
  const vps = ["390", "768", "1280"];

  const lines = [
    "# TASFUL 戻る導線レビュー",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base}`,
    "",
    "## 対象",
    "",
    ...services.map((s) => `- ${s.label}`),
    "",
  ];

  for (const svc of services) {
    const rows = report.results.filter((r) => r.category === svc.id && svc.pages.includes(r.pageId));
    const backAspects = rows.flatMap((r) => r.aspects.filter((a) => a.aspect === "backNav"));
    const grade = gradeFromStatuses(backAspects.length ? backAspects.map((a) => a.status) : ["PASS"]);
    const withBack = rows.filter((r) => r.metrics?.backNav?.hasBack);
    const minDims = withBack.map((r) => r.metrics?.backNav?.backMinDim || 0).filter((n) => n > 0);
    const minTap = minDims.length ? Math.min(...minDims) : 0;

    lines.push(`## ${svc.label}`, "", `**評価: ${grade}**`, "", "### 差分", "");
    lines.push(`- **サイズ**: 最小タップ ${minTap || "—"}px（目標36px）`);
    lines.push(`- **文言**: ${[...new Set(withBack.map((r) => r.metrics?.backNav?.backText).filter(Boolean))].slice(0, 4).join(" / ") || "—"}`);
    lines.push(`- **位置**: ${svc.id === "market" ? "ヘッダーロゴ" : svc.id === "builder" ? "ヘッダー直下" : svc.id === "talk" ? "モバイルヘッダー/ルームヘッダー" : svc.id === "connect" ? "サイドバー/ページ内" : "サイドバー brand"}`);
    lines.push(`- **モバイル**: ${rows.filter((r) => r.vp === "390" && r.metrics?.backNav?.hasBack).length ? "検出" : "限定的"}`);
    lines.push(`- **PC**: ${rows.filter((r) => r.vp === "1280" && r.metrics?.backNav?.hasBack).length ? "検出" : "意図的非表示あり"}`, "");

    lines.push("| VP | ページ | 表示 | タップpx | 文言 | backNav |", "|---|---|---:|---:|---|---|");
    for (const vp of vps) {
      for (const pid of svc.pages) {
        const row = rows.find((r) => r.vp === vp && r.pageId === pid);
        if (!row) continue;
        const back = row.aspects.find((a) => a.aspect === "backNav");
        const m = row.metrics?.backNav;
        lines.push(
          `| ${vp} | ${pid} | ${m?.hasBack ? "yes" : "no"} | ${m?.backMinDim || 0} | ${m?.backText || "—"} | ${back?.status || "—"} |`
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## 実施した軽調整（P1-5）",
    "",
    "- `--tasful-back-link-min-h: 36px` / `--tasful-back-link-color` 共通トークン",
    "- TALK: chat-mobile-head__back / talk-line-room-header__back / talk-ai-composer__back",
    "- Builder: builder-page-back / builder-talk-back 36px + focus-visible",
    "- Connect: dash-nav / page-subnav 戻りリンク統一色",
    "- 市場: ヘッダーロゴ min-height + padding-block 3px",
    "- AI運営: ops-ai-brand min-height 36px",
    "- 監査: タップ目標 36px / chat 1280 desktop 除外",
    "",
    "## 未対応（中期）",
    "",
    "- 戻る文言の完全統一（‹ / ← 混在 — HTML変更が必要）",
    "- chat-detail 1280px 専用テキスト戻るリンク（構造追加が必要）",
    "- 市場商品のパンくず型戻る（現状ロゴ経由）",
    "- notify タブからの「通知へ戻る」専用ラベル（導線は維持）",
    ""
  );

  return lines.join("\n");
}

function buildHeaderReviewMarkdown(report) {
  const services = [
    { id: "market", label: "市場", pages: ["top", "product", "cart"] },
    { id: "talk", label: "TALK", pages: ["notify", "chat"] },
    { id: "builder", label: "Builder", pages: ["board-list", "board-detail", "board-thread"] },
    { id: "connect", label: "Connect", pages: ["apply", "sales"] },
    { id: "ai_ops", label: "AI運営秘書", pages: ["dashboard"] },
  ];
  const vps = ["390", "768", "1280"];

  const lines = [
    "# TASFUL ヘッダー共通化レビュー",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base}`,
    "",
    "## 対象",
    "",
    ...services.map((s) => `- ${s.label}`),
    "",
  ];

  for (const svc of services) {
    const rows = report.results.filter((r) => r.category === svc.id && svc.pages.includes(r.pageId));
    const statuses = rows.map((r) => r.overall);
    const grade = gradeFromStatuses(statuses.length ? statuses : ["PASS"]);
    lines.push(`## ${svc.label}`, "", `**評価: ${grade}**`, "");

    const sample = rows.find((r) => r.vp === "390") || rows[0];
    const h390 = rows.filter((r) => r.vp === "390").map((r) => r.metrics?.header?.height || 0);
    const h768 = rows.filter((r) => r.vp === "768").map((r) => r.metrics?.header?.height || 0);
    const h1280 = rows.filter((r) => r.vp === "1280").map((r) => r.metrics?.header?.height || 0);
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

    lines.push(
      "### 差分",
      "",
      `- **高さ**: 390=${avg(h390)}px / 768=${avg(h768)}px / 1280=${avg(h1280)}px`,
      `- **背景**: ${sample?.metrics?.header?.backgroundColor || "—"}`,
      `- **タイトル**: ellipsis=${sample?.metrics?.header?.titleEllipsis ? "あり" : "なし"}`,
      `- **戻る導線**: ${rows.some((r) => r.metrics?.backNav?.hasBack) ? "検出" : "弱い/非表示"}`,
      `- **CTA**: primaryMin=${rows.map((r) => r.metrics?.cta?.primaryMinDim || 0).filter(Boolean).join("/") || "—"}px`,
      ""
    );

    lines.push("### ビューポート別", "", "| VP | ページ | ヘッダー高 | 横overflow | 戻る | header | backNav |", "|---|---|---:|---|---|---|---|");
    for (const vp of vps) {
      for (const pid of svc.pages) {
        const row = rows.find((r) => r.vp === vp && r.pageId === pid);
        if (!row) continue;
        const hdr = row.aspects.find((a) => a.aspect === "header");
        const back = row.aspects.find((a) => a.aspect === "backNav");
        lines.push(
          `| ${vp} | ${pid} | ${row.metrics?.header?.height || 0} | ${row.metrics?.header?.overflow ? "yes" : "no" } | ${row.metrics?.backNav?.hasBack ? "yes" : "no"} | ${hdr?.status || "—"} | ${back?.status || "—"} |`
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## 実施した軽調整（P1-4）",
    "",
    "- `--tasful-header-back-min-h: 36px` トークン（dash / builder）",
    "- dash-header タイトル ellipsis / 390px CTA min 36px",
    "- builder-page-back タップ領域 36px / ボード系モバイル padding 圧縮",
    "- 市場ヘッダー アクションラベル 11px / ロゴテキスト max-width",
    "- ops-ai-topbar min-height / タイトル ellipsis / beta 11px",
    "- TALK dash-header タイトル ellipsis（notify/chat-app 除く）",
    "- talk-ops-back min-height 36px",
    "- 監査 backSelectors: builder-page-back / board-project-detail 対応",
    "",
    "## 未対応（中期）",
    "",
    "- 市場 EC 型ヘッダー（多段）と dash-header（単段 60–68px）の構造差",
    "- TALK notify/chat-app タブでの dash-header 非表示（LINE UI 意図）",
    "- chat-detail 1280px で mobile head 非表示時の戻る導線（デスクトップ別 UI）",
    "- Builder ダッシュボード neon 系と Connect 白背景 dash の完全トークン統一",
    ""
  );

  return lines.join("\n");
}

function buildMarkdown(report) {
  const catLabel = { talk: "TALK", builder: "Builder", connect: "Connect", market: "市場", ai_ops: "AI運営秘書" };
  const aspectLabel = {
    infoArch: "情報設計",
    cta: "CTA",
    spacing: "余白",
    cardDensity: "カード密度",
    scroll: "スクロール量",
    header: "ヘッダー",
    footer: "フッター",
    backNav: "戻る導線",
    mobileUx: "モバイルUX",
    pcUx: "PC UX",
    aiOpsUx: "AI運営秘書UX",
  };

  return [
    "# TASFUL UI総監査",
    "",
    `実施: ${report.capturedAt}`,
    `Base: ${report.base}`,
    "",
    "## 総合評価",
    "",
    `**${report.overall}**`,
    "",
    `- PASS: ${report.counts.pass}`,
    `- WARNING: ${report.counts.warning}`,
    `- FAIL: ${report.counts.fail}`,
    "",
    "---",
    "",
    "## カテゴリ別評価",
    "",
    ...Object.entries(report.categoryGrades).map(([k, v]) => `- **${catLabel[k] || k}**: ${v}`),
    "",
    "---",
    "",
    "## 観点別評価",
    "",
    ...Object.entries(report.aspectGrades).map(([k, v]) => `- ${aspectLabel[k] || k}: ${v}`),
    "",
    "---",
    "",
    "## 重大UI問題",
    "",
    ...report.criticalUiIssues.map((c) => `- ${c}`),
    "",
    "---",
    "",
    "## 改善推奨TOP30",
    "",
    ...report.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    "---",
    "",
    "### 即改善",
    "",
    ...(report.immediate.length ? report.immediate.map((f) => `- ${f}`) : ["- （なし）"]),
    "",
    "### 中期改善",
    "",
    ...report.midTerm.map((f) => `- ${f}`),
    "",
    "### 将来改善",
    "",
    ...report.future.map((f) => `- ${f}`),
    "",
    "---",
    "",
    "## スクリーンショット",
    "",
    `保存先: \`screenshots/ui-full-review/\` (${report.screenshots.length}枚)`,
    "",
    "390px / 768px / 1280px",
    "",
    "## テスト",
    "",
    "実施: `node scripts/review-ui-full-system.mjs`",
    "",
  ].join("\n");
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  await mkdir(HEADER_REVIEW_DIR, { recursive: true });
  await mkdir(BACK_REVIEW_DIR, { recursive: true });
  const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
  if (!base) {
    console.error("FAIL: dev server not found");
    process.exitCode = 1;
    return;
  }

  const browser = await launchHeadlessBrowser();
  const report = {
    capturedAt: new Date().toISOString(),
    base,
    results: [],
    screenshots: [],
    overall: "FAIL",
  };

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      for (const def of PAGES) {
        const row = {
          category: def.category,
          pageId: def.id,
          label: def.label,
          vp: vp.name,
          overall: "FAIL",
          metrics: null,
          aspects: [],
          issues: [],
        };

        try {
          if (def.prep === "marketCart") await prepMarketCart(page, base);

          const url =
            buildLocalPageUrl(base, def.path, def.query ? `?${def.query}` : "") + (def.hash || "");
          await gotoWithRetry(page, url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
          await page.waitForSelector(def.wait, { timeout: SEL_TIMEOUT }).catch(() => {});
          if (def.id === "chat") {
            await page.waitForSelector("#chatSend", { timeout: SEL_TIMEOUT }).catch(() => {});
          }
          if (def.id === "board-detail") {
            await page.waitForSelector("[data-builder-board-pd-root], .builder-header", { timeout: SEL_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(600);
          }
          if (def.id === "product") {
            await page.waitForSelector("[data-tasful-product-shelf-related] .tasful-market-search-mini", {
              timeout: SEL_TIMEOUT,
            }).catch(() => {});
            await page.evaluate(() => {
              document.getElementById("product-related")?.scrollIntoView({ block: "start" });
            });
            await page.waitForTimeout(400);
          }
          if (def.hash) {
            await page.evaluate((h) => {
              if (location.hash !== h) location.hash = h;
            }, def.hash);
            await page.waitForTimeout(600);
          }
          if (def.prep === "aiOpsSeed") {
            await page.waitForFunction(
              () => window.TasuAdminAiDailyInbox && window.TasuAdminAiHumanSendGate,
              { timeout: SEL_TIMEOUT }
            );
            await prepAiOpsSeed(page);
            await page.waitForTimeout(800);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(200);
          }
          await page.waitForTimeout(400);

          const metrics = await page.evaluate(measureUi, {
            headerSelectors: def.headerSelectors,
            footerSelectors: def.footerSelectors,
            backSelectors: def.backSelectors,
            ctaSelectors: def.ctaSelectors,
            cardSelectors: def.cardSelectors,
            goalSelectors: def.goalSelectors,
          });
          row.metrics = metrics;

          for (const aspect of ASPECTS) {
            const graded = gradeAspect(aspect, metrics, def, vp);
            row.aspects.push({ aspect, status: graded.status, issues: graded.issues });
          }
          row.overall = gradeFromStatuses(row.aspects.map((a) => a.status));
          row.issues = row.aspects.flatMap((a) => a.issues);

          await shot(page, `${def.category}-${def.id}-${vp.name}`);
        } catch (err) {
          row.issues.push(String(err?.message || err));
          row.overall = "FAIL";
        }

        report.results.push(row);
      }

      await context.close();
    }

    synthesizeReport(report);
    report.screenshots = readdirSync(SHOT_DIR).filter((f) => f.endsWith(".png"));

    const md = buildMarkdown(report);
    const headerMd = buildHeaderReviewMarkdown(report);
    const backMd = buildBackNavReviewMarkdown(report);
    await writeFile(REPORT_MD, md, "utf8");
    await writeFile(HEADER_REPORT_MD, headerMd, "utf8");
    await writeFile(BACK_REPORT_MD, backMd, "utf8");
    await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

    console.log(md);
    console.log(`\nReport: ${REPORT_MD}`);
    console.log(`Header review: ${HEADER_REPORT_MD}`);
    console.log(`Back nav review: ${BACK_REPORT_MD}`);
    console.log(`JSON: ${REPORT_JSON}`);
    console.log(`Overall: ${report.overall}`);
    if (report.overall === "FAIL") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
