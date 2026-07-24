/**
 * Gemini TTS プロキシ（Cloudflare Pages Function）
 * Secret: GEMINI_API_KEY · クライアントへキーは渡さない
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_TEXT_LENGTH = 5000;

/**
 * PCM base64 → WAV base64 変換（16bit mono PCM → WAV ヘッダー付与）
 */
function pcmToWavBase64(pcmBase64, sampleRate) {
  const pcmBytes = Uint8Array.from(atob(pcmBase64), (c) => c.charCodeAt(0));
  const dataLen = pcmBytes.length;
  const headerLen = 44;
  const wav = new Uint8Array(headerLen + dataLen);
  const view = new DataView(wav.buffer);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(view, 8, "WAVE");

  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);        // chunk size
  view.setUint16(20, 1, true);         // PCM format
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample

  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataLen, true);
  wav.set(pcmBytes, 44);

  // base64 encode
  let binary = "";
  for (let i = 0; i < wav.length; i++) {
    binary += String.fromCharCode(wav[i]);
  }
  return btoa(binary);
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = String(env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = String(body?.text || "").trim();
  if (!text) {
    return jsonResponse({ error: "text is required" }, 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` }, 400);
  }

  const voice = String(body?.voice || "Puck").trim();

  // Gemini TTS 用のプロンプト：読み上げのみを指示
  const prompt = `以下のテキストを自然な日本語で読み上げてください。読み上げ以外の応答は一切不要です。\n\n${text}`;

  const url = `${GEMINI_API_BASE}/${GEMINI_TTS_MODEL}:generateContent`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      }),
    });

    const data = await geminiRes.json().catch(() => ({}));

    if (!geminiRes.ok) {
      console.error(`[gemini-tts] Gemini API error ${geminiRes.status}:`, JSON.stringify(data).slice(0, 500));
      return jsonResponse(
        { error: `Gemini API error: ${geminiRes.status}`, detail: data },
        geminiRes.status,
      );
    }

    // 音声データを抽出
    let audioBase64 = "";
    let audioMimeType = "";
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("audio/") && part.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          audioMimeType = part.inlineData.mimeType || "";
          break;
        }
      }
    }

    if (!audioBase64) {
      console.error("[gemini-tts] No audio data in response:", JSON.stringify(data).slice(0, 500));
      return jsonResponse(
        { error: "No audio data in Gemini response", detail: data },
        502,
      );
    }

    // PCM → WAV 変換（ブラウザ再生用）
    const pcmMatch = audioMimeType.match(/rate=(\d+)/);
    const sampleRate = pcmMatch ? parseInt(pcmMatch[1], 10) : 24000;
    const wavBase64 = pcmToWavBase64(audioBase64, sampleRate);

    return jsonResponse({
      ok: true,
      audioBase64: wavBase64,
      mimeType: "audio/wav",
      voice,
      textLength: text.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gemini-tts] Unexpected error:", message);
    return jsonResponse({ error: message }, 500);
  }
}
