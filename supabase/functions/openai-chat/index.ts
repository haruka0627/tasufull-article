import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { appendSearchContextToSystemPrompt, trimAiText } from "../_shared/ai-search-context.ts";
import {
  buildOpenAiUserContent,
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
  return { messages, attachments };
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

  const { messages, attachments } = buildMessages(body);
  if (messages.length <= 1 && !trimAiText(body.message, 2000) && !attachments.length) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const quotaEntry = await enforceWorkspaceQuotaEntry(req, body);
  if (quotaEntry.blocked) return quotaEntry.blocked;

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
      return jsonResponse(
        {
          reply: "",
          usedOpenAi: false,
          error: data?.error?.message || `openai_${res.status}`,
        },
        res.ok ? 502 : res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }
    await finalizeWorkspaceQuotaConsume(body);
    return jsonResponse({ reply, usedOpenAi: true, model: OPENAI_MODEL });
  } catch (err) {
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
