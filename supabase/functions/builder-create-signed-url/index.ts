// Supabase Edge Function (implementation-ready draft; do not deploy yet)
// Purpose: check project read access, then mint a Storage signed_url.
//
// IMPORTANT:
// - Do NOT deploy blindly. Confirm DB RPC + JWT claims model first.
// - This function uses SUPABASE_URL and SUPABASE_ANON_KEY.
// - It uses the *user's JWT* from Authorization header for DB/RLS evaluation.
// - If you need privileged checks, consider service-role usage carefully.
//
// Request JSON:
// {
//   bucket: "builder-photos" | "builder-pdfs",
//   path: string,
//   expiresIn?: number
// }
//
// Response:
// { signedUrl: string, expiresAt: string }
//
// TODO:
// - Implement DB authorization check:
//     builder_can_read_project(project_id uuid)
//   via RPC or SQL query using Supabase client.
//
// - Enforce stricter rules for write vs read (this function is read-only).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function cors(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

function extractProjectIdFromPath(path: string): string | null {
  // Expected: {project_id}/{thread_id}/{...}
  const seg = String(path || "").split("/").filter(Boolean);
  if (!seg.length) return null;
  return seg[0] || null;
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ""));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return cors(405, { error: "Method Not Allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return cors(500, { error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return cors(401, { error: "Missing Authorization Bearer token" });
  }

  let payload: { bucket?: string; path?: string; expiresIn?: number };
  try {
    payload = await req.json();
  } catch {
    return cors(400, { error: "Invalid JSON body" });
  }

  const bucket = String(payload.bucket || "");
  const path = String(payload.path || "");
  const expiresIn = Math.max(10, Math.min(3600, Number(payload.expiresIn || 600))); // 10s..3600s

  if (!bucket || !path) return cors(400, { error: "bucket and path are required" });
  if (bucket !== "builder-photos" && bucket !== "builder-pdfs") {
    return cors(400, { error: "Unsupported bucket" });
  }

  const projectId = extractProjectIdFromPath(path);
  if (!projectId) return cors(400, { error: "Could not extract project_id from path" });
  if (!isUuidLike(projectId)) return cors(400, { error: "project_id in path must be uuid" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // TODO: confirm user identity / claims if needed
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return cors(401, { error: "Invalid token" });
  }

  // DB authorization check (RPC)
  // NOTE: requires public.builder_can_read_project(p_project_id uuid) to exist.
  const { data: ok, error: okErr } = await supabase.rpc("builder_can_read_project", { p_project_id: projectId });
  if (okErr) {
    return cors(500, { error: "Authorization check failed", details: okErr.message });
  }
  if (!ok) {
    return cors(403, { error: "Forbidden" });
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    return cors(500, { error: "createSignedUrl failed", details: error.message });
  }
  return cors(200, { signedUrl: data.signedUrl, expiresAt: data.expiresAt });
});

