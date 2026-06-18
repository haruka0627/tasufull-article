/**
 * 2D Live / 3Dチケット — Checkout + DB反映 + get-plan 検証（テストモード）
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

const user2d = `e2e_2d_${Date.now()}`;
const user3d = `e2e_3d_${Date.now()}`;
const userBasic = `e2e_basic_${Date.now()}`;

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function post(fn, body) {
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log("--- Checkout session generation ---");
const liveCheckout = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_2d_live_300",
  user_id: user2d,
  origin: "http://localhost:5173",
});
check(
  "2D Live checkout",
  liveCheckout.status === 200 && liveCheckout.data.ok && liveCheckout.data.checkout_mode === "subscription",
  liveCheckout.data.session_id || liveCheckout.data.error
);

const ticketCheckout = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_3d_generate_500",
  user_id: user3d,
  origin: "http://localhost:5173",
});
check(
  "3D ticket checkout",
  ticketCheckout.status === 200 && ticketCheckout.data.ok && ticketCheckout.data.checkout_mode === "payment",
  ticketCheckout.data.session_id || ticketCheckout.data.error
);

const basicCheckout = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_basic_300",
  user_id: userBasic,
  origin: "http://localhost:5173",
});
check("Basic checkout (regression)", basicCheckout.status === 200 && basicCheckout.data.ok);

console.log("\n--- Simulate purchase → DB ---");
const sim2d = await post("stripe-e2e-simulate-genai-addon", {
  genai_plan: "genai_2d_live_300",
  user_id: user2d,
});
check(
  "2D Live simulate DB",
  sim2d.status === 200 && sim2d.data.ok && sim2d.data.entitlements?.live2dUnlimited === true,
  `twoDLive=${sim2d.data.twoDLive}`
);

const sim3d = await post("stripe-e2e-simulate-genai-addon", {
  genai_plan: "genai_3d_generate_500",
  user_id: user3d,
});
check(
  "3D ticket simulate DB",
  sim3d.status === 200 && sim3d.data.ok && Number(sim3d.data.tickets3dRemaining) >= 1,
  `remaining=${sim3d.data.entitlements?.tickets3dRemaining}`
);

console.log("\n--- get-plan ---");
const plan2d = await post("stripe-get-genai-plan", { user_id: user2d });
check(
  "get-plan 2D Live",
  plan2d.status === 200 &&
    plan2d.data.entitlements?.live2dUnlimited === true &&
    plan2d.data.entitlements?.twoDLive === true,
  JSON.stringify({
    live2d: plan2d.data.entitlements?.live2dUnlimited,
    twoDLive: plan2d.data.entitlements?.twoDLive,
  })
);

const plan3d = await post("stripe-get-genai-plan", { user_id: user3d });
check(
  "get-plan 3D tickets",
  plan3d.status === 200 && Number(plan3d.data.entitlements?.tickets3dRemaining) >= 1,
  `remaining=${plan3d.data.entitlements?.tickets3dRemaining}`
);

const simBasic = await post("stripe-e2e-simulate-genai-subscription", {
  genai_plan: "genai_basic_300",
  user_id: userBasic,
});
check(
  "Basic simulate (regression)",
  simBasic.status === 200 && simBasic.data.ok && simBasic.data.plan?.plan === "basic_300",
  simBasic.data.plan?.label
);

const confirmBad = await post("stripe-confirm-genai-checkout", {
  session_id: "cs_test_invalid",
});
check("confirm invalid (regression)", confirmBad.status >= 400);

console.log(`\nTotal failed: ${failed}`);
process.exit(failed ? 1 : 0);
