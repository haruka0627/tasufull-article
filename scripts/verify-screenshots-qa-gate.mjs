#!/usr/bin/env node
/**
 * QA Center 完了ゲート — 未登録 ⚠ が 1 以上なら exit 1
 *   node scripts/verify-screenshots-qa-gate.mjs
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";
import { assertQaCenterReady, formatPassReportQaSection } from "./lib/screenshots-qa.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const searchKeyword = process.argv[2] || "問い合わせ";

const { manifest } = await writeScreenshotsManifest(root);
const qaGate = assertQaCenterReady(manifest);
const qaSection = formatPassReportQaSection({ searchKeyword, manifest });

for (const line of qaSection.consoleLines) {
  console.log(line);
}

if (qaGate.ok) {
  console.log("QA GATE PASS");
} else {
  console.error("QA GATE FAIL:", qaGate.message);
  process.exitCode = 1;
}
