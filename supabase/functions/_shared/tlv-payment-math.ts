import type { CoinPackDef } from "./tlv-coin-packs.ts";

export type FeeConfigRow = {
  channel: string;
  fee_rate: number;
  price_multiplier: number;
};

export type PurchaseQuote = {
  grossAmountJpy: number;
  feeAmountJpy: number;
  netAmountJpy: number;
  feeRateApplied: number;
  coinsGranted: number;
  isWebPayment: boolean;
};

export function floorJpy(value: number): number {
  return Math.floor(value);
}

export function roundJpy(value: number): number {
  return Math.round(value);
}

export function computePurchaseQuote(
  pack: CoinPackDef,
  cfg: FeeConfigRow,
  channel: string,
): PurchaseQuote {
  const coinsGranted = pack.coins + pack.bonus;
  const grossAmountJpy = roundJpy(pack.coins * pack.unitPriceJpy * Number(cfg.price_multiplier));
  const feeAmountJpy = floorJpy(grossAmountJpy * Number(cfg.fee_rate));
  const netAmountJpy = grossAmountJpy - feeAmountJpy;
  return {
    grossAmountJpy,
    feeAmountJpy,
    netAmountJpy,
    feeRateApplied: Number(cfg.fee_rate),
    coinsGranted,
    isWebPayment: channel === "web_stripe",
  };
}

export type LotAllocation = {
  coinLotId: string;
  coinsAllocated: number;
  grossAllocatedJpy: number;
  netAllocatedJpy: number;
  isWebOrigin: boolean;
  lotSource: string;
};

export type CoinLotRow = {
  id: string;
  coins_original: number;
  coins_remaining: number;
  gross_amount_jpy: number;
  net_amount_jpy: number;
  is_web_payment: boolean;
  lot_source: string;
  extension_allowed: boolean;
  expires_at: string | null;
  created_at: string;
};

export function allocateLotsFifo(
  lots: CoinLotRow[],
  coinsNeeded: number,
  options: { tipKind: string },
): LotAllocation[] {
  const skipNonExtension = options.tipKind === "extension";
  const sorted = [...lots].sort((a, b) => {
    const ea = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const eb = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (ea !== eb) return ea - eb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  let remaining = coinsNeeded;
  const allocs: LotAllocation[] = [];

  for (const lot of sorted) {
    if (remaining <= 0) break;
    if (lot.coins_remaining <= 0) continue;
    if (skipNonExtension && !lot.extension_allowed) continue;

    const take = Math.min(lot.coins_remaining, remaining);
    const netAllocatedJpy = floorJpy(lot.net_amount_jpy * take / lot.coins_original);
    const grossAllocatedJpy = floorJpy(lot.gross_amount_jpy * take / lot.coins_original);
    allocs.push({
      coinLotId: lot.id,
      coinsAllocated: take,
      grossAllocatedJpy,
      netAllocatedJpy,
      isWebOrigin: lot.is_web_payment,
      lotSource: lot.lot_source,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("insufficient_balance");
  }
  return allocs;
}

export function summarizeWrOrigin(allocs: LotAllocation[]): {
  webOriginCoins: number;
  appOriginCoins: number;
  webOriginNetJpy: number;
  appOriginNetJpy: number;
  wrAtTip: number | null;
} {
  let webOriginCoins = 0;
  let appOriginCoins = 0;
  let webOriginNetJpy = 0;
  let appOriginNetJpy = 0;

  for (const a of allocs) {
    if (a.isWebOrigin) {
      webOriginCoins += a.coinsAllocated;
      webOriginNetJpy += a.netAllocatedJpy;
    } else {
      appOriginCoins += a.coinsAllocated;
      appOriginNetJpy += a.netAllocatedJpy;
    }
  }

  const totalNet = webOriginNetJpy + appOriginNetJpy;
  const wrAtTip = totalNet > 0 ? Math.round((webOriginNetJpy / totalNet) * 10000) / 10000 : null;

  return { webOriginCoins, appOriginCoins, webOriginNetJpy, appOriginNetJpy, wrAtTip };
}

export function computeGaugePct(input: {
  unique_viewers: number;
  avg_watch_minutes: number;
  cheer_count: number;
  paid_extension_coins: number;
}): number {
  const raw =
    input.unique_viewers * 2 +
    input.avg_watch_minutes * 1.5 +
    input.cheer_count * 0.5 +
    input.paid_extension_coins / 5;
  return Math.min(100, raw);
}
