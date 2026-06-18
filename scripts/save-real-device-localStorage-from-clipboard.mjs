#!/usr/bin/env node
/**
 * Windows: クリップボードの JSON を fixtures/real-device-localStorage.json に保存
 * 実機で export-real-device-localStorage-console.js 実行後に使う
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "fixtures", "real-device-localStorage.json");

let raw = "";
try {
  raw = execSync(
    'powershell -NoProfile -Command "[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; Get-Clipboard -Raw"',
    { encoding: "utf8" }
  );
} catch (e) {
  console.error("クリップボード読み取り失敗:", e.message);
  process.exit(1);
}

raw = raw.trim();
if (!raw.includes("tasful:builder:mvp:v1")) {
  console.error("クリップボードに localStorage JSON がありません。");
  console.error("実機 Console で scripts/export-real-device-localStorage-console.js を実行してください。");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error("クリップボードの内容が JSON ではありません。");
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(parsed, null, 2));
console.log("Saved:", OUT);
console.log("Keys:", Object.keys(parsed).length);
