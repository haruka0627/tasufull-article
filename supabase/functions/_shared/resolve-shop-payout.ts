import { getServiceSupabase } from "./apply-featured-listing.ts";

export type ResolvedShopPayout = {
  shop_listing_id: string;
  seller_user_id: string | null;
  stripe_account_id: string;
  payout_account_status: string;
  payout_enabled: boolean;
  platform_fee_rate: number;
  is_demo: boolean;
};

const DEFAULT_FEE_RATE = Number(Deno.env.get("SHOP_PLATFORM_FEE_RATE") || "0.1");

function isDemoShopId(id: string): boolean {
  return /^demo-shop-/i.test(id) || id === "demo-shop-store" || id === "demo-shop";
}

function readPayoutFromRow(row: Record<string, unknown>): Omit<ResolvedShopPayout, "shop_listing_id" | "is_demo"> {
  const fd =
    row.form_data && typeof row.form_data === "object"
      ? (row.form_data as Record<string, unknown>)
      : {};

  const stripe_account_id = String(
    row.stripe_account_id || fd.stripe_account_id || ""
  ).trim();

  const payout_account_status = String(
    row.payout_account_status || fd.payout_account_status || "not_connected"
  ).trim();

  let platform_fee_rate = Number(row.platform_fee_rate ?? fd.platform_fee_rate);
  if (!Number.isFinite(platform_fee_rate) || platform_fee_rate < 0 || platform_fee_rate > 1) {
    platform_fee_rate = DEFAULT_FEE_RATE;
  }

  let payout_enabled = row.payout_enabled === true || fd.payout_enabled === true;
  if (stripe_account_id && /^(active|verified|enabled)$/i.test(payout_account_status)) {
    payout_enabled = payout_enabled || true;
  }
  if (row.payout_enabled === false) payout_enabled = false;

  return {
    seller_user_id: row.user_id ? String(row.user_id) : null,
    stripe_account_id,
    payout_account_status,
    payout_enabled,
    platform_fee_rate,
  };
}

export function calcPlatformFees(amountTotal: number, rate: number) {
  const total = Math.max(0, Math.round(amountTotal));
  const r = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : DEFAULT_FEE_RATE;
  const platform_fee_amount = Math.round(total * r);
  const seller_amount = Math.max(0, total - platform_fee_amount);
  return { amount_total: total, platform_fee_amount, seller_amount, platform_fee_rate: r };
}

export async function resolveShopPayout(
  shopId: string
): Promise<{ ok: true; payout: ResolvedShopPayout } | { ok: false; error: string; status: number }> {
  const key = String(shopId || "").trim();
  if (!key) {
    return { ok: false, error: "shop_id が必要です", status: 400 };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return { ok: false, error: "shop_id が不正です", status: 400 };
  }

  if (isDemoShopId(key)) {
    const demoAccount = String(Deno.env.get("STRIPE_DEMO_CONNECTED_ACCOUNT_ID") || "").trim();
    return {
      ok: true,
      payout: {
        shop_listing_id: key,
        seller_user_id: null,
        stripe_account_id: demoAccount,
        payout_account_status: "active",
        payout_enabled: true,
        platform_fee_rate: DEFAULT_FEE_RATE,
        is_demo: true,
      },
    };
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("business_listings")
    .select(
      "id, user_id, stripe_account_id, payout_account_status, payout_enabled, platform_fee_rate, form_data"
    )
    .or(`id.eq.${key},form_data->>demo_id.eq.${key}`)
    .maybeSingle();

  if (error) {
    console.error("[resolve-shop-payout]", error);
    return { ok: false, error: error.message, status: 500 };
  }

  if (!data) {
    return {
      ok: false,
      error: "店舗が見つかりません。振込先が未登録の可能性があります。",
      status: 404,
    };
  }

  const parsed = readPayoutFromRow(data as Record<string, unknown>);
  return {
    ok: true,
    payout: {
      shop_listing_id: String(data.id),
      is_demo: false,
      ...parsed,
    },
  };
}
