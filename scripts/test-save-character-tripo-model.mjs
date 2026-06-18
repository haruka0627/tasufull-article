/**
 * saveCharacterTripoModel が localStorage に Tripo フィールドを書くことを確認
 * node scripts/test-save-character-tripo-model.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5205;

function mimeFor(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
  return "application/octet-stream";
}

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    if (res.headersSent) return;
    const p = (req.url?.split("?")[0] || "/gen-ai-workspace.html").replace(/^\//, "");
    try {
      res.writeHead(200, { "Content-Type": mimeFor(p) });
      res.end(readFileSync(join(root, p)));
    } catch {
      if (!res.headersSent) res.writeHead(404).end();
    }
  });
  s.listen(PORT, "127.0.0.1", () => resolve(s));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  if (msg.text().includes("[GenAi3D] saveCharacterTripoModel")) {
    console.log("browser:", msg.text());
  }
});

await page.goto(`http://127.0.0.1:${PORT}/gen-ai-workspace.html`);
await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.saveCharacterTripoModel));

const img = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${img.toString("base64")}`;

const result = await page.evaluate(
  ({ imageDataUrl }) => {
    const char = {
      id: "char_save_test",
      name: "保存テスト",
      imageData: imageDataUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
    localStorage.setItem("tasu_genai_active_character", "char_save_test");

    const ok = window.TasuGenAiWorkspace.saveCharacterTripoModel("char_save_test", {
      taskId: "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7",
      modelUrl: "https://example.com/test.glb",
      previewUrl: "https://example.com/preview.webp",
      downloadUrl: "https://example.com/test.glb",
    });

    const list = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const saved = list.find((c) => c.id === "char_save_test");
    const active = localStorage.getItem("tasu_genai_active_character");

    return {
      ok,
      active,
      saved: saved
        ? {
            tripoTaskId: saved.tripoTaskId,
            tripoModelUrl: saved.tripoModelUrl,
            modelUrl: saved.modelUrl,
            tripoPreviewUrl: saved.tripoPreviewUrl,
            tripoDownloadUrl: saved.tripoDownloadUrl,
            tripoModelSavedAt: saved.tripoModelSavedAt,
            rendererMode: saved.rendererMode,
          }
        : null,
    };
  },
  { imageDataUrl: imageData }
);

console.log(JSON.stringify(result, null, 2));

const pass =
  result.ok &&
  result.active === "char_save_test" &&
  result.saved?.tripoTaskId === "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7" &&
  result.saved?.tripoModelUrl === "https://example.com/test.glb" &&
  result.saved?.modelUrl === "https://example.com/test.glb" &&
  result.saved?.rendererMode === "3d" &&
  Boolean(result.saved?.tripoModelSavedAt);

console.log(pass ? "PASS save (string active id)" : "FAIL save (string active id)");

const resultJsonActive = await page.evaluate(
  ({ imageDataUrl }) => {
    const char = {
      id: "char_json_active",
      name: "JSON active",
      imageData: imageDataUrl,
    };
    localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
    localStorage.setItem(
      "tasu_genai_active_character",
      JSON.stringify({ id: "char_json_active", name: "JSON active" })
    );

    window.TasuGenAiWorkspace.saveCharacterTripoModel(null, {
      taskId: "task-json-active",
      modelUrl: "https://example.com/json.glb",
      downloadUrl: "https://example.com/json.glb",
    });

    const list = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const saved = list.find((c) => c.id === "char_json_active");
    const active = localStorage.getItem("tasu_genai_active_character");
    return {
      active,
      tripoTaskId: saved?.tripoTaskId,
      modelUrl: saved?.modelUrl,
    };
  },
  { imageDataUrl: imageData }
);

console.log("json active test:", resultJsonActive);
const pass2 =
  resultJsonActive.active === "char_json_active" &&
  resultJsonActive.tripoTaskId === "task-json-active" &&
  resultJsonActive.modelUrl === "https://example.com/json.glb";

console.log(pass && pass2 ? "PASS all" : "FAIL");

await browser.close();
server.close();
process.exit(pass && pass2 ? 0 : 1);
