/**
 * MATCH admin review — reports · verifications · profile actions (live MVP)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAdminUser,
  validateTextLength,
  validateUuidLike,
} from "./match-auth.ts";
import { createMatchServiceClient } from "./match-db.ts";
import { isLiveCoreEnabled } from "./match-core.ts";

const ADMIN_ACTIONS = new Set(["REPORT_REVIEW", "VERIFICATION_REVIEW", "PROFILE_ACTION"]);
const REPORT_DECISIONS = new Set(["resolve", "dismiss"]);
const VERIFICATION_DECISIONS = new Set(["approve", "reject"]);
const PROFILE_DECISIONS = new Set(["suspend", "unsuspend"]);

const OPEN_REPORT_STATUSES = ["open", "reviewing"];
const PENDING_VERIFICATION_STATUSES = ["pending", "submitted", "under_review", "phone_verified"];
const TERMINAL_VERIFICATION_STATUSES = ["approved", "rejected"];
const TERMINAL_REPORT_STATUSES = ["resolved", "dismissed"];

const IDENTITY_DB_TYPES = new Set(["identity_document"]);
const AGE_DB_TYPES = new Set(["age"]);

export type AdminReviewBody = {
  intent?: unknown;
  action?: unknown;
  report_id?: unknown;
  verification_id?: unknown;
  profile_id?: unknown;
  decision?: unknown;
  verification_type?: unknown;
  note?: unknown;
};

export function isLiveAdminEnabled(): boolean {
  return isLiveCoreEnabled();
}

export function adminSuccess(
  req: Request,
  admin: MatchAdminUser,
  data: Record<string, unknown>,
  status = 200,
): Response {
  return jsonResponse(
    {
      ok: true,
      mode: "live",
      ...authResponseFields(admin),
      admin_role: admin.adminRole,
      ...data,
    },
    status,
    req,
  );
}

function normalizeIntent(raw: unknown): string {
  return String(raw ?? "execute").trim().toLowerCase();
}

function normalizeAction(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeDecision(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function normalizeVerificationFilter(raw: unknown): string {
  const value = String(raw ?? "all").trim().toLowerCase();
  if (value === "identity" || value === "age" || value === "all") return value;
  throw new MatchFunctionError("validation_error", "verification_type must be identity, age, or all", 422);
}

async function writeAdminAudit(
  serviceClient: SupabaseClient,
  admin: MatchAdminUser,
  params: {
    contentType: "admin_report" | "admin_verification" | "admin_profile";
    contentRef: string;
    targetUserId: string | null;
    note: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await serviceClient.from("match_moderation_logs").insert({
    user_id: params.targetUserId,
    content_type: params.contentType,
    content_ref: params.contentRef,
    input_text: params.note,
    level: "ok",
    reasons: [],
    allowed: true,
    engine: "admin",
    metadata_json: {
      admin_user_id: admin.matchUserId,
      admin_role: admin.adminRole,
      ...params.metadata,
    },
  });
  if (error) {
    console.warn("[match-admin] audit log insert failed", error.message);
  }
}

export async function listReportsLive(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from("match_reports")
    .select(
      "id, reporter_user_id, reported_user_id, reason, detail, context_type, status, created_at, updated_at",
    )
    .is("archived_at", null)
    .in("status", OPEN_REPORT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const items = await enrichReportTargets(serviceClient, data ?? []);
  return { items };
}

async function enrichReportTargets(
  serviceClient: SupabaseClient,
  rows: Record<string, unknown>[],
) {
  const userIds = new Set<string>();
  for (const row of rows) {
    userIds.add(String(row.reporter_user_id));
    userIds.add(String(row.reported_user_id));
  }
  const profiles = await loadProfilesByUserIds(serviceClient, [...userIds]);
  const byUser = new Map(profiles.map((p) => [p.user_id, p]));

  return rows.map((row) => ({
    report_id: String(row.id),
    reporter_user_id: String(row.reporter_user_id),
    reported_user_id: String(row.reported_user_id),
    reason: String(row.reason),
    detail: row.detail ? String(row.detail) : null,
    context_type: String(row.context_type),
    status: String(row.status),
    created_at: String(row.created_at),
    reporter: byUser.get(String(row.reporter_user_id)) ?? null,
    reported: byUser.get(String(row.reported_user_id)) ?? null,
  }));
}

async function loadProfilesByUserIds(
  serviceClient: SupabaseClient,
  userIds: string[],
) {
  if (!userIds.length) return [];
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, user_id, nickname, profile_status, verification_status, age_verified")
    .in("user_id", userIds)
    .is("archived_at", null);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  return (data ?? []).map((row) => ({
    profile_id: String(row.id),
    user_id: String(row.user_id),
    display_name: String(row.nickname ?? ""),
    profile_status: String(row.profile_status),
    verification_status: String(row.verification_status ?? "none"),
    age_verified: Boolean(row.age_verified),
  }));
}

export async function listVerificationsLive(
  serviceClient: SupabaseClient,
  verificationType: string,
) {
  let query = serviceClient
    .from("match_verifications")
    .select(
      "id, user_id, verification_type, status, id_document_type, submitted_at, created_at, metadata_json",
    )
    .is("archived_at", null)
    .in("status", PENDING_VERIFICATION_STATUSES)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (verificationType === "identity") {
    query = query.in("verification_type", [...IDENTITY_DB_TYPES]);
  } else if (verificationType === "age") {
    query = query.in("verification_type", [...AGE_DB_TYPES]);
  }

  const { data, error } = await query;
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const userIds = [...new Set((data ?? []).map((r) => String(r.user_id)))];
  const profiles = await loadProfilesByUserIds(serviceClient, userIds);
  const byUser = new Map(profiles.map((p) => [p.user_id, p]));

  const items = (data ?? []).map((row) => {
    const dbType = String(row.verification_type);
    const apiType = dbType === "identity_document" ? "identity" : dbType;
    return {
      verification_id: String(row.id),
      user_id: String(row.user_id),
      verification_type: apiType,
      status: String(row.status),
      id_document_type: row.id_document_type ? String(row.id_document_type) : null,
      submitted_at: row.submitted_at ? String(row.submitted_at) : null,
      profile: byUser.get(String(row.user_id)) ?? null,
    };
  });
  return { items, verification_type: verificationType };
}

export async function listProfilesForAdminLive(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, user_id, nickname, profile_status, verification_status, age_verified, prefecture, created_at")
    .is("archived_at", null)
    .in("profile_status", ["active", "suspended", "hidden"])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const items = (data ?? []).map((row) => ({
    profile_id: String(row.id),
    user_id: String(row.user_id),
    display_name: String(row.nickname ?? ""),
    profile_status: String(row.profile_status),
    verification_status: String(row.verification_status ?? "none"),
    age_verified: Boolean(row.age_verified),
    prefecture: row.prefecture ? String(row.prefecture) : null,
    created_at: String(row.created_at),
  }));
  return { items };
}

async function loadReport(serviceClient: SupabaseClient, reportId: string) {
  const { data, error } = await serviceClient
    .from("match_reports")
    .select("id, reporter_user_id, reported_user_id, status")
    .eq("id", reportId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data) throw new MatchFunctionError("not_found", "Report not found", 404);
  return data;
}

async function loadVerification(serviceClient: SupabaseClient, verificationId: string) {
  const { data, error } = await serviceClient
    .from("match_verifications")
    .select("id, user_id, verification_type, status")
    .eq("id", verificationId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data) throw new MatchFunctionError("not_found", "Verification not found", 404);
  return data;
}

async function loadProfile(serviceClient: SupabaseClient, profileId: string) {
  const { data, error } = await serviceClient
    .from("match_profiles")
    .select("id, user_id, profile_status")
    .eq("id", profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data) throw new MatchFunctionError("not_found", "Profile not found", 404);
  return data;
}

async function reviewReportLive(
  serviceClient: SupabaseClient,
  admin: MatchAdminUser,
  reportId: string,
  decision: string,
  note: string | null,
) {
  if (!REPORT_DECISIONS.has(decision)) {
    throw new MatchFunctionError("validation_error", "decision must be resolve or dismiss", 422);
  }

  const report = await loadReport(serviceClient, reportId);
  const currentStatus = String(report.status);
  if (TERMINAL_REPORT_STATUSES.includes(currentStatus)) {
    return {
      report_id: reportId,
      status: currentStatus,
      already_reviewed: true,
    };
  }
  if (!OPEN_REPORT_STATUSES.includes(currentStatus)) {
    throw new MatchFunctionError("conflict", `Report status is ${currentStatus}`, 409);
  }

  const nextStatus = decision === "resolve" ? "resolved" : "dismissed";
  const now = new Date().toISOString();
  const { data, error } = await serviceClient
    .from("match_reports")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", reportId)
    .select("id, status")
    .single();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  await writeAdminAudit(serviceClient, admin, {
    contentType: "admin_report",
    contentRef: reportId,
    targetUserId: String(report.reported_user_id),
    note,
    metadata: { action: "REPORT_REVIEW", decision, previous_status: currentStatus },
  });

  return {
    report_id: String(data.id),
    status: String(data.status),
    already_reviewed: false,
  };
}

async function reviewVerificationLive(
  serviceClient: SupabaseClient,
  admin: MatchAdminUser,
  verificationId: string,
  decision: string,
  note: string | null,
) {
  if (!VERIFICATION_DECISIONS.has(decision)) {
    throw new MatchFunctionError("validation_error", "decision must be approve or reject", 422);
  }

  const row = await loadVerification(serviceClient, verificationId);
  const currentStatus = String(row.status);
  const userId = String(row.user_id);
  const dbType = String(row.verification_type);

  if (TERMINAL_VERIFICATION_STATUSES.includes(currentStatus)) {
    return {
      verification_id: verificationId,
      status: currentStatus,
      verification_type: dbType === "identity_document" ? "identity" : dbType,
      already_reviewed: true,
    };
  }
  if (!PENDING_VERIFICATION_STATUSES.includes(currentStatus)) {
    throw new MatchFunctionError("conflict", `Verification status is ${currentStatus}`, 409);
  }

  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const now = new Date().toISOString();
  const { data, error } = await serviceClient
    .from("match_verifications")
    .update({
      status: nextStatus,
      reviewed_at: now,
      reviewed_by: admin.matchUserId,
      reject_reason: decision === "reject" ? (note || "rejected_by_admin") : null,
      updated_at: now,
    })
    .eq("id", verificationId)
    .select("id, status, verification_type")
    .single();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  let profileVerificationStatus: string | null = null;
  let ageVerified: boolean | null = null;

  if (IDENTITY_DB_TYPES.has(dbType)) {
    const profileStatus = decision === "approve" ? "verified" : "rejected";
    const { data: rpcStatus, error: rpcErr } = await serviceClient.rpc(
      "match_edge_admin_set_verification_status",
      { p_user_id: userId, p_status: profileStatus },
    );
    if (rpcErr) throw new MatchFunctionError("internal_error", rpcErr.message, 500);
    profileVerificationStatus = typeof rpcStatus === "string" ? rpcStatus : profileStatus;
  } else if (AGE_DB_TYPES.has(dbType)) {
    const verified = decision === "approve";
    const { data: rpcAge, error: ageErr } = await serviceClient.rpc(
      "match_edge_admin_set_age_verified",
      { p_user_id: userId, p_verified: verified },
    );
    if (ageErr) throw new MatchFunctionError("internal_error", ageErr.message, 500);
    ageVerified = Boolean(rpcAge);
  }

  await writeAdminAudit(serviceClient, admin, {
    contentType: "admin_verification",
    contentRef: verificationId,
    targetUserId: userId,
    note,
    metadata: {
      action: "VERIFICATION_REVIEW",
      decision,
      verification_type: dbType,
      profile_verification_status: profileVerificationStatus,
      age_verified: ageVerified,
    },
  });

  return {
    verification_id: String(data.id),
    status: String(data.status),
    verification_type: String(data.verification_type) === "identity_document"
      ? "identity"
      : String(data.verification_type),
    profile_verification_status: profileVerificationStatus,
    age_verified: ageVerified,
    already_reviewed: false,
  };
}

async function profileActionLive(
  serviceClient: SupabaseClient,
  admin: MatchAdminUser,
  profileId: string,
  decision: string,
  note: string | null,
) {
  if (!PROFILE_DECISIONS.has(decision)) {
    throw new MatchFunctionError("validation_error", "decision must be suspend or unsuspend", 422);
  }

  const profile = await loadProfile(serviceClient, profileId);
  const currentStatus = String(profile.profile_status);
  const targetStatus = decision === "suspend" ? "suspended" : "active";

  if (currentStatus === targetStatus) {
    return {
      profile_id: profileId,
      user_id: String(profile.user_id),
      profile_status: currentStatus,
      already_applied: true,
    };
  }

  const { data: rpcStatus, error: rpcErr } = await serviceClient.rpc(
    "match_edge_admin_set_profile_status",
    { p_profile_id: profileId, p_status: targetStatus },
  );
  if (rpcErr) throw new MatchFunctionError("internal_error", rpcErr.message, 500);

  await writeAdminAudit(serviceClient, admin, {
    contentType: "admin_profile",
    contentRef: profileId,
    targetUserId: String(profile.user_id),
    note,
    metadata: {
      action: "PROFILE_ACTION",
      decision,
      previous_status: currentStatus,
      profile_status: typeof rpcStatus === "string" ? rpcStatus : targetStatus,
    },
  });

  return {
    profile_id: profileId,
    user_id: String(profile.user_id),
    profile_status: typeof rpcStatus === "string" ? rpcStatus : targetStatus,
    already_applied: false,
  };
}

export async function adminReviewLive(
  req: Request,
  admin: MatchAdminUser,
  body: AdminReviewBody,
): Promise<Record<string, unknown>> {
  const serviceClient = createMatchServiceClient();
  const intent = normalizeIntent(body.intent);

  if (intent === "list_reports") {
    return listReportsLive(serviceClient);
  }
  if (intent === "list_verifications") {
    const filter = normalizeVerificationFilter(body.verification_type);
    return listVerificationsLive(serviceClient, filter);
  }
  if (intent === "list_profiles") {
    return listProfilesForAdminLive(serviceClient);
  }

  const action = normalizeAction(body.action);
  if (!ADMIN_ACTIONS.has(action)) {
    throw new MatchFunctionError(
      "validation_error",
      "action must be REPORT_REVIEW, VERIFICATION_REVIEW, or PROFILE_ACTION",
      422,
    );
  }

  const noteRaw = body.note === undefined || body.note === null
    ? null
    : validateTextLength("note", body.note, 2000, { required: false });
  const note = noteRaw || null;

  if (action === "REPORT_REVIEW") {
    const reportId = validateUuidLike("report_id", body.report_id);
    const decision = normalizeDecision(body.decision);
    return reviewReportLive(serviceClient, admin, reportId, decision, note);
  }

  if (action === "VERIFICATION_REVIEW") {
    const verificationId = validateUuidLike("verification_id", body.verification_id);
    const decision = normalizeDecision(body.decision);
    return reviewVerificationLive(serviceClient, admin, verificationId, decision, note);
  }

  const profileId = validateUuidLike("profile_id", body.profile_id);
  const decision = normalizeDecision(body.decision);
  return profileActionLive(serviceClient, admin, profileId, decision, note);
}
