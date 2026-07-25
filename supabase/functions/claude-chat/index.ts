import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { appendSearchContextToSystemPrompt, trimAiText } from "../_shared/ai-search-context.ts";
import {
  buildClaudeUserContent,
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

const CLAUDE_MODEL = Deno.env.get("ANTHROPIC_CHAT_MODEL")?.trim() || "claude-haiku-4-5";

function buildMessages(body: RequestBody) {
  const attachments = normalizeAttachments(body.attachments);
  const history = Array.isArray(body.history) ? body.history : [];
  const messages: { role: string; content: string | ReturnType<typeof buildClaudeUserContent> }[] = [];
  history.forEach((item) => {
    const content = trimAiText(item?.content, 4000);
    if (!content) return;
    const role = item?.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content });
  });
  const message = mergeMessageWithAttachments(trimAiText(body.message, 2000), attachments);
  const userContent = buildClaudeUserContent(message, attachments);
  if (userContent) messages.push({ role: "user", content: userContent });
  return { messages, attachments, message };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "" }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not configured", reply: "", usedClaude: false }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", reply: "" }, 400);
  }

  const { messages, attachments, message } = buildMessages(body);
  if (!messages.length && !trimAiText(body.message, 2000) && !attachments.length) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const requestId = newUsageRequestId();
  const usageOnce = createUsageLogOnce();
  const actor = await resolveUsageActor({ req, bodyUserId: body.user_id ?? body.userId });
  const usageFeature = normalizeGuardFeature(undefined, body);
  const routingMeta = sanitizeRoutingMetadata(body.routing);
  const inputUnits = message.length > 0 ? message.length : null;

  const quotaEntry = await enforceGuardChatEntry(req, body);
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
      provider: "claude",
      model: CLAUDE_MODEL,
      status: USAGE_STATUS_DENIED,
      estimatedCost: null,
      errorCode: denyCode,
      metadata: {
        source: "claude-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: quotaEntry.blocked.status,
        ...routingMeta,
      },
    });
    return quotaEntry.blocked;
  }

  const system = appendSearchContextToSystemPrompt(
    trimAiText(
      body.systemPrompt ||
        "あなたはTASFULのAIアシスタントです。日本語で簡潔に、正確に答えてください。",
      8000
    ),
    trimAiText(body.searchContext, 6000)
  );

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system,
        messages,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const block = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string }) => b.type === "text")
      : null;
    const reply = trimAiText(block?.text, 8000);
    if (!res.ok || !reply) {
      const httpStatus = res.ok ? 502 : res.status >= 400 && res.status < 500 ? res.status : 502;
      await usageOnce.record({
        requestId,
        userId: actor.userId,
        anonymousId: actor.anonymousId,
        feature: usageFeature,
        provider: "claude",
        model: CLAUDE_MODEL,
        status: USAGE_STATUS_ERROR,
        inputUnits,
        estimatedCost: null,
        errorCode: String(data?.error?.message || `anthropic_${res.status}`).slice(0, 128),
        metadata: {
          source: "claude-chat",
          surface: String(body.surface || "").trim().slice(0, 64) || undefined,
          http_status: httpStatus,
          ...routingMeta,
        },
      });
      return jsonResponse(
        {
          reply: "",
          usedClaude: false,
          error: data?.error?.message || `anthropic_${res.status}`,
        },
        httpStatus
      );
    }
    await finalizeGuardChatConsume(body);
    const outputUnits = reply.length > 0 ? reply.length : null;
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "claude",
      model: CLAUDE_MODEL,
      status: USAGE_STATUS_SUCCESS,
      inputUnits,
      outputUnits,
      totalUnits:
        inputUnits != null || outputUnits != null
          ? (inputUnits || 0) + (outputUnits || 0)
          : null,
      estimatedCost: null,
      metadata: {
        source: "claude-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: 200,
        ...routingMeta,
      },
    });
    return jsonResponse({ reply, usedClaude: true, model: CLAUDE_MODEL });
  } catch (err) {
    await usageOnce.record({
      requestId,
      userId: actor.userId,
      anonymousId: actor.anonymousId,
      feature: usageFeature,
      provider: "claude",
      model: CLAUDE_MODEL,
      status: USAGE_STATUS_ERROR,
      inputUnits,
      estimatedCost: null,
      errorCode: "provider_exception",
      metadata: {
        source: "claude-chat",
        surface: String(body.surface || "").trim().slice(0, 64) || undefined,
        http_status: 502,
        ...routingMeta,
      },
    });
    return jsonResponse(
      {
        reply: "",
        usedClaude: false,
        error: err instanceof Error ? err.message : "Claude request failed",
      },
      502
    );
  }
});
