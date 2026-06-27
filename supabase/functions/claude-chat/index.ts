import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { appendSearchContextToSystemPrompt, trimAiText } from "../_shared/ai-search-context.ts";
import {
  buildClaudeUserContent,
  mergeMessageWithAttachments,
  normalizeAttachments,
} from "../_shared/ai-attachments.ts";
import {
  enforceWorkspaceQuotaEntry,
  finalizeWorkspaceQuotaConsume,
} from "../_shared/ai-workspace-quota.ts";

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
  return { messages, attachments };
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

  const { messages, attachments } = buildMessages(body);
  if (!messages.length && !trimAiText(body.message, 2000) && !attachments.length) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const quotaEntry = await enforceWorkspaceQuotaEntry(req, body);
  if (quotaEntry.blocked) return quotaEntry.blocked;

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
    const block = Array.isArray(data?.content) ? data.content.find((b: { type?: string }) => b.type === "text") : null;
    const reply = trimAiText(block?.text, 8000);
    if (!res.ok || !reply) {
      return jsonResponse(
        {
          reply: "",
          usedClaude: false,
          error: data?.error?.message || `anthropic_${res.status}`,
        },
        res.ok ? 502 : res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }
    await finalizeWorkspaceQuotaConsume(body);
    return jsonResponse({ reply, usedClaude: true, model: CLAUDE_MODEL });
  } catch (err) {
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
