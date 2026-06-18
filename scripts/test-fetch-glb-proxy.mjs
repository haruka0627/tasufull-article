import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";
const taskId = "5c1b78ec-410e-4932-ad94-d8e5bb6e4f3e";
const base = "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1/genai-3d-generate";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const poll = await fetch(base, {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "task_poll", taskId }),
}).then((r) => r.json());

const url = poll.modelUrl;
console.log("poll ok", poll.status, url?.slice(0, 70));

const res = await fetch(base, {
  method: "POST",
  headers,
  body: JSON.stringify({ action: "fetch_glb", url }),
});
console.log("fetch_glb status", res.status, res.headers.get("content-type"), res.headers.get("content-length"));
const buf = Buffer.from(await res.arrayBuffer());
console.log("magic", buf.slice(0, 4).toString("utf8"), "bytes", buf.length);
if (buf.slice(0, 4).toString("utf8") === "glTF") {
  const jsonLen = buf.readUInt32LE(12);
  const json = buf.slice(20, 20 + jsonLen).toString("utf8");
  console.log("draco", /draco/i.test(json), "extensions", json.slice(0, 200));
}
