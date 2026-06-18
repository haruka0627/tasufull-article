/**
 * Playwright 録画 (webm) → mp4 変換ヘルパー
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

/** @returns {Promise<string|null>} */
async function resolveFfmpegPath() {
  try {
    const mod = await import("ffmpeg-static");
    const bundled = mod.default || mod;
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    /* optional dependency */
  }
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return "ffmpeg";
  } catch {
    return null;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 * @param {string} mp4Path
 */
export async function finalizeContextVideoMp4(page, context, mp4Path) {
  const video = page.video();
  if (!video) throw new Error("recordVideo が有効な context ではありません");

  const tmpDir = path.dirname(mp4Path);
  fs.mkdirSync(tmpDir, { recursive: true });
  const webmPath = mp4Path.replace(/\.mp4$/i, ".webm");

  await context.close();
  await video.saveAs(webmPath);

  const ffmpeg = await resolveFfmpegPath();
  if (!ffmpeg) {
    throw new Error("mp4 変換には ffmpeg または ffmpeg-static が必要です");
  }

  await execFileAsync(ffmpeg, [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4Path,
  ]);

  try {
    fs.unlinkSync(webmPath);
  } catch {
    /* ignore */
  }

  return mp4Path;
}

/** @param {string} mp4Path @returns {Promise<number|null>} 秒（四捨五入） */
export async function probeMp4DurationSec(mp4Path) {
  const ffmpeg = await resolveFfmpegPath();
  if (!ffmpeg || !fs.existsSync(mp4Path)) return null;
  let stderr = "";
  try {
    await execFileAsync(ffmpeg, ["-hide_banner", "-i", mp4Path]);
  } catch (err) {
    stderr = String(err?.stderr || err?.message || "");
  }
  const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  const sec = Number(match[1]) * 3600 + Number(match[2]) * 60 + parseFloat(match[3]);
  return Math.round(sec);
}

/** @param {import('playwright').Browser} browser @param {object} opts */
export function mobileVideoContextOptions(viewport, videoDir, deviceProfile = {}) {
  return {
    ...deviceProfile,
    viewport,
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: videoDir,
      size: viewport,
    },
  };
}
