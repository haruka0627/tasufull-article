#!/usr/bin/env node
/**
 * Generate platform Q&A catalog → articles + separated search keywords
 * Run: node scripts/generate-platform-qa-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QA_SEED_ARTICLES } from "./lib/platform-qa-catalog-seed.mjs";
import {
  QA_TOPIC_SPECS,
  QA_EXTRA_TOPIC_SPECS,
  QA_PERSONA_VARIANTS,
} from "./lib/platform-qa-catalog-topics.mjs";
import {
  QA_EXTENDED_TOPIC_SPECS,
  QA_QUESTION_REPHRASES,
} from "./lib/platform-qa-catalog-topics-extended.mjs";
import {
  QA_KEYWORDS_BY_SLUG,
  QA_KEYWORDS_BY_TOPIC,
} from "./lib/platform-qa-catalog-keywords-seed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ARTICLES = path.join(ROOT, "platform-qa-articles.generated.js");
const OUT_KEYWORDS = path.join(ROOT, "platform-qa-keywords.generated.js");

const SEED_SLUGS = new Set(QA_SEED_ARTICLES.map((a) => a.slug));
const ALL_SPECS = [...QA_TOPIC_SPECS, ...QA_EXTRA_TOPIC_SPECS, ...QA_EXTENDED_TOPIC_SPECS];

function stripSearchFields(article) {
  const { keywords, aliases, synonyms, ...rest } = article;
  return rest;
}

function uniqueSlug(base, used) {
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function mergeKeywordSets(...sets) {
  const out = { keywords: [], aliases: [], synonyms: [] };
  for (const set of sets) {
    if (!set) continue;
    out.keywords.push(...(set.keywords || []));
    out.aliases.push(...(set.aliases || []));
    out.synonyms.push(...(set.synonyms || []));
  }
  out.keywords = [...new Set(out.keywords.filter(Boolean))];
  out.aliases = [...new Set(out.aliases.filter(Boolean))];
  out.synonyms = [...new Set(out.synonyms.filter(Boolean))];
  return out;
}

function buildSearchMeta(slug, spec, question, persona) {
  const topicKey = spec?.key;
  const fromSlug = QA_KEYWORDS_BY_SLUG[slug] || QA_KEYWORDS_BY_SLUG[topicKey];
  const fromTopic = topicKey ? QA_KEYWORDS_BY_TOPIC[topicKey] : null;
  const fromSpec = spec
    ? { keywords: spec.keywords || [], aliases: spec.aliases || [], synonyms: spec.synonyms || [] }
    : null;

  const merged = mergeKeywordSets(fromSlug, fromTopic, fromSpec, {
    keywords: [persona, spec?.service, spec?.category, spec?.title].filter(Boolean),
    aliases: [question],
    synonyms: [],
  });

  return { slug, ...merged };
}

function buildArticle(spec, question, variantIndex, idNum, usedSlugs, opts = {}) {
  const persona = opts.persona || spec.persona || "beginner";
  const topicKey = spec.key;
  const slug = uniqueSlug(
    opts.slugOverride ||
      (variantIndex === 0 && !SEED_SLUGS.has(topicKey)
        ? topicKey
        : `${topicKey}-q${variantIndex + 1}`),
    usedSlugs,
  );

  if (SEED_SLUGS.has(slug)) return null;

  const id = String(idNum).padStart(4, "0");
  const intro = [
    spec.summary,
    `${spec.title}についてのご案内です。`,
    persona === "beginner" ? "初めての方でも順番に進められます。" : "以下のポイントをご確認ください。",
  ];

  const body = {};
  if (spec.steps?.length) body.steps = spec.steps;
  else if (spec.bullets?.length) body.bullets = spec.bullets;
  else {
    body.bullets = [
      `${spec.title}の基本手順をご確認ください。`,
      "不明点はヘルプ・Q&AまたはAI相談をご利用ください。",
      "最新情報は各サービスページでもご確認いただけます。",
    ];
  }

  if (spec.notice) body.notice = spec.notice;
  if (spec.cta) body.cta = spec.cta;

  const article = {
    id,
    slug,
    title:
      opts.titleOverride ||
      (variantIndex > 0 ? `${spec.title}（${question.slice(0, 24)}）` : spec.title),
    question,
    category: spec.category,
    service: spec.service,
    persona,
    summary: spec.summary,
    updatedAt: "2026-06-30",
    intro,
    ...body,
    relatedQaSlugs: (spec.relatedSlugs || []).slice(0, 6),
  };

  const searchMeta = buildSearchMeta(slug, spec, question, persona);
  return { article, searchMeta };
}

function collectQuestions(spec) {
  const base = [...(spec.questions || [spec.title])];
  const expanded = [];
  for (const q of base) {
    expanded.push(q);
    for (const rephrase of QA_QUESTION_REPHRASES) {
      expanded.push(rephrase(q));
    }
  }
  return [...new Set(expanded)];
}

function generateCatalog() {
  const usedSlugs = new Set(SEED_SLUGS);
  const articles = [];
  const searchBySlug = {};
  let idNum = QA_SEED_ARTICLES.length + 1;

  for (const raw of QA_SEED_ARTICLES) {
    const article = stripSearchFields(raw);
    articles.push(article);
    const spec = { key: article.slug, service: article.service, category: article.category, title: article.title };
    searchBySlug[article.slug] = buildSearchMeta(article.slug, spec, article.question, article.persona);
  }

  for (const spec of ALL_SPECS) {
    if (SEED_SLUGS.has(spec.key)) continue;

    const questions = collectQuestions(spec);
    questions.forEach((q, qi) => {
      const built = buildArticle(spec, q, qi, idNum, usedSlugs);
      if (!built) return;
      articles.push(built.article);
      searchBySlug[built.article.slug] = built.searchMeta;
      idNum += 1;
    });

    for (const pv of QA_PERSONA_VARIANTS) {
      if (pv.persona === spec.persona) continue;
      const crossQ = `${pv.prefix}${spec.title}について`;
      const built = buildArticle(spec, crossQ, questions.length, idNum, usedSlugs, {
        persona: pv.persona,
        slugOverride: `${spec.key}-${pv.persona}`,
        titleOverride: `${spec.title}${pv.suffix}`,
      });
      if (!built) continue;
      articles.push(built.article);
      searchBySlug[built.article.slug] = built.searchMeta;
      idNum += 1;
    }
  }

  return { articles, searchBySlug };
}

function countKeywordEntries(searchBySlug) {
  let n = 0;
  for (const meta of Object.values(searchBySlug)) {
    n += (meta.keywords || []).length;
    n += (meta.aliases || []).length;
    n += (meta.synonyms || []).length;
  }
  return n;
}

function countRelatedLinks(articles) {
  let n = 0;
  for (const a of articles) {
    n += (a.relatedQaSlugs || []).length;
    n += (a.related || []).length;
  }
  return n;
}

const { articles, searchBySlug } = generateCatalog();
const categories = new Set(articles.map((a) => a.category));

fs.writeFileSync(
  OUT_ARTICLES,
  `/** Auto-generated — do not edit. Run: node scripts/generate-platform-qa-catalog.mjs */\n` +
    `(function (global) {\n` +
    `  "use strict";\n` +
    `  global.PLATFORM_QA_ARTICLES_GENERATED = ${JSON.stringify(articles, null, 2)};\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`,
  "utf8",
);

fs.writeFileSync(
  OUT_KEYWORDS,
  `/** Auto-generated — search keywords separated from Q&A body. */\n` +
    `(function (global) {\n` +
    `  "use strict";\n` +
    `  global.PLATFORM_QA_SEARCH_KEYWORDS = ${JSON.stringify(searchBySlug, null, 2)};\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`,
  "utf8",
);

const stats = {
  articles: articles.length,
  categories: categories.size,
  keywordSlugs: Object.keys(searchBySlug).length,
  keywordEntries: countKeywordEntries(searchBySlug),
  relatedLinks: countRelatedLinks(articles),
  articlesFile: OUT_ARTICLES,
  keywordsFile: OUT_KEYWORDS,
  articlesBytes: fs.statSync(OUT_ARTICLES).size,
  keywordsBytes: fs.statSync(OUT_KEYWORDS).size,
};

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports", "platform-qa-catalog-stats.json"), JSON.stringify(stats, null, 2), "utf8");

console.log("[generate-platform-qa-catalog]");
console.log(JSON.stringify(stats, null, 2));
