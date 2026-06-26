#!/usr/bin/env node
/**
 * TASFUL AI Workspace — usage enforcement Phase 1
 *   node scripts/test-ai-workspace-usage-enforcement-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function pageUrl(rel, query = "") {
  const base = process.env.BUILDER_BASE_URL;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}${q}`;
  return pathToFileURL(path.join(root, rel.replace(/^\//, ""))).href + q;
}

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

const USAGE_KEY = "tasu_ai_workspace_usage";
const PLAN_KEY = "tasu_genai_plan";
const TLV_KEY = "tasu_ai_tlv_free_remaining";

async function bootWorkspace(page, query = "") {
  await page.goto(pageUrl("ai-workspace.html", query), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.TasuAiChat?.sendMessage &&
      window.TasuAiWorkspaceUsage?.canUse &&
      window.TasuAiModelGateway?.completeTurn,
    null,
    { timeout: 25000 }
  );
}

async function resetStorage(page, { usage = null, plan = null, tlv = null } = {}) {
  await page.evaluate(
    ({ usage, plan, tlv, USAGE_KEY, PLAN_KEY, TLV_KEY }) => {
      if (usage === null) localStorage.removeItem(USAGE_KEY);
      else localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
      if (plan === null) localStorage.removeItem(PLAN_KEY);
      else localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
      if (tlv === null) localStorage.removeItem(TLV_KEY);
      else localStorage.setItem(TLV_KEY, String(tlv));
      try {
        sessionStorage.removeItem("tasu_ai_chat_cross-matching");
      } catch {
        /* ignore */
      }
      window.__usageTestTurns = [];
      window.__usageTestConsumeCount = 0;
      const Usage = window.TasuAiWorkspaceUsage;
      if (Usage) Usage.updateUsageUi();
    },
    { usage, plan, tlv, USAGE_KEY, PLAN_KEY, TLV_KEY }
  );
}

async function installGatewayHook(page, mode = "remote") {
  await page.evaluate((mode) => {
    const gw = window.TasuAiModelGateway;
    if (!gw || gw.__usageTestHooked) return;
    gw.__usageTestHooked = true;
    const orig = gw.completeTurn.bind(gw);
    gw.completeTurn = async (params) => {
      window.__usageTestTurns.push({ userText: params.userText, surface: params.surface });
      if (mode === "remote") {
        return {
          reply: "usage-test remote reply",
          modelId: "gemini-flash",
          modelLabel: "Gemini",
          modelProvider: "gemini",
          usedRemote: true,
          fallback_used: false,
          search_used: false,
        };
      }
      return {
        reply: "usage-test mock fallback",
        modelId: "gemini-flash",
        modelLabel: "Gemini",
        modelProvider: "gemini",
        usedRemote: false,
        fallback_used: true,
        search_used: false,
      };
    };
    window.__usageOrigCompleteTurn = orig;
  }, mode);
}

async function patchConsumeCounter(page) {
  await page.evaluate(() => {
    const Usage = window.TasuAiWorkspaceUsage;
    if (!Usage || Usage.__consumePatched) return;
    Usage.__consumePatched = true;
    const orig = Usage.consume.bind(Usage);
    Usage.consume = (featureKey) => {
      window.__usageTestConsumeCount = (window.__usageTestConsumeCount || 0) + 1;
      return orig(featureKey);
    };
  });
}

async function sendChat(page, text = "usage enforcement test") {
  await page.evaluate(() => {
    const root = document.querySelector("[data-ai-workspace-chat]");
    const webInput = root?.querySelector('[data-ai-search-target-input][value="web"]');
    if (webInput) {
      webInput.checked = true;
      webInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.TasuAiSearchTarget?.syncTargetOnRoot?.(root, "web");
  });
  await page.fill("[data-ai-chat-input]", text);
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () => !document.querySelector("[data-ai-workspace-chat]")?.dataset?.aiChatSending,
    null,
    { timeout: 30000 }
  );
}

async function main() {
  const today = await withPlaywrightBrowser(async (browser) => {
    const p = await browser.newPage();
    await p.goto(pageUrl("ai-workspace.html"));
    return p.evaluate(() => window.TasuAiWorkspaceUsage?.getUsage?.()?.date || "2026/01/01");
  });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    // --- API: shouldChargeTurn ---
    await bootWorkspace(page);
    await page.evaluate(() => {
      const U = window.TasuAiWorkspaceUsage;
      window.__chargeRemote = U.shouldChargeTurn({
        reply: "ok",
        usedRemote: true,
        fallback_used: false,
      });
      window.__chargeMock = U.shouldChargeTurn({
        reply: "mock",
        usedRemote: false,
        fallback_used: true,
      });
    });
    const chargeFlags = await page.evaluate(() => ({
      remote: window.__chargeRemote,
      mock: window.__chargeMock,
    }));
    assert("shouldChargeTurn remote", chargeFlags.remote === true);
    assert("shouldChargeTurn mock/fallback", chargeFlags.mock === false);

    // --- canUse block when depleted ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 5 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    });
    await installGatewayHook(page, "remote");
    const beforeCount = await page.evaluate(() => window.__usageTestTurns?.length || 0);
    await sendChat(page, "blocked send");
    const afterCount = await page.evaluate(() => window.__usageTestTurns?.length || 0);
    assert("canUse blocks send when depleted", afterCount === beforeCount, `turns ${beforeCount}->${afterCount}`);
    const limitVisible = await page.evaluate(
      () => !document.querySelector("[data-ai-workspace-usage-limit]")?.hidden
    );
    assert("depleted UI limit banner visible", limitVisible);
    const ctaHref = await page.evaluate(() =>
      document.querySelector(".ai-workspace-usage-limit__cta")?.getAttribute("href")
    );
    assert("CTA points to gen-ai-workspace", ctaHref === "gen-ai-workspace.html");

    // --- consume on usedRemote ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 0 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    });
    await installGatewayHook(page, "remote");
    await patchConsumeCounter(page);
    await sendChat(page, "charge remote");
    const consumed = await page.evaluate(() => ({
      count: window.__usageTestConsumeCount || 0,
      used: JSON.parse(localStorage.getItem("tasu_ai_workspace_usage") || "{}").textTurnUsed || 0,
      turns: window.__usageTestTurns?.length || 0,
    }));
    assert(
      "consume on usedRemote",
      consumed.count === 1 && consumed.used === 1,
      `count=${consumed.count} used=${consumed.used} turns=${consumed.turns}`
    );

    // --- mock/fallback no charge ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 0 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    });
    await page.evaluate(() => {
      window.TasuAiModelGateway.__usageTestHooked = false;
    });
    await installGatewayHook(page, "mock");
    await patchConsumeCounter(page);
    await sendChat(page, "no charge mock");
    const mockConsumed = await page.evaluate(() => ({
      count: window.__usageTestConsumeCount || 0,
      used: JSON.parse(localStorage.getItem("tasu_ai_workspace_usage") || "{}").textTurnUsed || 0,
    }));
    assert("mock/fallback no consume", mockConsumed.count === 0 && mockConsumed.used === 0);

    // --- basic_300 plan limit 30 ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 29 },
      plan: { plan: "basic_300", label: "スタンダード", dailyTextLimit: 30 },
    });
    const canBasic = await page.evaluate(() => window.TasuAiWorkspaceUsage.canUse("text_turn"));
    assert("basic_300 allows at 29/30", canBasic === true);
    await page.evaluate(() => {
      localStorage.setItem(
        "tasu_ai_workspace_usage",
        JSON.stringify({ date: window.TasuAiWorkspaceUsage.getUsage().date, textTurnUsed: 30 })
      );
      window.TasuAiWorkspaceUsage.updateUsageUi();
    });
    const canBasicBlocked = await page.evaluate(() => window.TasuAiWorkspaceUsage.canUse("text_turn"));
    assert("basic_300 blocks at 30/30", canBasicBlocked === false);

    // --- pro_980 plan limit 100 ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 99 },
      plan: { plan: "pro_980", label: "プロ", dailyTextLimit: 100 },
    });
    const canPro = await page.evaluate(() => window.TasuAiWorkspaceUsage.canUse("text_turn"));
    assert("pro_980 allows at 99/100", canPro === true);

    // --- TLV remaining ---
    await bootWorkspace(page, "source=tlv");
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 0 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
      tlv: 0,
    });
    const tlvBlocked = await page.evaluate(() => window.TasuAiWorkspaceUsage.canUse("text_turn"));
    assert("TLV depleted blocks canUse", tlvBlocked === false);
    const tlvBanner = await page.evaluate(() => Boolean(document.querySelector("[data-tlv-free-quota]")));
    assert("TLV quota banner present", tlvBanner);

    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 0 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
      tlv: 2,
    });
    await page.evaluate(() => {
      window.TasuAiModelGateway.__usageTestHooked = false;
    });
    await installGatewayHook(page, "remote");
    await patchConsumeCounter(page);
    await sendChat(page, "tlv consume");
    const tlvAfter = await page.evaluate(() => ({
      tlv: parseInt(localStorage.getItem("tasu_ai_tlv_free_remaining") || "0", 10),
      workspace: JSON.parse(localStorage.getItem("tasu_ai_workspace_usage") || "{}").textTurnUsed,
    }));
    assert("TLV decrement on consume", tlvAfter.tlv === 1 && tlvAfter.workspace === 1);

    // --- status UI ---
    await bootWorkspace(page);
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 2 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    });
    await page.evaluate(() => window.TasuAiWorkspaceUsage.updateUsageUi());
    const statusText = await page.evaluate(() =>
      document.querySelector("[data-ai-workspace-usage-status]")?.textContent?.trim()
    );
    assert("usage status banner text", /残り 3 \/ 5/.test(statusText || ""), statusText || "");

    // --- regression: normal chat path with remote ---
    await resetStorage(page, {
      usage: { date: today, textTurnUsed: 0 },
      plan: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    });
    await page.evaluate(() => {
      window.TasuAiModelGateway.__usageTestHooked = false;
    });
    await installGatewayHook(page, "remote");
    await sendChat(page, "regression path");
    const msgCount = await page.evaluate(
      () => document.querySelectorAll("[data-ai-chat-messages] .ai-msg-row").length
    );
    assert("regression assistant message rendered", msgCount >= 1, `count=${msgCount}`);
  });

  await closeAllBrowsers();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  x ${f.name}: ${f.detail || ""}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
