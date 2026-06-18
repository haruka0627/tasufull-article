import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 画像キャラ設定自動生成 — ブラウザ実機相当 E2E（Playwright）
 *
 * 実行: npm run dev を別ターミナルで起動後
 *   node scripts/e2e-genai-image-character.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.GEN_AI_TEST_URL || "http://127.0.0.1:5173";
const imagePath = join(root, "images", "ai-character.webp");
const charMode = encodeURIComponent("画像キャラ化AI");
const chatMode = encodeURIComponent("AIキャラ会話");
const genericMode = encodeURIComponent("汎用チャット");

const results = [];
let lastGeminiPayload = null;
let lastAnalyzeCalls = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitWorkspace(page) {
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.analyzeCharacterImage), {
    timeout: 25000,
  });
}

async function getUsage(page) {
  return page.evaluate(() => {
    const u = JSON.parse(localStorage.getItem("tasu_genai_usage") || "{}");
    const header = document.querySelector("[data-gen-ai-usage-header]")?.textContent || "";
    const image = Number(header.match(/画像残り (\d+)/)?.[1]);
    return {
      imageCharacterUsed: Number(u.imageCharacterUsed) || 0,
      imageRemaining: image,
      header,
    };
  });
}

async function setHighImageQuota(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "tasu_genai_plan",
      JSON.stringify({
        plan: "pro_980",
        label: "生成AIプロ",
        dailyTextLimit: 100,
        dailyVoiceLimit: 100,
        dailyImageLimit: 30,
        status: "active",
      })
    );
    localStorage.setItem(
      "tasu_genai_usage",
      JSON.stringify({
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date()),
        textChatUsed: 0,
        voiceChatUsed: 0,
        imageCharacterUsed: 0,
      })
    );
    window.TasuGenAiWorkspace?.updateGenAiUsageUi?.();
  });
}

async function readForm(page) {
  return page.evaluate(() => ({
    name: document.querySelector("[data-gen-ai-char-name]")?.value || "",
    nameKana: document.querySelector("[data-gen-ai-char-name-kana]")?.value || "",
    personality: document.querySelector("[data-gen-ai-char-personality]")?.value || "",
    speaking: document.querySelector("[data-gen-ai-char-speaking]")?.value || "",
    firstPerson: document.querySelector("[data-gen-ai-char-first-person]")?.value || "",
    userCall: document.querySelector("[data-gen-ai-char-user-call]")?.value || "",
    userCallKana: document.querySelector("[data-gen-ai-char-user-call-kana]")?.value || "",
    appearance: document.querySelector("[data-gen-ai-char-appearance]")?.value || "",
    purpose: document.querySelector("[data-gen-ai-char-purpose]")?.value || "",
    hasImage: Boolean(
      document.querySelector("[data-gen-ai-char-image-preview]") &&
        !document.querySelector("[data-gen-ai-char-image-preview]")?.hidden
    ),
    analyzeStatus: document.querySelector("[data-gen-ai-char-analyze-status]")?.textContent || "",
    modeAnalyzeStatus:
      document.querySelector("[data-gen-ai-char-mode-analyze-status]")?.textContent || "",
  }));
}

async function readSavedCharacter(page) {
  return page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const activeId = localStorage.getItem("tasu_genai_active_character") || "";
    const saved = list.find((c) => c.id === activeId) || list[list.length - 1];
    return saved || null;
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext();
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  page.on("request", (req) => {
    if (req.url().includes("gemini-image-character-analyze")) lastAnalyzeCalls += 1;
  });

  await page.route("**/functions/v1/gemini-chat", async (route) => {
    try {
      lastGeminiPayload = route.request().postDataJSON();
    } catch {
      lastGeminiPayload = null;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "わかりました。そういうときは気楽に話しかけてくださいね。",
        usedGemini: true,
        retryCount: 0,
        intent: "chat",
      }),
    });
  });

  try {
    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${charMode}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await waitWorkspace(page);
    await setHighImageQuota(page);

    const apiReady = await page.evaluate(() => window.TasuGenAiWorkspace?.isImageAnalyzeConfigured?.());
    record("画像解析 API 設定", apiReady, apiReady ? "" : "Supabase URL/anonKey");

    const usage0 = await getUsage(page);
    record("利用回数ヘッダー表示", usage0.imageRemaining >= 0, usage0.header);

    const fileInput = page.locator("[data-gen-ai-file]");
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(1500);

    const previewVisible = await page.locator("[data-gen-ai-char-mode-preview]").isVisible();
    record("画像プレビュー表示", previewVisible);

    const analyzeBtn = page.locator("[data-gen-ai-char-mode-analyze-btn]");
    record("見た目メモボタン有効", await analyzeBtn.isEnabled());

    await analyzeBtn.click();
    await page.waitForFunction(
      (before) => {
        const u = JSON.parse(localStorage.getItem("tasu_genai_usage") || "{}");
        const used = Number(u.imageCharacterUsed) || 0;
        const t = document.querySelector("[data-gen-ai-char-mode-analyze-status]")?.textContent || "";
        return used > before && t.includes("見た目メモ");
      },
      usage0.imageCharacterUsed,
      { timeout: 90000 }
    );
    const afterAppearance = await readForm(page);
    const usage1 = await getUsage(page);
    const appearanceOk = usage1.imageCharacterUsed === usage0.imageCharacterUsed + 1;
    record("見た目メモ生成", appearanceOk, afterAppearance.modeAnalyzeStatus || `used=${usage1.imageCharacterUsed}`);

    const seedBtn = page.locator("[data-gen-ai-char-mode-seed-btn]");
    await seedBtn.click();
    await page.waitForFunction(
      () => {
        const t = document.querySelector("[data-gen-ai-char-mode-analyze-status]")?.textContent || "";
        return t.includes("キャラ設定案を生成");
      },
      { timeout: 90000 }
    );
    const usage2 = await getUsage(page);
    record(
      "同一画像で seed 連続（二重消費なし）",
      usage2.imageCharacterUsed === usage1.imageCharacterUsed,
      `used ${usage2.imageCharacterUsed}`
    );

    await page.locator("[data-gen-ai-char-from-image-btn]").click();
    await page.waitForSelector("[data-gen-ai-my-character-panel]:not([hidden])", {
      timeout: 10000,
    });
    await page.waitForTimeout(800);

    const form1 = await readForm(page);
    const formFilled =
      form1.name.length > 0 &&
      form1.nameKana.length > 0 &&
      form1.personality.length > 0 &&
      form1.speaking.length > 0 &&
      form1.firstPerson.length > 0 &&
      form1.appearance.length > 10 &&
      form1.purpose.length > 0 &&
      form1.hasImage;
    record("フォーム自動反映（全項目）", formFilled, JSON.stringify(form1).slice(0, 120));

    const sampleSeed = { ...form1 };

    await page.locator("[data-gen-ai-char-name]").fill("手動既存名");
    await page.locator("[data-gen-ai-char-overwrite-ai]").setChecked(false);
    const usageBeforeFormSeed = await getUsage(page);
    await page.locator("[data-gen-ai-char-seed-btn]").click();
    await page.waitForTimeout(5000);
    const formNoOverwrite = await readForm(page);
    record(
      "上書きOFFで既存名維持",
      formNoOverwrite.name === "手動既存名",
      formNoOverwrite.name
    );
    const usageAfterFormSeed = await getUsage(page);
    record(
      "フォーム再 seed で二重消費なし",
      usageAfterFormSeed.imageCharacterUsed === usageBeforeFormSeed.imageCharacterUsed,
      `used ${usageAfterFormSeed.imageCharacterUsed}`
    );

    await page.locator("[data-gen-ai-char-overwrite-ai]").setChecked(true);
    await page.locator("[data-gen-ai-char-seed-btn]").click();
    await page.waitForTimeout(5000);
    const formOverwrite = await readForm(page);
    record(
      "上書きONで名前更新",
      formOverwrite.name !== "手動既存名" && formOverwrite.name.length > 0,
      formOverwrite.name
    );

    const uniqueName = `E2Eキャラ${Date.now().toString().slice(-6)}`;
    await page.locator("[data-gen-ai-char-name]").fill(uniqueName);
    if (!formOverwrite.personality) {
      await page.locator("[data-gen-ai-char-personality]").fill("穏やかで優しい");
    }
    if (!formOverwrite.speaking) {
      await page.locator("[data-gen-ai-char-speaking]").fill("やわらかい口調");
    }
  if (!formOverwrite.firstPerson) {
      await page.locator("[data-gen-ai-char-first-person]").fill("私");
    }

    await page.locator("[data-gen-ai-char-save]").click();
    await page.waitForFunction(
      (name) => {
        const status = document.querySelector("[data-gen-ai-char-status]")?.textContent || "";
        return status.includes("保存しました");
      },
      uniqueName,
      { timeout: 10000 }
    );

    const saved = await readSavedCharacter(page);
    const saveMeta =
      saved &&
      saved.name === uniqueName &&
      saved.imageAnalyzed &&
      saved.characterSeedGenerated &&
      saved.appearanceSource === "ai" &&
      saved.characterSeedSource === "ai" &&
      (saved.imageData || saved.imageUrl);
    record("保存データ（メタ含む）", Boolean(saveMeta), saved ? saved.name : "none");

    const usageAfterSave = await getUsage(page);
    record(
      "解析済み保存で二重消費なし",
      usageAfterSave.imageCharacterUsed === usage2.imageCharacterUsed,
      `used ${usageAfterSave.imageCharacterUsed}`
    );

    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${chatMode}`, {
      waitUntil: "networkidle",
    });
    await waitWorkspace(page);
    await page.selectOption("[data-gen-ai-character-select]", { label: uniqueName }).catch(async () => {
      await page.evaluate((name) => {
        const sel = document.querySelector("[data-gen-ai-character-select]");
        if (!sel) return;
        const opt = Array.from(sel.options).find((o) => o.textContent === name);
        if (opt) sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }, uniqueName);
    });
    await page.waitForTimeout(500);

    const stageName = await page.locator("[data-gen-ai-stage-char-name]").textContent();
    record("会話画面でキャラ名表示", (stageName || "").includes(uniqueName), stageName || "");

    const imgSrc = await page.locator("[data-ai-character-img]").getAttribute("src");
    record(
      "会話画面でキャラ画像",
      Boolean(imgSrc && (imgSrc.startsWith("data:") || imgSrc.includes("http"))),
      imgSrc?.slice(0, 40)
    );

    lastGeminiPayload = null;
    await page.locator("[data-gen-ai-input]").fill("今日は少し疲れたんだ");
    await page.locator("[data-gen-ai-send]").click();
    await page.waitForTimeout(2000);

    const geminiChar = lastGeminiPayload?.character;
    const geminiReflect =
      geminiChar &&
      String(geminiChar.appearance || "").length > 5 &&
      (geminiChar.personality || geminiChar.speakingStyle || geminiChar.firstPerson);
    record(
      "Gemini payload にキャラ設定反映",
      Boolean(geminiReflect),
      geminiChar
        ? `appearance=${(geminiChar.appearance || "").slice(0, 40)}…`
        : "no payload"
    );

    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${genericMode}`, {
      waitUntil: "networkidle",
    });
    await waitWorkspace(page);
    lastGeminiPayload = null;
    await page.locator("[data-gen-ai-input]").fill("こんにちは");
    await page.locator("[data-gen-ai-send]").click();
    await page.waitForTimeout(1500);
    record(
      "汎用チャット（character null）",
      lastGeminiPayload?.character === null,
      lastGeminiPayload ? String(lastGeminiPayload.character) : "ok"
    );

    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${charMode}`, {
      waitUntil: "networkidle",
    });
    await waitWorkspace(page);
    await setHighImageQuota(page);
    const disabledNoImage = await page.locator("[data-gen-ai-char-mode-analyze-btn]").isDisabled();
    record("画像なしで解析ボタン無効", disabledNoImage);

    await page.goto(`${baseUrl}/gen-ai-workspace.html?mode=${charMode}`, {
      waitUntil: "networkidle",
    });
    await waitWorkspace(page);
    await setHighImageQuota(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "tasu_genai_usage",
        JSON.stringify({
          date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date()),
          textChatUsed: 0,
          voiceChatUsed: 0,
          imageCharacterUsed: 30,
        })
      );
      localStorage.setItem(
        "tasu_genai_plan",
        JSON.stringify({
          plan: "pro_980",
          dailyImageLimit: 30,
          dailyTextLimit: 100,
          dailyVoiceLimit: 100,
          status: "active",
        })
      );
      window.TasuGenAiWorkspace?.updateGenAiUsageUi?.();
    });
    const disabledLimit = await page.locator("[data-gen-ai-char-mode-analyze-btn]").isDisabled();
    record("上限時解析ボタン無効", disabledLimit);

    const mouthSlider = await page.locator("[data-gen-ai-char-mouth-x]").count();
    record("口位置スライダー存在", mouthSlider > 0, "2D口パク UI");

    console.log("\n--- 自動生成例 ---");
    console.log("キャラ名:", sampleSeed.name || formOverwrite?.name);
    console.log("見た目:", (saved?.appearanceMemo || sampleSeed.appearance || "").slice(0, 120));
    console.log("性格:", saved?.personality || sampleSeed.personality);
    console.log("保存:", saved);

    const failed = results.filter((r) => !r.ok).length;
    console.log(`\nTotal: ${results.length}, Failed: ${failed}`);
    await closeAllBrowsers();
    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error("E2E error:", err);
    record("E2E 実行", false, err.message);
    await closeAllBrowsers();
    process.exit(1);
  }  });
  
}

main();
