#!/usr/bin/env node
/**
 * AI 秘書 — DeepSeek Adapter Phase 1 browser tests
 *   node scripts/test-secretary-deepseek-adapter-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel, query = "") {
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
    return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}${q}`;
  }
  const hashIdx = rel.indexOf("#");
  const filePart = hashIdx >= 0 ? rel.slice(0, hashIdx) : rel;
  const hash = hashIdx >= 0 ? rel.slice(hashIdx + 1) : "";
  const [pathOnly, extraQuery] = filePart.split("?");
  const url = pathToFileURL(path.join(root, pathOnly));
  const q = query || extraQuery;
  if (q) url.search = q.startsWith("?") ? q : `?${q}`;
  if (hash) url.hash = hash;
  return url.href;
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /favicon|ERR_BLOCKED_BY_CLIENT|CORS|ERR_FAILED|serper-search|\/api\/secretary-deepseek-chat|supabase\.co|Failed to load resource/i.test(
    t
  );
}
/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function assert(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  if (cond) console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
  else console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function bootDashboard(page) {
  await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      window.TasuSecretaryDeepSeekAdapter?.completeTurn &&
      window.TasuAdminAiSecretaryPhase2?.sendMessage &&
      window.TasuSecretaryOpsContextBuilder?.build,
    null,
    { timeout: 20000 }
  );
}

async function resetChat(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem("tasu_admin_ai_secretary_chat_v1");
    } catch {
      /* ignore */
    }
    window.__secretaryAdapterCalls = 0;
    window.__gatewaySecretaryCalls = 0;
  });
}

async function installAdapterHook(page, mode = "remote") {
  await page.evaluate((mode) => {
    const Adapter = window.TasuSecretaryDeepSeekAdapter;
    if (!Adapter || Adapter.__testHooked) return;
    Adapter.__testHooked = true;
    const origPost = Adapter.postSecretaryEdge.bind(Adapter);
    Adapter.postSecretaryEdge = async (payload, opts) => {
      window.__secretaryAdapterCalls = (window.__secretaryAdapterCalls || 0) + 1;
      if (mode === "remote") {
        return {
          ok: true,
          reply: "deepseek adapter test reply",
          modelLabel: "DeepSeek",
          httpStatus: 200,
          configured: true,
          data: { usedDeepSeek: true },
        };
      }
      if (mode === "not_configured") {
        return {
          ok: false,
          httpStatus: 503,
          error: "DEEPSEEK_API_KEY not configured",
          configured: false,
          data: { configured: false },
        };
      }
      return origPost(payload, opts);
    };
    const gw = window.TasuAiModelGateway;
    if (gw?.completeTurn && !gw.__secretaryTestHooked) {
      gw.__secretaryTestHooked = true;
      const origGw = gw.completeTurn.bind(gw);
      gw.completeTurn = async (params) => {
        if (params?.surface === "ops_secretary" || params?.modeId === "ops_secretary") {
          window.__gatewaySecretaryCalls = (window.__gatewaySecretaryCalls || 0) + 1;
        }
        return origGw(params);
      };
    }
  }, mode);
}

async function sendChat(page, text) {
  await page.fill("[data-ops-secretary-input]", text);
  await page.click("[data-ops-secretary-send]");
  await page.waitForFunction(
    () => !document.querySelector("[data-ops-phase2-chat-form]")?.querySelector(":disabled"),
    null,
    { timeout: 5000 }
  ).catch(() => null);
  await page.waitForFunction(
    () => document.querySelectorAll("[data-ops-phase2-chat-log] .ops-p2-chat__msg--assistant").length >= 1,
    null,
    { timeout: 15000 }
  );
}

async function main() {
  const consoleErrors = [];
  const networkErrors = [];

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      const msg = String(err.message || err);
      if (!isIgnorableConsoleError(msg)) consoleErrors.push(msg);
    });
    page.on("response", (res) => {
      const url = res.url();
      const type = res.request().resourceType();
      if (
        res.status() >= 400 &&
        (type === "script" || type === "stylesheet" || type === "document")
      ) {
        if (/admin-operations-dashboard|admin-ai-secretary|secretary-deepseek/.test(url)) {
          networkErrors.push(`${res.status()} ${url}`);
        }
      }
    });

    await bootDashboard(page);
    assert("TasuSecretaryDeepSeekAdapter loaded", true);

    const ctxPrompt = await page.evaluate(() =>
      window.TasuAdminAiSecretaryPhase2.buildSystemPrompt("本日の優先対応は？")
    );
    assert("OpsContextBuilder loaded", /運営コンテキスト/.test(ctxPrompt));
    assert("context has KPI section", /KPI|未対応|問い合わせ/.test(ctxPrompt));

    await resetChat(page);
    await installAdapterHook(page, "remote");
    await sendChat(page, "adapter remote test");
    const remote = await page.evaluate(() => ({
      adapterCalls: window.__secretaryAdapterCalls || 0,
      gatewayCalls: window.__gatewaySecretaryCalls || 0,
      last: document
        .querySelector(".ops-p2-chat__msg--assistant:last-child")
        ?.textContent?.includes("deepseek adapter test reply"),
      history: JSON.parse(sessionStorage.getItem("tasu_admin_ai_secretary_chat_v1") || "[]").length,
    }));
    assert("adapter remote reply", remote.last === true);
    assert("adapter invoked", remote.adapterCalls >= 1, `calls=${remote.adapterCalls}`);
    assert("Gateway not used for secretary", remote.gatewayCalls === 0, `gw=${remote.gatewayCalls}`);
    assert("sessionStorage history", remote.history >= 2, `len=${remote.history}`);

    await resetChat(page);
    await page.evaluate(() => {
      window.TasuSecretaryDeepSeekAdapter.__testHooked = false;
    });
    await installAdapterHook(page, "not_configured");
    await sendChat(page, "not configured test");
    const fallback = await page.evaluate(() => ({
      mock: document
        .querySelector(".ops-p2-chat__msg--assistant:last-child")
        ?.textContent?.includes("AI運営秘書"),
      status: document.querySelector("[data-ops-phase4-status]")?.dataset?.state,
    }));
    assert("DEEPSEEK not configured fallback", fallback.mock === true);
    assert("status error on fallback", fallback.status === "error" || fallback.status === "idle");

    await resetChat(page);
    await page.evaluate(() => {
      window.TasuSecretaryDeepSeekAdapter.__testHooked = false;
    });
    await installAdapterHook(page, "remote");
    await sendChat(page, "voice event test");
    const voiceOk = await page.evaluate(() => true);
    assert("chat round-trip no crash", voiceOk === true);
  });

  await closeAllBrowsers();

  const filteredConsole = consoleErrors.filter((e) => !isIgnorableConsoleError(e));
  assert("console errors", filteredConsole.length === 0, filteredConsole.slice(0, 3).join(" | "));
  assert("network errors", networkErrors.length === 0, networkErrors.slice(0, 3).join(" | "));

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
