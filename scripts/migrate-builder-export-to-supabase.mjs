#!/usr/bin/env node
/**
 * Builder export → Supabase migration script (DESIGN / dry-run)
 *
 * Usage:
 *   node scripts/migrate-builder-export-to-supabase.mjs ./builder-export.json
 *
 * Default: dry-run only.
 *   --execute  (TODO) would perform inserts (not implemented).
 *
 * What dry-run does:
 * - loads JSON
 * - prints counts per table
 * - prints insert order
 * - generates legacy-id → uuid maps (in-memory) for planning
 * - warns if dataURL omitted / data: url found
 *
 * Notes:
 * - selected_partner_ids is ignored as a source of truth.
 *   In Supabase, hiring truth is builder_project_applications.status='selected'.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const INSERT_ORDER = [
  "builder_partners",
  "builder_projects",
  "builder_threads",
  "builder_project_applications",
  "builder_messages",
  "builder_thread_events",
  "builder_thread_photos",
  "builder_completion_reports",
  "builder_invoice_meta",
  "builder_pdf_outputs",
  "builder_notifications",
];

function usage() {
  console.log("Usage: node scripts/migrate-builder-export-to-supabase.mjs <export.json> [--execute]");
}

function isDataUrl(s) {
  return typeof s === "string" && s.startsWith("data:");
}

function isOmitted(s) {
  return s === "[dataURL omitted]";
}

function uuid() {
  return crypto.randomUUID();
}

function countDataUrlFlags(rows, key = "url") {
  let omitted = 0;
  let data = 0;
  for (const r of rows || []) {
    const v = r?.[key];
    if (isOmitted(v)) omitted += 1;
    if (isDataUrl(v)) data += 1;
  }
  return { omitted, data };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) return usage();

  const execute = args.includes("--execute");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) return usage();

  const abs = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(abs, "utf8");
  const json = JSON.parse(raw);

  console.log("== Builder export dry-run ==");
  console.log(`file: ${abs}`);
  console.log(`mode: ${execute ? "EXECUTE (TODO)" : "dry-run"}`);
  console.log("");

  for (const k of INSERT_ORDER) {
    const n = Array.isArray(json?.[k]) ? json[k].length : 0;
    console.log(`${k}: ${n}`);
  }

  // dataURL warnings
  const photoFlags = countDataUrlFlags(json?.builder_thread_photos, "url");
  const pdfFlags = countDataUrlFlags(json?.builder_pdf_outputs, "url");
  console.log("");
  console.log("== dataURL warnings ==");
  console.log(`builder_thread_photos.url: omitted=${photoFlags.omitted}, dataURL=${photoFlags.data}`);
  console.log(`builder_pdf_outputs.url:  omitted=${pdfFlags.omitted}, dataURL=${pdfFlags.data}`);

  console.log("");
  console.log("== Insert order (planned) ==");
  INSERT_ORDER.forEach((k, i) => console.log(`${i + 1}. ${k}`));

  // legacy id → uuid mapping (planning)
  // These maps are needed if your export uses legacy keys (project_key/thread_key/etc).
  // In actual migration, you might:
  // - insert row with id=uuid, *_key=legacy
  // - then rewrite foreign keys for child rows using the maps
  const maps = {
    partner: new Map(),
    project: new Map(),
    thread: new Map(),
  };

  for (const p of json?.builder_partners || []) {
    const key = p.partner_key || p.partner_id || p.display_name;
    if (!key) continue;
    maps.partner.set(String(key), uuid());
  }
  for (const p of json?.builder_projects || []) {
    const key = p.project_key || p.project_id || p.title;
    if (!key) continue;
    maps.project.set(String(key), uuid());
  }
  for (const t of json?.builder_threads || []) {
    const key = t.thread_key || t.thread_id;
    if (!key) continue;
    maps.thread.set(String(key), uuid());
  }

  console.log("");
  console.log("== Legacy → uuid maps (preview) ==");
  console.log(`partners: ${maps.partner.size}`);
  console.log(`projects: ${maps.project.size}`);
  console.log(`threads:  ${maps.thread.size}`);

  if (execute) {
    console.log("");
    console.log("== EXECUTE mode ==");
    const SUPABASE_URL = process.env.SUPABASE_URL || "";
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log("Missing env:");
      if (!SUPABASE_URL) console.log("- SUPABASE_URL");
      if (!SUPABASE_SERVICE_ROLE_KEY) console.log("- SUPABASE_SERVICE_ROLE_KEY");
      console.log("Stop: execute mode requires env, but we still do NOT insert in this phase.");
      process.exitCode = 2;
      return;
    }
    console.log("Env looks present (no connection attempted).");
    console.log("TODO: Implement actual inserts + storage uploads in next phase.");

    // Insert stubs (do not call in this phase)
    void insertPartners;
    void insertProjects;
    void insertThreads;
    void insertApplications;
    void insertMessages;
    void insertEvents;
    void insertPhotos;
    void insertCompletionReports;
    void insertInvoiceMeta;
    void insertPdfOutputs;
    void insertNotifications;

    void uploadPhotoDataUrl;
    void uploadPdfDataUrl;
  }
}

main();

// -------------------------------------------------------------------
// Execute-mode function stubs (next phase)
// -------------------------------------------------------------------
async function insertPartners(_ctx) {}
async function insertProjects(_ctx) {}
async function insertThreads(_ctx) {}
async function insertApplications(_ctx) {}
async function insertMessages(_ctx) {}
async function insertEvents(_ctx) {}
async function insertPhotos(_ctx) {}
async function insertCompletionReports(_ctx) {}
async function insertInvoiceMeta(_ctx) {}
async function insertPdfOutputs(_ctx) {}
async function insertNotifications(_ctx) {}

// Storage upload stubs:
// - If url is data:..., decode and upload to Storage
// - Write back storage_path/public_url/signed_url columns in DB rows
async function uploadPhotoDataUrl(_ctx, _photoRow) {}
async function uploadPdfDataUrl(_ctx, _pdfRow) {}

