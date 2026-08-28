/**
 * Economics Core V1 — Shop Connect fee (AD-042).
 * Runtime Stripe helpers unchanged; this is Economics labeling + calc.
 */

import { FEE_CONTRACTS } from "./contracts.mjs";

/**
 * @param {number} gmvJpy
 * @returns {{
 *   fee_contract_id: string,
 *   gmv_jpy: number,
 *   tasful_revenue_jpy: number,
 *   seller_amount_jpy: number,
 *   rate: number,
 *   minimum_jpy: null,
 *   status: 'FORMAL',
 * }}
 */
export function computeShopConnectPlatformFee(gmvJpy) {
  const contract = FEE_CONTRACTS.SHOP_CONNECT;
  const gmv_jpy = Math.max(0, Math.round(Number(gmvJpy) || 0));
  const tasful_revenue_jpy = Math.round(gmv_jpy * contract.rate);
  return {
    fee_contract_id: contract.fee_contract_id,
    gmv_jpy,
    tasful_revenue_jpy,
    seller_amount_jpy: Math.max(0, gmv_jpy - tasful_revenue_jpy),
    rate: contract.rate,
    minimum_jpy: null,
    status: "FORMAL",
  };
}
