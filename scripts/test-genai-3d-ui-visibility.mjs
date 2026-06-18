/**
 * 3D UI 本番/開発モード表示テスト
 * node scripts/test-genai-3d-ui-visibility.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5204;

function mimeFor(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (f.endsWith(".css")) return "text/css; charset=utf-8";
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

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
const url = `http://127.0.0.1:${PORT}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`;

async function vis(devMode, plan, char) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace));
  await page.evaluate(
    ({ devMode, plan, char }) => {
      if (devMode) localStorage.setItem("tasu_genai_dev_mode", "1");
      else localStorage.removeItem("tasu_genai_dev_mode");
      localStorage.setItem("tasu_genai_plan", JSON.stringify(plan));
      localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
      localStorage.setItem("tasu_genai_active_character", char.id);
    },
    { devMode, plan, char }
  );
  await page.reload();
  await page.selectOption("[data-gen-ai-character-select]", char.id);
  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForSelector("[data-gen-ai-3d-actions]:not([hidden])");

  return page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      return el ? !el.hidden && el.offsetParent !== null : false;
    };
    const devBlock = document.querySelector("[data-gen-ai-3d-dev-only]");
    return {
      generate: vis("[data-gen-ai-3d-generate-ticket]"),
      buy: vis("[data-gen-ai-3d-buy-ticket]"),
      loadSaved: vis("[data-gen-ai-3d-load-glb]"),
      devBlock: devBlock ? !devBlock.hidden : false,
      testBtn: vis("[data-gen-ai-3d-test-generate]"),
      refresh: vis("[data-gen-ai-3d-refresh-url]"),
      note: document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || "",
      summary: document.querySelector("[data-gen-ai-3d-result-summary]")?.textContent || "",
      detailsHtml: document.querySelector("[data-gen-ai-3d-details]")?.innerHTML || "",
      detailsVisible: vis("[data-gen-ai-3d-details]"),
    };
  });
}

const img = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${img.toString("base64")}`;

const charNo3d = {
  id: "char_ui_no3d",
  name: "テスト",
  imageData,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const charWith3d = {
  ...charNo3d,
  id: "char_ui_3d",
  tripoTaskId: "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7",
  tripoModelUrl: "https://example.com/model.glb",
  modelUrl: "https://example.com/model.glb",
};

const prodTicket0 = await vis(false, { plan: "free", tickets3dRemaining: 0, tickets3dTotalUsed: 1 }, charNo3d);
const prodTicket1 = await vis(false, { plan: "free", tickets3dRemaining: 1, tickets3dTotalUsed: 0 }, charNo3d);
const prodSaved = await vis(false, { plan: "free", tickets3dRemaining: 0, tickets3dTotalUsed: 1 }, charWith3d);
const devOn = await vis(true, { plan: "free", tickets3dRemaining: 0, tickets3dTotalUsed: 1 }, charWith3d);

const checks = [
  ["prod dev hidden", !prodTicket0.devBlock && !prodTicket0.testBtn],
  ["prod ticket0 buy", prodTicket0.buy && !prodTicket0.generate],
  ["prod ticket1 generate", prodTicket1.generate && !prodTicket1.buy],
  ["prod note before", prodTicket1.note.includes("この画像から3Dモデルを生成します")],
  ["prod no ticket msg", prodTicket0.note.includes("3D生成にはチケットが必要です")],
  ["prod saved load btn", prodSaved.loadSaved],
  ["prod no taskId in note", !prodSaved.note.includes("f81ec7c6")],
  ["dev block visible", devOn.devBlock && devOn.refresh],
  ["summary no taskId visible", !prodSaved.summary.includes("taskId")],
];

console.log("prod ticket0", prodTicket0);
console.log("prod ticket1", prodTicket1);
console.log("prod saved", prodSaved);
console.log("dev on", devOn);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed += 1;
}

});
server.close();
await closeAllBrowsers();
process.exit(failed ? 1 : 0);
