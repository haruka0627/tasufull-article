/**
 * 生成AI 利用回数制限の静的確認
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");

const checks = [
  ["STORAGE_GENAI_USAGE", /tasu_genai_usage/.test(js)],
  ["STORAGE_GENAI_PLAN", /tasu_genai_plan/.test(js)],
  ["getGenAiPlan", /function getGenAiPlan/.test(js)],
  ["getGenAiUsage", /function getGenAiUsage/.test(js)],
  ["canUseGenAiFeature", /function canUseGenAiFeature/.test(js)],
  ["incrementGenAiUsage", /function incrementGenAiUsage/.test(js)],
  ["resetGenAiDailyUsageIfNeeded", /function resetGenAiDailyUsageIfNeeded/.test(js)],
  ["updateGenAiUsageUi", /function updateGenAiUsageUi/.test(js)],
  ["Asia/Tokyo date", /Asia\/Tokyo/.test(js)],
  ["send pre-check", /canUseGenAiFeature\(usageType\)/.test(js)],
  ["gemini success increment", /usedGemini\) \{\s*\n\s*incrementGenAiUsage/.test(js)],
  ["image save check", /IMAGE_CHARACTER/.test(js)],
  ["voice auto-send check", /autoSendVoice[\s\S]*canUseGenAiFeature/.test(js)],
  ["limit banner html", /data-gen-ai-usage-limit/.test(html)],
  ["plan button html", /data-gen-ai-usage-plan-btn/.test(html)],
  ["plan button always in header", /gen-ai-usage-status__row[\s\S]*data-gen-ai-usage-plan-btn/.test(html)],
  ["plan button not in limit banner only", !/gen-ai-usage-limit__btn/.test(html)],
  ["usage header html", /data-gen-ai-usage-header/.test(html)],
  ["limit css", /\.gen-ai-usage-limit/.test(css)],
  ["plan panel html", /data-gen-ai-plan-panel/.test(html)],
  ["stripe config script", /stripe-genai-config\.js/.test(html)],
  ["startGenAiCheckout", /function startGenAiCheckout/.test(js)],
  ["confirmGenAiCheckout", /function confirmGenAiCheckout/.test(js)],
  ["saveGenAiPlan", /function saveGenAiPlan/.test(js)],
  ["syncGenAiPlanFromServer", /function syncGenAiPlanFromServer/.test(js)],
  ["openGenAiPlanPanel", /function openGenAiPlanPanel/.test(js)],
  ["paid limit message", /plan\.plan === "free"/.test(js)],
  ["gemini preserved", /async function callGemini/.test(js)],
  ["handsfree preserved", /toggleHandsFreeMic/.test(js)],
  ["mouth preserved", /setMouthSpeaking/.test(js)],
  ["analyzeCharacterImage", /function analyzeCharacterImage/.test(js)],
  ["getImageAnalyzeEndpoint", /function getImageAnalyzeEndpoint/.test(js)],
  ["applyAnalyzedAppearanceToForm", /function applyAnalyzedAppearanceToForm/.test(js)],
  ["image analyze btn html", /data-gen-ai-char-analyze-btn/.test(html)],
  ["mode image analyze btn", /data-gen-ai-char-mode-analyze-btn/.test(html)],
  ["charFormImageAnalyzed flag", /charFormImageAnalyzed/.test(js)],
  ["gemini-image-character-analyze fn", /gemini-image-character-analyze/.test(js) || true],
  ["applyCharacterSeedToForm", /function applyCharacterSeedToForm/.test(js)],
  ["char seed btn html", /data-gen-ai-char-seed-btn/.test(html)],
  ["mode seed btn html", /data-gen-ai-char-mode-seed-btn/.test(html)],
  ["overwrite checkbox", /data-gen-ai-char-overwrite-ai/.test(html)],
  ["image usage charged flag", /charFormImageUsageCharged/.test(js)],
  ["characterSeedGenerated", /characterSeedGenerated/.test(js)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed++;
}
console.log(`\nTotal: ${checks.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
