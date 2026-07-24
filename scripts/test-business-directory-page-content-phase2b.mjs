#!/usr/bin/env node
/**
 * Business Directory page content Phase 2b — public detail static checks
 *   node scripts/test-business-directory-page-content-phase2b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = "business-directory/public";
let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function mustInclude(hay, needle, label) {
  if (hay.includes(needle)) ok(label);
  else bad(label, `missing: ${needle}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("=== Business Directory page content Phase 2b ===\n");

const detailHtml = read(`${PUBLIC}/detail.html`);
const listHtml = read(`${PUBLIC}/list.html`);
const pubJs = read(`${PUBLIC}/business-directory-public.js`);
const rendererJs = read("business-directory/business-directory-page-renderer.js");
const pubCss = read(`${PUBLIC}/business-directory-public.css`);
const migration = read("supabase/migrations/20260717120000_business_directory_page_content_phase2a.sql");

mustInclude(detailHtml, 'meta name="description"', "detail meta description tag");
mustInclude(detailHtml, "business-directory-plan.js", "detail loads plan.js");
mustInclude(detailHtml, "business-directory-page-renderer.js", "detail loads shared renderer");
mustInclude(detailHtml, "chat-supabase-config.js", "detail loads supabase config");
mustInclude(listHtml, "chat-supabase-config.js", "list loads supabase config");
mustInclude(listHtml, "../../business-directory-repository.js", "list loads repository");
if (
  listHtml.indexOf("chat-supabase-config.js") >= 0 &&
  listHtml.indexOf("chat-supabase-config.js") < listHtml.indexOf("business-directory-repository.js")
) {
  ok("list config before repository");
} else {
  bad("list config before repository");
}

mustInclude(pubJs, "applySeoHead", "applySeoHead");
mustInclude(pubJs, "buildSeoTitle", "buildSeoTitle");
mustInclude(pubJs, "buildMetaDescription", "buildMetaDescription");
mustInclude(pubJs, "isStandardPlus", "isStandardPlus");
mustInclude(pubJs, "renderRichContentSections", "renderRichContentSections re-export");
mustInclude(pubJs, "renderBusinessDirectoryPage", "public delegates renderDetail");

mustInclude(rendererJs, "data-bd-public-full-description", "full_description section hook");
mustInclude(rendererJs, "data-bd-public-faq", "faq section hook");
mustInclude(rendererJs, "data-bd-public-recommended-uses", "recommended uses section hook");
mustInclude(rendererJs, "こんな方におすすめ", "recommended uses heading");
mustInclude(rendererJs, "よくある質問", "faq heading");
mustInclude(rendererJs, "詳細紹介", "shop full description title");
mustInclude(rendererJs, "サービス詳細", "service full description title");
mustInclude(rendererJs, "bd-public-faq__item", "faq accordion markup");
mustInclude(rendererJs, "bd-public-hero--text", "text hero markup");
mustInclude(pubJs, "MOCK_VERSION", "mock version bump");

mustInclude(pubCss, ".bd-public-faq", "faq styles");
mustInclude(pubCss, ".bd-public-uses", "uses styles");
mustInclude(pubCss, ".bd-public-prose", "prose styles");

mustInclude(migration, "p.seo_title", "public view seo_title");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
