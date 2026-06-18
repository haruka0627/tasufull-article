/**
 * 生成済み taskId で URL再取得・キャラ保存・3D表示を確認（再生成・チケット消費なし）
 * node scripts/verify-tripo-character-save-once.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5203;
const USER_ID = "u_me";
const CHAR_ID = "char_prod_ui_once";
const TASK_ID = "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7";
const CHAR_NAME = "近衛木乃香";

const cfgText = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const anonKey = cfgText.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const supabaseUrl = cfgText.match(/supabaseUrl:\s*"([^"]+)"/)?.[1] || "https://ddojquacsyqesrjhcvmn.supabase.co";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

function mimeFor(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (f.endsWith(".css")) return "text/css; charset=utf-8";
  if (f.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

const planBefore = await fetch(`${supabaseUrl}/functions/v1/stripe-get-genai-plan`, {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: USER_ID }),
}).then((r) => r.json());
const ticketsBefore = Number(planBefore?.entitlements?.tickets3dRemaining ?? planBefore?.tickets3dRemaining ?? -1);
const usedBefore = Number(planBefore?.entitlements?.tickets3dTotalUsed ?? planBefore?.tickets3dTotalUsed ?? -1);

const complete = await fetch(`${supabaseUrl}/functions/v1/genai-3d-generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "complete_generation",
    userId: USER_ID,
    characterId: CHAR_ID,
    taskId: TASK_ID,
  }),
}).then((r) => r.json());

console.log("complete_generation:", {
  ok: complete.ok,
  status: complete.status,
  idempotent: complete.idempotent,
  taskId: complete.taskId,
  hasModel: Boolean(complete.modelUrl),
  creditsUsed: complete.creditsUsed,
});

if (!complete.modelUrl && !complete.downloadUrl) {
  console.error("No model URL from complete_generation");
  process.exit(1);
}

const poll = await fetch(`${supabaseUrl}/functions/v1/genai-3d-generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "task_poll", taskId: TASK_ID }),
}).then((r) => r.json());
console.log("task_poll hasModel:", Boolean(poll.modelUrl));

const reconcile = await fetch(`${supabaseUrl}/functions/v1/genai-3d-generate`, {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "reconcile_stale_generations", userId: USER_ID }),
}).then((r) => r.json());
console.log("reconcile_stale:", reconcile.reconciled, reconcile.results);

const planAfter = await fetch(`${supabaseUrl}/functions/v1/stripe-get-genai-plan`, {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: USER_ID }),
}).then((r) => r.json());
const ticketsAfter = Number(planAfter?.entitlements?.tickets3dRemaining ?? planAfter?.tickets3dRemaining ?? -1);
const usedAfter = Number(planAfter?.entitlements?.tickets3dTotalUsed ?? planAfter?.tickets3dTotalUsed ?? -1);
console.log("tickets:", ticketsBefore, "->", ticketsAfter, "used:", usedBefore, "->", usedAfter);

const img = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${img.toString("base64")}`;

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    if (res.headersSent) return;
    let p = req.url?.split("?")[0] || "/gen-ai-workspace.html";
    const f = join(root, p.replace(/^\//, ""));
    try {
      res.writeHead(200, { "Content-Type": mimeFor(f) });
      res.end(readFileSync(f));
    } catch {
      if (!res.headersSent) res.writeHead(404).end("nf");
    }
  });
  s.listen(PORT, "127.0.0.1", () => resolve(s));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(180000);

await page.goto(`http://127.0.0.1:${PORT}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`);
await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.refreshTripoGlbFromTaskId));

await page.evaluate(
  ({ charId, charName, imageDataUrl, taskId, complete }) => {
    const char = {
      id: charId,
      name: charName,
      imageData: imageDataUrl,
      tripoTaskId: taskId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
    localStorage.setItem("tasu_genai_active_character", charId);
    localStorage.setItem(
      "tasu_tripo_last_test_result",
      JSON.stringify({
        taskId: complete.taskId,
        modelUrl: complete.modelUrl,
        previewUrl: complete.previewUrl,
        downloadUrl: complete.downloadUrl,
      })
    );
  },
  { charId: CHAR_ID, charName: CHAR_NAME, imageDataUrl: imageData, taskId: TASK_ID, complete }
);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-gen-ai-character-select]");
await page.selectOption("[data-gen-ai-character-select]", CHAR_ID);
await page.click('[data-gen-ai-stage-renderer="3d"]');
await page.waitForSelector("[data-gen-ai-3d-actions]:not([hidden])");

await page.click("[data-gen-ai-3d-refresh-url]");
await page.waitForFunction(
  () => /3Dモデルが完成しました/.test(document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || ""),
  null,
  { timeout: 60000 }
);

for (let i = 0; i < 60; i += 1) {
  const kind = await page.evaluate(async () => {
    const r = await window.TasuGenAiWorkspace.loadTripoGlbToStage(null, { refresh: false, quiet: true });
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    return { modelKind: ctrl?.state?.modelKind, ok: r?.ok };
  });
  if (kind.modelKind === "gltf" && kind.ok) break;
  await new Promise((r) => setTimeout(r, 3000));
}

const ui = await page.evaluate(() => {
  const chars = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
  const ch = chars.find((c) => c.id === "char_prod_ui_once");
  return {
    note: document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || "",
    status3d: document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent || "",
    activeId: localStorage.getItem("tasu_genai_active_character"),
    character: ch,
    modelKind: window.GenAiCharacter3D?.ensure3dMounted
      ? null
      : null,
  };
});

const modelKind = await page.evaluate(async () => {
  const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
  return ctrl?.state?.modelKind;
});
ui.modelKind = modelKind;
const gltfOk = modelKind === "gltf";

console.log("\n=== UI / localStorage ===");
console.log("note:", ui.note);
console.log("status3d:", ui.status3d);
console.log("activeId:", ui.activeId);
console.log("modelKind:", ui.modelKind);
console.log("saved:", {
  name: ui.character?.name,
  tripoTaskId: ui.character?.tripoTaskId,
  modelUrl: Boolean(ui.character?.modelUrl),
  tripoModelUrl: Boolean(ui.character?.tripoModelUrl),
  rendererMode: ui.character?.rendererMode,
});

const ok =
  ui.character?.modelUrl &&
  ui.character?.tripoModelUrl &&
  ui.character?.tripoTaskId === TASK_ID &&
  gltfOk &&
  /3Dモデルが完成しました/.test(ui.note);

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
