import { chromium } from "playwright";
import fs from "fs";

const URL = "http://127.0.0.1:8788/ai-workspace/";
const dir = "screenshots/ai-workspace-hero-revert";
fs.mkdirSync(dir, { recursive: true });

const viewports = [
  { w: 1280, h: 900, n: "1280" },
  { w: 768, h: 1024, n: "768" },
  { w: 390, h: 844, n: "390" },
];

const browser = await chromium.launch();
const results = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const res = await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".ai-ref-hero", { timeout: 30000 });

  const data = await page.evaluate(() => {
    const hero = document.querySelector(".ai-ref-hero");
    const title = document.querySelector(".ai-ref-hero__title");
    const lead = document.querySelector(".ai-ref-hero__lead");
    const sub = document.querySelector(".ai-ref-hero__sub");
    const welcome = document.querySelector("#welcome-screen");
    const titleStyle = title ? getComputedStyle(title) : null;
    const leadStyle = lead ? getComputedStyle(lead) : null;
    const welcomeStyle = welcome ? getComputedStyle(welcome) : null;

    return {
      heroHtml: hero?.innerHTML?.replace(/\s+/g, " ").trim() ?? "",
      hasBrandLine: !!document.querySelector(".ai-ref-hero__brand-line"),
      hasLogo: !!document.querySelector(".ai-ref-hero__logo"),
      hasSparkles: !!document.querySelector(".ai-ref-hero__sparkles"),
      hasCard: !!document.querySelector(".ai-ref-hero__card"),
      titleText: title?.textContent?.trim() ?? "",
      leadText: lead?.textContent?.trim() ?? "",
      subText: sub?.textContent?.trim() ?? "",
      titleFontSize: titleStyle?.fontSize ?? null,
      leadFontSize: leadStyle?.fontSize ?? null,
      titleHasGradientText:
        titleStyle?.webkitTextFillColor === "rgba(0, 0, 0, 0)" ||
        titleStyle?.color === "rgba(0, 0, 0, 0)",
      welcomeMaxWidth: welcomeStyle?.maxWidth ?? null,
      composerPresent: !!document.querySelector("[data-ai-composer-frame]"),
    };
  });

  await page.locator(".ai-ref-hero").screenshot({ path: `${dir}/hero-${vp.n}.png` });

  const checks = {
    noBrandLine: !data.hasBrandLine,
    noLogo: !data.hasLogo,
    noSparkles: !data.hasSparkles,
    noCard: !data.hasCard,
    titleTextOk: data.titleText === "TASFUL AI",
    leadTextOk: data.leadText === "何をお手伝いしますか？",
    subTextOk: data.subText === "仕事も検索も資料作成も、このAIひとつで。",
    composerPresent: data.composerPresent,
    httpOk: res?.status() === 200,
    noConsoleErrors: consoleErrors.length === 0,
  };

  if (vp.n === "1280") {
    checks.titleSizeOk = data.titleFontSize === "57px";
    checks.leadSizeOk = data.leadFontSize === "29px";
    checks.welcomeMaxWidthOk = data.welcomeMaxWidth === "920px";
    checks.titleGradientOk = data.titleHasGradientText;
  }

  const pass = Object.values(checks).every(Boolean);

  results.push({
    viewport: vp.n,
    http: res?.status(),
    pass,
    checks,
    data,
    consoleErrors,
  });

  await page.close();
}

await browser.close();

console.log(JSON.stringify({ pass: results.every((r) => r.pass), results }, null, 2));
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
