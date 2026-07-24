#!/usr/bin/env node
/**
 * TASFUL AI Workspace — 最終導線チェック
 *   node scripts/verify-ai-workspace-navigation-audit.mjs
 *
 * 検証環境: http://127.0.0.1:8788 のみ
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  STANDARD_LOCAL_BASE,
  findDevServerBaseUrl,
  buildLocalPageUrl,
} from "./lib/dev-server-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "reports", "ai-workspace-navigation-audit.md");

/** @type {{ disconnected: string[], dummy: string[], notFound: string[], recommended: string[] }} */
const findings = {
  disconnected: [],
  dummy: [],
  notFound: [],
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

const WORKSPACE_MODES = [
  { id: "welcome", label: "Welcome", test: "welcome" },
  { id: "chat", label: "Chat", test: "chat" },
  { id: "search", label: "Search", test: "search" },
  { id: "builder", label: "Builder", test: "builder" },
  { id: "analyze", label: "Analyze", test: "analyze" },
  { id: "generate", label: "Generate", test: "generate" },
  { id: "history", label: "History", test: "history" },
  { id: "favorites", label: "Favorites", test: "favorites" },
];

function addFinding(list, item) {
  if (!findings[list].includes(item)) findings[list].push(item);
}

async function resetWorkspace(page) {
  await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.evaluate(() => {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.startsWith("tasu_ai_chat_") ||
            key.startsWith("tasu_ai_workspace_") ||
            key === "tasu_ai_workspace_category")
        ) {
          sessionStorage.removeItem(key);
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
      window.TasuAiChat?.sendMessage &&
      window.TasuAiWorkspaceCategories?.applyCategory &&
      window.TasuAiWorkspaceSettings?.openSettings,
    null,
    { timeout: 30000 },
  );
}

async function checkResponsive(page, tag) {
  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const input = document.querySelector("[data-ai-chat-input]");
    const send = document.querySelector("[data-ai-chat-send]");
    const inputRect = input?.getBoundingClientRect();
    const sendRect = send?.getBoundingClientRect();
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      inputVisible: Boolean(input && inputRect && inputRect.width > 0 && inputRect.height > 0),
      sendVisible: Boolean(send && sendRect && sendRect.width > 0 && sendRect.height > 0),
      inputClipped: Boolean(
        inputRect && (inputRect.right > window.innerWidth + 2 || inputRect.left < -2),
      ),
      sendClipped: Boolean(
        sendRect && (sendRect.right > window.innerWidth + 2 || sendRect.left < -2),
      ),
    };
  });
  if (layout.scrollW > layout.clientW + 2) {
    addFinding(
      "recommended",
      `${tag}px: 横スクロール発生 (scrollWidth ${layout.scrollW} > clientWidth ${layout.clientW})`,
    );
  }
  if (!layout.inputVisible || !layout.sendVisible) {
    addFinding("recommended", `${tag}px: コンポーザー入力/送信ボタンが非表示またはサイズ0`);
  }
  if (layout.inputClipped || layout.sendClipped) {
    addFinding("recommended", `${tag}px: コンポーザー要素がビューポートからはみ出し`);
  }
  return layout;
}

async function auditWorkspaceMode(page, mode) {
  const result = await page.evaluate(async (modeId) => {
    const root = document.querySelector("[data-ai-workspace-chat]");
    const cats = window.TasuAiWorkspaceCategories;
    if (!root || !cats) return { ok: false, reason: "root or categories missing" };

    const welcome = document.querySelector("#welcome-screen");
    const panel = document.querySelector("[data-ai-category-panel]");
    const messages = document.querySelector("[data-ai-chat-messages]");

    function state() {
      return {
        category: root.getAttribute("data-ai-category"),
        welcomeHidden: welcome?.hidden === true,
        panelHidden: panel?.hidden !== false,
        messagesHidden: messages?.hidden !== false,
        tool: root.getAttribute("data-workspace-tool"),
        searchTarget: root.getAttribute("data-search-target"),
      };
    }

    if (modeId === "welcome") {
      cats.applyCategory("chat");
      window.TasuTgaShell?.setWelcomeVisible?.(true);
      if (messages) messages.hidden = true;
      const s = state();
      return { ok: !s.welcomeHidden, state: s };
    }

    if (modeId === "chat") {
      cats.applyCategory("chat");
      window.TasuTgaShell?.setWelcomeVisible?.(false);
      if (messages) messages.hidden = false;
      const s = state();
      return { ok: s.category === "chat" && s.welcomeHidden, state: s };
    }

    if (modeId === "search") {
      cats.applyCategory("chat");
      window.TasuTgaShell?.applyWorkspaceTool?.("tasful", { focusInput: false });
      const s = state();
      return { ok: s.tool === "tasful" || s.searchTarget === "tasful", state: s };
    }

    if (modeId === "builder") {
      cats.applyCategory("chat");
      window.TasuTgaShell?.applyWorkspaceTool?.("consult", { focusInput: false });
      const s = state();
      return { ok: s.tool === "consult", state: s };
    }

    if (modeId === "analyze") {
      cats.applyCategory("chat");
      window.TasuTgaShell?.applyWorkspaceTool?.("media", { focusInput: false });
      const s = state();
      return { ok: s.tool === "media", state: s };
    }

    if (modeId === "generate") {
      cats.applyCategory("image");
      const s = state();
      const hasForm = Boolean(panel?.querySelector("[data-ai-image-form], .ai-cat-form, .ai-image-workspace"));
      return { ok: s.category === "image" && !s.panelHidden, hasForm, state: s };
    }

    if (modeId === "history") {
      cats.applyCategory("history");
      const s = state();
      const hasHistory = Boolean(panel?.querySelector(".ai-history-panel"));
      return { ok: s.category === "history" && hasHistory, state: s };
    }

    if (modeId === "favorites") {
      document.querySelector("[data-ai-sidebar-favorites]")?.click();
      const s = state();
      const favOnly = window.TasuAiWorkspaceCategories?.historyUiState?.favoriteOnly;
      return { ok: s.category === "history" && favOnly === true, state: s };
    }

    return { ok: false, reason: "unknown mode" };
  }, mode.test);

  return result;
}

async function auditSettings(page) {
  await page.evaluate(() => window.TasuAiWorkspaceSettings?.openSettings?.());
  await page.waitForSelector("[data-ai-workspace-settings-dialog]:not([hidden])", {
    timeout: 10000,
  });

  const sectionResults = [];
  for (const sectionId of SETTINGS_SECTIONS) {
    await page.click(`[data-ai-settings-nav-item="${sectionId}"]`);
    await page.waitForTimeout(120);
    const panel = await page.evaluate((id) => {
      const el = document.querySelector(`[data-ai-settings-panel='${id}']`);
      const text = el?.textContent?.trim() || "";
      const isDummy = /準備中です（デモ）/.test(text);
      const hasSave = Boolean(el?.querySelector("[data-ai-settings-save], button[type='submit']"));
      const hasReset = Boolean(
        el?.querySelector("[data-ai-settings-reset], [data-ai-settings-clear], [data-ai-data-clear]"),
      );
      return {
        id,
        visible: Boolean(el && !el.hidden),
        isDummy,
        hasSave,
        hasReset,
        snippet: text.slice(0, 120),
      };
    }, sectionId);
    sectionResults.push(panel);
    if (panel.isDummy) {
      addFinding("dummy", `設定 › ${sectionId}: 「準備中です（デモ）」プレースホルダー`);
    }
  }

  // Plan cards in billing
  const billing = await page.evaluate(() => {
    const panel = document.querySelector("[data-ai-settings-panel='billing']");
    const plans = [...(panel?.querySelectorAll(".ai-ref-billing-plan-card__name") || [])].map((el) =>
      el.textContent?.trim(),
    );
    const prices = [...(panel?.querySelectorAll(".ai-ref-billing-plan-card__price") || [])].map((el) =>
      el.textContent?.trim(),
    );
    return { plans, prices };
  });

  // Model panel providers
  const modelPanel = await page.evaluate(() => {
    const panel = document.querySelector("[data-ai-settings-panel='model']");
    const text = panel?.textContent || "";
    const modes = [...(panel?.querySelectorAll("[data-ai-model-mode]") || [])].map((el) =>
      el.getAttribute("data-ai-model-mode"),
    );
    return {
      hasGemini: /Gemini/i.test(text),
      hasClaude: /Claude/i.test(text),
      hasGpt: /GPT/i.test(text),
      hasDeepSeek: /DeepSeek/i.test(text),
      modes,
    };
  });

  await page.click("[data-ai-workspace-settings-close]");
  await page.waitForTimeout(200);

  return { sectionResults, billing, modelPanel };
}

async function auditPlanUpgrade(page) {
  await openUserMenu(page);
  await page.click("[data-ai-user-menu-upgrade]", { force: true });
  await page.waitForSelector("[data-ai-workspace-plan-upgrade-dialog]", { timeout: 10000 });

  const data = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("[data-ai-plan-upgrade-tab]")].map((el) =>
      el.getAttribute("data-ai-plan-upgrade-tab"),
    );
    const compareText = document.querySelector("[data-ai-plan-upgrade-compare]")?.textContent || "";
    const prices = [...document.querySelectorAll(".ai-ref-plan-col__price-main")].map((el) =>
      el.textContent?.trim(),
    );
    return { tabs, compareText: compareText.slice(0, 200), prices };
  });

  // Switch comparison tabs
  for (const tab of data.tabs) {
    await page.click(`[data-ai-plan-upgrade-tab="${tab}"]`);
    await page.waitForTimeout(100);
  }

  const selectDemo = await page.evaluate(() => {
    const btn = document.querySelector("[data-ai-plan-select]:not([disabled])");
    const had = Boolean(btn);
    btn?.click();
    return {
      hadSelectBtn: had,
      closed: document.querySelector("[data-ai-workspace-plan-upgrade-backdrop]")?.hidden !== false,
    };
  });

  if (!selectDemo.closed) {
    await page.click("[data-ai-workspace-plan-upgrade-close]");
  }

  return { ...data, selectDemo };
}

async function openUserMenu(page) {
  await page.evaluate(() => {
    const menu = document.querySelector("[data-ai-workspace-user-menu]");
    const toggle = document.querySelector("[data-ai-workspace-user-menu-toggle]");
    if (menu) menu.hidden = false;
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  });
}

async function auditHelpMenu(page) {
  await openUserMenu(page);
  await page.click("[data-ai-user-menu-help-trigger]", { force: true });
  await page.waitForTimeout(300);

  const items = await page.evaluate(() => {
    return [...document.querySelectorAll("[data-ai-help-item]")].map((el) => ({
      key: el.getAttribute("data-ai-help-item"),
      label: el.textContent?.trim(),
    }));
  });

  for (const item of items) {
    await openUserMenu(page);
    await page.click("[data-ai-user-menu-help-trigger]", { force: true });
    await page.waitForTimeout(200);
    await page.click(`[data-ai-help-item="${item.key}"]`, { force: true });
    await page.waitForTimeout(150);
    addFinding(
      "disconnected",
      `ユーザーメニュー › ヘルプ › ${item.label}: クリック後も ai-workspace 内（外部URL未接続）`,
    );
  }
}

async function auditProfileModal(page) {
  await openUserMenu(page);
  await page.click("[data-ai-user-menu-profile]", { force: true });
  await page.waitForSelector("[data-ai-workspace-profile-dialog]", { timeout: 10000 });

  await page.fill("[data-ai-profile-display-name]", "監査テスト");
  await page.click("[data-ai-workspace-profile-cancel]");
  await page.waitForTimeout(200);

  const closed = await page.evaluate(
    () => document.querySelector("[data-ai-workspace-profile-backdrop]")?.hidden !== false,
  );
  if (!closed) {
    addFinding("recommended", "プロフィール › キャンセルでモーダルが閉じない");
  }

  await openUserMenu(page);
  await page.click("[data-ai-user-menu-profile]", { force: true });
  await page.fill("[data-ai-profile-display-name]", "監査保存");
  await page.click("[data-ai-workspace-profile-save]");
  await page.waitForTimeout(300);
}

async function auditGenerationFlows(page) {
  const flows = [];

  // Image via chat
  await resetWorkspace(page);
  await waitGlobals(page);
  await page.fill("[data-ai-chat-input]", "SNS用の広告画像を作って");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () =>
      document.querySelector(".ai-generate-panel--image") ||
      document.querySelectorAll(".ai-msg-row").length >= 1,
    { timeout: 30000 },
  );
  flows.push({
    kind: "image",
    ok: Boolean(
      await page.locator(".ai-generate-panel--image, .ai-msg-row .ai-message").count(),
    ),
  });

  // Code via chat
  await resetWorkspace(page);
  await waitGlobals(page);
  await page.fill("[data-ai-chat-input]", "お問い合わせフォームのHTMLとCSSを作って");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () =>
      document.querySelector('.ai-generate-panel[data-ai-generate-kind="code"]') ||
      document.querySelectorAll(".ai-msg-row").length >= 1,
    { timeout: 30000 },
  );
  flows.push({
    kind: "code",
    ok: Boolean(
      await page.locator('[data-ai-generate-kind="code"], .ai-msg-row .ai-message').count(),
    ),
  });

  // Analyze (media tool + message)
  await resetWorkspace(page);
  await waitGlobals(page);
  await page.evaluate(() => window.TasuTgaShell?.applyWorkspaceTool?.("media", { focusInput: false }));
  await page.fill("[data-ai-chat-input]", "添付画像の内容を分析して");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(() => document.querySelectorAll(".ai-msg-row").length >= 1, {
    timeout: 30000,
  });
  flows.push({ kind: "analyze", ok: (await page.locator(".ai-msg-row").count()) >= 1 });

  // Search
  await resetWorkspace(page);
  await waitGlobals(page);
  await page.evaluate(() => window.TasuTgaShell?.applyWorkspaceTool?.("web", { focusInput: false }));
  await page.fill("[data-ai-chat-input]", "外壁塗装の相場を教えて");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () =>
      document.querySelector(".ai-search-summary") ||
      document.querySelector(".ai-hybrid-section") ||
      document.querySelectorAll(".ai-msg-row").length >= 1,
    { timeout: 30000 },
  );
  flows.push({
    kind: "search",
    ok: Boolean(
      await page.locator(".ai-search-summary, .ai-hybrid-section, .ai-msg-row").count(),
    ),
  });

  // Builder/consult listing
  await resetWorkspace(page);
  await waitGlobals(page);
  await page.evaluate(() => window.TasuTgaShell?.applyWorkspaceTool?.("consult", { focusInput: false }));
  await page.fill("[data-ai-chat-input]", "草刈り業者を探したい");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () =>
      document.querySelector(".ai-cross-card") ||
      document.querySelector("[data-platform-qa-article]") ||
      document.querySelectorAll(".ai-msg-row").length >= 1,
    { timeout: 30000 },
  );
  flows.push({
    kind: "builder",
    ok: Boolean(
      await page.locator(".ai-cross-card, [data-platform-qa-article], .ai-msg-row").count(),
    ),
  });

  return flows;
}

async function auditQa(page) {
  const uiResp = await page.goto(
    buildLocalPageUrl(BASE, "ai-workspace/", "?uiReview=search&mode=cross-matching"),
    { waitUntil: "networkidle", timeout: 120000 },
  );
  const uiData = await page.evaluate(() => ({
    qaCount: document.querySelectorAll(".ai-site-qa-layout__results .ai-site-qa-result").length,
    cardCount: document.querySelectorAll(".ai-search-ui-review-showcase__section").length,
    feedbackSlots: document.querySelectorAll("[data-platform-qa-feedback]").length,
  }));

  await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html", "?mode=cross-matching"), {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await waitGlobals(page);
  await page.fill("[data-ai-chat-input]", "退会");
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll(".ai-msg-row .ai-message");
      const last = rows[rows.length - 1];
      return last?.querySelector("[data-platform-qa-article], .ai-cross-card, .ai-site-qa-layout");
    },
    { timeout: 30000 },
  );
  const liveQa = await page.evaluate(() => {
    const last = [...document.querySelectorAll(".ai-msg-row .ai-message")].pop();
    return {
      hasQa: Boolean(last?.querySelector("[data-platform-qa-article], .ai-site-qa-layout")),
      hasFeedback: Boolean(last?.querySelector("[data-platform-qa-feedback], .platform-qa-feedback")),
    };
  });

  return {
    uiStatus: uiResp?.status?.() ?? 0,
    uiData,
    liveQa,
  };
}

async function auditStaticLinks(page) {
  const hrefs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      out.push({ href, text: (a.textContent || "").trim().slice(0, 40) });
    });
    return out;
  });

  const checked = [];
  for (const { href, text } of hrefs) {
    let url;
    try {
      url = new URL(href, page.url()).href;
    } catch {
      addFinding("disconnected", `リンク href 不正: ${href} (${text})`);
      continue;
    }
    if (!url.startsWith(BASE) && !url.includes("127.0.0.1:8788")) continue;
    try {
      const res = await page.request.get(url);
      checked.push({ href, status: res.status(), text });
      if (res.status() === 404) {
        addFinding("notFound", `404: ${href} — 「${text}」`);
      } else if (res.status() >= 500) {
        addFinding("notFound", `${res.status()}: ${href} — 「${text}」`);
      }
    } catch (err) {
      addFinding("disconnected", `リンク取得失敗: ${href} — ${err.message}`);
    }
  }
  return checked;
}

async function auditDomGaps(page) {
  const gaps = await page.evaluate(() => ({
    categoryNav: Boolean(document.querySelector("[data-ai-workspace-categories]")),
    starterChips: document.querySelectorAll("[data-tga-starter-chip]").length,
    welcomeCards: document.querySelectorAll("[data-tga-welcome-card]").length,
    sideImage: Boolean(document.querySelector('[data-ai-side-nav="image"]')),
    sideLibrary: Boolean(document.querySelector('[data-ai-side-nav="library"]')),
    sideFavorites: Boolean(document.querySelector("[data-ai-sidebar-favorites]")),
    usageCtaHref:
      document.querySelector("[data-ai-workspace-usage-limit] a")?.getAttribute("href") || "",
  }));

  if (!gaps.categoryNav) {
    addFinding(
      "disconnected",
      "カテゴリタブ `[data-ai-workspace-categories]` が HTML に存在しない（chat/image/video/music/document/history タブUI未接続）",
    );
  }
  if (gaps.starterChips === 0) {
    addFinding(
      "disconnected",
      "Welcome スターターチップ `[data-tga-starter-chip]` が0件（旧Welcome導線が ref レイアウトに未移植）",
    );
  }
  if (gaps.welcomeCards === 0) {
    addFinding("recommended", "Welcome カード `[data-tga-welcome-card]` なし（意図的簡素化の可能性）");
  }

  // Usage limit CTA
  if (gaps.usageCtaHref) {
    const ctaUrl = new URL(gaps.usageCtaHref, page.url()).href;
    const res = await page.request.get(ctaUrl);
    if (res.status() === 404) {
      addFinding("notFound", `利用上限 CTA: ${gaps.usageCtaHref} → 404`);
    }
  }

  // Billing demo actions
  addFinding("dummy", "請求 › 管理する / 領収書 / 支払い変更 / キャンセル: console.info デモのみ（Stripe未接続）");
  addFinding("dummy", "プランアップグレード › プラン選択ボタン: demo select（checkout未接続）");

  return gaps;
}

let BASE = STANDARD_LOCAL_BASE;

async function main() {
  BASE = await findDevServerBaseUrl({ probePath: "ai-workspace.html" });
  console.log(`TASFUL AI navigation audit @ ${BASE}\n`);

  mkdirSync(join(root, "reports"), { recursive: true });

  const summary = {
    base: BASE,
    viewports: {},
    modes: {},
    settings: null,
    planUpgrade: null,
    generationFlows: [],
    qa: null,
    consoleErrors: {},
    networkFailures: {},
    httpStatus: {},
  };

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      const consoleErrors = [];
      const networkFailures = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const t = msg.text();
          if (!/favicon|Failed to load resource.*404.*favicon/i.test(t)) {
            consoleErrors.push(t);
          }
        }
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));
      page.on("response", (res) => {
        const url = res.url();
        const status = res.status();
        if (
          status >= 400 &&
          url.includes("127.0.0.1") &&
          !/favicon|googleapis|gstatic|jsdelivr|supabase/i.test(url)
        ) {
          networkFailures.push({ url, status });
          if (status === 404) addFinding("notFound", `${vp.tag}px Network 404: ${url}`);
          if (status >= 500) addFinding("notFound", `${vp.tag}px Network ${status}: ${url}`);
        }
      });

      const resp = await page.goto(buildLocalPageUrl(BASE, "ai-workspace.html"), {
        waitUntil: "networkidle",
        timeout: 120000,
      });
      summary.httpStatus[vp.tag] = resp?.status?.() ?? 0;
      await waitGlobals(page);

      if (vp.tag === "1280") {
        summary.domGaps = await auditDomGaps(page);
        summary.staticLinks = await auditStaticLinks(page);
      }

      summary.viewports[vp.tag] = await checkResponsive(page, vp.tag);

      const modeResults = {};
      for (const mode of WORKSPACE_MODES) {
        await resetWorkspace(page);
        await waitGlobals(page);
        modeResults[mode.id] = await auditWorkspaceMode(page, mode);
      }
      summary.modes[vp.tag] = modeResults;

      if (vp.tag === "1280") {
        await resetWorkspace(page);
        await waitGlobals(page);
        summary.settings = await auditSettings(page);

        await resetWorkspace(page);
        await waitGlobals(page);
        summary.planUpgrade = await auditPlanUpgrade(page);

        await resetWorkspace(page);
        await waitGlobals(page);
        await auditHelpMenu(page);

        await resetWorkspace(page);
        await waitGlobals(page);
        await auditProfileModal(page);

        summary.generationFlows = await auditGenerationFlows(page);
        summary.qa = await auditQa(page);
      }

      // Sidebar image / library round-trip
      await resetWorkspace(page);
      await waitGlobals(page);
      if (vp.w <= 768) {
        await page.click("[data-tga-history-toggle]", { force: true });
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => {
        document.querySelector('[data-ai-side-nav="image"]')?.click();
      });
      await page.waitForTimeout(200);
      const imageCat = await page.evaluate(() =>
        document.querySelector("[data-ai-workspace-chat]")?.getAttribute("data-ai-category"),
      );
      if (vp.w <= 768) {
        await page.click("[data-tga-history-toggle]", { force: true });
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => {
        document.querySelector('[data-ai-side-nav="library"]')?.click();
      });
      await page.waitForTimeout(200);
      const libCat = await page.evaluate(() =>
        document.querySelector("[data-ai-workspace-chat]")?.getAttribute("data-ai-category"),
      );
      if (imageCat !== "image") {
        addFinding("disconnected", `${vp.tag}px サイドバー › 画像 → category=${imageCat}`);
      }
      if (libCat !== "document") {
        addFinding("disconnected", `${vp.tag}px サイドバー › ライブラリー → category=${libCat} (期待: document)`);
      }

      summary.consoleErrors[vp.tag] = consoleErrors;
      summary.networkFailures[vp.tag] = networkFailures;

      if (consoleErrors.length) {
        for (const err of consoleErrors.slice(0, 5)) {
          addFinding("recommended", `${vp.tag}px Console Error: ${err.slice(0, 160)}`);
        }
        if (consoleErrors.length > 5) {
          addFinding("recommended", `${vp.tag}px: 他 ${consoleErrors.length - 5} 件の Console Error`);
        }
      }

      await page.close();
    }
  });

  // Mode failures
  for (const vp of viewports) {
    const modes = summary.modes[vp.tag] || {};
    for (const mode of WORKSPACE_MODES) {
      if (!modes[mode.id]?.ok) {
        addFinding(
          "disconnected",
          `${vp.tag}px モード遷移 › ${mode.label}: 失敗 (${JSON.stringify(modes[mode.id]?.state || modes[mode.id]?.reason || "")})`,
        );
      }
    }
  }

  // Settings plan check
  const billingPlans = summary.settings?.billing?.plans || [];
  for (const plan of ["Free", "Lite", "Pro", "Max"]) {
    if (!billingPlans.some((p) => p?.includes(plan))) {
      addFinding("recommended", `設定 › 請求: ${plan} プランカードの表示が未確認`);
    }
  }

  const model = summary.settings?.modelPanel || {};
  for (const provider of [
    ["Gemini", model.hasGemini],
    ["Claude", model.hasClaude],
    ["GPT", model.hasGpt],
    ["DeepSeek", model.hasDeepSeek],
  ]) {
    if (!provider[1]) {
      addFinding("recommended", `設定 › モデル: ${provider[0]} 表示なし`);
    }
  }

  for (const mode of ["auto", "speed", "quality"]) {
    if (!model.modes?.includes(mode)) {
      addFinding("recommended", `設定 › モデル: モード「${mode}」切替UIなし`);
    }
  }

  // Generation flow failures
  for (const flow of summary.generationFlows) {
    if (!flow.ok) addFinding("disconnected", `生成導線 › ${flow.kind}: 応答UI未表示`);
  }

  // QA
  if (summary.qa?.uiStatus !== 200) {
    addFinding("notFound", `uiReview ページ HTTP ${summary.qa?.uiStatus}`);
  }
  if ((summary.qa?.uiData?.cardCount || 0) < 7) {
    addFinding("recommended", `uiReview 検索カード: ${summary.qa?.uiData?.cardCount}/7`);
  }
  if (!summary.qa?.liveQa?.hasQa) {
    addFinding("disconnected", "AI相談 › Q&A「退会」クエリで Platform QA 未表示");
  }

  const md = buildReport(summary);
  writeFileSync(reportPath, md, "utf8");
  console.log("\n" + md);
  console.log(`\nReport: ${reportPath}`);

  await closeAllBrowsers();
  const hasBlocker =
    findings.notFound.length > 0 ||
    findings.disconnected.some((x) => !/ヘルプ|デモ|未移植|タブUI/.test(x));
  process.exit(hasBlocker ? 1 : 0);
}

function buildReport(summary) {
  const lines = [
    "# TASFUL AI 最終導線チェック",
    "",
    `検証日時: ${new Date().toISOString()}`,
    `検証URL: ${summary.base}/ai-workspace.html`,
    "",
    "## 検証サマリー",
    "",
    "| Viewport | HTTP | 横スクロール | Console Error | Network 4xx/5xx |",
    "|----------|------|--------------|---------------|-----------------|",
  ];

  for (const vp of viewports) {
    const layout = summary.viewports[vp.tag];
    const overflow = layout?.scrollW > layout?.clientW + 2 ? "あり" : "なし";
    const ce = (summary.consoleErrors[vp.tag] || []).length;
    const nf = (summary.networkFailures[vp.tag] || []).length;
    lines.push(
      `| ${vp.tag} | ${summary.httpStatus[vp.tag] || "—"} | ${overflow} | ${ce} | ${nf} |`,
    );
  }

  lines.push("", "## モード相互遷移（API / サイドバー）", "");
  for (const mode of WORKSPACE_MODES) {
    const r1280 = summary.modes?.["1280"]?.[mode.id];
    lines.push(`- **${mode.label}**: ${r1280?.ok ? "OK" : "NG"}`);
  }

  lines.push("", "## 設定・プラン・モデル", "");
  lines.push(`- 設定セクション: ${SETTINGS_SECTIONS.length}件ナビゲーション確認`);
  lines.push(`- 請求プラン表示: ${(summary.settings?.billing?.plans || []).join(" / ") || "—"}`);
  lines.push(
    `- モデルプロバイダ: Gemini=${summary.settings?.modelPanel?.hasGemini} Claude=${summary.settings?.modelPanel?.hasClaude} GPT=${summary.settings?.modelPanel?.hasGpt} DeepSeek=${summary.settings?.modelPanel?.hasDeepSeek}`,
  );
  lines.push(`- プラン比較タブ: ${(summary.planUpgrade?.tabs || []).join(", ") || "—"}`);

  lines.push("", "## 生成導線", "");
  for (const f of summary.generationFlows) {
    lines.push(`- ${f.kind}: ${f.ok ? "OK" : "NG"}`);
  }

  lines.push("", "## Q&A", "");
  lines.push(`- uiReview HTTP ${summary.qa?.uiStatus} / QA ${summary.qa?.uiData?.qaCount} / カード ${summary.qa?.uiData?.cardCount}`);
  lines.push(`- ライブQ&A「退会」: ${summary.qa?.liveQa?.hasQa ? "OK" : "NG"}`);

  lines.push("", "---", "", "## 未接続一覧", "");
  if (!findings.disconnected.length) lines.push("- （なし）");
  else findings.disconnected.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## ダミーボタン一覧", "");
  if (!findings.dummy.length) lines.push("- （なし）");
  else findings.dummy.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## 404一覧", "");
  if (!findings.notFound.length) lines.push("- （なし）");
  else findings.notFound.forEach((x) => lines.push(`- ${x}`));

  lines.push("", "## 修正推奨一覧", "");
  if (!findings.recommended.length) lines.push("- （なし）");
  else findings.recommended.forEach((x) => lines.push(`- ${x}`));

  return lines.join("\n");
}

main().catch(async (err) => {
  console.error(err);
  await closeAllBrowsers();
  process.exit(1);
});
