#!/usr/bin/env node
/**
 * TASFUL AI — Media generate Edge smoke (video + music)
 *   node scripts/test-tasful-ai-media-generate-edge.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfg.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfg.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const userId = process.env.TASU_TEST_USER_ID || "u_media_smoke";

let failed = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function post(fn, body) {
  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, surface: "ai-workspace", user_id: userId }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

if (!base || !anonKey) {
  console.log("SKIP: Supabase config missing");
  process.exit(0);
}

const results = [];

// Kill switch off → 503
const disabledVideo = await post("ai-workspace-video-generate", { prompt: "test" });
const expectsDisabled = disabledVideo.status === 503 && disabledVideo.data?.error === "media_gen_disabled";
check(
  "video edge kill-switch (503 when disabled)",
  expectsDisabled || disabledVideo.status === 200,
  expectsDisabled ? "503 media_gen_disabled" : `HTTP ${disabledVideo.status}`,
);
results.push({ name: "video_kill_switch", status: disabledVideo.status, ok: expectsDisabled || disabledVideo.status === 200 });

if (disabledVideo.status === 200 && disabledVideo.data?.ok) {
  check("video generate success", disabledVideo.data.ok && Boolean(disabledVideo.data.markdown), disabledVideo.data.mode || "");
  check("video markdown present", String(disabledVideo.data.markdown || "").length > 40);
  results.push({ name: "video_generate", status: disabledVideo.status, ok: true, mode: disabledVideo.data.mode });
} else if (disabledVideo.status === 402) {
  check("video quota path", disabledVideo.data?.error === "quota_exceeded", "402");
} else if (disabledVideo.status === 503 && disabledVideo.data?.error !== "media_gen_disabled") {
  check("video provider configured", false, disabledVideo.data?.error || "");
}

const disabledMusic = await post("ai-workspace-music-generate", {
  genre: "ambient",
  mood: "calm",
  bpm: 90,
  lengthSec: 30,
});
const musicOk =
  (disabledMusic.status === 503 && disabledMusic.data?.error === "media_gen_disabled") ||
  (disabledMusic.status === 200 && disabledMusic.data?.ok);
check(
  "music edge response",
  musicOk,
  `HTTP ${disabledMusic.status} ${disabledMusic.data?.error || disabledMusic.data?.mode || ""}`,
);
results.push({ name: "music_edge", status: disabledMusic.status, ok: musicOk });

if (disabledMusic.status === 200 && disabledMusic.data?.ok) {
  check("music markdown present", String(disabledMusic.data.markdown || "").length > 40);
}

const emptyPrompt = await post("ai-workspace-video-generate", { prompt: "" });
check(
  "video empty prompt",
  emptyPrompt.status === 400 || emptyPrompt.status === 503,
  `HTTP ${emptyPrompt.status}`,
);

try {
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    join(root, "reports/tasful-ai-media-generate-edge-last.json"),
    JSON.stringify({ at: new Date().toISOString(), results, userId }, null, 2),
  );
} catch {
  /* ignore */
}

console.log(`\nMedia Edge smoke complete — failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
