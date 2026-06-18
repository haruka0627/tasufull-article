#!/usr/bin/env node
/**
 * Connectなし最終段 — 実画面ベンチ検証（headed）
 * benchPattern=skill-0 で「取引完了」→完了通知→レビューカードを目視確認用に開く
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inspectScript = path.join(__dirname, "inspect-bench-deposit-complete-flow.mjs");

const child = spawn(process.execPath, [inspectScript], {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_HEADED: "1",
    PLAYWRIGHT_SLOWMO: "120",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
