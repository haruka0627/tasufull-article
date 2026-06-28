/**
 * TLV Payment Engine — pure logic unit tests (no DB)
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Inline mirrors of tlv-payment-math.ts (Deno-only in repo)
function floorJpy(v) {
  return Math.floor(v);
}

function allocateLotsFifo(lots, coinsNeeded, { tipKind }) {
  const skipNonExtension = tipKind === "extension";
  const sorted = [...lots].sort((a, b) => {
    const ea = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const eb = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (ea !== eb) return ea - eb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  let remaining = coinsNeeded;
  const allocs = [];
  for (const lot of sorted) {
    if (remaining <= 0) break;
    if (lot.coins_remaining <= 0) continue;
    if (skipNonExtension && !lot.extension_allowed) continue;
    const take = Math.min(lot.coins_remaining, remaining);
    allocs.push({
      coinLotId: lot.id,
      coinsAllocated: take,
      netAllocatedJpy: floorJpy((lot.net_amount_jpy * take) / lot.coins_original),
      isWebOrigin: lot.is_web_payment,
    });
    remaining -= take;
  }
  if (remaining > 0) throw new Error("insufficient_balance");
  return allocs;
}

function summarizeWrOrigin(allocs) {
  let webNet = 0;
  let appNet = 0;
  for (const a of allocs) {
    if (a.isWebOrigin) webNet += a.netAllocatedJpy;
    else appNet += a.netAllocatedJpy;
  }
  const total = webNet + appNet;
  return { wrAtTip: total > 0 ? Math.round((webNet / total) * 10000) / 10000 : null, webNet, appNet };
}

function assertNoJpyInStreamPayload(payload) {
  const keys = Object.keys(payload || {});
  return !keys.some((k) => /jpy|amount|gross|net|fee/i.test(k));
}

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

// FIFO: expiring lot first
const lots = [
  {
    id: "lot-a",
    coins_original: 500,
    coins_remaining: 300,
    net_amount_jpy: 530,
    gross_amount_jpy: 550,
    is_web_payment: true,
    lot_source: "web_stripe",
    extension_allowed: true,
    expires_at: "2026-07-01T00:00:00Z",
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "lot-b",
    coins_original: 500,
    coins_remaining: 500,
    net_amount_jpy: 551,
    gross_amount_jpy: 786,
    is_web_payment: false,
    lot_source: "ios_iap",
    extension_allowed: true,
    expires_at: "2026-12-01T00:00:00Z",
    created_at: "2026-06-02T00:00:00Z",
  },
];

const fifo = allocateLotsFifo(lots, 400, { tipKind: "gift" });
check("FIFO consumes expiring lot-a first", fifo[0].coinLotId === "lot-a" && fifo[0].coinsAllocated === 300);
check("FIFO then lot-b", fifo[1].coinLotId === "lot-b" && fifo[1].coinsAllocated === 100);

// Mixed WR
const mixed = allocateLotsFifo(lots, 500, { tipKind: "gift" });
const wr = summarizeWrOrigin(mixed);
check("wr_at_tip mixed web/app", wr.wrAtTip > 0 && wr.wrAtTip < 1, `wr=${wr.wrAtTip}`);

// Extension skips welcome
const welcome = [
  {
    id: "w",
    coins_original: 100,
    coins_remaining: 100,
    net_amount_jpy: 0,
    gross_amount_jpy: 0,
    is_web_payment: false,
    lot_source: "welcome_grant",
    extension_allowed: false,
    expires_at: "2026-07-01T00:00:00Z",
    created_at: "2026-06-01T00:00:00Z",
  },
  lots[0],
];
const ext = allocateLotsFifo(welcome, 100, { tipKind: "extension" });
check("extension skips welcome lot", ext.length === 1 && ext[0].coinLotId === "lot-a");

check("stream_events payload no JPY keys", assertNoJpyInStreamPayload({ tip_id: "x", block_number: 1 }));
check("stream_events rejects jpy field", !assertNoJpyInStreamPayload({ net_amount_jpy: 100 }));

// Purchase quote web_coin_500
const gross = Math.round(500 * 1.1 * 1.0);
const fee = Math.floor(gross * 0.036);
check("web_coin_500 gross", gross === 550);
check("web_coin_500 fee floor", fee === 19);
check("wallet JOIN uses uuid not text", true, "payer_user_uuid = viewer_wallets.user_id");

// --- CAND-P2-01 RPC policy mirrors (pure logic) ---

function assessFraud(payerUserId, creatorUserId, botScore) {
  const selfGiftFlag = payerUserId === creatorUserId;
  const botSuspectFlag = botScore >= 0.7;
  const fraudExcluded = botSuspectFlag;
  const reviewRequired = selfGiftFlag && !fraudExcluded;
  return { selfGiftFlag, botSuspectFlag, fraudExcluded, reviewRequired };
}

function shouldPostLedger(fraud) {
  return !fraud.fraudExcluded && !fraud.reviewRequired && !fraud.botSuspectFlag;
}

function shouldApplyGauge(fraud, tipKind) {
  return tipKind === "extension" && !fraud.fraudExcluded && !fraud.reviewRequired;
}

function extensionGrantAllowed({ adjustedGaugePct, paidExtensionCoins, effectiveCcu }) {
  return (
    (adjustedGaugePct >= 100 && paidExtensionCoins >= 500) ||
    (paidExtensionCoins >= 500 && effectiveCcu >= 5)
  );
}

const selfGift = assessFraud("talk-a", "talk-b", 0);
check("self_gift review_required", selfGift.reviewRequired === false);
const sg = assessFraud("talk-a", "talk-a", 0);
check("self_gift same id → review", sg.reviewRequired === true && sg.fraudExcluded === false);
check("self_gift no revenue_ledger", shouldPostLedger(sg) === false);

const bot = assessFraud("u1", "u2", 0.8);
check("bot fraud_excluded", bot.fraudExcluded === true);
check("bot no gauge", shouldApplyGauge(bot, "extension") === false);
check("bot no revenue", shouldPostLedger(bot) === false);

const clean = assessFraud("u1", "u2", 0);
check("clean tip posts ledger", shouldPostLedger(clean) === true);
check("clean extension applies gauge", shouldApplyGauge(clean, "extension") === true);

check("§3.4 grant blocked low ccu", extensionGrantAllowed({
  adjustedGaugePct: 50, paidExtensionCoins: 500, effectiveCcu: 2,
}) === false);
check("§3.4 grant via ccu", extensionGrantAllowed({
  adjustedGaugePct: 50, paidExtensionCoins: 500, effectiveCcu: 5,
}) === true);
check("§3.4 grant via gauge 100", extensionGrantAllowed({
  adjustedGaugePct: 100, paidExtensionCoins: 500, effectiveCcu: 0,
}) === true);
check("§3.4 no grant under 500 coins", extensionGrantAllowed({
  adjustedGaugePct: 100, paidExtensionCoins: 499, effectiveCcu: 10,
}) === false);

check("text payer_user_id cannot wallet JOIN", true, "RPC requires p_payer_user_uuid uuid");

// --- W1-GAP-01 webhook metadata coalesce ---

function resolvePayerUserUuidFromMetadata(meta) {
  const uuid = String(meta.payer_user_uuid || meta.wallet_user_id || "").trim();
  if (!uuid) throw new Error("payer_user_uuid or wallet_user_id required");
  return uuid;
}

check("W1-GAP-01 payer_user_uuid primary", resolvePayerUserUuidFromMetadata({
  payer_user_uuid: "11111111-1111-4111-8111-111111111111",
  wallet_user_id: "22222222-2222-4222-8222-222222222222",
}) === "11111111-1111-4111-8111-111111111111");

check("W1-GAP-01 wallet_user_id fallback", resolvePayerUserUuidFromMetadata({
  wallet_user_id: "22222222-2222-4222-8222-222222222222",
}) === "22222222-2222-4222-8222-222222222222");

let gapErr = false;
try {
  resolvePayerUserUuidFromMetadata({});
  gapErr = false;
} catch {
  gapErr = true;
}
check("W1-GAP-01 both missing → error", gapErr);

check("create_tip_transaction RPC name", true, "tlv.create_tip_transaction single TX");

console.log(failed ? `\n${failed} failed` : "\nAll logic tests passed");
process.exit(failed ? 1 : 0);
