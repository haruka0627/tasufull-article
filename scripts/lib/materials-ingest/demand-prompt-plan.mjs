/**
 * Map Demand Engine picks onto existing ComfyUI prompt-file format.
 * Does not create a new Generator. Unique dated slugs only (overwrite forbidden).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planSfxDailyQuotaLines } from "./sfx-coverage-planner.mjs";
import { planImageDailyQuotaLines } from "./image-coverage-planner.mjs";
import { planIllustrationDailyQuotaLines } from "./illustration-coverage-planner.mjs";
import { planBackgroundDailyQuotaLines } from "./background-coverage-planner.mjs";
import { planIconDailyQuotaLines } from "./icon-coverage-planner.mjs";
import { planWebDailyQuotaLines } from "./web-coverage-planner.mjs";
import { planCodeDailyQuotaLines } from "./code-coverage-planner.mjs";
import { planTextDailyQuotaLines } from "./text-coverage-planner.mjs";
import { planPresentationDailyQuotaLines } from "./presentation-coverage-planner.mjs";
import { planTemplateDailyQuotaLines } from "./template-coverage-planner.mjs";
import { isHumanIllustrationPath } from "./illustration-human-exclude.mjs";
import { ILLUSTRATION_HUMAN_RISK_L1 } from "../../../Materials-CommonRunner/lib/auto-supply/demand-engine.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const DEMAND_PROMPT_FILES = Object.freeze({
  background: "ComfyUI-AutoGenerator/prompts-materials-background-auto-supply-v1.txt",
  illustration: "ComfyUI-AutoGenerator/prompts-materials-illustration-auto-supply-v1.txt",
  image: "ComfyUI-AutoGenerator/prompts-materials-image-auto-supply-v1.txt",
  icon: "ComfyUI-AutoGenerator/prompts-materials-icon-auto-supply-v1.txt",
});

/**
 * Existing Drive paths + use-case variations (not new taxonomy).
 * Human illustration folders are never included.
 */
export const DEMAND_PROMPT_CATALOG = Object.freeze([
  {
    asset_type: "background",
    drive_path: "画像素材/背景/ビジネス/オフィス",
    slug_prefix: "office-hero-free-v1",
    use_case: "Web Hero / プレゼン背景 / YouTube背景",
    prompt:
      "Empty modern office interior, wide cinematic lighting, clean glass windows, no people, no text, no watermark, background only",
  },
  {
    asset_type: "background",
    drive_path: "画像素材/背景/ビジネス/プレゼン",
    slug_prefix: "present-stage-free-v1",
    use_case: "プレゼン背景",
    prompt:
      "Empty conference stage with soft spotlight and dark professional backdrop, no people, no text, no watermark, background only",
  },
  {
    asset_type: "background",
    drive_path: "画像素材/背景/グラデーション",
    slug_prefix: "grad-stream-free-v1",
    use_case: "配信背景 / YouTube背景",
    prompt:
      "Smooth abstract gradient backdrop, teal to navy, subtle light grain, no people, no text, no watermark, background only",
  },
  {
    asset_type: "background",
    drive_path: "画像素材/背景/季節/ハロウィン",
    slug_prefix: "halloween-night-free-v1",
    use_case: "季節先出し ハロウィン",
    exploration: true,
    prompt:
      "Night halloween atmosphere, pumpkins and warm lantern glow, empty street, no people, no text, no watermark, background only",
  },
  {
    asset_type: "background",
    drive_path: "画像素材/背景/季節/夏",
    slug_prefix: "summer-sky-free-v1",
    use_case: "季節需要 夏",
    prompt:
      "Bright summer sky over calm sea horizon, wide landscape, no people, no text, no watermark, background only",
  },
  {
    asset_type: "illustration",
    drive_path: "画像素材/イラスト/食べ物/カフェ",
    slug_prefix: "cafe-cup-free-v1",
    use_case: "EC / SNS投稿 / ブログ",
    prompt:
      "Clean vector illustration of a cafe coffee cup and saucer, isolated on white, no people, no hands, no text, no watermark",
  },
  {
    asset_type: "illustration",
    drive_path: "画像素材/イラスト/テクノロジー/クラウド",
    slug_prefix: "cloud-icon-illust-free-v1",
    use_case: "UI / Web制作 / テクノロジー",
    prompt:
      "Clean vector illustration of a cloud computing symbol, isometric, isolated on white, no people, no text, no watermark",
  },
  {
    asset_type: "illustration",
    drive_path: "画像素材/イラスト/自然",
    slug_prefix: "leaf-illust-free-v1",
    use_case: "ブログ / SNS装飾",
    exploration: true,
    prompt:
      "Clean vector illustration of a single green leaf, isolated on white, no people, no text, no watermark",
  },
]);

function yyyymmdd(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

export function loadCompletedKeys(repoRoot = ROOT) {
  return loadCompletedKeysFromFile(path.join(repoRoot, "ComfyUI-AutoGenerator", "logs", "completed.txt"));
}

export function loadCompletedKeysFromFile(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  return new Set(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isSafeIllustrationCatalogEntry(entry) {
  if (entry.asset_type !== "illustration") return true;
  const segs = String(entry.drive_path || "").split("/");
  if (segs.some((s) => ILLUSTRATION_HUMAN_RISK_L1.includes(s))) return false;
  return !isHumanIllustrationPath({
    public_id: "illustration",
    relative_path: entry.drive_path,
    prompt: entry.prompt,
  });
}

export function buildDemandPromptLine(entry, now = new Date()) {
  const slug = `${entry.slug_prefix}-${yyyymmdd(now)}`;
  const left = `${entry.drive_path}/${slug}`;
  return {
    ...entry,
    slug,
    line: `${left}|${entry.prompt}`,
    output_key: left,
  };
}

/**
 * Choose catalog entries for a small closed loop: 1 exploit + optional 1 exploration.
 */
export function selectDemandPromptEntries(opts = {}) {
  const now = opts.now || new Date();
  const completed = opts.completedKeys || loadCompletedKeys(opts.repoRoot);
  const max = Math.max(1, Number(opts.max) || 2);
  const safe = DEMAND_PROMPT_CATALOG.filter(isSafeIllustrationCatalogEntry);
  const exploitPool = safe.filter((e) => e.exploration !== true);
  const explorePool = safe.filter((e) => e.exploration === true);
  const picked = [];

  function takeFrom(pool) {
    for (const entry of pool) {
      if (picked.length >= max) return;
      const built = buildDemandPromptLine(entry, now);
      const keys = [built.output_key, built.slug, `${built.drive_path}/${built.slug}`];
      if (keys.some((k) => completed.has(k))) continue;
      if (picked.some((p) => p.asset_type === built.asset_type)) continue;
      picked.push(built);
      return;
    }
  }

  takeFrom(exploitPool);
  if (picked.length < max) takeFrom(explorePool);
  if (picked.length < max) takeFrom(exploitPool.filter((e) => !picked.some((p) => p.slug_prefix === e.slug_prefix)));
  return picked;
}

export function appendPromptLines(repoRoot, entries) {
  const written = [];
  for (const entry of entries) {
    const rel = DEMAND_PROMPT_FILES[entry.asset_type];
    if (!rel) continue;
    const abs = path.join(repoRoot, rel);
    let cur = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    if (!cur.endsWith("\n") && cur.length) cur += "\n";
    if (cur.includes(`${entry.drive_path}/${entry.slug}|`)) {
      written.push({ ...entry, appended: false, reason: "already_in_prompt_file" });
      continue;
    }
    const header = cur.includes("Demand Engine")
      ? ""
      : `# Demand Engine ${yyyymmdd()} — existing Drive path + unique slug\n`;
    fs.writeFileSync(abs, cur + header + entry.line + "\n", "utf8");
    written.push({ ...entry, appended: true, file: rel });
  }
  return written;
}

/** GENERIC FILL disabled: coverage planners only. Count-under-quota is valid. */
export const QUOTA_PROMPT_FILE = {
  background: "ComfyUI-AutoGenerator",
  illustration: "ComfyUI-AutoGenerator",
  image: "ComfyUI-AutoGenerator",
  icon: "ComfyUI-AutoGenerator",
  sfx: "SFX-AutoGenerator",
  "web-material": "Web-Materials-AutoGenerator",
  template: "Template-AutoGenerator",
  presentation: "Presentation-AutoGenerator",
  "code-material": "Code-Materials-AutoGenerator",
  document: "Text-Materials-AutoGenerator",
};

export function quotaPromptRelPath(assetType, dayKey) {
  const dir = QUOTA_PROMPT_FILE[assetType];
  if (!dir) return null;
  const day = String(dayKey || yyyymmdd()).replace(/-/g, "");
  return `${dir}/prompts-quota-${assetType}-${day}.txt`;
}

export function loadCompletedKeysForAssetType(assetType, repoRoot = ROOT) {
  const mapped =
    QUOTA_PROMPT_FILE[assetType] ||
    (assetType === "web" ? QUOTA_PROMPT_FILE["web-material"] : null) ||
    (assetType === "code" ? QUOTA_PROMPT_FILE["code-material"] : null);
  if (!mapped) return new Set();
  return loadCompletedKeysFromFile(path.join(repoRoot, mapped, "logs", "completed.txt"));
}

/**
 * Plan up to the shortage-derived daily cap for one category; content comes from seeds + Demand.
 */
export function planDailyQuotaLines(assetType, opts = {}) {
  if (assetType === "sfx") {
    return planSfxDailyQuotaLines(opts);
  }
  if (assetType === "image") {
    return planImageDailyQuotaLines(opts);
  }
  if (assetType === "illustration") {
    return planIllustrationDailyQuotaLines(opts);
  }
  if (assetType === "background") {
    return planBackgroundDailyQuotaLines(opts);
  }
  if (assetType === "icon") {
    return planIconDailyQuotaLines(opts);
  }
  if (assetType === "web-material" || assetType === "web") {
    return planWebDailyQuotaLines(opts);
  }
  if (assetType === "code-material" || assetType === "code") {
    return planCodeDailyQuotaLines(opts);
  }
  if (assetType === "document" || assetType === "text") {
    return planTextDailyQuotaLines(opts);
  }
  if (assetType === "presentation") {
    return planPresentationDailyQuotaLines(opts);
  }
  if (assetType === "template") {
    return planTemplateDailyQuotaLines(opts);
  }
  // GENERIC FILL DISABLED (v2): slug-only clones are not unique products.
  // Unknown / unplanned families return 0 lines. Count-under-quota is correct.
  return [];
}

export function writeDailyQuotaPromptFile(repoRoot, assetType, lines, dayKey) {
  const rel = quotaPromptRelPath(assetType, dayKey);
  if (!rel || !lines.length) return { ok: false, file: rel, count: 0 };
  const abs = path.join(repoRoot, rel);
  const body = [
    `# Daily quota ${assetType} ${dayKey || yyyymmdd()} — unique slugs, no overwrite`,
    ...lines.map((l) => l.line),
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, "utf8");
  return { ok: true, file: rel, count: lines.length };
}
