/**
 * 画像キャラ解析 API（appearance_only / seed / 実画像）
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

async function post(body) {
  const res = await fetch(`${url}/functions/v1/gemini-image-character-analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

let realWebp = null;
try {
  const buf = readFileSync(join(root, "images", "ai-character.webp"));
  realWebp = `data:image/webp;base64,${buf.toString("base64")}`;
  console.log("real image loaded:", Math.round(buf.length / 1024), "KB");
} catch (err) {
  console.warn("real image skip:", err.message);
}

console.log("--- appearance_only (tiny) ---");
const onlyTiny = await post({ imageData: tinyPng, purpose: "appearance_only" });
console.log(onlyTiny.status, onlyTiny.data.ok, onlyTiny.data.appearance?.slice(0, 60));

console.log("\n--- appearance_and_character_seed (tiny) ---");
const seedTiny = await post({
  imageData: tinyPng,
  purpose: "appearance_and_character_seed",
});
console.log(seedTiny.status, seedTiny.data.ok, seedTiny.data.seed);

let onlyReal = null;
let seedReal = null;

if (realWebp) {
  console.log("\n--- appearance_only (ai-character.webp) ---");
  onlyReal = await post({ imageData: realWebp, purpose: "appearance_only" });
  console.log(onlyReal.status, onlyReal.data.ok);
  console.log("appearance:", onlyReal.data.appearance);

  console.log("\n--- appearance_and_character_seed (ai-character.webp) ---");
  seedReal = await post({
    imageData: realWebp,
    purpose: "appearance_and_character_seed",
  });
  console.log(seedReal.status, seedReal.data.ok);
  console.log("appearance:", seedReal.data.appearance);
  console.log("seed:", seedReal.data.seed);
}

const ok =
  onlyTiny.status === 200 &&
  onlyTiny.data.ok &&
  onlyTiny.data.appearance &&
  (!realWebp ||
    (onlyReal?.status === 200 &&
      onlyReal.data.ok &&
      onlyReal.data.appearance &&
      seedReal?.status === 200 &&
      seedReal.data.ok &&
      seedReal.data.seed?.name &&
      seedReal.data.seed?.personality));

console.log(
  "\nseed tiny (optional):",
  seedTiny.status,
  seedTiny.data.ok ? "ok" : seedTiny.data.error || "fail"
);

process.exit(ok ? 0 : 1);
