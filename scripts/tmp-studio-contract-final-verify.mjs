import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function openContractTab(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.click('[data-tlv-studio-settings-section="contract"]');
  await page.waitForTimeout(200);
}

async function verifyWidth(page, width) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await openContractTab(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('[data-tlv-studio-settings-panel="contract"]');
    const panels = document.querySelector(".tlv-studio-settings__panels");
    const stack = document.querySelector(".tlv-studio-settings-contract__stack");
    const cards = document.querySelectorAll(".tlv-studio-settings-contract__card");
    const notice = document.querySelector(".tlv-studio-settings-contract__notice");
    const widths = [...stack?.children || []].map((el) => Math.round(el.getBoundingClientRect().width));
    const widthUniform = widths.length > 1 && widths.every((w) => w === widths[0]);
    return {
      hasOldTopCards: !!panel?.querySelector(".tlv-studio-settings-contract__cards"),
      cardCount: cards.length,
      cardTitles: [...cards].map((c) => c.querySelector(".tlv-studio-settings-contract__card-title")?.textContent?.trim()),
      statusBadges: [...panel?.querySelectorAll(".tlv-studio-settings-contract__card-badges .tlv-studio-settings-contract__badge") || []].map(
        (b) => b.textContent?.trim(),
      ),
      btnCount: panel?.querySelectorAll(".tlv-studio-settings-contract__btn").length || 0,
      noticeText: notice?.textContent?.replace(/\s+/g, " ").trim(),
      stackWidths: widths,
      widthUniform,
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      panelsScrollable: panels ? panels.scrollHeight > panels.clientHeight + 2 : false,
      panelsScrollH: panels ? panels.scrollHeight - panels.clientHeight : 0,
      saveDisabled: document.querySelector("[data-tlv-studio-settings-save]")?.disabled,
    };
  });

  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...metrics,
    modalClosed: closed === true,
    consoleErrors,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
for (const width of WIDTHS) {
  results.push(await verifyWidth(page, width));
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
