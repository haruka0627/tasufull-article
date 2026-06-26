#!/usr/bin/env node
/**
 * TASFUL AI Final Phase — 統合テスト
 *   node scripts/test-tasful-ai-final-phase.mjs
 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function loadAiFinalStack(extra = {}, opts = {}) {
  const storage = new Map();
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    sessionStorage: {
      getItem: (k) => (storage.has(`s:${k}`) ? storage.get(`s:${k}`) : null),
      setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    CustomEvent: class CustomEvent {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts?.detail;
      }
    },
    document: { readyState: "complete", addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] },
    location: { search: "", pathname: "/ai-workspace.html" },
    TasuAiPlanModels: { getSelectedModelId: () => "gemini-flash" },
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  if (opts.mediaConfig) {
    sandbox.TasuAiMediaGenConfig = opts.mediaConfig;
  } else {
    vm.runInContext(fs.readFileSync(path.join(root, "ai-media-gen-config.js"), "utf8"), ctx, {
      filename: "ai-media-gen-config.js",
    });
  }
  for (const rel of [
    "ai-history-store.js",
    "ai-video-generate.js",
    "ai-music-generate.js",
    "ai-document-generate.js",
    "ai-workspace-history-bridge.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx, { filename: rel });
  }
  return { sandbox, ctx, storage };
}

// --- Isolation ---
{
  const gw = fs.readFileSync(path.join(root, "ai-model-gateway.js"), "utf8");
  const core = fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8");
  const secretary = fs.readFileSync(path.join(root, "admin-ai-secretary-phase2.js"), "utf8");
  const tlv = fs.readFileSync(path.join(root, "live/tlv-tasful-ai-entry.js"), "utf8");
  const platform = fs.readFileSync(path.join(root, "platform-search-hub.js"), "utf8");
  assert("isolation: gateway untouched", !/TasuAiHistoryStore|ai-video-generate/.test(gw));
  assert("isolation: builder core untouched", !/TasuAiHistoryStore|TasuAiVideoGenerate/.test(core));
  assert("isolation: ai secretary untouched", !/TasuAiHistoryStore/.test(secretary));
  assert("isolation: tlv untouched", !/TasuAiHistoryStore/.test(tlv));
  assert("isolation: platform hub untouched", !/TasuAiHistoryStore/.test(platform));
  assert("isolation: builder 24 actions", fs.readFileSync(path.join(root, "builder/builder-ai-actions.js"), "utf8").includes("candidate_recommendation"));
}

// --- AI History ---
{
  const { sandbox } = loadAiFinalStack();
  const H = sandbox.TasuAiHistoryStore;
  assert("history: 10 categories", H.CATEGORIES.length === 10);
  assert("history: 8 folders", H.FOLDERS.length === 8);
  const row = H.upsert({ category: "chat", title: "テスト相談", prompt: "hello", model: "test-model" });
  assert("history: upsert id", Boolean(row.id));
  H.toggleFavorite(row.id);
  assert("history: favorite", H.findById(row.id).favorite === true);
  H.update(row.id, { folderId: "work" });
  assert("history: folder update", H.findById(row.id).folderId === "work");
  assert("history: list search", H.list({ query: "テスト" }).length >= 1);
  assert("history: export", H.exportAll().version === 1);
}

// --- Video ---
{
  const { sandbox } = loadAiFinalStack();
  const mock = await sandbox.TasuAiVideoGenerate.generate({ prompt: "PR動画", allowMock: true });
  assert("video: mock ok", mock.ok && mock.mock);
  const { sandbox: s2 } = loadAiFinalStack({}, { mediaConfig: { video: { enabled: false, mock: false }, music: { enabled: false, mock: true } } });
  const unconfigured = await s2.TasuAiVideoGenerate.generate({ prompt: "test", allowMock: false });
  assert("video: unconfigured msg", unconfigured.message === "動画生成APIが未設定です");
}

// --- Music ---
{
  const { sandbox } = loadAiFinalStack();
  const mock = await sandbox.TasuAiMusicGenerate.generate({ genre: "pop", mood: "happy", allowMock: true });
  assert("music: mock ok", mock.ok && /モック/.test(mock.message));
  const { sandbox: s2 } = loadAiFinalStack({}, { mediaConfig: { video: { enabled: false, mock: false }, music: { enabled: false, mock: false } } });
  const unconfigured = await s2.TasuAiMusicGenerate.generate({ allowMock: false });
  assert("music: unconfigured msg", unconfigured.message === "音楽生成APIが未設定です");
}

// --- Document ---
{
  const { sandbox } = loadAiFinalStack();
  const doc = sandbox.TasuAiDocumentGenerate.generate({ type: "proposal", topic: "新サービス" });
  assert("document: markdown", doc.ok && doc.markdown.includes("# 提案書"));
  assert("document: 7 types", sandbox.TasuAiDocumentGenerate.DOC_TYPES.length === 7);
  const minutes = sandbox.TasuAiDocumentGenerate.generate({ type: "minutes", topic: "定例" });
  assert("document: minutes", minutes.markdown.includes("議事録"));
}

// --- History bridge / generation event ---
{
  const { sandbox } = loadAiFinalStack();
  sandbox.TasuAiHistoryBridge.recordGeneration({
    category: "video",
    prompt: "動画テスト",
    resultMarkdown: "# mock",
  });
  assert("history: generation saved", sandbox.TasuAiHistoryStore.list({ category: "video" }).length >= 1);
}

// --- HTML wiring ---
{
  const html = fs.readFileSync(path.join(root, "ai-workspace.html"), "utf8");
  assert("html: categories nav", html.includes("data-ai-workspace-categories"));
  assert("html: history category", html.includes('data-ai-workspace-category="history"'));
  assert("html: video script", html.includes("ai-video-generate.js"));
  assert("html: music script", html.includes("ai-music-generate.js"));
  assert("html: document script", html.includes("ai-document-generate.js"));
  assert("html: history store", html.includes("ai-history-store.js"));
  assert("html: categories css", html.includes("ai-workspace-categories.css"));
}

// --- Workspace categories module ---
{
  const mod = fs.readFileSync(path.join(root, "ai-workspace-categories.js"), "utf8");
  assert("categories: 6 tabs", (mod.match(/id: "/g) || []).length >= 6);
  assert("categories: resume", mod.includes("resumeHistory"));
  assert("categories: reuse", mod.includes("reuseHistory"));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- TASFUL AI Final Phase Summary ---\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
