/**
 * Local MATCH Edge smoke router — Deno fallback when Docker / supabase functions serve unavailable.
 * Serves the same paths as Supabase CLI: http://127.0.0.1:54321/functions/v1/{name}
 * Uses exported handlers from supabase/functions/match-* index.ts (same code as deploy target).
 */
import { handler as matchRecordSwipe } from "../supabase/functions/match-record-swipe/index.ts";
import { handler as matchListPairs } from "../supabase/functions/match-list-pairs/index.ts";
import { handler as matchUpsertProfile } from "../supabase/functions/match-upsert-profile/index.ts";
import { handler as matchUploadPhoto } from "../supabase/functions/match-upload-photo/index.ts";
import { handler as matchEnsureTalkRoom } from "../supabase/functions/match-ensure-talk-room/index.ts";
import { handler as matchSubmitReport } from "../supabase/functions/match-submit-report/index.ts";
import { handler as matchBlockUser } from "../supabase/functions/match-block-user/index.ts";
import { handler as matchSubmitVerification } from "../supabase/functions/match-submit-verification/index.ts";
import { handler as matchAdminReview } from "../supabase/functions/match-admin-review/index.ts";
import { handler as matchModerationLog } from "../supabase/functions/match-moderation-log/index.ts";
import { handler as matchSearchProfiles } from "../supabase/functions/match-search-profiles/index.ts";
import { handler as matchUnmatchPair } from "../supabase/functions/match-unmatch-pair/index.ts";
import { handler as ensureTalkRoom } from "../supabase/functions/ensure-talk-room/index.ts";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "match-record-swipe": matchRecordSwipe,
  "match-list-pairs": matchListPairs,
  "match-upsert-profile": matchUpsertProfile,
  "match-upload-photo": matchUploadPhoto,
  "match-ensure-talk-room": matchEnsureTalkRoom,
  "match-submit-report": matchSubmitReport,
  "match-block-user": matchBlockUser,
  "match-submit-verification": matchSubmitVerification,
  "match-admin-review": matchAdminReview,
  "match-moderation-log": matchModerationLog,
  "match-search-profiles": matchSearchProfiles,
  "match-unmatch-pair": matchUnmatchPair,
  "ensure-talk-room": ensureTalkRoom,
};

const HOST = "127.0.0.1";
const PORT = 54321;
const PREFIX = "/functions/v1/";

console.log(
  `[match-local-edge-smoke-server] listening on http://${HOST}:${PORT}${PREFIX}{function-name}`,
);

Deno.serve({ hostname: HOST, port: PORT }, async (req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response(
      JSON.stringify({ ok: false, code: "not_found", message: "Use /functions/v1/{name}" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const name = url.pathname.slice(PREFIX.length).replace(/\/+$/, "");
  const handler = ROUTES[name];
  if (!handler) {
    return new Response(
      JSON.stringify({ ok: false, code: "not_found", message: `Unknown function: ${name}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  return handler(req);
});
