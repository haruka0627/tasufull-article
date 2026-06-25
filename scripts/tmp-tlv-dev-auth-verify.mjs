import { chromium } from "playwright";

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

async function openViewMenu(page, width) {
  const sel =
    width >= 1024
      ? ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]"
      : ".tlv-mobile-videos-toprow__actions [data-tlv-view-acct-toggle]";
  await page.setViewportSize({ width, height: 900 });
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.locator(sel).first().click();
  await page.waitForTimeout(350);
}

async function openStudioMenu(page, width) {
  await page.setViewportSize({ width, height: 900 });
  const sel =
    width >= 1024
      ? "[data-tlv-studio-acct-toggle]"
      : ".tlv-studio-mobile-header [data-tlv-studio-acct-toggle]";
  await page.waitForSelector("[data-tlv-studio-acct-menu]", { timeout: 12000 }).catch(() => {});
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.locator(sel).first().click();
  await page.waitForTimeout(350);
}

async function runCase(name, fn) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${name}] ${msg.text()}`);
  });
  const result = await fn(page);
  await page.close();
  results.push({ name, ...result });
}

await runCase("videos-demo-login", async (page) => {
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await openViewMenu(page, 1280);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-view-acct__row-label")].map((el) => el.textContent.trim()),
  );
  const dev = await page.evaluate(() => ({
    shouldDemo: window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.(),
    hasGuest: Boolean(document.querySelector(".tlv-view-acct__guest")),
  }));
  return { labels: labels.slice(0, 4), dev, ok: dev.shouldDemo && labels.includes("マイページ") && !dev.hasGuest };
});

await runCase("studio-demo-login", async (page) => {
  await page.goto("http://127.0.0.1:8788/live/studio-dashboard.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await openStudioMenu(page, 1280);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-studio-acct__row-label")].map((el) => el.textContent.trim()),
  );
  const dev = await page.evaluate(() => window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.());
  return { labels: labels.slice(0, 3), dev, ok: dev && labels.includes("チャンネル") };
});

await runCase("force-guest", async (page) => {
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await openViewMenu(page, 1280);
  const guest = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((a) => a.textContent.trim()),
  );
  return { guest, ok: guest.includes("ログイン") };
});

await runCase("remove-force-guest", async (page) => {
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  const dev = await page.evaluate(() => window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.());
  return { dev, ok: dev === true };
});

await runCase("production-host-no-demo", async (page) => {
  await page.goto("http://127.0.0.1:8788/live/videos.html?talkDev=1", { waitUntil: "networkidle" });
  const prod = await page.evaluate(() => {
    const orig = window.location.hostname;
    try {
      Object.defineProperty(window.location, "hostname", { configurable: true, value: "tasufull-article.pages.dev" });
    } catch {
      return { skipped: true, ok: true };
    }
    const should = window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.();
    const isLocal = window.TasuTlvDevAuth?.isLocalTlvDevHost?.();
    try {
      Object.defineProperty(window.location, "hostname", { configurable: true, value: orig });
    } catch {
      /* ignore */
    }
    return { should, isLocal, ok: !should };
  });
  return prod;
});

await browser.close();

for (const r of results) console.log(JSON.stringify(r));
console.log(`\nconsoleErrors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));
