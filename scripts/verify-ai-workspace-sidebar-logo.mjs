import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/ai-workspace/";
const dir = "screenshots/ai-workspace-sidebar-logo";
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));

const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#sidebar-fixed .tasful-brand-icon img", { timeout: 30000 });

const data = await page.evaluate(() => {
  const icon = document.querySelector("#sidebar-fixed .tasful-brand-icon");
  const img = document.querySelector("#sidebar-fixed .tasful-brand-icon img");
  const iconStyle = icon ? getComputedStyle(icon) : null;
  const imgStyle = img ? getComputedStyle(img) : null;

  const parseRgb = (v) => {
    const m = v?.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    return m[1].split(",").map((p) => p.trim());
  };

  const bg = parseRgb(iconStyle?.backgroundColor ?? "");
  const bgTransparent =
    iconStyle?.backgroundColor === "transparent" ||
    iconStyle?.backgroundColor === "rgba(0, 0, 0, 0)" ||
    (bg && bg[3] === "0");

  return {
    iconPresent: !!icon,
    imgPresent: !!img,
    imgSrc: img?.getAttribute("src") ?? null,
    iconBackground: iconStyle?.backgroundColor ?? null,
    iconBackgroundImage: iconStyle?.backgroundImage ?? null,
    iconBorderRadius: iconStyle?.borderRadius ?? null,
    iconBoxShadow: iconStyle?.boxShadow ?? null,
    iconPadding: iconStyle?.padding ?? null,
    iconWidth: iconStyle?.width ?? null,
    iconHeight: iconStyle?.height ?? null,
    imgWidth: imgStyle?.width ?? null,
    imgHeight: imgStyle?.height ?? null,
    bgTransparent,
    noPurpleGradient: !iconStyle?.backgroundImage?.includes("gradient"),
    noCircleRadius: iconStyle?.borderRadius === "0px",
    noBoxShadow: iconStyle?.boxShadow === "none",
  };
});

await page.locator("#sidebar-fixed .ai-ref-brand-link").screenshot({
  path: `${dir}/sidebar-brand-1280.png`,
});
await page.locator("#sidebar-fixed .tasful-brand-icon").screenshot({
  path: `${dir}/sidebar-globe-only-1280.png`,
});

const checks = {
  httpOk: res?.status() === 200,
  noConsoleErrors: consoleErrors.length === 0,
  iconPresent: data.iconPresent,
  imgPresent: data.imgPresent,
  globeSrcOk: data.imgSrc?.includes("tasful-brand-globe-sidebar.png"),
  bgTransparent: data.bgTransparent,
  noPurpleGradient: data.noPurpleGradient,
  noCircleRadius: data.noCircleRadius,
  noBoxShadow: data.noBoxShadow,
  iconSizeOk: data.iconWidth === "56px" && data.iconHeight === "56px",
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ pass, checks, data, consoleErrors }, null, 2));
await browser.close();
process.exitCode = pass ? 0 : 1;
