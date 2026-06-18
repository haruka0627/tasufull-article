/**
 * Tripo GLB の 3D 表示確認（再生成なし・task_poll のみ）
 * node scripts/browser-test-gen-ai-3d-glb.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
function mimeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".glb")) return "model/gltf-binary";
  return "application/octet-stream";
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TASK_ID = "5c1b78ec-410e-4932-ad94-d8e5bb6e4f3e";
const PORT = Number(process.env.GEN_AI_TEST_PORT) || 5199;
const supabaseUrl = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchTripoUrls() {
  const res = await fetch(`${supabaseUrl}/functions/v1/genai-3d-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ action: "task_poll", taskId: TASK_ID }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.modelUrl) throw new Error(data.error || `task_poll failed HTTP ${res.status}`);
  return data;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let path = req.url?.split("?")[0] || "/";
      if (path === "/") path = "/gen-ai-workspace.html";
      const filePath = join(root, path.replace(/^\//, ""));
      try {
        const body = readFileSync(filePath);
        const type = mimeFor(filePath);
        res.writeHead(200, { "Content-Type": type });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

const tripo = await fetchTripoUrls();
record("task_poll fresh GLB URL", Boolean(tripo.modelUrl), tripo.status);

const server = await startStaticServer();
const baseUrl = `http://127.0.0.1:${PORT}/gen-ai-workspace.html?mode=AI%E3%82%AD%E3%83%A3%E3%83%A9%E4%BC%9A%E8%A9%B1`;

const glbErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(300000);

page.on("console", (msg) => {
  const t = msg.text();
  if (/GenAi3D|GLB|gltf/i.test(t) && !/plan sync failed/i.test(t)) glbErrors.push(t);
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("[data-gen-ai-root]", { timeout: 10000 });

  await page.evaluate(
    ({ char, tripoData }) => {
      localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
      localStorage.setItem("tasu_genai_active_character", char.id);
      localStorage.setItem("tasu_genai_stage_renderer", "3d");
      localStorage.setItem(
        "tasu_tripo_last_test_result",
        JSON.stringify({
          taskId: tripoData.taskId,
          modelUrl: tripoData.modelUrl,
          previewUrl: tripoData.previewUrl,
          downloadUrl: tripoData.downloadUrl,
          savedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem("tasu_tripo_test_generate_done", "1");
    },
    {
      char: {
        id: "char_tripo_3d_verify",
        name: "近衛木乃香",
        nameKana: "このえ このか",
        personality: "明るい",
        speakingStyle: "関西弁",
        firstPerson: "うち",
        userCallName: "ひろさん",
        appearanceMemo: "テスト",
        purpose: "相談",
        tripoTaskId: tripo.taskId,
        tripoModelUrl: tripo.modelUrl,
        tripoPreviewUrl: tripo.previewUrl,
        tripoDownloadUrl: tripo.downloadUrl,
        modelUrl: tripo.modelUrl,
        mouthX: 50,
        mouthY: 45,
        mouthScale: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tripoData: {
        taskId: tripo.taskId || TASK_ID,
        modelUrl: tripo.modelUrl,
        previewUrl: tripo.previewUrl,
        downloadUrl: tripo.downloadUrl,
      },
    }
  );

  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.loadTripoGlbToStage), {
    timeout: 20000,
  });

  const fetchProbe = await page.evaluate(async (url) => {
    const cfg = window.TasuTripoGenAiConfig;
    const res = await fetch(cfg.healthCheckUrl, {
      method: "POST",
      headers: cfg.getHeaders(),
      body: JSON.stringify({ action: "fetch_glb", url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, error: err.error };
    }
    const buf = await res.arrayBuffer();
    return {
      ok: true,
      status: res.status,
      bytes: buf.byteLength,
      magic: new TextDecoder().decode(new Uint8Array(buf).slice(0, 4)),
    };
  }, tripo.modelUrl);
  record("browser fetch_glb proxy", fetchProbe.ok, `${fetchProbe.bytes || fetchProbe.error} bytes`);

  const parseProbe = await page.evaluate(async (url) => {
    const { GLTFLoader } = await import(
      "https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/loaders/GLTFLoader.js"
    );
    const cfg = window.TasuTripoGenAiConfig;
    const res = await fetch(cfg.healthCheckUrl, {
      method: "POST",
      headers: cfg.getHeaders(),
      body: JSON.stringify({ action: "fetch_glb", url }),
    });
    const buf = await res.arrayBuffer();
    try {
      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().parse(buf, "", resolve, reject);
      });
      return { ok: true, children: gltf.scene?.children?.length ?? 0 };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }, tripo.modelUrl);
  record("Three.js GLTF parse", parseProbe.ok, parseProbe.error || `children=${parseProbe.children}`);

  const loadResult = await page.evaluate(async () => {
    try {
      return await window.TasuGenAiWorkspace.loadTripoGlbToStage();
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
  const loadErr = await page.evaluate(() => window.__genAi3dLastLoadError || "");
  record(
    "loadTripoGlbToStage returned ok",
    Boolean(loadResult?.ok),
    loadResult?.error || loadErr || loadResult?.url?.slice(0, 50) || "unknown"
  );

  await page.waitForFunction(
    () => {
      const status = document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent || "";
      return /Tripo|glTF/i.test(status);
    },
    null,
    { timeout: 180000 }
  );

  const state = await page.evaluate(async () => {
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    const saved = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const ch = saved.find((c) => c.id === "char_tripo_3d_verify");
    return {
      statusText: document.querySelector("[data-gen-ai-stage-3d-status]")?.textContent || "",
      modelKind: ctrl?.state?.modelKind || "unknown",
      canvasVisible: !document.querySelector("[data-gen-ai-char-3d-canvas]")?.hidden,
      layer2dHidden: document.querySelector("[data-gen-ai-stage-layer-2d]")?.hidden,
      layerLiveHidden: document.querySelector("[data-gen-ai-stage-layer-live]")?.hidden,
      savedModelUrl: ch?.tripoModelUrl || ch?.modelUrl || "",
      meshCount: ctrl?.state?.morphMeshes?.length ?? 0,
    };
  });

  record("3D canvas visible", state.canvasVisible);
  record("2D layer hidden in 3D mode", state.layer2dHidden);
  record("Live layer hidden in 3D mode", state.layerLiveHidden);
  record("modelKind is gltf", state.modelKind === "gltf", state.modelKind);
  record("status mentions Tripo/glTF", /Tripo|glTF/i.test(state.statusText), state.statusText);
  record("modelUrl saved on character", Boolean(state.savedModelUrl), state.savedModelUrl?.slice(0, 60));
  record("no GLB console errors", glbErrors.length === 0, glbErrors.join(" | ") || "none");

  await page.click('[data-gen-ai-stage-renderer="2d"]');
  await page.waitForTimeout(300);
  const mode2d = await page.evaluate(
    () => !document.querySelector("[data-gen-ai-stage-layer-2d]")?.hidden
  );
  record("2D switch works", mode2d);

  await page.click('[data-gen-ai-stage-renderer="live"]');
  await page.waitForTimeout(300);
  const modeLive = await page.evaluate(
    () => !document.querySelector("[data-gen-ai-stage-layer-live]")?.hidden
  );
  record("Live switch works", modeLive);

  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForTimeout(2000);
  const back3d = await page.evaluate(async () => {
    const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
    return ctrl?.state?.modelKind === "gltf";
  });
  record("3D re-switch shows gltf", back3d);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n3D GLB verify: ${results.length - failed}/${results.length} passed`);
  if (glbErrors.length) console.log("Console:", glbErrors);
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await browser.close();
  server.close();
}
