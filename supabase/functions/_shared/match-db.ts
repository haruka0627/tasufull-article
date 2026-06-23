/**
 * MATCH Edge — Supabase clients (user JWT RLS · service_role footprint only)
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getBearerToken, MatchFunctionError } from "./match-auth.ts";

export function isP15EdgeDisabled(): boolean {
  return String(Deno.env.get("MATCH_P15_EDGE_DISABLED") ?? "").trim() === "1";
}

export function getMatchSupabaseEnv() {
  const url = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return { url, anonKey, serviceRoleKey };
}

export function assertMatchSupabaseEnv(): { url: string; anonKey: string; serviceRoleKey: string } {
  const env = getMatchSupabaseEnv();
  if (!env.url || !env.anonKey) {
    throw new MatchFunctionError(
      "internal_error",
      "SUPABASE_URL or SUPABASE_ANON_KEY not configured",
      500,
    );
  }
  return env;
}

export type UserClientBundle = {
  client: SupabaseClient;
  bearerToken: string;
  authorizationHeader: string;
};

/** RLS as authenticated user (anon key + user JWT). */
export function createUserClient(req: Request): UserClientBundle {
  const { url, anonKey } = assertMatchSupabaseEnv();
  const bearerToken = getBearerToken(req);
  if (!bearerToken) {
    throw new MatchFunctionError("unauthorized", "Authorization header required", 401);
  }
  const authorizationHeader = `Bearer ${bearerToken}`;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorizationHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, bearerToken, authorizationHeader };
}

/**
 * service_role — MATCH bridge writes (match_pairs.talk_room_id · transaction_rooms).
 * Caller MUST validate JWT user is match_pair participant before use.
 */
export function createMatchServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = assertMatchSupabaseEnv();
  if (!serviceRoleKey) {
    throw new MatchFunctionError(
      "internal_error",
      "SUPABASE_SERVICE_ROLE_KEY not configured",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * service_role — ONLY match-record-profile-view UPSERT.
 * Do not export usage beyond footprint module.
 */
export function createFootprintServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = assertMatchSupabaseEnv();
  if (!serviceRoleKey) {
    throw new MatchFunctionError(
      "internal_error",
      "SUPABASE_SERVICE_ROLE_KEY not configured",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
