/**
 * Adapter connection registry — honest status per product (Phase 5).
 * REAL_READ_ONLY_ADAPTER = shape mapper exists; connected=false until approved fetch.
 */

import { ADAPTER_STATUS } from "../contracts.mjs";

export const PRODUCT_ADAPTER_REGISTRY = Object.freeze({
  AI: Object.freeze({
    product: "AI",
    status: ADAPTER_STATUS.REAL_READ_ONLY_ADAPTER,
    connected: false,
    sources: ["ai_usage_events", "ai_cost_ledger_aggregate (shape TBD)"],
    adapter_modules: ["adapters/ai-usage.mjs"],
    note: "Cost ESTIMATED from usage events; revenue subscription adapter NOT_CONNECTED",
  }),
  TLV: Object.freeze({
    product: "TLV",
    status: ADAPTER_STATUS.REAL_READ_ONLY_ADAPTER,
    connected: false,
    sources: ["tlv.revenue_ledger creator-attributed Net shape"],
    adapter_modules: ["adapters/tlv-tip.mjs", "tlv-settlement.mjs"],
    note: "STEP 3B Net basis; AD-040 distribution is creator-month only; streaming meter NOT_CONNECTED",
  }),
  SHORT: Object.freeze({
    product: "SHORT",
    status: ADAPTER_STATUS.REAL_READ_ONLY_ADAPTER,
    connected: false,
    sources: ["short_video_cost_events"],
    adapter_modules: ["adapters/short-video-cost.mjs"],
    note: "Cost events only; revenue packs NOT_CONNECTED",
  }),
  MARKETPLACE: Object.freeze({
    product: "MARKETPLACE",
    status: ADAPTER_STATUS.REAL_READ_ONLY_ADAPTER,
    connected: false,
    sources: ["marketplace_fee row shape"],
    adapter_modules: ["adapters/marketplace.mjs"],
    note: "No automatic Stripe/DB pull",
  }),
  SHOP_CONNECT: Object.freeze({
    product: "SHOP_CONNECT",
    status: ADAPTER_STATUS.REAL_READ_ONLY_ADAPTER,
    connected: false,
    sources: ["shop_connect_checkout row shape", "fixture.shop_connect"],
    adapter_modules: ["adapters/shop-connect.mjs", "fixtures/shop-connect-sample.mjs"],
    note: "10% min NONE; Stripe runtime unchanged",
  }),
  BUILDER: Object.freeze({
    product: "BUILDER",
    status: ADAPTER_STATUS.NOT_CONNECTED,
    connected: false,
    sources: ["builder formal fee (if any)", "8/6/5 scenario excluded"],
    adapter_modules: ["adapters/builder.mjs"],
    note: "PRICING_SCENARIO_ONLY excluded from actual contribution",
  }),
  TALK: Object.freeze({
    product: "TALK",
    status: ADAPTER_STATUS.NOT_CONNECTED,
    connected: false,
    sources: [],
    adapter_modules: [],
    note: "No financially attributable TALK ledger wired",
  }),
  SITE_AI: Object.freeze({
    product: "SITE_AI",
    status: ADAPTER_STATUS.NOT_CONNECTED,
    connected: false,
    sources: [],
    adapter_modules: [],
    note: "No dedicated SITE_AI ledger adapter yet",
  }),
  PAID_OPTION: Object.freeze({
    product: "PAID_OPTION",
    status: ADAPTER_STATUS.NOT_CONNECTED,
    connected: false,
    sources: [],
    adapter_modules: [],
    note: "Option revenue/cost adapter deferred",
  }),
});

export function getProductAdapterStatus(product) {
  return PRODUCT_ADAPTER_REGISTRY[product] || null;
}
