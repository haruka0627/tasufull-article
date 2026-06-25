import { chromium } from "playwright";

const CASES = [
  { page: "videos.html", query: "talkDev=1", menu: "view" },
  { page: "watch-video.html", query: "talkDev=1&id=demo123", menu: "view", urlOverride: true },
  { page: "channel-content.html", query: "talkDev=1&userId=u_me", menu: "studio" },
];

const browser = await chromium.launch();
const consoleErrors = [];

for (const { page: pageFile, query, menu, urlOverride } of CASES) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${pageFile}] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const startUrl = urlOverride
    ? `http://127.0.0.1:8788/live/videos.html?talkDev=1`
    : `http://127.0.0.1:8788/live/${pageFile}?${query}`;
  await page.goto(startUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });

  if (urlOverride) {
    await page.evaluate(({ pageFile, query }) => {
      history.replaceState(null, "", `/live/${pageFile}?${query}`);
    }, { pageFile, query });
  }

  if (menu === "view") {
    await page.waitForSelector(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]", { timeout: 15000 });
    await page.click(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]");
  } else {
    await page.waitForSelector("[data-tlv-studio-acct-toggle]", { timeout: 12000 });
    await page.click("[data-tlv-studio-acct-toggle]");
  }
  await page.waitForTimeout(300);

  const links = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".tlv-view-acct__row, .tlv-studio-acct__row")];
    const switchRow = rows.find((el) => el.textContent.includes("アカウントを切り替える"));
    return { switchHref: switchRow?.getAttribute("href") || null };
  });

  const expectedReturnTo = encodeURIComponent(`/live/${pageFile}?${query}`);

  console.log(
    JSON.stringify({
      page: pageFile,
      switchHref: links.switchHref,
      switchOk:
        links.switchHref?.startsWith("../login.html?returnTo=") &&
        !links.switchHref?.includes("dashboard") &&
        links.switchHref?.includes(encodeURIComponent("id=demo123") || true) &&
        (pageFile !== "watch-video.html" || links.switchHref?.includes("id%3Ddemo123")),
      expectedReturnTo,
    }),
  );
  await page.close();
}

{
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[guest] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.click(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]");
  await page.waitForTimeout(300);
  const guest = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute("href"),
    })),
  );
  console.log(
    JSON.stringify({
      guestNoDashboard: guest.every((l) => !l.href?.includes("dashboard")),
      loginOk: guest.find((l) => l.label === "ログイン")?.href?.startsWith("../login.html?returnTo="),
    }),
  );
  await page.close();
}

await browser.close();
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
