/** TLV coin pack SKUs — PRICING.md §2 正本 */
export type CoinPackSkuId =
  | "web_coin_100"
  | "web_coin_500"
  | "web_coin_1000"
  | "web_coin_3000"
  | "web_coin_10000"
  | "app_coin_100"
  | "app_coin_500"
  | "app_coin_1000"
  | "app_coin_3000"
  | "app_coin_10000";

export type PaymentChannel = "web_stripe" | "ios_iap" | "android_iap";

export type CoinPackDef = {
  coins: number;
  bonus: number;
  unitPriceJpy: number;
  channel: PaymentChannel;
};

export const TLV_STRIPE_ORDER_TYPE = "tlv_coin_purchase";

export const COIN_PACKS: Record<CoinPackSkuId, CoinPackDef> = {
  web_coin_100: { coins: 100, bonus: 0, unitPriceJpy: 1.1, channel: "web_stripe" },
  web_coin_500: { coins: 500, bonus: 0, unitPriceJpy: 1.1, channel: "web_stripe" },
  web_coin_1000: { coins: 1000, bonus: 50, unitPriceJpy: 1.1, channel: "web_stripe" },
  web_coin_3000: { coins: 3000, bonus: 200, unitPriceJpy: 1.1, channel: "web_stripe" },
  web_coin_10000: { coins: 10000, bonus: 1000, unitPriceJpy: 1.1, channel: "web_stripe" },
  app_coin_100: { coins: 100, bonus: 0, unitPriceJpy: 1.57, channel: "ios_iap" },
  app_coin_500: { coins: 500, bonus: 0, unitPriceJpy: 1.572, channel: "ios_iap" },
  app_coin_1000: { coins: 1050, bonus: 0, unitPriceJpy: 1.496, channel: "ios_iap" },
  app_coin_3000: { coins: 3200, bonus: 0, unitPriceJpy: 1.473, channel: "ios_iap" },
  app_coin_10000: { coins: 11000, bonus: 0, unitPriceJpy: 1.429, channel: "ios_iap" },
};

export function resolveCoinPackSku(raw: unknown): CoinPackSkuId | null {
  const sku = String(raw ?? "").trim() as CoinPackSkuId;
  return sku in COIN_PACKS ? sku : null;
}

export function resolvePaymentChannel(raw: unknown): PaymentChannel | null {
  const ch = String(raw ?? "").trim() as PaymentChannel;
  if (ch === "web_stripe" || ch === "ios_iap" || ch === "android_iap") return ch;
  return null;
}

export function getCoinPack(skuId: CoinPackSkuId): CoinPackDef {
  return COIN_PACKS[skuId];
}

export function coinsGranted(pack: CoinPackDef): number {
  return pack.coins + pack.bonus;
}

/** App SKUs share ios channel; android uses same packs with android_iap channel override. */
export function skuForChannel(skuId: CoinPackSkuId, channel: PaymentChannel): CoinPackSkuId {
  if (channel === "android_iap" && skuId.startsWith("app_")) return skuId;
  if (channel === "ios_iap" && skuId.startsWith("app_")) return skuId;
  if (channel === "web_stripe" && skuId.startsWith("web_")) return skuId;
  return skuId;
}

export function assertSkuMatchesChannel(skuId: CoinPackSkuId, channel: PaymentChannel): void {
  const pack = COIN_PACKS[skuId];
  if (channel === "web_stripe" && pack.channel !== "web_stripe") {
    throw new Error("sku_channel_mismatch");
  }
  if ((channel === "ios_iap" || channel === "android_iap") && !skuId.startsWith("app_")) {
    throw new Error("sku_channel_mismatch");
  }
}
