import { getServiceSupabase } from "./apply-featured-listing.ts";

export type ShopOrderInsert = {
  shop_id: string;
  shop_listing_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_jpy: number;
  amount_total: number;
  platform_fee_amount: number;
  seller_amount: number;
  seller_user_id?: string | null;
  seller_stripe_account_id?: string | null;
  buyer_user_id?: string | null;
  buyer_email?: string | null;
  payment_status: string;
  payout_status: string;
  stripe_checkout_session_id: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function upsertShopOrderFromCheckout(
  row: ShopOrderInsert
): Promise<{ ok: true; order_id: string } | { ok: false; error: string; status?: number }> {
  const supabase = getServiceSupabase();
  const sessionKey = row.stripe_checkout_session_id || row.stripe_session_id || "";

  const { data: existing, error: findError } = await supabase
    .from("shop_orders")
    .select("id")
    .eq("stripe_checkout_session_id", sessionKey)
    .maybeSingle();

  if (findError) {
    console.error("[apply-shop-order] find failed:", findError);
    return { ok: false, error: findError.message, status: 500 };
  }

  if (existing?.id) {
    return { ok: true, order_id: String(existing.id) };
  }

  const shopListingId = row.shop_listing_id || row.shop_id;

  const { data, error } = await supabase
    .from("shop_orders")
    .insert({
      shop_id: row.shop_id,
      shop_listing_id: shopListingId,
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price_jpy: row.unit_price_jpy,
      total_amount_jpy: row.amount_total,
      amount_total: row.amount_total,
      platform_fee_amount: row.platform_fee_amount,
      seller_amount: row.seller_amount,
      seller_user_id: row.seller_user_id ?? null,
      seller_stripe_account_id: row.seller_stripe_account_id ?? null,
      buyer_user_id: row.buyer_user_id ?? null,
      buyer_email: row.buyer_email ?? null,
      payment_status: row.payment_status,
      payout_status: row.payout_status,
      stripe_checkout_session_id: sessionKey,
      stripe_session_id: sessionKey,
      stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
      shop_notified: false,
      notify_shop_at: null,
      metadata: row.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[apply-shop-order] insert failed:", error);
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true, order_id: String(data.id) };
}
