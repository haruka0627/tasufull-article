#!/usr/bin/env node
/**
 * Web search Edge live probe (serper-search function — Brave or Serper via WEB_SEARCH_PROVIDER)
 *   node scripts/test-web-search-provider-edge.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfg.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfg.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

/** @type {{ name: string, ok: boolean, detail: string, provider?: string, preview?: string }[]} */
const probes = [];

function record(name, ok, detail = "", extra = {}) {
  probes.push({ name, ok, detail, ...extra });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(query, num = 3) {
  const res = await fetch(`${base}/functions/v1/serper-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, num }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

function validateResults(data) {
  if (data?.ok !== true || !Array.isArray(data?.results) || !data.results.length) return false;
  return data.results.every(
    (r) =>
      typeof r.title === "string" &&
      (typeof r.link === "string" || typeof r.url === "string") &&
      typeof r.snippet === "string"
  );
}

async function main() {
  if (!base || !anonKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }

  const cases = [
    { name: "Edge reachable — TASFUL", query: "TASFUL", num: 3 },
    { name: "Japanese query — 水漏れ修理 相場", query: "水漏れ修理 相場", num: 5 },
    { name: "Japanese query — 補助金 2026", query: "補助金 2026 中小企業", num: 3 },
    { name: "JA spot — 2026年 補助金 中小企業", query: "2026年 補助金 中小企業", num: 5 },
    { name: "JA spot — 埼玉 外壁塗装 相場", query: "埼玉 外壁塗装 相場", num: 5 },
    { name: "JA spot — AI ニュース 日本", query: "AI ニュース 日本", num: 5 },
    {
      name: "JA spot — Cloudflare Pages Supabase Edge Functions",
      query: "Cloudflare Pages Supabase Edge Functions",
      num: 5,
    },
  ];

  for (const c of cases) {
    const { httpStatus, data } = await post(c.query, c.num);
    const provider = data?.provider || "unknown";
    const shapeOk = validateResults(data);
    const creditsFail = /not enough credits/i.test(String(data?.message || ""));
    const braveKeyMissing = /BRAVE_SEARCH_API_KEY is not configured/i.test(String(data?.message || ""));
    const ok = httpStatus === 200 && shapeOk && provider === "brave";
    let detail = `HTTP ${httpStatus} provider=${provider} count=${data?.results?.length ?? 0}`;
    if (creditsFail) detail += " (Serper credits)";
    if (braveKeyMissing) detail += " (BRAVE_SEARCH_API_KEY missing on Edge)";
    if (data?.message && !ok) detail += ` msg=${String(data.message).slice(0, 80)}`;
    record(
      c.name,
      ok,
      detail,
      {
        provider,
        preview: data?.results?.[0]
          ? `${data.results[0].title?.slice(0, 40)} | ${(data.results[0].snippet || data.results[0].link || "").slice(0, 60)}`
          : "",
      }
    );
  }

  const out = join(root, "reports", "web-search-provider-edge-last.json");
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
