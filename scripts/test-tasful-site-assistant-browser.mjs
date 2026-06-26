#!/usr/bin/env node
/**
 * Site Assistant Phase 1 — browser checks
 *   node scripts/test-tasful-site-assistant-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DIST = path.join(root, "deploy/cloudflare/dist");

function distUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(DIST, rel.replace(/^\//, ""))).href;
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /favicon|ERR_BLOCKED_BY_CLIENT|CORS|ERR_FAILED|supabase\.co|Failed to load resource|secretary-deepseek|api\.deepseek/i.test(
    t
  );
}

const results = [];
function assert(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  if (cond) console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
  else console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

const PAGES = ["index.html", "product.html", "talk-home.html"];

async function checkViewport(page, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const metrics = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    fab: !!document.querySelector("[data-tasu-site-fab]"),
  }));
  assert(`${vp.name}px no horizontal scroll`, metrics.scrollW <= metrics.clientW + 1, `sw=${metrics.scrollW} cw=${metrics.clientW}`);
  assert(`${vp.name}px fab visible`, metrics.fab);
}

async function main() {
  const consoleErrors = [];
  const badRequests = [];

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      const msg = String(err.message || err);
      if (!isIgnorableConsoleError(msg)) consoleErrors.push(msg);
    });
    page.on("request", (req) => {
      const url = req.url();
      if (/secretary-deepseek|api\.deepseek\.com/i.test(url)) {
        badRequests.push(url);
      }
    });

    for (const rel of PAGES) {
      await page.goto(distUrl(rel), { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction(
        () => window.TasuSiteAssistant && document.querySelector("[data-tasu-site-fab]"),
        null,
        { timeout: 15000 }
      );
      assert(`${rel} widget mounted`, true);
    }

    await page.goto(distUrl("index.html"), { waitUntil: "domcontentloaded" });
    for (const vp of VIEWPORTS) {
      await checkViewport(page, vp);
    }

    await page.click("[data-tasu-site-fab]");
    await page.waitForSelector("[data-tasu-site-panel]:not([hidden])", { timeout: 5000 });
    assert("panel opens", true);

    const initialCount = await page.locator("[data-tasu-site-log] .tasu-site-assist__msg").count();
    assert("initial messages", initialCount >= 1, `count=${initialCount}`);

    await page.fill("[data-tasu-site-input]", "会員登録したい");
    await page.click("[data-tasu-site-send]");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-tasu-site-log] .tasu-site-assist__msg--assistant").length >= 2,
      null,
      { timeout: 10000 }
    );
    const reply = await page.locator(".tasu-site-assist__msg--assistant").last().textContent();
    assert("chat reply uses cross-search nav", /会員登録|signup\.html/i.test(reply || ""));

    await page.click('.tasu-site-assist__quick-btn:has-text("問い合わせしたい")');
    await page.waitForFunction(
      () => document.querySelectorAll("[data-tasu-site-log] .tasu-site-assist__msg--user").length >= 2,
      null,
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => {
        const nodes = document.querySelectorAll("[data-tasu-site-log] .tasu-site-assist__msg--assistant");
        return nodes.length >= 2 && nodes[nodes.length - 1].textContent.length > 10;
      },
      null,
      { timeout: 15000 }
    );
    const contactReply = await page.locator(".tasu-site-assist__msg--assistant").last().textContent();
    assert("contact uses existing nav", /問い合わせ|contact/i.test(contactReply || ""));

    const adapterMode = await page.evaluate(() => window.TasuSiteAssistantAdapter?.MODE_ID);
    assert("adapter mode cross-matching", adapterMode === "cross-matching");

    const noSecretary = await page.evaluate(
      () => !window.TasuSecretaryDeepSeekAdapter && !window.TasuSecretaryOpsContextBuilder
    );
    assert("no AI secretary scripts", noSecretary);

    const noGateway = await page.evaluate(() => !window.TasuAiModelGateway);
    assert("no Gateway on embed", noGateway);
  });

  await closeAllBrowsers();

  assert("no deepseek/secretary network", badRequests.length === 0, badRequests.slice(0, 2).join(" | "));
  const filteredConsole = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  assert("console errors", filteredConsole.length === 0, filteredConsole.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  x ${f.name}: ${f.detail || ""}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
