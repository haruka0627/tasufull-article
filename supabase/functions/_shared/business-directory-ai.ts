/**
 * Business Directory — AI listing draft generation (Phase 1b)
 * Read-only · no save · no status change · Gemini or server mock fallback
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  appendAuditLog,
  BusinessDirectoryError,
  type BusinessDirectoryAuth,
} from "./business-directory.ts";
import { resolveEffectivePlanCode } from "./business-directory-plans.ts";
import { consumeAiDraftQuota, type AiDraftQuotaStatus } from "./business-directory-ai-quota.ts";

const GEMINI_MODEL = Deno.env.get("BD_AI_DRAFT_GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 45_000;

const DISCLAIMER =
  "AI下書きです。内容を確認のうえ、保存してください。虚偽・誇大表現がないか必ずご確認ください。";

export type ListingDraftFaq = { q: string; a: string };

export type ListingDraftPayload = {
  short_description: string;
  full_description: string;
  seo_title: string;
  meta_description: string;
  faq: ListingDraftFaq[];
  recommended_uses: string[];
};

export type GenerateListingDraftInput = {
  listing_id?: string | null;
  listing_type?: string;
  display_name?: string;
  category_id?: string | null;
  prefecture?: string;
  city?: string;
  service_areas?: string | string[] | null;
  shop_sales_genre?: string | null;
  service_summary?: string | null;
  price_range_text?: string | null;
  website_url?: string | null;
};

type NormalizedDraftContext = {
  listing_type: "shop_retail" | "business_service";
  display_name: string;
  category_name: string;
  prefecture: string;
  city: string;
  service_areas: string;
  shop_sales_genre: string;
  service_summary: string;
  price_range_text: string;
  website_url: string;
};

function trimText(value: unknown, maxLen: number): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function normalizeListingType(value: unknown): "shop_retail" | "business_service" {
  const t = trimText(value, 40);
  if (t === "business_service") return "business_service";
  return "shop_retail";
}

function normalizeServiceAreas(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => trimText(v, 80)).filter(Boolean).join("、").slice(0, 400);
  }
  return trimText(value, 400);
}

function areaLabel(ctx: NormalizedDraftContext): string {
  const parts = [ctx.prefecture, ctx.city].filter(Boolean);
  if (ctx.service_areas) parts.push(`対応: ${ctx.service_areas}`);
  return parts.join(" · ") || "地域未設定";
}

export function buildMockListingDraft(ctx: NormalizedDraftContext): ListingDraftPayload {
  const name = ctx.display_name;
  const area = areaLabel(ctx);
  const category = ctx.category_name ||
    (ctx.listing_type === "shop_retail" ? "店舗・販売" : "業務サービス");
  const isShop = ctx.listing_type === "shop_retail";
  const detail = isShop
    ? ctx.shop_sales_genre || category
    : [ctx.service_summary, ctx.price_range_text].filter(Boolean).join(" · ") || category;

  const shortDescription = isShop
    ? `${name}は${ctx.prefecture}${ctx.city}を中心に、${detail}を取り扱う${category}です。地域のお客様に寄り添った品揃えと丁寧な対応が特徴です。`
    : `${name}は${area}で${detail}を提供する${category}です。ご相談から施工・対応まで、わかりやすい説明と安心のサポートを心がけています。`;

  const seoTitle = `${name} | ${category} — ${ctx.prefecture}${ctx.city}`;
  const metaDescription = shortDescription.slice(0, 120);

  const faq: ListingDraftFaq[] = isShop
    ? [
        {
          q: "取り扱い商品は何ですか？",
          a: `${detail}を中心に、地域のニーズに合わせた品揃えをしています。詳細はお問い合わせください。`,
        },
        {
          q: "営業エリアはどこですか？",
          a: `${ctx.service_areas || area}を中心に対応しています。`,
        },
        {
          q: "初めて利用する場合の流れは？",
          a: "お電話または来店でご相談ください。ご希望に合わせてご案内します。",
        },
      ]
    : [
        {
          q: "対応エリアはどこですか？",
          a: `${ctx.service_areas || area}を中心に対応可能です。`,
        },
        {
          q: "料金の目安を教えてください",
          a: ctx.price_range_text
            ? `目安は${ctx.price_range_text}です。現地確認後にお見積りします。`
            : "内容により異なります。まずは無料相談をご利用ください。",
        },
        {
          q: "見積もりは無料ですか？",
          a: "基本のご相談・お見積りは無料です。詳細条件はお問い合わせください。",
        },
      ];

  const recommendedUses = isShop
    ? [
        "地元の食材・日用品を探している方",
        "近くの店舗で気軽に買い物したい方",
        `${ctx.prefecture || "近隣"}在住の方へのおすすめ`,
      ]
    : [
        "リフォーム・修繕を検討中の方",
        `${detail}の依頼先を探している方`,
        "複数業者の比較前に概要を知りたい方",
      ];

  return {
    short_description: shortDescription.slice(0, 400),
    full_description: `${shortDescription}\n\n${name}の詳細情報です。内容を確認のうえ、必要に応じて編集してください。`.slice(
      0,
      8000,
    ),
    seo_title: seoTitle.slice(0, 60),
    meta_description: metaDescription.slice(0, 160),
    faq: faq.slice(0, 5),
    recommended_uses: recommendedUses.slice(0, 5),
  };
}

export function validateGenerateListingDraftInput(
  body: GenerateListingDraftInput,
): NormalizedDraftContext {
  const listingType = normalizeListingType(body.listing_type);
  const displayName = trimText(body.display_name, 120);
  const prefecture = trimText(body.prefecture, 40);
  const city = trimText(body.city, 80);
  const categoryId = trimText(body.category_id, 80);
  const shopGenre = trimText(body.shop_sales_genre, 200);
  const serviceSummary = trimText(body.service_summary, 400);

  if (!displayName) {
    throw new BusinessDirectoryError("validation_error", "display_name required", 400);
  }
  if (!prefecture || !city) {
    throw new BusinessDirectoryError(
      "validation_error",
      "prefecture and city required",
      400,
    );
  }
  if (!categoryId && !shopGenre && !serviceSummary) {
    throw new BusinessDirectoryError(
      "validation_error",
      "category_id or shop_sales_genre or service_summary required",
      400,
    );
  }

  return {
    listing_type: listingType,
    display_name: displayName,
    category_name: "",
    prefecture,
    city,
    service_areas: normalizeServiceAreas(body.service_areas),
    shop_sales_genre: shopGenre,
    service_summary: serviceSummary,
    price_range_text: trimText(body.price_range_text, 120),
    website_url: trimText(body.website_url, 500),
  };
}

async function resolveCategoryName(
  supabase: SupabaseClient,
  categoryId: string,
): Promise<string> {
  if (!categoryId) return "";
  const { data, error } = await supabase
    .from("business_directory_categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) {
    console.warn("[business-directory-ai] category lookup failed:", error.message);
    return "";
  }
  return trimText(data?.name, 120);
}

async function resolvePlanCodeForRequest(
  supabase: SupabaseClient,
  auth: BusinessDirectoryAuth,
  listingId: string | null,
): Promise<string> {
  if (!listingId) return "free";
  const { data, error } = await supabase
    .from("business_directory_listings")
    .select("plan_code, owner_user_id")
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) {
    throw new BusinessDirectoryError("not_found", "Listing not found", 404);
  }
  if (String(data.owner_user_id) !== auth.userId) {
    throw new BusinessDirectoryError("forbidden", "Not listing owner", 403);
  }
  return resolveEffectivePlanCode(data as Record<string, unknown>);
}

function buildGeminiUserPrompt(ctx: NormalizedDraftContext): string {
  const lines = [
    "以下の掲載情報をもとに、Business Directory 掲載ページ用の下書き文案を JSON で生成してください。",
    "",
    `- 掲載種別: ${ctx.listing_type === "shop_retail" ? "店舗・販売" : "業務サービス"}`,
    `- 掲載名: ${ctx.display_name}`,
    `- カテゴリ: ${ctx.category_name || "（未指定）"}`,
    `- 所在地: ${ctx.prefecture}${ctx.city}`,
    `- 対応地域: ${ctx.service_areas || "（未指定）"}`,
  ];
  if (ctx.shop_sales_genre) lines.push(`- 販売ジャンル: ${ctx.shop_sales_genre}`);
  if (ctx.service_summary) lines.push(`- サービス内容: ${ctx.service_summary}`);
  if (ctx.price_range_text) lines.push(`- 料金目安: ${ctx.price_range_text}`);
  if (ctx.website_url) lines.push(`- 公式サイト: ${ctx.website_url}`);
  lines.push(
    "",
    "制約:",
    "- 虚偽・誇大・他社批判・資格の断定は禁止",
    "- short_description は 400 字以内",
    "- full_description は 800〜2000 字程度（最大 8000 字）",
    "- seo_title は 60 字以内",
    "- meta_description は 160 字以内",
    "- faq は 3 件",
    "- recommended_uses は 3 件",
    "- すべて下書きトーン（確定表現を避ける）",
  );
  return lines.join("\n");
}

const SYSTEM_PROMPT =
  "あなたは TASFUL Business Directory の掲載文案アシスタントです。" +
  "店舗・業務サービスの掲載用下書きのみを作成します。" +
  "出力は必ず JSON のみ（Markdown や説明文は禁止）。" +
  "契約・料金の確定、資格の断定、虚偽・誇大表現は禁止。" +
  "すべてユーザー確認前提の下書きです。";

function extractGeminiText(payload: unknown): string {
  const data = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => String(p?.text || "").trim()).filter(Boolean).join("\n").trim();
}

function parseJsonBlock(raw: string): unknown {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeFaq(raw: unknown): ListingDraftFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        q: trimText(row.q ?? row.question, 200),
        a: trimText(row.a ?? row.answer, 600),
      };
    })
    .filter((item) => item.q && item.a);
}

export function parseListingDraftJson(raw: unknown): ListingDraftPayload | null {
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return null;
  const shortDescription = trimText(obj.short_description, 400);
  if (!shortDescription) return null;
  const faq = normalizeFaq(obj.faq);
  const uses = Array.isArray(obj.recommended_uses)
    ? obj.recommended_uses.map((u) => trimText(u, 120)).filter(Boolean).slice(0, 5)
    : [];
  return {
    short_description: shortDescription,
    full_description: trimText(obj.full_description, 8000) || shortDescription,
    seo_title: trimText(obj.seo_title, 60),
    meta_description: trimText(obj.meta_description, 160),
    faq: faq.length ? faq : [{ q: "詳細はお問い合わせください", a: "掲載者へ直接ご連絡ください。" }],
    recommended_uses: uses.length ? uses : ["地域のお客様", "初めて利用する方"],
  };
}

async function callGeminiListingDraft(
  ctx: NormalizedDraftContext,
): Promise<{ ok: true; draft: ListingDraftPayload } | { ok: false; error: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    return { ok: false, error: "gemini_not_configured" };
  }

  const url =
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const userPrompt = buildGeminiUserPrompt(ctx);

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          short_description: { type: "STRING" },
          full_description: { type: "STRING" },
          seo_title: { type: "STRING" },
          meta_description: { type: "STRING" },
          faq: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                q: { type: "STRING" },
                a: { type: "STRING" },
              },
              required: ["q", "a"],
            },
          },
          recommended_uses: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "short_description",
          "full_description",
          "seo_title",
          "meta_description",
          "faq",
          "recommended_uses",
        ],
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String((data as { error?: { message?: string } })?.error?.message || res.status);
      return { ok: false, error: msg.slice(0, 240) };
    }
    const text = extractGeminiText(data);
    const parsed = parseListingDraftJson(parseJsonBlock(text));
    if (!parsed) {
      return { ok: false, error: "invalid_json_response" };
    }
    return { ok: true, draft: parsed };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, error: aborted ? "request_timeout" : String(err).slice(0, 240) };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateListingDraft(
  supabase: SupabaseClient,
  auth: BusinessDirectoryAuth,
  body: GenerateListingDraftInput,
): Promise<{
  draft: ListingDraftPayload;
  meta: {
    used_remote: boolean;
    mock: boolean;
    model: string;
    provider: string;
    disclaimer: string;
    quota: AiDraftQuotaStatus;
  };
}> {
  const listingId = trimText(body.listing_id, 80) || null;
  const planCode = await resolvePlanCodeForRequest(supabase, auth, listingId);
  const quota = await consumeAiDraftQuota(supabase, auth.userId, planCode);

  const ctx = validateGenerateListingDraftInput(body);
  if (trimText(body.category_id, 80)) {
    ctx.category_name = await resolveCategoryName(supabase, trimText(body.category_id, 80));
  }

  let draft: ListingDraftPayload;
  let usedRemote = false;
  let mock = false;

  const remote = await callGeminiListingDraft(ctx);
  if (remote.ok) {
    draft = remote.draft;
    usedRemote = true;
  } else {
    console.warn("[business-directory-ai] gemini fallback:", remote.error);
    draft = buildMockListingDraft(ctx);
    mock = true;
  }

  if (listingId) {
    try {
      await appendAuditLog(supabase, {
        listingId,
        actorUserId: auth.userId,
        actorRole: "owner",
        action: "listing.ai_draft_generated",
        metadata: { mock, used_remote: usedRemote, provider: "gemini" },
      });
    } catch (err) {
      console.warn("[business-directory-ai] audit log skipped:", err);
    }
  }

  return {
    draft,
    meta: {
      used_remote: usedRemote,
      mock,
      model: usedRemote ? GEMINI_MODEL : "mock",
      provider: usedRemote ? "gemini" : "mock",
      disclaimer: DISCLAIMER,
      quota,
    },
  };
}
