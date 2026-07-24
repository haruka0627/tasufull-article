#!/usr/bin/env node
/**
 * 完了報告モーダル — 完了写真 multiple 入力 + ドラッグ&ドロップ
 *
 *   npm run dev 起動後:
 *   node scripts/verify-talk-completion-photo-input.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPLETION_PHOTO = join(__dirname, "fixtures/completion-photo-1x1.png");
const COMPLETION_PHOTO_B = join(__dirname, "fixtures/completion-photo-b-1x1.png");
const NON_IMAGE = join(__dirname, "fixtures/completion-non-image.txt");
const THREAD_ID = "verify-admin-partner";
const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";
const DROP_SELECTOR = "[data-talk-builder-completion-photo-drop]";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+B/g8ADggBAJj4+VkAAAAASUVORK5CYII=",
  "base64"
);

writeFileSync(COMPLETION_PHOTO, PNG_1X1);
writeFileSync(COMPLETION_PHOTO_B, PNG_1X1);
writeFileSync(NON_IMAGE, "not an image");

const base = await findDevServerBaseUrl({ probePath: "chat-detail.html" });
const errors = [];

function chatUrl(threadId) {
  const q = new URLSearchParams({
    thread: threadId,
    from: "builder",
    builderFlow: "ops_partner",
    builderRole: "partner",
  });
  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);
}

async function seedExitedWorkflow(page) {
  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(
    ({ workflowKey, threadId }) => {
      const map = JSON.parse(localStorage.getItem(workflowKey) || "{}");
      map[threadId] = {
        status: "exited",
        enteredAt: new Date().toISOString(),
        exitedAt: new Date().toISOString(),
      };
      localStorage.setItem(workflowKey, JSON.stringify(map));
      localStorage.setItem(
        "tasful_chat_threads",
        JSON.stringify([
          {
            id: threadId,
            chatDomain: "builder",
            threadKind: "calendar_request",
            builderThreadType: "admin_partner",
            builderFlow: "ops_partner",
            partner: { displayName: "運営" },
            updatedAt: new Date().toISOString(),
          },
        ])
      );
    },
    { workflowKey: WORKFLOW_KEY, threadId: THREAD_ID }
  );
}

async function openCompletionModal(page) {
  await page.goto(chatUrl(THREAD_ID), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });
  await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "visible", timeout: 8000 });
}

/**
 * @param {import('playwright').Page} page
 * @param {{ name: string, mime: string, path: string }[]} files
 */
async function dropFilesOnZone(page, files) {
  const payloads = files.map((f) => ({
    name: f.name,
    mime: f.mime,
    data: Array.from(readFileSync(f.path)),
  }));
  await page.evaluate(
    ({ selector, filePayloads }) => {
      const zone = document.querySelector(selector);
      if (!zone) throw new Error("drop zone missing");
      const dt = new DataTransfer();
      filePayloads.forEach(({ name, mime, data }) => {
        const file = new File([new Uint8Array(data)], name, { type: mime });
        dt.items.add(file);
      });
      zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { selector: DROP_SELECTOR, filePayloads: payloads }
  );
}

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await seedExitedWorkflow(page);
  await openCompletionModal(page);

  const multiple = await page.locator("#talkBuilderCompletionPhotos").getAttribute("multiple");
  const accept = await page.locator("#talkBuilderCompletionPhotos").getAttribute("accept");
  if (multiple == null) errors.push("file input missing multiple attribute");
  if (accept !== "image/*") errors.push(`unexpected accept: ${accept}`);

  const dropLead = await page.locator(".talk-builder-completion-photo-drop__lead").textContent();
  if (!/ドラッグ&ドロップ/.test(dropLead || "")) {
    errors.push(`drop zone lead text missing: ${dropLead}`);
  }

  await page.locator("#talkBuilderCompletionWork").fill("テスト作業");
  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.waitForTimeout(300);
  const noPhotoErr = await page.locator("#talkBuilderCompletionError").textContent();
  if (!/1枚以上/.test(noPhotoErr || "")) errors.push(`expected no-photo error, got: ${noPhotoErr}`);
  if (await page.locator("#talkBuilderCompletionModal").isHidden()) {
    errors.push("modal closed without photos");
  }

  await page.locator("#talkBuilderCompletionPhotos").setInputFiles(COMPLETION_PHOTO);
  await page.waitForTimeout(200);
  const count1 = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/1枚選択済み/.test(count1 || "")) errors.push(`single photo count: ${count1}`);

  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 12000 });
  const badge1 = (await page.locator("#talkBuilderWorkflowStatusBadge").textContent()) || "";
  if (!/運営/.test(badge1)) errors.push(`single photo submit badge: ${badge1}`);

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await page.locator("#talkBuilderCompletionWork").fill("テスト作業（複数クリック）");
  await page
    .locator("#talkBuilderCompletionPhotos")
    .setInputFiles([COMPLETION_PHOTO, COMPLETION_PHOTO_B, COMPLETION_PHOTO]);
  await page.waitForTimeout(200);
  const count3 = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/2枚選択済み/.test(count3 || "") && !/3枚選択済み/.test(count3 || "")) {
    errors.push(`multi click photo count (dedupe): ${count3}`);
  }

  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 12000 });

  const reportMultiClick = await page.evaluate(
    ({ threadId }) => {
      const map = JSON.parse(
        localStorage.getItem("tasful:talk:builder-completion-reports:v1") || "{}"
      );
      return map[threadId] || null;
    },
    { threadId: THREAD_ID }
  );
  if (!reportMultiClick || Number(reportMultiClick.photoCount) < 2) {
    errors.push(`multi click report photoCount: ${reportMultiClick?.photoCount}`);
  }
  if (!Array.isArray(reportMultiClick?.photoPreviews) || reportMultiClick.photoPreviews.length < 2) {
    errors.push(`multi click report photoPreviews: ${reportMultiClick?.photoPreviews?.length}`);
  }
  if (!/^data:image\//.test(reportMultiClick?.photoPreviews?.[0]?.src || "")) {
    errors.push("multi click report missing preview data URL");
  }

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await page.locator("#talkBuilderCompletionWork").fill("テスト作業（D&D 1枚）");
  await dropFilesOnZone(page, [{ name: "drop-one.png", mime: "image/png", path: COMPLETION_PHOTO }]);
  await page.waitForTimeout(200);
  const dropCount1 = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/1枚選択済み/.test(dropCount1 || "")) errors.push(`drop single count: ${dropCount1}`);

  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 12000 });

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await page.locator("#talkBuilderCompletionWork").fill("テスト作業（D&D 複数）");
  await dropFilesOnZone(page, [
    { name: "drop-a.png", mime: "image/png", path: COMPLETION_PHOTO },
    { name: "drop-b.png", mime: "image/png", path: COMPLETION_PHOTO_B },
    { name: "drop-c.png", mime: "image/png", path: COMPLETION_PHOTO },
  ]);
  await page.waitForTimeout(200);
  const dropCount3 = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/3枚選択済み/.test(dropCount3 || "")) errors.push(`drop multi count: ${dropCount3}`);

  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 12000 });

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await page.locator("#talkBuilderCompletionPhotos").setInputFiles([COMPLETION_PHOTO, COMPLETION_PHOTO_B]);
  await page.waitForTimeout(200);
  const beforeAppend = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/2枚選択済み/.test(beforeAppend || "")) errors.push(`before append drop: ${beforeAppend}`);
  await dropFilesOnZone(page, [{ name: "drop-append.png", mime: "image/png", path: COMPLETION_PHOTO }]);
  await page.waitForTimeout(200);
  const afterAppend = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/3枚選択済み/.test(afterAppend || "")) errors.push(`append drop count: ${afterAppend}`);

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await dropFilesOnZone(page, [
    { name: "max-1.png", mime: "image/png", path: COMPLETION_PHOTO },
    { name: "max-2.png", mime: "image/png", path: COMPLETION_PHOTO_B },
    { name: "max-3.png", mime: "image/png", path: COMPLETION_PHOTO },
    { name: "max-4.png", mime: "image/png", path: COMPLETION_PHOTO_B },
    { name: "max-5.png", mime: "image/png", path: COMPLETION_PHOTO },
    { name: "max-6.png", mime: "image/png", path: COMPLETION_PHOTO_B },
  ]);
  await page.waitForTimeout(200);
  const maxErr = await page.locator("#talkBuilderCompletionError").textContent();
  if (!/最大5枚/.test(maxErr || "")) errors.push(`max 6 error: ${maxErr}`);

  await seedExitedWorkflow(page);
  await openCompletionModal(page);
  await dropFilesOnZone(page, [{ name: "notes.txt", mime: "text/plain", path: NON_IMAGE }]);
  await page.waitForTimeout(200);
  const rejectErr = await page.locator("#talkBuilderCompletionError").textContent();
  const rejectCount = await page.locator("[data-talk-builder-completion-photo-count]").textContent();
  if (!/画像ファイルのみ/.test(rejectErr || "")) {
    errors.push(`non-image reject error: ${rejectErr}`);
  }
  if (rejectCount && /選択済み/.test(rejectCount)) {
    errors.push(`non-image should not add photos: ${rejectCount}`);
  }

  if (consoleErrors.length) {
    errors.push(...consoleErrors.map((e) => `console: ${e}`));
  }
}, { headless: true });

await closeAllBrowsers();

if (errors.length) {
  console.error("FAIL talk-completion-photo-input\n");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("PASS talk-completion-photo-input");
