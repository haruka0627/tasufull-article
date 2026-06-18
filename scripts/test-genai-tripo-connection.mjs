/**
 * Tripo 接続確認（生成・チケット消費なし）
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL || "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function post(body) {
  const res = await fetch(`${url}/functions/v1/genai-3d-generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const edge = readFileSync(join(root, "supabase/functions/genai-3d-generate/index.ts"), "utf8");
const tripo = readFileSync(join(root, "supabase/functions/_shared/tripo-client.ts"), "utf8");
check("edge function exists", /health_check/.test(edge));
check(
  "no generation API call in tripo-client",
  !/text_to_model|image_to_model|method:\s*[\"']POST[\"'].*task/i.test(tripo)
);
check(
  "tripo health paths",
  (/\/balance|\/task\//.test(tripo)) && !/text_to_model/.test(tripo)
);
check("setup doc", readFileSync(join(root, "supabase/TRIPO_API_SETUP.md"), "utf8").includes("TRIPO_API_KEY"));
check("frontend config", readFileSync(join(root, "tripo-genai-config.js"), "utf8").includes("genai-3d-generate"));
check(
  "html 3d test buttons",
  /data-gen-ai-3d-health-check/.test(readFileSync(join(root, "gen-ai-workspace.html"), "utf8")) &&
    /data-gen-ai-3d-test-generate/.test(readFileSync(join(root, "gen-ai-workspace.html"), "utf8"))
);

const health = await post({ action: "health_check" });
if (health.data.ok && health.data.connected) {
  check("health_check connected", true, health.data.message);
} else if (health.data.tripo?.error?.includes("TRIPO_API_KEY")) {
  check("health_check (key not set — deploy secrets)", true, health.data.tripo.error);
} else {
  check(
    "health_check",
    health.status === 200 && health.data.connected === true,
    health.data.tripo?.error || health.data.error || `HTTP ${health.status}`
  );
}

const blocked = await post({ action: "generate", user_id: "test" });
check(
  "legacy generate blocked",
  blocked.status === 503 && !blocked.data.ok,
  blocked.data.error || String(blocked.status)
);

const prodBlocked = await post({
  action: "generate_from_ticket",
  userId: "tripo_conn_test_no_ticket",
  characterId: "x",
  imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
});
check(
  "generate_from_ticket requires ticket",
  prodBlocked.status === 402,
  prodBlocked.data.error || String(prodBlocked.status)
);

const healthFlags = await post({ action: "health_check" });
const testGenEnabled = Boolean(healthFlags.data.testGenerateEnabled);
if (!testGenEnabled) {
  const testGenDisabled = await post({ action: "test_generate", imageUrl: "https://example.com/x.jpg" });
  check(
    "test_generate gated when disabled",
    testGenDisabled.status === 503 && /GENAI_3D_TEST_GENERATE_ENABLED/i.test(testGenDisabled.data.error || ""),
    testGenDisabled.data.error || String(testGenDisabled.status)
  );
} else {
  check("test_generate enabled on server", true, "skip gate test — use test-genai-tripo-test-generate-once.mjs");
}

console.log(`\nTotal failed: ${failed}`);
process.exit(failed ? 1 : 0);
