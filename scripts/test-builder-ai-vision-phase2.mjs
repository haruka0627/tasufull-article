#!/usr/bin/env node
/**
 * Builder AI Vision Phase 2 — static checks
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

const html = fs.readFileSync(path.join(root, "builder/builder-ai.html"), "utf8");
const core = fs.readFileSync(path.join(root, "builder/builder-ai-core.js"), "utf8");
const vision = fs.readFileSync(path.join(root, "builder/builder-ai-vision.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "builder/builder-ai-ui.js"), "utf8");

if (html.includes("builder-ai-vision.js") && html.indexOf("builder-ai-vision.js") < html.indexOf("builder-ai-ui.js")) {
  ok("script order: core → vision → ui");
} else bad("script order: core → vision → ui");

if (core.includes("runFieldVision") && core.includes("attachments:")) ok("core runFieldVision + attachments");
else bad("core runFieldVision + attachments");

if (vision.includes("runFieldDiagnosis") && vision.includes("fileToImageAttachment")) ok("vision module");
else bad("vision module");

if (vision.includes("確定判断できません") && vision.includes("材料候補")) ok("vision prompt sections");
else bad("vision prompt sections");

if (vision.includes("MAX_IMAGE_BYTES") && vision.includes("4 * 1024 * 1024")) ok("4MB image limit");
else bad("4MB image limit");

if (ui.includes("TasuBuilderAIVision") && ui.includes("runFieldDiagnosis")) ok("ui wired to vision");
else bad("ui wired to vision");

if (!vision.includes("secretary") && !vision.includes("site-assistant") && !vision.includes("deepseek")) {
  ok("vision isolation");
} else bad("vision isolation");

if (!ui.includes("UI準備中")) ok("ui stub removed");
else bad("ui stub removed");

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
if (fail) process.exit(1);
