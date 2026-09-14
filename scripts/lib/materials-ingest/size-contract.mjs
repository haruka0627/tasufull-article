/**
 * Materials Size Contract SSOT — mirrored from ComfyUI-AutoGenerator/run.py
 * (CATEGORY_SIZE_TABLE, CATEGORY_DEFAULT_ASPECT, MAX_LONG_EDGE).
 * Do not invent sizes for categories absent from that table.
 */
export const SIZE_CONTRACT_SOURCE = "ComfyUI-AutoGenerator/run.py";

export const MAX_LONG_EDGE = 1536;

/** category (Drive major) → aspect → [w, h] */
export const CATEGORY_SIZE_TABLE = Object.freeze({
  背景: Object.freeze({
    "16:9": Object.freeze([1344, 768]),
    "4:3": Object.freeze([1152, 896]),
    "9:16": Object.freeze([768, 1344]),
  }),
  SNS: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
    "4:5": Object.freeze([896, 1120]),
    "9:16": Object.freeze([768, 1344]),
  }),
  イラスト: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
    "3:4": Object.freeze([896, 1152]),
    "4:3": Object.freeze([1152, 896]),
  }),
  AI: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
    "16:9": Object.freeze([1344, 768]),
  }),
  SF: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
    "16:9": Object.freeze([1344, 768]),
  }),
  モックアップ: Object.freeze({
    "4:3": Object.freeze([1152, 896]),
    "16:9": Object.freeze([1344, 768]),
    "3:4": Object.freeze([896, 1152]),
  }),
  ロゴ: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
  }),
  アイコン: Object.freeze({
    "1:1": Object.freeze([1024, 1024]),
  }),
});

export const CATEGORY_DEFAULT_ASPECT = Object.freeze({
  背景: "16:9",
  SNS: "1:1",
  イラスト: "1:1",
  AI: "1:1",
  SF: "1:1",
  モックアップ: "4:3",
  ロゴ: "1:1",
  アイコン: "1:1",
});

export const PUBLIC_ID_TO_SIZE_MAJOR = Object.freeze({
  background: "背景",
  illustration: "イラスト",
  icon: "アイコン",
  image: "SNS",
});

export function gcd(a, b) {
  let x = Math.abs(Number(a) || 0);
  let y = Math.abs(Number(b) || 0);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function aspectLabel(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!w || !h) return null;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

export function allowedPairsForMajor(major) {
  const table = CATEGORY_SIZE_TABLE[major];
  if (!table) return [];
  return Object.values(table).map(([w, h]) => ({ width: w, height: h }));
}

export function defaultPairForMajor(major) {
  const aspect = CATEGORY_DEFAULT_ASPECT[major];
  const pair = CATEGORY_SIZE_TABLE[major]?.[aspect];
  if (!pair) return null;
  return { width: pair[0], height: pair[1], aspect };
}

/**
 * Raster size QA. Non-raster / unknown major → skip (do not invent).
 * Existing inventory: exact pixel match to an allowed pair. No stretch/upscale.
 */
export function evaluateSizeContract({
  width,
  height,
  major,
  publicId,
} = {}) {
  const resolvedMajor =
    major || PUBLIC_ID_TO_SIZE_MAJOR[String(publicId || "")] || "";
  if (!resolvedMajor || !CATEGORY_SIZE_TABLE[resolvedMajor]) {
    return { applicable: false, ok: true, reason: "size_contract_not_applicable" };
  }
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    return {
      applicable: true,
      ok: false,
      reason: "size_unreadable",
      width: w || null,
      height: h || null,
      major: resolvedMajor,
    };
  }
  const longEdge = Math.max(w, h);
  if (longEdge > MAX_LONG_EDGE) {
    return {
      applicable: true,
      ok: false,
      reason: "max_dimension_exceeded",
      width: w,
      height: h,
      aspect: aspectLabel(w, h),
      long_edge: longEdge,
      max_long_edge: MAX_LONG_EDGE,
      major: resolvedMajor,
    };
  }
  const allowed = allowedPairsForMajor(resolvedMajor);
  const match = allowed.find((p) => p.width === w && p.height === h);
  if (!match) {
    return {
      applicable: true,
      ok: false,
      reason: "size_not_in_contract",
      width: w,
      height: h,
      aspect: aspectLabel(w, h),
      long_edge: longEdge,
      allowed,
      major: resolvedMajor,
    };
  }
  return {
    applicable: true,
    ok: true,
    reason: null,
    width: w,
    height: h,
    aspect: aspectLabel(w, h),
    long_edge: longEdge,
    major: resolvedMajor,
  };
}

export function readRasterDimensions(filePath, fsModule, buffer) {
  const buf =
    buffer ||
    (fsModule && filePath ? fsModule.readFileSync(filePath) : null);
  if (!buf || buf.length < 24) return null;
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return readJpegDimensions(buf);
  }
  return null;
}

function readJpegDimensions(buf) {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const len = buf.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height, format: "jpeg" };
    }
    offset += 2 + len;
  }
  return null;
}
