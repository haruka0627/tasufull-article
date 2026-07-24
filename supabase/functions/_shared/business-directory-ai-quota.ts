/**
 * Business Directory — AI draft generation daily quota
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { BusinessDirectoryError } from "./business-directory.ts";

/** Phase 1b: all plans 10/day · Phase 2+ can diverge per plan */
export const BD_AI_DRAFT_DAILY_LIMITS: Readonly<Record<string, number>> = Object.freeze({
  free: 10,
  standard: 10,
  pro: 10,
  premium: 10,
});

export type AiDraftQuotaStatus = {
  daily_limit: number;
  used: number;
  remaining: number;
  date_jst: string;
  plan_code: string;
};

export function getTokyoDateKey(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function resolveAiDraftDailyLimit(planCode: string): number {
  const code = String(planCode || "free").trim().toLowerCase();
  return BD_AI_DRAFT_DAILY_LIMITS[code] ?? BD_AI_DRAFT_DAILY_LIMITS.free;
}

export async function consumeAiDraftQuota(
  supabase: SupabaseClient,
  userId: string,
  planCode: string,
): Promise<AiDraftQuotaStatus> {
  const dateJst = getTokyoDateKey();
  const limit = resolveAiDraftDailyLimit(planCode);
  const plan = String(planCode || "free").trim().toLowerCase() || "free";

  const { data, error } = await supabase.rpc("consume_business_directory_ai_draft_quota", {
    p_user_id: userId,
    p_date_jst: dateJst,
    p_limit: limit,
  });

  if (error) {
    console.error("[business-directory-ai-quota] rpc failed:", error);
    throw new BusinessDirectoryError("internal_error", "Quota check failed", 500);
  }

  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok !== true) {
    const used = Number(row.used) || limit;
    throw new BusinessDirectoryError(
      "quota_exceeded",
      `Daily AI draft limit reached (${used}/${limit})`,
      429,
    );
  }

  return {
    daily_limit: limit,
    used: Number(row.used) || 0,
    remaining: Number(row.remaining) ?? Math.max(0, limit - Number(row.used || 0)),
    date_jst: dateJst,
    plan_code: plan,
  };
}
