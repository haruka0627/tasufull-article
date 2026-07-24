import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://127.0.0.1:8788";

const pages = [
  { path: "/materials/index.html", name: "materials-home" },
  { path: "/materials/list.html", name: "materials-list" },
  { path: "/materials/detail.html?slug=presentation-business", name: "materials-detail" },
];

const viewports = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

const indexTopHeader = fs.readFileSync(path.join(ROOT, "index-top.html"), "utf8");
const headerMatch = indexTopHeader.match(/<header class="top-site-header[\s\S]*?<\/header>/);
if (!headerMatch) throw new Error("index-top header missing");

function normalizeHeader(html) {
  return html
    .replace(/\bhref="index-top\.html"/g, 'href="/index-top.html"')
    .replace(/\bhref="(?!\/|#|https?:|mailto:)([^"]+)"/g, 'href="/$1"')
    .replace(/\bsrc="images\//g, 'src="/images/')
    .replace('<a href="#footerColGuide">ご利用ガイド</a>', '<a href="/help/">ご利用ガイド</a>')
    .replace(/\s+/g, " ")
    .trim();
}

const expectedHeaderNorm = normalizeHeader(headerMatch[0]);

await withPlaywrightBrowser(async (browser) => {
  const results = [];
  for (const pageDef of pages) {
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      const resp = await page.goto(`${BASE}${pageDef.path}`, { waitUntil: "networkidle", timeout: 60000 });
      const header = page.locator(".top-site-header.top-portal-header").first();
      await header.waitFor({ timeout: 15000 });
      const headerHtml = normalizeHeader(await header.evaluate((el) => el.outerHTML));
      const headerMatchOk = headerHtml === expectedHeaderNorm;
      const styles = await header.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          position: cs.position,
          background: cs.backgroundColor,
          minHeight: cs.minHeight,
          boxShadow: cs.boxShadow !== "none",
        };
      });
      const hasNav = (await page.locator(".top-portal-header__nav a").count()) >= 5;
      const hasLogin = (await page.locator(".top-portal-header__login").count()) === 1;
      const hasRegister = (await page.locator(".top-portal-header__register").count()) === 1;
      const hasHeroOrShell =
        (await page.locator(".materials-hero, .materials-shell").count()) > 0;
      results.push({
        page: pageDef.name,
        viewport: vp.name,
        httpStatus: resp?.status() ?? null,
        consoleErrors: errors.length,
        headerMatchOk,
        sticky: styles.position === "sticky",
        darkHeader: styles.background === "rgb(7, 23, 51)",
        hasNav,
        hasLogin,
        hasRegister,
        hasHeroOrShell,
        pass:
          resp?.status() === 200 &&
          errors.length === 0 &&
          headerMatchOk &&
          styles.position === "sticky" &&
          styles.background === "rgb(7, 23, 51)" &&
          hasNav &&
          hasLogin &&
          hasRegister &&
          hasHeroOrShell,
      });
      await page.close();
    }
  }
  const allPass = results.every((r) => r.pass);
  console.log(JSON.stringify({ allPass, results }, null, 2));
  if (!allPass) process.exitCode = 1;
});

await closeAllBrowsers();
