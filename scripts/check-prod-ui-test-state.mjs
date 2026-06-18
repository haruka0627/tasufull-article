import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = "https://ddojquacsyqesrjhcvmn.supabase.co";
const anonKey =
  readFileSync(join(root, "chat-supabase-config.js"), "utf8").match(/anonKey:\s*"([^"]+)"/)?.[1] ||
  "";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${anonKey}`,
  apikey: anonKey,
};

async function post(body) {
  const res = await fetch(`${url}/functions/v1/genai-3d-generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const plan = await fetch(`${url}/functions/v1/stripe-get-genai-plan`, {
  method: "POST",
  headers,
  body: JSON.stringify({ user_id: "u_me" }),
}).then((r) => r.json());

console.log("plan", plan.entitlements);

const done = await post({
  action: "complete_generation",
  userId: "u_me",
  characterId: "char_prod_ui_once",
  taskId: "f81ec7c6-d0b4-4f1e-84d2-a3148bfc17f7",
});
console.log("complete_generation", done.status, {
  ok: done.data.ok,
  idempotent: done.data.idempotent,
  status: done.data.status,
  taskId: done.data.taskId,
  modelUrl: done.data.modelUrl?.slice(0, 80),
  previewUrl: Boolean(done.data.previewUrl),
  creditsUsed: done.data.creditsUsed,
  tickets3dRemaining: done.data.tickets3dRemaining,
});

const sql = `select task_id, status, ticket_consumed, model_url is not null as has_model, error_message, created_at, completed_at from gen_ai_3d_generations where user_id = 'u_me' order by created_at desc limit 3;`;
const tmp = join(root, "supabase", ".temp-check-gen.sql");
import { writeFileSync, unlinkSync } from "node:fs";
writeFileSync(tmp, sql);
const q = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", tmp], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
console.log(q.stdout || q.stderr);
unlinkSync(tmp);
