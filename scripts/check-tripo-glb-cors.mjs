import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";
const taskId = "5c1b78ec-410e-4932-ad94-d8e5bb6e4f3e";

const res = await fetch("https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/genai-3d-generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  },
  body: JSON.stringify({ action: "task_poll", taskId }),
});
const data = await res.json();
const u = data.modelUrl;
console.log("status", data.status, "url", u?.slice(0, 80));
const head = await fetch(u, { method: "HEAD" });
console.log("HEAD", head.status, "acao", head.headers.get("access-control-allow-origin"));
const get = await fetch(u);
console.log("GET", get.status, "acao", get.headers.get("access-control-allow-origin"), "bytes", get.headers.get("content-length"));
