/**
 * 生成AI Stripe API のスモークテスト（実決済は行わない）
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

async function post(fn, body) {
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const basic = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_basic_300",
  user_id: "u_stripe_test",
  origin: "http://localhost:5173",
});
check(
  "basic checkout",
  basic.status === 200 && basic.data.ok && basic.data.url,
  basic.data.checkout_mode || "subscription"
);

const live = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_2d_live_300",
  user_id: "u_stripe_test",
  origin: "http://localhost:5173",
});
check(
  "2d live checkout subscription mode",
  live.status === 200 && live.data.ok && live.data.checkout_mode === "subscription",
  live.data.url ? "has url" : live.data.error
);

const ticket = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_3d_generate_500",
  user_id: "u_stripe_test",
  origin: "http://localhost:5173",
});
check(
  "3d ticket checkout payment mode",
  ticket.status === 200 && ticket.data.ok && ticket.data.checkout_mode === "payment",
  ticket.data.url ? "has url" : ticket.data.error
);

const invalid = await post("stripe-create-genai-checkout", {
  genai_plan: "unknown_plan",
  user_id: "u_stripe_test",
});
check("invalid plan 400", invalid.status === 400);

const getPlan = await post("stripe-get-genai-plan", { user_id: "u_me" });
check(
  "get-plan entitlements shape",
  getPlan.status === 200 &&
    getPlan.data.ok &&
    getPlan.data.entitlements &&
    "live2dUnlimited" in getPlan.data.entitlements,
  `tickets=${getPlan.data.entitlements?.tickets3dRemaining}`
);

const confirmInvalid = await post("stripe-confirm-genai-checkout", {
  session_id: "cs_test_invalid",
});
check("confirm-invalid error", confirmInvalid.status >= 400);

const js = readFileSync(join(root, "gen-ai-workspace.js"), "utf8");
const cfg = readFileSync(join(root, "stripe-genai-config.js"), "utf8");
check("frontend ADDON_PLANS", /ADDON_PLANS/.test(cfg));
check("frontend has2dLiveUnlimited", /has2dLiveUnlimited/.test(js));
check("edge genai-checkout-plans", readFileSync(join(root, "supabase/functions/_shared/genai-checkout-plans.ts"), "utf8").includes("genai_2d_live_300"));

console.log(`\nTotal failed: ${failed}`);
process.exit(failed ? 1 : 0);
