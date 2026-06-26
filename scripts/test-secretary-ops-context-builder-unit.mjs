#!/usr/bin/env node
/**
 * OpsContextBuilder unit tests (sanitize · domain map · build shape)
 *   node scripts/test-secretary-ops-context-builder-unit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeSandbox() {
  const store = {};
  const sandbox = {
    window: {},
    console,
    localStorage: {
      getItem(k) {
        return store[k] ?? null;
      },
      setItem(k, v) {
        store[k] = String(v);
      },
      removeItem(k) {
        delete store[k];
      },
    },
  };
  sandbox.globalThis = sandbox.window;

  sandbox.window.TasuAdminAiDailyInbox = {
    buildInboxItems() {
      return [
        {
          id: "inbox_support_1",
          source: "support",
          category: "needs_judgment",
          title: "問い合わせ test@example.com",
          reason: "本文",
          recommendedAction: "確認",
          priority: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: "inbox_builder_1",
          source: "builder",
          category: "pending_approval",
          title: "審査",
          target: "山田太郎",
          reason: "非表示",
          recommendedAction: "審査",
          priority: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "inbox_connect_1",
          source: "connect",
          category: "needs_judgment",
          title: "Connect",
          reason: "本人確認",
          recommendedAction: "Connect確認",
          priority: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: "inbox_market_1",
          source: "market",
          category: "pending_approval",
          title: "返金申請",
          reason: "order",
          recommendedAction: "注文確認",
          priority: 1,
          createdAt: new Date().toISOString(),
        },
      ];
    },
  };

  sandbox.window.TasuTalkOpsAssistant = {
    buildHubSections() {
      return {
        summaryText: "本日の状況サマリー",
        sections: [
          {
            id: "builder",
            items: [{ id: "hub_b1", title: "Builder警告", meta: "要注意", priority: "high" }],
          },
        ],
        metrics: {},
      };
    },
  };

  sandbox.window.TasuAdminAiKpiCenter = {
    KPI_SNAPSHOT_KEY: "tasu_ai_kpi_snapshots_test",
    collectKpiMetrics() {
      return {
        inquiries: 2,
        unresolved: 5,
        reports: 1,
        connectFailures: 1,
        builderPending: 2,
        highRisk: 1,
        marketOrderCreated: 3,
        marketRefundRequested: 1,
        paymentCount: 4,
      };
    },
    compareKpiWithPrevious(cur, prev) {
      return { inquiries: (cur.inquiries || 0) - (prev?.inquiries || 0) };
    },
  };

  sandbox.window.TasuAiInteractionLog = {
    readLogs() {
      return [
        {
          created_at: new Date().toISOString(),
          surface: "ops_secretary",
          ai_provider: "deepseek",
          fallback_used: false,
          search_used: false,
        },
        {
          created_at: new Date(Date.now() - 86400000).toISOString(),
          surface: "platform",
          ai_provider: "gemini",
          fallback_used: true,
          search_used: false,
        },
      ];
    },
  };

  return sandbox;
}

function loadModules(sandbox) {
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "admin-ai-secretary-ops-context-sanitize.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "admin-ai-secretary-ops-context.js"), "utf8"), ctx);
  return sandbox.window;
}

const w = loadModules(makeSandbox());
const San = w.TasuSecretaryOpsContextSanitize;
const Builder = w.TasuSecretaryOpsContextBuilder;

let pass = 0;
let fail = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
    pass += 1;
  } else {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    fail += 1;
  }
}

const masked = San.sanitizeText("連絡 test@example.com 09012345678", 200);
assert("PII email removed", !/@example\.com/.test(masked));
assert("PII phone removed", !/09012345678/.test(masked));

assert("map support", Builder.mapInboxDomain("support") === "support");
assert("map connect", Builder.mapInboxDomain("connect") === "stripe_connect");
assert("map market", Builder.mapInboxDomain("market") === "platform");

const ctx = Builder.build({ filters: {} });
assert("schema version", ctx.schemaVersion === "ops_context_v1");
assert("six domains", Object.keys(ctx.domains).length === 6);
assert("support items", (ctx.domains.support?.topItems?.length || 0) >= 1);
assert("builder items", (ctx.domains.builder?.topItems?.length || 0) >= 1);
assert("stripe_connect items", (ctx.domains.stripe_connect?.topItems?.length || 0) >= 1);
assert("platform items", (ctx.domains.platform?.topItems?.length || 0) >= 1);
assert("tlv stub", ctx.domains.tlv?.dataQuality === "stub");
assert("ai_usage metrics", (ctx.domains.ai_usage?.metrics?.weekCount || 0) >= 1);

const prompt = Builder.formatForSystemPrompt(ctx);
assert("prompt has header", /運営コンテキスト/.test(prompt));
assert("prompt budget", prompt.length <= Builder.CHAR_BUDGET + 50, `len=${prompt.length}`);
assert("no raw email in prompt", !/@example\.com/.test(prompt));

const builderOnly = Builder.build({ filters: { domains: ["builder"] } });
assert("domain filter", Object.keys(builderOnly.domains).length === 1 && builderOnly.domains.builder);

console.log(`\n--- ${pass}/${pass + fail} PASS ---`);
process.exit(fail ? 1 : 0);
