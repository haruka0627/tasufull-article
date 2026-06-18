#!/usr/bin/env node
/** 指定URL + 管理画面導線（A通知CTA→管理→支払い）で B上 dom vs pipeline */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const EXACT_PATH =
  "/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=skill&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=skill-0";
const EXACT_URL = `${BASE}${EXACT_PATH}`;
const OUT_DIR = path.join("screenshots", "bench-b-notify-inspect");
fs.mkdirSync(OUT_DIR, { recursive: true });

function audit(page) {
  return page.evaluate(() => {
    const el = document.getElementById("frame-b-notify");
    const w = el?.contentWindow;
    if (!w) return { error: "no b-notify window" };
    const doc = w.document;
    const titles = [...doc.querySelectorAll(".talk-notify-card__title")].map((n) => n.textContent?.trim());
    const empty = doc.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || null;
    w.TasuTalkData?.invalidateNotificationsBootstrap?.();
    const pipeline = w.TasuTalkData?.getNotifications?.({ filter: "all", applySettings: true }) || [];
    const parentStarted = (window.TasuTalkNotifications?.getAll?.() || []).filter(
      (n) => n.recipientUserId === "u_hiro" && /やりとりが開始/.test(n.title || "")
    );
    const debug = document.getElementById("benchDebugPanel")?.textContent || "";
    return {
      empty,
      domTitles: titles,
      pipelineTitles: pipeline.map((n) => n.title),
      parentStarted: parentStarted.length,
      flowPhase: (debug.match(/flowPhase:\s*(\S+)/) || [])[1] || "",
      lastBNotify: (debug.match(/last URL B-notify:\s*(.+)/) || [])[1]?.trim() || "",
      mismatch: pipeline.some((n) => /やりとりが開始/.test(n.title || "")) && !titles.some((t) => /やりとりが開始/.test(t || "")),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

try {
  await page.goto(EXACT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo.getProfile("skill", false);
    const Flow = window.TasuPlatformChatDualWindowFlow;
    const row = Flow.buildInitialNotifyRowForProfile?.(profile);
    if (row && window.TasuTalkNotifications?.saveAll) {
      const all = window.TasuTalkNotifications.getAll() || [];
      const byId = new Map(all.map((n) => [n.id, n]));
      byId.set(row.id, row);
      window.TasuTalkNotifications.saveAll([...byId.values()], { localOnly: true, silent: true });
    }
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    const cid = "contact-demo-skill-dual-001";
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
          status: "applied",
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
  });
  await page.waitForTimeout(1500);

  const aNotify = page.frame({ url: /talk-home.*userId=u_sachi|userId=u_sachi.*talk-home/ });
  if (!aNotify) throw new Error("A-notify frame missing");

  await aNotify.locator("[data-talk-notify-action='navigate'], .talk-notify-card__minimal-action").first().click();
  await page.waitForTimeout(2500);

  const mgmt = page.frames().find((f) => /detail-skill/.test(f.url()) && /view=contacts|benchManagement/.test(f.url()));
  if (!mgmt) {
    const aChatSrc = await page.locator("#frame-a-chat").getAttribute("src");
    throw new Error(`management frame missing; a-chat=${aChatSrc}`);
  }

  const feeNav = await mgmt.evaluate(() => {
    const link = [...document.querySelectorAll("a, button")].find((el) =>
      /手数料|支払|550|fee/i.test(el.textContent || "")
    );
    if (link) {
      link.click();
      return { clicked: link.textContent?.trim() };
    }
    const row = document.querySelector("[data-contact-id], [data-contact-row], tr[data-contact-id]");
    row?.querySelector("a, button")?.click();
    return { clicked: row ? "row" : null };
  });
  console.log("mgmt feeNav:", feeNav);
  await page.waitForTimeout(2500);

  let feeFrame = page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  if (!feeFrame) {
    const contactId = "contact-demo-skill-dual-001";
    const feeUrl =
      `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
      `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=1280`;
    await page.locator("#frame-a-chat").evaluate((el, url) => {
      el.src = url;
    }, feeUrl);
    await page.waitForTimeout(2000);
    feeFrame = page.frames().find((f) => /platform-chat-fee-pay/.test(f.url()));
  }
  if (!feeFrame) throw new Error("fee-pay not reached");

  await feeFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });

  for (const ms of [500, 1500, 3000, 5000]) {
    await page.waitForTimeout(ms === 500 ? 500 : ms - (ms === 1500 ? 500 : ms === 3000 ? 1500 : 3000));
    const a = await audit(page);
    const shot = path.join(OUT_DIR, `mgmt-flow-t${ms}ms-b-notify.png`);
    await page.locator("#frame-b-notify").screenshot({ path: shot });
    console.log(`\n=== mgmt flow t+${ms}ms ===`, JSON.stringify(a, null, 2), "\nshot:", shot);
  }
} finally {
  await browser.close();
}
