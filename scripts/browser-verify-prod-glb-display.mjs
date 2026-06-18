/**
 * 成功済み task の GLB を UI に注入して表示のみ確認（生成なし・チケット消費なし）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5202;
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const TASK_ID = "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7";
const CHAR_ID = "char_prod_ui_once";

const comp = await fetch("https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/genai-3d-generate", {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "complete_generation",
    userId: "u_me",
    characterId: CHAR_ID,
    taskId: TASK_ID,
  }),
}).then((r) => r.json());

function mimeFor(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (f.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    if (res.headersSent) return;
    let p = req.url?.split("?")[0] || "/gen-ai-workspace.html";
    const f = join(root, p.replace(/^\//, ""));
    try {
      const b = readFileSync(f);
      res.writeHead(200, { "Content-Type": mimeFor(f) });
      res.end(b);
    } catch {
      if (!res.headersSent) res.writeHead(404).end("nf");
    }
  });
  s.listen(PORT, "127.0.0.1", () => resolve(s));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(300000);

await page.goto(`http://127.0.0.1:${PORT}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`);
await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace));

const img = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${img.toString("base64")}`;

await page.evaluate(
  ({ charId, imageDataUrl, comp }) => {
    localStorage.setItem(
      "tasu_genai_my_characters",
      JSON.stringify([
        {
          id: charId,
          name: "近衛木乃香",
          imageData: imageDataUrl,
          tripoTaskId: comp.taskId,
          tripoModelUrl: comp.modelUrl,
          tripoPreviewUrl: comp.previewUrl,
          tripoDownloadUrl: comp.downloadUrl,
          modelUrl: comp.modelUrl,
          tripoModelSavedAt: new Date().toISOString(),
        },
      ])
    );
    localStorage.setItem("tasu_genai_active_character", charId);
  },
  { charId: CHAR_ID, imageDataUrl: imageData, comp }
);

await page.reload({ waitUntil: "domcontentloaded" });
await page.selectOption("[data-gen-ai-character-select]", CHAR_ID);
await page.click('[data-gen-ai-stage-renderer="3d"]');
await page.waitForTimeout(500);
const display = await page.evaluate(async () => {
  const loadResult = await window.TasuGenAiWorkspace.loadTripoGlbToStage();
  const c = await window.GenAiCharacter3D.ensure3dMounted();
  return { loadResult, modelKind: c?.state?.modelKind };
});

console.log("loadTripoGlbToStage", display.loadResult);
console.log("modelKind", display.modelKind);
console.log("GLB display:", display.modelKind === "gltf" ? "OK" : "FAIL");

await browser.close();
server.close();
process.exit(display.modelKind === "gltf" ? 0 : 1);
