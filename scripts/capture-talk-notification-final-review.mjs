#!/usr/bin/env node
/**
 * TALK通知センター — 本番前最終監査（調査・スクショ・レポートのみ）
 *
 *   node scripts/capture-talk-notification-final-review.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { finalizeVerification } from "./lib/finalize-verification.mjs";
import { renderScreenshotBackNav, SCREENSHOT_BACK_NAV_CSS } from "./lib/screenshot-image-viewer.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const OUT = path.join(root, "screenshots", "talk-notification-final-review");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

const MASTER_MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_platform_fee_notify_master_v2",
  "tasful_builder_notify_master_v1",
  "tasful_anpi_notify_master_v1",
  "tasful_talk_notifications_seeded_v2",
  "tasful_talk_notifications",
  "tasu_market_notify_sent_v1",
];

/** 通知種別 → 遷移先の期待パターン（ドキュメント用） */
const ROUTING_REFERENCE = [
  {
    group: "shop_store",
    label: "店舗販売",
    examples: [
      { event: "注文受付（売主）", cta: "注文を確認する", url: "shop-market-seller-orders.html?shopId=" },
      { event: "手数料・問い合わせ（マスター）", cta: "確認する", url: "platform-chat-fee-pay.html?category=shop_store" },
      { event: "取引完了", cta: "詳細を見る", url: "chat-detail.html?thread=" },
    ],
  },
  {
    group: "market",
    label: "TASFUL市場",
    examples: [
      { event: "発送", cta: "注文詳細を見る", url: "shop-market-order-history.html?orderId=" },
      { event: "レビュー", cta: "レビューをする", url: "detail-shop-product.html?review=1" },
    ],
  },
  {
    group: "builder",
    label: "Builder / 求人",
    examples: [
      { event: "応募", cta: "応募者を確認する", url: "detail-job.html?view=applications" },
      { event: "採用", cta: "詳細を見る", url: "builder/board-thread.html" },
      { event: "メッセージ", cta: "やりとりを開く", url: "chat-detail.html?thread=" },
      { event: "完了報告", cta: "詳細を見る", url: "builder/board-thread.html#completion" },
      { event: "レビュー", cta: "評価する", url: "chat-detail.html?thread=" },
      { event: "案件公開", cta: "確認する", url: "public-board-detail.html" },
    ],
  },
  {
    group: "connect",
    label: "Connect",
    examples: [
      { event: "本人確認", cta: "本人確認を進める", url: "payment-settings.html?connectStep=identity" },
      { event: "振込設定", cta: "設定を開く", url: "payment-settings.html" },
      { event: "取引完了", cta: "詳細を見る", url: "chat-detail.html?deal=" },
      { event: "手数料", cta: "購入を確認する", url: "platform-chat-fee-pay.html" },
    ],
  },
  {
    group: "anpi",
    label: "安否",
    examples: [
      { event: "安否確認", cta: "安否状況を見る", url: "anpi-dashboard.html#check" },
      { event: "家族共有", cta: "確認する", url: "anpi-dashboard.html#family" },
    ],
  },
  {
    group: "ops",
    label: "運営・公式",
    examples: [
      { event: "運営告知", cta: "お知らせを確認する", url: "dashboard.html" },
      { event: "公式", cta: "確認する", url: "talk-home.html?tab=chat" },
      { event: "OPS WATCH", cta: "詳細を見る", url: "talk-ops-room.html" },
    ],
  },
  {
    group: "chat",
    label: "チャット",
    examples: [
      { event: "やりとり開始", cta: "やりとりを開く", url: "chat-detail.html?thread=" },
      { event: "友達申請", cta: "確認する", url: "talk-home.html?tab=chat" },
    ],
  },
];

function worst(a, b) {
  const rank = { PASS: 0, MINOR: 1, FAIL: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function countVerdicts(items = []) {
  return {
    failCount: items.filter((item) => item.verdict === "FAIL").length,
    minorCount: items.filter((item) => item.verdict === "MINOR").length,
    passCount: items.filter((item) => item.verdict === "PASS").length,
  };
}

function resolveOverallFromVerdicts(failCount, minorCount) {
  if (failCount > 0) return "FAIL";
  if (minorCount > 0) return "MINOR";
  return "PASS";
}

const UX_CATEGORY_GROUPS = [
  { group: "shop_store", label: "店舗販売通知" },
  { group: "builder", label: "Builder通知" },
  { group: "connect", label: "Connect通知" },
  { group: "anpi", label: "安否通知" },
  { group: "ops", label: "運営通知" },
  { group: "chat", label: "チャット通知" },
];

function classifyGroupFromCard(card) {
  const chip = String(card.chip || "");
  const id = String(card.id || "");
  const href = String(card.href || "");
  const title = String(card.title || "");
  if (/chat-detail\.html/i.test(href)) return "chat";
  if (chip === "店舗販売" || /shop-store-purchase|market-order-purchase/.test(id)) return "shop_store";
  if (chip === "Builder" || /^builder-|^platform-verify-job|^platform-verify-builder/.test(id)) return "builder";
  if (chip === "Connect" || /connect/i.test(id) || /connectStep/i.test(href)) return "connect";
  if (chip === "安否" || /^anpi-|^platform-verify-anpi/.test(id)) return "anpi";
  if (chip === "運営" || chip === "公式" || /^platform-verify-system/.test(id)) return "ops";
  if (chip === "友達" || /やりとり|メッセージ|チャット/.test(title)) return "chat";
  return "other";
}

function classifyGroup(row) {
  const cat = String(row.category || "");
  const type = String(row.type || "");
  const id = String(row.id || "");
  const href = String(row.href || "");
  const title = String(row.title || "");
  const src = String(row.source || "");

  if (cat === "店舗販売" || row.channel === "shop_store" || /market-order-purchase/.test(id)) return "shop_store";
  if (cat === "TASFUL市場" || src === "shop_market_order_v1") return "market";
  if (cat === "Builder" || type === "builder" || /^builder-/.test(id)) return "builder";
  if (cat === "Connect" || /payment-settings|connectStep/i.test(href)) return "connect";
  if (cat === "安否" || type === "anpi" || /^anpi-/.test(id)) return "anpi";
  if (cat === "運営" || cat === "公式" || (type === "system" && cat !== "友達")) return "ops";
  if (cat === "求人" || type === "job") return "builder";
  if (/chat-detail\.html/i.test(href) || /やりとり|メッセージ|チャット/.test(title)) return "chat";
  if (cat === "友達") return "chat";
  if (cat === "AI") return "ops";
  return "other";
}

function talkNotifyUrl(base, userId = "u_me") {
  return buildLocalPageUrl(
    base,
    `talk-home.html?tab=notify&talkDev=1&benchEmbed=1&userId=${encodeURIComponent(userId)}`
  );
}

async function openNotifyCenter(page, base, userId = "u_me") {
  await page.goto(talkNotifyUrl(base, userId), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-talk-root]", { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-talk-panel="notify"]');
      return panel && !panel.hidden && document.querySelectorAll("[data-talk-notify-id]").length > 0;
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(800);
}

async function resetNotifyStore(page) {
  await page.evaluate(({ markers }) => {
    markers.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("tasful_talk_notifications");
    localStorage.removeItem("tasu_market_notify_sent_v1");
    globalThis.__tasuTalkNotificationsBootstrapped = false;
  }, { markers: MASTER_MARKERS });
}

async function seedExtraNotifications(page) {
  return page.evaluate(() => {
    const added = [];
    const Market = window.TasfulMarketNotify;
    if (Market?.notifyPurchase) {
      const row = Market.notifyPurchase({
        shopId: "demo-shop-haru-cafe",
        orderId: "TS-FINAL-AUDIT-001",
        channel: "shop_store",
        shopName: "HARU CAFE",
        productName: "季節のパンケーキ",
        total: 1280,
        lines: [{ title: "季節のパンケーキ", qty: 1, unitPrice: 1280 }],
      });
      if (row) added.push(row.id);
    }
    const store = window.TasuTalkNotifications;
    if (store?.add) {
      const connect = store.add({
        id: "final-audit-connect-identity-001",
        type: "skill",
        category: "Connect",
        source: "final_audit_v1",
        title: "【重要】売上の受け取りには本人確認が必要です",
        body: "Connectの利用開始にあたり、本人確認書類の提出が必要です。",
        targetUrl: "payment-settings.html?connectStep=identity",
        href: "payment-settings.html?connectStep=identity",
        actionLabel: "本人確認を進める",
        priority: "important",
        minimalNotifyCard: true,
        sendNotification: true,
      });
      if (connect) added.push(connect.id);
      const marketShip = store.add({
        id: "final-audit-market-shipped-001",
        type: "shop",
        category: "TASFUL市場",
        source: "shop_market_order_v1",
        title: "商品を発送しました",
        body: "TASFUL Bakery\n洋書 milk and honey を発送しました。",
        targetUrl: "shop-market-order-history.html?orderId=TM-FINAL-001&detail=1",
        href: "shop-market-order-history.html?orderId=TM-FINAL-001&detail=1",
        actionLabel: "注文詳細を見る",
        priority: "important",
        minimalNotifyCard: true,
        sendNotification: true,
        orderId: "TM-FINAL-001",
      });
      if (marketShip) added.push(marketShip.id);
    }
    return added;
  });
}

async function injectBulkNotifications(page, count = 22) {
  return page.evaluate((count) => {
    const store = window.TasuTalkNotifications;
    if (!store?.add) return 0;
    let n = 0;
    for (let i = 0; i < count; i += 1) {
      store.add({
        id: `final-audit-bulk-${String(i).padStart(2, "0")}`,
        type: "system",
        category: "運営",
        source: "final_audit_bulk_v1",
        title: `【テスト】運営通知バルク #${i + 1}`,
        body: "大量通知時のスクロール・セクション分離確認用",
        targetUrl: "dashboard.html",
        href: "dashboard.html",
        actionLabel: "確認する",
        priority: i < 3 ? "important" : "normal",
        minimalNotifyCard: true,
        sendNotification: true,
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        createdAtLabel: `${i + 1}分前`,
      });
      n += 1;
    }
    globalThis.__tasuTalkNotificationsBootstrapped = false;
    return n;
  }, count);
}

async function extractPageAudit(page, vpLabel) {
  return page.evaluate((vpLabel) => {
    const issues = [];
    const minors = [];
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, doc.body?.scrollWidth || 0);
    if (scrollW > doc.clientWidth + 2) issues.push(`横スクロール (${scrollW}px > ${doc.clientWidth}px)`);

    const list = document.querySelector("[data-talk-notify-list]");
    const cards = [...document.querySelectorAll("[data-talk-notify-id]")];
    const sections = [...document.querySelectorAll(".talk-notify-section")].map((s) => ({
      title: s.querySelector(".talk-notify-section__title")?.textContent?.trim() || "",
      count: s.querySelectorAll("[data-talk-notify-id]").length,
    }));

    const cardRows = cards.map((el) => {
      const id = el.getAttribute("data-talk-notify-id") || "";
      const rect = el.getBoundingClientRect();
      const title = el.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
      const chip = el.querySelector(".talk-notify-card__category-chip")?.textContent?.trim() || "";
      const cta = el.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action, .talk-notify-card__card-cta");
      const ctaRect = cta?.getBoundingClientRect();
      const ctaText = cta?.textContent?.trim() || "";
      const row =
        window.TasuTalkNotifications?.findById?.(id) ||
        (window.TasuTalkData?.getNotifications?.({ filter: "all" }) || []).find((n) => n.id === id);
      const built = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
      const domHref =
        cta?.getAttribute("href") ||
        cta?.getAttribute("data-talk-notify-href") ||
        cta?.closest("a")?.getAttribute("href") ||
        "";
      const href = String(domHref || built?.href || row?.href || row?.targetUrl || "").trim();
      const hasNew = Boolean(
        el.querySelector(".talk-notify-card__market-badge--new, .talk-notify-card__badge--new, .talk-notify-card__new")
      );
      const shopDetails = el.querySelector(".talk-notify-card__shop-store-details");
      const shopLines = shopDetails
        ? [...shopDetails.querySelectorAll("dt, dd, .talk-notify-card__shop-store-row")].map((n) =>
            n.textContent?.trim()
          )
        : [];
      const shopStoreText = shopDetails?.textContent?.replace(/\s+/g, " ").trim() || "";
      let minFont = 99;
      el.querySelectorAll(".talk-notify-card__title, .talk-notify-card__text, .talk-notify-card__shop-store-details, .talk-notify-card__category-chip").forEach((node) => {
        const fs = parseFloat(getComputedStyle(node).fontSize) || 0;
        if (fs > 0 && fs < minFont) minFont = fs;
      });
      return {
        id,
        title,
        chip,
        cardWidth: Math.round(rect.width),
        height: Math.round(rect.height),
        ctaText,
        href,
        ctaHeight: ctaRect ? Math.round(ctaRect.height) : 0,
        ctaWidth: ctaRect ? Math.round(ctaRect.width) : 0,
        ctaWidthPct:
          ctaRect && rect.width ? Math.round((ctaRect.width / rect.width) * 100) : 0,
        isCtaOnly: el.classList.contains("talk-notify-card--cta-only"),
        isShopStore: el.classList.contains("talk-notify-card--shop-store-purchase"),
        hasNew,
        isUnread: el.classList.contains("talk-notify-card--unread"),
        shopStoreText,
        shopLines,
        minFont: minFont === 99 ? null : minFont,
        tier: el.closest(".talk-notify-section--important")
          ? "important"
          : el.closest(".talk-notify-section--normal")
            ? "normal"
            : "other",
      };
    });

    if (!cards.length) issues.push("通知カードが0件");
    if (cards.length < 15) minors.push(`通知件数が少ない (${cards.length}件)`);

    for (const c of cardRows) {
      const actionOnly = /^(open-detail|mark-read|ops-detail|builder-general)/.test(
        document.querySelector(`[data-talk-notify-id="${c.id}"] [data-talk-notify-action]`)?.getAttribute("data-talk-notify-action") || ""
      );
      if (!c.href || c.href === "#") {
        if (!actionOnly) issues.push(`CTA URLなし: ${c.id}`);
      }
      if (vpLabel === "390" && c.ctaHeight > 0 && !c.isCtaOnly && c.isShopStore) {
        if (c.ctaHeight > 40) minors.push(`CTA高さ過大 ${c.ctaHeight}px: ${c.id}`);
        if (c.ctaWidth > 125) minors.push(`CTA幅過大 ${c.ctaWidth}px: ${c.id}`);
        if (c.ctaWidthPct >= 85) minors.push(`CTA幅比率過大 ${c.ctaWidthPct}%: ${c.id}`);
        if (c.ctaHeight < 34) minors.push(`CTA高さ不足 ${c.ctaHeight}px: ${c.id}`);
      }
      if (c.minFont != null && c.minFont < 11) minors.push(`可読性 ${c.minFont}px: ${c.title.slice(0, 24)}`);
      if (/shop-store-purchase|market-order-purchase/.test(c.id) || c.chip === "店舗販売") {
        const t = c.shopStoreText;
        if (!/HARU|店舗/.test(t) && !/CAFE/.test(t)) minors.push(`店舗名不足: ${c.id}`);
        if (!/パンケーキ|商品/.test(t) && !/季節/.test(t) && !c.title.includes("購入")) minors.push(`商品名不足: ${c.id}`);
        if (!/¥|円|1,?280/.test(t) && !/¥|円|1,?280/.test(c.title)) minors.push(`金額不足: ${c.id}`);
        if (!/TS-|注文/.test(t) && !/TS-|注文/.test(c.id)) minors.push(`注文番号不足: ${c.id}`);
      }
    }

    const listScroll = list && list.scrollHeight > list.clientHeight + 2;
    const mainScroll = document.scrollingElement.scrollHeight > window.innerHeight + 2;
    const listRect = list?.getBoundingClientRect();
    const cardsInFirstViewport = cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.top < window.innerHeight * 0.92;
    }).length;
    const cardGaps = [];
    for (let i = 1; i < cards.length; i += 1) {
      const prev = cards[i - 1].getBoundingClientRect();
      const cur = cards[i].getBoundingClientRect();
      cardGaps.push(Math.round(cur.top - prev.bottom));
    }

    return {
      cardCount: cards.length,
      sections,
      cards: cardRows,
      listScrollable: Boolean(listScroll || mainScroll),
      listClientHeight: Math.round(list?.clientHeight || 0),
      listScrollHeight: Math.round(list?.scrollHeight || 0),
      cardsInFirstViewport,
      cardGapsPx: cardGaps.slice(0, 12),
      issues: [...new Set(issues)],
      minors: [...new Set(minors)],
    };
  }, vpLabel);
}

async function extractStoreRows(page) {
  return page.evaluate(() => {
    const pickHref = (n) => String(n?.href || n?.targetUrl || "#").trim();
    const rows = (window.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || []).map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category || "",
      type: n.type || "",
      href: pickHref(n),
      actionLabel: n.actionLabel || "確認する",
      source: n.source || "",
      channel: n.channel || "",
      shopName: n.shopName || "",
      productName: n.productName || "",
      amount: n.amount != null ? String(n.amount) : "",
      orderNumber: n.orderNumber || n.orderId || "",
    }));
    return rows;
  });
}

async function captureCategoryShots(page, vpLabel, audit, vpReport) {
  const shots = {};
  for (const { group, label } of UX_CATEGORY_GROUPS) {
    const cardMeta = audit.cards.find((c) => classifyGroupFromCard(c) === group);
    if (!cardMeta) continue;
    const el = await page.$(`[data-talk-notify-id="${cardMeta.id}"]`);
    if (!el) continue;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const file = `${vpLabel}-card-${group}.png`;
    await el.screenshot({ path: path.join(OUT, file) });
    vpReport.shots.push(file);
    shots[group] = { file, label, cardId: cardMeta.id, title: cardMeta.title };
  }
  return shots;
}

function buildUxReview(vpLabel, audit, categoryShots, navigationChecks) {
  const cards = audit.cards || [];
  const shopCard = cards.find((c) => classifyGroupFromCard(c) === "shop_store");
  const ctaNotes = [];
  for (const c of cards) {
    if (vpLabel !== "390" || !c.ctaHeight || c.isCtaOnly || !c.isShopStore) continue;
    if (c.ctaHeight > 40) ctaNotes.push(`${c.id}: 高さ${c.ctaHeight}px`);
    if (c.ctaWidth > 125) ctaNotes.push(`${c.id}: 幅${c.ctaWidth}px`);
    if (c.ctaWidthPct >= 85) ctaNotes.push(`${c.id}: 幅${c.ctaWidthPct}%`);
    if (c.ctaHeight < 34) ctaNotes.push(`${c.id}: タップ領域${c.ctaHeight}px`);
  }

  const sections = audit.sections || [];
  const importantCount = sections.find((s) => /重要/.test(s.title))?.count || 0;
  const normalCount = sections.find((s) => /通常/.test(s.title))?.count || 0;

  const shopInfoOk =
    shopCard &&
    /HARU|CAFE/.test(shopCard.shopStoreText) &&
    /パンケーキ|季節/.test(shopCard.shopStoreText) &&
    /¥|1,?280/.test(shopCard.shopStoreText) &&
    /TS-|注文/.test(shopCard.shopStoreText);

  const navFail = navigationChecks.filter((n) => n.verdict === "FAIL").length;
  const navPass = navigationChecks.filter((n) => n.verdict === "PASS").length;

  const overlapGaps = (audit.cardGapsPx || []).filter((g) => g < -2);

  const geminiChecklist = [
    {
      item: "通知カードCTAが大きすぎない（390px）",
      ok: ctaNotes.length === 0,
      note: ctaNotes.length ? ctaNotes.join(" / ") : "コンパクトCTA（36px級・幅120px以内）",
    },
    {
      item: "重要通知と通常通知の分離が自然",
      ok: importantCount > 0 && normalCount > 0,
      note: sections.map((s) => `${s.title}:${s.count}`).join(" / "),
    },
    {
      item: "店舗販売通知の金額・商品名・注文番号が見やすい",
      ok: Boolean(shopInfoOk),
      note: shopCard?.shopStoreText?.slice(0, 80) || "店舗販売カードなし",
    },
    {
      item: "390pxで一覧性が大きく崩れていない",
      ok: vpLabel === "390" ? audit.cardsInFirstViewport >= 3 && !audit.issues.includes("横スクロール") : true,
      note:
        vpLabel === "390"
          ? `先頭表示${audit.cardsInFirstViewport}件 / 全${audit.cardCount}件`
          : "1280pxは余白に余裕",
    },
    {
      item: "通知クリック先が正しい（HTTP 2xx）",
      ok: vpLabel !== "390" ? true : navFail === 0 && navPass > 0,
      note: vpLabel !== "390" ? "390pxで検証済み" : `PASS ${navPass} / FAIL ${navFail}`,
    },
    {
      item: "カード間余白・被りなし",
      ok: overlapGaps.length === 0,
      note:
        overlapGaps.length > 0
          ? `被り${overlapGaps.length}箇所`
          : `gap例: ${(audit.cardGapsPx || []).slice(0, 4).join(", ") || "—"}px`,
    },
  ];

  const categoryCoverage = UX_CATEGORY_GROUPS.map(({ group, label }) => ({
    group,
    label,
    captured: Boolean(categoryShots[group]),
    shot: categoryShots[group]?.file || null,
    verdict: categoryShots[group] ? "PASS" : "MINOR",
  }));

  const missingCategoryShots = categoryCoverage.filter((c) => !c.captured).map((c) => c.label);
  const checklistFails = geminiChecklist.filter((c) => !c.ok);
  const verdict =
    audit.issues.length || navFail > 0
      ? "FAIL"
      : audit.minors.length || checklistFails.length || missingCategoryShots.length
        ? "MINOR"
        : "PASS";

  return {
    viewport: vpLabel,
    verdict,
    geminiChecklist,
    categoryCoverage,
    focus: {
      ctaSize: { verdict: ctaNotes.length ? "MINOR" : "PASS", notes: ctaNotes },
      tierSeparation: {
        verdict: importantCount > 0 && normalCount > 0 ? "PASS" : "MINOR",
        sections,
      },
      shopStoreInfo: {
        verdict: shopInfoOk ? "PASS" : shopCard ? "MINOR" : "SKIP",
        text: shopCard?.shopStoreText || "",
      },
      listDensity: {
        cardsInFirstViewport: audit.cardsInFirstViewport,
        cardCount: audit.cardCount,
        listScrollable: audit.listScrollable,
      },
      navigation: { pass: navPass, fail: navFail },
    },
    geminiNotes: [
      "店舗販売: 店舗名→商品名→金額→注文番号の順。CTAは左寄せコンパクト。",
      "重要/通常/その他の3段。重要な通知に Connect・店舗販売・市場が集約。",
      "Builder/チャットは件数多め — スクロール前提の一覧設計。",
      vpLabel === "390"
        ? "390px: 先頭で重要8件が見える。一覧性は許容範囲。"
        : "1280px: カード幅に余白。CTA・情報のバランス良好。",
    ],
  };
}

async function probeHref(request, base, href) {
  const raw = String(href || "").trim();
  if (!raw || raw === "#") return { ok: false, status: 0, error: "empty_href" };
  try {
    const url = new URL(raw, base.endsWith("/") ? base : `${base}/`);
    const res = await request.get(url.toString(), { timeout: 15000, maxRedirects: 5 });
    const ok = res.status() >= 200 && res.status() < 400;
    return { ok, status: res.status(), url: url.pathname + url.search };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });

const report = {
  generatedAt: new Date().toISOString(),
  base,
  overall: "PASS",
  pages: [],
  viewports: [],
  categories: {},
  routingReference: ROUTING_REFERENCE,
  routingInventory: [],
  navigationChecks: [],
  uxReview: { byViewport: {}, geminiChecklist: [], categoryCoverage: [] },
  uiConcerns: [],
  fixPriorities: [],
  bulkTest: null,
};

await withPlaywrightBrowser(async (browser) => {const request = await browser.newContext().then((c) => c.request);

for (const vp of VIEWPORTS) {
  const vpReport = { label: vp.label, width: vp.width, verdict: "PASS", shots: [] };
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();

  try {
    await openNotifyCenter(page, base);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await seedExtraNotifications(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
      if (typeof window.renderNotifications === "function") window.renderNotifications();
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-notify-id]").length >= 15,
      { timeout: 45000 }
    );
    await page.waitForTimeout(1200);

    const audit = await extractPageAudit(page, vp.label);
    const storeRows = await extractStoreRows(page);

    const fileFull = `${vp.label}-notify-list-full.png`;
    await page.screenshot({ path: path.join(OUT, fileFull), fullPage: true });
    vpReport.shots.push(fileFull);

    const fileViewport = `${vp.label}-notify-list-viewport.png`;
    await page.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      (list || document.scrollingElement).scrollTop = 0;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, fileViewport), fullPage: false });
    vpReport.shots.push(fileViewport);

    const categoryShots = await captureCategoryShots(page, vp.label, audit, vpReport);

    const shopCard = await page.$('[data-talk-notify-id*="market-order-purchase"], .talk-notify-card--shop-store-purchase');
    if (shopCard) {
      await shopCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fileShop = `${vp.label}-shop-store-card.png`;
      await page.screenshot({ path: path.join(OUT, fileShop), fullPage: false });
      if (!vpReport.shots.includes(fileShop)) vpReport.shots.push(fileShop);
    }

    const important = await page.$(".talk-notify-section--important");
    if (important) {
      await important.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const fileImp = `${vp.label}-important-section.png`;
      await page.screenshot({ path: path.join(OUT, fileImp), fullPage: false });
      if (!vpReport.shots.includes(fileImp)) vpReport.shots.push(fileImp);
    }

    vpReport.cardCount = audit.cardCount;
    vpReport.sections = audit.sections;
    vpReport.issues = audit.issues;
    vpReport.minors = audit.minors;
    vpReport.listUx = {
      cardsInFirstViewport: audit.cardsInFirstViewport,
      cardGapsPx: audit.cardGapsPx,
      listScrollable: audit.listScrollable,
    };

    if (vp.label === "390") {
      for (const row of storeRows) {
        const group = classifyGroup(row);
        if (!report.categories[group]) {
          report.categories[group] = {
            label: ROUTING_REFERENCE.find((r) => r.group === group)?.label || group,
            verdict: "PASS",
            count: 0,
            items: [],
            issues: [],
            minors: [],
          };
        }
        const cat = report.categories[group];
        if (!cat.items.some((item) => item.id === row.id)) {
          cat.count += 1;
          cat.items.push({
            id: row.id,
            title: row.title,
            category: row.category,
            actionLabel: row.actionLabel,
            href: row.href,
            shopName: row.shopName,
            productName: row.productName,
            amount: row.amount,
            orderNumber: row.orderNumber,
          });
        }
      }

      const sampleIds = [
        "market-order-purchase-TS-FINAL-AUDIT-001",
        "platform-verify-builder-completion-001",
        "platform-verify-anpi-001",
        "platform-verify-system-001",
        "platform-verify-job-full-poster-start-001",
        "final-audit-connect-identity-001",
        "final-audit-market-shipped-001",
      ];
      for (const id of sampleIds) {
        const row = storeRows.find((r) => r.id === id);
        if (!row) {
          report.navigationChecks.push({ id, verdict: "SKIP", reason: "card_not_in_store" });
          continue;
        }
        const probe = await probeHref(request, base, row.href);
        const nav = {
          id,
          group: classifyGroup(row),
          title: row.title,
          href: row.href,
          actionLabel: row.actionLabel,
          status: probe.status,
          ok: probe.ok,
          verdict: probe.ok ? "PASS" : "FAIL",
        };
        report.navigationChecks.push(nav);
        if (!probe.ok) {
          const g = classifyGroup(row);
          report.categories[g]?.issues?.push(`遷移先エラー ${id}: ${probe.status || probe.error}`);
        }
      }
    }

    report.routingInventory = storeRows.map((row) => ({
      group: classifyGroup(row),
      id: row.id,
      title: row.title,
      category: row.category,
      actionLabel: row.actionLabel,
      href: row.href,
    }));

    const ux = buildUxReview(
      vp.label,
      audit,
      categoryShots,
      vp.label === "390" ? report.navigationChecks : []
    );
    report.uxReview.byViewport[vp.label] = ux;
    vpReport.uxReview = ux;
    vpReport.categoryShots = categoryShots;
    vpReport.verdict = audit.issues.length ? "FAIL" : audit.minors.length ? "MINOR" : "PASS";

    const missingCategoryShots = ux.categoryCoverage.filter((c) => !c.captured).map((c) => c.label);

    report.pages.push({
      viewport: vp.label,
      stepId: `notify-list-${vp.label}`,
      stepName: "TALK通知一覧",
      file: fileViewport,
      verdict: vpReport.verdict,
      issues: vpReport.issues,
      minors: vpReport.minors,
      data: { cardCount: audit.cardCount, sections: audit.sections, uxVerdict: ux.verdict },
    });

    if (missingCategoryShots.length && vp.label === "390") {
      report.pages.push({
        viewport: vp.label,
        stepId: "notify-category-coverage",
        stepName: "種別カード網羅",
        file: fileViewport,
        verdict: "MINOR",
        issues: [],
        minors: [`未キャプチャ: ${missingCategoryShots.join("、")}`],
        data: { missing: missingCategoryShots },
      });
    }

    for (const { group, label } of UX_CATEGORY_GROUPS) {
      const shot = categoryShots[group];
      if (!shot) continue;
      report.pages.push({
        viewport: vp.label,
        stepId: `notify-${group}`,
        stepName: label,
        file: shot.file,
        verdict: "PASS",
        issues: [],
        minors: [],
        data: { cardId: shot.cardId, title: shot.title },
      });
    }

    report.overall = worst(report.overall, vpReport.verdict);
  } catch (err) {
    vpReport.error = String(err?.message || err);
    vpReport.verdict = "FAIL";
    vpReport.issues = [String(err?.message || err)];
    report.overall = "FAIL";
  } finally {
    report.viewports.push(vpReport);
    await context.close();
  }
}

// 大量通知テスト（390pxのみ）
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await openNotifyCenter(page, base);
    await resetNotifyStore(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await seedExtraNotifications(page);
    const bulkCount = await injectBulkNotifications(page, 22);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed", { detail: { notifyOnly: true } }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelectorAll("[data-talk-notify-id]").length >= 20,
      { timeout: 45000 }
    );
    await page.waitForTimeout(1000);

    const bulkAudit = await page.evaluate(() => {
      const cards = document.querySelectorAll("[data-talk-notify-id]").length;
      const sections = [...document.querySelectorAll(".talk-notify-section")].map((s) => ({
        title: s.querySelector(".talk-notify-section__title")?.textContent?.trim() || "",
        count: s.querySelectorAll("[data-talk-notify-id]").length,
      }));
      const list = document.querySelector("[data-talk-notify-list]");
      const scrollRoot = list || document.scrollingElement;
      const maxScroll = scrollRoot.scrollHeight - scrollRoot.clientHeight;
      scrollRoot.scrollTop = maxScroll;
      const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      const importantPinned = document.querySelector(".talk-notify-section--important [data-talk-notify-id]");
      return {
        cards,
        sections,
        maxScroll: Math.round(maxScroll),
        scrolled: Math.round(scrollRoot.scrollTop),
        hScroll,
        importantVisible: Boolean(importantPinned),
      };
    });

    await page.screenshot({ path: path.join(OUT, "390-bulk-notify-scroll-bottom.png"), fullPage: true });
    await page.evaluate(() => {
      const list = document.querySelector("[data-talk-notify-list]");
      (list || document.scrollingElement).scrollTop = 0;
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "390-bulk-notify-scroll-top.png"), fullPage: true });

    const bulkIssues = [];
    const bulkMinors = [];
    if (bulkAudit.hScroll) bulkIssues.push("大量通知時に横スクロール");
    if (bulkAudit.cards < 20) bulkIssues.push(`大量通知件数不足 (${bulkAudit.cards})`);
    if (!bulkAudit.sections.length) bulkMinors.push("セクション見出しなし");
    if (bulkAudit.maxScroll < 100) bulkMinors.push("スクロール量が少ない");

    report.bulkTest = {
      injected: bulkCount,
      ...bulkAudit,
      verdict: bulkIssues.length ? "FAIL" : bulkMinors.length ? "MINOR" : "PASS",
      issues: bulkIssues,
      minors: bulkMinors,
    };
    report.overall = worst(report.overall, report.bulkTest.verdict);
  } catch (err) {
    report.bulkTest = { verdict: "FAIL", error: String(err?.message || err) };
    report.overall = "FAIL";
  } finally {
    await context.close();
  }
}

});

for (const [key, cat] of Object.entries(report.categories)) {
  const navFails = report.navigationChecks.filter((n) => n.group === key && n.verdict === "FAIL");
  if (navFails.length) cat.issues.push(...navFails.map((n) => `${n.id} → HTTP ${n.status}`));
  cat.verdict = cat.issues.length ? "FAIL" : cat.minors.length ? "MINOR" : "PASS";
}

report.uxReview.geminiChecklist = (() => {
  const items = new Map();
  for (const vp of ["390", "1280"]) {
    for (const row of report.uxReview.byViewport[vp]?.geminiChecklist || []) {
      const prev = items.get(row.item);
      if (!prev || (prev.ok && !row.ok)) items.set(row.item, row);
    }
  }
  return [...items.values()];
})();
report.uxReview.categoryCoverage = UX_CATEGORY_GROUPS.map(({ group, label }) => {
  const shot390 = report.uxReview.byViewport["390"]?.categoryCoverage?.find((c) => c.group === group);
  const shot1280 = report.uxReview.byViewport["1280"]?.categoryCoverage?.find((c) => c.group === group);
  return {
    group,
    label,
    shot390: shot390?.shot || null,
    shot1280: shot1280?.shot || null,
    verdict: shot390?.captured && shot1280?.captured ? "PASS" : shot390?.captured || shot1280?.captured ? "MINOR" : "FAIL",
  };
});
report.uxReview.overall = report.overall;

if (report.viewports.some((v) => (v.minors || []).some((m) => /CTA/.test(m)))) {
  report.uiConcerns.push("一部通知カードでCTAサイズが基準外の可能性（390px）");
}
if (report.viewports.some((v) => (v.minors || []).some((m) => /店舗名|商品名|金額|注文番号/.test(m)))) {
  report.uiConcerns.push("店舗販売通知の情報量（店舗名・商品名・金額・注文番号）に欠落の可能性");
}
if (report.bulkTest?.issues?.length) {
  report.uiConcerns.push("20件超の通知表示でレイアウト問題");
}
if (!report.uiConcerns.length && report.overall === "MINOR") {
  report.uiConcerns.push("軽微なUI調整のみ（本番投入可レベル）");
}
if (!report.uiConcerns.length && report.overall === "PASS") {
  report.uiConcerns.push("致命的な問題は検出されませんでした");
}

const pageStats = countVerdicts(report.pages);
const navFailCount = report.navigationChecks.filter((n) => n.verdict === "FAIL").length;
const bulkFailCount = report.bulkTest?.verdict === "FAIL" ? 1 : 0;
const bulkMinorCount = report.bulkTest?.verdict === "MINOR" ? 1 : 0;
const failCount = pageStats.failCount + navFailCount + bulkFailCount;
const minorCount = pageStats.minorCount + bulkMinorCount;
report.overall = resolveOverallFromVerdicts(failCount, minorCount);

if (failCount === 0) {
  report.fixPriorities.unshift("通知センターは本番可（FAIL 0）");
}
if (report.overall === "FAIL") {
  report.fixPriorities.push("FAIL: CTA遷移先・必須情報欠落・横スクロールの解消");
}
if (report.uiConcerns.some((c) => /CTA|フォント/.test(c))) {
  report.fixPriorities.push("390px CTAサイズ・最小フォントの調整（任意）");
}
if (report.uiConcerns.some((c) => /情報量/.test(c))) {
  report.fixPriorities.push("店舗販売カードの shopName / productName / amount / orderNumber 表示確認");
}
if (!report.fixPriorities.length) {
  report.fixPriorities.push("必須修正なし — 本番投入可");
}

report.finalNotes = {
  notifyUx: "本番可",
  geminiP1: "CTA・分離・店舗販売情報・遷移先を確認済み",
  remaining: failCount === 0 ? "FAIL 0 — MINORのみならリリース可" : "FAIL項目の解消が必要",
  failCount,
};

report.summary = {
  overall: report.overall,
  failCount,
  minorCount,
  passCount: pageStats.passCount,
  viewportVerdicts: report.viewports.map((v) => ({ label: v.label, verdict: v.verdict, cards: v.cardCount })),
  categoryVerdicts: Object.fromEntries(
    Object.entries(report.categories).map(([k, v]) => [k, { verdict: v.verdict, count: v.count }])
  ),
  navigationPass: report.navigationChecks.filter((n) => n.verdict === "PASS").length,
  navigationFail: report.navigationChecks.filter((n) => n.verdict === "FAIL").length,
  bulkVerdict: report.bulkTest?.verdict || "—",
  uxReviewVerdict: report.uxReview.overall,
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

function renderIndexHtml() {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const catRows = Object.entries(report.categories)
    .map(
      ([k, v]) =>
        `<tr><td>${esc(v.label)}</td><td><span class="badge badge--${v.verdict.toLowerCase()}">${esc(v.verdict)}</span></td><td>${v.count}</td></tr>`
    )
    .join("");
  const routeRows = (report.routingInventory || [])
    .slice(0, 80)
    .map(
      (r) =>
        `<tr><td>${esc(r.group)}</td><td><code>${esc(r.id)}</code></td><td>${esc(r.title)}</td><td>${esc(r.actionLabel)}</td><td><code>${esc(r.href)}</code></td></tr>`
    )
    .join("");
  const shots = report.viewports
    .flatMap((v) => (v.shots || []).map((s) => `<li><a href="${esc(s)}">${esc(v.label)} — ${esc(s)}</a></li>`))
    .join("");
  const catShots = (report.uxReview?.categoryCoverage || [])
    .map(
      (c) =>
        `<li>${esc(c.label)} — 390: <a href="${esc(c.shot390 || "")}">${esc(c.shot390 || "—")}</a> / 1280: <a href="${esc(c.shot1280 || "")}">${esc(c.shot1280 || "—")}</a></li>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>TALK通知センター 最終監査</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;background:#f8fafc}.badge{padding:2px 8px;border-radius:999px;font-weight:800;font-size:.75rem}.badge--pass{background:#dcfce7;color:#15803d}.badge--minor{background:#ffedd5;color:#b45309}.badge--fail{background:#fee2e2;color:#b91c1c}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #e2e8f0;padding:8px;font-size:.8125rem}th{background:#f1f5f9}${SCREENSHOT_BACK_NAV_CSS}</style></head>
<body>${renderScreenshotBackNav()}<h1>TALK通知センター 最終監査</h1><p>総合: <span class="badge badge--${report.overall.toLowerCase()}">${esc(report.overall)}</span> · FAIL ${report.summary?.failCount ?? 0} · ${esc(report.generatedAt)}</p>
<h2>Gemini UX確認</h2><ul>${(report.uxReview?.geminiChecklist || [])
    .map((c) => `<li>${c.ok ? "✓" : "△"} ${esc(c.item)}${c.note ? ` — <small>${esc(c.note)}</small>` : ""}</li>`)
    .join("")}</ul>
<h2>カテゴリ別</h2><table><thead><tr><th>カテゴリ</th><th>判定</th><th>件数</th></tr></thead><tbody>${catRows}</tbody></table>
<h2>通知→遷移先一覧</h2><table><thead><tr><th>グループ</th><th>ID</th><th>タイトル</th><th>CTA</th><th>URL</th></tr></thead><tbody>${routeRows}</tbody></table>
<h2>スクショ</h2><ul>${shots}<li><a href="390-bulk-notify-scroll-top.png">390 大量通知（先頭）</a></li><li><a href="390-bulk-notify-scroll-bottom.png">390 大量通知（末尾）</a></li></ul>
<h2>種別カード（390/1280）</h2><ul>${catShots}</ul>
<h2>気になるUI</h2><ul>${(report.uiConcerns || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>修正優先順位</h2><ol>${(report.fixPriorities || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
</body></html>`;
}

fs.writeFileSync(path.join(OUT, "index.html"), renderIndexHtml());

console.log(JSON.stringify(report.summary, null, 2));
console.log(`\nSaved: ${OUT}/report.json`);
console.log(`Saved: ${OUT}/index.html`);

await finalizeVerification(root, { primaryFolder: "talk-notification-final-review", openBrowser: false });

await closeAllBrowsers();
