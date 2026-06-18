/**
 * AIキャラ会話の自然さチェック（gemini-chat Edge Function）
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
const character = {
  name: "近衛木乃香",
  personality: "明るく関西弁、親しみやすい",
  speakingStyle: "関西弁・カジュアル",
  firstPerson: "うち",
  userName: "ひろさん",
};

const BAD_PHRASES = [
  /お手伝いできる/,
  /詳しく教えて/,
  /お気軽に/,
  /ご希望ですか/,
  /することができます/,
  /素晴らしい/,
  /大変ですね/,
  /ご安心ください/,
  /いかがでしょうか/,
  /AIなので/,
  /AIとして/,
  /実際には何も/,
  /食事はしません/,
  /私は近衛木乃香/,
];

const CASES = [
  { message: "疲れた", note: "短く共感" },
  { message: "体が痛い", note: "自然に心配" },
  { message: "こんにちは", note: "自己紹介・毎回名前呼び禁止" },
  { message: "何してた？", note: "メタ発言禁止" },
  { message: "今日なに食べた？", note: "キャラとして自然に" },
];

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

let failed = 0;

for (const test of CASES) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: test.message, character, history: [] }),
  });
  const data = await res.json().catch(() => ({}));
  const reply = String(data.reply || "").trim();
  const bad = BAD_PHRASES.filter((re) => re.test(reply)).map(String);
  const tooLong = reply.split(/[。！？\n]/).filter(Boolean).length > 5;
  const startsWithName = /^ひろさん/.test(reply);
  const ok = res.ok && reply && bad.length === 0 && !tooLong && !startsWithName;

  console.log(`\n--- ${test.message} (${test.note}) ---`);
  console.log(`status: ${res.status}`);
  console.log(`reply: ${reply}`);
  console.log(`${ok ? "PASS" : "FAIL"}${bad.length ? ` badPhrases=${bad.join(", ")}` : ""}${tooLong ? " tooLong" : ""}${startsWithName ? " startsWithName" : ""}`);

  if (!ok) failed++;
}

console.log(`\nTotal: ${CASES.length}, Failed: ${failed}`);
process.exit(failed ? 1 : 0);
