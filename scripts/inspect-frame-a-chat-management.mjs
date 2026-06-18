#!/usr/bin/env node
/** sellerManagementOpened 後の #frame-a-chat 実測（通知CTAクリック経由） */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "bench-a-chat-inspect");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const consoleLogs = [];
const pageErrors = [];
const failedReqs = [];

async function inspectAChatFrame(bench, label) {
  const frameEl = bench.locator("#frame-a-chat");
  const src = await frameEl.getAttribute("src");
  const display = await frameEl.evaluate((el) => getComputedStyle(el).display);
  const iframeBox = await frameEl.boundingBox();

  const aChat = bench.frame({ url: /detail-skill|bench-seller-idle|platform-chat|chat-detail/ });
  let inner = { frameFound: false };
  if (aChat) {
    inner = await aChat.evaluate(() => ({
      frameFound: true,
      locationHref: location.href,
      documentTitle: document.title,
      bodyTextHead: (document.body?.innerText || "").slice(0, 500),
      listingLoaded: document.body?.dataset?.listingLoaded,
      benchManagement: document.body?.dataset?.benchManagement,
      hasSellerMgmtClass: document.body.classList.contains("listing-bench-seller-management"),
      contactsSectionHidden: document.querySelector("[data-listing-contacts-section]")?.hidden,
      contactsTitle: document.querySelector("[data-listing-contacts-title]")?.textContent?.trim() || "",
      cardCount: document.querySelectorAll("[data-listing-contact-card]").length,
      hiroVisible: (document.body?.innerText || "").includes("ひろ"),
      proceedBtn: Boolean(document.querySelector("[data-listing-contact-proceed]")),
    }));
  }

  const benchMeta = await bench.evaluate(() => {
    const text = document.getElementById("benchDebugPanel")?.textContent || "";
    const flowPhase = (text.match(/flowPhase:\s*(\S+)/) || [])[1] || "";
    const currentStep = (text.match(/currentStep:\s*(\S+)/) || [])[1] || "";
    return { flowPhase, currentStep, debugText: text.slice(0, 400) };
  });

  await frameEl.screenshot({ path: path.join(OUT, `${label}.png`) });

  return { label, src, display, iframeBox, benchMeta, inner };
}


  const bench = await (await browser.newContext()).newPage({ viewport: { width: 1280, height: 900 } });
  bench.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  bench.on("pageerror", (err) => pageErrors.push(String(err)));

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await bench.waitForTimeout(2500);

  // contact-state: 購入通知 + 購入者 contact レコード
  await bench.evaluate(() => {
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
    const list = C.readAll().filter((r) => String(r.contact_id) !== cid);
    list.unshift({
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
    });
    localStorage.setItem(C.STORAGE_KEY, JSON.stringify(list));
  });

  await bench.waitForTimeout(1500);

  // A上 通知 iframe で「購入者を確認する」を実クリック
  const aNotify = bench.frame({ url: /talk-home/ });
  if (!aNotify) throw new Error("frame-a-notify not found");
  aNotify.on("console", (msg) => {
    if (msg.type() === "error") consoleLogs.push(`[notify-iframe-error] ${msg.text()}`);
  });
  aNotify.on("requestfailed", (req) => failedReqs.push(`${req.url()} ${req.failure()?.errorText}`));

  await aNotify.waitForFunction(
    () =>
      Boolean(
        document.querySelector(
          "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
        )
      ),
    null,
    { timeout: 15000 }
  );
  const clicked = await aNotify.evaluate(() => {
    const btn = document.querySelector(
      "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
    );
    if (!btn) return { ok: false, reason: "no-button" };
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return {
      ok: true,
      label: btn.textContent?.trim() || "",
      href: btn.getAttribute("data-talk-notify-href") || btn.getAttribute("href") || "",
    };
  });
  if (!clicked.ok) throw new Error(`CTA click failed: ${clicked.reason}`);
  console.log("CTA clicked:", clicked);

  await bench.waitForTimeout(4000);

  const afterClick = await inspectAChatFrame(bench, "01-after-cta-click");

  // storage sync 相当（open thread あり）で A下が chat-detail に上書きされないか
  await bench.evaluate(() => {
    const store = window.TasuChatThreadStore;
    const threads = store.readAll();
    threads.unshift({
      id: "chat-demo-skill-open-001",
      listingId: "demo-skill-001",
      sellerId: "u_sachi",
      buyerId: "u_hiro",
      status: "open",
      roomStatus: "open",
    });
    store.writeAll?.(threads) ||
      localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));
    const Fee = window.TasuPlatformChatFee;
    Fee.markFeePaid("chat-demo-skill-open-001", {});
    window.dispatchEvent(new Event("storage"));
  });
  await bench.waitForTimeout(2500);

  const afterSync = await inspectAChatFrame(bench, "02-after-storage-sync");

  console.log("\n=== 1. after CTA click ===");
  console.log(JSON.stringify(afterClick, null, 2));
  console.log("\n=== 2. after storage sync (open thread) ===");
  console.log(JSON.stringify(afterSync, null, 2));
  console.log("\n=== console errors ===");
  console.log(consoleLogs.slice(0, 25).join("\n") || "(none)");
  console.log("\n=== page errors ===");
  console.log(pageErrors.join("\n") || "(none)");
  console.log("\n=== network failures ===");
  console.log(failedReqs.slice(0, 15).join("\n") || "(none)");

  const ok =
    afterClick.inner.hiroVisible &&
    afterClick.inner.proceedBtn &&
    afterSync.inner.hiroVisible &&
    afterSync.inner.proceedBtn &&
    !/chat-detail\.html/i.test(afterSync.src || "");

  if (!ok) {
    console.error("\nVERIFY FAILED");
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("\nVERIFY OK");
});

