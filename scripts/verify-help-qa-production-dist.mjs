#!/usr/bin/env node
/** Verify production dist has no Q&A admin UI scripts */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");

const ADMIN_MARKERS = [
  "platform-qa-admin-ui.js",
  "platform-qa-curation.js",
  "platform-qa-curation-ui.js",
  "platform-qa-dev.js",
  "data-qa-admin-delete",
  "data-qa-admin-banner",
  "data-qa-curation-root",
];

function walkHtml(dir, fn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, fn);
    else if (ent.name.endsWith(".html")) fn(p);
  }
}

let failed = false;

const adminUi = path.join(DIST, "platform-qa-admin-ui.js");
if (fs.existsSync(adminUi)) {
  console.error("FAIL dist contains platform-qa-admin-ui.js");
  failed = true;
}

for (const name of ["platform-qa-curation.js", "platform-qa-curation-ui.js"]) {
  if (fs.existsSync(path.join(DIST, name))) {
    console.error(`FAIL dist contains ${name}`);
    failed = true;
  }
}

if (fs.existsSync(path.join(DIST, "help/curation"))) {
  console.error("FAIL dist contains help/curation/");
  failed = true;
}

const hub = path.join(DIST, "help/index.html");
if (!fs.existsSync(hub)) {
  console.error("FAIL dist/help/index.html missing");
  process.exit(1);
}

const hubHtml = fs.readFileSync(hub, "utf8");
for (const marker of ADMIN_MARKERS) {
  if (hubHtml.includes(marker)) {
    console.error(`FAIL help/index.html contains admin marker: ${marker}`);
    failed = true;
  }
}

const configPath = path.join(DIST, "platform-qa-admin-config.js");
if (fs.existsSync(configPath)) {
  const cfg = fs.readFileSync(configPath, "utf8");
  if (!cfg.includes("isAdminUiEnabled()") || !cfg.includes("return false")) {
    console.warn("WARN platform-qa-admin-config.js may not be production-frozen");
  }
}

let badDetail = 0;
walkHtml(path.join(DIST, "help"), (file) => {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes("platform-qa-admin-ui.js") || html.includes("platform-qa-dev.js")) {
    badDetail += 1;
  }
});

if (badDetail > 0) {
  console.error(`FAIL ${badDetail} help HTML still reference admin scripts`);
  failed = true;
}

if (failed) process.exit(1);
console.log("PASS production dist has no Q&A admin UI");
