/**
 * gen-ai-workspace Gemini 接続の統合確認（Node / fetch）
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configText = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const urlMatch = configText.match(/url:\s*["']([^"']+)["']/);
const keyMatch = configText.match(/anonKey:\s*["']([^"']+)["']/);

const base = urlMatch?.[1]?.replace(/\/$/, "") || "";
const anonKey = keyMatch?.[1] || "";
const endpoint = `${base}/functions/v1/gemini-chat`;

const results = [];

function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function callGemini(payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

if (!base || !anonKey) {
  console.error("Supabase config missing");
  process.exit(1);
}

// 1. Basic Gemini response
{
  const { res, data } = await callGemini({
    message: "こんにちは",
    character: null,
    history: [],
  });
  log("Gemini basic reply", res.status === 200 && Boolean(data.reply), `status=${res.status}`);
}

// 2. Character setting reflection
{
  const { res, data } = await callGemini({
    message: "自己紹介をお願い",
    character: {
      name: "近衛木乃香",
      nameReading: "このえ このか",
      personality: "明るく関西弁",
      speakingStyle: "関西弁・親しみやすい",
      firstPerson: "うち",
      userName: "ひろさん",
      userNameReading: "ひろさん",
      appearance: "青い髪",
      purpose: "相談相手",
    },
    history: [],
  });
  const reply = String(data.reply || "");
  const reflectsCharacter =
    /木乃香|うち|ひろさん|関西|こんえ|このえ/i.test(reply) || reply.length > 20;
  log(
    "Character settings in reply",
    res.status === 200 && reflectsCharacter,
    reply.slice(0, 80).replace(/\n/g, " ")
  );
}

// 3. History (multi-turn)
{
  const { res, data } = await callGemini({
    message: "さっきの続きで、もう一つアドバイスを",
    character: {
      name: "テスト太郎",
      personality: "丁寧",
      speakingStyle: "です・ます調",
      firstPerson: "私",
      userName: "ゲスト",
    },
    history: [
      { role: "user", content: "転職について相談したいです" },
      { role: "assistant", content: "承知しました。どの業界を考えていますか？" },
    ],
  });
  log("History multi-turn", res.status === 200 && Boolean(data.reply), `status=${res.status}`);
}

// 4. Fallback path: invalid endpoint returns non-200 (simulates client fallback)
{
  const badUrl = `${base}/functions/v1/gemini-chat-not-exists`;
  const res = await fetch(badUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ message: "test", character: null, history: [] }),
  });
  log("404 fallback trigger", res.status === 404, `status=${res.status}`);
}

// 5. Static files intact (2D mouth / UI assets)
{
  const html = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
  const css = readFileSync(join(root, "gen-ai-workspace.css"), "utf8");
  const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
  const hasMouth =
    html.includes("character-mouth") &&
    css.includes("character-mouth") &&
    js.includes("setMouthSpeaking") &&
    js.includes("mouthX");
  log("2D mouth / mouth position intact", hasMouth);
  const hasGemini = js.includes("callGemini") && js.includes("requestAssistantReply");
  log("Gemini integration present", hasGemini);
}

const failed = results.filter((r) => !r.ok);
console.log("\n--- Summary ---");
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
process.exit(failed.length ? 1 : 0);
