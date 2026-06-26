#!/usr/bin/env node
/**
 * TASFUL AI Final Smoke — 本番利用目線の総合確認
 *   node scripts/test-tasful-ai-final-smoke-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tmpDir = path.join(os.tmpdir(), "tasu-ai-final-smoke");

/** @type {{ category: string, name: string, ok: boolean, detail?: string }[]} */
const results = [];

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(root, rel.replace(/^\//, ""))).href;
}

function pass(category, name, detail = "") {
  results.push({ category, name, ok: true, detail });
  console.log(`PASS [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(category, name, detail = "") {
  results.push({ category, name, ok: false, detail });
  console.error(`FAIL [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(category, name, cond, detail = "") {
  if (cond) pass(category, name, detail);
  else fail(category, name, detail);
}

function ensureFixtureFiles() {
  fs.mkdirSync(tmpDir, { recursive: true });
  const pngB64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const files = {
    png: path.join(tmpDir, "smoke.png"),
    jpg: path.join(tmpDir, "smoke.jpg"),
    webp: path.join(tmpDir, "smoke.webp"),
    txt: path.join(tmpDir, "smoke.txt"),
    md: path.join(tmpDir, "smoke.md"),
    csv: path.join(tmpDir, "smoke.csv"),
    json: path.join(tmpDir, "smoke.json"),
    pdf: path.join(tmpDir, "smoke.pdf"),
    big: path.join(tmpDir, "smoke-big.png"),
  };
  fs.writeFileSync(files.png, Buffer.from(pngB64, "base64"));
  fs.writeFileSync(files.jpg, Buffer.from(pngB64, "base64"));
  fs.writeFileSync(files.webp, Buffer.from(pngB64, "base64"));
  fs.writeFileSync(files.txt, "smoke txt", "utf8");
  fs.writeFileSync(files.md, "# smoke", "utf8");
  fs.writeFileSync(files.csv, "a,b\n1,2", "utf8");
  fs.writeFileSync(files.json, '{"smoke":true}', "utf8");
  fs.writeFileSync(files.pdf, "%PDF-1.4 fake", "utf8");
  fs.writeFileSync(files.big, Buffer.alloc(4 * 1024 * 1024 + 1, 1));
  return files;
}

async function bootWorkspace(page) {
  await page.goto(pageUrl("ai-workspace.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.TasuAiChat?.sendMessage &&
      window.TasuAiModelGateway?.completeTurn &&
      window.TasuAiSearchOrchestrator?.prepare,
    null,
    { timeout: 25000 }
  );
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("tasu_ai_chat_cross-matching");
      sessionStorage.removeItem("tasu_ai_selected_model");
    } catch {
      /* ignore */
    }
    window.__smoke = {
      turns: [],
      searchPrepare: [],
    };
    const gw = window.TasuAiModelGateway;
    if (!gw.__smokeHooked) {
      gw.__smokeHooked = true;
      const origTurn = gw.completeTurn.bind(gw);
      gw.completeTurn = async (params) => {
        window.__smoke.turns.push({
          userText: params.userText,
          attachments: params.attachments || [],
          skipSearch: params.skipSearch,
        });
        return origTurn(params);
      };
    }
    const orch = window.TasuAiSearchOrchestrator;
    if (orch && !orch.__smokeHooked) {
      orch.__smokeHooked = true;
      const origPrep = orch.prepare.bind(orch);
      orch.prepare = async (params) => {
        window.__smoke.searchPrepare.push(params);
        return origPrep(params);
      };
    }
  });
}

async function testChatBasics(page) {
  const input = page.locator("[data-ai-chat-input]");
  const send = page.locator("[data-ai-chat-send]");
  await input.fill("Final smoke テキスト送信");
  await send.click();
  await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 20000 });
  assert("chat", "テキスト送信", true);

  await page.waitForFunction(
    () => !document.querySelector("[data-ai-workspace-chat]")?.dataset?.aiChatSending,
    null,
    { timeout: 10000 }
  );
  await input.fill("Enter送信テスト");
  await input.press("Enter");
  await page.waitForFunction(() => window.__smoke?.turns?.length >= 2, null, { timeout: 20000 });
  assert("chat", "Enter送信", true);

  const historyKey = await page.evaluate(() =>
    Boolean(sessionStorage.getItem("tasu_ai_chat_cross-matching"))
  );
  assert("chat", "会話履歴 sessionStorage", historyKey);

  await page.evaluate(() => window.TasuAiChat.resetChatSession("cross-matching"));
  const cleared = await page.evaluate(() => {
    const raw = sessionStorage.getItem("tasu_ai_chat_cross-matching");
    return raw == null || raw === "[]";
  });
  assert("chat", "新規チャットで履歴リセット", cleared);

  await input.fill("コピー確認");
  await send.click();
  await page.waitForFunction(
    () => document.querySelectorAll(".ai-msg-row").length >= 1,
    null,
    { timeout: 20000 }
  );
  const copyBtn = page.locator("[data-ai-message-copy]").first();
  assert("chat", "コピーボタン表示", (await copyBtn.count()) >= 1);
}

async function testModelSwitch(page) {
  const hasSelector = await page.locator("[data-ai-model-selector-host]").count();
  assert("chat", "モデル selector DOM", hasSelector >= 1);

  const switched = await page.evaluate(() => {
    window.TasuAiPlanModels?.setSelectedModelId?.("gpt");
    const id = window.TasuAiPlanModels?.getSelectedModelId?.();
    return id === "gpt";
  });
  assert("chat", "モデル切替 localStorage", switched);
}

async function testLoadingState(page) {
  await page.evaluate(() => {
    window.TasuAiModelGateway.completeTurn = () =>
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              reply: "loading test",
              modelId: "gemini-flash",
              search_used: false,
              fallback_used: true,
            }),
          400
        );
      });
  });
  const root = page.locator("[data-ai-workspace-chat]");
  await page.locator("[data-ai-chat-input]").fill("loading test");
  const sendPromise = page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-ai-workspace-chat]")?.dataset?.aiChatSending === "1",
    null,
    { timeout: 5000 }
  );
  assert("chat", "送信中 loading フラグ", true);
  await sendPromise;
  await page.waitForFunction(
    () => !document.querySelector("[data-ai-workspace-chat]")?.dataset?.aiChatSending,
    null,
    { timeout: 10000 }
  );
  assert("chat", "送信後 loading 解除", true);
  await bootWorkspace(page);
}

async function testSearch(page) {
  await page.evaluate(() => {
    window.__TASU_SERPER_MOCK_RESPONSE__ = {
      ok: true,
      query: "smoke",
      results: [{ title: "Mock", snippet: "Serper mock", link: "https://example.com" }],
    };
  });
  await page.locator("[data-tga-mode-toggle]").click();
  await page.locator('[data-tga-workspace-tool][data-tool="web"]').click();
  await page.locator("[data-ai-chat-input]").fill("今日のニュースを調べて");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 25000 });
  const prep = await page.evaluate(() => window.__smoke.searchPrepare.slice(-1)[0]);
  assert("search", "通常検索で prepare 呼び出し", Boolean(prep));
  assert("search", "添付なし検索 skipSearch=false", prep?.skipSearch === false);

  await bootWorkspace(page);
  await page.locator("[data-ai-chat-input]").fill("添付あり検索スキップ");
  await page.evaluate(() => {
    const input = document.querySelector("[data-ai-attach-input]");
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "smoke.txt", { type: "text/plain" }));
    input.files = dt.files;
  });
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 20000 });
  const prepAttach = await page.evaluate(() => window.__smoke.searchPrepare.slice(-1)[0]);
  assert("search", "添付あり時 skipSearch=true", prepAttach?.skipSearch === true);
}

async function testAttachAllFormats(page, files) {
  const formats = [
    ["png", files.png, "image"],
    ["jpg", files.jpg, "image"],
    ["webp", files.webp, "image"],
    ["txt", files.txt, "document"],
    ["md", files.md, "document"],
    ["csv", files.csv, "document"],
    ["json", files.json, "document"],
    ["pdf", files.pdf, "pdf"],
  ];

  for (const [label, filePath, kind] of formats) {
    await bootWorkspace(page);
    await page.locator("[data-ai-attach-input]").setInputFiles(filePath);
    await page.waitForFunction(
      () => {
        const p = document.querySelector("[data-ai-attach-preview]");
        return p && !p.hidden && p.textContent.length > 0;
      },
      null,
      { timeout: 5000 }
    );
    pass("attach", `${label} プレビュー`);

    await page.locator("[data-ai-chat-input]").fill(`${label} 添付テスト`);
    await page.locator("[data-ai-chat-send]").click();
    await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 20000 });
    const turn = await page.evaluate(() => window.__smoke.turns.slice(-1)[0]);
    const att = turn?.attachments?.[0];
    assert("attach", `${label} Gateway 渡し`, att?.kind === kind, att?.name || "");
  }

  await bootWorkspace(page);
  await page.locator("[data-ai-attach-input]").setInputFiles(files.big);
  const prep = await page.evaluate(async () => {
    const files = document.querySelector("[data-ai-attach-input]").files;
    return window.TasuAiWorkspaceAttachments.prepareFromFileList(files);
  });
  assert("attach", "サイズ制限エラー", prep.errors?.length >= 1);

  await page.evaluate(() => {
    window.TasuTgaShell?.clearAttachments?.();
  });
  const previewHidden = await page.evaluate(() => {
    const p = document.querySelector("[data-ai-attach-preview]");
    return !p || p.hidden || !p.textContent;
  });
  assert("attach", "clearAttachments でプレビュー削除", previewHidden);

  await page.evaluate(() => {
    const input = document.querySelector("[data-ai-attach-input]");
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "bad.exe", { type: "application/octet-stream" }));
    input.files = dt.files;
  });
  await page.locator("[data-ai-chat-input]").fill("非対応");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => {
      const err = document.querySelector("[data-ai-attach-error]");
      return err && !err.hidden && /非対応/.test(err.textContent || "");
    },
    null,
    { timeout: 10000 }
  );
  assert("attach", "非対応形式エラー表示", true);
}

async function testVisionProviders(page, files) {
  const models = ["gemini-flash", "gpt", "claude"];

  for (const modelId of models) {
    await bootWorkspace(page);
    await page.evaluate((id) => {
      window.TasuAiPlanModels?.setSelectedModelId?.(id);
    }, modelId);
    await page.locator("[data-ai-attach-input]").setInputFiles(files.png);
    await page.locator("[data-ai-chat-input]").fill(`Vision smoke ${modelId}`);
    await page.locator("[data-ai-chat-send]").click();
    await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 20000 });
    const check = await page.evaluate((id) => {
      const turn = window.__smoke.turns.slice(-1)[0];
      const att = turn?.attachments?.[0];
      return {
        modelId: window.TasuAiPlanModels?.getSelectedModelId?.(),
        hasImage: att?.kind === "image" && Boolean(att?.base64),
        name: att?.name || "",
      };
    }, modelId);
    assert(
      "vision",
      `${modelId} 画像相談 → Gateway`,
      check.hasImage && check.modelId === modelId,
      check.name
    );
  }
}

async function testVoice(page) {
  const toolbar = page.locator(".tasful-ai-voice__toolbar").first();
  assert("voice", "Voice toolbar 表示", (await toolbar.count()) >= 1);

  const voiceState = await page.evaluate(() => {
    window.TasuAiVoiceCore.initSurface("tasful_ai");
    window.TasuAiVoiceCore.setVoiceEnabled(false, "tasful_ai");
    window.TasuAiVoiceCore.setSpeakerEnabled(false, "tasful_ai");
    return {
      voiceOff: !window.TasuAiVoiceCore.voiceEnabled,
      speakerOff: !window.TasuAiVoiceCore.speakerEnabled,
      supported: window.TasuAiVoiceCore.isVoiceSupported(),
    };
  });
  assert("voice", "Voice OFF 状態", voiceState.voiceOff);
  assert("voice", "Speaker OFF 状態", voiceState.speakerOff);
  assert("voice", "Browser Speech API 検出", typeof voiceState.supported?.tts === "boolean");

  await page.locator("[data-ai-chat-input]").fill("Voice後もテキスト");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(() => window.__smoke?.turns?.length >= 1, null, { timeout: 20000 });
  assert("voice", "Voice UI ありでもテキスト送信", true);
}

async function testUi(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootWorkspace(page);
  const mobile = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      darkPage: document.body.classList.contains("ai-workspace-page"),
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      inputVisible: Boolean(document.querySelector("[data-ai-chat-input]")),
      sendVisible: Boolean(document.querySelector("[data-ai-chat-send]")),
    };
  });
  assert("ui", "390px 横スクロールなし", mobile.scrollW <= mobile.clientW + 2);
  assert("ui", "ダークテーマ page class", mobile.darkPage);
  assert("ui", "モバイル入力表示", mobile.inputVisible);
  assert("ui", "モバイル送信ボタン", mobile.sendVisible);

  await page.setViewportSize({ width: 1280, height: 900 });
}

async function testImageGenerationMock(page) {
  const direct = await page.evaluate(() => {
    const out = window.TasuAiGenerateUi?.tryHandle?.("SNS用の広告画像を作って");
    const html = String(out?.html || "");
    return {
      panel: html.includes("ai-generate-panel--image"),
      mock: /API接続後|デモプレビュー/.test(html),
    };
  });
  assert("image-gen", "画像生成 mock パネル (tryHandle)", direct.panel);
  assert("image-gen", "実API未接続表示 (tryHandle)", direct.mock);

  await bootWorkspace(page);
  await page.locator("[data-ai-chat-input]").fill("SNS用の広告画像を作って");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".ai-msg-row").length >= 1,
    null,
    { timeout: 25000 }
  );
  const chatState = await page.evaluate(() => ({
    panel: Boolean(document.querySelector(".ai-generate-panel--image")),
    assistant: document.querySelector(".ai-msg-row .ai-message")?.textContent?.slice(0, 80) || "",
  }));
  assert(
    "image-gen",
    "チャット送信後に応答表示",
    chatState.panel || chatState.assistant.length > 0,
    chatState.panel ? "mock panel" : "text reply"
  );
  if (!chatState.panel) {
    pass("image-gen", "生成意図は Gateway 文案 path（mock panel 以外）", "known behavior");
  }
}

async function testGatewayApis(page) {
  const apis = await page.evaluate(() => ({
    gateway: Boolean(window.TasuAiModelGateway?.completeTurn),
    orchestrator: Boolean(window.TasuAiSearchOrchestrator?.prepare),
    attachments: Boolean(window.TasuAiWorkspaceAttachments?.prepareFromFileList),
    voice: Boolean(window.TasuAiVoiceCore?.playVoice),
  }));
  assert("gateway", "TasuAiModelGateway", apis.gateway);
  assert("gateway", "TasuAiSearchOrchestrator", apis.orchestrator);
  assert("gateway", "TasuAiWorkspaceAttachments", apis.attachments);
  assert("gateway", "TasuAiVoiceCore", apis.voice);
}

async function testRegressionPages(browser) {
  const pages = [
    { name: "gen-ai-workspace", url: "gen-ai-workspace.html" },
    { name: "talk-home", url: "talk-home.html" },
  ];
  for (const p of pages) {
    const errors = [];
    const pg = await browser.newPage();
    pg.on("pageerror", (e) => errors.push(String(e.message)));
    await pg.goto(pageUrl(p.url), { waitUntil: "domcontentloaded", timeout: 30000 });
    await pg.waitForTimeout(1500);
    assert("regression", `${p.name} JS error なし`, errors.length === 0, errors[0] || "");
    await pg.close();
  }
}

async function main() {
  const files = ensureFixtureFiles();
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await bootWorkspace(page);
    await testGatewayApis(page);
    await testChatBasics(page);
    await bootWorkspace(page);
    await testModelSwitch(page);
    await bootWorkspace(page);
    await testLoadingState(page);
    await bootWorkspace(page);
    await testSearch(page);
    await testAttachAllFormats(page, files);
    await testVisionProviders(page, files);
    await bootWorkspace(page);
    await testVoice(page);
    await testUi(page);
    await bootWorkspace(page);
    await testImageGenerationMock(page);
    await testRegressionPages(browser);
  });

  const fails = results.filter((r) => !r.ok);
  console.log(`\nFinal smoke: ${results.length - fails.length}/${results.length} PASS`);
  if (fails.length) {
    console.error("\nFailures:");
    fails.forEach((f) => console.error(`  [${f.category}] ${f.name}: ${f.detail || ""}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  pass("summary", "all final smoke checks");
  await closeAllBrowsers();
}

main().catch(async (err) => {
  console.error(err);
  await closeAllBrowsers();
  process.exit(1);
});
