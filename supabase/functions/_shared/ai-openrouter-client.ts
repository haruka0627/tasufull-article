/**
 * OpenRouter HTTP client（Edge PoC）
 * 正本契約: scripts/lib/ai-openrouter-client.mjs
 */
import {
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_ERROR_CODES,
  classifyOpenRouterHttpStatus,
  extractOpenRouterUsageUnits,
  isAllowedOpenRouterSlug,
} from "./ai-openrouter-poc.ts";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 512 * 1024;

export type OpenRouterChatResult =
  | {
      ok: true;
      reply: string;
      httpStatus: number;
      model: string;
      usage: ReturnType<typeof extractOpenRouterUsageUnits>;
    }
  | {
      ok: false;
      error: string;
      httpStatus: number;
      reply: string;
      providerStatus?: number;
    };

export async function callOpenRouterChat(opts: {
  apiKey: string;
  modelSlug: string;
  messages: { role: string; content: string }[];
  timeoutMs?: number;
  signal?: AbortSignal;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<OpenRouterChatResult> {
  const apiKey = String(opts.apiKey || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      error: OPENROUTER_ERROR_CODES.secret_missing,
      httpStatus: 503,
      reply: "",
    };
  }

  const endpoint = String(opts.endpoint || OPENROUTER_API_ENDPOINT).trim();
  if (endpoint !== OPENROUTER_API_ENDPOINT) {
    return {
      ok: false,
      error: OPENROUTER_ERROR_CODES.endpoint_injection,
      httpStatus: 400,
      reply: "",
    };
  }

  const modelSlug = String(opts.modelSlug || "").trim();
  if (!isAllowedOpenRouterSlug(modelSlug)) {
    return {
      ok: false,
      error: OPENROUTER_ERROR_CODES.slug_injection,
      httpStatus: 400,
      reply: "",
    };
  }

  const timeoutMs = Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelSlug,
        messages: opts.messages || [],
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: controller.signal,
      redirect: "error",
    });

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        error: OPENROUTER_ERROR_CODES.invalid_content_type,
        httpStatus: 502,
        reply: "",
      };
    }

    const rawText = await res.text();
    if (rawText.length > MAX_RESPONSE_BYTES) {
      return {
        ok: false,
        error: OPENROUTER_ERROR_CODES.oversized_response,
        httpStatus: 502,
        reply: "",
      };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: OPENROUTER_ERROR_CODES.malformed_json,
        httpStatus: 502,
        reply: "",
      };
    }

    if (!res.ok) {
      const classified = classifyOpenRouterHttpStatus(res.status);
      return {
        ok: false,
        error: classified.publicCode,
        httpStatus: classified.http,
        reply: "",
        providerStatus: res.status,
      };
    }

    const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
    const reply = String(choices?.[0]?.message?.content || "").trim();
    if (!reply) {
      return {
        ok: false,
        error: "openrouter_empty_reply",
        httpStatus: 502,
        reply: "",
      };
    }

    const usage = extractOpenRouterUsageUnits(data?.usage);
    return {
      ok: true,
      reply: reply.slice(0, 8000),
      httpStatus: 200,
      model: String(data?.model || modelSlug).slice(0, 128),
      usage,
    };
  } catch (err) {
    const name = String((err as { name?: string })?.name || "");
    const msg = String((err as { message?: string })?.message || "").toLowerCase();
    if (name === "AbortError" || msg.includes("abort")) {
      return {
        ok: false,
        error: OPENROUTER_ERROR_CODES.abort,
        httpStatus: 408,
        reply: "",
      };
    }
    if (msg.includes("timeout")) {
      return {
        ok: false,
        error: OPENROUTER_ERROR_CODES.timeout,
        httpStatus: 408,
        reply: "",
      };
    }
    return {
      ok: false,
      error: "openrouter_network_error",
      httpStatus: 502,
      reply: "",
    };
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", onOuterAbort);
  }
}
