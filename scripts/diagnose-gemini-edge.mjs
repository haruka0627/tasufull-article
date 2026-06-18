#!/usr/bin/env node
/**
 * Gemini Edge 診断（Secret digest 照合 / fingerprint / Google 生レスポンス）
 *   node scripts/diagnose-gemini-edge.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfg.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfg.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";
const SUPABASE_PROJECT = "ddojquacsyqesrjhcvmn";

function loadDotEnvKey(name) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return "";
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq).trim() !== name) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

function sha256(text) {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function secretsList() {
  const r = spawnSync(
    "npx",
    ["supabase", "secrets", "list", "--project-ref", SUPABASE_PROJECT],
    { cwd: root, encoding: "utf8", shell: true }
  );
  return r.stdout || r.stderr || "";
}

async function callEdge(name, body = {}) {
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _rawText: text };
  }
  return { edge: name, httpStatus: res.status, data };
}

function digestMatch(edgeSha256, supabaseDigest) {
  if (!edgeSha256 || !supabaseDigest) return "unknown";
  return edgeSha256.toLowerCase() === supabaseDigest.toLowerCase() ? "MATCH" : "MISMATCH";
}

async function main() {
  const outDir = join(root, "reports");
  mkdirSync(outDir, { recursive: true });

  const secrets = secretsList();
  const geminiDigest =
    secrets.match(/GEMINI_API_KEY\s*\|\s*([a-f0-9]+)/i)?.[1] || "";

  const diagnose = await callEdge("gemini-chat-diagnose", {});
  const chatProbe = await callEdge("gemini-chat", {
    message: "草刈り業者への問い合わせ文を作って",
    history: [],
    intent: "work",
    mode: "cross-matching",
  });

  const edgeSha = diagnose.data?.geminiApiKey?.secretSha256 || "";
  const secretVsEdge = digestMatch(edgeSha, geminiDigest);

  const localKey = loadDotEnvKey("GEMINI_API_KEY") || process.env.GEMINI_API_KEY || "";
  const localSha = localKey ? sha256(localKey) : "";
  const localFingerprint = localKey
    ? {
        prefix: localKey.slice(0, 8),
        suffix: localKey.slice(-4),
        length: localKey.length,
        secretSha256: localSha,
        digestMatch: digestMatch(localSha, geminiDigest),
      }
    : null;

  const report = {
    checkedAt: new Date().toISOString(),
    supabaseProject: SUPABASE_PROJECT,
    supabaseSecretDigest: {
      GEMINI_API_KEY: geminiDigest,
    },
    secretDigestVerification: {
      edgeSecretSha256: edgeSha,
      supabaseDigest: geminiDigest,
      edgeVsSupabaseSecret: secretVsEdge,
      localEnvKeyPresent: Boolean(localKey),
      localEnvFingerprint: localFingerprint,
      interpretation:
        secretVsEdge === "MATCH"
          ? "Edge 実行環境が読む GEMINI_API_KEY は Supabase Secret と同一（別キー参照の可能性は低い）"
          : secretVsEdge === "MISMATCH"
            ? "Edge 実行環境のキーと Supabase Secret digest が不一致（別キーまたは Secret 未反映）"
            : "digest 比較不可",
    },
    diagnoseEdge: diagnose,
    geminiChatProbe: chatProbe,
  };

  const probes = diagnose.data?.googleProbes || [];
  const md = [
    "# Gemini Edge 診断レポート（別キー / 別プロジェクト調査）",
    "",
    `実施: ${report.checkedAt}`,
    "",
    "## 1. Supabase Secret と Edge キーの一致",
    "",
    `- Supabase project: \`${SUPABASE_PROJECT}\``,
    `- GEMINI_API_KEY digest (CLI): \`${geminiDigest}\``,
    `- Edge 上キーの SHA256: \`${edgeSha || "—"}\``,
    `- **Edge vs Secret digest: ${secretVsEdge}**`,
    `- Edge fingerprint: \`${diagnose.data?.geminiApiKey?.prefix || "—"}…${diagnose.data?.geminiApiKey?.suffix || "—"}\` (len ${diagnose.data?.geminiApiKey?.length ?? "—"})`,
    localFingerprint
      ? `- .env ローカルキー digest 照合: **${localFingerprint.digestMatch}** (\`${localFingerprint.prefix}…${localFingerprint.suffix}\`)`
      : "- .env GEMINI_API_KEY: 未設定（ローカル digest 照合スキップ）",
    "",
    "## 2. Edge Function が参照するプロジェクト",
    "",
    `- **Supabase project ref:** \`${diagnose.data?.supabase?.projectRef || SUPABASE_PROJECT}\``,
    `- Supabase URL: \`${diagnose.data?.supabase?.url || base}\``,
    `- GOOGLE_CLOUD_PROJECT env on Edge: \`${diagnose.data?.edgeEnvKeysPresent?.GOOGLE_CLOUD_PROJECT ? "set" : "not set"}\``,
    "- Google Cloud project ID は Edge 環境変数には設定されていません（API キーに紐づく GCP プロジェクトは Google 側で解決）",
    "",
    "## 3. Google API プローブ（生レスポンス）",
    "",
    ...probes.map((p) => {
      return (
        `### ${p.label}\n\n` +
        `- HTTP: ${p.httpStatus ?? "—"}\n` +
        `- URL: \`${p.url}\`\n` +
        `- Headers:\n\`\`\`json\n${JSON.stringify(p.responseHeaders || {}, null, 2)}\n\`\`\`\n` +
        `- Body:\n\`\`\`json\n${JSON.stringify(p.body || p.fetchError || {}, null, 2)}\n\`\`\`\n`
      );
    }),
    "",
    "## 4. gemini-chat 応答（問い合わせ文）",
    "",
    `- HTTP: ${chatProbe.httpStatus}`,
    "",
    "```json",
    JSON.stringify(chatProbe.data ?? {}, null, 2),
    "```",
    "",
    "## 切り分け",
    "",
    secretVsEdge === "MATCH"
      ? "- Secret と Edge キーは同一。別キー参照は **否定的**。"
      : "- Secret digest と Edge SHA256 が不一致。**別キーまたは Secret 未同期**を疑う。",
    "- Google 429 の `prepayment credits depleted` は、このキーに紐づく **Google 側プロジェクトの API 課金状態**の応答。Studio UI の残高表示と API が参照する課金枠が異なる可能性は残る。",
    "",
  ].join("\n");

  writeFileSync(join(outDir, "gemini-edge-diagnose.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "gemini-edge-diagnose.md"), md);

  console.log(md);
  console.log("\nWrote reports/gemini-edge-diagnose.md");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
