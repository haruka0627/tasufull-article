#!/usr/bin/env node
import fs from "node:fs";
import { createServer } from "vite";

const html = fs.readFileSync("backups/_phase2d-extract/detail-product.html", "utf8");
const lines = html.split("\n");

async function tryHtml(h, label) {
  const s = await createServer({ root: process.cwd() });
  try {
    await s.transformIndexHtml("/detail-product.html", h);
    console.log("OK", label);
    return true;
  } catch (e) {
    console.log("FAIL", label, String(e.message).split("\n")[0]);
    return false;
  } finally {
    await s.close();
  }
}

await tryHtml(html, "full");

for (let end = 100; end <= 150; end += 5) {
  const chunk = lines.slice(0, end).join("\n") + "\n</body></html>";
  await tryHtml(chunk, `lines 1-${end}`);
}
