/**
 * VRM PoC スモークテスト（Vite dev 起動済み: http://localhost:5173）
 * npx playwright install chromium の後に実行
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = process.env.VITE_DEV_URL || "http://localhost:5173";
const TIMEOUT_MS = 90000;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${BASE}/gen-ai-workspace.html`, {
    waitUntil: "networkidle",
    timeout: TIMEOUT_MS,
  });

  const charTool = page.locator("[data-welcome-tools] button, [data-welcome-tools] a").filter({
    hasText: "AIキャラ会話",
  });
  await charTool.first().click({ timeout: 15000 });
  await page.waitForSelector("[data-gen-ai-character-panel]:not([hidden])", {
    timeout: 15000,
  });

  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForSelector("[data-gen-ai-char-3d-canvas]:not([hidden])", {
    timeout: 15000,
  });

  await page.click("[data-gen-ai-vrm-load-sample]");

  try {
    await page.waitForFunction(
      () =>
        window.GenAiCharacterVrm?.inspectActive?.()?.expressionCount > 0 &&
        window.GenAiCharacterVrm?.getActiveController?.()?.state?.vrm,
      { timeout: TIMEOUT_MS }
    );
  } catch {
    const debug = await page.evaluate(() => ({
      hasVrmApi: Boolean(window.GenAiCharacterVrm),
      loadError: window.__genAiVrmLastLoadError,
      inspect: window.GenAiCharacterVrm?.inspectActive?.(),
      status: document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent,
      note: document.querySelector("[data-gen-ai-vrm-poc-note]")?.textContent,
      backend: window.__genAi3dBackend,
    }));
    console.error("Debug state:", JSON.stringify(debug, null, 2));
    console.error("Page errors:", errors);
    throw new Error("VRM did not load in time");
  }

  const report = await page.evaluate(() => {
    const r = window.GenAiCharacterVrm?.inspectActive?.();
    return {
      report: r,
      status: document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent,
      note: document.querySelector("[data-gen-ai-vrm-poc-note]")?.textContent,
    };
  });

  await browser.close();

  if (errors.length) {
    console.error("Page errors:", errors.slice(0, 10));
  }

  if (!report.report?.expressionCount) {
    console.error("FAIL: VRM not loaded", report);
    process.exit(1);
  }

  console.log("PASS: VRM sample loaded");
  console.log("  expressions:", report.report.expressionCount);
  console.log("  lipSync:", report.report.lipSyncCapable);
  console.log("  blink:", report.report.hasBlink);
  console.log("  status:", report.status);
  if (errors.length) {
    console.warn("  warnings:", errors.length, "console/page errors (non-fatal if PASS)");
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
