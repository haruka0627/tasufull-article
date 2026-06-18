import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { readFileSync, writeFileSync } from "node:fs";
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

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(5000);

const out = join(root, "supabase", ".temp-stripe-checkout.png");
await page.screenshot({ path: out, fullPage: true });

const frames = page.frames().map((f) => ({ url: f.url().slice(0, 120), name: f.name() }));
const inputs = await page.locator("input").evaluateAll((els) =>
  els.map((el) => ({
    name: el.getAttribute("name"),
    type: el.getAttribute("type"),
    placeholder: el.getAttribute("placeholder"),
    id: el.id,
    autocomplete: el.getAttribute("autocomplete"),
  }))
);

writeFileSync(
  join(root, "supabase", ".temp-stripe-dom.json"),
  JSON.stringify({ url: page.url(), frames, inputs }, null, 2)
);
console.log("screenshot", out);
console.log("dom", join(root, "supabase", ".temp-stripe-dom.json"));
});

await closeAllBrowsers();
