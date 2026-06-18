#!/usr/bin/env node
/** Per-file Vite transformIndexHtml after Phase 2-D restore */
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import { metrics, total } from "./scan-phase2d-mojibake.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "detail-skill.html",
      "detail-worker.html",
      "detail-job.html",
      "detail-product.html",
      "detail-shop.html",
      "detail-business-service.html",
      "detail-general.html",
      "detail-shop-product.html",
    ];

async function main() {
  const server = await createServer({ root: ROOT, server: { middlewareMode: true } });
  let failed = 0;
  try {
    for (const rel of files) {
      const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
      const m = metrics(html);
      try {
        await server.transformIndexHtml(`/${rel}`, html);
        console.log(`OK ${rel} (mojibake total=${total(m)})`);
      } catch (e) {
        failed++;
        console.error(`FAIL ${rel}`, String(e.message).split("\n")[0]);
      }
    }
  } finally {
    await server.close();
  }
  process.exit(failed ? 1 : 0);
}

main();
