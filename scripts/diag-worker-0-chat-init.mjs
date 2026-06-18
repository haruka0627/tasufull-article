#!/usr/bin/env node
/**
 * worker-0 — 「チャットを開く」後の chat-detail init 診断
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "worker-0-chat-init-diag");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BENCH_URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=worker` +
  `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=worker-0&liveFlowReset=1`;

function readFrameDiag(frameId) {
  return (win) => {
    const load = win.__tasuChatDetailLoadDiag || null;
    const resolve = win.__tasuBenchThreadResolveDiag || null;
    return {
      frameId,
      href: win.location?.href || "",
      load,
      resolve,
      bodyReady: win.document?.body?.dataset?.chatDetailReady || "",
    };
  };
}

async function clickVisibleCta(frame, selectors) {
  return frame.evaluate((sels) => {
    const isVisible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return st.visibility !== "hidden" && st.display !== "none" && rect.height > 0 && rect.width > 0;
    };
    for (const sel of sels) {
      const el = [...document.querySelectorAll(sel)].find(isVisible);
      if (el) {
        el.click();
        return { ok: true, selector: sel, text: String(el.textContent || "").trim() };
      }
    }
    return { ok: false };
  }, selectors);
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const pageErrors = [];
page.on("dialog", async (d) => d.accept());
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push(`console:${msg.text()}`);
});

try {
  await page.goto(BENCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const bFrame = page.frames().find((f) => /detail-worker/i.test(f.url()));
  if (!bFrame) throw new Error("detail-worker frame missing");

  await clickVisibleCta(bFrame, ["[data-listing-primary-cta]"]);
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    if (el?.src) el.src = el.src;
    el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(2000);

  const aNotify = page.frame({ url: /talk-home/ });
  await aNotify?.evaluate(() => {
    const btn = document.querySelector(
      "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
    );
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(4000);

  const proceedClick = await page.evaluate(() => {
    const aFrame = [...document.querySelectorAll("iframe")].find((el) =>
      /detail-worker|bench-seller-idle/.test(el.src || "")
    );
    const win = aFrame?.contentWindow;
    if (!win) return { ok: false, reason: "a_mgmt_frame_missing" };
    const proceed = win.document.querySelector("[data-listing-contact-proceed]");
    const pay = win.document.querySelector("[data-listing-contact-pay]");
    const target = proceed || pay;
    if (target) {
      target.click();
      return { ok: true, mode: target === proceed ? "proceed" : "pay" };
    }
    const listingId = "demo-worker-001";
    const store = win.TasuListingContactRequestsStore;
    const contact = store?.listByListing?.(listingId)?.[0];
    if (!contact) return { ok: false, reason: "no_contact" };
    const result = store.beginContactChat(listingId, contact.contact_id);
    if (!result?.payUrl) return { ok: false, reason: result?.reason || "begin_failed" };
    const navigated = win.TasuPlatformChatBenchEmbed?.tryPostBenchFrameNavigate?.(result.payUrl) === true;
    if (!navigated) {
      window.parent.postMessage(
        { type: "tasu-bench-frame-navigate", slot: "a-chat", href: result.payUrl },
        "*"
      );
    }
    return { ok: true, mode: "beginContactChat", payUrl: result.payUrl };
  });
  if (!proceedClick?.ok) throw new Error(`proceed failed: ${JSON.stringify(proceedClick)}`);
  await page.waitForTimeout(3500);

  const feeReached = await page
    .waitForFunction(
      () => /platform-chat-fee-pay/.test(document.getElementById("frame-a-chat")?.src || ""),
      null,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);
  if (!feeReached) {
    const aSrc = await page.evaluate(() => document.getElementById("frame-a-chat")?.src || "");
    throw new Error(`fee-pay not reached, a-chat=${aSrc}, proceed=${JSON.stringify(proceedClick)}`);
  }
  const feeFrame = page.frame({ url: /platform-chat-fee-pay/ });
  await feeFrame.evaluate(() => {
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(4000);

  const preOpen = await page.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("worker", false);
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const thread = threads.find((t) => String(t.listingId) === String(profile?.listingId));
    return {
      listingId: profile?.listingId,
      partnerAId: profile?.partnerAId,
      partnerBId: profile?.partnerBId,
      threadId: thread?.id,
      threadKind: thread?.threadKind,
      threadStatus: thread?.status || thread?.roomStatus,
      aChatSrc: document.getElementById("frame-a-chat")?.src || "",
      bChatSrc: document.getElementById("frame-b-chat")?.src || "",
    };
  });

  const chatOpenClicked = await page.evaluate(() => {
    const actions = document.querySelectorAll("[data-live-flow-action], .live-flow-action, .bench-live-flow__action");
    const btn = [...actions].find((el) => /チャットを開く/.test(el.textContent || ""));
    if (!btn) {
      const all = [...document.querySelectorAll("button, a")].filter((el) =>
        /チャットを開く/.test(el.textContent || "")
      );
      const target = all[0];
      if (!target) return { ok: false, reason: "button_not_found" };
      target.click();
      return { ok: true, mode: "fallback", text: target.textContent?.trim() };
    }
    btn.click();
    return { ok: true, mode: "live-flow-action", text: btn.textContent?.trim() };
  });
  await page.waitForTimeout(2000);
  await page
    .waitForFunction(
      () => {
        const win = document.getElementById("frame-a-chat")?.contentWindow;
        return Boolean(win?.__tasuChatDetailLoadDiag?.chatDetailInitStarted || win?.__tasuChatDetailScriptLoadError);
      },
      null,
      { timeout: 20000 }
    )
    .catch(() => null);
  await page.waitForTimeout(2000);

  const frameDiags = await page.evaluate(() => {
    const read = (id) => {
      const win = document.getElementById(id)?.contentWindow;
      if (!win) return { frameId: id, missing: true };
      const doc = win.document;
      const scriptEl = doc?.getElementById("chat-detail-main-script");
      return {
        frameId: id,
        href: win.location?.href || "",
        load: win.__tasuChatDetailLoadDiag || null,
        resolve: win.__tasuBenchThreadResolveDiag || null,
        bodyReady: doc?.body?.dataset?.chatDetailReady || "",
        htmlReached: win.__tasuChatDetailHtmlReached === true,
        scriptLoaded: win.__tasuChatDetailScriptLoaded === true,
        scriptVersion: win.__tasuChatDetailScriptVersion || "",
        scriptLoadError: win.__tasuChatDetailScriptLoadError || "",
        pipelinePhase: win.__tasuChatDetailScriptPipelinePhase || "",
        scriptTagSrc: scriptEl?.src || "",
        scriptTagError: scriptEl?.dataset?.loadError || "",
        bodyDataset: { ...(doc?.body?.dataset || {}) },
        messagesText: (doc?.getElementById("chatMessages")?.innerText || "").slice(0, 300),
        bodyTextHead: (doc?.body?.innerText || "").slice(0, 300),
      };
    };
    const snap = window.TasuPlatformChatBenchFlowDiag?.buildSnapshot?.() || null;
    return {
      aChat: read("frame-a-chat"),
      bChat: read("frame-b-chat"),
      snapChat: snap
        ? {
            chatLoadReadyA: snap.sideA?.chatLoadReady,
            chatLoadReadyB: snap.sideB?.chatLoadReady,
            chatOpenedA: snap.sideA?.chatOpened,
            chatOpenedB: snap.sideB?.chatOpened,
            composerVisibleA: snap.sideA?.composerVisible,
            composerVisibleB: snap.sideB?.composerVisible,
          }
        : null,
    };
  });

  const report = {
    ok: true,
    preOpen,
    chatOpenClicked,
    pageErrors,
    frameDiags,
  };
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(OUT_DIR, "after-chat-open.png"), fullPage: true });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
