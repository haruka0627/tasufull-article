/**
 * Builder MVP Slack-style thread smoke test (Playwright)
 * Includes LINE-style layout: logged-in user = right, others = left, system = center
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const builder = path.join(root, "builder");
const MVP_KEY = "tasful:builder:mvp:v1";
const NOTIF_KEY = "tasful:builder:mvp:notifications:v1";
const ROLE_KEY = "tasful:builder:mvp:role";
const PARTNER_KEY = "tasful:builder:mvp:partner_id";
const THREAD_ID = "thread-demo-001";
const THREAD_URL = `file://${path.join(builder, "mvp-thread.html")}?thread_id=${THREAD_ID}`;

function threadUrl(role) {
  return `${THREAD_URL}&role=${encodeURIComponent(role)}`;
}

async function countSides(page) {
  return page.evaluate(() => ({
    left: document.querySelectorAll(".mvp-slack-msg--left").length,
    right: document.querySelectorAll(".mvp-slack-msg--right").length,
    system: document.querySelectorAll(".mvp-slack-msg--system").length,
  }));
}

async function assertLineLayout(page, role, partnerId) {
  await page.goto(threadUrl(role));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  if (partnerId) {
    await page.evaluate(
      ({ partnerKey, partnerId }) => localStorage.setItem(partnerKey, partnerId),
      { partnerKey: PARTNER_KEY, partnerId }
    );
    await page.reload();
    await page.waitForSelector("[data-builder-mvp-thread-msgs]");
  }

  const layout = await page.evaluate(
    ({ mvpKey, threadId, roleKey, partnerKey }) => {
      const state = JSON.parse(localStorage.getItem(mvpKey) || "{}");
      const role = new URL(window.location.href).searchParams.get("role") === "partner" ? "partner" : "owner";
      const partnerId = localStorage.getItem(partnerKey) || "demo-partner-001";
      const me =
        role === "owner"
          ? { id: state.owner_id || "demo-owner-001", type: "owner" }
          : { id: partnerId, type: "partner" };
      const msgs = (state.threads?.[threadId]?.messages || []).filter((m) => !m.system);
      let expectedRight = 0;
      let expectedLeft = 0;
      for (const m of msgs) {
        const from = m.from || {};
        const ftype = String(from.type || "partner");
        const match =
          (ftype === "owner" && me.type === "owner") ||
          (ftype === me.type && String(from.id) === String(me.id));
        if (match) expectedRight += 1;
        else expectedLeft += 1;
      }
      const dom = {
        left: document.querySelectorAll(".mvp-slack-msg--left").length,
        right: document.querySelectorAll(".mvp-slack-msg--right").length,
        system: document.querySelectorAll(".mvp-slack-msg--system").length,
        unreadLeft: document.querySelectorAll(".mvp-slack-msg--left.is-unread").length,
        withName: document.querySelectorAll(".mvp-slack-msg__name").length,
        withTime: document.querySelectorAll(".mvp-slack-msg__time, .mvp-slack-msg__systemTime").length,
        withAttachment: document.querySelectorAll(".mvp-slack-msg__attachmentName").length,
      };
      return { expectedLeft, expectedRight, dom, msgCount: msgs.length };
    },
    { mvpKey: MVP_KEY, threadId: THREAD_ID, roleKey: ROLE_KEY, partnerKey: PARTNER_KEY }
  );

  if (layout.dom.left !== layout.expectedLeft || layout.dom.right !== layout.expectedRight) {
    throw new Error(
      `LINE layout mismatch (${role}): DOM left=${layout.dom.left} right=${layout.dom.right}, expected left=${layout.expectedLeft} right=${layout.expectedRight}`
    );
  }
  if (layout.dom.withName < 1) throw new Error("Sender name not rendered in bubble");
  if (layout.dom.withTime < 1) throw new Error("Timestamp not rendered");
  if (layout.dom.withAttachment < 1) throw new Error("Attachment name not rendered");
  return layout;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(threadUrl("owner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");

  const ownerLayout = await assertLineLayout(page, "owner", null);
  if (ownerLayout.dom.system < 0) throw new Error("System messages expected");

  const partnerLayout = await assertLineLayout(page, "partner", "demo-partner-001");
  if (partnerLayout.dom.right < 1) throw new Error("Partner view should have right-side own messages");
  if (partnerLayout.dom.left < 1) throw new Error("Partner view should have left-side other messages");

  await page.goto(threadUrl("owner"));
  await page.waitForSelector("[data-builder-mvp-thread-msgs]");

  const bubbleCount = await page.locator(".mvp-slack-msg__bubble, .mvp-slack-msg__system").count();
  if (bubbleCount < 1) throw new Error("Expected slack-style messages");

  await page.locator("[data-builder-mvp-thread-input]").fill("Slack風テストメッセージ");
  await page.locator("[data-builder-mvp-thread-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(() => document.body.textContent?.includes("Slack風テストメッセージ"));

  const afterSend = await countSides(page);
  if (afterSend.right < 1) throw new Error("Sent message should appear on right for owner role");

  await page.locator("[data-builder-mvp-thread-enter]").click();
  await page.waitForFunction(() => document.body.textContent?.includes("入場しました"));

  const afterEnter = await page.evaluate(
    (key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const thread = state.threads?.["thread-demo-001"];
      return thread?.events?.some((e) => e.type === "check_in");
    },
    MVP_KEY
  );
  if (!afterEnter) throw new Error("check_in event missing");

  const enterLayout = await countSides(page);
  if (enterLayout.system < 1) throw new Error("Enter system message should be centered");

  await page.locator("[data-builder-mvp-thread-leave]").click();
  await page.waitForFunction(() => document.body.textContent?.includes("退場しました"));

  await page.locator("[data-builder-mvp-thread-complete-open]").click();
  await page.locator("[data-builder-mvp-thread-complete-consent]").check();
  await page.locator("[data-builder-mvp-thread-complete-form]").evaluate((f) => f.requestSubmit());

  await page.waitForFunction(
    (key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const thread = state.threads?.["thread-demo-001"];
      return thread?.siteData?.completed === true && thread?.siteData?.completionConsent === true;
    },
    MVP_KEY
  );

  const pdfCount = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    return (state.threads?.["thread-demo-001"]?.pdf_outputs || []).filter((p) => p.kind === "invoice").length;
  }, MVP_KEY);
  if (pdfCount < 1) throw new Error("Invoice PDF not generated");

  const notifs = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), NOTIF_KEY);
  if (!notifs.some((n) => n.type === "completed")) throw new Error("Completion notification missing");

  await page.goto(`file://${path.join(builder, "mvp-project-detail.html")}?id=demo-project-001`);
  await page.waitForSelector("[data-builder-mvp-pd-stats]");

  console.log("OK: builder mvp slack thread smoke test passed (LINE layout verified)");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
