import { readdir, stat, writeFile, readFile, mkdir, copyFile, access } from "node:fs/promises";
import { join, relative, extname, basename, dirname } from "node:path";
import {
  enrichImageQa,
  loadReportQaIndex,
  buildCategorySummary,
  findUnregistered,
  findMissingCanonical,
  REGISTERED_PATHS,
  qaPrevPath,
  FOLDER_LABELS,
  QA_VERIFICATION_RULES,
  FLOW_SEARCH,
  DEFAULT_VIEWER_PATH,
} from "./screenshots-qa.mjs";

export {
  FOLDER_LABELS,
  IMAGE_META,
  REGISTERED_PATHS,
} from "./screenshots-qa.mjs";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/**
 * @param {string} name
 * @returns {"pc"|"sp"|"other"}
 */
export function detectDevice(name) {
  const n = String(name || "").toLowerCase();
  if (/mobile390|mobile-390|m390|-390\.|_390\./.test(n)) return "sp";
  if (/pc1280|pc-1280|p1280|-1280\.|_1280\./.test(n)) return "pc";
  if (/\b390\b/.test(n) && !/\b1280\b/.test(n)) return "sp";
  if (/\b1280\b/.test(n)) return "pc";
  return "other";
}

/**
 * @param {string} name
 */
export function fileStem(name) {
  return String(name || "")
    .replace(/\.(png|jpe?g|webp|gif)$/i, "")
    .replace(/-(pc1280|pc-1280|mobile390|mobile-390)$/i, "");
}

/**
 * @param {string} folder
 */
export function folderLabel(folder) {
  if (FOLDER_LABELS[folder]) return FOLDER_LABELS[folder];
  return folder
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * @param {Date} d
 */
function formatMtime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {string} dir
 * @param {string} root
 */
async function walkImages(dir, root) {
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "_qa-prev") continue;
      out.push(...(await walkImages(full, root)));
      continue;
    }
    if (!ent.isFile() || !IMAGE_EXT.has(extname(ent.name).toLowerCase())) continue;
    const st = await stat(full);
    const rel = relative(root, full).replace(/\\/g, "/");
    const folder = basename(dirname(rel));
    out.push({
      path: rel,
      name: ent.name,
      folder,
      mtime: st.mtimeMs,
      mtimeIso: st.mtime.toISOString(),
      mtimeLabel: formatMtime(st.mtime),
      device: detectDevice(ent.name),
      stem: fileStem(ent.name),
    });
  }
  return out;
}

/**
 * @param {string} file
 */
async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * 次回差分比較用に登録済みスクショを _qa-prev へ同期（manifest 書き込み後）
 * @param {string} root
 */
async function syncQaBaselines(root) {
  for (const relPath of REGISTERED_PATHS) {
    const src = join(root, relPath);
    const dest = join(root, qaPrevPath(relPath));
    if (!(await fileExists(src))) continue;
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
}

/**
 * @param {Awaited<ReturnType<typeof walkImages>>} images
 * @param {string} root
 */
async function attachBaselineMeta(images, root) {
  for (const img of images) {
    const prev = qaPrevPath(img.path);
    const prevAbs = join(root, prev);
    const hasPrev = await fileExists(prevAbs);
    img.previousPath = hasPrev ? prev : "";
    if (!hasPrev) {
      img.hasDiff = false;
      continue;
    }
    try {
      const prevStat = await stat(prevAbs);
      img.hasDiff = Math.abs(prevStat.mtimeMs - img.mtime) > 500;
    } catch {
      img.hasDiff = Boolean(hasPrev);
    }
  }
  return images;
}

/**
 * @param {Awaited<ReturnType<typeof walkImages>>} images
 * @param {{ latestOnly?: boolean, limit?: number }} [opts]
 */
export function filterImages(images, opts = {}) {
  const limit = opts.limit ?? 0;
  const sorted = [...images].sort((a, b) => b.mtime - a.mtime);

  if (opts.latestOnly && sorted.length) {
    const newest = sorted[0].mtime;
    const windowMs = Number(process.env.SCREENSHOT_LATEST_WINDOW_MS || 3 * 60 * 1000);
    const batch = sorted.filter((img) => newest - img.mtime <= windowMs);
    const picked = batch.length ? batch : sorted.slice(0, Math.min(20, sorted.length));
    return picked;
  }

  if (limit > 0) return sorted.slice(0, limit);
  return sorted;
}

/**
 * @param {string} root
 * @param {{ latestOnly?: boolean, limit?: number, includeAll?: boolean }} [opts]
 */
export async function buildScreenshotsManifest(root, opts = {}) {
  const reportIndex = await loadReportQaIndex(root);
  const shotsDir = join(root, "screenshots");
  const walked = await walkImages(shotsDir, root);
  const all = walked.map((img) => enrichImageQa(img, reportIndex));
  await attachBaselineMeta(all, root);

  const includeAll = opts.includeAll !== false;
  const images = includeAll ? all : filterImages(all, opts);
  const registered = all.filter((img) => img.registered);
  const ignored = all.filter((img) => img.ignored);
  const qaRelevant = all.filter((img) => !img.ignored);
  const unregistered = findUnregistered(all);
  const missingCanonical = findMissingCanonical(all);
  const categories = buildCategorySummary(all);

  return {
    generatedAt: new Date().toISOString(),
    total: all.length,
    showing: images.length,
    registeredCount: registered.length,
    canonicalCount: qaRelevant.filter((img) => img.canonical).length,
    ignoredCount: ignored.length,
    qaRelevantCount: qaRelevant.length,
    unregisteredCount: unregistered.length + missingCanonical.length,
    latestOnly: Boolean(opts.latestOnly),
    qa: {
      rulesDoc: "docs/screenshots-qa-rules.md",
      rules: QA_VERIFICATION_RULES,
      flowSearch: FLOW_SEARCH,
      viewerPath: DEFAULT_VIEWER_PATH,
      categories,
      missingCanonical,
      unregistered: unregistered.slice(0, 50).map((img) => ({
        path: img.path,
        name: img.name,
        folder: img.folder,
        mtimeLabel: img.mtimeLabel,
        category: img.category,
      })),
    },
    images,
  };
}

/**
 * @param {string} root
 * @param {{ latestOnly?: boolean, limit?: number, includeAll?: boolean }} [opts]
 */
export async function writeScreenshotsManifest(root, opts = {}) {
  const manifest = await buildScreenshotsManifest(root, { ...opts, includeAll: true });
  const outPath = join(root, "screenshots", "manifest.json");
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await syncQaBaselines(root);
  return { manifest, outPath };
}

/** @deprecated use enrichImageQa */
export function enrichImageMeta(img) {
  return enrichImageQa(img);
}
