#!/usr/bin/env node
/**
 * TASFUL AI Workspace — 配線監査（Q&A 除外 · 調査のみ）
 *   node scripts/verify-ai-workspace-wiring-audit.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  findDevServerBaseUrl,
  buildLocalPageUrl,
} from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "reports", "ai-workspace-wiring-audit.md");

/** @type {Record<string, string[]>} */
const findings = {
  disconnected: [],
  dummy: [],
  notFound: [],
  saveGaps: [],
  recommended: [],
};

const viewports = [
  { tag: "1280", w: 1280, h: 900 },
  { tag: "768", w: 768, h: 900 },
  { tag: "390", w: 390, h: 844 },
];

const SETTINGS_SECTIONS = [
  "general",
  "ai",
  "model",
  "chat",
  "voice",
  "image",
  "library",
  "notification",
  "personalize",
  "data",
  "security",
  "account",
  "billing",
  "help",
];

const GENERATION_CATEGORIES = [
  { id: "image", label: "画像", formSel: "[data-ai-image-form], .ai-cat-form, .ai-image-workspace" },
  { id: "video", label: "動画", formSel: "[data-ai-video-form]" },
  { id: "music", label: "音楽", formSel: "[data-ai-music-form]" },
  { id: "document", label: "資料", formSel: "[data-ai-document-form]" },
];

const KNOWN_DUMMY_ACTIONS = [
  { sel: "[data-billing-action]", attr: "data-billing-action", label: "請求" },
  { sel: "[data-ai-settings-mfa-setup]", label: "一般 › MFAを設定" },
  { sel: "[data-personalize-action='manage-memory']", label: "パーソナライズ › 管理する" },
  { sel: "[data-data-action]", attr: "data-data-action", label: "データ管理" },
  { sel: "[data-security-action]", attr: "data-security-action", label: "セキュリティ" },
  { sel: "[data-account-action]", attr: "data-account-action", label: "アカウント" },
  { sel: "[data-library-action]", attr: "data-library-action", label: "ライブラリー" },
  { sel: "[data-ai-plan-select]", label: "プランアップグレード › 選択" },
  { sel: "[data-ai-help-item]", attr: "data-ai-help-item", label: "ユーザーメニュー › ヘルプ" },
];

function add(list, item) {
  if (!findings[list].includes(item)) findings[list].push(item);
}

let BASE = "http://127.0.0.1:8788";

async function resetWorkspace(page) {
  await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.evaluate(() => {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith("tasu_ai_chat_") || k === "tasu_ai_workspace_category") {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("[data-ai-chat-input]", { timeout: 30000 });
}

async function waitGlobals(page) {
  await page.waitForFunction(
    () =>
      window.TasuAiWorkspaceCategories?.applyCategory &&
      window.TasuAiWorkspaceSettings?.openSettings &&
      window.TasuTgaShell?.applyWorkspaceTool,
    null,
    { timeout: 30000 },
  );
}

function inventoryStaticDummies() {
  const settingsJs = readFileSync(join(root, "ai-workspace-settings.js"), "utf8");
  if (settingsJs.includes("renderDummyPanel")) {
    add("dummy", "設定 › ヘルプ: renderDummyPanel（準備中デモ）");
  }
  const modules = [
    "ai-workspace-billing-settings.js",
    "ai-workspace-account-settings.js",
    "ai-workspace-security-settings.js",
    "ai-workspace-data-settings.js",
    "ai-workspace-personalization-settings.js",
    "ai-workspace-library-settings.js",
    "ai-workspace-plan-upgrade.js",
  ];
  for (const file of modules) {
    const src = readFileSync(join(root, file), "utf8");
    const demos = (src.match(/console\.info\([^)]*demo[^)]*\)/gi) || []).length;
    if (demos > 0) {
      add("dummy", `${file}: console.info デモハンドラ ${demos} 件`);
    }
  }
}

async function auditDomWiring(page) {
  const gaps = await page.evaluate(() => ({
    categoryNav: Boolean(document.querySelector("[data-ai-workspace-categories]")),
    starterChips: document.querySelectorAll("[data-tga-starter-chip]").length,
    toolDropdownHidden: Boolean(
      document.querySelector(".ai-ref-style-dropdown__tools[hidden]"),
    ),
  }));
  if (!gaps.categoryNav) {
    add(
      "disconnected",
      "カテゴリタブ `[data-ai-workspace-categories]` 未実装（video/music/document/history への UI 導線なし）",
    );
  }
  if (gaps.starterChips === 0) {
    add("disconnected", "Welcome スターターチップ `[data-tga-starter-chip]` 0 件");
  }
  if (gaps.toolDropdownHidden) {
    add(
      "recommended",
      "コンポーザー › ツール切替 UI は hidden（`TasuTgaShell.applyWorkspaceTool` API のみ）",
    );
  }
  return gaps;
}

async function auditStaticLinks(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((a) => ({ href: a.getAttribute("href") || "", text: (a.textContent || "").trim().slice(0, 50) }))
      .filter((x) => x.href && !x.href.startsWith("#") && !x.href.startsWith("javascript:")),
  );
  for (const { href, text } of hrefs) {
    let url;
    try {
      url = new URL(href, page.url()).href;
    } catch {
      add("disconnected", `不正 href: ${href}（${text}）`);
      continue;
    }
    if (!/127\.0\.0\.1:8788|localhost:8788/.test(url)) continue;
    const res = await page.request.get(url);
    if (res.status() === 404) add("notFound", `${href} — 「${text}」`);
    else if (res.status() >= 500) add("notFound", `HTTP ${res.status()}: ${href}`);
  }
}

async function auditRelatedPages(page) {
  for (const path of ["gen-ai-workspace.html", "ai-workspace/", "index-top.html"]) {
    const res = await page.request.get(buildLocalPageUrl(BASE, path));
    if (res.status() !== 200) add("notFound", `関連ページ ${path} → HTTP ${res.status()}`);
  }
}

async function auditSettingsNav(page) {
  await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.());
  await page.waitForSelector("[data-ai-workspace-settings-dialog]:not([hidden])", { timeout: 10000 });

  const sections = [];
  for (const id of SETTINGS_SECTIONS) {
    await page.click(`[data-ai-settings-nav-item="${id}"]`);
    await page.waitForTimeout(100);
    const panel = await page.evaluate((sectionId) => {
      const el = document.querySelector(`[data-ai-settings-panel='${sectionId}']`);
      const text = el?.textContent || "";
      return {
        visible: Boolean(el && !el.hidden),
        isDummy: /準備中です（デモ）/.test(text),
        toggles: el?.querySelectorAll("[data-ai-settings-toggle]").length || 0,
        selects: el?.querySelectorAll("[data-ai-settings-select]").length || 0,
        unboundToggles: [...(el?.querySelectorAll("[data-ai-settings-toggle]") || [])].filter(
          (t) =>
            !t.getAttribute("data-setting-key") &&
            !t.getAttribute("data-chat-setting-key") &&
            !t.getAttribute("data-voice-setting-key") &&
            !t.getAttribute("data-image-setting-key") &&
            !t.getAttribute("data-library-setting-key") &&
            !t.getAttribute("data-personalize-setting-key") &&
            !t.getAttribute("data-data-setting-key") &&
            !t.getAttribute("data-security-setting-key") &&
            !t.getAttribute("data-account-setting-key") &&
            !t.getAttribute("data-general-setting-key") &&
            !t.getAttribute("data-notification-setting-key"),
        ).length,
        unboundSelects: [...(el?.querySelectorAll("[data-ai-settings-select]") || [])].filter(
          (s) =>
            !s.getAttribute("data-setting-key") &&
            !s.getAttribute("data-chat-setting-key") &&
            !s.getAttribute("data-voice-setting-key") &&
            !s.getAttribute("data-image-setting-key") &&
            !s.getAttribute("data-library-setting-key") &&
            !s.getAttribute("data-personalize-setting-key") &&
            !s.getAttribute("data-data-setting-key") &&
            !s.getAttribute("data-general-setting-key") &&
            !s.getAttribute("data-notification-setting-key"),
        ).length,
      };
    }, id);
    sections.push({ id, ...panel });
    if (panel.isDummy) add("dummy", `設定 › ${id}: 準備中プレースホルダー`);
    if (panel.unboundToggles > 0) {
      add("saveGaps", `設定 › ${id}: 保存キーなしトグル ${panel.unboundToggles} 件（UIのみ切替の可能性）`);
    }
    if (panel.unboundSelects > 0) {
      add("saveGaps", `設定 › ${id}: 保存キーなしセレクト ${panel.unboundSelects} 件`);
    }
  }

  await page.click("[data-ai-workspace-settings-close]");
  return sections;
}

async function auditSettingsPersistence(page) {
  const results = [];

  await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("model"));
  await page.waitForSelector("[data-ai-settings-panel='model']");

  const modelBefore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tasu_ai_model_router_settings") || "null"),
  );
  await page.click('[data-ai-model-mode="quality"]');
  await page.waitForTimeout(200);
  const modelAfter = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tasu_ai_model_router_settings") || "null"),
  );
  const modelOk = modelAfter?.modelMode === "quality" && modelAfter?.modelMode !== modelBefore?.modelMode;
  results.push({ key: "modelMode", ok: modelOk });
  if (!modelOk) add("saveGaps", "設定 › モデル › モード切替（speed/quality）が localStorage に保存されない");

  await page.click('[data-ai-settings-nav-item="chat"]');
  await page.waitForTimeout(150);
  const chatToggle = page.locator("[data-ai-settings-panel='chat'] [data-chat-setting-key]").first();
  if ((await chatToggle.count()) > 0) {
    const chatBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("tasu_ai_chat_settings") || "null"),
    );
    await chatToggle.click();
    await page.waitForTimeout(150);
    const chatAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("tasu_ai_chat_settings") || "null"),
    );
    const chatOk = JSON.stringify(chatBefore) !== JSON.stringify(chatAfter);
    results.push({ key: "chatToggle", ok: chatOk });
    if (!chatOk) add("saveGaps", "設定 › チャット › トグル変更が tasu_ai_chat_settings に反映されない");
  }

  await page.click('[data-ai-settings-nav-item="personalize"]');
  await page.waitForTimeout(150);
  const persBefore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tasu_ai_personalization_settings") || "null"),
  );
  const nickname = page.locator("[data-personalize-field='nickname']");
  if ((await nickname.count()) > 0) {
    await nickname.fill("配線監査");
    await page.click("[data-personalize-action='save']");
    await page.waitForTimeout(200);
    const persAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("tasu_ai_personalization_settings") || "null"),
    );
    const persOk = persAfter?.nickname === "配線監査";
    results.push({ key: "personalizeSave", ok: persOk });
    if (!persOk) add("saveGaps", "設定 › パーソナライズ › 保存ボタン後に tasu_ai_personalization_settings 未更新");
  }

  await page.click('[data-ai-settings-nav-item="general"]');
  await page.waitForTimeout(150);
  const generalToggle = page.locator("#ai-settings-fast-response");
  const genBefore = await page.evaluate(() => ({
    appearance: localStorage.getItem("tasu_ai_workspace_appearance"),
    fast: document.querySelector("#ai-settings-fast-response")?.classList.contains("is-on"),
  }));
  if ((await generalToggle.count()) > 0) {
    await generalToggle.click();
    await page.waitForTimeout(100);
    await page.click("[data-ai-workspace-settings-close]");
    await page.waitForTimeout(100);
    await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("general"));
    await page.waitForTimeout(150);
    const genAfter = await page.evaluate(() => ({
      appearance: localStorage.getItem("tasu_ai_workspace_appearance"),
      fast: document.querySelector("#ai-settings-fast-response")?.classList.contains("is-on"),
    }));
    const genOk = genAfter.fast !== genBefore.fast;
    results.push({ key: "generalToggle", ok: genOk });
    if (!genOk) {
      add(
        "saveGaps",
        "設定 › 一般 › 高速回答トグルは再オープンでリセット（localStorage 未保存）",
      );
    }
  } else {
    await page.click("[data-ai-workspace-settings-close]");
  }

  return results;
}

async function auditPlanSwitch(page) {
  await page.evaluate(() => window.TasuAiWorkspacePlanUpgrade?.openPlanUpgrade?.());
  await page.waitForFunction(
    () => !document.querySelector("[data-ai-workspace-plan-upgrade-backdrop]")?.hidden,
    null,
    { timeout: 10000 },
  );

  const initial = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll("[data-ai-plan-upgrade-tab]")].map((el) =>
      el.getAttribute("data-ai-plan-upgrade-tab"),
    ),
    current: window.TasuAiWorkspacePlanUpgrade?.resolveCurrentPlanId?.(),
    compareLen: document.querySelector("[data-ai-plan-upgrade-compare]")?.textContent?.length || 0,
  }));

  const tabTexts = [];
  for (const tab of initial.tabs) {
    await page.click(`[data-ai-plan-upgrade-tab="${tab}"]`);
    await page.waitForTimeout(120);
    tabTexts.push(
      await page.evaluate(
        () => document.querySelector("[data-ai-plan-upgrade-compare]")?.textContent?.slice(0, 80) || "",
      ),
    );
  }
  const uniqueTabs = new Set(tabTexts.filter(Boolean));
  if (uniqueTabs.size < Math.min(2, initial.tabs.length)) {
    add("disconnected", "プラン比較 › タブ切替で比較パネルが更新されない");
  }

  await page.click("[data-ai-workspace-plan-upgrade-close]");

  await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("billing"));
  await page.waitForSelector("[data-ai-settings-panel='billing']");
  const billing = await page.evaluate(() => ({
    plans: [...document.querySelectorAll(".ai-ref-billing-plan-card__name")].map((el) =>
      el.textContent?.trim(),
    ),
    hasFree: /Free/i.test(document.body.textContent || ""),
  }));
  await page.click("[data-ai-workspace-settings-close]");

  if (!billing.plans.length) add("disconnected", "設定 › 請求 › プランカード未表示");
  if (!billing.hasFree && !billing.plans.some((p) => /Free/i.test(p))) {
    add("recommended", "設定 › 請求: Free プランカードなし（現プラン表示のみの可能性）");
  }

  return { ...initial, billingPlans: billing.plans };
}

async function auditModelSelection(page) {
  await resetWorkspace(page);
  await waitGlobals(page);

  const composer = await page.evaluate(() => {
    window.TasuAiPlanModels?.setSelectedModelId?.("claude");
    const id = window.TasuAiPlanModels?.getSelectedModelId?.();
    return { selected: id, stored: localStorage.getItem("tasu_ai_selected_model") };
  });
  if (composer.selected !== "claude") {
    add("saveGaps", "モデル選択 › TasuAiPlanModels.setSelectedModelId が反映されない");
  }

  await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.("model"));
  await page.waitForSelector("[data-ai-settings-panel='model']");
  const providers = await page.evaluate(() => {
    const text = document.querySelector("[data-ai-settings-panel='model']")?.textContent || "";
    return {
      gemini: /Gemini/i.test(text),
      claude: /Claude/i.test(text),
      gpt: /GPT/i.test(text),
      deepseek: /DeepSeek/i.test(text),
      modes: [...document.querySelectorAll("[data-ai-model-mode]")].map((el) =>
        el.getAttribute("data-ai-model-mode"),
      ),
    };
  });
  await page.click("[data-ai-workspace-settings-close]");

  for (const [name, ok] of [
    ["Gemini", providers.gemini],
    ["Claude", providers.claude],
    ["GPT", providers.gpt],
    ["DeepSeek", providers.deepseek],
  ]) {
    if (!ok) add("disconnected", `設定 › モデル: ${name} 表示なし`);
  }
  for (const mode of ["auto", "speed", "quality"]) {
    if (!providers.modes.includes(mode)) {
      add("disconnected", `設定 › モデル: モード「${mode}」UIなし`);
    }
  }

  return { composer, providers };
}

async function auditGenerationPages(page) {
  const out = [];
  for (const cat of GENERATION_CATEGORIES) {
    const r = await page.evaluate((categoryId) => {
      window.TasuAiWorkspaceCategories?.applyCategory?.(categoryId);
      const panel = document.querySelector("[data-ai-category-panel]");
      return {
        category: document.querySelector("[data-ai-workspace-chat]")?.getAttribute("data-ai-category"),
        panelHidden: panel?.hidden !== false,
        htmlLen: panel?.innerHTML?.length || 0,
      };
    }, cat.id);
    const hasForm = await page.locator(cat.formSel).count();
    const ok = r.category === cat.id && !r.panelHidden && hasForm > 0;
    out.push({ ...cat, ok, ...r });
    if (!ok) add("disconnected", `生成ページ › ${cat.label}（${cat.id}）: パネル未表示またはフォームなし`);
  }
  return out;
}

async function auditSearchFlows(page) {
  const flows = [
    { tool: "tasful", query: "草刈り業者を探したい", expect: ".ai-cross-card, .ai-search-summary, .ai-hybrid-section" },
    { tool: "web", query: "外壁塗装の相場を教えて", expect: ".ai-search-summary, .ai-hybrid-section, .ai-msg-row" },
    { tool: "both", query: "エアコンクリーニングの相場", expect: ".ai-hybrid-section, .ai-search-summary, .ai-cross-card" },
    { tool: "consult", query: "提案資料の構成を考えたい", expect: ".ai-msg-row" },
  ];
  const out = [];
  for (const flow of flows) {
    await resetWorkspace(page);
    await waitGlobals(page);
    await page.evaluate((toolId) => window.TasuTgaShell?.applyWorkspaceTool?.(toolId, { focusInput: false }), flow.tool);
    await page.fill("[data-ai-chat-input]", flow.query);
    await page.click("[data-ai-chat-send]");
    try {
      await page.waitForSelector(flow.expect, { timeout: 35000 });
      out.push({ ...flow, ok: true });
    } catch {
      out.push({ ...flow, ok: false });
      add("disconnected", `検索系 › ${flow.tool}: 送信後に期待 UI 未表示（${flow.query}）`);
    }
  }
  return out;
}

async function auditGenerationChatFlows(page) {
  const flows = [
    { kind: "image", query: "SNS用の広告画像を作って", sel: ".ai-generate-panel--image, .ai-msg-row" },
    { kind: "code", query: "お問い合わせフォームのHTMLを作って", sel: '[data-ai-generate-kind="code"], .ai-msg-row' },
  ];
  const out = [];
  for (const flow of flows) {
    await resetWorkspace(page);
    await waitGlobals(page);
    await page.fill("[data-ai-chat-input]", flow.query);
    await page.click("[data-ai-chat-send]");
    try {
      await page.waitForSelector(flow.sel, { timeout: 35000 });
      out.push({ ...flow, ok: true });
    } catch {
      out.push({ ...flow, ok: false });
      add("disconnected", `生成チャット › ${flow.kind}: 応答 UI 未表示`);
    }
  }
  return out;
}

async function auditDummyInventory(page) {
  for (const item of KNOWN_DUMMY_ACTIONS) {
    const count = await page.locator(item.sel).count();
    if (count === 0) continue;
    if (item.attr) {
      const keys = await page.evaluate(
        ({ sel, attr }) =>
          [...document.querySelectorAll(sel)].map((el) => el.getAttribute(attr)).filter(Boolean),
        { sel: item.sel, attr: item.attr },
      );
      for (const key of keys) {
        add("dummy", `${item.label} › ${key}: デモ / 未接続ハンドラ（console.info または遷移なし）`);
      }
    } else {
      add("dummy", `${item.label}: ${count} 件（デモ想定）`);
    }
  }
}

async function openUserMenu(page) {
  await page.evaluate(() => {
    const menu = document.querySelector("[data-ai-workspace-user-menu]");
    const toggle = document.querySelector("[data-ai-workspace-user-menu-toggle]");
    if (menu) menu.hidden = false;
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  });
}

async function auditHelpDisconnected(page) {
  const helpOk = await page.evaluate(() => {
    const HELP_HREFS = {
      center: "/help/",
      releases: "/help/faq/",
      shortcuts: "/help/beginner/",
      terms: "/help/terms-of-service/",
      privacy: "/help/privacy-policy/",
      bug: "/help/contact-support/",
    };
    return [...document.querySelectorAll("[data-ai-help-item]")].map((el) => ({
      key: el.getAttribute("data-ai-help-item"),
      label: el.textContent?.replace(/\s+/g, " ").trim(),
      href: HELP_HREFS[el.getAttribute("data-ai-help-item") || ""] || "",
    }));
  });
  for (const item of helpOk) {
    if (!item.href) {
      add("disconnected", `ヘルプ › ${item.label}: href 未設定（data-ai-help-item=${item.key}）`);
    }
  }
}

async function checkResponsive(page, tag) {
  const layout = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    inputOk: Boolean(document.querySelector("[data-ai-chat-input]")?.getBoundingClientRect().width),
    sendOk: Boolean(document.querySelector("[data-ai-chat-send]")?.getBoundingClientRect().width),
  }));
  if (layout.scrollW > layout.clientW + 2) {
    add("recommended", `${tag}px: 横スクロール（${layout.scrollW}/${layout.clientW}）`);
  }
  if (!layout.inputOk || !layout.sendOk) {
    add("recommended", `${tag}px: コンポーザー入力/送信が非表示または幅0`);
  }
  return layout;
}

function buildReport(summary) {
  const lines = [
    "# TASFUL AI 配線監査レポート",
    "",
    "**スコープ:** 追加ページ・ボタン・設定系（Q&A 除外 · 調査のみ · 修正なし）",
    "",
    `検証日時: ${new Date().toISOString()}`,
    `検証URL: ${summary.base}/ai-workspace.html`,
    "",
    "## 検証サマリー",
    "",
    "| Viewport | HTTP | Console Error | Network 4xx/5xx | 横スクロール |",
    "|----------|------|---------------|-----------------|--------------|",
  ];

  for (const vp of viewports) {
    const layout = summary.viewports[vp.tag];
    const overflow = layout?.scrollW > layout?.clientW + 2 ? "あり" : "なし";
    lines.push(
      `| ${vp.tag} | ${summary.httpStatus[vp.tag]} | ${(summary.consoleErrors[vp.tag] || []).length} | ${(summary.networkFailures[vp.tag] || []).length} | ${overflow} |`,
    );
  }

  lines.push("", "## 機能別結果", "");
  lines.push("### 設定ナビ（14セクション）");
  for (const s of summary.settingsSections || []) {
    lines.push(`- ${s.id}: ${s.visible ? "表示" : "非表示"}${s.isDummy ? " · **デモ**" : ""}`);
  }

  lines.push("", "### 設定保存");
  for (const p of summary.persistence || []) {
    lines.push(`- ${p.key}: ${p.ok ? "OK" : "**NG**"}`);
  }

  lines.push("", "### プラン切替");
  lines.push(`- 比較タブ: ${(summary.plan?.tabs || []).join(", ") || "—"}`);
  lines.push(`- 請求プランカード: ${(summary.plan?.billingPlans || []).join(" / ") || "—"}`);

  lines.push("", "### モデル選択");
  lines.push(`- Composer model: ${summary.model?.composer?.selected || "—"}`);
  lines.push(
    `- 設定パネル: Gemini=${summary.model?.providers?.gemini} Claude=${summary.model?.providers?.claude} GPT=${summary.model?.providers?.gpt} DeepSeek=${summary.model?.providers?.deepseek}`,
  );

  lines.push("", "### 生成系ページ（カテゴリパネル）");
  for (const g of summary.generationPages || []) {
    lines.push(`- ${g.label}（${g.id}）: ${g.ok ? "OK" : "NG"}`);
  }

  lines.push("", "### 生成チャット");
  for (const g of summary.generationChat || []) {
    lines.push(`- ${g.kind}: ${g.ok ? "OK" : "NG"}`);
  }

  lines.push("", "### 検索系（ツール切替 + 送信）");
  for (const s of summary.searchFlows || []) {
    lines.push(`- ${s.tool}: ${s.ok ? "OK" : "NG"}`);
  }

  lines.push("", "---", "", "## 未接続ボタン / 導線", "");
  if (!findings.disconnected.length) lines.push("- （なし）");
  else findings.disconnected.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## 404リンク", "");
  if (!findings.notFound.length) lines.push("- （なし）");
  else findings.notFound.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## ダミーボタン", "");
  if (!findings.dummy.length) lines.push("- （なし）");
  else findings.dummy.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## 設定保存漏れ", "");
  if (!findings.saveGaps.length) lines.push("- （なし）");
  else findings.saveGaps.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## 修正推奨", "");
  if (!findings.recommended.length) lines.push("- （なし）");
  else findings.recommended.forEach((x) => lines.push(`- ${x}`));

  return lines.join("\n");
}

async function main() {
  BASE = await findDevServerBaseUrl({ probePath: "ai-workspace.html" });
  console.log(`TASFUL AI wiring audit @ ${BASE} (Q&A excluded)\n`);
  inventoryStaticDummies();
  mkdirSync(join(root, "reports"), { recursive: true });

  const summary = {
    base: BASE,
    viewports: {},
    httpStatus: {},
    consoleErrors: {},
    networkFailures: {},
  };

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      const consoleErrors = [];
      const networkFailures = [];

      page.on("console", (msg) => {
        if (msg.type() === "error" && !/favicon/i.test(msg.text())) {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));
      page.on("response", (res) => {
        const url = res.url();
        const status = res.status();
        if (
          status >= 400 &&
          /127\.0\.0\.1:8788/.test(url) &&
          !/favicon|googleapis|gstatic|jsdelivr|supabase/i.test(url)
        ) {
          networkFailures.push({ url, status });
          if (status === 404) add("notFound", `${vp.tag}px Network 404: ${url}`);
        }
      });

      const resp = await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), {
        waitUntil: "networkidle",
        timeout: 120000,
      });
      summary.httpStatus[vp.tag] = resp?.status?.() ?? 0;
      await waitGlobals(page);
      summary.viewports[vp.tag] = await checkResponsive(page, vp.tag);

      if (vp.tag === "1280") {
        summary.domGaps = await auditDomWiring(page);
        await auditStaticLinks(page);
        await auditRelatedPages(page);
        summary.settingsSections = await auditSettingsNav(page);
        summary.persistence = await auditSettingsPersistence(page);
        summary.plan = await auditPlanSwitch(page);
        summary.model = await auditModelSelection(page);
        summary.generationPages = await auditGenerationPages(page);
        summary.generationChat = await auditGenerationChatFlows(page);
        summary.searchFlows = await auditSearchFlows(page);
        await auditDummyInventory(page);
        await auditHelpDisconnected(page);
      }

      summary.consoleErrors[vp.tag] = consoleErrors;
      summary.networkFailures[vp.tag] = networkFailures;
      if (consoleErrors.length) {
        add("recommended", `${vp.tag}px Console Error ${consoleErrors.length} 件`);
        consoleErrors.slice(0, 3).forEach((e) => add("recommended", `${vp.tag}px: ${e.slice(0, 140)}`));
      }

      await page.close();
    }
  });

  const md = buildReport(summary);
  writeFileSync(reportPath, md, "utf8");
  console.log(md);
  console.log(`\nReport: ${reportPath}`);
  await closeAllBrowsers();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await closeAllBrowsers();
  process.exit(1);
});
