/**
 * POST /api/page-gen-draft
 *
 * Platform AI page draft generation.
 * 1) JWT verify
 * 2) Re-check paid GenAI entitlement (server SSOT)
 * 3) Generate JSON draft (Gemini) — no HTML
 * 4) Never invent prices / contacts / external CTAs
 *
 * Authorization: Bearer <Supabase access_token>
 * Does not modify ai-model-gateway.js (AD-005).
 */
import {
  handleOptions,
  jsonResponse,
  resolvePageGenEntitlement,
} from "../_shared/page-gen-entitlement.mjs";

const MAX_FACTS_CHARS = 6000;
const GEMINI_MODEL = "gemini-2.5-flash";

function sanitizeFacts(facts) {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return {};
  const out = {};
  Object.keys(facts).slice(0, 40).forEach((key) => {
    const k = String(key).slice(0, 60);
    const v = facts[key];
    if (typeof v === "string") out[k] = v.slice(0, 800);
    else if (Array.isArray(v)) out[k] = v.map((x) => String(x).slice(0, 120)).slice(0, 20);
    else if (v != null) out[k] = String(v).slice(0, 400);
  });
  return out;
}

function buildPrompt(body) {
  const facts = sanitizeFacts(body?.facts);
  const listingType = String(body?.listing_type || "").slice(0, 40);
  const outcome = String(body?.outcome || "").slice(0, 40);
  const instruction = String(body?.instruction || "").slice(0, 500);
  const reviewIssues = Array.isArray(body?.review_issues)
    ? body.review_issues.slice(0, 12).map((x) => String(x?.message || x).slice(0, 200))
    : [];
  const allowedLinks = Array.isArray(body?.allowed_internal_targets)
    ? body.allowed_internal_targets.slice(0, 20).map((x) => ({
        target_ref: String(x?.target_ref || "").slice(0, 160),
        label: String(x?.label || "").slice(0, 80),
        kind: String(x?.kind || "").slice(0, 40),
      }))
    : [];

  return {
    system: [
      "あなたは TASFUL Platform 掲載ページの文章を JSON で作成するアシスタントです。",
      "HTML・Markdown・コードブロックは禁止。JSON オブジェクトのみ。",
      "電話・メール・外部URL・LINE・PayPal・銀行振込・外部決済への誘導は禁止。",
      "断定・最上級表現（絶対・日本一・最安値・100%）は禁止。",
      "料金・実績・資格は事実に書かれた内容だけを使い、創作しない。",
      "CTA は conversion_intent のみ指定し、外部申込手段は書かない。",
      "internal_links は allowed_internal_targets の target_ref だけを使う。",
    ].join("\n"),
    user: JSON.stringify(
      {
        listing_type: listingType,
        preferred_outcome: outcome,
        facts,
        allowed_internal_targets: allowedLinks,
        instruction: instruction || null,
        review_issues: reviewIssues.length ? reviewIssues : null,
        required_json_keys: [
          "hero_title",
          "hero_lead",
          "about_heading",
          "about_body",
          "faq",
          "cta_label",
          "conversion_intent",
          "image_plan",
          "internal_links",
          "seo_title",
          "meta_description",
        ],
      },
      null,
      2,
    ).slice(0, MAX_FACTS_CHARS),
  };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callGeminiDraft(env, prompt) {
  const apiKey = String(env?.GEMINI_API_KEY || "").trim();
  if (!apiKey) return { ok: false, error: "generation_unavailable" };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt.system}\n\n${prompt.user}` }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) return { ok: false, error: "generation_failed" };
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const draft = extractJsonObject(text);
  if (!draft || typeof draft !== "object") return { ok: false, error: "generation_parse_failed" };
  return { ok: true, draft, model: GEMINI_MODEL };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const access = await resolvePageGenEntitlement(request, env, body);
  if (!access.ok) {
    return jsonResponse(
      {
        ok: false,
        error: access.error,
        entitlement: access.entitlement || null,
        stage: "entitlement",
      },
      access.http || 403,
    );
  }

  const prompt = buildPrompt(body);
  let generated;
  try {
    generated = await callGeminiDraft(env, prompt);
  } catch {
    generated = { ok: false, error: "generation_failed" };
  }

  if (!generated.ok) {
    return jsonResponse(
      {
        ok: false,
        error: generated.error,
        entitlement: access.entitlement,
        stage: "generation",
      },
      generated.error === "generation_unavailable" ? 503 : 502,
    );
  }

  return jsonResponse({
    ok: true,
    entitlement: access.entitlement,
    draft: generated.draft,
    model: generated.model,
    review_pass: Number(body?.review_pass) === 1 ? 1 : 0,
  });
}
