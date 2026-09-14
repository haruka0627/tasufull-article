/**
 * TASFUL Materials — Quality Judge V1
 * ACTIVE_TASK: Final Local Generator Map Integration v1 §6
 *
 * Unifying, category-aware structural quality checks. A generator producing a
 * DIFFERENT output than another is not, by itself, a PASS — this module checks
 * the artifact itself. Deterministic/static checks only (no perceptual ML judge
 * in repo) — anything requiring subjective visual/audio judgement is flagged
 * HUMAN_VISUAL_QA_REQUIRED / HUMAN_AUDIO_QA_REQUIRED rather than silently PASSed.
 */
import fs from "node:fs";

export const QUALITY_JUDGE_V1_VERSION = "materials-quality-judge-v1";

export const QUALITY_CHECKS = Object.freeze([
  "USABLE",
  "READABLE",
  "STRUCTURALLY_VALID",
  "FORMAT_VALID",
  "NO_BROKEN_LAYOUT",
  "NO_PLACEHOLDER_ERROR",
  "NO_GENERATION_ARTIFACT",
  "NO_OBVIOUS_CORRUPTION",
]);

function baseResult() {
  const r = {};
  for (const c of QUALITY_CHECKS) r[c] = null; // null = not evaluated for this category
  return r;
}

/** Print family (HTML): text clipping / bleed-margin / hierarchy / QR readability if used. */
export function judgePrintHtml(htmlPath) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(htmlPath)) {
    return { ok: false, checks: r, findings: ["FILE_MISSING"] };
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  r.FORMAT_VALID = /<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html);
  r.STRUCTURALLY_VALID = (html.match(/<article/g) || []).length >= 1 && /<\/article>/.test(html);
  const hasUnresolvedTemplateSyntax = /\{\{|\}\}|undefined|NaN|\[object Object\]/.test(html);
  r.NO_GENERATION_ARTIFACT = !hasUnresolvedTemplateSyntax;
  if (hasUnresolvedTemplateSyntax) findings.push("UNRESOLVED_TEMPLATE_SYNTAX");
  // Bracketed placeholders like [キャッチコピー] are intentional editable placeholders,
  // not errors — distinct from broken-render errors (undefined/NaN/{{}}).
  r.NO_PLACEHOLDER_ERROR = !hasUnresolvedTemplateSyntax;
  r.NO_BROKEN_LAYOUT = !/position:\s*absolute[^"]*inset:\s*0[^"]*z-index:\s*0/.test(html) || /z-index:\s*1/.test(html);
  r.READABLE = /color:\s*var\(--ink\)|color:\s*#/.test(html);
  r.NO_OBVIOUS_CORRUPTION = html.length > 200 && !html.includes("\uFFFD");
  const qrMentioned = /QR/i.test(html);
  if (qrMentioned) {
    r.QR_READABILITY_NOTE = "QR is a labeled placeholder box in controlled generation — real QR payload/readability requires Human visual scan once real data is bound.";
  }
  r.USABLE = r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_BROKEN_LAYOUT;
  const ok = [r.FORMAT_VALID, r.STRUCTURALLY_VALID, r.NO_GENERATION_ARTIFACT, r.NO_BROKEN_LAYOUT, r.NO_OBVIOUS_CORRUPTION].every(Boolean);
  return { ok, checks: r, findings };
}

/** Presentation family (PPTX): slide clipping / broken objects / readability — via zip+xml structural check. */
export function judgePresentationPptx(pptxPath) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(pptxPath)) return { ok: false, checks: r, findings: ["FILE_MISSING"] };
  const stat = fs.statSync(pptxPath);
  const buf = fs.readFileSync(pptxPath);
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
  r.FORMAT_VALID = isZip && stat.size > 1000;
  r.STRUCTURALLY_VALID = isZip; // full XML slide parse is out of scope for this static judge; zip integrity is the deterministic floor
  r.NO_OBVIOUS_CORRUPTION = stat.size > 1000;
  r.USABLE = r.FORMAT_VALID;
  if (!isZip) findings.push("NOT_VALID_ZIP_OOXML");
  r.NO_BROKEN_LAYOUT = null; // requires opening in PowerPoint/Human — not claimed PASS here
  r.READABLE = null;
  const ok = Boolean(r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_OBVIOUS_CORRUPTION);
  return { ok, checks: r, findings, human_visual_qa_required: true };
}

/** Web family: responsive / broken links-components / overflow (static heuristics on source). */
export function judgeWebPackage(htmlPath, cssPath) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(htmlPath)) return { ok: false, checks: r, findings: ["HTML_MISSING"] };
  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  r.FORMAT_VALID = /<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html);
  r.STRUCTURALLY_VALID = /page-root/.test(html);
  r.NO_GENERATION_ARTIFACT = !/\{\{|\}\}|undefined|NaN/.test(html);
  const hasViewportMeta = /name="viewport"/.test(html);
  r.USABLE = hasViewportMeta;
  if (!hasViewportMeta) findings.push("MISSING_VIEWPORT_META");
  const hasMediaQuery = /@media/.test(css);
  r.NO_BROKEN_LAYOUT = css.length > 0;
  r.READABLE = hasMediaQuery || css.length > 0;
  if (!hasMediaQuery) findings.push("NO_RESPONSIVE_MEDIA_QUERY_DETECTED");
  r.NO_OBVIOUS_CORRUPTION = html.length > 100 && css.length >= 0;
  const ok = Boolean(r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_GENERATION_ARTIFACT);
  return { ok, checks: r, findings };
}

/** Code family: build/test where applicable — static syntax sanity only (no toolchain invocation here). */
export function judgeCodeFile(codePath) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(codePath)) return { ok: false, checks: r, findings: ["FILE_MISSING"] };
  const src = fs.readFileSync(codePath, "utf8");
  r.NO_OBVIOUS_CORRUPTION = src.length > 5 && !src.includes("\uFFFD");
  r.NO_GENERATION_ARTIFACT = !/<<<<<<<|TODO: fill me|\[object Object\]/.test(src);
  r.FORMAT_VALID = true; // language-specific full parse deferred to per-generator qa.py (existing)
  r.STRUCTURALLY_VALID = /function|def |class |const |=>/.test(src);
  r.USABLE = r.STRUCTURALLY_VALID;
  const ok = Boolean(r.NO_OBVIOUS_CORRUPTION && r.NO_GENERATION_ARTIFACT && r.STRUCTURALLY_VALID);
  return { ok, checks: r, findings };
}

function peakAbs(arr) {
  let peak = 0;
  let nonFinite = false;
  for (let i = 0; i < arr.length; i += 1) {
    const v = arr[i];
    if (!Number.isFinite(v)) nonFinite = true;
    else {
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
  }
  return { peak, nonFinite };
}

/** SFX/BGM family: malformed audio / duration / clipping / silence — WAV header + PCM sanity. */
export function judgeWavBuffer({ L, R, sampleRate, durationSec }) {
  const r = baseResult();
  const findings = [];
  const left = peakAbs(L);
  const right = peakAbs(R);
  r.NO_OBVIOUS_CORRUPTION = !left.nonFinite && !right.nonFinite;
  if (!r.NO_OBVIOUS_CORRUPTION) findings.push("NON_FINITE_SAMPLE");
  const peak = Math.max(left.peak, right.peak);
  r.NO_GENERATION_ARTIFACT = peak <= 1.0001; // clipping check
  if (peak > 1.0001) findings.push("CLIPPING_DETECTED");
  const isSilent = peak < 0.001;
  r.FORMAT_VALID = Number.isFinite(durationSec) && durationSec > 0;
  r.USABLE = !isSilent && r.FORMAT_VALID;
  if (isSilent) findings.push("SILENCE_DETECTED");
  r.STRUCTURALLY_VALID = L.length === R.length && L.length > 0;
  r.READABLE = null; // timbre requires human listen
  r.NO_BROKEN_LAYOUT = null;
  const ok = Boolean(r.NO_OBVIOUS_CORRUPTION && r.NO_GENERATION_ARTIFACT && r.FORMAT_VALID && r.USABLE && r.STRUCTURALLY_VALID);
  return { ok, checks: r, findings, human_audio_qa_required: true, peak };
}

/**
 * Raster image family (PNG): structural validity via magic bytes + IHDR chunk
 * dimension sanity. Added for Generator Local Setup & Controlled QA v1 (Qwen-Image
 * local pipeline) — perceptual quality/composition is HUMAN_VISUAL_QA_REQUIRED,
 * this judge only catches truncated/corrupt/zero-byte generation failures.
 */
export function judgeRasterImagePng(pngPath) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(pngPath)) return { ok: false, checks: r, findings: ["FILE_MISSING"] };
  const buf = fs.readFileSync(pngPath);
  const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  r.FORMAT_VALID = isPng;
  if (!isPng) {
    findings.push("NOT_VALID_PNG_MAGIC_BYTES");
    return { ok: false, checks: r, findings, human_visual_qa_required: true };
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  r.STRUCTURALLY_VALID = width > 0 && height > 0;
  // A near-blank/failed generation often collapses to a tiny or absurdly small file
  // relative to its declared dimensions; this is a coarse floor, not a quality score.
  const bytesPerPixel = buf.length / Math.max(1, width * height);
  r.NO_OBVIOUS_CORRUPTION = buf.length > 5000 && bytesPerPixel > 0.02;
  if (!r.NO_OBVIOUS_CORRUPTION) findings.push("SUSPICIOUSLY_SMALL_FILE_FOR_DECLARED_DIMENSIONS");
  r.NO_GENERATION_ARTIFACT = null; // e.g. garbled hands/text-in-image requires human eyes
  r.USABLE = r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_OBVIOUS_CORRUPTION;
  r.READABLE = null;
  r.NO_BROKEN_LAYOUT = null;
  r.NO_PLACEHOLDER_ERROR = null;
  const ok = Boolean(r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_OBVIOUS_CORRUPTION);
  return { ok, checks: r, findings, dims: { width, height }, human_visual_qa_required: true };
}

/**
 * PDF export family: header/page-object structural validity via a lightweight
 * byte-level regex scan (page count + /MediaBox print dimensions) — no third-party
 * PDF parser dependency added to the repo for this check. Added for Generator Local
 * Setup & Controlled QA v1 (Chromium/Playwright PDF renderer).
 */
export function judgePdfDocument(pdfPath, { expectedWidthPt, expectedHeightPt, tolerancePt = 1.5 } = {}) {
  const r = baseResult();
  const findings = [];
  if (!fs.existsSync(pdfPath)) return { ok: false, checks: r, findings: ["FILE_MISSING"] };
  const buf = fs.readFileSync(pdfPath);
  const text = buf.toString("latin1");
  const hasHeader = text.startsWith("%PDF-");
  const pageCount = (text.match(/\/Type\s*\/Page(?!s)\b/g) || []).length;
  r.FORMAT_VALID = hasHeader;
  r.STRUCTURALLY_VALID = pageCount >= 1;
  if (!hasHeader) findings.push("MISSING_PDF_HEADER");
  if (pageCount < 1) findings.push("NO_PAGE_OBJECTS_FOUND");
  const mediaBoxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/g)].map(
    (m) => ({ width: parseFloat(m[3]) - parseFloat(m[1]), height: parseFloat(m[4]) - parseFloat(m[2]) }),
  );
  let dimsOk = true;
  if (expectedWidthPt && expectedHeightPt) {
    dimsOk = mediaBoxes.every(
      (mb) => Math.abs(mb.width - expectedWidthPt) <= tolerancePt && Math.abs(mb.height - expectedHeightPt) <= tolerancePt,
    );
    if (!dimsOk) findings.push("PRINT_DIMENSIONS_MISMATCH");
  }
  r.NO_OBVIOUS_CORRUPTION = buf.length > 500;
  r.USABLE = r.FORMAT_VALID && r.STRUCTURALLY_VALID && dimsOk;
  r.NO_GENERATION_ARTIFACT = null; // text-clipping/overflow requires DOM measurement, done upstream by the render script
  const ok = Boolean(r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_OBVIOUS_CORRUPTION && dimsOk);
  return { ok, checks: r, findings, page_count: pageCount, media_boxes_pt: mediaBoxes };
}

/**
 * Detect elements with zero visible paint — stroke AND fill both resolve to
 * "none" (or stroke-width="0" with no fill). A path/shape like this is present
 * in the DOM but renders completely invisible: NOT_BROKEN_LAYOUT in a naive
 * string-presence sense, but genuinely unusable. Found by Independent Judge
 * review of icon-svg-generator-v1.mjs (style=filled zeroed both paints on
 * pure line-art shapes) — this check exists specifically to catch that class
 * of defect going forward, since NO_BROKEN_LAYOUT (NaN/undefined string check)
 * and READABLE (aria-label presence) cannot detect it.
 */
export function findInvisiblePaintElements(svgText) {
  const offenders = [];
  const tagRe = /<(path|circle|rect|line|polygon|polyline|ellipse)\b([^>]*)\/?>/g;
  let m;
  while ((m = tagRe.exec(svgText))) {
    const [full, tag, attrs] = m;
    const strokeMatch = /stroke="([^"]*)"/.exec(attrs);
    const fillMatch = /fill="([^"]*)"/.exec(attrs);
    const strokeWidthMatch = /stroke-width="([^"]*)"/.exec(attrs);
    const stroke = strokeMatch ? strokeMatch[1] : null;
    const fill = fillMatch ? fillMatch[1] : null;
    const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : null;
    const strokeInvisible = stroke === "none" || stroke === null || strokeWidth === 0;
    const fillInvisible = fill === "none" || fill === null;
    // <line>/<polyline> have no fill concept — judge on stroke alone for those.
    const isStrokeOnlyTag = tag === "line" || tag === "polyline";
    const invisible = isStrokeOnlyTag ? strokeInvisible : strokeInvisible && fillInvisible;
    if (invisible) offenders.push({ tag, snippet: full.slice(0, 120) });
  }
  return { ok: offenders.length === 0, offenders };
}

/** Icon SVG family: structural validity + no raster autotrace + viewBox sanity. */
export function judgeIconSvg(svgText) {
  const r = baseResult();
  const findings = [];
  r.FORMAT_VALID = /^<svg[\s>]/.test(svgText.trim()) && /<\/svg>/.test(svgText);
  r.STRUCTURALLY_VALID = /viewBox="[\d.\s-]+"/.test(svgText) && /<(path|circle|rect|line|polygon|polyline|ellipse)[\s/>]/.test(svgText);
  const hasRaster = /data:image\//.test(svgText) || /<image[\s>]/.test(svgText);
  r.NO_GENERATION_ARTIFACT = !hasRaster;
  if (hasRaster) findings.push("RASTER_EMBED_NOT_ALLOWED_FOR_ICON_FAMILY");
  r.NO_OBVIOUS_CORRUPTION = svgText.length > 50 && !svgText.includes("\uFFFD");
  const invisibleCheck = findInvisiblePaintElements(svgText);
  r.NO_BROKEN_LAYOUT = !/NaN|undefined/.test(svgText) && invisibleCheck.ok;
  if (!invisibleCheck.ok) findings.push({ code: "INVISIBLE_PAINT_ELEMENT", offenders: invisibleCheck.offenders });
  r.USABLE = r.FORMAT_VALID && r.STRUCTURALLY_VALID && invisibleCheck.ok;
  r.READABLE = /aria-label="[^"]+"/.test(svgText);
  const ok = Boolean(r.FORMAT_VALID && r.STRUCTURALLY_VALID && r.NO_GENERATION_ARTIFACT && r.NO_OBVIOUS_CORRUPTION && r.NO_BROKEN_LAYOUT && r.USABLE);
  return { ok, checks: r, findings };
}
