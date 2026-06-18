#!/usr/bin/env node
/**
 * screenshots/index.html を自動生成し、ブラウザで開く
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeVerification } from "./lib/finalize-verification.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await finalizeVerification(root, {
  refreshFolderIndexes: process.env.SCREENSHOT_INDEX_REFRESH_ALL === "1",
});
