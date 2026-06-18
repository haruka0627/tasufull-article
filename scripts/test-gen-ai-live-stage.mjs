/**
 * Live2D風画像アニメ — 静的検証
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");

const checks = [
  ["live layer html", /data-gen-ai-stage-layer-live/.test(html)],
  ["live img", /data-gen-ai-char-live-img/.test(html)],
  ["blink overlays", /data-gen-ai-char-blink-left/.test(html)],
  ["3 renderer buttons", /data-gen-ai-stage-renderer="live"/.test(html)],
  ["mouth on stack", /visual-stack[\s\S]*data-character-mouth/.test(html)],
  ["breathe css", /gen-ai-live-breathe/.test(css)],
  ["blink css", /is-live-blink/.test(css)],
  ["setStageRendererMode", /function setStageRendererMode/.test(js)],
  ["characterHasCustomImage", /function characterHasCustomImage/.test(js)],
  ["syncLiveStageImage", /function syncLiveStageImage/.test(js)],
  ["startLiveBlinkLoop", /function startLiveBlinkLoop/.test(js)],
  ["auto live on new image", /lastStageAutoImageSrc/.test(js)],
  ["mouth position vars", /applyCharacterMouthPosition/.test(js)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nTotal: ${checks.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
