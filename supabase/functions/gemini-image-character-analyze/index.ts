import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const APPEARANCE_PROMPT = [
  "この画像をAIキャラクター設定用に説明してください。",
  "人物またはキャラクターの外見だけを、自然な日本語で短くまとめてください。",
  "",
  "含める内容：髪型、髪色、表情、服装、雰囲気、年齢感は曖昧に、会話に使える特徴。",
  "",
  "禁止：実在人物の断定、個人名の推測、年齢の断定、性的・過激な表現、長文、箇条書き。",
  "2〜4文、400文字以内。",
  "プレーンテキストのみ返してください。",
].join("\n");

const SEED_JSON_PROMPT = [
  "この画像を参考に、AIキャラクターとして使いやすい初期設定案を作成してください。",
  "",
  "ルール：",
  "- 実在人物名を推測しない。画像の人物を本人だと断定しない",
  "- 名前は創作キャラ名として提案する",
  "- 年齢を断定しない",
  "- 露骨・性的な表現は禁止",
  "- キャラ設定は自然で会話に使いやすく",
  "- nameReading / userNameReading はひらがな",
  "- 各項目は短文",
  "",
  "次のJSON形式のみで返してください（説明文やマークダウンは禁止）：",
  "{",
  '  "appearance": "見た目メモ（2〜4文、400文字以内）",',
  '  "seed": {',
  '    "name": "創作キャラ名",',
  '    "nameReading": "ひらがな",',
  '    "personality": "性格",',
  '    "speakingStyle": "話し方",',
  '    "firstPerson": "一人称",',
  '    "userName": "ユーザーの呼び方",',
  '    "userNameReading": "よみ",',
  '    "purpose": "用途"',
  "  },",
  '  "composition": "face_closeup | bust_up | full_body",',
  '  "mouthHint": { "x": 50, "y": 72, "scale": 0.85, "confidence": 0.7 }',
  "}",
].join("\n");

const MOUTH_HINT_JSON_PROMPT = [
  "この画像でキャラクター口パク用の構図と口位置を推定してください。",
  "実在人物の断定は禁止。",
  "",
  "composition は次のいずれか1つ：",
  "- face_closeup … 顔〜肩上のアップ（口 y は 70〜74、scale 0.75〜0.9）",
  "- bust_up … バストアップ（口 y は 63〜68、scale 0.8〜1.0）",
  "- full_body … 全身が写る（口 y は 45〜55）",
  "",
  "次のJSONのみ返してください：",
  "{",
  '  "composition": "face_closeup",',
  '  "mouthHint": { "x": 50, "y": 72, "scale": 0.85, "confidence": 0.75 }',
  "}",
].join("\n");

export type CharacterSeed = {
  name: string;
  nameReading: string;
  personality: string;
  speakingStyle: string;
  firstPerson: string;
  userName: string;
  userNameReading: string;
  purpose: string;
};

const MAX_APPEARANCE_LEN = 400;
const MAX_DATA_URL_CHARS = 7_500_000;
const MAX_FETCH_BYTES = 8 * 1024 * 1024;
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [400, 900];

type AnalyzeMode =
  | "appearance_only"
  | "appearance_and_character_seed"
  | "mouth_hint_only";

export type MouthComposition = "face_closeup" | "bust_up" | "full_body" | "unknown";

export type MouthHint = {
  x: number;
  y: number;
  scale: number;
  confidence: number;
};

function parseComposition(value: unknown): MouthComposition {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "face_closeup" || v.includes("face") || v.includes("closeup")) {
    return "face_closeup";
  }
  if (v === "bust_up" || v.includes("bust")) return "bust_up";
  if (v === "full_body" || v.includes("full")) return "full_body";
  return "unknown";
}

type RequestBody = {
  imageData?: string;
  imageUrl?: string;
  purpose?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveAnalyzeMode(purpose: string): AnalyzeMode {
  const p = String(purpose || "").trim().toLowerCase();
  if (p === "mouth_hint_only" || p.includes("mouth_hint")) {
    return "mouth_hint_only";
  }
  if (
    p === "appearance_and_character_seed" ||
    p.includes("appearance_and_character_seed")
  ) {
    return "appearance_and_character_seed";
  }
  return "appearance_only";
}

function clampMouthNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseMouthHint(raw: unknown): MouthHint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = clampMouthNum(o.x ?? o.mouthX, 0, 100, NaN);
  const y = clampMouthNum(o.y ?? o.mouthY, 0, 100, NaN);
  const scale = clampMouthNum(o.scale ?? o.mouthScale, 0.3, 2, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    scale: Number(scale.toFixed(2)),
    confidence: clampMouthNum(o.confidence, 0, 1, 0.6),
  };
}

function trimAppearance(text: string): string {
  let out = String(text || "")
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/^\s*[-*•・]\s*/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (out.length > MAX_APPEARANCE_LEN) {
    out = out.slice(0, MAX_APPEARANCE_LEN).trim();
  }
  return out;
}

function trimShort(text: unknown, max: number): string {
  return String(text ?? "").trim().slice(0, max);
}

function parseSeedPayload(raw: unknown): CharacterSeed | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seed = {
    name: trimShort(o.name ?? o.characterName, 40),
    nameReading: trimShort(o.nameReading ?? o.name_reading, 60),
    personality: trimShort(o.personality, 300),
    speakingStyle: trimShort(o.speakingStyle ?? o.speaking_style, 300),
    firstPerson: trimShort(o.firstPerson ?? o.first_person, 20),
    userName: trimShort(o.userName ?? o.user_name, 30),
    userNameReading: trimShort(o.userNameReading ?? o.user_name_reading, 60),
    purpose: trimShort(o.purpose, 120),
  };
  const hasCore = Boolean(
    seed.name || seed.personality || seed.speakingStyle || seed.purpose
  );
  if (!hasCore) return null;
  if (!seed.firstPerson) seed.firstPerson = "私";
  if (!seed.userName) seed.userName = "あなた";
  if (!seed.userNameReading) seed.userNameReading = "あなた";
  if (!seed.purpose) seed.purpose = "日常会話・相談相手";
  return seed;
}

function parseSeedResponse(reply: string): {
  appearance: string;
  seed: CharacterSeed | null;
  mouthHint: MouthHint | null;
  composition: MouthComposition;
} {
  const parsed = extractJsonObject(reply) as Record<string, unknown> | null;
  if (!parsed) {
    return {
      appearance: trimAppearance(reply),
      seed: null,
      mouthHint: null,
      composition: "unknown",
    };
  }

  const appearance = trimAppearance(String(parsed.appearance || ""));
  const seedRaw =
    parsed.seed && typeof parsed.seed === "object"
      ? parsed.seed
      : parsed.name || parsed.personality
        ? parsed
        : null;
  const seed = parseSeedPayload(seedRaw);
  const composition = parseComposition(parsed.composition);
  const mouthHint = parseMouthHint(parsed.mouthHint);

  return { appearance, seed, mouthHint, composition };
}

function extractJsonObject(text: string): unknown {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* ignore */
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

function parseDataUrl(
  imageData: string
): { mimeType: string; data: string } | { error: string } {
  const raw = String(imageData || "").trim();
  if (!raw.startsWith("data:")) {
    return { error: "imageData は data URL 形式である必要があります" };
  }
  if (raw.length > MAX_DATA_URL_CHARS) {
    return { error: "画像サイズが大きすぎます。別の画像をお試しください。" };
  }
  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!match) {
    return { error: "画像データの形式が不正です" };
  }
  const mimeType = match[1].toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return { error: "jpg / png / webp の画像のみ対応しています" };
  }
  const data = match[2].replace(/\s/g, "");
  if (!data) return { error: "画像データが空です" };
  const approxBytes = Math.ceil((data.length * 3) / 4);
  if (approxBytes > MAX_FETCH_BYTES) {
    return { error: "画像サイズが大きすぎます。別の画像をお試しください。" };
  }
  return { mimeType, data };
}

async function fetchImageAsInline(
  imageUrl: string
): Promise<{ mimeType: string; data: string } | { error: string }> {
  const url = String(imageUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { error: "imageUrl は https の URL である必要があります" };
  }
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return { error: `画像の取得に失敗しました (${res.status})` };
    }
    const contentType = (res.headers.get("content-type") || "image/jpeg")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      return { error: "jpg / png / webp の画像のみ対応しています" };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) {
      return { error: "画像サイズが大きすぎます。別の画像をお試しください。" };
    }
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mimeType: contentType, data: btoa(binary) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message || "画像の取得に失敗しました" };
  }
}

function extractReplyText(data: unknown): string {
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates;
  if (!candidates?.length) return "";
  const parts = candidates[0]?.content?.parts || [];
  return parts.map((p) => String(p.text || "")).join("").trim();
}

type AttemptResult =
  | {
      ok: true;
      appearance?: string;
      seed?: CharacterSeed | null;
      mouthHint?: MouthHint | null;
      composition?: MouthComposition;
    }
  | { ok: false; retryable: boolean; status: number; error: string };

async function callGeminiVisionOnce(
  apiKey: string,
  inline: { mimeType: string; data: string },
  mode: AnalyzeMode
): Promise<AttemptResult> {
  const isSeed = mode === "appearance_and_character_seed";
  const isMouth = mode === "mouth_hint_only";
  const userText = isMouth
    ? MOUTH_HINT_JSON_PROMPT
    : isSeed
      ? SEED_JSON_PROMPT
      : APPEARANCE_PROMPT;

  const geminiUrl =
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [
          { text: userText },
          { inline_data: { mime_type: inline.mimeType, data: inline.data } },
        ],
      },
    ],
    generationConfig: isSeed || isMouth
      ? {
          temperature: 0.35,
          maxOutputTokens: isMouth ? 256 : 1536,
          responseMimeType: "application/json",
        }
      : {
          temperature: 0.35,
          maxOutputTokens: 512,
        },
  };

  try {
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const errMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `Gemini API error (${res.status})`;

    if (res.status === 429 || res.status >= 500) {
      return { ok: false, retryable: true, status: res.status, error: errMsg };
    }
    if (!res.ok) {
      return { ok: false, retryable: false, status: res.status, error: errMsg };
    }

    const reply = extractReplyText(data);
    if (!reply) {
      return { ok: false, retryable: true, status: 502, error: "Empty reply from Gemini" };
    }

    if (isMouth) {
      const parsed = extractJsonObject(reply) as Record<string, unknown> | null;
      const composition = parseComposition(parsed?.composition);
      const mouthHint = parseMouthHint(parsed?.mouthHint ?? parsed);
      if (!mouthHint && composition === "unknown") {
        return { ok: false, retryable: true, status: 502, error: "Invalid mouthHint JSON from Gemini" };
      }
      return { ok: true, mouthHint: mouthHint ?? undefined, composition };
    }

    if (isSeed) {
      const { appearance, seed, mouthHint, composition } = parseSeedResponse(reply);
      if (!appearance) {
        return { ok: false, retryable: true, status: 502, error: "Empty appearance in seed response" };
      }
      if (!seed) {
        return { ok: false, retryable: true, status: 502, error: "Invalid seed JSON from Gemini" };
      }
      return { ok: true, appearance, seed, mouthHint, composition };
    }

    const appearance = trimAppearance(reply);
    if (!appearance) {
      return { ok: false, retryable: true, status: 502, error: "Empty appearance from Gemini" };
    }
    return { ok: true, appearance };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed";
    return { ok: false, retryable: true, status: 502, error: message };
  }
}

async function callGeminiVisionWithRetry(
  apiKey: string,
  inline: { mimeType: string; data: string },
  mode: AnalyzeMode
): Promise<AttemptResult> {
  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 900);
    }
    const result = await callGeminiVisionOnce(apiKey, inline, mode);
    if (result.ok) return result;
    if (!result.retryable) return result;
  }
  return { ok: false, retryable: false, status: 502, error: "Gemini temporary error" };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    return jsonResponse({ ok: false, error: "GEMINI_API_KEY not configured" }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const imageData = String(body.imageData || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();
  const purposeRaw = String(body.purpose || "appearance_only").trim();
  const mode = resolveAnalyzeMode(purposeRaw);

  if (!imageData && !imageUrl) {
    return jsonResponse({ ok: false, error: "imageData または imageUrl が必要です" }, 400);
  }

  let inline: { mimeType: string; data: string };
  if (imageData) {
    const parsed = parseDataUrl(imageData);
    if ("error" in parsed) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }
    inline = parsed;
  } else {
    const fetched = await fetchImageAsInline(imageUrl);
    if ("error" in fetched) {
      return jsonResponse({ ok: false, error: fetched.error }, 400);
    }
    inline = fetched;
  }

  const outcome = await callGeminiVisionWithRetry(apiKey, inline, mode);
  if (!outcome.ok) {
    const status = outcome.status >= 400 && outcome.status < 500 ? outcome.status : 502;
    return jsonResponse(
      { ok: false, error: outcome.error, appearance: "", seed: null },
      status
    );
  }

  if (mode === "mouth_hint_only") {
    return jsonResponse({
      ok: true,
      mouthHint: outcome.mouthHint ?? null,
      composition: outcome.composition ?? "unknown",
      usedGemini: true,
    });
  }

  if (mode === "appearance_and_character_seed") {
    return jsonResponse({
      ok: true,
      appearance: outcome.appearance,
      seed: outcome.seed ?? null,
      mouthHint: outcome.mouthHint ?? null,
      composition: outcome.composition ?? "unknown",
      usedGemini: true,
    });
  }

  return jsonResponse({
    ok: true,
    appearance: outcome.appearance,
    usedGemini: true,
  });
});
