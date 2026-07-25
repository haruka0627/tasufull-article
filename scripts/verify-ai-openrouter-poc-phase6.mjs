/**
 * Static verify — OpenRouter PoC stays internal / Production-disabled
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_PLAN_IDS,
  getPlanPolicy,
  isFeatureAllowedForPolicy,
  featureForEdge,
} from "./lib/ai-plan-policy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("PASS", msg);
  }
}

const identity = readFileSync(join(root, "ai-model-identity.js"), "utf8");
const gateway = readFileSync(join(root, "ai-model-gateway.js"), "utf8");
const workspace = readFileSync(join(root, "ai-workspace.html"), "utf8");
const planModels = readFileSync(join(root, "ai-plan-models.js"), "utf8");
const guard = readFileSync(
  join(root, "supabase/functions/_shared/ai-usage-guard.ts"),
  "utf8"
);
const edge = readFileSync(join(root, "supabase/functions/openrouter-chat/index.ts"), "utf8");
const envEx = readFileSync(join(root, ".env.example"), "utf8");

assert(/or-gemini-flash/.test(identity), "identity has PoC entries");
assert(/productionEnabled: false/.test(identity), "PoC productionEnabled false");
assert(!/openrouter-chat/.test(gateway), "gateway not production-wired");
assert(!/OpenRouter/.test(workspace), "workspace HTML has no OpenRouter");
assert(!/or-gemini-flash/.test(workspace), "workspace HTML has no PoC model ids");
assert(!/openrouter-chat/.test(planModels), "plan-models not wired to openrouter");
assert(featureForEdge("openrouter-chat") === "openrouter_chat", "edge mapped");
for (const id of CANONICAL_PLAN_IDS) {
  assert(
    !isFeatureAllowedForPolicy(getPlanPolicy(id), "openrouter_chat"),
    `${id} denies openrouter_chat`
  );
}
assert(/enforceGuardOpenRouterPocEntry/.test(guard), "guard has poc entry");
assert(/readOpenRouterPocEnvGate/.test(guard), "guard uses env harness gate");
assert(/OPENROUTER_API_KEY/.test(edge), "edge reads API key");
assert(/OPENROUTER_API_KEY/.test(envEx), ".env.example documents key");
assert(/Production 無効/.test(envEx), ".env.example marks Production disabled");

console.log(failed ? `\nVERIFY FAIL (${failed})` : "\nVERIFY PASS");
process.exit(failed ? 1 : 0);
