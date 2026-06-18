/**
 * 3Dチケット付与の session 冪等性テスト
 * node scripts/test-genai-3d-ticket-grant-idempotency.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER_ID = "u_me";
const PORT = 5206;
const origin = `http://127.0.0.1:${PORT}`;
const supabaseUrl = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

async function api(fn, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function runSql(sql) {
  const tmp = join(root, "supabase", ".temp-idempotency-test.sql");
  writeFileSync(tmp, sql);
  const result = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", tmp], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return result.status === 0;
}

function resetTicketsToZero() {
  return runSql(`
insert into public.gen_ai_3d_tickets (user_id, tickets_remaining, total_purchased, total_used, updated_at)
values ('${USER_ID}', 0, coalesce((select total_purchased from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0), coalesce((select total_used from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0), now())
on conflict (user_id) do update set tickets_remaining = 0, updated_at = now();
`);
}

function startStaticServer() {
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      const p = (req.url?.split("?")[0] || "/gen-ai-workspace.html").replace(/^\//, "");
      try {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(join(root, p)));
      } catch {
        res.writeHead(404).end("nf");
      }
    });
    s.listen(PORT, "127.0.0.1", () => resolve(s));
  });
}

async function payCheckoutSession(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cardNumber", { timeout: 60000 });
  await page.locator("#email").fill("e2e-idempotency@tasful.test");
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Test User");
  await page.getByRole("button", { name: /^支払う$/ }).click();
  await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 120000 });
  const sessionId = new URL(page.url()).searchParams.get("session_id");
  await browser.close();
  return sessionId;
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("=== 3D ticket grant idempotency ===\n");

if (!resetTicketsToZero()) {
  console.error("Could not reset tickets");
  process.exit(1);
}

const before = await api("stripe-get-genai-plan", { user_id: USER_ID });
const tickets0 = Number(before.data?.entitlements?.tickets3dRemaining) || 0;
record("0 tickets before", tickets0 === 0, `remaining=${tickets0}`);

const checkout = await api("stripe-create-genai-checkout", {
  genai_plan: "genai_3d_generate_500",
  user_id: USER_ID,
  origin,
});
record("checkout created", checkout.data?.ok, checkout.data?.session_id);

const server = await startStaticServer();
const sessionId = await payCheckoutSession(checkout.data.url);
server.close();
record("checkout paid", Boolean(sessionId), sessionId?.slice(0, 40));

const confirm1 = await api("stripe-confirm-genai-checkout", { session_id: sessionId });
const after1 = Number(confirm1.data?.tickets3dRemaining ?? confirm1.data?.entitlements?.tickets3dRemaining);
record("first confirm grants +1", confirm1.data?.ok && after1 === tickets0 + 1, `${tickets0} → ${after1}`);

const confirm2 = await api("stripe-confirm-genai-checkout", { session_id: sessionId });
const after2 = Number(confirm2.data?.tickets3dRemaining ?? confirm2.data?.entitlements?.tickets3dRemaining);
record("second confirm no extra grant", confirm2.data?.ok && after2 === tickets0 + 1, `still ${after2}`);

const confirm3 = await api("stripe-confirm-genai-checkout", { session_id: sessionId });
const after3 = Number(confirm3.data?.tickets3dRemaining ?? confirm3.data?.entitlements?.tickets3dRemaining);
record("third confirm no extra grant", confirm3.data?.ok && after3 === tickets0 + 1, `still ${after3}`);

const failed = results.filter((r) => !r.ok).length;
process.exit(failed ? 1 : 0);
