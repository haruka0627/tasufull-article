import { chromium } from "./lib/playwright-browser.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5206;
const origin = `http://127.0.0.1:${PORT}`;
const anonKey = readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)[1];
const h = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" };
const base = "https://ddojquacsyqesrjhcvmn.supabase.co/functions/v1";

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

const c = await fetch(`${base}/stripe-create-genai-checkout`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ genai_plan: "genai_3d_generate_500", user_id: "u_me", origin }),
}).then((r) => r.json());

const server = await startStaticServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(c.url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#cardNumber", { timeout: 60000 });
await page.locator("#email").fill("e2e-3d-ticket@tasful.test");
await page.locator("#cardNumber").fill("4242424242424242");
await page.locator("#cardExpiry").fill("12 / 34");
await page.locator("#cardCvc").fill("123");
await page.locator("#billingName").fill("Test User");
await page.getByRole("button", { name: /^支払う$/ }).click();
await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 120000 });
console.log("redirect", page.url());

const sessionId = new URL(page.url()).searchParams.get("session_id");
const confirm = await fetch(`${base}/stripe-confirm-genai-checkout`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ session_id: sessionId }),
}).then((r) => r.json());
console.log("confirm", confirm);

const plan = await fetch(`${base}/stripe-get-genai-plan`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ user_id: "u_me" }),
}).then((r) => r.json());
console.log("tickets", plan.entitlements?.tickets3dRemaining);

await browser.close();
server.close();
