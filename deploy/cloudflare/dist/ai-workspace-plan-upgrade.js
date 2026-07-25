/**
 * TASFUL AI Workspace — プラン比較・アップグレード（2カラム · 正式仕様）
 * 価格・quota: stripe-genai-config.js · AI_MEMBERSHIP_PRICING.md
 */
(function (global) {
  "use strict";

  const PLAN_ORDER = Object.freeze(["free", "lite", "pro", "max"]);

  const PLAN_RANK = Object.freeze({
    free: 0,
    lite: 1,
    pro: 2,
    max: 3,
  });

  const PLAN_LABELS = Object.freeze({
    free: "Free",
    lite: "Lite",
    pro: "Pro",
    max: "Max",
  });

  function $(sel, root) {
    return (root || global.document).querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function formatYen(amount) {
    return `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
  }

  function formatDailyLimit(value) {
    if (value == null || value === "") return "フェアユース拡張";
    const n = Number(value);
    if (!Number.isFinite(n)) return "フェアユース拡張";
    return `1日${n}回`;
  }

  function formatImageLimit(value, qualitative) {
    if (value == null || value === "") return qualitative || "少量";
    const n = Number(value);
    if (!Number.isFinite(n)) return qualitative || "少量";
    return `1日${n}回`;
  }

  function resolveAmountJpy(planKey, hydrated) {
    const n = Number(hydrated?.amountJpy);
    if (Number.isFinite(n)) return n;
    const RT = global.TasuPricingRuntime;
    const sku = RT?.BILLING_PLAN_SKU?.[planKey];
    const fromCatalog = RT?.getFixedAmount?.(sku);
    return Number.isFinite(fromCatalog) ? fromCatalog : 0;
  }

  function readPlanLimits() {
    const cfg = global.TasuStripeGenAiConfig || {};
    const RT = global.TasuPricingRuntime;
    const free = cfg.FREE_PLAN || {};
    const lite = cfg.PLANS?.genai_basic_300 || RT?.buildGenAiStripePlan?.("genai_basic_300") || {};
    const pro = cfg.PLANS?.genai_pro_980 || RT?.buildGenAiStripePlan?.("genai_pro_980") || {};
    const maxPh = cfg.MAX_PLACEHOLDER || RT?.buildGenAiMaxPlaceholder?.() || null;
    return { free, lite, pro, maxPh };
  }

  /** @returns {Record<string, object>} */
  function buildPlanCatalog() {
    const limits = readPlanLimits();
    const freeText = limits.free.dailyTextLimit;
    const liteText = limits.lite.dailyTextLimit;
    const liteImage = limits.lite.dailyImageLimit;
    const proText = limits.pro.dailyTextLimit;
    const proImage = limits.pro.dailyImageLimit;
    const litePrice = resolveAmountJpy("lite", limits.lite);
    const proPrice = resolveAmountJpy("pro", limits.pro);
    const maxPrice = resolveAmountJpy("max", limits.maxPh);
    const maxEnabled = limits.maxPh?.enabled === true;
    const liteTextLabel = formatDailyLimit(liteText);
    const proTextLabel = formatDailyLimit(proText);
    const proImageLabel = formatImageLimit(proImage, "1日30回");
    return {
      free: {
        id: "free",
        label: "Free",
        priceYen: 0,
        priceUnit: "",
        tagline: "TASFUL AIを体験できる無料プラン",
        aiModels: "Gemini（最速）",
        note: null,
        highlights: [
          "基本チャット",
          "広告あり",
          `${formatDailyLimit(freeText)}テキスト回答`,
          "Web検索（制限あり）",
          "画像生成なし",
        ],
        detailFeatures: [
          { icon: "chat", label: "テキスト回答", value: formatDailyLimit(freeText) },
          { icon: "block", label: "広告", value: "あり" },
          { icon: "travel_explore", label: "Web検索", value: "制限あり" },
          { icon: "image", label: "画像生成", value: "なし" },
          { icon: "movie", label: "動画生成", value: "なし" },
          { icon: "manage_search", label: "Deep Research", value: "なし" },
          { icon: "description", label: "ファイル解析", value: "なし" },
          { icon: "bolt", label: "優先処理", value: "なし" },
          { icon: "storefront", label: "商用利用", value: "なし" },
        ],
        ads: "あり",
        dailyTextLimit: freeText,
        isDraft: false,
      },
      lite: {
        id: "lite",
        label: "Lite",
        priceYen: litePrice,
        priceUnit: "/ 月（税込）",
        tagline: "Gemini特化・日常利用向け軽量高速プラン",
        aiModels: "Gemini",
        note: "LiteはGemini専用プランです。ChatGPTやClaudeは利用できません。",
        geminiUsage: "Gemini Flash · Gemini Pro を用途に応じて自動切替",
        highlights: [
          "Gemini特化プラン",
          "広告なし",
          `${liteTextLabel}回答`,
          `画像生成 ${formatImageLimit(liteImage, "少量")}`,
          "Web検索利用可",
          "基本ファイル解析",
          "高速応答",
        ],
        detailFeatures: [
          { icon: "hub", label: "利用AI", value: "Gemini のみ（専用プラン）" },
          { icon: "chat", label: "テキスト回答", value: liteTextLabel },
          { icon: "block", label: "広告", value: "なし" },
          { icon: "image", label: "画像生成", value: formatImageLimit(liteImage, "少量") },
          { icon: "travel_explore", label: "Web検索", value: "利用可" },
          { icon: "description", label: "ファイル解析", value: "基本" },
          { icon: "bolt", label: "応答速度", value: "高速" },
          { icon: "movie", label: "動画生成", value: "なし" },
          { icon: "manage_search", label: "Deep Research", value: "なし" },
        ],
        ads: "なし",
        dailyTextLimit: liteText,
        isDraft: false,
      },
      pro: {
        id: "pro",
        label: "Pro",
        priceYen: proPrice,
        priceUnit: "/ 月（税込）",
        tagline: "マルチAIルーティング対応プラン",
        aiModels: "Gemini · ChatGPT · Claude",
        note: "用途に応じて最適なAIへ自動切替できます。",
        routingExamples: [
          { use: "チャット", model: "ChatGPT" },
          { use: "コード", model: "Claude" },
          { use: "検索", model: "Gemini" },
          { use: "文章", model: "ChatGPT" },
          { use: "画像", model: "Gemini" },
          { use: "分析", model: "Claude" },
        ],
        highlights: [
          "マルチAIルーティング",
          "AI自動切替",
          `${proTextLabel}回答`,
          `画像生成${proImageLabel}`,
          "Web検索利用可",
          "優先処理",
        ],
        detailFeatures: [
          { icon: "hub", label: "利用AI", value: "Gemini · ChatGPT · Claude" },
          { icon: "route", label: "AIルーティング", value: "用途別に自動切替" },
          { icon: "chat", label: "テキスト回答", value: proTextLabel },
          { icon: "image", label: "画像生成", value: proImageLabel },
          { icon: "travel_explore", label: "Web検索", value: "利用可" },
          { icon: "manage_search", label: "Deep Research", value: "P1 設計中" },
          { icon: "description", label: "ファイル解析", value: "拡張" },
          { icon: "bolt", label: "優先処理", value: "あり" },
          { icon: "block", label: "広告", value: "なし" },
        ],
        ads: "なし",
        dailyTextLimit: proText,
        isDraft: false,
      },
      max: {
        id: "max",
        label: "Max",
        priceYen: maxPrice,
        priceUnit: "/ 月（税込）",
        tagline: "全AI・フェアユース拡張プラン",
        aiModels: "Gemini · ChatGPT · Claude · Grok（将来）",
        note: "制限拡張プラン。今後追加されるAIも利用対象です。",
        highlights: [
          "Proの全機能を包含",
          "回答数フェアユース拡張",
          "画像生成フェアユース拡張",
          "Web検索拡張",
          "大容量ファイル解析",
          "今後追加AIも対象",
        ],
        detailFeatures: [
          { icon: "hub", label: "利用AI", value: "Gemini · ChatGPT · Claude · Grok（将来）" },
          { icon: "chat", label: "テキスト回答", value: "フェアユース拡張" },
          { icon: "image", label: "画像生成", value: "フェアユース拡張" },
          { icon: "movie", label: "動画生成", value: "将来対応" },
          { icon: "travel_explore", label: "Web検索", value: "拡張" },
          { icon: "manage_search", label: "Deep Research", value: "利用可" },
          { icon: "description", label: "ファイル解析", value: "大容量対応" },
          { icon: "bolt", label: "優先処理", value: "あり" },
          { icon: "auto_awesome", label: "将来AI", value: "追加対象" },
        ],
        ads: "なし",
        dailyTextLimit: null,
        isDraft: !maxEnabled,
      },
    };
  }

  function getFeatureRows(planId, catalog) {
    const plan = catalog[planId];
    if (!plan?.detailFeatures) return [];
    return plan.detailFeatures;
  }

  let selectedTargetId = "lite";

  function getComparisonTargetIds(currentId) {
    return PLAN_ORDER.filter((planId) => planId !== currentId);
  }

  function getDefaultTargetId(currentId) {
    const targets = getComparisonTargetIds(currentId);
    const rank = PLAN_RANK[currentId] ?? 0;
    for (let i = rank + 1; i < PLAN_ORDER.length; i += 1) {
      const planId = PLAN_ORDER[i];
      if (targets.includes(planId)) return planId;
    }
    for (let i = rank - 1; i >= 0; i -= 1) {
      const planId = PLAN_ORDER[i];
      if (targets.includes(planId)) return planId;
    }
    return targets[0] || "lite";
  }

  function getRecommendedComparisonTarget(currentId) {
    const rank = PLAN_RANK[currentId] ?? 0;
    for (let i = rank + 1; i < PLAN_ORDER.length; i += 1) {
      const planId = PLAN_ORDER[i];
      if (planId !== currentId) return planId;
    }
    return null;
  }

  function resolveCurrentPlanId() {
    const genPlan = global.TasuAiWorkspaceUsage?.readGenAiPlan?.();
    const raw = String(genPlan?.plan || "free").toLowerCase();
    if (raw in PLAN_LABELS) return raw;
    if (raw.includes("lite") || raw.includes("basic") || raw.includes("300") || raw === "light") {
      return "lite";
    }
    if (raw.includes("pro") || raw.includes("980") || raw === "standard") return "pro";
    if (raw.includes("max") || raw === "premium") return "max";
    return "free";
  }

  function getRecommendedTarget(currentId) {
    return getRecommendedComparisonTarget(currentId) || getDefaultTargetId(currentId);
  }

  function getUsageLine() {
    const usage = global.TasuAiWorkspaceUsage;
    if (!usage?.getDailyRemaining || !usage?.getDailyLimit) return "";
    const remaining = usage.getDailyRemaining();
    const limit = usage.getDailyLimit();
    return `本日 残り ${remaining} / ${limit} 回`;
  }

  function renderPrice(plan) {
    const amount = formatYen(plan.priceYen);
    if (plan.priceYen === 0) {
      return `<div class="ai-ref-plan-col__price"><span class="ai-ref-plan-col__price-main">${amount}</span></div>`;
    }
    const unit = plan.priceUnit ? `<span class="ai-ref-plan-col__price-unit">${esc(plan.priceUnit)}</span>` : "";
    return `
      <div class="ai-ref-plan-col__price">
        <span class="ai-ref-plan-col__price-main">${amount}</span>
        ${unit}
      </div>`;
  }

  function renderPlanNote(note, variant) {
    if (!note) return "";
    return `<p class="ai-ref-plan-col__note${variant ? ` ai-ref-plan-col__note--${variant}` : ""}">${esc(note)}</p>`;
  }

  function renderAiModelsBlock(aiModels) {
    if (!aiModels) return "";
    return `
      <div class="ai-ref-plan-col__ai-block">
        <span class="ai-ref-plan-col__ai-label">利用AI</span>
        <p class="ai-ref-plan-col__ai-value">${esc(aiModels)}</p>
      </div>`;
  }

  function renderGeminiUsage(text) {
    if (!text) return "";
    return `
      <div class="ai-ref-plan-col__gemini-usage">
        <span class="ai-ref-plan-col__ai-label">用途</span>
        <p class="ai-ref-plan-col__ai-value">${esc(text)}</p>
      </div>`;
  }

  function renderRoutingBlock(examples) {
    if (!examples?.length) return "";
    return `
      <div class="ai-ref-plan-col__routing">
        <span class="ai-ref-plan-col__ai-label">AIルーティング例</span>
        <ul class="ai-ref-plan-col__routing-list">
          ${examples
            .map(
              (row) =>
                `<li><span class="ai-ref-plan-col__routing-use">${esc(row.use)}</span><span class="ai-ref-plan-col__routing-arrow" aria-hidden="true">→</span><span class="ai-ref-plan-col__routing-model">${esc(row.model)}</span></li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  function renderHighlights(items) {
    return `
      <ul class="ai-ref-plan-col__highlights">
        ${items
          .map(
            (text) =>
              `<li><span class="material-symbols-outlined" aria-hidden="true">check_circle</span><span>${esc(text)}</span></li>`
          )
          .join("")}
      </ul>`;
  }

  function renderFeatureRows(rows) {
    return `
      <ul class="ai-ref-plan-col__features">
        ${rows
          .map(
            (row) => `
          <li>
            <span class="material-symbols-outlined" aria-hidden="true">${esc(row.icon)}</span>
            <span class="ai-ref-plan-col__feature-text">
              <span class="ai-ref-plan-col__feature-label">${esc(row.label)}</span>
              <span class="ai-ref-plan-col__feature-value">${esc(row.value)}</span>
            </span>
          </li>`
          )
          .join("")}
      </ul>`;
  }

  function renderColumn(planId, role, currentId, catalog) {
    const plan = catalog[planId];
    if (!plan) return "";
    const isCurrent = planId === currentId;
    const isTarget = role === "target";
    const rankCurrent = PLAN_RANK[currentId] ?? 0;
    const rankPlan = PLAN_RANK[planId] ?? 0;
    const isUpgrade = rankPlan > rankCurrent;
    const isDowngrade = rankPlan < rankCurrent;
    const recommended = isTarget && planId === "pro" && isUpgrade;
    const usageLine = role === "current" ? getUsageLine() : "";

    let ctaLabel = "ご利用中のプラン";
    let ctaDisabled = true;
    if (isTarget) {
      if (isCurrent) {
        ctaLabel = "ご利用中のプラン";
        ctaDisabled = true;
      } else if (isUpgrade) {
        ctaLabel = `${plan.label}にアップグレード`;
        ctaDisabled = plan.isDraft;
      } else if (isDowngrade) {
        ctaLabel = "ダウングレードは準備中";
        ctaDisabled = true;
      }
    }

    const metaRows =
      role === "current"
        ? [
            { label: "利用回数", value: usageLine || formatDailyLimit(plan.dailyTextLimit) },
            { label: "広告", value: plan.ads },
          ]
        : [];

    return `
      <article
        class="ai-ref-plan-col${isTarget ? " ai-ref-plan-col--target" : ""}${isCurrent ? " is-current" : ""}"
        data-ai-plan-col="${esc(planId)}"
        data-ai-plan-col-role="${role}"
      >
        ${recommended ? `<span class="ai-ref-plan-col__badge">おすすめ</span>` : ""}
        <div class="ai-ref-plan-col__head">
          <h3 class="ai-ref-plan-col__name">${esc(plan.label)}</h3>
          ${renderPrice(plan)}
          <p class="ai-ref-plan-col__tagline">${esc(plan.tagline)}</p>
          ${renderPlanNote(plan.note, planId === "lite" ? "lite" : planId === "max" ? "max" : "")}
        </div>
        ${
          isTarget
            ? `<button
                type="button"
                class="ai-ref-plan-col__cta${ctaDisabled ? " is-disabled" : ""}"
                data-ai-plan-select="${esc(planId)}"
                ${ctaDisabled ? "disabled" : ""}
              >${esc(ctaLabel)}</button>`
            : `<div class="ai-ref-plan-col__cta ai-ref-plan-col__cta--static" aria-disabled="true">${esc(ctaLabel)}</div>`
        }
        ${renderAiModelsBlock(plan.aiModels)}
        ${renderGeminiUsage(plan.geminiUsage)}
        ${renderRoutingBlock(plan.routingExamples)}
        ${renderHighlights(plan.highlights)}
        ${
          metaRows.length
            ? `<dl class="ai-ref-plan-col__meta">
                ${metaRows
                  .map(
                    (row) => `
                  <div class="ai-ref-plan-col__meta-row">
                    <dt>${esc(row.label)}</dt>
                    <dd>${esc(row.value)}</dd>
                  </div>`
                  )
                  .join("")}
              </dl>`
            : ""
        }
        ${isTarget ? `<div class="ai-ref-plan-col__detail-label">機能一覧</div>${renderFeatureRows(getFeatureRows(planId, catalog))}` : ""}
      </article>`;
  }

  function renderTabs(currentId) {
    const host = $("[data-ai-plan-upgrade-tabs]");
    if (!host) return;
    const comparisonIds = getComparisonTargetIds(currentId);
    host.innerHTML = comparisonIds
      .map((planId) => {
        const active = planId === selectedTargetId;
        return `
        <button
          type="button"
          class="ai-ref-plan-upgrade-tabs__btn${active ? " is-active" : ""}"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
          data-ai-plan-upgrade-tab="${planId}"
        >${esc(PLAN_LABELS[planId])}</button>`;
      })
      .join("");
  }

  function renderCompare(currentId, catalog) {
    const host = $("[data-ai-plan-upgrade-compare]");
    if (!host) return;
    const comparisonIds = getComparisonTargetIds(currentId);
    const targetId = comparisonIds.includes(selectedTargetId)
      ? selectedTargetId
      : getDefaultTargetId(currentId);
    host.innerHTML =
      renderColumn(currentId, "current", currentId, catalog) +
      renderColumn(targetId, "target", currentId, catalog);
  }

  function renderFootnote() {
    const foot = $("[data-ai-plan-upgrade-footnote]");
    if (!foot) return;
    const maxReady = Boolean(global.TasuStripeGenAiConfig?.MAX_PLACEHOLDER?.enabled);
    foot.textContent = maxReady
      ? ""
      : "MaxプランのStripe連携は準備中です（価格・機能は docs/AI/AI_MEMBERSHIP_PRICING.md 準拠）。";
    foot.hidden = maxReady;
  }

  function syncPlanUpgradeUi() {
    const catalog = buildPlanCatalog();
    const currentId = resolveCurrentPlanId();
    const comparisonIds = getComparisonTargetIds(currentId);
    if (!comparisonIds.includes(selectedTargetId)) {
      selectedTargetId = getDefaultTargetId(currentId);
    }
    renderTabs(currentId);
    renderCompare(currentId, catalog);
    renderFootnote();
  }

  function openPlanUpgrade() {
    const backdrop = $("[data-ai-workspace-plan-upgrade-backdrop]");
    if (!backdrop) return;
    const currentId = resolveCurrentPlanId();
    selectedTargetId = getDefaultTargetId(currentId);
    syncPlanUpgradeUi();
    backdrop.hidden = false;
    global.document.body.classList.add("ai-workspace-plan-upgrade-open");
    global.TasuAiWorkspaceSettings?.closeSettings?.();
    global.TasuAiWorkspaceUserMenu?.closeUserMenu?.();
    global.TasuTgaShell?.closeSidebar?.();
  }

  function closePlanUpgrade() {
    const backdrop = $("[data-ai-workspace-plan-upgrade-backdrop]");
    if (!backdrop) return;
    backdrop.hidden = true;
    global.document.body.classList.remove("ai-workspace-plan-upgrade-open");
  }

  function handlePlanSelect(planId) {
    const currentId = resolveCurrentPlanId();
    if (planId === currentId) return;
    if ((PLAN_RANK[planId] ?? 0) <= (PLAN_RANK[currentId] ?? 0)) return;
    const catalog = buildPlanCatalog();
    if (catalog[planId]?.isDraft) return;
    console.info("[TasuAiWorkspacePlanUpgrade] demo select:", planId);
    closePlanUpgrade();
  }

  function bindPlanUpgrade() {
    const backdrop = $("[data-ai-workspace-plan-upgrade-backdrop]");
    if (!backdrop) return;

    global.document.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ai-workspace-plan-upgrade-open]")) {
        ev.preventDefault();
        openPlanUpgrade();
      }
    });

    global.document.querySelectorAll("[data-ai-workspace-plan-upgrade-close]").forEach((btn) => {
      btn.addEventListener("click", closePlanUpgrade);
    });

    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) closePlanUpgrade();
      const tab = ev.target.closest("[data-ai-plan-upgrade-tab]");
      if (tab) {
        const tabId = tab.getAttribute("data-ai-plan-upgrade-tab") || "";
        const currentId = resolveCurrentPlanId();
        if (tabId && tabId !== currentId && getComparisonTargetIds(currentId).includes(tabId)) {
          selectedTargetId = tabId;
          syncPlanUpgradeUi();
        }
        return;
      }
      const selectBtn = ev.target.closest("[data-ai-plan-select]");
      if (!selectBtn || selectBtn.disabled) return;
      handlePlanSelect(selectBtn.getAttribute("data-ai-plan-select") || "");
    });

    global.document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !backdrop.hidden) closePlanUpgrade();
    });

    global.addEventListener("tasu:ai-plan-changed", syncPlanUpgradeUi);
  }

  function init() {
    bindPlanUpgrade();
    syncPlanUpgradeUi();
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuAiWorkspacePlanUpgrade = {
    openPlanUpgrade,
    closePlanUpgrade,
    syncPlanCards: syncPlanUpgradeUi,
    syncPlanUpgradeUi,
    resolveCurrentPlanId,
    buildPlanCatalog,
    getComparisonTargetIds,
    getDefaultTargetId,
  };
})(typeof window !== "undefined" ? window : globalThis);
