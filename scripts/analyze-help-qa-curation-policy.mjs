#!/usr/bin/env node
/**
 * Q&A 整理方針レポート（調査のみ · 削除・修正なし）
 *   node scripts/analyze-help-qa-curation-policy.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_FILE = path.join(ROOT, "platform-qa-articles.generated.js");
const REPORT_JSON = path.join(ROOT, "reports", "help-qa-curation-policy-analysis.json");
const REPORT_MD = path.join(ROOT, "reports", "help-qa-curation-policy.md");

const GENERIC_PHRASES = [
  "以下のポイントをご確認ください。",
  "不明点はヘルプ・Q&AまたはAI相談をご利用ください。",
  "最新情報は各サービスページでもご確認いただけます。",
  "の基本手順をご確認ください。",
  "についてのご案内です。",
];

const DEFAULT_BULLETS = [
  "の基本手順をご確認ください。",
  "不明点はヘルプ・Q&AまたはAI相談をご利用ください。",
  "最新情報は各サービスページでもご確認いただけます。",
];

const PRIORITY_KEEP_CATEGORIES = new Set(["legal", "pricing", "security", "trouble"]);
const PRIORITY_KEEP_SERVICES = new Set(["tasful-ai", "tlv", "talk", "material"]);

const SEED_SLUGS = new Set([
  "signup",
  "apply",
  "pricing",
  "faq",
  "password-reset",
  "account-delete",
  "beginner",
  "contact-vendor",
  "listing-request",
  "direct-trading",
  "trouble-support",
  "search-no-results",
  "data-export",
]);

function loadArticles() {
  const raw = fs.readFileSync(ARTICLES_FILE, "utf8");
  const marker = "global.PLATFORM_QA_ARTICLES_GENERATED = ";
  const start = raw.indexOf(marker);
  if (start < 0) throw new Error("PLATFORM_QA_ARTICLES_GENERATED not found");
  const jsonStart = start + marker.length;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = jsonStart; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(raw.slice(jsonStart, i + 1));
      }
    }
  }
  throw new Error("Failed to parse PLATFORM_QA_ARTICLES_GENERATED JSON");
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[【】（）()［］\[\]「」『』]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDecorators(s) {
  return String(s || "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/【[^】]*】/g, "")
    .replace(/^english:\s*/i, "")
    .trim();
}

function slugBase(slug) {
  return String(slug || "")
    .replace(/-q\d+$/i, "")
    .replace(/-(beginner|viewer|worker|business|streamer|creator|intermediate|ai-user|vendor|individual|advanced|material-user)$/i, "");
}

function topicKeyFromSlug(slug) {
  return slugBase(slug);
}

function getBodyText(article) {
  const parts = [
    article.summary,
    ...(article.intro || []),
    ...(article.paragraphs || []),
    ...(article.bullets || []),
  ];
  if (Array.isArray(article.steps)) {
    for (const step of article.steps) {
      if (typeof step === "string") parts.push(step);
      else parts.push(step.title, step.desc);
    }
  }
  return parts.filter(Boolean).join(" ");
}

function hasCustomSteps(article) {
  return Array.isArray(article.steps) && article.steps.length >= 2;
}

function hasDefaultBulletsOnly(article) {
  const bullets = article.bullets || [];
  if (!bullets.length || hasCustomSteps(article)) return false;
  let hits = 0;
  for (const b of bullets) {
    if (DEFAULT_BULLETS.some((p) => String(b).includes(p))) hits += 1;
  }
  return hits >= 2;
}

function classifySlugPattern(slug) {
  if (/^english:/i.test(slug)) return "english-slug";
  if (/-q\d+$/i.test(slug)) return "question-variant";
  if (/-(beginner|viewer|worker|business|streamer|creator|intermediate|ai-user|vendor|individual|advanced|material-user)$/i.test(slug)) {
    return "persona-variant";
  }
  if (/-\d+$/.test(slug) && !/-q\d+$/i.test(slug)) return "numeric-suffix";
  return "canonical";
}

function classifyQuestionPattern(question) {
  const q = String(question || "");
  if (/^english:/i.test(q)) return "english-question";
  if (/^【.+】/.test(q)) return "bracket-prefixed";
  if (/を教えてください$/.test(q)) return "rephrase-polite";
  if (/について知りたい$/.test(q)) return "rephrase-want";
  if (/^【詳しく】/.test(q)) return "rephrase-detail";
  return "original";
}

function analyzeLowQuality(article) {
  const issues = [];
  const body = getBodyText(article);
  if (body.length < 80) issues.push("short-answer");

  let genericHits = 0;
  for (const phrase of GENERIC_PHRASES) {
    if (body.includes(phrase)) genericHits += 1;
  }
  if (genericHits >= 2) issues.push("generic-text");
  if (hasDefaultBulletsOnly(article)) issues.push("default-bullets-only");

  const bullets = article.bullets || [];
  const uniqueBullets = new Set(bullets.map(normalizeText));
  if (bullets.length >= 2 && uniqueBullets.size <= 1) issues.push("repetitive");

  if (!(article.relatedQaSlugs || []).length && !(article.related || []).length) {
    issues.push("no-related");
  }
  if (!article.cta && !article.ctaGroup) issues.push("no-cta");

  const title = String(article.title || "");
  if (/（.+）/.test(title) || /【.+】/.test(title) || /^english:/i.test(title)) {
    issues.push("unnatural-title");
  }
  if (title.length > 48 && /（/.test(title)) issues.push("unnatural-title");

  if (!hasCustomSteps(article) && article.category === "other") issues.push("weak-category");

  return issues;
}

function addToGroup(map, key, slug, reason, groups) {
  if (!key || key.length < 3) return;
  if (!map.has(key)) map.set(key, []);
  const list = map.get(key);
  if (!list.includes(slug)) list.push(slug);
  if (list.length === 2) groups.push({ key, reason, slugs: list.slice() });
  else if (list.length > 2) {
    const g = groups.find((row) => row.key === key && row.reason === reason);
    if (g) g.slugs = list.slice();
  }
}

function buildDuplicateIndex(articles) {
  const titleMap = new Map();
  const questionMap = new Map();
  const slugBaseMap = new Map();
  const groups = [];

  for (const article of articles) {
    const slug = article.slug;
    addToGroup(titleMap, normalizeText(stripDecorators(article.title)), slug, "title", groups);
    addToGroup(questionMap, normalizeText(stripDecorators(article.question)), slug, "question", groups);
    addToGroup(slugBaseMap, slugBase(slug), slug, "slug-base", groups);
  }

  const slugReasons = new Map();
  for (const group of groups) {
    for (const slug of group.slugs) {
      if (!slugReasons.has(slug)) slugReasons.set(slug, new Set());
      slugReasons.get(slug).add(group.reason);
    }
  }

  return { groups, slugReasons, duplicateSlugs: new Set(slugReasons.keys()) };
}

function groupByTopicKey(articles) {
  const map = new Map();
  for (const a of articles) {
    const key = topicKeyFromSlug(a.slug);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  return map;
}

function sampleItems(list, n, seed = 0) {
  if (list.length <= n) return list;
  const out = [];
  const step = Math.max(1, Math.floor(list.length / n));
  for (let i = 0; i < list.length && out.length < n; i += step) {
    out.push(list[(i + seed) % list.length]);
  }
  return out;
}

function scoreDeleteCandidate(article, dupReasons, qualityIssues) {
  let score = 0;
  const pattern = classifySlugPattern(article.slug);
  const qPattern = classifyQuestionPattern(article.question);

  if (pattern === "question-variant") score += 3;
  if (pattern === "persona-variant") score += 2;
  if (qPattern === "english-question" || qPattern === "bracket-prefixed") score += 3;
  if (qPattern === "rephrase-polite" || qPattern === "rephrase-want" || qPattern === "rephrase-detail") score += 2;
  if (qualityIssues.includes("generic-text")) score += 2;
  if (qualityIssues.includes("default-bullets-only")) score += 2;
  if (qualityIssues.includes("unnatural-title")) score += 1;
  if (dupReasons.includes("slug-base")) score += 2;
  if (dupReasons.includes("title")) score += 2;
  if (article.category === "other") score += 1;
  if (SEED_SLUGS.has(article.slug) || SEED_SLUGS.has(topicKeyFromSlug(article.slug))) score -= 10;
  if (PRIORITY_KEEP_CATEGORIES.has(article.category)) score -= 5;
  if (PRIORITY_KEEP_SERVICES.has(article.service) && hasCustomSteps(article)) score -= 3;
  if (hasCustomSteps(article)) score -= 2;

  return score;
}

function scoreKeepCandidate(article) {
  let score = 0;
  if (SEED_SLUGS.has(article.slug)) score += 10;
  if (PRIORITY_KEEP_CATEGORIES.has(article.category)) score += 5;
  if (hasCustomSteps(article)) score += 3;
  if (article.cta?.href) score += 1;
  if ((article.relatedQaSlugs || []).length >= 2) score += 1;
  if (classifySlugPattern(article.slug) === "canonical") score += 2;
  if (article.service === "tasful-ai" && /料金|プラン|規約|セキュリティ|エラー/.test(article.title + article.question)) {
    score += 3;
  }
  return score;
}

function proposeTargetCount(stats) {
  const total = stats.total;
  const canonicalTopics = stats.bySlugPattern.canonical || 0;
  const seedLike = stats.seedCount;
  const priorityCat = stats.priorityCategoryCount;
  const lowRiskDelete = stats.deleteScoreGte5;
  const mergeGroups = stats.mergeGroupCount;

  const scenarios = [
    {
      name: "積極整理",
      target: Math.round(canonicalTopics + seedLike + priorityCat * 0.8),
      note: "q変種・ペルソナ変種・汎用文のみを大幅削減",
    },
    {
      name: "標準整理（推奨）",
      target: Math.round(total * 0.22),
      note: "トピックあたり1〜2本 + 法務/料金/障害は維持",
    },
    {
      name: "保守整理",
      target: Math.round(total * 0.35),
      note: "明確な重複・低品質のみ削除、検索網羅性を残す",
    },
  ];
  return scenarios;
}

function main() {
  const articles = loadArticles();
  const dup = buildDuplicateIndex(articles);
  const byTopic = groupByTopicKey(articles);

  const stats = {
    total: articles.length,
    byCategory: {},
    byService: {},
    bySlugPattern: {},
    byQuestionPattern: {},
    duplicateSlugCount: dup.duplicateSlugs.size,
    duplicateGroupCount: dup.groups.length,
    lowQualityCount: 0,
    genericOnlyCount: 0,
    defaultBulletsOnlyCount: 0,
    withCustomSteps: 0,
    seedCount: 0,
    priorityCategoryCount: 0,
    mergeGroupCount: 0,
    deleteScoreGte5: 0,
    deleteScoreGte7: 0,
    keepScoreGte5: 0,
  };

  const qualityMap = new Map();
  const deleteCandidates = [];
  const keepCandidates = [];
  const mergeGroups = [];

  for (const [key, list] of byTopic) {
    if (list.length >= 2) {
      const canonical = list.find((a) => classifySlugPattern(a.slug) === "canonical") || list[0];
      const variants = list.filter((a) => a.slug !== canonical.slug);
      if (variants.length) {
        mergeGroups.push({
          topicKey: key,
          canonical: canonical.slug,
          variantCount: variants.length,
          service: canonical.service,
          category: canonical.category,
          title: canonical.title,
          sampleVariants: variants.slice(0, 3).map((a) => ({
            slug: a.slug,
            question: a.question,
            title: a.title,
          })),
        });
      }
    }
  }
  stats.mergeGroupCount = mergeGroups.length;

  for (const article of articles) {
    stats.byCategory[article.category] = (stats.byCategory[article.category] || 0) + 1;
    stats.byService[article.service] = (stats.byService[article.service] || 0) + 1;

    const sp = classifySlugPattern(article.slug);
    stats.bySlugPattern[sp] = (stats.bySlugPattern[sp] || 0) + 1;

    const qp = classifyQuestionPattern(article.question);
    stats.byQuestionPattern[qp] = (stats.byQuestionPattern[qp] || 0) + 1;

    const issues = analyzeLowQuality(article);
    if (issues.length) {
      stats.lowQualityCount += 1;
      qualityMap.set(article.slug, issues);
    }
    if (issues.includes("generic-text")) stats.genericOnlyCount += 1;
    if (issues.includes("default-bullets-only")) stats.defaultBulletsOnlyCount += 1;
    if (hasCustomSteps(article)) stats.withCustomSteps += 1;
    if (SEED_SLUGS.has(article.slug) || SEED_SLUGS.has(topicKeyFromSlug(article.slug))) {
      stats.seedCount += 1;
    }
    if (PRIORITY_KEEP_CATEGORIES.has(article.category)) stats.priorityCategoryCount += 1;

    const dupReasons = [...(dup.slugReasons.get(article.slug) || [])];
    const delScore = scoreDeleteCandidate(article, dupReasons, issues);
    const keepScore = scoreKeepCandidate(article);

    if (delScore >= 5) stats.deleteScoreGte5 += 1;
    if (delScore >= 7) stats.deleteScoreGte7 += 1;
    if (keepScore >= 5) stats.keepScoreGte5 += 1;

    deleteCandidates.push({ article, delScore, dupReasons, issues });
    keepCandidates.push({ article, keepScore });
  }

  deleteCandidates.sort((a, b) => b.delScore - a.delScore);
  keepCandidates.sort((a, b) => b.keepScore - a.keepScore);

  const duplicatePatterns = {
    slugBaseLarge: mergeGroups.filter((g) => g.variantCount >= 5).length,
    slugBaseMedium: mergeGroups.filter((g) => g.variantCount >= 2 && g.variantCount < 5).length,
    titleExact: dup.groups.filter((g) => g.reason === "title" && g.slugs.length >= 2).length,
    questionExact: dup.groups.filter((g) => g.reason === "question" && g.slugs.length >= 2).length,
  };

  const sampledDelete = sampleItems(deleteCandidates.filter((r) => r.delScore >= 7), 12, 1).map((r) => ({
    slug: r.article.slug,
    title: r.article.title,
    question: r.article.question,
    service: r.article.service,
    category: r.article.category,
    score: r.delScore,
    issues: r.issues,
    dupReasons: r.dupReasons,
  }));

  const sampledKeep = sampleItems(
    keepCandidates.filter(
      (r) =>
        r.keepScore >= 6 &&
        (classifySlugPattern(r.article.slug) === "canonical" || hasCustomSteps(r.article)),
    ),
    12,
    2,
  ).map((r) => ({
    slug: r.article.slug,
    title: r.article.title,
    category: r.article.category,
    service: r.article.service,
    score: r.keepScore,
    hasSteps: hasCustomSteps(r.article),
  }));

  const sampledMerge = sampleItems(
    mergeGroups.sort((a, b) => b.variantCount - a.variantCount),
    10,
    0,
  );

  const deleteInPriorityCat = deleteCandidates.filter(
    (r) => r.delScore >= 7 && PRIORITY_KEEP_CATEGORIES.has(r.article.category),
  ).length;
  const deleteVariantOnly = deleteCandidates.filter(
    (r) =>
      r.delScore >= 7 &&
      (classifySlugPattern(r.article.slug) === "question-variant" ||
        classifySlugPattern(r.article.slug) === "persona-variant"),
  ).length;
  stats.deleteInPriorityCat = deleteInPriorityCat;
  stats.deleteVariantOnly = deleteVariantOnly;
  stats.uniqueTopicKeys = byTopic.size;

  const scenarios = proposeTargetCount(stats);

  const analysis = {
    generatedAt: new Date().toISOString(),
    source: "platform-qa-articles.generated.js",
    stats,
    duplicatePatterns,
    scenarios,
    sampledDelete,
    sampledKeep,
    sampledMerge,
    ruleProposals: {
      delete: [
        "同一 topicKey の -q2 以降で、canonical（topicKey または -q1）が存在し本文が同一テンプレのもの",
        "質問が QA_QUESTION_REPHRASES 由来（【初心者】【法人】【詳しく】English: 〜を教えてください 等）で独自 steps がないもの",
        "persona-variant（-beginner / -business 等）で canonical と summary/steps が同一のもの",
        "generic-text + default-bullets-only の両方を満たすもの",
        "category=other かつ カスタム steps なし かつ 重複グループ所属",
        "タイトルが「元タイトル（質問抜粋）」形式の question-variant",
      ],
      merge: [
        "同一 service + 同一 topicKey の複数 slug → canonical 1 本に統合し、質問バリエーションは keywords/aliases へ移す",
        "同一 title（正規化後）の完全一致グループ → 最も steps が充実した 1 本を残す",
        "persona-variant は本文差分がなければ canonical に persona タグを付与して統合",
      ],
      keep: [
        "SEED 相当（signup, pricing, faq, account-delete 等）",
        "category ∈ legal, pricing, security, trouble",
        "カスタム steps が 2 段階以上ある記事",
        "CTA が実導線（/signup.html, /ai-workspace.html 等）に接続されている記事",
        "TASFUL AI / TLV / Talk / Material の入口・料金・障害・規約系",
        "canonical slug（-q なし）でサービス固有の notice/cta がある記事",
      ],
      review: [
        "削除前に canonical 選定（steps 数 · CTA · related 数でスコアリング）",
        "legal/pricing/security は削除せず hold → 人手 adopt",
        "統合時は keywords.generated.js の aliases に質問文を退避",
        "削除は archive → 30日後 delete の二段階（curation UI 既存フロー）",
      ],
    },
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(analysis, null, 2), "utf8");

  const md = buildMarkdown(analysis, stats, duplicatePatterns, scenarios, sampledDelete, sampledKeep, sampledMerge);
  fs.writeFileSync(REPORT_MD, md, "utf8");

  console.log(md);
  console.log(`\nJSON: ${REPORT_JSON}`);
  console.log(`Report: ${REPORT_MD}`);
}

function buildMarkdown(analysis, stats, duplicatePatterns, scenarios, sampledDelete, sampledKeep, sampledMerge) {
  const lines = [
    "# Q&A 整理方針レポート（調査のみ）",
    "",
    `**生成日時:** ${analysis.generatedAt}`,
    `**対象:** ${stats.total} 件（\`platform-qa-articles.generated.js\`）`,
    `**方針:** 削除・統合は未実施。整理管理 UI 完成済み · 本レポートは削除前の判断材料。`,
    "",
    "---",
    "",
    "## 1. 全体像",
    "",
    "| 指標 | 件数 | 割合 |",
    "|------|------|------|",
    `| 総記事数 | ${stats.total} | 100% |`,
    `| 重複候補（いずれかの重複理由あり） | ${stats.duplicateSlugCount} | ${pct(stats.duplicateSlugCount, stats.total)} |`,
    `| 低品質候補（品質 issue ≥1） | ${stats.lowQualityCount} | ${pct(stats.lowQualityCount, stats.total)} |`,
    `| 汎用文のみ（generic-text） | ${stats.genericOnlyCount} | ${pct(stats.genericOnlyCount, stats.total)} |`,
    `| デフォルト bullets のみ | ${stats.defaultBulletsOnlyCount} | ${pct(stats.defaultBulletsOnlyCount, stats.total)} |`,
    `| カスタム steps あり | ${stats.withCustomSteps} | ${pct(stats.withCustomSteps, stats.total)} |`,
    `| 統合グループ（topicKey あたり 2+） | ${stats.mergeGroupCount} | — |`,
    `| 削除スコア ≥7（自動削除候補） | ${stats.deleteScoreGte7} | ${pct(stats.deleteScoreGte7, stats.total)} |`,
    `| うち q/persona 変種のみ | ${stats.deleteVariantOnly || 0} | ${pct(stats.deleteVariantOnly || 0, stats.total)} |`,
    `| うち法務/料金/障害/セキュリティ（要人手確認） | ${stats.deleteInPriorityCat || 0} | ${pct(stats.deleteInPriorityCat || 0, stats.total)} |`,
    `| 保持スコア ≥5（優先保持候補） | ${stats.keepScoreGte5} | ${pct(stats.keepScoreGte5, stats.total)} |`,
    `| ユニーク topicKey 数 | ${stats.uniqueTopicKeys || 0} | — |`,
    "",
    "### スラッグパターン",
    "",
    "| パターン | 件数 | 説明 |",
    "|----------|------|------|",
    ...Object.entries(stats.bySlugPattern).map(([k, v]) => {
      const desc = {
        canonical: "topicKey そのまま（代表候補）",
        "question-variant": "`-q2` 以降の質問バリエーション",
        "persona-variant": "`-beginner` 等ペルソナ違い",
        "numeric-suffix": "連番サフィックス",
        "english-slug": "英語系",
      }[k] || "";
      return `| ${k} | ${v} | ${desc} |`;
    }),
    "",
    "### 質問パターン",
    "",
    "| パターン | 件数 |",
    "|----------|------|",
    ...Object.entries(stats.byQuestionPattern).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "### カテゴリ分布（上位）",
    "",
    "| category | 件数 |",
    "|----------|------|",
    ...Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "### サービス分布",
    "",
    "| service | 件数 |",
    "|---------|------|",
    ...Object.entries(stats.byService)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "---",
    "",
    "## 2. 重複パターン分類（代表）",
    "",
    "| パターン ID | 説明 | 規模 |",
    "|-------------|------|------|",
    `| **D1 slug-base 大量** | 同一 topicKey + \`-qN\` / persona 違いのみ | ${duplicatePatterns.slugBaseLarge} トピック（各5件以上） |`,
    `| **D2 slug-base 中** | 同一 topicKey で 2〜4 件 | ${duplicatePatterns.slugBaseMedium} トピック |`,
    `| **D3 title 完全一致** | 正規化タイトル同一 | ${duplicatePatterns.titleExact} グループ |`,
    `| **D4 question 完全一致** | 正規化質問同一 | ${duplicatePatterns.questionExact} グループ |`,
    `| **D5 言い換えテンプレ** | \`を教えてください\` / \`について知りたい\` / \`【初心者】\` / \`English:\` | ${(stats.byQuestionPattern["rephrase-polite"] || 0) + (stats.byQuestionPattern["rephrase-want"] || 0) + (stats.byQuestionPattern["bracket-prefixed"] || 0) + (stats.byQuestionPattern["english-question"] || 0)} 件 |`,
    `| **D6 ペルソナ重複** | \`-beginner\` 等 · 本文同一 | ${stats.bySlugPattern["persona-variant"] || 0} 件 |`,
    "",
    "### 統合グループサンプル（variant 多い順）",
    "",
  ];

  for (const g of sampledMerge) {
    lines.push(`#### \`${g.topicKey}\`（${g.variantCount + 1} 件 · ${g.service} / ${g.category}）`);
    lines.push(`- **代表候補:** \`${g.canonical}\` — ${g.title}`);
    for (const v of g.sampleVariants) {
      lines.push(`- 統合候補: \`${v.slug}\` — 「${v.question}」`);
    }
    lines.push("");
  }

  lines.push("---", "", "## 3. 削除してよい候補ルール（提案）", "");
  for (const r of analysis.ruleProposals.delete) {
    lines.push(`- ${r}`);
  }

  lines.push("", "### 削除候補サンプル（スコア ≥7）", "");
  lines.push("| slug | service | score | 主な理由 |");
  lines.push("|------|---------|-------|----------|");
  for (const s of sampledDelete) {
    lines.push(
      `| \`${s.slug}\` | ${s.service} | ${s.score} | ${[...s.issues, ...s.dupReasons].slice(0, 3).join(", ")} |`,
    );
  }

  lines.push("", "---", "", "## 4. 残すべき候補ルール（提案）", "");
  for (const r of analysis.ruleProposals.keep) {
    lines.push(`- ${r}`);
  }

  lines.push("", "### 優先保持サンプル", "");
  lines.push("| slug | category | service | score | steps |");
  lines.push("|------|----------|---------|-------|-------|");
  for (const s of sampledKeep) {
    lines.push(`| \`${s.slug}\` | ${s.category} | ${s.service} | ${s.score} | ${s.hasSteps ? "あり" : "なし"} |`);
  }

  lines.push("", "---", "", "## 5. 統合ルール（提案）", "");
  for (const r of analysis.ruleProposals.merge) {
    lines.push(`- ${r}`);
  }

  lines.push("", "---", "", "## 6. 運用フロー（提案）", "");
  for (const r of analysis.ruleProposals.review) {
    lines.push(`- ${r}`);
  }

  lines.push("", "---", "", "## 7. 目標件数（提案）", "");
  lines.push("");
  lines.push("| シナリオ | 目標件数 | 説明 |");
  lines.push("|----------|----------|------|");
  for (const s of scenarios) {
    lines.push(`| **${s.name}** | **約 ${s.target} 件** | ${s.note} |`);
  }

  lines.push(
    "",
    "**推奨:** **標準整理 約 970 件**（現状の約 22%）",
    "",
    "内訳イメージ:",
    `- トピック代表（canonical）: 約 ${stats.bySlugPattern.canonical || 0} 件`,
    `- 法務/料金/セキュリティ/トラブル: 優先維持（約 ${stats.priorityCategoryCount} 件から精査）`,
    `- サービス入口（AI/TLV/Talk/Material）: 各トピック 1〜2 本`,
    `- 削除候補（スコア≥7）: 約 ${stats.deleteScoreGte7} 件を第一段階で archive 検討`,
    "",
    "---",
    "",
    "## 8. 結論",
    "",
    "現状 4394 件は **カタログ生成器の網羅性優先**（`QA_QUESTION_REPHRASES` · persona 変種 · `-qN` 量産）による膨張が主因。",
    "109 トピック × 平均約 40 変種（質問言い換え 5 種 × ペルソナ 7〜8 種）が構造。カスタム steps を持つ記事は **48 件（1.1%）** のみ。",
    "実際のユーザー導線・AI SSOT として価値が高いのは **canonical 118 本 + SEED + 法務/料金/障害** の数百件。",
    "",
    "**次のステップ（削除前）:**",
    "1. curation UI で `duplicates` / `low-quality` タブを人手サンプル確認（各 50 件）",
    "2. 本レポートの削除ルールを `PlatformQaCuration` の自動タグ付けに反映（実装は別タスク）",
    "3. archive → 8788 検索/AI ヒット確認 → 本削除",
    "",
    "※ 本レポートはデータ変更なし。",
  );

  return lines.join("\n");
}

function pct(n, total) {
  return `${((n / total) * 100).toFixed(1)}%`;
}

main();
