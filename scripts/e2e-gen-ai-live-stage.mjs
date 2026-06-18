/**
 * Live2D風画像アニメ E2E
 * npm run dev 後: node scripts/e2e-gen-ai-live-stage.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.GEN_AI_TEST_URL || "http://127.0.0.1:5173";
const charMode = encodeURIComponent("マイAIキャラ作成");
const imagePath = join(root, "images", "ai-character.webp");
const tinyImage = `data:image/webp;base64,${readFileSync(join(root, "images", "ai-character.webp")).toString("base64")}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", async (d) => d.accept());

  try {
    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${charMode}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.setStageRendererMode), {
      timeout: 20000,
    });

    await page.evaluate((dataUrl) => {
      const c = {
        id: "char_live_test",
        name: "ライブテスト",
        imageData: dataUrl,
        mouthX: 50,
        mouthY: 48,
        mouthScale: 1.1,
      };
      const list = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]").filter(
        (x) => x.id !== c.id
      );
      list.push(c);
      localStorage.setItem("tasu_genai_my_characters", JSON.stringify(list));
      localStorage.setItem("tasu_genai_active_character", c.id);
    }, tinyImage);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.setStageRendererMode));

    await page.locator('[data-gen-ai-stage-renderer="live"]').click();
    await page.waitForFunction(
      () => window.TasuGenAiWorkspace?.getStageRendererMode?.() === "live",
      { timeout: 5000 }
    );
    record("画像アニメモード", true);

    const liveVisible = await page.locator("[data-gen-ai-stage-layer-live]").isVisible();
    const liveSrc = await page.locator("[data-gen-ai-char-live-img]").getAttribute("src");
    record("アップロード画像表示", liveVisible && liveSrc?.startsWith("data:"), liveSrc?.slice(0, 40));

    const breathe = await page.evaluate(() =>
      Boolean(getComputedStyle(document.querySelector("[data-gen-ai-stage-live-breathe]")).animationName !== "none")
    );
    record("呼吸アニメーション", breathe);

    await page.evaluate(() => window.TasuGenAiWorkspace.setMouthSpeaking(true));
    const mouthSpeaking = await page.locator("[data-character-mouth].is-speaking").isVisible();
    record("読み上げ口パク", mouthSpeaking);

    await page.evaluate(() => {
      window.TasuGenAiWorkspace.setMouthSpeaking(false);
      const stage = document.querySelector("[data-ai-character-stage]");
      stage?.classList.add("is-live-blink");
    });
    await page.waitForTimeout(200);
    const blinkActive = await page.evaluate(() => {
      const stage = document.querySelector("[data-ai-character-stage]");
      const el = document.querySelector("[data-gen-ai-char-blink-left]");
      if (!stage || !el) return { hasClass: false, opacity: "0" };
      return {
        hasClass: stage.classList.contains("is-live-blink"),
        opacity: getComputedStyle(el).opacity,
      };
    });
    record(
      "まばたきオーバーレイ",
      blinkActive.hasClass && Number(blinkActive.opacity) > 0.5,
      JSON.stringify(blinkActive)
    );

    await page.locator('[data-gen-ai-stage-renderer="2d"]').click();
    const mode2d = await page.evaluate(() => window.TasuGenAiWorkspace.getStageRendererMode());
    record("2D切替", mode2d === "2d");

    await page.locator('[data-gen-ai-stage-renderer="3d"]').click();
    const mode3d = await page.evaluate(() => window.TasuGenAiWorkspace.getStageRendererMode());
    const canvasVisible = await page.locator("[data-gen-ai-char-3d-canvas]").isVisible();
    record("3D切替", mode3d === "3d" && canvasVisible);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-gen-ai-stage-renderer="live"]').click();
    const box = await page.locator(".ai-character-stage__visual-stack").boundingBox();
    record("モバイル表示", box && box.width > 80, `${box ? Math.round(box.width) : 0}px`);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nTotal: ${results.length}, Failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
