#!/usr/bin/env node
/**
 * Japanese search comparison — direct Brave vs Serper (when keys available) + Edge snapshot
 *   node --env-file=.env scripts/test-web-search-brave-ja-compare.mjs
 *
 * Env: BRAVE_SEARCH_API_KEY, SERPER_API_KEY (optional — skips if missing)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const JA_QUERIES = [
  "水漏れ修理 相場",
  "IT補助金 2026",
  "TASFUL AI",
];

async function directBrave(query, apiKey) {
  const params = new URLSearchParams({
    q: query,
    count: "5",
    country: "JP",
    search_lang: "jp",
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  const rows = data?.web?.results || [];
  return {
    ok: res.ok && rows.length > 0,
    status: res.status,
    count: rows.length,
    top: rows[0]
      ? { title: rows[0].title, url: rows[0].url, snippet: (rows[0].description || "").slice(0, 120) }
      : null,
  };
}

async function directSerper(query, apiKey) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 5, gl: "jp", hl: "ja" }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  const rows = data?.organic || [];
  return {
    ok: res.ok && rows.length > 0,
    status: res.status,
    count: rows.length,
    top: rows[0]
      ? { title: rows[0].title, url: rows[0].link, snippet: (rows[0].snippet || "").slice(0, 120) }
      : null,
    error: data?.message || (res.ok ? "" : await res.text().catch(() => "")),
  };
}

async function main() {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const serperKey = process.env.SERPER_API_KEY?.trim();
  /** @type {object[]} */
  const comparisons = [];

  console.log(`Brave key: ${braveKey ? "SET" : "MISSING"}`);
  console.log(`Serper key: ${serperKey ? "SET" : "MISSING"}\n`);

  for (const query of JA_QUERIES) {
    const row = { query, brave: null, serper: null };
    if (braveKey) {
      row.brave = await directBrave(query, braveKey);
      console.log(
        `${row.brave.ok ? "PASS" : "FAIL"} Brave direct — "${query}" — ${row.brave.count} results`
      );
    } else {
      console.log(`SKIP Brave direct — "${query}" — no BRAVE_SEARCH_API_KEY`);
    }
    if (serperKey) {
      row.serper = await directSerper(query, serperKey);
      console.log(
        `${row.serper.ok ? "PASS" : "FAIL"} Serper direct — "${query}" — ${row.serper.count} results${row.serper.error ? ` (${String(row.serper.error).slice(0, 60)})` : ""}`
      );
    } else {
      console.log(`SKIP Serper direct — "${query}" — no SERPER_API_KEY in env`);
    }
    comparisons.push(row);
  }

  console.log("\n--- Edge live (current deploy) ---");
  spawnSync("node", ["scripts/test-web-search-provider-edge.mjs"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
  });

  const out = join(root, "reports", "web-search-brave-ja-compare.json");
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ capturedAt: new Date().toISOString(), comparisons }, null, 2)
  );
  console.log(`\nWrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
