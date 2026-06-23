/**
 * MATCH P15 Edge — shared helpers
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { isP15EdgeDisabled } from "./match-db.ts";

export function assertP15Enabled(req: Request): void {
  if (isP15EdgeDisabled()) {
    throw new MatchFunctionError("feature_disabled", "MATCH P15 Edge is temporarily disabled", 503);
  }
}

export function p15Success(
  req: Request,
  user: MatchAuthUser,
  data: Record<string, unknown>,
  status = 200,
): Response {
  return jsonResponse(
    {
      ok: true,
      mode: "live",
      auth_mode: "jwt",
      ...authResponseFields(user),
      ...data,
    },
    status,
    req,
  );
}

export function clampLimit(value: unknown, fallback = 20, max = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function jstDateString(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export function assertNotSelf(userId: string, targetId: string, label = "target"): void {
  if (userId === targetId) {
    throw new MatchFunctionError("validation_error", `Cannot use ${label} on yourself`, 422);
  }
}

export async function areUsersBlocked(
  client: SupabaseClient,
  userA: string,
  userB: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("match_users_are_blocked", {
    p_user_a: userA,
    p_user_b: userB,
  });
  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
  return Boolean(data);
}

export async function assertNotBlocked(
  client: SupabaseClient,
  userA: string,
  userB: string,
): Promise<void> {
  if (await areUsersBlocked(client, userA, userB)) {
    throw new MatchFunctionError("blocked", "Users are blocked", 422);
  }
}

export async function rpcActivityLabel(
  client: SupabaseClient,
  at: string | Date | null,
): Promise<string> {
  const iso = at instanceof Date ? at.toISOString() : at ?? null;
  const { data, error } = await client.rpc("match_activity_label", {
    p_last_active_at: iso,
  });
  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
  return String(data ?? "しばらく未活動");
}

export async function rpcFootprintLabel(
  client: SupabaseClient,
  viewedAt: string,
): Promise<string> {
  const { data, error } = await client.rpc("match_footprint_label", {
    p_viewed_at: viewedAt,
  });
  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
  return String(data ?? "不明");
}

export async function viewerFootprintsEnabled(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("match_user_settings")
    .select("show_footprints_to_others")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
  if (!data) return true;
  return data.show_footprints_to_others !== false;
}
