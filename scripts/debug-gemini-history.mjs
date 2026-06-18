import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configText = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = configText.match(/url:\s*["']([^"']+)["']/)[1].replace(/\/$/, "");
const anonKey = configText.match(/anonKey:\s*["']([^"']+)["']/)[1];
const endpoint = `${base}/functions/v1/gemini-chat`;

const payload = {
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
};

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  },
  body: JSON.stringify(payload),
});
const data = await res.json();
console.log(JSON.stringify({ status: res.status, data }, null, 2));
