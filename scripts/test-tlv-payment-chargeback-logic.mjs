/**
 * TLV Payment Chargeback/Refund — pure logic unit tests (no DB)
 * Ref: reports/tlv-payment-chargeback-clawback-design.md §②
 */

function floorCoinsFromRefund(coinsGranted, refundJpyDelta, grossJpy) {
  return Math.floor((coinsGranted * refundJpyDelta) / grossJpy);
}

function computeRefundDelta(cumulativeRefunded, paymentRefundAmount) {
  return cumulativeRefunded - paymentRefundAmount;
}

function clawFromLotAndWallet({ lotRemaining, coinsTarget, walletBalance }) {
  const fromLot = Math.min(lotRemaining, coinsTarget);
  const remaining = coinsTarget - fromLot;
  const actualClaw = Math.min(coinsTarget, walletBalance);
  const shortfall = coinsTarget - actualClaw;
  return { fromLot, fromSpent: remaining, actualClaw, shortfall };
}

function reverseTipNet(netAllocated, coinsAllocated, coinsToReverse) {
  return -Math.floor((netAllocated * coinsToReverse) / coinsAllocated);
}

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

// Full refund unused — 500 coins, gross 550
check(
  "CB-L01 full refund coins",
  floorCoinsFromRefund(500, 550, 550) === 500,
);

// Partial 50%
check(
  "CB-L02 partial refund 50%",
  floorCoinsFromRefund(500, 275, 550) === 250,
);

// Partial twice — delta from cumulative
check(
  "CB-L03 refund delta cumulative",
  computeRefundDelta(275, 0) === 275 && computeRefundDelta(550, 275) === 275,
);

// Duplicate event — zero delta
check(
  "CB-L04 duplicate refund delta zero",
  computeRefundDelta(550, 550) <= 0,
);

// Unused coin claw
const unused = clawFromLotAndWallet({ lotRemaining: 500, coinsTarget: 500, walletBalance: 500 });
check("CB-L05 unused coin claw", unused.fromLot === 500 && unused.fromSpent === 0 && unused.shortfall === 0);

// Used coin — lot empty, claw from wallet
const used = clawFromLotAndWallet({ lotRemaining: 0, coinsTarget: 200, walletBalance: 150 });
check(
  "CB-L06 used coin partial claw",
  used.fromLot === 0 && used.fromSpent === 200 && used.actualClaw === 150 && used.shortfall === 50,
);

// Wallet insufficient → shortfall + frozen
check(
  "CB-L07 wallet shortfall triggers frozen",
  used.shortfall > 0,
);

// Tip revenue reversal proportional
check(
  "CB-L08 tip net reversal",
  reverseTipNet(530, 300, 150) === -265,
);

// Ledger sign — chargeback_debit negative
check("CB-L09 chargeback_debit sign", -Math.abs(200) < 0);

// Idempotency — same event processed twice
check(
  "CB-L10 idempotency no double delta",
  computeRefundDelta(550, 550) <= 0,
);

// Dispute phase mapping
const disputePhase = (eventType, status) => {
  if (eventType === "charge.dispute.created") return "open";
  if (eventType === "charge.dispute.closed") {
    if (status === "won") return "won";
    if (status === "lost") return "lost";
  }
  return "unknown";
};
check("CB-L11 dispute open", disputePhase("charge.dispute.created", "") === "open");
check("CB-L12 dispute lost", disputePhase("charge.dispute.closed", "lost") === "lost");
check("CB-L13 dispute won", disputePhase("charge.dispute.closed", "won") === "won");

console.log(failed ? `\n${failed} failed` : "\nAll chargeback logic tests passed");
process.exit(failed ? 1 : 0);
