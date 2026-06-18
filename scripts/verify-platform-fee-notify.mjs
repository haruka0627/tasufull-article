/**
 * プラット手数料通知 — Connect未利用/Connect利用 の検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-fee-notify";

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const audit = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const feeRows = list.filter(
      (n) =>
        String(n.id || "").startsWith("platform-fee-") ||
        n.source === "platform_fee_master_v1" ||
        n.source === "platform_fee_v1"
    );
    const prepay = feeRows.filter((n) => n.title?.includes("手数料が必要"));
    const complete = feeRows.filter((n) => n.title === "取引が完了しました");
    const officialMsgs =
      window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful") || [];
    const feeTalkCards = officialMsgs.filter((m) => m.kind === "notify_card");
    return {
      feeCount: feeRows.length,
      prepayCount: prepay.length,
      completeCount: complete.length,
      talkCardCount: feeTalkCards.length,
      samplePrepay: prepay[0]
        ? {
            title: prepay[0].title,
            actionLabel: prepay[0].actionLabel,
            body: prepay[0].body,
            href: prepay[0].href,
            sendTalkMessage: prepay[0].sendTalkMessage,
          }
        : null,
      sampleComplete: complete[0]
        ? { title: complete[0].title, href: complete[0].href, actionLabel: complete[0].actionLabel }
        : null,
    };
  });

  if (audit.feeCount < 5) errors.push(`fee notifications expected >=5, got ${audit.feeCount}`);
  if (audit.prepayCount < 4) errors.push(`prepay notifications expected >=4, got ${audit.prepayCount}`);
  if (audit.completeCount < 2) errors.push(`complete notifications expected >=2, got ${audit.completeCount}`);
  if (!audit.samplePrepay?.actionLabel?.includes("確認")) {
    errors.push("prepay actionLabel missing 確認する");
  }
  if (audit.samplePrepay?.body) errors.push("prepay body should be empty (minimal card)");
  if (!audit.samplePrepay?.href?.includes("platform-chat-fee-pay")) {
    errors.push(`prepay href unexpected: ${audit.samplePrepay?.href}`);
  }
  if (!audit.sampleComplete?.href) errors.push("complete href missing");

  await page.screenshot({ path: path.join(OUT_DIR, "notify-tab-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, "talk-list-390.png") });
  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "talk-official-fee-card-390.png") });

  if (audit.samplePrepay?.href) {
    await page.goto(`${BASE_URL}/${audit.samplePrepay.href.replace(/^\//, "")}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, "fee-pay-390.png") });
  }

  await page.goto(`${BASE_URL}/detail-skill.html?id=demo-skill-001`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForTimeout(800);
  const cta = page.locator(".cta-consult").first();
  await cta.click();
  await page.waitForURL(/platform-chat-fee-pay\.html/, { timeout: 15000 });
  await page.screenshot({ path: path.join(OUT_DIR, "skill-cta-fee-pay-390.png") });

  const runtimeNotify = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("tasful_talk_notifications");
      const list = raw ? JSON.parse(raw) : [];
      return (Array.isArray(list) ? list : []).find(
        (n) =>
          n.source === "platform_fee_v1" &&
          String(n.title || "").includes("手数料が必要")
      );
    } catch {
      return null;
    }
  });
  if (!runtimeNotify) errors.push("runtime prepay notification not created from skill CTA");

    });

  console.log(JSON.stringify({ audit, runtimeNotify: !!runtimeNotify, errors }, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("ALL OK");
}

await run();
