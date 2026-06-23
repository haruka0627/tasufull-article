/**
 * MATCH footprint UPSERT — service_role ONLY (see match-record-profile-view)
 */
import { createFootprintServiceClient } from "./match-db.ts";
import { MatchFunctionError } from "./match-auth.ts";

export type RecordFootprintInput = {
  viewerUserId: string;
  viewedUserId: string;
  source: string;
  dedupeBucket: string;
};

export async function upsertProfileView(input: RecordFootprintInput): Promise<void> {
  const service = createFootprintServiceClient();
  const now = new Date().toISOString();

  const { error } = await service.from("match_profile_views").upsert(
    {
      viewer_user_id: input.viewerUserId,
      viewed_user_id: input.viewedUserId,
      source: input.source,
      viewed_at: now,
      dedupe_bucket: input.dedupeBucket,
    },
    { onConflict: "viewer_user_id,viewed_user_id,dedupe_bucket" },
  );

  if (error) {
    throw new MatchFunctionError("internal_error", error.message, 500);
  }
}
