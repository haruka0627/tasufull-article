#!/usr/bin/env node
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const diff = execSync("git diff --cached", { cwd: ROOT, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });

const checks = [
  { id: "GEMINI_API_KEY=", re: /GEMINI_API_KEY\s*=\s*["'][^"']{8,}["']/ },
  { id: "sk_live_", re: /sk_live_[a-zA-Z0-9]{10,}/ },
  { id: "sk_test_", re: /sk_test_[a-zA-Z0-9]{10,}/ },
  { id: "AIzaSy", re: /AIzaSy[a-zA-Z0-9_-]{20,}/ },
  { id: "sb_secret_", re: /sb_secret_[a-zA-Z0-9_-]{10,}/ },
  { id: "service_role JWT", re: /"role"\s*:\s*"service_role"[\s\S]{0,80}"iss"/ },
  { id: ".env block", re: /^\+.*SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s#]+/m },
  { id: "local config", re: /^\+.*chat-supabase-config\.local\.js/m },
];

const hits = [];
for (const c of checks) {
  if (c.re.test(diff)) hits.push(c.id);
}

// service_role word in added lines only (comment/guard noise)
const commentOnly = [];
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const serviceRoleLines = added.filter((l) => /service_role/i.test(l));
if (serviceRoleLines.length && !hits.includes("service_role JWT")) {
  commentOnly.push(
    `service_role mentions in +lines: ${serviceRoleLines.length} (comments/guards; no JWT value)`
  );
}

console.log(JSON.stringify({ hits, commentOnly }, null, 2));
process.exit(hits.length ? 1 : 0);
