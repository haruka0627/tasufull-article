import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/ai-workspace/";
const dir = "screenshots/ai-workspace-hero-gradient";
fs.mkdirSync(dir, { recursive: true });

const readTitleStyles = async (page) =>
  page.evaluate(() => {
    const title = document.querySelector(".ai-ref-hero__title");
    const lead = document.querySelector(".ai-ref-hero__lead");
    const sub = document.querySelector(".ai-ref-hero__sub");
    const titleStyle = title ? getComputedStyle(title) : null;
    const leadStyle = lead ? getComputedStyle(lead) : null;
    return {
      titleText: title?.textContent?.trim() ?? "",
      titleFontSize: titleStyle?.fontSize ?? null,
      titleAnimationName: titleStyle?.animationName ?? null,
      titleAnimationDuration: titleStyle?.animationDuration ?? null,
      titleAnimationTimingFunction: titleStyle?.animationTimingFunction ?? null,
      titleAnimationIterationCount: titleStyle?.animationIterationCount ?? null,
      titleBackgroundImage: titleStyle?.backgroundImage ?? null,
      titleBackgroundSize: titleStyle?.backgroundSize ?? null,
      titleBackgroundPosition: titleStyle?.backgroundPosition ?? null,
      titleWebkitClip: titleStyle?.webkitBackgroundClip ?? titleStyle?.backgroundClip ?? null,
      leadFontSize: leadStyle?.fontSize ?? null,
      leadColor: leadStyle?.color ?? null,
      subPresent: !!sub,
    };
  });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));

const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".ai-ref-hero__title", { timeout: 30000 });

const start = await readTitleStyles(page);
await page.screenshot({ path: `${dir}/hero-gradient-start.png` });
await page.waitForTimeout(3500);
const mid = await readTitleStyles(page);
await page.screenshot({ path: `${dir}/hero-gradient-mid.png` });
await page.waitForTimeout(3500);
const end = await readTitleStyles(page);
await page.screenshot({ path: `${dir}/hero-gradient-end.png` });

const posChanged =
  start.titleBackgroundPosition !== mid.titleBackgroundPosition ||
  mid.titleBackgroundPosition !== end.titleBackgroundPosition;

const checks = {
  httpOk: res?.status() === 200,
  noConsoleErrors: consoleErrors.length === 0,
  titleTextOk: start.titleText === "TASFUL AI",
  titleSizeOk: start.titleFontSize === "57px",
  leadSizeOk: start.leadFontSize === "29px",
  leadColorOk: start.leadColor === "rgb(17, 24, 39)",
  subUnchanged: start.subPresent,
  animationNameOk: start.titleAnimationName === "tasfulGradientFlow",
  animationDurationOk: parseFloat(start.titleAnimationDuration) >= 8 && parseFloat(start.titleAnimationDuration) <= 12,
  animationInfinite: start.titleAnimationIterationCount === "infinite",
  animationEaseInOut: start.titleAnimationTimingFunction.includes("ease-in-out"),
  gradientColorsOk:
    (start.titleBackgroundImage.includes("2563eb") ||
      start.titleBackgroundImage.includes("37, 99, 235")) &&
    (start.titleBackgroundImage.includes("7c3aed") ||
      start.titleBackgroundImage.includes("124, 58, 237")) &&
    (start.titleBackgroundImage.includes("a855f7") ||
      start.titleBackgroundImage.includes("168, 85, 247")),
  backgroundSizeOk: start.titleBackgroundSize === "300% 300%",
  textClipOk: start.titleWebkitClip === "text",
  backgroundPositionAnimating: posChanged,
};

const pass = Object.values(checks).every(Boolean);
console.log(
  JSON.stringify(
    {
      pass,
      checks,
      samples: { start, mid, end },
      consoleErrors,
    },
    null,
    2
  )
);

await browser.close();
process.exitCode = pass ? 0 : 1;
