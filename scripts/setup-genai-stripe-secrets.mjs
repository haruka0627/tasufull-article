/**
 * Stripe 生成AI カタログセットアップ → Supabase Secrets 反映
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const anonKey = src.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const supabaseUrl = "https://ddojquacsyqesrjhcvmn.supabase.co";

const res = await fetch(`${supabaseUrl}/functions/v1/stripe-setup-genai-catalog`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  },
  body: "{}",
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));

if (!data.ok) {
  process.exit(1);
}

const secrets = data.secrets_to_set || {};
const args = Object.entries(secrets).flatMap(([k, v]) => [`${k}=${v}`]);
if (args.length) {
  const cmd = spawnSync("npx", ["supabase", "secrets", "set", ...args], {
    cwd: root,
    shell: true,
    encoding: "utf8",
  });
  console.log(cmd.stdout || cmd.stderr);
  if (cmd.status !== 0) process.exit(cmd.status || 1);
}

console.log("\nSecrets set:", Object.keys(secrets).join(", "));
console.log("\nPrice IDs:");
if (data.products?.genai_2d_live_300) {
  console.log("  STRIPE_GENAI_PRICE_2D_LIVE_300=", data.products.genai_2d_live_300.priceId);
}
if (data.products?.genai_3d_generate_500) {
  console.log("  STRIPE_GENAI_PRICE_3D_GENERATE_500=", data.products.genai_3d_generate_500.priceId);
}
