/**
 * Tripo OpenAPI クライアント（接続確認のみ）
 * 3D生成・画像生成・タスク作成は呼び出さない。
 */

export const TRIPO_API_BASE_DEFAULT = "https://api.tripo3d.ai/v2/openapi";

/** 存在しない task_id（照会のみ・作成・課金なし） */
const AUTH_PROBE_TASK_ID = "00000000-0000-4000-8000-000000000001";

export type TripoHealthResult =
  | {
      ok: true;
      connected: true;
      httpStatus: number;
      traceId: string | null;
      balanceChecked: boolean;
      balanceAvailable: boolean;
      authMethod: "balance" | "task_probe";
    }
  | {
      ok: false;
      connected: false;
      httpStatus: number;
      error: string;
      code?: string | number;
      traceId: string | null;
    };

export function getTripoApiKey(): string {
  let key = String(Deno.env.get("TRIPO_API_KEY") || "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export function getTripoApiBase(): string {
  const base = String(Deno.env.get("TRIPO_API_BASE_URL") || TRIPO_API_BASE_DEFAULT)
    .trim()
    .replace(/\/$/, "");
  return base || TRIPO_API_BASE_DEFAULT;
}

export function isTripoGenerationEnabled(): boolean {
  const v = String(Deno.env.get("GENAI_3D_GENERATION_ENABLED") || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type TripoFetchOutcome = {
  res: Response;
  traceId: string | null;
  body: Record<string, unknown> | null;
};

async function tripoFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "GET"
): Promise<TripoFetchOutcome> {
  const url = `${getTripoApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? "{}" : undefined,
  });
  const traceId = res.headers.get("X-Tripo-Trace-ID") || res.headers.get("x-tripo-trace-id");
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  return { res, traceId, body };
}

function parseTripoError(body: Record<string, unknown> | null, fallback: string): string {
  if (!body) return fallback;
  const nested =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;
  return String(
    nested.message || nested.suggestion || body.message || body.error || fallback
  );
}

function isBalanceResponseOk(res: Response, body: Record<string, unknown> | null): boolean {
  if (!res.ok) return false;
  if (!body) return true;
  if (body.code === 0) return true;
  if (body.data && typeof body.data === "object") return true;
  return res.status === 200;
}

/** 存在しない task 照会 → 2001 task not found なら認証成功（課金なし） */
function isAuthProbeSuccess(res: Response, body: Record<string, unknown> | null): boolean {
  if (res.status === 401 || res.status === 403) return false;
  const code = Number(body?.code ?? body?.error_code);
  if (code === 2001) return true;
  const msg = parseTripoError(body, "").toLowerCase();
  if (res.status === 404 && (msg.includes("not found") || msg.includes("task"))) {
    return true;
  }
  const data = body?.data as Record<string, unknown> | undefined;
  if (data?.error_code === 2001) return true;
  return false;
}

/**
 * Tripo 接続確認
 * 1. GET 残高系（課金なし・読み取りのみ）
 * 2. フォールバック: 存在しない task_id の GET 照会（作成・課金なし）
 */
export async function checkTripoConnection(): Promise<TripoHealthResult> {
  const apiKey = getTripoApiKey();
  if (!apiKey) {
    return {
      ok: false,
      connected: false,
      httpStatus: 500,
      error: "TRIPO_API_KEY が未設定です",
      traceId: null,
    };
  }

  const balancePaths = [
    "/user/balance",
    "/balance",
    "/account/balance",
    "/auth/balance",
  ];

  for (const path of balancePaths) {
    try {
      const { res, traceId, body } = await tripoFetch(apiKey, path, "GET");
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          connected: false,
          httpStatus: res.status,
          error: parseTripoError(body, "Authentication failed"),
          code: body?.code ?? 1002,
          traceId,
        };
      }
      if (isBalanceResponseOk(res, body)) {
        return {
          ok: true,
          connected: true,
          httpStatus: res.status,
          traceId,
          balanceChecked: true,
          balanceAvailable: true,
          authMethod: "balance",
        };
      }
    } catch {
      /* try next path */
    }
  }

  try {
    const { res, traceId, body } = await tripoFetch(
      apiKey,
      `/task/${AUTH_PROBE_TASK_ID}`,
      "GET"
    );

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        connected: false,
        httpStatus: res.status,
        error: parseTripoError(body, "Authentication failed"),
        code: body?.code ?? 1002,
        traceId,
      };
    }

    if (isAuthProbeSuccess(res, body)) {
      return {
        ok: true,
        connected: true,
        httpStatus: res.status,
        traceId,
        balanceChecked: true,
        balanceAvailable: false,
        authMethod: "task_probe",
      };
    }

    return {
      ok: false,
      connected: false,
      httpStatus: res.status,
      error: parseTripoError(body, `Tripo API 応答を解釈できません (HTTP ${res.status})`),
      code: body?.code,
      traceId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      connected: false,
      httpStatus: 502,
      error: `Tripo API への接続に失敗しました: ${message}`,
      traceId: null,
    };
  }
}
