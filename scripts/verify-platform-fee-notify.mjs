/**
 * プラット手数料通知 — Connect未利用/Connect利用 の検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-fee-notify";
const SHOT_OPTS = { animations: "disabled", timeout: 15000 };

async function resetSkillContactState(page) {
  await page.evaluate(() => {
    try {
      const key = "tasful_listing_contact_requests_v1";
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list = JSON.parse(raw);
      const filtered = (Array.isArray(list) ? list : []).filter(
        (r) => String(r.listing_id) !== "demo-skill-001"
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await page.waitForTimeout(500);
}

async function shotPage(page, filePath) {
  try {
    await page.evaluate(() => {
      document
        .querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')
        .forEach((el) => el.remove());
    });
  } catch {
    /* ignore */
  }
  await page.screenshot({ path: filePath, ...SHOT_OPTS }).catch(() => {});
}

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let audit = null;
  let skillSubmit = null;
  const errors = [];

  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`${BASE_URL}/talk-home.html?tab=notify&talkDev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  audit = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const isFeeRow = (n) => {
      if (!n) return false;
      if (String(n.id || "").startsWith("platform-fee-")) return true;
      if (n.source === "platform_fee_master_v1" || n.source === "platform_fee_v1") return true;
      if (n.feePhase === "pre_chat" || n.feePhase === "on_complete") return true;
      if (String(n.href || "").includes("platform-chat-fee-pay")) return true;
      return false;
    };
    const feeRows = list.filter(isFeeRow);
    const prepay = feeRows.filter(
      (n) =>
        n.title?.includes("手数料が必要") ||
        n.feePhase === "pre_chat" ||
        String(n.href || "").includes("platform-chat-fee-pay")
    );
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
  if (!audit.samplePrepay?.actionLabel) {
    errors.push("prepay actionLabel missing");
  } else if (
    !audit.samplePrepay.actionLabel.includes("確認") &&
    !audit.samplePrepay.actionLabel.includes("見る")
  ) {
    errors.push(`prepay actionLabel unexpected: ${audit.samplePrepay.actionLabel}`);
  }
  if (audit.samplePrepay?.body) errors.push("prepay body should be empty (minimal card)");
  if (!audit.samplePrepay?.href?.includes("platform-chat-fee-pay")) {
    errors.push(`prepay href unexpected: ${audit.samplePrepay?.href}`);
  }
  if (!audit.sampleComplete?.href) errors.push("complete href missing");

  await shotPage(page, path.join(OUT_DIR, "notify-tab-390.png"));

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  await shotPage(page, path.join(OUT_DIR, "talk-list-390.png"));
  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await shotPage(page, path.join(OUT_DIR, "talk-official-fee-card-390.png"));

  if (audit.samplePrepay?.href) {
    await page.goto(`${BASE_URL}/${audit.samplePrepay.href.replace(/^\//, "")}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await shotPage(page, path.join(OUT_DIR, "fee-pay-390.png"));
  }

  await page.goto(`${BASE_URL}/detail-skill.html?id=demo-skill-001&talkDev=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
  await resetSkillContactState(page);
  const cta = page.locator(".cta-consult").first();
  await cta.waitFor({ state: "visible", timeout: 20000 });
  await cta.scrollIntoViewIfNeeded();
  await cta.click();
  await page.waitForTimeout(1000);
  await shotPage(page, path.join(OUT_DIR, "skill-cta-after-submit-390.png"));

  skillSubmit = await page.evaluate(() => {
    try {
      const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
      const contact = (Array.isArray(contacts) ? contacts : []).find(
        (r) => String(r.listing_id) === "demo-skill-001"
      );
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const sellerNotify = (Array.isArray(notifs) ? notifs : []).find(
        (n) =>
          String(n.listingId) === "demo-skill-001" &&
          (n.source === "platform" || n.source === "platform_fee_v1")
      );
      return {
        contactId: contact?.contact_id || "",
        sellerNotify: Boolean(sellerNotify),
        ctaSubmitted: document.querySelector(".cta-consult")?.classList?.contains("is-submitted"),
      };
    } catch {
      return { contactId: "", sellerNotify: false, ctaSubmitted: false };
    }
  });
  if (!skillSubmit.contactId) {
    errors.push("skill contact row not created from CTA");
  }
  if (!skillSubmit.sellerNotify) {
    errors.push("seller notify not created from skill CTA");
  }

    });

  console.log(JSON.stringify({ audit, skillSubmit, errors }, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("ALL OK");
}

await run();
