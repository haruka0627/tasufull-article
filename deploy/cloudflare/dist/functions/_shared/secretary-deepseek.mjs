/**
 * AI 運営秘書 — DeepSeek chat (OpenAI-compatible API)
 * Secret: DEEPSEEK_API_KEY (Cloudflare Pages / Workers · ローカル .env)
 * Optional: DEEPSEEK_CHAT_MODEL (official: deepseek-v4-flash | deepseek-v4-pro)
 */

export const DEEPSEEK_API_BASE = "https://api.deepseek.com";

/** @see https://api-docs.deepseek.com/quick_start/pricing */
export const DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash";

const DEPRECATED_DEEPSEEK_MODELS = new Set(["deepseek-chat", "deepseek-reasoner"]);

export function trimSecretaryText(value, maxLen) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLen);
}

export function resolveDeepSeekModel(env) {
  const configured = String(env?.DEEPSEEK_CHAT_MODEL || "").trim();
  const model = configured || DEFAULT_DEEPSEEK_CHAT_MODEL;
  if (DEPRECATED_DEEPSEEK_MODELS.has(model)) {
    return DEFAULT_DEEPSEEK_CHAT_MODEL;
  }
  return model;
}

export function buildSecretaryMessages(body) {
  const system = trimSecretaryText(
    body.systemPrompt ||
      "あなたは TASFUL の AI運営秘書です。日本語で簡潔に、正確に答えてください。",
    8000
  );
  const messages = [{ role: "system", content: system }];
  const history = Array.isArray(body.history) ? body.history : [];
  history.forEach((item) => {
    const content = trimSecretaryText(item?.content, 4000);
    if (!content) return;
    const role = item?.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content });
  });
  const message = trimSecretaryText(body.message, 2000);
  if (message) messages.push({ role: "user", content: message });
  return { messages, message };
}

export async function callDeepSeekChatCompletions(apiKey, messages, model) {
  try {
    const res = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const reply = trimSecretaryText(data?.choices?.[0]?.message?.content, 8000);
    if (!res.ok || !reply) {
      const errMsg =
        trimSecretaryText(data?.error?.message, 500) ||
        trimSecretaryText(data?.error?.code, 120) ||
        `deepseek_${res.status}`;
      return { ok: false, reply: "", error: errMsg, httpStatus: res.status };
    }
    return { ok: true, reply, error: "", httpStatus: res.status };
  } catch (err) {
    return {
      ok: false,
      reply: "",
      error: err instanceof Error ? err.message : "DeepSeek request failed",
      httpStatus: 502,
    };
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
