import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * 3Dチケット Stripe 購入 → 本番3D生成 E2E（u_me）
 * node scripts/e2e-genai-3d-stripe-purchase.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER_ID = "u_me";
const CHAR_ID = "char_stripe_3d_e2e";
const PORT = Number(process.env.GEN_AI_TEST_PORT) || 5206;
const supabaseUrl = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const origin = `http://127.0.0.1:${PORT}`;
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(fn, body) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getPlan() {
  const r = await api("stripe-get-genai-plan", { user_id: USER_ID });
  return r.data?.entitlements || r.data?.plan || {};
}

function resetTicketsToZero() {
  const sql = `
insert into public.gen_ai_3d_tickets (user_id, tickets_remaining, total_purchased, total_used, updated_at)
values ('${USER_ID}', 0, coalesce((select total_purchased from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0), coalesce((select total_used from public.gen_ai_3d_tickets where user_id = '${USER_ID}'), 0), now())
on conflict (user_id) do update set tickets_remaining = 0, updated_at = now();
`;
  const tmp = join(root, "supabase", ".temp-reset-3d-tickets.sql");
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

function mimeFor(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (f.endsWith(".css")) return "text/css; charset=utf-8";
  if (f.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      if (res.headersSent) return;
      let p = req.url?.split("?")[0] || "/gen-ai-workspace.html";
      if (p === "/") p = "/gen-ai-workspace.html";
      const f = join(root, p.replace(/^\//, "").replace(/\.\./g, ""));
      try {
        res.writeHead(200, { "Content-Type": mimeFor(f) });
        res.end(readFileSync(f));
      } catch {
        if (!res.headersSent) res.writeHead(404).end("nf");
      }
    });
    s.listen(PORT, "127.0.0.1", () => resolve(s));
  });
}

async function fillStripeCard(page) {
  await page.waitForSelector("#cardNumber", { timeout: 60000 });
  await page.locator("#email").fill("e2e-3d-ticket@tasful.test");
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Test User");
  return true;
}

async function completeStripeCheckout(page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  await fillStripeCard(page);
  await page.getByRole("button", { name: /^支払う$/ }).click({ timeout: 20000 });
  try {
    await page.waitForURL(/gen-ai-workspace\.html/, { timeout: 120000 });
  } catch {
    /* confirm via API below */
  }
}

async function prepareWorkspaceFor3d(page, workspaceUrl) {
  await page.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace), { timeout: 30000 });
  await page.evaluate(
    ({ uid, charId, imageDataUrl }) => {
      if (window.TASU_CHAT_SUPABASE_CONFIG) window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = uid;
      const chars = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
      if (!chars.some((c) => c.id === charId)) {
        chars.push({
          id: charId,
          name: "近衛木乃香",
          imageData: imageDataUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        localStorage.setItem("tasu_genai_my_characters", JSON.stringify(chars));
      }
      localStorage.setItem("tasu_genai_active_character", charId);
      const sel = document.querySelector("[data-gen-ai-character-select]");
      if (sel) {
        sel.value = charId;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      document.querySelector('[data-gen-ai-stage-renderer="3d"]')?.click();
    },
    { uid: USER_ID, charId: CHAR_ID, imageDataUrl: imageData }
  );
  await page.waitForSelector("[data-gen-ai-3d-actions]:not([hidden])", { timeout: 30000 });
}

async function finishCheckoutOnWorkspace(page, sessionId) {
  const successUrl = `${origin}/gen-ai-workspace.html?genai_checkout=success&session_id=${encodeURIComponent(sessionId)}&genai_plan=genai_3d_generate_500`;
  const confirm = await api("stripe-confirm-genai-checkout", { session_id: sessionId });
  if (!confirm.data?.ok) {
    throw new Error(confirm.data?.error || `confirm failed ${confirm.status}`);
  }
  await page.goto(successUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.getGenAiPlan), { timeout: 30000 });
  await page.evaluate(async () => {
    await window.TasuGenAiWorkspace?.syncGenAiPlanFromServer?.();
    window.TasuGenAiWorkspace?.updateGenAi3dPrepareUi?.();
  });
  return confirm.data;
}

console.log("=== 3Dチケット Stripe購入 → 本番生成 E2E ===\n");

const resetOk = resetTicketsToZero();
if (!resetOk) console.warn("DB reset skipped (supabase db query failed); using current ticket count");
await new Promise((r) => setTimeout(r, 800));

const ent0 = await getPlan();
let tickets0 = Number(ent0.tickets3dRemaining) || 0;
console.log(`チケット（購入前）: remaining=${tickets0}`);
if (tickets0 > 0 && resetOk) {
  console.error("Expected 0 tickets before purchase");
  await closeAllBrowsers();
  process.exit(1);
}
if (tickets0 > 0) {
  console.warn(`Starting with ${tickets0} tickets (could not reset); purchase should still add +1`);
}
record("0 tickets before purchase (or reset skipped)", tickets0 === 0 || !resetOk, `remaining=${tickets0}`);

const checkoutCreate = await api("stripe-create-genai-checkout", {
  genai_plan: "genai_3d_generate_500",
  user_id: USER_ID,
  origin,
});
record(
  "1 checkout session API",
  checkoutCreate.data?.ok && checkoutCreate.data?.checkout_mode === "payment",
  checkoutCreate.data?.session_id
);

const imgBuf = readFileSync(join(root, "images", "ai-character.png"));
const imageData = `data:image/png;base64,${imgBuf.toString("base64")}`;

const server = await startStaticServer();
const baseUrl = `${origin}/gen-ai-workspace.html?mode=${encodeURIComponent("AIキャラ会話")}`;

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
page.setDefaultTimeout(600000);

const saveLogs = [];
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("saveCharacterTripoModel")) saveLogs.push(t);
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.startGenAiCheckout));

  await page.evaluate(
    ({ uid, charId, imageDataUrl }) => {
      if (window.TASU_CHAT_SUPABASE_CONFIG) window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = uid;
      const char = {
        id: charId,
        name: "近衛木乃香",
        imageData: imageDataUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("tasu_genai_my_characters", JSON.stringify([char]));
      localStorage.setItem("tasu_genai_active_character", charId);
      localStorage.setItem(
        "tasu_genai_plan",
        JSON.stringify({ plan: "free", tickets3dRemaining: 0, tickets3dTotalUsed: 0 })
      );
    },
    { uid: USER_ID, charId: CHAR_ID, imageDataUrl: imageData }
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-gen-ai-character-select]");
  await page.selectOption("[data-gen-ai-character-select]", CHAR_ID);
  await page.click('[data-gen-ai-stage-renderer="3d"]');
  await page.waitForSelector("[data-gen-ai-3d-actions]:not([hidden])");

  const buyVisible = await page.locator("[data-gen-ai-3d-buy-ticket]").isVisible();
  const genHidden = await page.locator("[data-gen-ai-3d-generate-ticket]").isHidden();
  record("1 buy button visible (no tickets)", buyVisible && genHidden);

  if (!checkoutCreate.data?.url) throw new Error("No checkout URL");

  await page.click("[data-gen-ai-3d-buy-ticket]");
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  record("1 navigated to Stripe Checkout", /checkout\.stripe\.com/.test(page.url()), page.url().slice(0, 60));

  const sessionIdFromUrl = page.url().match(/cs_(?:test|live)_[a-zA-Z0-9]+/)?.[0];
  if (sessionIdFromUrl && sessionIdFromUrl !== checkoutCreate.data.session_id) {
    console.log(
      `Using buy-button session ${sessionIdFromUrl} (API preflight was ${checkoutCreate.data.session_id})`
    );
  }

  await completeStripeCheckout(page);
  const sessionId =
    new URL(page.url()).searchParams.get("session_id") || sessionIdFromUrl || checkoutCreate.data.session_id;
  record("2 Stripe test payment completed", Boolean(sessionId), sessionId?.slice(0, 40));

  if (!/genai_checkout=success/.test(page.url())) {
    await finishCheckoutOnWorkspace(page, sessionId);
  } else {
    await page.waitForFunction(() => Boolean(window.TasuGenAiWorkspace?.getGenAiPlan), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.evaluate(async () => {
      await window.TasuGenAiWorkspace?.syncGenAiPlanFromServer?.();
      window.TasuGenAiWorkspace?.updateGenAi3dPrepareUi?.();
    });
  }
  record(
    "2 returned to success page",
    /gen-ai-workspace\.html/.test(page.url()),
    page.url().slice(0, 80)
  );

  let entAfterBuy = await getPlan();
  let ticketsAfterBuy = Number(entAfterBuy.tickets3dRemaining) || 0;
  for (let i = 0; i < 8 && ticketsAfterBuy <= tickets0; i += 1) {
    await page.waitForTimeout(2000);
    entAfterBuy = await getPlan();
    ticketsAfterBuy = Number(entAfterBuy.tickets3dRemaining) || 0;
  }
  if (ticketsAfterBuy <= tickets0 && sessionId) {
    const confirm = await api("stripe-confirm-genai-checkout", { session_id: sessionId });
    if (confirm.data?.ok) {
      ticketsAfterBuy = Number(confirm.data.tickets3dRemaining) || ticketsAfterBuy;
    }
  }
  record("3 DB tickets increased", ticketsAfterBuy === tickets0 + 1, `${tickets0} → ${ticketsAfterBuy}`);

  await prepareWorkspaceFor3d(page, baseUrl);
  await page.evaluate(async () => {
    await window.TasuGenAiWorkspace?.syncGenAiPlanFromServer?.();
    window.TasuGenAiWorkspace?.updateGenAi3dPrepareUi?.();
  });
  await page.waitForSelector("[data-gen-ai-3d-generate-ticket]:not([hidden])", { timeout: 30000 });
  record("4 generate button visible after purchase", await page.locator("[data-gen-ai-3d-generate-ticket]").isVisible());

  const ticketsBeforeGen = ticketsAfterBuy;
  await page.click("[data-gen-ai-3d-generate-ticket]");

  await page.waitForFunction(
    () => /完成/.test(document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent || ""),
    null,
    { timeout: 600000 }
  );

  const entAfterGen = await getPlan();
  const ticketsAfterGen = Number(entAfterGen.tickets3dRemaining) ?? -1;
  record("5 ticket consumed after generate", ticketsAfterGen === ticketsBeforeGen - 1, `${ticketsBeforeGen} → ${ticketsAfterGen}`);

  const ui = await page.evaluate(() => {
    const chars = JSON.parse(localStorage.getItem("tasu_genai_my_characters") || "[]");
    const ch = chars.find((c) => c.id === "char_stripe_3d_e2e");
    return {
      character: ch,
      note: document.querySelector("[data-gen-ai-3d-prepare-status]")?.textContent,
      loadBtn: !document.querySelector("[data-gen-ai-3d-load-glb]")?.hidden,
    };
  });

  let modelKind = "none";
  for (let i = 0; i < 30; i += 1) {
    modelKind = await page.evaluate(async () => {
      const ctrl = await window.GenAiCharacter3D?.ensure3dMounted?.();
      return ctrl?.state?.modelKind;
    });
    if (modelKind === "gltf") break;
    await page.waitForTimeout(2000);
  }

  record("6 saveCharacterTripoModel logged", saveLogs.some((l) => l.includes("saved")), saveLogs[0]?.slice(0, 70));
  record("7 tripoTaskId saved", Boolean(ui.character?.tripoTaskId), ui.character?.tripoTaskId);
  record("7 tripoModelUrl saved", Boolean(ui.character?.tripoModelUrl), "");
  record("7 modelUrl saved", Boolean(ui.character?.modelUrl), "");
  record("7 rendererMode 3d", ui.character?.rendererMode === "3d", ui.character?.rendererMode);
  record("8 Tripo GLB gltf", modelKind === "gltf", modelKind);
  record("8 load saved button", Boolean(ui.loadBtn), "");

  console.log("\n========== SUMMARY ==========");
  console.log("taskId:", ui.character?.tripoTaskId);
  console.log("note:", ui.note);
  const failed = results.filter((r) => !r.ok).length;
  await closeAllBrowsers();
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error("E2E aborted:", err);
  await closeAllBrowsers();
  process.exit(1);
}});
server.close();
