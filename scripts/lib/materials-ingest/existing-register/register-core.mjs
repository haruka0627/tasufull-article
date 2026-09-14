/**
 * Existing Asset Register core — Image/Icon only.
 * ComfyUI NOT required. Paid API NOT required.
 * Does not touch READY-5 Daily Growth runner/scheduler.
 */
import fs from "node:fs";
import path from "node:path";
import { classifyProvenance } from "./provenance.mjs";
import { buildMetadataFromEvidence } from "./metadata.mjs";
import {
  sha256File,
  buildDuplicateIndex,
  checkDuplicate,
} from "./hash.mjs";
import {
  MEDIA_EXTS,
  PROVENANCE,
  EXISTING_REGISTER_VERSION,
  CURSOR_RECOMMENDED_IMAGE_ICON_DAILY_CAP,
  NEW_GENERATION_POLICY,
} from "./ssot.mjs";
import {
  loadExistingRegisterState,
  saveExistingRegisterState,
  remainingCaps,
  recordExistingRegister,
  jstDayKey,
} from "./state.mjs";
import { parseVariationFromName, readJsonSafe } from "../common.mjs";
import { latinSlugFromFilename, publicCategoryFromDrivePath } from "../path-category.mjs";
import { isHumanIllustrationPath } from "../illustration-human-exclude.mjs";
import {
  evaluateSizeContract,
  readRasterDimensions,
} from "../size-contract.mjs";

function listMediaFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size <= 0) continue;
    const ext = path.extname(name).toLowerCase();
    if (!exts.includes(ext)) continue;
    out.push(full);
  }
  return out.sort();
}

/**
 * Discover package candidates: directories containing metadata.json OR
 * directories that look like slug packages with media files.
 */
export function discoverPackages(rootDir, assetType, { maxPackages = 500 } = {}) {
  const found = [];
  const exts = MEDIA_EXTS[assetType] || MEDIA_EXTS.image;
  if (!rootDir || !fs.existsSync(rootDir)) return found;

  function walk(dir, depth) {
    if (found.length >= maxPackages || depth > 8) return;
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const metaPath = path.join(dir, "metadata.json");
    const hasMeta = fs.existsSync(metaPath);
    const media = listMediaFiles(dir, exts);
    if (hasMeta || media.length > 0) {
      // Treat as package if metadata OR media directly in dir (not only in children)
      if (hasMeta || (media.length > 0 && depth >= 1)) {
        found.push({
          package_dir: dir,
          meta_path: hasMeta ? metaPath : null,
          files: media,
          asset_type: assetType,
          relative_path: path.relative(rootDir, dir),
        });
      }
    }
    for (const ent of ents) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith(".")) continue;
      if (ent.name === "_manifests" || ent.name === "_qa") continue;
      if (assetType === "image" && (ent.name === "背景" || ent.name === "イラスト")) continue;
      walk(path.join(dir, ent.name), depth + 1);
    }
  }
  walk(rootDir, 0);
  return found;
}

/**
 * Evaluate one package for registration eligibility.
 */
export function evaluatePackage(pkg, { duplicateIndex, writeMeta = false } = {}) {
  const meta = pkg.meta_path ? readJsonSafe(pkg.meta_path) : null;
  const hasMeta = Boolean(meta) && !meta.__error;
  const files = pkg.files?.length
    ? pkg.files
    : listMediaFiles(pkg.package_dir, MEDIA_EXTS[pkg.asset_type] || MEDIA_EXTS.image);

  if (
    isHumanIllustrationPath({
      public_id: pkg.asset_type,
      asset_type: pkg.asset_type,
      relative_path: pkg.relative_path,
      package_dir: pkg.package_dir,
      file_path: files[0],
      slug: hasMeta ? meta.slug : path.basename(pkg.package_dir),
      category_path: hasMeta ? meta.categoryPath : pkg.relative_path,
    })
  ) {
    return {
      status: "HOLD",
      reason: "illustration_human_excluded",
      package_dir: pkg.package_dir,
      asset_type: pkg.asset_type,
    };
  }

  const prefixes = new Set(
    files.map((f) => latinSlugFromFilename(path.basename(f))).filter(Boolean),
  );
  if (prefixes.size > 1) {
    return {
      status: "HOLD",
      reason: "mixed_filename_prefixes",
      package_dir: pkg.package_dir,
      asset_type: pkg.asset_type,
    };
  }
  const fromFile = latinSlugFromFilename(files[0] ? path.basename(files[0]) : "");
  const dirSlug = path.basename(pkg.package_dir);
  const dirIsLatin = /^[a-z0-9][a-z0-9-]{1,80}$/i.test(dirSlug);
  const filesMatchDir = files.some((f) =>
    Boolean(parseVariationFromName(path.basename(f), dirSlug)),
  );
  const fileSlug =
    (hasMeta && meta.slug) ||
    fromFile ||
    (dirIsLatin && filesMatchDir ? dirSlug : "");

  const provenance = classifyProvenance({
    meta: hasMeta ? meta : null,
    asset_type: pkg.asset_type,
    package_dir: pkg.package_dir,
    has_variation_files: files.length > 0,
    relative_path: pkg.relative_path,
    file_path: files[0] || pkg.package_dir,
    slug: fileSlug,
  });

  if (!provenance.auto_register) {
    return {
      status: "HOLD",
      reason:
        provenance.level === PROVENANCE.UNKNOWN
          ? "provenance_unknown"
          : "provenance_not_auto",
      provenance,
      package_dir: pkg.package_dir,
      asset_type: pkg.asset_type,
    };
  }

  const built = buildMetadataFromEvidence({
    asset_type: pkg.asset_type,
    meta: hasMeta ? meta : null,
    package_dir: pkg.package_dir,
    files,
    slug: hasMeta ? meta.slug : fileSlug || undefined,
    category_path: hasMeta
      ? meta.categoryPath
      : String(pkg.relative_path || "").replace(/\\/g, "/"),
    provenance_level: provenance.level,
    provider: hasMeta ? meta.provider : undefined,
    prompt_text: hasMeta
      ? meta.prompt
      : fs.existsSync(path.join(pkg.package_dir, "prompt.txt"))
        ? fs.readFileSync(path.join(pkg.package_dir, "prompt.txt"), "utf8").trim()
        : "",
  });

  if (!built.ok) {
    return {
      status: "HOLD",
      reason: built.reason || "metadata_insufficient",
      provenance,
      package_dir: pkg.package_dir,
      asset_type: pkg.asset_type,
    };
  }

  const slug = built.meta.slug;
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const variation =
      parseVariationFromName(path.basename(filePath), slug) ||
      String(i + 1).padStart(3, "0");
    const id = `${pkg.asset_type}:${slug}:${variation}`;
    const dim = readRasterDimensions(filePath, fs);
    if (dim) {
      const mapped = publicCategoryFromDrivePath(
        filePath,
        hasMeta ? meta : { categoryPath: pkg.relative_path },
      );
      const size = evaluateSizeContract({
        width: dim.width,
        height: dim.height,
        major: mapped?.major,
        publicId: pkg.asset_type,
      });
      if (size.applicable && !size.ok) {
        results.push({
          status: "REJECT",
          reason: size.reason,
          id,
          file_path: filePath,
          width: size.width,
          height: size.height,
        });
        continue;
      }
    }
    let sha256 = null;
    try {
      sha256 = sha256File(filePath);
    } catch {
      sha256 = null;
    }
    const dup = checkDuplicate(
      {
        id,
        filename: path.basename(filePath),
        file_path: filePath,
        sha256,
      },
      duplicateIndex,
    );
    if (dup.duplicate) {
      results.push({
        status: "REJECT",
        reason: "duplicate",
        duplicate_reason: dup.reason,
        id,
        file_path: filePath,
      });
      continue;
    }
    results.push({
      status: "REGISTER_CANDIDATE",
      id,
      slug,
      variation,
      file_path: filePath,
      sha256,
      asset_type: pkg.asset_type,
      meta: built.meta,
      provenance,
    });
  }

  let wrote = false;
  if (writeMeta && !hasMeta && built.ok) {
    const outPath = path.join(pkg.package_dir, "metadata.json");
    try {
      fs.writeFileSync(outPath, JSON.stringify(built.meta, null, 2) + "\n");
      wrote = true;
    } catch (err) {
      return {
        status: "HOLD",
        reason: "metadata_write_failed",
        detail: String(err?.message || err).slice(0, 200),
        package_dir: pkg.package_dir,
        asset_type: pkg.asset_type,
        provenance,
      };
    }
  }

  return {
    status: "EVALUATED",
    provenance,
    package_dir: pkg.package_dir,
    asset_type: pkg.asset_type,
    metadata_source: built.source,
    wrote_metadata: wrote,
    items: results,
  };
}

/**
 * Run existing register for image/icon roots.
 */
export function runExistingAssetRegister(options = {}) {
  const dayKey = options.dayKey || jstDayKey();
  const dryRun = options.dryRun !== false; // default dry-run
  const writeMeta = Boolean(options.writeMeta) && !dryRun;
  const maxPackages = Number(options.maxPackages) || 200;
  const roots = options.roots || {};
  const existingItems = options.existingItems || [];
  const statePath = options.statePath;
  let state = loadExistingRegisterState(dayKey, statePath);
  const caps = remainingCaps(state, options.env || process.env);
  const dupIndex = buildDuplicateIndex(existingItems);

  const report = {
    version: EXISTING_REGISTER_VERSION,
    at: new Date().toISOString(),
    day_key: dayKey,
    dry_run: dryRun,
    caps_policy: CURSOR_RECOMMENDED_IMAGE_ICON_DAILY_CAP,
    remaining_caps: caps,
    new_generation: NEW_GENERATION_POLICY,
    registered: [],
    held: [],
    rejected_duplicates: [],
    per_type_delta: { image: 0, icon: 0, illustration: 0, background: 0 },
    registered_ok: 0,
    held_count: 0,
    duplicate_count: 0,
    comfyui_required: false,
    paid_api_calls: 0,
    radar_api_calls: 0,
  };

  for (const assetType of ["image", "icon", "illustration", "background"]) {
    const root = roots[assetType];
    if (!root) continue;
    const packages = options.packages?.[assetType]
      ? options.packages[assetType]
      : discoverPackages(root, assetType, { maxPackages });

    for (const pkg of packages) {
      const typeRemain = caps[assetType];
      if (typeRemain <= 0 || caps.global - report.registered_ok <= 0) break;

      const evaluated = evaluatePackage(pkg, { duplicateIndex: dupIndex, writeMeta });
      if (evaluated.status === "HOLD") {
        report.held.push(evaluated);
        report.held_count += 1;
        continue;
      }

      for (const item of evaluated.items || []) {
        if (item.status === "REJECT") {
          report.rejected_duplicates.push(item);
          report.duplicate_count += 1;
          continue;
        }
        if (report.registered_ok >= caps.global) break;
        if (report.per_type_delta[assetType] >= typeRemain) break;

        report.registered.push({
          ...item,
          dry_run: dryRun,
          publication_eligible:
            item.provenance?.level === PROVENANCE.CONFIRMED ||
            item.provenance?.level === PROVENANCE.INFERABLE,
        });
        report.registered_ok += 1;
        report.per_type_delta[assetType] += 1;
        if (item.id) dupIndex.byId.add(item.id);
        if (item.sha256) dupIndex.byHash.add(item.sha256);
      }
    }
  }

  if (!dryRun) {
    state = recordExistingRegister(state, {
      registered_ok: report.registered_ok,
      held: report.held_count,
      duplicates: report.duplicate_count,
      per_type_delta: report.per_type_delta,
      dry_run: false,
    });
    saveExistingRegisterState(state, statePath);
  }

  report.state = {
    registered_ok: state.registered_ok,
    per_type: state.per_type,
  };
  report.verdict =
    report.registered_ok > 0 || report.held_count > 0
      ? "PASS"
      : "PASS_WITH_FINDINGS";
  return report;
}
