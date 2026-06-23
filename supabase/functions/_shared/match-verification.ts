/**
 * MATCH verification — submit / list (live MVP · manual review)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authResponseFields,
  jsonResponse,
  MatchFunctionError,
  type MatchAuthUser,
} from "./match-auth.ts";
import { createMatchServiceClient, createUserClient } from "./match-db.ts";
import { isLiveCoreEnabled } from "./match-core.ts";

const API_TYPES = new Set(["identity", "age", "phone", "identity_document"]);
const ID_DOCUMENT_TYPES = new Set([
  "drivers_license",
  "mynumber",
  "passport",
  "residence_card",
]);
const OPEN_STATUSES = new Set(["pending", "submitted", "under_review", "phone_verified"]);

export type VerificationApiType = "identity" | "age" | "phone" | "identity_document";

export type VerificationItem = {
  verification_id: string;
  verification_type: string;
  status: string;
  submitted_at: string | null;
};

export type SubmitVerificationInput = {
  verification_type: string;
  id_document_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SubmitVerificationResult = {
  verification_id: string;
  verification_type: string;
  status: string;
  created: boolean;
  profile_verification_status: string | null;
};

export function isLiveVerificationEnabled(): boolean {
  return isLiveCoreEnabled();
}

export function verificationSuccess(
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

export function normalizeApiVerificationType(raw: string): VerificationApiType {
  const value = String(raw || "").trim().toLowerCase();
  if (!API_TYPES.has(value)) {
    throw new MatchFunctionError("validation_error", "Invalid verification_type", 422);
  }
  return value as VerificationApiType;
}

export function toDbVerificationType(apiType: VerificationApiType): string {
  if (apiType === "identity" || apiType === "identity_document") return "identity_document";
  return apiType;
}

export function toApiVerificationType(dbType: string): string {
  if (dbType === "identity_document") return "identity";
  return dbType;
}

function sanitizeMetadata(input?: Record<string, unknown> | null): Record<string, unknown> {
  const base = {
    phase: "manual_review",
    submitted_from: "match-verify.html",
    mvp: true,
    ekyc: false,
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const safe: Record<string, unknown> = { ...base };
  for (const key of ["submitted_from", "client_note"]) {
    if (typeof input[key] === "string" && String(input[key]).length <= 200) {
      safe[key] = String(input[key]).trim();
    }
  }
  return safe;
}

async function findOpenVerification(
  serviceClient: SupabaseClient,
  userId: string,
  dbType: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await serviceClient
    .from("match_verifications")
    .select("id, status")
    .eq("user_id", userId)
    .eq("verification_type", dbType)
    .is("archived_at", null)
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);
  if (!data) return null;
  return { id: String(data.id), status: String(data.status) };
}

async function syncProfileVerificationStatus(
  serviceClient: SupabaseClient,
  userId: string,
  dbType: string,
): Promise<string | null> {
  if (dbType !== "identity_document" && dbType !== "identity") return null;

  const { data: profile, error: readErr } = await serviceClient
    .from("match_profiles")
    .select("id, verification_status")
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (readErr) throw new MatchFunctionError("internal_error", readErr.message, 500);
  if (!profile?.id) return null;

  const current = String(profile.verification_status ?? "none");
  if (current === "verified") return current;

  const { data: rpcStatus, error: rpcErr } = await serviceClient.rpc(
    "match_edge_sync_profile_verification_pending",
    { p_user_id: userId },
  );
  if (rpcErr) throw new MatchFunctionError("internal_error", rpcErr.message, 500);
  if (typeof rpcStatus === "string" && rpcStatus) return rpcStatus;
  return current === "verified" || current === "phone_verified" ? current : "pending";
}

export async function listVerificationsLive(
  req: Request,
  user: MatchAuthUser,
): Promise<{ items: VerificationItem[] }> {
  const { client: userClient } = createUserClient(req);
  const { data, error } = await userClient
    .from("match_verifications")
    .select("id, verification_type, status, submitted_at, created_at")
    .eq("user_id", user.matchUserId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new MatchFunctionError("internal_error", error.message, 500);

  const items = (data ?? []).map((row) => ({
    verification_id: String(row.id),
    verification_type: toApiVerificationType(String(row.verification_type)),
    status: String(row.status),
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
  }));
  return { items };
}

export async function submitVerificationLive(
  req: Request,
  user: MatchAuthUser,
  input: SubmitVerificationInput,
): Promise<SubmitVerificationResult> {
  const apiType = normalizeApiVerificationType(input.verification_type);
  const dbType = toDbVerificationType(apiType);
  const userId = user.matchUserId;

  const { client: userClient } = createUserClient(req);
  const serviceClient = createMatchServiceClient();

  const metadata = sanitizeMetadata(input.metadata);
  let idDocumentType: string | null = null;
  if (dbType === "identity_document") {
    const rawDoc = input.id_document_type ?? metadata.id_document_type;
    if (rawDoc != null) {
      const doc = String(rawDoc).trim();
      if (!ID_DOCUMENT_TYPES.has(doc)) {
        throw new MatchFunctionError("validation_error", "Invalid id_document_type", 422);
      }
      idDocumentType = doc;
      metadata.id_document_type = doc;
    }
  }

  const existing = await findOpenVerification(serviceClient, userId, dbType);
  const now = new Date().toISOString();
  let verificationId = "";
  let created = false;
  let status = "pending";

  if (existing) {
    const { data, error } = await serviceClient
      .from("match_verifications")
      .update({
        status: "pending",
        submitted_at: now,
        id_document_type: idDocumentType,
        metadata_json: metadata,
        provider: "manual",
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("id, status")
      .single();
    if (error) throw new MatchFunctionError("internal_error", error.message, 500);
    verificationId = String(data.id);
    status = String(data.status);
    created = false;
  } else {
    const { data, error } = await userClient
      .from("match_verifications")
      .insert({
        user_id: userId,
        verification_type: dbType,
        status: "pending",
        submitted_at: now,
        id_document_type: idDocumentType,
        metadata_json: metadata,
        provider: "manual",
      })
      .select("id, status")
      .single();
    if (error) throw new MatchFunctionError("internal_error", error.message, 500);
    verificationId = String(data.id);
    status = String(data.status);
    created = true;
  }

  const profileStatus = await syncProfileVerificationStatus(serviceClient, userId, dbType);

  return {
    verification_id: verificationId,
    verification_type: toApiVerificationType(dbType),
    status,
    created,
    profile_verification_status: profileStatus,
  };
}
