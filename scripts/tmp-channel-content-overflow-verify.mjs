import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live";
const WIDTHS = [390, 768, 1280];

function overflowMetrics() {
  return {
    scrollW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    bodyScrollW: document.body.scrollWidth,
    hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
  };
}

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

for (const width of WIDTHS) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[channel-content ${width}] ${msg.text()}`);
  });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/channel-content.html?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(overflowMetrics);
  results.push({ page: "channel-content", width, ...metrics, match: metrics.scrollW === metrics.vw });
  await page.close();
}

// Studio settings modal at 390px
{
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[settings-modal] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/channel-content.html?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    document.querySelector("[data-tlv-studio-settings-open]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(400);

  const modalOpen = await page.evaluate(() => document.body.classList.contains("tlv-studio-settings-open"));
  const modalMetrics = await page.evaluate(overflowMetrics);
  results.push({
    page: "channel-content-settings-open",
    width: 390,
    ...modalMetrics,
    match: modalMetrics.scrollW === modalMetrics.vw,
    modalOpen,
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const modalClosed = await page.evaluate(() => !document.body.classList.contains("tlv-studio-settings-open"));
  results.push({ page: "channel-content-settings-close", width: 390, modalClosed });

  await page.close();
}

// Menu context checks
const menuChecks = [
  { page: "video-upload.html", expectStudio: true },
  { page: "videos.html", expectStudio: false },
  { page: "watch-video.html", expectStudio: false },
];

for (const { page: file, expectStudio } of menuChecks) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${file}] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/${file}?talkDev=1&userId=u_me`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const menu = await page.evaluate(() => ({
    hasStudioAcct: !!document.querySelector(".tlv-studio-acct"),
    hasViewAcct: !!document.querySelector(".tlv-view-acct"),
    scrollW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  }));

  results.push({
    page: file,
    width: 390,
    expectStudio,
    hasStudioAcct: menu.hasStudioAcct,
    hasViewAcct: menu.hasViewAcct,
    menuOk: expectStudio ? menu.hasStudioAcct && !menu.hasViewAcct : menu.hasViewAcct && !menu.hasStudioAcct,
    scrollMatch: menu.scrollW === menu.vw,
  });
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, consoleErrors }, null, 2));

const failed = results.filter((r) => r.match === false || r.menuOk === false || r.modalOpen === false || r.modalClosed === false);
process.exit(failed.length || consoleErrors.length ? 1 : 0);
