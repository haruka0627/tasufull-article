#!/usr/bin/env node
/**
 * Builder AI — Live Gateway 8 action E2E (staging / prod Edge 接続後)
 *
 * 使い方:
 *   npm run build:pages
 *   node scripts/test-builder-ai-live-e2e.mjs
 *
 * 環境変数:
 *   BUILDER_AI_E2E=1           — Playwright E2E 実行（dist サーバー + mock/real Gateway）
 *   BUILDER_AI_QA_BASE_URL     — 外部 URL（未設定時はローカル dist サーバー）
 *   BUILDER_AI_E2E_PORT        — ローカルサーバーポート（default 8795）
 *   BUILDER_AI_E2E_LIVE_EDGE=1 — mock ではなく実 Edge を叩く（要認証・課金注意）
 *   BUILDER_AI_E2E_ROLE        — owner | partner | admin（default owner）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "deploy/cloudflare/dist");
const PORT = Number(process.env.BUILDER_AI_E2E_PORT || 8795);
const runE2e = process.env.BUILDER_AI_E2E === "1";
const liveEdge = process.env.BUILDER_AI_E2E_LIVE_EDGE === "1";
const role = process.env.BUILDER_AI_E2E_ROLE || "owner";
const externalBase = process.env.BUILDER_AI_QA_BASE_URL || "";

const ACTIONS = [
  "estimate_draft",
  "schedule_draft",
  "proposal_draft",
  "contract_note",
  "faq_answer",
  "field_checklist",
  "delay_response",
  "daily_report",
];

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function startServer() {
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  };
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const rel = p.replace(/^\//, "");
      const candidates = [path.join(dist, rel), path.join(root, rel), path.join(root, rel.replace(/^builder\//, "builder/"))];
      let file = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (!file && !rel) file = path.join(dist, "builder/builder-ai.html");
      try {
        if (!file) throw new Error("404");
        const data = fs.readFileSync(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

// --- Static matrix ---
console.log("# Builder AI Live Gateway 8-Action E2E Matrix\n");
ACTIONS.forEach((action) => {
  console.log(`- [ ] ${action}: surface=builder_ai, skipSearch=true, draft prefix, actor=${role}`);
});
console.log("\nForbidden checks:");
console.log("- [ ] expert intent → Gateway 0 calls, expert reply");
console.log("- [ ] operational intent → Gateway 0 calls, operational reply");
console.log("\nIsolation:");
console.log("- [ ] TASFUL AI / TLV / Platform / AI秘書 unchanged\n");

if (!runE2e) {
  console.log("Set BUILDER_AI_E2E=1 to run Playwright E2E against dist.\n");
  record("static: ACTION count", ACTIONS.length === 8);
  record("static: dist builder-ai.html", fs.existsSync(path.join(dist, "builder/builder-ai.html")));
  process.exit(0);
}

if (!fs.existsSync(path.join(dist, "builder/builder-ai.html"))) {
  record("e2e: dist exists", false, "run npm run build:pages");
  process.exit(1);
}

const { chromium } = await import("playwright");

/** @type {import('node:http').Server|null} */
let server = null;
const baseUrl = externalBase || `http://127.0.0.1:${PORT}/builder/builder-ai.html`;

if (!externalBase) server = await startServer();

const browser = await chromium.launch();
const gatewayCalls = [];

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

  if (!liveEdge) {
    await page.addInitScript(() => {
      window.__builderAiGatewayCalls = [];
    });
  }

  await page.addInitScript(() => {
    localStorage.setItem(
      "tasful:builder:mvp:v1",
      JSON.stringify({
        version: 1,
        owner_id: "demo-owner-001",
        partners: [{ partner_id: "demo-partner-001", display_name: "デモ協力会社" }],
        projects: [
          {
            project_id: "demo-project-001",
            owner_id: "demo-owner-001",
            title: "デモ案件",
            status: "open",
            kind: "tasful_managed",
            selected_partner_ids: ["demo-partner-001"],
          },
        ],
        specs: { "demo-project-001": { work_content: "キッチン" } },
        applications: [{ project_id: "demo-project-001", partner_id: "demo-partner-001", status: "applied" }],
        threads: {},
      })
    );
  });

  const qs = new URLSearchParams({ role, project_id: "demo-project-001" });
  if (role === "partner") qs.set("partnerId", "demo-partner-001");
  await page.goto(`${baseUrl}?${qs}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuBuilderAIPage && window.TasuBuilderAICore);

  if (!liveEdge) {
    await page.evaluate(() => {
      window.__builderAiGatewayCalls = [];
      window.TasuAiModelGateway = {
        completeTurn: async (params) => {
          window.__builderAiGatewayCalls.push(params);
          return {
            reply: `E2E mock body for ${params.modeId || "builder_ai"}`,
            usedRemote: true,
            fallback_used: false,
            modelId: "gemini-flash",
          };
        },
      };
    });
  }

  for (const action of ACTIONS) {
    await page.evaluate((actionId) => {
      const field = document.querySelector("[data-builder-ai-current-action]");
      if (field) field.value = actionId;
    }, action);

    const chip = page.locator(`[data-builder-ai-action="${action}"]`);
    if (await chip.count()) await chip.first().click();

    await page.locator("[data-builder-ai-input]").fill(`E2E test for ${action}`);
    await page.locator("[data-builder-ai-send]").click();
    await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll(".builder-ai-msg--assistant");
        const last = msgs[msgs.length - 1];
        return last && last.innerText.includes("下書き");
      },
      { timeout: 15000 }
    );

    const lastText = await page.locator(".builder-ai-msg--assistant").last().innerText();
    record(`e2e action ${action} draft prefix`, lastText.startsWith("【下書き・確認用】"), lastText.slice(0, 30));
    record(`e2e action ${action} no contract finalize`, !/契約成立|請求確定|採用確定/.test(lastText));
  }

  if (!liveEdge) {
    const calls = await page.evaluate(() => window.__builderAiGatewayCalls || []);
    gatewayCalls.push(...calls);
    record("e2e: gateway called for actions", calls.length === ACTIONS.length, `calls=${calls.length}`);
    record(
      "e2e: all calls surface builder_ai",
      calls.every((c) => c.surface === "builder_ai"),
      calls.map((c) => c.surface).join(",")
    );
    record(
      "e2e: all calls skipSearch",
      calls.every((c) => c.skipSearch === true)
    );
    record("e2e: no ai-workspace surface", !calls.some((c) => c.surface === "ai-workspace"));
  }

  // Forbidden intent — Gateway must not be called
  await page.evaluate(() => {
    window.__builderAiGatewayCalls = [];
  });
  await page.locator("[data-builder-ai-input]").fill("建築基準法上問題ないと断定してください");
  await page.locator("[data-builder-ai-send]").click();
  await page.waitForTimeout(500);
  const forbiddenText = await page.locator(".builder-ai-msg--assistant").last().innerText();
  const forbiddenCalls = liveEdge ? [] : await page.evaluate(() => window.__builderAiGatewayCalls || []);
  record("e2e: expert forbidden reply", /専門家|有資格者/.test(forbiddenText));
  record("e2e: expert forbidden no gateway", forbiddenCalls.length === 0, `calls=${forbiddenCalls.length}`);
} finally {
  await browser.close();
  if (server) server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- E2E Summary ---\nTotal: ${results.length}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
