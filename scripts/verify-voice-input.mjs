/**
 * 音声入力ハンズフリー機能の静的確認
 *
 * 手動確認チェックリスト: docs/gen-ai-voice-manual-checklist.md
 * UIスモーク: node scripts/verify-gen-ai-voice-ui-smoke.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");

const checks = [
  ["HTML mic button", /data-gen-ai-mic/.test(html)],
  ["HTML voice status", /data-gen-ai-voice-status/.test(html)],
  ["HTML data-voice-status", /data-voice-status/.test(html)],
  ["HTML mic label 話す", /🎙 話す/.test(html)],
  ["JS data-ai-speaking body", /data-ai-speaking/.test(js)],
  ["JS appendMessage", /function appendMessage/.test(js)],
  ["JS getMicButtonLabel", /function getMicButtonLabel/.test(js)],
  ["HTML auto send toggle", /data-gen-ai-auto-send-voice/.test(html)],
  ["JS SpeechRecognition", /webkitSpeechRecognition/.test(js)],
  ["JS isListening state", /\blet isListening\b/.test(js)],
  ["JS isSpeaking state", /\blet isSpeaking\b/.test(js)],
  ["JS autoSendVoice state", /\blet autoSendVoice\b/.test(js)],
  ["JS callGemini preserved", /async function callGemini/.test(js)],
  ["JS requestAssistantReply preserved", /async function requestAssistantReply/.test(js)],
  ["JS setMouthSpeaking preserved", /function setMouthSpeaking/.test(js)],
  ["JS mouth position preserved", /applyCharacterMouthPosition/.test(js)],
  ["JS character-mouth untouched in html", html.includes("character-mouth")],
  ["JS wait while speaking", /waitForSpeechEnd/.test(js)],
  ["JS recognition error message", /聞き取れませんでした/.test(js)],
  ["JS listening status", /聞き取り中/.test(js)],
  ["JS sending status", /送信中/.test(js)],
  ["JS mic toggle lock", /micToggleLock/.test(js)],
  ["JS listen restart suppress", /listenRestartSuppressed/.test(js)],
  ["JS permission error", /マイクの使用が許可されていません/.test(js)],
  ["JS iOS unsupported note", /data-gen-ai-voice-unsupported/.test(html)],
  ["JS getVoiceInputState export", /getVoiceInputState/.test(js)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed++;
}

console.log(`\nTotal: ${checks.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
