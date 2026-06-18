#!/usr/bin/env node
/**
 * capture / test / review スクリプトに finalizeScreenshotRun を追加
 * 既に index 更新があるファイルはスキップ
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function listScripts() {
  const dir = join(ROOT, "scripts");
  const names = await readdir(dir);
  return names
    .filter((n) => /^(capture|test|review)-.+\.mjs$/.test(n))
    .map((n) => join(dir, n));
}

const HAS_INDEX =
  /finalizeScreenshotRun|finalizeVerification|writeReviewIndexArtifacts|writeScreenshotsIndex|buildVerificationIndex/;
const USES_SCREENSHOTS =
  /page\.screenshot|\.screenshot\s*\(|screenshots[/\\]|review-report\.json|report\.json/;

function inferFolderId(content) {
  const m1 = content.match(/const\s+FOLDER_ID\s*=\s*["']([^"']+)["']/);
  if (m1) return m1[1];
  const m2 = content.match(/screenshots["'],\s*["']([^"']+)["']/);
  if (m2) return m2[1];
  const m3 = content.match(/screenshots[/\\]([a-z0-9-]+)/i);
  if (m3) return m3[1];
  return "";
}

function inferRootVar(content) {
  if (/\bconst ROOT\b/.test(content)) return "ROOT";
  if (/\bconst root\b/.test(content)) return "root";
  return "ROOT";
}

function inferOutDirVar(content) {
  if (/\bconst OUT_DIR\b/.test(content)) return "OUT_DIR";
  if (/\bconst SHOT_DIR\b/.test(content)) return "SHOT_DIR";
  if (/\bconst OUT\b/.test(content)) return "OUT";
  return "";
}

function inferTitle(content, folderId) {
  const m = content.match(/const\s+REVIEW_TITLE\s*=\s*["']([^"']+)["']/);
  if (m) return m[1];
  return folderId;
}

function patchContent(content, filePath) {
  if (HAS_INDEX.test(content)) return null;
  if (!USES_SCREENSHOTS.test(content)) return null;

  const folderId = inferFolderId(content);
  const outVar = inferOutDirVar(content);
  if (!folderId && !outVar) return null;

  const rootVar = inferRootVar(content);
  const title = inferTitle(content, folderId);
  let next = content;

  if (!/finalizeScreenshotRun|finalizeFromOutDir/.test(next)) {
    const importLine = `import { finalizeScreenshotRun, finalizeFromOutDir } from "./lib/finalize-screenshot-run.mjs";\n`;
    if (/^import /m.test(next)) {
      next = next.replace(/^(import .+\n)(?!import )/m, `$1${importLine}`);
    } else {
      next = importLine + next;
    }
  }

  const finalizeBlock =
    outVar && folderId
      ? `\nawait finalizeScreenshotRun(${rootVar}, "${folderId}", {\n  title: ${/REVIEW_TITLE/.test(content) ? "REVIEW_TITLE" : `"${title}"`},\n  targetPage: ${content.includes("targetPage") ? "targetPage" : '""'},\n});\n`
      : outVar
        ? `\nawait finalizeFromOutDir(${rootVar}, ${outVar}, {\n  title: ${/REVIEW_TITLE/.test(content) ? "REVIEW_TITLE" : `"${title}"`},\n  folderId: "${folderId || ""}" || undefined,\n});\n`
        : `\nawait finalizeScreenshotRun(${rootVar}, "${folderId}", { title: "${title}" });\n`;

  if (/process\.exit\s*\(/.test(next)) {
    next = next.replace(/(\n\s*)process\.exit\s*\(/, `${finalizeBlock}$1process.exit(`);
  } else if (/process\.exitCode\s*=/.test(next)) {
    next = next.replace(/(\n\s*)process\.exitCode\s*=/, `${finalizeBlock}$1process.exitCode =`);
  } else if (/main\(\)\.catch/.test(next)) {
    next = next.replace(/(\n)(main\(\)\.catch)/, `${finalizeBlock}$1$2`);
  } else {
    next = next.trimEnd() + finalizeBlock;
  }

  if (next === content) return null;
  return next;
}

const files = await listScripts();

let patched = 0;
let skipped = 0;
for (const file of files.sort()) {
  const content = await readFile(file, "utf8");
  const next = patchContent(content, file);
  if (!next) {
    skipped++;
    continue;
  }
  await writeFile(file, next, "utf8");
  patched++;
  console.log(`patched: ${basename(file)}`);
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped`);
