/**
 * 汎用チャット（キャラなし）の自然さチェック
 */
import { readFileSync } from "node:fs";

const configText = readFileSync("chat-supabase-config.js", "utf8");
const base = configText.match(/url:\s*["']([^"']+)["']/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = configText.match(/anonKey:\s*["']([^"']+)["']/)?.[1] || "";

if (!base || !anonKey) {
  console.log("SKIP: Supabase config incomplete");
  process.exit(0);
}

const endpoint = `${base}/functions/v1/gemini-chat`;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const BAD_PHRASES = [
  /お手伝いできる/,
  /詳しく教えて/,
  /お気軽に/,
  /ご希望ですか/,
  /することができます/,
  /素晴らしい/,
  /ご安心ください/,
  /いかがでしょうか/,
  /AIなので/,
  /AIとして/,
  /私はAI/,
  /生成AI/,
  /アシスタントです/,
  /実際には何も/,
  /食事はしません/,
];

const CASES = [
  "疲れた",
  "こんにちは",
  "何してた？",
  "体が痛い",
  "今日なに食べた？",
  "最近つまらない",
  "仕事辞めたい",
  "天気悪いね",
  "ありがとう",
  "またね",
];

let failed = 0;

for (const message of CASES) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      mode: "汎用チャット",
      character: null,
      history: [],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const reply = String(data.reply || "").trim();
  const bad = BAD_PHRASES.filter((re) => re.test(reply)).map(String);
  const tooLong = reply.split(/[。！？\n]/).filter(Boolean).length > 5;
  const tooFormal = /(?:です|ます)[。！？]?$/.test(reply) && reply.length > 20;
  const ok = res.ok && reply && bad.length === 0 && !tooLong && data.usedGemini === true;

  console.log(`\n--- ${message} ---`);
  console.log(`reply: ${reply}`);
  console.log(
    `${ok ? "PASS" : "FAIL"}${bad.length ? ` bad=${bad.join(",")}` : ""}${tooLong ? " tooLong" : ""}${tooFormal ? " formal" : ""}`
  );

  if (!ok) failed++;
}

console.log(`\nTotal: ${CASES.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
