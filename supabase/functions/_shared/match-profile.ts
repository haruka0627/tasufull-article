/**
 * MATCH profile live — upsert · photos · hobby tags
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient, getMatchSupabaseEnv } from "./match-db.ts";

export const MATCH_PHOTO_BUCKET = "match-profile-photos";
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_HOBBY_TAGS = 5;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const GENDERS = new Set(["male", "female", "other", "private"]);
const PURPOSES = new Set(["love", "marriage", "friend", "undecided"]);
const PROFILE_STATUSES = new Set(["draft", "active", "hidden", "suspended"]);

const CONTACT_PATTERN =
  /(?:https?:\/\/|www\.|@[\w.-]+\.(?:com|jp|net|org)|\d{3}[-\s]?\d{3,4}[-\s]?\d{4})/i;

export type UpsertProfileInput = {
  nickname: string;
  gender: string;
  birth_date: string;
  prefecture: string;
  city?: string;
  bio?: string;
  purpose?: string | null;
  relationship_view?: string | null;
  weekend_style?: string | null;
  hobby_slugs?: string[];
  publish?: boolean;
};

export type UpsertProfileResult = {
  profile_id: string;
  created: boolean;
  profile_status: string;
  completion_score: number;
  public_profile: PublicProfileSnapshot | null;
};

export type PublicProfileSnapshot = {
  profile_id: string;
  user_id: string;
  display_name: string;
  age: number | null;
  prefecture: string;
  city: string | null;
  bio: string | null;
  purpose: string | null;
  hobby_tags: string[];
  main_photo_url: string | null;
  activity_label: string | null;
};

export type UploadPhotoInput = {
  content_base64: string;
  content_type: string;
  is_main?: boolean;
  display_order?: number;
};

export type UploadPhotoResult = {
  photo_id: string;
  storage_path: string;
  is_main: boolean;
  display_order: number;
};

export function isLiveProfileEnabled(): boolean {
  const env = getMatchSupabaseEnv();
  return Boolean(env.url && env.anonKey && env.serviceRoleKey);
}

export function profileSuccess(
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

function requireString(field: string, value: unknown, max: number): string {
  if (typeof value !== "string") {
    throw new MatchFunctionError("validation_error", `${field} is required`, 422);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new MatchFunctionError("validation_error", `${field} is required`, 422);
  if (trimmed.length > max) {
    throw new MatchFunctionError("validation_error", `${field} is too long`, 422);
  }
  return trimmed;
}

function optionalString(field: string, value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(field, value, max);
}

function parseBirthDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MatchFunctionError("validation_error", "birth_date must be YYYY-MM-DD", 422);
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new MatchFunctionError("validation_error", "birth_date is invalid", 422);
  }
  const ageMs = Date.now() - date.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 18) {
    throw new MatchFunctionError("validation_error", "Must be 18 or older", 422);
  }
  return value;
}

function validateBio(bio: string | null): string | null {
  if (!bio) return null;
  if (bio.length > 500) {
    throw new MatchFunctionError("validation_error", "bio must be at most 500 characters", 422);
  }
  if (CONTACT_PATTERN.test(bio)) {
    throw new MatchFunctionError("validation_error", "bio must not contain contact info", 422);
  }
  return bio;
}

export function parseUpsertProfileBody(body: Record<string, unknown>): UpsertProfileInput {
  const nickname = requireString("nickname", body.nickname, 20);
  const gender = requireString("gender", body.gender, 16);
  if (!GENDERS.has(gender)) {
    throw new MatchFunctionError("validation_error", "gender is invalid", 422);
  }
  const birth_date = parseBirthDate(requireString("birth_date", body.birth_date, 10));
  const prefecture = requireString("prefecture", body.prefecture, 32);
  const city = optionalString("city", body.city, 64);
  const bio = validateBio(optionalString("bio", body.bio, 500));
  const purpose = body.purpose === undefined || body.purpose === null || body.purpose === ""
    ? null
    : requireString("purpose", body.purpose, 32);
  if (purpose && !PURPOSES.has(purpose)) {
    throw new MatchFunctionError("validation_error", "purpose is invalid", 422);
  }
  const relationship_view = optionalString("relationship_view", body.relationship_view, 500);
  const weekend_style = optionalString("weekend_style", body.weekend_style, 120);

  let hobby_slugs: string[] = [];
  if (body.hobby_slugs !== undefined && body.hobby_slugs !== null) {
    if (!Array.isArray(body.hobby_slugs)) {
      throw new MatchFunctionError("validation_error", "hobby_slugs must be an array", 422);
    }
    hobby_slugs = body.hobby_slugs
      .map((s) => String(s ?? "").trim())
      .filter(Boolean);
    if (hobby_slugs.length > MAX_HOBBY_TAGS) {
      throw new MatchFunctionError("validation_error", `hobby_slugs max ${MAX_HOBBY_TAGS}`, 422);
    }
  }

  const publish = body.publish === true;

  return {
    nickname,
    gender,
    birth_date,
    prefecture,
    city: city ?? undefined,
    bio: bio ?? undefined,
    purpose,
    relationship_view,
    weekend_style,
    hobby_slugs,
    publish,
  };
}

async function resolveHobbyTagIds(
  serviceClient: SupabaseClient,
  slugs: string[],
): Promise<{ id: string; slug: string }[]> {
  if (!slugs.length) return [];
  const { data, error } = await serviceClient
    .from("match_hobby_tags")
    .select("id, slug")
    .in("slug", slugs)
    .eq("is_active", true);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  const found = new Map((data ?? []).map((row) => [String(row.slug), String(row.id)]));
  const unknown = slugs.filter((slug) => !found.has(slug));
  if (unknown.length) {
    throw new MatchFunctionError(
      "validation_error",
      `Unknown hobby slugs: ${unknown.join(", ")}`,
      422,
    );
  }
  return slugs.map((slug) => ({ slug, id: found.get(slug)! }));
}

async function syncProfileHobbyTags(
  userClient: SupabaseClient,
  profileId: string,
  tagIds: { id: string }[],
): Promise<void> {
  const { error: delErr } = await userClient
    .from("match_profile_hobby_tags")
    .delete()
    .eq("profile_id", profileId);
  if (delErr) throw new MatchFunctionError("internal_error", delErr.message, 500);

  if (!tagIds.length) return;

  const rows = tagIds.map((tag, index) => ({
    profile_id: profileId,
    hobby_tag_id: tag.id,
    display_order: index,
  }));
  const { error: insErr } = await userClient.from("match_profile_hobby_tags").insert(rows);
  if (insErr) throw new MatchFunctionError("internal_error", insErr.message, 500);
}

async function loadCompleteness(
  userClient: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await userClient.rpc("match_profile_completeness", {
    p_user_id: userId,
  });
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  return Number((data as Record<string, unknown>)?.percent ?? 0);
}

async function loadOwnPublicSnapshot(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<PublicProfileSnapshot | null> {
  const { data: profile, error } = await serviceClient
    .from("match_profiles")
    .select(
      "id, user_id, nickname, birth_date, prefecture, city, bio, purpose, profile_status, main_photo_id, last_active_at",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !profile) return null;

  let mainPhotoUrl: string | null = null;
  if (profile.main_photo_id) {
    const { data: photo } = await serviceClient
      .from("match_profile_photos")
      .select("storage_path")
      .eq("id", profile.main_photo_id)
      .maybeSingle();
    mainPhotoUrl = photo?.storage_path ? String(photo.storage_path) : null;
  }

  const { data: hobbies } = await serviceClient
    .from("match_profile_hobby_tags")
    .select("hobby_tag_id, display_order")
    .eq("profile_id", profile.id)
    .order("display_order", { ascending: true });

  const hobbyIds = (hobbies ?? []).map((row) => String(row.hobby_tag_id));
  const hobbyTags: string[] = [];
  if (hobbyIds.length) {
    const { data: tagRows } = await serviceClient
      .from("match_hobby_tags")
      .select("id, label_ja")
      .in("id", hobbyIds);
    const labelMap = new Map((tagRows ?? []).map((t) => [String(t.id), String(t.label_ja)]));
    for (const link of hobbies ?? []) {
      const label = labelMap.get(String(link.hobby_tag_id));
      if (label) hobbyTags.push(label);
    }
  }

  const birthDate = String(profile.birth_date ?? "");
  let age: number | null = null;
  if (birthDate) {
    const born = new Date(`${birthDate}T12:00:00Z`);
    if (!Number.isNaN(born.getTime())) {
      age = Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  let activityLabel: string | null = null;
  if (profile.last_active_at) {
    const { data: label } = await serviceClient.rpc("match_activity_label", {
      p_last_active_at: profile.last_active_at,
    });
    activityLabel = label ? String(label) : null;
  }

  return {
    profile_id: String(profile.id),
    user_id: String(profile.user_id),
    display_name: String(profile.nickname),
    age,
    prefecture: String(profile.prefecture),
    city: profile.city ? String(profile.city) : null,
    bio: profile.bio ? String(profile.bio) : null,
    purpose: profile.purpose ? String(profile.purpose) : null,
    hobby_tags: hobbyTags,
    main_photo_url: mainPhotoUrl,
    activity_label: activityLabel,
  };
}

export async function upsertProfileLive(
  req: Request,
  user: MatchAuthUser,
  input: UpsertProfileInput,
): Promise<UpsertProfileResult> {
  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  const profileStatus = input.publish ? "active" : "draft";
  if (!PROFILE_STATUSES.has(profileStatus)) {
    throw new MatchFunctionError("validation_error", "profile_status is invalid", 422);
  }

  const row = {
    user_id: user.matchUserId,
    nickname: input.nickname,
    gender: input.gender,
    birth_date: input.birth_date,
    prefecture: input.prefecture,
    city: input.city ?? null,
    bio: input.bio ?? null,
    purpose: input.purpose,
    relationship_view: input.relationship_view,
    weekend_style: input.weekend_style,
    profile_status: profileStatus,
    last_active_at: new Date().toISOString(),
  };

  const { data: existing, error: findErr } = await userClient
    .from("match_profiles")
    .select("id")
    .eq("user_id", user.matchUserId)
    .is("archived_at", null)
    .maybeSingle();
  if (findErr) throw new MatchFunctionError("internal_error", findErr.message, 500);

  let profileId: string;
  let created = false;

  if (existing?.id) {
    const { data: updated, error: updErr } = await userClient
      .from("match_profiles")
      .update(row)
      .eq("id", existing.id)
      .select("id, profile_status")
      .single();
    if (updErr) throw new MatchFunctionError("internal_error", updErr.message, 500);
    profileId = String(updated.id);
  } else {
    const { data: inserted, error: insErr } = await userClient
      .from("match_profiles")
      .insert(row)
      .select("id, profile_status")
      .single();
    if (insErr) {
      if (/duplicate|unique/i.test(insErr.message)) {
        throw new MatchFunctionError("conflict", "Profile already exists for this user", 409);
      }
      throw new MatchFunctionError("internal_error", insErr.message, 500);
    }
    profileId = String(inserted.id);
    created = true;
  }

  if (input.hobby_slugs) {
    const tags = await resolveHobbyTagIds(serviceClient, input.hobby_slugs);
    await syncProfileHobbyTags(userClient, profileId, tags);
  }

  const completionScore = await loadCompleteness(userClient, user.matchUserId);
  await userClient
    .from("match_profiles")
    .update({ completeness_cached: completionScore })
    .eq("id", profileId);

  const publicProfile = input.publish
    ? await loadOwnPublicSnapshot(serviceClient, user.matchUserId)
    : null;

  return {
    profile_id: profileId,
    created,
    profile_status: profileStatus,
    completion_score: completionScore,
    public_profile: publicProfile,
  };
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64Image(contentBase64: string): Uint8Array {
  const raw = contentBase64.includes(",") ? contentBase64.split(",").pop()! : contentBase64;
  const cleaned = raw.replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new MatchFunctionError("validation_error", "content_base64 is invalid", 422);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (!bytes.length) {
    throw new MatchFunctionError("validation_error", "content_base64 is empty", 422);
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new MatchFunctionError("validation_error", "Image exceeds 2MB limit", 422);
  }
  return bytes;
}

async function nextDisplayOrder(
  userClient: SupabaseClient,
  profileId: string,
): Promise<number> {
  const { data, error } = await userClient
    .from("match_profile_photos")
    .select("display_order")
    .eq("profile_id", profileId)
    .eq("photo_status", "active")
    .is("archived_at", null)
    .order("display_order", { ascending: false })
    .limit(1);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  const current = data?.[0]?.display_order;
  const next = Number.isFinite(Number(current)) ? Number(current) + 1 : 0;
  if (next > 9) {
    throw new MatchFunctionError("validation_error", "Maximum 10 photos per profile", 422);
  }
  return next;
}

export async function uploadPhotoLive(
  req: Request,
  user: MatchAuthUser,
  input: UploadPhotoInput,
): Promise<UploadPhotoResult> {
  const contentType = requireString("content_type", input.content_type, 32);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new MatchFunctionError("validation_error", "Unsupported image type", 422);
  }
  const bytes = decodeBase64Image(requireString("content_base64", input.content_base64, 3_000_000));
  const isMain = input.is_main === true;

  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  const { data: profile, error: profileErr } = await userClient
    .from("match_profiles")
    .select("id")
    .eq("user_id", user.matchUserId)
    .is("archived_at", null)
    .maybeSingle();
  if (profileErr) throw new MatchFunctionError("internal_error", profileErr.message, 500);
  if (!profile?.id) {
    throw new MatchFunctionError("profile_required", "Create profile before uploading photos", 403);
  }
  const profileId = String(profile.id);

  let displayOrder: number;
  if (isMain) {
    const { data: zeroRows, error: zeroErr } = await userClient
      .from("match_profile_photos")
      .select("id")
      .eq("profile_id", profileId)
      .eq("display_order", 0)
      .eq("photo_status", "active")
      .is("archived_at", null);
    if (zeroErr) throw new MatchFunctionError("internal_error", zeroErr.message, 500);
    if (zeroRows?.length) {
      const bumpOrder = await nextDisplayOrder(userClient, profileId);
      const { error: bumpErr } = await userClient
        .from("match_profile_photos")
        .update({ display_order: bumpOrder })
        .eq("id", zeroRows[0].id);
      if (bumpErr) throw new MatchFunctionError("internal_error", bumpErr.message, 500);
    }
    displayOrder = 0;
  } else {
    displayOrder = Number.isFinite(Number(input.display_order))
      ? Math.max(0, Math.min(9, Number(input.display_order)))
      : await nextDisplayOrder(userClient, profileId);
  }

  const photoId = crypto.randomUUID();
  const ext = extensionForContentType(contentType);
  const storagePath = `${user.matchUserId}/${photoId}.${ext}`;

  const { error: uploadErr } = await serviceClient.storage
    .from(MATCH_PHOTO_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
  if (uploadErr) {
    throw new MatchFunctionError("internal_error", uploadErr.message, 500);
  }

  const { data: inserted, error: insErr } = await userClient
    .from("match_profile_photos")
    .insert({
      id: photoId,
      profile_id: profileId,
      storage_path: storagePath,
      display_order: displayOrder,
      moderation_status: "approved",
      photo_status: "active",
    })
    .select("id, storage_path, display_order")
    .single();
  if (insErr) {
    await serviceClient.storage.from(MATCH_PHOTO_BUCKET).remove([storagePath]);
    throw new MatchFunctionError("internal_error", insErr.message, 500);
  }

  const { data: currentProfile } = await userClient
    .from("match_profiles")
    .select("main_photo_id")
    .eq("id", profileId)
    .maybeSingle();

  let becameMain = isMain;
  if (isMain) {
    const { error: mainErr } = await userClient
      .from("match_profiles")
      .update({ main_photo_id: photoId })
      .eq("id", profileId);
    if (mainErr) throw new MatchFunctionError("internal_error", mainErr.message, 500);
  } else if (!currentProfile?.main_photo_id) {
    becameMain = true;
    const { error: mainErr } = await userClient
      .from("match_profiles")
      .update({ main_photo_id: photoId })
      .eq("id", profileId);
    if (mainErr) throw new MatchFunctionError("internal_error", mainErr.message, 500);
  }

  return {
    photo_id: String(inserted.id),
    storage_path: String(inserted.storage_path),
    is_main: becameMain,
    display_order: Number(inserted.display_order),
  };
}

export async function assertProfileOwnedByUser(
  userClient: SupabaseClient,
  profileId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await userClient
    .from("match_profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data?.id) {
    throw new MatchFunctionError("forbidden", "Not allowed to modify this profile", 403);
  }
}
