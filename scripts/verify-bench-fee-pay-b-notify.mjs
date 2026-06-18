#!/usr/bin/env node
/** Payment inside a-chat fee-pay iframe → B上 notify */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
await withPlaywrightBrowser(async (browser) => {const issues = [];


  const bench = await (await browser.newContext()).newPage({ viewport: { width: 1280, height: 900 } });
  const contactId = "contact-demo-skill-dual-001";

  await bench.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1`,
    { waitUntil: "domcontentloaded" }
  );
  await bench.waitForTimeout(2500);

  const feeUrl =
    `${BASE}/platform-chat-fee-pay.html?contactId=${contactId}&listingId=demo-skill-001&category=skill` +
    `&talkDev=1&review=chat-demo&liveFlow=1&demoProfile=skill&demoConnect=0&userId=u_sachi&from=notify&benchEmbed=1&benchViewport=1280`;

  await bench.locator("#frame-a-chat").evaluate((el, url) => {
    el.src = url;
  }, feeUrl);
  await bench.waitForTimeout(2500);

  const aFrame = bench.frame({ url: /platform-chat-fee-pay/ });
  if (!aFrame) throw new Error("fee-pay frame missing");

  await aFrame.evaluate((cid) => {
    const C = window.TasuListingContactRequestsStore;
    const now = new Date().toISOString();
    const list = C.readAll().filter((r) => String(r.contact_id) !== cid);
    list.unshift({
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
    });
    localStorage.setItem(C.STORAGE_KEY, JSON.stringify(list));
    window.TasuPlatformChatFee.ensurePendingFeeDeferred({
      listing: C.resolveListing("demo-skill-001"),
      contactId: cid,
      feeAmount: 550,
    });
  }, contactId);

  await aFrame.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });

  await bench.waitForTimeout(5000);

  const store = await bench.evaluate(() => {
    const buyer = (window.TasuTalkNotifications?.getAll?.() || []).find(
      (n) => n.recipientUserId === "u_hiro" && /やりとりが開始/.test(n.title || "")
    );
    return { ok: Boolean(buyer), title: buyer?.title || "" };
  });

  const bNotify = bench.frame({ url: /userId=u_hiro.*tab=notify|tab=notify.*userId=u_hiro/ });
  const ui = bNotify
    ? await bNotify.evaluate(() => ({
        cards: document.querySelectorAll(".talk-notify-card").length,
        title:
          [...document.querySelectorAll(".talk-notify-card")]
            .map((c) => c.querySelector(".talk-notify-card__title")?.textContent?.trim())
            .filter(Boolean)
            .join("|") || "",
        empty: document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "",
      }))
    : { cards: 0, title: "", empty: "no frame" };

  const posted = await aFrame.evaluate(() => {
    const Demo = window.TasuPlatformChatDualWindowDemo;
    const Embed = window.TasuPlatformChatBenchEmbed;
    return {
      hasEmbed: Boolean(Embed),
      benchCtx: Embed?.isBenchParentContext?.(),
      profile: Boolean(Demo?.getProfile?.("skill", false)),
    };
  });

  console.log("[fee-pay ctx]", posted);
  console.log("[store]", store);
  console.log("[b-notify]", ui);

  if (!store.ok) issues.push("store missing buyer chat-started");
  if (!/やりとりが開始されました/.test(ui.title)) issues.push(`B notify UI: ${ui.title || ui.empty}`);
  if (issues.length) {
    console.error("FAILED:", issues.join("; "));
    process.exit(1);
  }
  console.log("OK");
});

await closeAllBrowsers();
