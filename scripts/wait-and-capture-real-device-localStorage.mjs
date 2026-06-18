#!/usr/bin/env node
/**
 * fixtures/real-device-localStorage.json の出現を待ってからスクショ取得
 *
 * 使い方:
 *   1. 別ターミナルでこのスクリプトを起動
 *   2. 実機で export → fixtures/real-device-localStorage.json に保存
 *   3. 自動で capture-with-real-device-localStorage.mjs を実行
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "..", "fixtures", "real-device-localStorage.json");
const WAIT_MS = Number(process.env.WAIT_MS || 300000);
const INTERVAL_MS = 2000;

console.log("Waiting for:", FIXTURE);
console.log("実機でエクスポートして上記パスに保存してください（最大", WAIT_MS / 1000, "秒）");

const start = Date.now();
while (Date.now() - start < WAIT_MS) {
  if (fs.existsSync(FIXTURE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
      if (parsed["tasful:builder:mvp:v1"]) {
        console.log("Fixture detected. Running capture...");
        const child = spawn(process.execPath, [path.join(__dirname, "capture-with-real-device-localStorage.mjs")], {
          stdio: "inherit",
          cwd: path.join(__dirname, ".."),
        });
        child.on("exit", (code) => process.exit(code ?? 1));
        return;
      }
    } catch {
      /* retry */
    }
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.error("Timeout: fixture not found.");
process.exit(1);
