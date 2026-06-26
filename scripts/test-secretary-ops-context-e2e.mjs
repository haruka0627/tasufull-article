#!/usr/bin/env node
/**
 * OpsContextBuilder Phase 2 — dev/file E2E (systemPrompt injection)
 *   BUILDER_BASE_URL=http://127.0.0.1:8788 node scripts/test-secretary-ops-context-e2e.mjs
 *   node scripts/test-secretary-ops-context-e2e.mjs   # file://
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  }
  const hashIdx = rel.indexOf("#");
  const filePart = hashIdx >= 0 ? rel.slice(0, hashIdx) : rel;
  const hash = hashIdx >= 0 ? rel.slice(hashIdx + 1) : "";
  const url = pathToFileURL(path.join(root, filePart));
  if (hash) url.hash = hash;
  return url.href;
}

function isIgnorableConsoleError(text) {
  const t = String(text || "").replace(/^\[[\w.]+\]\s*/, "");
  return /favicon|ERR_BLOCKED_BY_CLIENT|CORS|ERR_FAILED|serper-search|\/api\/secretary-deepseek-chat|supabase\.co|Failed to load resource/i.test(
    t
  );
}

const results = [];
function assert(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  if (cond) console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
  else console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

const PROMPTS = [
  {
    name: "prioritize intent",
    text: "今日は何を優先？",
    check: (p) => /運営コンテキスト/.test(p) && /優先|KPI|未対応|Support/i.test(p),
  },
  {
    name: "builder domain filter",
    text: "Builderだけ教えて",
    check: (p) =>
      /運営コンテキスト/.test(p) &&
      /domains=builder|フィルタ:.*builder/i.test(p) &&
      /### Builder/.test(p),
  },
  {
    name: "diffOnly intent",
    text: "昨日から増えたもの",
    check: (p) => /運営コンテキスト/.test(p) && (/差分|前日|増加|新規/i.test(p) || /diff/i.test(p)),
  },
];

async function main() {
  const mode = process.env.BUILDER_BASE_URL ? `dev:${process.env.BUILDER_BASE_URL}` : "file://";
  console.log(`E2E mode: ${mode}`);

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
        if (/admin-operations-dashboard|admin-ai-secretary|ops-context/.test(url)) {
          networkErrors.push(`${res.status()} ${url}`);
        }
      }
    });

    await page.goto(pageUrl("admin-operations-dashboard.html#ops-ai-command-center"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () =>
        window.TasuSecretaryOpsContextBuilder?.build &&
        window.TasuAdminAiSecretaryPhase2?.buildSystemPrompt,
      null,
      { timeout: 20000 }
    );

    await page.evaluate(() => {
      const Adapter = window.TasuSecretaryDeepSeekAdapter;
      if (!Adapter || Adapter.__opsCtxE2eHooked) return;
      Adapter.__opsCtxE2eHooked = true;
      const orig = Adapter.completeTurn.bind(Adapter);
      Adapter.completeTurn = async (params) => {
        window.__lastSecretarySystemPrompt = params?.systemPrompt || "";
        return {
          ok: true,
          reply: "ops context e2e mock",
          modelLabel: "DeepSeek",
          fallback_used: false,
        };
      };
    });

    for (const spec of PROMPTS) {
      await page.evaluate(() => {
        window.__lastSecretarySystemPrompt = "";
      });
      await page.fill("[data-ops-secretary-input]", spec.text);
      await page.click("[data-ops-secretary-send]");
      await page.waitForFunction(
        () => window.__lastSecretarySystemPrompt?.length > 100,
        null,
        { timeout: 10000 }
      );
      const prompt = await page.evaluate(() => window.__lastSecretarySystemPrompt || "");
      assert(spec.name, spec.check(prompt), `len=${prompt.length}`);
      assert(`${spec.name} no raw email`, !/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(prompt));
    }

    const buildOnly = await page.evaluate(() => {
      const p = window.TasuAdminAiSecretaryPhase2.buildSystemPrompt("本日の優先対応は？");
      return {
        hasHeader: /運営コンテキスト/.test(p),
        hasTlvStub: /TLV.*未接続|stub/i.test(p),
        len: p.length,
      };
    });
    assert("buildSystemPrompt header", buildOnly.hasHeader);
    assert("TLV stub in context", buildOnly.hasTlvStub);
    assert("prompt budget", buildOnly.len <= 8000, `len=${buildOnly.len}`);
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
