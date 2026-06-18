#!/usr/bin/env node
/**
 * Builder 最終フロー — 検証実行 + NG一覧レポート出力
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "reports", "builder-final-flow-ng.md");

const SCRIPTS = [
  { name: "ops_partner 2窓ベンチ", file: "verify-builder-ops-partner-bench.mjs" },
  { name: "一般案件 2窓ベンチ", file: "verify-builder-general-flow-bench.mjs" },
  { name: "Builder 2窓ベンチ（全フロー）", file: "verify-builder-dual-window-bench.mjs" },
  { name: "スレッド種別", file: "verify-builder-thread-types.mjs" },
];

function runScript(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const sections = [];
let totalFail = 0;

for (const s of SCRIPTS) {
  console.log(`\n=== ${s.name} ===`);
  const result = await runScript(s.file);
  const lines = (result.stdout + result.stderr).trim().split("\n").filter(Boolean);
  const fails = lines.filter((l) => l.startsWith("FAIL"));
  const oks = lines.filter((l) => l.startsWith("OK"));
  totalFail += fails.length;
  sections.push(
    `## ${s.name}`,
    "",
    `exit: ${result.code === 0 ? "PASS" : "FAIL"}`,
    "",
    `OK: ${oks.length} / NG: ${fails.length}`,
    "",
    ...(fails.length
      ? ["### NG一覧", "", ...fails.map((f) => `- ${f.replace(/^FAIL /, "")}`), ""]
      : ["（NGなし）", ""]),
    "### ログ抜粋",
    "",
    "```",
    ...lines.slice(-30),
    "```",
    ""
  );
}

const md = [
  "# Builder 最終フロー NGレポート",
  "",
  `生成: ${new Date().toISOString()}`,
  "",
  `合計 NG: **${totalFail}**`,
  "",
  ...sections,
  "## 手動確認URL",
  "",
  "- ops_partner 2窓: `chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner`",
  "- partner_user: `?builderFlow=partner_user`",
  "- user_user: `?builderFlow=user_user`",
  "- vendor_user: `?builderFlow=vendor_user`",
  "",
  "## 追加診断キー（ops_partner copy NG）",
  "",
  "- entry_at_saved / exit_at_saved",
  "- entry_notification_created / exit_notification_created",
  "- thread_exists_after_complete",
  "- review_notification_created（一般案件のみ）",
  "",
].join("\n");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md, "utf8");
console.log(`\nReport: ${OUT}`);
process.exit(totalFail > 0 ? 1 : 0);
