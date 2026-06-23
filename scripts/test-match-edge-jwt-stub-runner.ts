/**
 * Deno test runner for match-auth JWT stub helpers.
 * Invoked by scripts/test-match-edge-jwt-stub.mjs
 */
import {
  decodeJwtPayloadStub,
  extractAdminRoleFromClaims,
  extractTalkUserIdFromClaims,
  MatchFunctionError,
  requireAdmin,
  requireUser,
} from "../supabase/functions/_shared/match-auth.ts";

let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${label}`);
  }
}

function encodeJwtPayload(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.stub-signature`;
}

function bearerRequest(token: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/match", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });
}

// stub-match-token → stub-user-current
const stubUser = requireUser(bearerRequest("stub-match-token"));
assert(stubUser.tokenMode === "stub", "stub-match-token uses tokenMode stub");
assert(stubUser.matchUserId === "stub-user-current", "stub-match-token returns stub-user-current");
assert(stubUser.authMode === "jwt_stub", "authMode is jwt_stub");

// app_metadata.talk_user_id
const appMetaToken = encodeJwtPayload({
  sub: "11111111-1111-1111-1111-111111111111",
  app_metadata: { talk_user_id: "u_app_meta" },
});
assert(
  extractTalkUserIdFromClaims(decodeJwtPayloadStub(appMetaToken)) === "u_app_meta",
  "extract from app_metadata.talk_user_id",
);

// root talk_user_id
const rootToken = encodeJwtPayload({
  sub: "11111111-1111-1111-1111-111111111111",
  talk_user_id: "u_root",
});
assert(
  extractTalkUserIdFromClaims(decodeJwtPayloadStub(rootToken)) === "u_root",
  "extract from root talk_user_id",
);

// app_metadata.member_id
const memberToken = encodeJwtPayload({
  sub: "11111111-1111-1111-1111-111111111111",
  app_metadata: { member_id: "u_member_only" },
});
assert(
  extractTalkUserIdFromClaims(decodeJwtPayloadStub(memberToken)) === "u_member_only",
  "extract from app_metadata.member_id",
);

// sub only — must not become matchUserId
const subOnlyToken = encodeJwtPayload({
  sub: "11111111-1111-1111-1111-111111111111",
});
let subOnlyError: MatchFunctionError | null = null;
try {
  requireUser(bearerRequest(subOnlyToken));
} catch (err) {
  subOnlyError = err as MatchFunctionError;
}
assert(subOnlyError?.status === 403, "sub-only JWT rejected with 403");
assert(
  extractTalkUserIdFromClaims(decodeJwtPayloadStub(subOnlyToken)) === null,
  "sub-only claims return null from extractTalkUserIdFromClaims",
);

// user_metadata.talk_user_id — not trusted
const userMetaToken = encodeJwtPayload({
  sub: "11111111-1111-1111-1111-111111111111",
  user_metadata: { talk_user_id: "u_user_meta_evil" },
});
assert(
  extractTalkUserIdFromClaims(decodeJwtPayloadStub(userMetaToken)) === null,
  "user_metadata.talk_user_id is not trusted",
);

// admin roles from claims
assert(
  extractAdminRoleFromClaims({ app_metadata: { role: "tasu_admin" } }).isAdmin,
  "tasu_admin role detected",
);
assert(
  extractAdminRoleFromClaims({ app_metadata: { role: "match_admin" } }).isAdmin,
  "match_admin role detected",
);
assert(
  extractAdminRoleFromClaims({ app_metadata: { is_ops: true } }).isAdmin,
  "is_ops detected",
);

// x-match-admin header fallback
const adminHeaderUser = requireAdmin(
  bearerRequest("stub-match-token", { "x-match-admin": "true" }),
);
assert(adminHeaderUser.adminMode === "header_fallback", "x-match-admin header fallback works");

const adminClaimsUser = requireAdmin(
  bearerRequest(
    encodeJwtPayload({
      sub: "stub-auth-user-id",
      app_metadata: { talk_user_id: "u_admin", role: "tasu_admin" },
    }),
  ),
);
assert(adminClaimsUser.adminMode === "claims", "JWT tasu_admin adminMode claims");
assert(adminClaimsUser.adminRole === "tasu_admin", "adminRole tasu_admin from claims");

// x-match-user-id mismatch → warning in stub (not 403 yet)
const mismatchUser = requireUser(
  bearerRequest("stub-match-token", { "x-match-user-id": "someone-else" }),
);
assert(
  mismatchUser.debugOnly?.xMatchUserIdMismatch === true,
  "x-match-user-id mismatch sets debugOnly warning",
);
assert(
  (mismatchUser.debugOnly?.warnings?.length ?? 0) > 0,
  "x-match-user-id mismatch adds warnings",
);

if (failed > 0) {
  Deno.exit(1);
}
