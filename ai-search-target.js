/**
 * AIワークスペース — 検索対象（TASFUL内 / Web / 両方）
 * 利用者が明示的に選択。AIによる自動判定は行わない。
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasu_ai_search_target";

  const TARGETS = {
    TASFUL: "tasful",
    WEB: "web",
    BOTH: "both",
  };

  const DEFAULT_TARGET = TARGETS.TASFUL;

  const LABELS = {
    tasful: "TASFUL内",
    web: "Web",
    both: "TASFUL内 + Web",
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeTarget(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === TARGETS.WEB || v === TARGETS.BOTH) return v;
    return TARGETS.TASFUL;
  }

  function getLabel(target) {
    return LABELS[normalizeTarget(target)] || LABELS.tasful;
  }

  function buildSourceLabelPlain(target) {
    return `検索元: ${getLabel(target)}`;
  }

  function buildSourceLabelHtml(target) {
    const label = escapeHtml(buildSourceLabelPlain(target));
    return `<p class="ai-search-source-label" data-ai-search-source>${label}</p>`;
  }

  function preserveModelMeta(source, next) {
    return {
      ...next,
      model_id: source?.model_id || next?.model_id || "",
      model_label: source?.model_label || next?.model_label || "",
      model_provider: source?.model_provider || next?.model_provider || "",
    };
  }

  const RESULT_SECTION_TITLES = {
    tasful_candidates: "TASFUL内の候補",
    tasful_ai: "AI検索結果",
    web: "Web検索結果",
  };

  function stripWebSearchBadge(html) {
    return String(html || "")
      .replace(/<p class="ai-search-used-badge"[^>]*>[\s\S]*?<\/p>/gi, "")
      .trim();
  }

  function hasTasfulCandidates(payload) {
    const html = String(payload?.html || "");
    return html.includes("ai-cross-card") || html.includes("ai-cross-intro");
  }

  function hasHybridSections(payload) {
    return String(payload?.html || "").includes("ai-hybrid-section");
  }

  function hasResultSection(payload) {
    return String(payload?.html || "").includes("ai-search-result-section");
  }

  function buildResultSection(type, innerHtml, innerPlain) {
    const title = RESULT_SECTION_TITLES[type] || RESULT_SECTION_TITLES.tasful_ai;
    const bodyHtml = stripWebSearchBadge(innerHtml);
    const bodyPlain = String(innerPlain || "").trim();
    return {
      html:
        `<section class="ai-search-result-section ai-search-result-section--${type.replace(/_/g, "-")}">` +
        `<h3 class="ai-search-result-section__title ai-hybrid-section__title">${escapeHtml(title)}</h3>` +
        `<div class="ai-search-result-section__body">${bodyHtml}</div>` +
        `</section>`,
      plain: `【${title}】\n${bodyPlain}`,
    };
  }

  function resolveResultSectionType(target, payload) {
    const normalized = normalizeTarget(target);
    if (normalized === TARGETS.WEB) return "web";
    if (hasTasfulCandidates(payload)) return "tasful_candidates";
    return "tasful_ai";
  }

  function prependSourceLabel(payload, target) {
    if (global.TasuAiGenerateUi?.isGenerationHtml?.(payload?.html)) {
      return preserveModelMeta(payload, {
        plain: String(payload?.plain || payload?.content || "").trim(),
        html: String(payload?.html || ""),
        search_used: false,
        search_query: "",
        search_provider: "",
        search_result_count: 0,
        uiBadgeHtml: "",
        search_source: normalizeTarget(target),
      });
    }

    const normalized = normalizeTarget(target);
    const labelHtml = buildSourceLabelHtml(normalized);
    const labelPlain = buildSourceLabelPlain(normalized);
    const plain = String(payload?.plain || payload?.content || "").trim();
    let htmlBody = stripWebSearchBadge(
      payload?.html || (plain ? plain.replace(/\n/g, "<br>") : "")
    );
    const hasLabel = htmlBody.includes("ai-search-source-label");

    if (normalized === TARGETS.BOTH || hasHybridSections(payload)) {
      return preserveModelMeta(payload, {
        plain: labelPlain + (plain ? `\n\n${plain}` : ""),
        html: (hasLabel ? htmlBody : labelHtml + htmlBody),
        search_used: Boolean(payload?.search_used),
        search_query: payload?.search_query || "",
        search_provider: payload?.search_provider || "",
        search_result_count: payload?.search_result_count || 0,
        uiBadgeHtml: "",
        search_source: normalized,
      });
    }

    if (!hasResultSection(payload)) {
      const sectionType = resolveResultSectionType(normalized, { html: htmlBody, plain });
      const section = buildResultSection(sectionType, htmlBody, plain);
      htmlBody = section.html;
      const decoratedPlain = section.plain;
      return preserveModelMeta(payload, {
        plain: labelPlain + (decoratedPlain ? `\n\n${decoratedPlain}` : ""),
        html: (hasLabel ? htmlBody : labelHtml + htmlBody),
        search_used: Boolean(payload?.search_used),
        search_query: payload?.search_query || "",
        search_provider: payload?.search_provider || "",
        search_result_count: payload?.search_result_count || 0,
        uiBadgeHtml: "",
        search_source: normalized,
      });
    }

    return preserveModelMeta(payload, {
      plain: labelPlain + (plain ? `\n\n${plain}` : ""),
      html: (hasLabel ? htmlBody : labelHtml + htmlBody),
      search_used: Boolean(payload?.search_used),
      search_query: payload?.search_query || "",
      search_provider: payload?.search_provider || "",
      search_result_count: payload?.search_result_count || 0,
      uiBadgeHtml: "",
      search_source: normalized,
    });
  }

  function readStoredTarget() {
    try {
      return normalizeTarget(global.sessionStorage?.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_TARGET;
    }
  }

  function saveStoredTarget(target) {
    try {
      global.sessionStorage?.setItem(STORAGE_KEY, normalizeTarget(target));
    } catch {
      /* ignore */
    }
  }

  function applyTargetToRoot(root, target) {
    if (!root) return;
    const value = normalizeTarget(target);
    root.querySelectorAll("[data-ai-search-target-input]").forEach((input) => {
      input.checked = input.value === value;
    });
  }

  function readTargetFromRoot(root) {
    const form = root?.querySelector?.("[data-ai-chat-form]");
    const fromForm = form?.getAttribute?.("data-active-search-target");
    if (fromForm) return normalizeTarget(fromForm);
    const attr = root?.getAttribute?.("data-search-target");
    if (attr) return normalizeTarget(attr);
    const checked = root?.querySelector?.("[data-ai-search-target-input]:checked");
    if (checked) return normalizeTarget(checked.value);
    return readStoredTarget();
  }

  function syncTargetOnRoot(root, target) {
    if (!root) return;
    const value = normalizeTarget(target);
    applyTargetToRoot(root, value);
    root.setAttribute("data-search-target", value);
    const form = root.querySelector?.("[data-ai-chat-form]");
    if (form) form.setAttribute("data-active-search-target", value);
    saveStoredTarget(value);
  }

  global.TasuAiSearchTarget = {
    TARGETS,
    DEFAULT_TARGET,
    LABELS,
    normalizeTarget,
    getLabel,
    buildSourceLabelPlain,
    buildSourceLabelHtml,
    stripWebSearchBadge,
    buildResultSection,
    resolveResultSectionType,
    prependSourceLabel,
    readStoredTarget,
    saveStoredTarget,
    applyTargetToRoot,
    readTargetFromRoot,
    syncTargetOnRoot,
  };
})(typeof window !== "undefined" ? window : globalThis);
