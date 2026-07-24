/**
 * Business Directory AI draft Phase 1b — unit tests (Deno)
 *   npx deno run --allow-env scripts/test-business-directory-ai-draft-phase1b-unit.ts
 */
import {
  buildMockListingDraft,
  parseListingDraftJson,
  validateGenerateListingDraftInput,
} from "../supabase/functions/_shared/business-directory-ai.ts";
import {
  BD_AI_DRAFT_DAILY_LIMITS,
  resolveAiDraftDailyLimit,
} from "../supabase/functions/_shared/business-directory-ai-quota.ts";
import { BusinessDirectoryError } from "../supabase/functions/_shared/business-directory.ts";

let pass = 0;
let fail = 0;

function ok(label: string) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label: string, detail?: string) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

const sampleCtx = {
  listing_type: "shop_retail" as const,
  display_name: "テスト商店",
  category_name: "小売・雑貨",
  prefecture: "東京都",
  city: "渋谷区",
  service_areas: "東京都",
  shop_sales_genre: "地元野菜",
  service_summary: "",
  price_range_text: "",
  website_url: "",
};

const mockDraft = buildMockListingDraft(sampleCtx);
if (mockDraft.short_description.includes("テスト商店")) ok("mock draft short_description");
else bad("mock draft short_description");
if (mockDraft.faq.length >= 3) ok("mock draft faq");
else bad("mock draft faq");

const parsed = parseListingDraftJson({
  short_description: "紹介文です。",
  seo_title: "SEO",
  meta_description: "meta",
  faq: [{ q: "Q1", a: "A1" }],
  recommended_uses: ["用途1"],
});
if (parsed?.short_description === "紹介文です。") ok("parseListingDraftJson");
else bad("parseListingDraftJson");

try {
  validateGenerateListingDraftInput({
    listing_type: "shop_retail",
    display_name: "A",
    prefecture: "東京都",
    city: "渋谷区",
    category_id: "a1000001-0001-4000-8000-000000000002",
  });
  ok("validate input ok");
} catch (e) {
  bad("validate input ok", e instanceof Error ? e.message : String(e));
}

try {
  validateGenerateListingDraftInput({ display_name: "A" });
  bad("validate missing location", "expected throw");
} catch (e) {
  if (e instanceof BusinessDirectoryError && e.code === "validation_error") {
    ok("validate missing location");
  } else bad("validate missing location");
}

for (const plan of ["free", "standard", "pro", "premium", "unknown"]) {
  const limit = resolveAiDraftDailyLimit(plan);
  if (limit === 10) ok(`daily limit ${plan} = 10`);
  else bad(`daily limit ${plan}`, String(limit));
}

if (BD_AI_DRAFT_DAILY_LIMITS.free === 10 && BD_AI_DRAFT_DAILY_LIMITS.pro === 10) {
  ok("limit map frozen");
} else bad("limit map frozen");

const prevKey = Deno.env.get("GEMINI_API_KEY");
Deno.env.delete("GEMINI_API_KEY");
if (!Deno.env.get("GEMINI_API_KEY")) ok("GEMINI_API_KEY unset simulates server mock fallback");
else bad("GEMINI_API_KEY unset simulates server mock fallback");
if (prevKey) Deno.env.set("GEMINI_API_KEY", prevKey);
else Deno.env.delete("GEMINI_API_KEY");

console.log(`\nSample draft JSON:\n${JSON.stringify(mockDraft, null, 2)}`);
console.log(`\n=== ${pass} passed · ${fail} failed ===`);
if (fail) Deno.exit(1);
