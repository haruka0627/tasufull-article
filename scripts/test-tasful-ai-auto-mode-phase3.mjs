#!/usr/bin/env node
/**
 * TASFUL AI Phase 3 — Auto Mode 静的 + 単体検証
 *   node scripts/test-tasful-ai-auto-mode-phase3.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

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
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function createSandbox() {
  const sandbox = {
    localStorage: {
      _d: {},
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
      removeItem(k) {
        delete this._d[k];
      },
    },
    document: { querySelector: () => null },
    location: { pathname: "/ai-workspace.html", search: "" },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    dispatchEvent() {},
    addEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function runIife(sandbox, rel) {
  const code = read(rel);
  const fn = new Function(
    "window",
    "globalThis",
    "localStorage",
    "document",
    "location",
    "CustomEvent",
    code + "\n; return true;"
  );
  fn(
    sandbox,
    sandbox,
    sandbox.localStorage,
    sandbox.document,
    sandbox.location,
    sandbox.CustomEvent
  );
}

async function main() {
  const identitySrc = read("ai-model-identity.js");
  const routerSrc = read("ai-workspace-model-router-settings.js");
  const gatewaySrc = read("ai-model-gateway.js");
  const chatSrc = read("ai-workspace-chat.js");
  const html = read("ai-workspace.html");
  const logTs = read("supabase/functions/_shared/ai-usage-log.ts");
  const gemini = read("supabase/functions/gemini-chat/index.ts");
  const openai = read("supabase/functions/openai-chat/index.ts");
  const claude = read("supabase/functions/claude-chat/index.ts");
  const logMjs = read("deploy/cloudflare/functions/_shared/ai-usage-log.mjs");

  assert("identity module exists", /TasuAiModelIdentity/.test(identitySrc));
  assert("html loads identity", html.includes('src="ai-model-identity.js"'));
  assert("router uses identity", routerSrc.includes("TasuAiModelIdentity"));
  assert("router has resolveTurnDecision", routerSrc.includes("resolveTurnDecision"));
  assert("router Auto/Manual explicit", routerSrc.includes("getSelectionMode") && routerSrc.includes("manual_chip_selection"));
  assert("no duplicate syncAiRoutingAutoFlag", (routerSrc.match(/function syncAiRoutingAutoFlag/g) || []).length === 1);
  assert("gateway allowlist revalidate", gatewaySrc.includes("isKnownWorkspaceId"));
  assert("gateway max one provider fallback", gatewaySrc.includes("provider_fallback_once"));
  assert("chat passes routingDecision", chatSrc.includes("routingDecision") && chatSrc.includes("buildGatewayTurnArgs"));
  assert("usage log allowlist routing keys", logTs.includes("requested_mode") && logTs.includes("fallback_used"));
  assert("sanitizeRoutingMetadata exported", logTs.includes("function sanitizeRoutingMetadata"));
  assert("gemini logs routing", gemini.includes("sanitizeRoutingMetadata"));
  assert("openai logs usage", openai.includes("USAGE_STATUS_SUCCESS") && openai.includes("sanitizeRoutingMetadata"));
  assert("claude logs usage", claude.includes("USAGE_STATUS_SUCCESS") && claude.includes('provider: "claude"'));
  assert("cost ledger model id gemini-2.5-flash", identitySrc.includes("gemini-2.5-flash"));
  assert("cost ledger model id gpt-4o-mini", identitySrc.includes("gpt-4o-mini"));
  assert("cost ledger model id claude-haiku", identitySrc.includes("claude-haiku-4-5"));
  assert("CF allowlist has requested_mode", logMjs.includes("requested_mode"));
  assert("prompt forbidden in usage log", logTs.includes('"prompt"') || logTs.includes("'prompt'"));

  const g = createSandbox();
  runIife(g, "ai-model-identity.js");
  runIife(g, "ai-plan-policy.js");
  runIife(g, "ai-plan-models.js");
  runIife(g, "ai-workspace-model-router-settings.js");

  const Id = g.TasuAiModelIdentity;
  const Router = g.TasuAiWorkspaceModelRouterSettings;
  const Plans = g.TasuAiPlanModels;

  assert("identity catalog map", Id.catalogToWorkspaceId("claude-sonnet") === "claude");
  assert("identity provider model", Id.toProviderModelId("gemini-flash") === "gemini-2.5-flash");
  assert("cost ledger key", Id.toCostLedgerKey("gpt")?.model === "gpt-4o-mini");

  // Phase 5: multi-model routes require Pro policy
  g.localStorage.setItem(
    "tasu_genai_plan",
    JSON.stringify({ plan: "pro_980", label: "Pro", dailyTextLimit: 100 })
  );

  g.localStorage.removeItem("tasu_ai_model_router_settings");
  Router.setState({
    modelMode: "auto",
    modelAutoRouting: true,
    useCaseModels: {
      chat: "auto",
      image: "auto",
      video: "auto",
      search: "auto",
      code: "auto",
      translation: "auto",
      analysis: "auto",
    },
  });

  const autoCode = Router.resolveTurnDecision({
    userText: "def hello():\n  pass",
    modeId: "skill-search",
  });
  assert("auto intent code", autoCode.ok && autoCode.requestedMode === "auto");
  assert("auto code routes to gpt", autoCode.resolvedWorkspaceId === "gpt", String(autoCode.resolvedWorkspaceId));
  assert("auto has routing reason", String(autoCode.routingReason).includes("auto"));

  Router.setAutoRoutingEnabled(false);
  Plans.setSelectedModelId("claude");
  const manual = Router.resolveTurnDecision({ userText: "hi" });
  assert("manual mode", manual.requestedMode === "manual");
  assert("manual respects chip", manual.resolvedWorkspaceId === "claude", String(manual.resolvedWorkspaceId));
  assert("manual not silent auto", manual.routingReason === "manual_chip_selection");

  Router.setAutoRoutingEnabled(true);
  assert("auto restore", Router.getSelectionMode() === "auto");

  Router.setState({
    modelMode: "nope",
    modelAutoRouting: true,
    useCaseModels: { chat: "evil-model" },
  });
  const restored = Router.getSnapshot();
  assert("corrupt mode restored", restored.modelMode === "auto");
  assert("corrupt catalog restored to auto", restored.useCaseModels.chat === "auto");

  assert("unknown catalog maps safely", Id.catalogToWorkspaceId("not-real") == null);

  const fbList = Id.listFallbackWorkspaceIds("gemini-flash");
  assert("fallback candidates exclude self", !fbList.includes("gemini-flash") && fbList.length >= 1);

  // Manual silent override check: auto preset must not apply while manual
  Router.setAutoRoutingEnabled(false);
  Plans.setSelectedModelId("gemini-flash");
  const manualChat = Router.resolveTurnDecision({
    userText: "def hello():\n  pass",
    modeId: "skill-search",
  });
  assert(
    "manual ignores intent for model",
    manualChat.resolvedWorkspaceId === "gemini-flash" &&
      manualChat.routingReason === "manual_chip_selection"
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
