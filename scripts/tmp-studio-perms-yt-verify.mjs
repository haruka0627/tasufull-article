import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [1280, 768, 390];

async function openPermissionsTab(page) {
  const isMobile = (await page.viewportSize())?.width < 768;
  if (isMobile) {
    await page.click(".tlv-studio-mobile-header__menu");
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.querySelector("[data-tlv-studio-settings-open]")?.click());
  await page.waitForSelector("[data-tlv-studio-settings]:not([hidden])");
  await page.click('[data-tlv-studio-settings-section="permissions"]');
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
  await openPermissionsTab(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('[data-tlv-studio-settings-panel="permissions"]');
    const members = document.querySelectorAll(".tlv-studio-settings-perms__member");
    const invite = document.querySelector(".tlv-studio-settings-perms__invite");
    const panelRect = panel?.getBoundingClientRect();
    const inviteRect = invite?.getBoundingClientRect();
    const membersBox = document.querySelector(".tlv-studio-settings-perms__members")?.getBoundingClientRect();
    const dialog = document.querySelector(".tlv-studio-settings__dialog")?.getBoundingClientRect();
    return {
      desc: panel?.querySelector(".tlv-studio-settings__panel-head-desc")?.textContent?.trim(),
      channelTitle: panel?.querySelector(".tlv-studio-settings-perms__channel-title")?.textContent?.trim(),
      memberCount: members.length,
      hasGuide: !!panel?.querySelector(".tlv-studio-settings-perms__guide"),
      hasRoleCards: !!panel?.querySelector(".tlv-studio-settings-perms__role-card"),
      summary: panel?.querySelector(".tlv-studio-settings-perms__summary")?.textContent?.trim(),
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth + 1 : false,
      membersOverflow: membersBox && dialog ? membersBox.right <= dialog.right + 1 : null,
      inviteOverflow: inviteRect && dialog ? inviteRect.right <= dialog.right + 1 : null,
      inviteVisible: !!invite && inviteRect && inviteRect.width > 0,
    };
  });

  // tab switch + close
  await page.click('[data-tlv-studio-settings-section="general"]');
  await page.waitForTimeout(100);
  await page.click('[data-tlv-studio-settings-section="permissions"]');
  await page.waitForTimeout(100);
  const tabOk = await page.evaluate(
    () => !document.querySelector('[data-tlv-studio-settings-panel="permissions"]')?.hidden,
  );

  await page.click("[data-tlv-studio-settings-close]");
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector("[data-tlv-studio-settings]")?.hidden);

  return {
    viewport: width,
    ...metrics,
    tabOk,
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
