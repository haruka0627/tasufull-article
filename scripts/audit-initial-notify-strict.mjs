#!/usr/bin/env node
/**
 * 初回CTA → A上通知（厳密）— listingId / title / recipientUserId で判定
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "bench-cta-audit", "initial-notify-strict.json");

const CATEGORIES = [
  {
    id: "skill",
    profile: "skill",
    pattern: "skill-0",
    baseline: true,
    listingId: "demo-skill-001",
    partnerAId: "u_sachi",
    expectedTitle: "購入",
    frameRe: /detail-skill/i,
    ctaSelectors: [".skill-cta-panel__primary.cta-consult", "[data-listing-primary-cta]"],
    storeKey: "tasful_listing_contact_requests_v1",
  },
  {
    id: "job",
    profile: "job",
    pattern: "job-0",
    baseline: true,
    listingId: "job_demo_full_001",
    partnerAId: "u_job_demo_full",
    expectedTitle: "応募",
    frameRe: /detail-job/i,
    ctaSelectors: ["[data-tasu-mdetail-hero-apply]", "[data-listing-primary-cta]"],
    storeKey: "tasful_job_applications_v1",
  },
  {
    id: "worker",
    profile: "worker",
    pattern: "worker-0",
    listingId: "demo-worker-001",
    partnerAId: "demo-worker-001",
    expectedTitle: "依頼が届きました",
    frameRe: /detail-worker/i,
    ctaSelectors: ["[data-listing-primary-cta]"],
    storeKey: "tasful_worker_requests_v1",
  },
  {
    id: "general",
    profile: "general",
    pattern: "general-0",
    listingId: "demo-general-001",
    partnerAId: "u_general_demo",
    expectedTitle: "応募/依頼が届きました",
    frameRe: /detail-general/i,
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
    storeKey: "tasful_listing_contact_requests_v1",
  },
  {
    id: "product",
    profile: "product",
    pattern: "product-0",
    listingId: "demo-product-001",
    partnerAId: "u_product",
    expectedTitle: "商品が購入されました",
    frameRe: /detail-product/i,
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
    storeKey: "tasful_listing_contact_requests_v1",
  },
  {
    id: "shop",
    profile: "shop",
    pattern: "shop-0",
    listingId: "demo-shop-reworks",
    partnerAId: "u_shop_demo",
    expectedTitle: "予約/注文が入りました",
    frameRe: /detail-shop/i,
    ctaSelectors: [".shop-mobile-inquiry-dock__btn", "[data-biz-detail-inquiry]"],
    storeKey: "tasful_listing_contact_requests_v1",
  },
  {
    id: "business",
    profile: "business",
    pattern: "business-0",
    listingId: "demo-business-service-001",
    partnerAId: "u_business_demo",
    expectedTitle: "相談/依頼が届きました",
    frameRe: /detail-business-service/i,
    ctaSelectors: ["[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary"],
    storeKey: "tasful_listing_contact_requests_v1",
  },
];

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

async function auditOne(page, cat) {
  const url =
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.profile}` +
    `&demoConnect=0&liveFlow=1&liveFlowReset=1&benchViewport=390&benchPattern=${cat.pattern}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);

  const pre = await page.evaluate(
    ({ listingId, storeKey, partnerAId }) => {
      const Demo = global.TasuPlatformChatDualWindowDemo;
      Demo?.resetLiveFlow?.({ profile: new URLSearchParams(location.search).get("demoProfile"), connect: false });
      const Gate = global.TasuPlatformChatFeeGateFlow;
      const profile = Demo?.getProfile?.();
      if (profile && Gate?.clearConnectFreeGateRecords) Gate.clearConnectFreeGateRecords(profile);

      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const store = JSON.parse(localStorage.getItem(storeKey) || "[]");
      return {
        notifyIds: notifs.map((n) => n.id),
        storeCount: store.filter((r) => String(r.listing_id) === listingId).length,
        partnerAId: profile?.partnerAId || partnerAId,
      };
    },
    { listingId: cat.listingId, storeKey: cat.storeKey, partnerAId: cat.partnerAId }
  );

  const bFrame = page.frames().find((f) => cat.frameRe.test(f.url()));
  if (!bFrame) return { category: cat.id, error: "b_frame_missing", pre };

  const cta = await bFrame.evaluate((selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        selector: sel,
        text: el.textContent?.trim().replace(/\s+/g, " ").slice(0, 50),
        elementFromPointOk: top === el || el.contains(top),
        listingLoaded: Boolean(window.__tasuDetailContactListing),
        usesFeeGate: window.TasuPlatformChatFeeGateFlow?.usesConnectFreeFeeGate?.(
          window.__tasuDetailContactListing
        ),
      };
    }
    return { error: "no_cta" };
  }, cat.ctaSelectors);

  if (cta.error) return { category: cat.id, error: cta.error, pre, cta };

  let clickOk = false;
  let clickErr = "";
  try {
    await bFrame.locator(cta.selector).click({ timeout: 12000 });
    clickOk = true;
  } catch (e) {
    clickErr = String(e.message || e).split("\n")[0];
  }

  await page.waitForTimeout(2500);

  // 人工 refresh なし — B→parent postMessage / storage イベントのみ待つ
  await page.waitForTimeout(2000);

  const post = await page.evaluate(
    ({ listingId, storeKey, partnerAId, expectedTitle, preNotifyIds, preStoreCount }) => {
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const store = JSON.parse(localStorage.getItem(storeKey) || "[]");
      const prevIds = new Set(Array.isArray(preNotifyIds) ? preNotifyIds : []);
      const newNotifs = notifs.filter((n) => !prevIds.has(n.id));

      const titleMatch = (n) => {
        const t = String(n.title || "");
        if (expectedTitle.includes("/")) {
          const parts = expectedTitle.split("/");
          return parts.some((p) => t.includes(p.trim()));
        }
        return t.includes(expectedTitle) || t.includes(expectedTitle.slice(0, 4));
      };

      const notify =
        newNotifs.find(
          (n) => String(n.listingId || n.listing_id) === listingId && titleMatch(n)
        ) ||
        newNotifs.find((n) => String(n.listingId || n.listing_id) === listingId) ||
        null;

      const recipientOk =
        notify &&
        (String(notify.recipientUserId) === String(partnerAId) ||
          String(notify.recipientRole) === "seller" ||
          String(notify.recipientRole) === "worker" ||
          String(notify.recipientRole) === "provider");

      const storeDelta =
        store.filter((r) => String(r.listing_id) === listingId).length - preStoreCount;

      const aWin = document.getElementById("frame-a-notify")?.contentWindow;
      let aDom = false;
      if (aWin && notify?.title) {
        const key = String(notify.title).slice(0, 6);
        aDom = Array.from(aWin.document.querySelectorAll(".talk-notify-card__title")).some((el) =>
          String(el.textContent || "").includes(key)
        );
      }

      return {
        newNotifyCount: newNotifs.length,
        notify,
        recipientOk,
        storeDelta,
        aDom,
        newNotifyTitles: newNotifs.map((n) => ({
          id: n.id,
          title: n.title,
          listingId: n.listingId,
          recipientUserId: n.recipientUserId,
          source: n.source,
        })),
      };
    },
    {
      listingId: cat.listingId,
      storeKey: cat.storeKey,
      partnerAId: pre.partnerAId,
      expectedTitle: cat.expectedTitle,
      preNotifyIds: pre.notifyIds,
      preStoreCount: pre.storeCount,
    }
  );

  const notifyOk = Boolean(post.notify) && post.recipientOk;
  const storeOk = post.storeDelta > 0 || cat.id === "job";

  return {
    category: cat.id,
    baseline: cat.baseline || false,
    ctaClick: clickOk ? "OK" : "NG",
    elementFromPoint: cta.elementFromPointOk ? "OK" : "NG",
    feeGate: cta.usesFeeGate ? "OK" : "NG",
    storeRecord: storeOk ? "OK" : "NG",
    notifyCreated: notifyOk ? "OK" : "NG",
    notifyDisplay: post.aDom ? "OK" : "NG",
    expectedTitle: cat.expectedTitle,
    actualTitle: post.notify?.title || "",
    recipientUserId: post.notify?.recipientUserId || "",
    partnerAId: pre.partnerAId,
    listingId: cat.listingId,
    newNotifyTitles: post.newNotifyTitles,
    storeDelta: post.storeDelta,
    clickErr,
    cta,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const results = [];

try {
  for (const cat of CATEGORIES) {
    console.log(`Strict audit: ${cat.id}`);
    results.push(await auditOne(page, cat));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ results }, null, 2));
  console.log("\n=== STRICT INITIAL NOTIFY ===");
  console.table(
    results.map((r) => ({
      カテゴリ: r.category + (r.baseline ? "*" : ""),
      クリック: r.ctaClick,
      ストア: r.storeRecord,
      通知: r.notifyCreated,
      A表示: r.notifyDisplay,
      期待: r.expectedTitle,
      実際: r.actualTitle || r.error || "",
    }))
  );
  const failed = results.filter((r) => r.notifyCreated !== "OK" && !r.baseline);
  if (failed.length) {
    console.log("\nFAILED (non-baseline):", failed.map((f) => f.category).join(", "));
    process.exit(1);
  }
} finally {
  await browser.close();
}
