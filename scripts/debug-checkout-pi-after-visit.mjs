import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const anonKey = readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)[1];
const h = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" };
const base = "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1";

const c = await fetch(`${base}/stripe-create-genai-checkout`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ genai_plan: "genai_3d_generate_500", user_id: "u_me", origin: "http://127.0.0.1:5206" }),
}).then((r) => r.json());
console.log("session", c.session_id);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
await page.goto(c.url, { waitUntil: "domcontentloaded" });
for (const wait of [0, 3, 6, 10]) {
  if (wait) await page.waitForTimeout(wait * 1000);
  const pay = await fetch(`${base}/stripe-e2e-pay-genai-checkout`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ session_id: c.session_id }),
  }).then((r) => r.json());
  console.log(`after ${wait}s visit:`, pay);
  if (pay.ok) break;
}
});

await closeAllBrowsers();
