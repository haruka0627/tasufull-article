import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "detail-skill.html",
  "business.html",
  "worker.html",
  "job-top.html",
  "product.html",
  "detail-business.html",
  "detail-worker.html",
  "index.html",
  "detail-job.html",
  "post.html",
  "detail-product.html",
  "favorites-list.html",
  "skill.html",
  "chat-detail.html",
  "chat-list.html",
];

const needle = '<script src="chat-supabase-config.js"></script>';
const insert =
  '<script src="chat-supabase-config.js"></script>\n  <script src="tasu-supabase-client.js"></script>';

for (const file of files) {
  const path = file;
  let text = readFileSync(path, "utf8");
  if (!text.includes(needle) || text.includes("tasu-supabase-client.js")) {
    console.log("skip", file);
    continue;
  }
  text = text.replace(needle, insert);
  writeFileSync(path, text, "utf8");
  console.log("patched", file);
}
