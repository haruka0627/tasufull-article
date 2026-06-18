/**
 * Tripo 初回3Dテスト（1回のみ・Tripoクレジット消費）
 * GENAI_TRIPO_RUN_TEST=1 node scripts/test-genai-tripo-test-generate-once.mjs
 * GENAI_TRIPO_IMAGE=path/to.png で画像指定（省略時 images/ai-character.png）
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.GENAI_TRIPO_RUN_TEST !== "1") {
  console.log("Skip: set GENAI_TRIPO_RUN_TEST=1 to run (consumes Tripo credits once).");
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const imagePath =
  process.env.GENAI_TRIPO_IMAGE ||
  join(root, "images", "ai-character.png");

if (!existsSync(imagePath)) {
  console.error("Image not found:", imagePath);
  process.exit(1);
}

const buf = readFileSync(imagePath);
const ext = imagePath.toLowerCase().endsWith(".webp")
  ? "webp"
  : imagePath.toLowerCase().endsWith(".png")
    ? "png"
    : "jpeg";
const imageData = `data:image/${ext};base64,${buf.toString("base64")}`;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const endpoint = `${url}/functions/v1/genai-3d-generate`;

async function post(body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: text?.slice(0, 200) || `HTTP ${res.status}` };
  }
  return { status: res.status, data };
}

async function poll(taskId) {
  const maxMs = 600_000;
  const intervalMs = 10_000;
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const { data } = await post({ action: "task_poll", taskId });
    console.log(`  poll status=${data.status} done=${data.done}`);
    if (data.done) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, error: "client poll timeout", taskId };
}

console.log("Tripo test_generate (once) — image:", imagePath);
const started = Date.now();
let { status, data } = await post({
  action: "test_generate",
  imageData,
  maxWaitMs: 0,
});

if (!data.taskId && (status === 546 || status === 504 || status >= 500)) {
  console.warn("Edge timeout or gateway error — cannot poll without taskId.");
}

if (data.taskId && !data.modelUrl) {
  console.log("Client polling until Tripo task completes…");
  data = await poll(data.taskId);
  data.ok = data.success || Boolean(data.modelUrl);
}

const generationTimeMs = data.generationTimeMs || data.generationTime || Date.now() - started;

console.log("\n=== Tripo test_generate report ===");
console.log("HTTP status:", status);
console.log("ok:", data.ok);
console.log("taskId:", data.taskId ?? "(none)");
console.log("status:", data.status ?? "(none)");
console.log("generationTimeMs:", generationTimeMs);
console.log("creditsUsed:", data.creditsUsed ?? 0);
console.log("modelUrl (GLB):", data.modelUrl ?? "(none)");
console.log("previewUrl:", data.previewUrl ?? "(none)");
console.log("downloadUrl:", data.downloadUrl ?? "(none)");
console.log("traceId:", data.traceId ?? "(none)");
if (data.error) console.log("error:", data.error);

let glbFetchOk = false;
const glb = data.modelUrl || data.downloadUrl;
if (glb) {
  try {
    const head = await fetch(glb, { method: "HEAD" });
    glbFetchOk = head.ok;
    console.log("GLB URL reachable (HEAD):", glbFetchOk, head.status);
  } catch (err) {
    console.log("GLB URL reachable (HEAD): false", err?.message || err);
  }
}

console.log("3D display (browser): run gen-ai-workspace → 3D → 初回3Dテスト生成");
process.exit(data.ok && glb ? 0 : 1);
