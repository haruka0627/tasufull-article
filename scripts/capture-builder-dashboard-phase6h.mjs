#!/usr/bin/env node
/**
 * Capture Builder Command Dashboard screenshot (Phase 6-H)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "deploy/cloudflare/dist/builder/project-dashboard.html");
const out = path.join(root, "reports/builder-dashboard-phase6h-1280.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`file:///${html.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-builder-pd-kpi] .builder-pd-kpi-card");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
