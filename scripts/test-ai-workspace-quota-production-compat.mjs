#!/usr/bin/env node
/**
 * TASFUL AI Workspace Phase 2 — production compatibility probes
 *   node scripts/test-ai-workspace-quota-production-compat.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfgSrc = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfgSrc.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfgSrc.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

const probes = [];

async function post(fn, body) {
  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const userId = `quota_compat_${Date.now().toString(36)}`;

  const cases = [
    {
      name: "ai-workspace-quota status",
      fn: "ai-workspace-quota",
      body: { action: "status", user_id: userId, surface: "ai-workspace" },
      expect: (s, d) => s === 200 && d.ok === true && Number(d.dailyLimit) >= 5,
    },
    {
      name: "gemini-chat text (non-workspace)",
      fn: "gemini-chat",
      body: { message: "compat ping", history: [] },
      expect: (s) => s === 200 || s === 429,
    },
    {
      name: "openai-chat workspace payload shape",
      fn: "openai-chat",
      body: {
        message: "compat workspace ping",
        history: [],
        surface: "ai-workspace",
        user_id: userId,
      },
      expect: (s) => s === 200 || s === 402 || s === 502 || s === 503,
    },
  ];

  for (const c of cases) {
    const { status, data } = await post(c.fn, c.body);
    const ok = c.expect(status, data);
    probes.push({
      name: c.name,
      httpStatus: status,
      ok,
      preview: JSON.stringify(data).slice(0, 160),
    });
    console.log(`${ok ? "PASS" : "FAIL"}: ${c.name} — HTTP ${status}`);
  }

  const out = join(root, "reports", "tasful-ai-workspace-quota-production-compat.json");
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), edgeBase: base, probes }, null, 2)
  );
  console.log(`Wrote ${out}`);

  const failed = probes.filter((p) => !p.ok);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
