import { readFileSync } from "node:fs";

const configText = readFileSync("chat-supabase-config.js", "utf8");
const urlMatch = configText.match(/url:\s*["']([^"']+)["']/);
const keyMatch = configText.match(/anonKey:\s*["']([^"']+)["']/);

const base = urlMatch?.[1]?.replace(/\/$/, "") || "";
const anonKey = keyMatch?.[1] || "";

if (!base || !anonKey) {
  console.log("SKIP: Supabase config incomplete");
  process.exit(0);
}

const endpoint = `${base}/functions/v1/gemini-chat`;
const payload = {
  message: "こんにちは、テストです",
  mode: "汎用チャット",
  character: null,
  history: [],
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

const data = await res.json().catch(() => ({}));
console.log("status:", res.status);
console.log("hasReply:", Boolean(data.reply));
console.log("usedGemini:", data.usedGemini);
console.log("retryCount:", data.retryCount ?? 0);
console.log("error:", data.error || "");
if (data.reply) console.log("replyPreview:", String(data.reply).slice(0, 120));
if (!data.reply || data.usedGemini !== true) process.exit(1);
