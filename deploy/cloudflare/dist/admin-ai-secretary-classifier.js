/**
 * AI 秘書 Phase 5-A/B — 問い合わせ分類（regex + command + DeepSeek fallback）
 */
(function (global) {
  "use strict";

  const RULES = [
    { re: /\barchitecture\b|アーキテク|設計確認|ADR/i, agentId: "architecture", category: "architecture" },
    { re: /\bbuilder\b|ビルダー|パートナー評価|builder ai/i, agentId: "builder", category: "builder_consult" },
    { re: /\bplatform\b|プラットフォーム|掲載|市場EC|クーポン/i, agentId: "platform", category: "platform_consult" },
    { re: /\btlv\b|ライブ配信|payout|Connect payout/i, agentId: "tlv", category: "tlv_consult" },
    { re: /\bdeploy\b|デプロイ|本番反映|push/i, agentId: "release", category: "release" },
    { re: /\bbuild\b|ビルド失敗|build:pages|npm run build/i, agentId: "ci", category: "ci_failure" },
    { re: /\bsecurity\b|セキュリティ|RLS|脆弱性|secret/i, agentId: "security", category: "security_alert" },
    { re: /\bdatabase\b|\bDB\b|マイグレーション|migration|supabase schema/i, agentId: "database", category: "db_anomaly" },
    { re: /\bvision\b|プロンプト|prompt ai|AI品質|hallucination|gateway品質/i, agentId: "prompt-ai", category: "ai_quality" },
    { re: /\bUI\b|UX|画面|レスポンシブ|a11y|レイアウト/i, agentId: "ux-ui", category: "ux_ui" },
    { re: /\bdocs\b|ドキュ|CHANGELOG|ROADMAP|TODO\.md/i, agentId: "docs", category: "docs" },
    { re: /\bperformance\b|パフォーマンス|LCP|bundle|遅い/i, agentId: "performance", category: "perf_regression" },
    { re: /\bqa\b|テスト|回帰|smoke|e2e/i, agentId: "qa", category: "qa" },
    { re: /\breview\b|レビュー|diff|scope/i, agentId: "review", category: "review" },
    { re: /\brelease\b|リリース|Go\/No-Go|ステージング/i, agentId: "release", category: "release" },
    { re: /\bproduct\b|MVP|優先順位|Free\/Pro|料金/i, agentId: "product", category: "product" },
    { re: /\bapi\b|stripe|webhook|決済連携|gemini api/i, agentId: "api-integration", category: "api_integration" },
    { re: /\bdevops\b|インフラ|cloudflare|wrangler|pages function/i, agentId: "devops", category: "incident" },
    { re: /\btasful ai\b|workspace|ai-model-gateway/i, agentId: "tasful-ai", category: "ai_quality" },
    { re: /障害|incident|ダウン|outage/i, agentId: "devops", category: "incident" },
    { re: /通報|report|違反|abuse/i, agentId: "security", category: "report" },
    { re: /未対応.*問い合わせ|未対応問い合わせ|問い合わせ|inquiry|サポート|ticket/i, agentId: "secretary", category: "inquiry" },
    { re: /connect|本人確認|出金/i, agentId: "secretary", category: "inquiry" },
  ];

  const COMMAND_AGENT_HINTS = [
    { re: /返金|chargeback/i, agentId: "secretary", category: "inquiry" },
    { re: /BAN|ban/i, agentId: "security", category: "report" },
    { re: /Connect/i, agentId: "secretary", category: "inquiry" },
    { re: /通報|違反/i, agentId: "security", category: "report" },
    { re: /Builder|案件/i, agentId: "builder", category: "builder_consult" },
    { re: /未対応/i, agentId: "secretary", category: "inquiry" },
  ];

  const SEVERITY_RULES = [
    { re: /P0|critical|障害|ダウン|outage|返金|BAN|ban|法律|契約|チャージバック/i, severity: "critical" },
    { re: /通報|security|高リスク|deploy失敗|migration/i, severity: "high" },
    { re: /docs|FAQ|一般|確認方法/i, severity: "low" },
  ];

  function parseTalkOpsCommand(text) {
    const Talk = global.TasuTalkOpsAssistant;
    if (!Talk?.parseTalkOpsCommand) return null;
    try {
      return Talk.parseTalkOpsCommand(text);
    } catch {
      return null;
    }
  }

  function resolveSeverity(text) {
    const t = String(text || "");
    for (const rule of SEVERITY_RULES) {
      if (rule.re.test(t)) return rule.severity;
    }
    return "medium";
  }

  function classifyRegex(rawText) {
    const text = String(rawText || "").trim();
    if (!text) {
      return {
        ok: false,
        error: "empty",
        primaryAgentId: "secretary",
        category: "unknown",
        severity: "low",
        confidence: 0,
        matchedRule: null,
        method: "regex",
      };
    }

    for (const rule of RULES) {
      if (rule.re.test(text)) {
        return {
          ok: true,
          primaryAgentId: rule.agentId,
          category: rule.category,
          severity: resolveSeverity(text),
          confidence: 0.85,
          matchedRule: rule.re.source,
          userText: text,
          method: "regex",
        };
      }
    }

    return {
      ok: true,
      primaryAgentId: "secretary",
      category: "general",
      severity: resolveSeverity(text),
      confidence: 0.5,
      matchedRule: "default",
      userText: text,
      method: "regex",
    };
  }

  function applyCommandHints(classification, text, commandResult) {
    const out = { ...classification, commandResult: commandResult || null };
    if (!commandResult?.ok) {
      out.method = out.method || "regex";
      return out;
    }

    out.commandExtracted = Array.isArray(commandResult.rows) ? commandResult.rows.length : 0;
    for (const hint of COMMAND_AGENT_HINTS) {
      if (hint.re.test(text)) {
        out.primaryAgentId = hint.agentId;
        out.category = hint.category;
        out.confidence = Math.max(out.confidence || 0, 0.9);
        out.matchedRule = `command+${out.matchedRule || "hint"}`;
        out.method = "command+regex";
        return out;
      }
    }

    if (out.commandExtracted > 0) {
      out.confidence = Math.max(out.confidence || 0, 0.88);
      out.method = "command+regex";
    } else if (commandResult.ok) {
      out.method = "command_empty+regex";
    }
    return out;
  }

  function classifyWithCommand(rawText) {
    const text = String(rawText || "").trim();
    const commandBefore = parseTalkOpsCommand(text);
    let base = classifyRegex(text);
    base = applyCommandHints(base, text, commandBefore);
    const commandAfter = parseTalkOpsCommand(text);
    if (commandAfter?.ok && commandAfter.rows?.length && (!commandBefore?.rows?.length)) {
      base = applyCommandHints(base, text, commandAfter);
    }
    return base;
  }

  function mergeStructured(base, structured) {
    if (!structured?.ok) return base;
    return {
      ...base,
      primaryAgentId: structured.primaryAgentId || base.primaryAgentId,
      category: structured.category || base.category,
      severity: structured.severity || base.severity,
      confidence: Math.max(structured.confidence || 0, base.confidence || 0),
      matchedRule: structured.matchedRule || "deepseek_structured",
      method: "deepseek+regex",
      deepseekUsed: true,
    };
  }

  async function classifyUnified(rawText, options) {
    options = options || {};
    const text = String(rawText || "").trim();
    const commandBefore = parseTalkOpsCommand(text);
    let result = classifyWithCommand(text);

    if (options.tryDeepSeek !== false) {
      const structured = await global.TasuSecretaryDeepSeekClassifier?.classifyWithDeepSeek?.(text);
      if (structured?.ok) {
        result = mergeStructured(result, structured);
      }
    }

    const commandAfter = parseTalkOpsCommand(text);
    result = applyCommandHints(result, text, commandAfter?.ok ? commandAfter : commandBefore);
    result.commandBefore = commandBefore;
    result.commandAfter = commandAfter;
    return result;
  }

  function classify(rawText) {
    return classifyWithCommand(rawText);
  }

  global.TasuSecretaryClassifier = {
    classify,
    classifyRegex,
    classifyWithCommand,
    classifyUnified,
    parseTalkOpsCommand,
    resolveSeverity,
    RULES,
  };
})(typeof window !== "undefined" ? window : globalThis);
