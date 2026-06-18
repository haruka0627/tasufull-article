#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeScreenshotsManifest } from "./lib/screenshots-manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { manifest, outPath } = await writeScreenshotsManifest(root, { limit: 500 });
console.log(`manifest ${manifest.showing}/${manifest.total} → ${outPath}`);
