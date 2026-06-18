/**
 * Edge Functions 共通 CORS（localhost / 127.0.0.1 / 開発サーバ対応）
 */
const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, accept, x-requested-with, x-supabase-api-version";

const ALLOW_METHODS = "POST, GET, OPTIONS";

/** 常に許可する開発オリジン（ポート任意・8765 含む） */
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function parseExtraOrigins(): string[] {
  const raw = Deno.env.get("TASU_CORS_ALLOWED_ORIGINS") || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * リクエスト Origin が許可リストに含まれるか
 */
export function isAllowedOrigin(origin: string): boolean {
  const o = String(origin || "").trim();
  if (!o) return true;
  try {
    const u = new URL(o);
    const host = u.hostname.toLowerCase();
    if (DEV_HOSTS.has(host)) return true;
    const extras = parseExtraOrigins();
    if (extras.includes(o)) return true;
    if (/\.(tasufull|tasu)\./i.test(host) || /vercel\.app$/i.test(host)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Access-Control-Allow-Origin の値（許可時は Origin をエコー、非ブラウザは *）
 */
export function resolveAllowOrigin(req?: Request): string {
  const origin = req?.headers.get("Origin")?.trim() || "";
  if (!origin) return "*";
  if (isAllowedOrigin(origin)) return origin;
  return "*";
}

export function corsHeadersFor(req?: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveAllowOrigin(req),
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/** @deprecated 互換用 — 新規は corsHeadersFor(req) を使用 */
export const corsHeaders: Record<string, string> = corsHeadersFor();

function mergeInit(
  req?: Request,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    ...corsHeadersFor(req),
    "Content-Type": "application/json",
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  req?: Request,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeInit(req, extraHeaders),
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;

  const origin = req.headers.get("Origin")?.trim() || "";
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ ok: false, message: "CORS origin not allowed" }), {
      status: 403,
      headers: mergeInit(req),
    });
  }

  return new Response(null, { status: 204, headers: corsHeadersFor(req) });
}
