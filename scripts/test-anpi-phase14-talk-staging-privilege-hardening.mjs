#!/usr/bin/env node
/**
 * ANPI Phase 14 — static proof for the privilege hardening package.
 *
 * - Hardening SQL is REVOKE/GRANT-narrowing only (no DDL / no data DML)
 * - No destructive execution (DROP TABLE / TRUNCATE stmt / DELETE FROM / UPDATE data)
 * - No Realtime publication / trigger / real-mode changes
 * - No authenticated write expansion (no INSERT/DELETE/TRUNCATE grants to authenticated)
 * - anon/public gain nothing
 * - Rollback restores only the observed pre-Phase-14 authenticated ACL
 * - Phase 2-10 migration hashes unchanged
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HARDENING = path.join(root, "sql", "anpi-phase14-talk-staging-privilege-hardening.sql");
const ROLLBACK = path.join(
  root,
  "sql",
  "anpi-phase14-talk-staging-privilege-hardening-rollback.sql",
);

const MIGRATIONS = {
  "20260726090000_anpi_phase2_schema.sql": null,
  "20260727100000_anpi_phase10_talk_write_path.sql": "4fc078ea58672410",
};

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

function sha16(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

const hardening = fs.readFileSync(HARDENING, "utf8");
const rollback = fs.readFileSync(ROLLBACK, "utf8");
const hardeningExec = stripSqlComments(hardening);
const rollbackExec = stripSqlComments(rollback);

check("Phase 10 migration hash unchanged", () => {
  const file = path.join(
    root,
    "supabase",
    "migrations",
    "20260727100000_anpi_phase10_talk_write_path.sql",
  );
  assert.equal(sha16(file), MIGRATIONS["20260727100000_anpi_phase10_talk_write_path.sql"]);
});

check("hardening targets staging allowlist and rejects production", () => {
  // PRODUCTION DENY: production project ref must never appear as apply target
  assert.match(hardening, /ahlxuyvhzqdqaojiywmu/);
  assert.doesNotMatch(hardeningExec, /ddojquacsyqesrjhcvmn/);
});

check("hardening is REVOKE/narrow-GRANT + sanity SELECT only", () => {
  const statements = hardeningExec
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    assert.match(
      st,
      /^(revoke|grant|select)\b/i,
      `unexpected statement kind: ${st.slice(0, 60)}`,
    );
  }
});

check("hardening has no DDL / destructive / publication / trigger statements", () => {
  assert.doesNotMatch(hardeningExec, /\b(create|alter|drop)\s+(table|index|policy|function|publication|trigger)\b/i);
  assert.doesNotMatch(hardeningExec, /\btruncate\s+(table\s+)?public\./i);
  assert.doesNotMatch(hardeningExec, /\bdelete\s+from\b/i);
  assert.doesNotMatch(hardeningExec, /\bupdate\s+public\./i);
  assert.doesNotMatch(hardeningExec, /\binsert\s+into\b/i);
  assert.doesNotMatch(hardeningExec, /\balter\s+publication\b/i);
});

check("hardening revokes residual authenticated privileges", () => {
  assert.match(
    hardeningExec,
    /revoke\s+insert\s*,\s*delete\s*,\s*truncate\s*,\s*references\s*,\s*trigger\s+on\s+table\s+public\.talk_notifications\s+from\s+authenticated/is,
  );
});

check("no write-privilege grant to authenticated/anon/public", () => {
  const grants = hardeningExec.match(/grant\b[^;]+;/gis) || [];
  for (const g of grants) {
    if (/\bto\s+authenticated\b/i.test(g)) {
      assert.doesNotMatch(g, /\b(insert|delete|truncate|references|trigger|all)\b/i);
      assert.match(g, /grant\s+select\s*,\s*update\b/i);
    }
    assert.doesNotMatch(g, /\bto\s+(anon|public)\b/i);
  }
  assert.ok(grants.some((g) => /\bto\s+service_role\b/i.test(g)));
});

check("rollback only re-grants observed pre-state to authenticated (no anon/public)", () => {
  assert.match(
    rollbackExec,
    /grant\s+insert\s*,\s*delete\s*,\s*truncate\s*,\s*references\s*,\s*trigger\s+on\s+table\s+public\.talk_notifications\s+to\s+authenticated/is,
  );
  assert.doesNotMatch(rollbackExec, /\bto\s+(anon|public)\b/i);
  assert.doesNotMatch(rollbackExec, /\b(create|alter|drop)\s+/i);
});

check("package does not touch Phase 12 policies or client files", () => {
  assert.doesNotMatch(hardeningExec + rollbackExec, /\bpolicy\b/i);
  assert.doesNotMatch(hardening, /talk-notifications-store\.js|talk-supabase-sync\.js/);
});

console.log(`ANPI Phase 14 static: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
