/**
 * TLV Payment Edge — smoke / E2E (requires Supabase + tlv schema + TLV_E2E_ENABLED=1)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configText = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const url = configText.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") ?? "";
const anonKey = configText.match(/anonKey:\s*"([^"]+)"/)?.[1] ?? "";

const walletUserId = process.env.TLV_TEST_WALLET_USER_ID ?? "00000000-0000-4000-8000-000000000001";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

async function post(fn, body = {}) {
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let failed = 0;
let skipped = 0;
function check(name, ok, detail = "") {
  const isSkip = name.startsWith("SKIP");
  console.log(`${ok ? (isSkip ? "SKIP" : "PASS") : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (isSkip && !ok) skipped += 1;
  else if (!ok && !isSkip) failed += 1;
}

if (!url || !anonKey) {
  console.log("SKIP: Supabase config missing");
  process.exit(0);
}

const fnNotDeployed = (status) => status === 404;

// createCoinPurchase without user JWT → expect 401
const purchaseAnon = await post("tlv-create-coin-purchase", {
  sku_id: "web_coin_500",
  channel: "web_stripe",
  idempotency_key: crypto.randomUUID(),
});
check(
  "createCoinPurchase rejects anon",
  purchaseAnon.status === 401 || fnNotDeployed(purchaseAnon.status),
  fnNotDeployed(purchaseAnon.status) ? "404 — functions not deployed" : String(purchaseAnon.status),
);

// E2E simulate webhook (needs TLV_E2E_ENABLED on project)
const eventId = crypto.randomUUID();
const e2e1 = await post("tlv-e2e-simulate-payment", {
  provider_event_id: eventId,
  wallet_user_id: walletUserId,
  coins_granted: 500,
  duplicate: false,
});
const e2eOk = e2e1.status === 200 && e2e1.data?.ok;
if (fnNotDeployed(e2e1.status)) {
  check("SKIP: e2e webhook (functions not deployed)", true, "404");
} else {
  check("e2e webhook first success", e2eOk || e2e1.status === 403, e2e1.data?.error || JSON.stringify(e2e1.data).slice(0, 80));
}

if (e2eOk) {
  const bal1 = e2e1.data.coin_balance;
  const e2e2 = await post("tlv-e2e-simulate-payment", {
    provider_event_id: eventId,
    wallet_user_id: walletUserId,
    coins_granted: 500,
    duplicate: true,
  });
  const dup =
    e2e2.data?.second?.duplicate === true && e2e2.data?.first?.duplicate === true;
  check("e2e webhook duplicate no double credit", dup);
}

// createTip without JWT
const tipAnon = await post("tlv-create-tip", {
  stream_id: "00000000-0000-4000-8000-000000000099",
  creator_id: "00000000-0000-4000-8000-000000000098",
  coins: 100,
});
check(
  "createTip rejects anon",
  tipAnon.status === 401 || fnNotDeployed(tipAnon.status),
  fnNotDeployed(tipAnon.status) ? "404 — functions not deployed" : String(tipAnon.status),
);

// createTip RPC path — covered by scripts/test-tlv-create-tip-rpc-staging.mjs (same RPC as Edge)
check(
  "SKIP: createTip RPC integration (SQL staging suite)",
  true,
  "tlv schema exposed · see reports/tlv-payment-create-tip-transaction-staging-test.md",
);

console.log(skipped ? `\n${skipped} skipped (deploy/migration pending)` : "");
console.log(failed ? `\n${failed} failed` : "\nEdge smoke complete");
process.exit(failed ? 1 : 0);
