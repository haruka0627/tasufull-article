#!/usr/bin/env node
/**
 * Connectなし — 全カテゴリの通知文言・フロー段階をベンチで検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "bench-all-categories-flow");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CATEGORIES = [
  {
    id: "job",
    pattern: "job-0",
    title: "応募が届きました",
    cta: "応募者を確認する",
    skipsCompletion: true,
  },
  {
    id: "skill",
    pattern: "skill-0",
    title: "購入されました",
    cta: "購入者を確認する",
    payerPaidTitle: "購入者が支払いました",
  },
  {
    id: "worker",
    pattern: "worker-0",
    title: "依頼が届きました",
    cta: "依頼者を確認する",
    payerPaidTitle: "依頼者が支払いました",
  },
  {
    id: "general",
    pattern: "general-0",
    title: "応募/依頼が届きました",
    cta: "応募者/依頼者を確認する",
    payerPaidTitle: "依頼者が支払いました",
  },
  {
    id: "product",
    pattern: "product-0",
    title: "商品が購入されました",
    cta: "購入者を確認する",
    payerPaidTitle: "購入者が支払いました",
  },
  {
    id: "shop",
    pattern: "shop-0",
    title: "商品が購入されました",
    cta: "購入者を確認する",
    payerPaidTitle: "購入者が支払いました",
  },
  {
    id: "business",
    pattern: "business-0",
    title: "依頼が届きました",
    cta: "依頼者を確認する",
    payerPaidTitle: "依頼者が支払いました",
  },
  {
    id: "builder",
    pattern: "builder-0",
    title: "案件応募/依頼が届きました",
    cta: "応募者/依頼者を確認する",
    payerPaidTitle: "依頼者が支払いました",
  },
];

const errors = [];
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const results = [];


  for (const cat of CATEGORIES) {
    const url =
      `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${cat.id}` +
      `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=${cat.pattern}&liveFlowReset=1`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);

    const copyCheck = await page.evaluate((categoryId) => {
      const Cat = window.TasuPlatformChatCategoryFlow;
      const contact = Cat?.getContactNotifyCopy?.(categoryId) || {};
      const paid = Cat?.getPayerPaidNotifyCopy?.(categoryId) || {};
      const steps = window.TasuPlatformChatLiveFlow?.buildLiveFlowSteps?.(
        window.TasuPlatformChatDualWindowDemo?.getProfile?.(categoryId, false)
      );
      return {
        contact,
        paid,
        skips: Cat?.skipsPostChatCompletionFlow?.(categoryId) === true,
        stepIds: (steps || []).map((s) => s.id),
      };
    }, cat.id);

    if (copyCheck.contact.title !== cat.title) {
      pushErr(`${cat.id} copy title=${copyCheck.contact.title} expected=${cat.title}`);
    }
    if (copyCheck.contact.cta !== cat.cta) {
      pushErr(`${cat.id} copy cta=${copyCheck.contact.cta} expected=${cat.cta}`);
    }
    if (!cat.skipsCompletion && cat.payerPaidTitle && copyCheck.paid.title !== cat.payerPaidTitle) {
      pushErr(`${cat.id} paid title=${copyCheck.paid.title} expected=${cat.payerPaidTitle}`);
    }
    if (cat.skipsCompletion) {
      if (!copyCheck.skips) pushErr(`${cat.id} should skip post-chat completion`);
      const bad = ["complete-request", "manual-pay", "manual-confirm", "review"].filter((id) =>
        copyCheck.stepIds.includes(id)
      );
      if (bad.length) pushErr(`${cat.id} live steps include ${bad.join(",")}`);
    } else {
      if (copyCheck.skips) pushErr(`${cat.id} should not skip post-chat completion`);
      for (const need of ["complete-request", "manual-pay", "manual-confirm", "review"]) {
        if (!copyCheck.stepIds.includes(need)) {
          pushErr(`${cat.id} missing live step ${need}`);
        }
      }
    }

    const notifyRow = await page.evaluate((categoryId) => {
      const Demo = window.TasuPlatformChatDualWindowDemo;
      const Flow = window.TasuPlatformChatDualWindowFlow;
      const profile = Demo?.getProfile?.(categoryId, false);
      const row = Flow?.buildInitialNotifyRowForProfile?.(profile);
      return row
        ? { title: row.title, cta: row.actionLabel, href: row.href || row.targetUrl }
        : { title: "", cta: "", href: "" };
    }, cat.id);

    if (notifyRow.title !== cat.title) {
      pushErr(`${cat.id} initial-notify title=${notifyRow.title} expected=${cat.title}`);
    }
    if (notifyRow.cta !== cat.cta) {
      pushErr(`${cat.id} initial-notify cta=${notifyRow.cta} expected=${cat.cta}`);
    }

    await page.screenshot({
      path: path.join(OUT_DIR, `${cat.id}-notify.png`),
      fullPage: false,
    });

    const catErrors = errors.filter((e) => e.startsWith(`${cat.id} `));
    results.push({ category: cat.id, copyCheck, notifyRow, errors: catErrors, ok: !catErrors.length });
  }

  const report = { results, errors, ok: !errors.length };
  fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
});

