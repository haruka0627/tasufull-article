/**
 * 生成AI 3Dステージ — Playwright E2E
 * npm run dev 起動後: node scripts/e2e-gen-ai-3d.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.GEN_AI_TEST_URL || "http://127.0.0.1:5173";
const chatMode = encodeURIComponent("AIキャラ会話");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("dialog", async (d) => d.accept());

  await page.route("**/functions/v1/gemini-chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "わぁ、すごいですね！嬉しいです。",
        usedGemini: true,
        intent: "chat",
      }),
    });
  });

  try {
    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${chatMode}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForFunction(() => Boolean(window.GenAiCharacter3D?.setRendererMode), {
      timeout: 20000,
    });

    record("GenAiCharacter3D API", true);

    const stageVisible = await page.locator("[data-ai-character-stage]").isVisible();
    record("キャラステージ表示", stageVisible);

    const toggle2d = page.locator('[data-gen-ai-stage-renderer="2d"]');
    const toggle3d = page.locator('[data-gen-ai-stage-renderer="3d"]');
    record("2D/3D切替ボタン", (await toggle2d.count()) > 0 && (await toggle3d.count()) > 0);

    await toggle3d.click();
    await page.waitForFunction(
      () => window.GenAiCharacter3D?.getRendererMode?.() === "3d",
      { timeout: 5000 }
    );
    record("3Dモード切替", true);

    const canvas = page.locator("[data-gen-ai-char-3d-canvas]");
    await page.waitForTimeout(2500);
    const canvasVisible = await canvas.isVisible();
    record("3D Canvas 表示", canvasVisible);

    const webgl = await page.evaluate(() => {
      const canvas = document.querySelector("[data-gen-ai-char-3d-canvas]");
      if (!canvas) return false;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return Boolean(gl);
    });
    record("WebGL コンテキスト", webgl);

    const modelKind = await page.evaluate(async () => {
      await window.GenAiCharacter3D?.setRendererMode?.("3d");
      await window.GenAiCharacter3D?.ensure3dMounted?.();
      await new Promise((r) => setTimeout(r, 3500));
      const el = document.querySelector("[data-gen-ai-stage-3d-status]");
      return { text: el?.textContent?.trim() || "", hidden: el?.hidden };
    });
    record(
      "3Dモデル読み込み表示",
      modelKind.text.length > 0 && !modelKind.hidden,
      modelKind.text || `hidden=${modelKind.hidden}`
    );

    await page.evaluate(() => {
      window.GenAiCharacter3D.syncSpeaking(true, false);
      window.GenAiCharacter3D.syncExpression("happy");
    });
    await page.waitForTimeout(400);
    record("口パク・表情API呼び出し", true);

    await toggle2d.click();
    await page.waitForFunction(
      () => window.GenAiCharacter3D?.getRendererMode?.() === "2d",
      { timeout: 5000 }
    );
    const layer2dVisible = await page.locator("[data-gen-ai-stage-layer-2d]").isVisible();
    const mouthExists = (await page.locator("[data-character-mouth]").count()) > 0;
    record("2Dへ戻す（2Dレイヤー・口パク）", layer2dVisible && mouthExists);

    const speakingSync = await page.evaluate(() => {
      window.TasuGenAiWorkspace?.setMouthSpeaking?.(true);
      const stage = document.querySelector("[data-ai-character-stage]")?.classList.contains("is-speaking");
      const mouth = document.querySelector("[data-character-mouth]")?.classList.contains("is-speaking");
      window.TasuGenAiWorkspace?.setMouthSpeaking?.(false);
      return { stage, mouth };
    });
    record(
      "is-speaking 連動（2D口パク）",
      speakingSync.stage && speakingSync.mouth,
      JSON.stringify(speakingSync)
    );

    await page.locator("[data-gen-ai-input]").fill("こんにちは");
    await page.locator("[data-gen-ai-send]").click();
    await page.waitForTimeout(800);
    record("Gemini返答送信", true);

    const exprAfterReply = await page.evaluate(() => {
      window.GenAiCharacter3D?.setRendererMode?.("3d");
      return window.GenAiCharacter3D?.inferExpressionFromText?.("わぁ、すごい！嬉しいです。");
    });
    record("返答トーン→表情推定", exprAfterReply === "happy" || exprAfterReply === "surprised", exprAfterReply);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mobileStack = await page.locator(".ai-character-stage__visual-stack").boundingBox();
    record(
      "モバイル表示（ステージ幅）",
      mobileStack && mobileStack.width > 100 && mobileStack.width <= 390,
      mobileStack ? `${Math.round(mobileStack.width)}px` : "no box"
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nTotal: ${results.length}, Failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
