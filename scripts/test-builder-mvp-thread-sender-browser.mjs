/**
 * Builder MVP thread sender / LINE layout test (URL role per tab)
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const THREAD_ID = "thread-demo-003";

function threadUrl(role) {
  return `file://${path.join(builder, "mvp-thread.html")}?thread_id=${THREAD_ID}&role=${role}`;
}

async function sendAndInspect(page, role, text) {
  await page.goto(threadUrl(role));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");

  const logs = [];
  page.on("console", (msg) => {
    if (msg.text().includes("[MVP thread sendMvpThreadMessage]")) logs.push(msg.text());
  });

  await page.locator("[data-builder-mvp-thread-input]").fill(text);
  await page.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction((t) => document.body.textContent?.includes(t), text);

  const result = await page.evaluate(
    ({ mvpKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const msgs = state.threads?.[threadId]?.messages || [];
      const last = msgs[msgs.length - 1];
      const domLast = document.querySelector(".mvp-slack-msg:last-child");
      const side = domLast?.classList.contains("mvp-slack-msg--right")
        ? "right"
        : domLast?.classList.contains("mvp-slack-msg--left")
          ? "left"
          : "system";
      const name = domLast?.querySelector(".mvp-slack-msg__name")?.textContent || "";
      return { from: last?.from || null, side, name };
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID }
  );

  return { ...result, logs };
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(threadUrl("owner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  await page.evaluate(
    ({ partnerKey }) => {
      localStorage.setItem(partnerKey, "demo-partner-001");
    },
    { partnerKey: PARTNER_KEY }
  );

  const ownerSend = await sendAndInspect(page, "owner", "運営送信テスト");
  if (ownerSend.from?.type !== "owner") throw new Error(`Owner send expected type owner, got ${ownerSend.from?.type}`);
  if (ownerSend.from?.name !== "TASFUL運営") throw new Error(`Owner send name wrong: ${ownerSend.from?.name}`);
  if (ownerSend.side !== "right") throw new Error(`Owner tab should show own message right, got ${ownerSend.side}`);

  const partnerSend = await sendAndInspect(page, "partner", "協力会社送信テスト");
  if (partnerSend.from?.type !== "partner") throw new Error(`Partner send expected type partner, got ${partnerSend.from?.type}`);
  if (!partnerSend.from?.name?.includes("オレンジ") && !partnerSend.from?.name?.includes("建装")) {
    throw new Error(`Partner send name wrong: ${partnerSend.from?.name}`);
  }
  if (partnerSend.side !== "right") throw new Error(`Partner tab should show own message right, got ${partnerSend.side}`);

  await page.goto(threadUrl("owner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  await page.waitForFunction(() => document.body.textContent?.includes("協力会社送信テスト"));

  const ownerView = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".mvp-slack-msg"));
    const partnerMsg = items.find((el) => el.textContent?.includes("協力会社送信テスト"));
    return {
      partnerSide: partnerMsg?.classList.contains("mvp-slack-msg--left")
        ? "left"
        : partnerMsg?.classList.contains("mvp-slack-msg--right")
          ? "right"
          : "other",
      ownerSide: items.find((el) => el.textContent?.includes("運営送信テスト"))?.classList.contains("mvp-slack-msg--right")
        ? "right"
        : "other",
    };
  });

  if (ownerView.partnerSide !== "left") {
    throw new Error(`Owner tab should show partner message left, got ${ownerView.partnerSide}`);
  }
  if (ownerView.ownerSide !== "right") {
    throw new Error(`Owner tab should show owner message right, got ${ownerView.ownerSide}`);
  }

  await page.goto(threadUrl("partner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  const partnerView = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".mvp-slack-msg"));
    const ownerMsg = items.find((el) => el.textContent?.includes("運営送信テスト"));
    return ownerMsg?.classList.contains("mvp-slack-msg--left") ? "left" : "other";
  });
  if (partnerView !== "left") throw new Error(`Partner tab should show owner message left, got ${partnerView}`);

  await page.goto(threadUrl("owner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  await page.locator(".mvp-demoMenu__summary").click();
  await page.locator("[data-builder-mvp-role-partner]").click();
  await page.waitForFunction(() => document.body.textContent?.includes("表示:"));

  await page.locator("[data-builder-mvp-thread-input]").fill("UI切替協力会社送信");
  await page.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(() => document.body.textContent?.includes("UI切替協力会社送信"));

  const uiSwitch = await page.evaluate(
    ({ mvpKey, threadId }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const last = (state.threads?.[threadId]?.messages || []).slice(-1)[0];
      return last?.from || null;
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID }
  );
  if (uiSwitch?.type !== "partner") throw new Error(`UI role switch send should be partner, got ${uiSwitch?.type}`);

  console.log("OK: thread sender / URL role / LINE layout test passed");
  console.log(
    JSON.stringify(
      {
        ownerSend: { from: ownerSend.from, side: ownerSend.side },
        partnerSend: { from: partnerSend.from, side: partnerSend.side },
        ownerView,
        uiSwitch,
      },
      null,
      2
    )
  );
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
