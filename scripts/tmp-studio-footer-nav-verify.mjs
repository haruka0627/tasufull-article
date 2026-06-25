import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://127.0.0.1:8788/live/studio-dashboard.html";
const OUT_DIR = path.resolve("scripts/tmp-studio-verify");
const WIDTHS = [390, 768, 1280];

async function verify(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  if (width < 1024) {
    const menu = page.locator(".tlv-studio-mobile-header__menu, .tlv-studio-topbar__menu").first();
    if (await menu.isVisible()) {
      await menu.click();
      await page.waitForTimeout(400);
    }
  }

  const metrics = await page.evaluate(() => {
    const footer = document.querySelector(".tlv-studio-sidebar__footer");
    const links = footer ? [...footer.querySelectorAll(".tlv-studio-sidebar__link")] : [];
    const mainNavLink = document.querySelector(
      ".tlv-studio-sidebar__nav > .tlv-studio-sidebar__link, .tlv-studio-sidebar__nav > a.tlv-studio-sidebar__link",
    );
    const feedback = links.find((el) =>
      el.querySelector(".tlv-studio-sidebar__link-label")?.textContent?.includes("フィードバック"),
    );
    const feedbackLabel = feedback?.querySelector(".tlv-studio-sidebar__link-label");
    const feedbackRect = feedbackLabel?.getBoundingClientRect();
    const feedbackStyle = feedbackLabel ? getComputedStyle(feedbackLabel) : null;
    const icon = feedback?.querySelector(".tlv-studio-sidebar__link-icon");
    const iconStyle = icon ? getComputedStyle(icon) : null;
    const linkStyle = feedback ? getComputedStyle(feedback) : null;
    const mainStyle = mainNavLink ? getComputedStyle(mainNavLink) : null;

    return {
      footerFound: Boolean(footer),
      linkCount: links.length,
      labels: links.map((el) => el.querySelector(".tlv-studio-sidebar__link-label")?.textContent?.trim()),
      feedbackSingleLine: feedbackRect ? feedbackRect.height <= 20 : false,
      feedbackWhiteSpace: feedbackStyle?.whiteSpace,
      linkWhiteSpace: linkStyle?.whiteSpace,
      fontSizePx: linkStyle ? parseFloat(linkStyle.fontSize) : 0,
      iconFontPx: iconStyle ? parseFloat(iconStyle.fontSize) : 0,
      mainFontPx: mainStyle ? parseFloat(mainStyle.fontSize) : 0,
      gapBetween:
        links.length >= 2
          ? links[1].getBoundingClientRect().top - links[0].getBoundingClientRect().bottom
          : null,
    };
  });

  const shot = path.join(OUT_DIR, `studio-footer-nav-${width}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  return { viewport: width, ...metrics, screenshot: shot };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

for (const width of WIDTHS) {
  console.log(JSON.stringify(await verify(page, width), null, 2));
}
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
await browser.close();
