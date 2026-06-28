import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createServiceClient } from "./live-video-auth.ts";
import type { PaymentChannel } from "./tlv-coin-packs.ts";
import type { FeeConfigRow } from "./tlv-payment-math.ts";
import { TlvPaymentError } from "./tlv-payment-errors.ts";

export function tlvDb(client: SupabaseClient): SupabaseClient {
  return client.schema("tlv");
}

export function createTlvServiceClient(): SupabaseClient {
  return tlvDb(createServiceClient());
}

export async function getActiveFeeConfig(
  client: SupabaseClient,
  channel: PaymentChannel,
): Promise<FeeConfigRow> {
  const { data, error } = await tlvDb(client)
    .from("fee_config")
    .select("channel, fee_rate, price_multiplier")
    .eq("channel", channel)
    .lte("effective_from", new Date().toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new TlvPaymentError("internal_error", `fee_config read failed: ${error.message}`, 500);
  }
  if (!data) {
    throw new TlvPaymentError("config_missing", `No active fee_config for ${channel}`, 500);
  }
  return data as FeeConfigRow;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseAuthUserUuid(userId: string): string {
  const id = String(userId ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new TlvPaymentError("invalid_request", "Valid auth user uuid required", 400);
  }
  return id;
}

export function ledgerMonthFromDate(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
