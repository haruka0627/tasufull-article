/**
 * Creator Content Registration API（Cloudflare Pages Function）
 * GET /api/creator-content-registration
 *
 * 認証: Authorization: Bearer <Supabase JWT>
 * 対象: Staging Supabase（ahlxuyvhzqdqaojiywmu）
 *
 * ローカル開発・QA 専用。Production へ昇格するときは CC_SUPABASE_URL / CC_ANON_KEY を差し替える。
 * service_role キーは不要 — ユーザーの JWT + RLS で自身の行のみ取得。
 */

/** Staging Supabase（公開値のため commit 可） */
const DEFAULT_CC_SUPABASE_URL = "https://ahlxuyvhzqdqaojiywmu.supabase.co";
const DEFAULT_CC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHh1eXZoenFkcWFvaml5d211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTIxMDEsImV4cCI6MjA5ODQyODEwMX0.48PLkHjakY4ZivY7gC57JmoUwmOSA3PzrQeO2T-VWGg";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * JWT ペイロードから project ref を安全に読む（署名検証は Supabase が行う）。
 * @param {string} jwt
 * @returns {string}
 */
function extractJwtRef(jwt) {
  try {
    const part = jwt.split(".")[1];
    if (!part) return "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    const payload = JSON.parse(decoded);
    return String(payload.ref || "").trim();
  } catch {
    return "";
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return corsPreflightResponse();
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = String(env.CC_SUPABASE_URL || DEFAULT_CC_SUPABASE_URL).replace(/\/$/, "");
  const anonKey = String(env.CC_ANON_KEY || DEFAULT_CC_ANON_KEY).trim();

  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized", reason: "missing_bearer_token" }, 401);
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return jsonResponse({ error: "unauthorized", reason: "empty_token" }, 401);
  }

  /* Project ref ガード — Production JWT で Staging API を叩くのを防ぐ */
  const jwtRef = extractJwtRef(jwt);
  const expectedRefMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  const expectedRef = expectedRefMatch ? expectedRefMatch[1] : "";

  if (jwtRef && expectedRef && jwtRef !== expectedRef) {
    return jsonResponse(
      {
        error: "invalid_token",
        reason: "project_mismatch",
        hint: `JWT ref (${jwtRef}) does not match API project (${expectedRef})`,
      },
      401,
    );
  }

  /* Supabase REST — RLS が user_id = auth.uid() のみ返す */
  let supabaseResp;
  try {
    supabaseResp = await fetch(
      `${supabaseUrl}/rest/v1/creator_content_creators?select=user_id,display_name,creator_slug,profile_bio,categories,content_types,status,created_at`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: anonKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );
  } catch (err) {
    return jsonResponse({ error: "upstream_fetch_error", reason: String(err?.message || err) }, 502);
  }

  if (!supabaseResp.ok) {
    if (supabaseResp.status === 401 || supabaseResp.status === 403) {
      return jsonResponse({ error: "invalid_token", reason: "supabase_auth_rejected" }, 401);
    }
    return jsonResponse(
      { error: "upstream_error", httpStatus: supabaseResp.status },
      502,
    );
  }

  let rows;
  try {
    rows = await supabaseResp.json();
  } catch {
    return jsonResponse({ error: "upstream_json_parse_error" }, 502);
  }

  if (!Array.isArray(rows)) {
    return jsonResponse({ error: "upstream_unexpected_format" }, 502);
  }

  const registered = rows.length > 0;
  const first = registered ? rows[0] : null;

  return jsonResponse({
    ok: true,
    registered,
    status: first ? String(first.status || "active") : "none",
    data: first
      ? {
          display_name: first.display_name,
          creator_slug: first.creator_slug,
          profile_bio: first.profile_bio,
          categories: first.categories,
          content_types: first.content_types,
          status: first.status,
          created_at: first.created_at,
        }
      : null,
  });
}
