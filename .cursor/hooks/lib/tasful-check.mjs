import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

export function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? String(err);
    return `GIT_ERROR: ${stderr.trim()}`;
  }
}

export function gitStatusShort() {
  return runGit(['status', '--short']);
}

export function gitDiffNameStatus() {
  return runGit(['diff', '--name-status']);
}

export function gitDiffCachedNameStatus() {
  return runGit(['diff', '--cached', '--name-status']);
}

export function gitLogOneline(n = 10) {
  return runGit(['log', '--oneline', `-${n}`]);
}

export function parseStatusLines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

export function categorizePaths(lines) {
  const cats = {
    cursor: [],
    docs: [],
    src: [],
    dist: [],
    reports: [],
    tmp: [],
    wrangler: [],
    gateway: [],
    other: [],
  };

  for (const line of lines) {
    const path = line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim();
    if (!path) continue;
    if (path.startsWith('.cursor/')) cats.cursor.push(path);
    else if (path.startsWith('docs/')) cats.docs.push(path);
    else if (path.startsWith('deploy/cloudflare/dist/')) cats.dist.push(path);
    else if (path.startsWith('reports/')) cats.reports.push(path);
    else if (path.startsWith('.tmp') || path.includes('.tmp.')) cats.tmp.push(path);
    else if (path.includes('.wrangler')) cats.wrangler.push(path);
    else if (path === 'ai-model-gateway.js' || path.includes('ai-model-gateway.js')) cats.gateway.push(path);
    else cats.src.push(path);
  }
  return cats;
}

export function readDoc(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return `[missing: ${rel}]`;
  return readFileSync(p, 'utf8');
}

export function section(title, body) {
  return `\n## ${title}\n\n${body.trim()}\n`;
}

export function goNoGo(blocking, high) {
  if (blocking.length) return { verdict: 'No-Go', reason: blocking.join('; ') };
  if (high.length) return { verdict: 'No-Go', reason: high.join('; ') };
  return { verdict: 'Go', reason: 'Blocking/High なし（チェック専用・報告のみ）' };
}
