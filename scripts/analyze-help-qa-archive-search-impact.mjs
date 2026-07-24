#!/usr/bin/env node
/**
 * Archive 除外/含有時の Help検索・AI検索 ヒット件数比較（調査のみ · 削除なし）
 *   node scripts/analyze-help-qa-archive-search-impact.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_FILE = path.join(ROOT, "platform-qa-articles.generated.js");
const KEYWORDS_FILE = path.join(ROOT, "platform-qa-keywords.generated.js");
const REPORT_JSON = path.join(ROOT, "reports", "help-qa-archive-search-impact.json");
const REPORT_MD = path.join(ROOT, "reports", "help-qa-archive-search-impact.md");

const ARCHIVE_SCORE_THRESHOLD = 7;
const AI_MAX_HITS = 1;

const QA_CATEGORIES = [
  { id: "account", listLabel: "会員登録・アカウント" },
  { id: "pricing", listLabel: "料金・支払い" },
  { id: "search", listLabel: "検索・探す" },
  { id: "apply", listLabel: "応募・取引" },
  { id: "listing", listLabel: "掲載・依頼" },
  { id: "trading", listLabel: "取引ルール" },
  { id: "trouble", listLabel: "トラブル・サポート" },
  { id: "platform", listLabel: "TASFUL Platform" },
  { id: "ai", listLabel: "TASFUL AI" },
  { id: "tlv", listLabel: "TLV Live" },
  { id: "talk", listLabel: "TASFUL Talk" },
  { id: "material", listLabel: "Material" },
  { id: "security", listLabel: "セキュリティ" },
  { id: "legal", listLabel: "利用規約・プライバシー" },
  { id: "other", listLabel: "その他" },
];

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

const FEATURED_SLUGS = [
  "signup",
  "pricing",
  "direct-trading",
  "search-no-results",
  "beginner",
  "ai-workspace-start",
  "tlv-start",
  "talk-start",
];

const PRIORITY_KEEP_CATEGORIES = new Set(["legal", "pricing", "security", "trouble"]);
const PRIORITY_KEEP_SERVICES = new Set(["tasful-ai", "tlv", "talk", "material"]);

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

const CORE_QUERIES = [
  "会員登録",
  "退会",
  "料金",
  "プラン",
  "パスワード",
  "ログイン",
  "検索",
  "掲載",
  "応募",
  "支払い",
  "請求",
  "解約",
  "AI",
  "TASFUL AI",
  "画像生成",
  "音声入力",
  "モデル",
  "TLV",
  "配信",
  "ライブ",
  "視聴",
  "Talk",
  "通話",
  "Material",
  "素材",
  "規約",
  "プライバシー",
  "セキュリティ",
  "二要素認証",
  "トラブル",
  "問い合わせ",
  "サポート",
  "直接取引",
  "スカウト",
  "エラー",
  "動かない",
  "表示されない",
  "初心者",
  "FAQ",
  "アカウント削除",
  "パスワード再設定",
  "クレジットカード",
  "領収書",
  "返金",
  "無料",
  "Pro",
  "アーカイブ",
  "録画",
  "ギフト",
  "通報",
  "ブロック",
  "通知",
  "下書き",
  "エクスポート",
  "インポート",
  "API",
  "OAuth",
  "MFA",
  "迷惑メール",
  "二重課金",
  "ログアウト",
  "プロフィール",
  "掲載依頼",
  "業者",
  "マッチング",
  "お気に入り",
  "履歴",
  "フィルター",
  "並び替え",
  "スマホ",
  "アプリ",
  "English",
  "法人",
  "ビジネス",
  "クリエイター",
  "配信者",
  "視聴者",
  "案件",
  "見積もり",
  "チャット",
  "相談",
  "ヘルプ",
  "使い方",
  "はじめて",
  "制限",
  "上限",
  "容量",
  "ストレージ",
  "バックアップ",
  "同期",
  "遅い",
  "重い",
  "固まる",
  "接続",
  "オフライン",
];

function extractJsonFromGeneratedJs(filePath, marker) {
  const raw = fs.readFileSync(filePath, "utf8");
  const start = raw.indexOf(marker);
  if (start < 0) throw new Error(`${marker} not found in ${filePath}`);
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
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(raw.slice(jsonStart, i + 1));
      }
    }
  }
  throw new Error(`Failed to parse JSON from ${filePath}`);
}

function loadArticles() {
  return extractJsonFromGeneratedJs(ARTICLES_FILE, "global.PLATFORM_QA_ARTICLES_GENERATED = ");
}

function loadKeywords() {
  return extractJsonFromGeneratedJs(KEYWORDS_FILE, "global.PLATFORM_QA_SEARCH_KEYWORDS = ");
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
    .replace(
      /-(beginner|viewer|worker|business|streamer|creator|intermediate|ai-user|vendor|individual|advanced|material-user)$/i,
      "",
    );
}

function topicKeyFromSlug(slug) {
  return slugBase(slug);
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
  if (
    /-(beginner|viewer|worker|business|streamer|creator|intermediate|ai-user|vendor|individual|advanced|material-user)$/i.test(
      slug,
    )
  ) {
    return "persona-variant";
  }
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
  const parts = [
    article.summary,
    ...(article.intro || []),
    ...(article.paragraphs || []),
    ...(article.bullets || []),
  ];
  const body = parts.filter(Boolean).join(" ");
  if (body.length < 80) issues.push("short-answer");

  let genericHits = 0;
  for (const phrase of GENERIC_PHRASES) {
    if (body.includes(phrase)) genericHits += 1;
  }
  if (genericHits >= 2) issues.push("generic-text");
  if (hasDefaultBulletsOnly(article)) issues.push("default-bullets-only");

  const title = String(article.title || "");
  if (/（.+）/.test(title) || /【.+】/.test(title) || /^english:/i.test(title)) {
    issues.push("unnatural-title");
  }

  return issues;
}

function buildDuplicateIndex(articles) {
  const slugBaseMap = new Map();
  const titleMap = new Map();
  const groups = [];

  function addToGroup(map, key, slug, reason) {
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

  for (const article of articles) {
    const slug = article.slug;
    addToGroup(titleMap, normalizeText(stripDecorators(article.title)), slug, "title");
    addToGroup(slugBaseMap, slugBase(slug), slug, "slug-base");
  }

  const slugReasons = new Map();
  for (const group of groups) {
    for (const slug of group.slugs) {
      if (!slugReasons.has(slug)) slugReasons.set(slug, new Set());
      slugReasons.get(slug).add(group.reason);
    }
  }
  return { slugReasons };
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
  return score;
}

function getCategoryLabel(categoryId) {
  return QA_CATEGORIES.find((c) => c.id === categoryId)?.listLabel || categoryId;
}

function normalizeSearchText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query) {
  return normalizeSearchText(query)
    .split(/[\s\u3000、。,.!?！？/]+/)
    .filter(Boolean);
}

function buildSearchHaystack(article, searchKeywords) {
  const meta = searchKeywords[article.slug] || { keywords: [], aliases: [], synonyms: [] };
  const parts = [
    article.title,
    article.question,
    article.summary,
    article.service,
    article.persona,
    getCategoryLabel(article.category),
    ...(article.intro || []),
    ...(article.paragraphs || []),
    ...(article.bullets || []),
    ...meta.keywords,
    ...meta.aliases,
    ...meta.synonyms,
  ];
  if (Array.isArray(article.steps)) {
    for (const step of article.steps) {
      if (typeof step === "string") parts.push(step);
      else parts.push(step.title, step.desc);
    }
  }
  return normalizeSearchText(parts.filter(Boolean).join(" "));
}

function scoreArticle(article, tokens, haystack, searchKeywords) {
  if (!tokens.length) return 0;
  const meta = searchKeywords[article.slug] || { keywords: [], aliases: [], synonyms: [] };
  let score = 0;
  for (const t of tokens) {
    if (!haystack.includes(t)) return -1;
    if (normalizeSearchText(article.question).includes(t)) score += 12;
    if (normalizeSearchText(article.title).includes(t)) score += 10;
    if (meta.keywords.some((k) => normalizeSearchText(k).includes(t))) score += 8;
    if (meta.aliases.some((k) => normalizeSearchText(k).includes(t))) score += 7;
    if (meta.synonyms.some((k) => normalizeSearchText(k).includes(t))) score += 6;
    if (normalizeSearchText(article.summary).includes(t)) score += 4;
    score += 1;
  }
  return score;
}

function searchArticles(articles, searchKeywords, archivedSlugs, excludeArchived, query, categoryId = "all") {
  const tokens = tokenizeQuery(query);
  const cat = categoryId && categoryId !== "all" ? categoryId : "";
  const haystackCache = new Map();

  const scored = [];
  for (const article of articles) {
    if (excludeArchived && archivedSlugs.has(article.slug)) continue;
    if (cat && article.category !== cat) continue;

    let hay = haystackCache.get(article);
    if (!hay) {
      hay = buildSearchHaystack(article, searchKeywords);
      haystackCache.set(article, hay);
    }

    const score = scoreArticle(article, tokens, hay, searchKeywords);
    if (score < 0) continue;
    scored.push({ article, score: tokens.length ? score : 0 });
  }

  scored.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, "ja"));
  return scored;
}

function pickRepresentativeKeywords(articles, searchKeywords, keepBySlug) {
  const picked = new Set();

  function add(q) {
    const t = String(q || "").trim();
    if (!t || t.length < 2) return;
    if (t.length > 48) return;
    picked.add(t);
  }

  for (const q of CORE_QUERIES) add(q);

  for (const slug of FEATURED_SLUGS) {
    const meta = searchKeywords[slug];
    if (meta?.keywords?.[0]) add(meta.keywords[0]);
    const article = articles.find((a) => a.slug === slug);
    if (article?.question) add(article.question.slice(0, 24));
  }

  for (const cat of QA_CATEGORIES) {
    const inCat = articles
      .filter((a) => a.category === cat.id)
      .map((a) => ({ article: a, keep: keepBySlug.get(a.slug) || 0 }))
      .sort((a, b) => b.keep - a.keep || a.article.title.localeCompare(b.article.title, "ja"));
    const top = inCat.find((r) => classifySlugPattern(r.article.slug) === "canonical") || inCat[0];
    if (top) {
      add(top.article.title);
      const meta = searchKeywords[top.article.slug];
      if (meta?.keywords?.[0]) add(meta.keywords[0]);
    }
  }

  const canonicalKeeps = articles
    .filter((a) => classifySlugPattern(a.slug) === "canonical")
    .map((a) => ({ article: a, keep: keepBySlug.get(a.slug) || 0 }))
    .sort((a, b) => b.keep - a.keep)
    .slice(0, 40);

  for (const row of canonicalKeeps) {
    add(row.article.question);
    const meta = searchKeywords[row.article.slug];
    if (meta?.aliases?.[0]) add(meta.aliases[0]);
  }

  const list = [...picked];
  if (list.length > 100) return list.slice(0, 100);
  if (list.length < 50) {
    for (const article of articles) {
      if (list.length >= 80) break;
      if (classifySlugPattern(article.slug) !== "canonical") continue;
      add(article.title);
    }
  }
  return list.slice(0, 100);
}

function pct(n, total) {
  if (!total) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function buildArchiveSets(articles, deleteScores, keepScores) {
  const full = new Set();
  const variantOnly = new Set();

  for (const article of articles) {
    const del = deleteScores.get(article.slug) || 0;
    const keep = keepScores.get(article.slug) || 0;
    const pattern = classifySlugPattern(article.slug);
    const isSeed = SEED_SLUGS.has(article.slug) || SEED_SLUGS.has(topicKeyFromSlug(article.slug));

    if (del >= ARCHIVE_SCORE_THRESHOLD) full.add(article.slug);

    if (pattern === "canonical" || isSeed || keep >= 5) continue;
    if (PRIORITY_KEEP_CATEGORIES.has(article.category) && keep >= 3) continue;
    if ((pattern === "question-variant" || pattern === "persona-variant") && del >= ARCHIVE_SCORE_THRESHOLD) {
      variantOnly.add(article.slug);
    }
  }

  return { full, variantOnly };
}

function evaluateScenario(articles, searchKeywords, archivedSlugs, keywords, keepScores) {
  const rows = [];
  let helpTotalWith = 0;
  let helpTotalWithout = 0;
  let zeroHitWithout = 0;
  let aiTop1Stable = 0;
  let qualityOk = 0;
  let archiveOnlyHitSum = 0;

  for (const query of keywords) {
    const withArchive = searchArticles(articles, searchKeywords, archivedSlugs, false, query);
    const withoutArchive = searchArticles(articles, searchKeywords, archivedSlugs, true, query);

    const hitsWith = withArchive.length;
    const hitsWithout = withoutArchive.length;
    const aiTopWith = withArchive[0]?.article?.slug || null;
    const aiTopWithout = withoutArchive[0]?.article?.slug || null;
    const topStable = aiTopWith === aiTopWithout;
    const archiveOnlyHits = withArchive.filter((r) => archivedSlugs.has(r.article.slug)).length;

    const keepWith = aiTopWith ? keepScores.get(aiTopWith) || 0 : 0;
    const keepWithout = aiTopWithout ? keepScores.get(aiTopWithout) || 0 : 0;
    const isQualityOk =
      (hitsWith === 0 && hitsWithout === 0) ||
      (hitsWithout >= 1 &&
        (topStable || (!archivedSlugs.has(aiTopWithout) && keepWithout >= keepWith - 1)));

    if (hitsWithout === 0) zeroHitWithout += 1;
    if (topStable) aiTop1Stable += 1;
    if (isQualityOk) qualityOk += 1;

    helpTotalWith += hitsWith;
    helpTotalWithout += hitsWithout;
    archiveOnlyHitSum += archiveOnlyHits;

    rows.push({
      query,
      hitsWith,
      hitsWithout,
      delta: hitsWith - hitsWithout,
      archiveOnlyHits,
      aiTopWith,
      aiTopWithout,
      aiTop1Stable: topStable,
      qualityOk: isQualityOk,
    });
  }

  return {
    rows,
    summary: {
      helpTotalWith,
      helpTotalWithout,
      helpAvgWith: helpTotalWith / keywords.length,
      helpAvgWithout: helpTotalWithout / keywords.length,
      zeroHitWithout,
      aiTop1Stable,
      aiTop1Changed: keywords.length - aiTop1Stable,
      qualityOk,
      avgArchiveOnlyHits: archiveOnlyHitSum / keywords.length,
    },
  };
}

const PRIORITY_QUERIES = new Set([
  "会員登録",
  "退会",
  "料金",
  "プラン",
  "パスワード",
  "ログイン",
  "検索",
  "掲載",
  "応募",
  "支払い",
  "請求",
  "解約",
  "AI",
  "TASFUL AI",
  "規約",
  "プライバシー",
  "セキュリティ",
  "トラブル",
  "問い合わせ",
  "サポート",
  "直接取引",
  "FAQ",
  "アカウント削除",
  "パスワード再設定",
  "初心者",
  "無料",
  "掲載依頼",
]);

function buildMarkdownReport(data) {
  const full = data.scenarios.full;
  const variant = data.scenarios.variantOnly;
  const lines = [
    "# Help / AI 検索 — Archive 除外比較レポート",
    "",
    "**方針:** 調査のみ · Archive / 削除は未実施",
    `**生成日時:** ${data.generatedAt}`,
    `**対象記事:** ${data.stats.totalArticles} 件`,
    `**代表キーワード:** ${data.keywords.length} 件`,
    "",
    "---",
    "",
    "## 1. 比較シナリオ",
    "",
    "| シナリオ | Archive 件数 | 残存 | 説明 |",
    "|----------|-------------|------|------|",
    `| **A: 自動候補フル** | ${data.stats.archiveFullCount} | ${data.stats.activeAfterFull} | 削除スコア ≥${ARCHIVE_SCORE_THRESHOLD} をすべて除外 |`,
    `| **B: 変種のみ（推奨）** | ${data.stats.archiveVariantCount} | ${data.stats.activeAfterVariant} | q変種・ペルソナ変種のみ除外（canonical / SEED / 保持候補は残す） |`,
    "",
    "## 2. サマリー比較",
    "",
    "| 指標 | 含む（共通） | A 除外 | B 除外 |",
    "|------|-------------|--------|--------|",
    `| Help検索 平均ヒット | ${full.summary.helpAvgWith.toFixed(1)} | ${full.summary.helpAvgWithout.toFixed(1)} | ${variant.summary.helpAvgWithout.toFixed(1)} |`,
    `| Help検索 合計ヒット | ${full.summary.helpTotalWith} | ${full.summary.helpTotalWithout} | ${variant.summary.helpTotalWithout} |`,
    `| 0件キーワード | 0* | ${full.summary.zeroHitWithout} | ${variant.summary.zeroHitWithout} |`,
    `| AI top1 一致率 | — | ${pct(full.summary.aiTop1Stable, data.keywords.length)} | ${pct(variant.summary.aiTop1Stable, data.keywords.length)} |`,
    `| 品質OK率 | — | ${pct(full.summary.qualityOk, data.keywords.length)} | ${pct(variant.summary.qualityOk, data.keywords.length)} |`,
    `| 重要KW品質OK† | — | ${pct(data.priority.fullOk, data.priority.total)} | ${pct(data.priority.variantOk, data.priority.total)} |`,
    "",
    "*「含む」は全4394件が対象のため空クエリ以外はヒットあり",
    "†重要KW = 会員登録・料金・AI・規約等24語（Featured/SEED系）",
    "",
    "### 品質判定基準",
    "",
    "- **Help検索:** `PlatformQaData.searchArticles` と同一スコアリング",
    `- **AI検索:** \`PlatformQaAiBridge.searchHits\` と同一（top ${AI_MAX_HITS} 件）`,
    "- **品質OK:** 除外後ヒット ≥1、かつ AI top1 が不変、または非 Archive 記事へ keep スコア同等以上で遷移",
    "",
    "## 3. 判定",
    "",
  ];

  if (variant.summary.zeroHitWithout === 0 && variant.summary.qualityOk >= data.keywords.length * 0.95) {
    lines.push(
      "✅ **シナリオB（変種のみ Archive）では検索品質は低下していません。** 推奨整理方針どおり q 変種を除いても代表キーワードの検索は維持されます。",
    );
  } else if (
    data.priority.variantOk === data.priority.total &&
    variant.rows.filter((r) => r.hitsWithout === 0 && r.hitsWith > 0).length === 0
  ) {
    lines.push(
      `✅ **重要キーワードは品質維持（${data.priority.variantOk}/${data.priority.total}）。** シナリオBで Archive 起因の0件化はありません。カタログ未収録のニッチ語のみ要確認。`,
    );
  } else {
    lines.push("⚠️ **シナリオBでも要確認キーワードあり。** §5 を参照してください。");
  }

  if (full.summary.zeroHitWithout > 20) {
    lines.push(
      "",
      "ℹ️ シナリオA（フル自動候補）は **一括 Archive には不向き** です。canonical まで除外されるため TLV/Talk 等が0件になります。段階的な変種整理（シナリオB）を推奨します。",
    );
  }

  lines.push(
    "",
    `- シナリオB 平均ヒット減: **${(variant.summary.helpAvgWith - variant.summary.helpAvgWithout).toFixed(1)} 件/クエリ**`,
    `- シナリオA 平均ヒット減: **${(full.summary.helpAvgWith - full.summary.helpAvgWithout).toFixed(1)} 件/クエリ**`,
    "",
    "## 4. シナリオB — 全キーワード比較",
    "",
    "| # | キーワード | 含む | 除外 | Δ | AI top1一致 | 除外後top1 | 品質 |",
    "|---|------------|------|------|---|-------------|------------|------|",
  );

  variant.rows.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.query} | ${r.hitsWith} | ${r.hitsWithout} | ${r.delta} | ${r.aiTop1Stable ? "✓" : "✗"} | ${r.aiTopWithout || "—"} | ${r.qualityOk ? "OK" : "要確認"} |`,
    );
  });

  lines.push("", "## 5. シナリオB — 要注意キーワード", "");
  const risksB = variant.rows.filter(
    (r) => r.hitsWithout === 0 && r.hitsWith > 0,
  );
  if (!risksB.length) lines.push("- （なし）");
  else {
    lines.push("| キーワード | 含む | 除外 | AI top1（含む→除外） |");
    lines.push("|------------|------|------|----------------------|");
    for (const r of risksB) {
      lines.push(`| ${r.query} | ${r.hitsWith} | ${r.hitsWithout} | ${r.aiTopWith || "—"} → ${r.aiTopWithout || "—"} |`);
    }
  }

  lines.push("", "## 6. シナリオA vs B 差分（ヒット数が大きく異なる語）", "");
  const diffs = variant.rows
    .map((vb, i) => ({
      query: vb.query,
      fullHits: full.rows[i].hitsWithout,
      variantHits: vb.hitsWithout,
      gap: vb.hitsWithout - full.rows[i].hitsWithout,
    }))
    .filter((r) => r.gap !== 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 15);
  if (!diffs.length) lines.push("- （同一）");
  else {
    lines.push("| キーワード | A除外後 | B除外後 | B−A |");
    lines.push("|------------|---------|---------|-----|");
    for (const r of diffs) lines.push(`| ${r.query} | ${r.fullHits} | ${r.variantHits} | ${r.gap} |`);
  }

  lines.push("", "## 7. Archive 候補内訳（シナリオA）", "");
  lines.push("| 区分 | 件数 |");
  lines.push("|------|------|");
  for (const [k, v] of Object.entries(data.stats.archiveBreakdown)) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push("", "## 8. 次ステップ（削除なし）", "");
  lines.push("1. シナリオB（変種のみ）で curation UI から段階 archive");
  lines.push("2. 8788 で Help 検索・AI 相談の実機確認");
  lines.push("3. §5 の要確認語のみ人手レビュー");
  lines.push("4. 問題なければ 30 日後 delete（既存フロー）");
  lines.push("", "---", "", `詳細 JSON: \`reports/help-qa-archive-search-impact.json\``);

  return lines.join("\n");
}

function main() {
  const articles = loadArticles();
  const searchKeywords = loadKeywords();
  const dup = buildDuplicateIndex(articles);

  const archiveSlugs = new Set();
  const deleteScores = new Map();
  const keepScores = new Map();
  const archiveBreakdown = {
    "question-variant": 0,
    "persona-variant": 0,
    canonical: 0,
    "priority-category-held": 0,
    "seed-held": 0,
  };

  for (const article of articles) {
    const dupReasons = [...(dup.slugReasons.get(article.slug) || [])];
    const qualityIssues = analyzeLowQuality(article);
    const delScore = scoreDeleteCandidate(article, dupReasons, qualityIssues);
    const keepScore = scoreKeepCandidate(article);
    deleteScores.set(article.slug, delScore);
    keepScores.set(article.slug, keepScore);

    if (delScore >= ARCHIVE_SCORE_THRESHOLD) {
      archiveSlugs.add(article.slug);
      const pattern = classifySlugPattern(article.slug);
      if (pattern === "question-variant") archiveBreakdown["question-variant"] += 1;
      else if (pattern === "persona-variant") archiveBreakdown["persona-variant"] += 1;
      else archiveBreakdown.canonical += 1;
      if (PRIORITY_KEEP_CATEGORIES.has(article.category)) archiveBreakdown["priority-category-held"] += 1;
      if (SEED_SLUGS.has(article.slug) || SEED_SLUGS.has(topicKeyFromSlug(article.slug))) {
        archiveBreakdown["seed-held"] += 1;
      }
    }
  }

  const { full: archiveFull, variantOnly: archiveVariant } = buildArchiveSets(
    articles,
    deleteScores,
    keepScores,
  );

  const keywords = pickRepresentativeKeywords(articles, searchKeywords, keepScores);
  const fullResult = evaluateScenario(articles, searchKeywords, archiveFull, keywords, keepScores);
  const variantResult = evaluateScenario(articles, searchKeywords, archiveVariant, keywords, keepScores);

  const priorityRows = variantResult.rows.filter((r) => PRIORITY_QUERIES.has(r.query));
  const priority = {
    total: priorityRows.length,
    fullOk: fullResult.rows.filter((r) => PRIORITY_QUERIES.has(r.query) && r.qualityOk).length,
    variantOk: priorityRows.filter((r) => r.qualityOk).length,
  };

  const data = {
    generatedAt: new Date().toISOString(),
    archiveScoreThreshold: ARCHIVE_SCORE_THRESHOLD,
    stats: {
      totalArticles: articles.length,
      archiveFullCount: archiveFull.size,
      archiveVariantCount: archiveVariant.size,
      activeAfterFull: articles.length - archiveFull.size,
      activeAfterVariant: articles.length - archiveVariant.size,
      archiveBreakdown,
    },
    keywords,
    priority: {
      queries: [...PRIORITY_QUERIES],
      ...priority,
    },
    scenarios: {
      full: fullResult,
      variantOnly: variantResult,
    },
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(REPORT_MD, buildMarkdownReport(data), "utf8");

  console.log(`Archive search impact report written:\n  ${REPORT_MD}\n  ${REPORT_JSON}`);
  console.log(
    `\nKeywords: ${keywords.length}`,
  );
  console.log(
    `Scenario A (full): archive ${archiveFull.size} · quality ${fullResult.summary.qualityOk}/${keywords.length} · zero-hit ${fullResult.summary.zeroHitWithout}`,
  );
  console.log(
    `Scenario B (variant): archive ${archiveVariant.size} · quality ${variantResult.summary.qualityOk}/${keywords.length} · zero-hit ${variantResult.summary.zeroHitWithout}`,
  );
  console.log(`Priority keywords OK: A=${priority.fullOk}/${priority.total} B=${priority.variantOk}/${priority.total}`);
}

main();
