#!/usr/bin/env node
/**
 * gemini-chat CORS preflight check (production pages.dev origin)
 *
 *   node scripts/verify-gemini-chat-cors.mjs
 *   node scripts/verify-gemini-chat-cors.mjs --functions-base https://xxx.supabase.co/functions/v1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://tasufull-article.pages.dev";
const PREVIEW_ORIGIN = "https://44f9c066.tasufull-article.pages.dev";

function parseFunctionsBase() {
  const idx = process.argv.indexOf("--functions-base");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].replace(/\/$/, "");

  const cfgPath = path.join(ROOT, "deploy/cloudflare/dist/chat-supabase-config.js");
  const src = fs.readFileSync(cfgPath, "utf8");
  const m = src.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  if (!m) throw new Error("Could not read supabase URL from chat-supabase-config.js");
  return `${m[0]}/functions/v1`;
}

async function probePreflight(functionsBase, origin) {
  const url = `${functionsBase}/gemini-chat`;
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,apikey,content-type,x-client-info",
    },
  });
  const allowOrigin = res.headers.get("access-control-allow-origin") || "";
  const allowMethods = res.headers.get("access-control-allow-methods") || "";
  const allowHeaders = res.headers.get("access-control-allow-headers") || "";
  const ok =
    (res.status === 204 || res.status === 200) &&
    allowOrigin === origin &&
    /POST/i.test(allowMethods) &&
    /OPTIONS/i.test(allowMethods) &&
    /authorization/i.test(allowHeaders) &&
    /apikey/i.test(allowHeaders);
  return { origin, status: res.status, allowOrigin, allowMethods, allowHeaders, ok };
}

async function main() {
  const functionsBase = parseFunctionsBase();
  console.log(`[verify-gemini-chat-cors] base=${functionsBase}`);

  let failed = 0;
  for (const origin of [ORIGIN, PREVIEW_ORIGIN]) {
    const r = await probePreflight(functionsBase, origin);
    const label = r.ok ? "OK" : "NG";
    console.log(
      `  ${label}  OPTIONS origin=${origin} status=${r.status} allow-origin=${r.allowOrigin}`
    );
    if (!r.ok) failed++;
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
