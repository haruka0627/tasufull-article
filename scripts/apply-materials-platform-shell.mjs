#!/usr/bin/env node
/**
 * Materials ソース HTML を Platform シェルプレースホルダー化し、dist に正本 header/footer を注入
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATERIALS_HTML_TARGETS,
  applyMaterialsPlatformShell,
  stripMaterialsShellToPlaceholders,
} from "./lib/materials-page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");

for (const rel of MATERIALS_HTML_TARGETS) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) continue;

  const raw = fs.readFileSync(src, "utf8");
  const placeholder = stripMaterialsShellToPlaceholders(raw);
  fs.writeFileSync(src, placeholder, "utf8");

  const built = applyMaterialsPlatformShell(placeholder);
  const dist = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dist), { recursive: true });
  fs.writeFileSync(dist, built, "utf8");
  console.log("materials shell:", rel);
}
