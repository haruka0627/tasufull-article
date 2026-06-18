#!/usr/bin/env node
/**
 * worker-0 — 通常 Playwright .click() で startContact → 通知まで検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const BENCH_URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=worker` +
  `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=390&benchPattern=worker-0&liveFlowReset=1`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

try {
  await page.goto(BENCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const before = await page.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const profile = Demo?.getProfile?.("worker", false);
    return {
      partnerAId: profile?.partnerAId || "",
      workerReqBefore: JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]").length,
      notifyBefore: JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length,
    };
  });

  const bFrame = page.frames().find((f) => /detail-worker/i.test(f.url()));
  if (!bFrame) throw new Error("B detail-worker frame missing");

  const preClick = await bFrame.evaluate(() => {
    const btn = document.querySelector("[data-listing-primary-cta]");
    const r = btn?.getBoundingClientRect();
    const cx = (r?.left || 0) + (r?.width || 0) / 2;
    const cy = (r?.top || 0) + (r?.height || 0) / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      btnText: btn?.textContent?.trim(),
      navDisplay: getComputedStyle(document.querySelector(".section-nav") || document.body).display,
      topSame: top === btn,
      topCls: top?.className || "",
      bound: btn?.dataset?.tasuContactBound,
      hasContactCta: btn?.hasAttribute("data-tasu-contact-cta"),
    };
  });

  if (!preClick.topSame) {
    errors.push(`CTA intercepted by: ${preClick.topCls}`);
  }

  await bFrame.evaluate(() => {
    window.__workerContactClickFired = false;
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target?.closest?.("[data-listing-primary-cta]");
        if (btn && window.TasuContactActions?.isWorkerRequestButton?.(btn)) {
          window.__workerContactClickFired = true;
        }
      },
      true
    );
  });

  await bFrame.locator("[data-listing-primary-cta]").click({ timeout: 10000 });

  await page.waitForTimeout(2500);

  const contactClickFired = await bFrame.evaluate(() => Boolean(window.__workerContactClickFired));
  if (!contactClickFired) errors.push("contact-actions capture click did not reach CTA");

  const after = await page.evaluate((expectedSellerId) => {
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const platformRows = notifs.filter(
      (n) =>
        String(n.title || "").includes("依頼が届きました") &&
        (String(n.source) === "platform" || String(n.source) === "worker")
    );
    const forSeller = platformRows.filter(
      (n) => String(n.recipientUserId) === expectedSellerId
    );
    const reqs = JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]");

    const aNotifyWin = document.getElementById("frame-a-notify")?.contentWindow;
    let aDomHas = false;
    if (aNotifyWin) {
      const titles = Array.from(
        aNotifyWin.document.querySelectorAll(
          ".talk-notify-card__title, [data-notify-title], .notify-card__title"
        )
      ).map((el) => el.textContent?.trim());
      aDomHas = titles.some((t) => t && t.includes("依頼が届きました"));
    }

    return {
      workerReqCount: reqs.length,
      notifyRow: forSeller[0] || platformRows[0] || null,
      aDomHas,
    };
  }, before.partnerAId);

  if (after.workerReqCount <= before.workerReqBefore) {
    errors.push("worker request not created");
  }
  if (!after.notifyRow) {
    errors.push("notify record not created");
  } else {
    if (String(after.notifyRow.recipientUserId) !== String(before.partnerAId)) {
      errors.push(`recipientUserId mismatch: ${after.notifyRow.recipientUserId}`);
    }
    if (!String(after.notifyRow.title || "").includes("依頼が届きました")) {
      errors.push(`title mismatch: ${after.notifyRow.title}`);
    }
    if (after.notifyRow.actionLabel !== "依頼者を確認する") {
      errors.push(`CTA mismatch: ${after.notifyRow.actionLabel}`);
    }
  }

  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    if (el?.src) el.src = el.src;
    el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(3500);

  const aDom = await page.frameLocator("#frame-a-notify").locator("text=依頼が届きました").first().isVisible().catch(() => false);
  if (!aDom) errors.push("A notify DOM card not visible");

  const report = {
    ok: errors.length === 0,
    errors,
    preClick,
    contactClickFired,
    after,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} finally {
  await browser.close();
}
