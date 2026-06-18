import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { isDebugFolder, PRIMARY_FOLDER, shouldIncludeScreenshotFolder } from "./screenshot-ops.mjs";
import {
  ensureScreenshotFolderIndexes,
  findFolderReportMeta,
  normalizeReviewReport,
  REVIEW_FOLDER_TITLES,
} from "./review-index-artifacts.mjs";
import {
  SCREENSHOT_IMAGE_VIEWER_CSS,
  SCREENSHOT_IMAGE_VIEWER_HTML,
  SCREENSHOT_IMAGE_VIEWER_SCRIPT,
} from "./screenshot-image-viewer.mjs";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/** 既知フォルダの表示名 */
const FOLDER_TITLES = {
  ...REVIEW_FOLDER_TITLES,
  "shop-store-ux-final": "店舗販売UX最終検証",
  "shop-store-shipping-fields": "配送・発送情報",
  "shop-store-notify-compact": "TALK通知（コンパクト）",
  "shop-store-final-review": "店舗販売 最終目視レビュー",
  "talk-notification-final-review": "TALK通知センター 最終UX",
  "builder-final-review": "Builder通知・取引チャット 最終UX",
  "connect-final-review": "Connect 最終UX",
  "anpi-final-review": "安否フロー 最終UX",
  "shop-products-hscroll-fix": "商品一覧 横スクロール修正",
  "dashboard-sidebar-mega": "ダッシュボード サイドバーメガメニュー",
  "dashboard-mobile-quick-access": "ダッシュボード スマホ クイックアクセス",
  "dashboard-mobile-quick-access-v2": "ダッシュボード スマホ クイックアクセス v2",
  "auth-login-unified": "ログイン / 会員登録 デザイン統一",
  "market-top-viewports": "市場TOP viewport 検証",
};

/** 上部「最新実行」に載せる件数 */
const RECENT_REVIEW_LIMIT = 24;

const VIEWPORT_FILTER_CHIPS = [
  { id: "all", label: "すべて" },
  { id: "390", label: "390px" },
  { id: "768", label: "768px" },
  { id: "1280", label: "1280px" },
];

/** 上部フィルターチップ（人間向けラベル → フォルダ ID） */
const REVIEW_FILTER_CHIPS = [
  { id: "talk-notification-final-review", label: "TALK" },
  { id: "builder-final-review", label: "Builder" },
  { id: "connect-final-review", label: "Connect" },
  { id: "anpi-final-review", label: "安否" },
];

const RECENT_REVIEW_THUMB_FILES = {
  "connect-final-review": ["390-completion-payment-viewport.png"],
  "builder-final-review": ["390-board-thread-viewport.png"],
  "talk-notification-final-review": [
    "390-gemini-notify-list.png",
    "gemini-review/390-list-viewport.png",
    "390-notify-list-viewport.png",
  ],
  "anpi-final-review": ["390-gemini-anpi-notify-card.png"],
  "chat-list-ui-review": ["chat-list-390-default.png", "chat-list-1280-default.png"],
  "breadcrumb-trail-review": ["breadcrumb-390-favorites.png"],
  "market-user-flow-review": ["03-product-390.png"],
  "builder-user-flow-review": ["01-board-list-390.png", "02-project-detail-390.png"],
  "dashboard-quick-actions-color": ["dashboard-quick-1280.png", "dashboard-quick-390.png"],
  "dashboard-service-drawer": ["mega-menu-1280.png", "mega-menu-390.png"],
  "auth-login-unified": ["login-390.png", "login-1280.png"],
  "dashboard-mobile-quick-access-v2": ["quick-access-390.png", "dashboard-1280.png"],
  "market-top-viewports": ["shop-store-390.png", "shop-store-1280.png"],
};

const USER_FLOW_SHOT_LABELS = {
  "board-list": { label: "案件記事一覧", url: "public-board.html", stage: "flow" },
  "project-list": { label: "案件記事一覧", url: "public-board.html", stage: "flow" },
  "project-detail": { label: "案件記事詳細", url: "public-board-detail.html", stage: "detail" },
  "apply-notify": { label: "応募通知", url: "talk-home.html", stage: "notify" },
  "apply-detail": { label: "応募詳細", url: "builder/board-project-detail.html", stage: "detail" },
  product: { label: "商品詳細", url: "shop-market-product.html", stage: "detail" },
};
const STAGE_ORDER = ["detail", "checkout", "complete", "notify", "flow", "other"];
const STAGE_LABELS = {
  detail: "商品詳細",
  checkout: "注文確認",
  complete: "注文完了",
  notify: "TALK通知",
  flow: "導線監査",
  other: "その他",
};

const MODE_LABELS = { cart: "カート経由", buyNow: "今すぐ購入" };
const PRODUCT_LABELS = { demo: "demo-restaurant-0", p: "p-0" };

const REPORT_FAIL_FIELDS = [
  ["imageDisplay", "画像表示"],
  ["purchaseFlow", "購入フロー"],
  ["notificationFlow", "TALK通知"],
  ["flowAudit", "導線監査"],
  ["completeScreen", "完了画面"],
  ["productIdMaintained", "商品ID維持"],
  ["compactFlow", "通知コンパクト"],
  ["deliveryDisplay", "配送情報表示"],
];

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
  if (value === "MINOR") return `<span class="badge badge--minor">MINOR</span>`;
  if (value === "PENDING") return `<span class="badge badge--pending">PENDING</span>`;
  return `<span class="badge badge--na">—</span>`;
}

function viewportLabel(vp) {
  const v = String(vp || "").trim();
  if (v === "1280" || /pc.*1280/i.test(v)) return "1280px";
  if (v === "768" || /tablet.*768/i.test(v)) return "768px";
  if (v === "390" || /mobile.*390/i.test(v)) return "390px";
  if (v === "1440") return "1440px";
  return v || "—";
}

function detectViewport(name) {
  const n = String(name || "").toLowerCase();
  if (/-390\b|mobile390|mobile-390|\b390px\b/.test(n)) return "390";
  if (/-768\b|tablet768|768px|\b768\b/.test(n)) return "768";
  if (/-1280\b|pc1280|pc-1280|\b1280px\b/.test(n)) return "1280";
  if (/\b390\b/.test(n) && !/\b1280\b/.test(n)) return "390";
  if (/\b768\b/.test(n)) return "768";
  if (/\b1280\b/.test(n)) return "1280";
  if (/\b1440\b/.test(n)) return "1440";
  return "";
}

function folderTitle(id) {
  return FOLDER_TITLES[id] || id;
}

function shouldIncludeFolder(id) {
  return shouldIncludeScreenshotFolder(id);
}

function isRecentReviewCandidate(bundle) {
  if (!bundle) return false;
  return Boolean(bundle.report) || (bundle.images?.length ?? 0) > 0;
}

function inferTargetPage(bundle) {
  const report = bundle?.report || {};
  if (report.targetPage) return String(report.targetPage);
  if (report.topUrl) {
    try {
      return new URL(String(report.topUrl)).pathname.replace(/^\//, "");
    } catch {
      return String(report.topUrl);
    }
  }
  const catalog = report.screenshotCatalog?.[0];
  if (catalog?.url) return String(catalog.url);
  const hint = bundle?.images?.find((i) => i.urlHint)?.urlHint;
  if (hint) return hint;
  return "—";
}

function collectViewportsForBundle(bundle) {
  const set = new Set();
  if (Array.isArray(bundle?.report?.viewportsListed)) {
    for (const v of bundle.report.viewportsListed) {
      const n = String(v).replace(/px/i, "");
      if (n) set.add(n);
    }
  }
  for (const img of bundle?.images || []) {
    const vp = img.viewport || detectViewport(img.file);
    if (vp) set.add(vp);
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

function detectStage(name) {
  const n = String(name || "").toLowerCase();
  if (/notify|bench-summary|talk/.test(n)) return "notify";
  if (/review-gauge|review-section/.test(n)) return "detail";
  if (/complete/.test(n)) return "complete";
  if (/checkout/.test(n)) return "checkout";
  if (/product|detail/.test(n)) return "detail";
  if (/vendor|shop-detail|products/.test(n)) return "other";
  if (/^flow-/.test(n)) return "flow";
  return "other";
}

function parseCaseFile(name) {
  const stem = name.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  const fullPage = /^(\d+|1280|1440|390)-(.+)-full$/i.exec(stem);
  if (fullPage) {
    const vp = fullPage[1] === "1280" || fullPage[1] === "390" || fullPage[1] === "1440" ? fullPage[1] : detectViewport(stem);
    const slug = fullPage[2];
    const stage = detectStage(slug);
    return {
      caseKey: stem,
      caseLabel: STAGE_LABELS[stage] || slug,
      viewport: vp,
      stage,
      step: "00",
      urlHint: "",
    };
  }

  const flow = /^flow-(\d+)-(.+)-(1280|390)$/i.exec(stem);
  if (flow) {
    return {
      caseKey: `flow-${flow[1]}-${flow[2]}`,
      caseLabel: `導線 ${flow[1]} — ${flow[2]}`,
      viewport: flow[3],
      stage: "flow",
      step: flow[1],
      urlHint: "",
    };
  }

  const main = /^(demo|p)-(cart|buyNow)-(1280|390)-(\d+)-(.+)$/i.exec(stem);
  if (main) {
    const stage = /notify/i.test(main[5]) ? "notify" : detectStage(main[5]);
    const productId = PRODUCT_LABELS[main[1]] || main[1];
    return {
      caseKey: `${main[1]}-${main[2]}-${main[5]}`,
      caseLabel: `${productId} / ${MODE_LABELS[main[2]] || main[2]} / ${STAGE_LABELS[stage] || main[5]}`,
      viewport: main[3],
      stage,
      step: main[4],
      urlHint: "",
    };
  }

  const gauge = /^(1280|390|1440)-08-review-gauge-(viewport|section)$/i.exec(stem);
  if (gauge) {
    return {
      caseKey: `08-review-gauge-${gauge[2]}`,
      caseLabel: gauge[2] === "section" ? "口コミ評価ゲージ" : "口コミ評価ゲージ（ビューポート）",
      viewport: gauge[1],
      stage: "detail",
      step: "08",
      urlHint: "",
    };
  }

  const numberedFlow = /^(\d{2})-(.+)-(390|1280)$/i.exec(stem);
  if (numberedFlow) {
    const slug = numberedFlow[2];
    const meta = USER_FLOW_SHOT_LABELS[slug];
    if (meta) {
      return {
        caseKey: `${numberedFlow[1]}-${slug}`,
        caseLabel: meta.label,
        viewport: numberedFlow[3],
        stage: meta.stage,
        step: numberedFlow[1],
        urlHint: meta.url,
      };
    }
  }

  return {
    caseKey: stem,
    caseLabel: stem,
    viewport: detectViewport(stem),
    stage: detectStage(stem),
    step: "99",
    urlHint: "",
  };
}

/**
 * @param {string} screenshotsRoot
 */
async function discoverVerifyFolders(screenshotsRoot) {
  let entries = [];
  try {
    entries = await readdir(screenshotsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const folders = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || !shouldIncludeFolder(ent.name)) continue;
    const folderPath = join(screenshotsRoot, ent.name);
    const meta = await findFolderReportMeta(screenshotsRoot, ent.name);
    let hasImages = false;
    try {
      const files = await readdir(folderPath);
      hasImages = files.some((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
    } catch {
      /* ignore */
    }
    if (!meta && !hasImages) continue;
    folders.push({
      id: ent.name,
      title: folderTitle(ent.name),
      mtimeMs: meta?.mtimeMs || (await stat(folderPath)).mtimeMs,
      reportName: meta?.reportName || null,
    });
  }

  return folders.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * @param {string} screenshotsRoot
 * @param {string} folderId
 */
async function loadFolderBundle(screenshotsRoot, folderId) {
  const folderPath = join(screenshotsRoot, folderId);
  let entries = [];
  try {
    entries = await readdir(folderPath);
  } catch {
    return null;
  }

  let report = null;
  try {
    report = JSON.parse(await readFile(join(folderPath, "report.json"), "utf8"));
  } catch {
    try {
      const raw = JSON.parse(await readFile(join(folderPath, "review-report.json"), "utf8"));
      report = normalizeReviewReport(raw, { folderId, title: folderTitle(folderId) });
    } catch {
      /* no report */
    }
  }

  const images = [];
  const pushImage = async (name, relPrefix = "") => {
    if (!IMAGE_EXT.has(extname(name).toLowerCase())) return;
    const file = relPrefix ? `${relPrefix}/${name}` : name;
    const st = await stat(join(folderPath, file));
    images.push({
      file,
      relPath: `${folderId}/${file}`,
      mtimeMs: st.mtimeMs,
      ...parseCaseFile(name),
    });
  };

  for (const name of entries) {
    await pushImage(name);
  }

  const geminiDir = join(folderPath, "gemini-review");
  try {
    const geminiEntries = await readdir(geminiDir);
    for (const name of geminiEntries) {
      await pushImage(name, "gemini-review");
    }
  } catch {
    /* no gemini-review */
  }

  images.sort((a, b) => a.file.localeCompare(b.file, "en"));
  return { id: folderId, title: folderTitle(folderId), folderPath, report, images };
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>} bundle
 * @param {{ pageName?: string, viewport?: string, stepId?: string, file?: string }} hint
 */
function pickScreenshot(bundle, hint = {}) {
  if (hint.file) {
    const direct = bundle.images.find((i) => i.file === hint.file);
    if (direct) return direct.relPath;
  }
  const vp = String(hint.viewport || "").replace(/pc/i, "");
  const stepId = String(hint.stepId || "").toLowerCase();
  const pageName = String(hint.pageName || "").toLowerCase();

  const scored = bundle.images.map((img) => {
    let score = 0;
    if (vp && img.viewport === vp) score += 10;
    if (stepId && img.file.toLowerCase().includes(stepId)) score += 8;
    if (pageName && img.file.toLowerCase().includes(pageName.replace(/\s+/g, ""))) score += 4;
    if (/full\.png$/i.test(img.file)) score += 2;
    return { img, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].img.relPath : bundle.images[0]?.relPath || "";
}

/** @param {Awaited<ReturnType<typeof loadFolderBundle>>[]} bundles */
function buildImageMtimeMap(bundles) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const bundle of bundles) {
    for (const img of bundle?.images || []) {
      if (img.relPath) map.set(img.relPath, img.mtimeMs || 0);
    }
  }
  return map;
}

function withCacheBust(relPath, mtimeMs) {
  if (!relPath) return "";
  const v = mtimeMs ? `?v=${Math.round(mtimeMs)}` : "";
  return `${relPath}${v}`;
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>[]} bundles
 * @param {string} [onlyFolderId]
 */
function extractReviewItems(bundles, onlyFolderId = null) {
  /** @type {Array<Record<string, unknown>>} */
  const failItems = [];
  /** @type {Array<Record<string, unknown>>} */
  const minorItems = [];

  function pushItem(severity, base) {
    const item = { ...base, severity };
    if (severity === "FAIL") failItems.push(item);
    else if (severity === "MINOR") minorItems.push(item);
  }

  for (const bundle of bundles) {
    if (!bundle?.report) continue;
    if (onlyFolderId && bundle.id !== onlyFolderId) continue;
    const report = bundle.report;

    for (const [key, label] of REPORT_FAIL_FIELDS) {
      if (report[key] === "FAIL") {
        pushItem("FAIL", {
          folderId: bundle.id,
          folderTitle: bundle.title,
          pageName: label,
          viewport: "",
          viewportLabel: "全viewport",
          cause: `${label}が FAIL`,
          screenshot: pickScreenshot(bundle, {}),
          fileName: "",
        });
      }
    }

    if (report.overall === "FAIL" && countReportFails(report) > 0) {
      const folderPageFails = (report.pages || []).filter((p) => p.verdict === "FAIL");
      const folderCaseFails = (report.cases || []).filter((c) => c.pass === false || c.pass === "FAIL");
      if (!folderPageFails.length && !folderCaseFails.length) {
        pushItem("FAIL", {
          folderId: bundle.id,
          folderTitle: bundle.title,
          pageName: bundle.title,
          viewport: "",
          viewportLabel: "総合",
          cause: report.uiConcerns?.[0] || "総合判定 FAIL",
          screenshot: pickScreenshot(bundle, {}),
          fileName: "",
        });
      }
    }

    for (const page of report.pages || []) {
      const severity = page.verdict === "FAIL" ? "FAIL" : page.verdict === "MINOR" ? "MINOR" : null;
      if (!severity) continue;
      const cause = [...(page.issues || []), ...(page.minors || [])].join(" · ") || `${page.stepName} ${severity}`;
      pushItem(severity, {
        folderId: bundle.id,
        folderTitle: bundle.title,
        pageName: page.stepName || page.stepId || "ページ",
        viewport: page.viewport || "",
        viewportLabel: viewportLabel(page.viewport),
        cause,
        screenshot: page.file ? `${bundle.id}/${page.file}` : pickScreenshot(bundle, page),
        fileName: page.file || "",
        stepId: page.stepId || "",
      });
    }

    for (const vp of report.viewports || []) {
      if ((report.pages || []).length) continue;
      const severity = vp.verdict === "FAIL" ? "FAIL" : vp.verdict === "MINOR" ? "MINOR" : null;
      if (!severity) continue;
      const cause = [...(vp.issues || []), ...(vp.minors || [])].join(" · ") || `TALK通知一覧 ${severity}`;
      const fileName = vp.shots?.[0] || "";
      pushItem(severity, {
        folderId: bundle.id,
        folderTitle: bundle.title,
        pageName: "TALK通知一覧",
        viewport: vp.label || "",
        viewportLabel: viewportLabel(vp.label),
        cause,
        screenshot: fileName ? `${bundle.id}/${fileName}` : pickScreenshot(bundle, { viewport: vp.label }),
        fileName,
        stepId: `notify-list-${vp.label || ""}`,
      });
    }

    for (const c of report.cases || []) {
      const isFail = c.pass === false || c.pass === "FAIL";
      const isMinor = c.pass === "MINOR";
      if (!isFail && !isMinor) continue;
      const cause =
        c.issues?.join?.(" · ") ||
        (isFail ? `ケース ${c.caseId || c.viewport} FAIL` : `ケース ${c.caseId || c.viewport} MINOR`);
      pushItem(isFail ? "FAIL" : "MINOR", {
        folderId: bundle.id,
        folderTitle: bundle.title,
        pageName: c.caseId || c.productId || "検証ケース",
        viewport: c.viewport || "",
        viewportLabel: viewportLabel(c.viewport),
        cause,
        screenshot: pickScreenshot(bundle, c),
        fileName: "",
        stepId: c.caseId || "",
      });
    }
  }

  let idx = 0;
  for (const item of failItems) {
    item.id = `fail-${idx}`;
    idx += 1;
  }
  idx = 0;
  for (const item of minorItems) {
    item.id = `minor-${idx}`;
    idx += 1;
  }

  return { failItems, minorItems };
}

function buildAiSummary(data) {
  const lines = [];
  const primaryTitle = data.primaryTitle || data.primaryFolder || "最新";
  lines.push(`主判定: ${primaryTitle}`);
  lines.push(`総合判定: ${data.overall}`);
  lines.push(`FAIL ${data.failItems.length}件 / MINOR ${data.minorItems.length}件`);
  if (data.pastReports?.length) {
    lines.push(`（過去レポート ${data.pastReports.length}件は総合判定に未反映）`);
  }
  if (data.failItems.length) {
    lines.push("");
    lines.push("【要対応 FAIL】");
    for (const f of data.failItems) {
      lines.push(`- ${f.pageName} (${f.viewportLabel}): ${f.cause}`);
    }
  }
  if (data.minorItems.length) {
    lines.push("");
    lines.push("【軽微 MINOR】");
    for (const m of data.minorItems.slice(0, 5)) {
      lines.push(`- ${m.pageName} (${m.viewportLabel}): ${m.cause}`);
    }
    if (data.minorItems.length > 5) lines.push(`- …他 ${data.minorItems.length - 5}件`);
  }
  if (!data.failItems.length && !data.minorItems.length) {
    lines.push("問題は検出されませんでした。");
  }
  const notes = data.report?.finalNotes;
  if (notes) {
    lines.push("");
    lines.push("【最終判定メモ】");
    if (notes.purchaseFlow) lines.push(`- 購入フロー: ${notes.purchaseFlow}`);
    if (notes.geminiP1) lines.push(`- Gemini P1: ${notes.geminiP1}`);
    if (notes.notifyUx) lines.push(`- 通知UX: ${notes.notifyUx}`);
  if (notes.builderChat) lines.push(`- 取引チャット: ${notes.builderChat}`);
    if (notes.remaining) lines.push(`- 残件: ${notes.remaining}`);
    lines.push(`- FAIL: ${notes.failCount ?? 0}件`);
  }
  const ux = data.report?.uxReview;
  if (ux?.geminiChecklist?.length) {
    lines.push("");
    lines.push("【Gemini UX確認】");
    for (const row of ux.geminiChecklist) {
      lines.push(`- ${row.ok ? "✓" : "△"} ${row.item}${row.note ? ` — ${row.note}` : ""}`);
    }
  }
  const gr = data.report?.geminiReview;
  if (gr) {
    lines.push("");
    lines.push("【Geminiレビュー（代表）】");
    lines.push(`総合判定: ${gr.overall} · 本番投入: ${gr.productionReady || "—"}`);
    if (gr.goodPoints?.length) {
      lines.push("良い点:");
      for (const g of gr.goodPoints.slice(0, 3)) lines.push(`- ${g}`);
    }
    const p1 = (gr.concerns?.p1 || []).filter((x) => x && x !== "（なし）");
    if (p1.length) {
      lines.push("P1:");
      for (const c of p1.slice(0, 3)) lines.push(`- ${c}`);
    }
  }
  if (data.pastReports?.length) {
    const geminiPast = data.pastReports.filter((p) => p.geminiReview);
    if (geminiPast.length) {
      lines.push("");
      lines.push("【Geminiレビュー（他フォルダ）】");
      for (const p of geminiPast.slice(0, 5)) {
        const g = p.geminiReview;
        lines.push(`- ${p.title}: ${g.overall} · ${g.productionReady || "—"}`);
      }
    }
  }
  return lines.join("\n");
}

function countReportFails(report) {
  if (!report) return 0;
  if (typeof report.summary?.failCount === "number") return report.summary.failCount;
  const pageFails = (report.pages || []).filter((p) => p.verdict === "FAIL").length;
  if (pageFails) return pageFails;
  const vpFails = (report.viewports || []).filter((v) => v.verdict === "FAIL").length;
  const caseFails = (report.cases || []).filter((c) => c.pass === false || c.pass === "FAIL").length;
  const fieldFails = REPORT_FAIL_FIELDS.filter(([key]) => report[key] === "FAIL").length;
  const navFails = (report.navigationChecks || []).filter((n) => n.verdict === "FAIL").length;
  const bulkFail = report.bulkTest?.verdict === "FAIL" ? 1 : 0;
  return vpFails + caseFails + fieldFails + navFails + bulkFail;
}

function countReportMinors(report) {
  if (!report) return 0;
  if (typeof report.summary?.minorCount === "number") return report.summary.minorCount;
  const pageMinors = (report.pages || []).filter((p) => p.verdict === "MINOR").length;
  if (pageMinors) return pageMinors;
  return (report.viewports || []).filter((v) => v.verdict === "MINOR").length;
}

function resolveOverallFromPrimary(report, failItems, minorItems) {
  if (failItems.length) return "FAIL";
  if (minorItems.length) return "MINOR";
  const fromSummary = report?.summary?.overall;
  if (fromSummary === "FAIL" || fromSummary === "MINOR" || fromSummary === "PASS") return fromSummary;
  const fromReport = report?.overall;
  if (fromReport === "FAIL" || fromReport === "MINOR" || fromReport === "PASS") return fromReport;
  if (report?.allPass === false) return "FAIL";
  return "PASS";
}

function resolveOverallForBundle(report) {
  const fails = countReportFails(report);
  const minors = countReportMinors(report);
  if (fails > 0) return "FAIL";
  if (minors > 0) return "MINOR";
  const fromGemini = report?.geminiReview?.overall;
  if (fromGemini === "FAIL" || fromGemini === "MINOR" || fromGemini === "PASS") return fromGemini;
  const fromSummary = report?.summary?.overall || report?.overall;
  if (fromSummary === "FAIL" || fromSummary === "MINOR" || fromSummary === "PASS") return fromSummary;
  return "PASS";
}

function formatUpdatedAt(isoOrMs) {
  if (isoOrMs == null || isoOrMs === "") return "—";
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  if (!Number.isFinite(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>} bundle
 * @param {Awaited<ReturnType<typeof discoverVerifyFolders>>} folderMeta
 */
function resolveBundleUpdatedMs(bundle, folderMeta) {
  const fromReport = bundle.report?.generatedAt ? new Date(bundle.report.generatedAt).getTime() : 0;
  const fromImages = Math.max(0, ...(bundle.images || []).map((i) => i.mtimeMs || 0));
  if (fromReport || fromImages) return Math.max(fromReport, fromImages);
  const meta = folderMeta.find((f) => f.id === bundle.id);
  return meta?.mtimeMs || 0;
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>} bundle
 */
function resolveRecentReviewThumb(bundle) {
  const candidates = RECENT_REVIEW_THUMB_FILES[bundle.id];
  const list = Array.isArray(candidates) ? candidates : [];
  for (const file of list) {
    const img = bundle.images.find((i) => i.file === file);
    if (img) return { relPath: img.relPath, file: img.file, mtimeMs: img.mtimeMs || 0 };
  }
  const fallback =
    bundle.images.find((i) => i.viewport === "390" && /viewport\.png$/i.test(i.file)) ||
    bundle.images.find((i) => /390.*\.png$/i.test(i.file)) ||
    bundle.images[0];
  if (!fallback) return null;
  return { relPath: fallback.relPath, file: fallback.file, mtimeMs: fallback.mtimeMs || 0 };
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>[]} bundles
 * @param {Awaited<ReturnType<typeof discoverVerifyFolders>>} folderMeta
 * @param {{ primaryFolder?: string, limit?: number }} [opts]
 */
function buildRecentReviews(bundles, folderMeta, opts = {}) {
  const limit = opts.limit ?? RECENT_REVIEW_LIMIT;
  const primaryFolder = opts.primaryFolder || "";
  return bundles
    .filter((b) => b && isRecentReviewCandidate(b))
    .map((bundle) => {
      const report = bundle.report || {};
      const updatedMs = resolveBundleUpdatedMs(bundle, folderMeta);
      const thumb = resolveRecentReviewThumb(bundle);
      return {
        id: bundle.id,
        title: bundle.title,
        overall: resolveOverallForBundle(report),
        failCount: countReportFails(report),
        minorCount: countReportMinors(report),
        updatedAt: formatUpdatedAt(updatedMs),
        updatedMs,
        reportPath: `${bundle.id}/report.json`,
        indexPath: `${bundle.id}/index.html`,
        isPrimary: bundle.id === primaryFolder,
        thumbnail: thumb?.relPath || "",
        thumbnailFile: thumb?.file || "",
        thumbnailMtimeMs: thumb?.mtimeMs || 0,
        targetPage: inferTargetPage(bundle),
        viewports: collectViewportsForBundle(bundle),
        viewportsLabel: collectViewportsForBundle(bundle).map((v) => viewportLabel(v)).join(" / ") || "—",
      };
    })
    .sort((a, b) => b.updatedMs - a.updatedMs)
    .slice(0, limit);
}

/**
 * @param {Awaited<ReturnType<typeof loadFolderBundle>>[]} bundles
 * @param {Awaited<ReturnType<typeof discoverVerifyFolders>>} folderMeta
 */
function buildRunRegistry(bundles, folderMeta) {
  return bundles
    .filter((b) => b && isRecentReviewCandidate(b))
    .map((bundle) => {
      const updatedMs = resolveBundleUpdatedMs(bundle, folderMeta);
      const viewports = collectViewportsForBundle(bundle);
      return {
        id: bundle.id,
        title: bundle.title,
        targetPage: inferTargetPage(bundle),
        viewports,
        viewportsLabel: viewports.map((v) => viewportLabel(v)).join(" / ") || "—",
        overall: resolveOverallForBundle(bundle.report || {}),
        failCount: countReportFails(bundle.report),
        imageCount: bundle.images.length,
        updatedAt: formatUpdatedAt(updatedMs),
        updatedMs,
        indexPath: `${bundle.id}/index.html`,
      };
    })
    .sort((a, b) => b.updatedMs - a.updatedMs)
    .slice(0, RECENT_REVIEW_LIMIT);
}

function renderRunRegistrySection(data) {
  const rows = data.runRegistry || [];
  if (!rows.length) return "";
  return `<section class="run-registry" id="run-registry" aria-label="検証実行一覧">
    <h2 class="section-title section-title--recent">最新検証実行一覧（直近 ${rows.length} 件）</h2>
    <nav class="viewport-filter-nav" aria-label="viewport 絞り込み">
      ${VIEWPORT_FILTER_CHIPS.map(
        (chip, i) =>
          `<button type="button" class="viewport-filter-chip${i === 0 ? " viewport-filter-chip--active" : ""}" data-global-viewport-filter="${esc(chip.id)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(chip.label)}</button>`
      ).join("")}
    </nav>
    <div class="run-registry__table-wrap">
      <table class="run-registry__table">
        <thead>
          <tr>
            <th>実行日時</th>
            <th>フォルダ</th>
            <th>タイトル</th>
            <th>対象ページ</th>
            <th>viewport</th>
            <th>判定</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr class="run-registry__row" id="run-${esc(row.id)}" data-run-folder="${esc(row.id)}" data-run-viewports="${esc(row.viewports.join(","))}">
            <td><time datetime="${esc(new Date(row.updatedMs).toISOString())}">${esc(row.updatedAt)}</time></td>
            <td><code>${esc(row.id)}</code></td>
            <td>${esc(row.title)}</td>
            <td><code>${esc(row.targetPage)}</code></td>
            <td>${esc(row.viewportsLabel)}</td>
            <td>${statusBadge(row.overall)}</td>
            <td><a href="${esc(row.indexPath)}">開く</a> · ${row.imageCount}枚</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderRecentReviewItem(item, imageMtimeMap) {
  const thumbSrc = item.thumbnail
    ? withCacheBust(item.thumbnail, item.thumbnailMtimeMs || imageMtimeMap.get(item.thumbnail))
    : "";
  const primaryNote = item.isPrimary
    ? `<span class="recent-card__primary" title="主判定フォルダ">主判定</span>`
    : "";
  const thumbBlock = thumbSrc
    ? `<button type="button" class="recent-card__thumb" data-lightbox-src="${esc(thumbSrc)}" data-lightbox-title="${esc(item.title)}" data-lightbox-group="recent-reviews" aria-label="${esc(item.title)} の代表スクショを拡大">
        <img src="${esc(thumbSrc)}" alt="" loading="lazy" decoding="async" width="390" draggable="false">
      </button>`
    : `<div class="recent-card__thumb recent-card__thumb--empty" aria-hidden="true"><span>スクショなし</span></div>`;

  return `<li class="recent-card" data-review-folder="${esc(item.id)}" data-run-viewports="${esc((item.viewports || []).join(","))}">
      ${thumbBlock}
      <div class="recent-card__body">
        <div class="recent-card__head">
          <h3 class="recent-card__title">${esc(item.title)}${primaryNote}</h3>
          <p class="recent-card__verdict">${statusBadge(item.overall)}</p>
        </div>
        <p class="recent-card__meta"><code>${esc(item.id)}</code> · <code>${esc(item.targetPage || "—")}</code></p>
        <p class="recent-card__meta">${esc(item.viewportsLabel || "—")}</p>
        <dl class="recent-card__stats">
          <div><dt>FAIL</dt><dd>${item.failCount}</dd></div>
          <div><dt>MINOR</dt><dd>${item.minorCount}</dd></div>
        </dl>
        <time class="recent-card__date" datetime="${esc(new Date(item.updatedMs).toISOString())}">${esc(item.updatedAt)}</time>
        <a href="${esc(item.indexPath)}" class="recent-card__cta">レビューを見る</a>
        <nav class="recent-card__aux" aria-label="${esc(item.title)} 補助リンク">
          <a href="${esc(item.indexPath)}">レビュー詳細</a>
          <span class="recent-card__aux-sep" aria-hidden="true">·</span>
          <a href="${esc(item.reportPath)}" class="recent-card__aux-dev" title="開発者向け（JSON）">report.json</a>
        </nav>
      </div>
    </li>`;
}

/**
 * @param {Awaited<ReturnType<typeof buildScreenshotsIndexData>>} data
 */
function renderRecentReviewsSection(data) {
  const items = data.recentReviews || [];
  if (!items.length) return "";
  const imageMtimeMap = data.imageMtimeMap || new Map();
  return `<section class="recent-section" id="recent-reviews" aria-label="最新検証のプレビュー">
      <h2 class="section-title section-title--recent">スクショプレビュー（最新）</h2>
      <ul class="recent-grid">
        ${items.map((item) => renderRecentReviewItem(item, imageMtimeMap)).join("")}
      </ul>
    </section>`;
}

/**
 * @param {Awaited<ReturnType<typeof buildRecentReviews>>} recentReviews
 */
function renderReviewFilterNav(recentReviews) {
  const available = new Set((recentReviews || []).map((r) => r.id));
  const chips = REVIEW_FILTER_CHIPS.filter((c) => available.has(c.id));
  if (!chips.length) return "";
  const buttons = [
    `<button type="button" class="review-filter-chip review-filter-chip--active" data-review-filter="all" aria-pressed="true">すべて</button>`,
    ...chips.map(
      (c) =>
        `<button type="button" class="review-filter-chip" data-review-filter="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`
    ),
  ].join("");
  return `<nav class="review-filter-nav" aria-label="レビュー絞り込み">${buttons}</nav>`;
}

function buildPastReports(archiveBundles, folderMeta) {
  return archiveBundles.map((bundle) => {
    const meta = folderMeta.find((f) => f.id === bundle.id);
    const report = bundle.report || {};
    return {
      id: bundle.id,
      title: bundle.title,
      overall: report.summary?.overall || report.overall || "—",
      failCount: countReportFails(report),
      minorCount: countReportMinors(report),
      generatedAt: report.generatedAt || null,
      modifiedAt: meta?.mtimeMs ? new Date(meta.mtimeMs).toISOString() : null,
      reportPath: `${bundle.id}/report.json`,
      indexPath: `${bundle.id}/index.html`,
      geminiReview: report.geminiReview || null,
    };
  });
}

function buildCompareGroups(bundles) {
  const map = new Map();
  for (const bundle of bundles) {
    if (!bundle) continue;
    const casePass = new Map((bundle.report?.cases || []).map((c) => [c.caseId, c.pass]));
    for (const img of bundle.images) {
      const compareKey = `${bundle.id}::${img.stage}::${img.product || ""}::${img.mode || ""}::${img.step}::${img.caseKey}`;
      if (!map.has(compareKey)) {
        const caseId = `${img.product}-${img.mode}-${img.viewport}`.replace(/^-|-$/g, "");
        const pass = img.product && img.mode && img.viewport ? casePass.get(caseId) : null;
        map.set(compareKey, {
          stage: img.stage,
          caseKey: img.caseKey,
          caseLabel: img.caseLabel,
          urlHint: img.urlHint,
          folderId: bundle.id,
          pass: pass ?? null,
          byViewport: {},
        });
      }
      const row = map.get(compareKey);
      if (img.viewport) row.byViewport[img.viewport] = { file: img.file, relPath: img.relPath };
      else if (!row.byViewport.other) row.byViewport.other = { file: img.file, relPath: img.relPath };
    }
  }
  const groups = {};
  for (const row of map.values()) {
    const stage = row.stage || "other";
    if (!groups[stage]) groups[stage] = [];
    groups[stage].push(row);
  }
  for (const stage of Object.keys(groups)) {
    groups[stage].sort((a, b) => a.caseLabel.localeCompare(b.caseLabel, "ja"));
  }
  return groups;
}

function renderFailCard(item, imageMtimeMap) {
  const shotSrc = item.screenshot ? withCacheBust(item.screenshot, imageMtimeMap.get(item.screenshot)) : "";
  const shot = shotSrc
    ? `<button type="button" class="fail-card__shot" data-lightbox-src="${esc(shotSrc)}" data-lightbox-title="${esc(item.pageName)} ${esc(item.viewportLabel)}">
        <img src="${esc(shotSrc)}" alt="${esc(item.pageName)}" loading="lazy" decoding="async">
        <span class="fail-card__shot-hint">クリックで拡大</span>
      </button>`
    : `<p class="fail-card__no-shot">該当スクショなし</p>`;

  return `<article class="fail-card" id="${esc(item.id)}" data-fail-card data-severity="${esc(item.severity)}">
    <header class="fail-card__head">
      <p class="fail-card__severity">${statusBadge(item.severity)}</p>
      <h3 class="fail-card__title">${esc(item.pageName)}</h3>
      <p class="fail-card__vp">${esc(item.viewportLabel)}</p>
    </header>
    <dl class="fail-card__facts">
      <div><dt>原因</dt><dd>${esc(item.cause)}</dd></div>
      <div><dt>検証</dt><dd>${esc(item.folderTitle)}</dd></div>
      ${item.fileName ? `<div><dt>ファイル</dt><dd><code>${esc(item.fileName)}</code></dd></div>` : ""}
      ${item.screenshot ? `<div><dt>該当スクショ</dt><dd>クリックで拡大</dd></div>` : ""}
    </dl>
    <div class="fail-card__media">${shot}</div>
  </article>`;
}

function renderImageCell(vp, cell, caseLabel, imageMtimeMap) {
  if (!cell) {
    return `<div class="shot-col shot-col--${vp} shot-col--empty"><p class="shot-empty">なし</p></div>`;
  }
  const w = vp === "390" ? 390 : 1280;
  const shotSrc = withCacheBust(cell.relPath, imageMtimeMap.get(cell.relPath));
  return `<div class="shot-col shot-col--${vp}">
    <p class="shot-vp-label">${vp}px</p>
    <button type="button" class="shot-thumb" data-lightbox-src="${esc(shotSrc)}" data-lightbox-title="${esc(caseLabel)} (${vp}px)">
      <img src="${esc(shotSrc)}" alt="${esc(caseLabel)} ${vp}px" width="${w}" loading="lazy" decoding="async">
    </button>
    <p class="shot-file"><code>${esc(cell.file)}</code></p>
  </div>`;
}

function renderCompareRow(row, imageMtimeMap) {
  const passBadge = row.pass == null ? "" : statusBadge(row.pass);
  return `<article class="compare-row">
    <header class="compare-row__head">
      <h3 class="compare-row__title">${esc(row.caseLabel)} ${passBadge}</h3>
      <p class="compare-row__meta"><code>${esc(row.folderId)}</code>${row.urlHint ? ` · <code>${esc(row.urlHint)}</code>` : ""}</p>
    </header>
    <div class="compare-row__shots">
      ${renderImageCell("1280", row.byViewport["1280"], row.caseLabel, imageMtimeMap)}
      ${renderImageCell("390", row.byViewport["390"], row.caseLabel, imageMtimeMap)}
    </div>
  </article>`;
}

/**
 * @param {string} root
 * @param {{ primaryFolder?: string }} [opts]
 */
export async function buildScreenshotsIndexData(root, opts = {}) {
  const screenshotsRoot = join(root, "screenshots");
  const folderMeta = await discoverVerifyFolders(screenshotsRoot);
  const bundles = (await Promise.all(folderMeta.map((f) => loadFolderBundle(screenshotsRoot, f.id)))).filter(Boolean);

  const latest = folderMeta[0]?.id || "";
  const primary =
    opts.primaryFolder || process.env.SCREENSHOT_INDEX_PRIMARY || PRIMARY_FOLDER || latest;
  const primaryBundle = bundles.find((b) => b.id === primary) || bundles[0] || null;
  const archiveBundles = bundles.filter((b) => b.id !== primaryBundle?.id);

  const { failItems, minorItems } = extractReviewItems(
    primaryBundle ? [primaryBundle] : [],
    primaryBundle?.id
  );
  const compareGroups = buildCompareGroups(primaryBundle ? [primaryBundle] : []);
  const pastReports = buildPastReports(archiveBundles, folderMeta);
  const recentReviews = buildRecentReviews(bundles, folderMeta, {
    primaryFolder: primaryBundle?.id || primary,
  });
  const runRegistry = buildRunRegistry(bundles, folderMeta);

  const primaryReport = primaryBundle?.report || {};
  const overall = resolveOverallFromPrimary(primaryReport, failItems, minorItems);

  const data = {
    generatedAt: new Date().toISOString(),
    primaryFolder: primaryBundle?.id || primary,
    primaryTitle: primaryBundle?.title || folderTitle(primary),
    latestFolder: latest,
    overall,
    failItems,
    minorItems,
    pastReports,
    recentReviews,
    runRegistry,
    aiSummary: "",
    report: primaryReport,
    summary: {
      allPass: overall === "PASS",
      failCount: failItems.length,
      minorCount: minorItems.length,
      imageDisplay: primaryReport.imageDisplay,
      purchaseFlow: primaryReport.purchaseFlow,
      notificationFlow: primaryReport.notificationFlow,
      flowAudit: primaryReport.flowAudit,
      completeScreen: primaryReport.completeScreen,
      ok: primaryReport.ok ?? primaryReport.summary?.passCount,
      ng: primaryReport.ng ?? primaryReport.summary?.failCount,
    },
    folders: bundles.map((b) => ({
      id: b.id,
      title: b.title,
      imageCount: b.images.length,
      hasReport: Boolean(b.report),
      isPrimary: b.id === primaryBundle?.id,
      isLatest: b.id === latest,
    })),
    compareGroups,
    imageMtimeMap: buildImageMtimeMap(bundles),
  };
  data.aiSummary = buildAiSummary(data);
  return data;
}

/**
 * @param {Awaited<ReturnType<typeof buildScreenshotsIndexData>>} data
 */
export function renderScreenshotsIndexHtml(data) {
  const s = data.summary || {};
  const imageMtimeMap = data.imageMtimeMap || new Map();
  const failSection =
    data.failItems.length > 0
      ? `<section class="fail-section" id="fail-section" aria-label="FAIL一覧">
      <h2 class="section-title section-title--fail">FAIL — 要確認（${data.failItems.length}件）</h2>
      <div class="fail-grid">${data.failItems.map((item) => renderFailCard(item, imageMtimeMap)).join("")}</div>
    </section>`
      : `<section class="pass-banner" id="fail-section"><p>FAILは検出されませんでした ${statusBadge("PASS")}</p></section>`;

  const minorSection =
    data.minorItems.length > 0
      ? `<section class="minor-section" id="minor-section">
      <h2 class="section-title">MINOR — 軽微（${data.minorItems.length}件）</h2>
      <div class="fail-grid fail-grid--minor">${data.minorItems.map((item) => renderFailCard(item, imageMtimeMap)).join("")}</div>
    </section>`
      : "";

  const stageSections = STAGE_ORDER.filter((stage) => data.compareGroups[stage]?.length)
    .map((stage) => {
      const rows = data.compareGroups[stage].map((row) => renderCompareRow(row, imageMtimeMap)).join("");
      return `<section class="stage-section" id="stage-${stage}">
        <h2 class="section-title">${esc(STAGE_LABELS[stage] || stage)}</h2>
        <div class="stage-section__rows">${rows}</div>
      </section>`;
    })
    .join("");

  const folderLinks = renderReviewFilterNav(data.recentReviews);

  const pastReportsSection =
    data.pastReports?.length > 0
      ? `<section class="past-section" id="past-reports" aria-label="過去レポート">
      <h2 class="section-title">過去レポート（主判定に未反映）</h2>
      <ul class="past-list">
        ${data.pastReports
          .map(
            (p) =>
              `<li class="past-list__item">
            <a href="${esc(p.indexPath || p.reportPath)}" class="past-list__title">${esc(p.title)}</a>
            <span class="past-list__meta">${statusBadge(p.overall)} · FAIL ${p.failCount} · MINOR ${p.minorCount}</span>
            ${p.generatedAt ? `<span class="past-list__date">${esc(p.generatedAt)}</span>` : ""}
          </li>`
          )
          .join("")}
      </ul>
    </section>`
      : "";

  const recentReviewsSection = renderRecentReviewsSection(data);
  const runRegistrySection = renderRunRegistrySection(data);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TASFUL スクリーンショット検証ハブ</title>
  <style>
    :root { --bg:#f1f5f9; --card:#fff; --text:#0f172a; --muted:#64748b; --pass:#15803d; --minor:#b45309; --fail:#b91c1c; --border:#e2e8f0; --gold:#7a5e10; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; font-family:"Noto Sans JP",system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
    .page { max-width:1440px; margin:0 auto; padding:20px 16px 48px; }
    .hero { background:#fff; border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:16px; }
    .hero h1 { margin:0 0 8px; font-size:1.4rem; font-weight:900; }
    .hero__meta { margin:0; color:var(--muted); font-size:.8125rem; }
    .hero__url { margin:8px 0 0; font-size:.8125rem; font-weight:800; color:#1d4ed8; }
    .viewport-filter-nav { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 12px; }
    .viewport-filter-chip { padding:6px 14px; border-radius:999px; background:#f8fafc; border:1px solid var(--border); font-size:.8125rem; font-weight:800; color:var(--text); cursor:pointer; font-family:inherit; }
    .viewport-filter-chip--active { border-color:#3b82f6; background:#eff6ff; color:#1d4ed8; }
    .run-registry { margin-bottom:24px; }
    .run-registry__table-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:12px; background:#fff; }
    .run-registry__table { width:100%; border-collapse:collapse; font-size:.8125rem; }
    .run-registry__table th, .run-registry__table td { padding:10px 12px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; }
    .run-registry__table th { background:#f8fafc; font-size:.75rem; color:var(--muted); white-space:nowrap; }
    .run-registry__row.is-filtered-out { display:none; }
    .recent-card.is-filtered-out { display:none; }
    .recent-card__meta { margin:0; font-size:.6875rem; color:var(--muted); }
    .review-filter-nav { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .review-filter-chip { padding:6px 14px; border-radius:999px; background:#f8fafc; border:1px solid var(--border); font-size:.8125rem; font-weight:800; color:var(--text); cursor:pointer; font-family:inherit; transition:background .15s,border-color .15s,color .15s; }
    .review-filter-chip:hover { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
    .review-filter-chip--active { border-color:#3b82f6; background:#eff6ff; color:#1d4ed8; box-shadow:0 0 0 1px rgba(59,130,246,.25); }
    .review-filter-chip:focus-visible { outline:2px solid #3b82f6; outline-offset:2px; }
    .recent-card.is-filtered-out { display:none; }
    .past-section { margin:28px 0 20px; }
    .past-list { margin:0; padding:0; list-style:none; display:grid; gap:8px; }
    .past-list__item { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:10px; font-size:.8125rem; }
    .past-list__title { font-weight:800; color:var(--text); text-decoration:none; }
    .past-list__title:hover { text-decoration:underline; }
    .past-list__meta { color:var(--muted); font-weight:700; }
    .past-list__date { font-size:.6875rem; color:var(--muted); }
    .recent-section { margin:0 0 24px; }
    .section-title--recent { border-bottom-color:#3b82f6; }
    .recent-grid { margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; }
    .recent-card { display:flex; flex-direction:column; background:#fff; border:1px solid var(--border); border-radius:14px; overflow:hidden; font-size:.8125rem; }
    .recent-card__thumb { display:block; width:100%; padding:0; border:0; background:#0f172a; border-bottom:1px solid var(--border); line-height:0; cursor:zoom-in; font:inherit; text-align:left; }
    .recent-card__thumb img { width:100%; height:auto; display:block; object-fit:contain; max-height:220px; }
    .recent-card__thumb--empty { min-height:120px; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:.75rem; font-weight:700; background:#f8fafc; }
    .recent-card__body { display:flex; flex-direction:column; gap:8px; padding:12px 14px 14px; flex:1; }
    .recent-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
    .recent-card__title { margin:0; font-size:.9375rem; font-weight:900; line-height:1.35; }
    .recent-card__primary { display:inline-block; margin-left:6px; padding:1px 6px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:.625rem; font-weight:800; vertical-align:middle; }
    .recent-card__verdict { flex-shrink:0; }
    .recent-card__stats { margin:0; display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:.75rem; }
    .recent-card__stats div { display:flex; align-items:baseline; gap:6px; }
    .recent-card__stats dt { margin:0; font-weight:800; color:var(--muted); }
    .recent-card__stats dd { margin:0; font-weight:900; color:var(--text); }
    .recent-card__date { font-size:.75rem; color:var(--muted); }
    .recent-card__cta { display:inline-flex; align-items:center; justify-content:center; margin-top:4px; padding:8px 12px; border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:.8125rem; font-weight:800; text-decoration:none; }
    .recent-card__cta:hover { background:#dbeafe; text-decoration:none; }
    .recent-card__aux { margin-top:auto; padding-top:8px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:.6875rem; font-weight:700; }
    .recent-card__aux a { color:#64748b; text-decoration:none; }
    .recent-card__aux a:hover { color:#1d4ed8; text-decoration:underline; }
    .recent-card__aux-dev { font-size:.625rem; color:#94a3b8 !important; font-weight:600; }
    .recent-card__aux-dev:hover { color:#64748b !important; }
    .recent-card__aux-sep { color:var(--muted); }
    .ai-summary { background:#0f172a; color:#e2e8f0; border-radius:14px; padding:16px 18px; margin-bottom:20px; white-space:pre-wrap; font-size:.875rem; line-height:1.65; }
    .ai-summary__label { display:block; font-size:.6875rem; font-weight:800; letter-spacing:.08em; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; }
    .summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-bottom:20px; }
    .summary-card { background:#fff; border:1px solid var(--border); border-radius:10px; padding:10px 12px; }
    .summary-card__label { font-size:.6875rem; color:var(--muted); font-weight:700; }
    .summary-card__value { margin-top:4px; font-size:1rem; font-weight:900; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.75rem; font-weight:800; }
    .badge--pass { background:#dcfce7; color:var(--pass); }
    .badge--fail { background:#fee2e2; color:var(--fail); }
    .badge--minor { background:#ffedd5; color:var(--minor); }
    .badge--pending { background:#ffedd5; color:var(--pending); }
    .badge--na { background:#f1f5f9; color:var(--muted); }
    .section-title { margin:0 0 12px; font-size:1.0625rem; font-weight:900; padding-bottom:8px; border-bottom:2px solid #d4af37; }
    .section-title--fail { border-bottom-color:var(--fail); color:var(--fail); }
    .fail-section { margin-bottom:24px; margin-top:0; }
    .fail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
    .fail-card { background:#fff; border:2px solid #fecaca; border-radius:14px; padding:14px; scroll-margin-top:20px; }
    .fail-grid--minor .fail-card { border-color:#fed7aa; }
    .fail-card__head { margin-bottom:10px; }
    .fail-card__severity { margin:0 0 6px; }
    .fail-card__title { margin:0; font-size:1.125rem; font-weight:900; }
    .fail-card__vp { margin:4px 0 0; font-size:.8125rem; font-weight:800; color:var(--muted); }
    .fail-card__facts { margin:0 0 12px; display:grid; gap:8px; font-size:.8125rem; }
    .fail-card__facts div { display:grid; grid-template-columns:4.5em 1fr; gap:8px; }
    .fail-card__facts dt { margin:0; font-weight:800; color:var(--muted); }
    .fail-card__facts dd { margin:0; word-break:break-word; }
    .fail-card__shot { display:block; width:100%; padding:0; border:0; background:#0f172a; border-radius:10px; overflow:hidden; cursor:zoom-in; position:relative; }
    .fail-card__shot img { width:100%; height:auto; display:block; object-fit:contain; max-height:420px; }
    .fail-card__shot-hint { position:absolute; right:8px; bottom:8px; background:rgba(15,23,42,.72); color:#fff; font-size:.6875rem; padding:4px 8px; border-radius:6px; }
    .fail-card__no-shot { color:var(--muted); font-size:.8125rem; }
    .pass-banner { background:#dcfce7; border:1px solid #86efac; border-radius:12px; padding:14px; margin-bottom:20px; text-align:center; font-weight:800; }
    .stage-section { margin-bottom:24px; }
    .compare-row { background:#fff; border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:10px; }
    .compare-row__title { margin:0 0 6px; font-size:.875rem; font-weight:800; }
    .compare-row__meta { margin:0; font-size:.6875rem; color:var(--muted); }
    .compare-row__shots { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; }
    @media (max-width:900px){ .compare-row__shots { grid-template-columns:1fr; } }
    .shot-col { border:1px solid var(--border); border-radius:8px; padding:8px; background:#f8fafc; min-width:0; }
    .shot-col--390 { max-width:390px; margin:0 auto; width:100%; }
    .shot-col img { width:100%; height:auto; display:block; object-fit:contain; }
    .shot-col--1280 img { max-height:480px; }
    .shot-vp-label { margin:0 0 4px; font-size:.625rem; font-weight:800; color:var(--muted); }
    .shot-file { margin:4px 0 0; font-size:.625rem; color:var(--muted); word-break:break-all; }
    .shot-thumb { display:block; width:100%; padding:0; border:0; background:transparent; cursor:zoom-in; }
    ${SCREENSHOT_IMAGE_VIEWER_CSS}
    .footer-note { margin-top:20px; text-align:center; font-size:.75rem; color:var(--muted); }
  </style>
</head>
<body>
  <div class="page" id="top">
    <header class="hero hero--compact">
      <h1>TASFUL スクリーンショット検証ハブ</h1>
      <p class="hero__meta">生成: ${esc(data.generatedAt)} · 登録フォルダ <strong>${(data.runRegistry || []).length}</strong> · 主判定: <strong>${esc(data.primaryTitle || data.primaryFolder || "—")}</strong> · 総合 ${statusBadge(data.overall)}</p>
      <p class="hero__url">一覧 URL: <code>/screenshots/index.html</code> · 画像クリックで拡大（pan / zoom 対応）</p>
      ${folderLinks}
    </header>

    ${runRegistrySection}

    ${recentReviewsSection}

    ${failSection}

    <section class="ai-summary" aria-label="AIレビューサマリー">
      <span class="ai-summary__label">AIレビューサマリー</span>${esc(data.aiSummary)}
    </section>

    <section class="summary-grid">
      <div class="summary-card"><div class="summary-card__label">総合</div><div class="summary-card__value">${statusBadge(data.overall)}</div></div>
      <div class="summary-card"><div class="summary-card__label">FAIL</div><div class="summary-card__value">${data.failItems.length}</div></div>
      <div class="summary-card"><div class="summary-card__label">MINOR</div><div class="summary-card__value">${data.minorItems.length}</div></div>
      <div class="summary-card"><div class="summary-card__label">画像</div><div class="summary-card__value">${statusBadge(s.imageDisplay)}</div></div>
      <div class="summary-card"><div class="summary-card__label">購入</div><div class="summary-card__value">${statusBadge(s.purchaseFlow)}</div></div>
      <div class="summary-card"><div class="summary-card__label">通知</div><div class="summary-card__value">${statusBadge(s.notificationFlow)}</div></div>
    </section>

    ${minorSection}

    <h2 class="section-title" id="gallery-section">スクショ比較（主判定フォルダ）</h2>
    ${stageSections}

    ${pastReportsSection}

    <p class="footer-note">キャプチャ / 検証後に自動生成 · 画像クリックで拡大 · Esc で閉じる</p>
  </div>

  ${SCREENSHOT_IMAGE_VIEWER_HTML}

  <script>
    ${SCREENSHOT_IMAGE_VIEWER_SCRIPT}
  </script>
  <script>
    (function () {
      function applyGlobalViewportFilter(vp) {
        const id = String(vp || "all");
        document.querySelectorAll("[data-global-viewport-filter]").forEach((chip) => {
          const active = chip.getAttribute("data-global-viewport-filter") === id;
          chip.classList.toggle("viewport-filter-chip--active", active);
          chip.setAttribute("aria-pressed", active ? "true" : "false");
        });
        const match = (el) => {
          if (id === "all") return true;
          const raw = el.getAttribute("data-run-viewports") || "";
          return raw.split(",").filter(Boolean).includes(id);
        };
        document.querySelectorAll(".run-registry__row, .recent-card").forEach((el) => {
          el.classList.toggle("is-filtered-out", !match(el));
        });
      }
      document.querySelectorAll("[data-global-viewport-filter]").forEach((chip) => {
        chip.addEventListener("click", () => applyGlobalViewportFilter(chip.getAttribute("data-global-viewport-filter")));
      });

      function scrollToHashTarget() {
        const hash = location.hash.replace("#", "");
        const target = hash
          ? document.getElementById(hash)
          : document.querySelector("[data-fail-card]") || document.getElementById("fail-section");
        if (target) {
          requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            target.classList.add("is-highlighted");
            setTimeout(() => target.classList.remove("is-highlighted"), 2400);
          });
        }
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scrollToHashTarget);
      } else {
        scrollToHashTarget();
      }
      window.addEventListener("hashchange", scrollToHashTarget);

      const filterChips = document.querySelectorAll("[data-review-filter]");
      const reviewCards = document.querySelectorAll("[data-review-folder]");
      function applyReviewFilter(folderId) {
        const id = String(folderId || "all");
        reviewCards.forEach((card) => {
          const show = id === "all" || card.getAttribute("data-review-folder") === id;
          card.classList.toggle("is-filtered-out", !show);
        });
        filterChips.forEach((chip) => {
          const active = chip.getAttribute("data-review-filter") === id;
          chip.classList.toggle("review-filter-chip--active", active);
          chip.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }
      filterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
          applyReviewFilter(chip.getAttribute("data-review-filter"));
          const section = document.getElementById("recent-reviews");
          if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      const hashFolder = location.hash.replace(/^#review-/, "");
      if (hashFolder && document.querySelector('[data-review-filter="' + hashFolder + '"]')) {
        applyReviewFilter(hashFolder);
      }
    })();
  </script>
  <style>.is-highlighted { box-shadow: 0 0 0 3px #fbbf24; }</style>
</body>
</html>`;
}

/**
 * @param {string} root
 * @param {{ primaryFolder?: string }} [opts]
 */
export async function writeScreenshotsIndex(root, opts = {}) {
  await ensureScreenshotFolderIndexes(root, {
    refreshAll: opts.refreshFolderIndexes === true,
  });
  const data = await buildScreenshotsIndexData(root, opts);
  const html = renderScreenshotsIndexHtml(data);
  const outPath = join(root, "screenshots", "index.html");
  await writeFile(outPath, html, "utf8");
  return { outPath, data };
}
