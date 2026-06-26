#!/usr/bin/env node
/**
 * pre-finish | pre-review | pre-release — read-only git/docs checks.
 * Outputs beforeSubmitPrompt JSON; full report on stderr (Hooks channel).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitStatusShort,
  gitDiffNameStatus,
  gitDiffCachedNameStatus,
  gitLogOneline,
  parseStatusLines,
  categorizePaths,
  readDoc,
  section,
  goNoGo,
} from './lib/tasful-check.mjs';

const hookName = process.argv[2];
const input = JSON.parse(readFileSync(0, 'utf8'));
const prompt = input.prompt ?? '';

const specPath = join(process.cwd(), '.cursor/hooks', `${hookName}.md`);
let spec = '';
try {
  spec = readFileSync(specPath, 'utf8');
} catch {
  spec = `[missing spec: ${hookName}.md]`;
}

const status = gitStatusShort();
const diff = gitDiffNameStatus();
const cached = gitDiffCachedNameStatus();
const lines = parseStatusLines(status);
const cats = categorizePaths(lines);

const blocking = [];
const high = [];
const medium = [];
const low = [];

if (status.startsWith('GIT_ERROR')) blocking.push(status);

if (cats.dist.length && hookName === 'pre-finish') {
  high.push(`dist 混在 (${cats.dist.length} 件) — 選別 stage を確認`);
}
if (cats.reports.length && hookName === 'pre-finish') {
  medium.push(`reports 混在 (${cats.reports.length} 件)`);
}
if (cats.tmp.length || cats.wrangler.length) {
  medium.push('tmp / .wrangler 混在 — コミット対象外');
}
if (cats.gateway.length && hookName !== 'pre-release') {
  high.push('ai-model-gateway.js 変更 — AD-005 / KI-001 確認');
}

if (hookName === 'pre-review') {
  if (lines.length > 50) high.push(`変更ファイル多数 (${lines.length}) — スコープ確認`);
  const frozen = lines.filter((l) =>
    /^(builder\/|live\/|admin-ai-|admin-operations-dashboard)/.test(l.replace(/^[ MADRCU?!]{1,2}\s+/, ''))
  );
  if (frozen.length) medium.push(`凍結領域候補 ${frozen.length} 件 — AD-008 理由確認`);
}

if (hookName === 'pre-release') {
  const changelog = readDoc('docs/CHANGELOG.md').slice(0, 500);
  const head = gitLogOneline(1);
  if (lines.length > 0) high.push(`working tree 未整理 (${lines.length} 件) — リリース前に選別コミット`);
  if (!changelog.includes(head.split(' ')[0]?.slice(0, 7) ?? '___')) {
    medium.push('CHANGELOG に直近 HEAD が未反映の可能性');
  }
}

const { verdict, reason } = goNoGo(blocking, high);

let report = `# TASFUL Hook: ${hookName}\n\n`;
report += `> チェック専用 — 自動 stage / commit / deploy なし\n\n`;
report += section('実行内容', spec.split('\n').slice(0, 8).join('\n'));
report += section('git status --short', status || '(clean)');
report += section('git diff --name-status', diff || '(none)');
report += section('git diff --cached --name-status', cached || '(none)');

if (hookName === 'pre-release') {
  report += section('git log --oneline -10', gitLogOneline(10));
}

report += section('カテゴリ', [
  `cursor: ${cats.cursor.length}`,
  `docs: ${cats.docs.length}`,
  `src: ${cats.src.length}`,
  `dist: ${cats.dist.length}`,
  `reports: ${cats.reports.length}`,
].join(' · '));

if (blocking.length) report += section('Blocking', blocking.map((x) => `- ${x}`).join('\n'));
if (high.length) report += section('High', high.map((x) => `- ${x}`).join('\n'));
if (medium.length) report += section('Medium', medium.map((x) => `- ${x}`).join('\n'));
if (low.length) report += section('Low', low.map((x) => `- ${x}`).join('\n'));

if (hookName === 'pre-finish') {
  report += section('Finish Go / No-Go', `${verdict}\n\n${reason}`);
  report += section('含めるべきファイル', cats.cursor.length ? cats.cursor.join('\n') : '(作業スコープを明示)');
  report += section('含めないファイル', [
    ...cats.dist.slice(0, 5),
    ...cats.reports.slice(0, 5),
    ...cats.tmp,
    ...cats.wrangler,
  ].filter(Boolean).join('\n') || '(混在なし)');
  report += section('docs更新要否', cats.docs.length || /docs/i.test(prompt) ? '要 — docs/ を確認' : '不要（変更なし）');
  report += section('推奨コミットメッセージ', 'chore(scope): <why> — 選別 git add のみ');
}

if (hookName === 'pre-review') {
  report += section('Review Go / No-Go', `${verdict}\n\n${reason}`);
}

if (hookName === 'pre-release') {
  report += section('Release Go / No-Go', `${verdict}\n\n${reason}`);
  report += section('未解決リスク', high.concat(medium).map((x) => `- ${x}`).join('\n') || '- なし');
  report += section('本番反映前チェックリスト', [
    '- [ ] build PASS（/build または npm run build:pages）',
    '- [ ] 領域回帰 PASS（/test）',
    '- [ ] CHANGELOG / PROJECT_STATUS 更新',
    '- [ ] KNOWN_ISSUES 確認',
    '- [ ] 選別ステージング（git add -A 禁止）',
    '- [ ] Cloudflare 反映は人手承認後',
  ].join('\n'));
  report += section('Rollback方針', 'git revert <commit> + dist 再 build（deploy は実行しない）');
}

console.error(report);

process.stdout.write(JSON.stringify({ continue: true }));
process.exit(0);
