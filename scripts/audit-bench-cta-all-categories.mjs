#!/usr/bin/env node
/**
 * 全カテゴリ CTA 監査 — benchViewport=390, demoConnect=0
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "bench-cta-audit");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CATEGORIES = [
  {
    id: "job",
    profile: "job",
    pattern: "job-0",
    baseline: true,
    notifyTitle: "応募",
    frameRe: /detail-job/i,
    ctaSelectors: ["[data-tasu-mdetail-hero-apply]", "[data-listing-primary-cta]"],
    flow: "job-apply",
  },
  {
    id: "skill",
    profile: "skill",
    pattern: "skill-0",
    baseline: true,
    notifyTitle: "購入",
    frameRe: /detail-skill/i,
    ctaSelectors: ["[data-listing-primary-cta]", ".skill-cta-panel__primary.cta-consult"],
    flow: "contact-actions",
  },
  {
    id: "worker",
    profile: "worker",
    pattern: "worker-0",
    notifyTitle: "依頼が届きました",
    frameRe: /detail-worker/i,
    ctaSelectors: ["[data-listing-primary-cta]"],
    flow: "contact-actions",
  },
  {
    id: "general",
    profile: "general",
    pattern: "general-0",
    notifyTitle: "応募/依頼が届きました",
    frameRe: /detail-general/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-business-service-estimate]",
    ],
    flow: "contact-actions",
  },
  {
    id: "product",
    profile: "product",
    pattern: "product-0",
    notifyTitle: "商品が購入されました",
    frameRe: /detail-product/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-listing-primary-cta]",
    ],
    flow: "contact-actions",
  },
  {
    id: "shop",
    profile: "shop",
    pattern: "shop-0",
    notifyTitle: "予約/注文が入りました",
    frameRe: /detail-shop/i,
    ctaSelectors: [".shop-mobile-inquiry-dock__btn", "[data-biz-detail-inquiry]"],
    flow: "contact-actions",
  },
  {
    id: "business",
    profile: "business",
    pattern: "business-0",
    notifyTitle: "相談/依頼が届きました",
    frameRe: /detail-business-service/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-business-service-estimate]",
    ],
    flow: "contact-actions",
  },
  {
    id: "builder",
    profile: "builder",
    pattern: "builder-0",
    notifyTitle: "案件応募/依頼が届きました",
    frameRe: /deal-detail/i,
    ctaSelectors: ["[data-deal-accept]", "[data-deal-approve]", "[data-listing-primary-cta]"],
    flow: "builder-deal",
  },
];

async function auditCategory(page, cat) {
  const url =
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=${cat.pattern}&liveFlowReset=1`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);

  const meta = await page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    return {
      partnerAId: profile?.partnerAId || "",
      bChatSrc: document.getElementById("frame-b-chat")?.src || "",
      notifyBefore: JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length,
    };
  }, cat.profile);

  const bFrame = page.frames().find((f) => cat.frameRe.test(f.url()));
  if (!bFrame) {
    return rowFail(cat, "B frame missing", meta);
  }

  const ctaPick = await bFrame.evaluate((selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const same = top === el || el.contains(top);
      return {
        selector: sel,
        text: el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40),
        elementFromPointOk: same,
        blocker: top
          ? { tag: top.tagName, cls: String(top.className || "").slice(0, 80) }
          : null,
        navDisplay: document.querySelector(".section-nav")
          ? getComputedStyle(document.querySelector(".section-nav")).display
          : "missing",
        mdetail: document.body.classList.contains("tasu-mdetail-page"),
        viewport: { w: innerWidth, h: innerHeight },
        rect: { top: r.top, bottom: r.bottom, h: r.height },
      };
    }
    return { error: "no_visible_cta" };
  }, cat.ctaSelectors);

  if (ctaPick.error) {
    return rowFail(cat, "visible CTA not found", meta, ctaPick);
  }

  await bFrame.evaluate(() => {
    window.__auditFlowHit = false;
  });

  let clickOk = false;
  let clickError = "";
  try {
    await bFrame.locator(ctaPick.selector).click({ timeout: 10000 });
    clickOk = true;
  } catch (e) {
    clickError = String(e.message || e).split("\n")[0];
  }

  await page.waitForTimeout(2800);

  const post = await page.evaluate(
    ({ sellerId, notifyTitle, notifyBefore }) => {
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const delta = notifs.length - notifyBefore;
      const needle = String(notifyTitle).split("/")[0].slice(0, 4);
      const row =
        notifs
          .slice(notifyBefore)
          .find(
            (n) =>
              String(n.recipientUserId) === String(sellerId) &&
              String(n.title || "").includes(needle)
          ) ||
        (delta > 0 ? notifs[notifs.length - 1] : null);

      const aWin = document.getElementById("frame-a-notify")?.contentWindow;
      let aDom = false;
      if (aWin && row?.title) {
        const key = String(row.title).slice(0, 6);
        aDom = Array.from(
          aWin.document.querySelectorAll(".talk-notify-card__title, [data-notify-title]")
        ).some((el) => String(el.textContent || "").includes(key));
      }
      if (!aDom && aWin && row?.title) {
        document.getElementById("frame-a-notify").src =
          document.getElementById("frame-a-notify").src;
        aWin.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
      }
      return { delta, row, aDom };
    },
    {
      sellerId: meta.partnerAId,
      notifyTitle: cat.notifyTitle,
      notifyBefore: meta.notifyBefore,
    }
  );

  await page.waitForTimeout(2000);

  const aDom = await page
    .frameLocator("#frame-a-notify")
    .locator(`text=${cat.notifyTitle.split("/")[0].slice(0, 4)}`)
    .first()
    .isVisible()
    .catch(() => post.aDom);

  const notifyCreated = Boolean(post.row) && post.delta > 0;
  const startContactOk =
    cat.flow === "builder-deal"
      ? clickOk
      : clickOk && notifyCreated;

  const hasIssue =
    !ctaPick.elementFromPointOk || !clickOk || !startContactOk || !notifyCreated;

  return {
    category: cat.id,
    baseline: cat.baseline || false,
    ctaClick: clickOk ? "OK" : `NG`,
    elementFromPoint: ctaPick.elementFromPointOk ? "OK" : "NG",
    startContact: startContactOk ? "OK" : "NG",
    notifyCreated: notifyCreated ? "OK" : "NG",
    notifyDisplay: aDom ? "OK" : "NG",
    hasIssue,
    issue: hasIssue
      ? [
          !ctaPick.elementFromPointOk ? `blocked:${ctaPick.blocker?.cls || "?"}` : "",
          !clickOk ? clickError || "click failed" : "",
          !notifyCreated ? "no notify" : "",
        ]
          .filter(Boolean)
          .join("; ")
      : "",
    cta: ctaPick,
    notify: post.row,
    meta,
  };
}

function rowFail(cat, issue, meta, extra) {
  return {
    category: cat.id,
    baseline: cat.baseline || false,
    ctaClick: "—",
    elementFromPoint: "—",
    startContact: "—",
    notifyCreated: "—",
    notifyDisplay: "—",
    hasIssue: true,
    issue,
    meta,
    extra,
  };
}

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const results = [];


  for (const cat of CATEGORIES) {
    console.log(`Auditing ${cat.id}...`);
    results.push(await auditCategory(page, cat));
  }
  fs.writeFileSync(path.join(OUT_DIR, "audit-after-fix.json"), JSON.stringify({ results }, null, 2));
  console.log("\n=== SUMMARY (after common fix) ===");
  console.table(
    results.map((r) => ({
      カテゴリ: r.category + (r.baseline ? " (基準)" : ""),
      CTAクリック: r.ctaClick,
      elementFromPoint: r.elementFromPoint,
      startContact: r.startContact,
      通知生成: r.notifyCreated,
      通知表示: r.notifyDisplay,
      問題有無: r.hasIssue ? "あり" : "なし",
    }))
  );
});

await closeAllBrowsers();
