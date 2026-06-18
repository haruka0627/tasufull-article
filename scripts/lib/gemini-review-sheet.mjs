/**
 * Gemini UI/UX レビュー用 — 複数スクショを1枚シートに合成
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

export const REVIEW_SHEET_WIDTH = 1920;

const BG = "#f4f5f7";
const HEADER_BG = "#1a1a2e";
const HEADER_FG = "#ffffff";
const LABEL_FG = "#555555";
const ACCENT = "#e85d04";

/**
 * @param {string} text
 * @param {number} width
 * @param {number} height
 * @param {{ fontSize?: number, fill?: string, bg?: string, weight?: number }} [opts]
 */
function textBarSvg(text, width, height, opts = {}) {
  const fontSize = opts.fontSize ?? 28;
  const fill = opts.fill ?? HEADER_FG;
  const bg = opts.bg ?? "transparent";
  const weight = opts.weight ?? 600;
  const safe = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="${width / 2}" y="${height / 2 + fontSize * 0.35}" text-anchor="middle"
        font-family="'Segoe UI','Hiragino Sans','Yu Gothic',sans-serif"
        font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${safe}</text>
    </svg>`
  );
}

/**
 * @param {string} imagePath
 * @param {number} colW
 */
async function resizeColumn(imagePath, colW) {
  const img = sharp(imagePath);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error(`Invalid image: ${imagePath}`);
  const scale = colW / meta.width;
  const height = Math.round(meta.height * scale);
  const buffer = await img.resize(colW, height, { fit: "inside" }).png().toBuffer();
  return { buffer, width: colW, height };
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {string} opts.leftPath
 * @param {string} opts.centerPath
 * @param {string} opts.rightPath
 * @param {string} opts.leftLabel
 * @param {string} opts.centerLabel
 * @param {string} opts.rightLabel
 * @param {string} opts.outPath
 * @param {number} [opts.width]
 */
export async function buildThreePanelReviewSheet(opts) {
  const width = opts.width ?? REVIEW_SHEET_WIDTH;
  const pad = 36;
  const headerH = 80;
  const subH = opts.subtitle ? 40 : 0;
  const labelH = 44;
  const gap = 20;
  const contentW = width - pad * 2;
  const colW = Math.floor((contentW - gap * 2) / 3);

  for (const p of [opts.leftPath, opts.centerPath, opts.rightPath]) {
    if (!fs.existsSync(p)) throw new Error(`Missing source image: ${p}`);
  }

  const [left, center, right] = await Promise.all([
    resizeColumn(opts.leftPath, colW),
    resizeColumn(opts.centerPath, colW),
    resizeColumn(opts.rightPath, colW),
  ]);

  const imgH = Math.max(left.height, center.height, right.height);
  const height = pad + headerH + subH + labelH + imgH + pad;

  const headerSvg = textBarSvg(opts.title, width, headerH, {
    bg: HEADER_BG,
    fontSize: 32,
    weight: 700,
  });
  const subSvg = opts.subtitle
    ? textBarSvg(opts.subtitle, width, subH, { fill: LABEL_FG, fontSize: 20, weight: 500 })
    : null;

  const labelY = pad + headerH + subH;
  const labelsSvg = Buffer.from(
    `<svg width="${width}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${pad + colW / 2}" y="30" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="18" font-weight="600" fill="${ACCENT}">${opts.leftLabel}</text>
      <text x="${pad + colW + gap + colW / 2}" y="30" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="18" font-weight="600" fill="${ACCENT}">${opts.centerLabel}</text>
      <text x="${pad + (colW + gap) * 2 + colW / 2}" y="30" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="18" font-weight="600" fill="${ACCENT}">${opts.rightLabel}</text>
    </svg>`
  );

  const imgY = labelY + labelH;
  const leftX = pad;
  const centerX = pad + colW + gap;
  const rightX = pad + (colW + gap) * 2;

  /** @type {import('sharp').OverlayOptions[]} */
  const composites = [
    { input: headerSvg, top: pad, left: 0 },
    { input: left.buffer, top: imgY, left: leftX },
    { input: center.buffer, top: imgY, left: centerX },
    { input: right.buffer, top: imgY, left: rightX },
    { input: labelsSvg, top: labelY, left: 0 },
  ];
  if (subSvg) composites.splice(1, 0, { input: subSvg, top: pad + headerH, left: 0 });

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite(composites)
    .png()
    .toFile(opts.outPath);

  return { outPath: opts.outPath, width, height };
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} opts.imagePath
 * @param {string} opts.outPath
 * @param {number} [opts.width]
 */
export async function buildSinglePanelReviewSheet(opts) {
  const width = opts.width ?? REVIEW_SHEET_WIDTH;
  const pad = 36;
  const headerH = 80;
  const subH = opts.subtitle ? 40 : 0;
  const contentW = width - pad * 2;

  if (!fs.existsSync(opts.imagePath)) throw new Error(`Missing source image: ${opts.imagePath}`);

  const scaled = await resizeColumn(opts.imagePath, contentW);
  const height = pad + headerH + subH + scaled.height + pad;

  const headerSvg = textBarSvg(opts.title, width, headerH, {
    bg: HEADER_BG,
    fontSize: 32,
    weight: 700,
  });
  const subSvg = opts.subtitle
    ? textBarSvg(opts.subtitle, width, subH, { fill: LABEL_FG, fontSize: 20, weight: 500 })
    : null;

  /** @type {import('sharp').OverlayOptions[]} */
  const composites = [
    { input: headerSvg, top: pad, left: 0 },
    { input: scaled.buffer, top: pad + headerH + subH, left: pad },
  ];
  if (subSvg) composites.splice(1, 0, { input: subSvg, top: pad + headerH, left: 0 });

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite(composites)
    .png()
    .toFile(opts.outPath);

  return { outPath: opts.outPath, width, height };
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {Array<{ label: string, path: string }>} opts.items
 * @param {string} opts.outPath
 * @param {number} [opts.width]
 * @param {number} [opts.columns]
 */
export async function buildGridReviewSheet(opts) {
  const width = opts.width ?? REVIEW_SHEET_WIDTH;
  const columns = opts.columns ?? 3;
  const pad = 36;
  const headerH = 80;
  const subH = opts.subtitle ? 40 : 0;
  const labelH = 36;
  const gap = 20;
  const contentW = width - pad * 2;
  const colW = Math.floor((contentW - gap * (columns - 1)) / columns);

  const cells = [];
  for (const item of opts.items) {
    if (!fs.existsSync(item.path)) throw new Error(`Missing source image: ${item.path}`);
    const scaled = await resizeColumn(item.path, colW);
    cells.push({ ...item, ...scaled });
  }

  const rows = Math.ceil(cells.length / columns);
  let rowHeights = [];
  for (let r = 0; r < rows; r += 1) {
    const rowCells = cells.slice(r * columns, r * columns + columns);
    rowHeights.push(Math.max(...rowCells.map((c) => c.height)));
  }

  const rowBlockH = labelH + Math.max(...rowHeights, 0);
  const height = pad + headerH + subH + rows * rowBlockH + (rows - 1) * gap + pad;

  const headerSvg = textBarSvg(opts.title, width, headerH, {
    bg: HEADER_BG,
    fontSize: 32,
    weight: 700,
  });
  const subSvg = opts.subtitle
    ? textBarSvg(opts.subtitle, width, subH, { fill: LABEL_FG, fontSize: 20, weight: 500 })
    : null;

  /** @type {import('sharp').OverlayOptions[]} */
  const composites = [{ input: headerSvg, top: pad, left: 0 }];
  if (subSvg) composites.push({ input: subSvg, top: pad + headerH, left: 0 });

  let y = pad + headerH + subH;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const idx = r * columns + c;
      if (idx >= cells.length) break;
      const cell = cells[idx];
      const x = pad + c * (colW + gap);
      const labelSvg = Buffer.from(
        `<svg width="${colW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
          <text x="${colW / 2}" y="24" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="16" font-weight="600" fill="${ACCENT}">${cell.label}</text>
        </svg>`
      );
      composites.push({ input: labelSvg, top: y, left: x });
      composites.push({ input: cell.buffer, top: y + labelH, left: x });
    }
    y += rowBlockH + gap;
  }

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite(composites)
    .png()
    .toFile(opts.outPath);

  return { outPath: opts.outPath, width, height };
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.leftTitle
 * @param {string} opts.rightTitle
 * @param {string} opts.leftPath
 * @param {string} opts.rightPath
 * @param {string} opts.outPath
 * @param {number} [opts.width]
 */
export async function buildTwoPanelReviewSheet(opts) {
  const width = opts.width ?? REVIEW_SHEET_WIDTH;
  const pad = 36;
  const headerH = 80;
  const labelH = 44;
  const gap = 24;
  const contentW = width - pad * 2;
  const colW = Math.floor((contentW - gap) / 2);

  for (const p of [opts.leftPath, opts.rightPath]) {
    if (!fs.existsSync(p)) throw new Error(`Missing source image: ${p}`);
  }

  const [left, right] = await Promise.all([
    resizeColumn(opts.leftPath, colW),
    resizeColumn(opts.rightPath, colW),
  ]);
  const imgH = Math.max(left.height, right.height);
  const height = pad + headerH + labelH + imgH + pad;

  const headerSvg = textBarSvg(opts.title, width, headerH, {
    bg: HEADER_BG,
    fontSize: 32,
    weight: 700,
  });
  const labelsSvg = Buffer.from(
    `<svg width="${width}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${pad + colW / 2}" y="30" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="18" font-weight="600" fill="${ACCENT}">${opts.leftTitle}</text>
      <text x="${pad + colW + gap + colW / 2}" y="30" text-anchor="middle" font-family="'Segoe UI','Hiragino Sans',sans-serif" font-size="18" font-weight="600" fill="${ACCENT}">${opts.rightTitle}</text>
    </svg>`
  );

  const imgY = pad + headerH + labelH;
  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([
      { input: headerSvg, top: pad, left: 0 },
      { input: labelsSvg, top: pad + headerH, left: 0 },
      { input: left.buffer, top: imgY, left: pad },
      { input: right.buffer, top: imgY, left: pad + colW + gap },
    ])
    .png()
    .toFile(opts.outPath);

  return { outPath: opts.outPath, width, height };
}
