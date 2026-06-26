#!/usr/bin/env node
/**
 * TASFUL AI Production Environment Fix — live Edge / Vision / Serper probes
 *   node scripts/verify-tasful-ai-production-environment.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfg.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfg.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** @type {{ name: string, edge: string, kind: string, httpStatus: number, ok: boolean, note: string, preview: string }[]} */
const probes = [];

function looksLikeVisionOk(reply) {
  const t = String(reply || "").toLowerCase();
  if (!t) return false;
  if (/don't see any image|画像が添付|画像を見ることができません|no image attached|provide the image/i.test(t)) {
    return false;
  }
  if (/prepayment credits|depleted|429|resource_exhausted/i.test(t)) return false;
  return t.length >= 1 && t.length <= 200;
}

async function post(edge, payload) {
  const res = await fetch(`${base}/functions/v1/${edge}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

async function main() {
  if (!base || !anonKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }

  const textPayload = {
    message: "preflight env fix ping",
    history: [],
    mode: "cross-matching",
    intent: "work",
  };
  const visionPayload = {
    message: "Describe this image in exactly one English word (color or shape).",
    history: [],
    mode: "cross-matching",
    intent: "work",
    attachments: [
      {
        name: "probe.png",
        mimeType: "image/png",
        kind: "image",
        base64: TINY_PNG,
        sizeBytes: 68,
      },
    ],
  };

  const cases = [
    { name: "OpenAI text", edge: "openai-chat", payload: textPayload, kind: "text" },
    { name: "Claude text", edge: "claude-chat", payload: textPayload, kind: "text" },
    { name: "Gemini text", edge: "gemini-chat", payload: textPayload, kind: "text" },
    { name: "OpenAI Vision", edge: "openai-chat", payload: visionPayload, kind: "vision" },
    { name: "Claude Vision", edge: "claude-chat", payload: visionPayload, kind: "vision" },
    { name: "Gemini Vision", edge: "gemini-chat", payload: visionPayload, kind: "vision" },
    { name: "Serper search", edge: "serper-search", payload: { query: "TASFUL", num: 3 }, kind: "serper" },
  ];

  for (const c of cases) {
    const { httpStatus, data } = await post(c.edge, c.payload);
    const reply = String(data?.reply || data?.message || data?.error || "");
    let ok = false;
    let note = `HTTP ${httpStatus}`;

    if (c.kind === "serper") {
      ok = data?.ok === true && Array.isArray(data?.results) && data.results.length > 0;
      if (!ok && /not enough credits/i.test(reply)) note += " — Serper credits depleted";
      else if (!ok && /not configured/i.test(reply)) note += " — SERPER_API_KEY missing";
    } else if (c.kind === "text") {
      ok = httpStatus === 200 && Boolean(data?.reply);
      if (httpStatus === 429) {
        ok = false;
        note += " — Gemini billing/credits";
      }
    } else {
      ok = httpStatus === 200 && looksLikeVisionOk(data?.reply);
      if (httpStatus === 429) note += " — Gemini billing/credits";
      else if (httpStatus === 200 && !ok) note += " — Vision payload not recognized by model";
    }

    probes.push({
      name: c.name,
      edge: c.edge,
      kind: c.kind,
      httpStatus,
      ok,
      note,
      preview: reply.slice(0, 160).replace(/\n/g, " "),
    });
    console.log(`${ok ? "PASS" : "FAIL"}: ${c.name} — ${note}${reply ? ` | ${reply.slice(0, 80).replace(/\n/g, " ")}` : ""}`);
  }

  const out = join(root, "reports", "tasful-ai-production-environment-probes.json");
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), edgeBase: base, probes }, null, 2)
  );
  console.log(`\nWrote ${out}`);

  const failed = probes.filter((p) => !p.ok);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
