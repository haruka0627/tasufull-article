import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const THREAD_ID = "chat-demo-skill-plain-001";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

async function openChat(page, userId, reset = false) {
  const resetQs = reset ? "&liveFlowReset=1" : "";
  const url = `${BASE}/chat-detail.html?thread=${THREAD_ID}&userId=${userId}&talkDev=1&review=chat-demo&liveFlow=1${resetQs}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#chatMessages", { timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 30000,
  });
  await page.waitForTimeout(400);
}

const sellerPage = await ctx.newPage();
await openChat(sellerPage, "u_sachi", true);

const sellerUi = await sellerPage.locator("#chatMessages").innerText();
const sellerComposer = await sellerPage.locator("#chatInput").isEnabled().catch(() => false);

console.log("INITIAL seller:", sellerUi.slice(0, 220));
if (!sellerUi.includes("購入希望者がいます")) throw new Error("Seller should see contact gate card");
if (sellerComposer) throw new Error("Composer should be hidden before payment");

await sellerPage.evaluate(() => {
  document.querySelector("[data-contact-gate-proceed]")?.click();
});
await sellerPage.waitForTimeout(1500);

const afterProceedSeller = await sellerPage.locator("#chatMessages").innerText();
console.log("AFTER PROCEED seller:", afterProceedSeller.slice(0, 220));

if (!afterProceedSeller.includes("550円")) {
  throw new Error("Seller (partner) should see 550 yen fee card after proceed");
}

const buyerPage = await ctx.newPage();
await openChat(buyerPage, "u_hiro", false);

const buyerUi = await buyerPage.locator("#chatMessages").innerText();
console.log("BUYER after proceed:", buyerUi.slice(0, 220));

if (buyerUi.includes("550円を支払って")) {
  throw new Error("Buyer should NOT see fee payment card");
}
if (!buyerUi.includes("お待ちください")) {
  throw new Error("Buyer should see waiting card while partner pays");
}

await sellerPage.evaluate(() => {
  document.querySelector("[data-start-fee-pay]")?.click();
});
await sellerPage.waitForTimeout(1500);
await buyerPage.waitForTimeout(1500);

await sellerPage.waitForFunction(
  () =>
    !window.TasuPlatformChatContactGate?.shouldShowPreStartUi?.(
      window.TasuChatThreadStore?.readAll?.().find((t) => t.id === "chat-demo-skill-plain-001"),
      "u_sachi"
    )
);
await buyerPage.waitForFunction(
  () =>
    !window.TasuPlatformChatContactGate?.shouldShowPreStartUi?.(
      window.TasuChatThreadStore?.readAll?.().find((t) => t.id === "chat-demo-skill-plain-001"),
      "u_hiro"
    )
);

const afterPayComposerSeller = await sellerPage.locator("#chatInput").isEnabled().catch(() => false);
const afterPayComposerBuyer = await buyerPage.locator("#chatInput").isEnabled().catch(() => false);

if (!afterPayComposerSeller || !afterPayComposerBuyer) {
  throw new Error("Composer should be visible after payment");
}

console.log("OK skill contact gate flow — partner pays 550 yen");
await browser.close();
