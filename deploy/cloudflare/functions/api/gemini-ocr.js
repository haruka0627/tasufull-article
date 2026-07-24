/**

 * Gemini OCR プロキシ（Cloudflare Pages Function）

 * Secret: GEMINI_API_KEY（クライアントへ渡さない）

 * SAFE-05: surface=ai-workspace 時は Usage Guard 経由

 */

import {

  enforceCfOcrGuard,

  finalizeCfOcrConsume,

} from "../_shared/ai-usage-guard.mjs";



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



const GEMINI_OCR_MODEL = "gemini-2.5-flash";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_BASE64_CHARS = 6 * 1024 * 1024;

const OCR_PROMPT =

  "Extract all visible text from this document or image. " +

  "Return plain text only. Do not summarize, translate, interpret, or add commentary. " +

  "If there is no text, return an empty string.";



function parseDataUrl(dataUrl) {

  const src = String(dataUrl || "");

  const m = src.match(/^data:([^;]+);base64,(.+)$/i);

  if (!m) return null;

  return { mimeType: m[1].trim(), base64: m[2].trim() };

}



export async function onRequest(context) {

  const { request, env } = context;



  if (request.method === "OPTIONS") return handleOptions();

  if (request.method !== "POST") {

    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  }



  const apiKey = String(env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {

    return jsonResponse({ ok: false, error: "GEMINI_API_KEY not configured", provider: "gemini" }, 503);

  }



  let body;

  try {

    body = await request.json();

  } catch {

    return jsonResponse({ ok: false, error: "invalid_json", provider: "gemini" }, 400);

  }



  const guard = await enforceCfOcrGuard(request, body, env);

  if (guard.blocked) return guard.blocked;



  let mimeType = String(body?.mimeType || body?.mime || "").trim();

  let base64 = String(body?.base64 || body?.imageBase64 || "").trim();



  if (!base64 && body?.dataUrl) {

    const parsed = parseDataUrl(body.dataUrl);

    if (!parsed) {

      return jsonResponse({ ok: false, error: "invalid_data_url", provider: "gemini" }, 400);

    }

    mimeType = parsed.mimeType;

    base64 = parsed.base64;

  }



  if (!base64) {

    return jsonResponse({ ok: false, error: "base64_required", provider: "gemini" }, 400);

  }

  if (base64.length > MAX_BASE64_CHARS) {

    return jsonResponse({ ok: false, error: "payload_too_large", provider: "gemini" }, 413);

  }



  const allowedMime = /^(image\/(jpeg|jpg|png|webp|gif|bmp)|application\/pdf)$/i;

  if (!allowedMime.test(mimeType || "image/jpeg")) {

    return jsonResponse({ ok: false, error: "unsupported_mime", provider: "gemini" }, 415);

  }



  const url = `${GEMINI_API_BASE}/${GEMINI_OCR_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;



  try {

    const geminiRes = await fetch(url, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        contents: [

          {

            parts: [

              { text: OCR_PROMPT },

              {

                inlineData: {

                  mimeType: mimeType || "image/jpeg",

                  data: base64,

                },

              },

            ],

          },

        ],

        generationConfig: {

          temperature: 0,

          maxOutputTokens: 4096,

        },

      }),

    });



    const geminiJson = await geminiRes.json().catch(() => ({}));

    if (!geminiRes.ok) {

      return jsonResponse(

        {

          ok: false,

          error: "gemini_upstream_error",

          provider: "gemini",

          status: geminiRes.status,

        },

        502,

      );

    }



    const parts = geminiJson?.candidates?.[0]?.content?.parts || [];

    const text = parts

      .map((p) => String(p?.text || ""))

      .join("\n")

      .trim();



    if (guard.shouldConsume && guard.meta) {

      await finalizeCfOcrConsume(guard.meta);

    }



    return jsonResponse({

      ok: true,

      text,

      provider: "gemini",

    });

  } catch {

    return jsonResponse({ ok: false, error: "ocr_request_failed", provider: "gemini" }, 502);

  }

}

