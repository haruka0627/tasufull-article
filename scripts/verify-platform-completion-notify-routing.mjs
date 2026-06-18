/**
 * プラット完了通知 → やりとりチャット内 完了報告カード（390px 証跡）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { BASE_URL, requireDevServer } from "./lib/dev-base-url.mjs";

const OUT_DIR = "screenshots/platform-completion-notify";

async function run() {
  await requireDevServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
    window.TasuPlatformChatCompletion?.ensureDemoSkillDealThread?.();
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const complete = list.filter((n) => n.title === "取引が完了しました");
    const row =
      complete.find((n) => String(n.id || "").includes("platform-fee-skill-connect-complete")) ||
      complete[0];
    return row
      ? {
          id: row.id,
          title: row.title,
          actionLabel: row.actionLabel,
          href: row.href || row.targetUrl,
        }
      : null;
  });

  if (!audit) errors.push("complete notification missing");
  else {
    if (audit.actionLabel !== "確認する") errors.push(`actionLabel: ${audit.actionLabel}`);
    if (!audit.href?.includes("chat-detail.html")) {
      errors.push(`notify href should be chat-detail, got ${audit.href}`);
    }
    if (audit.href?.includes("deal-detail.html")) {
      errors.push("notify href must not use deal-detail.html");
    }
  }

  const completeCard = page
    .locator("[data-talk-notify-id]")
    .filter({ hasText: "取引が完了しました" })
    .first();
  const completeCount = await completeCard.count();
  if (completeCount < 1) errors.push("complete card not visible in notify tab");
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll("[data-talk-notify-mobile-chip]")];
    const feeChip = chips.find((el) => /手数料|プラット|取引/i.test(el.textContent || ""));
    feeChip?.click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "01-notify-complete-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=chat&room=official_tasful`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const talkAudit = await page.evaluate(() => {
    const msgs =
      window.TasuTalkOfficialRooms?.getRoomMessages?.("official_tasful")?.filter(
        (m) => m.kind === "notify_card" && String(m.text || "").includes("取引が完了")
      ) || [];
    return {
      count: msgs.length,
      sampleHref: msgs[0]?.href || msgs[0]?.actionHref || msgs[0]?.targetUrl || "",
    };
  });

  await page.screenshot({ path: path.join(OUT_DIR, "02-talk-official-complete-390.png") });

  await page.goto(`${BASE_URL}/talk-home.html?tab=notify`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const chatHref =
    audit?.href || "chat-detail.html?thread=chat-demo-skill-deal-001&deal=skill_deal_demo_001";

  const navResult = await page.evaluate(() => {
    const list = window.TasuTalkNotifications?.getAll?.() || [];
    const row = list.find(
      (n) => n.title === "取引が完了しました" && String(n.href || "").includes("chat-detail")
    );
    if (!row) return { ok: false, reason: "row_missing" };
    const card = document.querySelector(`[data-talk-notify-id="${row.id}"] a[data-talk-notify-action]`);
    const cardHref = card?.getAttribute("href") || row.href;
    if (!cardHref.includes("chat-detail.html")) return { ok: false, reason: "bad_href", cardHref };
    return { ok: true, cardHref, sameAsMaster: cardHref.includes("chat-demo-skill-deal-001") };
  });

  if (talkAudit.count < 1) errors.push("TALK official notify_card missing for 取引が完了しました");
  if (!navResult.ok) errors.push(`notify 確認する href: ${navResult.reason || "failed"}`);
  if (talkAudit.sampleHref?.includes("deal-detail.html")) {
    errors.push(`TALK card href must not be deal-detail: ${talkAudit.sampleHref}`);
  }

  await page.goto(`${BASE_URL}/${String(navResult.cardHref || chatHref).replace(/^\//, "")}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "03-chat-after-confirm-390.png") });

  const chatUi = await page.evaluate(() => {
    const card = document.querySelector("[data-platform-completion-card]");
    return {
      hasCard: Boolean(card),
      title: document.querySelector(".chat-completion-card__title")?.textContent?.trim(),
      hasApprove: Boolean(document.querySelector("[data-platform-completion-approve]")),
      hasReject: Boolean(document.querySelector("[data-platform-completion-reject]")),
      hasChatConfirmBtn: Boolean(
        [...document.querySelectorAll("a,button")].some((el) =>
          /チャットで確認/.test(el.textContent || "")
        )
      ),
      url: window.location.href,
    };
  });

  if (!chatUi.hasCard) errors.push("completion card missing in chat");
  if (chatUi.title !== "完了報告") errors.push(`card title: ${chatUi.title}`);
  if (!chatUi.hasApprove || !chatUi.hasReject) errors.push("approve/reject buttons missing");
  if (chatUi.hasChatConfirmBtn) errors.push("チャットで確認 button should not appear in chat");
  if (!chatUi.url.includes("chat-detail.html")) errors.push(`unexpected chat url: ${chatUi.url}`);

  await page.screenshot({ path: path.join(OUT_DIR, "04-chat-completion-card-390.png") });

  await browser.close();

  const report = { audit, talkAudit, navResult, chatUi, errors, screenshots: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")) };
  console.log(JSON.stringify(report, null, 2));

  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    process.exit(1);
  }
  console.log("ALL OK — platform completion notify routing verified");
}

await run();
