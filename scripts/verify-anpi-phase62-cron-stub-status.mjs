#!/usr/bin/env node
import fs from "node:fs";

const map = {};
for (const line of fs.readFileSync("C:/Users/rubih/tasufull-article/.env.staging", "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) map[s.slice(0, i).trim()] = s.slice(i + 1).trim();
}
const url = map.SUPABASE_URL || map.TASFUL_SUPABASE_URL;
const key = map.SUPABASE_SERVICE_ROLE_KEY || map.TASFUL_SUPABASE_SERVICE_ROLE_KEY;
const ref = new URL(url).hostname.split(".")[0];
if (ref !== "ahlxuyvhzqdqaojiywmu") throw new Error("bad_ref:" + ref);

const runs = await (
  await fetch(
    `${url}/rest/v1/anpi_scheduler_runs?select=worker_id,error_safe,created_at&worker_id=like.anpi-p48-lease:cf-staging-*&order=created_at.desc&limit=3`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
).json();
const del = await (
  await fetch(
    `${url}/rest/v1/anpi_notification_deliveries?select=provider&order=created_at.desc&limit=10`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
).json();
const providers = [...new Set((Array.isArray(del) ? del : []).map((d) => d.provider).filter(Boolean))];
const wrangler = fs.readFileSync(
  "deploy/cloudflare/workers/anpi-staging-scheduler/wrangler.toml",
  "utf8"
);
const m = wrangler.match(/ANPI_NOTIFICATION_PROVIDER\s*=\s*"([^"]+)"/);
console.log(
  JSON.stringify(
    {
      project_ref: ref,
      recent_lease_count: Array.isArray(runs) ? runs.length : 0,
      recent_lease_error_safe: Array.isArray(runs) ? runs.map((r) => r.error_safe) : [],
      delivery_providers: providers,
      wrangler_provider: m ? m[1] : null,
    },
    null,
    2
  )
);
