import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function verifyWidth(page, width) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  if (width < 768) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }

  const metrics = await page.evaluate(() => {
    const avatar = document.querySelector(".tlv-studio-sidebar__channel-avatar");
    const name = document.querySelector(".tlv-studio-sidebar__channel-name");
    const handle = document.querySelector(".tlv-studio-sidebar__channel-handle");
    const subs = document.querySelector(".tlv-studio-sidebar__channel-subs");
    const channel = document.querySelector(".tlv-studio-sidebar__channel");
    const sidebar = document.querySelector(".tlv-studio-sidebar");
    const avatarStyle = avatar ? getComputedStyle(avatar) : null;
    const nameStyle = name ? getComputedStyle(name) : null;
    const handleStyle = handle ? getComputedStyle(handle) : null;
    const subsStyle = subs ? getComputedStyle(subs) : null;
    const rect = avatar?.getBoundingClientRect();
    const channelRect = channel?.getBoundingClientRect();
    const sidebarRect = sidebar?.getBoundingClientRect();
    return {
      avatarW: rect ? Math.round(rect.width) : 0,
      avatarH: rect ? Math.round(rect.height) : 0,
      borderRadius: avatarStyle?.borderRadius,
      nameSize: nameStyle ? Math.round(parseFloat(nameStyle.fontSize)) : 0,
      handleSize: handleStyle ? Math.round(parseFloat(handleStyle.fontSize)) : 0,
      subsSize: subsStyle ? Math.round(parseFloat(subsStyle.fontSize)) : 0,
      channelOverflow: channel ? channel.scrollWidth > channel.clientWidth + 1 : false,
      sidebarOverflow: sidebar ? sidebar.scrollWidth > (sidebar.parentElement?.clientWidth || sidebar.clientWidth) + 1 : false,
      avatarInSidebar: rect && sidebarRect ? rect.right <= sidebarRect.right + 1 && rect.left >= sidebarRect.left - 1 : null,
    };
  });

  return { viewport: width, ...metrics, consoleErrors };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
for (const width of WIDTHS) {
  results.push(await verifyWidth(page, width));
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
