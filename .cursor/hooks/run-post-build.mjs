#!/usr/bin/env node
/**
 * post-build — after npm run build:pages. Report only (stderr).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitStatusShort,
  parseStatusLines,
  categorizePaths,
  section,
  goNoGo,
} from './lib/tasful-check.mjs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input.command ?? '';
const output = input.output ?? '';
const duration = input.duration ?? 0;

const specPath = join(process.cwd(), '.cursor/hooks/post-build.md');
let spec = '';
try {
  spec = readFileSync(specPath, 'utf8');
} catch {
  spec = '[missing post-build.md]';
}

const failed = /error|ERR!|failed|FAIL/i.test(output) && !/0 errors/i.test(output);
const pass = !failed && (output.length > 0 || duration > 0);

const status = gitStatusShort();
const lines = parseStatusLines(status);
const cats = categorizePaths(lines);
const distChanged = cats.dist.length > 0;

const blocking = failed ? ['build 失敗'] : [];
const high = [];
if (pass && distChanged) {
  high.push(`dist 変化 ${cats.dist.length} 件 — ソース変更時は dist ミラーを選別 stage`);
}

const { verdict, reason } = goNoGo(blocking, high);

const regression = [];
if (/builder/i.test(command) || cats.src.some((p) => p.startsWith('builder/'))) {
  regression.push('node scripts/test-builder-ai-tools-adaptation.mjs');
  regression.push('node scripts/test-builder-ai-p1-review.mjs');
}
if (/platform|listing|favorites/i.test(command) || cats.src.some((p) => p.startsWith('platform-'))) {
  regression.push('node scripts/test-platform-finish-phase.mjs');
  regression.push('node scripts/test-platform-next-phase.mjs');
}
if (/live|tlv/i.test(command) || cats.src.some((p) => p.startsWith('live/'))) {
  regression.push('node scripts/test-tlv-tasful-ai-entry.mjs');
}
if (/ai-|tasful-ai|gateway/i.test(command)) {
  regression.push('node scripts/test-tasful-ai-final-phase.mjs');
  regression.push('node scripts/test-ai-terms-disclaimer.mjs');
}
if (!regression.length) {
  regression.push('（変更スコープに応じて scripts/test-*.mjs を選定 — /test 参照）');
}

let report = `# TASFUL Hook: post-build\n\n`;
report += `> チェック専用 — 自動 stage / commit / deploy なし\n\n`;
report += section('実行コマンド', command);
report += section('Build', pass ? 'PASS' : 'FAIL');
report += section('所要時間', `${duration} ms`);
if (failed) {
  report += section('失敗ログ抜粋', output.split('\n').slice(-20).join('\n'));
}
report += section('生成物差分', distChanged ? `${cats.dist.length} dist ファイル変更` : 'dist 変化なし（または clean）');
report += section('次の回帰候補', regression.join('\n'));
report += section('Go / No-Go', `${verdict}\n\n${reason}`);
report += section('Hook仕様', spec.split('\n').slice(0, 6).join('\n'));

console.error(report);
process.exit(0);
