import { jsonResponse } from "./cors.ts";
import {
  checkWorkspaceQuota,
  consumeWorkspaceQuota,
  quotaExceededResponse,
  resolveWorkspaceUserId,
  WORKSPACE_FEATURE_TEXT,
  WORKSPACE_SURFACE,
  type WorkspaceQuotaBody,
} from "./ai-workspace-quota.ts";

export const AI_MEDIA_GEN_KILL_SWITCH_ENV = "AI_MEDIA_GEN_EDGE_ENABLED";
export const AI_MEDIA_REQUEST_TIMEOUT_MS = 85_000;

export type MediaKind = "video" | "music";

export type MediaGenerateBody = WorkspaceQuotaBody & {
  kind?: MediaKind;
  prompt?: string;
  size?: string;
  durationSec?: number;
  quality?: string;
  style?: string;
  genre?: string;
  bpm?: number;
  mood?: string;
  lengthSec?: number;
  vocal?: boolean;
  lyrics?: boolean;
};

export function isMediaGenEdgeEnabled(envValue: string | undefined | null): boolean {
  return String(envValue ?? "").trim() === "1";
}

export function mediaGenDisabledFailure() {
  return {
    status: 503 as const,
    body: { ok: false, error: "media_gen_disabled", message: "動画・音楽生成 Edge が無効です" },
  };
}

function trimText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function buildVideoPrompt(body: MediaGenerateBody): string {
  const prompt = trimText(body.prompt, 4000);
  const size = trimText(body.size, 32) || "1280x720";
  const durationSec = Math.min(120, Math.max(1, Number(body.durationSec) || 8));
  const quality = trimText(body.quality, 32) || "standard";
  const style = trimText(body.style, 64) || "cinematic";
  return [
    "あなたはプロの動画制作プランナーです。",
    "以下の条件で、実際の動画制作に使える詳細な制作プランを日本語 Markdown で出力してください。",
    "見出し・シーン構成・カメラワーク・BGM/SE 方針・尺配分を含めてください。",
    "架空の完成動画 URL は出力しないでください。",
    "",
    `- プロンプト: ${prompt}`,
    `- サイズ: ${size}`,
    `- 時間: ${durationSec}秒`,
    `- 品質: ${quality}`,
    `- スタイル: ${style}`,
  ].join("\n");
}

function buildMusicPrompt(body: MediaGenerateBody): string {
  const prompt = trimText(body.prompt, 4000);
  const genre = trimText(body.genre, 64) || "ambient";
  const bpm = Math.min(240, Math.max(40, Number(body.bpm) || 90));
  const mood = trimText(body.mood, 64) || "calm";
  const lengthSec = Math.min(600, Math.max(5, Number(body.lengthSec) || 30));
  const vocal = Boolean(body.vocal);
  const lyrics = Boolean(body.lyrics);
  return [
    "あなたはプロの音楽制作ディレクターです。",
    "以下の条件で、実際の楽曲制作に使える詳細な制作プランを日本語 Markdown で出力してください。",
    "構成・BPM・コード進行案・楽器編成・ミックス方針を含めてください。",
    vocal && lyrics ? "歌詞案も含めてください。" : vocal ? "ボーカルメロ案を含めてください。" : "インスト曲として設計してください。",
    "架空の音声ファイル URL は出力しないでください。",
    "",
    `- ジャンル: ${genre}`,
    `- BPM: ${bpm}`,
    `- 雰囲気: ${mood}`,
    `- 長さ: ${lengthSec}秒`,
    prompt ? `- 補足: ${prompt}` : "",
  ].filter(Boolean).join("\n");
}

async function callGeminiBrief(userPrompt: string): Promise<{ ok: true; markdown: string } | { ok: false; error: string; status: number }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    return { ok: false, error: "gemini_not_configured", status: 503 };
  }

  const model = Deno.env.get("AI_MEDIA_GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_MEDIA_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 4096 },
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message || data?.error || res.status);
      const status = res.status === 429 ? 429 : res.status >= 500 ? 503 : 502;
      return { ok: false, error: msg.slice(0, 240), status };
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const markdown = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => String(p?.text || "")).join("").trim()
      : "";
    if (!markdown) {
      return { ok: false, error: "empty_model_response", status: 502 };
    }
    return { ok: true, markdown };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "request_timeout" : String(err instanceof Error ? err.message : err).slice(0, 240),
      status: aborted ? 504 : 503,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleWorkspaceMediaGenerate(
  req: Request,
  kind: MediaKind,
  body: MediaGenerateBody,
): Promise<Response> {
  const surface = String(body?.surface || "").trim();
  if (surface && surface !== WORKSPACE_SURFACE) {
    return jsonResponse({ ok: false, error: "unsupported_surface" }, 400, req);
  }

  const userId = resolveWorkspaceUserId(body);
  if (!userId || userId === "anonymous") {
    return jsonResponse({ ok: false, error: "missing_user_id" }, 400, req);
  }

  const prompt = trimText(body.prompt, 4000);
  if (kind === "video" && !prompt) {
    return jsonResponse({ ok: false, error: "empty_prompt", message: "プロンプトを入力してください。" }, 400, req);
  }

  try {
    const check = await checkWorkspaceQuota({ userId, feature: WORKSPACE_FEATURE_TEXT });
    if (!check.allowed) {
      return quotaExceededResponse(check, req);
    }
  } catch (err) {
    console.error("[ai-workspace-media-generate] quota check failed:", err);
    return jsonResponse({ ok: false, error: "quota_check_failed" }, 500, req);
  }

  const userPrompt = kind === "video" ? buildVideoPrompt(body) : buildMusicPrompt(body);
  const gemini = await callGeminiBrief(userPrompt);
  if (!gemini.ok) {
    const http = gemini.status;
    return jsonResponse(
      {
        ok: false,
        error: gemini.error,
        message: http === 504 ? "生成がタイムアウトしました。時間をおいて再試行してください。" : "生成 API エラー",
      },
      http,
      req,
    );
  }

  try {
    const consumed = await consumeWorkspaceQuota({ userId, feature: WORKSPACE_FEATURE_TEXT });
    if (!consumed.ok) {
      return quotaExceededResponse(consumed, req);
    }
  } catch (err) {
    console.error("[ai-workspace-media-generate] quota consume failed:", err);
  }

  const id = `${kind}-${crypto.randomUUID()}`;
  const title = kind === "video" ? "動画制作プラン" : "音楽制作プラン";
  const message = kind === "video"
    ? "動画制作プランを生成しました（Gemini · quota 消費済）"
    : "音楽制作プランを生成しました（Gemini · quota 消費済）";

  return jsonResponse(
    {
      ok: true,
      mock: false,
      mode: "gemini_brief",
      id,
      message,
      previewUrl: "",
      markdown: gemini.markdown.startsWith("#")
        ? gemini.markdown
        : `# ${title}\n\n${gemini.markdown}`,
      params: {
        kind,
        prompt: prompt || undefined,
        size: body.size,
        durationSec: body.durationSec,
        quality: body.quality,
        style: body.style,
        genre: body.genre,
        bpm: body.bpm,
        mood: body.mood,
        lengthSec: body.lengthSec,
        vocal: body.vocal,
        lyrics: body.lyrics,
      },
      quota: { feature: WORKSPACE_FEATURE_TEXT, userId },
    },
    200,
    req,
  );
}
