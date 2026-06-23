/**
 * TASFUL root TOP routing check — Local / Preview / Production
 * Usage: node scripts/tmp-tasful-root-top-check.mjs [--base URL]
 */
import { chromium } from "playwright";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const base =
  baseArg?.slice("--base=".length) ||
  (await findDevServerBaseUrl({ probePath: "index.html" }));

async function probe(path, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const body = await page.evaluate(() => ({
    title: document.title,
    isAccess: document.title.includes("Cloudflare Access"),
    topPage: document.body.classList.contains("top-page"),
    homePage: document.body.classList.contains("home-page"),
    marketPage: document.body.classList.contains("tasful-market-page"),
    hasTasHero: Boolean(document.querySelector(".tas-hero")),
    hasHomeHero: Boolean(document.querySelector(".home-hero")),
    finalPath: window.location.pathname,
  }));

  await browser.close();
  return {
    label,
    url,
    status: res?.status() ?? 0,
    ...body,
  };
}

const checks = [
  await probe("/", "root /"),
  await probe("/index-top", "index-top clean"),
  await probe("/market/", "market home"),
  await probe("/shop-store", "shop-store MARKET TOP"),
];

const summary = {
  base,
  capturedAt: new Date().toISOString(),
  checks,
  pass:
    checks[0].topPage &&
    checks[0].hasTasHero &&
    !checks[0].homePage &&
    checks[2].homePage &&
    checks[3].marketPage,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
