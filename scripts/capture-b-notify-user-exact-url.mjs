#!/usr/bin/env node
/**
 * 指定URLのみ — #frame-b-notify スクショと DOM を同一瞬間で取得
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-b-notify-inspect");
const OUT_FRAME = path.join(OUT_DIR, "user-exact-url-1280-b-notify-frame.png");
const OUT_PAGE = path.join(OUT_DIR, "user-exact-url-1280-b-notify-page.png");
fs.mkdirSync(OUT_DIR, { recursive: true });

const contactId = "contact-demo-skill-dual-001";

async function auditAndSync(page) {
  return page.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const win = el?.contentWindow;
    if (!win) return { error: "no contentWindow" };
    const doc = win.document;
    const params = new URLSearchParams(win.location.search);
    const domTitles = [...doc.querySelectorAll(".talk-notify-card__title")].map((n) =>
      n.textContent?.trim()
    );
    const empty = doc.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null;
    const listHtml = doc.querySelector("[data-talk-notify-list]")?.innerHTML?.slice(0, 200) || "";
    win.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const pipelineStrict =
      win.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || [];
    const pipelineRelaxed =
      win.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: false, showMuted: true }) ||
      [];
    const debug = document.getElementById("benchDebugPanel")?.textContent || "";
    return {
      pageHref: location.href,
      iframeUserId: params.get("userId"),
      emptyStateText: empty,
      domTitles,
      domCardCount: doc.querySelectorAll(".talk-notify-card").length,
      pipelineStrictTitles: pipelineStrict.map((n) => n.title),
      pipelineRelaxedTitles: pipelineRelaxed.map((n) => n.title),
      mismatchPipelineVsDom:
        pipelineRelaxed.some((n) => /やりとりが開始/.test(n.title || "")) &&
        !domTitles.some((t) => /やりとりが開始/.test(t || "")),
      lastUrlBNotify: (debug.match(/last URL B-notify:\s*(.+)/) || [])[1]?.trim() || "",
      listHtmlHead: listHtml,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

try {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  await page.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    localStorage.setItem(
      C.STORAGE_KEY,
      JSON.stringify([
        {
          contact_id: cid,
          listing_id: "demo-skill-001",
          listing_type: "skill",
          requester_id: "u_hiro",
          requester_name: "ひろ",
          contact_kind: "purchase",
          status: "awaiting_fee",
          thread_id: null,
          created_at: now,
          updated_at: now,
        },
      ])
    );
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=1280`;

  await page.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await page.waitForTimeout(2500);

  const feeFrame = page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  if (!feeFrame) throw new Error("fee-pay missing");

  await feeFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(5000);

  await page.locator("#benchDebugFold").evaluate((el) => {
    el.open = true;
  });

  const audit = await auditAndSync(page);
  await page.locator("#frame-b-notify").screenshot({ path: OUT_FRAME });
  await page.screenshot({ path: OUT_PAGE, fullPage: true });

  console.log(
    JSON.stringify(
      {
        exactUrl: EXACT_URL,
        audit,
        screenshots: { frame: OUT_FRAME, page: OUT_PAGE },
      },
      null,
      2
    )
  );

  if (audit.mismatchPipelineVsDom) {
    console.error("MISMATCH: pipeline has started notify but DOM does not");
    process.exit(1);
  }
  if (!audit.domTitles?.some((t) => /やりとりが開始/.test(t || ""))) {
    console.error("DOM missing chat-started card");
    process.exit(1);
  }
} finally {
  await browser.close();
}
