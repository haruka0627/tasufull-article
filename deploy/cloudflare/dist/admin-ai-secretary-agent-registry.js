/**
 * AI 秘書 Phase 5-A — 19 Agent Registry（登録のみ · 実行なし）
 */
(function (global) {
  "use strict";

  const AGENTS = Object.freeze([
    { id: "architecture", label: "Architecture", cursorAgent: "architecture-agent" },
    { id: "builder", label: "Builder", cursorAgent: "builder-agent" },
    { id: "platform", label: "Platform", cursorAgent: "platform-agent" },
    { id: "tlv", label: "TLV", cursorAgent: "tlv-agent" },
    { id: "secretary", label: "Secretary", cursorAgent: "secretary-agent" },
    { id: "tasful-ai", label: "TASFUL AI", cursorAgent: "tasful-ai-agent" },
    { id: "qa", label: "QA", cursorAgent: "qa-agent" },
    { id: "review", label: "Review", cursorAgent: "review-agent" },
    { id: "release", label: "Release", cursorAgent: "release-agent" },
    { id: "docs", label: "Docs", cursorAgent: "docs-agent" },
    { id: "security", label: "Security", cursorAgent: "security-agent" },
    { id: "performance", label: "Performance", cursorAgent: "performance-agent" },
    { id: "database", label: "Database", cursorAgent: "database-agent" },
    { id: "ci", label: "CI", cursorAgent: "ci-agent" },
    { id: "product", label: "Product", cursorAgent: "product-agent" },
    { id: "prompt-ai", label: "Prompt AI", cursorAgent: "prompt-ai-agent" },
    { id: "ux-ui", label: "UX/UI", cursorAgent: "ux-ui-agent" },
    { id: "api-integration", label: "API Integration", cursorAgent: "api-integration-agent" },
    { id: "devops", label: "DevOps", cursorAgent: "devops-infra-agent" },
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(AGENTS.map((a) => [a.id, a])));

  function listAgents() {
    return AGENTS.slice();
  }

  function getAgent(id) {
    return BY_ID[String(id || "").trim()] || null;
  }

  function getDefaultAgent() {
    return BY_ID.secretary;
  }

  function resolveAgent(id) {
    return getAgent(id) || getDefaultAgent();
  }

  global.TasuSecretaryAgentRegistry = {
    AGENTS,
    listAgents,
    getAgent,
    getDefaultAgent,
    resolveAgent,
  };
})(typeof window !== "undefined" ? window : globalThis);
