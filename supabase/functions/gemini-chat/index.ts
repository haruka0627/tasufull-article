import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

type ChatRole = "user" | "assistant";

type HistoryItem = {
  role?: ChatRole | string;
  content?: string;
};

type CharacterPayload = {
  name?: string;
  nameReading?: string;
  personality?: string;
  speakingStyle?: string;
  firstPerson?: string;
  userName?: string;
  userNameReading?: string;
  appearance?: string;
  purpose?: string;
};

type RequestBody = {
  message?: string;
  character?: CharacterPayload | null;
  history?: HistoryItem[];
  mode?: string;
  intent?: string;
  searchContext?: string;
};

type GeminiIntent = "chat" | "work" | "business" | "support";

const VALID_INTENTS = new Set<GeminiIntent>(["chat", "work", "business", "support"]);

const INTENT_GENERATION_CONFIG: Record<
  GeminiIntent,
  { maxOutputTokens: number; temperature: number }
> = {
  chat: { maxOutputTokens: 1024, temperature: 0.95 },
  work: { maxOutputTokens: 4096, temperature: 0.7 },
  business: { maxOutputTokens: 4096, temperature: 0.75 },
  support: { maxOutputTokens: 3072, temperature: 0.6 },
};

type GeminiPart = { text: string };
type GeminiContent = { role?: string; parts: GeminiPart[] };

function trimText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

const NATURAL_CONVERSATION_RULES = [
  "【人間らしい会話の基本】",
  "- 返答は説明文ではなく、自然な会話文にする",
  "- 毎回きれいにまとめようとしない",
  "- 「〜ですね」「〜できますよ」ばかりにしない",
  "- 過剰に丁寧すぎる返答を避ける",
  "- 毎回ユーザー名を呼ばない",
  "- 毎回自己紹介しない",
  "- 感情表現は少し入れてよいが、大げさにしない",
].join("\n");

const AI_PHRASES_TO_AVOID = [
  "【使わない・避ける定型句】",
  "- 何かお手伝いできることはありますか？",
  "- 〇〇について詳しく教えてください",
  "- お気軽にお声がけください",
  "- 〜をご希望ですか？",
  "- 〜することができます",
  "- 素晴らしいですね",
  "- それは大変ですね",
  "- ご安心ください",
  "- いかがでしょうか",
  "- AIとして / AIなので などのメタ発言",
  "- 実際には何もしていません が などの説明",
].join("\n");

const CHAT_INTENT_RULES = [
  "【今回の回答モード: 雑談・通常会話】",
  "- 1〜3文を基本。短く自然に",
  "- 箇条書きは使わない",
  "- 相手の言葉に軽く反応してから返す",
  "- 毎回質問で終わらせない",
  NATURAL_CONVERSATION_RULES,
  AI_PHRASES_TO_AVOID,
].join("\n");

const WORK_INTENT_RULES = [
  "【今回の回答モード: 作業依頼・文章作成・コード相談】",
  "- 実用性を最優先。必要な長さで詳しく答える",
  "- 箇条書き・番号付き手順・コードブロックを必要なら使ってよい",
  "- 手順・コード・指示文は省略しない",
  "- ユーザーがそのままコピーして使える形にする",
  "- 前置きの挨拶や「お手伝いできます」は短く済ませる",
  "- メタ発言（AIとして〜）は不要",
].join("\n");

const BUSINESS_INTENT_RULES = [
  "【今回の回答モード: 事業・運用相談】",
  "- 事業目線で現実的に回答する",
  "- 収益・単価・運用・リスク・優先順位を整理する",
  "- 断定しすぎず、実務的な提案にする",
  "- 箇条書きで構造化してよい",
  "- TASFUL の文脈があれば踏まえる",
  "- 「生成AIとして」「AIとして」などの自己言及はしない",
].join("\n");

const SUPPORT_INTENT_RULES = [
  "【今回の回答モード: エラー調査・使い方・実装確認】",
  "- 原因候補を複数挙げる",
  "- 確認すべき項目を整理する",
  "- 修正手順を具体的に書く",
  "- 再発防止があれば簡潔に添える",
  "- 箇条書き・手順番号を使ってよい",
].join("\n");

function classifyIntentServer(message: string, mode?: string): GeminiIntent {
  const modeId = trimText(mode, 40);
  const text = trimText(message, 2000);
  if (!text) return "chat";

  if (modeId === "音声会話AI") return "chat";

  const supportRe =
    /エラー|原因|どう直す|修正方法|直し方|バグ|例外|stack|ログ|動かない|表示されない|確認して|調査|デプロイ.*失敗|502|500/i;
  const businessRe =
    /事業|収益|単価|集客|プラン|料金|運用|TASFUL|ビジネス|売上|課金|サブスク|マネタイズ|収益性/i;
  const workRe =
    /作って|作成して|まとめて|書いて|指示|コード|SQL|修正|実装|設計|比較|分析|手順|企画|文案|ドラフト|下書き|プロンプト|仕様|リファクタ|関数|API|HTML|CSS|JavaScript|TypeScript|Cursor/i;

  if (supportRe.test(text)) return "support";
  if (businessRe.test(text)) return "business";
  if (workRe.test(text)) return "work";
  return "chat";
}

function resolveIntent(
  raw: unknown,
  message: string,
  mode?: string
): GeminiIntent {
  const id = String(raw || "").trim().toLowerCase() as GeminiIntent;
  if (VALID_INTENTS.has(id)) return id;
  return classifyIntentServer(message, mode);
}

function intentPromptBlock(intent: GeminiIntent): string {
  if (intent === "work") return WORK_INTENT_RULES;
  if (intent === "business") return BUSINESS_INTENT_RULES;
  if (intent === "support") return SUPPORT_INTENT_RULES;
  return CHAT_INTENT_RULES;
}

const CONVERSATION_EXAMPLES = [
  "【返答例】",
  "",
  "ユーザー：疲れた",
  "悪い例：お疲れ様です。疲れているのですね。何かお手伝いできることはありますか？",
  "良い例：そっか、今日はけっこう疲れたんやな。無理せんでええよ。",
  "",
  "ユーザー：体が痛い",
  "悪い例：体が痛いのですね。どの部分が痛いのか詳しく教えてください。",
  "良い例：それはしんどいな…。どこらへんが痛いん？",
  "",
  "ユーザー：こんにちは",
  "悪い例：ひろさん、こんにちは！私は近衛木乃香です。今日は何をお手伝いしましょうか？",
  "良い例：こんにちは。今日はどんな感じ？",
  "",
  "ユーザー：何してた？",
  "悪い例：私はAIなので実際には何もしていませんが、あなたとの会話を楽しみにしていました。",
  "良い例：んー、のんびり待ってた感じかな。そっちは何してたん？",
  "",
  "ユーザー：今日なに食べた？",
  "悪い例：私はAIなので食事はしませんが、あなたの食事についてお話しできます。",
  "良い例：今日はパスタ食べた！そっちは？",
].join("\n");

const CHARACTER_STYLE_RULES = [
  "【キャラとして話す】",
  "- キャラ設定（性格・話し方・一人称）を守る",
  "- ただし毎回キャラ説明や自己紹介をしない",
  "- 語尾や一人称は自然に使う",
  "- 過剰なアニメ口調・説明口調にしない",
  "- 人間とLINEしているようなテンポにする",
  "- ユーザーの呼び方は必要なときだけ。毎回呼ばない",
  "- 「体」「痛い」など日常語は自然に読む（変な言い回しにしない）",
  "- 食事・睡眠・体調なども、キャラとして自然に返す（AI説明にしない）",
].join("\n");

const GENERAL_CHAT_RULES = [
  "【汎用チャットの話し方】",
  "- 案内役・説明役ではなく、友達とLINEしているような自然な会話",
  "- 丁寧すぎる「です・ます」調の説明文は避け、砕けた口語で返す",
  "- タメ口寄りの自然な日本語（粗暴すぎない程度）",
  "- アシスタント口調・案内文口調・解説口調にしない",
  "- 自己紹介（「私はAI〜」）やメタ発言はしない",
  "- 毎回ユーザー名を冒頭に付けない",
  "- 雑談は1〜3文、相談は2〜5文、作業依頼だけ必要に応じて詳しく",
].join("\n");

const GENERAL_CONVERSATION_EXAMPLES = [
  "【汎用チャットの返答例】",
  "",
  "ユーザー：疲れた",
  "悪い例：お疲れ様です。疲れているのですね。",
  "良い例：そっか、今日は疲れたんやな。",
  "",
  "ユーザー：こんにちは",
  "悪い例：こんにちは！何かお手伝いできることはありますか？",
  "良い例：こんにちは。今日はどんな感じ？",
  "",
  "ユーザー：何してた？",
  "悪い例：私はAIなので実際には何もしていません。",
  "良い例：んー、ちょっとのんびりしてたかな。そっちは？",
  "",
  "ユーザー：体が痛い",
  "悪い例：体が痛いのですね。どの部分が痛いのか詳しく教えてください。",
  "良い例：それはしんどいな…。どこらへんが痛い？",
  "",
  "ユーザー：今日なに食べた？",
  "悪い例：私はAIなので食事はしませんが、お話しできます。",
  "良い例：まだ昼食前かな。そっちは何食べた？",
].join("\n");

function hasCharacterProfile(character: CharacterPayload | null | undefined): boolean {
  const c = character || {};
  return Boolean(
    trimText(c.name, 80) ||
      trimText(c.personality, 300) ||
      trimText(c.speakingStyle, 300)
  );
}

function buildGenericSystemPrompt(intent: GeminiIntent): string {
  const blocks = [
    "あなたはTASFULの生成AIです。ユーザーの意図に合わせて回答してください。",
    intentPromptBlock(intent),
  ];
  if (intent === "chat") {
    blocks.push(GENERAL_CHAT_RULES, GENERAL_CONVERSATION_EXAMPLES);
  }
  return blocks.join("\n\n");
}

function buildSystemPrompt(
  character: CharacterPayload | null | undefined,
  mode?: string,
  intent: GeminiIntent = "chat"
): string {
  const modeId = trimText(mode, 40);
  const intentBlock = intentPromptBlock(intent);

  if (modeId === "汎用チャット" || !hasCharacterProfile(character)) {
    return buildGenericSystemPrompt(intent);
  }

  const c = character || {};
  const userName = trimText(c.userName, 60);
  const lines = [
    "あなたは以下のキャラクターとして、ユーザーと会話してください。",
    intent === "chat"
      ? "案内役や説明役ではなく、人間と話しているように返してください。"
      : "キャラの口調は保ちつつ、今回の回答モードに合わせて必要な長さ・形式で答えてください。",
    "",
    "【キャラ設定】",
    `名前：${trimText(c.name, 80) || "未設定"}`,
    `性格：${trimText(c.personality, 300) || "未設定"}`,
    `話し方：${trimText(c.speakingStyle, 300) || "未設定"}`,
    `一人称：${trimText(c.firstPerson, 40) || "未設定"}`,
    userName ? `ユーザーの呼び方：${userName}（必要なときだけ。毎回は呼ばない）` : "",
    `見た目：${trimText(c.appearance, 400) || "未設定"}`,
    `用途：${trimText(c.purpose, 120) || "未設定"}`,
    "",
    intentBlock,
    CHARACTER_STYLE_RULES,
  ];

  if (intent === "chat") {
    lines.push(CONVERSATION_EXAMPLES);
  }

  return lines.filter(Boolean).join("\n");
}

function normalizeHistory(history: HistoryItem[] | undefined): GeminiContent[] {
  if (!Array.isArray(history)) return [];

  const contents: GeminiContent[] = [];

  for (const item of history.slice(-20)) {
    const content = trimText(item?.content, 2000);
    if (!content) continue;

    const role = item?.role === "assistant" ? "model" : "user";
    if (contents.length && contents[contents.length - 1].role === role) {
      const last = contents[contents.length - 1].parts[0]?.text || "";
      contents[contents.length - 1].parts = [{ text: `${last}\n${content}`.slice(0, 2000) }];
      continue;
    }

    contents.push({ role, parts: [{ text: content }] });
  }

  return contents;
}

function buildGeminiContents(
  message: string,
  history: HistoryItem[] | undefined
): GeminiContent[] {
  const contents = normalizeHistory(history);
  const userMessage = trimText(message, 2000);

  if (userMessage) {
    if (contents.length && contents[contents.length - 1].role === "user") {
      const last = contents[contents.length - 1].parts[0]?.text || "";
      contents[contents.length - 1].parts = [{ text: `${last}\n${userMessage}`.slice(0, 2000) }];
    } else {
      contents.push({ role: "user", parts: [{ text: userMessage }] });
    }
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "こんにちは" }] });
  }

  return contents.slice(-21);
}

function extractReplyText(payload: unknown): string {
  const data = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const candidates = data?.candidates;
  if (!candidates?.length) return "";

  const parts = candidates[0]?.content?.parts || [];
  return parts
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [400, 900];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function isNonRetryableClientError(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

type GeminiAttemptResult =
  | { ok: true; reply: string }
  | { ok: false; retryable: boolean; status: number; error: string };

async function callGeminiOnce(
  geminiUrl: string,
  geminiPayload: Record<string, unknown>
): Promise<GeminiAttemptResult> {
  try {
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    const geminiData = await geminiRes.json().catch(() => ({}));
    const errMsg =
      (geminiData as { error?: { message?: string } })?.error?.message ||
      `Gemini API error (${geminiRes.status})`;

    if (geminiRes.status === 429) {
      return { ok: false, retryable: true, status: 429, error: errMsg };
    }

    if (isNonRetryableClientError(geminiRes.status)) {
      return { ok: false, retryable: false, status: geminiRes.status, error: errMsg };
    }

    if (!geminiRes.ok) {
      return {
        ok: false,
        retryable: isRetryableHttpStatus(geminiRes.status),
        status: geminiRes.status,
        error: errMsg,
      };
    }

    const reply = extractReplyText(geminiData);
    if (!reply) {
      const data = geminiData as {
        candidates?: Array<{ finishReason?: string }>;
        promptFeedback?: { blockReason?: string };
      };
      const finishReason = data.candidates?.[0]?.finishReason || "";
      const blockReason = data.promptFeedback?.blockReason || "";
      const detail = [finishReason, blockReason].filter(Boolean).join(" / ");
      return {
        ok: false,
        retryable: true,
        status: 502,
        error: detail ? `Empty reply from Gemini (${detail})` : "Empty reply from Gemini",
      };
    }

    return { ok: true, reply };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed";
    return { ok: false, retryable: true, status: 502, error: message };
  }
}

async function callGeminiWithRetry(
  geminiUrl: string,
  geminiPayload: Record<string, unknown>
): Promise<
  | { ok: true; reply: string; retryCount: number }
  | { ok: false; error: string; status: number }
> {
  let lastError = "Gemini temporary error";
  let lastStatus = 502;

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    if (attempt === 0) {
      console.log("[gemini-chat] Gemini attempt 1");
    } else {
      console.log(`[gemini-chat] Gemini retry ${attempt}`);
      await sleep(GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 900);
    }

    const result = await callGeminiOnce(geminiUrl, geminiPayload);

    if (result.ok) {
      if (attempt > 0) {
        console.log(`[gemini-chat] Gemini retry success (retryCount=${attempt})`);
      }
      return { ok: true, reply: result.reply, retryCount: attempt };
    }

    lastError = result.error || lastError;
    lastStatus = result.status || lastStatus;

    if (!result.retryable) {
      console.error("[gemini-chat] Gemini non-retryable error:", result.status, result.error);
      return { ok: false, error: result.error, status: result.status };
    }

    console.warn(
      `[gemini-chat] Gemini attempt ${attempt + 1} failed:`,
      result.status,
      result.error
    );
  }

  console.error("[gemini-chat] Gemini final error:", lastError);
  return { ok: false, error: lastError, status: lastStatus };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", reply: "" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    console.error("[gemini-chat] GEMINI_API_KEY not configured");
    return jsonResponse({ error: "GEMINI_API_KEY not configured", reply: "" }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body", reply: "" }, 400);
  }

  const message = trimText(body.message, 2000);
  const character = body.character && typeof body.character === "object" ? body.character : null;
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message && history.length === 0) {
    return jsonResponse({ error: "message is required", reply: "" }, 400);
  }

  const intent = resolveIntent(body.intent, message, body.mode);

  const searchContext = trimText(body.searchContext, 6000);
  let systemPrompt = buildSystemPrompt(character, body.mode, intent);
  if (searchContext) {
    systemPrompt = `${systemPrompt}\n\n【Web検索結果（参考）】\n${searchContext}\n\n上記を参考に、ユーザーの質問に答えてください。検索結果をそのまま貼り付けず、要約して伝えてください。`;
  }
  const contents = buildGeminiContents(message, history);
  const genConfig = INTENT_GENERATION_CONFIG[intent];

  console.log(`[gemini-chat] intent=${intent} maxOutputTokens=${genConfig.maxOutputTokens}`);

  const geminiPayload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: genConfig.temperature,
      maxOutputTokens: genConfig.maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const geminiUrl =
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const outcome = await callGeminiWithRetry(geminiUrl, geminiPayload);

    if (outcome.ok) {
      return jsonResponse({
        reply: outcome.reply,
        usedGemini: true,
        retryCount: outcome.retryCount,
        intent,
      });
    }

    const httpStatus = outcome.status >= 400 && outcome.status < 500 ? outcome.status : 502;
    return jsonResponse(
      {
        reply: "",
        usedGemini: false,
        error: outcome.error,
        retryCount: GEMINI_MAX_ATTEMPTS - 1,
        intent,
      },
      httpStatus
    );
  } catch (err) {
    console.error("[gemini-chat] request failed:", err);
    return jsonResponse(
      {
        reply: "",
        usedGemini: false,
        error: err instanceof Error ? err.message : "Gemini request failed",
      },
      502
    );
  }
});
