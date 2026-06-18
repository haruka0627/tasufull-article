#!/usr/bin/env node
/**
 * プラン別 AI モデル選択 E2E（orchestrator テストへ統合済み）
 *
 *   node scripts/test-ai-search-orchestrator-browser.mjs
 *   node scripts/test-ai-plan-model-selector-browser.mjs  # 同上を実行
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(dir, "test-ai-search-orchestrator-browser.mjs");

const child = spawn(process.execPath, [target], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
