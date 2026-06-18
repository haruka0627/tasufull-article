/**
 * TASFUL OPS WATCH Phase1 — AI要約優先・新サービス検出（厳格）・テンプレートフォールバック
 */
(function (global) {
  "use strict";

  const VALID_IMPORTANCE = new Set(["high", "medium", "low"]);

  const REPORT_FALLBACK = Object.freeze({
    summary: "情報を取得しましたが、要約を生成できませんでした。",
    tasfulImpact: "現時点でTASFULへの直接的な影響は確認されていません。",
    recommendedAction: "監視継続",
  });

  const ALLOWED_ACTIONS = Object.freeze([
    "対応不要",
    "監視継続",
    "規約確認",
    "コスト確認",
    "システム改修検討",
    "FAQ更新",
    "運営周知",
    "Connect設定確認",
  ]);

  /** カテゴリ別 — TASFUL影響の優先テンプレ */
  const CATEGORY_TASFUL_IMPACT = Object.freeze({
    openai:
      "OpenAI API・モデル・料金変更は、AIワークスペース・TALK AI下書き・検索オーケストレータのコストと品質に直結します。",
    claude:
      "Claude API・料金・利用規約の変更は、AIモデルゲートウェイと運営分析フローへの影響を確認してください。",
    gemini:
      "Gemini / Google AI の変更は、デフォルトAIモデル・プラン制限・検索連携に影響する可能性があります。",
    stripe:
      "Stripe の手数料・Checkout・決済ポリシー変更は、TASFULの収益・返金・チャージバック対応に影響します。",
    stripe_connect:
      "Stripe Connect（本人確認・出金・オンボーディング）の変更は、Builder・出品者のConnectトラブルに直結します。",
    cloudflare:
      "Cloudflare の障害・料金・Workers変更は、静的配信・WAF・Edge依存の可用性に影響します。",
    supabase:
      "Supabase の料金・RLS・認証変更は、TALK同期・チャット・OPSデータ基盤に影響する可能性があります。",
  });

  const TASFUL_TOPIC_RULES = Object.freeze([
    {
      re: /stripe connect|connect onboarding|connect express|payout|本人確認/i,
      impact:
        "Stripe Connect（出品者本人確認・出金・オンボーディング）に関する情報です。ConnectトラブルセンターとBuilder出品フローを優先確認してください。",
      action: "Connect設定確認",
    },
    {
      re: /stripe|checkout|payment|決済|chargeback|手数料|fee/i,
      impact:
        "決済・手数料・Checkout に関する情報です。TASFULの収益モデル・返金・チャージバック手順への影響を確認してください。",
      action: "コスト確認",
    },
    {
      re: /openai|chatgpt|gpt-[\d]|o1|o3/i,
      impact:
        "OpenAI 関連の変更は、AIワークスペース・TALK AI・検索オーケストレータのモデルコストと品質に影響する可能性があります。",
      action: "コスト確認",
    },
    {
      re: /gemini|google ai|vertex/i,
      impact:
        "Google Gemini 関連は、デフォルトAIモデル・プラン制限・検索連携への影響を確認してください。",
      action: "コスト確認",
    },
    {
      re: /claude|anthropic/i,
      impact:
        "Claude / Anthropic 関連は、AIモデルゲートウェイと運営分析のコスト・規約に影響する可能性があります。",
      action: "規約確認",
    },
    {
      re: /cloudflare|workers|turnstile|cdn|waf/i,
      impact:
        "Cloudflare 関連は、サイト配信・セキュリティ・Edge依存の可用性に影響する可能性があります。",
      action: "システム改修検討",
    },
    {
      re: /supabase|postgres|rls|realtime/i,
      impact:
        "Supabase 関連は、認証・DB・TALK同期・OPS読み書き基盤に影響する可能性があります。",
      action: "システム改修検討",
    },
    {
      re: /\bline\b|line notify|line login/i,
      impact: "LINE 連携・通知・ログインに影響する可能性があります。会員連絡フローを確認してください。",
      action: "運営周知",
    },
    {
      re: /google|android|play store/i,
      impact: "Google / Android 関連は、検索・認証・ストアポリシーに影響する可能性があります。",
      action: "規約確認",
    },
    {
      re: /apple|app store|ios/i,
      impact: "Apple / App Store 関連は、iOS配信・課金・審査ポリシーに影響する可能性があります。",
      action: "規約確認",
    },
    {
      re: /法改正|個人情報|プライバシー|gdpr|個人情報保護/i,
      impact:
        "法改正・個人情報保護に関する情報です。会員データ・掲載・決済のコンプライアンス影響を確認してください。",
      action: "規約確認",
    },
    {
      re: /生成ai|ai規制|人工知能|ai act/i,
      impact:
        "AI関連の規制・ガイドラインは、TASFULのAI機能・掲載ガイド・運営方針に影響する可能性があります。",
      action: "運営周知",
    },
    {
      re: /outage|障害|incident|停止|downtime/i,
      impact:
        "障害・インシデント情報です。TASFULが依存する外部サービスの可用性を優先確認してください。",
      action: "運営周知",
    },
  ]);

  /** 記事タイトル・見出しとして扱わないフレーズ（部分一致で除外） */
  const HEADLINE_BLOCK_PHRASES = [
    "our top product updates",
    "top product updates",
    "product updates",
    "sessions 2025",
    "sessions 2026",
    "api pricing",
    "release notes",
    "user terms",
    "terms update",
    "pricing updates",
    "pricing explained",
    "complete guide",
    "changelog",
    "what's new",
    "whats new",
    "blog",
    " docs",
    "documentation",
    "announcement",
    "announces new api",
    "pricing -",
    "pricing |",
    "news",
    "support.stripe",
    "community forum",
    "compared",
    "guide to",
  ];

  const INVALID_SERVICE_NAMES = new Set([
    "march",
    "april",
    "may",
    "june",
    "july",
    "for",
    "the",
    "and",
    "new",
    "api",
    "pricing",
    "compare",
    "guide",
    "timeline",
    "regional",
    "processing",
  ]);

  const GENERIC_TITLE_WORDS = new Set([
    "our",
    "the",
    "top",
    "product",
    "updates",
    "from",
    "session",
    "sessions",
    "api",
    "pricing",
    "release",
    "notes",
    "blog",
    "docs",
    "documentation",
    "terms",
    "changelog",
    "news",
    "guide",
    "complete",
    "explained",
    "announces",
    "announcement",
    "new",
    "update",
    "updated",
    "2025",
    "2026",
  ]);

  const LAUNCH_CONTEXT_RE =
    /新サービス|新機能|新モデル|新AI|新 API|ローンチ|発表|リリース|ベータ|preview|announc|launched|launch(?:es|ed)?|released|release[sd]?|new model|new ai|introducing/i;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeImportance(v, fallback) {
    const x = String(v || "").toLowerCase();
    return VALID_IMPORTANCE.has(x) ? x : fallback || "medium";
  }

  function analysisSourceLabel(source) {
    return String(source || "").toLowerCase() === "ai" ? "AI" : "template fallback";
  }

  function extractJsonObject(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  function isValidAiAnalysis(row) {
    return Boolean(row && pickStr(row.headline) && pickStr(row.summary));
  }

  function normalizeText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function wordCount(name) {
    return normalizeText(name).split(" ").filter(Boolean).length;
  }

  function isHeadlineLikeName(name) {
    const n = normalizeText(name);
    if (!n || n.length < 2) return true;
    if (n.length > 36) return true;
    if (wordCount(name) > 4) return true;

    for (let i = 0; i < HEADLINE_BLOCK_PHRASES.length; i += 1) {
      if (n.includes(HEADLINE_BLOCK_PHRASES[i])) return true;
    }

    const words = n.split(" ").filter(Boolean);
    if (!words.length) return true;
    const genericRatio = words.filter((w) => GENERIC_TITLE_WORDS.has(w)).length / words.length;
    if (words.length >= 3 && genericRatio >= 0.6) return true;

    if (/^(how|what|why|the complete|top \d|all \d)/i.test(name)) return true;
    return false;
  }

  function matchesAnyResultTitle(name, results) {
    const key = normalizeText(name);
    return (results || []).some((r) => {
      const title = normalizeText(r?.title);
      if (!title) return false;
      if (title === key) return true;
      if (key.length >= 12 && title.includes(key)) return true;
      if (title.length >= 12 && key.includes(title)) return true;
      return false;
    });
  }

  function countResultMentions(name, results) {
    const key = normalizeText(name);
    if (!key) return 0;
    let count = 0;
    (results || []).forEach((r) => {
      const blob = normalizeText(`${r?.snippet || ""} ${r?.url || ""}`);
      const title = normalizeText(r?.title || "");
      if (blob.includes(key) || (key.length >= 4 && title.includes(key))) {
        count += 1;
      }
    });
    return count;
  }

  function hasLaunchContextForName(name, results) {
    const key = normalizeText(name);
    return (results || []).some((r) => {
      const blob = `${r?.title || ""} ${r?.snippet || ""}`;
      if (!LAUNCH_CONTEXT_RE.test(blob)) return false;
      if (!key) return true;
      return normalizeText(blob).includes(key) || LAUNCH_CONTEXT_RE.test(blob);
    });
  }

  function buildKnownSet(category) {
    const Store = global.TasuOpsWatchStore;
    const known = new Set(
      (Store?.readKnownServices?.() || []).map((s) => normalizeText(s))
    );
    (category?.aliases || []).forEach((a) => known.add(normalizeText(a)));
    if (category?.label) known.add(normalizeText(category.label));
    return known;
  }

  /**
   * 固有名詞らしい短い名前のみ許可
   */
  function validateNewServiceName(name, category, results) {
    const label = pickStr(name);
    if (!label) return { ok: false, reason: "empty" };

    if (isHeadlineLikeName(label)) return { ok: false, reason: "headline_like" };
    if (matchesAnyResultTitle(label, results)) return { ok: false, reason: "is_article_title" };

    const known = buildKnownSet(category);
    if (known.has(normalizeText(label))) return { ok: false, reason: "known" };
    if (INVALID_SERVICE_NAMES.has(normalizeText(label))) return { ok: false, reason: "generic_token" };
    if (/^\d+$/.test(normalizeText(label))) return { ok: false, reason: "numeric" };

    const mentions = countResultMentions(label, results);
    if (mentions < 2) return { ok: false, reason: "single_mention" };

    if (!hasLaunchContextForName(label, results)) {
      return { ok: false, reason: "no_launch_context" };
    }

    return { ok: true, name: label };
  }

  function sanitizeNewServiceFields(row, category, results) {
    const out = { ...row };
    const proposed = pickStr(out.newServiceName, out.new_service_name);
    const validated = validateNewServiceName(proposed, category, results);
    if (validated.ok && (out.isNewService || out.is_new_service)) {
      out.isNewService = true;
      out.newServiceName = validated.name;
      if (!pickStr(out.introductionProposal, out.introduction_proposal)) {
        out.introductionProposal =
          `【導入提案】${validated.name} が複数ソースで新規 AI/サービスとして言及されています。` +
          `TASFULの ${category.label} 領域（${category.tasfulRelevance || ""}）で POC を検討し、コスト・規約を確認してください。`;
      }
    } else {
      out.isNewService = false;
      out.newServiceName = "";
      if (!validated.ok && proposed) {
        out.introductionProposal = "";
      }
    }
    return out;
  }

  function extractBrandCandidatesFromSnippets(results) {
    /** @type {Map<string, { count: number, display: string }>} */
    const counts = new Map();
    const re = /\b([A-Z][a-z0-9]{1,18}(?:\s+[A-Z][a-z0-9]{1,14}){0,1}(?:\s+AI)?)\b/g;

    (results || []).forEach((r) => {
      const snippet = String(r?.snippet || "");
      let m;
      while ((m = re.exec(snippet)) !== null) {
        const token = pickStr(m[1]);
        if (!token || token.length < 3) continue;
        const key = normalizeText(token);
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { count: 1, display: token });
      }
    });

    return [...counts.values()]
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count)
      .map((v) => v.display);
  }

  function detectNewServiceHeuristic(category, results) {
    const candidates = extractBrandCandidatesFromSnippets(results);
    for (const name of candidates) {
      const v = validateNewServiceName(name, category, results);
      if (v.ok) {
        return {
          isNewService: true,
          newServiceName: v.name,
          introductionProposal:
            `【導入提案】${v.name} が検索スニペットで複数回検出されました。` +
            `TASFULの ${category.label} 連携（${category.tasfulRelevance || ""}）で POC 検討を推奨します。`,
        };
      }
    }
    return { isNewService: false, newServiceName: "", introductionProposal: "" };
  }

  function combinedResultText(results) {
    return (results || [])
      .map((r) => `${r?.title || ""} ${r?.snippet || ""}`)
      .join(" ")
      .toLowerCase();
  }

  function isWeakFieldText(text, minLen) {
    const s = pickStr(text);
    if (!s) return true;
    if (s.length < (minLen || 10)) return true;
    if (s === "（なし）" || s === "(なし)") return true;
    return false;
  }

  function matchAllowedAction(raw) {
    const s = pickStr(raw);
    if (!s) return "";
    for (let i = 0; i < ALLOWED_ACTIONS.length; i += 1) {
      const label = ALLOWED_ACTIONS[i];
      if (s === label || s.startsWith(`${label} `) || s.startsWith(`${label}（`)) {
        return label;
      }
      if (s.includes(label)) return label;
    }
    return "";
  }

  function inferRecommendedAction(category, importance, text, existing) {
    const matched = matchAllowedAction(existing);
    if (matched) return matched;

    const t = String(text || "").toLowerCase();
    const imp = normalizeImportance(importance, "medium");

    for (let i = 0; i < TASFUL_TOPIC_RULES.length; i += 1) {
      const rule = TASFUL_TOPIC_RULES[i];
      if (rule.re.test(t) && rule.action) return rule.action;
    }
    if (category?.id && CATEGORY_TASFUL_IMPACT[category.id]) {
      if (/pricing|料金|fee|price/i.test(t)) return "コスト確認";
      if (/terms|規約|policy|利用規約/i.test(t)) return "規約確認";
    }
    if (/outage|障害|incident|停止/i.test(t)) {
      return imp === "high" ? "運営周知" : "監視継続";
    }
    if (/pricing|料金|fee|値上げ/i.test(t)) return "コスト確認";
    if (/terms|規約|policy/i.test(t)) return "規約確認";
    if (/faq|help center|サポート/i.test(t)) return "FAQ更新";
    if (imp === "high") return "運営周知";
    if (imp === "low") return "対応不要";

    return REPORT_FALLBACK.recommendedAction;
  }

  function buildTasfulImpact(category, results, existing) {
    const current = pickStr(existing);
    if (!isWeakFieldText(current, 16)) return current;

    const text = combinedResultText(results);
    const catId = String(category?.id || "");

    for (let i = 0; i < TASFUL_TOPIC_RULES.length; i += 1) {
      const rule = TASFUL_TOPIC_RULES[i];
      if (rule.re.test(text) && rule.impact) return rule.impact;
    }

    if (catId && CATEGORY_TASFUL_IMPACT[catId]) {
      const rel = pickStr(category?.tasfulRelevance);
      if (results.length) {
        return `${CATEGORY_TASFUL_IMPACT[catId]}${rel ? `（領域: ${rel}）` : ""}`;
      }
      return CATEGORY_TASFUL_IMPACT[catId];
    }

    const rel = pickStr(category?.tasfulRelevance);
    if (rel && results.length) {
      return `${rel}。記事内容を公式情報と突合し、TASFULの該当機能への影響有無を判断してください。`;
    }

    return REPORT_FALLBACK.tasfulImpact;
  }

  function buildSummaryFromResults(results, existing) {
    const current = pickStr(existing);
    if (!isWeakFieldText(current, 12)) return current;

    if (results.length) {
      const top = results[0];
      const snippet = pickStr(top?.snippet).replace(/\s+/g, " ").slice(0, 220);
      const title = pickStr(top?.title);
      if (snippet.length >= 24) {
        return `Web検索で ${results.length} 件を取得。${snippet}`;
      }
      if (title) {
        return `Web検索で ${results.length} 件を取得。「${title}」について公式情報で内容を確認してください。`;
      }
      return `Web検索で ${results.length} 件を取得。詳細は参照リンクを確認してください。`;
    }

    return REPORT_FALLBACK.summary;
  }

  /**
   * 概要・影響・推奨アクションを必須化（空欄禁止）
   * @param {object} row
   * @param {object} category
   * @param {{ results?: object[] }} [prep]
   */
  function ensureReportQuality(row, category, prep) {
    const results = prep?.results || row?.sources || [];
    const text = combinedResultText(results);
    const base = row && typeof row === "object" ? row : {};

    return {
      ...base,
      headline: pickStr(base.headline) || `${category?.label || "監視"}: レポート`,
      summary: buildSummaryFromResults(results, base.summary),
      tasfulImpact: buildTasfulImpact(category, results, base.tasfulImpact),
      recommendedAction: inferRecommendedAction(
        category,
        base.importance,
        text,
        base.recommendedAction
      ),
      importance: normalizeImportance(base.importance, "medium"),
    };
  }

  function buildAnalysisPrompt(category, prep) {
    const Cats = global.TasuOpsWatchCategories;
    const results = prep?.results || [];
    const lines = results.map((r, i) => {
      return `${i + 1}. ${r.title}\nURL: ${r.url}\n${r.snippet}`;
    });
    return [
      "あなたはTASFULのAI運営秘書です。ひろき（経営者）向けに、外部サービスの動向を「TASFUL運営への影響」として分析してください。",
      "単なるニュース要約は禁止。必ず TASFUL の事業・システムへの影響判断を書くこと。",
      "",
      `監視カテゴリ: ${category.label}`,
      `TASFULとの関連: ${category.tasfulRelevance || ""}`,
      Cats?.TASFUL_CONTEXT || "",
      "",
      "【優先的に影響分析するトピック】",
      "Stripe Connect / OpenAI / Gemini / Claude / Cloudflare / Supabase / LINE / Google / Apple /",
      "法改正 / 決済 / 個人情報保護 / 生成AI規制",
      "",
      `検索クエリ: ${prep?.searchQuery || category.searchQuery}`,
      "",
      "【Web検索結果】",
      lines.length ? lines.join("\n\n") : "（検索結果なし）",
      "",
      "【必須フィールド — 空文字・null 禁止】",
      "- summary: 3〜5文の概要（取得できない場合も運営向けに文章を書く）",
      "- tasfulImpact: TASFULへの影響（影響が薄い場合も「現時点で直接的影響は限定的」と明記）",
      '- recommendedAction: 次のいずれか1つを必ず選ぶ — 対応不要 / 監視継続 / 規約確認 / コスト確認 / システム改修検討 / FAQ更新 / 運営周知 / Connect設定確認',
      "",
      "【重要ルール】",
      "- 記事タイトル・ニュース見出し（例: Our top product updates, Sessions 2025, API Pricing）は newServiceName にしない",
      "- newServiceName は固有名詞の短いサービス/AI名のみ（2語以内推奨）。複数結果で言及がある場合のみ isNewService=true",
      "",
      "次のJSONのみを出力:",
      "{",
      '  "headline": "40字以内",',
      '  "summary": "3〜5文の概要（必須）",',
      '  "importance": "high|medium|low",',
      '  "tasfulImpact": "TASFUL運営への影響（必須）",',
      '  "recommendedAction": "上記リストから1つ（必須）",',
      '  "isNewService": false,',
      '  "newServiceName": "",',
      '  "introductionProposal": ""',
      "}",
    ].join("\n");
  }

  function rowToAnalysis(raw, category, results, analysisSource) {
    const sanitized = sanitizeNewServiceFields(
      ensureReportQuality(
        {
          headline: pickStr(raw?.headline),
          summary: pickStr(raw?.summary),
          importance: normalizeImportance(raw?.importance, "medium"),
          tasfulImpact: pickStr(raw?.tasfulImpact, raw?.tasful_impact),
          recommendedAction: pickStr(raw?.recommendedAction, raw?.recommended_action),
          isNewService: Boolean(raw?.isNewService ?? raw?.is_new_service),
          newServiceName: pickStr(raw?.newServiceName, raw?.new_service_name),
          introductionProposal: pickStr(raw?.introductionProposal, raw?.introduction_proposal),
        },
        category,
        { results }
      ),
      category,
      results
    );

    if (sanitized.isNewService && sanitized.newServiceName) {
      global.TasuOpsWatchStore?.addKnownService?.(sanitized.newServiceName);
    }

    return {
      headline: sanitized.headline,
      summary: sanitized.summary,
      importance: sanitized.importance,
      tasfulImpact: sanitized.tasfulImpact,
      recommendedAction: sanitized.recommendedAction,
      isNewService: sanitized.isNewService,
      newServiceName: sanitized.newServiceName,
      introductionProposal: sanitized.introductionProposal,
      analysisSource,
      analyzerProvider: analysisSource === "ai" ? "ai" : "template",
    };
  }

  async function callAiJsonAnalysis(category, prep, modeId, systemPrompt) {
    const prompt =
      modeId === "ops-watch-search-fallback"
        ? prep._failurePrompt
        : buildAnalysisPrompt(category, prep);

    try {
      const turn = await global.TasuAiModelGateway?.completeTurn?.({
        userText: prompt,
        modeId: modeId || "ops-watch-analyze",
        systemPrompt:
          systemPrompt ||
          "TASFUL OPS WATCH。経営者向け。JSONのみ返す。記事タイトルをサービス名にしない。",
        skipSearch: true,
        surface: "ops_watch",
        mockFallback: () => "",
      });
      const aiRow = extractJsonObject(turn?.reply);
      if (!isValidAiAnalysis(aiRow)) return null;
      return rowToAnalysis(aiRow, category, prep?.results || [], "ai");
    } catch (err) {
      console.warn("[TasuOpsWatchAnalyzer] AI analyze failed:", err);
      return null;
    }
  }

  function searchFailureLabel(message) {
    const m = String(message || "").toLowerCase();
    if (m.includes("cors")) return "CORS / ネットワーク";
    if (m.includes("not_configured")) return "Supabase 未設定";
    if (m.includes("network")) return "ネットワークエラー";
    return "Web検索エラー";
  }

  function templateAnalyze(category, prep) {
    const results = prep?.results || [];
    const text = results.map((r) => `${r.title} ${r.snippet}`).join(" ").toLowerCase();
    const infraCats = new Set(["stripe", "stripe_connect", "cloudflare", "supabase"]);

    let importance = "low";
    if (
      /outage|障害|停止|セキュリティ|漏洩|breach|価格改定|値上げ|fee increase|deprecated|廃止/i.test(text)
    ) {
      importance = "high";
    } else if (
      /pricing|料金|api|release|新機能|policy|規約|connect|payout/i.test(text) ||
      results.length >= 3
    ) {
      importance = "medium";
    }
    if (infraCats.has(category.id) && /outage|障害|incident|major/i.test(text)) {
      importance = "high";
    }

    const top = results[0];
    const headline = top?.title
      ? `${category.label}: ${String(top.title).slice(0, 36)}`
      : `${category.label}: 直近の公開情報を確認`;

    const summary = results.length
      ? `Web検索で ${results.length} 件を取得。${pickStr(top?.snippet).slice(0, 160) || "概要はリンク先で確認が必要です。"}`
      : `${category.label} について直近ニュースを取得できませんでした。公式情報を手動確認してください。`;

    const novelty = detectNewServiceHeuristic(category, results);
    if (novelty.isNewService && novelty.newServiceName) {
      importance = importance === "low" ? "medium" : importance;
    }

    let recommendedAction = inferRecommendedAction(category, importance, text, "");
    if (importance === "high" && recommendedAction === "監視継続") {
      recommendedAction = "運営周知";
    }

    return rowToAnalysis(
      {
        headline,
        summary,
        importance,
        tasfulImpact: buildTasfulImpact(category, results, ""),
        recommendedAction,
        isNewService: novelty.isNewService,
        newServiceName: novelty.newServiceName,
        introductionProposal: novelty.introductionProposal,
      },
      category,
      results,
      "template"
    );
  }

  async function analyzeSearchFailure(category, prep) {
    const errMsg = pickStr(prep?.searchMessage, prep?.searchError) || "search_failed";
    const errLabel = searchFailureLabel(errMsg);

    const failurePrompt = [
      "TASFUL OPS WATCH — Web検索は失敗しましたが、経営者向けフォールバック通知をJSONで生成してください。",
      `カテゴリ: ${category.label}`,
      `失敗理由: ${errLabel} (${errMsg})`,
      `TASFUL関連: ${category.tasfulRelevance || ""}`,
      '{"headline":"","summary":"","importance":"medium","tasfulImpact":"","recommendedAction":"","isNewService":false,"newServiceName":"","introductionProposal":""}',
    ].join("\n");

    const aiPrep = { ...prep, results: [], _failurePrompt: failurePrompt };
    const aiResult = await callAiJsonAnalysis(
      category,
      aiPrep,
      "ops-watch-search-fallback",
      "検索なし。JSONのみ。isNewServiceはfalse。"
    );
    if (aiResult) return aiResult;

    return rowToAnalysis(
      {
        headline: `【検索未接続】${category.label}`,
        summary: `${category.label} の Web 検索に失敗（${errLabel}）。公式ブログ・ステータスを手動確認してください。`,
        importance: /cors|network|not_configured/i.test(errMsg) ? "medium" : "low",
        tasfulImpact: buildTasfulImpact(category, [], ""),
        recommendedAction: "システム改修検討",
        isNewService: false,
        newServiceName: "",
        introductionProposal: "",
      },
      category,
      [],
      "template"
    );
  }

  /**
   * @param {object} category
   * @param {object} prep
   */
  async function analyze(category, prep) {
    const searchFailed =
      prep?.searchFailed === true ||
      (prep?.fallback_used === true && !(prep?.results || []).length);
    if (searchFailed) {
      return analyzeSearchFailure(category, prep);
    }

    const aiResult = await callAiJsonAnalysis(category, prep, "ops-watch-analyze");
    if (aiResult) return aiResult;

    return templateAnalyze(category, prep);
  }

  global.TasuOpsWatchAnalyzer = {
    analyze,
    analyzeSearchFailure,
    templateAnalyze,
    callAiJsonAnalysis,
    buildAnalysisPrompt,
    ensureReportQuality,
    buildSummaryFromResults,
    buildTasfulImpact,
    inferRecommendedAction,
    REPORT_FALLBACK,
    ALLOWED_ACTIONS,
    extractJsonObject,
    detectNewServiceHeuristic,
    validateNewServiceName,
    isHeadlineLikeName,
    normalizeImportance,
    searchFailureLabel,
    analysisSourceLabel,
    HEADLINE_BLOCK_PHRASES,
  };
})(typeof window !== "undefined" ? window : globalThis);
