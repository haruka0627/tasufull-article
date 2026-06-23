/**
 * MATCH swipe feed — candidate search (live)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient, isP15EdgeDisabled } from "./match-db.ts";
import { MATCH_PHOTO_BUCKET, isLiveProfileEnabled } from "./match-profile.ts";

const SORTS = new Set(["recommended", "newest", "online"]);
const SIGNED_URL_TTL_SEC = 3600;
const MAX_FETCH = 200;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type SearchFilters = {
  age_min: number | null;
  age_max: number | null;
  prefecture: string;
  prefectures: string[];
  purpose: string[];
  hobby_slugs: string[];
  verified_only: boolean;
};

export type FeedProfileItem = {
  user_id: string;
  profile_id: string;
  display_name: string;
  age: number | null;
  prefecture: string;
  city: string | null;
  bio: string | null;
  purpose: string | null;
  verification_status: string;
  main_photo_url: string | null;
  hobby_tags: string[];
  activity_label: string | null;
  completion_score: number | null;
};

export type SearchProfilesResult = {
  items: FeedProfileItem[];
  total: number;
  sort: string;
  cursor: string | null;
  has_more: boolean;
};

export function isLiveFeedEnabled(): boolean {
  if (isP15EdgeDisabled()) return false;
  return isLiveProfileEnabled();
}

export function feedSuccess(
  req: Request,
  user: MatchAuthUser,
  data: Record<string, unknown>,
  status = 200,
): Response {
  return jsonResponse(
    {
      ok: true,
      mode: "live",
      ...authResponseFields(user),
      ...data,
    },
    status,
    req,
  );
}

function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseSearchFilters(filtersJson: unknown): SearchFilters {
  const f = filtersJson && typeof filtersJson === "object" && !Array.isArray(filtersJson)
    ? filtersJson as Record<string, unknown>
    : {};

  const prefectures = Array.isArray(f.prefectures)
    ? f.prefectures.map((p) => String(p ?? "").trim()).filter(Boolean)
    : [];

  const purpose = Array.isArray(f.purpose)
    ? f.purpose.map((p) => String(p ?? "").trim()).filter(Boolean)
    : [];

  const hobby_slugs = Array.isArray(f.hobby_slugs)
    ? f.hobby_slugs.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];

  return {
    age_min: numOrNull(f.age_min),
    age_max: numOrNull(f.age_max),
    prefecture: f.prefecture ? String(f.prefecture).trim() : "",
    prefectures,
    purpose,
    hobby_slugs,
    verified_only: Boolean(f.verified_only),
  };
}

export function parseSearchRequest(body: Record<string, unknown>): {
  filters: SearchFilters;
  sort: string;
  limit: number;
  cursorOffset: number;
} {
  const sortRaw = String(body.sort ?? "recommended");
  const sort = SORTS.has(sortRaw) ? sortRaw : "recommended";
  const limitRaw = Number(body.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw)))
    : DEFAULT_LIMIT;
  const cursorRaw = body.cursor === undefined || body.cursor === null ? "0" : String(body.cursor);
  const cursorOffset = Number.parseInt(cursorRaw, 10);
  const cursorOffsetSafe = Number.isFinite(cursorOffset) && cursorOffset >= 0 ? cursorOffset : 0;

  return {
    filters: parseSearchFilters(body.filters_json),
    sort,
    limit,
    cursorOffset: cursorOffsetSafe,
  };
}

function partnerFromPair(
  pair: { user_low_id: string; user_high_id: string },
  viewerId: string,
): string {
  return viewerId === pair.user_low_id ? pair.user_high_id : pair.user_low_id;
}

async function loadSwipedTargetIds(
  userClient: SupabaseClient,
  viewerId: string,
): Promise<Set<string>> {
  const { data, error } = await userClient
    .from("match_swipes")
    .select("target_user_id")
    .eq("swiper_user_id", viewerId);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  return new Set((data ?? []).map((row) => String(row.target_user_id)));
}

async function loadPairedUserIds(
  userClient: SupabaseClient,
  viewerId: string,
): Promise<Set<string>> {
  const { data, error } = await userClient
    .from("match_pairs")
    .select("user_low_id, user_high_id")
    .eq("status", "active")
    .is("archived_at", null);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const set = new Set<string>();
  for (const row of data ?? []) {
    const low = String(row.user_low_id);
    const high = String(row.user_high_id);
    if (low === viewerId) set.add(high);
    else if (high === viewerId) set.add(low);
  }
  return set;
}

async function loadHobbySlugMap(
  serviceClient: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!profileIds.length) return map;

  const { data: links, error } = await serviceClient
    .from("match_profile_hobby_tags")
    .select("profile_id, hobby_tag_id")
    .in("profile_id", profileIds);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const tagIds = [...new Set((links ?? []).map((l) => String(l.hobby_tag_id)))];
  const slugById = new Map<string, string>();
  if (tagIds.length) {
    const { data: tags, error: tagErr } = await serviceClient
      .from("match_hobby_tags")
      .select("id, slug")
      .in("id", tagIds)
      .eq("is_active", true);
    if (tagErr) throw new MatchFunctionError("internal_error", tagErr.message, 500);
    for (const tag of tags ?? []) slugById.set(String(tag.id), String(tag.slug));
  }

  for (const link of links ?? []) {
    const profileId = String(link.profile_id);
    const slug = slugById.get(String(link.hobby_tag_id));
    if (!slug) continue;
    const list = map.get(profileId) ?? [];
    list.push(slug);
    map.set(profileId, list);
  }
  return map;
}

async function loadCompletenessMap(
  serviceClient: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!profileIds.length) return map;
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, completeness_cached")
    .in("id", profileIds);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  for (const row of data ?? []) {
    if (row.completeness_cached != null) {
      map.set(String(row.id), Number(row.completeness_cached));
    }
  }
  return map;
}

async function signPhotoUrl(
  serviceClient: SupabaseClient,
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null;
  const path = String(storagePath).trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await serviceClient.storage
    .from(MATCH_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function passesFilters(
  row: Record<string, unknown>,
  filters: SearchFilters,
  hobbySlugMap: Map<string, string[]>,
): boolean {
  const age = row.age == null ? null : Number(row.age);
  if (filters.age_min != null && age != null && age < filters.age_min) return false;
  if (filters.age_max != null && age != null && age > filters.age_max) return false;

  const prefecture = String(row.prefecture ?? "");
  if (filters.prefecture && prefecture !== filters.prefecture) return false;
  if (filters.prefectures.length && !filters.prefectures.includes(prefecture)) return false;

  const purpose = row.purpose ? String(row.purpose) : "";
  if (filters.purpose.length && !filters.purpose.includes(purpose)) return false;

  if (filters.verified_only && row.verification_status !== "verified") return false;

  if (filters.hobby_slugs.length) {
    const profileId = String(row.profile_id);
    const slugs = hobbySlugMap.get(profileId) ?? [];
    const hit = filters.hobby_slugs.some((slug) => slugs.includes(slug));
    if (!hit) return false;
  }

  return true;
}

function sortRows(rows: Record<string, unknown>[], sort: string): Record<string, unknown>[] {
  const list = rows.slice();
  if (sort === "newest" || sort === "recommended" || sort === "online") {
    list.sort((a, b) => {
      const at = String(a.created_at ?? "");
      const bt = String(b.created_at ?? "");
      return bt.localeCompare(at);
    });
  }
  return list;
}

export async function searchProfilesLive(
  req: Request,
  user: MatchAuthUser,
  options: ReturnType<typeof parseSearchRequest>,
): Promise<SearchProfilesResult> {
  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();
  const viewerId = user.matchUserId;

  const [swiped, paired] = await Promise.all([
    loadSwipedTargetIds(userClient, viewerId),
    loadPairedUserIds(userClient, viewerId),
  ]);

  const { data: publicRows, error } = await userClient
    .from("match_profiles_public")
    .select(
      "profile_id, user_id, display_name, age, prefecture, city, bio, purpose, verification_status, main_photo_url, hobby_tags, activity_label, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_FETCH);

  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const rawRows = (publicRows ?? []).filter((row) => {
    const userId = String(row.user_id);
    if (userId === viewerId) return false;
    if (swiped.has(userId)) return false;
    if (paired.has(userId)) return false;
    return true;
  });

  const profileIds = rawRows.map((row) => String(row.profile_id));
  const hobbySlugMap = await loadHobbySlugMap(serviceClient, profileIds);
  const completenessMap = await loadCompletenessMap(serviceClient, profileIds);

  const filtered = sortRows(
    rawRows.filter((row) => passesFilters(row as Record<string, unknown>, options.filters, hobbySlugMap)),
    options.sort,
  );

  const page = filtered.slice(options.cursorOffset, options.cursorOffset + options.limit);
  const nextOffset = options.cursorOffset + page.length;
  const hasMore = nextOffset < filtered.length;

  const items: FeedProfileItem[] = [];
  for (const row of page) {
    const profileId = String(row.profile_id);
    const signedUrl = await signPhotoUrl(
      serviceClient,
      row.main_photo_url ? String(row.main_photo_url) : null,
    );
    items.push({
      user_id: String(row.user_id),
      profile_id: profileId,
      display_name: String(row.display_name ?? "マッチ相手"),
      age: row.age == null ? null : Number(row.age),
      prefecture: String(row.prefecture ?? ""),
      city: row.city ? String(row.city) : null,
      bio: row.bio ? String(row.bio) : null,
      purpose: row.purpose ? String(row.purpose) : null,
      verification_status: String(row.verification_status ?? "none"),
      main_photo_url: signedUrl,
      hobby_tags: Array.isArray(row.hobby_tags)
        ? row.hobby_tags.map((t) => String(t))
        : [],
      activity_label: row.activity_label ? String(row.activity_label) : null,
      completion_score: completenessMap.has(profileId)
        ? completenessMap.get(profileId)!
        : null,
    });
  }

  return {
    items,
    total: filtered.length,
    sort: options.sort,
    cursor: hasMore ? String(nextOffset) : null,
    has_more: hasMore,
  };
}
