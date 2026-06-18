/**
 * 本番3D生成フロー API テスト（Tripo実生成は GENAI_3D_RUN_PROD_TEST=1 のときのみ1回）
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

const endpoint = `${url}/functions/v1/genai-3d-generate`;
let failed = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function post(body) {
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getTickets(userId) {
  const plan = await post("stripe-get-genai-plan", { user_id: userId });
  return Number(plan.data?.entitlements?.tickets3dRemaining) || 0;
}

const userNoTicket = `prod3d_noticket_${Date.now()}`;
const userWithTicket = `prod3d_ticket_${Date.now()}`;
const charId = "char_prod_test";

console.log("--- ticket gate ---");
const blocked = await post({
  action: "generate_from_ticket",
  userId: userNoTicket,
  characterId: charId,
  imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
});
check(
  "generate_from_ticket blocked without ticket",
  blocked.status === 402 && !blocked.data.ok,
  blocked.data.error || String(blocked.status)
);

console.log("\n--- grant ticket (e2e simulate) ---");
const sim = await post("stripe-e2e-simulate-genai-addon", {
  genai_plan: "genai_3d_generate_500",
  user_id: userWithTicket,
});
const simOk =
  sim.status === 200 && sim.data.ok && Number(sim.data.tickets3dRemaining) >= 1;
check(
  "e2e simulate 3d ticket",
  simOk,
  sim.data?.error || `remaining=${sim.data.tickets3dRemaining}`
);

if (!simOk) {
  console.log(
    "\nSkip ticket flow tests (stripe-e2e-simulate requires sk_test_ — gate test above still valid)"
  );
  console.log(`\nTotal failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

const ticketsBefore = await getTickets(userWithTicket);
check("tickets before generate", ticketsBefore >= 1, String(ticketsBefore));

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const start = await post({
  action: "generate_from_ticket",
  userId: userWithTicket,
  characterId: charId,
  characterName: "prod-test",
  imageData: tinyPng,
});
check(
  "generate_from_ticket ok",
  start.status === 200 && start.data.ok && start.data.taskId,
  start.data.taskId || start.data.error
);

const ticketsAfterStart = await getTickets(userWithTicket);
check(
  "ticket not consumed at start",
  ticketsAfterStart === ticketsBefore,
  `before=${ticketsBefore} after=${ticketsAfterStart}`
);

const taskId = start.data?.taskId;
if (!taskId) {
  console.log("\nSkip complete tests (no taskId)");
  console.log(`\nTotal failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

const processing = await post({
  action: "complete_generation",
  userId: userWithTicket,
  characterId: charId,
  taskId,
});
check(
  "complete_generation returns processing or terminal",
  processing.status === 200 || processing.status === 202,
  `status=${processing.data.status} processing=${processing.data.processing}`
);

const ticketsMid = await getTickets(userWithTicket);
check(
  "ticket not consumed while processing",
  !processing.data.ticketConsumed && ticketsMid === ticketsBefore,
  `remaining=${ticketsMid}`
);

if (process.env.GENAI_3D_RUN_PROD_TEST === "1") {
  console.log("\n--- full Tripo wait (1x, no auto-retry) ---");
  const maxMs = 600000;
  const interval = 12000;
  const t0 = Date.now();
  let final = null;
  while (Date.now() - t0 < maxMs) {
    final = await post({
      action: "complete_generation",
      userId: userWithTicket,
      characterId: charId,
      taskId,
    });
    if (final.data?.processing) {
      console.log(`  poll ${final.data.status} (${Math.round((Date.now() - t0) / 1000)}s)`);
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }
    break;
  }
  check(
    "complete success",
    final?.data?.ok && final.data.status === "success" && final.data.modelUrl,
    final?.data?.error || final?.data?.status
  );

  const ticketsAfterSuccess = await getTickets(userWithTicket);
  check(
    "ticket consumed once on success",
    ticketsAfterSuccess === ticketsBefore - 1,
    `before=${ticketsBefore} after=${ticketsAfterSuccess}`
  );

  const dup = await post({
    action: "complete_generation",
    userId: userWithTicket,
    characterId: charId,
    taskId,
  });
  check("idempotent complete", dup.data.ok && dup.data.idempotent, `ticketConsumed=${dup.data.ticketConsumed}`);

  const ticketsAfterDup = await getTickets(userWithTicket);
  check(
    "no double consume on idempotent",
    ticketsAfterDup === ticketsAfterSuccess,
    String(ticketsAfterDup)
  );
} else {
  console.log("\nSkip live Tripo completion (set GENAI_3D_RUN_PROD_TEST=1 to run once)");
}

console.log(`\nTotal failed: ${failed}`);
process.exit(failed ? 1 : 0);
