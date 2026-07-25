/**
 * Gemini OCR — image / PDF structural limits（Workers-safe · no deps）
 *
 * - pixel buffer / PDF stream を展開しない
 * - unbounded regex / recursion 禁止
 * - 走査は iteration budget + 件数上限で打ち切る
 */

/** payload validation の decoded 上限と一致（循環 import 回避のため複製） */
var OCR_MAX_DECODED_BYTES = Math.floor((6 * 1024 * 1024 * 3) / 4);

export var OCR_MAX_IMAGE_WIDTH = 12_000;
export var OCR_MAX_IMAGE_HEIGHT = 12_000;
export var OCR_MAX_IMAGE_PIXELS = 40_000_000;
export var OCR_MIN_IMAGE_DIM = 1;

export var OCR_MAX_PDF_PAGES = 20;
export var OCR_MAX_PDF_OBJECTS = 10_000;
export var OCR_MAX_PDF_NESTING = 32;
export var OCR_MAX_PDF_STREAMS = 2_000;
export var OCR_MAX_PDF_TRAILING_AFTER_EOF = 64;
export var OCR_MAX_IMAGE_TRAILING_AFTER_END = 64;

var MAX_PNG_CHUNKS = 2_048;
var MAX_JPEG_MARKERS = 8_192;
var MAX_WEBP_CHUNKS = 256;
var MAX_GIF_BLOCKS = 4_096;
var MAX_STRUCTURE_OPS = 200_000;
var MAX_PDF_INCREMENTAL_EOF = 3;

/** Progressive JPEG (SOF2) は許可 · 同じ dimension 制限 */
export var OCR_ALLOW_PROGRESSIVE_JPEG = true;

function fail(error, status) {
  return { ok: false, error: error, status: status };
}

function ok() {
  return { ok: true };
}

function readU32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  ) >>> 0;
}

function readU16BE(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

function readU16LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
}

function readI32LE(bytes, offset) {
  var u = readU32LE(bytes, offset);
  return u > 0x7fffffff ? u - 0x100000000 : u;
}

function readU32LE(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function checkDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return fail("invalid_image_structure", 400);
  }
  if (width < OCR_MIN_IMAGE_DIM || height < OCR_MIN_IMAGE_DIM) {
    return fail("invalid_image_structure", 400);
  }
  if (width > OCR_MAX_IMAGE_WIDTH || height > OCR_MAX_IMAGE_HEIGHT) {
    return fail("image_dimensions_exceeded", 400);
  }
  // overflow-safe pixel product
  if (width > Math.floor(OCR_MAX_IMAGE_PIXELS / height)) {
    return fail("image_dimensions_exceeded", 400);
  }
  return ok();
}

function asciiEquals(bytes, offset, ascii) {
  if (offset + ascii.length > bytes.length) return false;
  for (var i = 0; i < ascii.length; i += 1) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

function trailingAfter(bytes, endExclusive) {
  return Math.max(0, bytes.length - endExclusive);
}

// ---- PNG CRC32（ITU-T V.42 · 軽量テーブル） ----
var PNG_CRC_TABLE = null;
function pngCrcTable() {
  if (PNG_CRC_TABLE) return PNG_CRC_TABLE;
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n += 1) {
    var c = n;
    for (var k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  PNG_CRC_TABLE = table;
  return table;
}

function pngCrc32(typeBytes, data, dataOffset, dataLen) {
  var table = pngCrcTable();
  var crc = 0xffffffff;
  for (var i = 0; i < 4; i += 1) {
    crc = table[(crc ^ typeBytes[i]) & 0xff] ^ (crc >>> 8);
  }
  for (var j = 0; j < dataLen; j += 1) {
    crc = table[(crc ^ data[dataOffset + j]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

var PNG_VALID_BIT_DEPTH = Object.freeze({
  0: { 1: 1, 2: 1, 4: 1, 8: 1, 16: 1 },
  2: { 8: 1, 16: 1 },
  3: { 1: 1, 2: 1, 4: 1, 8: 1 },
  4: { 8: 1, 16: 1 },
  6: { 8: 1, 16: 1 },
});

/**
 * @param {Uint8Array} bytes
 * @param {{ ops?: { n: number } }} [ctx]
 */
export function validatePngStructure(bytes, ctx) {
  var ops = ctx && ctx.ops ? ctx.ops : { n: 0 };
  if (bytes.length < 33) return fail("invalid_image_structure", 400);
  if (
    !(
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  ) {
    return fail("invalid_image_structure", 400);
  }

  var offset = 8;
  var sawIHDR = false;
  var sawIEND = false;
  var iendEnd = 0;
  var chunks = 0;

  while (offset + 12 <= bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS || chunks >= MAX_PNG_CHUNKS) {
      return fail("invalid_image_structure", 400);
    }
    chunks += 1;

    var length = readU32BE(bytes, offset);
    if (length > bytes.length - (offset + 12)) {
      return fail("invalid_image_structure", 400);
    }
    var typeOff = offset + 4;
    var dataOff = offset + 8;
    var crcOff = dataOff + length;
    var type =
      String.fromCharCode(bytes[typeOff], bytes[typeOff + 1], bytes[typeOff + 2], bytes[typeOff + 3]);

    var expectedCrc = readU32BE(bytes, crcOff);
    var actualCrc = pngCrc32(
      bytes.subarray(typeOff, typeOff + 4),
      bytes,
      dataOff,
      length
    );
    if (expectedCrc !== actualCrc) {
      return fail("invalid_image_structure", 400);
    }

    if (!sawIHDR) {
      if (type !== "IHDR" || length !== 13) return fail("invalid_image_structure", 400);
      var width = readU32BE(bytes, dataOff);
      var height = readU32BE(bytes, dataOff + 4);
      var dim = checkDimensions(width, height);
      if (!dim.ok) return dim;
      var bitDepth = bytes[dataOff + 8];
      var colorType = bytes[dataOff + 9];
      var compression = bytes[dataOff + 10];
      var filter = bytes[dataOff + 11];
      var interlace = bytes[dataOff + 12];
      var depthOk = PNG_VALID_BIT_DEPTH[colorType] && PNG_VALID_BIT_DEPTH[colorType][bitDepth];
      if (!depthOk || compression !== 0 || filter !== 0 || (interlace !== 0 && interlace !== 1)) {
        return fail("invalid_image_structure", 400);
      }
      sawIHDR = true;
    } else if (type === "IHDR") {
      return fail("invalid_image_structure", 400);
    }

    if (type === "IEND") {
      if (length !== 0) return fail("invalid_image_structure", 400);
      sawIEND = true;
      iendEnd = crcOff + 4;
      break;
    }

    offset = crcOff + 4;
  }

  if (!sawIHDR || !sawIEND) return fail("invalid_image_structure", 400);
  if (trailingAfter(bytes, iendEnd) > OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  return ok();
}

/**
 * @param {Uint8Array} bytes
 * @param {{ ops?: { n: number } }} [ctx]
 */
export function validateJpegStructure(bytes, ctx) {
  var ops = ctx && ctx.ops ? ctx.ops : { n: 0 };
  if (bytes.length < 4) return fail("invalid_image_structure", 400);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return fail("invalid_image_structure", 400);

  var offset = 2;
  var markers = 0;
  var sawSOF = false;
  var eoiEnd = 0;
  var width = 0;
  var height = 0;

  while (offset < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS || markers >= MAX_JPEG_MARKERS) {
      return fail("invalid_image_structure", 400);
    }

    // skip fill 0xFF
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
      ops.n += 1;
      if (ops.n > MAX_STRUCTURE_OPS) return fail("invalid_image_structure", 400);
    }
    if (offset >= bytes.length) return fail("invalid_image_structure", 400);

    var marker = bytes[offset];
    offset += 1;
    markers += 1;

    // standalone markers without length
    if (marker === 0xd9) {
      // EOI
      eoiEnd = offset;
      break;
    }
    if (marker === 0xd8) return fail("invalid_image_structure", 400); // nested SOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    // SOS: length then entropy-coded data until next marker
    if (marker === 0xda) {
      if (offset + 2 > bytes.length) return fail("invalid_image_structure", 400);
      var sosLen = readU16BE(bytes, offset);
      if (sosLen < 2 || offset + sosLen > bytes.length) {
        return fail("invalid_image_structure", 400);
      }
      offset += sosLen;
      // scan entropy until EOI / next marker (0xFF not followed by 00 or RSTn)
      while (offset < bytes.length) {
        ops.n += 1;
        if (ops.n > MAX_STRUCTURE_OPS) return fail("invalid_image_structure", 400);
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        if (offset + 1 >= bytes.length) return fail("invalid_image_structure", 400);
        var nxt = bytes[offset + 1];
        if (nxt === 0x00 || (nxt >= 0xd0 && nxt <= 0xd7)) {
          offset += 2;
          continue;
        }
        if (nxt === 0xff) {
          offset += 1;
          continue;
        }
        // real marker — leave for outer loop (rewinds to 0xFF)
        break;
      }
      continue;
    }

    if (offset + 2 > bytes.length) return fail("invalid_image_structure", 400);
    var segLen = readU16BE(bytes, offset);
    if (segLen < 2 || offset + segLen > bytes.length) {
      return fail("invalid_image_structure", 400);
    }

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 (not DHT/DAC etc.)
    var isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (marker === 0xc2 && !OCR_ALLOW_PROGRESSIVE_JPEG) {
        return fail("invalid_image_structure", 400);
      }
      if (segLen < 8) return fail("invalid_image_structure", 400);
      height = readU16BE(bytes, offset + 3);
      width = readU16BE(bytes, offset + 5);
      var components = bytes[offset + 7];
      if (!components || components < 1 || components > 4) {
        return fail("invalid_image_structure", 400);
      }
      var dim = checkDimensions(width, height);
      if (!dim.ok) return dim;
      sawSOF = true;
    }

    offset += segLen;
  }

  if (!sawSOF) return fail("invalid_image_structure", 400);
  if (!eoiEnd) return fail("invalid_image_structure", 400);
  if (trailingAfter(bytes, eoiEnd) > OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  return ok();
}

/**
 * WebP: RIFF/WEBP + VP8 / VP8L / VP8X dimensions
 * @param {Uint8Array} bytes
 * @param {{ ops?: { n: number } }} [ctx]
 */
export function validateWebpStructure(bytes, ctx) {
  var ops = ctx && ctx.ops ? ctx.ops : { n: 0 };
  if (bytes.length < 30) return fail("invalid_image_structure", 400);
  if (!asciiEquals(bytes, 0, "RIFF") || !asciiEquals(bytes, 8, "WEBP")) {
    return fail("invalid_image_structure", 400);
  }
  var riffSize = readU32LE(bytes, 4);
  // RIFF size is bytes after offset 8; file may pad to even
  if (riffSize + 8 > bytes.length + 1) return fail("invalid_image_structure", 400);

  var offset = 12;
  var chunks = 0;
  var sawDim = false;
  var width = 0;
  var height = 0;
  var lastChunkEnd = 12;

  while (offset + 8 <= bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS || chunks >= MAX_WEBP_CHUNKS) {
      return fail("invalid_image_structure", 400);
    }
    chunks += 1;
    var fourcc =
      String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    var size = readU32LE(bytes, offset + 4);
    var dataOff = offset + 8;
    if (dataOff + size > bytes.length) return fail("invalid_image_structure", 400);

    if (fourcc === "VP8X" && size >= 10) {
      // canvas width/height are 24-bit + 1
      width =
        1 +
        (bytes[dataOff + 4] | (bytes[dataOff + 5] << 8) | (bytes[dataOff + 6] << 16));
      height =
        1 +
        (bytes[dataOff + 7] | (bytes[dataOff + 8] << 8) | (bytes[dataOff + 9] << 16));
      sawDim = true;
    } else if (fourcc === "VP8 " && size >= 10) {
      // lossy: bytes 6-9 after chunk header data start include 14-bit dims at offset 6
      // frame tag 3 bytes then start code 0x9d 0x01 0x2a then width/height
      if (
        bytes[dataOff + 3] === 0x9d &&
        bytes[dataOff + 4] === 0x01 &&
        bytes[dataOff + 5] === 0x2a
      ) {
        width = readU16LE(bytes, dataOff + 6) & 0x3fff;
        height = readU16LE(bytes, dataOff + 8) & 0x3fff;
        sawDim = true;
      }
    } else if (fourcc === "VP8L" && size >= 5) {
      if (bytes[dataOff] !== 0x2f) return fail("invalid_image_structure", 400);
      var bits =
        bytes[dataOff + 1] |
        (bytes[dataOff + 2] << 8) |
        (bytes[dataOff + 3] << 16) |
        (bytes[dataOff + 4] << 24);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
      sawDim = true;
    }

    var padded = size + (size & 1);
    offset = dataOff + padded;
    lastChunkEnd = offset;
  }

  if (!sawDim) return fail("invalid_image_structure", 400);
  var dim = checkDimensions(width, height);
  if (!dim.ok) return dim;
  if (trailingAfter(bytes, lastChunkEnd) > OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  return ok();
}

/**
 * GIF87a/89a — logical screen descriptor only + bounded block walk
 * @param {Uint8Array} bytes
 * @param {{ ops?: { n: number } }} [ctx]
 */
export function validateGifStructure(bytes, ctx) {
  var ops = ctx && ctx.ops ? ctx.ops : { n: 0 };
  if (bytes.length < 13) return fail("invalid_image_structure", 400);
  if (!asciiEquals(bytes, 0, "GIF87a") && !asciiEquals(bytes, 0, "GIF89a")) {
    return fail("invalid_image_structure", 400);
  }
  var width = readU16LE(bytes, 6);
  var height = readU16LE(bytes, 8);
  var dim = checkDimensions(width, height);
  if (!dim.ok) return dim;

  var packed = bytes[10];
  var offset = 13;
  if (packed & 0x80) {
    var gctSize = 3 * (1 << ((packed & 7) + 1));
    if (offset + gctSize > bytes.length) return fail("invalid_image_structure", 400);
    offset += gctSize;
  }

  var blocks = 0;
  var trailerAt = 0;
  while (offset < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS || blocks >= MAX_GIF_BLOCKS) {
      return fail("invalid_image_structure", 400);
    }
    blocks += 1;
    var intro = bytes[offset];
    if (intro === 0x3b) {
      trailerAt = offset + 1;
      break;
    }
    if (intro === 0x21) {
      // extension
      if (offset + 2 > bytes.length) return fail("invalid_image_structure", 400);
      offset += 2;
      while (offset < bytes.length) {
        ops.n += 1;
        if (ops.n > MAX_STRUCTURE_OPS) return fail("invalid_image_structure", 400);
        var sub = bytes[offset];
        offset += 1;
        if (sub === 0) break;
        if (offset + sub > bytes.length) return fail("invalid_image_structure", 400);
        offset += sub;
      }
      continue;
    }
    if (intro === 0x2c) {
      if (offset + 10 > bytes.length) return fail("invalid_image_structure", 400);
      var localPacked = bytes[offset + 9];
      offset += 10;
      if (localPacked & 0x80) {
        var lct = 3 * (1 << ((localPacked & 7) + 1));
        if (offset + lct > bytes.length) return fail("invalid_image_structure", 400);
        offset += lct;
      }
      if (offset >= bytes.length) return fail("invalid_image_structure", 400);
      offset += 1; // LZW min code size
      while (offset < bytes.length) {
        ops.n += 1;
        if (ops.n > MAX_STRUCTURE_OPS) return fail("invalid_image_structure", 400);
        var sz = bytes[offset];
        offset += 1;
        if (sz === 0) break;
        if (offset + sz > bytes.length) return fail("invalid_image_structure", 400);
        offset += sz;
      }
      continue;
    }
    return fail("invalid_image_structure", 400);
  }

  if (!trailerAt) return fail("invalid_image_structure", 400);
  if (trailingAfter(bytes, trailerAt) > OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  return ok();
}

/**
 * BMP — BITMAPFILEHEADER + DIB header dims · no pixel decode
 * @param {Uint8Array} bytes
 */
export function validateBmpStructure(bytes) {
  if (bytes.length < 26) return fail("invalid_image_structure", 400);
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return fail("invalid_image_structure", 400);
  var fileSize = readU32LE(bytes, 2);
  if (fileSize > 0 && fileSize > bytes.length + OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  var dibSize = readU32LE(bytes, 14);
  if (dibSize < 12 || 14 + dibSize > bytes.length) {
    return fail("invalid_image_structure", 400);
  }

  var width;
  var height;
  if (dibSize === 12) {
    // BITMAPCOREHEADER
    width = readU16LE(bytes, 18);
    height = readU16LE(bytes, 20);
  } else {
    width = Math.abs(readI32LE(bytes, 18));
    height = Math.abs(readI32LE(bytes, 22));
    if (dibSize >= 20) {
      var planes = readU16LE(bytes, 26);
      if (planes !== 1) return fail("invalid_image_structure", 400);
    }
    if (dibSize >= 40) {
      var compression = readU32LE(bytes, 30);
      // 0=RGB 3=BITFIELDS  only
      if (compression !== 0 && compression !== 3) {
        return fail("invalid_image_structure", 400);
      }
    }
  }

  var dim = checkDimensions(width, height);
  if (!dim.ok) return dim;

  if (fileSize > 0 && trailingAfter(bytes, fileSize) > OCR_MAX_IMAGE_TRAILING_AFTER_END) {
    return fail("invalid_image_structure", 400);
  }
  return ok();
}

function indexOfAscii(bytes, start, ascii) {
  var first = ascii.charCodeAt(0);
  var lim = bytes.length - ascii.length;
  for (var i = start; i <= lim; i += 1) {
    if (bytes[i] !== first) continue;
    var okMatch = true;
    for (var j = 1; j < ascii.length; j += 1) {
      if (bytes[i + j] !== ascii.charCodeAt(j)) {
        okMatch = false;
        break;
      }
    }
    if (okMatch) return i;
  }
  return -1;
}

function countAsciiBounded(bytes, ascii, maxCount, ops) {
  var count = 0;
  var pos = 0;
  while (pos < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return { overflow: true, count: count };
    var idx = indexOfAscii(bytes, pos, ascii);
    if (idx < 0) break;
    count += 1;
    if (count > maxCount) return { overflow: true, count: count };
    pos = idx + ascii.length;
  }
  return { overflow: false, count: count };
}

/**
 * PDF — bounded structure scan（無依存）
 * object stream / xref stream / Encrypt / JS 等は unsupported_pdf
 * page 数は /Type/Page 出現と /Count の大きい方を採用（過少算定で通さない）
 *
 * @param {Uint8Array} bytes
 * @param {{ ops?: { n: number } }} [ctx]
 */
export function validatePdfStructure(bytes, ctx) {
  var ops = ctx && ctx.ops ? ctx.ops : { n: 0 };
  if (bytes.length < 15) return fail("invalid_pdf_structure", 400);

  // header must be at start (magic already checked) — version 1.0–1.7 / 2.0
  if (!asciiEquals(bytes, 0, "%PDF-")) return fail("invalid_pdf_structure", 400);
  var verMajor = bytes[5];
  var verDot = bytes[6];
  var verMinor = bytes[7];
  if (verDot !== 0x2e || verMajor !== 0x31 && verMajor !== 0x32) {
    return fail("invalid_pdf_structure", 400);
  }
  if (verMajor === 0x31 && (verMinor < 0x30 || verMinor > 0x37)) {
    return fail("invalid_pdf_structure", 400);
  }
  if (verMajor === 0x32 && verMinor !== 0x30) {
    return fail("invalid_pdf_structure", 400);
  }

  // %%EOF near end
  var searchFrom = Math.max(0, bytes.length - 2048);
  var eofAt = -1;
  var eofCount = 0;
  var pos = searchFrom;
  while (pos < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return fail("payload_validation_unavailable", 503);
    var found = indexOfAscii(bytes, pos, "%%EOF");
    if (found < 0 || found < searchFrom) break;
    eofCount += 1;
    eofAt = found;
    pos = found + 5;
  }
  if (eofAt < 0) return fail("invalid_pdf_structure", 400);
  if (eofCount > MAX_PDF_INCREMENTAL_EOF) return fail("unsupported_pdf", 400);
  var afterEof = bytes.length - (eofAt + 5);
  // allow CR/LF after EOF
  var trail = afterEof;
  var p = eofAt + 5;
  while (p < bytes.length && (bytes[p] === 0x0d || bytes[p] === 0x0a || bytes[p] === 0x20)) {
    p += 1;
    trail -= 1;
  }
  if (trail > OCR_MAX_PDF_TRAILING_AFTER_EOF) return fail("invalid_pdf_structure", 400);

  // startxref
  var startxrefAt = indexOfAscii(bytes, Math.max(0, eofAt - 512), "startxref");
  if (startxrefAt < 0) return fail("invalid_pdf_structure", 400);
  var numPos = startxrefAt + 9;
  while (numPos < bytes.length && (bytes[numPos] === 0x20 || bytes[numPos] === 0x0d || bytes[numPos] === 0x0a)) {
    numPos += 1;
  }
  var xrefOffset = 0;
  var digits = 0;
  while (numPos < bytes.length && bytes[numPos] >= 0x30 && bytes[numPos] <= 0x39) {
    digits += 1;
    if (digits > 12) return fail("invalid_pdf_structure", 400);
    xrefOffset = xrefOffset * 10 + (bytes[numPos] - 0x30);
    numPos += 1;
    ops.n += 1;
  }
  if (digits === 0 || xrefOffset >= bytes.length) return fail("invalid_pdf_structure", 400);

  // unsupported / dangerous features — fixed substring scan（単語境界は簡易）
  var banned = [
    "/Encrypt",
    "/JavaScript",
    "/JS",
    "/EmbeddedFile",
    "/Launch",
    "/XFA",
    "/RichMedia",
    "/ObjStm",
    "/Linearized",
    "/XRef",
  ];
  for (var bi = 0; bi < banned.length; bi += 1) {
    ops.n += 1;
    if (indexOfAscii(bytes, 0, banned[bi]) >= 0) {
      return fail("unsupported_pdf", 400);
    }
  }

  // object count: " obj" occurrences (PDF uses "N G obj")
  var objCount = countAsciiBounded(bytes, " obj", OCR_MAX_PDF_OBJECTS, ops);
  if (objCount.overflow) return fail("pdf_limits_exceeded", 400);

  var streamCount = countAsciiBounded(bytes, "stream", OCR_MAX_PDF_STREAMS, ops);
  if (streamCount.overflow) return fail("pdf_limits_exceeded", 400);

  // nesting depth via << >> and [ ]
  var depth = 0;
  var maxDepth = 0;
  for (var i = 0; i < bytes.length; i += 1) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return fail("payload_validation_unavailable", 503);
    var b = bytes[i];
    if (b === 0x3c && i + 1 < bytes.length && bytes[i + 1] === 0x3c) {
      depth += 1;
      if (depth > maxDepth) maxDepth = depth;
      if (depth > OCR_MAX_PDF_NESTING) return fail("pdf_limits_exceeded", 400);
      i += 1;
    } else if (b === 0x3e && i + 1 < bytes.length && bytes[i + 1] === 0x3e) {
      depth = Math.max(0, depth - 1);
      i += 1;
    } else if (b === 0x5b) {
      depth += 1;
      if (depth > maxDepth) maxDepth = depth;
      if (depth > OCR_MAX_PDF_NESTING) return fail("pdf_limits_exceeded", 400);
    } else if (b === 0x5d) {
      depth = Math.max(0, depth - 1);
    }
  }

  // pages: count /Type/Page and /Type /Page (not Pages)
  var pageHits = 0;
  pos = 0;
  while (pos < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return fail("payload_validation_unavailable", 503);
    var t1 = indexOfAscii(bytes, pos, "/Type/Page");
    var t2 = indexOfAscii(bytes, pos, "/Type /Page");
    var next = -1;
    if (t1 >= 0 && (t2 < 0 || t1 <= t2)) next = t1;
    else if (t2 >= 0) next = t2;
    if (next < 0) break;
    // exclude /Type/Pages
    var after = next + (bytes[next + 5] === 0x20 ? 11 : 10);
    if (after < bytes.length && bytes[after] === 0x73) {
      // 's' of Pages
      pos = after + 1;
      continue;
    }
    pageHits += 1;
    if (pageHits > OCR_MAX_PDF_PAGES) return fail("pdf_limits_exceeded", 400);
    pos = after;
  }

  // /Count N on Pages — take as lower bound of pages when larger
  var countPos = 0;
  var maxCountDecl = 0;
  while (countPos < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return fail("payload_validation_unavailable", 503);
    var cAt = indexOfAscii(bytes, countPos, "/Count");
    if (cAt < 0) break;
    var cp = cAt + 6;
    while (cp < bytes.length && (bytes[cp] === 0x20 || bytes[cp] === 0x0d || bytes[cp] === 0x0a)) {
      cp += 1;
    }
    var nVal = 0;
    var nd = 0;
    while (cp < bytes.length && bytes[cp] >= 0x30 && bytes[cp] <= 0x39) {
      nd += 1;
      if (nd > 6) break;
      nVal = nVal * 10 + (bytes[cp] - 0x30);
      cp += 1;
    }
    if (nd > 0 && nVal > maxCountDecl) maxCountDecl = nVal;
    countPos = cp;
  }
  if (maxCountDecl > OCR_MAX_PDF_PAGES) return fail("pdf_limits_exceeded", 400);

  // ページ数を確定できない・過少の疑い: Page ヒットも Count も 0 → 拒否
  if (pageHits === 0 && maxCountDecl === 0) {
    return fail("invalid_pdf_structure", 400);
  }
  var pagesEstimate = Math.max(pageHits, maxCountDecl);
  if (pagesEstimate > OCR_MAX_PDF_PAGES) return fail("pdf_limits_exceeded", 400);

  // declared /Length exceeding file size
  var lenPos = 0;
  while (lenPos < bytes.length) {
    ops.n += 1;
    if (ops.n > MAX_STRUCTURE_OPS) return fail("payload_validation_unavailable", 503);
    var lAt = indexOfAscii(bytes, lenPos, "/Length");
    if (lAt < 0) break;
    var lp = lAt + 7;
    while (lp < bytes.length && (bytes[lp] === 0x20 || bytes[lp] === 0x0d || bytes[lp] === 0x0a)) {
      lp += 1;
    }
    // skip indirect refs "12 0 R"
    if (lp < bytes.length && bytes[lp] >= 0x30 && bytes[lp] <= 0x39) {
      var lVal = 0;
      var ld = 0;
      var isIndirect = false;
      var save = lp;
      while (lp < bytes.length && bytes[lp] >= 0x30 && bytes[lp] <= 0x39) {
        ld += 1;
        if (ld > 12) break;
        lVal = lVal * 10 + (bytes[lp] - 0x30);
        lp += 1;
      }
      var look = lp;
      while (look < bytes.length && (bytes[look] === 0x20 || bytes[look] === 0x0d || bytes[look] === 0x0a)) {
        look += 1;
      }
      if (look < bytes.length && bytes[look] >= 0x30 && bytes[look] <= 0x39) {
        isIndirect = true;
      }
      if (!isIndirect && ld > 0) {
        if (lVal > OCR_MAX_DECODED_BYTES || lVal > bytes.length) {
          return fail("pdf_limits_exceeded", 400);
        }
      }
      lenPos = isIndirect ? save + 1 : lp;
    } else {
      lenPos = lAt + 7;
    }
  }

  return ok();
}

/**
 * @param {string} mime
 * @param {Uint8Array} bytes
 */
export function validateOcrStructure(mime, bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    return fail("payload_validation_unavailable", 503);
  }
  var ctx = { ops: { n: 0 } };
  try {
    if (mime === "image/png") return validatePngStructure(bytes, ctx);
    if (mime === "image/jpeg") return validateJpegStructure(bytes, ctx);
    if (mime === "image/webp") return validateWebpStructure(bytes, ctx);
    if (mime === "image/gif") return validateGifStructure(bytes, ctx);
    if (mime === "image/bmp") return validateBmpStructure(bytes);
    if (mime === "application/pdf") return validatePdfStructure(bytes, ctx);
    return fail("unsupported_mime_type", 415);
  } catch (_e) {
    return fail("payload_validation_unavailable", 503);
  }
}
