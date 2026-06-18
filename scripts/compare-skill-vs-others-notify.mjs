#!/usr/bin/env node
/**
 * スキル成功経路 vs 他カテゴリ — 6項目比較（人工 refresh なし）
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "skill-vs-others", "compare.json");

const CATS = [
  {
    id: "skill",
    baseline: true,
    profile: "skill",
    pattern: "skill-0",
    partnerAId: "u_sachi",
    listingId: "demo-skill-001",
    frameRe: /detail-skill/i,
    cta: ".skill-cta-panel__primary.cta-consult, [data-listing-primary-cta]",
    flow: "fee_gate",
    notifyFn: "notifyListingPurchased",
  },
  {
    id: "job",
    profile: "job",
    pattern: "job-0",
    partnerAId: "u_job_demo_full",
    listingId: "job_demo_full_001",
    frameRe: /detail-job/i,
    cta: "[data-tasu-mdetail-hero-apply], [data-listing-primary-cta]",
    flow: "job_apply",
    notifyFn: "notifyJobApplicationReceived",
  },
  {
    id: "worker",
    profile: "worker",
    pattern: "worker-0",
    partnerAId: "demo-worker-001",
    listingId: "demo-worker-001",
    frameRe: /detail-worker/i,
    cta: "[data-listing-primary-cta]",
    flow: "fee_gate_worker",
    notifyFn: "notifyListingPurchased",
  },
  {
    id: "general",
    profile: "general",
    pattern: "general-0",
    partnerAId: "u_general_demo",
    listingId: "demo-general-001",
    frameRe: /detail-general/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    flow: "fee_gate",
    notifyFn: "notifyListingPurchased",
  },
  {
    id: "product",
    profile: "product",
    pattern: "product-0",
    partnerAId: "u_product",
    listingId: "demo-product-001",
    frameRe: /detail-product/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    flow: "fee_gate",
    notifyFn: "notifyListingPurchased",
  },
  {
    id: "shop",
    profile: "shop",
    pattern: "shop-0",
    partnerAId: "u_shop_demo",
    listingId: "demo-shop-reworks",
    frameRe: /detail-shop/i,
    cta: ".shop-mobile-inquiry-dock__btn, [data-biz-detail-inquiry]",
    flow: "fee_gate",
    notifyFn: "notifyShopInquiry",
  },
  {
    id: "business",
    profile: "business",
    pattern: "business-0",
    partnerAId: "u_business_demo",
    listingId: "demo-business-service-001",
    frameRe: /detail-business-service/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    flow: "fee_gate",
    notifyFn: "notifyBusinessInquiry",
  },
];

function buildUrl(cat) {
  return (
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=${cat.pattern}&liveFlowReset=1`
  );
}

async function runOne(browser, cat) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const trace = { category: cat.id, baseline: cat.baseline, expectedFlow: cat.flow, expectedNotifyFn: cat.notifyFn };

  await page.addInitScript(() => {
    window.__parentMsgs = [];
    window.addEventListener("message", (ev) => {
      const d = ev.data || {};
      if (d.type === "tasu-bench-worker-requested") {
        window.__parentMsgs.push({ type: d.type, recipientUserId: d.recipientUserId, at: Date.now() });
      }
    });
  });

  try {
    await page.goto(buildUrl(cat), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const before = await page.evaluate(
      ({ listingId }) => ({
        notifyCount: JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length,
        aUserId: (() => {
          try {
            return new URL(document.getElementById("frame-a-notify").src, location.href).searchParams.get("userId");
          } catch {
            return "";
          }
        })(),
        listingRows: JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]").filter(
          (r) => String(r.listing_id) === listingId
        ).length,
      }),
      { listingId: cat.listingId }
    );
    trace.before = before;

    const bFrame = page.frames().find((f) => cat.frameRe.test(f.url()));
    if (!bFrame) {
      trace.error = "b_frame_missing";
      return trace;
    }

    const preClick = await bFrame.evaluate(
      ({ cta, listingId, notifyFn }) => {
        const listing = window.__tasuDetailContactListing;
        const Gate = window.TasuPlatformChatFeeGateFlow;
        const calls = { notifyCalled: false, notifyFn: null };
        const Notify = window.TasuTalkPlatformNotify;
        if (Notify) {
          const origPurchased = Notify.notifyListingPurchased;
          const origShop = Notify.notifyShopInquiry;
          const origBusiness = Notify.notifyBusinessInquiry;
          const origJob = Notify.notifyJobApplicationReceived;
          const mark = (name) => {
            calls.notifyCalled = true;
            calls.notifyFn = name;
          };
          if (origPurchased) {
            Notify.notifyListingPurchased = function (...args) {
              mark("notifyListingPurchased");
              return origPurchased.apply(this, args);
            };
          }
          if (origShop) {
            Notify.notifyShopInquiry = function (...args) {
              mark("notifyShopInquiry");
              return origShop.apply(this, args);
            };
          }
          if (origBusiness) {
            Notify.notifyBusinessInquiry = function (...args) {
              mark("notifyBusinessInquiry");
              return origBusiness.apply(this, args);
            };
          }
          if (origJob) {
            Notify.notifyJobApplicationReceived = function (...args) {
              mark("notifyJobApplicationReceived");
              return origJob.apply(this, args);
            };
          }
          window.__notifySpy = calls;
        }
        const sel = cta.split(",")[0].trim();
        const el = document.querySelector(sel);
        return {
          usesFeeGate: Gate?.usesConnectFreeFeeGate?.(listing),
          categoryKey: Gate?.resolveCategoryKey?.(listing),
          listingUserId: listing?.user_id || "",
          listingType: listing?.listing_type || listing?.listingType || "",
          hasStartContact: Boolean(window.TasuContactActions?.startContact),
          ctaFound: Boolean(el),
          ctaText: el?.textContent?.trim().slice(0, 40),
        };
      },
      { cta: cat.cta, listingId: cat.listingId, notifyFn: cat.notifyFn }
    );
    trace.preClick = preClick;

    const sel = cat.cta.split(",")[0].trim();
    try {
      await bFrame.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await bFrame.locator(sel).first().click({ timeout: 12000 });
      trace.ctaClick = "OK";
    } catch (e) {
      trace.ctaClick = `FAIL: ${String(e.message || e).split("\n")[0]}`;
      return trace;
    }

    await page.waitForTimeout(4000);

    const after = await page.evaluate(
      ({ listingId, partnerAId, notifyCountBefore, expectedNotifyFn }) => {
        const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
        const newRows = notifs.slice(notifyCountBefore);
        const forListing = newRows.filter((n) => String(n.listingId || n.listing_id) === listingId);
        const latest = forListing[0] || newRows[0] || null;

        const aWin = document.getElementById("frame-a-notify")?.contentWindow;
        const aUserId = (() => {
          try {
            return new URL(aWin.location.href).searchParams.get("userId");
          } catch {
            return "";
          }
        })();

        let pipeline = [];
        let domVisible = [];
        if (aWin) {
          aWin.TasuTalkData?.invalidateNotificationsBootstrap?.();
          pipeline = (aWin.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) || []).map(
            (n) => n.title
          );
          domVisible = [...aWin.document.querySelectorAll(".talk-notify-card")].map((card) => {
            const title = card.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
            const rect = card.getBoundingClientRect();
            const st = aWin.getComputedStyle(card);
            const visible =
              rect.width > 0 && rect.height > 0 && st.display !== "none" && st.visibility !== "hidden";
            return { title, visible };
          });
        }

        const bWin = document.getElementById("frame-b-chat")?.contentWindow;
        const notifySpy = bWin?.__notifySpy || { notifyCalled: false };

        return {
          storageDelta: notifs.length - notifyCountBefore,
          latest: latest
            ? {
                title: latest.title,
                recipientUserId: latest.recipientUserId,
                source: latest.source,
                listingId: latest.listingId,
              }
            : null,
          recipientMatch: String(latest?.recipientUserId || "") === String(partnerAId),
          aUserId,
          aUserMatch: aUserId === partnerAId,
          parentMsgs: window.__parentMsgs || [],
          notifySpy,
          pipelineTitles: pipeline.slice(0, 5),
          domVisible,
          empty: aWin?.document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null,
        };
      },
      {
        listingId: cat.listingId,
        partnerAId: cat.partnerAId,
        notifyCountBefore: before.notifyCount,
        expectedNotifyFn: cat.notifyFn,
      }
    );
    trace.after = after;

    trace.checks = {
      "1_notify_fn": after.notifySpy?.notifyCalled ? `OK:${after.notifySpy.notifyFn}` : "NG:not_called",
      "2_storage": after.storageDelta > 0 && after.latest ? "OK" : "NG",
      "3_recipient": after.recipientMatch ? "OK" : `NG:${after.latest?.recipientUserId || "empty"}`,
      "4_a_user": after.aUserMatch ? "OK" : `NG:a=${after.aUserId}`,
      "5_refresh": after.parentMsgs.length > 0 ? `OK:${after.parentMsgs[0].recipientUserId}` : "NG:no_postMessage",
      "6_dom_visible": after.domVisible.some((c) => c.visible) ? "OK" : "NG",
    };
    trace.verdict = Object.values(trace.checks).every((v) => String(v).startsWith("OK")) ? "PASS" : "FAIL";

    await page.locator("#frame-a-notify").screenshot({
      path: path.join("screenshots", "skill-vs-others", `${cat.id}-a-notify.png`),
    });
  } catch (e) {
    trace.error = String(e.message || e);
    trace.verdict = "ERROR";
  } finally {
    await page.close();
  }
  return trace;
}

await withPlaywrightBrowser(async (browser) => {fs.mkdirSync(path.dirname(OUT), { recursive: true });
const results = [];
for (const cat of CATS) {
  console.log(`Compare: ${cat.id}`);
  results.push(await runOne(browser, cat));
}
});
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));

console.log("\n=== SKILL vs OTHERS (6 checks) ===");
for (const r of results) {
  console.log(
    `${r.baseline ? "skill*" : r.category.padEnd(9)} ${r.verdict || r.error}  ${JSON.stringify(r.checks || {})}`
  );
}
console.log(`\n${OUT}`);

await closeAllBrowsers();
