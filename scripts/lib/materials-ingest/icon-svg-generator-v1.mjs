/**
 * TASFUL Local Icon SVG Generator V1
 * ACTIVE_TASK: Final Local Generator Map Integration v1 — family I (ICON / SVG)
 *
 * Deterministic, parametric native-SVG builder. NOT a raster→autotrace pipeline
 * (task explicit: "画像→自動traceを主方式にしない"). Zero external deps, zero GPU,
 * zero external API. Stand-in for "Local OSS Coder LLM → native SVG" until an
 * exact open-weight coder model is pinned in generator-registry-v1.mjs
 * (local-oss-coder-llm row). Same output contract: hand-authored
 * <svg><path/circle/rect/line/polygon> elements honoring the Generation Spec.
 */
import crypto from "node:crypto";

export const ICON_SVG_GENERATOR_V1_VERSION = "tasful-svg-icon-generator-v1";

const STYLE_TOKENS = {
  outline: { stroke: "#111111", fill: "none", strokeWidth: 6 },
  filled: { stroke: "none", fill: "#111111", strokeWidth: 0 },
  duotone: { stroke: "#111111", fill: "#c7d2fe", strokeWidth: 4 },
  minimal: { stroke: "#0f172a", fill: "none", strokeWidth: 4 },
};

function tokensFor(style) {
  return STYLE_TOKENS[style] || STYLE_TOKENS.outline;
}

/**
 * Guaranteed-visible stroke paint for pure line-art (path-only) shapes.
 * A shape drawn with a single <path stroke=... fill="none"> must never end up
 * with BOTH stroke and fill resolving to "none" (this happened for style=filled,
 * where STYLE_TOKENS.filled.stroke === "none" — found by Independent Judge review).
 * Line-art glyphs (arrow/check) are stroke-drawn by construction, so they fall
 * back to the fill color (or a safe default) when the token has no stroke color.
 */
function linePaint(t) {
  const stroke = t.stroke !== "none" ? t.stroke : t.fill !== "none" ? t.fill : "#111111";
  const strokeWidth = t.strokeWidth > 0 ? t.strokeWidth : 6;
  return { stroke, strokeWidth };
}

function esc(s) {
  return String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

/** Shape families keyed by genre/use_case hint — pure geometric primitives, no raster trace. */
const SHAPE_BUILDERS = {
  geometric_symbol(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="22" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><rect x="20" y="20" width="24" height="24" rx="4" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  ui_icon(t) {
    const p = linePaint(t);
    return `<rect x="10" y="14" width="44" height="36" rx="6" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><line x1="10" y1="24" x2="54" y2="24" stroke="${p.stroke}" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  pictogram(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="22" r="10" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M14 54c0-12 8-20 18-20s18 8 18 20" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  arrow(t) {
    const p = linePaint(t);
    return `<path d="M10 32h36M32 14l18 18-18 18" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  check(t) {
    const p = linePaint(t);
    return `<path d="M12 34l12 12 28-28" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  star(t) {
    return `<polygon points="32,8 40,26 60,26 44,38 50,58 32,46 14,58 20,38 4,26 24,26" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${Math.max(2, t.strokeWidth - 2)}"/>`;
  },
};

function cap(p) {
  return `stroke-linecap="round" stroke-linejoin="round"`;
}

/** Function-id glyphs for unified ICON sets. Same viewBox / stroke rule as SHAPE_BUILDERS. */
const GLYPH_BUILDERS = {
  plus(t) {
    const p = linePaint(t);
    return `<line x1="32" y1="14" x2="32" y2="50" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/><line x1="14" y1="32" x2="50" y2="32" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  minus(t) {
    const p = linePaint(t);
    return `<line x1="14" y1="32" x2="50" y2="32" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  trash(t) {
    const p = linePaint(t);
    return `<rect x="18" y="22" width="28" height="28" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M16 22h32M26 22V16h12v6M26 30v14M32 30v14M38 30v14" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  search(t) {
    const p = linePaint(t);
    return `<circle cx="28" cy="28" r="14" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><line x1="38" y1="38" x2="52" y2="52" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  play(t) {
    return `<polygon points="22,14 50,32 22,50" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${Math.max(2, t.strokeWidth)}"/>`;
  },
  download(t) {
    const p = linePaint(t);
    return `<path d="M32 12v28M20 28l12 14 12-14" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/><line x1="14" y1="52" x2="50" y2="52" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  x_error(t) {
    const p = linePaint(t);
    return `<line x1="18" y1="18" x2="46" y2="46" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/><line x1="46" y1="18" x2="18" y2="46" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  warning(t) {
    const p = linePaint(t);
    return `<polygon points="32,10 56,52 8,52" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${Math.max(2, t.strokeWidth)}"/><line x1="32" y1="24" x2="32" y2="38" stroke="${p.stroke}" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/><circle cx="32" cy="46" r="2" fill="${p.stroke}"/>`;
  },
  info(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="22" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><line x1="32" y1="28" x2="32" y2="46" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/><circle cx="32" cy="20" r="2.5" fill="${p.stroke}"/>`;
  },
  spinner(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="18" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" stroke-dasharray="28 80" ${cap(p)}/>`;
  },
  online_dot(t) {
    return `<circle cx="32" cy="32" r="14" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/>`;
  },
  group(t) {
    const p = linePaint(t);
    return `<circle cx="22" cy="22" r="8" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><circle cx="42" cy="22" r="8" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M8 54c0-10 6-16 14-16s14 6 14 16" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/><path d="M28 54c0-10 6-16 14-16s14 6 14 16" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  login(t) {
    const p = linePaint(t);
    return `<rect x="28" y="12" width="24" height="40" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M8 32h24M22 22l14 10-14 10" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  logout(t) {
    const p = linePaint(t);
    return `<rect x="12" y="12" width="24" height="40" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M32 32h24M44 22l14 10-14 10" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  shield(t) {
    const p = linePaint(t);
    return `<path d="M32 8l22 8v16c0 14-10 22-22 26C20 54 10 46 10 32V16z" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M22 32l8 8 14-16" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  guest(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="22" r="10" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M14 54c0-12 8-20 18-20s18 8 18 20" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/><line x1="48" y1="14" x2="56" y2="22" stroke="${p.stroke}" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  pencil(t) {
    const p = linePaint(t);
    return `<path d="M14 50l4-14 26-26 10 10-26 26z" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${Math.max(2, t.strokeWidth)}"/><line x1="36" y1="18" x2="46" y2="28" stroke="${p.stroke}" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  save(t) {
    const p = linePaint(t);
    return `<rect x="12" y="12" width="40" height="40" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><rect x="22" y="12" width="20" height="14" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/><rect x="20" y="36" width="24" height="16" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  copy(t) {
    const p = linePaint(t);
    return `<rect x="18" y="18" width="28" height="32" rx="3" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><rect x="26" y="10" width="28" height="32" rx="3" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  wheelchair(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="44" r="12" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><circle cx="40" cy="18" r="6" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M40 24v10H24" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  hearing(t) {
    const p = linePaint(t);
    return `<path d="M40 18c8 4 12 12 12 20s-4 16-12 20" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/><path d="M32 24c4 2 6 6 6 10s-2 8-6 10" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/><circle cx="24" cy="32" r="6" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/>`;
  },
  vision(t) {
    const p = linePaint(t);
    return `<ellipse cx="32" cy="32" rx="24" ry="14" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><circle cx="32" cy="32" r="8" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/>`;
  },
  access(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="22" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M20 32h24M32 20v24" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  sign(t) {
    const p = linePaint(t);
    return `<rect x="10" y="14" width="44" height="28" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M22 50h20M32 42v8" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  a11y_device(t) {
    const p = linePaint(t);
    return `<rect x="18" y="10" width="28" height="44" rx="6" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><circle cx="32" cy="46" r="3" fill="${p.stroke}"/>`;
  },
  calendar(t) {
    const p = linePaint(t);
    return `<rect x="10" y="16" width="44" height="36" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><line x1="10" y1="26" x2="54" y2="26" stroke="${p.stroke}" stroke-width="${Math.max(2, p.strokeWidth - 2)}"/><line x1="22" y1="10" x2="22" y2="20" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/><line x1="42" y1="10" x2="42" y2="20" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  clock(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="22" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M32 18v16l10 6" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/>`;
  },
  timer(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="36" r="18" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M26 10h12M32 10v8M32 36l8-8" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  alarm(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="34" r="16" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M14 18l8 8M50 18l-8 8M32 22v12" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  schedule(t) {
    const p = linePaint(t);
    return `<rect x="12" y="14" width="40" height="40" rx="4" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M20 28h24M20 38h16" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
  deadline(t) {
    const p = linePaint(t);
    return `<circle cx="32" cy="32" r="22" stroke="${t.stroke}" fill="${t.fill}" stroke-width="${t.strokeWidth}"/><path d="M32 16v16l12 4" stroke="${p.stroke}" fill="none" stroke-width="${p.strokeWidth}" ${cap(p)}/><path d="M48 12l6 6" stroke="${p.stroke}" fill="none" stroke-width="${Math.max(2, p.strokeWidth - 2)}" ${cap(p)}/>`;
  },
};

const FUNCTION_GLYPH = {
  act_add: "plus",
  act_remove: "minus",
  act_delete: "trash",
  act_search: "search",
  act_play: "play",
  act_download: "download",
  act_edit: "pencil",
  act_save: "save",
  act_copy: "copy",
  st_success: "check",
  st_error: "x_error",
  st_warning: "warning",
  st_info: "info",
  st_loading: "spinner",
  st_online: "online_dot",
  acc_user: "pictogram",
  acc_group: "group",
  acc_login: "login",
  acc_logout: "logout",
  acc_admin: "shield",
  acc_guest: "guest",
  a11y_wheelchair: "wheelchair",
  a11y_hearing: "hearing",
  a11y_vision: "vision",
  a11y_access: "access",
  a11y_sign: "sign",
  a11y_device: "a11y_device",
  cal_calendar: "calendar",
  cal_clock: "clock",
  cal_timer: "timer",
  cal_alarm: "alarm",
  cal_schedule: "schedule",
  cal_deadline: "deadline",
};

function pickShapeBuilder(spec) {
  const fn = String(spec.function_id || spec.icon_shape || spec.glyph || "").toLowerCase();
  const mapped = FUNCTION_GLYPH[fn] || fn;
  if (GLYPH_BUILDERS[mapped]) return GLYPH_BUILDERS[mapped];
  if (SHAPE_BUILDERS[mapped]) return SHAPE_BUILDERS[mapped];
  const key = String(spec.genre || spec.sub || "").toLowerCase();
  if (SHAPE_BUILDERS[key]) return SHAPE_BUILDERS[key];
  const order = ["geometric_symbol", "ui_icon", "pictogram", "arrow", "check", "star"];
  const idx = Math.abs(hashStr(fn || key || spec.title || "icon")) % order.length;
  return SHAPE_BUILDERS[order[idx]];
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Generate one native SVG icon honoring the Generation Spec (planner dimensions
 * are passed through, not lost: genre/style/use_case/format are reflected in
 * data-* attributes + actual geometry choice).
 */
export function generateIconSvg({ title, spec = {} } = {}) {
  const style = spec.style || "outline";
  const t = tokensFor(style);
  const build = pickShapeBuilder(spec);
  const inner = build(t);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${esc(title || spec.title || "icon")}" data-genre="${esc(spec.genre || "")}" data-function="${esc(spec.function_id || "")}" data-style="${esc(style)}" data-use-case="${esc(spec.use_case || "")}" data-format="svg" data-family="${esc(spec.family || "")}">
  ${inner}
</svg>
`;
  const structuralFingerprint = crypto
    .createHash("sha256")
    .update(`${build.name}|${style}|${spec.genre || ""}|${spec.function_id || ""}|${spec.use_case || ""}|${spec.family || ""}`)
    .digest("hex")
    .slice(0, 16);
  return {
    svg,
    bytes: Buffer.byteLength(svg, "utf8"),
    shape: build.name,
    style,
    structural_fingerprint: structuralFingerprint,
    generation_spec_honored: Boolean(spec.genre && spec.use_case),
    format: "svg",
  };
}

export function assertNativeSvgNoAutotrace(svgText) {
  // No raster embed (base64 image data) allowed — must be pure vector primitives.
  const hasRaster = /data:image\//.test(svgText) || /<image[\s>]/.test(svgText);
  const hasVectorPrimitive = /<(path|circle|rect|line|polygon|polyline|ellipse)[\s/>]/.test(svgText);
  return { ok: !hasRaster && hasVectorPrimitive, hasRaster, hasVectorPrimitive };
}
