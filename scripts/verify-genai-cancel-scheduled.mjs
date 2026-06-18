/**
 * 解約予約状態の API / DB 確認（本番）
 */
const url = "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA";

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

const userId = process.env.GENAI_TEST_USER || "u_me";

const getPlan = await post("stripe-get-genai-plan", { user_id: userId });
const portal = await post("stripe-create-genai-portal", {
  userId,
  returnUrl: "gen-ai-workspace.html",
});
const checkout = await post("stripe-create-genai-checkout", {
  genai_plan: "genai_basic_300",
  user_id: userId,
  origin: "http://localhost:5173",
});
const confirmInvalid = await post("stripe-confirm-genai-checkout", {
  session_id: "cs_test_invalid",
});

console.log("user:", userId);
console.log("get-plan:", getPlan.status, JSON.stringify(getPlan.data, null, 2));
console.log("portal:", portal.status, portal.data.ok ? "url ok" : portal.data);
console.log("checkout:", checkout.status, checkout.data.ok ? "url ok" : checkout.data.error);
console.log("confirm-invalid:", confirmInvalid.status, confirmInvalid.data.error ? "expected error" : confirmInvalid.data);

const plan = getPlan.data?.plan;
const ok =
  getPlan.status === 200 &&
  getPlan.data.ok &&
  plan &&
  plan.dailyTextLimit >= 30 &&
  typeof plan.cancelAtPeriodEnd === "boolean" &&
  "currentPeriodEnd" in plan &&
  portal.status === 200 &&
  checkout.status === 200 &&
  confirmInvalid.status >= 400;

if (plan?.cancelScheduled) {
  console.log("cancel scheduled UI fields: OK", plan.currentPeriodEnd);
} else {
  console.log("cancel scheduled: not active (run Portal cancel test to enable)");
}

process.exit(ok ? 0 : 1);
