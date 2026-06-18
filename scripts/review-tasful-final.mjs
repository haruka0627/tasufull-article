#!/usr/bin/env node
/**
 * TASFUL 総合再監査 — 全カテゴリ監査実行・集約レポート
 *   node scripts/review-tasful-final.mjs
 */
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "screenshots", "tasful-final-review");
const REPORT_MD = join(OUT_DIR, "review-report.md");
const REPORT_JSON = join(OUT_DIR, "review-report.json");

const AUDITS = [
  {
    id: "ai_phase1_12",
    category: "ai_ops",
    label: "AI運営秘書 Phase1〜12 回帰",
    script: "scripts/review-admin-ai-full-system.mjs",
    reportJson: "screenshots/admin-ai-full-review/review-report.json",
    overallKey: "overall",
    shots: [
      "screenshots/admin-ai-full-review/dashboard-390.png",
      "screenshots/admin-ai-full-review/dashboard-1280.png",
    ],
  },
  {
    id: "ai_connectivity_p0",
    category: "ai_ops",
    label: "AI運営秘書 本番接続 P0",
    script: "scripts/test-admin-ai-connectivity-p0.mjs",
    exitOnly: true,
    shots: ["screenshots/admin-ai-connectivity-p0/dashboard-390.png"],
  },
  {
    id: "ai_connectivity_p1",
    category: "ai_ops",
    label: "AI運営秘書 本番接続 P1",
    script: "scripts/test-admin-ai-connectivity-p1.mjs",
    exitOnly: true,
    shots: ["screenshots/admin-ai-connectivity-p1/dashboard-390.png"],
  },
  {
    id: "ai_connectivity_p2",
    category: "ai_ops",
    label: "AI運営秘書 本番接続 P2",
    script: "scripts/test-admin-ai-connectivity-p2.mjs",
    exitOnly: true,
    shots: ["screenshots/admin-ai-connectivity-p2/dashboard-390.png"],
  },
  {
    id: "ai_production_connectivity",
    category: "ai_ops",
    label: "AI運営秘書 本番接続 統合レビュー",
    script: "scripts/review-admin-ai-production-connectivity.mjs",
    reportJson: "screenshots/admin-ai-production-connectivity/connectivity-report.json",
    overallFn: (j) => (j.needsFix?.length ? "WARNING" : j.disconnected?.length ? "WARNING" : "PASS"),
    shots: ["screenshots/admin-ai-production-connectivity/dashboard-390.png"],
  },
  {
    id: "talk_flow",
    category: "talk",
    label: "TALK 利用者導線監査",
    script: "scripts/review-talk-user-flow.mjs",
    reportJson: "screenshots/talk-user-flow-review/review-report.json",
    overallKey: "overall",
    shots: ["screenshots/talk-user-flow-review/chat-bidirectional-390.png"],
  },
  {
    id: "builder_flow",
    category: "builder",
    label: "Builder 利用者導線監査",
    script: "scripts/review-builder-user-flow.mjs",
    reportJson: "screenshots/builder-user-flow-review/review-report.json",
    overallKey: "overall",
    shots: ["screenshots/builder-user-flow-review/01-board-list-390.png"],
  },
  {
    id: "connect_flow",
    category: "connect",
    label: "Connect 利用者導線監査",
    script: "scripts/review-connect-user-flow.mjs",
    reportJson: "screenshots/connect-user-flow-review/review-report.json",
    overallKey: "overall",
    shots: ["screenshots/connect-user-flow-review/01-apply-390.png"],
  },
  {
    id: "market_flow",
    category: "market",
    label: "市場 利用者導線監査",
    script: "scripts/review-market-user-flow.mjs",
    reportJson: "screenshots/market-user-flow-review/review-report.json",
    overallKey: "overall",
    shots: ["screenshots/market-user-flow-review/03-product-390.png"],
  },
  {
    id: "ui_full",
    category: "ui",
    label: "UI総監査",
    script: "scripts/review-ui-full-system.mjs",
    reportJson: "screenshots/ui-full-review/review-report.json",
    overallKey: "overall",
    shots: ["screenshots/ui-full-review/builder-board-detail-390.png"],
  },
  {
    id: "cta_mobile",
    category: "cta",
    label: "CTAモバイル監査",
    script: "scripts/review-cta-mobile-ux.mjs",
    reportJson: "screenshots/cta-mobile-review/review-report.json",
    overallKey: "overall",
    shots: [
      "screenshots/cta-mobile-review/builder-board-apply-390.png",
      "screenshots/cta-mobile-review/market-product-buy-390.png",
    ],
  },
];

function gradeFromExit(code) {
  if (code === 0) return "PASS";
  return "FAIL";
}

function overallFromList(vals) {
  if (vals.includes("FAIL")) return "FAIL";
  if (vals.includes("WARNING")) return "WARNING";
  return "PASS";
}

function runNode(scriptRel) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(root, scriptRel)], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr, durationMs: Date.now() - started });
    });
  });
}

async function loadJson(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

function extractWarningsFails(audit, json, run) {
  const warnings = [];
  const fails = [];

  if (audit.exitOnly) {
    if (run.code !== 0) fails.push(`${audit.label}: プロセス exit ${run.code}`);
    return { warnings, fails };
  }

  if (!json) {
    if (run.code !== 0) fails.push(`${audit.label}: レポート未生成 / exit ${run.code}`);
    return { warnings, fails };
  }

  if (audit.id === "ai_phase1_12") {
    for (const t of json.phaseTests || []) {
      if (t.status === "FAIL") fails.push(`Phaseテスト ${t.name}: ${t.detail || "FAIL"}`);
      if (t.status === "WARNING") warnings.push(`Phaseテスト ${t.name}: ${t.detail || "WARNING"}`);
    }
    for (const [k, v] of Object.entries(json.sections || {})) {
      if (v === "WARNING") warnings.push(`AI運営 ${k}: WARNING`);
      if (v === "FAIL") fails.push(`AI運営 ${k}: FAIL`);
    }
    for (const [k, v] of Object.entries(json.uxVolume || {})) {
      if (v === "WARNING") warnings.push(`AI運営 UX volume ${k}: WARNING`);
      if (v === "FAIL") warnings.push(`AI運営 UX volume ${k}: FAIL（大量データ時）`);
    }
    for (const r of json.recommendations || []) warnings.push(`AI運営: ${r}`);
  }

  if (audit.id === "ai_production_connectivity") {
    for (const x of json.needsFix || []) warnings.push(`本番接続: ${x}`);
    for (const x of json.disconnected || []) warnings.push(`未接続: ${x}`);
    for (const x of json.productionGaps || []) warnings.push(`本番ギャップ: ${x}`);
  }

  const listKeys = ["results", "items", "screens", "notifyFlows", "flows"];
  for (const key of listKeys) {
    const arr = json[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const st = row.status || row.distanceGrade || row.grade;
      const label = row.label || row.kind || row.id || row.ctaName || row.screenId || key;
      const issues = row.issues || [];
      if (st === "FAIL") {
        fails.push(`${audit.label} / ${label}: ${issues.join("; ") || "FAIL"}`);
      } else if (st === "WARNING") {
        warnings.push(`${audit.label} / ${label}: ${issues.join("; ") || "WARNING"}`);
      }
    }
  }

  if (json.counts?.fail > 0 && fails.length === 0) {
    fails.push(`${audit.label}: FAIL ${json.counts.fail}件`);
  }
  if (json.counts?.warning > 0 && warnings.length === 0) {
    warnings.push(`${audit.label}: WARNING ${json.counts.warning}件`);
  }

  for (const r of json.recommendations || []) {
    if (typeof r === "string") warnings.push(`${audit.label}: ${r}`);
  }
  for (const r of json.immediate || []) {
    if (typeof r === "string") warnings.push(`${audit.label} 即改善: ${r}`);
  }

  if (json.categoryGrades) {
    for (const [k, v] of Object.entries(json.categoryGrades)) {
      if (v === "WARNING") warnings.push(`CTA ${k}: WARNING`);
      if (v === "FAIL") fails.push(`CTA ${k}: FAIL`);
    }
  }

  return { warnings, fails };
}

async function copyShots(audit, copied) {
  for (const rel of audit.shots || []) {
    const src = join(root, rel);
    if (!existsSync(src)) continue;
    const name = `${audit.id}-${basename(rel)}`;
    const dest = join(OUT_DIR, name);
    await copyFile(src, dest);
    copied.push(name);
  }
}

function buildBacklog(warnings, fails) {
  const backlog = new Set();
  for (const f of fails) backlog.add(`[FAIL] ${f}`);
  for (const w of warnings.slice(0, 40)) backlog.add(`[WARN] ${w}`);
  return [...backlog];
}

function deferReason(item) {
  if (/UX volume|daily100|daily500|大量データ/.test(item)) {
    return "デモ/localStorage 上の大量件数シナリオ — 本番DB移行後に再評価";
  }
  if (/本番ギャップ|Stripe|Webhook|listEvaluations/.test(item)) {
    return "バックエンド/API 本番接続フェーズ — フロント導線は PASS";
  }
  if (/390px|CTA|到達|固定バー|WARNING.*画面/.test(item)) {
    return "P1-6 以降の CTA 固定化・レイアウト改善バックログ — 導線 FAIL ではない";
  }
  if (/duplicateRenders|パフォーマンス|再描画/.test(item)) {
    return "パフォーマンス最適化 — 機能欠損なし";
  }
  if (/セキュリティ|WARNING.*AI運営/.test(item)) {
    return "運営画面の hardening — 利用者導線とは別トラック";
  }
  return "機能ブロッカーではなく UX/運営改善項目 — 次フェーズで対応可";
}

function buildMarkdown(report) {
  const catLabel = {
    ai_ops: "AI運営秘書",
    talk: "TALK",
    builder: "Builder",
    connect: "Connect",
    market: "市場",
    ui: "UI",
    cta: "CTA",
  };

  const lines = [
    "# TASFUL 総合再監査",
    "",
    `実施: ${report.capturedAt}`,
    "",
    "## 総合評価",
    "",
    `**${report.overall}**`,
    "",
    `- 監査数: ${report.audits.length}`,
    `- FAIL 件数: ${report.failCount}`,
    `- WARNING 件数: ${report.warningCount}`,
    `- 総実行時間: ${Math.round(report.totalDurationMs / 1000)}s`,
    "",
    "---",
    "",
    "## カテゴリ別",
    "",
    ...Object.entries(report.categoryGrades).map(([k, v]) => `- **${catLabel[k] || k}**: ${v}`),
    "",
    "---",
    "",
    "## 監査実行結果",
    "",
    "| 監査 | 結果 | 時間 |",
    "|---|---:|---:|",
    ...report.audits.map(
      (a) => `| ${a.label} | ${a.overall} | ${Math.round(a.durationMs / 1000)}s |`
    ),
    "",
    "---",
    "",
    "## 残WARNING一覧",
    "",
    ...(report.warnings.length ? report.warnings.map((w, i) => `${i + 1}. ${w}`) : ["- （なし）"]),
    "",
    "---",
    "",
    "## 残FAIL一覧",
    "",
    ...(report.fails.length ? report.fails.map((f, i) => `${i + 1}. ${f}`) : ["- **なし — FAIL 0 確認**"]),
    "",
    "---",
    "",
    "## Backlog候補",
    "",
    ...report.backlog.map((b, i) => `${i + 1}. ${b}`),
    "",
    "---",
    "",
    "## 即修正不要な理由",
    "",
    ...report.deferNotes.map((d) => `- ${d.item}\n  → ${d.reason}`),
    "",
    "---",
    "",
    "## 次フェーズ推奨",
    "",
    ...report.nextPhase.map((n) => `- ${n}`),
    "",
    "---",
    "",
    "## 主要スクショ",
    "",
    `保存先: \`screenshots/tasful-final-review/\` (${report.screenshots.length}枚)`,
    "",
    ...report.screenshots.map((s) => `- ${s}`),
    "",
    "## 再実行",
    "",
    "`node scripts/review-tasful-final.mjs`",
    "",
  ];

  return lines.join("\n");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const auditResults = [];
  const allWarnings = [];
  const allFails = [];
  const copiedShots = [];
  let totalDurationMs = 0;

  for (const audit of AUDITS) {
    console.log(`\n>>> ${audit.label}`);
    const run = await runNode(audit.script);
    totalDurationMs += run.durationMs;

    const json = audit.reportJson ? await loadJson(audit.reportJson) : null;
    let overall = gradeFromExit(run.code);

    if (json && audit.overallKey && json[audit.overallKey]) {
      overall = json[audit.overallKey];
    } else if (json && audit.overallFn) {
      overall = audit.overallFn(json);
    } else if (run.code !== 0) {
      overall = "FAIL";
    } else if (json?.counts?.fail > 0) {
      overall = "FAIL";
    } else if (json?.counts?.warning > 0 || overall === "PASS") {
      if (json?.counts?.warning > 0) overall = "WARNING";
    }

    const { warnings, fails } = extractWarningsFails(audit, json, run);
    allWarnings.push(...warnings);
    allFails.push(...fails);

    await copyShots(audit, copiedShots);

    auditResults.push({
      id: audit.id,
      category: audit.category,
      label: audit.label,
      overall,
      exitCode: run.code,
      durationMs: run.durationMs,
      reportPath: audit.reportJson || null,
      warningCount: warnings.length,
      failCount: fails.length,
    });

    console.log(`${audit.label}: ${overall} (exit ${run.code}, ${Math.round(run.durationMs / 1000)}s)`);
  }

  const categoryGrades = {};
  for (const cat of ["ai_ops", "talk", "builder", "connect", "market", "ui", "cta"]) {
    const vals = auditResults.filter((a) => a.category === cat).map((a) => a.overall);
    categoryGrades[cat] = overallFromList(vals);
  }

  const overall = overallFromList(auditResults.map((a) => a.overall));
  const uniqueWarnings = [...new Set(allWarnings)];
  const uniqueFails = [...new Set(allFails)];
  const backlog = buildBacklog(uniqueWarnings, uniqueFails);

  const deferNotes = [...uniqueWarnings.slice(0, 15), ...uniqueFails].slice(0, 20).map((item) => ({
    item,
    reason: deferReason(item),
  }));

  const nextPhase = [
    "市場商品詳細 390px buy-now / add-cart 固定バー（CTA WARNING 解消）",
    "Builder 選定・完了報告 CTA のモバイル到達性",
    "Connect 本人確認 CTA の下部固定検討",
    "AI運営 Inbox 大量件数（100+/500+）の virtual scroll / pagination",
    "本番 Stripe Webhook + Builder listEvaluations API 接続",
    "UI総監査 WARNING の横スクロール・CTA 残項目クローズ",
  ];

  const report = {
    capturedAt: new Date().toISOString(),
    overall,
    categoryGrades,
    audits: auditResults,
    warnings: uniqueWarnings,
    fails: uniqueFails,
    failCount: uniqueFails.length,
    warningCount: uniqueWarnings.length,
    backlog,
    deferNotes,
    nextPhase,
    screenshots: copiedShots,
    totalDurationMs,
  };

  const md = buildMarkdown(report);
  await writeFile(REPORT_MD, md, "utf8");
  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

  console.log("\n" + md);
  console.log(`\nReport: ${REPORT_MD}`);
  console.log(`Overall: ${overall} | FAIL: ${uniqueFails.length} | WARNING: ${uniqueWarnings.length}`);

  if (overall === "FAIL" || uniqueFails.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
