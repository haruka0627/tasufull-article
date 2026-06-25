import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "scripts/tmp-acct-menu-pages-verify";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [390, 768, 1280];
const PAGES = [
  { file: "video-upload.html", query: "talkDev=1&userId=u_me" },
  { file: "watch-video.html", query: "talkDev=1" },
];

function acctSelector(width) {
  return width >= 1024
    ? ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]"
    : ".tlv-mobile-videos-toprow__actions [data-tlv-view-acct-toggle]";
}

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

for (const { file, query } of PAGES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    const label = `${file}@${width}`;
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`[${label}][pageerror] ${err.message}`);
    });

    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:8788/live/${file}?${query}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")]
        .map((s) => s.getAttribute("src") || "")
        .filter((src) => src.includes("/live/") || !src.includes("/"))
        .map((src) => src.split("/").pop().split("?")[0]),
    );

    const domBeforeOpen = await page.evaluate(() => ({
      viewAcct: document.querySelectorAll("[data-tlv-view-acct-menu]").length,
      studioAcct: document.querySelectorAll("[data-tlv-studio-acct-menu]").length,
      viewToggle: document.querySelectorAll("[data-tlv-view-acct-toggle]").length,
      studioToggle: document.querySelectorAll("[data-tlv-studio-acct-toggle]").length,
      context: window.TasuTlvAccountContext?.resolveContext?.(),
      topbarLen: document.querySelector("[data-tlv-desktop-topbar-mount]")?.innerHTML?.length || 0,
      mobileHeaderLen: document.querySelector("[data-tlv-mobile-header-mount]")?.innerHTML?.length || 0,
    }));

    const sel = acctSelector(width);
    let menu = null;
    if (await page.locator(sel).count()) {
      await page.locator(sel).first().click();
      await page.waitForTimeout(350);
      menu = await page.evaluate(() => {
        const rows = [...document.querySelectorAll(".tlv-view-acct__row-label")].map((el) =>
          el.textContent.trim(),
        );
        const guestLinks = [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((a) => ({
          label: a.textContent.trim(),
          href: a.getAttribute("href"),
        }));
        const switchRow = [...document.querySelectorAll(".tlv-view-acct__row")].find((el) =>
          el.textContent.includes("アカウントを切り替える"),
        );
        return {
          loggedInLabels: rows,
          hasProfile: Boolean(document.querySelector(".tlv-view-acct__profile")),
          hasGuest: Boolean(document.querySelector(".tlv-view-acct__guest")),
          guestLinks,
          switchHref: switchRow?.getAttribute("href") || null,
        };
      });
    }

    await page.screenshot({ path: `${OUT}/${file.replace(".html", "")}-${width}.png`, fullPage: false });

    results.push({
      file,
      width,
      scripts,
      domBeforeOpen,
      menu,
      acctSelector: sel,
      toggleFound: await page.locator(sel).count(),
    });
    await page.close();
  }
}

// Guest mode href check on video-upload 1280
{
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[guest-upload] ${msg.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:8788/live/video-upload.html?talkDev=1", {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.click(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]");
  await page.waitForTimeout(300);
  const guest = await page.evaluate(() =>
    [...document.querySelectorAll(".tlv-view-acct__guest-actions a")].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute("href"),
    })),
  );
  results.push({ file: "video-upload.html", width: 1280, mode: "guest", guest });
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, consoleErrorCount: consoleErrors.length, consoleErrors }, null, 2));
