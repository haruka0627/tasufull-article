import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bak = readFileSync(join(root, "gen-ai-workspace.html.bak-a2"), "utf8");
const cur = readFileSync(join(root, "gen-ai-workspace.html"), "utf8");
const ai = readFileSync(join(root, "ai-workspace.html"), "utf8");

function attrs(t) {
  return new Set([...t.matchAll(/data-[a-z0-9-]+/gi)].map((m) => m[0]));
}
function scripts(t) {
  return [...t.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
}

const ba = attrs(bak);
const ca = attrs(cur);
const missing = [...ba].filter((x) => !ca.has(x));
console.log("gen data attrs missing", missing.length, missing.slice(0, 10));
console.log("gen scripts match", JSON.stringify(scripts(bak)) === JSON.stringify(scripts(cur)));
console.log("ai scripts", scripts(ai).length);
console.log(
  "ai hooks",
  ["data-ai-workspace-chat", "data-ai-chat-mode-title", "data-ai-chat-input", "data-ai-chat-send"].every(
    (h) => ai.includes(h),
  ),
);
