import { chromium } from "playwright";

const CASES = [
  { page: "videos.html", query: "talkDev=1" },
  { page: "watch-video.html", query: "talkDev=1&id=demo123" },
  { page: "studio-dashboard.html", query: "talkDev=1&userId=u_me" },
];

async function openGuestMenu(page, pageFile, width, isStudio) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://127.0.0.1:8788/live/${pageFile}?${CASES.find((c) => c.page === pageFile)?.query || "talkDev=1"}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => {
    window.TasuAuthCurrentUser = window.TasuAuthCurrentUser || {};
    window.TasuAuthCurrentUser.getCurrentUser = () => ({ authenticated: false });
  });
  const sel = isStudio
    ? width >= 1024
      ? "[data-tlv-studio-acct-toggle]"
      : ".tlv-studio-mobile-header [data-tlv-studio-acct-toggle]"
    : width >= 1024
      ? ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]"
      : ".tlv-mobile-videos-toprow__actions [data-tlv-view-acct-toggle]";
  if (isStudio) await page.waitForSelector("[data-tlv-studio-acct-menu]", { timeout: 12000 }).catch(() => {});
  await page.locator(sel).first().click();
  await page.waitForTimeout(300);
}

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

for (const { page: pageFile } of CASES) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${pageFile}] ${msg.text()}`);
  });
  const isStudio = pageFile === "studio-dashboard.html";
  await openGuestMenu(page, pageFile, 1280, isStudio);

  const links = await page.evaluate(() => {
    const guest = document.querySelector(".tlv-view-acct__guest-actions, .tlv-studio-acct__guest-actions");
    const anchors = guest ? [...guest.querySelectorAll("a")] : [];
    return anchors.map((a) => ({ label: a.textContent.trim(), href: a.getAttribute("href") }));
  });

  const login = links.find((l) => l.label === "ログイン");
  const signup = links.find((l) => l.label === "アカウント作成");
  const expectedPath = `/live/${pageFile}`;
  const expectedQuery = CASES.find((c) => c.page === pageFile)?.query || "";
  const expectedReturnTo = encodeURIComponent(`${expectedPath}${expectedQuery ? `?${expectedQuery}` : ""}`);

  results.push({
    page: pageFile,
    loginHref: login?.href,
    signupHref: signup?.href,
    loginOk: login?.href?.startsWith("../login.html?returnTo=") && login.href.includes(expectedReturnTo),
    signupOk: signup?.href?.startsWith("../signup.html?returnTo=") && signup.href.includes(expectedReturnTo),
    noDashboard: !login?.href?.includes("dashboard.html") && !signup?.href?.includes("dashboard.html"),
    expectedReturnTo,
  });
  await page.close();
}

await browser.close();

for (const r of results) console.log(JSON.stringify(r, null, 2));
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
