#!/usr/bin/env node
/**
 * TASFUL AI Workspace — 添付 / Vision E2E
 *   node scripts/test-tasful-ai-attach-vision-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tmpDir = path.join(os.tmpdir(), "tasu-ai-attach-test");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  const url = pathToFileURL(path.join(root, rel.replace(/^\//, "")));
  return url.href;
}

function fail(msg) {
  console.error("FAIL:", msg);
  throw new Error(msg);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function ensureTmpFiles() {
  fs.mkdirSync(tmpDir, { recursive: true });
  const files = {
    note: path.join(tmpDir, "sample-note.txt"),
    data: path.join(tmpDir, "sample-data.json"),
    image: path.join(tmpDir, "sample.png"),
    bad: path.join(tmpDir, "sample.exe"),
  };
  fs.writeFileSync(files.note, "添付テスト用テキスト\n2行目", "utf8");
  fs.writeFileSync(files.data, JSON.stringify({ hello: "attach" }), "utf8");
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  fs.writeFileSync(files.image, Buffer.from(pngBase64, "base64"));
  fs.writeFileSync(files.bad, "MZ fake exe", "utf8");
  return files;
}

async function bootWorkspace(page) {
  await page.goto(pageUrl("ai-workspace.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.TasuAiChat?.sendMessage && window.TasuAiWorkspaceAttachments?.prepareFromFileList,
    null,
    { timeout: 20000 }
  );
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("tasu_ai_chat_cross-matching");
    } catch {
      /* ignore */
    }
    window.__attachTestTurns = [];
    const gw = window.TasuAiModelGateway;
    if (!gw || gw.__attachHooked) return;
    gw.__attachHooked = true;
    const orig = gw.completeTurn.bind(gw);
    gw.completeTurn = async (params) => {
      window.__attachTestTurns.push({
        userText: params.userText,
        attachments: params.attachments || [],
        attachmentCount: (params.attachments || []).length,
      });
      return {
        reply: params.attachments?.length
          ? `添付${params.attachments.length}件を受け取りました（テスト）`
          : "テキストのみ応答（テスト）",
        modelId: "gemini-flash",
        modelLabel: "Gemini Flash",
        modelProvider: "gemini",
        usedRemote: false,
        fallback_used: true,
        search_used: false,
        attachments_count: (params.attachments || []).length,
      };
    };
    gw.__origCompleteTurn = orig;
  });
}

async function testTextOnly(page) {
  const input = page.locator("[data-ai-chat-input]");
  const send = page.locator("[data-ai-chat-send]");
  await input.fill("添付なしテスト");
  await send.click();
  await page.waitForFunction(
    () => window.__attachTestTurns?.length >= 1,
    null,
    { timeout: 15000 }
  );
  const turn = await page.evaluate(() => window.__attachTestTurns?.slice(-1)[0]);
  if (!turn || turn.attachmentCount !== 0) fail("text-only send should have zero attachments");
  pass("添付なしテキスト送信が従来どおり動く");
}

async function testImagePreviewAndSend(page, files) {
  const input = page.locator("[data-ai-attach-input]");
  await input.setInputFiles(files.image);
  const preview = page.locator("[data-ai-attach-preview]");
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-ai-attach-preview]");
      return el && !el.hidden && el.textContent.includes("sample.png");
    },
    null,
    { timeout: 5000 }
  );
  pass("画像添付プレビューが表示される");

  await page.locator("[data-ai-chat-input]").fill("この画像について");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => window.__attachTestTurns?.slice(-1)[0]?.attachmentCount >= 1,
    null,
    { timeout: 15000 }
  );
  const turn = await page.evaluate(() => window.__attachTestTurns.slice(-1)[0]);
  if (!turn.attachments.some((a) => a.kind === "image")) fail("image attachment not passed to gateway");
  pass("画像添付が Gateway に渡される");
}

async function testTextDocAttach(page, files) {
  const input = page.locator("[data-ai-attach-input]");
  await input.setInputFiles([files.note, files.data]);
  await page.locator("[data-ai-chat-input]").fill("文書添付テスト");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => window.__attachTestTurns?.slice(-1)[0]?.attachmentCount >= 2,
    null,
    { timeout: 15000 }
  );
  const turn = await page.evaluate(() => window.__attachTestTurns.slice(-1)[0]);
  const docs = turn.attachments.filter((a) => a.kind === "document");
  if (docs.length < 2) fail("txt/json attachments not passed");
  if (!docs.some((d) => d.textContent?.includes("添付テスト"))) fail("txt content not extracted");
  pass("txt / json 添付が送信に含まれる");
}

async function testUnsupportedFile(page) {
  await page.evaluate(() => {
    const input = document.querySelector("[data-ai-attach-input]");
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(new File(["bad"], "sample.exe", { type: "application/octet-stream" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-ai-chat-input]").fill("非対応ファイルテスト");
  await page.locator("[data-ai-chat-send]").click();
  await page.waitForFunction(
    () => {
      const err = document.querySelector("[data-ai-attach-error]");
      return err && !err.hidden && /非対応/.test(err.textContent || "");
    },
    null,
    { timeout: 15000 }
  );
  pass("非対応ファイルでエラー表示");
  const stillWorks = await page.locator("[data-ai-chat-input]").isEnabled();
  if (!stillWorks) fail("chat input disabled after attach error");
  pass("添付エラー後もテキスト入力が使える");
}

async function testVoiceEvent(page) {
  const spoke = await page.evaluate(() => {
    let count = 0;
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = () => {
        count += 1;
      };
    }
    window.TasuAiVoiceCore?.setSpeakerEnabled?.(true, "tasful_ai");
    window.dispatchEvent(
      new CustomEvent("tasu:ai-voice-assistant-reply", {
        detail: { text: "Voice attach test", surface: "tasful_ai" },
      })
    );
    window.TasuAiVoiceCore?.setSpeakerEnabled?.(false, "tasful_ai");
    return count;
  });
  if (spoke < 1) fail("voice assistant reply event broken");
  pass("Voiceイベントが壊れていない");
}

async function main() {
  const files = ensureTmpFiles();
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await bootWorkspace(page);
    await testTextOnly(page);
    await bootWorkspace(page);
    await testImagePreviewAndSend(page, files);
    await bootWorkspace(page);
    await testTextDocAttach(page, files);
    await bootWorkspace(page);
    await testUnsupportedFile(page);
    await testVoiceEvent(page);
  });
  pass("all attach/vision checks");
  await closeAllBrowsers();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err?.message || err);
    await closeAllBrowsers();
    process.exit(1);
  });
