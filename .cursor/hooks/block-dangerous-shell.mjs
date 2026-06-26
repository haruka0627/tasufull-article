#!/usr/bin/env node
/**
 * TASFUL safety gate — blocks deploy / git add -A / force push.
 * Check-only for other commands (permission: allow).
 */
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input.command ?? '';

const BLOCK = [
  { re: /\bgit\s+add\s+-A\b/i, msg: 'git add -A 禁止（AD-007）' },
  { re: /\bgit\s+add\s+\.\s*$/i, msg: 'git add . 一括禁止（AD-007）' },
  { re: /\bwrangler\b[^\n]*\bpublish\b/i, msg: 'wrangler publish 禁止 — 本番 deploy は人手承認のみ' },
  { re: /\bwrangler\b[^\n]*pages\s+deploy\b/i, msg: 'wrangler pages deploy 禁止 — 本番 deploy は人手承認のみ' },
  { re: /\bgit\s+push\b[^\n]*--force\b/i, msg: 'force push 禁止' },
  { re: /\bgit\s+push\b[^\n]*-f\b/i, msg: 'force push 禁止' },
];

for (const { re, msg } of BLOCK) {
  if (re.test(command)) {
    process.stdout.write(JSON.stringify({
      permission: 'deny',
      user_message: `[TASFUL Hook] ${msg}`,
      agent_message: `[TASFUL Hook] Blocked: ${msg}. Command: ${command}`,
    }));
    process.exit(0);
  }
}

process.stdout.write(JSON.stringify({ permission: 'allow' }));
process.exit(0);
