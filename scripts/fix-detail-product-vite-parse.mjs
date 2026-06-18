#!/usr/bin/env node
/**
 * Vite transformIndexHtml fails when wrapper uses data-listing-product-*-block
 * alongside child data-listing-product-*>text. *-block hooks are unused in listing-detail-loader.js.
 */
import fs from "node:fs";
import { createServer } from "vite";

const file = "detail-product.html";
let html = fs.readFileSync(file, "utf8");

const blockAttrs = [
  "description",
  "category",
  "condition",
  "price-note",
  "stock",
  "specs",
  "shipping",
];
for (const key of blockAttrs) {
  html = html.replace(
    new RegExp(`" data-listing-product-${key.replace("-", "\\-")}-block"`, "g"),
    '"'
  );
}

fs.writeFileSync(file, html, "utf8");

const server = await createServer({ root: process.cwd() });
try {
  await server.transformIndexHtml(`/${file}`, html);
  console.log("Vite transformIndexHtml: OK");
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
} finally {
  await server.close();
}
