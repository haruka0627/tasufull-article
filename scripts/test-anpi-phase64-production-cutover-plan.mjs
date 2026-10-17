#!/usr/bin/env node
/**
 * ANPI Phase 64 — plan readiness self-check (no network · no Production).
 * Ensures SSOT docs + judgment JSON exist and CUTOVER remains NO-GO.
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pass(name) {
  console.log(`PASS ${name}`);
}

function main() {
  const plan = path.join(root, "docs/anpi-phase64-production-cutover-plan.md");
  const sheet = path.join(root, "docs/anpi-phase64-go-nogo-checklist.md");
  const evidence = path.join(root, "reports/anpi-phase64-production-cutover-readiness.json");

  assert.equal(fs.existsSync(plan), true);
  assert.equal(fs.existsSync(sheet), true);
  assert.equal(fs.existsSync(evidence), true);
  pass("A_docs_present");

  const planText = fs.readFileSync(plan, "utf8");
  for (const needle of [
    "runtime pause",
    "anpi:prod:v1",
    "WAITING_EXPLICIT_APPROVAL",
    "14:45",
    "legacy_stub",
    "ANPI_PRODUCTION_CUTOVER",
    "DO NOT RUN",
  ]) {
    assert.match(planText, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  pass("B_plan_contains_mandatory_sections");

  const j = JSON.parse(fs.readFileSync(evidence, "utf8"));
  assert.equal(j.production_operations_executed, false);
  assert.equal(j.judgments.ANPI_PRODUCTION_CUTOVER_PLAN, "READY");
  assert.equal(j.judgments.ANPI_PRODUCTION_CUTOVER, "NO_GO");
  assert.equal(j.judgments.ANPI_PRODUCTION_DB_READINESS, "NOT_READY");
  assert.equal(j.judgments.ANPI_PRODUCTION_WORKER_READINESS, "NOT_READY");
  assert.equal(j.staging_sha8_forbidden_in_prod, "0411f04d");
  assert.equal(j.phase63_shutdown_race.not_scoped_allowlist_violation, true);
  pass("C_evidence_judgments_nogo");

  console.log("ALL PASS anpi-phase64-production-cutover-plan");
}

main();
