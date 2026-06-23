/**
 * TASFUL LIVE — 公開ショート動画 signed URL 発行（Phase 4）
 *
 * POST { short_id: uuid }
 * → { signedUrl, expiresIn, expiresAt }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getBearerToken } from "../_shared/talk-room-auth.ts";

const SIGNED_URL_TTL_SEC = 300;
const STORAGE_BUCKET = "short-videos";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DENIED_STATUSES = new Set(["draft", "hidden", "removed"]);

type RequestBody = {
  short_id?: unknown;
};

function requirePost(req: Request): void {
  if (req.method !== "POST") {
    throw Object.assign(new Error("Method Not Allowed"), { status: 405 });
  }
}

function parseShortId(body: RequestBody): string {
  const shortId = String(body?.short_id ?? "").trim();
  if (!shortId) {
    throw Object.assign(new Error("short_id is required"), { status: 400 });
  }
  if (!UUID_RE.test(shortId)) {
    throw Object.assign(new Error("short_id must be a valid uuid"), { status: 400 });
  }
  return shortId;
}

function createServiceClient() {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw Object.assign(new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"), { status: 500 });
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function handler(req: Request): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  try {
    requirePost(req);

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authorization header required" }, 401, req);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, req);
    }

    const shortId = parseShortId(body);
    const supabase = createServiceClient();

    const { data: short, error: shortErr } = await supabase
      .from("live_shorts")
      .select("id, status, storage_path, creator_id")
      .eq("id", shortId)
      .maybeSingle();

    if (shortErr) {
      return jsonResponse({ error: "Failed to load short", details: shortErr.message }, 500, req);
    }
    if (!short) {
      return jsonResponse({ error: "Short not found" }, 404, req);
    }

    const status = String(short.status || "").trim();
    if (status !== "published") {
      const code = DENIED_STATUSES.has(status) ? "short_not_published" : "invalid_status";
      return jsonResponse({ error: "Short is not available for playback", code, status }, 403, req);
    }

    const storagePath = String(short.storage_path || "").trim();
    if (!storagePath) {
      return jsonResponse({ error: "storage_path missing" }, 500, req);
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

    if (error || !data?.signedUrl) {
      return jsonResponse(
        { error: "createSignedUrl failed", details: error?.message || "no signedUrl" },
        500,
        req,
      );
    }

    return jsonResponse(
      {
        ok: true,
        short_id: shortId,
        signedUrl: data.signedUrl,
        expiresIn: SIGNED_URL_TTL_SEC,
        expiresAt: data.expiresAt ?? null,
      },
      200,
      req,
    );
  } catch (err) {
    const status = Number((err as { status?: number })?.status || 500);
    const message = err instanceof Error ? err.message : String(err);
    if (status === 405) {
      return jsonResponse({ error: message }, 405, req);
    }
    if (status === 400) {
      return jsonResponse({ error: message }, 400, req);
    }
    return jsonResponse({ error: message }, status >= 400 && status < 600 ? status : 500, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
