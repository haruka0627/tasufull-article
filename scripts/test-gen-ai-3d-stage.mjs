/**
 * 生成AI 3Dステージ — 静的検証
 * node scripts/test-gen-ai-3d-stage.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");
const js3d = readFileSync(join(root, "gen-ai-character-3d.js"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");

const checks = [
  ["3d canvas in html", /data-gen-ai-char-3d-canvas/.test(html)],
  ["2d/3d toggle buttons", /data-gen-ai-stage-renderer="3d"/.test(html)],
  ["3d module script", /gen-ai-character-3d\.js/.test(html)],
  ["visual stack css", /ai-character-stage__visual-stack/.test(css)],
  ["3d mode class", /ai-character-stage--3d/.test(css)],
  ["mobile 640 breakpoint", /@media \(max-width: 640px\)/.test(css)],
  ["GenAiCharacter3D global", /global\.GenAiCharacter3D/.test(js3d)],
  ["glTF loader", /GLTFLoader/.test(js3d)],
  ["procedural fallback", /createProceduralFace/.test(js3d)],
  ["expression infer", /inferExpressionFromText/.test(js3d)],
  ["syncStageAvatar3D", /syncStageAvatar3D/.test(js)],
  ["setMouthSpeaking 3d sync", /setMouthSpeaking[\s\S]*syncStageAvatar3D/.test(js)],
  ["reply expression hook", /inferExpressionFromText\(reply\)/.test(js)],
  ["2d mouth preserved", /data-character-mouth/.test(html)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nTotal: ${checks.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
