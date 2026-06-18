import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");

const checks = [
  ["char image prepare", /prepareCharacterImage/.test(js)],
  ["compress", /compressCharacterImageFile/.test(js)],
  ["imageUrl field", /imageUrl/.test(js)],
  ["storage upload optional", /uploadCharacterImageToStorage/.test(js)],
  ["getStageImageSrc url fallback", /character\.imageUrl/.test(js)],
  ["char mode preview html", /data-gen-ai-char-mode-preview/.test(html)],
  ["cta button", /data-gen-ai-char-from-image-btn/.test(html)],
  ["jpg png webp accept", /accept="image\/jpeg,image\/png,image\/webp"/.test(html)],
  ["gemini preserved", /async function callGemini/.test(js)],
  ["handsfree preserved", /toggleHandsFreeMic/.test(js)],
  ["mouth preserved", /setMouthSpeaking/.test(js)],
  ["preview css", /char-from-image-cta__preview/.test(css)],
  ["supabase client script", /tasu-supabase-client\.js/.test(html)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed++;
}
console.log(`\nTotal: ${checks.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
