import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { appendSearchContextToSystemPrompt, trimAiText } from "../_shared/ai-search-context.ts";
import {
  buildOpenAiUserContent,
  mergeMessageWithAttachments,
  normalizeAttachments,
} from "../_shared/ai-attachments.ts";
import {
  enforceGuardChatEntry,
  finalizeGuardChatConsume,
  normalizeGuardFeature,
} from "../_shared/ai-usage-guard.ts";
import {
  USAGE_STATUS_DENIED,
  USAGE_STATUS_ERROR,
  USAGE_STATUS_SUCCESS,
  createUsageLogOnce,
  newUsageRequestId,
  resolveUsageActor,
  sanitizeRoutingMetadata,
} from "../_shared/ai-usage-log.ts";

type HistoryItem = { role?: string; content?: string };

type RequestBody = {
  message?: string;
  history?: HistoryItem[];
  mode?: string;
  searchContext?: string;
  systemPrompt?: string;
  attachments?: unknown;
  surface?: string;
  user_id?: string;
  userId?: string;
  routing?: unknown;
};

const OPENAI_MODEL = Deno.env.get("OPENAI_CHAT_MODEL")?.trim() || "gpt-4o-mini";

function buildMessages(body: RequestBody) {
  const attachments = normalizeAttachments(body.attachments);
  const system = appendSearchContextToSystemPrompt(
    trimAiText(
      body.systemPrompt ||
        "あなたはTASFULのAIアシスタントです。日本語で簡潔に、正確に答えてください。",
      8000
    ),
    trimAiText(body.searchContext, 6000)
  );
  const messages: { role: string; content: string | ReturnType<typeof buildOpenAiUserContent> }[] = [
    { role: "system", content: system },
  ];
  const history = Array.isArray(body.history) ? body.history : [];
  history.forEach((item) => {
    const content = trimAiText(item?.content, 4000);
    if (!content) return;
    const role = item?.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content });
  });
  const message = mergeMessageWithAttachments(trimAiText(body.message, 2000), attachments);
  const userContent = buildOpenAiUserContent(message, attachments);
  if (userContent) messages.push({ role: "user", content: userContent });
  return { messages, attachments, message };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse({ error: "OPENAI_API_KEY not configured", reply: "", usedOpenAi: false }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", reply: "" }, 400);
  }

  const { messages, attachments, message } = buildMessages(body);
  if (messages.length <= 1 && !trimAiText(body.message, 2000) && !attachments.length) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const requestId = newUsageRequestId();
  const usageOnce = createUsageLogOnce();
  const actor = await resolveUsageActor({ req, bodyUserId: body.user_id ?? body.userId });
  const usageFeature = normalizeGuardFeature(undefined, body);
  const routingMeta = sanitizeRoutingMetadata(body.routing);
  const inputUnits = message.length > 0 ? message.length : null;

  const quotaEntry = await enforceGuardChatEntry(req, body, "openai-chat");
  if (quotaEntry.blocked) {
    let denyCode = "quota_denied";
    try {
      const payload = await quotaEntry.blocked.clone().json();
      denyCode = String(payload?.error || denyCode).slice(0, 128);
    } catch {
      /* ignore */
    }
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openai",
      model: OPENAI_MODEL,
      status: USAGE_STATUS_DENIED,
      estimatedCost: null,
      errorCode: denyCode,
      metadata: {
        source: "openai-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: quotaEntry.blocked.status,
        ...routingMeta,
      },
    });
    return quotaEntry.blocked;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const reply = trimAiText(data?.choices?.[0]?.message?.content, 8000);
    if (!res.ok || !reply) {
      const httpStatus = res.ok ? 502 : res.status >= 400 && res.status < 500 ? res.status : 502;
      await usageOnce.record({
        requestId,
        userId: actor.userId,
        anonymousId: actor.anonymousId,
        feature: usageFeature,
        provider: "openai",
        model: OPENAI_MODEL,
        status: USAGE_STATUS_ERROR,
        inputUnits,
        estimatedCost: null,
        errorCode: String(data?.error?.message || `openai_${res.status}`).slice(0, 128),
        metadata: {
          source: "openai-chat",
          surface: String(body.surface || "").trim().slice(0, 64) || undefined,
          http_status: httpStatus,
          ...routingMeta,
        },
      });
      return jsonResponse(
        {
          reply: "",
          usedOpenAi: false,
          error: data?.error?.message || `openai_${res.status}`,
        },
        httpStatus
      );
    }
    await finalizeGuardChatConsume(req, body);
    const outputUnits = reply.length > 0 ? reply.length : null;
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openai",
      model: OPENAI_MODEL,
      status: USAGE_STATUS_SUCCESS,
      inputUnits,
      outputUnits,
      totalUnits:
        inputUnits != null || outputUnits != null
          ? (inputUnits || 0) + (outputUnits || 0)
          : null,
      estimatedCost: null,
      metadata: {
        source: "openai-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: 200,
        ...routingMeta,
      },
    });
    return jsonResponse({ reply, usedOpenAi: true, model: OPENAI_MODEL });
  } catch (err) {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "openai",
      model: OPENAI_MODEL,
      status: USAGE_STATUS_ERROR,
      inputUnits,
      estimatedCost: null,
      errorCode: "provider_exception",
      metadata: {
        source: "openai-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: 502,
        ...routingMeta,
      },
    });
    return jsonResponse(
      {
        reply: "",
        usedOpenAi: false,
        error: err instanceof Error ? err.message : "OpenAI request failed",
      },
      502
    );
  }
});
