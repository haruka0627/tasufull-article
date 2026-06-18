#!/usr/bin/env node
/**
 * worker-0 / product-0 / job-0 — ベンチ iframe chat-detail 読込ガード検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();

const PATTERNS = [
  {
    id: "worker-0",
    profile: "worker",
    frameRe: /detail-worker/i,
    ctaSelectors: ["[data-listing-primary-cta]"],
    notifyTitle: "依頼が届きました",
  },
  {
    id: "product-0",
    profile: "product",
    frameRe: /detail-product/i,
    ctaSelectors: [
      "[data-tasu-mdetail-cta-dock] .tasu-mdetail-cta-dock__btn--primary",
      "[data-listing-primary-cta]",
    ],
    notifyTitle: "購入されました",
  },
  {
    id: "job-0",
    profile: "job",
    frameRe: /detail-job/i,
    ctaSelectors: ["[data-job-dock-apply]", "[data-listing-primary-cta]"],
    notifyTitle: "応募がありました",
    jobFlow: true,
  },
];

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
        return { ok: true, selector: sel };
      }
    }
    return { ok: false };
  }, selectors);
}

async function readChatFrameState(page) {
  return page.evaluate(() => {
    const read = (id) => {
      const win = document.getElementById(id)?.contentWindow;
      if (!win) return { frameId: id, missing: true };
      return {
        frameId: id,
        href: win.location?.href || "",
        ready: win.__tasuChatDetailReady === true,
        loadReady: win.__tasuChatDetailLoadDiag?.chatLoadReady === true,
        loadOk: win.__tasuChatDetailLoadDiag?.chatDetailLoadOk === true,
        composerRendered: win.__tasuChatDetailLoadDiag?.composerRendered === true,
        bodyReady: win.document?.body?.dataset?.chatDetailReady === "true",
        scriptLoaded: win.__tasuChatDetailScriptLoaded === true,
        initStarted: win.__tasuChatDetailLoadDiag?.chatDetailInitStarted === true,
      };
    };
    return { a: read("frame-a-chat"), b: read("frame-b-chat") };
  });
}

async function waitForChatReady(page, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readChatFrameState(page);
    const aOk =
      /chat-detail\.html/i.test(state.a.href || "") &&
      (state.a.ready || state.a.loadReady || state.a.bodyReady) &&
      (state.a.composerRendered || state.a.scriptLoaded);
    const bOk =
      /chat-detail\.html/i.test(state.b.href || "") &&
      (state.b.ready || state.b.loadReady || state.b.bodyReady) &&
      (state.b.composerRendered || state.b.scriptLoaded);
    if (aOk && bOk) return { ok: true, state };
    await page.waitForTimeout(500);
  }
  return { ok: false, state: await readChatFrameState(page) };
}

async function runContactPattern(page, pat) {
  const url =
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=${pat.profile}` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=${pat.id}&liveFlowReset=1`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  await page.waitForFunction(
    (frameReSource) => new RegExp(frameReSource, "i").test(document.getElementById("frame-b-chat")?.src || ""),
    pat.frameRe.source,
    { timeout: 20000 }
  );
  const bFrame = page.frames().find((f) => pat.frameRe.test(f.url()));
  if (!bFrame) throw new Error(`${pat.id}: B detail frame missing`);
  await bFrame.waitForFunction(
    () => document.body?.dataset?.listingLoaded === "true",
    null,
    { timeout: 15000 }
  ).catch(() => null);
  await page.waitForTimeout(800);

  const cta = await clickVisibleCta(bFrame, pat.ctaSelectors);
  if (!cta.ok) throw new Error(`${pat.id}: CTA not found`);
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(1500);

  const aNotify = page.frame({ url: /talk-home/ });
  await aNotify?.evaluate(() => {
    const btn = document.querySelector(
      "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
    );
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(4000);

  const proceed = await page.evaluate((profileId) => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.(profileId, false);
    const listingId = profile?.listingId;
    const aFrame = [...document.querySelectorAll("iframe")].find((el) =>
      /detail-(worker|product|skill|shop|business|general)|bench-seller-idle/.test(el.src || "")
    );
    const win = aFrame?.contentWindow;
    if (!win) return { ok: false, reason: "no_a_frame" };
    const proceedBtn = win.document.querySelector("[data-listing-contact-proceed]");
    const payBtn = win.document.querySelector("[data-listing-contact-pay]");
    const target = proceedBtn || payBtn;
    if (target) {
      target.click();
      return { ok: true, mode: "click" };
    }
    const lid =
      listingId ||
      win.document.body?.dataset?.listingId ||
      new URLSearchParams(win.location.search).get("id");
    const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
    const contact = contacts.find((r) => String(r.listing_id) === String(lid));
    if (!contact) return { ok: false, reason: `no_contact:${lid}` };
    const result = win.TasuListingContactRequestsStore?.beginContactChat?.(lid, contact.contact_id);
    if (!result?.payUrl) return { ok: false, reason: result?.reason || "begin_failed" };
    win.parent.postMessage({ type: "tasu-bench-frame-navigate", slot: "a-chat", href: result.payUrl }, "*");
    return { ok: true, mode: "beginContactChat" };
  }, pat.profile);
  if (!proceed.ok) throw new Error(`${pat.id}: proceed failed ${proceed.reason}`);

  await page.waitForFunction(
    () => /platform-chat-fee-pay/.test(document.getElementById("frame-a-chat")?.src || ""),
    null,
    { timeout: 20000 }
  );
  const feeFrame = page.frame({ url: /platform-chat-fee-pay/ });
  page.on("dialog", async (d) => d.accept());
  await feeFrame.evaluate(() => document.querySelector("[data-platform-fee-pay]")?.click());
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button, a")].find((el) =>
      /チャットを開く/.test(el.textContent || "")
    );
    btn?.click();
  });
  await page.waitForTimeout(2000);

  const result = await waitForChatReady(page);
  if (!result.ok) {
    throw new Error(`${pat.id}: chat not ready ${JSON.stringify(result.state)}`);
  }
  return result.state;
}

async function runJobPattern(page) {
  const pat = PATTERNS.find((p) => p.id === "job-0");
  const url =
    `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=job` +
    `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=job-0&liveFlowReset=1`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  await page.waitForFunction(
    () => /detail-job/i.test(document.getElementById("frame-b-chat")?.src || ""),
    null,
    { timeout: 20000 }
  );
  const bFrame = page.frames().find((f) => /detail-job/i.test(f.url()));
  if (!bFrame) throw new Error("job-0: B detail frame missing");
  const cta = await clickVisibleCta(bFrame, pat.ctaSelectors);
  if (!cta.ok) throw new Error("job-0: apply CTA missing");
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    document.getElementById("frame-a-notify")?.contentWindow?.postMessage?.(
      { type: "tasu-bench-notify-refresh" },
      "*"
    );
  });
  await page.waitForTimeout(2000);

  const aMgmt = page.frames().find((f) => /detail-job|bench-seller-idle/.test(f.url()));
  const hired = await aMgmt?.evaluate(() => {
    const hire = document.querySelector("[data-job-hire], [data-listing-contact-proceed]");
    if (hire) {
      hire.click();
      return { ok: true, mode: "hire_click" };
    }
    const cards = [...document.querySelectorAll("[data-listing-contact-card], [data-job-application-card]")];
    const card = cards[0];
    const btn = card?.querySelector("[data-job-hire], [data-listing-contact-proceed], button");
    if (btn) {
      btn.click();
      return { ok: true, mode: "card_hire" };
    }
    return { ok: false };
  });
  if (!hired?.ok) throw new Error("job-0: hire action failed");

  await page.waitForTimeout(3000);

  const feeReached = await page
    .waitForFunction(
      () => /platform-chat-fee-pay/.test(document.getElementById("frame-a-chat")?.src || ""),
      null,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);

  if (feeReached) {
    const feeFrame = page.frame({ url: /platform-chat-fee-pay/ });
    await feeFrame?.evaluate(() => document.querySelector("[data-platform-fee-pay]")?.click());
    await page.waitForTimeout(4000);
  }

  const result = await waitForChatReady(page, 60000);
  if (!result.ok) throw new Error(`job-0: chat not ready ${JSON.stringify(result.state)}`);
  return result.state;
}

const browser = await chromium.launch({ headless: true });
const results = {};
const errors = [];

try {
  for (const pat of PATTERNS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      results[pat.id] =
        pat.jobFlow === true ? await runJobPattern(page) : await runContactPattern(page, pat);
      console.log(`OK: ${pat.id}`);
    } catch (err) {
      errors.push(String(err.message || err));
      console.error(`NG: ${pat.id}`, err.message);
    } finally {
      await context.close();
    }
  }
  if (errors.length) {
    console.log(JSON.stringify({ ok: false, errors, results }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
