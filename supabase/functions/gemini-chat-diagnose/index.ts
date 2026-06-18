/**
 * Gemini 接続診断（キー fingerprint / secret digest 照合 / Google 生レスポンス）
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

function maskKey(key: string) {
  const k = String(key || "").trim();
  if (!k) return { prefix: "", length: 0, suffix: "" };
  return {
    prefix: k.slice(0, 8),
    length: k.length,
    suffix: k.length > 4 ? k.slice(-4) : "",
  };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function collectHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function googleProbe(
  label: string,
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, init);
    const headers = collectHeaders(res);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { _rawText: text };
    }
    return {
      label,
      url: url.replace(/key=[^&]+/, "key=***REDACTED***"),
      method: init?.method || "GET",
      httpStatus: res.status,
      responseHeaders: headers,
      body,
    };
  } catch (err) {
    return {
      label,
      url: url.replace(/key=[^&]+/, "key=***REDACTED***"),
      method: init?.method || "GET",
      fetchError: err instanceof Error ? err.message : String(err),
    };
  }
}

function parseSupabaseProjectRef(): string {
  const url = String(Deno.env.get("SUPABASE_URL") || "").trim();
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] || "";
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim() || "";
  const keyInfo = maskKey(apiKey);
  const secretSha256 = apiKey ? await sha256Hex(apiKey) : "";

  const generateUrl =
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generatePayload = {
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 32,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const googleProbes: Record<string, unknown>[] = [];

  if (apiKey) {
    googleProbes.push(
      await googleProbe(
        "generateContent_ping",
        generateUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(generatePayload),
        }
      )
    );
    googleProbes.push(
      await googleProbe(
        "models_list",
        `${GEMINI_API_BASE}?key=${encodeURIComponent(apiKey)}`
      )
    );
    googleProbes.push(
      await googleProbe(
        "model_get_gemini-2.5-flash",
        `${GEMINI_API_BASE}/${GEMINI_MODEL}?key=${encodeURIComponent(apiKey)}`
      )
    );
    googleProbes.push(
      await googleProbe(
        "generateContent_header_auth",
        `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(generatePayload),
        }
      )
    );
  }

  const generateProbe = googleProbes.find((p) => p.label === "generateContent_ping");

  return jsonResponse({
    edgeFunction: "gemini-chat-diagnose",
    supabase: {
      projectRef: parseSupabaseProjectRef() || "ddojquacsyqesrjhcvmn",
      url: String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, ""),
      note: "Google Cloud project ではなく Supabase プロジェクト ID です",
    },
    geminiApiKey: {
      configured: Boolean(apiKey),
      prefix: keyInfo.prefix,
      length: keyInfo.length,
      suffix: keyInfo.suffix,
      secretSha256,
      secretDigestNote:
        "secretSha256 を `supabase secrets list` の GEMINI_API_KEY digest と比較。一致すれば Edge が参照するキーは Secret と同一です。",
    },
    model: GEMINI_MODEL,
    apiBase: GEMINI_API_BASE,
    requestUrlPattern: `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=***REDACTED***`,
    googleProbes,
    geminiHttpStatus: generateProbe?.httpStatus ?? 0,
    geminiResponseHeaders: generateProbe?.responseHeaders ?? {},
    geminiRawResponse: generateProbe?.body ?? null,
    edgeEnvKeysPresent: {
      GEMINI_API_KEY: Boolean(apiKey),
      SUPABASE_URL: Boolean(Deno.env.get("SUPABASE_URL")),
      GOOGLE_CLOUD_PROJECT: Boolean(Deno.env.get("GOOGLE_CLOUD_PROJECT")),
    },
  });
});
