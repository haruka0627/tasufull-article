/**
 * MATCH closed beta gate — allowlist via match_is_beta_allowed() RPC
 */
import { createUserClient } from "./match-db.ts";
import { MatchFunctionError, type MatchAuthUser } from "./match-auth.ts";

export function isMatchBetaGateDisabled(): boolean {
  return String(Deno.env.get("MATCH_BETA_GATE_DISABLED") ?? "").trim() === "1";
}

export function shouldSkipBetaGate(user: MatchAuthUser): boolean {
  if (isMatchBetaGateDisabled()) return true;
  if (user.tokenMode === "stub") return true;
  return false;
}

/**
 * Throws MatchFunctionError 403 match_beta_not_allowed when user is not on allowlist.
 */
export async function requireMatchBetaAllowed(
  req: Request,
  user: MatchAuthUser,
): Promise<void> {
  if (shouldSkipBetaGate(user)) return;

  const { client } = createUserClient(req);
  const { data, error } = await client.rpc("match_is_beta_allowed");

  if (error) {
    console.error("[match-beta] match_is_beta_allowed RPC failed", error);
    throw new MatchFunctionError(
      "internal_error",
      "Beta allowlist check failed",
      500,
    );
  }

  if (data !== true) {
    throw new MatchFunctionError(
      "match_beta_not_allowed",
      "TASFUL MATCH is in closed beta. Invitation required.",
      403,
    );
  }
}
