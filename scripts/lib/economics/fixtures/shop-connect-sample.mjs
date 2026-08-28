/**
 * Shop Connect Contribution fixture (AD-042 / AD-041).
 * GMV ¥10,000 → TASFUL fee ¥1,000 · sample payment cost · PARTIAL if streaming required absent.
 */

export const SHOP_CONNECT_SAMPLE_EVENTS = Object.freeze([
  {
    period: "2026-08",
    user_id: "seller_fixture_01",
    product: "SHOP_CONNECT",
    feature: "checkout",
    revenue_type: "CHECKOUT_PLATFORM_FEE",
    fee_contract_id: "SHOP_CONNECT",
    source_currency: "JPY",
    source_amount: 1000,
    actuality: "ACTUAL",
    source: "fixture.shop_connect",
    source_id: "rev_shop_10000_fee",
    occurred_at: "2026-08-10T12:00:00.000Z",
    direction: "revenue",
    meta: { gmv_jpy: 10000, rate: 0.1 },
  },
  {
    period: "2026-08",
    user_id: "seller_fixture_01",
    product: "SHOP_CONNECT",
    feature: "checkout",
    cost_type: "PAYMENT_PROCESSING_COST",
    cost_class: "DIRECT_VARIABLE",
    source_currency: "JPY",
    source_amount: 364,
    actuality: "ACTUAL",
    source: "fixture.shop_connect",
    source_id: "cost_pay_shop_10000",
    occurred_at: "2026-08-10T12:00:01.000Z",
    direction: "cost",
    vendor: "stripe",
    note: "illustrative JP card processing estimate for fixture only",
  },
]);
