/**
 * 建設ツール — パンくず導線テスト
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788/builder/";
const TOOLS = [
  { file: "tool-manpower-calculator", label: "人工計算" },
  { file: "tool-material-calculator", label: "材料計算" },
  { file: "tool-profit-calculator", label: "粗利計算" },
  { file: "tool-estimate-helper", label: "見積補助" },
  { file: "tool-ai-estimate", label: "AI見積作成" },
  { file: "tool-ai-cost-analysis", label: "AI原価分析" },
  { file: "tool-ai-quantity-support", label: "AI積算補助" },
  { file: "tool-ai-schedule-suggest", label: "AI工程提案" },
];

let passed = 0;
let failed = 0;

function pass(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

async function readCrumb(page) {
  return page.evaluate(() => {
    const nav = document.querySelector("[data-breadcrumb]");
    if (!nav || nav.hidden) return { labels: [], links: [], text: "" };
    const labels = [];
    const links = [];
    nav.querySelectorAll("a, .tasu-common-breadcrumb__current").forEach((el) => {
      const t = el.textContent.trim();
      if (!t) return;
      labels.push(t);
      if (el.tagName === "A") {
        links.push({ label: t, href: el.getAttribute("href") || "" });
      } else {
        links.push({ label: t, href: null });
      }
    });
    return { labels, links, text: nav.innerText.replace(/\s+/g, " ").trim() };
  });
}

function assertTrail(crumb, toolLabel, ctx) {
  const expect = ["Builder", "建設ツール", toolLabel];
  if (JSON.stringify(crumb.labels) !== JSON.stringify(expect)) {
    fail(`${ctx} labels: ${crumb.labels.join(" > ")} (expected ${expect.join(" > ")})`);
    return false;
  }
  if (crumb.text.includes("現在地")) {
    fail(`${ctx} contains 現在地: ${crumb.text}`);
    return false;
  }
  const anchorLinks = crumb.links.filter((l) => l.href);
  if (anchorLinks.length !== 2) {
    fail(`${ctx} link count ${anchorLinks.length}`);
    return false;
  }
  if (!anchorLinks[0].href.includes("builder-top")) {
    fail(`${ctx} Builder href: ${anchorLinks[0].href}`);
    return false;
  }
  if (!anchorLinks[1].href.includes("construction-tools")) {
    fail(`${ctx} 建設ツール href: ${anchorLinks[1].href}`);
    return false;
  }
  pass(`${ctx}: ${crumb.text}`);
  return true;
}

await withPlaywrightBrowser(async (browser) => {
  for (const width of [390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(`${BASE}construction-tools`, { waitUntil: "networkidle", timeout: 60000 });
    await page.click('a[href="tool-manpower-calculator.html"]');
    await page.waitForLoadState("networkidle");

    const crumb = await readCrumb(page);
    assertTrail(crumb, "人工計算", `${width}px hub→人工計算`);

    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    if (scroll) fail(`${width}px horizontal scroll`);
    else pass(`${width}px no horizontal scroll`);

    if (errors.length) errors.forEach((e) => fail(`${width}px console: ${e}`));
    else pass(`${width}px no console errors`);

    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const tool of TOOLS) {
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${BASE}${tool.file}`, { waitUntil: "networkidle", timeout: 60000 });
    const crumb = await readCrumb(page);
    assertTrail(crumb, tool.label, `1440px ${tool.label}`);
    if (errors.length) errors.forEach((e) => fail(`1440px ${tool.label} console: ${e}`));
  }
  await page.close();
});

await closeAllBrowsers();

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
