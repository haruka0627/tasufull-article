#!/usr/bin/env node
/**
 * Supabase Edge へマルチAI用シークレットを登録 + 3 Edge Functions を再デプロイ
 *
 * キーは次のいずれかから読み込みます（優先順）:
 *   1. プロセス環境変数
 *   2. プロジェクトルート .env
 *
 * PowerShell 例:
 *   $env:OPENAI_API_KEY="sk-..."
 *   $env:ANTHROPIC_API_KEY="sk-ant-..."
 *   $env:GEMINI_API_KEY="..."
 *   node scripts/setup-ai-model-secrets.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";

const SECRETS = [
  { name: "OPENAI_API_KEY", env: "OPENAI_API_KEY" },
  { name: "ANTHROPIC_API_KEY", env: "ANTHROPIC_API_KEY" },
  { name: "GEMINI_API_KEY", env: "GEMINI_API_KEY" },
  { name: "OPENAI_CHAT_MODEL", env: "OPENAI_CHAT_MODEL", optional: true },
  { name: "ANTHROPIC_CHAT_MODEL", env: "ANTHROPIC_CHAT_MODEL", optional: true },
];

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
  return out;
}

function resolveEnv(name) {
  const fromProcess = String(process.env[name] || "").trim();
  if (fromProcess) return fromProcess;
  return String(dotEnv[name] || "").trim();
}

const dotEnv = loadDotEnv(join(root, ".env"));

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
    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"]) {
      console.error(`  - ${name}`);
    }
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
  if (resolveEnv("GEMINI_API_KEY")) deployTargets.push("gemini-chat");
  if (!deployTargets.length) {
    console.error("デプロイ対象の Edge Function がありません（キーが1つ以上必要）");
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
