#!/usr/bin/env node
/**
 * OpenAI / Claude のみ Supabase Edge Secrets 登録 + 再デプロイ
 *   node scripts/setup-openai-claude-secrets.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";

const SECRETS = [
  { name: "OPENAI_API_KEY", env: "OPENAI_API_KEY", optional: true },
  { name: "ANTHROPIC_API_KEY", env: "ANTHROPIC_API_KEY", optional: true },
  { name: "OPENAI_CHAT_MODEL", env: "OPENAI_CHAT_MODEL", optional: true },
  { name: "ANTHROPIC_CHAT_MODEL", env: "ANTHROPIC_CHAT_MODEL", optional: true },
];

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return {};
}

const dotEnv = {
  ...loadDotEnv(join(root, ".env")),
  ...loadDotEnv(join(process.cwd(), ".env")),
};

function resolveEnv(name) {
  const fromProcess = String(process.env[name] || "").trim();
  if (fromProcess) return fromProcess;
  return String(dotEnv[name] || "").trim();
}

function runSupabase(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

function main() {
  const pairs = [];
  const missing = [];

  for (const row of SECRETS) {
    const value = resolveEnv(row.env);
    if (!value) {
      if (!row.optional) missing.push(row.env);
      continue;
    }
    pairs.push(`${row.name}=${value}`);
  }

  if (!pairs.length) {
    console.error("登録可能なシークレットがありません。.env またはシェル環境変数にキーを追加してください:");
    console.error("  - OPENAI_API_KEY");
    console.error("  - ANTHROPIC_API_KEY");
    process.exitCode = 1;
    return;
  }

  if (missing.length) {
    console.warn("未設定（スキップ）:", missing.join(", "));
  }

  console.log("Setting secrets:", pairs.map((p) => p.split("=")[0]).join(", "));
  if (!runSupabase(["secrets", "set", ...pairs, "--project-ref", PROJECT_REF])) {
    process.exitCode = 1;
    return;
  }

  const deployTargets = [];
  if (resolveEnv("OPENAI_API_KEY")) deployTargets.push("openai-chat");
  if (resolveEnv("ANTHROPIC_API_KEY")) deployTargets.push("claude-chat");
  if (!deployTargets.length) {
    console.error("デプロイ対象の Edge Function がありません");
    process.exitCode = 1;
    return;
  }

  console.log("Deploying:", deployTargets.join(", "));
  if (
    !runSupabase([
      "functions",
      "deploy",
      ...deployTargets,
      "--project-ref",
      PROJECT_REF,
    ])
  ) {
    process.exitCode = 1;
    return;
  }

  console.log("Done. Run: node scripts/capture-ai-workspace-real-api.mjs");
}

main();
