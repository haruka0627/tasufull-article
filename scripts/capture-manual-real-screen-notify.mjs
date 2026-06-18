#!/usr/bin/env node
/**
 * 実画面証跡 — B下CTA → A上通知カード表示 → カードCTA → Aチャット遷移
 * 完了条件: スクショで A上通知カードが視認できること
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "manual-real-screen-notify");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CATS = [
  {
    id: "skill",
    pattern: "skill-0",
    partnerAId: "u_sachi",
    frameRe: /detail-skill/i,
    cta: ".skill-cta-panel__primary.cta-consult",
    expectedNotifyTitle: "購入",
    navExpect: /detail-skill\.html.*view=contacts|#contacts/i,
  },
  {
    id: "job",
    pattern: "job-0",
    partnerAId: "u_job_demo_full",
    frameRe: /detail-job/i,
    cta: "[data-tasu-mdetail-hero-apply]",
    expectedNotifyTitle: "応募",
    navExpect: /detail-job\.html.*(view=applications|#applications)/i,
  },
  {
    id: "worker",
    pattern: "worker-0",
    partnerAId: "demo-worker-001",
    frameRe: /detail-worker/i,
    cta: "[data-listing-primary-cta]",
    expectedNotifyTitle: "依頼が届きました",
    navExpect: /detail-worker\.html.*(view=requests|#requests)/i,
  },
  {
    id: "general",
    pattern: "general-0",
    partnerAId: "u_general_demo",
    frameRe: /detail-general/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    expectedNotifyTitle: "応募/依頼",
    navExpect: /detail-general\.html.*(view=contacts|#contacts)/i,
  },
  {
    id: "product",
    pattern: "product-0",
    partnerAId: "u_product",
    frameRe: /detail-product/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    expectedNotifyTitle: "購入されました",
    navExpect: /detail-product\.html.*(view=contacts|#contacts)/i,
  },
  {
    id: "shop",
    pattern: "shop-0",
    partnerAId: "u_shop_demo",
    frameRe: /detail-shop/i,
    cta: ".shop-mobile-inquiry-dock__btn",
    expectedNotifyTitle: "予約/注文",
    navExpect: /detail-shop\.html.*(view=contacts|#contacts)/i,
  },
  {
    id: "business",
    pattern: "business-0",
    partnerAId: "u_business_demo",
    frameRe: /detail-business-service/i,
    cta: "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
    expectedNotifyTitle: "相談/依頼",
    navExpect: /detail-business-service\.html.*(view=contacts|#contacts)/i,
  },
];

function buildUrl(cat) {
  return (
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.id}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=${cat.pattern}&liveFlowReset=1`
  );
}

function titleMatches(title, needle) {
  const t = String(title || "");
  if (needle.includes("/")) {
    return needle.split("/").some((p) => t.includes(p.trim()));
  }
  return t.includes(needle);
}

async function captureCategory(browser, cat) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 900 } })
  ).newPage();
  const result = {
    category: cat.id,
    url: buildUrl(cat),
    screenshots: {},
    steps: {},
    ok: false,
  };

  try {
    await page.goto(result.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    const bFrame = page.frames().find((f) => cat.frameRe.test(f.url()));
    if (!bFrame) throw new Error("B detail frame not found");

    await bFrame.locator(cat.cta).first().scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
    await bFrame.locator(cat.cta).first().click({ timeout: 15000 });
    result.steps.ctaClick = "OK";
    await page.waitForTimeout(4500);

    const notifyShot = path.join(OUT_DIR, `${cat.id}-02-a-notify-card.png`);
    const benchShot = path.join(OUT_DIR, `${cat.id}-01-bench-after-cta.png`);
    const pageShot = path.join(OUT_DIR, `${cat.id}-00-full-bench.png`);
    await page.screenshot({ path: pageShot, fullPage: false });
    result.screenshots.fullBench = pageShot;
    await page.locator("section.bench-col--a").first().screenshot({ path: benchShot });
    await page.locator("#frame-a-notify").screenshot({ path: notifyShot });
    result.screenshots.benchA = benchShot;
    result.screenshots.aNotify = notifyShot;

    const cardState = await page.evaluate(
      ({ expectedTitle }) => {
        const aWin = document.getElementById("frame-a-notify")?.contentWindow;
        if (!aWin) return { error: "no_a_notify_window" };
        const cards = [...aWin.document.querySelectorAll(".talk-notify-card")];
        const rows = cards.map((card) => {
          const title =
            card.querySelector(".talk-notify-card__title")?.textContent?.trim() || "";
          const cta =
            card.querySelector(
              "[data-talk-notify-action='navigate'], .talk-notify-card__minimal-action, .talk-notify-card__card-cta"
            ) || null;
          const rect = card.getBoundingClientRect();
          const st = aWin.getComputedStyle(card);
          const visible =
            rect.width > 8 &&
            rect.height > 8 &&
            st.display !== "none" &&
            st.visibility !== "hidden" &&
            Number(st.opacity) > 0.05;
          return {
            title,
            visible,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            ctaText: cta?.textContent?.trim() || "",
            ctaHref: cta?.getAttribute("data-talk-notify-href") || "",
          };
        });
        const match = rows.find((r) => {
          const t = String(r.title || "");
          if (expectedTitle.includes("/")) {
            return expectedTitle.split("/").some((p) => t.includes(p.trim()));
          }
          return t.includes(expectedTitle);
        });
        const empty =
          aWin.document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() ||
          null;
        return {
          cardCount: cards.length,
          rows,
          match,
          empty,
          aUserId: new URLSearchParams(aWin.location.search).get("userId"),
        };
      },
      { expectedTitle: cat.expectedNotifyTitle }
    );
    result.steps.notifyCard = cardState;

    const cardVisible =
      cardState.match?.visible === true &&
      titleMatches(cardState.match?.title, cat.expectedNotifyTitle);
    result.steps.notifyVisibleOnScreen = cardVisible ? "OK" : "NG";

    if (!cardVisible) {
      result.error = cardState.empty || "notify card not visible on screen";
      return result;
    }

    const aNotifyFrame = page.frameLocator("#frame-a-notify");
    const notifyCta = aNotifyFrame
      .locator(
        "[data-talk-notify-action='navigate'], .talk-notify-card__minimal-action, .talk-notify-card__card-cta"
      )
      .filter({ hasText: /.+/ })
      .first();

    const aChatSrcBefore = await page.locator("#frame-a-chat").getAttribute("src");
    await notifyCta.click({ timeout: 12000 });
    await page.waitForTimeout(3500);

    const chatShot = path.join(OUT_DIR, `${cat.id}-03-a-chat-after-nav.png`);
    await page.locator("#frame-a-chat").screenshot({ path: chatShot });
    result.screenshots.aChat = chatShot;

    const nav = await page.evaluate(() => {
      const aChat = document.getElementById("frame-a-chat");
      const win = aChat?.contentWindow;
      const src = win?.location?.href || aChat?.src || "";
      let norm = src;
      try {
        const u = new URL(src, location.href);
        norm = `${u.pathname}${u.search}${u.hash}`;
      } catch {
        /* ignore */
      }
      const hasContacts =
        win?.document?.querySelector?.("[data-listing-contacts-section], #contacts, [data-listing-contacts-list]") !=
        null;
      const hasApplications =
        win?.document?.querySelector?.("#applications, [data-job-applications], .job-applications") != null;
      const reqCard = win?.document?.querySelector?.(
        "[data-worker-req-card], [data-worker-requests-list] .job-app-card:not(.job-app-card--empty)"
      );
      const reqRect = reqCard?.getBoundingClientRect?.();
      const reqStyle = reqCard ? win.getComputedStyle(reqCard) : null;
      const hasRequests =
        Boolean(reqCard) &&
        (reqRect?.width || 0) > 8 &&
        (reqRect?.height || 0) > 8 &&
        reqStyle?.display !== "none" &&
        reqStyle?.visibility !== "hidden";
      const requesterName =
        reqCard?.querySelector?.(".job-app-card__name")?.textContent?.trim() || "";
      return { aChatSrc: norm, hasContacts, hasApplications, hasRequests, requesterName };
    });

    const aChatSrcAfter = await page.locator("#frame-a-chat").getAttribute("src");
    result.steps.nav = nav;
    result.steps.aChatChanged = aChatSrcBefore !== aChatSrcAfter;
    result.steps.navUrlMatch = cat.navExpect.test(nav.aChatSrc || "");

    const navOk =
      cat.id === "worker"
        ? nav.hasRequests === true
        : cat.id === "job"
          ? nav.hasApplications === true
          : result.steps.navUrlMatch || nav.hasContacts;

    result.ok = cardVisible && result.steps.aChatChanged && navOk;
  } catch (e) {
    result.error = String(e.message || e).split("\n")[0];
  } finally {
    await page.close();
  }
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const cat of CATS) {
  console.log(`Capture: ${cat.id}`);
  results.push(await captureCategory(browser, cat));
}
await browser.close();

const reportPath = path.join(OUT_DIR, "report.json");
fs.writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));

console.log("\n=== MANUAL REAL SCREEN NOTIFY ===");
for (const r of results) {
  const vis = r.steps?.notifyVisibleOnScreen || "—";
  const nav = r.ok ? "nav OK" : r.steps?.navUrlMatch ? "nav OK" : "nav NG";
  console.log(
    `${r.category}: ${r.ok ? "SCREEN OK" : "SCREEN NG"}  notify=${vis}  ${nav}` +
      (r.screenshots?.aNotify ? `  → ${r.screenshots.aNotify}` : "") +
      (r.error ? `  (${r.error})` : "")
  );
}
console.log(`\nReport: ${reportPath}`);
