/**
 * Gemini intent 別回答の確認
 */
import { readFileSync } from "node:fs";

const configText = readFileSync("chat-supabase-config.js", "utf8");
const base = configText.match(/url:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = configText.match(/anonKey:\s*["']([^"']+)["']/)?.[1] || "";

if (!base || !anonKey) {
  console.log("SKIP: config missing");
  process.exit(0);
}

const endpoint = `${base}/functions/v1/gemini-chat`;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const CASES = [
  {
    name: "A. 雑談",
    message: "疲れた",
    mode: "汎用チャット",
    intent: "chat",
    expectIntent: "chat",
    maxChars: 180,
    minChars: 5,
    forbid: [/お手伝いできる/, /AIなので/],
  },
  {
    name: "B. 作業依頼",
    message: "Cursorに出す指示を作って",
    mode: "汎用チャット",
    intent: "work",
    expectIntent: "work",
    minChars: 120,
    requireAny: [/指示|プロンプト|Cursor|##|1\.|```/i],
    forbid: [/AIなので/],
  },
  {
    name: "C. コード相談",
    message: "このエラーの原因と修正方法を教えて",
    mode: "汎用チャット",
    intent: "support",
    expectIntent: "support",
    minChars: 80,
    requireAny: [/原因|確認|修正|手順/i],
    forbid: [/AIなので/],
  },
  {
    name: "D. 事業相談",
    message: "このAI課金プランの収益性どう思う？",
    mode: "汎用チャット",
    intent: "business",
    expectIntent: "business",
    minChars: 80,
    requireAny: [/収益|単価|リスク|運用|プラン/i],
    forbid: [/AIなので/],
  },
  {
    name: "E. ハンズフリー",
    message: "Cursorに出す指示を作って",
    mode: "音声会話AI",
    intent: "chat",
    expectIntent: "chat",
    maxChars: 220,
    forbid: [/お手伝いできる/],
  },
];

let failed = 0;

for (const test of CASES) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: test.message,
      mode: test.mode,
      intent: test.intent,
      character: null,
      history: [],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const reply = String(data.reply || "").trim();
  const intent = data.intent || "";

  let ok =
    res.ok &&
    data.usedGemini === true &&
    reply.length > 0 &&
    intent === test.expectIntent;

  if (test.minChars && reply.length < test.minChars) ok = false;
  if (test.maxChars && reply.length > test.maxChars) ok = false;
  if (test.requireAny && !test.requireAny.some((re) => re.test(reply))) ok = false;
  if (test.forbid?.some((re) => re.test(reply))) ok = false;

  console.log(`\n--- ${test.name} ---`);
  console.log(`intent: ${intent} (expected ${test.expectIntent})`);
  console.log(`reply (${reply.length} chars): ${reply.slice(0, 200)}${reply.length > 200 ? "…" : ""}`);
  console.log(ok ? "PASS" : "FAIL");
  if (!ok) failed++;
}

console.log(`\nTotal: ${CASES.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
