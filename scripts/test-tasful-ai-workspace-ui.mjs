#!/usr/bin/env node
import { chromium } from "./lib/playwright-browser.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const outDir = join(root, "screenshots/tasful-ai-workspace-final");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let fails = 0;
function ok(name, cond) {
  if (!cond) {
    console.log("FAIL:", name);
    fails++;
  } else {
    console.log("OK:", name);
  }
}

async function resetPage(page) {
  await page.goto(`${BASE}/ai-workspace.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("tasu_ai_chat_") || key.startsWith("tasu_ai_workspace_"))) {
        sessionStorage.removeItem(key);
      }
    }
  });
  await page.reload({ waitUntil: "networkidle" });
}

async function selectTool(page, toolId) {
  await page.locator("[data-tga-mode-toggle]").click();
  await page.locator(`[data-tga-workspace-tool][data-tool="${toolId}"]`).click();
}

async function sendQuery(page, text) {
  await page.locator("[data-ai-chat-input]").fill(text);
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForSelector(".user-bubble-row", { timeout: 15000 });
  await page.waitForSelector(".ai-msg-row .ai-cross-card, .ai-msg-row .ai-search-summary, .ai-msg-row .ai-hybrid-section", {
    timeout: 20000,
  });
}

for (const vp of [
  { w: 1280, h: 900, tag: "pc1280" },
  { w: 390, h: 844, tag: "sp390" },
]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));

  await resetPage(page);
  ok(`${vp.tag} welcome`, (await page.locator("#welcome-screen:not([hidden])").count()) === 1);
  ok(`${vp.tag} no welcome cards`, (await page.locator(".welcome-card, [data-tga-welcome-card]").count()) === 0);
  ok(`${vp.tag} starter chips`, (await page.locator("[data-tga-starter-chip]").count()) === 6);
  ok(`${vp.tag} welcome lead`, (await page.locator(".welcome-lead").textContent())?.includes("音声相談まで"));
  ok(`${vp.tag} input in viewport`, await page.evaluate(() => {
    const input = document.querySelector("[data-ai-chat-input]");
    if (!input) return false;
    const rect = input.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }));
  ok(`${vp.tag} mode label`, (await page.locator("[data-tga-mode-label]").textContent()) === "AI相談");
  ok(`${vp.tag} image btn`, (await page.locator("#image-btn").count()) === 1);

  await page.locator("[data-tga-starter-chip]").first().click();
  ok(`${vp.tag} chip fills input`, await page.evaluate(() =>
    document.querySelector("[data-ai-chat-input]")?.value?.includes("草刈り")
  ));

  await page.screenshot({ path: join(outDir, `welcome-${vp.tag}.png`), fullPage: false });

  if (vp.w === 390) {
    await page.locator("[data-tga-history-toggle]").click({ force: true });
    ok("sp drawer", (await page.locator("#sidebar-fixed.is-open").count()) === 1);
    await page.locator("[data-tga-sidebar-backdrop]").click();
  }

  await selectTool(page, "consult");
  await sendQuery(page, "草刈り業者を探したい");
  ok(`${vp.tag} AI相談 cards`, (await page.locator(".ai-cross-card").count()) >= 1);
  ok(`${vp.tag} inquiry collapse`, (await page.locator(".ai-cross-draft-panel").count()) >= 1);

  await resetPage(page);
  await selectTool(page, "tasful");
  await sendQuery(page, "草刈り業者を探したい");
  ok(`${vp.tag} TASFUL内 cards`, (await page.locator(".ai-cross-card").count()) >= 1);
  ok(`${vp.tag} TASFUL内 no summary`, (await page.locator(".ai-search-summary").count()) === 0);

  await resetPage(page);
  await selectTool(page, "web");
  await sendQuery(page, "外壁塗装の相場を教えて");
  ok(`${vp.tag} web summary`, (await page.locator(".ai-search-summary").count()) >= 1);

  await resetPage(page);
  await selectTool(page, "both");
  await sendQuery(page, "草刈り業者を探したい");
  ok(`${vp.tag} both hybrid`, (await page.locator(".ai-hybrid-section").count()) >= 1);
  ok(`${vp.tag} both summary`, (await page.locator(".ai-search-summary").count()) >= 1);

  await page.screenshot({ path: join(outDir, `chat-${vp.tag}.png`), fullPage: false });
  ok(`${vp.tag} no js errors`, pageErrors.length === 0);
  await page.close();
}

await browser.close();
writeFileSync(join(outDir, "result.txt"), fails ? `FAILED ${fails}` : "ALL PASSED");
console.log(fails ? `FAILED ${fails}` : "ALL PASSED");
process.exit(fails ? 1 : 0);
