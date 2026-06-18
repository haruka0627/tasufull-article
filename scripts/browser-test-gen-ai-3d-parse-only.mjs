import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5198;
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const poll = await fetch("https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/genai-3d-generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
  body: JSON.stringify({ action: "task_poll", taskId: "5c1b78ec-410e-4932-ad94-d8e5bb6e4f3e" }),
}).then((r) => r.json());

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    let p = req.url?.split("?")[0] || "/gen-ai-workspace.html";
    const f = join(root, p.replace(/^\//, ""));
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(readFileSync(f));
  });
  s.listen(PORT, "127.0.0.1", () => resolve(s));
});

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
page.setDefaultTimeout(600000);
await page.goto(`http://127.0.0.1:${PORT}/gen-ai-workspace.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.TasuTripoGenAiConfig));

const result = await page.evaluate(async (url) => {
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
  const t0 = performance.now();
  try {
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(buf, "", resolve, reject);
    });
    return {
      ok: true,
      ms: Math.round(performance.now() - t0),
      children: gltf.scene?.children?.length ?? 0,
    };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: err?.message || String(err) };
  }
}, poll.modelUrl);

console.log(result);
});
server.close();
await closeAllBrowsers();
process.exit(result.ok ? 0 : 1);
