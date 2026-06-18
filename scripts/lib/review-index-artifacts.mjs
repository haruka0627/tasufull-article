import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { shouldIncludeScreenshotFolder } from "./screenshot-ops.mjs";
import {
  SCREENSHOT_IMAGE_VIEWER_CSS,
  SCREENSHOT_IMAGE_VIEWER_HTML,
  SCREENSHOT_IMAGE_VIEWER_SCRIPT,
  SCREENSHOT_BACK_NAV_CSS,
  renderScreenshotBackNav,
} from "./screenshot-image-viewer.mjs";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/** @type {Record<string, string>} */
export const REVIEW_FOLDER_TITLES = {
  "chat-list-ui-review": "chat-list UIレビュー",
  "breadcrumb-trail-review": "パンくず導線レビュー",
  "market-user-flow-review": "市場ユーザーフローレビュー",
  "talk-user-flow-review": "TALKユーザーフローレビュー",
  "builder-user-flow-review": "Builderユーザーフローレビュー",
  "connect-user-flow-review": "Connectユーザーフローレビュー",
  "dashboard-quick-actions-color": "ダッシュボード クイックアクション配色レビュー",
  "dashboard-service-drawer": "ダッシュボード サービスメガメニューレビュー",
};

/**
 * @param {string} id
 */
export function isAutomatedReviewFolder(id) {
  const s = String(id || "");
  if (/-(?:ui-review|user-flow-review|trail-review|browser|viewports|unified|v\d+)$/.test(s)) return true;
  if (/^(dashboard-|auth-|admin-ai-|talk-|builder-|market-|chat-|breadcrumb-)/.test(s)) return true;
  return /-(?:ui-review|user-flow-review|trail-review)$/.test(s);
}

function detectViewportFromName(name) {
  const n = String(name || "").toLowerCase();
  if (/-390\b|mobile390|mobile-390|\b390px\b/.test(n)) return "390";
  if (/-768\b|tablet768|768px|\b768\b/.test(n)) return "768";
  if (/-1280\b|pc1280|pc-1280|\b1280px\b/.test(n)) return "1280";
  if (/\b390\b/.test(n) && !/\b1280\b/.test(n)) return "390";
  if (/\b768\b/.test(n)) return "768";
  if (/\b1280\b/.test(n)) return "1280";
  return "";
}

function viewportDisplayLabel(vp) {
  if (vp === "390") return "390px";
  if (vp === "768") return "768px";
  if (vp === "1280") return "1280px";
  return vp || "その他";
}

function groupImagesByViewport(images) {
  /** @type {Record<string, typeof images>} */
  const groups = { 390: [], 768: [], 1280: [], other: [] };
  for (const img of images) {
    const vp = img.viewport || detectViewportFromName(img.file) || "other";
    const key = groups[vp] ? vp : "other";
    groups[key].push(img);
  }
  return groups;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(value) {
  if (value === "PASS" || value === true) return `<span class="badge badge--pass">PASS</span>`;
  if (value === "FAIL" || value === false) return `<span class="badge badge--fail">FAIL</span>`;
  return `<span class="badge badge--na">—</span>`;
}

function resolveFolderTitle(folderId, title) {
  if (title) return title;
  return REVIEW_FOLDER_TITLES[folderId] || folderId;
}

/**
 * review-report.json を index 互換 report に正規化
 * @param {unknown} raw
 * @param {{ folderId?: string, title?: string, generatedAt?: string }} [opts]
 */
export function normalizeReviewReport(raw, opts = {}) {
  if (!raw || typeof raw !== "object") return null;

  /** @type {Record<string, unknown>} */
  const source = /** @type {Record<string, unknown>} */ (raw);

  if (Array.isArray(source.pages) && source.pages.length) {
    return source;
  }

  if (
    Array.isArray(source.cases) &&
    source.cases.length &&
    source.summary &&
    typeof source.summary === "object"
  ) {
    return source;
  }

  const generatedAt = String(
    source.generatedAt || source.capturedAt || opts.generatedAt || new Date().toISOString()
  );
  const folderId = opts.folderId || String(source.folderId || "");
  const title = resolveFolderTitle(folderId, opts.title || String(source.title || ""));

  if (Array.isArray(source.results)) {
    const cases = source.results.map((row) => {
      const r = /** @type {Record<string, unknown>} */ (row || {});
      const pass = r.pass !== false && r.pass !== "FAIL";
      return {
        caseId: String(r.id || r.caseId || "case"),
        pass,
        label: String(r.step || r.label || r.id || "check"),
        step: String(r.step || ""),
        actual: String(r.actual || r.reason || ""),
        expected: String(r.expected || ""),
      };
    });
    const failCount =
      typeof source.failed === "number"
        ? Number(source.failed)
        : cases.filter((c) => c.pass === false).length;
    const total = typeof source.total === "number" ? Number(source.total) : cases.length;
    const passCount =
      typeof source.passed === "number" ? Number(source.passed) : Math.max(0, total - failCount);
    const overall = failCount > 0 ? "FAIL" : "PASS";

    return {
      generatedAt,
      folderId,
      title,
      overall,
      summary: {
        overall,
        failCount,
        passCount,
        minorCount: 0,
        total,
      },
      cases,
      source: "review-report.json",
    };
  }

  if (typeof source.pass === "boolean") {
    const overall = source.pass ? "PASS" : "FAIL";
    return {
      generatedAt,
      folderId,
      title,
      overall,
      summary: {
        overall,
        failCount: source.pass ? 0 : 1,
        passCount: source.pass ? 1 : 0,
        minorCount: 0,
        total: 1,
      },
      cases: [],
      source: "review-report.json",
      raw: source,
    };
  }

  if (source.overall || source.counts) {
    const counts = /** @type {Record<string, number>} */ (source.counts || {});
    const failCount =
      typeof counts.fail === "number"
        ? counts.fail
        : source.overall === "FAIL"
          ? 1
          : 0;
    const passCount = typeof counts.pass === "number" ? counts.pass : 0;
    const minorCount = typeof counts.warning === "number" ? counts.warning : 0;
    const overall = String(source.overall || (failCount > 0 ? "FAIL" : minorCount > 0 ? "MINOR" : "PASS"));

    return {
      ...source,
      generatedAt,
      folderId,
      title,
      overall,
      summary: {
        overall,
        failCount,
        passCount,
        minorCount,
        total: passCount + failCount + minorCount,
      },
      source: "review-report.json",
    };
  }

  return {
    generatedAt,
    folderId,
    title,
    overall: "PASS",
    summary: { overall: "PASS", failCount: 0, passCount: 0, minorCount: 0, total: 0 },
    cases: [],
    source: "review-report.json",
    raw: source,
  };
}

/**
 * @param {string} folderPath
 * @param {string} folderId
 */
async function listFolderImages(folderPath, folderId) {
  let entries = [];
  try {
    entries = await readdir(folderPath);
  } catch {
    return [];
  }

  const images = [];
  for (const name of entries) {
    if (!IMAGE_EXT.has(extname(name).toLowerCase())) continue;
    const st = await stat(join(folderPath, name));
    images.push({
      file: name,
      relPath: `${folderId}/${name}`,
      mtimeMs: st.mtimeMs,
      viewport: detectViewportFromName(name),
    });
  }
  images.sort((a, b) => a.file.localeCompare(b.file, "en"));
  return images;
}

/**
 * @param {{ folderId: string, title?: string, report: Record<string, unknown>, images: Array<{ file: string, relPath: string, mtimeMs?: number }> }} data
 */
export function renderReviewFolderIndex(data) {
  const title = resolveFolderTitle(data.folderId, data.title || String(data.report?.title || ""));
  const report = data.report || {};
  const summary = /** @type {Record<string, unknown>} */ (report.summary || {});
  const overall = String(report.overall || summary.overall || "PASS");
  const failCount = Number(summary.failCount ?? 0);
  const passCount = Number(summary.passCount ?? 0);
  const cases = Array.isArray(report.cases) ? report.cases : [];
  const catalogByFile = new Map(
    (Array.isArray(report.screenshotCatalog) ? report.screenshotCatalog : []).map((row) => {
      const r = /** @type {Record<string, string>} */ (row || {});
      return [String(r.file || ""), r];
    })
  );

  const shotCaption = (file) => {
    const meta = catalogByFile.get(file);
    if (meta?.label && meta?.url) return `${meta.label} · ${meta.url}`;
    if (meta?.label) return String(meta.label);
    return file;
  };

  const caseRows = cases
    .map((row) => {
      const c = /** @type {Record<string, unknown>} */ (row || {});
      const pass = c.pass !== false && c.pass !== "FAIL";
      return `<tr class="${pass ? "row--pass" : "row--fail"}">
        <td>${pass ? "OK" : "NG"}</td>
        <td><code>${esc(c.caseId || c.id)}</code></td>
        <td>${esc(c.label || c.step)}</td>
        <td>${esc(c.actual)}</td>
        <td>${esc(c.expected)}</td>
      </tr>`;
    })
    .join("");

  const shots = (data.images || [])
    .map((img) => {
      const v = img.mtimeMs ? `?v=${Math.round(img.mtimeMs)}` : "";
      const src = `${esc(img.file)}${v}`;
      const caption = shotCaption(img.file);
      const vp = img.viewport || detectViewportFromName(img.file) || "other";
      return `<figure class="shot-card" data-shot-viewport="${esc(vp)}">
        <button type="button" class="shot-card__btn" data-lightbox-src="${src}" data-lightbox-title="${esc(caption)}" data-lightbox-group="folder-shots">
          <img src="${src}" alt="${esc(caption)}" loading="lazy" decoding="async">
        </button>
        <figcaption><span class="shot-card__vp">${esc(viewportDisplayLabel(vp))}</span> ${esc(caption)}<br><code>${esc(img.file)}</code></figcaption>
      </figure>`;
    })
    .join("");

  const viewportGroups = groupImagesByViewport(data.images || []);
  const viewportOrder = ["1280", "768", "390", "other"];
  const viewportSections = viewportOrder
    .filter((vp) => viewportGroups[vp]?.length)
    .map((vp) => {
      const cards = viewportGroups[vp]
        .map((img) => {
          const v = img.mtimeMs ? `?v=${Math.round(img.mtimeMs)}` : "";
          const src = `${esc(img.file)}${v}`;
          const caption = shotCaption(img.file);
          return `<figure class="shot-card" data-shot-viewport="${esc(vp)}">
            <button type="button" class="shot-card__btn" data-lightbox-src="${src}" data-lightbox-title="${esc(caption)}" data-lightbox-group="vp-${esc(vp)}">
              <img src="${src}" alt="${esc(caption)}" loading="lazy" decoding="async">
            </button>
            <figcaption>${esc(caption)}<br><code>${esc(img.file)}</code></figcaption>
          </figure>`;
        })
        .join("");
      return `<section class="viewport-section" data-viewport-section="${esc(vp)}" id="viewport-${esc(vp)}">
        <h3 class="viewport-section__title">${esc(viewportDisplayLabel(vp))} <span class="viewport-section__count">${viewportGroups[vp].length}枚</span></h3>
        <div class="shot-grid">${cards}</div>
      </section>`;
    })
    .join("");

  const targetPage = report.targetPage || report.topUrl || "";
  const targetPages = Array.isArray(report.targetPages) ? report.targetPages : [];
  const listedViewports = Array.isArray(report.viewportsListed)
    ? report.viewportsListed
    : viewportOrder.filter((vp) => viewportGroups[vp]?.length);

  const primaryShots = (data.images || [])
    .filter((img) => /-390-default\.png$/i.test(img.file) || /-1280-default\.png$/i.test(img.file))
    .slice(0, 4)
    .map((img) => {
      const v = img.mtimeMs ? `?v=${Math.round(img.mtimeMs)}` : "";
      return `<li><a href="${esc(img.file)}">${esc(img.file)}</a></li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | TASFUL 検証レビュー</title>
  <style>
    :root { --bg:#f8fafc; --card:#fff; --border:#e2e8f0; --text:#0f172a; --muted:#64748b; --pass:#15803d; --fail:#b91c1c; }
    body { margin:0; font-family:"Noto Sans JP",system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.55; }
    .page { max-width:1100px; margin:0 auto; padding:20px 16px 48px; }
    .back { font-size:.875rem; margin-bottom:12px; }
    .back a { color:#1d4ed8; text-decoration:none; font-weight:700; }
    .hero { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:18px; }
    .hero h1 { margin:0 0 8px; font-size:1.35rem; }
    .hero__meta { margin:0; color:var(--muted); font-size:.875rem; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.75rem; font-weight:800; }
    .badge--pass { background:#dcfce7; color:var(--pass); }
    .badge--fail { background:#fee2e2; color:var(--fail); }
    .badge--na { background:#f1f5f9; color:var(--muted); }
    .section { margin:24px 0; }
    .section h2 { margin:0 0 12px; font-size:1.05rem; border-bottom:2px solid #d4af37; padding-bottom:6px; }
    table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; font-size:.8125rem; }
    th, td { border-bottom:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
    th { background:#f8fafc; font-size:.75rem; color:var(--muted); }
    tr.row--fail td:first-child { color:var(--fail); font-weight:800; }
    tr.row--pass td:first-child { color:var(--pass); font-weight:800; }
    .shot-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
    .viewport-filter { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 16px; }
    .viewport-filter__btn { padding:6px 12px; border-radius:999px; border:1px solid #e2e8f0; background:#f8fafc; font-size:.75rem; font-weight:800; cursor:pointer; font-family:inherit; }
    .viewport-filter__btn.is-active { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
    .viewport-section { margin-bottom:20px; }
    .viewport-section__title { margin:0 0 10px; font-size:.9375rem; font-weight:800; }
    .viewport-section__count { font-size:.75rem; font-weight:700; color:#64748b; }
    .shot-card__vp { display:inline-block; padding:1px 6px; border-radius:4px; background:#eff6ff; color:#1d4ed8; font-size:.625rem; font-weight:800; margin-right:4px; }
    ${SCREENSHOT_BACK_NAV_CSS}
    .shot-card { margin:0; background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
    .shot-card__btn { display:block; width:100%; padding:0; border:0; background:#0f172a; cursor:zoom-in; }
    .shot-card img { width:100%; height:auto; display:block; }
    .shot-card figcaption { padding:8px 10px; font-size:.75rem; color:var(--muted); }
    .links { margin:0; padding-left:1.2rem; }
    ${SCREENSHOT_IMAGE_VIEWER_CSS}
  </style>
</head>
<body>
  <div class="page">
    ${renderScreenshotBackNav({ href: "../index.html#run-registry", label: "← 検証一覧へ戻る" })}
    <header class="hero">
      <h1>${esc(title)}</h1>
      <p class="hero__meta">
        総合 ${statusBadge(overall)}
        · FAIL <strong>${failCount}</strong>
        · PASS <strong>${passCount}</strong>
        · 生成 ${esc(String(report.generatedAt || ""))}
      </p>
      <p class="hero__meta">
        フォルダ <code>${esc(data.folderId)}</code>
        ${targetPage ? ` · 対象 <code>${esc(targetPage)}</code>` : ""}
        ${listedViewports.length ? ` · viewport ${listedViewports.map((v) => esc(viewportDisplayLabel(String(v).replace(/px/i, "")))).join(" / ")}` : ""}
      </p>
      ${targetPages.length ? `<p class="hero__meta">関連ページ: ${targetPages.map((p) => `<code>${esc(p)}</code>`).join(" · ")}</p>` : ""}
      <p class="hero__meta"><a href="review-report.md">review-report.md</a> · <a href="report.json">report.json</a></p>
      ${primaryShots ? `<ul class="links">${primaryShots}</ul>` : ""}
    </header>

    <section class="section">
      <h2>チェック結果</h2>
      ${
        caseRows
          ? `<table>
        <thead><tr><th>判定</th><th>ID</th><th>項目</th><th>実際</th><th>期待</th></tr></thead>
        <tbody>${caseRows}</tbody>
      </table>`
          : `<p>ケース一覧は review-report.md を参照してください。</p>`
      }
    </section>

    <section class="section">
      <h2>スクリーンショット</h2>
      <nav class="viewport-filter" aria-label="viewport 絞り込み">
        <button type="button" class="viewport-filter__btn is-active" data-viewport-filter="all">すべて</button>
        ${viewportOrder.filter((vp) => viewportGroups[vp]?.length).map((vp) => `<button type="button" class="viewport-filter__btn" data-viewport-filter="${esc(vp)}">${esc(viewportDisplayLabel(vp))}</button>`).join("")}
      </nav>
      ${viewportSections || `<div class="shot-grid">${shots || "<p>（なし）</p>"}</div>`}
    </section>
  </div>
  ${SCREENSHOT_IMAGE_VIEWER_HTML}
  <script>
  ${SCREENSHOT_IMAGE_VIEWER_SCRIPT}
  </script>
  <script>
    (function(){
      const btns = document.querySelectorAll("[data-viewport-filter]");
      const sections = document.querySelectorAll("[data-viewport-section]");
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const vp = btn.getAttribute("data-viewport-filter");
          btns.forEach((b) => b.classList.toggle("is-active", b === btn));
          sections.forEach((sec) => {
            sec.hidden = vp !== "all" && sec.getAttribute("data-viewport-section") !== vp;
          });
        });
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * @param {string} folderPath
 */
async function folderHasImages(folderPath) {
  try {
    const files = await readdir(folderPath);
    return files.some((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @param {{ refreshAll?: boolean }} [opts]
 */
export async function ensureScreenshotFolderIndexes(root, opts = {}) {
  const screenshotsRoot = join(root, "screenshots");
  let entries = [];
  try {
    entries = await readdir(screenshotsRoot, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    if (!ent.isDirectory() || !shouldIncludeScreenshotFolder(ent.name)) continue;
    const folderPath = join(screenshotsRoot, ent.name);
    const hasImages = await folderHasImages(folderPath);
    let hasReport = false;
    try {
      await access(join(folderPath, "report.json"));
      hasReport = true;
    } catch {
      try {
        await access(join(folderPath, "review-report.json"));
        hasReport = true;
      } catch {
        /* none */
      }
    }
    if (!hasImages && !hasReport) continue;

    if (!opts.refreshAll) {
      try {
        await access(join(folderPath, "index.html"));
        continue;
      } catch {
        /* generate */
      }
    }

    try {
      await writeReviewIndexArtifacts(root, ent.name, { skipRootIndex: true });
    } catch (err) {
      console.warn(`[review-index] skip ${ent.name}:`, err?.message || err);
    }
  }
}

/** @deprecated use ensureScreenshotFolderIndexes */
export async function ensureAutomatedReviewFolderIndexes(root) {
  return ensureScreenshotFolderIndexes(root);
}

/**
 * @param {string} root
 * @param {string} folderId
 * @param {{ title?: string, report?: Record<string, unknown>, primaryFolder?: string, skipRootIndex?: boolean }} [opts]
 */
export async function writeReviewIndexArtifacts(root, folderId, opts = {}) {
  const folderPath = join(root, "screenshots", folderId);
  const title = resolveFolderTitle(folderId, opts.title);

  let raw = opts.report || null;
  if (!raw) {
    try {
      raw = JSON.parse(await readFile(join(folderPath, "review-report.json"), "utf8"));
    } catch {
      try {
        raw = JSON.parse(await readFile(join(folderPath, "report.json"), "utf8"));
      } catch {
        raw = null;
      }
    }
  }

  const images = await listFolderImages(folderPath, folderId);
  let normalized = normalizeReviewReport(raw, { folderId, title });
  if (!normalized) {
    if (!images.length) {
      throw new Error(`[review-index] report not found for ${folderId}`);
    }
    const viewports = [...new Set(images.map((img) => img.viewport).filter(Boolean))];
    normalized = normalizeReviewReport(
      {
        overall: "PASS",
        title,
        viewportsListed: viewports,
        screenshotCatalog: images.map((img) => ({
          file: img.file,
          viewport: img.viewport,
          label: img.file,
        })),
      },
      { folderId, title, generatedAt: new Date().toISOString() }
    );
  }

  await writeFile(join(folderPath, "report.json"), JSON.stringify(normalized, null, 2), "utf8");
  const indexHtml = renderReviewFolderIndex({ folderId, title, report: normalized, images });
  await writeFile(join(folderPath, "index.html"), indexHtml, "utf8");

  let rootIndex = null;
  if (opts.skipRootIndex !== true) {
    const { writeScreenshotsIndex } = await import("./screenshots-index.mjs");
    const result = await writeScreenshotsIndex(root, {
      primaryFolder: opts.primaryFolder ?? folderId,
    });
    rootIndex = result.outPath;
    try {
      const { reviewIndexUrl } = await import("./finalize-verification.mjs");
      console.log(`[screenshots] index updated: ${reviewIndexUrl()}`);
      console.log(`[screenshots] folder index: ${reviewIndexUrl(`/screenshots/${folderId}/index.html`)}`);
    } catch {
      /* optional log */
    }
  }

  return {
    folderPath,
    report: normalized,
    indexPath: join(folderPath, "index.html"),
    rootIndexPath: rootIndex,
  };
}

/**
 * @param {string} screenshotsRoot
 * @param {string} folderId
 */
export async function findFolderReportMeta(screenshotsRoot, folderId) {
  const folderPath = join(screenshotsRoot, folderId);
  for (const name of ["report.json", "review-report.json"]) {
    const reportPath = join(folderPath, name);
    try {
      await access(reportPath);
      const st = await stat(reportPath);
      return { reportPath, reportName: name, mtimeMs: st.mtimeMs };
    } catch {
      /* try next */
    }
  }
  return null;
}
