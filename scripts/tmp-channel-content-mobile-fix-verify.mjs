import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "scripts/tmp-channel-content-mobile-fix";
fs.mkdirSync(OUT, { recursive: true });

const URL = "http://127.0.0.1:8788/live/channel-content.html?talkDev=1&userId=u_me";
const WIDTHS = [390, 768, 1280];
const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

for (const width of WIDTHS) {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${width}] ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${width}][page] ${e.message}`));

  await page.setViewportSize({ width, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector(".tlv-studio-mobile-shell");
    const header = shell?.querySelector(":scope > header.tlv-studio-mobile-header");
    const main = shell?.querySelector(":scope > main.tlv-studio-mobile-content");
    const upload = header?.querySelector(".tlv-studio-mobile-header__upload");
    const mainInsideUpload = upload?.querySelector("main") !== null;
    const mainAncestorUpload =
      main && upload ? upload.contains(main) : false;
    const title = document.querySelector(".tlv-studio-page__title");
    const titleCs = title ? getComputedStyle(title) : null;
    const filterBtn = document.querySelector(".tlv-studio-filter");
    const filterCs = filterBtn ? getComputedStyle(filterBtn) : null;
    const bodyText = document.body.innerText;
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dom: {
        shellChildTags: shell
          ? [...shell.children].map((el) => el.tagName + (el.className ? "." + String(el.className).split(" ")[0] : ""))
          : [],
        mainParentTag: main?.parentElement?.tagName || null,
        mainInsideUpload,
        mainAncestorUpload,
        uploadInner: upload?.innerHTML || null,
      },
      ui: {
        hasEeSlash: bodyText.includes("EE/a>"),
        meIconCount: document.querySelectorAll(".tlv-studio-acct__trigger-avatar").length,
        mobileHeaderMeCount: document.querySelectorAll(
          ".tlv-studio-mobile-header .tlv-studio-acct__trigger-avatar",
        ).length,
        headerChildCount: document.querySelectorAll(".tlv-studio-mobile-header > *").length,
        hasMenuBtn: Boolean(document.querySelector(".tlv-studio-mobile-header__menu")),
        hasTitle: Boolean(document.querySelector(".tlv-studio-mobile-header__title")),
        titleWritingMode: titleCs?.writingMode || null,
        titleWidth: title?.getBoundingClientRect().width || 0,
        filterWritingMode: filterCs?.writingMode || null,
        titleText: title?.textContent?.trim() || "",
      },
    };
  });

  await page.screenshot({ path: `${OUT}/channel-content-${width}.png`, fullPage: false });
  results.push({ width, ...metrics });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ results, consoleErrorCount: consoleErrors.length, consoleErrors }, null, 2));
